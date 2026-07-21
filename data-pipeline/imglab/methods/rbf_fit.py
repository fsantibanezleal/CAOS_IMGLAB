"""Fit each image as a radial-basis-function equation: a linear combination of fixed thin-plate radial kernels
on a regular grid of centers, plus an affine term,

    ch(x, y) = a0 + a1 x + a2 y + sum_i w_i,ch * phi(||(x,y) - c_i||),   phi(r) = r^2 log r,   x,y in [-1,1].

Unlike the Gaussian-mixture tab (free anisotropic bumps found by gradient descent), here the centers and the
kernel shape are FIXED and only the linear weights are solved, in closed form by ridge-regularized least
squares. This is the classical smooth-interpolation equation (thin-plate spline, Bookstein 1989; the RBF idea
originates with Hardy's multiquadrics, 1971): every image is written as one weighted sum of the same radial
function centered on a lattice. Rendered live per pixel.

    python -m imglab.methods.rbf_fit                 # all images
    python -m imglab.methods.rbf_fit --ids photo_parrots

Env: IMGLAB_RBF_GRID (default 15, so 225 centers), IMGLAB_RBF_RIDGE (default 1e-3).
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
OUT = ROOT / "data" / "derived" / "_rbf"
SIZE = 96
GRID = int(os.environ.get("IMGLAB_RBF_GRID", "15"))
RIDGE = float(os.environ.get("IMGLAB_RBF_RIDGE", "1e-3"))


def _phi(r2: np.ndarray) -> np.ndarray:
    """Thin-plate kernel phi(r) = r^2 log r = 0.5 r^2 log(r^2), with phi(0) = 0."""
    out = np.zeros_like(r2)
    m = r2 > 1e-12
    out[m] = 0.5 * r2[m] * np.log(r2[m])
    return out


def fit_one(img: np.ndarray):
    h = w = SIZE
    lin = np.linspace(-1, 1, SIZE)
    yy, xx = np.meshgrid(lin, lin, indexing="ij")
    P = np.stack([xx.ravel(), yy.ravel()], axis=1)  # (M,2)
    g = np.linspace(-0.92, 0.92, GRID)
    cy, cx = np.meshgrid(g, g, indexing="ij")
    C = np.stack([cx.ravel(), cy.ravel()], axis=1)  # (K,2)
    K = C.shape[0]
    # design matrix: [phi(||P-C||), 1, x, y]
    r2 = ((P[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)  # (M,K)
    Phi = np.concatenate([_phi(r2), np.ones((P.shape[0], 1)), P], axis=1)  # (M, K+3)
    target = img.reshape(-1, 3).astype(np.float64)
    A = Phi.T @ Phi + RIDGE * np.eye(Phi.shape[1])
    B = Phi.T @ target
    coef = np.linalg.solve(A, B)  # (K+3, 3)
    recon = np.clip(Phi @ coef, 0, 1)
    mse = float(((recon - target) ** 2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0
    weights = coef[:K]  # (K,3)
    affine = coef[K:]  # (3,3): rows [a0, a1(x), a2(y)]
    doc = {
        "size": SIZE,
        "grid": GRID,
        "centers": [round(float(v), 4) for v in C.ravel()],  # K*2
        "weights": [round(float(v), 5) for v in weights.T.ravel()],  # channel-major 3*K
        "affine": [round(float(v), 5) for v in affine.T.ravel()],  # channel-major 3*3 (a0,a1,a2 per ch)
        "psnr": round(float(psnr), 2),
    }
    return doc, psnr


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
        img = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        t0 = time.time()
        doc, psnr = fit_one(img)
        (OUT / f"{img_id}.json").write_text(json.dumps(doc), encoding="utf-8")
        done.append(img_id)
        print(f"  {img_id:<24} {GRID * GRID} centers  PSNR {psnr:5.2f} dB  {time.time() - t0:5.1f}s")
    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    ip.write_text(json.dumps({"fitted": fitted, "size": SIZE, "grid": GRID}), encoding="utf-8")
    print(f"fitted {len(done)} images; {len(fitted)} total")


if __name__ == "__main__":
    main()
