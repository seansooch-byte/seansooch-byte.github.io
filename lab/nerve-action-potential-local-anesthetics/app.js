// Lesson 28: Nerve action potential and local anesthetics. The kit (/lab/kit/kit.js) runs the page; this file
// holds the pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore
// freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at the end of any picture.
//   - Colour means one thing: sodium is the amber circle (amber words), potassium the green triangle (green
//     words), the hydrogen ion the small pink circle, the drug purple (a plug, marked + when charged). Kit blue
//     is the impulse and every change: arrows and the words that name them. The axon is nerve yellow.
//   - Voltage traces are drawn from model.js: the resting potential, threshold and peak are the cited values
//     from clinical-values.json; the shape between them is a teaching shape. Sodium's rise is amber,
//     potassium's fall green.
//   - The "What changes it" steps and both reference tabs draw from the same model: the share of sodium
//     channels blocked decides whether the spreading charge lifts the next patch to threshold, so whether the
//     impulse passes the drug and an action potential fires at the far end. Each change is drawn over a dashed
//     outline of normal.
//   - No reference number lives in this file. If clinical-values.json cannot load, no picture is drawn from a
//     copy of the values: each picture and both tabs say the reference values did not load.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, mix, blob, artGhost, arrowFixed, leader } from '/lab/kit/art/core.js';
import { bilayer, membraneBand, channel, enzyme } from '/lab/kit/art/cell.js';
import { ion, drug } from '/lab/kit/art/molecules.js';
import { FAMILIES, AP, SPREAD, anchorsFrom, solve, blocked, blockTrain, apV, bumpV } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, RED = P.ui.red, AMBER = P.ui.amber, GREEN = P.ui.green, MUTED = P.ui.muted;
let A = null;   // the model's anchors, read from clinical-values.json on load (no copy of them lives here)
let cv = null;

/* ---------- Lesson settings (teaching choices; the captions quote what they give) ---------- */
const LESSON = { amount: 1.5, rate: 0.2, trainAmount: 0.5 };
const sg = v => (v > 0 ? '+' : '') + Math.round(v);

/* ---------- Glyphs and small helpers ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
// Glyphs lose the part the library gives them, so each picture names its own parts and none nest.
const bare = s => s.replace(/ data-part="[^"]*"/g, '');
const NA = bare(ion('na').svg);
const K = bare(ion('k', { s: 0.8 }).svg);
const H = bare(ion('h', { s: 1.1 }).svg);
const PLUG = bare(drug({ family: 'plug', s: 0.85 }).svg);
// The drug: a purple plug; the charged form carries a white plus.
const PLUS = `<path d="M-3.2 -2.6 H3.2 M0 -5.8 V0.6" stroke="${P.ui.white}" stroke-width="1.8" stroke-linecap="round"/>`;
const mol = (charged, part = charged ? 'charged' : 'uncharged') => `<g${part ? ` data-part="${part}"` : ''}>${PLUG}${charged ? PLUS : ''}</g>`;
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Points spread evenly at random inside [x, y, w, h], each keeping minD from the others and out of keep boxes.
function scatter(seed, n, [x, y, w, h], minD, keep = []) {
  const r = rng(seed), pts = [];
  for (let tries = 0; pts.length < n && tries < n * 400; tries++) {
    const p = { x: x + r() * w, y: y + r() * h };
    if (keep.some(([kx, ky, kw, kh]) => p.x > kx && p.x < kx + kw && p.y > ky && p.y < ky + kh)) continue;
    if (pts.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD * minD)) pts.push(p);
  }
  return pts;
}
const rrect = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`; };
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const arrow = (a, b, col = BLUE, w = 3, attrs = '') => arrowFixed(a, b, { col, w, head: { l: 10, w: 6 }, attrs });
const plusMark = (x, y, col = INK) => `<path d="M${f(x - 5)} ${f(y)} H${f(x + 5)} M${f(x)} ${f(y - 5)} V${f(y + 5)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`;
const minusMark = (x, y, col = INK) => `<path d="M${f(x - 5)} ${f(y)} H${f(x + 5)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`;

/* ---------- A membrane seen edge-on, with channels (steps 2, 3, 4, 6, 7, 12, 15) ---------- */
// Fluid outside above, the axon's inside below. Channels sit in the membrane at y; s scales the membrane
// art (a group with no text in it).
function sides(y, top = 0, bottom = 420, half = 12) {
  return `<rect x="8" y="${top}" width="464" height="${f(y - half - top)}" fill="${P.space.ecf}"/><rect x="8" y="${f(y + half)}" width="464" height="${f(bottom - y - half)}" fill="${P.nerve.hi}"/>`;
}
function membrane(y, s, chans = []) {
  const x0 = 8 / s, x1 = 472 / s;
  const clear = chans.map(c => [c.x / s - x0, (c.kind === 'kv' ? 31 : 31) + 3]);
  let g = bilayer({ x1: x0, y1: 0, x2: x1, y2: 0, clear }).svg;
  for (const c of chans) {
    const { x, ...o } = c;
    g += channel({ kind: 'nav', ...o, x: x / s, y: 0 }).svg;
  }
  return `<g transform="translate(0 ${f(y)}) scale(${s})">${g}</g>`;
}

