// Lesson 24: Spirometry and lung volumes. The kit (/lab/kit/kit.js) runs the page; this file is the
// pictures and the Clinical values and Explore freely tabs. The model is model.js.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, path, arrowFixed, ghost, part, f, clamp, ease, span, lerpObj, readout } from '/lab/kit/draw.js';
import { P, smooth, samplePath } from '/lab/kit/art/core.js';
import { axes, curve, marker } from '/lab/kit/art/chart.js';
import { lungsFrontal } from '/lab/kit/art/lung.js';
import { forced, setBaseline, STATES, NORMAL } from './model.js?v=3';

const $ = s => document.querySelector(s);
const INK = P.ui.ink, BLUE = P.ui.blue, MUTED = P.ui.muted, GHOST = P.ui.ghost;
// One colour per volume, course-wide in this lesson: the three volumes a spirometer sees are shades of the
// lung's own rose, and residual volume, which it never sees, is grey with a hatch.
const SEG = { rv: P.ui.rule, erv: P.lung.lo, tv: P.lung.base, irv: P.lung.hi };

/* ---------- The model, once the data file has set its baseline ---------- */
let BASE = null, ASTHMA = null, V0 = null;
function settle() {
  BASE = forced(NORMAL);
  ASTHMA = forced(STATES.asthma);
  V0 = BASE;   // the normal volumes: tv, irv, erv, rv, frc, vc, tlc
}
// Shared scales: every picture of the same kind uses the same axes, so a change reads as a change.
const S = () => ({ VMAX: 1.2 * V0.vc, FMAX: 1.2 * BASE.pef, FMIN: -.62 * BASE.pef, BMAX: 1.25 * V0.tlc, T: 6 });

/* ---------- Small drawing helpers ---------- */
const poly = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L');
// A vertical bracket with its ticks on the left, at x from y0 (top) to y1.
const vbracket = (x, y0, y1, col = INK) => `<path d="M${f(x - 7)} ${f(y0)} H${f(x)} V${f(y1)} H${f(x - 7)}" fill="none" stroke="${col}" stroke-width="1.75" stroke-linejoin="round"/>`;
// A thin diagonal hatch inside a rectangle (drawn as lines, so no pattern id has to resolve in a hidden step).
function hatch(x, y, w, h, col = MUTED, gap = 9) {
  let d = '';
  for (let k = -h; k < w; k += gap) {
    const x0 = Math.max(x, x + k), y0 = y + h - Math.max(0, x0 - (x + k)), x1 = Math.min(x + w, x + k + h), y1 = y + h - (x1 - (x + k));
    if (x1 > x0) d += `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} `;
  }
  return `<path d="${d}" stroke="${col}" stroke-width="1.1" stroke-opacity=".55"/>`;
}
// A named change: a blue fixed-head arrow and its words, placed by hand so they stay clear of the curves.
const named = (a, b, words, [tx, ty, anchor = 'start'], cls = 'sm b blue') =>
  `<g data-delta>${Math.hypot(b[0] - a[0], b[1] - a[1]) > 8 ? arrowFixed(`M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}`, BLUE, 3.5) : ''}${text(tx, ty, words, cls, anchor)}</g>`;

/* ---------- The three views of a breath ---------- */
// Spirogram of one forced blow: volume breathed out against time, in a frame { x0, y0 (axis), x1, y1 (top) }.
function spiroFrame(fr) {
  const { VMAX, T } = S();
  return { ...fr, x: t => fr.x0 + clamp(t / T, 0, 1) * (fr.x1 - 14 - fr.x0), y: V => fr.y0 - V / VMAX * (fr.y0 - fr.y1 - 8) };
}
function spiroPts(o, fr, upTo = Infinity) {
  const { T } = S(), end = Math.min(upTo, T), step = Math.max(1, Math.round(o.pts.length / 160));
  const pts = [];
  for (let i = 0; i < o.pts.length; i += step) { const [t, V] = o.pts[i]; if (t > end) break; pts.push([fr.x(t), fr.y(V)]); }
  if (end > o.tEnd) pts.push([fr.x(o.tEnd), fr.y(o.fvc)], [fr.x(end), fr.y(o.fvc)]);
  else { const [t, V] = o.pts[Math.min(o.pts.length - 1, Math.round(end / (o.pts[1][0] - o.pts[0][0])))]; pts.push([fr.x(t), fr.y(V)]); }
  return pts;
}
// Flow-volume loop: flow against volume breathed out, in a frame { x0, x1, y1 (top), y2 (bottom) }.
function loopFrame(fr, { outOnly = false } = {}) {
  const { VMAX, FMAX } = S(), FMIN = outOnly ? 0 : S().FMIN, zero = fr.y1 + (fr.y2 - fr.y1) * FMAX / (FMAX - FMIN);
  return { ...fr, zero, x: V => fr.x0 + V / VMAX * (fr.x1 - 14 - fr.x0), y: F => zero - F / FMAX * (zero - fr.y1) };
}
function loopPts(o, fr, { insp = true } = {}) {
  const step = Math.max(1, Math.round(o.pts.length / 200)), out = [];
  // every sample through the fast rise to the peak, then a thinned set
  for (let i = 0; i < o.pts.length; i += o.pts[i][0] < .2 ? 1 : step) out.push([fr.x(o.pts[i][1]), fr.y(o.pts[i][2])]);
  out.push([fr.x(o.fvc), fr.y(0)]);
  if (insp) for (const [V, F] of o.insp) out.push([fr.x(V), fr.y(F)]);
  return out;
}
const peakOf = (o, fr) => { let best = o.pts[0]; for (const p of o.pts) if (p[2] > best[2]) best = p; return [fr.x(best[1]), fr.y(best[2])]; };
function loopAxes(fr, { yWord = 'flow', inWord = true } = {}) {
  let s = axes({ x0: fr.x0, y0: fr.zero, x1: fr.x1, y1: fr.y1, cls: 'xs b' });
  s += path(`M${fr.x0} ${f(fr.zero)} V${f(fr.y2)}`, INK, 1.5);
  const top = [yWord, inWord ? 'out' : ''].filter(Boolean).join(' ');
  if (top) s += text(fr.x0 + 12, fr.y1 + 6, top, 'xs b', 'start');
  if (inWord) s += text(fr.x0 + 10, fr.y2 + 2, 'in', 'xs muted', 'start');
  return s;
}
// Lung-volume bars: the normal row (dashed, empty) over this state's row (filled), on one scale from x0.
function volumeBars(o, g, { x0 = 72, x1 = 470, y = 0, rowH = 32, labels = true, ghostWord = 'normal' } = {}) {
  const { BMAX } = S(), k = (x1 - x0) / BMAX;
  const segs = v => [['rv', v.rv], ['erv', v.erv], ['tv', v.tv], ['irv', v.irv]];
  let s = '', x = x0;
  if (g) {
    s += text(x0 - 8, y + rowH * .7, ghostWord, 'xs muted', 'end');
    let gx = x0, gs = '';
    for (const [, v] of segs(g)) { gs += `<rect x="${f(gx + 1)}" y="${f(y + 1)}" width="${f(v * k - 2)}" height="${rowH - 2}" fill="none" stroke="${GHOST}" stroke-width="2" stroke-dasharray="5 3"/>`; gx += v * k; }
    s += ghost(gs);
  }
  const yy = g ? y + rowH + 14 : y;
  if (g) s += text(x0 - 8, yy + rowH * .7, 'now', 'xs b', 'end');
  let bars = '';
  for (const [id, v] of segs(o)) {
    const w = v * k;
    let seg = `<rect x="${f(x)}" y="${f(yy)}" width="${f(w)}" height="${rowH}" fill="${SEG[id]}" stroke="${P.lung.line}" stroke-width="1.1"/>`;
    if (id === 'rv') seg += hatch(x, yy, w, rowH);
    if (labels && w > 26) seg += text(x + w / 2, yy + rowH / 2 + 6, id.toUpperCase(), 'xs b');
    bars += part(id, seg);
    x += w;
  }
  return { svg: s + `<g data-bars>${bars}</g>`, x: v => x0 + v * k, rowY: yy, ghostY: y, bottom: yy + rowH };
}

