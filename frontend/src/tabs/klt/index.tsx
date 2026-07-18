import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, withChannels, type ImagePlanes } from '../../engine/image';
import { psnr, ssim } from '../../engine/metrics';
import { kltEigenTile, kltReconstructPlane, loadKltBasis, type PatchBasis } from '../../engine/klt';
import { UPlotChart } from '../../render/UPlotChart';

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function KltPanel({ planes }: PanelProps) {
  const t = useT();
  const [basis, setBasis] = useState<PatchBasis | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [m, setM] = useState(8);

  useEffect(() => {
    loadKltBasis().then(setBasis).catch((e) => setErr(String(e)));
  }, []);

  const result = useMemo(() => {
    if (!planes || !basis) return null;
    const recon = withChannels(
      planes,
      [planes.r, planes.g, planes.b].map((ch) => kltReconstructPlane(ch, planes.w, planes.h, basis, m)),
    );
    return { recon, psnr: psnr(planes, recon), ssim: ssim(planes, recon) };
  }, [planes, basis, m]);

  if (err) return <div className="il-panel il-panel-sub">{t('KLT basis unavailable: ', 'Base KLT no disponible: ')}<code>{err}</code></div>;
  if (!planes || !basis) return <div className="il-panel il-panel-sub">{t('Loading the eigenbasis...', 'Cargando la base propia...')}</div>;

  const keptRate = ((m / basis.K) * 100).toFixed(0);
  const cumVar = basis.cumulativeVar[Math.min(m - 1, basis.cumulativeVar.length - 1)];

  const tabs: SubTabDef[] = [
    {
      id: 'reconstruct',
      label: t('Reconstruct', 'Reconstruir'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Components', 'Componentes')}</span>
                <b>{m} / {basis.K}</b>
              </div>
              <input className="range" type="range" min={1} max={basis.K} step={1} value={m} onChange={(e) => setM(+e.target.value)} />
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{result && result.psnr === Infinity ? 'inf' : result?.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result?.ssim.toFixed(3)}</div>
                <div className="il-kpi-l">SSIM</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{(cumVar * 100).toFixed(1)}%</div>
                <div className="il-kpi-l">{t('variance', 'varianza')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'The KLT is the optimal linear basis for this ensemble: it decorrelates and packs the most energy into the fewest components. Reconstruct each 8x8 block from the top m eigen-patches. Unlike Fourier or DCT, this basis is data-adaptive, so it is quasi-semantic, but only for images like the ones it was fit on.',
                'La KLT es la base lineal óptima para este conjunto: decorrelaciona y concentra la mayor energía en los menos componentes. Reconstruir cada bloque 8x8 con los m primeros parches propios. A diferencia de Fourier o DCT, esta base es adaptada a los datos, así que es cuasi-semántica, pero solo para imágenes como las que la ajustaron.',
              )}
            </p>
            <div className="il-panel-sub">{t('Kept', 'Conservado')}: {keptRate}%</div>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <PlanesCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={result?.recon ?? null} />
              <figcaption>{t('KLT reconstruction', 'Reconstrucción KLT')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    { id: 'eigen', label: t('Eigenimages', 'Imágenes propias'), content: <EigenView basis={basis} m={m} /> },
    {
      id: 'method',
      label: t('Method', 'Método'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('Diagonalize the patch covariance; the eigenvectors are the eigenimages, the optimal linear basis for the ensemble.', 'Diagonalizar la covarianza de parches; los vectores propios son las imágenes propias, la base lineal óptima para el conjunto.')}</p>
          <Equation tex={String.raw`\Sigma=U\Lambda U^{\!\top},\qquad y=U^{\!\top}(x-\mu),\qquad \hat x=\mu+U_{:m}\,y_{:m}`} />
          <p>
            {t('Among linear orthonormal transforms the KLT uniquely decorrelates, maximizes energy compaction, and minimizes truncated error (Hotelling 1933); for aligned faces the eigenimages are eigenfaces.',
              'Entre las transformadas ortonormales lineales la KLT únicamente decorrelaciona, maximiza la compactación de energía y minimiza el error truncado (Hotelling 1933); para rostros alineados las imágenes propias son eigenfaces.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['wang2004ssim']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('KLT views', 'Vistas KLT')} />;
}

function EigenView({ basis, m }: { basis: PatchBasis; m: number }) {
  const t = useT();
  const galRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = galRef.current;
    if (!canvas) return;
    const P = basis.patch;
    const cols = 8;
    const rows = Math.ceil((basis.K + 1) / cols);
    const tilePx = 30;
    const gap = 2;
    canvas.width = cols * (tilePx + gap) + gap;
    canvas.height = rows * (tilePx + gap) + gap;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border') || '#8884';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let idx = 0; idx <= basis.K; idx++) {
      const tile = kltEigenTile(basis, idx);
      const gx = (idx % cols) * (tilePx + gap) + gap;
      const gy = Math.floor(idx / cols) * (tilePx + gap) + gap;
      const img = ctx.createImageData(P, P);
      for (let i = 0; i < P * P; i++) {
        const v = Math.round(tile[i] * 255);
        img.data[4 * i] = v;
        img.data[4 * i + 1] = v;
        img.data[4 * i + 2] = v;
        img.data[4 * i + 3] = idx < m + 1 ? 255 : 90; // kept components at full opacity
      }
      const off = document.createElement('canvas');
      off.width = P;
      off.height = P;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, gx, gy, tilePx, tilePx);
    }
  }, [basis, m]);

  const spectrum = useMemo(() => {
    const idx = basis.eigenvalues.map((_, i) => i + 1);
    const ev = basis.eigenvalues.map((v) => Math.max(v, 1e-6));
    const cum = basis.cumulativeVar.map((v) => v * 100);
    return [idx, ev, cum] as [number[], number[], number[]];
  }, [basis]);
  const series = useMemo(
    () => [
      { label: t('component', 'componente') },
      { label: t('eigenvalue', 'valor propio'), stroke: 'var(--il-transform)', width: 2, scale: 'ev' },
      { label: t('cumulative var %', 'var acumulada %'), stroke: 'var(--il-designed)', width: 2, scale: 'var' },
    ],
    [t],
  );

  return (
    <div>
      <p className="il-panel-sub" style={{ marginBottom: '0.6rem' }}>
        {t('The mean patch (top-left) and the eigen-patches, ordered by energy; the kept components are highlighted. Below, the eigenvalue spectrum shows how quickly energy compacts.', 'El parche medio (arriba-izquierda) y los parches propios, ordenados por energía; los componentes conservados están resaltados. Abajo, el espectro de valores propios muestra cuán rápido se compacta la energía.')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.2rem', alignItems: 'start' }}>
        <canvas ref={galRef} className="il-canvas" style={{ imageRendering: 'pixelated', maxWidth: 280 }} />
        <UPlotChart
          data={spectrum}
          series={series}
          height={260}
          scales={{ x: { time: false }, ev: { distr: 3 }, var: { range: [0, 100] } }}
          axes={[{ label: t('component index', 'índice de componente') }, { scale: 'ev', label: t('eigenvalue (log)', 'valor propio (log)') }, { side: 1, scale: 'var', label: '% var' }]}
        />
      </div>
    </div>
  );
}

export const kltTab: TabModule = {
  id: 'klt',
  family: 'transforms',
  labelEn: 'KLT / PCA',
  labelEs: 'KLT / PCA',
  lane: 'live',
  Panel: KltPanel,
};
