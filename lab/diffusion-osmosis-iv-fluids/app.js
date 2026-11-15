// Diffusion, Osmosis and IV Fluids: the guided lesson, the Clinical values tab and Explore freely.
import { FLUIDS, MAX_SHARE, anchorsFrom, solve, settingsFor } from './model.js';
import { cellScene, diffusionScene, membraneScene, osmosisScene, wallScene, bodyScene, fluidTimeline, frameAt, NORMAL, el, C, clamp } from './scenes.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Exaggerated amounts for the lesson pictures, as a share of body water, so each change is visible.
const LESSON_AMOUNT = { isotonic: 0.3, hypotonic: 0.3, hypertonic: 0.1, colloid: 0.12, glucose: 0.3 };
const VALUE_IDS = ['sosm', 'tonicity', 'na', 'bcop', 'icfShare', 'plasmaShare'];
const SHIFT_TEXT = { up: ['↑', 'Expected to rise'], down: ['↓', 'Expected to fall'], none: ['→', 'Expected to stay the same'], variable: ['↕', 'Can go either way'], unstated: ['·', 'Not stated in the cited sources'] };

let cv = null, anchors = null;

/* ---------------- Data ---------------- */
function validate(data) {
  const problems = [];
  if (!data || !Array.isArray(data.values) || !Array.isArray(data.states) || !data.sources) return ['the file is missing values, states or sources'];
  const ids = new Set(data.values.map(v => v.id));
  for (const id of VALUE_IDS) if (!ids.has(id)) problems.push(`no value "${id}"`);
  const base = data.modelBaseline || {};
  for (const v of data.values) {
    const b = base[v.id];
    if (typeof b !== 'number') { problems.push(`no model baseline for ${v.id}`); continue; }
    const inside = v.low != null && v.high != null ? b >= v.low && b <= v.high : b === v.typical;
    if (!inside) problems.push(`model baseline for ${v.id} is off its reference`);
  }
  if (base.tonicity > base.sosm) problems.push('model baseline tonicity exceeds total osmolality');
  for (const v of data.values) {
    if (!data.sources[v.source]) problems.push(`${v.id}: unknown source`);
    if (!v.excerpt || !v.where) problems.push(`${v.id}: missing excerpt or location`);
  }
  for (const s of data.states) {
    if (!data.sources[s.source]) problems.push(`${s.id}: unknown source`);
    if (!Array.isArray(s.evidence) || !s.evidence.length) problems.push(`${s.id}: no quoted evidence`);
    for (const k of Object.keys(s.shifts || {})) if (!ids.has(k)) problems.push(`${s.id}: shift for unknown value ${k}`);
  }
  return problems;
}
function showError(msg) {
  const box = $('#data-error');
  box.textContent = msg;
  box.hidden = false;
}

/* ---------------- Tabs ---------------- */
const tabs = $$('[role="tab"]');
function selectTab(tab, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  if (tab.id === 'tab-lesson') play(current); else stopAnimation(true);
  if (tab.id === 'tab-explore') renderExplore();
  if (tab.id === 'tab-clinical') renderClinical();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    selectTab(tabs[(moves[e.key] + tabs.length) % tabs.length], true);
  });
});

/* ---------------- Lesson steps ---------------- */
const steps = $$('[data-step]');
const N = steps.length;
const back = $('[data-step-back]'), next = $('[data-step-next]'), replay = $('#replay');
const progress = $('[data-step-progress]'), part = $('#progress-part'), bar = $('#progress-bar');
const scenes = new Map();
let current = 0, raf = 0;

for (const s of steps) {
  const li = document.createElement('li');
  li.className = s.dataset.part === 'change' ? 'change' : 'core';
  bar.appendChild(li);
}

