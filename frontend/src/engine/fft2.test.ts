import { describe, expect, it } from 'vitest';
import { fft2, ifft2, keepTopFraction } from './fft2';

function planePSNR(a: Float32Array, b: Float32Array): number {
  let se = 0;
  for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
  const mse = se / a.length;
  return mse <= 0 ? Infinity : 10 * Math.log10(1 / mse);
}

describe('fft2 engine', () => {
  it('round-trips ifft2(fft2(x)) == x to > 100 dB', () => {
    const w = 64;
    const h = 32;
    const plane = new Float32Array(w * h);
    let s = 12345;
    for (let i = 0; i < plane.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff; // deterministic pseudo-random in [0,1)
      plane[i] = s / 0x7fffffff;
    }
    const back = ifft2(fft2(plane, w, h));
    expect(planePSNR(plane, back)).toBeGreaterThan(100);
  });

  it('DFT of a constant plane concentrates all energy at DC', () => {
    const w = 16;
    const h = 16;
    const c = 0.42;
    const plane = new Float32Array(w * h).fill(c);
    const F = fft2(plane, w, h);
    expect(F.re[0]).toBeCloseTo(c * w * h, 3); // F(0,0) = c*W*H
    let offDC = 0;
    for (let i = 1; i < w * h; i++) offDC += Math.hypot(F.re[i], F.im[i]);
    expect(offDC).toBeLessThan(1e-3);
  });

  it('keepTopFraction(1.0) is lossless and monotone in fidelity', () => {
    const w = 32;
    const h = 32;
    const plane = new Float32Array(w * h);
    for (let i = 0; i < plane.length; i++) plane[i] = Math.sin(i * 0.1) * 0.5 + 0.5;
    const F = fft2(plane, w, h);
    const full = ifft2(keepTopFraction(F, 1.0));
    expect(planePSNR(plane, full)).toBeGreaterThan(100);
    const p10 = planePSNR(plane, ifft2(keepTopFraction(F, 0.1)));
    const p50 = planePSNR(plane, ifft2(keepTopFraction(F, 0.5)));
    expect(p50).toBeGreaterThanOrEqual(p10);
  });
});
