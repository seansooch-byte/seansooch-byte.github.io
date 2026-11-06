// Lesson 17: Pharmacokinetics, drug levels over time. The kit (/lab/kit/kit.js) runs the page; this file is the
// pictures and the Clinical values and Explore freely tabs. The teaching model is model.js (window.PKModel), a
// classic script loaded before this module. Time in the pictures is counted in the normal teaching drug's
// half-life and levels are in model units: nothing here is an amount or a schedule for anyone.
//
// Expected behaviour of the pictures:
//   - Every level-over-time curve draws itself from left to right as t runs from 0 to 1, with a dot riding its tip,
//     and the body strip above it (gut, liver, blood, tissues, kidneys) shows where the drug is at that moment.
//   - A "What changes it" step starts on the normal picture (t = 0): first the body changes (arrows thicken or thin
//     over dashed outlines of normal), then the new curve draws itself over the dashed normal curve, and the words
//     that name what moved fade in at the end.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, line, circle, rect, path, arrowTo, part, legend, f, clamp, lerp, ease as EASE, span, esc } from '/lab/kit/draw.js';

const PK = window.PKModel;
const ease = EASE.out;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- The teaching drug ---------- */
const H = PK.H0;                                   // the normal teaching drug's half-life: the unit of time drawn
const NORMAL_P = PK.build('normal');
const NS = PK.summary(NORMAL_P);
const ONCE = PK.build('normal', { repeat: 0 });
const SO = PK.summary(ONCE);
const SPAN_ONE = 5 * H, SPAN_REP = 9 * H;
const Y_ONE = PK.summary(PK.build('normal', { repeat: 0, F: 1 })).peak * 1.18;
const Y_REP = Math.max(...Object.keys(PK.STATES).map(id => PK.summary(PK.build(id)).peak)) * 1.1;
// An illustrative working range drawn around the normal teaching drug's plateau (no source gives one).
const RANGE = [NS.trough * 0.8, NS.peak * 1.2];

/* ---------- Drawing ---------- */
const GUT = '#f1e3c6', LIVER = '#ecd0c2', BLOOD = '#f6dcd6', TISSUE = '#e1e7d3', KIDNEY = '#e3def1', BAND = '#f8e3cc';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
// A flow whose width follows the model, with its own head (a marker head would grow with the stroke).
function flow(x1, y1, x2, y2, w, col, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .55, w * 1.1 + 6), hw = w * 1.05 + 4, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${col}" stroke-width="${f(w)}" fill="none"/>`
    + `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${col}"/></g>`;
}
// The dashed outline of a flow at its normal width.
function flowGhost(x1, y1, x2, y2, w, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .55, w * 1.1 + 6), hw = w * 1.05 + 4, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path ${extra} d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
}
const drugDot = (x, y, r = 5.5) => circle(x, y, r, C.blue, '#fff', 1.4, 'data-drug');
// An arrow that names a change, with its words beside the arrow's end.
function named(x1, y1, x2, y2, rows, { anchor = 'start', dx = 8, dy = 6, cls = 'xs b blue', lh = 21 } = {}) {
  const tx = x2 + (anchor === 'start' ? dx : anchor === 'end' ? -dx : 0);
  return `<g data-delta>${arrowTo(x1, y1, x2, y2, C.blue, 3)}${rows.map((w, i) => text(tx, y2 + dy + i * lh, w, cls, anchor)).join('')}</g>`;
}

/* The body strip: gut, liver, blood, tissues and kidneys, with flows whose widths follow the model. Each box keeps its
   name in its top half and its drug dots in its bottom half, so a moving dot never crosses a name. */
const STRIP_H = 116;
const BOX = {   // [x, y, w, h, fill, name baseline, dot lane]
  gut: [6, 30, 76, 54, GUT, 52, 70], liver: [104, 30, 82, 54, LIVER, 52, 70], blood: [208, 18, 108, 70, BLOOD, 40, 58],
  tissues: [350, 2, 92, 42, TISSUE, 24, 35], kidneys: [350, 54, 92, 42, KIDNEY, 76, 87]
};
const FLOWS = {   // [x1, y1, x2, y2, colour, width key, part]
  swallow: [44, -2, 44, 28, C.amber, 'swallow', 'gut'],
  absorb: [82, 64, 102, 64, C.amber, 'absorb', 'gut'],
  pass: [186, 46, 206, 46, C.amber, 'pass', 'lost'],
  cleared: [206, 70, 188, 70, C.ink, 'cleared', 'cleared'],
  broken: [145, 86, 145, 110, C.ink, 'broken', 'liver'],
  spreadOut: [318, 30, 348, 24, C.muted, 'spread', 'tissues'],
  spreadBack: [348, 36, 318, 42, C.muted, 'spread', 'tissues'],
  kidney: [318, 70, 348, 76, C.ink, 'kidney', 'cleared'],
  urine: [396, 98, 396, 116, C.ink, 'kidney', 'kidneys'],
  vein: [262, -2, 262, 16, C.blue, 'vein', 'vein']
};
function widths(p) {
  const oral = 1 - p.iv;
  return {
    swallow: oral > 0.03 ? 2 + 4 * oral : 0,
    absorb: oral > 0.03 ? clamp(1.5 + 4 * oral * Math.min(1, p.ka / 0.7), 1.5, 7) : 0,
    pass: oral > 0.03 ? clamp(1.5 + 7 * p.F * oral, 1.5, 9) : 0,
    broken: clamp(1.5 + 6 * ((1 - p.F) * oral * 0.8 + p.CLh * 0.6), 1.5, 11),
    cleared: clamp(1.5 + 7 * p.CLh, 1.2, 11),
    kidney: clamp(1.5 + 7 * p.CLr, 1.2, 11),
    vein: p.iv > 0.02 ? 2 + 5 * p.iv : 0,
    spread: clamp(1.2 + 2.2 * p.Vd, 1.2, 8)
  };
}
// Drug dots in a box's dot lane (two rows in the blood), filled from the left.
function dotsIn(k, n) {
  const [x, , w, , , , lane] = BOX[k], rows = k === 'blood' ? 2 : 1, cols = k === 'blood' ? 7 : 5;
  let s = '';
  for (let i = 0; i < clamp(Math.round(n), 0, rows * cols); i++) {
    const r = Math.floor(i / cols), c = i % cols;
    s += drugDot(x + 14 + c * ((w - 28) / (cols - 1)), lane + r * 15, 5);
  }
  return s;
}
function strip(p, opt = {}) {
  const { ghost = null, hi = [], dots = {}, words = true } = opt;
  const w = widths(p), gw = ghost ? widths(ghost) : null;
  let s = '';
  for (const [k, [x, y, bw, bh, fill, nameY]] of Object.entries(BOX)) {
    const on = hi.includes(k);
    s += part(k, rect(x, y, bw, bh, fill, on ? C.blue : C.ink, on ? 3.5 : 1.6, 'rx="12"'));
    s += text(x + bw / 2, nameY, k, `sm b${k === 'blood' ? ' red' : ''}`);
  }
  for (const [k, n] of Object.entries(dots)) s += dotsIn(k, n);
  for (const [k, [x1, y1, x2, y2, col, wk, pt]] of Object.entries(FLOWS)) {
    if (gw && gw[wk] > 0.05 && Math.abs(gw[wk] - w[wk]) > 0.3) s += flowGhost(x1, y1, x2, y2, gw[wk], `data-ghost-flow="${k}"`);
    s += part(pt, flow(x1, y1, x2, y2, w[wk], col, `data-flow="${k}" data-w="${f(w[wk])}"`));
  }
  if (words) {
    if (w.swallow > 0) s += text(56, 16, 'swallowed', 'xs b amber', 'start', fade(Math.min(1, w.swallow / 4)));
    if (w.vein > 0) s += text(250, 13, 'into a vein', 'xs b blue', 'end', fade(Math.min(1, w.vein / 4)));
    s += text(156, 106, 'broken down', 'xs', 'start') + text(406, 113, 'urine', 'xs', 'start');
  }
  return s;
}

