// Pressure–Volume Loop · The Lab
import { Simulator, DEFAULTS, DT, espvr, edpvr } from './model.js';

const STORE_KEY = 'lab.pressure-volume-loop.v1';
const TRAIL = 6;
const COL = {
  ink: '#171916', soft: '#4b4f47', grid: '#e4e6df', axis: '#babeb3', white: '#ffffff',
  loop: '#b3261e', es: '#8a5300', ed: '#00707f', ea: '#5d6158', ghost: '#9a9e94', ao: '#254dff',
};
const FONT = '"Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';

const SLIDERS = [
  { key: 'Pla', label: 'Preload', what: 'Left atrial pressure, Pla', unit: 'mmHg', min: 2, max: 25, step: 1, big: 5, d: 0 },
  { key: 'Rs', label: 'Afterload', what: 'Systemic resistance, Rs', unit: 'mmHg·s/mL', min: 0.4, max: 2.5, step: 0.05, big: 0.25, d: 2 },
  { key: 'Ees', label: 'Contractility', what: 'End-systolic elastance, Ees', unit: 'mmHg/mL', min: 0.8, max: 5, step: 0.1, big: 0.5, d: 1 },
  { key: 'lam', label: 'Diastolic stiffness', what: 'EDPVR exponent, λ', unit: '/mL', min: 0.015, max: 0.06, step: 0.001, big: 0.005, d: 3 },
  { key: 'C', label: 'Arterial compliance', what: 'Windkessel compliance, C', unit: 'mL/mmHg', min: 0.5, max: 3, step: 0.05, big: 0.25, d: 2 },
  { key: 'HR', label: 'Heart rate', what: 'Beats per minute', unit: 'bpm', min: 40, max: 180, step: 1, big: 10, d: 0 },
];
const SPOKEN_UNIT = { 'mmHg': 'millimetres of mercury', 'mmHg·s/mL': 'mmHg seconds per millilitre', 'mmHg/mL': 'mmHg per millilitre', '/mL': 'per millilitre', 'mL/mmHg': 'millilitres per mmHg', 'bpm': 'beats per minute' };

const BASE = { Pla: DEFAULTS.Pla, Rs: DEFAULTS.Rs, Ees: DEFAULTS.Ees, lam: DEFAULTS.lam, C: DEFAULTS.C, HR: DEFAULTS.HR };
const PRESETS = [
  { id: 'baseline', label: 'Baseline', set: {},
    text: 'The reference ventricle: atrial pressure 10 mmHg, moderate resistance and contractility, 75 beats per minute. Every other scenario changes one setting from here, so you can compare against this loop.' },
  { id: 'preload', label: '↑ Preload (Frank–Starling)', set: { Pla: 18 },
    text: 'Atrial pressure rises from 10 to 18 mmHg, so the ventricle fills further along its EDPVR before the mitral valve closes. The bigger end-diastolic volume ejects a bigger stroke volume, and the end-systolic corner slides up the same ESPVR line.' },
  { id: 'afterload', label: '↑ Afterload', set: { Rs: 2.0 },
    text: 'Arterial resistance doubles, so aortic pressure stays higher and the aortic valve opens later in the beat. The ventricle stops ejecting at a higher pressure and a larger end-systolic volume, so stroke volume falls and the Ea line steepens.' },
  { id: 'contractility', label: '↑ Contractility', set: { Ees: 4.0 },
    text: 'The ESPVR gets steeper: at any volume, the fully activated ventricle can generate more pressure. With the same filling, ejection continues to a smaller end-systolic volume, so stroke volume and ejection fraction rise.' },
  { id: 'stiff', label: 'Stiff ventricle (↑λ)', set: { lam: 0.05 },
    text: 'The EDPVR curves upward sooner, so the same atrial pressure fills the ventricle to a smaller volume. The loop shifts left and narrows even though contractility has not changed.' },
  { id: 'tachy', label: 'Tachycardia (HR 160)', set: { HR: 160 },
    text: 'Each cycle now lasts 0.375 s, and beats arrive before the arteries have drained, so aortic pressure climbs. Ejection stops at a larger volume and stroke volume falls, while output per minute still rises in this model.' },
];
const INTRO = 'Each scenario changes one setting from baseline. Watch the loop move to its new shape, then compare it with the dashed ghost of where it was.';
const EVENT_NAME = { MC: 'Mitral closes', AO: 'Aortic opens', AC: 'Aortic closes', MO: 'Mitral opens' };

const $ = id => document.getElementById(id);
const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 899px)');

