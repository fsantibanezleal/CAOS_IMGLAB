# Changelog

All notable changes to ImageLab. Format: `X.XX.XXX` (display), see `imglab.__version__`. Keep `0.x` while
the lab is under construction. Tag every release.

## [Unreleased]

## [0.03.000] - 2026-07-18

The equations become visible: the image-to-parametric-equation promise is now shown, not just claimed.

### Added
- Symbolic tab, "Written equation" sub-tab: the ACTUAL fitted closed-form equation of the selected image with
  its real coefficients (amplitude-phase form, per channel R/G/B), plus a download of the complete formula
  (all 512 terms of all three channels) as plain text.
- Epicycles tab, "The equation" sub-tab: the ACTUAL parametric equation of the traced contour, z(t) as a sum
  of rotating circles with their real amplitudes, signed frequencies and phases, following the harmonics
  slider, plus a download of every kept term.
- Primitives Method: the differentiable-vectorization reference (Li et al. 2020, diffvg).

### Fixed
- Purged the stale old-demo language everywhere it survived the per-image overhaul: the architecture modal
  (offline-bake diagram + bodies now name the equation fit, per-image VAE strips and img2img), the methods
  wiki (sections 5-7 rewritten), the data-contract README (adds _sym and _bench, corrects _vae/_diff to the
  per-image schema), the pipeline README, and the Implementation and Methodology pages.

## [0.02.000] - 2026-07-18

Every representation now operates on the selected image, across the whole 18-image set (was a hand-picked
subset or canned demos). Selecting an image in the left column drives every tab.

### Changed
- Primitives: bounding-box greedy search, 1200 ellipses per image, fitted for all 18 (mean PSNR 21.9 -> 30.0).
- Neural field (SIREN): trained for all 18 images (was 6).
- Epicycles: trace the selected image's own contour (Otsu silhouette -> largest component -> boundary trace ->
  Fourier descriptors) instead of hardcoded preset shapes; the math-art figures are selectable in the left column.
- Symbolic/CPPN: replaced the random-formula generator with a genuine per-image fit, each image written as a
  closed-form trigonometric equation (random-Fourier-feature ridge regression, 512 terms), evaluated live in a
  WebGL2 shader, for all 18.
- Learned latents (VAE): per-image reconstruction + latent-perturbation strip (was fixed image pairs).
- Diffusion: per-image SD-Turbo image-to-image regeneration at increasing strength (was fixed text prompts).
- Benchmark refreshed: Primitives 32.0 dB (1200 shapes), plus the Symbolic-equation and per-image VAE rows.

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
