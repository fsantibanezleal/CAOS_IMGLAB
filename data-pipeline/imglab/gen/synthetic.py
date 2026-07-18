"""The procedural generators. Each returns an (H, W, 3) float array in [0, 1]. Deterministic (seeded where
random), so the committed PNGs are reproducible. Rendered at a supersampled size and downsampled for clean
anti-aliased edges on the drawn shapes."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw


def _supersample_draw(size: int, draw_fn, bg=(255, 255, 255), ss: int = 3) -> np.ndarray:
    """Render a PIL drawing at ss*size then box-downsample to size for anti-aliasing."""
    big = Image.new("RGB", (size * ss, size * ss), bg)
    draw_fn(ImageDraw.Draw(big), size * ss)
    small = big.resize((size, size), Image.LANCZOS)
    return np.asarray(small, dtype=np.float64) / 255.0


def checkerboard(size: int = 256, squares: int = 8) -> np.ndarray:
    """A hard checkerboard: a clean high-frequency test for the transform tabs."""
    step = size // squares
    idx = (np.arange(size) // step) % 2
    board = (idx[:, None] ^ idx[None, :]).astype(np.float64)
    img = np.stack([board, board, board], axis=-1)
    # tint the two phases slightly so colour transforms have something to chew on
    img[..., 0] = np.where(board > 0, 0.92, 0.08)
    img[..., 1] = np.where(board > 0, 0.90, 0.10)
    img[..., 2] = np.where(board > 0, 0.88, 0.12)
    return img


def radial_gradient(size: int = 256) -> np.ndarray:
    """A smooth two-colour radial gradient: low-frequency, compression-friendly."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    cx, cy = size / 2, size / 2
    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size / np.sqrt(2))
    inner = np.array([0.11, 0.31, 0.85])
    outer = np.array([0.96, 0.55, 0.20])
    t = np.clip(r, 0, 1)[..., None]
    return inner * (1 - t) + outer * t


def occluded_polygons(size: int = 256) -> np.ndarray:
    """Felipe's example, made literal: a green background, a red-bordered circle (radius ~65 at 256px),
    occluded by a blue triangle. The trivially-parametric control scene: a few numbers fully describe it."""

    def draw(d: ImageDraw.ImageDraw, s: int):
        scale = s / 256.0
        r = 65 * scale
        cx, cy = 118 * scale, 128 * scale
        border = 3 * scale
        d.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(232, 84, 72),
            outline=(120, 20, 16),
            width=max(1, int(round(border * 3))),
        )
        d.ellipse(
            [cx - r + border * 3, cy - r + border * 3, cx + r - border * 3, cy + r - border * 3],
            fill=(232, 84, 72),
        )
        tri = [(150 * scale, 60 * scale), (225 * scale, 200 * scale), (95 * scale, 175 * scale)]
        d.polygon(tri, fill=(46, 96, 190), outline=(20, 42, 96))

    return _supersample_draw(size, draw, bg=(64, 150, 90))


def julia(size: int = 256, c: complex = complex(-0.8, 0.156), zoom: float = 1.35, iters: int = 220) -> np.ndarray:
    """A Julia set with correct smooth (continuous) escape-time colouring: dense, self-similar high
    frequencies. The interior (never-escaping) set is rendered dark; escaped pixels carry the smooth
    iteration count nu = n + 1 - log2(log|z|)."""
    lin = np.linspace(-zoom, zoom, size)
    x, y = np.meshgrid(lin, lin)
    z = x + 1j * y
    niter = np.zeros(z.shape, dtype=np.float64)
    mask = np.ones(z.shape, dtype=bool)  # still-bounded pixels
    for i in range(iters):
        z[mask] = z[mask] * z[mask] + c
        escaped = mask & (np.abs(z) > 4.0)
        if np.any(escaped):
            az = np.abs(z[escaped])
            niter[escaped] = (i + 1) - np.log(np.log(az) / np.log(2.0)) / np.log(2.0)
            mask &= ~escaped
    interior = mask
    mx = niter.max() if niter.max() > 0 else 1.0
    img = _palette(niter / mx)
    img[interior] = [0.02, 0.02, 0.08]
    return img


