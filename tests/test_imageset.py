"""Image ingestion contract + generator sanity (replaces the transient SIR example tests conceptually;
those remain until the engine cutover). Uses only the pipeline venv deps (Pillow, numpy)."""
from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from imglab.gen import synthetic
from imglab.io.image import Policy, validate_image_bytes


def _png_bytes(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def cc0_png() -> bytes:
    return _png_bytes(synthetic.checkerboard(64))


def test_bundle_accepts_cc0(cc0_png):
    v = validate_image_bytes(cc0_png, image_id="t", policy=Policy.BUNDLE, spdx="CC0-1.0")
    assert v.accepted and v.width == 64 and v.fmt == "PNG"


def test_bundle_rejects_unknown_license(cc0_png):
    v = validate_image_bytes(cc0_png, image_id="t", policy=Policy.BUNDLE, spdx="unknown")
    assert not v.accepted and "allowlist" in v.reason


def test_bundle_rejects_ccby_without_attribution(cc0_png):
    v = validate_image_bytes(cc0_png, image_id="t", policy=Policy.BUNDLE, spdx="CC-BY-4.0")
    assert not v.accepted and "attribution" in v.reason


def test_bundle_accepts_ccby_with_attribution(cc0_png):
    v = validate_image_bytes(cc0_png, image_id="t", policy=Policy.BUNDLE, spdx="CC-BY-4.0", attribution="NASA/ESA")
    assert v.accepted


def test_runtime_is_license_exempt(cc0_png):
    v = validate_image_bytes(cc0_png, image_id="upload", policy=Policy.RUNTIME)
    assert v.accepted


def test_rejects_too_small():
    v = validate_image_bytes(_png_bytes(synthetic.checkerboard(16)), image_id="t", policy=Policy.RUNTIME)
    assert not v.accepted and "too small" in v.reason


def test_generators_shape_and_determinism():
    for gid, g in synthetic.GENERATORS.items():
        a = g["fn"](64, **g["params"])
        assert a.shape == (64, 64, 3), gid
        assert a.min() >= 0.0 and a.max() <= 1.0 and not np.isnan(a).any(), gid
    # deterministic where seeded
    assert np.array_equal(synthetic.julia(48), synthetic.julia(48))
    assert np.array_equal(synthetic.warpnoise(48, seed=0), synthetic.warpnoise(48, seed=0))


def test_julia_is_chaotic_warpnoise_is_smooth():
    # the family-5 bimodality: a small parameter nudge shatters the chaotic Julia set but only gently morphs
    # the smooth warp-noise field. Assert the chaotic case changes clearly more than the smooth one.
    j_change = np.mean(
        np.abs(synthetic.julia(96, c=complex(-0.8, 0.156)) - synthetic.julia(96, c=complex(-0.8, 0.166))) > 0.05
    )
    w_change = np.mean(
        np.abs(synthetic.warpnoise(96, seed=0, warp=0.35) - synthetic.warpnoise(96, seed=0, warp=0.36)) > 0.05
    )
    assert j_change > w_change, f"julia change {j_change:.3f} should exceed warpnoise change {w_change:.3f}"
    assert j_change > 0.1, f"julia should be visibly sensitive to c, got {j_change:.3f}"
