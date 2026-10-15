'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means the normal resting state. No clinical numbers live here;
   the Clinical values tab multiplies these ratios by the textbook values in clinical-values.json. */
const NORMAL = { salt: 1, dri: 1, ace: 1, arb: 1, mra: 1, tumor: 0, feedback: true };
const CHANGES = {
  ace: { ace: .2 },        // ACE converts only a fifth as much angiotensin I
  arb: { arb: .2 },        // only a fifth of angiotensin II receptors are free
  mra: { mra: .25 },       // aldosterone's receptors are mostly blocked
  dri: { dri: .2 }         // renin cuts only a fifth as much angiotensinogen
};
const FEEDBACK_GAIN = 8;

// The chain for a given pressure as the kidney senses it.
function chain(p, sensed) {
  const S = p.feedback ? clamp(Math.exp(FEEDBACK_GAIN * (1 - sensed)), .05, 12) : 1; // renin released
  const Ract = S * p.dri;              // renin at work
  const A1 = Ract;                     // angiotensinogen never runs out, so angiotensin I follows working renin
  const A2 = A1 * p.ace;               // ACE converts angiotensin I to angiotensin II
  const E = A2 * p.arb;                // angiotensin II signal reaching cells through free receptors
  const aldo = .3 + .7 * E + p.tumor;  // aldosterone released: a resting floor, angiotensin II's call, and any tumor
  const act = aldo * p.mra;            // aldosterone's effect through free receptors
  const R = .5 * act + .5 * E;         // salt kept: aldosterone, plus angiotensin II acting on the kidney directly
  const V = (.9 + .1 * p.salt) * Math.pow(R, .2);
  const T = .75 + .25 * Math.sqrt(E);  // arteriole resistance
  const P = V * V * T;
  const K = clamp(1 - .1 * Math.log(act), .6, 1.6);
  const Na = 1 + .008 * Math.log(act); // water follows salt, so sodium concentration barely moves
  return { S, Ract, A1, A2, E, aldo, act, R, V, T, P, K, Na };
}
// Steady state: the pressure the chain produces equals the pressure the kidney senses.
// Produced pressure never rises as sensed pressure rises, so bisection finds the single crossing.
function steady(p) {
  let lo = .2, hi = 3;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (chain(p, mid).P > mid) lo = mid; else hi = mid; }
  return chain(p, (lo + hi) / 2);
}
const BASE = steady(NORMAL);
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ---------- */
const RED = '#b3261e', BLUE = '#254dff', INK = '#171916', ORGAN = '#f1d6d0', GLAND = '#f0dfb4', LUNG = '#f3dcdc';
// Each picture gets its own arrowhead ids: a marker referenced from a hidden step would not draw.
let pictureId = 0;
const svg = (label, body) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 624" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${color === BLUE ? 'b' : 'k'})" ${extra}/>`;
const DEFS = `<defs><marker id="ah-k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${INK}"/></marker><marker id="ah-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${BLUE}"/></marker></defs>`;

// Bars: amounts drawn on a gentle curve so both "much more" and "much less" stay readable.
const TRACK = 126;
const lvl = L => clamp(.4 * Math.pow(Math.max(L, 0), .7), .02, 1);
const BAR_X = { L: 24, C: 177, R: 330 };
function bar(col, y, L, G, name) {
  const x = BAR_X[col], w = f(TRACK * lvl(L));
  let s = `<rect x="${x}" y="${y}" width="${TRACK}" height="14" fill="#fff" stroke="#babeb3"/><rect data-bar="${name}" x="${x}" y="${y}" width="${w}" height="14" fill="${BLUE}"/>`;
  if (G) s += `<rect class="ghost" x="${x}" y="${y - 3}" width="${f(TRACK * lvl(G))}" height="20" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  return s;
}
// How the model's state is drawn. Exponents exaggerate differences so they read at a glance.
function look(o) {
  return {
    angle: clamp((o.P - 1) * 4, -1, 1) * 75,
    tube: clamp(22 * Math.pow(o.T, -6), 8, 38),
    fill: clamp(52 * Math.pow(o.V, 5), 14, 92),
    k: clamp(.4 * Math.pow(o.K, 6), .03, 1)
  };
}
const block = (x, y) => `<g data-block><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${RED}" stroke-width="3.5"/><path d="M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}" stroke="${RED}" stroke-width="3.5" stroke-linecap="round"/></g>`;
const cup = (x, y) => `<path d="M${x - 9} ${y - 7} V${y} A9 9 0 0 0 ${x + 9} ${y} V${y - 7}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
const KIDNEY = 'M80 26 C44 22 30 52 34 76 C38 102 64 112 90 106 C112 101 120 86 110 78 C102 72 102 62 110 56 C122 46 112 28 80 26 Z';
const LIVER = 'M352 46 C380 30 440 32 456 44 C466 54 456 70 440 80 C420 94 384 100 364 92 C346 84 338 56 352 46 Z';

const ALL = ['kidney', 'gauge', 'sense', 'renin', 'liver', 'ang1', 'ace', 'ang2', 'arteriole', 'adrenal', 'salt', 'volume', 'feedback'];
const PART_LABEL = { kidney: 'kidney', renin: 'renin', liver: 'angiotensinogen', ang1: 'angiotensin I', ace: 'ACE', ang2: 'angiotensin II', arteriole: 'arterioles', adrenal: 'aldosterone', salt: 'salt kept', volume: 'blood volume', gauge: 'blood pressure' };

// The whole chain. parts: which links are drawn so far; ghost: the normal state drawn dashed; blocks: where a drug acts.
function picture(o, { parts = ALL, ghost = null, legend = '', blocks = [], fresh = [] } = {}) {
  const has = k => parts.includes(k), L = look(o), G = ghost ? look(ghost) : null;
  const cls = (part, base = '') => `${base}${fresh.includes(part) ? ' fresh' : ''}`.trim();
  let b = DEFS;
  // Sensing line: from the pressure dial back up to the kidney.
  if (has('sense')) {
    const fb = has('feedback');
    b += `<path d="M42 512 H12 V66 H30" fill="none" stroke="${fb ? BLUE : INK}" stroke-width="${fb ? 4 : 2}" stroke-dasharray="${fb ? '2 8' : '2 6'}" stroke-linecap="round" marker-end="url(#ah-${fb ? 'b' : 'k'})"/>`;
    if (fb) b += `<text transform="translate(30 300) rotate(-90)" text-anchor="middle" class="sm blue${fresh.includes('feedback') ? ' fresh' : ''}">pressure felt</text>`;
  }
  // Kidney and renin.
  b += `<path d="${KIDNEY}" fill="${ORGAN}" stroke="${RED}" stroke-width="3"/>${text(68, 71, PART_LABEL.kidney, cls('kidney', 'xs on-organ'))}`;
  if (has('renin')) {
    const dots = has('ang1') ? 'M118 82 C150 94 182 108 222 110' : 'M118 82 C140 90 160 98 186 104';
    b += `<path d="${dots}" fill="none" stroke="${BLUE}" stroke-width="7" stroke-dasharray="0.1 13" stroke-linecap="round"/>`;
    b += text(87, 136, PART_LABEL.renin, cls('renin')) + bar('L', 146, o.S, ghost && ghost.S, 'renin');
  }
  // Liver, angiotensinogen, and the cut that makes angiotensin I.
  if (has('liver')) {
    b += `<path d="${LIVER}" fill="${ORGAN}" stroke="${RED}" stroke-width="3"/>${text(402, 70, 'liver', 'sm on-organ')}`;
    b += text(240, 34, PART_LABEL.liver, cls('liver', 'sm'));
    let beads = '';
    for (let i = 0; i < 11; i++) beads += `<circle cx="${186 + i * 11}" cy="58" r="5.5" fill="${i < 4 ? BLUE : '#fff'}" stroke="${INK}" stroke-width="1.5"/>`;
    b += beads + arrow('M344 58 H308');
    b += `<path d="M230 46 V70" stroke="${INK}" stroke-width="2.5" stroke-dasharray="4 3"/>`;
  }
  if (has('ang1')) {
    b += arrow('M240 76 V166') + text(250, 118, 'cut', 'sm', 'start');
    b += text(240, 188, PART_LABEL.ang1, cls('ang1')) + bar('C', 198, o.A1, ghost && ghost.A1, 'ang1');
  }
  // Lungs and ACE.
  if (has('ace')) {
    b += `<path d="M396 216 C380 212 364 230 366 252 C368 266 392 266 396 254 Z M404 216 C420 212 436 230 434 252 C432 266 408 266 404 254 Z" fill="${LUNG}" stroke="${RED}" stroke-width="2.5"/>`;
    b += text(400, 290, 'lungs', 'sm') + arrow('M360 240 H252') + text(300, 224, PART_LABEL.ace, cls('ace', 'blue'));
  }
  if (has('ang2')) {
    b += arrow('M240 218 V270') + text(240, 292, PART_LABEL.ang2, cls('ang2')) + bar('C', 302, o.A2, ghost && ghost.A2, 'ang2');
  }
  // Arterioles: narrower when angiotensin II's signal is stronger.
  if (has('arteriole')) {
    b += arrow('M222 322 C170 326 112 330 90 340') + cup(87, 352);
    b += text(87, 382, PART_LABEL.arteriole, cls('arteriole'));
    const w = f(L.tube), y = 410;
    b += `<path d="M24 ${y} H150" stroke="${RED}" stroke-width="${w}" stroke-linecap="butt"/>`;
    b += [48, 87, 126].map(x => `<ellipse cx="${x}" cy="${y}" rx="5" ry="${f(w / 2 + 4)}" fill="none" stroke="${INK}" stroke-width="2"/>`).join('');
    if (G) b += `<path class="ghost" d="M24 ${f(y - G.tube / 2)} H150 M24 ${f(y + G.tube / 2)} H150" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    b += arrow('M87 434 V462');
  }
  // Adrenal glands, aldosterone, salt kept and potassium.
  if (has('adrenal')) {
    b += arrow('M258 322 C310 326 360 330 384 340') + cup(393, 348);
    b += `<path d="M370 374 L393 352 L416 374 Z" fill="${GLAND}" stroke="#7a5c00" stroke-width="2"/>${text(393, 394, 'adrenal glands', 'sm')}`;
    b += text(393, 420, PART_LABEL.adrenal, cls('adrenal')) + bar('R', 428, o.aldo, ghost && ghost.aldo, 'aldo');
  }
  if (has('salt')) {
    b += arrow('M393 446 V462');
    b += text(393, 482, PART_LABEL.salt, cls('salt')) + bar('R', 490, o.R, ghost && ghost.R, 'salt');
    const kw = f(TRACK * L.k);
    b += text(393, 532, 'potassium', cls('salt', 'sm'));
    b += `<rect x="330" y="540" width="${TRACK}" height="14" fill="#fff" stroke="#babeb3"/><rect data-bar="potassium" x="330" y="540" width="${kw}" height="14" fill="${BLUE}"/>`;
    if (G) b += `<rect class="ghost" x="330" y="537" width="${f(TRACK * G.k)}" height="20" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  // Blood volume: a container that fills.
  if (has('volume')) {
    if (has('salt')) b += arrow('M326 497 H290');
    b += text(240, 430, PART_LABEL.volume, cls('volume'));
    const top = f(532 - L.fill);
    b += `<rect x="200" y="440" width="80" height="92" rx="8" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="202" y="${top}" width="76" height="${f(530 - top)}" rx="6" fill="${ORGAN}"/><path d="M202 ${top} H278" stroke="${RED}" stroke-width="3"/>`;
    if (G) b += `<path class="ghost" d="M196 ${f(532 - G.fill)} H284" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    b += arrow('M196 504 H140');
  }
  // Pressure dial.
  if (has('gauge')) b += dial(87, 512, 44, L, G) + text(87, 562, PART_LABEL.gauge, cls('gauge'));
  for (const [x, y] of blocks) b += block(x, y);
  return withState(o, b, ghost, legend, blocks);
}
// Wraps a drawing with the state it shows (read by the smoke test) and the normal-versus-changed legend.
function withState(o, b, ghost, legend, blocks = []) {
  let out = `<g data-new-state="${legend || 'current'}" data-pressure="${o.P.toFixed(4)}" data-renin="${o.S.toFixed(4)}" data-renin-active="${o.Ract.toFixed(4)}" data-ang1="${o.A1.toFixed(4)}" data-ang2="${o.A2.toFixed(4)}" data-signal="${o.E.toFixed(4)}" data-aldo="${o.aldo.toFixed(4)}" data-salt="${o.R.toFixed(4)}" data-volume="${o.V.toFixed(4)}" data-potassium="${o.K.toFixed(4)}">${b}</g>`;
  if (ghost) {
    out += `<g class="ghost" data-ghost="normal" data-pressure="${ghost.P.toFixed(4)}" data-renin="${ghost.S.toFixed(4)}"><path d="M180 576 H206" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/></g>${text(212, 582, 'normal', 'sm', 'start')}`;
    out += `<path d="M290 576 H316" stroke="${BLUE}" stroke-width="6"/>${text(322, 582, legend, 'sm blue', 'start')}`;
  }
  if (blocks.length) out += `<g transform="translate(193 602) scale(.75) translate(-193 -602)">${block(193, 602)}</g>${text(212, 608, 'drug blocks here', 'sm red', 'start')}`;
  return out;
}

