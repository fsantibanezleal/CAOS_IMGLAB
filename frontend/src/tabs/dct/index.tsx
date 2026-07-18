import { useEffect, useMemo, useRef, useState } from 'react';
import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../../lib/i18n';
import type { PanelProps, TabModule } from '../registry';
import { paintPlanes, withChannels, type ImagePlanes } from '../../engine/image';
import { psnr, ssim } from '../../engine/metrics';
import { dctBasisTiles, jpegPlane } from '../../engine/dct';
import { UPlotChart } from '../../render/UPlotChart';

function PlanesCanvas({ planes }: { planes: ImagePlanes | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && ref.current) paintPlanes(ref.current, planes);
  }, [planes]);
  return <canvas ref={ref} className="il-canvas" style={{ width: '100%', imageRendering: 'auto' }} />;
}

function DctPanel({ planes }: PanelProps) {
  const t = useT();
  const [quality, setQuality] = useState(20);
  const [keepZig, setKeepZig] = useState(64);
  const [block, setBlock] = useState(8);

  const result = useMemo(() => {
    if (!planes) return null;
    const opts = { quality, keepZig, blockSize: block };
    const chans = [planes.r, planes.g, planes.b].map((ch) => jpegPlane(ch, planes.w, planes.h, opts));
    const recon = withChannels(planes, chans.map((c) => c.recon));
    const kept = chans.reduce((s, c) => s + c.keptCoeffs, 0);
    const blocks = Math.floor(planes.w / block) * Math.floor(planes.h / block) * 3;
    return { recon, keptPerBlock: kept / Math.max(1, blocks), psnr: psnr(planes, recon), ssim: ssim(planes, recon) };
  }, [planes, quality, keepZig, block]);

  if (!planes || !result) return <div className="il-panel il-panel-sub">{t('Loading...', 'Cargando...')}</div>;

  const tabs: SubTabDef[] = [
    {
      id: 'compress',
      label: t('Compress', 'Comprimir'),
      content: (
        <div className="il-fourier">
          <div className="il-fourier-controls il-panel">
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Quality', 'Calidad')}</span>
                <b>{quality}</b>
              </div>
              <input className="range" type="range" min={1} max={100} step={1} value={quality} onChange={(e) => setQuality(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Zig-zag keep', 'Zig-zag conservar')}</span>
                <b>{keepZig} / {block * block}</b>
              </div>
              <input className="range" type="range" min={1} max={block * block} step={1} value={Math.min(keepZig, block * block)} onChange={(e) => setKeepZig(+e.target.value)} />
            </label>
            <label className="il-ctl">
              <div className="il-ctl-row">
                <span>{t('Block size', 'Tamaño de bloque')}</span>
                <b>{block} x {block}</b>
              </div>
              <div className="il-seg">
                {[4, 8, 16].map((b) => (
                  <button key={b} className={block === b ? 'on' : ''} onClick={() => setBlock(b)}>
                    {b}
                  </button>
                ))}
              </div>
            </label>
            <div className="il-kpis">
              <div className="il-kpi">
                <div className="il-kpi-v">{result.psnr === Infinity ? 'inf' : result.psnr.toFixed(1)}</div>
                <div className="il-kpi-l">PSNR (dB)</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result.ssim.toFixed(3)}</div>
                <div className="il-kpi-l">SSIM</div>
              </div>
              <div className="il-kpi">
                <div className="il-kpi-v">{result.keptPerBlock.toFixed(1)}</div>
                <div className="il-kpi-l">{t('coeffs/block', 'coefs/bloque')}</div>
              </div>
            </div>
            <p className="il-panel-sub">
              {t(
                'Quality is the rate knob: lower quality quantizes away high-frequency coefficients, and the image develops the characteristic blocking and edge ringing, block by block. Global within each 8x8 block, blocky between blocks.',
                'La calidad es la perilla de tasa: menor calidad cuantiza los coeficientes de alta frecuencia, y la imagen desarrolla el característico bloqueo y anillado de bordes, bloque a bloque. Global dentro de cada bloque 8x8, en bloques entre bloques.',
              )}
            </p>
          </div>
          <div className="il-fourier-views">
            <figure className="il-fig">
              <PlanesCanvas planes={planes} />
              <figcaption>{t('Original', 'Original')}</figcaption>
            </figure>
            <figure className="il-fig">
              <PlanesCanvas planes={result.recon} />
              <figcaption>{t('JPEG-style reconstruction', 'Reconstrucción estilo JPEG')}</figcaption>
            </figure>
          </div>
        </div>
      ),
    },
    { id: 'basis', label: t('Basis', 'Base'), content: <BasisGallery /> },
    { id: 'rd', label: t('Rate-distortion', 'Tasa-distorsión'), content: <DctRD planes={planes} block={block} /> },
    {
      id: 'method',
      label: t('Method', 'Método'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <p>{t('The 2D DCT-II on 8x8 blocks; each block is a weighted sum of 64 fixed cosine patterns.', 'La DCT-II 2D en bloques 8x8; cada bloque es una suma ponderada de 64 patrones coseno fijos.')}</p>
          <Equation tex={String.raw`C(k)=\alpha(k)\sum_{n=0}^{N-1} x(n)\cos\!\Big[\tfrac{\pi(2n+1)k}{2N}\Big],\ \ \alpha(0)=\sqrt{1/N},\ \alpha(k\ge1)=\sqrt{2/N}`} />
          <p>
            {t('Quantization ', 'La cuantización ')}
            <code>{'round(C/Q)'}</code>
            {t(' is the only lossy step; for image-like sources the DCT approaches the optimal Karhunen-Loeve transform, which is why JPEG uses it ',
              ' es el único paso con pérdida; para fuentes de tipo imagen la DCT se acerca a la transformada óptima de Karhunen-Loeve, por eso JPEG la usa ')}
            (<Cite id="ahmed1974dct" />, <Cite id="wallace1991jpeg" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['ahmed1974dct', 'wallace1991jpeg']} />
        </div>
      ),
    },
  ];

  return <SubTabs tabs={tabs} ariaLabel={t('DCT views', 'Vistas DCT')} />;
}

function BasisGallery() {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const N = 8;
    const tilePx = 30;
    const gap = 2;
    const size = N * (tilePx + gap) + gap;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border') || '#8884';
    ctx.fillRect(0, 0, size, size);
    const tiles = dctBasisTiles(N);
    tiles.forEach((tile, idx) => {
      const gx = (idx % N) * (tilePx + gap) + gap;
      const gy = Math.floor(idx / N) * (tilePx + gap) + gap;
      const img = ctx.createImageData(N, N);
      for (let i = 0; i < N * N; i++) {
        const v = Math.round(tile[i] * 255);
        img.data[4 * i] = v;
        img.data[4 * i + 1] = v;
        img.data[4 * i + 2] = v;
        img.data[4 * i + 3] = 255;
      }
      const off = document.createElement('canvas');
      off.width = N;
      off.height = N;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, gx, gy, tilePx, tilePx);
    });
  }, []);
  return (
    <div>
      <p className="il-panel-sub" style={{ marginBottom: '0.6rem' }}>
        {t(
          'The 64 fixed 8x8 DCT basis patterns (DC top-left, frequency rising to the right and down). Every block of the image is a weighted sum of exactly these; JPEG stores the weights.',
          'Los 64 patrones base fijos de la DCT 8x8 (DC arriba-izquierda, la frecuencia sube a la derecha y hacia abajo). Cada bloque de la imagen es una suma ponderada de exactamente estos; JPEG guarda los pesos.',
        )}
      </p>
      <canvas ref={ref} className="il-canvas" style={{ imageRendering: 'pixelated', maxWidth: 280 }} />
    </div>
  );
}

