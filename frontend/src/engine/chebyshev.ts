// The polynomial-series equation of the SELECTED image, fitted LIVE in the browser (works for uploads too):
// each channel is written as a truncated tensor Chebyshev series,
//     ch(x, y) = sum_{i,j <= d} a_ij T_i(x) T_j(y),   T_k(t) = cos(k arccos t),  x, y in [-1, 1].
// The least-squares coefficients are computed per axis with an orthonormalized Chebyshev-Vandermonde basis
// (modified Gram-Schmidt), then rotated back to the plain T_i basis so the written equation stays legible
// (the discrete-orthogonal-moments idea of Mukundan et al. 2001, computed directly at the working size).
import type { ImagePlanes } from './image';

export interface ChebFit {
  deg: number;
  /** per-channel coefficient matrices A[ch][i*(deg+1)+j] in the plain T_i(x) T_j(y) basis */
  coef: Float64Array[];
  psnr: number;
  recon: ImagePlanes;
}

interface Basis {
  n: number;
  m: number;
  Q: Float64Array; // n x m, orthonormal columns
  R: Float64Array; // m x m upper triangular, V = Q R
}

const basisCache = new Map<string, Basis>();

/** Chebyshev-Vandermonde at the n grid points of [-1,1], orthonormalized by modified Gram-Schmidt. */
function buildBasis(n: number, deg: number): Basis {
  const key = `${n}:${deg}`;
  const hit = basisCache.get(key);
  if (hit) return hit;
  const m = deg + 1;
  const V = new Float64Array(n * m);
  for (let r = 0; r < n; r++) {
    const t = n === 1 ? 0 : -1 + (2 * r) / (n - 1);
    V[r * m] = 1;
    if (m > 1) V[r * m + 1] = t;
    for (let k = 2; k < m; k++) V[r * m + k] = 2 * t * V[r * m + k - 1] - V[r * m + k - 2];
  }
  const Q = V.slice();
  const R = new Float64Array(m * m);
  for (let k = 0; k < m; k++) {
    let nrm = 0;
    for (let r = 0; r < n; r++) nrm += Q[r * m + k] * Q[r * m + k];
    nrm = Math.sqrt(nrm);
    R[k * m + k] = nrm;
    const inv = nrm > 1e-12 ? 1 / nrm : 0;
    for (let r = 0; r < n; r++) Q[r * m + k] *= inv;
    for (let j = k + 1; j < m; j++) {
      let dot = 0;
      for (let r = 0; r < n; r++) dot += Q[r * m + k] * Q[r * m + j];
      R[k * m + j] = dot;
      for (let r = 0; r < n; r++) Q[r * m + j] -= dot * Q[r * m + k];
    }
  }
  const b = { n, m, Q, R };
  basisCache.set(key, b);
  return b;
}

/** back-substitution helpers for the m x m upper-triangular R */
function solveUpper(R: Float64Array, m: number, B: Float64Array): Float64Array {
  // solve R X = B (B is m x m, column-major-agnostic: row-major m x m)
  const X = B.slice();
  for (let col = 0; col < m; col++) {
    for (let i = m - 1; i >= 0; i--) {
      let s = X[i * m + col];
      for (let k = i + 1; k < m; k++) s -= R[i * m + k] * X[k * m + col];
      X[i * m + col] = R[i * m + i] > 1e-12 ? s / R[i * m + i] : 0;
    }
  }
  return X;
}

