"""imglab, the offline + live engine for ImageLab (ADR-0057).

ImageLab represents one image across the full spectrum of mathematical representations (orthonormal
transforms, overcomplete frames + sparse dictionaries, geometric primitives, implicit neural fields,
symbolic formula art, generative latents) and bakes compact, standard-format artifacts the SPA replays,
so a user can edit each representation's parameters and see when the image stays meaningful and when it
collapses into noise.

The two data contracts, the staged pipeline, the lane gate and the manifest/trace are the FROZEN base
(ADR-0057); the per-representation engines are the rework surface.
"""

__version__ = "0.00.000"  # display X.XX.XXX; PEP 440 form in pyproject.toml (0.0.0)
