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


# id -> (generator, category, title, titleEs, illustrates)
GENERATORS = {
    "synthetic-checkerboard": (checkerboard, "synthetic", "Checkerboard", "Tablero", ["transforms"]),
    "synthetic-gradient": (radial_gradient, "synthetic", "Radial gradient", "Gradiente radial", ["transforms", "neural-field"]),
    "synthetic-polygons": (occluded_polygons, "synthetic", "Occluded primitives", "Primitivas ocluidas", ["primitives"]),
    "mathart-julia": (julia, "math-art", "Julia set", "Conjunto de Julia", ["transforms", "neural-field", "symbolic"]),
    "mathart-harmonograph": (harmonograph, "math-art", "Harmonograph", "Armonografo", ["symbolic", "primitives"]),
    "mathart-rose": (rose_epicycle, "math-art", "Rose (epicycles)", "Rosa (epiciclos)", ["symbolic", "primitives"]),
}
