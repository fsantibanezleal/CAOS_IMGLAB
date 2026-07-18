# Docs, the ImageLab wiki

A navigable wiki (ADR-0056), authored as the product is built. The offline pipeline plus these docs are the
primary product; the web app is the interactive projection of them.

## Map

- [architecture/](architecture/), how the repo works: the lanes (offline bake, live compute, replay), the two
  data contracts, and the editability thesis the tabs are ordered to demonstrate.
- [methods/](methods/), one section per representation family: what it is, the equations, what a parameter
  perturbation does, and the primary references. The same theory is transcribed into each tab's in-app Method
  sub-tab.
- [cases/](cases/), the curated image set: the category taxonomy and which representations each image exercises.

## The thesis in one line

Editability is U-shaped. It peaks at the designed-structure pole (transforms, sparse dictionaries, geometric
primitives), where a parameter is a local exact handle, and at the learned-manifold pole (VAE, diffusion latents),
where a parameter is a semantic but entangled handle; between the poles a parameter perturbation just adds noise.

## Honesty + data policy

- Every number comes from the committed artifacts or a live computation in the page, never from a claim. The
  learned representations are labelled baked-not-live where they are replayed rather than computed on your exact
  image.
- Only compact derived artifacts are committed (`data/derived/`); raw/private inputs stay out of git per ADR-0055.
  The two data contracts (`data/README.md`) govern ingestion and the pipeline-to-web artifacts.
