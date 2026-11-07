// The lesson's runtime: tabs, steps, the step rail, the picture player, predictions and progress.
// It follows the Lab kit (/lab/kit/kit.js, lab/FORMAT.md) with two differences this lesson needs:
//   - it is a classic script that loads its data with a same-origin fetch, or, opened straight from a
//     file (where browsers block modules and fetch), from the copies in ./data/, so it works both ways;
//   - a prediction can never be skipped or carried over: every time a "What changes it" step opens,
//     and every time its change is replayed, the picture holds on "before" until the reader answers.
// Progress (step, steps seen, quiz answers) is kept in this browser only, in the kit's format.
(() => {
const A = window.ADH;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { esc, clamp } = A.draw;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAD_IN = 700, PLAY = '▶︎', PAUSE = '❚❚', MARKS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* ---------- Data: fetch when served, the ./data/ copies when opened from a file ---------- */
const fromFile = location.protocol === 'file:';
function script(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.append(s); });
}
A.loadData = async name => {
  if (fromFile) { await script(`data/${name}.js`); const d = window.ADH_DATA?.[name]; if (!d) throw new Error(name); return JSON.parse(JSON.stringify(d)); }
  const r = await fetch(`./${name}.json`);
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
};

/* ---------- Progress, in the kit's format (storage may be missing or blocked) ---------- */
const KEY = 'lab-progress-v1';
let memory = { v: 1, lessons: {} };
function readAll() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const all = JSON.parse(raw); if (all && all.v === 1 && all.lessons && typeof all.lessons === 'object') memory = all; } } catch { /* blocked: keep memory */ }
  return memory;
}
const blank = () => ({ step: 0, seen: [], checks: {}, quiz: {}, at: 0 });
let slug = 'adh-water-balance';
const record = () => ({ ...blank(), ...(readAll().lessons[slug] || {}) });
function update(change) {
  const all = readAll(), l = record();
  change(l); l.at = Date.now(); all.lessons[slug] = l; memory = all;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* not kept: fine */ }
}

/* ---------- Choices in a stable shuffled order (as the kit's quiz.js) ---------- */
function order(n, seed) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function choiceList(id, choices, picked, answer, onPick) {
  const ul = document.createElement('ul');
  ul.className = 'lx-choices';
  order(choices.length, id).forEach((orig, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.mark = MARKS[i]; b.dataset.choice = String(orig); b.textContent = choices[orig];
    if (picked !== undefined && picked !== null) {
      b.disabled = true;
      // answer null: the sources give no direction, so the pick is shown but not graded.
      b.classList.add(answer === null ? (orig === picked ? 'is-picked' : 'is-dim') : orig === answer ? 'is-right' : orig === picked ? 'is-wrong' : 'is-dim');
    } else b.addEventListener('click', () => onPick(orig));
    li.append(b); ul.append(li);
  });
  return ul;
}
A.choiceList = choiceList;

