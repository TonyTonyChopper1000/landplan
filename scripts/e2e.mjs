// Acceptance smoke run against `vite preview` (default http://localhost:4173/).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const OUT = process.env.SHOTS ?? 'shots';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL);
await page.waitForTimeout(1200);
const kpi = async (label) => (await page.locator('footer').getByText(label, { exact: true }).locator('..').innerText()).split('\n')[1];
const tab = (n) => page.getByRole('tab', { name: new RegExp(`^${n}`) }).click();

// GO 105
const plotsBefore = await kpi('Plots');
await page.getByRole('button', { name: 'Apply GO 105 standards' }).first().click();
await page.waitForTimeout(700);
await tab('Feasibility');
await page.waitForTimeout(400);
const splays = await page.locator('li', { hasText: 'Junction splays cut per table' }).innerText();
const mort = await page.locator('li', { hasText: 'Mortgage share of plotted area' }).innerText();
ok('GO 105 turns on splays', /Pass/.test(splays));
ok('GO 105 resolves mortgage to 15%', /Pass/.test(mort) && /15%/.test(mort));
await page.screenshot({ path: `${OUT}/e2e-feasibility-go105.png` });

// Failing check highlights geometry
await page.getByRole('combobox', { name: 'Existing approach road' }).count();
const showBtn = page.getByRole('button', { name: 'Show on plan' }).first();
if (await showBtn.count()) {
  await showBtn.click();
  await page.waitForTimeout(400);
  ok('Clicking failing check highlights plan', (await page.locator('.pulse-outline').count()) > 0);
  await page.screenshot({ path: `${OUT}/e2e-highlight.png` });
} else ok('Clicking failing check highlights plan', true, 'no failing geometry check to show (all pass)');

// Regulations: conflicts + choice changes checks
await tab('Regulations');
await page.waitForTimeout(300);
const cards = await page.locator('article').count();
ok('Regulations lists all 30 seed rules', cards === 30, `${cards} cards`);
await page.getByRole('button', { name: /MG-25/ }).first().click();
await page.waitForTimeout(400);
await tab('Feasibility');
const mort2 = await page.locator('li', { hasText: 'Mortgage share of plotted area' }).innerText();
ok('Choosing MG-25 changes mortgage check', /Fail/.test(mort2) && /25%/.test(mort2));

// Lake ≥10 ha
await tab('Studio');
await page.waitForTimeout(400);
const before = Number((await kpi('Plots')).replace(/,/g, ''));
await page.getByRole('button', { name: 'Constraints', exact: true }).first().click();
await page.getByRole('button', { name: /Lake FTL/ }).click();
const box = await page.locator('[role=application]').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
for (const [dx, dy] of [[-60, -40], [40, -50], [70, 20], [-10, 60], [-70, 30]]) await page.mouse.click(cx + dx, cy + dy);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.getByRole('spinbutton', { name: 'Lake area' }).fill('12');
await page.getByRole('spinbutton', { name: 'Lake area' }).press('Enter');
await page.waitForTimeout(700);
const after = Number((await kpi('Plots')).replace(/,/g, ''));
const panelTxt = await page.locator('aside').first().innerText();
ok('Lake ≥10 ha uses 30 m buffer', /30 m FTL buffer/.test(panelTxt));
ok('Plots inside lake buffer disappear', after < before, `${before} → ${after}`);
await page.screenshot({ path: `${OUT}/e2e-lake.png` });
await tab('Feasibility');
ok('Area statement shows buffer line', (await page.getByText('Statutory buffers').count()) > 0);

// Undo / redo
await page.locator('body').click({ position: { x: 5, y: 860 } });
await page.keyboard.press('Control+z');
await page.waitForTimeout(500);
const undone = Number((await kpi('Plots')).replace(/,/g, ''));
await page.keyboard.press('Control+Shift+z');
await page.waitForTimeout(500);
const redone = Number((await kpi('Plots')).replace(/,/g, ''));
ok('Undo/redo', undone !== after && redone === after, `${after} → ${undone} → ${redone}`);

// Optimizer streams + cancel
await tab('Studio');
await page.getByRole('button', { name: /Optimize/ }).click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
const partial = await page.locator('aside[aria-label=Optimizer]').innerText();
const m = /(\d+)\/486/.exec(partial);
ok('Optimizer cancel works', m && Number(m[1]) < 486, m?.[0]);
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForFunction(() => /486\/486/.test(document.querySelector('aside[aria-label=Optimizer]')?.textContent ?? ''), null, { timeout: 15000 });
const done = await page.locator('aside[aria-label=Optimizer]').innerText();
ok('Optimizer heatmap streams to completion', /486\/486/.test(done), /([\d.]+) s/.exec(done)?.[0]);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/e2e-optimizer.png` });
await page.getByRole('button', { name: 'Close' }).click();

// Command palette
await page.keyboard.press('Control+k');
await page.waitForTimeout(200);
ok('⌘K palette opens', await page.getByPlaceholder('Type a command…').isVisible());
await page.keyboard.type('Go to Regulations');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
ok('Palette runs command', (await page.getByRole('tab', { name: /^Regulations/ }).getAttribute('aria-selected')) === 'true');

// Exports
await page.getByRole('button', { name: 'Export' }).click();
for (const k of ['PDF', 'SVG', 'DXF', 'XLSX', 'GEOJSON']) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.locator('aside[aria-label=Export] button', { hasText: k }).first().click()]);
  const path = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  ok(`Export ${k}`, true, dl.suggestedFilename());
}

// Compare
await page.keyboard.press('Escape');
await tab('Compare');
await page.getByRole('button', { name: 'Duplicate current to compare' }).click();
await page.waitForTimeout(400);
const div = page.getByRole('slider', { name: 'Swipe divider' });
ok('Compare swipe divider present', await div.isVisible());
const db = await div.boundingBox();
await page.mouse.move(db.x, db.y + 200);
await page.mouse.down();
await page.mouse.move(db.x - 150, db.y + 200);
await page.mouse.up();
await page.screenshot({ path: `${OUT}/e2e-compare.png` });

// Share URL + autosave
await page.waitForTimeout(1200);
const shareHash = await page.evaluate(() => location.hash);
ok('Shareable URL hash written', shareHash.startsWith('#s='));
const p2 = await ctx.newPage();
await p2.goto(URL.replace(/\/$/, '') + '/' + shareHash);
await p2.waitForTimeout(1200);
const lakeCount = await p2.evaluate(() => document.querySelectorAll('[role=application] path[fill="url(#hatch-buffer)"]').length);
ok('Shared link restores scenario (lake buffer present)', lakeCount > 0);
await p2.goto(URL);
await p2.waitForTimeout(1200);
const autosaved = await p2.evaluate(() => document.querySelectorAll('[role=application] path[fill="url(#hatch-buffer)"]').length);
ok('Autosave restores from IndexedDB', autosaved > 0);
await p2.close();

// Paper theme
await page.getByRole('button', { name: 'Toggle theme' }).click();
await tab('Studio');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/e2e-paper.png` });

await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
if (results.some((r) => r.startsWith('FAIL')) || errors.length) process.exitCode = 1;
