// Lesson 1: the pressure-volume loop. The kit (/lab/kit/kit.js) runs the page; this file draws the
// guided lesson's pictures. Explore freely and Clinical values live in explore.js.
//
// Every loop comes from the same model as Explore freely (model.js), run to a steady beat, and is
// drawn with worded axes and no numbers: the shapes carry the idea.
//
// Expected behaviour:
//   - Each picture is the ventricle (top) and the graph (below), moved by one clock. The ventricle is
//     worked out from where the dot is on the graph (further right: more blood in it; higher up:
//     darker red and squeezing), so the two can never disagree.
//   - A picture is a function of its place t on a timeline from 0 to 1; the kit's player only moves t.
//     Every picture keeps beating. A condition step holds the normal loop, changes it into the new one
//     with the moved edges named, then keeps beating on the new loop (it loops from that point).
//   - svg[data-anim] reads "done" once a picture has been shown once; from then on a condition
//     step's [data-loop] path equals its data-final (hooks the lab pipeline's smoke test reads).
//   - Each condition step records which way the model moved each value (data-model-shifts), for
//     checking against the directions in clinical-values.json.
import { lesson } from '/lab/kit/kit.js';
import { Simulator, DEFAULTS } from './model.js';
import { onTab } from './explore.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 480, H = 418;                            // the whole picture
const TOP = 168;                                   // the ventricle's band; the graph starts below it
const G = { w: 480, h: 250 };                      // the graph's own box
const O = { x: 42, y: 212, top: 34, right: 462 };  // plot area inside it: origin bottom-left
const LAP_MS = 5600;                               // one slow heartbeat

// "What changes the loop": model settings changed from baseline. Where clinical-values.json has the
// matching state, these are that state's own model settings, so the lesson, the Clinical values tab
// and Explore freely all show the same ventricle.
// notes: the edges to name on the picture, as [the way the model must move it, the words, where].
const CONDITIONS = {
  fluids: { set: { Pla: 8 }, legend: 'with more fluid', notes: { edv: ['up', 'fills more'], lvsp: ['up', 'higher pressure'] } }, // as Explore freely's "↑ Preload" scenario
  constrict: { set: { Rs: 2 }, state: 'vasocon', legend: 'with tighter arteries', notes: { lvsp: ['up', 'higher pressure'], esv: ['up', 'empties less'] } },
  inotrope: { set: { Ees: 5 }, state: 'inotrope', legend: 'with an inotrope', notes: { esv: ['down', 'empties further'] } },
  venodil: { set: { Pla: 2 }, state: 'venodil', legend: 'with a venodilator', notes: { edv: ['down', 'fills less'], lvsp: ['down', 'lower pressure'] } },
  beta: { set: { HR: 56, Ees: 2.8 }, state: 'beta', legend: 'with a beta-blocker', notes: { lvsp: ['down', 'lower pressure'], hr: ['down', 'and it beats slower'] } },
  hfref: { set: { Ees: 1.3, Pla: 9, HR: 85 }, state: 'hfref', legend: 'heart failure', notes: { esv: ['up', 'empties less', 'over'], edv: ['up', 'bigger', 'over'] } },
};
// Model outputs under the ids clinical-values.json uses, for the direction-of-change record.
const OUT = { edv: b => b.EDV, esv: b => b.ESV, sv: b => b.SV, ef: b => b.EF, co: b => b.CO, hr: b => b.HR, lvsp: b => b.PlvMax, map: b => b.PaoMean };

// ---------- model: steady beats and a shared scale ----------
const beats = { base: new Simulator({ ...DEFAULTS }).runToSteady(300) };
for (const [k, c] of Object.entries(CONDITIONS)) beats[k] = new Simulator({ ...DEFAULTS, ...c.set }).runToSteady(300);
let vMax = 0, pMax = 0, svMax = 0;
for (const b of Object.values(beats)) { vMax = Math.max(vMax, b.EDV); pMax = Math.max(pMax, b.PlvMax); svMax = Math.max(svMax, b.SV); }
vMax *= 1.12; pMax *= 1.1;
const LIFT = 12; // filling runs near zero pressure: keep the bottom edge clear of the axis line
const X = v => O.x + v / vMax * (O.right - O.x);
const Y = p => O.y - LIFT - p / pMax * (O.y - LIFT - O.top);
const VOL = x => (x - O.x) / (O.right - O.x) * vMax;
const PRS = y => (O.y - LIFT - y) / (O.y - LIFT - O.top) * pMax;

function directions(base, b) {
  const out = {};
  for (const [k, f] of Object.entries(OUT)) {
    const a = f(base), c = f(b), tol = Math.max(Math.abs(a) * 0.02, 1e-6);
    out[k] = Math.abs(c - a) < tol ? 'none' : c > a ? 'up' : 'down';
  }
  return out;
}

// A beat as four edges, each resampled to a fixed number of points evenly spaced along the drawn
// line, so any two loops can be morphed point by point and edges can be drawn in turn.
const EDGES = [['contract', 'AO', 20], ['eject', 'AC', 56], ['relax', 'MO', 20], ['fill', null, 56]];
function shape(b) {
  const ev = Object.fromEntries(b.events.map(e => [e.kind, e.i]));
  const out = {};
  let from = 0;
  for (const [name, endKind, count] of EDGES) {
    const to = endKind ? ev[endKind] : b.n - 1;
    const xs = [], ys = [], cum = [0];
    for (let i = from; i <= to; i++) { xs.push(X(b.V[i])); ys.push(Y(b.Plv[i])); }
    for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const total = cum[cum.length - 1] || 1, pts = [];
    for (let k = 0, j = 0; k <= count; k++) {
      const s = total * k / count;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const span = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (s - cum[j]) / span));
      const j1 = Math.min(j + 1, xs.length - 1);
      pts.push([xs[j] + (xs[j1] - xs[j]) * t, ys[j] + (ys[j1] - ys[j]) * t]);
    }
    out[name] = pts;
    from = to;
  }
  return out;
}
const shapes = Object.fromEntries(Object.entries(beats).map(([k, b]) => [k, shape(b)]));
const LOOP_ORDER = ['fill', 'contract', 'eject', 'relax']; // teaching order: filling first
const loopPts = s => LOOP_ORDER.flatMap(k => s[k]);
const r = n => +n.toFixed(1);
const pathD = (pts, close) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');
const lerpPts = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const ramp = x => Math.min(1, Math.max(0, x));
const corner = (s, edge, end) => s[edge][end ? s[edge].length - 1 : 0];

