// Lesson 3: Frank–Starling and cardiac output. The kit (/lab/kit/kit.js) runs the page: tabs, steps, the
// picture player, predictions, quiz and summary. This file holds the lesson's teaching model, one picture
// (scene) per step, and the code behind the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, line, circle, rect, path, arrow, arrowTo, part, readout, f, clamp, lerp, ease, span } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Teaching model ----------
   A heart is three dials, each relative to a normal resting heart (1 means normal):
     filling   how much blood returns to fill the ventricle before each beat (preload),
     strength  how hard the muscle squeezes from a given stretch (contractility),
     rate      how many beats a minute (heart rate).
   Blood per beat comes from one Frank–Starling curve, and cardiac output is blood per beat times rate.
   No clinical number lives here: the Clinical values tab scales these ratios by clinical-values.json. */
const NORMAL = { filling: 1, strength: 1, rate: 1 };

// How long each beat has to fill, relative to normal. A slower heart fills a little longer (up to half as
// long again as the rate falls toward zero); a faster heart fills less, and far less at very fast rates.
// This is why a beta-blocker's gentler squeeze barely changes blood per beat: its slower beats fill longer.
// (Added 2026-10-10, so this lesson agrees with the ventricle model of Lesson 1, the pressure-volume loop.)
const fillTime = rate => rate > 1 ? 1 / (1 + 1.8 * Math.pow(rate - 1, 2)) : 1 + .5 * (1 - rate);

// A smooth minimum of two positive numbers: close to the smaller, with no corner where they cross.
const blend = (a, b) => a > 0 && b > 0 ? 1 / Math.pow(Math.pow(a, -8) + Math.pow(b, -8), 1 / 8) : 0;

// A squeeze never empties the chamber: blood per beat stays under 95% of the filled volume. Relative to
// normal blood per beat, that ceiling is 0.95 × (normal filled volume ÷ normal blood per beat). load() sets
// it from the data file; until then, or if the file cannot load, an illustrative stand-in is used.
let CAP = 1.5;

// Blood per beat, relative to normal, at filling x and strength s: a rise that levels off (the Frank–Starling
// curve), scaled by strength and kept under the ceiling. Dividing by blend(1, CAP) keeps normal at exactly 1.
function perBeat(x, s = 1) {
  const rise = (1 - Math.exp(-1.35 * x)) / (1 - Math.exp(-1.35)) * s;
  return Math.min(CAP * x, blend(rise, CAP * x) / blend(1, CAP));
}
// The heart's state from its three dials. filling is what is in the chamber when the beat starts.
function model(p) {
  const filling = p.filling * fillTime(p.rate);
  const sv = perBeat(filling, p.strength);
  return { p, filling, sv, rate: p.rate, co: sv * p.rate };
}
let BASE = model(NORMAL);

// The lesson's changes, each in stages: a stage moves some dials between two moments of the picture's
// timeline (t from 0 to 1). Two-stage changes show two mechanisms one after the other.
const CHANGES = {
  fluids: [{ from: .12, to: .88, set: { filling: 1.4 } }],                 // more blood returns
  diuretics: [{ from: .12, to: .88, set: { filling: .7 } }],               // salt and water removed: less returns
  inotropes: [{ from: .12, to: .88, set: { strength: 1.35 } }],            // a stronger squeeze at the same stretch
  // A gentler squeeze first, then the slower rate (the same slowing as Lesson 1's beta-blocker), which fills longer.
  beta: [{ from: .06, to: .42, set: { strength: .94 } }, { from: .56, to: .92, set: { rate: .78 } }],
  nitrates: [{ from: .12, to: .88, set: { filling: .7 } }],                // veins hold more blood away from the heart
  // A weak squeeze first; then the kidneys hold on to salt and water, so filling rises (compensation).
  failure: [{ from: .06, to: .42, set: { strength: .65 } }, { from: .56, to: .92, set: { filling: 1.3 } }],
};
function stateAt(kind, t) {
  const p = { ...NORMAL };
  for (const s of CHANGES[kind]) {
    const u = ease.inOut(span(t, s.from, s.to));
    for (const k in s.set) p[k] = lerp(p[k], s.set[k], u);
  }
  return p;
}
const finalState = kind => stateAt(kind, 1);

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall; type uses the kit's classes (20, .sm 18, .xs 17). */
const BLOOD = '#c4453a', BLOOD_LIGHT = '#f0b9b1', MUSCLE = '#f3d3cb', MUSCLE_EDGE = '#7c2a22';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;

// One heartbeat for the moving ventricle pictures: how full the chamber is at moment u (0 to 1) of a beat.
// It relaxes and fills, holds with both valves shut, squeezes blood out, then holds again.
const EMPTY = .4;   // how full the chamber still is at the end of a squeeze, relative to a normal fill
function beat(u) {
  if (u < .5) return { v: lerp(EMPTY, 1, ease.inOut(span(u, 0, .5))), phase: 'fill', k: span(u, 0, .5) };
  if (u < .6) return { v: 1, phase: 'shut', k: 0 };
  if (u < .88) return { v: lerp(1, EMPTY, ease.inOut(span(u, .6, .88))), phase: 'squeeze', k: span(u, .6, .88) };
  return { v: EMPTY, phase: 'shut', k: 0 };
}

