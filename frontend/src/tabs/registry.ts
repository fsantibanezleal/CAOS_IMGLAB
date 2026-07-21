// The representation-tab plugin registry. Each App tab is a self-contained module exporting a TabModule;
// the App workbench renders the shell Tabs over this registry, grouped by family, every panel reacting to
// the selected image. Tabs are added here as they land (one per follow-up issue/PR). A tab's Panel receives
// the selected image entry, its live planes (null while loading), and the hi-res url.
import type { ComponentType } from 'react';
import type { ImagePlanes } from '../engine/image';
import type { ImageEntry, Lane } from '../lib/contract.types';

export type Family = 'transforms' | 'frames' | 'primitives' | 'neural-field' | 'symbolic' | 'latents' | 'diffusion';

export interface PanelProps {
  entry: ImageEntry;
  /** The working-size planes (256px) for the live tabs; null while loading. */
  planes: ImagePlanes | null;
}

export interface TabModule {
  id: string;
  family: Family;
  labelEn: string;
  labelEs: string;
  lane: Lane;
  Panel: ComponentType<PanelProps>;
}

export const FAMILY_ORDER: Family[] = [
  'transforms',
  'frames',
  'primitives',
  'neural-field',
  'symbolic',
  'latents',
  'diffusion',
];

// Registered representation tabs. Populated as each representation lands.
import { fourierTab } from './fourier';
import { dctTab } from './dct';
import { waveletTab } from './wavelet';
import { kltTab } from './klt';
import { symbolicTab } from './symbolic';
import { epicycleTab } from './epicycle';
import { framesTab } from './frames';
import { neuralTab } from './neural';
import { primitivesTab } from './primitives';
import { latentsTab } from './latents';
import { diffusionTab } from './diffusion';
import { gaborTab } from './gabor';
import { gsplatTab } from './gsplat';
import { polyTab } from './poly';

export const TABS: TabModule[] = [
  fourierTab,
  dctTab,
  waveletTab,
  kltTab,
  framesTab,
  primitivesTab,
  neuralTab,
  symbolicTab,
  gaborTab,
  gsplatTab,
  polyTab,
  epicycleTab,
  latentsTab,
  diffusionTab,
];

export function tabsByFamily(family: Family): TabModule[] {
  return TABS.filter((t) => t.family === family);
}
