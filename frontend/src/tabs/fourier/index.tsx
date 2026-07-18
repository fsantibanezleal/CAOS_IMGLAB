import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, InlineMath, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintField, paintPlanes, withChannels, type ImagePlanes } from '../../engine/image';
import { psnr, ssim } from '../../engine/metrics';
import {
  type Complex2D,
  type CoeffMask,
  applyMask,
  fft2Image,
  ifft2,
  keepTopFraction,
  logMagnitudeShifted,
  magPhaseMix,
  radialFreq,
} from '../../engine/fft2';
import { UPlotChart } from '../../render/UPlotChart';

const LUMA_CH = 0; // show the red channel spectrum (representative; masks apply to all channels identically)

function radialMask(cutoffFrac: number, high: boolean, w: number, h: number): CoeffMask {
  const rmax = Math.hypot(w / 2, h / 2);
  const cut = cutoffFrac * rmax;
  return (u, v) => {
    const r = radialFreq(u, v, w, h);
    return (high ? r >= cut : r <= cut) ? 1 : 0;
  };
}

/** Normalize planes to [0,1] per image for display (magnitude/phase-only reconstructions are not in range). */
function normalizeForDisplay(p: ImagePlanes): ImagePlanes {
  const all = [p.r, p.g, p.b];
  let mn = Infinity;
  let mx = -Infinity;
  for (const ch of all)
    for (let i = 0; i < ch.length; i++) {
      if (ch[i] < mn) mn = ch[i];
      if (ch[i] > mx) mx = ch[i];
    }
  const range = mx - mn || 1;
  const norm = (ch: Float32Array) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = (ch[i] - mn) / range;
    return out;
  };
  return { r: norm(p.r), g: norm(p.g), b: norm(p.b), w: p.w, h: p.h };
}

type Mode = 'keep' | 'lowpass' | 'highpass';

