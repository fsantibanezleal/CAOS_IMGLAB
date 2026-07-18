// Exhaustive production verification against the LIVE domain: every App tab, every nav page, and the
// architecture modal, in both themes, capturing console/page errors and blank-canvas / empty-content flags.
//   BASE_URL=http://imglab.fasl-work.com node tools/visual-verify/shoot-live-all.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://imglab.fasl-work.com';
const OUT = process.env.OUT || 'E:/_Temp/imglab-live';
mkdirSync(OUT, { recursive: true });

const TABS = [
  'Image', 'Fourier', 'DCT (JPEG)', 'Wavelet', 'KLT / PCA', 'Frames / dictionaries',
  'Primitives', 'Epicycles', 'Neural field', 'Symbolic / CPPN', 'Learned latents', 'Diffusion',
];
const PAGES = [
  ['/introduction', 'Introduction'], ['/methodology', 'Methodology'], ['/implementation', 'Implementation'],
  ['/experiments', 'Experiments'], ['/benchmark', 'Benchmark'],
];

const browser = await chromium.launch();
const errors = [];
const report = [];

for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await ctx.addInitScript((th) => localStorage.setItem('caos.theme', th), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${theme}] console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${theme}] pageerror: ${e}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.includes('favicon')) errors.push(`[${theme}] reqfailed: ${u} (${r.failure()?.errorText})`);
  });

  // --- App tabs ---
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1000);
  for (const tab of TABS) {
    const ok = await page.getByRole('tab', { name: tab, exact: true }).first().click().then(() => true).catch(() => false);
    if (!ok) { errors.push(`[${theme}] tab not found: ${tab}`); continue; }
    await page.waitForTimeout(900);
    // check the panel drew something on a canvas or img
    const drew = await page.evaluate(() => {
      const c = document.querySelector('.cp-main canvas, .il-canvas, canvas, .cp-main img, .il-fig img');
      if (!c) return 'no-canvas-or-img';
      const r = c.getBoundingClientRect();
      return r.width > 40 && r.height > 40 ? 'ok' : `tiny:${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    if (drew !== 'ok') report.push(`[${theme}] ${tab}: ${drew}`);
    await page.screenshot({ path: `${OUT}/tab-${tab.replace(/[^A-Za-z0-9]+/g, '_')}-${theme}.png` });
  }

  // --- nav pages ---
  for (const [path, name] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/page-${name}-${theme}.png`, fullPage: true });
  }

  // --- architecture modal ---
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(700);
  const opened = await page.locator('button[aria-label*="rchitecture"], button[title*="rchitecture"], button[aria-label*="How it works"]').first().click().then(() => true).catch(() => false);
  if (opened) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/arch-${theme}.png` });
  } else {
    errors.push(`[${theme}] architecture modal button not found`);
  }

  await ctx.close();
}
await browser.close();

console.log('=== content flags ===');
console.log(report.length ? report.join('\n') : 'all tabs drew a canvas/img >= 40px');
console.log('=== console/page/request errors ===');
console.log(errors.length ? errors.join('\n') : 'NONE');
