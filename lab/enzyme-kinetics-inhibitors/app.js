// Lesson 33: Enzyme kinetics and inhibitors. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: the enzyme is the alternate protein material (lilac) with an active-site pocket
//     at its top; the substrate is a golden peg that fits that pocket, the product its two paler halves; every
//     inhibitor or modulator is drug purple. Kit blue is the curve being taught and every change arrow; red
//     is the negative modulator's curve.
//   - Every graph is drawn from model.js: substrate in multiples of the normal Km, speed as a percent of the
//     normal maximum. A "What changes it" step morphs the live curve from normal (t = 0) to the lesson's
//     setting (t = 1, model.js LESSON) over a dashed ghost of the normal curve, and names what moved.
//   - No reference number lives in this file: the Clinical values tab reads clinical-values.json.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, fill, mix, spec, arrowFixed, leader } from '/lab/kit/art/core.js';
import { axes, curve, marker } from '/lab/kit/art/chart.js';
import { drug } from '/lab/kit/art/molecules.js';
import { S_MAX, ALLO_K, LESSON, NORMAL, params, speed, curvePts, busyShare } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, RED = P.ui.red;
const pt = ([x, y]) => `${f(x)} ${f(y)}`;
const polyD = pts => `M${pts.map(pt).join(' L')} Z`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;

/* ---------- Molecules ---------- */
// The substrate and everything shaped like it: a peg with a tapered foot, the shape of the active-site pocket.
const PEG = [[-6, -9], [6, -9], [6, 0], [2.4, 8.5], [-2.4, 8.5], [-6, 0]];
const PEG_TOP = [[-6, -9], [6, -9], [6, 0], [-6, 0]];
const PEG_FOOT = [[-6, 0], [6, 0], [2.4, 8.5], [-2.4, 8.5]];
const SUB = { base: P.glucose.base, line: P.glucose.line };
const PROD = { base: mix(P.glucose.base, P.ui.white, 0.5), line: P.glucose.line };
const DRUG = { base: P.drug.base, line: P.drug.line };
const place = (pts, cx, cy, k, rot = 0) => { const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + k * (x * c - y * s), cy + k * (x * s + y * c)]); };
const solid = (pts, m, sw = 1.4) => `<path d="${polyD(pts)}" fill="${m.base}" stroke="${m.line}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const shine = (cx, cy, k) => `<ellipse cx="${f(cx - 2.6 * k)}" cy="${f(cy - 5.5 * k)}" rx="${f(2 * k)}" ry="${f(1.3 * k)}" fill="${P.ui.white}" fill-opacity=".45"/>`;
// A peg: the substrate (SUB), or a competitive inhibitor drawn in drug purple; bond adds the lasting bond of
// an irreversible inhibitor (a dark dot at its foot).
function peg(cx, cy, k, m = SUB, { part = 'substrate', rot = 0, op = 1, bond = false } = {}) {
  let s = solid(place(PEG, cx, cy, k, rot), m) + shine(cx, cy, k);
  if (bond) { const [bx, by] = place([[0, 9.6]], cx, cy, k, rot)[0]; s += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(Math.max(2.4, 2.2 * k))}" fill="${P.drug.line}"/>`; }
  return `<g data-part="${part}"${op < 1 ? ` ${fade(op)}` : ''}>${s}</g>`;
}
// The product: the peg split into its two halves, drifting apart by gap (in peg units).
function product(cx, cy, k, { gap = 0, op = 1, dx = 0, dy = 0 } = {}) {
  const top = place(PEG_TOP, cx - gap * 0.6 * k, cy - gap * k, k), foot = place(PEG_FOOT, cx + gap * 0.9 * k + dx, cy + gap * 0.4 * k + dy, k);
  return `<g data-part="product"${op < 1 ? ` ${fade(op)}` : ''}>${solid(top, PROD)}${solid(foot, PROD)}</g>`;
}

/* ---------- The enzyme ---------- */
// A globular protein with its active-site pocket at the top, shaped to the peg (k = 1.5 s), and, when asked,
// a second site: a pit on its lower left. dock: where a bound peg's centre sits; pit: the second site.
function enz(cx, cy, s, { part = 'enzyme', off = 0, glow = 0, second = false, site = false } = {}) {
  const rx = 40 * s, ry = 32 * s, k = 1.5 * s, m = 1.8 * s, hw = 6 * k + m, top = cy - ry, py = top + 9 * k;
  const yE = x => cy - ry * Math.sqrt(1 - (x / rx) ** 2);
  const pocket = [[cx - hw, yE(-hw)], [cx - hw, py + m * 0.2], [cx - 2.4 * k - m * 0.6, py + 8.5 * k + m], [cx + 2.4 * k + m * 0.6, py + 8.5 * k + m], [cx + hw, py + m * 0.2], [cx + hw, yE(hw)]];
  const d = `M${pt(pocket[0])} L${pocket.slice(1).map(pt).join(' L')} A${f(rx)} ${f(ry)} 0 1 1 ${pt(pocket[0])} Z`;
  const a = 2.45, pit = [cx + rx * 0.86 * Math.cos(a), cy + ry * 0.86 * Math.sin(a)];
  let b = '';
  if (glow > 0.01) b += `<path d="${d}" fill="none" stroke="${P.ui.blueWash}" stroke-width="${f(12 * glow)}" stroke-linejoin="round"/>`;
  b += `<path d="${d}" fill="${fill('protein2')}" stroke="${P.protein2.line}" stroke-width="1.75" stroke-linejoin="round"/>`;
  b += spec(cx - rx * 0.45, cy - ry * 0.12, rx * 0.2, ry * 0.13, -25);
  if (off > 0.01) b += `<path d="${d}" fill="${INK}" fill-opacity="${f(0.16 * off)}"/>`;
  let out = `<g data-part="${part}">${b}</g>`;
  if (second) out += `<g data-part="second-site"><circle cx="${f(pit[0])}" cy="${f(pit[1])}" r="${f(6.5 * s)}" fill="${P.protein2.lo}" stroke="${P.protein2.line}" stroke-width="1.25"/></g>`;
  if (site) out += `<g data-part="active-site"><path d="M${pt(pocket[0])} L${pocket.slice(1).map(pt).join(' L')}" fill="none" stroke="${P.protein2.line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></g>`;
  return { svg: out, dock: [cx, py], pit, top, rx, ry, k, mouth: [cx, top] };
}
// An allosteric enzyme: two linked parts, each with an active site, and the control site in the cleft
// between them. Returns the docks and the control site.
function alloEnz(cx, cy, s, { part = 'allosteric', sitePart = 'control-site' } = {}) {
  const dx = 38 * s, L = enz(cx - dx, cy, s, { part }), R = enz(cx + dx, cy, s, { part });
  const site = [cx, cy + 27 * s];
  const pit = `<g data-part="${sitePart}"><circle cx="${f(site[0])}" cy="${f(site[1])}" r="${f(7 * s)}" fill="${P.protein2.lo}" stroke="${P.protein2.line}" stroke-width="1.25"/></g>`;
  return { svg: L.svg + R.svg + pit, docks: [L.dock, R.dock], site, k: L.k, top: L.top };
}
// A drug glyph from the library, centred at [x, y].
const drugAt = (family, [x, y], s, part = 'drug') => drug({ family, x, y, s, parts: { drug: part } }).svg;
// The noncompetitive inhibitor: a purple wedge whose point sits in the second-site pit. out: the pit's
// outward angle from the enzyme's centre; away: how far it still is from docking (0 = docked).
const WEDGE = [[-9, -7], [9, -7], [0, 9]];
function wedge(pit, out, k, { away = 0, part = 'drug' } = {}) {
  const d = 9 * k + away, cx = pit[0] + Math.cos(out) * d, cy = pit[1] + Math.sin(out) * d;
  const pts = place(WEDGE, cx, cy, k, out * 180 / Math.PI + 90);
  return `<g data-part="${part}">${solid(pts, DRUG)}<circle cx="${f(cx - 2 * k)}" cy="${f(cy - 2 * k)}" r="${f(1.6 * k)}" fill="${P.ui.white}" fill-opacity=".4"/></g>`;
}

