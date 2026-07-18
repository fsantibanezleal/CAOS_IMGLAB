// 2D discrete wavelet transform, live. Orthogonal families (Haar, db2, db4) via a periodic filter bank,
// and CDF 9/7 (JPEG2000 biorthogonal) via the lifting scheme; both are exact inverses. Separable per level:
// transform every row, then every column, then recurse on the LL quadrant (Mallat layout). The point of
// the tab: wavelet coefficients are space-and-scale LOCALIZED, so editing one changes a bounded region at
// one scale (unlike the global Fourier/DCT ripple).
export type WaveletName = 'haar' | 'db2' | 'db4' | 'cdf97';

const HAAR = [Math.SQRT1_2, Math.SQRT1_2];
const H: Record<'haar' | 'db2' | 'db4', number[]> = {
  haar: HAAR,
  db2: [0.48296291314469025, 0.836516303737469, 0.22414386804185735, -0.12940952255092145],
  db4: [
    0.23037781330885523, 0.7148465705525415, 0.6308807679295904, -0.02798376941698385, -0.18703481171888114,
    0.030841381835986965, 0.032883011666982945, -0.010597401784997278,
  ],
};

// quadrature mirror high-pass from the low-pass taps
function qmf(h: number[]): number[] {
  return h.map((_, k) => (k % 2 === 0 ? 1 : -1) * h[h.length - 1 - k]);
}

// one orthogonal analysis level with PERIODIC boundary -> [approx | detail], each length n/2
function dwtOrtho(sig: Float32Array, h: number[]): Float32Array {
  const n = sig.length;
  const half = n >> 1;
  const g = qmf(h);
  const L = h.length;
  const out = new Float32Array(n);
  for (let i = 0; i < half; i++) {
    let sa = 0;
    let sd = 0;
    for (let k = 0; k < L; k++) {
      const idx = (2 * i + k) % n;
      sa += h[k] * sig[idx];
      sd += g[k] * sig[idx];
    }
    out[i] = sa;
    out[half + i] = sd;
  }
  return out;
}

function idwtOrtho(coeffs: Float32Array, h: number[]): Float32Array {
  const n = coeffs.length;
  const half = n >> 1;
  const g = qmf(h);
  const L = h.length;
  const out = new Float32Array(n);
  for (let i = 0; i < half; i++) {
    const a = coeffs[i];
    const d = coeffs[half + i];
    for (let k = 0; k < L; k++) {
      const idx = (2 * i + k) % n;
      out[idx] += h[k] * a + g[k] * d;
    }
  }
  return out;
}

// --- CDF 9/7 lifting (Daubechies-Sweldens) ---
const CA = -1.586134342059924;
const CB = -0.052980118572961;
const CG = 0.882911075530934;
const CD = 0.443506852043971;
const CK = 1.230174104914001;

function reflect(i: number, n: number): number {
  // whole-sample symmetric reflection
  if (i < 0) return -i;
  if (i >= n) return 2 * n - 2 - i;
  return i;
}

function cdf97Fwd(x: Float32Array): Float32Array {
  const n = x.length;
  const s = (i: number) => x[reflect(i, n)];
  for (let i = 1; i < n - 1; i += 2) x[i] += CA * (s(i - 1) + s(i + 1));
  x[n - 1] += 2 * CA * s(n - 2);
  for (let i = 2; i < n; i += 2) x[i] += CB * (s(i - 1) + s(i + 1));
  x[0] += 2 * CB * s(1);
  for (let i = 1; i < n - 1; i += 2) x[i] += CG * (s(i - 1) + s(i + 1));
  x[n - 1] += 2 * CG * s(n - 2);
  for (let i = 2; i < n; i += 2) x[i] += CD * (s(i - 1) + s(i + 1));
  x[0] += 2 * CD * s(1);
  // scale then deinterleave into [approx (even) | detail (odd)]
  const half = n >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < half; i++) {
    out[i] = x[2 * i] / CK;
    out[half + i] = x[2 * i + 1] * CK;
  }
  return out;
}

function cdf97Inv(coeffs: Float32Array): Float32Array {
  const n = coeffs.length;
  const half = n >> 1;
  const x = new Float32Array(n);
  for (let i = 0; i < half; i++) {
    x[2 * i] = coeffs[i] * CK;
    x[2 * i + 1] = coeffs[half + i] / CK;
  }
  const s = (i: number) => x[reflect(i, n)];
  for (let i = 2; i < n; i += 2) x[i] -= CD * (s(i - 1) + s(i + 1));
  x[0] -= 2 * CD * s(1);
  for (let i = 1; i < n - 1; i += 2) x[i] -= CG * (s(i - 1) + s(i + 1));
  x[n - 1] -= 2 * CG * s(n - 2);
  for (let i = 2; i < n; i += 2) x[i] -= CB * (s(i - 1) + s(i + 1));
  x[0] -= 2 * CB * s(1);
  for (let i = 1; i < n - 1; i += 2) x[i] -= CA * (s(i - 1) + s(i + 1));
  x[n - 1] -= 2 * CA * s(n - 2);
  return x;
}

