"""Greedy geometric-primitive approximation of an image: iteratively add the translucent ellipse that most
reduces the reconstruction error (random-restart hill climbing over geometry, with the error-optimal colour
solved in closed form). This is the EvoLisa / primitive.lol approach; it bakes an ordered shape list per
image so the live tab can render the first K shapes and show the image build up shape by shape (the cleanest
semantic-local representation: each shape is an independent, meaningful, local coordinate).

The whole curated set is fitted (no subset), to a deep 1200-ellipse stack. The inner search evaluates each
candidate ellipse only inside its bounding box, so a 1200-shape fit over 18 images stays tractable in pure
numpy.

    python -m imglab.methods.primitives_fit           # all images (default)
    python -m imglab.methods.primitives_fit --ids photo_parrots astro_pillars   # a few, for iteration

Env overrides for tuning: IMGLAB_PRIM_SHAPES (default 1200), IMGLAB_PRIM_RESTARTS (10), IMGLAB_PRIM_STEPS (24).
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_prim"
SIZE = 128
N_SHAPES = int(os.environ.get("IMGLAB_PRIM_SHAPES", "1200"))
RESTARTS = int(os.environ.get("IMGLAB_PRIM_RESTARTS", "10"))
STEPS = int(os.environ.get("IMGLAB_PRIM_STEPS", "24"))
ALPHA = 0.5
SEED = 0
MIN_R = 1.2


def _eval(target, current, cx, cy, rx, ry, ang, size):
    """Evaluate a candidate ellipse inside its bounding box: return (geom, colour, gain, bbox, local mask)."""
    r = max(rx, ry) + 1.0
    x0 = max(0, int(cx - r))
    x1 = min(size, int(cx + r) + 1)
    y0 = max(0, int(cy - r))
    y1 = min(size, int(cy + r) + 1)
    if x1 - x0 < 1 or y1 - y0 < 1:
        return None
    ys, xs = np.mgrid[y0:y1, x0:x1]
    ca, sa = np.cos(ang), np.sin(ang)
    dx = xs - cx
    dy = ys - cy
    xr = dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    mask = (xr * xr) / (rx * rx + 1e-6) + (yr * yr) / (ry * ry + 1e-6) <= 1.0
    if int(mask.sum()) < 3:
        return None
    tgt = target[y0:y1, x0:x1][mask]
    cur = current[y0:y1, x0:x1][mask]
    col = np.clip(((tgt - cur * (1 - ALPHA)) / ALPHA).mean(axis=0), 0.0, 1.0)
    blended = cur * (1 - ALPHA) + col * ALPHA
    gain = float(((cur - tgt) ** 2).sum() - ((blended - tgt) ** 2).sum())
    return (cx, cy, rx, ry, ang, col, gain, (x0, x1, y0, y1), mask)


def _fit_one(target, rng):
    size = target.shape[0]
    bg = target.reshape(-1, 3).mean(axis=0)
    current = np.tile(bg, (size, size, 1)).astype(np.float32)
    shapes = [{"type": "bg", "color": [round(float(v), 4) for v in bg]}]
    for _ in range(N_SHAPES):
        best = None
        for _r in range(RESTARTS):
            cx, cy = rng.uniform(0, size, 2)
            rx, ry = rng.uniform(MIN_R, size / 3, 2)
            ang = rng.uniform(0, np.pi)
            cand = _eval(target, current, cx, cy, rx, ry, ang, size)
            for _s in range(STEPS):
                ncx = float(np.clip(cx + rng.normal(0, size / 16), 0, size))
                ncy = float(np.clip(cy + rng.normal(0, size / 16), 0, size))
                nrx = float(np.clip(rx + rng.normal(0, size / 16), MIN_R, size / 2))
                nry = float(np.clip(ry + rng.normal(0, size / 16), MIN_R, size / 2))
                nang = float(ang + rng.normal(0, 0.3))
                ncand = _eval(target, current, ncx, ncy, nrx, nry, nang, size)
                if ncand is not None and (cand is None or ncand[6] > cand[6]):
                    cx, cy, rx, ry, ang = ncx, ncy, nrx, nry, nang
                    cand = ncand
            if cand is not None and (best is None or cand[6] > best[6]):
                best = cand
        if best is None or best[6] <= 1e-9:
            break  # converged: no ellipse reduces the error any further
        cx, cy, rx, ry, ang, col, _g, (x0, x1, y0, y1), mask = best
        region = current[y0:y1, x0:x1]
        region[mask] = region[mask] * (1 - ALPHA) + col * ALPHA
        shapes.append(
            {
                "type": "ellipse",
                "cx": round(float(cx), 2),
                "cy": round(float(cy), 2),
                "rx": round(float(rx), 2),
                "ry": round(float(ry), 2),
                "ang": round(float(ang), 4),
                "color": [round(float(v), 4) for v in col],
                "alpha": ALPHA,
            }
        )
    mse = float(((current - target) ** 2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0
    return shapes, psnr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None, help="fit only these image ids (default: all)")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    all_ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name]
    ids = args.ids if args.ids else all_ids
    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            print(f"  skip (missing): {img_id}")
            continue
        rng = np.random.default_rng(SEED)
        target = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        t0 = time.time()
        shapes, psnr = _fit_one(target, rng)
        (OUT / f"{img_id}.json").write_text(json.dumps({"size": SIZE, "shapes": shapes, "psnr": round(psnr, 2)}), encoding="utf-8")
        done.append(img_id)
        kb = (OUT / f"{img_id}.json").stat().st_size // 1024
        print(f"  {img_id:<24} {len(shapes) - 1:>4} shapes  PSNR {psnr:5.2f} dB  {kb:>3} KB  {time.time() - t0:5.1f}s")
    # keep the index sorted + complete; do not drop images that were baked in a previous partial run
    prev = []
    idx_path = OUT / "index.json"
    if idx_path.exists():
        prev = json.loads(idx_path.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    idx_path.write_text(json.dumps({"fitted": fitted, "size": SIZE, "shapes": N_SHAPES}), encoding="utf-8")
    print(f"fitted {len(done)} images this run; {len(fitted)} total in index")


if __name__ == "__main__":
    main()
