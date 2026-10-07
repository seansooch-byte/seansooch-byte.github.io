// Mixed Strategy Arena: UI. All game theory lives in solver.js.
import {
  solveZeroSum, dominated, canonical, rowPayoffs, colPayoffs, rowMixReport, exploitability,
  mulberry32, aiMove, fictitiousPlay, regretMatching, argmax,
} from './solver.js';

// ---------- Scenarios (payoffs are illustrative) ----------
const SCENARIOS = [
  { id: 'penalty', name: 'Penalty kick', rowName: 'Kicker', colName: 'Keeper',
    rows: ['Left', 'Centre', 'Right'], cols: ['Dive L', 'Stay', 'Dive R'],
    matrix: [[0.55, 0.90, 0.95], [0.95, 0.35, 0.95], [0.95, 0.90, 0.60]], rowMaximizes: true, unit: 'prob',
    note: 'Illustrative numbers. Inspired by Palacios-Huerta (2003, Review of Economic Studies), who found professional kickers play close to equilibrium; these values are not data from that paper.',
    metric: "the kicker's chance of scoring", valueLabel: 'Kicker scores this often at equilibrium',
    rowAct: 'kick', colAct: 'dive', rowVerb: 'scores', colVerb: 'concedes', noun: 'kicks',
    hit: 'Goal', miss: 'Saved', after: { row: ['after scoring', 'after a save'], col: ['after conceding', 'after a save'] } },
  { id: 'pitcher', name: 'Pitcher vs batter (Tigers flavour)', rowName: 'Pitcher', colName: 'Batter',
    rows: ['Fastball', 'Slider', 'Changeup'], cols: ['Sit fastball', 'Sit offspeed'],
    matrix: [[0.420, 0.290], [0.260, 0.360], [0.280, 0.340]], rowMaximizes: false, unit: 'woba',
    note: "Illustrative wOBA-like values, not Statcast data. The pitcher is the row player and wants the batter's value low. In Play, each pitch counts as the batter reaching base with that probability.",
    metric: "the batter's expected wOBA-like value", valueLabel: "Batter's expected value at equilibrium (the pitcher keeps it this low)",
    rowAct: 'pitch', colAct: 'approach', rowVerb: 'allows', colVerb: 'produces', noun: 'pitches',
    hit: 'Batter reaches', miss: 'Out', after: { row: ['after giving up a hit', 'after an out'], col: ['after reaching', 'after an out'] } },
  { id: 'tennis', name: 'Tennis serve', rowName: 'Server', colName: 'Returner',
    rows: ['Wide', 'Body', 'T'], cols: ['Lean wide', 'Lean T'],
    matrix: [[0.58, 0.79], [0.68, 0.66], [0.80, 0.60]], rowMaximizes: true, unit: 'prob',
    note: 'Illustrative win probabilities for the server on a first serve.',
    metric: "the server's chance of winning the point", valueLabel: 'Server wins this share of points at equilibrium',
    rowAct: 'serve', colAct: 'lean', rowVerb: 'wins', colVerb: 'concedes', noun: 'serves',
    hit: 'Server wins', miss: 'Returner wins', after: { row: ['after winning a point', 'after losing a point'], col: ['after losing a point', 'after winning a point'] } },
  { id: 'third', name: '3rd & 2 call', rowName: 'Offense', colName: 'Defense',
    rows: ['Run', 'Pass'], cols: ['Run D', 'Pass D'],
    matrix: [[0.45, 0.72], [0.75, 0.40]], rowMaximizes: true, unit: 'prob',
    note: 'Illustrative conversion probabilities on 3rd and 2.',
    metric: 'the chance the offense converts', valueLabel: 'Offense converts this often at equilibrium',
    rowAct: 'call', colAct: 'front', rowVerb: 'converts', colVerb: 'allows', noun: 'snaps',
    hit: 'First down', miss: 'Stopped', after: { row: ['after converting', 'after being stopped'], col: ['after allowing a first down', 'after a stop'] } },
  { id: 'pennies', name: 'Matching pennies', rowName: 'Matcher', colName: 'Mismatcher',
    rows: ['Heads', 'Tails'], cols: ['Heads', 'Tails'],
    matrix: [[1, -1], [-1, 1]], rowMaximizes: true, unit: 'points',
    note: 'Sanity check. The matcher wins 1 point if the coins match and loses 1 if they do not.',
    metric: "the matcher's points (win 1, lose −1)", valueLabel: "Matcher's expected points per round",
    rowAct: 'choice', colAct: 'choice', rowVerb: 'earns', colVerb: 'gives up', noun: 'rounds' },
  { id: 'rps', name: 'Rock-paper-scissors', rowName: 'Player 1', colName: 'Player 2',
    rows: ['Rock', 'Paper', 'Scissors'], cols: ['Rock', 'Paper', 'Scissors'],
    matrix: [[0, -1, 1], [1, 0, -1], [-1, 1, 0]], rowMaximizes: true, unit: 'points',
    note: 'Sanity check. Win 1, lose −1, tie 0.',
    metric: "player 1's points (win 1, lose −1, tie 0)", valueLabel: "Player 1's expected points per round",
    rowAct: 'throw', colAct: 'throw', rowVerb: 'earns', colVerb: 'gives up', noun: 'rounds' },
  { id: 'custom', name: 'Custom game', rowName: 'Row', colName: 'Column',
    rows: ['A', 'B', 'C'], cols: ['X', 'Y', 'Z'],
    matrix: [[4, 1, 3], [2, 5, 0], [1, 2, 6]], rowMaximizes: true, unit: 'value',
    note: 'Your own game: 2×2 up to 4×4. Rename the players and actions, type any payoffs, and choose whether the row player wants them high or low.',
    metric: "the row player's payoff", valueLabel: "Row player's expected payoff at equilibrium",
    rowAct: 'action', colAct: 'action', rowVerb: 'earns', colVerb: 'gives up', noun: 'rounds' },
];
const ROW_DEFAULT = ['A', 'B', 'C', 'D'], COL_DEFAULT = ['X', 'Y', 'Z', 'W'];
const DIFF = {
  easy: { order: 0, epsilon: 0.6, text: 'Easy: the AI only tracks your overall favourite and plays the equilibrium 60% of the time.' },
  normal: { order: 2, epsilon: 0.15, text: 'Normal: the AI reads your last two moves and exploits them 85% of the time.' },
  hard: { order: 3, epsilon: 0.05, text: 'Hard: the AI reads your last three moves and exploits them 95% of the time.' },
};
const C = { ink: '#171916', soft: '#4b4f47', rule: '#babeb3', paper: '#f7f7f2', accent: '#254dff', row: '#9a4f00', rowFill: '#f2a43a', col: '#00707f', colFill: '#3cc4d6' };
const FONT = "'Space Grotesk', system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

// ---------- Storage (optional) ----------
const store = {
  get(key) { try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; } },
  set(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable: play on without saving */ } },
};

// ---------- State ----------
const clone = o => JSON.parse(JSON.stringify(o));
const state = { id: 'penalty', games: {}, solved: {}, invalid: new Set(), sol: null, M: null, tryMix: null, mode: 'solve' };
for (const s of SCENARIOS) state.games[s.id] = freshGame(s);

function freshGame(s) {
  const g = clone(s);
  g.raw = g.matrix.map(r => r.map(v => String(v)));
  return g;
}
const game = () => state.games[state.id];
const rowLabel = (g, i) => (g.rows[i] || '').trim() || `Row ${i + 1}`;
const colLabel = (g, j) => (g.cols[j] || '').trim() || `Column ${j + 1}`;
const rowName = g => (g.rowName || '').trim() || 'Row player';
const colName = g => (g.colName || '').trim() || 'Column player';
const isSampled = (g, M) => (g.unit === 'prob' || g.unit === 'woba' || g.id === 'custom') && M.every(r => r.every(v => v >= 0 && v <= 1));

// ---------- Formatting (never prints NaN) ----------
function fmt(v, g = game()) {
  if (typeof v !== 'number' || !isFinite(v)) return '–';
  if (Math.abs(v) < 5e-10) v = 0;
  if (g.unit === 'prob') return (v * 100).toFixed(1) + '%';
  if (g.unit === 'woba') return v.toFixed(3).replace(/^(-?)0\./, '$1.');
  return String(+v.toFixed(3)).replace('-', '−');
}
const pct = (p, d = 1) => (typeof p === 'number' && isFinite(p) ? (p * 100).toFixed(d) : '0') + '%';
function fmtDelta(v, g = game()) {
  if (!isFinite(v)) return '–';
  if (g.unit === 'prob') return (v * 100).toFixed(1) + ' pts';
  if (g.unit === 'woba') return v.toFixed(3);
  return String(+v.toFixed(3));
}

// ---------- Scenario picker & tabs ----------
function initPicker() {
  const sel = $('scenario');
  sel.innerHTML = SCENARIOS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  sel.value = state.id;
  sel.addEventListener('change', () => { state.id = sel.value; onGameChanged(true); });
}

const TABS = ['solve', 'play', 'learn'];
function initTabs() {
  const tabs = TABS.map(t => $('tab-' + t));
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => setMode(TABS[i]));
    b.addEventListener('keydown', e => {
      let k = null;
      if (e.key === 'ArrowRight') k = (i + 1) % 3; else if (e.key === 'ArrowLeft') k = (i + 2) % 3;
      else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = 2;
      if (k !== null) { e.preventDefault(); setMode(TABS[k]); tabs[k].focus(); }
    });
  });
}
function setMode(mode) {
  state.mode = mode;
  for (const t of TABS) {
    const b = $('tab-' + t), on = t === mode;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $('panel-' + t).hidden = !on;
  }
  if (mode !== 'learn') pauseLearn();
  if (mode === 'play') { renderSetup(); drawScoreChart(); }
  if (mode === 'learn') { if (!learn.fp) resetLearn(); drawLearn(); }
  if (mode === 'solve') renderGeometry();
}