// ---------- one heartbeat, as a place on the loop ----------
// A slow lap gives each phase time to be seen: the two brief same-volume phases are held longer than
// they really last.
const LAP = [['fill', 0.32], ['contract', 0.18], ['eject', 0.32], ['relax', 0.18]];
function lapAt(f, first = 'fill') {
  let i = LAP.findIndex(l => l[0] === first);
  f = ((f % 1) + 1) % 1;
  for (let n = 0; n < 3; n++, i = (i + 1) % 4) {
    if (f < LAP[i][1]) break;
    f -= LAP[i][1];
  }
  return [LAP[i][0], Math.min(1, f / LAP[i][1])];
}
// Everything the pictures need to know about one moment: where the dot is, and from that the volume,
// the pressure, how far each valve is open and how hard the muscle is squeezing.
function moment(s, edge, p) {
  const pts = s[edge], f = ramp(p) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
  const opening = ramp(p / 0.1), shutting = 1 - ramp(p / 0.3), flow = opening * (1 - ramp((p - 0.92) / 0.08));
  return {
    x, y, edge, V: VOL(x), P: PRS(y),
    mitral: edge === 'fill' ? opening : edge === 'contract' ? shutting : 0,
    aortic: edge === 'eject' ? opening : edge === 'relax' ? shutting : 0,
    squeeze: edge === 'contract' ? p : edge === 'eject' ? 1 : edge === 'relax' ? 1 - p : 0,
    inflow: edge === 'fill' ? flow : 0, outflow: edge === 'eject' ? flow : 0,
  };
}

// ---------- SVG helpers ----------
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
function attr(e, attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }
function label(parent, x, y, s, cls = '', anchor = 'start') {
  return el('text', { x, y, class: `lp-t ${cls}`, 'text-anchor': anchor }, parent, s);
}
function arrowHead(parent, x, y, dir, cls = 'lp-axis-head') {
  const d = { up: `M${x} ${y}l-6 11h12z`, right: `M${x} ${y}l-11 -6v12z`, down: `M${x} ${y}l-6 -11h12z`, left: `M${x} ${y}l11 -6v12z` }[dir];
  return el('path', { d, class: cls }, parent);
}
function arrow(parent, x1, y1, x2, y2, cls = 'lp-arrow') {
  const g = el('g', { class: cls }, parent);
  el('line', { x1, y1, x2, y2 }, g);
  const a = Math.atan2(y2 - y1, x2 - x1), s = 10;
  el('path', { d: `M${x2} ${y2}L${(x2 - s * Math.cos(a - 0.45)).toFixed(1)} ${(y2 - s * Math.sin(a - 0.45)).toFixed(1)}L${(x2 - s * Math.cos(a + 0.45)).toFixed(1)} ${(y2 - s * Math.sin(a + 0.45)).toFixed(1)}Z` }, g);
  return g;
}
function axes(g) {
  const a = el('g', { class: 'lp-axes' }, g);
  el('line', { x1: O.x, y1: O.y, x2: O.x, y2: O.top - 10 }, a);
  el('line', { x1: O.x, y1: O.y, x2: G.w - 8, y2: O.y }, a);
  arrowHead(a, O.x, O.top - 18, 'up');
  arrowHead(a, G.w - 2, O.y, 'right');
  label(g, O.x + 12, O.top - 8, 'pressure ↑', 'lp-axis-label');
  label(g, G.w - 4, O.y + 28, 'volume →', 'lp-axis-label', 'end');
}
const loopLine = (g, s, cls = 'lp-loop') => el('path', { d: pathD(loopPts(s), true), class: cls, 'data-part': 'loop' }, g);
const dotOn = g => el('circle', { r: 8, class: 'lp-dot' }, g);
const place = (dot, m) => attr(dot, { cx: r(m.x), cy: r(m.y) });
// Dashed lines from the dot to each axis, so it is plain which of the two measures is changing.
function guides(g) {
  const down = el('line', { y2: O.y, class: 'lp-guide' }, g), across = el('line', { x1: O.x, class: 'lp-guide' }, g);
  const onX = el('circle', { cy: O.y, r: 5, class: 'lp-mark' }, g), onY = el('circle', { cx: O.x, r: 5, class: 'lp-mark' }, g);
  return m => {
    const x = r(m.x), y = r(m.y);
    attr(down, { x1: x, x2: x, y1: y }); attr(across, { x2: x, y1: y, y2: y });
    onX.setAttribute('cx', x); onY.setAttribute('cy', y);
  };
}

