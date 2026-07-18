// The data contracts, mirrored in TypeScript so a drift from the Python pipeline fails the build.
//   Contract 1 (ingestion): the image index (data/images/index.json) + license provenance.
//   Contract 2 (artifact):  per (imageId, method) a compact artifact + a manifest under data/derived/.
// The web fetches these from public/data (copy-data.mjs overlays data/derived) and never recomputes a
// baked artifact; the light tabs recompute live in the browser instead.

export type ImageCategory =
  | 'photo'
  | 'art'
  | 'math-art'
  | 'biological'
  | 'microscopy'
  | 'astronomy'
  | 'texture'
  | 'synthetic';

/** One entry of data/images/index.json (Contract 1). */
export interface ImageEntry {
  id: string;
  category: ImageCategory;
  title: string;
  titleEs?: string;
  /** SPDX-style license id or short label, e.g. "CC0-1.0", "CC-BY-4.0", "public-domain", "Kodak", "MIT". */
  license: string;
  /** Human source, e.g. "NASA/STScI (Hubble)". */
  source: string;
  /** Attribution string for the footer/credits. */
  attribution: string;
  /** Original source URL (empty for in-repo procedural images). */
  sourceUrl?: string;
  width: number;
  height: number;
  /** Representation families this image best illustrates (family ids from lib/spectrum). */
  illustrates?: string[];
}

export type ImageIndex = ImageEntry[];

export type Lane = 'live' | 'replay' | 'mixed';

/** The manifest for one baked artifact (Contract 2). */
export interface Manifest {
  imageId: string;
  method: string;
  params: Record<string, number | string | boolean>;
  seed: number;
  lane: Lane;
  bytes: number;
  runMs: number;
  format: string;
  version: string;
}

/** Envelope every baked artifact JSON shares; `data` is the per-method payload typed by each tab. */
export interface Artifact<T = unknown> {
  manifest: Manifest;
  data: T;
}

/** Resolve a public data URL for a baked artifact, cache-busted by the app version. */
export function artifactUrl(imageId: string, method: string, version: string): string {
  return `${import.meta.env.BASE_URL}data/${imageId}/${method}.json?v=${version}`;
}

export function imageUrl(imageId: string, hi = false): string {
  return `${import.meta.env.BASE_URL}images/${imageId}${hi ? '.hi' : ''}.png`;
}
