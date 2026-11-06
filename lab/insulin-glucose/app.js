// Lesson 13: Insulin and glucose. The kit (/lab/kit/kit.js) runs the page; this file draws the pictures from the
// illustrative meal model in model.js (window.GlucoseModel) and runs the Clinical values and Explore freely tabs.
//
// Expected behaviour:
//   - Every picture is 480 wide and at most 420 tall, set in the kit's type (20 / .sm 18 / .xs 17).
//   - Build steps show one mechanism each, close up, and most of them move: glucose flowing to cells, a meal
//     raising blood sugar, beta cells answering with insulin, incretins and DPP-4, insulin opening doors, the
//     liver storing glycogen, glucagon between meals, the kidney carrying glucose back. Step 7 plays the meal:
//     glucose rises, insulin follows, glucose falls back into the band and insulin eases off.
//   - Each "What changes it" step pairs the site where the disease or drug acts (top) with the meal chart from the
//     model (bottom: blood sugar and insulin over four hours), and morphs from where it starts (normal, or the
//     untreated diabetes a drug treats) at t = 0 to the changed state at t = 1, over a dashed curve for normal.
//   - The model's own flows (liver output and so on) are not drawn: in a steady-state model they can point the
//     wrong way in untreated diabetes. Only its blood sugar and insulin curves are drawn and compared.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease, span, svg, text, readout as readoutList } from '/lab/kit/draw.js';

const GM = window.GlucoseModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const UNTIL = 240;
const run = p => GM.simulate(p, UNTIL);
const NORMAL_P = GM.build('normal');
const NR = run(NORMAL_P);

