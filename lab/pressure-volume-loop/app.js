// Lesson 1: the pressure-volume loop. The kit (/lab/kit/kit.js) runs the page; this file draws the
// guided lesson's pictures. Explore freely and Clinical values live in explore.js.
//
// Every loop comes from the same model as Explore freely (model.js), run to a steady beat, and is
// drawn with worded axes and no numbers: the shapes carry the idea. The heart is the shared left
// heart of the art library (lab/kit/art/heart.js): a long-axis cutaway with the apex down and to the
// viewer's right, its cavity's drawn area in proportion to the model's volume.
//
// Expected behaviour:
//   - Step 1 is the left heart large, beating, with its five parts named in two label columns. Every
//     other picture is the heart (top left), a readout (top right) and the graph (below), moved by one
//     clock. The heart is worked out from where the dot is on the graph (further right: more blood in
//     it; on the right and top edges: squeezing), so the two can never disagree. Blood is always
//     oxygenated red: pressure is shown by the graph, not by colour.
//   - The readout's phase word follows the valves (beat.js phaseOf), so it never says Filling while
//     the mitral pill says shut.
//   - A picture is a function of its place t on a timeline from 0 to 1; the kit's player only moves t.
//     Every picture keeps beating. A condition step holds the normal loop, changes it into the new one
//     with the moved edges named, then keeps beating on the new loop (it loops from that point).
//   - Words on the graph are placed once per picture, clear of every loop, the ghost and the dot's
//     path at every t (beat.js pickSpot), never per frame.
//   - svg[data-anim] reads "done" once a picture has been shown once; from then on a condition
//     step's [data-loop] path equals its data-final (hooks the lab pipeline's smoke test reads).
//   - Each condition step records which way the model moved each value (data-model-shifts), for
//     checking against the directions in clinical-values.json.
import { lesson } from '/lab/kit/kit.js';
import { Simulator, DEFAULTS } from './model.js';
import { onTab } from './explore.js';
import { shape, loopPoints, LOOP_ORDER, lapAt, moment as momentAt, phaseOf, heartState, spotClear, ramp } from './beat.js';
import { P, artContext, textWidth, leaderPoints } from '/lab/kit/art/core.js';
import { mountLeftHeart } from '/lab/kit/art/heart.js';
import { axes as axesMarks, curveAttrs } from '/lab/kit/art/chart.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 480, H = 418;                            // the whole picture
const TOP = 168;                                   // the heart's band; the graph starts below it
const O = { x: 42, y: 212, top: 34, right: 462 };  // plot area inside the graph: origin bottom-left
const RX = 232;                                    // the readout column's left edge
const RXC = 176;                                   // on a condition step, which needs a wider key
const LAP_MS = 5600;                               // one slow heartbeat
const INK = P.ui.ink, RED = P.ui.red, BLUE = P.ui.blue, MUTED = P.ui.muted, PANEL = P.ui.panel, WHITE = P.ui.white;

