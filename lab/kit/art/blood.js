// The Lab's blood: red cells and hemoglobin (art direction section 4.7; the oxygen-hemoglobin-dissociation
// brief). Plain ES module; import it unversioned as /lab/kit/art/blood.js.
//
//   rbc(opts): one red blood cell, a biconcave disc in face, oblique or edge view, tinted by its oxygen,
//     optionally cut away to show the hemoglobin packed inside. An Art anchored at the cell's centre.
//   rbcStream(opts): red cells travelling along a path, looping seamlessly in phase.
//   hemoglobin(opts): the tetramer: two alpha and two beta globin subunits, each holding a heme with its
//     iron; a seat per heme, empty or holding O2 or CO; T (tense) to R (relaxed) by r. An Art anchored at
//     its centre, 80 x 80 native.
//   rbcColours(ox), rbcGeometry, hbGeometry(r), hbLod(s): the colours and geometry behind them, for
//     lessons (keys, captions) and tests.
//
// Expected behaviour (tested by tools/art-tests/blood.test.mjs, looked at in tools/art-gallery/blood.html):
//   - Every primitive takes the common options { x, y, s, rot, flip, emphasis, parts, key } and returns
//     an Art whose box and at are in picture coordinates, and whose outline(state) is a path in picture
//     coordinates for the art ghost. Parts are leaves and parts renames them.
//   - The red cell's edge profile is the measured biconcave disc (Evans and Fung 1972): about 0.8 um at
//     the centre, about 2.6 um across the torus, on a 7.8 um disc. The views are projections of that
//     one surface, so face, oblique and edge cells agree. No nucleus, ever.
//   - Oxygen colours the cell, from the deoxygenated cell colours of P (a darker, bluer red) at ox 0 to
//     the oxygenated ones at ox 1. A red cell is never drawn blue.
//   - Shading is flat layered paths in the picture's one light (upper left): no gradients, no clips, no
//     ids, so a row of cells or molecules costs only path strings and works in any svg, string or mount.
//   - rbcStream: each cell travels the whole path once per unit of phase (u = i / n + phase), so phase 0
//     and 1 draw the same frame; cells fade in and out over the first and last 8 % of the path.
//   - hemoglobin: alphas on one diagonal (seats in reading order: top left alpha, top right beta, bottom
//     left beta, bottom right alpha); the left column is one alpha-beta dimer, the right column the
//     other. T to R (Perutz): the dimers turn about 15 degrees against each other, the central cavity
//     between the betas narrows, the iron moves from just below the heme plane into it (the drawing
//     exaggerates the displacement so it can be seen), and the T state's salt bridges, drawn as ticks
//     across the subunit contacts, break. 2,3-BPG binds the T state's central cavity only. O2 binds end
//     on and bent (Fe-O-O about 120 degrees); CO binds straight (Fe-C-O about 180 degrees). Ligands
//     stay at least 8 units across on screen at row size.
//   - Level of detail follows the molecule's drawn size (80 s units): full at 56 or more (subunit
//     shading, hemes with iron, ligands, bridges), row at 22 to 56 (hemes without iron), symbol below 22
//     (four subunits only). Fine shading carries the kit's detail class (ax-d2) as well.
import { P, SW, D2, f, pt, mix, artOf, place, samplePath, smooth, artGhost, partName, placer, partAttr } from './core.js';

/* ---------- colours ----------
   Globins, heme and iron are P.hbAlpha, P.hbBeta, P.heme and P.iron; the deoxygenated cell outline is
   P.rbc.deoxyLine (core.js). */
const WHITE = P.ui.white;

