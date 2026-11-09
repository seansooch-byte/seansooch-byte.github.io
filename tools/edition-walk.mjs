#!/usr/bin/env node
// Walk the edition's pages in a real browser and check what a reader would meet.
// Never shipped (tools/ is export-ignore). Needs an installed Chrome and playwright-core, looked for in
// ~/aa-main/node_modules (set PLAYWRIGHT_FROM to a node_modules folder that has it to look elsewhere).
//   node tools/edition-walk.mjs <base>        e.g. node tools/edition-walk.mjs http://localhost:8104
//
// On a wide screen (1280 x 900) and two phones at the heights Safari really gives them (393 x 659, 375 x 553):
//   - every page loads with no script error, never scrolls sideways, and every image in view has arrived;
//     every link and button has a name, and no control in the bar or the chips is under 24 px tall;
//   - the home page asks every address and each dot settles; the tally says how many of how many;
//   - a world chip shows that world's works and no others, and a link to a hidden work shows everything again;
//   - "Side by side" gives each work's caption half to its earlier edition's plate, which loads; the way back
//     restores the caption; a work with two kept editions switches between them; the switch counts the works
//     it can move; and a plate that needs a note (made-up patients) still carries it with the caption gone;
//   - "Plain language" swaps both tellings, survives a reload, and switches back;
//   - "Ask them all again" asks again; "Set beside" moves one row and hands the focus to the way back;
//   - "/" or the Index button opens the index, typing filters it, the arrows move the choice, Enter or a click goes
//     to the entry, Escape closes it, and "/" typed in its field is a slash;
//     on every page the index finds a lesson, which it reads from the Lab's ledger and not from the page;
//   - an address with a broken percent sign in it does not stop the page's scripts;
//   - a film opens in its dialog with its own file and lets go of it on close;
//   - the theme buttons set and clear the theme;
//   - a lesson the ledger adds after the build appears in the outline, in the printed index in its alphabetical
//     place and in the searched index, as text; the counts follow; a bad slug, a day that does not exist, a
//     title that is not text and a second copy are dropped; a title that looks like markup stays text;
//   - the Lab's course page draws a reader's progress, the resume card and a mixed review of ten questions;
//   - the paper keeps its four part addresses and its table scrolls inside its own frame on a phone.
// A planted defect (a 2,000 px element) must trip the sideways-scroll check, or the walk itself is broken.
// Prints one line per problem and exits 1 if there is any.
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('usage: node tools/edition-walk.mjs <base>'); process.exit(2); }
const problems = [];
let checks = 0;
const ok = (cond, where, what) => { checks++; if (!cond) problems.push(`${where}: ${what}`); return !!cond; };

