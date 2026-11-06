// The Lab kit runtime: everything a lesson page does that is not its own pictures or model.
// A lesson's app.js imports lesson() and calls it once (lab/FORMAT.md is the full contract).
//
// Expected behaviour:
//   - Tabs Lesson, Quiz, Summary, Clinical values, Explore freely: ARIA tabs, arrow keys move between
//     them, and the address says where you are (#step-N, #quiz, #summary, #clinical, #explore).
//   - Lesson: one step at a time with Back/Next, the arrow keys, and a rail of every step grouped by
//     stage. A step's picture comes from scenes[data-kind], in one of three forms:
//       a function returning SVG markup (a still picture);
//       { duration, loop, loopFrom, rest, render(t) } returning markup (or { svg, readout }) for
//         the moment t from 0 to 1, redrawn every frame;
//       { duration, loop, loopFrom, rest, mount(host) } that builds its SVG once in host and returns
//         { render(t) } to update it (for pictures with many moving parts).
//     loop: after t reaches 1 it starts again from loopFrom (default 0). rest: the moment shown when
//     nothing may move (reduced motion; default 1). stages: [[t, words], ...] names the parts of a
//     timeline on the player ("the drug", "the reflex"). A mounted scene may also return readout(t).
//   - A moving picture has one player: play/pause, a scrubber, half speed, replay. It plays when its
//     step opens; with reduced motion it opens paused on its last frame. Only t moves the picture.
//   - Predict first: a step with a check in plan.json holds its picture at t = 0 and hides its caption
//     and readout until the reader answers (or skips). Then the caption, the reason and the picture
//     play. Answers are kept, so a revisited step shows what was chosen.
//   - Quiz: plan.json's questions, one try each, choices in a fixed shuffled order per question, each
//     answer explained with a link back to the step that teaches it. Try again clears the answers and
//     shuffles every question's choices into a new order.
//   - Summary: the takeaways, each goal with how many of its questions were answered right, every term
//     the lesson defines (its <dfn>s) with the sentence that defines it, and the next lesson.
//   - A <dfn data-part="x"> in a caption lights the picture's [data-part="x"] on hover, focus or tap.
//   - Progress (step, steps seen, answers) is kept in this browser only (progress.js).
//   - If plan.json or the syllabus cannot be read, the steps still work; the plan parts say so.
import { lessonRecord, updateLesson, forgetLesson } from './progress.js';
import { choiceList } from './quiz.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAD_IN = 700;   // ms a change holds on "before" when it starts from the beginning
const PLAY = '▶︎', PAUSE = '❚❚';