/* ---------- small helpers ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = d => d * Math.PI / 180;
const nameOf = partName; // core: renames, multi-names, each word once
const mapper = o => placer(o).map; // core placer: the same numbers place() uses
const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
const pathOf = (pts, closed = true) => `M${pts.map(pt).join(' L')}${closed ? ' Z' : ''}`;
const arc = (cx, cy, R, a0, a1) => {
  const p = a => [cx + R * Math.cos(rad(a)), cy + R * Math.sin(rad(a))];
  return `M${pt(p(a0))} A${f(R)} ${f(R)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${pt(p(a1))}`;
};
const strokeArc = (d, col, w, op, cls = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${f(op)}" stroke-width="${f(w)}" stroke-linecap="round"${cls ? ` class="${cls}"` : ''}/>`;
const bboxOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
// Star-shaped hull: the farthest point in each of nb angle bins about a centre.
function polarHull(pts, [cx, cy], nb = 72) {
  const best = new Array(nb).fill(null);
  for (const p of pts) {
    const a = Math.atan2(p[1] - cy, p[0] - cx), k = ((Math.round(a / (2 * Math.PI) * nb) % nb) + nb) % nb, d = Math.hypot(p[0] - cx, p[1] - cy);
    if (!best[k] || d > best[k][0]) best[k] = [d, p];
  }
  return best.filter(Boolean).map(b => b[1]);
}

/* =====================================================================================================
   Red blood cell
   ===================================================================================================== */
// Half thickness over the cell's radius at a fraction rho of the radius (Evans and Fung's fit, R0 3.91 um:
// c0 0.207, c1 2.003, c2 -1.123, halved).
const halfThickness = rho => { const q = rho * rho; return q >= 1 ? 0 : Math.sqrt(1 - q) * (0.1035 + 1.0015 * q - 0.5615 * q * q); };
const TILT = rad(55);
// Unit-radius geometry for the oblique and edge views, built once.
const UNIT = (() => {
  const top = (rho, th) => [rho * Math.cos(th), rho * Math.sin(th) * Math.cos(TILT) - halfThickness(rho) * Math.sin(TILT)];
  const bot = (rho, th) => [rho * Math.cos(th), rho * Math.sin(th) * Math.cos(TILT) + halfThickness(rho) * Math.sin(TILT)];
  const cloudT = [], cloudB = [];
  for (let i = 0; i < 144; i++) for (let j = 0; j <= 16; j++) {
    const th = i / 144 * 2 * Math.PI, rho = 0.45 + 0.55 * j / 16;
    cloudT.push(top(rho, th)); cloudB.push(bot(rho, th));
  }
  const ring = (rho, a0, a1, n = 24) => Array.from({ length: n }, (_, i) => top(rho, rad(lerp(a0, a1, i / (n - 1)))));
  const sil = polarHull([...cloudT, ...cloudB], [0, 0], 60), face = polarHull(cloudT, [0, -halfThickness(0) * Math.sin(TILT)], 60);
  // edge view: x along the diameter, y the thickness; cosine spacing crowds samples toward the rim
  const xs = Array.from({ length: 33 }, (_, i) => -Math.cos(i / 32 * Math.PI));
  const edgeTop = xs.map(r => [r, -halfThickness(Math.abs(r))]), edgeBot = xs.slice().reverse().map(r => [r, halfThickness(Math.abs(r))]);
  return {
    oblique: { sil, face, pallor: Array.from({ length: 28 }, (_, i) => top(0.5, i / 28 * 2 * Math.PI)), ridge: ring(0.72, 200, 285), dimShade: ring(0.36, 200, 330), dimLit: ring(0.4, 30, 150), nearShade: ring(0.93, 20, 160) },
    edge: { sil: [...edgeTop, ...edgeBot.slice(1, -1)], top: edgeTop, bot: edgeBot },
  };
})();
export const rbcGeometry = { halfThickness, tilt: 55, unit: UNIT };

/* rbcColours(ox): the cell's colours at an oxygen fraction (0 deoxygenated, 1 oxygenated). */
export function rbcColours(ox = 1) {
  const k = clamp(ox, 0, 1);
  const rim = mix(P.rbc.deoxyRim, P.rbc.rim, k), centre = mix(P.rbc.deoxyCentre, P.rbc.base, k), line = mix(P.rbc.deoxyLine, P.rbc.line, k);
  return { rim, centre, line, torus: mix(rim, centre, 0.32), hi: mix(centre, WHITE, 0.5), lo: mix(rim, line, 0.5), cut: mix(rim, line, 0.4) };
}

// Hemoglobin packed in a cutaway's lower-right wedge (0 to 90 degrees): glyph centres, never on a radius.
function packWedge(R, g) {
  const out = [], step = g * 1.22, rowH = step * 0.866, m = g * 0.62;
  for (let j = 0, y = m; y < R; j++, y += rowH) for (let x = m + (j % 2) * step / 2; x < R; x += step) {
    const rr = Math.hypot(x, y);
    if (rr > R - g * 0.8 || rr < R * 0.12 + g * 0.5) continue;
    out.push([x, y]);
  }
  return out;
}

