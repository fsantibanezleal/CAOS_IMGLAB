import { useEffect, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Pause, Play } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { TabModule } from '../registry';
import { frameUrl, loadVaeIndex, type VaeWalk } from '../../engine/latents';

const IMG_LABEL: Record<string, { en: string; es: string }> = {
  photo_parrots: { en: 'macaws', es: 'guacamayos' },
  art_greatwave: { en: 'the great wave', es: 'la gran ola' },
  'mathart-julia': { en: 'Julia set', es: 'conjunto de Julia' },
  'synthetic-gradient': { en: 'gradient', es: 'gradiente' },
  astro_pillars: { en: 'nebula', es: 'nebulosa' },
  tex_wood: { en: 'wood', es: 'madera' },
};
const lbl = (id: string, es: boolean) => (IMG_LABEL[id] ? (es ? IMG_LABEL[id].es : IMG_LABEL[id].en) : id);

function LatentsPanel() {
  const t = useT();
  const es = t('en', 'es') === 'es';
  const [walks, setWalks] = useState<VaeWalk[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    loadVaeIndex().then((i) => setWalks(i.walks)).catch((e) => setErr(String(e)));
  }, []);

  const walk = walks?.[sel];

  // preload the frames of the current walk for smooth scrubbing
  useEffect(() => {
    if (!walk) return;
    for (let i = 0; i < walk.frames; i++) {
      const im = new Image();
      im.src = frameUrl(walk.id, i);
    }
    setFrame(0);
  }, [walk]);

  useEffect(() => {
    if (!playing || !walk) return;
    let last = 0;
    let dir = 1;
    let f = frame;
    const step = (ts: number) => {
      if (ts - last > 90) {
        last = ts;
        f += dir;
        if (f >= walk.frames - 1) {
          f = walk.frames - 1;
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
  }, [playing, walk]);

  if (err) return <div className="il-panel il-panel-sub">{t('Latent walks unavailable: ', 'Caminatas latentes no disponibles: ')}<code>{err}</code></div>;
  if (!walks || !walk) return <div className="il-panel il-panel-sub">{t('Loading the latent walks...', 'Cargando las caminatas latentes...')}</div>;

  const caption =
    walk.kind === 'interpolate'
      ? `${lbl(walk.a, es)} ${t('to', 'a')} ${lbl(walk.b ?? '', es)}`
      : `${lbl(walk.a, es)} ${t('with latent noise', 'con ruido latente')}`;

  const tabs: SubTabDef[] = [
    {
      id: 'walk',
      label: t('Latent walk', 'Caminata latente'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-ctl">
              <div className="il-panel-t">{t('Walk', 'Caminata')}</div>
              <div className="il-chips">
                {walks.map((w, i) => (
                  <button key={w.id} className={`chip${i === sel ? ' on' : ''}`} onClick={() => { setSel(i); setPlaying(false); }}>
                    {w.kind === 'interpolate' ? `${lbl(w.a, es)}/${lbl(w.b ?? '', es)}` : `${lbl(w.a, es)} +noise`}
                  </button>
                ))}
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{walk.kind === 'interpolate' ? t('Interpolation', 'Interpolacion') : t('Noise', 'Ruido')}</span>
                <b>{frame} / {walk.frames - 1}</b>
              </div>
              <input className="range" type="range" min={0} max={walk.frames - 1} step={1} value={frame} onChange={(e) => setFrame(+e.target.value)} />
            </label>
            <button className="chip" onClick={() => setPlaying((p) => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: 'fit-content' }}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}
            </button>
            <p className="il-panel-sub">
              {walk.kind === 'interpolate'
                ? t(
                    'Two images are encoded into the VAE latent code and the code is interpolated; every step decodes to a plausible image. The path stays on the learned manifold, so the blend is smooth, not a pixel cross-fade. This is the editable generative pole, but it is entangled: the whole image changes together.',
                    'Dos imagenes se codifican en el código latente del VAE y el código se interpola; cada paso decodifica a una imagen plausible. El camino se mantiene en la variedad aprendida, así que la mezcla es suave, no un fundido de pixeles. Este es el polo generativo editable, pero esta enredado: la imagen entera cambia junta.',
                  )
                : t(
                    'Add increasing noise to a single latent code and decode: the image drifts to plausible but globally different pictures. A latent nudge is semantic but entangled, the opposite of the local, exact edits of the transform and dictionary tabs.',
                    'Agrega ruido creciente a un unico código latente y decodifica: la imagen deriva a imagenes plausibles pero globalmente distintas. Un empujon latente es semantico pero enredado, lo opuesto a las ediciones locales y exactas de las pestanas de transformada y diccionario.',
                  )}
            </p>
          </div>
          <div className="il-fourier-views" style={{ gridTemplateColumns: '1fr' }}>
            <figure className="il-fig">
              <img src={frameUrl(walk.id, frame)} alt={caption} className="il-canvas" style={{ width: '100%', display: 'block' }} />
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
          <p>{t('A variational autoencoder maps an image to a low-dimensional latent code and back; the latent is a learned, continuous representation.', 'Un autoencoder variacional mapea una imagen a un código latente de baja dimension y de vuelta; el latente es una representacion aprendida y continua.')}</p>
          <Equation tex={String.raw`z=\mathcal{E}(x),\qquad \hat x=\mathcal{D}(z),\qquad z_t=(1-t)\,z_a+t\,z_b`} />
          <p>
            {t('Interpolating in the latent gives a smooth path of plausible images; disentangled generative directions (in GAN W-space, or a diffusion latent) are the most editable representation of all, though the edits here are entangled because the VAE latent is not disentangled ',
              'Interpolar en el latente da un camino suave de imagenes plausibles; las direcciones generativas desenredadas (en el espacio W de un GAN, o un latente de difusion) son la representacion mas editable de todas, aunque las ediciones aquí estan enredadas porque el latente del VAE no esta desenredado ')}
            (<Cite id="kingma2013vae" />, <Cite id="karras2019stylegan" />, <Cite id="harkonen2020ganspace" />, <Cite id="rombach2022ldm" />).
          </p>
          <Callout variant="honest" title={t('Baked, not live', 'Precalculado, no en vivo')}>
            {t(
              'Encoding and decoding a VAE is too heavy for the browser, so these walks are decoded offline by the open pipeline and replayed here. They are reconstructions through a compression autoencoder, labelled as generative interpolation, not a faithful edit of your exact image.',
              'Codificar y decodificar un VAE es demasiado pesado para el navegador, así que estas caminatas se decodifican offline con el pipeline abierto y se reproducen aquí. Son reconstrucciones a traves de un autoencoder de compresion, etiquetadas como interpolación generativa, no una edicion fiel de tu imagen exacta.',
            )}
          </Callout>
          <Refs label={t('References', 'Referencias')} ids={['kingma2013vae', 'karras2019stylegan', 'harkonen2020ganspace', 'rombach2022ldm']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Latent views', 'Vistas latentes')} />;
}

export const latentsTab: TabModule = {
  id: 'latents',
  family: 'latents',
  labelEn: 'Learned latents',
  labelEs: 'Latentes',
  lane: 'replay',
  Panel: LatentsPanel,
};
