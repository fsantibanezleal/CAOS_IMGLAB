// Screenshot the built SPA for visual verification (light + dark, per route), capturing console/page
// errors. Reusable across representation tabs. Requires a running preview server and Playwright with the
// browser cache on E: (PLAYWRIGHT_BROWSERS_PATH=E:/_Temp/ms-playwright).
//   node tools/visual-verify/shoot.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4174';
const OUT = process.env.OUT || 'E:/_Temp/imglab-shots';
const ROUTES = (process.env.ROUTES || '/,/introduction,/methodology,/implementation,/experiments,/benchmark').split(',');
const THEMES = ['dark', 'light'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((th) => localStorage.setItem('caos.theme', th), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const route of ROUTES) {
    const url = BASE + route;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push(`goto ${route}: ${e}`));
    await page.waitForTimeout(900);
    const name = (route === '/' ? 'app' : route.slice(1)) + '-' + theme;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    report.push({ route, theme, file: `${name}.png` });
  }
  report.push({ theme, errors });
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const allErrors = report.filter((r) => r.errors).flatMap((r) => r.errors.map((e) => `[${r.theme}] ${e}`));
console.log(`shots -> ${OUT}`);
console.log(allErrors.length ? `CONSOLE/PAGE ERRORS:\n${allErrors.join('\n')}` : 'no console/page errors');