// ---------- the ventricle ----------
// A muscular bag hanging from the valves: the left atrium feeds it through the mitral valve, and it
// empties through the aortic valve into the aorta. The blood pool is sized so that its drawn area is
// in proportion to the model's volume.
const HV = { cx: 75, top: 52, half: 57, depth: 84, mitral: [-51, -11], aortic: [13, 47] };
const bagDims = s => ({ tH: HV.half * (0.5 + 0.5 * s), W: HV.half * s, D: HV.depth * (0.35 + 0.65 * s) });
function bagPath(s, close) {
  const { tH, W, D } = bagDims(s), c = HV.cx, y = HV.top;
  return `M${r(c - tH)} ${y}C${r(c - W * 1.25)} ${r(y + D * 0.45)} ${r(c - W * 0.55)} ${r(y + D)} ${c} ${r(y + D)}` +
    `C${r(c + W * 0.55)} ${r(y + D)} ${r(c + W * 1.25)} ${r(y + D * 0.45)} ${r(c + tH)} ${y}${close ? 'Z' : ''}`;
}
function bagArea(s) {
  const { tH, W, D } = bagDims(s), px = [-tH, -W * 1.25, -W * 0.55, 0], py = [0, D * 0.45, D, D];
  let area = 0, x0 = px[0], y0 = 0;
  for (let i = 1; i <= 32; i++) {
    const t = i / 32, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const x = w[0] * px[0] + w[1] * px[1] + w[2] * px[2], y = w[1] * py[1] + w[2] * py[2] + w[3] * py[3];
    area -= (y - y0) * (x + x0); // twice the strip between the wall and the centre line: both halves
    x0 = x; y0 = y;
  }
  return area;
}
const BAG = [];
for (let s = 0.2; s < 1.61; s += 0.02) BAG.push([s, bagArea(s)]);
const AREA_PER_ML = bagArea(1) / beats.base.EDV;
function sizeFor(V) {
  const a = V * AREA_PER_ML;
  let i = 1;
  while (i < BAG.length - 1 && BAG[i][1] < a) i++;
  return BAG[i - 1][0] + (BAG[i][0] - BAG[i - 1][0]) * ramp((a - BAG[i - 1][1]) / (BAG[i][1] - BAG[i - 1][1]));
}
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const BLOOD = ['#f8e4e1', '#c0372d'].map(rgb), MUSCLE = ['#d2a19b', '#6b1a14'].map(rgb);
const mix = ([a, b], t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

// ref: volumes to keep on show as dashed outlines. mark: what a "what shapes the loop" step points
// at on the drawing. The ventricle, each valve and the aorta are parts a caption term can light.
function heart(parent, { ref = [], mark } = {}) {
  const g = el('g', { class: mark ? `hv hv-${mark}` : 'hv' }, parent), c = HV.cx, y = HV.top;
  el('path', { d: 'M12 52V26Q12 10 28 10H66Q82 10 82 26V52Z', class: 'hv-chamber' }, g);       // left atrium
  const aorta = el('g', { 'data-part': 'aorta' }, g);
  el('path', { d: 'M84 52V30Q84 8 106 8H150V30H132Q122 30 122 40V52Z', class: 'hv-aorta' }, aorta); // open towards the body
  el('path', { d: 'M84 52V30Q84 8 106 8H150M122 52V40Q122 30 132 30H150', class: 'hv-line' }, aorta);
  const bag = el('g', { 'data-part': 'ventricle' }, g);
  const wall = el('path', { class: 'hv-wall' }, bag), blood = el('path', { class: 'hv-blood' }, bag);
  for (const V of ref) el('path', { d: bagPath(sizeFor(V), true), class: 'hv-ref' }, g);
  const base = [0, 1, 2].map(() => el('line', { y1: y, y2: y, class: 'hv-wall hv-base' }, bag));
  const mitral = el('path', { class: 'hv-leaf', 'data-part': 'mitral' }, g), aortic = el('path', { class: 'hv-leaf', 'data-part': 'aortic' }, g);
  const flowIn = el('g', { class: 'hv-flow' }, g), inLine = el('path', { class: 'hv-dash' }, flowIn), inHead = el('path', {}, flowIn);
  const flowOut = el('g', { class: 'hv-flow' }, g), outLine = el('path', { class: 'hv-dash' }, flowOut);
  el('path', { d: 'M149 19l-9 -5.5v11z' }, flowOut);
  const squeeze = el('g', { class: 'hv-squeeze' }, g), push = [0, 1].map(() => el('path', {}, squeeze));
  if (mark === 'afterload') arrow(g, 114, 12, 114, 42, 'lp-arrow lp-arrow-blue');
  return {
    set(m, clock = 0) {
      const s = sizeFor(m.V), { tH, W, D } = bagDims(s), k = tH / HV.half;
      const th = 5.5 + 7 * (1 - Math.min(1, s)) + 1.5 * m.squeeze, muscle = mix(MUSCLE, m.squeeze);
      attr(wall, { d: bagPath(s), 'stroke-width': r(2 * th), stroke: muscle });
      attr(blood, { d: bagPath(s, true), fill: mix(BLOOD, ramp(m.P / pMax)) });
      // the valve plane: muscle between the two openings
      const [m0, m1, a0, a1] = [...HV.mitral, ...HV.aortic].map(v => c + v * k), mm = (m0 + m1) / 2, am = (a0 + a1) / 2;
      [[c - tH - th * 0.7, m0], [m1, a0], [a1, c + tH + th * 0.7]].forEach(([x1, x2], i) => attr(base[i], { x1: r(x1), x2: r(x2), stroke: muscle }));
      // leaflets swing between shut (meeting in the middle) and open (mitral hangs into the
      // ventricle, aortic lies back along the aorta)
      const to = (a, b, t) => r(a + (b - a) * t), mo = m.mitral, ao = m.aortic;
      mitral.setAttribute('d', `M${r(m0)} ${y}L${to(mm, m0 + 5, mo)} ${to(y + 6, y + 18, mo)}M${r(m1)} ${y}L${to(mm, m1 - 5, mo)} ${to(y + 6, y + 18, mo)}`);
      aortic.setAttribute('d', `M${r(a0)} ${y}L${to(am, a0 + 3, ao)} ${to(y + 6, y - 15, ao)}M${r(a1)} ${y}L${to(am, a1 - 3, ao)} ${to(y + 6, y - 15, ao)}`);
      // blood on the move: in through the mitral valve, out along the aorta
      const off = r(-clock * 0.035), iy = y + D * 0.55;
      flowIn.setAttribute('opacity', r(m.inflow));
      attr(inLine, { d: `M${r(mm)} 26V${r(iy)}`, 'stroke-dashoffset': off });
      inHead.setAttribute('d', `M${r(mm)} ${r(iy + 9)}l-5.5 -9h11z`);
      flowOut.setAttribute('opacity', r(m.outflow));
      attr(outLine, { d: `M${r(am)} ${r(y + D * 0.35)}V${y - 10}Q${r(am)} 19 ${r(am + 14)} 19H140`, 'stroke-dashoffset': off });
      // the muscle pushing in on both sides
      const lx = (tH + 5.4 * W) / 8 + th + 3, ly = r(y + 0.669 * D);
      squeeze.setAttribute('opacity', r(m.squeeze));
      push[0].setAttribute('d', `M${r(c - lx)} ${ly}l-8 -5v3.4h-6v3.2h6v3.4z`);
      push[1].setAttribute('d', `M${r(c + lx)} ${ly}l8 -5v3.4h6v3.2h-6v3.4z`);
    },
  };
}

// A graph step's picture: the ventricle and a few words about it in the top band, the graph below.
function stage(svg, opts) {
  const h = heart(el('g', { transform: 'translate(28 4)' }, svg), opts);
  const st = el('g', { transform: 'translate(240 30)' }, svg);
  const g = el('g', { transform: `translate(0 ${TOP})` }, svg);
  axes(g);
  return { g, st, h };
}
// Beside the ventricle: the phase it is in and what each valve is doing.
const PHASE = { fill: 'Filling', contract: 'Squeeze', eject: 'Ejection', relax: 'Relax' };
function readout(st) {
  const word = label(st, 0, 0, '', 'lp-phase lp-red');
  const pills = ['mitral', 'aortic'].map((name, i) => {
    const y = 14 + i * 36, box = el('rect', { x: 0, y, width: 224, height: 30, rx: 15, class: 'lp-pill', 'data-part': name }, st);
    return { name, box, text: label(st, 112, y + 21, '', 'lp-pill-t', 'middle'), open: null };
  });
  label(st, 0, 112, 'darker red: more pressure', 'lp-small');
  let edge;
  return m => {
    if (m.edge !== edge) { edge = m.edge; word.textContent = PHASE[edge]; }
    for (const p of pills) {
      const open = m[p.name] > 0.5;
      if (open === p.open) continue;
      p.open = open;
      p.box.classList.toggle('open', open); p.text.classList.toggle('open', open);
      p.text.textContent = `${p.name} valve: ${open ? 'open' : 'shut'}`;
    }
  };
}
// Beside the ventricle on the "two things to watch" step: the two measures as plain bars.
function meters(st) {
  const bars = ['volume', 'pressure'].map((name, i) => {
    const y = 4 + i * 50;
    label(st, 0, y, name, 'lp-strong');
    el('rect', { x: 0, y: y + 10, width: 210, height: 14, class: 'lp-meter-track' }, st);
    return el('rect', { x: 0, y: y + 10, width: 0, height: 14, class: 'lp-meter' }, st);
  });
  return m => { bars[0].setAttribute('width', r(210 * ramp(m.V / vMax))); bars[1].setAttribute('width', r(210 * ramp(m.P / pMax))); };
}
// Beside the ventricle on a condition step: which heart this is, what it pumps per beat, and the key.
const PER_BEAT = { up: 'more per beat', down: 'less per beat', none: 'about the same per beat' };
function outcome(st, title, b0, b1, dirs, also) {
  const name = label(st, 0, 0, 'normal', 'lp-phase');
  label(st, 0, 26, 'blood pumped per beat', 'lp-small');
  const w = v => r(v / svMax * 210);
  el('rect', { x: 1, y: 36, width: w(b0.SV), height: 10, class: 'lp-bar-normal' }, st);
  const now = el('rect', { x: 0, y: 52, width: w(b0.SV), height: 12, class: 'lp-bar-now' }, st);
  const said = el('g', { opacity: 0 }, st);
  label(said, 0, 88, PER_BEAT[dirs.sv], 'lp-strong');
  if (also) label(said, 0, 110, also, 'lp-strong');
  // the key: the dashed normal loop and this condition's loop
  const key = el('g', { transform: 'translate(0 130)' }, st);
  el('path', { d: 'M0 -6 H28', class: 'lp-ghost' }, key);
  label(key, 36, 0, 'normal', 'lp-small');
  el('path', { d: 'M104 -6 H132', class: 'lp-loop' }, key);
  label(key, 140, 0, 'now', 'lp-small');
  let changed;
  return k => {
    if (k > 0.5 !== changed) { changed = k > 0.5; name.textContent = changed ? title : 'normal'; name.classList.toggle('lp-red', changed); }
    now.setAttribute('width', w(b0.SV + (b1.SV - b0.SV) * k));
    said.setAttribute('opacity', r(k));
  };
}
// On a condition step's graph: each edge that moves, named beside an arrow from where it was to
// where it is now. A note is drawn only if the model moves that edge the way its words say.
function notes(g, A, B, spec, dirs) {
  const made = [];
  const add = (x0, y0, x1, y1, word, lx, ly, anchor) => {
    const grp = el('g', { class: 'lp-note', opacity: 0 }, g), line = el('line', { x1: r(x0), y1: r(y0) }, grp), head = el('path', {}, grp);
    label(grp, r(lx), r(ly), word, 'lp-strong lp-blue lp-note-t', anchor);
    const a = Math.atan2(y1 - y0, x1 - x0), wing = (x, y, d) => `${r(x - 10 * Math.cos(a + d))} ${r(y - 10 * Math.sin(a + d))}`;
    made.push(k => {
      const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      grp.setAttribute('opacity', r(ramp(k * 3)));
      attr(line, { x2: r(x), y2: r(y) });
      head.setAttribute('d', `M${r(x)} ${r(y)}L${wing(x, y, -0.45)}L${wing(x, y, 0.45)}Z`);
    });
  };
  const want = m => spec[m] && dirs[m] === spec[m][0];
  // a sideways move of the right edge (how full) or the left edge (how empty): the words sit inside
  // the loop, or over the arrow where a line would run through them
  const sideways = (m, a, b, yTop, yBot, frac, inward) => {
    const x0 = a[0], x1 = b[0], sg = Math.sign(x1 - x0), y = yTop + (yBot - yTop) * frac, [, word, where] = spec[m];
    if (where === 'over') add(x0 + 3 * sg, y, x1 - 3 * sg, y, word, (x0 + x1) / 2, y - 12, 'middle');
    else add(x0 + 3 * sg, y, x1 - 3 * sg, y, word, inward < 0 ? Math.min(x0, x1) - 9 : Math.max(x0, x1) + 9, y + 6, inward < 0 ? 'end' : 'start');
  };
  if (want('edv')) sideways('edv', corner(A, 'contract', 0), corner(B, 'contract', 0), Math.max(corner(A, 'contract', 1)[1], corner(B, 'contract', 1)[1]), Math.min(corner(A, 'contract', 0)[1], corner(B, 'contract', 0)[1]), 0.6, -1);
  if (want('esv')) sideways('esv', corner(A, 'relax', 0), corner(B, 'relax', 0), Math.max(corner(A, 'relax', 0)[1], corner(B, 'relax', 0)[1]), Math.min(corner(A, 'relax', 1)[1], corner(B, 'relax', 1)[1]), 0.36, 1);
  // the top edge moving up or down: the words sit above both loops
  if (want('lvsp')) {
    const lo = Math.max(corner(A, 'relax', 0)[0], corner(B, 'relax', 0)[0]), hi = Math.min(corner(A, 'contract', 0)[0], corner(B, 'contract', 0)[0]);
    const x = lo + (hi - lo) * 0.45, word = spec.lvsp[1], half = word.length * 5.2;
    const topAt = s => { const e = s.eject, i = Math.max(1, e.findIndex(p => p[0] <= x)), [p, q] = [e[i - 1], e[i]]; return p[1] + (q[1] - p[1]) * ramp((p[0] - x) / (p[0] - q[0] || 1)); };
    const y0 = topAt(A), y1 = topAt(B), sg = spec.lvsp[0] === 'up' ? -1 : 1; // up the screen is a smaller y
    const clear = Math.min(y0, y1, ...[A, B].flatMap(s => s.eject.filter(p => Math.abs(p[0] - x) < half).map(p => p[1])));
    if ((y1 - y0) * sg > 12) add(x, y0 + 3 * sg, x, y1 - 3 * sg, word, x, clear - 12, 'middle');
  }
  return k => { for (const f of made) f(k); };
}

// ---------- the pictures ----------
// Each builder fills its SVG and returns { render(t) }; the scene list below says how long each
// timeline lasts, where a picture rests when nothing may move, and where a loop restarts.

// A step whose picture is the normal heart beating round the normal loop, plus the step's own marks.
function laps(svg, marks, opts) {
  const { g, st, h } = stage(svg, opts), s = shapes.base, say = readout(st);
  const also = marks(g, s);
  const dot = dotOn(g);
  return {
    render(t) {
      const m = moment(s, ...lapAt(t));
      place(dot, m); h.set(m, t * LAP_MS); say(m);
      if (also) also(m);
    },
  };
}
const TAG = {
  fill: s => [(corner(s, 'fill', 0)[0] + corner(s, 'fill', 1)[0]) / 2, corner(s, 'fill', 1)[1] - 16, 'filling', 'middle'],
  contract: s => [corner(s, 'contract', 0)[0] + 12, (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2, 'squeeze', 'start'],
  eject: s => [(corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2, Math.min(...s.eject.map(p => p[1])) - 14, 'ejection', 'middle'],
  relax: s => [corner(s, 'relax', 0)[0] - 12, (corner(s, 'relax', 0)[1] + corner(s, 'relax', 1)[1]) / 2, 'relax', 'end'],
};

const BUILD = {
  // The left side of the heart with its parts named, beating.
  heart(svg) {
    const k = 1.45, ox = 18, oy = 52, tx = 300;
    const h = heart(el('g', { transform: `translate(${ox} ${oy}) scale(${k})` }, svg));
    const at = (x, y) => [r(ox + x * k), r(oy + y * k)];
    const name = (x, y, title, what, anchor = 'start') => { label(svg, x, y, title, 'lp-strong', anchor); label(svg, x, y + 22, what, 'lp-small', anchor); };
    name(at(12, 10)[0], at(12, 10)[1] - 34, 'Left atrium', 'holds blood from the lungs');
    name(at(150, 19)[0] + 10, at(150, 19)[1] - 4, 'Aorta', 'main pipe to the body');
    [['Aortic valve', 'outlet door', 105, 52], ['Mitral valve', 'inlet door', 44, 52], ['Left ventricle', 'the main pump', 75, 105]].forEach(([title, what, px, py], i) => {
      const y = at(0, 52)[1] + 34 + i * 62, [x2, y2] = at(px, py);
      el('line', { x1: tx - 6, y1: y - 6, x2, y2, class: 'hd-lead' }, svg);
      el('circle', { cx: x2, cy: y2, r: 4, class: 'hd-dot' }, svg);
      name(tx, y, title, what);
    });
    return { render(t) { h.set(moment(shapes.base, ...lapAt(t)), t * LAP_MS); } };
  },

  // Right means fuller, up means squeezing harder: the dot goes right while the ventricle fills, then
  // up while it squeezes, then back.
  axes(svg) {
    const { g, st, h } = stage(svg), b = beats.base, show = meters(st);
    const A = [X(b.ESV * 0.9), Y(pMax * 0.04)], C = [X(b.EDV * 1.02), Y(pMax * 0.7)];
    for (const [[x, y], s, anchor, dx] of [[A, 'nearly empty, relaxed', 'start', 12], [C, 'full, squeezing hard', 'end', -14]]) {
      el('circle', { cx: r(x), cy: r(y), r: 10, class: 'lp-spot lp-spot-ink' }, g);
      label(g, r(x + dx), r(y - 18), s, 'lp-strong', anchor);
    }
    label(g, O.x + 8, O.y + 24, 'empty', 'lp-small');
    const project = guides(g), dot = dotOn(g);
    const part = (t, a, z) => ease(ramp((t - a) / (z - a)));
    return {
      render(t) {
        const fill = part(t, 0.04, 0.36), press = part(t, 0.44, 0.72), back = part(t, 0.86, 1);
        const x = A[0] + (C[0] - A[0]) * fill * (1 - back), y = A[1] + (C[1] - A[1]) * press * (1 - back);
        const going = fill > 0 && fill < 1, leaving = back > 0 && back < 1;
        const m = { x, y, V: VOL(x), P: PRS(y), mitral: fill < 1 && !leaving ? 1 : 0, aortic: leaving ? 1 : 0, squeeze: press * (1 - back), inflow: going ? 1 : 0, outflow: leaving ? 1 : 0 };
        place(dot, m); project(m); h.set(m, t * 7200); show(m);
      },
    };
  },

  // The four phases: earlier edges stay drawn in grey, the new edge draws itself in red.
  phase(svg, which) {
    const { g, st, h } = stage(svg), s = shapes.base, pts = s[which], say = readout(st), DRAW = 0.72;
    for (const k of LOOP_ORDER.slice(0, LOOP_ORDER.indexOf(which))) el('path', { d: pathD(s[k]), class: 'lp-done' }, g);
    const project = guides(g), live = el('path', { class: 'lp-loop lp-now' }, g), dot = dotOn(g);
    const [tx, ty, word, anchor] = TAG[which](s);
    label(g, tx, ty, word, 'lp-strong lp-red', anchor);
    return {
      render(t) {
        // draw the edge, then hold the finished edge for a moment before going again
        const p = ease(ramp(t / DRAW)), m = moment(s, which, p);
        live.setAttribute('d', pathD([...pts.slice(0, Math.floor(p * (pts.length - 1)) + 1), [m.x, m.y]]));
        place(dot, m); project(m); h.set(m, t * 4800); say(m);
      },
    };
  },

  loop(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      // an arrowhead on each edge, so the way round is plain even when paused
      for (const [edge, dir] of [['fill', 'right'], ['contract', 'up'], ['eject', 'left'], ['relax', 'down']]) {
        const [x, y] = s[edge][Math.round((s[edge].length - 1) * 0.56)];
        arrowHead(g, r(x), r(y), dir, 'lp-way');
      }
      const tags = Object.fromEntries(LOOP_ORDER.map((edge, i) => {
        const [x, y, word, anchor] = TAG[edge](s);
        return [edge, label(g, x, y, `${i + 1} ${word}`, 'lp-strong', anchor)];
      }));
      let on;
      return m => { if (m.edge === on) return; on = m.edge; for (const [edge, t] of Object.entries(tags)) t.classList.toggle('lp-red', edge === on); };
    });
  },

  sv(svg) {
    return laps(svg, (g, s) => {
      const b = beats.base, xl = X(b.ESV), xr = X(b.EDV), y = Y(pMax * 0.36);
      loopLine(g, s);
      for (const x of [xl, xr]) el('line', { x1: x, y1: O.top + 10, x2: x, y2: O.y, class: 'lp-guide' }, g);
      const sv = el('g', { 'data-part': 'sv' }, g);
      arrow(sv, (xl + xr) / 2, y, xl + 2, y, 'lp-arrow lp-arrow-red');
      arrow(sv, (xl + xr) / 2, y, xr - 2, y, 'lp-arrow lp-arrow-red');
      label(sv, (xl + xr) / 2, y - 12, 'stroke volume', 'lp-strong lp-red', 'middle');
      label(g, xl, O.y + 24, 'after pumping', 'lp-small', 'middle');
      label(g, xr, O.y + 24, 'full', 'lp-small', 'middle');
    });
  },

  ef(svg) {
    return laps(svg, (g, s) => {
      const b = beats.base, x0 = X(0), xl = X(b.ESV), xr = X(b.EDV), y = O.top + 2, h = 30;
      loopLine(g, s, 'lp-loop lp-soft');
      const ef = el('g', { 'data-part': 'ef' }, g);
      el('rect', { x: x0, y, width: xl - x0, height: h, class: 'ef-left' }, ef);
      el('rect', { x: xl, y, width: xr - xl, height: h, class: 'ef-out' }, ef);
      el('rect', { x: x0, y, width: xr - x0, height: h, class: 'ef-frame' }, ef);
      label(ef, (x0 + xl) / 2, y + 21, 'left behind', 'lp-small lp-strong', 'middle');
      label(ef, (xl + xr) / 2, y + 21, 'pumped out', 'lp-strong lp-on-red', 'middle');
      label(g, x0 + 4, y + h + 20, 'empty', 'lp-small');
      label(g, xr - 5, y + h + 20, 'full', 'lp-small', 'end');
      for (const x of [xl, xr]) el('line', { x1: x, y1: y + h, x2: x, y2: O.y, class: 'lp-guide' }, g);
    });
  },

  // Preload, afterload, contractility: one step each, the loop with the part it governs picked out in
  // blue, one arrow showing which way more of it moves that part, and the same thing marked in blue on
  // the ventricle.
  preload(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      el('path', { d: pathD(s.contract), class: 'lp-edge' }, g);
      const xr = corner(s, 'contract', 0)[0], yMid = (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2;
      arrow(g, xr + 10, yMid, xr + 48, yMid, 'lp-arrow lp-arrow-blue');
      label(g, xr + 10, yMid - 16, 'preload', 'lp-strong lp-blue');
      label(g, xr + 10, yMid + 30, 'more filling', 'lp-small');
    }, { ref: [beats.base.EDV], mark: 'preload' });
  },
  afterload(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      el('path', { d: pathD(s.eject), class: 'lp-edge' }, g);
      const top = Math.min(...s.eject.map(p => p[1])), xm = (corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2;
      arrow(g, xm, top - 44, xm, top - 10, 'lp-arrow lp-arrow-blue');
      label(g, xm + 12, top - 30, 'afterload', 'lp-strong lp-blue');
      label(g, xm + 12, top - 10, 'push-back', 'lp-small');
    }, { mark: 'afterload' });
  },
  contractility(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      const c = corner(s, 'relax', 0);
      el('circle', { cx: c[0], cy: c[1], r: 10, class: 'lp-spot' }, g);
      arrow(g, c[0] - 10, c[1] - 10, c[0] - 38, c[1] - 38, 'lp-arrow lp-arrow-blue');
      label(g, c[0] + 18, c[1] + 30, 'contractility', 'lp-strong lp-blue');
      label(g, c[0] + 18, c[1] + 52, 'stronger squeeze', 'lp-small');
    }, { mark: 'contractility' });
  },

  // The normal loop is held, changes into the condition's loop with its moved edges named, and then
  // the heart keeps beating on the new loop. The normal loop stays as a dashed ghost, and the normal
  // heart's full and emptied sizes stay as dashed outlines on the ventricle.
  cond(svg, key) {
    const c = CONDITIONS[key], b0 = beats.base, b1 = beats[key], dirs = directions(b0, b1), A = shapes.base, B = shapes[key];
    const { g, st, h } = stage(svg, { ref: [b0.EDV, b0.ESV] });
    const from = loopPts(A), to = loopPts(B), final = pathD(to, true);
    el('path', { d: pathD(from, true), class: 'lp-ghost', 'data-ghost': '' }, g);
    const live = el('path', { d: pathD(from, true), class: 'lp-loop', 'data-loop': '', 'data-final': final, 'data-part': 'loop' }, g);
    const name = notes(g, A, B, c.notes, dirs), dot = dotOn(g);
    const result = outcome(st, c.legend, b0, b1, dirs, c.notes.hr && dirs.hr === c.notes.hr[0] ? c.notes.hr[1] : '');
    const { total, t1, t2 } = condTiming(key);
    return {
      render(t) {
        const k = t >= t2 ? 1 : ease(ramp((t - t1) / (t2 - t1)));
        const s = k === 1 ? B : k === 0 ? A : Object.fromEntries(LOOP_ORDER.map(e => [e, lerpPts(A[e], B[e], k)]));
        live.setAttribute('d', k === 1 ? final : pathD(loopPts(s), true));
        // while the loop changes the dot waits where the ventricle is fullest, then it laps
        const m = t < t2 ? moment(s, 'contract', 0) : moment(B, ...lapAt((t - t2) / (1 - t2), 'contract'));
        place(dot, m); h.set(m, t * total); name(k); result(k);
      },
    };
  },
};
// A condition's timeline: hold normal, change, then one lap of the new heart (a slower heart takes a
// longer lap), looping on that last part.
function condTiming(key) {
  const HOLD = 900, CHANGE = 2400, lap = LAP_MS * beats[key].T / beats.base.T, total = HOLD + CHANGE + lap;
  return { total, t1: HOLD / total, t2: (HOLD + CHANGE) / total };
}

