// The in-app Architecture / How-it-works modal (ADR-0058), wired into the shell via config.architecture.
// Four hand-authored, theme-aware SVG diagrams (everything is currentColor or a low-opacity accent, so the
// same markup reads in light and dark) plus bilingual explanation bodies.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';

// --- small SVG builders (keep the diagrams DRY and consistent) ---
const W = 660;
const H = 300;
const FRAME = (inner: string, defs = '') =>
  `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif" role="img">` +
  `<defs>${defs}<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
  `<path d="M0 0 L10 5 L0 10 z" fill="currentColor" fill-opacity="0.55"/></marker></defs>${inner}</svg>`;

const box = (x: number, y: number, w: number, h: number, title: string, sub = '', hue = '') => {
  const fill = hue ? `${hue}` : 'currentColor';
  const op = hue ? '0.12' : '0.05';
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}" fill-opacity="${op}" stroke="${hue || 'currentColor'}" stroke-opacity="0.45"/>` +
    `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 4)}" text-anchor="middle" fill="currentColor" font-size="13" font-weight="600">${title}</text>` +
    (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" fill="currentColor" fill-opacity="0.7" font-size="10.5">${sub}</text>` : '')
  );
};

const arrow = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" marker-end="url(#ah)"/>`;

const label = (x: number, y: number, text: string, anchor = 'middle', op = '0.75') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="currentColor" fill-opacity="${op}" font-size="11">${text}</text>`;

const C_DESIGN = '#5cb85c';
const C_LEARN = '#b978d0';
const C_TRANSFORM = '#4a9ed6';

// --- 1) the editability thesis (the U-curve) ---
const svgThesis = FRAME(
  label(330, 24, 'Editability of a parameter perturbation', 'middle', '0.85') +
    // axes
    `<line x1="60" y1="250" x2="620" y2="250" stroke="currentColor" stroke-opacity="0.35"/>` +
    `<line x1="60" y1="60" x2="60" y2="250" stroke="currentColor" stroke-opacity="0.35"/>` +
    label(40, 155, 'edit', 'middle', '0.6') +
    // the U curve: high at both poles, low in the middle
    `<path d="M90 90 C 170 250, 300 260, 340 255 C 420 250, 520 250, 600 95" fill="none" stroke="${C_TRANSFORM}" stroke-width="2.4"/>` +
    // pole markers
    box(80, 96, 150, 44, 'designed structure', 'transforms, atoms, shapes', C_DESIGN) +
    box(438, 96, 150, 44, 'learned manifold', 'VAE, diffusion latents', C_LEARN) +
    label(335, 285, 'raw / dense pixels: a nudge is just noise', 'middle', '0.7') +
    label(150, 175, 'local, exact', 'middle', '0.7') +
    label(512, 175, 'semantic, entangled', 'middle', '0.7'),
);

// --- 2) offline bake pipeline ---
const svgOffline = FRAME(
  label(330, 22, 'Offline: the deterministic bake (.venv-pipeline, local)', 'middle', '0.85') +
    box(30, 120, 120, 58, 'image set', 'procedural + fetched', C_TRANSFORM) +
    arrow(150, 149, 196, 149) +
    `<rect x="200" y="52" width="250" height="204" rx="9" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4"/>` +
    label(325, 70, 'imglab.methods', 'middle', '0.7') +
    box(214, 82, 100, 34, 'KLT / PCA') +
    box(322, 82, 114, 34, 'dictionaries') +
    box(214, 124, 100, 34, 'SIREN (INR)') +
    box(322, 124, 114, 34, 'VAE strips') +
    box(214, 166, 100, 34, 'diffusion') +
    box(322, 166, 114, 34, 'primitives') +
    box(214, 210, 100, 30, 'equation fits') +
    box(322, 210, 114, 30, 'benchmark') +
    arrow(450, 149, 496, 149) +
    box(500, 108, 132, 82, 'data/derived', 'compact indices + arrays', C_DESIGN),
);

