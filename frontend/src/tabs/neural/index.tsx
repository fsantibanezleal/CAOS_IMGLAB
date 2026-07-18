import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, type ImagePlanes } from '../../engine/image';
import { InrRenderer, flattenWeights, loadInr, loadInrIndex, perturbWeights, quantizeWeights, type InrWeights } from '../../engine/inr';

function OriginalCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function InrCanvas({ weights, freqScale, perturb, bits }: { weights: InrWeights; freqScale: number; perturb: number; bits: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<InrRenderer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flat = useMemo(() => flattenWeights(weights), [weights]);

  useEffect(() => {
    if (!ref.current) return;
    try {
      rendererRef.current = new InrRenderer(ref.current, weights.hidden);
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [weights.hidden]);

  useEffect(() => {
    if (!rendererRef.current || err) return;
    const w = quantizeWeights(perturbWeights(flat, perturb), bits);
    rendererRef.current.render(w, weights.omega0, freqScale, 256);
  }, [flat, freqScale, perturb, bits, weights.omega0, err]);

  if (err) return <div className="il-panel il-panel-sub">{err}</div>;
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function NeuralPanel({ entry, planes }: PanelProps) {
  const t = useT();
  const [trained, setTrained] = useState<string[] | null>(null);
  const [weights, setWeights] = useState<InrWeights | null>(null);
  const [freqScale, setFreqScale] = useState(1);
  const [perturb, setPerturb] = useState(0);
  const [bits, setBits] = useState(23);

  useEffect(() => {
    loadInrIndex().then((i) => setTrained(i.trained)).catch(() => setTrained([]));
  }, []);

  useEffect(() => {
    setWeights(null);
    setFreqScale(1);
    setPerturb(0);
    setBits(23);
    if (trained && trained.includes(entry.id)) loadInr(entry.id).then(setWeights).catch(() => setWeights(null));
  }, [entry.id, trained]);

  if (trained && !trained.includes(entry.id)) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Baked for the curated set', 'Horneado para el conjunto curado')}>
          {t(
            'Every curated image has a network trained offline for it. Training a SIREN on your uploaded image would take a minute of compute the browser cannot spend, so the neural field is shown for the curated set; your upload is reconstructed live by the transform, dictionary and primitive tabs instead.',
            'Cada imagen curada tiene una red entrenada offline. Entrenar un SIREN sobre tu imagen cargada tomaria un minuto de computo que el navegador no puede gastar, asi que el campo neuronal se muestra para el conjunto curado; tu carga se reconstruye en vivo en las pestanas de transformada, diccionario y primitivas.',
          )}
        </Callout>
      </div>
    );
  }
  if (!weights) return <div className="il-panel il-panel-sub">{t('Loading the network...', 'Cargando la red...')}</div>;

  const nWeights = weights.layers.reduce((s, l) => s + l.w.length + l.b.length, 0);

  const tabs: SubTabDef[] = [
    {
      id: 'field',
      label: t('Neural field', 'Campo neuronal'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{nWeights}</div>
                <div className="il-kpi-l">{t('weights', 'pesos')}</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{weights.psnr}</div>
                <div className="il-kpi-l">{t('fit PSNR', 'PSNR ajuste')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Frequency scale', 'Escala de frecuencia')}</span><b>{freqScale.toFixed(2)}</b></div>
              <input className="range" type="range" min={0.2} max={2.5} step={0.02} value={freqScale} onChange={(e) => setFreqScale(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Perturb weights', 'Perturbar pesos')}</span><b>{perturb.toFixed(3)}</b></div>
              <input className="range" type="range" min={0} max={0.3} step={0.005} value={perturb} onChange={(e) => setPerturb(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row"><span>{t('Weight precision (bits)', 'Precision de pesos (bits)')}</span><b>{bits >= 23 ? 'full' : bits}</b></div>
              <input className="range" type="range" min={1} max={23} step={1} value={bits} onChange={(e) => setBits(+e.target.value)} />
            </label>
            <p className="il-panel-sub">
              {t(
                'The whole image is these few thousand numbers. The frequency scale is a meaningful knob (it stretches the pattern), but nudge the raw weights and the image collapses into noise: the weight space is a compression code, not an edit space. That is why the modern neural field, unlike the designed bases, has no local, meaningful coordinates to edit.',
                'La imagen entera son estos pocos miles de números. La escala de frecuencia es una perilla con sentido (estira el patron), pero mueve los pesos crudos y la imagen colapsa en ruido: el espacio de pesos es un código de compresion, no un espacio de edicion. Por eso el campo neuronal moderno, a diferencia de las bases disenadas, no tiene coordenadas locales y con sentido para editar.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <OriginalCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <InrCanvas weights={weights} freqScale={freqScale} perturb={perturb} bits={bits} />
              <figcaption>{t('Neural field f(x,y)', 'Campo neuronal f(x,y)')}</figcaption>
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
          <p>{t('A small coordinate network with periodic activations (SIREN) is overfit to one image; the stored object is the weight vector, not the pixels.', 'Una pequeña red de coordenadas con activaciones periodicas (SIREN) se sobreajusta a una imagen; el objeto almacenado es el vector de pesos, no los pixeles.')}</p>
          <Equation tex={String.raw`f_\theta(x,y)=\sigma\!\Big(W_L\,\sin\!\big(\omega_0(W_{L-1}\cdots\sin(\omega_0 W_0\,[x,y])\big)\Big)`} />
          <p>
            {t('the learnable descendant of hand-authored closed-form pixel art. Periodic activations and the principled initialization let it capture high frequencies; storing the quantized weights is a form of compression ',
              'el descendiente aprendible del arte de formula por pixel escrito a mano. Las activaciones periodicas y la inicializacion principiada le permiten capturar altas frecuencias; almacenar los pesos cuantizados es una forma de compresion ')}
            (<Cite id="sitzmann2020siren" />, <Cite id="tancik2020fourier" />, <Cite id="dupont2021coin" />).
          </p>
          <Callout variant="honest" title={t('Weights are noise, structure needs a latent', 'Los pesos son ruido; la estructura necesita un latente')}>
            {t(
              'Perturbing the raw weights gives noise because the map from weights to image is chaotic. A meaningful, editable coordinate would require a modulation latent over a family of images (a functa), which sits at the learned-manifold pole later in the spectrum.',
              'Perturbar los pesos crudos da ruido porque el mapa de pesos a imagen es caotico. Una coordenada editable y con sentido requeriria un latente de modulacion sobre una familia de imagenes (un functa), que esta en el polo de variedad aprendida mas adelante en el espectro.',
            )}
          </Callout>
          <Refs label={t('References', 'Referencias')} ids={['sitzmann2020siren', 'tancik2020fourier', 'dupont2021coin']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Neural field views', 'Vistas de campo neuronal')} />;
}

export const neuralTab: TabModule = {
  id: 'neural-field',
  family: 'neural-field',
  labelEn: 'Neural field',
  labelEs: 'Campo neuronal',
  lane: 'live',
  Panel: NeuralPanel,
};
