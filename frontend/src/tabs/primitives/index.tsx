import { useEffect, useRef, useState } from 'react';
import { SubTabs, Equation, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { loadPrimIndex, loadPrimitives, renderShapes, renderedPSNR, type PrimDoc } from '../../engine/primitives';

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function PrimitivesPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [fitted, setFitted] = useState<string[] | null>(null);
  const [doc, setDoc] = useState<PrimDoc | null>(null);
  const [count, setCount] = useState(30);
  const [psnr, setPsnr] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPrimIndex().then((i) => setFitted(i.fitted)).catch(() => setFitted([]));
  }, []);
  useEffect(() => {
    setDoc(null);
    if (fitted && fitted.includes(entry.id)) loadPrimitives(entry.id).then(setDoc).catch(() => setDoc(null));
  }, [entry.id, fitted]);

  const nShapes = doc ? doc.shapes.length - 1 : 0;

  useEffect(() => {
    if (doc && planes && canvasRef.current) {
      renderShapes(canvasRef.current, doc, count, planes.w);
      setPsnr(renderedPSNR(canvasRef.current, planes));
    }
  }, [doc, count, planes]);

  if (fitted && !fitted.includes(entry.id)) {
    return (
      <div className="il-doc">
        <div className="il-wip">
          {t('Fitting shapes to an image is an offline search, so this tab is wired for a representative subset. Pick one of: ', 'Ajustar formas a una imagen es una busqueda offline, asi que esta pestana esta conectada para un subconjunto representativo. Elige una de: ')}
          <strong>{fitted.join(', ')}</strong>.
        </div>
      </div>
    );
  }
  if (!doc || !planes) return <div className="il-panel il-panel-sub">{t('Loading the shapes...', 'Cargando las formas...')}</div>;

  const tabs: SubTabDef[] = [
    {
      id: 'build',
      label: t('Build up', 'Construir'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Shapes', 'Formas')}</span>
                <b>{count} / {nShapes}</b>
              </div>
              <input className="range" type="range" min={0} max={nShapes} step={1} value={count} onChange={(e) => setCount(+e.target.value)} />
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{psnr === null ? '...' : psnr === Infinity ? 'inf' : psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{count}</div>
                <div className="il-kpi-l">{t('primitives', 'primitivas')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'The image is approximated by a stack of translucent ellipses, added greedily one at a time to reduce the error most. Slide from zero to see it build up. Each shape is independent and local: this is the cleanest editable representation, move or recolor one shape and only its region changes.',
                'La imagen se aproxima con una pila de elipses translucidas, agregadas de forma voraz una a una para reducir mas el error. Desliza desde cero para verla construirse. Cada forma es independiente y local: esta es la representacion editable mas limpia, mueve o recolorea una forma y solo cambia su region.',
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
              <figcaption>{count} {t('primitives', 'primitivas')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    {
      id: 'method',
      label: t('Method', 'Metodo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('Greedily add the shape that most reduces the reconstruction error; the error-optimal colour of each shape is solved in closed form at a fixed opacity.', 'Agrega de forma voraz la forma que mas reduce el error de reconstruccion; el color optimo de cada forma se resuelve en forma cerrada a una opacidad fija.')}</p>
          <Equation tex={String.raw`\text{shape}_{i}=\arg\max_{s}\ \big\lVert x-\hat x_{i-1}\big\rVert^2-\big\lVert x-\text{blend}(\hat x_{i-1},s)\big\rVert^2`} />
          <p>
            {t('a hill-climbing, difference-free version of the primitive and stroke-based rendering line; the modern differentiable-vectorization descendants optimize Bezier paths against a perceptual loss instead. Each primitive is a local, interpretable coordinate, so an edit stays local, the defining property of the semantic-local pole.',
              'una version por escalada de colina, sin diferenciacion, de la linea de render por primitivas y trazos; los descendientes modernos de vectorizacion diferenciable optimizan curvas de Bezier contra una perdida perceptual. Cada primitiva es una coordenada local e interpretable, asi que una edicion se mantiene local, la propiedad definitoria del polo semantico-local.')}
          </p>
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Primitive views', 'Vistas de primitivas')} />;
}

export const primitivesTab: TabModule = {
  id: 'primitives',
  family: 'primitives',
  labelEn: 'Primitives',
  labelEs: 'Primitivas',
  lane: 'live',
  Panel: PrimitivesPanel,
};
