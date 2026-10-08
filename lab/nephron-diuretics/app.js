// The Nephron and Diuretics · The Lab · tabs, Explore freely and Clinical values
import { run, NO_DRUG, DRUGS, P, CAL, MODEL_NOTES } from './model.js';
import { fullScene, vis, el, label } from './nephron.js';
import { ready } from './ref.js';

const STORE_KEY = 'lab.nephron-diuretics.v1';
const $ = id => document.getElementById(id);
const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SLIDERS = [
  { key: 'loop', label: 'Loop diuretic', what: 'Thick ascending limb salt carrier inhibited' },
  { key: 'thiazide', label: 'Thiazide', what: 'Early distal tubule salt carrier inhibited' },
  { key: 'ksp', label: 'Potassium-sparing', what: 'Collecting duct salt channel or its aldosterone signal inhibited' },
  { key: 'ca', label: 'Carbonic anhydrase inhibitor', what: 'Proximal bicarbonate-linked salt uptake inhibited' },
  { key: 'osmotic', label: 'Osmotic diuretic', what: 'Unreabsorbed solute in the tube' },
];
const PRESETS = [
  { id: 'none', label: 'No drug', set: {},
    text: 'The reference nephron, calibrated to the textbook share of sodium each segment takes back (see Clinical values): most goes back in the proximal tubule, a large share in the thick ascending limb, a little in the early distal tubule and collecting duct, and only a sliver reaches the urine. Every other scenario starts from here.' },
  { id: 'loop', label: 'Loop diuretic', set: { loop: 1 },
    text: 'The thick ascending limb normally takes back a large share of the filtered sodium. Inhibited, it sends that sodium on; the early distal tubule and collecting duct catch some, but their uptake saturates, so far more sodium leaves than with any other single drug. The medulla also loses its salt gradient, so urine cannot be concentrated: a large volume of urine close to the strength of plasma.' },
  { id: 'thiazide', label: 'Thiazide', set: { thiazide: 1 },
    text: 'The early distal tubule normally takes back only a small share of the filtered sodium, so inhibiting it adds only a little to what leaves. The medulla keeps its gradient, so urine stays concentrated. A modest, steady effect.' },
  { id: 'ksp', label: 'Potassium-sparing', set: { ksp: 1 },
    text: 'The collecting duct handles only the last few percent of sodium, so the extra sodium lost is small. Its sodium uptake is what drives potassium into the urine, so potassium is kept and plasma potassium rises.' },
  { id: 'ca', label: 'Carbonic anhydrase inhibitor', set: { ca: 1 },
    text: 'Much more sodium leaves the proximal tubule, but the thick ascending limb, sitting downstream with spare capacity, catches most of it. Only a few percent more reach the urine. In the model, plasma bicarbonate is simply lowered to stand for the bicarbonate lost in the urine.' },
  { id: 'osmotic', label: 'Osmotic diuretic', set: { osmotic: 1 },
    text: 'Mannitol is filtered and never taken back. It holds water in the proximal tubule and descending limb, and at the end it needs water to carry it out. Water out rises far more than sodium out.' },
  { id: 'loop-thz', label: 'Loop + thiazide', set: { loop: 1, thiazide: 1 },
    text: 'Sequential blockade: with the loop blocked, the early distal tubule is the main place left to catch the flood of sodium. Blocking it too lets even more through: more than either drug alone, and more potassium is lost.' },
];
const INTRO = 'Each scenario sets the drug sliders. Compare the solid nephron and lines with the dashed outlines of the nephron with no drug.';
// ---------- tabs: Lesson / Clinical values / Explore freely (working before the data loads) ----------
const ltabs = [...document.querySelectorAll('#lesson-tabs [role=tab]')];
const lpanels = ltabs.map(t => $(t.getAttribute('aria-controls')));
function selectTab(tab, focus) {
  ltabs.forEach((t, i) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    lpanels[i].hidden = !on;
  });
  if (focus) tab.focus();
}
ltabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % ltabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + ltabs.length) % ltabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = ltabs.length - 1;
    if (j !== null) { e.preventDefault(); selectTab(ltabs[j], true); }
  });
});