// Pressure dial shared by the close-up and the chain.
function dial(cx, cy, r, L, G) {
  let s = `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  s += [-60, -30, 0, 30, 60].map(a => { const t = a * Math.PI / 180; return `<path d="M${f(cx + (r - 8) * Math.sin(t))} ${f(cy - (r - 8) * Math.cos(t))} L${f(cx + (r - 1) * Math.sin(t))} ${f(cy - (r - 1) * Math.cos(t))}" stroke="${INK}" stroke-width="2"/>`; }).join('');
  if (G) s += `<path class="ghost" d="M${cx} ${cy} V${cy - r + 10}" transform="rotate(${f(G.angle)} ${cx} ${cy})" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>`;
  s += `<path d="M${cx} ${cy} V${cy - r + 8}" transform="rotate(${f(L.angle)} ${cx} ${cy})" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="${INK}"/>`;
  return s + text(cx - r, cy + 20, 'low', 'xs') + text(cx + r, cy + 20, 'high', 'xs');
}
const chevrons = (xs, y, dir) => xs.map(x => `<path d="M${x - dir * 6} ${y - 6} L${x} ${y} L${x - dir * 6} ${y + 6}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');

// Steps 1 and 2: a close-up of one kidney, the dial on the vessel feeding it, and (step 2) renin leaving it.
function kidneyPicture(o, { ghost = null, legend = '', renin = false } = {}) {
  const L = look(o), G = ghost ? look(ghost) : null;
  let b = DEFS;
  b += `<path d="${KIDNEY}" transform="translate(-34 96) scale(2.8)" fill="${ORGAN}" stroke="${RED}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  b += text(150, 290, 'kidney', 'big on-organ');
  b += `<path d="M470 282 H262" stroke="${RED}" stroke-width="18"/>${chevrons([440, 390, 340], 282, -1)}${text(452, 262, 'blood in', 'sm', 'end')}`;
  b += `<path d="M262 320 H470" stroke="#5d6270" stroke-width="16"/>${chevrons([330, 380, 430], 320, 1)}${text(452, 356, 'blood out', 'sm', 'end')}`;
  b += `<g fill="${BLUE}">${[[258, 296], [270, 302], [260, 306], [272, 292]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join('')}</g>`;
  b += `<path d="M392 212 C362 236 312 250 280 290" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="2 6" stroke-linecap="round" marker-end="url(#ah-k)"/>`;
  b += dial(400, 178, 46, L, G) + text(400, 114, 'blood pressure', '', 'middle');
  if (renin) {
    b += `<path d="M292 320 H462" fill="none" stroke="${BLUE}" stroke-width="7" stroke-dasharray="0.1 14" stroke-linecap="round"/>`;
    b += text(240, 470, 'renin released', 'fresh') + bar('C', 482, o.S, ghost && ghost.S, 'renin');
  }
  // Nudge the close-up down so it sits in the middle of the frame, clear of the legend.
  return withState(o, `<g transform="translate(0 36)">${b}</g>`, ghost, legend);
}

// Step 5: the lock-and-key close-up of a receptor.
function receptorPicture() {
  const key = (x, y0) => {
    let s = '';
    for (let i = 0; i < 8; i++) s += `<circle cx="${x}" cy="${y0 + i * 15}" r="7" fill="${BLUE}" stroke="${INK}" stroke-width="1.5"/>`;
    return s;
  };
  const membrane = (x0, x1) => {
    let s = `<rect x="${x0}" y="320" width="${x1 - x0}" height="240" fill="${ORGAN}"/>`;
    s += `<path d="M${x0} 320 H${x1} M${x0} 342 H${x1}" stroke="${RED}" stroke-width="2.5"/>`;
    for (let x = x0 + 8; x < x1; x += 16) s += `<circle cx="${x}" cy="320" r="4" fill="#fff" stroke="${RED}" stroke-width="1.5"/><circle cx="${x}" cy="342" r="4" fill="#fff" stroke="${RED}" stroke-width="1.5"/>`;
    return s;
  };
  let b = DEFS + membrane(20, 228) + membrane(252, 460);
  // Left: a cell with the receptor. The key sits in the cup and the cell answers.
  b += `<path d="M98 270 V330 A26 26 0 0 0 150 330 V270" fill="#ecefe5" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  b += key(124, 236);
  b += text(124, 214, 'angiotensin II', 'blue');
  b += `<path d="M58 266 L96 292" stroke="${INK}" stroke-width="1.5"/>${text(58, 256, 'receptor', 'sm')}`;
  b += [[-40, 410], [0, 420], [40, 410]].map(([dx, y]) => arrow(`M${124 + dx * .3} 372 L${124 + dx} ${y}`, BLUE, 3.5)).join('');
  b += text(124, 456, 'the cell', 'sm on-organ') + text(124, 480, 'answers', 'sm on-organ');
  // Right: a cell with no receptor. The same messenger floats past.
  b += key(356, 150) + text(356, 128, 'angiotensin II', 'blue');
  b += text(356, 430, 'no receptor:', 'sm on-organ') + text(356, 454, 'nothing happens', 'sm on-organ');
  b += `<path d="M240 40 V580" stroke="#babeb3" stroke-width="2"/>`;
  b += text(124, 60, 'a cell with', 'sm') + text(124, 82, 'the receptor', 'sm') + text(356, 60, 'a cell without', 'sm') + text(356, 82, 'the receptor', 'sm');
  return b;
}

// Plain-word comparison with normal (used for chips and text alternatives).
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o, kind = '') {
  const rows = [['Renin released', trend(o.S, BASE.S, 'more', 'less')]];
  if (kind === 'dri' || kind === 'explore') rows.push(['Renin at work', trend(o.Ract, BASE.Ract, 'more', 'less')]);
  rows.push(['Angiotensin I', trend(o.A1, BASE.A1, 'more', 'less')], ['Angiotensin II', trend(o.A2, BASE.A2, 'more', 'less')]);
  if (kind === 'arb' || kind === 'explore') rows.push(['Angiotensin II signal', trend(o.E, BASE.E, 'stronger', 'weaker')]);
  rows.push(['Aldosterone', trend(o.aldo, BASE.aldo, 'more', 'less')]);
  if (kind === 'mra' || kind === 'explore') rows.push(['Salt kept', trend(o.R, BASE.R, 'more', 'less')]);
  rows.push(['Blood volume', trend(o.V, BASE.V, 'more', 'less')], ['Blood pressure', trend(o.P, BASE.P, 'higher', 'lower')], ['Potassium', trend(o.K, BASE.K, 'higher', 'lower')]);
  return rows;
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (o, kind) => `<ul class="readout" aria-label="Compared with normal">${compare(o, kind).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (o, kind) => compare(o, kind).map(([k, [w]]) => `${k.toLowerCase()} ${w}`).join(', ');

/* ---------- Lesson steps ---------- */
const UPTO = n => ALL.slice(0, n);
const LOW = { ...chain(NORMAL, .85), P: .85 }; // step 2: the kidney senses low pressure and releases more renin
const CORE = {
  watch: () => svg('Close-up of one kidney. Blood flows in through one vessel and out through another. A dial on the incoming vessel shows the blood pressure, its needle in the middle for the normal push, and a dotted line carries that reading to a cluster of cells in the kidney.', kidneyPicture(BASE)),
  renin: () => svg('The same kidney close-up. The pressure dial now reads lower than normal, shown dashed. Dots of renin leave the kidney in the outgoing blood, and a bar shows more renin released than the dashed normal amount.', kidneyPicture(LOW, { ghost: BASE, legend: 'pressure low', renin: true })),
  cut: () => svg('The liver makes angiotensinogen, drawn as a long chain of beads. Renin from the kidney cuts a short piece off it: angiotensin I, whose bar shows the amount made.', picture(BASE, { parts: UPTO(6), fresh: ['liver', 'ang1'] })),
  'ace-step': () => svg('In the lungs, ACE acts on angiotensin I as it flows down the chain, making angiotensin II, the active hormone, shown by a new bar.', picture(BASE, { parts: UPTO(8), fresh: ['ace', 'ang2'] })),
  receptor: () => svg('Close-up of two cells. Left: angiotensin II, a short chain of beads, fits into a cup-shaped receptor in the cell surface like a key in a lock, and arrows show the cell answering. Right: a cell with no receptor; the same messenger floats past and nothing happens.', receptorPicture()),
  squeeze: () => svg('Angiotensin II docks on receptors on the arterioles, small muscle-ringed vessels; they narrow, which pushes up the blood pressure dial.', picture(BASE, { parts: UPTO(9), fresh: ['arteriole'] })),
  adrenal: () => svg('Angiotensin II also docks on receptors on the adrenal glands, which release aldosterone, shown by a new bar.', picture(BASE, { parts: UPTO(10), fresh: ['adrenal'] })),
  salt: () => svg('Aldosterone acts back on the kidney: a bar for salt kept, and a bar for potassium in the blood, which is kept low because aldosterone sends potassium out in the urine.', picture(BASE, { parts: UPTO(11), fresh: ['salt'] })),
  volume: () => svg('Salt kept holds water in the body, filling a container labelled blood volume, which pushes on the blood pressure dial.', picture(BASE, { parts: UPTO(12), fresh: ['volume'] })),
  feedback: () => svg('The dotted line from the pressure dial back up to the kidney is highlighted: the kidney feels the pressure, and higher pressure means less renin.', picture(BASE, { parts: ALL, fresh: ['feedback'] })),
  whole: () => svg('The whole chain: the kidney releases renin; renin cuts angiotensinogen from the liver into angiotensin I; ACE in the lungs makes angiotensin II; it narrows arterioles and calls out aldosterone from the adrenal glands; aldosterone keeps salt and sends potassium out; salt and water fill the blood volume; pressure rises and is felt back at the kidney.', picture(BASE, { parts: ALL }))
};
const CHANGE_INFO = {
  ace: { blocks: [[300, 240]] },
  arb: { blocks: [[87, 352], [393, 348]] },
  mra: { blocks: [[393, 455]] },
  dri: { blocks: [[200, 106]] }
};
function changePicture(el, t) {
  const kind = el.dataset.kind, info = CHANGE_INFO[kind];
  const ease = 1 - Math.pow(1 - t, 3);
  const o = steady(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease));
  const name = el.dataset.stepTitle.split(':')[0];
  const where = t >= 1 || reducedMotion() ? info.blocks : [];
  return svg(`${name}, drawn over a faint dashed picture of normal. A red cross marks where the drug blocks the chain. Compared with normal: ${describe(o, kind)}.`, picture(o, { parts: ALL, ghost: BASE, legend: 'with the drug', blocks: where })) + readout(o, kind);
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frame = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind in CHANGE_INFO;
const drawAt = (el, t) => { visualOf(el).innerHTML = changePicture(el, t); };
function animate(el) {
  cancelAnimationFrame(frame);
  if (reducedMotion()) { drawAt(el, 1); return; }
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / 1600);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
steps.forEach(el => {
  const kind = el.dataset.kind;
  if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
  else drawAt(el, 1);
  el.querySelector('.replay')?.addEventListener('click', () => animate(el));
});
function showStep(n, focus = false) {
  cancelAnimationFrame(frame);
  current = clamp(n, 0, steps.length - 1);
  steps.forEach((el, i) => { el.hidden = i !== current; });
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === steps.length - 1 ? 'Start again ↻' : 'Next →';
  progress.textContent = `Step ${current + 1} of ${steps.length}`;
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  const el = steps[current];
  if (isAnimated(el)) animate(el);
  if (focus) { const h = el.querySelector('h2'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }
}
nextBtn.addEventListener('click', () => showStep(current === steps.length - 1 ? 0 : current + 1, true));
backBtn.addEventListener('click', () => showStep(current - 1, true));
$('#lesson').addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight' && current < steps.length - 1) { e.preventDefault(); showStep(current + 1, true); }
  if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); showStep(current - 1, true); }
});

/* ---------- Tabs ---------- */
const tabs = $$('[role=tab]');
function activate(tab, focus = false) {
  tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
  if (focus) tab.focus();
  if (tab.id === 'tab-lesson') { if (isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
  update();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => activate(t));
  t.addEventListener('keydown', e => {
    const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (n !== undefined) { e.preventDefault(); activate(tabs[n], true); }
  });
});
function fromHash() {
  const m = location.hash.match(/^#step-(\d+)$/);
  if (m) { if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]); showStep(Number(m[1]) - 1); }
}
window.addEventListener('hashchange', fromHash);
if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(0);

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['salt', 'dri', 'ace', 'arb', 'mra', 'tumor'];
const level = (k, v) => k === 'tumor' ? (v < .05 ? 'none' : v < 1.2 ? 'some' : 'a lot')
  : k === 'salt' ? (v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : (v > .97 ? 'normal' : v > .55 ? 'partly blocked' : 'mostly blocked');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  $('#clinical-salt').value = params.salt;
  $('#clinical-salt-label').textContent = level('salt', params.salt);
  $('#feedback').checked = params.feedback;
}
const reference = id => { const v = data.values.find(x => x.id === id); return v.typical ?? (v.low + v.high) / 2; };
const measures = o => ({ map: o.P * reference('map'), na: o.Na * reference('na'), k: o.K * reference('k') });
const DECIMALS = { k: 1 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const domain = v => { const lo = (v.low ?? v.typical) * .8, hi = (v.high ?? v.typical) * 1.2; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function update() {
  syncControls();
  const o = steady(params);
  $('#explore-visual').innerHTML = svg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o, 'explore')}.`, picture(o, { parts: ALL, ghost: BASE, legend: 'your settings' })) + readout(o, 'explore');
  const rel = `renin released ×${o.S.toFixed(2)} · angiotensin II ×${o.A2.toFixed(2)} · aldosterone ×${o.aldo.toFixed(2)} · blood volume ×${o.V.toFixed(2)} · pressure ×${o.P.toFixed(2)} · potassium ×${o.K.toFixed(2)}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}`; return; }
  const m = measures(o), unit = id => data.values.find(v => v.id === id).unit;
  $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}. Scaled by the textbook values: mean pressure ${fmt('map', m.map)} ${unit('map')} · sodium ${fmt('na', m.na)} ${unit('na')} · potassium ${fmt('k', m.k)} ${unit('k')}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    const pos = domain(v);
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const marker = row.querySelector('.marker'); marker.setAttribute('x1', pos(val)); marker.setAttribute('x2', pos(val));
    let status;
    if (v.low !== null && v.high !== null) status = val < v.low ? 'below typical range' : val > v.high ? 'above typical range' : 'within typical range';
    else { const r = val / v.typical; status = r > 1.015 ? 'above the textbook typical value' : r < .985 ? 'below the textbook typical value' : 'near the textbook typical value'; }
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id];
    row.querySelector('.direction').textContent = state ? (d ? DIRECTION[d] : 'Not listed for this state') : '';
  }
}
const markCustom = () => {
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s
    ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.`
    : 'Custom model settings.';
};
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; update(); });
$('#feedback').addEventListener('change', e => { params.feedback = e.target.checked; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; update(); });
$('#clinical-salt').addEventListener('input', e => { params.salt = Number(e.target.value); markCustom(); update(); announce(); });
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(CHANGES[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(steady(params)), u = id => data.values.find(v => v.id === id).unit;
    $('#cv-live').textContent = `Model mean arterial pressure ${fmt('map', m.map)} ${u('map')}, sodium ${fmt('na', m.na)} ${u('na')}, potassium ${fmt('k', m.k)} ${u('k')}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['map', 'na', 'k']) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && Number.isFinite(v.typical) && v.typical > 0)) throw new Error('Invalid reference data');
    }
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    const u = id => data.values.find(v => v.id === id).unit;
    $('#baseline-note').textContent = `The model’s normal state is set to the textbook typical values (mean pressure ${reference('map')} ${u('map')}, sodium ${reference('na')} ${u('na')}, potassium ${reference('k')} ${u('k')}), so every marker starts on its typical value. Each number shown is a relative model result multiplied by that typical value. The model’s drug strengths are arbitrary, so the size of each change is illustrative; only its direction is meant to teach. Blood volume is part of the model but has no reference value here; Explore freely shows it relative to normal.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.label} (${s.kind})`; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), hasRange = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = hasRange ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: textbook ${hasRange ? 'range' : 'typical value'} and the current illustrative model marker`);
      right.querySelector('.key').textContent = hasRange
        ? `Textbook range ${v.low}–${v.high} ${v.unit} (shaded band), typical ${v.typical} (black line) · blue line: model`
        : `Textbook typical value about ${v.typical} ${v.unit} (black line) · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'Source'; li.append(' · ', a); }
      $('#sources').append(li);
    }
    for (const s of data.states) {
      const li = document.createElement('li'); li.textContent = `Directions for ${s.label}: ${s.where} [${s.source}]`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
  update();
}
update();
load();
