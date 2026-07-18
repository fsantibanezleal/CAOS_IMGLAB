import { describe, expect, it } from 'vitest';
import { dctRoundTripPlane, jpegPlane } from './dct';

function psnr(a: Float32Array, b: Float32Array): number {
  let se = 0;
  for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
  const mse = se / a.length;
  return mse <= 0 ? Infinity : 10 * Math.log10(1 / mse);
}

describe('dct engine', () => {
  const w = 64;
  const h = 64;
  const plane = new Float32Array(w * h);
  for (let i = 0; i < plane.length; i++) plane[i] = Math.sin(i * 0.07) * 0.5 + 0.5;

  it('exact 8x8 block round-trip (no quantization) is > 100 dB', () => {
    expect(psnr(plane, dctRoundTripPlane(plane, w, h, 8))).toBeGreaterThan(100);
  });

  it('quality 95 is near-lossless (> 40 dB) and quality 5 is lossy (< 40 dB)', () => {
    const q95 = jpegPlane(plane, w, h, { quality: 95 }).recon;
    const q5 = jpegPlane(plane, w, h, { quality: 5 }).recon;
    expect(psnr(plane, q95)).toBeGreaterThan(40);
    expect(psnr(plane, q5)).toBeLessThan(psnr(plane, q95));
  });

  it('higher quality keeps more coefficients', () => {
    const lo = jpegPlane(plane, w, h, { quality: 10 }).keptCoeffs;
    const hi = jpegPlane(plane, w, h, { quality: 90 }).keptCoeffs;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });
});
