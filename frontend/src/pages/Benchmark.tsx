import { Callout, Equation, Cite } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';

export default function Benchmark() {
  const t = useT();
  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Benchmark', 'Benchmark')}</p>
      <h1>{t('Fidelity and cost, compared honestly', 'Fidelidad y costo, comparados honestamente')}</h1>
      <p className="il-lead">
        {t(
          'How faithfully does each representation reconstruct the image, and at what cost in parameters? The benchmark compares the families on held-out images with the standard metrics, and traces the rate-distortion curve: fidelity as a function of the number of coefficients, atoms, primitives or network weights kept.',
          'Con que fidelidad reconstruye cada representacion la imagen, y a que costo en parametros? El benchmark compara las familias sobre imagenes retenidas con las metricas estandar, y traza la curva tasa-distorsion: fidelidad en funcion del numero de coeficientes, atomos, primitivas o pesos de red conservados.',
        )}
      </p>

      <h2>{t('Metrics', 'Metricas')}</h2>
      <p>
        {t(
          'Pixel fidelity is measured by PSNR and the structural similarity index; perceptual fidelity by learned perceptual distance. Compression is read as a rate-distortion trade-off, fidelity against bits (or kept-parameter fraction).',
          'La fidelidad de pixel se mide por PSNR y el indice de similitud estructural; la fidelidad perceptual por la distancia perceptual aprendida. La compresion se lee como un compromiso tasa-distorsion, fidelidad contra bits (o fraccion de parametros conservados).',
        )}
      </p>
      <Equation tex={String.raw`\mathrm{PSNR}=10\log_{10}\!\frac{\mathrm{MAX}^2}{\mathrm{MSE}},\qquad \mathrm{SSIM}(x,y)=\frac{(2\mu_x\mu_y+c_1)(2\sigma_{xy}+c_2)}{(\mu_x^2+\mu_y^2+c_1)(\sigma_x^2+\sigma_y^2+c_2)}`} />
      <p>
        {t('Structural similarity ', 'La similitud estructural ')}(<Cite id="wang2004ssim" />)
        {t(' and the learned perceptual metric ', ' y la metrica perceptual aprendida ')}(<Cite id="zhang2018lpips" />)
        {t(' are reported alongside PSNR because a high PSNR can still look wrong, and a low PSNR can still look right.',
          ' se reportan junto a PSNR porque un PSNR alto puede verse mal, y un PSNR bajo puede verse bien.')}
      </p>

      <h2>{t('What the comparison will show', 'Que mostrara la comparacion')}</h2>
      <p>
        {t(
          'The expected story, to be confirmed by the measured numbers: transforms give a smooth rate-distortion curve but no semantics; learned dictionaries and neural fields reach higher fidelity per parameter; a per-image overfit neural codec can rival a strong classical codec; and generative representations trade faithfulness for editability. No number is asserted until it is baked from a real run.',
          'La historia esperada, a confirmar por los numeros medidos: las transformadas dan una curva tasa-distorsion suave pero sin semantica; los diccionarios aprendidos y los campos neuronales alcanzan mayor fidelidad por parametro; un codec neuronal sobreajustado por imagen puede rivalizar con un codec clasico fuerte; y las representaciones generativas cambian fidelidad por editabilidad. Ningun numero se afirma hasta hornearse de una corrida real.',
        )}
      </p>

      <Callout variant="honest" title={t('Honest empty state', 'Estado vacio honesto')}>
        {t(
          'The comparison tables and rate-distortion plots populate from the committed artifacts as each representation is implemented and run on the held-out images. Until then this page states the protocol, not results.',
          'Las tablas de comparacion y los graficos tasa-distorsion se llenan desde los artefactos versionados a medida que cada representacion se implementa y corre sobre las imagenes retenidas. Hasta entonces esta pagina expone el protocolo, no resultados.',
        )}
      </Callout>
    </div>
  );
}
