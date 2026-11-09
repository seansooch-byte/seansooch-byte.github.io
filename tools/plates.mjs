#!/usr/bin/env node
// Capture the plates: every work as it looks today, every kept edition, every volume and view.
// Never shipped (tools/ is export-ignore). Needs an installed Chrome, cwebp on the PATH, and playwright-core, which
// is looked for in ~/aa-main/node_modules (set PLAYWRIGHT_FROM to a node_modules folder that has it to look elsewhere).
//
//   node tools/plates.mjs                      capture everything that has no plate yet
//   node tools/plates.mjs --all                capture everything again
//   node tools/plates.mjs step2 agi-e3 vol4    capture just these (names as in plates/manifest.json)
//   node tools/plates.mjs --base http://localhost:8104   where this edition's own pages are served (for vol4)
//
// Expected behaviour:
//   - The list of plates comes from content/record.json: a work is <id>, its kept editions are <id>-e<n>,
//     a volume is vol<n>, a view of Vol. 03 is vol3-<siglum>. A work with "plate": false gets none (the page
//     sets its name in type instead). "plate_url" overrides the address to capture (a path is served from
//     --base), "plate_scroll" brings an element to the top first, "plate_click" presses one (an intro's skip).
//   - A retired volume and its views are captured from its archive, never from the live site, which by then
//     shows a later edition. Until the archive is deployed those captures fail, which is the right answer.
//   - "plate_note" on a work is drawn across the foot of every plate of that work, so the picture says it
//     wherever it travels without its caption (the handoff tracker's patients are made up, and its plate says so).
//   - Only an https address or one of this edition's own pages under --base is ever opened, and a plate's name
//     is plain lowercase words: the record is edited by pull request, and a capture of file:// would ship.
//   - Each capture is one desktop screen, 1440 by 900 at 1x, light scheme, reduced motion, taken after the
//     network settles and a pause; a host that has to wake is given ninety seconds to stop showing its
//     host's waiting page.
//   - Each plate is written twice as WebP (1440 and 720 wide) and entered in plates/manifest.json with its
//     address and the day it was taken. tools/build.py only uses plates the manifest lists.
//   - "card" is the share image: this edition's front page at 1200 by 630, written once as plates/card.jpg.
//   - A capture that fails is reported and skipped; the others still land. Exit 1 if any failed.
import { createRequire } from 'module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');

const root = new URL('..', import.meta.url).pathname;
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : null; };
const base = opt('base') || 'http://localhost:8104';
const only = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const all = argv.includes('--all');
const record = JSON.parse(fs.readFileSync(root + 'content/record.json', 'utf8'));
const manifestPath = root + 'plates/manifest.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const today = new Date().toISOString().slice(0, 10);

const targets = [];
const at = u => (u.startsWith('/') ? base + u : u);   // a path is one of this edition's own pages
for (const w of record.works) {
  if (w.plate !== false) targets.push({ name: w.id, url: at(w.plate_url || w.url), wake: w.wake, scroll: w.plate_scroll, note: w.plate_note });
  for (const e of w.editions || []) if (!e.current && e.url) targets.push({ name: `${w.id}-e${e.n}`, url: e.url, note: w.plate_note });
}
for (const v of record.volumes) {
  const n = String(parseInt(v.vol.match(/\d+/)[0], 10));
  if (v.status === 'retired' && !v.views) targets.push({ name: `vol${n}`, url: v.href, click: v.plate_click });
  for (const view of v.views || []) targets.push({ name: `vol${n}-${view.siglum.toLowerCase()}`, url: v.href + view.path });
  if (v.status === 'current') targets.push({ name: `vol${n}`, url: base + '/' });
}

// The share card: this edition's own front page at the size a link preview shows, as a JPEG (what previews read).
targets.push({ name: 'card', url: base + '/', card: true });

const want = targets.filter(t => only.length ? only.includes(t.name) : all || !manifest[t.name]);
if (!want.length) { console.log('plates: nothing to capture'); process.exit(0); }

fs.mkdirSync(root + 'plates', { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plates-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// Some public feeds refuse a browser that says it is headless, and a page then shows "feed unavailable".
// The plate should show what a reader's browser shows, so the capture names itself as the ordinary Chrome it is.
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split('.')[0]}.0.0.0 Safari/537.36`;
const failed = [];
const allowed = u => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/|$)/.test(u) || u.startsWith(base + '/');
for (const t of want) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.name) || !allowed(t.url)) {
    failed.push(t.name);
    console.error(`REFUSED ${t.name}  ${t.url}  (a plate is a plain name, taken from https or from --base)`);
    continue;
  }
  const size = t.card ? { width: 1200, height: 630 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', userAgent });
  const page = await ctx.newPage();
  try {
    await page.goto(t.url, { waitUntil: 'load', timeout: 100000 });
    // An address can answer by sending the browser somewhere else: where it ended up is held to the same rule.
    if (!allowed(page.url())) throw new Error(`it led to ${page.url()}, which is not https or under --base`);
    if (t.wake) {
      // A free-tier host answers with its own waiting page until the app is up.
      await page.waitForFunction(() => !/waking up|application loading|welcome to render/i.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    if (t.click) await page.locator(t.click).click({ timeout: 5000 }).catch(() => {});
    if (t.scroll) await page.locator(t.scroll).first().evaluate(el => el.scrollIntoView({ block: 'start' })).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForTimeout(2500);
    if (t.note) {
      await page.evaluate(text => {
        const band = document.createElement('div');
        band.textContent = text;
        band.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0;padding:10px 16px;background:#0c0c0c;color:#fff;'
          + 'font:600 15px/1.3 ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:.04em;text-align:center';
        document.documentElement.append(band);
      }, t.note);
    }
    if (t.card) {
      await page.screenshot({ path: `${root}plates/card.jpg`, type: 'jpeg', quality: 88 });
      manifest.card = { w: 1200, h: 630, url: t.url, taken: today };
      console.log(`plate card  ${t.url}`);
      await ctx.close();
      continue;
    }
    const png = path.join(tmp, t.name + '.png');
    await page.screenshot({ path: png });
    execFileSync('cwebp', ['-quiet', '-q', '80', '-m', '6', '-sharp_yuv', png, '-o', `${root}plates/${t.name}.webp`]);
    execFileSync('cwebp', ['-quiet', '-q', '80', '-m', '6', '-sharp_yuv', '-resize', '720', '0', png, '-o', `${root}plates/${t.name}-720.webp`]);
    manifest[t.name] = { w: 1440, h: 900, url: t.url, taken: today };
    console.log(`plate ${t.name}  ${t.url}`);
  } catch (e) {
    failed.push(t.name);
    console.error(`FAILED ${t.name}  ${t.url}  ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
console.log(`plates: ${want.length - failed.length} captured, ${failed.length} failed, ${Object.keys(manifest).length} in the manifest`);
process.exit(failed.length ? 1 : 0);
