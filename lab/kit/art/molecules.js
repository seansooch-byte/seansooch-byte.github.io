// The Lab's molecules: ions, small molecules, transmitters, peptides, steroids and drug glyphs (art
// direction sections 2.5 and 4.12). Plain ES module; import it unversioned as /lab/kit/art/molecules.js.
//
//   ion(key, opts)          Na+ K+ Ca2+ Cl- H+ HCO3- phosphate Mg2+: one shape and one colour per species
//                           (colour-blind safe), the charge as a vector mark inside the glyph.
//   ionLabel(key, opts)     the species name in its kit text class with the charge as a vector superscript
//                           in the same colour, so "Ca2+" reads at 17 units without a smaller font.
//   ionSymbols(keys)        <symbol> defs for mount scenes that repeat ions (string scenes inline glyphs).
//   o2, co2, co, water, glucose, atp, camp                small molecules.
//   acetylcholine, noradrenaline, adrenaline, histamine, transmitter(key)   messengers.
//   peptide(opts)           count-accurate bead chains, disulfide rings, two-chain insulin, cleavage.
//   steroid(opts)           the 6-6-6-5 four-ring glyph: cortisol, aldosterone, cholesterol, drug (hollow).
//   drug(opts)              a drug-purple glyph per family, with an optional name tag in kit text.
//
// Expected behaviour (tested by tools/art-tests/molecules.test.mjs, looked at in tools/art-gallery/molecules.html):
//   - Every primitive takes the common options { x, y, s, rot, flip, emphasis, parts, key } and returns an
//     Art: { svg, box, at, outline() } in picture coordinates, anchored at the molecule's centre. Parts are
//     leaves (one <g data-part> per primitive) and parts renames them.
//   - Shading is flat and layered in the picture's one light (upper left): base fill, a lit face shifted
//     toward the light, a 1-unit inner highlight on the lit edges, the material's line outline. No
//     gradients, no clips, no ids, so a row of a hundred ions costs only path strings and works in any svg.
//   - Ions turn their points, not the picture, so the light and the charge mark stay upright at any rot.
//   - Outline weights keep their on-screen weight at any s (1.25 to 1.75 units); everything else scales.
//   - No <text> inside a glyph. The only text is ionLabel's and drug's name tag, in kit classes only,
//     never inside a scaled group.
//   - Accuracy (section 4.12): steroids are 6-6-6-5 (calcitriol, a secosteroid, is refused); ang I 10
//     beads, ang II 8, TRH 3, vasopressin a 6-bead ring closed by the Cys1 to Cys6 disulfide plus a
//     3-bead tail; insulin two chains joined by two disulfides (bead counts are a glyph, not 21 and 30);
//     cAMP's phosphate bridges the ribose 3' and 5' positions; ATP is adenine, ribose and three phosphates
//     in that order; acetylcholine's choline end carries the positive charge; CO2 is O-C-O with carbon in
//     the middle; carbon spheres are larger than oxygen (van der Waals 1.70 against 1.52 angstrom).
import { P, D2, f, pt, mix, artOf, place, textWidth, partName, placer } from './core.js';

/* ---------- colours ----------
   Every colour is a P row (core.js): mg, sulfur, adenine and ribose, and a line on every messenger row.
   A literal colour passed by a lesson gets its line by the same rule P's messenger lines use (55 % toward
   ink). */
const WHITE = P.ui.white, INK = P.ui.ink;
const lineOf = base => mix(base, INK, 0.55);
const mat = key => {
  const c = P[key];
  if (c && c.base) return { base: c.base, line: c.line || lineOf(c.base) };
  if (/^#/.test(key || '')) return { base: key, line: lineOf(key) };
  throw new Error(`molecules: no colour ${key}`);
};

/* ---------- small helpers ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rad = d => d * Math.PI / 180;
const nameOf = partName; // core: renames, multi-names, each word once
const mapper = o => placer(o).map; // core placer: the same numbers place() uses
const pathOf = (pts, closed = true) => `M${pts.map(pt).join(' L')}${closed ? ' Z' : ''}`;
const bboxOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
const centroid = pts => { const b = bboxOf(pts); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
const circlePts = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)]);
const arcPts = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = rad(a0 + (a1 - a0) * i / n); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const ngon = (cx, cy, R, n, a0 = -90) => Array.from({ length: n }, (_, i) => [cx + R * Math.cos(rad(a0 + i * 360 / n)), cy + R * Math.sin(rad(a0 + i * 360 / n))]);
const shift = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
const scaleAbout = (pts, [cx, cy], k) => pts.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
const turn = (pts, deg, flip) => { const a = rad(deg), c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => { const X = flip ? -x : x; return [X * c - y * s, X * s + y * c]; }); };
function hull(points) {
  const p = points.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// Outline weight: 1.25 to 1.75 on screen whatever the scale (a stroke that carries meaning, section 1).
const olw = (size, s) => f(clamp(size * s * 0.11, 1.25, 1.75) / s);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// A mark on a fill: white or ink, whichever reads better.
const markOn = base => contrast(WHITE, base) >= contrast(INK, base) ? WHITE : INK;

/* ---------- the flat volume recipe ----------
   solid(pts, c): base fill, a lit face (the shape at 0.8, shifted toward the upper-left light), a 1-unit
   highlight inset along the edges that face the light, then the line outline. holes: inner polygons
   (even-odd). */
function solid(pts, c, { s = 1, holes = [], size, lit = true, hi = true, cls = '', attrs = '' } = {}) {
  const b = bboxOf(pts), cen = centroid(pts), sz = size || Math.max(b[2], b[3]);
  const d = [pts, ...holes].map(p => pathOf(p)).join(' '), rule = holes.length ? ' fill-rule="evenodd"' : '';
  let o = `<path d="${d}" fill="${c.base}"${rule}${attrs}/>`;
  if (lit) {
    const k = 0.8, dx = -b[2] * 0.06, dy = -b[3] * 0.07;
    const L = q => shift(scaleAbout(q, cen, k), dx, dy);
    o += `<path d="${[L(pts), ...holes].map(p => pathOf(p)).join(' ')}" fill="${mix(c.base, WHITE, 0.2)}"${rule}/>`;
  }
  if (hi) {
    // inset by about 1.7 units; keep the runs whose outward normal faces the light (upper left)
    const runs = [];
    let run = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const ex = q[0] - p[0], ey = q[1] - p[1], len = Math.hypot(ex, ey) || 1;
      let nx = ey / len, ny = -ex / len;
      if ((mx - cen[0]) * nx + (my - cen[1]) * ny < 0) { nx = -nx; ny = -ny; }
      const ins = r => { const dd = Math.hypot(r[0] - cen[0], r[1] - cen[1]) || 1, k = Math.max(0, 1 - 1.7 / dd); return [cen[0] + (r[0] - cen[0]) * k, cen[1] + (r[1] - cen[1]) * k]; };
      if (-0.71 * nx - 0.71 * ny > 0.35) { if (!run.length) run.push(ins(p)); run.push(ins(q)); }
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    if (runs.length > 1 && pathOf(runs[0]).length && runs[runs.length - 1].length) {
      const first = runs[0], last = runs[runs.length - 1];
      if (Math.hypot(first[0][0] - last[last.length - 1][0], first[0][1] - last[last.length - 1][1]) < 1e-6) { runs[0] = last.concat(first.slice(1)); runs.pop(); }
    }
    const hd = runs.filter(r => r.length > 1).map(r => pathOf(r, false)).join(' ');
    if (hd) o += `<path d="${hd}" fill="none" stroke="${WHITE}" stroke-opacity=".6" stroke-width="${f(1 / s)}" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}/>`;
  }
  o += `<path data-outline="" d="${d}" fill="none" stroke="${c.line}" stroke-width="${olw(sz, s)}" stroke-linejoin="round"/>`;
  return o;
}
// (the lit face keeps the true holes, so a ring never shows a swirl)
// A sphere: a circle through the recipe, tagged with its element.
const sphere = (cx, cy, r, c, s, atom) => {
  const pts = circlePts(cx, cy, r);
  return `<g data-atom="${atom}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}">${solid(pts, c, { s, size: 2 * r })}</g>`;
};

/* ---------- vector charge marks ---------- */
const DIGIT = {
  2: 'M0.06 0.3 C0.06 0.04 0.94 -0.02 0.94 0.32 C0.94 0.56 0.5 0.7 0.04 1 L0.98 1',
  3: 'M0.06 0.14 C0.3 -0.06 0.94 -0.02 0.92 0.26 C0.9 0.46 0.62 0.5 0.4 0.5 C0.72 0.5 0.98 0.58 0.98 0.77 C0.98 1.06 0.3 1.08 0.04 0.88',
};
const digitPath = (dg, x, y, w, h) => DIGIT[dg].replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, a, b) => `${f(x + a * w)} ${f(y + b * h)}`);
// charge '+', '-', '2+', '3-' ... -> { d, w } centred on (cx, cy); h is the sign's height.
function chargeMark(charge, cx, cy, h) {
  const m = /^(\d?)([+-])$/.exec(charge);
  if (!m) throw new Error(`molecules: charge ${charge}`);
  const [, dg, sign] = m, dw = dg ? h * 0.72 : 0, dh = dg ? h * 1.2 : 0, gap = dg ? h * 0.22 : 0, sw = h, W = dw + gap + sw;
  const x0 = cx - W / 2, sx = x0 + dw + gap + sw / 2;
  let d = dg ? digitPath(dg, x0, cy - dh / 2, dw, dh) + ' ' : '';
  d += `M${f(sx - sw / 2)} ${f(cy)} L${f(sx + sw / 2)} ${f(cy)}`;
  if (sign === '+') d += ` M${f(sx)} ${f(cy - sw / 2)} L${f(sx)} ${f(cy + sw / 2)}`;
  return { d, w: W, h: Math.max(dh, sw) };
}

