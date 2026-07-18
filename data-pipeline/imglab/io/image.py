"""CONTRACT 1, image ingestion (raw image -> pipeline / live engine). The bring-your-own-image gate AND the
bundling gate.

An image is ACCEPTED iff it decodes to a supported still raster within size bounds and (for the BUNDLE
policy) carries an allowlisted, redistributable license with the attribution its license demands. REJECTED
images report a reason and are never silently coerced; plausible-but-suspicious images are FLAGGED (accepted,
the flag is recorded). Pure and Pyodide-safe (Pillow only), so the same license/format policy backs the live
"upload your own image" path (RUNTIME policy, license-exempt: the user's own image, processed in-browser,
never redistributed).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from enum import Enum
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageCms

MIN_SIDE = 32
MAX_INPUT_SIDE = 8192
FLAG_LARGE_SIDE = 4096
SUPPORTED_FORMATS = frozenset({"PNG", "JPEG", "WEBP", "BMP", "TIFF"})

# Redistributable license allowlist (machine ids). Non-commercial / unknown licenses are absent => REJECTED.
LICENSE_ALLOW: dict[str, dict[str, Any]] = {
    "CC0-1.0": {"needs_attribution": False},
    "LicenseRef-Public-Domain": {"needs_attribution": False},
    "MIT": {"needs_attribution": False},
    "LicenseRef-Kodak-Unrestricted": {"needs_attribution": False},
    "LicenseRef-Unsplash": {"needs_attribution": False},
    "CC-BY-4.0": {"needs_attribution": True},
    "CC-BY-3.0": {"needs_attribution": True},
    "CC-BY-SA-4.0": {"needs_attribution": True},
    "LicenseRef-NASA-STScI": {"needs_attribution": True},
}
LICENSE_DENY = frozenset(
    {
        "LicenseRef-WikiArt-NonCommercial",
        "LicenseRef-ImageNet-Research",
        "LicenseRef-Brodatz-Dover",
        "LicenseRef-USC-SIPI-Lena",
        "unknown",
        "",
        "None",
    }
)


class Policy(str, Enum):
    BUNDLE = "bundle"    # committed to the repo => license enforced
    RUNTIME = "runtime"  # user upload in the live tabs => license exempt


@dataclass
class ImageVerdict:
    accepted: bool
    image_id: str
    reason: str = ""
    flags: list[str] = field(default_factory=list)
    width: int = 0
    height: int = 0
    fmt: str = ""
    mode: str = ""
    sha256: str = ""


def _reject(image_id: str, reason: str) -> ImageVerdict:
    return ImageVerdict(accepted=False, image_id=image_id, reason=reason)


def validate_image_bytes(
    raw: bytes,
    *,
    image_id: str,
    policy: Policy = Policy.BUNDLE,
    spdx: str | None = None,
    attribution: str | None = None,
) -> ImageVerdict:
    """Apply CONTRACT 1 to one image's raw bytes. Pure; deterministic; no filesystem writes."""
    sha = hashlib.sha256(raw).hexdigest()

    flags: list[str] = []
    if policy is Policy.BUNDLE:
        key = (spdx or "").strip()
        if key in LICENSE_DENY or key not in LICENSE_ALLOW:
            return _reject(image_id, f"license '{spdx}' not in redistribution allowlist")
        if LICENSE_ALLOW[key]["needs_attribution"] and not (attribution and attribution.strip()):
            return _reject(image_id, f"license '{key}' requires attribution but none was provided")

    try:
        img = Image.open(BytesIO(raw))
        img.load()
    except Exception as exc:
        return _reject(image_id, f"undecodable image: {exc!r}")

    fmt = (img.format or "").upper()
    if fmt not in SUPPORTED_FORMATS:
        return _reject(image_id, f"format '{fmt}' not in {sorted(SUPPORTED_FORMATS)}")

    if getattr(img, "n_frames", 1) > 1:
        return _reject(image_id, "multi-frame (animated) image; a single still is required")

    w, h = img.size
    if w < MIN_SIDE or h < MIN_SIDE:
        return _reject(image_id, f"too small: {w}x{h} < {MIN_SIDE}px on a side")
    if max(w, h) > MAX_INPUT_SIDE:
        return _reject(image_id, f"too large to decode safely: {w}x{h} > {MAX_INPUT_SIDE}px")
    if max(w, h) > FLAG_LARGE_SIDE:
        flags.append(f"large source {w}x{h}; will be center-cropped and downscaled")

    if img.mode in ("L", "LA", "I", "I;16", "F"):
        flags.append(f"non-RGB mode '{img.mode}'; grayscale will be replicated to 3 channels")
    if "A" in img.mode or (img.mode == "P" and "transparency" in img.info):
        flags.append("alpha channel present; will be composited over white")
    try:
        img.convert("RGB")
    except Exception as exc:
        return _reject(image_id, f"mode '{img.mode}' not convertible to RGB: {exc!r}")

    return ImageVerdict(
        accepted=True, image_id=image_id, width=w, height=h, fmt=fmt, mode=img.mode, sha256=sha, flags=flags
    )


def validate_path(
    path: str | Path, *, policy: Policy = Policy.BUNDLE, spdx: str | None = None, attribution: str | None = None
) -> ImageVerdict:
    p = Path(path)
    return validate_image_bytes(
        p.read_bytes(), image_id=p.stem, policy=policy, spdx=spdx, attribution=attribution
    )


def to_srgb_rgb(img: Image.Image) -> Image.Image:
    """Bring any accepted image into 8-bit sRGB RGB: convert an embedded ICC profile to sRGB when present,
    composite alpha over white, replicate grayscale. Deterministic."""
    icc = img.info.get("icc_profile")
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(BytesIO(icc))
            dst = ImageCms.createProfile("sRGB")
            mode = "RGBA" if "A" in img.mode else "RGB"
            img = ImageCms.profileToProfile(img, src, dst, outputMode=mode)
        except Exception:
            pass
    if "A" in img.mode or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    return img.convert("RGB")