/* ---------- Drawing pieces ---------- */
const SUGAR = C.amber, SUGARF = '#f2a93b', BLOOD = '#f6dcd6', BAND = '#e1efdd', LIVER = '#c98b7a', TISSUE = '#f1e3cf', PURPLEF = '#c9b3e3';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const gdot = (x, y, r = 4.6, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${SUGARF}" stroke="${SUGAR}" stroke-width="1.4" ${extra}/>`;
const idot = (x, y, r = 5.4, extra = '') => `<path d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${C.blue}" ${extra}/>`;
const gcdot = (x, y, r = 5, extra = '') => `<path d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y + r * .8)} L${f(x - r)} ${f(y + r * .8)} Z" fill="${C.red}" ${extra}/>`;
const pdot = (x, y, r = 4.6, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${PURPLEF}" stroke="${C.purple}" stroke-width="1.6" ${extra}/>`;
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
  return `<g class="ghost"><path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 3"/></g>`;
}
// Dots riding a straight run, n of them, phase in cycles.
function ride(x1, y1, x2, y2, n, phase, draw) {
  let s = '';
  for (let i = 0; i < n; i++) { const u = ((phase + i / n) % 1 + 1) % 1; s += draw(lerp(x1, x2, u), lerp(y1, y2, u), Math.min(1, u * 6, (1 - u) * 6)); }
  return s;
}
const vessel = (x, y, w, h = 30, label = true) => `<g data-part="blood"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>${label ? text(x + w - 10, y + h / 2 + 6, 'blood', 'xs b red', 'end') : ''}</g>`;
// A cell of muscle or fat with doors (glucose transporters) along its top edge; `open` of `n` doors are open.
function muscleCell(x, y, w, h, open, n = 5, ghostOpen = null) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#f0d3cd" stroke="${C.ink}" stroke-width="2"/>`;
  s += `<path d="M${x + 22} ${y + h * .45} H${x + w - 22} M${x + 22} ${y + h * .65} H${x + w - 22}" stroke="#c99a92" stroke-width="2" stroke-linecap="round"/>`;
  let doors = '';
  for (let i = 0; i < n; i++) {
    const dx = x + (i + 1) * w / (n + 1), isOpen = i < Math.round(open);
    doors += isOpen ? `<rect x="${f(dx - 11)}" y="${y - 6}" width="6" height="14" fill="${C.blue}"/><rect x="${f(dx + 5)}" y="${y - 6}" width="6" height="14" fill="${C.blue}"/>`
      : `<rect x="${f(dx - 11)}" y="${y - 4}" width="22" height="9" fill="${C.ink}"/>`;
    if (ghostOpen !== null && !isOpen && i < Math.round(ghostOpen)) doors += `<rect class="ghost" x="${f(dx - 14)}" y="${y - 10}" width="28" height="20" fill="none" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="3 2"/>`;
  }
  return s + `<g data-part="doors">${doors}</g>`;
}
// An islet: beta cells (blue) around alpha cells (red). `lost` fades the beta cells and crosses them out.
function islet(cx, cy, r, { lost = 0, glow = 0 } = {}) {
  let s = `<g data-part="islet"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/></g>`;
  const beta = [[-.5, -.42], [.08, -.58], [.56, -.3], [-.62, .18], [.6, .3], [-.18, .55], [.28, .56]];
  s += `<g data-part="beta">` + beta.map(([a, b]) => { const x = cx + a * r, y = cy + b * r, rr = r * .2; return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="${C.blue}" fill-opacity="${f(1 - .82 * lost)}" stroke="${glow ? C.blue : 'none'}" stroke-width="${f(3 * glow)}"/>` + (lost > .3 ? `<g ${fade((lost - .3) / .5)}><path d="M${f(x - rr * .7)} ${f(y - rr * .7)} L${f(x + rr * .7)} ${f(y + rr * .7)} M${f(x + rr * .7)} ${f(y - rr * .7)} L${f(x - rr * .7)} ${f(y + rr * .7)}" stroke="${C.ink}" stroke-width="2"/></g>` : ''); }).join('') + '</g>';
  s += `<g data-part="alpha">${[[-.04, 0], [.2, -.05]].map(([a, b]) => `<circle cx="${f(cx + a * r)}" cy="${f(cy + b * r)}" r="${f(r * .17)}" fill="${C.red}"/>`).join('')}</g>`;
  return s;
}
const LIVER_D = 'M0 30 C10 8 80 -2 140 6 C168 10 172 40 156 62 C134 90 60 100 22 84 C4 76 -8 52 0 30 Z';
const liverShape = (x, y, s = 1) => `<g data-part="liver" transform="translate(${x} ${y}) scale(${s})"><path d="${LIVER_D}" fill="${LIVER}" stroke="${C.ink}" stroke-width="${f(2 / s)}"/></g>`;
function glycogen(x, y, n) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = i * .55, r = 8 + i * 2.2; s += gdot(x + r * Math.cos(a), y + r * Math.sin(a) * .7, 4); }
  return `<g data-part="glycogen">${s}</g>`;
}
const gut = (x, y, s = 1) => `<g data-part="gut" transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="0" width="110" height="66" rx="24" fill="${TISSUE}" stroke="${C.ink}" stroke-width="${f(2 / s)}"/><path d="M14 20 C26 6 40 34 52 20 S80 6 96 20 M14 46 C26 32 40 60 52 46 S80 32 96 46" fill="none" stroke="#b07a55" stroke-width="${f(2.4 / s)}" stroke-linecap="round"/></g>`;
const syringe = (x, y) => `<g data-part="syringe"><rect x="${x}" y="${y}" width="66" height="18" rx="3" fill="#fff" stroke="${C.blue}" stroke-width="2"/><rect x="${x + 6}" y="${y + 3}" width="34" height="12" fill="${C.blue}" opacity=".45"/><path d="M${x - 12} ${y + 9} H${x} M${x + 66} ${y + 9} H${x + 92}" stroke="${C.blue}" stroke-width="2.4"/><path d="M${x - 12} ${y + 1} V${y + 17}" stroke="${C.blue}" stroke-width="2.4"/></g>`;
function scissors(x, y, blocked = 0) {
  let s = `<g data-part="dpp4"><circle cx="${x - 8}" cy="${y + 10}" r="6" fill="none" stroke="${C.ink}" stroke-width="2.4"/><circle cx="${x + 8}" cy="${y + 10}" r="6" fill="none" stroke="${C.ink}" stroke-width="2.4"/>`
    + `<path d="M${x - 4} ${y + 5} L${x + 10} ${y - 16} M${x + 4} ${y + 5} L${x - 10} ${y - 16}" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  if (blocked > 0) s += `<g ${fade(blocked)}><circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${C.blue}" stroke-width="3"/><path d="M${x - 14} ${y + 14} L${x + 14} ${y - 14}" stroke="${C.blue}" stroke-width="3"/></g>`;
  return s + '</g>';
}
function tubule(x, y, w, carriers, blocked = 0) {
  let s = `<g data-part="tubule"><rect x="${x}" y="${y}" width="${w}" height="34" rx="17" fill="#fdf6d8" stroke="${C.ink}" stroke-width="2"/></g>`;
  let c = '';
  carriers.forEach(cx => {
    c += `<rect x="${cx - 9}" y="${y - 7}" width="18" height="14" rx="4" fill="${C.green}"/>`;
    if (blocked > 0) c += `<g ${fade(blocked)}><path d="M${cx - 10} ${y - 9} L${cx + 10} ${y + 9} M${cx + 10} ${y - 9} L${cx - 10} ${y + 9}" stroke="${C.blue}" stroke-width="3"/></g>`;
  });
  return s + `<g data-part="sglt2">${c}</g>`;
}
const urineDrop = (x, y) => `<path d="M${x} ${y - 24} C${x + 8} ${y - 12} ${x + 18} ${y - 4} ${x + 18} ${y + 6} A18 18 0 0 1 ${x - 18} ${y + 6} C${x - 18} ${y - 4} ${x - 8} ${y - 12} ${x} ${y - 24} Z" fill="#f7eaa6" stroke="${C.ink}" stroke-width="1.6"/>`;

/* ---------- The meal chart: blood sugar and insulin over four hours ---------- */
let REFBAND = null;                              // the healthy band from clinical-values.json (mg/dL)
const band = () => REFBAND || [70, 100];
const X = t => 60 + (t + 40) / (UNTIL + 40) * 404;
const curvePts = (r, until, key, Y) => {
  const pts = [[-40, key === 'G' ? r.fasting.G : r.fasting.I], [0, key === 'G' ? r.fasting.G : r.fasting.I]];
  for (let t = 3; t <= until; t += 3) pts.push([t, r.at(t)[key]]);
  if (until > 0 && until % 3) pts.push([until, r.at(until)[key]]);
  return 'M' + pts.map(([t, v]) => `${f(X(t))} ${f(Y(v))}`).join(' L');
};
function mealChart(cur, o) {
  const { y, gH = 104, iH = 40, scale = [20, 300], iMax = 8, ghost = null, before = null, until = UNTIL, words = {}, insulin = true, mark = null } = o;
  const gy0 = y + 22, gy1 = gy0 + gH, iy0 = gy1 + 30, iy1 = iy0 + iH;
  const G = g => gy1 - clamp((g - scale[0]) / (scale[1] - scale[0]), -.02, 1.04) * gH, I = i => iy1 - clamp(i / iMax, 0, 1.05) * iH;
  const [b0, b1] = band();
  let s = text(60, y + 14, 'blood sugar', 'xs b', 'start') + (words.g ? text(464, y + 14, words.g[0], words.g[1] || 'xs b blue', 'end') : '');
  s += `<rect x="60" y="${gy0}" width="404" height="${gH}" fill="#fff" stroke="${C.rule}"/>`;
  s += `<rect data-part="band" x="60" y="${f(G(b1))}" width="404" height="${f(G(b0) - G(b1))}" fill="${BAND}"/>`;
  const bh = G(b0) - G(b1);
  s += bh >= 24 ? text(458, G(b0) - 5, 'healthy band', 'xs b green', 'end') : text(458, G(b0) + 17, 'healthy band', 'xs b green', 'end');
  s += `<path d="M${f(X(0))} ${gy0} V${insulin ? iy1 : gy1}" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="2 3"/>`;
  if (ghost) s += `<g class="ghost"><path d="${curvePts(ghost, UNTIL, 'G', G)}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5"/></g>`;
  if (before) s += `<path d="${curvePts(before, UNTIL, 'G', G)}" fill="none" stroke="${C.muted}" stroke-width="2.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>`;
  s += `<g data-part="curve"><path data-curve d="${curvePts(cur, until, 'G', G)}" fill="none" stroke="${SUGAR}" stroke-width="3.4" stroke-linejoin="round"/>`;
  if (mark !== null) { const g = mark < 0 ? cur.fasting.G : cur.at(mark).G; s += `<circle cx="${f(X(mark))}" cy="${f(G(g))}" r="6" fill="${SUGAR}" stroke="#fff" stroke-width="2"/>`; }
  s += '</g>';
  if (insulin) {
    s += text(60, iy0 - 8, 'insulin', 'xs b blue', 'start') + (words.i ? text(464, iy0 - 8, words.i[0], words.i[1] || 'xs b blue', 'end') : '');
    s += `<rect x="60" y="${iy0}" width="404" height="${iH}" fill="#fff" stroke="${C.rule}"/>`;
    if (ghost) s += `<g class="ghost"><path d="${curvePts(ghost, UNTIL, 'I', I)}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5"/></g>`;
    if (before) s += `<path d="${curvePts(before, UNTIL, 'I', I)}" fill="none" stroke="${C.muted}" stroke-width="2.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>`;
    s += `<g data-part="icurve"><path d="${curvePts(cur, until, 'I', I)}" fill="none" stroke="${C.blue}" stroke-width="3" stroke-linejoin="round"/>`;
    if (mark !== null) { const i = mark < 0 ? cur.fasting.I : cur.at(mark).I; s += `<circle cx="${f(X(mark))}" cy="${f(I(i))}" r="5.5" fill="${C.blue}" stroke="#fff" stroke-width="2"/>`; }
    s += '</g>';
  }
  const by = (insulin ? iy1 : gy1) + 20;
  s += text(X(0), by, 'meal', 'xs b') + text(464, by, '4 hours later →', 'xs muted', 'end');
  return s;
}
const CHART_H = (gH = 104, iH = 40, insulin = true) => 22 + gH + (insulin ? 30 + iH : 0) + 26;

/* ---------- Build the idea: the step pictures ---------- */
// Moving: glucose flows along the blood to cells, which take it in; blood sugar sits in the band.
function fuelPicture(t) {
  let b = vessel(12, 40, 456, 34);
  b += `<g data-part="glucose">${ride(30, 57, 400, 57, 10, t * 2, (x, y, a) => gdot(x, y + (Math.round(x) % 3 - 1) * 4, 4.6, fade(a)))}</g>`;
  const cells = [[90, 'brain'], [240, 'muscle'], [390, 'fat']];
  for (const [x, w] of cells) {
    b += w === 'brain' ? `<path d="M${x - 46} 170 C${x - 52} 132 ${x - 20} 116 ${x} 122 C${x + 24} 112 ${x + 52} 130 ${x + 46} 170 C${x + 40} 196 ${x - 40} 196 ${x - 46} 170 Z" fill="#e8cfe0" stroke="${C.ink}" stroke-width="2"/>`
      : `<rect x="${x - 50}" y="124" width="100" height="70" rx="24" fill="${w === 'fat' ? '#f6ebc9' : '#f0d3cd'}" stroke="${C.ink}" stroke-width="2"/>`;
    b += ride(x, 78, x, 140, 3, t * 2 + x / 100, (xx, yy, a) => gdot(xx, yy, 4, fade(a)));
    b += text(x, 222, w, 'sm b');
  }
  const half = 190, mid = 240, pos = g => mid + clamp((g - 88) / 60, -1, 1) * half, [b0, b1] = band();
  b += `<g data-part="meter">${text(50, 270, 'blood sugar', 'xs b', 'start')}<rect x="${mid - half}" y="282" width="${half * 2}" height="10" rx="5" fill="#fff" stroke="${C.rule}"/>`;
  b += `<rect x="${f(pos(b0))}" y="282" width="${f(pos(b1) - pos(b0))}" height="10" fill="${BAND}"/><rect x="${f(pos(88) - 5)}" y="276" width="10" height="22" fill="${SUGAR}" stroke="#fff" stroke-width="1.5"/>`;
  b += text(f((pos(b0) + pos(b1)) / 2), 318, 'kept in a narrow healthy band', 'xs b green') + '</g>';
  return b;
}
// Moving: a meal; the gut sends glucose into the blood and blood sugar climbs above the band.
function mealPicture(t) {
  const until = Math.round(lerp(-40, 45, ease.inOut(span(t, .05, .95))));
  const ra = until > 0 ? NR.at(until).ra : 0;
  let b = gut(20, 14) + text(75, 104, 'gut', 'sm b') + vessel(150, 36, 318, 30);
  b += flow(132, 50, 150, 50, 3 + 4 * ra / 3, SUGAR);
  b += `<g data-part="gut">${ride(160, 51, 430, 51, clamp(Math.round(2 + 4 * ra), 2, 14), t * 3, (x, y, a) => gdot(x, y + (Math.round(x) % 3 - 1) * 4, 4.4, fade(a)))}</g>`;
  b += text(158, 98, 'glucose absorbed into the blood', 'xs b', 'start');
  b += mealChart(NR, { y: 116, gH: 160, scale: [60, 150], until: Math.max(0, until), insulin: false, words: until > 15 ? { g: ['↑ climbs above the band', 'xs b blue'] } : {} });
  b += `<g ${fade(span(t, .85, 1))}>${text(240, 352, 'something has to clear it', 'sm b blue')}</g>`;
  return b;
}
// Moving: as glucose rises round the islet, the beta cells release insulin into the blood.
function pancreasPicture(t) {
  const g = lerp(0, 1, ease.inOut(span(t, .05, .6)));
  let b = `<g data-part="pancreas"><path d="M22 64 C20 40 50 34 84 38 C118 42 146 30 166 36 C182 42 178 64 162 68 C138 74 112 68 90 72 C60 76 24 82 22 64 Z" fill="#f2d7c2" stroke="${C.ink}" stroke-width="2"/></g>` + text(94, 110, 'pancreas', 'sm b');
  b += `<circle cx="120" cy="54" r="10" fill="none" stroke="${C.blue}" stroke-width="2.5"/><path d="M128 62 L196 112 M128 46 L240 40" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  b += islet(270, 120, 78, { glow: g }) + text(184, 236, 'one islet, enlarged', 'xs b', 'end');
  b += text(372, 70, 'beta cells', 'xs b blue', 'start') + text(372, 92, '(blue)', 'xs blue', 'start');
  b += text(150, 152, 'alpha cells', 'xs b red', 'end') + text(150, 174, '(red)', 'xs red', 'end');
  b += vessel(12, 270, 456, 32);
  const ng = Math.round(3 + 9 * g);
  for (let i = 0; i < ng; i++) b += gdot(30 + ((i * .618) % 1) * 400, 280 + ((i * .382) % 1) * 12, 4.4);
  b += `<g data-part="insulin">${flow(318, 196, 352, 266, 2 + 8 * g, C.blue)}${ride(322, 204, 348, 260, Math.round(1 + 4 * g), t * 3, (x, y, a) => idot(x, y, 5, fade(a)))}`;
  for (let i = 0; i < Math.round(1 + 10 * g); i++) b += idot(60 + ((i * .7548) % 1) * 360, 286 + ((i * .5698) % 1) * 8, 5);
  b += text(372, 238, 'insulin', 'xs b blue', 'start') + '</g>';
  b += text(240, 340, g > .5 ? 'more sugar, more insulin' : 'blood sugar rising', 'sm b blue');
  return b;
}
// Moving: the gut sends GLP-1 toward the islet; DPP-4 cuts most of it on the way; what arrives adds insulin.
function incretinPicture(t, { blocked = 0, drug = 0, site = false } = {}) {
  let b = gut(16, 40) + text(71, 130, 'gut', 'sm b');
  b += islet(392, 84, 56, { glow: .5 + .5 * (blocked + drug) }) + (site ? text(392, 164, 'beta cells', 'xs b blue') : text(464, 20, 'beta cells', 'xs b blue', 'end'));
  if (!site) b += vessel(12, 196, 456, 30, false);
  b += scissors(240, 86, blocked);
  const n = 7;
  let s = '';
  for (let i = 0; i < n; i++) {
    const u = ((t * 2 + i / n) % 1);
    const cut = i % 3 !== 0 && blocked < .5 && !drug;
    const x = lerp(130, 340, u), y = 84 + Math.sin(u * Math.PI) * -6;
    if (cut && u > .5) { s += `<g ${fade(1 - (u - .5) * 3)}>${pdot(x - 4, y + 6, 3.2)}${pdot(x + 4, y - 6, 3.2)}</g>`; }
    else s += pdot(x, y, 5, fade(Math.min(1, u * 6, (1 - u) * 6)));
  }
  b += `<g data-part="glp1">${s}</g>`;
  b += text(240, 136, blocked > .5 ? 'DPP-4 blocked' : 'DPP-4 cuts most', 'xs b', 'middle');
  b += text(150, 52, 'GLP-1', 'xs b purple', 'start');
  if (!site) b += flow(392, 146, 392, 196, 4 + 5 * (.5 + .5 * (blocked + drug)), C.blue) + text(406, 186, 'insulin', 'xs b blue', 'start');
  return b;
}
// Moving: insulin docks, doors move up to the surface, and glucose flows in.
function doorsPicture(t) {
  const dock = ease.inOut(span(t, .05, .3)), up = ease.inOut(span(t, .3, .6)), inflow = span(t, .6, 1);
  let b = vessel(12, 26, 456, 34);
  for (let i = 0; i < 8; i++) b += gdot(40 + i * 46, 43 + (i % 2) * 4, 4.6);
  b += `<g data-part="insulin">${[150, 330].map(x => idot(x, lerp(42, 100, dock), 6)).join('')}</g>`;
  b += muscleCell(40, 112, 400, 150, 0, 0);
  // Doors start inside the cell and rise to the surface.
  let d = '';
  for (let i = 0; i < 5; i++) {
    const dx = 40 + (i + 1) * 400 / 6, yy = lerp(200, 112, up);
    d += `<rect x="${f(dx - 11)}" y="${f(yy - 6)}" width="6" height="14" fill="${C.blue}"/><rect x="${f(dx + 5)}" y="${f(yy - 6)}" width="6" height="14" fill="${C.blue}"/>`;
  }
  b += `<g data-part="doors">${d}</g>`;
  if (inflow > 0) for (let i = 0; i < 5; i++) { const dx = 40 + (i + 1) * 400 / 6; b += ride(dx, 66, dx, 150, 2, t * 4 + i * .3, (x, y, a) => gdot(x, y, 4.4, fade(a * inflow))); }
  b += text(60, 290, 'muscle or fat cell', 'sm b', 'start');
  b += `<g ${fade(span(t, .05, .15))}>${text(456, 92, '1 insulin docks', 'xs b blue', 'end')}</g>`;
  b += `<g ${fade(span(t, .3, .4))}>${text(456, 290, '2 doors move up', 'xs b blue', 'end')}</g>`;
  b += `<g ${fade(span(t, .62, .72))}>${text(456, 316, '3 glucose flows in', 'xs b blue', 'end')}</g>`;
  return b;
}
// Moving: with insulin, glucose enters the liver and is linked into glycogen; the liver's own release shrinks.
function liverPicture(t) {
  const k = ease.inOut(span(t, .05, .9));
  let b = vessel(12, 30, 456, 34);
  for (let i = 0; i < 7; i++) b += gdot(40 + i * 54, 47 + (i % 2) * 4, 4.6);
  b += idot(300, 47, 6) + idot(150, 47, 6) + text(26, 106, 'insulin', 'xs b blue', 'start') + flow(80, 108, 120, 150, 3, C.blue);
  b += liverShape(90, 140, 1.8);
  b += glycogen(250, 236, Math.round(3 + 10 * k)) + text(250, 330, 'glycogen: stored glucose', 'xs b');
  b += flow(170, 66, 200, 150, 3 + 5 * k, SUGAR) + text(168, 112, 'stored', 'xs b amber', 'end');
  b += flowGhost(380, 150, 380, 68, 9) + flow(380, 150, 380, 68, lerp(9, 2, k), SUGAR) + text(390, 128, 'released', 'xs b amber', 'start');
  b += `<g ${fade(span(t, .55, .8))}>${text(470, 196, 'release', 'xs b blue', 'end')}${text(470, 218, 'turned down', 'xs b blue', 'end')}</g>`;
  return b;
}
// Moving: the meal, start to finish. Glucose rises, insulin follows, glucose falls back, insulin eases.
function feedbackPicture(t) {
  const until = Math.round(lerp(-40, UNTIL, span(t, .02, .96)));
  let b = mealChart(NR, { y: 6, gH: 150, iH: 96, scale: [60, 150], iMax: 4.4, until: Math.max(0, until), mark: until });
  const steps = [[20, '1 glucose rises'], [45, '2 insulin follows'], [120, '3 glucose falls back into the band'], [180, '4 insulin eases off']];
  b += steps.map(([at, w], i) => `<g ${fade(clamp((until - at) / 15, 0, 1))}>${text(i % 2 ? 470 : 12, 352 + Math.floor(i / 2) * 22 + (i % 2) * 0, w, i > 1 ? 'xs b blue' : 'xs b', i % 2 ? 'end' : 'start')}</g>`).join('');
  return b;
}
// Moving: blood sugar dips; alpha cells release glucagon; the liver breaks down glycogen and makes new glucose.
function glucagonPicture(t) {
  const k = ease.inOut(span(t, .15, .85));
  let b = islet(80, 80, 54) + text(80, 158, 'alpha cells', 'xs b red');
  b += `<g data-part="glucagon">${flow(140, 96, 228, 150, 3 + 5 * k, C.red)}${ride(146, 100, 222, 146, Math.round(1 + 4 * k), t * 3, (x, y, a) => gcdot(x, y, 5, fade(a)))}${text(196, 104, 'glucagon', 'xs b red', 'start')}</g>`;
  b += liverShape(230, 136, 1.4) + glycogen(330, 196, Math.round(12 - 8 * k));
  b += vessel(12, 292, 456, 32);
  b += flow(300, 268, 300, 292, 2 + 7 * k, SUGAR);
  const g = lerp(68, 88, k);
  for (let i = 0; i < Math.round(4 + 6 * k); i++) b += gdot(30 + ((i * .618) % 1) * 400, 302 + ((i * .382) % 1) * 12, 4.4);
  const half = 150, mid = 240, pos = v => mid + clamp((v - 88) / 50, -1, 1) * half, [b0, b1] = band();
  b += text(20, 366, 'blood sugar', 'xs b', 'start') + `<rect x="${mid - half + 60}" y="356" width="${half * 2 - 60}" height="10" rx="5" fill="#fff" stroke="${C.rule}"/>`;
  b += `<rect x="${f(pos(b0))}" y="356" width="${f(pos(b1) - pos(b0))}" height="10" fill="${BAND}"/><rect x="${f(pos(g) - 5)}" y="350" width="10" height="22" fill="${SUGAR}" stroke="#fff" stroke-width="1.5"/>`;
  b += text(240, 402, k < .5 ? 'between meals: sugar dips' : 'glucagon tops it back up', 'sm b blue');
  return b;
}
// Moving: the kidney filters glucose out; SGLT2 carriers hand it back to the blood; the urine stays free of it.
function kidneyPicture(t, blocked = 0) {
  let b = vessel(12, 24, 456, 32);
  b += tubule(20, 150, 400, [110, 190, 270, 350], blocked);
  b += urineDrop(446, 176) + text(446, 230, 'urine', 'xs b');
  b += `<path d="M40 60 V150" stroke="${C.muted}" stroke-width="2" stroke-dasharray="4 3"/>` + text(48, 110, 'filtered', 'xs b', 'start');
  let s = '';
  for (let i = 0; i < 8; i++) {
    const u = ((t * 2 + i / 8) % 1), carrier = 110 + (i % 4) * 80;
    let x, y;
    if (u < .35) { x = lerp(40, carrier, u / .35); y = 167; }
    else if (blocked < .5) { const k = (u - .35) / .65; x = carrier; y = lerp(167, 40, k); }
    else { const k = (u - .35) / .65; x = lerp(carrier, 446, k); y = lerp(167, 182, k); }
    s += gdot(x, y, 4.6, fade(Math.min(1, u * 8, (1 - u) * 8)));
  }
  b += s;
  b += text(20, 250, 'kidney tubule', 'sm b', 'start');
  b += text(230, 120, blocked > .5 ? 'carriers blocked' : 'SGLT2 carriers hand it back', 'xs b green', 'middle');
  return b;
}
function diabetesPicture() {
  const box = (x, y, w, lines, col = C.ink) => `<rect x="${x}" y="${y}" width="${w}" height="${22 + 22 * lines.length}" rx="12" fill="#fff" stroke="${col}" stroke-width="2"/>` + lines.map((l, i) => text(x + w / 2, y + 28 + i * 22, l, 'xs b')).join('');
  let b = box(150, 10, 180, ['blood sugar rises']) + box(310, 120, 160, ['beta cells', 'release insulin']);
  b += box(150, 250, 180, ['cells take in', 'glucose']) + box(10, 120, 160, ['blood sugar', 'falls']);
  b += flow(330, 44, 380, 116, 4, C.ink) + flow(380, 190, 330, 250, 4, C.blue) + flow(150, 270, 100, 196, 4, C.ink) + flow(100, 116, 150, 52, 4, C.ink);
  const fail = (x, y, w1, w2, anchor, tx) => `<g data-part="high"><circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="${C.red}" stroke-width="3"/><path d="M${x - 6} ${y - 6} l12 12 m0 -12 l-12 12" stroke="${C.red}" stroke-width="3"/>${text(tx, y + 32, w1, 'xs b red', anchor)}${text(tx, y + 54, w2, 'xs b red', anchor)}</g>`;
  b += fail(360, 220, 'too little', 'insulin', 'start', 382);
  b += fail(150, 300, 'cells answer', 'weakly', 'end', 128);
  b += text(240, 156, 'the loop', 'sm b muted');
  return b;
}
function wholePicture() {
  let b = `<g data-part="blood"><rect x="150" y="150" width="180" height="96" rx="20" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>${text(240, 190, 'blood sugar', 'sm b red')}${text(240, 214, 'the pool', 'xs red')}</g>`;
  b += gut(20, 26, .8) + text(64, 104, 'gut: meals', 'xs b') + flow(110, 90, 168, 148, 6, SUGAR);
  b += liverShape(330, 20, .8) + text(468, 120, 'liver: between', 'xs b', 'end') + text(468, 142, 'meals', 'xs b', 'end') + flow(370, 96, 314, 148, 6, SUGAR);
  b += `<g data-part="pancreas">${islet(240, 62, 34)}${text(240, 118, 'pancreas', 'xs b')}</g>`;
  b += text(20, 196, 'insulin: down', 'xs b blue', 'start') + text(20, 218, 'glucagon: up', 'xs b red', 'start');
  b += `<rect x="20" y="290" width="104" height="52" rx="18" fill="#f0d3cd" stroke="${C.ink}" stroke-width="2"/>` + text(72, 364, 'muscle, fat', 'xs b') + flow(170, 246, 104, 288, 6, SUGAR);
  b += `<path d="M216 300 C210 280 230 270 240 276 C252 268 272 280 264 300 C260 314 222 314 216 300 Z" fill="#e8cfe0" stroke="${C.ink}" stroke-width="2"/>` + text(240, 340, 'brain', 'xs b') + flow(240, 246, 240, 272, 4, SUGAR);
  b += `<path d="M380 286 C362 286 356 306 360 322 C364 338 380 346 394 340 C404 336 400 326 398 318 C396 310 406 306 404 296 C402 288 390 286 380 286 Z" fill="#e6c7c0" stroke="${C.ink}" stroke-width="2"/>` + text(384, 364, 'kidney: only', 'xs b') + text(384, 386, 'when very high', 'xs b') + flowGhost(312, 246, 370, 288, 3);
  b += `<g data-part="fasting"><rect x="330" y="186" width="144" height="56" rx="10" fill="#fff" stroke="${C.blue}" stroke-width="2.5"/>${text(402, 210, 'key measure:', 'xs b blue')}${text(402, 232, 'fasting sugar', 'xs b blue')}</g>`;
  return b;
}

/* ---------- What changes it: the site (top) and the meal (bottom) ---------- */
const SITE_H = 172, CH_Y = 176;
function site(kind, k) {
  let b = '';
  if (kind === 'type1') {
    b += islet(110, 86, 70, { lost: k });
    b += `<g data-part="attack" ${fade(k)}>${[[30, 40], [190, 46], [40, 140], [182, 132], [110, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${C.red}" stroke-width="2.6"/><circle cx="${x}" cy="${y}" r="2.4" fill="${C.red}"/>`).join('')}</g>`;
    b += flowGhost(196, 86, 290, 86, 9) + flow(196, 86, 290, 86, lerp(9, .6, k), C.blue) + text(244, 70, 'insulin', 'xs b blue');
    b += `<g ${fade(k)}>${text(308, 72, 'immune attack:', 'xs b red', 'start')}${text(308, 94, 'beta cells lost', 'xs b red', 'start')}${text(308, 116, 'almost no insulin', 'xs b red', 'start')}</g>`;
  }
  if (kind === 'type2' || kind === 'insulin') {
    const open = kind === 'type2' ? lerp(4, 1, k) : lerp(0, 4, k);
    b += muscleCell(20, 60, 250, 96, open, 5, 4);
    const nI = kind === 'type2' ? Math.round(lerp(3, 6, k)) : Math.round(lerp(0, 4, k));
    b += `<g data-part="insulin">${[60, 100, 140, 180, 220, 250].slice(0, nI).map(x => idot(x, 40, 6)).join('')}</g>`;
    if (kind === 'type2') b += `<g ${fade(k)}>${text(290, 80, 'insulin docks,', 'xs b red', 'start')}${text(290, 102, 'but few doors open:', 'xs b red', 'start')}${text(290, 124, 'cells answer weakly', 'xs b red', 'start')}</g>`;
    else b += `<g ${fade(k)}>${syringe(318, 22)}${text(290, 80, 'insulin from outside,', 'xs b blue', 'start')}${text(290, 102, 'under the skin:', 'xs b blue', 'start')}${text(290, 124, 'doors open again', 'xs b blue', 'start')}</g>`;
    b += text(145, 116, 'muscle or fat', 'xs b');
  }
  if (kind === 'metformin') {
    b += liverShape(20, 30, 1.25) + text(118, 92, 'liver', 'sm b');
    b += flowGhost(230, 86, 330, 86, 12) + flow(230, 86, 330, 86, lerp(12, 6, k), SUGAR) + text(280, 66, 'glucose', 'xs b amber');
    b += `<rect x="340" y="62" width="128" height="48" rx="24" fill="${BLOOD}" stroke="${C.red}" stroke-width="2"/>` + text(404, 92, 'blood', 'xs b red');
    b += `<g ${fade(k)}>${text(20, 160, 'the liver lets out less glucose; no push on the pancreas', 'xs b blue', 'start')}</g>`;
  }
  if (kind === 'sulfonylurea') {
    b += `<g data-part="beta"><circle cx="170" cy="86" r="66" fill="#dbe2ff" stroke="${C.ink}" stroke-width="2"/></g>` + text(170, 92, 'beta cell', 'sm b');
    // The potassium channel on the left edge: open, potassium leaks out; shut, the cell fires and insulin leaves.
    const gap = lerp(10, 0, k);
    b += `<g data-part="channel"><rect x="94" y="${f(70 - gap)}" width="16" height="14" fill="${C.purple}"/><rect x="94" y="${f(88 + gap)}" width="16" height="14" fill="${C.purple}"/></g>`;
    if (k < .6) b += `<g ${fade(1 - k / .6)}>${flow(96, 86, 50, 86, 4, C.purple)}${text(46, 70, 'K', 'xs b purple', 'end')}</g>`;
    b += `<g ${fade(k)}><rect x="90" y="80" width="24" height="12" rx="6" fill="${SUGARF}" stroke="${SUGAR}" stroke-width="1.6"/></g>`;
    b += text(20, 150, k > .5 ? 'channel shut by the drug' : 'potassium channel', 'xs b purple', 'start');
    b += flowGhost(236, 86, 310, 86, 5) + flow(236, 86, 310, 86, lerp(5, 12, k), C.blue);
    b += `<g ${fade(k)}>${text(318, 74, 'insulin out,', 'xs b blue', 'start')}${text(318, 96, 'even when sugar', 'xs b blue', 'start')}${text(318, 118, 'is low', 'xs b blue', 'start')}</g>`;
  }
  if (kind === 'sglt2') {
    b += vessel(12, 8, 456, 28) + tubule(20, 92, 380, [110, 190, 270, 350], k) + urineDrop(440, 112);
    b += `<path d="M40 36 V92" stroke="${C.muted}" stroke-width="2" stroke-dasharray="4 3"/>` + text(48, 70, 'filtered', 'xs b', 'start') + text(468, 154, 'urine', 'xs b', 'end');
    // Carried back while the carriers work; on into the urine once they are blocked.
    [[110, 1], [190, 2], [270, 3], [350, 4]].forEach(([cx, i]) => { b += gdot(cx, lerp(60, 109, k), 4.6) + (k > .4 ? gdot(400 + i * 8, 112 + (i % 2) * 6, 4, fade((k - .4) / .6)) : ''); });
    b += `<g ${fade(k)}>${text(20, 166, 'SGLT2 blocked: sugar leaves in the urine', 'xs b blue', 'start')}</g>`;
  }
  if (kind === 'glp1') {
    b += `<g data-part="glp1"><path d="M30 40 C30 20 80 14 100 30 C120 46 116 92 84 104 C56 114 30 96 30 70 Z" fill="${TISSUE}" stroke="${C.ink}" stroke-width="2"/></g>` + text(70, 76, 'stomach', 'xs b');
    b += islet(240, 64, 44, { glow: k });
    b += text(70, 132, '↓ empties', 'xs b blue') + text(70, 154, 'slower', 'xs b blue');
    b += text(240, 132, '↑ insulin, while', 'xs b blue') + text(240, 154, 'sugar is high', 'xs b blue');
    b += text(400, 132, '↓ glucagon', 'xs b blue');
    b += `<g data-part="alpha"><circle cx="400" cy="64" r="30" fill="#f6d5d1" stroke="${C.red}" stroke-width="2"/>${[[-10, -8], [10, -8], [0, 10]].map(([x, y]) => gcdot(400 + x, 64 + y, 6, fade(1 - .75 * k))).join('')}</g>`;
    b += text(400, 22, 'alpha cell', 'xs b red');
    b = `<g ${fade(.35 + .65 * k)}>${b}</g>`;
  }
  if (kind === 'dpp4') {
    b += `<g transform="translate(0 -18)">${incretinPicture(.3, { blocked: k, site: true })}</g>`;
    b += `<g ${fade(k)}>${text(20, 166, 'DPP-4 blocked: own GLP-1 lasts longer', 'xs b blue', 'start')}</g>`;
  }
  return b;
}
const CHANGES = {
  type1: { from: 'normal', to: () => GM.build('type1'), words: { g: ['↑ high, even fasting'], i: ['↓ almost none'] } },
  type2: { from: 'normal', to: () => GM.build('type2'), words: { g: ['↑ high'], i: ['↑ more, yet sugar stays high'] } },
  insulin: { from: 'type1', to: () => GM.build('type1', ['insulin']), words: { g: ['↓ back toward normal'], i: ['↑ from the injection'] } },
  metformin: { from: 'type2', to: () => GM.build('type2', ['metformin']), words: { g: ['↓ lower, fasting too'], i: ['↓ a little less'] } },
  sulfonylurea: { from: 'type2', to: () => GM.build('type2', ['sulfonylurea']), words: { g: ['↓ lower'], i: ['↑ more, even before the meal'] } },
  sglt2: { from: 'type2', to: () => GM.build('type2', ['sglt2']), words: { g: ['↓ lower'], i: ['↓ less needed'] } },
  glp1: { from: 'type2', to: () => GM.build('type2', ['glp1']), words: { g: ['↓ rises less'], i: ['↑ more after the meal'] } },
  dpp4: { from: 'type2', to: () => GM.build('type2', ['dpp4']), words: { g: ['↓ a little lower'], i: ['↑ a little more'] } },
};
const TITLE = { type1: 'Type 1 diabetes', type2: 'Type 2 diabetes', insulin: 'Insulin injections in type 1 diabetes', metformin: 'Metformin in type 2 diabetes', sulfonylurea: 'A sulfonylurea in type 2 diabetes', sglt2: 'An SGLT2 inhibitor in type 2 diabetes', glp1: 'A GLP-1 receptor agonist in type 2 diabetes', dpp4: 'A DPP-4 inhibitor in type 2 diabetes' };
const WHERE = {
  type1: 'Top: red immune cells surround an islet, its blue beta cells fade and are crossed out, and the insulin arrow shrinks to almost nothing. Bottom: the blood sugar curve lifts far above the healthy band, even before the meal, while the insulin curve stays flat near zero.',
  type2: 'Top: insulin docks on a muscle or fat cell but most of its doors close: cells answer weakly. Bottom: blood sugar sits above the band before the meal and climbs much higher after it, while the insulin curve rises higher and later than normal.',
  insulin: 'Top: a syringe puts insulin under the skin and the doors on a muscle cell open again. Bottom: the blood sugar curve falls from far above the band back toward the dashed normal curve, as insulin from the injection fills the insulin curve.',
  metformin: 'Top: the arrow of glucose the liver lets out thins inside its dashed outline. Bottom: the blood sugar curve comes down, before the meal as well as after it, and the insulin curve falls a little.',
  sulfonylurea: 'Top: a beta cell’s potassium channel, open at first with potassium leaking out, is shut by the drug, and a thicker insulin arrow leaves the cell. Bottom: insulin rises, already before the meal, and the blood sugar curve comes down.',
  sglt2: 'Top: the kidney’s SGLT2 carriers are crossed out, so filtered glucose dots run on into the urine. Bottom: the blood sugar curve comes down while the insulin curve falls a little: no extra insulin is needed.',
  glp1: 'Top: a GLP-1 drug acts on three places: the stomach empties slower, the beta cells release more insulin while sugar is high, and glucagon falls. Bottom: the blood sugar curve rises less after the meal and the insulin curve rises higher.',
  dpp4: 'Top: the DPP-4 scissors are blocked, so more of the body’s own GLP-1 dots reach the beta cells, which release more insulin. Bottom: blood sugar comes down a little and insulin rises a little.',
};
const AGAINST = { insulin: 'untreated type 1 diabetes' };
function rows(cur, ref) {
  const tr = (a, b, up = 'higher', down = 'lower') => { const r = (a + 1e-6) / (b + 1e-6); return r > 1.04 ? ['up', up] : r < .96 ? ['down', down] : ['same', 'about the same']; };
  const urine = r => r.series.reduce((a, s) => a + s.kidney, 0), peakI = r => Math.max(...r.series.map(s => s.I));
  const u1 = urine(cur), u0 = urine(ref);
  return [
    ['Blood sugar after the meal', ...tr(cur.peak.G, ref.peak.G)],
    ['Fasting blood sugar', ...tr(cur.fasting.G, ref.fasting.G)],
    ['Insulin after the meal', ...tr(peakI(cur), peakI(ref), 'more', 'less')],
    ['Glucose lost in urine', ...(u1 < .5 && u0 < .5 ? ['same', 'none'] : tr(u1, u0, 'more', 'less'))],
  ];
}
const describe = (cur, ref) => rows(cur, ref).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join('; ');
function change(kind) {
  const c = CHANGES[kind];
  const p0 = () => GM.build(c.from);
  return {
    duration: 3000,
    render(t) {
      const k = ease.inOut(t), cur = run(GM.mix(p0(), c.to(), k)), start = run(p0()), a = span(t, .55, .9);
      const words = a > 0 ? { g: [c.words.g[0], 'xs b blue'], i: [c.words.i[0], 'xs b blue'] } : {};
      let b = site(kind, Math.min(1, k * 1.5));
      b += `<path d="M12 ${SITE_H} H468" stroke="${C.rule}" stroke-width="1.5"/>`;
      b += `<g ${a > 0 ? '' : ''}>${mealChart(cur, { y: CH_Y, gH: 104, iH: 40, ghost: NR, before: c.from === 'normal' ? null : start, words })}</g>`;
      if (c.from !== 'normal') b += text(12, 414, 'dashed: normal · dotted: untreated', 'xs muted', 'start');
      const ref = c.from === 'normal' ? NR : start;
      const label = `${TITLE[kind]}, drawn over a dashed curve for normal${c.from === 'normal' ? '' : ' and a dotted curve for the untreated disease'}. ${WHERE[kind]}`;
      return { svg: svg(label, b, { h: 420 }), readout: readoutList(rows(cur, ref), `Compared with ${c.from === 'normal' ? 'normal' : AGAINST[kind] || 'untreated type 2 diabetes'}`) };
    }
  };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const scenes = {
  fuel: { duration: 4000, loop: true, render: t => svg('A blood vessel carries glucose dots along; arrows of glucose leave it for the brain, a muscle cell and a fat cell. Below, a blood sugar bar sits inside its narrow healthy band.', fuelPicture(t), { h: 330 }) },
  meal: { duration: 5200, render: t => svg('After a meal the gut sends glucose into the blood, more and more dots, and a chart of blood sugar over time climbs from inside the healthy band to above it. Words say something has to clear it.', mealPicture(t), { h: 364 }) },
  pancreas: { duration: 5000, render: t => svg('The pancreas, with one islet enlarged: blue beta cells around red alpha cells. As glucose dots build up in the blood below, the beta cells light up and release a growing blue arrow of insulin, drawn as diamonds, into the blood.', pancreasPicture(t), { h: 352 }) },
  incretin: { duration: 4000, loop: true, render: t => svg('The gut sends purple GLP-1 dots toward the islet. DPP-4, drawn as scissors, cuts most of them on the way; those that arrive make the beta cells release more insulin.', incretinPicture(t), { h: 232 }) },
  doors: { duration: 5200, render: t => svg('A muscle or fat cell below a blood vessel full of glucose. Insulin docks on the cell; blue doors rise from inside the cell to its surface; glucose dots flow in through them. Three numbered lines name the steps.', doorsPicture(t), { h: 330 }) },
  liver: { duration: 5000, render: t => svg('With insulin in the blood, a thick arrow carries glucose into the liver, where glucose dots link into a growing glycogen spiral, while the arrow of glucose the liver releases shrinks inside its dashed outline: release turned down.', liverPicture(t), { h: 340 }) },
  feedback: { duration: 7000, render: t => svg('A chart of the hours after a meal draws itself from left to right. The blood sugar curve rises above the healthy band, the insulin curve below rises a little later, blood sugar falls back into the band, and insulin eases off. Four numbered lines name the steps.', feedbackPicture(t), { h: 400 }) },
  glucagon: { duration: 5200, render: t => svg('Between meals blood sugar dips below the middle of its band. Alpha cells send red glucagon to the liver; the liver’s glycogen spiral shrinks as it releases glucose into the blood, and the blood sugar bar climbs back into the middle of the band.', glucagonPicture(t), { h: 412 }) },
  kidney: { duration: 4000, loop: true, render: t => svg('A kidney tubule below the blood. Glucose dots are filtered out of the blood into the tubule, and green SGLT2 carriers in its wall hand each one back to the blood, so none reaches the urine at the end.', kidneyPicture(t), { h: 260 }) },
  diabetes: () => svg('The loop as four boxes in a circle: blood sugar rises, beta cells release insulin, cells take in glucose, blood sugar falls. Two red crosses mark where it fails: too little insulin, and cells that answer weakly.', diabetesPicture(), { h: 366 }),
  whole: () => svg('The whole picture: blood sugar as a pool in the middle. Glucose comes in from the gut after meals and from the liver between them, and goes out to the brain all the time, to muscle and fat with insulin, and to the kidney only when very high. The pancreas sends insulin, which lowers blood sugar, and glucagon, which raises it. A box marks fasting blood sugar as the key measure.', wholePicture(), { h: 396 }),
  type1: change('type1'),
  type2: change('type2'),
  insulin: change('insulin'),
  metformin: change('metformin'),
  sulfonylurea: change('sulfonylurea'),
  sglt2: change('sglt2'),
  glp1: change('glp1'),
  dpp4: change('dpp4'),
};

/* ---------- Words for the sliders ---------- */
const timeWords = m => m === 0 ? 'at the meal' : m < 60 ? `${m} minutes after` : `${Math.floor(m / 60)} hour${m >= 120 ? 's' : ''}${m % 60 ? ` ${m % 60} minutes` : ''} after`;
const betaWords = v => v < 0.08 ? 'almost none' : v < 0.45 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : 'more than normal';
const sensWords = v => v < 0.35 ? 'very weakly' : v < 0.9 ? 'weakly' : v <= 1.1 ? 'normally' : 'more strongly than normal';
const mealWords = v => v < 0.05 ? 'no meal' : v < 0.7 ? 'small' : v <= 1.3 ? 'ordinary' : 'large';
const mgdl = g => `${Math.round(g)} mg/dL`;
const inBand = g => g >= band()[0] - .5 && g <= band()[1] + .5;
const bandWords = (r, t) => { const g = t < 0 ? r.fasting.G : r.at(t).G; return inBand(g) ? 'The marked moment sits inside the healthy band.' : `The marked moment sits ${g > band()[1] ? 'above' : 'below'} the healthy band.`; };
const chartSvg = (label, cur, o) => svg(label, mealChart(cur, { y: 6, gH: 150, iH: 70, ...o }), { h: 6 + CHART_H(150, 70) + 4 });

/* ---------- Clinical values ---------- */
let data = null;
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const domain = v => { const [lo, hi] = v.scale; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, shown) {
  if (hasRange(v)) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
// How each cited state is applied to the model, and what its directions are compared with.
const BASE_OF = { insulin: 'type1', metformin: 'type2', sulfonylurea: 'type2', sglt2: 'type2', glp1: 'type2', dpp4: 'type2' };
function stateParams(id) {
  if (id === 'type1' || id === 'type2') return GM.build(id);
  if (BASE_OF[id]) return GM.build(BASE_OF[id], [id]);
  return GM.build('normal');
}
const againstParams = id => BASE_OF[id] ? GM.build(BASE_OF[id]) : GM.build('normal');
const cv = { state: 'normal', p: GM.build('normal'), time: 180, custom: false };
const cvValues = (r, t) => ({ glucoseAt: t < 0 ? r.fasting.G : r.at(t).G, fasting: r.fasting.G });
function updateClinical() {
  $('#clinical-time').value = cv.time; $('#clinical-time-label').textContent = timeWords(cv.time);
  $('#clinical-beta').value = cv.p.beta; $('#clinical-beta-label').textContent = betaWords(cv.p.beta);
  $('#clinical-sens').value = cv.p.sens; $('#clinical-sens-label').textContent = sensWords(cv.p.sens);
  const cur = run(cv.p), st = data?.states.find(s => s.id === cv.state), meal = cv.state === 'meal';
  const before = st && cv.state !== 'normal' && !meal && BASE_OF[cv.state] ? run(againstParams(cv.state)) : null;
  const label = `Illustrative model of blood sugar and insulin over the hours after a meal${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, over a dashed curve for normal${before ? ' and a dotted curve for the untreated disease' : ''}; a dot marks ${timeWords(cv.time)} the meal. ${bandWords(cur, cv.time)} Compared with normal: ${describe(cur, NR)}.`;
  $('#clinical-visual').innerHTML = chartSvg(label, cur, { ghost: NR, before, mark: cv.time });
  if (!data) return;
  const m = cvValues(cur, cv.time);
  const ref = meal ? { glucoseAt: cur.fasting.G, fasting: cur.fasting.G } : st && cv.state !== 'normal' ? cvValues(run(againstParams(cv.state)), cv.time) : null;
  const refWord = meal ? 'before the meal' : st && BASE_OF[cv.state] ? `untreated ${BASE_OF[cv.state] === 'type1' ? 'type 1' : 'type 2'} diabetes` : 'normal';
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    const note = d && st.shiftNotes?.[v.id] ? `: ${st.shiftNotes[v.id]}` : '';
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}${note}` : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = Math.round(val);
    row.querySelector('.reading').textContent = mgdl(val);
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (ref && !cv.custom) {
      const rv = ref[v.modelKey], rx = domain(v)(rv);
      cmp.textContent = `Model, ${refWord}: ${mgdl(rv)} (dashed line)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  if (id === 'meal') cv.time = 45;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this${BASE_OF[id] ? `, applied to untreated ${BASE_OF[id] === 'type1' ? 'type 1' : 'type 2'} diabetes` : ''}.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => { cv.time = 180; setState('normal'); });
$('#clinical-time').addEventListener('input', e => { cv.time = Number(e.target.value); updateClinical(); announce(); });
for (const k of ['beta', 'sens']) {
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
    const r = run(cv.p), m = cvValues(r, cv.time);
    $('#cv-live').textContent = `Model: blood glucose ${timeWords(cv.time)} the meal ${mgdl(m.glucoseAt)}, fasting ${mgdl(m.fasting)}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), beta: 1, sens: 1, meal: 1, time: 45 };
function exploreParams() {
  let p = { ...GM.NORMAL, beta: ex.beta, sens: ex.sens, meal: ex.meal };
  for (const d of ['insulin', 'metformin', 'sulfonylurea', 'sglt2', 'glp1', 'dpp4']) if (ex.drugs.has(d)) p = GM.DRUGS[d](p);
  return p;
}
function bigChart(cur, ghost) {
  const L = 64, R = 462, T = 24, B = 250, Xb = t => L + t / UNTIL * (R - L), Y = g => B - clamp((g - 40) / 300, -0.02, 1.03) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${C.rule}"/>`;
  if (REFBAND) b += `<rect data-ref-band x="${L}" y="${f(Y(REFBAND[1]))}" width="${R - L}" height="${f(Y(REFBAND[0]) - Y(REFBAND[1]))}" fill="${BAND}"/>` + text(L + 8, Y(REFBAND[0]) + 22, `reference ${REFBAND[0]} to ${REFBAND[1]} mg/dL`, 'xs b green', 'start');
  for (let g = 50; g <= 340; g += 50) b += `<path d="M${L - 5} ${f(Y(g))} H${L}" stroke="${C.ink}"/>` + text(L - 9, Y(g) + 6, String(g), 'xs', 'end');
  for (let h = 0; h <= 4; h++) b += `<path d="M${f(Xb(h * 60))} ${B} V${B + 5}" stroke="${C.ink}"/>` + text(Xb(h * 60), B + 24, `${h} h`, 'xs');
  const pathOf = r => 'M' + r.series.filter((_, i) => i % 3 === 0 || i === UNTIL).map(s => `${f(Xb(s.t))} ${f(Y(s.G))}`).join(' L');
  b += `<path d="${pathOf(ghost)}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-explore-curve d="${pathOf(cur)}" fill="none" stroke="${SUGAR}" stroke-width="3.4"/>`;
  b += `<path d="M${f(Xb(ex.time))} ${T} V${B}" stroke="${C.muted}" stroke-dasharray="2 3"/><circle cx="${f(Xb(ex.time))}" cy="${f(Y(cur.at(ex.time).G))}" r="6" fill="${SUGAR}" stroke="#fff" stroke-width="2"/>`;
  b += text(L, 16, 'blood glucose (mg/dL) ↑', 'xs b', 'start') + text(R, B + 48, 'hours after the meal →', 'xs b', 'end');
  return b;
}
function updateExplore() {
  for (const [id, words] of [['beta', betaWords], ['sens', sensWords], ['meal', mealWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  $('#time').value = ex.time; $('#time-label').textContent = timeWords(ex.time);
  const p = exploreParams(), cur = run(p), ghost = run({ ...NORMAL_P, meal: ex.meal });
  const drugs = [...ex.drugs].map(d => ({ insulin: 'insulin', metformin: 'metformin', sulfonylurea: 'a sulfonylurea', sglt2: 'an SGLT2 inhibitor', glp1: 'a GLP-1 receptor agonist', dpp4: 'a DPP-4 inhibitor' })[d]);
  const who = `${{ normal: 'a normal body', type1: 'type 1 diabetes', type2: 'type 2 diabetes' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const label = `Illustrative model of ${who}: blood sugar and insulin over the hours after the meal, over a dashed curve for normal; a dot marks ${timeWords(ex.time)} the meal. ${bandWords(cur, ex.time)} Compared with normal: ${describe(cur, ghost)}.`;
  $('#explore-visual').innerHTML = chartSvg(label, cur, { ghost, mark: ex.time }) + readoutList(rows(cur, ghost), 'Compared with normal');
  const lowest = Math.min(cur.fasting.G, ...cur.series.map(s => s.G));
  const urine = cur.series.reduce((a, s) => a + s.kidney, 0);
  const pt = cur.peak.t, when = pt === 0 ? 'at the meal' : `${timeWords(pt)} the meal`;
  $('#model-results').textContent = `Illustrative model output for ${who}: fasting ${mgdl(cur.fasting.G)} · peak ${mgdl(cur.peak.G)} ${when} · ${timeWords(ex.time)}${ex.time ? ' the meal' : ''}: ${mgdl(cur.at(ex.time).G)} · lowest ${mgdl(lowest)} · glucose lost in urine over four hours: ${urine < 0.5 ? 'none' : `${Math.round(urine)} mg/dL worth`}.`;
  $('#explore-chart').innerHTML = svg(`Illustrative chart of blood glucose over four hours after the meal, in mg/dL. Dashed: normal, fasting ${mgdl(ghost.fasting.G)}, peak ${mgdl(ghost.peak.G)}. Solid: ${who}, fasting ${mgdl(cur.fasting.G)}, peak ${mgdl(cur.peak.G)}.${REFBAND ? ` The shaded band is the quoted reference range, ${REFBAND[0]} to ${REFBAND[1]} mg/dL.` : ''}`, bigChart(cur, ghost), { h: 310 });
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = GM.build(r.value); ex.beta = d.beta; ex.sens = d.sens; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['beta', 'sens', 'meal', 'time']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', beta: 1, sens: 1, meal: 1, time: 45 }); ex.drugs.clear();
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
    const g = loaded.values?.find(v => v.id === 'glucose');
    if (!g || !Number.isFinite(g.low) || !Number.isFinite(g.high) || !loaded.values.every(v => Array.isArray(v.scale))) throw new Error('Invalid reference data');
    data = loaded;
    REFBAND = [g.low, g.high];
    $('#disclaimer').textContent = data.disclaimer;
    const base = run(NORMAL_P);
    $('#baseline-note').textContent = `How the numbers are made: the teaching model settles overnight to a fasting level of ${mgdl(base.fasting.G)}, inside both quoted ranges, then eats one ordinary meal. Its blood glucose rises above the band for a while after eating, peaking near ${mgdl(base.peak.G)}, as the Figure 17.19 caption describes, and is back inside the band by ${timeWords(cv.time)}. The sizes of the disease and drug effects are illustrative; only their directions are meant to teach.`;
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = hasRange(v), typical = Number.isFinite(v.typical) && !range;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const bandR = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = typical ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${bandR}${typ}${marker}</svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range as a shaded band${v.modelKey ? ', a solid marker for the current illustrative model and, when a state is compared, a dashed marker for what it is compared with' : ''}`);
      const [lo, hi] = v.scale;
      right.querySelector('.key').textContent = `${range ? `Source range ${v.low} to ${v.high} ${v.unit} (shaded)` : `Source typical value ${v.typical} ${v.unit} (tick; no range given)`} · bar runs ${lo} to ${hi} ${v.unit} · blue line: model`;
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
    data = null;
    REFBAND = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
