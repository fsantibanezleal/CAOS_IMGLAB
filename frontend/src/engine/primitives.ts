// Load and render a baked greedy-primitive approximation (an ordered list of translucent ellipses) to a
// canvas. Rendering the first K shapes shows the image build up shape by shape; each shape is an
// independent, meaningful, local coordinate (the cleanest semantic-local representation).
import { APP_VERSION } from '../lib/version';
import type { ImagePlanes } from './image';
import { planesToImageData } from './image';

export interface PrimShape {
  type: 'bg' | 'ellipse';
  color: number[];
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  ang?: number;
  alpha?: number;
}
export interface PrimDoc {
  size: number;
  shapes: PrimShape[];
  psnr: number;
}

export async function loadPrimIndex(): Promise<{ fitted: string[]; size: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_prim/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`primitives index unavailable (${res.status})`);
  return res.json();
}
export async function loadPrimitives(imageId: string): Promise<PrimDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_prim/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no primitive fit for '${imageId}'`);
  return res.json();
}

/** Render the first `count` shapes (after the background) to a canvas at `displaySize`. */
export function renderShapes(canvas: HTMLCanvasElement, doc: PrimDoc, count: number, displaySize: number): void {
  canvas.width = displaySize;
  canvas.height = displaySize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = displaySize / doc.size;
  const bg = doc.shapes[0];
  ctx.fillStyle = `rgb(${bg.color.map((v) => Math.round(v * 255)).join(',')})`;
  ctx.fillRect(0, 0, displaySize, displaySize);
  const n = Math.min(count, doc.shapes.length - 1);
  for (let i = 1; i <= n; i++) {
    const sh = doc.shapes[i];
    if (sh.type !== 'ellipse') continue;
    ctx.save();
    ctx.globalAlpha = sh.alpha ?? 0.5;
    ctx.fillStyle = `rgb(${sh.color.map((v) => Math.round(v * 255)).join(',')})`;
    ctx.translate((sh.cx ?? 0) * s, (sh.cy ?? 0) * s);
    ctx.rotate(sh.ang ?? 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, (sh.rx ?? 1) * s, (sh.ry ?? 1) * s, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

/** PSNR of the rendered shapes vs the original planes (both at the same size). */
export function renderedPSNR(canvas: HTMLCanvasElement, planes: ImagePlanes): number {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width !== planes.w) return NaN;
  const data = ctx.getImageData(0, 0, planes.w, planes.h).data;
  const n = planes.w * planes.h;
  let se = 0;
  for (let i = 0; i < n; i++) {
    se += (data[4 * i] / 255 - planes.r[i]) ** 2 + (data[4 * i + 1] / 255 - planes.g[i]) ** 2 + (data[4 * i + 2] / 255 - planes.b[i]) ** 2;
  }
  const mse = se / (3 * n);
  return mse <= 0 ? Infinity : 10 * Math.log10(1 / mse);
}

/** paint planes at a given size for the original (uses the standard helper). */
export function paintOriginal(canvas: HTMLCanvasElement, planes: ImagePlanes): void {
  canvas.width = planes.w;
  canvas.height = planes.h;
  canvas.getContext('2d')?.putImageData(planesToImageData(planes), 0, 0);
}