/* =====================================================================================================
   Ions
   ===================================================================================================== */
// shape, size (r: the radius that sets the glyph), charge, text class, symbol, default part
export const ION = {
  na: { shape: 'circle', r: 6, charge: '+', cls: 'amber', sym: 'Na', part: 'sodium' },
  k: { shape: 'triangle', r: 8.2, charge: '+', cls: 'green', sym: 'K', part: 'potassium' },
  ca: { shape: 'roundSquare', r: 6.6, charge: '2+', cls: 'teal', sym: 'Ca', part: 'calcium' },
  cl: { shape: 'diamond', r: 7.6, charge: '-', cls: 'muted', sym: 'Cl', part: 'chloride' },
  h: { shape: 'smallCircle', r: 4.2, charge: '+', cls: '', sym: 'H', part: 'hydrogen' },
  hco3: { shape: 'trefoil', r: 7.6, charge: '-', cls: '', sym: 'HCO', sub: '3', part: 'bicarbonate' },
  po4: { shape: 'ring', r: 6.4, charge: '', cls: '', sym: 'PO', sub: '4', part: 'phosphate' },
  mg: { shape: 'pentagon', r: 7.4, charge: '2+', cls: '', sym: 'Mg', part: 'magnesium' },
};
for (const [k, v] of Object.entries(ION)) { const c = mat(k); v.fill = c.base; v.line = c.line; }

// Native geometry of an ion, centred on the origin: outline points (and holes) plus where the mark sits.
function ionShape(key) {
  const r = ION[key].r;
  switch (ION[key].shape) {
    case 'circle': case 'smallCircle': return { pts: circlePts(0, 0, r, 30), markH: r * 0.95, markY: 0 };
    case 'triangle': { const pts = shift(ngon(0, 0, r, 3), 0, r * 0.25); return { pts: roundCorners(pts, 1.6), markH: r * 0.56, markY: r * 0.33 }; } // box-centred; the mark sits at the incentre
    case 'roundSquare': return { pts: roundCorners([[-r, -r], [r, -r], [r, r], [-r, r]], 2.6), markH: r * 0.62, markY: 0 };
    case 'diamond': return { pts: roundCorners([[0, -r], [r, 0], [0, r], [-r, 0]], 1.4), markH: r * 0.7, markY: 0 };
    case 'pentagon': return { pts: roundCorners(ngon(0, 0, r, 5), 1.4), markH: r * 0.54, markY: r * 0.06 };
    case 'ring': return { pts: circlePts(0, 0, r, 30), holes: [circlePts(0, 0, r * 0.42, 20).reverse()], markH: r * 0.5, markY: 0 };
    case 'trefoil': {
      // the union of three lobes about a centre dot, sampled as a star-shaped outline
      const lobes = [-90, 30, 150].map(a => [Math.cos(rad(a)) * r * 0.55, Math.sin(rad(a)) * r * 0.55]), lr = r * 0.45, cr = r * 0.5;
      const pts = Array.from({ length: 72 }, (_, i) => {
        const a = i / 72 * 2 * Math.PI, u = [Math.cos(a), Math.sin(a)];
        let best = cr;
        for (const [cx, cy] of lobes) { const bb = u[0] * cx + u[1] * cy, cc = cx * cx + cy * cy - lr * lr, disc = bb * bb - cc; if (disc >= 0) best = Math.max(best, bb + Math.sqrt(disc)); }
        return [u[0] * best, u[1] * best];
      });
      const dy = -centroid(pts)[1]; // box-centred: the top lobe would otherwise lift it
      return { pts: shift(pts, 0, dy), markH: r * 0.5, markY: dy, dot: cr * 0.86, dotY: dy };
    }
  }
}
// Round a polygon's corners with short arcs (sampled), so outlines and outline() agree.
function roundCorners(pts, rr, n = 4) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[(i - 1 + pts.length) % pts.length], q = pts[i], r = pts[(i + 1) % pts.length];
    const a = [p[0] - q[0], p[1] - q[1]], b = [r[0] - q[0], r[1] - q[1]], la = Math.hypot(...a), lb = Math.hypot(...b);
    const t = Math.min(rr, la / 2, lb / 2), A = [q[0] + a[0] / la * t, q[1] + a[1] / la * t], B = [q[0] + b[0] / lb * t, q[1] + b[1] / lb * t];
    for (let j = 0; j <= n; j++) { const u = j / n, v = 1 - u; out.push([v * v * A[0] + 2 * u * v * q[0] + u * u * B[0], v * v * A[1] + 2 * u * v * q[1] + u * u * B[1]]); }
  }
  return out;
}