/* ---------- Voltage graphs ---------- */
// x0..x1 across, y0 (top, vmax) to y1 (bottom, vmin); tmax in ms.
function graph(x0, x1, y0, y1, tmax, vmin = -90, vmax = 40) {
  return { x0, x1, y0, y1, tmax, X: ms => x0 + ms / tmax * (x1 - x0), Y: v => y1 - (v - vmin) / (vmax - vmin) * (y1 - y0) };
}
function frame(g, { zero = true, thr = true, thrX = null, mv = true } = {}) {
  const { x0, x1, y0, y1, Y } = g;
  let s = `<path d="M${x0} ${y0} V${y1} H${x1}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
  const ticks = [[A.peak, sg(A.peak)], ...(zero ? [[0, '0']] : []), [A.rest, sg(A.rest)]];
  for (const [v, l] of ticks) s += `<path d="M${x0 - 5} ${f(Y(v))} H${x0}" stroke="${INK}" stroke-width="1.5"/>` + text(x0 - 9, Y(v) + 6, l, 'xs', 'end');
  if (mv) s += text(x0 - 9, y0 - 8, 'mV', 'xs muted', 'end');
  if (thr) s += `<g data-part="threshold"><path d="M${x0} ${f(Y(A.threshold))} H${x1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="6 5"/>${text(thrX ?? x0 + 8, Y(A.threshold) - 8, 'threshold', 'xs b muted', 'start')}</g>`;
  return s;
}
// The membrane voltage at ms for a list of events: { ap: tc } (crossing threshold at tc) or { bump: t, lift }.
function voltage(events, ms) {
  let v = A.rest;
  for (const e of events) {
    if (e.ap != null && ms >= e.ap - AP.foot) v = apV(A, ms - e.ap, e.from ?? A.rest);
    else if (e.bump != null && ms >= e.bump) v += bumpV(A, ms - e.bump, e.lift) - A.rest;
  }
  return v;
}
// An action potential that starts while the first is still settling ramps up from where the voltage was.
function withFrom(events) {
  const out = [];
  for (const e of events) out.push(e.ap != null && out.length ? { ...e, from: voltage(out, e.ap - AP.foot) } : e);
  return out;
}
function tracePts(g, fn, t0, t1, n = 160) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const ms = lerp(t0, t1, i / n); pts.push([g.X(ms), g.Y(fn(ms))]); }
  return pts;
}
const ptsD = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L');
const live = (d, col = INK, w = 3.5, extra = '') => `<path d="${d}" fill="none" stroke="${P.ui.panel}" stroke-width="${w + 4}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const ghostTrace = d => `<path d="${d}" fill="none" stroke="${P.ui.ghost}" stroke-width="3" stroke-dasharray="6 5" stroke-linejoin="round"/>`;
// A stimulus: an up arrow under the time axis, as tall as the stimulus is strong.
function stimArrow(g, ms, h, col = INK) {
  const x = g.X(ms), y = g.y1 + 44;
  return arrowFixed([x, y], [x, y - h], { col, w: 3, head: { l: 8, w: 5 } });
}

/* ---------- Step 1: a neuron ---------- */
function neuronPicture() {
  const cx = 86, cy = 140;
  const stroke = (d, w) => `<path d="${d}" fill="none" stroke="${P.nerve.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P.nerve.base}" stroke-width="${f(w - 2.6)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let den = '';
  for (const [deg, len, fork] of [[145, 50, 1], [180, 44, -1], [212, 50, 1], [112, 40, -1], [250, 42, 1], [92, 36, 1], [268, 38, -1]]) {
    const a = deg * Math.PI / 180, x1 = cx + 30 * Math.cos(a), y1 = cy - 30 * Math.sin(a), x2 = cx + (30 + len) * Math.cos(a), y2 = cy - (30 + len) * Math.sin(a);
    const b = a + fork * 0.5, x3 = x2 + 16 * Math.cos(b), y3 = y2 - 16 * Math.sin(b), c = a - fork * 0.45, x4 = x2 + 14 * Math.cos(c), y4 = y2 - 14 * Math.sin(c);
    den += stroke(`M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} M${f(x2)} ${f(y2)} L${f(x4)} ${f(y4)}`, 6);
  }
  let b = `<g data-part="neuron">${den}</g>`;
  // the axon, leaving the cell body at a tapered hillock
  const axonD = `M${cx + 24} ${cy} L392 ${cy}`;
  b += `<g data-part="axon neuron"><path d="M${cx + 20} ${cy - 15} L${cx + 52} ${cy - 7} L${cx + 52} ${cy + 7} L${cx + 20} ${cy + 15} Z" fill="${P.nerve.base}" stroke="${P.nerve.line}" stroke-width="1.75" stroke-linejoin="round"/>`
    + `<path d="${axonD}" fill="none" stroke="${P.nerve.line}" stroke-width="15"/><path d="${axonD}" fill="none" stroke="${P.nerve.base}" stroke-width="11.5"/><path d="M${cx + 54} ${cy - 2.5} L390 ${cy - 2.5}" stroke="${P.ui.white}" stroke-opacity=".35" stroke-width="2.5"/></g>`;
  // axon terminals: three branches ending in small knobs
  let term = '';
  for (const [x, y] of [[446, 98], [458, 140], [446, 182]]) term += stroke(`M390 ${cy} C412 ${cy} ${f(x - 30)} ${y} ${x} ${y}`, 8) + `<circle cx="${x}" cy="${y}" r="7" fill="${P.nerve.base}" stroke="${P.nerve.line}" stroke-width="1.75"/>`;
  b += `<g data-part="neuron">${term}</g>`;
  // the cell body and its nucleus
  b += `<g data-part="soma neuron"><path d="${blob(cx, cy, 34, { lobes: 5, wobble: 0.1, seed: 4 })}" fill="${P.nerve.base}" stroke="${P.nerve.line}" stroke-width="1.75"/><ellipse cx="${cx - 9}" cy="${cy - 12}" rx="10" ry="6" fill="${P.ui.white}" fill-opacity=".3"/>`
    + `<circle cx="${cx - 2}" cy="${cy + 2}" r="13" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="1.25"/><circle cx="${cx + 2}" cy="${cy}" r="4" fill="${P.nucleolus.base}"/></g>`;
  // the impulse: a blue glow on the axon and the way it travels
  b += `<g data-part="impulse"><ellipse cx="262" cy="${cy}" rx="26" ry="13" fill="${BLUE}" fill-opacity=".28"/>${arrow([196, 186], [336, 186], BLUE, 3.5)}${text(266, 216, 'impulse travels this way', 'xs b blue')}</g>`;
  b += text(16, 30, 'cell body', 'sm b', 'start') + leader([52, 38], [cx - 6, cy - 22]);
  b += text(262, 116, 'axon', 'sm b');
  b += text(472, 258, 'axon terminals', 'sm b', 'end') + leader([440, 242], [446, 190], { elbow: false });
  return b;
}

/* ---------- Step 2: the resting membrane and its voltage ---------- */
function restPicture() {
  const y = 170, s = 1.5;
  let b = sides(y, 96, 330, 18);
  b += membrane(y, s);
  // a thin layer of charge on each face: + outside, - inside
  let ch = '';
  for (let x = 28; x < 460; x += 30) { if (Math.abs(x - 362) < 12 || Math.abs(x - 432) < 12) continue; ch += plusMark(x, y - 30) + minusMark(x, y + 30); }
  b += `<g data-part="charges">${ch}</g>`;
  b += scatter(3, 6, [30, 108, 300, 22], 40).map(p => at(NA, p.x, p.y)).join('');
  b += scatter(4, 6, [30, 222, 330, 46], 44, [[16, 274, 170, 30], [300, 220, 80, 60]]).map(p => at(K, p.x, p.y)).join('');
  // the voltmeter: one electrode outside, one inside
  b += `<g data-part="meter"><path d="${rrect(328, 26, 136, 54, 8)}" fill="${P.ui.white}" stroke="${INK}" stroke-width="1.5"/>${text(396, 64, `${sg(A.rest)} mV`, 'lg', 'middle')}`
    + `<path d="M362 80 V128" stroke="${INK}" stroke-width="2"/><circle cx="362" cy="130" r="3.5" fill="${INK}"/><path d="M432 80 V236" stroke="${INK}" stroke-width="2"/><circle cx="432" cy="238" r="3.5" fill="${INK}"/>${text(396, 18, 'membrane potential', 'xs b')}</g>`;
  b += text(16, 52, 'outside the axon', 'sm b', 'start');
  b += text(16, 296, 'inside the axon', 'sm b', 'start');
  b += text(464, 304, 'membrane', 'xs b muted', 'end') + leader([376, 298], [338, y + 10], { elbow: false });
  return b;
}

/* ---------- Step 3: sodium crowded outside ---------- */
function sodiumPicture() {
  const y = 176, s = 1.5;
  let b = sides(y, 44, 350, 18);
  b += membrane(y, s);
  const keep = [[150, 40, 40, 120], [310, 40, 40, 120]];
  b += `<g data-part="sodium">${scatter(7, 18, [26, 62, 436, 82], 26, keep).map(p => at(NA, p.x, p.y)).join('')}${[[120, 240], [300, 262]].map(([x, yy]) => at(NA, x, yy)).join('')}</g>`;  b += scatter(8, 6, [40, 226, 400, 66], 48, [[100, 222, 40, 36], [280, 244, 40, 36], [16, 300, 200, 40], [300, 300, 170, 40]]).map(p => at(K, p.x, p.y)).join('');
  // both urges point inward; the closed membrane stops them
  b += `<g data-part="push">${arrow([170, 52], [170, y - 26], AMBER, 4)}${text(16, 30, 'crowding pushes it in', 'xs b amber', 'start')}</g>`;
  let minus = '';
  for (let x = 40; x < 460; x += 40) minus += minusMark(x, y + 32);
  b += `<g data-part="pull">${arrow([330, 52], [330, y - 26], BLUE, 4)}${minus}${text(464, 30, 'the negative inside pulls it in', 'xs b blue', 'end')}</g>`;
  b += text(16, 330, 'inside the axon', 'sm b', 'start');
  b += text(464, 330, 'no open door yet', 'xs b muted', 'end');
  return b;
}

/* ---------- Step 4: the sodium channel's three states ---------- */
function gatesPicture() {
  const y = 190, s = 1.6, xs = [92, 240, 388];
  let b = sides(y, 40, 336, 20);
  b += scatter(12, 9, [30, 56, 420, 50], 40).map(p => at(NA, p.x, p.y)).join('');
  b += membrane(y, s, [{ x: xs[0], open: 0, inactivated: 0 }, { x: xs[1], open: 1, inactivated: 0, ion: 'na', phase: 0.55 }, { x: xs[2], open: 1, inactivated: 1 }]);
  ['ready', 'open', 'inactivated'].forEach((w, i) => { b += text(xs[i], 130, w, 'sm b'); });
  // what each state's gates are doing, with a leader to the gate
  b += `<g data-part="activation-gate">${text(xs[0], 304, 'activation', 'xs b', 'middle')}${text(xs[0], 324, 'gate shut', 'xs b', 'middle')}${leader([xs[0], 288], [xs[0], y + 13 * s], { elbow: false })}</g>`;
  b += `<g data-part="sodium">${text(xs[1], 304, 'sodium', 'xs b amber', 'middle')}${text(xs[1], 324, 'pours in', 'xs b amber', 'middle')}</g>`;
  b += `<g data-part="inactivation-gate">${text(xs[2], 304, 'inactivation', 'xs b', 'middle')}${text(xs[2], 324, 'gate shut', 'xs b', 'middle')}</g>`;
  b += text(16, 30, 'outside', 'xs muted', 'start') + text(16, 356, 'inside', 'xs muted', 'start');
  return b;
}

