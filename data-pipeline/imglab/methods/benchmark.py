"""Bake the cross-family benchmark: reconstruction fidelity and editability, measured (never asserted).

Three real measurements, written to data/derived/_bench/index.json for the Experiments and Benchmark pages:

1. Rate-distortion: for the linear transform-coding families (Fourier, full-frame DCT, wavelet, patch KLT),
   keep the top-k coefficients by magnitude at a sweep of kept-fractions, reconstruct, and record PSNR and
   SSIM, averaged over a representative image subset.
2. Fixed-budget table: each family's fidelity and parameter cost at a comparable budget. The classical
   transforms are recomputed here; the primitive, neural-field and VAE numbers are read from their committed
   bakes so the table matches exactly what the app shows.
3. Editability locality: perturb one natural parameter of each family and measure how concentrated the pixel
   change is (the share of the total change energy in the most-affected 10 percent of pixels). A concentrated
   change is a local exact edit (the designed pole); a diffuse change is a global entangled edit.

    python -m imglab.methods.benchmark

Luma is used for the transform measurements (the standard for rate-distortion). Classical only, no torch.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pywt
from PIL import Image
from scipy.fft import dctn, idctn

from imglab.core.metrics import psnr, ssim

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
DERIVED = ROOT / "data" / "derived"
OUT = DERIVED / "_bench"
SIZE = 256
PATCH = 8
SUBSET = ["photo_parrots", "art_greatwave", "mathart-julia", "astro_pillars", "tex_wood", "synthetic-gradient"]
FRACS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.25]


def load_luma(img_id: str) -> np.ndarray:
    im = np.asarray(Image.open(IMAGES / f"{img_id}.png").convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), np.float32) / 255
    return (0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]).astype(np.float32)


def keep_top(coeff: np.ndarray, frac: float) -> np.ndarray:
    flat = np.abs(coeff).ravel()
    k = max(1, int(frac * flat.size))
    thr = np.partition(flat, -k)[-k]
    return coeff * (np.abs(coeff) >= thr)


def rd_fourier(x: np.ndarray, frac: float) -> np.ndarray:
    return np.real(np.fft.ifft2(keep_top(np.fft.fft2(x), frac)))


def rd_dct(x: np.ndarray, frac: float) -> np.ndarray:
    return idctn(keep_top(dctn(x, norm="ortho"), frac), norm="ortho")


def rd_wavelet(x: np.ndarray, frac: float) -> np.ndarray:
    coeffs = pywt.wavedec2(x, "db4", level=4)
    arr, slices = pywt.coeffs_to_array(coeffs)
    rec = pywt.array_to_coeffs(keep_top(arr, frac), slices, output_format="wavedec2")
    return pywt.waverec2(rec, "db4")[: x.shape[0], : x.shape[1]]


def _patches(x: np.ndarray) -> np.ndarray:
    h = (x.shape[0] // PATCH) * PATCH
    xt = x[:h, :h]
    p = xt.reshape(h // PATCH, PATCH, h // PATCH, PATCH).transpose(0, 2, 1, 3).reshape(-1, PATCH * PATCH)
    return p, h


def _unpatch(p: np.ndarray, h: int) -> np.ndarray:
    n = h // PATCH
    return p.reshape(n, n, PATCH, PATCH).transpose(0, 2, 1, 3).reshape(h, h)


def rd_klt(x: np.ndarray, basis: np.ndarray, mean: np.ndarray, frac: float) -> np.ndarray:
    p, h = _patches(x)
    m = max(1, int(frac * basis.shape[0]))
    b = basis[:m]
    proj = (p - mean) @ b.T
    rec = proj @ b + mean
    out = x.copy()
    out[:h, :h] = _unpatch(rec, h)
    return out


def klt_basis(imgs: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    from sklearn.decomposition import PCA

    P = np.concatenate([_patches(x)[0] for x in imgs], 0)
    pca = PCA(n_components=PATCH * PATCH).fit(P)
    return pca.components_.astype(np.float32), pca.mean_.astype(np.float32)


def rate_distortion(imgs: list[np.ndarray]) -> dict:
    basis, mean = klt_basis(imgs)
    fams = {
        "fourier": lambda x, f: rd_fourier(x, f),
        "dct": lambda x, f: rd_dct(x, f),
        "wavelet": lambda x, f: rd_wavelet(x, f),
        "klt": lambda x, f: rd_klt(x, basis, mean, f),
    }
    rd = {}
    for name, fn in fams.items():
        curve = []
        for f in FRACS:
            ps, ss = [], []
            for x in imgs:
                r = np.clip(fn(x, f), 0, 1).astype(np.float32)
                ps.append(psnr(x, r))
                ss.append(ssim(x, r))
            curve.append({"frac": f, "psnr": round(float(np.mean(ps)), 2), "ssim": round(float(np.mean(ss)), 3)})
        rd[name] = curve
    return rd


def locality(imgs: list[np.ndarray]) -> list[dict]:
    """Concentration of the pixel change when one natural parameter is perturbed (mean over the subset)."""
    basis, mean = klt_basis(imgs)

    def concentration(delta: np.ndarray) -> float:
        d = np.abs(delta).ravel()
        if d.sum() <= 0:
            return 0.0
        k = max(1, int(0.1 * d.size))
        top = np.partition(d, -k)[-k:].sum()
        return float(top / d.sum())

    def perturb_transform(x, transform, itransform, one_hot_scale=0.15):
        c = transform(x)
        idx = np.unravel_index(np.argmax(np.abs(c)[1:]) + 1, c.shape) if c.ndim == 2 else None
        c2 = c.copy()
        # nudge a mid-magnitude coefficient
        mags = np.abs(c).ravel()
        j = int(np.argsort(mags)[len(mags) // 2])
        c2.ravel()[j] += one_hot_scale * (mags.max() + 1e-6)
        return itransform(c2) - itransform(c)

    rows = []
    # transforms: perturb one coefficient
    for name, tr, itr in (
        ("Fourier", np.fft.fft2, lambda c: np.real(np.fft.ifft2(c))),
        ("DCT", lambda x: dctn(x, norm="ortho"), lambda c: idctn(c, norm="ortho")),
    ):
        cs = [concentration(perturb_transform(x, tr, itr)) for x in imgs]
        rows.append({"family": name, "concentration": round(float(np.mean(cs)), 3)})
    # wavelet: perturb one detail coefficient (local by construction)
    wl = []
    for x in imgs:
        coeffs = pywt.wavedec2(x, "db4", level=4)
        arr, sl = pywt.coeffs_to_array(coeffs)
        a2 = arr.copy()
        mags = np.abs(arr).ravel()
        a2.ravel()[int(np.argsort(mags)[len(mags) // 2])] += 0.15 * (mags.max() + 1e-6)
        rec = pywt.waverec2(pywt.array_to_coeffs(a2, sl, output_format="wavedec2"), "db4")[: x.shape[0], : x.shape[1]]
        wl.append(concentration(rec - x))
    rows.append({"family": "Wavelet", "concentration": round(float(np.mean(wl)), 3)})
    # KLT: perturb one patch's coefficient (local to that patch)
    kl = []
    for x in imgs:
        p, h = _patches(x)
        proj = (p - mean) @ basis.T
        p2 = proj.copy()
        p2[len(p2) // 2, 5] += 2.0
        rec = _unpatch(p2 @ basis + mean, h)
        out = x.copy()
        out[:h, :h] = rec
        base = x.copy()
        base[:h, :h] = _unpatch((proj @ basis + mean), h)
        kl.append(concentration(out - base))
    rows.append({"family": "KLT", "concentration": round(float(np.mean(kl)), 3)})
    return rows


def main() -> None:
    imgs = [load_luma(i) for i in SUBSET]
    OUT.mkdir(parents=True, exist_ok=True)

    rd = rate_distortion(imgs)
    loc = locality(imgs)

    # fixed-budget table: transforms at 5%, learned families from their committed bakes
    budget = []
    at5 = {k: next(p for p in v if p["frac"] == 0.05) for k, v in rd.items()}
    names = {"fourier": "Fourier", "dct": "DCT", "wavelet": "Wavelet", "klt": "KLT (patch)"}
    for key, label in names.items():
        budget.append({"family": label, "psnr": at5[key]["psnr"], "ssim": at5[key]["ssim"],
                       "params": f"{int(0.05 * SIZE * SIZE)} coeffs", "note": "top 5% coefficients"})
    # primitives, neural field: mean of committed psnr over the subset
    def baked_mean(group, key="psnr"):
        vals = []
        for i in SUBSET:
            f = DERIVED / group / f"{i}.json"
            if f.exists():
                vals.append(json.loads(f.read_text())[key])
        return round(float(np.mean(vals)), 2) if vals else None

    prim = baked_mean("_prim")
    if prim is not None:
        budget.append({"family": "Primitives", "psnr": prim, "ssim": None, "params": "~90 ellipses", "note": "greedy shape fit (committed)"})
    inr = baked_mean("_inr")
    if inr is not None:
        li = json.loads((DERIVED / "_inr" / "photo_parrots.json").read_text())
        nweights = sum(len(np.ravel(w)) for layer in li["layers"] for w in (layer["w"], layer["b"]))
        budget.append({"family": "Neural field (INR)", "psnr": inr, "ssim": None, "params": f"~{nweights} weights", "note": "SIREN per image (committed)"})
    # VAE reconstruction: the committed per-image recon PSNR (frame 0 = decode(encode(x)))
    vae_idx = DERIVED / "_vae" / "index.json"
    if vae_idx.exists():
        vidx = json.loads(vae_idx.read_text())
        vp = [e["psnr"] for e in vidx.get("images", []) if e["id"] in SUBSET and "psnr" in e]
        if vp:
            budget.append({"family": "VAE latent", "psnr": round(float(np.mean(vp)), 2), "ssim": None,
                           "params": "4x32x32 latent", "note": "encode-decode reconstruction (committed)"})

    # Symbolic equation: the committed per-image fit PSNR (closed-form trig, 512 terms)
    sp = []
    for i in SUBSET:
        sf = DERIVED / "_sym" / f"{i}.json"
        if sf.exists():
            sp.append(json.loads(sf.read_text())["psnr"])
    if sp:
        budget.append({"family": "Symbolic equation", "psnr": round(float(np.mean(sp)), 2), "ssim": None,
                       "params": "512 trig terms", "note": "random-Fourier ridge fit (committed)"})

    # Gabor atoms, the Gaussian mixture, and the thin-plate RBF: committed per-image fit PSNRs
    for group, label, params, note in (
        ("_gabor", "Gabor atoms", "250 wave packets", "matching pursuit (committed)"),
        ("_gsplat", "Gaussian mixture", "300 Gaussians", "2D splatting, best-of-two init on GPU (committed)"),
        ("_rbf", "Thin-plate RBF", "225 kernels", "ridge least-squares solve (committed)"),
    ):
        vals = []
        for i in SUBSET:
            f2_ = DERIVED / group / f"{i}.json"
            if f2_.exists():
                vals.append(json.loads(f2_.read_text())["psnr"])
        if vals:
            budget.append({"family": label, "psnr": round(float(np.mean(vals)), 2), "ssim": None,
                           "params": params, "note": note})

    # Chebyshev polynomial series: computed here directly (the live-lane algorithm, deg 24)
    def cheb_psnr(x: np.ndarray, deg: int = 24) -> float:
        n = x.shape[0]
        t = np.linspace(-1, 1, n)
        V = np.polynomial.chebyshev.chebvander(t, deg)  # (n, deg+1)
        Q, _ = np.linalg.qr(V)
        rec = Q @ (Q.T @ x @ Q) @ Q.T
        rec = np.clip(rec, 0, 1)
        return psnr(x, rec.astype(np.float32))

    cp = [float(cheb_psnr(x)) for x in imgs]
    budget.append({"family": "Chebyshev series", "psnr": round(float(np.mean(cp)), 2), "ssim": None,
                   "params": "625 poly terms", "note": "degree-24 tensor series (live-lane algorithm)"})

    (OUT / "index.json").write_text(
        json.dumps({"images": SUBSET, "size": SIZE, "fracs": FRACS, "rd": rd, "budget": budget, "locality": loc}, indent=2),
        encoding="utf-8",
    )
    print(f"baked benchmark: {len(SUBSET)} images, {len(rd)} R-D families, {len(budget)} budget rows, {len(loc)} locality rows")
    for b in budget:
        print(f"  {b['family']:<22} PSNR={b['psnr']}  {b['note']}")


if __name__ == "__main__":
    main()