// The glyph markup in native coordinates (already turned by rot and mirrored by flip), plus its outline.
function ionNative(key, { rot = 0, flip = false, s = 1, charge } = {}) {
  const I = ION[key], g = ionShape(key), c = { base: I.fill, line: I.line };
  const pts = turn(g.pts, rot, flip), holes = (g.holes || []).map(h => turn(h, rot, flip));
  let o = solid(pts, c, { s, holes, size: 2 * I.r });
  if (g.dot) {
    const d = turn(circlePts(0, g.dotY, g.dot, 24), rot, flip);
    o += `<path d="${pathOf(d)}" fill="${mix(I.fill, WHITE, 0.12)}" stroke="${I.line}" stroke-width="${f(1.1 / s)}"/>`;
  }
  const ch = charge === false ? '' : (typeof charge === 'string' ? charge : I.charge);
  if (ch) {
    const mc = turn([[0, g.markY]], rot, flip)[0], m = chargeMark(ch, mc[0], mc[1], g.markH), col = markOn(I.fill);
    o += `<path data-charge="${ch}" d="${m.d}" fill="none" stroke="${col}" stroke-width="${f(Math.max(1.3, g.markH * 0.24))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return { markup: o, pts };
}

/* ion(key, { x, y, s, rot, flip, charge = true | false | '2-', emphasis, parts, key }) -> Art anchored at the
   ion's centre. Part: sodium, potassium, calcium, chloride, hydrogen, bicarbonate, phosphate, magnesium. */
export function ion(key, opts = {}) {
  if (!ION[key]) throw new Error(`ion: unknown species ${key}`);
  const { x = 0, y = 0, s = 1, rot = 0, flip = false, parts = {} } = opts;
  const n = ionNative(key, { rot, flip, s, charge: opts.charge });
  const b = bboxOf(n.pts);
  const art = place(artOf(`<g data-part="${nameOf(parts, ION[key].part)}">${n.markup}</g>`, b, { centre: [0, 0] }), { x, y, s });
  const sil = n.pts.map(mapper({ x, y, s }));
  return artOf(art.svg, art.box, art.at, () => pathOf(sil));
}

/* ionSymbols(keys = all) -> '<symbol id="ax-ion-na" ...>' defs for mount scenes (place with <use href>). */
export function ionSymbols(keys = Object.keys(ION)) {
  return keys.map(k => `<symbol id="ax-ion-${k}" viewBox="-10 -10 20 20" width="20" height="20" overflow="visible">${ionNative(k).markup}</symbol>`).join('');
}

/* ionLabel(key, { x, y, cls = 'xs b', anchor = 'start' | 'middle' | 'end', charge }) -> Art. The species
   name in kit text (its colour class from section 2.5) and the charge as a vector superscript with the
   kit's panel halo; y is the text baseline. Kit classes only: xs 17, sm 18, default 20, lg 24, plus b. */
const KIT_CLS = new Set(['xs', 'sm', 'lg', 'b']);
const TEXT_COL = { amber: P.ui.amber, green: P.ui.green, teal: P.ui.teal, muted: P.ui.muted, '': INK };
export function ionLabel(key, { x = 0, y = 0, cls = 'xs b', anchor = 'start', charge } = {}) {
  const I = ION[key];
  if (!I) throw new Error(`ionLabel: unknown species ${key}`);
  const toks = cls.split(/\s+/).filter(Boolean);
  if (toks.some(t => !KIT_CLS.has(t))) throw new Error(`ionLabel: kit classes only (${cls})`);
  const size = toks.includes('lg') ? 24 : toks.includes('sm') ? 18 : toks.includes('xs') ? 17 : 20;
  const full = [...toks, I.cls].filter(Boolean).join(' '), col = TEXT_COL[I.cls];
  const tw = textWidth(I.sym + (I.sub || ''), full), ch = charge === false ? '' : (charge || I.charge);
  const h = size * 0.36, m = ch ? chargeMark(ch, 0, 0, h) : { w: 0, h: 0 }, gap = ch ? size * 0.08 : 0, W = tw + gap + m.w;
  const x0 = anchor === 'end' ? x - W : anchor === 'middle' ? x - W / 2 : x;
  const sub = I.sub ? `<tspan dy="${f(size * 0.26)}">${I.sub}</tspan>` : '';
  let svg = `<text x="${f(x0)}" y="${f(y)}" text-anchor="start" class="${full}">${I.sym}${sub}</text>`;
  if (ch) {
    const mm = chargeMark(ch, x0 + tw + gap + m.w / 2, y - size * 0.62, h), w = f(Math.max(1.6, size * 0.095));
    svg += `<g data-charge="${ch}"><path d="${mm.d}" fill="none" stroke="${P.ui.panel}" stroke-width="${f(+w + 4)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${mm.d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  const top = y - size * 0.8, bottom = y + (I.sub ? size * 0.38 : size * 0.22);
  const box = [x0, top, W, bottom - top].map(f);
  return artOf(svg, box, { baseline: [x0, y], charge: [x0 + tw + gap + m.w / 2, y - size * 0.62] }, () => pathOf([[box[0], box[1]], [box[0] + box[2], box[1]], [box[0] + box[2], box[1] + box[3]], [box[0], box[1] + box[3]]]));
}

/* =====================================================================================================
   Common wrapper for molecules drawn in native coordinates (place() turns, scales and mirrors them).
   ===================================================================================================== */
function finish(markup, silPts, at, opts, part, extra = {}) {
  const { parts = {} } = opts;
  const box = bboxOf(silPts), sil = hull(silPts);
  // part: false draws the glyph without its own part, for a primitive that already names the group it sits in
  const art = place(artOf(`<g${opts.part === false ? '' : ` data-part="${nameOf(parts, part)}"`}>${markup}</g>`, box, at), opts);
  const m = mapper(opts), out = sil.map(m);
  return artOf(art.svg, art.box, art.at, () => pathOf(out), extra);
}
const detail = (opts, part) => (opts.emphasis || []).includes(part) ? '' : D2;
const bond = (a, b, col, w, kind = '', op = 1) => `<path${kind ? ` data-bond="${kind}"` : ''} d="M${pt(a)} L${pt(b)}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"${op < 1 ? ` stroke-opacity="${f(op)}"` : ''}/>`;

/* ---------- gases and water ---------- */
const R_O = 4.6, R_C = 5.1;
const OX = { base: P.oxygen.base, line: P.oxygen.line }, CB = { base: P.carbon.base, line: P.carbon.line };
const OXc = { base: P.oxygen.base, line: P.carbon.line };

/* o2(opts) -> Art: two oxygen spheres (dumbbell). Part oxygen. at: centre, a, b. */
export function o2(opts = {}) {
  const s = opts.s || 1, d = 3.1;
  const svg = sphere(-d, 0, R_O, OX, s, 'O') + sphere(d, 0, R_O, OX, s, 'O');
  return finish(svg, [...circlePts(-d, 0, R_O), ...circlePts(d, 0, R_O)], { centre: [0, 0], a: [-d, 0], b: [d, 0] }, opts, 'oxygen');
}
/* co2(opts) -> Art: O-C-O, linear, carbon in the middle. Part co2. */
export function co2(opts = {}) {
  const s = opts.s || 1, d = 6.4;
  const svg = sphere(-d, 0, R_O, OXc, s, 'O') + sphere(0, 0, R_C, CB, s, 'C') + sphere(d, 0, R_O, OXc, s, 'O');
  return finish(svg, [...circlePts(-d, 0, R_O), ...circlePts(d, 0, R_O), ...circlePts(0, 0, R_C)], { centre: [0, 0] }, opts, 'co2');
}
/* co(opts) -> Art: carbon and oxygen, two unequal spheres. Part co. */
export function co(opts = {}) {
  const s = opts.s || 1, dc = -3, dO = 3.6;
  const svg = sphere(dc, 0, R_C, CB, s, 'C') + sphere(dO, 0, R_O, OXc, s, 'O');
  return finish(svg, [...circlePts(dc, 0, R_C), ...circlePts(dO, 0, R_O)], { centre: [0, 0] }, opts, 'co');
}
/* water(opts) -> Art: a drop, point up. Part water. */
export function water(opts = {}) {
  const s = opts.s || 1, c = { base: P.water.base, line: P.water.line };
  const pts = [...arcPts(0, 2.4, 5, -30, 210, 18), [-2.6, -2.2], [-1.2, -5.2], [0, -7.6], [1.2, -5.2], [2.6, -2.2]];
  const sm = roundCorners(pts, 0.6, 2);
  return finish(solid(sm, c, { s, size: 12 }), sm, { centre: [0, 0.6], tip: [0, -7.6] }, opts, 'water');
}
/* glucose(opts) -> Art: a pyranose ring (Haworth hexagon) with its ring oxygen at the back right vertex.
   Part glucose. */
export function glucose(opts = {}) {
  const s = opts.s || 1, c = { base: P.glucose.base, line: P.glucose.line };
  const outer = ngon(0, 0, 8.4, 6, 0).map(([x, y]) => [x, y * 0.78]);
  const inner = scaleAbout(outer, [0, 0], 0.46);
  let svg = solid(outer, c, { s, holes: [inner.slice().reverse()], size: 16 });
  const o = outer[5];
  svg = `<g data-ring="6">${svg}</g>` + sphere(o[0], o[1], 2.4, OX, s, 'O');
  return finish(svg, [...outer, ...circlePts(o[0], o[1], 2.4)], { centre: [0, 0], oxygen: o }, opts, 'glucose');
}

/* ---------- nucleotides ---------- */
// Native layout shared by ATP and cAMP: adenine (purine: a hexagon fused to a pentagon), N9 to C1' of a
// ribose (furanose, ring O at the top), C5' onward to the phosphates.
const NUC = (() => {
  const a = 4.6, hex = ngon(0, 0, a, 6, -90);
  const e0 = hex[1], e1 = hex[2], mid = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
  const pc = [mid[0] + 0.688 * a, mid[1]], R = 0.8507 * a;
  const pent = [e0, ...[288, 0, 72].map(d => [pc[0] + R * Math.cos(rad(d)), pc[1] + R * Math.sin(rad(d))]), e1];
  const n9 = pent[2], rc = [n9[0] + 8.3, n9[1] + 1.6], rr = 4.6;
  const rib = ngon(rc[0], rc[1], rr, 5, -90); // 0 ring O, 1 C4', 2 C3', 3 C2', 4 C1'
  return { hex, pent, n9, rib, rc };
})();
const PR = 3.5, PSTEP = 7.8;
const phosphate = (cx, cy, s, name, extra = '') => {
  const c = { base: P.po4.base, line: P.po4.line };
  return `<g data-phosphate="${name}"${extra}>${solid(circlePts(cx, cy, PR, 24), c, { s, holes: [circlePts(cx, cy, PR * 0.42, 14).reverse()], size: 2 * PR })}</g>`;
};
function nucleoside(s, det) {
  const { hex, pent, n9, rib } = NUC, bl = P.carbon.line;
  let o = bond(n9, rib[4], bl, 1.3);
  o += `<g data-base="adenine">${solid(pent, P.adenine, { s, size: 9 })}${solid(hex, P.adenine, { s, size: 9 })}</g>`;
  o += `<g data-sugar="ribose">${solid(rib, P.ribose, { s, size: 9 })}<circle cx="${f(rib[0][0])}" cy="${f(rib[0][1])}" r="1.5" fill="${P.oxygen.base}" stroke="${P.oxygen.line}" stroke-width="${f(0.8 / s)}"${det ? ` class="${det}"` : ''}/></g>`;
  return o;
}
const NUC_PTS = () => [...NUC.hex, ...NUC.pent, ...NUC.rib];

/* atp({ phosphates = 3 (2 ADP, 1 AMP), release 0..1 (the terminal phosphate leaves: hydrolysis), ...common })
   -> Art. Part atp. at: adenine, ribose, alpha, beta, gamma (the terminal phosphate), centre. */
export function atp(opts = {}) {
  const { phosphates = 3, release = 0 } = opts, s = opts.s || 1, det = detail(opts, 'atp');
  const n = clamp(Math.round(phosphates), 1, 3), r = clamp(release, 0, 1), c5 = NUC.rib[1];
  const names = ['alpha', 'beta', 'gamma'], at = { adenine: centroid(NUC.hex), ribose: NUC.rc };
  let o = '', sil = NUC_PTS();
  const P0 = [c5[0] + 3.4 + PR, c5[1]];
  o += bond(c5, P0, P.carbon.line, 1.3);
  let svgP = '';
  for (let i = 0; i < n; i++) {
    const last = i === n - 1 && n > 1, dx = last ? r * 10 : 0, cx = P0[0] + i * PSTEP + dx, cy = P0[1] + (last ? r * 2 : 0);
    if (i > 0) o += bond([P0[0] + (i - 1) * PSTEP, P0[1]], [cx, cy], P.po4.line, 1.3, '', last ? 1 - r : 1);
    svgP += phosphate(cx, cy, s, names[i]);
    at[names[i]] = [cx, cy];
    sil = sil.concat(circlePts(cx, cy, PR, 12));
  }
  if (!at.gamma) at.gamma = at[names[n - 1]];
  o = o + nucleoside(s, det) + svgP;
  // centre on the unreleased molecule, so release moves the phosphate and nothing else
  const b = bboxOf([...NUC_PTS(), ...circlePts(P0[0] + (n - 1) * PSTEP, P0[1], PR, 12), ...circlePts(P0[0], P0[1], PR, 12)]); at.centre = [b[0] + b[2] / 2, b[1] + b[3] / 2];
  // centre the molecule on its anchor
  const cx = at.centre[0], cy = at.centre[1];
  return finish(`<g transform="translate(${f(-cx)} ${f(-cy)})">${o}</g>`, shift(sil, -cx, -cy), Object.fromEntries(Object.entries(at).map(([k, p]) => [k, [p[0] - cx, p[1] - cy]])), opts, 'atp');
}
/* camp(opts) -> Art: adenine, ribose and one phosphate bridging the ribose 3' oxygen and the 5' carbon's
   oxygen (the cyclic phosphodiester ring). Part camp. at: adenine, ribose, phosphate, centre. */
export function camp(opts = {}) {
  const s = opts.s || 1, det = detail(opts, 'camp'), { rib } = NUC;
  const c4 = rib[1], c3 = rib[2], c5 = [c4[0] + 4.4, c4[1] + 1.6], pc = [c4[0] + 4.6, c3[1] + 4.4];
  let o = bond(c4, c5, P.carbon.line, 1.3) + bond(c5, pc, P.po4.line, 1.3, 'cyclic') + bond(c3, pc, P.po4.line, 1.3, 'cyclic');
  o += nucleoside(s, det) + phosphate(pc[0], pc[1], s, 'cyclic');
  const sil = [...NUC_PTS(), ...circlePts(pc[0], pc[1], PR, 12)], b = bboxOf(sil), cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  const at = { adenine: centroid(NUC.hex), ribose: NUC.rc, phosphate: pc };
  return finish(`<g transform="translate(${f(-cx)} ${f(-cy)})">${o}</g>`, shift(sil, -cx, -cy), { centre: [0, 0], ...Object.fromEntries(Object.entries(at).map(([k, p]) => [k, [p[0] - cx, p[1] - cy]])) }, opts, 'camp');
}

/* ---------- transmitters ---------- */
/* acetylcholine({ split 0..1 (acetylcholinesterase: the acetate leaves the choline), ...common }) -> Art: two
   lobes, choline (with its quaternary ammonium's positive charge) and acetate. Part ach. at: choline,
   acetate, centre. */
export function acetylcholine(opts = {}) {
  const s = opts.s || 1, k = clamp(opts.split || 0, 0, 1), base = P.ach.base;
  const cho = { base, line: lineOf(base) }, ace = { base: mix(base, WHITE, 0.32), line: lineOf(base) };
  const cc = [-2.8 - k * 2, 0], ac = [5.2 + k * 8, k * 1.5];
  const ap = turn(circlePts(0, 0, 1, 28).map(([x, y]) => [x * 4.2, y * 3.3]), k * 25).map(p => [p[0] + ac[0], p[1] + ac[1]]);
  const cp = circlePts(cc[0], cc[1], 5.2, 30);
  const m = chargeMark('+', cc[0], cc[1], 4.6);
  const svg = `<g data-lobe="acetate">${solid(ap, ace, { s, size: 9 })}</g><g data-lobe="choline">${solid(cp, cho, { s, size: 10.4 })}<path data-charge="+" d="${m.d}" fill="none" stroke="${markOn(base)}" stroke-width="1.4" stroke-linecap="round"/></g>`;
  return finish(svg, [...ap, ...cp], { choline: cc, acetate: ac, centre: [0, 0] }, opts, 'ach');
}
const catechol = (opts, core) => {
  const s = opts.s || 1, base = P.noradrenaline.base, r = 5.4, pts = circlePts(0, 0, r, 30);
  let svg = solid(pts, { base, line: lineOf(base) }, { s, size: 2 * r });
  if (core) svg += `<circle data-core="" cx="0" cy="0" r="1.9" fill="${WHITE}" stroke="${lineOf(base)}" stroke-width="${f(0.8 / s)}"/>`;
  return finish(svg, pts, { centre: [0, 0] }, opts, core ? 'adrenaline' : 'ne');
};
/* noradrenaline(opts) -> Art: a bronze sphere. Part ne. */
export const noradrenaline = (opts = {}) => catechol(opts, false);
/* adrenaline(opts) -> Art: the bronze sphere with a white core dot. Part adrenaline. */
export const adrenaline = (opts = {}) => catechol(opts, true);
/* histamine(opts) -> Art: an imidazole ring with its ethylamine tail. Part histamine. */
export function histamine(opts = {}) {
  const s = opts.s || 1, base = P.histamine.base, c = { base, line: lineOf(base) };
  const ring = roundCorners(ngon(-3, 0, 5, 5, -90), 0.8, 2), inner = scaleAbout(ring, [-3, 0], 0.42);
  const v = ring[Math.round(ring.length * 0.3)], t1 = [v[0] + 3.4, v[1] + 2.6], t2 = [t1[0] + 3.6, t1[1] - 1.4];
  const svg = `<path d="M${pt(v)} L${pt(t1)} L${pt(t2)}" fill="none" stroke="${c.line}" stroke-width="${f(Math.max(2.4, 1.6 / s))}" stroke-linecap="round" stroke-linejoin="round"/>` +
    solid(ring, c, { s, holes: [inner.slice().reverse()], size: 10 }) +
    `<circle cx="${f(t2[0])}" cy="${f(t2[1])}" r="2" fill="${base}" stroke="${c.line}" stroke-width="${f(1.1 / s)}"/>`;
  const sil = [...ring, ...circlePts(t2[0], t2[1], 2, 10), t1];
  const b = bboxOf(sil), cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  return finish(`<g transform="translate(${f(-cx)} ${f(-cy)})">${svg}</g>`, shift(sil, -cx, -cy), { centre: [0, 0], ring: [-3 - cx, -cy] }, opts, 'histamine');
}
/* transmitter(key, opts): 'ach' | 'ne' | 'adrenaline' | 'histamine'. */
export function transmitter(key, opts = {}) {
  const fn = { ach: acetylcholine, ne: noradrenaline, adrenaline, histamine }[key];
  if (!fn) throw new Error(`transmitter: unknown ${key}`);
  return fn(opts);
}

/* =====================================================================================================
   Peptides
   ===================================================================================================== */
const BR = 2.9, BSTEP = 6.6;
export const PEPTIDES = {
  angI: { n: 10, col: 'angiotensin', part: 'angiotensin' },
  angII: { n: 8, col: 'angiotensin', part: 'angiotensin' },
  adh: { ring: 6, tail: 3, col: 'adh', part: 'adh' },
  trh: { n: 3, col: 'trh', part: 'trh' },
  insulin: { chains: 2, n: [7, 9], col: 'insulin', part: 'insulin' },
  glucagon: { n: 9, col: 'glucagon', part: 'glucagon' },
  glp1: { n: 6, col: 'glp1', part: 'glp1' },
};
const bead = (p, c, s, i, det, chain) => `<g data-bead="${i + 1}"${chain ? ` data-in="${chain}"` : ''}><circle cx="${f(p[0])}" cy="${f(p[1])}" r="${BR}" fill="${c.base}"/><circle cx="${f(p[0] - 0.45)}" cy="${f(p[1] - 0.5)}" r="${f(BR * 0.72)}" fill="${mix(c.base, WHITE, 0.22)}"/><circle cx="${f(p[0] - 1)}" cy="${f(p[1] - 1.1)}" r=".75" fill="${WHITE}" fill-opacity=".7"${det ? ` class="${det}"` : ''}/><circle data-outline="" cx="${f(p[0])}" cy="${f(p[1])}" r="${BR}" fill="none" stroke="${c.line}" stroke-width="${f(Math.min(1.75, Math.max(1.1, 1.25 / s)))}"/></g>`;
const disulfide = (a, b, name, s) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy), k = (BR - 0.4) / L;
  const A = [a[0] + ux * k, a[1] + uy * k], B = [b[0] - ux * k, b[1] - uy * k];
  return `<g data-disulfide="${name}"><path d="M${pt(A)} L${pt(B)}" stroke="${P.sulfur.line}" stroke-width="${f(3.2)}" stroke-linecap="round"/><path d="M${pt(A)} L${pt(B)}" stroke="${P.sulfur.base}" stroke-width="${f(1.8)}" stroke-linecap="round"/></g>`;
};
/* peptide({ kind: 'angI' | 'angII' | 'adh' | 'trh' | 'insulin' | 'glucagon' | 'glp1', n (beads, or [A, B]
   with chains 2), col (a P key or a colour), ring (beads closed by a disulfide), tail (beads after the ring),
   chains 1 | 2, layout 'wave' | 'line', cleave: { at (index of the first bead cut off), gap 0..1 },
   ...common }) -> Art. Part: the kind's name, else peptide. at: centre, first, last, cut (centre of the
   cut-off piece), ring. Beads are 6 units across (2.9 radius); one bead per residue where the direction
   counts (ang I 10, ang II 8, TRH 3, vasopressin 6 + 3). */