/* rbc({ x, y, s, rot, flip, view: 'face' | 'oblique' | 'edge', ox 0..1, r = 7, cutaway = false, emphasis,
   parts, key }) -> Art. Anchor: the cell's centre. Part: rbc. at: centre, rim, pallor (and cut with a
   cutaway). outline() is the cell's silhouette in picture coordinates. */
export function rbc(opts = {}) {
  const { view = 'face', ox = 1, r = 7, cutaway = false, emphasis = [], parts = {}, s = 1 } = opts;
  const c = rbcColours(ox), R = r, drawn = R * s, ow = clamp(drawn * 0.12, 1.25, SW.outline) / s;
  const det = emphasis.includes('rbc') ? '' : D2, map = mapper(opts);
  let body = '', sil, box, at;
  if (view === 'edge') {
    const E = UNIT.edge, sc = p => [p[0] * R, p[1] * R];
    sil = E.sil.map(sc);
    const silD = smooth(sil, { closed: true });
    const lowBand = [...E.bot.slice(2, -2).map(sc), ...E.bot.slice(2, -2).reverse().map(p => [p[0] * R, p[1] * R * 0.35])];
    const lobe = side => E.top.filter(p => side * p[0] > 0.55 && side * p[0] < 0.93).map(p => [p[0] * R, p[1] * R * 0.6]);
    body = `<path d="${silD}" fill="${c.torus}"/>`
      + `<path d="${smooth(lowBand, { closed: true })}" fill="${c.lo}" fill-opacity=".55"/>`
      + [-1, 1].map(sd => strokeArc(smooth(lobe(sd)), c.hi, R * 0.08, 0.7, det)).join('')
      + `<path d="${silD}" fill="none" stroke="${c.line}" stroke-width="${f(ow)}" stroke-linejoin="round"/>`;
    const zm = Math.max(...sil.map(p => Math.abs(p[1])));
    box = [-R, -zm, 2 * R, 2 * zm];
    at = { centre: [0, 0], rim: [-R * 0.86, -halfThickness(0.86) * R * 0.5], pallor: [0, 0] };
  } else if (view === 'oblique') {
    const O = UNIT.oblique, sc = p => [p[0] * R, p[1] * R];
    sil = O.sil.map(sc);
    const silD = smooth(sil, { closed: true });
    body = `<path d="${silD}" fill="${c.lo}"/>`
      + `<path d="${smooth(O.face.map(sc), { closed: true })}" fill="${c.torus}"/>`
      + strokeArc(smooth(O.nearShade.map(sc)), c.rim, R * 0.1, 0.5, det)
      + strokeArc(smooth(O.ridge.map(sc)), c.hi, R * 0.09, 0.6, det)
      + `<path d="${smooth(O.pallor.map(sc), { closed: true })}" fill="${c.centre}" stroke="${mix(c.torus, c.centre, 0.5)}" stroke-width="${f(R * 0.08)}"/>`
      + strokeArc(smooth(O.dimShade.map(sc)), c.lo, R * 0.09, 0.35, det)
      + strokeArc(smooth(O.dimLit.map(sc)), c.hi, R * 0.06, 0.5, det)
      + `<path d="${silD}" fill="none" stroke="${c.line}" stroke-width="${f(ow)}" stroke-linejoin="round"/>`;
    box = bboxOf(sil);
    at = { centre: [0, 0], rim: sc(O.ridge[8]), pallor: sc(O.pallor[21]).map((v, i) => i ? v * 0.6 : v * 0.3) };
  } else {
    sil = Array.from({ length: 32 }, (_, i) => [R * Math.cos(i / 32 * 2 * Math.PI), R * Math.sin(i / 32 * 2 * Math.PI)]);
    // soft shading as crescents (a circle minus a smaller, offset circle inside it): thick where the
    // surface turns from the light, thin where it faces it
    const cres1 = (ax, ay, ra, dx, dy, rb, col, op, cls) => `<path d="${circ(ax, ay, ra)} ${circ(ax + dx, ay + dy, rb)}" fill="${col}" fill-opacity="${f(op)}" fill-rule="evenodd"${cls ? ` class="${cls}"` : ''}/>`;
    // two stacked crescents, the second thinner, feather the inner edge (no blur in per-frame art)
    const cres = (ax, ay, ra, dx, dy, rb, col, op, cls = '') => cres1(ax, ay, ra, dx, dy, rb, col, op * 0.55, cls) + cres1(ax, ay, ra, dx * 0.55, dy * 0.55, rb + (ra - rb) * 0.35, col, op * 0.55, cls);
    const pc = 0.03 * R;
    body = `<circle cx="0" cy="0" r="${f(R)}" fill="${c.rim}"/>`
      + `<circle cx="${f(-0.04 * R)}" cy="${f(-0.05 * R)}" r="${f(0.9 * R)}" fill="${c.torus}"/>`
      + cres(0, 0, 0.97 * R, -0.09 * R, -0.1 * R, 0.83 * R, c.lo, 0.4)
      + cres(-0.03 * R, -0.03 * R, 0.8 * R, 0.07 * R, 0.08 * R, 0.69 * R, c.hi, 0.55, det)
      + `<circle cx="${f(pc)}" cy="${f(pc)}" r="${f(0.46 * R)}" fill="${mix(c.torus, c.centre, 0.5)}"/>`
      + `<circle cx="${f(pc)}" cy="${f(pc)}" r="${f(0.4 * R)}" fill="${c.centre}"/>`
      + cres(pc, pc, 0.46 * R, 0.05 * R, 0.06 * R, 0.39 * R, c.lo, 0.32, det)
      + cres(pc, pc, 0.42 * R, -0.04 * R, -0.05 * R, 0.36 * R, c.hi, 0.4, det);
    at = { centre: [0, 0], rim: [-0.62 * R, -0.62 * R], pallor: [0.03 * R, 0.03 * R] };
    if (cutaway) {
      const Ri = R - ow / 2, g = clamp(R * 0.12, 12, 18) / s;
      body += `<path d="M0 0 L${f(Ri)} 0 A${f(Ri)} ${f(Ri)} 0 0 1 0 ${f(Ri)} Z" fill="${c.cut}"/>`
        + `<path d="M${f(Ri)} 0 L0 0 L0 ${f(Ri)}" fill="none" stroke="${c.hi}" stroke-opacity=".8" stroke-width="${f(2 / s)}" stroke-linejoin="round"/>`;
      packWedge(R, g).forEach(([gx, gy], i) => {
        body += `<g data-hb="${f(gx)} ${f(gy)}" transform="translate(${f(gx)} ${f(gy)}) rotate(${(i * 47) % 90 - 45}) scale(${f(g / 80)})">${hbSymbol(g / 80 * s)}</g>`;
      });
      at.cut = [0.5 * R, 0.5 * R];
    }
    body += `<circle cx="0" cy="0" r="${f(R)}" fill="none" stroke="${c.line}" stroke-width="${f(ow)}"/>`;
    box = [-R, -R, 2 * R, 2 * R];
  }
  const native = artOf(`<g ${partAttr(parts, 'rbc')}>${body}</g>`, box.map(f), at);
  const out = place(native, opts);
  out.outline = () => smooth(sil.map(map), { closed: true });
  return out;
}