function lessonScene(step) {
  if (scenes.has(step)) return scenes.get(step);
  const svg = $('svg', step), kind = step.dataset.scene;
  let scene;
  switch (kind) {
    case 'cell-intro': scene = cellScene(svg, { dots: false, mode: 'intro' }); break;
    case 'cell-solute': scene = cellScene(svg, { mode: 'solute' }); break;
    case 'diffusion': scene = diffusionScene(svg); break;
    case 'membrane': scene = membraneScene(svg); break;
    case 'osmosis': scene = osmosisScene(svg); break;
    case 'cell-iso': scene = cellScene(svg, { mode: 'tonic', outside: 1, arrows: 'both', verdict: 'cell holds its size' }); break;
    case 'cell-hypo': scene = cellScene(svg, { mode: 'tonic', outside: 0.45, target: 1.55, arrows: 'in', verdict: 'cell swells' }); break;
    case 'cell-hyper': scene = cellScene(svg, { mode: 'tonic', outside: 1.8, target: 0.55, arrows: 'out', verdict: 'cell shrinks' }); break;
    case 'wall': scene = wallScene(svg); break;
    case 'rooms':
    case 'routes': {
      if (!anchors) return null;
      const body = bodyScene(svg, { bar: kind === 'rooms', drip: kind === 'routes', routes: kind === 'routes' });
      const shares = baselineShares();
      scene = { render: () => body.render({ ...NORMAL, shares }), duration: 0 };
      break;
    }
    case 'fluid': {
      if (!anchors) return null;
      const fluid = step.dataset.fluid, f = FLUIDS[fluid];
      const m = solve(anchors, { volume: LESSON_AMOUNT[fluid], salt: f.salt, sugar: f.sugar, uptake: 1, colloid: f.colloid });
      const tl = fluidTimeline(m, { colloid: f.colloid, sugar: f.sugar > 0 });
      const body = bodyScene(svg, { drip: true });
      scene = { render: t => body.render(frameAt(tl, t)), duration: tl.duration };
      const result = $('[data-result]', step);
      if (result) result.textContent = resultText(m);
      break;
    }
  }
  scenes.set(step, scene);
  return scene;
}
function baselineShares() {
  const inside = anchors.inside, out = 1 - inside;
  return [inside, out * (1 - anchors.plasmaOfOutside), out * anchors.plasmaOfOutside];
}
function resultText(m) {
  const cell = Math.abs(m.cell - 1) < 0.01 ? 'Cells hold their size' : m.cell > 1 ? 'Cells swell' : 'Cells shrink';
  const kept = m.went.plasma;
  const vessel = kept > 0.6 ? 'the vessels keep most of the fluid' : kept > 0.15 ? 'the vessels keep part of the fluid' : 'the vessels keep only a little of the fluid';
  return `Result: ${cell}; ${vessel}.`;
}

function stopAnimation(finish = false) {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (finish) {
    const scene = scenes.get(steps[current]);
    if (scene) { scene.render(1); $('svg', steps[current]).dataset.phase = 'end'; }
  }
}
function play(i) {
  stopAnimation();
  const step = steps[i], svg = $('svg', step), scene = lessonScene(step);
  replay.disabled = !scene || !scene.duration;
  if (!scene) return;
  if (!scene.duration || reduceMotion.matches) { scene.render(1); svg.dataset.phase = 'end'; return; }
  svg.dataset.phase = 'run';
  scene.render(0);
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / scene.duration);
    scene.render(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else { raf = 0; svg.dataset.phase = 'end'; }
  };
  raf = requestAnimationFrame(tick);
}

