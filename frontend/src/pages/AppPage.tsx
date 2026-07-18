import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { FAMILIES } from '../lib/spectrum';

// The App is the per-image workbench: pick an image, then read it under each representation tab, editing
// that representation's parameters live. The interactive tabs are wired representation by representation
// (the Fourier/DFT tab is the first). Until a family is wired, its card states so honestly; the page
// becomes the full workbench (image selector + method tabs) as the tabs land.
export default function AppPage() {
  const t = useT();
  return (
    <div className="il-main" style={{ maxWidth: '72rem', margin: '0 auto' }}>
      <div>
        <p className="il-kicker">{t('App', 'App')}</p>
        <h1 style={{ margin: '0.2rem 0 0.4rem', fontSize: '1.5rem' }}>
          {t('The representation workbench', 'El banco de representaciones')}
        </h1>
        <p style={{ color: 'var(--color-fg-subtle)', lineHeight: 1.6 }}>
          {t(
            'Pick an image, then read it under each mathematical representation and edit that representation’s parameters to see the effect. Light transforms run live in your browser; heavier representations replay artifacts baked offline.',
            'Elige una imagen, luego leela bajo cada representacion matematica y edita los parametros de esa representacion para ver el efecto. Las transformadas ligeras corren en vivo en tu navegador; las representaciones mas pesadas reproducen artefactos horneados offline.',
          )}
        </p>
      </div>

      <div className="il-wip">
        <b>{t('Building in progress.', 'Construccion en curso.')}</b>{' '}
        {t(
          'The workbench is being wired one representation at a time. The first live tab is the Fourier / DFT transform (edit coefficients and watch the reconstruction, with PSNR and SSIM). The map below is the full set; each card will become an interactive tab on the selected image.',
          'El banco se conecta una representacion a la vez. La primera pestana en vivo es la transformada de Fourier / DFT (edita coeficientes y observa la reconstruccion, con PSNR y SSIM). El mapa de abajo es el conjunto completo; cada tarjeta se volvera una pestana interactiva sobre la imagen seleccionada.',
        )}{' '}
        <Link to="/introduction">{t('Read the idea first ->', 'Lee la idea primero ->')}</Link>
      </div>

      <div className="il-spectrum">
        {FAMILIES.map((fam) => (
          <div key={fam.id} className="il-sp-cell" style={{ ['--tone' as string]: fam.tone }}>
            <div className="n">
              {String(fam.index).padStart(2, '0')} &middot;{' '}
              <span className={`il-badge ${fam.lane === 'live' ? 'live' : fam.lane === 'replay' ? 'replay' : 'real'}`}>
                {fam.lane === 'live'
                  ? t('live', 'en vivo')
                  : fam.lane === 'replay'
                    ? t('replay', 'replay')
                    : t('mixed', 'mixto')}
              </span>
            </div>
            <div className="t">{t(fam.en, fam.es)}</div>
            <div className="d">{t(fam.blurb_en, fam.blurb_es)}</div>
            <div style={{ marginTop: '0.35rem' }}>
              <span className={`il-badge edit-${fam.edit}`}>{t(fam.editLabel_en, fam.editLabel_es)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