// ---------- state ----------
const saved = loadSaved();
let params = { ...BASE, ...saved.params };
const view = { curves: true, ea: true, ghost: true, sound: false, ...saved.view, sound: false };
const sim = new Simulator({ ...DEFAULTS, ...params });
let trail = [];
let ghost = null, lastSettled = null, isSettled = false;
let beatsSinceChange = 0, settledAfter = 0;
let paused = false, speed = 1, simDebt = 0, lastFrame = 0, needsDraw = true;
let scale = { V: 160, P: 140 };
let mvWasOpen = false, avWasOpen = false;
let audio = null;

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const p = {};
    for (const s of SLIDERS) {
      const v = Number(raw.params && raw.params[s.key]);
      if (Number.isFinite(v) && v >= s.min && v <= s.max) p[s.key] = v;
    }
    const v = {};
    for (const k of ['curves', 'ea', 'ghost']) if (raw.view && typeof raw.view[k] === 'boolean') v[k] = raw.view[k];
    return { params: p, view: v };
  } catch (e) { return { params: {}, view: {} }; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ params, view: { curves: view.curves, ea: view.ea, ghost: view.ghost } })); } catch (e) { /* storage unavailable */ }
}

// ---------- controls ----------
const sliderEls = {};
function buildSliders() {
  const box = $('sliders');
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    wrap.innerHTML = `<div class="slider-top"><label for="s-${s.key}">${s.label}<span class="what">${s.what}</span></label>` +
      `<output id="o-${s.key}" for="s-${s.key}"></output></div>` +
      `<input type="range" id="s-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">` +
      `<div class="range-ends" aria-hidden="true"><span>${fmt(s.min, s.d)}</span><span>${fmt(s.max, s.d)}</span></div>`;
    box.append(wrap);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    sliderEls[s.key] = { input, out, s };
    input.addEventListener('input', () => setParams({ [s.key]: snap(s, Number(input.value)) }));
    input.addEventListener('keydown', e => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      const v = snap(s, Number(input.value) + (e.key === 'PageUp' ? s.big : -s.big));
      setParams({ [s.key]: v });
    });
  }
}
function snap(s, v) {
  const k = Math.round((v - s.min) / s.step);
  return Math.min(s.max, Math.max(s.min, +(s.min + k * s.step).toFixed(6)));
}
function syncSliders() {
  for (const { input, out, s } of Object.values(sliderEls)) {
    const v = params[s.key];
    if (Number(input.value) !== v) input.value = v;
    out.innerHTML = `${fmt(v, s.d)}<small>${s.unit}</small>`;
    out.classList.toggle('changed', Math.abs(v - BASE[s.key]) > 1e-9);
    input.setAttribute('aria-valuetext', `${fmt(v, s.d)} ${SPOKEN_UNIT[s.unit] || s.unit}`);
  }
  const match = matchingPreset();
  for (const b of document.querySelectorAll('.preset')) b.setAttribute('aria-pressed', String(!!match && b.dataset.id === match.id));
}
function matchingPreset() {
  return PRESETS.find(p => SLIDERS.every(s => Math.abs((p.set[s.key] ?? BASE[s.key]) - params[s.key]) < 1e-9));
}

// The explanation always describes the current settings: a preset's text only while
// the sliders match that preset, otherwise a plain list of what differs from baseline.
function updateNote(intro) {
  const el = $('preset-note');
  const match = matchingPreset();
  if (intro || (match && match.id === 'baseline' && intro !== false)) { el.textContent = INTRO; return; }
  if (match) { el.innerHTML = `<b>${match.label}.</b> ${match.text}`; return; }
  const diffs = SLIDERS.filter(s => Math.abs(params[s.key] - BASE[s.key]) > 1e-9)
    .map(s => `${s.label.toLowerCase()} ${fmt(params[s.key], s.d)} ${s.unit} (baseline ${fmt(BASE[s.key], s.d)})`);
  el.innerHTML = `<b>Custom settings:</b> ${diffs.join(', ')}. The dashed ghost shows the last settled loop before your change.`;
}

// note: true shows the intro, false forces the preset/custom description, undefined derives it.
function setParams(next, note) {
  const merged = { ...params, ...next };
  if (SLIDERS.every(s => merged[s.key] === params[s.key])) { syncSliders(); updateNote(note); return; }
  if (isSettled && lastSettled) ghost = lastSettled;
  isSettled = false;
  beatsSinceChange = 0;
  params = merged;
  sim.setParams(params);
  syncSliders();
  save();
  updateNote(note);
  updateStatus();
  rescale();
  needsDraw = true;
}

