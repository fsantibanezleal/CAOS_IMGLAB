"""Fidelity metrics for the offline pipeline, identical in formula to the browser twin
(frontend/src/engine/metrics.ts): PSNR on RGB MSE, SSIM (Wang et al. 2004, DOI 10.1109/TIP.2003.819861)
on luma with an 11x11 Gaussian window (sigma 1.5, reflect padding), and MS-SSIM (Wang et al. 2003) over
five scales. Inputs are float arrays in [0, 1], shape (H, W, 3) for RGB or (H, W) for a single channel.

Sanity (see tests): ssim(x, x) == 1, psnr(x, x) == inf, and a uniform 1/255 shift gives PSNR ~= 48.13 dB.
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import gaussian_filter

_LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float64)
_C1 = 0.01**2
_C2 = 0.03**2
_MSSSIM_WEIGHTS = np.array([0.0448, 0.2856, 0.3001, 0.2363, 0.1333], dtype=np.float64)
# truncate so the Gaussian radius is 5 (an 11-tap kernel), matching the browser implementation.
_TRUNCATE = 5.0 / 1.5


def to_luma(img: np.ndarray) -> np.ndarray:
    img = np.asarray(img, dtype=np.float64)
    if img.ndim == 2:
        return img
    return img[..., :3] @ _LUMA


def mse(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    return float(np.mean((a - b) ** 2))


def psnr(a: np.ndarray, b: np.ndarray) -> float:
    m = mse(a, b)
    if m <= 0:
        return float("inf")
    return float(10.0 * np.log10(1.0 / m))  # MAX = 1 for [0, 1] data


def _blur(x: np.ndarray) -> np.ndarray:
    return gaussian_filter(x, sigma=1.5, truncate=_TRUNCATE, mode="reflect")


def _ssim_terms(ya: np.ndarray, yb: np.ndarray):
    mu_a = _blur(ya)
    mu_b = _blur(yb)
    va = _blur(ya * ya) - mu_a * mu_a
    vb = _blur(yb * yb) - mu_b * mu_b
    cov = _blur(ya * yb) - mu_a * mu_b
    return mu_a, mu_b, va, vb, cov


def ssim(a: np.ndarray, b: np.ndarray) -> float:
    ya = to_luma(a)
    yb = to_luma(b)
    mu_a, mu_b, va, vb, cov = _ssim_terms(ya, yb)
    num = (2 * mu_a * mu_b + _C1) * (2 * cov + _C2)
    den = (mu_a**2 + mu_b**2 + _C1) * (va + vb + _C2)
    return float(np.mean(num / den))


def _cs(ya: np.ndarray, yb: np.ndarray) -> float:
    _, _, va, vb, cov = _ssim_terms(ya, yb)
    return float(np.mean((2 * cov + _C2) / (va + vb + _C2)))


def _downsample2(y: np.ndarray) -> np.ndarray:
    h, w = y.shape[0] - y.shape[0] % 2, y.shape[1] - y.shape[1] % 2
    y = y[:h, :w]
    return 0.25 * (y[0::2, 0::2] + y[1::2, 0::2] + y[0::2, 1::2] + y[1::2, 1::2])


def ms_ssim(a: np.ndarray, b: np.ndarray) -> float:
    ya = to_luma(a)
    yb = to_luma(b)
    if min(ya.shape) < 176:
        return ssim(ya, yb)
    prod = 1.0
    for s in range(5):
        if s < 4:
            cs = max(1e-8, _cs(ya, yb))
            prod *= cs ** _MSSSIM_WEIGHTS[s]
            ya = _downsample2(ya)
            yb = _downsample2(yb)
        else:
            last = max(1e-8, ssim(ya, yb))
            prod *= last ** _MSSSIM_WEIGHTS[s]
    return float(prod)


def bpp(num_bytes: int, width: int, height: int) -> float:
    """Bits per pixel, for rate-distortion curves."""
    return (num_bytes * 8.0) / float(width * height)
