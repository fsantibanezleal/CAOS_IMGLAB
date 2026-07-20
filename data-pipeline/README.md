# data-pipeline/, the offline engine (`imglab`)

The single source of algorithm truth for the offline bakes. `frontend/` consumes the committed artifacts and
recomputes the live representations from scratch; it never re-implements the offline math. The package has its
own environment, `.venv-pipeline` (the classical bakes plus the heavy learned engines, local-only).

## Layout (the package lives directly under `data-pipeline/`)

- `imglab/pipeline.py`, the bake orchestrator + CLI (`python -m imglab.pipeline [images|light|heavy|all]`)
- `imglab/imageset.py`, build the curated image set (procedural generators + fetch the licensed real subset)
- `imglab/gen/synthetic.py`, the procedural, CC0 image generators (control scenes + math art)
- `imglab/io/image.py`, Contract 1 (ingestion: the license allowlist + deterministic load to working planes)
- `imglab/core/metrics.py`, the fidelity measures (PSNR, SSIM, MS-SSIM) shared verbatim with the frontend
- `imglab/methods/`, one module per representation bake:
  - `klt_basis.py`, the patch KLT/PCA basis
  - `dictionaries.py`, the learned + overcomplete-DCT sparse dictionaries
  - `inr_train.py`, train a small SIREN per image and export its weights
  - `primitives_fit.py`, the greedy translucent-ellipse fit
  - `symbolic_fit.py`, fit each image as a closed-form trigonometric equation (random Fourier features)
  - `vae_latents.py`, per-image Stable-Diffusion-VAE reconstruction + latent-perturbation strip
  - `diffusion_strips.py`, per-image SD-Turbo image-to-image regeneration at increasing strength
  - `benchmark.py`, the measured cross-family fidelity + editability-locality numbers
- `imglab/stages/fetch_images.py`, download the licensed real image subset (the only network step)

The classical bakes (`images`, `light`) need only `requirements.txt` and run in CI; the learned bakes (`heavy`)
need `requirements-precompute.txt` (torch, diffusers) and run locally. Setup + run: `scripts/setup.{sh,ps1}` then
`scripts/precompute.{sh,ps1} <group>`. Architecture: [../docs/architecture/01_overview.md](../docs/architecture/01_overview.md).
