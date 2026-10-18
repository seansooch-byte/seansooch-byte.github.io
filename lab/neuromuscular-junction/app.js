'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means a normal junction. No clinical numbers live here;
   the Clinical values tab scales these ratios with the textbook values in clinical-values.json. */
const NORMAL = { release: 1, receptors: 1, ache: 1, ndmb: 0, sux: 0 };
const CHANGES = {
  ndmb: { ndmb: 8 },              // a moderate nondepolarizing block
  sux: { sux: .8 },               // succinylcholine holding most end plates depolarized
  che: { ndmb: 8, ache: .1 },     // end of the reversal step: the same block, then cholinesterase mostly stopped
  mg: { receptors: .2 }           // a fifth of the receptors left
};
const KA = 1;          // acetylcholine level that, with no blocker, fills half of the receptors
const RUNDOWN = .1;    // in a quick burst each impulse releases a tenth less than the first
const PRE = .08;       // extra rundown when a nondepolarizing blocker also sits on the nerve ending's own receptors
// A normal junction's safety margin comes from the textbook safety factor in clinical-values.json (set in load()).
// If that file cannot load, the lesson still runs on an illustrative stand-in that is not a reference value.
const FALLBACK_MARGIN = 2;
let MARGIN = null;
const FIBRES = [.6, 1.5];  // fibres differ: each fibre's own margin is the junction's margin times a factor in this range
const eppOf = act => act / (act + .3);  // opened gates → end plate potential, levelling off as more gates open
const EPP0 = eppOf(.5);
// Share of fibres whose end plate potential reaches threshold, for a junction margin S.
const fireShare = S => S <= 0 ? 0 : clamp((FIBRES[1] - 1 / S) / (FIBRES[1] - FIBRES[0]), 0, 1);

function model(p) {
  const clear = .1 + .9 * p.ache, B = p.ndmb, A0 = p.release / clear;
  const pre = KA * B / (A0 + KA * (1 + B));  // share of the nerve ending's own receptors taken by the blocker
  // Succinylcholine holds the end plate open; in a share of fibres the membrane beside it cannot reset, so they do
  // not fire at all. Lingering acetylcholine (cholinesterase stopped) adds to the depolarization and deepens it.
  const depol = p.sux * (.8 + .2 * Math.min(A0, 4));
  const blocked = 1 - Math.exp(-2.5 * depol);
  const shots = [0, 1, 2, 3].map(k => {
    const release = p.release * Math.max(.05, 1 - k * (RUNDOWN + PRE * pre));
    const A = release / clear;
    const occA = A / (A + KA * (1 + B)), occB = KA * B / (A + KA * (1 + B));
    const epp = eppOf(p.receptors * occA) / EPP0;
    const S = MARGIN * epp;
    return { release, A, occA, occB, epp, S, twitch: (1 - blocked) * fireShare(S) };
  });
  const s = shots[0], twitch = shots.map(x => x.twitch);
  return {
    p, shots, twitch, blocked, depol,
    A: s.A, occA: s.occA, occB: s.occB, release: s.release, S: s.S,
    epp: s.epp * (1 - .95 * blocked),     // nerve-evoked end plate potential, averaged over fibres
    safety: s.S * (1 - blocked),          // average margin; a held fibre has none
    opened: p.receptors * s.occA,
    fade: twitch[0] > .02 ? twitch[3] / twitch[0] : 1
  };
}
let BASE = null;  // the normal junction, computed once MARGIN is known
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', RED = '#b3261e', GREEN = '#1d6b45', AMBER = '#7a5c00', RULE = '#babeb3';
const ORGAN = '#f1d6d0', WALL = '#a8584c', PLUG = '#5d6270', GATE = '#dfe3d6', BLUE_FILL = '#d1d8fd';
// Each picture gets its own arrowhead ids: a marker referenced from a hidden step would not draw.
let pictureId = 0;
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [RED]: 'r', [GREEN]: 'g', [AMBER]: 'a' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const g = (dy, body) => `<g transform="translate(0 ${dy})">${body}</g>`;
const cross = (x, y, r = 9) => `<g data-block="enzyme"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${RED}" stroke-width="2.5"/><path d="M${f(x - r / 2)} ${f(y - r / 2)} L${f(x + r / 2)} ${f(y + r / 2)} M${f(x + r / 2)} ${f(y - r / 2)} L${f(x - r / 2)} ${f(y + r / 2)}" stroke="${RED}" stroke-width="2.5" stroke-linecap="round"/></g>`;
const diamond = (x, y, r = 6) => `<path d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${INK}"/>`;
const plug = (x, y) => `<rect x="${f(x - 9)}" y="${f(y - 6)}" width="18" height="12" rx="3" fill="${PLUG}" stroke="${INK}" stroke-width="1.5"/>`;
const antibody = (x, y) => `<path d="M${x} ${y - 9} V${y} M${x} ${y} L${x - 7} ${y + 8} M${x} ${y} L${x + 7} ${y + 8}" fill="none" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>`;
const enzymeShape = (x, y) => `<path d="M${x} ${y} L${x - 4} ${y - 6} A7.2 7.2 0 1 0 ${x + 4} ${y - 6} Z" fill="#c9cdbd" stroke="${INK}" stroke-width="1.5"/>`;

