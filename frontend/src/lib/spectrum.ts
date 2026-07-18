// The representation spectrum: the seven families one image can be written in, ordered by abstraction.
// This is the intellectual spine (see the Introduction and the U-shaped-editability thesis). Each family
// carries its editability class (the answer to "perturb a parameter, get meaning or noise?") and the
// lane it runs in (live in-browser vs offline-baked replay). The 13 App method tabs are variants within
// these families and are registered as they land.

export type EditClass = 'global' | 'semantic' | 'learned' | 'noise';
export type Lane = 'live' | 'replay' | 'mixed';

export interface RepFamily {
  index: number;
  id: string;
  en: string;
  es: string;
  blurb_en: string;
  blurb_es: string;
  edit: EditClass; // maps to a --il-* tone + an editability badge
  editLabel_en: string;
  editLabel_es: string;
  lane: Lane;
  tone: string; // CSS var for the family accent
}

export const FAMILIES: RepFamily[] = [
  {
    index: 1,
    id: 'transforms',
    en: 'Orthonormal transforms',
    es: 'Transformadas ortonormales',
    blurb_en: 'Fourier, cosine, wavelet, Karhunen-Loeve: the image as a sum over a fixed basis. This is what compression does.',
    blurb_es: 'Fourier, coseno, wavelet, Karhunen-Loeve: la imagen como suma sobre una base fija. Es lo que hace la compresión.',
    edit: 'global',
    editLabel_en: 'global-stable',
    editLabel_es: 'global-estable',
    lane: 'live',
    tone: 'var(--il-transform)',
  },
  {
    index: 2,
    id: 'frames',
    en: 'Frames and dictionaries',
    es: 'Marcos y diccionarios',
    blurb_en: 'A sparse combination of atoms from an overcomplete, often learned, dictionary. The interpretable middle.',
    blurb_es: 'Una combinación dispersa de átomos de un diccionario sobrecompleto, a menudo aprendido. El medio interpretable.',
    edit: 'semantic',
    editLabel_en: 'semantic-local',
    editLabel_es: 'semántico-local',
    lane: 'mixed',
    tone: 'var(--il-designed)',
  },
  {
    index: 3,
    id: 'primitives',
    en: 'Geometric primitives',
    es: 'Primitivas geométricas',
    blurb_en: 'A handful of shapes, strokes or Bezier paths. The cleanest editable case: move a shape, the image follows.',
    blurb_es: 'Un puñado de formas, trazos o curvas de Bezier. El caso editable más limpio: al mover una forma, la imagen la sigue.',
    edit: 'semantic',
    editLabel_en: 'semantic-local',
    editLabel_es: 'semántico-local',
    lane: 'mixed',
    tone: 'var(--il-designed)',
  },
  {
    index: 4,
    id: 'neural-field',
    en: 'Implicit neural field',
    es: 'Campo neuronal implícito',
    blurb_en: 'A small network f(x, y) to RGB overfit to the image: the modern, learned descendant of closed-form pixel art.',
    blurb_es: 'Una pequeña red f(x, y) a RGB sobreajustada a la imagen: el descendiente moderno y aprendido del arte de fórmula por pixel.',
    edit: 'noise',
    editLabel_en: 'weights to noise, latent editable',
    editLabel_es: 'pesos a ruido, latente editable',
    lane: 'live',
    tone: 'var(--il-noise)',
  },
  {
    index: 5,
    id: 'symbolic',
    en: 'Symbolic formula art',
    es: 'Arte de fórmula simbólica',
    blurb_en: 'An explicit closed-form expression, or an evolved compositional network, that maps (x, y) to colour.',
    blurb_es: 'Una expresión explícita en forma cerrada, o una red composicional evolucionada, que mapea (x, y) a color.',
    edit: 'noise',
    editLabel_en: 'readable but brittle',
    editLabel_es: 'legible pero frágil',
    lane: 'live',
    tone: 'var(--il-neutral)',
  },
  {
    index: 6,
    id: 'latents',
    en: 'Generative latents',
    es: 'Latentes generativos',
    blurb_en: 'A code in the latent space of a variational or adversarial model, with disentangled semantic directions.',
    blurb_es: 'Un código en el espacio latente de un modelo variacional o adversarial, con direcciones semánticas desenredadas.',
    edit: 'learned',
    editLabel_en: 'semantic (the editable pole)',
    editLabel_es: 'semántico (el polo editable)',
    lane: 'replay',
    tone: 'var(--il-learned)',
  },
  {
    index: 7,
    id: 'diffusion',
    en: 'Diffusion and narrative',
    es: 'Difusión y narrativa',
    blurb_en: 'Sketch, stroke or a text description into a plausible image; edit the prompt or the latent and watch it drift.',
    blurb_es: 'Boceto, trazo o una descripción de texto hacia una imagen plausible; al editar el prompt o el latente se observa cómo deriva.',
    edit: 'learned',
    editLabel_en: 'semantic but entangled',
    editLabel_es: 'semántico pero enredado',
    lane: 'replay',
    tone: 'var(--il-learned)',
  },
];

export function editToneVar(edit: EditClass): string {
  switch (edit) {
    case 'global':
      return 'var(--il-transform)';
    case 'semantic':
      return 'var(--il-designed)';
    case 'learned':
      return 'var(--il-learned)';
    case 'noise':
      return 'var(--il-noise)';
  }
}

export function editBadgeClass(edit: EditClass): string {
  switch (edit) {
    case 'global':
      return 'edit-global';
    case 'semantic':
      return 'edit-semantic';
    case 'learned':
      return 'edit-learned';
    case 'noise':
      return 'edit-noise';
  }
}
