// The Nephron and Diuretics · The Lab · the nephron picture
// One drawing shared by the lesson, Clinical values and Explore freely: a nephron whose arrows are sized
// by how much salt and water each segment takes back, the urine left at the end, a gauge for blood
// volume, and salt (Na+) travelling the tube. Every picture is an SVG string 480 wide and at most 420
// tall (lab/FORMAT.md, "Pictures"). Sizes come from the model (model.js) through vis(); nothing here
// carries a reference number.
import { C, f, clamp, lerp, text, rect, circle, path, arrowTo, part } from '/lab/kit/draw.js';

export const SALT = C.amber, WATER = C.blue, POT = C.purple, BLOOD = C.red;
const LUMEN = '#e4e9ff', GLOW = '#ffe29a', WALL = C.ink, GHOST = C.ink;
// Bands of the kidney: the outer layer, then the medulla, saltier the deeper it goes.
const CORTEX = [243, 241, 231], MEDULLA = [[247, 232, 208], [242, 218, 180], [235, 202, 150]];
const rgb = (a, b, t) => `rgb(${a.map((x, i) => Math.round(lerp(x, b[i], clamp(t, 0, 1)))).join(',')})`;
export const W_BANDS = 346;

/* ---------- Geometry: the tube's centre line, from simple curves ---------- */
const quad = (a, c, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
const seg = (a, b) => [a, b];
const arc = (cx, cy, r, from, to, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const th = (from + (to - from) * i / n) * Math.PI / 180;
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
});
const join = (...parts) => parts.reduce((all, p, i) => all.concat(i ? p.slice(1) : p), []);

export const GLOM = { x: 54, y: 72, r: 24 };
export const SEG = {
  pt: join(quad([78, 72], [90, 34], [106, 68]), quad([106, 68], [120, 100], [134, 68]), quad([134, 68], [148, 34], [160, 72]), seg([160, 72], [160, 140])),
  desc: seg([160, 140], [160, 326]),
  thin: join(arc(190, 326, 30, 180, 0), seg([220, 326], [220, 286])),
  tal: seg([220, 286], [220, 120]),
  dct: join(quad([220, 120], [216, 78], [258, 80]), quad([258, 80], [318, 82], [332, 118])),
  cd: join(seg([332, 118], [332, 352]), quad([332, 352], [332, 374], [348, 374], 6), seg([348, 374], [352, 374])),
};
export const ORDER = ['pt', 'desc', 'thin', 'tal', 'dct', 'cd'];
const pathD = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');

// A function from 0..1 to a point evenly spaced along a polyline, and the polyline's length.
function along(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = s => {
    const d = clamp(s, 0, 1) * total;
    let j = 0;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const k = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * k, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * k];
  };
  return { at, total };
}
// The whole tube as one track, with where each segment starts and ends on it (0..1).
const TR = along(join(...ORDER.map(k => SEG[k])));
export const SPAN = (() => {
  const out = {};
  let s = 0;
  for (const k of ORDER) { const len = along(SEG[k]).total / TR.total; out[k] = [s, s + len]; s += len; }
  return out;
})();
export const trackAt = TR.at;