function show(i, { focus = false } = {}) {
  current = clamp(i, 0, N - 1);
  steps.forEach((s, k) => { s.hidden = k !== current; });
  const step = steps[current];
  progress.textContent = `Step ${current + 1} of ${N}`;
  part.textContent = step.dataset.part === 'change' ? 'What changes it' : 'Building the idea';
  $$('li', bar).forEach((li, k) => { li.classList.toggle('done', k < current); li.classList.toggle('now', k === current); });
  back.disabled = current === 0;
  const last = current === N - 1;
  next.textContent = last ? 'Start again' : 'Next →';
  next.setAttribute('aria-label', last ? 'Start the lesson again from step 1' : 'Next step');
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  if (!$('#panel-lesson').hidden) play(current);
  if (focus) $('h2', step).focus();
}
back.addEventListener('click', () => show(current - 1, { focus: true }));
next.addEventListener('click', () => show(current === N - 1 ? 0 : current + 1, { focus: true }));
replay.addEventListener('click', () => play(current));
$('#panel-lesson').addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
  if (e.key === 'ArrowRight' && current < N - 1) { e.preventDefault(); show(current + 1, { focus: true }); }
  if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); show(current - 1, { focus: true }); }
});
function stepFromHash() {
  const m = /^#step-(\d+)$/.exec(location.hash);
  return m ? clamp(parseInt(m[1], 10) - 1, 0, N - 1) : null;
}
addEventListener('hashchange', () => {
  const i = stepFromHash();
  if (i !== null && i !== current) { selectTab(tabs[0]); show(i, { focus: true }); }
});
reduceMotion.addEventListener('change', () => { if (!$('#panel-lesson').hidden) play(current); });
$$('[data-go-explore]').forEach(b => b.addEventListener('click', () => selectTab($('#tab-explore'), true)));

/* ---------------- Explore freely ---------------- */
const ui = { fluid: $('#fluid'), amount: $('#amount'), salt: $('#salt'), uptake: $('#uptake') };
let explore = null;
const pct = x => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;

function exploreSettings() {
  const fluid = ui.fluid.value, amount = +ui.amount.value;
  if (fluid === 'custom') return { volume: amount / 100 * MAX_SHARE, salt: +ui.salt.value / 100, sugar: 0, uptake: 1, colloid: false };
  return settingsFor(fluid, amount, +ui.uptake.value / 100);
}
function model() { return anchors ? solve(anchors, exploreSettings()) : null; }

