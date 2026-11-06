// Lesson 16: Stomach acid and the parietal cell. The kit (/lab/kit/kit.js) runs the page; this file is the
// pictures, and the Clinical values and Explore freely tabs. The teaching model is model.js
// (window.GastricModel), a classic script loaded before this module.
//
// Expected behaviour of the pictures:
//   - From the proton pump on, acid secretion moves: hydrogen ions stream up out of every working pump into the
//     stomach, so a picture with fewer working pumps visibly makes less acid.
//   - The pictures share one scene: the inside of the stomach on top, the lining's surface cells and one parietal
//     cell in the middle, the blood side underneath, and two meters at the foot (acid the cell makes, how acidic
//     the stomach is). Each build step shows only the parts its caption needs.
//   - A "What changes it" step starts on the normal cell (t = 0), morphs to the drug's state over dashed outlines
//     of normal, names what moved in words and arrows, then keeps the acid streaming in the new state (loop from
//     the moment the change is done).
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, line, circle, rect, path, arrowTo, part, f, clamp, lerp, ease as EASE, span, esc } from '/lab/kit/draw.js';

const GM = window.GastricModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ease = EASE.out, inOut = EASE.inOut;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const frac = x => x - Math.floor(x);

const NORMAL_P = GM.build('normal');
const NV = GM.settle(NORMAL_P);

/* ---------- Drawing ---------- */
const LUMEN = '#fdf0e8', CELL = '#f5e7cf', NUCLEUS = '#e8d2b0', LINING = '#ece2d4', BLOOD = '#f6dcd6', MUCUS = '#d8e7c4', FOOD = '#f2d27a', WALL = '#e7a993', HIST = '#f2a93b';
const hexPts = (x, y, r) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join(' L');
const hDot = (x, y, r = 5.5, extra = '') => circle(x, y, r, C.red, '#fff', 1.2, `data-h ${extra}`);
const clRing = (x, y, r = 5) => circle(x, y, r, '#fff', C.green, 2.4, 'data-cl');
const kSq = (x, y, s = 9) => rect(x - s / 2, y - s / 2, s, s, C.ink, 'none', 0, 'data-k');
const antacidHex = (x, y) => `<g data-antacid><path d="M${hexPts(x, y, 9)} Z" fill="#fff" stroke="${C.blue}" stroke-width="2.4"/>${circle(x, y, 3.6, C.red, 'none', 0, 'opacity=".45"')}</g>`;
const histTri = (x, y, s = 7) => `<path data-msg="histamine" d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y + s * .8)} L${f(x - s)} ${f(y + s * .8)} Z" fill="${HIST}" stroke="${C.amber}" stroke-width="1.6"/>`;
const gasDia = (x, y, s = 7) => `<path data-msg="gastrin" d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y)} L${f(x)} ${f(y + s)} L${f(x - s)} ${f(y)} Z" fill="${C.blue}"/>`;
const achDot = (x, y, r = 5.5) => circle(x, y, r, C.green, 'none', 0, 'data-msg="acetylcholine"');
const pgRing = (x, y) => circle(x, y, 5, '#fff', C.amber, 2.4, 'data-msg="prostaglandin"');
function pumpIcon(x, y, r = 12, locked = false) {
  let s = circle(x, y, r, C.blue, C.ink, 1.5) + path(`M${f(x)} ${f(y + r * .5)} V${f(y - r * .5)} M${f(x - r * .36)} ${f(y - r * .12)} L${f(x)} ${f(y - r * .5)} L${f(x + r * .36)} ${f(y - r * .12)}`, '#fff', 2, '');
  if (locked) s += path(`M${f(x - r - 2)} ${f(y - r - 2)} L${f(x + r + 2)} ${f(y + r + 2)} M${f(x + r + 2)} ${f(y - r - 2)} L${f(x - r - 2)} ${f(y + r + 2)}`, C.red, 3.6);
  return s;
}
// A flow arrow with its own head, so its head does not grow with a thick stroke.
function flow(x1, y1, x2, y2, w, col, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${col}" stroke-width="${f(w)}" fill="none"/>`
    + `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${col}"/></g>`;
}
function flowGhost(x1, y1, x2, y2, w, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path ${extra} d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
}

