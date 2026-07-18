# data-pipeline/, the offline engine (`examplelab`)

Rename `examplelab` → `<slug>lab` per product. The **single source of physics/algorithm truth**; `frontend/` and
`app/` consume it, never re-implement it. Its own venv: **`.venv-pipeline`** (heavy SOTA engines, local-only).

## Layout (the package lives directly under `data-pipeline/`)
- `examplelab/pipeline.py`, orchestrator + CLI (`python -m examplelab.pipeline [all|<case>] [--seed N]`)
- `examplelab/registry.py`, cases grouped by CATEGORY · `examplelab/live.py`, Pyodide live entrypoint
- `examplelab/io/`, `contract.py` (**CONTRACT 1**) · `formats.py` (standard readers/writers) · `schema.py` (types)
- `examplelab/core/`, `rng.py` (seeded determinism) · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py`
- `examplelab/model/`, the shared pure-Python core (Pyodide-safe); EXAMPLE = SIR
- `examplelab/stages/`, `preprocess → feature_extraction → train → infer → evaluate → export`
- `examplelab/cases/`, documented cases

Setup + run: `scripts/setup.{sh,ps1}` then `scripts/precompute.{sh,ps1}`. See
[../docs/architecture/05_precompute-pipeline.md](../docs/architecture/05_precompute-pipeline.md).