// The close-up, in its own 480-wide frame: nerve ending (y 24–110), gap (110–150), folded end plate below.
const FOLDS = [130, 200, 280, 350];
const RECEPTORS = [56, 92, 154, 176, 226, 254, 304, 326, 388, 424];
const MISSING_ORDER = [1, 8, 4, 6, 2, 9, 0, 5, 3, 7];  // which receptors go first when there are fewer
const FILL_ORDER = [0, 5, 2, 7, 4, 9, 1, 6, 3, 8];     // spreads docked molecules along the end plate
const VESICLES = [[150, 62], [196, 50], [244, 60], [292, 50], [338, 64], [174, 88], [312, 88]];
const GAP_DOTS = Array.from({ length: 40 }, (_, i) => [108 + ((i * .618034) % 1) * 264, 117 + ((i * 7) % 4) * 4]);

function receptorStates(o) {
  const p = o.p, present = Math.round(10 * clamp(p.receptors, 0, 1));
  const states = Array(10).fill('empty');
  MISSING_ORDER.slice(0, 10 - present).forEach(i => { states[i] = 'missing'; });
  const slots = FILL_ORDER.filter(i => states[i] !== 'missing');
  let nS = p.sux > .02 ? Math.round(present * Math.min(1, o.depol)) : 0;
  let nB = Math.min(present - nS, Math.round(present * o.occB));
  let nA = Math.min(present - nS - nB, Math.round(present * o.occA));
  for (const i of slots) {
    if (nS > 0) { states[i] = 'sux'; nS--; } else if (nB > 0) { states[i] = 'blocked'; nB--; } else if (nA > 0) { states[i] = 'ach'; nA--; }
  }
  return states;
}

function synapse(o, opt = {}) {
  const { vesicles = true, spill = true, receptors = true, enzyme = true, impulse = false, calcium = false, chopped = false, labels = false } = opt;
  const p = o.p, depth = 72 * (.35 + .65 * clamp(p.receptors, 0, 1));  // folds flatten when receptors are lost
  let s = '';
  // Muscle fibre surface with its folds.
  let mem = 'M20 150';
  for (const x of FOLDS) mem += ` H${x - 11} L${x - 5} ${f(150 + depth)} Q${x} ${f(158 + depth)} ${x + 5} ${f(150 + depth)} L${x + 11} 150`;
  mem += ' H460';
  s += `<path d="${mem} V250 H20 Z" fill="${ORGAN}"/><path d="${mem}" fill="none" stroke="${WALL}" stroke-width="3"/>`;
  // Nerve and its ending.
  s += `<rect x="222" y="-60" width="36" height="88" fill="#fff"/><path d="M222 -60 V26 M258 -60 V26" stroke="${INK}" stroke-width="3"/>`;
  s += `<path d="M222 24 C150 24 96 34 96 66 V96 Q96 110 110 110 H370 Q384 110 384 96 V66 C384 34 330 24 258 24" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  if (impulse) s += arrow('M240 -54 V12', BLUE, 7);
  if (vesicles) {
    const full = Math.round(VESICLES.length * clamp(o.release, 0, 1));
    VESICLES.forEach(([x, y], i) => {
      s += `<circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${GREEN}" stroke-width="1.5"/>`;
      if (i < full) s += [[-4, -3], [4, -4], [0, 4]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.8" fill="${GREEN}"/>`).join('');
    });
    if (spill) for (const x of [206, 280]) s += `<path d="M${x - 12} 110 A12 12 0 0 1 ${x + 12} 110" fill="#fff" stroke="${GREEN}" stroke-width="1.5"/>`;
  }
  if (calcium) {
    for (const [x, y] of [[100, 82], [112, 98], [380, 82], [368, 98], [120, 84], [360, 86]]) s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${AMBER}"/>`;
    s += arrow('M70 92 H92', AMBER, 2.5) + arrow('M410 92 H388', AMBER, 2.5);
  }
  // Acetylcholine drifting in the gap.
  if (spill) {
    const n = clamp(Math.round((opt.A ?? o.A) * 7), 0, GAP_DOTS.length);
    s += `<g data-dots="${n}">${GAP_DOTS.slice(0, n).map(([x, y]) => `<circle cx="${f(x)}" cy="${y}" r="3.5" fill="${GREEN}"/>`).join('')}</g>`;
  }
  if (receptors) {
    const states = opt.states || receptorStates(o);
    RECEPTORS.forEach((x, i) => {
      const st = states[i];
      if (st === 'missing') { s += `<g data-receptor="missing"><rect x="${x - 9}" y="139" width="18" height="24" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>${antibody(x, 126)}</g>`; return; }
      const open = st === 'ach' || st === 'sux', gap = open ? 4 : 1;
      s += `<g data-receptor="${st}"><rect x="${x - gap - 7}" y="139" width="7" height="24" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/><rect x="${x + gap}" y="139" width="7" height="24" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/>`;
      if (st === 'ach') s += `<circle cx="${x}" cy="132" r="5" fill="${GREEN}"/>`;
      if (st === 'sux') s += diamond(x, 131, 6);
      if (st === 'blocked') s += plug(x, 131);
      if (open) s += arrow(`M${x} 167 V190`, INK, 2);
      s += '</g>';
    });
  }
  if (enzyme) {
    for (const x of FOLDS) {
      const y = f(150 + depth * .45);
      s += enzymeShape(x, y);
      if (p.ache < .6) s += cross(x, y - 1, 8);
    }
    if (chopped) for (const x of FOLDS) s += `<path d="M${x - 22} 128 a5 5 0 0 1 10 0 z M${x + 10} 120 a5 5 0 0 0 10 0 z" fill="${GREEN}"/>`;
  }
  if (labels) {
    s += text(90, 52, 'nerve', 'xs', 'end') + text(90, 68, 'ending', 'xs', 'end');
    s += text(470, 134, 'gap', 'xs', 'end') + text(468, 240, 'end plate', 'xs on-organ', 'end');
  }
  return s;
}