/* ---------- Step 5: threshold ---------- */
const G_BIG = () => graph(70, 460, 40, 300, 12);
function thresholdPicture(t) {
  const g = G_BIG(), T = t * g.tmax;
  const bumps = [{ bump: 1, lift: 5 }, { bump: 3.5, lift: 9 }, { bump: 6, lift: 12 }], fire = { ap: 8.5 };
  const ev = [...bumps, fire];
  let b = frame(g);
  const split = 8.5 - AP.foot;
  const fn = ms => voltage(ev, ms);
  b += `<g data-part="depol">${live(ptsD(tracePts(g, fn, 0, Math.min(T, split))))}</g>`;
  if (T > split) b += `<g data-part="trace">${live(ptsD(tracePts(g, fn, split, T, 90)), BLUE)}</g>`;
  // stimuli, as tall as they are strong
  [[1, 10], [3.5, 16], [6, 22], [8.2, 30]].forEach(([ms, h]) => { if (T >= ms) b += stimArrow(g, ms, h); });
  b += text(g.x0, g.y1 + 64, 'stimulus', 'xs muted', 'start');
  b += `<g ${fade(span(T, 6.4, 7.4))}>${text(g.X(3.5), 288, 'small nudges fade away', 'xs b muted')}</g>`;
  b += `<g ${fade(span(T, 8.8, 9.6))}>${text(g.X(8.5) - 12, 66, 'reaches threshold: fires', 'xs b blue', 'end')}</g>`;
  return b;
}

/* ---------- Steps 6 and 7: one action potential over the membrane ---------- */
const G_AP = () => graph(70, 460, 34, 200, 4);
const AP_TC = 1;   // ms where the action potential crosses threshold
function apPieces(g, T) {
  const ev = [{ ap: AP_TC }], fn = ms => voltage(ev, ms), peakT = AP_TC + AP.rise;
  // where the fall crosses rest, so the dip below it can be named on its own
  let restT = peakT;
  while (restT < g.tmax && fn(restT) > A.rest) restT += 0.01;
  const seg = (a, z, col, part) => z > a ? `<g data-part="${part}">${live(ptsD(tracePts(g, fn, a, z, 60)), col)}</g>` : '';
  return { fn, peakT, restT, svg: seg(0, Math.min(T, AP_TC - AP.foot), INK, 'trace') + seg(AP_TC - AP.foot, Math.min(T, peakT), AMBER, 'trace rise') + seg(peakT, Math.min(T, restT), GREEN, 'trace fall') + seg(restT, Math.min(T, g.tmax), GREEN, 'trace under') };
}
function upstrokePicture(t) {
  const g = G_AP(), T = lerp(0.4, AP_TC + AP.rise, ease.inOut(t));
  const p = apPieces(g, T), v = p.fn(T), open = clamp((v - A.threshold) / 8, 0, 1);
  let b = sides(318, 216, 412, 20) + frame(g, { thrX: g.x0 + 8 });
  b += p.svg + `<circle cx="${f(g.X(T))}" cy="${f(g.Y(v))}" r="5" fill="${INK}"/>`;
  b += scatter(21, 7, [30, 226, 420, 48], 34, [[100, 220, 60, 60], [210, 220, 60, 60], [320, 220, 60, 60], [8, 218, 80, 26], [300, 218, 172, 26]]).map(q => at(NA, q.x, q.y)).join('');
  const xs = [130, 240, 350], ph = (t * 3) % 1;
  b += membrane(318, 1.3, xs.map((x, i) => ({ x, open, ion: 'na', phase: (ph + i * 0.33) % 1 })));
  // sodium that has come in collects inside
  b += `<g ${fade(open)}>${[[64, 378], [186, 396], [296, 396], [424, 378]].map(([x, y]) => at(NA, x, y)).join('')}</g>`;
  b += text(16, 236, 'outside', 'xs muted', 'start');
  b += `<g ${fade(open)}>${text(464, 236, 'sodium rushes in', 'xs b amber', 'end')}</g>`;
  b += text(16, 410, 'inside', 'xs muted', 'start');
  return b;
}
function repolarizePicture(t) {
  // the picture ends during the dip below rest, while potassium is still flowing out
  const g = G_AP(), T = lerp(0.4, apPieces(g, g.tmax).restT + 0.35, t);
  const p = apPieces(g, T), v = p.fn(T);
  // sodium gates: open past threshold, inactivated from the peak until after the voltage is back below threshold
  let downT = p.peakT;
  while (downT < g.tmax && p.fn(downT) > A.threshold) downT += 0.01;
  const naOpen = T < p.peakT ? clamp((v - A.threshold) / 8, 0, 1) : T < downT + 0.2 ? 1 : 0;
  const naInact = T < p.peakT ? 0 : 1 - span(T, downT + 0.5, downT + 0.9);
  const kOpen = span(T, p.peakT - 0.1, p.peakT + 0.15) * (1 - span(T, p.restT + 0.6, p.restT + 0.9));
  let b = sides(318, 216, 412, 20) + frame(g, { thrX: g.x0 + 8 });
  b += p.svg + `<circle cx="${f(g.X(T))}" cy="${f(g.Y(v))}" r="5" fill="${INK}"/>`;
  b += `<g ${fade(span(T, p.peakT + 0.3, p.peakT + 0.6))}>${text(g.X(p.peakT) + 60, g.Y(0) + 6, 'repolarization', 'xs b green', 'start')}</g>`;
  b += `<g ${fade(span(T, p.restT + 0.02, p.restT + 0.25))}>${text(g.X(p.restT + 0.6), 226, 'hyperpolarization', 'xs b green', 'middle')}</g>`;
  b += scatter(22, 4, [30, 236, 220, 36], 34, [[60, 220, 80, 60], [150, 220, 80, 60]]).map(q => at(NA, q.x, q.y)).join('');
  const ph = (t * 4) % 1;
  b += membrane(318, 1.3, [{ x: 100, open: naOpen, inactivated: naInact }, { x: 190, open: naOpen, inactivated: naInact }]);
  // potassium channels (four subunits, so drawn as Kv) let potassium out
  b += `<g transform="translate(0 318) scale(1.3)">${[310, 400].map((x, i) => channel({ kind: 'kv', open: kOpen, ion: 'k', phase: (ph + i * 0.5) % 1, x: x / 1.3, y: 0, parts: { channel: 'kchannel' } }).svg).join('')}</g>`;
  b += `<g ${fade(kOpen)}>${[[288, 244], [372, 252], [440, 240]].map(([x, y]) => at(K, x, y)).join('')}</g>`;
  b += [[252, 372], [460, 372]].map(([x, y]) => at(K, x, y)).join('');
  b += text(145, 404, 'sodium: shut out', 'xs b amber', 'middle');
  b += `<g ${fade(span(T, p.peakT, p.peakT + 0.3))}>${text(250, 404, 'potassium flows out', 'xs b green', 'start')}</g>`;
  return b;
}

/* ---------- Step 8: all or none ---------- */
function allOrNonePicture(t) {
  const g = G_BIG(), T = t * g.tmax;
  const ev = [{ bump: 1, lift: 8 }, { ap: 4.3 }, { ap: 8.15 }], fn = ms => voltage(ev, ms);
  let b = frame(g);
  b += `<g data-part="depol">${live(ptsD(tracePts(g, fn, 0, Math.min(T, 4.3 - AP.foot))))}</g>`;
  if (T > 4.3 - AP.foot) b += `<g data-part="peaks">${live(ptsD(tracePts(g, fn, 4.3 - AP.foot, T, 140)), BLUE)}</g>`;
  [[1, 12], [4.0, 24], [7.85, 44]].forEach(([ms, h]) => { if (T >= ms) b += stimArrow(g, ms, h); });
  b += text(g.x0, g.y1 + 64, 'stimulus', 'xs muted', 'start');
  b += `<g ${fade(span(T, 2, 3))}>${text(g.X(1.4), 288, 'below threshold: none', 'xs b muted', 'middle')}</g>`;
  b += `<g ${fade(span(T, 4.6, 5.2))}>${text(g.X(4.4), 30, 'reaches threshold', 'xs b', 'middle')}</g>`;
  b += `<g ${fade(span(T, 8.4, 9))}>${text(g.X(8.3) + 6, 30, 'far past it', 'xs b', 'middle')}</g>`;
  b += `<g data-part="peaks" ${fade(span(T, 8.6, 9.6))}><path d="M${g.x0} ${f(g.Y(A.peak))} H${g.x1}" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="3 4"/>${text(g.x1, g.Y(A.peak) + 24, 'same peak', 'xs b blue', 'end')}</g>`;
  return b;
}

