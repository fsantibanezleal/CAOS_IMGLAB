import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { GsplatRenderer, gsplatEquationTex, gsplatEquationText, loadGsplat, loadGsplatIndex, packGsplat, type GsplatDoc } from '../../engine/gsplat';

const RENDER = 288;

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function GsplatPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [fitted, setFitted] = useState<string[] | null>(null);
  const [doc, setDoc] = useState<GsplatDoc | null>(null);
  const [count, setCount] = useState(200);
  const [ch, setCh] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GsplatRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadGsplatIndex().then((i) => setFitted(i.fitted)).catch(() => setFitted([]));
  }, []);
  useEffect(() => {
    setDoc(null);
    if (fitted && fitted.includes(entry.id)) loadGsplat(entry.id).then((d) => { setDoc(d); setCount(d.gauss.length); }).catch(() => setDoc(null));
  }, [entry.id, fitted]);

  useEffect(() => {
    if (!canvasRef.current || !doc) return;
    try {
      rendererRef.current?.dispose();
      rendererRef.current = new GsplatRenderer(canvasRef.current, doc.gauss.length);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [doc]);

  const flat = useMemo(() => (doc ? packGsplat(doc, doc.gauss.length) : null), [doc]);
  useEffect(() => {
    if (!rendererRef.current || !flat || !doc) return;
    try {
      rendererRef.current.render(flat, count, RENDER);
    } catch (e) {
      setErr(String(e));
    }
  }, [flat, doc, count]);

  if (fitted && !fitted.includes(entry.id)) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Fitted for the curated set', 'Ajustado para el conjunto curado')}>
          {t(
            'The gradient-descent fit is an offline step baked for every curated image; your uploaded image is handled by the live transform, dictionary and polynomial tabs.',
            'El ajuste por descenso de gradiente es un paso offline precalculado para cada imagen curada; la imagen cargada se maneja en las pestañas en vivo de transformada, diccionario y polinomios.',
          )}
        </Callout>
      </div>
    );
  }
  if (err) return <div className="il-panel il-panel-sub">{t('Renderer error: ', 'Error del renderizador: ')}<code>{err}</code></div>;
  if (!doc || !planes) return <div className="il-panel il-panel-sub">{t('Loading the Gaussians...', 'Cargando las gaussianas...')}</div>;

  const downloadEquation = () => {
    const blob = new Blob([gsplatEquationText(doc, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-gaussians-equation-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'bumps',
      label: t('Gaussian bumps', 'Cúpulas gaussianas'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{doc.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">{t('fit PSNR (dB)', 'PSNR ajuste (dB)')}</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{count}</div>
                <div className="il-kpi-l">{t('Gaussians', 'gaussianas')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Gaussians rendered', 'Gaussianas renderizadas')}</span>
                <b>{count} / {doc.gauss.length}</b>
              </div>
              <input className="range" type="range" min={1} max={doc.gauss.length} step={1} value={count} onChange={(e) => setCount(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'The image is one equation: a sum of colored anisotropic Gaussian bumps, optimized jointly by gradient descent (the 2D Gaussian-splatting representation). Slide to add bumps by color mass: the mixture sketches the composition with a few dozen and sharpens as the small correction Gaussians arrive.',
                'La imagen es una ecuación: una suma de cúpulas gaussianas anisotrópicas de color, optimizadas en conjunto por descenso de gradiente (la representación de splatting gaussiano 2D). Desliza para agregar cúpulas por masa de color: la mezcla esboza la composición con unas pocas decenas y se afina cuando llegan las gaussianas pequeñas de corrección.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <OriginalCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <canvas ref={canvasRef} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />
              <figcaption>{count} {t('Gaussians', 'gaussianas')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    {
      id: 'written',
      label: t('Written equation', 'Ecuación escrita'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t(
              'The actual fitted Gaussian-mixture equation of the selected image: each term is a colored bump with its real center, quadratic form and weight. The largest terms of the chosen channel are written out; the download carries every Gaussian.',
              'La ecuación de mezcla gaussiana ajustada real de la imagen seleccionada: cada término es una cúpula de color con su centro, forma cuadrática y peso reales. Los términos mayores del canal elegido se escriben; la descarga lleva cada gaussiana.',
            )}
          </p>
          <div className="il-chips" style={{ marginBottom: '0.5rem' }}>
            {['R', 'G', 'B'].map((name, i) => (
              <button key={name} className={`chip${ch === i ? ' on' : ''}`} onClick={() => setCh(i)}>
                {t('channel', 'canal')} {name}
              </button>
            ))}
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download all', 'Descargar todas')} {doc.gauss.length} {t('Gaussians (.txt)', 'gaussianas (.txt)')}
            </button>
          </div>
          <Equation tex={gsplatEquationTex(doc, ch)} />
        </div>
      ),
    },
    {
      id: 'method',
      label: t('Method', 'Método'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t(
              'Two hundred anisotropic Gaussians (position, precision Cholesky, color) are optimized jointly with Adam against the L2 error, the accumulated-sum variant of 2D Gaussian splatting for images.',
              'Doscientas gaussianas anisotrópicas (posición, Cholesky de la precisión, color) se optimizan en conjunto con Adam contra el error L2, la variante de suma acumulada del splatting gaussiano 2D para imágenes.',
            )}
          </p>
          <Equation tex={String.raw`\mathrm{ch}(x,y)=b_{\mathrm{ch}}+\sum_{k=1}^{N} c_{k,\mathrm{ch}}\,\exp\!\Big(-\tfrac12\,\mathbf d_k^{\top}\Sigma_k^{-1}\mathbf d_k\Big),\qquad \mathbf d_k=(x,y)-\mu_k`} />
          <p>
            {t('The 2D image counterpart of the splatting representation behind real-time radiance fields; unlike the greedy ellipse tab (hard shapes, sequential fit) every Gaussian here is soft, analytic, and optimized jointly ',
              'La contraparte 2D en imágenes de la representación por splatting detrás de los campos de radiancia en tiempo real; a diferencia de la pestaña de elipses voraces (formas duras, ajuste secuencial) cada gaussiana aquí es suave, analítica y optimizada en conjunto ')}
            (<Cite id="zhang2024gaussianimage" />, <Cite id="kerbl2023gs" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['zhang2024gaussianimage', 'kerbl2023gs']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Gaussian views', 'Vistas gaussianas')} />;
}

export const gsplatTab: TabModule = {
  id: 'gsplat',
  family: 'symbolic',
  labelEn: 'Gaussian mixture',
  labelEs: 'Mezcla gaussiana',
  lane: 'live',
  Panel: GsplatPanel,
};