// "What changes the loop": model settings changed from baseline. Where clinical-values.json has the
// matching state, these are that state's own model settings, so the lesson, the Clinical values tab
// and Explore freely all show the same ventricle.
// notes: the edges to name on the picture, as [the way the model must move it, the words].
const CONDITIONS = {
  fluids: { set: { Pla: 8 }, legend: 'with more fluid', notes: { edv: ['up', 'fills more'], lvsp: ['up', 'higher pressure'] } }, // as Explore freely's "↑ Preload" scenario
  constrict: { set: { Rs: 2 }, state: 'vasocon', legend: 'with tighter arteries', notes: { lvsp: ['up', 'higher pressure'], esv: ['up', 'empties less'] } },
  inotrope: { set: { Ees: 5 }, state: 'inotrope', legend: 'with an inotrope', notes: { esv: ['down', 'empties further'] } },
  venodil: { set: { Pla: 2 }, state: 'venodil', legend: 'with a venodilator', notes: { edv: ['down', 'fills less'], lvsp: ['down', 'lower pressure'] } },
  beta: { set: { HR: 56, Ees: 2.8 }, state: 'beta', legend: 'with a beta-blocker', notes: { lvsp: ['down', 'lower pressure'], hr: ['down', 'and it beats slower'] } },
  hfref: { set: { Ees: 1.3, Pla: 9, HR: 85 }, state: 'hfref', legend: 'heart failure', notes: { esv: ['up', 'empties less'], edv: ['up', 'bigger'] } },
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

const shapes = Object.fromEntries(Object.entries(beats).map(([k, b]) => [k, shape(b, { X, Y })]));
const loopPts = loopPoints;
const moment = (s, edge, p) => momentAt(s, edge, p, { VOL, PRS });
const r = n => +n.toFixed(1);
const pathD = (pts, close) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');
const lerpPts = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const corner = (s, edge, end) => s[edge][end ? s[edge].length - 1 : 0];
const closed = pts => [...pts, pts[0]];

// ---------- SVG helpers ----------
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
function attr(e, attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }
// Text in the kit's classes only: sm b (names), xs muted (descriptors), lg (titles), plus colours.
function label(parent, x, y, s, cls = 'sm b', anchor = 'start') {
  return el('text', { x: r(x), y: r(y), class: cls, 'text-anchor': anchor }, parent, s);
}
const SIZE = cls => / lg /.test(` ${cls} `) ? 24 : / sm /.test(` ${cls} `) ? 18 : / xs /.test(` ${cls} `) ? 17 : 20;
// The box a word will take, top-left, from its baseline and anchor (measured widths, kit metrics).
function wordBox(x, y, s, cls, anchor = 'start') {
  const w = textWidth(s, cls), size = SIZE(cls), x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x: x0, y: y - size * 0.76, w, h: size * 0.98 };
}
// A filled arrowhead of one size at (x, y) pointing along angle a.
const headD = (x, y, a, size = 10) => `M${r(x)} ${r(y)}L${r(x - size * Math.cos(a - 0.45))} ${r(y - size * Math.sin(a - 0.45))}L${r(x - size * Math.cos(a + 0.45))} ${r(y - size * Math.sin(a + 0.45))}Z`;
function arrow(parent, x1, y1, x2, y2, col = INK, w = 3) {
  const g = el('g', {}, parent), a = Math.atan2(y2 - y1, x2 - x1);
  el('line', { x1: r(x1), y1: r(y1), x2: r(x2 - 6 * Math.cos(a)), y2: r(y2 - 6 * Math.sin(a)), stroke: col, 'stroke-width': w, 'stroke-linecap': 'round' }, g);
  el('path', { d: headD(x2, y2, a), fill: col }, g);
  return g;
}
// Graph marks in the art direction's styles (chart.js): a live line is 4 red over a panel underlay; a
// closed live loop also gets a 7 % fill; the ghost is 3 dashed grey.
function liveMark(g, d, { fill = false, width = 4, part, extra = {} } = {}) {
  const grp = el('g', part ? { 'data-part': part } : {}, g);
  const body = fill ? el('path', { d, fill: RED, 'fill-opacity': 0.07, stroke: 'none' }, grp) : null;
  const under = el('path', { d, fill: 'none', stroke: PANEL, 'stroke-width': width + 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, grp);
  const line = el('path', { d, ...curveAttrs('live'), 'stroke-width': width, ...extra }, grp);
  return { grp, line, set(dd) { if (body) body.setAttribute('d', dd); under.setAttribute('d', dd); line.setAttribute('d', dd); } };
}
const ghostAttrs = () => curveAttrs('ghost');
function axes(g) {
  artContext(g.ownerSVGElement).html(g, axesMarks({ x0: O.x, y0: O.y, x1: 470, y1: O.top - 16, xLabel: 'volume →', yLabel: 'pressure ↑' }));
}
const loopLine = (g, s, opts = {}) => liveMark(g, pathD(loopPts(s), true), { fill: true, part: 'loop', ...opts });
const dotOn = g => el('circle', { r: 8, fill: RED, stroke: WHITE, 'stroke-width': 3 }, g);
const place = (dot, m) => attr(dot, { cx: r(m.x), cy: r(m.y) });
// Dashed lines from the dot to each axis, so it is plain which of the two measures is changing.
function guides(g) {
  const st = { stroke: MUTED, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' };
  const down = el('line', { y2: O.y, ...st }, g), across = el('line', { x1: O.x, ...st }, g);
  const onX = el('circle', { cy: O.y, r: 5, fill: RED }, g), onY = el('circle', { cx: O.x, r: 5, fill: RED }, g);
  return m => {
    const x = r(m.x), y = r(m.y);
    attr(down, { x1: x, x2: x, y1: y }); attr(across, { x2: x, y1: y, y2: y });
    onX.setAttribute('cx', x); onY.setAttribute('cy', y);
  };
}
// The valve events at the loop's corners: a ring where a valve opens, a filled dot where one shuts.
// Bottom left the mitral valve opens, bottom right it shuts; top right the aortic valve opens, top
// left it shuts.
const EVENTS = [['fill', 0, true], ['contract', 0, false], ['eject', 0, true], ['relax', 0, false]];
// A mark the moving dot is passing over is hidden until the dot has gone by, so it never shows as a
// crescent beside the dot.
function valveEvents(g) {
  const marks = EVENTS.map(([, , opens]) => el('circle', opens
    ? { r: 5, fill: PANEL, stroke: INK, 'stroke-width': 2.5 }
    : { r: 5, fill: INK, stroke: PANEL, 'stroke-width': 1.5 }, g));
  const at = [], hidden = [];
  const ev = s => EVENTS.forEach(([edge, end], i) => { const p = corner(s, edge, end); at[i] = p; attr(marks[i], { cx: r(p[0]), cy: r(p[1]) }); });
  ev.near = m => at.forEach(([x, y], i) => { const h = Math.hypot(m.x - x, m.y - y) < 16; if (h !== hidden[i]) { hidden[i] = h; marks[i].setAttribute('opacity', h ? 0 : 1); } });
  g.lpEvents = ev;
  return ev;
}

// ---------- the heart ----------
// The library's left heart, mounted once per picture. ref: volumes kept on show as outlines (on a
// change step the normal full and emptied sizes, one at a time: full while the heart fills and
// squeezes, emptied while it ejects, relaxes and refills to halfway). mark: what a "what shapes the loop" step points at on the
// drawing. The ventricle, each valve, the atrium and the aorta are parts a caption term can light. The
// small band heart darkens more as it squeezes, so the readout's "darker wall: squeezing" can be seen.
function heart(parent, { ref = [], mark, x = 22, y = 4, s = 0.72, key = 'band' } = {}) {
  const svg = parent.ownerSVGElement || parent, ctx = artContext(svg);
  const h = mountLeftHeart(el('g', {}, parent), ctx, { x, y, s, edv: beats.base.EDV, refs: ref, mark, key, squeezeK: s < 1 ? 0.46 : undefined });
  (svg.lpHearts || (svg.lpHearts = [])).push(h);
  const o = { lapMs: LAP_MS, pMax, refMid: (beats.base.EDV + beats.base.ESV) / 2 };
  return { ...h, set: (m, clock = 0) => h.set(heartState(m, clock, o)), state: (m, clock = 0) => heartState(m, clock, o) };
}

// A graph step's picture: the heart and a few words about it in the top band, the graph below.
function stage(svg, opts, rx = RX) {
  const h = heart(svg, opts);
  const st = el('g', { transform: `translate(${rx} 0)` }, svg);
  const g = el('g', { transform: `translate(0 ${TOP})` }, svg);
  axes(g);
  return { g, st, h };
}
// Beside the heart: the phase the valves show and what each valve is doing.
const PHASE = { fill: 'Filling', contract: 'Squeeze', eject: 'Ejection', relax: 'Relax' };
// The key's off state: dimmed, but still 2.2:1 against the panel (muted ink at 0.5), so it stays legible.
const KEY_OFF = 0.5;
function readout(st) {
  const word = label(st, 0, 32, '', 'lg red');
  const pills = ['mitral', 'aortic'].map((name, i) => {
    const y = 48 + i * 38, box = el('rect', { x: 0, y, width: 228, height: 30, rx: 15, class: 'lp-pill', 'data-part': name }, st);
    return { name, box, text: label(st, 114, y + 21, '', 'xs b lp-pill-t', 'middle'), open: null };
  });
  // the key dims while the wall is not squeezing, so it never names a darkening the picture is not
  // showing; it is lit whenever the phase word says Squeeze or Ejection (the squeeze starts as the
  // mitral valve shuts, beat.js), so the word and the key never disagree
  const key = label(st, 0, 146, 'darker wall: squeezing', 'xs muted');
  let ph, keyOn;
  return m => {
    const now = phaseOf(m);
    if (now !== ph) { ph = now; word.textContent = PHASE[ph]; }
    const on = now === 'contract' || now === 'eject' || (m.squeeze || 0) > 0.02;
    if (on !== keyOn) { keyOn = on; key.setAttribute('opacity', on ? 1 : KEY_OFF); }
    for (const p of pills) {
      const open = m[p.name] > 0.5;
      if (open === p.open) continue;
      p.open = open;
      p.box.classList.toggle('open', open); p.text.classList.toggle('open', open);
      p.text.textContent = `${p.name} valve: ${open ? 'open' : 'shut'}`;
    }
  };
}
// Beside the heart on the "two things to watch" step: the two measures as bars that point the way
// their axes do: volume grows to the right, pressure grows upward.
function meters(st) {
  const track = { fill: WHITE, stroke: P.ui.rule, 'stroke-width': 1 };
  label(st, 0, 112, 'volume →', 'sm b');
  el('rect', { x: 0, y: 124, width: 176, height: 16, ...track }, st);
  const vol = el('rect', { x: 0, y: 124, width: 0, height: 16, fill: RED }, st);
  label(st, 186, 26, 'pressure ↑', 'sm b', 'end');
  el('rect', { x: 200, y: 8, width: 16, height: 132, ...track }, st);
  const prs = el('rect', { x: 200, y: 140, width: 16, height: 0, fill: RED }, st);
  return m => {
    vol.setAttribute('width', r(176 * ramp(m.V / vMax)));
    const h = r(132 * ramp(m.P / pMax));
    attr(prs, { y: r(140 - h), height: h });
  };
}
// Beside the heart on a condition step: which heart this is, what it pumps per beat, and the key: the
// graph's normal loop and this condition's loop, then the heart's one normal outline.
const PER_BEAT = { up: 'more per beat', down: 'less per beat', none: 'about the same per beat' };
function outcome(st, title, b0, b1, dirs, also) {
  const name = label(st, 0, 26, 'normal', 'lg');
  label(st, 0, 50, 'blood pumped per beat', 'xs muted');
  const w = v => r(v / svMax * 210);
  el('rect', { x: 1, y: 58, width: w(b0.SV), height: 8, fill: 'none', stroke: P.ui.ghost, 'stroke-width': 2, 'stroke-dasharray': '5 3' }, st);
  const now = el('rect', { x: 0, y: 70, width: w(b0.SV), height: 12, fill: RED }, st);
  const said = el('g', { opacity: 0 }, st);
  label(said, 0, 106, PER_BEAT[dirs.sv], 'sm b');
  if (also) label(said, 0, 128, also, 'sm b');
  // the key: the dashed normal loop and this condition's loop, then the heart's normal outlines
  const key = el('g', {}, st);
  el('path', { d: 'M0 146H24', ...ghostAttrs() }, key);
  label(key, 32, 152, 'normal', 'xs muted');
  el('path', { d: 'M96 146H120', ...curveAttrs('live') }, key);
  label(key, 128, 152, 'now', 'xs muted');
  // the heart's outline: the normal heart at the same moment (full while it fills, emptied while it pumps)
  // drawn as the heart draws it: a curved dashed edge with a pale halo, on the red of the cavity, so it
  // differs from the graph's straight grey dash by shape as well as by dash
  const arc = 'M1 177 Q12 157 23 177';
  el('path', { d: `${arc}Z`, fill: P.oxy.base }, key);
  el('path', { d: arc, fill: 'none', stroke: PANEL, 'stroke-opacity': 0.85, 'stroke-width': 4.2, 'stroke-linejoin': 'round' }, key);
  el('path', { d: arc, fill: 'none', stroke: MUTED, 'stroke-width': 2.2, 'stroke-dasharray': '3.6 2.9' }, key);
  label(key, 32, 174, 'normal heart size', 'xs muted');
  let changed;
  return k => {
    if (k > 0.5 !== changed) { changed = k > 0.5; name.textContent = changed ? title : 'normal'; name.classList.toggle('red', changed); }
    now.setAttribute('width', w(b0.SV + (b1.SV - b0.SV) * k));
    said.setAttribute('opacity', r(k));
  };
}

// ---------- words on the graph, kept clear ----------
// Everything a word must stay clear of while it shows: lines (the loops and arrows) by 4 units, and
// the dot's path by its radius and 4 more. Words stay inside the plot, clear of the axis labels.
const PLOT = [O.x + 8, O.top - 8, 472, O.y - 4];
const AXIS_WORDS = [[O.x + 10, 4, 100, 26], [380, O.y + 10, 92, 22]];
function clearOf(lines, path, boxes = []) {
  return b => spotClear(b, { lines, boxes: [...AXIS_WORDS, ...boxes], margin: 4, bounds: PLOT })
    && spotClear(b, { lines: path, margin: 12 });
}
const asBox = b => [b.x, b.y, b.w, b.h];

// On a condition step's graph: each edge that moves, named beside an arrow from where it was to
// where it is now. A note is drawn only if the model moves that edge the way its words say. Every
// arrow is placed first, then each word takes the first spot near its arrow that is clear of both
// loops, the loop in between, the dot's path, every arrow and every word already placed.
function notes(g, A, B, spec, dirs) {
  const want = m => spec[m] && dirs[m] === spec[m][0];
  const arrows = [];
  // a sideways move of the right edge (how full) or the left edge (how empty)
  const sideways = (m, a, b, yTop, yBot, inward) => {
    const x0 = a[0], x1 = b[0], sg = Math.sign(x1 - x0);
    for (const frac of [0.6, 0.4, 0.75, 0.25]) {
      const y = yTop + (yBot - yTop) * frac;
      arrows.push({ m, frac, x0: x0 + 3 * sg, y0: y, x1: x1 - 3 * sg, y1: y, inward, word: spec[m][1] });
    }
  };
  if (want('edv')) sideways('edv', corner(A, 'contract', 0), corner(B, 'contract', 0), Math.max(corner(A, 'contract', 1)[1], corner(B, 'contract', 1)[1]), Math.min(corner(A, 'contract', 0)[1], corner(B, 'contract', 0)[1]), -1);
  if (want('esv')) sideways('esv', corner(A, 'relax', 0), corner(B, 'relax', 0), Math.max(corner(A, 'relax', 0)[1], corner(B, 'relax', 0)[1]), Math.min(corner(A, 'relax', 1)[1], corner(B, 'relax', 1)[1]), 1);
  // the top edge moving up or down: an arrow between the two top edges
  if (want('lvsp')) {
    const lo = Math.max(corner(A, 'relax', 0)[0], corner(B, 'relax', 0)[0]), hi = Math.min(corner(A, 'contract', 0)[0], corner(B, 'contract', 0)[0]);
    const topAt = (s, x) => { const e = s.eject, i = Math.max(1, e.findIndex(p => p[0] <= x)), [p, q] = [e[i - 1], e[i]]; return p[1] + (q[1] - p[1]) * ramp((p[0] - x) / (p[0] - q[0] || 1)); };
    for (const frac of [0.45, 0.6, 0.3]) {
      const x = lo + (hi - lo) * frac, y0 = topAt(A, x), y1 = topAt(B, x), sg = Math.sign(y1 - y0);
      if (Math.abs(y1 - y0) > 12) arrows.push({ m: 'lvsp', frac, x0: x, y0: y0 + 3 * sg, x1: x, y1: y1 - 3 * sg, word: spec.lvsp[1], up: true });
    }
  }
  // A short move still gets an arrow long enough to read (its head is 10 long): the tail starts further
  // back on the old side, so the head still lands on the new edge.
  const MIN_ARROW = 28;
  for (const a of arrows) {
    const L = Math.hypot(a.x1 - a.x0, a.y1 - a.y0);
    if (L > 0 && L < MIN_ARROW) { const k = MIN_ARROW / L; a.x0 = a.x1 - (a.x1 - a.x0) * k; a.y0 = a.y1 - (a.y1 - a.y0) * k; }
  }
  // The loop in between sweeps across the space between the two loops while it changes: a word in
  // that space shows only once the moving loop has passed it for good (its k), so no edge ever runs
  // through a word. The dot waits at the full corner while the loop changes, then laps the new loop.
  const KS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const mids = KS.map(k => closed(lerpPts(loopPts(A), loopPts(B), k)));
  const passK = b => { for (let i = KS.length - 1; i >= 0; i--) if (!spotClear(b, { lines: [mids[i]], margin: 4 })) return i + 1 < KS.length ? KS[i + 1] : 1; return 0; };
  const lines = [closed(loopPts(A))], path = [closed(loopPts(B)), [corner(A, 'contract', 0), corner(B, 'contract', 0)]];
  const placed = [], chosen = [], drawn = [];
  const cls = 'sm b blue';
  const seg = a => [[a.x0, a.y0], [a.x1, a.y1]];
  // Spots for a word near its arrow: the usual places, then a ring of places around the arrow.
  const usual = a => {
    const mid = (a.x0 + a.x1) / 2;
    return a.up
      ? [[a.x0, Math.min(a.y0, a.y1) - 12, 'middle'], [a.x0 + 12, (a.y0 + a.y1) / 2 + 6, 'start'], [a.x0 - 12, (a.y0 + a.y1) / 2 + 6, 'end']]
      : [[a.inward < 0 ? Math.min(a.x0, a.x1) - 9 : Math.max(a.x0, a.x1) + 9, a.y0 + 6, a.inward < 0 ? 'end' : 'start'], [mid, a.y0 - 12, 'middle'], [mid, a.y0 + 26, 'middle']];
  };
  const ring = a => {
    const mx = (a.x0 + a.x1) / 2, my = (a.y0 + a.y1) / 2, lo = Math.min(a.x0, a.x1), hi = Math.max(a.x0, a.x1), out = [];
    for (let dy = -64; dy <= 64; dy += 4) {
      out.push([mx, my + dy, 'middle'], [hi + 9, my + dy, 'start'], [lo - 9, my + dy, 'end'], [hi + 17, my + dy, 'start'], [lo - 17, my + dy, 'end']);
      for (const dx of [-30, 30, -60, 60]) out.push([mx + dx, my + dy, 'middle']);
    }
    return out;
  };
  // how far a word box is from its arrow
  const gap = (b, a) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = a.x1 - a.x0, dy = a.y1 - a.y0, L = dx * dx + dy * dy || 1;
    const t = ramp(((cx - a.x0) * dx + (cy - a.y0) * dy) / L);
    return Math.max(0, Math.abs(cx - a.x0 - dx * t) - b.w / 2) + Math.max(0, Math.abs(cy - a.y0 - dy * t) - b.h / 2);
  };
  for (const name of ['edv', 'esv', 'lvsp']) {
    const options = arrows.filter(a => a.m === name);
    if (!options.length) continue;
    // an arrow may not cross a word already placed
    const fair = options.filter(a => placed.every(([x, y, w, h]) => spotClear({ x, y, w, h }, { lines: [seg(a)], margin: 4 })));
    let pick = null, best = Infinity;
    for (const a of fair) {
      const ok = clearOf([...lines, ...drawn, seg(a)], path, placed);
      for (const [spots, extra] of [[usual, 0], [ring, 6]]) for (const [x, y, anchor] of spots(a)) {
        const b = wordBox(x, y, a.word, cls, anchor);
        if (!ok(b)) continue;
        const k = passK(b);
        if (k > 0.6) continue;
        const score = gap(b, a) + extra + 20 * k;
        if (score < best) { best = score; pick = { a, x, y, anchor, b, k }; }
      }
    }
    if (!pick) { const a = options[0]; pick = { a, x: (a.x0 + a.x1) / 2, y: Math.min(a.y0, a.y1) - 12, anchor: 'middle', k: 0 }; pick.b = wordBox(pick.x, pick.y, a.word, cls, 'middle'); console.warn(`pressure-volume-loop: no clear spot for "${a.word}"`); }
    placed.push(asBox(pick.b));
    drawn.push(seg(pick.a));
    chosen.push(pick);
  }
  const made = chosen.map(({ a, x, y, anchor, k: shows }) => {
    const grp = el('g', { class: 'lp-note', 'data-delta': '', opacity: 0 }, g);
    const line = el('line', { x1: r(a.x0), y1: r(a.y0), stroke: BLUE, 'stroke-width': 3, 'stroke-linecap': 'round' }, grp), head = el('path', { fill: BLUE }, grp);
    const word = label(grp, x, y, a.word, cls, anchor);
    const ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
    return k => {
      const hx = a.x0 + (a.x1 - a.x0) * k, hy = a.y0 + (a.y1 - a.y0) * k;
      grp.setAttribute('opacity', r(ramp(k * 6))); // full strength early, so a short arrow reads from the start of the change
      word.setAttribute('opacity', r(ramp((k - shows) / 0.12)));
      attr(line, { x2: r(hx - 6 * Math.cos(ang)), y2: r(hy - 6 * Math.sin(ang)) });
      head.setAttribute('d', headD(hx, hy, ang));
    };
  });
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
      if (g.lpEvents) g.lpEvents.near(m);
      if (also) also(m);
    },
  };
}
// Each phase's name on its own edge. The relax tag sits inside the loop, clear of the guide that runs
// left from the dot to the pressure axis.
const TAG = {
  fill: s => [(corner(s, 'fill', 0)[0] + corner(s, 'fill', 1)[0]) / 2, corner(s, 'fill', 1)[1] - 16, 'filling', 'middle'],
  contract: s => [corner(s, 'contract', 0)[0] + 14, (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2 + 6, 'squeeze', 'start'],
  eject: s => [(corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2, Math.min(...s.eject.map(p => p[1])) - 14, 'ejection', 'middle'],
  relax: s => [corner(s, 'relax', 0)[0] + 14, (corner(s, 'relax', 0)[1] + corner(s, 'relax', 1)[1]) / 2 + 6, 'relax', 'start'],
};
// The way round: an arrowhead part-way along each edge.
function wayMarks(g, s) {
  for (const edge of LOOP_ORDER) {
    const e = s[edge], i = Math.round((e.length - 1) * 0.56), [x, y] = e[i], [px, py] = e[i - 2];
    el('path', { d: headD(x, y, Math.atan2(y - py, x - px), 12), fill: RED, stroke: WHITE, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, g);
  }
}

// Step 1's names: two columns, each name with its plain-words descriptor under it, a leader from the
// name to a dot on the part. Leaders run level, then turn 45 degrees; a part that moves (a valve, the
// ventricle) keeps its dot on it as it moves. No leader crosses the ventricle's wall or its cavity: the
// left atrium is named from above the pulmonary veins (top), and the mitral valve's leader runs level
// and turns through the gap between the lower vein and the ventricle (via, in the art's own frame), then
// reaches the posterior leaflet's hinge from above the annulus, across the atrial floor.
const S1 = { s: 1.42, x: 126, y: 0.9, h: 350 };
const s1pt = ([x, y]) => [S1.x + (x - 58) * S1.s, S1.y + (y - 17) * S1.s];
const S1_LABELS = [
  // [name, descriptor lines, side, the art's target name or a fixed point in the art's own frame, options]
  ['Aorta', ['main pipe', 'to the body'], 'left', [71, 64]],
  ['Aortic valve', ['outlet door'], 'left', 'aortic-valve'],
  ['Left atrium', ['holds blood', 'from the lungs'], 'right', [160, 90], { top: 40 }],
  ['Mitral valve', ['inlet door'], 'right', 'mitral-hinge', { via: [173.5, 118.5] }],
  ['Left ventricle', ['the main pump'], 'right', 'apex'],
];
function nameParts(svg, h) {
  const colL = S1.x - 14, colR = s1pt([214, 0])[0];
  const veinBottom = s1pt([0, 120])[1];
  const target = (t, at) => (typeof t === 'string' ? at[t] : s1pt(t));
  const rest = h.atFor(h.state(moment(shapes.base, ...lapAt(0.16))));
  const blocks = S1_LABELS.map(([name, sub, side, t, o = {}]) => ({ name, sub, side, t, at: target(t, rest), ...o, via: o.via && s1pt(o.via) }));
  for (const b of blocks) if (b.top) b.y = b.top;
  for (const side of ['left', 'right']) {
    let y = side === 'right' ? veinBottom + 14 : 8 + 14;
    for (const b of blocks.filter(q => q.side === side && !q.top).sort((p, q) => p.at[1] - q.at[1])) {
      b.y = Math.max(y, b.at[1] + 6);
      y = b.y + 21 * b.sub.length + 4 + 10 + 14;
    }
  }
  const layer = el('g', {}, svg);
  const live = blocks.map(b => {
    const x = b.side === 'left' ? colL : colR, anchor = b.side === 'left' ? 'end' : 'start';
    label(layer, x, b.y, b.name, 'sm b', anchor);
    b.sub.forEach((line, i) => label(layer, x, b.y + 21 * (i + 1), line, 'xs muted', anchor));
    const from = [b.side === 'left' ? x + 6 : x - 6, b.y - 6];
    const line = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.25, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layer);
    const dot = el('circle', { r: 2.5, fill: INK }, layer);
    const route = to => b.via ? [...leaderPoints(from, b.via, { angle: 45 }), to] : leaderPoints(from, to, { angle: 45 });
    const draw = to => { line.setAttribute('d', `M${route(to).map(p => `${r(p[0])} ${r(p[1])}`).join(' L')}`); attr(dot, { cx: r(to[0]), cy: r(to[1]) }); };
    draw(b.at);
    return { b, draw };
  });
  return at => { for (const { b, draw } of live) if (typeof b.t === 'string') draw(at[b.t]); };
}

const BUILD = {
  // The left side of the heart with its parts named, beating.
  heart(svg) {
    const h = heart(svg, { x: S1.x, y: S1.y, s: S1.s, key: 'large' });
    const follow = nameParts(svg, h);
    return {
      render(t) {
        const m = moment(shapes.base, ...lapAt(t)), st = h.state(m, t * LAP_MS);
        h.set(m, t * LAP_MS); follow(h.atFor(st));
      },
    };
  },

  // Right means fuller, up means squeezing harder: the dot goes right while the ventricle fills, then
  // up while it squeezes, then back.
  axes(svg) {
    const { g, st, h } = stage(svg), b = beats.base, show = meters(st);
    const A = [X(b.ESV * 0.9), Y(pMax * 0.04)], C = [X(b.EDV * 1.02), Y(pMax * 0.7)];
    // each target's words sit right beside its ring, clear of the dot's path (right along the
    // bottom, then up the right side): relaxed to the right and above, full to the left and above
    for (const [[x, y], lines, tx, ty, anchor] of [[A, ['nearly empty,', 'relaxed'], A[0] + 14, A[1] - 40, 'start'], [C, ['full, squeezing hard'], C[0] - 16, C[1] - 16, 'end']]) {
      el('circle', { cx: r(x), cy: r(y), r: 10, fill: 'none', stroke: MUTED, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, g);
      lines.forEach((s, i) => label(g, tx, ty + 21 * i, s, 'sm b', anchor));
    }
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
    for (const k of LOOP_ORDER.slice(0, LOOP_ORDER.indexOf(which))) el('path', { d: pathD(s[k]), fill: 'none', stroke: MUTED, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const project = guides(g), live = liveMark(g, ''), dot = dotOn(g);
    const [tx, ty, word, anchor] = TAG[which](s);
    label(g, tx, ty, word, 'sm b red', anchor);
    return {
      render(t) {
        // draw the edge, then hold the finished edge for a moment before going again
        const p = ease(ramp(t / DRAW)), m = moment(s, which, p);
        live.set(pathD([...pts.slice(0, Math.floor(p * (pts.length - 1)) + 1), [m.x, m.y]]));
        place(dot, m); project(m); h.set(m, t * 4800); say(m);
      },
    };
  },

  loop(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      wayMarks(g, s);
      valveEvents(g)(s);
      const tags = Object.fromEntries(LOOP_ORDER.map((edge, i) => {
        const [x, y, word, anchor] = TAG[edge](s);
        return [edge, label(g, x, y, `${i + 1} ${word}`, 'sm b', anchor)];
      }));
      let on;
      return m => { const now = phaseOf(m); if (now === on) return; on = now; for (const [edge, t] of Object.entries(tags)) t.classList.toggle('red', edge === on); };
    });
  },

  // The loop's width, with guides only below the loop (from its bottom corners to the axis), so no
  // guide runs along an edge.
  sv(svg) {
    return laps(svg, (g, s) => {
      const b = beats.base, xl = X(b.ESV), xr = X(b.EDV), y = Y(pMax * 0.36);
      loopLine(g, s);
      valveEvents(g)(s);
      for (const [x, cy] of [[xl, corner(s, 'fill', 0)[1]], [xr, corner(s, 'contract', 0)[1]]]) el('line', { x1: r(x), y1: r(cy + 7), x2: r(x), y2: O.y, stroke: MUTED, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, g);
      const sv = el('g', { 'data-part': 'sv' }, g);
      arrow(sv, (xl + xr) / 2, y, xl + 3, y, RED);
      arrow(sv, (xl + xr) / 2, y, xr - 3, y, RED);
      label(sv, (xl + xr) / 2, y - 12, 'stroke volume', 'sm b red', 'middle');
      label(g, xl, O.y + 24, 'after pumping', 'xs muted', 'middle');
      label(g, xr, O.y + 24, 'full', 'xs muted', 'middle');
    });
  },

  // The share pumped out: a bar under the volume axis, on the same scale, from empty to full.
  ef(svg) {
    return laps(svg, (g, s) => {
      const b = beats.base, x0 = X(0), xl = X(b.ESV), xr = X(b.EDV), y = O.y + 8, h = 22;
      loopLine(g, s, { width: 3 });
      valveEvents(g)(s);
      for (const [x, cy] of [[xl, corner(s, 'fill', 0)[1]], [xr, corner(s, 'contract', 0)[1]]]) el('line', { x1: r(x), y1: r(cy + 7), x2: r(x), y2: y, stroke: MUTED, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, g);
      const ef = el('g', { 'data-part': 'ef' }, g);
      el('rect', { x: r(x0), y, width: r(xl - x0), height: h, fill: P.ui.rule, 'fill-opacity': 0.45 }, ef);
      el('rect', { x: r(xl), y, width: r(xr - xl), height: h, fill: RED }, ef);
      el('rect', { x: r(x0), y, width: r(xr - x0), height: h, fill: 'none', stroke: INK, 'stroke-width': 1.5 }, ef);
      label(ef, (x0 + xl) / 2, y + 17, 'left behind', 'xs lp-flat', 'middle');
      label(ef, (xl + xr) / 2, y + 17, 'pumped out', 'xs b lp-on-red', 'middle');
    });
  },

  // Preload, afterload, contractility: one step each, the loop with the part it governs picked out in
  // blue, one arrow showing which way more of it moves that part, and the same thing marked in blue on
  // the heart.
  preload(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      el('path', { d: pathD(s.contract), fill: 'none', stroke: BLUE, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      valveEvents(g)(s);
      // the words sit right of the edge and above its bottom corner, where the dot never goes
      const xr = Math.max(...s.contract.map(p => p[0])), top = corner(s, 'contract', 1)[1], bottom = corner(s, 'contract', 0)[1];
      const ya = Math.min((top + bottom) / 2, bottom - 54);
      arrow(g, xr + 14, ya, xr + 64, ya, BLUE);
      label(g, xr + 14, ya - 14, 'preload', 'sm b blue');
      label(g, xr + 14, ya + 26, 'more filling', 'xs muted');
    }, { ref: [beats.base.EDV], mark: 'preload' });
  },
  afterload(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      el('path', { d: pathD(s.eject), fill: 'none', stroke: BLUE, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      valveEvents(g)(s);
      const top = Math.min(...s.eject.map(p => p[1])), xm = (corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2;
      arrow(g, xm, top - 46, xm, top - 12, BLUE);
      label(g, xm + 14, top - 32, 'afterload', 'sm b blue');
      label(g, xm + 14, top - 12, 'push-back', 'xs muted');
    }, { mark: 'afterload' });
  },
  contractility(svg) {
    return laps(svg, (g, s) => {
      loopLine(g, s);
      valveEvents(g)(s);
      const c = corner(s, 'relax', 0);
      el('circle', { cx: r(c[0]), cy: r(c[1]), r: 11, fill: 'none', stroke: BLUE, 'stroke-width': 3.5 }, g);
      arrow(g, c[0] - 12, c[1] - 12, c[0] - 40, c[1] - 40, BLUE);
      // the words sit outside the loop, above its top edge and right of the arrow, clear of the
      // dot's path along that edge and of the pressure axis's name
      label(g, c[0] + 20, c[1] - 42, 'contractility', 'sm b blue');
      label(g, c[0] + 20, c[1] - 21, 'stronger squeeze', 'xs muted');
    }, { mark: 'contractility' });
  },

  // The normal loop is held, changes into the condition's loop with its moved edges named, and then
  // the heart keeps beating on the new loop. The normal loop stays as a dashed ghost, and the normal
  // heart's full and emptied sizes stay as outlines on the ventricle.
  cond(svg, key) {
    const c = CONDITIONS[key], b0 = beats.base, b1 = beats[key], dirs = directions(b0, b1), A = shapes.base, B = shapes[key];
    const { g, st, h } = stage(svg, { ref: [b0.EDV, b0.ESV], key }, RXC);
    const from = loopPts(A), to = loopPts(B), final = pathD(to, true);
    el('path', { d: pathD(from, true), class: 'lp-ghost', 'data-ghost': '', ...ghostAttrs() }, g);
    const live = liveMark(g, pathD(from, true), { fill: true, part: 'loop', extra: { 'data-loop': '', 'data-final': final } });
    const events = valveEvents(g);
    const name = notes(g, A, B, c.notes, dirs), dot = dotOn(g);
    const result = outcome(st, c.legend, b0, b1, dirs, c.notes.hr && dirs.hr === c.notes.hr[0] ? c.notes.hr[1] : '');
    const { total, t1, t2 } = condTiming(key);
    return {
      render(t) {
        const k = t >= t2 ? 1 : ease(ramp((t - t1) / (t2 - t1)));
        const s = k === 1 ? B : k === 0 ? A : Object.fromEntries(LOOP_ORDER.map(e => [e, lerpPts(A[e], B[e], k)]));
        live.set(k === 1 ? final : pathD(loopPts(s), true));
        events(s);
        // while the loop changes the dot waits where the ventricle is fullest, then it laps
        const m = t < t2 ? moment(s, 'contract', 0) : moment(B, ...lapAt((t - t2) / (1 - t2), 'contract'));
        place(dot, m); events.near(m); h.set(m, t * total); name(k); result(k);
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

const VIEW = 'A cutaway of the left side of the heart, seen from the front: the apex points down and to the viewer\'s right.';
const LABEL = {
  "heart": `${VIEW} Blood from the lungs comes in through two pulmonary veins to the left atrium, a thin-walled holding chamber at the top right. It passes down through the mitral valve, whose two leaflets, the front one longer, are tied by cords to two muscles that rise from the ventricle wall toward the valve, each muscle about as long as its cords or longer, into the left ventricle, the thick-walled cone below. It leaves upward through the aortic valve, in front of the atrium, into the aorta, which arches over the top of the atrium. Where the arch turns back, away from the viewer, it is shown cut: an oval of wall around blood, above the atrium and clear of it. A sliver of the right ventricle shows on the left, beyond the interventricular septum, the wall the two ventricles share. Labels name the aorta, main pipe to the body; the aortic valve, outlet door; the left atrium, holds blood from the lungs; the mitral valve, inlet door; and the left ventricle, the main pump. The drawing beats: the ventricle fills, with the valve's cords hanging slack; as it squeezes the valve shuts and the cords pull taut; its wall thickens as it empties, both the septum and the outer wall, while the valve ring moves down toward the apex and the two muscles shorten with it, so the cords never stretch; then it relaxes, over and over. To keep it simple the descending aorta, which runs down behind the heart, and the right pulmonary veins are not drawn, two of the aortic valve's three cusps show, each small muscle's cords are drawn to one leaflet only (in life each muscle ties to both), and the apex is held still.`,
  "axes": `A drawing of the left heart above an empty graph. Volume increases to the right; pressure increases upward. A dot starts low and to the left, at a place marked: nearly empty, relaxed. It slides to the right while the drawn ventricle fills, then climbs while the ventricle's wall squeezes, to a place marked: full, squeezing hard. Beside the drawing, a volume bar grows to the right and a pressure bar grows upward, the same ways as the graph's axes.`,
  "fill": "Graph of pressure against volume. A line is drawn from left to right along the bottom: volume grows a lot while pressure stays low. Mitral valve open, aortic valve shut. Above the graph, a drawing of the left heart: the mitral valve's leaflets swing down into the ventricle and pale streaks show blood flowing in from the lungs, through the atrium and the open valve, while the ventricle swells.",
  "contract": "Graph of pressure against volume. After the bottom edge, a line rises straight up at the right: pressure climbs while volume stays the same. Both valves shut. Above the graph, the drawn ventricle stays the same size while its wall darkens as it squeezes; the mitral leaflets meet just below the valve ring and the aortic valve's cusps meet in the middle.",
  "eject": "Graph of pressure against volume. From the top of the right edge, a line runs left across the top: volume falls while pressure stays high. Mitral valve shut, aortic valve open. Above the graph, the aortic valve's cusps lie back against the vessel wall, pale streaks show blood leaving up through the aorta and round its arch, and the drawn ventricle shrinks as its wall thickens.",
  "relax": "Graph of pressure against volume. From the left end of the top edge, a line drops straight down: pressure falls while volume stays the same, back to the start of the bottom edge. Both valves shut. Above the graph, the drawn ventricle stays small while its wall lightens as it relaxes.",
  "loop": "The whole loop, a rounded box shape. A dot travels round it anticlockwise: filling along the bottom, squeezing up the right edge, ejection across the top, relaxing down the left edge. Small marks at the four corners show the valve events: a ring where a valve opens (mitral bottom left, aortic top right) and a filled dot where one shuts (mitral bottom right, aortic top left). Above the graph, a drawing of the left heart fills, squeezes, empties and relaxes in step with the dot.",
  "sv": "The whole loop with a double-headed arrow across its width, labelled stroke volume. Dashed lines drop from the loop's bottom corners to the volume axis: the right one marked full, the left one marked after pumping. A dot goes round the loop, and a drawing of the left heart above the graph beats in step with it.",
  "ef": "The loop with a bar under the volume axis, on the same scale, that runs from empty to full. The part of the bar under the loop's width, in red, is marked pumped out; the rest, in grey, from empty to the loop's left edge, is marked left behind. The pumped-out part is a little more than half of the bar. A dot goes round the loop, and a drawing of the left heart above the graph beats in step with it.",
  "preload": "The loop with its right edge highlighted and an arrow pointing right from it, labelled preload: more filling moves this edge to the right. A dot goes round the loop. On a drawing of the left heart above the graph, a blue dashed outline marks how full the ventricle gets before it squeezes, and a blue arrow stretches its outer wall.",
  "afterload": "The loop with its top edge highlighted and an arrow pressing down on it from above, labelled afterload: the push-back the ventricle must overcome to pump blood out. A dot goes round the loop. On a drawing of the left heart above the graph, a blue arrow inside the aorta presses back down onto the aortic valve.",
  "contractility": "The loop with its top left corner circled and an arrow pulling it up and to the left, labelled contractility: a stronger squeeze empties the ventricle further. A dot goes round the loop. On a drawing of the left heart above the graph, blue chevrons in the ventricle's wall point inward.",
  "fluids": "The normal loop, kept as a faint dashed outline, grows into a new loop that reaches further right and higher up and is wider: the ventricle fills more and pumps more blood per beat. Arrows name what moved: fills more, higher pressure. Above the graph, the drawn ventricle swells past a dashed outline of the normal heart's full size, and a bar shows more blood pumped per beat than normal.",
  "constrict": "The normal loop, kept as a faint dashed outline, changes into a taller, narrower loop: its left edge moves right, so more blood is left behind and less is pumped per beat, at a higher pressure. Arrows name what moved: higher pressure, empties less. Above the graph, the drawn ventricle stays larger than a dashed outline of the normal heart's emptied size while it pumps, and a bar shows less blood pumped per beat than normal.",
  "inotrope": "The normal loop, kept as a faint dashed outline, changes into a wider loop: the right edge stays put while the left edge moves further left, so the ventricle empties further and pumps more per beat. An arrow names what moved: empties further. Above the graph, the drawn ventricle shrinks to smaller than a dashed outline of the normal heart's emptied size while it pumps, and a bar shows more blood pumped per beat than normal.",
  "venodil": "The normal loop, kept as a faint dashed outline, shrinks into a smaller loop: the right edge moves left and the top drops, so the ventricle fills less and pumps less per beat. Arrows name what moved: fills less, lower pressure. Above the graph, the drawn ventricle no longer fills to a dashed outline of the normal heart's full size, and a bar shows less blood pumped per beat than normal.",
  "beta": "The normal loop, kept as a faint dashed outline, changes into a shorter loop of about the same width: the heart pumps at a lower pressure and about the same amount per beat. An arrow names what moved: lower pressure. Above the graph, the drawn ventricle beats more slowly against a dashed outline of the normal heart, full while it fills and emptied while it pumps, and a bar shows about the same blood pumped per beat as normal.",
  "hfref": "The normal loop, kept as a faint dashed outline, changes into a loop that sits further right and is lower: the ventricle is larger, much more blood is left behind, and a smaller share is pumped out. Arrows name what moved: empties less, bigger. Above the graph, the drawn ventricle is larger than a dashed outline of the normal heart, both when full and when emptied, and a bar shows less blood pumped per beat than normal."
};

// ---------- the scenes the kit plays, one per step kind ----------
function picture(kind, build, timing) {
  return {
    loop: true, ...timing,
    mount(host) {
      const svg = el('svg', { viewBox: `0 0 ${W} ${kind === 'heart' ? S1.h : H}`, class: 'lp', role: 'img', 'aria-label': LABEL[kind] }, host);
      const scene = build(svg);
      // A lit caption term: the kit marks the lit parts (is-lit) and the picture (has-lit); each heart
      // dims its other pieces in place (heart.js light()), so depth is kept and overlaps show no seams.
      const vis = host.closest('.visual') || host;
      if (svg.lpHearts) new MutationObserver(() => {
        const on = vis.classList.contains('has-lit');
        for (const h of svg.lpHearts) h.light(on ? n => n.classList.contains('is-lit') : null);
      }).observe(vis, { attributes: true, attributeFilter: ['class'], subtree: true });
      return scene;
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
