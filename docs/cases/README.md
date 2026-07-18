# Cases: the curated image set

The "cases" axis of ImageLab is a curated, license-clean image set that every representation tab reacts to.
It spans eight domains so each representation family has at least one image that makes its behaviour obvious.
The set is built by `imglab.imageset` (procedural generators, then a licensed fetch) and inventoried in
`data/images/index.json` (schema `imglab.imageset/v1`).

## Categories

| category | what it is | why it is here |
|---|---|---|
| `photo` | natural photographs | broadband frequency content; the general case |
| `art` | public-domain fine art | structured colour and edges; painterly detail |
| `math-art` | procedurally generated math figures | the symbolic and neural-field families |
| `biological` | cells and organisms | soft, self-similar structure (planned) |
| `microscopy` | microscope fields | fine repeated texture (planned) |
| `astronomy` | telescope imagery | sparse points on smooth backgrounds |
| `texture` | stochastic surfaces | the dictionary and frame families |
| `synthetic` | authored control scenes | the trivially-parametric primitive controls |

## Licensing policy (enforced by the ingestion contract)

Every bundled image carries an allowlisted, redistributable license with the attribution it demands. The
gate is `data-pipeline/imglab/io/image.py` (the `BUNDLE` policy). Allowlisted: CC0-1.0, public domain, MIT,
CC-BY-4.0 and CC-BY-3.0 (attribution required), the Kodak unrestricted-use suite, the Unsplash License, and
NASA/STScI public domain (credit requested). A user-uploaded image in the live tabs uses the `RUNTIME`
policy: license-exempt (it is the user's own image, processed in the browser, never redistributed), but
still validated for format, size and colour.

Hard-rejected, never bundled (documented so the reason is legible): the Lena image (retired by USC-SIPI,
IEEE-banned from 2024-04-01), Brodatz textures (Dover copyright), and WikiArt (non-commercial, mixed
copyright). Standard benchmark sets (DTD, DIV2K, Set5/14, BSD100, Urban100, ImageNet, the Olshausen patches)
are referenced and linked on the Experiments and Benchmark pages, never redistributed here.

## The procedural generators (CC0 by construction)

`data-pipeline/imglab/gen/synthetic.py`, deterministic and CPU-instant:

- `synthetic-checkerboard`: a hard checkerboard, near-pure frequency content for the transform tabs.
- `synthetic-gradient`: a smooth radial gradient, low frequency, exposes neural-field spectral bias.
- `synthetic-polygons`: an occluded circle-plus-triangle scene, the trivially-parametric primitive control.
- `mathart-julia`: a smooth-coloured Julia set, the chaotic-regime symbolic case (sensitive to c).
- `mathart-warpnoise`: a domain-warped noise field, the smooth-regime symbolic case (morphs continuously).
- `mathart-harmonograph`: a damped Lissajous curve, a purely parametric line drawing.
- `mathart-rose`: a rhodonea (rose) curve r = cos(k*theta).
- `mathart-epicycle`: a heart contour rebuilt from the largest coefficients of its own Fourier descriptor,
  drawn with the nested epicycle circles (Zahn and Roskies 1972, DOI 10.1109/TC.1972.5008949).

## Reproduce

```
.venv-pipeline/Scripts/python -m imglab.imageset build            # generators + licensed fetch (network)
.venv-pipeline/Scripts/python -m imglab.imageset build --gen-only  # the procedural images only (offline)
```

The fetch pins each real image to its provider-reported license and sha256 in `data/images/sources.lock.json`,
so provenance comes from the source, not from this document. A source that fails to resolve is logged and
skipped; the set is extensible by adding entries to `data-pipeline/sources.yaml` (biological and microscopy
sources are the current gap and are added there when a reliable, redistributable URL is confirmed).
