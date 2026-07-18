// KLT / PCA reconstruction from a baked patch eigenbasis. The basis is data-dependent (fit offline on the
// curated set), so it cannot be recomputed client-side; the tab PROJECTS the selected image onto the top-m
// eigen-patches and reconstructs, which is fast and works on any image (including uploads). Non-overlapping
// 8x8 tiling.
import { APP_VERSION } from '../lib/version';

export interface PatchBasis {
  patch: number;
  K: number;
  mean: number[]; // length patch*patch
  components: number[][]; // K x (patch*patch), rows are eigenvectors (descending eigenvalue)
  eigenvalues: number[];
  cumulativeVar: number[];
}

export async function loadKltBasis(): Promise<PatchBasis> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_klt/patch.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`KLT basis unavailable (${res.status})`);
  return (await res.json()) as PatchBasis;
}

/** Reconstruct a plane from the top-m eigen-patches (non-overlapping tiling). */
export function kltReconstructPlane(plane: Float32Array, w: number, h: number, basis: PatchBasis, m: number): Float32Array {
  const P = basis.patch;
  const d = P * P;
  const M = Math.min(m, basis.K);
  const out = new Float32Array(w * h);
  const vec = new Float32Array(d);
  const coef = new Float32Array(M);
  for (let by = 0; by + P <= h; by += P)
    for (let bx = 0; bx + P <= w; bx += P) {
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) vec[y * P + x] = plane[(by + y) * w + (bx + x)] - basis.mean[y * P + x];
      for (let c = 0; c < M; c++) {
        const comp = basis.components[c];
        let s = 0;
        for (let i = 0; i < d; i++) s += comp[i] * vec[i];
        coef[c] = s;
      }
      for (let y = 0; y < P; y++)
        for (let x = 0; x < P; x++) {
          const i = y * P + x;
          let s = basis.mean[i];
          for (let c = 0; c < M; c++) s += coef[c] * basis.components[c][i];
          out[(by + y) * w + (bx + x)] = s;
        }
    }
  return out;
}

/** The idx-th eigen-patch, normalized to [0,1] for the gallery. */
export function kltEigenTile(basis: PatchBasis, idx: number): Float32Array {
  const src = idx === 0 ? basis.mean : basis.components[idx - 1]; // slot 0 shows the mean patch
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
