"""Greedy geometric-primitive approximation of an image: iteratively add the translucent ellipse that most
reduces the reconstruction error (random-restart hill climbing over geometry, with the error-optimal colour
solved in closed form). This is the EvoLisa / primitive.lol approach; it bakes an ordered shape list per
image so the live tab can render the first K shapes and show the image build up shape by shape (the cleanest
semantic-local representation: each shape is an independent, meaningful, local coordinate).

    python -m imglab.methods.primitives_fit
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_prim"
SIZE = 128
N_SHAPES = 90
RESTARTS = 12
STEPS = 40
ALPHA = 0.5
SEED = 0

SUBSET = ["synthetic-polygons", "mathart-rose", "photo_parrots", "art_greatwave", "mathart-julia", "astro_pillars"]


def _ellipse_mask(cx, cy, rx, ry, ang, size):
    ys, xs = np.mgrid[0:size, 0:size]
    ca, sa = np.cos(ang), np.sin(ang)
    dx = xs - cx
    dy = ys - cy
    xr = dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    return (xr * xr) / (rx * rx + 1e-6) + (yr * yr) / (ry * ry + 1e-6) <= 1.0


def _optimal_color_and_gain(target, current, mask, alpha):
    """Closed-form best colour for a shape at fixed alpha, and the resulting SSE reduction over the mask."""
    if mask.sum() < 3:
        return None, -1.0
    tgt = target[mask]  # (m,3)
    cur = current[mask]
    # blended = cur*(1-a) + c*a ; minimize ||blended - tgt||^2 over c => c = (tgt - cur*(1-a)) / a, averaged
    c = ((tgt - cur * (1 - alpha)) / alpha).mean(axis=0)
    c = np.clip(c, 0, 1)
    blended = cur * (1 - alpha) + c * alpha
    before = ((cur - tgt) ** 2).sum()
    after = ((blended - tgt) ** 2).sum()
    return c, before - after


def _fit_one(target, rng):
    size = target.shape[0]
    bg = target.reshape(-1, 3).mean(axis=0)
    current = np.tile(bg, (size, size, 1)).astype(np.float32)
    shapes = [{"type": "bg", "color": [round(float(v), 4) for v in bg]}]
    for _ in range(N_SHAPES):
        best = None
        best_gain = 1e-6
        for _r in range(RESTARTS):
            cx, cy = rng.uniform(0, size, 2)
            rx, ry = rng.uniform(3, size / 3, 2)
            ang = rng.uniform(0, np.pi)
            mask = _ellipse_mask(cx, cy, rx, ry, ang, size)
            col, gain = _optimal_color_and_gain(target, current, mask, ALPHA)
            cand = (cx, cy, rx, ry, ang, col, gain, mask)
            for _s in range(STEPS):
                ncx = np.clip(cx + rng.normal(0, size / 16), 0, size)
                ncy = np.clip(cy + rng.normal(0, size / 16), 0, size)
                nrx = np.clip(rx + rng.normal(0, size / 16), 2, size / 2)
                nry = np.clip(ry + rng.normal(0, size / 16), 2, size / 2)
                nang = ang + rng.normal(0, 0.3)
                nmask = _ellipse_mask(ncx, ncy, nrx, nry, nang, size)
                ncol, ngain = _optimal_color_and_gain(target, current, nmask, ALPHA)
                if ngain > cand[6]:
                    cx, cy, rx, ry, ang = ncx, ncy, nrx, nry, nang
                    cand = (ncx, ncy, nrx, nry, nang, ncol, ngain, nmask)
            if cand[6] > best_gain:
                best_gain = cand[6]
                best = cand
        if best is None:
            break
        cx, cy, rx, ry, ang, col, _gain, mask = best
        current[mask] = current[mask] * (1 - ALPHA) + col * ALPHA
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
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name] if args.all else SUBSET
    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        rng = np.random.default_rng(SEED)
        target = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        shapes, psnr = _fit_one(target, rng)
        (OUT / f"{img_id}.json").write_text(json.dumps({"size": SIZE, "shapes": shapes, "psnr": round(psnr, 2)}), encoding="utf-8")
        done.append(img_id)
        print(f"  {img_id:<22} {len(shapes) - 1} shapes, PSNR {psnr:5.2f} dB -> {(OUT / f'{img_id}.json').stat().st_size // 1024} KB")
    (OUT / "index.json").write_text(json.dumps({"fitted": done, "size": SIZE}), encoding="utf-8")
    print(f"fitted {len(done)} images")


if __name__ == "__main__":
    main()