// End plate voltage over time for a typical fibre, in a 480 × 180 frame.
const T_REST = 150, T_UNIT = 30, T_START = 120;
const traceShape = u => u < 0 ? 0 : (1 - Math.exp(-u / 5)) * Math.exp(-u / 45);
const T_PEAK = (() => { let best = 0, at = 0; for (let u = 0; u < 200; u += .5) { const v = traceShape(u); if (v > best) { best = v; at = u; } } return { best, at }; })();
function traceGeom(o) {
  const held = o.blocked;  // the typical fibre: held depolarized fibres sit higher and barely respond
  const rest = T_REST - T_UNIT * .95 * held, h = T_UNIT * o.S * Math.pow(1 - held, 2);
  let d = `M40 ${f(rest)} H${T_START}`;
  for (let x = T_START + 2; x <= 444; x += 3) d += ` L${x} ${f(rest - h * traceShape(x - T_START) / T_PEAK.best)}`;
  return { d, rest, peak: rest - h, px: T_START + T_PEAK.at };
}
function tracePanel(o, ghost, { threshold = true, status = true } = {}) {
  let s = `<rect x="16" y="0" width="448" height="180" fill="#fff" stroke="${RULE}"/>`;
  s += text(28, 22, 'end plate voltage ↑', 'xs', 'start') + text(452, 170, 'time →', 'xs', 'end');
  const th = T_REST - T_UNIT;
  if (threshold) s += `<path data-threshold d="M28 ${th} H452" stroke="${RED}" stroke-width="2"/>${text(452, th - 7, 'threshold', 'xs red', 'end')}`;
  if (ghost) s += `<path class="ghost" d="${traceGeom(ghost).d}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  const G = traceGeom(o);
  s += `<path data-trace="epp" d="${G.d}" fill="none" stroke="${BLUE}" stroke-width="4" stroke-linejoin="round"/>`;
  if (threshold) {
    if (G.peak < th - 8 && o.blocked < .4) s += `<path d="M${f(G.px + 14)} ${th - 2} V${f(G.peak + 3)}" stroke="${INK}" stroke-width="2" marker-start="url(#ah-k)" marker-end="url(#ah-k)"/>${text(f(G.px + 26), f((th + G.peak) / 2 + 5), 'safety margin', 'xs b', 'start')}`;
    if (status) {
      const t0 = o.twitch[0];
      const word = o.blocked > .4 ? 'held depolarized: cannot reset' : t0 > .97 ? 'every fibre fires' : t0 > .5 ? 'some fibres miss' : t0 > .03 ? 'most fibres miss' : 'no fibre fires';
      s += text(452, 22, word, 'xs b blue', 'end');
    }
  }
  return `<g class="on-white">${s}</g>`;
}

// Twitch strength for a quick burst of impulses, in a 480 × 150 frame.
const TW_X = [110, 200, 290, 380], TW_BASE = 124, TW_H = 92;
const bump = (cx, h, base = TW_BASE, w = 38) => `M${cx - w} ${base} C${cx - w / 2} ${base} ${cx - w * .36} ${f(base - h)} ${cx} ${f(base - h)} C${cx + w * .36} ${f(base - h)} ${cx + w / 2} ${base} ${cx + w} ${base}`;
function twitchPanel(o, ghost, { flurry = 0, note = true } = {}) {
  let s = `<rect x="16" y="0" width="448" height="148" fill="#fff" stroke="${RULE}"/>`;
  s += text(28, 22, 'twitch strength ↑', 'xs', 'start') + text(452, 142, 'a quick burst of impulses →', 'xs', 'end');
  s += `<path d="M28 ${TW_BASE} H452" stroke="${RULE}" stroke-width="2"/>`;
  if (ghost) s += `<g class="ghost">${TW_X.map((x, k) => `<path d="${bump(x, TW_H * ghost.twitch[k])}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`).join('')}</g>`;
  s += `<g data-twitches>${TW_X.map((x, k) => `<path data-twitch="${k + 1}" d="${bump(x, Math.max(1, TW_H * o.twitch[k]))}" fill="${BLUE_FILL}" stroke="${BLUE}" stroke-width="3"/>`).join('')}</g>`;
  if (flurry > .02) {
    let d = '';
    for (let i = 0; i < 26; i++) { const x = 52 + i * 15, h = (8 + 16 * ((i * .618034 + flurry * 3.7) % 1)) * flurry; d += `M${x} ${TW_BASE} L${x + 3} ${f(TW_BASE - h)} L${x + 6} ${TW_BASE} `; }
    s += `<path data-flurry d="${d}" fill="none" stroke="${INK}" stroke-width="2"/>`;
    if (flurry > .15) s += text(452, 22, 'a flurry of small twitches', 'xs b', 'end');
  } else if (note && o.p.sux > .2) s += text(452, 22, 'after a brief flurry of small twitches', 'xs', 'end');
  return `<g class="on-white">${s}</g>`;
}

// The whole picture: close-up, end plate voltage and twitches, with an optional ghost of normal and a legend.
function picture(o, { ghost = null, legend = '', flurry = 0, tag = '' } = {}) {
  let b = DEFS + g(64, synapse(o, { labels: !ghost })) + g(326, tracePanel(o, ghost)) + g(518, twitchPanel(o, ghost, { flurry }));
  if (tag) b += text(470, 22, tag, 'xs b blue', 'end');
  const h = ghost ? 724 : 680;
  return withState(o, b, ghost, legend, h);
}
function withState(o, b, ghost, legend, h) {
  const attrs = s => `data-ach="${(s.A / BASE.A).toFixed(4)}" data-opened="${(s.opened / BASE.opened).toFixed(4)}" data-epp="${(s.epp / BASE.epp).toFixed(4)}" data-safety="${(s.safety / BASE.safety).toFixed(4)}" data-twitch1="${s.twitch[0].toFixed(4)}" data-twitch4="${s.twitch[3].toFixed(4)}" data-fade="${s.fade.toFixed(4)}" data-held="${s.blocked.toFixed(4)}"`;
  let out = `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${b}</g>`;
  if (ghost) {
    const y = h - 50;
    out += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}><path d="M20 ${y} H48" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/></g>${text(56, y + 6, 'normal', 'sm', 'start')}`;
    out += `<path d="M148 ${y} H176" stroke="${BLUE}" stroke-width="6"/>${text(184, y + 6, legend, 'sm blue', 'start')}`;
    const p = o.p, keys = [];
    if (p.ndmb > .5) keys.push([plug(28, 0), 'nondepolarizing blocker']);
    if (p.sux > .05) keys.push([diamond(28, 0, 6), 'succinylcholine']);
    if (p.ache < .6) keys.push([cross(28, 0, 8), 'cholinesterase stopped']);
    if (p.receptors < .8) keys.push([antibody(28, -2), 'antibody, lost receptor']);
    const w = keys.length ? 480 / keys.length : 0;
    keys.forEach(([icon, word], i) => { out += `<g transform="translate(${f(i * w)} ${h - 20})">${icon}${text(46, 5, word, 'xs', 'start')}</g>`; });
  }
  return out;
}

