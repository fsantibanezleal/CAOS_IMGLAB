import pkg from '../../package.json';

// The app version, used to cache-bust data fetches (index.json, artifacts) on GitHub Pages.
export const APP_VERSION = pkg.version;
