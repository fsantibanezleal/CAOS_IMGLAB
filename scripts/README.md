# scripts/, environment + pipeline orchestration (cross-platform)

Local scripts so anyone can configure the environment and run the offline bakes. Each is provided in both
`*.sh` (macOS/Linux/Git-Bash) and `*.ps1` (Windows PowerShell).

## The scripts

| Script | What it does |
|---|---|
| `setup.sh` / `setup.ps1` | create `.venv-pipeline`, upgrade pip, install `requirements.txt` (classical bakes) plus `requirements-dev.txt`; the heavy learned bakes install `requirements-precompute.txt` on demand. |
| `precompute.sh` / `precompute.ps1` | run the offline bakes: `python -m imglab.pipeline <group>` where the group is `images`, `light`, `heavy`, or `all`. |
| `fetch-data.sh` / `fetch-data.ps1` | (optional) stage raw inputs into `data/raw/` (git-ignored). Never commit raw. |

The bakes are grouped by cost: `images` (numpy + Pillow, no network), `light` (adds the KLT basis, sparse
dictionaries and primitive fits, still no torch), `heavy` (INR training, the VAE latent walks and the diffusion
strips, needs `requirements-precompute.txt` and network), and `all`. The committed artifacts under
`data/derived/` are the deployable inputs; the web build reads them and never runs this pipeline.

Rules: idempotent; detect `.venv-pipeline/bin/python` vs `.venv-pipeline/Scripts/python.exe`; never use a global
Python/Node. Pin nothing here, versions live in `requirements-*.txt`.

## Guards (run in CI, kept local-runnable)

| Script | What it enforces |
|---|---|
| `check_artifacts.py` | Artifact contract: every committed derived index references files that exist and are non-empty, and no artifact under `data/derived/` is empty. |
| `check_template_residue.py` | An instantiated product must not ship archetype residue (the example lab, its baked cases, placeholder text). No-op in the archetype template while the `.template-source` sentinel exists; instantiation deletes the sentinel to arm it. See ADR-0057 / ADR-0061. |
| `check_content_standards.py` | No em-dash (`U+2014`/`U+2015`) and no pictographic emoji in tracked content. Always on. Use comma/colon/semicolon/period/parentheses/middot instead. See ADR-0067. |
