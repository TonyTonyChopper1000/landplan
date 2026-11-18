// Render-mode screenshots per project type at DPR 2, from the public demo viewers.
// Usage: start `npm run dev -- --port 5199`, then `node scripts/render-shots.mjs [baseUrl]`.
// Uses software WebGL (SwiftShader) when no GPU is present, so Mobile quality is forced
// for speed; on a real GPU pass QUALITY=high.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:5199';
const Q = process.env.QUALITY ?? 'mobile';
const OUT = 'docs/screenshots/render';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const SHOTS = [
  ['aerial-noon', 'light=noon'],
  ['aerial-golden', 'light=golden'],
  ['aerial-night', 'light=night'],
  ['plan-status', 'camera=plan'],
  ['plot-closeup', 'plot=51'],
  ['walk', 'camera=walk'],
];
let failed = 0;
for (const type of (process.env.TYPES ?? 'plots,villas,farm').split(',')) {
  for (const [name, q] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}/view/demo-${type}?quality=${Q}&${q}`);
    const ok = await page.waitForSelector('[data-ready="true"]', { timeout: 180000 }).then(() => true, () => false);
    await page.waitForTimeout(name === 'plot-closeup' ? 12000 : 7000);
    await page.screenshot({ path: `${OUT}/${type}-${name}.png`, timeout: 180000 });
    console.log(`${ok && !errs.length ? 'ok  ' : 'FAIL'} ${type}-${name}${errs.length ? ' ' + errs[0] : ''}`);
    if (!ok || errs.length) failed++;
    await page.close();
  }
  // Mobile, 390 px, filter sheet open.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/view/demo-${type}?quality=mobile`);
  const ok = await page.waitForSelector('[data-ready="true"]', { timeout: 180000 }).then(() => true, () => false);
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${type}-mobile-filter.png`, timeout: 180000 });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${type}-mobile-filter`);
  if (!ok) failed++;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