// The left ventricle, side-on: its base with the inlet and outlet valves at the top, its tip at the bottom.
// v is how full it is (EMPTY at the end of a squeeze, 1 at the end of a normal fill). k scales it.
function ventricleGeometry(cx, by, v, k = 1) {
  const b = 40 * k;                                  // half-width of the base ring (it barely moves)
  const a = (28 + 34 * v) * k;                       // half-width at the widest part
  const h = (66 + 80 * v) * k;                       // depth from the base to the tip
  const w = (11 + 11 * clamp(1 - v, 0, 1)) * k;      // wall: thicker as it squeezes
  return { cx, by, b, a, h, w, k };
}
const bullet = (cx, by, b, a, h) => `M${f(cx - b)} ${f(by)} C${f(cx - a * 1.32)} ${f(by + h * .34)} ${f(cx - a * .62)} ${f(by + h)} ${f(cx)} ${f(by + h)} C${f(cx + a * .62)} ${f(by + h)} ${f(cx + a * 1.32)} ${f(by + h * .34)} ${f(cx + b)} ${f(by)} Z`;
// A tube drawn as an outlined thick line (blood inside).
const tube = (d, width, fill = BLOOD) => `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f(width + 4)}" stroke-linecap="butt" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(width)}" stroke-linecap="butt" stroke-linejoin="round"/>`;
// Valve flaps at the top of the chamber: open (hanging into the flow) or shut (a line across).
function valve(x1, x2, y, open, down = true) {
  if (!open) return line(x1, y, x2, y, C.ink, 4);
  const d = down ? 1 : -1, g = (x2 - x1) * .18;
  return line(x1, y, x1 + g, y + 16 * d, C.ink, 3.5) + line(x2, y, x2 - g, y + 16 * d, C.ink, 3.5);
}
// Little drops of blood moving along a set of points, to show flow; u is the moment (0 to 1).
function drops(pts, u, n = 4, r = 4) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let s = '';
  for (let j = 0; j < n; j++) {
    let d = ((u + j / n) % 1) * total, i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const q = clamp(d / seg[i], 0, 1), x = lerp(pts[i][0], pts[i + 1][0], q), y = lerp(pts[i][1], pts[i + 1][1], q);
    s += circle(x, y, r, '#fbe3df');
  }
  return s;
}
// The whole ventricle with its inlet (from the lungs) and outlet (to the body).
// flowIn / flowOut: 0 to 1 moments of blood moving through each, or null when that valve is shut.
function ventricle(g, { inletOpen = false, outletOpen = false, flowIn = null, flowOut = null, fibre = false, stub = false } = {}) {
  const { cx, by, b, a, h, w, k } = g;
  const tw = 30 * k;                                    // tube width
  const inX = cx - b / 2 - 2 * k, outX = cx + b / 2 + 2 * k;
  const inPts = stub ? [[inX, by - 40 * k], [inX, by]] : [[cx - 120 * k, by - 56 * k], [inX - 22 * k, by - 56 * k], [inX, by - 34 * k], [inX, by]];
  const outPts = stub ? [[outX, by], [outX, by - 40 * k]] : [[outX, by], [outX, by - 34 * k], [outX + 22 * k, by - 56 * k], [cx + 150 * k, by - 56 * k]];
  const dOf = pts => pts.length === 2 ? `M${f(pts[0][0])} ${f(pts[0][1])} L${f(pts[1][0])} ${f(pts[1][1])}`
    : `M${f(pts[0][0])} ${f(pts[0][1])} H${f(pts[1][0])} Q${f(pts[2][0])} ${f(pts[1][1])} ${f(pts[2][0])} ${f(pts[2][1])} V${f(pts[3][1])}`;
  const outD = outPts.length === 2 ? dOf(outPts) : `M${f(outPts[0][0])} ${f(outPts[0][1])} V${f(outPts[1][1])} Q${f(outPts[1][0])} ${f(outPts[2][1])} ${f(outPts[2][0])} ${f(outPts[2][1])} H${f(outPts[3][0])}`;
  let s = tube(dOf(inPts), tw) + tube(outD, tw);
  if (flowIn !== null) s += drops(inPts, flowIn, 4, 4 * k);
  if (flowOut !== null) s += drops(outPts, flowOut, 4, 4 * k);
  s += part('ventricle', `<path d="${bullet(cx, by, b + w, a + w, h + w * 1.15)}" fill="${MUSCLE}" stroke="${MUSCLE_EDGE}" stroke-width="2.5"/>`);
  s += `<path d="${bullet(cx, by, b, a, h)}" fill="${BLOOD}"/>`;
  // close the tube mouths into the chamber, then the valves
  s += rect(inX - tw / 2, by - 3, tw, 6, BLOOD) + rect(outX - tw / 2, by - 3, tw, 6, BLOOD);
  s += valve(inX - tw / 2, inX + tw / 2, by, inletOpen, true) + valve(outX - tw / 2, outX + tw / 2, by, outletOpen, false);
  if (fibre) {
    // one muscle fibre, drawn along the middle of the left wall, from the base to near the tip
    const m = w / 2;
    s += part('preload', `<path d="M${f(cx - b - m)} ${f(by + 6 * k)} C${f(cx - (a + m) * 1.32)} ${f(by + (h + m) * .34)} ${f(cx - (a + m) * .62)} ${f(by + h + m)} ${f(cx - 6 * k)} ${f(by + h + m * 1.1)}" fill="none" stroke="${C.blue}" stroke-width="${f(5 * k)}" stroke-linecap="round"/>`);
  }
  return s;
}

// The Frank–Starling chart: filling across, blood per beat up.
const CH = { x0: 62, x1: 452, y0: 246, top: 44, xMax: 1.8, yMax: 1.75 };
const px = x => f(CH.x0 + (CH.x1 - CH.x0) * clamp(x / CH.xMax, 0, 1.03));
const py = y => f(CH.y0 - (CH.y0 - CH.top) * clamp(y / CH.yMax, 0, 1.06));
function curveD(s, upTo = CH.xMax) {
  let d = '';
  const n = Math.max(2, Math.round(80 * upTo / CH.xMax));
  for (let i = 0; i <= n; i++) { const x = upTo * i / n; d += `${i ? ' L' : 'M'}${px(x)} ${py(perBeat(x, s))}`; }
  return d;
}
const axes = (yWord = 'blood per beat ↑') =>
  path(`M${CH.x0} ${CH.top - 10} V${CH.y0} H${CH.x1 + 10}`, C.ink, 2)
  + text(16, 22, yWord, 'xs b', 'start') + text(CH.x1 + 10, CH.y0 + 30, 'filling →', 'xs b', 'end');
