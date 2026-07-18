"""Build the whole ImageLab curated set: run the procedural generators (offline, license-clean by
construction) then optionally fetch the licensed real-world subset (network), and merge into
data/images/index.json (schema imglab.imageset/v1).

    python -m imglab.imageset build              # generators + fetch (needs network)
    python -m imglab.imageset build --gen-only   # offline: the procedural images only
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from imglab.gen.synthetic import GENERATORS

ROOT = Path(__file__).resolve().parents[2]  # repo root (…/CAOS_IMGLAB)
IMAGES = ROOT / "data" / "images"
WORKING = 256
HIRES = 512


def _save(arr: np.ndarray, path: Path) -> None:
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB").save(path, optimize=True)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def generate() -> list[dict]:
    IMAGES.mkdir(parents=True, exist_ok=True)
    out: list[dict] = []
    for gid, g in GENERATORS.items():
        _save(g["fn"](WORKING, **g["params"]), IMAGES / f"{gid}.png")
        _save(g["fn"](HIRES, **g["params"]), IMAGES / f"{gid}.hi.png")
        sha = _sha(IMAGES / f"{gid}.png")
        out.append(
            {
                "id": gid,
                "category": g["category"],
                "title": g["title"],
                "titleEs": g["titleEs"],
                "license": "CC0-1.0",
                "source": f"ImageLab in-repo generator ({g['fn'].__name__})",
                "attribution": "ImageLab, CC0-1.0",
                "width": WORKING,
                "height": WORKING,
                "kind": g["kind"],
                "spdx": "CC0-1.0",
                "source_url": None,
                "sha256": sha,
                "family_hints": g["family_hints"],
                "has_hires": True,
                "generator": {"name": g["fn"].__name__, "params": g["params"]},
                "added": "2026-07-18",
            }
        )
        print(f"gen  {gid:<26} sha={sha[:12]}")
    return out


def write_index(entries: list[dict]) -> None:
    entries = sorted(entries, key=lambda e: (e["category"], e["id"]))
    idx = {"schema": "imglab.imageset/v1", "version": "0.1.0", "count": len(entries), "images": entries}
    (IMAGES / "index.json").write_text(json.dumps(idx, indent=2) + "\n", encoding="utf-8")
    print(f"index.json: {len(entries)} images ({sum(e['kind'] != 'real' for e in entries)} generated, "
          f"{sum(e['kind'] == 'real' for e in entries)} fetched)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build"])
    ap.add_argument("--gen-only", action="store_true")
    args = ap.parse_args()

    gen = generate()
    real: list[dict] = []
    if not args.gen_only:
        from imglab.stages.fetch_images import fetch_all

        real = fetch_all(IMAGES)
    write_index(gen + real)


if __name__ == "__main__":
    main()
