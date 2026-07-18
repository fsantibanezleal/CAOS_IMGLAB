import { useEffect, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Pause, Play } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { TabModule } from '../registry';
import { diffFrameUrl, loadDiffIndex, type DiffStrip } from '../../engine/diffusion';

function stripLabel(s: DiffStrip, es: boolean): string {
  if (s.kind === 'denoise') return es ? 'de ruido a imagen' : 'noise to image';
  return es ? 'caminata de prompt' : 'prompt walk';
}

function DiffusionPanel() {
  const t = useT();
  const es = t('en', 'es') === 'es';
  const [strips, setStrips] = useState<DiffStrip[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    loadDiffIndex()
      .then((i) => setStrips(i.strips))
      .catch((e) => setErr(String(e)));
  }, []);

  const strip = strips?.[sel];

  useEffect(() => {
    if (!strip) return;
    for (let i = 0; i < strip.frames; i++) {
      const im = new Image();
      im.src = diffFrameUrl(strip.id, i);
    }
    setFrame(0);
  }, [strip]);

  useEffect(() => {
    if (!playing || !strip) return;
    let last = 0;
    let dir = 1;
    let f = frame;
    const step = (ts: number) => {
      if (ts - last > 110) {
        last = ts;
        f += dir;
        if (f >= strip.frames - 1) {
          // denoise plays forward once and holds; the prompt walk ping-pongs
          if (strip.kind === 'denoise') {
            f = strip.frames - 1;
            setFrame(f);
            setPlaying(false);
            return;
          }
          f = strip.frames - 1;
          dir = -1;
        } else if (f <= 0) {
          f = 0;
          dir = 1;
        }
        setFrame(f);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    const onHide = () => document.hidden && setPlaying(false);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, strip]);

  if (err)
    return (
      <div className="il-panel il-panel-sub">
        {t('Diffusion strips unavailable: ', 'Tiras de difusion no disponibles: ')}
        <code>{err}</code>
      </div>
    );
  if (!strips || !strip) return <div className="il-panel il-panel-sub">{t('Loading the diffusion strips...', 'Cargando las tiras de difusion...')}</div>;

  const caption =
    strip.kind === 'denoise'
      ? `${t('step', 'paso')} ${frame + 1} / ${strip.frames}: "${strip.prompt}"`
      : `t = ${(frame / (strip.frames - 1)).toFixed(2)}: "${strip.a}" ${t('to', 'a')} "${strip.b}"`;

  const tabs: SubTabDef[] = [
    {
      id: 'strip',
      label: t('Diffusion strip', 'Tira de difusion'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-ctl">
              <div className="il-panel-t">{t('Strip', 'Tira')}</div>
              <div className="il-chips">
                {strips.map((s, i) => (
                  <button key={s.id} className={`chip${i === sel ? ' on' : ''}`} onClick={() => { setSel(i); setPlaying(false); }}>
                    {stripLabel(s, es)}
                  </button>
                ))}
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{strip.kind === 'denoise' ? t('Denoising step', 'Paso de limpieza') : t('Interpolation', 'Interpolacion')}</span>
                <b>{frame} / {strip.frames - 1}</b>
              </div>
              <input className="range" type="range" min={0} max={strip.frames - 1} step={1} value={frame} onChange={(e) => setFrame(+e.target.value)} />
            </label>
            <button className="chip" onClick={() => setPlaying((p) => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: 'fit-content' }}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}
            </button>
            <p className="il-panel-sub">
              {strip.kind === 'denoise'
                ? t(
                    'The reverse diffusion process: a real diffusion model starts from pure noise and denoises step by step until an image appears. Every frame is the current latent of the model, decoded. The parameters here are a text prompt and a random seed, entangled: there is no local handle on any region.',
                    'El proceso de difusion inverso: un modelo de difusion real parte de puro ruido y lo limpia paso a paso hasta que aparece una imagen. Cada fotograma es el latente actual del modelo, decodificado. Los parametros aqui son un prompt de texto y una semilla aleatoria, enredados: no hay control local sobre ninguna region.',
                  )
                : t(
                    'The text embeddings of two prompts are interpolated and each blend is generated. The image morphs between the two meanings along the learned manifold, so every step is a plausible picture. A prompt is a semantic but wholly entangled parameter, the far generative pole of the editability curve.',
                    'Los embeddings de texto de dos prompts se interpolan y cada mezcla se genera. La imagen transita entre los dos significados por la variedad aprendida, asi que cada paso es una imagen plausible. Un prompt es un parametro semantico pero totalmente enredado, el polo generativo lejano de la curva de editabilidad.',
                  )}
            </p>
          </div>
          <div className="il-fourier-views" style={{ gridTemplateColumns: '1fr' }}>
            <figure className="il-fig">
              <img src={diffFrameUrl(strip.id, frame)} alt={caption} className="il-canvas" style={{ width: '100%', display: 'block' }} />
              <figcaption>{caption}</figcaption>
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
          <p>
            {t(
              'A diffusion model learns to reverse a gradual noising process. The forward process adds Gaussian noise to an image over many steps; the model is trained to undo one step, so sampling runs the chain backward from pure noise to an image.',
              'Un modelo de difusion aprende a revertir un proceso de ruido gradual. El proceso directo agrega ruido gaussiano a una imagen en muchos pasos; el modelo se entrena para deshacer un paso, asi que el muestreo corre la cadena hacia atras desde puro ruido hasta una imagen.',
            )}
          </p>
          <Equation tex={String.raw`x_t=\sqrt{\bar\alpha_t}\,x_0+\sqrt{1-\bar\alpha_t}\,\epsilon,\qquad x_{t-1}=\tfrac{1}{\sqrt{\alpha_t}}\!\left(x_t-\tfrac{1-\alpha_t}{\sqrt{1-\bar\alpha_t}}\,\epsilon_\theta(x_t,t,c)\right)+\sigma_t z` } />
          <p>
            {t(
              'Text conditioning c steers the denoiser; interpolating the embeddings of two prompts gives a smooth semantic walk, x = G(z; (1-t)c_a + t c_b). The image stays on the learned manifold, which is what makes the pole editable, but no parameter is a local handle: the whole picture changes together ',
              'El condicionamiento de texto c guia el limpiador; interpolar los embeddings de dos prompts da una caminata semantica suave, x = G(z; (1-t)c_a + t c_b). La imagen se mantiene en la variedad aprendida, lo que hace editable el polo, pero ningun parametro es un control local: la imagen entera cambia junta ',
            )}
            (<Cite id="ho2020ddpm" />, <Cite id="rombach2022ldm" />, <Cite id="sauer2023add" />).
          </p>
          <Callout variant="honest" title={t('Baked, not live', 'Horneado, no en vivo')}>
            {t(
              'A diffusion UNet is far too heavy for the browser, so these strips are generated offline by the open pipeline with a real small model (SD-Turbo) and replayed here. They are model samples for a fixed prompt and seed, shown to illustrate the process and the entangled generative pole, not an edit of your selected image.',
              'Una UNet de difusion es demasiado pesada para el navegador, asi que estas tiras se generan offline con el pipeline abierto y un modelo pequeno real (SD-Turbo) y se reproducen aqui. Son muestras del modelo para un prompt y semilla fijos, mostradas para ilustrar el proceso y el polo generativo enredado, no una edicion de tu imagen seleccionada.',
            )}
          </Callout>
          <Refs label={t('References', 'Referencias')} ids={['ho2020ddpm', 'rombach2022ldm', 'sauer2023add']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Diffusion views', 'Vistas de difusion')} />;
}

export const diffusionTab: TabModule = {
  id: 'diffusion',
  family: 'diffusion',
  labelEn: 'Diffusion',
  labelEs: 'Difusion',
  lane: 'replay',
  Panel: DiffusionPanel,
};
