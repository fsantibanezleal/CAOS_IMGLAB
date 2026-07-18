# ImageLab

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_IMGLAB/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_IMGLAB/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_IMGLAB)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/fsantibanezleal/CAOS_IMGLAB?label=version&sort=semver)](https://github.com/fsantibanezleal/CAOS_IMGLAB/tags)

> **Status: under active construction.** The repository is being built vertically, one representation at a
> time (code + tests + deep docs per unit). It is instantiated from the CAOS product-repo archetype and
> currently still carries the archetype's reference engine while the image-representation engines are wired
> in. Live demo (planned): `imglab.fasl-work.com`.

A public research lab on a simple question with a rich answer: **how is one image written as mathematics,
and what happens when you edit that mathematics?**

An image is always a matrix, but it can be re-expressed in many ways: as a sum over a Fourier, cosine, or
wavelet basis (which is what compression does), as a sparse combination of atoms from an overcomplete
dictionary, as a handful of geometric primitives, as a small neural function f(x, y) to RGB, as an explicit
closed-form formula (the genre of parametric-equation art), or as a code in the latent space of a
generative model. ImageLab shows the SAME image under each of these representations, side by side, and lets
you move their parameters to see the central effect:

> **Editability is U-shaped across the abstraction spectrum.** It is high at two poles, the
> designed-structure pole (vector primitives, sparse atoms, where humans built local meaningful
> coordinates) and the learned-manifold pole (disentangled generative directions), and it collapses toward
> noise in between (perturb a raw neural-field weight or a constant of a brittle fitted formula, and the
> image falls apart). A parameter is both stable and meaningful only when it indexes a low-dimensional
> manifold of plausible images with locally disentangled coordinates.

## What it is (and is not)

- It IS an interactive, honest tour of image representations, with a real offline pipeline that bakes
  compact artifacts and a static web app that replays them and runs the light transforms live in the
  browser.
- It is NOT a claim that arbitrary photographs reduce to compact, faithful, human-readable equations (they
  do not; the app shows the genuine partial results and says so), and it is NOT a redistribution of anyone
  else's formula art (the explicit-formula genre is cited and linked; the formulas shown here are our own).

## Architecture (ADR-0057)

- `data-pipeline/imglab/` : the offline engine (staged, seeded, tested) that bakes each representation of
  each image into compact, standard-format artifacts + a manifest.
- `frontend/` : the static SPA (React + Vite + the shared CAOS app shell) that replays the artifacts and
  runs the light transforms (Fourier, cosine, wavelet, primitive rendering, coordinate-network and symbolic
  shaders) live in the browser.
- `app/` : a dormant FastAPI module (not needed; the product is static-first).
- `docs/` : the wiki (theory, equations, real references, figures), authored as the work proceeds.

## Quickstart

```bash
# 1. reproducible environment (.venv + pinned requirements)
./scripts/setup.sh                      # or scripts/setup.ps1 on Windows PowerShell
# 2. run the offline pipeline over the cases -> data/derived/ + manifests/
./scripts/precompute.sh                 # or scripts/precompute.ps1
# 3. the tests (determinism, both data contracts, the gate)
.venv/bin/python -m pytest
# 4. the web app consumes the artifacts and runs the live transforms
cd frontend && npm install && npm run dev
```

## License and attribution

MIT licensed. Developed by Felipe Santibanez-Leal. Every external dataset, engine and reference used by a
representation carries its own license and citation, recorded in `ATTRIBUTION.md`, `docs/`, and the app
footer. Standard test images with unclear or restrictive licenses are avoided in favor of public-domain and
permissively-licensed sources plus procedurally generated, license-clean images.
