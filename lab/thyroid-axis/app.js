// Lesson 14: The thyroid axis. The kit (/lab/kit/kit.js) runs the page; this file draws the pictures from the
// illustrative model in model.js (window.ThyroidModel) and runs the Clinical values and Explore freely tabs.
//
// Expected behaviour:
//   - Every picture is 480 wide and at most 420 tall, set in the kit's type (20 / .sm 18 / .xs 17).
//   - The axis picture (steps 5 to 16, Clinical values, Explore freely) reads top to bottom: hypothalamus, TRH,
//     pituitary, TSH, thyroid, then T4 and T3 into the blood. The brake runs back up the left edge to the
//     hypothalamus and the pituitary. Level bars for the blood tests (TSH, T4, T3) sit on the right, and the
//     body (heartbeat, pace) runs along the bottom. Lesson 15 draws its axis in the same places, so the two
//     loops read as one pattern.
//   - Steps 5, 6 and 10 loop: hormone flows down the chain and the brake signal flows back up. Steps 7 and 8
//     play the feedback once: a level moves, the brake answers, TRH and TSH follow, and T4 returns.
//   - Each "What changes it" step morphs from where it starts (normal, or the untreated disease a drug treats)
//     at t = 0 to the changed loop at t = 1, over dashed marks for normal, and says on the picture which levels
//     rise or fall and what the brake does.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease, span, esc, svg, text, readout as readoutList } from '/lab/kit/draw.js';

const TM = window.ThyroidModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const view = p => TM.settle(p);
const NORMAL_P = TM.build('normal');
const NV = view(NORMAL_P);

/* ---------- Drawing pieces ---------- */
const AMBERF = '#f2a93b', BLOOD = '#f6dcd6', BAND = '#d1d8fd', BRAIN = '#e8cfe0', GLAND = '#e2a397', SKIN = '#f3e4d6', HEART = '#d9776b';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
// A thick arrow whose width is the amount flowing (its own head, so widths can differ).
function flow(x1, y1, x2, y2, w, col, extra = '') {
  if (w < 0.5) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.05 + 8), hw = w * .85 + 6, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${col}" stroke-width="${f(w)}" fill="none"/>`
    + `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${col}"/></g>`;
}
// The dashed outline of that arrow at its normal width, drawn on top: the ghost of normal.
function flowGhost(x1, y1, x2, y2, w) {
  if (w < 0.5) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.05 + 8), hw = w * .85 + 6, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
}
// Arrow width from a level relative to normal (1 draws 7 wide).
const widthOf = rel => clamp(7 + 4.4 * Math.log2(Math.max(rel, 1e-3)), 2, 16);
// Small moving dots along a straight run, for the loops that play: n dots, phase in cycles.
function dots(x1, y1, x2, y2, n, phase, col, r = 3.2) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const u = ((phase + i / n) % 1 + 1) % 1;
    s += `<circle cx="${f(lerp(x1, x2, u))}" cy="${f(lerp(y1, y2, u))}" r="${r}" fill="${col}" stroke="#fff" stroke-width="1.2" ${fade(Math.min(1, u * 6, (1 - u) * 6))}/>`;
  }
  return s;
}
// Words beside a level bar: what moved, measured against where the step started.
// Unmoved: where it sits (high, low, usual). Moved: the way it went and where it ended ("↑ high", "↑ to usual", "↑ still low").
function moved(rel, from, band, words = ['high', 'low', 'usual']) {
  const [hiW, loW, usW] = words;
  const where = rel > band[1] ? 'hi' : rel < band[0] ? 'lo' : 'in';
  const lvl = { hi: hiW, lo: loW, in: usW }[where];
  const r = Math.log(Math.max(rel, 1e-6) / Math.max(from, 1e-6));
  if (Math.abs(r) < 0.068) return { word: lvl, cls: 'xs muted' };
  const was = from > band[1] ? 'hi' : from < band[0] ? 'lo' : 'in';
  const up = r > 0, end = where === 'in' ? (was === 'in' ? usW : `to ${usW}`) : (up && where === 'lo') || (!up && where === 'hi') ? `still ${lvl}` : lvl;
  return { word: `${up ? '↑' : '↓'} ${end}`, cls: 'xs b blue' };
}

/* ---------- The axis picture: one layout for every loop step ---------- */
const CX = 150, BX = 30;
const HYP = { x0: 62, x1: 238, y0: 14, y1: 54 }, PIT = { x0: 96, x1: 204, y0: 102, y1: 142 };
const GC = [150, 232], GS = 0.8;            // the thyroid's centre and drawing scale
const BL = { y0: 300, y1: 326 };            // the blood
const MX0 = 320, MX1 = 470;                 // the level bars
const ROWS = { tsh: 180, t4: 230, t3: 280 };
const SPAN = { tsh: Math.log(12), t4: Math.log(3.2), t3: Math.log(3.2), pace: Math.log(2) };
let BANDS = null;                          // from clinical-values.json, relative to the model's normal
const FALLBACK = { tsh: [0.4, 2.5], t4: [0.6, 1.4], t3: [0.6, 1.4] };
const BODY_BAND = [0.88, 1.13];             // the usual zone for the heartbeat and the pace (illustrative)
const bandOf = k => k === 'pace' ? BODY_BAND : (BANDS || FALLBACK)[k];
const LOBES = 'M-9 -4 C-18 -38 -50 -46 -58 -16 C-63 8 -50 36 -26 36 C-14 36 -9 24 -9 12 Z M9 -4 C18 -38 50 -46 58 -16 C63 8 50 36 26 36 C14 36 9 24 9 12 Z M-10 0 H10 V12 H-10 Z';
function thyroidShape(cx, cy, s, extra = '') {
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(s)})" ${extra}><path d="${LOBES}" fill="${GLAND}" stroke="${C.ink}" stroke-width="${f(2 / s)}"/>`
    + [[-40, -14], [-30, 12], [-46, 6], [40, -14], [30, 12], [46, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f4d9b0" stroke="#b06e60" stroke-width="${f(1 / s)}"/>`).join('') + '</g>';
}
const thyroidGhost = (cx, cy, s) => `<path transform="translate(${f(cx)} ${f(cy)}) scale(${f(s)})" d="${LOBES}" fill="none" stroke="${C.ink}" stroke-width="${f(1.5 / s)}" stroke-dasharray="${f(5 / s)} ${f(4 / s)}"/>`;
function meter(key, y, rel, { name, nameCls, ghost = 1, from = 1, words, box = false }) {
  const half = (MX1 - MX0) / 2 - 8, mid = (MX0 + MX1) / 2;
  const pos = r => mid + clamp(Math.log(Math.max(r, 1e-6)) / SPAN[key], -1, 1) * half;
  const [lo, hi] = bandOf(key), m = moved(rel, from, [lo, hi], words);
  let s = text(MX0, y - 12, name, nameCls, 'start') + text(MX1, y - 12, m.word, m.cls, 'end');
  s += `<rect x="${MX0}" y="${y - 4}" width="${MX1 - MX0}" height="8" rx="4" fill="#fff" stroke="${C.rule}"/>`;
  s += `<rect x="${f(pos(lo))}" y="${y - 4}" width="${f(pos(hi) - pos(lo))}" height="8" fill="${BAND}"/>`;
  if (ghost !== null) s += `<rect class="ghost" x="${f(pos(ghost) - 6)}" y="${y - 11}" width="12" height="22" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  s += `<rect data-level="${key}" data-rel="${rel.toFixed(3)}" x="${f(pos(rel) - 5)}" y="${y - 10}" width="10" height="20" fill="${key === 'tsh' ? C.blue : C.amber}" stroke="#fff" stroke-width="1.5"/>`;
  return `<g data-part="${key} tests">${s}</g>`;
}
// The heartbeat, one spike per beat: beats crowd together as the rate rises.
function trace(hr, y, x0, x1, attrs) {
  const P = 30 / Math.max(hr, 0.2);
  let d = `M${x0} ${y}`;
  for (let bx = x0 + 10; bx < x1 - 6; bx += P) d += ` L${f(bx - 4)} ${y} L${f(bx - 1)} ${y - 18} L${f(bx + 2)} ${y + 7} L${f(bx + 5)} ${y}`;
  return `<path ${attrs} d="${d} L${x1} ${y}" fill="none" stroke-linejoin="round"/>`;
}
const HEART_D = 'M0 22 C-26 6 -24 -16 -10 -16 C-4 -16 0 -11 0 -7 C0 -11 4 -16 10 -16 C24 -16 26 6 0 22 Z';
const antibody = (x, y) => `<path d="M${f(x)} ${f(y + 8)} V${f(y)} M${f(x)} ${f(y)} L${f(x - 6)} ${f(y - 7)} M${f(x)} ${f(y)} L${f(x + 6)} ${f(y - 7)}" stroke="${C.red}" stroke-width="2.8" stroke-linecap="round" fill="none"/>`;
function trefoil(cx, cy, r) {
  let d = '';
  for (const a0 of [-90, 30, 150]) {
    const a = (a0 - 30) * Math.PI / 180, c = (a0 + 30) * Math.PI / 180, r0 = r * .3;
    d += `M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))} L${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))} A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(c))} ${f(cy + r * Math.sin(c))} L${f(cx + r0 * Math.cos(c))} ${f(cy + r0 * Math.sin(c))} Z `;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#f6d34a" stroke="${C.ink}" stroke-width="1.4"/><path d="${d}" fill="${C.ink}"/>`;
}

