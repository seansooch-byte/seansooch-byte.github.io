// Lesson 30: Ion channels and channelopathies. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: sodium is the amber circle, potassium the green triangle, chloride the grey-blue
//     diamond, calcium the teal square, water the pale drop; channel proteins are sage, drugs purple. Kit blue
//     is the thing taught or a change: an arrow, a highlight, or the words that name it.
//   - The channel pictures (steps 1 to 7) are one membrane, outside up and cytoplasm down, drawn from the
//     library's bilayer and channel primitives.
//   - The airway pictures (steps 8, 10, 14, 15, both reference tabs) are drawn from model.js's airway model: the
//     CFTR channels shown, the chloride, sodium and water that follow, the liquid's depth, the cilia's tilt and
//     the mucus's speed all come from it. CFTR itself is drawn here (the library has no ABC transporter yet):
//     two membrane-spanning halves around the pore and two ATP-binding domains under them.
//   - The heart pictures (steps 11 to 13, 16, 17, both reference tabs) plot model.js's heart muscle cell: its
//     voltage above, its currents below, a change drawn over a dashed trace of normal.
//   - No reference number lives in this file. The anchors that turn model outputs into the Clinical values
//     tab's units come from clinical-values.json; if it cannot load, the tabs say so and run on a stated stand-in.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, fill, mix, artGhost, arrowFixed, leader, textWidth } from '/lab/kit/art/core.js';
import { bilayer, channel, epithelium } from '/lab/kit/art/cell.js';
import { ion, water, atp, drug } from '/lab/kit/art/molecules.js';
import { axes, curve, bracket } from '/lab/kit/art/chart.js';
import { AIRWAY_PRESETS, airway, HEART_PRESETS, heart } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, RED = P.ui.red;

/* ---------- Glyphs (each drawn once at the origin, then moved with translate) ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
const NA = ion('na', { parts: { sodium: 'sodium ions' } }).svg;
const K = ion('k', { parts: { potassium: 'potassium ions' } }).svg;
const CL = ion('cl', { parts: { chloride: 'chloride ions' } }).svg;
const DROP = water({ s: 1.2 }).svg;
const ATP = atp({ s: 1.1 }).svg;
const PO4 = ion('po4', { s: 0.7 }).svg;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const arrowB = (a, b, w = 3.5, op = 1) => arrowFixed(a, b, { col: BLUE, w, head: { l: 10, w: 6 }, attrs: op < 1 ? ` opacity="${f(op)}"` : '' });
const cross = (x, y, op = 1) => `<g ${fade(op)}><path d="M${f(x - 7)} ${f(y - 7)} l14 14 m0 -14 l-14 14" stroke="${RED}" stroke-width="3" stroke-linecap="round"/></g>`;

/* ---------- Small helpers ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// n points spread at random in a box [x, y, w, h], each at least minD from the others and out of the keep boxes.
function spread(seed, n, [bx, by, bw, bh], minD, keep = []) {
  const r = rng(seed), pts = [];
  for (let tries = 0; pts.length < n && tries < n * 500; tries++) {
    const p = [bx + r() * bw, by + r() * bh];
    if (keep.some(([kx, ky, kw, kh]) => p[0] > kx - 10 && p[0] < kx + kw + 10 && p[1] > ky - 10 && p[1] < ky + kh + 10)) continue;
    if (pts.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minD)) pts.push(p);
  }
  return pts;
}
// The box a label occupies, for keeping particles off it: [x, y, w, h].
const boxOf = (x, y, s, cls, anchor = 'start') => { const w = textWidth(s, cls), h = /\bxs\b/.test(cls) ? 17 : 18; return [anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x, y - h * 0.8, w, h]; };
// A membrane across the whole picture at height y, drawn at scale s (24 s thick), clear of proteins at xs.
const membrane = (y, s, clear = []) => bilayer({ x1: 0, y1: 0, x2: 480 / s, y2: 0, x: 0, y, s, clear: clear.map(([cx, half]) => [cx / s, half / s]) }).svg;
const sides = (yOut = 40, yIn = 396) => text(16, yOut, 'outside the cell', 'sm b muted', 'start') + text(16, yIn, 'inside the cell', 'sm b muted', 'start');
const wave = (t, a, b) => { const u = span(t, a, b); return Math.sin(Math.PI * u); };

/* ---------- Step 1: the membrane keeps ions apart ---------- */
const M1 = { y: 214, s: 1.6 };
const M1_KEEP = [boxOf(16, 40, 'outside the cell', 'sm b'), boxOf(16, 396, 'inside the cell', 'sm b'), boxOf(464, 186, 'cell membrane', 'sm b', 'end'), [120, 60, 60, 140], [300, 232, 60, 130], boxOf(186, 120, 'ions bounce off', 'xs muted')];
const M1_OUT = spread(3, 18, [24, 60, 432, 110], 30, M1_KEEP).map((p, i) => [p, i % 2 ? CL : NA]);
const M1_IN = spread(4, 12, [24, 250, 432, 110], 32, M1_KEEP).map((p, i) => [p, i % 5 === 4 ? CL : K]);
function membranePicture(t) {
  const { y, s } = M1, half = 12 * s;
  let b = membrane(y, s);
  b += M1_OUT.map(([[x, yy], g]) => at(g, x, yy)).join('') + M1_IN.map(([[x, yy], g]) => at(g, x, yy)).join('');
  // one sodium from outside and one potassium from inside run at the membrane and bounce back
  const u1 = wave(t, 0, 0.5), u2 = wave(t, 0.5, 1);
  b += at(NA, 150, lerp(80, y - half - 8, ease.inOut(u1)));
  b += at(K, 330, lerp(350, y + half + 10, ease.inOut(u2)));
  b += text(186, 120, 'ions bounce off', 'xs muted', 'start');
  b += text(464, 186, 'cell membrane', 'sm b', 'end');
  b += sides();
  return b;
}

/* ---------- Step 2: a channel is a tunnel ---------- */
const CY2 = 214, S2 = 2.4;
const P2_KEEP = [[180, 60, 120, 320], boxOf(16, 40, 'outside the cell', 'sm b'), boxOf(16, 396, 'inside the cell', 'sm b'), [300, 84, 170, 60], [20, 84, 160, 60]];
const P2_OUT = spread(7, 6, [24, 60, 432, 90], 40, P2_KEEP), P2_IN = spread(8, 10, [24, 270, 432, 100], 36, P2_KEEP);
function porePicture(t) {
  let b = membrane(CY2, S2, [[240, 60]]);
  b += P2_OUT.map(([x, y]) => at(K, x, y)).join('') + P2_IN.map(([x, y]) => at(K, x, y)).join('');
  b += channel({ kind: 'generic', open: 1, ion: 'k', phase: (t * 2) % 1, x: 240, y: CY2, s: S2, parts: { ion: 'pore' } }).svg;
  b += text(310, 104, 'ion channel', 'sm b', 'start') + text(310, 126, 'a protein', 'xs muted', 'start') + leader([304, 110], [276, CY2 - 20], { elbow: false });
  b += text(170, 104, 'pore', 'sm b', 'end') + text(170, 126, 'a water-filled tunnel', 'xs muted', 'end') + leader([176, 110], [236, CY2 - 44], { elbow: false });
  b += sides();
  return b;
}

