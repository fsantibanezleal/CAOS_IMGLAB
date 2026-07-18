#!/usr/bin/env bash
# Run the offline bakes (pass-through group). E.g.:  ./scripts/precompute.sh images   |   ./scripts/precompute.sh all
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-pipeline/bin/python"; [ -x "$VP" ] || VP=".venv-pipeline/Scripts/python.exe"
"$VP" -m imglab.pipeline "$@"
