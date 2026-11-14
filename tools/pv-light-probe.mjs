#!/usr/bin/env node
// Browser probe for lighting a caption term on pressure-volume-loop's hearts (never shipped: tools/ is
// export-ignore). Needs playwright-core and an installed Chrome, like tools/lab-walk.mjs.
//   node tools/pv-light-probe.mjs http://localhost:8097
// For every step, every caption term that lights a part of the heart is lit in turn (pointerenter), and
// in every left heart on that step:
//   - depth is kept: the painted order of the heart's groups is the same as with nothing lit, so every
//     behind-tier group (none in the left heart since round 3, which drops the descending aorta) is still painted before the atrium and the ventricle, and
//     the ventricle still before the atrium and the aortic root (the review found the lit "aorta"
//     pulling the descending limb in front of the atrium, and the lit "ventricle" showing its cut corner);
//   - each lit part is drawn at full strength and every other part of the heart is dimmed;
//   - lighting nothing restores the drawing exactly.
// Positive control: the same checks run against a heart whose lit group was moved to the end by hand
// must fail the order check, or the probe proves nothing.
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');

const base = process.argv[2];
if (!base) { console.error('usage: node tools/pv-light-probe.mjs <base>'); process.exit(2); }
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${base}/lab/pressure-volume-loop/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.lesson === 'ready', null, { timeout: 15000 });

// In the page: a snapshot of one heart's painted order and what is dimmed.
const SNAP = `(heart) => {
  const groups = [...heart.querySelectorAll('[data-part]')];
  const order = groups.map(g => g.getAttribute('data-part') + (g.hasAttribute('data-ax-tier') ? ':' + g.getAttribute('data-ax-tier') : ''));
  const veil = heart.querySelector('[data-ax-veil]'), veilOn = !!veil && parseFloat(veil.getAttribute('opacity') || 0) > 0;
  const after = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  const dimmed = g => !!g.closest('[data-ax-dim]') || (veilOn && !(heart.querySelector('[data-ax-lift]')?.contains(g)) && !!after(g, veil));
  return { order, dim: groups.map(dimmed), lit: groups.map(g => g.classList.contains('is-lit')) };
}`;
const problems = [];
const steps = await page.$$eval('[data-step][data-step-title]', a => a.map(e => e.dataset.step));
let tried = 0;
for (const n of steps) {
  await page.evaluate(n => { location.hash = `#step-${n}`; }, n);
  await page.waitForTimeout(150);
  const terms = await page.$$eval(`[data-step="${n}"] .caption dfn[data-part]`, a => a.map(d => d.dataset.part));
  for (let i = 0; i < terms.length; i++) {
    const res = await page.evaluate(async ([n, i, SNAP]) => {
      const snap = eval(SNAP), st = document.querySelector(`[data-step="${n}"][data-step-title]`);
      const hearts = [...st.querySelectorAll('.visual .ax-left-heart')];
      if (!hearts.length) return null;
      const before = hearts.map(snap);
      const d = st.querySelectorAll('.caption dfn[data-part]')[i];
      d.dispatchEvent(new PointerEvent('pointerenter'));
      await new Promise(r => setTimeout(r, 30));
      const during = hearts.map(snap);
      d.dispatchEvent(new PointerEvent('pointerleave'));
      await new Promise(r => setTimeout(r, 30));
      const afterOff = hearts.map(snap);
      return { before, during, afterOff };
    }, [n, i, SNAP]);
    if (!res) continue;
    tried++;
    res.during.forEach((h, k) => {
      const where = `step ${n} term "${terms[i]}" heart ${k}`;
      const b = res.before[k];
      if (h.order.join() !== b.order.join()) problems.push(`${where}: painted order changed: ${h.order.join(' < ')}`);
      const behindAt = h.order.findIndex(o => o.endsWith(':behind'));
      const front = h.order.map((o, j) => [o, j]).filter(([o]) => /^(atrium|ventricle)/.test(o)).map(([, j]) => j);
      if (behindAt >= 0 && front.some(j => j < behindAt)) problems.push(`${where}: a behind-tier group is painted over the atrium or ventricle`);
      if (!h.lit.some(Boolean)) return;
      h.lit.forEach((on, j) => { if (on === h.dim[j]) problems.push(`${where}: ${h.order[j]} is ${on ? 'lit but dimmed' : 'not lit but not dimmed'}`); });
      if (JSON.stringify(res.afterOff[k].order) !== JSON.stringify(b.order) || res.afterOff[k].dim.some(Boolean)) problems.push(`${where}: lighting nothing does not restore the heart`);
    });
  }
}
// Positive control: move the descending limb's group to the end of its heart by hand.
const control = await page.evaluate(SNAP => {
  const snap = eval(SNAP), h = document.querySelector('.ax-left-heart');
  const g = h.querySelector('[data-ax-tier="behind"]') || h.querySelector('[data-part]');
  const before = snap(h).order.join();
  const ph = document.createComment(''); g.replaceWith(ph); h.appendChild(g);
  const moved = snap(h).order.join();
  ph.replaceWith(g);
  return before !== moved;
}, SNAP);
if (!control) problems.push('positive control: moving a group to the end did not change the painted order the probe reads');
if (!tried) problems.push('no caption term lit any heart');
for (const e of errors) problems.push(`page error: ${e}`);
await browser.close();
for (const p of problems.slice(0, 30)) console.log(p);
console.log(`pv-light-probe: ${tried} terms lit, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