/* ---------- Graphs ---------- */
// One graph frame: substrate 0 to S_MAX along x, speed up y (y100 is where 100 % of the normal maximum sits).
// Levels are named as y-axis ticks (yt: [[percent, words]]), so no word sits on a curve.
function frame({ x0 = 100, x1 = 456, yB = 372, y100 = 196, top = 150, sMax = S_MAX } = {}) {
  const gx = s => x0 + s / sMax * (x1 - 16 - x0), gy = v => yB - v / 100 * (yB - y100);
  return { x0, x1, yB, y100, top, gx, gy, sMax, pts: p => curvePts(p, sMax).map(([s, v]) => [gx(s), gy(v)]),
    axes: (yt = [], extra = {}) => axes({ x0, y0: yB, x1, y1: top, xLabel: 'substrate', yLabel: 'speed', cls: 'sm b', ticks: { y: yt.map(([v, w]) => [v, w, gy(v)]) }, ...extra }) };
}
const hline = (x0, x1, y, w = 1.25, dash = '2 5') => `<path d="M${f(x0)} ${f(y)} H${f(x1)}" stroke="${INK}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;
const vline = (x, y0, y1, w = 1.25, dash = '2 5') => `<path d="M${f(x)} ${f(y0)} V${f(y1)}" stroke="${INK}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;
// The live curve, its panel underlay included.
const live = (G, p, col = BLUE, sMax) => curve(sMax ? curvePts(p, sMax).map(([s, v]) => [G.gx(s), G.gy(v)]) : G.pts(p), { role: 'live', col });
const ghostCurve = (G, p) => `<g data-ghost="normal">${curve(G.pts(p), { role: 'ghost' })}</g>`;

/* ---------- Step 1: an enzyme speeds up one reaction ---------- */
function enzymeStill() {
  const E = enz(240, 262, 2.1, { second: false });
  let b = E.svg;
  b += peg(96, 128, 3.1);
  b += arrowFixed([128, 150], [196, 196], { col: INK, w: 2.5 });
  b += product(384, 132, 3.1, { gap: 1.4 });
  b += arrowFixed([284, 196], [346, 158], { col: INK, w: 2.5 });
  b += text(96, 72, 'substrate', 'sm b') + text(390, 72, 'product', 'sm b');
  b += text(240, 386, 'enzyme: not used up', 'sm b');
  return b;
}

/* ---------- Step 2: the substrate fits the active site ---------- */
function sitePicture(t) {
  const E = enz(240, 268, 2.3, { site: true });
  const e = ease.inOut(span(t, 0.1, 0.85));
  const start = [104, 96], [dx, dy] = E.dock;
  const x = lerp(start[0], dx, e), y = lerp(start[1], dy, e) - Math.sin(Math.PI * e) * 30, rot = lerp(-35, 0, e);
  let b = E.svg;
  // a molecule of the wrong shape, parked beside the enzyme: it has no pocket to fit
  b += `<g data-part="other"><path d="M372 104 l16 -14 l16 14 l-6 18 h-20 z" fill="${P.cl.base}" stroke="${P.cl.line}" stroke-width="1.4" stroke-linejoin="round"/></g>`;
  b += text(388, 152, 'wrong shape:', 'xs muted') + text(388, 172, 'no fit', 'xs muted');
  b += peg(x, y, E.k, SUB, { rot });
  b += text(40, 52, 'substrate', 'sm b', 'start');
  b += text(452, 236, 'active site', 'sm b', 'end') + leader([380, 244], [E.dock[0] + 14, E.dock[1] + 4]);
  b += `<g ${fade(span(t, 0.8, 0.98))}>${text(240, 394, 'it fits: the substrate is bound', 'sm b blue')}</g>`;
  return b;
}