/* The graph: level in the blood against time. */
function frame({ span: sp, ymax, PT, PB, x0 = 44, x1 = 466 }) {
  return { span: sp, ymax, PT, PB, x0, x1, xOf: t => x0 + (x1 - x0) * t / sp, yOf: c => PB - (PB - PT) * clamp(c / ymax, 0, 1.06) };
}
const UNDER_STRIP = { PT: 158, PB: 336 }, FULL = { PT: 50, PB: 286 };
// The curve from time 0 to upTo, as a path.
function pathOf(p, fr, upTo = fr.span) {
  let d = '', last = -1;
  for (const [t, c] of PK.curve(p, fr.span, 320)) {
    if (t > upTo + 1e-9) break;
    d += `${d ? ' L' : 'M'}${f(fr.xOf(t))} ${f(fr.yOf(c))}`;
    last = t;
  }
  if (upTo > 0 && last < upTo - 1e-6) d += `${d ? ' L' : 'M'}${f(fr.xOf(upTo))} ${f(fr.yOf(PK.level(p, upTo)))}`;
  return d || `M${fr.x0} ${fr.PB}`;
}
const curve = (p, fr, upTo, extra = '') => part('level', path(pathOf(p, fr, upTo), C.blue, 4, `data-curve ${extra}`));
const ghostCurve = (p, fr) => path(pathOf(p, fr), C.ink, 2.2, 'stroke-dasharray="7 5" data-ghost-curve');
const dotted = (p, fr, upTo, extra = '') => path(pathOf(p, fr, upTo), C.muted, 3, `stroke-dasharray="1 6" ${extra}`);
// The dot that rides the tip of a curve as it draws.
const tip = (p, fr, at) => at > 0 && at < fr.span ? circle(fr.xOf(at), fr.yOf(PK.level(p, at)), 6.5, C.blue, '#fff', 2, 'data-now') : '';
function axes(fr, { ruler = false, yWord = '↑ level in the blood', xWord = 'time →' } = {}) {
  let s = path(`M${fr.x0} ${fr.PT - 14} V${fr.PB} H${fr.x1 + 8}`, C.ink, 2);
  s += text(8, fr.PT - 22, yWord, 'xs b', 'start');
  if (ruler) {
    for (let k = 1; k * H <= fr.span + 1e-9; k++) {
      const x = fr.xOf(k * H);
      s += line(x, fr.PB, x, fr.PB + 7, C.ink, 1.5) + text(x, fr.PB + 25, String(k), 'xs muted');
    }
    s += text(fr.x1, fr.PB + 50, 'time, in half-lives →', 'xs b', 'end');
  } else if (xWord) s += text(fr.x1, fr.PB + 24, xWord, 'xs b', 'end');
  return s;
}
// One amber triangle at the top of the graph for each amount taken, up to the time drawn so far.
function doses(p, fr, upTo = fr.span) {
  const y = fr.PT - 12;
  return PK.doseTimes(p, fr.span).filter(t => t <= upTo + 1e-9)
    .map(t => `<path data-given d="M${f(fr.xOf(t) - 6)} ${y} H${f(fr.xOf(t) + 6)} L${f(fr.xOf(t))} ${y + 10} Z" fill="${C.amber}"/>`).join('');
}
function band(fr, words = false) {
  const y1 = fr.yOf(RANGE[1]), y0 = fr.yOf(RANGE[0]);
  let s = part('band', rect(fr.x0, y1, fr.x1 - fr.x0, y0 - y1, BAND, 'none', 0) + path(`M${fr.x0} ${f(y1)} H${fr.x1} M${fr.x0} ${f(y0)} H${fr.x1}`, C.amber, 1.2));
  if (words) s += text(fr.x0 + 10, y1 + 21, 'working range', 'xs b amber', 'start');
  return s;
}
const ssLine = (x, fr, col, extra = '') => path(`M${f(x)} ${fr.PT - 6} V${fr.PB}`, col, col === C.blue ? 2.5 : 1.8, `${col === C.blue ? '' : 'stroke-dasharray="4 4"'} ${extra}`);
// A steady-state mark on the time axis: a blue triangle for this curve, a dashed one for normal.
const ssTick = (x, fr, normal = false) => `<path ${normal ? 'data-ghost-ss' : 'data-ss'} d="M${f(x)} ${fr.PB + 1} L${f(x - 7)} ${fr.PB + 13} H${f(x + 7)} Z" fill="${normal ? 'none' : C.blue}" stroke="${normal ? C.ink : C.blue}" stroke-width="1.8" ${normal ? 'stroke-dasharray="3 2"' : ''}/>`;

