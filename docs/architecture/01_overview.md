# Architecture, overview

ImageLab is an instance of the CAOS product-repo archetype (ADR-0057): offline-pipeline-heavy, backend-optional,
deploying as a static viewer. It represents one image across the full spectrum of mathematical representations and
lets you edit each representation's parameters to see when the image stays meaningful and when it collapses into
noise. Some representations are cheap enough to compute live in the browser; the learned ones are baked offline and
replayed.

## The lanes (and what runs where)

| Lane | Where | Deps | Notes |
|---|---|---|---|
| Offline (precompute) | `data-pipeline/` (`imglab`), `.venv-pipeline` | `requirements.txt` + `requirements-precompute.txt` | bakes the committed artifacts (KLT basis, dictionaries, INR weights, primitive fits, VAE walks, diffusion strips) |
| Live (client-side) | `frontend/src/engine` | none (TypeScript + WebGL2) | recompute in the page: FFT, block DCT, wavelet lifting, OMP sparse coding, the SIREN/CPPN forward pass on the GPU |
| Replay | `frontend/` | n/a | scrub the baked frames of the learned representations (VAE, diffusion) |

Each tab declares its lane. The transforms, frames, primitives and symbolic tabs are live (they read the ingested
image and compute in the browser); the neural-field tab is a hybrid (offline training, live GPU forward pass); the
latent and diffusion tabs are replay (offline decode, live scrub).

## The flow

An image enters through Contract 1 (`io/image.py`: the license allowlist for the curated set, or a runtime upload
that stays in the page). The offline bakes (`imglab.pipeline`) write compact per-representation artifacts under
`data/derived/`, governed by Contract 2 (a small index per group, mirrored by `frontend/src/lib/contract.types.ts`
and checked by `scripts/check_artifacts.py`). The frontend loads the committed artifacts for the replay tabs and
recomputes everything else live from the ingested image.

## The editability thesis

The tabs are ordered to trace a U-shaped curve of editability. At the designed-structure pole (transforms, sparse
dictionaries, geometric primitives) a parameter is a named, local, exact handle: perturb one and the image changes
predictably. At the learned-manifold pole (VAE and diffusion latents) a parameter is a semantic but entangled
handle: nudge it and the whole image drifts to another plausible image. Between the poles, a raw or densely-coded
parameter perturbation just produces noise. Every tab measures the same fidelity (PSNR/SSIM/MS-SSIM) so the poles
are comparable.

[ADR-0057]: ../../../conventions/architecture/0-archetype/ADR-0057-product-repo-archetype.md
