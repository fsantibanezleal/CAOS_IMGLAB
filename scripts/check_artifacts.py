"""Validate the artifact contract on disk (the pipeline -> web contract): every committed derived index
references files that exist and are non-empty, and no artifact under data/derived/ is empty. Stdlib only,
runs in CI without installing the package. Exit non-zero on any drift.

Guards against the regression where a bake half-writes an index (or a frame is dropped) and the SPA then
fetches a 404 or a zero-byte file at runtime. Each representation writes its own compact index; this checks
the reference integrity of all of them."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"


def _group_present(group: str) -> bool:
    """A representation group is validated only when its directory is committed in this build."""
    return (DERIVED / group).is_dir()


def _load(rel: str, errs: list[str]):
    p = DERIVED / rel
    if not p.exists():
        errs.append(f"missing index: {rel}")
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errs.append(f"bad JSON in {rel}: {e}")
        return None


def _need(rel: str, errs: list[str]) -> None:
    p = DERIVED / rel
    if not p.exists():
        errs.append(f"missing artifact: {rel}")
    elif p.stat().st_size == 0:
        errs.append(f"empty artifact: {rel}")


def main() -> int:
    if not DERIVED.exists():
        print(f"FAIL: missing {DERIVED} (run scripts/precompute.sh first)")
        return 1
    errs: list[str] = []

    # 1) no empty file anywhere under data/derived/
    n_files = 0
    for f in DERIVED.rglob("*"):
        if f.is_file() and f.name != ".gitkeep":
            n_files += 1
            if f.stat().st_size == 0:
                errs.append(f"empty file: {f.relative_to(DERIVED)}")

    # 2) direct (index-less) artifacts
    for group, files in (("_klt", ("patch.json",)), ("_dict", ("learned.json", "overdct.json"))):
        if not _group_present(group):
            continue
        for name in files:
            _need(f"{group}/{name}", errs)
            _load(f"{group}/{name}", errs)

    # 3) per-image list artifacts (INR weights, primitive fits, symbolic equations)
    for group, key in (("_inr", "trained"), ("_prim", "fitted"), ("_sym", "fitted")):
        if not _group_present(group):
            continue
        idx = _load(f"{group}/index.json", errs)
        for img_id in (idx or {}).get(key, []):
            _need(f"{group}/{img_id}.json", errs)

    # 4) frame-strip artifacts (VAE latent walks, diffusion strips)
    for group, key in (("_vae", "walks"), ("_diff", "strips")):
        if not _group_present(group):
            continue
        idx = _load(f"{group}/index.json", errs)
        for item in (idx or {}).get(key, []):
            for i in range(item.get("frames", 0)):
                _need(f"{group}/{item['id']}/{i:02d}.png", errs)

    if errs:
        print("ARTIFACT CONTRACT DRIFT:")
        for e in errs:
            print("  -", e)
        return 1
    print(f"artifact contract OK: {n_files} derived files, every index references existing non-empty artifacts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
