// The Lab's hearts (art direction section 4.2; ART-REFERENCE.svg-notes.md, revision 2).
//
//   leftHeart(opts) / mountLeftHeart(g, ctx, opts): the left heart in long axis, a separate drawing (not a
//     crop of the section): left atrium with two pulmonary veins, mitral valve with chordae and papillary
//     muscles, a thick-walled conical left ventricle with its apex down and to the viewer's right, aortic
//     valve, aortic root with sinuses, ascending aorta and arch cut end-on where it turns back (the descending
//     aorta is not drawn),
//     and the right ventricle as a fixed crescent beyond the septum. Moved by set({ volume, mitral, aortic,
//     squeeze, inflow, outflow, phase, pressure }).
//   lvGeometry: the left heart's model contract, for lessons and tests.
//   heartSection(opts): the four-chamber frontal section with the aortic root opened, a string primitive.
//   sectionGeometry: its cavity area tables and landmarks.
//   heartConduction(opts): the conducting system as an overlay in the section's box (heartSection draws it
//     too with { conduction }).
//   heartExterior(opts): the heart from the front; heartIcon(opts): a small recognisable heart.
//
// Expected behaviour (tested by tools/lab-art-test.mjs, looked at in tools/lab-art-gallery.html):
//   - The apex is pinned, inside and out. Long-axis shortening is the annular plane (both annuli, the
//     atrial floor and the root's base) descending toward it as the ventricle empties: about 15 units at
//     the normal end-systolic volume. The atrial roof, the root above the sinotubular junction and every
//     vessel stay fixed.
//   - The cavity is the long-axis cut of a half ellipsoid whose volume (long axis x short axis squared)
//     is in proportion to the model's volume over 0.30 to 1.25 of the normal end-diastolic volume
//     (opts.edv mL draws volume fraction 1); a 64-sample table is inverted per frame, nothing is solved
//     per frame. At the normal end-systolic volume the short axis is about two thirds of its full width. At
//     every volume it is a cone: each side narrows without an inflection from its widest point to the
//     apex, whose endocardial point is the cavity's deepest, on the long axis.
//   - The wall keeps its muscle volume (the same half ellipsoid's shell; a thickness table h(size) built
//     once), so it thickens as it empties, about one and a half times at end-systole; the septum is drawn
//     at the free wall's thickness (its right-ventricular face moves with it, and the right ventricle's
//     cavity lies on that face), and the apical cap is the thinnest.
//   - Open leaflet tips and papillary heads stay at least 6 units inside the cavity at every volume the
//     model produces. The papillary muscles are cones tapering 1.6 : 1 from a base that grows out of the
//     cut face (filled with the wall's own cut gradient, no line across it) to a rounded head: the
//     anterolateral from the free wall, the posteromedial from the inferior wall low on the septal side,
//     beyond where the right ventricle (so the septum) ends. Chordae do not stretch: with the valve shut
//     every chord is taut, so straight (each muscle's pose, length and angle, is solved once per size so
//     all its chords are taut together); open, the same chords hang slack. The muscles shorten and
//     fatten in systole, turn away from a wall that comes in on them, may touch but never cross, and
//     never pass the endocardium. The mitral leaflets are filled,
//     tapered sails, the anterior about 1.7 times the posterior; shut, they meet 4 to 6 units below the
//     annulus; shut aortic cusps overlap along a coaptation edge.
//   - The arch ends in an end-on cut face where it turns back away from the viewer, above the atrium and
//     clear of it: no aorta geometry overlaps the atrium, and there is no descending aorta, stub or seam.
//   - light(test) on a mounted heart dims every other piece in place: the painted order never changes.
//   - Blood in the left heart is always oxygenated red; pressure is not coded as colour (set() accepts
//     pressure and writes it to data-pressure for a lesson's own gauge).
//   - Parts are leaves (never nested): atrium (with the pulmonary veins), mitral, ventricle, aortic,
//     aorta, rv; rename with opts.parts, e.g. { atrium: 'la' }. Valves are emphasised by default, so they
//     keep every detail level.
import {
  P, SW, D2, D3, f, pt, uid, artOf, smooth, flatten, samplePath, pathLength, areaOf, pointInPolygon, distToPolygon, tube, cutFace,
  volumeGradient, cutGradient, behind, streamline, chevronD, artGhost, lerpPath, sampleAlong, innerShadow, activationWash,
  fill, spec,
} from './core.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = a => Math.hypot(a[0], a[1]);
const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(j => u * u * u * p0[j] + 3 * u * u * t * p1[j] + 3 * u * t * t * p2[j] + t * t * t * p3[j]); };
const bezD = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(j => 3 * u * u * (p1[j] - p0[j]) + 6 * u * t * (p2[j] - p1[j]) + 3 * t * t * (p3[j] - p2[j])); };
const smoothstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const easeIO = x => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const nameOf = (parts, n) => [...new Set(n.split(' ').map(k => parts[k] || k))].join(' ');
const partAttr = (parts, n) => `data-part="${nameOf(parts, n)}"`;

/* =====================================================================================================
   The left heart, long axis
   Local frame: u along the long axis from the base centre B toward the apex, v across it (positive toward
   the free wall, the viewer's right). Page = B + u U + v N. Box 196 x 238, top-left (native origin LH_O).
   ===================================================================================================== */
// The drawing lives in native coordinates; its box (the art plus a small margin) starts at LH_O.
const LH_O = [58, 17], LH_W = 196, LH_H = 238;
const B = [114, 125];
const U = unit([51.6, 97.1]);                 // long axis, about 28 degrees from vertical
const N = [U[1], -U[0]];                      // toward the free wall
const toPage = ([u, v]) => [B[0] + u * U[0] + v * N[0], B[1] + u * U[1] + v * N[1]];
const pg = q => pt(toPage(q));
const APEX = [125, 0];                        // epicardial apex, pinned
const EU = 114;                               // the endocardial apex, pinned too: the apical wall is the thinnest
const H_REF = 13.5;                           // free-wall thickness at area fraction 1
// Fixed fibrous base: aortic annulus A0 (septal hinge) to A1, aortomitral curtain A1 to M0, mitral annulus M0 to M1.
const A0 = [-4, -31], A1 = [-1.6, -11], M0 = [-1.2, -7], M1 = [3, 29];
// The reference cavity (size 1) is set by its equator: at u = Q_U the septal side is WS from the long
// axis and the free wall WL. Each side is two smooth pieces: from its basal hinge (A0 or M1) to the
// equator, and from the equator round to the endocardial apex E, which is pinned on the long axis.
const Q_U = 52, WS = 38, WL = 42;
// The septum's right-ventricular face: from under the aortic annulus to the apex. Its base follows the
// annular plane down (the apex stays put), so the RV face only ever shortens.
const SEPT_O = { s0: [-15, -35], s1: [[12, -46], [34, -51], [52, -51.5]], s2: [[84, -51.5], [125, -25], APEX] };
const M1O = [6, 41];                          // the free wall's outer corner at the atrioventricular groove

// Long-axis shortening is the annular plane moving toward the pinned apex (mitral annular plane
// systolic excursion): the cavity is scaled along the axis about its own apex, so the base descends by
// EU (1 - along). At the normal end-systolic size the plane is about 15 units (11 mm) lower, the long
// axis about 13 % shorter. A cavity larger than the reference grows across only (a dilated ventricle
// grows rounder), so the base never rises into the atrium.
const K_LONG = 0.3;
const alongL = p => clamp(1 - K_LONG * (1 - p), 0.8, 1);
// Across, the equator narrows about a neutral line at VC, so the septum moves in less than the free
// wall and the two walls keep one thickness (VC is chosen for that: septum / free wall stays within 0.8
// to 1.25 from 0.30 to 1.25).
const VC = -8;
// One side of the cavity in |v| form (w, the distance from the long axis), as cubic control points:
// toQ from the basal hinge to the equator Q = [uq, w], toE from Q round to the apex E = [EU, 0].
// A normal ventricle empties as a smaller cone, so each side is drawn without an inflection: when the
// equator is narrower than the hinge (an emptied ventricle) the side runs straight in from the hinge
// and then curves round to the apex; it never pinches mid-cavity and bulges again lower down (the
// hourglass and apical pouch of mid-ventricular obstruction). toQ is a cubic Hermite piece whose end
// slopes keep it concave; toE meets it with the same slope and ends square to the axis at the apex,
// which is therefore the cavity's deepest point.
function sideLocal(base, uq, w, a, b0) {
  const L = EU - uq, c = (w - base[1]) / (uq - base[0]), s = Math.min(0, c);
  const b = Math.min(b0, 0.8 * (1 + s * L / w));
  const m0 = lerp((3 * c - s) / 2, 3 * c - 2 * s, 0.1), h = (uq - base[0]) / 3;
  return {
    toQ: [[base[0] + h, base[1] + h * m0], [uq - h, w - h * s], [uq, w]],
    toE: [[uq + a * L, w + a * L * s], [EU, b * w], [EU, 0]],
  };
}
// The cavity at size p (p = 1 is the reference), in local coordinates.
function cavityLocal(p) {
  const al = alongL(p), ac = p / al, d = EU * (1 - al);
  const fx = ([u, v]) => [u + d, v], uq = Q_U * al + d;
  const ws = -(VC + (-WS - VC) * ac), wl = VC + (WL - VC) * ac;
  const A0_ = fx(A0), M1_ = fx(M1);
  const S = sideLocal([A0_[0], -A0_[1]], uq, ws, 0.42, 0.42), Lt = sideLocal(M1_, uq, wl, 0.484, 0.38);
  const neg = ([u, w]) => [u, -w];
  const c = {
    A0: A0_, A1: fx(A1), M0: fx(M0), M1: M1_,
    s1: S.toQ.map(neg), s2: S.toE.map(neg),
    l1: [Lt.toE[1], Lt.toE[0], Lt.toQ[2]], l2: [Lt.toQ[1], Lt.toQ[0], M1_],
  };
  c.E = c.s2[2]; c.QS = c.s1[2]; c.QL = c.l1[2]; c.al = al; c.ac = ac; c.p = p; c.d = d;
  return c;
}
const cavitySegs = c => [[c.A0, ...c.s1], [c.QS, ...c.s2], [c.E, ...c.l1], [c.QL, ...c.l2]];
function cavityPoly(c, k = 14) {
  const out = [];
  for (const s of cavitySegs(c)) for (let i = 0; i < k; i++) out.push(bez(s[0], s[1], s[2], s[3], i / k));
  out.push(c.M1, c.M0, c.A1);
  return out;
}
const cavityWallD = c => `M${pg(c.A0)} C${c.s1.map(pg).join(' ')} C${c.s2.map(pg).join(' ')} C${c.l1.map(pg).join(' ')} C${c.l2.map(pg).join(' ')}`;
const cavityD = c => `M${pg(c.A0)} C${c.s1.map(pg).join(' ')} C${c.s2.map(pg).join(' ')} C${c.l1.map(pg).join(' ')} C${c.l2.map(pg).join(' ')} L${pg(c.M0)} L${pg(c.A1)} Z`;
// The outer contour for wall thickness h: each side of the endocardium offset by h, with the epicardial
// apex pinned. The septum is offset by the same h (its right-ventricular face moves with it, toward the
// left ventricle's centre as it squeezes), so septum and free wall always read as one thickness; its
// base stays on the annular plane under the aortic annulus.
function outerLocal(c, h) {
  const d = c.d, taper = ([u, v]) => [u + d * clamp(1 - u / APEX[0], 0, 1), v];
  const l1 = [[APEX[0], c.l1[0][1] + h], [c.l1[1][0] + 0.4 * h, c.l1[1][1] + h], [c.QL[0], c.QL[1] + h]];
  // the groove corner follows the wall in a little, so a thick systolic wall never kinks at the base
  const m1o = [M1O[0] + d, M1[1] + clamp(c.QL[1] + h - M1[1], 6, M1O[1] - M1[1])];
  const l2 = [[c.l2[0][0], c.l2[0][1] + h], [m1o[0] + 12, lerp(m1o[1], c.l2[0][1] + h, 0.4)], m1o];
  const s0 = taper(SEPT_O.s0);
  const s1 = [[c.s1[0][0] - 1, lerp(s0[1], c.s1[0][1] - h, 0.6)], [c.s1[1][0], c.s1[1][1] - h], [c.QS[0], c.QS[1] - h]];
  const s2 = [[c.s2[0][0] + 0.4 * h, c.s2[0][1] - h], [APEX[0], c.s2[1][1] - h], APEX];
  return { l1, l2, s0, s1, s2, M1o: m1o };
}
const outerRimD = o => `M${pg(o.s0)} C${o.s1.map(pg).join(' ')} C${o.s2.map(pg).join(' ')} C${o.l1.map(pg).join(' ')} C${o.l2.map(pg).join(' ')}`;
const outerD = (c, o) => `M${pg(o.s0)} C${o.s1.map(pg).join(' ')} C${o.s2.map(pg).join(' ')} C${o.l1.map(pg).join(' ')} C${o.l2.map(pg).join(' ')} L${pg(c.M1)} L${pg(c.M0)} L${pg(c.A1)} L${pg(c.A0)} Z`;
function outerPoly(o, k = 16) {
  const out = [];
  for (const s of [[o.s0, ...o.s1], [o.s1[2], ...o.s2], [APEX, ...o.l1], [o.l1[2], ...o.l2]]) for (let i = 0; i <= k; i++) out.push(bez(s[0], s[1], s[2], s[3], i / k));
  return out;
}

// Tables built once: area by size and the wall thickness that keeps the muscle's volume.
// Wall thickness comes from the muscle's VOLUME, not its area in this cut: the ventricle is taken as a
// half prolate ellipsoid (long axis Li from the annular plane to the endocardial apex, short axis Di
// across the mid cavity) inside a shell of thickness h, and the shell's volume
// (Li + h)(Di + 2h)^2 - Li Di^2 (times pi / 6) is held at its end-diastolic value. Holding the cut's
// AREA instead would barely thicken the wall once the long axis shortens at the base (as it does), and
// real systolic thickening (about one and a half times) comes from the short axis shrinking all round.
function axesOf(c) {
  const Li = EU - c.d + 4, u0 = c.d + 0.3 * (EU - c.d), u1 = c.d + 0.6 * (EU - c.d);
  const mid = cavityPoly(c, 48).filter(q => q[0] >= u0 && q[0] <= u1).map(q => q[1]);
  return { Li, Di: Math.max(...mid) - Math.min(...mid) };
}
const shellAxes = ({ Li, Di }, h) => (Li + h) * (Di + 2 * h) ** 2 - Li * Di * Di;
const shellOf = (c, h) => shellAxes(axesOf(c), h);
function wallForShell(c, M) {
  const ax = axesOf(c);  // measured once: the bisection only varies the wall
  let lo = 1, hi = 80;
  for (let k = 0; k < 34; k++) { const m_ = (lo + hi) / 2; if (shellAxes(ax, m_) < M) lo = m_; else hi = m_; }
  return (lo + hi) / 2;
}
// Mean wall thickness from samples of an endocardial run to a polyline of the outer surface.
function polyDist(p, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i], e = sub(b, a), L2 = e[0] * e[0] + e[1] * e[1] || 1, t = clamp(((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1]) / L2, 0, 1);
    best = Math.min(best, Math.hypot(p[0] - a[0] - e[0] * t, p[1] - a[1] - e[1] * t));
  }
  return best;
}
const runs = (segs, k = 8) => segs.flatMap(([s, t0, t1]) => Array.from({ length: k + 1 }, (_, i) => bez(...s, t0 + (t1 - t0) * i / k)));
// The mid septum and the mid free wall, away from the base corners and the apical cap.
const septalRun = c => runs([[[c.A0, ...c.s1], 0.35, 1], [[c.QS, ...c.s2], 0, 0.45]]);
const freeRun = c => runs([[[c.QL, ...c.l2], 0, 0.6], [[c.E, ...c.l1], 0.55, 1]]);
const meanDist = (pts, poly) => pts.reduce((a, p) => a + polyDist(p, poly), 0) / pts.length;
function wallsOf(c, o) {
  const outer = outerPoly(o, 20), rv = outer.slice(0, 42), free = outer.slice(42);
  return { septum: meanDist(septalRun(c), rv), free: meanDist(freeRun(c), free), apex: polyDist(c.E, outer) };
}
// The cavity is the long-axis cut of that same half ellipsoid, so the model's volume sets Li Di^2, not
// the cut's area: a cut whose AREA tracked volume would empty to a slit (at the normal end-systolic
// volume, 0.39 of full, its short axis would be under half its full width, a fractional shortening near
// 60 %), where a real ventricle's short axis shortens by about a third.
const volOf = c => { const { Li, Di } = axesOf(c); return Li * Di * Di; };
const TABLE = (() => {
  const P0 = 0.12, P1 = 1.4, n = 64, rows = [], c1 = cavityLocal(1), M = shellOf(c1, H_REF);
  for (let i = 0; i <= n; i++) {
    const p = P0 + (P1 - P0) * i / n, c = cavityLocal(p);
    rows.push({ p, h: wallForShell(c, M), vol: volOf(c), area: Math.abs(areaOf(cavityPoly(c, 40))) });
  }
  return { rows, M, ref: volOf(c1), refArea: Math.abs(areaOf(cavityPoly(c1, 40))) };
})();
function sizeForVolume(frac) {
  const a = frac * TABLE.ref, R = TABLE.rows;
  let i = 1;
  while (i < R.length - 1 && R[i].vol < a) i++;
  const r0 = R[i - 1], r1 = R[i], t = (a - r0.vol) / (r1.vol - r0.vol);
  return r0.p + (r1.p - r0.p) * t;
}
function rowAt(p) {
  const R = TABLE.rows, x = (p - R[0].p) / (R[1].p - R[0].p), i = clamp(Math.floor(x), 0, R.length - 2), t = clamp(x - i, 0, 1);
  return { i, t, h: lerp(R[i].h, R[i + 1].h, t) };
}
const wallFor = p => rowAt(p).h;
const cavityAt = p => cavityLocal(p);

