// Lesson 19: The bacterial cell and antibiotic targets. The kit (/lab/kit/kit.js) runs the page; this file is the
// pictures and the Clinical values and Explore freely tabs. The teaching model is model.js (window.BCModel), a
// classic script loaded before this module.
//
// Expected behaviour:
//   - Every picture is 480 wide and at most 420 tall, one idea each, with the kit's type (20, .sm 18, .xs 17).
//   - The processes move: the gates pass food and waste, water presses on the wall, a brick is tied in, the DNA is
//     wound and unwound, a ribosome adds blocks to its chain, the folate line runs and the bacteria double.
//   - Each "What changes it" step runs the normal machine at t = 0 over a dashed ghost of normal, then the drug
//     arrives and the change is named on the picture in words (blue: what moved; red: the drug and the harm). Its
//     readout comes from the same model as Explore freely.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease as EASE, span, svg, text, line, circle, rect, path, arrowTo, part, readout } from '/lab/kit/draw.js';

const ease = EASE.out;

const BM = window.BCModel;
const NV = BM.NORMAL;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ---------- Drawing ---------- */
const CYTO = '#fbf5e8', LIPID = '#e6dcc4', RIBO_L = '#d8cfb8', RIBO_S = '#ece5d3', NUC = '#e9e2cf';
const WASH = '#7d93ff', GATE = '#8b8f82';
// f(0) is 0, so a fully faded group reads opacity="0", which the lesson walk skips.
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const show = (a, body) => (a <= 0.02 ? '' : `<g ${fade(a)}>${body}</g>`);
const cap = (cx, cy, w, h, extra = '') => `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" ${extra}/>`;
// A point on a capsule's outline, s units round from the top left of its straight top edge, with its outward normal.
function capPoint(cx, cy, w, h, s) {
  const r = h / 2, L = w - h, P = 2 * L + 2 * Math.PI * r;
  s = ((s % P) + P) % P;
  if (s < L) return [cx - L / 2 + s, cy - r, 0, -1];
  s -= L;
  if (s < Math.PI * r) { const a = -Math.PI / 2 + s / r; return [cx + L / 2 + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }
  s -= Math.PI * r;
  if (s < L) return [cx + L / 2 - s, cy + r, 0, 1];
  s -= L;
  const a = Math.PI / 2 + s / r;
  return [cx - L / 2 + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
}
const capLength = (w, h) => 2 * (w - h) + Math.PI * h;
// A coiled loop of DNA.
function loopPath(cx, cy, rx, ry, k, amp) {
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const th = 2 * Math.PI * i / 160, r = 1 + amp * Math.sin(k * th);
    pts.push(`${f(cx + rx * r * Math.cos(th))} ${f(cy + ry * r * Math.sin(th))}`);
  }
  return `M${pts.join(' L')} Z`;
}
const block = (x, y, w, h, extra = '') => rect(x - w / 2, y - h / 2, w, h, C.red, '#fff', 1.5, `rx="3" ${extra}`);
// The cell membrane as a strip: two oily lines with a band between.
const strip = (x0, x1, y) => rect(x0, y, x1 - x0, 10, LIPID) + line(x0, y, x1, y, C.ink, 2.5) + line(x0, y + 10, x1, y + 10, C.ink, 2.5);
const dotsIn = (n, x0, y0, w, h, r = 3) => Array.from({ length: n }, (_, i) => circle(x0 + ((0.5 + i * 0.7548777) % 1) * w, y0 + ((0.5 + i * 0.5698403) % 1) * h, r, C.muted, 'none', 0, 'opacity=".35"')).join('');

/* ---------- 1. One tiny living cell ---------- */
function cellPic() {
  let s = part('yours', circle(128, 156, 108, '#fff', C.ink, 2.5) + circle(146, 144, 40, NUC, C.muted, 2));
  s += text(146, 150, 'nucleus', 'xs muted on-white');
  s += text(128, 296, 'one of your cells', 'sm b');
  const bugs = [[318, 104, -14], [352, 128, 10], [322, 150, 28], [368, 90, -32], [374, 160, 4]];
  s += part('bacterium', bugs.map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})">${cap(x, y, 26, 11, `fill="${CYTO}" stroke="${C.amber}" stroke-width="2.5"`)}</g>`).join(''));
  s += arrowTo(318, 210, 338, 178, C.ink, 2);
  s += text(262, 234, 'bacteria, to scale', 'sm b', 'start') + text(262, 258, 'each a whole living cell', 'xs', 'start');
  return s;
}

/* ---------- 2. The membrane, with gates ---------- */
const MEM = { cx: 240, cy: 180, w: 400, h: 190 };
function membranePic(t) {
  let s = part('membrane', cap(MEM.cx, MEM.cy, MEM.w, MEM.h, `fill="${LIPID}" stroke="${C.ink}" stroke-width="3"`) + cap(MEM.cx, MEM.cy, MEM.w - 14, MEM.h - 14, `fill="${CYTO}" stroke="${C.ink}" stroke-width="3"`));
  s += dotsIn(18, 90, 120, 300, 120);
  // Two gates, one on top, one below.
  s += part('gate', rect(162, 80, 16, 16, GATE, C.ink, 1.5, 'rx="3"') + rect(312, 264, 16, 16, GATE, C.ink, 1.5, 'rx="3"'));
  // Food comes in through the top gate; waste goes out through the bottom one.
  const food = (t + 0.62) % 1, waste = (t + 0.7) % 1;
  s += circle(170, lerp(24, 150, food), 7, C.green, '#fff', 1.5, fade(Math.min(1, food * 6, (1 - food) * 6)));
  s += rect(314, lerp(210, 334, waste) - 6, 12, 12, C.amber, '#fff', 1.5, fade(Math.min(1, waste * 6, (1 - waste) * 6)));
  s += text(186, 44, 'food in', 'xs b green', 'start') + text(336, 340, 'waste out', 'xs b', 'start');
  s += text(40, 316, 'cell membrane', 'sm b', 'start') + line(84, 300, 96, 274, C.ink, 1.5);
  s += text(154, 70, 'a gate', 'xs muted', 'end');
  s += text(240, 196, 'watery inside', 'xs muted');
  s += text(464, 34, 'outside', 'xs muted', 'end');
  return s;
}

/* ---------- 3. The wall: a net around the balloon ---------- */
const WALLCELL = { cx: 240, cy: 214, w: 420, h: 220 };
function netRing(cx, cy, w, h, strength = 1, ghostOnly = false) {
  // Three sugar chains run round the cell (dashed amber rings), tied by short bridges (ink ticks).
  let chains = '', bridges = '', ghosts = '';
  for (const inset of [3, 12, 21]) chains += cap(cx, cy, w - 2 * inset, h - 2 * inset, `fill="none" stroke="${C.amber}" stroke-width="4.5" stroke-dasharray="22 5"`);
  const mid = capLength(w - 24, h - 24);
  for (let k = 0, s = 0; s < mid - 8; k++, s += 17) {
    const [x, y, nx, ny] = capPoint(cx, cy, w - 24, h - 24, s);
    const [a, b] = k % 2 ? [-9, 0] : [0, 9];
    ghosts += line(x + nx * a, y + ny * a, x + nx * b, y + ny * b, C.ghost, 1.5, 'stroke-dasharray="2 2"');
    const op = clamp((strength - ((k * 7) % 10) / 10 * 0.9 - 0.05) / 0.1 + 0.5, 0, 1);
    if (op > 0.02) bridges += line(x + nx * a, y + ny * a, x + nx * b, y + ny * b, C.ink, 2.6, fade(op));
  }
  return ghostOnly ? ghosts : chains + bridges;
}
function wallPic(t) {
  const { cx, cy, w, h } = WALLCELL;
  let s = part('wall', netRing(cx, cy, w, h));
  // The balloon: the membrane and the watery inside, pressing out on the net.
  const push = 0.5 + 0.5 * Math.sin(2 * Math.PI * t);
  s += part('membrane', cap(cx, cy, w - 54 + 4 * push, h - 54 + 4 * push, `fill="${CYTO}" stroke="${C.ink}" stroke-width="3"`));
  // Water seeps in from outside, through the net.
  for (const [k, frac] of [[0, 0.1], [1, 0.6], [2, 0.8]]) {
    const [x, y, nx, ny] = capPoint(cx, cy, w, h, frac * capLength(w, h));
    s += arrowTo(x + nx * 44, y + ny * 44, x + nx * 10, y + ny * 10, C.blue, 2.2);
    const u = (t + k / 3) % 1, d = lerp(46, -22, u);
    s += circle(x + nx * d, y + ny * d, 5, C.blue, '#fff', 1, fade(Math.min(1, u * 5, (1 - u) * 4)));
  }
  // The inside presses out on the wall.
  for (const [x2, y2] of [[118, 214], [362, 214], [240, 126], [240, 302]]) {
    const len = 0.55 + 0.45 * push;
    s += arrowTo(lerp(cx, x2, 0.45), lerp(cy, y2, 0.45), lerp(cx, x2, 0.45 + 0.5 * len), lerp(cy, y2, 0.45 + 0.5 * len), C.blue, 3);
  }
  s += text(240, 208, 'the inside', 'xs b blue') + text(240, 230, 'presses out', 'xs b blue');
  s += text(20, 34, 'cell wall: sugar chains', 'sm b amber', 'start') + text(20, 56, 'tied by short bridges', 'xs', 'start') + line(70, 62, 84, 100, C.ink, 1.5);
  s += text(464, 40, 'water seeps in', 'xs b blue', 'end');
  s += text(464, 366, 'membrane inside the wall', 'xs', 'end') + line(392, 350, 376, 304, C.ink, 1.5);
  return s;
}

