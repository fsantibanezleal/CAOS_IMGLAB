import { Callout } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';
import { FAMILIES } from '../lib/spectrum';

const DOMAINS: Array<[string, string]> = [
  ['Photograph', 'Fotografia'],
  ['Fine art', 'Arte'],
  ['Math-art', 'Arte matematico'],
  ['Biological', 'Biologico'],
  ['Microscopy', 'Microscopia'],
  ['Astronomy', 'Astronomia'],
  ['Texture', 'Textura'],
  ['Synthetic', 'Sintetico'],
];

export default function Experiments() {
  const t = useT();
  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Experiments', 'Experimentos')}</p>
      <h1>{t('Measuring editability across the spectrum', 'Midiendo la editabilidad a lo largo del espectro')}</h1>
      <p className="il-lead">
        {t(
          'The core experiment is the same for every representation: perturb its natural parameter by a controlled amount and measure how the image responds, then place the result on the stability-versus-semantics map. The coverage matrix pairs each image domain with each representation family.',
          'El experimento central es el mismo para cada representacion: perturba su parametro natural en una cantidad controlada y mide como responde la imagen, luego ubica el resultado en el mapa de estabilidad-versus-semantica. La matriz de cobertura empareja cada dominio de imagen con cada familia de representacion.',
        )}
      </p>

      <h2>{t('The perturbation protocol', 'El protocolo de perturbacion')}</h2>
      <p>
        {t(
          'For a fixed image and representation, take the fitted parameters, add a nudge of controlled magnitude to one parameter (a transform coefficient, a dictionary atom, a primitive, a network weight, a symbolic constant, a latent direction), reconstruct, and record two things: stability (how far the image moved, by reconstruction distance) and semantics (whether the change is a coherent, controllable edit or incoherent noise). Averaged over parameters and magnitudes, this places each family in one of four classes.',
          'Para una imagen y representacion fijas, toma los parametros ajustados, agrega un empujon de magnitud controlada a un parametro (un coeficiente de transformada, un atomo de diccionario, una primitiva, un peso de red, una constante simbolica, una direccion latente), reconstruye, y registra dos cosas: estabilidad (cuanto se movio la imagen, por distancia de reconstruccion) y semantica (si el cambio es una edicion coherente y controlable o ruido incoherente). Promediado sobre parametros y magnitudes, esto ubica cada familia en una de cuatro clases.',
        )}
      </p>

      <h2>{t('Coverage matrix (planned)', 'Matriz de cobertura (planificada)')}</h2>
      <div className="il-chart">
        <table className="il-table">
          <thead>
            <tr>
              <th>{t('Domain \\ Family', 'Dominio \\ Familia')}</th>
              {FAMILIES.map((f) => (
                <th key={f.id}>{String(f.index).padStart(2, '0')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map(([en, es]) => (
              <tr key={en}>
                <td>{t(en, es)}</td>
                {FAMILIES.map((f) => (
                  <td key={f.id} className="mono" style={{ color: 'var(--color-fg-faint)' }}>
                    &middot;
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-faint)' }}>
        {t(
          'Columns are the seven families (01 transforms to 07 diffusion). Cells fill with the measured editability class and reconstruction fidelity as each representation lands on each image.',
          'Las columnas son las siete familias (01 transformadas a 07 difusion). Las celdas se llenan con la clase de editabilidad medida y la fidelidad de reconstruccion a medida que cada representacion aterriza en cada imagen.',
        )}
      </p>

      <Callout variant="honest" title={t('Honest empty state', 'Estado vacio honesto')}>
        {t(
          'No measured cell is shown until its representation is wired and run on real images. The matrix above is the design, not a claim of results.',
          'No se muestra ninguna celda medida hasta que su representacion este conectada y corrida sobre imagenes reales. La matriz de arriba es el diseno, no una afirmacion de resultados.',
        )}
      </Callout>
    </div>
  );
}
