"""Build the procedural portion of the curated image set: render each generator at the working (256) and
hi-res (512) sizes, write PNGs to data/images/, and upsert their entries into data/images/index.json.

The licensed-download portion (photo, art, biological, microscopy, astronomy, texture) is added to the same
index by the fetch stage. Run:  python -m imglab.gen.build_images
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from imglab.gen.synthetic import GENERATORS

ROOT = Path(__file__).resolve().parents[3]  # repo root (…/CAOS_IMGLAB)
IMAGES = ROOT / "data" / "images"
WORKING = 256
HIRES = 512


def _save(arr: np.ndarray, path: Path) -> None:
    u8 = np.clip(arr, 0, 1) * 255.0
    Image.fromarray(u8.astype(np.uint8), "RGB").save(path)


def load_index() -> list[dict]:
    idx = IMAGES / "index.json"
    if idx.exists():
        return json.loads(idx.read_text(encoding="utf-8"))
    return []


def save_index(entries: list[dict]) -> None:
    (IMAGES / "index.json").write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    entries = {e["id"]: e for e in load_index()}
    for img_id, (gen, category, title, title_es, illustrates) in GENERATORS.items():
        work = gen(WORKING)
        hi = gen(HIRES)
        _save(work, IMAGES / f"{img_id}.png")
        _save(hi, IMAGES / f"{img_id}.hi.png")
        entries[img_id] = {
            "id": img_id,
            "category": category,
            "title": title,
            "titleEs": title_es,
            "license": "MIT",
            "source": "ImageLab (procedural)",
            "attribution": "Procedurally generated in-repo, ImageLab (MIT)",
            "sourceUrl": "",
            "width": WORKING,
            "height": WORKING,
            "illustrates": illustrates,
        }
        print(f"[build_images] {img_id}: {title} ({category}) -> {img_id}.png + .hi.png")
    ordered = sorted(entries.values(), key=lambda e: (e["category"], e["id"]))
    save_index(ordered)
    print(f"[build_images] index.json now has {len(ordered)} entries")


if __name__ == "__main__":
    main()
