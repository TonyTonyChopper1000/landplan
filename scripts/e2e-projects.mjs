// Landing → new project wizard → generate → overview dashboard → projects list. Run against `vite preview`.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOTS ?? 'shots';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);

const browser = await chromium.launch();
for (const [w, h, tag] of [
  [1440, 900, 'w1440'],
  [390, 844, 'w390'],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${tag}-landing.png` });
  await page.screenshot({ path: `${OUT}/${tag}-landing-full.png`, fullPage: true });
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
ok('Landing shows hero', await page.getByRole('heading', { name: /Plot the/ }).isVisible());
await page.getByRole('link', { name: /Start a project/ }).first().click();
await page.waitForTimeout(500);
ok('Start → wizard', page.url().endsWith('/projects/new'));
await page.getByRole('button', { name: /Gated villa community/ }).click();
await page.screenshot({ path: `${OUT}/wizard-type.png` });
await page.getByRole('button', { name: /Continue/ }).click();
await page.getByPlaceholder(/Shamshabad Greens/).fill('Kokapet Villas');
await page.getByPlaceholder(/Shamshabad, Rangareddy/).fill('Kokapet, Rangareddy');
await page.getByPlaceholder(/112\/A/).fill('241, 242/A');
await page.screenshot({ path: `${OUT}/wizard-site.png` });
await page.getByRole('button', { name: /Continue/ }).click();
await page.screenshot({ path: `${OUT}/wizard-plan.png` });
await page.getByRole('button', { name: /Continue/ }).click();
await page.getByRole('button', { name: /Generate layout/ }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/wizard-generating.png` });
await page.waitForURL(/\/projects\/prj_/, { timeout: 30000 });
await page.waitForTimeout(1500);
ok('Generate → project dashboard', /\/projects\/prj_/.test(page.url()));
ok('Overview shows villa details', await page.getByText('Gated villa community details').isVisible());
ok('Villa stats present', await page.getByText('Total built-up').isVisible());
await page.screenshot({ path: `${OUT}/overview-villas.png` });
await page.screenshot({ path: `${OUT}/overview-villas-full.png`, fullPage: true });
const projectUrl = page.url();
await page.getByRole('tab', { name: /^Studio/ }).click();
await page.waitForTimeout(800);
await page.getByRole('spinbutton', { name: 'Floor height' }).count();
await page.getByRole('link', { name: 'All projects' }).click();
await page.waitForTimeout(1200);
ok('Projects list shows the new project', await page.getByText('Kokapet Villas').first().isVisible());
await page.screenshot({ path: `${OUT}/projects.png` });
await page.goto(projectUrl);
await page.waitForTimeout(1500);
ok('Reopening restores the project', await page.getByText('Gated villa community details').isVisible());

// Farm project
await page.goto(`${BASE}/projects/new?type=farm`);
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Continue/ }).click();
await page.getByPlaceholder(/Shamshabad Greens/).fill('Chevella Farms');
await page.getByRole('button', { name: /Continue/ }).click();
await page.getByRole('button', { name: /Continue/ }).click();
await page.getByRole('button', { name: /Generate layout/ }).click();
await page.waitForURL(/\/projects\/prj_/, { timeout: 30000 });
await page.waitForTimeout(1500);
ok('Farm overview', await page.getByText('Farm plots details').isVisible());
ok('Farm price per acre', await page.getByText('Price per acre').isVisible());
await page.screenshot({ path: `${OUT}/overview-farm.png` });
await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
if (results.some((r) => r.startsWith('FAIL')) || errors.length) process.exitCode = 1;