function lesson(cfg) {
  const scenes = cfg.scenes || {};
  const main = $('main');
  slug = main.dataset.slug;
  const panel = $('#lesson');
  const steps = $$('[data-step][data-step-title]', panel);
  const tabs = $$('.tabs [role=tab]');
  const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
  let plan = null, current = 0, started = false, raf = 0, last = 0, lit = null;
  const state = new Map();           // step -> { t, playing, slow, done, hold, answer }
  const st = el => { if (!state.has(el)) state.set(el, { t: 1, playing: false, slow: false, done: false, hold: 0, answer: undefined }); return state.get(el); };
  const kindOf = el => el.dataset.kind;
  const sceneOf = el => scenes[kindOf(el)] || null;
  const moving = el => (sceneOf(el)?.duration || 0) > 0;
  const checkOf = el => plan?.checks?.[kindOf(el)] || null;
  const pending = el => !!checkOf(el) && st(el).answer === undefined;
  const visualOf = el => $('[data-visual]', el);
  const stageOf = el => ($('.eyebrow', el)?.textContent || '').trim();

  /* ---------- Pictures ---------- */
  function paint(el) {
    const sc = sceneOf(el), v = visualOf(el);
    if (!sc || !v) return;
    let host = $(':scope > .lx-pic', v);
    if (!host) { host = document.createElement('div'); host.className = 'lx-pic'; v.prepend(host); }
    try { host.innerHTML = sc.render(moving(el) ? st(el).t : 1); } catch (err) { console.error(`scene ${kindOf(el)}:`, err); return; }
    v.dataset.anim = moving(el) ? (st(el).done ? 'done' : 'running') : 'still';
    relight(el);
  }
  function playerOf(el) {
    const v = visualOf(el);
    let p = $(':scope > .lx-player', v);
    if (p || !moving(el)) return p;
    p = document.createElement('div');
    p.className = 'lx-player'; p.setAttribute('role', 'group'); p.setAttribute('aria-label', 'Picture controls');
    p.innerHTML = `<button type="button" data-lx-play aria-label="Pause">${PAUSE}</button>`
      + '<button type="button" data-lx-step aria-label="Step forward">▸|</button>'
      + '<input type="range" min="0" max="1000" step="1" value="0" aria-label="Move through the picture">'
      + '<span class="lx-when" aria-hidden="true"></span>'
      + '<button type="button" data-lx-slow aria-pressed="false" aria-label="Half speed">½×</button>'
      + '<button type="button" data-lx-replay aria-label="Replay from the start">↻</button>';
    v.append(p);
    const s = st(el), sc = sceneOf(el);
    $('[data-lx-play]', p).addEventListener('click', () => { if (s.playing) pause(el); else { if (s.t >= 1 && !sc.loop) s.t = 0; play(el); } });
    $('[data-lx-step]', p).addEventListener('click', () => { pause(el); s.t = clamp(Math.floor(s.t * 10 + 1e-6) / 10 + .1, 0, 1); s.hold = 0; paint(el); sync(el); });
    // Replaying a change, by the Replay button or by dragging back into it once it has played,
    // asks for the prediction again before anything moves.
    const askAgain = () => { pause(el); s.answer = undefined; s.t = 0; s.hold = 0; s.done = false; renderCheck(el); paint(el); sync(el); $('.lx-check button', el)?.focus(); };
    const changeEnd = () => sc.loopFrom || 1;
    $('input', p).addEventListener('input', e => {
      const t = e.target.value / 1000;
      if (checkOf(el) && s.done && t < changeEnd()) { askAgain(); return; }
      pause(el); s.t = t; s.hold = 0;
      if (t >= changeEnd()) s.done = true;
      paint(el); sync(el);
    });
    $('[data-lx-slow]', p).addEventListener('click', e => { s.slow = !s.slow; e.currentTarget.setAttribute('aria-pressed', String(s.slow)); });
    $('[data-lx-replay]', p).addEventListener('click', () => {
      if (checkOf(el)) { askAgain(); return; }
      s.t = 0; s.hold = sc.loop ? 0 : LEAD_IN; play(el);
    });
    return p;
  }
  function sync(el) {
    const p = playerOf(el);
    if (!p) return;
    const s = st(el), sc = sceneOf(el), off = pending(el);
    const btn = $('[data-lx-play]', p), range = $('input', p);
    btn.textContent = s.playing ? PAUSE : PLAY;
    btn.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    range.value = String(Math.round(s.t * 1000));
    const named = sc.stages && [...sc.stages].reverse().find(([from]) => s.t >= from);
    const words = named ? named[1]
      : sc.loopFrom ? (s.t <= 0 ? 'before' : s.t < sc.loopFrom ? 'changing' : 'after')
      : sc.loop ? `${Math.round(s.t * 100)}% of the cycle` : s.t <= 0 ? 'before' : s.t >= 1 ? 'after' : `${Math.round(s.t * 100)}%`;
    range.setAttribute('aria-valuetext', words);
    $('.lx-when', p).textContent = words;
    for (const c of $$('button, input', p)) if (!c.matches('[data-lx-replay]')) c.disabled = off;
    $('[data-lx-replay]', p).disabled = off;
  }
  // Every way of starting a picture comes through here: with reduced motion it shows the finished
  // state (and its callout) at once, and nothing moves.
  function play(el) {
    const s = st(el);
    if (reducedMotion()) { cancelAnimationFrame(raf); s.playing = false; s.hold = 0; s.t = sceneOf(el)?.rest ?? 1; s.done = true; paint(el); sync(el); return; }
    s.playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); sync(el);
  }
  function pause(el) { st(el).playing = false; cancelAnimationFrame(raf); sync(el); }
  function tick(now) {
    const el = steps[current], sc = sceneOf(el), s = st(el);
    if (!s.playing || !sc || panel.hidden) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (s.hold > 0) s.hold -= dt;
    else {
      s.t += dt / sc.duration * (s.slow ? .5 : 1);
      if (sc.loopFrom && s.t >= sc.loopFrom) s.done = true;   // the change has played through
      if (s.t >= 1) {
        const from = sc.loopFrom || 0;
        if (sc.loop) { s.t = from + (s.t - 1) % (1 - from); s.done = true; } else { s.t = 1; s.playing = false; s.done = true; }
      }
    }
    paint(el); sync(el);
    if (s.playing) raf = requestAnimationFrame(tick);
  }

  /* ---------- Terms that light parts of the picture ---------- */
  function relight(el) {
    const v = visualOf(el);
    if (!v) return;
    const names = lit && lit.step === el ? lit.parts : null;
    v.classList.toggle('has-lit', !!names);
    for (const n of $$('[data-part]', v)) n.classList.toggle('is-lit', !!names && n.dataset.part.split(/\s+/).some(p => names.includes(p)));
  }
  function wireTerms(el) {
    for (const d of $$('.caption dfn[data-part]', el)) {
      d.tabIndex = 0;
      const parts = d.dataset.part.split(/\s+/);
      const on = () => { lit = { step: el, parts }; d.classList.add('is-lit'); relight(el); };
      const off = () => { if (lit?.step === el) lit = null; d.classList.remove('is-lit'); relight(el); };
      d.addEventListener('pointerenter', on); d.addEventListener('pointerleave', off);
      d.addEventListener('focus', on); d.addEventListener('blur', off);
      d.addEventListener('click', () => (d.classList.contains('is-lit') ? off() : on()));
    }
  }

  /* ---------- Predict first: required on every visit and every replay ---------- */
  function renderCheck(el) {
    $(':scope > .lx-check', el)?.remove();
    const c = checkOf(el), cap = $('.caption', el);
    if (!c) { if (cap) cap.hidden = false; return; }
    const kind = kindOf(el), got = st(el).answer;
    const box = document.createElement('div');
    box.className = 'lx-check';
    box.innerHTML = '<p class="lx-tag">Predict first</p><p class="lx-q"></p>';
    $('.lx-q', box).textContent = c.prompt;
    box.append(choiceList(`check:${slug}:${kind}`, c.choices, got, c.answer, orig => {
      st(el).answer = orig;
      if (c.answer !== null) update(l => { l.checks[kind] = orig === c.answer; });
      revealAfterCheck(el);
    }));
    if (got !== undefined) {
      const v = document.createElement('p');
      v.className = `lx-verdict ${c.answer === null ? 'is-ungraded' : got === c.answer ? 'is-right' : 'is-wrong'}`;
      v.tabIndex = -1;
      v.textContent = c.answer === null ? 'Noted. The sources give no direction here, so there is no graded answer.' : got === c.answer ? 'Right.' : 'Not quite.';
      const why = document.createElement('p');
      why.className = 'lx-why'; why.textContent = c.why;
      box.append(v, why);
    } else {
      const hint = document.createElement('p');
      hint.className = 'lx-need'; hint.textContent = 'Choose an answer to see the change.';
      box.append(hint);
    }
    if (cap) { cap.hidden = got === undefined; cap.after(box); } else el.append(box);
  }
  function revealAfterCheck(el) {
    renderCheck(el);
    const s = st(el), sc = sceneOf(el);
    if (moving(el)) {
      s.t = 0; s.hold = sc.loop && !sc.loopFrom ? 0 : LEAD_IN; s.done = false;
      if (reducedMotion()) { s.t = sc.rest ?? 1; s.hold = 0; s.done = true; paint(el); sync(el); } else { paint(el); play(el); }
    } else paint(el);
    $('.lx-verdict', el)?.focus({ preventScroll: true });
    const v = visualOf(el);
    if (v && getComputedStyle(v).position !== 'sticky' && v.getBoundingClientRect().top < 0) v.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    renderPlan();
  }

  /* ---------- Steps ---------- */
  function buildRail() {
    const groups = [];
    steps.forEach((el, i) => { const s = stageOf(el); if (!groups.length || groups.at(-1).stage !== s) groups.push({ stage: s, items: [] }); groups.at(-1).items.push(i); });
    const rail = document.createElement('ol');
    rail.className = 'lx-rail'; rail.setAttribute('aria-label', 'Steps');
    for (const g of groups) {
      const li = document.createElement('li');
      li.style.setProperty('--n', g.items.length);
      li.innerHTML = `<span class="lx-stage">${esc(g.stage)}</span><ol></ol>`;
      for (const i of g.items) {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.to = String(i);
        b.setAttribute('aria-label', `Step ${i + 1}: ${steps[i].dataset.stepTitle}`);
        b.title = `Step ${i + 1}: ${steps[i].dataset.stepTitle}`;
        b.addEventListener('click', () => showStep(i, true));
        const item = document.createElement('li'); item.append(b); $('ol', li).append(item);
      }
      rail.append(li);
    }
    panel.prepend(rail);
  }
  function syncRail() {
    const seen = new Set(record().seen);
    for (const b of $$('.lx-rail button', panel)) {
      const i = +b.dataset.to;
      b.classList.toggle('is-seen', seen.has(i));
      if (i === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    }
  }
  function showStep(n, focus = false, remember = true) {
    if (!started) return;
    const prev = steps[current];
    if (prev && moving(prev)) pause(prev);
    const entering = steps[clamp(n, 0, steps.length - 1)];
    // Opening a "What changes it" step (again) asks the prediction again.
    if (entering !== prev || !entering.dataset.shown) { st(entering).answer = undefined; entering.dataset.shown = '1'; }
    current = clamp(n, 0, steps.length - 1);
    const el = steps[current];
    steps.forEach((s, i) => { s.hidden = i !== current; if (i !== current) delete s.dataset.shown; });
    backBtn.disabled = current === 0;
    const lastStep = current === steps.length - 1;
    nextBtn.textContent = lastStep ? 'Take the quiz →' : 'Next →';
    progress.textContent = `Step ${current + 1} of ${steps.length}`;
    if (location.hash !== `#step-${current + 1}` && (remember || location.hash)) history.replaceState(null, '', `#step-${current + 1}`);
    if (remember) update(l => { l.step = current; if (!l.seen.includes(current)) l.seen.push(current); });
    renderCheck(el);
    const s = st(el), sc = sceneOf(el);
    if (moving(el)) {
      playerOf(el);
      if (pending(el)) { s.t = 0; s.playing = false; s.done = false; }
      else if (reducedMotion()) { s.t = sc.rest ?? 1; s.playing = false; }
      else { if (!sc.loop || sc.loopFrom || s.t >= 1) { s.t = 0; s.hold = sc.loop && !sc.loopFrom ? 0 : LEAD_IN; } paint(el); play(el); }
    }
    paint(el); sync(el); syncRail(); renderPlan();
    if (focus) { $('h2', el).focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
  }
  function next() { if (current === steps.length - 1) activate(tabByName('quiz'), false, true); else showStep(current + 1, true); }

  /* ---------- Tabs ---------- */
  const nameOf = tab => tab.getAttribute('aria-controls');
  const tabByName = n => tabs.find(t => nameOf(t) === n);
  function activate(tab, focusTab = false, scroll = false, quiet = false) {
    if (!tab) return;
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(nameOf(t)); if (p) p.hidden = !on;
    }
    const name = nameOf(tab);
    if (focusTab) tab.focus();
    if (name === 'lesson') { if (started && !quiet) showStep(current); }
    else {
      const el = steps[current]; if (el && moving(el)) pause(el);
      if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    }
    if (name === 'quiz') A.quiz.renderQuiz(ctx);
    if (name === 'summary') A.quiz.renderSummary(ctx);
    cfg.onTab?.[name]?.();
    if (scroll) $('.tabs').scrollIntoView({ block: 'start' });
  }
  function fromHash() {
    const h = location.hash.slice(1), m = h.match(/^step-(\d+)$/);
    if (m) { if (tabByName('lesson').getAttribute('aria-selected') !== 'true') activate(tabByName('lesson'), false, false, true); showStep(Number(m[1]) - 1); return; }
    const t = tabByName(h);
    if (t && t.getAttribute('aria-selected') !== 'true') activate(t);
  }

  /* ---------- The plan: goals, time, what it builds on ---------- */
  function mastery() {
    const rec = record();
    return (plan?.objectives || []).map((_, i) => {
      const qs = (plan.quiz || []).filter(q => q.objective === i + 1);
      return { total: qs.length, right: qs.filter(q => rec.quiz[q.id] === true).length, answered: qs.filter(q => rec.quiz[q.id] !== undefined).length };
    });
  }
  function goalsList() {
    const m = mastery();
    return `<ol class="lx-goals">${(plan.objectives || []).map((o, i) => {
      const k = m[i], tag = k.total && k.answered ? `${k.right} of ${k.total} right` : '';
      return `<li><span>${esc(o)}</span><span class="lx-mastery${k.total && k.right === k.total ? ' is-full' : ''}">${tag}</span></li>`;
    }).join('')}</ol>`;
  }
  const lessonLink = s => (plan?.prerequisiteTitles?.[s] ? `<a href="../${esc(s)}/">${esc(plan.prerequisiteTitles[s])}</a>` : '');
  function renderPlan() {
    const box = $('[data-lx-plan]');
    if (!box || !plan) return;
    const rec = record(), seen = new Set(rec.seen).size, q = plan.quiz?.length || 0;
    const right = Object.values(rec.quiz).filter(a => a === true).length, answered = Object.keys(rec.quiz).length;
    const builds = (plan.prerequisites || []).map(lessonLink).filter(Boolean);
    const resume = rec.step > 0 && seen < steps.length;
    box.innerHTML = `<div><h2>You will be able to</h2>${goalsList()}</div>`
      + `<div><h2>This lesson</h2><p class="lx-facts"><b>${esc(plan.minutes)} min</b>${steps.length} steps · ${q} questions</p>`
      + `<h2>Builds on</h2><ul class="lx-builds">${builds.map(b => `<li>${b}</li>`).join('')}</ul>`
      + `<div class="lx-start"><button type="button" data-lx-go>${resume ? `Continue at step ${rec.step + 1}` : seen >= steps.length ? 'Go through it again' : 'Start the lesson'} →</button>`
      + `<small>${seen ? `${seen} of ${steps.length} steps seen` : 'Not started'}${answered ? ` · quiz ${right} of ${q} right` : ''}</small></div></div>`;
    $('[data-lx-go]', box).addEventListener('click', () => { activate(tabByName('lesson'), false, false, true); showStep(resume ? rec.step : 0, true); });
  }

  /* ---------- Wiring ---------- */
  function wire() {
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', () => showStep(current - 1, true));
    panel.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ' && !e.target.closest('button, input, select, textarea, a, summary, dfn')) {
        const btn = $('[data-lx-play]', steps[current]);
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        return;
      }
      if (e.target.closest('input, select, textarea, .lx-choices')) return;
      if (e.key === 'ArrowRight' && current < steps.length - 1) { e.preventDefault(); showStep(current + 1, true); }
      if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); showStep(current - 1, true); }
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t));
      t.addEventListener('keydown', e => {
        const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
        if (n !== undefined) { e.preventDefault(); activate(tabs[n], true); }
      });
    });
    addEventListener('hashchange', fromHash);
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || !main.contains(a)) return;
      const h = a.getAttribute('href').slice(1);
      if (/^step-\d+$/.test(h) || tabByName(h)) {
        e.preventDefault();
        history.pushState(null, '', `#${h}`);
        fromHash();
        if (/^step-/.test(h)) { const el = steps[current]; $('h2', el).focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
        else document.getElementById(h)?.querySelector('h2')?.focus();
      }
    });
    steps.forEach(wireTerms);
  }
  const ctx = { get plan() { return plan; }, steps, record, update, esc, goalsList, lessonLink, renderPlan, slug };

  (async () => {
    wire();
    buildRail();
    const [p] = await Promise.allSettled([A.loadData('plan'), (async () => { try { await cfg.before?.(); } catch (err) { console.error('lesson setup:', err); } })()]);
    plan = p.status === 'fulfilled' ? p.value : null;
    const qt = tabByName('quiz');
    if (plan?.quiz?.length && qt && !$('.lx-count', qt)) qt.insertAdjacentHTML('beforeend', `<span class="lx-count">${plan.quiz.length}</span>`);
    started = true;
    renderPlan();
    const h = location.hash.slice(1);
    if (/^step-\d+$/.test(h) || tabByName(h)) fromHash(); else showStep(0, false, false);
    document.documentElement.dataset.lesson = 'ready';
  })();
}

A.lesson = lesson;
})();