/* rbcStream({ d, n = 6, phase = 0, ox = 1 | [from, to] | u => ox, r = 7, s = 1, views, fade = 0.08,
   tumble = true, parts, key }) -> Art plus cells: [{ x, y, u, ox, opacity, view, angle }]. Each cell
   travels the whole path once per unit of phase. views cycles per cell (default face, oblique, face,
   oblique; 'edge' is available, but at a few units the true edge profile reads as a dumbbell). Part: rbc on each cell. */
const TABLES = new Map();
function table(d) {
  if (TABLES.has(d)) return TABLES.get(d);
  const pts = samplePath(d, 160), L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const t = { pts, L, total: L[L.length - 1] };
  if (TABLES.size > 64) TABLES.clear();
  TABLES.set(d, t);
  return t;
}
function along(tb, u) {
  const want = u * tb.total, { pts, L } = tb;
  let j = 1;
  while (j < L.length - 1 && L[j] < want) j++;
  const k = (want - L[j - 1]) / ((L[j] - L[j - 1]) || 1), a = pts[j - 1], b = pts[j];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI];
}
export function rbcStream(opts = {}) {
  const { d, n = 6, phase = 0, ox = 1, r = 7, s = 1, views = ['face', 'oblique', 'face', 'oblique'], fade = 0.08, tumble = true, parts = {}, emphasis = [] } = opts;
  const tb = table(d), oxAt = typeof ox === 'function' ? ox : Array.isArray(ox) ? u => lerp(ox[0], ox[1], u) : () => ox;
  const cells = [];
  let svg = '';
  for (let i = 0; i < n; i++) {
    let u = (((i / n + phase) % 1) + 1) % 1;
    u = Math.round(u * 1e9) / 1e9; if (u >= 1) u = 0;
    const [x, y, ang] = along(tb, u), view = views[i % views.length];
    const spin = tumble ? [0, 20, -25, 15, -10][i % 5] + 15 * Math.sin(2 * Math.PI * u + i) : 0;
    const angle = ang + (view === 'face' ? 0 : spin), o = oxAt(u), opacity = clamp(Math.min(u, 1 - u) / (fade || 1e-9), 0, 1);
    cells.push({ x, y, u, ox: o, opacity, view, angle });
    if (opacity <= 0.001) continue;
    svg += `<g data-cell="${i}"${opacity < 1 ? ` opacity="${f(opacity)}"` : ''}>${rbc({ x, y, s, r, view, ox: o, rot: angle, parts, emphasis }).svg}</g>`;
  }
  const [bx, by, bw, bh] = bboxOf(tb.pts), pad = r * s;
  return artOf(svg, [bx - pad, by - pad, bw + 2 * pad, bh + 2 * pad].map(f), { start: tb.pts[0], end: tb.pts[tb.pts.length - 1], first: cells.length ? [cells[0].x, cells[0].y] : tb.pts[0] }, () => d, { cells });
}

