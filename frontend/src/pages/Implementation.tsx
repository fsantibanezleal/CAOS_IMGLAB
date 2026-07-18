import { Callout, Cite } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';

export default function Implementation() {
  const t = useT();
  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Implementation', 'Implementacion')}</p>
      <h1>{t('How it is built', 'Como esta construido')}</h1>
      <p className="il-lead">
        {t(
          'ImageLab is an offline pipeline plus a static single-page app. The pipeline is the product; the app is a read-only projection of what the pipeline bakes, with the light transforms recomputed live in the browser.',
          'ImageLab es un pipeline offline mas una aplicacion estatica de una sola página. El pipeline es el producto; la app es una proyeccion de solo lectura de lo que el pipeline hornea, con las transformadas ligeras recalculadas en vivo en el navegador.',
        )}
      </p>

      <h2>{t('Three lanes', 'Tres carriles')}</h2>
      <p>
        <span className="il-badge live">{t('live', 'en vivo')}</span>{' '}
        {t(
          'Fourier, cosine and wavelet transforms, coefficient editing and reconstruction, primitive rendering, and coordinate-network and symbolic shaders run entirely in your browser (JavaScript, WebAssembly and WebGL), so the interaction is instant.',
          'Las transformadas de Fourier, coseno y wavelet, la edicion de coeficientes y la reconstrucción, el render de primitivas, y los shaders de red-coordenada y simbolicos corren enteramente en tu navegador (JavaScript, WebAssembly y WebGL), así la interaccion es instantanea.',
        )}
      </p>
      <p>
        <span className="il-badge replay">{t('replay', 'replay')}</span>{' '}
        {t(
          'Learned dictionaries, trained neural fields, generative latent walks and diffusion sequences are too heavy for the browser: they are computed once, offline, and the app replays the committed artifacts.',
          'Los diccionarios aprendidos, los campos neuronales entrenados, las caminatas en latentes generativos y las secuencias de difusion son demasiado pesados para el navegador: se calculan una vez, offline, y la app reproduce los artefactos versionados.',
        )}
      </p>
      <p>
        <span className="il-badge real">{t('offline', 'offline')}</span>{' '}
        {t(
          'A Python pipeline (numpy, scipy, PyWavelets, scikit-image, scikit-learn, PyTorch) runs the real engines and bakes each representation of each image into a compact, standard-format artifact plus a manifest. A measured gate records, per image and method, which lane ran and why.',
          'Un pipeline en Python (numpy, scipy, PyWavelets, scikit-image, scikit-learn, PyTorch) corre los motores reales y hornea cada representacion de cada imagen en un artefacto compacto de formato estandar mas un manifiesto. Una compuerta medida registra, por imagen y método, que carril corrio y por que.',
        )}
      </p>

      <h2>{t('Two data contracts', 'Dos contratos de datos')}</h2>
      <p>
        {t(
          'An ingestion contract defines a valid input image (format, size, colour and an explicit license field), so the tool accepts your own image, not just the built-in set. An artifact contract defines the compact representation-plus-manifest the web reads, mirrored by a TypeScript type so a drift fails the build. Compression fidelity is scored with PSNR and SSIM ',
          'Un contrato de ingesta define una imagen de entrada valida (formato, tamaño, color y un campo explicito de licencia), para que la herramienta acepte tu propia imagen, no solo el conjunto incluido. Un contrato de artefacto define la representacion compacta mas manifiesto que lee la web, espejado por un tipo TypeScript para que una divergencia rompa el build. La fidelidad de compresion se evalua con PSNR y SSIM ',
        )}
        (<Cite id="wang2004ssim" />).
      </p>

      <Callout variant="note" title={t('Deploy', 'Despliegue')}>
        {t(
          'A public static site over the committed artifacts, published by continuous integration. Every number is either computed live in your browser or reproducible by running the open pipeline from the repository.',
          'Un sitio estático publico sobre los artefactos versionados, publicado por integracion continua. Cada número se calcula en vivo en tu navegador o es reproducible corriendo el pipeline abierto desde el repositorio.',
        )}
      </Callout>

      <Callout variant="honest" title={t('Status', 'Estado')}>
        {t(
          'The pipeline stages and the live transforms are wired representation by representation. This page names the exact modules, artifact schema and per-method lane verdicts as each representation lands.',
          'Las etapas del pipeline y las transformadas en vivo se conectan representacion por representacion. Esta página nombra los modulos exactos, el esquema de artefacto y los veredictos de carril por método a medida que cada representacion aterriza.',
        )}
      </Callout>
    </div>
  );
}