/* ---------- 4, 13, 14. Building the wall: the close-up slice ----------
   Outside on top, three rows of wall bricks tied by bridges, the membrane, the inside below. A new brick with a
   D-Ala-D-Ala tip rises into the bottom row; a wall-building enzyme grips the tip, cuts off the last D-Ala and ties a
   bridge to the row above. */
const ROWY = [52, 100, 148], BH = 16, BW = 48, X_END = 330;
const MEMY = 200, SLOT = 268, STEMX = 282;
function rowBricks(r) {
  const off = r === 1 ? 0 : 28, out = [];
  if (off) out.push([16, off - 8]);
  for (let x = 16 + off; x + BW <= X_END + 2; x += BW + 8) if (!(r === 2 && x === SLOT)) out.push([x, BW]);
  return out;
}
const BRIDGES = [[0, 58], [0, 170], [0, 254], [1, 102], [1, 214], [1, 46]];   // [gap below row r, x]
function slice(o) {
  // o: { brickY, enzX, tipCut, bridge, oldBridges, ghost, drug, clamp, bulge, burst }
  let s = text(16, 30, 'outside the cell', 'xs muted', 'start');
  s += rect(16, MEMY + 12, 448, 200, CYTO);
  if (!(o.bulge > 0.01)) s += part('membrane', strip(16, 464, MEMY));
  // Bricks: the sugar chains.
  let bricks = '';
  ROWY.forEach((y, r) => { for (const [x, w] of rowBricks(r)) bricks += rect(x, y, w, BH, C.amber, 'none', 0, 'rx="3"'); });
  s += part('chain', bricks);
  // Bridges between rows; the dashed ghost marks where they belong.
  let br = '', gh = '';
  for (const [r, x] of BRIDGES) {
    const y1 = ROWY[r] + BH, y2 = ROWY[r + 1];
    gh += line(x, y1, x, y2, C.ghost, 2, 'stroke-dasharray="3 3"');
    if (o.oldBridges > 0.02) br += line(x, y1, x, y2, C.ink, 4, fade(o.oldBridges));
  }
  if (o.ghost) s += `<g class="ghost" data-ghost="normal">${gh}${line(STEMX, ROWY[1] + BH, STEMX, 138, C.ghost, 2, 'stroke-dasharray="3 3"')}</g>`;
  // The new brick, its stem and its D-Ala-D-Ala tip.
  const by = o.brickY;
  let nb = rect(SLOT, by, BW, BH, C.amber, '#fff', 1, 'rx="3"') + line(STEMX, by, STEMX, by - 10, C.ink, 3);
  nb += part('tip', circle(STEMX, by - 15, 5, C.ink) + (o.tipCut < 1 ? circle(STEMX + 14 * o.tipCut, by - 25 - 26 * o.tipCut, 5, C.ink, 'none', 0, fade(1 - o.tipCut)) : ''));
  s += part('newbrick', nb);
  s += part('bridge', br + (o.bridge > 0.02 ? line(STEMX, 138, STEMX, 138 - 22 * o.bridge, C.ink, 4) : ''));
  // Vancomycin: a clamp over the tip.
  if (o.clamp > 0.02) s += part('drug', `<path d="M${STEMX - 12} ${f(by - 4 - 60 * (1 - o.clamp))} A13 13 0 1 1 ${STEMX + 12} ${f(by - 4 - 60 * (1 - o.clamp))}" fill="none" stroke="${C.red}" stroke-width="5.5" stroke-linecap="round" ${fade(Math.min(1, o.clamp * 3))}/>`);
  s += part('enzyme', enzyme(o.enzX, 130, o.drug));
  if (o.bulge > 0.01) s += part('membrane', bulgeMembrane(o.bulge, o.burst));
  return s;
}
// The wall-building enzyme: a white grabber with its mouth to the left. A beta-lactam wedges into the mouth.
function enzyme(x, y, drug = 0) {
  let s = `<path d="M${f(x - 14)} ${f(y - 8)} A17 17 0 1 1 ${f(x - 14)} ${f(y + 8)} L${f(x - 2)} ${f(y)} Z" fill="#fff" stroke="${C.ink}" stroke-width="2.4"/>`;
  if (drug > 0.02) s += `<g data-part="drug" ${fade(Math.min(1, drug * 2))}><path d="M${f(x - 18)} ${f(y - 9 - 50 * (1 - drug))} L${f(x - 3)} ${f(y - 50 * (1 - drug))} L${f(x - 18)} ${f(y + 9 - 50 * (1 - drug))} Z" fill="${C.red}" stroke="#fff" stroke-width="1.5"/></g>`;
  return s;
}
// The membrane pushes up through the weakened net and, at the end, tears open at the top.
const TEARX = 190;
function bulgeMembrane(b, burst) {
  const pts = [];
  for (let x = 16; x <= 464; x += 4) {
    const u = clamp((x - 130) / 120, 0, 1), bump = u > 0 && u < 1 ? Math.pow(Math.sin(Math.PI * u), 0.7) : 0;
    pts.push([x, MEMY + 5 - 104 * b * bump]);
  }
  const top = MEMY + 5 - 104 * b;
  let s = `<path d="M${pts.map(([x, y]) => `${x} ${f(y)}`).join(' L')} L464 ${MEMY + 12} L16 ${MEMY + 12} Z" fill="${CYTO}"/>`;
  // Split the membrane where it tears.
  const tear = 28 * burst, segs = [[]];
  for (const p of pts) { if (burst > 0.02 && Math.abs(p[0] - TEARX) < tear) { if (segs.at(-1).length) segs.push([]); } else segs.at(-1).push(p); }
  for (const seg of segs) if (seg.length > 1) {
    const d = `M${seg.map(([x, y]) => `${x} ${f(y)}`).join(' L')}`;
    s += path(d, C.ink, 12.5) + path(d, LIPID, 7.5);
  }
  // The contents spill out of the tear.
  if (burst > 0.02) for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.3, r = (30 + 14 * (i % 3)) * burst; s += circle(TEARX + Math.cos(a) * r, top + 2 + Math.sin(a) * r, 3.5, C.muted, 'none', 0, fade(burst)); }
  return s;
}
function buildPic(t) {
  const rise = ease(span(t, 0, 0.22)), grip = ease(span(t, 0.25, 0.42)) * (1 - ease(span(t, 0.8, 0.95)));
  const o = { brickY: lerp(306, ROWY[2], rise), enzX: lerp(360, 304, grip), tipCut: ease(span(t, 0.45, 0.6)), bridge: ease(span(t, 0.6, 0.78)), oldBridges: 1 };
  let s = slice(o);
  s += text(340, 82, 'wall-building', 'xs b', 'start') + text(340, 104, 'enzyme', 'xs b', 'start');
  s += show(1 - span(t, 0.55, 0.65), text(340, 178, 'D-Ala-D-Ala tip', 'xs b', 'start') + line(338, 168, 292, 134, C.ink, 1.4));
  s += show(span(t, 0.72, 0.82), text(340, 178, 'new bridge', 'xs b', 'start') + line(338, 168, 288, 128, C.ink, 1.4));
  s += show(span(t, 0.12, 0.22), text(292, 188, 'new brick', 'xs b amber'));
  s += text(16, 238, 'membrane', 'xs muted', 'start');
  s += text(240, 262, 'new bricks are made inside the cell,', 'xs muted') + text(240, 284, 'then tied in, bridge by bridge', 'xs muted');
  return s;
}
// A wall drug: the machine runs normally for a moment, then the drug stops the bridge being tied.
function wallDrugPic(kind, t) {
  const drugIn = ease(span(t, 0.1, 0.32));
  const fadeOld = ease(span(t, 0.36, 0.72)), bulge = ease(span(t, 0.62, 0.9)), burst = ease(span(t, 0.88, 1));
  const o = { brickY: ROWY[2], tipCut: 0, bridge: 0, oldBridges: 1 - 0.85 * fadeOld, ghost: true, bulge: 0.72 * bulge, burst };
  if (kind === 'betalactam') { o.enzX = 360; o.drug = drugIn; o.clamp = 0; }
  else { o.clamp = drugIn; o.drug = 0; o.enzX = lerp(360, 318, Math.sin(Math.PI * span(t, 0.3, 0.5))); }
  let s = slice(o);
  const a = span(t, 0.3, 0.5);
  if (kind === 'betalactam') s += show(a, text(464, 30, 'beta-lactam jams the enzyme', 'xs b red', 'end'));
  else s += show(a, text(464, 30, 'vancomycin covers the tip', 'xs b red', 'end'));
  s += text(340, 82, 'wall-building', 'xs b', 'start') + text(340, 104, 'enzyme', 'xs b', 'start');
  s += show(1 - span(t, 0.3, 0.4), text(340, 178, 'D-Ala-D-Ala tip', 'xs b', 'start'));
  s += show(span(t, 0.4, 0.55), text(340, 178, 'no new bridge', 'xs b blue', 'start'));
  const b = span(t, 0.6, 0.8);
  s += show(b, text(464, 250, '↓ bridges fade: the wall weakens', 'xs b blue', 'end'));
  s += show(span(t, 0.86, 0.98), text(464, 278, '↑ the membrane bulges out:', 'xs b blue', 'end') + text(464, 300, kind === 'betalactam' ? 'the cell bursts' : 'many kinds burst and die', 'xs b red', 'end'));
  if (kind === 'vancomycin') s += show(span(t, 0.9, 1), text(16, 332, 'too big to cross a gram-negative outer membrane', 'xs muted', 'start'));
  return s;
}

