// Fidelity metrics, identical in formula to the offline Python (data-pipeline/imglab/core/metrics.py).
// Operate on ImagePlanes in [0,1]. PSNR on RGB MSE; SSIM (Wang et al. 2004, DOI 10.1109/TIP.2003.819861)
// on luma with an 11x11 Gaussian window; MS-SSIM (Wang et al. 2003) over 5 scales. Sanity: SSIM(x,x)=1,
// PSNR(x,x)=Infinity, and a 1-LSB (1/255) uniform shift gives PSNR ~= 48.13 dB.
import type { ImagePlanes } from './image';
import { luma } from './image';

export function mse(a: ImagePlanes, b: ImagePlanes): number {
  const n = a.w * a.h;
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += (a.r[i] - b.r[i]) ** 2 + (a.g[i] - b.g[i]) ** 2 + (a.b[i] - b.b[i]) ** 2;
  }
  return s / (n * 3);
}

export function psnr(a: ImagePlanes, b: ImagePlanes): number {
  const m = mse(a, b);
  if (m <= 0) return Infinity;
  return 10 * Math.log10(1 / m); // MAX = 1 for [0,1] data
}

// --- separable Gaussian blur (reflect padding) on a single channel ---
function gaussKernel(sigma: number, radius: number): Float32Array {
  const k = new Float32Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

const reflect = (i: number, n: number): number => {
  if (i < 0) return -i - 1 < n ? -i - 1 : 0;
  if (i >= n) return 2 * n - i - 1 >= 0 ? 2 * n - i - 1 : n - 1;
  return i;
};

function blur(src: Float32Array, w: number, h: number, k: Float32Array, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = -radius; t <= radius; t++) s += k[t + radius] * src[y * w + reflect(x + t, w)];
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = -radius; t <= radius; t++) s += k[t + radius] * tmp[reflect(y + t, h) * w + x];
      out[y * w + x] = s;
    }
  }
  return out;
}

/** Mean SSIM on the luma channel with an 11x11 Gaussian (sigma 1.5). Returns a value in (-1, 1]. */
export function ssim(a: ImagePlanes, b: ImagePlanes): number {
  if (a.w !== b.w || a.h !== b.h) throw new Error('ssim: size mismatch');
  const w = a.w;
  const h = a.h;
  const ya = luma(a);
  const yb = luma(b);
  const radius = 5;
  const k = gaussKernel(1.5, radius);
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;

  const muA = blur(ya, w, h, k, radius);
  const muB = blur(yb, w, h, k, radius);
  const n = w * h;
  const yaa = new Float32Array(n);
  const ybb = new Float32Array(n);
  const yab = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    yaa[i] = ya[i] * ya[i];
    ybb[i] = yb[i] * yb[i];
    yab[i] = ya[i] * yb[i];
  }
  const sAA = blur(yaa, w, h, k, radius);
  const sBB = blur(ybb, w, h, k, radius);
  const sAB = blur(yab, w, h, k, radius);

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const ma = muA[i];
    const mb = muB[i];
    const va = sAA[i] - ma * ma;
    const vb = sBB[i] - mb * mb;
    const cov = sAB[i] - ma * mb;
    const num = (2 * ma * mb + C1) * (2 * cov + C2);
    const den = (ma * ma + mb * mb + C1) * (va + vb + C2);
    sum += num / den;
  }
  return sum / n;
}

// contrast-structure term only (for MS-SSIM intermediate scales)
function csMap(ya: Float32Array, yb: Float32Array, w: number, h: number): number {
  const radius = 5;
  const k = gaussKernel(1.5, radius);
  const C2 = 0.03 ** 2;
  const muA = blur(ya, w, h, k, radius);
  const muB = blur(yb, w, h, k, radius);
  const n = w * h;
  const yaa = new Float32Array(n);
  const ybb = new Float32Array(n);
  const yab = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    yaa[i] = ya[i] * ya[i];
    ybb[i] = yb[i] * yb[i];
    yab[i] = ya[i] * yb[i];
  }
  const sAA = blur(yaa, w, h, k, radius);
  const sBB = blur(ybb, w, h, k, radius);
  const sAB = blur(yab, w, h, k, radius);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const va = sAA[i] - muA[i] * muA[i];
    const vb = sBB[i] - muB[i] * muB[i];
    const cov = sAB[i] - muA[i] * muB[i];
    sum += (2 * cov + C2) / (va + vb + C2);
  }
  return sum / n;
}

function downsample2(y: Float32Array, w: number, h: number): { y: Float32Array; w: number; h: number } {
  const w2 = w >> 1;
  const h2 = h >> 1;
  const out = new Float32Array(w2 * h2);
  for (let j = 0; j < h2; j++) {
    for (let i = 0; i < w2; i++) {
      const x = 2 * i;
      const yy = 2 * j;
      out[j * w2 + i] = 0.25 * (y[yy * w + x] + y[yy * w + x + 1] + y[(yy + 1) * w + x] + y[(yy + 1) * w + x + 1]);
    }
  }
  return { y: out, w: w2, h: h2 };
}

const MSSSIM_WEIGHTS = [0.0448, 0.2856, 0.3001, 0.2363, 0.1333];

/** MS-SSIM over 5 scales; needs at least ~176px on the short side, else falls back to single-scale SSIM. */
export function msSsim(a: ImagePlanes, b: ImagePlanes): number {
  if (Math.min(a.w, a.h) < 176) return ssim(a, b);
  let ya = luma(a);
  let yb = luma(b);
  let w = a.w;
  let h = a.h;
  let prod = 1;
  for (let s = 0; s < 5; s++) {
    if (s < 4) {
      const cs = Math.max(1e-8, csMap(ya, yb, w, h));
      prod *= Math.pow(cs, MSSSIM_WEIGHTS[s]);
      const da = downsample2(ya, w, h);
      const db = downsample2(yb, w, h);
      ya = da.y;
      yb = db.y;
      w = da.w;
      h = da.h;
    } else {
      // final scale: full luminance-contrast-structure SSIM
      const planesA: ImagePlanes = { r: ya, g: ya, b: ya, w, h };
      const planesB: ImagePlanes = { r: yb, g: yb, b: yb, w, h };
      const last = Math.max(1e-8, ssim(planesA, planesB));
      prod *= Math.pow(last, MSSSIM_WEIGHTS[s]);
    }
  }
  return prod;
}