// Where each moving piece is, for one state. Everything below is in local coordinates.
function poseLeft(st, opt = {}) {
  const edv = st.edv || opt.edv || 120;
  const frac = clamp((st.volume ?? edv) / edv, 0.2, 1.36);
  const p = sizeForVolume(frac), sq = clamp(st.squeeze || 0, 0, 1), { h } = rowAt(p);
  const c = cavityAt(p), o = outerLocal(c, h), poly = cavityPoly(c);
  return { c, h, o, poly, p, sq, d: c.d, frac, mitral: clamp(st.mitral || 0, 0, 1), aortic: clamp(st.aortic || 0, 0, 1) };
}
// Clearance from the cavity's walls (the valve plane is not a wall: leaflets hang from it).
const WALLS = poly => poly.slice(0, poly.length - 3);
function wallDist([x, y], walls) {
  let best = Infinity;
  for (let i = 1; i < walls.length; i++) {
    const [ax, ay] = walls[i - 1], [bx, by] = walls[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
const clear = (x, poly) => pointInPolygon(x, poly) ? wallDist(x, WALLS(poly)) : -distToPolygon(x, poly);
// An open leaflet's tip: its natural direction if that leaves m units of blood around it, else swung
// toward the middle of the cavity (sweep: +1 toward the free wall, -1 toward the septum), else shorter.
// Candidate (length, swing) pairs, most natural first.
// A negative swing (further toward its own wall, opening wider) is tried too, for a tip that must keep
// its distance from a papillary head.
const TIP_TRIES = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45].flatMap(k => Array.from({ length: 31 }, (_, i) => [k, i * 4 - 48]))
  .sort((x, y) => (Math.abs(x[1]) / 60 + (1 - x[0]) * 3) - (Math.abs(y[1]) / 60 + (1 - y[0]) * 3));
const rot = (v, deg) => { const a = deg * Math.PI / 180; return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; };
// Swung further toward the middle than SWING_IN degrees, an open leaflet would start to close the orifice.
const SWING_IN = 24;
function openTip(hinge, dir, L, sweep, poly, m = 7.5, keep = []) {
  // full length first: the most natural swing clear of the walls and of every keep point; else the
  // full-length swing clear of the walls, never in toward the middle, that keeps furthest from them; only a tip the walls leave no
  // room for is shortened (the most natural clear candidate, else the clearest)
  // (the clearance, the costly measure, is taken only where it can decide; the clearest of all is
  // searched for only when nothing else is found)
  let near = null, nearK = -Infinity, short = null;
  for (const [k, a] of TIP_TRIES) {
    if (a > SWING_IN || (k < 1 && short)) continue;
    const x = add(hinge, rot(dir, sweep * a), L * k);
    const ck = k < 1 ? 0 : Math.min(Infinity, ...keep.map(([q, r]) => len(sub(x, q)) - r));
    if (k === 1 && ck < 0 && (a > 0 || ck <= nearK)) continue;
    if (clear(x, poly) < m) continue;
    if (k < 1) { short = x; continue; }
    if (ck >= 0) return x;
    nearK = ck; near = x;
  }
  if (near || short) return near || short;
  let fall = null, fallC = -Infinity;
  for (const [k, a] of TIP_TRIES) { const x = add(hinge, rot(dir, sweep * a), L * k), cw = clear(x, poly); if (cw > fallC) { fallC = cw; fall = x; } }
  return fall;
}
// The width of a polygon along the line through p in direction e (its extent between crossings),
// as far as it shows inside clip (the cavity's crossings either side of p), when clip is given.
function crossings(poly, p, e) {
  const hits = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ed = sub(b, a), den = e[0] * ed[1] - e[1] * ed[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(a, p), t = (w[0] * ed[1] - w[1] * ed[0]) / den, u = (w[0] * e[1] - w[1] * e[0]) / den;
    if (u >= -1e-9 && u <= 1 + 1e-9) hits.push(t);
  }
  return hits;
}
function widthAcross(poly, p, e, clip) {
  const h = crossings(poly, p, e);
  if (h.length < 2) return 0;
  let lo = Math.min(...h), hi = Math.max(...h);
  if (clip) { const c = crossings(clip, p, e); lo = Math.max(lo, Math.max(...c.filter(t => t <= 0), -Infinity)); hi = Math.min(hi, Math.min(...c.filter(t => t >= 0), Infinity)); }
  return Math.max(0, hi - lo);
}
function rayHit(o, dir, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], e = sub(b, a), den = dir[0] * e[1] - dir[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(a, o), t = (w[0] * e[1] - w[1] * e[0]) / den, s = (w[0] * dir[1] - w[1] * dir[0]) / den;
    if (t > 0.5 && s >= 0 && s <= 1) best = Math.min(best, t);
  }
  return best;
}
// A papillary muscle leaves its wall at a fraction PAP_F of the way from the annular plane to the apex
// and rises toward the leaflets along its chordae (its line of pull). The anterolateral stands on the
// free wall at the junction of the middle and apical thirds. The posteromedial stands on the inferior
// wall: low on the septal side, beyond where the right ventricle (and so the septum) ends.
const PAP_F = { L: 0.65, S: 0.9 }, PAP_W = 5;
// Each stands mostly along its wall toward the base, its chordae fanning obliquely up to the leaflets:
// its axis is PAP_AIM of the way from the long axis (pointing at the base) to the middle of its
// chordae's insertions, so the two muscles stay on their own sides of the cavity even at end-systole.
const PAP_AIM = { L: 0.35, S: 0.1 };
// Each muscle is a cone: PAP_TAPER times as wide at its base as at its rounded head (measured across).
// A fillet carries the base out along the wall for PAP_FIL head half-widths beyond the cone's corners,
// joining the flank PAP_FILH of the way up, so the muscle grows out of the cut face; its outline starts
// PAP_LINE of the way up, so no line crosses or rims its foot.
const PAP_TAPER = 1.6, PAP_FIL = 0.55, PAP_FILH = 0.2, PAP_LINE = 0.35;
// The point on a side (a cubic along which u runs one way) at u, by bisection.
function tAtU(seg, u) {
  const up = seg[3][0] > seg[0][0];
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if ((bez(...seg, m)[0] < u) === up) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Where a muscle stands at a cavity c: the wall point, the side it lies on and the inward normal there.
function papFoot(c, which) {
  const seg = which === 'L' ? [c.E, ...c.l1] : [c.QS, ...c.s2], t = tAtU(seg, c.d + PAP_F[which] * (EU - c.d));
  const at = bez(...seg, t), tan = unit(bezD(...seg, t)), cen = [lerp(c.d, EU, 0.45), (c.QS[1] + c.QL[1]) / 2];
  let nIn = [-tan[1], tan[0]];
  if ((cen[0] - at[0]) * nIn[0] + (cen[1] - at[1]) * nIn[1] < 0) nIn = [-nIn[0], -nIn[1]];
  return { seg, t, at, nIn };
}
// A muscle's pose is its length L (from its base to the centre of its head) and the angle th of its axis.
const dirOf = th => [Math.cos(th), Math.sin(th)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
// The nearest point on a closed polyline.
function nearestOn(poly, p) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], e = sub(poly[i], a), L2 = e[0] * e[0] + e[1] * e[1] || 1, t = clamp(((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1]) / L2, 0, 1), q = add(a, e, t), dd = len(sub(p, q));
    if (dd < bd) { bd = dd; best = q; }
  }
  return best;
}
// poly: the cavity. Where a muscle lies against its wall (an emptied ventricle presses it there), the
// flank that would run into the wall follows the endocardium instead.
function papAt(c, which, pose, w, poly) {
  const { seg, t, at, nIn } = papFoot(c, which), dir = dirOf(pose.th), L = pose.L, side = [-dir[1], dir[0]];
  const bw = PAP_TAPER * w, segLen = curveLen(seg) || 1;
  const head = add(at, dir, L), tip = add(head, dir, w), h0 = add(head, side, w), h1 = add(head, side, -w);
  const b0 = add(at, side, bw), b1 = add(at, side, -bw), fl = (b, h, k) => add(b, sub(h, b), k);
  const f0 = fl(b0, h0, PAP_FILH), f1 = fl(b1, h1, PAP_FILH), u0 = unit(sub(h0, b0)), u1 = unit(sub(h1, b1));
  // the fillet ends on the wall, PAP_FIL head half-widths beyond the cone's corners (by arc length)
  const reach = (bw + PAP_FIL * w) / segLen;
  let e0 = bez(...seg, clamp(t + reach, 0, 1)), e1 = bez(...seg, clamp(t - reach, 0, 1));
  if (dot(sub(e0, at), side) < 0) [e0, e1] = [e1, e0];
  // each fillet leaves the wall along it (it starts as the wall itself) and turns smoothly up into the
  // flank: the wall from e toward the base centre, blended into a cubic from e to f by a smoothstep
  const te = e => { let best = t, bd = Infinity; for (let i = 0; i <= 40; i++) { const tt = clamp(t + (i / 20 - 1) * reach, 0, 1), dd = len(sub(bez(...seg, tt), e)); if (dd < bd) { bd = dd; best = tt; } } return best; };
  const fil = (e, f, u) => {
    const k = len(sub(f, e)), t0 = te(e), t1 = lerp(t0, t, 0.7), cub = [e, add(e, unit(sub(at, e)), 0.45 * k), add(f, u, -0.35 * k), f], out = [];
    for (let i = 0; i <= 8; i++) { const s = i / 8, wl = bez(...seg, lerp(t0, t1, s)), cv = bez(...cub, s), m = smoothstep(s * 1.15); out.push(add(wl, sub(cv, wl), m)); }
    return out;
  };
  const k = 0.552 * w, cap = [[add(h0, u0, k), add(tip, side, k), tip], [add(tip, side, -k), add(h1, u1, k), h1]];
  const inside = q => !poly || pointInPolygon(q, poly) ? q : nearestOn(poly, q);
  // each side, base to head: the fillet, then the flank in steps (so it can follow a wall it meets)
  const N = 8, s0 = [...fil(e0, f0, u0), ...Array.from({ length: N }, (_, i) => fl(f0, h0, (i + 1) / N))].map(inside);
  const s1 = [...fil(e1, f1, u1), ...Array.from({ length: N }, (_, i) => fl(f1, h1, (i + 1) / N))].map(inside);
  const w0 = add(e0, nIn, -4.5), w1 = add(e1, nIn, -4.5), capD = `C${cap[0].map(pg).join(' ')} C${cap[1].map(pg).join(' ')}`;
  const sides = `M${pg(e0)} L${s0.slice(1).map(pg).join(' L')} ${capD} L${s1.slice(0, -1).reverse().map(pg).join(' L')}`;
  // the outline starts PAP_LINE of the way up each flank
  const up = sd => sd.slice(9 + Math.round((PAP_LINE - PAP_FILH) / (1 - PAP_FILH) * N) - 1);
  const line = `M${up(s0).map(pg).join(' L')} ${capD} L${up(s1).slice(0, -1).reverse().map(pg).join(' L')}`;
  const cone = [...s0];
  for (const [P0, q] of [[h0, cap[0]], [tip, cap[1]]]) for (let i = 1; i <= 4; i++) cone.push(bez(P0, ...q, i / 4));
  cone.push(...s1.slice(0, -1).reverse());
  // the lit side of the cone (toward the upper-left light) to its shaded side, for its across gradient;
  // the along gradient fades that lit overlay in above the foot, which keeps the wall's own cut face
  const lit = toPage(h0)[0] + toPage(h0)[1] < toPage(h1)[0] + toPage(h1)[1];
  return { at, head, tip, dir, side, w, bw, L, e0, e1, sides, line, d: `M${pg(w0)} L${sides.slice(1)} L${pg(w1)} Z`, cone, grad: lit ? [h0, h1] : [h1, h0], along: [add(at, dir, 0.04 * L), add(at, dir, 0.26 * L)] };
}
// A thin sail (leaflet or cusp) along a cubic centreline, w0 thick at its hinge, w1 at a rounded free
// edge; taper > 1 keeps it fuller near the hinge before it thins.
// blunt: a blunt free edge with a shallow scallop (two lobes), for the mitral leaflets, instead of a point.
function sailD(P0, P1, P2, P3, w0, w1, n = 14, taper = 1, blunt = false) {
  const Lf = [], Rt = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = bez(P0, P1, P2, P3, t), dv = unit(bezD(P0, P1, P2, P3, t)), nn = [-dv[1], dv[0]], w = lerp(w0, w1, Math.pow(t, taper)) / 2;
    Lf.push(add(p, nn, w)); Rt.push(add(p, nn, -w));
  }
  const dir = unit(bezD(P0, P1, P2, P3, 1));
  const cap = blunt
    ? `Q${pg(add(Lf[n], dir, w1 * 0.75))} ${pg(add(P3, dir, w1 * 0.4))} Q${pg(add(Rt[n], dir, w1 * 0.75))} ${pg(Rt[n])}`
    : `Q${pg(add(P3, dir, w1))} ${pg(Rt[n])}`;
  return `M${Lf.map(pg).join(' L')} ${cap} L${Rt.slice(0, n).reverse().map(pg).join(' L')} Z`;
}
const curvePts = (P, n = 24) => Array.from({ length: n + 1 }, (_, i) => bez(...P, i / n));
const curveLen = P => { const q = curvePts(P, 40); let s = 0; for (let i = 1; i < q.length; i++) s += len(sub(q[i], q[i - 1])); return s; };
// How long a stretch of curve a lies within gap of curve b: the shared edge where two sails meet.
function sharedEdge(a, b, gap) {
  const q = curvePts(a, 60), pb = curvePts(b, 60);
  let s = 0;
  for (let i = 1; i < q.length; i++) if (polyDist(q[i], pb) <= gap && polyDist(q[i - 1], pb) <= gap) s += len(sub(q[i], q[i - 1]));
  return s;
}
// Leaflet tip by angle and length about the hinge, so it never shortens mid-swing.
const swing = (h, shutTip, openTip, k) => {
  const a = sub(shutTip, h), b = sub(openTip, h), la = len(a), lb = len(b);
  let aa = Math.atan2(a[1], a[0]), ab = Math.atan2(b[1], b[0]);
  if (ab - aa > Math.PI) ab -= 2 * Math.PI; if (aa - ab > Math.PI) ab += 2 * Math.PI;
  const ang = lerp(aa, ab, k), L = lerp(la, lb, k);
  return add(h, [Math.cos(ang), Math.sin(ang)], L);
};
const lerpP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

// The shut mitral valve: the leaflets bow toward the ventricle and meet COAPT_D units below the annular
// line, offset toward the posterior hinge (the anterior leaflet is longer); their free edges run on side
// by side toward the apex for EDGE units (the coaptation edge).
// Each leaflet is a filled, tapered sail: LEAF_W[leaflet] = [thickness at the hinge, at the free edge],
// thick enough at the hinge to read as a leaflet (not a line) at 480 wide, tapering to its free edge.
// BILLOW: under systolic pressure the shut leaflets' bodies bow a little toward the atrium (concave
// toward the ventricle) before their free edges turn down to meet.
const BILLOW = 2.4, COAPT_D = 5, COAPT_AT = 0.66, EDGE = 3.6, LEAF_W = { a: [5, 2.4], p: [4.4, 2.1] }, LEAF_TAPER = 1.25, LEAF_L = [28, 17];
function mitralShut(c) {
  const ann = sub(c.M1, c.M0), ua = unit(ann), nV = [ua[1], -ua[0]][0] > 0 ? [ua[1], -ua[0]] : [-ua[1], ua[0]];
  const C = add(add(c.M0, ann, COAPT_AT), nV, COAPT_D), g = 0.35;
  const side = k => add(C, ua, k * g);
  const a = { P0: c.M0, P1: add(add(c.M0, sub(C, c.M0), 0.45), nV, -BILLOW), P2: add(side(-1), nV, -1.6), P3: add(side(-1), nV, EDGE) };
  const p = { P0: c.M1, P1: add(add(c.M1, sub(C, c.M1), 0.45), nV, -BILLOW * 0.6), P2: add(side(1), nV, -1.6), P3: add(side(1), nV, EDGE) };
  return { a, p, C, nV, ua };
}
// The shut aortic cusps: each runs from its hinge down and in to the middle of the root, bellying toward
// the ventricle, and the two free edges meet and run up together into the aorta (a closed valve's Y).
// The sinotubular junction: the root meets the ascending aorta's tube (30 wide, lumen 22) on the tube
// wall's centre line, ROOT_R from the axis, and runs ROOT_IN units on inside it.
const STJ_U = -22, RC = -21, ROOT_R = 11, ROOT_IN = 2.5, CUSP_W = [3, 1.7];
function aorticCusps(c, ka) {
  const um = (c.A0[0] + c.A1[0]) / 2, Cc = [um + 3, RC], g = 0.3, up = 2.4;
  const shutL = { P0: c.A0, P1: [c.A0[0] + 3.5, c.A0[1] + 4.5], P2: [Cc[0] + 1, RC - g], P3: [Cc[0] - up, RC - g] };
  const shutR = { P0: c.A1, P1: [c.A1[0] + 3.5, c.A1[1] - 4.5], P2: [Cc[0] + 1, RC + g], P3: [Cc[0] - up, RC + g] };
  // open: swung back toward the sinus walls but not pressed flat on them, each bowing a little into the
  // lumen, so an open valve still shows two cusps at band size
  const openL = { P0: c.A0, P1: [c.A0[0] - 5, c.A0[1] - 2.2], P2: [c.A0[0] - 10.5, c.A0[1] - 1.2], P3: [c.A0[0] - 14, c.A0[1] + 1.6] };
  const openR = { P0: c.A1, P1: [c.A1[0] - 5, c.A1[1] + 2.2], P2: [c.A1[0] - 10.5, c.A1[1] + 1.2], P3: [c.A1[0] - 14, c.A1[1] - 1.6] };
  const mixC = (s, o) => { const P3 = swing(s.P0, s.P3, o.P3, ka); return [s.P0, lerpP(s.P1, o.P1, ka), lerpP(s.P2, o.P2, ka), P3]; };
  return { L: mixC(shutL, openL), R: mixC(shutR, openR), Cc };
}