/* ---------- 5. Two kinds of wall ---------- */
function gramPic() {
  let s = line(240, 20, 240, 290, C.rule, 1.5);
  const brickRow = (x0, x1, y) => { let r = ''; for (let x = x0; x + 24 <= x1; x += 28) r += rect(x, y, 24, 11, C.amber, 'none', 0, 'rx="2"'); return r; };
  const mem = (x0, x1, y) => rect(x0, y, x1 - x0, 9, LIPID) + line(x0, y, x1, y, C.ink, 2.5) + line(x0, y + 9, x1, y + 9, C.ink, 2.5);
  const big = (x, y) => circle(x, y, 13, '#c9ccc2', C.ink, 1.8) + circle(x - 4, y - 3, 3, C.ink);
  // Gram-positive: a thick wall, many rows, outside the membrane.
  let pw = '';
  for (let r = 0; r < 6; r++) pw += brickRow(16 + (r % 2) * 12, 140, 110 + r * 15);
  s += part('pos', text(124, 34, 'gram-positive', 'sm b') + pw + mem(16, 140, 210));
  s += text(150, 160, 'thick', 'xs b amber', 'start') + text(150, 180, 'wall', 'xs b amber', 'start') + text(150, 222, 'membrane', 'xs', 'start');
  s += big(78, 64) + arrowTo(78, 80, 78, 104, C.ink, 2.2);
  s += text(124, 262, 'stays purple', 'xs b purple');
  // Gram-negative: an outer membrane, then a thin wall, then the membrane.
  s += part('neg', text(358, 34, 'gram-negative', 'sm b'));
  s += part('outer', mem(256, 380, 116));
  s += part('neg', brickRow(258, 380, 164) + mem(256, 380, 210));
  s += text(388, 118, 'outer', 'xs b', 'start') + text(388, 138, 'membrane', 'xs b', 'start') + text(388, 176, 'thin wall', 'xs b amber', 'start') + text(388, 222, 'membrane', 'xs', 'start');
  s += big(318, 64) + `<path d="M310 88 L326 104 M326 88 L310 104" stroke="${C.red}" stroke-width="3.5" stroke-linecap="round"/>`;
  s += text(358, 262, 'stains pink', 'xs b red');
  s += text(240, 322, 'a large drug molecule gets through a thick wall,', 'xs muted') + text(240, 344, 'but an outer membrane keeps many out', 'xs muted');
  return s;
}

/* ---------- 6. DNA: one loop, loose in the cell ---------- */
function dnaPic() {
  let s = cap(220, 176, 400, 210, `fill="${CYTO}" stroke="${C.amber}" stroke-width="9"`) + cap(220, 176, 382, 192, `fill="none" stroke="${C.ink}" stroke-width="2.5"`);
  s += part('dna', `<path d="${loopPath(220, 176, 120, 66, 11, 0.16)}" fill="none" stroke="${C.blue}" stroke-width="3.5"/>`);
  s += text(220, 182, 'one loop of DNA,', 'xs b blue') + text(220, 204, 'coiled tight', 'xs b blue');
  s += text(20, 40, 'a bacterium: no nucleus;', 'sm b', 'start') + text(20, 62, 'its DNA floats loose', 'xs', 'start');
  // Your cell, for comparison: DNA kept inside a nucleus.
  s += circle(400, 352, 44, '#fff', C.ink, 2) + circle(406, 348, 20, NUC, C.muted, 2) + `<path d="${loopPath(406, 348, 10, 8, 5, 0.25)}" fill="none" stroke="${C.blue}" stroke-width="2"/>`;
  s += text(344, 340, 'your cell: DNA', 'xs', 'end') + text(344, 362, 'inside a nucleus', 'xs', 'end');
  return s;
}

/* ---------- 7, 17. Copying the DNA: the untangling enzymes ----------
   A copying fork (left) unzips the DNA. The DNA ahead winds tighter; an untangling enzyme (DNA gyrase or
   topoisomerase IV) cuts both strands, passes another stretch through the gap and seals it. */
const FORKX = 140, DY = 170, ENZX = 336;
function strands(x0, x1, y, amp, turns, gapAt = -1, gap = 0, cols = [C.blue, WASH]) {
  let a = '', b = '';
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, ph = turns * 2 * Math.PI * i / n;
    const cut = gap > 0.5 && Math.abs(x - gapAt) < gap / 2;
    const ya = y - amp * Math.cos(ph), yb = y + amp * Math.cos(ph);
    a += `${cut || i === 0 ? 'M' : 'L'}${f(x)} ${f(ya)} `;
    b += `${cut || i === 0 ? 'M' : 'L'}${f(x)} ${f(yb)} `;
  }
  return `<path d="${a}" fill="none" stroke="${cols[0]}" stroke-width="3.2"/><path d="${b}" fill="none" stroke="${cols[1]}" stroke-width="3.2"/>`;
}
function copyScene(o) {
  // o: { wind (0 relaxed to 1 tight), gap (0 sealed to 1 open), pass (0 to 1: the passing stretch), trapped, ghost }
  let s = '';
  // Behind the fork: two copies, done.
  s += part('copies', strands(16, FORKX - 6, DY - 34, 7, 2.2) + strands(16, FORKX - 6, DY + 34, 7, 2.2));
  s += `<path d="M${FORKX - 6} ${DY - 34} Q${FORKX + 4} ${DY - 30} ${FORKX + 18} ${DY}" fill="none" stroke="${C.blue}" stroke-width="3.2"/><path d="M${FORKX - 6} ${DY + 34} Q${FORKX + 4} ${DY + 30} ${FORKX + 18} ${DY}" fill="none" stroke="${WASH}" stroke-width="3.2"/>`;
  s += part('fork', rect(FORKX - 14, DY - 16, 30, 32, '#fff', C.blue, 2.5, 'rx="8"'));
  // Topoisomerase IV, between the two finished copies, unhooks them so they can separate.
  s += part('topo4', `<path d="M52 ${DY - 22} Q66 ${DY - 6} 80 ${DY - 22} M52 ${DY + 22} Q66 ${DY + 6} 80 ${DY + 22}" fill="none" stroke="${C.purple}" stroke-width="5.5" stroke-linecap="round"/>`);
  if (o.drug4 > 0.02) s += part('drug', block(66, DY, 20, 12, fade(Math.min(1, o.drug4 * 2))));
  // Ahead: wound tighter between the fork and the enzyme, then a relaxed stretch beyond it.
  const gapW = 26 * o.gap;
  if (o.ghost) s += `<g class="ghost" data-ghost="normal">${line(ENZX - 16, DY - 9, ENZX + 16, DY - 9, C.ghost, 2, 'stroke-dasharray="4 3"')}${line(ENZX - 16, DY + 9, ENZX + 16, DY + 9, C.ghost, 2, 'stroke-dasharray="4 3"')}</g>`;
  s += part('dna', strands(FORKX + 18, ENZX + gapW / 2, DY, 11, 3 + 3 * o.wind, ENZX, gapW) + strands(ENZX - gapW / 2, 464, DY, 11, 2.6, ENZX, gapW));
  if (o.pass > 0.02 && o.pass < 0.98) {
    const py = lerp(DY - 70, DY + 70, o.pass);
    s += `<g ${fade(Math.min(1, o.pass * 5, (1 - o.pass) * 5))}>${strands(ENZX - 26, ENZX + 26, py, 6, 1.2)}</g>`;
  }
  // The enzyme: two jaws round the DNA.
  const jaw = 18 - 6 * Math.max(o.gap, o.trapped || 0);
  s += part('enzyme', `<path d="M${ENZX - 22} ${f(DY - jaw - 14)} Q${ENZX} ${f(DY - jaw - 34)} ${ENZX + 22} ${f(DY - jaw - 14)} M${ENZX - 22} ${f(DY + jaw + 14)} Q${ENZX} ${f(DY + jaw + 34)} ${ENZX + 22} ${f(DY + jaw + 14)}" fill="none" stroke="${C.purple}" stroke-width="7" stroke-linecap="round"/>`);
  return s;
}
function copyPhase(u) {
  // One turn of the untangling cycle: wind up, cut, pass, seal.
  return { wind: ease(span(u, 0, 0.35)) * (1 - ease(span(u, 0.62, 0.82))), gap: ease(span(u, 0.35, 0.48)) * (1 - ease(span(u, 0.72, 0.86))), pass: span(u, 0.48, 0.7) };
}
function copyPic(t) {
  let s = copyScene(copyPhase(t));
  s += text(16, 106, 'two new copies', 'xs muted', 'start') + text(FORKX + 10, 236, 'copying', 'xs b blue');
  s += text(ENZX, 92, 'DNA gyrase', 'xs b purple') + text(ENZX, 252, 'eases the winding ahead', 'xs b');
  s += show(span(t, 0.12, 0.25) * (1 - span(t, 0.6, 0.7)), text(240, 126, 'winds tighter', 'xs b blue'));
  s += text(16, 292, 'topoisomerase IV', 'xs b purple', 'start') + text(16, 314, 'unhooks the copies', 'xs', 'start');
  s += text(464, 292, 'both cut both strands,', 'xs muted', 'end') + text(464, 314, 'pass DNA through, reseal', 'xs muted', 'end');
  return s;
}
function fluoroPic(t) {
  // Normal turn first (0 to 0.45 of the morph), then the next cut is trapped open.
  const first = copyPhase(span(t, 0, 0.42));
  const cut2 = ease(span(t, 0.5, 0.62)), drug = ease(span(t, 0.56, 0.7));
  const o = t < 0.46 ? { ...first, ghost: true, drug4: 0 } : { wind: ease(span(t, 0.46, 0.6)), gap: cut2, pass: 0, trapped: cut2, ghost: true, drug4: drug };
  let s = copyScene(o);
  if (drug > 0.02) s += part('drug', `<g ${fade(Math.min(1, drug * 2))}>${block(ENZX, DY - 26 - 40 * (1 - drug), 22, 14)}${block(ENZX, DY + 26 + 40 * (1 - drug), 22, 14)}</g>`);
  s += text(16, 106, 'two new copies', 'xs muted', 'start') + text(FORKX + 10, 236, 'copying', 'xs b blue');
  s += text(ENZX, 92, 'DNA gyrase', 'xs b purple') + text(16, 292, 'topoisomerase IV', 'xs b purple', 'start');
  s += show(span(t, 0.62, 0.74), text(464, 40, 'fluoroquinolone traps both enzymes', 'xs b red', 'end'));
  s += show(span(t, 0.7, 0.82), text(ENZX, 252, 'the cut is never sealed', 'xs b blue'));
  s += show(span(t, 0.8, 0.92), text(464, 292, '↓ copying stops; the broken', 'xs b blue', 'end') + text(464, 314, 'DNA kills the cell', 'xs b red', 'end'));
  return s;
}