/** Fit the tensor Chebyshev series to the planes at degree `deg`, returning legible T-basis coefficients. */
export function fitChebyshev(planes: ImagePlanes, deg: number): ChebFit {
  const { w, h } = planes;
  const bx = buildBasis(w, deg);
  const by = buildBasis(h, deg);
  const m = deg + 1;
  const chans = [planes.r, planes.g, planes.b];
  const coef: Float64Array[] = [];
  const recon: Float32Array[] = [];
  let se = 0;
  for (const img of chans) {
    // C_orth = Qy^T (img) Qx    (h x w) -> (m x m)
    const T1 = new Float64Array(m * w); // Qy^T img
    for (let i = 0; i < m; i++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = 0; y < h; y++) s += by.Q[y * m + i] * img[y * w + x];
        T1[i * w + x] = s;
      }
    const C = new Float64Array(m * m);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let x = 0; x < w; x++) s += T1[i * w + x] * bx.Q[x * m + j];
        C[i * m + j] = s;
      }
    // reconstruction from the orthonormal coefficients: rec = Qy C Qx^T
    const T2 = new Float64Array(m * w); // C Qx^T
    for (let i = 0; i < m; i++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let j = 0; j < m; j++) s += C[i * m + j] * bx.Q[x * m + j];
        T2[i * w + x] = s;
      }
    const rec = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = 0; i < m; i++) s += by.Q[y * m + i] * T2[i * w + x];
        const v = Math.min(1, Math.max(0, s));
        rec[y * w + x] = v;
        const d = v - img[y * w + x];
        se += d * d;
      }
    recon.push(rec);
    // legible T-basis coefficients: A = Ry^{-1} C Rx^{-T}  (solve Ry A' = C, then Rx A^T = A'^T)
    const A1 = solveUpper(by.R, m, C);
    // transpose, solve with Rx, transpose back
    const A1t = new Float64Array(m * m);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) A1t[j * m + i] = A1[i * m + j];
    const A2t = solveUpper(bx.R, m, A1t);
    const A = new Float64Array(m * m);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) A[i * m + j] = A2t[j * m + i];
    coef.push(A);
  }
  const mse = se / (3 * w * h);
  const psnr = mse > 0 ? 10 * Math.log10(1 / mse) : 99;
  return {
    deg,
    coef,
    psnr,
    recon: { r: recon[0], g: recon[1], b: recon[2], w, h },
  };
}

export const CHEB_CHANNELS = ['R', 'G', 'B'] as const;

const c3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the ACTUAL fitted polynomial series of one channel: the top n terms by |a_ij|. */
export function chebEquationTex(fit: ChebFit, ch: number, n = 8): string {
  const m = fit.deg + 1;
  const A = fit.coef[ch];
  const idx: { i: number; j: number; a: number }[] = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) idx.push({ i, j, a: A[i * m + j] });
  idx.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  const name = CHEB_CHANNELS[ch];
  const lines: string[] = [`${name}(x,y) = {} &`];
  idx.slice(0, n).forEach((t, k) => {
    const sign = t.a >= 0 ? (k === 0 ? '' : '+\\;') : '-\\;';
    const mag = c3(Math.abs(t.a));
    const fx = t.j === 0 ? '' : `\\,T_{${t.j}}(x)`;
    const fy = t.i === 0 ? '' : `\\,T_{${t.i}}(y)`;
    const sep = k > 0 && k % 2 === 0 ? ' \\\\ &' : k === 0 ? '' : ' ';
    lines.push(`${sep}${sign}${mag}${fx}${fy}`);
  });
  const rest = m * m - Math.min(n, m * m);
  if (rest > 0) lines.push(` \\\\ & +\\;\\cdots\\;(${rest}\\ \\text{more terms}),\\qquad T_k(t)=\\cos(k\\arccos t)`);
  return `\\begin{aligned}${lines.join('')}\\end{aligned}`;
}

/** The COMPLETE fitted polynomial series as plain text (all (deg+1)^2 terms, all three channels). */
export function chebEquationText(fit: ChebFit, imageId: string): string {
  const m = fit.deg + 1;
  const out: string[] = [
    `ImageLab, the fitted Chebyshev series of "${imageId}"`,
    `model: ch(x,y) = sum_ij a_ij * T_j(x) * T_i(y), T_k(t) = cos(k*arccos(t)), x,y in [-1,1]`,
    `degree: ${fit.deg} (${m * m} terms per channel), fit PSNR ${fit.psnr.toFixed(2)} dB`,
    ``,
  ];
  for (let ch = 0; ch < 3; ch++) {
    out.push(`${CHEB_CHANNELS[ch]}(x,y): a_ij matrix, row i = T_i(y) order, col j = T_j(x) order`);
    const A = fit.coef[ch];
    for (let i = 0; i < m; i++) {
      const row: string[] = [];
      for (let j = 0; j < m; j++) row.push(A[i * m + j].toFixed(5));
      out.push(`  ${row.join(' ')}`);
    }
    out.push(``);
  }
  return out.join('\n');
}