/* ---------- Step pictures: building the breath ---------- */
// Step 1: a person blowing into a mouthpiece, nose clipped, and the trace the spirometer draws as they breathe.
// The head is a plain profile facing the spirometer; the lungs below it are drawn from the front.
const HEAD = 'M112 104 C110 94 102 86 100 74 C94 52 100 22 128 14 C146 9 160 20 160 36 L162 44 C166 50 170 54 168 57'
  + ' C166 60 162 60 160 61 L161 64 L160 70 C160 76 160 82 154 86 C148 90 142 90 140 94 L140 104';
function spirometerPicture(t) {
  const b = .5 - .5 * Math.cos(2 * Math.PI * 2 * t);           // two quiet breaths per loop
  let s = `<path d="${HEAD} Z" fill="${P.ui.paper}"/><path d="${HEAD}" fill="none" stroke="${INK}" stroke-width="1.75" stroke-linejoin="round"/>`;
  s += lungsFrontal({ x: 128, y: 104, s: .8, breathe: b, parts: { lungs: 'lungs' } });
  // lips round a mouthpiece, a tube to the spirometer box, and a clip on the nose
  const tubeD = 'M170 66 H198 Q214 66 214 52 Q214 42 226 42 H244';
  s += part('spirometer', path(tubeD, MUTED, 12) + path(tubeD, P.ui.paper, 7)
    + `<rect x="158" y="60" width="16" height="11" rx="3" fill="${P.ui.paper}" stroke="${INK}" stroke-width="1.5"/>`
    + `<rect x="244" y="20" width="132" height="44" rx="9" fill="${P.ui.paper}" stroke="${INK}" stroke-width="1.75"/>` + text(310, 49, 'spirometer', 'sm b'));
  s += `<rect x="158" y="44" width="11" height="9" rx="2" fill="${MUTED}"/>`;
  // air in or out, by the breath's direction, along the tube
  const dir = Math.sin(2 * Math.PI * 2 * t);
  if (Math.abs(dir) > .2) s += arrowFixed(dir > 0 ? 'M226 84 H184' : 'M180 84 H222', INK, 3) + text(176, 108, dir > 0 ? 'air in' : 'air out', 'xs', 'start');
  // the trace: lung volume against time, drawn up to now
  const fr = { x0: 262, y0: 300, x1: 470, y1: 104 };
  let tr = `<rect x="250" y="88" width="222" height="236" rx="10" fill="${P.ui.paper}" stroke="${P.ui.rule}" stroke-width="1.5"/>`;
  tr += path(`M${fr.x0} 118 V${fr.y0} H${fr.x1 - 6}`, INK, 1.5) + text(fr.x0 + 8, 112, 'volume', 'xs b', 'start') + text(fr.x1 - 6, fr.y0 + 20, 'time', 'xs b', 'end');
  const pts = [], n = Math.max(2, Math.round(120 * t));
  for (let i = 0; i <= n; i++) { const u = t * i / n, bb = .5 - .5 * Math.cos(2 * Math.PI * 2 * u); pts.push([fr.x0 + 6 + u * (fr.x1 - 20 - fr.x0), 250 - 70 * bb]); }
  tr += curve(pts, { col: BLUE }) + marker(...pts[pts.length - 1], { col: BLUE });
  s += part('trace', tr) + text(361, 346, 'the spirogram', 'sm b blue');
  s += text(128, 346, 'lungs', 'sm b');
  return s;
}