const LABEL = {
  "heart": "Diagram of the left side of the heart. Blood from the lungs collects in the left atrium, a small holding chamber at the top. It passes down through the mitral valve into the left ventricle, the large muscular chamber below. It leaves upward through the aortic valve into the aorta, the main pipe out to the body. The drawing beats: the ventricle fills, squeezes and empties, over and over.",
  "axes": "A drawing of the ventricle above an empty graph. Volume increases to the right; pressure increases upward. A dot starts low and to the left, at a place marked: nearly empty, relaxed. It slides to the right while the drawn ventricle fills, then climbs while the ventricle squeezes, to a place marked: full, squeezing hard. Two bars beside the drawing show the volume and the pressure.",
  "fill": "Graph of pressure against volume. A line is drawn from left to right along the bottom: volume grows a lot while pressure stays low. Mitral valve open, aortic valve shut. Above the graph, a drawing of the ventricle swells as blood flows in through the open mitral valve.",
  "contract": "Graph of pressure against volume. After the bottom edge, a line rises straight up at the right: pressure climbs while volume stays the same. Both valves shut. Above the graph, the drawn ventricle stays the same size and turns a darker red as its wall squeezes.",
  "eject": "Graph of pressure against volume. From the top of the right edge, a line runs left across the top: volume falls while pressure stays high. Mitral valve shut, aortic valve open. Above the graph, the drawn ventricle shrinks as blood leaves through the open aortic valve.",
  "relax": "Graph of pressure against volume. From the left end of the top edge, a line drops straight down: pressure falls while volume stays the same, back to the start of the bottom edge. Both valves shut. Above the graph, the drawn ventricle stays small and turns paler as its wall relaxes.",
  "loop": "The whole loop, a rounded box shape. A dot travels round it anticlockwise: filling along the bottom, squeezing up the right edge, ejection across the top, relaxing down the left edge. Above the graph, a drawing of the ventricle fills, squeezes, empties and relaxes in step with the dot.",
  "sv": "The whole loop with a double-headed arrow across its width, labelled stroke volume. The right edge is marked full, the left edge is marked after pumping. A dot goes round the loop, and a drawing of the ventricle above the graph beats in step with it.",
  "ef": "The loop with a bar above it that runs from empty to full. The part of the bar under the loop's width is marked pumped out; the rest, from empty to the loop's left edge, is marked left behind. The pumped-out part is a little more than half of the bar. A dot goes round the loop, and a drawing of the ventricle above the graph beats in step with it.",
  "preload": "The loop with its right edge highlighted and an arrow pointing right from it, labelled preload: more filling moves this edge to the right. A dot goes round the loop. On a drawing of the ventricle above the graph, a blue dashed outline marks how full it gets before it squeezes.",
  "afterload": "The loop with its top edge highlighted and an arrow pressing down on it from above, labelled afterload: the push-back the ventricle must overcome to pump blood out. A dot goes round the loop. On a drawing of the ventricle above the graph, a blue arrow presses back down the aorta onto the aortic valve.",
  "contractility": "The loop with its top left corner highlighted and an arrow pulling it up and to the left, labelled contractility: a stronger squeeze empties the ventricle further. A dot goes round the loop. On a drawing of the ventricle above the graph, blue arrows push in on its wall.",
  "fluids": "The normal loop, kept as a faint dashed outline, grows into a new loop that reaches further right and higher up and is wider: the ventricle fills more and pumps more blood per beat. Arrows name what moved: fills more, higher pressure. Above the graph, the drawn ventricle swells past a dashed outline of its normal size, and a bar shows more blood pumped per beat than normal.",
  "constrict": "The normal loop, kept as a faint dashed outline, changes into a taller, narrower loop: its left edge moves right, so more blood is left behind and less is pumped per beat, at a higher pressure. Arrows name what moved: higher pressure, empties less. Above the graph, the drawn ventricle stays larger than its normal emptied size after each beat, and a bar shows less blood pumped per beat than normal.",
  "inotrope": "The normal loop, kept as a faint dashed outline, changes into a wider loop: the right edge stays put while the left edge moves further left, so the ventricle empties further and pumps more per beat. An arrow names what moved: empties further. Above the graph, the drawn ventricle shrinks to smaller than its normal emptied size, and a bar shows more blood pumped per beat than normal.",
  "venodil": "The normal loop, kept as a faint dashed outline, shrinks into a smaller loop: the right edge moves left and the top drops, so the ventricle fills less and pumps less per beat. Arrows name what moved: fills less, lower pressure. Above the graph, the drawn ventricle no longer fills to its normal size, and a bar shows less blood pumped per beat than normal.",
  "beta": "The normal loop, kept as a faint dashed outline, changes into a shorter loop of about the same width: the heart pumps at a lower pressure and about the same amount per beat. An arrow names what moved: lower pressure. Above the graph, the drawn ventricle beats more slowly, and a bar shows about the same blood pumped per beat as normal.",
  "hfref": "The normal loop, kept as a faint dashed outline, changes into a loop that sits further right and is lower: the ventricle is larger, much more blood is left behind, and a smaller share is pumped out. Arrows name what moved: empties less, bigger. Above the graph, the drawn ventricle is larger than normal both full and emptied, and a bar shows less blood pumped per beat than normal."
};

