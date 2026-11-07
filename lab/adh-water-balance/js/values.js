// Clinical values: one live bar per reference value from ../clinical-values.json, each with its quoted
// source, and a marker for the state chosen (shared with Explore freely). The teaching model is
// qualitative, so a marker shows a direction from baseline in words, never a made-up number. A marker
// is drawn only where a quote places it: if no excerpt places the baseline on a bar, that bar shows a
// marker only for a state whose source names the condition the bar marks.
(() => {
const A = window.ADH;
const { SOURCES, STATES, STATE_ORDER, store, gate } = A;
const { esc } = A.draw;
const $ = s => document.querySelector(s);
let data = null, ask = null;

const ARROW = { up: '↑ up', down: '↓ down', none: '↔ unchanged' };
const num = (v, x) => (v.decimals ? x.toFixed(v.decimals) : String(x));
// The reference itself, as the source gives it, in the source's own unit.
function reference(v) {
  if (v.kind === 'range') return `${num(v, v.low)}-${num(v, v.high)} ${v.unit}`;
  if (v.kind === 'threshold') return `${v.side === 'below' ? '<' : '>'}${num(v, v.side === 'below' ? v.high : v.low)} ${v.unit}`;
  return `${v.kind === 'minimum' ? 'about' : 'average'} ${num(v, v.typical)} ${v.unit}`;
}
const KIND = { range: 'Reference range', threshold: 'Threshold (shaded side: the condition)', typical: 'Typical value', minimum: 'Minimum' };

/* ---------- Where the marker sits: a fixed place per direction, on an axis with no numbers ---------- */
// x runs 20..380. Positions only say "inside", "past the line" or "moved this way": the sources give
// directions, not amounts.
function place(v, dir, cross) {
  if (v.kind === 'range') return { none: 200, up: 252, down: 148 }[dir];
  if (v.kind === 'threshold') {
    const below = v.side === 'below';
    if (cross) return below ? 104 : 296;
    return (below ? 282 : 118) + ({ none: 0, up: 42, down: -42 }[dir]);
  }
  if (v.kind === 'typical') return { none: 200, up: 262, down: 138 }[dir];
  return { none: 246, up: 306, down: 178 }[dir];        // minimum: baseline sits above the minimum
}
const baselineOf = v => data.states.find(s => s.id === 'baseline')?.shifts[v.id];
function status(v, st, dir, cross, drawn) {
  if (!dir) return 'Marker: not stated in sources';
  if (cross) return `Marker: past the line: ${cross}, as the source names it`;
  if (!drawn) return `${ARROW[dir]}, but no quote places it on this bar, so no marker is drawn`;
  if (st.id === 'baseline') return v.kind === 'threshold' ? `Marker: baseline, on the unshaded side (not ${v.name.toLowerCase()})` : v.kind === 'minimum' ? 'Marker: baseline, above the minimum' : v.kind === 'typical' ? 'Marker: baseline, at the typical value' : 'Marker: baseline, within the reference range';
  if (dir === 'none') return 'Marker: unchanged from baseline';
  return `Marker: ${dir === 'up' ? '↑ higher' : '↓ lower'} than baseline (the source gives a direction, not an amount)`;
}

function bar(v) {
  const g = ['<path class="track" d="M20 30 H380"/>'];
  if (v.kind === 'range') g.push('<rect class="band" x="120" y="18" width="160" height="24"/><path class="limit" d="M120 12 V48 M280 12 V48"/>');
  if (v.kind === 'threshold') g.push(`<rect class="zone" x="${v.side === 'below' ? 20 : 200}" y="18" width="180" height="24"/><path class="line" d="M200 8 V52"/>`);
  if (v.kind === 'typical') g.push('<path class="typical" d="M200 14 V46"/>');
  if (v.kind === 'minimum') g.push('<path class="typical" d="M100 14 V46"/>');
  g.push('<line class="ghost-marker" x1="200" x2="200" y1="10" y2="50"/><path class="move" d=""/><line class="marker" x1="200" x2="200" y1="6" y2="54"/>');
  return `<svg class="gauge cv-gauge" viewBox="0 0 400 60" role="img" focusable="false">${g.join('')}</svg>`;
}
function key(v) {
  const tail = baselineOf(v) ? 'Dashed line: baseline. Blue line: the state chosen.' : 'Blue line: the state chosen, where its source names the condition.';
  if (v.kind === 'range') return `Shaded band: ${reference(v)}. ${tail}`;
  if (v.kind === 'threshold') return `Red line: ${v.wording}; the shaded side is ${v.name.toLowerCase()}. ${tail}`;
  return `Black line: ${v.wording}. ${tail}`;
}

function buildRows() {
  const rows = $('#value-rows');
  for (const v of data.values) {
    const q = SOURCES[v.quote];
    const row = document.createElement('div');
    row.className = 'value-row cv-row';
    row.dataset.cv = v.id;
    row.id = `cv-${v.id}`;
    row.innerHTML = `<div><h3></h3><div class="reading"></div><p class="cv-kind"></p><div class="status" data-status></div><div class="direction" data-direction></div></div>`
      + `<div>${bar(v)}<div class="key"></div><p class="cv-in">In this state:</p><ul class="in-state"></ul></div>`
      + `<details class="citation cv-source"><summary>Source</summary><p class="cv-file"></p><blockquote></blockquote><p class="cv-note"></p><div class="cv-arrow-quotes"></div></details>`;
    row.querySelector('h3').textContent = v.label;
    row.querySelector('.reading').textContent = reference(v);
    row.querySelector('.cv-kind').textContent = `${KIND[v.kind]} · ${v.measure}`;
    row.querySelector('.key').textContent = key(v);
    row.querySelector('.cv-file').textContent = `${q.file} · ${q.section} · [${v.source}]`;
    row.querySelector('blockquote').textContent = q.excerpt;
    const note = row.querySelector('.cv-note');
    if (v.note) note.textContent = v.note; else note.remove();
    const ul = row.querySelector('.in-state');
    for (const st of data.states) {
      const li = document.createElement('li');
      li.dataset.state = st.id;
      const d = st.shifts[v.id], cross = st.cross?.[v.id];
      li.innerHTML = '<b></b> <span></span>';
      li.querySelector('b').textContent = STATES[st.id]?.short || st.label;
      li.querySelector('span').textContent = d ? `${ARROW[d]}${cross ? `, ${cross.toLowerCase()}` : ''}` : 'not stated in sources';
      if (!d) li.classList.add('is-unstated');
      ul.append(li);
    }
    rows.append(row);
  }
}

function updateValues(announce) {
  if (!data) return;
  const st = data.states.find(s => s.id === store.current) || data.states[0];
  const parts = [];
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const dir = st.shifts[v.id], cross = st.cross?.[v.id], placed = !!baselineOf(v);
    const drawn = !!dir && (placed || !!cross);
    const base = place(v, 'none', null), x = drawn ? place(v, dir, cross) : base;
    const marker = row.querySelector('.marker'), move = row.querySelector('.move'), ghost = row.querySelector('.ghost-marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    marker.style.display = drawn ? '' : 'none';
    // The dashed baseline sits exactly where the baseline marker is drawn on this bar.
    ghost.setAttribute('x1', base); ghost.setAttribute('x2', base);
    ghost.style.display = placed ? '' : 'none';
    move.setAttribute('d', drawn && placed && Math.abs(x - base) > 4 ? `M${base} 30 H${x + (x > base ? -8 : 8)} M${x + (x > base ? -16 : 16)} 23 L${x + (x > base ? -8 : 8)} 30 L${x + (x > base ? -16 : 16)} 37` : '');
    const words = status(v, st, dir, cross, drawn);
    row.querySelector('[data-status]').textContent = words;
    const dEl = row.querySelector('[data-direction]');
    dEl.textContent = `In this state (${STATES[st.id].short}): ${dir ? ARROW[dir] : 'not stated in sources'}`;
    dEl.classList.toggle('quiet', !dir || dir === 'none');
    row.querySelector('svg').setAttribute('aria-label', `${v.label}, ${reference(v)}. ${words}.`);
    for (const li of row.querySelectorAll('.in-state li')) li.classList.toggle('is-current', li.dataset.state === st.id);
    const ids = st.quotes?.[v.id] || [];
    row.querySelector('.cv-arrow-quotes').innerHTML = ids.length
      ? `<p class="cv-why-head">Behind the ${esc(STATES[st.id].short)} marker:</p>${ids.map(id => `<blockquote>${esc(SOURCES[id].excerpt)}</blockquote><p class="cv-file">${esc(SOURCES[id].file)} · ${esc(SOURCES[id].section)}</p>`).join('')}`
      : '';
    parts.push(`${v.label} ${dir ? ARROW[dir].slice(2) : 'not stated'}${cross ? `, ${cross.toLowerCase()}` : ''}`);
  }
  $('#cv-state').value = st.id;
  $('#cv-summary').textContent = `${st.label}: ${st.summary}${st.unstatedNote ? ' ' + st.unstatedNote : ''}`;
  $('#cv-where').textContent = `Directions from: ${st.where} [${st.source}]`;
  if (announce) $('#cv-live').textContent = `${st.label}. ${parts.join('; ')}.`;
}

async function loadValues() {
  const sel = $('#cv-state');
  sel.disabled = true;
  try {
    const loaded = await A.loadData('clinical-values');
    if (!Array.isArray(loaded.values) || !Array.isArray(loaded.states)) throw new Error('Invalid reference data');
    // A value whose excerpt is missing is dropped, so no unsourced number can reach the page.
    loaded.values = loaded.values.filter(v => SOURCES[v.quote]?.excerpt);
    loaded.states = loaded.states.filter(s => STATES[s.id]);
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    for (const id of STATE_ORDER) {
      if (!data.states.some(s => s.id === id)) continue;
      const o = document.createElement('option');
      o.value = id; o.textContent = `${STATES[id].label} (${STATES[id].kind})`;
      sel.append(o);
    }
    buildRows();
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    ask = gate($('#cv-gate'), { origin: 'clinical' });
    sel.addEventListener('change', () => { ask.ask(sel.value); if (!ask.pending) sel.value = store.current; });
    store.on((id, prev, origin) => { if (origin !== 'clinical') ask.clear(); updateValues(origin === 'clinical'); });
    sel.disabled = false;
    updateValues(false);
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
}

A.values = { loadValues, updateValues };
})();