async function readJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function lesson(cfg = {}) {
  const scenes = cfg.scenes || {};
  const main = $('main');
  const slug = main.dataset.slug || location.pathname.split('/').filter(Boolean).pop();
  const lessonPanel = $('#lesson');
  const steps = $$('[data-step][data-step-title]', lessonPanel);
  const tabs = $$('.tabs [role=tab]');
  const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
  let plan = null, course = null, current = 0, started = false, raf = 0, last = 0, lit = null;
  const state = new Map();   // step element -> { t, playing, slow, done, hold }

  const visualOf = el => el.querySelector('[data-visual]');
  const captionOf = el => el.querySelector('.caption');
  const stageOf = el => (el.querySelector('.eyebrow')?.textContent || el.dataset.stage || '').trim();
  const kindOf = el => el.dataset.kind;
  const sceneOf = el => {
    const s = scenes[kindOf(el)];
    if (!s) return null;
    return typeof s === 'function' ? { duration: 0, loop: false, render: s } : { duration: 0, loop: false, ...s };
  };
  const moving = el => (sceneOf(el)?.duration || 0) > 0;
  const checkOf = el => plan?.checks?.[kindOf(el)] || null;
  const record = () => lessonRecord(slug);
  const stState = el => {
    if (!state.has(el)) state.set(el, { t: 1, playing: false, slow: false, done: false, hold: 0 });
    return state.get(el);
  };
  const pending = el => { const c = checkOf(el); return !!c && record().checks[kindOf(el)] === undefined; };

  /* ---------- Pictures ---------- */
  function paint(el) {
    const sc = sceneOf(el), v = visualOf(el);
    if (!sc || !v) return;
    const st = stState(el);
    if (sc.mount) {
      let host = v.querySelector(':scope > .lx-pic');
      if (!host) { host = document.createElement('div'); host.className = 'lx-pic'; v.prepend(host); }
      let ro = '';
      try {
        if (!st.inst) { host.replaceChildren(); st.inst = sc.mount(host, el); }
        const t = moving(el) ? st.t : (sc.rest ?? 1);
        st.inst.render(t);
        ro = st.inst.readout?.(t) || '';
      } catch (err) { console.error(`scene ${kindOf(el)}:`, err); return; }
      placeReadout(el, v, host, ro);
      v.dataset.anim = moving(el) ? (st.done ? 'done' : 'running') : 'still';
      relight(el);
      return;
    }
    let out;
    try { out = sc.render(moving(el) ? st.t : 1, el); }
    catch (err) { console.error(`scene ${kindOf(el)}:`, err); return; }
    const pic = typeof out === 'string' ? out : out.svg, ro = typeof out === 'string' ? '' : (out.readout || '');
    let host = v.querySelector(':scope > .lx-pic');
    if (!host) { host = document.createElement('div'); host.className = 'lx-pic'; v.prepend(host); }
    host.innerHTML = pic;
    placeReadout(el, v, host, ro);
    v.dataset.anim = moving(el) ? (st.done ? 'done' : 'running') : 'still';
    relight(el);
  }

  // The "compared with normal" list under a picture, redrawn only when its words change, hidden while
  // a prediction is pending (it would give the answer away).
  function placeReadout(el, v, host, ro) {
    let roEl = v.querySelector(':scope > .readout');
    if (ro) {
      if (!roEl || roEl.dataset.src !== ro) {
        const tmp = document.createElement('div'); tmp.innerHTML = ro;
        const fresh = tmp.firstElementChild; fresh.dataset.src = ro;
        if (roEl) roEl.replaceWith(fresh); else host.after(fresh);
        roEl = fresh;
      }
      roEl.hidden = pending(el);
    } else if (roEl) roEl.remove();
  }

  function playerOf(el) {
    const v = visualOf(el);
    let p = v.querySelector(':scope > .lx-player');
    if (p || !moving(el)) return p;
    p = document.createElement('div');
    p.className = 'lx-player';
    p.setAttribute('role', 'group');
    p.setAttribute('aria-label', 'Picture controls');
    p.innerHTML = `<button type="button" data-lx-play aria-label="Pause">${PAUSE}</button>`
      + `<input type="range" min="0" max="1000" step="1" value="0" aria-label="Move through the picture">`
      + `<span class="lx-when" aria-hidden="true"></span>`
      + `<button type="button" data-lx-slow aria-pressed="false" aria-label="Half speed">½×</button>`
      + `<button type="button" data-lx-replay aria-label="Replay from the start">↻</button>`;
    v.append(p);
    const st = stState(el);
    p.querySelector('[data-lx-play]').addEventListener('click', () => {
      if (st.playing) pause(el);
      else { if (st.t >= 1 && !sceneOf(el).loop) st.t = 0; play(el); }
    });
    // Read the scrubber before pausing: pausing redraws the player from t.
    p.querySelector('input').addEventListener('input', e => { const t = e.target.value / 1000; pause(el); st.t = t; st.hold = 0; paint(el); syncPlayer(el); });
    p.querySelector('[data-lx-slow]').addEventListener('click', e => { st.slow = !st.slow; e.currentTarget.setAttribute('aria-pressed', String(st.slow)); });
    p.querySelector('[data-lx-replay]').addEventListener('click', () => { st.t = 0; st.hold = sceneOf(el).loop ? 0 : LEAD_IN; play(el); });
    return p;
  }
  function syncPlayer(el) {
    const p = playerOf(el);
    if (!p) return;
    const st = stState(el), off = pending(el);
    const btn = p.querySelector('[data-lx-play]'), range = p.querySelector('input');
    btn.textContent = st.playing ? PAUSE : PLAY;
    btn.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
    range.value = String(Math.round(st.t * 1000));
    const sc = sceneOf(el), named = sc.stages && [...sc.stages].reverse().find(([from]) => st.t >= from);
    // A change that then keeps cycling reads before / changing / after; a plain cycle reads as a share of it.
    const words = named ? named[1]
      : sc.loopFrom ? (st.t <= 0 ? 'before' : st.t < sc.loopFrom ? 'changing' : 'after')
      : sc.loop ? `${Math.round(st.t * 100)}% of the cycle` : st.t <= 0 ? 'before' : st.t >= 1 ? 'after' : `${Math.round(st.t * 100)}%`;
    range.setAttribute('aria-valuetext', words);
    p.querySelector('.lx-when').textContent = words;
    for (const c of p.querySelectorAll('button, input')) c.disabled = off;
  }
  function play(el) {
    const st = stState(el);
    st.playing = true;
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    syncPlayer(el);
  }
  function pause(el) {
    stState(el).playing = false;
    cancelAnimationFrame(raf);
    syncPlayer(el);
  }
  function tick(now) {
    const el = steps[current], sc = sceneOf(el), st = stState(el);
    if (!st.playing || !sc || lessonPanel.hidden) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (st.hold > 0) st.hold -= dt;
    else {
      st.t += dt / sc.duration * (st.slow ? 0.5 : 1);
      if (st.t >= 1) {
        const from = sc.loopFrom || 0;
        if (sc.loop) { st.t = from + (st.t - 1) % (1 - from); st.done = true; }
        else { st.t = 1; st.playing = false; st.done = true; }
      }
    }
    paint(el);
    syncPlayer(el);
    if (st.playing) raf = requestAnimationFrame(tick);
  }

  /* ---------- Terms that light parts of the picture ---------- */
  function relight(el) {
    const v = visualOf(el);
    if (!v) return;
    const names = lit && lit.step === el ? lit.parts : null;
    v.classList.toggle('has-lit', !!names);
    for (const n of v.querySelectorAll('[data-part]')) {
      n.classList.toggle('is-lit', !!names && n.dataset.part.split(/\s+/).some(p => names.includes(p)));
    }
  }
  function wireTerms(el) {
    for (const d of el.querySelectorAll('.caption dfn[data-part]')) {
      d.tabIndex = 0;
      const parts = d.dataset.part.split(/\s+/);
      const on = () => { lit = { step: el, parts }; d.classList.add('is-lit'); relight(el); };
      const off = () => { if (lit?.step === el) lit = null; d.classList.remove('is-lit'); relight(el); };
      d.addEventListener('pointerenter', on);
      d.addEventListener('pointerleave', off);
      d.addEventListener('focus', on);
      d.addEventListener('blur', off);
      d.addEventListener('click', () => (d.classList.contains('is-lit') ? off() : on()));
    }
  }

  /* ---------- Predict first ---------- */
  function renderCheck(el) {
    const c = checkOf(el);
    el.querySelector(':scope > .lx-check')?.remove();
    if (!c) return;
    const kind = kindOf(el), rec = record(), got = rec.checks[kind], pick = rec.picks?.[`check:${kind}`];
    const box = document.createElement('div');
    box.className = 'lx-check';
    box.innerHTML = `<p class="lx-tag">Predict first</p><p class="lx-q"></p>`;
    box.querySelector('.lx-q').textContent = c.prompt;
    const answered = got !== undefined;
    box.append(choiceList(`check:${slug}:${kind}`, c.choices, answered && got !== 'skip' ? pick : (got === 'skip' ? -1 : undefined), c.answer, orig => {
      updateLesson(slug, l => { l.checks[kind] = orig === c.answer; l.picks = { ...(l.picks || {}), [`check:${kind}`]: orig }; });
      revealAfterCheck(el);
    }));
    if (answered) {
      const v = document.createElement('p');
      v.className = `lx-verdict ${got === true ? 'is-right' : got === false ? 'is-wrong' : ''}`;
      v.textContent = got === true ? 'Right.' : got === false ? 'Not quite.' : 'Skipped. The answer is marked.';
      const why = document.createElement('p');
      why.className = 'lx-why';
      why.textContent = c.why;
      box.append(v, why);
    } else {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'lx-skip';
      skip.textContent = 'Skip, just show me';
      skip.addEventListener('click', () => { updateLesson(slug, l => { l.checks[kind] = 'skip'; }); revealAfterCheck(el); });
      box.append(skip);
    }
    const cap = captionOf(el);
    if (cap) { cap.hidden = !answered; cap.after(box); } else el.append(box);
  }
  function revealAfterCheck(el) {
    renderCheck(el);
    const st = stState(el);
    paint(el);
    if (moving(el)) {
      const sc = sceneOf(el);
      st.t = 0; st.hold = sc.loop ? 0 : LEAD_IN;
      if (reducedMotion()) { st.t = sc.rest ?? 1; st.hold = 0; paint(el); syncPlayer(el); } else play(el);
    }
    el.querySelector('.lx-verdict')?.setAttribute('tabindex', '-1');
    el.querySelector('.lx-verdict')?.focus({ preventScroll: true });
    // In one column the picture has scrolled away while the reader chose: bring it back to watch the change.
    const v = visualOf(el);
    if (v && getComputedStyle(v).position !== 'sticky' && v.getBoundingClientRect().top < 0) v.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    renderPlan();
  }

  /* ---------- Steps ---------- */
  function buildRail() {
    const groups = [];
    steps.forEach((el, i) => {
      const s = stageOf(el);
      if (!groups.length || groups.at(-1).stage !== s) groups.push({ stage: s, items: [] });
      groups.at(-1).items.push(i);
    });
    const rail = document.createElement('ol');
    rail.className = 'lx-rail';
    rail.setAttribute('aria-label', 'Steps');
    for (const g of groups) {
      const li = document.createElement('li');
      li.style.setProperty('--n', g.items.length);
      li.innerHTML = `<span class="lx-stage">${esc(g.stage)}</span><ol></ol>`;
      for (const i of g.items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.to = String(i);
        b.setAttribute('aria-label', `Step ${i + 1}: ${steps[i].dataset.stepTitle}`);
        b.title = `Step ${i + 1}: ${steps[i].dataset.stepTitle}`;
        b.addEventListener('click', () => showStep(i, true));
        const item = document.createElement('li');
        item.append(b);
        li.querySelector('ol').append(item);
      }
      rail.append(li);
    }
    lessonPanel.prepend(rail);
  }
  function syncRail() {
    const seen = new Set(record().seen);
    for (const b of $$('.lx-rail button', lessonPanel)) {
      const i = +b.dataset.to;
      b.classList.toggle('is-seen', seen.has(i));
      if (i === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    }
  }
  // remember: false for the step a page opens on by itself, so opening a lesson never moves the
  // reader's place (the head offers "Continue at step N" instead).
  function showStep(n, focus = false, remember = true) {
    if (!started) return;
    const prev = steps[current];
    if (prev && moving(prev)) { pause(prev); }
    current = clamp(n, 0, steps.length - 1);
    const el = steps[current];
    steps.forEach((s, i) => { s.hidden = i !== current; });
    backBtn.disabled = current === 0;
    const lastStep = current === steps.length - 1;
    nextBtn.textContent = lastStep ? (plan?.quiz?.length ? 'Take the quiz →' : 'Start again ↻') : 'Next →';
    progress.textContent = `Step ${current + 1} of ${steps.length}`;
    if (location.hash !== `#step-${current + 1}` && (remember || location.hash)) history.replaceState(null, '', `#step-${current + 1}`);
    if (remember) updateLesson(slug, l => { l.step = current; if (!l.seen.includes(current)) l.seen.push(current); });
    renderCheck(el);
    const st = stState(el);
    if (moving(el)) {
      const sc = sceneOf(el);
      playerOf(el);
      if (pending(el)) { st.t = 0; st.playing = false; }
      else if (reducedMotion()) { st.t = sc.rest ?? 1; st.playing = false; }
      else {
        // A change starts again from "before"; a plain cycle carries on where it was.
        if (!sc.loop || sc.loopFrom || st.t >= 1) { st.t = 0; st.hold = sc.loop ? 0 : LEAD_IN; }
        paint(el); play(el);
      }
    }
    paint(el);
    syncPlayer(el);
    syncRail();
    renderPlan();
    if (focus) {
      const h = el.querySelector('h2');
      h.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'start' });
    }
  }
  function next() {
    if (current === steps.length - 1) { if (plan?.quiz?.length) activate(tabByName('quiz'), false, true); else showStep(0, true); }
    else showStep(current + 1, true);
  }

  /* ---------- Tabs ---------- */
  const nameOf = tab => tab.getAttribute('aria-controls');
  const tabByName = n => tabs.find(t => nameOf(t) === n);
  // quiet: switch to the Lesson tab without drawing its step (the caller shows one next).
  function activate(tab, focusTab = false, scroll = false, quiet = false) {
    if (!tab) return;
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(nameOf(t));
      if (p) p.hidden = !on;
    }
    const name = nameOf(tab);
    if (focusTab) tab.focus();
    if (name === 'lesson') { if (started && !quiet) showStep(current); }
    else {
      const el = steps[current];
      if (el && moving(el)) pause(el);
      if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    }
    if (name === 'quiz') renderQuiz();
    if (name === 'summary') renderSummary();
    cfg.onTab?.[name]?.();
    if (scroll) $('.tabs').scrollIntoView({ block: 'start' });
  }
  function fromHash() {
    const h = location.hash.slice(1);
    const m = h.match(/^step-(\d+)$/);
    if (m) {
      if (tabByName('lesson').getAttribute('aria-selected') !== 'true') activate(tabByName('lesson'), false, false, true);
      showStep(Number(m[1]) - 1);
      return;
    }
    const t = tabByName(h);
    if (t && t.getAttribute('aria-selected') !== 'true') activate(t);
  }

  /* ---------- Plan: goals, time, what it builds on ---------- */
  const lessonNo = () => course ? course.modules.findIndex(m => m.slug === slug) + 1 : 0;
  const moduleBy = s => course?.modules.find(m => m.slug === s);
  const linkTo = (s, extra = '') => {
    const m = moduleBy(s);
    if (!m) return '';
    const n = course.modules.indexOf(m) + 1;
    return `<a href="/lab/${esc(s)}/${extra}">Lesson ${n}: ${esc(m.title.replace(/[\u2013\u2014]/g, '-'))}</a>`;
  };
  function mastery() {
    const rec = record(), out = [];
    (plan?.objectives || []).forEach((_, i) => {
      const qs = (plan.quiz || []).filter(q => q.objective === i + 1);
      out.push({ total: qs.length, right: qs.filter(q => rec.quiz[q.id] === true).length, answered: qs.filter(q => rec.quiz[q.id] !== undefined).length });
    });
    return out;
  }
  function goalsList() {
    const m = mastery();
    return `<ol class="lx-goals">${(plan.objectives || []).map((o, i) => {
      const k = m[i], tag = !k.total ? '' : k.answered ? `${k.right} of ${k.total} right` : '';
      return `<li><span>${esc(o)}</span><span class="lx-mastery${k.total && k.right === k.total ? ' is-full' : ''}">${tag}</span></li>`;
    }).join('')}</ol>`;
  }
  function renderPlan() {
    const box = $('[data-lx-plan]');
    if (!box || !plan) return;
    const rec = record(), seen = new Set(rec.seen).size, q = plan.quiz?.length || 0;
    const right = Object.values(rec.quiz).filter(a => a === true).length, answered = Object.keys(rec.quiz).length;
    const builds = (plan.prerequisites || []).map(s => linkTo(s)).filter(Boolean);
    const resume = rec.step > 0 && seen < steps.length;
    box.innerHTML = `<div><h2>You will be able to</h2>${goalsList()}</div>`
      + `<div><h2>This lesson</h2><p class="lx-facts"><b>${esc(plan.minutes)} min</b>${steps.length} steps · ${q} questions</p>`
      + (builds.length ? `<h2>Builds on</h2><ul class="lx-builds">${builds.map(b => `<li>${b}</li>`).join('')}</ul>` : `<h2>Builds on</h2><p class="lx-facts">Nothing: a good place to start.</p>`)
      + `<div class="lx-start"><button type="button" data-lx-go>${resume ? `Continue at step ${rec.step + 1}` : seen >= steps.length ? 'Go through it again' : 'Start the lesson'} →</button>`
      + `<small>${seen ? `${seen} of ${steps.length} steps seen` : 'Not started'}${answered ? ` · quiz ${right} of ${q} right` : ''}</small></div></div>`;
    box.querySelector('[data-lx-go]').addEventListener('click', () => {
      activate(tabByName('lesson'), false, false, true);
      showStep(resume ? rec.step : 0, true);
    });
  }

  /* ---------- Quiz ---------- */
  function stepLink(kind) {
    const i = steps.findIndex(s => kindOf(s) === kind);
    return i < 0 ? '' : `<a href="#step-${i + 1}">Review step ${i + 1}: ${esc(steps[i].dataset.stepTitle)}</a>`;
  }
  function renderQuiz() {
    const box = $('#quiz');
    if (!box) return;
    const qs = plan?.quiz || [];
    if (!qs.length) { box.innerHTML = '<p class="hint">The questions for this lesson could not be loaded. Reload the page to try again.</p>'; return; }
    const rec = record();
    const right = qs.filter(q => rec.quiz[q.id] === true).length, answered = qs.filter(q => rec.quiz[q.id] !== undefined).length;
    box.innerHTML = `<div class="lx-quiz-head"><h2 tabindex="-1">Check yourself</h2><p class="lx-score" aria-live="polite"><b>${right}</b> of ${qs.length} right${answered < qs.length ? ` · ${qs.length - answered} to go` : ''}</p></div>`
      + `<p class="hint">One try each. Every answer explains itself and links back to the step that teaches it.</p><ol class="lx-qs"></ol>`
      + `<div class="lx-quiz-foot"><p>${answered === qs.length ? (right === qs.length ? 'All right. The summary has the whole lesson on one page.' : 'Review the steps linked above, then try again.') : ''}</p>`
      + `<button type="button" data-lx-again>Try again</button><a href="#summary" data-lx-to="summary">Lesson summary</a></div>`;
    const list = box.querySelector('.lx-qs');
    for (const q of qs) {
      const li = document.createElement('li');
      li.dataset.q = q.id;
      const got = rec.quiz[q.id], pick = rec.picks?.[`quiz:${q.id}`];
      li.innerHTML = `<div><p class="lx-meta">Goal ${esc(q.objective)}</p><p class="lx-stem"></p></div>`;
      li.querySelector('.lx-stem').textContent = q.stem;
      li.firstElementChild.append(choiceList(`quiz:${slug}:${q.id}${rec.round ? `:${rec.round}` : ''}`, q.choices, got === undefined ? undefined : pick, q.answer, orig => {
        updateLesson(slug, l => { l.quiz[q.id] = orig === q.answer; l.picks = { ...(l.picks || {}), [`quiz:${q.id}`]: orig }; });
        renderQuiz();
        renderPlan();
        $(`[data-q="${q.id}"] .lx-verdict`, box)?.focus({ preventScroll: true });
      }));
      if (got !== undefined) {
        const fb = document.createElement('div');
        fb.innerHTML = `<p class="lx-verdict ${got ? 'is-right' : 'is-wrong'}" tabindex="-1">${got ? 'Right.' : 'Not quite.'}</p><p class="lx-why"></p><p class="lx-review">${stepLink(q.step)}</p>`;
        fb.querySelector('.lx-why').textContent = q.why;
        li.firstElementChild.append(fb);
      }
      list.append(li);
    }
    box.querySelector('[data-lx-again]').addEventListener('click', () => {
      // A new round shuffles every question's choices again, so a retry tests the idea, not the position.
      updateLesson(slug, l => { l.quiz = {}; l.round = (l.round || 0) + 1; l.picks = Object.fromEntries(Object.entries(l.picks || {}).filter(([k]) => !k.startsWith('quiz:'))); });
      renderQuiz();
      renderPlan();
      box.querySelector('h2').focus();
    });
  }

  /* ---------- Summary ---------- */
  function glossary() {
    const seen = new Map();
    steps.forEach((el, i) => {
      const cap = captionOf(el);
      if (!cap) return;
      // Split into sentences without a lookbehind (older Safari cannot parse one, and would drop the whole module).
      const sentences = cap.textContent.replace(/\s+/g, ' ').trim().replace(/([.!?])\s+(?=[A-Z0-9])/g, '$1\n').split('\n');
      for (const d of cap.querySelectorAll('dfn')) {
        const term = d.textContent.replace(/\s+/g, ' ').trim(), key = term.toLowerCase();
        if (!term || seen.has(key)) continue;
        const sentence = sentences.find(s => s.includes(term)) || sentences[0];
        seen.set(key, { term, sentence, step: i });
      }
    });
    return [...seen.values()];
  }
  function renderSummary() {
    const box = $('#summary');
    if (!box) return;
    if (!plan) { box.innerHTML = '<p class="hint">The summary could not be loaded. Reload the page to try again.</p>'; return; }
    const terms = glossary(), n = lessonNo(), nextMod = course?.modules[n], prevMod = n > 1 ? course.modules[n - 2] : null;
    box.innerHTML = `<div class="lx-sum">`
      + `<section><h2 tabindex="-1">The lesson in one minute</h2><ol class="lx-takeaways">${(plan.takeaways || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
      + `<h2 style="margin-top:28px">Your goals</h2>${goalsList()}`
      + `<div class="lx-next">${nextMod ? `<p><b>Next:</b> ${linkTo(nextMod.slug)}</p>` : '<p><b>This is the last lesson of the course.</b> <a href="/lab/">Back to all lessons</a></p>'}${prevMod ? `<p>Before this: ${linkTo(prevMod.slug)}</p>` : ''}</div>`
      + `<button type="button" class="lx-print" data-lx-print>Print this summary</button></section>`
      + `<section><h2>Terms</h2><dl class="lx-terms">${terms.map(t => `<dt>${esc(t.term)}</dt><dd>${esc(t.sentence)} <a href="#step-${t.step + 1}">step ${t.step + 1}</a></dd>`).join('')}</dl></section>`
      + `</div>`;
    box.querySelector('[data-lx-print]').addEventListener('click', () => print());
  }

  /* ---------- Start ---------- */
  function wire() {
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', () => showStep(current - 1, true));
    lessonPanel.addEventListener('keydown', e => {
      if (e.target.closest('input, select, textarea, .lx-choices') || e.altKey || e.ctrlKey || e.metaKey) return;
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
        if (/^step-/.test(h)) { const el = steps[current]; el.querySelector('h2').focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
        else document.getElementById(h)?.querySelector('h2')?.focus();
      }
    });
    let resizeTimer = 0;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!started) return; for (const st of state.values()) st.inst = null; paint(steps[current]); }, 150); });
    steps.forEach(wireTerms);
  }

  const api = {
    get current() { return current; },
    steps,
    redraw() { if (started) { paint(steps[current]); syncPlayer(steps[current]); } },
    showStep,
    activate: name => activate(tabByName(name)),
    reset() { forgetLesson(slug); state.clear(); showStep(0); renderPlan(); },
  };

  (async () => {
    wire();
    buildRail();
    const setup = (async () => { try { await cfg.before?.(api); } catch (err) { console.error('lesson setup:', err); } })();
    const [p, c] = await Promise.allSettled([readJSON('./plan.json'), readJSON('/lab/syllabus.json'), setup]);
    plan = p.status === 'fulfilled' ? p.value : null;
    course = c.status === 'fulfilled' && Array.isArray(c.value?.modules) ? c.value : null;
    for (const t of tabs) {
      const n = nameOf(t), count = n === 'quiz' ? plan?.quiz?.length : 0;
      if (count && !t.querySelector('.lx-count')) t.insertAdjacentHTML('beforeend', `<span class="lx-count">${count}</span>`);
    }
    started = true;
    renderPlan();
    const h = location.hash.slice(1);
    if (/^step-\d+$/.test(h) || tabByName(h)) fromHash();
    else showStep(0, false, false);
    document.documentElement.dataset.lesson = 'ready';
    cfg.ready?.(api);
  })();
  return api;
}
