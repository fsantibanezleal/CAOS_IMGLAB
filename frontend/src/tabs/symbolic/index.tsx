import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Shuffle } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { TabModule } from '../registry';
import { ACTIVATIONS, CppnRenderer, randomCppn, type Activation, type CppnWeights } from '../../engine/cppn';

const PRESETS: { seed: number; freq: number; act: Activation; en: string; es: string }[] = [
  { seed: 7, freq: 4.5, act: 'sin', en: 'Interference', es: 'Interferencia' },
  { seed: 42, freq: 3.0, act: 'gauss', en: 'Cells', es: 'Celulas' },
  { seed: 128, freq: 6.0, act: 'sin', en: 'Weave', es: 'Trama' },
  { seed: 2024, freq: 2.2, act: 'tanh', en: 'Flow', es: 'Flujo' },
  { seed: 99, freq: 8.0, act: 'abs', en: 'Fracture', es: 'Fractura' },
];

function perturb(w: CppnWeights, amount: number, seed: number): CppnWeights {
  if (amount <= 0) return w;
  let s = (seed * 2654435761) & 0x7fffffff || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  const w1 = w.w1.slice();
  const w2 = w.w2.slice();
  for (let i = 0; i < w1.length; i++) w1[i] += rnd() * amount;
  for (let i = 0; i < w2.length; i++) w2[i] += rnd() * amount;
  return { w1, w2 };
}

function CppnCanvas({ weights, act, freq, size = 320 }: { weights: CppnWeights; act: Activation; freq: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CppnRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      rendererRef.current = new CppnRenderer(ref.current);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (rendererRef.current && !err) rendererRef.current.render(weights, act, freq, size);
  }, [weights, act, freq, size, err]);
  if (err) return <div className="il-panel il-panel-sub">{err}</div>;
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function SymbolicPanel() {
  const t = useT();
  const [seed, setSeed] = useState(7);
  const [freq, setFreq] = useState(4.5);
  const [act, setAct] = useState<Activation>('sin');
  const [morph, setMorph] = useState(0);

  const base = useMemo(() => randomCppn(seed), [seed]);
  const weights = useMemo(() => perturb(base, morph, seed + 1), [base, morph, seed]);

  const tabs: SubTabDef[] = [
    {
      id: 'explore',
      label: t('Explore', 'Explorar'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <button className="chip" onClick={() => setSeed((s) => (s * 7 + 13) % 100000)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shuffle size={14} aria-hidden="true" /> {t('Randomize', 'Aleatorizar')}
            </button>
            <div className="il-ctl">
              <div className="il-panel-t" style={{ marginTop: '0.3rem' }}>{t('Presets', 'Ejemplos')}</div>
              <div className="il-chips">
                {PRESETS.map((p) => (
                  <button key={p.seed} className="chip" onClick={() => { setSeed(p.seed); setFreq(p.freq); setAct(p.act); setMorph(0); }}>
                    {t(p.en, p.es)}
                  </button>
                ))}
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Frequency', 'Frecuencia')}</span><b>{freq.toFixed(1)}</b></div>
              <input className="range" type="range" min={0.5} max={12} step={0.1} value={freq} onChange={(e) => setFreq(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Activation', 'Activacion')}</span><b>{act}</b></div>
              <div className="il-seg">
                {ACTIVATIONS.map((a) => (
                  <button key={a} className={act === a ? 'on' : ''} onClick={() => setAct(a)}>{a}</button>
                ))}
              </div>
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Perturb weights', 'Perturbar pesos')}</span><b>{morph.toFixed(2)}</b></div>
              <input className="range" type="range" min={0} max={1.5} step={0.02} value={morph} onChange={(e) => setMorph(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'This image IS an equation: a compact network of about 72 numbers mapping (x, y) to colour, evaluated per pixel on the GPU. Nudge the weights and the pattern morphs smoothly, this is the editable pole of formula art. A dense formula hand-fitted to a photograph has no such factored structure and shatters under the same nudge.',
                'Esta imagen ES una ecuacion: una red compacta de unos 72 números que mapea (x, y) a color, evaluada por pixel en la GPU. Mueve los pesos y el patron se transforma suavemente, este es el polo editable del arte de formula. Una formula densa ajustada a mano a una fotografia no tiene esa estructura factorizada y se destroza con el mismo empujon.',
              )}
            </p>
          </div>
          <div className="il-fourier-views" style={{ gridTemplateColumns: '1fr' }}>
            <figure className="il-fig">
              <CppnCanvas weights={weights} act={act} freq={freq} />
              <figcaption>{t('CPPN render (seed', 'Render CPPN (semilla')} {seed})</figcaption>
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
          <p>{t('A compositional pattern producing network composes interpretable primitives of the coordinates into colour.', 'Una red productora de patrones composicionales compone primitivas interpretables de las coordenadas en color.')}</p>
          <Equation tex={String.raw`h_j=\phi\!\Big(\sum_i W^{(1)}_{ji}\,g_i(x,y)\Big),\qquad c_k=\tfrac12+\tfrac12\sin\!\Big(\sum_j W^{(2)}_{kj}\,h_j\Big)`} />
          <p>
            {t('with inputs g = (x, y, r, sin x, sin y, 1) and an activation phi in {sin, tanh, gauss, abs}. Evolved compositional representations stay factored and editable, whereas gradient-fit networks that produce the same image become entangled ',
              'con entradas g = (x, y, r, sin x, sin y, 1) y activacion phi en {sin, tanh, gauss, abs}. Las representaciones composicionales evolucionadas permanecen factorizadas y editables, mientras que las redes ajustadas por gradiente que producen la misma imagen se enredan ')}
            (<Cite id="stanley2007cppn" />, <Cite id="fer2025" />).
          </p>
          <Callout variant="honest" title={t('The honest limit', 'El limite honesto')}>
            {t(
              'No method today turns an arbitrary photograph into a compact, faithful, human-readable equation. What is genuinely computable is the reverse direction shown here (a small formula generates a rich image) and, for a closed outline, its exact Fourier-descriptor equation (see the Epicycle tab). Fitting a photo with symbolic regression works only for low-complexity fields; that Pareto trade-off, accuracy against expression size, is the real state of the art.',
              'Ningun método hoy convierte una fotografia arbitraria en una ecuacion compacta, fiel y legible por humanos. Lo genuinamente computable es la dirección inversa mostrada aquí (una formula pequeña genera una imagen rica) y, para un contorno cerrado, su ecuacion exacta por descriptores de Fourier (ver la pestana Epiciclos). Ajustar una foto con regresion simbolica solo funciona para campos de baja complejidad; ese compromiso de Pareto, precision frente a tamaño de la expresion, es el estado del arte real.',
            )}
          </Callout>
          <Refs label={t('References', 'Referencias')} ids={['stanley2007cppn', 'cranmer2023pysr', 'fer2025', 'yeganeh2024']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Symbolic views', 'Vistas simbolicas')} />;
}

export const symbolicTab: TabModule = {
  id: 'symbolic',
  family: 'symbolic',
  labelEn: 'Symbolic / CPPN',
  labelEs: 'Simbolico / CPPN',
  lane: 'live',
  Panel: SymbolicPanel,
};