/* ---------- Step 3: bind, change, let go, repeat ---------- */
function cyclePicture(t) {
  const E = enz(240, 270, 2.1), [dx, dy] = E.dock, k = E.k;
  const start = [92, 112], out1 = [372, 92], out2 = [404, 150];
  const bind = ease.inOut(span(t, 0.02, 0.3)), change = span(t, 0.32, 0.5), go = ease.inOut(span(t, 0.5, 0.82)), next = ease.inOut(span(t, 0.82, 1));
  let b = enz(240, 270, 2.1, { glow: Math.sin(Math.PI * change) }).svg;
  if (t < 0.5) b += peg(lerp(start[0], dx, bind), lerp(start[1], dy, bind) - Math.sin(Math.PI * bind) * 24, k, SUB, { rot: lerp(-30, 0, bind) });
  else {
    // the two halves leave by their own paths and fade as they go
    const op = 1 - span(t, 0.72, 0.84);
    b += `<g data-part="product" ${fade(op)}>${solid(place(PEG_TOP, lerp(dx, out1[0], go), lerp(dy - 2, out1[1], go), k, lerp(0, 25, go)), PROD)}${solid(place(PEG_FOOT, lerp(dx, out2[0], go), lerp(dy + 2, out2[1], go), k, lerp(0, -20, go)), PROD)}</g>`;
    // the next substrate arrives at the start, so the loop is seamless
    if (next > 0) b += peg(start[0], start[1], k, SUB, { rot: -30, op: next });
  }
  const phase = t < 0.31 ? 0 : t < 0.5 ? 1 : t < 0.84 ? 2 : 3;
  [['1 bind', 92], ['2 change', 240], ['3 let go', 388]].forEach(([w, x], i) => { b += text(x, 46, w, i === phase ? 'sm b blue' : 'sm muted'); });
  b += text(240, 392, phase === 3 ? 'the enzyme is unchanged: ready again' : 'one substrate at a time', 'sm b');
  return b;
}

/* ---------- Step 4: more substrate keeps more enzymes busy ---------- */
const BUSY_AT = [[64, 132], [148, 132], [232, 132], [316, 132], [64, 262], [148, 262], [232, 262], [316, 262]];
const BUSY_ORDER = [2, 5, 0, 7, 3, 4, 6, 1];
const FREE_AT = (() => {
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = [];
  for (let i = 0; out.length < 24 && i < 4000; i++) {
    const p = [24 + r() * 330, 70 + r() * 270];
    if (BUSY_AT.some(([x, y]) => Math.abs(p[0] - x) < 42 && p[1] > y - 44 && p[1] < y + 30)) continue;
    if (out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 30)) continue;
    out.push(p);
  }
  return out;
})();
function busyPicture(t) {
  const sub = lerp(0.15, 7, ease.inOut(span(t, 0.05, 0.9)));
  const n = Math.round(8 * busyShare(sub)), nFree = Math.min(FREE_AT.length, Math.max(1, Math.round(2.6 * sub)));
  let b = '';
  BUSY_AT.forEach(([x, y], i) => {
    const E = enz(x, y, 0.62);
    b += E.svg;
    if (BUSY_ORDER.indexOf(i) < n) b += peg(E.dock[0], E.dock[1], E.k);
  });
  b += FREE_AT.slice(0, nFree).map(([x, y], i) => peg(x, y, 0.93, SUB, { rot: (i * 47) % 70 - 35 })).join('');
  // the speed bar: product made each second, in proportion to the busy enzymes
  const h = 200 * n / 8;
  b += `<g data-part="speed"><rect x="388" y="${f(346 - h)}" width="52" height="${f(Math.max(1.5, h))}" rx="4" fill="${BLUE}" fill-opacity=".85"/><path d="M380 346.5 H448" stroke="${INK}" stroke-width="1.5"/></g>`;
  b += `<rect x="388" y="146" width="52" height="200" rx="4" fill="none" stroke="${P.ui.rule}" stroke-width="1.25" stroke-dasharray="4 4"/>`;
  b += text(414, 128, 'speed', 'sm b');
  b += text(190, 46, sub < 1 ? 'a little substrate' : sub < 3 ? 'more substrate' : 'lots of substrate', 'sm b');
  b += text(190, 384, `busy: ${n} of 8 enzymes`, 'sm b blue');
  return b;
}

/* ---------- Step 5: speed rises, then levels off ---------- */
const G1 = frame({ yB: 352, y100: 112, top: 56 });
function curvePicture(t) {
  const G = G1, p = params(), e = ease.inOut(span(t, 0.05, 0.85)), sNow = Math.max(0.05, e * S_MAX);
  let b = G.axes();
  const sh = span(t, 0.75, 0.95);
  b += `<g data-part="vmax" ${fade(sh)}>${hline(G.x0, G.x1 - 12, G.gy(100))}${text(G.x1 - 12, G.gy(100) - 10, 'maximum speed', 'sm b', 'end')}</g>`;
  b += live(G, p, BLUE, sNow);
  b += marker(G.gx(sNow), G.gy(speed(sNow, p)), { col: BLUE });
  b += `<g ${fade(1 - span(t, 0.35, 0.5))}>${text(G.gx(1.6) + 14, G.gy(30), 'climbs steeply', 'xs b', 'start')}</g>`;
  b += `<g ${fade(span(t, 0.75, 0.95))}>${text(G.gx(6.2), G.gy(62), 'flat: nearly every', 'xs b')}${text(G.gx(6.2), G.gy(62) + 20, 'enzyme is busy', 'xs b')}</g>`;
  return b;
}

/* ---------- Step 6: the Km ---------- */
function kmStill() {
  const G = G1, p = params();
  let b = G.axes([[50, 'half']]);
  b += `<g data-part="vmax">${hline(G.x0, G.x1 - 12, G.gy(100))}${text(G.x1 - 12, G.gy(100) - 10, 'maximum speed', 'sm b', 'end')}</g>`;
  b += live(G, p);
  const x = G.gx(1), y = G.gy(50);
  b += `<g data-part="km">${hline(G.x0, x, y, 1.5, '4 4')}${vline(x, y, G.yB, 1.5, '4 4')}${marker(x, y, { col: BLUE })}${text(x, G.yB + 22, 'Km', 'sm b blue')}</g>`;
  b += text(x + 16, y + 26, 'half speed: half', 'xs b', 'start') + text(x + 16, y + 46, 'the enzymes busy', 'xs b', 'start');
  return b;
}

