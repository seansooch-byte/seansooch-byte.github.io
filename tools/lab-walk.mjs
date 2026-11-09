#!/usr/bin/env node
// Walk Lab lessons in a real browser and check what a reader would see (lab/FORMAT.md).
// Never shipped (tools/ is export-ignore). Needs playwright-core and an installed Chrome.
//   node tools/lab-walk.mjs <base> [slug ...]      e.g. node tools/lab-walk.mjs http://localhost:8097 acid-base
// For every lesson, on a wide screen (1280 x 900) and a phone (375 x 553):
//   - no page errors or console errors; the kit reports ready;
//   - every step opens from its address (#step-N) with a picture: one SVG, 480 wide, at most 420 tall;
//   - with its prediction pending, a moving step holds at "before" and hides its caption;
//   - at the end of each picture, no two labels overlap and (on the phone) no label renders under 12 px;
//   - the page never scrolls sideways;
//   - the quiz lists every question, an answer gets its explanation and a link to a real step, and the
//     summary lists the takeaways and at least one term.
// Prints one line per problem; exit 1 if any.
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');

const [base, ...only] = process.argv.slice(2);
if (!base) { console.error('usage: node tools/lab-walk.mjs <base> [slug ...]'); process.exit(2); }
const apps = await (await fetch(`${base}/lab/apps.json`)).json();
const slugs = only.length ? only : apps.map(a => a.slug);
const problems = [];
let checks = 0, controlled = false;
const bad = (where, what) => problems.push(`${where}: ${what}`);
const ok = (cond, where, what) => { checks++; if (!cond) bad(where, what); return cond; };

const browser = await chromium.launch({ channel: 'chrome' });
const SIZES = [{ name: 'wide', width: 1280, height: 900 }, { name: 'phone', width: 375, height: 553, isMobile: true, hasTouch: true }];

async function measure(page, n) {
  return page.evaluate(n => {
    const st = document.querySelector(`[data-step="${n}"][data-step-title]`);
    const svgs = st ? [...st.querySelectorAll('.visual svg')] : [];
    const svg = svgs[0];
    if (!svg) return { svgs: 0 };
    const vb = svg.viewBox.baseVal, scale = svg.getBoundingClientRect().width / vb.width;
    // A label counts only if it can be seen: its opacity, times every group's above it, is above 0.05.
    const seen = t => { let a = 1; for (let n = t; n && n !== svg; n = n.parentElement) { a *= parseFloat(n.getAttribute('opacity') ?? 1) * parseFloat(getComputedStyle(n).opacity); } return a > .05; };
    const texts = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim() && getComputedStyle(t).display !== 'none' && seen(t));
    const boxes = texts.map(t => { const b = t.getBBox(), m = t.getCTM(), r = svg.getCTM().inverse().multiply(m); return { x: b.x + r.e, y: b.y + r.f, w: b.width, h: b.height, s: t.textContent.trim().slice(0, 24) }; });
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 3 && iy > 3 && ix * iy > 0.15 * Math.min(a.w * a.h, b.w * b.h)) overlaps.push(`"${a.s}" / "${b.s}"`);
    }
    const sizes = texts.map(t => parseFloat(getComputedStyle(t).fontSize) * scale);
    return {
      svgs: svgs.length, w: vb.width, h: vb.height, label: svg.getAttribute('aria-label') || '',
      minPx: sizes.length ? Math.min(...sizes) : 99, overlaps,
      player: !!st.querySelector('.lx-player'), anim: st.querySelector('.visual')?.dataset.anim,
      capHidden: !!st.querySelector('.caption')?.hidden, check: !!st.querySelector('.lx-check'),
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    };
  }, n);
}