function buildPresets() {
  const box = $('preset-buttons');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'preset'; b.dataset.id = p.id; b.textContent = p.label;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => setParams({ ...BASE, ...p.set }, false));
    box.append(b);
  }
}

// ---------- simulation driving ----------
function safeStep() {
  try { return sim.step(); }
  catch (e) {
    params = { ...BASE };
    sim.setParams({ ...DEFAULTS });
    sim.reset();
    trail = []; ghost = null; lastSettled = null; isSettled = false; beatsSinceChange = 0;
    syncSliders(); save(); updateNote(true);
    needsDraw = true;
    const n = $('notice');
    n.textContent = 'The model reached an unstable state, so it was reset to the baseline settings.';
    n.hidden = false;
    setTimeout(() => { n.hidden = true; }, 6000);
    return null;
  }
}

function onBeat(b) {
  trail.push(b);
  if (trail.length > TRAIL) trail.shift();
  beatsSinceChange++;
  if (b.settled) {
    lastSettled = b;
    if (!isSettled) {
      isSettled = true;
      settledAfter = beatsSinceChange;
      announce(b);
    }
  }
  rescale();
  renderNumbers(b);
}

function advance(seconds, live) {
  simDebt += seconds;
  const steps = Math.floor(simDebt / DT + 1e-9);
  simDebt -= steps * DT;
  for (let i = 0; i < steps; i++) {
    const b = safeStep();
    if (b) onBeat(b);
    if (live) heartSounds();
  }
}

function stepOneBeat() {
  setPaused(true);
  simDebt = 0;
  for (let i = 0; i < 1e6; i++) { const b = safeStep(); if (b) { onBeat(b); break; } }
}

function jumpToSteady() {
  simDebt = 0;
  for (let k = 0; k < 300 && !isSettled; k++) {
    for (let i = 0; i < 1e6; i++) { const b = safeStep(); if (b) { onBeat(b); break; } }
  }
  // Finish on a whole beat so the loop and Wiggers trace show a complete cycle.
  if (sim.cur.n > 2) for (let i = 0; i < 1e6; i++) { const b = safeStep(); if (b) { onBeat(b); break; } }
}

function setPaused(p) {
  paused = p;
  const btn = $('btn-pause');
  btn.setAttribute('aria-pressed', String(p));
  btn.textContent = p ? 'Play' : 'Pause';
  updateStatus();
}