// --- 3) live in the browser ---
const svgLive = FRAME(
  label(330, 22, 'Live: computed in your browser tab (no server)', 'middle', '0.85') +
    box(24, 120, 118, 58, 'image', 'curated or your upload', C_TRANSFORM) +
    arrow(142, 149, 186, 149) +
    box(190, 128, 96, 42, 'working planes', '256px RGB') +
    arrow(286, 149, 330, 149) +
    `<rect x="334" y="50" width="210" height="200" rx="9" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4"/>` +
    label(439, 68, 'engines', 'middle', '0.7') +
    box(348, 78, 182, 30, 'FFT / block DCT (TypeScript)') +
    box(348, 116, 182, 30, 'wavelet lifting, OMP sparse') +
    box(348, 154, 182, 30, 'SIREN / equation (WebGL2 shader)') +
    box(348, 192, 182, 30, 'epicycles, primitive render') +
    arrow(544, 149, 588, 149) +
    box(590, 120, 56, 58, 'canvas', '', C_DESIGN),
);

// --- 4) deploy (static) ---
const svgDeploy = FRAME(
  label(330, 22, 'Deploy: a static site, no backend at request time', 'middle', '0.85') +
    box(40, 118, 150, 64, 'repo', 'SPA source + committed artifacts', C_TRANSFORM) +
    arrow(190, 150, 236, 150) +
    box(240, 112, 150, 76, 'GitHub Actions', 'npm build, copy-data overlays derived') +
    arrow(390, 150, 436, 150) +
    box(440, 118, 90, 64, 'Pages', 'CDN', C_DESIGN) +
    arrow(530, 150, 566, 150) +
    box(566, 118, 74, 64, 'browser', 'imglab.fasl-work.com') +
    label(330, 240, 'The committed derived artifacts are the inputs; the bake is never run on deploy.', 'middle', '0.7'),
);

