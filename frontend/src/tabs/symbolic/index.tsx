import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { CHANNEL_NAMES, loadSym, loadSymIndex, packSym, perturbSym, symEquationTex, symEquationText, SymRenderer, type Channel, type SymDoc } from '../../engine/symbolic';

const RENDER = 288;

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function SymbolicPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [fitted, setFitted] = useState<string[] | null>(null);
  const [doc, setDoc] = useState<SymDoc | null>(null);
  const [perturb, setPerturb] = useState(0);
  const [scale, setScale] = useState(1);
  const [ch, setCh] = useState<Channel>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SymRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadSymIndex().then((i) => setFitted(i.fitted)).catch(() => setFitted([]));
  }, []);
  useEffect(() => {
    setDoc(null);
    if (fitted && fitted.includes(entry.id)) loadSym(entry.id).then(setDoc).catch(() => setDoc(null));
  }, [entry.id, fitted]);

  const flat = useMemo(() => (doc ? packSym(doc) : null), [doc]);

  // (re)create the renderer when the equation size (D) changes
  useEffect(() => {
    if (!canvasRef.current || !doc) return;
    try {
      rendererRef.current?.dispose();
      rendererRef.current = new SymRenderer(canvasRef.current, doc.d);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [doc]);

  // render on selection / perturb / scale change (one-shot, never animated)
  useEffect(() => {
    if (!rendererRef.current || !flat || !doc) return;
    const f = perturb > 0 ? perturbSym(flat, doc.d, perturb) : flat;
    try {
      rendererRef.current.render(f, scale, RENDER);
    } catch (e) {
      setErr(String(e));
    }
  }, [flat, doc, perturb, scale]);

  if (fitted && !fitted.includes(entry.id)) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Fitted for the curated set', 'Ajustado para el conjunto curado')}>
          {t(
            'Fitting the closed-form equation is an offline least-squares step baked for every curated image; your uploaded image is handled by the live transform and dictionary tabs.',
            'Ajustar la ecuación de forma cerrada es un paso de mínimos cuadrados offline precalculado para cada imagen curada; la imagen cargada se maneja en las pestañas en vivo de transformada y diccionario.',
          )}
        </Callout>
      </div>
    );
  }
  if (err) return <div className="il-panel il-panel-sub">{t('Renderer error: ', 'Error del renderizador: ')}<code>{err}</code></div>;
  if (!doc || !planes) return <div className="il-panel il-panel-sub">{t('Loading the equation...', 'Cargando la ecuación...')}</div>;

  const downloadEquation = () => {
    const blob = new Blob([symEquationText(doc, entry.id)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imglab-equation-${entry.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: SubTabDef[] = [
    {
      id: 'equation',
      label: t('The equation', 'La ecuación'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-panel-t">{t('One image, one formula', 'Una imagen, una fórmula')}</div>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{doc.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{doc.d}</div>
                <div className="il-kpi-l">{t('terms', 'términos')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Perturb coefficients', 'Perturbar coeficientes')}</span>
                <b>{perturb.toFixed(3)}</b>
              </div>
              <input className="range" type="range" min={0} max={0.05} step={0.002} value={perturb} onChange={(e) => setPerturb(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Frequency scale', 'Escala de frecuencia')}</span>
                <b>{scale.toFixed(2)}x</b>
              </div>
              <input className="range" type="range" min={0.5} max={2} step={0.02} value={scale} onChange={(e) => setScale(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'The whole image is written as one closed-form equation: a sum of hundreds of cosine and sine waves at fitted amplitudes. Nudge the coefficients and the picture morphs smoothly (a legible, editable parameter); stretch the frequency scale and the pattern breathes. The fidelity is honest: a smooth field collapses to a compact formula, a sharp photo needs far more terms.',
                'La imagen entera se escribe como una ecuación de forma cerrada: una suma de cientos de ondas coseno y seno con amplitudes ajustadas. Al mover los coeficientes la imagen se transforma suavemente (un parámetro legible y editable); al estirar la escala de frecuencia el patrón respira. La fidelidad es honesta: un campo suave colapsa a una fórmula compacta, una foto nítida necesita muchos más términos.',
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
              <figcaption>{t('The equation, evaluated per pixel', 'La ecuación, evaluada por pixel')}</figcaption>
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
              'This is the actual fitted equation of the selected image, with its real coefficients: the terms below are the largest of the ',
              'Esta es la ecuación ajustada real de la imagen seleccionada, con sus coeficientes reales: los términos de abajo son los mayores de los ',
            )}
            {doc.d}
            {t(
              ' per channel, in amplitude-phase form. Evaluate it at any (x, y) in [-1, 1] and you reproduce the picture on the previous sub-tab.',
              ' por canal, en forma amplitud-fase. Evalúala en cualquier (x, y) en [-1, 1] y reproduces la imagen de la sub-pestaña anterior.',
            )}
          </p>
          <div className="il-chips" style={{ marginBottom: '0.5rem' }}>
            {CHANNEL_NAMES.map((name, i) => (
              <button key={name} className={`chip${ch === i ? ' on' : ''}`} onClick={() => setCh(i as Channel)}>
                {t('channel', 'canal')} {name}
              </button>
            ))}
            <button className="chip" onClick={downloadEquation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {t('Download the full equation (.txt)', 'Descargar la ecuación completa (.txt)')}
            </button>
          </div>
          <Equation tex={symEquationTex(doc, ch)} />
          <p className="il-panel-sub">
            {t(
              'The download carries every term of all three channels (',
              'La descarga lleva cada término de los tres canales (',
            )}
            {3 * doc.d}
            {t(
              ' cosines plus three offsets), the complete closed-form description of this image at the fitted resolution. Nothing is hidden: the picture and the formula are the same object.',
              ' cosenos más tres constantes), la descripción de forma cerrada completa de esta imagen a la resolución ajustada. Nada queda oculto: la imagen y la fórmula son el mismo objeto.',
            )}
          </p>
        </div>
      ),
    },
    {
      id: 'method',
      label: t('Method', 'Método'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('Each colour channel of the image is fitted as a sum of random sinusoids (random Fourier features), a genuine closed-form formula recovered from the pixels by ridge regression.', 'Cada canal de color de la imagen se ajusta como una suma de sinusoides aleatorias (características de Fourier aleatorias), una fórmula de forma cerrada genuina recuperada de los píxeles por regresión ridge.')}</p>
          <Equation tex={String.raw`\mathrm{ch}(x,y)=a_0+\sum_{k=1}^{D}\Big[a_k\cos(\boldsymbol{\omega}_k\!\cdot\!(x,y))+b_k\sin(\boldsymbol{\omega}_k\!\cdot\!(x,y))\Big],\quad \boldsymbol{\omega}_k\sim\mathcal N(0,\sigma^2 I)`} />
          <p>
            {t('Random Fourier features approximate a smooth function as a short trigonometric sum, so the image becomes a compact analytic expression rather than a black box ',
              'Las características de Fourier aleatorias aproximan una función suave como una suma trigonométrica corta, así que la imagen se vuelve una expresión analítica compacta en vez de una caja negra ')}
            (<Cite id="tancik2020fourier" />, <Cite id="yeganeh2024" />). {t('Unlike the fixed-basis transforms the frequencies are random, and unlike the neural field the model is linear in the basis, so it can be written down and read as an equation ', 'A diferencia de las transformadas de base fija las frecuencias son aleatorias, y a diferencia del campo neuronal el modelo es lineal en la base, así que puede escribirse y leerse como una ecuación ')}
            (<Cite id="stanley2007cppn" />, <Cite id="fer2025" />).
          </p>
          <Callout variant="honest" title={t('The honest limit', 'El límite honesto')}>
            {t(
              'This really does turn each image into a closed-form equation, but the fidelity is bounded: a smooth gradient reaches about 57 dB from the same 512 terms, a sharp checkerboard only about 14, because a finite trigonometric sum cannot render a hard edge. That accuracy-versus-expression-size trade-off is exactly the point of the symbolic pole.',
              'Esto realmente convierte cada imagen en una ecuación de forma cerrada, pero la fidelidad está acotada: un gradiente suave alcanza unos 57 dB con los mismos 512 términos, un tablero nítido solo unos 14, porque una suma trigonométrica finita no puede representar un borde duro. Ese compromiso entre precisión y tamaño de la expresión es justo el punto del polo simbólico.',
            )}
          </Callout>
          <Refs label={t('References', 'Referencias')} ids={['tancik2020fourier', 'yeganeh2024', 'stanley2007cppn', 'fer2025']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Symbolic views', 'Vistas simbólicas')} />;
}

export const symbolicTab: TabModule = {
  id: 'symbolic',
  family: 'symbolic',
  labelEn: 'Symbolic / CPPN',
  labelEs: 'Simbólico / CPPN',
  lane: 'live',
  Panel: SymbolicPanel,
};
