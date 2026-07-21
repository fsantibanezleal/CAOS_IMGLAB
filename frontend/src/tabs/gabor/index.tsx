import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { GaborRenderer, gaborEquationTex, gaborEquationText, loadGabor, loadGaborIndex, packGabor, type GaborDoc } from '../../engine/gabor';

const RENDER = 288;

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function GaborPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [fitted, setFitted] = useState<string[] | null>(null);
  const [doc, setDoc] = useState<GaborDoc | null>(null);
  const [count, setCount] = useState(250);
  const [ch, setCh] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GaborRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadGaborIndex().then((i) => setFitted(i.fitted)).catch(() => setFitted([]));
  }, []);
  useEffect(() => {
    setDoc(null);
    if (fitted && fitted.includes(entry.id)) loadGabor(entry.id).then((d) => { setDoc(d); setCount(d.atoms.length); }).catch(() => setDoc(null));
  }, [entry.id, fitted]);

  useEffect(() => {
    if (!canvasRef.current || !doc) return;
    try {
      rendererRef.current?.dispose();
      rendererRef.current = new GaborRenderer(canvasRef.current, doc.atoms.length);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [doc]);

  const flat = useMemo(() => (doc ? packGabor(doc, doc.atoms.length) : null), [doc]);
  useEffect(() => {
    if (!rendererRef.current || !flat || !doc) return;
    try {
      rendererRef.current.render(flat, count, doc.size, RENDER);
    } catch (e) {
      setErr(String(e));
    }
  }, [flat, doc, count]);

  if (fitted && !fitted.includes(entry.id)) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Fitted for the curated set', 'Ajustado para el conjunto curado')}>
          {t(
            'The matching-pursuit search is an offline step baked for every curated image; your uploaded image is handled by the live transform, dictionary and polynomial tabs.',
            'La búsqueda por matching pursuit es un paso offline precalculado para cada imagen curada; la imagen cargada se maneja en las pestañas en vivo de transformada, diccionario y polinomios.',
          )}
        </Callout>
      </div>
    );
  }
  if (err) return <div className="il-panel il-panel-sub">{t('Renderer error: ', 'Error del renderizador: ')}<code>{err}</code></div>;
  if (!doc || !planes) return <div className="il-panel il-panel-sub">{t('Loading the atoms...', 'Cargando los átomos...')}</div>;

  const downloadEquation = () => {
    const blob = new Blob([gaborEquationText(doc, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-gabor-equation-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'atoms',
      label: t('Wave packets', 'Paquetes de onda'),
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
                <div className="il-kpi-l">{t('atoms', 'átomos')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Atoms rendered', 'Átomos renderizados')}</span>
                <b>{count} / {doc.atoms.length}</b>
              </div>
              <input className="range" type="range" min={1} max={doc.atoms.length} step={1} value={count} onChange={(e) => setCount(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'The image is written as a sum of Gabor wave packets: each term is a Gaussian envelope times an oriented cosine, chosen greedily to remove the most energy from the residual. Slide from one atom up to watch the image assemble from localized waves; the strongest atoms lock onto the dominant edges and textures.',
                'La imagen se escribe como una suma de paquetes de onda de Gabor: cada término es una envolvente gaussiana por un coseno orientado, elegido de forma voraz para quitar la mayor energía del residuo. Desliza desde un átomo para ver la imagen armarse con ondas localizadas; los átomos más fuertes se fijan en los bordes y texturas dominantes.',
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
              <figcaption>{count} {t('Gabor atoms', 'átomos de Gabor')}</figcaption>
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
              'The actual fitted Gabor equation of the selected image: every term is a product of a Gaussian and a cosine with its real amplitude, width, orientation, frequency and phase. The strongest atoms of the chosen channel are written out; the download carries all of them.',
              'La ecuación de Gabor ajustada real de la imagen seleccionada: cada término es un producto de una gaussiana y un coseno con su amplitud, ancho, orientación, frecuencia y fase reales. Los átomos más fuertes del canal elegido se escriben; la descarga lleva todos.',
            )}
          </p>
          <div className="il-chips" style={{ marginBottom: '0.5rem' }}>
            {['R', 'G', 'B'].map((name, i) => (
              <button key={name} className={`chip${ch === i ? ' on' : ''}`} onClick={() => setCh(i)}>
                {t('channel', 'canal')} {name}
              </button>
            ))}
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download all', 'Descargar todos')} {doc.atoms.length} {t('atoms (.txt)', 'átomos (.txt)')}
            </button>
          </div>
          <Equation tex={gaborEquationTex(doc, ch)} />
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
              'Matching pursuit decomposes the image over a redundant dictionary of Gabor functions: at each step the atom that best matches the residual is selected, its per-channel amplitude and phase are solved in closed form on the quadrature pair, and its contribution is subtracted.',
              'Matching pursuit descompone la imagen sobre un diccionario redundante de funciones de Gabor: en cada paso se selecciona el átomo que mejor coincide con el residuo, su amplitud y fase por canal se resuelven en forma cerrada sobre el par en cuadratura, y su contribución se resta.',
            )}
          </p>
          <Equation tex={String.raw`g_k(x,y)=e^{-\frac{u^2}{2\sigma_x^2}-\frac{v^2}{2\sigma_y^2}}\cos(\omega u-\varphi),\qquad (u,v)=R_\theta\big((x,y)-\mu\big)`} />
          <p>
            {t('Gabor atoms are the optimal joint space-frequency wave packets, and greedy pursuit over them is the classical sparse image-as-equation ',
              'Los átomos de Gabor son los paquetes de onda óptimos en espacio-frecuencia conjunta, y la búsqueda voraz sobre ellos es el clásico imagen-como-ecuación disperso ')}
            (<Cite id="mallat1993mp" />, <Cite id="daugman1985gabor" />). {t('Compare the dictionary tab: there the atoms are learned patches on a grid; here each atom is a free analytic function with five geometric parameters of its own.',
              'Compara con la pestaña de diccionarios: allí los átomos son parches aprendidos en una grilla; aquí cada átomo es una función analítica libre con cinco parámetros geométricos propios.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['mallat1993mp', 'daugman1985gabor']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Gabor views', 'Vistas de Gabor')} />;
}

export const gaborTab: TabModule = {
  id: 'gabor',
  family: 'symbolic',
  labelEn: 'Gabor atoms',
  labelEs: 'Átomos de Gabor',
  lane: 'live',
  Panel: GaborPanel,
};
