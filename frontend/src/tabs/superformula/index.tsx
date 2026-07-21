import { useEffect, useMemo, useRef } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { fitSuperformula, radialProfile, superformulaR, superformulaTex, superformulaText } from '../../engine/superformula';

function SuperformulaPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fit = useMemo(() => {
    if (!planes) return null;
    const prof = radialProfile(planes);
    if (!prof.ok) return null;
    return fitSuperformula(prof);
  }, [planes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fit) return;
    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cs = getComputedStyle(document.documentElement);
    const faint = cs.getPropertyValue('--color-fg-faint').trim() || '#8886';
    const accent = cs.getPropertyValue('--il-learned').trim() || '#b978d0';
    ctx.clearRect(0, 0, size, size);
    const toPx = (x: number, y: number): [number, number] => [size / 2 + x * size * 0.42, size / 2 - y * size * 0.42];
    // the extracted image profile, faint
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    fit.profile.theta.forEach((th, k) => {
      const [px, py] = toPx(fit.profile.r[k] * Math.cos(th), fit.profile.r[k] * Math.sin(th));
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    // the fitted superformula curve, accent
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const N = 720;
    for (let i = 0; i <= N; i++) {
      const th = (2 * Math.PI * i) / N;
      const r = fit.scale * superformulaR(fit.m, fit.n1, fit.n2, fit.n3, fit.a, fit.b, th);
      const [px, py] = toPx(r * Math.cos(th), r * Math.sin(th));
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }, [fit]);

  if (!planes) return <div className="il-panel il-panel-sub">{t('Loading...', 'Cargando...')}</div>;
  if (!fit)
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('No clear silhouette', 'Sin silueta clara')}>
          {t(
            'The superformula fits the outline of a single dominant shape; this image has no clear foreground silhouette to trace. Pick an image with a distinct subject (the math-art figures, a lit object).',
            'La superformula ajusta el contorno de una unica forma dominante; esta imagen no tiene una silueta de primer plano clara para trazar. Elige una imagen con un sujeto distinto (las figuras de arte matematico, un objeto iluminado).',
          )}
        </Callout>
      </div>
    );

  const downloadEquation = () => {
    const blob = new Blob([superformulaText(fit, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-superformula-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'shape',
      label: t('The shape', 'La forma'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-panel-t">{t('One shape, one formula', 'Una forma, una formula')}</div>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{fit.m}</div>
                <div className="il-kpi-l">{t('symmetry m', 'simetria m')}</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{fit.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">{t('outline PSNR', 'PSNR contorno')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'The outline of the selected image is traced and fitted by the single Gielis superformula, whose one shape parameter m sets the symmetry (petals, points, lobes) and three exponents set the sharpness. Symmetric figures (the rose, the star) collapse to an almost exact compact formula; an irregular silhouette gets its best symmetric superformula, drawn in colour over the traced outline (faint).',
                'El contorno de la imagen seleccionada se traza y se ajusta con la unica superformula de Gielis, cuyo parametro de forma m fija la simetria (petalos, puntas, lobulos) y tres exponentes fijan la nitidez. Las figuras simetricas (la rosa, la estrella) colapsan a una formula compacta casi exacta; una silueta irregular obtiene su mejor superformula simetrica, dibujada en color sobre el contorno trazado (tenue).',
              )}
            </p>
          </div>
          <div className="il-fourier-views" style={{ gridTemplateColumns: '1fr' }}>
            <figure className="il-fig">
              <canvas ref={canvasRef} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />
              <figcaption>{t('Superformula (colour) over the traced outline (faint)', 'Superformula (color) sobre el contorno trazado (tenue)')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    {
      id: 'written',
      label: t('The equation', 'La ecuacion'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>
            {t(
              'The actual fitted superformula of the selected image, with its real parameters. The whole outline is this one line of mathematics.',
              'La superformula ajustada real de la imagen seleccionada, con sus parametros reales. El contorno entero es esta unica linea de matematica.',
            )}
          </p>
          <Equation tex={superformulaTex(fit)} />
          <div className="il-chips" style={{ margin: '0.5rem 0' }}>
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download the parameters (.txt)', 'Descargar los parametros (.txt)')}
            </button>
          </div>
          <p className="il-panel-sub">
            {t('To draw it: x(theta) = r(theta) cos theta, y(theta) = r(theta) sin theta, sweep theta from 0 to 2 pi.',
              'Para dibujarla: x(theta) = r(theta) cos theta, y(theta) = r(theta) sin theta, recorre theta de 0 a 2 pi.')}
          </p>
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
              'The superformula generalizes the superellipse to polar coordinates with an angular multiplier m. The silhouette is reduced to a radial profile r(theta) about its centroid, and the symmetry order m plus the three exponents are fitted (best scale in closed form, exponents by coordinate descent, m by search).',
              'La superformula generaliza la superelipse a coordenadas polares con un multiplicador angular m. La silueta se reduce a un perfil radial r(theta) alrededor de su centroide, y el orden de simetria m mas los tres exponentes se ajustan (mejor escala en forma cerrada, exponentes por descenso de coordenadas, m por busqueda).',
            )}
          </p>
          <Equation tex={String.raw`r(\theta)=\left(\left|\tfrac{\cos(m\theta/4)}{a}\right|^{n_2}+\left|\tfrac{\sin(m\theta/4)}{b}\right|^{n_3}\right)^{-1/n_1}`} />
          <p>
            {t('A single equation that unifies circles, ellipses, polygons, stars and flowers; it is the compact, famous end of shape-as-formula ',
              'Una unica ecuacion que unifica circulos, elipses, poligonos, estrellas y flores; es el extremo compacto y famoso de forma-como-formula ')}
            (<Cite id="gielis2003" />). {t('Unlike the epicycle tab (an exact but many-term Fourier series of the contour), this is one line with five numbers, exact only for shapes the superformula can express.',
              'A diferencia de la pestana de epiciclos (una serie de Fourier del contorno exacta pero de muchos terminos), esta es una linea con cinco numeros, exacta solo para las formas que la superformula puede expresar.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['gielis2003']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Superformula views', 'Vistas de superformula')} />;
}

export const superformulaTab: TabModule = {
  id: 'superformula',
  family: 'primitives',
  labelEn: 'Superformula',
  labelEs: 'Superformula',
  lane: 'live',
  Panel: SuperformulaPanel,
};