/* ---------- Step 7: more enzyme raises the ceiling ---------- */
const G2 = frame({ y100: 268, top: 104 });
function amountPicture(t) {
  const G = G2, e = ease.inOut(span(t, 0.1, 0.85)), p = params({ enzyme: lerp(1, LESSON.more, e) }), p0 = params();
  let b = G.axes([[100, 'max'], [200, 'twice']]);
  b += ghostCurve(G, p0);
  b += hline(G.x0, G.x1 - 12, G.gy(100));
  b += `<g data-part="vmax">${hline(G.x0, G.x1 - 12, G.gy(p.vmax))}</g>`;
  b += live(G, p);
  const x = G.gx(1);
  b += `<g data-part="km">${vline(x, G.gy(p.vmax / 2), G.yB, 1.5, '4 4')}${marker(x, G.gy(50), { kind: 'ring', col: P.ui.ghost })}${marker(x, G.gy(p.vmax / 2), { col: BLUE })}${text(x, G.yB + 22, 'Km: same', 'sm b blue')}</g>`;
  // the arrow climbs just right of the axis, where the curves are still low; its words sit above the new ceiling
  const ax = G.gx(0.35);
  if (e > 0.25) b += `<g data-delta ${fade(span(t, 0.55, 0.85))}>${arrowFixed([ax, G.gy(100) - 4], [ax, G.gy(p.vmax) + 6], { col: BLUE, w: 3.5 })}${text(ax + 12, G.gy(200) - 12, 'ceiling doubles', 'sm b blue', 'start')}</g>`;
  b += text(G.x1 - 12, 40, 'twice the enzyme', 'sm b blue', 'end');
  return b;
}

/* ---------- Step 8: an inhibitor slows an enzyme ---------- */
function inhibitorStill() {
  const E = enz(240, 238, 2.3, { second: true });
  let b = E.svg;
  b += peg(E.dock[0], E.dock[1], E.k, DRUG, { part: 'drug' });
  // the second inhibitor's point sits in the second site's pit
  const a = Math.atan2(E.pit[1] - 238, E.pit[0] - 240);
  b += wedge(E.pit, a, 2);
  b += text(452, 84, 'in the active site', 'sm b purple', 'end') + leader([380, 92], [E.dock[0] + 8, E.dock[1] - 4]);
  b += text(28, 366, 'at a second site', 'sm b purple', 'start') + leader([150, 352], [E.pit[0] + Math.cos(a) * 16, E.pit[1] + Math.sin(a) * 16 + 4]);
  b += text(240, 400, 'an inhibitor slows the enzyme', 'sm b');
  return b;
}

/* ---------- Step 9: an allosteric enzyme ---------- */
const G3 = frame({ yB: 386, y100: 218, top: 176 });
function allostericStill() {
  const G = G3, A = alloEnz(132, 86, 0.95);
  let b = A.svg;
  b += A.docks.map(d => peg(d[0], d[1], A.k)).join('');
  b += text(452, 54, 'two active sites', 'sm b', 'end') + leader([310, 62], [A.docks[1][0] + 8, A.docks[1][1]]);
  b += text(452, 132, 'allosteric site', 'sm b', 'end') + leader([310, 126], [A.site[0] + 6, A.site[1] + 2]);
  b += G.axes();
  b += curve(G.pts(params({ comp: ALLO_K - 1 })), { role: 'ref' });
  b += `<g data-part="allosteric">${live(G, params({ allosteric: true }))}</g>`;
  b += text(G.x1 - 12, G.gy(100) - 8, 'this allosteric enzyme: an S', 'sm b blue', 'end');
  b += text(G.x1 - 12, G.gy(48), 'plain enzyme: a bend', 'xs b', 'end');
  return b;
}

