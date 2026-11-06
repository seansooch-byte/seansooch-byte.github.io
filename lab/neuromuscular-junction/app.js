// Lesson 8: The neuromuscular junction. The kit (/lab/kit/kit.js) runs the page; this file is the model,
// the pictures, and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, f, clamp, lerp, span, arrow, readout } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

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

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17).
   Green is acetylcholine, amber sodium, red calcium and antibodies, purple a drug, blue the end plate's voltage,
   the twitches, and what a change moved. */
const INK = C.ink, ACH = C.green, NA = C.amber, CAL = C.red, BLUE = C.blue, DRUG = C.purple, MUTED = C.muted, RULE = C.rule;
const ORGAN = '#f1d6d0', WALL = '#a8584c', GATE = '#dfe3d6', ENZ = '#d6d9cc', BLUE_FILL = '#d1d8fd';
const T = text;
const op = a => { const v = clamp(a, 0, 1); return v < .005 ? 'opacity="0"' : `opacity="${v.toFixed(2)}"`; };
const fadeIn = (a, body) => a < .005 ? '' : `<g ${op(a)}>${body}</g>`;
const dot = (x, y, r, col, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${col}" ${extra}/>`;
const ease3 = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const diamond = (x, y, r = 7) => `<path d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${DRUG}"/>`;
const plug = (x, y, w = 20, h = 11) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="3" fill="${DRUG}"/>`;
const cross = (x, y, r = 7) => `<path d="M${f(x - r)} ${f(y - r)} L${f(x + r)} ${f(y + r)} M${f(x + r)} ${f(y - r)} L${f(x - r)} ${f(y + r)}" stroke="${DRUG}" stroke-width="3.5" stroke-linecap="round"/>`;
const antibody = (x, y) => `<path d="M${x} ${y + 10} V${y} M${x} ${y} L${x - 7} ${y - 8} M${x} ${y} L${x + 7} ${y - 8}" fill="none" stroke="${CAL}" stroke-width="3" stroke-linecap="round"/>`;
const calcium = (x, y, a = 1) => `<rect x="${f(x - 5)}" y="${f(y - 5)}" width="10" height="10" fill="${CAL}" ${op(a)}/>`;
function enzyme(x, y, r = 11, open = .5) {
  const a = (.22 + .4 * clamp(open, 0, 1)) * Math.PI / 2, ax = Math.sin(a) * r, ay = Math.cos(a) * r;
  return `<path d="M${f(x)} ${f(y)} L${f(x - ax)} ${f(y - ay)} A${r} ${r} 0 1 0 ${f(x + ax)} ${f(y - ay)} Z" fill="${ENZ}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
}

