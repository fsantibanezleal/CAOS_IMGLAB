import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shapes } from 'lucide-react';
import { AppShell, applyTheme, readTheme, CitationsProvider, type ShellConfig } from '@fasl-work/caos-app-shell';
import '@fasl-work/caos-app-shell/styles.css';
import 'katex/dist/katex.min.css';
import './imglab.css';
import { CITATIONS } from './data/citations';
import { EXTERNAL_LINKS } from './lib/links';
import pkg from '../package.json';

import AppPage from './pages/AppPage';
import Introduction from './pages/Introduction';
import Methodology from './pages/Methodology';
import Implementation from './pages/Implementation';
import Experiments from './pages/Experiments';
import Benchmark from './pages/Benchmark';

// Display version X.XX.XXX derived from the semver manifest (single source, no drift).
const displayVersion = pkg.version
  .split('.')
  .map((p, i) => (i === 0 ? p : p.padStart(i === 1 ? 2 : 3, '0')))
  .join('.');

applyTheme(readTheme());

// Restore a deep link captured by the Pages 404 shim (public/404.html) before the router mounts.
const redirect = sessionStorage.getItem('il-redirect');
if (redirect && redirect !== location.pathname + location.search) {
  sessionStorage.removeItem('il-redirect');
  history.replaceState(null, '', redirect);
}

const config: ShellConfig = {
  product: { name: 'ImageLab', mark: <Shapes size={18} aria-hidden="true" /> },
  routes: [
    { path: '/', en: 'App', es: 'App' },
    { path: '/introduction', en: 'Introduction', es: 'Introducción' },
    { path: '/methodology', en: 'Methodology', es: 'Metodología' },
    { path: '/implementation', en: 'Implementation', es: 'Implementación' },
    { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
    { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
  ],
  links: {
    github: EXTERNAL_LINKS.github,
    personal: EXTERNAL_LINKS.personal,
    portfolio: EXTERNAL_LINKS.portfolio,
  },
  version: displayVersion,
  footer: {
    provenance: {
      en: 'Images: public-domain and permissively-licensed sources (NASA/STScI, ESA/Webb, Kodak, CLIC, the Met and Art Institute of Chicago CC0, Poly Haven and ambientCG CC0, BBBC CC-BY) plus in-repo procedurally generated figures (MIT), each attributed. Engines: numpy, scipy, PyWavelets, scikit-image, scikit-learn and PyTorch offline; in-browser transforms and shaders live.',
      es: 'Imágenes: fuentes de dominio público y con licencia permisiva (NASA/STScI, ESA/Webb, Kodak, CLIC, el Met y el Art Institute of Chicago CC0, Poly Haven y ambientCG CC0, BBBC CC-BY) más figuras generadas proceduralmente en el repo (MIT), con atribución. Motores: numpy, scipy, PyWavelets, scikit-image, scikit-learn y PyTorch offline; transformadas y shaders en vivo en el navegador.',
    },
    disclaimer: {
      en: 'A research lab, not a production image tool: every representation is either computed live in your browser or baked offline by the open, seed-deterministic pipeline and is reproducible from the repo; generative reconstructions are labelled as plausible, not faithful.',
      es: 'Un laboratorio de investigación, no una herramienta de imágenes de producción: cada representación se calcula en vivo en tu navegador o se hornea offline con el pipeline abierto y determinista por semilla, y es reproducible desde el repo; las reconstrucciones generativas se etiquetan como plausibles, no fieles.',
    },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CitationsProvider items={CITATIONS}>
        <AppShell config={config}>
          <Routes>
            <Route path="/" element={<AppPage />} />
            <Route path="/introduction" element={<Introduction />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/implementation" element={<Implementation />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="*" element={<AppPage />} />
          </Routes>
        </AppShell>
      </CitationsProvider>
    </BrowserRouter>
  </StrictMode>,
);