/* ---------- What changes it: a small picture of the mechanism over the graph ---------- */
const GC = frame({ yB: 374, y100: 206, top: 162 });
const LEG_Y = 24;
function changeScene(kind) {
  const C = CHANGES[kind];
  return {
    duration: C.duration || 3600,
    stages: C.stages,
    render(t) {
      const e = ease.inOut(span(t, C.from ?? 0.15, 0.85)), set = C.at(e, t), p = params(set), p0 = params(C.normal || {});
      let b = C.top(e, t) + GC.axes(C.ticks || [[100, 'max'], [50, 'half']]);
      b += ghostCurve(GC, p0);
      b += C.graph(p, p0, e, t);
      const ro = C.readout(e);
      return { svg: svg(C.label, b, { h: 410 }), readout: readout(ro) };
    },
  };
}
// A falling ceiling (noncompetitive, irreversible): an arrow at the right edge from the old ceiling to the new,
// its words left of it at level wy, between the ghost (above) and the live curve (below); the Km line holds.
function ceilingDrop(p, e, words, wy) {
  let b = hline(GC.x0, GC.x1 - 12, GC.gy(100)) + `<g data-part="vmax">${hline(GC.x0, GC.x1 - 12, GC.gy(p.vmax))}</g>`;
  b += live(GC, p);
  const x = GC.gx(1), ax = GC.gx(9.7);
  b += `<g data-part="km">${vline(x, GC.gy(50) + 8, GC.yB, 1.5, '4 4')}${marker(x, GC.gy(50), { kind: 'ring', col: P.ui.ghost })}${marker(x, GC.gy(p.vmax / 2), { col: BLUE })}${text(x, GC.yB + 22, 'Km: same', 'sm b blue')}</g>`;
  if (p.vmax < 88) b += `<g data-delta ${fade(span(e, 0.3, 0.7))}>${arrowFixed([ax, GC.gy(100) + 4], [ax, GC.gy(p.vmax) - 6], { col: BLUE, w: 3.5 })}${text(ax - 12, GC.gy(wy) + 6, words, 'sm b blue', 'end')}</g>`;
  return b;
}
const dir = (v, v0, tol = 0.01) => v > v0 * (1 + tol) ? 'up' : v < v0 * (1 - tol) ? 'down' : 'same';
const CHANGES = {
  competitive: {
    stages: [[0, 'the inhibitor arrives'], [0.15, 'it takes turns in the site']],
    label: 'Top: an enzyme with a purple competitive inhibitor, shaped like the substrate, in its active site, and a golden substrate waiting its turn. Below: the speed curve slides right of the dashed normal curve; the ceiling is the same, and half speed now needs three times as much substrate.',
    at: e => ({ comp: LESSON.competitive * e }),
    top: e => {
      const E = enz(84, 92, 0.95);
      return E.svg + peg(E.dock[0], E.dock[1] - (1 - e) * 46, E.k, DRUG, { part: 'drug', op: Math.min(1, e * 3 + 0.2) }) + peg(160, 66, E.k, SUB, { rot: 25 })
        + text(198, 74, 'takes turns with the substrate', 'sm b purple', 'start') + text(198, 98, 'in the active site', 'xs muted', 'start');
    },
    ticks: [[50, 'half']],
    graph: (p, p0, e) => {
      let b = `<g data-part="vmax">${hline(GC.x0, GC.x1 - 12, GC.gy(100))}${text(GC.x1 - 12, GC.gy(100) - 10, 'same ceiling', 'sm b', 'end')}</g>`;
      b += live(GC, p);
      const y = GC.gy(50), xk = GC.gx(p.km);
      b += `<g data-part="km">${marker(GC.gx(1), y, { kind: 'ring', col: P.ui.ghost })}${marker(xk, y, { col: BLUE })}${vline(xk, y + 8, GC.yB, 1.5, '4 4')}</g>`;
      // the words sit under the live curve, right of its new half-speed point, where the curve is above them
      if (e > 0.35) b += `<g data-delta ${fade(span(e, 0.35, 0.7))}>${xk - GC.gx(1) > 24 ? arrowFixed([GC.gx(1) + 8, y], [xk - 8, y], { col: BLUE, w: 3.5 }) : ''}${text(GC.gx(3) + 14, y + 30, 'Km rises:', 'sm b blue', 'start')}${text(GC.gx(3) + 14, y + 52, 'the curve slides right', 'sm b blue', 'start')}</g>`;
      return b;
    },
    readout: e => [['Ceiling', 'same', 'same'], ['Km', dir(1 + LESSON.competitive * e, 1), e > 0.99 ? 'three times normal' : 'rising']],
  },
  noncompetitive: {
    stages: [[0, 'the inhibitor binds the second site'], [0.15, 'enzymes switch off']],
    label: 'Top: an enzyme with substrate in its active site and a purple noncompetitive inhibitor at its second site; the enzyme is switched off. Below: the speed curve flattens under the dashed normal curve to half the ceiling, while half of the new ceiling comes at the same substrate level: the Km is unchanged.',
    at: e => ({ nonc: LESSON.noncompetitive * e }),
    top: e => {
      const E = enz(96, 86, 0.95, { second: true, off: e });
      const a = Math.atan2(E.pit[1] - 86, E.pit[0] - 96);
      return E.svg + peg(E.dock[0], E.dock[1], E.k) + `<g ${fade(Math.min(1, e * 3 + 0.2))}>${wedge(E.pit, a, 1.15, { away: 30 * (1 - e) })}</g>`
        + text(176, 74, 'binds a second site:', 'sm b purple', 'start') + text(176, 98, 'switched off, substrate or not', 'xs muted', 'start');
    },
    graph: (p, p0, e) => ceilingDrop(p, e, 'ceiling falls to half', 70),
    readout: e => [['Ceiling', 'down', e > 0.99 ? 'half of normal' : 'falling'], ['Km', 'same', 'same']],
  },
  irreversible: {
    duration: 4600,
    from: 0.1,
    stages: [[0, 'the inhibitor arrives'], [0.1, 'it bonds one enzyme after another']],
    label: 'Top: a row of eight enzyme molecules; one by one, six of them take a purple irreversible inhibitor bonded for good into the active site and switch off. Below: the speed curve falls under the dashed normal curve to a quarter of the ceiling, with the Km unchanged.',
    at: e => ({ lost: Math.round(8 * LESSON.irreversible * e) / 8 }),
    top: e => {
      const n = Math.round(8 * LESSON.irreversible * e);
      const order = [1, 6, 3, 0, 5, 7, 2, 4];
      let b = '';
      for (let i = 0; i < 8; i++) {
        const x = 48 + i * 55, hit = order.indexOf(i) < n, E = enz(x, 80, 0.52, { off: hit ? 1 : 0 });
        b += E.svg + (hit ? peg(E.dock[0], E.dock[1], E.k, DRUG, { part: 'drug', bond: true }) : '');
      }
      return b + text(16, 30, `bonded for good: ${n} of 8 enzymes`, 'sm b purple', 'start');
    },
    graph: (p, p0, e) => ceilingDrop(p, e, 'ceiling falls to a quarter', 56),
    readout: e => { const n = Math.round(8 * LESSON.irreversible * e); return [['Ceiling', n ? 'down' : 'same', `${8 - n} of 8 left`], ['Km', 'same', 'same']]; },
  },
  modulators: {
    stages: [[0, 'modulators bind the allosteric site'], [0.15, 'the S slides']],
    label: 'Top: an allosteric enzyme with a purple modulator at its allosteric site. Below: from the dashed normal S-shaped curve, a positive modulator slides the curve left, halving the substrate needed for half speed, and a negative modulator slides it right, doubling it. The ceiling is the same.',
    normal: { allosteric: true },
    at: e => ({ allosteric: true, mod: lerp(1, LESSON.brake, e) }),
    top: e => {
      const A = alloEnz(110, 78, 0.85, { part: 'enzyme', sitePart: 'second-site' });
      return A.svg + A.docks.map(d => peg(d[0], d[1], A.k)).join('') + `<g ${fade(Math.min(1, e * 3 + 0.2))}>${drugAt('ring', [A.site[0], A.site[1] + 15 + 26 * (1 - e)], 0.9, 'modulator')}</g>`
        + text(212, 74, 'a modulator binds', 'sm b purple', 'start') + text(212, 98, 'the allosteric site', 'xs muted', 'start');
    },
    graph: (p, p0, e) => {
      const up = params({ allosteric: true, mod: lerp(1, LESSON.activator, e) });
      let b = live(GC, up, BLUE) + live(GC, p, RED);
      const y = GC.gy(50), k0 = p0.km;
      b += marker(GC.gx(k0), y, { kind: 'ring', col: P.ui.ghost });
      b += `<g data-part="modulator">${marker(GC.gx(up.km), y, { col: BLUE })}${marker(GC.gx(p.km), y, { col: RED })}</g>`;
      // arrows run along the half-speed line, from the normal point to each new one
      if (e > 0.35) {
        b += `<g data-delta ${fade(span(e, 0.35, 0.7))}>${GC.gx(k0) - GC.gx(up.km) > 26 ? arrowFixed([GC.gx(k0) - 8, y], [GC.gx(up.km) + 9, y], { col: BLUE, w: 3 }) : ''}${GC.gx(p.km) - GC.gx(k0) > 26 ? arrowFixed([GC.gx(k0) + 8, y], [GC.gx(p.km) - 9, y], { col: RED, w: 3 }) : ''}</g>`;
        b += `<g ${fade(span(e, 0.5, 0.85))}>${text(GC.gx(0.5), GC.gy(100) - 12, 'positive: slides left', 'sm b blue', 'start')}${text(GC.x1 - 12, GC.gy(10), 'negative: slides right', 'sm b red', 'end')}</g>`;
      }
      return b;
    },
    ticks: [[50, 'half']],
    readout: e => [['Half speed', e > 0.01 ? 'both' : 'same', e > 0.99 ? 'at half or twice' : 'moving'], ['Ceiling', 'same', 'same']],
  },
};