/* ---------- The close-up: nerve ending, gap and folded end plate (steps 3 to 6 and 10) ---------- */
const GAP = 126, PLATE = 176, FOLDS = [170, 242, 314], GATES = [110, 138, 196, 220, 268, 292, 340, 368];
const VES = [[150, 62], [196, 50], [244, 60], [292, 50], [338, 64], [176, 98], [306, 98]];  // the last two fuse
const ENDING = 'M222 0 V30 C150 30 96 40 96 70 V112 Q96 126 110 126 H370 Q384 126 384 112 V70 C384 40 330 30 258 30 V0 Z';
function plate(depth = 60) {
  let d = `M0 ${PLATE}`;
  for (const x of FOLDS) d += ` H${x - 11} L${x - 6} ${PLATE + depth} Q${x} ${PLATE + depth + 8} ${x + 6} ${PLATE + depth} L${x + 11} ${PLATE}`;
  d += ' H480';
  return `<g data-part="endplate"><path d="${d} V300 H0 Z" fill="${ORGAN}"/><path d="${d}" fill="none" stroke="${WALL}" stroke-width="3"/></g>`;
}
// One gate: two pillars that part when two acetylcholine (or one succinylcholine) sit in its two sites.
function gate(x, st, open = 0) {
  if (st === 'missing') return `<g data-gate="missing"><rect x="${x - 9}" y="${PLATE - 12}" width="18" height="24" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>${antibody(x, PLATE - 24)}</g>`;
  const g = 1.5 + 4 * open;
  let s = `<rect x="${f(x - g - 6)}" y="${PLATE - 12}" width="6" height="24" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/><rect x="${f(x + g)}" y="${PLATE - 12}" width="6" height="24" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/>`;
  if (st === 'ach') s += dot(x - 6, PLATE - 17, 4.5, ACH) + dot(x + 6, PLATE - 17, 4.5, ACH);
  if (st === 'sux') s += diamond(x, PLATE - 18, 7);
  if (st === 'blocked') s += plug(x, PLATE - 18);
  return `<g data-gate="${st}">${s}</g>`;
}
const vesicle = (x, y, a = 1) => `<g ${op(a)}><circle cx="${x}" cy="${f(y)}" r="13" fill="#fff" stroke="${ACH}" stroke-width="1.5"/>${[[-4, -3], [4, -4], [0, 4]].map(([dx, dy]) => dot(x + dx, y + dy, 2.8, ACH)).join('')}</g>`;
// One release, start to finish, for t from 0 to 1 (mode: 'spill' only, 'dock' onto the gates, 'chop' then cleared).
function closeUp(mode, t) {
  const anim = mode === 'spill' || mode === 'dock' || mode === 'chop';
  let b = plate();
  b += `<g data-part="gap"><rect x="96" y="${GAP + 2}" width="288" height="${PLATE - GAP - 14}" fill="#fff" opacity=".45"/></g>`;
  b += `<path d="${ENDING}" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const pulse = span(t, 0, .1);
  if (anim && pulse > 0 && pulse < 1) b += dot(240, lerp(2, 30, pulse), 9, BLUE, 'opacity=".85"');
  // Calcium flows in through doors at the ending's lower corners while the impulse arrives.
  if (anim) {
    b += `<g data-part="calcium">`;
    for (const [x, dir] of [[104, 1], [376, -1]]) for (let k = 0; k < 3; k++) {
      const u = span(t, .06 + k * .03, .2 + k * .03);
      if (u > 0 && u < 1) b += calcium(x - dir * 22 + dir * 46 * u, 112 - 14 * u, Math.sin(Math.PI * u));
    }
    b += `</g>`;
  }
  // Vesicles; the last two merge with the wall and spill.
  let ves = '';
  VES.forEach(([x, y], i) => {
    if (mode === 'bare') return;
    if (i < 5 || !anim) { ves += vesicle(x, y); return; }
    if (t < .2) ves += vesicle(x, lerp(y, 112, ease3(span(t, .1, .2))));
    else if (t < .92) ves += `<rect x="${x - 11}" y="${GAP - 3}" width="22" height="6" fill="#fff"/><path d="M${x - 13} ${GAP} A13 13 0 0 1 ${x + 13} ${GAP}" fill="none" stroke="${ACH}" stroke-width="1.5"/>`;
    else ves += vesicle(x, y, span(t, .92, 1));
  });
  b += `<g data-part="vesicles">${ves}</g>`;
  // Acetylcholine: in 'dock' and 'chop' two molecules land in each gate's sites; the rest stay in the gap.
  const docks = mode === 'spill' || !anim ? [] : GATES.flatMap(x => [[x - 6, PLATE - 17], [x + 6, PLATE - 17]]);
  const free = [[124, 146], [150, 138], [232, 144], [254, 136], [328, 146], [356, 138], [286, 150], [176, 150]];
  let dots = '', open = 0;
  [...docks, ...free].forEach(([tx, ty], i) => {
    const sx = tx < 241 ? 176 : 306, lag = (i % 6) * .012, u = ease3(span(t, .2 + lag, .42 + lag));
    if (!anim || u <= 0) return;
    let x = lerp(sx, tx, u) + Math.sin(u * Math.PI) * ((i % 3) - 1) * 10, y = lerp(GAP + 4, ty, u), a = 1 - span(t, .78 + lag, .9 + lag), split = 0;
    if (mode === 'chop') {
      const ex = FOLDS.reduce((m, e) => Math.abs(e - tx) < Math.abs(m - tx) ? e : m), k = (i % 8) * .012, go = ease3(span(t, .56 + k, .64 + k));
      x = lerp(x, ex, go); y = lerp(y, PLATE + 18, go); split = span(t, .64 + k, .76 + k); a = 1;
    }
    if (a < .01 || split >= 1) return;
    dots += split > 0 ? `<g ${op(1 - span(split, .5, 1))}><path d="M${f(x - 2 - 9 * split)} ${f(y - 5 - 6 * split)} a5 5 0 0 0 0 10 z" fill="${ACH}"/><path d="M${f(x + 2 + 9 * split)} ${f(y - 5 - 6 * split)} a5 5 0 0 1 0 10 z" fill="${ACH}"/></g>` : dot(x, y, 4.5, ACH, a < 1 ? op(a) : '');
  });
  if (docks.length) open = span(t, .4, .46) * (1 - span(t, mode === 'chop' ? .6 : .8, mode === 'chop' ? .68 : .88));
  if (mode === 'dock' || mode === 'chop') b += `<g data-part="gates">${GATES.map(x => gate(x, 'empty', open)).join('')}</g>`;
  b += `<g data-part="ach">${dots}</g>`;
  // Sodium rushes into the fibre through every open gate.
  if (open > .05) b += `<g data-part="sodium">${GATES.map((x, i) => { const u = (t * 6 + i * .13) % 1; return dot(x, lerp(PLATE - 2, PLATE + 46, u), 4.5, NA, op(open * Math.sin(Math.PI * u))); }).join('')}</g>`;
  if (mode === 'chop') b += `<g data-part="enzyme">${FOLDS.map(x => enzyme(x, PLATE + 26, 11, mode === 'chop' ? .3 + .7 * Math.abs(Math.sin(Math.PI * 4 * span(t, .56, .78))) : .5)).join('')}</g>`;
  return b;
}

/* ---------- The end plate's voltage after one impulse (steps 7 and 8) ---------- */
const traceShape = u => u < 0 ? 0 : (1 - Math.exp(-u / 5)) * Math.exp(-u / 45);
const T_PEAK = (() => { let best = 0, at = 0; for (let u = 0; u < 200; u += .5) { const v = traceShape(u); if (v > best) { best = v; at = u; } } return { best, at }; })();
function eppArt(margin, t) {
  const rest = 232, unit = 40, x0 = 56, start = 120, cursor = lerp(x0, 462, t);
  const h = unit * (MARGIN || 3);
  let d = `M${x0} ${rest}`;
  for (let x = x0 + 4; x <= Math.min(cursor, 462); x += 3) d += ` L${x} ${f(rest - (x < start ? 0 : h * traceShape(x - start) / T_PEAK.best))}`;
  let b = `<path d="M${x0 - 8} 40 V248" stroke="${MUTED}" stroke-width="1.5"/>${T(x0 - 2, 44, 'end plate voltage ↑', 'xs muted', 'start')}${T(462, 268, 'time →', 'xs muted', 'end')}`;
  b += arrow(`M${start} 286 V${rest + 12}`, BLUE, 3) + T(start, 306, 'the impulse arrives', 'xs b blue');
  if (margin) b += `<g data-part="threshold"><path d="M${x0} ${rest - unit} H462" stroke="${CAL}" stroke-width="2.5"/>${T(462, rest - unit - 8, 'threshold', 'xs b red', 'end')}</g>`;
  b += `<g data-part="trace"><path d="${d}" fill="none" stroke="${BLUE}" stroke-width="4.5" stroke-linejoin="round"/></g>`;
  const px = start + T_PEAK.at, py = rest - h;
  if (cursor > px + 6) {
    if (margin) b += `<g data-part="margin">${arrow(`M${f(px)} ${rest - unit - 4} V${f(py + 8)}`, INK, 2.5, `marker-start="url(#ah-k)"`)}${T(px + 72, py + 24, 'safety margin:', 'xs b', 'start')}${T(px + 72, py + 46, 'far more than needed', 'xs', 'start')}</g>`;
    else b += `<g data-part="trace">${T(px + 22, py + 6, 'end plate potential', 'sm b blue', 'start')}</g>`;
  }
  b += T(x0 + 4, rest - 8, 'rest', 'xs muted', 'start');
  return b;
}

/* ---------- Step 9: the fibre fires and twitches ---------- */
function fireArt(t) {
  const u = ease3(span(t, .08, .42)), squeeze = Math.sin(Math.PI * span(t, .3, .9)), shrink = 26 * squeeze;
  const L = 24 + shrink, R = 456 - shrink;
  let b = `<g data-part="fibre"><rect x="${f(L)}" y="${f(96 - 4 * squeeze)}" width="${f(R - L)}" height="${f(60 + 8 * squeeze)}" rx="30" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/></g>`;
  b += `<path d="M240 20 V86" stroke="${INK}" stroke-width="5"/><ellipse cx="240" cy="92" rx="22" ry="9" fill="${INK}"/>${T(256, 34, 'nerve', 'xs', 'start')}`;
  if (u > 0 && t < .6) { const l = 240 - (240 - L) * u, r = 240 + (R - 240) * u; b += `<g data-part="wave" ${op(1 - span(t, .45, .6))}><rect x="${f(l)}" y="102" width="${f(r - l)}" height="48" rx="24" fill="${BLUE}" opacity=".22"/><path d="M${f(l)} 104 V148 M${f(r)} 104 V148" stroke="${BLUE}" stroke-width="5"/></g>`; }
  b += T(240, 136, 'end plate', 'xs b on-organ');
  b += fadeIn(span(t, .1, .2), `${arrow(`M200 186 H${f(lerp(196, 60, u))}`, BLUE, 3.5)}${arrow(`M280 186 H${f(lerp(284, 420, u))}`, BLUE, 3.5)}${T(240, 218, 'the muscle action potential spreads both ways', 'xs b blue')}`);
  b += fadeIn(squeeze, `${arrow(`M${f(L - 20)} 126 H${f(L - 4)}`, INK, 3)}${arrow(`M${f(R + 20)} 126 H${f(R + 4)}`, INK, 3)}`) + T(40, 66, 'the fibre shortens', 'xs b', 'start', op(span(t, .3, .4)));
  // The twitch, drawn as it happens.
  const g = 250, base = 360, cx = lerp(56, 462, t);
  b += `<path d="M48 ${g} V${base}" stroke="${MUTED}" stroke-width="1.5"/>${T(54, g + 4, 'strength ↑', 'xs muted', 'start')}<path d="M48 ${base} H462" stroke="${RULE}" stroke-width="2"/>${T(462, base + 22, 'time →', 'xs muted', 'end')}`;
  let d = `M56 ${base}`;
  for (let x = 56; x <= cx; x += 4) { const v = Math.sin(Math.PI * span((x - 56) / 406, .3, .9)); d += ` L${x} ${f(base - 82 * v)}`; }
  b += `<g data-part="twitch"><path d="${d}" fill="none" stroke="${BLUE}" stroke-width="4"/></g>`;
  if (t > .62) b += T(330, 286, 'one twitch', 'xs b blue', 'start');
  return b;
}

/* ---------- Steps 11, 12 and the changes: a quick burst of four impulses ----------
   Columns are the four impulses. Rows: acetylcholine released (step 11 only) or the gates (the whole picture),
   the end plate potential against threshold, and the twitch. Over a dashed ghost of normal for a change. */
const COLS = [200, 270, 340, 410], TH = 30, TW = 62;
function receptorStates(o) {
  const p = o.p, present = Math.round(8 * clamp(p.receptors, 0, 1)), states = Array(8).fill('empty');
  [1, 6, 3, 4, 0, 7, 2, 5].slice(0, 8 - present).forEach(i => { states[i] = 'missing'; });
  const slots = [0, 4, 2, 6, 1, 5, 3, 7].filter(i => states[i] !== 'missing');
  let nS = p.sux > .02 ? Math.round(present * Math.min(1, o.depol)) : 0;
  let nB = Math.min(present - nS, Math.round(present * o.occB)), nA = Math.min(present - nS - nB, Math.round(present * o.occA));
  for (const i of slots) { if (nS > 0) { states[i] = 'sux'; nS--; } else if (nB > 0) { states[i] = 'blocked'; nB--; } else if (nA > 0) { states[i] = 'ach'; nA--; } }
  return states;
}
// The gates in a row: acetylcholine in the gap above, cholinesterase in the folds below.
function gateRow(o, y0, note = '', a = 1) {
  const y = y0 + 64, states = receptorStates(o), xs = [150, 186, 222, 258, 294, 330, 366, 402];
  let b = T(12, y0 + 22, 'gates on the end plate', 'xs b', 'start') + (note ? fadeIn(a, T(468, y0 + 22, note, 'xs b blue', 'end')) : '');
  b += `<path d="M130 ${y + 10} H420" stroke="${WALL}" stroke-width="3"/>`;
  const n = clamp(Math.round(3 * o.A), 1, 14);
  for (let i = 0; i < n; i++) b += dot(150 + ((i * .618034) % 1) * 252, y0 + 34 + (i % 3) * 5, 4, ACH);
  xs.forEach((x, i) => {
    const st = states[i], open = st === 'ach' || st === 'sux' ? 1 : 0, g = 1.5 + 4 * open;
    if (st === 'missing') { b += `<g data-part="antibody"><rect x="${x - 9}" y="${y - 2}" width="18" height="22" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>${antibody(x, y - 12)}</g>`; return; }
    let s = `<rect x="${f(x - g - 6)}" y="${y - 2}" width="6" height="22" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/><rect x="${f(x + g)}" y="${y - 2}" width="6" height="22" rx="2" fill="${GATE}" stroke="${INK}" stroke-width="1.5"/>`;
    if (st === 'ach') s += dot(x - 6, y - 7, 4, ACH) + dot(x + 6, y - 7, 4, ACH);
    b += `<g data-part="gates">${s}</g>`;
    if (st === 'sux') b += `<g data-part="drug">${diamond(x, y - 8, 7)}</g>`;
    if (st === 'blocked') b += `<g data-part="drug">${plug(x, y - 8)}</g>`;
  });
  b += `<g data-part="enzyme">${[168, 276, 384].map(x => enzyme(x, y + 24, 9)).join('')}${o.p.ache < .6 ? [168, 276, 384].map(x => cross(x, y + 22, 7)).join('') : ''}</g>`;
  return b;
}
// The end plate potential for each impulse of the burst, as a bar against the threshold line.
function eppRow(o, ghost, y0, note = '', a = 1) {
  const base = y0 + 122, thr = base - TH;
  let b = T(12, y0 + 18, 'end plate potential', 'xs b', 'start') + (note ? fadeIn(a, T(468, y0 + 18, note, 'xs b blue', 'end')) : '');
  b += `<path d="M150 ${base} H440" stroke="${RULE}" stroke-width="2"/>`;
  const held = o.blocked;
  if (held > .05) b += `<g data-part="held"><rect x="160" y="${f(base - TH * 1.25 * held)}" width="276" height="${f(TH * 1.25 * held)}" fill="${BLUE}" opacity=".18"/><path d="M160 ${f(base - TH * 1.25 * held)} H436" stroke="${BLUE}" stroke-width="2.5" stroke-dasharray="8 4"/></g>`;
  COLS.forEach((x, k) => {
    if (ghost) b += `<rect class="ghost" x="${x - 17}" y="${f(base - TH * ghost.shots[k].S)}" width="34" height="${f(TH * ghost.shots[k].S)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    const hgt = TH * o.shots[k].S * (1 - .9 * held);
    b += `<g data-part="trace"><rect x="${x - 13}" y="${f(base - hgt)}" width="26" height="${f(Math.max(hgt, 1))}" fill="${BLUE}"/></g>`;
  });
  b += `<g data-part="threshold"><path d="M150 ${thr} H440" stroke="${CAL}" stroke-width="2.5"/>${T(144, thr + 6, 'threshold', 'xs b red', 'end')}</g>`;
  return b;
}
const bump = (cx, h, base, w = 30) => `M${cx - w} ${base} C${cx - w / 2} ${base} ${f(cx - w * .36)} ${f(base - h)} ${cx} ${f(base - h)} C${f(cx + w * .36)} ${f(base - h)} ${cx + w / 2} ${base} ${cx + w} ${base}`;
function twitchRow(o, ghost, y0, note = '', a = 1, flurry = 0) {
  const base = y0 + 96;
  let b = T(12, y0 + 18, 'twitch strength', 'xs b', 'start') + (note ? fadeIn(a, T(468, y0 + 18, note, 'xs b blue', 'end')) : '');
  b += `<path d="M150 ${base} H440" stroke="${RULE}" stroke-width="2"/>`;
  COLS.forEach((x, k) => {
    if (ghost) b += `<path class="ghost" d="${bump(x, TW * ghost.twitch[k], base)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    b += `<g data-part="twitch"><path d="${bump(x, Math.max(1, TW * o.twitch[k]), base)}" fill="${BLUE_FILL}" stroke="${BLUE}" stroke-width="3"/></g>`;
  });
  if (flurry > .02) {
    let d = '';
    for (let i = 0; i < 18; i++) { const x = 158 + i * 15.5, h = (6 + 14 * ((i * .618034 + flurry * 3.7) % 1)) * flurry; d += `M${f(x)} ${base} L${f(x + 3)} ${f(base - h)} L${f(x + 6)} ${base} `; }
    b += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2"/>` + T(468, y0 + 40, 'a flurry of small twitches', 'xs b', 'end', op(span(flurry, .1, .3)));
  }
  return b;
}
const IMPULSES = 'four quick impulses →';
function burstArt(t) {
  const o = BASE, shown = k => span(t, .06 + k * .22, .16 + k * .22);
  let b = T(12, 18, 'acetylcholine released', 'xs b', 'start') + `<path d="M150 110 H440" stroke="${RULE}" stroke-width="2"/>`;
  COLS.forEach((x, k) => { const s = shown(k), h = 78 * o.shots[k].release * s; if (s > 0) b += `<g data-part="ach"><rect x="${x - 13}" y="${f(110 - h)}" width="26" height="${f(h)}" fill="${ACH}"/></g>`; });
  b += fadeIn(shown(3), T(468, 18, 'a little less each time', 'xs b', 'end'));
  // Reuse the rows of the whole picture, revealing one impulse at a time.
  const part = { ...o, shots: o.shots.map((s, k) => ({ ...s, S: s.S * shown(k) })), twitch: o.twitch.map((w, k) => w * shown(k)) };
  b += eppRow(part, null, 124, shown(3) > .5 ? 'all still above threshold' : '', shown(3));
  b += twitchRow(part, null, 270, shown(3) > .5 ? 'all equally strong' : '', shown(3));
  b += T(440, 392, IMPULSES, 'xs muted', 'end');
  return b;
}
const NOTES = {
  ndmb: ['jammed shut by the blocker', 'many fall below threshold', 'weaker, and fading ↓'],
  sux: ['opened again and again', 'held up: sodium doors lock', 'small, but no fade ↓'],
  che: ['acetylcholine wins gates back', 'back above threshold ↑', 'twitches recover ↑'],
  mg: ['gates lost to antibodies', 'only just above threshold', 'fading with use ↓']
};
function tofArt(o, { ghost = null, legend = '', kind = '', a = 1, flurry = 0, tag = '' } = {}) {
  const [n1, n2, n3] = NOTES[kind] || [];
  let b = gateRow(o, 0, n1, a) + eppRow(o, ghost, 100, n2, a) + twitchRow(o, ghost, 236, n3, a, flurry);
  b += T(440, 354, IMPULSES, 'xs muted', 'end');
  if (tag) b += T(12, 354, tag, 'xs b blue', 'start');
  let h = 362;
  if (ghost) {
    const items = [[`<path d="M0 -6 H28" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>`, 'normal', 36]];
    if (o.p.ndmb > .5) items.push([plug(9, -6, 18, 10), 'blocker', 24]);
    if (o.p.sux > .05) items.push([diamond(9, -6, 7), 'succinylcholine', 22]);
    if (o.p.ache < .6) items.push([cross(9, -6, 6), 'enzyme stopped', 22]);
    if (o.p.receptors < .9) items.push([antibody(9, -8), 'antibody, gate lost', 22]);
    let x = 12, y = 384;
    for (const [icon, w, pad] of items) { const width = pad + w.length * 9.4; if (x > 12 && x + width > 472) { x = 12; y += 22; } b += `<g transform="translate(${f(x)} ${y})">${icon}${T(pad, 0, w, 'xs', 'start')}</g>`; x += width + 20; }
    h = y + 10;
  }
  const attrs = s => `data-ach="${(s.A / BASE.A).toFixed(4)}" data-opened="${(s.opened / BASE.opened).toFixed(4)}" data-epp="${(s.epp / BASE.epp).toFixed(4)}" data-safety="${(s.safety / BASE.safety).toFixed(4)}" data-twitch1="${s.twitch[0].toFixed(4)}" data-twitch4="${s.twitch[3].toFixed(4)}" data-fade="${s.fade.toFixed(4)}" data-held="${s.blocked.toFixed(4)}"`;
  return { body: `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${b}</g>`, h };
}
const tofSvg = (label, o, opt) => { const { body, h } = tofArt(o, opt); return svg(label, body, { h }); };

/* ---------- Steps 1 and 2: from spinal cord to muscle ---------- */
function motorArt(t) {
  const u = span(t, .05, .5), squeeze = Math.sin(Math.PI * span(t, .48, .9));
  let b = `<rect x="30" y="30" width="46" height="330" rx="23" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>${T(12, 390, 'spinal cord', 'sm', 'start')}`;
  const w = 64 + 18 * squeeze;
  b += `<g data-part="muscle"><path d="M380 56 V92 M380 316 V352" stroke="#c4bca8" stroke-width="7" stroke-linecap="round"/><path d="M380 88 C${f(380 + w)} 160 ${f(380 + w)} 250 380 320 C${f(380 - w)} 250 ${f(380 - w)} 160 380 88 Z" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/></g>`;
  b += T(380, 40, 'skeletal muscle', 'sm b');
  b += `<g data-part="cellbody">${dot(53, 120, 12, INK)}</g>`;
  const nerve = [[65, 120], [170, 120], [210, 210], [304, 206]];
  b += `<g data-part="nerve"><path d="M65 120 C170 120 210 210 304 206" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  for (const [x, y] of [[340, 172], [352, 206], [340, 240]]) b += `<path d="M300 206 Q318 ${y} ${x} ${y}" fill="none" stroke="${INK}" stroke-width="3"/>${dot(x, y, 5, INK)}`;
  b += `</g>`;
  if (u > 0 && u < 1) { const v = 1 - u, [x, y] = [0, 1].map(k => v * v * v * nerve[0][k] + 3 * v * v * u * nerve[1][k] + 3 * v * u * u * nerve[2][k] + u * u * u * nerve[3][k]); b += dot(x, y, 9, BLUE); }
  b += T(150, 262, 'motor nerve:', 'sm b', 'middle') + T(150, 286, 'a cable of axons', 'sm');
  b += T(90, 92, 'nerve cell', 'sm', 'start') + `<path d="M88 98 L62 112" stroke="${INK}" stroke-width="1.5"/>`;
  b += fadeIn(squeeze, T(380, 384, 'the muscle contracts', 'xs b blue'));
  return b;
}
function junctionsArt(t) {
  const ys = [214, 280, 346], xs = [168, 262, 356], u = span(t, .05, .45);
  let b = '';
  ys.forEach((y, i) => { const lit = span(t, .42 + i * .04, .5 + i * .04) * (1 - span(t, .8, .95)); b += `<g data-part="fibres"><rect x="30" y="${y - 24}" width="420" height="48" rx="24" fill="${ORGAN}" stroke="${WALL}" stroke-width="2.5"/>${fadeIn(lit, `<rect x="30" y="${y - 24}" width="420" height="48" rx="24" fill="${BLUE}" opacity=".18"/>`)}</g>`; });
  b += `<path d="M240 20 V130" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  ys.forEach((y, i) => { const x = xs[i]; b += `<path d="M240 128 C240 160 ${x} ${y - 70} ${x} ${y - 32}" fill="none" stroke="${INK}" stroke-width="3"/><ellipse cx="${x}" cy="${y - 27}" rx="15" ry="7" fill="${INK}"/>`; });
  if (u > 0 && u < 1) b += dot(240, lerp(20, 128, u), 8, BLUE);
  b += `<g data-part="nmj"><circle cx="168" cy="186" r="30" fill="none" stroke="${BLUE}" stroke-width="3" stroke-dasharray="6 5"/>${T(16, 132, 'neuromuscular', 'sm b blue', 'start')}${T(16, 154, 'junction', 'sm b blue', 'start')}<path d="M92 160 L142 178" stroke="${BLUE}" stroke-width="2"/></g>`;
  b += T(258, 60, 'motor nerve', 'sm b', 'start') + T(240, 400, 'muscle fibres', 'sm b');
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
const readoutOf = o => readout(compare(o).map(([k, [w, d]]) => [k, d, w]));
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const CHANGE_WHERE = {
  ndmb: 'Purple blockers fill most gates, which stay shut; only a few hold acetylcholine. The end plate potentials fall towards threshold and the twitches weaken and fade.',
  sux: 'Purple succinylcholine diamonds sit in most gates, which are held open; after a flurry of small twitches the end plate stays held up and the twitches shrink, all alike.',
  che: 'First purple blockers fill most gates. Then purple crosses stop cholinesterase, acetylcholine crowds the gap and wins gates back, and the end plate potentials and twitches recover.',
  mg: 'Most gates are gone, drawn as dashed outlines with red Y-shaped antibodies; the end plate potentials only just clear threshold and the twitches fade.'
};
const LEGEND = { ndmb: 'with the blocker', sux: 'with succinylcholine', che: 'blocker, then inhibitor', mg: 'myasthenia gravis' };
const TITLE = { ndmb: 'Nondepolarizing blockers', sux: 'Succinylcholine', che: 'Cholinesterase inhibitors after a blocker', mg: 'Myasthenia gravis' };
function stateAt(kind, t) {
  const e = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  if (kind === 'che') {
    // The blocker acts first, then the inhibitor is added.
    const blockerOnly = { ...NORMAL, ndmb: CHANGES.che.ndmb };
    return t < .5 ? mix(NORMAL, blockerOnly, e(t / .4)) : mix(blockerOnly, { ...NORMAL, ...CHANGES.che }, e((t - .55) / .4));
  }
  return mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, e(span(t, .1, .7)));
}
function change(kind) {
  return {
    duration: kind === 'che' ? 4000 : 3200,
    render(t) {
      const o = model(stateAt(kind, t));
      const flurry = kind === 'sux' && t < 1 ? Math.max(0, Math.sin(Math.PI * clamp((t - .06) / .56, 0, 1))) : 0;
      const tag = kind === 'che' ? (t < .5 ? '1: the blocker acts' : '2: the inhibitor is added') : '';
      const label = `${TITLE[kind]}, drawn over a faint dashed picture of normal. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o)}.`;
      return { svg: tofSvg(label, o, { ghost: BASE, legend: LEGEND[kind], kind, a: kind === 'che' ? span(t, .8, .96) : span(t, .62, .92), flurry, tag }), readout: readoutOf(o) };
    }
  };
}
const close = (mode, labels, label, h = 304) => mode === 'bare' || mode === 'still'
  ? () => svg(label, closeUp(mode, 1) + labels(1), { h })
  : { duration: 4400, loop: true, rest: .55, render: t => svg(label, closeUp(mode, t) + labels(t), { h }) };
const NERVE_END = () => T(8, 70, 'nerve', 'sm b', 'start') + T(8, 92, 'ending', 'sm b', 'start');
const scenes = {
  motor: { duration: 4200, loop: true, rest: .6, render: t => svg('A spinal cord on the left. From a nerve cell inside it, a long motor nerve, a cable of axons, runs to a skeletal muscle on the right and branches into it. A blue signal travels out along the nerve, and when it arrives the muscle bulges as it contracts.', motorArt(t), { h: 398 }) },
  junctions: { duration: 3600, loop: true, rest: .55, render: t => svg('A motor nerve coming down from the top and branching. Each branch ends in a small dark knob near the middle of one of three long muscle fibres stacked below. A signal runs down the nerve and each fibre lights as its branch delivers it. One ending is circled: the neuromuscular junction.', junctionsArt(t), { h: 408 }) },
  gap: close('bare', () => NERVE_END() + `<g data-part="gap">${arrow(`M392 ${GAP + 4} V${PLATE - 6}`, INK, 2, 'marker-start="url(#ah-k)"')}${T(400, 142, 'synaptic', 'xs b', 'start')}${T(400, 162, 'gap', 'xs b', 'start')}</g>` + `<g data-part="endplate">${T(240, 262, 'end plate: the folded surface', 'sm b on-organ')}</g>` + T(12, 292, 'muscle fibre', 'xs on-organ', 'start'),
    'Close-up of the nerve ending sitting just above the muscle fibre. A narrow gap, the synaptic gap, separates them. Under the gap, the fibre’s surface dips into deep folds: the end plate.'),
  packets: close('still', () => NERVE_END() + `<g data-part="vesicles">${T(240, 152, 'vesicles: bubbles of acetylcholine', 'xs b green')}</g>`,
    'The same close-up. The nerve ending is filled with round vesicles, and each vesicle holds green dots of acetylcholine.'),
  release: close('spill', () => T(262, 18, 'nerve impulse', 'xs b blue', 'start') + `<g data-part="calcium">${T(8, 106, 'calcium', 'xs b red', 'start')}${T(8, 126, 'flows in', 'xs b red', 'start')}</g>` + `<g data-part="ach">${T(240, 274, 'acetylcholine spills into the gap', 'xs b green on-organ')}</g>`,
    'A blue nerve impulse runs down the nerve. Red calcium squares flow into the nerve ending from both lower corners, two vesicles merge with its lower wall, and green acetylcholine dots spill into the gap, then drift away.'),
  receptors: close('dock', () => `<g data-part="gates">${T(240, 264, 'gates: acetylcholine receptors', 'xs b on-organ')}</g><g data-part="sodium">${T(240, 288, 'open gates let sodium rush in', 'xs b amber on-organ')}</g>`,
    'Acetylcholine spills into the gap and two molecules dock in each gate-shaped receptor along the end plate. Each gate with both its sites filled opens, and amber sodium dots rush through it into the fibre. When the acetylcholine leaves, the gates shut.'),
  voltage: { duration: 2800, render: t => svg('A graph of the end plate’s voltage over time. The line is flat at rest, jumps sharply upward just after the impulse arrives, then fades back down: the end plate potential.', eppArt(false, t), { h: 318 }) },
  margin: { duration: 2800, render: t => svg('The same voltage graph with a red line marking the threshold. The end plate potential rises far above it; a double arrow marks the room between the threshold and the peak: the safety margin.', eppArt(true, t), { h: 318 }) },
  fire: { duration: 4200, loop: true, rest: .5, render: t => svg('A long muscle fibre with the nerve ending at its middle. A blue band spreads from the end plate toward both ends of the fibre, the muscle action potential; then the fibre shortens and fattens, and a graph below draws a single bump: one twitch.', fireArt(t), { h: 392 }) },
  enzyme: close('chop', () => `<g data-part="enzyme">${T(240, 264, 'cholinesterase in the folds', 'xs b on-organ')}${T(240, 288, 'chops acetylcholine: gates close', 'xs on-organ')}</g>`,
    'The close-up again. Acetylcholine docks and the gates open; then the green dots are carried down to cholinesterase, mouth shapes in the folds, and chopped into halves that fade, so the gates close.'),
  burst: { duration: 4400, render: t => svg('Three rows for a quick burst of four impulses. Green bars show each impulse releasing a little less acetylcholine than the last. Blue bars show each end plate potential, smaller each time but all still far above the red threshold line. Blue bumps show the four twitches, all equally strong.', burstArt(t), { h: 400 }) },
  whole: () => tofSvg('The whole picture. At the top, a row of eight gates on the end plate, about half holding acetylcholine, with cholinesterase below. In the middle, four end plate potentials from a quick burst, all far above the red threshold line. At the bottom, four equally strong twitches.', BASE),
  ndmb: change('ndmb'), sux: change('sux'), che: change('che'), mg: change('mg'),
};

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
  $('#explore-visual').innerHTML = tofSvg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.`, o, { ghost: BASE, legend: 'your settings' }) + readoutOf(o);
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
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