// ---------- Header text ----------
function renderHeader() {
  const g = game();
  $('matchup').innerHTML = `<span class="r">${esc(rowName(g))}</span> (rows, ${g.rowMaximizes ? 'wants it high' : 'wants it low'}) vs <span class="c">${esc(colName(g))}</span> (columns, ${g.rowMaximizes ? 'wants it low' : 'wants it high'})`;
  $('scenario-note').textContent = g.note;
  $('matrix-hint').textContent = `Each cell is ${g.metric} for that pair of actions. Edit any number and the solution updates.`;
  $('value-label').textContent = g.valueLabel;
  $('leg-row').textContent = `Better for ${rowName(g)} than the game value`;
  $('leg-col').textContent = `Better for ${colName(g)}`;
  $('custom-controls').hidden = g.id !== 'custom';
  $('btn-copy').hidden = g.id === 'custom';
  if (g.id === 'custom') {
    $('c-rows').value = String(g.rows.length); $('c-cols').value = String(g.cols.length);
    $('c-rowname').value = g.rowName; $('c-colname').value = g.colName; $('c-max').checked = g.rowMaximizes;
  }
}

// ---------- Matrix editor ----------
function cellLabel(g, i, j) { return `Payoff: ${rowName(g)} ${rowLabel(g, i)} vs ${colName(g)} ${colLabel(g, j)}`; }
function buildMatrix() {
  const g = game(), custom = g.id === 'custom';
  let h = `<caption class="sr-only">Payoff matrix: ${esc(g.metric)}</caption><thead><tr><th scope="col" class="corner"><b class="r">${esc(rowName(g))} ↓</b><b class="c">${esc(colName(g))} →</b></th>`;
  g.cols.forEach((c, j) => {
    h += `<th scope="col" id="ch-${j}">${custom ? `<input class="label-input" type="text" data-cl="${j}" maxlength="14" value="${esc(c)}" aria-label="Column action ${j + 1} name">` : esc(c)}<span class="badge" id="cb-${j}" hidden>Dominated</span></th>`;
  });
  h += '</tr></thead><tbody>';
  g.rows.forEach((r, i) => {
    h += `<tr><th scope="row" id="rh-${i}">${custom ? `<input class="label-input" type="text" data-rl="${i}" maxlength="14" value="${esc(r)}" aria-label="Row action ${i + 1} name">` : esc(r)}<span class="badge" id="rb-${i}" hidden>Dominated</span></th>`;
    g.cols.forEach((c, j) => {
      h += `<td><input class="cell" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-i="${i}" data-j="${j}" value="${esc(g.raw[i][j])}" aria-label="${esc(cellLabel(g, i, j))}"></td>`;
    });
    h += '</tr>';
  });
  $('matrix').innerHTML = h + '</tbody>';
}
function refreshCellLabels() {
  const g = game();
  document.querySelectorAll('#matrix .cell').forEach(el => el.setAttribute('aria-label', cellLabel(g, +el.dataset.i, +el.dataset.j)));
}

function parseAll() {
  const g = game(), bad = new Set();
  const M = g.raw.map((r, i) => r.map((s, j) => {
    const t = String(s).trim();
    const v = NUM_RE.test(t) ? Number(t) : NaN;
    if (!isFinite(v) || Math.abs(v) > 1e6) { bad.add(`${i},${j}`); return 0; }
    return v;
  }));
  return { M, bad };
}

function initMatrixEvents() {
  const tbl = $('matrix');
  tbl.addEventListener('input', e => {
    const el = e.target, g = game();
    if (el.classList.contains('cell')) {
      g.raw[+el.dataset.i][+el.dataset.j] = el.value;
      recompute();
    } else if (el.dataset.rl !== undefined) {
      g.rows[+el.dataset.rl] = el.value; refreshCellLabels(); renderOutputs(); labelsChanged();
    } else if (el.dataset.cl !== undefined) {
      g.cols[+el.dataset.cl] = el.value; refreshCellLabels(); renderOutputs(); labelsChanged();
    }
  });
  $('btn-reset').addEventListener('click', () => {
    const base = SCENARIOS.find(s => s.id === state.id);
    state.games[state.id] = freshGame(base);
    onGameChanged(true);
  });
  $('btn-copy').addEventListener('click', () => {
    const g = game(), cu = state.games.custom;
    Object.assign(cu, { rowName: g.rowName, colName: g.colName, rows: g.rows.slice(), cols: g.cols.slice(), raw: g.raw.map(r => r.slice()), rowMaximizes: g.rowMaximizes, matrix: g.matrix.map(r => r.slice()) });
    // The copy starts from the source's last valid solution, so an invalid cell carries over consistently.
    if (state.solved[state.id]) state.solved.custom = state.solved[state.id]; else delete state.solved.custom;
    state.id = 'custom'; $('scenario').value = 'custom';
    onGameChanged(true);
    $('c-rows').focus();
  });
  const resize = () => {
    const g = game(), m = +$('c-rows').value, n = +$('c-cols').value;
    g.rows = Array.from({ length: m }, (_, i) => g.rows[i] ?? ROW_DEFAULT[i]);
    g.cols = Array.from({ length: n }, (_, j) => g.cols[j] ?? COL_DEFAULT[j]);
    g.raw = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (g.raw[i] && g.raw[i][j] !== undefined ? g.raw[i][j] : '0')));
    onGameChanged(true);
  };
  $('c-rows').addEventListener('change', resize);
  $('c-cols').addEventListener('change', resize);
  $('c-rowname').addEventListener('input', e => { game().rowName = e.target.value; renderHeader(); buildMatrix(); markInvalid(); renderOutputs(); labelsChanged(); });
  $('c-colname').addEventListener('input', e => { game().colName = e.target.value; renderHeader(); buildMatrix(); markInvalid(); renderOutputs(); labelsChanged(); });
  $('c-max').addEventListener('change', e => { game().rowMaximizes = e.target.checked; renderHeader(); recompute(true); });
}
function labelsChanged() { if (!play.active) renderSetup(); }

