#!/usr/bin/env node
// Capture every step picture of Lab lessons as PNGs, for looking at (never shipped: tools/ is export-ignore).
//   node tools/lab-shoot.mjs <base> <outdir> <slug> [slug ...] [--at=0.3,0.7,1] [--phone] [--steps=1,3]
// For each step: open #step-N, skip any prediction, pause, set the scrubber to each --at point and
// photograph the .visual block at 2x. Files: <outdir>/<slug>/s<NN>-<kind>-t<at>.png. Prints the list.
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [base, out, ...slugs] = args.filter(a => !a.startsWith('--'));
if (!base || !out || !slugs.length) { console.error('usage: node tools/lab-shoot.mjs <base> <outdir> <slug...> [--at=0.3,0.7,1] [--phone]'); process.exit(2); }
const AT = String(flags.at || '0.35,1').split(',').map(Number);
const ONLY = flags.steps ? new Set(String(flags.steps).split(',').map(Number)) : null;
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext(flags.phone ? { viewport: { width: 375, height: 553 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
for (const slug of slugs) {
  fs.mkdirSync(path.join(out, slug), { recursive: true });
  await page.goto(`${base}/lab/${slug}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  const n = await page.evaluate(() => document.querySelectorAll('[data-step][data-step-title]').length);
  for (let i = 1; i <= n; i++) {
    if (ONLY && !ONLY.has(i)) continue;
    await page.goto(`${base}/lab/${slug}/#step-${i}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const sel = `[data-step="${i}"][data-step-title]`;
    const skip = page.locator(`${sel} .lx-skip`);
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(150); }
    const kind = await page.getAttribute(sel, 'data-kind');
    const vis = page.locator(`${sel} .visual`).first();
    const range = page.locator(`${sel} .lx-player input`);
    const moving = await range.count();
    for (const t of moving ? AT : [1]) {
      if (moving) await range.evaluate((r, v) => { r.value = String(Math.round(v * 1000)); r.dispatchEvent(new Event('input', { bubbles: true })); }, t);
      await page.waitForTimeout(120);
      const f = path.join(out, slug, `s${String(i).padStart(2, '0')}-${kind}-t${t}.png`);
      await vis.screenshot({ path: f });
      console.log(f);
    }
  }
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await browser.close();
