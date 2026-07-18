import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, withChannels, type ImagePlanes } from '../../engine/image';
import { psnr, ssim } from '../../engine/metrics';
import { atomTile, loadDictionary, prepareDict, sparseReconstructPlane, type Dictionary, type PreparedDict } from '../../engine/sparse';

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function FramesPanel({ planes }: PanelProps) {
  const t = useT();
  const [dicts, setDicts] = useState<{ learned?: Dictionary; overdct?: Dictionary }>({});
  const [err, setErr] = useState<string | null>(null);
  const [which, setWhich] = useState<'learned' | 'overdct'>('learned');
  const [T, setT] = useState(4);
  const appliedT = useDebounced(T, 180);

  useEffect(() => {
    Promise.all([loadDictionary('learned'), loadDictionary('overdct')])
      .then(([learned, overdct]) => setDicts({ learned, overdct }))
      .catch((e) => setErr(String(e)));
  }, []);

  const dict = dicts[which];
  const prepared: PreparedDict | null = useMemo(() => (dict ? prepareDict(dict) : null), [dict]);

  const result = useMemo(() => {
    if (!planes || !prepared) return null;
    const chans = [planes.r, planes.g, planes.b].map((ch) => sparseReconstructPlane(ch, planes.w, planes.h, prepared, appliedT));
    const recon = withChannels(planes, chans.map((c) => c.recon));
    const avg = chans.reduce((s, c) => s + c.avgAtoms, 0) / 3;
    return { recon, avg, psnr: psnr(planes, recon), ssim: ssim(planes, recon) };
  }, [planes, prepared, appliedT]);

  if (err) return <div className="il-panel il-panel-sub">{t('Dictionaries unavailable: ', 'Diccionarios no disponibles: ')}<code>{err}</code></div>;
  if (!planes || !dict) return <div className="il-panel il-panel-sub">{t('Loading the dictionaries...', 'Cargando los diccionarios...')}</div>;

  const tabs: SubTabDef[] = [
    {
      id: 'sparse',
      label: t('Sparse code', 'Codigo disperso'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <label className="il-ctl">
              <div className="il-panel-t">{t('Dictionary (the alphabet)', 'Diccionario (el alfabeto)')}</div>
              <div className="il-seg">
                <button className={which === 'learned' ? 'on' : ''} onClick={() => setWhich('learned')}>{t('Learned', 'Aprendido')}</button>
                <button className={which === 'overdct' ? 'on' : ''} onClick={() => setWhich('overdct')}>{t('Overcomplete DCT', 'DCT sobrecompleto')}</button>
              </div>
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Sparsity (atoms per patch)', 'Dispersion (atomos por parche)')}</span>
                <b>{T}</b>
              </div>
              <input className="range" type="range" min={1} max={16} step={1} value={T} onChange={(e) => setT(+e.target.value)} />
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{result ? (result.psnr === Infinity ? 'inf' : result.psnr.toFixed(1)) : '...'}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result?.ssim.toFixed(3) ?? '...'}</div>
                <div className="il-kpi-l">SSIM</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result?.avg.toFixed(1) ?? '...'}</div>
                <div className="il-kpi-l">{t('atoms/patch', 'atomos/parche')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'An overcomplete dictionary has 144 atoms for 64-dimensional patches, so each patch is written as a sparse mix of just a few. Swap the alphabet between the learned dictionary and the overcomplete cosine dictionary: the same image, re-expressed. This is the interpretable middle of the spectrum, atom edits are local and meaningful.',
                'Un diccionario sobrecompleto tiene 144 atomos para parches de 64 dimensiones, así que cada parche se escribe como una mezcla dispersa de solo unos pocos. Cambia el alfabeto entre el diccionario aprendido y el diccionario coseno sobrecompleto: la misma imagen, re-expresada. Este es el medio interpretable del espectro, las ediciones de atomos son locales y con sentido.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <PlanesCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={result?.recon ?? null} />
              <figcaption>{t('Sparse reconstruction', 'Reconstruccion dispersa')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    { id: 'atoms', label: t('Atoms', 'Atomos'), content: <AtomGallery dict={dict} which={which} /> },
    {
      id: 'method',
      label: t('Method', 'Metodo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('Find the sparsest combination of dictionary atoms that reconstructs each patch, within a fixed atom budget.', 'Encuentra la combinacion mas dispersa de atomos del diccionario que reconstruye cada parche, dentro de un presupuesto fijo de atomos.')}</p>
          <Equation tex={String.raw`\min_{a}\ \lVert x - D\,a\rVert_2^2\quad\text{s.t.}\quad \lVert a\rVert_0\le T`} />
          <p>
            {t('solved greedily by orthogonal matching pursuit. The learned dictionary is fit on natural-image patches (sparse coding gives localized, oriented atoms); the overcomplete-DCT dictionary is fixed. Both are overcomplete frames ',
              'resuelto de forma voraz por orthogonal matching pursuit. El diccionario aprendido se ajusta sobre parches de imagenes naturales (la codificacion dispersa da atomos localizados y orientados); el diccionario DCT sobrecompleto es fijo. Ambos son marcos sobrecompletos ')}
            (<Cite id="olshausen1996" />, <Cite id="aharon2006ksvd" />, <Cite id="tang2007haar" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['olshausen1996', 'aharon2006ksvd', 'tang2007haar', 'donoho2006cs']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('Frames views', 'Vistas de marcos')} />;
}

function AtomGallery({ dict, which }: { dict: Dictionary; which: string }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const P = dict.patch;
    const cols = 12;
    const rows = Math.ceil(dict.nAtoms / cols);
    const tilePx = 22;
    const gap = 2;
    canvas.width = cols * (tilePx + gap) + gap;
    canvas.height = rows * (tilePx + gap) + gap;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border') || '#8884';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let a = 0; a < dict.nAtoms; a++) {
      const tile = atomTile(dict, a);
      const gx = (a % cols) * (tilePx + gap) + gap;
      const gy = Math.floor(a / cols) * (tilePx + gap) + gap;
      const img = ctx.createImageData(P, P);
      for (let i = 0; i < P * P; i++) {
        const v = Math.round(tile[i] * 255);
        img.data[4 * i] = v;
        img.data[4 * i + 1] = v;
        img.data[4 * i + 2] = v;
        img.data[4 * i + 3] = 255;
      }
      const off = document.createElement('canvas');
      off.width = P;
      off.height = P;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, gx, gy, tilePx, tilePx);
    }
  }, [dict]);
  return (
    <div>
      <p className="il-panel-sub" style={{ marginBottom: '0.6rem' }}>
        {t('The 144 atoms of the', 'Los 144 atomos del')} {which === 'learned' ? t('learned dictionary', 'diccionario aprendido') : t('overcomplete-DCT dictionary', 'diccionario DCT sobrecompleto')}
        {t('. The learned atoms are localized oriented edges and textures; the DCT atoms are cosine gratings.', '. Los atomos aprendidos son bordes y texturas orientados y localizados; los atomos DCT son rejillas coseno.')}
      </p>
      <canvas ref={ref} className="il-canvas" style={{ imageRendering: 'pixelated', maxWidth: 320 }} />
    </div>
  );
}

export const framesTab: TabModule = {
  id: 'frames',
  family: 'frames',
  labelEn: 'Frames / dictionaries',
  labelEs: 'Marcos / diccionarios',
  lane: 'live',
  Panel: FramesPanel,
};