const dot = (x, y, col = C.blue, r = 9) => circle(x, y, r, col, '#fff', 2.5);
const ghostDot = (x, y) => circle(x, y, 8, 'none', C.ink, 2, 'stroke-dasharray="3 3"');
// Data attributes on a drawn state, so tests (and curious readers) can read what the picture shows.
const attrs = o => `data-filling="${(o.filling / BASE.filling).toFixed(4)}" data-sv="${(o.sv / BASE.sv).toFixed(4)}" data-rate="${(o.rate / BASE.rate).toFixed(4)}" data-co="${(o.co / BASE.co).toFixed(4)}"`;

// The per-minute bars under the change pictures: heart rate and cardiac output, each over a dashed normal.
const BAR = { x: 182, len: 150, h: 22 };
function minuteBars(o, y, words = {}) {
  const row = (yy, label, val, w, dpart) => {
    const L = BAR.len * val;
    let s = text(16, yy + 16, label, 'xs b', 'start');
    s += part(dpart, rect(BAR.x, yy, L, BAR.h, C.blueWash, C.blue, 2));
    s += rect(BAR.x, yy, BAR.len, BAR.h, 'none', C.ink, 1.5, 'stroke-dasharray="5 4" class="ghost"');
    if (w) s += text(BAR.x + Math.max(L, BAR.len) + 10, yy + 16, w[0], `xs b ${w[1] || 'blue'}`, 'start');
    return s;
  };
  return row(y, 'heart rate', o.rate, words.rate, 'rate') + row(y + 40, 'cardiac output', o.co, words.co, 'co');
}
// How a measure moved, in words for the picture: an arrow and a short phrase.
const moved = (v, b, up, down, same = 'about the same') => { const r = v / b; return r > 1.015 ? ['↑ ' + up] : r < .985 ? ['↓ ' + down] : ['↔ ' + same, 'muted']; };

