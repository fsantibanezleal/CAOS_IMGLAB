"""Stage: fetch the `real` (licensed) subset of the curated image set, normalize to sRGB 256 + 512 PNG, and
return index entries. CPU-only; network required for this stage only. Every downloaded image passes CONTRACT
1 (io.image) under the BUNDLE policy BEFORE it is written; a museum image whose provider does not confirm
public-domain (Met isPublicDomain, Art Institute is_public_domain) is a hard reject. A source that fails to
resolve or download is logged and skipped, so a partial set still builds.

    python -m imglab.stages.fetch_images --sources data-pipeline/sources.yaml --out data/images
"""
from __future__ import annotations

import argparse
import json
from io import BytesIO
from pathlib import Path
from typing import Any

import requests
import yaml
from PIL import Image

from ..io.image import Policy, to_srgb_rgb, validate_image_bytes

TIMEOUT = 30
# A browser-like UA: several image CDNs (Art Institute IIIF, museum hosts) 403 non-browser agents.
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
}
WORKING = 256
HIRES = 512
DEFAULT_SOURCES = Path(__file__).resolve().parents[2] / "sources.yaml"


def _resolve_met(src: dict[str, Any]) -> tuple[str, bool, str]:
    oid = src["object_id"]
    j = requests.get(
        f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}", headers=UA, timeout=TIMEOUT
    ).json()
    ok = bool(j.get("isPublicDomain"))
    return j.get("primaryImage") or "", ok, f"Met objectID {oid} isPublicDomain={ok}"


def _resolve_artic(src: dict[str, Any]) -> tuple[str, bool, str]:
    aid = src["artwork_id"]
    j = requests.get(
        f"https://api.artic.edu/api/v1/artworks/{aid}",
        params={"fields": "image_id,is_public_domain,title"},
        headers=UA,
        timeout=TIMEOUT,
    ).json()
    data = j.get("data", {})
    ok = bool(data.get("is_public_domain"))
    img_id = data.get("image_id")
    size = src.get("iiif_size", "843,")
    url = f"https://www.artic.edu/iiif/2/{img_id}/full/{size}/0/default.jpg" if img_id else ""
    return url, ok, f"ArtIC id {aid} is_public_domain={ok}"


def _resolve_polyhaven(src: dict[str, Any]) -> tuple[str, bool, str]:
    """Robust: query the texture asset list, pick a slug matching the keyword (no slug guessing), then find
    any color/diffuse map at 2k or 1k jpg/png in its files."""
    kw = str(src.get("keyword", src.get("asset", ""))).lower()
    assets = requests.get(
        "https://api.polyhaven.com/assets", params={"type": "textures"}, headers=UA, timeout=TIMEOUT
    ).json()
    slug = next((s for s in assets if kw and kw in s.lower()), None) or next(iter(assets))
    files = requests.get(f"https://api.polyhaven.com/files/{slug}", headers=UA, timeout=TIMEOUT).json()
    for mapkey in ("Diffuse", "diffuse", "col", "albedo", "Color", "AO"):
        m = files.get(mapkey)
        if isinstance(m, dict):
            for res in ("2k", "1k"):
                block = m.get(res, {})
                for ext in ("jpg", "png"):
                    u = (block.get(ext, {}) or {}).get("url")
                    if u:
                        return u, True, f"PolyHaven {slug} {mapkey} {res} {ext} (CC0)"
    return "", True, f"PolyHaven {slug}: no color map found"


def _resolve_ambientcg(src: dict[str, Any]) -> tuple[str, bool, str]:
    asset = src["asset"]
    j = requests.get(
        "https://ambientcg.com/api/v2/full_json",
        params={"id": asset, "include": "imageData"},
        headers=UA,
        timeout=TIMEOUT,
    ).json()
    url = ""
    for a in j.get("foundAssets", []):
        imgs = a.get("imageData", {})
        for key in ("2K-JPG", "1K-JPG", "512-JPG"):
            block = imgs.get(key)
            if isinstance(block, dict):
                url = block.get("full") or block.get("1000") or ""
            if url:
                break
        if url:
            break
    return url, True, f"ambientCG asset {asset} (CC0)"


RESOLVERS = {"met": _resolve_met, "artic": _resolve_artic, "polyhaven": _resolve_polyhaven, "ambientcg": _resolve_ambientcg}


def _download(url: str, mirrors: list[str]) -> bytes:
    last: Exception | None = None
    for u in [url, *mirrors]:
        try:
            r = requests.get(u, headers=UA, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as exc:
            last = exc
    raise RuntimeError(f"all urls failed for {url}: {last!r}")


def _center_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    return img.crop((left, top, left + s, top + s))


def fetch_one(src: dict[str, Any], out_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    mode = src["mode"]
    note = ""
    if mode == "direct":
        url, license_ok = src["url"], True
    else:
        url, license_ok, note = RESOLVERS[mode](src)
    if not url or url.startswith("<"):
        raise RuntimeError(f"{src['id']}: no image url resolved ({note or url})")
    if not license_ok:
        raise RuntimeError(f"{src['id']}: provider does not confirm public-domain; REJECTED ({note})")

    raw = _download(url, src.get("mirrors", []))
    verdict = validate_image_bytes(
        raw, image_id=src["id"], policy=Policy.BUNDLE, spdx=src["spdx"], attribution=src.get("attribution")
    )
    if not verdict.accepted:
        raise RuntimeError(f"{src['id']}: CONTRACT 1 reject: {verdict.reason}")

    img = to_srgb_rgb(Image.open(BytesIO(raw)))
    sq = _center_square(img)
    out_dir.mkdir(parents=True, exist_ok=True)
    sq.resize((WORKING, WORKING), Image.LANCZOS).save(out_dir / f"{src['id']}.png", optimize=True)
    sq.resize((HIRES, HIRES), Image.LANCZOS).save(out_dir / f"{src['id']}.hi.png", optimize=True)

    entry = {
        "id": src["id"], "category": src["category"], "title": src["title"], "titleEs": src.get("titleEs", src["title"]),
        "license": src["spdx"], "source": note or url, "attribution": src.get("attribution", ""),
        "width": WORKING, "height": WORKING, "kind": "real", "spdx": src["spdx"], "source_url": url,
        "sha256": verdict.sha256, "family_hints": src.get("family_hints", []), "has_hires": True,
        "generator": None, "added": "2026-07-18",
    }
    lock = {"id": src["id"], "resolved_url": url, "provider_note": note, "spdx": src["spdx"],
            "sha256": verdict.sha256, "flags": verdict.flags}
    return entry, lock


def fetch_all(out_dir: Path, sources: Path = DEFAULT_SOURCES) -> list[dict]:
    srcs = yaml.safe_load(sources.read_text(encoding="utf-8"))["sources"]
    entries, locks, failed = [], [], []
    for src in srcs:
        try:
            e, lk = fetch_one(src, out_dir)
            entries.append(e)
            locks.append(lk)
            print(f"ok   {src['id']:<18} {e['spdx']}")
        except Exception as exc:
            failed.append({"id": src["id"], "error": str(exc)})
            print(f"FAIL {src['id']:<18} {exc}")
    (out_dir / "sources.lock.json").write_text(json.dumps({"locks": locks, "failed": failed}, indent=2), encoding="utf-8")
    print(f"\n{len(entries)} fetched, {len(failed)} failed. lock written.")
    return entries


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    ap.add_argument("--out", type=Path, default=Path("data/images"))
    args = ap.parse_args()
    fetch_all(args.out, args.sources)


if __name__ == "__main__":
    main()
