// Screenshot top-level nav pages (light + dark), capturing console/page errors.
//   PAGES=/benchmark:Benchmark,/experiments:Experiments node tools/visual-verify/shoot-pages.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4194';
const OUT = process.env.OUT || 'E:/_Temp/imglab-shots';
const PAGES = (process.env.PAGES || '/benchmark:Benchmark,/experiments:Experiments').split(',').map((s) => s.split(':'));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errs = [];
for (const theme of ['dark', 'light']) {
  for (const [path, name] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((th) => localStorage.setItem('caos.theme', th), theme);
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errs.push(`[${theme} ${name}] ${m.text()}`));
    page.on('pageerror', (e) => errs.push(`[${theme} ${name}] ${e}`));
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/page-${name}-${theme}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console/page errors');
