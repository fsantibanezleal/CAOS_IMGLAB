"""imglab, the offline + live engine for ImageLab (ADR-0057).

ImageLab represents one image across the full spectrum of mathematical representations (orthonormal
transforms, overcomplete frames + sparse dictionaries, geometric primitives, implicit neural fields,
symbolic formula art, generative latents) and bakes compact, standard-format artifacts the SPA replays,
so a user can edit each representation's parameters and see when the image stays meaningful and when it
collapses into noise.

The package has two data contracts: ingestion (io.image loads a curated or uploaded image into working
planes under a license allowlist) and artifact (methods.* bake compact indices + arrays under
data/derived/, mirrored by the frontend contract types). imglab.pipeline drives the bakes.
"""

__version__ = "0.01.000"  # display X.XX.XXX; PEP 440 form in pyproject.toml
