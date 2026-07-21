"""Fit each image as a sum of 2D Gabor atoms by greedy matching pursuit: localized wave packets, each a
Gaussian envelope times an oriented cosine,

    g_k(x, y) = exp(-(u^2 / (2 sx^2) + v^2 / (2 sy^2))) * cos(om * u + phase),   (u, v) = R_theta (p - mu)

with per-channel amplitude and phase solved in closed form on the quadrature pair (envelope*cos, envelope*sin)
inside a 3-sigma bounding box (Mallat-Zhang matching pursuit with a Gabor dictionary; Gabor 1946; Daugman
1985). The written equation is a sum of products of exponentials and cosines: strictly richer structure than
the global trig fit, and every term is a legible, localized object (position, orientation, frequency, width).

    python -m imglab.methods.gabor_fit                 # all images
    python -m imglab.methods.gabor_fit --ids photo_parrots

Env: IMGLAB_GABOR_ATOMS (default 250), IMGLAB_GABOR_RESTARTS (8), IMGLAB_GABOR_STEPS (20).
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
OUT = ROOT / "data" / "derived" / "_gabor"
SIZE = 96
N_ATOMS = int(os.environ.get("IMGLAB_GABOR_ATOMS", "250"))
RESTARTS = int(os.environ.get("IMGLAB_GABOR_RESTARTS", "8"))
STEPS = int(os.environ.get("IMGLAB_GABOR_STEPS", "20"))
SEED = 0
MIN_S = 1.2


def _atom_pair(cx, cy, sx, sy, th, om, size):
    """The quadrature pair (E*cos(om*u), E*sin(om*u)) inside a 3-sigma bbox. Returns (u_img, v_img, bbox)."""
    r = 3.0 * max(sx, sy) + 1.0
    x0 = max(0, int(cx - r))
    x1 = min(size, int(cx + r) + 1)
    y0 = max(0, int(cy - r))
    y1 = min(size, int(cy + r) + 1)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    ys, xs = np.mgrid[y0:y1, x0:x1]
    dx = xs - cx
    dy = ys - cy
    ca, sa = np.cos(th), np.sin(th)
    u = dx * ca + dy * sa
    v = -dx * sa + dy * ca
    env = np.exp(-(u * u) / (2 * sx * sx) - (v * v) / (2 * sy * sy))
    return env * np.cos(om * u), env * np.sin(om * u), (x0, x1, y0, y1)


def _eval(res, cx, cy, sx, sy, th, om, size):
    """Closed-form per-channel (a, b) on the quadrature pair; returns (gain, coeffs, pair, bbox)."""
    pair = _atom_pair(cx, cy, sx, sy, th, om, size)
    if pair is None:
        return None
    U, V, (x0, x1, y0, y1) = pair
    uu = float((U * U).sum())
    vv = float((V * V).sum())
    uv = float((U * V).sum())
    det = uu * vv - uv * uv
    if det < 1e-9 or uu < 1e-9:
        return None
    gain = 0.0
    coeffs = []
    for c in range(3):
        r = res[y0:y1, x0:x1, c]
        ru = float((r * U).sum())
        rv = float((r * V).sum())
        a = (ru * vv - rv * uv) / det
        b = (rv * uu - ru * uv) / det
        gain += a * ru + b * rv  # SSE reduction of the LSQ projection
        coeffs.append((a, b))
    return gain, coeffs, (U, V), (x0, x1, y0, y1)


def _fit_one(target, rng):
    size = target.shape[0]
    mean = target.reshape(-1, 3).mean(axis=0)
    res = target - mean  # residual after the DC term
    atoms = []
    for _ in range(N_ATOMS):
        best = None
        for _r in range(RESTARTS):
            cx, cy = rng.uniform(0, size, 2)
            sx, sy = rng.uniform(MIN_S, size / 4, 2)
            th = rng.uniform(0, np.pi)
            om = rng.uniform(0.0, 1.8)  # radians per pixel along u (0 = pure Gaussian blob)
            cand = _eval(res, cx, cy, sx, sy, th, om, size)
            state = (cx, cy, sx, sy, th, om)
            for _s in range(STEPS):
                ncx = float(np.clip(state[0] + rng.normal(0, size / 20), 0, size))
                ncy = float(np.clip(state[1] + rng.normal(0, size / 20), 0, size))
                nsx = float(np.clip(state[2] * np.exp(rng.normal(0, 0.25)), MIN_S, size / 2))
                nsy = float(np.clip(state[3] * np.exp(rng.normal(0, 0.25)), MIN_S, size / 2))
                nth = float(state[4] + rng.normal(0, 0.25))
                nom = float(np.clip(state[5] + rng.normal(0, 0.15), 0.0, 2.5))
                ncand = _eval(res, ncx, ncy, nsx, nsy, nth, nom, size)
                if ncand is not None and (cand is None or ncand[0] > cand[0]):
                    cand = ncand
                    state = (ncx, ncy, nsx, nsy, nth, nom)
            if cand is not None and (best is None or cand[0] > best[0][0]):
                best = (cand, state)
        if best is None or best[0][0] <= 1e-9:
            break
        (gain, coeffs, (U, V), (x0, x1, y0, y1)), (cx, cy, sx, sy, th, om) = best
        for c in range(3):
            a, b = coeffs[c]
            res[y0:y1, x0:x1, c] -= a * U + b * V
        # a*cos + b*sin = A*cos(arg - phi), A = hypot(a,b), phi = atan2(b, a)
        amp = [round(float(np.hypot(a, b)), 5) for a, b in coeffs]
        ph = [round(float(np.arctan2(b, a)), 4) for a, b in coeffs]
        atoms.append(
            {
                "cx": round(float(cx), 2),
                "cy": round(float(cy), 2),
                "sx": round(float(sx), 3),
                "sy": round(float(sy), 3),
                "th": round(float(th), 4),
                "om": round(float(om), 4),
                "amp": amp,
                "ph": ph,
            }
        )
    mse = float((res**2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0
    return {"size": SIZE, "mean": [round(float(v), 5) for v in mean], "atoms": atoms}, psnr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    all_ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name]
    ids = args.ids if args.ids else all_ids
    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        rng = np.random.default_rng(SEED)
        target = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        t0 = time.time()
        doc, psnr = _fit_one(target, rng)
        doc["psnr"] = round(psnr, 2)
        (OUT / f"{img_id}.json").write_text(json.dumps(doc), encoding="utf-8")
        done.append(img_id)
        print(f"  {img_id:<24} {len(doc['atoms']):>4} atoms  PSNR {psnr:5.2f} dB  {time.time() - t0:5.1f}s")
    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    ip.write_text(json.dumps({"fitted": fitted, "size": SIZE, "atoms": N_ATOMS}), encoding="utf-8")
    print(f"fitted {len(done)} images; {len(fitted)} total")


if __name__ == "__main__":
    main()