// Steps 2 to 4: the lung's volume against time, from zero air up.
const TR = { x0: 56, y0: 372, x1: 322, y1: 40 };
const tvY = V => TR.y0 - V / (1.12 * V0.tlc) * (TR.y0 - 56);
// The volume at time u (seconds of the drawn program): quiet breaths, then in to TLC, out to RV, back.
function program(mode) {
  const v = V0, frc = v.frc, top = v.frc + v.tv;
  const cos = (a, b, k) => a + (b - a) * (1 - Math.cos(Math.PI * clamp(k, 0, 1))) / 2;
  const tidal = u => frc + v.tv * (1 - Math.cos(2 * Math.PI * u / 4)) / 2;
  if (mode === 'tidal') return { T: 12, V: tidal };
  return {
    T: 22,
    V: u => u < 8 ? tidal(u) : u < 10 ? cos(frc, top, (u - 8) / 2) : u < 11.5 ? cos(top, v.tlc, (u - 10) / 1.5)
      : u < 16 ? cos(v.tlc, v.rv, (u - 11.5) / 4.5) : u < 18 ? cos(v.rv, frc, (u - 16) / 2) : tidal(u - 18),
  };
}
function tracePts(mode, upTo) {
  const pr = program(mode), pts = [], n = 220;
  for (let i = 0; i <= n; i++) { const u = pr.T * i / n; if (u > upTo + 1e-9) break; pts.push([TR.x0 + 4 + u / pr.T * (TR.x1 - 18 - TR.x0), tvY(pr.V(u))]); }
  return pts;
}
const traceAxes = () => axes({ x0: TR.x0, y0: TR.y0, x1: TR.x1, y1: TR.y1, xLabel: 'time', yLabel: 'air in the lungs', cls: 'xs b' });
const colLabel = (y, name, sub, cls = 'sm b') => text(338, y - 4, name, cls, 'start') + (sub ? text(338, y + 17, sub, 'xs muted', 'start') : '');