/* ---------- Scenes, one per step kind ---------- */
const still = (label, draw, h) => () => svg(label, draw(), { h });
const scenes = {
  enzyme: still('A lilac enzyme protein with a pocket at its top. On the left a golden substrate molecule, shaped like a peg, heads toward it; on the right the product, the peg split into two paler halves, leaves. The enzyme itself is not used up.', enzymeStill, 404),
  site: { duration: 3000, rest: 1, render: t => svg('A large enzyme with a peg-shaped pocket, the active site, at its top. A golden substrate peg drifts down and settles into the pocket, which fits its shape. A grey molecule of the wrong shape sits apart: it has no pocket to fit.', sitePicture(t), { h: 410 }) },
  cycle: { duration: 4400, loop: true, rest: 0.4, stages: [[0, 'bind'], [0.32, 'change'], [0.5, 'let go']], render: t => svg('One enzyme working through a cycle: a golden substrate binds in the active site, the enzyme glows as it changes the substrate, the product leaves as two paler halves, and the unchanged enzyme is ready as the next substrate arrives.', cyclePicture(t), { h: 410 }) },
  busy: { duration: 4200, render: t => svg('Eight enzymes in two rows with golden substrate molecules around them. As the substrate rises from a little to a lot, more enzymes hold one in their active site, from 1 of 8 to 7 of 8, and a blue speed bar beside them rises with the busy count.', busyPicture(t), { h: 404 }) },
  curve: { duration: 4200, render: t => svg('A graph of speed against substrate. A blue curve climbs steeply from zero, then bends and flattens, approaching a dotted line at the maximum speed, where nearly every enzyme is busy.', curvePicture(t), { h: 400 }) },
  km: still('The speed curve again. A dotted line at half the maximum speed meets the curve; from that point a dotted line drops to the substrate axis at the Km, where half the enzymes are busy.', kmStill, 400),
  amount: { duration: 3400, render: t => svg('A graph of speed against substrate with twice the enzyme. The blue curve rises above the dashed normal curve to a ceiling twice as high. A dotted line at the same substrate level, the Km, marks half speed for both curves: the Km is unchanged.', amountPicture(t), { h: 400 }) },
  inhibitor: still('A large enzyme. A purple inhibitor shaped like the substrate sits in its active site at the top; a second, wedge-shaped purple inhibitor binds a pit on its lower left, a second site away from the active site.', inhibitorStill, 410),
  allosteric: still('At the top, an allosteric enzyme: two linked lilac parts, each with an active site holding a substrate, and an allosteric site in the cleft between them. Below, its speed curve is S-shaped in blue, beside the plain bend of an ordinary enzyme in thin black.', allostericStill, 410),
  competitive: changeScene('competitive'),
  noncompetitive: changeScene('noncompetitive'),
  irreversible: changeScene('irreversible'),
  modulators: changeScene('modulators'),
};