const SIZES = [['wide', 1280, 900, false], ['phone', 393, 659, true], ['small phone', 375, 553, true]];
const PAGES = [['home', '/'], ['paper', '/two-stories/'], ['lab', '/lab/'], ['not found', '/404.html']];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function open(size, path, extra = {}) {
  const [name, width, height, mobile] = size;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // A dropped connection is reported by the network layer as a console error; a missing or failing file is caught by its status below.
  page.on('console', m => { if (m.type() === 'error' && m.location().url.startsWith(base) && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400 && !r.url().includes('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors, name };
}
const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const walkDown = page => page.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
  scrollTo(0, 0);
  await Promise.all([...document.images].filter(i => i.offsetParent).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
  return [...document.images].filter(i => i.offsetParent && !i.naturalWidth).map(i => i.getAttribute('src'));
});

// ---------- every page at every size
for (const size of SIZES) {
  for (const [label, path] of PAGES) {
    const { ctx, page, errors, name } = await open(size, path);
    const where = `${label}, ${name}`;
    ok(await page.evaluate(() => document.documentElement.classList.contains('js')), where, 'scripts did not start');
    const broken = await walkDown(page);
    ok(broken.length === 0, where, `images did not load: ${broken.join(', ')}`);
    ok(await sideways(page) <= 0, where, `the page scrolls sideways by ${await sideways(page)} px`);
    ok(await page.locator('h1').count() === 1, where, 'not exactly one h1');
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('a[href], button')]
      .filter(e => e.offsetParent && !e.closest('[aria-hidden=true]') && !(e.textContent.trim() || e.getAttribute('aria-label') || [...e.querySelectorAll('img')].some(i => i.alt)))
      .map(e => e.outerHTML.slice(0, 80)));
    ok(unnamed.length === 0, where, `links or buttons with no name: ${unnamed.slice(0, 3).join(' | ')}`);
    const small = await page.evaluate(() => [...document.querySelectorAll('.topbar a, .topbar button, .chips button, .switch button')]
      .filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 24).length);
    ok(small === 0, where, `${small} controls in the bar or the chips are under 24 px tall`);
    if (label === 'home' && name !== 'wide') {
      // control: the check above must be able to fail
      await page.evaluate(() => { const d = document.createElement('div'); d.id = 'planted'; d.style.cssText = 'width:2000px;height:1px'; document.body.append(d); });
      ok(await sideways(page) > 0, where, 'CONTROL: a planted 2,000 px element did not trip the sideways-scroll check');
      await page.evaluate(() => document.getElementById('planted').remove());
    }
    ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
}

// ---------- the home page's controls, wide and phone
for (const size of [SIZES[0], SIZES[1]]) {
  const { ctx, page, errors, name } = await open(size, '/');
  const where = `home, ${name}`;
  const total = await page.evaluate(() => JSON.parse(document.getElementById('probes').textContent).length);

  // asking
  await page.waitForFunction(() => !document.querySelector('.dot.is-asking'), null, { timeout: 100000 }).catch(() => {});
  const dots = await page.evaluate(() => [...document.querySelectorAll('.dir [data-dot]')].map(d => d.className));
  ok(dots.length === total, where, `the directory has ${dots.length} dots for ${total} addresses`);
  ok(dots.every(c => /is-(yes|no|wake)/.test(c)), where, 'a dot never settled');
  ok(dots.filter(c => c.includes('is-yes')).length >= total - 3, where, `only ${dots.filter(c => c.includes('is-yes')).length} of ${total} addresses answered (is the network up?)`);
  const tally = await page.locator('[data-tally]').innerText();
  ok(new RegExp(`\\d+ of ${total} answered`).test(tally), where, `the tally reads "${tally}"`);
  ok(/^\d+ ms$/.test(await page.locator('.dir [data-ms]').first().innerText()), where, 'a round trip is not printed in the directory');
  ok(/\d/.test(await page.locator('[data-answered]').innerText()), where, 'the record does not say how many answered');
  await page.locator('[data-ask]').first().scrollIntoViewIfNeeded();
  await page.locator('[data-ask]').first().click();
  ok(await page.evaluate(() => document.querySelectorAll('.dir .dot.is-asking').length > 0 || /asking/.test(document.querySelector('[data-tally]').textContent)), where, '"Ask them all again" did not ask again');
  await page.waitForFunction(() => !document.querySelector('.dot.is-asking'), null, { timeout: 100000 }).catch(() => {});
  ok(new RegExp(`\\d+ of ${total} answered`).test(await page.locator('[data-tally]').innerText()), where, `after asking again the tally reads "${await page.locator('[data-tally]').innerText()}"`);

  // worlds
  const visibleWorks = () => page.evaluate(() => [...document.querySelectorAll('article.work')].filter(a => a.offsetParent).map(a => a.id));
  const all = await visibleWorks();
  await page.locator('button[data-filter=mil]').click();
  const mil = await visibleWorks();
  const wantMil = await page.evaluate(() => [...document.querySelectorAll('article.work')].filter(a => a.dataset.worlds.split(' ').includes('mil')).map(a => a.id));
  ok(mil.length && mil.join() === wantMil.join(), where, `Military shows ${mil.join(',') || 'nothing'}, wanted ${wantMil.join(',')}`);
  ok(await page.locator('button[data-filter=mil]').getAttribute('aria-pressed') === 'true', where, 'the chosen chip is not marked pressed');
  ok(await page.evaluate(() => !document.querySelector('.outline').offsetParent), where, 'the Lab outline shows under another world');
  await page.locator('.dir a[href="#edge"]').click();
  await page.waitForTimeout(150);
  ok((await visibleWorks()).length === all.length, where, 'a link to a hidden work did not show everything again');
  ok(await page.evaluate(() => { const r = document.getElementById('edge').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), where, 'the link did not arrive at its work');

  // side by side
  const withPrior = await page.evaluate(() => [...document.querySelectorAll('article.work')].filter(a => a.querySelector('.prior')).map(a => a.id));
  ok(withPrior.length >= 15, where, `only ${withPrior.length} works have an earlier edition to set beside`);
  const said = await page.locator('button[data-view=beside] .n').innerText();
  ok(+said === withPrior.length, where, `the switch says ${said} works go side by side; ${withPrior.length} can`);
  await page.locator('button[data-view=beside]').click();
  const beside = await page.evaluate(() => [...document.querySelectorAll('article.work.is-beside')].map(a => ({ id: a.id, cap: !!a.querySelector('.cap').offsetParent, prior: !!a.querySelector('.prior').offsetParent })));
  ok(beside.length === withPrior.length, where, `${beside.length} of ${withPrior.length} works went side by side`);
  ok(beside.every(b => !b.cap && b.prior), where, 'a caption stayed, or an earlier plate did not show');
  // The caption that says the handoff tracker's patients are made up is the half given away, so the plates say it.
  const noted = await page.evaluate(() => [...document.querySelectorAll('#handoff figcaption')].filter(c => c.offsetParent).map(c => c.textContent));
  ok(noted.length === 2 && noted.every(t => t.includes('Synthetic patients')), where, `side by side, the handoff tracker's plates read: ${noted.join(' | ') || 'nothing'}`);
  await page.locator('#step2').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const i = document.querySelector('#step2 .prior-ed:not([hidden]) img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  ok(await page.evaluate(() => document.querySelector('#step2 .prior-ed:not([hidden]) img').naturalWidth > 0), where, "the earlier edition's plate did not load");
  if (name === 'wide') {
    const tops = await page.evaluate(() => [document.querySelector('#step2 .plate-fig .plate'), document.querySelector('#step2 .prior-ed:not([hidden]) .plate')].map(e => Math.round(e.getBoundingClientRect().top)));
    ok(Math.abs(tops[0] - tops[1]) <= 2, where, `the two plates do not sit level (${tops.join(' and ')})`);
  }
  const eds = page.locator('#agi [data-prior-ed]');
  if (ok(await eds.count() === 2, where, 'the tracker does not offer its two kept editions')) {
    await page.locator('#agi').scrollIntoViewIfNeeded();
    await eds.nth(1).click();
    ok(await page.evaluate(() => [...document.querySelectorAll('#agi .prior-ed')].filter(f => !f.hidden).length === 1 && document.querySelector('#agi [data-prior-ed][aria-pressed=true]').textContent.includes('Edition 2')), where, 'picking the older kept edition did not show it alone');
  }
  await page.locator('#step2 [data-beside-back]').click();
  ok(await page.evaluate(() => { const a = document.getElementById('step2'); return !a.classList.contains('is-beside') && !!a.querySelector('.cap').offsetParent; }), where, 'the way back did not restore the caption');
  ok(await page.locator('button[data-view=beside]').getAttribute('aria-pressed') === 'false', where, 'the switch still says every work is side by side');
  await page.locator('button[data-view=described]').click();
  ok(await page.locator('article.work.is-beside').count() === 0, where, '"Described" left a work side by side');
  // one row at a time, from the row's own button
  await page.locator('#detroit [data-beside]').scrollIntoViewIfNeeded();
  await page.locator('#detroit [data-beside]').click();
  const one = await page.evaluate(() => ({
    beside: [...document.querySelectorAll('article.work.is-beside')].map(a => a.id).join(),
    focus: document.activeElement && document.activeElement.hasAttribute('data-beside-back'),
    expanded: document.querySelector('#detroit [data-beside]').getAttribute('aria-expanded'),
    both: ['described', 'beside'].map(v => document.querySelector(`button[data-view=${v}]`).getAttribute('aria-pressed')).join(),
  }));
  ok(one.beside === 'detroit' && one.expanded === 'true', where, `"Set beside" on one row set these side by side: ${one.beside || 'none'}`);
  ok(one.focus, where, 'after "Set beside" the way back does not have the focus');
  ok(one.both === 'false,false', where, `with one row side by side the switch reads ${one.both}`);
  await page.locator('#detroit [data-beside-back]').click();
  ok(await page.locator('article.work.is-beside').count() === 0 && await page.locator('button[data-view=described]').getAttribute('aria-pressed') === 'true', where, 'the way back from one row did not return the page to "Described"');

  // plain language
  const shown = () => page.evaluate(() => { const p = document.querySelector('#step2 .say'); return { t: !!p.querySelector('.t').offsetParent, p: !!p.querySelector('.p').offsetParent }; });
  ok((await shown()).t && !(await shown()).p, where, 'the technical telling is not the one shown first');
  await page.locator('[data-voice-toggle]').first().click();
  ok(!(await shown()).t && (await shown()).p, where, '"Plain language" did not swap the telling');
  await page.reload({ waitUntil: 'load' });
  ok(!(await shown()).t && (await shown()).p, where, 'plain language was forgotten on reload');
  ok(await page.locator('[data-voice-toggle]').first().getAttribute('aria-pressed') === 'true', where, 'the button does not say plain language is on');
  await page.locator('[data-voice-toggle]').first().click();
  ok((await shown()).t, where, 'the technical telling did not come back');

  // index
  await page.keyboard.press('/');
  ok(await page.evaluate(() => document.getElementById('palette').open), where, '"/" did not open the index');
  await page.keyboard.type('risk');
  const hits = await page.locator('#palette-list li').allInnerTexts();
  ok(hits.some(h => h.includes('The Frontier AI Risk Stack')), where, `"risk" found: ${hits.slice(0, 3).join(' / ')}`);
  await page.keyboard.type('/');
  ok(await page.locator('#palette-q').inputValue() === 'risk/', where, '"/" typed in the index field was not a slash');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.getElementById('palette').open && location.hash === '#the-frontier-ai-risk-stack'), where, 'Enter did not go to the entry');
  await page.locator('[data-palette-open]').first().click();
  ok(await page.evaluate(() => document.getElementById('palette').open && document.activeElement.id === 'palette-q'), where, 'the Index button did not open the index with its field ready');
  await page.keyboard.type('edition');
  const chosen = () => page.evaluate(() => [...document.querySelectorAll('#palette-list li')].findIndex(li => li.getAttribute('aria-selected') === 'true'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  ok(await chosen() === 2, where, `two presses of the down arrow chose entry ${await chosen()}`);
  await page.keyboard.press('ArrowUp');
  ok(await chosen() === 1 && await page.evaluate(() => document.getElementById('palette-q').getAttribute('aria-activedescendant') === 'palette-1'), where, 'the up arrow did not move the choice back, or the field does not say which entry is chosen');
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => !document.getElementById('palette').open), where, 'Escape did not close the index');
  await page.locator('[data-palette-open]').first().click();
  await page.keyboard.type('record');
  const entry = page.locator('#palette-list li', { hasText: 'Counted and measured' });
  await entry.click();
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.getElementById('palette').open && location.hash === '#record'), where, 'a click on an entry did not go to it');

  // films
  await page.locator('[data-film]').first().scrollIntoViewIfNeeded();
  await page.locator('[data-film]').first().click();
  const want = await page.locator('[data-film]').first().getAttribute('data-film');
  ok(await page.evaluate(w => document.getElementById('film-dialog').open && document.querySelector('#film-dialog video').src.endsWith(w), want), where, 'the film did not open with its own file');
  await page.locator('[data-film-close]').click();
  const letGo = () => !document.getElementById('film-dialog').open && !document.querySelector('#film-dialog video').getAttribute('src');
  await page.waitForFunction(letGo, null, { timeout: 3000 }).catch(() => {});   // the dialog's close event is a task later
  ok(await page.evaluate(letGo), where, 'the film was not let go on close');

  // theme
  await page.locator('[data-theme-set=dark]').scrollIntoViewIfNeeded();
  await page.locator('[data-theme-set=dark]').click();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor) === 'rgb(27, 27, 26)', where, 'dark did not darken the ground');
  await page.locator('[data-theme-set=auto]').click();
  ok(await page.evaluate(() => !document.documentElement.hasAttribute('data-theme')), where, '"as your device" left a theme set');
  ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ---------- a ledger that has moved on, and is not to be trusted
{
  const { ctx, page, errors } = await open(SIZES[0], '/404.html');
  const where = 'home, moved ledger';
  const real = await (await fetch(base + '/lab/apps.json')).json();
  const hostile = [...real, 'a string', null,
    { slug: 'a-new-lesson', title: '<img src=x onerror="window.pwned=1">A new lesson', date: '2026-12-01', description: 'x' },
    { slug: 'a-new-lesson', title: 'The same lesson again', date: '2026-12-02' },
    { slug: 'constructor', title: 'Constructor', date: '2026-12-01' },     // a plain slug that is also a name every object has
    { slug: 'zebra-stripes', title: 'Zebra stripes', date: '2026-12-01', description: 'quagga' },
    { slug: '../evil', title: 'Bad slug', date: '2026-12-01' },
    { slug: 'no-date', title: 'No date', date: 'soon' },
    { slug: 'no-such-day', title: 'No such day', date: '2026-02-31' },
    { slug: 'no-title', title: 5, date: '2026-12-01' }];
  const good = ['a-new-lesson', 'constructor', 'zebra-stripes'];
  await page.route('**/lab/apps.json', r => r.fulfill({ json: hostile }));
  await page.goto(base + '/', { waitUntil: 'load' });
  const before = await page.evaluate(async () => {
    const built = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
    return { ix: built.querySelectorAll('a.ix').length, said: +built.querySelector('[data-ix-n]').textContent, unplaced: built.querySelectorAll('[data-lab-new] a').length };
  });
  ok(before.ix === before.said && before.ix > 0, where, `as built, the index prints ${before.ix} entries and says ${before.said}`);
  await page.waitForFunction(() => document.querySelector('[data-lab-new] a[data-lesson="zebra-stripes"]'), null, { timeout: 8000 }).catch(() => {});
  const got = await page.evaluate(() => {
    const key = t => t.toLowerCase().replace(/^(the|a) /, '');
    const groups = [...document.querySelectorAll('.ix-g')];
    return {
      added: [...document.querySelectorAll('[data-lab-new] a')].map(a => [a.getAttribute('href'), a.textContent]),
      img: document.querySelectorAll('[data-lab-new] img, .ix-cols img').length, pwned: !!window.pwned, ns: [...document.querySelectorAll('[data-lab-n]')].map(e => e.textContent),
      shown: !document.querySelector('[data-lab-more]').hidden,
      ix: [...document.querySelectorAll('a.ix')].map(a => [a.getAttribute('href'), a.textContent]),
      ixSaid: +document.querySelector('[data-ix-n]').textContent,
      letters: groups.map(g => g.querySelector('h3').textContent),
      inOrder: groups.every(g => { const k = [...g.querySelectorAll('a.ix')].map(a => key(a.textContent)); return k.every((x, i) => !i || k[i - 1] <= x); }),
      underLetter: groups.every(g => [...g.querySelectorAll('a.ix')].every(a => { const c = key(a.textContent)[0]; return (c.toUpperCase() !== c.toLowerCase() ? c.toUpperCase() : '#') === g.querySelector('h3').textContent; })),
    };
  });
  ok(got.added.some(([h, t]) => h === '/lab/a-new-lesson/' && t.includes('<img')), where, 'a lesson added after the build did not appear as text');
  ok(good.every(g => got.added.filter(([h]) => h === `/lab/${g}/`).length === 1), where, `the outline added ${got.added.map(([h]) => h).join(' ')}; wanted each of ${good.join(', ')} once`);
  ok(got.added.length === before.unplaced + good.length, where, `a bad slug, a day that does not exist, a title that is not text or a second copy was listed: ${got.added.map(([h]) => h).join(' ')}`);
  ok(got.img === 0 && !got.pwned, where, 'a title became markup');
  ok(got.ns.length === 3 && got.ns.every(n => +n === real.length + good.length) && got.shown, where, `the page counts its lessons as ${got.ns.join(', ')}; wanted ${real.length + good.length} in the Lab's row, its outline and the record`);
  ok(good.every(g => got.ix.filter(([h]) => h === `/lab/${g}/`).length === 1), where, 'the printed index did not take each new lesson once');
  ok(got.ix.length === before.ix + good.length && got.ixSaid === got.ix.length, where, `the printed index holds ${got.ix.length} entries and says ${got.ixSaid}; it was built with ${before.ix}`);
  ok(got.inOrder && got.underLetter && got.letters.join() === [...got.letters].sort().join(), where, `the printed index is out of order after the new lessons (letters ${got.letters.join('')})`);
  ok(got.letters.includes('Z'), where, 'CONTROL: no letter had to be added for the new lessons, so adding one was not checked');
  await page.keyboard.press('/');
  await page.keyboard.type('quagga');
  await page.waitForFunction(() => document.querySelectorAll('#palette-list li').length === 1, null, { timeout: 5000 }).catch(() => {});
  const found = await page.locator('#palette-list li').allInnerTexts();
  ok(found.length === 1 && found[0].includes('Zebra stripes (lesson)'), where, `the index, asked for a new lesson by a word of its description, found: ${found.join(' / ') || 'nothing'}`);
  const lessonsFor = async words => { await page.locator('#palette-q').fill(words); return (await page.locator('#palette-list li').allInnerTexts()).filter(t => t.includes('(lesson)')); };
  for (const words of ['constructor', 'new lesson']) ok((await lessonsFor(words)).length === 1, where, `the index, asked for "${words}", found ${(await lessonsFor(words)).length} lessons`);
  for (const words of ['bad slug', 'no date', 'no such day', 'same lesson again']) ok((await lessonsFor(words)).length === 0, where, `the index lists "${words}", which is not a lesson`);
  ok(await page.locator('#palette-list img').count() === 0, where, 'a title became markup in the index');
  ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ---------- the index reads the ledger on every page, and a broken address stops nothing
{
  const lesson = (await (await fetch(base + '/lab/apps.json')).json())[0];
  for (const [label, path] of PAGES) {
    const { ctx, page, errors } = await open(SIZES[0], path);
    const where = `${label}, index`;
    const typed = await page.evaluate(() => JSON.parse(document.getElementById('index-data').textContent).filter(e => /^\/lab\/[^/]+\/$/.test(e.h)).length);
    ok(typed === 0, where, `${typed} lessons are typed into the page's index, so a new lesson would leave the page stale`);
    await page.keyboard.press('/');
    await page.keyboard.type(lesson.title);
    await page.waitForFunction(() => [...document.querySelectorAll('#palette-list li')].some(li => li.textContent.includes('(lesson)')), null, { timeout: 5000 }).catch(() => {});
    const hits = await page.locator('#palette-list li').allInnerTexts();
    ok(hits.some(h => h.includes(`${lesson.title} (lesson)`)), where, `asked for "${lesson.title}", the index found: ${hits.slice(0, 3).join(' / ') || 'nothing'}`);
    if (label === 'paper') {
      await page.keyboard.press('Enter');
      await page.waitForURL(`**/lab/${lesson.slug}/`, { timeout: 8000 }).catch(() => {});
      ok(new URL(page.url()).pathname === `/lab/${lesson.slug}/`, where, `Enter on a lesson went to ${page.url()}`);
    } else {
      ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
    }
    await ctx.close();
  }
  const { ctx, page, errors } = await open(SIZES[0], '/#%E0%A4%A');
  await page.locator('button[data-filter=mil]').click();
  ok(await page.locator('button[data-filter=mil]').getAttribute('aria-pressed') === 'true' && errors.length === 0, 'home, broken address', `an address with a broken percent sign stopped the page: ${errors.slice(0, 2).join(' | ') || 'the chips do not answer'}`);
  await ctx.close();
}

// ---------- the Lab's course page: progress, resume, review
for (const size of [SIZES[0], SIZES[2]]) {
  const { ctx, page, errors, name } = await open(size, '/404.html');
  const where = `lab, ${name}`;
  const first = await page.evaluate(async () => (await (await fetch('/lab/apps.json')).json())[0].slug);
  await page.evaluate(slug => localStorage.setItem('lab-progress-v1', JSON.stringify({ v: 1, lessons: { [slug]: { step: 2, seen: [0, 1, 2], checks: {}, quiz: {}, at: Date.now() } } })), first);
  await page.goto(base + '/lab/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-lab-resume] .card'), null, { timeout: 8000 }).catch(() => {});
  const row = page.locator(`.lesson[data-slug="${first}"]`);
  ok(/^Step 3 of \d+/.test(await row.locator('.state').innerText()), where, `a started lesson reads "${await row.locator('.state').innerText()}"`);
  ok(await row.evaluate(r => parseFloat(r.querySelector('.bar i').style.width) > 0 && r.querySelector('.bar i').getBoundingClientRect().width > 0), where, 'its progress bar did not fill');
  ok(await page.evaluate(s => document.querySelector(`[data-lab-dot="${s}"]`).classList.contains('is-started'), first), where, 'its dot on the course map is not half filled');
  ok((await page.locator('[data-lab-resume] .label').innerText()).includes('Pick up'), where, 'the resume card does not offer the lesson in progress');
  ok((await page.locator('[data-lab-resume] .go').getAttribute('href')).endsWith('#step-3'), where, 'the resume card does not open at the step left');
  const rows = await page.locator('.lesson[data-slug]').count();
  ok(rows === (await (await fetch(base + '/lab/apps.json')).json()).length, where, `${rows} lesson rows`);
  await page.locator('[data-lab-review-start]').scrollIntoViewIfNeeded();
  await page.locator('[data-lab-review-start]').click();
  await page.waitForFunction(() => document.querySelectorAll('.rv-qs > li').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(await page.locator('.rv-qs > li').count() === 10, where, `the mixed review drew ${await page.locator('.rv-qs > li').count()} questions`);
  await page.locator('.rv-qs > li').first().locator('.lx-choices button').first().click();
  ok(await page.locator('.rv-qs > li').first().locator('.rv-verdict').count() === 1, where, 'an answer got no verdict');
  ok(await page.locator('.rv-qs > li').first().locator('.rv-link a').count() === 1, where, 'an answer got no link back to its step');
  ok(await sideways(page) <= 0, where, 'the review makes the page scroll sideways');
  ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ---------- the paper
for (const size of [SIZES[0], SIZES[2]]) {
  const { ctx, page, errors, name } = await open(size, '/two-stories/#table43');
  const where = `paper, ${name}`;
  ok(await page.evaluate(() => ['part1', 'table43', 'part2', 'sources'].every(id => document.getElementById(id))), where, 'a part address is missing');
  ok(await page.locator('.para').count() === 31, where, `${await page.locator('.para').count()} paragraphs`);
  ok(await page.locator('table.two tbody tr').count() === 11, where, 'the comparison does not have eleven rows');
  if (name !== 'wide') ok(await page.evaluate(() => { const w = document.querySelector('#table43 .table-wrap'); return w.scrollWidth > w.clientWidth; }), where, 'the table does not scroll inside its own frame');
  ok(await sideways(page) <= 0, where, 'the page scrolls sideways');
  ok(await page.evaluate(() => { const r = document.getElementById('table43').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), where, 'the address #table43 did not land below the bar');
  ok(errors.length === 0, where, `errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

await browser.close();
for (const p of problems) console.log(p);
console.log(`${checks} checks, ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
process.exit(problems.length ? 1 : 0);