/* ---------- The scene: stomach on top, the lining and one parietal cell, the blood side, two meters ---------- */
const AP = 100, BAS = 274, BLOOD_B = 346;            // the cell's stomach-facing face, its blood-facing face, the blood side's foot
const PUMP_X = [216, 324, 178, 362, 140, 400];        // places along the stomach-facing face, filled in this order
const VES = [[322, 146], [366, 136], [410, 146], [452, 164], [340, 192], [388, 184], [432, 202]];
const RECEPTOR = { h2: 160, gastrin: 270, ach: 380 };
const SIG_X = 270, SIG_TOP = 118, SIG_BASE = 262, BRAKE_Y = 196;
const TOTAL = 8;                                       // pumps in the cell, at the surface or stored in vesicles
const pumpsUp = v => clamp(Math.round(TOTAL * v.up), 0, PUMP_X.length);
const pumpsLocked = v => clamp(Math.round(pumpsUp(v) * v.p.ppi), 0, PUMP_X.length);
const signalWidth = d => d <= 0.03 ? 0 : clamp(2.5 + 7 * d, 2.5, 16);
const brakeWidth = pg => clamp(1.5 + 2.6 * pg, 1.5, 9);
const mucusH = s => 10 + 10 * s;
// Fixed, shuffled places for the acid in the stomach, kept clear of the label lane along the top.
const POOL = (() => {
  const s = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 15; c++) s.push([146 + c * 22 + (r % 2) * 11, 48 + r * 15]);
  let seed = 7;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const poolCount = acid => clamp(Math.round(16 * Math.pow(Math.max(acid, 0), 0.6)), 0, 30);
// Hydrogen ions rising out of one working pump: phase runs 0 to 1 for one cycle.
function stream(x, phase, n = 2) {
  let s = '';
  for (let k = 0; k < n; k++) {
    const u = frac(phase + k / n + x / 97), y = AP - 10 - 40 * u;
    s += `<g ${fade(Math.min(1, (1 - u) / .25, u / .08))}>${hDot(x + 4 * Math.sin(u * 6 + x), y, 5)}</g>`;
  }
  return s;
}
function lumen(v, o) {
  let s = rect(0, 0, 480, AP, LUMEN) + text(12, 24, 'inside the stomach', 'xs b muted', 'start');
  const n = o.pool === undefined ? poolCount(v.acid) : o.pool;
  POOL.slice(0, n).forEach(([x, y]) => { s += part('hydrogen', hDot(x, y)); });
  if (v.p.antacid > 0.02) {
    const m = clamp(Math.round(12 * v.p.antacid), 0, 12);
    POOL.slice(-m).forEach(([x, y]) => { s += part('antacid', antacidHex(x, y)); });
  }
  return s;
}
function lining(v, o) {
  let s = rect(0, AP, 47, BAS - AP, LINING, C.rule, 1.5) + rect(49, AP, 47, BAS - AP, LINING, C.rule, 1.5);
  s += `<ellipse cx="23" cy="236" rx="11" ry="8" fill="${NUCLEUS}"/><ellipse cx="72" cy="236" rx="11" ry="8" fill="${NUCLEUS}"/>`;
  if (o.mucus) {
    const h = mucusH(v.shield), y = AP - h;
    if (o.ghost) s += rect(0, AP - mucusH(o.ghost.shield), 98, mucusH(o.ghost.shield), 'none', C.ink, 1.6, 'stroke-dasharray="4 3" data-ghost-shield');
    let m = path(`M0 ${AP} V${f(y + 3)} Q24 ${f(y - 4)} 49 ${f(y + 2)} T98 ${f(y + 2)} V${AP} Z`, C.green, 1.6, `fill="${MUCUS}"`);
    const nb = clamp(Math.round(4 * v.shield), 1, 8);
    for (let i = 0; i < nb; i++) m += circle(10 + i * (78 / Math.max(nb - 1, 1)), AP - h / 2 + 1, 3.2, C.blue);
    s += part('mucus', m) + text(8, f(y - 9), o.mucusWord || 'mucus', 'xs b green', 'start');
  }
  if (o.pg) {
    const pts = [[16, 128], [36, 150], [64, 130], [82, 156], [24, 178], [60, 182], [40, 206], [80, 204], [14, 152], [70, 106 + 50]];
    pts.slice(0, clamp(Math.round(3 * (v.p.pg + v.p.pgDrug)), 0, 10)).forEach(([x, y]) => { s += part('pg', pgRing(x, y)); });
  }
  return s;
}
function cellBody(label = true) {
  let s = part('cell', rect(104, AP, 368, BAS - AP, CELL, C.ink, 2, 'rx="16" data-cell'));
  s += `<ellipse cx="440" cy="240" rx="22" ry="18" fill="${NUCLEUS}"/>`;
  if (label) s += text(118, 132, 'parietal cell', 'sm b', 'start');
  return s;
}
function pumps(v, o, phase) {
  const up = o.up ?? pumpsUp(v), nl = o.locked ?? pumpsLocked(v);
  let s = '';
  if (o.ghost) PUMP_X.slice(0, pumpsUp(o.ghost)).forEach(x => { s += circle(x, AP, 15, 'none', C.ink, 1.6, 'stroke-dasharray="3 3" data-ghost-pump'); });
  PUMP_X.slice(0, up).forEach((x, j) => {
    const locked = j < nl;
    s += part('pump', `<g data-pump data-locked="${locked ? 1 : 0}">${pumpIcon(x, AP, 12, locked)}</g>`);
    if (!locked && phase !== null) s += part('hydrogen', stream(x, phase));
  });
  return s;
}
function stored(v, o) {
  if (!o.store) return '';
  const n = TOTAL - (o.up ?? pumpsUp(v));
  return VES.slice(0, clamp(n, 0, VES.length)).map(([x, y]) => part('vesicle', `<g data-vesicle>${circle(x, y, 13, '#fff', C.muted, 1.6)}${pumpIcon(x, y, 6.5)}</g>`)).join('');
}
function receptor(x, inner, plug = 0) {
  let s = path(`M${x - 13} ${BAS + 18} V${BAS + 6} Q${x - 13} ${BAS} ${x - 7} ${BAS} H${x + 7} Q${x + 13} ${BAS} ${x + 13} ${BAS + 6} V${BAS + 18}`, C.ink, 3);
  if (plug > 0.02) s += rect(x - 8, BAS + 3, 16, 15, C.ink, 'none', 0, `rx="2" data-plug ${fade(clamp(plug / 0.6, 0, 1))}`);
  else if (inner) s += inner;
  return s;
}
const CLUSTER = [[-18, 300], [10, 296], [-4, 314], [20, 314], [-24, 322], [4, 328]];
function bloodSide(v, o) {
  let s = part('blood', rect(0, BAS, 480, BLOOD_B - BAS, BLOOD) + path(`M0 ${BAS} H480`, C.red, 2)) + text(8, 302, 'blood side', 'xs b red', 'start');
  const p = v.p, show = o.msgs || [];
  const cl = (x, n, dot) => CLUSTER.slice(0, clamp(Math.round(n), 0, CLUSTER.length)).map(([dx, y]) => dot(x + dx, y)).join('');
  if (show.includes('hist')) {
    s += part('histamine', receptor(RECEPTOR.h2, histTri(RECEPTOR.h2, BAS + 11, 6), p.h2) + cl(RECEPTOR.h2, 4 * p.hist, histTri));
    s += text(RECEPTOR.h2, 340, o.histWord || 'histamine', `xs b ${o.histWord ? 'red' : 'amber'}`);
  }
  if (show.includes('gas')) {
    s += part('gastrin', receptor(RECEPTOR.gastrin, gasDia(RECEPTOR.gastrin, BAS + 11, 6)) + cl(RECEPTOR.gastrin, 4 * p.gastrin, gasDia)) + text(RECEPTOR.gastrin, 340, 'gastrin', 'xs b blue');
    s += part('ach', receptor(RECEPTOR.ach, achDot(RECEPTOR.ach, BAS + 11, 5)) + cl(RECEPTOR.ach, 4 * p.ach, achDot)) + text(RECEPTOR.ach, 340, 'acetylcholine', 'xs b green');
  }
  return s;
}
// The on signal: one arrow up through the cell to the pumps, thick when the messengers call hard.
function signal(v, o) {
  if (!o.signal) return '';
  const w = signalWidth(v.drive), show = o.msgs || [];
  let s = '';
  if (o.ghost) s += flowGhost(SIG_X, SIG_BASE, SIG_X, SIG_TOP, signalWidth(o.ghost.drive), 'data-ghost-signal');
  const hw = clamp(1.2 + 2.6 * v.hEff, 0.8, 5.5);
  if (show.includes('hist')) s += path(`M${RECEPTOR.h2} ${BAS - 4} Q${RECEPTOR.h2 + 30} ${SIG_BASE - 2} ${SIG_X - 6} ${SIG_BASE - 8}`, C.amber, hw, `fill="none" ${v.hEff < 0.05 ? 'opacity=".35"' : ''}`);
  if (show.includes('gas')) s += path(`M${RECEPTOR.ach} ${BAS - 4} Q${RECEPTOR.ach - 30} ${SIG_BASE - 2} ${SIG_X + 6} ${SIG_BASE - 8}`, C.green, 3, 'fill="none"');
  s += part('signal', flow(SIG_X, SIG_BASE, SIG_X, SIG_TOP, w, C.amber, `data-flow="signal" data-w="${f(w)}"`));
  if (o.signalWord !== false) s += text(SIG_X + 14, 240, 'on signal', 'xs b amber', 'start');
  return s;
}
function brake(v, o) {
  if (!o.brake) return '';
  const bw = brakeWidth(v.p.pg + v.p.pgDrug);
  let s = '';
  if (o.ghost) s += path(`M98 ${f(BRAKE_Y - brakeWidth(o.ghost.p.pg + o.ghost.p.pgDrug) / 2 - 1)} H${SIG_X - 14}`, C.ink, 1.5, 'stroke-dasharray="4 3"');
  s += part('brake', `<g data-flow="brake" data-w="${f(bw)}">${path(`M98 ${BRAKE_Y} H${SIG_X - 18}`, C.amber, bw, `stroke-dasharray="${f(bw + 6)} 5"`)}${path(`M${SIG_X - 14} ${f(BRAKE_Y - bw - 9)} V${f(BRAKE_Y + bw + 9)}`, C.amber, 4.5)}</g>`);
  s += text(150, BRAKE_Y - bw / 2 - 9, o.brakeWord || 'brake', 'xs b amber', 'start');
  if (o.pgWord) s += text(112, BRAKE_Y + bw / 2 + 24, 'from prostaglandins', 'xs b amber', 'start');
  return s;
}
/* The two meters: acid the parietal cell makes, and how acidic the stomach is (both relative to normal). */
const madeFrac = m => clamp(m / 1.6, 0, 1);
const acidFrac = a => clamp(0.62 + 0.3 * Math.log10(Math.max(a, 1e-4)), 0.04, 1);
const METER = { made: [12, 'acid the cell makes', C.amber, madeFrac], acid: [252, 'stomach acidity', C.red, acidFrac] };
function meters(v, o) {
  const keys = o.meters || [];
  let s = '';
  for (const k of keys) {
    const [x, words, col, fr] = METER[k], w = 216, y = 380, val = k === 'made' ? v.made : v.acid;
    const X = x + w * fr(val);
    s += part(k === 'made' ? 'made' : 'acidity', text(x, 372, words, 'xs b', 'start') + rect(x, y, w, 16, '#fff', C.rule, 1.5) + rect(x, y, X - x, 16, col, 'none', 0, `data-meter="${k}" data-level="${val.toFixed(4)}"`));
    if (o.ends) s += text(x, 416, 'less', 'xs muted', 'start') + text(x + w, 416, 'more', 'xs muted', 'end');
    if (o.ghost) {
      const G = x + w * fr(k === 'made' ? o.ghost.made : o.ghost.acid);
      s += path(`M${f(G)} ${y - 6} V${y + 22}`, C.ink, 2.2, 'stroke-dasharray="4 3" data-ghost-meter');
      const d = o.deltas?.[k];
      if (d && Math.abs(X - G) > 12) s += `<g data-delta ${fade(o.a ?? 1)}>${arrowTo(G, y + 30, X + (X < G ? 8 : -8), y + 30, C.blue, 3)}</g>`;
      if (d) s += `<g ${fade(o.a ?? 1)}>${text(x + w, 372, d, 'xs b blue', 'end')}</g>`;
    }
  }
  if (o.box) s += rect(4, 352, 472, 66, 'none', C.blue, 3, 'data-key-measures');
  return s;
}
// Draw the scene for a settled state v at stream phase `phase` (null: no stream). o picks the parts shown.
function scene(v, o = {}, phase = 0) {
  let s = lumen(v, o) + lining(v, o) + cellBody(o.cellLabel !== false) + stored(v, o) + bloodSide(v, o);
  s += signal(v, o) + brake(v, o) + (o.pumps ? pumps(v, o, phase) : '') + meters(v, o);
  if (o.extra) s += o.extra;
  return s;
}
const H_FULL = 420, H_CELL = BLOOD_B + 2;

/* ---------- Build the idea: the step pictures ---------- */
// Step 1: the stomach, its lining, and a gland magnified.
function stomachPicture() {
  const S = 'M178 70 C130 84 100 150 112 238 C124 330 226 392 322 366 C398 346 436 292 424 250 C414 214 374 214 352 236 C326 262 286 262 268 224 C252 190 262 116 226 76 C214 64 194 64 178 70 Z';
  const T = 'translate(-64 22) scale(.74)';
  let s = `<g transform="${T}">${rect(169, -40, 36, 112, WALL)}${path('M168 -40 V74 M206 -40 V66', C.ink, 2)}`;
  s += `<path data-stomach d="${S}" fill="${WALL}" stroke="${C.ink}" stroke-width="3"/>`;
  s += part('lining', `<path d="${S}" transform="translate(268 238) scale(.84) translate(-268 -238)" fill="${LUMEN}" stroke="#b5533b" stroke-width="5" stroke-dasharray="2 6" stroke-linecap="round"/>`);
  [[170, 250, 22], [214, 300, 16], [150, 186, 15], [270, 326, 12]].forEach(([x, y, r]) => { s += circle(x, y, r, FOOD, C.amber, 1.5); });
  s += circle(232, 160, 9, 'none', C.ink, 2.5) + '</g>';
  // Labels in the picture's own units (the stomach is drawn shrunk).
  s += text(80, 300, 'stomach', 'sm b') + text(96, 212, 'food', 'xs b amber');
  s += path('M30 66 L36 118', C.ink, 1.5) + text(8, 58, 'lining', 'xs b', 'start');
  s += text(60, 16, 'swallowed food ↓', 'xs b', 'start');
  // A pit in the main body's lining, magnified: a narrow opening leading down into a wider gland.
  s += path('M115 136 L282 112', C.muted, 1.4, 'stroke-dasharray="4 4"');
  s += circle(372, 190, 98, LINING, C.ink, 2.5);
  s += `<path d="M287 140 A98 98 0 0 1 457 140 Z" fill="${LUMEN}"/>`;
  s += text(372, 124, 'inside of the stomach', 'xs muted');
  s += part('pit', path('M287 140 H356 V176 L342 186', C.ink, 2.5) + path('M388 186 L374 176 V140 H457', C.ink, 2.5));
  s += part('gland', path('M342 186 V250 Q365 274 388 250 V186', C.ink, 2.5) + [0, 1, 2, 3].map(i => rect(326, 192 + i * 15, 14, 12, '#f0d9a8', C.amber, 1.5, 'rx="3"') + rect(390, 192 + i * 15, 14, 12, '#f0d9a8', C.amber, 1.5, 'rx="3"')).join(''));
  s += path('M352 156 L300 172', C.ink, 1.5) + text(296, 190, 'pit', 'xs b', 'end');
  s += path('M342 236 L306 244', C.ink, 1.5) + text(302, 250, 'gland', 'xs b', 'end');
  s += text(372, 312, 'magnified', 'xs muted');
  return s;
}
// Step 2: one parietal cell between the inside of the stomach and the blood; blood drifts by underneath.
function cellPicture(t) {
  let s = lumen(NV, { pool: 0 }) + lining(NV, {}) + cellBody(false);
  s += part('blood', rect(0, BAS, 480, BLOOD_B - BAS, BLOOD) + path(`M0 ${BAS} H480`, C.red, 2));
  s += path(`M0 296 H480 M0 330 H480`, C.red, 1.5, 'opacity=".55"');
  for (let i = 0; i < 6; i++) { const x = frac(t + i / 6) * 560 - 40; s += `<ellipse cx="${f(x)}" cy="313" rx="16" ry="9" fill="#efc3bb" stroke="${C.red}" stroke-width="1.6"/>`; }
  s += text(160, 196, 'parietal cell', 'lg b', 'start');
  s += arrowTo(300, 156, 300, AP + 6, C.blue, 3) + text(310, 150, 'faces the stomach', 'xs b blue', 'start');
  s += arrowTo(300, 220, 300, BAS - 6, C.red, 3) + text(310, 238, 'faces the blood', 'xs b red', 'start');
  s += text(8, 302, 'blood side', 'xs b red', 'start');
  s += text(48, 260, 'lining', 'xs muted');
  return s;
}
// Step 3, moving: hydrogen ions leave the cell's top face and gather in the stomach; the acidity meter climbs.
function acidPicture(t) {
  const u = ease(span(t, .04, .9)), acid = Math.max(.02, u);
  const v = { ...NV, acid };
  const n = Math.round(16 * u);
  let s = lumen(v, { pool: n }) + lining(NV, {}) + cellBody();
  // A few ions on their way out of the top face.
  for (let i = 0; i < 4; i++) { const k = frac(t * 3 + i / 4); s += `<g ${fade(Math.min(1, (1 - k) / .3) * (t < .92 ? 1 : 0))}>${hDot(170 + i * 74, AP - 6 - 30 * k, 5)}</g>`; }
  s += part('blood', rect(0, BAS, 480, BLOOD_B - BAS, BLOOD) + path(`M0 ${BAS} H480`, C.red, 2)) + text(8, 302, 'blood side', 'xs b red', 'start');
  if (n > 3) { const [x, y] = POOL[2]; s += path(`M${x + 4} ${y + 6} L${x + 26} ${y + 26}`, C.ink, 1.5) + text(x + 30, y + 40, 'hydrogen ion', 'xs b red', 'start'); }
  s += `<g ${fade(span(t, .6, .8))}>${text(466, 24, 'more of them: more acidic', 'xs b red', 'end')}</g>`;
  s += meters(v, { meters: ['acid'], ends: true }).replace(/x="252"/g, 'x="252"');
  return s;
}
// Step 4, moving: one pump, magnified, swapping a hydrogen ion out for a potassium in, using energy each time.
function pumpPicture(t) {
  const M = 150, xs = [140, 340];
  let s = rect(0, 0, 480, M - 14, LUMEN) + text(12, 26, 'inside the stomach: crowded with hydrogen ions', 'xs b muted', 'start');
  const lum = [[30, 58], [78, 88], [120, 52], [190, 70], [236, 104], [268, 56], [300, 92], [390, 58], [430, 96], [458, 64], [60, 118], [214, 120], [400, 120], [20, 92], [170, 110], [452, 112]];
  lum.forEach(([x, y]) => { s += hDot(x, y, 6); });
  s += rect(0, M - 14, 480, 28, '#eadbc4') + path(`M0 ${M - 14} H480 M0 ${M + 14} H480`, C.ink, 2);
  s += rect(0, M + 14, 480, 186, CELL) + text(12, 316, 'inside the parietal cell: few', 'xs b muted', 'start');
  [[60, 220], [250, 284], [430, 236]].forEach(([x, y]) => { s += hDot(x, y, 6); });
  [[96, 270], [214, 214], [292, 232], [400, 286], [460, 190]].forEach(([x, y]) => { s += kSq(x, y, 10); });
  [[48, 40], [330, 38]].forEach(([x, y]) => { s += kSq(x, y + 60, 10); });
  xs.forEach((x, i) => {
    const u = frac(t + i * .5);
    s += part('pump', rect(x - 30, M - 30, 60, 60, C.blue, C.ink, 2, 'rx="16"') + path(`M${x - 8} ${M - 22} V${M + 22} M${x + 8} ${M - 22} V${M + 22}`, '#fff', 3));
    // The hydrogen ion rides up the left lane and out; the potassium rides down the right lane and in.
    const yh = lerp(M + 70, M - 74, inOut(span(u, .1, .75))), yk = lerp(M - 74, M + 70, inOut(span(u, .1, .75)));
    s += `<g ${fade(Math.min(1, u / .08, (1 - u) / .1))}>${hDot(x - 8, yh, 7)}</g>`;
    s += `<g ${fade(Math.min(1, u / .08, (1 - u) / .1))}>${part('potassium', kSq(x + 8, yk, 11))}</g>`;
    const e = span(u, .02, .2);
    if (e > 0 && e < 1) s += `<g ${fade(1 - e)}><path d="M${x + 34} ${M + 34} l9 -8 l-3 9 l10 -2 l-9 8 l3 -9 Z" fill="${C.amber}" transform="scale(${f(1 + e)})" transform-origin="${x + 40} ${M + 34}"/></g>`;
  });
  s += text(240, M + 6, 'proton pumps', 'sm b blue');
  s += arrowTo(96, 92, 96, 64, C.red, 3) + text(104, 82, 'hydrogen out', 'xs b red', 'start');
  s += arrowTo(396, 196, 396, 224, C.ink, 3) + text(388, 214, 'potassium in', 'xs b', 'end');
  s += text(466, 262, 'each swap', 'xs b amber', 'end') + text(466, 283, 'uses energy', 'xs b amber', 'end');
  return s;
}
// Step 5, moving: chloride follows through its channel; with the hydrogen ions it makes hydrochloric acid.
function chloridePicture(t) {
  const v = NV, ch = 446;
  let s = lumen(v, { pool: 0 }) + lining(NV, {}) + cellBody() + bloodSide(v, {});
  // Pairs in the stomach: a hydrogen ion beside a chloride.
  POOL.slice(0, 12).forEach(([x, y]) => { if (x < 420) s += part('hcl', hDot(x, y) + clRing(x + 11, y + 2)); });
  s += pumps(v, { up: pumpsUp(v), locked: 0 }, t);
  s += part('channel', rect(ch - 9, AP - 13, 18, 26, '#fff', C.green, 2.4, 'rx="5"'));
  // Chloride comes in from the blood side and out through the channel.
  for (let i = 0; i < 4; i++) { const u = frac(t + i / 4), y = lerp(BAS + 30, AP - 46, u); s += `<g ${fade(Math.min(1, u / .06, (1 - u) / .12))}>${part('chloride', clRing(ch, y))}</g>`; }
  s += path(`M${ch} ${BAS + 34} V${AP + 16}`, C.green, 1.5, 'stroke-dasharray="3 5"');
  s += text(ch - 14, 176, 'chloride', 'xs b green', 'end') + text(ch - 14, 197, 'from the blood', 'xs green', 'end');
  s += text(ch - 18, AP + 30, 'channel', 'xs b green', 'end');
  s += text(466, 24, 'hydrochloric acid', 'xs b', 'end');
  s += meters(v, { meters: ['made', 'acid'], ends: true });
  return s;
}
// Step 6, moving: in the acid, pepsin switches on and cuts a protein; a germ is killed.
function pepsinPicture(t) {
  let s = rect(0, 0, 480, 264, LUMEN) + text(12, 26, 'inside the stomach', 'xs b muted', 'start');
  [[40, 70], [96, 50], [150, 210], [210, 60], [262, 230], [300, 48], [356, 220], [420, 60], [452, 196], [30, 234], [180, 120], [330, 120], [460, 130], [100, 160]].forEach(([x, y]) => { s += hDot(x, y, 6); });
  s += rect(0, 264, 480, 40, CELL) + path('M0 264 H480', C.ink, 2) + text(12, 292, 'parietal cells below', 'xs muted', 'start');
  // The protein: a chain of beads, cut in two as pepsin arrives.
  const cut = span(t, .45, .6), gap = 18 * ease(cut);
  let chain = '';
  for (let i = 0; i < 9; i++) { const x = 120 + i * 18 + (i > 4 ? gap : 0) - (i <= 4 ? gap / 2 : 0), y = 140 + 10 * Math.sin(i * 1.2); chain += circle(x, y, 7, '#f0d9a8', C.amber, 2); }
  s += chain + text(200, 186, 'protein from food', 'xs b');
  // Pepsin: switched on by the acid (it opens up), then moves in and cuts.
  const on = span(t, .1, .35), px = lerp(70, 196, span(t, .3, .5)), py = lerp(90, 118, span(t, .3, .5));
  const mouth = 0.15 + 0.5 * on;
  s += part('pepsin', `<path d="M${f(px)} ${f(py)} L${f(px + 22 * Math.cos(mouth))} ${f(py - 22 * Math.sin(mouth))} A22 22 0 1 0 ${f(px + 22 * Math.cos(mouth))} ${f(py + 22 * Math.sin(mouth))} Z" fill="${on > .5 ? C.amber : '#c9a27a'}" stroke="${C.ink}" stroke-width="1.6"/>`);
  s += `<g ${fade(span(t, .55, .7))}>${text(196, 92, 'pepsin cuts it', 'xs b amber', 'start')}</g>`;
  s += `<g ${fade(span(t, .12, .3) * (1 - span(t, .55, .7)))}>${text(100, 98, 'acid switches pepsin on', 'xs b amber', 'start')}</g>`;
  // A germ, killed by the acid.
  const k = span(t, .7, .85);
  s += `<ellipse cx="384" cy="150" rx="26" ry="14" fill="#cfe0a8" stroke="${C.green}" stroke-width="2.4" ${fade(1 - .5 * k)}/>`;
  s += `<g ${fade(k)}>${path('M358 128 L410 172 M410 128 L358 172', C.red, 4)}${text(384, 200, 'germ killed', 'xs b red')}</g>`;
  return s;
}
// Step 7, moving cycle: between meals pumps wait in vesicles; called, they rise and work; then they go back.
function storePicture(t) {
  const rise = inOut(span(t, .18, .42)), back = inOut(span(t, .7, .92)), up = rise * (1 - back);
  const v = { ...NV };
  const nUp = 1 + Math.round(3 * up);
  let s = lumen(v, { pool: 4 + Math.round(10 * up) }) + lining(NV, {}) + cellBody();
  // Vesicles travel between their stored places and the surface.
  const moving = [[322, 146, 216], [366, 136, 324], [410, 146, 178]];
  moving.forEach(([x, y, tx], i) => {
    const k = clamp(up * 3 - i, 0, 1), X = lerp(x, tx, k), Y = lerp(y, AP, k);
    if (k < 1) s += part('vesicle', `<g data-vesicle>${circle(X, Y, 13, '#fff', C.muted, 1.6)}${pumpIcon(X, Y, 6.5)}</g>`);
  });
  VES.slice(3).forEach(([x, y]) => { s += part('vesicle', `<g data-vesicle>${circle(x, y, 13, '#fff', C.muted, 1.6)}${pumpIcon(x, y, 6.5)}</g>`); });
  // The pump that is always up, and those that have arrived.
  s += pumps(v, { up: 1, locked: 0 }, t * 3);
  [[324, 0], [178, 1], [362, 2]].forEach(([x, i]) => { const k = clamp(up * 3 - i, 0, 1); if (k >= 1) s += part('pump', pumpIcon(x, AP, 12)) + stream(x, t * 3); });
  s += part('blood', rect(0, BAS, 480, BLOOD_B - BAS, BLOOD) + path(`M0 ${BAS} H480`, C.red, 2)) + text(8, 302, 'blood side', 'xs b red', 'start');
  const word = t < .18 ? 'between meals: pumps stored' : t < .7 ? 'called: pumps rise and work' : 'call stops: pumps pulled back';
  s += text(466, 24, word, 'xs b blue', 'end');
  s += text(300, 240, 'vesicles', 'xs b muted', 'start');
  s += meters({ ...NV, made: 0.25 + 0.75 * up, acid: 0.2 + 0.8 * up }, { meters: ['made', 'acid'] });
  return s;
}
// Step 8, moving: histamine from a neighbouring cell docks on the H2 receptor; the on signal rises; pumps come up.
function histaminePicture(t) {
  const dock = span(t, .08, .38), sig = ease(span(t, .36, .58)), rise = ease(span(t, .52, .76));
  const v = { ...NV, drive: sig * NV.drive, hEff: sig };
  const up = 1 + Math.round(2 * rise), phase = t < .76 ? null : (t - .76) / .24;
  let s = lumen(v, { pool: 4 + Math.round(12 * rise) }) + lining(NV, {}) + cellBody();
  s += stored(v, { store: true, up });
  s += part('blood', rect(0, BAS, 480, BLOOD_B - BAS, BLOOD) + path(`M0 ${BAS} H480`, C.red, 2)) + text(316, 302, 'blood side', 'xs b red', 'start');
  // The neighbouring cell that releases histamine.
  s += rect(8, 284, 74, 38, '#f3e6c9', C.amber, 2, 'rx="12"') + text(8, 343, 'neighbour cell', 'xs b amber', 'start');
  const path3 = [[64, 302], [104, 310], [140, 300], [RECEPTOR.h2, BAS + 11]];
  for (let i = 0; i < 3; i++) {
    const k = clamp(dock * 1.4 - i * .2, 0, 1), [x, y] = along(path3, k);
    s += part('histamine', histTri(x, y, 6));
  }
  s += part('receptor', receptor(RECEPTOR.h2, '', 0));
  s += text(RECEPTOR.h2 + 20, 324, 'H2 receptor', 'xs b', 'start');
  s += `<g ${fade(span(t, .02, .12))}>${text(96, 262, 'histamine', 'xs b amber', 'start')}</g>`;
  if (sig > 0) s += part('signal', flow(SIG_X, SIG_BASE, SIG_X, lerp(SIG_BASE, SIG_TOP, sig), signalWidth(sig), C.amber)) + path(`M${RECEPTOR.h2} ${BAS - 4} Q${RECEPTOR.h2 + 30} ${SIG_BASE - 2} ${SIG_X - 6} ${SIG_BASE - 8}`, C.amber, 1 + 3 * sig, 'fill="none"');
  s += `<g ${fade(span(t, .45, .56))}>${text(SIG_X + 14, 240, 'on signal', 'xs b amber', 'start')}</g>`;
  s += pumps(v, { up, locked: 0 }, phase);
  s += `<g ${fade(span(t, .6, .72))}>${text(466, 24, 'stored pumps rise', 'xs b blue', 'end')}</g>`;
  s += meters({ ...NV, made: 0.2 + 0.8 * rise, acid: 0.2 + 0.8 * rise }, { meters: ['made', 'acid'] });
  return s;
}
function along(pts, k) {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let d = k * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const u = d / seg[i]; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; } d -= seg[i]; }
  return pts.at(-1);
}
// Step 9, moving: gastrin and acetylcholine dock beside histamine; their push joins the on signal.
function messengersPicture(t) {
  const join = ease(span(t, .1, .55)), phase = frac(t * 2);
  const p = { ...NORMAL_P, gastrin: join, ach: join };
  const v = GM.settle(p);
  let s = scene(v, { pumps: true, store: true, signal: true, msgs: ['hist', 'gas'], meters: ['made', 'acid'] }, phase);
  s += `<g ${fade(span(t, .2, .4))}>${text(466, 24, 'all three push: more pumps up', 'xs b blue', 'end')}</g>`;
  return s;
}
// Step 10, moving cycle: acid falls on the lining; the mucus and its bicarbonate catch it. Where the shield fails, an ulcer.
function shieldPicture(t) {
  const G = 214;   // the top of the gel over the lining
  let s = rect(0, 0, 480, 300, LUMEN) + text(12, 26, 'inside the stomach', 'xs b muted', 'start');
  // Surface cells along the bottom, with an ulcer eaten into them on the right.
  for (let i = 0; i < 8; i++) s += rect(i * 60 + 1, 238, 58, 72, LINING, C.rule, 1.5);
  s += part('ulcer', path('M352 238 Q380 290 420 238 Z', C.red, 2, `fill="${'#f3d9d4'}"`));
  // The gel: thick over most of the lining, missing over the ulcer.
  s += part('mucus', path(`M0 238 V${G} Q60 ${G - 8} 120 ${G} T240 ${G} T340 ${G} V238 Z`, C.green, 1.8, `fill="${MUCUS}"`) + path(`M430 238 V${G} Q455 ${G - 6} 480 ${G} V238 Z`, C.green, 1.8, `fill="${MUCUS}"`));
  for (let i = 0; i < 11; i++) s += part('bicarbonate', circle(16 + i * 30, 228, 4, C.blue));
  s += part('bicarbonate', circle(448, 228, 4, C.blue) + circle(470, 228, 4, C.blue));
  // Acid raining down: caught and cancelled in the gel, or reaching the cells over the ulcer.
  const drops = [[40, 0], [110, .3], [180, .6], [250, .15], [310, .45], [380, .75], [396, .05], [450, .55]];
  drops.forEach(([x, o]) => {
    const u = frac(t + o), y = lerp(50, x > 350 && x < 420 ? 262 : G + 4, u);
    s += `<g ${fade(Math.min(1, u / .1) * (1 - span(u, .85, 1)))}>${hDot(x, y, 6)}</g>`;
  });
  s += text(12, 184, 'mucus with bicarbonate', 'xs b green', 'start') + text(12, 205, 'soaks up the acid', 'xs b blue', 'start');
  s += text(386, 330, 'ulcer: where', 'xs b red', 'middle') + text(386, 350, 'the shield fails', 'xs b red', 'middle');
  s += text(12, 296 + 34, 'lining cells', 'xs muted', 'start');
  return s;
}
// Step 11, moving: prostaglandins from the lining brake the on signal and thicken the mucus (from none to normal).
function prostaglandinPicture(t) {
  const k = ease(span(t, .1, .8)), pg = lerp(0.15, 1, k);
  const v = GM.settle({ ...NORMAL_P, pg });
  let s = scene(v, { pumps: true, store: true, signal: true, brake: true, pg: true, mucus: true, msgs: ['hist', 'gas'], meters: ['made', 'acid'], mucusWord: k > .5 ? 'mucus thickens' : 'mucus', pgWord: true }, frac(t * 2));
  s += `<g ${fade(span(t, .6, .8))}>${text(466, 24, 'prostaglandins: ease off, guard', 'xs b amber', 'end')}</g>`;
  return s;
}
// Step 12, moving cycle: the whole cell, with its two key measures boxed.
const ALL = { pumps: true, store: true, signal: true, brake: true, pg: true, mucus: true, msgs: ['hist', 'gas'], meters: ['made', 'acid'] };
const wholePicture = t => scene(NV, { ...ALL, box: true, extra: text(466, 24, 'the two key measures, boxed ↓', 'xs b blue', 'end') }, t);

