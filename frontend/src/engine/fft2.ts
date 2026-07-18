// 2D FFT of an image via fft.js (row-column separable), plus the coefficient operations the Fourier tab
// exposes: log-magnitude spectrum (fftshifted), per-coefficient gain masks, top-k nonlinear approximation,
// and magnitude/phase mixing (the Oppenheim-Lim phase-carries-structure demonstration).
// fft.js: FFT(size) needs size a power of two; complex arrays are interleaved [re,im,...] of length 2*size;
// inverseTransform divides by size, so the two-axis inverse yields the correct 1/(W*H) (guarded by the
// round-trip test: ifft2(fft2(x)) == x to > 100 dB PSNR).
import FFT from 'fft.js';
import type { ImagePlanes } from './image';
import { channels, isPow2, withChannels } from './image';

export interface Complex2D {
  re: Float32Array;
  im: Float32Array;
  w: number;
  h: number;
}

export function fft2(plane: Float32Array, w: number, h: number): Complex2D {
  if (!isPow2(w) || !isPow2(h)) throw new Error(`fft2 needs power-of-two dims, got ${w}x${h}`);
  const re = new Float32Array(w * h);
  const im = new Float32Array(w * h);
  re.set(plane);
  const fx = new FFT(w);
  const rowIn = fx.createComplexArray();
  const rowOut = fx.createComplexArray();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rowIn[2 * x] = re[y * w + x];
      rowIn[2 * x + 1] = im[y * w + x];
    }
    fx.transform(rowOut, rowIn);
    for (let x = 0; x < w; x++) {
      re[y * w + x] = rowOut[2 * x];
      im[y * w + x] = rowOut[2 * x + 1];
    }
  }
  const fy = new FFT(h);
  const colIn = fy.createComplexArray();
  const colOut = fy.createComplexArray();
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      colIn[2 * y] = re[y * w + x];
      colIn[2 * y + 1] = im[y * w + x];
    }
    fy.transform(colOut, colIn);
    for (let y = 0; y < h; y++) {
      re[y * w + x] = colOut[2 * y];
      im[y * w + x] = colOut[2 * y + 1];
    }
  }
  return { re, im, w, h };
}

export function ifft2(c: Complex2D): Float32Array {
  const { w, h } = c;
  const re = c.re.slice();
  const im = c.im.slice();
  const fy = new FFT(h);
  const colIn = fy.createComplexArray();
  const colOut = fy.createComplexArray();
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      colIn[2 * y] = re[y * w + x];
      colIn[2 * y + 1] = im[y * w + x];
    }
    fy.inverseTransform(colOut, colIn);
    for (let y = 0; y < h; y++) {
      re[y * w + x] = colOut[2 * y];
      im[y * w + x] = colOut[2 * y + 1];
    }
  }
  const fx = new FFT(w);
  const rowIn = fx.createComplexArray();
  const rowOut = fx.createComplexArray();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rowIn[2 * x] = re[y * w + x];
      rowIn[2 * x + 1] = im[y * w + x];
    }
    fx.inverseTransform(rowOut, rowIn);
    for (let x = 0; x < w; x++) out[y * w + x] = rowOut[2 * x];
  }
  return out;
}

/** log(1 + |F|) with DC recentred (fftshift), for the heatmap. */
export function logMagnitudeShifted(c: Complex2D): Float32Array {
  const { w, h } = c;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x + (w >> 1)) % w;
      const sy = (y + (h >> 1)) % h;
      const i = sy * w + sx;
      out[y * w + x] = Math.log(1 + Math.hypot(c.re[i], c.im[i]));
    }
  }
  return out;
}

export type CoeffMask = (u: number, v: number, mag: number) => number;

/** Apply a per-coefficient gain. u,v are UNSHIFTED indices (0 = DC). */
export function applyMask(c: Complex2D, mask: CoeffMask): Complex2D {
  const { w, h } = c;
  const re = new Float32Array(w * h);
  const im = new Float32Array(w * h);
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const i = v * w + u;
      const g = mask(u, v, Math.hypot(c.re[i], c.im[i]));
      re[i] = c.re[i] * g;
      im[i] = c.im[i] * g;
    }
  }
  return { re, im, w, h };
}

/** Signed radial frequency of coefficient (u,v), in cycles/image, with wraparound to [-N/2, N/2). */
export function radialFreq(u: number, v: number, w: number, h: number): number {
  const du = u <= w / 2 ? u : u - w;
  const dv = v <= h / 2 ? v : v - h;
  return Math.hypot(du, dv);
}

/** Keep the largest `frac` fraction of coefficients by magnitude (nonlinear approximation). */
export function keepTopFraction(c: Complex2D, frac: number): Complex2D {
  const n = c.w * c.h;
  const mags = new Float32Array(n);
  for (let i = 0; i < n; i++) mags[i] = Math.hypot(c.re[i], c.im[i]);
  const keep = Math.max(1, Math.round(frac * n));
  const sorted = Float32Array.from(mags).sort();
  const thresh = sorted[n - keep];
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++)
    if (mags[i] >= thresh) {
      re[i] = c.re[i];
      im[i] = c.im[i];
    }
  return { re, im, w: c.w, h: c.h };
}

/** Magnitude-only / phase-only reconstruction of one channel (the phase-carries-structure demo). */
export function magPhaseMix(a: Complex2D, mode: 'both' | 'mag' | 'phase'): Complex2D {
  const n = a.w * a.h;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const mag = Math.hypot(a.re[i], a.im[i]);
    const ph = Math.atan2(a.im[i], a.re[i]);
    if (mode === 'both') {
      re[i] = a.re[i];
      im[i] = a.im[i];
    } else if (mode === 'mag') {
      re[i] = mag; // phase set to 0
      im[i] = 0;
    } else {
      re[i] = Math.cos(ph); // unit magnitude
      im[i] = Math.sin(ph);
    }
  }
  return { re, im, w: a.w, h: a.h };
}

// --- RGB wrappers: transform every channel, apply an op, invert ---
export function fft2Image(p: ImagePlanes): Complex2D[] {
  return channels(p).map((ch) => fft2(ch, p.w, p.h));
}

export function reconstructImage(p: ImagePlanes, specs: Complex2D[], op: (c: Complex2D) => Complex2D): ImagePlanes {
  return withChannels(
    p,
    specs.map((c) => ifft2(op(c))),
  );
}
