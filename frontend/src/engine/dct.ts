// Block DCT-II (JPEG-style): forward transform per NxN block, quantize with a quality-scaled table,
// zig-zag keep, dequantize, inverse. The only lossy step is quantization; the quality slider is the rate
// knob. 8x8 is JPEG (ITU-T T.81 luminance table); 4 and 16 are teaching block sizes.
import { clamp01 } from './image';

function dctMatrix(N: number): Float32Array {
  const m = new Float32Array(N * N);
  for (let k = 0; k < N; k++) {
    const a = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    for (let n = 0; n < N; n++) m[k * N + n] = a * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
  }
  return m;
}

// Standard JPEG Annex K.1 luminance quantization table (ITU-T T.81).
export const JPEG_LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

/** libjpeg quality scaling (1..100) -> scaled 8x8 table, clamped [1,255]. */
export function scaledQTable(quality: number): number[] {
  const q = Math.max(1, Math.min(100, quality));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return JPEG_LUMA_Q.map((v) => Math.max(1, Math.min(255, Math.floor((v * s + 50) / 100))));
}

export function buildZigZag(N: number): number[] {
  const order: number[] = [];
  for (let s = 0; s < 2 * N - 1; s++) {
    const cells: [number, number][] = [];
    for (let y = 0; y <= s; y++) {
      const x = s - y;
      if (x < N && y < N) cells.push([x, y]);
    }
    if (s % 2 === 0) cells.reverse();
    for (const [x, y] of cells) order.push(y * N + x);
  }
  return order;
}
export const ZIGZAG8 = buildZigZag(8);

// resample the 8x8 quant table to NxN by nearest-neighbour (N=8 is exact).
function resampleQ(q8: number[], N: number): number[] {
  if (N === 8) return q8;
  const out = new Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const sy = Math.min(7, Math.floor((y * 8) / N));
      const sx = Math.min(7, Math.floor((x * 8) / N));
      out[y * N + x] = q8[sy * 8 + sx];
    }
  return out;
}

// C = A (NxN) * B (NxN)
function mm(A: Float32Array, B: Float32Array, N: number, C: Float32Array): void {
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += A[i * N + k] * B[k * N + j];
      C[i * N + j] = s;
    }
}
// C = A^T (NxN) * B (NxN)
function mmT(A: Float32Array, B: Float32Array, N: number, C: Float32Array): void {
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += A[k * N + i] * B[k * N + j];
      C[i * N + j] = s;
    }
}

export interface DctOpts {
  quality: number;
  keepZig?: number; // keep the first keepZig zig-zag coefficients per block
  blockSize?: number; // 4 | 8 | 16
}

/** JPEG-style forward+quantize+dequantize+inverse of ONE plane. */
export function jpegPlane(plane: Float32Array, w: number, h: number, opts: DctOpts): { recon: Float32Array; keptCoeffs: number } {
  const N = opts.blockSize ?? 8;
  const M = dctMatrix(N);
  const Q = N === 8 ? scaledQTable(opts.quality) : resampleQ(scaledQTable(opts.quality), N);
  const zig = N === 8 ? ZIGZAG8 : buildZigZag(N);
  const keepZig = opts.keepZig ?? N * N;
  const recon = new Float32Array(w * h);
  const blk = new Float32Array(N * N);
  const tmp = new Float32Array(N * N);
  const coeff = new Float32Array(N * N);
  let kept = 0;
  for (let by = 0; by + N <= h; by += N)
    for (let bx = 0; bx + N <= w; bx += N) {
      // JPEG 8-bit level shift: work in [-128,127] so the standard quant table Q applies at the right scale.
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) blk[y * N + x] = (plane[(by + y) * w + (bx + x)] - 0.5) * 255;
      mm(M, blk, N, tmp); // tmp = M * blk
      mmT_right(tmp, M, N, coeff); // coeff = tmp * M^T
      for (let i = 0; i < N * N; i++) coeff[i] = Math.round(coeff[i] / Q[i]) * Q[i]; // quantize + dequantize
      for (let s = keepZig; s < N * N; s++) coeff[zig[s]] = 0; // zig-zag keep
      for (let i = 0; i < N * N; i++) if (coeff[i] !== 0) kept++;
      mmT(M, coeff, N, tmp); // tmp = M^T * coeff
      mm(tmp, M, N, blk); // blk = tmp * M
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) recon[(by + y) * w + (bx + x)] = clamp01(blk[y * N + x] / 255 + 0.5);
    }
  return { recon, keptCoeffs: kept };
}

// C = A (NxN) * B^T (NxN)
function mmT_right(A: Float32Array, B: Float32Array, N: number, C: Float32Array): void {
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += A[i * N + k] * B[j * N + k];
      C[i * N + j] = s;
    }
}

/** Exact round-trip (no quantization, no keep) for the sanity test. */
export function dctRoundTripPlane(plane: Float32Array, w: number, h: number, N = 8): Float32Array {
  const M = dctMatrix(N);
  const out = new Float32Array(w * h);
  const blk = new Float32Array(N * N);
  const tmp = new Float32Array(N * N);
  const coeff = new Float32Array(N * N);
  for (let by = 0; by + N <= h; by += N)
    for (let bx = 0; bx + N <= w; bx += N) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) blk[y * N + x] = plane[(by + y) * w + (bx + x)] - 0.5;
      mm(M, blk, N, tmp);
      mmT_right(tmp, M, N, coeff);
      mmT(M, coeff, N, tmp);
      mm(tmp, M, N, blk);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[(by + y) * w + (bx + x)] = blk[y * N + x] + 0.5;
    }
  return out;
}

/** The 64 (or NxN) DCT-II basis tiles, each normalized to [0,1], for the gallery. */
export function dctBasisTiles(N = 8): Float32Array[] {
  const M = dctMatrix(N);
  const tiles: Float32Array[] = [];
  for (let ky = 0; ky < N; ky++)
    for (let kx = 0; kx < N; kx++) {
      const tile = new Float32Array(N * N);
      let mn = Infinity;
      let mx = -Infinity;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const v = M[ky * N + y] * M[kx * N + x];
          tile[y * N + x] = v;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      const range = mx - mn || 1;
      for (let i = 0; i < tile.length; i++) tile[i] = (tile[i] - mn) / range;
      tiles.push(tile);
    }
  return tiles;
}