/* ---------- What changes it ---------- */
const CHANGES = {
  ppi: GM.build('normal', ['ppi']), h2: GM.build('normal', ['h2']), antacid: GM.build('normal', ['antacid']), pga: GM.build('normal', ['pga'])
};
const NAMED = {   // words in the top lane, the meter words, and any part relabelled
  ppi: { top: 'pumps locked shut', col: 'red', deltas: { made: '↓ less', acid: '↓ less' } },
  h2: { top: 'H2 blocked: fewer pumps up', col: 'blue', deltas: { made: '↓ less', acid: '↓ less' } },
  antacid: { top: 'antacid cancels acid', col: 'blue', deltas: { made: 'same', acid: '↓ less' } },
  pga: { top: 'brake harder: fewer pumps up', col: 'amber', deltas: { made: '↓ less', acid: '↓ less' }, brakeWord: 'brake harder', mucusWord: 'thicker mucus', pgWord: true }
};
const CHANGE_WHERE = {
  ppi: 'Red crosses lock the pumps in the cell’s top face and their streams of hydrogen ions stop. The on signal arrow stays as thick as its dashed normal outline, because the messengers still call. Fewer hydrogen ions are left in the stomach, and both meters fall below their dashed normal marks.',
  h2: 'A dark blocker fills the H2 receptor, so histamine cannot dock. The on signal arrow shrinks inside its dashed normal outline, fewer pumps stay in the top face and more wait in vesicles, and both meters fall below their dashed normal marks.',
  antacid: 'Blue antacid hexagons fill the stomach, each holding a faded hydrogen ion it has cancelled. The pumps, the on signal and the acid the cell makes stay on their dashed normal marks; only the stomach’s acidity falls.',
  pga: 'More prostaglandin rings fill the surface cells, the brake line thickens and the on signal arrow shrinks inside its dashed normal outline, leaving fewer pumps at the surface. The mucus grows thicker than its dashed normal outline, and both meters fall.'
};
const TITLE = { ppi: 'Proton pump inhibitors', h2: 'H2 receptor blockers', antacid: 'Antacids', pga: 'Prostaglandin analogues' };
const HOLD = .08, DONE = .46, LOOP = .5;
function change(kind) {
  return {
    duration: 6400, loop: true, loopFrom: LOOP,
    render(t) {
      const u = inOut(span(t, HOLD, DONE)), a = span(t, DONE - .1, DONE);
      const v = GM.settle(GM.mix(NORMAL_P, CHANGES[kind], u));
      const n = NAMED[kind];
      const phase = t < LOOP ? t / LOOP : (t - LOOP) / (1 - LOOP);
      let s = scene(v, { ...ALL, ghost: NV, deltas: n.deltas, a, brakeWord: u > .5 ? n.brakeWord : '', mucusWord: u > .5 ? n.mucusWord : '', pgWord: n.pgWord && u > .5 }, phase);
      s += `<g ${fade(a)}>${text(466, 24, n.top, `xs b ${n.col}`, 'end')}</g>`;
      const label = `${TITLE[kind]}, drawn over dashed marks for the normal cell. ${CHANGE_WHERE[kind]} ${bandWords(v)} Compared with normal: ${describe(v, NV)}.`;
      return { svg: svg(label, s, { h: H_FULL }), readout: readoutOf(v, NV) };
    }
  };
}

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS = [['drive', 'On signal from the messengers', 'stronger', 'weaker'], ['up', 'Pumps at the surface', 'more', 'fewer'], ['working', 'Working pumps', 'more', 'fewer'], ['made', 'Acid made by the cell', 'more', 'less'], ['acid', 'Stomach acidity', 'more acidic', 'less acidic'], ['shield', 'Mucus and bicarbonate shield', 'thicker', 'thinner']];
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const SIGN = { up: '↑', down: '↓', same: '↔' };
const readoutOf = (v, ref, head = 'Compared with normal') => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${esc(head)}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${esc(k)}</b> <span class="${d}">${SIGN[d]} ${esc(w)}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
/* The usual zones the two meters are read against: acid made (an illustrative band, no source gives one) and the
   stomach's acidity (from the stomach pH range in clinical-values.json once it loads; until then, illustrative). */
