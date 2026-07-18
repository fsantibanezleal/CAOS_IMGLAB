import { useEffect, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Pause, Play } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { loadVaeIndex, vaeFrameUrl, type VaeEntry } from '../../engine/latents';

function LatentsPanel({ entry }: PanelProps) {
  const t = useT();
  const [images, setImages] = useState<VaeEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    loadVaeIndex().then((i) => setImages(i.images)).catch((e) => setErr(String(e)));
  }, []);

  const vae = images?.find((e) => e.id === entry.id) ?? null;

  useEffect(() => {
    if (!vae) return;
    for (let i = 0; i < vae.frames; i++) {
      const im = new Image();
      im.src = vaeFrameUrl(entry.id, i);
    }
    setFrame(0);
    setPlaying(false);
  }, [vae, entry.id]);

  useEffect(() => {
    if (!playing || !vae) return;
    let last = 0;
    let dir = 1;
    let f = frame;
    const step = (ts: number) => {
      if (ts - last > 110) {
        last = ts;
        f += dir;
        if (f >= vae.frames - 1) ((f = vae.frames - 1), (dir = -1));
        else if (f <= 0) ((f = 0), (dir = 1));
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
  }, [playing, vae]);

  if (err) return <div className="il-panel il-panel-sub">{t('Latent strips unavailable: ', 'Tiras latentes no disponibles: ')}<code>{err}</code></div>;
  if (images && !vae) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Baked for the curated set', 'Precalculado para el conjunto curado')}>
          {t(
            'Encoding and decoding a VAE is too heavy for the browser, so the latent reconstruction and perturbation are baked offline for every curated image; your uploaded image is handled by the live transform and dictionary tabs.',
            'Codificar y decodificar un VAE es demasiado pesado para el navegador, asi que la reconstruccion latente y la perturbacion se precalculan offline para cada imagen curada; tu imagen cargada se maneja en las pestanas en vivo de transformada y diccionario.',
          )}
        </Callout>
      </div>
    );
  }
  if (!images || !vae) return <div className="il-panel il-panel-sub">{t('Loading the latent strip...', 'Cargando la tira latente...')}</div>;

  const tabs: SubTabDef[] = [
    {
      id: 'walk',
      label: t('Latent perturbation', 'Perturbacion latente'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{vae.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">{t('recon PSNR', 'PSNR recon')}</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{frame === 0 ? t('recon', 'recon') : `+${frame}`}</div>
                <div className="il-kpi-l">{t('noise step', 'paso ruido')}</div>
              </div>
            </div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Latent noise', 'Ruido latente')}</span>
                <b>{frame} / {vae.frames - 1}</b>
              </div>
              <input className="range" type="range" min={0} max={vae.frames - 1} step={1} value={frame} onChange={(e) => setFrame(+e.target.value)} />
            </label>
            <button className="chip" onClick={() => setPlaying((p) => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: 'fit-content' }}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}
            </button>
            <p className="il-panel-sub">
              {t(
                'The selected image is encoded into the VAE latent code and decoded back: frame 0 is the reconstruction (a lossy pass through a learned code). Add noise to that latent and decode again, and the image drifts to plausible but globally different pictures. A latent nudge is semantic but entangled, the opposite of the local, exact edits of the transform and primitive tabs.',
                'La imagen seleccionada se codifica en el codigo latente del VAE y se decodifica de vuelta: el fotograma 0 es la reconstruccion (un paso con perdida por un codigo aprendido). Agrega ruido a ese latente y decodifica otra vez, y la imagen deriva a imagenes plausibles pero globalmente distintas. Un empujon latente es semantico pero enredado, lo opuesto a las ediciones locales y exactas de las pestanas de transformada y primitivas.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <img src={vaeFrameUrl(entry.id, 0)} alt={t('VAE reconstruction', 'Reconstruccion VAE')} className="il-canvas" style={{ width: '100%', display: 'block' }} />
              <figcaption>{t('Reconstruction (frame 0)', 'Reconstruccion (fotograma 0)')}</figcaption>
            </figure>
            <figure className="il-fig">
              <img src={vaeFrameUrl(entry.id, frame)} alt={t('perturbed latent', 'latente perturbado')} className="il-canvas" style={{ width: '100%', display: 'block' }} />
              <figcaption>{t('Latent + noise', 'Latente + ruido')} ({frame})</figcaption>
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
          <p>{t('A variational autoencoder maps the selected image to a low-dimensional latent code and back; the latent is a learned, continuous representation.', 'Un autoencoder variacional mapea la imagen seleccionada a un codigo latente de baja dimension y de vuelta; el latente es una representacion aprendida y continua.')}</p>
          <Equation tex={String.raw`z=\mathcal{E}(x),\qquad \hat x=\mathcal{D}(z),\qquad \tilde x=\mathcal{D}(z+\sigma\,\epsilon)`} />
          <p>
            {t('Perturbing the latent gives plausible images along the learned manifold; disentangled generative directions (in GAN W-space, or a diffusion latent) are the most editable representation of all, though the edits here are entangled because the VAE latent is not disentangled ',
              'Perturbar el latente da imagenes plausibles a lo largo de la variedad aprendida; las direcciones generativas desenredadas (en el espacio W de un GAN, o un latente de difusion) son la representacion mas editable de todas, aunque las ediciones aqui estan enredadas porque el latente del VAE no esta desenredado ')}
            (<Cite id="kingma2013vae" />, <Cite id="karras2019stylegan" />, <Cite id="harkonen2020ganspace" />, <Cite id="rombach2022ldm" />).
          </p>
          <Callout variant="honest" title={t('Baked, not live', 'Precalculado, no en vivo')}>
            {t(
              'The encode and decode run offline in the open pipeline and the frames are replayed here; the reconstruction is a pass through a compression autoencoder for the exact selected image, not a live edit.',
              'La codificacion y decodificacion corren offline en el pipeline abierto y los fotogramas se reproducen aqui; la reconstruccion es un paso por un autoencoder de compresion para la imagen seleccionada exacta, no una edicion en vivo.',
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
