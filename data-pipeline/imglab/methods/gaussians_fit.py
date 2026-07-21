"""Fit each image as a 2D Gaussian mixture equation by gradient descent (the GaussianImage / 2D Gaussian
splatting representation, accumulated-sum variant):

    ch(x, y) = sum_k c_k,ch * exp(-1/2 * q_k(x, y)),
    q_k = a_k dx^2 + 2 b_k dx dy + c_k dy^2,  (dx, dy) = (x, y) - mu_k

The precision (inverse covariance) of each Gaussian is parameterized by its Cholesky factor so q is always
positive semidefinite; colors are free. Optimized with Adam against L2 loss (Zhang et al. ECCV 2024,
GaussianImage; the 2D image counterpart of Kerbl et al. 2023 3D Gaussian splatting). The written equation is
a sum of colored anisotropic Gaussian bumps: every term has a legible position, shape and color.

    python -m imglab.methods.gaussians_fit                 # all images
    python -m imglab.methods.gaussians_fit --ids photo_parrots

Env: IMGLAB_GS_N (default 300), IMGLAB_GS_ITERS (1200). Uses CUDA when available, else CPU.
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
OUT = ROOT / "data" / "derived" / "_gsplat"
SIZE = 96
N_GAUSS = int(os.environ.get("IMGLAB_GS_N", "300"))
ITERS = int(os.environ.get("IMGLAB_GS_ITERS", "1200"))
SEED = 0


def fit_one(img: np.ndarray):
    import torch

    torch.manual_seed(SEED)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    h = w = SIZE
    lin = torch.linspace(-1, 1, SIZE, device=dev)
    yy, xx = torch.meshgrid(lin, lin, indexing="ij")
    P = torch.stack([xx.reshape(-1), yy.reshape(-1)], dim=1)  # (M,2)
    target = torch.from_numpy(img.reshape(-1, 3).astype(np.float32)).to(dev)

    g = torch.Generator().manual_seed(SEED)
    mu = (torch.rand(N_GAUSS, 2, generator=g) * 2 - 1).to(dev).requires_grad_(True)
    # log-diagonal Cholesky of the PRECISION matrix; init sigma ~ 8/96 of the field -> l ~ 1/sigma
    s0 = float(np.log(1.0 / 0.12))
    ls = (torch.ones(N_GAUSS, 2) * s0 + torch.randn(N_GAUSS, 2, generator=g) * 0.2).to(dev).requires_grad_(True)
    lo = torch.zeros(N_GAUSS, device=dev, requires_grad=True)  # off-diagonal
    # init colors by sampling the image at mu
    with torch.no_grad():
        ix = ((mu[:, 0] + 1) / 2 * (w - 1)).long().clamp(0, w - 1)
        iy = ((mu[:, 1] + 1) / 2 * (h - 1)).long().clamp(0, h - 1)
        cinit = target.reshape(h, w, 3)[iy, ix] - img.mean()
    col = cinit.clone().requires_grad_(True)
    bias = torch.tensor(img.reshape(-1, 3).mean(axis=0), dtype=torch.float32).to(dev).requires_grad_(True)

    opt = torch.optim.Adam([
        {"params": [mu], "lr": 2e-3},
        {"params": [ls, lo], "lr": 8e-3},
        {"params": [col, bias], "lr": 8e-3},
    ])

    def render():
        d = P[:, None, :] - mu[None, :, :]  # (M,N,2)
        l11 = torch.exp(ls[:, 0])
        l22 = torch.exp(ls[:, 1])
        # q = (l11 dx)^2 + (lo dx + l22 dy)^2  (Cholesky of precision)
        t1 = l11[None, :] * d[:, :, 0]
        t2 = lo[None, :] * d[:, :, 0] + l22[None, :] * d[:, :, 1]
        q = t1 * t1 + t2 * t2
        wgt = torch.exp(-0.5 * q)  # (M,N)
        return bias[None, :] + wgt @ col  # (M,3)

    for it in range(ITERS):
        opt.zero_grad()
        loss = ((render() - target) ** 2).mean()
        loss.backward()
        opt.step()

    with torch.no_grad():
        rec = render().clamp(0, 1)
        mse = float(((rec - target) ** 2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0

    with torch.no_grad():
        l11 = torch.exp(ls[:, 0])
        l22 = torch.exp(ls[:, 1])
        a = (l11 * l11 + lo * lo).cpu().numpy()
        b = (lo * l22).cpu().numpy()
        c = (l22 * l22).cpu().numpy()
        gs = []
        order = np.argsort(-np.abs(col.detach().cpu().numpy()).sum(axis=1))  # biggest color mass first
        for k in order:
            gs.append(
                {
                    "mx": round(float(mu[k, 0]), 4),
                    "my": round(float(mu[k, 1]), 4),
                    "a": round(float(a[k]), 4),
                    "b": round(float(b[k]), 4),
                    "c": round(float(c[k]), 4),
                    "col": [round(float(v), 4) for v in col[k]],
                }
            )
        doc = {"size": SIZE, "n": N_GAUSS, "bias": [round(float(v), 4) for v in bias], "gauss": gs, "psnr": round(psnr, 2)}
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
        print(f"  {img_id:<24} {N_GAUSS} gaussians  PSNR {psnr:5.2f} dB  {time.time() - t0:5.1f}s")
    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    ip.write_text(json.dumps({"fitted": fitted, "size": SIZE, "n": N_GAUSS}), encoding="utf-8")
    print(f"fitted {len(done)} images; {len(fitted)} total")


if __name__ == "__main__":
    main()