/* ---------- The parts ---------- */
// g: how salty the medulla is kept, 1 normal; a loop diuretic washes it out.
export function bands(g = 1, { labels = false, lit = true } = {}) {
  let m = '';
  MEDULLA.forEach((c, i) => { m += rect(0, 140 + i * 80, W_BANDS, 80, rgb(CORTEX, c, g)); });
  let s = rect(0, 0, W_BANDS, 140, rgb(CORTEX, CORTEX, 0)) + (lit ? part('medulla', m) : m);
  if (labels) s += text(8, 132, 'outer layer', 'xs muted', 'start') + text(8, 350, 'medulla:', 'xs b', 'start') + text(8, 371, 'deep and salty', 'xs b', 'start');
  return s;
}
const SEG_PART = { pt: 'proximal', desc: 'loop', thin: 'loop', tal: 'loop tal', dct: 'distal', cd: 'collecting' };
export function glow(keys) {
  return [].concat(keys || []).map(k => k === 'glom'
    ? circle(GLOM.x, GLOM.y, GLOM.r + 10, GLOW)
    : path(pathD(SEG[k]), GLOW, 34)).join('');
}
// parts: 'segments' tags each segment for the caption's terms; 'whole' tags the tube as one nephron.
export function tube({ parts = 'segments' } = {}) {
  let s = path(`M0 60 L${GLOM.x - 21} 66`, BLOOD, 6) + path(`M${GLOM.x - 21} 79 L0 85`, BLOOD, 6);
  const glom = circle(GLOM.x, GLOM.y, GLOM.r, '#fff', WALL, 3) + circle(GLOM.x, GLOM.y, 14, '#f6dcd8', BLOOD, 2)
    + path(`M${GLOM.x - 10} ${GLOM.y - 2}q3.5 -8 7 0t7 0t7 0M${GLOM.x - 8} ${GLOM.y + 5}q3.5 6 7 0t7 0`, BLOOD, 2);
  // Every wall first, then every lumen, so the joins between segments do not show.
  const wrap = (k, d) => parts === 'segments' ? part(SEG_PART[k], d) : d;
  const segs = ORDER.map(k => wrap(k, path(pathD(SEG[k]), WALL, 13))).join('') + ORDER.map(k => wrap(k, path(pathD(SEG[k]), LUMEN, 8))).join('');
  return parts === 'whole' ? s + part('nephron', glom + segs) : s + (parts === 'segments' ? part('glomerulus', glom) : glom) + segs;
}

// Arrows out of the tube (salt or water back to the blood) and potassium into it. Block arrows, so
// their width carries an amount; shape and colour, not only colour, tell salt, water and potassium apart.
export const ARROWS = {
  ptSalt: { x: 91, y: 42, dir: 'up', len: 28, kind: 'salt' },
  ptWater: { x: 147, y: 42, dir: 'up', len: 28, kind: 'water' },
  descWater: { x: 152, y: 236, dir: 'left', len: 36, kind: 'water' },
  talSalt: { x: 228, y: 206, dir: 'right', len: 40, kind: 'salt' },
  dctSalt: { x: 262, y: 70, dir: 'up', len: 28, kind: 'salt' },
  cdSalt: { x: 324, y: 252, dir: 'left', len: 34, kind: 'salt' },
  cdWater: { x: 324, y: 312, dir: 'left', len: 34, kind: 'water' },
  cdK: { x: 372, y: 192, dir: 'left', len: 32, kind: 'k' },
};
export const ALL = Object.keys(ARROWS);
const FILL = { salt: SALT, water: WATER, k: POT };
const ARROW_PART = { ptSalt: 'proximal', ptWater: 'proximal', descWater: 'loop', talSalt: 'loop tal carrier', dctSalt: 'distal', cdSalt: 'collecting aldosterone', cdWater: 'collecting adh', cdK: 'potassium' };
const UNIT = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function arrowPoints(a, w) {
  const hw = w / 2, hh = Math.max(hw + 4, w * .75), hl = Math.min(a.len * .45, Math.max(8, w * .6));
  const loc = [[0, -hw], [a.len - hl, -hw], [a.len - hl, -hh], [a.len, 0], [a.len - hl, hh], [a.len - hl, hw], [0, hw]];
  const [ux, uy] = UNIT[a.dir];
  return loc.map(([s, c]) => `${f(a.x + ux * s - uy * c)},${f(a.y + uy * s + ux * c)}`).join(' ');
}
function arrowShape(k, w, { faded = false, outline = false } = {}) {
  if (!(w > .3)) return '';
  const a = ARROWS[k];
  const look = outline ? `fill="none" stroke="${GHOST}" stroke-width="1.6" stroke-dasharray="4 3" stroke-linejoin="round"`
    : `fill="${FILL[a.kind]}"${faded ? ' opacity=".3"' : ''}`;
  return `<polygon data-arrow="${k}" points="${arrowPoints(a, w)}" ${look}/>`;
}
export const arrows = (v, keys, opt = {}) => keys.map(k => opt.outline || opt.faded ? arrowShape(k, v[k], opt) : part(ARROW_PART[k], arrowShape(k, v[k], opt))).join('');
export const arrowEnd = k => { const a = ARROWS[k], [ux, uy] = UNIT[a.dir]; return [a.x + ux * a.len, a.y + uy * a.len]; };

