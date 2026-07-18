"""Train a tiny SIREN (Sitzmann et al. 2020) per representative image to fit f(x,y) -> RGB, and export the
weights for the live WebGL forward pass. The whole image becomes a compact coordinate network: the modern,
learnable descendant of hand-authored closed-form pixel art. CPU, a couple of minutes per image at 128px.

    python -m imglab.methods.inr_train            # a representative subset
    python -m imglab.methods.inr_train --all       # every curated image
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
IMAGES = ROOT / "data" / "images"
OUT = ROOT / "data" / "derived" / "_inr"
SIZE = 128
HIDDEN = 32
OMEGA0 = 30.0
STEPS = 1500
SEED = 0

# a representative subset spanning the families (smooth, textured, chaotic, structured)
SUBSET = [
    "synthetic-gradient",
    "mathart-julia",
    "photo_parrots",
    "art_greatwave",
    "tex_wood",
    "astro_pillars",
]


class Sine(nn.Module):
    def __init__(self, w0: float = 1.0):
        super().__init__()
        self.w0 = w0

    def forward(self, x):
        return torch.sin(self.w0 * x)


class Siren(nn.Module):
    def __init__(self, hidden: int = HIDDEN, omega0: float = OMEGA0):
        super().__init__()
        self.l0 = nn.Linear(2, hidden)
        self.l1 = nn.Linear(hidden, hidden)
        self.l2 = nn.Linear(hidden, hidden)
        self.out = nn.Linear(hidden, 3)
        self.omega0 = omega0
        with torch.no_grad():  # SIREN principled init
            self.l0.weight.uniform_(-1 / 2, 1 / 2)
            for layer in (self.l1, self.l2):
                b = np.sqrt(6 / hidden) / omega0
                layer.weight.uniform_(-b, b)
            self.out.weight.uniform_(-np.sqrt(6 / hidden) / omega0, np.sqrt(6 / hidden) / omega0)

    def forward(self, xy):
        h = torch.sin(self.omega0 * self.l0(xy))
        h = torch.sin(self.omega0 * self.l1(h))
        h = torch.sin(self.omega0 * self.l2(h))
        return torch.sigmoid(self.out(h))


def _coords(n: int) -> torch.Tensor:
    lin = torch.linspace(-1, 1, n)
    y, x = torch.meshgrid(lin, lin, indexing="ij")
    return torch.stack([x.reshape(-1), y.reshape(-1)], dim=1)


def train_one(img: np.ndarray) -> tuple[dict, float]:
    torch.manual_seed(SEED)
    xy = _coords(SIZE)
    target = torch.from_numpy(img.reshape(-1, 3).astype(np.float32))
    net = Siren()
    opt = torch.optim.Adam(net.parameters(), lr=2e-3)
    for step in range(STEPS):
        opt.zero_grad()
        pred = net(xy)
        loss = ((pred - target) ** 2).mean()
        loss.backward()
        opt.step()
    with torch.no_grad():
        mse = float(((net(xy) - target) ** 2).mean())
    psnr = 10 * np.log10(1 / mse) if mse > 0 else 99.0

    def w(layer):
        return [round(float(v), 5) for v in layer.weight.detach().numpy().ravel()]

    def b(layer):
        return [round(float(v), 5) for v in layer.bias.detach().numpy().ravel()]

    weights = {
        "hidden": HIDDEN,
        "omega0": OMEGA0,
        "layers": [
            {"w": w(net.l0), "b": b(net.l0), "in": 2, "out": HIDDEN},
            {"w": w(net.l1), "b": b(net.l1), "in": HIDDEN, "out": HIDDEN},
            {"w": w(net.l2), "b": b(net.l2), "in": HIDDEN, "out": HIDDEN},
            {"w": w(net.out), "b": b(net.out), "in": HIDDEN, "out": 3},
        ],
        "psnr": round(float(psnr), 2),
    }
    return weights, psnr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ids = [p.stem for p in sorted(IMAGES.glob("*.png")) if ".hi." not in p.name] if args.all else SUBSET
    trained = []
    for img_id in ids:
        f = IMAGES / f"{img_id}.png"
        if not f.exists():
            continue
        img = np.asarray(Image.open(f).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
        weights, psnr = train_one(img)
        (OUT / f"{img_id}.json").write_text(json.dumps(weights), encoding="utf-8")
        trained.append(img_id)
        print(f"  {img_id:<22} PSNR {psnr:5.2f} dB -> {(OUT / f'{img_id}.json').stat().st_size // 1024} KB")
    (OUT / "index.json").write_text(json.dumps({"trained": trained, "size": SIZE, "hidden": HIDDEN}), encoding="utf-8")
    print(f"trained {len(trained)} SIRENs")


if __name__ == "__main__":
    main()