function transform1D(sig: Float32Array, name: WaveletName): Float32Array {
  return name === 'cdf97' ? cdf97Fwd(sig.slice()) : dwtOrtho(sig, H[name]);
}
function inverse1D(coeffs: Float32Array, name: WaveletName): Float32Array {
  return name === 'cdf97' ? cdf97Inv(coeffs) : idwtOrtho(coeffs, H[name]);
}

export interface Dwt2 {
  data: Float32Array; // Mallat-packed coefficients, size w*h
  w: number;
  h: number;
  levels: number;
  name: WaveletName;
}

/** Forward 2D DWT (separable, `levels` deep on the LL quadrant). w,h must be divisible by 2^levels. */
export function dwt2(plane: Float32Array, w: number, h: number, name: WaveletName, levels: number): Dwt2 {
  const data = plane.slice();
  let cw = w;
  let ch = h;
  const row = (len: number) => new Float32Array(len);
  for (let lvl = 0; lvl < levels; lvl++) {
    // rows
    const r = row(cw);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) r[x] = data[y * w + x];
      const tr = transform1D(r, name);
      for (let x = 0; x < cw; x++) data[y * w + x] = tr[x];
    }
    // columns
    const c = row(ch);
    for (let x = 0; x < cw; x++) {
      for (let y = 0; y < ch; y++) c[y] = data[y * w + x];
      const tc = transform1D(c, name);
      for (let y = 0; y < ch; y++) data[y * w + x] = tc[y];
    }
    cw >>= 1;
    ch >>= 1;
  }
  return { data, w, h, levels, name };
}

export function idwt2(t: Dwt2): Float32Array {
  const { data, w, h, levels, name } = t;
  const out = data.slice();
  const sizes: [number, number][] = [];
  let cw = w >> levels;
  let ch = h >> levels;
  for (let lvl = 0; lvl < levels; lvl++) {
    cw <<= 1;
    ch <<= 1;
    sizes.push([cw, ch]);
  }
  for (const [lw, lh] of sizes) {
    // inverse columns then rows for this level region (lw x lh)
    const c = new Float32Array(lh);
    for (let x = 0; x < lw; x++) {
      for (let y = 0; y < lh; y++) c[y] = out[y * w + x];
      const ic = inverse1D(c, name);
      for (let y = 0; y < lh; y++) out[y * w + x] = ic[y];
    }
    const r = new Float32Array(lw);
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) r[x] = out[y * w + x];
      const ir = inverse1D(r, name);
      for (let x = 0; x < lw; x++) out[y * w + x] = ir[x];
    }
  }
  return out;
}

/** True on a detail coefficient (anything outside the final LL quadrant). */
function isDetail(x: number, y: number, w: number, h: number, levels: number): boolean {
  return x >= w >> levels || y >= h >> levels;
}

/** Soft or hard threshold of the detail coefficients (the denoise/compress control). Returns a new Dwt2. */
export function subbandThreshold(t: Dwt2, tau: number, mode: 'soft' | 'hard'): Dwt2 {
  const { data, w, h, levels } = t;
  const out = data.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!isDetail(x, y, w, h, levels)) continue;
      const i = y * w + x;
      const v = out[i];
      if (Math.abs(v) < tau) out[i] = 0;
      else if (mode === 'soft') out[i] = v - Math.sign(v) * tau;
    }
  return { ...t, data: out };
}

/** Keep the largest `frac` fraction of coefficients by magnitude (nonlinear approximation, for R-D). */
export function keepTopFractionDwt(t: Dwt2, frac: number): Dwt2 {
  const n = t.w * t.h;
  const mags = Float32Array.from(t.data, Math.abs).sort();
  const keep = Math.max(1, Math.round(frac * n));
  const thresh = mags[n - keep];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) if (Math.abs(t.data[i]) >= thresh) out[i] = t.data[i];
  return { ...t, data: out };
}

/** A viewable [0,1] field of the coefficient magnitudes (log-scaled) for the subband map. */
export function coeffField(t: Dwt2): Float32Array {
  const out = new Float32Array(t.w * t.h);
  let mx = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.log(1 + Math.abs(t.data[i]));
    if (out[i] > mx) mx = out[i];
  }
  if (mx > 0) for (let i = 0; i < out.length; i++) out[i] /= mx;
  return out;
}
