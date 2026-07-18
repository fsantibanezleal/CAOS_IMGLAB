"""Bake latent-space walks with a real pretrained VAE (the Stable Diffusion autoencoder). Encode
representative images into the learned latent code, interpolate between pairs (and perturb a single latent),
decode each step, and save the frames. The live tab scrubs these frames to show latent-space interpolation:
smooth, plausible blends through a learned manifold, the editable-but-entangled generative pole.

    python -m imglab.methods.vae_latents

Downloads the SD VAE (~330 MB) to the Hugging Face cache on first run (set HF_HOME to a large disk).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault("HF_HOME", "E:/_Temp/hf")

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_vae"
SIZE = 256
FRAMES = 13
VAE_ID = "stabilityai/sd-vae-ft-mse"

# pairs to interpolate between (ids from the curated set), chosen to span domains
PAIRS = [
    ("photo_parrots", "art_greatwave"),
    ("mathart-julia", "synthetic-gradient"),
    ("astro_pillars", "tex_wood"),
]
PERTURB_SRC = "photo_parrots"


def _load(img_id: str):
    import torch

    f = IMAGES / f"{img_id}.png"
    im = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
    return torch.from_numpy(im).permute(2, 0, 1)[None] * 2 - 1  # [1,3,H,W] in [-1,1]


def main() -> None:
    import torch
    from diffusers import AutoencoderKL

    vae = AutoencoderKL.from_pretrained(VAE_ID)
    vae.eval()
    sf = vae.config.scaling_factor
    OUT.mkdir(parents=True, exist_ok=True)

    def encode(x):
        with torch.no_grad():
            return vae.encode(x).latent_dist.mean * sf

    def decode(lat):
        with torch.no_grad():
            out = vae.decode(lat / sf).sample
        img = ((out[0].permute(1, 2, 0).clamp(-1, 1) + 1) / 2).numpy()
        return (np.clip(img, 0, 1) * 255).astype(np.uint8)

    walks = []
    for a_id, b_id in PAIRS:
        la = encode(_load(a_id))
        lb = encode(_load(b_id))
        wid = f"{a_id}__{b_id}"
        wdir = OUT / wid
        wdir.mkdir(parents=True, exist_ok=True)
        for i in range(FRAMES):
            t = i / (FRAMES - 1)
            lat = (1 - t) * la + t * lb
            Image.fromarray(decode(lat)).save(wdir / f"{i:02d}.png")
        walks.append({"id": wid, "kind": "interpolate", "a": a_id, "b": b_id, "frames": FRAMES})
        print(f"  walk {wid}: {FRAMES} frames")

    # a latent-perturbation strip for one image
    lp = encode(_load(PERTURB_SRC))
    g = torch.randn_like(lp)
    pdir = OUT / f"{PERTURB_SRC}__perturb"
    pdir.mkdir(parents=True, exist_ok=True)
    for i in range(FRAMES):
        amt = (i / (FRAMES - 1)) * 4.0
        Image.fromarray(decode(lp + amt * g)).save(pdir / f"{i:02d}.png")
    walks.append({"id": f"{PERTURB_SRC}__perturb", "kind": "perturb", "a": PERTURB_SRC, "frames": FRAMES})
    print(f"  perturb {PERTURB_SRC}: {FRAMES} frames")

    (OUT / "index.json").write_text(json.dumps({"walks": walks, "size": SIZE, "vae": VAE_ID}), encoding="utf-8")
    print(f"baked {len(walks)} latent walks with {VAE_ID}")


if __name__ == "__main__":
    main()