/* ---------- Step 3: the selectivity filter ---------- */
const CY3 = 200, S3 = 2.4;
function filterPicture(t) {
  let b = membrane(CY3, S3, [[240, 50]]);
  const keep = [[170, 60, 140, 340], boxOf(16, 40, 'outside the cell', 'sm b'), boxOf(16, 396, 'inside the cell', 'sm b'), boxOf(464, 330, 'potassium passes out', 'xs b', 'end')];
  b += spread(11, 12, [24, 290, 432, 80], 34, keep).map(([x, y]) => at(K, x, y)).join('');
  b += channel({ kind: 'kir', open: 1, ion: 'k', phase: (t * 2) % 1, x: 240, y: CY3, s: S3, parts: { ion: 'potassium' } }).svg;
  // the filter: the narrow outer stretch of the pore
  const fy = CY3 - 24 * S3;
  b += `<g data-part="filter"><rect x="${f(240 - 15)}" y="${f(fy - 2)}" width="30" height="32" rx="7" fill="${P.ui.blueWash}" fill-opacity=".35" stroke="${BLUE}" stroke-width="2.5"/></g>`;
  b += text(194, 92, 'selectivity filter', 'sm b blue', 'end') + leader([178, 98], [226, fy + 6]);
  // a sodium from outside tries the mouth and is turned away
  const u = wave(t, 0, 1), sx = lerp(372, 262, ease.inOut(u)), sy = lerp(90, fy - 12, ease.inOut(u));
  b += at(NA, sx, sy) + cross(sx - 16, sy - 2, clamp(u * 3 - 2, 0, 1));
  b += text(464, 68, 'sodium turned away', 'xs b amber', 'end');
  b += text(464, 330, 'potassium passes out', 'xs b green', 'end');
  b += sides();
  return b;
}

/* ---------- Step 4: a gate opens and shuts ---------- */
const CY4 = 210, S4 = 2.4;
const P4_KEEP = [[170, 60, 140, 330], boxOf(16, 40, 'outside the cell', 'sm b'), boxOf(16, 396, 'inside the cell', 'sm b'), [300, 20, 180, 50]];
const P4_IN = spread(13, 12, [24, 270, 432, 100], 34, P4_KEEP), P4_OUT = spread(14, 4, [24, 70, 432, 80], 40, P4_KEEP);
const openAt = t => t < 0.3 ? 0 : t < 0.4 ? ease.inOut((t - 0.3) / 0.1) : t < 0.8 ? 1 : t < 0.9 ? 1 - ease.inOut((t - 0.8) / 0.1) : 0;
function gatePicture(t) {
  const o = openAt(t);
  let b = membrane(CY4, S4, [[240, 60]]);
  b += P4_IN.map(([x, y]) => at(K, x, y)).join('') + P4_OUT.map(([x, y]) => at(K, x, y)).join('');
  b += channel({ kind: 'generic', open: o, ion: 'k', phase: (t * 5) % 1, x: 240, y: CY4, s: S4, parts: { channel: 'gate' } }).svg;
  b += text(464, 44, o > 0.5 ? 'gate open' : 'gate shut', `sm b${o > 0.5 ? ' blue' : ''}`, 'end');
  b += text(464, 66, o > 0.5 ? 'ions stream through' : 'nothing passes', 'xs muted', 'end');
  b += sides();
  return b;
}

/* ---------- Step 5: open, ions run downhill as a current ---------- */
const CY5 = 214, S5 = 1.6, XS5 = [120, 240, 360];
const P5_KEEP = [...XS5.map(x => [x - 36, 150, 72, 150]), [16, 18, 460, 72], boxOf(16, 396, 'inside: crowded with potassium', 'xs b green'), boxOf(16, 114, 'outside: little potassium', 'xs muted')];
const P5_IN = spread(17, 22, [24, 262, 432, 110], 26, P5_KEEP), P5_OUT = spread(18, 3, [24, 120, 432, 50], 50, P5_KEEP);
const opened = (t, i) => ease.inOut(span(t, 0.08 + 0.24 * i, 0.16 + 0.24 * i));
function downhillPicture(t) {
  let b = membrane(CY5, S5, XS5.map(x => [x, 34]));
  b += P5_IN.map(([x, y]) => at(K, x, y)).join('') + P5_OUT.map(([x, y]) => at(K, x, y)).join('');
  let n = 0;
  XS5.forEach((x, i) => { const o = opened(t, i); n += o; b += channel({ kind: 'kir', open: o, ion: 'k', phase: (t * 6 + i / 3) % 1, x, y: CY5, s: S5 }).svg; });
  // the current: one bar, as long as the channels open
  const w = 230 * n / 3;
  b += text(16, 44, 'current', 'sm b blue', 'start');
  b += `<rect x="104" y="30" width="230" height="18" rx="5" fill="none" stroke="${P.ui.rule}" stroke-width="1.5"/>`;
  b += `<g data-part="current"><rect x="104" y="30" width="${f(Math.max(0.1, w))}" height="18" rx="5" fill="${BLUE}"/></g>`;
  b += text(464, 44, `${Math.round(n)} of 3 open`, 'xs b', 'end');
  b += text(16, 114, 'outside: little potassium', 'xs muted', 'start');
  b += text(16, 396, 'inside: crowded with potassium', 'xs b green', 'start');
  return b;
}

/* ---------- Step 6: what opens the gate ---------- */
const CY6 = 214, S6 = 1.8;
function triggersPicture(t) {
  const ov = ease.inOut(clamp(wave(t, 0.05, 0.75) * 1.6, 0, 1));
  const bound = clamp(wave(t, 0.25, 0.95) * 1.6, 0, 1), ol = ease.inOut(clamp((bound - 0.5) * 2, 0, 1));
  let b = membrane(CY6, S6, [[120, 60], [360, 46]]);
  b += channel({ kind: 'kv', open: ov, ion: 'k', phase: (t * 6) % 1, x: 120, y: CY6, s: S6, parts: { channel: 'vg' } }).svg;
  b += channel({ kind: 'lgic', open: ol, bound, ion: 'na', phase: (t * 6) % 1, x: 360, y: CY6, s: S6, ligandCol: P.ach.base, parts: { channel: 'lg', ligand: 'lg' } }).svg;
  b += `<path d="M240 70 V384" stroke="${P.ui.rule}" stroke-width="1.5"/>`;
  b += text(120, 40, 'voltage-gated', 'sm b', 'middle') + text(360, 40, 'ligand-gated', 'sm b', 'middle');
  b += text(120, 340, ov > 0.5 ? 'voltage changes:' : 'voltage at rest:', 'xs muted', 'middle') + text(120, 362, ov > 0.5 ? 'the gate opens' : 'the gate is shut', `xs b${ov > 0.5 ? ' blue' : ''}`, 'middle');
  b += text(360, 340, ol > 0.5 ? 'ligand bound:' : 'no ligand:', 'xs muted', 'middle') + text(360, 362, ol > 0.5 ? 'the gate opens' : 'the gate is shut', `xs b${ol > 0.5 ? ' blue' : ''}`, 'middle');
  return b;
}