/* ---------- The build steps' pictures ---------- */
// Step 1: the left ventricle beating: it relaxes and fills from the lungs, then squeezes blood out to the body.
function heartPicture(t) {
  const B = beat(t), g = ventricleGeometry(196, 118, B.v);
  let s = ventricle(g, { inletOpen: B.phase === 'fill', outletOpen: B.phase === 'squeeze', flowIn: B.phase === 'fill' ? B.k * 1.6 : null, flowOut: B.phase === 'squeeze' ? B.k * 1.6 : null });
  s += text(16, 30, 'in from the lungs', 'sm b', 'start');
  s += text(464, 30, 'out to the body', 'sm b', 'end');
  s += line(262, 214, 300, 214, C.ink, 1.5) + text(306, 220, 'left ventricle', 'sm b', 'start');
  const word = B.phase === 'fill' ? ['relaxes and fills', 'inlet valve open'] : B.phase === 'squeeze' ? ['squeezes blood out', 'outlet valve open'] : ['valves shut', 'between the two'];
  s += text(306, 268, word[0], 'sm b blue', 'start') + text(306, 292, word[1], 'xs muted', 'start');
  return s;
}
// Step 2: two ventricles fill over the same time; the one with more blood returning ends up fuller.
function fillPicture(t) {
  const u = ease.inOut(span(t, .1, .85));
  let s = '';
  const side = (cx, target, thick, top, bottom) => {
    const g = ventricleGeometry(cx, 150, lerp(EMPTY, target, u), .74);
    let p = ventricle(g, { inletOpen: u < 1, flowIn: u < 1 ? t * 3 : null, stub: true });
    // the returning blood: a stream into the inlet, thin or thick, with drops running down it while it fills
    const x = g.cx - g.b / 2 - 2 * g.k;
    let stream = rect(x - thick / 2, 50, thick, 60, BLOOD);
    if (u < 1) for (let j = 0; j < 3; j++) stream += circle(x, 52 + ((t * 2.4 + j / 3) % 1) * 56, Math.min(3.5, thick / 3), '#fbe3df');
    p += part('return', stream);
    p += text(cx, 32, top, 'sm b', 'middle');
    p += text(cx, 318, bottom, 'sm b', 'middle', fade(span(t, .7, .9)));
    return p;
  };
  s += side(124, .74, 6, 'less blood returns', 'fills less');
  s += side(356, 1.14, 20, 'more blood returns', 'starts fuller');
  s += line(240, 20, 240, 330, C.rule, 2);
  return s;
}
// Step 3: filling stretches the wall; one fibre in the wall is drawn large on the right as it lengthens.
function stretchPicture(t) {
  const u = ease.inOut(span(t, .1, .8)), v = lerp(EMPTY, 1.05, u);
  const g = ventricleGeometry(142, 104, v, .9);
  let s = ventricle(g, { inletOpen: u < 1, flowIn: u < 1 ? t * 3 : null, fibre: true, stub: true });
  // the fibre, close up: a striped strand whose stripes (its repeating units) spread apart as it stretches
  const L = lerp(118, 176, u), x0 = 372 - L / 2, y = 170;
  s += text(372, 112, 'one muscle fibre', 'xs b', 'middle');
  let fib = rect(x0, y - 13, L, 26, '#dfe4fb', C.blue, 2.5, 'rx="13"');
  for (let i = 1; i < 6; i++) fib += line(x0 + L * i / 6, y - 12, x0 + L * i / 6, y + 12, C.blue, 2);
  s += part('preload', fib);
  s += rect(372 - 59, y - 13, 118, 26, 'none', C.ink, 1.5, 'rx="13" stroke-dasharray="5 4" class="ghost"');
  s += path(`M${f(g.cx - g.b - g.w / 2 + 4)} ${f(g.by + 40)} L${f(x0 - 8)} ${y}`, C.muted, 1.5, 'stroke-dasharray="3 4"');
  s += text(372, 222, 'stretched by filling', 'xs', 'middle', fade(span(t, .35, .55)));
  s += text(372, 262, 'preload:', 'sm b blue', 'middle', fade(span(t, .75, .92)));
  s += text(372, 286, 'the stretch before', 'xs b', 'middle', fade(span(t, .75, .92)));
  s += text(372, 306, 'the beat begins', 'xs b', 'middle', fade(span(t, .75, .92)));
  return s;
}
// Step 4: a stretch of one fibre, close up. Thin filaments reach in from each end; a thick filament in the
// middle has heads that pull on them. Stretched within the working range, the thin filaments stop crowding
// into each other in the middle, more heads can pull, and the force bar rises.
function sarcomere(L, cx = 196, cy = 160) {
  const z1 = cx - L / 2, z2 = cx + L / 2, thin = 118, thick = 82;
  let s = '';
  for (const yy of [cy - 34, cy, cy + 34]) s += line(z1, yy, z1 + thin, yy, C.muted, 3.5) + line(z2, yy, z2 - thin, yy, C.muted, 3.5);
  s += line(z1, cy - 52, z1, cy + 52, C.ink, 5) + line(z2, cy - 52, z2, cy + 52, C.ink, 5);
  let pulling = 0, heads = 0;
  for (const yy of [cy - 17, cy + 17]) {
    s += line(cx - thick, yy, cx + thick, yy, C.ink, 8);
    for (let x = cx - thick + 6; x <= cx + thick - 6; x += 10) {
      if (Math.abs(x - cx) < 12) continue;             // the bare middle has no heads
      const left = x < cx;
      const own = left ? x >= z1 && x <= z1 + thin : x <= z2 && x >= z2 - thin;
      const crowded = left ? x >= z2 - thin : x <= z1 + thin;   // the other side's filament gets in the way
      const pulls = own && !crowded;
      heads += 2; pulling += pulls ? 2 : 0;
      const dir = left ? -1 : 1;
      for (const up of [-1, 1]) s += line(x, yy + up * 4, x + dir * 6, yy + up * 12, pulls ? C.blue : '#b9bdb2', 3);
    }
  }
  return { body: s, force: pulling / heads };
}
function stretchMorePicture(t) {
  const u = ease.inOut(span(t, .12, .8)), L = lerp(176, 252, u);
  const sc = sarcomere(L), start = sarcomere(176);
  let s = text(16, 30, 'inside one fibre, close up', 'xs b muted', 'start');
  s += sc.body;
  s += path(`M${f(196 - 88)} 94 V226 M${f(196 + 88)} 94 V226`, C.ink, 2, 'stroke-dasharray="5 4" class="ghost"');
  s += arrow(`M${f(196 - L / 2)} 244 H${f(196 + L / 2)}`, C.blue, 3, 'marker-start="url(#ah-b)"');
  s += text(196, 272, u > .5 ? 'stretched more' : 'stretch', 'sm b blue', 'middle');
  s += text(196, 298, 'blue heads can pull', 'xs', 'middle');
  // the force bar
  const top = 240 - 170 * sc.force;
  s += part('force', rect(404, top, 40, 240 - top, C.blue, C.blue, 1));
  s += line(396, 240 - 170 * start.force, 452, 240 - 170 * start.force, C.ink, 2, 'stroke-dasharray="5 4" class="ghost"');
  s += line(394, 240, 454, 240, C.ink, 2);
  s += text(424, 268, 'force', 'sm b', 'middle');
  s += text(424, 292, u > .5 ? '↑ more' : '', 'sm b blue', 'middle');
  return s;
}
// Step 5: one beat. The squeeze sends a stroke volume out into the cup; some blood always stays behind.
function ejectPicture(t) {
  const B = beat(t), g = ventricleGeometry(150, 92, B.v, .9);
  let s = ventricle(g, { inletOpen: B.phase === 'fill', outletOpen: B.phase === 'squeeze', flowIn: B.phase === 'fill' ? B.k * 1.6 : null, flowOut: B.phase === 'squeeze' ? B.k * 1.6 : null });
  // the cup: empties while the heart fills, collects what one squeeze sends out
  const level = t < .12 ? 1 - span(t, 0, .12) : t < .6 ? 0 : t < .88 ? ease.inOut(span(t, .6, .88)) : 1;
  const cx = 384, top = 160, bottom = 266, w = 92;
  s += arrow(`M${f(150 + 150 * .9)} ${f(92 - 50)} Q${cx} 40 ${cx} ${top - 14}`, C.blue, 3, 'stroke-dasharray="6 5"');
  const fillTop = bottom - (bottom - top - 8) * level;
  s += part('sv', rect(cx - w / 2 + 3, fillTop, w - 6, bottom - fillTop, BLOOD));
  s += path(`M${cx - w / 2} ${top} V${bottom} H${cx + w / 2} V${top}`, C.ink, 3);
  s += text(cx, 296, 'stroke volume', 'sm b', 'middle');
  s += text(cx, 318, 'out in one beat', 'xs', 'middle');
  s += text(150, 292, B.v < .5 ? 'some stays behind' : '', 'xs b', 'middle');
  return s;
}
// Step 6: the Frank–Starling curve draws itself; then the normal resting point appears.
function curvePicture(t) {
  const reveal = Math.max(.02, ease.inOut(span(t, .04, .72))) * CH.xMax;
  let s = axes();
  s += part('fscurve', path(curveD(1, reveal), C.blue, 5));
  const x = reveal, y = perBeat(x);
  s += path(`M${px(x)} ${CH.y0} V${py(y)} H${CH.x0}`, C.ink, 1.5, `stroke-dasharray="4 5" ${fade(1 - span(t, .74, .8))}`);
  s += `<g ${fade(1 - span(t, .74, .8))}>${dot(px(x), py(y), C.ink, 7)}</g>`;
  s += text(78, 72, 'steep: a little more filling,', 'xs b', 'start', fade(span(reveal / CH.xMax, .3, .42)));
  s += text(78, 94, 'a lot more per beat', 'xs b', 'start', fade(span(reveal / CH.xMax, .3, .42)));
  s += text(CH.x1, py(1.3) - 18, 'then it levels off', 'xs b', 'end', fade(span(reveal / CH.xMax, .82, .95)));
  const a = span(t, .8, .94);
  s += `<g ${fade(a)}>${path(`M${px(1)} ${CH.y0} V${py(1)} H${CH.x0}`, C.ink, 1.5, 'stroke-dasharray="4 5"')}${dot(px(1), py(1))}${text(px(1) + 16, py(1) + 34, 'a resting heart', 'xs b', 'start')}${text(px(1) + 16, py(1) + 56, 'sits on the rise', 'xs', 'start')}</g>`;
  return s;
}
// Step 7: three hearts at the same filling. The stronger one's whole curve sits higher; the weaker one's lower.
function strengthPicture() {
  let s = axes();
  s += path(`M${px(1)} ${CH.top} V${CH.y0}`, C.muted, 1.5, 'stroke-dasharray="4 5"');
  s += text(px(1) + 8, CH.y0 - 10, 'same filling', 'xs muted', 'start');
  s += part('contractility', path(curveD(1.35), C.blue, 5) + path(curveD(.65), C.red, 5));
  s += path(curveD(1), C.ink, 4);
  s += part('contractility', dot(px(1), py(perBeat(1, 1.35))) + dot(px(1), py(perBeat(1, .65)), C.red));
  s += dot(px(1), py(1), C.ink, 7);
  s += text(CH.x1, py(perBeat(1.8, 1.35)) - 14, 'stronger', 'sm b blue', 'end');
  s += text(CH.x1, py(perBeat(1.8)) - 14, 'normal', 'sm b', 'end');
  s += text(CH.x1, py(perBeat(1.8, .65)) - 14, 'weaker', 'sm b red', 'end');
  s += text(px(1) - 14, py(perBeat(1, 1.35)) - 14, 'more per beat', 'xs b blue', 'end');
  s += text(px(1) + 14, py(perBeat(1, .65)) + 32, 'less per beat', 'xs b red', 'start');
  return s;
}
// Step 8: a slower and a faster heart over the same stretch of time. A line sweeps across; every beat it
// passes counts. The gaps between beats, the time to fill, are shorter in the faster heart.
function rhythmPicture(t) {
  const sweep = lerp(20, 462, t);
  let s = '';
  const row = (y, label, gap, word) => {
    let r = text(16, y - 52, label, 'sm b', 'start');
    let d = `M20 ${y}`;
    const beats = [];
    for (let x = 20 + gap * .5; x < 460; x += gap) beats.push(x);
    for (const x of beats) d += ` H${f(x - 8)} l5 -10 l6 36 l6 -44 l6 18 H${f(x + 18)}`;
    d += ' H460';
    r += path(d, '#b9bdb2', 3);
    // the part already swept: drawn in blue, clipped at the sweep line
    r += `<clipPath id="fs-sweep-${y}"><rect x="0" y="${y - 60}" width="${f(sweep)}" height="120"/></clipPath>`;
    r += `<g clip-path="url(#fs-sweep-${y})">${path(d, C.blue, 3.5)}</g>`;
    for (const x of beats) if (x < sweep) r += circle(x + 5, y - 52 + 26, 6, BLOOD);
    // one gap, bracketed: the time to fill
    const g0 = beats[1] + 18, g1 = beats[2] - 8;
    r += part('fillgap', path(`M${f(g0)} ${y + 34} V${y + 42} H${f(g1)} V${y + 34}`, C.ink, 2));
    r += text((g0 + g1) / 2, y + 64, word, 'xs b', 'middle');
    return r;
  };
  s += row(110, 'slower heart', 104, 'time to fill');
  s += row(250, 'faster heart', 62, 'shorter');
  s += line(sweep, 30, sweep, 300, C.ink, 2);
  return s;
}
// Step 9: beat by beat, each stroke volume pours into the jug: a minute's worth is the cardiac output.
function outputPicture(t) {
  const N = 6, run = span(t, .04, .9), done = Math.min(N, Math.floor(run * N + 1e-9)), within = run * N - done;
  const u = done >= N ? .9 : within;            // where the current beat is (0 to 1)
  const B = beat(u), g = ventricleGeometry(96, 120, B.v, .62);
  let s = ventricle(g, { inletOpen: B.phase === 'fill', outletOpen: B.phase === 'squeeze', flowIn: B.phase === 'fill' ? B.k : null, stub: true });
  // the scoop: one stroke volume, travelling to the jug during the squeeze
  const jx = 370, jTop = 96, jBottom = 270, jw = 120;
  if (done < N && B.phase === 'squeeze') {
    const k = B.k, x = lerp(122, jx, k), y = lerp(56, jTop - 8, k) - Math.sin(k * Math.PI) * 30;
    s += part('sv', circle(x, y, 12, BLOOD));
  }
  s += arrow(`M128 60 Q240 0 ${jx - 30} ${jTop - 14}`, C.muted, 2, 'stroke-dasharray="6 5"');
  const filled = (done + (B.phase === 'squeeze' || B.phase === 'shut' && u > .8 ? Math.min(1, span(u, .6, .88)) : 0)) / N;
  const level = jBottom - (jBottom - jTop - 10) * Math.min(1, filled);
  s += part('co', rect(jx - jw / 2 + 3, level, jw - 6, jBottom - level, BLOOD));
  for (let i = 1; i < N; i++) s += line(jx - jw / 2, jBottom - (jBottom - jTop - 10) * i / N, jx - jw / 2 + 14, jBottom - (jBottom - jTop - 10) * i / N, C.ink, 1.5);
  s += path(`M${jx - jw / 2} ${jTop} V${jBottom} H${jx + jw / 2} V${jTop}`, C.ink, 3);
  s += text(jx, 300, 'cardiac output', 'sm b', 'middle');
  s += text(jx, 322, 'a minute of beats', 'xs', 'middle');
  // beats counted under the heart
  for (let i = 0; i < N; i++) s += part('rate', circle(36 + i * 24, 296, 8, i < done ? C.blue : 'none', C.blue, 2.5));
  s += text(16, 330, 'beats', 'xs b', 'start');
  s += text(222, 84, 'one stroke volume', 'xs b', 'middle');
  s += text(222, 104, 'each beat', 'xs', 'middle');
  return s;
}
// Step 10: the whole idea as a map: filling and strength set blood per beat; times heart rate, the output.
function wholePicture() {
  const box = (x, y, w, h, title, sub, { fill = '#fff', stroke = C.ink, cls = 'sm b', dash = '' } = {}) =>
    rect(x, y, w, h, fill, stroke, 2, `rx="10" ${dash}`) + text(x + w / 2, y + h / 2 - 3, title, `${cls} on-white`, 'middle') + text(x + w / 2, y + h / 2 + 19, sub, 'xs muted on-white', 'middle');
  let s = '';
  s += part('preload', box(16, 20, 170, 62, 'filling', 'preload'));
  s += part('contractility', box(16, 112, 170, 62, 'strength', 'contractility'));
  s += part('rate', box(16, 214, 170, 62, 'heart rate', 'beats a minute'));
  s += part('sv', box(264, 66, 200, 62, 'blood per beat', 'stroke volume'));
  s += part('afterload', box(16, 306, 170, 62, 'afterload', 'held steady here', { fill: C.panel, stroke: C.muted, dash: 'stroke-dasharray="6 5"' }));
  s += part('co', box(254, 300, 210, 70, 'cardiac output', 'blood a minute', { fill: C.blueWash, stroke: C.blue, cls: 'lg b on-blue' }));
  // arrows into blood per beat, into the multiply sign, and down to the output
  s += arrowTo(190, 51, 256, 88, C.ink, 3) + arrowTo(190, 143, 256, 108, C.ink, 3);
  s += arrowTo(364, 132, 364, 218, C.ink, 3) + arrowTo(190, 245, 336, 245, C.ink, 3);
  s += circle(364, 245, 22, '#fff', C.ink, 2) + text(364, 253, '×', 'lg b on-white', 'middle');
  s += arrowTo(364, 268, 364, 292, C.ink, 3);
  return s;
}