// Chordae tendineae do not stretch, so the subvalvular apparatus is built around that: each chord has
// one length, and with the valve shut every chord is pulled taut, so straight. CHORDS lists, per muscle,
// where each chord inserts (leaflet, fraction of the way from its hinge to its free edge) and how far to
// one side of the head's tip it leaves (in head half-widths, toward its insertion): a secondary chord to
// the rough zone and primary chords to the free edge near the coaptation. main 1: the primary chord,
// kept at every detail level.
//   [muscle, leaflet, t, offset, main]
const CHORDS = [
  ['S', 'a', 0.62, 0.9, 0], ['S', 'a', 0.8, 0.4, 0], ['S', 'a', 0.97, 0, 1],
  ['L', 'p', 0.6, 0.9, 0], ['L', 'p', 0.8, 0.4, 0], ['L', 'p', 0.97, 0, 1],
];
// Each muscle's resting length at the reference end-diastole (size 1): PAP_LEN of the long axis
// (annular plane to endocardial apex) from the middle of its base to the tip of its head.
const PAP_LEN = { L: 0.41, S: 0.55 };
// The leaflets as cubics: shut (taut chordae) and at mitral opening k.
const shutCurves = c => { const sh = mitralShut(c); return { a: [sh.a.P0, sh.a.P1, sh.a.P2, sh.a.P3], p: [sh.p.P0, sh.p.P1, sh.p.P2, sh.p.P3] }; };
// The muscle keeps its volume (length x width squared) as it shortens, so it fattens.
const papW = (which, L) => PAP_W * Math.sqrt(PAP_REF[which].L / Math.max(L, 1));
// Where each chord of a muscle in a pose leaves its head, and where it inserts on leaflets cur.
function chordEnds(c, which, pose, cur, foot = papFoot(c, which)) {
  const { at } = foot, dir = dirOf(pose.th), w = papW(which, pose.L), side = [-dir[1], dir[0]], tip = add(at, dir, pose.L + w);
  return CHORDS.filter(h => h[0] === which).map(([, leaf, t, x, main]) => {
    const ins = bez(...cur[leaf], t), sgn = Math.sign((ins[0] - tip[0]) * side[0] + (ins[1] - tip[1]) * side[1]) || 1;
    return { from: add(tip, side, sgn * x * w * 0.55), ins, main, leaf, t };
  });
}
// The reference pose (size 1, valve shut): each muscle PAP_LEN of the long axis, its axis aimed at the
// middle of its chordae's insertions (the line of pull) by PAP_AIM, else toward the base along the axis.
const PAP_REF = (() => {
  const c = cavityLocal(1), cur = shutCurves(c), out = {};
  for (const w of ['L', 'S']) {
    const { at } = papFoot(c, w), ins = CHORDS.filter(h => h[0] === w).map(([, leaf, t]) => bez(...cur[leaf], t));
    const m = ins.reduce((a, p) => add(a, p, 1 / ins.length), [0, 0]), v = add(unit(sub(m, at)), [-1, 0], 1 - PAP_AIM[w]);
    const th = Math.atan2(v[1], v[0]), nIn = papFoot(c, w).nIn;
    out[w] = { L: PAP_LEN[w] * (EU - c.d) - PAP_W, th, lean: th - Math.atan2(nIn[1], nIn[0]) };
  }
  return out;
})();
// Each chord's one length: its span in the reference pose, taut.
const CHORD_LEN = (() => {
  const c = cavityLocal(1), cur = shutCurves(c), out = {};
  for (const w of ['L', 'S']) out[w] = chordEnds(c, w, PAP_REF[w], cur).map(e => len(sub(e.ins, e.from)));
  return out;
})();
// With the valve shut every chord is taut at once: at each size the muscle takes the pose (length and
// angle) whose chords' spans best keep their lengths (least squares on span / length, a pattern search
// from the reference pose, solved once per row of the size table). The leaflets descend with the
// annulus and the muscle follows, shortening (and fattening) in systole, so chord length is the
// invariant and the muscle's shortening the result. The few-percent residual is taken up by the
// chords, which are drawn at exactly their shut span for that row, so shut means straight.
const PAP_SWAY = 0.17;
// How far a point lies beyond the cavity's walls, across the long axis (0 inside): each side sampled
// once as v by u, so the solver's many wall checks cost a lookup each. The valve plane is no wall.
function bandOf(c) {
  const side = segs => { const q = segs.flatMap(sg => curvePts(sg, 40)).sort((a, b) => a[0] - b[0]); return q; };
  const S = side([[c.A0, ...c.s1], [c.QS, ...c.s2]]), Lt = side([[c.E, ...c.l1], [c.QL, ...c.l2]]);
  const at = (q, u) => { let lo = 0, hi = q.length - 1; if (u <= q[0][0]) return q[0][1]; if (u >= q[hi][0]) return q[hi][1]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (q[m][0] < u) lo = m; else hi = m; } const t = (u - q[lo][0]) / ((q[hi][0] - q[lo][0]) || 1); return lerp(q[lo][1], q[hi][1], t); };
  return ([u, v]) => u > c.E[0] ? u - c.E[0] + Math.abs(v) : Math.max(0, at(S, u) - v, v - at(Lt, u));
}
const boxOf = q => [Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))];
const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
// A muscle's cone as a simple outline (base corners, the head's round cap) grown 1.5 units, for the
// solver's overlap checks.
function papQuad(c, which, q, foot = papFoot(c, which)) {
  const { at } = foot, d = dirOf(q.th), sd = [-d[1], d[0]], w = papW(which, q.L) + 1.5, bw = PAP_TAPER * w, hd = add(at, d, q.L);
  const cap = [0.15, 0.3, 0.5, 0.7, 0.85].map(k => { const a = Math.PI * k; return add(add(hd, sd, w * Math.cos(a)), d, w * Math.sin(a)); });
  return [add(at, sd, bw), add(hd, sd, w), ...cap, add(hd, sd, -w), add(at, sd, -bw)];
}
function papPose(c, which, cur, from, poly, other, step = 1) {
  // its angle is held near the reference (PAP_SWAY radians off it costs as much as a chord 3 % off its
  // length): the muscle lengthens and shortens along its own axis rather than swinging across the
  // cavity; and it turns away from a wall that comes in on it (a flank point a unit inside the wall
  // costs as much as a chord 3 % off), so its whole cone stays in the cavity as the ventricle empties
  const C = CHORD_LEN[which], th0 = PAP_REF[which].th, foot = papFoot(c, which), { at } = foot, band = bandOf(c);
  const into = q => {
    const d = dirOf(q.th), sd = [-d[1], d[0]], w = papW(which, q.L), bw = PAP_TAPER * w;
    let e = 0;
    for (const k of [0.3, 0.5, 0.7, 0.9, 1.1]) for (const sg of [1, -1, 0]) {
      if (k > 1 && sg) continue;
      const p = add(add(at, d, k * q.L), sd, sg * lerp(bw, w, Math.min(k, 1)));
      if (k <= 1) e += band(p) ** 2;
      // and it keeps a unit clear of the other muscle (the two may touch, never cross)
      if (other && inBox(p, other.box) && pointInPolygon(p, other.quad)) e += 100 * (distToPolygon(p, other.quad) + 1) ** 2;
    }
    if (other) { const mine = papQuad(c, which, q, foot), bb = boxOf(mine); for (const p of other.pts) if (inBox(p, bb) && pointInPolygon(p, mine)) e += 100 * (distToPolygon(p, mine) + 1) ** 2; }
    return e;
  };
  const cost = q => chordEnds(c, which, q, cur, foot).reduce((a, e, i) => a + (len(sub(e.ins, e.from)) / C[i] - 1) ** 2, 0) + 9e-4 * ((q.th - th0) / PAP_SWAY) ** 2 + 1e-3 * into(q);
  let q = { ...from }, best = cost(q), dL = step, dA = 0.02 * step;
  for (let k = 0; k < 120 && dL > 0.004; k++) {
    let moved = false;
    for (const [a, b] of [[dL, 0], [-dL, 0], [0, dA], [0, -dA]]) {
      const n = { L: q.L + a, th: q.th + b }, v = cost(n);
      if (v < best - 1e-12) { best = v; q = n; moved = true; }
    }
    if (!moved) { dL /= 2; dA /= 2; }
  }
  return q;
}
// A chord of length L between two points: straight when its span is at least L (taut), else slack:
// a gentle S of the same arc length, which keeps a loose cord close to the line between its ends (a
// single bow would swing wide as a loop across the inflow).
const cArc = (a, c1, c2, b) => { let s = 0, p = a; for (let i = 1; i <= 24; i++) { const q = bez(a, c1, c2, b, i / 24); s += len(sub(q, p)); p = q; } return s; };
function chordPath(a, b, L) {
  const d = len(sub(b, a)), third = k => add(a, sub(b, a), k);
  if (d >= L - 0.05) return { c1: third(1 / 3), c2: third(2 / 3), len: d };
  const e = unit(sub(b, a)), n = [-e[1], e[0]], at = h => [add(third(1 / 3), n, h), add(third(2 / 3), n, -h)];
  let lo = 0, hi = 3 * L;
  for (let k = 0; k < 28; k++) { const h = (lo + hi) / 2; if (cArc(a, ...at(h), b) < L) lo = h; else hi = h; }
  const [c1, c2] = at((lo + hi) / 2);
  return { c1, c2, len: cArc(a, c1, c2, b) };
}
// Per row of the size table: each open leaflet tip (relative to its hinge), each muscle's pose and its
// chords' lengths there (their shut spans).
const OPEN_SLACK = { S: 0.6, L: 0.6 }, OPEN_KEEP = 18;
let VT = null;
function valveTable() {
  if (VT) return VT;
  // solved outward from the reference row (size 1), each row starting from its neighbour's pose
  const R = TABLE.rows, i0 = R.reduce((b, r, i) => Math.abs(r.p - 1) < Math.abs(R[b].p - 1) ? i : b, 0), poses = [];
  const solve = (i, from, step) => {
    const c = cavityLocal(R[i].p), poly = cavityPoly(c), cur = shutCurves(c);
    const pL = papPose(c, 'L', cur, from.L, poly, null, step), cL = papAt(c, 'L', pL, papW('L', pL.L), poly).cone;
    return (poses[i] = { L: pL, S: papPose(c, 'S', cur, from.S, poly, { quad: cL, pts: cL.filter((_, j) => j % 2 === 0), box: boxOf(cL) }, step) });
  };
  solve(i0, PAP_REF, 1);
  for (let i = i0 + 1; i < R.length; i++) solve(i, poses[i - 1], 0.25);
  for (let i = i0 - 1; i >= 0; i--) solve(i, poses[i + 1], 0.25);
  VT = R.map((r, i) => {
    const c = cavityLocal(r.p), poly = cavityPoly(c), cur = shutCurves(c), pose = poses[i];
    const lens = Object.fromEntries(['L', 'S'].map(w => [w, chordEnds(c, w, pose[w], cur).map(e => len(sub(e.ins, e.from)))]));
    // an open leaflet's free edge stays OPEN_SLACK of its primary chord's length (at most OPEN_KEEP
    // units) from that chord's head, so its chordae hang a little slack rather than bunched into loops
    const head = w => add(papFoot(c, w).at, dirOf(pose[w].th), pose[w].L + papW(w, pose[w].L)), main = w => lens[w][CHORDS.filter(h => h[0] === w).findIndex(h => h[4])];
    const aT = openTip(c.M0, rot([1, 0], -13), LEAF_L[0], 1, poly, 7.5, [[head('S'), Math.min(OPEN_KEEP, OPEN_SLACK.S * main('S'))]]);
    const pT = openTip(c.M1, rot([1, 0], 9), LEAF_L[1], -1, poly, 7.5, [[head('L'), Math.min(OPEN_KEEP, OPEN_SLACK.L * main('L'))]]);
    return { a: sub(aT, c.M0), p: sub(pT, c.M1), pose, lens };
  });
  return VT;
}
function valveRow(p) {
  const { i, t } = rowAt(p), V = valveTable(), a = V[i], b = V[i + 1];
  const l = (u, v) => lerp(u, v, t), lv = (u, v) => [l(u[0], v[0]), l(u[1], v[1])];
  const pose = w => ({ L: l(a.pose[w].L, b.pose[w].L), th: l(a.pose[w].th, b.pose[w].th) });
  return { a: lv(a.a, b.a), p: lv(a.p, b.p), pose: { L: pose('L'), S: pose('S') }, lens: { L: a.lens.L.map((x, j) => l(x, b.lens.L[j])), S: a.lens.S.map((x, j) => l(x, b.lens.S[j])) } };
}
function valvesLeft(q) {
  const { c } = q, k = easeIO(q.mitral), ka = easeIO(q.aortic), row = valveRow(q.p);
  // mitral: the anterior leaflet hinges at M0 (aortomitral continuity), about 1.7 x the posterior
  const shut = mitralShut(c), aOpen = add(c.M0, row.a), pOpen = add(c.M1, row.p);
  const openCurve = (h, tip, belly) => { const dv = sub(tip, h), nn = unit([-dv[1], dv[0]]); return { P1: add(add(h, dv, 0.34), nn, belly), P2: add(add(h, dv, 0.72), nn, belly * 0.7) }; };
  const oA = openCurve(c.M0, aOpen, -2.6), oP = openCurve(c.M1, pOpen, 2.2);
  const aTip = swing(c.M0, shut.a.P3, aOpen, k), pTip = swing(c.M1, shut.p.P3, pOpen, k);
  const curA = [c.M0, lerpP(shut.a.P1, oA.P1, k), lerpP(shut.a.P2, oA.P2, k), aTip], curP = [c.M1, lerpP(shut.p.P1, oP.P1, k), lerpP(shut.p.P2, oP.P2, k), pTip];
  // papillary muscles: anterolateral from the free wall, posteromedial from the inferior wall; their
  // pose follows the cavity's size (the chordae fix it), and with the valve open the same chordae hang slack
  const papL = papAt(c, 'L', row.pose.L, papW('L', row.pose.L.L), q.poly), papS = papAt(c, 'S', row.pose.S, papW('S', row.pose.S.L), q.poly);
  // each chord's length is its span with the valve shut, for the muscle's pose at this size: so it is
  // straight whenever the valve is shut, and slack (the same length) as the leaflets swing open
  const cur = { a: curA, p: curP }, shutCur = shutCurves(c), chords = [];
  for (const w of ['S', 'L']) {
    const rest = chordEnds(c, w, row.pose[w], shutCur).map(e => len(sub(e.ins, e.from)));
    chordEnds(c, w, row.pose[w], cur).forEach((e, i) => { const cp = chordPath(e.from, e.ins, rest[i]); chords.push({ ...e, m: w, c1: cp.c1, c2: cp.c2, len: cp.len, rest: rest[i] }); });
  }
  const dOf = h => `M${pg(h.from)} C${pg(h.c1)} ${pg(h.c2)} ${pg(h.ins)}`;
  const chordMain = chords.filter(h => h.main).map(dOf).join(' ');
  const chordMore = chords.filter(h => !h.main).map(dOf).join(' ');
  const cusps = aorticCusps(c, ka);
  return {
    leafA: sailD(...curA, ...LEAF_W.a, 18, LEAF_TAPER, true), leafP: sailD(...curP, ...LEAF_W.p, 18, LEAF_TAPER, true), curA, curP, aTip, pTip, coapt: shut.C,
    papL, papS, chordMain, chordMore, cusps, chords, cuspL: sailD(...cusps.L, CUSP_W[0], CUSP_W[1], 14, 1.3), cuspR: sailD(...cusps.R, CUSP_W[0], CUSP_W[1], 14, 1.3),
  };
}
// Sinuses of Valsalva: the root lumen from the annulus (which descends) to the sinotubular junction (fixed).
function rootD(c) {
  // each sinus bulges out past the tube and comes back in to meet it square, on the tube wall's own
  // line (RC +- ROOT_R) with the tube's direction, and runs on a little inside it: one continuous
  // outline from the annulus into the ascending aorta, with no rim step at the junction
  const vL = RC - ROOT_R, vR = RC + ROOT_R, m = v => 2 * RC - v;
  const bulgeL = `C${pg([c.A0[0] - 6, -36.5])} ${pg([-8.5, -38])} ${pg([-12.5, -37.6])} C${pg([-16.5, -37.2])} ${pg([STJ_U + 2.5, vL])} ${pg([STJ_U, vL])}`;
  const bulgeR = `C${pg([STJ_U + 2.5, vR])} ${pg([-16.5, m(-37.2)])} ${pg([-12.5, m(-37.6)])} C${pg([-8.5, m(-38)])} ${pg([c.A1[0] - 6, m(-36.5)])} ${pg(c.A1)}`;
  const L = `M${pg(c.A0)} ${bulgeL} L${pg([STJ_U - ROOT_IN, vL])}`;
  const R = `M${pg([STJ_U - ROOT_IN, vR])} L${pg([STJ_U, vR])} ${bulgeR}`;
  const lumen = `M${pg(c.A0)} ${bulgeL} L${pg([STJ_U - ROOT_IN, vL])} L${pg([STJ_U - ROOT_IN, vR])} L${pg([STJ_U, vR])} ${bulgeR} Z`;
  return { walls: `${L} ${R}`, lumen };
}
// The left atrium: a thin-walled sac whose floor is the mitral annulus (it descends) and whose roof is fixed.
const LA_FIX = [[103, 116], [104, 101], [111, 93], [123, 82], [150, 78], [168, 81], [183, 84], [188, 95], [185, 106], [180, 114], [158, 118]];
function laD(c, closed) {
  const m0 = toPage(c.M0), m1 = toPage(c.M1), F = LA_FIX;
  const body = `C${pt(F[0])} ${pt(F[1])} ${pt(F[2])} C${pt(F[3])} ${pt(F[4])} ${pt(F[5])} C${pt(F[6])} ${pt(F[7])} ${pt(F[8])} C${pt(F[9])} ${pt(F[10])} ${pt(m1)}`;
  return closed ? `M${pt(m0)} ${body} Z` : `M${pt(m0)} ${body}`;
}
const LA_W = 3.5;                             // the atrial wall, about a quarter of the ventricle's
// Septum territory: between the RV face and the cavity's septal side, on to past where the RV ends; it
// fades out over the last 15 units along arcs about the apex (SEPT_FADE), so it never ends in a seam.
const SEPT_FADE = [40, 62];                   // distance from the epicardial apex: clear inside, full outside
function septumD(c, o) {
  const so2 = [o.s1[2], ...o.s2], inner = [c.QS, ...c.s2];
  const cut = (seg, t) => { // de Casteljau: the first part of a cubic up to t
    const [p0, p1, p2, p3] = seg, a = add(p0, sub(p1, p0), t), b = add(p1, sub(p2, p1), t), cc = add(p2, sub(p3, p2), t);
    const ab = add(a, sub(b, a), t), bc = add(b, sub(cc, b), t), m = add(ab, sub(bc, ab), t);
    return [p0, a, ab, m];
  };
  const oc = cut(so2, 0.62), ic = cut(inner, 0.75);
  return `M${pg(o.s0)} C${o.s1.map(pg).join(' ')} C${oc.slice(1).map(pg).join(' ')} L${pg(ic[3])} C${pg(ic[2])} ${pg(ic[1])} ${pg(c.QS)} C${pg(c.s1[1])} ${pg(c.s1[0])} ${pg(c.A0)} Z`;
}
// The flow streamlines, through the open valves.
function flowsLeft(q) {
  const { c } = q, Lc = c.E[0] - c.d, vm = (c.QS[1] + c.QL[1]) / 2;
  const inPts = [[244, 91], [214, 91], [180, 94], [152, 105]].concat([toPage([c.d - 4, 12]), toPage([c.d + 0.3 * Lc, lerp(10, vm, 0.6)]), toPage([c.d + 0.6 * Lc, vm])]);
  const outPts = [toPage([c.d + 0.6 * Lc, vm - 3]), toPage([c.d + 0.32 * Lc, lerp(c.QS[1], vm, 0.45)]), toPage([c.d + 4, RC]), toPage([-11, RC]), toPage([STJ_U - 4, RC]), [77, 94], [77, 72], [94, 57], [120, 53], [143, 55], [154, 60]];
  return { inD: smooth(inPts), outD: smooth(outPts) };
}
// The ascending aorta rises beside the atrium and arches over it. Where the arch turns back, away from
// the viewer, to become the descending aorta (which runs down behind the heart and is not drawn: a stated
// simplification), it is cut, and the cut is seen nearly end-on: an ellipse of wall and lumen sitting
// above the atrium and clear of it, so nothing reads as the aorta running into the atrium.
const ARCH_END = [162, 59], ARCH_R = 15, ARCH_LUMEN = 11, ARCH_TILT = 0.46;
const AORTA_D = (() => {
  const s = toPage([STJ_U, RC]), up = [-U[0], -U[1]];
  const a = add(s, up, 14);
  return `M${pt(s)} C${pt(a)} ${pt([75, 92])} ${pt([75, 80])} C${pt([75, 58])} ${pt([95, 48])} ${pt([119, 48])} C${pt([141, 48])} ${pt([157, 51])} ${pt(ARCH_END)}`;
})();
// The arch's cut end: centre, radii and rotation (square to the vessel), in native coordinates.
const ARCH_CUT = (() => { const q = sampleAlong(AORTA_D, 24), [px, py, a] = q[q.length - 1]; return { x: px, y: py, rx: ARCH_R, ry: ARCH_R * ARCH_TILT, rot: a + 90 }; })();
const BRANCHES = [['M100 53 L93 27', 16, 11], ['M120 50 L119 25', 12, 8], ['M139 52 L145 28', 12, 8]];
const VEINS = ['M246 89 L180 91', 'M246 112 L178 106'];
// The right ventricle beyond the septum, stopping short of the apex. Its cavity lies directly on the
// septum's right-ventricular face (the septum is the wall between the two ventricles), so it follows
// that face as the septum moves; its thin free wall is fixed, and its top tucks under the aortic root.
const RV_OUT = [[88, -50], [83, -61], [66, -70], [48, -72], [28, -72], [2, -66], [-12, -40]];
const RV_OUT_D = (() => { const q = RV_OUT.map(pg); return `M${q[0]} C${q[1]} ${q[2]} ${q[3]} C${q[4]} ${q[5]} ${q[6]}`; })();
function rvD(o) {
  const face = [];
  for (const sg of [[o.s0, ...o.s1], [o.s1[2], ...o.s2]]) for (let i = 0; i <= 16; i++) { const p = bez(...sg, i / 16); if (p[0] <= RV_OUT[0][0]) face.push(p); }
  const q = RV_OUT.map(pg);
  return `M${face.map(pg).join(' L')} L${q[0]} C${q[1]} ${q[2]} ${q[3]} C${q[4]} ${q[5]} ${q[6]} Z`;
}
// Contractility: chevrons in the wall pointing inward, always shown, pulsing a little with squeeze.
function chevronsLeft(q) {
  const { c, o, h, sq } = q, out = [];
  const marks = [[[c.E, ...c.l1], [APEX, ...o.l1], 0.35], [[c.E, ...c.l1], [APEX, ...o.l1], 0.75], [[c.QL, ...c.l2], [o.l1[2], ...o.l2], 0.45]];
  for (const [inner, outer, t] of marks) {
    const a = bez(...inner, t), b = bez(...outer, t), mid = add(a, sub(b, a), 0.5), dir = unit(sub(a, b));
    const tip = add(mid, dir, 3 + 1.5 * sq), ang = Math.atan2(...[toPage(tip)[1] - toPage(mid)[1], toPage(tip)[0] - toPage(mid)[0]]) * 180 / Math.PI;
    out.push(chevronD(...toPage(tip), ang, Math.min(9, h * 0.55)));
  }
  const sa = bez(c.QS, ...c.s2, 0.25), so = bez(...[o.s1[2], ...o.s2], 0.25), sm = add(sa, sub(so, sa), 0.5), sd = unit(sub(sa, so)), st = add(sm, sd, 3 + 1.5 * sq);
  out.push(chevronD(...toPage(st), Math.atan2(toPage(st)[1] - toPage(sm)[1], toPage(st)[0] - toPage(sm)[0]) * 180 / Math.PI, 8.5));
  return out.join(' ');
}
// The squeeze overlay's strength at full squeeze (section 2.6 gives 0.12; measured too faint at band
// size, so the left heart uses more, and a small picture may pass opts.squeezeK for more still), and
// how much the endocardial shadow deepens with it.
const SQUEEZE_K = 0.32, SHADE = [0.45, 0.75];
const DIM_K = 0.78;                           // how far an unlit piece is mixed toward the panel

