// Lesson 15: The HPA axis and steroids. The kit (/lab/kit/kit.js) runs the page; this file draws the pictures from
// the illustrative model in model.js (window.HPAModel) and runs the Clinical values and Explore freely tabs.
//
// Expected behaviour:
//   - Every picture is 480 wide and at most 420 tall, set in the kit's type (20 / .sm 18 / .xs 17).
//   - The axis picture (steps 6 to 17, Clinical values, Explore freely) uses the same layout as Lesson 14's
//     thyroid axis, so the two loops read as one pattern: hypothalamus, CRH, pituitary, ACTH, adrenal cortex, then
//     cortisol and aldosterone into the blood; the brake runs back up the left edge; level bars for ACTH, cortisol
//     and aldosterone sit on the right; the body (blood sugar, potassium) runs along the bottom.
//   - Steps 6, 7 and 11 loop: hormone flows down the chain and the brake signal flows back up. Steps 8, 9 and 10
//     play once: stress turns the chain up and the brake holds it; a level moves, the brake answers, CRH and ACTH
//     follow, and cortisol returns.
//   - Each "What changes it" step morphs from where it starts (normal, or the disease a drug treats) at t = 0 to the
//     changed loop at t = 1, over dashed marks for normal, and says on the picture which levels rise or fall and what
//     the brake does. Primary and secondary adrenal insufficiency differ by ACTH (high or low) and potassium.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease, span, svg, text, readout as readoutList } from '/lab/kit/draw.js';

const HM = window.HPAModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
// The settled axis, with the cortex's own aldosterone (what the aldosterone bar shows) beside the total signal M.
const view = p => ({ ...HM.settle(p), ald: Math.max(0, p.cap) * Math.max(0, p.aldo) });
const NORMAL_P = HM.build('normal');
const NV = view(NORMAL_P);
const REPLACE = { exoM: 0.8 };     // fludrocortisone at a replacing amount: aldosterone's effect back to about normal

/* ---------- Drawing pieces (the same as Lesson 14's) ---------- */
const AMBERF = '#f2a93b', GREENF = '#8fcf9d', BLOOD = '#f6dcd6', BAND = '#d1d8fd', BRAIN = '#e8cfe0', CORTEX = '#f2c27a', MEDULLA = '#b86b4b', KIDNEY = '#d99a86', SKIN = '#f3e4d6', URINE = '#f7eaa6';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
function flow(x1, y1, x2, y2, w, col, extra = '') {
  if (w < 0.5) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.05 + 8), hw = w * .85 + 6, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${col}" stroke-width="${f(w)}" fill="none"/>`
    + `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${col}"/></g>`;
}
function flowGhost(x1, y1, x2, y2, w) {
  if (w < 0.5) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.05 + 8), hw = w * .85 + 6, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
}
const widthOf = rel => clamp(7 + 4.4 * Math.log2(Math.max(rel, 1e-3)), 2, 16);
function dots(x1, y1, x2, y2, n, phase, col, r = 3.2) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const u = ((phase + i / n) % 1 + 1) % 1;
    s += `<circle cx="${f(lerp(x1, x2, u))}" cy="${f(lerp(y1, y2, u))}" r="${r}" fill="${col}" stroke="#fff" stroke-width="1.2" ${fade(Math.min(1, u * 6, (1 - u) * 6))}/>`;
  }
  return s;
}
// Unmoved: where a level sits. Moved: the way it went and where it ended ("↑ high", "↓ to usual", "↑ still low").
function moved(rel, from, band, words = ['high', 'low', 'usual'], room = 99) {
  const [hiW, loW, usW] = words;
  const where = rel > band[1] ? 'hi' : rel < band[0] ? 'lo' : 'in', was = from > band[1] ? 'hi' : from < band[0] ? 'lo' : 'in';
  const lvl = { hi: hiW, lo: loW, in: usW }[where];
  const r = Math.log(Math.max(rel, 1e-6) / Math.max(from, 1e-6));
  if (Math.abs(r) < 0.068) return { word: lvl, cls: 'xs muted' };
  const up = r > 0;
  let end = where === 'in' ? (was === 'in' ? usW : `to ${usW}`) : (up && where === 'lo') || (!up && where === 'hi') ? `still ${lvl}` : lvl;
  if (end.length + 2 > room) end = lvl;     // a long name beside the bar leaves room for the short form only
  return { word: `${up ? '↑' : '↓'} ${end}`, cls: 'xs b blue' };
}

