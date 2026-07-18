// The narrative generative pole, baked offline with a real small diffusion model (SD-Turbo). Running a
// diffusion UNet in the browser is too heavy, so the tab replays committed frames: a denoising trajectory
// (the reverse process, the image emerging from noise step by step) and a prompt-interpolation walk (the
// text embedding is interpolated between two prompts). Semantic but entangled.
import { APP_VERSION } from '../lib/version';

export interface DiffStrip {
  id: string;
  kind: 'denoise' | 'promptwalk';
  frames: number;
  prompt?: string;
  a?: string;
  b?: string;
}

export async function loadDiffIndex(): Promise<{ model: string; strips: DiffStrip[] }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_diff/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`diffusion strips unavailable (${res.status})`);
  return res.json();
}

export function diffFrameUrl(stripId: string, i: number): string {
  return `${import.meta.env.BASE_URL}data/_diff/${stripId}/${String(i).padStart(2, '0')}.png?v=${APP_VERSION}`;
}
