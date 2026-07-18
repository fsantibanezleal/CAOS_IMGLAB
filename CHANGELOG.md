# Changelog

All notable changes to ImageLab. Format: `X.XX.XXX` (display), see `imglab.__version__`. Keep `0.x` while
the lab is under construction. Tag every release.

## [Unreleased]

### Added
- Instantiated from the CAOS product-repo archetype (ADR-0057): the offline `data-pipeline/` (`imglab`),
  the two data contracts (ingestion + artifact), the named staged pipeline, the seeded RNG, the compact
  trace, the manifest, and the measured live-vs-precompute gate.
- ImageLab identity: product README (the spectrum-of-representations thesis and the U-shaped-editability
  finding), MIT license, versioning reset to `0.00.000`.

### Notes
- The repository transiently carries the archetype reference engine until the image-representation engines
  (transforms, frames, primitives, neural fields, symbolic, generative) replace it on the build task
  branches. Each representation ships code + tests + deep docs in the same unit.
