"""Learned latents applied to the SELECTED image: encode each curated image with a real pretrained VAE (the
Stable Diffusion autoencoder), decode it back (the reconstruction), and bake a latent-perturbation strip
(add increasing noise to THIS image's latent and decode). The live tab scrubs the per-image strip: the
selected image drifts to plausible but globally different pictures, the semantic-but-entangled generative
pole, shown for whatever image is selected (not a fixed pair).

    python -m imglab.methods.vae_latents            # all images
    python -m imglab.methods.vae_latents --ids photo_parrots

Downloads the SD VAE (~330 MB) to the HF cache on first run.
"""
from __future__ import annotations

import argparse
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
FRAMES = 11  # frame 0 = the VAE reconstruction (no noise), then increasing latent perturbation
MAX_NOISE = 3.5
VAE_ID = "stabilityai/sd-vae-ft-mse"


def main() -> None:
    import torch
    from diffusers import AutoencoderKL

    vae = AutoencoderKL.from_pretrained(VAE_ID)
    vae.eval()
    sf = vae.config.scaling_factor
    OUT.mkdir(parents=True, exist_ok=True)

    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    args = ap.parse_args()
    all_ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name]
    ids = args.ids if args.ids else all_ids

    def encode(x):
        with torch.no_grad():
            return vae.encode(x).latent_dist.mean * sf

    def decode(lat):
        with torch.no_grad():
            out = vae.decode(lat / sf).sample
        img = ((out[0].permute(1, 2, 0).clamp(-1, 1) + 1) / 2).numpy()
        return (np.clip(img, 0, 1) * 255).astype(np.uint8)

    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        arr = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        x = torch.from_numpy(arr).permute(2, 0, 1)[None] * 2 - 1
        lat = encode(x)
        g = torch.randn_like(lat)
        d = OUT / img_id
        d.mkdir(parents=True, exist_ok=True)
        recon = None
        for i in range(FRAMES):
            amt = (i / (FRAMES - 1)) * MAX_NOISE
            dec = decode(lat + amt * g)
            if i == 0:
                recon = dec
            Image.fromarray(dec).save(d / f"{i:02d}.png")
        orig8 = (arr * 255).astype(np.uint8)
        mse = float((((recon.astype(np.float32) - orig8.astype(np.float32)) / 255.0) ** 2).mean())
        psnr = round(10 * np.log10(1 / mse), 2) if mse > 0 else 99.0
        done.append({"id": img_id, "frames": FRAMES, "psnr": psnr})
        print(f"  {img_id:<24} recon PSNR {psnr:5.2f} dB, {FRAMES} frames")

    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prev = json.loads(ip.read_text()).get("images", [])
    by_id = {e["id"]: e for e in prev if isinstance(e, dict) and "id" in e}
    for e in done:
        by_id[e["id"]] = e
    images = [by_id[i] for i in all_ids if i in by_id]
    ip.write_text(json.dumps({"vae": VAE_ID, "size": SIZE, "maxNoise": MAX_NOISE, "images": images}), encoding="utf-8")
    print(f"baked latent strips for {len(done)} images; {len(images)} total")


if __name__ == "__main__":
    main()
