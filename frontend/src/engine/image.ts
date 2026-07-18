// The in-browser image model: an RGB image as three Float32Array planes in [0,1] plus width/height.
// Every live representation engine (transforms, primitives, shaders, metrics) operates on this shape; no
// React here. Loading rasterizes a PNG (from the curated set or a user upload) to a canvas, reads the
// pixels, normalizes to [0,1], and optionally resizes to a working size.

export interface ImagePlanes {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  w: number;
  h: number;
}

export function emptyPlanes(w: number, h: number): ImagePlanes {
  const n = w * h;
  return { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), w, h };
}

export function clonePlanes(p: ImagePlanes): ImagePlanes {
  return { r: p.r.slice(), g: p.g.slice(), b: p.b.slice(), w: p.w, h: p.h };
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const isPow2 = (n: number): boolean => n > 1 && (n & (n - 1)) === 0;

/** The three colour planes, in order, for channel-wise transforms. */
export const channels = (p: ImagePlanes): Float32Array[] => [p.r, p.g, p.b];

/** Rebuild planes from transformed channels (same w/h). */
export const withChannels = (p: ImagePlanes, ch: Float32Array[]): ImagePlanes => ({
  r: ch[0],
  g: ch[1],
  b: ch[2],
  w: p.w,
  h: p.h,
});

/** Rec.709 luma of a plane set (used by SSIM and grayscale transforms). */
export function luma(p: ImagePlanes): Float32Array {
  const n = p.w * p.h;
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = 0.2126 * p.r[i] + 0.7152 * p.g[i] + 0.0722 * p.b[i];
  return y;
}

/** Draw the (already loaded) source onto a canvas at the target size and read normalized planes. */
function drawToPlanes(src: CanvasImageSource, sw: number, sh: number, size?: number): ImagePlanes {
  let w = sw;
  let h = sh;
  if (size && Math.max(sw, sh) > size) {
    const s = size / Math.max(sw, sh);
    w = Math.max(1, Math.round(sw * s));
    h = Math.max(1, Math.round(sh * s));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out = emptyPlanes(w, h);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    out.r[i] = data[j] / 255;
    out.g[i] = data[j + 1] / 255;
    out.b[i] = data[j + 2] / 255;
  }
  return out;
}

/** Load a PNG/JPEG URL into planes, optionally downscaling so max(w,h) <= size. */
export async function loadImagePlanes(url: string, size?: number): Promise<ImagePlanes> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  return drawToPlanes(img, sw, sh, size);
}

/** Load a user-uploaded File (drag/drop or picker) into planes for the live tabs. */
export async function loadFilePlanes(file: File, size?: number): Promise<ImagePlanes> {
  const bmp = await createImageBitmap(file);
  try {
    return drawToPlanes(bmp, bmp.width, bmp.height, size);
  } finally {
    bmp.close();
  }
}

/** Convert planes back to an ImageData for canvas painting (clamped, denormalized). */
export function planesToImageData(p: ImagePlanes): ImageData {
  const n = p.w * p.h;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[j] = clamp01(p.r[i]) * 255;
    out[j + 1] = clamp01(p.g[i]) * 255;
    out[j + 2] = clamp01(p.b[i]) * 255;
    out[j + 3] = 255;
  }
  return new ImageData(out, p.w, p.h);
}

/** Paint planes into a canvas element, resizing the canvas to the image. */
export function paintPlanes(canvas: HTMLCanvasElement, p: ImagePlanes): void {
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(planesToImageData(p), 0, 0);
}

/** Paint a single-channel field (e.g. a log-magnitude spectrum) with an optional [min,max] normalization. */
export function paintField(
  canvas: HTMLCanvasElement,
  field: Float32Array,
  w: number,
  h: number,
  opts?: { min?: number; max?: number },
): void {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let mn = opts?.min;
  let mx = opts?.max;
  if (mn === undefined || mx === undefined) {
    mn = Infinity;
    mx = -Infinity;
    for (let i = 0; i < field.length; i++) {
      if (field[i] < mn) mn = field[i];
      if (field[i] > mx) mx = field[i];
    }
  }
  const range = mx - mn || 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const v = clamp01((field[i] - mn) / range) * 255;
    out[j] = v;
    out[j + 1] = v;
    out[j + 2] = v;
    out[j + 3] = 255;
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}
