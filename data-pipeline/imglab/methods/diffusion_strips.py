"""Diffusion applied to the SELECTED image: SD-Turbo image-to-image regeneration at increasing strength.
For each curated image we encode it, add a controlled amount of noise, and let the diffusion model denoise
back, at a sweep of strengths. Low strength returns almost the original; high strength lets the learned prior
re-imagine the picture. The live tab scrubs this per-image strip, so diffusion is about the selected image
(not a fixed prompt): a semantic but entangled edit, the far generative pole.

    python -m imglab.methods.diffusion_strips            # all images
    python -m imglab.methods.diffusion_strips --ids photo_parrots

Downloads SD-Turbo (~2.5 GB) to the HF cache on first run. CPU-feasible but slow (tens of seconds per frame).
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
OUT = ROOT / "data" / "derived" / "_diff"
MODEL = "stabilityai/sd-turbo"
SIZE = 256
STRENGTHS = [0.3, 0.45, 0.6, 0.75, 0.9]  # frame 0 is the original; then increasing regeneration
STEPS = 8  # scheduler steps; img2img runs round(strength*STEPS) of them, so keep strength*STEPS >= 1


def main() -> None:
    import torch
    from diffusers import AutoPipelineForImage2Image

    torch.manual_seed(0)
    pipe = AutoPipelineForImage2Image.from_pretrained(MODEL, torch_dtype=torch.float32, safety_checker=None)
    if torch.cuda.is_available():
        pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)
    OUT.mkdir(parents=True, exist_ok=True)

    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    args = ap.parse_args()
    all_ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name]
    ids = args.ids if args.ids else all_ids

    done = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        src = Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        d = OUT / img_id
        d.mkdir(parents=True, exist_ok=True)
        src.save(d / "00.png")  # frame 0 = the original
        for i, s in enumerate(STRENGTHS, start=1):
            gen = torch.Generator("cpu").manual_seed(0)
            out = pipe(prompt="", image=src, strength=s, num_inference_steps=STEPS, guidance_scale=0.0, generator=gen)
            out.images[0].save(d / f"{i:02d}.png")
        frames = 1 + len(STRENGTHS)
        done.append({"id": img_id, "frames": frames})
        print(f"  {img_id:<24} {frames} frames (img2img strengths {STRENGTHS})")

    prev = []
    ip = OUT / "index.json"
    if ip.exists():
        prevdoc = json.loads(ip.read_text())
        prev = prevdoc.get("images", [])
    by_id = {e["id"]: e for e in prev}
    for e in done:
        by_id[e["id"]] = e
    images = [by_id[i] for i in all_ids if i in by_id]
    ip.write_text(json.dumps({"model": MODEL, "kind": "img2img", "strengths": STRENGTHS, "images": images}), encoding="utf-8")
    print(f"baked img2img strips for {len(done)} images; {len(images)} total")


if __name__ == "__main__":
    main()
