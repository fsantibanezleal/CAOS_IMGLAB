# Deploy, GitHub Pages (static deterministic-replay)

ImageLab deploys as a static site (ADR-0055 Pages-first): the SPA plus the committed artifacts under
`data/derived/` are served statically; there is no backend at request time. The workflow
`.github/workflows/deploy-pages.yml`:

1. builds the frontend (`cd frontend && npm ci && npm run build`, `copy-data.mjs` overlays `data/derived` and
   `data/images` into `public/`);
2. uploads `frontend/dist` and deploys to Pages.

The offline bakes are not run on deploy: the derived artifacts (KLT basis, dictionaries, INR weights, primitive
fits, VAE latent walks, diffusion strips) are committed to the repo and are the deployable inputs. Rebake locally
with `python -m imglab.pipeline all` and commit when a representation changes.

Enable once: repo Settings, Pages, Source = GitHub Actions. Custom domain: set via
`gh api PUT repos/<owner>/<repo>/pages -f cname=<sub>.fasl-work.com` (the CNAME file alone does not set the domain
on Actions deploys, see the CAOS_MANAGE reference note). Add a `404.html` copy of `index.html` so SPA deep links
resolve.