/* ---------- Step 9: refractory periods ---------- */
function refractoryPicture(t) {
  const g = graph(70, 460, 50, 300, 6.4), T = t * g.tmax;
  const tc = 1, ev = withFrom([{ ap: tc }, { ap: 3.3 }]), fn = ms => voltage(ev, ms);
  let downT = tc + AP.rise;
  while (fn(downT) > A.threshold) downT += 0.01;
  const relEnd = tc + AP.rise + AP.fall + AP.back;
  const xa = g.X(tc), xb = g.X(downT), xc = g.X(relEnd);
  let b = `<g data-part="refractory absolute"><rect x="${f(xa)}" y="${g.y0}" width="${f(xb - xa)}" height="${g.y1 - g.y0}" fill="${P.ui.redWash}"/>${text((xa + xb) / 2, 34, 'absolute', 'xs b red')}</g>`;
  b += `<g data-part="refractory relative"><rect x="${f(xb)}" y="${g.y0}" width="${f(xc - xb)}" height="${g.y1 - g.y0}" fill="${mix(AMBER, P.ui.panel, 0.84)}"/>${text((xb + xc) / 2, 34, 'relative', 'xs b amber')}</g>`;
  b += frame(g, { thrX: g.X(4.6) });
  b += live(ptsD(tracePts(g, fn, 0, T, 200)));
  // a strong stimulus in the absolute period does nothing; one in the relative period fires
  const s1 = (tc + downT) / 2 + 0.1;
  if (T >= s1) b += stimArrow(g, s1, 38) + `<path d="M${f(g.X(s1) - 8)} ${g.y1 + 18} l16 16 m0 -16 l-16 16" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>` + text(g.X(s1) - 14, g.y1 + 72, 'no response', 'xs b red', 'end');
  if (T >= 3.0) b += stimArrow(g, 3.0, 38) + text(g.X(3.0) + 10, g.y1 + 72, 'a stronger one fires', 'xs b', 'start');
  return b;
}

/* ---------- Steps 10, 11, 13, 15: a stretch of axon ---------- */
// A long axon seen from the side: membrane top and bottom, nerve-yellow inside. y is its middle.
function axonStrip(y, x0, x1, half) {
  return `<rect x="${x0}" y="${f(y - half)}" width="${x1 - x0}" height="${2 * half}" fill="${P.nerve.hi}"/>${membraneBand({ d: `M${x0} ${f(y - half)} H${x1}`, w: 6 }).svg}${membraneBand({ d: `M${x0} ${f(y + half)} H${x1}`, w: 6 }).svg}`;
}
const DRUG_ZONE = { x0: 190, x1: 310 };
function drugCloud(y, ry, op = 1, seed = 31) {
  const cx = (DRUG_ZONE.x0 + DRUG_ZONE.x1) / 2, rx = (DRUG_ZONE.x1 - DRUG_ZONE.x0) / 2 + 6;
  const pts = scatter(seed, 8, [cx - rx + 8, y - ry + 4, 2 * rx - 16, 2 * ry - 8], 22, [[0, y - 20, 480, 40]]);
  return `<g data-part="drug" ${fade(op)}><ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${P.drug.hi}" fill-opacity=".3" stroke="${P.drug.base}" stroke-opacity=".5" stroke-width="1.25" stroke-dasharray="3 3"/>${pts.map(p => at(PLUG, p.x, p.y)).join('')}</g>`;
}

function travelPicture(t) {
  const y = 150, half = 30, x0 = 20, x1 = 460;
  let b = axonStrip(y, x0, x1, half);
  // the impulse enters at the left and leaves at the right; the cycle is phased so its last frame shows it
  // mid-axon
  const p = lerp(x0 - 60, x1 + 100, (t + 0.55) % 1);
  const clip = (a, z) => [Math.max(x0, a), Math.min(x1, z)];
  // just fired: refractory (hatched)
  const [ra, rz] = clip(p - 110, p - 22);
  if (rz > ra) {
    // slanted hatch lines, each kept inside the patch
    let hatch = '';
    for (let x = ra + 14; x <= rz; x += 10) hatch += `M${f(x)} ${y - half + 5} L${f(x - 12)} ${y + half - 5} `;
    b += `<g data-part="behind"><rect x="${f(ra)}" y="${y - half + 3}" width="${f(rz - ra)}" height="${2 * half - 6}" fill="${MUTED}" fill-opacity=".14"/><path d="${hatch}" stroke="${MUTED}" stroke-opacity=".5" stroke-width="1.25"/></g>`;
  }
  // firing now: blue glow, sodium in through both faces
  const [fa, fz] = clip(p - 22, p + 22);
  if (fz > fa) b += `<g data-part="firing"><rect x="${f(fa)}" y="${y - half + 3}" width="${f(fz - fa)}" height="${2 * half - 6}" fill="${BLUE}" fill-opacity=".3"/>${p > x0 + 4 && p < x1 - 4 ? arrow([p, y - half - 30], [p, y - half + 10], AMBER, 3) + arrow([p, y + half + 30], [p, y + half - 10], AMBER, 3) : ''}</g>`;
  // the charge spreading ahead, inside
  const [sa, sz] = clip(p + 26, p + 74);
  if (sz - sa > 20) b += `<g data-part="firing">${arrow([sa, y], [sz, y], BLUE, 3)}</g>`;
  b += text(240, 46, 'the impulse travels this way', 'xs b blue') + arrow([150, 62], [330, 62], BLUE, 3.5);
  // the key
  b += `<g data-part="firing"><rect x="20" y="226" width="30" height="20" fill="${BLUE}" fill-opacity=".3" stroke="${BLUE}" stroke-width="1"/>${text(62, 242, 'firing: sodium rushes in', 'xs b', 'start')}</g>`;
  b += `<g data-part="firing">${arrow([20, 266], [50, 266], BLUE, 3)}${text(62, 272, 'charge spreads ahead to the next patch', 'xs b', 'start')}</g>`;
  b += `<g data-part="behind"><rect x="20" y="286" width="30" height="20" fill="${MUTED}" fill-opacity=".14" stroke="${MUTED}" stroke-width="1"/><path d="M26 304 L38 288 M36 304 L48 288" stroke="${MUTED}" stroke-opacity=".6" stroke-width="1.25"/>${text(62, 302, 'just fired: refractory, cannot fire back', 'xs b', 'start')}</g>`;
  return b;
}

function numbPicture() {
  const y = 160;
  let b = `<rect x="16" y="110" width="80" height="100" rx="6" fill="${P.epidermis.base}" stroke="${P.epidermis.line}" stroke-width="1.75"/><rect x="16" y="110" width="80" height="14" rx="6" fill="${P.corneum.base}"/>`;
  b += axonStrip(y, 96, 464, 15);
  b += drugCloud(y, 50, 1, 33);
  // the needle that placed it
  b += `<path d="M380 38 L318 104" stroke="${MUTED}" stroke-width="2.5" stroke-linecap="round"/><path d="M412 8 L380 40" stroke="${MUTED}" stroke-width="10" stroke-linecap="round"/>`;
  b += `<g data-part="drug">${text(16, 34, 'local anesthetic injected here', 'sm b purple', 'start')}</g>`;
  b += `<g data-part="impulse"><rect x="130" y="${y - 12}" width="44" height="24" fill="${BLUE}" fill-opacity=".3"/>${arrow([110, 238], [452, 238], BLUE, 3.5)}${text(240, 268, 'impulses head for the spinal cord and brain', 'xs b blue')}</g>`;
  b += text(56, 236, 'skin', 'sm b');
  b += text(464, 110, 'nerve fiber', 'xs b', 'end');
  return b;
}

