"""Bake diffusion strips with a real small diffusion model (SD-Turbo). A denoising trajectory (the reverse
process, decoding the intermediate latents at each step) and a prompt-interpolation walk (the text embedding
is interpolated between two prompts). The live tab scrubs these frames: the image emerging from noise, and
morphing between prompts. Semantic but entangled. CPU-feasible but slow (tens of seconds per image).

    python -m imglab.methods.diffusion_strips

Downloads SD-Turbo (~2.5 GB) to the Hugging Face cache on first run (HF_HOME on a large disk).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault("HF_HOME", "E:/_Temp/hf")

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "derived" / "_diff"
MODEL = "stabilityai/sd-turbo"
STEPS = 8
PROMPT_A = "a lighthouse on a rocky coast, dramatic sky, oil painting"
PROMPT_B = "a colorful macaw parrot, lush jungle, vivid"


def main() -> None:
    import torch
    from diffusers import AutoPipelineForText2Image

    torch.manual_seed(0)
    pipe = AutoPipelineForText2Image.from_pretrained(MODEL, torch_dtype=torch.float32, safety_checker=None)
    pipe.set_progress_bar_config(disable=True)
    vae = pipe.vae
    sf = vae.config.scaling_factor
    OUT.mkdir(parents=True, exist_ok=True)

    def decode_latent(lat):
        with torch.no_grad():
            img = vae.decode(lat / sf).sample
        arr = ((img[0].permute(1, 2, 0).clamp(-1, 1) + 1) / 2).numpy()
        return (np.clip(arr, 0, 1) * 255).astype(np.uint8)

    # --- 1) denoising trajectory: capture the decoded latent at each reverse step ---
    tdir = OUT / "denoise"
    tdir.mkdir(parents=True, exist_ok=True)
    traj = []

    def cb(pipe_, step, timestep, kw):
        traj.append(kw["latents"].detach().clone())
        return kw

    _ = pipe(PROMPT_B, num_inference_steps=STEPS, guidance_scale=0.0, height=256, width=256, callback_on_step_end=cb)
    for i, lat in enumerate(traj):
        Image.fromarray(decode_latent(lat)).save(tdir / f"{i:02d}.png")
    print(f"  denoise trajectory: {len(traj)} frames")

    # --- 2) prompt-interpolation walk: interpolate the text embeddings between two prompts ---
    wdir = OUT / "promptwalk"
    wdir.mkdir(parents=True, exist_ok=True)
    n = 9
    for i in range(n):
        t = i / (n - 1)
        with torch.no_grad():
            ea, _ = pipe.encode_prompt(PROMPT_A, device="cpu", num_images_per_prompt=1, do_classifier_free_guidance=False)
            eb, _ = pipe.encode_prompt(PROMPT_B, device="cpu", num_images_per_prompt=1, do_classifier_free_guidance=False)
            emb = (1 - t) * ea + t * eb
            gen = torch.Generator("cpu").manual_seed(0)
            out = pipe(prompt_embeds=emb, num_inference_steps=4, guidance_scale=0.0, height=256, width=256, generator=gen)
        out.images[0].save(wdir / f"{i:02d}.png")
    print(f"  prompt walk: {n} frames")

    (OUT / "index.json").write_text(
        json.dumps(
            {
                "model": MODEL,
                "strips": [
                    {"id": "denoise", "kind": "denoise", "frames": len(traj), "prompt": PROMPT_B},
                    {"id": "promptwalk", "kind": "promptwalk", "frames": n, "a": PROMPT_A, "b": PROMPT_B},
                ],
            }
        ),
        encoding="utf-8",
    )
    print(f"baked diffusion strips with {MODEL}")


if __name__ == "__main__":
    main()