/* axis(v, o): the loop at state v (from model.js). Options:
   show     which parts to draw (all by default)
   ghost    the normal state, drawn as dashed marks (or null)
   from     the state the step started from, for the words beside each level bar
   marks    { attack, antibody, block, ptu, rai, tablet, beta }: 0 to 1, how far each has appeared
   brakeWord, trhWord, tshWord: words naming what moved (or '')
   note     one line along the bottom
   flowT    when set, dots flow along the chain and the brake (the phase of a loop)
   tests    box the TSH and T4 bars as the key tests */
const ALL = ['hyp', 'trh', 'pit', 'tsh', 'gland', 'out', 'blood', 'brake', 'meters', 'body'];
function axis(v, o = {}) {
  const show = new Set(o.show || ALL), has = k => show.has(k), g = o.ghost, mk = o.marks || {}, from = o.from || v;
  let s = '';
  // Nodes
  if (has('hyp')) s += `<g data-part="hypothalamus"><rect x="${HYP.x0}" y="${HYP.y0}" width="${HYP.x1 - HYP.x0}" height="${HYP.y1 - HYP.y0}" rx="20" fill="${BRAIN}" stroke="${C.ink}" stroke-width="2"/>${text(CX, 40, 'hypothalamus', 'sm b')}</g>`;
  if (has('pit')) s += `<g data-part="pituitary"><rect x="${PIT.x0}" y="${PIT.y0}" width="${PIT.x1 - PIT.x0}" height="${PIT.y1 - PIT.y0}" rx="20" fill="${BRAIN}" stroke="${C.ink}" stroke-width="2"/>${text(CX, 128, 'pituitary', 'sm b')}</g>`;
  const gsize = o.gland ?? v.gland ?? 1, gs = GS * gsize, lx = GC[0] + 63 * gs + 12;
  if (has('gland')) {
    if (g && Math.abs(1 - gsize) > .03) s += `<g class="ghost">${thyroidGhost(GC[0], GC[1], GS)}</g>`;
    s += `<g data-part="thyroid">${thyroidShape(GC[0], GC[1], gs)}${text(lx, 232, 'thyroid', 'sm b', 'start')}</g>`;
  }
  // Marks of disease and treatment at the gland
  if (mk.attack > 0) {
    const pts = [[-40, -10], [-28, 18], [36, -6], [28, 20], [-50, 4], [48, 10]];
    s += `<g data-part="attack" ${fade(mk.attack)}>` + pts.map(([x, y]) => `<circle cx="${f(GC[0] + x * gs)}" cy="${f(GC[1] + y * gs)}" r="5.5" fill="#fff" stroke="${C.red}" stroke-width="2.4"/><circle cx="${f(GC[0] + x * gs)}" cy="${f(GC[1] + y * gs)}" r="2" fill="${C.red}"/>`).join('') + '</g>';
  }
  if (mk.antibody > 0) {
    const pts = [[-66, -24], [-68, 16], [66, -24], [68, 16]];
    s += `<g data-part="antibody" ${fade(mk.antibody)}>` + pts.map(([x, y]) => antibody(GC[0] + x * gs, GC[1] + y * gs)).join('') + '</g>';
  }
  if (mk.block > 0) {
    s += `<g data-part="block" ${fade(mk.block)}>` + [-1, 1].map(sx => { const x = GC[0] + sx * 34 * gs, y = GC[1] + 6 * gs; return `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="#fff" fill-opacity=".7" stroke="${C.red}" stroke-width="3"/><path d="M${f(x - 8)} ${f(y + 8)} L${f(x + 8)} ${f(y - 8)}" stroke="${C.red}" stroke-width="3"/>`; }).join('') + '</g>';
  }
  if (mk.rai > 0) {
    s += `<g data-part="rai" ${fade(mk.rai)}>${trefoil(GC[0], GC[1] + 6, 11)}</g>`;
  }
  if (o.cause) { const [a, b, al] = o.cause; s += `<g ${fade(al)}>${text(lx, 254, a, 'xs b red', 'start')}${text(lx, 276, b, 'xs b red', 'start')}</g>`; }
  // The chain's arrows
  const links = [];
  if (has('trh')) links.push(['trh', CX, 57, CX, 100, widthOf(v.trh), C.ink, g && widthOf(g.trh)]);
  if (has('tsh')) links.push(['tsh', CX, 145, CX, 206, widthOf(v.tsh), C.blue, g && widthOf(g.tsh)]);
  if (has('out')) links.push(['out', CX, 250, CX, 299, widthOf(v.out), C.amber, g && widthOf(g.out)]);
  for (const [k, x1, y1, x2, y2, w, col] of links) s += flow(x1, y1, x2, y2, w, col, `data-part="${k}" data-flow="${k}" data-w="${f(w)}"`);
  if (g) s += `<g class="ghost" data-ghost="normal">${links.map(([, x1, y1, x2, y2, , , gw]) => flowGhost(x1, y1, x2, y2, gw)).join('')}</g>`;
  if (has('trh')) s += text(166, 84, 'TRH', 'xs b', 'start') + (o.trhWord ? text(206, 84, o.trhWord, 'xs b blue', 'start') : '');
  if (has('tsh')) s += text(166, 182, 'TSH', 'xs b blue', 'start') + (o.tshWord ? text(206, 182, o.tshWord, 'xs b blue', 'start') : '');
  if (has('out')) s += `<g data-part="hormone">${text(138, 290, 'T4, T3', 'xs b amber', 'end')}</g>`;
  // A T4 tablet from outside the body
  if (mk.tablet > 0) {
    s += `<g data-part="tablet" ${fade(mk.tablet)}>${text(226, 292, 'T4 tablet', 'xs b amber', 'start')}</g>`;
  }
  // The blood
  if (has('blood')) {
    s += `<g data-part="blood"><rect x="12" y="${BL.y0}" width="456" height="${BL.y1 - BL.y0}" rx="13" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>${text(458, BL.y1 - 7, 'blood', 'xs b red', 'end')}`;
    const n = clamp(Math.round(9 * v.t4), 1, 26);
    for (let i = 0; i < n; i++) s += `<circle cx="${f(170 + ((i * 0.6180339) % 1) * 230)}" cy="${f(BL.y0 + 7 + ((i * 0.381966) % 1) * 12)}" r="3.6" fill="${AMBERF}" stroke="${C.amber}" stroke-width="1.2"/>`;
    s += '</g>';
    if (mk.tablet > 0) s += `<g data-part="tablet" ${fade(mk.tablet)}><rect x="232" y="${BL.y0 + 4}" width="40" height="18" rx="9" fill="${AMBERF}" stroke="${C.amber}" stroke-width="2.2"/><path d="M252 ${BL.y0 + 5} V${BL.y0 + 21}" stroke="${C.amber}" stroke-width="1.5"/></g>`;
  }
  // The brake: hormone in the blood tells the hypothalamus and pituitary to release less
  if (has('brake')) {
    const w = clamp(2 + 3 * v.t4, 2, 10), my = 162;
    if (g) { const h = clamp(2 + 3 * g.t4, 2, 10) / 2; s += `<g class="ghost" data-ghost="normal"><path d="M${f(BX - h)} ${BL.y0} V40 M${f(BX + h)} ${BL.y0} V40" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="4 3" fill="none"/></g>`; }
    s += `<g data-part="brake" data-flow="brake" data-w="${f(w)}"><path d="M${BX} ${BL.y0 + 2} V34 H${HYP.x0 - 6} M${BX} ${PIT.y0 + 20} H${PIT.x0 - 6}" fill="none" stroke="${C.amber}" stroke-width="${f(w)}" stroke-linejoin="round"/>`
      + `<path d="M${HYP.x0 - 4} 22 V46 M${PIT.x0 - 4} ${PIT.y0 + 8} V${PIT.y0 + 32}" stroke="${C.amber}" stroke-width="5"/>`
      + text(48, my, 'brake', 'xs b amber', 'start') + (o.brakeWord ? text(48, my + 22, o.brakeWord, 'xs b blue', 'start') : '') + '</g>';
  }
  // Flowing dots for the loops that play
  if (o.flowT !== undefined) {
    const ph = o.flowT;
    if (has('trh')) s += dots(CX, 60, CX, 96, clamp(Math.round(3 * v.trh), 1, 7), ph, C.ink);
    if (has('tsh')) s += dots(CX, 148, CX, 200, clamp(Math.round(3 * v.tsh), 1, 8), ph, C.blue);
    if (has('out')) s += dots(CX, 252, CX, 294, clamp(Math.round(3 * v.out), 1, 8), ph, C.amber);
    if (has('brake')) s += dots(BX, BL.y0 - 4, BX, 40, clamp(Math.round(4 * v.t4), 1, 10), ph, AMBERF, 3);
  }
  // The blood tests
  if (has('meters')) {
    s += text(MX0, 138, 'blood tests', 'xs b muted', 'start');
    if (has('tsh')) s += meter('tsh', ROWS.tsh, v.tsh, { name: 'TSH', nameCls: 'xs b blue', ghost: g ? g.tsh : null, from: from.tsh, box: o.tests });
    s += meter('t4', ROWS.t4, v.t4, { name: 'T4', nameCls: 'xs b amber', ghost: g ? g.t4 : null, from: from.t4, box: o.tests });
    s += meter('t3', ROWS.t3, v.t3, { name: 'T3', nameCls: 'xs b amber', ghost: g ? g.t3 : null, from: from.t3 });
    if (o.tests) s += `<g data-part="tests"><rect x="${MX0 - 10}" y="${ROWS.tsh - 34}" width="${MX1 - MX0 + 16}" height="${ROWS.t4 - ROWS.tsh + 52}" fill="none" stroke="${C.blue}" stroke-width="2.5"/></g>`;
  }
  // The body: heartbeat and pace
  if (has('body')) {
    s += `<g data-part="heart"><path transform="translate(34 374)" d="${HEART_D}" fill="${HEART}" stroke="${C.ink}" stroke-width="2"/>`;
    if (mk.beta > 0) s += `<g ${fade(mk.beta)}>${[-9, 9].map(dx => `<rect x="${34 + dx - 5}" y="364" width="10" height="7" fill="${C.blue}"/>`).join('')}</g>`;
    s += '</g>';
    s += trace(v.hr, 386, 66, 296, `data-trace="${v.hr.toFixed(3)}" stroke="${C.red}" stroke-width="2.6"`);
    const hm = moved(v.hr, from.hr, BODY_BAND, ['fast', 'slow', 'usual']);
    s += text(66, 352, 'heartbeat', 'xs b', 'start') + text(296, 352, hm.word, hm.cls, 'end');
    const half = (MX1 - MX0) / 2 - 8, mid = (MX0 + MX1) / 2, pos = r => mid + clamp(Math.log(r) / SPAN.pace, -1, 1) * half;
    const pm = moved(v.pace, from.pace, bandOf('pace'), ['fast', 'slow', 'usual']);
    s += `<g data-part="pace">${text(MX0, 352, 'pace', 'xs b', 'start')}${text(MX1, 352, pm.word, pm.cls, 'end')}`
      + `<rect x="${MX0}" y="370" width="${MX1 - MX0}" height="8" rx="4" fill="#fff" stroke="${C.rule}"/><rect x="${f(pos(BODY_BAND[0]))}" y="370" width="${f(pos(BODY_BAND[1]) - pos(BODY_BAND[0]))}" height="8" fill="${BAND}"/>`
      + (g ? `<rect class="ghost" x="${f(pos(g.pace) - 6)}" y="363" width="12" height="22" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="3 2"/>` : '')
      + `<rect x="${f(pos(v.pace) - 5)}" y="364" width="10" height="20" fill="${C.amber}" stroke="#fff" stroke-width="1.5"/></g>`;
  }
  if (o.note) s += text(o.noteX ?? 12, 410, o.note, 'xs b blue', o.noteX ? 'end' : 'start');
  return s;
}
const AXIS_H = 416;