// ---------- state ----------
let drugs = loadSaved();
let cv = null, cvRows = {}, activeState = null, base = null;

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const d = { ...NO_DRUG };
    for (const k of DRUGS) { const v = Number(raw[k]); if (Number.isFinite(v) && v >= 0 && v <= 1) d[k] = v; }
    return d;
  } catch (e) { return { ...NO_DRUG }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(drugs)); } catch (e) { /* storage unavailable */ } }

// ---------- sliders (Explore freely and Clinical values drive the same drugs) ----------
const sliderEls = [];
function buildSliders(boxId, prefix = '') {
  const box = $(boxId);
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    const id = `${prefix}s-${s.key}`;
    wrap.innerHTML = `<div class="slider-top"><label for="${id}">${s.label}<span class="what">${s.what}</span></label>` +
      `<output id="${prefix}o-${s.key}" for="${id}"></output></div>` +
      `<input type="range" id="${id}" min="0" max="100" step="5">` +
      '<div class="range-ends" aria-hidden="true"><span>none</span><span>model\'s strongest</span></div>';
    box.append(wrap);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    sliderEls.push({ input, out, s });
    input.addEventListener('input', () => { activeState = null; setDrugs({ [s.key]: Number(input.value) / 100 }); });
    input.addEventListener('keydown', e => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      activeState = null;
      setDrugs({ [s.key]: Math.min(1, Math.max(0, Number(input.value) / 100 + (e.key === 'PageUp' ? 0.25 : -0.25))) });
    });
  }
}
function syncSliders() {
  for (const { input, out, s } of sliderEls) {
    const pct = Math.round(drugs[s.key] * 100);
    if (Number(input.value) !== pct) input.value = pct;
    out.textContent = pct === 0 ? 'off' : `${pct} %`;
    out.classList.toggle('changed', pct > 0);
    input.setAttribute('aria-valuetext', pct === 0 ? 'off' : `${pct} percent of the model's strongest effect`);
  }
  const match = matchingPreset();
  for (const b of document.querySelectorAll('.preset')) b.setAttribute('aria-pressed', String(!!match && b.dataset.id === match.id));
}
const same = (a, b) => DRUGS.every(k => Math.abs((a[k] || 0) - (b[k] || 0)) < 1e-9);
const matchingPreset = () => PRESETS.find(p => same({ ...NO_DRUG, ...p.set }, drugs));

function updateNote(intro) {
  const el = $('preset-note'), match = matchingPreset();
  if (intro || (match && match.id === 'none' && intro !== false)) { el.textContent = INTRO; return; }
  if (match) { el.innerHTML = `<b>${match.label}.</b> ${match.text}`; return; }
  const on = SLIDERS.filter(s => drugs[s.key] > 0).map(s => `${s.label.toLowerCase()} ${Math.round(drugs[s.key] * 100)} %`);
  el.innerHTML = `<b>Custom mix:</b> ${on.join(', ')}. The dashed outlines show the nephron with no drug.`;
}

function setDrugs(next, note) {
  drugs = { ...drugs, ...next };
  for (const k of DRUGS) drugs[k] = Math.round(Math.min(1, Math.max(0, drugs[k])) * 100) / 100;
  save();
  syncSliders();
  updateNote(note);
  render();
}

function buildPresets() {
  const box = $('preset-buttons');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'preset'; b.dataset.id = p.id; b.textContent = p.label;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { activeState = null; setDrugs({ ...NO_DRUG, ...p.set }, false); });
    box.append(b);
  }
}

// ---------- Explore freely: nephron, chart, numbers, table ----------
const scene = fullScene($('explore-svg'), { ghost: true });

