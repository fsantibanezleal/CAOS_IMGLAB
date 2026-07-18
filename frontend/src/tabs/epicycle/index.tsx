import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Pause, Play } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { PRESETS, type Contour, type PresetName, epicycleChain, presetContour, reconstructPath, traceContour } from '../../engine/epicycle';

type Source = PresetName | 'image';

function EpicyclePanel({ planes }: PanelProps) {
  const t = useT();
  const [source, setSource] = useState<Source>('heart');
  const [k, setK] = useState(12);
  const [playing, setPlaying] = useState(false);

  const contour: Contour | null = useMemo(() => {
    if (source === 'image') return planes ? traceContour(planes) : null;
    return presetContour(source);
  }, [source, planes]);

  const fullPath = useMemo(() => (contour ? reconstructPath(contour.terms, k) : null), [contour, k]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  // draw the epicycle chain + the pen trail at the current phase
  const draw = useMemo(
    () => () => {
      const canvas = canvasRef.current;
      if (!canvas || !contour || !fullPath) return;
      const size = 360;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cs = getComputedStyle(document.documentElement);
      const fg = cs.getPropertyValue('--color-fg').trim() || '#ddd';
      const faint = cs.getPropertyValue('--color-fg-faint').trim() || '#8886';
      const accent = cs.getPropertyValue('--il-designed').trim() || '#3fb950';
      const toPx = (x: number, y: number): [number, number] => [size / 2 + x * size * 0.4, size / 2 + y * size * 0.4];
      ctx.clearRect(0, 0, size, size);
      // full reconstructed contour, faint
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < fullPath.length; i += 2) {
        const [px, py] = toPx(fullPath[i], fullPath[i + 1]);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      // pen trail up to the current phase
      const phase = phaseRef.current;
      const idx = Math.floor((phase / (2 * Math.PI)) * (fullPath.length / 2));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= idx; i++) {
        const [px, py] = toPx(fullPath[2 * i], fullPath[2 * i + 1]);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      // epicycle circles + radial arms at the current phase
      const chain = epicycleChain(contour.terms, k, phase);
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < chain.length - 1; i++) {
        const node = chain[i];
        const [cx, cy] = toPx(node.cx, node.cy);
        const r = node.r * size * 0.4;
        if (r > 0.6) {
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
        const [nx, ny] = toPx(chain[i + 1].cx, chain[i + 1].cy);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [contour, fullPath, k],
  );

  // paused-by-default animation; halts when the tab is hidden or the component unmounts
  useEffect(() => {
    if (!playing) {
      draw();
      return;
    }
    let last = 0;
    const step = (ts: number) => {
      if (last) phaseRef.current = (phaseRef.current + ((ts - last) / 1000) * 1.1) % (2 * Math.PI);
      last = ts;
      draw();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    const onHide = () => document.hidden && setPlaying(false);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [playing, draw]);

  useEffect(() => {
    phaseRef.current = 0;
    draw();
  }, [contour, draw]);

  const tabs: SubTabDef[] = [
    {
      id: 'draw',
      label: t('Draw', 'Dibujar'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-ctl">
              <div className="il-panel-t">{t('Shape', 'Forma')}</div>
              <div className="il-chips">
                {PRESETS.map((p) => (
                  <button key={p} className={`chip${source === p ? ' on' : ''}`} onClick={() => setSource(p)}>
                    {p}
                  </button>
                ))}
                <button className={`chip${source === 'image' ? ' on' : ''}`} onClick={() => setSource('image')}>
                  {t('trace image', 'trazar imagen')}
                </button>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Harmonics', 'Armonicos')}</span>
                <b>{k}</b>
              </div>
              <input className="range" type="range" min={1} max={80} step={1} value={k} onChange={(e) => setK(+e.target.value)} />
            </label>
            <button className="chip" onClick={() => setPlaying((p) => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: 'fit-content' }}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}
            </button>
            <p className="il-panel-sub">
              {t(
                'The outline is written exactly as a sum of rotating vectors (its Fourier descriptors). Add harmonics to refine it term by term; a couple of dozen already capture a recognizable shape because the coefficients decay fast. This is the one case where an image really does reduce to a compact, exact equation, because it is a one-dimensional curve.',
                'El contorno se escribe exactamente como una suma de vectores rotatorios (sus descriptores de Fourier). Agrega armonicos para refinarlo termino a termino; un par de docenas ya capturan una forma reconocible porque los coeficientes decaen rápido. Este es el unico caso en que una imagen realmente se reduce a una ecuacion compacta y exacta, porque es una curva unidimensional.',
              )}
            </p>
          </div>
          <div className="il-fourier-views" style={{ gridTemplateColumns: '1fr' }}>
            <figure className="il-fig">
              {contour ? (
                <canvas ref={canvasRef} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />
              ) : (
                <div className="il-panel il-panel-sub">{t('No clear contour in this image; pick a preset shape.', 'Sin contorno claro en esta imagen; elige una forma.')}</div>
              )}
              <figcaption>{t('Reconstruction from', 'Reconstruccion con')} {k} {t('rotating circles', 'circulos rotatorios')}</figcaption>
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
          <p>{t('Sample the closed contour as complex points z_n and take their discrete Fourier transform; each coefficient is one rotating circle (epicycle).', 'Muestrea el contorno cerrado como puntos complejos z_n y toma su transformada discreta de Fourier; cada coeficiente es un circulo rotatorio (epiciclo).')}</p>
          <Equation tex={String.raw`c_k=\frac1N\sum_{n=0}^{N-1} z_n\,e^{-i\,2\pi kn/N},\qquad z(t)\approx\sum_{|k|\le K} c_k\,e^{i k t}`} />
          <p>
            {t('The Fourier descriptors of a plane closed curve; truncating to the largest-magnitude terms gives a compact, exact-in-the-limit reconstruction ',
              'Los descriptores de Fourier de una curva cerrada plana; truncar a los terminos de mayor magnitud da una reconstrucción compacta y exacta en el limite ')}
            (<Cite id="cooley1965fft" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['cooley1965fft', 'yeganeh2024']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Epicycle views', 'Vistas de epiciclos')} />;
}

export const epicycleTab: TabModule = {
  id: 'epicycle',
  family: 'primitives',
  labelEn: 'Epicycles',
  labelEs: 'Epiciclos',
  lane: 'live',
  Panel: EpicyclePanel,
};