/* ---------- Core step pictures ---------- */
function motorPicture() {
  let b = DEFS + `<rect x="34" y="40" width="46" height="480" rx="23" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>`;
  b += `<text transform="translate(24 420) rotate(-90)" text-anchor="middle" class="sm">spinal cord</text>`;
  b += `<path d="M380 56 V96 M380 504 V540" stroke="#c4bca8" stroke-width="7" stroke-linecap="round"/>`;
  b += `<path d="M380 90 C472 190 472 410 380 510 C288 410 288 190 380 90 Z" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/>`;
  for (const dx of [-44, -22, 0, 22, 44]) b += `<path d="M380 104 C${380 + dx * 1.7} 220 ${380 + dx * 1.7} 380 380 496" fill="none" stroke="#d29a8e" stroke-width="1.5"/>`;
  // The nerve is drawn over the muscle so its branches show where they land.
  b += `<circle cx="57" cy="150" r="12" fill="${INK}"/>`;
  b += `<path d="M69 150 C190 150 200 300 304 304" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  for (const [x, y] of [[340, 266], [354, 304], [340, 342]]) b += `<path d="M300 304 Q318 ${y} ${x} ${y}" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="5" fill="${INK}"/>`;
  b += arrow('M96 128 C176 128 206 250 280 274', BLUE, 3, 'stroke-dasharray="8 7"') + text(176, 150, 'signal', 'sm b blue', 'end');
  b += text(150, 330, 'motor nerve', 'sm b') + text(150, 352, 'a cable of axons', 'sm');
  b += text(94, 106, 'nerve cell', 'sm', 'start') + `<path d="M92 112 L66 142" stroke="${INK}" stroke-width="1.5"/>`;
  b += text(380, 40, 'skeletal muscle', 'sm b');
  return b;
}
function junctionsPicture() {
  const ys = [250, 330, 410, 490], xs = [170, 250, 320, 390];
  let b = DEFS;
  for (const y of ys) b += `<rect x="30" y="${y - 25}" width="420" height="50" rx="25" fill="${ORGAN}" stroke="${WALL}" stroke-width="2.5"/>`;
  b += `<path d="M240 20 V150" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  ys.forEach((y, i) => { const x = xs[i]; b += `<path d="M240 148 C240 184 ${x} ${y - 70} ${x} ${y - 34}" fill="none" stroke="${INK}" stroke-width="3"/><ellipse cx="${x}" cy="${y - 28}" rx="15" ry="7" fill="${INK}"/>`; });
  b += `<circle cx="170" cy="222" r="30" fill="none" stroke="${BLUE}" stroke-width="3" stroke-dasharray="6 5"/>`;
  b += text(20, 176, 'neuromuscular junction', 'sm b blue', 'start') + `<path d="M120 184 L148 200" stroke="${BLUE}" stroke-width="2"/>`;
  b += text(256, 70, 'motor nerve', 'sm b', 'start') + text(240, 550, 'muscle fibres', 'sm b');
  return b;
}
function zoomPicture(o, opt, notes) {
  return DEFS + g(70, synapse(o, opt)) + notes;
}
function tracePicture(threshold) {
  const G = traceGeom(BASE);
  let b = DEFS + g(24, tracePanel(BASE, null, { threshold, status: false }));
  if (!threshold) b += `<path d="M${f(G.px + 30)} ${f(24 + G.peak + 18)} L${f(G.px + 8)} ${f(24 + G.peak + 4)}" stroke="${INK}" stroke-width="1.5"/>` + text(f(G.px + 34), f(24 + G.peak + 28), 'end plate potential', 'sm b on-white', 'start');
  b += text(240, 236, 'one impulse arrives', 'xs');
  return b;
}
function firePicture() {
  let b = DEFS + `<rect x="20" y="110" width="440" height="60" rx="30" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/>`;
  b += `<path d="M240 24 V94" stroke="${INK}" stroke-width="5"/><ellipse cx="240" cy="102" rx="24" ry="10" fill="${INK}"/>${text(240, 147, 'end plate', 'xs on-organ')}`;
  b += arrow('M190 140 H58', BLUE, 5) + arrow('M290 140 H422', BLUE, 5);
  b += text(240, 202, 'muscle action potential', 'sm b blue');
  b += arrow('M240 214 V246', INK, 2.5);
  b += `<rect x="86" y="262" width="308" height="76" rx="38" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/>`;
  b += arrow('M28 300 H76', INK, 3) + arrow('M452 300 H404', INK, 3) + text(240, 366, 'the fibre shortens', 'sm');
  b += g(386, `<g class="on-white"><rect x="16" y="0" width="448" height="140" fill="#fff" stroke="${RULE}"/>${text(28, 22, 'strength ↑', 'xs', 'start')}${text(452, 132, 'time →', 'xs', 'end')}<path d="M28 112 H452" stroke="${RULE}" stroke-width="2"/><path d="${bump(240, 76, 112, 60)}" fill="${BLUE_FILL}" stroke="${BLUE}" stroke-width="3"/>${text(452, 22, 'one twitch', 'xs b blue', 'end')}</g>`);
  return b;
}
function burstPicture(o) {
  let b = DEFS + '<g class="on-white">';
  const X = [130, 220, 310, 400];
  b += `<rect x="16" y="8" width="448" height="146" fill="#fff" stroke="${RULE}"/>` + text(28, 30, 'acetylcholine released', 'xs', 'start');
  X.forEach((x, k) => { const h = 96 * o.shots[k].release; b += `<rect data-bar="release" x="${x - 16}" y="${f(144 - h)}" width="32" height="${f(h)}" fill="${GREEN}"/>`; });
  b += `<rect x="16" y="166" width="448" height="160" fill="#fff" stroke="${RULE}"/>` + text(28, 188, 'end plate potential', 'xs', 'start');
  X.forEach((x, k) => { const h = 34 * o.shots[k].S; b += `<rect data-bar="epp" x="${x - 16}" y="${f(316 - h)}" width="32" height="${f(h)}" fill="${BLUE}"/>`; });
  b += `<path d="M28 282 H452" stroke="${RED}" stroke-width="2"/>` + text(60, 276, 'threshold', 'xs red', 'start');
  b += g(338, `<rect x="16" y="0" width="448" height="148" fill="#fff" stroke="${RULE}"/>${text(28, 22, 'twitch strength', 'xs', 'start')}<path d="M28 ${TW_BASE} H452" stroke="${RULE}" stroke-width="2"/>${X.map((x, k) => `<path data-twitch="${k + 1}" d="${bump(x, TW_H * o.twitch[k], TW_BASE, 36)}" fill="${BLUE_FILL}" stroke="${BLUE}" stroke-width="3"/>`).join('')}`) + '</g>';
  b += text(452, 512, 'a quick burst of impulses →', 'xs', 'end');
  return b;
}