// Urine at the end of the tube: a salt bar and a water bar.
export const UB = { x: 352, y: 236, w: 122, h: 166, base: 374 };
const BAR_X = { salt: UB.x + 14, water: UB.x + 68 };
export function urineBox() {
  return part('urine', rect(UB.x, UB.y, UB.w, UB.h, '#fff', C.ink, 1.5, 'rx="6"') + text(UB.x + UB.w / 2, UB.y + 24, 'urine', 'b on-white')
    + path(`M${UB.x + 6} ${UB.base} H${UB.x + UB.w - 6}`, C.ink, 1.5)
    + text(BAR_X.salt + 20, UB.base + 20, 'salt', 'xs on-white') + text(BAR_X.water + 20, UB.base + 20, 'water', 'xs on-white'));
}
export function urineBars(v, { outline = false } = {}) {
  const bar = (x, h, col) => outline
    ? rect(x, UB.base - h, 40, h, 'none', GHOST, 1.6, 'stroke-dasharray="4 3"')
    : rect(x, UB.base - h, 40, h, col);
  return `<g data-bars${outline ? '="normal"' : ''}>${bar(BAR_X.salt, v.uSalt, SALT)}${bar(BAR_X.water, v.uWater, WATER)}</g>`;
}

// Blood volume: a container of blood that fills or empties.
export const GA = { x: 396, y: 40, w: 60, h: 108 };
export const gaugeY = level => GA.y + GA.h - 4 - level * (GA.h - 8);
export function gauge(v, ghost = null) {
  const y = gaugeY(v.level);
  let s = text(GA.x + GA.w / 2 - 10, 26, 'blood volume', 'sm b') + rect(GA.x, GA.y, GA.w, GA.h, '#fff', C.ink, 1.5, 'rx="12"');
  s += part('blood-volume', rect(GA.x + 4, y, GA.w - 8, GA.y + GA.h - 4 - y, BLOOD, 'none', 0, 'rx="8"'));
  if (ghost) s += `<g data-ghost="normal">${path(`M${GA.x - 8} ${f(gaugeY(ghost.level))} H${GA.x + GA.w + 8}`, GHOST, 2, 'stroke-dasharray="6 4"')}</g>`;
  return s;
}

// The "blocked" mark sits on the tube where each drug acts.
export const BLOCK_AT = { ca: [120, 84], loop: [220, 236], thiazide: [258, 80], ksp: [332, 282] };
export function blocker(drug, a = 1) {
  if (!(a > 0)) return '';
  const [x, y] = BLOCK_AT[drug];
  return `<g data-block="${drug}" data-part="block" opacity="${f(a)}">${circle(x, y, 12, '#fff', BLOOD, 3.5)}${path(`M${x - 7.5} ${y + 7.5} L${x + 7.5} ${y - 7.5}`, BLOOD, 3.5)}</g>`;
}

// Small icons: salt is a diamond, water a drop.
export const saltIcon = (x, y, r = 5.5, extra = '') => `<path d="M${f(x)} ${f(y - r)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r)}L${f(x - r)} ${f(y)}Z" fill="${SALT}" stroke="#fff" stroke-width="1.2" ${extra}/>`;
export const dropIcon = (x, y, r = 5, extra = '') => `<path d="M${f(x)} ${f(y - r * 1.35)}C${f(x + r * .5)} ${f(y - r * .6)} ${f(x + r)} ${f(y)} ${f(x + r)} ${f(y + r * .4)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y + r * .4)}C${f(x - r)} ${f(y)} ${f(x - r * .5)} ${f(y - r * .6)} ${f(x)} ${f(y - r * 1.35)}Z" fill="${WATER}" stroke="#fff" stroke-width="1.2" ${extra}/>`;

/* ---------- Salt on the move ----------
   N particles travel the tube once per cycle (phase 0..1). Each has a fixed number u in 0..1, and the
   shares the model gives each segment decide its fate: taken back in that segment (it steps out of the
   tube the way that segment's arrow points, and fades) or carried on into the urine. */
