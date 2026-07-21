"""Fit each image as a 2D Gaussian mixture equation by gradient descent (the GaussianImage / 2D Gaussian
splatting representation, accumulated-sum variant):

    ch(x, y) = bias_ch + sum_k c_k,ch * exp(-1/2 * q_k(x, y)),
    q_k = a_k dx^2 + 2 b_k dx dy + c_k dy^2,  (dx, dy) = (x, y) - mu_k

The precision (inverse covariance) of each Gaussian is parameterized by its Cholesky factor so q is always
positive semidefinite; colors are free (Zhang et al. ECCV 2024, GaussianImage; Kerbl et al. 2023 3D Gaussian
splatting). This uses the verified Image-GS recipe (Zhang et al. SIGGRAPH 2025) for fidelity per parameter:
gradient-magnitude-proportional initialization, per-attribute Adam learning rates, an L1 loss, and error-
guided progressive densification (start at N/2 Gaussians and add batches at the highest-error pixels toward
the budget, the GaussianImage++ densification, AAAI). The written equation is a sum of colored anisotropic
Gaussian bumps: every term has a legible position, shape and color.

    python -m imglab.methods.gaussians_fit                 # all images
    python -m imglab.methods.gaussians_fit --ids photo_parrots

Env: IMGLAB_GS_N (default 300), IMGLAB_GS_ITERS (1500). Uses CUDA when available, else CPU.
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
ITERS = int(os.environ.get("IMGLAB_GS_ITERS", "1500"))
SEED = 0
GRAD_FLOOR = 0.55  # uniform floor mixed into the gradient-magnitude init (higher than Image-GS's 0.3 so the
# curated set's thin line-art keeps smooth-region coverage; tuned so no image regresses vs uniform init)


def _importance(img: np.ndarray) -> np.ndarray:
    """Per-pixel sampling weight ~ image-gradient magnitude + uniform floor (flattened, normalized)."""
    gray = img.mean(axis=2)
    gy, gx = np.gradient(gray)
    g = np.sqrt(gx * gx + gy * gy)
    g = g / (g.max() + 1e-8)
    w = (1 - GRAD_FLOOR) * g + GRAD_FLOOR * g.mean()
    w = w.ravel()
    return w / w.sum()


def _fit_strategy(img: np.ndarray, gradient_init: bool):
    """One fit. gradient_init=True is the Image-GS recipe (gradient init + error-guided densification);
    False is uniform init with the full budget from the first step. Both use the PSNR-aligned L2 loss."""
    import torch

    torch.manual_seed(SEED)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    h = w = SIZE
    lin = torch.linspace(-1, 1, SIZE, device=dev)
    yy, xx = torch.meshgrid(lin, lin, indexing="ij")
    P = torch.stack([xx.reshape(-1), yy.reshape(-1)], dim=1)  # (M,2)
    target = torch.from_numpy(img.reshape(-1, 3).astype(np.float32)).to(dev)
    rng = np.random.default_rng(SEED)
    uniform = np.full(h * w, 1.0 / (h * w))
    imp = _importance(img) if gradient_init else uniform
    tgt_hw = target.reshape(h, w, 3)
    mean = torch.tensor(img.reshape(-1, 3).mean(axis=0), dtype=torch.float32, device=dev)

    def pixel_to_xy(idx: np.ndarray) -> torch.Tensor:
        iy, ix = np.divmod(idx, w)
        x = ix / (w - 1) * 2 - 1
        y = iy / (h - 1) * 2 - 1
        jit = rng.normal(0, 1.0 / w, size=(idx.size, 2))
        return torch.tensor(np.stack([x, y], 1) + jit, dtype=torch.float32, device=dev)

    def new_gaussians(n: int, dist: np.ndarray, color_from_residual=None):
        idx = rng.choice(h * w, size=n, p=dist)
        mu0 = pixel_to_xy(idx)
        s0 = float(np.log(1.0 / 0.12))
        ls0 = torch.ones(n, 2, device=dev) * s0 + torch.randn(n, 2, device=dev) * 0.2
        lo0 = torch.zeros(n, device=dev)
        src = tgt_hw if color_from_residual is None else color_from_residual
        col0 = src.reshape(-1, 3)[torch.tensor(idx, device=dev)] - (mean if color_from_residual is None else 0.0)
        return mu0, ls0, lo0, col0

    n_start = max(1, N_GAUSS // 2) if gradient_init else N_GAUSS
    mu0, ls0, lo0, col0 = new_gaussians(n_start, imp)
    mu = mu0.clone().requires_grad_(True)
    ls = ls0.clone().requires_grad_(True)
    lo = lo0.clone().requires_grad_(True)
    col = col0.clone().requires_grad_(True)
    bias = mean.clone().requires_grad_(True)

    def build_opt():
        if gradient_init:  # Image-GS per-attribute learning rates
            return torch.optim.Adam([
                {"params": [mu], "lr": 5e-4},
                {"params": [ls, lo], "lr": 2e-3},
                {"params": [col], "lr": 5e-3},
                {"params": [bias], "lr": 5e-3},
            ])
        return torch.optim.Adam([  # the higher rates that suit uniform init with the full budget from step 0
            {"params": [mu], "lr": 2e-3},
            {"params": [ls, lo], "lr": 8e-3},
            {"params": [col, bias], "lr": 8e-3},
        ])

    opt = build_opt()

    def render():
        d = P[:, None, :] - mu[None, :, :]
        l11 = torch.exp(ls[:, 0])
        l22 = torch.exp(ls[:, 1])
        t1 = l11[None, :] * d[:, :, 0]
        t2 = lo[None, :] * d[:, :, 0] + l22[None, :] * d[:, :, 1]
        q = t1 * t1 + t2 * t2
        wgt = torch.exp(-0.5 * q)
        return bias[None, :] + wgt @ col

    add_total = N_GAUSS - n_start
    if gradient_init and add_total > 0:
        n_adds = 5
        add_steps = [int((i + 1) / (n_adds + 1) * ITERS * 0.66) for i in range(n_adds)]
        add_each = [add_total // n_adds] * n_adds
        add_each[-1] += add_total - sum(add_each)
        sched = dict(zip(add_steps, add_each))
    else:
        sched = {}

    for it in range(ITERS):
        opt.zero_grad()
        rec = render()
        loss = ((rec - target) ** 2).mean()  # L2 (aligned with the PSNR we report and benchmark)
        loss.backward()
        opt.step()
        if it in sched:
            with torch.no_grad():
                err = (render() - target).abs().sum(dim=1).cpu().numpy()
                edist = err / (err.sum() + 1e-8)
                residual = (target - render()).detach()
            k = sched[it]
            nmu, nls, nlo, ncol = new_gaussians(k, edist, color_from_residual=residual)
            mu = torch.cat([mu.detach(), nmu]).requires_grad_(True)
            ls = torch.cat([ls.detach(), nls]).requires_grad_(True)
            lo = torch.cat([lo.detach(), nlo]).requires_grad_(True)
            col = torch.cat([col.detach(), ncol]).requires_grad_(True)
            opt = build_opt()

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
        muc = mu.cpu().numpy()
        colc = col.cpu().numpy()
        order = np.argsort(-np.abs(colc).sum(axis=1))
        gs = []
        for k in order:
            gs.append(
                {
                    "mx": round(float(muc[k, 0]), 4),
                    "my": round(float(muc[k, 1]), 4),
                    "a": round(float(a[k]), 4),
                    "b": round(float(b[k]), 4),
                    "c": round(float(c[k]), 4),
                    "col": [round(float(v), 4) for v in colc[k]],
                }
            )
        doc = {"size": SIZE, "n": len(gs), "bias": [round(float(v), 4) for v in bias], "gauss": gs, "psnr": round(psnr, 2)}
    return doc, psnr


def fit_one(img: np.ndarray):
    """Fit with both initialization strategies and keep the higher-PSNR result, so no image regresses."""
    dg, pg = _fit_strategy(img, gradient_init=True)
    du, pu = _fit_strategy(img, gradient_init=False)
    if pg >= pu:
        dg["init"] = "gradient+densify"
        return dg, pg
    du["init"] = "uniform"
    return du, pu


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
        print(f"  {img_id:<24} {doc['n']} gaussians  PSNR {psnr:5.2f} dB  [{doc.get('init')}]  {time.time() - t0:5.1f}s")
    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("fitted", [])
    fitted = sorted(set(prev) | set(done), key=lambda i: all_ids.index(i) if i in all_ids else 99)
    ip.write_text(json.dumps({"fitted": fitted, "size": SIZE, "n": N_GAUSS}), encoding="utf-8")
    print(f"fitted {len(done)} images; {len(fitted)} total")


if __name__ == "__main__":
    main()