const LH_AT = {
  atrium: [160, 92], 'atrium-upper': [176, 96], 'pulmonary-veins': [226, 90], mitral: null, ventricle: null, aortic: null, aorta: [119, 48], apex: toPage([118, 0]), rv: toPage([40, -62]), septum: toPage([40, -44]),
};
/** The left heart as markup plus a pure frame function. Options: { x, y, s, edv (mL at area fraction 1),
 *  refs: [EDV, ESV] mL or [{ volume, style: 'dash' | 'dot' }], mark: 'preload' | 'afterload' |
 *  'contractility', emphasis = ['mitral', 'aortic'], parts, key, flow = true, rv = true, squeezeK = 0.32 }.
 *  With two refs, set({ ref: 0 | 1 }) shows one at a time (the full size while filling, the emptied size
 *  while ejecting); without ref every outline shows. */
export function leftHeart(opts = {}) {
  const { x = 0, y = 0, s = 1, edv = 120, refs = [], mark, emphasis = ['mitral', 'aortic'], parts = {}, key, flow = true, rv = true, squeezeK = SQUEEZE_K } = opts;
  const id = b => uid(b, key != null ? `${key}-${b}` : undefined);
  const ids = { epi: id('lhepi'), cut: id('lhcut'), cav: id('lhcav'), la: id('lhla'), sep: id('lhsep'), dim: id('lhdim'), pl: id('lhpapl'), ps: id('lhpaps'), pla: id('lhpapla'), psa: id('lhpapsa'), plm: id('lhpaplm'), psm: id('lhpapsm') };
  const P_ = n => partAttr(parts, n), em = n => emphasis.includes(n);
  const det = (n, cls) => em(n) ? '' : ` class="${cls}"`;
  const w = t => f(SW[t] / s);
  const rest = poseLeft({ volume: edv, edv, mitral: 1 }, { edv });
  // static pieces
  const aortaTube = tube(AORTA_D, { wall: 'artery', lumen: 'oxy', w: 30, lumenW: 22, s });
  const archCut = cutFace(ARCH_CUT.x, ARCH_CUT.y, ARCH_CUT.rx, ARCH_CUT.ry, { wall: 'artery', lumen: 'oxy', rot: ARCH_CUT.rot, lumenR: ARCH_LUMEN }).svg;
  const branches = BRANCHES.map(([d, w_, lw]) => tube(d, { wall: 'artery', lumen: 'oxy', w: w_, lumenW: lw, s, highlight: false })).join('')
    + BRANCHES.map(([d, w_, lw]) => { const q = sampleAlong(d, 6), [px, py, a] = q[q.length - 1]; return `<g class="${D2}">${cutFace(px, py, w_ / 2, w_ / 2 * 0.3, { wall: 'artery', lumen: 'oxy', rot: a + 90, lumenR: lw / 2 }).svg}</g>`; }).join('');
  const veins = VEINS.map(d => tube(d, { wall: 'vein', lumen: 'oxy', w: 14.5, lumenW: 9.5, s, highlight: false, cut: 'start', into: laD(rest.c, true) }));
  const ghosts = refs.map((r, i) => {
    const R = typeof r === 'number' ? { volume: r, style: 'dash' } : { style: 'dash', ...r };
    const q = poseLeft({ volume: R.volume, edv }, { edv });
    const g = mark === 'preload' && i === 0
      ? `<g class="ax-ghost"><path d="${cavityWallD(q.c)}" fill="none" stroke="${P.ui.panel}" stroke-opacity=".85" stroke-width="${f(4.5 / s)}"/><path d="${cavityWallD(q.c)}" fill="none" stroke="${P.ui.blue}" stroke-width="${f(2.5 / s)}" stroke-dasharray="6 4" stroke-linejoin="round"/></g>`
      : artGhost(cavityWallD(q.c), { dash: R.style === 'dot' ? '1.6 3.2' : '5 4', s });
    return g.replace('<g class="ax-ghost"', `<g class="ax-ghost" data-ax="ghost${i}"`);
  }).join('');
  const LAo = laD(rest.c, false);
  const [scx, scy] = toPage(APEX);
  // dimming for a lit caption term: each unlit piece is mixed DIM_K toward the panel by a colour
  // matrix, in place, so nothing is re-ordered (depth is kept) and overlapping dimmed pieces show no
  // seams (for opaque art the result is the same as one panel veil over the whole drawing)
  const pn = [1, 3, 5].map(i => parseInt(P.ui.panel.slice(i, i + 2), 16) / 255 * DIM_K), kk = f(1 - DIM_K);
  const dimF = `<filter id="${ids.dim}" data-ax-dimf="" filterUnits="userSpaceOnUse" x="${LH_O[0] - 20}" y="${LH_O[1] - 20}" width="${LH_W + 40}" height="${LH_H + 40}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${kk} 0 0 0 ${f(pn[0])} 0 ${kk} 0 0 ${f(pn[1])} 0 0 ${kk} 0 ${f(pn[2])} 0 0 0 1 0"/></filter>`;
  const defs = `<defs>${dimF}${volumeGradient(ids.epi, 'myo', [30, 20, 210, 220])}${cutGradient(ids.cut, toPage([60, 0]), 120, P.myo.cut, P.myo.cutEdge)}`
    + `<radialGradient id="${ids.sep}" gradientUnits="userSpaceOnUse" cx="${f(scx)}" cy="${f(scy)}" r="${SEPT_FADE[1]}"><stop offset="${f(SEPT_FADE[0] / SEPT_FADE[1])}" stop-color="${P.septum.base}" stop-opacity="0"/><stop offset="1" stop-color="${P.septum.base}"/></radialGradient></defs>`;
  const mv = (n, attrs = '') => `data-ax="${n}" ${attrs}`;
  const markup = `<g class="ax-left-heart" transform="translate(${f(x - LH_O[0] * s)} ${f(y - LH_O[1] * s)})${s !== 1 ? ` scale(${f(s)})` : ''}">${defs}`
    + `<g ${P_('aorta')}>${branches}${aortaTube.svg}<g data-ax-cut="arch">${archCut}</g></g>`
    + (rv ? `<g ${P_('rv')} opacity=".6"><path ${mv('rv')} fill="${P.deoxy.base}"/><path d="${RV_OUT_D}" fill="none" stroke="${P.myo.line}" stroke-width="${f(6 + 2 * SW.outline / s)}" stroke-linecap="round"/><path d="${RV_OUT_D}" fill="none" stroke="url(#${ids.epi})" stroke-width="6" stroke-linecap="round"/></g>` : '')
    // the ventricle: lit epicardial rim, flat cut face, darker septum, squeeze overlay, cavity with its endocardial shadow
    + `<g ${P_('ventricle')}><path ${mv('lvRimLine')} fill="none" stroke="${P.myo.line}" stroke-width="${f(6 + 2 * SW.outline / s)}" stroke-linejoin="round" stroke-linecap="butt"/>`
    + `<path ${mv('lvRim')} fill="none" stroke="url(#${ids.epi})" stroke-width="6" stroke-linejoin="round"/>`
    + `<path ${mv('lvWall')} fill="url(#${ids.cut})"/>`
    + `<path ${mv('septum')} fill="url(#${ids.sep})"/>`
    + `<path ${mv('squeeze')} fill="${P.myo.lo}" fill-rule="evenodd" opacity="0"/>`
    + `<path ${mv('cavity')} fill="${P.oxy.base}"/>`
    + `<clipPath id="${ids.cav}"><path ${mv('cavityClip')}/></clipPath><path ${mv('cavityShade')} fill="none" stroke="${P.oxy.lo}" opacity="${SHADE[0]}" stroke-width="5" clip-path="url(#${ids.cav})" class="${D2}"/></g>`
    // the atrium and its pulmonary veins (one part, so no seam where the veins open into it): thin
    // muscular wall, roof fixed, floor on the mitral annulus
    + `<g ${P_('atrium pulmonary-veins')}>${veins.map(v => v.svg).join('')}<path ${mv('laLine')} fill="none" stroke="${P.myo.line}" stroke-width="${f(LA_W + 2 * SW.outline / s)}" stroke-linecap="round"/><path ${mv('laWall')} fill="none" stroke="url(#${ids.epi})" stroke-width="${LA_W}" stroke-linecap="round"/>`
    + `<path ${mv('la')} fill="${P.oxy.base}"/>${veins.map(v => v.mouth).join('')}`
    + `<clipPath id="${ids.la}"><path ${mv('laClip')}/></clipPath><path ${mv('laShade')} fill="none" stroke="${P.oxy.lo}" stroke-opacity=".45" stroke-width="5" clip-path="url(#${ids.la})" class="${D2}"/></g>`
    // papillary muscles grow out of the wall: the same muscle and cut face, clipped to the cavity
    // each a rounded finger: a cut gradient across it from its lit side to its shaded side, and a soft
    // contact shade where it leaves the wall
    + `<g ${P_('ventricle')}${det('papillary', D3)} clip-path="url(#${ids.cav})">`
    // each a cone grown from the wall: its foot is filled with the wall's own cut face (so it blends in
    // with no line across it), and a lit overlay, across the cone from its lit side to its shaded side,
    // fades in above the foot through a mask along its axis; the blood beside it carries the same
    // endocardial shadow as the cavity's edge, and its outline starts above the foot
    + ['L', 'S'].map(m => { const k = m === 'L' ? 'pl' : 'ps';
      return `<linearGradient id="${ids[k]}" ${mv(`pap${m}Grad`)} gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${P.myo.hi}"/><stop offset=".45" stop-color="${P.myo.cut}"/><stop offset="1" stop-color="${P.myo.epiLo}"/></linearGradient>`
        + `<linearGradient id="${ids[k + 'a']}" ${mv(`pap${m}Along`)} gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${P.ui.white}" stop-opacity="0"/><stop offset="1" stop-color="${P.ui.white}"/></linearGradient>`
        + `<mask id="${ids[k + 'm']}" maskUnits="userSpaceOnUse" x="${LH_O[0] - 20}" y="${LH_O[1] - 20}" width="${LH_W + 40}" height="${LH_H + 40}"><path ${mv(`pap${m}Mask`)} fill="url(#${ids[k + 'a']})"/></mask>`; }).join('')
    + ['L', 'S'].map(m => `<path ${mv(`pap${m}Shade`)} fill="none" stroke="${P.oxy.lo}" stroke-opacity="${SHADE[0]}" stroke-width="4" stroke-linejoin="round"/>`).join('')
    + ['S', 'L'].map(m => { const k = m === 'L' ? 'pl' : 'ps';
      return `<path ${mv(`pap${m}Base`)} fill="url(#${ids.cut})"/><path ${mv(`pap${m}`)} fill="url(#${ids[k]})" mask="url(#${ids[k + 'm']})"/><path ${mv(`pap${m}Line`)} fill="none" stroke="${P.myo.papLine}" stroke-width="${w('detail')}" stroke-linecap="round"/>`; }).join('') + '</g>'
    + `<g ${P_('mitral')}><path ${mv('chordMain')} fill="none" stroke="${P.valve.cord}" stroke-width="${f((s < 1 ? 1.4 : 1) / s)}" stroke-linecap="round"${det('mitral', D3)}/>`
    // a small (band) heart draws one cord per muscle, a little heavier, so it reads as a cord, not a scratch
    + (s < 1 ? '' : `<path ${mv('chordMore')} fill="none" stroke="${P.valve.cord}" stroke-width="${f(1 / s)}" stroke-linecap="round" class="${D2}"/>`)
    + `<path ${mv('leafA')} fill="${P.valve.base}" stroke="${P.valve.line}" stroke-opacity=".75" stroke-width="${w('detail')}" stroke-linejoin="round"/><path ${mv('leafP')} fill="${P.valve.base}" stroke="${P.valve.line}" stroke-opacity=".75" stroke-width="${w('detail')}" stroke-linejoin="round"/>`
    + `<circle ${mv('annM0')} r="${f(SW.internal / s)}" fill="${P.valve.line}"/><circle ${mv('annM1')} r="${f(SW.internal / s)}" fill="${P.valve.line}"/></g>`
    // the aortic root, in front of the atrium (it is anterior to it): artery wall with sinuses, lumen
    // continuous with the outflow tract; its posterior sinus wall is the edge between aorta and atrium
    + `<g ${P_('aorta')}><path ${mv('rootLine')} fill="none" stroke="${P.artery.line}" stroke-width="${f(4.5 + 2 * SW.outline / s)}" stroke-linecap="butt"/><path ${mv('rootWall')} fill="none" stroke="${P.artery.base}" stroke-width="4.5" stroke-linecap="butt"/><path ${mv('rootLumen')} fill="${P.oxy.base}"/></g>`
    + `<g ${P_('aortic')}><path ${mv('cuspL')} fill="${P.valve.base}" stroke="${P.valve.line}" stroke-width="${w('detail')}" stroke-linejoin="round"/><path ${mv('cuspR')} fill="${P.valve.base}" stroke="${P.valve.line}" stroke-width="${w('detail')}" stroke-linejoin="round"/></g>`
    + (flow ? `<g ${mv('flowIn')} opacity="0"><path ${mv('flowInLine')} fill="none" stroke="${P.ui.white}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" stroke-dasharray="10 14"/><path ${mv('flowInHead')} fill="none" stroke="${P.ui.white}" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`
      + `<g ${mv('flowOut')} opacity="0"><path ${mv('flowOutLine')} fill="none" stroke="${P.ui.white}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" stroke-dasharray="10 14"/><path ${mv('flowOutHead')} fill="none" stroke="${P.ui.white}" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>` : '')
    + (mark === 'contractility' ? `<path ${mv('chevrons')} fill="none" stroke="${P.ui.panel}" stroke-width="${f(5.5 / s)}" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/><path ${mv('chevrons2')} fill="none" stroke="${P.ui.blue}" stroke-width="${f(2.8 / s)}" stroke-linecap="round" stroke-linejoin="round"/>` : '')
    + (mark === 'afterload' ? (() => { const a = toPage([STJ_U - 30, RC]), b = toPage([STJ_U + 9, RC]), hd = toPage([STJ_U + 15, RC]), sd = [N[0] * 6.5, N[1] * 6.5], back = add(b, U, -1);
      const head = `M${pt(hd)} L${pt(add(back, sd))} L${pt(add(back, sd, -1))} Z`;
      return `<g data-ax-mark="afterload"><path d="M${pt(a)} L${pt(b)}" stroke="${P.ui.white}" stroke-width="${f(7 / s)}" stroke-linecap="round" opacity=".85"/><path d="${head}" fill="${P.ui.white}" stroke="${P.ui.white}" stroke-width="${f(3 / s)}" stroke-linejoin="round" opacity=".85"/><path d="M${pt(a)} L${pt(b)}" stroke="${P.ui.blue}" stroke-width="${f(3 / s)}" stroke-linecap="round"/><path d="${head}" fill="${P.ui.blue}"/></g>`; })() : '')
    + (mark === 'preload' ? `<g data-ax-mark="preload"><path ${mv('preArrowHalo')} fill="none" stroke="${P.ui.panel}" stroke-width="${f(6 / s)}" stroke-linecap="round" opacity=".85"/><path ${mv('preArrow')} fill="none" stroke="${P.ui.blue}" stroke-width="${f(3 / s)}" stroke-linecap="round"/><path ${mv('preHead')} fill="${P.ui.blue}" stroke="${P.ui.blue}" stroke-width="${f(1 / s)}" stroke-linejoin="round"/></g>` : '')
    + ghosts
    + '</g>';
  const toPic = q => [x + (q[0] - LH_O[0]) * s, y + (q[1] - LH_O[1]) * s];
  const frame = st => frameLeft(poseLeft(st, { edv }), st, { mark, flow, refs: refs.length, s, squeezeK });
  const atFor = st => {
    const q = poseLeft(st, { edv }), v = valvesLeft(q);
    return {
      ...LH_AT, mitral: toPage(bez(...v.curP, 0.5)), 'mitral-anterior': toPage(bez(...v.curA, 0.45)), aortic: toPage(bez(...v.cusps.L, 0.45)), ventricle: toPage([q.c.d + 0.6 * (q.c.E[0] - q.c.d), lerp((q.c.QS[1] + q.c.QL[1]) / 2, q.c.QL[1], 0.4)]),
      'aortic-valve': toPage(bez(...v.cusps.L, 0.45)), 'mitral-open': toPage(v.aTip), 'mitral-hinge': toPage(add(q.c.M1, [-2.5, -1.5])),
    };
  };
  const at = Object.fromEntries(Object.entries(atFor({ volume: edv, edv, mitral: 1 })).map(([k, p]) => [k, toPic(p)]));
  return {
    markup, box: [x, y, LH_W * s, LH_H * s].map(f), at, frame,
    atFor: st => Object.fromEntries(Object.entries(atFor(st)).map(([k, p]) => [k, toPic(p)])),
    // the cavity outline at a state, in picture coordinates (the art ghost of a change step)
    outline: st => mapPath(cavityWallD(poseLeft({ edv, ...st }, { edv }).c), toPic),
    // A still: the markup with one frame written in (for string scenes, stills and the gallery).
    still(st) {
      const fr = frame(st);
      const svg = markup.replace(/data-ax="([^"]+)"([^>]*?)(\/?)>/g, (m0, n, rest_, close) => {
        const a = fr[n]; if (!a) return m0;
        let r = rest_; for (const k of Object.keys(a)) r = r.replace(new RegExp(`\\s${k}="[^"]*"`), '');
        return `data-ax="${n}"${r} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}${close}>`;
      });
      return artOf(svg, [x, y, LH_W * s, LH_H * s].map(f), this.atFor(st), () => this.outline(st));
    },
  };
}
// A papillary muscle's gradient runs across the finger at its head, lit side to shaded side.
const gradAcross = m => { const [a, b] = m.grad.map(toPage), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], k = 1.25; return { x1: f(mid[0] + (a[0] - mid[0]) * k), y1: f(mid[1] + (a[1] - mid[1]) * k), x2: f(mid[0] + (b[0] - mid[0]) * k), y2: f(mid[1] + (b[1] - mid[1]) * k) }; };
// A papillary muscle's moving attributes: its cone, foot, overlay mask, gradients and outline.
const papFrame = (m, p) => {
  const [a, b] = p.along.map(toPage);
  return { [`pap${m}`]: { d: p.d }, [`pap${m}Base`]: { d: p.d }, [`pap${m}Mask`]: { d: p.d }, [`pap${m}Shade`]: { d: p.sides }, [`pap${m}Line`]: { d: p.line },
    [`pap${m}Grad`]: gradAcross(p), [`pap${m}Along`]: { x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]) } };
};
// One frame: attribute values only (d, transform, opacity, stroke-dashoffset, stroke-opacity).
function frameLeft(q, st, { mark, flow, refs, s, squeezeK = SQUEEZE_K }) {
  const { c, o } = q, v = valvesLeft(q), cav = cavityD(c), outer = outerD(c, o), la = laD(c, true), laOpen = laD(c, false), root = rootD(c);
  const fr = {
    rv: { d: rvD(o) }, lvRimLine: { d: outerRimD(o) }, lvRim: { d: outerRimD(o) }, lvWall: { d: outer }, septum: { d: septumD(c, o) },
    squeeze: { d: `${outer} ${cav}`, opacity: f(squeezeK * q.sq) },
    cavity: { d: cav }, cavityClip: { d: cav }, cavityShade: { d: cav, opacity: f(lerp(SHADE[0], SHADE[1], q.sq)) },
    rootLine: { d: root.walls }, rootWall: { d: root.walls }, rootLumen: { d: root.lumen },
    laLine: { d: laOpen }, laWall: { d: laOpen }, la: { d: la }, laClip: { d: la }, laShade: { d: la },
    ...papFrame('L', v.papL), ...papFrame('S', v.papS), chordMain: { d: v.chordMain }, chordMore: { d: v.chordMore },
    leafA: { d: v.leafA }, leafP: { d: v.leafP }, cuspL: { d: v.cuspL }, cuspR: { d: v.cuspR },
    annM0: { transform: `translate(${pg(c.M0)})` }, annM1: { transform: `translate(${pg(c.M1)})` },
  };
  if (refs >= 2) for (let i = 0; i < refs; i++) fr[`ghost${i}`] = { opacity: st.ref == null || st.ref === i ? '1' : '0' };
  if (flow) {
    const fl = flowsLeft(q), off = f(-24 * ((st.phase || 0) % 1)), hd = d => { const a = sampleAlong(d, 12), [hx, hy, ang] = a[a.length - 1]; return chevronD(hx, hy, ang, 6); };
    Object.assign(fr, {
      flowIn: { opacity: f(clamp(st.inflow || 0, 0, 1)) }, flowInLine: { d: fl.inD, 'stroke-dashoffset': off }, flowInHead: { d: hd(fl.inD) },
      flowOut: { opacity: f(clamp(st.outflow || 0, 0, 1)) }, flowOutLine: { d: fl.outD, 'stroke-dashoffset': off }, flowOutHead: { d: hd(fl.outD) },
    });
  }
  if (mark === 'contractility') { const ch = chevronsLeft(q); fr.chevrons = { d: ch }; fr.chevrons2 = { d: ch }; }
  if (mark === 'preload') {
    // outward from the free wall's epicardium, square to it, low on the wall where it faces right: the
    // wall is stretched (never up toward the veins, where it could read as flow leaving the heart)
    const t = 0.62, seg = [APEX, ...o.l1], a = bez(...seg, t), tn = unit(bezD(...seg, t));
    let out = [tn[1], -tn[0]];
    if (out[0] * (a[0] - bez(c.E, ...c.l1, t)[0]) + out[1] * (a[1] - bez(c.E, ...c.l1, t)[1]) < 0) out = [-out[0], -out[1]];
    const s0 = toPage(add(a, out, 4)), tip = toPage(add(a, out, 26)), dir = unit(sub(tip, s0)), hl = 11 / Math.max(s, 0.5), hw = 7 / Math.max(s, 0.5);
    const back = add(tip, dir, -hl), sd = [-dir[1] * hw, dir[0] * hw];
    fr.preArrowHalo = { d: `M${pt(s0)} L${pt(add(tip, dir, -hl * 0.6))}` };
    fr.preArrow = { d: `M${pt(s0)} L${pt(add(tip, dir, -hl * 0.6))}` };
    fr.preHead = { d: `M${pt(tip)} L${pt(add(back, sd))} L${pt(add(back, dir, hl * 0.25))} L${pt(add(back, sd, -1))} Z` };
  }
  return fr;
}
/** Mount the left heart inside an SVG <g>. ctx: artContext(svg) from core.js (scopes its ids per svg).
 *  Returns { el, box, at, set(state), outline(state), light(test) }. set() writes attributes only and is
 *  idempotent. light(test) dims every piece of the drawing except the parts for which test(el) is true,
 *  in place (a colour-matrix filter mixing it toward the panel), so the painted order and depth never
 *  change and dimmed overlaps show no seams; light(null) undoes it. */