/* ---------- Step 12: two forms of the drug ---------- */
function formsPicture(t) {
  const y = 200, s = 1.3, cx = 380;
  let b = sides(y, 0, 390, 16);
  // the key
  b += at(mol(false), 28, 28) + `<g data-part="uncharged">${text(46, 34, 'uncharged: crosses', 'xs b purple', 'start')}</g>`;
  b += at(mol(true), 28, 56) + `<g data-part="charged">${text(46, 62, 'charged: cannot cross', 'xs b purple', 'start')}</g>`;
  b += `<g data-part="hydrogen">${at(H, 28, 86)}${text(46, 92, 'hydrogen ion', 'xs b', 'start')}</g>`;
  b += text(464, 34, 'outside the nerve', 'xs muted', 'end');
  b += text(16, 382, 'inside the nerve', 'xs muted', 'start');
  // drug waiting outside
  b += [[250, 128, true], [300, 150, true], [430, 120, false], [420, 160, true]].map(([x, yy, c]) => at(mol(c), x, yy)).join('');
  // one charged molecule bumps the membrane and bounces back
  const bounce = Math.sin(Math.PI * clamp(t * 2.2, 0, 1));
  b += at(mol(true), 96, lerp(130, y - 30, bounce));
  // one uncharged molecule dissolves through, picks up a hydrogen ion inside, and goes to the channel
  const cross = ease.inOut(span(t, 0.05, 0.4)), meet = ease.inOut(span(t, 0.42, 0.56)), go = ease.inOut(span(t, 0.6, 0.82)), plug = ease.inOut(span(t, 0.8, 1));
  const mx = lerp(lerp(170, 180, cross), cx, go), my = lerp(lerp(140, 262, cross), 290, go);
  if (plug < 0.05) {
    b += at(mol(meet > 0.95), mx, my);
    const hx = lerp(250, mx + 12, meet), hy = lerp(330, my - 4, meet);
    if (meet < 0.95) b += `<g data-part="hydrogen">${at(H, hx, hy)}</g>`;
  }
  b += `<g data-part="hydrogen">${at(H, 110, 330)}${at(H, 230, 362)}</g>`;
  b += membrane(y, s, [{ x: cx, open: 1, plug }]);
  // the plugging molecule is the charged form: its plus shows in the pore
  if (plug > 0.05) b += at(PLUS, cx, y + s * lerp(44, -1, plug) + 2, ` ${fade(plug * 2)}`);
  b += `<g data-part="site">${text(464, 356, 'binding site, inside', 'xs b', 'end')}${leader([396, 342], [cx + 3, y + 8], { elbow: false })}</g>`;
  return b;
}

/* ---------- The nerve, the drug and the far end (steps 13 and 15, Explore, Clinical values) ---------- */
// m: a solve() result. Draws the axon with its drug stretch, how far the impulse gets, ten channels from
// the drug's stretch, and the voltage at the far end, over a dashed outline of normal.
const STOP_X = DRUG_ZONE.x0 + 14;
function reachBand(y, m, half = 12) {
  const end = !m.starts ? 20 : m.passes ? 460 : STOP_X;
  let s = end > 24 ? `<g data-part="impulse"><rect x="20" y="${y - half + 3}" width="${end - 20}" height="${2 * half - 6}" fill="${BLUE}" fill-opacity=".3"/></g>` : '';
  if (m.starts && !m.passes) s += `<path d="M${STOP_X} ${y - half - 6} V${y + half + 6}" stroke="${RED}" stroke-width="4" stroke-linecap="round"/>`;
  return s;
}
function channelRow(y, b, { ghostB = null, band = true } = {}) {
  const n = 10, x0 = 69, dx = 38, plugged = Math.round(n * b), g0 = ghostB == null ? null : Math.round(n * ghostB);
  let g = band ? membraneBand({ d: `M${x0 - 26} 0 H${x0 + dx * (n - 1) + 26}`, w: 7 }).svg : '';
  for (let i = 0; i < n; i++) g += channel({ kind: 'nav', open: 0, x: x0 + dx * i, y: 0, s: 0.62, collar: false }).svg;
  // the drug sits in the pore of each blocked channel, drawn large enough to count
  for (let i = 0; i < plugged; i++) g += `<g data-part="drug" transform="translate(${f(x0 + dx * i)} 0) scale(.8)">${PLUG}</g>`;
  // the normal level of block as dashed outlines where the plugs were
  if (g0 != null) for (let i = plugged; i < g0; i++) g += artGhost(rrect(x0 + dx * i - 5.5, -8, 11, 16, 4));
  return `<g transform="translate(0 ${f(y)})">${g}</g>`;
}
function farEnd(g, m, { ghost = true, words = true } = {}) {
  const tc = 1.5, ev = [{ ap: tc }], fn = ms => voltage(ev, ms);
  let s = frame(g, { zero: false, thr: false, mv: false });
  const ap = ptsD(tracePts(g, fn, 0, g.tmax, 120));
  if (ghost) s += ghostTrace(ap);
  s += `<g data-part="far">${m.fires ? live(ap, INK) : live(`M${g.x0} ${f(g.Y(A.rest))} H${g.x1}`, INK)}</g>`;
  if (!m.fires && words) {
    const x = g.X(tc + AP.rise) + 4;
    s += `<g data-delta>${arrow([x, g.Y(A.peak) + 4], [x, g.Y(A.rest) - 8], BLUE, 3.5)}${text(x + 12, g.Y(0) - 6, 'no action potential', 'xs b blue', 'start')}${text(x + 12, g.Y(0) + 14, 'fires at the far end', 'xs b blue', 'start')}</g>`;
  }
  return s;
}
function nervePicture(m, { ghost = true, words = true } = {}) {
  const y = 112;
  let b = text(20, 40, 'skin side', 'xs muted', 'start') + text(460, 40, 'toward the brain', 'xs muted', 'end');
  b += axonStrip(y, 20, 460, 12);
  b += drugCloud(y, 34, m.amount > 0 ? clamp(0.35 + m.amount / 2, 0, 1) : 0.15);
  b += `<g data-part="drug">${text(250, 66, 'local anesthetic', 'xs b purple')}</g>`;
  if (ghost) b += `<g data-ghost="normal">${artGhost(rrect(20, y - 9, 440, 18, 3))}</g>`;
  b += reachBand(y, m);
  if (words && m.starts && !m.passes) b += text(STOP_X + 10, 172, 'impulse stops here', 'xs b blue', 'start');
  if (words && !m.starts) b += text(240, 172, 'stimulus below threshold: no impulse', 'xs b blue');
  b += text(240, 198, 'sodium channels along the drug\'s stretch', 'xs muted');
  b += channelRow(232, m.blocked);
  b += `<g data-part="drug">${text(240, 284, `${Math.round(10 * m.blocked)} of 10 blocked`, 'xs b purple')}</g>`;
  b += text(464, 296, 'far end', 'xs b', 'end');
  b += farEnd(graph(70, 464, 300, 404, 5), m, { ghost, words });
  return b;
}
const NERVE_H = 412;
function nerveRows(m) {
  const share = Math.round(10 * m.blocked);
  return [
    ['Channels blocked', m.blocked > 0.005 ? 'up' : 'same', m.blocked > 0.005 ? `${share} of 10` : 'none'],
    ['Impulse past the drug', m.fires ? 'same' : 'down', !m.starts ? 'none starts' : m.passes ? 'gets through' : 'stops'],
    ['Far end', m.fires ? 'same' : 'down', m.fires ? 'action potential fires' : 'no action potential fires'],
  ];
}
const describe = m => `${Math.round(10 * m.blocked)} of 10 sodium channels in the drug's stretch blocked; the impulse ${!m.starts ? 'never starts, because the stimulus is below threshold' : m.passes ? 'gets through' : 'stops in the drug\'s stretch'}; at the far end ${m.fires ? 'an action potential fires' : 'no action potential fires'}`;

function blockScene() {
  return {
    duration: 4200,
    stages: [[0, 'no drug'], [0.1, 'the drug plugs channels'], [0.7, 'the impulse stops']],
    render(t) {
      const amount = LESSON.amount * ease.inOut(span(t, 0.1, 0.7));
      const m = solve(A, { amount, rate: LESSON.rate }), fin = solve(A, { amount: LESSON.amount, rate: LESSON.rate });
      const label = `A pain fiber with a local anesthetic around one stretch, over a dashed outline of normal. As the drug plugs sodium channels from inside, the impulse coming from the skin side stops in the drug's stretch, and the voltage at the far end stays at rest. At the end: ${describe(fin)}.`;
      return { svg: svg(label, nervePicture(m, { words: t > 0.72 }), { h: NERVE_H }), readout: readout(nerveRows(m)) };
    },
  };
}