/* ---------- 8, 15, 16. A ribosome making a protein ----------
   The copied instruction runs along the bottom; the small part (30S) sits on it and the large part (50S) on top.
   A building block docks at the small part each beat; the chain grows out of the large part's exit, toward the
   membrane at the top. */
const RIB = { x: 236, small: 300, large: 238 };
const BEAD0 = [284, 178], BEADV = [17.5, -11.5];
const beadAt = k => [BEAD0[0] + BEADV[0] * k, BEAD0[1] + BEADV[1] * k];
function ribosomeScene(o) {
  // o: { beat (whole beats so far), u (0 to 1 within the beat), faultyFrom (beat after which blocks are faulty),
  //      stall (0 to 1), ami, tet, mac (drug alphas), holes (0 to 1), ghost }
  let s = '';
  // The membrane at the top, where finished proteins go.
  s += part('membrane', rect(16, 14, 448, 9, LIPID) + line(16, 14, 464, 14, C.ink, 2) + line(16, 23, 464, 23, C.ink, 2));
  // The copied instruction (mRNA), sliding one letter left each beat.
  const shift = 24 * (o.u % 1) * (1 - o.stall);
  s += part('mrna', line(16, 330, 464, 330, C.muted, 3) + Array.from({ length: 21 }, (_, i) => { const x = 16 + i * 24 - shift; return x >= 16 && x <= 464 ? line(x, 324, x, 330, C.muted, 2.5) : ''; }).join(''));
  s += part('large', `<ellipse cx="${RIB.x}" cy="${RIB.large}" rx="112" ry="52" fill="${RIBO_L}" stroke="${C.ink}" stroke-width="2"/>`);
  s += part('small', `<ellipse cx="${RIB.x}" cy="${RIB.small}" rx="88" ry="26" fill="${RIBO_S}" stroke="${C.ink}" stroke-width="2"/>`);
  // The docking site, where building blocks fit in, and the exit tunnel, top right of the large part.
  s += rect(191, 267, 14, 14, '#fff', C.ink, 1.5, 'rx="2" stroke-dasharray="3 2"');
  s += `<path d="M268 192 Q274 180 284 178" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="3 3"/>`;
  // Building blocks arrive from the left and dock at the small part.
  const dockU = o.tet > 0.5 ? Math.min(o.u, 0.25) : o.u;
  const bx = lerp(60, 198, ease(span(dockU, 0, 0.5))), by = 274;
  if (o.tet > 0.5 && o.u > 0.25) {
    const back = span(o.u, 0.25, 0.6);
    s += rect(lerp(172, 80, back) - 7, 267, 14, 14, C.muted, '#fff', 1.2, `rx="2" ${fade(1 - back)}`);
  } else if (span(o.u, 0.5, 0.7) < 1) s += rect(bx - 7, by - 9, 14, 14, o.beat >= o.faultyFrom ? '#fff' : C.muted, o.beat >= o.faultyFrom ? C.red : '#fff', o.beat >= o.faultyFrom ? 2.4 : 1.2, `rx="2" ${fade(1 - span(o.u, 0.55, 0.7))}`);
  // The chain: every bead moves one place out each beat; the newest is at the exit.
  const step = ease(span(o.u, 0.55, 0.9)) * (1 - o.stall);
  if (o.ghost) for (let k = 0; k < 9; k++) { const [x, y] = beadAt(k); s += circle(x, y, 7, 'none', C.ghost, 1.4, 'stroke-dasharray="2 2"'); }
  let chain = '';
  for (let k = 0; k < 10; k++) {
    const [x, y] = beadAt(k - 1 + step);
    if (k - 1 + step > 8.2 || k - 1 + step < 0) continue;
    const born = o.beat - k + 1;              // the beat on which this bead was added
    const bad = born >= o.faultyFrom;
    chain += bad ? circle(x, y, 7, '#fff', C.red, 2.6) : circle(x, y, 7, C.muted, '#fff', 1.2);
  }
  s += part('chain', chain);
  // Faulty proteins lodged in the membrane leave holes.
  if (o.holes > 0.02) for (const x of [96, 176, 404]) s += `<g ${fade(o.holes)}>${rect(x - 12, 11, 24, 15, '#fff', C.red, 2.4, 'rx="4"')}${circle(x, 36 + 10 * o.holes, 3, C.muted)}</g>`;
  if (o.ami > 0.02) s += part('drug', block(178, 292 - 40 * (1 - o.ami), 24, 14, fade(Math.min(1, o.ami * 2))));
  if (o.tet > 0.02) s += part('drug', block(206, 280 - 40 * (1 - o.tet), 24, 14, fade(Math.min(1, o.tet * 2))));
  if (o.mac > 0.02) s += part('drug', block(276, 190 - 40 * (1 - o.mac), 22, 16, fade(Math.min(1, o.mac * 2))));
  return s;
}
const ribLabels = () => text(16, 360, 'copied instruction (mRNA)', 'xs muted', 'start') + text(354, 226, 'large part', 'xs b', 'start') + text(354, 246, '(50S)', 'xs b', 'start') + text(330, 306, 'small part (30S)', 'xs b', 'start');
function ribosomePic(t) {
  const beats = 3, b = t * beats, beat = Math.floor(b);
  let s = ribosomeScene({ beat, u: b - beat, faultyFrom: 1e9, stall: 0, ami: 0, tet: 0, mac: 0, holes: 0 });
  s += ribLabels() + text(16, 150, 'building blocks', 'xs b', 'start') + text(16, 170, 'dock here', 'xs b', 'start') + line(70, 178, 190, 266, C.ink, 1.4);
  s += text(370, 106, 'protein chain', 'xs b', 'end') + text(16, 46, 'cell membrane', 'xs muted', 'start');
  return s;
}
function aminoPic(t) {
  const beats = 4, b = t * beats, beat = Math.min(3, Math.floor(b)), u = t >= 1 ? 1 : b - beat;
  const ami = ease(span(t, 0.12, 0.3));
  let s = ribosomeScene({ beat, u, faultyFrom: 1, stall: 0, ami, tet: 0, mac: 0, holes: ease(span(t, 0.75, 0.95)), ghost: true });
  s += ribLabels();
  s += show(span(t, 0.2, 0.35), text(16, 150, 'aminoglycoside grips', 'xs b red', 'start') + text(16, 170, 'the small 30S part', 'xs b red', 'start') + line(96, 178, 170, 282, C.red, 1.4));
  s += show(span(t, 0.45, 0.6), text(330, 106, 'misread:', 'xs b blue', 'end') + text(330, 126, 'faulty protein', 'xs b blue', 'end'));
  s += show(span(t, 0.82, 0.96), text(16, 76, 'faulty proteins punch holes: the cell dies', 'xs b red', 'start'));
  return s;
}
function macroPic(t) {
  const beats = 3, b = t * beats, beat = Math.min(2, Math.floor(b)), u = t >= 1 ? 1 : b - beat;
  const tet = ease(span(t, 0.36, 0.5)), mac = ease(span(t, 0.3, 0.44));
  let s = ribosomeScene({ beat, u, faultyFrom: 1e9, stall: ease(span(t, 0.42, 0.55)), ami: 0, tet, mac, holes: 0, ghost: true });
  s += ribLabels();
  s += show(span(t, 0.4, 0.55), text(16, 120, 'macrolide plugs the exit (50S)', 'xs b red', 'start') + line(200, 126, 268, 184, C.red, 1.4));
  s += show(span(t, 0.45, 0.6), text(16, 150, 'tetracycline blocks', 'xs b red', 'start') + text(16, 170, 'docking (30S)', 'xs b red', 'start') + line(84, 178, 196, 272, C.red, 1.4));
  s += show(span(t, 0.75, 0.9), text(464, 44, 'the chain stalls: growth stops', 'xs b blue', 'end'));
  return s;
}

