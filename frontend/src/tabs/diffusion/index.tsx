import { useEffect, useRef, useState } from 'react';
import { SubTabs, Equation, Callout, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { Pause, Play } from 'lucide-react';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { diffFrameUrl, loadDiffIndex, type DiffEntry } from '../../engine/diffusion';

function DiffusionPanel({ entry }: PanelProps) {
  const t = useT();
  const [images, setImages] = useState<DiffEntry[] | null>(null);
  const [strengths, setStrengths] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    loadDiffIndex()
      .then((i) => {
        setImages(i.images);
        setStrengths(i.strengths);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const diff = images?.find((e) => e.id === entry.id) ?? null;

  useEffect(() => {
    if (!diff) return;
    for (let i = 0; i < diff.frames; i++) {
      const im = new Image();
      im.src = diffFrameUrl(entry.id, i);
    }
    setFrame(0);
    setPlaying(false);
  }, [diff, entry.id]);

  useEffect(() => {
    if (!playing || !diff) return;
    let last = 0;
    let dir = 1;
    let f = frame;
    const step = (ts: number) => {
      if (ts - last > 130) {
        last = ts;
        f += dir;
        if (f >= diff.frames - 1) ((f = diff.frames - 1), (dir = -1));
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
  }, [playing, diff]);

  if (err) return <div className="il-panel il-panel-sub">{t('Diffusion strips unavailable: ', 'Tiras de difusion no disponibles: ')}<code>{err}</code></div>;
  if (images && !diff) {
    return (
      <div className="il-doc">
        <Callout variant="honest" title={t('Baked for the curated set', 'Precalculado para el conjunto curado')}>
          {t(
            'A diffusion UNet is far too heavy for the browser, so the image-to-image regeneration is baked offline for every curated image; your uploaded image is handled by the live transform and dictionary tabs.',
            'Una UNet de difusion es demasiado pesada para el navegador, asi que la regeneracion imagen-a-imagen se precalcula offline para cada imagen curada; tu imagen cargada se maneja en las pestanas en vivo de transformada y diccionario.',
          )}
        </Callout>
      </div>
    );
  }
  if (!images || !diff) return <div className="il-panel il-panel-sub">{t('Loading the diffusion strip...', 'Cargando la tira de difusion...')}</div>;

  const strengthLabel = frame === 0 ? t('original', 'original') : `strength ${strengths[frame - 1]?.toFixed(2) ?? ''}`;

  const tabs: SubTabDef[] = [
    {
      id: 'strip',
      label: t('Image to image', 'Imagen a imagen'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <div className="il-panel-t">{t('Regenerated from the selected image', 'Regenerada desde la imagen seleccionada')}</div>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Regeneration strength', 'Fuerza de regeneracion')}</span>
                <b>{frame} / {diff.frames - 1}</b>
              </div>
              <input className="range" type="range" min={0} max={diff.frames - 1} step={1} value={frame} onChange={(e) => setFrame(+e.target.value)} />
            </label>
            <button className="chip" onClick={() => setPlaying((p) => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: 'fit-content' }}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}
            </button>
            <p className="il-panel-sub">
              {t(
                'The selected image is encoded, noised, and denoised back by a real diffusion model (SD-Turbo image-to-image). At low strength it returns almost the original; as the strength rises the learned prior re-imagines the picture more freely. The knob is a single scalar over the whole image: semantic but wholly entangled, the far generative pole.',
                'La imagen seleccionada se codifica, se le agrega ruido y un modelo de difusion real la limpia de vuelta (SD-Turbo imagen-a-imagen). A baja fuerza devuelve casi el original; al subir la fuerza el prior aprendido re-imagina la imagen con mas libertad. La perilla es un unico escalar sobre toda la imagen: semantica pero totalmente enredada, el polo generativo lejano.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <img src={diffFrameUrl(entry.id, 0)} alt={t('original', 'original')} className="il-canvas" style={{ width: '100%', display: 'block' }} />
              <figcaption>{t('Original (frame 0)', 'Original (fotograma 0)')}</figcaption>
            </figure>
            <figure className="il-fig">
              <img src={diffFrameUrl(entry.id, frame)} alt={strengthLabel} className="il-canvas" style={{ width: '100%', display: 'block' }} />
              <figcaption>{strengthLabel}</figcaption>
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
              'A diffusion model learns to reverse a gradual noising process. Image-to-image starts from the encoded selected image, adds noise proportional to a strength, and runs the learned reverse chain to denoise it back.',
              'Un modelo de difusion aprende a revertir un proceso de ruido gradual. Imagen-a-imagen parte de la imagen seleccionada codificada, agrega ruido proporcional a una fuerza, y corre la cadena inversa aprendida para limpiarla de vuelta.',
            )}
          </p>
          <Equation tex={String.raw`x_T=\sqrt{\bar\alpha_T}\,\mathcal{E}(x_0)+\sqrt{1-\bar\alpha_T}\,\epsilon,\quad T=\lfloor \text{strength}\cdot N\rfloor,\qquad x_{t-1}=\tfrac{1}{\sqrt{\alpha_t}}\!\left(x_t-\tfrac{1-\alpha_t}{\sqrt{1-\bar\alpha_t}}\,\epsilon_\theta(x_t,t)\right)+\sigma_t z` } />
          <p>
            {t('The strength sets how far back into noise the image is pushed before the denoiser re-imagines it; the whole picture changes together, so no parameter is a local handle ',
              'La fuerza fija cuanto se empuja la imagen hacia el ruido antes de que el limpiador la re-imagine; la imagen entera cambia junta, asi que ningun parametro es un control local ')}
            (<Cite id="ho2020ddpm" />, <Cite id="rombach2022ldm" />, <Cite id="sauer2023add" />).
          </p>
          <Callout variant="honest" title={t('Baked, not live', 'Precalculado, no en vivo')}>
            {t(
              'The generations run offline in the open pipeline with a real small model (SD-Turbo) and are replayed here; they are model samples for the exact selected image at a fixed seed, shown to illustrate the entangled generative pole.',
              'Las generaciones corren offline en el pipeline abierto con un modelo pequeno real (SD-Turbo) y se reproducen aqui; son muestras del modelo para la imagen seleccionada exacta con semilla fija, mostradas para ilustrar el polo generativo enredado.',
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