/* ---------- Step 7: inactivation ---------- */
const CY7 = 170, S7 = 2.3;
function inactivationPicture(t) {
  const o = ease.inOut(span(t, 0.2, 0.32)), inact = ease.inOut(span(t, 0.55, 0.68));
  let b = membrane(CY7, S7, [[240, 76]]);
  b += spread(21, 7, [24, 60, 432, 60], 40, [[160, 50, 160, 90], boxOf(16, 40, 'outside the cell', 'sm b')]).map(([x, y]) => at(NA, x, y)).join('');
  const ch = channel({ kind: 'nav', open: o, inactivated: inact, ion: inact < 0.5 ? 'na' : null, phase: (t * 8) % 1, x: 240, y: CY7, s: S7 });
  b += ch.svg;
  const lid = ch.at.lid || [262, 245];
  b += text(464, 318, 'inactivation gate', 'sm b', 'end') + leader([308, 312], [lid[0] + 4, lid[1] + 4], { elbow: false });
  const [w1, w2, cls] = inact > 0.5 ? ['inactivated:', 'the pore is plugged', 'sm b blue'] : o > 0.5 ? ['open:', 'sodium pours in', 'sm b amber'] : ['ready:', 'the activation gate is shut', 'sm b'];
  b += text(16, 344, w1, 'xs muted', 'start') + text(16, 366, w2, cls, 'start');
  b += text(16, 40, 'outside the cell', 'sm b muted', 'start') + text(16, 396, 'inside the cell', 'sm b muted', 'start');
  return b;
}

/* ---------- CFTR, drawn here: two membrane-spanning halves, two ATP-binding domains, the R domain ---------- */
// cx, cy: the pore at the membrane's midplane; k: scale (the native membrane is 24 thick).
// st: { open 0..1, together 0..1 (the ATP-binding domains closing on each other), atp 0..1, phos 0..1 }
function cftrArt(cx, cy, k, { open = 1, together = 1, atp: atpIn = 1, phos = 1, detail = true } = {}) {
  const M = P.protein, X = x => f(cx + x * k), Y = y => f(cy + y * k), w = f(Math.max(1.1, 1.75 * Math.min(1, k)));
  const g = ease.inOut(open), gap = 2 + 4.2 * g;
  const half = sx => {
    const pts = [[-31, -25], [-(gap + 1.5), -24], [-(1.4 + 2.6 * g), -8], [-3.2, 6], [-(2.6 + 1.6 * g), 23], [-26, 25], [-33, 8], [-34, -10]].map(([x, y]) => [sx * x, y]);
    return `<path d="M${pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join(' L')} Z" fill="${fill('protein')}" stroke="${M.line}" stroke-width="${w}" stroke-linejoin="round"/>`;
  };
  const tog = ease.inOut(together), nx = lerp(21, 11.5, tog), nr = 11;
  const nbd = sx => `<path d="M${X(sx * 14)} ${Y(22)} L${X(sx * nx)} ${Y(38)}" stroke="${M.line}" stroke-width="${f(5.4 * k)}" stroke-linecap="round"/><path d="M${X(sx * 14)} ${Y(22)} L${X(sx * nx)} ${Y(38)}" stroke="${M.base}" stroke-width="${f(3 * k)}" stroke-linecap="round"/>`
    + `<circle cx="${X(sx * nx)}" cy="${Y(47)}" r="${f(nr * k)}" fill="${fill('protein')}" stroke="${M.line}" stroke-width="${w}"/>`;
  // the R domain: a loose cord under the two domains
  const rd = `M${X(-nx + 3)} ${Y(57)} C${X(-14)} ${Y(72)} ${X(-4)} ${Y(64)} ${X(0)} ${Y(70)} C${X(4)} ${Y(76)} ${X(14)} ${Y(70)} ${X(nx - 3)} ${Y(57)}`;
  let s = `<g data-part="cftr"><rect x="${X(-30)}" y="${Y(-12.6)}" width="${f(60 * k)}" height="${f(25.2 * k)}" fill="${P.bilayerCore.base}"/>${nbd(-1)}${nbd(1)}`;
  s += `<path d="${rd}" fill="none" stroke="${P.protein2.line}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/><path d="${rd}" fill="none" stroke="${P.protein2.base}" stroke-width="${f(2.4 * k)}" stroke-linecap="round"/>`;
  s += half(-1) + half(1);
  s += '</g>';
  if (detail && phos > 0.01) s += [[-8, 66], [6, 72]].map(([x, y]) => at(PO4, cx + x * k, cy + y * k, ` ${fade(phos)}`)).join('');
  if (detail && atpIn > 0.01) {
    const e = ease.inOut(atpIn);
    s += [[-1, 41], [1, 53]].map(([sx, y]) => at(ATP, cx + lerp(sx * 52, 0, e) * k, cy + lerp(y + 26, y, e) * k, ` ${fade(Math.min(1, atpIn * 3))}`)).join('');
  }
  return s;
}

/* ---------- Step 9: CFTR close up ---------- */
const CY9 = 150, S9 = 2.2;
function cftrPicture(t) {
  const phos = ease.inOut(span(t, 0.08, 0.22)), atpIn = span(t, 0.24, 0.42), tog = span(t, 0.42, 0.52), open = span(t, 0.5, 0.6);
  let b = membrane(CY9, S9, [[240, 80]]);
  const keep = [[150, 50, 180, 360], boxOf(16, 40, 'airway liquid', 'sm b'), [250, 56, 180, 30], [400, 130, 70, 30]];
  b += spread(31, 12, [24, 200, 432, 170], 36, [...keep, [16, 300, 150, 110], [310, 190, 170, 110], [16, 218, 120, 26]]).map(([x, y]) => at(CL, x, y)).join('');
  b += spread(32, 5, [24, 60, 432, 50], 44, keep).map(([x, y]) => at(CL, x, y)).join('');
  b += cftrArt(240, CY9, S9, { open, together: tog, atp: atpIn, phos });
  // chloride leaves through the open pore, one after another
  if (open > 0.02) for (const k of [0, 0.5]) {
    const u = ((t * 6 + k) % 1), y = lerp(CY9 + 30, CY9 - 50, u);
    b += `<g ${fade(open * Math.min(1, (1 - u) * 4))}>${at(CL, 240, y)}</g>`;
  }
  b += text(16, 40, 'airway liquid', 'sm b muted', 'start') + text(16, 396, 'inside the cell', 'sm b muted', 'start');
  b += text(464, 152, 'CFTR', 'sm b', 'end') + leader([412, 146], [306, CY9 - 6], { elbow: false });
  b += text(464, 228, 'phosphate tags', 'xs b', 'end') + leader([336, 222], [232, CY9 + 66 * S9], { elbow: false });
  b += `<g ${fade(atpIn * 2)}>${text(16, 236, 'two ATP bind', 'xs b', 'start')}${leader([126, 230], [222, CY9 + 41 * S9], { elbow: false })}</g>`;
  b += `<g ${fade(open)}>${text(256, 76, 'chloride flows out', 'xs b blue', 'start')}</g>`;
  b += arrowB([240, CY9 - 60], [240, CY9 - 92], 3, open);
  return b;
}

