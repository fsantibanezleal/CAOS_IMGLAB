// Diffusion applied to the SELECTED image: a real small diffusion model (SD-Turbo) regenerates the image
// with image-to-image at increasing strength. Frame 0 is the original; higher frames add more noise before
// denoising, so the learned prior re-imagines the picture more freely. Running a diffusion UNet is too heavy
// for the browser, so the per-image strip is baked offline and scrubbed here.
import { APP_VERSION } from '../lib/version';

export interface DiffEntry {
  id: string;
  frames: number;
}

export async function loadDiffIndex(): Promise<{ images: DiffEntry[]; model: string; strengths: number[] }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_diff/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`diffusion index unavailable (${res.status})`);
  return res.json();
}

export function diffFrameUrl(imageId: string, i: number): string {
  return `${import.meta.env.BASE_URL}data/_diff/${imageId}/${String(i).padStart(2, '0')}.png?v=${APP_VERSION}`;
}
