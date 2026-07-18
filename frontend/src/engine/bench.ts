// Load the committed cross-family benchmark (data/derived/_bench): the rate-distortion curves, the
// fixed-budget fidelity table and the measured editability-locality rows. Every number is baked from a real
// run by imglab.methods.benchmark, never asserted in the UI.
import { APP_VERSION } from '../lib/version';

export interface RdPoint {
  frac: number;
  psnr: number;
  ssim: number;
}
export interface BudgetRow {
  family: string;
  psnr: number;
  ssim: number | null;
  params: string;
  note: string;
}
export interface LocalityRow {
  family: string;
  concentration: number;
}
export interface Bench {
  images: string[];
  size: number;
  fracs: number[];
  rd: Record<string, RdPoint[]>;
  budget: BudgetRow[];
  locality: LocalityRow[];
}

export async function loadBench(): Promise<Bench> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_bench/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`benchmark unavailable (${res.status})`);
  return res.json();
}

// distinct mid-tone strokes, legible on both themes (canvas cannot resolve CSS vars)
export const RD_FAMILIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'fourier', label: 'Fourier', color: '#e0863a' },
  { key: 'dct', label: 'DCT', color: '#4a9ed6' },
  { key: 'wavelet', label: 'Wavelet', color: '#5cb85c' },
  { key: 'klt', label: 'KLT (patch)', color: '#b978d0' },
];
