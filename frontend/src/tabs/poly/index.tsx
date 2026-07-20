import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { CHEB_CHANNELS, chebEquationTex, chebEquationText, fitChebyshev, type ChebFit } from '../../engine/chebyshev';

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function PolyPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [deg, setDeg] = useState(24);
  const [ch, setCh] = useState(0);

  // the polynomial series is fitted LIVE from the selected image's planes (uploads included)
  const fit: ChebFit | null = useMemo(() => (planes ? fitChebyshev(planes, deg) : null), [planes, deg]);

  if (!planes || !fit) return <div className="il-panel il-panel-sub">{t('Fitting the polynomial series...', 'Ajustando la serie polinomial...')}</div>;

  const m = deg + 1;
  const downloadEquation = () => {
    const blob = new Blob([chebEquationText(fit, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-chebyshev-equation-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'series',
      label: t('Polynomial series', 'Serie polinomial'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{fit.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{m * m}</div>
                <div className="il-kpi-l">{t('terms/channel', 'términos/canal')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Polynomial degree', 'Grado del polinomio')}</span>
                <b>{deg}</b>
              </div>
              <input className="range" type="range" min={2} max={48} step={1} value={deg} onChange={(e) => setDeg(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'The image is fitted LIVE as a tensor Chebyshev polynomial series, including your uploaded image: move the degree and the least-squares fit recomputes in the browser. Low degrees give the smooth global composition; high degrees chase texture but a polynomial cannot make a hard edge, so fidelity saturates: the classical moments trade-off.',
                'La imagen se ajusta EN VIVO como una serie polinomial tensorial de Chebyshev, incluida tu imagen cargada: mueve el grado y el ajuste de mínimos cuadrados se recalcula en el navegador. Los grados bajos dan la composición global suave; los altos persiguen la textura pero un polinomio no puede crear un borde duro, así que la fidelidad se satura: el clásico compromiso de los momentos.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <PlanesCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={fit.recon} />
              <figcaption>{t('Degree', 'Grado')} {deg} ({m * m} {t('terms', 'términos')})</figcaption>
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
              'The actual fitted polynomial series of the selected image, with its real coefficients: the largest terms of the chosen channel are written out in the Chebyshev basis. The download carries the complete coefficient matrices of all three channels.',
              'La serie polinomial ajustada real de la imagen seleccionada, con sus coeficientes reales: los términos mayores del canal elegido se escriben en la base de Chebyshev. La descarga lleva las matrices de coeficientes completas de los tres canales.',
            )}
          </p>
          <div className="il-chips" style={{ marginBottom: '0.5rem' }}>
            {CHEB_CHANNELS.map((name, i) => (
              <button key={name} className={`chip${ch === i ? ' on' : ''}`} onClick={() => setCh(i)}>
                {t('channel', 'canal')} {name}
              </button>
            ))}
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download all', 'Descargar los')} {3 * m * m} {t('coefficients (.txt)', 'coeficientes (.txt)')}
            </button>
          </div>
          <Equation tex={chebEquationTex(fit, ch)} />
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
              'Each channel is projected onto the tensor products of Chebyshev polynomials by least squares, computed with a discretely orthonormalized basis per axis so high orders stay numerically stable, then rotated back to the plain Chebyshev basis so the written equation stays legible.',
              'Cada canal se proyecta sobre los productos tensoriales de polinomios de Chebyshev por mínimos cuadrados, calculado con una base ortonormalizada discretamente por eje para que los órdenes altos sean numéricamente estables, y luego se rota de vuelta a la base de Chebyshev simple para que la ecuación escrita sea legible.',
            )}
          </p>
          <Equation tex={String.raw`\mathrm{ch}(x,y)=\sum_{i=0}^{d}\sum_{j=0}^{d} a_{ij}\,T_j(x)\,T_i(y),\qquad T_k(t)=\cos(k\arccos t)`} />
          <p>
            {t('Discrete orthogonal moments are the classical polynomial image representation; using a basis orthogonal on the pixel grid avoids the numerical blow-up of continuous moments at high order ',
              'Los momentos ortogonales discretos son la representación polinomial clásica de imágenes; usar una base ortogonal en la grilla de píxeles evita la explosión numérica de los momentos continuos en orden alto ')}
            (<Cite id="mukundan2001tcheb" />). {t('This is the only equation family in the lab fitted entirely live: it works on your uploads too.',
              'Esta es la única familia de ecuaciones del laboratorio ajustada enteramente en vivo: también funciona con tus imágenes cargadas.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['mukundan2001tcheb']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Polynomial views', 'Vistas polinomiales')} />;
}

export const polyTab: TabModule = {
  id: 'poly',
  family: 'symbolic',
  labelEn: 'Polynomial series',
  labelEs: 'Serie polinomial',
  lane: 'live',
  Panel: PolyPanel,
};