export const ARCHITECTURE: ArchitectureConfig = {
  title_en: 'Architecture / How it works',
  title_es: 'Arquitectura / Cómo funciona',
  tabs: [
    {
      id: 'thesis',
      en: 'The thesis',
      es: 'La tesis',
      svg: svgThesis,
      body_en:
        'ImageLab writes one image as parameters in many ways and asks what a perturbation of those parameters does. Editability is U-shaped. It peaks at the designed-structure pole (orthonormal transforms, sparse dictionaries, geometric primitives), where a parameter is a local, exact handle, and at the learned-manifold pole (VAE and diffusion latents), where a parameter is a semantic but entangled handle. Between the poles, a raw or densely-coded parameter nudge just produces noise.\n\nEvery tab in the App is one point on this curve, and the Experiments page measures the locality of a one-parameter edit to place each family on it.',
      body_es:
        'ImageLab escribe una imagen como parámetros de muchas maneras y pregunta qué hace una perturbación de esos parámetros. La editabilidad tiene forma de U. Alcanza su máximo en el polo de estructura diseñada (transformadas ortonormales, diccionarios dispersos, primitivas geométricas), donde un parámetro es un control local y exacto, y en el polo de variedad aprendida (latentes de VAE y difusión), donde un parámetro es un control semántico pero enredado. Entre los polos, un empujón a un parámetro crudo o densamente codificado solo produce ruido.\n\nCada pestaña de la App es un punto de esta curva, y la página de Experimentos mide la localidad de una edición de un parámetro para ubicar cada familia en ella.',
    },
    {
      id: 'offline',
      en: 'Offline bake',
      es: 'Precalculado offline',
      svg: svgOffline,
      body_en:
        'The heavy representations are baked once, offline, by a deterministic Python pipeline (imglab.methods) in its own environment. It learns a patch KLT basis and sparse dictionaries, trains a small sinusoidal network (SIREN) per image, fits each image as closed-form equations (a trigonometric series, Gabor atoms by matching pursuit, and a 2D Gaussian mixture by gradient descent), encodes and perturbs the latent of each image with the Stable Diffusion VAE, regenerates each image with SD-Turbo image-to-image, fits geometric primitives, and finally measures the cross-family benchmark. Each writes a compact index plus its arrays under data/derived, which is committed to the repo.\n\nThe artifacts are the deployable inputs: the bake is reproducible from the repo but never runs at request time.',
      body_es:
        'Las representaciones pesadas se precalculan una vez, offline, con un pipeline determinista de Python (imglab.methods) en su propio entorno. Aprende una base KLT por parches y diccionarios dispersos, entrena una pequeña red sinusoidal (SIREN) por imagen, ajusta cada imagen como ecuaciones de forma cerrada (una serie trigonométrica, átomos de Gabor por matching pursuit y una mezcla gaussiana 2D por descenso de gradiente), codifica y perturba el latente de cada imagen con el VAE de Stable Diffusion, regenera cada imagen con SD-Turbo imagen-a-imagen, ajusta primitivas geométricas y finalmente mide el benchmark entre familias. Cada uno escribe un índice compacto y sus arreglos bajo data/derived, que se versiona en el repo.\n\nLos artefactos son las entradas desplegables: el precálculo es reproducible desde el repo pero nunca se ejecuta en tiempo de petición.',
    },
    {
      id: 'live',
      en: 'Live in the browser',
      es: 'En vivo en el navegador',
      svg: svgLive,
      body_en:
        'The transform, frame, primitive, symbolic and neural-field tabs compute in your browser, with no server call. The selected image (or your upload) is decoded to fixed-size planes, then the engines run in TypeScript (the FFT, the block DCT, wavelet lifting, orthogonal matching pursuit) or on the GPU as WebGL2 fragment shaders (the SIREN and CPPN forward pass, evaluated per pixel). The result is drawn to a canvas.\n\nBecause the same PSNR/SSIM code runs live and offline, a live reconstruction and its baked twin score the same number.',
      body_es:
        'Las pestañas de transformada, marco, primitivas, simbólica y campo neuronal calculan en el navegador, sin llamada al servidor. La imagen seleccionada (o la carga propia) se decodifica a planos de tamaño fijo, y luego los motores se ejecutan en TypeScript (la FFT, la DCT por bloques, el lifting wavelet, el matching pursuit ortogonal) o en la GPU como shaders de fragmento WebGL2 (el paso hacia adelante de SIREN y CPPN, evaluado por pixel). El resultado se dibuja en un canvas.\n\nComo el mismo código PSNR/SSIM se ejecuta en vivo y offline, una reconstrucción en vivo y su gemela precalculada obtienen el mismo número.',
    },
    {
      id: 'deploy',
      en: 'Deploy',
      es: 'Despliegue',
      svg: svgDeploy,
      body_en:
        'ImageLab deploys as a static site on GitHub Pages. A GitHub Actions workflow builds the single-page app and overlays the committed derived artifacts into the site, then publishes to the CDN behind imglab.fasl-work.com. There is no backend: everything the page needs is either fetched as a static artifact or computed live in your tab.\n\nThe offline bake is deliberately not run on deploy; the committed artifacts under data/derived are the inputs, so a deploy is fast and cannot drift from what was reviewed.',
      body_es:
        'ImageLab se despliega como sitio estático en GitHub Pages. Un flujo de GitHub Actions construye la aplicación de página única y superpone los artefactos derivados versionados en el sitio, luego publica al CDN detrás de imglab.fasl-work.com. No hay backend: todo lo que la página necesita se obtiene como artefacto estático o se calcula en vivo en la pestaña.\n\nEl precálculo offline deliberadamente no se ejecuta en el despliegue; los artefactos versionados bajo data/derived son las entradas, así que un despliegue es rápido y no puede desviarse de lo revisado.',
    },
  ],
};
