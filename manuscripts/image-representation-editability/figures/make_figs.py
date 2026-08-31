"""Deterministically generate the benchmark figure for the ImageLab paper from the committed
benchmark artifact (data/derived/_bench/index.json). Every number is read from the JSON.
Run with the figures venv (matplotlib). Outputs vector PDFs next to this file."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
BENCH = HERE.parents[2] / "data" / "derived" / "_bench" / "index.json"
BLUE, ORANGE, GREEN, GRAY, INK = "#2b6cb0", "#c05621", "#2f855a", "#718096", "#1a202c"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": "#4a5568", "axes.linewidth": 0.8})


def fig_benchmark():
    d = json.loads(BENCH.read_text(encoding="utf-8"))
    budget = d["budget"]; loc = d["locality"]
    fams = [b["family"] for b in budget]; psnr = [b["psnr"] for b in budget]
    # colour by pole: designed-structure (local) green, transforms/entangled middle gray, learned blue
    designed = {"Wavelet", "KLT (patch)", "Primitives", "Gabor atoms", "Gaussian mixture"}
    learned = {"Neural field (INR)", "VAE latent"}
    cols = [GREEN if f in designed else (BLUE if f in learned else GRAY) for f in fams]

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.1, 3.4), gridspec_kw={"width_ratios": [2.0, 1.0]})
    order = sorted(range(len(fams)), key=lambda i: psnr[i])
    a1.barh([fams[i] for i in order], [psnr[i] for i in order], color=[cols[i] for i in order], zorder=3)
    for y, i in enumerate(order):
        a1.text(psnr[i] + 0.15, y, f"{psnr[i]:.1f}", va="center", fontsize=7, color=INK)
    a1.set_xlabel("PSNR at a fixed parameter budget (dB)"); a1.set_xlim(24, 37)
    a1.set_title("Fidelity is comparable across families", fontsize=9)
    a1.tick_params(axis="y", labelsize=7)
    from matplotlib.patches import Patch
    a1.legend(handles=[Patch(color=GREEN, label="designed-structure (local)"),
                       Patch(color=GRAY, label="global / entangled"),
                       Patch(color=BLUE, label="learned-manifold")], fontsize=6.4, loc="lower right")

    lf = [x["family"] for x in loc]; lc = [x["concentration"] for x in loc]
    lcol = [GRAY if v < 0.5 else GREEN for v in lc]
    a2.bar(range(len(lf)), lc, color=lcol, zorder=3)
    for i, v in enumerate(lc):
        a2.text(i, v + 0.02, f"{v:.2f}", ha="center", fontsize=7.5, color=INK)
    a2.set_xticks(range(len(lf))); a2.set_xticklabels(lf, rotation=30, fontsize=7, ha="right")
    a2.set_ylim(0, 1.12); a2.set_ylabel("editability-locality")
    a2.set_title("but editability differs", fontsize=9)
    for a in (a1, a2):
        for s in ("top", "right"):
            a.spines[s].set_visible(False)
    fig.suptitle("Equal-budget fidelity does not distinguish representations; editability does", fontsize=9.4)
    fig.tight_layout(rect=[0, 0, 1, 0.95]); fig.savefig(HERE / "fig-benchmark.pdf"); plt.close(fig)


if __name__ == "__main__":
    fig_benchmark()
    print("figures written:", [p.name for p in sorted(HERE.glob('*.pdf'))])