/* ---------- The change pictures ---------- */
// What each change moved, named on the picture: [words, class] rows placed in empty space under the curve.
function namedWords(kind, o, t) {
  const st = CHANGES[kind], a1 = span(t, st[0].to - .06, st[0].to + .06), a2 = st[1] ? span(t, st[1].to - .06, st[1].to + .06) : 0;
  const W = {
    fluids: [[['→ fills more', 'xs b blue'], ['↑ more per beat', 'xs b'], ['along the same curve', 'xs muted']], []],
    diuretics: [[['← fills less', 'xs b blue'], ['↓ less per beat', 'xs b'], ['along the same curve', 'xs muted']], []],
    inotropes: [[['↑ whole curve lifts', 'xs b blue'], ['more per beat', 'xs b'], ['from the same filling', 'xs muted']], []],
    beta: [[['↓ curve dips a little', 'xs b blue'], ['gentler squeeze', 'xs muted']], [['→ slower beats fill longer', 'xs b blue'], ['per beat: about the same', 'xs b']]],
    nitrates: [[['← fills less', 'xs b blue'], ['↓ less per beat', 'xs b'], ['veins hold more blood', 'xs muted']], []],
    failure: [[['↓ curve drops: weaker squeeze', 'xs b red']], [['→ kidneys raise filling:', 'xs b blue'], ['it wins back little', 'xs b']]],
  }[kind];
  const rows = [...W[0].map(r => [...r, a1]), ...W[1].map(r => [...r, a2])];
  // Words go in empty space: under the flat top on the right, or, when the curve drops, above it on the left.
  const left = kind === 'failure';
  return rows.map(([w, cls, a], i) => text(left ? CH.x0 + 16 : CH.x1, (left ? 62 : 168) + i * 21, w, cls, left ? 'start' : 'end', fade(a))).join('');
}
// The arrow that shows what moved, between the normal dot and the changed one (or between stages).
function namedArrows(kind, o, t) {
  const g = BASE;
  let s = '';
  const a = span(t, .3, .6);
  if (kind === 'fluids' || kind === 'diuretics' || kind === 'nitrates') {
    const x1 = px(g.filling), x2 = px(o.filling), y1 = py(g.sv), y2 = py(o.sv);
    if (Math.abs(x2 - x1) > 24) s += `<g ${fade(a)}>${arrow(`M${f(x1 + (x2 > x1 ? 10 : -10))} ${f(y1 + 18)} L${f(x2 + (x2 > x1 ? -8 : 8))} ${f(y2 + 18)}`, C.blue, 3.5)}</g>`;
  }
  if (kind === 'inotropes') {
    const x = px(1) - 16, y1 = py(g.sv) - 6, y2 = py(o.sv) + 10;
    if (y1 - y2 > 16) s += `<g ${fade(a)}>${arrow(`M${x} ${f(y1)} V${f(y2)}`, C.blue, 3.5)}</g>`;
  }
  if (kind === 'failure') {
    const mid = model({ ...NORMAL, ...CHANGES.failure[0].set });
    const x = px(1) - 16, y1 = py(g.sv) + 8, y2 = py(mid.sv) - 10;
    if (y2 - y1 > 16) s += `<g ${fade(span(t, .2, .4))}>${arrow(`M${x} ${f(y1)} V${f(Math.min(y2, py(o.sv) - 10))}`, C.red, 3.5)}</g>`;
    if (o.filling - 1 > .08) s += arrow(`M${f(px(1) + 12)} ${f(py(mid.sv) + 22)} L${f(px(o.filling) - 8)} ${f(py(o.sv) + 22)}`, C.blue, 3.5);
  }
  return s;
}
// The chart for a changed heart, drawn over a dashed ghost of normal, with the per-minute bars beneath.
function changeBody(o, { kind = '', t = 1, ghost = true, mid = null } = {}) {
  let s = '';
  if (ghost) s += `<g class="ghost" data-ghost="normal" ${attrs(BASE)}>${path(curveD(1), C.ink, 3, 'stroke-dasharray="7 6"')}${ghostDot(px(BASE.filling), py(BASE.sv))}</g>`;
  s += axes();
  s += `<g data-new-state="${kind || 'these settings'}" ${attrs(o)}>`;
  s += path(curveD(o.p.strength), C.blue, 5);
  if (mid) s += ghostDot(px(mid.filling), py(mid.sv));
  s += dot(px(o.filling), py(o.sv));
  s += '</g>';
  if (kind) s += namedArrows(kind, o, t) + namedWords(kind, o, t);
  s += minuteBars(o, 300, { rate: moved(o.rate, 1, 'faster', 'slower', 'the same'), co: moved(o.co, 1, 'more', 'less', 'the same') });
  return { body: s };
}
function compare(o) {
  const dir = (v, up, down) => { const r = v; return r > 1.015 ? ['up', up] : r < .985 ? ['down', down] : ['same', 'about the same']; };
  return [
    ['Filling before the beat', ...dir(o.filling / BASE.filling, 'more', 'less')],
    ['Blood per beat', ...dir(o.sv / BASE.sv, 'more', 'less')],
    ['Heart rate', ...dir(o.rate / BASE.rate, 'faster', 'slower')],
    ['Cardiac output', ...dir(o.co / BASE.co, 'more', 'less')],
  ];
}
const describe = o => compare(o).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join(', ');
const CHANGE_LABEL = {
  fluids: 'IV fluids. The blue dot slides right and up along the same curve as the dashed normal one: the ventricle fills more and pumps more per beat. The cardiac output bar grows; the heart rate bar is unchanged.',
  diuretics: 'Diuretics. The blue dot slides left and down along the same curve: less filling, less per beat. The cardiac output bar shrinks; the heart rate bar is unchanged.',
  inotropes: 'Positive inotropes. The whole blue curve lifts above the dashed normal curve, and at the same filling the dot sits higher: more per beat. The cardiac output bar grows.',
  beta: 'Beta-blockers. First the blue curve dips a little below normal; then the dot slides a little right as slower beats fill longer, ending at about the normal height. The heart rate bar shrinks, and so does the cardiac output bar.',
  nitrates: 'Venodilators. The blue dot slides left and down along the same curve: veins hold more blood, the heart fills less and pumps less per beat. The cardiac output bar shrinks.',
  failure: 'Heart failure. First the whole curve drops well below normal and the dot falls; then the dot slides right as the kidneys raise filling, but on the low flat curve it climbs only a little. The cardiac output bar stays short.',
};
function change(kind) {
  const twoStage = CHANGES[kind].length > 1;
  return {
    duration: twoStage ? 4600 : 3000,
    render(t) {
      const o = model(stateAt(kind, t));
      const mid = twoStage && t > CHANGES[kind][0].to ? model({ ...NORMAL, ...CHANGES[kind][0].set }) : null;
      const { body } = changeBody(o, { kind, t, mid });
      const label = `${CHANGE_LABEL[kind]} Compared with normal: ${describe(o)}.`;
      return { svg: svg(label, body, { h: 368 }), readout: readout(compare(o).map(([k, d, w]) => [k, d, w])) };
    }
  };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const scenes = {
  heart: { duration: 2600, loop: true, rest: .55, render: t => svg('A left ventricle drawn side-on, a muscular chamber with an inlet valve and an outlet valve at its top. It beats over and over: it relaxes and fills with blood coming in from the lungs, then squeezes, and blood leaves through the outlet to the body.', heartPicture(t), { h: 316 }) },
  fill: { duration: 3200, render: t => svg('Two relaxed ventricles fill over the same time. Left: a thin stream, less blood returning; it ends less full. Right: a thick stream, more blood returning; it ends fuller, ready to start the next beat with more in it.', fillPicture(t), { h: 330 }) },
  stretch: { duration: 3200, render: t => svg('A ventricle fills and its wall stretches. One muscle fibre in the wall, drawn large on the right, lengthens from its dashed starting size as the chamber fills: that stretch before the beat is the preload.', stretchPicture(t), { h: 318 }) },
  stretchmore: { duration: 3400, render: t => svg('One small stretch of a muscle fibre, close up: thin filaments reach in from each end and a thick filament in the middle has heads that pull on them. As the fibre is stretched, more heads turn blue, able to pull, and the force bar rises above its dashed starting level.', stretchMorePicture(t), { h: 310 }) },
  eject: { duration: 2800, loop: true, rest: .96, render: t => svg('The ventricle beats. Each time it squeezes, blood leaves through the outlet and fills a cup on the right: one stroke volume. The chamber never empties: some blood stays behind after every squeeze.', ejectPicture(t), { h: 330 }) },
  curve: { duration: 4400, render: t => svg('A graph of blood per beat against filling. The blue Frank-Starling curve draws itself from left to right: steep at first, where a little more filling gives a lot more per beat, then levelling off. A dot marks where a resting heart sits, on the rising part.', curvePicture(t), { h: 290 }) },
  strength: () => svg('Three Frank-Starling curves on one graph. The normal curve is black; a stronger heart’s blue curve sits above it and a weaker heart’s red curve below. At the same filling, marked by a dashed line, the stronger heart pumps more per beat and the weaker heart less.', strengthPicture(), { h: 290 }),
  rhythm: { duration: 4200, loop: true, render: t => svg('Two heartbeat traces over the same time. A line sweeps across, turning each beat blue and dropping a blood drop as it passes. The slower heart has fewer beats with long gaps between them, the time to fill; the faster heart has more beats with shorter gaps.', rhythmPicture(t), { h: 330 }) },
  output: { duration: 5400, render: t => svg('A small ventricle beats six times. With each squeeze one stroke volume travels into a jug on the right, which fills step by step; dots under the heart count the beats. The full jug is the cardiac output: the blood of one minute.', outputPicture(t), { h: 340 }) },
  whole: () => svg('A map of the lesson. Filling, the preload, and strength, the contractility, both feed blood per beat, the stroke volume. Blood per beat times heart rate gives the cardiac output. A dashed box says afterload, the pressure the heart pumps against, is held steady here.', wholePicture(), { h: 384 }),
  fluids: change('fluids'),
  diuretics: change('diuretics'),
  inotropes: change('inotropes'),
  beta: change('beta'),
  nitrates: change('nitrates'),
  failure: change('failure'),
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['filling', 'strength', 'rate'];
// The Clinical values states: each lesson change at its end, except heart failure, whose cited direction is
// the weaker squeeze alone (the lesson's second stage, the kidneys raising filling, is not in that source).
const STATE_PARAMS = {
  fluids: finalState('fluids'), diuretics: finalState('diuretics'), inotropes: finalState('inotropes'),
  beta: finalState('beta'), nitrates: finalState('nitrates'), failure: { ...NORMAL, ...CHANGES.failure[0].set },
};
const LESSON_NOTE = { failure: 'The lesson’s step then adds a second stage the cited source does not cover: the kidneys hold on to salt and water, so filling rises, and on the lower curve blood per beat recovers only a little.' };
const level = v => v < .95 ? 'lower' : v > 1.05 ? 'higher' : 'normal';
const valueOf = id => data.values.find(v => v.id === id);
const reference = id => { const v = valueOf(id); return v.typical ?? (v.low + v.high) / 2; };
// Model results in the textbook's units.
function measures(o) {
  return { edv: reference('edv') * o.filling, sv: reference('sv') * o.sv, hr: reference('hr') * o.rate, co: reference('sv') * o.sv * reference('hr') * o.rate / 1000 };
}
const DECIMALS = { co: 2 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ No direct change', variable: '↕ Variable' };
const scaleMax = v => (v.high ?? v.typical) * 2.2;
const posOf = v => n => f(20 + clamp(n / scaleMax(v), 0, 1) * 360);
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(params[k]); }
  $('#clinical-fill').value = params.filling;
  $('#clinical-fill-label').textContent = level(params.filling);
}
function update() {
  syncControls();
  const o = model(params);
  const label = `Illustrative model with these settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.`;
  $('#explore-visual').innerHTML = svg(label, changeBody(o).body, { h: 368 }) + readout(compare(o));
  $('#clinical-visual').innerHTML = svg(label, changeBody(o).body, { h: 368 });
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: blood per beat ×${(o.sv / BASE.sv).toFixed(2)} · heart rate ×${o.rate.toFixed(2)} · cardiac output ×${(o.co / BASE.co).toFixed(2)}.`;
    return;
  }
  const m = measures(o), unit = id => valueOf(id).unit;
  $('#model-results').textContent = `Illustrative model: filled volume ${fmt('edv', m.edv)} ${unit('edv')} · ${m.sv.toFixed(1)} ${unit('sv')} per beat · ${m.hr.toFixed(0)} ${unit('hr')} · cardiac output ${fmt('co', m.co)} ${unit('co')}.`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const val = m[v.modelKey];
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const x = posOf(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    let status;
    if (v.low !== null && v.high !== null) status = val < v.low ? 'below the typical range' : val > v.high ? 'above the typical range' : 'inside the typical range';
    else { const r = val / v.typical; status = Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value'; }
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
$('#clinical-fill').addEventListener('input', e => {
  params.filling = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with filling adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom settings: filling adjusted by hand.';
  update();
});
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(STATE_PARAMS[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${LESSON_NOTE[id] ? ' ' + LESSON_NOTE[id] : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]` : '';
  update();
});

