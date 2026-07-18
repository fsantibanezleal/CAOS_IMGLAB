// The generative latent pole, applied to the SELECTED image: a real pretrained VAE (Stable Diffusion
// autoencoder) encodes the image, decodes it back (frame 0, the reconstruction) and decodes increasing
// latent perturbations (frames 1..K). Running a VAE is too heavy for the browser, so the strip is baked
// offline per image and scrubbed here: the selected image drifts to plausible but globally different
// pictures, the semantic-but-entangled edit.
import { APP_VERSION } from '../lib/version';

export interface VaeEntry {
  id: string;
  frames: number;
  psnr: number;
}

export async function loadVaeIndex(): Promise<{ images: VaeEntry[]; size: number; vae: string; maxNoise: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_vae/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`VAE index unavailable (${res.status})`);
  return res.json();
}

export function vaeFrameUrl(imageId: string, i: number): string {
  return `${import.meta.env.BASE_URL}data/_vae/${imageId}/${String(i).padStart(2, '0')}.png?v=${APP_VERSION}`;
}