export function mountLeftHeart(g, ctx, opts = {}) {
  const h = leftHeart(opts), first = h.still({ volume: opts.edv || 120, mitral: 1 });
  const [el] = ctx.html(g, first.svg);
  const nodes = {};
  for (const n of el.querySelectorAll('[data-ax]')) nodes[n.getAttribute('data-ax')] = n;
  const last = {};
  // the pieces light() can dim: every top-level piece of the drawing but its defs
  const pieces = [...el.children].filter(n => n.localName !== 'defs'), dimUrl = `url(#${el.querySelector('[data-ax-dimf]').id})`;
  let litKey = null;
  return {
    el, box: h.box, at: h.at, outline: h.outline, atFor: h.atFor,
    set(st) {
      const fr = h.frame(st);
      for (const n in fr) {
        const node = nodes[n]; if (!node) continue;
        const prev = last[n] || (last[n] = {}), a = fr[n];
        for (const k in a) if (prev[k] !== a[k]) { node.setAttribute(k, a[k]); prev[k] = a[k]; }
      }
      if (st.pressure != null) { const p = String(f(st.pressure)); if (last.pressure !== p) { el.setAttribute('data-pressure', p); last.pressure = p; } }
    },
    light(test) {
      const on = test ? pieces.map(n => n.hasAttribute('data-part') && !!test(n)) : null, key = on ? on.join() : null;
      if (key === litKey) return;
      litKey = key;
      pieces.forEach((n, i) => {
        if (on && !on[i]) { n.setAttribute('filter', dimUrl); n.setAttribute('data-ax-dim', ''); } else { n.removeAttribute('filter'); n.removeAttribute('data-ax-dim'); }
      });
    },
  };
}
/** The left heart's model contract (for lessons and tests). size: the shape parameter the area table maps. */
export const lvGeometry = {
  BOX: [LH_O[0], LH_O[1], LH_W, LH_H], rows: TABLE.rows,
  RANGE: [TABLE.rows[0].vol / TABLE.ref, TABLE.rows[TABLE.rows.length - 1].vol / TABLE.ref].map(f),
  // size for a volume fraction, the half-ellipsoid volume (Li Di^2) and the cut's area at a size, and
  // the cavity's long and short axes (the short axis across the mid cavity)
  sizeForVolume, volume: p => volOf(cavityAt(p)), area: p => Math.abs(areaOf(cavityPoly(cavityAt(p), 40))), axes: p => axesOf(cavityAt(p)),
  wall: wallFor, muscleVolume: p => shellOf(cavityAt(p), wallFor(p)) / TABLE.M,
  cavity: p => cavityD(cavityAt(p)),
  refOutline: p => cavityD(cavityAt(p)),
  outline: st => cavityD(poseLeft(st).c),
  // Mean thickness of the mid septum and the mid free wall, and of the apical cap, at a state.
  walls: st => { const q = poseLeft(st); return wallsOf(q.c, q.o); },
  // The endocardial apex (pinned) and how far the annular plane has descended toward it.
  endoApex: st => toPage(poseLeft(st).c.E),
  descent: st => poseLeft(st).c.d,
  // The drawing's extent at a state, in native coordinates: the moving outline and every fixed part.
  extent(st) {
    const q = poseLeft(st), pts = outerPoly(q.o).map(toPage);
    for (const [d, w_] of [[AORTA_D, 30], [RV_OUT_D, 8], ...BRANCHES.map(([d_, w2]) => [d_, w2]), ...VEINS.map(d_ => [d_, 15])]) {
      for (const [px, py, a] of sampleAlong(d, 40)) { const r_ = a * Math.PI / 180, nx = -Math.sin(r_) * w_ / 2, ny = Math.cos(r_) * w_ / 2; pts.push([px + nx, py + ny], [px - nx, py - ny]); }
    }
    for (const p of flatten(laD(q.c, true), 12)) pts.push([p[0] - LA_W, p[1] - LA_W], [p[0] + LA_W, p[1] + LA_W]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  },
  // The smallest distance from an open leaflet tip or a papillary head to the cavity wall.
  clearance(st) {
    const q = poseLeft(st), v = valvesLeft(q), poly = q.poly, out = [];
    if (q.mitral > 0.99) out.push(['anterior leaflet tip', v.aTip], ['posterior leaflet tip', v.pTip]);
    out.push(['anterolateral papillary head', v.papL.head], ['posteromedial papillary head', v.papS.head]);
    let min = Infinity, worst = '';
    for (const [n, p] of out) { const dd = clear(p, poly); if (dd < min) { min = dd; worst = n; } }
    return { min, worst };
  },
  // How far below the annulus line (toward the apex) the shut leaflets meet.
  coaptationDepth(st) {
    const q = poseLeft({ ...st, mitral: 0 }), s = mitralShut(q.c);
    return (s.C[0] - q.c.M0[0]) * s.nV[0] + (s.C[1] - q.c.M0[1]) * s.nV[1];
  },
  // The mitral leaflets' drawn lengths, hinge thickness, and (shut) where and how long they meet.
  mitralShape(st) {
    const q = poseLeft(st), v = valvesLeft(q), s = mitralShut(q.c);
    return { anterior: curveLen(v.curA), posterior: curveLen(v.curP), hinge: { anterior: LEAF_W.a[0], posterior: LEAF_W.p[0] }, edge: { anterior: LEAF_W.a[1], posterior: LEAF_W.p[1] }, depth: this.coaptationDepth(st), overlap: sharedEdge(v.curA, v.curP, Math.max(LEAF_W.a[1], LEAF_W.p[1]) + 0.2), coapt: s.C };
  },
  // How long the shut aortic cusps' free edges run together (their coaptation edge), in units.
  aorticCoaptation(st) {
    const q = poseLeft({ ...st, aortic: 0 }), v = valvesLeft(q);
    return sharedEdge(v.cusps.L, v.cusps.R, 1.4);
  },
  // The endocardium in local coordinates (u toward the apex, v toward the free wall), each side from
  // the base to the apex, and where each papillary muscle leaves the wall.
  endocardium(st) {
    const q = poseLeft(st), c = q.c, v = valvesLeft(q), k = 24;
    const run = segs => segs.flatMap((s, j) => curvePts(s, k).slice(j ? 1 : 0));
    const rev = s => [s[3], s[2], s[1], s[0]];
    return {
      septal: run([[c.A0, ...c.s1], [c.QS, ...c.s2]]),
      lateral: run([rev([c.QL, ...c.l2]), rev([c.E, ...c.l1])]),
      papillary: { L: v.papL.at, S: v.papS.at },
    };
  },
  // The two papillary cones (the part inside the cavity) and the cavity, in local coordinates.
  // Each papillary muscle's shape: base and head widths, length, where it leaves the wall (0 at the
  // annular plane, 1 at the apex), how far it points toward the annulus (the u component of its
  // direction toward the base), how deep it reaches across the cavity and how wide the cavity is there.
  papillaryShape(st) {
    const q = poseLeft(st), v = valvesLeft(q), c = q.c;
    return [['anterolateral', v.papL, 'L'], ['posteromedial', v.papS, 'S']].map(([name, m, which]) => {
      const b = papFoot(c, which), depth = Math.max(...m.cone.map(p => (p[0] - b.at[0]) * b.nIn[0] + (p[1] - b.at[1]) * b.nIn[1]));
      const tanAngle = 90 - Math.acos(clamp(m.dir[0] * b.nIn[0] + m.dir[1] * b.nIn[1], -1, 1)) * 180 / Math.PI;
      // widths measured off the drawn outline, across the axis, from above the fillet to below the head
      const widths = [0.35, 0.5, 0.65, 0.8, 0.92].map(k => widthAcross(m.cone, add(m.at, m.dir, k * m.L), m.side));
      return {
        name, side: b.at[1] > 0 ? 'free' : 'septal', base: 2 * m.bw, head: 2 * m.w, widths, outlineFrom: PAP_LINE, foot: [m.e0, m.e1], length: m.L + m.w, longAxis: EU - c.d,
        at: (b.at[0] - c.d) / (EU - c.d), u: b.at[0], toBase: -m.dir[0], offWall: tanAngle, depth, across: rayHit(b.at, b.nIn, q.poly), chord: Math.max(...v.chords.filter(h => h.m === which).map(h => h.len)),
      };
    });
  },
  // Every chord at a state: where it leaves its head and inserts, its drawn (arc) length and its one length.
  chordae(st) {
    const q = poseLeft(st), v = valvesLeft(q);
    return v.chords.map(h => ({ muscle: h.m, leaflet: h.leaf, t: h.t, main: h.main, from: h.from, ins: h.ins, len: h.len, rest: h.rest, d: `M${pt(toPage(h.from))} C${pt(toPage(h.c1))} ${pt(toPage(h.c2))} ${pt(toPage(h.ins))}` }));
  },
  // Where the septum ends along the long axis: the right ventricle's apical end (fixed).
  septumEnd: RV_OUT[0][0],
  papillary(st) {
    const q = poseLeft(st), v = valvesLeft(q);
    return { cones: [v.papL.cone, v.papS.cone], cavity: q.poly };
  },
  // The aorta above the sinotubular junction (the ascending aorta, the arch, its branches and the arch's
  // cut end) as outlines, and the left atrium's outer outline (its wall included) at a state, in native
  // coordinates: the two must never overlap.
  aortaAndAtrium(st = {}) {
    const q = poseLeft({ edv: 1, volume: 1, ...st }), outline = (d, w_) => { const q2 = sampleAlong(d, 60), a = [], b = []; for (const [px, py, an] of q2) { const r_ = an * Math.PI / 180, nx = -Math.sin(r_) * w_ / 2, ny = Math.cos(r_) * w_ / 2; a.push([px + nx, py + ny]); b.push([px - nx, py - ny]); } return [...a, ...b.reverse()]; };
    const { x: cx, y: cy, rx, ry, rot } = ARCH_CUT, ra = rot * Math.PI / 180;
    const cut = Array.from({ length: 48 }, (_, i) => { const t = i / 48 * 2 * Math.PI, ex = rx * Math.cos(t), ey = ry * Math.sin(t); return [cx + ex * Math.cos(ra) - ey * Math.sin(ra), cy + ex * Math.sin(ra) + ey * Math.cos(ra)]; });
    return {
      aorta: [['ascending aorta and arch', outline(AORTA_D, 30)], ['arch cut end', cut], ...BRANCHES.map(([d_, w2], i) => [`branch ${i + 1}`, outline(d_, w2)])],
      atrium: flatten(laD(q.c, true), 24), wall: LA_W / 2 + SW.outline,
    };
  },
};

/* =====================================================================================================
   The four-chamber section (ART-REFERENCE.svg-notes.md, revision 2), native box 240 x 280, top-left.
   Anterior view: RA and RV on the viewer's left, LA and LV on the right, apex down and to the right.
   The aortic root is opened in the same plane (a "five-chamber" cut); the RV outflow tract is the most
   anterior structure, an opened funnel from the RV to the pulmonary valve, never touching the LA.
   Only the two left pulmonary veins are drawn (the right two pass behind the RA); two of three aortic
   and pulmonary cusps show. Vessels are see-through tubes (a convention, not a cut).
   ===================================================================================================== */
const SIL = 'M64 82 C46 84 34 100 33 124 C32 150 32 176 38 198 C56 228 112 250 170 264 C184 268 196 270 202 263 C216 238 226 192 224 150 C222 122 216 106 206 96 C192 84 166 82 146 84 C122 82 90 78 64 82 Z';
const RA_D = 'M64 94 C50 96 42 108 41 128 C40 150 40 172 42 192 L44 194 L92 166 C94 140 94 116 90 100 C82 95 74 93 64 94 Z';
const RV_SEC = 'M44 194 L92 166 C104 192 124 214 146 230 C124 237 96 235 76 227 C60 219 50 208 44 194 Z';
const LA_D = 'M152 134 C150 120 152 110 160 105 C176 98 196 100 207 107 C214 114 212 122 204 126 Z';
// the muscular interventricular septum and the interatrial septum
const SEPT_D = 'M92 166 C104 192 124 214 146 230 L166 240 C150 226 132 192 121 147 Z';
const IAS_D = 'M90 100 C102 102 112 108 116 116 L121 147 L92 166 C94 140 94 116 90 100 Z';
const LV_SEC = 'M121 147 L146 139 L152 134 L204 126 C213 152 212 196 203 226 C197 242 191 250 185 250 C162 236 134 194 121 147 Z';
// Wall territories: the cut face is split so each part lights its own muscle (section 4.0b). They tile the box.
const TERR = {
  ra: '0,0 92,0 92,166 44,194 0,222',
  heart: '92,0 152,0 152,134 146,139 121,147 106,156 92,166',
  la: '152,0 240,0 240,124 204,126 152,134',
  lv: '106,156 121,147 146,139 152,134 204,126 240,124 240,280 160,280 156,235',
  rv: '0,222 44,194 92,166 106,156 156,235 160,280 0,280',
};
// Cavity scaling about each ventricle's long axis with its annulus fixed (the same contract as the left heart).
const SEC = {
  lv: { d: LV_SEC, fixed: [[121, 147], [146, 139], [152, 134], [204, 126]], B: [163, 137], A: [185, 250] },
  rv: { d: RV_SEC, fixed: [[44, 194], [92, 166]], B: [68, 180], A: [112, 236] },
};
// Each territory grown 0.8 units from its centre, so neighbours overlap and no seam shows between them.
const TERR_GROWN = Object.fromEntries(Object.entries(TERR).map(([n, pts]) => {
  const q = pts.split(' ').map(p => p.split(',').map(Number)), c = [q.reduce((a, p) => a + p[0], 0) / q.length, q.reduce((a, p) => a + p[1], 0) / q.length];
  return [n, q.map(p => { const d = unit(sub(p, c)); return `${f(p[0] + d[0] * 0.8)},${f(p[1] + d[1] * 0.8)}`; }).join(' ')];
}));
const NUMS = /-?\d*\.?\d+/g;
const along = p => clamp(1 - 0.2 * (1 - p), 0.8, 1.05);   // the section's long axis shortens at most 20 %
function secMap(ch, size) {
  const c = SEC[ch], ax = unit(sub(c.A, c.B)), nx = [ax[1], -ax[0]], al = along(size), ac = size / al;
  return q => {
    if (c.fixed.some(p => Math.abs(p[0] - q[0]) < 0.01 && Math.abs(p[1] - q[1]) < 0.01)) return q;
    const dd = sub(q, c.B), u = dd[0] * ax[0] + dd[1] * ax[1], v = dd[0] * nx[0] + dd[1] * nx[1];
    return add(add(c.B, ax, u * al), nx, v * ac);
  };
}
// Map every coordinate pair of a path through fn.
const mapPath = (d, fn) => { const n = d.match(NUMS).map(Number); let i = 0; return d.replace(/-?\d*\.?\d+\s+-?\d*\.?\d+/g, () => { const p = fn([n[i], n[i + 1]]); i += 2; return `${f(p[0])} ${f(p[1])}`; }); };
const secCavity = (ch, size) => size === 1 ? SEC[ch].d : mapPath(SEC[ch].d, secMap(ch, size));
const SEC_TABLE = Object.fromEntries(['lv', 'rv'].map(ch => {
  const rows = [];
  for (let i = 0; i <= 96; i++) { const p = 0.15 + 1.3 * i / 96; rows.push([p, Math.abs(areaOf(flatten(secCavity(ch, p), 20)))]); }
  return [ch, rows];
}));
export const sectionGeometry = {
  area: (ch, size) => Math.abs(areaOf(flatten(secCavity(ch, size), 40))),
  sizeForArea(ch, frac) {
    const R = SEC_TABLE[ch], a = frac * this.area(ch, 1);
    let i = 1; while (i < R.length - 1 && R[i][1] < a) i++;
    return R[i - 1][0] + (R[i][0] - R[i - 1][0]) * (a - R[i - 1][1]) / (R[i][1] - R[i - 1][1]);
  },
  cavity: secCavity,
  // the section's outlines and landmarks (native coordinates), for overlays and their checks
  landmarks: {
    silhouette: SIL, ra: RA_D, rv: RV_SEC, la: LA_D, lv: LV_SEC, septum: SEPT_D, interatrialSeptum: IAS_D,
    rvFace: 'M92 166 C104 192 124 214 146 230', lvFace: 'M121 147 C134 194 162 236 185 250',
    svcJunction: [51, 94], raCentre: [66, 146], tricuspidSeptalHinge: [92, 166], apex: [196, 258],
  },
};
// The recipe's valve pairs: [open, shut], matched command structure, so lerpPath moves them point by point.
const VALVES = {
  tricuspid: [['M44 194 C50 202 58 208 68 212 C59 206 52 199 47 192 Z', 'M44 194 C50 191 60 187 70.5 184.3 C60 186 51 189 47 192 Z'],
    ['M92 166 C93 174 94 182 95 190 C92 182 90 174 89 167 Z', 'M92 166 C86 172 78 180 70.5 184.3 C78 178 85 172 89 167 Z']],
  mitral: [['M152 134 C156 146 160 158 164 170 C161 158 157 146 155.5 133.5 Z', 'M152 134 C162 137 175 137 187.5 134.2 C175 135 162 135 155.5 133.5 Z'],
    ['M204 126 C203 133 201 140 199 146 C200 140 201 133 200.5 126.5 Z', 'M204 126 C199 130 193 133 187.5 134.2 C193 131 198 128 200.5 126.5 Z']],
  aortic: [['M121 147 Q116 139 118 129 Q118.5 139 121 147 Z', 'M121 147 Q124 155 133.5 151 Q127 150 121 147 Z'],
    ['M146 139 Q148 131 143 123 Q145 131 146 139 Z', 'M146 139 Q145 148 133.5 151 Q140 147 146 139 Z']],
  pulmonary: [['M160 86 Q157.5 78 158.5 70 Q159.5 78 160 86 Z', 'M160 86 Q163 94 166 90 Q163 90 160 86 Z'],
    ['M172.5 84.5 Q172.5 76 170.5 69 Q171.5 77 172.5 84.5 Z', 'M172.5 84.5 Q171.5 93 166 90 Q169.5 88 172.5 84.5 Z']],
};
const leafTip = d => { const n = d.match(NUMS).map(Number); return d.includes('Q') ? [n[4], n[5]] : [n[6], n[7]]; };
// Papillary heads and where each leaflet's chordae go (the tricuspid septal leaflet tethers to the septum).
const PAP = { rv: 'M80 229 C84 222 87 216 90 211 C93 216 96 223 100 233', lvA: 'M209 190 C202 193 197 197 193 201 C198 206 203 210 207 216', lvP: 'M170 241 C173 235 176 230 179 225 C183 230 186 238 189 249' };
const CHORDAE = { tricuspid: [[0, [90, 211], 3], [1, [104, 196], 2]], mitral: [[0, [179, 225], 2], [0, [193, 201], 1], [1, [193, 201], 2]] };
// The conducting system (art direction 4.2 and C1.3 to C1.5, the recipe's geometry): the SA node an
// ellipse along the epicardium of the lateral RA wall at the SVC junction; the AV node in the
// atrioventricular septum (triangle of Koch) just above the tricuspid's septal hinge; the His bundle
// through the membranous septum to the muscular crest; the right bundle branch 3 to 4 units inside the
// septum's RV face, to the RV apex; the left bundle branch inside its LV face, fanning early into two
// fascicles toward the LV apex; Purkinje fibres up the free walls just under the endocardium. No
// internodal tracts: the atrial spread is a wash (C1.4).
const CONDUCTION = {
  sa: { c: [45, 96], rx: 4.8, ry: 2.8, rot: 122 }, av: { c: [100, 156], rx: 4.4, ry: 2.9, rot: 35 }, his: 'M100 156 L107 165',
  lbb: ['M107 165 L117 159 C128 196 154 234 179 249', 'M117 159 C123 189 140 218 162 237'], rbb: 'M107 165 C106 190 126 212 148 227',
  purkinje: ['M182 254 C192 254 201 246 206 230 C215 200 216 160 210 134', 'M145.2 233.4 C141.87 234 131.77 236.37 125.2 237 C118.63 237.63 112.23 237.9 105.8 237.2 C99.37 236.5 92.67 234.87 86.6 232.8 C80.53 230.73 75.05 228.32 69.4 224.8 C63.75 221.28 57.42 216.65 52.7 211.7 C47.98 206.75 43.03 197.87 41.1 195.1'],
};
const SEC_AT = {
  aorta: [159, 24], 'pulmonary-trunk': [163, 72], 'aortic-valve': [133.5, 150], 'pulmonary-valve': [166, 88], mitral: [176, 150], tricuspid: [64, 200],
  septum: [142, 216], svc: [62, 40], ivc: [40, 214], 'pulmonary-veins': [226, 104], apex: [196, 258], sa: [45, 100], av: [96, 158], rvot: [108, 150],
  ra: [66, 146], rv: [100, 226], la: [180, 122], lv: [178, 200],
};
// The cavities and their maps for a section's ventricular volumes (area fractions), shared by the
// section and its overlays.
function secVolumes(vol = {}) {
  const v = { lv: 1, rv: 1, ...vol };
  const sizeLv = sectionGeometry.sizeForArea('lv', clamp(v.lv, 0.25, 1.3)), sizeRv = sectionGeometry.sizeForArea('rv', clamp(v.rv, 0.25, 1.3));
  const mapLv = sizeLv === 1 ? q => q : secMap('lv', sizeLv), mapRv = sizeRv === 1 ? q => q : secMap('rv', sizeRv);
  return { lvD: secCavity('lv', sizeLv), rvD: secCavity('rv', sizeRv), mapLv, mapRv, lvMap: q => q[1] > 150 ? mapLv(q) : q, rvMap: q => q[1] > 170 ? mapRv(q) : q };
}
const STAGES = { sa: 0, atria: 0, av: 0, his: 0, bundles: 0, purkinje: 0, ventricles: 0 };
// The conducting system's markup in the section's native coordinates, and its geometry.
function conductionMarkup({ stage = {}, s = 1, parts = {}, key, volume } = {}) {
  const c = { ...STAGES, ...stage }, CN = P.conduction, V = secVolumes(volume), P_ = n => partAttr(parts, n);
  const id = b => uid(b, key != null ? `${key}-${b}` : undefined), w = t => f(SW[t] / s);
  const lenOf = d => Math.max(1, Math.round(pathLength(d)));
  const front = (d, k, wd) => k > 0 ? `<path d="${d}" fill="none" stroke="${P.ui.blue}" stroke-width="${f(wd / s)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${lenOf(d)} ${lenOf(d)}" stroke-dashoffset="${f(lenOf(d) * (1 - clamp(k, 0, 1)))}"/>` : '';
  // a fibre: conduction tissue in its own line colour, and a blue front that runs along it with k
  const fibre = (d, k, wd = 2.4) => `<path d="${d}" fill="none" stroke="${CN.line}" stroke-width="${f((wd + 1.4) / s)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${CN.base}" stroke-width="${f(wd / s)}" stroke-linecap="round" stroke-linejoin="round"/>` + front(d, k, wd + 0.4);
  // the Purkinje network: finer and dashed (a network, not one cable), lit the same way
  const pk = (d, k) => `<path d="${d}" fill="none" stroke="${CN.lo}" stroke-width="${f(2.2 / s)}" stroke-dasharray="4 2.6" stroke-linecap="round"/>` + front(d, k, 2.4);
  // a node: an ellipse of conduction tissue; firing, a blue halo grows round it
  const node = ({ c: [cx, cy], rx, ry, rot }, k) => `<g transform="rotate(${rot} ${cx} ${cy})">`
    + (k > 0 ? `<ellipse cx="${cx}" cy="${cy}" rx="${f(rx + 5 * k)}" ry="${f(ry + 5 * k)}" fill="${P.ui.blue}" fill-opacity="${f(0.28 * k)}"/>` : '')
    + `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${k > 0.5 ? P.ui.blueWash : CN.base}" stroke="${k > 0 ? P.ui.blue : CN.line}" stroke-width="${w('internal')}"/></g>`;
  const purk = [mapPath(CONDUCTION.purkinje[0], V.lvMap), mapPath(CONDUCTION.purkinje[1], V.rvMap)];
  // the waves: blue washes through the muscle only (the cavities are cut out), the atria from the SA
  // node, the ventricles from the septum (septum first, then the apex and free walls, the base last)
  const wave = (name, part, terr, holes, k, from, r, op) => {
    const ca = id(`hcw${name}`), cb = id(`hcm${name}`);
    return `<g ${P_(part)} data-ax-wave="${name}"><clipPath id="${ca}">${terr}</clipPath><clipPath id="${cb}"><path clip-rule="evenodd" d="${SIL} ${holes}"/></clipPath>`
      + `<g clip-path="url(#${ca})"><circle cx="${from[0]}" cy="${from[1]}" r="${f(r * clamp(k, 0, 1))}" fill="${P.ui.blue}" fill-opacity="${op}" clip-path="url(#${cb})"/></g></g>`;
  };
  const waves = (c.atria > 0 ? wave('atria', 'ra la', `<polygon points="${TERR.ra}"/><polygon points="${TERR.la}"/><path d="${IAS_D}"/>`, `${RA_D} ${LA_D}`, c.atria, CONDUCTION.sa.c, 175, 0.32) : '')
    + (c.ventricles > 0 ? wave('ventricles', 'lv rv septum', `<polygon points="${TERR.lv}"/><polygon points="${TERR.rv}"/>`, `${V.rvD} ${V.lvD}`, c.ventricles, [132, 200], 125, 0.3) : '');
  const svg = waves
    + `<g ${P_('conduction purkinje')}>${purk.map(d => pk(d, c.purkinje)).join('')}</g>`
    + `<g ${P_('conduction bundle-branches rbb')}>${fibre(CONDUCTION.rbb, c.bundles)}</g>`
    + `<g ${P_('conduction bundle-branches lbb')}>${CONDUCTION.lbb.map(d => fibre(d, c.bundles)).join('')}</g>`
    + `<g ${P_('conduction his')}>${fibre(CONDUCTION.his, c.his, 2.8)}</g>`
    + `<g ${P_('conduction av')}>${node(CONDUCTION.av, c.av)}</g>`
    + `<g ${P_('conduction sa')}>${node(CONDUCTION.sa, c.sa)}</g>`;
  const on = (d, k, n) => samplePath(d, n)[k];
  return {
    svg, paths: { sa: [...CONDUCTION.sa.c, CONDUCTION.sa.ry], av: CONDUCTION.av.c, his: CONDUCTION.his, lbb: CONDUCTION.lbb, rbb: CONDUCTION.rbb, purkinje: purk },
    at: { sa: CONDUCTION.sa.c, av: CONDUCTION.av.c, his: on(CONDUCTION.his, 1, 3), lbb: on(CONDUCTION.lbb[0], 2, 5), rbb: on(CONDUCTION.rbb, 2, 5), 'bundle-branches': on(CONDUCTION.lbb[1], 2, 5), purkinje: on(purk[0], 3, 5) },
  };
}
/** The conducting system as an overlay for heartSection, in the same box (240 x 280, top-left; give it
 *  the section's x, y and s): SA node, AV node, His bundle, left and right bundle branches, Purkinje
 *  fibres, and the atrial and ventricular waves. Options: { x, y, s, stage: { sa, atria, av, his,
 *  bundles, purkinje, ventricles } 0..1 (each structure lights blue as its value rises: nodes glow,
 *  fibres fill along their length, waves spread through the muscle), volume: { lv, rv } (as the
 *  section's, so the Purkinje fibres and the wave follow the cavities), parts, key }. Parts (leaves):
 *  conduction plus sa, av, his, bundle-branches lbb, bundle-branches rbb, purkinje; the waves carry
 *  their chambers' names (ra la; lv rv septum), so one rename of the section lights both. */
export function heartConduction(opts = {}) {
  const { x = 0, y = 0, s = 1 } = opts, m = conductionMarkup(opts), toPic = q => [x + q[0] * s, y + q[1] * s];
  const svg = `<g class="ax-heart-conduction" transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${f(s)})` : ''}">${m.svg}</g>`;
  return artOf(svg, [x, y, 240 * s, 280 * s].map(f), Object.fromEntries(Object.entries(m.at).map(([k, p]) => [k, toPic(p)])), () => '', { paths: m.paths });
}
/** The four-chamber section. Options: { x, y, s, valves: { tricuspid, mitral, aortic, pulmonary } 0..1 open
 *  (default: diastole, atrioventricular open, semilunar shut), volume: { lv, rv } area fraction 0.30..1.25,
 *  squeeze 0..1, conduction: false | { sa, atria, av, his, bundles, purkinje, ventricles } 0..1,
 *  flow: false | { inflow, outflow, phase }, rvot: 'solid' | 'ghost', emphasis: [part names], parts, key }. */