/* ---------- Build the idea: the step pictures ---------- */
// Step 1, moving: drug dots ride round the body, in by the gut and out by the liver or the kidneys.
const ROUTES = [
  [[44, -8], [44, 70], [145, 70], [145, 124]],                                                                   // broken down on the first pass
  [[44, -8], [44, 70], [170, 70], [196, 46], [236, 64], [300, 64], [396, 87], [396, 124]],                        // out in urine
  [[44, -8], [44, 70], [170, 70], [196, 46], [236, 64], [330, 36], [396, 35], [330, 40], [280, 74], [200, 70], [150, 72], [145, 124]],
  [[44, -8], [44, 70], [170, 70], [196, 46], [236, 64], [396, 35], [300, 74], [396, 87], [396, 124]]
];
function along(pts, s) {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let d = s * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const u = d / seg[i]; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; }
    d -= seg[i];
  }
  return pts.at(-1);
}
const CHIPS = [['taken in', C.amber, 'gut', 96], ['spreads out', C.muted, 'tissues', 116], ['broken down', C.ink, 'liver', 124], ['sent out', C.ink, 'kidneys', 94]];
function journeyPicture(t) {
  let s = strip(NORMAL_P);
  for (let i = 0; i < 12; i++) {
    const u = (t + i / 12) % 1, [x, y] = along(ROUTES[i % 4], u);
    s += `<g ${fade(Math.min(1, u / .05, (1 - u) / .07))}>${drugDot(x, y, 6)}</g>`;
  }
  // The four things that happen to every drug, in order.
  s += text(8, 156, 'four things happen to every drug', 'xs b muted', 'start');
  let x = 8;
  for (const [w, col, pt, cw] of CHIPS) { s += part(pt, rect(x, 170, cw, 40, '#fff', col, 2.2, 'rx="20"') + text(x + cw / 2, 196, w, 'xs b')); x += cw + 10; }
  return s;
}
// Step 2, moving: blood tests taken one by one, then joined into a curve.
const SAMPLE_T = [0.15, 0.4, 0.7, 1.1, 1.6, 2.2, 3, 3.9].map(x => x * H);
function levelPicture(t) {
  const fr = frame({ span: SPAN_ONE, ymax: SO.peak * 1.22, ...FULL });
  let s = axes(fr);
  const shown = SAMPLE_T.filter((_, i) => t >= 0.06 + 0.72 * i / (SAMPLE_T.length - 1));
  s += `<g ${fade(span(t, .84, .98))}>${part('level', path(pathOf(ONCE, fr), C.blue, 3.5, 'data-curve'))}</g>`;
  shown.forEach(x => { s += circle(fr.xOf(x), fr.yOf(PK.level(ONCE, x)), 7.5, C.red, '#fff', 2, 'data-sample'); });
  // A drop of the latest blood test, magnified: its drug dots match the height of its mark.
  const last = shown.at(-1), lv = last === undefined ? 0 : PK.level(ONCE, last), n = Math.round(12 * lv / SO.peak);
  if (last !== undefined) s += path(`M${f(fr.xOf(last))} ${f(fr.yOf(lv) - 9)} L${f(Math.min(fr.xOf(last), 420))} 200`, C.red, 1.4, 'stroke-dasharray="3 4"');
  s += circle(398, 152, 46, BLOOD, C.red, 2.5);
  for (let i = 0; i < n; i++) s += drugDot(398 + 30 * Math.cos(i * 2.4) * Math.sqrt((i + .5) / 12), 152 + 30 * Math.sin(i * 2.4) * Math.sqrt((i + .5) / 12), 5.5);
  s += text(398, 96, 'one drop of blood', 'xs b red');
  if (shown.length > 1) s += text(fr.xOf(SAMPLE_T[1]) + 24, fr.PT + 4, 'each mark: one blood test', 'xs b red', 'start');
  return s;
}
// Steps 3 to 6, moving: one amount by mouth. The curve draws itself; the strip shows where the drug is.
const ka = NORMAL_P.ka, kel = PK.kel(NORMAL_P);
function oncePicture(kind, t) {
  const fr = frame({ span: SPAN_ONE, ymax: Y_ONE, ...UNDER_STRIP });
  const at = SPAN_ONE * span(t, .04, .94), lv = PK.level(ONCE, at);
  const hi = { absorb: ['gut'], firstpass: ['liver'], spread: ['tissues'], remove: ['liver', 'kidneys'] }[kind];
  const dots = { gut: 5 * (at > 0 ? Math.exp(-ka * at) : 1), blood: 12 * lv / SO.peak };
  if (kind === 'spread') dots.tissues = 5 * lv / SO.peak;
  let s = strip(ONCE, { hi, dots }) + axes(fr) + doses(ONCE, fr, at);
  const px = fr.xOf(SO.peakAt), py = fr.yOf(SO.peak);
  if (kind === 'firstpass') {
    const all = PK.build('normal', { repeat: 0, F: 1 }), sa = PK.summary(all), tl = SO.peakAt + 0.55 * H;
    s += part('lost', dotted(all, fr, at, 'data-alt="none-lost"'));
    s += `<g ${fade(span(t, .3, .44))}>${text(fr.xOf(sa.peakAt) + 18, fr.yOf(sa.peak) - 2, 'if none were lost', 'xs b muted', 'start')}</g>`;
    const xl = fr.xOf(tl), y1 = fr.yOf(PK.level(all, tl)) + 8, y2 = fr.yOf(PK.level(ONCE, tl)) - 10;
    s += `<g ${fade(span(t, .44, .58))}>${part('lost', named(xl, y1, xl, y2, ['lost on the', 'first pass'], { dy: -20 }))}</g>`;
  }
  if (kind === 'spread') {
    const wide = PK.build('normal', { repeat: 0, Vd: 2.2 });
    s += part('wide', dotted(wide, fr, at, 'data-alt="wide"'));
    s += `<g ${fade(span(t, .7, .86))}>${part('wide', path(`M290 ${fr.PT + 24} H318`, C.muted, 3, 'stroke-dasharray="1 6"'))}${text(328, fr.PT + 30, 'spreads widely:', 'xs b muted', 'start')}${text(466, fr.PT + 52, 'lower peak, slower fall', 'xs b muted', 'end')}</g>`;
  }
  if (kind === 'absorb') {
    const t1 = SO.peakAt * 0.35;
    s += `<g ${fade(span(t, .05, .14))}>${arrowTo(70, fr.PT + 46, fr.xOf(t1) + 7, fr.yOf(PK.level(ONCE, t1)) - 8, C.amber, 2.5)}${text(60, fr.PT + 14, 'climbs: drug comes in', 'xs b amber', 'start')}${text(60, fr.PT + 35, 'faster than it leaves', 'xs b amber', 'start')}</g>`;
    s += `<g ${fade(span(t, .52, .66))}>${text(466, py + 50, 'falls: removal wins', 'xs b', 'end')}</g>`;
  }
  if (kind === 'remove') {
    const t1 = SO.peakAt + 1.2 * H, t2 = SO.peakAt + 2.6 * H;
    s += `<g ${fade(span(t, .55, .7))}>${part('cleared', arrowTo(fr.xOf(t1), fr.yOf(PK.level(ONCE, t1)) - 18, fr.xOf(t2), fr.yOf(PK.level(ONCE, t2)) - 18, C.ink, 3))}`
      + text(fr.xOf(t1) - 10, fr.yOf(PK.level(ONCE, t1)) - 40, 'liver and kidneys clear it: falls', 'xs b', 'start') + '</g>';
  }
  if (at >= SO.peakAt) s += part('peak', circle(px, py, 6, C.ink)) + (kind === 'absorb' ? text(px + 10, py - 14, 'peak: in and out balance', 'xs b', 'start') : '');
  s += curve(ONCE, fr, at) + tip(ONCE, fr, at);
  return s;
}
// Step 7, moving: after the peak, each half-life halves the level again.
function halfLifePicture(t) {
  const sp = 4.5 * H, fr = frame({ span: sp, ymax: 1.12, ...FULL }), k = kel;
  const at = sp * span(t, .04, .94), lvl = x => Math.exp(-k * x);
  let d = '';
  for (let i = 0; i <= 160; i++) { const x = at * i / 160; d += `${i ? ' L' : 'M'}${f(fr.xOf(x))} ${f(fr.yOf(lvl(x)))}`; }
  let s = axes(fr, { yWord: '↑ level in the blood, after the peak' });
  const words = ['start', 'half', 'a quarter', 'an eighth'];
  for (let i = 0; i < 4; i++) {
    const x = i * H;
    if (at < x - 1e-9) continue;
    const X = fr.xOf(x), Y = fr.yOf(lvl(x));
    s += path(`M${fr.x0} ${f(Y)} H${f(X)}`, C.muted, 1.4, 'stroke-dasharray="2 4"') + circle(X, Y, 6.5, C.ink, '#fff', 2);
    s += text(X + 12, Y - 12, words[i], 'xs b', 'start');
    if (i > 0) s += part('halflife', path(`M${f(fr.xOf(x - H) + 3)} ${fr.PB + 8} V${fr.PB + 14} H${f(X - 3)} V${fr.PB + 8}`, C.blue, 2.5) + text((fr.xOf(x - H) + X) / 2, fr.PB + 36, 'half-life', 'xs b blue'));
  }
  s += part('level', path(d, C.blue, 4, 'data-curve'));
  if (at > 0 && at < sp) s += circle(fr.xOf(at), fr.yOf(lvl(at)), 6.5, C.blue, '#fff', 2, 'data-now');
  return s;
}
// Step 8, moving: one bar per half-life, each half the one before.
function gonePicture(t) {
  const PT = 74, PB = 286, x0 = 50, bw = 58, gap = 13;
  let s = path(`M${x0 - 8} ${PT - 36} V${PB} H468`, C.ink, 2) + text(8, 24, '↑ drug left in the body', 'xs b', 'start');
  const left = ['all', 'half', '¼', '⅛', '6%', '3%'];
  for (let i = 0; i < 6; i++) {
    const x = x0 + i * (bw + gap), full = PB - PT, h = full / Math.pow(2, i), a = span(t, .06 + i * .13, .14 + i * .13);
    s += rect(x, PT, bw, full, 'none', C.rule, 1.5, 'stroke-dasharray="4 3"');
    s += `<g ${fade(a)}>${part('halflife', rect(x, PB - h * ease(a), bw, h * ease(a), C.blue, 'none', 0, `data-bar="${i}"`))}${text(x + bw / 2, PB - h - 10, left[i], 'xs b')}</g>`;
    s += text(x + bw / 2, PB + 24, String(i), 'xs muted');
  }
  s += text(468, PB + 50, 'half-lives passed →', 'xs b', 'end');
  const xr = x0 + 4 * (bw + gap);
  s += `<g ${fade(span(t, .84, .96))}>${path(`M${xr} ${PB - 62} H${xr + 2 * bw + gap}`, C.amber, 2.5)}${text(xr + bw + gap / 2, PB - 72, 'all but gone', 'xs b amber')}</g>`;
  return s;
}
// Steps 9 to 11: amounts taken again and again. The curve draws itself (9, 10) or stands whole (11).
function repeatPicture(kind, t = 1) {
  const sp = kind === 'buildup' ? 5 * H : SPAN_REP;
  const fr = frame({ span: sp, ymax: kind === 'buildup' ? NS.peak * 1.25 : Y_REP * 0.62, ...FULL });
  const at = kind === 'range' ? sp : sp * span(t, .04, .9);
  let s = (kind === 'range' ? band(fr, true) : '') + axes(fr, { ruler: kind !== 'buildup' }) + doses(NORMAL_P, fr, at);
  if (kind === 'buildup') {
    const a = span(t, .9, 1), lows = [1, 2, 3, 4].map(n => [fr.xOf(n * NORMAL_P.tau - .02), fr.yOf(PK.level(NORMAL_P, n * NORMAL_P.tau - .02))]);
    s += `<g ${fade(a)}>${lows.map(([x, y]) => circle(x, y, 5.5, C.amber)).join('')}${part('troughs', arrowTo(lows[0][0] + 4, lows[0][1] + 26, lows[3][0], lows[3][1] + 20, C.amber, 3))}`
      + text(lows[0][0], lows[0][1] + 56, 'each low point higher: it builds up', 'xs b amber', 'start') + '</g>';
    s += `<g ${fade(span(t, .1, .2))}>${text(fr.x1, fr.PT - 32, '▼ each amount taken', 'xs b amber', 'end')}</g>`;
  } else {
    const x = fr.xOf(NS.ssTime), y = fr.yOf(NS.plateau), a = kind === 'range' ? 1 : span(at / sp, NS.ssTime / sp, NS.ssTime / sp + .06);
    s += `<g ${fade(a)}>${kind === 'range' ? '' : ssLine(x, fr, C.blue, 'data-ss')}${part('plateau', path(`M${f(x)} ${f(y)} H${fr.x1}`, C.blue, 2.2, 'stroke-dasharray="2 4"'))}`;
    if (kind === 'steady') {
      s += part('plateau', path(`M${fr.x0 + 2} ${fr.PB - 12} H${f(x - 2)}`, C.blue, 2.5) + path(`M${fr.x0 + 2} ${fr.PB - 18} V${fr.PB - 6} M${f(x - 2)} ${fr.PB - 18} V${fr.PB - 6}`, C.blue, 2.5));
      s += text((fr.x0 + x) / 2, fr.PB - 22, 'about 4 to 5 half-lives', 'xs b blue');
      s += text(x + 8, fr.PT + 8, 'steady state', 'xs b blue', 'start') + text(fr.x1, y - 40, 'plateau', 'xs b blue', 'end');
    } else {
      s += text(fr.x1, fr.yOf(RANGE[1]) - 10, 'too high: harm more likely', 'xs b', 'end') + text(fr.x1, fr.yOf(RANGE[0]) + 24, 'too low: may not work well', 'xs b', 'end');
    }
    s += '</g>';
  }
  s += curve(NORMAL_P, fr, at) + tip(NORMAL_P, fr, at);
  return s;
}