/* ---------- Explore freely ---------- */
const ui = () => ({ kind: $('#kind'), substrate: $('#substrate'), enzyme: $('#enzyme'), plot: $('#plot'), comp: $('#comp'), nonc: $('#nonc'), lost: $('#lost'), mod: $('#mod') });
function settings() {
  const u = ui(), allosteric = u.kind.value === 'allosteric';
  return { enzyme: +u.enzyme.value / 100, comp: +u.comp.value, nonc: +u.nonc.value, lost: +u.lost.value / 100, allosteric, mod: allosteric ? +u.mod.value : 1 };
}
const subLevel = () => +ui().substrate.value;
const pc = x => `${Math.round(x)}%`;
const times = x => `${x.toFixed(x < 10 ? 1 : 0)} times`;
function speedGraph(set, s, { G = G1, note = '', mark = 'the substrate you chose' } = {}) {
  const p = params(set), p0 = params({ allosteric: set.allosteric });
  const top = Math.max(100, p.vmax);
  const g = top > 104 ? frame({ yB: G.yB, y100: G.yB - (G.yB - G.y100) * 100 / top, top: G.top }) : G;
  let b = g.axes();
  b += ghostCurve(g, p0);
  b += `<g data-part="vmax">${hline(g.x0, g.x1 - 12, g.gy(p.vmax))}</g>`;
  b += live(g, p);
  const x = g.gx(clamp(s, 0, S_MAX)), y = g.gy(speed(s, p));
  b += vline(x, y + 8, g.yB, 1.25, '3 4');
  b += marker(x, y, { col: BLUE });
  b += text(g.x1 - 12, g.gy(p.vmax) - 10, `ceiling ${pc(p.vmax)}`, 'xs b', 'end');
  const lx = x > 300 ? x - 8 : x + 8;
  b += text(lx, g.yB - 12, mark, 'xs muted', x > 300 ? 'end' : 'start');
  if (note) b += text(16, 26, note, 'xs b', 'start');
  return b;
}
// The double-reciprocal graph: one over speed (in units of one over the normal maximum) against one over substrate.
function doubleGraph(set) {
  const p = params(set), p0 = params({ allosteric: set.allosteric });
  const X0 = 40, X1 = 456, Y0 = 380, Y1 = 60, xMin = -2, xMax = 5, yMax = 12;
  const hx = u => X0 + (u - xMin) / (xMax - xMin) * (X1 - X0), hy = w => Y0 - w / yMax * (Y0 - Y1);
  const ox = hx(0), oy = hy(0);
  const inv = q => u => { const sp = speed(1 / u, q); return 100 / sp; };
  const ptsOf = q => {
    const out = [];
    if (q.n === 1) { const u0 = Math.max(xMin, -1 / q.km); for (let i = 0; i <= 40; i++) { const u = lerp(u0, xMax, i / 40), w = (q.km * u + 1) * 100 / q.vmax; if (w <= yMax) out.push([hx(u), hy(w)]); } }
    else for (let i = 1; i <= 60; i++) { const u = i / 60 * xMax, w = inv(q)(u); if (w <= yMax) out.push([hx(u), hy(w)]); }
    return out;
  };
  let b = `<path d="M${X0} ${f(oy)} H${X1}" stroke="${INK}" stroke-width="1.5"/><path d="M${f(ox)} ${Y0} V${Y1}" stroke="${INK}" stroke-width="1.5"/>`;
  b += text(X1, oy + 26, 'one over substrate', 'xs b', 'end') + text(ox + 8, Y1 + 4, 'one over speed', 'xs b', 'start');
  const g0 = ptsOf(p0), g1 = ptsOf(p);
  if (g0.length > 1) b += `<g data-ghost="normal">${curve(g0, { role: 'ghost' })}</g>`;
  if (g1.length > 1) b += curve(g1, { role: 'live', col: BLUE });
  if (p.n === 1) {
    b += marker(ox, hy(100 / p.vmax), { col: BLUE });
    if (-1 / p.km >= xMin) b += marker(hx(-1 / p.km), oy, { kind: 'ring', col: BLUE });
    b += text(ox - 8, hy(100 / p.vmax) - 10, 'one over the ceiling', 'xs muted', 'end');
    if (-1 / p.km >= xMin) b += text(hx(-1 / p.km), oy + 26, 'minus one over Km', 'xs muted', 'start');
  } else b += text(X1, Y1 + 30, 'allosteric: the line curves', 'xs b', 'end');
  return b;
}
function describe(set, s) {
  const p = params(set), v = speed(s, p);
  return `speed ${pc(v)} of the normal maximum at substrate ${s.toFixed(1)} times the normal Km; ceiling ${pc(p.vmax)}; half speed at ${p.km.toFixed(2)} times the normal Km`;
}
function renderExplore() {
  const u = ui(), set = settings(), s = subLevel(), p = params(set), v = speed(s, p), p0 = params({ allosteric: set.allosteric });
  const body = u.plot.value === 'double' ? doubleGraph(set) : speedGraph(set, s);
  $('#explore-visual').innerHTML = svg(`${u.plot.value === 'double' ? 'Double-reciprocal graph' : 'Speed against substrate'}, over a dashed curve for the normal enzyme: ${describe(set, s)}.`, body, { h: 410 });
  $('#substrate-out').textContent = `${s.toFixed(1)} times the normal Km`;
  $('#enzyme-out').textContent = `${u.enzyme.value}% of normal`;
  $('#comp-out').textContent = +u.comp.value ? `strength ${u.comp.value}: Km times ${1 + +u.comp.value}` : 'none';
  $('#nonc-out').textContent = +u.nonc.value ? `strength ${u.nonc.value}: ceiling divided by ${1 + +u.nonc.value}` : 'none';
  $('#lost-out').textContent = +u.lost.value ? `${u.lost.value}% of the enzyme bonded` : 'none';
  $('#mod-out').textContent = set.allosteric ? u.mod.selectedOptions[0].textContent.toLowerCase() : 'allosteric enzyme only';
  const busy = speed(s, p) / (100 * set.enzyme);
  const rows = [
    ['Speed at this substrate level', `${pc(v)} of the normal maximum (normal enzyme here: ${pc(speed(s, p0))})`],
    ['Ceiling (maximum speed)', pc(p.vmax)],
    [set.allosteric ? 'Substrate for half speed' : 'Km (substrate for half speed)', `${p.km.toFixed(2)} times the normal Km`],
    ['Enzyme molecules busy', `${Math.round(busy * 100)}%`],
  ];
  $('#model-results').innerHTML = rows.map(([k, x]) => `<b>${esc(k)}:</b> <span data-model="${esc(k)}">${esc(x)}</span>`).join(' · ') + '.';
}
function wireExplore() {
  const u = ui();
  for (const el of [u.substrate, u.enzyme, u.comp, u.nonc, u.lost]) el.addEventListener('input', () => { syncState(); update(); });
  for (const el of [u.kind, u.mod, u.plot]) el.addEventListener('change', () => { u.mod.disabled = u.kind.value !== 'allosteric'; syncState(); update(); });
  $('#reset').addEventListener('click', () => { resetControls(); syncState(); update(); });
}
function resetControls() {
  const u = ui();
  u.kind.value = 'plain'; u.substrate.value = 1; u.enzyme.value = 100; u.comp.value = 0; u.nonc.value = 0; u.lost.value = 0; u.mod.value = '1'; u.mod.disabled = true;
}