function DctRD({ planes, block }: { planes: ImagePlanes; block: number }) {
  const t = useT();
  const rd = useMemo(() => {
    const qs = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95];
    const xs: number[] = [];
    const ys: number[] = [];
    const ss: number[] = [];
    for (const q of qs) {
      const recon = withChannels(
        planes,
        [planes.r, planes.g, planes.b].map((ch) => jpegPlane(ch, planes.w, planes.h, { quality: q, blockSize: block }).recon),
      );
      xs.push(q);
      const p = psnr(planes, recon);
      ys.push(p === Infinity ? 60 : p);
      ss.push(ssim(planes, recon) * 100);
    }
    return { xs, ys, ss };
  }, [planes, block]);
  const data: [number[], number[], number[]] = [rd.xs, rd.ys, rd.ss];
  const series = useMemo(
    () => [
      { label: t('quality', 'calidad') },
      { label: 'PSNR (dB)', stroke: 'var(--il-transform)', width: 2, points: { show: true, size: 5 } },
      { label: 'SSIM x100', stroke: 'var(--il-designed)', width: 2, scale: 'ssim', points: { show: true, size: 5 } },
    ],
    [t],
  );
  return (
    <div>
      <p className="il-panel-sub" style={{ marginBottom: '0.6rem' }}>
        {t('Fidelity against the JPEG quality factor: the operational rate-distortion curve of block DCT coding.', 'Fidelidad frente al factor de calidad JPEG: la curva tasa-distorsión operacional del código DCT por bloques.')}
      </p>
      <UPlotChart
        data={data}
        series={series}
        height={280}
        scales={{ x: { time: false }, ssim: { range: [0, 100] } }}
        axes={[{ label: t('JPEG quality', 'calidad JPEG') }, { label: 'PSNR (dB)' }, { side: 1, scale: 'ssim', label: 'SSIM x100' }]}
      />
    </div>
  );
}

export const dctTab: TabModule = {
  id: 'dct',
  family: 'transforms',
  labelEn: 'DCT (JPEG)',
  labelEs: 'DCT (JPEG)',
  lane: 'live',
  Panel: DctPanel,
};
