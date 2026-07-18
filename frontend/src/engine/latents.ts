// The generative pole, baked offline: latent walks decoded from a real pretrained VAE (Stable Diffusion
// autoencoder). Encoding and decoding a VAE is too heavy for the browser, so the tab replays committed
// frames. The walks show latent-space interpolation (smooth, plausible blends through a learned manifold)
// and latent perturbation (semantic but entangled: the whole image drifts).
import { APP_VERSION } from '../lib/version';

export interface VaeWalk {
  id: string;
  kind: 'interpolate' | 'perturb';
  a: string;
  b?: string;
  frames: number;
}

export async function loadVaeIndex(): Promise<{ walks: VaeWalk[]; size: number; vae: string }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_vae/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`VAE walks unavailable (${res.status})`);
  return res.json();
}

export function frameUrl(walkId: string, i: number): string {
  return `${import.meta.env.BASE_URL}data/_vae/${walkId}/${String(i).padStart(2, '0')}.png?v=${APP_VERSION}`;
}