/* ---------- A whole state: the strip above, amounts taken again and again below ---------- */
const STATE_FRAME = () => frame({ span: SPAN_REP, ymax: Y_REP, ...UNDER_STRIP });
// stripOf: the body drawn in the strip, when it differs from the curve's (a change part way through).
function statePicture(cur, opt = {}) {
  const { ghost = null, short = '', fr = STATE_FRAME(), at = fr.span, a = 1, words = null, whole = false, stripOf = cur, hi = [], stripNote = '' } = opt;
  const s = PK.summary(cur), gs = ghost ? PK.summary(ghost) : null;
  const ref = gs || NS;
  const lv = PK.level(cur, Math.min(at, fr.span));
  let b = strip(stripOf, { ghost, dots: { blood: 10 * lv / ref.plateau }, hi });
  b += band(fr, !ghost) + axes(fr, { xWord: ghost ? '' : 'time →' }) + doses(cur, fr, at);
  if (stripNote) b += stripNote;
  if (ghost) b += `<g class="ghost" data-ghost="normal">${ghostCurve(ghost, fr)}${Number.isFinite(gs.ssTime) && gs.ssTime <= fr.span ? ssTick(fr.xOf(gs.ssTime), fr, true) : ''}</g>`;
  const ssShown = cur.repeat && Number.isFinite(s.ssTime) && s.ssTime <= fr.span && at >= s.ssTime;
  b += `<g data-new-state="${esc(short || 'current')}">${ssShown ? (ghost ? ssTick(fr.xOf(s.ssTime), fr) : ssLine(fr.xOf(s.ssTime), fr, C.blue, 'data-ss')) : ''}${curve(cur, fr, at)}${tip(cur, fr, at)}</g>`;
  if (whole) {
    const y = fr.yOf(s.plateau), x = fr.xOf(s.ssTime);
    b += part('plateau', path(`M${f(x)} ${f(y)} H${fr.x1}`, C.blue, 2.2, 'stroke-dasharray="2 4"'));
    b += text(x + 10, fr.PT + 10, 'steady state, after', 'xs b blue', 'start') + text(x + 10, fr.PT + 31, '4 to 5 half-lives', 'xs b blue', 'start');
    b += text(fr.x1, fr.yOf(RANGE[1]) - 12, 'steady-state level ↓', 'xs b blue', 'end');
    b += part('lost', text(270, 12, 'bioavailability', 'xs b blue', 'middle') + path('M198 8 Q190 10 194 38', C.blue, 2));
  }
  if (words) b += `<g ${fade(a)}>${words(fr, s, gs)}</g>`;
  let h = fr.PB + 32;
  if (ghost) {
    const k = legend(8, h + 18, [{ mark: 'dash', words: 'normal' }, { mark: 'line', col: C.blue, words: short || 'these settings' }, { mark: 'box', fill: BAND, col: C.amber, words: 'working range' }], { maxX: 476, gap: 16 });
    b += k.body; h += 6 + k.height;
  }
  return { body: b, h };
}