/* ---------- 9, 18. The folate assembly line ----------
   Folate making has several steps. Two of its enzymes matter here: an earlier one (dihydropteroate synthase, which
   takes in the raw material, PABA) and a later one (dihydrofolate reductase), with another step between them. The
   finished, active folate is used to make some of the DNA letters (the purines and thymidine). */
const FY = 150, FX = { raw: 40, e1: 136, mid: 226, e2: 316, fol: 400, dna: 448 };
function folateScene(o) {
  // o: { u (flow clock), s1, s2 (drug alphas), out (0 to 1: how much folate is made), ghost }
  let s = '';
  s += line(FX.raw, FY, FX.dna - 20, FY, C.rule, 4);
  s += arrowTo(FX.fol + 18, FY, FX.dna - 22, FY, C.muted, 2.5);
  s += part('raw', circle(FX.raw, FY, 13, '#c9ccc2', C.ink, 1.5));
  s += part('step', rect(FX.e1 - 46, FY - 18, 92, 36, '#fff', C.ink, 2, 'rx="18"') + rect(FX.e2 - 46, FY - 18, 92, 36, '#fff', C.ink, 2, 'rx="18"'));
  s += rect(FX.mid - 20, FY - 13, 40, 26, '#fff', C.muted, 1.5, 'rx="13" stroke-dasharray="3 3"');
  s += text(FX.e1, FY + 6, 'earlier', 'xs b on-white') + text(FX.e2, FY + 6, 'later', 'xs b on-white');
  if (o.ghost) s += `<g class="ghost" data-ghost="normal">${circle(FX.fol, FY, 16, 'none', C.ghost, 2, 'stroke-dasharray="3 3"')}${Array.from({ length: 6 }, (_, i) => rect(FX.dna - 14 + (i % 3) * 12, FY - 14 + Math.floor(i / 3) * 16, 10, 12, 'none', C.ghost, 1.4, 'stroke-dasharray="2 2"')).join('')}</g>`;
  s += part('folate', circle(FX.fol, FY, 4 + 12 * o.out, C.ink));
  const letters = Math.round(6 * o.out);
  for (let i = 0; i < 6; i++) if (i < letters) s += part('letters', rect(FX.dna - 14 + (i % 3) * 12, FY - 14 + Math.floor(i / 3) * 16, 10, 12, C.blue));
  // Pieces move down the line. A blocked step lets none through: the pieces fade before it.
  const stopAt = o.s1 > 0.5 ? FX.e1 - 50 : o.s2 > 0.5 ? FX.e2 - 50 : Infinity;
  for (let k = 0; k < 5; k++) {
    const x = lerp(FX.raw + 16, FX.fol - 18, (o.u + k / 5) % 1);
    const a = x > stopAt ? 0 : Math.min(1, (stopAt - x) / 30);
    const made = x > FX.e2 + 30 ? 2 : x > FX.e1 + 30 ? 1 : 0;
    if (a > 0.02) s += circle(x, FY - 26, 5.5, made === 2 ? C.ink : made === 1 ? C.muted : '#c9ccc2', '#fff', 1.2, fade(a));
  }
  if (o.s1 > 0.02) s += part('drug', block(FX.e1, FY - 30 - 30 * (1 - o.s1), 34, 16, fade(Math.min(1, o.s1 * 2))));
  if (o.s2 > 0.02) s += part('drug', block(FX.e2, FY - 30 - 30 * (1 - o.s2), 34, 16, fade(Math.min(1, o.s2 * 2))));
  return s;
}
const folateLabels = () => text(FX.raw - 22, FY + 42, 'raw', 'xs', 'start') + text(FX.raw - 22, FY + 62, 'material', 'xs', 'start')
  + text(FX.e1, FY + 42, 'step', 'xs muted') + text(FX.mid, FY + 42, 'another', 'xs muted') + text(FX.e2, FY + 42, 'step', 'xs muted')
  + text(FX.fol, FY - 52, 'folate', 'sm b') + text(464, FY + 42, 'DNA letters', 'xs b blue', 'end');
function folatePic(t) {
  let s = folateScene({ u: t, s1: 0, s2: 0, out: 1 }) + folateLabels();
  s += text(16, 40, 'a bacterium builds its own folate,', 'xs b', 'start') + text(16, 62, 'one enzyme for each step', 'xs', 'start');
  // You eat yours.
  s += line(16, 250, 464, 250, C.rule, 1.5);
  s += `<ellipse cx="70" cy="302" rx="40" ry="10" fill="#fff" stroke="${C.ink}" stroke-width="2"/><ellipse cx="60" cy="292" rx="15" ry="7" transform="rotate(-20 60 292)" fill="${C.green}"/><ellipse cx="82" cy="292" rx="13" ry="6" transform="rotate(18 82 292)" fill="${C.green}"/>`;
  s += arrowTo(110, 294, 150, 294, C.muted, 2.5) + circle(186, 294, 26, '#fff', C.ink, 2) + circle(192, 290, 10, NUC, C.muted, 1.5);
  s += text(226, 290, 'your cells take folate', 'xs', 'start') + text(226, 312, 'from food instead', 'xs', 'start');
  return s;
}
function sulfaPic(t) {
  const s1 = ease(span(t, 0.18, 0.34)), s2 = ease(span(t, 0.3, 0.46)), out = 1 - 0.9 * ease(span(t, 0.4, 0.8));
  let s = folateScene({ u: Math.min(t, 0.36) * 2, s1, s2, out, ghost: true }) + folateLabels();
  s += show(span(t, 0.25, 0.4), text(16, 40, 'sulfonamide blocks the earlier step', 'xs b red', 'start'));
  s += show(span(t, 0.36, 0.5), text(16, 62, 'trimethoprim blocks the later step', 'xs b red', 'start'));
  s += show(span(t, 0.6, 0.75), text(FX.fol, FY + 86, '↓ little folate', 'xs b blue'));
  s += show(span(t, 0.72, 0.88), text(240, 290, '↓ too few DNA letters made:', 'xs b blue') + text(240, 312, 'copying and growth stall', 'xs b blue'));
  return s;
}

/* ---------- 10. Grow, split, repeat ----------
   A rod grows to twice its length, pinches in the middle and becomes two rods end to end; three rounds make eight. */
const SPLIT_D = [96, 48, 24], RODW = 34, RODH = 15;
function rodsAt(g) {
  let xs = [240];
  for (let k = 0; k < g; k++) xs = xs.flatMap(x => [x - SPLIT_D[k], x + SPLIT_D[k]]);
  return xs;
}
function rod(x, w, pinch = 0) {
  const body = cap(x, 140, w, RODH, `fill="${CYTO}" stroke="${C.amber}" stroke-width="2.6"`);
  if (pinch < 0.02) return body;
  // The waist narrows as the rod pinches in two.
  return body + rect(x - 3, 140 - RODH / 2 - 2, 6, RODH * pinch / 2 + 2, '#ecefe5') + rect(x - 3, 140 + RODH / 2 - RODH * pinch / 2, 6, RODH * pinch / 2 + 2, '#ecefe5');
}
function dividePic(t) {
  const G = 3, g = Math.min(G - 1, Math.floor(t * G)), u = t >= 1 ? 1 : t * G - g;
  const grow = ease(span(u, 0, 0.45)), pinch = ease(span(u, 0.45, 0.62)), apart = ease(span(u, 0.62, 0.92));
  let rods = '';
  for (const x of rodsAt(g)) {
    if (apart < 0.02) { rods += rod(x, RODW * (1 + grow), pinch); continue; }
    for (const side of [-1, 1]) rods += rod(lerp(x + side * RODW / 2, x + side * SPLIT_D[g], apart), RODW);
  }
  let s = part('bacterium', rods);
  const now = apart > 0.5 ? g + 1 : g;
  [1, 2, 4, 8].forEach((n, i) => {
    const x = 120 + i * 80;
    s += text(x, 236, String(n), i === now ? 'lg b blue' : i < now ? 'sm b' : 'sm muted');
    if (i < 3) s += arrowTo(x + 20, 229, x + 58, 229, i < now ? C.ink : C.rule, 2);
  });
  s += text(240, 274, 'and on: 16, 32, 64 and more', 'xs muted');
  s += text(240, 40, 'each one grows, pinches in two, and repeats', 'xs b');
  return s;
}