const MADE_USUAL = [0.75, 1.33];
let ACID_BAND = [0.1, 10];
const place = (k, val) => { const [lo, hi] = k === 'made' ? MADE_USUAL : ACID_BAND; return val > hi + 1e-9 ? 'above' : val < lo - 1e-9 ? 'below' : 'inside'; };
function madeWords(m) { const w = place('made', m); return w === 'inside' ? 'its usual amount of acid' : w === 'above' ? 'more acid than usual' : m < 0.3 ? 'far less acid than usual' : 'less acid than usual'; }
function acidWords(a) { const w = place('acid', a); return w === 'inside' ? 'inside its usual acidity range' : w === 'below' ? 'less acidic than its usual range' : 'more acidic than its usual range'; }
const bandWords = v => `The cell makes ${madeWords(v.made)}. The stomach is ${acidWords(v.acid)}.`;

/* ---------- The lesson's scenes, one per step kind ---------- */
const moving = (duration, label, draw, h, loop = false, extra = {}) => ({ duration, loop, ...extra, render: t => svg(label, draw(t), { h }) });
const scenes = {
  stomach: () => svg('A J-shaped stomach, with a tube bringing swallowed food in from above and lumps of food inside. A dotted inner edge marks its lining. A dashed line leads from a spot on the lining to a magnifying circle: a narrow gastric pit opens from the inside of the stomach and leads down into a wider gastric gland, walled with cells.', stomachPicture(), { h: 330 }),
  cell: moving(5000, 'A slice through the stomach wall, magnified. Across the top is the inside of the stomach. Below it, two narrow lining cells sit on the left and one large parietal cell fills the rest: a blue arrow marks its top face, which faces the stomach, and a red arrow its bottom face, which faces the blood. Along the bottom runs the blood side, where red blood cells drift past in a small vessel.', cellPicture, H_CELL, true),
  acid: moving(4600, 'Red dots, each a hydrogen ion, leave the parietal cell’s top face and gather inside the stomach. Below, a meter labelled stomach acidity fills from less towards more as they gather: the more hydrogen ions, the more acidic.', acidPicture, H_FULL),
  pump: moving(2800, 'The stomach-facing surface of the parietal cell, magnified. Above it the inside of the stomach is crowded with red hydrogen ions; below it, inside the cell, there are few. Two blue proton pumps sit in the surface. Over and over, each carries one hydrogen ion up and out while one black potassium square rides down and in, and an amber spark marks the energy each swap uses.', pumpPicture, 330, true),
  chloride: moving(3000, 'The parietal cell with three blue pumps in its top face, each sending a stream of red hydrogen ions up into the stomach. At the right, green chloride rings come in from the blood side, cross the cell and leave through a green channel. In the stomach each hydrogen ion sits beside a chloride: hydrochloric acid. Two meters below show the acid the cell makes and the stomach’s acidity, both at their usual levels.', chloridePicture, H_FULL, true),
  pepsin: moving(4600, 'Inside the stomach, among red hydrogen ions. A folded, pale pepsin opens up and turns amber as the acid switches it on, then moves in and cuts a chain of protein beads in two. To the right, a green germ fades and is crossed out in red: killed by the acid.', pepsinPicture, 304),
  store: moving(6000, 'The parietal cell between meals: one pump in its top face and the rest stored in round vesicles inside. Then, when the cell is called, three vesicles rise and merge with the top face, their pumps start and more hydrogen ions stream into the stomach, and both meters rise. When the call stops, the pumps are pulled back into vesicles and the meters fall again.', storePicture, H_FULL, true),
  histamine: moving(6000, 'Below the parietal cell, amber histamine triangles leave a neighbouring cell and dock in the cup-shaped H2 receptor on the cell’s blood-facing face. A thick amber on signal arrow then grows up through the cell to its top face; stored pumps rise from their vesicles, hydrogen ions stream out of them, and both meters rise.', histaminePicture, H_FULL, true, { loopFrom: .76 }),
  messengers: moving(6000, 'Beside the H2 receptor, two more receptors take their messengers: blue gastrin diamonds in the middle one and green acetylcholine dots in the right-hand one. Lines from all three join the on signal arrow, which thickens; more pumps come up and stream acid, and both meters rise a little.', messengersPicture, H_FULL, true),
  shield: moving(4200, 'The stomach lining, magnified. Red hydrogen ions rain down from the inside of the stomach onto a green layer of mucus dotted with blue bicarbonate, which catches and cancels them before they reach the lining cells. On the right the mucus is missing; there the acid reaches the cells and has eaten a red crater: an ulcer.', shieldPicture, 360, true),
  prostaglandin: moving(5600, 'Amber prostaglandin rings appear in the lining’s surface cells. From them an amber brake line pushes across into the parietal cell and ends in a bar across the on signal arrow, which thins; fewer pumps stay up. At the same time the green mucus over the lining thickens.', prostaglandinPicture, H_FULL),
  whole: moving(3000, `The whole cell. Histamine, gastrin and acetylcholine dock on the blood side and send the on signal up to the pumps, which stream hydrogen ions into the stomach. Prostaglandins from the surface cells brake the signal, and mucus guards the lining. A blue box frames the two key measures at the foot: the acid the cell makes and the stomach’s acidity. ${bandWords(NV)}`, wholePicture, H_FULL, true),
  ppi: change('ppi'),
  h2: change('h2'),
  antacid: change('antacid'),
  pga: change('pga')
};