// ---------- sound ----------
function ensureAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
  const activated = navigator.userActivation ? navigator.userActivation.isActive : true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (activated && AC) audio = new AC();
}
function tone(freq, dur, vol, type) {
  const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function heartSounds() {
  const mv = sim.Qmv > 0, av = sim.Qav > 0;
  if (view.sound && audio && audio.state === 'running') {
    if (mvWasOpen && !mv) { tone(70, 0.13, 0.7, 'triangle'); tone(140, 0.08, 0.2, 'sine'); }
    if (avWasOpen && !av) tone(160, 0.06, 0.5, 'triangle');
  }
  mvWasOpen = mv; avWasOpen = av;
}

// ---------- numbers, table, announcements ----------
function renderNumbers(b) {
  $('n-edv').textContent = fmt(b.EDV, 1);
  $('n-esv').textContent = fmt(b.ESV, 1);
  $('n-sv').textContent = b.ejected ? fmt(b.SV, 1) : '0';
  $('n-ef').textContent = b.ejected ? fmt(b.EF * 100, 0) : '0';
  $('n-co').textContent = b.ejected ? fmt(b.CO, 2) : '0';
  $('n-sw').textContent = fmt(b.SW, 0);
  $('n-pao').textContent = `${fmt(b.PaoSys, 0)}/${fmt(b.PaoDia, 0)}`;
  updateStatus();

  const ev = Object.fromEntries(b.events.map(e => [e.kind, e]));
  const ms = k => ev[k] ? `${k} ${fmt(ev[k].t * 1000, 0)}` : null;
  const rows = [
    ['Beat', `no. ${b.no}`],
    ['Heart rate · cycle', `${fmt(b.HR, 0)} bpm · ${fmt(b.T, 3)} s`],
    ['End-diastolic volume', `${fmt(b.EDV, 1)} mL`],
    ['End-systolic volume', `${fmt(b.ESV, 1)} mL`],
    ['Stroke volume', b.ejected ? `${fmt(b.SV, 1)} mL` : 'No ejection this beat'],
    ['Ejection fraction', b.ejected ? `${fmt(b.EF * 100, 1)} %` : '0 %'],
    ['Cardiac output', b.ejected ? `${fmt(b.CO, 2)} L/min` : '0 L/min'],
    ['Stroke work', `${fmt(b.SW, 0)} mmHg·mL`],
    ['End-systolic pressure', `${fmt(b.ESP, 1)} mmHg`],
    ['Peak LV pressure', `${fmt(b.PlvMax, 1)} mmHg`],
    ['Aortic max / min', `${fmt(b.PaoSys, 1)} / ${fmt(b.PaoDia, 1)} mmHg`],
    ['Arterial elastance Ea', b.Ea !== null ? `${fmt(b.Ea, 2)} mmHg/mL` : '– (no ejection)'],
    ['Valve events (ms)', ['MC', 'AO', 'AC', 'MO'].map(ms).filter(Boolean).join(' · ')],
  ];
  $('beat-body').innerHTML = rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');

  const massPct = b.massError * 100;
  const ccw = b.signedArea > 0;
  const checks = [
    ['Mitral in vs aortic out', `${fmt(b.intQmv, 2)} / ${fmt(b.intQav, 2)} mL`, `<span class="${massPct < 1 ? 'ok' : 'off'}" id="c-mass">${fmt(massPct, 2)} % apart</span>`],
    ['End-systolic point to ESPVR', b.espvrGap < 5 ? '' : 'Ejection outlasted peak activation, so the valve shut on a relaxing ventricle (see About the model)', `<span class="${b.espvrGap < 5 ? 'ok' : 'off'}" id="c-espvr">${fmt(b.espvrGap, 2)} mmHg</span>`],
    ['ΔV with both valves shut', '', `<span class="${b.isoDV < 0.5 ? 'ok' : 'off'}" id="c-iso">${fmt(b.isoDV, 3)} mL</span>`],
    ['Loop direction', '', `<span class="${ccw ? 'ok' : 'off'}" id="c-dir">${ccw ? 'counter-clockwise' : 'clockwise'}</span>`],
    ['Corner order', '', `<span id="c-order">${b.events.map(e => e.kind).join(' → ')}</span>`],
  ];
  $('check-body').innerHTML = checks.map(([k, a, v]) => `<tr><th scope="row">${k}${a ? `<br><small>${a}</small>` : ''}</th><td>${v}</td></tr>`).join('');

  $('pv').setAttribute('aria-label', `Pressure–volume loop for beat ${b.no}. The loop runs counter-clockwise: filling along the bottom from ${fmt(b.ESV, 0)} to ${fmt(b.EDV, 0)} mL, isovolumic contraction up the right side, ejection across the top to an end-systolic point of ${fmt(b.ESV, 0)} mL at ${fmt(b.ESP, 0)} mmHg, then isovolumic relaxation down the left side. Stroke work ${fmt(b.SW, 0)} mmHg·mL. Full values are in the table below.`);
  const ev2 = k => ev[k] ? `${fmt(ev[k].t * 1000, 0)} ms` : 'not reached';
  $('wiggers').setAttribute('aria-label', `Wiggers diagram over one ${fmt(b.T, 2)} s cycle. LV pressure peaks at ${fmt(b.PlvMax, 0)} mmHg; aortic pressure swings between ${fmt(b.PaoSys, 0)} and ${fmt(b.PaoDia, 0)} mmHg; atrial pressure is fixed at ${fmt(b.Pla, 0)} mmHg; LV volume falls from ${fmt(b.EDV, 0)} to ${fmt(b.ESV, 0)} mL. Mitral closes at ${ev2('MC')}, aortic opens at ${ev2('AO')}, aortic closes at ${ev2('AC')}, mitral opens at ${ev2('MO')}.`);
}

function updateStatus() {
  const el = $('n-status'), b = trail[trail.length - 1];
  let txt;
  if (b && !b.ejected) txt = 'No ejection this beat';
  else if (isSettled) txt = `Settled after ${settledAfter} beat${settledAfter === 1 ? '' : 's'}`;
  else txt = beatsSinceChange ? `Settling · beat ${beatsSinceChange}` : 'Settling';
  if (paused) txt += ' · paused';
  el.textContent = txt;
  el.classList.toggle('settled', isSettled && !!b && b.ejected);
}

function announce(b) {
  const msg = b.ejected
    ? `Loop settled. Stroke volume ${fmt(b.SV, 1)} millilitres, ejection fraction ${fmt(b.EF * 100, 0)} percent, cardiac output ${fmt(b.CO, 2)} litres per minute.`
    : 'Loop settled with no ejection: stroke volume is zero.';
  $('announcer').textContent = msg;
}

// ---------- drawing ----------
const canvases = { pv: $('pv'), wiggers: $('wiggers') };
const sizes = { pv: { w: 0, h: 0 }, wiggers: { w: 0, h: 0 } };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (const [k, c] of Object.entries(canvases)) {
    const r = c.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    sizes[k] = { w, h, dpr };
    if (w && h && (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr))) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
  }
  draw();
}