/* ---------- What changes it ---------- */
const CHANGES = { inducer: PK.build('inducer'), inhibitor: PK.build('inhibitor'), kidney: PK.build('kidney'), iv: PK.build('iv') };
const SHORT = { inducer: 'inducer', inhibitor: 'inhibitor', kidney: 'weaker kidneys', iv: 'into a vein' };
const HI = { inducer: ['liver'], inhibitor: ['liver'], kidney: ['kidneys'], iv: ['blood'] };
// What moved, named on the graph: an arrow at the right-hand end from the normal plateau to the new one, words in the
// graph's empty part, and, under the time axis, an arrow from normal's steady-state mark to the new one.
function timeArrow(fr, s, g, word) {
  const xg = fr.xOf(g.ssTime), xs = fr.xOf(s.ssTime), y = fr.PB + 24;
  if (Math.abs(xs - xg) < 16) return '';
  // The words sit at the arrow's tail, beside normal's mark, where there is room.
  return `<g data-delta>${arrowTo(xg, y, xs + (xs < xg ? 8 : -8), y, C.blue, 3)}${text(xs < xg ? xg + 12 : xg - 12, y + 6, word, 'xs b blue', xs < xg ? 'start' : 'end')}</g>`;
}
const levelArrow = (fr, s, g) => `<g data-delta>${path(`M${fr.x1 - 4} ${f(fr.yOf(g.plateau))} H${fr.x1 + 12}`, C.ink, 2, 'stroke-dasharray="3 2"')}${arrowTo(fr.x1 + 6, fr.yOf(g.plateau), fr.x1 + 6, fr.yOf(s.plateau) + (s.plateau < g.plateau ? -6 : 6), C.blue, 3.5)}</g>`;
const below = fr => fr.yOf(RANGE[0]) + 27, above = fr => fr.yOf(RANGE[1]) - 12;
const WORDS = {
  inducer: (fr, s, g) => levelArrow(fr, s, g) + text(fr.x1 - 8, above(fr) - 21, '↓ settles lower,', 'xs b blue', 'end')
    + text(fr.x1 - 8, above(fr), 'below the working range', 'xs b blue', 'end') + timeArrow(fr, s, g, 'steady state sooner'),
  inhibitor: (fr, s, g) => levelArrow(fr, s, g) + text(fr.x1 - 8, below(fr), '↑ settles higher, above the range', 'xs b blue', 'end') + timeArrow(fr, s, g, 'steady state later'),
  kidney: (fr, s, g) => levelArrow(fr, s, g) + text(fr.x1 - 8, below(fr), '↑ settles higher, above the range', 'xs b blue', 'end') + timeArrow(fr, s, g, 'steady state later'),
  iv: (fr) => {
    const x = fr.xOf(NORMAL_P.tau) - 14;
    return `<g data-delta>${arrowTo(x, fr.yOf(PK.level(CHANGES.iv, NORMAL_P.tau - .01)) - 2, x, fr.yOf(PK.level(CHANGES.iv, NORMAL_P.tau)) + 10, C.blue, 3)}</g>`
      + text(fr.x1 - 8, below(fr), '↑ each amount jumps straight up', 'xs b blue', 'end')
      + text(fr.x0, fr.PB + 30, 'same half-life: same time to steady state', 'xs b blue', 'start');
  }
};
const STRIP_WORDS = { inducer: 'liver enzymes switched up', inhibitor: 'liver enzymes slowed', kidney: 'kidneys clear less', iv: 'skips the gut and the first pass' };
const CHANGE_WHERE = {
  inducer: 'In the body strip the liver’s breakdown and clearing arrows thicken past their dashed normal outlines and the arrow from the liver into the blood thins: liver enzymes switched up. On the graph the new curve settles lower, below the dashed normal curve and below the working range, and its steady-state mark on the time axis moves earlier: sooner.',
  inhibitor: 'In the body strip the liver’s breakdown and clearing arrows thin inside their dashed normal outlines and the arrow from the liver into the blood thickens: liver enzymes slowed. On the graph the new curve keeps climbing for longer and settles higher, above the working range, and its steady-state mark moves later.',
  kidney: 'In the body strip the arrows into the kidneys and out in urine thin inside their dashed normal outlines: kidneys clear less. The liver arrows are unchanged. On the graph the new curve keeps climbing for longer and settles higher, above the working range, and its steady-state mark moves later.',
  iv: 'Each amount is now a quick injection: in the body strip a blue arrow feeds the drug straight into the blood, and the gut, absorption and first-pass arrows fade to dashed outlines. On the graph each amount makes the new curve jump straight up to a higher peak, then fall at the same pace as the dashed normal curve, reaching steady state at the same time.'
};
const TITLE = { inducer: 'Enzyme inducers', inhibitor: 'Enzyme inhibitors', kidney: 'Weaker kidneys', iv: 'Quick injections into a vein' };
function change(kind) {
  return {
    duration: 5600,
    render(t) {
      const u = ease(span(t, .05, .3));              // the body changes first: the strip's arrows morph
      const reveal = span(t, .34, .94);               // then the new curve draws itself over the normal one
      const fr = STATE_FRAME();
      const drawn = reveal > 0 ? CHANGES[kind] : NORMAL_P;
      const note = `<g ${fade(span(t, .18, .3))}>${text(fr.x1, fr.PT - 22, STRIP_WORDS[kind], 'xs b blue', 'end')}</g>`;
      const pic = statePicture(drawn, {
        ghost: NORMAL_P, short: SHORT[kind], fr, at: reveal > 0 ? fr.span * reveal : fr.span, a: span(t, .9, 1),
        words: WORDS[kind], hi: HI[kind], stripOf: PK.mix(NORMAL_P, CHANGES[kind], u), stripNote: note
      });
      const s = PK.summary(CHANGES[kind]);
      const label = `${TITLE[kind]}, drawn over a dashed curve for the normal teaching drug. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(s, NS)}.`;
      return { svg: svg(label, pic.body, { h: pic.h }), readout: readoutOf(PK.summary(reveal > 0 ? CHANGES[kind] : PK.mix(NORMAL_P, CHANGES[kind], u)), NS) };
    }
  };
}

