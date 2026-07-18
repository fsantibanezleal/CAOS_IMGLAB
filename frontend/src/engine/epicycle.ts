// Fourier descriptors of a closed contour: sample the boundary as complex points z_n, take their DFT
// c_k = (1/N) sum_n z_n e^{-i 2 pi k n / N}, and redraw the truncated partial sum as a chain of rotating
// circles (epicycles). This is the one genuinely exact "outline to equation" case (Zahn-Roskies 1972).
import FFT from 'fft.js';
import type { ImagePlanes } from './image';
import { luma } from './image';

const N = 256; // contour sample count (power of two for fft.js)

export interface Term {
  freq: number; // signed frequency
  re: number;
  im: number;
  mag: number;
}

export interface Contour {
  pts: Float32Array; // interleaved [x0,y0,x1,y1,...] in [-1,1], length 2N
  terms: Term[]; // Fourier descriptors, sorted by descending magnitude
}

// --- preset parametric contours (the classic epicycle demo shapes) ---
export type PresetName = 'heart' | 'star' | 'flower' | 'spiralish' | 'infinity';
export const PRESETS: PresetName[] = ['heart', 'star', 'flower', 'spiralish', 'infinity'];

function presetPoint(name: PresetName, t: number): [number, number] {
  switch (name) {
    case 'heart':
      return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
    case 'star': {
      const k = 5;
      const r = 1 + 0.5 * Math.cos(k * t);
      return [r * Math.cos(t), r * Math.sin(t)];
    }
    case 'flower': {
      const r = Math.cos(3 * t);
      return [r * Math.cos(t), r * Math.sin(t)];
    }
    case 'spiralish': {
      const r = 0.3 + 0.7 * (t / (2 * Math.PI));
      return [r * Math.cos(3 * t), r * Math.sin(3 * t)];
    }
    case 'infinity':
      return [Math.cos(t), Math.sin(2 * t) / 2];
  }
}

function normalizePoints(raw: number[]): Float32Array {
  // center + scale to [-1,1]
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < raw.length; i += 2) {
    cx += raw[i];
    cy += raw[i + 1];
  }
  cx /= raw.length / 2;
  cy /= raw.length / 2;
  let mx = 1e-9;
  for (let i = 0; i < raw.length; i += 2) mx = Math.max(mx, Math.abs(raw[i] - cx), Math.abs(raw[i + 1] - cy));
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 2) {
    out[i] = (raw[i] - cx) / mx;
    out[i + 1] = (raw[i + 1] - cy) / mx;
  }
  return out;
}

function descriptorsFrom(pts: Float32Array): Term[] {
  const fft = new FFT(N);
  const inp = fft.createComplexArray();
  const out = fft.createComplexArray();
  for (let n = 0; n < N; n++) {
    inp[2 * n] = pts[2 * n];
    inp[2 * n + 1] = pts[2 * n + 1];
  }
  fft.transform(out, inp);
  const terms: Term[] = [];
  for (let k = 0; k < N; k++) {
    const freq = k <= N / 2 ? k : k - N; // map to [-N/2, N/2)
    const re = out[2 * k] / N;
    const im = out[2 * k + 1] / N;
    terms.push({ freq, re, im, mag: Math.hypot(re, im) });
  }
  terms.sort((a, b) => b.mag - a.mag);
  return terms;
}

export function presetContour(name: PresetName): Contour {
  const raw: number[] = [];
  for (let n = 0; n < N; n++) {
    const t = (2 * Math.PI * n) / N;
    const [x, y] = presetPoint(name, t);
    raw.push(x, -y); // flip y for image coordinates
  }
  const pts = normalizePoints(raw);
  return { pts, terms: descriptorsFrom(pts) };
}

/** Trace a closed contour from the selected image by radial sampling of the foreground silhouette. */
export function traceContour(planes: ImagePlanes): Contour | null {
  const { w, h } = planes;
  const y = luma(planes);
  // binarize at the mean; take the darker OR lighter side as foreground, whichever is the minority (the shape)
  let mean = 0;
  for (let i = 0; i < y.length; i++) mean += y[i];
  mean /= y.length;
  let below = 0;
  for (let i = 0; i < y.length; i++) if (y[i] < mean) below++;
  const fgIsDark = below <= y.length / 2;
  const isFg = (i: number) => (fgIsDark ? y[i] < mean : y[i] >= mean);
  // centroid of foreground
  let cx = 0;
  let cy = 0;
  let cnt = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (isFg(j * w + i)) {
        cx += i;
        cy += j;
        cnt++;
      }
  if (cnt < 50) return null;
  cx /= cnt;
  cy /= cnt;
  const maxR = Math.hypot(w, h);
  const raw: number[] = [];
  for (let n = 0; n < N; n++) {
    const ang = (2 * Math.PI * n) / N;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let boundary = 0;
    for (let r = 1; r < maxR; r += 1) {
      const px = Math.round(cx + dx * r);
      const py = Math.round(cy + dy * r);
      if (px < 0 || py < 0 || px >= w || py >= h) break;
      if (isFg(py * w + px)) boundary = r;
    }
    raw.push(cx + dx * boundary, cy + dy * boundary);
  }
  const pts = normalizePoints(raw);
  return { pts, terms: descriptorsFrom(pts) };
}

/** The reconstructed contour path (K harmonics), as [x0,y0,...] in [-1,1]. */
export function reconstructPath(terms: Term[], k: number, samples = 720): Float32Array {
  const kept = terms.slice(0, Math.max(1, k));
  const out = new Float32Array(samples * 2);
  for (let s = 0; s < samples; s++) {
    const t = (2 * Math.PI * s) / samples;
    let x = 0;
    let y = 0;
    for (const term of kept) {
      const a = term.freq * t;
      const c = Math.cos(a);
      const si = Math.sin(a);
      x += term.re * c - term.im * si;
      y += term.re * si + term.im * c;
    }
    out[2 * s] = x;
    out[2 * s + 1] = y;
  }
  return out;
}

/** The epicycle chain (cumulative partial sums) at phase t, for K harmonics: centers + the drawing tip. */
export function epicycleChain(terms: Term[], k: number, t: number): { cx: number; cy: number; r: number }[] {
  const kept = terms.slice(0, Math.max(1, k));
  const chain: { cx: number; cy: number; r: number }[] = [];
  let x = 0;
  let y = 0;
  for (const term of kept) {
    chain.push({ cx: x, cy: y, r: term.mag });
    const a = term.freq * t;
    x += term.re * Math.cos(a) - term.im * Math.sin(a);
    y += term.re * Math.sin(a) + term.im * Math.cos(a);
  }
  chain.push({ cx: x, cy: y, r: 0 }); // the drawing tip
  return chain;
}
