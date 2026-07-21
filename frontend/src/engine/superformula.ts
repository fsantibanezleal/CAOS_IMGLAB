// The Gielis superformula equation of the SELECTED image's outline, fitted LIVE (uploads included). The
// dominant silhouette is reduced to a radial profile r(theta) about its centroid, and the superformula
//     r(theta) = ( |cos(m*theta/4)/a|^{n2} + |sin(m*theta/4)/b|^{n3} )^{-1/n1}
// is fitted to it: a single famous closed-form curve (Gielis 2003) that unifies circles, polygons, stars and
// flowers. Symmetric shapes (the rose, the star) collapse to a compact exact formula; an irregular photo
// silhouette gets its best m-fold-symmetric superformula approximation, which is the honest result.
import type { ImagePlanes } from './image';
import { luma } from './image';

const NA = 180; // angular samples

export interface RadialProfile {
  theta: Float64Array;
  r: Float64Array; // normalized so max = 1
  ok: boolean;
}

export interface SuperfluidFit {
  m: number;
  n1: number;
  n2: number;
  n3: number;
  a: number;
  b: number;
  scale: number; // multiply the unit superformula radius to match the image profile
  psnr: number; // radius-domain PSNR (10 log10 1/mse over the normalized profile)
  profile: RadialProfile;
}

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

/** Radial silhouette profile r(theta) about the foreground centroid, normalized so max = 1. */
export function radialProfile(planes: ImagePlanes): RadialProfile {
  const { w, h } = planes;
  const y = luma(planes);
  const thr = otsu(y);
  let below = 0;
  for (let i = 0; i < y.length; i++) if (y[i] < thr) below++;
  const fgDark = below <= y.length / 2;
  const fg = (i: number) => (fgDark ? y[i] < thr : y[i] >= thr);
  let cx = 0;
  let cy = 0;
  let cnt = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (fg(j * w + i)) {
        cx += i;
        cy += j;
        cnt++;
      }
  const theta = new Float64Array(NA);
  const r = new Float64Array(NA);
  if (cnt < 40) return { theta, r, ok: false };
  cx /= cnt;
  cy /= cnt;
  const maxR = Math.hypot(w, h);
  let rmax = 1e-9;
  for (let k = 0; k < NA; k++) {
    const ang = (2 * Math.PI * k) / NA;
    theta[k] = ang;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let boundary = 0;
    for (let rr = 1; rr < maxR; rr += 1) {
      const px = Math.round(cx + dx * rr);
      const py = Math.round(cy + dy * rr);
      if (px < 0 || py < 0 || px >= w || py >= h) break;
      if (fg(py * w + px)) boundary = rr;
    }
    r[k] = boundary;
    rmax = Math.max(rmax, boundary);
  }
  for (let k = 0; k < NA; k++) r[k] /= rmax;
  return { theta, r, ok: true };
}

/** The unit superformula radius at angle theta for parameters (m, n1, n2, n3, a, b). */
export function superformulaR(m: number, n1: number, n2: number, n3: number, a: number, b: number, th: number): number {
  const t = (m * th) / 4;
  const p1 = Math.pow(Math.abs(Math.cos(t) / a), n2);
  const p2 = Math.pow(Math.abs(Math.sin(t) / b), n3);
  const s = p1 + p2;
  if (s <= 1e-9) return 0;
  return Math.pow(s, -1 / n1);
}

function fitError(prof: RadialProfile, m: number, n1: number, n2: number, n3: number): { err: number; scale: number } {
  // best scale is a closed-form 1D LSQ: scale = <r, model> / <model, model>
  let num = 0;
  let den = 0;
  const md = new Float64Array(NA);
  for (let k = 0; k < NA; k++) {
    const v = superformulaR(m, n1, n2, n3, 1, 1, prof.theta[k]);
    md[k] = v;
    num += prof.r[k] * v;
    den += v * v;
  }
  const scale = den > 1e-9 ? num / den : 0;
  let err = 0;
  for (let k = 0; k < NA; k++) {
    const d = scale * md[k] - prof.r[k];
    err += d * d;
  }
  return { err: err / NA, scale };
}

/** Fit the superformula to the profile: search integer m, coordinate-descend (n1,n2,n3), keep the best. */
export function fitSuperformula(prof: RadialProfile): SuperfluidFit {
  let best = { m: 4, n1: 1, n2: 1, n3: 1, scale: 1, err: Infinity };
  for (let m = 1; m <= 14; m++) {
    let n1 = 1;
    let n2 = 1;
    let n3 = 1;
    let cur = fitError(prof, m, n1, n2, n3).err;
    // coordinate descent in log-space with shrinking multiplicative steps
    for (let step = 0.6; step > 0.02; step *= 0.7) {
      for (let pass = 0; pass < 3; pass++) {
        for (const which of [0, 1, 2]) {
          for (const dir of [Math.exp(step), Math.exp(-step)]) {
            const t1 = which === 0 ? n1 * dir : n1;
            const t2 = which === 1 ? n2 * dir : n2;
            const t3 = which === 2 ? n3 * dir : n3;
            if (t1 < 0.05 || t1 > 60 || t2 < 0.05 || t2 > 60 || t3 < 0.05 || t3 > 60) continue;
            const e = fitError(prof, m, t1, t2, t3).err;
            if (e < cur) {
              cur = e;
              n1 = t1;
              n2 = t2;
              n3 = t3;
            }
          }
        }
      }
    }
    if (cur < best.err) best = { m, n1, n2, n3, scale: fitError(prof, m, n1, n2, n3).scale, err: cur };
  }
  const psnr = best.err > 0 ? 10 * Math.log10(1 / best.err) : 99;
  return { m: best.m, n1: best.n1, n2: best.n2, n3: best.n3, a: 1, b: 1, scale: best.scale, psnr, profile: prof };
}

const s2 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(2);
const s3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the fitted superformula with its real exponents. */
export function superformulaTex(f: SuperfluidFit): string {
  return (
    `r(\\theta) = ${s3(f.scale)}\\left(\\left|\\cos\\tfrac{${f.m}\\,\\theta}{4}\\right|^{${s2(f.n2)}}` +
    `+\\left|\\sin\\tfrac{${f.m}\\,\\theta}{4}\\right|^{${s2(f.n3)}}\\right)^{-1/${s2(f.n1)}}`
  );
}

/** Plain-text export of the fitted superformula. */
export function superformulaText(f: SuperfluidFit, imageId: string): string {
  return [
    `ImageLab, the fitted Gielis superformula of the outline of "${imageId}"`,
    `r(theta) = scale * ( |cos(m*theta/4)/a|^n2 + |sin(m*theta/4)/b|^n3 )^(-1/n1)`,
    ``,
    `m     = ${f.m}`,
    `n1    = ${f.n1.toFixed(5)}`,
    `n2    = ${f.n2.toFixed(5)}`,
    `n3    = ${f.n3.toFixed(5)}`,
    `a     = ${f.a}`,
    `b     = ${f.b}`,
    `scale = ${f.scale.toFixed(5)}`,
    ``,
    `radial-profile fit PSNR ${f.psnr.toFixed(2)} dB over ${f.profile.r.length} angles`,
    `to draw: x(theta) = r(theta) cos(theta), y(theta) = r(theta) sin(theta), theta in [0, 2*pi)`,
  ].join('\n');
}
