// Explore freely: choose any state, predict what urine volume does, then watch the whole picture
// morph from the state you left to the one you chose, under one player. Replaying the change asks
// for the prediction again. Quotes that carry a reference number are left to the Clinical values
// tab, and linked from here.
(() => {
const A = window.ADH;
const { STATES, STATE_ORDER, SOURCES, store, gate } = A;
const { svg, ease, span, clamp, esc } = A.draw;
const { schematic, levelsOf, wordsOf, mix, firing, FULL, describeState } = A.picture;

const $ = s => document.querySelector(s);
const DURATION = 6000, MORPH = .45, LOOP_FROM = .5;
const PLAY = '▶︎', PAUSE = '❚❚';
const FIELD_NAMES = { water: 'Water in or out', blood: 'Blood concentration', adh: 'ADH', aquaporins: 'Water channels', urineVolume: 'Urine volume', urineConcentration: 'Urine concentration', sodiumMarker: 'Blood sodium' };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// done: the change shown has played through to "after"; going back into it from here is a replay.
let from = 'baseline', to = 'baseline', t = 1, playing = false, slow = false, raf = 0, last = 0, ask = null, done = true, replaying = false;

function draw() {
  const m = ease.inOut(span(t, 0, MORPH));
  const L = mix(levelsOf(from), levelsOf(to), m);
  const s = STATES[to], changed = to !== 'baseline';
  const desc = `${s.label}${changed ? ', drawn over dashed outlines of normal' : ''}. ${describeState(to)}.`;
  const body = schematic({
    L, ghost: changed ? levelsOf('baseline') : null, show: FULL, phase: t * 4, fire: firing(L),
    words: m > .5 ? wordsOf(to) : wordsOf(from), callout: s.callout, calloutA: from === to ? 1 : span(t, .3, .45),
    legend: changed ? s.legend : null,
  });
  $('#explore-pic').innerHTML = svg(`The whole loop: ${s.label}`, desc, body, { h: 420 });
  const scrub = $('#ex-scrub');
  scrub.value = String(Math.round(t * 1000));
  const words = t <= 0 ? 'before' : t < MORPH ? 'changing' : 'after';
  scrub.setAttribute('aria-valuetext', words);
  $('#ex-when').textContent = words;
}
function syncPlay() {
  const b = $('#ex-play');
  b.textContent = playing ? PAUSE : PLAY;
  b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
function tick(now) {
  if (!playing || $('#explore').hidden) { playing = false; syncPlay(); return; }
  const dt = last ? Math.min(64, now - last) : 16;
  last = now;
  t += dt / DURATION * (slow ? .5 : 1);
  if (t >= LOOP_FROM) done = true;
  if (t >= 1) t = LOOP_FROM + (t - 1) % (1 - LOOP_FROM);
  draw();
  raf = requestAnimationFrame(tick);
}
function play() { if (reduced()) { t = 1; done = true; draw(); return; } playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); syncPlay(); }
function pause() { playing = false; cancelAnimationFrame(raf); syncPlay(); }
const locked = on => { for (const id of ['ex-play', 'ex-step', 'ex-scrub', 'ex-slow']) $('#' + id).disabled = on; };

function syncButtons() {
  for (const b of document.querySelectorAll('#explore-states [data-state]')) {
    b.setAttribute('aria-pressed', String(b.dataset.state === store.current));
    b.classList.toggle('is-pending', b.dataset.state === ask?.pending);
  }
}
// A quote with a number in it is a reference value: it is shown in Clinical values, not here.
const numeric = q => /\d/.test(q.excerpt);
function why(id) {
  const s = STATES[id], box = $('#explore-why');
  const rows = Object.entries(s.why).map(([field, ids]) => `<li><b>${esc(FIELD_NAMES[field] || field)}</b>${ids.map(q => {
    const src = SOURCES[q];
    return numeric(src) ? `<span class="adh-ref">A reference value, quoted in the <a href="#clinical">Clinical values</a> tab.</span>` : `<q>${esc(src.excerpt)}</q> <cite>${esc(src.section)}</cite>`;
  }).join(' ')}</li>`);
  const missing = Object.keys(FIELD_NAMES).filter(k => k !== 'water' && s[k] === 'unstated');
  box.innerHTML = `<summary>Why the picture shows this: the quotes</summary><ul class="adh-quotes">${rows.join('')}</ul>`
    + (missing.length ? `<p class="model-note">Not stated in the sources for this state: ${missing.map(k => FIELD_NAMES[k].toLowerCase()).join(', ')}. The picture draws ${missing.length > 1 ? 'them' : 'it'} as a dashed outline and says “not stated”.</p>` : '');
}

function initExplore(announce) {
  const host = $('#explore-states');
  for (const id of STATE_ORDER) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.state = id; b.textContent = STATES[id].label;
    b.setAttribute('aria-pressed', String(id === store.current));
    b.addEventListener('click', () => {
      // A replay question stays until it is answered: choosing the state being replayed asks it again.
      if (replaying && id === store.current) { ask.ask(to, from); syncButtons(); $('#explore-gate').querySelector('button')?.focus(); return; }
      ask.ask(id);
      // Choosing the state already shown (with no replay waiting) asks nothing and changes nothing.
      if (!ask.pending) { pause(); t = 1; done = true; locked(false); draw(); }
      syncButtons();
      $('#explore-gate').querySelector('button')?.focus();
    });
    host.append(b);
  }
  ask = gate($('#explore-gate'), { origin: 'explore' });
  store.on((id, prev, origin) => {
    from = prev; to = id; replaying = false;
    if (origin !== 'explore') ask.clear();
    why(id);
    syncButtons();
    locked(false);
    const text = `${STATES[id].label}: ${describeState(id)}. ${STATES[id].callout.join(' ')}`;
    $('#explore-result').textContent = text;
    if (origin === 'explore' && !reduced()) { t = 0; done = false; draw(); play(); }
    else { t = 1; done = true; pause(); draw(); }
    if (origin === 'explore') announce?.(text);
  });
  $('#ex-play').addEventListener('click', () => { if (playing) pause(); else { if (t >= 1) t = LOOP_FROM; play(); } });
  // Replaying a change is a change: by the Replay button, or by dragging back into a change that has
  // already played, it asks for the prediction again before anything moves.
  const askAgain = () => {
    replaying = true;
    pause(); t = 0; done = false; draw(); locked(true);
    ask.ask(to, from); syncButtons();
    $('#explore-gate').querySelector('button')?.focus();
  };
  $('#ex-restart').addEventListener('click', () => { if (from === to) { t = 1; draw(); return; } askAgain(); });
  $('#ex-step').addEventListener('click', () => { pause(); t = clamp(Math.floor(t * 10 + 1e-6) / 10 + .1, 0, 1); if (t >= LOOP_FROM) done = true; draw(); });
  $('#ex-slow').addEventListener('click', e => { slow = !slow; e.currentTarget.setAttribute('aria-pressed', String(slow)); });
  $('#ex-scrub').addEventListener('input', e => {
    const nt = e.target.value / 1000;
    if (from !== to && done && nt < LOOP_FROM) { askAgain(); return; }
    pause(); t = nt; if (t >= LOOP_FROM) done = true; draw();
  });
  why(store.current);
  draw();
  syncPlay();
}

A.explore = { initExplore, showExplore: draw };
})();