const OUT = { pt: [0, -1], tal: [1, 0], dct: [0, -1], cd: [-1, 0] };
const FATE_SEG = ['pt', 'tal', 'dct', 'cd'];
const frac = x => x - Math.floor(x);
export function saltFlow(shares, phase, { n = 44, mannitol = 0 } = {}) {
  const cum = [];
  let acc = 0;
  for (const k of FATE_SEG) { acc += (shares[k] || 0) / 100; cum.push(acc); }
  let s = '';
  for (let i = 0; i < n; i++) {
    const u = frac(i * .6180339887 + .31), spread = frac(i * .41421356 + .17);
    const fate = cum.findIndex(c => u < c), k = fate < 0 ? 'out' : FATE_SEG[fate];
    const pos = frac(phase + i / n) * 1.12;          // along the tube to 1, then into the urine
    if (k === 'out') {
      if (pos <= 1) { const [x, y] = TR.at(pos); s += saltIcon(x, y); }
      else { const q = (pos - 1) / .12; s += saltIcon(UB.x + 4 + 26 * q, UB.base - 4 - 10 * q, 5.5, `opacity="${f(1 - q)}"`); }
      continue;
    }
    const [a, b] = SPAN[k], exit = a + (b - a) * (.1 + .8 * spread);
    if (pos <= exit) { const [x, y] = TR.at(pos); s += saltIcon(x, y); continue; }
    const q = (pos - exit) / .06;
    if (q >= 1) continue;
    const [x, y] = TR.at(exit), [ox, oy] = OUT[k];
    s += saltIcon(x + ox * 28 * q, y + oy * 28 * q, 5.5, `opacity="${f(1 - q)}"`);
  }
  // Mannitol is never taken back: every particle rides the whole tube.
  let m = '';
  if (mannitol > 0) for (let i = 0; i < 16; i++) {
    const [x, y] = TR.at(frac(phase + i / 16 + .03));
    m += circle(x, y, 4.2, '#4d5147', '#fff', 1.2);
  }
  return (n ? `<g data-flow data-part="sodium">${s}</g>` : '') + (m ? `<g data-part="mannitol" opacity="${f(mannitol)}">${m}</g>` : '');
}

/* ---------- Model to picture sizes ---------- */
const aw = v => Math.min(24, 2.5 + 2.3 * Math.sqrt(Math.max(0, v)));
const bar = v => Math.max(3, 96 * Math.min(1, Math.sqrt(Math.max(0, v) / 25)));
export function vis(m) {
  return {
    ptSalt: aw(m.s.pt), ptWater: aw(m.w.pt), descWater: aw(m.w.desc), talSalt: aw(m.s.tal),
    dctSalt: aw(m.s.dct), cdSalt: aw(m.s.cd), cdWater: aw(m.w.cd),
    cdK: Math.min(18, 2 + 4.5 * Math.sqrt(m.kDrive)),
    uSalt: bar(m.saltOut), uWater: bar(m.waterOut),
    level: clamp(.72 - (1 - m.bv) * 2.8, .12, .92),
    g: m.gradient,
    shares: { pt: m.s.pt, tal: m.s.tal, dct: m.s.dct, cd: m.s.cd },
  };
}
export function lerpVis(a, b, t) {
  const o = {};
  for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : a[k];
  o.shares = Object.fromEntries(Object.keys(a.shares).map(k => [k, lerp(a.shares[k], b.shares[k], t)]));
  return o;
}

/* ---------- The whole nephron, for the drug steps and the reference tabs ----------
   o: { v, ghost, target (the state being morphed to), flow (phase or null), drug (blocked target), block (0..1),
        mannitol (0..1), words } */
export function nephron(o) {
  const { v, ghost = null } = o;
  let s = bands(v.g, { lit: true }) + tube();
  // The dashed normal outline only on arrows that move: on an unchanged arrow it would only blur its edge.
  const target = o.target || v;
  if (ghost) s += `<g class="ghost" data-ghost="normal">${arrows(ghost, ALL.filter(k => Math.abs(target[k] - ghost[k]) > .8), { outline: true })}</g>`;
  s += arrows(v, ALL);
  if (o.flow !== null && o.flow !== undefined) s += saltFlow(v.shares, o.flow, { mannitol: o.mannitol || 0 });
  if (o.drug && o.drug !== 'osmotic') s += blocker(o.drug, o.block ?? 1);
  s += urineBox() + urineBars(v);
  if (ghost) s += `<g class="ghost" data-ghost="normal">${urineBars(ghost, { outline: true })}</g>`;
  s += gauge(v, ghost);
  s += text(ARROWS.cdK.x + 6, ARROWS.cdK.y + 6, 'potassium', 'xs b purple', 'start');
  return s + (o.words || '');
}
export { arrowTo };