/* ---------- Step 14: use-dependent block ---------- */
function useDepPicture(t) {
  const T = t * 19.4, slow = [0.6, 7, 13.4], fast = [0.6, 3.8, 7, 10.2, 13.4, 16.6];
  const bSlow = blocked(LESSON.trainAmount, 0, 0.05), bFast = blockTrain(LESSON.trainAmount, fast.length);
  const panel = (y0, times, bs, title) => {
    const g = graph(70, 464, y0, y0 + 96, 19.4);
    let s = text(16, y0 - 12, title, 'xs b', 'start');
    s += `<path d="M${g.x0} ${y0} V${y0 + 96} H${g.x1}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
    const ok = bs.map(x => 1 - x >= (A.threshold - A.rest) / SPREAD);
    const all = times.map(tc => ({ ap: tc })), passing = times.filter((_, i) => ok[i]).map(tc => ({ ap: tc }));
    s += ghostTrace(ptsD(tracePts(g, ms => voltage(all, ms), 0, g.tmax, 400)));
    s += live(ptsD(tracePts(g, ms => voltage(passing, ms), 0, T, 400)));
    // the share blocked at each impulse, as a purple bar; the dashed line is half
    const yb = y0 + 140;
    s += `<path d="M${g.x0} ${yb - 15} H${g.x1}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="4 4"/>${text(g.x0 - 8, yb - 9, 'half', 'xs muted', 'end')}`;
    times.forEach((tc, i) => { if (T >= tc) s += `<g data-part="drug"><rect x="${f(g.X(tc) - 7)}" y="${f(yb - 30 * bs[i])}" width="14" height="${f(30 * bs[i])}" fill="${P.drug.base}" stroke="${P.drug.line}" stroke-width="1"/></g>`; });
    return { s, g, ok };
  };
  const a = panel(52, slow, slow.map(() => bSlow), 'slow firing: block stays low, every impulse passes');
  const z = panel(252, fast, bFast, 'fast firing: block builds with each impulse');
  let b = a.s + z.s;
  const firstFail = z.ok.indexOf(false);
  if (firstFail >= 0 && T >= fast[firstFail] + 0.6) {
    const x = z.g.X(fast[firstFail] + AP.rise) + 3;
    b += `<g data-delta>${arrow([x, z.g.Y(A.peak) + 4], [x, z.g.Y(A.rest) - 8], BLUE, 3.5)}${text(x + 12, z.g.Y(-20), 'later impulses fail', 'xs b blue', 'start')}</g>`;
  }
  b += text(16, 412, 'purple bars: share of channels blocked at each impulse', 'xs muted', 'start');
  return b;
}

/* ---------- Step 15: acidic tissue ---------- */
function acidicPicture(t) {
  const k = ease.inOut(span(t, 0.1, 0.8)), acid = k;
  const norm = solve(A, { amount: LESSON.amount, rate: LESSON.rate }), m = solve(A, { amount: LESSON.amount, rate: LESSON.rate, acid });
  const y = 150;
  let b = sides(y, 44, 252, 12);
  b += text(16, 34, 'outside the nerve', 'xs muted', 'start');
  // ten drug molecules outside: the uncharged share is the model's
  const slots = [[40, 72], [92, 96], [140, 66], [196, 104], [246, 74], [300, 100], [350, 68], [404, 98], [444, 66], [120, 120]];
  const nU = Math.round(10 * m.uncharged);
  b += slots.map(([x, yy], i) => at(mol(i < 10 - nU), x, yy)).join('');
  // hydrogen ions, more as the tissue turns acidic
  const hs = [[64, 118], [170, 84], [272, 122], [322, 60], [380, 120], [212, 60], [432, 120], [20 + 40, 56], [160, 126], [470 - 30, 92]];
  const nH = Math.round(3 + 7 * k);
  b += `<g data-part="hydrogen">${hs.slice(0, nH).map(([x, yy]) => at(H, x, yy)).join('')}</g>`;
  b += `<g ${fade(span(t, 0.5, 0.8))}>${text(464, 34, 'acid: more stays charged', 'xs b blue', 'end')}</g>`;
  // ten channels in the membrane; the drug inside plugs them
  b += `<g transform="translate(0 ${y})">${bilayer({ x1: 8, y1: 0, x2: 472, y2: 0 }).svg}</g>`;
  b += channelRow(y, m.blocked, { ghostB: norm.blocked, band: false });
  const nIn = Math.round(5 * m.inside / norm.inside), inSlots = [[70, 214], [150, 226], [230, 212], [310, 228], [390, 214]];
  b += inSlots.map(([x, yy], i) => i < nIn ? at(mol(true), x, yy) : '').join('');
  b += `<g data-ghost="normal">${inSlots.slice(nIn).map(([x, yy]) => artGhost(rrect(x - 6, yy - 8, 12, 16, 5))).join('')}</g>`;
  b += text(16, 276, 'inside the nerve', 'xs muted', 'start');
  b += `<g ${fade(span(t, 0.5, 0.8))}>${text(464, 276, '↓ less drug gets inside', 'xs b blue', 'end')}</g>`;
  b += `<g data-part="drug">${text(240, 302, `${Math.round(10 * m.blocked)} of 10 channels blocked`, 'xs b purple')}</g>`;
  // the impulse: it stopped in normal tissue; now it gets through
  const yy = 346;
  b += axonStrip(yy, 20, 460, 12) + drugCloud(yy, 24, 0.7, 35);
  b += `<g data-ghost="normal">${artGhost(rrect(20, yy - 9, STOP_X - 20, 18, 3))}</g>`;
  b += reachBand(yy, m);
  if (m.passes) b += `<g data-delta>${arrow([STOP_X + 4, yy + 28], [452, yy + 28], BLUE, 3)}${text(240, 404, 'the impulse gets through', 'xs b blue')}</g>`;
  return { b, m, norm };
}

