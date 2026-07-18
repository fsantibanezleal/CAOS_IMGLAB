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

export type ImageKind = 'real' | 'math-art' | 'synthetic';

export interface GeneratorSpec {
  name: string;
  params: Record<string, number | number[] | string>;
}

/** One entry of data/images/index.json (Contract 1, schema imglab.imageset/v1). */
export interface ImageEntry {
  // eight core fields
  id: string;
  category: ImageCategory;
  title: string;
  titleEs?: string;
  /** SPDX-style license id or short label, e.g. "CC0-1.0", "CC-BY-4.0", "LicenseRef-Kodak-Unrestricted". */
  license: string;
  /** Human source, e.g. "The Metropolitan Museum of Art, Open Access". */
  source: string;
  /** Attribution string for the credits and footer. */
  attribution: string;
  width: number;
  height: number;
  // additive fields
  kind: ImageKind;
  spdx: string;
  source_url: string | null;
  sha256: string;
  /** Representation-family indices this image best illustrates (0..6, see lib/spectrum). */
  family_hints: number[];
  has_hires: boolean;
  generator: GeneratorSpec | null;
  added: string;
}

export interface ImageSetIndex {
  schema: 'imglab.imageset/v1';
  version: string;
  count: number;
  images: ImageEntry[];
}

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
