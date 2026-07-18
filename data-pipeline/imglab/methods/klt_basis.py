"""Bake the KLT (PCA) patch eigenbasis from the curated set: PCA over 8x8 luma patches gives the
data-adaptive orthonormal basis the KLT tab projects onto (data/derived/_klt/patch.json). The KLT uniquely
decorrelates and maximizes energy compaction, at the cost of being data-dependent (no universal fast
transform), which is exactly the teaching point of the tab. CPU, a few seconds.

    python -m imglab.methods.klt_basis
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_klt"
PATCH = 8
K = 64
STRIDE = 4


def _luma(im: np.ndarray) -> np.ndarray:
    return 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]


def _patches(g: np.ndarray) -> np.ndarray:
    h, w = g.shape
    out = []
    for y in range(0, h - PATCH + 1, STRIDE):
        for x in range(0, w - PATCH + 1, STRIDE):
            out.append(g[y : y + PATCH, x : x + PATCH].ravel())
    return np.asarray(out, dtype=np.float32)


def main() -> None:
    rows = []
    n_images = 0
    for f in sorted(IMAGES.glob("*.png")):
        if ".hi." in f.name:
            continue
        im = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255.0
        rows.append(_patches(_luma(im)))
        n_images += 1
    x = np.concatenate(rows, axis=0)
    pca = PCA(n_components=K, svd_solver="full").fit(x)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "patch.json").write_text(
        json.dumps(
            {
                "patch": PATCH,
                "K": K,
                "mean": [round(float(v), 6) for v in pca.mean_],
                "components": [[round(float(v), 6) for v in row] for row in pca.components_],
                "eigenvalues": [round(float(v), 8) for v in pca.explained_variance_],
                "cumulativeVar": [round(float(v), 6) for v in np.cumsum(pca.explained_variance_ratio_)],
            }
        ),
        encoding="utf-8",
    )
    manifest = {
        "imageId": "_klt",
        "method": "klt",
        "params": {"patch": PATCH, "K": K, "stride": STRIDE, "images": n_images, "patches": int(x.shape[0])},
        "seed": 0,
        "lane": "live",
        "bytes": (OUT / "patch.json").stat().st_size,
        "runMs": 0,
        "format": "imglab.klt/v1",
        "version": "0.1.0",
    }
    (ROOT / "data" / "derived" / "manifests").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "derived" / "manifests" / "_klt__klt.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"KLT eigenbasis baked from {n_images} images, {x.shape[0]} patches -> {OUT/'patch.json'} "
          f"({manifest['bytes'] // 1024} KB); top eigenvalue {pca.explained_variance_[0]:.4f}, "
          f"cum var@16 {np.cumsum(pca.explained_variance_ratio_)[15]:.3f}")


if __name__ == "__main__":
    main()