// ---------- the scenes the kit plays, one per step kind ----------
function picture(kind, build, timing) {
  return {
    loop: true, ...timing,
    mount(host) {
      const svg = el('svg', { viewBox: `0 0 ${W} ${kind === 'heart' ? 350 : H}`, class: 'lp', role: 'img', 'aria-label': LABEL[kind] }, host);
      return build(svg);
    },
  };
}
const scenes = {
  heart: picture('heart', BUILD.heart, { duration: LAP_MS, rest: 0.16 }),
  axes: picture('axes', BUILD.axes, { duration: 7200, rest: 0.74 }),
  loop: picture('loop', BUILD.loop, { duration: LAP_MS, rest: 0 }),
  sv: picture('sv', BUILD.sv, { duration: LAP_MS, rest: 0.5 }),
  ef: picture('ef', BUILD.ef, { duration: LAP_MS, rest: 0.5 }),
  preload: picture('preload', BUILD.preload, { duration: LAP_MS, rest: 0.32 }),
  afterload: picture('afterload', BUILD.afterload, { duration: LAP_MS, rest: 0.66 }),
  contractility: picture('contractility', BUILD.contractility, { duration: LAP_MS, rest: 0.82 }),
};
for (const which of LOOP_ORDER) scenes[which] = picture(which, svg => BUILD.phase(svg, which), { duration: 4800, rest: 0.72 });
for (const key of Object.keys(CONDITIONS)) {
  const { total, t2 } = condTiming(key);
  scenes[key] = picture(key, svg => BUILD.cond(svg, key), { duration: total, loopFrom: t2, rest: t2 });
}

// A machine-readable record of which way the model moves each value, for checking against the
// directions in clinical-values.json.
for (const step of document.querySelectorAll('[data-step][data-kind]')) {
  const c = CONDITIONS[step.dataset.kind];
  if (!c) continue;
  step.dataset.modelShifts = JSON.stringify(directions(beats.base, beats[step.dataset.kind]));
  if (c.state) step.dataset.state = c.state;
  step.dataset.modelSet = JSON.stringify(c.set);
}

lesson({ scenes, onTab: { clinical: () => onTab('clinical'), explore: () => onTab('explore') } });