/* =====================================================================================================
   Hemoglobin
   ===================================================================================================== */
const HB = { d: 15, a: 16, n: 20 };
const KINDS = ['alpha', 'beta', 'beta', 'alpha'];          // reading order: TL, TR, BL, BR
const QUAD = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const DIMER = [-1, 1, -1, 1];                               // left column, right column
// A fixed lumpiness per subunit (globular, not a tile); the same at every r so outlines morph.
const LUMP = KINDS.map((_, i) => Array.from({ length: HB.n }, (_, k) => 0.05 * Math.sin(k * 2.1 + i * 1.7) + 0.035 * Math.cos(k * 3.3 + i * 2.3)));

/* hbGeometry(r): subunits [{ kind, c, angle, out, pts }], hemes [{ c, angle, out, feOut, fe }], cavity
   { c, r }, betaGap (distance between the beta centres), ligand(kind, i, atomR) -> { atoms, bend }. */
export function hbGeometry(r = 0) {
  r = clamp(r, 0, 1);
  const { d, a, n } = HB, turn = 7.5 * r, bIn = 2.6 * r, aOut = 0.6 * r, ex = lerp(2.3, 2.0, r);
  const subunits = QUAD.map(([qx, qy], i) => {
    const kind = KINDS[i], shift = kind === 'beta' ? -bIn : aOut, diag = [qx / Math.SQRT2, qy / Math.SQRT2];
    let c = [qx * d + diag[0] * shift, qy * d + diag[1] * shift];
    const angle = DIMER[i] * -turn, pv = [DIMER[i] * d, 0], A = rad(angle);
    const rel = [c[0] - pv[0], c[1] - pv[1]];
    c = [pv[0] + rel[0] * Math.cos(A) - rel[1] * Math.sin(A), pv[1] + rel[0] * Math.sin(A) + rel[1] * Math.cos(A)];
    const outA = Math.atan2(qy, qx) + A, out = [Math.cos(outA), Math.sin(outA)];
    // the heme pocket: a shallow notch on the outer face, wider in R (the heme more exposed)
    const dent = lerp(0.1, 0.15, r);
    const pts = Array.from({ length: n }, (_, k) => {
      const th = k / n * 2 * Math.PI, cs = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
      let rr = a / Math.pow(Math.pow(cs, ex) + Math.pow(sn, ex), 1 / ex) * (1 + LUMP[i][k]);
      const local = th - Math.atan2(qy, qx), dd = Math.atan2(Math.sin(local), Math.cos(local));
      rr *= 1 - dent * Math.exp(-(dd * dd) / (2 * 0.28 * 0.28));
      const g = th + A;
      return [c[0] + rr * Math.cos(g), c[1] + rr * Math.sin(g)];
    });
    return { kind, c, angle, out, pts };
  });
  const hemes = subunits.map(su => {
    // the heme sits in its pocket just inside the subunit's outer face, deeper in T, nearer the surface in R
    const reach = HB.a * (1 - lerp(0.1, 0.15, r)) * 1.08 - lerp(4.6, 3.4, r), c = [su.c[0] + su.out[0] * reach, su.c[1] + su.out[1] * reach];
    const feOut = lerp(1.7, 0, r);
    return { c, out: su.out, angle: Math.atan2(su.out[1], su.out[0]) * 180 / Math.PI + 90, feOut, fe: [c[0] - su.out[0] * feOut, c[1] - su.out[1] * feOut] };
  });
  const cavity = { c: [subunits.reduce((s, u) => s + u.c[0], 0) / 4, subunits.reduce((s, u) => s + u.c[1], 0) / 4], r: lerp(6, 2.5, r) };
  const betaGap = Math.hypot(subunits[1].c[0] - subunits[2].c[0], subunits[1].c[1] - subunits[2].c[1]);
  // O2 binds end on and bent (Fe-O-O about 120 degrees, the outer oxygen tipped clockwise); CO straight.
  const ligand = (kind, i, atomR = 3.2) => {
    const h = hemes[i], o = h.out, rot60 = [o[0] * 0.5 - o[1] * 0.866, o[0] * 0.866 + o[1] * 0.5];
    const reachL = h.feOut + 2.4 + atomR * 0.95, first = [h.fe[0] + o[0] * reachL, h.fe[1] + o[1] * reachL];
    const dir = kind === 'o2' ? rot60 : o, sec = [first[0] + dir[0] * atomR * 1.7, first[1] + dir[1] * atomR * 1.7];
    const v1 = [h.fe[0] - first[0], h.fe[1] - first[1]], v2 = [sec[0] - first[0], sec[1] - first[1]];
    const bend = Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180 / Math.PI;
    return { atoms: kind === 'o2' ? [['oxygen', first], ['oxygen', sec]] : [['carbon', first], ['oxygen', sec]], bend };
  };
  return { subunits, hemes, cavity, betaGap, ligand };
}
export const hbLod = s => 80 * s >= 56 ? 'full' : 80 * s >= 22 ? 'row' : 'symbol';
const matOf = kind => kind === 'alpha' ? P.hbAlpha : P.hbBeta;