export function peptide(opts = {}) {
  const pre = PEPTIDES[opts.kind] || {}, o = { ...pre, ...opts };
  const { ring = 0, tail = 0, chains = 1, layout = 'wave', cleave } = o, s = o.s || 1, det = detail(opts, pre.part || 'peptide');
  const c = mat(o.col || 'angiotensin'), part = pre.part || 'peptide';
  let svg = '', bonds = '', beads = '', sil = [], at = {}, centres = [], pre0 = null;
  const bl = c.line, bw = 1.4;
  if (chains === 2) {
    const [na, nb] = Array.isArray(o.n) ? o.n : [o.n || 7, (o.n || 7) + 2];
    const A = Array.from({ length: na }, (_, i) => [(i + 1) * BSTEP, -5.6]), B = Array.from({ length: nb }, (_, i) => [i * BSTEP, 5.6]);
    let a = '', b = '';
    A.forEach((p, i) => { if (i) bonds += bond(A[i - 1], p, bl, bw, 'peptide'); a += bead(p, c, s, i, det, 'A'); });
    B.forEach((p, i) => { if (i) bonds += bond(B[i - 1], p, bl, bw, 'peptide'); b += bead(p, c, s, i, det, 'B'); });
    const links = [[1, 2], [na - 2, na - 1]];
    const ss = links.map(([i, j]) => disulfide(A[i], B[j], `A${i + 1}-B${j + 1}`, s)).join('');
    beads = `<g data-chain="A">${a}</g><g data-chain="B">${b}</g>`;
    svg = bonds + ss + beads;
    centres = [...A, ...B];
    at = { first: B[0], last: B[nb - 1], a: A[Math.floor(na / 2)], b: B[Math.floor(nb / 2)] };
  } else {
    let pts = [];
    if (ring) {
      // a ring of `ring` beads; bead 1 and bead `ring` sit across a wider gap, closed by the disulfide
      const gapDeg = 78, step = (360 - gapDeg) / (ring - 1), R = BSTEP / (2 * Math.sin(rad(step / 2)));
      for (let i = 0; i < ring; i++) { const a = -gapDeg / 2 - i * step; pts.push([R * Math.cos(rad(a)), R * Math.sin(rad(a))]); }
      const last = pts[ring - 1];
      for (let j = 1; j <= tail; j++) pts.push([last[0] + j * BSTEP * 0.96, last[1] + j * BSTEP * 0.3 + (j % 2 ? -1.2 : 0)]);
      at.ring = [0, 0];
    } else {
      const n = o.n || 8;
      for (let i = 0; i < n; i++) pts.push([i * BSTEP, layout === 'wave' ? (i % 2 ? 1.5 : -1.5) : 0]);
    }
    // cleave: beads from `at` on move away along the chain
    const cut = cleave && cleave.at > 0 && cleave.at < pts.length ? cleave.at : 0, g = cut ? clamp(cleave.gap || 0, 0, 1) : 0;
    pre0 = pts.slice();
    if (cut) {
      const p0 = pts[cut - 1], p1 = pts[cut], ux = p1[0] - p0[0], uy = p1[1] - p0[1], L = Math.hypot(ux, uy);
      pts = pts.map((p, i) => i >= cut ? [p[0] + ux / L * g * 9, p[1] + uy / L * g * 9 + g * 2.5] : p);
    }
    pts.forEach((p, i) => {
      if (i && !(cut && i === cut && g > 0)) bonds += bond(pts[i - 1], p, bl, bw, "peptide");
      beads += bead(p, c, s, i, det);
    });
    svg = bonds + (ring ? disulfide(pts[0], pts[ring - 1], `1-${ring}`, s) : '') + beads;
    centres = pts;
    at.first = pts[0]; at.last = pts[pts.length - 1];
    if (cut) at.cut = centroid(pts.slice(cut));
  }
  for (const p of centres) sil = sil.concat(circlePts(p[0], p[1], BR, 10));
  // centre on the uncut chain, so cleaving moves the cut-off piece and nothing else
  const b = pre0 ? bboxOf(pre0.flatMap(p => circlePts(p[0], p[1], BR, 10))) : bboxOf(sil), cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  const atC = { centre: [0, 0], ...Object.fromEntries(Object.entries(at).map(([k, p]) => [k, [p[0] - cx, p[1] - cy]])) };
  return finish(`<g transform="translate(${f(-cx)} ${f(-cy)})">${svg}</g>`, shift(sil, -cx, -cy), atC, opts, part);
}