/* ---------- The axis picture ---------- */
const CX = 150, BX = 30;
const HYP = { x0: 62, x1: 238, y0: 14, y1: 54 }, PIT = { x0: 96, x1: 204, y0: 102, y1: 142 };
const BL = { y0: 300, y1: 326 };
const MX0 = 320, MX1 = 470;
const ROWS = { acth: 180, cortisol: 230, ald: 280 };
const SIGNAL_SPAN = Math.log(5), BODY_SPAN = Math.log(1.8);
const USUAL = [0.75, 1.33];          // the illustrative usual zone for CRH, ACTH, cortisol and aldosterone (no source gives a range)
let BANDS = null;                    // blood sugar, sodium, potassium: from clinical-values.json, relative to the model's normal
const FALLBACK = { glucose: [0.82, 1.18], sodium: [0.966, 1.034], potassium: [0.82, 1.18] };
const bandOf = k => (k === 'glucose' || k === 'sodium' || k === 'potassium') ? (BANDS || FALLBACK)[k] : USUAL;
const spanOf = k => (k === 'glucose' || k === 'potassium' || k === 'sodium') ? BODY_SPAN : SIGNAL_SPAN;
const COL = { acth: C.blue, cortisol: C.amber, ald: C.green, glucose: C.ink, potassium: C.purple };
const CORTEX_D = 'M98 258 Q104 214 150 200 Q196 214 202 258 Z', MEDULLA_D = 'M126 258 Q130 236 150 226 Q170 236 174 258 Z';
function meter(key, x0, x1, y, rel, { name, nameCls, ghost = 1, from = 1 }) {
  const half = (x1 - x0) / 2 - 8, mid = (x0 + x1) / 2, sp = spanOf(key);
  const pos = r => mid + clamp(Math.log(Math.max(r, 1e-6)) / sp, -1, 1) * half;
  const [lo, hi] = bandOf(key), room = Math.floor(((x1 - x0) - name.length * 9.6 - 14) / 9.6);
  const m = moved(rel, from, [lo, hi], ['high', 'low', 'usual'], room);
  let s = text(x0, y - 12, name, nameCls, 'start') + text(x1, y - 12, m.word, m.cls, 'end');
  s += `<rect x="${x0}" y="${y - 4}" width="${x1 - x0}" height="8" rx="4" fill="#fff" stroke="${C.rule}"/>`;
  s += `<rect x="${f(pos(lo))}" y="${y - 4}" width="${f(pos(hi) - pos(lo))}" height="8" fill="${BAND}"/>`;
  if (ghost !== null) s += `<rect class="ghost" x="${f(pos(ghost) - 6)}" y="${y - 11}" width="12" height="22" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  s += `<rect data-level="${key}" data-rel="${rel.toFixed(3)}" x="${f(pos(rel) - 5)}" y="${y - 10}" width="10" height="20" fill="${COL[key]}" stroke="#fff" stroke-width="1.5"/>`;
  return `<g data-part="${key}">${s}</g>`;
}
const bolt = (x, y) => `<path d="M${x + 4} ${y} L${x - 8} ${y + 20} L${x} ${y + 20} L${x - 5} ${y + 36} L${x + 11} ${y + 13} L${x + 3} ${y + 13} L${x + 9} ${y} Z" fill="${AMBERF}" stroke="${C.red}" stroke-width="1.6"/>`;
const cross = (x, y, r = 5) => `<path d="M${f(x - r)} ${f(y - r)} L${f(x + r)} ${f(y + r)} M${f(x + r)} ${f(y - r)} L${f(x - r)} ${f(y + r)}" stroke="${C.red}" stroke-width="2.6" stroke-linecap="round"/>`;
const pill = (x, y, col, fill) => `<rect x="${x}" y="${y}" width="40" height="18" rx="9" fill="${fill}" stroke="${col}" stroke-width="2.2"/><path d="M${x + 20} ${y + 1} V${y + 17}" stroke="${col}" stroke-width="1.5"/>`;

/* axis(v, o): the axis at state v (see view()). Options:
   show     which parts to draw (all by default)
   ghost    the normal state, drawn as dashed marks (or null)
   from     the state the step started from, for the words beside each level bar
   marks    { tumor, damage, pitfail, block, drugG, drugM, stress }: 0 to 1, how far each has appeared
   crhWord, acthWord, brakeWord: words naming what moved (or '')
   pitCause, cortexCause: words beside the pituitary or the cortex
   note     one line along the bottom
   flowT    when set, dots flow along the chain and the brake (the phase of a loop)
   tests    box the ACTH and cortisol bars, and the body bars, as the key measures */
const ALL = ['hyp', 'crh', 'pit', 'acth', 'gland', 'out', 'blood', 'brake', 'meters', 'body'];
function axis(v, o = {}) {
  const show = new Set(o.show || ALL), has = k => show.has(k), g = o.ghost, mk = o.marks || {}, from = o.from || v;
  let s = '';
  // Nodes
  if (has('hyp')) {
    s += `<g data-part="hypothalamus"><rect x="${HYP.x0}" y="${HYP.y0}" width="${HYP.x1 - HYP.x0}" height="${HYP.y1 - HYP.y0}" rx="20" fill="${BRAIN}" stroke="${C.ink}" stroke-width="2"/>${text(CX, 40, 'hypothalamus', 'sm b')}</g>`;
    if (mk.stress > 0) s += `<g data-part="stress" ${fade(mk.stress)}>${bolt(256, 6)}${text(276, 40, 'stress', 'xs b red', 'start')}</g>`;
  }
  if (has('pit')) {
    s += `<g data-part="pituitary"><rect x="${PIT.x0}" y="${PIT.y0}" width="${PIT.x1 - PIT.x0}" height="${PIT.y1 - PIT.y0}" rx="20" fill="${BRAIN}" stroke="${C.ink}" stroke-width="2"/>${text(CX, 128, 'pituitary', 'sm b')}</g>`;
    if (mk.tumor > 0) s += `<g data-part="tumor" ${fade(mk.tumor)}><circle cx="198" cy="122" r="${f(6 + 10 * mk.tumor)}" fill="#f0b7ae" stroke="${C.red}" stroke-width="2.6"/></g>`;
    if (mk.pitfail > 0) s += `<g data-part="damage" ${fade(mk.pitfail)}>${[[103, 122], [197, 122]].map(([x, y]) => cross(x, y, 4.5)).join('')}</g>`;
    if (o.pitCause) { const [a, b, al] = o.pitCause; s += `<g ${fade(al)}>${text(222, 112, a, 'xs b red', 'start')}${b ? text(222, 132, b, 'xs b red', 'start') : ''}</g>`; }
  }
  if (has('gland')) {
    const dmg = clamp(mk.damage || 0, 0, 1);
    s += `<g data-part="adrenal cortex"><path d="${CORTEX_D}" fill="${CORTEX}" fill-opacity="${f(1 - .65 * dmg)}" stroke="${C.ink}" stroke-width="2"/><path d="${MEDULLA_D}" fill="${MEDULLA}" stroke="${C.ink}" stroke-width="1.5"/>`
      + `${text(214, 216, 'adrenal', 'sm b', 'start')}${text(214, 238, 'cortex', 'sm b', 'start')}</g>`;
    if (dmg > 0) s += `<g data-part="damage" ${fade(dmg)}>${[[116, 246], [184, 246], [150, 214], [132, 230], [168, 230]].map(([x, y]) => cross(x, y)).join('')}</g>`;
    if (mk.block > 0) s += `<g data-part="block" ${fade(mk.block)}>${[[120, 244], [180, 244]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff" fill-opacity=".7" stroke="${C.red}" stroke-width="3"/><path d="M${x - 7} ${y + 7} L${x + 7} ${y - 7}" stroke="${C.red}" stroke-width="3"/>`).join('')}</g>`;
    if (o.cortexCause) { const [a, al] = o.cortexCause; s += `<g ${fade(al)}>${text(214, 261, a, 'xs b red', 'start')}</g>`; }
  }
  // The chain's arrows
  const links = [];
  if (has('crh')) links.push(['crh', CX, 57, CX, 100, widthOf(v.crh), C.ink, g && widthOf(g.crh)]);
  if (has('acth')) links.push(['acth', CX, 145, CX, 202, widthOf(v.acth), C.blue, g && widthOf(g.acth)]);
  if (has('out')) {
    links.push(['cortisol', 134, 260, 134, 299, widthOf(v.release ?? v.cortisol), C.amber, g && widthOf(g.cortisol)]);
    links.push(['aldo', 170, 260, 170, 299, widthOf(v.ald), C.green, g && widthOf(g.ald)]);
  }
  for (const [k, x1, y1, x2, y2, w, col] of links) s += flow(x1, y1, x2, y2, w, col, `data-part="${k}" data-flow="${k}" data-w="${f(w)}"`);
  if (g) s += `<g class="ghost" data-ghost="normal">${links.map(([, x1, y1, x2, y2, , , gw]) => flowGhost(x1, y1, x2, y2, gw)).join('')}</g>`;
  if (has('crh')) s += text(166, 84, 'CRH', 'xs b', 'start') + (o.crhWord ? text(208, 84, o.crhWord, 'xs b blue', 'start') : '');
  if (has('acth')) s += text(166, 182, 'ACTH', 'xs b blue', 'start') + (o.acthWord ? text(218, 182, o.acthWord, 'xs b blue', 'start') : '');
  if (has('out')) s += `<g data-part="cortisol">${text(124, 290, 'cortisol', 'xs b amber', 'end')}</g><g data-part="aldo">${text(182, 290, 'aldosterone', 'xs b green', 'start')}</g>`;
  // The blood, with any steroid tablet taken
  if (has('blood')) {
    s += `<g data-part="blood"><rect x="12" y="${BL.y0}" width="456" height="${BL.y1 - BL.y0}" rx="13" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>${text(458, BL.y1 - 7, 'blood', 'xs b red', 'end')}`;
    const n = clamp(Math.round(9 * v.cortisol), 1, 24), nd = clamp(Math.round(5 * (v.p.exoG || 0)), 0, 12);
    for (let i = 0; i < n; i++) s += `<circle cx="${f(200 + ((i * 0.6180339) % 1) * 190)}" cy="${f(BL.y0 + 7 + ((i * 0.381966) % 1) * 12)}" r="3.6" fill="${AMBERF}" stroke="${C.amber}" stroke-width="1.2"/>`;
    for (let i = 0; i < nd; i++) { const x = 206 + ((i * 0.7548777) % 1) * 180, y = BL.y0 + 8 + ((i * 0.5698403) % 1) * 10; s += `<path d="M${f(x)} ${f(y - 5)} L${f(x + 5)} ${f(y)} L${f(x)} ${f(y + 5)} L${f(x - 5)} ${f(y)} Z" fill="${C.amber}"/>`; }
    s += '</g>';
    if (mk.drugG > 0) s += `<g data-part="tablet" ${fade(mk.drugG)}>${pill(50, BL.y0 + 4, C.amber, AMBERF)}</g>`;
    if (mk.drugM > 0) s += `<g data-part="tablet" ${fade(mk.drugM)}>${pill(50, BL.y0 + 4, C.green, GREENF)}</g>`;
  }
  // The brake: the glucocorticoid in the blood (the body's own cortisol plus any drug) tells the hypothalamus and pituitary to release less
  if (has('brake')) {
    const w = clamp(2 + 3 * v.E, 2, 10);
    if (g) { const h = clamp(2 + 3 * g.E, 2, 10) / 2; s += `<g class="ghost" data-ghost="normal"><path d="M${f(BX - h)} ${BL.y0} V40 M${f(BX + h)} ${BL.y0} V40" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="4 3" fill="none"/></g>`; }
    s += `<g data-part="brake" data-flow="brake" data-w="${f(w)}"><path d="M${BX} ${BL.y0 + 2} V34 H${HYP.x0 - 6} M${BX} ${PIT.y0 + 20} H${PIT.x0 - 6}" fill="none" stroke="${C.amber}" stroke-width="${f(w)}" stroke-linejoin="round"/>`
      + `<path d="M${HYP.x0 - 4} 22 V46 M${PIT.x0 - 4} ${PIT.y0 + 8} V${PIT.y0 + 32}" stroke="${C.amber}" stroke-width="5"/>`
      + text(48, 162, 'brake', 'xs b amber', 'start') + (o.brakeWord ? text(48, 184, o.brakeWord, 'xs b blue', 'start') : '') + '</g>';
  }
  if (o.flowT !== undefined) {
    const ph = o.flowT;
    if (has('crh')) s += dots(CX, 60, CX, 96, clamp(Math.round(3 * v.crh), 1, 7), ph, C.ink);
    if (has('acth')) s += dots(CX, 148, CX, 196, clamp(Math.round(3 * v.acth), 1, 8), ph, C.blue);
    if (has('out')) s += dots(134, 262, 134, 294, clamp(Math.round(3 * v.cortisol), 1, 7), ph, C.amber) + dots(170, 262, 170, 294, clamp(Math.round(3 * v.ald), 1, 7), ph, C.green);
    if (has('brake')) s += dots(BX, BL.y0 - 4, BX, 40, clamp(Math.round(4 * v.E), 1, 10), ph, AMBERF, 3);
  }
  // The blood tests
  if (has('meters')) {
    s += text(MX0, 138, 'blood tests', 'xs b muted', 'start');
    if (has('acth')) s += meter('acth', MX0, MX1, ROWS.acth, v.acth, { name: 'ACTH', nameCls: 'xs b blue', ghost: g ? g.acth : null, from: from.acth });
    s += meter('cortisol', MX0, MX1, ROWS.cortisol, v.cortisol, { name: 'cortisol', nameCls: 'xs b amber', ghost: g ? g.cortisol : null, from: from.cortisol });
    s += meter('ald', MX0, MX1, ROWS.ald, v.ald, { name: 'aldosterone', nameCls: 'xs b green', ghost: g ? g.ald : null, from: from.ald });
    if (o.tests) s += `<g data-part="tests"><rect x="${MX0 - 10}" y="${ROWS.acth - 34}" width="${MX1 - MX0 + 16}" height="${ROWS.cortisol - ROWS.acth + 52}" fill="none" stroke="${C.blue}" stroke-width="2.5"/></g>`;
  }
  // The body: blood sugar (from cortisol) and potassium (from aldosterone)
  if (has('body')) {
    s += `<g data-part="effects sugar">${meter('glucose', 40, 296, 372, v.glucose, { name: 'blood sugar', nameCls: 'xs b', ghost: g ? g.glucose : null, from: from.glucose })}</g>`;
    s += `<g data-part="effects potassium">${meter('potassium', MX0, MX1, 372, v.potassium, { name: 'potassium', nameCls: 'xs b purple', ghost: g ? g.potassium : null, from: from.potassium })}</g>`;
    if (o.tests) s += `<rect x="30" y="338" width="446" height="48" fill="none" stroke="${C.blue}" stroke-width="2.5" stroke-dasharray="8 4"/>`;
  }
  if (o.note) s += text(12, 410, o.note, 'xs b blue', 'start');
  return s;
}
const AXIS_H = 416;

/* ---------- Build the loop: the step pictures ---------- */
function kidneyAdrenal(cx, cy, s, labels = false) {
  // A kidney with its adrenal gland on top like a cap: cortex outside, medulla inside.
  let b = `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(s)})">`;
  b += `<path d="M0 -20 C50 -22 58 90 2 92 C-34 93 -50 66 -38 46 C-32 36 -32 28 -38 20 C-46 4 -28 -20 0 -20 Z" fill="${KIDNEY}" stroke="${C.ink}" stroke-width="${f(2 / s)}"/>`;
  b += `<g data-part="adrenal cortex"><path d="M-40 -16 Q-36 -58 0 -74 Q36 -58 40 -16 Z" fill="${CORTEX}" stroke="${C.ink}" stroke-width="${f(2 / s)}"/></g>`;
  b += `<g data-part="medulla"><path d="M-20 -16 Q-17 -40 0 -50 Q17 -40 20 -16 Z" fill="${MEDULLA}" stroke="${C.ink}" stroke-width="${f(1.5 / s)}"/></g>`;
  return b + '</g>';
}
function glandsPicture() {
  let b = `<rect x="20" y="60" width="130" height="270" rx="54" fill="${SKIN}" stroke="${C.rule}" stroke-width="1.5"/>` + text(85, 92, 'the body', 'xs muted');
  b += `<g data-part="adrenal">${kidneyAdrenal(64, 210, .36)}${kidneyAdrenal(108, 210, .36)}</g>`;
  b += `<path d="M124 186 L200 150" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  b += kidneyAdrenal(268, 206, 1.2);
  b += `<path d="M300 136 L342 104" stroke="${C.muted}" stroke-width="1.2"/>` + text(346, 98, 'cortex', 'sm b', 'start') + text(346, 120, 'outer layer', 'xs', 'start');
  b += `<path d="M280 160 L342 170" stroke="${C.muted}" stroke-width="1.2"/>` + text(346, 168, 'medulla', 'sm b', 'start') + text(346, 190, 'inner core', 'xs', 'start');
  b += text(270, 336, 'kidney', 'sm b');
  b += text(20, 26, 'adrenal gland: one on each kidney', 'sm b', 'start');
  return b;
}
// Moving: the cortex builds cortisol from cholesterol and releases it into the blood.
function cortisolPicture(t) {
  let b = `<g data-part="cortex adrenal"><path d="M140 170 Q150 78 240 46 Q330 78 340 170 Z" fill="${CORTEX}" stroke="${C.ink}" stroke-width="2"/></g>`;
  b += `<path d="M190 170 Q196 118 240 96 Q284 118 290 170 Z" fill="${MEDULLA}" stroke="${C.ink}" stroke-width="1.5"/>`;
  b += text(240, 196, 'adrenal cortex', 'sm b');
  b += `<g data-part="cholesterol">${text(20, 70, 'cholesterol', 'xs b', 'start')}${text(20, 92, 'a fatty substance', 'xs', 'start')}`;
  b += flow(70, 106, 150, 132, 5, C.muted) + '</g>';
  b += `<g data-part="cortisol">${flow(240, 206, 240, 262, 9, C.amber)}${text(258, 244, 'cortisol, a steroid', 'xs b amber', 'start')}</g>`;
  b += `<rect x="12" y="266" width="456" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(458, 287, 'blood', 'xs b red', 'end');
  for (let i = 0; i < 9; i++) {
    const u = ((t * 2 + i / 9) % 1);
    b += `<circle cx="${f(240 + (u - .5) * 400 * (i % 2 ? 1 : -1))}" cy="${f(276 + (i % 3) * 5)}" r="4" fill="${AMBERF}" stroke="${C.amber}" stroke-width="1.2" ${fade(Math.min(1, (1 - Math.abs(u - .5) * 2) * 4))}/>`;
  }
  b += text(240, 330, 'carried to cells all over the body', 'xs');
  return b;
}
// Moving: cortisol rises and falls; the liver's new glucose, and so blood sugar, follows it.
function fuelPicture(t) {
  const E = t < .5 ? lerp(1, 1.8, ease.inOut(span(t, .08, .38))) : lerp(1.8, 1, ease.inOut(span(t, .58, .9)));
  const gl = Math.pow(E, 0.4);
  let b = `<g data-part="cortisol">${text(20, 40, 'cortisol', 'xs b amber', 'start')}<rect x="20" y="52" width="200" height="10" rx="5" fill="#fff" stroke="${C.rule}"/><rect x="20" y="52" width="${f(200 * E / 2)}" height="10" rx="5" fill="${C.amber}"/></g>`;
  b += `<path d="M260 70 C280 40 360 40 420 52 C450 58 456 84 440 104 C420 128 340 140 290 124 C262 114 252 90 260 70 Z" fill="#c98b7a" stroke="${C.ink}" stroke-width="2"/>` + text(352, 92, 'liver', 'sm b');
  b += flow(120, 72, 252, 82, 4 + 3 * E, C.amber);
  b += text(352, 164, 'makes new glucose,', 'xs b', 'middle') + text(352, 186, 'partly from muscle protein', 'xs', 'middle');
  b += `<g data-part="sugar">${flow(352, 196, 352, 238, 4 + 5 * (gl - .6), C.ink)}`;
  b += `<rect x="12" y="242" width="456" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(458, 263, 'blood', 'xs b red', 'end');
  const n = clamp(Math.round(10 * gl), 3, 22);
  for (let i = 0; i < n; i++) { const x = 40 + ((i * 0.6180339) % 1) * 330, y = 250 + ((i * 0.381966) % 1) * 14; b += `<path d="M${f(x)} ${f(y - 4.5)} l4 2.3 v4.5 l-4 2.3 l-4 -2.3 v-4.5 Z" fill="#fff" stroke="${C.ink}" stroke-width="1.3"/>`; }
  const half = 180, mid = 240, pos = r => mid + clamp(Math.log(r) / BODY_SPAN, -1, 1) * half, [lo, hi] = bandOf('glucose');
  b += text(60, 316, 'blood sugar', 'xs b', 'start') + `<rect x="${mid - half}" y="326" width="${half * 2}" height="8" rx="4" fill="#fff" stroke="${C.rule}"/><rect x="${f(pos(lo))}" y="326" width="${f(pos(hi) - pos(lo))}" height="8" fill="${BAND}"/>`;
  b += `<rect x="${f(pos(gl) - 5)}" y="320" width="10" height="20" fill="${C.ink}" stroke="#fff" stroke-width="1.5"/></g>`;
  b += text(240, 372, E > 1.2 ? 'more cortisol: blood sugar rises' : 'usual cortisol: usual blood sugar', 'sm b blue');
  return b;
}
// Moving: cortisol rises, and the flame of inflammation shrinks; it falls, and the flame flares.
function inflamPicture(t) {
  const E = t < .45 ? lerp(1, 2, ease.inOut(span(t, .06, .35))) : t < .8 ? lerp(2, .5, ease.inOut(span(t, .45, .7))) : lerp(.5, 1, ease.inOut(span(t, .82, .96)));
  const inf = clamp(Math.pow(E, -0.9), .3, 2.2), fs = clamp(.45 + .55 * inf, .35, 1.6);
  let b = `<g data-part="cortisol">${text(40, 46, 'cortisol', 'xs b amber', 'start')}<rect x="40" y="58" width="400" height="10" rx="5" fill="#fff" stroke="${C.rule}"/><rect x="40" y="58" width="${f(400 * clamp(E / 2.2, 0, 1))}" height="10" rx="5" fill="${C.amber}"/></g>`;
  b += `<g data-part="flame"><path transform="translate(240 300) scale(${f(fs * 3.2)})" d="M0 0 C-15 0 -19 -12 -13 -22 C-9 -29 -4 -27 -2 -36 C7 -28 17 -19 15 -8 C14 -3 8 0 0 0 Z" fill="#e66a55" stroke="${C.red}" stroke-width="${f(1.5 / (fs * 3.2))}"/>`;
  b += `<path transform="translate(256 300) scale(${f(3.2)})" d="M0 0 C-15 0 -19 -12 -13 -22 C-9 -29 -4 -27 -2 -36 C7 -28 17 -19 15 -8 C14 -3 8 0 0 0 Z" fill="none" stroke="${C.ink}" stroke-width=".45" stroke-dasharray="1.4 1.2"/></g>`;
  b += text(240, 334, 'inflammation: redness, heat, swelling', 'xs b');
  b += text(410, 200, 'dashed:', 'xs muted', 'end') + text(410, 222, 'usual size', 'xs muted', 'end');
  b += text(240, 372, E > 1.25 ? 'more cortisol: calmer' : E < .8 ? 'less cortisol: fiercer' : 'usual cortisol: usual', 'sm b blue');
  return b;
}
// Moving: aldosterone tells the kidney to keep sodium (back to the blood) and pass potassium (out in urine).
function aldoPicture(t) {
  let b = `<g data-part="aldo"><path d="M44 120 Q50 70 100 52 Q150 70 156 120 Z" fill="${CORTEX}" stroke="${C.ink}" stroke-width="2"/>${text(100, 144, 'adrenal cortex', 'xs b')}`;
  b += flow(160, 92, 236, 118, 7, C.green) + text(196, 82, 'aldosterone', 'xs b green') + '</g>';
  b += `<path d="M300 60 C360 58 372 190 304 194 C262 196 244 164 256 140 C262 128 262 118 256 108 C248 90 266 62 300 60 Z" fill="${KIDNEY}" stroke="${C.ink}" stroke-width="2"/>` + text(316, 130, 'kidney', 'sm b');
  b += `<rect x="12" y="236" width="300" height="30" rx="15" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(26, 257, 'blood', 'xs b red', 'start');
  b += `<path d="M412 214 C412 200 422 190 432 180 C442 190 452 200 452 214 A20 20 0 0 1 412 214 Z" fill="${URINE}" stroke="${C.ink}" stroke-width="1.6"/>` + text(432, 262, 'urine', 'xs b');
  // Sodium dots ride back into the blood; potassium squares ride out into the urine.
  let na = '', k = '';
  for (let i = 0; i < 5; i++) {
    const u = (t * 2 + i / 5) % 1;
    na += `<circle cx="${f(lerp(290, 200, u))}" cy="${f(lerp(196, 250, u))}" r="5" fill="${GREENF}" stroke="${C.green}" stroke-width="1.6" ${fade(Math.min(1, u * 5, (1 - u) * 5))}/>`;
    k += `<rect x="${f(lerp(352, 426, u) - 4)}" y="${f(lerp(160, 204, u) - 4)}" width="8" height="8" fill="${C.purple}" ${fade(Math.min(1, u * 5, (1 - u) * 5))}/>`;
  }
  b += `<g data-part="sodium">${na}${text(150, 214, 'sodium kept', 'xs b green', 'end')}</g>`;
  b += `<g data-part="potassium">${k}${text(470, 152, 'potassium', 'xs b purple', 'end')}${text(470, 174, 'passed out', 'xs b purple', 'end')}</g>`;
  b += text(20, 316, 'Aldosterone answers mainly to the kidney’s', 'xs', 'start') + text(20, 338, 'renin system, not much to the brain.', 'xs', 'start');
  return b;
}

/* ---------- The feedback, played once ---------- */
// Cortisol is pushed away from normal; the brake answers at once; CRH and ACTH follow; the cortex follows them and cortisol returns.
function feedback(dir, t) {
  const far = dir > 0 ? 1.8 : .5;
  const E = t < .5 ? lerp(1, far, ease.inOut(span(t, .08, .26))) : lerp(far, 1, ease.inOut(span(t, .6, .92)));
  const lagE = t < .5 ? lerp(1, far, ease.inOut(span(t, .26, .44))) : lerp(far, 1, ease.inOut(span(t, .62, .94)));
  const q = HM.open(NORMAL_P, lagE), burst = dir > 0 ? 2.2 : .35;
  const out = t < .28 ? lerp(1, burst, ease.inOut(span(t, .04, .18))) : lerp(burst, HM.drive(q.acth), ease.inOut(span(t, .28, .42)));
  const v = { ...NV, E, cortisol: E, release: out, crh: q.crh, acth: q.acth, glucose: Math.pow(E, .4) };
  const up = dir > 0;
  const steps = [
    [span(t, .1, .18), up ? '1  a burst from the cortex: cortisol runs high' : '1  the cortex dips: cortisol runs low'],
    [span(t, .2, .28), up ? '2  the brake tightens' : '2  the brake eases'],
    [span(t, .32, .42), up ? '3  CRH and ACTH fall' : '3  CRH and ACTH rise'],
    [span(t, .58, .68), up ? '4  the cortex slows: cortisol falls back' : '4  the cortex speeds up: cortisol climbs back'],
  ];
  // The cortisol arrow shows what the cortex puts out at this moment (the burst, then what ACTH asks for); the bar shows the blood level.
  let b = axis(v, { show: ['hyp', 'crh', 'pit', 'acth', 'gland', 'out', 'blood', 'brake', 'meters'], ghost: NV, from: NV });
  b += steps.map(([a, w], i) => `<g ${fade(a)}>${text(12, 348 + i * 22, w, i === 3 ? 'xs b blue' : 'xs b', 'start')}</g>`).join('');
  return b;
}
// Long stress: the hypothalamus is pushed, CRH jumps, ACTH and cortisol follow, and the brake holds the rise in check.
function stressPicture(t) {
  const fin = view({ ...NORMAL_P, stress: 2.5 });
  const s = lerp(1, 2.5, ease.inOut(span(t, .08, .26)));
  const E = lerp(1, fin.E, ease.inOut(span(t, .32, .7)));
  const crh = s / E, acth = crh / Math.sqrt(E);
  const v = { ...NV, E, cortisol: E, crh, acth, glucose: Math.pow(E, .4), p: { ...NORMAL_P, stress: s } };
  const steps = [
    [span(t, .1, .2), '1  stress: the hypothalamus sends more CRH'],
    [span(t, .24, .34), '2  the pituitary sends more ACTH'],
    [span(t, .4, .52), '3  more cortisol, and blood sugar climbs'],
    [span(t, .66, .78), '4  the brake holds the rise in check'],
  ];
  let b = axis(v, { show: ['hyp', 'crh', 'pit', 'acth', 'gland', 'out', 'blood', 'brake', 'meters'], ghost: NV, from: NV, marks: { stress: span(t, .05, .15) } });
  b += steps.map(([a, w], i) => `<g ${fade(a)}>${text(12, 348 + i * 22, w, i === 3 ? 'xs b blue' : 'xs b', 'start')}</g>`).join('');
  return b;
}

/* ---------- What changes it ---------- */
const CHANGES = {
  cushing: { from: () => HM.build('normal'), to: () => HM.build('cushing'), marks: k => ({ tumor: k }), pitCause: ['tumor:', 'extra ACTH'], note: 'the brake tightens: CRH falls, but ACTH stays high' },
  addison: { from: () => HM.build('normal'), to: () => HM.build('addison'), marks: k => ({ damage: k }), cortexCause: 'destroyed', note: 'cortisol low, so the brake eases: CRH and ACTH climb' },
  secondary: { from: () => HM.build('normal'), to: () => HM.build('secondary'), marks: k => ({ pitfail: k }), pitCause: ['damaged', ''], note: 'too little ACTH: cortisol falls, aldosterone carries on' },
  glucocorticoid: { from: () => HM.build('normal'), to: () => HM.build('normal', ['glucocorticoid']), marks: k => ({ drugG: k }), note: 'a steroid tablet tightens the brake: own cortisol falls' },
  mineralocorticoid: { from: () => HM.build('addison'), to: () => ({ ...HM.build('addison'), ...REPLACE }), marks: k => ({ damage: 1, drugM: k }), cortexCause: 'destroyed', note: 'the tablet acts like aldosterone: potassium falls back' },
  inhibitor: { from: () => HM.build('cushing'), to: () => HM.build('cushing', ['inhibitor']), marks: k => ({ tumor: 1, block: k }), cortexCause: 'blocked', note: 'less cortisol eases the brake: ACTH climbs higher still' },
};
const TITLE = { cushing: 'Cushing’s disease', addison: 'Addison’s disease', secondary: 'Secondary adrenal insufficiency', glucocorticoid: 'A glucocorticoid drug', mineralocorticoid: 'A mineralocorticoid drug for Addison’s disease', inhibitor: 'A steroid synthesis inhibitor for Cushing’s disease' };
const AGAINST = { mineralocorticoid: 'untreated Addison’s disease', inhibitor: 'untreated Cushing’s disease' };
const WHERE = {
  cushing: 'A red tumor swells on the pituitary and the blue ACTH arrow thickens, ignoring the brake. The cortex answers with a thick cortisol arrow, ACTH and cortisol climb above their usual zones and blood sugar rises. The brake line thickens and the CRH arrow thins, while aldosterone and potassium stay usual.',
  addison: 'Red crosses mark the destroyed adrenal cortex, which fades. Its cortisol and aldosterone arrows thin and both bars fall below their usual zones. The brake line thins, the CRH and ACTH arrows swell and ACTH climbs high. Blood sugar falls and potassium rises above its band.',
  secondary: 'Red crosses mark the damaged pituitary. The ACTH arrow thins and ACTH falls low, so the healthy cortex sends out a thin cortisol arrow and cortisol falls low; blood sugar falls. The aldosterone arrow keeps its normal width and potassium stays in its band. The brake line thins and the CRH arrow swells.',
  glucocorticoid: 'An amber steroid tablet sits in the blood and amber diamonds of the drug fill it. The brake line thickens with the drug, the CRH and ACTH arrows shrink to threads, ACTH falls low and the body’s own cortisol arrow thins as its bar falls below the usual zone. Blood sugar rises.',
  mineralocorticoid: 'The cortex stays destroyed. A green tablet acting like aldosterone sits in the blood; the body’s own aldosterone stays low, but potassium falls back into its band. Cortisol stays low, ACTH stays high and blood sugar stays low.',
  inhibitor: 'Red block signs appear over the cortex. Its cortisol arrow thins and cortisol falls back into its usual zone, with blood sugar. The brake line thins, the CRH arrow widens back and ACTH, already high from the tumor, climbs higher still.',
};
function change(kind) {
  const c = CHANGES[kind];
  return {
    duration: 2800,
    render(t) {
      const p0 = c.from(), start = view(p0), k = ease.inOut(t);
      const v = view(HM.mix(p0, c.to(), k)), a = span(t, .5, .85), km = Math.min(1, k * 1.6);
      const word = (x, x0) => Math.abs(Math.log(x / x0)) > .2 ? (x > x0 ? '↑ more' : '↓ less') : '';
      const opt = {
        ghost: NV, from: start, marks: c.marks(km), crhWord: word(v.crh, start.crh), acthWord: word(v.acth, start.acth),
        brakeWord: Math.abs(v.E - start.E) > .15 ? (v.E > start.E ? 'tightens' : 'eases') : '',
        pitCause: c.pitCause ? [...c.pitCause, km] : null, cortexCause: c.cortexCause ? [c.cortexCause, km] : null, note: a > 0 ? c.note : '',
      };
      const label = `${TITLE[kind]}, drawn over dashed marks for normal. ${WHERE[kind]}`;
      return { svg: svg(label, axis(v, opt), { h: AXIS_H }), readout: readoutOf(v, start, AGAINST[kind] ? `Compared with ${AGAINST[kind]}` : 'Compared with normal') };
    }
  };
}
function trend(a, b, up = 'higher', down = 'lower') { const r = (a + 1e-6) / (b + 1e-6); return r > 1.07 ? ['up', up] : r < .935 ? ['down', down] : ['same', 'about the same']; }
const ROW_NAMES = [['crh', 'CRH'], ['acth', 'ACTH'], ['cortisol', 'Cortisol made by the body'], ['ald', 'Aldosterone made by the body'], ['glucose', 'Blood sugar'], ['potassium', 'Potassium']];
const compareRows = (v, ref) => ROW_NAMES.map(([k, name]) => [name, ...trend(v[k], ref[k])]);
const readoutOf = (v, ref, head) => readoutList(compareRows(v, ref), head);
const describe = (v, ref) => compareRows(v, ref).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const loopScene = (label, opt, ms = 3000) => ({ duration: ms, loop: true, render: t => svg(label, axis(NV, { ...opt, flowT: t * 2 }), { h: opt.h || AXIS_H }) });
const scenes = {
  glands: () => svg('A body in outline with two kidneys, each with an adrenal gland on top like a cap. One is enlarged: an outer layer, the cortex, wrapped around an inner core, the medulla, sitting on the kidney.', glandsPicture(), { h: 346 }),
  cortisol: { duration: 4000, loop: true, render: t => svg('The adrenal cortex, built up from cholesterol, a fat, sends an amber arrow of cortisol, a steroid, into the blood, where amber cortisol dots flow out to cells all over the body.', cortisolPicture(t), { h: 346 }) },
  fuel: { duration: 6000, render: t => svg('A cortisol bar rises and then falls back. As it rises, a thicker arrow runs from cortisol to the liver, which makes new glucose, partly from muscle protein; more white glucose dots enter the blood and the blood sugar bar slides up, then both settle back.', fuelPicture(t), { h: 390 }) },
  inflam: { duration: 7000, render: t => svg('A cortisol bar and a red flame of inflammation over a dashed outline of its usual size. As cortisol rises the flame shrinks, calmer; as cortisol falls the flame flares, fiercer; then both return to usual.', inflamPicture(t), { h: 390 }) },
  aldo: { duration: 4000, loop: true, render: t => svg('The adrenal cortex sends a green aldosterone arrow to the kidney. Green sodium dots flow from the kidney back into the blood, kept, while purple potassium squares flow out into a drop of urine. A note says aldosterone answers mainly to the kidney’s renin system, not much to the brain.', aldoPicture(t), { h: 352 }) },
  pituitary: loopScene('The pituitary sends a blue ACTH arrow down to the adrenal cortex, which sends an amber cortisol arrow and a green aldosterone arrow into the blood; dots flow down them. On the right, blood tests for ACTH, cortisol and aldosterone each sit inside a shaded usual zone.', { show: ['pit', 'acth', 'gland', 'out', 'blood', 'meters'] }),
  hypothalamus: loopScene('Above the pituitary sits the hypothalamus. A dark CRH arrow runs from it to the pituitary, which sends the blue ACTH arrow on to the adrenal cortex, which sends cortisol and aldosterone into the blood: a chain from brain to gland, with dots flowing down it.', { show: ['hyp', 'crh', 'pit', 'acth', 'gland', 'out', 'blood', 'meters'] }),
  stress: { duration: 7500, render: t => svg('Long stress, played once. A lightning bolt marks stress at the hypothalamus; the CRH arrow swells, then the ACTH arrow, then the cortisol arrow, and the ACTH and cortisol bars climb above their usual zones. The amber brake line thickens and holds the rise in check, so CRH settles a little lower than its first jump. Four numbered lines name the steps.', stressPicture(t), { h: 420 }) },
  brake: { duration: 7500, render: t => svg('Negative feedback, played once. The cortex puts out a burst and cortisol runs high, above its usual zone; the amber brake line thickens; the CRH and ACTH arrows thin and ACTH falls low; then the cortex slows, cortisol falls back and everything returns to normal. Four numbered lines name the steps.', feedback(1, t), { h: 420 }) },
  lowbrake: { duration: 7500, render: t => svg('The feedback the other way. The cortex dips and cortisol runs low; the brake line thins; the CRH and ACTH arrows swell and ACTH rises high; then the cortex speeds up, cortisol climbs back and everything returns to normal. Four numbered lines name the steps.', feedback(-1, t), { h: 420 }) },
  whole: { duration: 3000, loop: true, render: t => svg('The whole axis. The hypothalamus sends CRH to the pituitary, the pituitary sends ACTH to the adrenal cortex, and the cortex sends cortisol and aldosterone into the blood, which set blood sugar and potassium. An amber brake line runs from the blood back up to the pituitary and hypothalamus. A blue box marks the ACTH and cortisol bars, read together, and a dashed box marks blood sugar and potassium, the routine blood tests.', axis(NV, { flowT: t * 2, tests: true }), { h: AXIS_H }) },
  cushing: change('cushing'),
  addison: change('addison'),
  secondary: change('secondary'),
  glucocorticoid: change('glucocorticoid'),
  mineralocorticoid: change('mineralocorticoid'),
  inhibitor: change('inhibitor'),
};

/* ---------- Words for the sliders ---------- */
const capWords = v => v < 0.2 ? 'very little' : v < 0.6 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : 'more than normal';
const stressWords = v => v < 0.75 ? 'calmer than usual' : v <= 1.25 ? 'usual' : v <= 2 ? 'raised' : 'severe';
const tumorWords = v => v < 0.05 ? 'none' : v < 1.2 ? 'small' : v < 2.5 ? 'large' : 'very large';
const pitWords = v => v < 0.2 ? 'very little' : v < 0.6 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : 'more than normal';

/* ---------- Where a level sits against its band ----------
   The sources give only directions for diseases and drugs. In the Clinical values tab the model's level is printed as
   an illustrative number: its relative level × the middle of the quoted range, at the source's precision, always
   labelled as a teaching-model value, never as a sourced one. */
let data = null;
const SIGNALS = ['crh', 'acth', 'cortisol'], BLOODK = ['glucose', 'sodium', 'potassium'];
const LABEL = { crh: 'CRH', acth: 'ACTH', cortisol: 'cortisol', glucose: 'glucose', sodium: 'sodium', potassium: 'potassium' };
const NAME = { crh: 'CRH', acth: 'ACTH', cortisol: 'Cortisol', glucose: 'Glucose', sodium: 'Sodium', potassium: 'Potassium' };
const gyRaw = (k, rel) => Math.log(Math.max(rel, 1e-6)) / spanOf(k);
const place = (k, rel) => { const [lo, hi] = bandOf(k); return rel > hi + 1e-9 ? 'above' : rel < lo - 1e-9 ? 'below' : 'inside'; };
const SIGNAL_WORD = { above: 'high', below: 'low', inside: 'usual' };
const MID = {}, DEC = {};
const modelNumber = (k, rel) => (MID[k] * rel).toFixed(DEC[k]);
const PLACE_ARROW = { inside: '↔', above: '↑', 'far above': '⇈', below: '↓', 'far below': '⇊' };
function farPlace(k, rel) { const w = place(k, rel); return w !== 'inside' && Math.abs(gyRaw(k, rel)) >= 1 ? `far ${w}` : w; }
const levelWords = (k, rel, band = 'its healthy band') => { const w = farPlace(k, rel); return w === 'inside' ? `inside ${band}` : `${w} ${band}`; };
function bandWords(v) {
  return [...SIGNALS.map(k => `${NAME[k]} runs ${SIGNAL_WORD[place(k, v[k])]}.`), ...BLOODK.map(k => { const w = place(k, v[k]); return w === 'inside' ? `${NAME[k]} sits inside its healthy band.` : `${NAME[k]} sits ${w} its healthy band.`; })].join(' ');
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const barX = (k, rel) => f(200 + clamp(gyRaw(k, rel), -1, 1) * 170);
// Print a range as the source does: the high end keeps the low end's decimals (3.5–5.0).
const rangeText = v => { const d = (String(v.low).split('.')[1] || '').length; return `${v.low}–${v.high.toFixed(d)}`; };
const MARKS_OF = { cushing: { tumor: 1 }, addison: { damage: 1 }, glucocorticoid: { drugG: 1 }, mineralocorticoid: { drugM: 1 }, inhibitor: { block: 1 } };
function stateParams(id) {
  if (['cushing', 'addison', 'hyperaldo', 'hypoaldo', 'secondary'].includes(id)) return HM.build(id);
  if (HM.DRUGS[id]) return HM.build('normal', [id]);
  return HM.build('normal');
}
const cv = { state: 'normal', p: HM.build('normal'), custom: false };
function updateClinical() {
  $('#clinical-cap').value = cv.p.cap; $('#clinical-cap-label').textContent = capWords(cv.p.cap);
  $('#clinical-stress').value = cv.p.stress; $('#clinical-stress-label').textContent = stressWords(cv.p.stress);
  const cur = view(cv.p);
  const st = data?.states.find(s => s.id === cv.state);
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#clinical-visual').innerHTML = svg(label, axis(cur, { ghost: NV, from: NV, marks: cv.custom ? {} : (MARKS_OF[cv.state] || {}) }), { h: AXIS_H });
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}` : 'No direction shown for this state; see the note under the selector') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const k = v.modelKey, rel = cur[k], where = farPlace(k, rel);
    const reading = row.querySelector('.reading');
    reading.textContent = `${PLACE_ARROW[where]} ${modelNumber(k, rel)} ${v.unit}`;
    reading.dataset.rel = rel.toFixed(4);
    const x = barX(k, rel), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${where} typical range${where.startsWith('far') ? ', off the end of the bar' : ''}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const rx = barX(k, NV[k]);
      cmp.textContent = `Dashed line: model, normal (${place(k, NV[k])} typical range)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
for (const k of ['cap', 'stress']) {
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
    $('#cv-live').textContent = `Illustrative model: ${BLOODK.map(k => `${k} ${modelNumber(k, m[k])}, ${levelWords(k, m[k], 'typical range')}`).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), stress: 1, cap: 1, tumor: 0, pit: 1, stop: 'sudden' };
const DRUG_ORDER = ['glucocorticoid', 'mineralocorticoid', 'inhibitor'];
function exploreParams() {
  let p = { ...HM.NORMAL, stress: ex.stress, cap: ex.cap, tumor: ex.tumor, pit: ex.pit };
  for (const d of DRUG_ORDER) if (ex.drugs.has(d)) p = HM.DRUGS[d](p);
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
const STOP = { sudden: HM.stopping('sudden'), taper: HM.stopping('taper') };
const LOW_ZONE = 0.75;   // illustrative "too little steroid signal" line in the stopping chart
const minAfter = run => Math.min(...run.series.filter(s => s.t >= run.on).map(s => s.E));
function stopChart(mode) {
  const run = STOP[mode], other = STOP[mode === 'sudden' ? 'taper' : 'sudden'], n = run.series.length;
  const L = 58, R = 466, T = 34, B = 250, yMax = 2.8;
  const X = t => L + t / (n - 1) * (R - L), Y = e => B - clamp(e / yMax, 0, 1) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${C.rule}"/>`;
  b += `<rect data-low-zone x="${L}" y="${f(Y(LOW_ZONE))}" width="${R - L}" height="${f(B - Y(LOW_ZONE))}" fill="${BLOOD}"/>`;
  b += text(R - 6, B - 8, 'too little steroid signal', 'xs b red', 'end');
  b += `<rect x="${L}" y="${T}" width="${f(X(run.on) - L)}" height="${B - T}" fill="${BAND}" opacity=".7"/>` + text(f((L + X(run.on)) / 2), T + 20, 'drug taken', 'xs b blue');
  if (mode === 'taper') b += `<rect x="${f(X(run.on))}" y="${T}" width="${f(X(run.on + run.taperLen) - X(run.on))}" height="${B - T}" fill="${BAND}" opacity=".35"/>` + text(f((X(run.on) + X(run.on + run.taperLen)) / 2), T + 20, 'tapering', 'xs b blue');
  b += `<path d="M${L} ${f(Y(1))} H${R}" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="6 5" opacity=".6"/>` + text(L + 6, Y(1) - 8, 'normal', 'xs muted', 'start');
  const line = (s, key) => s.series.map((d, i) => `${i ? 'L' : 'M'}${f(X(d.t))} ${f(Y(d[key]))}`).join(' ');
  b += `<path d="${line(other, 'E')}" fill="none" stroke="${C.muted}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".7"/>`;
  b += `<path data-own-line d="${line(run, 'own')}" fill="none" stroke="${C.blue}" stroke-width="2.2"/>`;
  b += `<path data-total-line d="${line(run, 'E')}" fill="none" stroke="${C.amber}" stroke-width="3.2"/>`;
  b += text(L - 6, T + 14, 'more', 'xs muted', 'end') + text(L - 6, B, 'less', 'xs muted', 'end');
  b += text(R, B + 24, 'time →', 'xs b', 'end') + text(L, 22, 'steroid signal ↑', 'xs b', 'start');
  const k = keyRow([[`<path d="M0 0 H34" stroke="${C.amber}" stroke-width="3.2"/>`, 'total: drug + own cortisol'], [`<path d="M0 0 H34" stroke="${C.blue}" stroke-width="2.2"/>`, 'own cortisol'], [`<path d="M0 0 H34" stroke="${C.muted}" stroke-width="1.6" stroke-dasharray="3 4"/>`, mode === 'sudden' ? 'if tapered' : 'if stopped suddenly']], 286);
  return { body: `<g data-stop="${mode}" data-min-sudden="${minAfter(STOP.sudden).toFixed(3)}" data-min-taper="${minAfter(STOP.taper).toFixed(3)}">${b}</g>` + k.body, h: 300 + 26 * (k.rows - 1) };
}
function updateStop() {
  const mode = ex.stop, dips = minAfter(STOP[mode]) < LOW_ZONE;
  const c = stopChart(mode);
  $('#stop-chart').innerHTML = svg(`Illustrative chart of the steroid signal over time, with no numbers. A shaded stretch at the start is the drug being taken: the total signal sits high while the body’s own cortisol line lies near the floor. ${mode === 'sudden' ? 'When the drug stops all at once, the total drops straight into the shaded too-little zone and climbs back only slowly as the axis recovers.' : 'While the drug is tapered, the body’s own cortisol line climbs as the drug line falls, and the total stays above the shaded too-little zone.'}`, c.body, { h: c.h });
  $('#stop-results').textContent = mode === 'sudden'
    ? `Stopped suddenly (illustrative model): the drug had held ACTH low, so the cortex lost working capacity; ${dips ? 'the total steroid signal falls into the too-little zone' : 'the total steroid signal dips'} until the axis recovers.`
    : `Tapered (illustrative model): as the drug falls slowly, ACTH returns and the cortex recovers while some drug remains; ${dips ? 'the total still dips into the too-little zone' : 'the total stays out of the too-little zone'}.`;
}
function updateExplore() {
  for (const [id, words] of [['stress', stressWords], ['cap', capWords], ['tumor', tumorWords], ['pit', pitWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  const p = exploreParams(), cur = view(p);
  const names = { glucocorticoid: 'a glucocorticoid drug', mineralocorticoid: 'a mineralocorticoid drug', inhibitor: 'a synthesis inhibitor' };
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => names[d]);
  const who = `${{ normal: 'a normal body', cushing: 'Cushing’s disease', addison: 'Addison’s disease', secondary: 'secondary adrenal insufficiency' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const marks = { tumor: ex.tumor > 0.05 ? 1 : 0, damage: clamp((1 - ex.cap) / 0.8, 0, 1), pitfail: ex.pit < 0.6 ? 1 : 0, block: ex.drugs.has('inhibitor') ? 1 : 0, drugG: ex.drugs.has('glucocorticoid') ? 1 : 0, drugM: ex.drugs.has('mineralocorticoid') ? 1 : 0, stress: ex.stress > 1.3 ? 1 : 0 };
  const label = `Illustrative model of ${who}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = svg(label, axis(cur, { ghost: NV, from: NV, marks }), { h: AXIS_H }) + readoutOf(cur, NV, 'Compared with normal');
  const sig = SIGNALS.map(k => `${LABEL[k]} ${SIGNAL_WORD[place(k, cur[k])]}`).join(' · ');
  const blood = BLOODK.map(k => `${LABEL[k]} ${levelWords(k, cur[k])}`).join(' · ');
  const [, infW] = trend(cur.inflam, NV.inflam, 'fiercer than normal', 'calmer than normal');
  const res = $('#model-results');
  res.textContent = `Illustrative model output for ${who}: ${sig} · ${blood} · inflammation ${infW === 'about the same' ? 'about normal' : infW}.`;
  Object.assign(res.dataset, { crh: cur.crh.toFixed(4), acth: cur.acth.toFixed(4), cortisol: cur.cortisol.toFixed(4), glucose: cur.glucose.toFixed(4), sodium: cur.sodium.toFixed(4), potassium: cur.potassium.toFixed(4) });
  updateStop();
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = HM.build(r.value); ex.cap = d.cap; ex.tumor = d.tumor; ex.stress = d.stress; ex.pit = d.pit; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['stress', 'cap', 'tumor', 'pit']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$$('#stop-mode input').forEach(r => r.addEventListener('change', () => { ex.stop = r.value; updateStop(); }));
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', stress: 1, cap: 1, tumor: 0, pit: 1 }); ex.drugs.clear();
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
    const ok = BLOODK.every(id => { const v = byId(id); return v && hasRange(v) && v.low > 0; });
    if (!ok) throw new Error('Invalid reference data');
    data = loaded;
    // Each band is drawn relative to the model's normal, which sits at the middle of the quoted range.
    // Nothing else is converted into lab units.
    const mid = {};
    BANDS = {};
    for (const id of BLOODK) {
      const v = byId(id); mid[id] = (v.low + v.high) / 2; BANDS[id] = [v.low / mid[id], v.high / mid[id]];
      MID[id] = mid[id]; DEC[id] = (String(v.low).split('.')[1] || '').length;
    }
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model works in levels relative to normal and puts its normal in the middle of each band; the large number in each row is that model level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. For a disease or drug the sources give only a direction; how far the model moves is an illustrative choice.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v.modelKey, n / mid[v.modelKey]);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const [lo, hi] = rangeText(v).split('–');
      const band = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${rangeText(v)} ${v.unit} as a shaded band, a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `Source range ${rangeText(v)} ${v.unit} (shaded) · blue line: illustrative teaching-model value`;
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