def _palette(t: np.ndarray) -> np.ndarray:
    """A perceptually smooth blue-magenta-gold palette on t in [0,1]."""
    t = np.clip(t, 0, 1)
    stops = np.array(
        [
            [0.02, 0.02, 0.10],
            [0.13, 0.15, 0.55],
            [0.55, 0.18, 0.62],
            [0.95, 0.45, 0.30],
            [0.99, 0.92, 0.62],
        ]
    )
    xs = np.linspace(0, 1, len(stops))
    out = np.empty(t.shape + (3,), dtype=np.float64)
    for k in range(3):
        out[..., k] = np.interp(t, xs, stops[:, k])
    return out


def harmonograph(size: int = 256, seed: int = 7) -> np.ndarray:
    """A decaying two-pendulum harmonograph curve: an elegant, purely parametric line drawing."""
    rng = np.random.default_rng(seed)
    f = 2 + rng.random(4) * 3
    p = rng.random(4) * 2 * np.pi
    d = 0.002 + rng.random(4) * 0.004
    t = np.linspace(0, 220, 24000)
    # normalized to roughly [-1, 1]
    nx = 0.32 * (np.sin(f[0] * t + p[0]) * np.exp(-d[0] * t) + np.sin(f[1] * t + p[1]) * np.exp(-d[1] * t))
    ny = 0.32 * (np.sin(f[2] * t + p[2]) * np.exp(-d[2] * t) + np.sin(f[3] * t + p[3]) * np.exp(-d[3] * t))

    def draw(d_, s: int):
        pts = list(zip((nx + 0.5) * s, (ny + 0.5) * s))
        d_.line(pts, fill=(40, 62, 140), width=max(1, int(round(s / 380))), joint="curve")

    return _supersample_draw(size, draw, bg=(250, 249, 244), ss=2)


def rose_epicycle(size: int = 256, k: int = 5) -> np.ndarray:
    """A rose (rhodonea) curve r = cos(k*theta), an exactly-parametric figure that ties to the epicycle and
    symbolic tabs (which reconstruct such a closed curve live from its Fourier coefficients). Drawn as a
    layered thick polyline so the petals read cleanly."""
    theta = np.linspace(0, 2 * np.pi, 3000)
    r = np.cos(k * theta)
    nx = r * np.cos(theta) * 0.44  # normalized to [-0.44, 0.44]
    ny = r * np.sin(theta) * 0.44

    def draw(d_, s: int):
        pts = list(zip((nx + 0.5) * s, (ny + 0.5) * s))
        # a soft wide underlay + a crisp core line
        d_.line(pts, fill=(233, 176, 205), width=max(2, int(round(s / 128))), joint="curve")
        d_.line(pts, fill=(176, 40, 104), width=max(1, int(round(s / 350))), joint="curve")

    return _supersample_draw(size, draw, bg=(252, 250, 250), ss=3)


def warpnoise(size: int = 256, seed: int = 0, warp: float = 0.35, freq: float = 3.0) -> np.ndarray:
    """Domain-warped band-limited noise: a smooth-regime field. Nudging warp or freq morphs the whole field
    continuously (no chaos), the opposite of the Julia set, so the two math-art images bracket the symbolic
    family's editability."""
    rng = np.random.default_rng(seed)

    def smooth_field(f: float) -> np.ndarray:
        gsz = int(f) + 2
        g = rng.standard_normal((gsz, gsz))
        yi = np.linspace(0, gsz - 1.001, size)
        xi = np.linspace(0, gsz - 1.001, size)
        y0 = np.floor(yi).astype(int)
        x0 = np.floor(xi).astype(int)
        fy = (yi - y0)[:, None]
        fx = (xi - x0)[None, :]
        g00 = g[np.ix_(y0, x0)]
        g01 = g[np.ix_(y0, x0 + 1)]
        g10 = g[np.ix_(y0 + 1, x0)]
        g11 = g[np.ix_(y0 + 1, x0 + 1)]
        top = g00 * (1 - fx) + g01 * fx
        bot = g10 * (1 - fx) + g11 * fx
        return top * (1 - fy) + bot * fy

    base = smooth_field(freq)
    wx = smooth_field(freq * 0.6)
    wy = smooth_field(freq * 0.6)
    field = base + warp * (np.roll(base, 8, 0) * wy + np.roll(base, 8, 1) * wx)
    t = (field - field.min()) / (np.ptp(field) + 1e-9)
    return _palette(t)