/* ---------- 11. Four targets ---------- */
function targetsPic() {
  const cx = 240, cy = 212, w = 330, h = 150;
  let s = part('wall', cap(cx, cy, w, h, `fill="${CYTO}" stroke="${C.amber}" stroke-width="10"`)) + cap(cx, cy, w - 20, h - 20, `fill="none" stroke="${C.ink}" stroke-width="2.4"`);
  s += part('dna', `<path d="${loopPath(172, 206, 52, 38, 7, 0.14)}" fill="none" stroke="${C.blue}" stroke-width="3"/>` + `<path d="M196 168 q10 -10 20 0 M196 186 q10 10 20 0" fill="none" stroke="${C.purple}" stroke-width="5" stroke-linecap="round"/>`);
  let rib = '';
  for (const [x, y] of [[300, 184], [338, 212], [300, 240]]) rib += `<ellipse cx="${x}" cy="${y + 5}" rx="11" ry="6" fill="${RIBO_S}" stroke="${C.ink}" stroke-width="1.5"/><ellipse cx="${x}" cy="${y - 4}" rx="14" ry="8" fill="${RIBO_L}" stroke="${C.ink}" stroke-width="1.5"/>`;
  s += part('ribosome', rib);
  s += part('folate', line(236, 262, 290, 262, C.muted, 2) + circle(236, 262, 4, C.muted) + circle(262, 262, 4, C.muted) + circle(290, 262, 6, C.ink));
  const ring = (x, y) => circle(x, y, 17, 'none', C.red, 3);
  s += part('target', ring(110, 150) + ring(206, 177) + ring(320, 212) + ring(262, 262));
  s += text(16, 40, 'the wall', 'sm b amber', 'start') + text(16, 62, 'beta-lactams,', 'xs', 'start') + text(16, 82, 'vancomycin', 'xs', 'start') + line(60, 90, 100, 136, C.ink, 1.4);
  s += text(464, 40, 'ribosomes', 'sm b', 'end') + text(464, 62, '30S: aminoglycosides,', 'xs', 'end') + text(464, 82, 'tetracyclines', 'xs', 'end') + text(464, 102, '50S: macrolides', 'xs', 'end') + line(420, 110, 330, 198, C.ink, 1.4);
  s += text(16, 330, 'DNA untangling', 'sm b blue', 'start') + text(16, 352, 'fluoroquinolones', 'xs', 'start') + line(70, 314, 196, 192, C.ink, 1.4);
  s += text(464, 330, 'folate line', 'sm b', 'end') + text(464, 352, 'sulfonamides,', 'xs', 'end') + text(464, 372, 'trimethoprim', 'xs', 'end') + line(400, 314, 276, 272, C.ink, 1.4);
  return s;
}

/* ---------- 12. Kill, or stop the growth ---------- */
const GR = { x0: 70, x1: 318, y0: 300, top: 70 };
const gx = i => GR.x0 + (GR.x1 - GR.x0) * i / BM.STEPS, gy = n => GR.y0 - (GR.y0 - GR.top) * n;
const curveD = (arr, upTo = BM.STEPS) => arr.slice(0, upTo + 1).map((n, i) => `${i ? 'L' : 'M'}${f(gx(i))} ${f(gy(n))}`).join(' ');
const RUNS = { none: BM.simulate({}), stop: BM.simulate({ drugs: ['macrolide'] }), kill: BM.simulate({ drugs: ['betalactam'] }) };
function killPic(t) {
  const upTo = Math.round(BM.STEPS * ease(span(t, 0.04, 0.9)));
  let s = line(GR.x0, 40, GR.x0, GR.y0, C.ink, 2) + line(GR.x0, GR.y0, GR.x1 + 8, GR.y0, C.ink, 2);
  s += text(16, 30, 'bacteria alive ↑', 'xs b', 'start') + text(GR.x1 + 8, GR.y0 + 26, 'time →', 'xs b', 'end') + text(464, 30, 'illustrative model', 'xs muted', 'end');
  const xs = gx(BM.START);
  s += line(xs, 50, xs, GR.y0, C.muted, 1.5, 'stroke-dasharray="4 4"') + text(xs + 6, 58, 'drug starts', 'xs muted', 'start');
  s += path(curveD(RUNS.none, upTo), C.ink, 3, 'stroke-dasharray="7 5"');
  if (upTo > BM.START) {
    s += part('stop', path(curveD(RUNS.stop, upTo), C.blue, 4.5));
    s += part('kill', path(curveD(RUNS.kill, upTo), C.red, 4.5));
  }
  const end = span(t, 0.86, 0.98);
  const yN = gy(RUNS.none[BM.STEPS]), yS = gy(RUNS.stop[BM.STEPS]), yK = gy(RUNS.kill[BM.STEPS]);
  s += show(end, text(332, yN + 6, 'no drug', 'xs b', 'start'));
  s += show(end, part('stop', text(332, yS - 26, 'stops growth', 'xs b blue', 'start') + text(332, yS - 6, '(bacteriostatic)', 'xs blue', 'start')));
  s += show(end, part('kill', text(332, yK - 22, 'kills', 'xs b red', 'start') + text(332, yK - 2, '(bactericidal)', 'xs red', 'start')));
  s += text(240, 352, 'key measures: growth, and bacteria alive', 'xs b muted');
  return s;
}

/* ---------- Words: comparisons and text alternatives ---------- */
const ROWS = [['wall', 'Wall strength', 'stronger', 'weaker'], ['proteins', 'Working proteins', 'more', 'fewer'], ['dna', 'DNA copying', 'more', 'less'], ['folate', 'Folate made', 'more', 'less'], ['growth', 'Growth', 'faster', 'slower'], ['alive', 'Bacteria alive', 'more', 'fewer']];
function trend(a, b, up, down) {
  if (Math.abs(a - b) < 0.03 * Math.max(b, 0.05)) return ['same', 'about the same'];
  return a > b ? ['up', up] : ['down', down];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => { const [d, w] = trend(v[k], ref[k], up, down); return [name, d, w]; });