/* ---------- Build the loop: the step pictures ---------- */
function glandPicture() {
  let b = `<ellipse cx="240" cy="62" rx="104" ry="62" fill="${SKIN}" stroke="${C.rule}" stroke-width="1.5"/>`;
  b += `<path d="M178 112 V330 M302 112 V330" stroke="${C.rule}" stroke-width="1.5"/><rect x="179" y="110" width="122" height="222" fill="${SKIN}"/>`;
  b += `<g data-part="windpipe"><rect x="222" y="150" width="36" height="182" fill="#faf3ec" stroke="${C.muted}" stroke-width="1.4"/>`;
  for (let y = 196; y < 330; y += 13) b += `<path d="M223 ${y} H257" stroke="${C.muted}" stroke-width="1.2"/>`;
  b += '</g>';
  b += `<rect x="212" y="146" width="56" height="34" rx="12" fill="#faf3ec" stroke="${C.muted}" stroke-width="1.6"/>`;
  b += `<g data-part="thyroid">${thyroidShape(240, 238, 1.15)}</g>`;
  b += `<path d="M270 162 H322" stroke="${C.muted}" stroke-width="1.2"/>` + text(328, 168, 'voice box', 'xs b', 'start');
  b += `<path d="M310 232 H322" stroke="${C.muted}" stroke-width="1.2"/>` + text(328, 228, 'thyroid', 'lg b', 'start') + text(328, 254, 'two lobes and', 'xs', 'start') + text(328, 276, 'a bridge', 'xs', 'start');
  b += `<path d="M222 312 H160" stroke="${C.muted}" stroke-width="1.2"/>` + text(154, 318, 'windpipe', 'xs b', 'end');
  b += text(240, 66, 'head', 'xs muted') + text(150, 150, 'neck', 'xs muted', 'end');
  return b;
}
// Moving: the hormone level is turned up, then down, then back, and the body's pace follows it.
function pacePicture(t) {
  const H = t < .4 ? lerp(1, 1.7, ease.inOut(span(t, .08, .32))) : t < .78 ? lerp(1.7, .55, ease.inOut(span(t, .42, .68))) : lerp(.55, 1, ease.inOut(span(t, .8, .96)));
  const pace = Math.sqrt(H);
  let b = `<g data-part="hormone">${thyroidShape(92, 64, .78)}${text(150, 70, 'thyroid', 'sm b', 'start')}`;
  b += flow(92, 98, 92, 172, widthOf(H), C.amber) + text(108, 150, 'thyroid hormone', 'xs b amber', 'start') + '</g>';
  b += `<rect x="12" y="174" width="456" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(458, 195, 'blood', 'xs b red', 'end');
  const n = clamp(Math.round(10 * H), 2, 22);
  for (let i = 0; i < n; i++) b += `<circle cx="${f(130 + ((i * 0.6180339) % 1) * 250)}" cy="${f(182 + ((i * 0.381966) % 1) * 14)}" r="3.8" fill="${AMBERF}" stroke="${C.amber}" stroke-width="1.2"/>`;
  // Three body cells, each burning fuel: the flame grows with the pace.
  b += `<g data-part="pace">`;
  for (const x of [90, 240, 390]) {
    b += flow(x, 206, x, 232, 3 + 2 * H, C.amber) + `<circle cx="${x}" cy="274" r="38" fill="#f1e3cf" stroke="${C.ink}" stroke-width="2"/>`;
    const fs = .45 + .6 * pace;
    b += `<path transform="translate(${x} 292) scale(${f(fs)})" d="M0 0 C-15 0 -19 -12 -13 -22 C-9 -29 -4 -27 -2 -36 C7 -28 17 -19 15 -8 C14 -3 8 0 0 0 Z" fill="#e66a55" stroke="${C.red}" stroke-width="${f(1.6 / fs)}"/>`;
  }
  b += text(240, 334, 'body cells burning fuel', 'xs b');
  const half = 150, mid = 240, pos = r => mid + clamp(Math.log(r) / Math.log(2), -1, 1) * half;
  b += text(90, 364, 'pace', 'xs b', 'end') + `<rect x="${mid - half}" y="356" width="${half * 2}" height="10" rx="5" fill="#fff" stroke="${C.rule}"/>`;
  b += `<rect x="${f(pos(BODY_BAND[0]))}" y="356" width="${f(pos(BODY_BAND[1]) - pos(BODY_BAND[0]))}" height="10" fill="${BAND}"/>`;
  b += `<rect x="${f(pos(pace) - 5)}" y="350" width="10" height="22" fill="${C.amber}" stroke="#fff" stroke-width="1.5"/></g>`;
  const word = H > 1.15 ? 'more hormone: a faster pace' : H < .85 ? 'less hormone: a slower pace' : 'usual hormone: a usual pace';
  b += text(240, 398, word, 'sm b blue');
  return b;
}
// Moving: iodine dots leave the blood, cross the follicle's wall of cells and fix onto the stored protein.
function iodinePicture(t) {
  const cx = 228, cy = 164, R = 92;
  let b = `<g data-part="follicle">`;
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; b += `<circle cx="${f(cx + R * Math.cos(a))}" cy="${f(cy + R * Math.sin(a))}" r="21" fill="${GLAND}" stroke="${C.ink}" stroke-width="1.5"/>`; }
  b += '</g>';
  b += `<g data-part="store"><circle cx="${cx}" cy="${cy}" r="68" fill="#f4d9b0" stroke="#b06e60" stroke-width="1.5"/>`;
  for (let k = 0; k < 3; k++) b += `<path d="M${cx - 50} ${cy - 26 + k * 26} C${cx - 20} ${cy - 42 + k * 26} ${cx + 20} ${cy - 10 + k * 26} ${cx + 50} ${cy - 26 + k * 26}" fill="none" stroke="#b06e60" stroke-width="3" stroke-linecap="round"/>`;
  b += '</g>';
  b += `<rect x="12" y="314" width="456" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(458, 335, 'blood', 'xs b red', 'end');
  // Each dot rides from the blood through the wall to a seat on a strand of the protein, sits, then a new one comes.
  const seats = [[-34, -30], [0, -20], [30, -28], [-30, 0], [6, 6], [34, -2], [-24, 26], [10, 32], [36, 24]];
  let s = '';
  seats.forEach(([sx, sy], i) => {
    const u = ((t * 2 + i / seats.length) % 1);
    const sx0 = cx - 150 + i * 36, sy0 = 329;
    const wallA = Math.atan2(sy0 - cy, sx0 - cx), wx = cx + R * Math.cos(wallA), wy = cy + R * Math.sin(wallA);
    let x, y;
    if (u < .4) { const k = ease.inOut(u / .4); x = lerp(sx0, wx, k); y = lerp(sy0, wy, k); }
    else { const k = ease.inOut(Math.min(1, (u - .4) / .3)); x = lerp(wx, cx + sx, k); y = lerp(wy, cy + sy, k); }
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="#fff" stroke="${C.ink}" stroke-width="1.8" ${fade(u > .94 ? (1 - u) * 16 : 1)}/>`;
  });
  b += `<g data-part="iodine">${s}</g>`;
  b += text(240, 26, 'one follicle, enlarged', 'sm b');
  b += `<path d="M340 96 L310 116" stroke="${C.muted}" stroke-width="1.2"/>` + text(344, 92, 'wall of cells', 'xs b', 'start');
  b += `<path d="M300 172 L340 196" stroke="${C.muted}" stroke-width="1.2"/>` + text(344, 210, 'stored protein', 'xs b', 'start') + text(344, 232, 'with iodine fixed', 'xs', 'start') + text(344, 254, 'onto it', 'xs', 'start');
  b += text(20, 302, 'iodine', 'xs b', 'start') + `<circle cx="86" cy="296" r="5" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>`;
  return b;
}
// Moving: a T4 leaves the gland, travels in the blood into a body cell, loses one iodine and becomes T3.
function hormoneMark(x, y, n, filled, part) {
  let s = `<g data-part="${part}"><rect x="${f(x - 26)}" y="${f(y - 13)}" width="52" height="26" rx="13" fill="${filled ? AMBERF : '#fff'}" stroke="${C.amber}" stroke-width="2.5"/>`;
  for (let i = 0; i < n; i++) s += `<circle cx="${f(x - 18 + i * 12)}" cy="${f(y)}" r="4.2" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>`;
  return s + '</g>';
}
function formsPicture(t) {
  let b = `${thyroidShape(72, 60, .72)}${text(128, 66, 'thyroid', 'sm b', 'start')}`;
  b += `<rect x="12" y="112" width="456" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(458, 133, 'blood', 'xs b red', 'end');
  b += `<g data-part="cell"><rect x="196" y="162" width="270" height="176" rx="36" fill="#f1e3cf" stroke="${C.ink}" stroke-width="2"/>${text(212, 324, 'a body cell', 'xs b', 'start')}`;
  b += `<ellipse cx="392" cy="276" rx="56" ry="34" fill="#e9d3b8" stroke="${C.ink}" stroke-width="1.5"/>${text(392, 282, 'its centre', 'xs muted')}</g>`;
  // The trip: gland to blood (0 to .2), along the blood (.2 to .4), into the cell (.4 to .52); the snip (.55 to .68); T3 to the centre (.72 to .86).
  const u = t;
  let x, y;
  if (u < .2) { const k = ease.inOut(u / .2); x = lerp(72, 96, k); y = lerp(86, 127, k); }
  else if (u < .4) { const k = ease.inOut((u - .2) / .2); x = lerp(96, 270, k); y = 127; }
  else if (u < .52) { const k = ease.inOut((u - .4) / .12); x = 270; y = lerp(127, 214, k); }
  else if (u < .72) { x = 270; y = 214; }
  else { const k = ease.inOut(Math.min(1, (u - .72) / .14)); x = lerp(270, 392, k); y = lerp(214, 246, k); }
  const snipped = u >= .6;
  b += hormoneMark(x, y, snipped ? 3 : 4, !snipped, snipped ? 't3' : 't4');
  if (snipped) { const k = span(u, .6, .78); b += `<circle cx="${f(270 + 34 + 30 * k)}" cy="${f(214 - 4 - 14 * k)}" r="4.2" fill="#fff" stroke="${C.ink}" stroke-width="1.6" ${fade(1 - k * .8)}/>`; }
  b += `<g ${fade(span(u, .55, .65))}>${text(331, 192, 'one iodine snipped off', 'xs b')}</g>`;
  b += `<g ${fade(span(u, .84, .94))}>${text(322, 236, 'T3 does', 'xs b blue', 'end')}${text(322, 258, 'the work', 'xs b blue', 'end')}</g>`;
  b += `<g data-part="t4">${hormoneMark(40, 190, 4, true, 't4-key')}${text(40, 224, 'T4: four', 'xs b')}${text(40, 246, 'iodines', 'xs b')}</g>`;
  b += `<g data-part="t3">${hormoneMark(40, 276, 3, false, 't3-key')}${text(40, 310, 'T3: three,', 'xs b')}${text(40, 332, 'stronger', 'xs b')}</g>`;
  return b;
}
// The heart's docking sites: thyroid hormone adds more, so alarm signals push the heart harder, and it beats faster.
function heartPicture(t) {
  const H = t < .5 ? lerp(.55, 1, ease.inOut(span(t, .08, .4))) : lerp(1, 1.8, ease.inOut(span(t, .55, .88)));
  const hr = Math.sqrt(H);
  let b = `<g data-part="heart"><path transform="translate(130 150) scale(3.6)" d="${HEART_D}" fill="${HEART}" stroke="${C.ink}" stroke-width=".55"/></g>`;
  const n = clamp(Math.round(4 * H), 2, 8), spots = [[-52, -34], [-24, -52], [10, -50], [40, -34], [-62, -4], [54, -4], [-38, 26], [34, 26]];
  b += `<g data-part="receptor">${spots.slice(0, n).map(([x, y]) => `<path d="M${130 + x - 8} ${150 + y} h16 v-6 h-5 v-6 h-6 v6 h-5 Z" fill="${C.blue}"/>`).join('')}</g>`;
  b += text(130, 252, 'docking sites', 'xs b blue') + text(130, 274, 'for alarm signals', 'xs b blue');
  b += text(270, 70, 'thyroid hormone', 'xs b', 'start');
  b += `<rect x="270" y="82" width="196" height="10" rx="5" fill="#fff" stroke="${C.rule}"/><rect x="270" y="82" width="${f(196 * clamp(H / 2, 0, 1))}" height="10" rx="5" fill="${C.amber}"/>`;
  b += text(270, 120, H > 1.15 ? 'high: more docking sites' : H < .85 ? 'low: fewer docking sites' : 'usual', 'xs b amber', 'start');
  b += trace(hr, 352, 20, 460, `stroke="${C.red}" stroke-width="2.8"`);
  b += text(20, 312, 'heartbeat', 'xs b', 'start') + text(460, 312, H > 1.15 ? 'faster, harder' : H < .85 ? 'slower' : 'usual', 'sm b blue', 'end');
  return b;
}

/* ---------- The feedback, played once ---------- */
// T4 is pushed away from normal; the brake answers at once; TRH and TSH follow; the gland follows them and T4 returns.
function feedback(dir, t) {
  const far = dir > 0 ? 1.7 : .5;
  const H = t < .5 ? lerp(1, far, ease.inOut(span(t, .08, .26))) : lerp(far, 1, ease.inOut(span(t, .6, .92)));
  const lag = t < .5 ? lerp(1, far, ease.inOut(span(t, .26, .44))) : lerp(far, 1, ease.inOut(span(t, .62, .94)));
  // The push: the gland first puts out a burst (or a dip); then its output follows TSH again.
  const tsh = TM.tshFor(lag), trh = Math.pow(lag, -1.2), burst = dir > 0 ? 2.2 : .35;
  const out = t < .28 ? lerp(1, burst, ease.inOut(span(t, .04, .18))) : lerp(burst, 2 * tsh / (tsh + 1), ease.inOut(span(t, .28, .42)));
  const v = { ...NV, t4: H, t3: H, tsh, trh, out, pace: Math.sqrt(H), hr: Math.sqrt(H), gland: 1 };
  const up = dir > 0;
  const steps = [
    [span(t, .1, .18), up ? '1  a burst from the gland: T4 runs high' : '1  the gland dips: T4 runs low'],
    [span(t, .2, .28), up ? '2  the brake tightens' : '2  the brake eases'],
    [span(t, .32, .42), up ? '3  TRH and TSH fall' : '3  TRH and TSH rise'],
    [span(t, .58, .68), up ? '4  the gland slows: T4 falls back' : '4  the gland speeds up: T4 climbs back'],
  ];
  const opt = { show: ['hyp', 'trh', 'pit', 'tsh', 'gland', 'out', 'blood', 'brake', 'meters'], ghost: NV, from: NV,
    brakeWord: '', trhWord: '', tshWord: '' };
  let b = axis(v, opt);
  b += steps.map(([a, w], i) => `<g ${fade(a)}>${text(12, 348 + i * 22, w, i === 3 ? 'xs b blue' : 'xs b', 'start')}</g>`).join('');
  return { svg: b, h: 432 > 420 ? 420 : 420 };
}

/* ---------- What changes it ---------- */
const CHANGES = {
  hypo: { from: () => TM.build('normal'), to: () => TM.build('hypo'), marks: k => ({ attack: k }), gland: 1, cause: ['immune', 'attack'], note: 'less T4: the brake eases and TSH climbs' },
  graves: { from: () => TM.build('normal'), to: () => TM.build('graves'), marks: k => ({ antibody: k }), cause: ['antibody', 'push'], note: 'more T4 and T3: the brake tightens and TSH falls' },
  levothyroxine: { from: () => TM.build('hypo'), to: () => TM.build('hypo', ['levothyroxine']), marks: k => ({ attack: 1, tablet: k }), gland: 1, note: 'tablet T4 tightens the brake again: TSH falls back' },
  thionamide: { from: () => TM.build('graves'), to: () => TM.build('graves', ['ptu']), mid: () => TM.build('graves', ['thionamide']), marks: k => ({ antibody: 1, block: k }), cause: ['building', 'blocked'], note: '', lag: true },
  rai: { from: () => TM.build('graves'), to: () => TM.build('graves', ['rai']), marks: k => ({ antibody: 1, rai: k }), cause: ['radiation', 'shrinks it'], note: 'less T4 and T3: the brake eases; TSH rises back later', lag: true },
  betablocker: { from: () => TM.build('graves'), to: () => TM.build('graves', ['betablocker']), marks: k => ({ antibody: 1, beta: k }), note: 'the symptoms ease: the gland, TSH and T4 stay put' },
};
const TITLE = { hypo: 'Hypothyroidism', graves: 'Graves’ disease', levothyroxine: 'Levothyroxine for hypothyroidism', thionamide: 'A thionamide for Graves’ disease', rai: 'Radioactive iodine for Graves’ disease', betablocker: 'A beta-blocker for Graves’ disease' };
const WHERE = {
  hypo: 'Red immune cells gather on the gland. Its T4 and T3 arrow thins; T4 falls below its band while T3 dips but stays inside its band. The brake line thins, and the TRH and TSH arrows swell past their dashed normal outlines as TSH climbs above its band. The heartbeat spreads out and the pace bar slides toward slower.',
  graves: 'Red Y-shaped antibodies cling to the gland, which swells past its dashed outline and pours out a thick T4 and T3 arrow. Both levels climb above their bands, the brake line thickens and the TSH arrow shrinks to a thread as TSH falls below its band. The heartbeat crowds together and the pace bar slides toward faster.',
  levothyroxine: 'An amber T4 tablet sends T4 into the blood while the damaged gland stays as it was. T4 and T3 climb back into their bands, the brake strengthens and the swollen TSH arrow shrinks back as TSH falls into its band. The heartbeat and pace return toward normal.',
  thionamide: 'Red block signs appear over both lobes. The gland stays enlarged and the antibodies stay, but its T4 and T3 arrow thins. T4 and T3 fall back into their bands first; the brake eases and TSH rises back only later. Then the bottom line adds that PTU also slows the T4-to-T3 step in body cells, so T3 falls further than T4.',
  rai: 'Radioactive iodine, a yellow and black sign, collects in the gland, which shrinks to under its dashed normal outline though antibodies remain. Its arrow thins, T4 and T3 fall back into their bands, the brake eases and TSH rises back into its band, later than T4 falls.',
  betablocker: 'Blue blocks cover the heart’s docking sites and the heartbeat spreads back toward a normal rhythm. The gland stays enlarged, T4 stays above its band and TSH stays low; T3 dips only slightly, and the pace bar still sits toward faster.',
};
const mix = (a, b, k) => TM.mix(a, b, k);
function change(kind) {
  const c = CHANGES[kind];
  return {
    duration: kind === 'thionamide' ? 4200 : 2800,
    render(t) {
      const p0 = c.from(), start = view(p0);
      let p, k;
      if (c.mid) {
        // Two moves: both thionamides block the gland; then PTU also slows T4 to T3 in body cells.
        const k1 = ease.inOut(span(t, 0, .55)), k2 = ease.inOut(span(t, .65, 1));
        p = k2 > 0 ? mix(c.mid(), c.to(), k2) : mix(p0, c.mid(), k1);
        k = k1;
      } else { k = ease.inOut(t); p = mix(p0, c.to(), k); }
      let v = view(p);
      const a = span(t, .5, .85);
      // A pituitary held down for a long time recovers late: TSH and TRH follow the change behind T4.
      if (c.lag) { const kl = ease.inOut(span(t, .3, 1)), q = view(mix(p0, c.mid ? c.mid() : c.to(), kl)); v = { ...v, tsh: q.tsh, trh: q.trh }; }
      const words = {
        trhWord: Math.abs(Math.log(v.trh / start.trh)) > .2 ? (v.trh > start.trh ? '↑ more' : '↓ less') : '',
        tshWord: Math.abs(Math.log(v.tsh / start.tsh)) > .2 ? (v.tsh > start.tsh ? '↑ more' : '↓ less') : '',
        brakeWord: Math.abs(v.t4 - start.t4) > .15 ? (v.t4 > start.t4 ? 'tightens' : 'eases') : '',
      };
      let note = c.note;
      if (kind === 'thionamide') note = t > .62 ? 'PTU also slows T4 to T3 in body cells: T3 falls further' : 'less T4 and T3: the brake eases; TSH rises back later';
      const mk = c.marks(Math.min(1, k * 1.6));
      const body = axis(v, { ghost: NV, from: start, gland: c.gland, marks: mk, cause: c.cause ? [...c.cause, Math.min(1, k * 1.6)] : null, ...words, note: a > 0 ? note : '' });
      const label = `${TITLE[kind]}, drawn over dashed marks for normal. ${WHERE[kind]}`;
      return { svg: svg(label, body, { h: AXIS_H }), readout: readoutOf(v, start, kind === 'hypo' || kind === 'graves' ? 'Compared with normal' : `Compared with untreated ${kind === 'levothyroxine' ? 'hypothyroidism' : 'Graves’ disease'}`) };
    }
  };
}
function trend(a, b, up = 'higher', down = 'lower') { const r = (a + 1e-6) / (b + 1e-6); return r > 1.07 ? ['up', up] : r < .935 ? ['down', down] : ['same', 'about the same']; }
function compareRows(v, ref) {
  return [['TSH', ...trend(v.tsh, ref.tsh)], ['T4', ...trend(v.t4, ref.t4)], ['T3', ...trend(v.t3, ref.t3)], ['Heartbeat', ...trend(v.hr, ref.hr, 'faster', 'slower')], ['Body’s pace', ...trend(v.pace, ref.pace, 'faster', 'slower')]];
}
const readoutOf = (v, ref, head) => readoutList(compareRows(v, ref), head);
const describe = (v, ref) => compareRows(v, ref).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const loopScene = (label, opt, ms = 3000) => ({ duration: ms, loop: true, render: t => svg(label, axis(NV, { ...opt, flowT: t * 2 }), { h: opt.h || AXIS_H }) });
const scenes = {
  gland: () => svg('A head and neck from the front. Wrapped around the front of the windpipe, just below the voice box, sits the thyroid: two lobes joined by a narrow bridge, shaped like a butterfly.', glandPicture(), { h: 340 }),
  pace: { duration: 7000, render: t => svg('The thyroid sends an amber arrow of thyroid hormone into the blood, which carries it to three body cells, each burning fuel as a small flame, with a pace bar below. The hormone is turned up, then down, then back: with more hormone the flames grow and the pace bar slides toward faster; with less they shrink and it slides toward slower.', pacePicture(t), { h: 410 }) },
  iodine: { duration: 4500, loop: true, render: t => svg('One thyroid follicle, enlarged: a ring of cells around a store of protein. White iodine dots travel from the blood below, cross the wall of cells and fix onto strands of the stored protein.', iodinePicture(t), { h: 360 }) },
  forms: { duration: 5200, render: t => svg('A hormone carrying four iodine dots, T4, leaves the thyroid, travels in the blood into a body cell, has one iodine snipped off and becomes T3, with three, which moves to the centre of the cell to do the work. A key shows T4 with four iodines and T3 with three, the stronger form.', formsPicture(t), { h: 346 }) },
  pituitary: loopScene('The pituitary sends a blue TSH arrow down to the thyroid, and the thyroid sends an amber arrow of T4 and T3 into the blood; dots flow down both. On the right, blood tests for TSH, T4 and T3 each sit inside a shaded usual band.', { show: ['pit', 'tsh', 'gland', 'out', 'blood', 'meters'] }),
  hypothalamus: loopScene('Above the pituitary sits the hypothalamus. A dark TRH arrow runs from it to the pituitary, which sends the blue TSH arrow on to the thyroid, which sends T4 and T3 into the blood: a chain from brain to gland, with dots flowing down it.', { show: ['hyp', 'trh', 'pit', 'tsh', 'gland', 'out', 'blood', 'meters'] }),
  brake: { duration: 7500, render: t => { const r = feedback(1, t); return svg('Negative feedback, played once. The gland puts out a burst and T4 runs high, above its band; the amber brake line from the blood to the hypothalamus and pituitary thickens; the TRH and TSH arrows thin and TSH falls below its band; then the gland slows and T4 falls back, and everything returns to normal. Four numbered lines name the steps.', r.svg, { h: 420 }); } },
  lowbrake: { duration: 7500, render: t => { const r = feedback(-1, t); return svg('The feedback the other way. The gland dips and T4 runs low, below its band; the brake line thins; the TRH and TSH arrows swell and TSH rises above its band; then the gland speeds up and T4 climbs back, and everything returns to normal. Four numbered lines name the steps.', r.svg, { h: 420 }); } },
  heart: { duration: 6500, render: t => svg('A heart with blue docking sites for alarm signals. As thyroid hormone rises from low to usual to high, more docking sites appear and the heartbeat trace below goes from slow and spread out to fast and crowded.', heartPicture(t), { h: 372 }) },
  whole: { duration: 3000, loop: true, render: t => svg('The whole loop. The hypothalamus sends TRH to the pituitary, the pituitary sends TSH to the thyroid, and the thyroid sends T4 and T3 into the blood, which sets the heartbeat and the body’s pace. An amber brake line runs from the blood back up to the pituitary and hypothalamus. A blue box marks the TSH and T4 bars: the key blood tests.', axis(NV, { flowT: t * 2, tests: true }), { h: AXIS_H }) },
  hypo: change('hypo'),
  graves: change('graves'),
  levothyroxine: change('levothyroxine'),
  thionamide: change('thionamide'),
  rai: change('rai'),
  betablocker: change('betablocker'),
};

/* ---------- Words for the sliders ---------- */
const capWords = v => v < 0.2 ? 'very little' : v < 0.6 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : v <= 1.35 ? 'more than normal' : 'much more than normal';
const stimWords = v => v < 0.05 ? 'none' : v < 0.8 ? 'mild' : v < 1.8 ? 'strong' : 'very strong';
const iodWords = v => v < 0.15 ? 'severely short' : v < 0.5 ? 'short' : v < 0.85 ? 'a little short' : 'enough';

/* ---------- Where a model level sits against its band ----------
   The sources give only directions for diseases and drugs, so the model never prints a lab number:
   it reports where its marker sits (inside, above, below, or far beyond the band). */
let data = null;
const GLABEL = { tsh: 'TSH', t4: 'T4', t3: 'T3' };
const relOf = (v, k) => k === 'tsh' ? v.tsh : k === 't4' ? v.t4 : v.t3;
const gyRaw = (k, rel) => Math.log(Math.max(rel, 1e-6)) / SPAN[k];
function place(k, rel) {
  const [lo, hi] = bandOf(k);
  if (rel >= lo - 1e-9 && rel <= hi + 1e-9) return 'inside';
  const far = Math.abs(gyRaw(k, rel)) >= 1;
  return `${far ? 'far ' : ''}${rel > hi ? 'above' : 'below'}`;
}
const PLACE_ARROW = { inside: '↔', above: '↑', 'far above': '⇈', below: '↓', 'far below': '⇊' };
const levelWords = (k, rel, band = 'its healthy band') => { const w = place(k, rel); return w === 'inside' ? `inside ${band}` : `${w} ${band}`; };
const bandWords = v => {
  const out = ['tsh', 't4', 't3'].filter(k => place(k, relOf(v, k)) !== 'inside');
  return out.length ? out.map(k => `${GLABEL[k]} sits ${levelWords(k, relOf(v, k))}.`).join(' ') : 'TSH, T4 and T3 all sit inside their healthy bands.';
};

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
// The bar is a ratio scale centred on the model's normal, the same scale as the lesson's level bars.
const barX = (k, rel) => f(200 + clamp(gyRaw(k, rel), -1, 1) * 170);
// Print a range as the source does: the high end keeps the low end's decimals (0.5–4.0).
const rangeText = v => { const d = (String(v.low).split('.')[1] || '').length; return `${v.low}–${v.high.toFixed(d)}`; };
// How each cited state is applied to the model, and what its directions are compared with.
const BASE_OF = { levothyroxine: 'hypo', thionamide: 'graves', rai: 'graves', betablocker: 'graves' };
const BASE_WORD = { hypo: 'untreated hypothyroidism', graves: 'untreated Graves’ disease' };
const MARKS_OF = { hypo: { attack: 1 }, graves: { antibody: 1 }, levothyroxine: { attack: 1, tablet: 1 }, thionamide: { antibody: 1, block: 1 }, rai: { antibody: 1, rai: 1 }, betablocker: { antibody: 1, beta: 1 } };
function stateParams(id) {
  if (id === 'hypo' || id === 'graves') return TM.build(id);
  if (BASE_OF[id]) return TM.build(BASE_OF[id], [id]);
  return TM.build('normal');
}
const cv = { state: 'normal', p: TM.build('normal'), custom: false };
function updateClinical() {
  $('#clinical-cap').value = cv.p.cap; $('#clinical-cap-label').textContent = capWords(cv.p.cap);
  $('#clinical-stim').value = cv.p.stim; $('#clinical-stim-label').textContent = stimWords(cv.p.stim);
  const cur = view(cv.p);
  const st = data?.states.find(s => s.id === cv.state);
  const base = BASE_OF[cv.state], before = st && base ? view(TM.build(base)) : null;
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#clinical-visual').innerHTML = svg(label, axis(cur, { ghost: NV, from: before || NV, marks: cv.custom ? {} : (MARKS_OF[cv.state] || {}) }), { h: AXIS_H });
  if (!data) return;
  const ref = st ? (before || NV) : null;
  const refWord = base ? BASE_WORD[base] : 'normal';
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    const note = d && st.shiftNotes?.[v.id] ? `: ${st.shiftNotes[v.id]}` : '';
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}${note}` : 'No direction given by the cited source for this row; the teaching model leaves it unchanged') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const k = v.modelKey, rel = relOf(cur, k), where = place(k, rel);
    const reading = row.querySelector('.reading');
    reading.textContent = `${PLACE_ARROW[where]} ${where === 'inside' ? 'Inside' : where[0].toUpperCase() + where.slice(1)} the typical range`;
    reading.dataset.rel = rel.toFixed(3);
    const x = barX(k, rel), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model position (illustrative, no number): ${where} typical range${where.startsWith('far') ? ', off the end of the bar' : ''}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (ref && !cv.custom) {
      const rv = relOf(ref, k), rx = barX(k, rv);
      cmp.textContent = `Dashed line: model, ${refWord} (${place(k, rv)} typical range)`;
      cmp.dataset.rel = rv.toFixed(3);
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; delete cmp.dataset.rel; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this${BASE_OF[id] ? `, applied to ${BASE_WORD[BASE_OF[id]]}` : ''}.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
for (const k of ['cap', 'stim']) {
  $('#clinical-' + k).addEventListener('input', e => {
    cv.p = { ...cv.p, [k]: Number(e.target.value) }; cv.custom = true;
    const s = data?.states.find(x => x.id === cv.state);
    $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
    updateClinical(); announce();
  });
}
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = view(cv.p);
    $('#cv-live').textContent = `Model: TSH ${levelWords('tsh', m.tsh, 'typical range')}, T4 ${levelWords('t4', m.t4, 'typical range')}, T3 ${levelWords('t3', m.t3, 'typical range')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), cap: 1, stim: 0, iod: 1 };
const DRUG_ORDER = ['levothyroxine', 'thionamide', 'ptu', 'rai', 'betablocker'];
function exploreParams() {
  let p = { ...TM.NORMAL, cap: ex.cap, stim: ex.stim, iod: ex.iod };
  for (const d of DRUG_ORDER) {
    if (!ex.drugs.has(d)) continue;
    if (d === 'thionamide' && ex.drugs.has('ptu')) continue;   // both thionamides block the same step: count the block once
    p = TM.DRUGS[d](p);
  }
  return p;
}
function keyRow(items, y) {
  let x = 10, row = 0, out = '';
  for (const [icon, word] of items) {
    const w = 46 + word.length * 9.4;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    out += `<g transform="translate(${f(x)} ${y + row * 26})">${icon}${text(42, 6, word, 'xs', 'start')}</g>`;
    x += w + 14;
  }
  return { body: out, rows: row + 1 };
}
function brakeChart(cur, p) {
  // Levels relative to normal, with no numbers: real reference numbers live only in the Clinical values tab.
  const L = 58, R = 462, T = 34, B = 270, xMax = 2.8, yLo = -2.3, yHi = 1.7;
  const X = t4 => L + clamp(t4 / xMax, 0, 1.02) * (R - L), Y = tsh => B - clamp((Math.log10(Math.max(tsh, 1e-6)) - yLo) / (yHi - yLo), -0.02, 1.02) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${C.rule}"/>`;
  const [x0, x1] = bandOf('t4').map(X), [y1, y0] = bandOf('tsh').map(Y);
  b += `<rect data-ref-box x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="${BAND}"/>`;
  b += text(x1 + 6, y0 + 16, 'both in', 'xs b blue', 'start') + text(x1 + 6, y0 + 34, 'their bands', 'xs b blue', 'start');
  b += text(L - 6, T + 14, 'more', 'xs muted', 'end') + text(L - 6, B, 'less', 'xs muted', 'end') + text(L, B + 22, 'less', 'xs muted', 'start') + text(R, B + 22, 'more', 'xs muted', 'end');
  // The brake: TSH the pituitary releases for each T4 level (fixed).
  let brakeD = '';
  for (let i = 0; i <= 60; i++) { const h = 0.05 + i / 60 * (xMax - 0.05); brakeD += (i ? ' L' : 'M') + `${f(X(h))} ${f(Y(TM.tshFor(h)))}`; }
  b += `<path data-brake-curve d="${brakeD}" fill="none" stroke="${C.blue}" stroke-width="3"/>`;
  // The gland's answer: T4 it settles at for each TSH level (depends on the settings).
  const glandD = q => {
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const lt = (yLo - 0.3) + i / 60 * (yHi - yLo + 0.6), t = Math.pow(10, lt);
      const h = TM.releaseFor(q, t) + q.exo;
      d += (i ? ' L' : 'M') + `${f(X(h))} ${f(Y(t))}`;
    }
    return d;
  };
  b += `<path d="${glandD(NORMAL_P)}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-gland-curve d="${glandD(p)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  b += `<circle cx="${f(X(1))}" cy="${f(Y(1))}" r="7" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="3 2"/>`;
  b += `<circle data-explore-point cx="${f(X(cur.t4))}" cy="${f(Y(cur.tsh))}" r="7" fill="${C.amber}" stroke="#fff" stroke-width="2"/>`;
  b += text(L, 22, 'TSH ↑ (ratio scale)', 'xs b', 'start') + text(R, B + 46, 'T4 →', 'xs b', 'end');
  const k = keyRow([[`<path d="M0 0 H34" stroke="${C.blue}" stroke-width="3"/>`, 'brake: TSH for each T4'], [`<path d="M0 0 H34" stroke="${C.amber}" stroke-width="3"/>`, 'gland: T4 for each TSH'], [`<path d="M0 0 H34" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5"/>`, 'normal gland']], 344);
  return { body: b + k.body, h: 358 + 26 * (k.rows - 1) };
}
function updateExplore() {
  for (const [id, words] of [['cap', capWords], ['stim', stimWords], ['iod', iodWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  const p = exploreParams(), cur = view(p);
  const names = { levothyroxine: 'levothyroxine', thionamide: 'methimazole', ptu: 'propylthiouracil', rai: 'radioactive iodine', betablocker: 'a beta-blocker' };
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => names[d]);
  const who = `${{ normal: 'a normal body', hypo: 'hypothyroidism', graves: 'Graves’ disease' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const marks = { attack: ex.preset === 'hypo' ? 1 : 0, antibody: ex.stim > 0.05 ? 1 : 0, block: (ex.drugs.has('thionamide') || ex.drugs.has('ptu')) ? 1 : 0, rai: ex.drugs.has('rai') ? 1 : 0, tablet: ex.drugs.has('levothyroxine') ? 1 : 0, beta: ex.drugs.has('betablocker') ? 1 : 0 };
  const label = `Illustrative model of ${who}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = svg(label, axis(cur, { ghost: NV, from: NV, marks }), { h: AXIS_H }) + readoutOf(cur, NV, 'Compared with normal');
  const [, hrW] = trend(cur.hr, NV.hr, 'faster than normal', 'slower than normal'), [, paceW] = trend(cur.pace, NV.pace, 'faster than normal', 'slower than normal'), [, gW] = trend(cur.gland, NV.gland, 'larger than normal', 'smaller than normal');
  const levels = ['tsh', 't4', 't3'].map(k => `${GLABEL[k]} ${levelWords(k, relOf(cur, k))}`).join(' · ');
  const goiter = cur.gland > 1.15 ? ' (a goiter)' : '';
  const res = $('#model-results');
  res.textContent = `Illustrative model output for ${who}: ${levels} · heartbeat ${hrW === 'about the same' ? 'about normal' : hrW} · body’s pace ${paceW === 'about the same' ? 'about normal' : paceW} · gland ${gW === 'about the same' ? 'about normal size' : gW}${goiter}.`;
  Object.assign(res.dataset, { tsh: cur.tsh.toFixed(4), t4: cur.t4.toFixed(4), t3: cur.t3.toFixed(4) });
  const chart = brakeChart(cur, p);
  $('#explore-chart').innerHTML = svg(`Illustrative chart with total T4 across and TSH up, on a ratio scale; no numbers are shown. A falling blue curve is the brake: the TSH the pituitary releases for each T4 level. A rising amber curve is the gland: the T4 it makes for each TSH level, with a dashed curve for the normal gland. The loop settles where they cross, with TSH ${levelWords('tsh', cur.tsh)} and T4 ${levelWords('t4', cur.t4)}. The shaded box is where TSH and T4 are both inside their healthy bands.`, chart.body, { h: chart.h });
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = TM.build(r.value); ex.cap = d.cap; ex.stim = d.stim; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['cap', 'stim', 'iod']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', cap: 1, stim: 0, iod: 1 }); ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; }); $('#preset input[value="normal"]').checked = true;
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byId = id => loaded.values?.find(v => v.id === id);
    const ok = ['tsh', 't4', 't3'].every(id => { const v = byId(id); return v && Number.isFinite(v.low) && Number.isFinite(v.high) && v.low > 0; });
    if (!ok) throw new Error('Invalid reference data');
    data = loaded;
    const tsh = byId('tsh'), t4 = byId('t4'), t3 = byId('t3');
    // Each band is drawn relative to the model's normal, which sits at the middle of the quoted range
    // (for TSH, the middle on a ratio scale). Nothing else is converted into lab units.
    const mid = { tsh: Math.sqrt(tsh.low * tsh.high), t4: (t4.low + t4.high) / 2, t3: (t3.low + t3.high) / 2 };
    BANDS = { tsh: [tsh.low / mid.tsh, tsh.high / mid.tsh], t4: [t4.low / mid.t4, t4.high / mid.t4], t3: [t3.low / mid.t3, t3.high / mid.t3] };
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the only numbers here are the quoted reference ranges. The teaching model works in levels relative to normal, and its normal is drawn in the middle of each band. For a disease or drug the sources give only a direction, so the model marker shows where the level moves (inside, above, below, or far beyond the band) and never a predicted number; how far it moves is an illustrative choice.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v.modelKey, n / mid[v.modelKey]), range = hasRange(v), typical = Number.isFinite(v.typical) && !range;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = typical ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      const [lo, hi] = range ? rangeText(v).split('–') : ['', ''];
      const edges = range ? `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${range ? `${rangeText(v)} ${v.unit}` : ''} as a shaded band${v.modelKey ? ', a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for what it is compared with' : ''}`);
      right.querySelector('.key').textContent = `${range ? `Source range ${rangeText(v)} ${v.unit} (shaded)` : `Source typical value ${v.typical} ${v.unit} (tick; no range given)`} · ratio scale · blue line: model position, illustrative, no number`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, ev, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null; BANDS = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