/* ---------- The airway (steps 8, 10, 14, 15, both reference tabs) ---------- */
const AW = { x0: 18, cw: 74, n: 6, ap: 262, h: 96, D0: 60, M0: 34, L: 52 };
const LIQUID = mix(P.water.base, P.ui.white, 0.62);
const EPI = epithelium({ n: AW.n, kind: 'columnar', cw: AW.cw, h: AW.h, x: AW.x0, y: AW.ap, parts: { epithelium: 'cells' } }).svg;
const CELL_X = i => AW.x0 + (i + 0.5) * AW.cw;
// which cells carry a CFTR in the membrane, in the order they are lost: the share at the membrane keeps the first ones
const CFTR_ORDER = [2, 4, 0, 5, 1, 3];
const DUST = spread(41, 9, [0, 0, 1, 1], 0.11).map(([u, v]) => [u, v]);
// a: airway(...) result; o: { phase 0..1 (beat and flow), drift (how far the mucus has moved), ghost, flows, labels }
function airwayPicture(a, { phase = 0, drift = 0, ghost = false, flows = false, labels = false, words = [], wordsOp = 1, drugs = 0, key = false, fromDepth = null } = {}) {
  const { x0, cw, n, ap, h, D0, M0, L } = AW, x1 = x0 + n * cw;
  const D = D0 * a.depth, M = M0 + 14 * (1 - a.depth) / 0.7, top = ap - D, mTop = top - M;
  let b = '';
  // mucus, then the liquid under it
  const mucusCol = mix(P.mucus.base, P.mucus.lo, clamp((1 - a.depth) / 0.7, 0, 1) * 0.8);
  b += `<g data-part="mucus"><rect x="${x0}" y="${f(mTop)}" width="${n * cw}" height="${f(M)}" rx="8" fill="${mucusCol}" stroke="${P.mucus.line}" stroke-width="1.4"/>`;
  b += DUST.map(([u, v], i) => { const x = x0 + 120 + ((u * (n * cw - 140) + drift * 90 + i * 7) % (n * cw - 140)); return `<circle cx="${f(x)}" cy="${f(mTop + 8 + v * (M - 16))}" r="3.4" fill="${P.ui.muted}" fill-opacity=".75"/>`; }).join('') + '</g>';
  b += `<g data-part="asl"><rect x="${x0}" y="${f(top)}" width="${n * cw}" height="${f(D + 2)}" fill="${LIQUID}" stroke="${P.water.line}" stroke-width="1.25"/></g>`;
  b += EPI;
  // cilia: a wave runs along the row; with too little liquid they lie flat
  let cil = '';
  for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) {
    const x = x0 + i * cw + 3 + j * 10 + (j >= 3 ? 14 : 0);
    const beat = Math.sin(2 * Math.PI * (phase - x / 160)) * 0.32 * a.cilia, bias = 0.18 + (1 - a.cilia) * 1.2;
    let ang = bias + beat;
    const maxH = Math.max(4, D - 4);
    if (L * Math.cos(ang) > maxH) ang = Math.acos(maxH / L) * (ang < 0 ? -1 : 1);
    const reach = Math.min(1, (x1 - 3 - x) / Math.max(1, L * Math.sin(ang))), tx = x + L * reach * Math.sin(ang), ty = ap - L * reach * Math.cos(ang), mx = x + L * reach * 0.5 * Math.sin(ang * 0.6), my = ap - L * 0.5 * Math.cos(ang * 0.6);
    cil += `M${f(x)} ${ap} Q${f(mx)} ${f(my)} ${f(tx)} ${f(ty)} `;
  }
  b += `<g data-part="cilia"><path d="${cil}" fill="none" stroke="${P.cytoplasm.line}" stroke-width="2" stroke-linecap="round"/></g>`;
  // CFTR channels on the airway face: as many as reach the membrane
  CFTR_ORDER.forEach((ci, k) => {
    const vis = clamp(n * a.surface - k + 0.5, 0, 1);
    if (vis <= 0.02) return;
    b += `<g ${fade(vis)}>${cftrArt(CELL_X(ci), ap, 0.45, { open: clamp(a.gating, 0, 1), detail: false })}</g>`;
    if (flows && a.gating > 0.05) {
      const u = (phase * 2 + k * 0.17) % 1, op = clamp(a.gating, 0, 1) * vis;
      b += `<g ${fade(op * Math.min(1, (1 - u) * 5))}>${at(CL, CELL_X(ci), lerp(ap + 6, ap - Math.max(10, D - 8), u))}</g>`;
    }
  });
  // sodium between the cells and water after it, as many as the chloride flow carries
  if (flows) for (let j = 1; j < n; j++) {
    if (a.flow * (n - 1) < j - 0.5) continue;
    const x = x0 + j * cw, u = (phase * 2 + j * 0.23) % 1, op = Math.min(1, (1 - u) * 5);
    b += `<g ${fade(op)}>${at(NA, x, lerp(ap + h - 10, ap - Math.max(8, D - 10), u))}</g>`;
    const uw = (u + 0.45) % 1;
    b += `<g ${fade(Math.min(1, (1 - uw) * 5))}>${at(DROP, x + 14, lerp(ap + h - 14, ap - Math.max(8, D - 12), uw))}</g>`;
  }
  // a drug at work: a corrector by a channel inside the cell, a potentiator at its gate
  if (drugs > 0.01) [CFTR_ORDER[1], CFTR_ORDER[3]].forEach(ci => {
    b += `<g ${fade(drugs)}>${drug({ family: 'bulky', x: CELL_X(ci) + 24, y: ap + 40, s: 0.9 }).svg}${drug({ family: 'wedge', x: CELL_X(ci), y: ap - 20, s: 0.7 }).svg}</g>`;
  });
  if (ghost) {
    const gTop = ap - D0, gm = gTop - M0;
    b += `<g data-ghost="normal">${artGhost(`M${x0} ${f(gTop)} H${x1}`)}${artGhost(`M${x0} ${f(gm)} H${x1}`)}</g>`;
    const y0 = fromDepth == null ? gTop : ap - D0 * fromDepth;
    if (Math.abs(top - y0) > 8) b += `<g ${fade(wordsOp)}>${arrowB([x1 - 14, y0 + (top > y0 ? -2 : 2)], [x1 - 14, top + (top > y0 ? -3 : 3)], 3)}</g>`;
  }
  // labels
  b += text(x0 + 10, mTop + M / 2 + 6, 'mucus', 'xs b', 'start');
  b += text(240, 396, 'airway lining cells', 'xs muted', 'middle');
  if (labels) {
    b += text(16, 40, 'air in the airway', 'sm b muted', 'start');
    b += text(464, 76, 'airway surface liquid', 'sm b', 'end') + leader([410, 82], [430, top + D / 2 + 4], { elbow: false });
    b += text(16, 108, 'cilia', 'sm b', 'start') + leader([62, 104], [x0 + cw + 30, ap - 30], { elbow: false });
    b += arrowFixed([200, mTop - 14], [300, mTop - 14], { col: INK, w: 2 }) + text(310, mTop - 8, 'swept along', 'xs muted', 'start');
  }
  if (key) {
    const row = (y, g, words, cls) => at(g, 26, y - 6) + text(44, y, words, cls, 'start');
    b += row(30, CL, 'chloride leaves through CFTR', 'xs b muted') + row(54, NA, 'sodium follows between cells', 'xs b amber') + row(78, DROP, 'water follows the salt', 'xs b');
  }
  words.forEach(([w, cls], i) => { b += `<g ${fade(wordsOp)}>${text(16, 30 + i * 24, w, cls, 'start')}</g>`; });
  return b;
}
const AIR_H = 404;
const airLabel = (a, lead) => `${lead} Airway lining cells topped with cilia, standing in a layer of airway surface liquid with mucus on it. ${Math.round(6 * clamp(a.surface, 0, 1))} of 6 cells show a CFTR channel; the liquid is ${a.depth > 0.97 ? 'at its normal depth' : `about ${Math.round(a.depth * 100)} percent of its normal depth`}, and the cilia ${a.cilia > 0.9 ? 'beat upright' : a.cilia < 0.05 ? 'lie flat, so the mucus stays put' : 'beat weakly, so the mucus moves slowly'}.`;
function airCompare(a) {
  const d = (v, tol = 0.01) => v > 1 + tol ? 'up' : v < 1 - tol ? 'down' : 'same';
  const pc = v => `${Math.round(v * 100)}% of normal`;
  return [['Chloride flow', d(a.flow), pc(a.flow)], ['Liquid depth', d(a.depth), pc(a.depth)], ['Mucus clearance', d(a.clearance), pc(a.clearance)]];
}