// The symbol glyph (no seats): four flat subunits, outlined. Native 80 box; ow is the drawn scale.
function hbSymbol(sDrawn, r = 0) {
  const g = hbGeometry(r), w = f(1 / sDrawn);
  return g.subunits.map(su => { const m = matOf(su.kind); return `<path data-subunit="${su.kind}" d="${smooth(su.pts, { closed: true })}" fill="${m.base}" stroke="${m.line}" stroke-width="${w}"/>`; }).join('');
}

/* hemoglobin({ x, y, s, rot, flip, seats: 4 of 'o2' | 'co' | 'empty', r 0..1 (T to R), bpg 0..1,
   missing = false, lod: 'auto' | 'full' | 'row' | 'symbol', emphasis, parts, key }) -> Art. Anchor: the
   centre; native box 80 x 80. Parts: molecule (the four globins), "molecule seat" (each heme and its
   ligand, so a seat lights with the molecule and on its own), bpg. Hooks: data-molecule (data-molecule=
   "missing" when missing), data-seat, data-subunit, data-heme, data-fe, data-bridge, data-bpg. at:
   centre, alpha, beta, cavity, heme, seat0 to seat3 (the irons). outline({ r }) is the four subunit
   outlines in picture coordinates. */
export function hemoglobin(opts = {}) {
  const { seats = ['empty', 'empty', 'empty', 'empty'], r = 0, bpg = 0, missing = false, lod = 'auto', emphasis = [], parts = {}, s = 1 } = opts;
  const L = lod === 'auto' ? hbLod(s) : lod, g = hbGeometry(r), map = mapper(opts);
  const det = emphasis.includes('molecule') ? '' : D2;
  const outlineAt = (rr = r) => hbGeometry(rr).subunits.map(su => smooth(su.pts.map(map), { closed: true })).join(' ');
  const at = {
    centre: [0, 0], alpha: g.subunits[0].c, beta: g.subunits[1].c, cavity: g.cavity.c, heme: g.hemes[0].c,
    ...Object.fromEntries(g.hemes.map((h, i) => [`seat${i}`, h.fe])),
  };
  let svg;
  if (missing) {
    svg = `<g data-molecule="missing">${artGhost(g.subunits.map(su => smooth(su.pts, { closed: true })).join(' '), { s })}</g>`;
  } else if (L === 'symbol') {
    svg = `<g data-molecule=""><g ${partAttr(parts, 'molecule')}>${hbSymbol(s, r)}</g></g>`;
  } else {
    const ow = (L === 'full' ? SW.outline : 1.25) / s, iw = (L === 'full' ? SW.internal : 0.9) / s;
    // globin subunits: one silhouette under all four (so the cluster reads as one molecule), then each
    // subunit's lo body, its base body shifted toward the light, a soft highlight and a seam line
    const Ds = g.subunits.map(su => smooth(su.pts, { closed: true }));
    let bodies = Ds.map((D, i) => `<path d="${D}" fill="${matOf(g.subunits[i].kind).line}" stroke="${matOf(g.subunits[i].kind).line}" stroke-width="${f(2 * ow)}" stroke-linejoin="round"/>`).join('');
    g.subunits.forEach((su, i) => {
      const m = matOf(su.kind), D = Ds[i];
      const lit = smooth(su.pts.map(p => [su.c[0] - 1.4 + (p[0] - su.c[0]) * 0.86, su.c[1] - 1.6 + (p[1] - su.c[1]) * 0.86]), { closed: true });
      bodies += `<g data-subunit="${su.kind}"><path d="${D}" fill="${m.lo}"/><path d="${lit}" fill="${m.base}"/>`
        + (L === 'full' ? `<ellipse cx="${f(su.c[0] - 5)}" cy="${f(su.c[1] - 5.6)}" rx="5.6" ry="3.4" transform="rotate(-38 ${f(su.c[0] - 5)} ${f(su.c[1] - 5.6)})" fill="${m.hi}" fill-opacity=".8" class="${det}"/>` : '')
        + `<path d="${D}" fill="none" stroke="${m.line}" stroke-opacity=".75" stroke-width="${f(iw)}" stroke-linejoin="round"/></g>`;
    });
    // the central cavity between the betas (where 2,3-BPG binds in T): a recess that closes toward R
    if (L === 'full') bodies += `<circle cx="${f(g.cavity.c[0])}" cy="${f(g.cavity.c[1])}" r="${f(g.cavity.r)}" fill="${P.hbBeta.line}" fill-opacity=".38"/>`;
    // T-state salt bridges: short ticks across the four subunit contacts near the surface, breaking as r rises
    let bridges = '';
    const bo = clamp(1 - 2 * r, 0, 1);
    if (bo > 0) {
      const tw = (L === 'full' ? 1.8 : 1.3) / s, half = Math.max(3.4, 2.2 / s);
      for (const [i, j] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
        const A = g.subunits[i].c, Bc = g.subunits[j].c, mid = [(A[0] + Bc[0]) / 2, (A[1] + Bc[1]) / 2];
        const ml = Math.hypot(...mid) || 1, p = [mid[0] + mid[0] / ml * HB.a * 0.62, mid[1] + mid[1] / ml * HB.a * 0.62];
        const u = [Bc[0] - A[0], Bc[1] - A[1]], ul = Math.hypot(...u), e = [u[0] / ul * half, u[1] / ul * half];
        bridges += `<path data-bridge="" d="M${pt([p[0] - e[0], p[1] - e[1]])} L${pt([p[0] + e[0], p[1] + e[1]])}" stroke="${P.hbBeta.line}" stroke-opacity="${f(bo)}" stroke-width="${f(tw)}" stroke-linecap="round"/>`;
      }
    }
    // 2,3-BPG in the T state's central cavity: a short carbon chain with a phosphate ring at each end
    let bpgSvg = '';
    const bk = clamp(bpg, 0, 1) * clamp(1 - 2 * r, 0, 1);
    if (bk > 0) {
      const [cx, cy] = g.cavity.c, pr = Math.max(2.4, 2 / s), half = Math.max(3.8, 2.8 / s);
      bpgSvg = `<g ${partAttr(parts, 'bpg')} data-bpg="" opacity="${f(bk)}"><path d="M${f(cx - half)} ${f(cy + half * 0.45)} L${f(cx)} ${f(cy - half * 0.3)} L${f(cx + half)} ${f(cy + half * 0.45)}" fill="none" stroke="${P.carbon.base}" stroke-width="${f(1.4 / s)}" stroke-linecap="round" stroke-linejoin="round"/>`
        + [[cx - half, cy + half * 0.45], [cx + half, cy + half * 0.45]].map(([px, py]) => `<circle cx="${f(px)}" cy="${f(py)}" r="${f(pr)}" fill="${P.ui.panel}" stroke="${P.po4.base}" stroke-width="${f(Math.max(1.4, 1.1 / s))}"/>`).join('') + '</g>';
    }
    // seats: heme plate seen nearly edge on in its pocket (iron below the plane in T), then the ligand
    const atomR = L === 'full' ? 3.2 : Math.max(3.2, 2.2 / s);
    let seatSvg = '';
    g.hemes.forEach((h, i) => {
      const kind = ['o2', 'co'].includes(seats[i]) ? seats[i] : 'empty', o = h.out;
      const rx = L === 'full' ? 6.4 : Math.max(6.4, 3.2 / s), ry = L === 'full' ? 2.3 : Math.max(2.3, 1.2 / s), rot = f(h.angle);
      const pocket = `<ellipse cx="${f(h.c[0] - o[0] * 0.6)}" cy="${f(h.c[1] - o[1] * 0.6)}" rx="${f(rx + 1.6)}" ry="${f(ry + 1.8)}" transform="rotate(${rot} ${f(h.c[0] - o[0] * 0.6)} ${f(h.c[1] - o[1] * 0.6)})" fill="${matOf(KINDS[i]).line}" fill-opacity=".55"/>`;
      let s2 = pocket + `<ellipse data-heme="" cx="${f(h.c[0])}" cy="${f(h.c[1])}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${rot} ${f(h.c[0])} ${f(h.c[1])})" fill="${P.heme.base}" stroke="${P.heme.line}" stroke-width="${f(0.9 / s)}"/>`;
      if (L === 'full') {
        s2 += `<ellipse cx="${f(h.c[0] + o[0] * 0.7)}" cy="${f(h.c[1] + o[1] * 0.7)}" rx="${f(rx * 0.72)}" ry="${f(ry * 0.35)}" transform="rotate(${rot} ${f(h.c[0] + o[0] * 0.7)} ${f(h.c[1] + o[1] * 0.7)})" fill="${P.heme.hi}" fill-opacity=".7"/>`;
        s2 += `<circle data-fe="" cx="${f(h.fe[0])}" cy="${f(h.fe[1])}" r="1.9" fill="${P.iron.base}" stroke="${P.iron.line}" stroke-width="${f(0.8 / s)}"/>`;
      }
      if (kind !== 'empty') {
        const lg = g.ligand(kind, i, atomR);
        s2 += `<path d="M${pt(h.fe)} L${pt(lg.atoms[0][1])} L${pt(lg.atoms[1][1])}" fill="none" stroke="${P[lg.atoms[0][0]].line}" stroke-width="${f(1.2 / s)}"/>`;
        for (const [el, p] of lg.atoms) s2 += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(atomR)}" fill="${P[el].base}" stroke="${P[el].line}" stroke-width="${f(1 / s)}" data-atom="${el}"/>`
          + `<circle cx="${f(p[0] - atomR * 0.32)}" cy="${f(p[1] - atomR * 0.34)}" r="${f(atomR * 0.34)}" fill="${WHITE}" fill-opacity=".45"/>`;
      }
      seatSvg += `<g ${partAttr(parts, 'molecule seat')} data-seat="${kind}">${s2}</g>`;
    });
    svg = `<g data-molecule=""><g ${partAttr(parts, 'molecule')}>${bodies}${bridges}</g>${bpgSvg}${seatSvg}</g>`;
  }
  const out = place(artOf(svg, [-40, -40, 80, 80], at), opts);
  out.outline = (state = {}) => outlineAt(state.r ?? r);
  return out;
}