/* ---------- Words: comparisons and text alternatives ---------- */
/* Compare one measure with normal. A measure that does not exist (no removal: no half-life, no steady state, no
   plateau, never falls) is never compared as a number: it gets its own words. */
function more(a, b, up, down, none) {
  const fa = Number.isFinite(a), fb = Number.isFinite(b);
  if (!fa && !fb) return [`${none}, in both`, 'none'];
  if (!fa) return [none, 'none'];
  if (!fb) return ['exists here, not in normal', 'up'];
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS_REPEAT = [['plateau', 'Steady-state level', 'higher', 'lower', 'none: it keeps climbing'], ['peak', 'Highest level', 'higher', 'lower', 'none: it keeps climbing'], ['half', 'Half-life', 'longer', 'shorter', 'none: nothing removes the drug'], ['ssUsual', 'Time to steady state', 'later', 'sooner', 'never: there is no steady state'], ['f', 'Share reaching the blood', 'more', 'less', 'none']];
const ROWS_ONCE = [['peak', 'Highest level', 'higher', 'lower', 'none'], ['peakAt', 'Time of the peak', 'later', 'sooner', 'none: it never stops rising'], ['half', 'Half-life', 'longer', 'shorter', 'none: nothing removes the drug'], ['fall', 'Time to fall nearly to nothing', 'later', 'sooner', 'never: the level does not fall'], ['f', 'Share reaching the blood', 'more', 'less', 'none']];
const compare = (s, ref) => (s.single ? ROWS_ONCE : ROWS_REPEAT).map(([k, name, up, down, none]) => [name, more(s[k], ref[k], up, down, none)]);
const SIGN = { up: '↑', down: '↓', same: '↔', none: '' };
const readoutOf = (s, ref, head = 'Compared with normal') => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${esc(head)}</li>${compare(s, ref).map(([k, [w, d]]) => `<li><b>${esc(k)}</b> <span class="${d}">${SIGN[d]} ${esc(w)}</span></li>`).join('')}</ul>`;
const describe = (s, ref) => compare(s, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
function rangeWords(s) {
  const [lo, hi] = RANGE;
  if (s.noRemoval) return 'keeps climbing with every amount and never settles, because nothing removes the drug';
  if (s.trough > hi) return 'stays above the working range';
  if (s.peak < lo) return 'stays below the working range';
  if (s.peak > hi && s.trough < lo) return 'swings both above and below the working range';
  if (s.peak > hi) return 'peaks above the working range';
  if (s.trough < lo) return 'dips below the working range';
  return 'stays inside the working range';
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const moving = (duration, label, draw, h, loop = false) => ({ duration, loop, render: t => svg(label, draw(t), { h }) });
const scenes = {
  journey: moving(7200, 'The body as five boxes: gut, liver, blood, tissues and kidneys. Blue drug dots are swallowed into the gut, pass the liver, where some are broken down on the way, and reach the blood. From the blood they spread into the tissues and back, and leave either by the liver, broken down, or by the kidneys, in urine. Underneath, four labels name what happens to every drug: taken in, spreads out, broken down, sent out.', journeyPicture, 214, true),
  level: moving(5200, 'An empty graph: level in the blood upward, time to the right. Red marks appear one at a time, one per blood test: they rise quickly at first, then sink slowly, and a blue curve joins them. A magnified drop of blood holds as many blue drug dots as the latest mark is high.', levelPicture, 344),
  absorb: moving(5200, 'The body strip with the gut outlined. Below, the blood level after one amount by mouth draws itself: it climbs steeply while drug comes in faster than it leaves, reaches a rounded peak, then falls as removal wins. As it draws, drug dots empty out of the gut and fill, then leave, the blood.', t => oncePicture('absorb', t), 368),
  firstpass: moving(5200, 'The body strip with the liver outlined. Below, two curves draw themselves: a dotted one, if none of the drug were lost, and the real blue one, lower, because the liver breaks part of each amount down on its first pass. A blue arrow between their peaks is labelled lost on the first pass.', t => oncePicture('firstpass', t), 368),
  spread: moving(5200, 'The body strip with the tissues outlined and arrows carrying drug into them and back. Below, the blue curve and a dotted curve for a drug that spreads more widely draw themselves: the dotted one peaks lower, then falls more slowly, so later it sits above the blue one.', t => oncePicture('spread', t), 368),
  remove: moving(5200, 'The body strip with the liver and kidneys outlined, clearing the drug from the blood. Below, the curve draws itself; after its peak an arrow follows the falling level, labelled liver and kidneys clear it.', t => oncePicture('remove', t), 368),
  halflife: moving(5200, 'A graph of the falling blood level after the peak. As it draws itself, four dots appear on it, labelled start, half, a quarter and an eighth, and under the time axis three equal blue brackets, each labelled half-life, span the gaps between them: every half-life halves the level again.', halfLifePicture, 340),
  gone: moving(5200, 'Six bars, one per half-life passed, from 0 to 5. The first is full, labelled all; each next bar appears at half the height of the one before: half, a quarter, an eighth, then 6 and 3 percent. The last two are labelled all but gone.', gonePicture, 344),
  buildup: moving(5200, 'A graph of the blood level when the same amount is taken at regular times, marked by amber triangles. The curve draws itself: after each amount it rises and falls, but each new rise starts from a higher low point, and an amber arrow along the low points says it builds up.', t => repeatPicture('buildup', t), 314),
  steady: moving(6400, 'The same regular amounts over nine half-lives, counted along the time axis. The curve draws itself, builds up and levels off: a blue line marks steady state after about 4 to 5 half-lives, and from there it rises and falls around a flat dotted plateau.', t => repeatPicture('steady', t), 344),
  range: () => svg('The same graph with a pale amber band across the middle, the working range, with too high: harm more likely above it and too low: may not work well below it. At steady state the curve rises and falls inside the band.', repeatPicture('range'), { h: 344 }),
  whole: () => { const p = statePicture(NORMAL_P, { whole: true, hi: ['blood'] }); return svg(`The whole picture. The body strip shows the drug swallowed into the gut, partly broken down by the liver on the first pass, the rest reaching the blood, spreading into the tissues and being cleared by the liver and kidneys. Below, amounts taken at regular times build up to a steady state that ${rangeWords(NS)}, after 4 to 5 half-lives, with a dotted steady-state level. Labels name the three key measures: the bioavailability, the half-life (steady state after 4 to 5 of them) and the steady-state level.`, p.body, { h: p.h }); },
  inducer: change('inducer'),
  inhibitor: change('inhibitor'),
  kidney: change('kidney'),
  iv: change('iv')
};

/* ---------- Clinical values ----------
   Every reference number comes from clinical-values.json. The model's live value for each row is read from the
   teaching model: how much it has removed after so many usual half-lives, how many usual half-lives it takes to
   reach steady state, and the share of each amount that reaches the blood. Always labelled as a model value. */
let data = null;
const levelWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'low' : v < 0.9 ? 'a little low' : v <= 1.1 ? 'normal' : v <= 1.8 ? 'raised' : 'high';
// How many usual half-lives a "removed after" row is read at comes from the row itself: a single count, or the middle of a quoted span.
const afterOf = v => { const a = v.after || {}; return Number.isFinite(a.halfLives) ? a.halfLives : (a.low + a.high) / 2; };
const VALUE_OF = {
  removedAfter: (s, v) => 100 * s.removed(afterOf(v)),
  steadyHalfLives: s => s.ssUsual,
  bioavailability: s => 100 * s.f
};
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const validValue = v => VALUE_OF[v.modelKey] && (hasRange(v) || Number.isFinite(v.typical)) && (v.modelKey !== 'removedAfter' || Number.isFinite(afterOf(v)));
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ No change expected', variable: '↕ Variable' };
const SCALE = v => v.unit === '%' ? [0, 100] : [0, 10];
const barX = (v, n) => { const [a, b] = SCALE(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const fmt = (v, n) => v.unit === '%' ? `${n.toFixed(n > 98 && n < 99.95 ? 1 : 0)}%` : `${n.toFixed(1)} ${v.unit}`;
function placeOf(v, n) {
  if (hasRange(v)) return n > v.high + 1e-9 ? 'above' : n < v.low - 1e-9 ? 'below' : 'inside';
  const [a, b] = SCALE(v), tol = 0.02 * (b - a);
  return Math.abs(n - v.typical) <= tol ? 'near' : n > v.typical ? 'above' : 'below';
}
const PLACE_WORDS = { inside: 'inside typical range', above: 'above typical range', below: 'below typical range' };
const placeText = (v, w) => { const ref = `the ${v.referenceLabel || 'typical value'}`; return hasRange(v) ? PLACE_WORDS[w] : w === 'near' ? `close to ${ref}` : `${w} ${ref}`; };
const PLACE_ARROW = { inside: '↔', near: '↔', above: '↑', below: '↓' };
const cv = { state: 'normal', clear: 1, custom: false };
const cvParams = () => { const p = PK.build(cv.state); return { ...p, CLh: p.CLh * cv.clear, CLr: p.CLr * cv.clear }; };
function updateClinical() {
  $('#clinical-clear').value = cv.clear; $('#clinical-clear-label').textContent = levelWords(cv.clear);
  const cur = cvParams(), s = PK.summary(cur);
  const st = data?.states.find(x => x.id === cv.state);
  const compared = st || cv.custom;
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}${compared ? ', drawn over a dashed curve for normal' : ''}. Taken at regular times, the curve ${rangeWords(s)}.${compared ? ` Compared with normal: ${describe(s, NS)}.` : ''}`;
  const short = cv.custom ? 'these settings' : st ? st.label.split(' (')[0].toLowerCase() : '';
  const pic = statePicture(cur, { ghost: compared ? NORMAL_P : null, short });
  $('#clinical-visual').innerHTML = svg(label, pic.body, { h: pic.h });
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}` : 'Not stated in the source: no arrow is shown, and the model holds this value where it was') : '';
    dir.classList.toggle('quiet', !d || d === 'none');
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    row.dataset.notStated = st && !d ? '1' : '0';
    const n = VALUE_OF[v.modelKey](s, v), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${placeText(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = VALUE_OF[v.modelKey](NS, v), rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal by mouth (${fmt(v, n0)}, ${placeText(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.clear = 1;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline, by mouth.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
$('#clinical-clear').addEventListener('input', e => {
  cv.clear = Number(e.target.value); cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model’s clearance adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings: clearance adjusted by hand.';
  updateClinical(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const s = PK.summary(cvParams());
    $('#cv-live').textContent = `Illustrative model: ${data.values.map(v => { const n = VALUE_OF[v.modelKey](s, v); return `${v.label} ${fmt(v, n)}, ${placeText(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ----------
   Times are counted in the normal teaching drug's half-life (the model's own clock runs in H0 units of it), so
   nothing on this tab reads as an amount or a schedule for a real drug. */
const EX_KEYS = ['tau', 'ka', 'F', 'Vd', 'CLh', 'CLr'];
let ex = { ...NORMAL_P };
const halfLives = x => { const n = x / H, r = n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/0$/, ''); return `${r} usual half-li${r === '1' ? 'fe' : 'ves'}`; };
const EX_WORDS = {
  tau: v => halfLives(v),
  ka: v => v < 0.3 ? 'slow' : v < 1.2 ? 'medium' : 'fast',
  F: v => `${Math.round(v * 100)}%`,
  Vd: v => v < 0.8 ? 'narrowly' : v <= 1.3 ? 'normally' : v <= 2 ? 'widely' : 'very widely',
  CLh: v => levelWords(v / 0.5), CLr: v => levelWords(v / 0.5)
};
const n2 = x => x.toFixed(2), num4 = x => Number.isFinite(x) ? x.toFixed(4) : 'none';
function updateExplore() {
  for (const k of EX_KEYS) { $('#' + k).value = ex[k]; $(`#${k}-label`).textContent = EX_WORDS[k](ex[k]); }
  $$('input[name=route]').forEach(r => { r.checked = (r.value === 'iv') === (ex.iv > 0.5); });
  $$('input[name=schedule]').forEach(r => { r.checked = (r.value === 'repeat') === Boolean(ex.repeat); });
  const oral = ex.iv < 0.5;
  $('#ka').disabled = !oral; $('#F').disabled = !oral; $('#tau').disabled = !ex.repeat;
  const s = PK.summary(ex);
  const ghost = PK.build('normal', { repeat: ex.repeat });
  const gs = PK.summary(ghost);
  const sp = ex.repeat ? clamp(Math.max(SPAN_REP, s.ssTime * 1.3), SPAN_REP, 240) : clamp(Math.max(SPAN_ONE, s.fall * 1.15), SPAN_ONE, 240);
  const drawnPeak = Math.max(...PK.curve(ex, sp).map(([, c]) => c));
  const ymax = Math.max(ex.repeat ? Y_REP : Y_ONE, drawnPeak * 1.12);
  const label = `Illustrative model of your settings, drawn over a dashed curve for the normal teaching drug. ${ex.repeat ? `Taken at regular times, the curve ${rangeWords(s)}.` : 'Taken once.'} Compared with normal: ${describe(s, gs)}.`;
  const pic = statePicture(ex, { ghost, short: 'your settings', fr: frame({ span: sp, ymax, ...UNDER_STRIP }) });
  $('#explore-visual').innerHTML = svg(label, pic.body, { h: pic.h }) + readoutOf(s, gs);
  const res = $('#model-results');
  const head = 'Illustrative model output, with time counted in the normal teaching drug’s half-life and levels in model units (not a real drug):';
  const shareText = `share reaching the blood ${Math.round(100 * s.f)}%`;
  const common = `half-life ${n2(s.half / H)} times the usual · ${shareText}`;   // only used when the drug is removed (finite half-life)
  const fall = `${Math.round(100 * PK.SS_GAP)}`;
  if (s.noRemoval) {
    res.textContent = ex.repeat
      ? `${head} no removal: liver and kidney clearance are both zero, so there is no half-life and no steady state. Each amount adds to what is already there and the level keeps climbing for as long as the drug is taken · ${shareText}.`
      : `${head} no removal: liver and kidney clearance are both zero, so there is no half-life. The level rises to about ${n2(s.peak)} model units and stays there; it never falls · ${shareText}.`;
  } else {
    res.textContent = ex.repeat
      ? `${head} ${common} · steady state after about ${halfLives(s.ssTime)}, counting the time absorption takes · plateau between ${n2(s.trough)} and ${n2(s.peak)} model units, average ${n2(s.plateau)} · the curve ${rangeWords(s)}.`
      : `${head} ${common} · highest level ${n2(s.peak)} model units, ${halfLives(s.peakAt)} after it is taken · below ${fall}% of that peak about ${halfLives(s.fall)} after it is taken, read off the curve itself, so absorption still going on is counted.`;
  }
  Object.assign(res.dataset, { half: num4(s.half), ss: num4(s.ssUsual), f: num4(s.f), plateau: num4(s.plateau), peak: num4(s.peak), noRemoval: s.noRemoval ? '1' : '0' });
}
for (const k of EX_KEYS) $('#' + k).addEventListener('input', e => { ex[k] = Number(e.target.value); updateExplore(); });
$$('input[name=route]').forEach(r => r.addEventListener('change', () => { ex.iv = r.value === 'iv' ? 1 : 0; updateExplore(); }));
$$('input[name=schedule]').forEach(r => r.addEventListener('change', () => { ex.repeat = r.value === 'repeat' ? 1 : 0; updateExplore(); }));
$('#preset').addEventListener('change', e => { ex = PK.build(e.target.value, { repeat: ex.repeat }); updateExplore(); });
$('#reset').addEventListener('click', () => { ex = { ...NORMAL_P }; $('#preset').value = 'normal'; updateExplore(); });

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    if (!Array.isArray(loaded.values) || !loaded.values.every(validValue)) throw new Error('Invalid reference data');
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'At the teaching baseline the four half-life rows sit on their reference values, because the model removes drug in the same first-order way the chapter describes. The bioavailability row is different: its reference is for the intravenous route, and the baseline gives the drug by mouth, so its marker sits below that value. Choose the intravenous route to see it reach the reference. How far each state moves the model is an illustrative choice; only the directions come from the quoted text.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v, n);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const [a, b] = SCALE(v);
      // Reference labels under the bar; a narrow band gets one "low to high" label, and an end label too close to one is dropped.
      const narrow = hasRange(v) && pos(v.high) - pos(v.low) < 40;
      const refLabels = hasRange(v)
        ? (narrow ? [[(pos(v.low) + pos(v.high)) / 2, `${v.low}–${v.high}`, 'middle']] : [[pos(v.low), v.low, 'end'], [pos(v.high), v.high, 'start']])
        : [[pos(v.typical), v.typical, 'middle']];
      const ref = (hasRange(v)
        ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`
        : `<path class="typical" d="M${pos(v.typical)} 4 V42"/><path class="typical-tip" d="M${pos(v.typical) - 6} 4 H${pos(v.typical) + 6} L${pos(v.typical)} 12 Z"/>`) +
        refLabels.map(([x, t, anchor]) => `<text x="${f(x)}" y="58" text-anchor="${anchor}">${t}</text>`).join('');
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      const clear = x => refLabels.every(([rx, t]) => Math.abs(rx - x) > 18 + String(t).length * 5);
      const ends = (clear(20) ? `<text x="20" y="58" class="end">${a}</text>` : '') + (clear(380) ? `<text x="380" y="58" text-anchor="end" class="end">${b}</text>` : '');
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${ref}${marker}${ends}</svg><div class="key"></div>`;
      const refName = v.referenceLabel || 'typical value';
      const refWords = hasRange(v) ? `the source range ${v.low}–${v.high} ${v.unit} as a shaded band` : `the source’s ${refName} ${v.typical}${v.unit === '%' ? '%' : ' ' + v.unit} as a black mark`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${refWords}, a blue marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = hasRange(v) ? `Source range ${v.low}–${v.high} ${v.unit} (shaded) · blue line: illustrative teaching-model value` : `Source ${refName} ${v.typical}${v.unit === '%' ? '%' : ' ' + v.unit} (black mark; the source gives no range) · blue line: illustrative teaching-model value${v.referenceLabel ? ' for the route in use' : ''}`;
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
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on the illustrative model.';
  }
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
