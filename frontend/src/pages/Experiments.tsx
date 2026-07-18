import { useEffect, useState } from 'react';
import { Callout } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';
import { loadBench, type Bench } from '../engine/bench';

export default function Experiments() {
  const t = useT();
  const [bench, setBench] = useState<Bench | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadBench().then(setBench).catch((e) => setErr(String(e)));
  }, []);

  const isLocal = (c: number) => c >= 0.7;

  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Experiments', 'Experimentos')}</p>
      <h1>{t('Measuring editability across the spectrum', 'Midiendo la editabilidad a lo largo del espectro')}</h1>
      <p className="il-lead">
        {t(
          'The core experiment is the same for every representation: perturb one of its natural parameters by a controlled amount and measure how the image responds. The question is not only how far the image moves, but where: a local, exact edit changes one region; a global, entangled edit changes the whole picture at once.',
          'El experimento central es el mismo para cada representacion: perturba uno de sus parametros naturales en una cantidad controlada y mide como responde la imagen. La pregunta no es solo cuanto se mueve la imagen, sino donde: una edicion local y exacta cambia una region; una edicion global y enredada cambia la imagen entera a la vez.',
        )}
      </p>

      <h2>{t('The perturbation protocol', 'El protocolo de perturbacion')}</h2>
      <p>
        {t(
          'For a fixed image and representation, take the fitted parameters, add a nudge to one parameter (a transform coefficient, a patch component, a dictionary atom, a primitive, a network weight, a latent), reconstruct, and measure the change. Locality is the share of the total pixel-change energy that lands in the most-affected ten percent of pixels: near one means the edit is concentrated (local and controllable), near zero means it is spread across the image (global and entangled). The numbers below are the mean over a six-image subset spanning domains.',
          'Para una imagen y representacion fijas, toma los parametros ajustados, agrega un empujon a un parametro (un coeficiente de transformada, una componente de parche, un atomo de diccionario, una primitiva, un peso de red, un latente), reconstruye, y mide el cambio. La localidad es la fraccion de la energia total de cambio de pixeles que cae en el diez por ciento de pixeles mas afectados: cerca de uno significa que la edicion esta concentrada (local y controlable), cerca de cero significa que se reparte por la imagen (global y enredada). Los numeros de abajo son el promedio sobre un subconjunto de seis imagenes que abarca dominios.',
        )}
      </p>

      <h2>{t('Measured locality of a one-parameter edit', 'Localidad medida de una edicion de un parametro')}</h2>
      {err && <Callout variant="honest" title={t('Benchmark unavailable', 'Benchmark no disponible')}>{err}</Callout>}
      {bench && (
        <div className="il-chart">
          <table className="il-table">
            <thead>
              <tr>
                <th>{t('Representation', 'Representacion')}</th>
                <th>{t('Change concentration', 'Concentracion del cambio')}</th>
                <th>{t('Edit class', 'Clase de edicion')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...bench.locality].sort((a, b) => b.concentration - a.concentration).map((r) => (
                <tr key={r.family}>
                  <td><b>{r.family}</b></td>
                  <td className="mono">{r.concentration.toFixed(3)}</td>
                  <td>{isLocal(r.concentration) ? t('local, exact', 'local, exacta') : t('global, spread', 'global, repartida')}</td>
                  <td style={{ minWidth: 160 }}>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)' }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          width: `${Math.round(r.concentration * 100)}%`,
                          background: isLocal(r.concentration) ? 'var(--il-designed, #5cb85c)' : 'var(--il-transform, #e0863a)',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        {t(
          'The result is sharp: a wavelet or patch-KLT coefficient edits a single local region (concentration near one), while a Fourier or full-frame DCT coefficient smears its change across the whole image (concentration far below). Locality is not the same as being a designed basis: it is space-localization that buys the exact, regional edit, which is exactly why wavelets underpin image editing and Fourier does not.',
          'El resultado es nitido: un coeficiente wavelet o KLT por parches edita una unica region local (concentracion cerca de uno), mientras que un coeficiente de Fourier o DCT de cuadro completo reparte su cambio por toda la imagen (concentracion muy por debajo). La localidad no es lo mismo que ser una base disenada: es la localizacion espacial la que compra la edicion exacta y regional, que es exactamente por que las wavelets sustentan la edicion de imagenes y Fourier no.',
        )}
      </p>

      <Callout variant="honest" title={t('Scope of what is measured', 'Alcance de lo medido')}>
        {t(
          'Locality is measured directly for the four transform families, whose reconstruction is a clean linear map. For the dictionary, primitive, neural-field and generative families the same protocol is illustrated live in each App tab (perturb an atom, a shape, a weight, a latent) but not reduced to one number here, because their reconstruction is nonlinear and a single scalar would flatten it. The fidelity of every family, learned ones included, is compared in the Benchmark.',
          'La localidad se mide directamente para las cuatro familias de transformada, cuya reconstruccion es un mapa lineal limpio. Para las familias de diccionario, primitivas, campo neuronal y generativas el mismo protocolo se ilustra en vivo en cada pestana de la App (perturba un atomo, una forma, un peso, un latente) pero no se reduce a un numero aqui, porque su reconstruccion es no lineal y un solo escalar la aplanaria. La fidelidad de cada familia, incluidas las aprendidas, se compara en el Benchmark.',
        )}
      </Callout>
    </div>
  );
}