export function heartSection(opts = {}) {
  const { x = 0, y = 0, s = 1, squeeze = 0, conduction = false, flow = false, emphasis = [], parts = {}, key } = opts;
  const valves = { tricuspid: 1, mitral: 1, aortic: 0, pulmonary: 0, ...(opts.valves || {}) };
  const vol = { lv: 1, rv: 1, ...(opts.volume || {}) };
  const rvot = opts.rvot || (conduction ? 'ghost' : 'solid');
  const id = b => uid(b, key != null ? `${key}-${b}` : undefined);
  const ids = { epi: id('hsepi'), cut: id('hscut') };
  const P_ = n => partAttr(parts, n), em = n => emphasis.includes(n);
  const w = t => f(SW[t] / s);
  const { lvD, rvD, mapLv, mapRv, lvMap, rvMap } = secVolumes(vol);
  const T = (d, opt) => tube(d, { s, ...opt });
  const sq = clamp(squeeze, 0, 1);
  const behindTier = behind(
    T('M190 56 L190 272', { wall: 'artery', lumen: 'oxy', w: 24, lumenW: 15, highlight: false, cut: 'end' }).svg, 0.3);
  const rpa = behind(T('M160 60 L98 60', { wall: 'artery', lumen: 'deoxy', w: 17, lumenW: 9, highlight: false, cut: 'end' }).svg, 0.3);
  const ivc = behind(T('M40 186 L40 226', { wall: 'vein', lumen: 'deoxy', w: 22, lumenW: 17, highlight: false, cut: 'end' }).svg, 0.3);
  const branch = (d, w_, lw) => { const t = T(d, { wall: 'artery', lumen: 'oxy', w: w_, lumenW: lw, highlight: false }); const q = sampleAlong(d, 6), [px, py, a] = q[q.length - 1]; return t.svg + `<g class="${D2}">${cutFace(px, py, w_ / 2, w_ / 2 * 0.3, { wall: 'artery', lumen: 'oxy', rot: a + 90, lumenR: lw / 2 }).svg}</g>`; };
  const arch = branch('M137 26 L131 5', 15, 8) + branch('M157 21 L157 4', 11, 5) + branch('M174 25 L179 6', 11, 5)
    + T('M129 116 L128 58 C128 36 142 24 159 24 C176 24 190 36 190 56 L190 64', { wall: 'artery', lumen: 'oxy', w: 27, lumenW: 17 }).svg;
  const svc = T('M62 4 L62 96', { wall: 'vein', lumen: 'deoxy', w: 22, lumenW: 17, cut: 'start' }).svg;
  const pv = ['M238 104 L208 110', 'M238 126 L208 120'].map(d => T(d, { wall: 'vein', lumen: 'oxy', w: 12, lumenW: 8, highlight: false, cut: 'start' }).svg).join('');
  const terr = Object.entries(TERR).map(([n, pts]) => {
    const cid = id(`hst-${n}`), squeezed = sq > 0 && (n === 'lv' || n === 'rv');
    return `<g ${P_(n === 'heart' ? 'heart' : n)}><clipPath id="${cid}"><polygon points="${TERR_GROWN[n]}"/></clipPath><g clip-path="url(#${cid})">`
      + `<path d="${SIL}" fill="none" stroke="${P.myo.line}" stroke-width="${f(7 + 2 * SW.outline / s)}"/><path d="${SIL}" fill="none" stroke="url(#${ids.epi})" stroke-width="7"/>`
      + `<path d="${SIL}" fill="url(#${ids.cut})" stroke="${P.myo.lo}" stroke-width="${w('detail')}"/>`
      // squeeze: the ventricular wall darkens (an overlay; the shared gradients never change per frame)
      + (squeezed ? `<path d="${SIL}" fill="${P.myo.lo}" fill-opacity="${f(0.22 * sq)}"/>` : '') + '</g></g>';
  }).join('');
  const shade = (d, mat, n) => innerShadow(d, mat, id(`hss-${n}`), { cls: D2 });
  const leaf = (name, i) => {
    const [open, shut] = VALVES[name][i], k = easeIO(valves[name]);
    return k >= 1 ? open : k <= 0 ? shut : lerpPath(shut, open, k);
  };
  const leafSvg = name => [0, 1].map(i => `<path d="${leaf(name, i)}" fill="${P.valve.base}" stroke="${P.valve.line}" stroke-width="${f((em(name) ? SW.internal : SW.detail) / s)}"/>`).join('');
  const chords = (name, map) => {
    const kk = easeIO(valves[name]), list = CHORDAE[name];
    return list.map(([li, head, n], j) => {
      const tip = leafTip(leaf(name, li)), hd = map(head), out = [];
      for (let c = 0; c < n; c++) {
        const end = add(hd, [c * 1.6 - (n - 1) * 0.8, 0]), mid = add([(tip[0] + end[0]) / 2, (tip[1] + end[1]) / 2], [0, 3 * kk]);
        out.push(`<path d="M${pt(tip)} Q${pt(mid)} ${pt(end)}" fill="none" stroke="${P.valve.line}" stroke-width="${f(1 / s)}"${c || j ? ` class="${D2}"` : em(name) ? '' : ` class="${D3}"`}/>`);
      }
      return out.join('');
    }).join('');
  };
  const papD_ = (d, map) => mapPath(d, map);
  const fl = flow ? (() => {
    const ph = flow.phase || 0, inO = clamp(flow.inflow ?? 1, 0, 1), outO = clamp(flow.outflow ?? 1, 0, 1);
    const lvIn = mapLv([182, 212]), rvIn = mapRv([88, 222]), lvOut = mapLv([170, 215]), rvOut = mapRv([96, 214]);
    const ins = [smooth([[62, 30], [62, 90], [60, 140], [66, 190], rvIn]), smooth([[232, 110], [196, 114], [180, 126], lvIn])];
    const outs = [smooth([lvOut, [146, 190], [134, 158], [131, 130], [129, 80], [138, 36], [160, 30], [184, 40]]), smooth([rvOut, [104, 190], [106, 140], [118, 112], [146, 98], [164, 84], [163, 64]])];
    return ins.map(d => streamline(d, { phase: ph, opacity: inO })).join('') + outs.map(d => streamline(d, { phase: ph, opacity: outO })).join('');
  })() : '';
  const cond = conduction ? conductionMarkup({ stage: conduction, s, parts, key, volume: vol }).svg : '';
  const svg = `<g class="ax-heart-section" transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${f(s)})` : ''}">`
    + `<defs>${volumeGradient(ids.epi, 'myo', [40, 70, 170, 200])}${cutGradient(ids.cut, [130, 170], 120, P.myo.cut, P.myo.cutEdge)}</defs>`
    + `<g ${P_('aorta')}>${behindTier}</g><g ${P_('pulmonary-trunk')}>${rpa}</g><g ${P_('vena-cava')}>${ivc}</g>`
    + `<g ${P_('aorta')}>${arch}</g><g ${P_('vena-cava')}>${svc}</g><g ${P_('pulmonary-veins')}>${pv}</g>`
    + terr
    + `<path ${P_('septum')} d="${SEPT_D}" fill="${P.septum.base}"/>`
    + `<path ${P_('interatrial-septum')} d="${IAS_D}" fill="${P.septum.base}" class="${D3}"/>`
    + `<g ${P_('ra')}><rect x="53.5" y="80" width="17" height="18" fill="${P.deoxy.base}"/><rect x="31.5" y="186" width="17" height="10" fill="${P.deoxy.base}"/><path d="${RA_D}" fill="${P.deoxy.base}"/>${shade(RA_D, 'deoxy', 'ra')}</g>`
    + `<g ${P_('rv')}><path d="${rvD}" fill="${P.deoxy.base}"/>${shade(rvD, 'deoxy', 'rv')}</g>`
    + `<g ${P_('la')}><polygon points="204,106.8 220,103.6 220,111.6 204,114.8" fill="${P.oxy.base}"/><polygon points="204,115.2 220,118.4 220,126.4 204,123.2" fill="${P.oxy.base}"/><path d="${LA_D}" fill="${P.oxy.base}"/>${shade(LA_D, 'oxy', 'la')}</g>`
    + `<g ${P_('lv')}><path d="${lvD}" fill="${P.oxy.base}"/>${shade(lvD, 'oxy', 'lv')}</g>`
    + `<g ${P_('aorta')}><path d="M118 148 C110 140 110 126 117 117 L116.5 80 L140.5 80 L141 116 C150 122 151 136 149 141 Z" fill="${P.artery.base}" stroke="${P.artery.line}" stroke-width="${w('internal')}"/><path d="M121 147 C114 139 114 127 120 119 L120 80 L137 80 L138 119 C146 125 147 134 146 139 Z" fill="${P.oxy.base}"/></g>`
    + `<g ${P_('rv')}${em('papillary') ? '' : ` class="${D3}"`}><path d="${papD_(PAP.rv, rvMap)}" fill="${P.myo.cutEdge}" stroke="${P.myo.papLine}" stroke-width="${w('detail')}"/></g>`
    + `<g ${P_('lv')}${em('papillary') ? '' : ` class="${D3}"`}><path d="${papD_(PAP.lvA, lvMap)}" fill="${P.myo.cutEdge}" stroke="${P.myo.papLine}" stroke-width="${w('detail')}"/><path d="${papD_(PAP.lvP, lvMap)}" fill="${P.myo.cutEdge}" stroke="${P.myo.papLine}" stroke-width="${w('detail')}"/></g>`
    + `<g ${P_('tricuspid')}${em('tricuspid') ? '' : ` class="${D3}"`}>${leafSvg('tricuspid')}${chords('tricuspid', q => q[0] > 100 ? q : rvMap(q))}</g>`
    + `<g ${P_('mitral')}${em('mitral') ? '' : ` class="${D3}"`}>${leafSvg('mitral')}${chords('mitral', lvMap)}</g>`
    + `<g ${P_('aortic-valve')}>${leafSvg('aortic')}</g>`
    + `<g ${P_('pulmonary-trunk')}>${T('M166 88 L162 58', { wall: 'artery', lumen: 'deoxy', w: 22, lumenW: 13 }).svg}${T('M162 60 C176 58 196 58 214 60', { wall: 'artery', lumen: 'deoxy', w: 15, lumenW: 8, highlight: false, cut: 'end' }).svg}</g>`
    + `<g ${P_('rv rvot')}${rvot === 'ghost' ? ' opacity=".18"' : ''}><path d="M93 198 C93 166 95 132 102 116 C112 98 136 88 160 80 L172 98 C148 106 128 112 123 124 C119 138 119 168 121 198 Z" fill="${P.myo.rvot}" stroke="${P.myo.line}" stroke-width="${f(1.4 / s)}"/><path d="M97.5 206 C97.5 166 99.5 134 105.5 119.5 C115 103 138 94 162 85.5 L169 95.5 C146 103 124 109 118.5 122.5 C115 137 115 168 116.5 206 Z" fill="${P.deoxy.base}"/></g>`
    + `<g ${P_('pulmonary-valve')}${rvot === 'ghost' ? ' opacity=".18"' : ''}>${leafSvg('pulmonary')}</g>`
    + cond + fl + '</g>';
  const toPic = q => [x + q[0] * s, y + q[1] * s];
  const at = Object.fromEntries(Object.entries(SEC_AT).map(([k, p]) => [k, toPic(k === 'lv' || k === 'apex' ? p : p)]));
  at.mitral = toPic(valves.mitral > 0.5 ? [176, 150] : [180, 134]);
  at.tricuspid = toPic(valves.tricuspid > 0.5 ? [64, 200] : [70, 184]);
  if (conduction) for (const k of ['his', 'lbb', 'rbb', 'purkinje', 'bundle-branches']) at[k] = toPic(conductionMarkup({}).at[k]);
  return artOf(svg, [x, y, 240 * s, 280 * s].map(f), at, (st = {}) => secCavity('lv', sectionGeometry.sizeForArea('lv', clamp((st.volume || {}).lv ?? 1, 0.25, 1.3))));
}

