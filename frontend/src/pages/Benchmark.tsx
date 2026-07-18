import { useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { Callout, Equation, Cite } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';
import { UPlotChart } from '../render/UPlotChart';
import { loadBench, RD_FAMILIES, type Bench } from '../engine/bench';

export default function Benchmark() {
  const t = useT();
  const [bench, setBench] = useState<Bench | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadBench().then(setBench).catch((e) => setErr(String(e)));
  }, []);

  const { data, series } = useMemo(() => {
    if (!bench) return { data: [[]] as uPlot.AlignedData, series: [] as uPlot.Series[] };
    const xs = bench.fracs.map((f) => f * 100);
    const ys = RD_FAMILIES.map((fam) => bench.rd[fam.key]?.map((p) => p.psnr) ?? []);
    const s: uPlot.Series[] = [
      { label: t('kept %', 'kept %') },
      ...RD_FAMILIES.map((fam) => ({ label: fam.label, stroke: fam.color, width: 2, points: { show: true, size: 5 } })),
    ];
    return { data: [xs, ...ys] as uPlot.AlignedData, series: s };
  }, [bench, t]);

  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Benchmark', 'Benchmark')}</p>
      <h1>{t('Fidelity and cost, compared honestly', 'Fidelidad y costo, comparados honestamente')}</h1>
      <p className="il-lead">
        {t(
          'How faithfully does each representation reconstruct the image, and at what cost in parameters? Every number here is baked from a real run over a six-image subset spanning domains (photograph, fine art, math art, astronomy, texture, synthetic), measured on luma with the standard metrics.',
          'Con que fidelidad reconstruye cada representacion la imagen, y a que costo en parametros? Cada numero aqui se hornea de una corrida real sobre un subconjunto de seis imagenes que abarca dominios (fotografia, arte, arte matematico, astronomia, textura, sintetico), medido sobre luma con las metricas estandar.',
        )}
      </p>

      <h2>{t('Rate-distortion, the transform families', 'Tasa-distorsion, las familias de transformada')}</h2>
      <p>
        {t(
          'Keep only the largest coefficients and reconstruct: PSNR as a function of the kept-coefficient fraction. Wavelets, with their space-frequency localization, lead at every rate; the patch KLT is the data-optimal basis but its per-patch support caps it below the global bases here.',
          'Conserva solo los coeficientes mas grandes y reconstruye: PSNR en funcion de la fraccion de coeficientes conservados. Las wavelets, con su localizacion espacio-frecuencia, lideran en cada tasa; el KLT por parches es la base optima en datos pero su soporte por parche lo limita por debajo de las bases globales aqui.',
        )}
      </p>
      {err && <Callout variant="honest" title={t('Benchmark unavailable', 'Benchmark no disponible')}>{err}</Callout>}
      {bench && (
        <UPlotChart
          data={data}
          series={series}
          height={300}
          scales={{ x: { time: false } }}
          axes={[{ label: t('kept coefficients (%)', 'coeficientes conservados (%)') }, { label: 'PSNR (dB)' }]}
        />
      )}

      <h2>{t('Fixed-budget fidelity, all families', 'Fidelidad a presupuesto fijo, todas las familias')}</h2>
      <p>
        {t(
          'The transforms at five percent of their coefficients, next to the learned families read from their committed bakes. Read fidelity against the parameter cost: the neural field rivals the transforms from a few thousand weights; the primitive fit and the VAE latent sit lowest in PSNR because they buy semantics and editability, not pixel fidelity.',
          'Las transformadas al cinco por ciento de sus coeficientes, junto a las familias aprendidas leidas de sus horneados versionados. Lee la fidelidad contra el costo en parametros: el campo neuronal rivaliza con las transformadas desde unos pocos miles de pesos; el ajuste de primitivas y el latente VAE quedan mas bajos en PSNR porque compran semantica y editabilidad, no fidelidad de pixel.',
        )}
      </p>
      {bench && (
        <div className="il-chart" style={{ overflowX: 'auto' }}>
          <table className="il-table">
            <thead>
              <tr>
                <th>{t('Family', 'Familia')}</th>
                <th>PSNR (dB)</th>
                <th>SSIM</th>
                <th>{t('Parameters', 'Parametros')}</th>
                <th>{t('Basis', 'Base')}</th>
              </tr>
            </thead>
            <tbody>
              {bench.budget.map((b) => (
                <tr key={b.family}>
                  <td><b>{b.family}</b></td>
                  <td>{b.psnr.toFixed(2)}</td>
                  <td>{b.ssim == null ? '-' : b.ssim.toFixed(3)}</td>
                  <td>{b.params}</td>
                  <td className="il-panel-sub">{b.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>{t('Metrics', 'Metricas')}</h2>
      <Equation tex={String.raw`\mathrm{PSNR}=10\log_{10}\!\frac{\mathrm{MAX}^2}{\mathrm{MSE}},\qquad \mathrm{SSIM}(x,y)=\frac{(2\mu_x\mu_y+c_1)(2\sigma_{xy}+c_2)}{(\mu_x^2+\mu_y^2+c_1)(\sigma_x^2+\sigma_y^2+c_2)}`} />
      <p>
        {t('Structural similarity ', 'La similitud estructural ')}(<Cite id="wang2004ssim" />)
        {t(' is reported alongside PSNR because a high PSNR can still look wrong, and a low PSNR can still look right. The same PSNR/SSIM code runs here and in the browser, so a baked number and its live twin agree.',
          ' se reporta junto a PSNR porque un PSNR alto puede verse mal, y un PSNR bajo puede verse bien. El mismo codigo PSNR/SSIM corre aqui y en el navegador, asi que un numero horneado y su gemelo en vivo coinciden.')}
      </p>
    </div>
  );
}