for (const slug of slugs) {
  const plan = await (await fetch(`${base}/lab/${slug}/plan.json`)).json().catch(() => null);
  if (!ok(plan, slug, 'plan.json does not load')) continue;
  for (const size of SIZES) {
    const where = `${slug} [${size.name}]`;
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/lab/${slug}/`, { waitUntil: 'networkidle' });
    const ready = await page.waitForFunction(() => document.documentElement.dataset.lesson === 'ready', null, { timeout: 15000 }).then(() => true, () => false);
    if (!ok(ready, where, 'the kit never reported ready')) { await ctx.close(); continue; }
    const kinds = await page.$$eval('[data-step][data-step-title]', a => a.map(e => e.dataset.kind));
    // Positive control, once per run: plant an overlapping, too-small label in step 1 and make sure both
    // detectors see it (a detector that cannot fail proves nothing). The page is reloaded after.
    if (!controlled && size.name === 'phone') {
      controlled = true;
      await page.evaluate(() => { location.hash = '#step-1'; });
      await page.waitForTimeout(120);
      await page.evaluate(() => {
        const svg = document.querySelector('[data-step="1"] .visual svg'), t = svg?.querySelector('text');
        if (!t) return;
        const twin = t.cloneNode(true); svg.append(twin);
        const tiny = t.cloneNode(true); tiny.style.fontSize = '9px'; tiny.setAttribute('y', '12'); tiny.textContent = 'planted tiny label'; svg.append(tiny);
      });
      const c = await measure(page, 1);
      ok(c.overlaps.length > 0, 'walk control', 'the overlap detector missed a planted duplicate label');
      ok(c.minPx < 11.9, 'walk control', 'the small-text detector missed a planted 9-unit label');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.lesson === 'ready', null, { timeout: 15000 });
    }
    for (let i = 1; i <= kinds.length; i++) {
      const at = `${where} step ${i} (${kinds[i - 1]})`;
      await page.evaluate(i => { location.hash = `#step-${i}`; }, i);
      await page.waitForTimeout(120);
      let m = await measure(page, i);
      if (!ok(m.svgs === 1, at, `${m.svgs} pictures; expected one SVG`)) continue;
      ok(m.w === 480, at, `picture is ${m.w} wide; expected 480`);
      ok(m.h <= 424, at, `picture is ${m.h} tall; at most 420`);
      ok(m.label.length > 30, at, 'the picture needs an aria-label that says what it shows');
      const kind = kinds[i - 1];
      if (plan.checks?.[kind]) {
        ok(m.player, at, 'a step with a prediction must move (it has no player)');
        ok(m.check && m.capHidden, at, 'with its prediction pending, the caption should be hidden behind the question');
        await page.click(`[data-step="${i}"] .lx-skip`).catch(() => bad(at, 'no Skip button on the prediction'));
      }
      if (m.player) {
        await page.evaluate(i => { const r = document.querySelector(`[data-step="${i}"] .lx-player input`); r.value = 1000; r.dispatchEvent(new Event('input', { bubbles: true })); }, i);
        await page.waitForTimeout(60);
        m = await measure(page, i);
      }
      ok(!m.overlaps.length, at, `labels overlap: ${m.overlaps.slice(0, 3).join(', ')}`);
      if (size.name === 'phone') ok(m.minPx >= 11.9, at, `smallest label renders at ${m.minPx.toFixed(1)} px on a phone; needs 12`);
      ok(m.scrollW <= m.innerW, at, `page scrolls sideways (${m.scrollW} > ${m.innerW})`);
    }
    // Quiz and summary
    await page.click('#tab-quiz');
    const qn = await page.$$eval('#quiz .lx-qs > li', l => l.length);
    ok(qn === plan.quiz.length, where, `quiz shows ${qn} of ${plan.quiz.length} questions`);
    const q = plan.quiz[0];
    await page.locator(`[data-q="${q.id}"] .lx-choices button`, { hasText: q.choices[q.answer] }).first().click();
    const fb = await page.$eval(`[data-q="${q.id}"]`, li => ({ verdict: li.querySelector('.lx-verdict')?.textContent, link: li.querySelector('.lx-review a')?.getAttribute('href') }));
    ok(fb.verdict === 'Right.', where, `answering the first question right shows "${fb.verdict}"`);
    ok(/^#step-\d+$/.test(fb.link || ''), where, 'a quiz answer links back to its step');
    await page.click('#tab-summary');
    const sum = await page.evaluate(() => ({ t: document.querySelectorAll('#summary .lx-takeaways li').length, terms: document.querySelectorAll('#summary .lx-terms dt').length }));
    ok(sum.t === plan.takeaways.length, where, `summary shows ${sum.t} of ${plan.takeaways.length} takeaways`);
    ok(sum.terms > 0, where, 'summary lists no terms');
    for (const tab of ['clinical', 'explore']) {
      await page.click(`#tab-${tab}`);
      await page.waitForTimeout(150);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      ok(sw[0] <= sw[1], where, `${tab} tab scrolls sideways (${sw[0]} > ${sw[1]})`);
    }
    ok(!errors.length, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  process.stdout.write('.');
}
await browser.close();
console.log('');
if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problems, ${checks} checks.`); process.exit(1); }
console.log(`lab-walk: ${slugs.length} lessons, ${checks} checks, all pass.`);
