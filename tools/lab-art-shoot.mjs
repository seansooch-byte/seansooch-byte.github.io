#!/usr/bin/env node
// Photograph and check the art library's gallery (tools/lab-art-gallery.html) in Chrome. Never shipped.
//   node tools/lab-art-shoot.mjs <base> <outdir> [--only=<cell prefix>] [--no-bench]
// Writes one PNG per gallery figure (<outdir>/<cell>.png, 2x) and prints a JSON report:
//   - checks: every url(#...) resolves inside its own <svg>; no id appears twice on the page; no data-part
//     inside another; no text under 17 units; detail classes hidden at 200 px (ax-d3) and at 300 px or
//     less (ax-d2), shown at 375 and 480 px.
//   - bench: the mounted left heart's set() per call, and a whole frame (set, then layout forced), at
//     normal speed and at 4x CPU throttle.
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [base, out] = args.filter(a => !a.startsWith('--'));
if (!base || !out) { console.error('usage: node tools/lab-art-shoot.mjs <base> <outdir> [--only=prefix] [--no-bench]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/tools/lab-art-gallery.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
const checks = await page.evaluate(() => {
  const bad = [];
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id), seen = new Set(), dup = new Set();
  for (const i of ids) { if (seen.has(i)) dup.add(i); seen.add(i); }
  if (dup.size) bad.push(`duplicate ids: ${[...dup].slice(0, 5).join(', ')}`);
  for (const i of ids) if (/\s/.test(i)) bad.push(`id with a space: "${i}"`);
  for (const svg of document.querySelectorAll('.lx-pic svg')) {
    const cell = svg.closest('[data-cell]')?.dataset.cell;
    const local = new Set([...svg.querySelectorAll('[id]')].map(e => e.id));
    for (const el of svg.querySelectorAll('*')) for (const a of ['fill', 'stroke', 'clip-path', 'filter', 'mask', 'href', 'marker-end']) {
      const v = el.getAttribute(a) || '', m = /url\(#([^)]+)\)/.exec(v) || (a === 'href' && /^#(.+)/.exec(v));
      if (m && !local.has(m[1])) bad.push(`${cell}: ${a} -> #${m[1]} not in its svg`);
    }
    for (const p of svg.querySelectorAll('[data-part] [data-part]')) bad.push(`${cell}: data-part "${p.dataset.part}" nested`);
    for (const t of svg.querySelectorAll('text')) { const fs_ = parseFloat(getComputedStyle(t).fontSize); if (fs_ < 17) bad.push(`${cell}: text "${t.textContent}" at ${fs_}`); }
    const w = svg.parentElement.getBoundingClientRect().width, vis = c => [...svg.querySelectorAll('.' + c)].filter(e => getComputedStyle(e).display !== 'none').length, all = c => svg.querySelectorAll('.' + c).length;
    if (w <= 200 && vis('ax-d3')) bad.push(`${cell}: ax-d3 shown at ${w} px`);
    if (w <= 300 && vis('ax-d2')) bad.push(`${cell}: ax-d2 shown at ${w} px`);
    if (w >= 375 && (vis('ax-d2') < all('ax-d2') || vis('ax-d3') < all('ax-d3'))) bad.push(`${cell}: detail hidden at ${w} px`);
  }
  return { cells: document.querySelectorAll('[data-cell]').length, svgs: document.querySelectorAll('.lx-pic svg').length, problems: bad };
});
const shots = [];
for (const cell of await page.$$eval('[data-cell]', els => els.map(e => e.dataset.cell))) {
  if (flags.only && !cell.startsWith(flags.only)) continue;
  const f = path.join(out, `${cell}.png`);
  await page.locator(`[data-cell="${cell}"] .visual`).screenshot({ path: f });
  shots.push(f);
}
let bench = null;
if (!flags['no-bench']) {
  const cdp = await ctx.newCDPSession(page);
  const run = async rate => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => window.__benchSet(80));
    const set = await page.evaluate(() => window.__benchSet(400));
    const frame = await page.evaluate(() => window.__benchFrame(120));
    return { set, frame };
  };
  bench = { x1: await run(1), x4: await run(4) };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const r = v => +v.toFixed(3);
  for (const k of Object.keys(bench)) for (const kk of ['set', 'frame']) for (const m of Object.keys(bench[k][kk])) bench[k][kk][m] = r(bench[k][kk][m]);
}
console.log(JSON.stringify({ ...checks, shots: shots.length, outdir: out, bench, errors: [...new Set(errors)] }, null, 1));
await browser.close();
process.exit(checks.problems.length || errors.length ? 1 : 0);