/* ---------- Reference data ---------- */
const modelControls = $$('#clinical select, #clinical input, #clinical button');
modelControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['edv', 'sv', 'hr', 'co']) {
      const v = loaded.values?.find(x => x.id === id);
      const ok = v && (Number.isFinite(v.typical) && v.typical > 0 || Number.isFinite(v.low) && Number.isFinite(v.high) && v.low > 0 && v.high >= v.low);
      if (!ok) throw new Error('Invalid reference data');
    }
    data = loaded;
    CAP = .95 * reference('edv') / reference('sv');
    BASE = model(NORMAL);
    $('#disclaimer').textContent = data.disclaimer;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = posOf(v), range = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the textbook range as a shaded band' : 'the textbook typical value as a tick'}, and a marker for the current illustrative model`);
      right.querySelector('.key').textContent = `${range ? `Textbook range ${v.low} to ${v.high} ${v.unit} (shaded)` : `Textbook typical value about ${v.typical} ${v.unit} (tick; no range given)`} · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'DOI'; li.append(' · ', a); }
      $('#sources').append(li);
    }
    const li = document.createElement('li');
    li.textContent = 'Directions for each change: ' + data.states.map(s => `${s.label}: ${s.where} [${s.source}]`).join(' ');
    $('#sources').append(li);
    modelControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative curve.';
  }
  BASE = model(NORMAL);
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