function markInvalid() {
  document.querySelectorAll('#matrix .cell').forEach(el => {
    const bad = state.invalid.has(`${el.dataset.i},${el.dataset.j}`);
    el.classList.toggle('invalid', bad);
    if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
}

// ---------- Solve ----------
function onGameChanged(rebuild) {
  renderHeader();
  if (rebuild) buildMatrix();
  state.tryMix = null;
  recompute(true);
}

function recompute(force) {
  const g = game();
  const { M, bad } = parseAll();
  state.invalid = bad;
  markInvalid();
  const err = $('matrix-error');
  const shape = `${M.length}x${M[0].length}`;
  // A match (or its end screen) belongs to one game: reset it when the scenario, payoffs or orientation change.
  // Any match data (running, finished, or left behind via Back to setup) is cleared, Stats included.
  if (play.history && play.key !== gameKey(g, M)) abortMatch(play.active ? 'The game changed, so the match was reset.' : '', true);
  if (bad.size) {
    const [i, j] = [...bad][0].split(',').map(Number);
    err.textContent = `${rowLabel(g, i)} vs ${colLabel(g, j)} needs a number. Showing the last valid solution.`;
    // Keep this scenario's own last valid solution; never borrow another scenario's.
    const prev = state.solved[state.id];
    if (prev && prev.sol.shape === shape && prev.max === g.rowMaximizes) {
      if (state.sol !== prev.sol) { state.sol = prev.sol; state.M = prev.M; state.solMax = prev.max; state.solId = state.id; resetLearn(); }
    } else {
      // No valid solution for this shape yet: solve with invalid cells read as 0 so the view stays consistent.
      setSolution(g, M, false);
      resetLearn();
    }
    ensureTryMix();
    renderOutputs();
    if (state.mode === 'play' && !play.active) renderSetup();
    return;
  }
  err.textContent = '';
  const changed = !state.M || JSON.stringify(state.M) !== JSON.stringify(M) || state.solMax !== g.rowMaximizes || state.solId !== state.id;
  g.matrix = M;
  if (changed || force) {
    setSolution(g, M, true);
    resetLearn();
  }
  ensureTryMix();
  renderOutputs();
  if (state.mode === 'play' && !play.active) renderSetup();
}

// A match's identity includes the payoffs, so any edit retires a running match or a finished end screen.
function gameKey(g, M) { return `${state.id}|${g.rowMaximizes ? 'max' : 'min'}|${JSON.stringify(M)}`; }

function setSolution(g, M, valid) {
  const sol = solveZeroSum(M, g.rowMaximizes);
  sol.dom = dominated(M, g.rowMaximizes);
  sol.shape = `${M.length}x${M[0].length}`;
  state.sol = sol; state.M = M.map(r => r.slice()); state.solMax = g.rowMaximizes; state.solId = state.id;
  if (valid) state.solved[state.id] = { sol, M: state.M, max: g.rowMaximizes };
  ensureTryMix();
}
function ensureTryMix() {
  const m = state.M ? state.M.length : 0;
  if (m && (!state.tryMix || state.tryMix.length !== m || !state.tryMix.every(p => isFinite(p)))) state.tryMix = state.M.map(() => 1 / m);
}
// Probability scoring only makes sense when every payoff is a probability.
const inUnit = M => M.every(r => r.every(v => v >= 0 && v <= 1));
function rangeWarning(g, M) {
  return (g.unit === 'prob' || g.unit === 'woba') && !inUnit(M)
    ? 'Some payoffs are outside 0 to 1, so they are no longer probabilities. The solver still works; Play scores each round by its payoff instead of sampling a win or loss.'
    : '';
}

function renderOutputs() {
  const g = game(), sol = state.sol, M = state.M;
  if (!sol) return;
  // chips
  const chips = [];
  chips.push(sol.verified ? '<span class="chip ok">Verified</span>' : '<span class="chip bad">Solver mismatch</span>');
  if (sol.saddle) chips.push('<span class="chip info">Saddle point</span>');
  if (sol.notUnique) chips.push('<span class="chip info">Not unique</span>');
  if (state.invalid.size) chips.push('<span class="chip bad">Input error</span>');
  $('chips').innerHTML = chips.join('');
  // tints relative to the value, from the row player's point of view
  const v = sol.value;
  let maxDev = 0;
  M.forEach(r => r.forEach(x => { maxDev = Math.max(maxDev, Math.abs(x - v)); }));
  document.querySelectorAll('#matrix .cell').forEach(el => {
    const i = +el.dataset.i, j = +el.dataset.j;
    if (state.invalid.has(`${i},${j}`) || !M[i] || M[i][j] === undefined) { el.style.backgroundColor = ''; return; }
    const fav = (g.rowMaximizes ? 1 : -1) * (M[i][j] - v);
    const a = maxDev > 1e-12 ? Math.min(1, Math.abs(fav) / maxDev) : 0;
    const rgb = fav >= 0 ? [242, 164, 58] : [60, 196, 214];
    el.style.backgroundColor = a < 0.02 ? '#ffffff' : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.12 + 0.5 * a).toFixed(3)})`;
  });
  // dominance badges
  const dr = new Map(sol.dom.rows.map(d => [d.index, d.by])), dc = new Map(sol.dom.cols.map(d => [d.index, d.by]));
  g.rows.forEach((_, i) => { const b = $('rb-' + i); if (b) b.hidden = !dr.has(i); });
  g.cols.forEach((_, j) => { const b = $('cb-' + j); if (b) b.hidden = !dc.has(j); });
  const domText = [...[...dr].map(([i, by]) => `${rowName(g)} ${rowLabel(g, i)} is strictly dominated by ${rowLabel(g, by)}`),
    ...[...dc].map(([j, by]) => `${colName(g)} ${colLabel(g, j)} is strictly dominated by ${colLabel(g, by)}`)];
  $('dom-line').textContent = domText.length ? domText.join('. ') + '.' : '';
  $('range-note').textContent = rangeWarning(g, M);
  // value
  $('value').textContent = fmt(v);
  // bars
  $('eq-bars').innerHTML = mixBar(sol.x, g.rows.map((_, i) => rowLabel(g, i)), 'r', `${rowName(g)} mix`) +
    mixBar(sol.y, g.cols.map((_, j) => colLabel(g, j)), 'c', `${colName(g)} mix`);
  applySizes($('eq-bars'));
  renderIndifference();
  renderGeometry();
  renderTry();
}

// Bar widths are set through the CSSOM rather than inline style attributes.
function applySizes(root) {
  root.querySelectorAll('[data-grow]').forEach(el => { el.style.flexGrow = el.dataset.grow; });
  root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
}

function mixBar(mix, labels, side, title) {
  const segs = mix.map((p, k) => {
    const w = p * 100;
    const txt = w >= 22 ? `${esc(labels[k])} ${w.toFixed(0)}%` : w >= 9 ? `${w.toFixed(0)}%` : '';
    return `<div class="seg-bar ${side}${k}${p < 1e-9 ? ' zero' : ''}" data-grow="${p.toFixed(6)}" aria-hidden="true">${txt}</div>`;
  }).join('');
  const legend = mix.map((p, k) => `<li><span class="dot ${side}${k}" aria-hidden="true"></span>${esc(labels[k])} <span class="num">${pct(p)}</span></li>`).join('');
  return `<div class="mixbar"><div class="mixbar-title ${side}"><span>${esc(title)}</span></div><div class="stack">${segs}</div><ul class="mix-legend" aria-label="${esc(title)}">${legend}</ul></div>`;
}

function renderIndifference() {
  const g = game(), sol = state.sol, M = state.M;
  const rp = rowPayoffs(M, sol.y), cp = colPayoffs(M, sol.x);
  const rn = rowName(g), cn = colName(g);
  const item = (label, val, on, kind) => {
    const worse = Math.abs(val - sol.value) < 1e-6 ? 'equal'
      : kind === 'r' ? (g.rowMaximizes ? 'lower' : 'higher') : (g.rowMaximizes ? 'higher' : 'lower');
    return `<li class="${on ? 'on' : 'off'}" data-v="${val.toFixed(6)}"><span>${esc(label)}${on ? '' : ` <span class="tag">(not in mix, ${worse})</span>`}</span><span class="num">${fmt(val)}</span></li>`;
  };
  const rItems = rp.map((val, i) => item(rowLabel(g, i), val, sol.x[i] > 1e-6, 'r')).join('');
  const cItems = cp.map((val, j) => item(colLabel(g, j), val, sol.y[j] > 1e-6, 'c')).join('');
  $('indiff').innerHTML = `
    <div><p class="lead">If the ${esc(cn.toLowerCase())} uses the equilibrium mix, every ${esc(g.rowAct)} in the ${esc(rn.toLowerCase())}'s mix ${esc(g.rowVerb)} <b class="mono">${fmt(sol.value)}</b>.</p><ul id="indiff-rows" aria-label="${esc(rn)} actions against the ${esc(cn)} equilibrium mix">${rItems}</ul></div>
    <div><p class="lead">If the ${esc(rn.toLowerCase())} uses the equilibrium mix, every ${esc(g.colAct)} in the ${esc(cn.toLowerCase())}'s mix ${esc(g.colVerb)} <b class="mono">${fmt(sol.value)}</b>.</p><ul id="indiff-cols" aria-label="${esc(cn)} actions against the ${esc(rn)} equilibrium mix">${cItems}</ul></div>
    ${sol.notUnique ? '<p class="summary">Not unique: an action outside the mix also earns the game value, so other equilibrium mixes exist. One is shown.</p>' : ''}
    ${sol.saddle ? '<p class="summary">Saddle point: each side has a single best action, so no randomising is needed.</p>' : ''}`;
}

// ---------- Geometry (SVG) ----------
function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || 1, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= count) || 10 * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-12; t += step) out.push(+t.toFixed(10));
  return out;
}
const DASHES = ['', '8 5', '2 4', '10 4 2 4'];

function renderGeometry() {
  const g = game(), sol = state.sol, M = state.M;
  if (!sol || state.mode !== 'solve') return;
  const m = M.length, n = M[0].length, holder = $('geo-svg');
  if (m === 2) lineView(g, M, sol, 'row', holder);
  else if (n === 2) lineView(g, M, sol, 'col', holder);
  else if (m === 3) simplexView(g, M, sol, holder);
  else {
    holder.innerHTML = '<p class="note-box">With 4 row actions and 3 or more column actions there is no flat picture of every mix. The equilibrium bars and the indifference lists above carry the full solution.</p>';
    $('geo-summary').textContent = '';
    $('geo-table').innerHTML = '';
    $('geo-table-btn').hidden = true;
    return;
  }
  $('geo-table-btn').hidden = false;
}

function lineView(g, M, sol, side, holder) {
  const W = 640, H = 330, L = 58, R = 120, T = 22, B = 56;
  const pw = W - L - R, ph = H - T - B;
  const isRow = side === 'row';
  const lines = isRow
    ? M[0].map((_, j) => ({ a: M[1][j], b: M[0][j], label: colLabel(g, j) }))   // value at p=0 is a, at p=1 is b
    : M.map((r, i) => ({ a: r[1], b: r[0], label: rowLabel(g, i) }));
  // whose guarantee is drawn: row view = row player's worst case; col view = column player's worst case
  const takeMin = isRow ? g.rowMaximizes : !g.rowMaximizes;
  const env = p => { const vals = lines.map(l => l.a + (l.b - l.a) * p); return takeMin ? Math.min(...vals) : Math.max(...vals); };
  const bps = [0, 1];
  for (let s = 0; s < lines.length; s++) for (let t = s + 1; t < lines.length; t++) {
    const d = (lines[s].b - lines[s].a) - (lines[t].b - lines[t].a);
    if (Math.abs(d) > 1e-12) { const p = (lines[t].a - lines[s].a) / d; if (p > 0 && p < 1) bps.push(p); }
  }
  bps.sort((a, b) => a - b);
  let lo = Infinity, hi = -Infinity;
  M.forEach(r => r.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = p => L + p * pw, Y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
  const own = isRow ? C.row : C.col, other = isRow ? C.col : C.row;
  const labels0 = isRow ? [rowLabel(g, 1), rowLabel(g, 0)] : [colLabel(g, 1), colLabel(g, 0)];
  const actor = isRow ? rowName(g) : colName(g);
  const opp = isRow ? colName(g) : rowName(g);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="geo-summary">`;
  for (const t of niceTicks(lo, hi)) {
    s += `<line x1="${L}" x2="${L + pw}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="#e3e5dd" stroke-width="1"/>`;
    s += `<text x="${L - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="${C.soft}" font-family="${MONO}">${esc(fmt(t, g))}</text>`;
  }
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    s += `<line x1="${X(p)}" x2="${X(p)}" y1="${T + ph}" y2="${T + ph + 5}" stroke="${C.ink}"/>`;
    s += `<text x="${X(p)}" y="${T + ph + 19}" text-anchor="middle" font-size="12" fill="${C.soft}" font-family="${MONO}">${p * 100}%</text>`;
  }
  s += `<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="${C.ink}" stroke-width="1.5"/>`;
  s += `<text x="${L + pw / 2}" y="${H - 10}" text-anchor="middle" font-size="13" fill="${C.ink}" font-family="${FONT}">${esc(actor)} share of ${esc(labels0[1])} (rest ${esc(labels0[0])})</text>`;
  // opponent pure-strategy lines with direct labels
  const ends = [];
  lines.forEach((l, k) => {
    s += `<line x1="${X(0)}" y1="${Y(l.a).toFixed(1)}" x2="${X(1)}" y2="${Y(l.b).toFixed(1)}" stroke="${other}" stroke-width="2" stroke-dasharray="${DASHES[k % 4]}" opacity="0.85"/>`;
    ends.push({ y: Y(l.b), label: `${opp}: ${l.label}` });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
  ends.forEach(e => { s += `<text x="${X(1) + 6}" y="${(e.y + 4).toFixed(1)}" font-size="12" fill="${C.ink}" font-family="${FONT}">${esc(e.label.length > 18 ? e.label.slice(0, 17) + '…' : e.label)}</text>`; });
  // envelope
  const pts = bps.map(p => `${X(p).toFixed(1)},${Y(env(p)).toFixed(1)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="${isRow ? C.rowFill : C.colFill}" stroke-width="5" stroke-linejoin="round"/>`;
  // try-a-mix marker (row view only)
  if (isRow && state.tryMix) {
    const p = state.tryMix[0];
    s += `<line x1="${X(p).toFixed(1)}" x2="${X(p).toFixed(1)}" y1="${T}" y2="${T + ph}" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<rect x="${(X(p) - 5).toFixed(1)}" y="${(Y(env(p)) - 5).toFixed(1)}" width="10" height="10" fill="${C.accent}" stroke="#fff" stroke-width="2" transform="rotate(45 ${X(p).toFixed(1)} ${Y(env(p)).toFixed(1)})"/>`;
  }
  const pStar = isRow ? sol.x[0] : sol.y[0];
  const cx = X(pStar), cy = Y(sol.value);
  s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${C.ink}" stroke="#fff" stroke-width="2.5"/>`;
  const tag = `${isRow ? (g.rowMaximizes ? 'Maximin' : 'Minimax') : (g.rowMaximizes ? 'Minimax' : 'Maximin')}: ${pct(pStar, 0)}, ${fmt(sol.value, g)}`;
  const tx = Math.min(Math.max(cx, L + 70), L + pw - 70);
  const ty = cy - 14 < T + 10 ? cy + 26 : cy - 14;
  s += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.ink}" font-family="${FONT}" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(tag)}</text>`;
  s += '</svg>';
  holder.innerHTML = s;
  const best = takeMin ? 'peak' : 'lowest point';
  $('geo-summary').textContent = `Each thin line is one ${opp.toLowerCase()} action, showing the payoff as the ${actor.toLowerCase()}'s share of ${labels0[1]} goes from 0% to 100%. The thick line is the ${actor.toLowerCase()}'s guaranteed payoff, the ${takeMin ? 'lower' : 'upper'} envelope, because the ${opp.toLowerCase()} can always pick the worst line for them. Its ${best} is the equilibrium: ${pct(pStar)} ${labels0[1]}, worth ${fmt(sol.value, g)}.${isRow ? ' The blue diamond is your mix from Try a mix.' : ''}`;
  const rowsT = [];
  for (let k = 0; k <= 10; k++) rowsT.push(k / 10);
  if (!rowsT.some(p => Math.abs(p - pStar) < 1e-6)) rowsT.push(pStar);
  rowsT.sort((a, b) => a - b);
  $('geo-table').innerHTML = `<table class="data"><caption class="sr-only">Payoff of each ${esc(opp)} action by ${esc(actor)} mix</caption><thead><tr><th scope="col">Share of ${esc(labels0[1])}</th>${lines.map(l => `<th scope="col">${esc(l.label)}</th>`).join('')}<th scope="col">Guaranteed</th></tr></thead><tbody>${rowsT.map(p => `<tr><td>${pct(p)}${Math.abs(p - pStar) < 1e-9 ? ' (equilibrium)' : ''}</td>${lines.map(l => `<td>${fmt(l.a + (l.b - l.a) * p, g)}</td>`).join('')}<td>${fmt(env(p), g)}</td></tr>`).join('')}</tbody></table>`;
}

function simplexView(g, M, sol, holder) {
  const W = 640, H = 360;
  const V = [[320, 34], [92, 318], [548, 318]];
  const P = x => [x[0] * V[0][0] + x[1] * V[1][0] + x[2] * V[2][0], x[0] * V[0][1] + x[1] * V[1][1] + x[2] * V[2][1]];
  const guar = x => rowMixReport(M, g.rowMaximizes, x).guaranteed;
  const fav = x => (g.rowMaximizes ? 1 : -1) * guar(x);
  const N = 24, tris = [];
  let fmin = Infinity, fmax = -Infinity;
  for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
    const k = N - i - j;
    const a = [i, j, k], b = [i + 1, j, k - 1], c = [i, j + 1, k - 1];
    const add = (p1, p2, p3) => { const cen = [0, 1, 2].map(d => (p1[d] + p2[d] + p3[d]) / (3 * N)); const f = fav(cen); fmin = Math.min(fmin, f); fmax = Math.max(fmax, f); tris.push({ pts: [p1, p2, p3].map(p => P(p.map(t => t / N))), f }); };
    if (k >= 1) add(a, b, c);
    if (k >= 2) add(b, [i + 1, j + 1, k - 2], c);
  }
  const lerp = t => { const a = [250, 246, 236], b = [214, 120, 8]; return `rgb(${a.map((v, d) => Math.round(v + (b[d] - v) * t)).join(',')})`; };
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="geo-summary">`;
  for (const t of tris) {
    const u = fmax - fmin > 1e-12 ? (t.f - fmin) / (fmax - fmin) : 0.5;
    s += `<polygon points="${t.pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${lerp(u)}" stroke="${lerp(u)}" stroke-width="0.6"/>`;
  }
  s += `<polygon points="${V.map(v => v.join(',')).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  const vl = [[V[0][0], V[0][1] - 12, 'middle'], [V[1][0] - 6, V[1][1] + 22, 'start'], [V[2][0] + 6, V[2][1] + 22, 'end']];
  vl.forEach((p, i) => { s += `<text x="${p[0]}" y="${p[1]}" text-anchor="${p[2]}" font-size="14" font-weight="700" fill="${C.row}" font-family="${FONT}">All ${esc(rowLabel(g, i))}</text>`; });
  if (state.tryMix) {
    const [tx, ty] = P(state.tryMix);
    s += `<rect x="${(tx - 6).toFixed(1)}" y="${(ty - 6).toFixed(1)}" width="12" height="12" fill="${C.accent}" stroke="#fff" stroke-width="2" transform="rotate(45 ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`;
  }
  const [ex, ey] = P(sol.x);
  s += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="8" fill="${C.ink}" stroke="#fff" stroke-width="3"/>`;
  s += `<text x="${ex.toFixed(1)}" y="${(ey - 14).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.ink}" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="${FONT}">Equilibrium ${esc(fmt(sol.value, g))}</text>`;
  // legend
  const lx = 20, ly = 40;
  for (let k = 0; k < 10; k++) s += `<rect x="${lx}" y="${ly + (9 - k) * 14}" width="16" height="14" fill="${lerp(k / 9)}"/>`;
  const fv = f => fmt((g.rowMaximizes ? 1 : -1) * f, g);
  s += `<text x="${lx + 22}" y="${ly + 10}" font-size="12" fill="${C.ink}" font-family="${MONO}">${esc(fv(fmax))}</text>`;
  s += `<text x="${lx + 22}" y="${ly + 140}" font-size="12" fill="${C.ink}" font-family="${MONO}">${esc(fv(fmin))}</text>`;
  s += `<text x="${lx}" y="${ly - 12}" font-size="12" fill="${C.soft}" font-family="${FONT}">Guaranteed</text>`;
  s += '</svg>';
  holder.innerHTML = s;
  $('geo-summary').textContent = `Every point in the triangle is a ${rowName(g).toLowerCase()} mix of ${g.rows.map((_, i) => rowLabel(g, i)).join(', ')}; the corners are pure actions. Shading shows the payoff the ${rowName(g).toLowerCase()} is guaranteed against the ${colName(g).toLowerCase()}'s best reply, deeper amber is better for the ${rowName(g).toLowerCase()}. The black dot is the equilibrium mix (${sol.x.map((p, i) => `${rowLabel(g, i)} ${pct(p)}`).join(', ')}), the best guarantee: ${fmt(sol.value, g)}. The blue diamond is your mix from Try a mix.`;
  const samples = [
    ...[0, 1, 2].map(i => ({ name: `All ${rowLabel(g, i)}`, x: [0, 1, 2].map(d => (d === i ? 1 : 0)) })),
    { name: 'Even mix', x: [1 / 3, 1 / 3, 1 / 3] },
    { name: 'Equilibrium', x: sol.x },
  ];
  $('geo-table').innerHTML = `<table class="data"><caption class="sr-only">Guaranteed payoff for sample mixes</caption><thead><tr><th scope="col">Mix</th>${g.rows.map((_, i) => `<th scope="col">${esc(rowLabel(g, i))}</th>`).join('')}<th scope="col">Guaranteed</th></tr></thead><tbody>${samples.map(r => `<tr><td>${esc(r.name)}</td>${r.x.map(p => `<td>${pct(p)}</td>`).join('')}<td>${fmt(guar(r.x), g)}</td></tr>`).join('')}</tbody></table>`;
}

// ---------- Try a mix ----------
function renderTry() {
  const g = game(), m = state.M.length;
  const holder = $('try-sliders');
  const sig = `${state.id}|${m}|${g.rows.join('|')}`;
  if (holder.dataset.sig !== sig) {
    holder.dataset.sig = sig;
    if (m === 2) {
      holder.innerHTML = `<div class="slider-row"><label for="try-0">Share of ${esc(rowLabel(g, 0))}</label><input id="try-0" type="range" min="0" max="100" step="1" data-k="0"><output id="try-o0" for="try-0"></output></div>`;
      $('try-hint').textContent = `Set your own ${rowName(g).toLowerCase()} mix. The ${colName(g).toLowerCase()} sees it and picks the reply that hurts you most.`;
    } else {
      holder.innerHTML = state.M.map((_, i) => `<div class="slider-row"><label for="try-${i}">Weight on ${esc(rowLabel(g, i))}</label><input id="try-${i}" type="range" min="0" max="100" step="1" data-k="${i}"><output id="try-o${i}" for="try-${i}"></output></div>`).join('');
      $('try-hint').textContent = `Set weights for your own ${rowName(g).toLowerCase()} mix (they are scaled to 100%). The ${colName(g).toLowerCase()} sees it and picks the reply that hurts you most.`;
    }
  }
  syncTrySliders();
  renderTryOut();
}
function syncTrySliders() {
  const mix = state.tryMix, m = mix.length;
  if (m === 2) { const el = $('try-0'); if (el) { el.value = String(Math.round(mix[0] * 100)); $('try-o0').textContent = pct(mix[0], 0); } }
  else {
    const mx = Math.max(...mix);
    mix.forEach((p, i) => { const el = $('try-' + i); if (el) { el.value = String(mx > 0 ? Math.round(p / mx * 100) : 0); $('try-o' + i).textContent = pct(p, 0); } });
  }
}
function renderTryOut() {
  const g = game(), sol = state.sol, mix = state.tryMix;
  const rep = rowMixReport(state.M, g.rowMaximizes, mix);
  const gap = Math.max(0, g.rowMaximizes ? sol.value - rep.guaranteed : rep.guaranteed - sol.value);
  $('try-bar').innerHTML = mixBar(mix, g.rows.map((_, i) => rowLabel(g, i)), 'r', `Your ${rowName(g).toLowerCase()} mix`);
  applySizes($('try-bar'));
  const gapZero = gap < 5e-7;
  $('try-out').innerHTML = `<dt>Guaranteed payoff</dt><dd id="try-guar">${fmt(rep.guaranteed)}</dd>
    <dt>${esc(colName(g))}'s best reply</dt><dd id="try-br">${esc(colLabel(g, rep.bestResponse))}</dd>
    <dt>Exploitability gap</dt><dd id="try-gap" class="${gapZero ? 'gap-ok' : 'gap-bad'}">${gapZero ? '0, unexploitable' : fmtDelta(gap)}</dd>`;
  if (state.M.length === 2 && state.mode === 'solve') renderGeometry();
  else if (state.M.length === 3 && state.M[0].length >= 3 && state.mode === 'solve') renderGeometry();
}
function initTry() {
  $('try-sliders').addEventListener('input', e => {
    const el = e.target; if (!el.dataset || el.dataset.k === undefined) return;
    const m = state.tryMix.length;
    if (m === 2) { const p = Math.min(1, Math.max(0, +el.value / 100)); state.tryMix = [p, 1 - p]; $('try-o0').textContent = pct(p, 0); }
    else {
      const w = state.tryMix.map((_, i) => +($('try-' + i).value) || 0);
      const s = w.reduce((a, b) => a + b, 0);
      state.tryMix = s > 0 ? w.map(v => v / s) : w.map(() => 1 / m);
      state.tryMix.forEach((p, i) => { $('try-o' + i).textContent = pct(p, 0); });
    }
    renderTryOut();
  });
  $('try-eq').addEventListener('click', () => { state.tryMix = state.sol.x.slice(); syncTrySliders(); renderTryOut(); });
  $('try-uniform').addEventListener('click', () => { state.tryMix = state.tryMix.map(() => 1 / state.tryMix.length); syncTrySliders(); renderTryOut(); });
}

// ---------- Play ----------
const play = { active: false };

function playCtx() {
  const g = game(), side = sideValue();
  const userMax = (side === 'row') === g.rowMaximizes;
  const sampled = isSampled(g, state.M);
  const toUser = v => (userMax ? v : (sampled ? 1 - v : -v));
  return { g, side, userMax, sampled, toUser };
}
function sideValue() { const el = document.querySelector('input[name=side]:checked'); return el ? el.value : 'row'; }
const radioValue = name => { const el = document.querySelector(`input[name=${name}]:checked`); return el ? el.value : null; };

function renderSetup() {
  const g = game(), cur = sideValue();
  $('side-seg').innerHTML = `<label><input type="radio" name="side" value="row"${cur === 'row' ? ' checked' : ''}> ${esc(rowName(g))}</label><label><input type="radio" name="side" value="col"${cur === 'col' ? ' checked' : ''}> ${esc(colName(g))}</label>`;
  $('diff-note').textContent = DIFF[radioValue('diff') || 'normal'].text;
  $('score-mode').textContent = !state.M ? '' : isSampled(g, state.M)
    ? `Scoring: each payoff is a probability, so every round is a win or a loss drawn at that chance. Luck-free value removes the dice.`
    : `Scoring: each round scores its payoff directly${rangeWarning(g, state.M) ? ' (some payoffs are outside 0 to 1, so they are not treated as probabilities)' : ''}.`;
  renderBestLine($('best-line'));
  if (play.notice) $('best-line').textContent = `${play.notice} ${$('best-line').textContent}`.trim();
}
// Best results are kept per scenario, side, difficulty and exact payoffs, so edited games never mix.
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function bestKey(M, side, diff, max) { return `msa-best-v2:${state.id}:${side}:${diff}:${hashStr(JSON.stringify(M) + (max ? 'max' : 'min'))}`; }
const currentBestKey = () => (state.M ? bestKey(state.M, sideValue(), radioValue('diff') || 'normal', game().rowMaximizes) : '');
function isEdited() {
  const base = SCENARIOS.find(s => s.id === state.id);
  return state.id !== 'custom' && !!state.M && JSON.stringify(state.M) !== JSON.stringify(base.matrix);
}
function renderBestLine(el, key = currentBestKey(), side = sideValue(), diff = radioValue('diff') || 'normal') {
  const b = key ? store.get(key) : null, g = game();
  const who = side === 'row' ? rowName(g) : colName(g);
  const where = `${who} on ${diff[0].toUpperCase() + diff.slice(1)}${isEdited() ? ' with these edited payoffs' : ''}`;
  el.textContent = b && isFinite(b.leak) ? `Your best as ${where}: ${Math.abs(b.leak) <= 0.05 ? 'level with the equilibrium' : b.leak < 0 ? `no leak, ${(-b.leak).toFixed(1)} per 100 above the equilibrium` : `leaked ${b.leak.toFixed(1)} per 100`} over ${b.rounds} ${g.noun}.` : '';
}

function newSeed() { return String(Math.floor(Math.random() * 1e9)); }

function startMatch() {
  if (state.invalid.size) { setMode('solve'); const bad = document.querySelector('#matrix .cell.invalid'); if (bad) bad.focus(); return; }
  const { g, side, userMax, sampled, toUser } = playCtx();
  const seedTxt = $('seed').value.trim();
  let seed = /^\d{1,10}$/.test(seedTxt) ? Number(seedTxt) : NaN;
  if (!isFinite(seed)) { seed = Number(newSeed()); $('seed').value = String(seed); }
  const diff = DIFF[radioValue('diff') || 'normal'];
  const M = state.M.map(r => r.slice()), A = canonical(M, g.rowMaximizes), sol = state.sol;
  Object.assign(play, {
    active: true, over: false, reveal: false, notice: '', g, side, userMax, sampled, toUser, M, A, sol,
    rounds: +(radioValue('rounds') || 30), diff, diffName: radioValue('diff') || 'normal', seed, rng: mulberry32(seed), key: gameKey(g, M),
    userActs: side === 'row' ? g.rows.map((_, i) => rowLabel(g, i)) : g.cols.map((_, j) => colLabel(g, j)),
    aiActs: side === 'row' ? g.cols.map((_, j) => colLabel(g, j)) : g.rows.map((_, i) => rowLabel(g, i)),
    eqUser: side === 'row' ? sol.x : sol.y, eqAI: side === 'row' ? sol.y : sol.x,
    vUser: toUser(sol.value), history: [], aiHistory: [], outcomes: [], gains: [], evs: [], ctxWin: [], hits: 0, preds: 0, cumScore: [0], cumEV: [0], last: null,
  });
  $('setup').hidden = true; $('end').hidden = true; $('game').hidden = false;
  $('actions').hidden = false; $('keys').hidden = false; $('btn-quit').hidden = false;
  $('round-total').textContent = String(play.rounds);
  $('maxkey').textContent = String(play.userActs.length);
  const youCls = side === 'row' ? 'r' : 'c', aiCls = side === 'row' ? 'c' : 'r';
  $('prompt').innerHTML = `You are the <span class="${youCls}">${esc(side === 'row' ? rowName(g) : colName(g))}</span>. The AI is the <span class="${aiCls}">${esc(side === 'row' ? colName(g) : rowName(g))}</span>. Choose your action.`;
  $('actions').innerHTML = play.userActs.map((a, k) => `<button type="button" class="act side-${youCls}" data-a="${k}"><span class="k" aria-hidden="true">${k + 1}</span>${esc(a)}</button>`).join('');
  $('reveal').innerHTML = ''; $('live').textContent = `Match started: ${play.rounds} ${g.noun}. Press 1 to ${play.userActs.length} to choose.`;
  $('btn-next').hidden = true;
  updateRound(); renderStats();
  $('actions').querySelector('button').focus();
}

function updateRound() { $('round-no').textContent = String(Math.min(play.history.length + 1, play.rounds)); }

function playRound(a) {
  if (!play.active || play.over) return;
  if (play.reveal) nextRound(false);
  const { A, side, M } = play;
  const mv = aiMove({ A, history: play.history, aiIsRow: side === 'col', eq: play.eqAI, order: play.diff.order, epsilon: play.diff.epsilon, rng: play.rng });
  if (mv.predicted !== null) { play.preds++; if (mv.predicted === a) play.hits++; }
  const ri = side === 'row' ? a : mv.action, cj = side === 'row' ? mv.action : a;
  const p = M[ri][cj];
  const outcome = play.sampled ? (play.rng() < p ? 1 : 0) : p;
  const gain = play.toUser(outcome), ev = play.toUser(p);
  play.history.push(a); play.gains.push(gain); play.evs.push(ev); play.outcomes.push(outcome); play.aiHistory.push(mv.action);
  play.ctxWin.push(gain > play.vUser + 1e-12 ? 1 : gain < play.vUser - 1e-12 ? 0 : -1);
  play.cumScore.push(play.cumScore[play.cumScore.length - 1] + gain);
  play.cumEV.push(play.cumEV[play.cumEV.length - 1] + ev);
  play.last = { a, ai: mv.action, mode: mv.mode, predicted: mv.predicted, outcome, gain };
  showReveal();
  renderStats();
  if (play.history.length >= play.rounds) endMatch();
  else { play.reveal = true; $('btn-next').hidden = false; $('btn-next').focus(); }
}

// Sampled round label. Outcome 1 means the payoff event happened; who that favours depends on
// whether the row player maximises. Presets name the events themselves (Goal / Saved, ...).
function outcomeLabel(g, outcome) {
  if (outcome === 1 && g.hit) return g.hit;
  if (outcome === 0 && g.miss) return g.miss;
  const rowWins = (outcome === 1) === g.rowMaximizes;
  return `${rowWins ? rowName(g) : colName(g)} wins`;
}

function resultWord(gain) {
  const { g, sampled, last, side } = play;
  if (sampled) {
    const label = outcomeLabel(g, last.outcome);
    return { label, cls: gain > 0.5 ? 'win' : 'lose' };
  }
  const sign = gain > 1e-12 ? '+' : '';
  return { label: `${gain > 1e-12 ? 'You win' : gain < -1e-12 ? 'You lose' : 'Even'} ${sign}${fmt(gain, g)}`, cls: gain > 1e-12 ? 'win' : gain < -1e-12 ? 'lose' : '' };
}

function showReveal() {
  const { last, userActs, aiActs, side, g } = play;
  const youCls = side === 'row' ? 'r' : 'c', aiCls = side === 'row' ? 'c' : 'r';
  const rw = resultWord(last.gain);
  const rv = $('reveal');
  rv.innerHTML = `<span class="pill ${youCls}">You: ${esc(userActs[last.a])}</span><span class="pill ${aiCls}">AI: ${esc(aiActs[last.ai])}</span><span class="result ${rw.cls}">${esc(rw.label)}</span><span class="ai-mode">${last.mode === 'exploit' ? `The AI's forecast had ${esc(userActs[last.predicted])} as your most likely move; it played the best answer to its whole forecast of your moves.` : 'The AI played its equilibrium mix this round.'}</span>`;
  rv.classList.remove('pop'); void rv.offsetWidth; if (!reduceMotion()) rv.classList.add('pop');
  document.querySelectorAll('#actions .act').forEach(b => { const k = +b.dataset.a; b.classList.toggle('chosen', k === last.a); b.classList.toggle('dim', k !== last.a); });
  const t = play.history.length;
  $('live').textContent = `Round ${t}: you chose ${userActs[last.a]}, the AI chose ${aiActs[last.ai]}. ${rw.label}. Your points: ${fmtScore(play.cumScore[t])} of ${t}.`;
}
function fmtScore(v) { return String(+v.toFixed(3)).replace('-', '−'); }

function nextRound(focus = true) {
  if (!play.active || play.over) return;
  play.reveal = false;
  $('btn-next').hidden = true;
  $('reveal').innerHTML = '';
  document.querySelectorAll('#actions .act').forEach(b => b.classList.remove('chosen', 'dim'));
  updateRound();
  if (focus) { const b = play.last && document.querySelector(`#actions .act[data-a="${play.last.a}"]`); (b || document.querySelector('#actions .act')).focus(); }
}

function findPattern() {
  const { history: h, ctxWin, eqUser, userActs, g, side } = play, n = userActs.length;
  let best = null;
  const consider = (phrase, idx) => {
    if (idx.length < 3) return;
    const counts = new Array(n).fill(0);
    idx.forEach(t => counts[h[t]]++);
    const k = argmax(counts), share = counts[k] / idx.length, skew = share - eqUser[k];
    if (!best || skew > best.skew) best = { phrase, k, share, count: counts[k], total: idx.length, skew };
  };
  const after = cond => h.map((_, t) => t).filter(t => t >= 1 && cond(t - 1));
  for (let a = 0; a < n; a++) consider(`after choosing ${userActs[a]}`, after(t => h[t] === a));
  const labels = outcomeContextLabels();
  if (labels) {
    // Sampled preset: contexts come from the recorded outcome (1 = the "hit" event, e.g. a goal),
    // labelled from the user's side.
    consider(labels[0], after(t => play.outcomes[t] === 1));
    consider(labels[1], after(t => play.outcomes[t] === 0));
  } else {
    // ctxWin is from the user's view: 1 = better than the equilibrium value for the user
    consider('after winning a round', after(t => ctxWin[t] === 1));
    consider('after losing a round', after(t => ctxWin[t] === 0));
  }
  return best;
}
// g.after[side] = [label after outcome 1 (the "hit" event), label after outcome 0], worded for that side.
function outcomeContextLabels() {
  const { g, side, sampled } = play;
  return sampled && g.after && g.after[side] ? g.after[side] : null;
}

function endMatch() {
  play.over = true; play.active = false; play.reveal = false;
  const { rounds, g, vUser, evs } = play;
  const T = evs.length;
  const evSum = evs.reduce((a, b) => a + b, 0);
  const leak = T ? (vUser - evSum / T) * 100 : 0;
  const pat = T ? findPattern() : null;
  const n = play.userActs.length;
  const counts = new Array(n).fill(0); play.history.forEach(a => counts[a]++);
  let over = 0; for (let k = 1; k < n; k++) if (counts[k] / T - play.eqUser[k] > counts[over] / T - play.eqUser[over]) over = k;
  const strong = pat && pat.skew >= 0.15;
  let verdict;
  if (!T) verdict = 'Match ended before a ball was struck.';
  else if (leak > 0.05) {
    verdict = strong
      ? `You leaked ${leak.toFixed(1)} points per 100 ${g.noun}, while favouring ${play.userActs[pat.k]} ${pat.phrase}.`
      : `You leaked ${leak.toFixed(1)} points per 100 ${g.noun}, while over-playing ${play.userActs[over]}.`;
  } else if (leak < -0.05) verdict = `You held firm: your luck-free value beat the equilibrium by ${(-leak).toFixed(1)} points per 100 ${g.noun}.`;
  else verdict = `You held level: your luck-free value finished within 0.05 points per 100 ${g.noun} of the equilibrium.`;
  $('verdict').textContent = verdict;
  const caveat = leak > 0.05 ? ' The leak is your total shortfall against the equilibrium pace; this habit is the clearest one the AI could read, not a measured share of the loss.' : '';
  $('pattern').textContent = !T ? '' : (strong
    ? `Top exploitable pattern: ${pat.phrase}, you picked ${play.userActs[pat.k]} ${pat.count} of ${pat.total} times (${pct(pat.share, 0)}, equilibrium ${pct(play.eqUser[pat.k], 0)}). The AI predicted your move ${play.hits} of ${play.preds} times.`
    : `No strong pattern stood out after any single move or result. You chose ${play.userActs[over]} ${pct(counts[over] / T, 0)} of the time (equilibrium ${pct(play.eqUser[over], 0)}). The AI predicted your move ${play.hits} of ${play.preds} times.`) + caveat;
  if (T === rounds) {
    const key = bestKey(play.M, play.side, play.diffName, g.rowMaximizes);
    const prev = store.get(key);
    if (!prev || leak < prev.leak) { store.set(key, { leak, rounds, date: new Date().toISOString().slice(0, 10) }); $('end-best').textContent = 'New personal best for this scenario, side and difficulty.'; }
    else renderBestLine($('end-best'), key, play.side, play.diffName);
  } else $('end-best').textContent = '';
  $('btn-next').hidden = true;
  $('actions').hidden = true; $('keys').hidden = true; $('btn-quit').hidden = true;
  $('prompt').textContent = T ? `Final ${g.noun.replace(/s$/, '')}:` : '';
  $('game').hidden = false;
  $('end').hidden = false;
  $('live').textContent = `Full time. ${verdict}`;
  $('end').focus();
}

// clear = true retires the match completely (used when the game changes): its history, scores and
// accounting are dropped and every Stats output is redrawn empty, so nothing from the old game lingers.
function abortMatch(msg, clear = false) {
  play.active = false; play.over = false; play.notice = msg || '';
  if (clear) for (const k of Object.keys(play)) if (!['active', 'over', 'notice'].includes(k)) delete play[k];
  $('game').hidden = true; $('end').hidden = true; $('setup').hidden = false;
  renderSetup();
  if (clear) { renderStats(); if (!$('score-table').hidden) renderScoreTable(); }
}

function renderStats() {
  const P = play;
  if (!P.history) { $('predict').textContent = 'Start a match to see how readable you are.'; $('ev-account').textContent = 'Luck-free scoring appears here once you play.'; $('mix-compare').innerHTML = ''; $('score-summary').textContent = 'No rounds played yet.'; drawScoreChart(); return; }
  const T = P.history.length, n = P.userActs.length, g = P.g;
  const counts = new Array(n).fill(0); P.history.forEach(a => counts[a]++);
  $('mix-compare').innerHTML = P.userActs.map((a, k) => {
    const you = T ? counts[k] / T : 0, eq = P.eqUser[k];
    return `<div class="cmp"><span class="name">${esc(a)}</span><div class="line"><div class="track"><div class="fill you" data-w="${(you * 100).toFixed(1)}"></div></div><span class="lbl">you ${pct(you, 0)}</span></div><div class="line"><div class="track"><div class="fill eq" data-w="${(eq * 100).toFixed(1)}"></div></div><span class="lbl">equil. ${pct(eq, 0)}</span></div></div>`;
  }).join('');
  applySizes($('mix-compare'));
  $('predict').innerHTML = P.preds
    ? `The AI predicted your next move <b>${P.hits} of ${P.preds}</b> times (<b id="hit-rate" data-v="${(P.hits / P.preds).toFixed(4)}">${pct(P.hits / P.preds, 0)}</b>). Pure guessing would hit <b>${pct(1 / n, 0)}</b>.`
    : `No predictions yet: with no history the AI plays the equilibrium. Pure guessing would hit <b>${pct(1 / n, 0)}</b>.`;
  const evSum = P.cumEV[T], eqPace = P.vUser * T;
  $('ev-account').innerHTML = `Matrix value of the action pairs you actually played: <b id="ev-sum" data-v="${evSum.toFixed(6)}">${fmtScore(evSum)}</b> vs equilibrium pace <b id="ev-pace" data-v="${eqPace.toFixed(6)}">${fmtScore(eqPace)}</b> over ${T} ${g.noun} (${evSum >= eqPace - 1e-9 ? 'ahead by' : 'behind by'} <b>${fmtScore(Math.abs(evSum - eqPace))}</b>). Your actual points: <b id="actual-pts" data-v="${P.cumScore[T].toFixed(6)}">${fmtScore(P.cumScore[T])}</b>.`;
  $('score-summary').textContent = T ? `After ${T} ${g.noun}: your points ${fmtScore(P.cumScore[T])}, luck-free value ${fmtScore(evSum)}, equilibrium pace ${fmtScore(eqPace)}.` : 'No rounds played yet.';
  if (!$('score-table').hidden) renderScoreTable();
  drawScoreChart();
}
function renderScoreTable() {
  const P = play;
  if (!P.history || !P.history.length) { $('score-table').innerHTML = '<p class="summary">No rounds yet.</p>'; return; }
  const T = P.history.length, g = P.g;
  const result = t => (P.sampled ? outcomeLabel(g, P.outcomes[t]) : `${P.gains[t] > 0 ? '+' : ''}${fmtScore(P.gains[t])}`);
  const rowsHTML = P.history.map((a, i) => `<tr data-outcome="${P.outcomes[i]}"><td>${i + 1}</td><td>${esc(P.userActs[a])}</td><td>${esc(P.aiActs[P.aiHistory[i]])}</td><td>${esc(result(i))}</td><td>${fmtScore(P.cumScore[i + 1])}</td><td>${fmtScore(P.cumEV[i + 1])}</td><td>${fmtScore(P.vUser * (i + 1))}</td></tr>`).join('');
  $('score-table').innerHTML = `<table class="data"><caption class="sr-only">Round log and cumulative score</caption><thead><tr><th scope="col">Round</th><th scope="col">You</th><th scope="col">AI</th><th scope="col">Result</th><th scope="col">Your points</th><th scope="col">Luck-free value</th><th scope="col">Equilibrium pace</th></tr></thead><tbody>${rowsHTML}</tbody></table>`;
}

function prepCanvas(cv) {
  const w = cv.clientWidth;
  if (!w) return null;
  if (!cv.dataset.ar) cv.dataset.ar = String(cv.getAttribute('height') / cv.getAttribute('width'));
  const h = Math.round(w * +cv.dataset.ar), dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawScoreChart() {
  const cv = $('score-chart');
  const c = prepCanvas(cv); if (!c) return;
  const { ctx, w, h } = c, P = play;
  const R = P.rounds || +(radioValue('rounds') || 30);
  const T = P.history ? P.history.length : 0;
  const L = 46, Rm = 12, Tm = 12, Bm = 28, pw = w - L - Rm, ph = h - Tm - Bm;
  const vUser = P.history ? P.vUser : (state.sol ? playCtx().toUser(state.sol.value) : 0);
  const vals = [0, vUser * R];
  if (T) for (let t = 0; t <= T; t++) vals.push(P.cumScore[t], P.cumEV[t]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) hi = lo + 1;
  const X = t => L + (t / R) * pw, Y = v => Tm + (1 - (v - lo) / (hi - lo)) * ph;
  ctx.font = `11px ${MONO}`; ctx.fillStyle = C.soft; ctx.strokeStyle = '#e3e5dd'; ctx.lineWidth = 1;
  for (const t of niceTicks(lo, hi, 4)) { ctx.beginPath(); ctx.moveTo(L, Y(t)); ctx.lineTo(L + pw, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(fmtScore(t), L - 6, Y(t) + 4); }
  ctx.textAlign = 'center';
  for (const t of niceTicks(0, R, 5)) ctx.fillText(String(t), X(t), h - 10);
  ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(L, Tm + ph); ctx.lineTo(L + pw, Tm + ph); ctx.stroke();
  ctx.setLineDash([6, 4]); ctx.strokeStyle = C.soft; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(R), Y(vUser * R)); ctx.stroke(); ctx.setLineDash([]);
  if (T) {
    const line = (arr, col, wdt) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineJoin = 'round'; ctx.beginPath(); arr.slice(0, T + 1).forEach((v, t) => (t ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v)))); ctx.stroke(); };
    line(P.cumEV, C.accent, 2.5);
    line(P.cumScore, C.ink, 2);
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(X(T), Y(P.cumScore[T]), 4, 0, 7); ctx.fill();
  }
}