// For the readout under a picture: what changed first (a phone shows the start of the row).
const changedFirst = rows => [...rows.filter(r => r[1] !== 'same'), ...rows.filter(r => r[1] === 'same')];
const describe = (v, ref) => compare(v, ref).map(([k, , w]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const ENDS = Object.fromEntries(BM.DRUGS.map(k => [k, BM.settle({ drugs: [k] })]));
const CHANGE_WHERE = {
  betalactam: 'A red beta-lactam wedge jams the wall-building enzyme, so the new brick is never tied in; the bridges of the net fade to dashed outlines, and the membrane bulges up through the weakened wall and tears: the cell bursts.',
  vancomycin: 'A red vancomycin clamp covers the D-Ala-D-Ala tip of the new brick; the enzyme reaches for it and cannot grip, the bridges of the net fade to dashed outlines, and the membrane bulges up through the weakened wall and tears: the cell bursts. A note says vancomycin is too big to cross a gram-negative outer membrane.',
  aminoglycoside: 'A red aminoglycoside block grips the ribosome’s small 30S part; from then on the blocks it adds are the wrong ones, drawn as red-ringed faulty beads, and faulty proteins lodge in the membrane at the top, punching holes: the cell dies.',
  macrolide: 'A red macrolide block plugs the exit of the large 50S part and a red tetracycline block sits on the docking site of the small 30S part; the next building block bounces away and the chain stops growing: growth stops.',
  fluoroquinolone: 'DNA gyrase eases one stretch normally; on its next cut, red fluoroquinolone blocks trap it with the DNA held open, and another red block traps topoisomerase IV between the copies; the cut is never sealed and copying stops.',
  sulfa: 'Red blocks land on the earlier step (a sulfonamide) and the later step (trimethoprim) of the folate line; no pieces get past the first block, the folate dot shrinks and the blue DNA letters fade to dashed outlines.'
};
const TITLE = { betalactam: 'Beta-lactams', vancomycin: 'Vancomycin', aminoglycoside: 'Aminoglycosides', macrolide: 'Macrolides and tetracyclines', fluoroquinolone: 'Fluoroquinolones', sulfa: 'Sulfonamides and trimethoprim' };
const DRAW = { betalactam: t => wallDrugPic('betalactam', t), vancomycin: t => wallDrugPic('vancomycin', t), aminoglycoside: aminoPic, macrolide: macroPic, fluoroquinolone: fluoroPic, sulfa: sulfaPic };
const HEIGHT = { betalactam: 314, vancomycin: 344, aminoglycoside: 370, macrolide: 370, fluoroquinolone: 330, sulfa: 330 };
function change(kind) {
  // The readout keeps one order while the picture moves: the rows this drug changes come first.
  const order = changedFirst(compare(ENDS[kind], NV)).map(r => r[0]);
  const sorted = rows => order.map(k => rows.find(r => r[0] === k));
  return {
    duration: 4200,
    render(t) {
      const cur = BM.lerp(NV, ENDS[kind], ease(span(t, 0.25, 0.95)));
      const label = `${TITLE[kind]}, drawn over faint dashed marks for the untreated bacterium. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(cur, NV)}.`;
      return { svg: svg(label, DRAW[kind](t), { h: HEIGHT[kind] }), readout: readout(sorted(compare(cur, NV))) };
    }
  };
}
const still = (label, draw, h) => () => svg(label, draw(), { h });
const moving = (label, draw, h, duration, loop = true) => ({ duration, loop, render: t => svg(label, draw(t), { h }) });
const scenes = {
  cell: still('One of your own cells, a large round cell with a nucleus, and beside it, drawn to the same scale, a few bacteria: tiny rods, each a whole living cell.', cellPic, 316),
  membrane: moving('A bacterium cut open: its cell membrane is a thin oily double line holding the watery inside in. A green food dot passes in through a gate on top while a waste square passes out through a gate below.', membranePic, 360, 4200),
  wall: moving('The bacterium wrapped in its cell wall, a net of amber sugar-chain rings tied together by short black bridges. Inside, the membrane and watery inside press out on the net, shown by blue arrows, while blue water dots seep in from outside.', wallPic, 380, 4200),
  build: moving('A close-up slice of the wall: rows of amber bricks tied by black bridges above the membrane. A new brick rises from inside the cell into a gap in the bottom row, its tip two black dots, D-Ala-D-Ala. The white wall-building enzyme grips the tip, cuts off the last dot and ties a new bridge to the row above.', buildPic, 300, 5200),
  gram: still('Two kinds of wall side by side. Gram-positive: six rows of bricks, a thick wall outside the membrane; it stays purple. Gram-negative: an outer membrane, then a single thin row of wall, then the membrane; it stains pink. A large drug molecule passes into the thick wall but is stopped, with a red cross, above the outer membrane.', gramPic, 356),
  dna: still('A bacterium with no nucleus: one loop of DNA, coiled tight, floats loose inside it. In the corner, one of your cells keeps its DNA inside a nucleus.', dnaPic, 400),
  copy: moving('DNA being copied. On the left, a copying fork leaves two finished copies behind it, and a purple clamp, topoisomerase IV, sits between them to unhook them. Ahead of the fork the DNA winds tighter, until the purple DNA gyrase cuts both strands, passes another stretch of DNA through the gap and reseals it, and the twists relax.', copyPic, 330, 4800),
  ribosome: moving('A ribosome on the copied instruction strand: a small 30S part below and a large 50S part above. Building blocks slide in from the left and dock at the small part, and with each one the protein chain grows by a bead out of the large part’s exit, toward the membrane at the top.', ribosomePic, 370, 3600),
  folate: moving('The folate assembly line: pieces travel from the raw material through an earlier enzyme step, one more step and a later enzyme step to become active folate, which is used to make some of the blue DNA letters. Below, your own cells take folate from food instead.', folatePic, 330, 3600),
  divide: moving('One rod-shaped bacterium grows to twice its length, pinches in the middle and becomes two; each grows and splits again, so one becomes two, four and eight, with a counter of the numbers below.', dividePic, 300, 6000),
  targets: still('The whole bacterium with four red target rings: the wall, hit by beta-lactams and vancomycin; the ribosomes, with aminoglycosides and tetracyclines on the 30S part and macrolides on the 50S part; the DNA untangling enzyme, hit by fluoroquinolones; and the folate line, hit by sulfonamides and trimethoprim.', targetsPic, 384),
  killstop: moving('Bacteria alive over time, from the teaching model. With no drug, the dashed line keeps rising. After the drug starts, a blue line for a drug that stops growth holds level and drifts down slowly as white blood cells clear the bacteria; a red line for a drug that kills falls fast to the bottom.', killPic, 364, 4600, false),
  betalactam: change('betalactam'),
  vancomycin: change('vancomycin'),
  aminoglycoside: change('aminoglycoside'),
  macrolide: change('macrolide'),
  fluoroquinolone: change('fluoroquinolone'),
  sulfa: change('sulfa'),
};

/* ---------- Clinical values ----------
   The model's normal sits at the middle of each quoted range (read from the data file at load). Conditions are
   applied as model inputs, and the picture and every row read the same model output. */
let data = null;
const REF = {};
const DRUG_LABEL = { betalactam: 'a beta-lactam', vancomycin: 'vancomycin', aminoglycoside: 'an aminoglycoside', macrolide: 'a macrolide or tetracycline', fluoroquinolone: 'a fluoroquinolone', sulfa: 'a sulfonamide with trimethoprim' };
const STATE_INPUTS = { bacterial: { bacteria: 1 }, viral: { virus: 1 }, leukocytosis: { wbcMul: 1.8 }, leukopenia: { wbcMul: 0.5 } };
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const num = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const rangeText = v => `${num(v.low)}–${num(v.high)}`;
const barSpan = v => hasRange(v) ? [Math.max(0, v.low - (v.high - v.low)), v.high + (v.high - v.low)] : [v.typical * 0.5, v.typical * 1.5];
const barX = (v, n) => { const [a, b] = barSpan(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const roundFor = (v, n) => v.unit === '%' ? Math.round(n) : Math.round(n / 100) * 100;
const fmt = (v, n) => v.unit === '%' ? `${num(roundFor(v, n))}%` : `${num(roundFor(v, n))} ${v.unit}`;
function placeOf(v, n) {
  const r = roundFor(v, n);
  if (!hasRange(v)) return r > v.typical ? 'above' : r < v.typical ? 'below' : 'inside';
  return r > v.high ? 'above' : r < v.low ? 'below' : 'inside';
}
const placeWords = (v, w) => hasRange(v) ? `${w} typical range` : w === 'inside' ? 'at the typical value' : `${w} the typical value`;
const cv = { state: 'normal', extra: {}, bacteria: 0, drug: '', custom: false };
const drugs = () => cv.drug ? [cv.drug] : [];
// The picture and every gauge come from one model output (cvInputs). The dashed comparison marker is the same
// model without the chosen condition. Cited directions are shown as words beside it, never mixed into the model.
const normalInputs = () => ({ bacteria: cv.bacteria, drugs: drugs() });
const cvInputs = () => ({ ...cv.extra, bacteria: cv.bacteria + (cv.extra.bacteria || 0), drugs: drugs() });
const modelValue = v => BM.blood(cvInputs(), REF)[v.modelKey];
const bacteriaWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'a few' : v <= 1.2 ? 'an infection' : 'a heavy infection';

function bloodPicture(m, label) {
  // An illustrative drop of blood: white cells in proportion to the model, and the bacteria it carries.
  let s = rect(0, 0, 480, 300, '#fbf1ef') + text(16, 28, 'a drop of blood (illustrative model)', 'xs b muted', 'start');
  const per = 18, nN = Math.round(per * m.relN), nL = Math.round(per * m.relL), nO = Math.round(per * m.relO);
  const scale = m.total / (m.relN + m.relL + m.relO);
  const shown = Math.min(Math.round((nN + nL + nO) * scale), 48);
  const kinds = [...Array(nN).fill('n'), ...Array(nL).fill('l'), ...Array(nO).fill('o')];
  const picked = [];
  for (let i = 0; i < shown; i++) picked.push(kinds[Math.floor(i * kinds.length / shown)]);
  // A fixed shuffle, so the kinds are mixed but the picture does not jitter between redraws.
  const cells = picked.map((k, i) => [k, (i * 0.618034) % 1]).sort((a, b) => a[1] - b[1]).map(c => c[0]);
  cells.forEach((k, i) => {
    const col = i % 8, row = Math.floor(i / 8), x = 50 + col * 52 + (row % 2) * 24, y = 66 + row * 42;
    if (k === 'n') s += `<g data-cell-kind="neutrophil">${circle(x, y, 14, '#fff', C.muted, 1.5)}${circle(x - 5, y - 2, 4, '#7a5ea8')}${circle(x + 1, y + 4, 4, '#7a5ea8')}${circle(x + 6, y - 3, 4, '#7a5ea8')}</g>`;
    else if (k === 'l') s += `<g data-cell-kind="lymphocyte">${circle(x, y, 12, '#fff', C.muted, 1.5)}${circle(x, y, 9, C.blue)}</g>`;
    else s += `<g data-cell-kind="other">${circle(x, y, 13, '#fff', C.muted, 1.5)}<path d="M${x - 6} ${y - 4} q6 10 12 0" fill="none" stroke="${C.muted}" stroke-width="4"/></g>`;
  });
  const nb = Math.round(10 * m.load);
  // Bacteria sit in the gaps between the white cells, spread over the drop.
  for (let i = 0; i < Math.min(nb, 30); i++) { const j = (i * 7) % 30; s += cap(76 + (j % 6) * 64 + (Math.floor(j / 6) % 2) * 20, 87 + Math.floor(j / 6) * 42, 18, 8, `data-bug fill="${C.amber}"`); }
  s += `<g class="cv-legend">${circle(24, 322, 7, '#7a5ea8')}${text(36, 328, 'neutrophil', 'xs', 'start')}${circle(140, 322, 7, C.blue)}${text(152, 328, 'lymphocyte', 'xs', 'start')}${circle(262, 322, 7, '#fff', C.muted, 1.5)}${text(274, 328, 'other', 'xs', 'start')}${cap(352, 322, 18, 8, `fill="${C.amber}"`)}${text(366, 328, 'bacteria', 'xs', 'start')}</g>`;
  return svg(label, s, { h: 342 });
}

function updateClinical() {
  $('#clinical-bacteria').value = cv.bacteria; $('#clinical-bacteria-label').textContent = bacteriaWords(cv.bacteria);
  $('#clinical-drug').value = cv.drug;
  const st = data?.states.find(s => s.id === cv.state);
  if (!data) { $('#clinical-visual').innerHTML = ''; return; }
  const m = BM.blood(cvInputs(), REF);
  const label = `Illustrative drop of blood${st ? `, set to ${st.label}` : ''}${cv.custom ? ', adjusted by hand' : ''}${cv.drug ? `, with ${DRUG_LABEL[cv.drug]} in the model` : ''}: white cells drawn in proportion to the model, ${Math.round(10 * m.load) ? 'with bacteria among them' : 'with no bacteria'}.`;
  $('#clinical-visual').innerHTML = bloodPicture(m, label);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = !st ? '' : d === 'variable' ? `Cited: ${DIRECTION.variable}, can be lower or higher than ${st.comparedWith}`
      : d ? `Cited: ${DIRECTION[d]}, compared with ${st.comparedWith}` : 'No cited direction for this condition: the marker shows the teaching model only';
    dir.classList.toggle('quiet', !d || d === 'variable');
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    const n = modelValue(v), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${placeWords(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = BM.blood(normalInputs(), REF)[v.modelKey], rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeWords(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.extra = { ...(STATE_INPUTS[id] || {}) }; cv.bacteria = 0; cv.drug = '';
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline: no infection, no drug.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
function customised() {
  cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  const drugNote = cv.drug ? ` The model gives ${DRUG_LABEL[cv.drug]} against bacteria it reaches: an illustrative effect, not a cited direction.` : '';
  $('#state-summary').textContent = (s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.') + drugNote;
  updateClinical(); announce();
}
$('#clinical-bacteria').addEventListener('input', e => { cv.bacteria = Number(e.target.value); customised(); });
$('#clinical-drug').addEventListener('change', e => { cv.drug = e.target.value; customised(); });
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const st = data.states.find(s => s.id === cv.state);
    $('#cv-live').textContent = `Illustrative model${st ? `, ${st.label}` : ''}: ${data.values.map(v => { const n = modelValue(v); return `${v.label} ${fmt(v, n)}, ${placeWords(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { gram: 'positive', betalactamase: false, drugs: new Set() };
const exploreOpts = () => ({ drugs: BM.DRUGS.filter(d => ex.drugs.has(d)), gram: ex.gram, betalactamase: ex.betalactamase });
const UNTREATED = BM.simulate({});
const pct = x => `${Math.round(100 * x)}%`;
// Bacteria over time on top; below, how well each part works, against dashed outlines for the untreated bacterium.
function explorePicture(cur, curve, drugsOn, label) {
  const E = { x0: 64, x1: 456, y0: 196, top: 44 };
  const ex0 = i => E.x0 + (E.x1 - E.x0) * i / BM.STEPS, ey = n => E.y0 - (E.y0 - E.top) * n;
  const d = arr => arr.map((n, i) => `${i ? 'L' : 'M'}${f(ex0(i))} ${f(ey(n))}`).join(' ');
  let s = line(E.x0, 30, E.x0, E.y0, C.ink, 2) + line(E.x0, E.y0, E.x1 + 8, E.y0, C.ink, 2);
  s += text(16, 24, 'bacteria alive ↑', 'xs b', 'start') + text(E.x1 + 8, E.y0 + 24, 'time →', 'xs b', 'end');
  s += path(d(UNTREATED), C.ink, 2.5, 'stroke-dasharray="7 5"');
  if (drugsOn) s += line(ex0(BM.START), 40, ex0(BM.START), E.y0, C.red, 1.5, 'stroke-dasharray="3 3"') + text(ex0(BM.START) + 6, 56, 'drugs start', 'xs b red', 'start');
  s += path(d(curve), C.blue, 4);
  s += text(16, 252, 'how each part works (dashed: untreated)', 'xs b muted', 'start');
  const rows = [['wall', 'wall strength'], ['proteins', 'working proteins'], ['dna', 'DNA copying'], ['folate', 'folate made'], ['growth', 'growth'], ['alive', 'bacteria alive']];
  rows.forEach(([k, w], i) => {
    const y = 270 + i * 25;
    s += text(16, y + 13, w, 'xs', 'start');
    s += rect(200, y, 256, 15, 'none', C.ink, 1.5, 'stroke-dasharray="4 3"');
    s += rect(200, y, 256 * clamp(cur[k], 0, 1), 15, k === 'wall' ? C.amber : k === 'dna' ? C.blue : C.ink);
  });
  return svg(label, s, { h: 420 });
}
function updateExplore() {
  $$('#gram input').forEach(r => { r.checked = r.value === ex.gram; });
  $('#betalactamase').checked = ex.betalactamase;
  const opt = exploreOpts(), cur = BM.settle(opt), curve = BM.simulate(opt), end = curve[curve.length - 1], end0 = UNTREATED[UNTREATED.length - 1];
  const names = opt.drugs.map(d => DRUG_LABEL[d]);
  const who = `a ${ex.gram === 'positive' ? 'gram-positive' : 'gram-negative'} bacterium${ex.betalactamase ? ' that makes a beta-lactam-cutting enzyme' : ''}${names.length ? `, with ${names.join(', ')}` : ', untreated'}`;
  const trendWords = end < 0.02 ? 'are cleared' : end < end0 * 0.6 ? 'fall' : 'keep growing, close to the untreated curve';
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated bacterium. Compared with untreated: ${describe(cur, NV)}. Over time the bacteria ${trendWords}.`;
  $('#explore-visual').innerHTML = explorePicture(cur, curve, opt.drugs.length > 0, label) + readout(changedFirst(compare(cur, NV)), 'Compared with untreated');
  const res = $('#model-results');
  res.textContent = `Illustrative model output, compared with the untreated bacterium: wall ${pct(cur.wall)} · working proteins ${pct(cur.proteins)} · DNA copying ${pct(cur.dna)} · folate ${pct(cur.folate)} · growth ${pct(cur.growth)} · bacteria alive after a short spell of the drugs ${pct(cur.alive)} · bacteria at the end of the run ${pct(end / end0)} of untreated.`;
  Object.assign(res.dataset, { wall: cur.wall.toFixed(4), proteins: cur.proteins.toFixed(4), dna: cur.dna.toFixed(4), folate: cur.folate.toFixed(4), growth: cur.growth.toFixed(4), alive: cur.alive.toFixed(4), end: (end / end0).toFixed(4) });
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
$$('#gram input').forEach(r => r.addEventListener('change', () => { if (r.checked) { ex.gram = r.value; updateExplore(); } }));
$('#betalactamase').addEventListener('change', e => { ex.betalactamase = e.target.checked; updateExplore(); });
$('#reset').addEventListener('click', () => {
  ex.gram = 'positive'; ex.betalactamase = false; ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; });
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['wbc', 'neutPct', 'lymphPct'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!MODEL_KEYS.every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    data = loaded;
    for (const k of MODEL_KEYS) { const v = byKey(k); REF[k] = (v.low + v.high) / 2; }
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal in the middle of each band; the large number in each row is the model’s level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. How far the model moves for a condition is an illustrative choice; only the cited direction is sourced.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v, n);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const [lo, hi] = rangeText(v).split('–');
      const band = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${rangeText(v)} ${v.unit} as a shaded band, a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `Source range ${rangeText(v)} ${v.unit} (shaded) · blue line: illustrative teaching-model value`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''} `;
      const srcUrl = data.sources[v.source]?.match(/https:\/\/\S+$/)?.[0];
      if (srcUrl) { const a = document.createElement('a'); a.href = srcUrl; a.rel = 'noopener'; a.className = 'cite-link'; a.textContent = 'Read the source section'; cite.append(a); }
      row.append(left, right, ev, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'), url = citation.match(/https:\/\/\S+$/)?.[0];
      li.textContent = `[${id}] ${url ? citation.slice(0, -url.length) : citation}`;
      if (url) { const a = document.createElement('a'); a.href = url; a.textContent = url; a.rel = 'noopener'; li.append(a); }
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
