// Playwright smoke + screenshots of every screen at 1440 px and 390 px.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/screenshots.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const OUT = process.env.SHOTS ?? 'shots';
mkdirSync(OUT, { recursive: true });
const TABS = ['Studio', '3D', 'Schedule', 'Feasibility', 'Financials', 'Regulations', 'Compare'];
const errors = [];

async function run(width, height, tag) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  await page.goto(URL);
  await page.waitForTimeout(1200);
  for (const t of TABS) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${t}`) });
    await tab.click();
    await page.waitForTimeout(t === '3D' ? 3500 : 700);
    await page.screenshot({ path: `${OUT}/${tag}-${t.toLowerCase()}.png` });
  }
  await browser.close();
}

await run(1440, 900, 'w1440');
await run(390, 844, 'w390');
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log('ok');