/* =====================================================================================================
   The heart from the front (anterior view), native box 200 x 230, top-left; and its icon.
   Apex down and to the viewer's right, formed by the LV; the RA forms the viewer's left (the patient's
   right) border with the SVC entering above and the IVC below; the RV forms most of the front face;
   the LV the viewer's right border and the apex, behind the anterior interventricular groove; the left
   auricle peeks out above it beside the pulmonary trunk. The pulmonary trunk leaves the RV's conus
   in front of the aortic root and runs up and to the viewer's right under the arch; the ascending
   aorta rises behind it and arches over to the viewer's right with its three branches. Stated
   simplifications: the right pulmonary artery (behind the ascending aorta), the descending aorta and
   the pulmonary veins (on the back) are not drawn; vessels are see-through tubes (the convention of
   the section). Coronary arteries run in the atrioventricular and interventricular grooves on a
   track of epicardial fat.
   ===================================================================================================== */
const EX_RA = 'M48 62 C36 80 28 108 31 136 C33 156 41 170 56 176 C64 158 70 130 80 106 C86 94 94 86 102 80 C98 70 90 64 80 64 C70 62 58 60 48 62 Z';
const EX_V = 'M56 176 C64 158 70 130 80 106 C86 94 94 86 102 80 C112 76 124 76 134 80 C148 82 164 86 178 96 C192 112 198 148 190 178 C184 198 174 212 166 218 C150 216 124 208 100 198 C82 191 66 186 56 176 Z';
const EX_LA = 'M164 88 C168 76 180 70 190 74 C198 78 198 90 192 96 C186 100 176 98 170 96 Z';
const EX_IVG = 'M150 84 C150 120 152 170 150 212';           // the anterior interventricular groove
const EX_AVG = 'M100 82 C86 96 76 120 68 146 C64 160 60 170 56 178'; // the right atrioventricular groove
const EX_AORTA = 'M108 92 C103 74 100 58 106 44 C114 28 138 22 156 30 C168 36 176 46 178 58';
const EX_BRANCH = [['M112 38 L101 4', 12, 8], ['M132 28 L131 3', 9, 6], ['M151 30 L158 5', 9, 6]];
const EX_PT = 'M126 92 C128 80 136 72 148 66';
const EX_LPA = 'M146 67 C160 64 176 66 194 72';
const EX_SVC = 'M66 26 L66 68', EX_IVC = 'M56 166 L56 200';
const EX_SA = { c: [53, 68], rx: 5, ry: 3, rot: 160 };
const EX_B = [112, 104];                                // the ventricles squeeze toward their base
// Map a ventricle point for beat k: drawn in toward the base, more the further from it, so the
// atrioventricular groove (the ventricles' edge against the atria) stays put.
const exSqueeze = k => q => { const d = sub(q, EX_B), r = len(d), wgt = clamp((r - 18) / 50, 0, 1); return add(EX_B, d, 1 - 0.065 * k * wgt); };
const exGeometry = (beat = 0) => {
  const m = beat ? exSqueeze(clamp(beat, 0, 1)) : null, mp = d => m ? mapPath(d, m) : d;
  const V = mp(EX_V);
  return { silhouette: `${EX_RA} ${V}`, ventricles: V, ivg: mp(EX_IVG), atria: { ra: EX_RA, la: EX_LA }, aorta: EX_AORTA, pulmonaryTrunk: EX_PT };
};
/** The heart from the front. Options: { x, y, s, beat 0..1 (systole: the ventricles draw in and darken),
 *  sa = true (the SA node), saGlow 0..1 (the node firing), coronaries = true, activation: { atria,
 *  ventricles } 0..1 (blue waves over the surface: the atria from the SA node, the ventricles from the
 *  septum and apex), emphasis, parts, key }. Box 200 x 230, top-left. Parts (leaves): heart atria ra,
 *  heart atria la, heart ventricles rv, heart ventricles lv, sa, aorta, pulmonary-trunk, vena-cava,
 *  coronary. outline(state) is the silhouette at { beat }. */