/* =====================================================================================================
   Steroids: rings A, B, C (hexagons) and D (pentagon), fused edge to edge (6-6-6-5)
   ===================================================================================================== */
/* steroidGeometry(a = 6.8) -> { rings: [A, B, C, D] point lists centred on the skeleton, tail, oh, box } */
export function steroidGeometry(a = 6.8) {
  const h3 = a * Math.sqrt(3);
  const A = ngon(0, 0, a, 6, -90), B = ngon(h3, 0, a, 6, -90), C = ngon(1.5 * h3, -1.5 * a, a, 6, -90);
  // D on C's right edge (vertices at -30 and 30 degrees)
  const e0 = C[1], e1 = C[2], mid = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2], pc = [mid[0] + 0.688 * a, mid[1]], R = 0.8507 * a;
  const D = [e0, ...[288, 0, 72].map(d => [pc[0] + R * Math.cos(rad(d)), pc[1] + R * Math.sin(rad(d))]), e1];
  // snap the shared vertices so fused rings share their edge exactly
  const snap = (ring, others) => ring.map(p => { for (const o of others) for (const q of o) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6) return q; return p; });
  const Bs = snap(B, [A]), Cs = snap(C, [Bs]);
  const rings = [A, Bs, Cs, D];
  const all = rings.flat(), b = bboxOf(all), cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  const sh = r => r.map(p => [p[0] - cx, p[1] - cy]);
  const out = rings.map(sh);
  // C17 side chain (cholesterol) from D's upper-right vertex; 3-OH from A's lower-left vertex
  const v17 = out[3][1], tail = [v17];
  for (let i = 1; i <= 5; i++) { const pr = tail[i - 1], ang = i % 2 ? -32 : 28; tail.push([pr[0] + a * 0.78 * Math.cos(rad(ang)), pr[1] + a * 0.78 * Math.sin(rad(ang))]); }
  const v3 = out[0][4], oh = [v3[0] - a * 0.7, v3[1] + a * 0.42];
  return { rings: out, tail, oh, v3, box: [b[0] - cx, b[1] - cy, b[2], b[3]] };
}
const STEROIDS = { cortisol: 'cortisol', aldosterone: 'aldosterone', cholesterol: 'cholesterol', drug: 'drug' };
/* steroid({ kind: 'cortisol' | 'aldosterone' | 'cholesterol' | 'drug' (glucocorticoid drug: hollow, cortisol
   at 30 % with a drug outline), tail (C17 side chain and 3-OH; default for cholesterol), ...common }) -> Art.
   Part: the kind (drug for the drug). at: centre, a, d (ring centres), tail. */
