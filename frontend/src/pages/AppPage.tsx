import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, type TabDef } from '@fasl-work/caos-app-shell';
import { Upload } from 'lucide-react';
import { useT } from '../lib/i18n';
import { FAMILIES } from '../lib/spectrum';
import { imageUrl, type ImageEntry } from '../lib/contract.types';
import { CATEGORY_LABEL, groupByCategory, loadImageSet } from '../lib/imageset';
import { type ImagePlanes, loadFilePlanes, loadImagePlanes, paintPlanes } from '../engine/image';
import { PanelBoundary } from '../render/PanelBoundary';
import { FAMILY_ORDER, TABS } from '../tabs/registry';

const WORKING = 256;

// The App page: pick an image (or upload your own), then read it under each representation tab. The tab
// registry (frontend/src/tabs) fills in as representations land; the Image tab is always present.
export default function AppPage() {
  const t = useT();
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ entry: ImageEntry; planes: ImagePlanes } | null>(null);
  const [planes, setPlanes] = useState<ImagePlanes | null>(null);

  useEffect(() => {
    loadImageSet()
      .then((imgs) => {
        setImages(imgs);
        if (imgs.length) setSelectedId(imgs.find((i) => i.id === 'photo_parrots')?.id ?? imgs[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const entry: ImageEntry | null = useMemo(() => {
    if (uploaded) return uploaded.entry;
    return images.find((i) => i.id === selectedId) ?? null;
  }, [images, selectedId, uploaded]);

  useEffect(() => {
    let cancelled = false;
    if (uploaded) {
      setPlanes(uploaded.planes);
      return;
    }
    if (!entry) return;
    setPlanes(null);
    loadImagePlanes(imageUrl(entry.id), WORKING)
      .then((p) => {
        if (!cancelled) setPlanes(p);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [entry, uploaded]);

  async function onUpload(file: File) {
    try {
      const p = await loadFilePlanes(file, WORKING);
      const up: ImageEntry = {
        id: 'user-upload',
        category: 'synthetic',
        title: file.name,
        titleEs: file.name,
        license: 'your image',
        source: 'user upload',
        attribution: 'Your own image, processed in your browser and never uploaded to a server.',
        width: p.w,
        height: p.h,
        kind: 'real',
        spdx: 'RUNTIME',
        source_url: null,
        sha256: '',
        family_hints: [],
        has_hires: false,
        generator: null,
        added: '',
      };
      setUploaded({ entry: up, planes: p });
    } catch (e) {
      setError(String(e));
    }
  }

  const tabDefs: TabDef[] = useMemo(() => {
    const defs: TabDef[] = [
      {
        id: 'image',
        label: t('Image', 'Imagen'),
        content: entry ? <ImageTab entry={entry} planes={planes} /> : null,
      },
    ];
    const ordered = [...TABS].sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));
    for (const tab of ordered) {
      defs.push({
        id: tab.id,
        label: t(tab.labelEn, tab.labelEs),
        content: entry ? (
          <PanelBoundary label={tab.labelEn}>
            <tab.Panel entry={entry} planes={planes} />
          </PanelBoundary>
        ) : null,
      });
    }
    return defs;
  }, [entry, planes, t]);

  if (error) {
    return (
      <div className="il-doc">
        <p className="il-kicker">{t('App', 'App')}</p>
        <div className="il-wip">
          {t('Could not load the image set: ', 'No se pudo cargar el conjunto de imagenes: ')}
          <code>{error}</code>
        </div>
      </div>
    );
  }

  return (
    <div className="il-layout">
      <aside className="il-controls">
        <div className="il-panel">
          <div className="il-panel-t">{t('Image', 'Imagen')}</div>
          <label className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Upload size={14} aria-hidden="true" />
            {t('Upload your own', 'Sube la tuya')}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
          {uploaded && (
            <button className="chip" style={{ marginLeft: '0.4rem' }} onClick={() => setUploaded(null)}>
              {t('back to set', 'volver al conjunto')}
            </button>
          )}
        </div>

        {groupByCategory(images).map(([cat, items]) => (
          <div key={cat} className="il-panel">
            <div className="il-panel-t">{t(CATEGORY_LABEL[cat].en, CATEGORY_LABEL[cat].es)}</div>
            <div className="il-thumbs">
              {items.map((im) => (
                <button
                  key={im.id}
                  className={`il-thumb${!uploaded && im.id === selectedId ? ' on' : ''}`}
                  title={t(im.title, im.titleEs ?? im.title)}
                  onClick={() => {
                    setUploaded(null);
                    setSelectedId(im.id);
                  }}
                >
                  <img src={imageUrl(im.id)} alt={im.title} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main className="il-main">
        {entry && (
          <div className="il-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{t(entry.title, entry.titleEs ?? entry.title)}</strong>{' '}
                <span className="il-badge replay">
                  {t(CATEGORY_LABEL[entry.category].en, CATEGORY_LABEL[entry.category].es)}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--color-fg-faint)' }}>{entry.attribution}</span>
            </div>
          </div>
        )}
        {TABS.length === 0 && (
          <div className="il-wip">
            {t(
              'The representation tabs are being wired in. The Image tab shows the selected picture and which representations it best illustrates; the first live tab is the Fourier transform.',
              'Las pestanas de representacion se estan conectando. La pestana Imagen muestra la imagen seleccionada y que representaciones ilustra mejor; la primera pestana en vivo es la transformada de Fourier.',
            )}
          </div>
        )}
        <Tabs tabs={tabDefs} ariaLabel={t('Representations', 'Representaciones')} />
      </main>
    </div>
  );
}

// The always-present Image tab: the raw picture, its provenance, and which families it best illustrates.
function ImageTab({ entry, planes }: { entry: ImageEntry; planes: ImagePlanes | null }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (planes && canvasRef.current) paintPlanes(canvasRef.current, planes);
  }, [planes]);

  const hints = (entry.family_hints ?? [])
    .map((i) => FAMILIES.find((f) => f.index === i + 1))
    .filter(Boolean);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) 1fr', gap: '1.2rem', alignItems: 'start' }}>
      <div className="il-chart">
        <canvas ref={canvasRef} className="il-canvas" style={{ imageRendering: 'auto', width: '100%' }} />
      </div>
      <div>
        <p style={{ color: 'var(--color-fg-subtle)', lineHeight: 1.6, marginTop: 0 }}>
          {t(
            'This is the raw image: a matrix of pixels, the representation with no compression and no structure. Every other tab re-expresses this same picture as mathematics and lets you edit it.',
            'Esta es la imagen cruda: una matriz de pixeles, la representacion sin compresion ni estructura. Cada otra pestana re-expresa esta misma imagen como matematica y te deja editarla.',
          )}
        </p>
        <table className="il-table" style={{ marginTop: '0.6rem' }}>
          <tbody>
            <tr>
              <td>{t('Size', 'Tamano')}</td>
              <td className="mono">{planes ? `${planes.w} x ${planes.h}` : `${entry.width} x ${entry.height}`}</td>
            </tr>
            <tr>
              <td>{t('License', 'Licencia')}</td>
              <td className="mono">{entry.license}</td>
            </tr>
            <tr>
              <td>{t('Source', 'Fuente')}</td>
              <td>{entry.source}</td>
            </tr>
          </tbody>
        </table>
        {hints.length > 0 && (
          <div style={{ marginTop: '0.8rem' }}>
            <div className="il-panel-t">{t('Best illustrates', 'Ilustra mejor')}</div>
            <div className="il-chips">
              {hints.map(
                (f) =>
                  f && (
                    <span key={f.id} className="chip" style={{ cursor: 'default' }}>
                      {t(f.en, f.es)}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
