"""Bake overcomplete dictionaries for the frames tab: a LEARNED dictionary (sklearn dictionary learning over
8x8 luma patches of the curated set) and an analytic OVERCOMPLETE-DCT dictionary. The tab sparse-codes the
selected image against a chosen dictionary live (OMP), so the point (the same image in a different, redundant
alphabet, more atoms than dimensions) is visible. Atoms are unit-norm; patches are coded mean-subtracted.

    python -m imglab.methods.dictionaries
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.decomposition import MiniBatchDictionaryLearning

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_dict"
PATCH = 8
N_ATOMS = 144  # overcomplete: 144 > 64 = patch*patch
STRIDE = 4
SEED = 0


def _luma(im: np.ndarray) -> np.ndarray:
    return 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]


def _patches(g: np.ndarray) -> np.ndarray:
    h, w = g.shape
    out = []
    for y in range(0, h - PATCH + 1, STRIDE):
        for x in range(0, w - PATCH + 1, STRIDE):
            out.append(g[y : y + PATCH, x : x + PATCH].ravel())
    return np.asarray(out, dtype=np.float64)


def overcomplete_dct(p: int = PATCH, k: int = 12) -> np.ndarray:
    """k>p frequencies per axis gives a redundant (overcomplete) separable 2D cosine dictionary."""
    b = np.array([[np.cos(np.pi * (2 * n + 1) * f / (2 * k)) for n in range(p)] for f in range(k)])
    b -= b.mean(axis=1, keepdims=True)  # remove DC so atoms code the mean-subtracted patch
    b[0] = 1.0  # keep one constant atom for the DC direction
    b /= np.linalg.norm(b, axis=1, keepdims=True) + 1e-12
    atoms = []
    for fy in range(k):
        for fx in range(k):
            a = np.outer(b[fy], b[fx]).ravel()
            n = np.linalg.norm(a)
            if n > 1e-9:
                atoms.append(a / n)
    return np.asarray(atoms[:N_ATOMS], dtype=np.float64)


def learn_dictionary(x: np.ndarray) -> np.ndarray:
    rng = np.random.default_rng(SEED)
    if len(x) > 20000:
        x = x[rng.choice(len(x), 20000, replace=False)]
    x = x - x.mean(axis=1, keepdims=True)  # mean-subtracted patches
    dl = MiniBatchDictionaryLearning(
        n_components=N_ATOMS, alpha=1.0, max_iter=25, batch_size=256, transform_algorithm="omp",
        transform_n_nonzero_coefs=8, random_state=SEED,
    )
    dl.fit(x)
    d = dl.components_  # (N_ATOMS, patch*patch), already ~unit norm
    d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-12
    return d


def _write(name: str, atoms: np.ndarray, kind: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(
        json.dumps(
            {
                "patch": PATCH,
                "nAtoms": int(atoms.shape[0]),
                "kind": kind,
                "atoms": [[round(float(v), 6) for v in row] for row in atoms],
            }
        ),
        encoding="utf-8",
    )
    print(f"  {name}: {atoms.shape[0]} atoms x {atoms.shape[1]} dims -> {(OUT / f'{name}.json').stat().st_size // 1024} KB")


def main() -> None:
    rows = []
    for f in sorted(IMAGES.glob("*.png")):
        if ".hi." in f.name:
            continue
        im = np.asarray(Image.open(f).convert("RGB"), dtype=np.float64) / 255.0
        rows.append(_patches(_luma(im)))
    x = np.concatenate(rows, axis=0)
    print(f"dictionaries from {x.shape[0]} patches:")
    _write("learned", learn_dictionary(x), "learned (dictionary learning)")
    _write("overdct", overcomplete_dct(), "overcomplete DCT")
    (ROOT / "data" / "derived" / "manifests").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "derived" / "manifests" / "_dict__frames.json").write_text(
        json.dumps(
            {"imageId": "_dict", "method": "frames", "params": {"patch": PATCH, "nAtoms": N_ATOMS, "patches": int(x.shape[0])},
             "seed": SEED, "lane": "live", "bytes": 0, "runMs": 0, "format": "imglab.dict/v1", "version": "0.1.0"},
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