function fluidName() {
  const o = ui.fluid.selectedOptions[0];
  return o ? o.textContent : '';
}
const amountText = m => m.volume === 0 ? 'none' : `${(m.volume * 100).toFixed(1)}% of body water`;
function renderExplore() {
  if (!anchors) return;
  if (!explore) explore = bodyScene($('#explore-svg'), { bar: true, drip: true });
  const m = model();
  const inside = m.values.icfShare / 100, outside = 1 - inside;
  explore.render({ cell: m.cell, isf: m.isf, plasma: m.plasma, conc: m.conc, protein: m.protein, sugar: ui.fluid.value === 'glucose' ? 1 : 0, uptake: +ui.uptake.value / 100, arrow: Math.abs(m.cell - 1) > 0.005 ? Math.sign(m.cell - 1) * 0.6 : 0, spread: 0, shares: [inside, outside * (1 - m.values.plasmaShare / 100), outside * m.values.plasmaShare / 100] });
  $('#amount-out').textContent = amountText(m);
  $('#salt-out').textContent = `${ui.salt.value}%`;
  $('#uptake-out').textContent = ui.uptake.disabled ? 'not a sugar fluid' : `${ui.uptake.value}%`;
  const cellWord = Math.abs(m.cell - 1) < 0.0005 ? 'unchanged' : `${pct(m.cell - 1)} (${m.cell > 1 ? 'swell' : 'shrink'})`;
  $('#explore-summary').innerHTML = `
    <p class="readout-title">${fluidName()}, ${$('#amount-out').textContent}</p>
    <dl>
      <div><dt>Cell size</dt><dd data-out="cell">${cellWord}</dd></div>
      <div><dt>Space between cells</dt><dd>${Math.abs(m.isf - 1) < 0.0005 ? 'unchanged' : pct(m.isf - 1)}</dd></div>
      <div><dt>Plasma volume</dt><dd data-out="plasma">${Math.abs(m.plasma - 1) < 0.0005 ? 'unchanged' : pct(m.plasma - 1)}</dd></div>
      <div><dt>Concentration outside cells</dt><dd>${m.conc.toFixed(3)} × normal</dd></div>
      <div><dt>Protein pull</dt><dd>${m.pull.toFixed(3)} × normal</dd></div>
    </dl>`;
  const went = $('#explore-went');
  if (m.volume === 0) { went.innerHTML = '<p class="went-title">Nothing given yet. Choose a fluid, then raise the amount.</p>'; return; }
  const rows = [['Inside cells', m.went.inside], ['Between cells', m.went.isf], ['Plasma', m.went.plasma]];
  // Each bar grows from the centre line into its own half of the track. A full half means the whole
  // fluid given; when a room gains more than that (water pulled out of cells), every bar is scaled
  // down together so the largest one exactly fills its half.
  const scale = Math.max(1, ...rows.map(([, x]) => Math.abs(x)));
  const pctText = x => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)}%`;
  went.innerHTML = `<p class="went-title">Where the water ended up, as a share of the fluid given</p>` + rows.map(([name, x]) => `
    <div class="went-row"><span class="went-name">${name}</span><span class="went-track"><span class="went-bar ${x < 0 ? 'neg' : ''}"></span></span><span class="went-num">${pctText(x)}</span></div>`).join('') +
    (scale > 1 ? `<p class="went-note" data-scaled>Bars are drawn to a shrunk scale: a full half-bar here is ${(scale * 100).toFixed(0)}% of the fluid given, because one room gained more water than was given.</p>` : '') +
    (m.went.inside < -0.005 ? '<p class="went-note">A negative share means water was pulled out of that room.</p>' : '');
  $$('.went-bar', went).forEach((bar, i) => { bar.style.width = `${(Math.abs(rows[i][1]) / scale * 50).toFixed(2)}%`; });
}
function presetFromFluid() {
  const f = ui.fluid.value;
  if (f !== 'custom') ui.salt.value = Math.round(FLUIDS[f].salt * 100);
  ui.uptake.disabled = f !== 'glucose';
  if (f !== 'glucose') ui.uptake.value = 100;
}
function onExploreChange() {
  syncStateFromExplore();
  renderExplore();
  renderClinical();
}
ui.fluid.addEventListener('change', () => {
  presetFromFluid();
  if (+ui.amount.value === 0) ui.amount.value = 50; // choosing a fluid gives some of it
  onExploreChange();
});
ui.amount.addEventListener('input', onExploreChange);
ui.uptake.addEventListener('input', onExploreChange);
ui.salt.addEventListener('input', () => {
  const s = +ui.salt.value / 100;
  const match = Object.entries(FLUIDS).find(([k, f]) => !f.colloid && f.sugar === 0 && f.salt === s && k !== 'water');
  ui.fluid.value = match ? match[0] : s === 0 ? 'water' : 'custom';
  ui.uptake.disabled = true;
  onExploreChange();
});
$('#explore-reset').addEventListener('click', () => { ui.fluid.value = 'isotonic'; ui.amount.value = 0; presetFromFluid(); onExploreChange(); });

/* ---------------- Clinical values ---------------- */
let selectedState = null;
function syncStateFromExplore() {
  if (!cv) return;
  const f = ui.fluid.value, amount = +ui.amount.value;
  let id = null;
  if (amount === 0) id = 'baseline';
  else if (f === 'water' || (f === 'glucose' && +ui.uptake.value === 100)) id = 'freewater';
  else if (cv.states.some(s => s.id === f)) id = f;
  selectedState = id;
  $$('#cv-states input').forEach(r => { r.checked = r.value === id; });
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id);
  if (!st) return;
  selectedState = id;
  const m = st.model || {};
  if (m.fluid) ui.fluid.value = m.fluid;
  presetFromFluid();
  ui.amount.value = m.amount ?? 50;
  if (m.uptake != null && ui.fluid.value === 'glucose') ui.uptake.value = m.uptake;
  renderExplore();
  renderClinical();
}

const fmt = (v, x) => x.toFixed(v.decimals ?? 0);
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical;
  const span = hi - lo || Math.abs(hi) * 0.4;
  const pad = v.low != null && v.high != null ? span * 1.1 : span * 0.6;
  return { min: lo - pad, max: hi + pad };
}
function buildClinical() {
  $('#cv-disclaimer').textContent = cv.disclaimer;
  const fs = $('#cv-states');
  for (const st of cv.states) {
    const id = `state-${st.id}`;
    const wrap = document.createElement('div');
    wrap.className = 'cv-state';
    wrap.innerHTML = `<input type="radio" name="cv-state" id="${id}" value="${st.id}"><label for="${id}">${st.label}<span class="kind">${st.kind === 'drug' ? 'fluid' : 'baseline'}</span></label>`;
    fs.appendChild(wrap);
  }
  fs.addEventListener('change', e => { if (e.target.name === 'cv-state') applyState(e.target.value); });
  const rows = $('#cv-rows');
  for (const v of cv.values) {
    const row = document.createElement('article');
    row.className = 'cv-row';
    row.dataset.cv = v.id;
    const ref = v.low != null && v.high != null ? `Typical adult range: ${v.display} ${v.unit}` : `Cited typical value: ${v.display} ${v.unit}`;
    row.innerHTML = `
      <div class="cv-head"><h3>${v.label}</h3><p class="cv-ref">${ref}</p></div>
      <svg class="gauge" viewBox="0 0 340 64" role="img" aria-label="${v.label}: reference and model marker"></svg>
      <p class="cv-now"><span class="model-label">Model now</span> <span class="model-value"></span> <span class="cv-status"></span></p>
      <p class="shift" data-shift="unstated"></p>
      <details class="cv-src"><summary>Source and quote</summary>
        <blockquote>“${v.excerpt}”</blockquote>
        <p>${cv.sources[v.source]} <span class="where">${v.where}</span></p>
        ${sourceLinks(v.source, v.where)}
        ${v.note ? `<p class="note">${v.note}</p>` : ''}
      </details>`;
    rows.appendChild(row);
  }
  const ol = $('#cv-sources');
  for (const [id, cite] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    li.id = `src-${id}`;
    li.innerHTML = `${escapeHtml(cite)} ${sourceLinks(id)}`;
    ol.appendChild(li);
  }
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Outbound links to the open source pages (plain navigation, opened in a new tab). For a multi-section
// source, only the section named in "where" is linked when it can be matched.
function sourceLinks(id, where = '') {
  let links = (cv.links && cv.links[id]) || [];
  const secs = [...where.replace(/(Table|Figure) \d+\.\d+/g, '').matchAll(/\b(\d+\.\d+)\b/g)].map(m => m[1]);
  if (secs.length && links.length > 1) {
    const some = links.filter(l => secs.some(s => l.label.includes(` ${s} `)));
    if (some.length) links = some;
  }
  if (!links.length) return '';
  return `<span class="src-links">${links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}<span class="sr-only"> (opens in a new tab)</span> ↗</a>`).join(' ')}</span>`;
}
function drawGauge(svg, v, x) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { min, max } = scaleFor(v), X = val => 14 + (clamp(val, min, max) - min) / (max - min) * 312;
  el('line', { x1: 14, y1: 34, x2: 326, y2: 34, stroke: C.rule, 'stroke-width': 2 }, svg);
  const tick = (val, text, anchor) => {
    el('line', { x1: X(val), y1: 24, x2: X(val), y2: 44, stroke: C.ink, 'stroke-width': 1.5 }, svg);
    const t = el('text', { x: X(val), y: 60, 'font-size': 12, 'text-anchor': anchor, fill: C.ink }, svg);
    t.textContent = text;
  };
  if (v.low != null && v.high != null) {
    el('rect', { x: X(v.low), y: 26, width: X(v.high) - X(v.low), height: 16, fill: '#e2e4da', stroke: C.ink, 'stroke-width': 1.5 }, svg);
    tick(v.low, String(v.low), 'end'); tick(v.high, String(v.high), 'start');
  } else {
    el('rect', { x: X(v.typical) - 3, y: 22, width: 6, height: 24, fill: C.ink }, svg);
    const t = el('text', { x: X(v.typical), y: 60, 'font-size': 12, 'text-anchor': 'middle', fill: C.ink }, svg);
    t.textContent = `typical ${v.typical}`;
  }
  const mx = X(x), off = x < min ? 'left' : x > max ? 'right' : '';
  el('path', { d: `M${mx - 8},4 L${mx + 8},4 L${mx},17 Z`, fill: C.blue, class: 'model-needle' }, svg);
  el('line', { x1: mx, y1: 16, x2: mx, y2: 46, stroke: C.blue, 'stroke-width': 3 }, svg);
  if (off) {
    const t = el('text', { x: off === 'left' ? mx + 12 : mx - 12, y: 14, 'font-size': 12, 'text-anchor': off === 'left' ? 'start' : 'end', fill: C.blue, 'font-weight': 700 }, svg);
    t.textContent = off === 'left' ? '◀ off scale' : 'off scale ▶';
  }
}
function statusFor(v, x) {
  if (v.low != null && v.high != null) {
    const lo = +fmt(v, x) < v.low, hi = +fmt(v, x) > v.high;
    return lo ? ['below', 'Below typical range'] : hi ? ['above', 'Above typical range'] : ['within', 'Within typical range'];
  }
  const rel = (x - v.typical) / v.typical;
  if (+fmt(v, x) === v.typical) return ['within', 'At the cited typical value'];
  return Math.abs(rel) < 0.02 ? ['within', 'Near the cited typical value'] : rel > 0 ? ['above', 'Above the cited typical value'] : ['below', 'Below the cited typical value'];
}
function renderClinical() {
  if (!cv || !anchors) return;
  const m = model();
  $('#cv-model').innerHTML = +ui.amount.value === 0
    ? 'Model now: <strong>no fluid given</strong>. Pick a fluid below, or change it in Explore freely.'
    : `Model now: <strong>${fluidName()}</strong>, ${amountText(m)} (illustrative).`;
  const st = cv.states.find(s => s.id === selectedState);
  for (const v of cv.values) {
    const row = $(`[data-cv="${v.id}"]`);
    const x = m.values[v.modelKey];
    drawGauge($('svg', row), v, x);
    $('.model-value', row).textContent = `${fmt(v, x)} ${v.unit}`;
    const [cls, words] = statusFor(v, x);
    const status = $('.cv-status', row);
    status.textContent = words; status.dataset.status = cls;
    const shift = $('.shift', row);
    const dir = st ? (st.shifts[v.id] || 'unstated') : null;
    shift.dataset.shift = dir || 'unstated';
    shift.hidden = !st;
    if (st) shift.innerHTML = `<span class="arrow" aria-hidden="true">${SHIFT_TEXT[dir][0]}</span> ${SHIFT_TEXT[dir][1]} with ${st.id === 'baseline' ? 'no fluid given' : st.label.toLowerCase()}`;
  }
  const detail = $('#cv-state-detail');
  if (!st) { detail.innerHTML = '<p class="cv-pick">Pick one of the states above to see the expected direction of each value, with the quoted evidence.</p>'; return; }
  detail.innerHTML = `
    <p class="cv-summary"><strong>${st.label}.</strong> ${st.summary}</p>
    ${st.evidence.map(q => `<blockquote>“${q.excerpt}”<cite>${q.source === 'openstax' ? 'OpenStax Anatomy and Physiology 2e, ' : ''}${q.where} ${sourceLinks(q.source, q.where)}</cite></blockquote>`).join('')}
    ${st.unstatedNote ? `<p class="note">${st.unstatedNote}</p>` : ''}`;
}

/* ---------------- Start ---------------- */
async function start() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const problems = validate(data);
    if (problems.length) throw new Error(problems.join('; '));
    cv = data;
    anchors = anchorsFrom(cv);
    buildClinical();
  } catch (err) {
    showError(`The clinical values file could not be loaded (${err.message}). The pictures that depend on it, the Clinical values tab and Explore freely are unavailable until the page is reloaded.`);
  }
  presetFromFluid();
  syncStateFromExplore();
  const fromHash = stepFromHash();
  show(fromHash ?? 0);
  renderClinical();
  document.documentElement.dataset.ready = 'true';
}
start();
