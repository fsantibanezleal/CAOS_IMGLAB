# Run the offline bakes (pass-through group). E.g.:  ./scripts/precompute.ps1 images   |   ./scripts/precompute.ps1 all
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-pipeline" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv-pipeline" "bin/python" }
& $vp -m imglab.pipeline @args
