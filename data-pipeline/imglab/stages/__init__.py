"""Pipeline stages that need network or a heavy dependency, kept out of the pure method modules.

fetch_images.py downloads the licensed real-world subset of the curated image set (the only network
step); the deterministic representation bakes live in imglab.methods and are driven by imglab.pipeline.
"""