function tidalPicture(t) {
  const pr = program('tidal'), u = pr.T * t, pts = tracePts('tidal', u), v = V0;
  let s = traceAxes();
  s += text((TR.x0 + TR.x1) / 2, (tvY(v.frc) + TR.y0) / 2, 'air that stays in', 'sm muted');
  s += curve(pts, { col: BLUE }) + marker(...pts[pts.length - 1], { col: BLUE });
  s += part('tv', vbracket(330, tvY(v.frc + v.tv), tvY(v.frc), BLUE) + colLabel((tvY(v.frc + v.tv) + tvY(v.frc)) / 2, 'TV', 'one quiet breath'));
  return s;
}
function reservesPicture(t, { residual = false } = {}) {
  const pr = program('reserves'), u = residual ? pr.T : pr.T * ease.inOut(span(t, 0, .96)), pts = tracePts('reserves', u), v = V0;
  let s = '';
  if (residual) {
    const y0 = tvY(v.rv);
    s += part('rv', `<rect x="${TR.x0 + 1}" y="${f(y0)}" width="${TR.x1 - TR.x0 - 10}" height="${f(TR.y0 - y0 - 1)}" fill="${SEG.rv}" fill-opacity=".75"/>` + hatch(TR.x0 + 1, y0, TR.x1 - TR.x0 - 10, TR.y0 - y0 - 1)
      + text((TR.x0 + TR.x1) / 2, (y0 + TR.y0) / 2 + 7, 'RV: never breathed out', 'sm b'));
  }
  s += traceAxes();
  s += curve(pts, { col: BLUE }) + marker(...pts[pts.length - 1], { col: BLUE });
  const tvTop = tvY(v.frc + v.tv);
  s += part('tv', text(TR.x0 + 52, tvTop - 14, 'TV', 'xs b'));
  if (residual) {
    s += part('vc', vbracket(330, tvY(v.tlc), tvY(v.rv), BLUE) + colLabel((tvY(v.tlc) + tvY(v.rv)) / 2 - 10, 'what the', '', 'xs b blue') + colLabel((tvY(v.tlc) + tvY(v.rv)) / 2 + 12, 'spirometer', '', 'xs b blue') + colLabel((tvY(v.tlc) + tvY(v.rv)) / 2 + 34, 'can see', '', 'xs b blue'));
    s += part('rv', vbracket(330, tvY(v.rv) + 3, TR.y0, MUTED) + colLabel((tvY(v.rv) + TR.y0) / 2 + 8, 'hidden', '', 'xs b muted'));
    return s;
  }
  // both brackets are always there, so their terms can light them; each is faint until the trace reaches it
  const seen = at => `opacity="${u >= at ? 1 : .25}"`;
  s += part('irv', vbracket(330, tvY(v.tlc), tvTop, BLUE) + colLabel((tvY(v.tlc) + tvTop) / 2, 'IRV', 'extra in'), seen(11.4));
  s += part('erv', vbracket(330, tvY(v.frc), tvY(v.rv), BLUE) + colLabel((tvY(v.frc) + tvY(v.rv)) / 2, 'ERV', 'extra out'), seen(15.9));
  return s;
}
// Step 5: the four volumes stacked, and the four capacities as brackets.
function capacitiesPicture() {
  const v = V0, top = 56, y0 = 392, k = (y0 - top) / v.tlc, X = 152, W = 84;
  const yAt = V => y0 - V * k;
  let s = '', base = 0;
  for (const [id, val] of [['rv', v.rv], ['erv', v.erv], ['tv', v.tv], ['irv', v.irv]]) {
    const y = yAt(base + val), h = val * k;
    let seg = `<rect x="${X}" y="${f(y)}" width="${W}" height="${f(h)}" fill="${SEG[id]}" stroke="${P.lung.line}" stroke-width="1.1"/>`;
    if (id === 'rv') seg += hatch(X, y, W, h);
    seg += text(X + W / 2, y + h / 2 + 6, id.toUpperCase(), 'xs b');
    s += part(id, seg); base += val;
  }
  const cap = (id, x, a, b, col = INK) => part(id, vbracket(x, yAt(b), yAt(a), col) + text(x + 8, (yAt(a) + yAt(b)) / 2 + 7, id.toUpperCase(), 'sm b', 'start'));
  s += cap('ic', 262, v.frc, v.tlc) + cap('frc', 262, 0, v.frc - 4) + cap('vc', 336, v.rv, v.tlc, BLUE) + cap('tlc', 410, 0, v.tlc);
  s += text(8, 306, 'FRC and TLC', 'xs b', 'start') + text(8, 328, 'hold RV, so a', 'xs muted', 'start') + text(8, 350, 'spirometer', 'xs muted', 'start') + text(8, 372, 'cannot see them', 'xs muted', 'start');
  return s;
}
// Step 6: the lung pulls in, the chest wall springs out; at FRC the two balance. A coronal slice: the chest wall
// is muscle with ribs cut across, the pleura holds each lung against it, and the diaphragm closes the floor,
// meeting the wall at the costophrenic angles.
const BAL = { x: 240, y: 52, s: .92, breathe: .2 };
const balAt = ([x, y]) => { const bx = x * (1 + .055 * BAL.breathe), by = y < 60 ? y : 60 + (y - 60) * (1 + .085 * BAL.breathe); return [BAL.x + bx * BAL.s, BAL.y + by * BAL.s]; };
// each lung's outer edge, apex to base (lung.js's RIGHT and LEFT outlines), and the diaphragm under them
const BAL_EDGE = {
  r: [[-56, 12], [-84, 20], [-106, 40], [-124, 72], [-137, 110], [-145, 150], [-148, 190], [-145, 218], [-139, 233]],
  l: [[56, 12], [80, 19], [98, 34], [118, 64], [134, 100], [144, 140], [148, 182], [146, 222], [141, 249]],
};
const BAL_DIA = [[-146, 240], [-120, 228], [-88, 214], [-60, 210], [-36, 216], [-14, 228], [0, 232], [20, 238], [44, 246], [70, 240], [96, 230], [124, 240], [146, 254]];
function wallSide(edge, sign) {
  const base = samplePath(smooth(edge.map(balAt)), 40);
  const off = d => base.map((p, i) => {
    const a = base[Math.max(0, i - 1)], b = base[Math.min(base.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] + sign * (b[1] - a[1]) / L * d, p[1] - sign * (b[0] - a[0]) / L * d];
  });
  return { pleura: off(2.5), inner: off(6), outer: off(22), mid: off(14), base };
}
function balancePicture() {
  const R = wallSide(BAL_EDGE.r, -1), Lf = wallSide(BAL_EDGE.l, 1);
  let wall = '';
  for (const W of [R, Lf]) {
    wall += `<path d="${smooth([...W.inner, ...[...W.outer].reverse()], { closed: true })}" fill="${P.skeletal.hi}" stroke="${P.skeletal.lo}" stroke-width="1.5" stroke-linejoin="round"/>`;
    // ribs, cut across: an oval of bone every few steps down the wall
    for (let i = 4; i < W.mid.length - 2; i += 5) {
      const [x, y] = W.mid[i], a = W.mid[i - 1], b = W.mid[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      wall += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="7" ry="4.6" transform="rotate(${f(ang)} ${f(x)} ${f(y)})" fill="${P.boneCortical.base}" stroke="${P.boneCortical.line}" stroke-width="1.4"/>`;
    }
  }
  // the diaphragm: a muscle sheet from wall to wall under the lungs
  const end = W => W.mid[W.mid.length - 1], dia = [end(R), ...BAL_DIA.map(([x, y]) => balAt([x, y + 6])), end(Lf)];
  let s = part('chestwall', wall + path(smooth(dia), P.skeletal.lo, 8, 'stroke-linecap="round"') + path(smooth(dia), P.skeletal.hi, 4.5, 'stroke-linecap="round"')
    + arrowFixed('M78 200 H40', INK, 3.5) + arrowFixed('M402 200 H440', INK, 3.5));
  s += `${lungsFrontal({ ...BAL, tree: false })}`;
  // the pleura: the thin sealed layer between lung and wall
  s += part('pleura', [R, Lf].map(W => path(smooth(W.pleura), P.lung.line, 1.6, 'stroke-linecap="round"')).join(''));
  s += part('recoil', arrowFixed('M122 196 H164', BLUE, 4) + arrowFixed('M358 196 H316', BLUE, 4));
  s += part('recoil', text(16, 362, 'lung pulls in', 'sm b blue', 'start'));
  s += part('chestwall', text(464, 362, 'chest wall springs out', 'sm b', 'end'));
  s += text(240, 394, 'at FRC the two balance', 'sm');
  return s;
}

/* ---------- Step pictures: the forced breath ---------- */
function forcedPicture(t) {
  const o = BASE, fr = spiroFrame({ x0: 64, y0: 330, x1: 452, y1: 40 }), { T } = S();
  const now = T * ease.out(span(t, 0, .9));
  const ticks = { x: [0, 1, 2, 3, 4, 5].map(k => [k, k === 1 ? '1 s' : String(k), fr.x(k)]) };
  let s = axes({ x0: fr.x0, y0: fr.y0, x1: fr.x1, y1: fr.y1, yLabel: 'volume breathed out', ticks, cls: 'xs b' });
  const pts = spiroPts(o, fr, now);
  s += curve(pts, { col: BLUE }) + marker(...pts[pts.length - 1], { col: BLUE });
  if (now >= 1) {
    const y = fr.y(o.fev1), x = fr.x(1);
    s += part('fev1', path(`M${f(x)} ${fr.y0} V${f(y)} H${fr.x0}`, INK, 1.5, 'stroke-dasharray="4 4"') + marker(x, y, { col: BLUE, r: 6 }) + text(x + 14, y + 26, 'FEV1: out in the first second', 'sm b blue', 'start'));
  }
  if (now >= o.tEnd) {
    const y = fr.y(o.fvc);
    s += part('fvc', path(`M${fr.x0} ${f(y)} H${fr.x1 - 14}`, INK, 1.5, 'stroke-dasharray="4 4"') + text(fr.x1 - 14, y - 12, 'FVC: all of it', 'sm b', 'end'));
  }
  return s;
}
function ratioPicture() {
  const o = BASE, x0 = 40, x1 = 440, xF = x0 + (x1 - x0) * o.ratio;
  let s = text(x0, 46, 'FVC: the whole forced breath', 'sm b', 'start');
  s += part('fvc', `<rect x="${x0}" y="60" width="${x1 - x0}" height="44" rx="6" fill="${P.ui.blueWash}" stroke="${INK}" stroke-width="1.5"/>`);
  s += part('fev1', `<rect x="${x0}" y="60" width="${f(xF - x0)}" height="44" rx="6" fill="${BLUE}"/>` + path(`M${x0} 118 V126 H${f(xF)} V118`, BLUE, 1.75) + text(x0, 150, 'FEV1: the first second', 'sm b blue', 'start'));
  s += text((xF + x1) / 2, 150, 'the rest', 'xs muted');
  s += part('ratio', text(240, 210, 'FEV1 ÷ FVC', 'lg b') + text(240, 238, 'the share out in the first second', 'sm'));
  return s;
}
function loopPicture(t) {
  const o = BASE, fr = loopFrame({ x0: 64, x1: 456, y1: 44, y2: 330 });
  let s = loopAxes(fr);
  const pts = loopPts(o, fr);
  s += part('loop', curve(pts, { col: BLUE, close: true }));
  const pk = peakOf(o, fr);
  s += part('peak', marker(...pk, { col: BLUE, r: 6 }) + path(`M${f(pk[0] + 8)} ${f(pk[1] - 4)} L196 ${f(fr.y1 + 22)}`, INK, 1.25) + text(202, fr.y1 + 28, 'peak expiratory flow', 'sm b', 'start'));
  s += text(fr.x(o.fvc * .32), fr.zero - 22, 'breathing out', 'xs muted', 'start');
  s += text(fr.x(o.fvc * .5), fr.zero + (fr.y2 - fr.zero) * .45, 'breathing in', 'xs muted');
  s += text((fr.x0 + fr.x1) / 2, fr.y2 + 34, 'volume breathed out', 'xs b');
  // a dot travels the loop: out along the top, back in along the bottom
  const k = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
  s += marker(...pts[k], { col: INK, r: 6 });
  return s;
}
function downslopePicture(t) {
  const fr = loopFrame({ x0: 64, x1: 456, y1: 70, y2: 262 }, { outOnly: true });
  let s = loopAxes(fr, { inWord: false }) + text((fr.x0 + fr.x1) / 2, fr.zero + 30, 'volume breathed out', 'xs b');
  const tries = [.4, .65, 1].map(e => forced({ ...NORMAL, e, fade: false }));
  // the shared downslope, lit behind the curves
  const n = BASE, from = n.pts.findIndex(p => p[1] > n.fvc * .45);
  const slope = n.pts.slice(from).filter((_, i) => i % 6 === 0).map(p => [fr.x(p[1]), fr.y(p[2])]);
  s += part('downslope', path(poly(slope), P.ui.blueWash, 16));
  tries.forEach((o, i) => {
    const a = i === 0 ? 1 : span(t, i * .3 - .3, i * .3 + .1);
    if (a <= 0) return;
    const pts = loopPts(o, fr, { insp: false }), m = Math.max(2, Math.round(pts.length * a));
    s += `<g opacity="${[.45, .7, 1][i]}">${curve(pts.slice(0, m), { col: BLUE })}</g>`;
  });
  if (t > .9) {
    const at = V => fr.x(V), V = n.fvc * .06, lo = tries[0].pts.find(p => p[1] >= V), hi = tries[2].pts.find(p => p[1] >= V);
    s += named([at(V), fr.y(lo[2]) - 6], [at(V), fr.y(hi[2]) + 10], 'harder push, higher peak', [at(V) + 30, fr.y(tries[2].pef) - 6]);
    s += part('downslope', text(fr.x(n.fvc * .2), fr.zero - 14, 'same downslope', 'sm b', 'start'));
  }
  return s;
}
function patternsPicture() {
  const A = forced(STATES.asthma), F = forced(STATES.fibrosis);
  const panel = (o, x0, name, l1, l2) => {
    const fr = loopFrame({ x0, x1: x0 + 214, y1: 52, y2: 236 });
    let s = loopAxes(fr, { inWord: false, yWord: '' });
    s += ghost(curve(loopPts(BASE, fr), { role: 'ghost', close: true }));
    s += part(name, curve(loopPts(o, fr), { col: BLUE, close: true }) + text(x0 - 4, 26, `${name}`, 'sm b', 'start'));
    s += text(x0 + 100, 280, l1, 'xs b') + text(x0 + 100, 302, l2, 'xs muted');
    return s;
  };
  return panel(A, 30, 'obstructive', 'slow to empty', 'FEV1/FVC low') + panel(F, 262, 'restrictive', 'small lung', 'TLC low');
}

/* ---------- What changes it: the three views together, over a dashed normal ---------- */
const DASH = {
  spiro: { x0: 50, y0: 190, x1: 232, y1: 40 },
  loop: { x0: 284, x1: 472, y1: 40, y2: 196 },
};
function dashboard(o, g, kind = '', a = 1) {
  const sf = spiroFrame(DASH.spiro), lf = loopFrame(DASH.loop);
  let s = text(8, 22, 'spirogram', 'sm b', 'start') + text(276, 22, 'flow-volume loop', 'sm b', 'start');
  // spirogram
  s += axes({ x0: sf.x0, y0: sf.y0, x1: sf.x1, y1: sf.y1, cls: 'xs b' }) + text(sf.x1, sf.y0 + 24, 'time', 'xs b', 'end') + text(sf.x0 + 12, sf.y1 + 6, 'volume out', 'xs b', 'start');
  if (g) s += ghost(curve(spiroPts(g, sf), { role: 'ghost' }));
  s += part('trace', curve(spiroPts(o, sf), { col: BLUE }));
  // loop
  s += loopAxes(lf, { yWord: '' }) + text((lf.x0 + lf.x1) / 2 + 20, lf.y2 + 24, 'volume out', 'xs b');
  if (g) s += ghost(curve(loopPts(g, lf), { role: 'ghost', close: true }));
  s += part('loop', curve(loopPts(o, lf), { col: BLUE, close: true }));
  // volume bars
  s += text(8, 252, 'lung volumes', 'sm b', 'start') + text(136, 252, "step 5's stack, on its side", 'xs muted', 'start');
  const bars = volumeBars(o, g, { y: 266, rowH: 30, ghostWord: kind === 'bronchodilator' ? 'before' : 'normal' });
  s += bars.svg;
  if (g && kind) s += `<g data-named opacity="${f(a)}">${changeWords(kind, o, g, sf, lf, bars)}</g>`;
  if (g) s += `<g data-legend>${path('M8 404 H40', GHOST, 3, 'stroke-dasharray="6 5"')}${text(48, 410, kind === 'bronchodilator' ? 'before the inhaler' : 'normal', 'xs', 'start')}${path('M250 404 H282', BLUE, 4)}${text(290, 410, kind === 'bronchodilator' ? 'curves: after it' : 'curves: ' + (LEGEND[kind] || 'these settings'), 'xs', 'start')}</g>`;
  return s;
}
const LEGEND = { asthma: 'asthma', emphysema: 'emphysema', fibrosis: 'fibrosis', effort: 'poor effort' };
// What each change moved, named on the picture itself: one arrow and its words per view.
function changeWords(kind, o, g, sf, lf, bars) {
  const up = kind === 'bronchodilator', bot = bars.bottom;
  let s = '';
  // the spirogram: FEV1 at one second, or FVC where the curve levels off
  if (kind === 'asthma' || kind === 'emphysema' || up) {
    const a = [sf.x(1) + 8, sf.y(g.fev1)], b = [sf.x(1) + 8, sf.y(o.fev1)];
    s += named([a[0], a[1] + (up ? -2 : 2)], [b[0], b[1] + (up ? 8 : -8)], up ? 'FEV1 rises' : 'FEV1 falls', [sf.x0 + 40, sf.y0 - 14]);
  } else {
    s += named([sf.x(5), sf.y(g.fvc) + 2], [sf.x(5), sf.y(o.fvc) - 6], kind === 'effort' ? 'stops short' : 'FVC falls', [sf.x1 - 10, sf.y(o.fvc) + 44, 'end']);
  }
  // the loop: its peak, or its width
  if (kind === 'fibrosis') {
    // halfway up, where the old curve's tail has already dropped below and the new downslope lies far to the left
    const y = lf.zero - .45 * (lf.zero - lf.y1), a = lf.x(g.fvc) - 2, b = lf.x(o.fvc) + 6;
    s += named([a, y], [b, y], 'narrower', [(a + b) / 2, y - 12, 'middle']);
  } else {
    // one vertical arrow just past both peaks, from the old curve to the new one, and its words beside its top
    const flowAt = (o, V) => (o.pts.find(p => p[1] >= V) || [0, 0, 0])[2];
    const pv = o2 => o2.pts.reduce((m, p) => p[2] > m[2] ? p : m)[1];
    const V = Math.max(pv(g), pv(o)) + .03 * V0.vc, x = lf.x(V), y0 = lf.y(flowAt(g, V)), y1 = lf.y(flowAt(o, V));
    const dir = Math.sign(y1 - y0);
    s += named([x, y0 + 3 * dir], [x, y1 - 5 * dir], { asthma: 'peak falls', emphysema: 'peak falls', bronchodilator: 'peak rises', effort: 'low, late peak' }[kind], [Math.max(x + 12, lf.x0 + 56), Math.min(y0, y1) - 6]);
  }
  // the bars: the segment that moved
  if (kind === 'asthma' || up) {
    const x = (bars.x(0) + bars.x(o.rv)) / 2;
    s += named([x, bot + 30], [x, bot + 4], up ? 'less trapped air: RV falls' : 'RV up: trapped air', [x + 14, bot + 40]);
  }
  if (kind === 'emphysema' || kind === 'fibrosis') {
    s += named([bars.x(g.tlc), bot + 14], [bars.x(o.tlc), bot + 14], kind === 'emphysema' ? 'RV, FRC and TLC rise' : 'every volume falls', [Math.max(bars.x(o.tlc), bars.x(g.tlc)), bot + 44, 'end']);
  }
  if (kind === 'emphysema') {
    // FRC, which the words name, is RV plus ERV: a bracket under the bars
    const xf = bars.x(o.frc), y = bot + 6;
    s += path(`M${f(bars.x(0))} ${f(y)} V${f(y + 7)} H${f(xf)} V${f(y)}`, INK, 1.5) + text((bars.x(0) + xf) / 2, y + 26, 'FRC', 'xs b');
  }
  if (kind === 'effort') s += text(bars.x(o.tlc), bot + 34, 'same lung: no change', 'sm b blue', 'end');
  return s;
}
// The words under a change: the measures that moved.
function rowsFor(o, g) {
  const tr = (v, b, up, down, tol = .03) => { const r = v / b; return r > 1 + tol ? ['up', up] : r < 1 - tol ? ['down', down] : ['same', 'about the same']; };
  return [
    ['FEV1', ...tr(o.fev1, g.fev1, 'higher', 'lower')],
    ['FVC', ...tr(o.fvc, g.fvc, 'higher', 'lower')],
    ['FEV1/FVC', ...tr(o.ratio, g.ratio, 'higher', 'lower')],
    ['Peak flow', ...tr(o.pef, g.pef, 'higher', 'lower')],
    ['TLC', ...tr(o.tlc, g.tlc, 'higher', 'lower')],
    ['RV', ...tr(o.rv, g.rv, 'higher', 'lower')],
  ];
}
const WHERE = {
  asthma: 'The blue spirogram rises more slowly than the dashed normal one and FEV1 falls; the blue loop has a lower peak and a downslope that bows inward; in the bars, RV grows a little while TLC stays the same.',
  emphysema: 'The blue spirogram rises slowly and FEV1 falls; the blue loop has a low peak and a deeply scooped downslope; in the bars, RV, FRC and TLC all grow past the dashed normal row.',
  fibrosis: 'The blue spirogram levels off early and low, so FVC falls; the blue loop is narrow, with a steep downslope and a peak a little below normal; every bar segment is shorter than the dashed normal row, so TLC falls.',
  bronchodilator: 'Starting from the dashed asthma curves, the blue spirogram rises faster and FEV1 rises; the blue loop peak rises and its downslope straightens; in the bars, RV shrinks back.',
  effort: 'The blue spirogram stops short of the dashed normal one; the blue loop has a low, late, rounded peak; the bars are unchanged, because the lung itself is the same.',
};
function change(kind) {
  const from = kind === 'bronchodilator' ? STATES.asthma : NORMAL;
  return {
    duration: 3200,
    stages: [[0, kind === 'bronchodilator' ? 'before the inhaler' : 'normal'], [.15, 'changing'], [.85, kind === 'bronchodilator' ? 'after it' : LEGEND[kind]]],
    render(t) {
      const k = ease.inOut(span(t, .15, .85));
      const o = forced(lerpObj(from, STATES[kind], k)), g = kind === 'bronchodilator' ? ASTHMA : BASE;
      const describe = rowsFor(o, g).map(([n, , w]) => `${n} ${w}`).join(', ');
      const label = `${kind === 'bronchodilator' ? 'After a bronchodilator' : LEGEND[kind][0].toUpperCase() + LEGEND[kind].slice(1)}: the spirogram, the flow-volume loop and the lung-volume bars, drawn over dashed ${kind === 'bronchodilator' ? 'curves from before the inhaler' : 'normal curves'}. ${WHERE[kind]} Compared with ${kind === 'bronchodilator' ? 'before' : 'normal'}: ${describe}.`;
      return { svg: svg(label, dashboard(o, g, kind, span(t, .6, .9)), { h: 420 }), readout: readout(rowsFor(o, g), kind === 'bronchodilator' ? 'Compared with before the inhaler' : 'Compared with normal') };
    },
  };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const still = (label, body, h) => () => svg(label, body(), { h });
const scenes = {
  spirometer: { duration: 6000, loop: true, rest: .25, render: t => svg('A head in profile, nose clipped, lips sealed round a mouthpiece; a tube runs from it to a spirometer box. Below, the lungs, drawn from the front. As the lungs swell and shrink with two quiet breaths, a pen draws the spirogram on the right: a gentle wave of volume against time.', spirometerPicture(t), { h: 360 }) },
  tidal: { duration: 6000, loop: true, render: t => svg('A spirogram of quiet breathing: air in the lungs against time. Small blue waves ride on top of a large volume of air that stays in. A bracket on the right marks one wave as TV, one quiet breath.', tidalPicture(t), { h: 410 }) },
  reserves: { duration: 7000, render: t => svg('A spirogram: two quiet breaths, then a breath all the way in and all the way out, then quiet breathing again. A bracket marks IRV, the extra air in above a quiet breath, and another marks ERV, the extra air out below it.', reservesPicture(t), { h: 410 }) },
  residual: still('The same spirogram with a grey hatched band along the bottom: RV, the air that is never breathed out. A blue bracket on the right marks what the spirometer can see, from RV up to the top of the deepest breath.', () => reservesPicture(1, { residual: true }), 410),
  capacities: still('A column of the four lung volumes stacked: RV at the bottom, hatched grey, then ERV, TV and IRV. Brackets beside it mark the capacities: IC is TV plus IRV, FRC is RV plus ERV, VC is everything but RV, and TLC is all four.', capacitiesPicture, 410),
  balance: still('Lungs from the front inside a slice of the chest wall, muscle with ribs cut across, and the diaphragm closing the floor. A thin pleura line holds each lung against the wall. Blue arrows inside the lungs point inward: the lung pulls in. Black arrows outside the chest wall point outward: the chest wall springs out. At FRC the two balance.', balancePicture, 404),
  forced: { duration: 4200, render: t => svg('A spirogram of a forced breath out: volume breathed out against seconds. The blue curve shoots up and levels off. Dashed lines mark FEV1, the volume out by one second, and FVC, the level where it flattens: all of it.', forcedPicture(t), { h: 370 }) },
  ratio: still('A long bar for FVC, the whole forced breath, with most of it filled in blue from the left: FEV1, the first second. Below, FEV1 divided by FVC: the share out in the first second.', ratioPicture, 250),
  loop: { duration: 5000, loop: true, render: t => svg('A flow-volume loop: flow against volume breathed out. Above the line, breathing out, flow shoots up to the peak expiratory flow and then falls in a nearly straight downslope. Below the line, breathing in, a rounded curve brings the volume back. A dot travels the loop.', loopPicture(t), { h: 376 }) },
  downslope: { duration: 4800, render: t => svg('Three blows of the same lung drawn as the top half of a flow-volume loop, from a weak push to a hard one. Each harder push has a higher peak, but all three join one shared downslope, lit in pale blue.', downslopePicture(t), { h: 310 }) },
  patterns: still('Two small flow-volume loops over dashed normal loops. Left, obstructive: a low peak and a downslope bowed inward; slow to empty, FEV1/FVC low. Right, restrictive: a narrow loop that ends early; small lung, TLC low.', patternsPicture, 312),
  asthma: change('asthma'),
  emphysema: change('emphysema'),
  fibrosis: change('fibrosis'),
  bronchodilator: change('bronchodilator'),
  effort: change('effort'),
};

/* ---------- Explore freely and Clinical values: the model with every control ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['r', 'c', 'e'];
const level = (k, v) => k === 'r' ? (v < 1.05 ? 'normal' : v < 1.6 ? 'a little narrowed' : v < 2.4 ? 'narrowed' : 'very narrowed')
  : k === 'c' ? (v < .6 ? 'very stiff' : v < .92 ? 'stiff' : v <= 1.08 ? 'normal' : v < 1.7 ? 'floppy' : 'very floppy')
  : (v >= .97 ? 'full' : v >= .7 ? 'a little weak' : 'poor');
// Explore freely and Clinical values share one set of settings, so both tabs name it the same way: the state it
// matches, or the reader's own settings.
const stateOf = p => Object.keys(STATES).find(k => SLIDERS.every(x => Math.abs(STATES[k][x] - p[x]) < 1e-9)) || 'custom';
function update() {
  if (!BASE) return;
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  const which = stateOf(params);
  $('#preset').value = which; $('#clinical-state').value = which; $('#state-summary').textContent = SUMMARY[which];
  const o = forced(params);
  const rows = rowsFor(o, BASE);
  const label = `Illustrative model with these settings: the spirogram, the flow-volume loop and the lung-volume bars, drawn over dashed normal. Compared with normal: ${rows.map(([n, , w]) => `${n} ${w}`).join(', ')}.`;
  $('#explore-visual').innerHTML = svg(label, dashboard(o, BASE, ''), { h: 420 }) + readout(rows);
  $('#clinical-visual').innerHTML = svg(label, dashboard(o, BASE, ''), { h: 420 });
  // without the reference file the model runs on stand-in sizes, counted in normal vital capacities, not litres
  const L = data ? mL => `${(mL / 1000).toFixed(2)} L` : x => `${x.toFixed(2)} VC`;
  const unit = data ? '' : ' (the reference file did not load, so sizes are shares of a normal vital capacity, VC)';
  $('#model-results').textContent = `Illustrative model${unit}: FEV1 ${L(o.fev1)}, FVC ${L(o.fvc)}, FEV1/FVC ${o.ratio.toFixed(2)}, peak flow ${data ? (o.pef / 1000).toFixed(1) + ' L/s' : o.pef.toFixed(2) + ' VC per second'}. TLC ${L(o.tlc)}, VC ${L(o.vc)}, FRC ${L(o.frc)}, RV ${L(o.rv)}.${params.e < .97 ? ' Effort is below full: a real test like this would not count, and would be repeated.' : ''}`;
  if (data) updateRows(o);
}
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); update(); });
// choosing a state in either tab sets the shared settings; 'Your own settings' keeps them as they are
const choose = e => { if (STATES[e.target.value]) params = { ...STATES[e.target.value] }; update(); };
const toNormal = () => { params = { ...NORMAL }; update(); };
$('#preset').addEventListener('change', choose);
$('#clinical-state').addEventListener('change', choose);
$('#reset').addEventListener('click', toNormal);
$('#clinical-reset').addEventListener('click', toNormal);

const SUMMARY = {
  normal: 'Normal teaching baseline.',
  asthma: 'Asthma (model): narrowed airways. FEV1 and the ratio fall; RV rises a little from trapped air; TLC is unchanged.',
  emphysema: 'Emphysema (model): a floppy lung with weak recoil. The ratio falls; RV, FRC and TLC rise.',
  fibrosis: 'Fibrosis (model): a stiff, small lung. Every volume falls; the ratio is normal or high.',
  bronchodilator: 'After a bronchodilator (model): the asthma lung with its airways reopened. FEV1 rises toward normal.',
  effort: 'Poor effort (model): the same lung, blown weakly and briefly. The curves fall; the volumes do not.',
  custom: 'Your own settings from Explore freely (model).',
};

/* ---------- Reference data ---------- */
// How each reference row is drawn: the bar's range (a display choice, not a reference value), and which
// model measure, if any, it is compared with.
const ROW = {
  tv: { scale: [0, 1500], model: o => o.tv }, rv: { scale: [0, 3500], model: o => o.rv }, frc: { scale: [0, 5000], model: o => o.frc },
  tlc: { scale: [0, 8000], model: o => o.tlc }, vc: { scale: [0, 6500], model: o => o.vc },
  compliance: { scale: [0, 450], model: (o, v) => v.typical * o.p.c, note: 'model: the textbook value times the compliance setting' },
  fev1fvc: { scale: [-4, 2] }, bdr: { scale: [0, 40] },
};
const domain = ([lo, hi]) => n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
const fmtVal = (v, n) => v.unit === 'z-score' ? n.toFixed(3) : Number.isInteger(n) ? String(n) : n.toFixed(1);
function updateRows(o) {
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), spec = ROW[v.id];
    if (!row || !spec?.model) continue;
    const val = spec.model(o, v), x = domain(spec.scale)(val), m = row.querySelector('.marker');
    m.setAttribute('x1', x); m.setAttribute('x2', x);
    row.querySelector('.reading').textContent = `Model: ${Math.round(val)} ${v.unit}`;
    const inRange = v.low !== null && v.high !== null ? (val < v.low ? 'below the textbook range' : val > v.high ? 'above the textbook range' : 'inside the textbook range')
      : Math.abs(val / v.typical - 1) <= .1 ? 'close to the textbook value' : val > v.typical ? 'above the textbook value' : 'below the textbook value';
    row.querySelector('.status').textContent = inRange;
  }
  const ratioRow = document.querySelector('[data-cv="fev1fvc"]');
  if (ratioRow) {
    ratioRow.querySelector('.reading').textContent = `Model: ${o.ratio.toFixed(2)}`;
    ratioRow.querySelector('.status').textContent = "a plain fraction; a real report compares it with the person's lower limit of normal as a z-score";
  }
  const bdr = document.querySelector('[data-cv="bdr"]');
  if (bdr) {
    const resp = (forced(STATES.bronchodilator).fev1 - ASTHMA.fev1) / BASE.fev1 * 100;
    bdr.querySelector('.reading').textContent = `Model: ${resp.toFixed(0)}% of predicted`;
    bdr.querySelector('.status').textContent = 'the model asthma, before and after its airways reopen (FEV1 change over the normal FEV1)';
  }
}
const clinicalControls = () => [...document.querySelectorAll('#clinical select, #clinical button')];
async function load() {
  clinicalControls().forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const get = id => loaded.values?.find(x => x.id === id);
    const vc = get('vc'), need = ['tv', 'rv', 'frc'].map(get);
    if (need.some(v => !Number.isFinite(v?.typical)) || !Number.isFinite(vc?.low) || !Number.isFinite(vc?.high)) throw new Error('Invalid reference data');
    data = loaded;
    // The model's normal lung: the textbook tidal volume, residual volume and FRC, and the middle of the vital
    // capacity range. TLC is then VC + RV.
    setBaseline({ tv: need[0].typical, rv: need[1].typical, frc: need[2].typical, vc: (vc.low + vc.high) / 2 });
    $('#disclaimer').textContent = data.disclaimer;
    for (const v of data.values) {
      const spec = ROW[v.id] || { scale: [0, 1] }, pos = domain(spec.scale), range = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      let marks = '';
      if (range) marks = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
      else if (v.low !== null) marks = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(380 - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40"/>`;
      if (v.typical !== null) marks += `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`;
      if (spec.model) marks += '<line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${marks}</svg><div class="key"></div>`;
      const [lo, hi] = spec.scale;
      const what = range ? `Textbook range ${fmtVal(v, v.low)} to ${fmtVal(v, v.high)} ${v.unit} (shaded)`
        : v.low !== null ? `${v.id === 'bdr' ? 'A significant response is above' : 'Normal is at or above'} ${fmtVal(v, v.low)} ${v.unit} (shaded)`
        : `Textbook typical value ${fmtVal(v, v.typical)} ${v.unit} (tick; no range given)`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${what}${spec.model ? ', and a blue marker for the illustrative model' : ''}`);
      right.querySelector('.key').textContent = `${what} · bar runs ${lo} to ${hi}${spec.model ? ' · blue line: model' : ''}`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}${spec.note ? ' · ' + spec.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    // A textbook carries no link; a guideline links only to its DOI.
    for (const sd of data.sourceDetails || Object.entries(data.sources).map(([id, citation]) => ({ id, citation }))) {
      const li = document.createElement('li');
      li.append(`[${sd.id}] ${sd.citation}`);
      if (sd.url && /^https:\/\/doi\.org\//.test(sd.url)) { const a = document.createElement('a'); a.href = sd.url; a.textContent = sd.url.replace('https://', ''); li.append(' ', a); }
      $('#sources').append(li);
    }
    clinicalControls().forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on illustrative stand-in volumes.';
  }
  settle();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