/* ---------- Step 16: ester and amide families ---------- */
// A local anesthetic molecule: a ring end, a link, an amine end. The link is the family: an open circle for an
// ester, an open square for an amide. split pulls the two ends apart at the link (broken down).
function laMol(x, y, kind, split = 0) {
  const D = P.drug, dx = 6 * split;
  const ring = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${f(x - 12 - dx + 6.5 * Math.cos(a))} ${f(y + 6.5 * Math.sin(a))}`; });
  let s = `<path d="M${ring.join(' L')} Z" fill="${D.base}" stroke="${D.line}" stroke-width="1.25"/><circle cx="${f(x + 12 + dx)}" cy="${f(y)}" r="5.5" fill="${D.base}" stroke="${D.line}" stroke-width="1.25"/>`;
  if (split < 0.6) {
    s += `<path d="M${f(x - 5.5 - dx)} ${f(y)} H${f(x + 6.5 + dx)}" stroke="${D.line}" stroke-width="2"/>`;
    s += kind === 'ester' ? `<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="${P.ui.white}" stroke="${D.line}" stroke-width="1.5"/>` : `<rect x="${f(x - 3.4)}" y="${f(y - 3.4)}" width="6.8" height="6.8" fill="${P.ui.white}" stroke="${D.line}" stroke-width="1.5"/>`;
  }
  return `<g data-part="${kind}" ${split >= 0.6 ? 'opacity=".75"' : ''}>${s}</g>`;
}
const laGhost = (x, y) => artGhost(`M${f(x - 18.5)} ${f(y)} A6.5 6.5 0 1 1 ${f(x - 5.5)} ${f(y)} A6.5 6.5 0 1 1 ${f(x - 18.5)} ${f(y)} M${f(x + 6.5)} ${f(y)} A5.5 5.5 0 1 1 ${f(x + 17.5)} ${f(y)} A5.5 5.5 0 1 1 ${f(x + 6.5)} ${f(y)}`);
function familiesPicture(t) {
  const vy = 222;
  let b = '';
  // the key
  b += laMol(36, 26, 'ester') + `<g data-part="ester">${text(62, 32, 'ester', 'sm b purple', 'start')}</g>`;
  b += laMol(36, 54, 'amide') + `<g data-part="amide">${text(62, 60, 'amide', 'sm b purple', 'start')}</g>`;
  b += text(464, 32, 'both plug the sodium', 'xs muted', 'end') + text(464, 52, 'channel the same way', 'xs muted', 'end');
  // the nerve where the drug was injected
  b += axonStrip(130, 16, 150, 11);
  b += `<ellipse cx="84" cy="130" rx="70" ry="38" fill="${P.drug.hi}" fill-opacity=".25" stroke="${P.drug.base}" stroke-opacity=".5" stroke-width="1.25" stroke-dasharray="3 3"/>`;
  b += text(16, 186, 'nerve', 'xs muted', 'start');
  // the blood: a vessel holding plasma, with an esterase in it, and a branch to the liver
  b += `<path d="${rrect(414, vy, 30, 92, 8)}" fill="${P.plasma.base}" stroke="${P.capillary.line}" stroke-width="2"/>`;
  b += `<path d="${rrect(150, vy - 18, 322, 36, 18)}" fill="${P.plasma.base}" stroke="${P.capillary.line}" stroke-width="2"/>`;
  b += enzyme({ shape: 'globular', x: 304, y: vy, s: 0.42, parts: { enzyme: 'ester' } }).svg + `<g data-part="ester">${text(304, 266, 'esterase', 'xs muted')}</g>`;
  b += text(464, 266, 'blood plasma', 'xs b', 'end');
  b += `<path d="${blob(428, 340, 42, { lobes: 3, wobble: 0.1, seed: 7 })}" fill="${P.liver.base}" stroke="${P.liver.line}" stroke-width="1.75"/>`;
  b += text(382, 312, 'liver', 'sm b', 'end');
  // the molecules: dashed outlines where they started, at the nerve
  const esters = [[46, 104], [112, 104], [66, 160]], amides = [[124, 158], [30, 152], [90, 98]];
  b += `<g data-ghost="normal">${[...esters, ...amides].map(([x, y]) => laGhost(x, y)).join('')}</g>`;
  const wash = ease.inOut(span(t, 0.05, 0.5));
  esters.forEach(([x, y], i) => {
    const ex = 232 + i * 18, ey = vy + (i - 1) * 7;
    const cut = ease.inOut(span(t, 0.5, 0.75));
    b += laMol(lerp(x, ex, wash), lerp(y, ey, wash), 'ester', cut);
  });
  amides.forEach(([x, y], i) => {
    const mid = [200 + i * 30, vy + (i - 1) * 6], end = [412 + (i - 1) * 16, 336 + (i % 2) * 14];
    const go = ease.inOut(span(t, 0.45, 0.85)), cut = ease.inOut(span(t, 0.85, 1));
    const px = go > 0 ? (go < 0.6 ? lerp(mid[0], 428, go / 0.6) : lerp(428, end[0], (go - 0.6) / 0.4)) : lerp(x, mid[0], wash);
    const py = go > 0 ? (go < 0.6 ? mid[1] : lerp(vy, end[1], (go - 0.6) / 0.4)) : lerp(y, mid[1], wash);
    b += laMol(px, py, 'amide', cut);
  });
  // what happened, named
  b += `<g data-delta ${fade(span(t, 0.6, 0.8))}>${text(290, 176, 'esters split in the plasma', 'sm b blue')}${arrow([262, 184], [254, vy - 14], BLUE, 3)}</g>`;
  b += `<g data-delta ${fade(span(t, 0.88, 1))}>${text(16, 400, 'amides mainly split in the liver', 'sm b blue', 'start')}${arrow([354, 392], [392, 368], BLUE, 3)}</g>`;
  b += text(16, 300, 'the exception: articaine, an amide', 'xs muted', 'start') + text(16, 320, 'with an ester group, is largely', 'xs muted', 'start') + text(16, 340, 'broken down in the plasma', 'xs muted', 'start');
  return b;
}

/* ---------- Scenes, one per step kind ---------- */
const still = (label, draw, h) => () => svg(label(), draw(), { h });
const scenes = {
  neuron: still(() => 'A neuron: a rounded cell body with its nucleus and short branching dendrites, a long axon running right to three knobbed axon terminals, and a blue glow on the axon with a blue arrow showing the impulse travelling toward the terminals.', neuronPicture, 270),
  rest: still(() => `A close-up of the axon membrane. Plus signs line its outside face and minus signs its inside face. Amber sodium circles sit outside and green potassium triangles inside. A voltmeter with one electrode outside and one inside reads ${sg(A.rest)} mV: the resting potential.`, restPicture, 334),
  sodium: still(() => 'Amber sodium circles crowd the fluid outside the axon; only two are inside. An amber arrow (crowding pushes sodium in) and a blue arrow (the negative inside pulls it in) both point down at the closed membrane, which has no open door yet.', sodiumPicture, 340),
  gates: still(() => 'Three voltage-gated sodium channels in the membrane. Ready: the activation gate in the pore is shut. Open: the pore is open and a sodium ion passes in. Inactivated: the hinged inactivation gate has swung shut under the pore.', gatesPicture, 362),
  threshold: { duration: 5200, render: t => svg(`A voltage trace over time. Three small stimuli give nudges up from rest that stay below the dashed threshold line and fade. A fourth, larger stimulus reaches threshold at ${sg(A.threshold)} mV, and the voltage shoots up into a full action potential.`, thresholdPicture(t), { h: 372 }) },
  upstroke: { duration: 3200, render: t => svg(`A voltage trace above the membrane. The voltage climbs from rest to threshold, then its amber upstroke shoots up to the peak, ${sg(A.peak)} mV, as three sodium channels in the membrane below open and sodium rushes in.`, upstrokePicture(t), { h: 414 }) },
  repolarize: { duration: 4200, render: t => svg('An action potential: the amber upstroke, then a green fall back toward rest (repolarization) that dips below rest (hyperpolarization). Below, the two sodium channels are held shut by their inactivation gates, and two potassium channels stand open as green potassium flows out.', repolarizePicture(t), { h: 414 }) },
  allornone: { duration: 5600, render: t => svg('A voltage trace with three stimuli of rising strength. The weakest stays below threshold and fires nothing. The middle one reaches threshold and the strongest goes far past it, yet both action potentials reach the same peak, marked by a blue dotted line.', allOrNonePicture(t), { h: 372 }) },
  refractory: { duration: 4600, render: t => svg('An action potential with two shaded periods behind it: the absolute refractory period (red) from the upstroke until the voltage falls back below threshold, then the relative refractory period (amber) through the dip below rest. A strong stimulus in the absolute period gets no response; a stronger one in the relative period fires a second action potential.', refractoryPicture(t), { h: 380 }) },
  travel: { duration: 4200, loop: true, rest: 0.45, render: t => svg('A long stretch of axon. A blue patch where the membrane is firing moves from left to right as sodium enters through both faces; a blue arrow inside shows the charge spreading ahead to the next patch, and a grey hatched patch behind it has just fired and is refractory.', travelPicture(t), { h: 314 }) },
  numb: still(() => 'A nerve fiber runs from a block of skin on the left toward the spinal cord and brain on the right. A needle has left a purple cloud of local anesthetic around one stretch of the fiber. A blue patch and a blue arrow show pain impulses still heading toward the brain.', numbPicture, 280),
  forms: { duration: 5600, render: t => svg('The nerve membrane with a sodium channel on the right. Outside, purple drug molecules wait; a charged one, marked with a plus, bounces off the membrane. An uncharged one dissolves through the membrane, picks up a hydrogen ion inside to become charged, and plugs the sodium channel at its binding site from the inside.', formsPicture(t), { h: 392 }) },
  block: blockScene(),
  usedep: {
    duration: 5600,
    render(t) {
      const n = blockTrain(LESSON.trainAmount, 6).filter(x => 1 - x >= (A.threshold - A.rest) / SPREAD).length;
      return svg(`Two voltage traces at the far side of a drugged stretch, each over dashed outlines of normal action potentials. Slow firing: three impulses, all of which pass, with low purple block bars. Fast firing: six impulses; the block bar climbs with each one, the first ${n} pass and the later ones fail once the block passes half.`, useDepPicture(t), { h: 420 });
    },
  },
  acidic: {
    duration: 4400,
    stages: [[0, 'normal tissue'], [0.1, 'the tissue turns acidic'], [0.8, 'acidic tissue']],
    render(t) {
      const { b, m, norm } = acidicPicture(t), fin = acidicPicture(1).m;
      const label = `Drug molecules outside a nerve membrane with ten sodium channels, and the nerve below, over dashed outlines of normal tissue. As the tissue turns acidic, more hydrogen ions appear, more of the drug stays charged outside, less gets inside, and the channels blocked fall from ${Math.round(10 * norm.blocked)} to ${Math.round(10 * fin.blocked)} of 10, so the impulse that stopped now gets through.`;
      const rows = [['Drug that crosses in', m.inside < norm.inside - 0.01 ? 'down' : 'same', m.inside < norm.inside - 0.01 ? 'less' : 'as in normal tissue'], ['Channels blocked', m.blocked < norm.blocked - 0.01 ? 'down' : 'same', `${Math.round(10 * m.blocked)} of 10`], ['Impulse', m.passes ? 'up' : 'same', m.passes ? 'gets through' : 'stops']];
      return { svg: svg(label, b, { h: 412 }), readout: readout(rows, 'Compared with normal tissue') };
    },
  },
  families: { duration: 5200, render: t => svg('Ester and amide local anesthetic molecules wash from the nerve into the blood, leaving dashed outlines where they were. Esters meet an esterase in the blood plasma and split at their link; amides travel on to the liver and split there. A note says articaine, an amide with an ester group, is largely broken down in the plasma.', familiesPicture(t), { h: 412 }) },
};

// Without the reference file there are no voltages to draw from: every picture says so instead.
const unloaded = () => svg('The reference values did not load, so this picture cannot be drawn. Reload the page to try again.', text(240, 46, 'reference values did not load', 'sm b red') + text(240, 76, 'reload the page to try again', 'xs muted'), { h: 100 });
for (const [k, sc] of Object.entries(scenes)) {
  if (typeof sc === 'function') scenes[k] = () => (A ? sc() : unloaded());
  else { const r = sc.render; sc.render = t => (A ? r(t) : unloaded()); }
}

/* ---------- Explore freely ---------- */
const ui = () => ({ stim: $('#stim'), rate: $('#rate'), amount: $('#amount'), acid: $('#acid'), family: $('#family') });
const settings = () => { const u = ui(); return { stim: +u.stim.value / 100, rate: +u.rate.value / 100, amount: +u.amount.value / 50, acid: +u.acid.value / 100 }; };
const model = () => solve(A, settings());
const word = (x, ws) => ws[Math.min(ws.length - 1, Math.floor(x * ws.length))];
function renderExplore() {
  if (!A) return;
  const u = ui(), m = model(), fam = FAMILIES[u.family.value];
  $('#explore-visual').innerHTML = svg(`The teaching model now: ${describe(m)}.`, nervePicture(m), { h: NERVE_H }) + readout(nerveRows(m));
  $('#stim-out').textContent = `${Math.round(m.stimV)} mV reached (${m.starts ? 'at or above threshold' : 'below threshold'})`;
  $('#rate-out').textContent = word(m.rate, ['resting', 'slow', 'steady', 'fast', 'very fast']);
  $('#amount-out').textContent = m.amount === 0 ? 'none' : word(m.amount / 2, ['a little', 'some', 'a lot', 'a great deal']);
  $('#acid-out').textContent = m.acid === 0 ? 'normal' : word(m.acid, ['slightly acidic', 'acidic', 'very acidic']);
  const span_ = (k, v) => `<span data-model="${k}">${v}</span>`;
  let html = `<b>${m.fires ? 'An action potential fires at the far end.' : 'No action potential fires at the far end.'}</b> `;
  html += `Channels blocked: ${span_('blocked', `${Math.round(100 * m.blocked)}%`)}. Drug that crosses into the nerve: ${span_('inside', `${m.inside.toFixed(2)} × the normal-tissue amount for this injection`)}${m.amount > 0 ? ` (uncharged share outside: ${Math.round(100 * m.uncharged)}%)` : ''}. `;
  html += `Lift the spreading charge gives the next patch: ${span_('lift', `${m.lift.toFixed(1)} mV`)} (it needs ${A.threshold - A.rest} mV to reach threshold). `;
  html += `Impulse: ${span_('impulse', !m.starts ? 'none starts: the stimulus stays below threshold' : m.passes ? 'gets through the drug\'s stretch' : 'stops in the drug\'s stretch')}. `;
  html += `Peak at the far end: ${span_('peak', m.fires ? `${sg(A.peak)} mV` : 'none')}. `;
  html += `${fam.label}: same block; ${fam.where}.`;
  $('#model-results').innerHTML = html;
}
function wireExplore() {
  const u = ui();
  for (const k of ['stim', 'rate', 'amount', 'acid']) u[k].addEventListener('input', () => { syncState(); update(); });
  u.family.addEventListener('change', update);
  $('#reset').addEventListener('click', () => { u.stim.value = 60; u.rate.value = 20; u.amount.value = 0; u.acid.value = 0; u.family.value = 'amide'; syncState(); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = hi - lo || 30;
  const pad = v.low != null && v.high != null ? sp * 1.1 : sp * 0.6;
  return [lo - pad, hi + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
const rangeText = v => `${v.display} ${v.unit}`;
function statusFor(v, x) {
  if (x == null) return 'no action potential fires at the far end, so there is no peak to show';
  if (v.low != null && v.high != null) return x < v.low ? 'below the typical range' : x > v.high ? 'above the typical range' : 'inside the typical range';
  return Math.abs(x - v.typical) < 0.5 ? 'on the cited typical value' : x > v.typical ? 'above the cited typical value' : 'below the cited typical value';
}
let selectedState = 'baseline';
function syncState() {
  if (!cv) return;
  const s = settings(), m = solve(A, s);
  selectedState = s.amount > 0 || s.acid > 0 ? 'custom' : !m.starts ? 'subthreshold' : s.stim >= 0.95 ? 'strong' : 'baseline';
  const sel = $('#clinical-state');
  if (sel) sel.value = selectedState;
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id), u = ui();
  if (!st) return;
  u.amount.value = 0; u.acid.value = 0;
  u.stim.value = st.model?.stim ?? 60;
  syncState(); update();
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-stim').addEventListener('input', e => { ui().stim.value = e.target.value; syncState(); update(); });
  $('#clinical-reset').addEventListener('click', () => applyState('baseline'));
  for (const v of cv.values) {
    const pos = posOf(v), range = v.low != null && v.high != null;
    const row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`;
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: the cited typical value as a black tick, and a blue marker for the teaching model`);
    const [lo, hi] = scaleFor(v);
    right.querySelector('.key').textContent = `${range ? `Cited range ${rangeText(v)} (shaded)` : `Cited typical value ${rangeText(v)} (tick; no range given)`} · bar runs ${sg(lo)} to ${sg(hi)} ${v.unit} · blue line: model`;
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `"${v.excerpt}" ${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const [id, citation] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    li.textContent = `[${id}] ${citation}`;
    $('#sources').append(li);
  }
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = false; });
}
function renderClinical() {
  if (!cv) return;
  const m = model(), u = ui();
  $('#clinical-visual').innerHTML = svg(`The teaching model now: ${describe(m)}.`, nervePicture(m), { h: NERVE_H });
  $('#clinical-stim').value = u.stim.value;
  $('#clinical-stim-label').textContent = `${Math.round(m.stimV)} mV reached`;
  const st = cv.states.find(s => s.id === selectedState);
  $('#state-summary').textContent = st ? st.summary : `Custom settings from Explore freely${m.amount > 0 ? ', with a local anesthetic' : ''}: ${describe(m)}. No cited state matches, so no directions are shown.`;
  $('#state-evidence').innerHTML = st ? st.evidence.map(q => `<p>"${esc(q.excerpt)}" <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') + (st.unstatedNote ? `<p>${esc(st.unstatedNote)}</p>` : '') : '<p>Custom settings: no cited state matches, so no directions are shown. The cited section does not describe local anesthetics.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey];
    row.querySelector('.reading').textContent = x == null ? 'none' : `${sg(x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker');
    mk.style.display = x == null ? 'none' : '';
    if (x != null) { const px = posOf(v)(x); mk.setAttribute('x1', px); mk.setAttribute('x2', px); }
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? 'No direction stated by the cited source' : d ? `${DIRECTION[d]} (${st.label.toLowerCase()})` : 'No direction stated by the cited source';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
function fillWords() { if (!A) return; for (const el of $$('[data-v]')) { const v = A[el.dataset.v]; if (typeof v === 'number') el.textContent = sg(v); } }
async function load() {
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const id of ['rest', 'threshold', 'peak']) if (typeof data.modelBaseline?.[id] !== 'number' || !data.values?.some(v => v.id === id)) throw new Error(`no ${id}`);
    cv = data;
    A = anchorsFrom(cv);
    buildClinical();
  } catch (err) {
    cv = null;
    A = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the pictures and Explore freely need its values and stay empty meanwhile.`;
    $('#model-results').textContent = 'The reference values did not load, so the model cannot run. Reload the page to try again.';
    $$('#explore input, #explore select, #explore button').forEach(el => { el.disabled = true; });
  }
  fillWords();
  wireExplore();
  syncState();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