export function steroid(opts = {}) {
  const { kind = 'cortisol' } = opts, s = opts.s || 1;
  if (!STEROIDS[kind]) throw new Error(`steroid: ${kind} is not drawn with the 6-6-6-5 glyph${kind === 'calcitriol' ? ' (calcitriol is a secosteroid: use its own token)' : ''}`);
  const tail = opts.tail ?? kind === 'cholesterol';
  const g = steroidGeometry(), isDrug = kind === 'drug';
  const c = isDrug ? { base: P.cortisol.base, line: P.drug.line } : { base: P[kind].base, line: lineOf(P[kind].base) };
  const ow = olw(40, s);
  let svg = '';
  if (tail) {
    const lc = isDrug ? P.drug.line : c.line;
    svg += `<path data-tail="" d="${pathOf(g.tail, false)}" fill="none" stroke="${lc}" stroke-width="${f(Math.max(2, 1.25 / s))}" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += `<path d="M${pt(g.v3)} L${pt(g.oh)}" stroke="${lc}" stroke-width="${f(Math.max(2, 1.25 / s))}" stroke-linecap="round"/><circle cx="${f(g.oh[0])}" cy="${f(g.oh[1])}" r="2.1" fill="${P.oxygen.base}" stroke="${P.oxygen.line}" stroke-width="${f(0.9 / s)}"/>`;
  }
  for (const r of g.rings) {
    const cen = centroid(r);
    if (isDrug) svg += `<path d="${pathOf(r)}" fill="${c.base}" fill-opacity="0.3"/>`;
    else svg += `<path d="${pathOf(r)}" fill="${c.base}"/><path d="${pathOf(shift(scaleAbout(r, cen, 0.56), -0.5, -0.6))}" fill="${mix(c.base, WHITE, 0.42)}"/>`;
  }
  const edges = g.rings.map(r => pathOf(r)).join(' ');
  svg += `<path data-outline="" d="${edges}" fill="none" stroke="${c.line}" stroke-width="${isDrug ? f(Math.max(1.6, ow)) : ow}" stroke-linejoin="round"/>`;
  let sil = g.rings.flat();
  if (tail) sil = sil.concat(g.tail, circlePts(g.oh[0], g.oh[1], 2.1, 8));
  const at = { centre: [0, 0], a: centroid(g.rings[0]), d: centroid(g.rings[3]), ...(tail ? { tail: g.tail[g.tail.length - 1] } : {}) };
  return finish(svg, sil, at, opts, isDrug ? 'drug' : kind);
}

/* =====================================================================================================
   Drugs: one colour (drug purple), a shape per family (section 4.12), an optional name tag.
   ===================================================================================================== */
const DC = { base: P.drug.base, line: P.drug.line };
const FAM = {
  // a reversible plug: a peg that tapers into a pocket (NSAIDs, channel and receptor blockers)
  plug: () => ({ pts: roundCorners([[-6, -9], [6, -9], [6, 0], [2.4, 8.5], [-2.4, 8.5], [-6, 0]], 2.4) }),
  // a plug with a side knob that only fits a side pocket (COX-2 selective)
  selectivePlug: () => { const p = roundCorners([[-6, -9], [6, -9], [6, 0], [2.4, 8.5], [-2.4, 8.5], [-6, 0]], 2.4); return { pts: p, knob: [7.6, -3.6, 3.6] }; },
  // aspirin: an acetyl flag on a short staff, the dot is the covalent bond it leaves on the enzyme
  acetyl: () => ({ pts: roundCorners([[-1.4, 9], [-1.4, -9.5], [1.4, -9.5], [11, -5.8], [1.4, -1.8], [1.4, 9]], 0.8), dot: [0, 9.6] }),
  wedge: () => ({ pts: roundCorners([[-8, -7], [8, -7], [0, 9]], 2) }),
  cap: () => ({ pts: [...arcPts(0, 3, 9, 180, 360, 14), [9, 6.5], [-9, 6.5]] }),
  ring: () => ({ pts: roundCorners(ngon(0, 0, 9.5, 6, -90), 1.2), holes: [ngon(0, 0, 4.4, 6, -90).reverse()] }),
  bulky: () => ({ pts: Array.from({ length: 48 }, (_, i) => { const a = i / 48 * 2 * Math.PI, r = 9.6 * (1 + 0.15 * Math.cos(3 * a + 0.5)); return [r * Math.cos(a), r * Math.sin(a)]; }) }),
  dumbbell: () => ({ pts: [...arcPts(6.4, 0, 5.2, 205, 515, 18), ...arcPts(-6.4, 0, 5.2, 25, 335, 18)] }),
  hexagonAntacid: () => ({ pts: roundCorners(ngon(0, 0, 9.5, 6, 0), 1.6) }),
  // heparin: a sulfated polysaccharide chain (hexagon sugars in a row)
  chain: () => { const cs = [-12.6, -4.2, 4.2, 12.6].map((x, i) => [x, i % 2 ? 1.6 : -1.6]); return { pts: hull(cs.flatMap(c => ngon(c[0], c[1], 4.6, 6, 0))), units: cs }; },
  // proton pump inhibitor: a clamp that closes on the pump; the dot is its covalent (disulfide) bond
  clamp: () => ({ pts: [...arcPts(0, 1, 9.5, 150, 390, 20), ...arcPts(0, 1, 5, 390, 150, 14)], dot: [8.2 * Math.cos(rad(30)), 1 + 7.2 * Math.sin(rad(30))], flat: true }),
  // vinca alkaloid: a stub that caps a growing microtubule end
  stub: () => ({ pts: [...arcPts(0, -4, 6.4, 180, 360, 10), ...arcPts(0, 6, 6.4, 0, 180, 10)], top: true }),
  // taxane: a staple that locks a microtubule's subunits together
  lock: () => ({ pts: roundCorners([[-9, 8], [-9, -7], [9, -7], [9, 8], [4.6, 8], [4.6, -2.6], [-4.6, -2.6], [-4.6, 8]], 1.4) }),
};
export const DRUG_FAMILIES = Object.keys(FAM);
/* drug({ family = 'plug', name, tag: 'right' | 'left' | 'above' | 'below', ...common }) -> Art. The glyph is
   anchored at its centre; the name tag is kit text (sm b purple) 6 units off the glyph, outside every scaled
   group. Part drug (both the glyph and its tag). at: centre, tag. Extra: glyphBox, tagBox. */
export function drug(opts = {}) {
  const { family = 'plug', name, tag = 'right', parts = {} } = opts, s = opts.s || 1;
  if (!FAM[family]) throw new Error(`drug: unknown family ${family}`);
  const g = FAM[family]();
  let svg = '';
  if (g.knob) svg += solid(circlePts(g.knob[0], g.knob[1], g.knob[2], 20), DC, { s, size: 8 });
  if (g.units) {
    for (let i = 1; i < g.units.length; i++) svg += bond(g.units[i - 1], g.units[i], DC.line, 2.2);
    for (const u of g.units) svg += solid(ngon(u[0], u[1], 4.6, 6, 0), DC, { s, holes: [ngon(u[0], u[1], 1.9, 6, 0).reverse()], size: 9 });
  } else svg += solid(g.pts, DC, { s, holes: g.holes || [], size: 18, lit: !g.flat }); // a C shape has no lit face (it would cross the opening)
  if (g.top) svg += `<ellipse cx="0" cy="-4" rx="6.4" ry="2.4" fill="${mix(DC.base, WHITE, 0.45)}" stroke="${DC.line}" stroke-width="${f(1.1 / s)}"/>`;
  if (g.dot) svg += `<circle cx="${f(g.dot[0])}" cy="${f(g.dot[1])}" r="2.2" fill="${DC.line}"/>`;
  let sil = g.pts;
  if (g.knob) sil = sil.concat(circlePts(g.knob[0], g.knob[1], g.knob[2], 16));
  if (g.dot) sil = sil.concat(circlePts(g.dot[0], g.dot[1], 2.2, 8));
  const art = finish(svg, sil, { centre: [0, 0] }, opts, 'drug');
  if (!name) return artOf(art.svg, art.box, art.at, art.outline, { glyphBox: art.box });
  // the tag, in picture coordinates
  const gb = art.box, size = 18, w = textWidth(name, 'sm b'), asc = size * 0.74, desc = size * 0.22, gap = 6;
  const cyG = gb[1] + gb[3] / 2, cxG = gb[0] + gb[2] / 2;
  let tx, ty, anchor;
  if (tag === 'left') { tx = gb[0] - gap; ty = cyG + asc / 2 - desc / 2; anchor = 'end'; }
  else if (tag === 'above') { tx = cxG; ty = gb[1] - gap - desc; anchor = 'middle'; }
  else if (tag === 'below') { tx = cxG; ty = gb[1] + gb[3] + gap + asc; anchor = 'middle'; }
  else { tx = gb[0] + gb[2] + gap; ty = cyG + asc / 2 - desc / 2; anchor = 'start'; }
  const x0 = anchor === 'end' ? tx - w : anchor === 'middle' ? tx - w / 2 : tx;
  const tagBox = [x0, ty - asc, w, asc + desc].map(f);
  const text = `<g data-part="${nameOf(parts, 'drug')}"><text x="${f(tx)}" y="${f(ty)}" text-anchor="${anchor}" class="sm b purple">${name}</text></g>`;
  const X0 = Math.min(gb[0], tagBox[0]), Y0 = Math.min(gb[1], tagBox[1]), X1 = Math.max(gb[0] + gb[2], tagBox[0] + tagBox[2]), Y1 = Math.max(gb[1] + gb[3], tagBox[1] + tagBox[3]);
  return artOf(art.svg + text, [X0, Y0, X1 - X0, Y1 - Y0].map(f), { ...art.at, tag: [f(tx), f(ty)] }, art.outline, { glyphBox: gb, tagBox });
}