/* ---------- The heart muscle cell (steps 11 to 13, 16, 17, both reference tabs) ---------- */
const HP = { x0: 76, x1: 462, yTop: 70, yBot: 246, cBase: 384, cTop: 300, T: 650 };
const X = ms => HP.x0 + ms / HP.T * (HP.x1 - HP.x0 - 8);
const YV = v => HP.yTop + (40 - v) / 140 * (HP.yBot - HP.yTop);
const YC = c => HP.cBase - c * (HP.cBase - HP.cTop);
const ptsV = (h, upto = HP.T) => [[X(-12), YV(-90)], [X(0), YV(-90)], ...h.trace.filter(([t]) => t <= Math.min(upto, HP.T)).map(([t, v]) => [X(t), YV(v)])];
const ptsC = (arr, upto = HP.T) => arr.filter(([t]) => t <= Math.min(upto, HP.T)).map(([t, c]) => [X(t), YC(Math.max(0, c))]);
const crossAt = (h, v = -40) => { const p = h.trace.find(([t, vv]) => t > 30 && vv < v); return p ? p[0] : HP.T; };
// o: { ghost: heart() of normal, show: ['ik', 'iin', 'nal'], upto, labels, words, wordsOp, phases, qt }
function heartPicture(h, { ghost = null, show = [], upto = HP.T, phases = false, words = [], wordsOp = 1, qt = false, arrow = null } = {}) {
  let b = axes({ x0: HP.x0, y0: HP.yBot + 8, x1: HP.x1, y1: HP.yTop - 12, xLabel: '', yLabel: '', ticks: { y: [[0, '0 mV', YV(0)]] }, arrows: true });
  b += text(HP.x1, HP.yBot + 28, 'time', 'xs muted', 'end');
  b += text(HP.x0 - 8, HP.yTop + 6, 'voltage', 'xs muted', 'end');
  // currents panel
  if (show.length) b += `<path d="M${HP.x0} ${HP.cBase} H${HP.x1}" stroke="${INK}" stroke-width="1.5"/>` + text(HP.x0 - 8, HP.cBase - 30, 'current', 'xs muted', 'end');
  const curves = { ik: [h.iK, P.k.line, 'potassium out', 'xs b green'], iin: [h.iIn, P.ca.line, 'calcium in', 'xs b teal'], nal: [h.iNaL, P.na.line, 'late sodium in', 'xs b amber'] };
  const part = { ik: 'ik', iin: 'inward', nal: 'late' };
  for (const k of show) {
    const [arr, col] = curves[k];
    if (ghost && k !== 'nal') b += curve(ptsC(ghost[k === 'ik' ? 'iK' : 'iIn']), { role: 'ghost' });
    b += `<g data-part="${part[k]}">${curve(ptsC(arr, upto), { role: 'live', col })}</g>`;
  }
  // the labels of the currents, by their peaks
  const lab = { ik: [X(250), HP.cTop - 1, 'start'], iin: [X(18), HP.cTop - 1, 'start'], nal: [HP.x1, HP.cBase - 14, 'end'] };
  if (show.includes('ik') && show.includes('iin')) { lab.iin = [X(12), HP.cTop - 1, 'start']; lab.ik = [HP.x1, HP.cTop - 1, 'end']; }
  if (show.includes('nal')) lab.ik = [HP.x1, HP.cTop - 1, 'end'];
  for (const k of show) { const [x, y, a] = lab[k]; b += text(x, y, curves[k][2], curves[k][3], a); }
  // voltage
  if (ghost) b += `<g data-ghost="normal">${curve(ptsV(ghost), { role: 'ghost' })}</g>`;
  const live = ptsV(h, upto);
  if (phases) {
    const pl = live.filter(([x]) => x >= X(20) && x <= X(h.plateauEnd));
    if (pl.length > 2) b += `<g data-part="plateau"><path d="M${pl.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}" fill="none" stroke="${P.ui.blueWash}" stroke-width="14" stroke-linecap="round"/></g>`;
    const p3 = live.filter(([x, y]) => x >= X(h.plateauEnd) && y >= YV(-2) && y <= YV(-86));
    if (p3.length > 2) b += `<g data-part="phase3"><path d="M${p3.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}" fill="none" stroke="${P.ui.blueWash}" stroke-width="14" stroke-linecap="round"/></g>`;
  }
  b += `<g data-part="trace">${curve(live, { role: 'live', col: INK })}</g>`;
  if (upto < HP.T && live.length) { const [x, y] = live[live.length - 1]; b += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${BLUE}" stroke="${P.ui.white}" stroke-width="2"/>`; }
  if (phases) {
    const seen = ms => upto >= ms;
    if (seen(5)) b += text(X(0) + 10, YV(-55), 'upswing', 'xs b amber', 'start');
    if (seen(90)) b += text(X(60), YV(20) - 22, 'plateau', 'xs b teal', 'start');
    if (seen(h.plateauEnd + 40)) b += text(X(h.plateauEnd) + 40, YV(-40), 'repolarization', 'xs b green', 'start');
    if (seen(420)) b += text(X(430), YV(-90) - 12, 'rest', 'xs muted', 'start');
  }
  if (qt) b += `<g data-part="qt">${bracket(X(0), X(h.apd), HP.yTop - 4, 'action potential length', { cls: 'xs b blue', col: BLUE })}</g>`;
  if (arrow) {
    const [a0, a1] = arrow, y = YV(-40);
    if (Math.abs(X(a1) - X(a0)) > 10) b += `<g ${fade(wordsOp)}>${arrowB([X(a0) + 4, y], [X(a1) + 2, y], 3)}</g>`;
  }
  words.forEach(([w, cls], i) => { b += `<g ${fade(wordsOp)}>${text(16, 24 + i * 22, w, cls, 'start')}</g>`; });
  return b;
}
const HEART_H = 404;
const NORMAL_HEART = heart(HEART_PRESETS.normal);
const pctLonger = h => Math.round((h.apd / NORMAL_HEART.apd - 1) * 10) * 10;
function heartCompare(h) {
  const r = h.apd / NORMAL_HEART.apd, late = Math.max(...h.iNaL.map(p => p[1]));
  const d = (v, tol = 0.02) => v > 1 + tol ? 'up' : v < 1 - tol ? 'down' : 'same';
  return [
    ['Action potential', d(r), Math.abs(r - 1) < 0.02 ? 'normal length' : `about ${Math.abs(pctLonger(h))}% ${r > 1 ? 'longer' : 'shorter'}`],
    ['Potassium channels working', d(h.gK, 0.01), Math.abs(h.gK - 1) < 0.01 ? 'all' : `${Math.round(h.gK * 100)}% of normal`],
    ['Late sodium in', late > 0.01 ? 'up' : 'same', late > 0.01 ? 'leaking in' : 'none'],
  ];
}
const heartLabel = (h, lead) => `${lead} Above, the heart muscle cell's voltage against time: the upswing, the plateau, and repolarization back to rest; below, its currents. ${Math.abs(h.apd / NORMAL_HEART.apd - 1) < 0.02 ? 'The action potential has its normal length.' : `The action potential lasts about ${Math.abs(pctLonger(h))} percent ${h.apd > NORMAL_HEART.apd ? 'longer' : 'shorter'} than normal.`}`;

/* ---------- What changes it ---------- */
const AIR_STATE = (from, to, e) => airway({ surface: lerp(from.surface, to.surface, e), gating: lerp(from.gating, to.gating, e) });
function cfScene() {
  const N = AIRWAY_PRESETS.normal, C = AIRWAY_PRESETS.cf, fin = airway(C);
  return {
    duration: 6000, loop: true, loopFrom: 2 / 3,
    stages: [[0, 'healthy CFTR'], [0.08, 'channels lost, chloride stops'], [0.62, 'cystic fibrosis']],
    render(t) {
      const e = ease.inOut(span(t, 0.08, 0.6)), a = AIR_STATE(N, C, e);
      const body = airwayPicture(a, { phase: (t * 6) % 1, drift: t * 6 * a.clearance, ghost: true, flows: true, words: [['↓ liquid thins, cilia lie flat', 'sm b blue'], ['the thick mucus stays put', 'xs b']], wordsOp: span(t, 0.45, 0.62) });
      return { svg: svg(airLabel(fin, 'Cystic fibrosis, drawn over dashed lines at the normal depth of the liquid and the top of the mucus. CFTR channels fade from the cells and the chloride, sodium and water stop crossing.'), body, { h: AIR_H }), readout: readout(airCompare(a)) };
    },
  };
}
function modulatorScene() {
  const N = AIRWAY_PRESETS.normal, C = AIRWAY_PRESETS.cf, Mo = AIRWAY_PRESETS.modulators, fin = airway(Mo);
  return {
    duration: 7200, loop: true, loopFrom: 5 / 6,
    stages: [[0, 'healthy CFTR'], [0.06, 'cystic fibrosis'], [0.36, 'modulators added'], [0.78, 'treated']],
    render(t) {
      const e1 = ease.inOut(span(t, 0.06, 0.3)), e2 = ease.inOut(span(t, 0.42, 0.76));
      const a = e2 > 0 ? AIR_STATE(C, Mo, e2) : AIR_STATE(N, C, e1), drugs = span(t, 0.34, 0.44);
      const body = airwayPicture(a, { phase: (t * 7.2) % 1, drift: t * 7.2 * a.clearance, ghost: true, flows: true, drugs, fromDepth: airway(C).depth, words: [['↑ liquid deepens, cilia beat again', 'sm b blue'], ['a corrector and a potentiator', 'xs b purple']], wordsOp: span(t, 0.6, 0.78) });
      return { svg: svg(airLabel(fin, 'Cystic fibrosis treated with CFTR modulators, drawn over dashed lines at the normal depth of the liquid and the top of the mucus. Purple drug shapes sit by the channels: a corrector inside the cell and a potentiator at the gate. More channels appear and chloride, sodium and water cross again.'), body, { h: AIR_H }), readout: readout(airCompare(a)) };
    },
  };
}
function heartChangeScene(kind) {
  const to = HEART_PRESETS[kind], fin = heart(to);
  const words = kind === 'lqtk' ? [['↓ potassium current out', 'sm b blue'], ['the voltage falls later', 'xs b']] : [['↑ late sodium leaks in', 'sm b blue'], ['the plateau holds on longer', 'xs b']];
  const show = kind === 'lqtk' ? ['iin', 'ik'] : ['ik', 'nal'];
  return {
    duration: 4200,
    stages: [[0, 'healthy channels'], [0.1, kind === 'lqtk' ? 'potassium channels lost' : 'inactivation fails'], [0.72, 'long QT']],
    render(t) {
      const e = ease.inOut(span(t, 0.1, 0.7));
      const h = heart({ gK: +lerp(1, to.gK, e).toFixed(2), late: +lerp(0, to.late, e).toFixed(3) });
      const body = heartPicture(h, { ghost: NORMAL_HEART, show, words, wordsOp: span(t, 0.5, 0.72), arrow: [crossAt(NORMAL_HEART), crossAt(h)] });
      const lead = kind === 'lqtk' ? 'Congenital long QT from a faulty potassium channel, drawn over a dashed normal trace. The potassium current below shrinks and a blue arrow shows repolarization coming later.' : 'Congenital long QT from sodium channels that fail to inactivate, drawn over a dashed normal trace. A late sodium current appears below and a blue arrow shows repolarization coming later.';
      return { svg: svg(heartLabel(fin, lead), body, { h: HEART_H }), readout: readout(heartCompare(h)) };
    },
  };
}

/* ---------- Scenes, one per step kind ---------- */
const NORMAL_AIR = airway(AIRWAY_PRESETS.normal);
const scenes = {
  membrane: { duration: 3600, loop: true, rest: 0.25, render: t => svg('A cell membrane drawn as a lipid bilayer across the picture. Amber sodium circles and grey-blue chloride diamonds crowd the outside; green potassium triangles crowd the inside. One sodium and one potassium run at the membrane and bounce back.', membranePicture(t), { h: 410 }) },
  pore: { duration: 2400, loop: true, rest: 0.5, render: t => svg('A sage channel protein spans the membrane, with a water-filled pore down its middle. Potassium ions pass through the pore one after another from the inside to the outside.', porePicture(t), { h: 410 }) },
  filter: { duration: 3200, loop: true, rest: 0.5, render: t => svg('A potassium channel in the membrane, its narrow selectivity filter near the outer mouth outlined in blue. Potassium passes out through it, while an amber sodium ion from outside reaches the mouth and is turned away, marked with a red cross.', filterPicture(t), { h: 410 }) },
  gate: { duration: 4400, loop: true, rest: 0.6, render: t => svg('A channel in the membrane whose gate twists open and shut. While it is shut nothing passes; while it is open potassium ions stream out through the pore.', gatePicture(t), { h: 410 }) },
  downhill: { duration: 5200, loop: true, loopFrom: 0.8, render: t => svg('Three potassium channels in a membrane, potassium crowded inside and scarce outside. The channels open one by one and potassium runs out through each; a blue bar marked current grows with every channel that opens, to three of three.', downhillPicture(t), { h: 410 }) },
  triggers: { duration: 5200, loop: true, rest: 0.5, render: t => svg('Two channels side by side. On the left a voltage-gated channel, whose charged sensors move when the voltage changes and open its gate. On the right a ligand-gated channel, which opens when two rose acetylcholine molecules bind it.', triggersPicture(t), { h: 400 }) },
  inactivation: { duration: 4200, stages: [[0, 'ready'], [0.2, 'open'], [0.55, 'inactivated']], render: t => svg('A fast sodium channel in the membrane. It starts shut and ready, opens so sodium pours in, then its inactivation gate, a hinged lid on the inside, swings into the pore and plugs it.', inactivationPicture(t), { h: 410 }) },
  airway: { duration: 3000, loop: true, render: t => svg(airLabel(NORMAL_AIR, 'A healthy airway lining.'), airwayPicture(NORMAL_AIR, { phase: t * 3 % 1, drift: t * 3, labels: true }), { h: AIR_H }) },
  cftr: { duration: 6000, loop: true, loopFrom: 2 / 3, stages: [[0, 'shut'], [0.08, 'phosphate tags'], [0.24, 'two ATP bind'], [0.5, 'open: chloride out']], render: t => svg('CFTR close up in the airway face of a cell: two sage halves span the membrane around the pore, and two round ATP-binding domains hang below them, joined by a cord carrying phosphate tags. Two ATP molecules bind between the domains, the domains close together, the pore opens and grey-blue chloride diamonds flow out into the airway liquid.', cftrPicture(t), { h: 410 }) },
  water: { duration: 3000, loop: true, render: t => svg(airLabel(NORMAL_AIR, 'A healthy airway lining with its flows: chloride diamonds rise out of each CFTR channel into the liquid, amber sodium circles rise between the cells and water drops follow them.'), airwayPicture(NORMAL_AIR, { phase: t * 3 % 1, drift: t * 3, flows: true, key: true }), { h: AIR_H }) },
  heartap: { duration: 4200, render: t => svg(heartLabel(NORMAL_HEART, 'One heart muscle cell action potential, drawn from left to right: a sharp upswing, a long flat plateau highlighted in pale blue, repolarization back down, then rest.'), heartPicture(NORMAL_HEART, { upto: t >= 1 ? HP.T : t * HP.T, phases: true }), { h: 292 }) },
  repolarize: { duration: 4200, render: t => svg('The heart muscle cell action potential above, and below it the outward potassium current in green, which switches on slowly during the plateau and is largest as the voltage falls back to rest.', heartPicture(NORMAL_HEART, { upto: t >= 1 ? HP.T : t * HP.T, show: ['ik'] }), { h: HEART_H }) },
  balance: () => svg('The heart muscle cell action potential with a blue bracket over its whole length. Below, the inward calcium current in teal fades through the plateau while the outward potassium current in green grows; the voltage falls once potassium wins.', heartPicture(NORMAL_HEART, { show: ['iin', 'ik'], qt: true }), { h: HEART_H }),
  cf: cfScene(),
  modulators: modulatorScene(),
  lqt: heartChangeScene('lqtk'),
  latena: heartChangeScene('lqtna'),
};

/* ---------- The model behind both tabs ---------- */
// If clinical-values.json cannot load, the tabs run on this stand-in, said so on the page: the model's own times.
// Not shown as reference values.
const STAND_IN = { qt: NORMAL_HEART.apd / 1000, vRefractory: NORMAL_HEART.refEnd / 1000 };
let anchors = null, cv = null;
const ui = () => ({ surface: $('#surface'), gating: $('#gating'), gK: $('#gK'), late: $('#late'), ap: $('#airway-preset'), hp: $('#heart-preset') });
function current() {
  const u = ui();
  const a = airway({ surface: +u.surface.value / 100, gating: +u.gating.value / 100 });
  const h = heart({ gK: +u.gK.value / 100, late: +u.late.value / 100 });
  const values = {
    qt: anchors.qt * h.apd / NORMAL_HEART.apd,
    vRefractory: anchors.vRefractory * h.refEnd / NORMAL_HEART.refEnd,
  };
  return { a, h, values };
}
const airPicture = (m, where) => svg(airLabel(m.a, `${where}: the airway.`), airwayPicture(m.a, { ghost: true, flows: true, phase: 0.3, drift: 0 }), { h: AIR_H }) + readout(airCompare(m.a));
const heartOnly = (m, where) => svg(heartLabel(m.h, `${where}: the heart muscle cell, over a dashed normal trace.`), heartPicture(m.h, { ghost: NORMAL_HEART, show: ['iin', 'ik', ...(m.h.iNaL.some(p => p[1] > 0.005) ? ['nal'] : [])].slice(-2), arrow: [crossAt(NORMAL_HEART), crossAt(m.h)] }), { h: HEART_H }) + readout(heartCompare(m.h));
const bothPictures = (m, where) => airPicture(m, where) + heartOnly(m, where);

/* ---------- Explore freely ---------- */
const PCT = v => `${v}%`;
function renderExplore() {
  if (!anchors) return;
  const u = ui(), m = current();
  $('#explore-visual').innerHTML = bothPictures(m, 'The teaching model now');
  $('#surface-out').textContent = PCT(u.surface.value);
  $('#gating-out').textContent = PCT(u.gating.value);
  $('#gK-out').textContent = PCT(u.gK.value);
  $('#late-out').textContent = +u.late.value === 0 ? 'none' : `${u.late.value} (model units)`;
  const r = (x, d = 0) => (+x).toFixed(d);
  $('#model-results').innerHTML = `<b>Airway.</b> Chloride flow ${r(m.a.flow * 100)}% of normal · liquid depth ${r(m.a.depth * 100)}% · mucus clearance ${r(m.a.clearance * 100)}%.`
    + ` <b>Heart muscle cell.</b> Action potential ${r(m.h.apd)} ms (model) · refractory period ${r(m.values.vRefractory, 2)} s · Q-T interval ${r(m.values.qt, 2)} s (model, scaled to the cited references).`;
}
function setPreset(kind, name) {
  const u = ui();
  if (kind === 'air' && AIRWAY_PRESETS[name]) { u.surface.value = Math.round(AIRWAY_PRESETS[name].surface * 100); u.gating.value = Math.round(AIRWAY_PRESETS[name].gating * 100); }
  if (kind === 'heart' && HEART_PRESETS[name]) { u.gK.value = Math.round(HEART_PRESETS[name].gK * 100); u.late.value = Math.round(HEART_PRESETS[name].late * 100); }
}
function syncPresets() {
  const u = ui();
  const air = Object.entries(AIRWAY_PRESETS).find(([, p]) => Math.round(p.surface * 100) === +u.surface.value && Math.round(p.gating * 100) === +u.gating.value);
  const hr = Object.entries(HEART_PRESETS).find(([, p]) => Math.round(p.gK * 100) === +u.gK.value && Math.round(p.late * 100) === +u.late.value);
  u.ap.value = air ? air[0] : 'custom';
  u.hp.value = hr ? hr[0] : 'custom';
  syncState();
}
function wireExplore() {
  const u = ui();
  u.ap.addEventListener('change', () => { setPreset('air', u.ap.value); syncPresets(); update(); });
  u.hp.addEventListener('change', () => { setPreset('heart', u.hp.value); syncPresets(); update(); });
  for (const el of [u.surface, u.gating, u.gK, u.late]) el.addEventListener('input', () => { syncPresets(); update(); });
  $('#reset').addEventListener('click', () => { setPreset('air', 'normal'); setPreset('heart', 'normal'); syncPresets(); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => (+x).toFixed(v.decimals ?? 0);
const posOf = v => { const [lo, hi] = v.scale; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, x) {
  const shown = +fmtV(v, x);
  if (v.high != null && v.low == null) {
    const cut = (v.thresholds || [])[0];
    return shown <= v.high ? 'inside the typical range' : cut && shown >= cut.at ? 'above the typical range, past the cited cutoff' : 'above the typical range';
  }
  if (v.low != null && v.high != null) return shown < v.low ? 'below the typical range' : shown > v.high ? 'above the typical range' : 'inside the typical range';
  const rel = (x - v.typical) / v.typical;
  return Math.abs(rel) < 0.03 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value';
}
let selectedState = 'baseline';
function stateMatches(st) {
  const u = ui(), m = st.model || {};
  return Object.keys(m).every(k => +u[k].value === m[k]);
}
function syncState() {
  if (!cv) return;
  const st = cv.states.find(stateMatches);
  selectedState = st ? st.id : 'custom';
  const sel = $('#clinical-state');
  if (sel) sel.value = selectedState;
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id), u = ui();
  if (!st) return;
  for (const [k, v] of Object.entries(st.model)) u[k].value = v;
  syncPresets();
  selectedState = id;
  update();
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-reset').addEventListener('click', () => applyState('baseline'));
  for (const v of cv.values) {
    const pos = posOf(v), [lo, hi] = v.scale;
    const row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    let band = '', what = '';
    if (v.low != null && v.high != null) { band = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`; what = `Cited range ${fmtV(v, v.low)} to ${fmtV(v, v.high)} ${v.unit} (shaded)`; }
    else if (v.high != null) { band = `<rect class="band" x="${pos(lo)}" y="12" width="${f(pos(v.high) - pos(lo))}" height="22"/><path class="limit" d="M${pos(v.high)} 6 V40"/>`; what = `Cited upper limit ${fmtV(v, v.high)} ${v.unit} (shaded below it)`; }
    else { band = `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`; what = `Cited typical value about ${fmtV(v, v.typical)} ${v.unit} (tick; no range given)`; }
    for (const c of v.thresholds || []) { band += `<path d="M${pos(c.at)} 4 V42" stroke="${RED}" stroke-width="2" stroke-dasharray="4 3"/>`; what += ` · dashed red line at ${fmtV(v, c.at)} ${v.unit}: ${c.label}`; }
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: the cited reference drawn on a bar, and a blue marker for the teaching model`);
    right.querySelector('.key').textContent = `${what} · bar runs ${fmtV(v, lo)} to ${fmtV(v, hi)} · blue line: model`;
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const [id, citation] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    const doi = cv.sourceDois?.[id];
    li.textContent = `[${id}] ${citation}${doi ? ` doi:${doi}` : ''}`;
    $('#sources').append(li);
  }
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = false; });
}
function renderClinical() {
  if (!cv || !anchors) return;
  const m = current(), st = cv.states.find(s => s.id === selectedState);
  $('#clinical-visual').innerHTML = heartOnly(m, 'The teaching model for the chosen state');
  $('#state-summary').textContent = st ? `${st.label}. ${st.summary}` : 'Custom settings from Explore freely: no cited state matches, so no directions are shown.';
  $('#state-evidence').innerHTML = st ? `<p>${esc(st.where)} <span>[${esc(st.source)}]</span></p>` + (st.mechanismWhere ? `<p>Mechanism: ${esc(st.mechanismWhere)} <span>[${esc(st.mechanismSource)}]</span></p>` : '') + (st.modelNote ? `<p>${esc(st.modelNote)}</p>` : '') : '<p>Custom settings: no cited state matches.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey];
    row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]}: ${st.label}` : st.id === 'baseline' ? 'Baseline: no change' : 'No direction stated by the cited source';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const id of ['qt', 'vRefractory']) if (typeof data.modelBaseline?.[id] !== 'number') throw new Error(`no ${id}`);
    cv = data;
    anchors = { ...data.modelBaseline };
    buildClinical();
  } catch (err) {
    cv = null;
    anchors = { ...STAND_IN };
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; Explore freely runs on the model's own illustrative units meanwhile.`;
  }
  wireExplore();
  syncPresets();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
