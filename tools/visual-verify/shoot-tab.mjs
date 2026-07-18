// Screenshot one representation tab and its sub-views (light + dark), capturing console/page errors.
//   TAB=Fourier SUBTABS=Spectrum,Phase,Rate-distortion,Method node tools/visual-verify/shoot-tab.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4174';
const OUT = process.env.OUT || 'E:/_Temp/imglab-shots';
const TAB = process.env.TAB || 'Fourier';
const SUBTABS = (process.env.SUBTABS || 'Spectrum,Phase,Rate-distortion,Method').split(',');
const IMAGE = process.env.IMAGE || '';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const allErrors = [];
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((th) => localStorage.setItem('caos.theme', th), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  if (IMAGE) {
    await page.locator(`.il-thumb[title="${IMAGE}"]`).click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.getByRole('tab', { name: TAB, exact: true }).first().click().catch((e) => errors.push(`click ${TAB}: ${e}`));
  await page.waitForTimeout(800);
  for (const sub of SUBTABS) {
    await page.getByRole('tab', { name: sub, exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${TAB}-${sub}-${theme}.png`, fullPage: true });
  }
  if (errors.length) allErrors.push(...errors.map((e) => `[${theme}] ${e}`));
  await ctx.close();
}
await browser.close();
console.log(allErrors.length ? `CONSOLE/PAGE ERRORS:\n${allErrors.join('\n')}` : 'no console/page errors');