export function heartExterior(opts = {}) {
  const { x = 0, y = 0, s = 1, beat = 0, sa = true, saGlow = 0, coronaries = true, activation = {}, parts = {}, key } = opts;
  const id = b => uid(b, key != null ? `${key}-${b}` : undefined), P_ = n => partAttr(parts, n), w = t => f(SW[t] / s);
  const g = exGeometry(beat), k = clamp(beat, 0, 1);
  const ids = { epi: id('hxepi'), rv: id('hxrv'), lv: id('hxlv'), wa: id('hxwa'), wv: id('hxwv') };
  // the ventricles split at the interventricular groove so each ventricle lights its own surface
  const gp = flatten(g.ivg, 12), rvPoly = [...gp, [0, 230], [0, 60]], lvPoly = [...gp, [200, 230], [200, 60]];
  const poly = q => q.map(p => `${f(p[0])},${f(p[1])}`).join(' ');
  const T = (d, o) => tube(d, { s, ...o });
  const surf = (d, cls = '') => `<path d="${d}" fill="none" stroke="${P.myo.line}" stroke-width="${f(2 * SW.outline / s)}" stroke-linejoin="round"/><path d="${d}" fill="url(#${ids.epi})"${cls}/>`;
  const wash = (d, k_, from, r, cid) => k_ > 0 ? `<clipPath id="${cid}"><path d="${d}"/></clipPath><circle cx="${from[0]}" cy="${from[1]}" r="${f(r * clamp(k_, 0, 1))}" fill="${P.ui.blue}" fill-opacity=".3" clip-path="url(#${cid})"/>` : '';
  const fat = d => `<path d="${d}" fill="none" stroke="${P.lipid.base}" stroke-opacity=".75" stroke-width="9" stroke-linecap="round" class="${D2}"/>`;
  const coronary = d => `<path d="${d}" fill="none" stroke="${P.artery.line}" stroke-width="${f(3.4 + 2 * SW.detail / s)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.oxy.base}" stroke-width="3.4" stroke-linecap="round"/>`;
  const rca = 'M100 86 C86 98 76 122 68 148 C64 160 60 170 57 178', lad = mapPath('M152 92 C151 126 153 172 151 206', k ? exSqueeze(k) : q => q);
  const [sx, sy] = EX_SA.c;
  const svg = `<g class="ax-heart-exterior" transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${f(s)})` : ''}">`
    + `<defs>${volumeGradient(ids.epi, 'myo', [26, 60, 172, 160])}</defs>`
    + `<g ${P_('vena-cava')}>${T(EX_SVC, { wall: 'vein', lumen: 'deoxy', w: 20, lumenW: 15, cut: 'start' }).svg}${T(EX_IVC, { wall: 'vein', lumen: 'deoxy', w: 20, lumenW: 15, cut: 'end', highlight: false }).svg}</g>`
    + `<g ${P_('aorta')}>${EX_BRANCH.map(([d, w_, lw]) => T(d, { wall: 'artery', lumen: 'oxy', w: w_, lumenW: lw, highlight: false, cut: 'end' }).svg).join('')}${T(EX_AORTA, { wall: 'artery', lumen: 'oxy', w: 26, lumenW: 18, cut: 'end' }).svg}</g>`
    + `<g ${P_('heart atria la')}>${surf(EX_LA)}</g>`
    + `<g ${P_('heart ventricles rv')}><clipPath id="${ids.rv}"><polygon points="${poly(rvPoly)}"/></clipPath><g clip-path="url(#${ids.rv})">${surf(g.ventricles)}`
    + `<path d="${g.ventricles}" fill="${P.myo.lo}" fill-opacity="${f(0.16 * k)}"/>${spec(98, 118, 16, 9, -30)}</g></g>`
    + `<g ${P_('heart ventricles lv')}><clipPath id="${ids.lv}"><polygon points="${poly(lvPoly)}"/></clipPath><g clip-path="url(#${ids.lv})">${surf(g.ventricles)}`
    + `<path d="${g.ventricles}" fill="${P.myo.lo}" fill-opacity="${f(0.16 * k + 0.1)}"/></g></g>`
    + `<g ${P_('heart atria ra')}>${surf(EX_RA)}${spec(46, 96, 7, 12, 10)}</g>`
    + (activation.atria > 0 || activation.ventricles > 0 ? `<g ${P_('heart atria ventricles')} data-ax-wave="surface">${wash(`${EX_RA} ${EX_LA}`, activation.atria || 0, EX_SA.c, 120, ids.wa)}${wash(g.ventricles, activation.ventricles || 0, [150, 190], 170, ids.wv).replace('fill-opacity=".3"', 'fill-opacity=".22"')}</g>` : '')
    + (coronaries ? `<g ${P_('coronary')}>${fat(rca)}${fat(lad)}${coronary(rca)}${coronary(lad)}</g>` : `<g ${P_('heart ventricles')}><path d="${g.ivg}" fill="none" stroke="${P.myo.lo}" stroke-width="${w('internal')}"/></g>`)
    + `<g ${P_('pulmonary-trunk')}>${T(EX_LPA, { wall: 'artery', lumen: 'deoxy', w: 15, lumenW: 9, cut: 'end', highlight: false }).svg}${T(EX_PT, { wall: 'artery', lumen: 'deoxy', w: 24, lumenW: 16, cap: 'round' }).svg}</g>`
    + (sa ? `<g ${P_('sa')}><g transform="rotate(${EX_SA.rot} ${sx} ${sy})">`
      + (saGlow > 0 ? `<ellipse cx="${sx}" cy="${sy}" rx="${f(EX_SA.rx + 6 * saGlow)}" ry="${f(EX_SA.ry + 6 * saGlow)}" fill="${P.ui.blue}" fill-opacity="${f(0.3 * saGlow)}"/>` : '')
      + `<ellipse cx="${sx}" cy="${sy}" rx="${EX_SA.rx}" ry="${EX_SA.ry}" fill="${saGlow > 0.5 ? P.ui.blueWash : P.conduction.base}" stroke="${saGlow > 0 ? P.ui.blue : P.conduction.line}" stroke-width="${w('internal')}"/></g></g>` : '')
    + '</g>';
  const toPic = q => [x + q[0] * s, y + q[1] * s];
  const apex = flatten(g.ventricles, 16).reduce((a, p) => p[1] > a[1] ? p : a);
  const at = { sa: EX_SA.c, aorta: [132, 26], 'pulmonary-trunk': [134, 78], svc: [66, 54], ivc: [56, 192], ra: [48, 120], rv: [110, 150], lv: [174, 150], la: [184, 84], apex, coronary: [151, 150] };
  return artOf(svg, [x, y, 200 * s, 230 * s].map(f), Object.fromEntries(Object.entries(at).map(([n, p]) => [n, toPic(p)])),
    (st = {}) => mapPath(exGeometry(st.beat || 0).silhouette, toPic), { geometry: g });
}
/** A small recognisable heart (anterior view: apex down and to the viewer's right, the aorta arching
 *  over the pulmonary trunk, the SVC on the left), for rows, maps and flow diagrams. 48 x 56 about its
 *  centre (x, y). Options: { x, y, s, beat 0..1 (the body draws in a little), parts, key }. One part,
 *  heart; no detail drops out at any size; no text, no specular. */
export function heartIcon(opts = {}) {
  const { x = 0, y = 0, s = 1, beat = 0, parts = {} } = opts;
  // the exterior's own outlines, fitted into the icon's box (24 / 100 of the exterior)
  const K = 0.24, O = [-27.6, -28], ic = q => [O[0] + q[0] * K, O[1] + q[1] * K], k = 1 - 0.06 * clamp(beat, 0, 1);
  const body = mapPath(`${EX_RA} ${EX_V}`, ic), groove = mapPath('M150 90 C150 124 152 168 150 206', ic);
  const ves = (d, mat, wd) => `<path d="${mapPath(d, ic)}" fill="none" stroke="${P[mat].line}" stroke-width="${f(wd + 2.5)}" stroke-linecap="round"/><path d="${mapPath(d, ic)}" fill="none" stroke="${P[mat].base}" stroke-width="${f(wd)}" stroke-linecap="round"/>`;
  const [bx, by] = ic(EX_B), wd = f(SW.outline);
  const svg = `<g ${partAttr(parts, 'heart')} class="ax-heart-icon" transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${f(s)})` : ''}">`
    + ves('M66 30 L66 70', 'deoxy', 3.6) + ves('M108 92 C103 74 100 58 106 44 C114 28 138 22 156 30 C168 36 176 46 178 62', 'oxy', 4.2)
    + `<g transform="translate(${f(bx * (1 - k))} ${f(by * (1 - k))}) scale(${f(k)})"><path d="${body}" fill="${fill('myo')}" stroke="${P.myo.line}" stroke-width="${wd}" stroke-linejoin="round"/>`
    + `<path d="${groove}" fill="none" stroke="${P.myo.line}" stroke-width="1.25" stroke-linecap="round" stroke-opacity=".7"/></g>`
    + ves('M126 94 C128 80 136 72 150 66', 'deoxy', 3.8) + '</g>';
  const toPic = q => [x + q[0] * s, y + q[1] * s];
  return artOf(svg, [x - 24 * s, y - 28 * s, 48 * s, 56 * s].map(f), { heart: toPic(ic([110, 150])), apex: toPic(ic([166, 218])), aorta: toPic(ic([132, 26])) },
    () => mapPath(body, toPic), { geometry: { silhouette: body, aorta: mapPath(EX_AORTA, ic) } });
}
