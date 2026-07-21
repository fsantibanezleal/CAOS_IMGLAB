import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { loadRbf, loadRbfIndex, packRbf, RbfRenderer, rbfEquationTex, rbfEquationText, type RbfDoc } from '../../engine/rbf';

const RENDER = 288;

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function RbfPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [fitted, setFitted] = useState<string[] | null>(null);
  const [doc, setDoc] = useState<RbfDoc | null>(null);
  const [ch, setCh] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RbfRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadRbfIndex().then((i) => setFitted(i.fitted)).catch(() => setFitted([]));
  }, []);
  useEffect(() => {
    setDoc(null);
    if (fitted && fitted.includes(entry.id)) loadRbf(entry.id).then(setDoc).catch(() => setDoc(null));
  }, [entry.id, fitted]);

  useEffect(() => {
    if (!canvasRef.current || !doc) return;
    try {
      rendererRef.current?.dispose();
      rendererRef.current = new RbfRenderer(canvasRef.current, doc.grid * doc.grid);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [doc]);

  const flat = useMemo(() => (doc ? packRbf(doc) : null), [doc]);
  useEffect(() => {
    if (!rendererRef.current || !flat) return;
    try {
      rendererRef.current.render(flat, RENDER);
    } catch (e) {
      setErr(String(e));
    }
  }, [flat]);

  if (fitted && !fitted.includes(entry.id)) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Fitted for the curated set', 'Ajustado para el conjunto curado')}>
          {t(
            'The radial-basis weights are solved offline for every curated image; your uploaded image is handled by the live transform, dictionary and polynomial tabs.',
            'Los pesos de base radial se resuelven offline para cada imagen curada; la imagen cargada se maneja en las pestanas en vivo de transformada, diccionario y polinomios.',
          )}
        </Callout>
      </div>
    );
  }
  if (err) return <div className="il-panel il-panel-sub">{t('Renderer error: ', 'Error del renderizador: ')}<code>{err}</code></div>;
  if (!doc || !planes) return <div className="il-panel il-panel-sub">{t('Loading the kernels...', 'Cargando los nucleos...')}</div>;

  const downloadEquation = () => {
    const blob = new Blob([rbfEquationText(doc, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-rbf-equation-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'field',
      label: t('Radial field', 'Campo radial'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{doc.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">{t('fit PSNR (dB)', 'PSNR ajuste (dB)')}</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{doc.grid * doc.grid}</div>
                <div className="il-kpi-l">{t('kernels', 'nucleos')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'The image is one weighted sum of the same thin-plate radial function centered on a grid, plus a plane. Only the linear weights are fitted, solved exactly in closed form (no gradient search). The result is smooth: broad content is captured cleanly and sharp edges soften, the honest signature of a smooth interpolation equation.',
                'La imagen es una suma ponderada de la misma funcion radial de placa delgada centrada en una grilla, mas un plano. Solo se ajustan los pesos lineales, resueltos exactamente en forma cerrada (sin busqueda por gradiente). El resultado es suave: el contenido amplio se captura limpio y los bordes nitidos se suavizan, la firma honesta de una ecuacion de interpolacion suave.',
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
              <figcaption>{t('RBF equation, evaluated per pixel', 'Ecuacion RBF, evaluada por pixel')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    {
      id: 'written',
      label: t('Written equation', 'Ecuacion escrita'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t(
              'The actual fitted RBF equation of the selected image: the affine plane plus the largest-weight radial kernels of the chosen channel, with their real weights and centers. The download carries every weight of all three channels.',
              'La ecuacion RBF ajustada real de la imagen seleccionada: el plano afin mas los nucleos radiales de mayor peso del canal elegido, con sus pesos y centros reales. La descarga lleva cada peso de los tres canales.',
            )}
          </p>
          <div className="il-chips" style={{ marginBottom: '0.5rem' }}>
            {['R', 'G', 'B'].map((name, i) => (
              <button key={name} className={`chip${ch === i ? ' on' : ''}`} onClick={() => setCh(i)}>
                {t('channel', 'canal')} {name}
              </button>
            ))}
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download all', 'Descargar los')} {3 * doc.grid * doc.grid} {t('weights (.txt)', 'pesos (.txt)')}
            </button>
          </div>
          <Equation tex={rbfEquationTex(doc, ch)} />
        </div>
      ),
    },
    {
      id: 'method',
      label: t('Method', 'Metodo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t(
              'A fixed grid of thin-plate radial kernels plus an affine term spans a function space; the weights that best reconstruct the image are the ridge-regularized least-squares solution, a single linear solve.',
              'Una grilla fija de nucleos radiales de placa delgada mas un termino afin generan un espacio de funciones; los pesos que mejor reconstruyen la imagen son la solucion de minimos cuadrados con regularizacion ridge, un unico sistema lineal.',
            )}
          </p>
          <Equation tex={String.raw`\mathrm{ch}(x,y)=a_0+a_1x+a_2y+\sum_{i=1}^{K} w_{i,\mathrm{ch}}\,\phi\big(\lVert(x,y)-\mathbf c_i\rVert\big),\quad \phi(r)=r^2\log r`} />
          <p>
            {t('The thin-plate spline is the smoothest interpolant of scattered data (it minimizes bending energy); the radial-basis idea originates with Hardy multiquadrics ',
              'La spline de placa delgada es el interpolante mas suave de datos dispersos (minimiza la energia de flexion); la idea de base radial se origina con los multicuadricos de Hardy ')}
            (<Cite id="bookstein1989tps" />, <Cite id="hardy1971mq" />). {t('Contrast the Gaussian mixture: there the bumps are free, anisotropic and found by gradient descent; here the kernels are fixed and only the linear weights are solved.',
              'Compara con la mezcla gaussiana: alli las cupulas son libres, anisotropas y halladas por descenso de gradiente; aqui los nucleos son fijos y solo se resuelven los pesos lineales.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['bookstein1989tps', 'hardy1971mq']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('RBF views', 'Vistas RBF')} />;
}

export const rbfTab: TabModule = {
  id: 'rbf',
  family: 'symbolic',
  labelEn: 'Radial basis',
  labelEs: 'Base radial',
  lane: 'live',
  Panel: RbfPanel,
};
