# Changelog

All notable changes to ImageLab. Format: `X.XX.XXX` (display), see `imglab.__version__`. Keep `0.x` while
the lab is under construction. Tag every release.

## [Unreleased]

## [0.01.000] - 2026-07-18

First full build: one image written across the spectrum of mathematical representations, deployed to
GitHub Pages.

### Added
- Eleven representation tabs, each a live or replay workbench with an in-tab Method sub-tab (theory,
  KaTeX, citations): Fourier, DCT (JPEG), wavelet (Haar/db2/db4/CDF97), KLT/PCA, overcomplete frames +
  sparse dictionaries (live OMP), geometric primitives, implicit neural field (SIREN), symbolic/CPPN,
  Fourier-descriptor epicycles, learned VAE latents, and diffusion.
- Live in-browser engines (TypeScript + WebGL2): the FFT, block DCT, wavelet lifting, orthogonal matching
  pursuit, and the SIREN/CPPN forward pass as fragment shaders. Offline bakes (`imglab.methods`): patch
  KLT basis, sparse dictionaries, per-image SIREN training, Stable Diffusion VAE latent walks, SD-Turbo
  diffusion strips, greedy primitive fits.
- Real measured cross-family benchmark on the Experiments and Benchmark pages: rate-distortion curves, a
  fixed-budget fidelity table, and an editability-locality metric (KLT/wavelet local-exact ~1.0 vs
  Fourier/DCT global ~0.16-0.23). Shared PSNR/SSIM/MS-SSIM between Python and TypeScript.
- In-app architecture modal (ADR-0058) with four theme-aware SVG diagrams.

### Changed
- Cut the archetype example engine (SIR) over to the image engine (`imglab`): removed the reference model,
  cases, SIR pipeline stages and baked cases; deleted the `.template-source` sentinel (arming the residue
  guard); repointed the CI smoke and artifact check at the image pipeline; rewrote the placeholder docs.

### Deployment
- Deployed as a static site to GitHub Pages, custom domain `imglab.fasl-work.com` (base `./`, 404 SPA
  fallback, committed derived artifacts as the deploy inputs).
