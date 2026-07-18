"""Orchestrate the ImageLab offline bakes: the procedural image set and every representation's derived
artifacts. Each method is independently runnable (python -m imglab.methods.<name>); this driver runs a
named group. The learned bakes (INR, VAE, diffusion) need torch and the precompute requirements, so they
are opt-in and never run in CI.

    python -m imglab.pipeline images    # regenerate the procedural image set (numpy + Pillow, no network)
    python -m imglab.pipeline light     # images + KLT basis + dictionaries + primitives (classical, no torch)
    python -m imglab.pipeline heavy     # INR + VAE + diffusion (needs torch + network + precompute reqs)
    python -m imglab.pipeline all       # light + heavy

The committed artifacts under data/derived/ ARE the deployable inputs; this driver reproduces them. The
web build reads the committed artifacts, it does not run this pipeline.
"""
from __future__ import annotations

import json
import sys


def run_images() -> None:
    """Regenerate the procedural images, preserving any previously fetched licensed real subset."""
    from imglab import imageset

    gen = imageset.generate()
    idx_path = imageset.IMAGES / "index.json"
    real: list[dict] = []
    if idx_path.exists():
        prev = json.loads(idx_path.read_text(encoding="utf-8"))
        real = [e for e in prev.get("images", []) if e.get("kind") == "real"]
    imageset.write_index(gen + real)


def _method(name: str) -> None:
    import importlib

    mod = importlib.import_module(f"imglab.methods.{name}")
    print(f"--- {name} ---")
    mod.main()


LIGHT = ["klt_basis", "dictionaries", "primitives_fit"]
HEAVY = ["inr_train", "vae_latents", "diffusion_strips"]

GROUPS = {
    "images": lambda: run_images(),
    "light": lambda: (run_images(), [_method(m) for m in LIGHT]),
    "heavy": lambda: [_method(m) for m in HEAVY],
    "all": lambda: (run_images(), [_method(m) for m in LIGHT + HEAVY]),
}


def main() -> int:
    group = sys.argv[1] if len(sys.argv) > 1 else "images"
    if group not in GROUPS:
        print(f"unknown group '{group}'. choose one of: {', '.join(GROUPS)}")
        return 2
    GROUPS[group]()
    print(f"pipeline '{group}': done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
