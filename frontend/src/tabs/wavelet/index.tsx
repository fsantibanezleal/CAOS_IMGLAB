import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { luma, paintField, paintPlanes, withChannels, type ImagePlanes } from '../../engine/image';
import { psnr, ssim } from '../../engine/metrics';
import { coeffField, dwt2, idwt2, keepTopFractionDwt, subbandThreshold, type WaveletName } from '../../engine/dwt';
import { UPlotChart } from '../../render/UPlotChart';

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

const NAMES: { id: WaveletName; label: string }[] = [
  { id: 'haar', label: 'Haar' },
  { id: 'db2', label: 'db2' },
  { id: 'db4', label: 'db4' },
  { id: 'cdf97', label: 'CDF 9/7' },
];

function WaveletPanel({ planes }: PanelProps) {
  const t = useT();
  const [name, setName] = useState<WaveletName>('db4');
  const [levels, setLevels] = useState(3);
  const [tau, setTau] = useState(0.05);
  const [mode, setMode] = useState<'soft' | 'hard'>('soft');

  const result = useMemo(() => {
    if (!planes) return null;
    const chans = [planes.r, planes.g, planes.b].map((ch) => {
      const t2 = subbandThreshold(dwt2(ch, planes.w, planes.h, name, levels), tau, mode);
      return idwt2(t2);
    });
    const recon = withChannels(planes, chans);
    const lumaCoeff = coeffField(dwt2(luma(planes), planes.w, planes.h, name, levels));
    return { recon, lumaCoeff, psnr: psnr(planes, recon), ssim: ssim(planes, recon) };
  }, [planes, name, levels, tau, mode]);

  if (!planes || !result) return <div className="il-panel il-panel-sub">{t('Loading...', 'Cargando...')}</div>;

  const tabs: SubTabDef[] = [
    {
      id: 'subbands',
      label: t('Subbands', 'Subbandas'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Wavelet', 'Wavelet')}</span>
                <b>{NAMES.find((n) => n.id === name)?.label}</b>
              </div>
              <div className="il-seg">
                {NAMES.map((n) => (
                  <button key={n.id} className={name === n.id ? 'on' : ''} onClick={() => setName(n.id)}>
                    {n.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Levels', 'Niveles')}</span>
                <b>{levels}</b>
              </div>
              <input className="range" type="range" min={1} max={5} step={1} value={levels} onChange={(e) => setLevels(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Threshold', 'Umbral')}</span>
                <b>{tau.toFixed(3)}</b>
              </div>
              <input className="range" type="range" min={0} max={0.3} step={0.005} value={tau} onChange={(e) => setTau(+e.target.value)} />
              <div className="il-seg" style={{ marginTop: '0.3rem' }}>
                {(['soft', 'hard'] as const).map((m) => (
                  <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                    {t(m === 'soft' ? 'Soft' : 'Hard', m === 'soft' ? 'Suave' : 'Duro')}
                  </button>
                ))}
              </div>
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{result.psnr === Infinity ? 'inf' : result.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result.ssim.toFixed(3)}</div>
                <div className="il-kpi-l">SSIM</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'Wavelet coefficients are localized in space AND scale: raising the threshold removes fine detail region by region, not everywhere at once. That local support is the difference from the global Fourier ripple.',
                'Los coeficientes wavelet estan localizados en espacio Y escala: subir el umbral quita el detalle fino region por region, no en todas partes a la vez. Ese soporte local es la diferencia con la onda global de Fourier.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <FieldCanvas field={result.lumaCoeff} w={planes.w} h={planes.h} />
              <figcaption>{t('Subband coefficients (Mallat layout)', 'Coeficientes por subbanda (Mallat)')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={result.recon} />
              <figcaption>{t('Reconstruction', 'Reconstruccion')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    { id: 'rd', label: t('Rate-distortion', 'Tasa-distorsion'), content: <WaveletRD planes={planes} name={name} levels={levels} /> },
    {
      id: 'method',
      label: t('Method', 'Metodo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('The DWT is a filter bank: low-pass and high-pass, downsample by two, recurse on the approximation; 2D is separable into four subbands per level (LL, LH, HL, HH).', 'La DWT es un banco de filtros: paso bajo y paso alto, submuestreo por dos, recursion sobre la aproximacion; en 2D se separa en cuatro subbandas por nivel (LL, LH, HL, HH).')}</p>
          <Equation tex={String.raw`a_j[n]=\sum_k h[k]\,x_j[2n+k],\qquad d_j[n]=\sum_k g[k]\,x_j[2n+k]`} />
          <p>
            {t('Haar is blocky, Daubechies is smooth, CDF 9/7 is the JPEG2000 biorthogonal default. Nonlinear approximation on piecewise-smooth images decays faster than Fourier or DCT, which is why wavelets win at low rate ',
              'Haar es en bloques, Daubechies es suave, CDF 9/7 es el biortogonal por defecto de JPEG2000. La aproximacion no lineal en imagenes suaves por partes decae mas rapido que Fourier o DCT, por eso las wavelets ganan a baja tasa ')}
            (<Cite id="mallat1989mra" />, <Cite id="daubechies1988" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['mallat1989mra', 'daubechies1988']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Wavelet views', 'Vistas wavelet')} />;
}

function FieldCanvas({ field, w, h }: { field: Float32Array; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintField(ref.current, field, w, h, { min: 0, max: 1 });
  }, [field, w, h]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%' }} />;
}

function WaveletRD({ planes, name, levels }: { planes: ImagePlanes; name: WaveletName; levels: number }) {
  const t = useT();
  const rd = useMemo(() => {
    const fracs = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.7, 1.0];
    const ts = [planes.r, planes.g, planes.b].map((ch) => dwt2(ch, planes.w, planes.h, name, levels));
    const xs: number[] = [];
    const ys: number[] = [];
    const ss: number[] = [];
    for (const f of fracs) {
      const recon = withChannels(planes, ts.map((tt) => idwt2(keepTopFractionDwt(tt, f))));
      xs.push(f * 100);
      const p = psnr(planes, recon);
      ys.push(p === Infinity ? 120 : p);
      ss.push(ssim(planes, recon) * 100);
    }
    return { xs, ys, ss };
  }, [planes, name, levels]);
  const data: [number[], number[], number[]] = [rd.xs, rd.ys, rd.ss];
  const series = useMemo(
    () => [
      { label: t('kept %', 'conservado %') },
      { label: 'PSNR (dB)', stroke: 'var(--il-transform)', width: 2, points: { show: true, size: 5 } },
      { label: 'SSIM x100', stroke: 'var(--il-designed)', width: 2, scale: 'ssim', points: { show: true, size: 5 } },
    ],
    [t],
  );
  return (
    <div>
      <p className="il-panel-sub" style={{ marginBottom: '0.6rem' }}>
        {t('Fidelity against the fraction of wavelet coefficients kept. Compare this curve to the Fourier and DCT tabs: on natural images the wavelet curve rises faster at low rate.', 'Fidelidad frente a la fraccion de coeficientes wavelet conservados. Compara esta curva con las pestanas de Fourier y DCT: en imagenes naturales la curva wavelet sube mas rapido a baja tasa.')}
      </p>
      <UPlotChart
        data={data}
        series={series}
        height={280}
        scales={{ x: { distr: 3, time: false }, ssim: { range: [0, 100] } }}
        axes={[{ label: t('coefficients kept (%)', 'coeficientes conservados (%)') }, { label: 'PSNR (dB)' }, { side: 1, scale: 'ssim', label: 'SSIM x100' }]}
      />
    </div>
  );
}

export const waveletTab: TabModule = {
  id: 'wavelet',
  family: 'transforms',
  labelEn: 'Wavelet',
  labelEs: 'Wavelet',
  lane: 'live',
  Panel: WaveletPanel,
};
