import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4195';
const OUT = process.env.OUT || 'E:/_Temp/imglab-shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errs = [];
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((th) => localStorage.setItem('caos.theme', th), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errs.push(`[${theme}] ${m.text()}`));
  page.on('pageerror', (e) => errs.push(`[${theme}] ${e}`));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  // open the architecture modal: try common selectors
  const opener = page.locator('button[aria-label*="rchitecture"], button[title*="rchitecture"], button[aria-label*="How it works"]').first();
  await opener.click().catch(async () => {
    // fallback: the info icon button in the header
    await page.locator('header button').filter({ hasText: '' }).nth(0).click().catch(() => {});
  });
  await page.waitForTimeout(600);
  const tabNames = ['The thesis', 'Offline bake', 'Live in the browser', 'Deploy'];
  for (const name of tabNames) {
    await page.getByRole('tab', { name, exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/arch-${name.replace(/\s+/g,'_')}-${theme}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console/page errors');