function FourierPanel({ planes }: PanelProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('keep');
  const [amount, setAmount] = useState(0.1); // keep fraction OR cutoff fraction depending on mode

  // the transform is computed ONCE per image; only the mask + inverse recompute per control change
  const specs: Complex2D[] | null = useMemo(() => (planes ? fft2Image(planes) : null), [planes]);

  const op = useMemo(() => {
    if (!planes) return (c: Complex2D) => c;
    if (mode === 'keep') return (c: Complex2D) => keepTopFraction(c, amount);
    return (c: Complex2D) => applyMask(c, radialMask(amount, mode === 'highpass', planes.w, planes.h));
  }, [mode, amount, planes]);

  const recon: ImagePlanes | null = useMemo(() => {
    if (!planes || !specs) return null;
    return withChannels(
      planes,
      specs.map((c) => ifft2(op(c))),
    );
  }, [planes, specs, op]);

  const maskedSpec: Complex2D | null = useMemo(() => (specs ? op(specs[LUMA_CH]) : null), [specs, op]);

  const metrics = useMemo(() => (planes && recon ? { psnr: psnr(planes, recon), ssim: ssim(planes, recon) } : null), [planes, recon]);

  if (!planes || !specs) return <div className="il-panel il-panel-sub">{t('Loading the image...', 'Cargando la imagen...')}</div>;

  const amountLabel =
    mode === 'keep'
      ? `${(amount * 100).toFixed(amount < 0.01 ? 2 : 1)}% ${t('of coefficients', 'de coeficientes')}`
      : `${t('cutoff', 'corte')} ${(amount * 100).toFixed(0)}%`;

  const tabs: SubTabDef[] = [
    {
      id: 'spectrum',
      label: t('Spectrum', 'Espectro'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-seg">
              {(['keep', 'lowpass', 'highpass'] as Mode[]).map((m) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  {t(
                    m === 'keep' ? 'Keep top-k' : m === 'lowpass' ? 'Low-pass' : 'High-pass',
                    m === 'keep' ? 'Top-k' : m === 'lowpass' ? 'Paso bajo' : 'Paso alto',
                  )}
                </button>
              ))}
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>
                  {mode === 'keep' ? t('Coefficients kept', 'Coeficientes conservados') : t('Cutoff radius', 'Radio de corte')}
                </span>
                <b>{amountLabel}</b>
              </div>
              <input
                className="range"
                type="range"
                min={mode === 'keep' ? -3 : 0}
                max={mode === 'keep' ? 0 : 1}
                step={0.01}
                value={mode === 'keep' ? Math.log10(amount) : amount}
                onChange={(e) => setAmount(mode === 'keep' ? Math.pow(10, +e.target.value) : +e.target.value)}
              />
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{metrics ? (metrics.psnr === Infinity ? 'inf' : metrics.psnr.toFixed(1)) : '-'}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{metrics ? metrics.ssim.toFixed(3) : '-'}</div>
                <div className="il-kpi-l">SSIM</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'Every kept coefficient is a global sinusoid: editing one changes the whole image by a smooth ripple. Stable, bounded, never local. That is the transform family: compact but not semantic.',
                'Cada coeficiente conservado es una sinusoide global: editar uno cambia toda la imagen con una onda suave. Estable, acotado, nunca local. Esa es la familia de transformadas: compacta pero no semantica.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <SpectrumCanvas spec={maskedSpec} />
              <figcaption>{t('Spectrum (log magnitude, DC centred)', 'Espectro (log magnitud, DC centrado)')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={recon} />
              <figcaption>{t('Reconstruction', 'Reconstruccion')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    {
      id: 'phase',
      label: t('Phase', 'Fase'),
      content: <PhaseView specs={specs} planes={planes} />,
    },
    {
      id: 'rd',
      label: t('Rate-distortion', 'Tasa-distorsion'),
      content: <RateDistortion planes={planes} specs={specs} />,
    },
    {
      id: 'method',
      label: t('Method', 'Metodo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t('The image is a sum over the 2D Fourier basis; each coefficient F(u,v) is a global sinusoid.',
              'La imagen es una suma sobre la base de Fourier 2D; cada coeficiente F(u,v) es una sinusoide global.')}
          </p>
          <Equation tex={String.raw`F(u,v)=\sum_{x,y} f(x,y)\,e^{-j2\pi(ux/W+vy/H)},\quad f=\tfrac{1}{WH}\sum_{u,v}F(u,v)\,e^{+j2\pi(ux/W+vy/H)}`} />
          <p>
            {t('Editing one coefficient is an isometric change ', 'Editar un coeficiente es un cambio isometrico ')}
            <InlineMath tex={String.raw`\lVert\delta f\rVert_2=\lvert\delta F\rvert/\sqrt{WH}`} />
            {t(': stable and bounded, but global (Parseval). Keeping the largest coefficients is transform compression; the phase, not the magnitude, carries the structure ',
              ': estable y acotado, pero global (Parseval). Quedarse con los mayores coeficientes es compresion por transformada; la fase, no la magnitud, lleva la estructura ')}
            (<Cite id="cooley1965fft" />, <Cite id="oppenheim1981phase" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['cooley1965fft', 'oppenheim1981phase', 'wang2004ssim']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Fourier views', 'Vistas de Fourier')} />;
}

function SpectrumCanvas({ spec }: { spec: Complex2D | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (spec && ref.current) paintField(ref.current, logMagnitudeShifted(spec), spec.w, spec.h);
  }, [spec]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%' }} />;
}

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function PhaseView({ specs, planes }: { specs: Complex2D[]; planes: ImagePlanes }) {
  const t = useT();
  const [phaseMode, setPhaseMode] = useState<'both' | 'mag' | 'phase'>('phase');
  const recon = useMemo(() => {
    const mixed = specs.map((c) => ifft2(magPhaseMix(c, phaseMode)));
    const p = withChannels(planes, mixed);
    return phaseMode === 'both' ? p : normalizeForDisplay(p);
  }, [specs, planes, phaseMode]);
  return (
    <div className="il-fourier">
      <div className="il-fourier-controls il-panel">
        <div className="il-seg">
          {(['both', 'mag', 'phase'] as const).map((m) => (
            <button key={m} className={phaseMode === m ? 'on' : ''} onClick={() => setPhaseMode(m)}>
              {t(m === 'both' ? 'Full' : m === 'mag' ? 'Magnitude only' : 'Phase only', m === 'both' ? 'Completo' : m === 'mag' ? 'Solo magnitud' : 'Solo fase')}
            </button>
          ))}
        </div>
        <p className="il-panel-sub">
          {t(
            'Rebuild the image from only the magnitude of its Fourier transform, or only the phase. Magnitude alone is unrecognizable texture; phase alone keeps the edges and shapes. The structure of an image lives in its phase.',
            'Reconstruye la imagen usando solo la magnitud de su transformada de Fourier, o solo la fase. La magnitud sola es una textura irreconocible; la fase sola conserva bordes y formas. La estructura de una imagen vive en su fase.',
          )}
        </p>
      </div>
      <div className="il-fourier-views">
        <figure className="il-fig">
          <PlanesCanvas planes={recon} />
          <figcaption>
            {phaseMode === 'both'
              ? t('Full reconstruction', 'Reconstruccion completa')
              : phaseMode === 'mag'
                ? t('Magnitude only (normalized)', 'Solo magnitud (normalizada)')
                : t('Phase only (normalized)', 'Solo fase (normalizada)')}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

function RateDistortion({ planes, specs }: { planes: ImagePlanes; specs: Complex2D[] }) {
  const t = useT();
  const rd = useMemo(() => {
    const fracs = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.7, 1.0];
    const xs: number[] = [];
    const ys: number[] = [];
    const ss: number[] = [];
    for (const f of fracs) {
      const recon = withChannels(
        planes,
        specs.map((c) => ifft2(keepTopFraction(c, f))),
      );
      xs.push(f * 100);
      const p = psnr(planes, recon);
      ys.push(p === Infinity ? 120 : p);
      ss.push(ssim(planes, recon) * 100);
    }
    return { xs, ys, ss };
  }, [planes, specs]);

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
        {t(
          'Fidelity against the fraction of Fourier coefficients kept (the nonlinear-approximation curve). This is transform compression: quality climbs as you keep more coefficients.',
          'Fidelidad frente a la fraccion de coeficientes de Fourier conservados (la curva de aproximacion no lineal). Es la compresion por transformada: la calidad sube al conservar mas coeficientes.',
        )}
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

export const fourierTab: TabModule = {
  id: 'fourier',
  family: 'transforms',
  labelEn: 'Fourier',
  labelEs: 'Fourier',
  lane: 'live',
  Panel: FourierPanel,
};