/* ---------- Words: comparisons and text alternatives ---------- */
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o) {
  return [
    ['Acetylcholine in the gap', trend(o.A, BASE.A, 'more', 'less')],
    ['Gates opened by acetylcholine', trend(o.opened, BASE.opened, 'more', 'fewer')],
    ['End plate potential', trend(o.epp, BASE.epp, 'bigger', 'smaller')],
    ['Safety margin', trend(o.safety, BASE.safety, 'wider', 'narrower')],
    ['First twitch', trend(o.twitch[0], BASE.twitch[0], 'stronger', 'weaker')],
    ['Through a burst', o.fade < .95 ? ['twitches fade', 'down'] : ['no fade', 'same']]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = o => `<ul class="readout" aria-label="Compared with normal">${compare(o).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- Lesson steps ---------- */
const CORE = {
  motor: () => svg('A spinal cord on the left. From a nerve cell inside it, a long motor nerve, a cable of axons, runs to a skeletal muscle on the right and branches into it. A dashed blue arrow along the nerve shows a signal travelling out to the muscle.', motorPicture(), 560),
  junctions: () => svg('A motor nerve coming down from the top and branching. Each branch ends in a small dark knob near the middle of one of several long muscle fibres stacked below. One ending is circled and labelled: the neuromuscular junction.', junctionsPicture(), 570),
  gap: () => svg('Close-up of the nerve ending sitting just above the muscle fibre. A narrow gap, the synaptic gap, separates them. Under the gap, the fibre’s surface dips into deep folds: the end plate.',
    zoomPicture(BASE, { vesicles: false, spill: false, receptors: false, enzyme: false }, text(240, 150, 'nerve ending', 'sm b on-white') + arrow('M434 184 V214', INK, 2, 'marker-start="url(#ah-k)"') + text(474, 170, 'synaptic gap', 'sm b', 'end') + text(240, 312, 'end plate: the folded surface', 'sm b on-organ')), 340),
  packets: () => svg('The same close-up. The nerve ending is filled with round vesicles, and each vesicle holds green dots of acetylcholine.',
    zoomPicture(BASE, { spill: false, receptors: false, enzyme: false }, text(20, 30, 'vesicles, each full', 'sm b', 'start') + text(20, 52, 'of acetylcholine', 'sm b green', 'start') + `<path d="M150 60 V116" stroke="${INK}" stroke-width="1.5"/>`), 340),
  release: () => svg('A blue arrow runs down the nerve: a nerve impulse arriving. Amber calcium dots flow into the nerve ending from both sides, two vesicles have merged with its lower wall, and green acetylcholine dots have spilled into the gap.',
    zoomPicture(BASE, { receptors: false, enzyme: false, impulse: true, calcium: true }, text(270, 34, 'nerve impulse', 'sm b blue', 'start') + text(20, 144, 'calcium', 'xs b amber', 'start') + text(240, 340, 'acetylcholine spills into the gap', 'sm b green')), 356),
  receptors: () => svg('Green acetylcholine dots dock in gate-shaped acetylcholine receptors along the end plate. Each docked gate stands open, and small arrows show sodium flowing through it into the fibre. Gates with nothing docked stay shut.',
    zoomPicture(BASE, { enzyme: false }, text(240, 340, 'docked gates open: sodium flows in ↓', 'sm b')), 356),
  voltage: () => svg('A graph of the end plate’s voltage over time, with the words voltage up and time across. The line is flat at rest, jumps sharply upward when the impulse arrives, then fades back down: the end plate potential.', tracePicture(false), 246),
  margin: () => svg('The same voltage graph with a red line marking the threshold. The end plate potential rises far above it; a double arrow marks the room between the threshold and the peak: the safety margin.', tracePicture(true), 246),
  fire: () => svg('A long muscle fibre with the nerve ending at its middle. Blue arrows spread from the end plate toward both ends of the fibre: the muscle action potential. Below, the fibre is drawn shorter and fatter, and a small graph shows a single bump: one twitch.', firePicture(), 530),
  enzyme: () => svg('The close-up again. Cholinesterase, drawn as small grey mouth shapes in the folds of the end plate, has chopped most of the acetylcholine into broken pieces; only a few dots are left and most gates have closed.',
    zoomPicture(BASE, { A: .45, chopped: true, states: ['empty', 'empty', 'empty', 'empty', 'ach', 'empty', 'empty', 'empty', 'empty', 'empty'] }, text(240, 340, 'cholinesterase chops acetylcholine apart', 'sm b')), 356),
  burst: () => svg('Three rows for a quick burst of impulses. Green bars show each impulse releasing a little less acetylcholine than the last. Blue bars show each end plate potential, smaller each time but all still above the red threshold line. Blue bumps show the twitches, all equally tall.', burstPicture(BASE), 524),
  whole: () => svg('The whole picture. At the top, the close-up: a nerve ending full of vesicles, acetylcholine in the gap, some receptor gates open with sodium flowing in, and cholinesterase in the folds. In the middle, the end plate potential rising well above the threshold, so every fibre fires. At the bottom, a quick burst of impulses giving equally strong twitches.', picture(BASE), 680)
};
const CHANGE_WHERE = {
  ndmb: 'Grey blockers fill most receptor gates, which stay shut; only a few hold acetylcholine.',
  sux: 'Black diamond-shaped succinylcholine molecules sit in most receptor gates, which are held open, and the end plate voltage sits raised just under threshold.',
  che: 'First grey blockers fill most gates. Then a red cross stops cholinesterase, acetylcholine crowds the gap and wins several gates back from the blockers.',
  mg: 'Most receptors are gone, drawn as dashed outlines with red Y-shaped antibodies, and the folds are shallower.'
};
const LEGEND = { ndmb: 'with the blocker', sux: 'with succinylcholine', che: 'blocker, then inhibitor', mg: 'myasthenia gravis' };
const DURATION = { che: 2800 };
function stateAt(kind, t) {
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  if (kind === 'che') {
    // The blocker acts first, then the inhibitor is added.
    const blockerOnly = { ...NORMAL, ndmb: CHANGES.che.ndmb };
    return t < .5 ? mix(NORMAL, blockerOnly, ease(t / .4)) : mix(blockerOnly, { ...NORMAL, ...CHANGES.che }, ease((t - .55) / .45));
  }
  return mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease(t));
}
function changePicture(el, t) {
  const kind = el.dataset.kind, o = model(stateAt(kind, t));
  const flurry = kind === 'sux' && t < 1 ? Math.max(0, Math.sin(Math.PI * clamp((t - .04) / .6, 0, 1))) : 0;
  const tag = kind === 'che' ? (t < .5 ? 'blocker acts' : 'inhibitor added') : '';
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over a faint dashed picture of normal. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o)}.`;
  return { pic: svg(label, picture(o, { ghost: BASE, legend: LEGEND[kind], flurry, tag }), 724), ro: readout(o) };
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frame = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind in CHANGES;
// During a morph only the picture is replaced each frame; the word readout is rewritten only when its words change.
const lastReadout = new WeakMap();
function drawAt(el, t) {
  const v = visualOf(el), { pic, ro } = changePicture(el, t), old = v.querySelector('svg');
  if (!old) { v.innerHTML = pic + ro; lastReadout.set(v, ro); return; }
  old.outerHTML = pic;
  if (lastReadout.get(v) !== ro) { v.querySelector('.readout').outerHTML = ro; lastReadout.set(v, ro); }
}
function animate(el) {
  cancelAnimationFrame(frame);
  if (reducedMotion()) { drawAt(el, 1); return; }
  const length = DURATION[el.dataset.kind] || 1800;
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / length);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
// Pictures are drawn once the reference data has set the model's normal margin.
let started = false;
function startLesson() {
  steps.forEach(el => {
    const kind = el.dataset.kind;
    if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
    else drawAt(el, 1);
    el.querySelector('.replay')?.addEventListener('click', () => animate(el));
  });
  started = true;
  if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(current);
}
function showStep(n, focus = false) {
  if (!started) return;
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
  if (tab.id === 'tab-lesson') { if (started && isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
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
  if (m && started) { if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]); showStep(Number(m[1]) - 1); }
}
window.addEventListener('hashchange', fromHash);

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['release', 'receptors', 'ache', 'ndmb', 'sux'];
const STATE_PARAMS = { ndmb: CHANGES.ndmb, che: { ache: .1 }, mg: CHANGES.mg, fatigue: { release: .1 } };
const CLINICAL_SLIDERS = ['ndmb', 'ache', 'sux'];
const level = (k, v) => k === 'release' ? (v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : k === 'receptors' ? (v > .97 ? 'all' : v > .5 ? 'some lost' : 'most lost')
  : k === 'ache' ? (v > .97 ? 'normal' : v > .55 ? 'slowed' : 'mostly stopped')
  : k === 'ndmb' ? (v < .25 ? 'none' : v < 4 ? 'a little' : v < 10 ? 'moderate' : 'a lot')
  : (v < .02 ? 'none' : v < .4 ? 'a little' : 'a lot');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  for (const k of CLINICAL_SLIDERS) { $(`#clinical-${k}`).value = params[k]; $(`#clinical-${k}-label`).textContent = level(k, params[k]); }
}
const valueOf = id => data.values.find(v => v.id === id);
const reference = id => { const v = valueOf(id); return v.typical ?? (v.low + v.high) / 2; };
// Relative model results scaled to the textbook values (the model's normal sits at the typical value or mid-range).
function measures(o) {
  return {
    vesicles: reference('vesicles') * o.release,
    epp: reference('epp') * o.epp / BASE.epp,
    safety: reference('safety') * o.safety / BASE.safety,
    vRest: reference('vRest') * (1 - .35 * o.blocked)   // held fibres sit about a third less negative beside the end plate
  };
}
const DECIMALS = { safety: 1 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0).replace('-', '−');
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const UP_NOTE = { vRest: ' (less negative)' };
function domain(v) {
  const [lo, hi] = v.scale;
  return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
}
function statusFor(v, shown) {
  if (v.low !== null && v.high !== null) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .02 ? 'at the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
function update() {
  if (!BASE) return;
  syncControls();
  const o = model(params);
  $('#explore-visual').innerHTML = svg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.`, picture(o, { ghost: BASE, legend: 'your settings' }), 724) + readout(o);
  const pct = n => `${Math.round(n * 100)} in 100`;
  const rel = `acetylcholine in the gap ×${(o.A / BASE.A).toFixed(2)} · gates opened ×${(o.opened / BASE.opened).toFixed(2)} · end plate potential ×${(o.epp / BASE.epp).toFixed(2)} · fibres firing on the first impulse ${pct(o.twitch[0])}, on the last of a burst ${pct(o.twitch[3])}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}`; return; }
  const m = measures(o);
  $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}. Scaled as in the Clinical values tab: end plate potential ${fmt('epp', m.epp)} ${valueOf('epp').unit} · safety factor ${fmt('safety', m.safety)} ${valueOf('safety').unit}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = state?.shifts[v.id];
    const dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] + (d === 'up' ? UP_NOTE[v.id] || '' : '') : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = Number(val.toFixed(DECIMALS[v.id] ?? 0));
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
for (const k of CLINICAL_SLIDERS) $(`#clinical-${k}`).addEventListener('input', e => {
  params[k] = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  update(); announce();
});
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(STATE_PARAMS[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]${s.mechanismWhere ? ` Mechanism: ${s.mechanismWhere} [${s.mechanismSource}]` : ''}` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(model(params));
    $('#cv-live').textContent = `Model end plate potential ${fmt('epp', m.epp)} ${valueOf('epp').unit}, safety factor ${fmt('safety', m.safety)} ${valueOf('safety').unit}, membrane beside the end plate ${fmt('vRest', m.vRest)} ${valueOf('vRest').unit}.`;
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
    for (const id of ['vesicles', 'epp', 'safety', 'vRest']) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && Array.isArray(v.scale) && (Number.isFinite(v.typical) || (Number.isFinite(v.low) && Number.isFinite(v.high))))) throw new Error('Invalid reference data');
    }
    data = loaded;
    MARGIN = reference('safety');
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = `How the numbers are made: the teaching model works in ratios to a normal junction. Its normal is placed at the textbook’s typical value where one is given, or the middle of the textbook range, and each number shown is that point scaled by the model’s ratio. The model’s drug strengths are arbitrary, so the size of each change is illustrative; only its direction is meant to teach.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}</svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the textbook range as a shaded band' : 'the textbook typical value as a tick'}${v.modelKey ? ', and a marker for the current illustrative model' : ''}`);
      const [lo, hi] = v.scale;
      right.querySelector('.key').textContent = `${range ? `Textbook range ${fmt(v.id, v.low)} to ${fmt(v.id, v.high)} ${v.unit} (shaded)` : `Textbook typical value ${fmt(v.id, v.typical)} ${v.unit} (tick; no range given)`} · bar runs ${fmt(v.id, lo)} to ${fmt(v.id, hi)}${v.modelKey ? ' · blue line: model' : ''}`;
      if (!v.modelKey) {
        left.querySelector('.reading').textContent = 'Reference only';
        left.querySelector('.status').textContent = 'Not part of the teaching model';
      }
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
  if (!(MARGIN > 1)) MARGIN = FALLBACK_MARGIN;
  BASE = model(NORMAL);
  startLesson();
  update();
}
load();