function initPlay() {
  $('btn-start').addEventListener('click', startMatch);
  $('btn-replay').addEventListener('click', startMatch);
  $('btn-setup').addEventListener('click', () => abortMatch());
  $('btn-quit').addEventListener('click', () => { if (play.history && play.history.length) endMatch(); else abortMatch(); });
  $('btn-next').addEventListener('click', () => nextRound(true));
  $('actions').addEventListener('click', e => { const b = e.target.closest('.act'); if (b) playRound(+b.dataset.a); });
  $('panel-play').addEventListener('change', e => {
    if (e.target.name === 'diff') { $('diff-note').textContent = DIFF[e.target.value].text; renderBestLine($('best-line')); }
    if (e.target.name === 'side') renderBestLine($('best-line'));
    if (e.target.name === 'rounds' && !play.active) drawScoreChart();
  });
  $('score-table-btn').addEventListener('click', () => toggleTable('score-table-btn', 'score-table', renderScoreTable));
  $('stats').addEventListener('toggle', () => drawScoreChart());
  if (window.matchMedia('(max-width: 640px)').matches) $('stats').open = false; else $('stats').open = true;
  document.addEventListener('keydown', e => {
    if (state.mode !== 'play' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (play.active && !play.over && /^[1-4]$/.test(e.key)) {
      const a = +e.key - 1;
      if (a < play.userActs.length) { e.preventDefault(); playRound(a); }
    } else if (e.key === 'Enter' && play.active && play.reveal && tag !== 'button' && tag !== 'a' && tag !== 'summary') {
      e.preventDefault(); nextRound(true);
    }
  });
}

function toggleTable(btnId, tableId, render) {
  const btn = $(btnId), t = $(tableId), open = t.hidden;
  t.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Hide table' : 'Show as table';
  if (open) render();
}

// ---------- Learn ----------
const learn = { fp: null, rm: null, running: false, raf: 0 };

function resetLearn() {
  pauseLearn();
  if (!state.M) return;
  const A = canonical(state.M, game().rowMaximizes);
  Object.assign(learn, { A, fp: fictitiousPlay(A), rm: regretMatching(A), steps: 0, trail: { fp: [], rm: [] }, expl: { fp: [], rm: [] } });
  record();
  if (state.mode === 'learn') drawLearn();
}
function record() {
  for (const k of ['fp', 'rm']) {
    const a = learn[k].avg();
    learn.trail[k].push(a);
    learn.expl[k].push([learn.steps, exploitability(learn.A, a.x, a.y)]);
    if (learn.trail[k].length > 6000) { learn.trail[k] = learn.trail[k].filter((_, i) => i % 2 === 0 || i === learn.trail[k].length - 1); learn.expl[k] = learn.expl[k].filter((_, i) => i % 2 === 0 || i === learn.expl[k].length - 1); }
  }
}
function stepLearn(times) {
  for (let s = 0; s < times; s++) { learn.fp.step(); learn.rm.step(); learn.steps++; record(); }
}
function pauseLearn() {
  learn.running = false; cancelAnimationFrame(learn.raf);
  const b = $('l-play'); if (b) b.textContent = 'Play';
}
function loop() {
  if (!learn.running) return;
  stepLearn(+$('l-speed').value);
  drawLearn();
  if (learn.steps >= 50000) { pauseLearn(); return; }
  learn.raf = requestAnimationFrame(loop);
}
function initLearn() {
  $('l-play').addEventListener('click', () => {
    if (learn.running) { pauseLearn(); return; }
    if (reduceMotion()) { stepLearn(2000); drawLearn(); return; }
    learn.running = true; $('l-play').textContent = 'Pause'; learn.raf = requestAnimationFrame(loop);
  });
  $('l-step').addEventListener('click', () => { pauseLearn(); stepLearn(1); drawLearn(); });
  $('l-skip').addEventListener('click', () => { stepLearn(1000); drawLearn(); });
  $('l-reset').addEventListener('click', () => resetLearn());
  $('l-speed').addEventListener('input', e => { $('l-speed-out').textContent = e.target.value; });
  $('learn-table-btn').addEventListener('click', () => toggleTable('learn-table-btn', 'learn-table', renderLearnTable));
}

function drawLearn() {
  if (!learn.fp || state.mode !== 'learn') return;
  const g = game(), sol = state.sol;
  const eq = { x: sol.x, y: sol.y };
  for (const k of ['fp', 'rm']) {
    const c = prepCanvas($(k + '-canvas'));
    const cur = learn.trail[k][learn.trail[k].length - 1];
    const ex = learn.expl[k][learn.expl[k].length - 1][1];
    if (c) {
      const half = c.w / 2;
      drawPlayerPlot(c.ctx, 0, 0, half, c.h, learn.trail[k].map(t => t.x), eq.x, g.rows.map((_, i) => rowLabel(g, i)), C.row, C.rowFill, rowName(g));
      drawPlayerPlot(c.ctx, half, 0, half, c.h, learn.trail[k].map(t => t.y), eq.y, g.cols.map((_, j) => colLabel(g, j)), C.col, C.colFill, colName(g));
    }
    const mixTxt = (mix, labs) => mix.map((p, i) => `${labs[i]} ${pct(p)}`).join(', ');
    $(k + '-read').innerHTML = `Iteration <b>${learn.steps}</b> · exploitability <b id="${k}-expl" data-v="${ex.toFixed(6)}">${fmtDelta(Math.max(0, ex), g)}</b><br><span class="summary">${esc(rowName(g))}: ${esc(mixTxt(cur.x, g.rows.map((_, i) => rowLabel(g, i))))}. ${esc(colName(g))}: ${esc(mixTxt(cur.y, g.cols.map((_, j) => colLabel(g, j))))}.</span>`;
  }
  drawExpl();
  const fe = learn.expl.fp[learn.expl.fp.length - 1][1], re = learn.expl.rm[learn.expl.rm.length - 1][1];
  $('expl-summary').textContent = `After ${learn.steps} iterations, fictitious play's average strategies can be exploited by ${fmtDelta(Math.max(0, fe), g)} and regret matching's by ${fmtDelta(Math.max(0, re), g)}. At the equilibrium this is 0.`;
  if (!$('learn-table').hidden) renderLearnTable();
}

function drawPlayerPlot(ctx, ox, oy, w, h, trail, eq, labels, ink, fill, name) {
  const n = eq.length;
  ctx.save(); ctx.translate(ox, oy);
  ctx.font = `600 12px ${FONT}`; ctx.fillStyle = ink; ctx.textAlign = 'left';
  ctx.fillText(name, 10, 16);
  if (n === 3) {
    const pad = 26, top = 34, base = h - 26, half = Math.min((base - top) / Math.sqrt(3) * 1.0, w / 2 - pad);
    const cx = w / 2, V = [[cx, base - half * Math.sqrt(3)], [cx - half, base], [cx + half, base]];
    const P = m => [m[0] * V[0][0] + m[1] * V[1][0] + m[2] * V[2][0], m[0] * V[0][1] + m[1] * V[1][1] + m[2] * V[2][1]];
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...V[0]); ctx.lineTo(...V[1]); ctx.lineTo(...V[2]); ctx.closePath(); ctx.stroke();
    ctx.font = `11px ${FONT}`; ctx.fillStyle = C.soft;
    ctx.textAlign = 'center'; ctx.fillText(labels[0], V[0][0], V[0][1] - 5);
    ctx.textAlign = 'left'; ctx.fillText(labels[1], V[1][0] - 4, V[1][1] + 15);
    ctx.textAlign = 'right'; ctx.fillText(labels[2], V[2][0] + 4, V[2][1] + 15);
    ctx.strokeStyle = fill; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
    trail.forEach((m, i) => { const [x, y] = P(m); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    const [ex, ey] = P(eq);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke();
    const [lx, ly] = P(trail[trail.length - 1]);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, 7); ctx.fill();
  } else {
    // time series of each action's share; 2 actions show the first share only
    const L = 34, R = 10, T = 28, B = 22, pw = w - L - R, ph = h - T - B;
    const len = Math.max(trail.length - 1, 1);
    const X = i => L + (i / len) * pw, Y = p => T + (1 - p) * ph;
    ctx.font = `10px ${MONO}`; ctx.fillStyle = C.soft; ctx.textAlign = 'right'; ctx.strokeStyle = '#e3e5dd'; ctx.lineWidth = 1;
    for (const p of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(L, Y(p)); ctx.lineTo(L + pw, Y(p)); ctx.stroke(); ctx.fillText(p * 100 + '%', L - 4, Y(p) + 3); }
    const series = n === 2 ? [0] : [...Array(n).keys()];
    const dashes = [[], [6, 4], [2, 3], [9, 3, 2, 3]];
    series.forEach(k => {
      ctx.setLineDash([4, 3]); ctx.strokeStyle = C.soft; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Y(eq[k])); ctx.lineTo(L + pw, Y(eq[k])); ctx.stroke();
      ctx.setLineDash(dashes[k]); ctx.strokeStyle = n === 2 ? fill : ink; ctx.lineWidth = 2; ctx.beginPath();
      trail.forEach((m, i) => (i ? ctx.lineTo(X(i), Y(m[k])) : ctx.moveTo(X(i), Y(m[k])))); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.font = `11px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'right';
    ctx.fillText(n === 2 ? `Share of ${labels[0]} (dashed: equilibrium)` : 'Shares by action (dashed: equilibrium)', L + pw, h - 6);
  }
  ctx.restore();
}

function drawExpl() {
  const c = prepCanvas($('expl-canvas')); if (!c) return;
  const { ctx, w, h } = c, L = 50, R = 12, T = 12, B = 26, pw = w - L - R, ph = h - T - B;
  const all = [...learn.expl.fp, ...learn.expl.rm].map(p => Math.max(p[1], 1e-5));
  const hiE = Math.ceil(Math.log10(Math.max(...all))), loE = Math.min(hiE - 1, Math.floor(Math.log10(Math.min(...all))));
  const maxT = Math.max(learn.steps, 10);
  const X = t => L + (t / maxT) * pw, Y = v => T + (1 - (Math.log10(Math.max(v, 1e-5)) - loE) / (hiE - loE)) * ph;
  ctx.font = `11px ${MONO}`; ctx.fillStyle = C.soft; ctx.strokeStyle = '#e3e5dd'; ctx.lineWidth = 1; ctx.textAlign = 'right';
  for (let e = loE; e <= hiE; e++) { const y = Y(Math.pow(10, e)); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke(); ctx.fillText(String(+Math.pow(10, e).toPrecision(1)), L - 6, y + 4); }
  ctx.textAlign = 'center';
  for (const t of niceTicks(0, maxT, 5)) ctx.fillText(String(t), X(t), h - 8);
  const line = (arr, col, wd, dash) => { ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); arr.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); ctx.setLineDash([]); };
  line(learn.expl.fp, C.rowFill, 3, []);
  line(learn.expl.rm, C.col, 2.5, [7, 4]);
}

function renderLearnTable() {
  const g = game(), sol = state.sol;
  if (!learn.fp) return;
  const f = learn.trail.fp[learn.trail.fp.length - 1], r = learn.trail.rm[learn.trail.rm.length - 1];
  const rowsT = [
    ...g.rows.map((_, i) => [`${rowName(g)}: ${rowLabel(g, i)}`, f.x[i], r.x[i], sol.x[i]]),
    ...g.cols.map((_, j) => [`${colName(g)}: ${colLabel(g, j)}`, f.y[j], r.y[j], sol.y[j]]),
  ];
  const fe = learn.expl.fp[learn.expl.fp.length - 1][1], re = learn.expl.rm[learn.expl.rm.length - 1][1];
  $('learn-table').innerHTML = `<table class="data"><caption class="sr-only">Average strategies after ${learn.steps} iterations</caption><thead><tr><th scope="col">Action</th><th scope="col">Fictitious play</th><th scope="col">Regret matching</th><th scope="col">Equilibrium</th></tr></thead><tbody>${rowsT.map(rw => `<tr><td>${esc(rw[0])}</td><td>${pct(rw[1])}</td><td>${pct(rw[2])}</td><td>${pct(rw[3])}</td></tr>`).join('')}<tr><td>Exploitability</td><td>${fmtDelta(Math.max(0, fe), g)}</td><td>${fmtDelta(Math.max(0, re), g)}</td><td>0</td></tr></tbody></table>`;
}

// ---------- Boot ----------
function boot() {
  initPicker(); initTabs(); initMatrixEvents(); initTry(); initPlay(); initLearn();
  $('geo-table-btn').addEventListener('click', () => toggleTable('geo-table-btn', 'geo-table', () => {}));
  $('seed').value = newSeed();
  onGameChanged(true);
  renderSetup();
  renderStats();
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawScoreChart(); drawLearn(); }, 120); });
}
boot();