/* ---------- Clinical values ----------
   The sources give only directions for drugs and conditions. The model's live value is printed as an illustrative
   number: for the two pH rows, the middle of the quoted range shifted by the model's ten-fold change; for bicarbonate
   and chloride, the middle of the range times the model's relative level. Always labelled as a teaching-model value. */
const levelWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'low' : v < 0.9 ? 'a little low' : v <= 1.1 ? 'normal' : v <= 1.8 ? 'raised' : 'high';
const vomitWords = v => v < 0.02 ? 'none' : v < 0.35 ? 'some' : v < 0.7 ? 'a lot' : 'severe';
let data = null;
const MID = {}, DEC = {};
const VALUE_OF = {
  gastricPH: v => MID.gastricPH + v.gastricShift,
  bloodPH: v => MID.bloodPH + v.bloodShift,
  bicarb: v => MID.bicarb * v.bicarb,
  chloride: v => MID.chloride * v.chloride
};
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const decimals = n => (String(n).split('.')[1] || '').length;
const rangeText = v => { const d = decimals(v.low); return `${v.low.toFixed(d)}–${v.high.toFixed(d)}`; };
const barX = (v, n) => { const w = v.high - v.low; return f(20 + clamp((n - (v.low - w)) / (3 * w), 0, 1) * 360); };
const fmt = (v, n) => v.unit === 'pH' ? `pH ${n.toFixed(DEC[v.modelKey])}` : `${n.toFixed(DEC[v.modelKey])} ${v.unit}`;
const placeOf = (v, n) => n > v.high + 1e-9 ? 'above' : n < v.low - 1e-9 ? 'below' : 'inside';
const phNote = (v, w) => v.unit !== 'pH' || w === 'inside' ? '' : w === 'above' ? ' (less acidic)' : ' (more acidic)';
function stateParams(id) {
  if (GM.DRUGS[id]) return GM.build('normal', [id]);
  if (GM.STATES[id]) return GM.build(id);
  return GM.build('normal');
}
// The picture on the Clinical values and Explore freely tabs: the whole cell, still, over dashed marks for normal.
function tabPicture(label, cur, extraWords = '') {
  return svg(label, scene(cur, { ...ALL, ghost: NV, extra: extraWords }, 0.3), { h: H_FULL });
}
const cv = { state: 'normal', p: GM.build('normal'), signal: 1, custom: false };
const cvParams = () => ({ ...cv.p, hist: cv.signal, gastrin: cv.signal, ach: cv.signal });
function updateClinical() {
  $('#clinical-signal').value = cv.signal; $('#clinical-signal-label').textContent = levelWords(cv.signal);
  $('#clinical-vomit').value = cv.p.vomit; $('#clinical-vomit-label').textContent = vomitWords(cv.p.vomit);
  const cur = GM.settle(cvParams());
  const st = data?.states.find(s => s.id === cv.state);
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  const words = (cur.p.vomit > 0.02 ? text(466, 24, 'acid lost by vomiting', 'xs b red', 'end') : '') + (cur.p.sys > 0.02 ? text(466, 24, 'extra bicarbonate absorbed', 'xs b blue', 'end') : '');
  $('#clinical-visual').innerHTML = tabPicture(label, cur, words);
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = st ? (d ? `${DIRECTION[d]}${v.unit === 'pH' && d === 'up' ? ' (less acidic)' : ''}, compared with ${st.comparedWith}` : 'No direction shown for this state: none is cited, so the model holds this value where it was') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    const n = VALUE_OF[v.modelKey](cur), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${w === 'inside' ? 'inside' : w} typical range${phNote(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = VALUE_OF[v.modelKey](NV), rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeOf(v, n0)} typical range)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id); cv.signal = 1;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
function customised() {
  cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  updateClinical(); announce();
}
$('#clinical-signal').addEventListener('input', e => { cv.signal = Number(e.target.value); customised(); });
$('#clinical-vomit').addEventListener('input', e => { cv.p = { ...cv.p, vomit: Number(e.target.value) }; customised(); });
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = GM.settle(cvParams());
    $('#cv-live').textContent = `Illustrative model: ${data.values.map(v => { const n = VALUE_OF[v.modelKey](m), w = placeOf(v, n); return `${v.label} ${fmt(v, n)}, ${w} typical range`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { hist: 1, gastrin: 1, ach: 1, pg: 1, drugs: new Set() };
const DRUG_ORDER = ['ppi', 'h2', 'antacid', 'pga'];
const DRUG_NAME = { ppi: 'a proton pump inhibitor', h2: 'an H2 receptor blocker', antacid: 'an antacid', pga: 'a prostaglandin analogue' };
function exploreParams() {
  let p = { ...GM.NORMAL, hist: ex.hist, gastrin: ex.gastrin, ach: ex.ach, pg: ex.pg };
  for (const d of DRUG_ORDER) if (ex.drugs.has(d)) p = GM.DRUGS[d](p);
  return p;
}
const pct = x => `${Math.round(100 * x)}%`;
function updateExplore() {
  for (const id of ['hist', 'gastrin', 'ach', 'pg']) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = levelWords(ex[id]); }
  const cur = GM.settle(exploreParams());
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => DRUG_NAME[d]);
  const who = drugs.length ? `your messenger settings with ${drugs.join(', ')}` : 'your messenger settings';
  const label = `Illustrative model of ${who}, drawn over dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = tabPicture(label, cur) + readoutOf(cur, NV);
  const [shW] = more(cur.shield, NV.shield, 'thicker than normal', 'thinner than normal');
  const res = $('#model-results');
  res.textContent = `Illustrative model output: on signal ${pct(cur.drive / NV.drive)} of normal · ${pumpsUp(cur)} of ${TOTAL} pumps at the surface, ${pumpsLocked(cur)} locked · acid made ${pct(cur.made)} of normal · acid left in the stomach ${pct(cur.acid)} of normal, so the stomach is ${acidWords(cur.acid)} · shield ${shW === 'about the same' ? 'about normal' : shW}.`;
  Object.assign(res.dataset, { drive: cur.drive.toFixed(4), made: cur.made.toFixed(4), acid: cur.acid.toFixed(4), up: cur.up.toFixed(4), shield: cur.shield.toFixed(4) });
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['hist', 'gastrin', 'ach', 'pg']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { hist: 1, gastrin: 1, ach: 1, pg: 1 }); ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; });
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['gastricPH', 'bloodPH', 'bicarb', 'chloride'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!MODEL_KEYS.every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    data = loaded;
    // The model's normal sits at the middle of each quoted range.
    for (const k of MODEL_KEYS) { const v = byKey(k); MID[k] = (v.low + v.high) / 2; DEC[k] = Math.max(1, decimals(v.low)); }
    const g = byKey('gastricPH');
    ACID_BAND = [Math.pow(10, MID.gastricPH - g.high), Math.pow(10, MID.gastricPH - g.low)];
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal in the middle of each band; the large number in each row is the model’s level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. For a drug or condition the sources give only a direction; how far the model moves is an illustrative choice.';
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