/* ---------- Clinical values ---------- */
let cv = null, selectedState = 'baseline';
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
function scaleFor(v) {
  if (Array.isArray(v.scale)) return v.scale;
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = hi - lo || Math.abs(hi) * 0.4;
  const pad = v.low != null && v.high != null ? sp * 1.1 : sp * 0.9;
  return [lo - pad, hi + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, x) {
  const shown = +fmtV(v, x);
  if (v.low != null && v.high != null) return shown < v.low ? 'below the typical range' : shown > v.high ? 'above the typical range' : 'inside the typical range';
  const rel = (x - v.typical) / v.typical;
  return Math.abs(rel) < 0.03 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value';
}
// The teaching model read as a liver enzyme clearing a drug, under the data file's modelAssumptions: the drug's
// level (modelBaseline.substrate) is far below the Km, this enzyme does all the clearing, elimination is first
// order and the volume of distribution holds. Clearance then scales with the enzyme's speed there compared with
// normal (r), and after n usual half-lives (each row's after.halfLives) the share left is one half to the
// power n x r. At r = 1 that gives each row's cited value.
function clearanceModel(set) {
  const s0 = cv.modelBaseline.substrate, r = clamp(speed(s0, params(set)) / speed(s0, params({ allosteric: set.allosteric })), 0, 4);
  return { r, at: v => 100 * (1 - 0.5 ** ((v.after?.halfLives ?? 1) * r)) };
}
const PREDICT = { up: '↑ Model predicts a rise', down: '↓ Model predicts a fall', none: '↔ Model predicts no change' };
// Model settings the Clinical values tab can apply: the lesson's own settings, not cited states.
const TRY = { none: {}, competitive: { comp: LESSON.competitive }, noncompetitive: { nonc: LESSON.noncompetitive }, irreversible: { lost: LESSON.irreversible }, more: { enzyme: LESSON.more } };
function setControls(m) {
  const u = ui();
  resetControls();
  if (m.comp != null) u.comp.value = m.comp;
  if (m.nonc != null) u.nonc.value = m.nonc;
  if (m.lost != null) u.lost.value = Math.round(m.lost * 100);
  if (m.enzyme != null) u.enzyme.value = Math.round(m.enzyme * 100);
  // both selectors follow the settings now in force
  syncState(); update();
}
const applyTry = key => setControls(TRY[key] || {});
function stateSettings(st) { return { ...NORMAL, ...(st?.model || {}) }; }
function syncState() {
  if (!cv) return;
  const set = settings();
  const same = (a, b) => ['enzyme', 'comp', 'nonc', 'lost', 'mod'].every(k => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 1e-9) && !!a.allosteric === !!b.allosteric;
  const hit = cv.states.find(st => same(set, stateSettings(st)));
  selectedState = hit ? hit.id : 'custom';
  $('#clinical-state').value = selectedState;
  const tried = Object.entries(TRY).find(([, m]) => same(set, { ...NORMAL, ...m }));
  $('#clinical-model').value = tried ? tried[0] : 'custom';
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id);
  if (st) setControls(st.model || {});
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-reset').addEventListener('click', () => applyState('baseline'));
  $('#clinical-model').addEventListener('change', e => applyTry(e.target.value));
  for (const v of cv.values) {
    const pos = posOf(v), range = v.low != null && v.high != null;
    const row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`;
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the cited range as a shaded band' : 'the cited typical value as a tick'}, and a blue marker for the teaching model`);
    const [lo, hi] = scaleFor(v);
    right.querySelector('.key').textContent = `${range ? `Cited range ${v.display} ${v.unit} (shaded)` : `Cited typical value ${v.display} ${v.unit} (tick; no range given)`} · bar runs ${fmtV(v, lo)} to ${fmtV(v, hi)} · blue line: model`;
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const a of cv.modelAssumptions || []) {
    const li = document.createElement('li');
    li.textContent = a;
    $('#model-assumptions').append(li);
  }
  for (const [id, citation] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    li.textContent = `[${id}] ${citation}`;
    $('#sources').append(li);
  }
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = false; });
}
function renderClinical() {
  if (!cv) return;
  const set = settings(), m = clearanceModel(set), s0 = cv.modelBaseline.substrate;
  $('#clinical-visual').innerHTML = svg(`The teaching model's enzyme read as a liver enzyme clearing a drug: its speed curve over a dashed normal curve, with a dot at the drug level the model assumes, far below the Km. Under the model's assumptions the enzyme clears the drug at ${pc(100 * m.r)} of its normal rate there.`, speedGraph(set, s0, { mark: 'assumed low drug level', note: `model: drug cleared at ${pc(100 * m.r)} of the normal rate` }), { h: 410 });
  const st = cv.states.find(s => s.id === selectedState);
  $('#state-summary').textContent = st ? `${st.label}: ${st.summary}` : `The teaching model with the enzyme changed (illustrative): under its assumptions the drug is cleared at ${pc(100 * m.r)} of the normal rate. These settings are not a cited state, so no directions are shown.`;
  const ev = st?.evidence?.length ? st.evidence.map(q => `<p>“${esc(q.excerpt)}” <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') : st ? `<p>${esc(st.where)} <span>[${esc(st.source)}]</span></p>` : '';
  $('#state-evidence').innerHTML = st ? `${ev}${st.context ? `<p>${esc(st.context)}</p>` : ''}` : '<p>Model settings only: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    if (!v.modelKey) continue;
    const x = m.at(v);
    row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    // a cited shift, else the model's own prediction (labelled as such), else nothing stated
    const dirEl = row.querySelector('.direction'), d = st?.shifts?.[v.id], pr = st?.modelPrediction?.[v.id];
    dirEl.textContent = !st ? '' : d ? `${DIRECTION[d]} (${st.label.split(' (')[0].toLowerCase()}, cited)`
      : pr ? `No cited direction. ${PREDICT[pr]} (illustrative, under its assumptions)` : 'No direction stated by the cited source';
    dirEl.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = true; });
  wireExplore();
  resetControls();
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const k of ['substrate']) if (typeof data.modelBaseline?.[k] !== 'number') throw new Error(`no ${k}`);
    cv = data;
    buildClinical();
  } catch (err) {
    cv = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson and Explore freely work without it.`;
  }
  syncState();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