const CH = { w: 360, h: 300, l: 46, r: 12, t: 18, b: 58 };
const STOPS = ['filtered', 'proximal', 'loop down', 'loop up', 'early distal', 'urine'];
const chart = $('chart');
chart.setAttribute('viewBox', `0 0 ${CH.w} ${CH.h}`);
const cx = i => CH.l + i * (CH.w - CH.l - CH.r) / (STOPS.length - 1);
const LOG_MIN = -1, LOG_MAX = 2; // 0.1 % to 100 %
const cy = v => { const lv = Math.log10(Math.max(10 ** LOG_MIN, v)); return CH.t + (LOG_MAX - lv) / (LOG_MAX - LOG_MIN) * (CH.h - CH.t - CH.b); };
(function drawAxes() {
  const g = el('g', { class: 'ch-axes' }, chart);
  for (const v of [0.1, 1, 10, 100]) {
    el('line', { x1: CH.l, x2: CH.w - CH.r, y1: cy(v), y2: cy(v), class: 'ch-grid' }, g);
    label(g, CH.l - 6, cy(v) + 4, `${v} %`, 'ch-tick', 'end');
  }
  STOPS.forEach((s, i) => {
    el('line', { x1: cx(i), x2: cx(i), y1: CH.t, y2: CH.h - CH.b, class: 'ch-grid' }, g);
    const t = label(g, cx(i), CH.h - CH.b + 14, s, 'ch-tick', 'end');
    t.setAttribute('transform', `rotate(-35 ${cx(i)} ${CH.h - CH.b + 14})`);
  });
  label(g, CH.l, CH.h - 4, 'after each stop →', 'ch-axis');
})();
const line = (cls, ghost) => el('polyline', { class: `ch-line ${cls}${ghost ? ' ch-ghost' : ''}` }, chart);
const ghostSalt = line('ch-salt', true), ghostWater = line('ch-water', true);
const liveWater = line('ch-water'), liveSalt = line('ch-salt');
const ptsOf = arr => arr.map((v, i) => `${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
const dots = el('g', {}, chart);

function render() {
  const m = run(drugs);
  scene.set(vis(m));
  scene.setDrugs(drugs);
  liveSalt.setAttribute('points', ptsOf(m.saltLeft));
  liveWater.setAttribute('points', ptsOf(m.waterLeft));
  dots.replaceChildren();
  m.saltLeft.forEach((v, i) => el('circle', { cx: cx(i), cy: cy(v), r: 4, class: 'ch-dot-salt' }, dots));
  m.waterLeft.forEach((v, i) => el('rect', { x: cx(i) - 3.5, y: cy(v) - 3.5, width: 7, height: 7, class: 'ch-dot-water' }, dots));
  const lastS = m.saltOut, lastW = m.waterOut;
  label(dots, CH.w - CH.r - 2, cy(lastS) + (lastS >= lastW ? -9 : 16), `salt ${fmt(lastS, 1)} %`, 'ch-end ch-end-salt', 'end');
  label(dots, CH.w - CH.r - 2, cy(lastW) + (lastS >= lastW ? 16 : -9), `water ${fmt(lastW, 1)} %`, 'ch-end ch-end-water', 'end');

  $('n-salt').textContent = fmt(m.saltOut, 1);
  $('n-water').textContent = fmt(m.waterOut, 1);
  $('n-urine').textContent = fmt(m.urine / 1000, 1);
  $('n-bv').textContent = fmt(m.bv * 100, 1);
  $('n-k').textContent = fmt(m.k, 1);
  $('n-hco3').textContent = fmt(m.hco3, 1);

  const rows = [
    ['Proximal tubule', m.saltIn.pt, m.s.pt, m.waterIn.pt, m.w.pt],
    ['Loop, going down', m.saltIn.desc, m.s.desc, m.waterIn.desc, m.w.desc],
    ['Thick ascending limb', m.saltIn.tal, m.s.tal, m.waterIn.tal, m.w.tal],
    ['Early distal tubule', m.saltIn.dct, m.s.dct, m.waterIn.dct, m.w.dct],
    ['Collecting duct', m.saltIn.cd, m.s.cd, m.waterIn.cd, m.w.cd],
  ];
  $('seg-body').innerHTML = rows.map(([n, ...v]) => `<tr><th scope="row">${n}</th>${v.map(x => `<td>${fmt(x, 1)}</td>`).join('')}</tr>`).join('') +
    `<tr class="out"><th scope="row">Urine</th><td>${fmt(m.saltOut, 1)}</td><td></td><td>${fmt(m.waterOut, 1)}</td><td></td></tr>`;

  $('explore-svg').setAttribute('aria-label', `Model nephron. Sodium taken back: proximal tubule ${fmt(m.s.pt, 1)} %, thick ascending limb ${fmt(m.s.tal, 1)} %, early distal tubule ${fmt(m.s.dct, 1)} %, collecting duct ${fmt(m.s.cd, 1)} % of the filtered amount. In the urine: sodium ${fmt(m.saltOut, 1)} % and water ${fmt(m.waterOut, 1)} % of the filtered amount. Blood volume index ${fmt(m.bv * 100, 1)}. Dashed outlines show the nephron with no drug.`);
  chart.setAttribute('aria-label', `Chart of salt and water left in the tube after each stop, on a log scale. Salt: ${m.saltLeft.map(v => fmt(v, 1)).join(', ')} %. Water: ${m.waterLeft.map(v => fmt(v, 1)).join(', ')} %. Stops: ${STOPS.join(', ')}.`);
  announce(m);
  renderClinical(m);
}

// The guided lesson has no numbers on it, so the model only speaks up on the tabs that show it.
let announceTimer = 0;
function announce(m) {
  clearTimeout(announceTimer);
  if (!$('lpanel-lesson').hidden) return;
  announceTimer = setTimeout(() => {
    $('announcer').textContent = `Sodium in urine ${fmt(m.saltOut, 1)} percent of filtered, water ${fmt(m.waterOut, 1)} percent, urine ${fmt(m.urine / 1000, 1)} litres a day, potassium ${fmt(m.k, 1)}, bicarbonate ${fmt(m.hco3, 1)}.`;
  }, 400);
}

// ---------- Clinical values ----------
// Every reference number lives in clinical-values.json; this code only draws it.
const SHIFT = {
  up: { sym: '↑', word: 'rises' }, down: { sym: '↓', word: 'falls' },
  none: { sym: '→', word: 'little change' }, variable: { sym: '↕', word: 'depends on context' },
};
const shortSource = id => {
  const full = (cv && cv.sources[id]) || id;
  if (/costanzo/i.test(full)) return 'Costanzo, Physiology, 6th ed.';
  if (/guyton/i.test(full)) return 'Guyton & Hall, 13th ed.';
  return full.split('.')[0];
};
// Print values as precisely as their source does (percent shares get one decimal for the model).
const places = x => x === null ? 0 : (String(x).split('.')[1] || '').length;
const decimals = v => /%/.test(v.unit) ? 1 : Math.max(places(v.low), places(v.high), places(v.typical));
function modelValue(key, m) {
  if (!m || !key) return null;
  return {
    urine: m.urine, pt_na: m.s.pt, tal_na: m.s.tal, dct_na: m.s.dct, cd_na: m.s.cd,
    fena: m.saltOut, k: m.k, hco3: m.hco3,
  }[key] ?? null;
}
function niceCeil(x) {
  const mag = 10 ** Math.floor(Math.log10(x));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * mag).find(s => s >= x - 1e-9);
}
function niceFloor(x) {
  if (x <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(x));
  return [10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1].map(k => k * mag).find(s => s <= x + 1e-9);
}
const hasBand = v => v.low !== null && v.high !== null;
const upperOnly = v => v.low === null && v.high !== null;

function axisFor(v, cur, bas) {
  let lo = 0, hi;
  if (hasBand(v)) { const span = v.high - v.low; lo = Math.max(0, v.low - 1.5 * span); hi = v.high + 1.5 * span; }
  else hi = (upperOnly(v) ? v.high : v.typical) * 2.5;
  if (/%/.test(v.unit)) hi = Math.min(100, hi);
  for (const x of [cur, bas]) if (x !== null) { if (x > hi) hi = x * 1.05; if (x < lo) lo = x * 0.95; }
  return [niceFloor(lo), niceCeil(hi)];
}


function buildClinical() {
  const list = $('cv-list');
  list.innerHTML = '';
  cvRows = {};
  for (const v of cv.values) {
    const li = document.createElement('li');
    li.className = 'cv-row';
    li.dataset.cv = v.id;
    const d = decimals(v);
    const ref = hasBand(v) ? `Typical ${fmt(v.low, d)}–${fmt(v.high, d)} ${v.unit}${v.typical !== null ? ` (normal value ${fmt(v.typical, d)})` : ''}`
      : upperOnly(v) ? `Typical: less than ${fmt(v.high)} ${v.unit}` : `Typical about ${fmt(v.typical)} ${v.unit}`;
    li.innerHTML =
      `<div class="cv-name"><b>${esc(v.label)}</b><span class="cv-ref">${esc(ref)}</span></div>` +
      '<div class="cv-bar" aria-hidden="true"><span class="cv-track"></span>' +
        (hasBand(v) || upperOnly(v) ? '<span class="cv-band"></span>' : '') +
        (v.typical !== null ? '<span class="cv-typ"></span>' : '') +
        '<span class="cv-base"></span><span class="cv-dot"></span>' +
        '<span class="cv-axis"><span class="cv-lo"></span><span class="cv-hi"></span></span></div>' +
      `<div class="cv-now"><span class="cv-num">–</span><small>${esc(v.unit)}</small><span class="cv-flag"></span></div>` +
      '<div class="cv-shift" hidden></div>' +
      `<p class="cv-cite">${esc(shortSource(v.source))}, ${esc(v.where)}.${v.note ? ` <span>${esc(v.note)}</span>` : ''}</p>`;
    list.append(li);
    const q = s => li.querySelector(s);
    cvRows[v.id] = { v, li, band: q('.cv-band'), typ: q('.cv-typ'), base: q('.cv-base'), dot: q('.cv-dot'),
      lo: q('.cv-lo'), hi: q('.cv-hi'), num: q('.cv-num'), flag: q('.cv-flag'), shift: q('.cv-shift') };
  }

  const states = $('cv-states');
  states.innerHTML = '';
  const mk = (id, label, kind) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cv-state'; b.dataset.state = id;
    b.innerHTML = `<small>${kind ? 'Drug' : 'Reference'}</small>${esc(label)}`;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => applyState(id));
    states.append(b);
  };
  mk('', 'No drug (model baseline)');
  for (const st of cv.states) mk(st.id, st.label, st.kind);

  $('cv-sources').innerHTML = Object.values(cv.sources).map(full => `<li>${esc(full)}</li>`).join('');

  // Say plainly where the teaching model's own baseline differs from the reference values.
  const gaps = cv.values.map(v => {
    const x = modelValue(v.modelKey, base), d = decimals(v);
    if (x === null) return null;
    if (hasBand(v) && (x < v.low || x > v.high)) return { band: true, text: `${esc(v.label)}: model ${fmt(x, d)} ${esc(v.unit)}, outside the typical ${fmt(v.low, d)}–${fmt(v.high, d)}` };
    if (upperOnly(v) && x >= v.high) return { band: true, text: `${esc(v.label)}: model ${fmt(x, d)} ${esc(v.unit)}, not below the typical upper limit` };
    if (!hasBand(v) && !upperOnly(v) && Math.abs(+x.toFixed(d) - v.typical) >= 10 ** -d / 2) return { band: false, text: `${esc(v.label)}: model ${fmt(x, d)} against a typical ${fmt(v.typical)} ${esc(v.unit)}` };
    return null;
  }).filter(Boolean);
  const outside = gaps.filter(g => g.band), single = gaps.filter(g => !g.band);
  $('cv-baseline').innerHTML =
    (outside.length ? `<b>With no drug, the teaching model sits outside some typical ranges:</b> ${outside.map(g => g.text).join('; ')}.`
      : '<b>With no drug, the teaching model sits inside every typical range shown.</b>') +
    (single.length ? ` Where the source gives a single typical value, the model differs slightly: ${single.map(g => g.text).join('; ')}.` : '');
}

function applyState(id) {
  activeState = (cv && cv.states.find(s => s.id === id)) || null;
  setDrugs({ ...NO_DRUG, ...(activeState ? activeState.model : {}) }, false);
}

function renderStateNote() {
  if (!cv) return;
  const st = activeState;
  const stateMatches = s => same({ ...NO_DRUG, ...(s ? s.model : {}) }, drugs);
  for (const b of document.querySelectorAll('.cv-state')) {
    const on = st ? b.dataset.state === st.id && stateMatches(st) : b.dataset.state === '' && stateMatches(null);
    b.setAttribute('aria-pressed', String(on));
  }
  const note = $('cv-state-note');
  if (!st || !stateMatches(st)) {
    note.innerHTML = stateMatches(null)
      ? '<p>No drug: the model\'s baseline. The hollow circles mark where it sits on each bar.</p>'
      : '<p>Custom mix. Pick a drug to see the expected direction of each value.</p>';
    return;
  }
  note.innerHTML = `<p><b>${esc(st.label)}.</b> ${esc(st.summary)}</p>` +
    (st.context ? `<p class="cv-context"><b>Assumes:</b> ${esc(st.context)}</p>` : '') +
    `<p class="cv-model-note"><b>In the model:</b> ${esc(MODEL_NOTES[Object.keys(st.model)[0]] || '')}</p>` +
    `<p class="cv-cite">${esc(shortSource(st.source))}, ${esc(st.where)}.</p>`;
}

function renderClinical(m) {
  if (!cv) return;
  renderStateNote();
  const st = activeState && same({ ...NO_DRUG, ...activeState.model }, drugs) ? activeState : null;
  for (const { v, band, typ, base: baseEl, dot, lo, hi, num, flag, shift, li } of Object.values(cvRows)) {
    const cur = modelValue(v.modelKey, m), bas = modelValue(v.modelKey, base);
    const [a, b] = axisFor(v, cur, bas);
    const d = decimals(v);
    const pct = x => `${Math.min(100, Math.max(0, (x - a) / (b - a) * 100))}%`;
    if (band && hasBand(v)) { band.style.left = pct(v.low); band.style.width = `calc(${pct(v.high)} - ${pct(v.low)})`; }
    if (band && upperOnly(v)) { band.style.left = pct(a); band.style.width = `calc(${pct(v.high)} - ${pct(a)})`; }
    if (typ) typ.style.left = pct(v.typical);
    baseEl.style.left = pct(bas ?? a); baseEl.hidden = bas === null;
    lo.textContent = fmt(a, b - a < 20 ? 1 : 0); hi.textContent = fmt(b, b - a < 20 ? 1 : 0);
    if (cur === null) { num.textContent = '–'; flag.textContent = 'not in the model'; dot.hidden = true; continue; }
    dot.hidden = false;
    dot.style.left = pct(cur);
    let where, out = false, shown = d;
    if (hasBand(v) || upperOnly(v)) {
      if (hasBand(v) && cur < v.low) { where = 'below typical range'; out = true; }
      // "Less than" limits are strict: exactly at the limit is already outside.
      else if (hasBand(v) ? cur > v.high : cur >= v.high) { where = 'above typical range'; out = true; }
      else where = 'within typical range';
      // If rounding would hide which side of a bound the value is on, print one more decimal.
      const inside = x => (!hasBand(v) || x >= v.low) && (hasBand(v) ? x <= v.high : x < v.high);
      while (out && shown < d + 3 && inside(+cur.toFixed(shown))) shown++;
      num.textContent = fmt(cur, shown);
    } else {
      num.textContent = fmt(cur, d);
      const diff = +cur.toFixed(d) - v.typical;
      where = Math.abs(diff) < 10 ** -d / 2 ? 'at typical value' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), d)} vs typical`;
    }
    flag.textContent = where;
    li.classList.toggle('out', out);

    if (!st) { shift.hidden = true; continue; }
    const dir = st.shifts[v.id];
    shift.hidden = false;
    const exp = dir ? SHIFT[dir] : null;
    // Same rule as the lesson's direction record: a 2 % relative change, independent of display precision.
    const delta = cur - bas, tol = Math.max(Math.abs(bas) * 0.02, 1e-6);
    const mdl = Math.abs(delta) < tol ? SHIFT.none : delta > 0 ? SHIFT.up : SHIFT.down;
    const judged = dir && dir !== 'variable';
    const differs = judged && mdl !== SHIFT[dir];
    shift.innerHTML = `<span class="cv-exp dir-${dir || 'none'}"><b aria-hidden="true">${exp ? exp.sym : '·'}</b> Expected: ${exp ? exp.word : 'not listed in the source'}</span>` +
      `<span class="cv-model${judged ? (differs ? ' differ' : ' agree') : ''}"><b aria-hidden="true">${mdl.sym}</b> Model ${mdl.word}` +
      `${mdl === SHIFT.none ? '' : ` (${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta), d)})`}${differs ? ' · differs' : ''}</span>`;
  }
}

