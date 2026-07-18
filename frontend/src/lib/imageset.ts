import type { ImageCategory, ImageEntry, ImageSetIndex } from './contract.types';
import { APP_VERSION } from './version';

// Load the curated image index (Contract 1) that copy-data.mjs overlaid into public/images.
export async function loadImageSet(): Promise<ImageEntry[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}images/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`image index unavailable (${res.status})`);
  const idx = (await res.json()) as ImageSetIndex;
  return idx.images;
}

// Category display order + bilingual labels.
export const CATEGORY_ORDER: ImageCategory[] = [
  'photo',
  'art',
  'math-art',
  'astronomy',
  'texture',
  'biological',
  'microscopy',
  'synthetic',
];

export const CATEGORY_LABEL: Record<ImageCategory, { en: string; es: string }> = {
  photo: { en: 'Photographs', es: 'Fotografias' },
  art: { en: 'Fine art', es: 'Arte' },
  'math-art': { en: 'Math art', es: 'Arte matematico' },
  astronomy: { en: 'Astronomy', es: 'Astronomia' },
  texture: { en: 'Textures', es: 'Texturas' },
  biological: { en: 'Biological', es: 'Biologico' },
  microscopy: { en: 'Microscopy', es: 'Microscopia' },
  synthetic: { en: 'Synthetic', es: 'Sinteticas' },
};

export function groupByCategory(images: ImageEntry[]): Array<[ImageCategory, ImageEntry[]]> {
  const out: Array<[ImageCategory, ImageEntry[]]> = [];
  for (const cat of CATEGORY_ORDER) {
    const items = images.filter((im) => im.category === cat);
    if (items.length) out.push([cat, items]);
  }
  return out;
}