def _heart_contour(m: int = 2048) -> np.ndarray:
    t = np.linspace(0, 2 * np.pi, m, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    return x + 1j * y


def epicycle(size: int = 256, harmonics: int = 20) -> np.ndarray:
    """A closed contour (heart) rebuilt from the largest coefficients of its own Fourier descriptor, drawn
    with the nested epicycle circles at one phase: the exactly-computable image-to-equation case (Zahn and
    Roskies 1972, DOI 10.1109/TC.1972.5008949)."""
    z = _heart_contour(2048)
    n = z.size
    coeff = np.fft.fft(z) / n
    freqs = np.fft.fftfreq(n, d=1.0 / n).astype(int)
    order = np.argsort(-np.abs(coeff))
    keep = order[: 2 * harmonics + 1]
    tt = np.linspace(0, 2 * np.pi, 1600)
    recon = np.zeros(tt.shape, dtype=complex)
    for k in keep:
        recon += coeff[k] * np.exp(1j * freqs[k] * tt)
    mx = np.abs(z).max() * 2.6  # normalization so the figure fits with margin

    def nx(c):
        return (c.real / mx + 0.5)

    def ny(c):
        return (-c.imag / mx + 0.5)

    def draw(d_, s: int):
        # faint epicycle circles at phase tt[0], skipping the DC (constant) term
        tip = coeff[keep[0]] if freqs[keep[0]] == 0 else 0 + 0j
        for k in sorted(keep, key=lambda kk: -abs(coeff[kk])):
            if freqs[k] == 0:
                continue
            r = abs(coeff[k]) / mx * s
            cx, cy = nx(tip) * s, ny(tip) * s
            d_.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(170, 170, 180))
            tip += coeff[k] * np.exp(1j * freqs[k] * tt[0])
        pts = list(zip([nx(c) * s for c in recon], [ny(c) * s for c in recon]))
        d_.line(pts, fill=(190, 40, 60), width=max(1, int(round(s / 200))), joint="curve")

    return _supersample_draw(size, draw, bg=(250, 250, 248), ss=2)


# id -> { fn, params, category, kind, family_hints, title, titleEs }
GENERATORS = {
    "synthetic-checkerboard": {"fn": checkerboard, "params": {}, "category": "synthetic", "kind": "synthetic",
                               "family_hints": [1, 3, 0], "title": "Checkerboard", "titleEs": "Tablero"},
    "synthetic-gradient": {"fn": radial_gradient, "params": {}, "category": "synthetic", "kind": "synthetic",
                           "family_hints": [1, 4, 0], "title": "Radial gradient", "titleEs": "Gradiente radial"},
    "synthetic-polygons": {"fn": occluded_polygons, "params": {}, "category": "synthetic", "kind": "synthetic",
                           "family_hints": [3, 1, 0], "title": "Occluded primitives", "titleEs": "Primitivas ocluidas"},
    "mathart-julia": {"fn": julia, "params": {}, "category": "math-art", "kind": "math-art",
                      "family_hints": [5, 4, 1], "title": "Julia set", "titleEs": "Conjunto de Julia"},
    "mathart-warpnoise": {"fn": warpnoise, "params": {"seed": 0}, "category": "math-art", "kind": "math-art",
                          "family_hints": [5, 1, 4], "title": "Domain-warped noise", "titleEs": "Ruido deformado"},
    "mathart-harmonograph": {"fn": harmonograph, "params": {"seed": 7}, "category": "math-art", "kind": "math-art",
                             "family_hints": [5, 3], "title": "Harmonograph", "titleEs": "Armonografo"},
    "mathart-rose": {"fn": rose_epicycle, "params": {}, "category": "math-art", "kind": "math-art",
                     "family_hints": [5, 3, 1], "title": "Rose (rhodonea)", "titleEs": "Rosa (rodonea)"},
    "mathart-epicycle": {"fn": epicycle, "params": {}, "category": "math-art", "kind": "math-art",
                         "family_hints": [1, 3], "title": "Fourier epicycle", "titleEs": "Epiciclo de Fourier"},
}
