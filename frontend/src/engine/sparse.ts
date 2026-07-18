// Live sparse coding against a shipped overcomplete dictionary via Orthogonal Matching Pursuit (OMP). The
// image is tiled into 8x8 patches; each mean-subtracted patch is coded with at most T atoms and rebuilt as
// x = mean + D a. An overcomplete dictionary has more atoms than dimensions, so the same image can be
// written as a sparse combination in more than one "alphabet" (the dictionary-swap demonstration).
import { APP_VERSION } from '../lib/version';

export interface Dictionary {
  patch: number;
  nAtoms: number;
  kind: string;
  atoms: number[][]; // nAtoms x (patch*patch), unit-norm
}

export interface PreparedDict {
  flat: Float32Array; // nAtoms * d
  nAtoms: number;
  d: number;
  patch: number;
}

export async function loadDictionary(name: 'learned' | 'overdct'): Promise<Dictionary> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_dict/${name}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`dictionary '${name}' unavailable (${res.status})`);
  return (await res.json()) as Dictionary;
}

export function prepareDict(dict: Dictionary): PreparedDict {
  const d = dict.patch * dict.patch;
  const flat = new Float32Array(dict.nAtoms * d);
  for (let a = 0; a < dict.nAtoms; a++) for (let i = 0; i < d; i++) flat[a * d + i] = dict.atoms[a][i];
  return { flat, nAtoms: dict.nAtoms, d, patch: dict.patch };
}

// solve the small normal-equations least-squares over the chosen atoms: (D_S^T D_S) c = D_S^T x
function leastSquares(flat: Float32Array, d: number, chosen: number[], x: Float32Array): Float32Array {
  const m = chosen.length;
  const G = new Float32Array(m * m);
  const b = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const oi = chosen[i] * d;
    let bi = 0;
    for (let k = 0; k < d; k++) bi += flat[oi + k] * x[k];
    b[i] = bi;
    for (let j = i; j < m; j++) {
      const oj = chosen[j] * d;
      let g = 0;
      for (let k = 0; k < d; k++) g += flat[oi + k] * flat[oj + k];
      G[i * m + j] = g;
      G[j * m + i] = g;
    }
  }
  // Gaussian elimination with partial pivoting (+ tiny ridge for stability)
  const A = G.slice();
  const rhs = b.slice();
  for (let i = 0; i < m; i++) A[i * m + i] += 1e-6;
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r * m + col]) > Math.abs(A[piv * m + col])) piv = r;
    if (piv !== col) {
      for (let k = 0; k < m; k++) {
        const tmp = A[col * m + k];
        A[col * m + k] = A[piv * m + k];
        A[piv * m + k] = tmp;
      }
      const tb = rhs[col];
      rhs[col] = rhs[piv];
      rhs[piv] = tb;
    }
    const pivVal = A[col * m + col] || 1e-9;
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const factor = A[r * m + col] / pivVal;
      if (factor === 0) continue;
      for (let k = col; k < m; k++) A[r * m + k] -= factor * A[col * m + k];
      rhs[r] -= factor * rhs[col];
    }
  }
  const c = new Float32Array(m);
  for (let i = 0; i < m; i++) c[i] = rhs[i] / (A[i * m + i] || 1e-9);
  return c;
}

/** OMP: code one mean-subtracted patch with at most T atoms. Returns chosen atom indices + coefficients. */
export function ompPatch(dict: PreparedDict, x: Float32Array, T: number): { idx: number[]; coef: Float32Array } {
  const { flat, nAtoms, d } = dict;
  const r = x.slice();
  const chosen: number[] = [];
  let coef: Float32Array = new Float32Array(0);
  for (let step = 0; step < T; step++) {
    let best = -1;
    let bestAbs = 1e-6;
    for (let a = 0; a < nAtoms; a++) {
      if (chosen.includes(a)) continue;
      const o = a * d;
      let dot = 0;
      for (let k = 0; k < d; k++) dot += flat[o + k] * r[k];
      if (Math.abs(dot) > bestAbs) {
        bestAbs = Math.abs(dot);
        best = a;
      }
    }
    if (best < 0) break;
    chosen.push(best);
    coef = leastSquares(flat, d, chosen, x);
    // residual r = x - D_S c
    r.set(x);
    for (let i = 0; i < chosen.length; i++) {
      const o = chosen[i] * d;
      const ci = coef[i];
      for (let k = 0; k < d; k++) r[k] -= ci * flat[o + k];
    }
  }
  return { idx: chosen, coef };
}

/** Sparse-code + reconstruct a plane (non-overlapping 8x8 tiling). Returns the reconstruction and the mean
 * number of atoms actually used per patch. */
export function sparseReconstructPlane(plane: Float32Array, w: number, h: number, dict: PreparedDict, T: number): { recon: Float32Array; avgAtoms: number } {
  const P = dict.patch;
  const d = P * P;
  const out = new Float32Array(w * h);
  const x = new Float32Array(d);
  let totalAtoms = 0;
  let nPatches = 0;
  for (let by = 0; by + P <= h; by += P)
    for (let bx = 0; bx + P <= w; bx += P) {
      let mean = 0;
      for (let y = 0; y < P; y++) for (let px = 0; px < P; px++) mean += plane[(by + y) * w + (bx + px)];
      mean /= d;
      for (let y = 0; y < P; y++) for (let px = 0; px < P; px++) x[y * P + px] = plane[(by + y) * w + (bx + px)] - mean;
      const { idx, coef } = ompPatch(dict, x, T);
      totalAtoms += idx.length;
      nPatches++;
      for (let y = 0; y < P; y++)
        for (let px = 0; px < P; px++) {
          const i = y * P + px;
          let s = mean;
          for (let a = 0; a < idx.length; a++) s += coef[a] * dict.flat[idx[a] * d + i];
          out[(by + y) * w + (bx + px)] = s;
        }
    }
  return { recon: out, avgAtoms: nPatches ? totalAtoms / nPatches : 0 };
}

/** The a-th atom as a [0,1] tile for the gallery. */
export function atomTile(dict: Dictionary, a: number): Float32Array {
  const src = dict.atoms[a];
  const out = new Float32Array(src.length);
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of src) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn || 1;
  for (let i = 0; i < src.length; i++) out[i] = (src[i] - mn) / range;
  return out;
}
