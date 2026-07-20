// Fourier descriptors of the SELECTED image's own contour. The image is reduced to an edge/silhouette,
// its dominant closed boundary is traced (Otsu threshold -> largest connected component -> Moore-neighbour
// boundary following), sampled as complex points z_n, and transformed: c_k = (1/N) sum_n z_n e^{-i 2 pi k n / N}.
// The truncated partial sum is redrawn as a chain of rotating circles (epicycles). This is the one genuinely
// exact "outline to equation" case (Zahn-Roskies 1972), applied to whatever image is selected, not a canned shape.
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
  fill: number; // fraction of the frame the traced silhouette covers (diagnostic)
}

function normalizePoints(raw: number[]): Float32Array {
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

/** Otsu threshold of a luma buffer (0..1): the split value that maximizes between-class variance. */
function otsu(y: Float32Array): number {
  const bins = 64;
  const hist = new Float64Array(bins);
  for (let i = 0; i < y.length; i++) hist[Math.min(bins - 1, Math.max(0, Math.floor(y[i] * bins)))]++;
  const total = y.length;
  let sum = 0;
  for (let b = 0; b < bins; b++) sum += b * hist[b];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = b;
    }
  }
  return (best + 0.5) / bins;
}

/** Largest 4-connected component of a binary mask, returned as a new mask. */
function largestComponent(bin: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  for (let s = 0; s < w * h; s++) {
    if (bin[s] === 0 || label[s] !== -1) continue;
    let size = 0;
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const yy = (p - x) / w;
      if (x > 0 && bin[p - 1] && label[p - 1] === -1) ((label[p - 1] = id), stack.push(p - 1));
      if (x < w - 1 && bin[p + 1] && label[p + 1] === -1) ((label[p + 1] = id), stack.push(p + 1));
      if (yy > 0 && bin[p - w] && label[p - w] === -1) ((label[p - w] = id), stack.push(p - w));
      if (yy < h - 1 && bin[p + w] && label[p + w] === -1) ((label[p + w] = id), stack.push(p + w));
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }
  const out = new Uint8Array(w * h);
  if (bestId >= 0) for (let s = 0; s < w * h; s++) out[s] = label[s] === bestId ? 1 : 0;
  return out;
}

/** Moore-neighbour boundary tracing (clockwise) of a filled binary component. Returns ordered [x,y,...]. */
function traceBoundary(mask: Uint8Array, w: number, h: number): number[] {
  let start = -1;
  for (let s = 0; s < w * h && start < 0; s++) if (mask[s]) start = s;
  if (start < 0) return [];
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const nb = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ]; // 8-neighbours clockwise from left
  const sx = start % w;
  const sy = (start - sx) / w;
  const pts: number[] = [sx, sy];
  let cx = sx;
  let cy = sy;
  let backdir = 0;
  const maxSteps = 8 * (w + h);
  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dir = (backdir + i) % 8;
      const nx = cx + nb[dir][0];
      const ny = cy + nb[dir][1];
      if (at(nx, ny)) {
        cx = nx;
        cy = ny;
        pts.push(cx, cy);
        backdir = (dir + 6) % 8;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy && pts.length > 4) break;
  }
  return pts;
}

/** Resample an ordered closed polyline to exactly n points by arc length. */
function resampleClosed(pts: number[], n: number): number[] {
  const m = pts.length / 2;
  if (m < 3) return pts;
  const seg: number[] = [0];
  let total = 0;
  for (let i = 1; i < m; i++) {
    total += Math.hypot(pts[2 * i] - pts[2 * (i - 1)], pts[2 * i + 1] - pts[2 * (i - 1) + 1]);
    seg.push(total);
  }
  total += Math.hypot(pts[0] - pts[2 * (m - 1)], pts[1] - pts[2 * (m - 1) + 1]);
  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (j < m - 1 && seg[j + 1] < d) j++;
    const d0 = seg[j];
    const d1 = j < m - 1 ? seg[j + 1] : total;
    const f = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
    const a = j;
    const b = (j + 1) % m;
    out.push(pts[2 * a] + f * (pts[2 * b] - pts[2 * a]), pts[2 * a + 1] + f * (pts[2 * b + 1] - pts[2 * a + 1]));
  }
  return out;
}

/** Extract the dominant closed contour of the SELECTED image and its Fourier descriptors. */
export function imageContour(planes: ImagePlanes): Contour | null {
  const { w, h } = planes;
  const y = luma(planes);
  const thr = otsu(y);
  let below = 0;
  for (let i = 0; i < y.length; i++) if (y[i] < thr) below++;
  const fgDark = below <= y.length / 2; // foreground = the minority side (the subject, not the field)
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < y.length; i++) bin[i] = (fgDark ? y[i] < thr : y[i] >= thr) ? 1 : 0;
  const comp = largestComponent(bin, w, h);
  let fill = 0;
  for (let i = 0; i < comp.length; i++) fill += comp[i];
  fill /= comp.length;
  const boundary = traceBoundary(comp, w, h);
  if (boundary.length < 8) return null;
  const res = resampleClosed(boundary, N);
  const raw: number[] = [];
  for (let i = 0; i < res.length; i += 2) raw.push(res[i], -res[i + 1]); // flip y for display
  const pts = normalizePoints(raw);
  return { pts, terms: descriptorsFrom(pts), fill };
}

const e2 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(2);
const e3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the ACTUAL parametric equation of the traced contour: the top `n` of the k kept epicycles. */
export function epicycleEquationTex(terms: Term[], k: number, n = 6): string {
  const kept = terms.slice(0, Math.max(1, k));
  const parts: string[] = [`z(t) = {} &`];
  kept.slice(0, n).forEach((term, i) => {
    const phase = Math.atan2(term.im, term.re);
    const ph = phase >= 0 ? `+${e2(phase)}` : e2(phase);
    const lead = i === 0 ? '' : '+\\;';
    const sep = i > 0 && i % 2 === 0 ? ' \\\\ &' : i === 0 ? '' : ' ';
    parts.push(`${sep}${lead}${e3(term.mag)}\\,e^{i(${term.freq}t${ph})}`);
  });
  const rest = kept.length - Math.min(n, kept.length);
  if (rest > 0) parts.push(` \\\\ & +\\;\\cdots\\;(${rest}\\ \\text{more circles})`);
  return `\\begin{aligned}${parts.join('')}\\end{aligned}`;
}

/** The COMPLETE parametric equation of the traced contour as plain text (all k kept epicycles). */
export function epicycleEquationText(terms: Term[], k: number, imageId: string): string {
  const kept = terms.slice(0, Math.max(1, k));
  const out: string[] = [
    `ImageLab, the exact parametric contour equation of "${imageId}"`,
    `model: z(t) = sum_k A_k * exp(i*(f_k*t + phi_k)), t in [0, 2*pi); x(t)=Re z, y(t)=Im z`,
    `kept epicycles: ${kept.length} of ${terms.length} Fourier descriptors (sorted by amplitude)`,
    ``,
    `z(t) =`,
  ];
  for (const term of kept) {
    const phase = Math.atan2(term.im, term.re);
    out.push(`  + ${term.mag.toFixed(5)} * exp(i*(${term.freq}*t + ${phase.toFixed(4)}))`);
  }
  return out.join('\n');
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
