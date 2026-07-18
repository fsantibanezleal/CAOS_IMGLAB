"""Fit each curated image as an explicit closed-form trigonometric equation, the honest "image as a complex
formula" (Naderi-Yeganeh-style formula art, learned instead of hand-authored). We use random Fourier features
(Rahimi-Recht / Tancik): draw D random 2D frequencies, and fit the per-channel coefficients of

    channel(x, y) = a0 + sum_{k=1..D} [ a_k cos(omega_k . (x, y)) + b_k sin(omega_k . (x, y)) ]

by ridge regression. The result is a genuine closed-form expression (thousands of trig terms) that
reconstructs the selected image, distinct from the fixed-basis transforms (the frequencies are random,
not a grid) and from the SIREN neural field (this is linear in known analytic basis functions, so it can be
written down as an equation). Perturbing the coefficients in the live tab morphs the image smoothly.

    python -m imglab.methods.symbolic_fit            # all images
    python -m imglab.methods.symbolic_fit --ids mathart-rose photo_parrots

Env: IMGLAB_SYM_D (number of frequencies, default 512), IMGLAB_SYM_SIGMA (frequency spread, default 7.0).
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_sym"
SIZE = 96  # the equation is evaluated per pixel live; keep the fit resolution modest
D = int(os.environ.get("IMGLAB_SYM_D", "512"))
SIGMA = float(os.environ.get("IMGLAB_SYM_SIGMA", "7.0"))
RIDGE = 1e-2
SEED = 0


def fit_one(img: np.ndarray) -> tuple[dict, float]:
    h = w = SIZE
    lin = np.linspace(-1, 1, SIZE, dtype=np.float64)
    yy, xx = np.meshgrid(lin, lin, indexing="ij")
    p = np.stack([xx.ravel(), yy.ravel()], axis=1)  # (N,2)
    rng = np.random.default_rng(SEED)
    omega = rng.normal(0.0, SIGMA, size=(D, 2))  # random frequencies (cycles over [-1,1] * pi)
    proj = p @ omega.T  # (N, D)
    # design matrix: [1, cos(proj), sin(proj)]  -> (N, 1 + 2D)
    Phi = np.concatenate([np.ones((p.shape[0], 1)), np.cos(proj), np.sin(proj)], axis=1)
    target = img.reshape(-1, 3).astype(np.float64)  # (N,3)
    # ridge normal equations, shared design across channels
    A = Phi.T @ Phi + RIDGE * np.eye(Phi.shape[1])
    B = Phi.T @ target
    coef = np.linalg.solve(A, B)  # (1+2D, 3)
    recon = np.clip(Phi @ coef, 0, 1)
    mse = float(((recon - target) ** 2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0
    bias = coef[0]  # (3,)
    ac = coef[1 : 1 + D]  # (D,3) cosine coeffs
    bc = coef[1 + D : 1 + 2 * D]  # (D,3) sine coeffs

    def r(a):
        return [round(float(v), 5) for v in np.asarray(a).ravel()]

    doc = {
        "size": SIZE,
        "d": D,
        "sigma": SIGMA,
        "omega": r(omega),  # D*2, row-major (fx,fy)
        "bias": r(bias),  # 3
        "acos": r(ac.T),  # 3*D (channel-major: r all D, g all D, b all D)
        "bsin": r(bc.T),  # 3*D
        "psnr": round(float(psnr), 2),
    }
    return doc, psnr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    all_ids = [pp.stem for pp in sorted(IMAGES.glob("*.png")) if ".hi." not in pp.name]
    ids = args.ids if args.ids else all_ids
    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        img = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        doc, psnr = fit_one(img)
        (OUT / f"{img_id}.json").write_text(json.dumps(doc), encoding="utf-8")
        done.append(img_id)
        kb = (OUT / f"{img_id}.json").stat().st_size // 1024
        print(f"  {img_id:<24} PSNR {psnr:5.2f} dB  {D} terms  {kb} KB")
    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    ip.write_text(json.dumps({"fitted": fitted, "size": SIZE, "d": D}), encoding="utf-8")
    print(f"fitted {len(done)} images; {len(fitted)} total")


if __name__ == "__main__":
    main()
