import { describe, expect, it } from 'vitest';
import { dwt2, idwt2, keepTopFractionDwt, type WaveletName } from './dwt';

function psnr(a: Float32Array, b: Float32Array): number {
  let se = 0;
  for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
  const mse = se / a.length;
  return mse <= 0 ? Infinity : 10 * Math.log10(1 / mse);
}

describe('dwt engine', () => {
  const w = 64;
  const h = 64;
  const plane = new Float32Array(w * h);
  let s = 777;
  for (let i = 0; i < plane.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    plane[i] = 0.3 * (s / 0x7fffffff) + 0.5 * Math.sin(i * 0.05);
  }

  const names: WaveletName[] = ['haar', 'db2', 'db4', 'cdf97'];
  for (const name of names) {
    for (const levels of [1, 2, 3]) {
      it(`${name} levels ${levels} round-trips > 100 dB`, () => {
        const back = idwt2(dwt2(plane, w, h, name, levels));
        expect(psnr(plane, back)).toBeGreaterThan(100);
      });
    }
  }

  it('keepTopFractionDwt(1.0) is lossless and 10% is lossy', () => {
    const t = dwt2(plane, w, h, 'db4', 3);
    expect(psnr(plane, idwt2(keepTopFractionDwt(t, 1.0)))).toBeGreaterThan(100);
    expect(psnr(plane, idwt2(keepTopFractionDwt(t, 0.1)))).toBeLessThan(100);
  });
});