function niceUp(x, step) { return Math.ceil(x / step) * step; }
function rescale(force) {
  let mV = 0, mP = 0;
  const beats = view.ghost && ghost ? [...trail, ghost] : trail;
  for (const b of beats) { mV = Math.max(mV, b.EDV, b.V[0]); mP = Math.max(mP, b.PlvMax, b.PaoSys); }
  const vStep = mV > 260 ? 50 : 20, pStep = mP > 260 ? 50 : 20;
  const tV = Math.max(160, niceUp(mV * 1.15, vStep)), tP = Math.max(140, niceUp(mP * 1.15, pStep));
  // Grow at once; shrink only once the loop has settled, so axes do not jitter mid-transition.
  if (force || tV > scale.V || isSettled) scale.V = tV;
  if (force || tP > scale.P || isSettled) scale.P = tP;
}

function setupCtx(k) {
  const { w, h, dpr } = sizes[k];
  if (!w || !h) return null;
  const ctx = canvases[k].getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return ctx;
}

function text(ctx, s, x, y, color, align = 'left', base = 'middle', size = 12, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function ticks(max, target) {
  const raw = max / target, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

function polyline(ctx, xs, ys, n, X, Y, from = 0, stride = 2) {
  if (n - from < 2) return;
  ctx.beginPath();
  ctx.moveTo(X(xs[from]), Y(ys[from]));
  for (let i = from + stride; i < n; i += stride) ctx.lineTo(X(xs[i]), Y(ys[i]));
  ctx.lineTo(X(xs[n - 1]), Y(ys[n - 1]));
  ctx.stroke();
}

function drawPV() {
  const ctx = setupCtx('pv');
  if (!ctx) return;
  const { w, h } = sizes.pv;
  const small = w < 480;
  const m = { l: small ? 54 : 60, r: 14, t: 14, b: small ? 40 : 46 };
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const X = v => m.l + v / scale.V * pw, Y = p => m.t + ph - p / scale.P * ph;
  const p = sim.p;

  // grid + axes
  ctx.lineWidth = 1;
  ctx.font = `500 ${small ? 11 : 12}px ${FONT}`;
  for (const v of ticks(scale.V, small ? 4 : 8)) {
    ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(X(v) + 0.5, m.t); ctx.lineTo(X(v) + 0.5, m.t + ph); ctx.stroke();
    ctx.fillStyle = COL.soft; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(v), X(v), m.t + ph + 6);
  }
  for (const v of ticks(scale.P, small ? 5 : 7)) {
    ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(m.l, Y(v) + 0.5); ctx.lineTo(m.l + pw, Y(v) + 0.5); ctx.stroke();
    ctx.fillStyle = COL.soft; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), m.l - 6, Y(v));
  }
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ph); ctx.lineTo(m.l + pw, m.t + ph); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('LV volume (mL)', m.l + pw, h - 4);
  ctx.save(); ctx.translate(12, m.t); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('LV pressure (mmHg)', 0, 0); ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();

  // ESPVR and EDPVR envelopes
  if (view.curves) {
    const vTop = Math.min(scale.V, p.V0 + scale.P / p.Ees);
    ctx.strokeStyle = COL.es; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(p.V0), Y(0)); ctx.lineTo(X(vTop), Y(espvr(vTop, p))); ctx.stroke();
    ctx.strokeStyle = COL.ed; ctx.beginPath();
    let lastV = p.V0;
    for (let v = p.V0; v <= scale.V; v += 1) {
      const P = edpvr(v, p);
      if (v === p.V0) ctx.moveTo(X(v), Y(P)); else ctx.lineTo(X(v), Y(P));
      lastV = v;
      if (P > scale.P) break;
    }
    ctx.stroke();
    ctx.restore(); ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    const esLabelV = Math.min(vTop, p.V0 + (scale.P * 0.9) / p.Ees);
    text(ctx, 'ESPVR', X(esLabelV) + 6, Y(espvr(esLabelV, p)) + 2, COL.es, 'left', 'top');
    const edV = Math.min(lastV, scale.V - 1), edP = Math.min(edpvr(edV, p), scale.P * 0.92);
    text(ctx, 'EDPVR', X(edV) - 4, Y(edP) - 2, COL.ed, 'right', 'bottom');
  }

  // ghost loop
  if (view.ghost && ghost) {
    ctx.strokeStyle = COL.ghost; ctx.lineWidth = 1.75; ctx.setLineDash([5, 4]);
    polyline(ctx, ghost.V, ghost.Plv, ghost.n, X, Y);
    ctx.setLineDash([]);
    const gx = ghost.V[ghost.iES], gy = ghost.Plv[ghost.iES];
    text(ctx, 'Before', X(gx) - 6, Y(gy) - 10, COL.soft, 'right', 'bottom', 11);
  }

  const showLive = !reduceMotion.matches;
  const cur = sim.cur;
  // fading trail
  const done = trail.slice();
  done.forEach((b, i) => {
    const newest = i === done.length - 1;
    const alpha = newest && (!showLive || cur.n < 3) ? 1 : 0.12 + 0.5 * (i + 1) / done.length;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COL.loop; ctx.lineWidth = newest ? 2.25 : 1.5;
    polyline(ctx, b.V, b.Plv, b.n, X, Y);
  });
  ctx.globalAlpha = 1;
  if (showLive && cur.n > 1) {
    ctx.strokeStyle = COL.loop; ctx.lineWidth = 2.75;
    polyline(ctx, cur.V, cur.Plv, cur.n, X, Y);
  }

  const ref = done[done.length - 1];
  if (ref) {
    // Ea line
    if (view.ea && ref.ejected && ref.Ea !== null) {
      ctx.strokeStyle = COL.ea; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(X(ref.EDV), Y(0)); ctx.lineTo(X(ref.ESV), Y(ref.ESP)); ctx.stroke();
      ctx.setLineDash([]);
      const f = 0.35, lx = ref.EDV + (ref.ESV - ref.EDV) * f, ly = ref.ESP * f;
      text(ctx, `Ea ${fmt(ref.Ea, 2)}`, X(lx) + 6, Y(ly), COL.ea, 'left', 'middle', 11);
    }
    labelLoop(ctx, ref, X, Y, small);
  }

  // cursor
  if (showLive && cur.n > 0) {
    const cx = X(sim.V), cy = Y(sim.Plv);
    ctx.fillStyle = COL.white; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.loop; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function labelLoop(ctx, b, X, Y, small) {
  const ev = Object.fromEntries(b.events.map(e => [e.kind, e]));
  for (const k of ['MC', 'AO', 'AC', 'MO']) {
    const e = ev[k];
    if (!e) continue;
    const x = X(e.V), y = Y(e.P);
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    const right = k === 'MC' || k === 'AO';
    const label = small ? k : `${k} · ${EVENT_NAME[k]}`;
    const dy = k === 'MC' ? 12 : k === 'AO' ? -10 : k === 'AC' ? -10 : 12;
    text(ctx, label, x + (right ? 8 : -8), y + dy, COL.ink, right ? 'left' : 'right', 'middle', small ? 11 : 12, 700);
  }
  // phase labels
  const phase = (s) => text(ctx, s.t, s.x, s.y, COL.soft, s.a || 'center', s.b || 'middle', small ? 11 : 12, 500);
  if (ev.MC && ev.MO) {
    const fillMid = (b.EDV + b.ESV) / 2;
    phase({ t: 'Filling', x: X(fillMid), y: Y(edpvr(fillMid, b.params)) - 10, b: 'bottom' });
  }
  if (ev.AO && ev.AC) {
    let iTop = ev.AO.i, best = Infinity;
    const vMid = (ev.AO.V + ev.AC.V) / 2;
    for (let i = ev.AO.i; i <= ev.AC.i; i++) { const d = Math.abs(b.V[i] - vMid); if (d < best) { best = d; iTop = i; } }
    phase({ t: 'Ejection', x: X(b.V[iTop]), y: Y(b.Plv[iTop]) - 8, b: 'bottom' });
  }
  if (ev.MC && ev.AO) {
    ctx.save(); ctx.translate(X(ev.MC.V) + 10, (Y(ev.MC.P) + Y(ev.AO.P)) / 2); ctx.rotate(-Math.PI / 2);
    phase({ t: small ? 'Isovol. contraction' : 'Isovolumic contraction', x: 0, y: 0, b: 'top' });
    ctx.restore();
  }
  if (ev.AC && ev.MO) {
    ctx.save(); ctx.translate(X(ev.AC.V) - 10, (Y(ev.AC.P) + Y(ev.MO.P)) / 2); ctx.rotate(-Math.PI / 2);
    phase({ t: small ? 'Isovol. relaxation' : 'Isovolumic relaxation', x: 0, y: 0, b: 'bottom' });
    ctx.restore();
  }
}

function drawWiggers() {
  const ctx = setupCtx('wiggers');
  if (!ctx) return;
  const { w, h } = sizes.wiggers;
  const small = w < 420;
  const m = { l: small ? 48 : 54, r: small ? 48 : 54, t: 26, b: 40 };
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const cur = sim.cur;
  const prev = trail[trail.length - 1];
  const T = cur.T;
  const X = t => m.l + t / T * pw, Y = p => m.t + ph - p / scale.P * ph, YV = v => m.t + ph - v / scale.V * ph;

  ctx.lineWidth = 1;
  ctx.font = `500 11px ${FONT}`;
  for (const t of ticks(T, small ? 4 : 8)) {
    if (t > T) continue;
    ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(X(t) + 0.5, m.t); ctx.lineTo(X(t) + 0.5, m.t + ph); ctx.stroke();
    ctx.fillStyle = COL.soft; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(+t.toFixed(2)), X(t), m.t + ph + 6);
  }
  for (const v of ticks(scale.P, 5)) {
    ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(m.l, Y(v) + 0.5); ctx.lineTo(m.l + pw, Y(v) + 0.5); ctx.stroke();
    ctx.fillStyle = COL.soft; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), m.l - 5, Y(v));
  }
  for (const v of ticks(scale.V, 5)) {
    ctx.fillStyle = COL.soft; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), m.l + pw + 5, YV(v));
  }
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, m.t + ph); ctx.lineTo(m.l + pw, m.t + ph); ctx.lineTo(m.l + pw, m.t); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = `600 12px ${FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center'; ctx.fillText('Time in cycle (s)', m.l + pw / 2, h - 2);
  ctx.save(); ctx.translate(11, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Pressure (mmHg)', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(w - 11, m.t + ph / 2); ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Volume (mL)', 0, 0); ctx.restore();

  const live = !reduceMotion.matches && cur.n > 1;
  const tau = sim.tau;

  ctx.save();
  ctx.beginPath(); ctx.rect(m.l, m.t - 20, pw, ph + 20); ctx.clip();

  // valve event lines (from the last complete beat)
  if (prev) {
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    for (const e of prev.events) {
      if (e.t > T) continue;
      ctx.strokeStyle = COL.ea;
      ctx.beginPath(); ctx.moveTo(Math.round(X(e.t)) + 0.5, m.t); ctx.lineTo(Math.round(X(e.t)) + 0.5, m.t + ph); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Pla
  ctx.strokeStyle = COL.es; ctx.lineWidth = 1.75; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(m.l, Y(sim.p.Pla)); ctx.lineTo(m.l + pw, Y(sim.p.Pla)); ctx.stroke();
  ctx.setLineDash([]);

  const traces = (b, from, n, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.75; ctx.strokeStyle = COL.ink; polyline(ctx, b.t, b.V, n, X, YV, from);
    ctx.lineWidth = 2.25; ctx.strokeStyle = COL.ao; polyline(ctx, b.t, b.Pao, n, X, Y, from);
    ctx.lineWidth = 2.5; ctx.strokeStyle = COL.loop; polyline(ctx, b.t, b.Plv, n, X, Y, from);
    ctx.globalAlpha = 1;
  };
  if (live) {
    if (prev) {
      const gap = tau + T * 0.035;
      let from = 0;
      while (from < prev.n && prev.t[from] < gap) from++;
      if (from < prev.n - 1) traces(prev, from, prev.n, 0.35);
    }
    traces(cur, 0, cur.n, 1);
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(tau), m.t); ctx.lineTo(X(tau), m.t + ph); ctx.stroke();
    ctx.fillStyle = COL.loop; ctx.beginPath(); ctx.arc(X(tau), Y(sim.Plv), 4.5, 0, Math.PI * 2); ctx.fill();
  } else if (prev) {
    traces(prev, 0, prev.n, 1);
  }
  ctx.restore();

  // direct labels from the last complete beat
  if (prev) {
    // Closures sit left of their line, openings right, so MC/AO and AC/MO never collide.
    for (const e of prev.events) {
      if (e.t > T) continue;
      const left = e.kind === 'MC' || e.kind === 'AC';
      text(ctx, e.kind, X(e.t) + (left ? -3 : 3), m.t - 5, COL.ink, left ? 'right' : 'left', 'bottom', 11, 700);
    }
    let iPk = 0;
    for (let i = 0; i < prev.n; i++) if (prev.Plv[i] > prev.Plv[iPk]) iPk = i;
    text(ctx, 'LV', X(prev.t[iPk]) + 8, Y(prev.Plv[iPk]) - 6, COL.loop, 'left', 'bottom', 12, 700);
    const iA = Math.min(prev.n - 1, Math.floor(prev.n * 0.72));
    text(ctx, 'Aorta', X(prev.t[iA]), Y(prev.Pao[iA]) - 8, COL.ao, 'center', 'bottom', 12, 700);
    text(ctx, 'Atrium', m.l + pw - 6, Y(sim.p.Pla) - 5, COL.es, 'right', 'bottom', 12, 700);
    const iV = Math.min(prev.n - 1, Math.floor(prev.n * 0.9));
    text(ctx, 'Volume', X(prev.t[iV]) - 4, YV(prev.V[iV]) + 8, COL.ink, 'right', 'top', 12, 700);
  }
}

function draw() { drawPV(); drawWiggers(); }

// ---------- main loop ----------
function frame(now) {
  const dtWall = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (!paused && !document.hidden) {
    const before = trail.length ? trail[trail.length - 1].no : 0;
    advance(dtWall * speed, true);
    const after = trail.length ? trail[trail.length - 1].no : 0;
    if (!reduceMotion.matches || before !== after) needsDraw = true;
  }
  if (sim.V > scale.V * 0.97) { rescale(true); needsDraw = true; }
  if (needsDraw) { draw(); needsDraw = false; }
  requestAnimationFrame(frame);
}

// ---------- tabs (phone) ----------
const tabs = [...document.querySelectorAll('[role=tab]')];
const panels = tabs.map(t => $(t.getAttribute('aria-controls')));
function selectTab(tab, focus) {
  tabs.forEach((t, i) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panels[i].classList.toggle('active', on);
  });
  if (focus) tab.focus();
  requestAnimationFrame(resize);
}
function applyLayout() {
  const tabbed = narrow.matches;
  $('tabs').hidden = !tabbed;
  if (tabbed) $('tabs').setAttribute('role', 'tablist'); else $('tabs').removeAttribute('role');
  $('tabs').setAttribute('aria-label', 'Views');
  panels.forEach((p, i) => {
    if (tabbed) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', tabs[i].id); }
    else { p.removeAttribute('role'); p.setAttribute('aria-labelledby', p.querySelector('h2').id); }
  });
  requestAnimationFrame(resize);
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j !== null) { e.preventDefault(); selectTab(tabs[j], true); }
  });
});

// ---------- wiring ----------
function init() {
  buildPresets();
  buildSliders();
  syncSliders();
  updateNote();

  $('btn-pause').addEventListener('click', () => setPaused(!paused));
  $('btn-step').addEventListener('click', () => { stepOneBeat(); needsDraw = true; });
  $('btn-settle').addEventListener('click', () => { jumpToSteady(); needsDraw = true; });
  $('btn-reset').addEventListener('click', () => {
    setParams({ ...BASE }, true);
  });
  for (const r of document.querySelectorAll('input[name=speed]')) {
    r.addEventListener('change', () => { if (r.checked) speed = Number(r.value); });
  }
  const bindToggle = (id, key) => {
    const el = $(id);
    el.checked = view[key];
    el.addEventListener('change', () => { view[key] = el.checked; if (key === 'ghost') rescale(); save(); needsDraw = true; });
  };
  bindToggle('t-curves', 'curves');
  bindToggle('t-ea', 'ea');
  bindToggle('t-ghost', 'ghost');
  const snd = $('t-sound');
  snd.checked = false;
  snd.addEventListener('change', () => { view.sound = snd.checked; if (snd.checked) ensureAudio(); });
  const wake = () => { if (view.sound) ensureAudio(); };
  document.addEventListener('pointerdown', wake);

  document.addEventListener('keydown', e => {
    wake();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const tag = t.tagName;
    const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox', 'radio'].includes(t.type));
    if (typing) return;
    if (e.key === ' ' || e.code === 'Space') {
      const native = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || (tag === 'INPUT' && (t.type === 'checkbox' || t.type === 'radio'));
      if (native) return;
      e.preventDefault();
      setPaused(!paused);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      stepOneBeat();
      needsDraw = true;
    }
  });

  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  reduceMotion.addEventListener('change', () => { needsDraw = true; });
  narrow.addEventListener('change', applyLayout);
  new ResizeObserver(() => resize()).observe($('panel-loop'));
  new ResizeObserver(() => resize()).observe($('panel-wiggers'));
  window.addEventListener('resize', resize);
  applyLayout();
  rescale(true);
  updateStatus();
  requestAnimationFrame(frame);
}

init();