// ---------- About the model: written from the calibrated constants, so it always matches ----------
function describeModel() {
  const n = (x, d = 3) => String(+x.toFixed(d));
  $('eq').textContent = [
    `Proximal:    Na_pt  = 100 · ${n(CAL.ptFrac)} · (1 − ${P.caBlock}·CA) · (1 − ${P.osmPt}·Osm)`,
    `             W_pt   = Na_pt · (1 − ${P.osmPtWater}·Osm)`,
    `Gradient:    g      = (1 − ${P.gradLoop}·Loop) · (1 − ${P.gradOsm}·Osm)`,
    `Loop down:   W_d    = W_in · ${P.descFrac} · g · (1 − ${P.osmDesc}·Osm)`,
    `Loop up:     Na_tal = Na_in · ${n(CAL.talFrac)} · (1 − ${P.loopBlock}·Loop)`,
    `Distal:      Na_dct = ${n(CAL.dctMax)}·(1 − ${P.thzBlock}·Thz) · Na_in / (${n(CAL.dctHalf)} + Na_in)`,
    `Collecting:  Na_cd  = ${n(CAL.cdMax)}·(1 − ${P.kspBlock}·Ksp) · Na_in / (${n(CAL.cdHalf)} + Na_in)`,
    `Urine water: W_out  = min(W_in, (${P.saltOsm}·Na_out + ${P.otherOsm} + ${P.mannitolOsm}·Osm) / (1 + ${P.concGain}·g))`,
    `Urine:       ${fmt(CAL.urine)} mL/day × W_out / W_out(no drug)`,
  ].join('\n');
  $('about-cal').textContent = `The proximal and thick ascending limb fractions and the distal and collecting duct constants are calculated from the textbook share of sodium each segment takes back, in clinical-values.json; the collecting duct is set so that, with no drug, half of the source's "less than ${fmt(cv.values.find(v => v.id === 'fena').high)} %" upper limit is excreted. Urine output is scaled to the typical daily value in the same file.`;
  $('about-k').innerHTML = `<b>Potassium</b>: secretion is driven by sodium and flow reaching the collecting duct and cut by inhibiting aldosterone's channel; plasma potassium settles at ${fmt(CAL.kBase, 1)} · drive<sup>−${P.kExp}</sup>, where ${fmt(CAL.kBase, 1)} is the textbook normal value.`;
  $('about-hco3').innerHTML = `<b>Bicarbonate</b> starts at the textbook normal value (${fmt(CAL.hco3Base)}), falls with carbonic anhydrase inhibition and dips a little with potassium-sparing drugs. It rises with volume loss as a crude stand-in for contraction alkalosis, which in the body is driven by angiotensin II and aldosterone, hormones the model leaves out.`;
}

// ---------- wiring (after the reference data has calibrated the model) ----------
try {
  cv = await ready;
} catch (e) {
  $('cv-list').innerHTML = '<li class="cv-loading">The reference values could not be loaded. Reload the page to try again.</li>';
}
if (cv) {
  base = run(NO_DRUG);
  scene.setGhost(vis(base));
  ghostSalt.setAttribute('points', ptsOf(base.saltLeft));
  ghostWater.setAttribute('points', ptsOf(base.waterLeft));
  $('cv-disclaimer').textContent = cv.disclaimer;
  describeModel();
  buildPresets();
  buildSliders('sliders');
  buildSliders('cv-sliders', 'cv-');
  buildClinical();
  syncSliders();
  updateNote();
  $('btn-reset').addEventListener('click', () => { activeState = null; setDrugs({ ...NO_DRUG }, true); });
  render();
}
