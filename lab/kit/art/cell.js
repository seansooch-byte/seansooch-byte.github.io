// lab/kit/art/cell.js: cell, membrane, receptors, channels, transporters, vesicles, enzymes (art direction
// section 4.5). Plain ES module; import it unversioned as /lab/kit/art/cell.js (or ./cell.js from a sibling).
//
// Expected behaviour (each item is tested by tools/art-tests/cell.test.mjs):
//   - Every primitive takes the common options { x = 0, y = 0, s = 1, rot = 0, flip = false, emphasis = [],
//     parts = {}, key } and returns an Art { svg, box, at, outline(state) } whose toString() is its svg.
//     Membrane proteins are anchored at the membrane midplane: extracellular (or luminal) side up (negative
//     y), cytoplasm down. Their native membrane is MEMBRANE.thick units thick, the bilayer() thickness.
//   - Every emitted data-part is a leaf; parts renames them (channel({ parts: { channel: 'door-na' } })).
//   - Weight strokes keep their on-screen weight at any s; decorative detail is ax-d2 / ax-d3 unless the
//     part is named in emphasis; no text (labels belong to the lesson); every colour is a P entry or mixed
//     from one.
//   - State parameters are numbers 0..1 (open, inactivated, bound, gprotein, fuse, breakdown, glow) or a
//     phase that loops seamlessly in [0, 1). outline(state) keeps one command structure, so an art ghost
//     can be lerped.
//   - Accuracy (section 4.5): GPCRs are seven-pass with a heterotrimeric G protein under them; channels are
//     their true assembly per kind (Nav and Cav one chain of four domains, Kv and Kir four subunits, ENaC
//     three, K-ATP four Kir6.2 inside four SUR1, ligand-gated a pentamer); Nav inactivates with a hinged lid
//     on the III to IV linker, Kv (Shaker type) with a ball and chain; sulfonylureas bind SUR1, not the pore;
//     transporters work by alternating access; steroids and T3 act on intracellular receptors.
import { P, SW, D2, D3, f, pt, mix, fill, uid, artOf, place, smooth, samplePath, sampleAlong, pathLength, pointInPolygon, distToPolygon, volumeGradient, spec, partName, placer, litGradient } from './core.js';

/* ---------- shared bits ---------- */
// The bilayer's thickness, head to head. Membrane proteins are drawn for this thickness; at icon scale a
// lesson draws membraneBand({ w }) and scales the protein by w / MEMBRANE.thick.
export const MEMBRANE = { thick: 24, head: 3.1 };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, +v || 0));
const ease = t => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
const darker = (col, k = 0.45) => mix(col, P.ui.ink, k);
const WHITE = P.ui.white;
const nameOf = partName; // core: renames, multi-names, each word once
const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const closedD = pts => smooth(pts, { closed: true });
const polyD = pts => `M${pts.map(pt).join(' L')} Z`;
const circleD = (x, y, r) => `M${f(x - r)} ${f(y)} a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
const ellipsePts = (cx, cy, rx, ry, n = 16, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * 2 * Math.PI; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const capsule = (x1, y1, x2, y2, w) => {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2, r = w / 2;
  return `M${f(x1 + nx)} ${f(y1 + ny)} L${f(x2 + nx)} ${f(y2 + ny)} A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)} L${f(x1 - nx)} ${f(y1 - ny)} A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)} Z`;
};
// The common frame: options, weight strokes, part names, detail classes, ids, and the light. build(c)
// returns { svg, box, at, outline(state) (native coordinates), extra, mapExtra(map) }.
function make(opts, build) {
  const { x = 0, y = 0, s = 1, rot = 0, flip = false, emphasis = [], parts = {}, key } = opts;
  // _ws: the weight scale of a primitive drawn inside another one (placed at s 1 in the parent's frame)
  const ws = opts._ws ?? s, defs = [], lit = {};
  let n = 0;
  const c = {
    s: ws, key, opts,
    w: t => f((SW[t] ?? t) / ws),
    part: name => `data-part="${nameOf(parts, name)}"`,
    em: name => emphasis.includes(name),
    // class attribute for detail: dropped when the part is emphasised
    d: (name, cls = D2) => emphasis.includes(name) ? '' : ` class="${cls}"`,
    id: base => uid(`${base}${++n}`, key != null ? key : undefined),
    // a material's volume fill; a rotated or mirrored primitive moves the highlight so the light stays at
    // the picture's upper left (section 2.6)
    fill: mat => {
      if (!rot && !flip) return fill(mat);
      if (!lit[mat]) { lit[mat] = c.id(`lit-${mat}`); defs.push(litGradient(lit[mat], mat, { rot, flip })); }
      return `url(#${lit[mat]})`;
    },
    defs,
  };
  const r = build(c);
  const svg = (defs.length ? `<defs>${defs.join('')}</defs>` : '') + r.svg;
  const art = place(artOf(svg, r.box.map(f), r.at || {}), { x, y, s, rot, flip });
  const pl = placer({ x, y, s, rot, flip }), map = pl.map;
  art.outline = (st = {}) => pl.mapD(r.outline ? r.outline(st) : '');
  Object.assign(art, r.extra || {}, r.mapExtra ? r.mapExtra(map) : {});
  return art;
}
const bodyPath = (c, d, mat, { tier = 'outline', extra = '' } = {}) => `<path d="${d}" fill="${c.fill(mat)}" stroke="${P[mat].line}" stroke-width="${c.w(tier)}" stroke-linejoin="round"${extra}/>`;
const flatPath = (c, d, col, line, { tier = 'internal', extra = '' } = {}) => `<path d="${d}" fill="${col}" stroke="${line}" stroke-width="${c.w(tier)}" stroke-linejoin="round"${extra}/>`;

/* TODO(promote to molecules.js): ion, messenger and drug glyphs. molecules.js (section 4.12) owns them;
   these minimal copies follow its shapes (section 2.5) until it exists, then cell.js imports from it. */
// One glyph about 2r across: Na circle, K triangle, Ca rounded square, Cl diamond, H small circle with a
// plus, HCO3 trefoil, glucose hexagon with its ring oxygen, water drop; any other key (a messenger) a
// sphere in its colour. A key may also be a colour.
export function glyph(key, x, y, c, { r = 5, attrs = '' } = {}) {
  const m = P[key] && P[key].base ? P[key] : { base: key || P.protein2.base };
  const base = m.base, line = m.line || darker(base), sw = c.w('detail'), st = `fill="${base}" stroke="${line}" stroke-width="${sw}" stroke-linejoin="round"`;
  const hl = (hx, hy, hr) => `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(hr)}" fill="${WHITE}" fill-opacity=".45"/>`;
  let g;
  switch (key) {
    case 'k': g = `<path d="M${f(x)} ${f(y - r * 1.15)} L${f(x + r * 1.12)} ${f(y + r * 0.82)} L${f(x - r * 1.12)} ${f(y + r * 0.82)} Z" ${st}/>` + hl(x - r * 0.2, y - r * 0.15, r * 0.24); break;
    case 'ca': g = `<rect x="${f(x - r * 0.92)}" y="${f(y - r * 0.92)}" width="${f(r * 1.84)}" height="${f(r * 1.84)}" rx="${f(r * 0.4)}" ${st}/>` + hl(x - r * 0.38, y - r * 0.38, r * 0.26); break;
    case 'cl': g = `<path d="M${f(x)} ${f(y - r * 1.15)} L${f(x + r * 1.05)} ${f(y)} L${f(x)} ${f(y + r * 1.15)} L${f(x - r * 1.05)} ${f(y)} Z" ${st}/>` + hl(x - r * 0.3, y - r * 0.3, r * 0.22); break;
    case 'h': g = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.8)}" ${st}/><path d="M${f(x - r * 0.42)} ${f(y)} H${f(x + r * 0.42)} M${f(x)} ${f(y - r * 0.42)} V${f(y + r * 0.42)}" stroke="${WHITE}" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`; break;
    case 'hco3': g = [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return `<circle cx="${f(x + r * 0.55 * Math.cos(a))}" cy="${f(y + r * 0.55 * Math.sin(a))}" r="${f(r * 0.5)}" ${st}/>`; }).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="${line}"/>`; break;
    case 'glucose': { const pts = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [x + r * 1.1 * Math.cos(a), y + r * 1.1 * Math.sin(a)]; }); g = `<path d="${polyD(pts)}" ${st}/><circle cx="${f(pts[1][0])}" cy="${f(pts[1][1])}" r="${f(r * 0.32)}" fill="${P.oxygen.base}" stroke="${P.oxygen.line}" stroke-width="${sw}"/>` + hl(x - r * 0.35, y - r * 0.3, r * 0.24); break; }
    case 'water': g = `<path d="M${f(x)} ${f(y - r * 1.2)} C${f(x + r * 0.5)} ${f(y - r * 0.4)} ${f(x + r)} ${f(y)} ${f(x + r)} ${f(y + r * 0.35)} C${f(x + r)} ${f(y + r * 0.95)} ${f(x - r)} ${f(y + r * 0.95)} ${f(x - r)} ${f(y + r * 0.35)} C${f(x - r)} ${f(y)} ${f(x - r * 0.5)} ${f(y - r * 0.4)} ${f(x)} ${f(y - r * 1.2)} Z" ${st}/>` + hl(x - r * 0.35, y + r * 0.1, r * 0.22); break;
    default: g = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * (key === 'na' ? 1 : 0.92))}" ${st}/>` + hl(x - r * 0.35, y - r * 0.35, r * 0.27);
  }
  return `<g${attrs}>${g}</g>`;
}
// Drug glyphs, drug purple (section 2.5): plug (reversible pore or cleft blocker), selective (a longer plug
// with a nub for a side pocket), acetyl (a covalent flag: aspirin), cap (a receptor antagonist).
export function drugGlyph(kind, x, y, c, { rot = 0, attrs = '' } = {}) {
  const D = P.drug, st = `fill="${D.base}" stroke="${D.line}" stroke-width="${c.w('internal')}" stroke-linejoin="round"`;
  let g;
  if (kind === 'acetyl') g = `<path d="M0 6 L0 -5" stroke="${D.line}" stroke-width="${c.w(1.6)}" stroke-linecap="round"/><path d="M0 -6 L9 -3 L0 0.5 Z" ${st}/>`;
  else if (kind === 'selective') g = `<rect x="-8.5" y="-3.6" width="15" height="7.2" rx="3.6" ${st}/><circle cx="7.6" cy="-3.2" r="3.1" ${st}/><path d="M-5.8 -1.6 H2.4" stroke="${D.hi}" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`;
  else if (kind === 'cap') g = `<rect x="-8" y="-4.4" width="16" height="8.8" rx="2.6" ${st}/><path d="M-5 -2 H4" stroke="${D.hi}" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`;
  else g = `<rect x="-6.5" y="-3.6" width="13" height="7.2" rx="3.6" ${st}/><path d="M-4 -1.6 H2.6" stroke="${D.hi}" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`;
  return `<g${attrs} transform="translate(${f(x)} ${f(y)})${rot ? ` rotate(${f(rot)})` : ''}">${g}</g>`;
}

/* ---------- bilayer and band ---------- */
/** bilayer({ d or x1, y1, x2, y2, gap = 7, highlight: [from, to] (fractions of the length), snipped:
 *  [lipid indices], clear: [[at, half]] (arc-length units: no lipids there, for a protein), kinked = true })
 *  A golden core band (always) under heads and tail pairs (ax-d2 detail). Lipids are numbered from the
 *  path's start; snipped lipids lose their sn-2 tail on the leaflet to the right of the path's direction
 *  (below a left-to-right membrane, the cytoplasmic leaflet by the course's convention). Part: membrane.
 *  Extra: lipids (pairs drawn), tails (tails drawn). */
export function bilayer(opts = {}) {
  const { d: d0, x1 = 0, y1 = 0, x2 = 100, y2 = 0, gap = 7, highlight, snipped = [], clear = [], kinked = true } = opts;
  const d = d0 || `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`;
  return make(opts, c => {
    const T = MEMBRANE.thick, hr = MEMBRANE.head, L = pathLength(d), closed = /[Zz]\s*$/.test(d);
    const n = Math.max(2, Math.round(L / gap)), M = Math.max(64, Math.ceil(L / 1.5) + 2), dense = sampleAlong(d, M);
    const at = u => { const i = clamp(u / L, 0, 1) * (M - 1), j = Math.min(M - 2, Math.floor(i)), t = i - j, p = dense[j], q = dense[j + 1]; return [lerp(p[0], q[0], t), lerp(p[1], q[1], t), p[2]]; };
    let hl = '';
    if (highlight) {
      const [a, b] = highlight, pts = [];
      for (let k = 0; k <= 24; k++) pts.push(at(L * lerp(a, b, k / 24)));
      hl = `<path d="M${pts.map(pt).join(' L')}" fill="none" stroke="${P.ui.blueWash}" stroke-width="${f(T + 10)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const core = `<path d="${d}" fill="none" stroke="${P.bilayerCore.line}" stroke-width="${T}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P.bilayerCore.base}" stroke-width="${f(T - 2.8)}" stroke-linejoin="round"/>`;
    let heads = '', shine = '', tails = '', lipids = 0, tailN = 0;
    const sn = new Set(snipped), off = T / 2 - hr;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * L / n;
      if (clear.some(([cu, half]) => Math.abs(u - cu) < half)) continue;
      lipids++;
      const [px, py, ang] = at(u), a = ang * Math.PI / 180, tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx;
      for (const side of [-1, 1]) {
        const hx = px + nx * off * side, hy = py + ny * off * side;
        heads += circleD(hx, hy, hr) + ' ';
        shine += circleD(hx - 0.9, hy - 0.9, 0.85) + ' ';
        // two tails from the head toward the midplane; sn-2 (the second) kinked at a cis double bond
        for (const k of [-1, 1]) {
          if (k === 1 && side === 1 && sn.has(i)) continue;
          const sx = hx - nx * side * (hr - 0.4) + tx * k * 1.2, sy = hy - ny * side * (hr - 0.4) + ty * k * 1.2;
          const ex = px + nx * side * 1.4 + tx * k * 1.2, ey = py + ny * side * 1.4 + ty * k * 1.2;
          if (k === 1 && kinked) { const mx = (sx + ex) / 2 + tx * 1.4, my = (sy + ey) / 2 + ty * 1.4; tails += `M${pt([sx, sy])} L${pt([mx, my])} L${pt([ex + tx * 1.4, ey + ty * 1.4])} `; }
          else tails += `M${pt([sx, sy])} L${pt([ex, ey])} `;
          tailN++;
        }
      }
    }
    const cls = c.d('membrane');
    const detail = lipids ? `<g${cls} data-lipid="${lipids}"><path d="${tails}" fill="none" stroke="${P.lipidTail.line}" stroke-width="${c.w('detail')}" stroke-linecap="round"/>`
      + `<path d="${heads}" fill="${P.lipidHead.base}" stroke="${P.lipidHead.line}" stroke-width="${c.w('detail')}"/><path d="${shine}" fill="${P.lipidHead.hi}"/></g>` : '';
    const pts = samplePath(d, 32), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const box = [Math.min(...xs) - T / 2, Math.min(...ys) - T / 2, Math.max(...xs) - Math.min(...xs) + T, Math.max(...ys) - Math.min(...ys) + T];
    return {
      svg: `<g ${c.part('membrane')}>${hl}${core}${detail}</g>`, box,
      at: { start: at(0).slice(0, 2), mid: at(L / 2).slice(0, 2), end: at(L).slice(0, 2), outer: [at(L / 2)[0] - Math.cos(at(L / 2)[2] * Math.PI / 180 - Math.PI / 2) * 0, at(L / 2)[1]] },
      outline: () => d, extra: { lipids, tails: tailN, length: L, closed },
    };
  });
}
/** membraneBand({ d, w = 8 }): the two-line icon membrane, golden core between two line-coloured edges. */
export function membraneBand(opts = {}) {
  const { d = 'M0 0 L100 0', w = 8 } = opts;
  return make(opts, c => {
    const edge = w < 5 ? 1.8 : 2.8;
    const pts = samplePath(d, 32), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return {
      svg: `<g ${c.part('membrane')}><path d="${d}" fill="none" stroke="${P.bilayerCore.line}" stroke-width="${f(w)}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P.bilayerCore.base}" stroke-width="${f(w - edge)}" stroke-linejoin="round"/></g>`,
      box: [Math.min(...xs) - w / 2, Math.min(...ys) - w / 2, Math.max(...xs) - Math.min(...xs) + w, Math.max(...ys) - Math.min(...ys) + w],
      at: { start: pts[0], mid: pts[16], end: pts[31] }, outline: () => d,
    };
  });
}
// The protein's footprint in the bilayer: a core-coloured band that hides lipid heads under the protein.
const collarSvg = (half, c) => `<rect x="${f(-half)}" y="${f(-MEMBRANE.thick / 2 - 0.6)}" width="${f(2 * half)}" height="${f(MEMBRANE.thick + 1.2)}" fill="${P.bilayerCore.base}"/>`;

/* ---------- GPCR ---------- */
const GP = { xs: [-24, -16, -8, 0, 8, 16, 24], top: -17, bot: 17, hw: 4.3, pocket: [0, -8] };
const alphaPts = (ax, ay) => smooth(ellipsePts(ax, ay, 10, 7.4, 12, Math.PI), { closed: true });
/** gpcr({ ligand: null | 'agonist' | 'antagonist', ligandCol, bound = 1 when a ligand is given, gprotein:
 *  null | 0..1 (0 the GDP-bound trimer docked under the receptor, 1 the alpha subunit gone, lit),
 *  mat = 'protein' }) Seven transmembrane helices (TM1, 3, 5, 7 in front of TM2, 4, 6), ECL1 to 3 above,
 *  ICL1 to 3 below (ICL3 the large G protein loop), N terminus outside, C terminus with helix 8 inside, a
 *  binding pocket in the outer half. An agonist tilts TM6's inner end outward (the active state). Anchor:
 *  membrane midplane, centre. Native 60 x 90. Parts: receptor, gprotein, ligand (agonist) or drug
 *  (antagonist). at: pocket, ligand, n, c, alpha, beta, icl3, top, bottom. outline(state) is the alpha
 *  subunit at state.gprotein. */
export function gpcr(opts = {}) {
  const { ligand = null, ligandCol = P.ach.base, mat = 'protein' } = opts;
  const g = opts.gprotein === undefined ? 0 : opts.gprotein, bound = clamp(opts.bound ?? (ligand ? 1 : 0));
  return make(opts, c => {
    const M_ = P[mat], act = ligand === 'agonist' ? ease(bound) : 0, back = mix(M_.base, M_.lo, 0.45);
    const tilt = i => i === 5 ? ` transform="rotate(${f(-9 * act)} ${GP.xs[5]} ${GP.top})"` : '';
    const helix = (i, front) => {
      const x = GP.xs[i], y0 = front ? GP.top : GP.top - 1.5, h = GP.bot - GP.top + (front ? 0 : 1);
      const r = `<rect data-helix="TM${i + 1}" x="${f(x - GP.hw)}" y="${f(y0)}" width="${f(2 * GP.hw)}" height="${f(h)}" rx="${GP.hw}" fill="${front ? c.fill(mat) : back}" stroke="${M_.line}" stroke-width="${c.w(1.25)}"/>`;
      const turns = front ? `<path${c.d('receptor')} d="M${f(x - 3)} ${f(y0 + 8)} l6 -3 M${f(x - 3)} ${f(y0 + 16)} l6 -3 M${f(x - 3)} ${f(y0 + 24)} l6 -3" stroke="${M_.lo}" stroke-opacity=".7" stroke-width="${c.w('detail')}" stroke-linecap="round"/>` : '';
      return `<g${tilt(i)}>${r}${turns}</g>`;
    };
    const loop = (i, j, up, h, name) => {
      const y = up ? GP.top + 2 : GP.bot - 2, k = up ? -1 : 1, xi = GP.xs[i] + (i === 5 && !up ? 2.6 * act : 0), xj = GP.xs[j] + (j === 5 && !up ? 2.6 * act : 0);
      const dd = `M${f(xi)} ${y} C${f(xi - 1)} ${f(y + k * h)} ${f(xj + 1)} ${f(y + k * h)} ${f(xj)} ${y}`;
      return `<g data-loop="${name}"><path d="${dd}" fill="none" stroke="${M_.line}" stroke-width="3.6" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="${M_.base}" stroke-width="1.8" stroke-linecap="round"/></g>`;
    };
    const cord = dd => `<path d="${dd}" fill="none" stroke="${M_.line}" stroke-width="3.6" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="${M_.base}" stroke-width="1.8" stroke-linecap="round"/>`;
    const loops = loop(1, 2, true, 6, 'ecl1') + loop(3, 4, true, 9, 'ecl2') + loop(5, 6, true, 6, 'ecl3')
      + loop(0, 1, false, 6, 'icl1') + loop(2, 3, false, 6, 'icl2') + loop(4, 5, false, 11, 'icl3');
    const nterm = cord('M-24 -15 C-26 -24 -22 -30 -28 -38'), cterm = cord(`M24 15 C25 21 29 21 31 22 C33 24 29 30 28 35`);
    const pocket = `<ellipse cx="${GP.pocket[0]}" cy="${GP.pocket[1]}" rx="3.4" ry="6.5" fill="${M_.lo}" fill-opacity=".7"/>`;
    const receptor = `<g ${c.part('receptor')}>${nterm}${cterm}${loops}${[1, 3, 5].map(i => helix(i, false)).join('')}${pocket}${[0, 2, 4, 6].map(i => helix(i, true)).join('')}</g>`;
    // the G protein (heterotrimer, alternate protein colour): beta propeller, gamma on it, alpha docked
    let gp = '', ax = 8, ay = 31;
    const bx = -9, by = 32;
    if (g !== null && g !== false) {
      const k = ease(g), G2 = P.protein2;
      ax = 8 + 22 * k; ay = 31 + k;
      const anchor = (x0, y0, x1) => `<path${c.d('gprotein')} d="M${f(x0)} ${f(y0)} C${f(x0)} ${f(y0 - 4)} ${f(x1)} ${f(y0 - 5)} ${f(x1)} 12.5" fill="none" stroke="${P.lipidTail.line}" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`;
      const glow = k > 0.02 ? `<ellipse cx="${f(ax)}" cy="${f(ay)}" rx="15" ry="11.5" fill="${P.ui.blueWash}" fill-opacity="${f(0.95 * k)}"/>` : '';
      const blades = Array.from({ length: 7 }, (_, i) => { const a = i / 7 * 2 * Math.PI - Math.PI / 2; return `M${pt([bx + 2.2 * Math.cos(a), by + 2.2 * Math.sin(a)])} L${pt([bx + 7 * Math.cos(a), by + 7 * Math.sin(a)])}`; }).join(' ');
      gp = `<g ${c.part('gprotein')}>${anchor(bx - 6, by - 6, bx - 9)}${anchor(ax - 6, ay - 6, ax - 8)}`
        + `<g data-sub="beta"><circle cx="${bx}" cy="${by}" r="8.6" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/><path${c.d('gprotein')} d="${blades}" stroke="${G2.lo}" stroke-width="${c.w('detail')}"/></g>`
        + `<g data-sub="gamma"><ellipse cx="${bx - 3}" cy="${by - 8.6}" rx="7" ry="2.7" transform="rotate(-12 ${bx - 3} ${by - 8.6})" fill="${G2.lo}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/></g>`
        + `${glow}<g data-sub="alpha"><path d="${alphaPts(ax, ay)}" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('outline')}"/><ellipse cx="${f(ax + 4.5)}" cy="${f(ay - 4.5)}" rx="5" ry="3.6" fill="${G2.base}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/></g></g>`;
    }
    let lig = '', lp = null;
    if (ligand) {
      const k = ease(bound);
      lp = [lerp(0, GP.pocket[0], k), lerp(-40, GP.pocket[1], k)];
      lig = ligand === 'antagonist'
        ? `<g ${c.part('drug')}>${drugGlyph('cap', lp[0], lp[1], c, { rot: 90 })}</g>`
        : `<g ${c.part('ligand')}>${glyph(ligandCol, lp[0], lp[1], c, { r: 5.5 })}</g>`;
    }
    const right = Math.max(33, ax + 13);
    return {
      svg: receptor + gp + lig, box: [-31, -46, right + 31, 90],
      at: { pocket: GP.pocket, ligand: lp || [0, -40], n: [-28, -38], c: [28, 35], alpha: [ax, ay], beta: [bx, by], icl3: [12, 26], top: [0, -26], bottom: [0, 24] },
      outline: (st = {}) => { const k = ease(st.gprotein ?? (g || 0)); return alphaPts(8 + 22 * k, 31 + k); },
    };
  });
}

/* ---------- channels ---------- */
// Left front subunit, inner edge from the outer mouth down to the cytoplasmic end, then the outer side.
// g: the gate, 0 shut to 1 open. Per kind: extracellular reach, where the gate is, the cytoplasmic end.
const CH = {
  vg: { top: -26, bot: 25, gateY: 13, outer: 19 },
  kir: { top: -24, bot: 23, gateY: 12, outer: 17 },
  enac: { top: -43, bot: 19, gateY: 11, outer: 15 },
  lgic: { top: -46, bot: 24, gateY: 0, outer: 15 },
};
const KIND = { nav: 'vg', cav: 'vg', kv: 'vg', cl: 'vg', generic: 'vg', kir: 'kir', katp: 'kir', enac: 'enac', lgic: 'lgic' };
function subunitPts(kind, g) {
  const K = CH[KIND[kind] || 'vg'], { top, bot, outer } = K;
  if (KIND[kind] === 'lgic') return [
    [-outer + 2, top + 1], [-6, top], [-7.5, -32], [-5, -16], [-3.2, -8], [-(0.35 + 4.6 * g), 0], [-(2.6 + 2.6 * g), 8], [-(4.5 + 2 * g), 15],
    [-(5.5 + 1.5 * g), bot], [-12, bot + 1], [-14, 14], [-13, 0], [-14, -13], [-21, -18], [-22, -34],
  ];
  if (KIND[kind] === 'enac') return [
    [-12, top - 1], [-6, top], [-7, -28], [-3.4, -16], [-2.2, -9], [-2.2, -4], [-3.8, 2], [-(0.35 + 4.8 * g), K.gateY], [-(2 + 3 * g), 16],
    [-(4 + 2 * g), bot], [-11, bot + 1], [-15, 13], [-15, -11], [-22, -17], [-24, -31],
  ];
  return [
    [-outer + 3, top], [-7, top - 1], [-3.6, top + 6], [-2.3, -11], [-2.3, -6], [-4.6, -1], [-(0.35 + 4.8 * g), K.gateY], [-(1.6 + 4.6 * g), bot - 4],
    [-(5 + 3 * g), bot], [-outer + 4, bot + 0.5], [-outer, bot - 8], [-outer - 1, 0], [-outer, top + 8],
  ];
}
// Pore lumen (between the two inner edges) for the ion light.
function porePts(kind, g) {
  const p = subunitPts(kind, g), inner = KIND[kind] === 'lgic' ? p.slice(1, 9) : KIND[kind] === 'enac' ? p.slice(1, 10) : p.slice(1, 9);
  return [...inner, ...mirror(inner)];
}
export const channelGeometry = {
  // full width of the pore at the gate
  gate: (kind, open) => 2 * (0.35 + (KIND[kind] === 'lgic' ? 4.6 : 4.8) * clamp(open)),
  subunit: subunitPts,
};
const ASSEMBLY = {
  nav: { chains: 1, domains: 4, subunits: 1, gate: 'lid', voltage: true }, cav: { chains: 1, domains: 4, subunits: 1, voltage: true },
  kv: { subunits: 4, gate: 'ball', voltage: true }, kir: { subunits: 4 }, katp: { kir: 4, sur: 4, subunits: 8 },
  enac: { subunits: 3 }, lgic: { subunits: 5, ligand: true }, cl: { subunits: null }, generic: { subunits: null },
};
/** channel({ kind: 'nav' | 'cav' | 'kv' | 'kir' | 'katp' | 'enac' | 'cl' | 'lgic' | 'generic', open 0..1,
 *  inactivated 0..1 (Nav: hinged lid on the III to IV linker; Kv: N-terminal ball and chain; no other kind
 *  draws one), ion: key (the open pore lights in its colour and holds one ion), phase (optional: the ion
 *  travels the pore, inward, or outward for K), plug 0..1 (a drug: in the pore; outer mouth for ENaC; on
 *  SUR1 for K-ATP), bound 0..1 and ligandCol, sites = 2 (ligand-gated), collar = true, mat = 'protein' })
 *  Side view: two front subunits (or domains) flank the pore, the back one shows through it. Voltage-gated
 *  kinds carry their voltage-sensing domains with S4 charges, which move outward as the channel opens.
 *  Anchor: membrane midplane, pore axis. Parts: channel, inactivation-gate, ion, drug, ligand.
 *  Extra: assembly { chains, domains, subunits, kir, sur, gate }. outline(state): the two front subunits. */
export function channel(opts = {}) {
  const { kind = 'generic', ion = null, collar = true, mat = 'protein', ligandCol = P.ach.base, sites = 2 } = opts;
  const open = clamp(opts.open ?? 0), inact = clamp(opts.inactivated ?? 0), plug = clamp(opts.plug ?? 0), bound = clamp(opts.bound ?? 0);
  const A = ASSEMBLY[kind] || ASSEMBLY.generic, K = CH[KIND[kind] || 'vg'];
  return make(opts, c => {
    const M_ = P[mat], back = mix(M_.base, M_.lo, 0.55), g = ease(open);
    const L = subunitPts(kind, g), R = mirror(L);
    const vg = !!A.voltage, katp = kind === 'katp';
    const half = katp ? 45 : vg ? 31 : KIND[kind] === 'enac' ? 24 : KIND[kind] === 'lgic' ? 22 : K.outer + 2;
    const sub = (pts, name) => `<path data-sub="${name}" d="${closedD(pts)}" fill="${c.fill(mat)}" stroke="${M_.line}" stroke-width="${c.w('outline')}" stroke-linejoin="round"/>`;
    const subNames = kind === 'enac' ? ['alpha', 'gamma', 'beta'] : vg && A.domains ? ['I', 'IV', 'II-III'] : katp ? ['kir6.2', 'kir6.2', 'kir6.2'] : ['a', 'b', 'c'];
    let behind = '', front = '', over = '';
    // the back subunit (or domains II and III) seen through the pore
    const bt = K.top + (KIND[kind] === 'lgic' || KIND[kind] === 'enac' ? 4 : 2), bb = K.bot - 2;
    behind += `<rect data-sub="${subNames[2]}" x="-11" y="${f(bt)}" width="22" height="${f(bb - bt)}" rx="7" fill="${back}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`;
    // voltage-sensing domains (S1 to S4) at the sides; S4's charges move outward with opening
    if (vg && kind !== 'cl' && kind !== 'generic') {
      for (const sx of [-1, 1]) {
        behind += `<rect data-sub="vsd" x="${f(sx < 0 ? -31 : 19)}" y="-14" width="12" height="28" rx="5.5" fill="${mix(M_.base, M_.hi, 0.3)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`;
        const lift = -3.5 * g, px = sx * 25;
        over += `<path data-sensor="S4"${c.d('sensor', D3)} d="${[-6, 0, 6].map(yy => `M${f(px - 2.2)} ${f(yy + lift)} H${f(px + 2.2)} M${f(px)} ${f(yy + lift - 2.2)} V${f(yy + lift + 2.2)}`).join(' ')}" stroke="${M_.line}" stroke-width="${c.w(1.3)}" stroke-linecap="round"/>`;
      }
    }
    // cytoplasmic domains: Kir and K-ATP (the pore continues through them); Kv's T1 domains
    if (KIND[kind] === 'kir') for (const sx of [-1, 1]) behind += `<path d="${closedD([[sx * 3.4, 21], [sx * 15, 21], [sx * 18, 30], [sx * 13, 40], [sx * 3.6, 39], [sx * 3, 30]])}" fill="${back}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`;
    if (kind === 'kv') for (const sx of [-1, 1]) behind += `<circle cx="${sx * 10}" cy="31" r="5.5" fill="${back}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`;
    // SUR1, four around the Kir6.2 tetramer: two show, with their nucleotide-binding domains below
    if (katp) for (const sx of [-1, 1]) {
      const G2 = P.protein2;
      behind += `<g data-sub="sur1"><circle cx="${sx * 37}" cy="28" r="7.4" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/><circle cx="${sx * 26}" cy="30" r="7.4" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/>`
        + `<rect x="${sx < 0 ? -44 : 20}" y="-17" width="24" height="36" rx="8" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('outline')}"/></g>`;
    }
    // one chain: the intracellular linkers I-II, II-III, III-IV (behind the front domains)
    let lid = '', lidAt = null;
    if (A.chains === 1) {
      const cord = (dd, name, cls = '') => `<g data-loop="${name}"${cls}><path d="${dd}" fill="none" stroke="${M_.line}" stroke-width="3.6" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="${M_.base}" stroke-width="1.8" stroke-linecap="round"/></g>`;
      behind += cord('M-13 24 C-16 36 -8 37 -6 23', 'linker I-II') + cord('M-3 23 C-3 30 3 30 3 23', 'linker II-III', c.d('channel')) + cord('M5 23 C6 33 14 34 13 24', 'linker III-IV');
      if (kind === 'nav') {
        const th = lerp(80, 209, ease(inact)) * Math.PI / 180, hx = 9.5, hy = 31.5, ex = hx + 11 * Math.cos(th), ey = hy + 11 * Math.sin(th);
        lidAt = [hx + 5.5 * Math.cos(th), hy + 5.5 * Math.sin(th)];
        lid = `<g ${c.part('inactivation-gate')} data-gate="lid"><path d="${capsule(hx, hy, ex, ey, 5.6)}" fill="${c.fill(mat)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/><circle cx="${hx}" cy="${hy}" r="1.8" fill="${M_.line}"/></g>`;
      }
    }
    if (kind === 'kv') {
      const k = ease(inact), bx = lerp(-19, 0, k), by = lerp(45, 27.5, k);
      lidAt = [bx, by];
      const chain = `M-12 25 Q${f(lerp(-24, -14, k))} ${f(lerp(34, 38, k))} ${f(bx)} ${f(by)}`;
      lid = `<g ${c.part('inactivation-gate')} data-gate="ball"><path d="${chain}" fill="none" stroke="${M_.line}" stroke-width="${c.w(1.6)}" stroke-linecap="round"/><circle cx="${f(bx)}" cy="${f(by)}" r="4.6" fill="${c.fill(mat)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/></g>`;
    }
    front += sub(L, subNames[0]) + sub(R, subNames[1]);
    // ligand-gated: binding sites at two subunit interfaces in the extracellular domain
    let lig = '';
    if (A.ligand) {
      const k = ease(bound), spots = [[-9.5, -30], [9.5, -30]].slice(0, Math.max(0, Math.min(2, sites)));
      for (const [sx, sy] of spots) front += `<ellipse cx="${sx}" cy="${sy}" rx="3.4" ry="4.4" fill="${M_.lo}" fill-opacity=".75"/>`;
      if (bound > 0) lig = `<g ${c.part('ligand')}>${spots.map(([sx, sy]) => glyph(ligandCol, lerp(sx * 1.6, sx, k), lerp(sy - 26, sy, k), c, { r: 4.6, attrs: ' data-ligand="1"' })).join('')}</g>`;
    }
    // the open pore lights in the ion colour, with one ion in it
    let ionSvg = '';
    if (ion && open > 0) {
      const m = P[ion] || { base: ion }, dir = opts.dir || (ion === 'k' ? 'out' : 'in');
      let iy = KIND[kind] === 'lgic' ? -6 : -2;
      if (opts.phase != null) { const ph = ((opts.phase % 1) + 1) % 1; iy = dir === 'in' ? lerp(K.top - 6, K.bot + 6, ph) : lerp(K.bot + 6, K.top - 6, ph); }
      const poreD = closedD(porePts(kind, g));
      // the open pore is water-filled: the outside fluid, tinted with the ion it passes
      ionSvg = `<g ${c.part('ion')}><path d="${poreD}" fill="${P.space.ecf}" fill-opacity="${f(g)}"/><path d="${poreD}" fill="${m.base}" fill-opacity="${f(0.22 * g)}"/>${glyph(ion, 0, iy, c, { r: 5, attrs: ` opacity="${f(Math.min(1, open * 2))}"` })}</g>`;
    }
    let drug = '', drugAt = null;
    if (plug > 0) {
      const k = ease(plug);
      const [x0, y0, x1, y1] = katp ? [-32, -44, -32, -1] : kind === 'enac' ? [0, -56, 0, -20] : kind === 'lgic' ? [0, -60, 0, -9] : [0, 44, 0, -1];
      drugAt = [lerp(x0, x1, k), lerp(y0, y1, k)];
      drug = `<g ${c.part('drug')} opacity="${f(Math.min(1, plug * 3))}">${drugGlyph('plug', drugAt[0], drugAt[1], c, { rot: katp ? 0 : 90 })}</g>`;
    }
    const top = Math.min(K.top - 2, A.ligand && bound > 0 ? -62 : 0, plug > 0 && drugAt[1] < 0 ? drugAt[1] - 8 : 0), bot = Math.max(K.bot + 2, KIND[kind] === 'kir' ? 42 : 0, lid ? 50 : 0, plug > 0 && drugAt[1] > 0 ? drugAt[1] + 8 : 0);
    const svg = `<g ${c.part('channel')}>${collar ? collarSvg(KIND[kind] === 'enac' || KIND[kind] === 'lgic' ? 15.5 : half, c) : ''}${behind}${front}${over}</g>${ionSvg}${lid}${lig}${drug}`;
    const at = { pore: [0, -2], top: [0, K.top], bottom: [0, K.bot], gate: [0, K.gateY], left: [-half, 0], right: [half, 0] };
    if (lidAt) at.lid = lidAt;
    if (drugAt) at.drug = drugAt;
    if (katp) at.sur1 = [-32, 0];
    return {
      svg, box: [-half - 1, top, 2 * half + 2, bot - top], at,
      outline: (st = {}) => { const gg = ease(clamp(st.open ?? open)), l = subunitPts(kind, gg); return `${closedD(l)} ${closedD(mirror(l))}`; },
      extra: { assembly: { kind, ...A } },
    };
  });
}

/* ---------- transporters ---------- */
// facing: 0 open to the outside, 1 open to the inside (alternating access), one cycle per phase.
export const transporterGeometry = {
  facing: ph => (1 - Math.cos(2 * Math.PI * ph)) / 2,
  half: (c, w = 22) => {
    const u = 1 - c;
    return [[-w + 6, -26], [-(1.2 + 7.5 * u), -25], [-(1.6 + 5 * u), -12], [-3.6, 0], [-(1.6 + 5 * c), 12], [-(1.2 + 7.5 * c), 25], [-w + 6, 26], [-w, 19], [-w - 1.5, 0], [-w, -19]];
  },
};
const DEFAULT_CARGO = { uniporter: ['glucose'], symporter: ['na', 'glucose'], antiporter: ['na', 'h'], pump: [{ key: 'na', n: 3 }, { key: 'k', n: 2 }], reuptake: ['noradrenaline', 'na'] };
function cargoList(kind, cargo) {
  const items = (cargo || DEFAULT_CARGO[kind] || []).map(q => typeof q === 'string' ? (q.includes(':') ? { key: q.split(':')[0], dir: q.split(':')[1] } : { key: q }) : { ...q });
  return items.map((q, i) => ({ n: 1, ...q, dir: q.dir || (kind === 'antiporter' ? (i === 0 ? 'in' : 'out') : kind === 'pump' ? (i === 0 ? 'out' : 'in') : 'in') }));
}
// y of an inward-moving cargo through one cycle; outward cargo runs the same path reversed, half a cycle on.
function cargoY(ph) {
  if (ph < 0.5) { const p = ph / 0.5; return { y: -8 + 38 * Math.pow(p, 1.5), o: p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1 }; }
  const q = (ph - 0.5) / 0.5; return { y: lerp(-34, -8, q), o: Math.min(1, q / 0.3) };
}
/** transporter({ kind: 'uniporter' | 'symporter' | 'antiporter' | 'pump' | 'reuptake', phase 0..1 (rocking:
 *  0 open outward, .5 open inward; in-cargo crosses in the first half, out-cargo in the second), cargo:
 *  [key | 'key:in' | { key, dir: 'in' | 'out', n }] (defaults: symporter all in; antiporter first in, rest
 *  out; pump first out, rest in, as Na out and K in), beta = false (P-type pump's glycosylated beta
 *  subunit), atp = false (ATP by the pump's cytoplasmic head; its terminal phosphate sits on the P domain
 *  while the pump is phosphorylated), blocked 0..1 (a drug in the outer mouth), arrows = true (one arrow
 *  per cargo, in its colour), collar = true, mat = 'protein' })
 *  Two helix bundles rock about a central binding site. Anchor: membrane midplane, centre. Native 50 x 76
 *  (the pump's head reaches 48 down). Parts: pump (kind pump) or carrier, cargo, atp, drug. Extra: cargo
 *  [{ key, dir, x, y, opacity }] (native). outline(state): the two bundles at state.phase. */
export function transporter(opts = {}) {
  const { kind = 'uniporter', beta = false, atp = false, arrows = true, collar = true, mat = 'protein' } = opts;
  const ph = (((opts.phase ?? 0) % 1) + 1) % 1, blocked = clamp(opts.blocked ?? 0);
  return make(opts, c => {
    const M_ = P[mat], back = mix(M_.base, M_.lo, 0.55), cf = transporterGeometry.facing(ph), pump = kind === 'pump';
    const w = pump ? 23 : 21, Lh = transporterGeometry.half(cf, w), Rh = mirror(Lh);
    const stripes = sx => `<path${c.d('carrier')} d="${[8, 13.5].map(xx => `M${f(sx * (xx + 1.5 * (sx < 0 ? 1 - cf : cf)))} -20 Q${f(sx * xx)} 0 ${f(sx * (xx + 1.5 * (sx < 0 ? cf : 1 - cf)))} 20`).join(' ')}" fill="none" stroke="${M_.lo}" stroke-opacity=".75" stroke-width="${c.w('detail')}"/>`;
    let body = `${collar ? collarSvg(w + 2, c) : ''}<rect x="-9" y="-22" width="18" height="44" rx="6" fill="${back}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`;
    let head = '';
    if (pump) {
      // the P-type cytoplasmic head: actuator (A), phosphorylation (P) and nucleotide-binding (N) domains
      head = [[-15, 33, 8.4], [-2, 30, 8], [11, 36, 9.4]].map(([hx, hy, r], i) => `<circle data-domain="${'APN'[i]}" cx="${hx}" cy="${hy}" r="${r}" fill="${c.fill(mat)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`).join('');
    }
    body += head + bodyPath(c, closedD(Lh), mat) + bodyPath(c, closedD(Rh), mat) + stripes(-1) + stripes(1);
    if (pump && beta) {
      const G2 = P.protein2;
      body += `<g data-sub="beta"><rect x="${w + 1}" y="-15" width="8" height="30" rx="4" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/><ellipse cx="${w + 5}" cy="-23" rx="8.5" ry="6.5" fill="${c.fill('protein2')}" stroke="${G2.line}" stroke-width="${c.w('internal')}"/>`
        + `<path d="M${w + 6} -29 L${w + 8} -35 L${w + 5} -40" fill="none" stroke="${darker(P.glyco.base, 0.35)}" stroke-width="${c.w(1.25)}"/>${[[w + 8, -35], [w + 5, -40], [w + 6, -29.5]].map(([gx, gy]) => `<circle cx="${gx}" cy="${gy}" r="2.6" fill="${P.glyco.base}" stroke="${darker(P.glyco.base, 0.35)}" stroke-width="${c.w('detail')}"/>`).join('')}</g>`;
    }
    // cargo, clustered by group, moving through the binding site
    const list = cargoList(kind, opts.cargo), items = [];
    const groups = { in: list.filter(q => q.dir === 'in'), out: list.filter(q => q.dir === 'out') };
    let cargoSvg = '';
    for (const dir of ['in', 'out']) {
      const G = groups[dir];
      G.forEach((q, gi) => {
        const { y, o } = cargoY(dir === 'in' ? ph : (ph + 0.5) % 1), yy = dir === 'in' ? y : -y;
        for (let j = 0; j < q.n; j++) {
          const gx = (gi - (G.length - 1) / 2) * 10, x = gx + (j - (q.n - 1) / 2) * 6.4, yj = yy + (j % 2 ? 4 : 0);
          items.push({ key: q.key, dir, x: f(x), y: f(yj), opacity: f(o), i: list.indexOf(q) });
          if (o > 0.01) cargoSvg += glyph(q.key, x, yj, c, { r: 4.6, attrs: ` data-cargo="${q.key}"${o < 1 ? ` opacity="${f(o)}"` : ''}` });
          else cargoSvg += `<g data-cargo="${q.key}" opacity="0"/>`;
        }
      });
    }
    // one arrow per cargo group at the sides, in the cargo's line colour
    let arr = '';
    if (arrows) list.forEach((q, i) => {
      const sx = i % 2 ? 1 : -1, ax = sx * (w + (pump && beta && sx > 0 ? 14 : 7)), y0 = q.dir === 'in' ? -13 : 13, y1 = -y0, col = (P[q.key] && P[q.key].line) || P.ui.muted, hd = q.dir === 'in' ? 1 : -1;
      arr += `<g${c.d('arrows', D3)}><path d="M${f(ax)} ${y0} L${f(ax)} ${f(y1 - hd * 4)}" stroke="${col}" stroke-width="${c.w(1.5)}" stroke-linecap="round"/><path d="M${f(ax - 3.4)} ${f(y1 - hd * 5)} L${f(ax)} ${y1} L${f(ax + 3.4)} ${f(y1 - hd * 5)} Z" fill="${col}"/></g>`;
    });
    let atpSvg = '';
    if (atp) {
      const phos = ph >= 0.5 || ph < 0.08, PO = P.po4;
      const ring = (x, y, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="${WHITE}" fill-opacity=".6" stroke="${PO.base}" stroke-width="${c.w(1.6)}"${extra}/>`;
      atpSvg = `<g ${c.part('atp')}><path d="${polyD([[25, 40], [29.5, 43], [28, 48], [22, 48], [20.5, 43]])}" fill="${P.cytoplasm.lo}" stroke="${P.cytoplasm.line}" stroke-width="${c.w('internal')}"/>`
        + ring(17, 44) + ring(12.2, 45.5) + (phos ? ring(-2, 39.5, ' data-phospho="1"') : ring(7.4, 47)) + '</g>';
    }
    let drug = '', drugAt = null;
    if (blocked > 0) { const k = ease(blocked); drugAt = [0, lerp(-44, -19, k)]; drug = `<g ${c.part('drug')} opacity="${f(Math.min(1, blocked * 3))}">${drugGlyph('plug', drugAt[0], drugAt[1], c, { rot: 90 })}</g>`; }
    const right = w + (pump && beta ? 18 : 2) + (arrows ? 6 : 0), left = w + 2 + (arrows ? 6 : 0);
    const bot = pump ? (atp ? 50 : 46) : 38, top = Math.min(-38, beta && pump ? -43 : -38, drugAt ? drugAt[1] - 8 : 0);
    const mouthY = lerp(-22, 22, cf);
    const at = { mouth: [0, f(mouthY)], site: [0, 0], top: [0, -26], bottom: [0, 26], left: [-w, 0], right: [w, 0] };
    if (pump) at.head = [0, 36];
    if (atp) at.atp = [24, 44];
    if (drugAt) at.drug = drugAt;
    return {
      svg: `<g ${c.part(pump ? 'pump' : 'carrier')}>${body}${arr}</g><g ${c.part('cargo')}>${cargoSvg}</g>${atpSvg}${drug}`,
      box: [-left, top, left + right, bot - top], at,
      outline: (st = {}) => { const cc = transporterGeometry.facing((((st.phase ?? ph) % 1) + 1) % 1), l = transporterGeometry.half(cc, w); return `${closedD(l)} ${closedD(mirror(l))}`; },
      extra: { cargo: items.sort((p, q) => p.i - q.i), facing: cf },
    };
  });
}

/* ---------- vesicle ---------- */
export const vesicleGeometry = {
  // half-width of the fusion pore (0 until the membranes fuse)
  pore: (r, fuse) => fuse <= 0 ? 0 : r * (1.1 * ease(clamp(fuse / 0.6)) + 0.9 * ease(clamp((fuse - 0.6) / 0.4))),
  // depth of the cup below the plasma membrane's midline
  depth: (r, w, fuse) => lerp(2 * r + w, 0.3 * r, ease(clamp((fuse - 0.6) / 0.4))),
  // the merged membrane's midline: plasma membrane, omega neck, cup, neck, plasma membrane
  omega(r, w, fuse) {
    const M = -(r + w), a = Math.max(0.01, this.pore(r, fuse)), D = this.depth(r, w, fuse), rc = (a * a + D * D) / (2 * D), cy = M + D - rc;
    let t0 = Math.atan2(M - cy, -a), t1 = Math.atan2(M - cy, a);
    while (t1 > t0) t1 -= 2 * Math.PI;
    const arc = Array.from({ length: 13 }, (_, i) => { const t = lerp(t0, t1, i / 12); return [rc * Math.cos(t), cy + rc * Math.sin(t)]; });
    const Lx = a + r + 8;
    return { M, a, D, rc, cy, Lx, pts: [[-Lx, M], [-a - 3, M], ...arc, [a + 3, M], [Lx, M]] };
  },
};
/** vesicle({ r = 12, w = 5 (membrane width: match the plasma membrane's membraneBand w), cargo: key,
 *  n = 5, fuse 0..1 (0 docked under the membrane; .6 an omega with an open pore; 1 collapsed into the
 *  plasma membrane), proteins: ['aquaporin' | 'glut' | 'generic' | { kind, mat }], outside = P.space.ecf,
 *  inside = P.cytoplasm.base }) Anchor: the docked vesicle's centre; the plasma membrane's midline is at
 *  at.membrane (y = -(r + w)). While fusing the vesicle redraws that stretch of plasma membrane, so the host
 *  band must use the same w and the same colours. Parts: vesicles, cargo, vesicle-protein.
 *  outline(state): the merged membrane's midline at state.fuse. */
export function vesicle(opts = {}) {
  const { r = 12, w = 5, cargo = null, n = cargo ? 5 : 0, proteins = [], outside = P.space.ecf, inside = P.cytoplasm.base } = opts;
  const fuse = clamp(opts.fuse ?? 0);
  return make(opts, c => {
    const band = dd => `<path d="${dd}" fill="none" stroke="${P.bilayerCore.line}" stroke-width="${f(w)}" stroke-linejoin="round"/><path d="${dd}" fill="none" stroke="${P.bilayerCore.base}" stroke-width="${f(w - (w < 5 ? 1.8 : 2.8))}" stroke-linejoin="round"/>`;
    const M = -(r + w);
    let mem, cupMid, protPts;
    if (fuse <= 0.001) {
      mem = `<circle cx="0" cy="0" r="${f(r)}" fill="${mix(outside, inside, 0.25)}"/>${band(circleD(0, 0, r))}<path${c.d('vesicles')} d="M${f(-r * 0.55)} ${f(-r * 0.5)} A${f(r * 0.75)} ${f(r * 0.75)} 0 0 1 ${f(r * 0.1)} ${f(-r * 0.72)}" fill="none" stroke="${WHITE}" stroke-opacity=".6" stroke-width="${c.w(1.25)}" stroke-linecap="round"/>`;
      cupMid = 0;
      protPts = proteins.map((_, i) => { const a = (90 + (i - (proteins.length - 1) / 2) * 48) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a), (a * 180 / Math.PI) + 90]; });
    } else {
      const O = vesicleGeometry.omega(r, w, fuse), d = smooth(O.pts), h = w / 2 + 0.8;
      // cover the host band over the merging stretch, outside above and cytoplasm below, then the cup
      const cover = `<rect x="${f(-O.Lx)}" y="${f(M - h)}" width="${f(2 * O.Lx)}" height="${f(h)}" fill="${outside}"/><rect x="${f(-O.Lx)}" y="${f(M)}" width="${f(2 * O.Lx)}" height="${f(h)}" fill="${inside}"/>`;
      const cup = `<path d="${smooth(O.pts.slice(1, -1))} Z" fill="${outside}"/><rect x="${f(-O.a - 3)}" y="${f(M - h)}" width="${f(2 * O.a + 6)}" height="${f(h + 0.5)}" fill="${outside}"/>`;
      mem = cover + cup + band(d);
      cupMid = M + O.D / 2;
      const arcD = smooth(O.pts.slice(2, -2)), along = sampleAlong(arcD, 41);
      protPts = proteins.map((_, i) => { const q = along[Math.round(20 + (i - (proteins.length - 1) / 2) * 7)]; return [q[0], q[1], q[2]]; });
    }
    // cargo: inside the vesicle, then out through the pore into the outside
    const k = ease(clamp((fuse - 0.15) / 0.65)), ri = Math.max(2, r - w / 2 - 4.2);
    let cg = '', sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, rr = n > 1 ? ri * Math.sqrt((i + 0.5) / n) : 0;
      const ix = rr * Math.cos(a), iy = cupMid + rr * Math.sin(a), ox = (i - (n - 1) / 2) * 9, oy = M - w / 2 - 9 - (i % 2) * 8;
      const x = lerp(ix, ox, k), y = lerp(iy, oy, k);
      sx += x; sy += y;
      cg += glyph(cargo, x, y, c, { r: 4, attrs: ` data-cargo="${cargo}"` });
    }
    const prot = protPts.map(([px, py, ang], i) => {
      const q = proteins[i], kind = typeof q === 'string' ? q : q.kind, mat = (typeof q === 'object' && q.mat) || (kind === 'aquaporin' ? 'protein' : 'protein2'), m = P[mat];
      const L = w + 7, hw = 3.6, shape = kind === 'aquaporin'
        ? `M${-hw} ${-L / 2} L${hw} ${-L / 2} L${hw * 0.45} 0 L${hw} ${L / 2} L${-hw} ${L / 2} L${-hw * 0.45} 0 Z`
        : `M${-hw} ${-L / 2 + 2} Q${-hw} ${-L / 2} ${-hw + 2} ${-L / 2} L${hw - 2} ${-L / 2} Q${hw} ${-L / 2} ${hw} ${-L / 2 + 2} L${hw} ${L / 2 - 2} Q${hw} ${L / 2} ${hw - 2} ${L / 2} L${-hw + 2} ${L / 2} Q${-hw} ${L / 2} ${-hw} ${L / 2 - 2} Z`;
      return `<path transform="translate(${f(px)} ${f(py)}) rotate(${f(ang + 90)})" d="${shape}" fill="${m.base}" stroke="${m.line}" stroke-width="${c.w('internal')}" stroke-linejoin="round"/>`;
    }).join('');
    const top = Math.min(M - w / 2 - 22, -r - 2), right = Math.max(r + 2, fuse > 0.001 ? vesicleGeometry.omega(r, w, fuse).Lx : 0, (n - 1) / 2 * 9 + 6);
    return {
      svg: `<g ${c.part('vesicles')}>${mem}</g>${prot ? `<g ${c.part('vesicle-protein')}>${prot}</g>` : ''}${n ? `<g ${c.part('cargo')}>${cg}</g>` : ''}`,
      box: [-right, top, 2 * right, Math.max(r + w / 2 + 2, 2) - top],
      at: { centre: [0, 0], membrane: [0, M], pore: [0, M], cargo: n ? [sx / n, sy / n] : [0, cupMid] },
      outline: (st = {}) => smooth(vesicleGeometry.omega(r, w, clamp(st.fuse ?? fuse)).pts),
      extra: { fuse },
    };
  });
}

/* ---------- nucleus ---------- */
/** nucleus({ r = 30, aspect = 1 (ry / rx), pores = true, nucleolus = true, chromatin: 'loose' |
 *  'condensed' (M phase only: condensed chromosomes, no nucleolus), breakdown 0..1 (the envelope
 *  fragments and fades), dna: false | true (a short DNA helix slot, at.dna) })
 *  Double envelope (two membranes with the perinuclear space between), pore complexes, euchromatin with
 *  peripheral heterochromatin, a nucleolus. Anchor: centre. Parts: nucleus, dna. outline(state): the
 *  envelope at state.breakdown (fragments drift outward a little as they disperse). */
export function nucleus(opts = {}) {
  const { r = 30, aspect = 1, pores = true, nucleolus: nuc = true, chromatin = 'loose', dna = false } = opts;
  const b = clamp(opts.breakdown ?? 0);
  return make(opts, c => {
    const rx = r, ry = r * aspect, N = P.nucleus, condensed = chromatin === 'condensed';
    const env = ellipsePts(0, 0, rx - 1.6, ry - 1.6, 24), envD = closedD(env);
    let s = '';
    if (b < 1) s += `<ellipse cx="0" cy="0" rx="${f(rx)}" ry="${f(ry)}" fill="${c.fill('nucleus')}" fill-opacity="${f(1 - b)}"/>`;
    // heterochromatin at the periphery, euchromatin speckle (detail)
    if (!condensed && b < 1) {
      const clumps = ellipsePts(0, 0, rx * 0.72, ry * 0.72, 9, 0.3).map(([x, y], i) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(Math.min(5, r * 0.11))}" ry="${f(Math.min(3, r * 0.065))}" transform="rotate(${i * 40} ${f(x)} ${f(y)})"/>`).join('');
      s += `<g${c.d('nucleus')} fill="${N.lo}" fill-opacity="${f(0.38 * (1 - b))}">${clumps}</g>`;
    }
    if (nuc && !condensed && b < 0.5) s += `<g data-nucleolus="1"><circle cx="${f(rx * 0.22)}" cy="${f(-ry * 0.18)}" r="${f(r * 0.27)}" fill="${P.nucleolus.base}" stroke="${P.nucleolus.line}" stroke-width="${c.w('internal')}"/><circle cx="${f(rx * 0.22 - r * 0.09)}" cy="${f(-ry * 0.18 - r * 0.09)}" r="${f(r * 0.07)}" fill="${N.hi}" fill-opacity=".35"/></g>`;
    if (condensed) {
      const nC = Math.max(4, Math.min(8, Math.round(r / 5))), w_ = Math.max(2.4, r * 0.09), len = r * 0.2;
      for (let i = 0; i < nC; i++) {
        const a = i * 2.39996 + 0.4, rr = r * 0.62 * Math.sqrt((i + 0.5) / nC), x = rr * Math.cos(a), y = rr * Math.sin(a) * aspect, t = i * 47;
        // two sister chromatids joined at the centromere
        s += `<path data-chromosome="${i + 1}" transform="translate(${f(x)} ${f(y)}) rotate(${t})" d="M${f(-len * 0.55)} ${f(-len)} Q0 0 ${f(-len * 0.55)} ${f(len)} M${f(len * 0.55)} ${f(-len)} Q0 0 ${f(len * 0.55)} ${f(len)}" fill="none" stroke="${P.nucleolus.base}" stroke-width="${f(w_)}" stroke-linecap="round"/>`;
      }
    }
    if (b < 1) {
      // the envelope: two membranes (line) with the lighter perinuclear space between them
      const frag = b > 0 ? ` stroke-dasharray="${f(Math.max(0.1, 1 - b) * 14)} ${f(b * 14 + 0.01)}" stroke-opacity="${f(1 - 0.6 * b)}"` : '';
      s += `<g data-envelope="1"><path d="${envD}" fill="none" stroke="${N.line}" stroke-width="${f(4.2 / c.s)}"${frag}/><path d="${envD}" fill="none" stroke="${N.hi}" stroke-width="${f(1.8 / c.s)}"${frag}/></g>`;
      if (pores && b < 0.5) {
        const np = Math.max(4, Math.round(2 * Math.PI * r / 30)), pp = sampleAlong(envD, np + 1).slice(0, np);
        s += `<g${c.d('pores', D3)}>${pp.map(([px, py, a], i) => `<g data-pore="${i + 1}" transform="translate(${f(px)} ${f(py)}) rotate(${f(a)})"><rect x="-1.5" y="-2.6" width="3" height="5.2" fill="${N.hi}"/><path d="M-1.5 -2.6 V2.6 M1.5 -2.6 V2.6" stroke="${N.line}" stroke-width="${c.w('detail')}"/></g>`).join('')}</g>`;
      }
    }
    let dnaSvg = '', dnaAt = null;
    if (dna) {
      const y0 = ry * 0.42, L = rx * 0.55;
      dnaAt = [0, y0 - 3];
      dnaSvg = `<g ${c.part('dna')} data-dna="1">${dnaHelix(-L, L, y0, c)}</g>`;
    }
    const at = { centre: [0, 0], envelope: [rx * 0.7, -ry * 0.7], nucleolus: [rx * 0.22, -ry * 0.18] };
    if (dnaAt) at.dna = dnaAt;
    return {
      svg: `<g ${c.part('nucleus')}>${s}</g>${dnaSvg}`, box: [-rx - 1, -ry - 1, 2 * rx + 2, 2 * ry + 2], at,
      outline: (st = {}) => { const k = 1 + 0.12 * clamp(st.breakdown ?? b); return closedD(ellipsePts(0, 0, rx * k, ry * k, 16)); },
    };
  });
}
// A short DNA double helix, two strands and base-pair rungs, from x0 to x1 along y.
function dnaHelix(x0, x1, y, c) {
  const n = 40, A = 3.2, per = 13, s1 = [], s2 = [], rungs = [];
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), ph = (x - x0) / per * 2 * Math.PI; s1.push([x, y + A * Math.sin(ph)]); s2.push([x, y - A * Math.sin(ph)]); }
  for (let x = x0 + 2; x < x1; x += 3.25) { const ph = (x - x0) / per * 2 * Math.PI; rungs.push(`M${f(x)} ${f(y + A * Math.sin(ph))} L${f(x)} ${f(y - A * Math.sin(ph))}`); }
  return `<path${c.d('dna')} d="${rungs.join(' ')}" stroke="${P.nucleus.hi}" stroke-width="${c.w('detail')}"/><path d="M${s2.map(pt).join(' L')}" fill="none" stroke="${P.nucleolus.line}" stroke-width="${c.w(1.6)}"/><path d="M${s1.map(pt).join(' L')}" fill="none" stroke="${P.nucleolus.base}" stroke-width="${c.w(1.6)}"/>`;
}

/* ---------- cell body ---------- */
function cellShape(shape, w, h) {
  const a = w / 2, b = h / 2;
  const rr = (rad) => { const r = Math.min(rad, a, b); return `M${f(-a + r)} ${f(-b)} L${f(a - r)} ${f(-b)} Q${f(a)} ${f(-b)} ${f(a)} ${f(-b + r)} L${f(a)} ${f(b - r)} Q${f(a)} ${f(b)} ${f(a - r)} ${f(b)} L${f(-a + r)} ${f(b)} Q${f(-a)} ${f(b)} ${f(-a)} ${f(b - r)} L${f(-a)} ${f(-b + r)} Q${f(-a)} ${f(-b)} ${f(-a + r)} ${f(-b)} Z`; };
  switch (shape) {
    case 'cuboidal': return rr(Math.min(w, h) * 0.18);
    case 'columnar': return rr(Math.min(w, h) * 0.2);
    case 'polygon': return closedD([[-a * 0.55, -b], [a * 0.5, -b * 0.98], [a, -b * 0.05], [a * 0.55, b], [-a * 0.5, b * 0.97], [-a, b * 0.04]].flatMap((p, i, arr) => { const q = arr[(i + 1) % arr.length]; return [p, [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)]]; }));
    case 'pyramidal': return closedD([[0, -b], [a * 0.4, -b * 0.8], [a * 0.75, 0], [a, b * 0.82], [a * 0.6, b], [-a * 0.6, b], [-a, b * 0.82], [-a * 0.75, 0], [-a * 0.4, -b * 0.8]]);
    case 'squamous': return closedD([[-a, b * 0.15], [-a * 0.7, -b * 0.25], [-a * 0.3, -b * 0.4], [0, -b], [a * 0.3, -b * 0.4], [a * 0.7, -b * 0.25], [a, b * 0.15], [a * 0.6, b * 0.6], [0, b], [-a * 0.6, b * 0.6]]);
    case 'spindle': return closedD([[-a, 0], [-a * 0.55, -b * 0.42], [0, -b], [a * 0.55, -b * 0.42], [a, 0], [a * 0.55, b * 0.42], [0, b], [-a * 0.55, b * 0.42]]);
    default: return closedD(ellipsePts(0, 0, a, b, 16).map(([x, y], i) => { const k = 1 + 0.025 * Math.sin(i * 2.3); return [x * k, y * k]; }));
  }
}
/** cellBody({ shape: 'round' | 'cuboidal' | 'columnar' | 'polygon' | 'pyramidal' | 'squamous' | 'spindle',
 *  w = 120, h = 90, nucleus: {...nucleus options, dx, dy} | false, organelles = true (mitochondria as
 *  ax-d3, ER and Golgi as ax-d2), membrane: 'line' | 'band' | 'bilayer', polarity: 'apical-up' | 'none'
 *  (columnar cells default apical-up: nucleus basal, Golgi above it) })
 *  Anchor: centre; box w x h. Parts: cell, nucleus (a sibling leaf), membrane (band or bilayer only).
 *  at: centre, nucleus, apical, basal, left, right. outline(): the cell outline. */
export function cellBody(opts = {}) {
  const { shape = 'round', w = 120, h = 90, organelles = true, membrane = 'line' } = opts;
  const polarity = opts.polarity || (shape === 'columnar' ? 'apical-up' : 'none');
  return make(opts, c => {
    const d = cellShape(shape, w, h), C = P.cytoplasm, gid = c.id('cyto'), poly = samplePath(d, 64);
    const m = Math.min(w, h);
    const nOpt = opts.nucleus === false ? null : { ...(opts.nucleus || {}) };
    const aspect = nOpt && nOpt.aspect || (shape === 'columnar' ? Math.min(1.6, h / w * 0.75) : shape === 'squamous' ? 0.45 : shape === 'spindle' ? 0.4 : 1);
    const nr = nOpt && nOpt.r || (shape === 'spindle' ? w * 0.18 : shape === 'squamous' ? w * 0.16 : shape === 'columnar' ? Math.min(w * 0.3, h * 0.17) : m * 0.27);
    const nx = nOpt ? (nOpt.dx ?? 0) : 0, ny = nOpt ? (nOpt.dy ?? (polarity === 'apical-up' ? h * 0.2 : 0)) : 0;
    let org = '';
    if (organelles) {
      const k = clamp(m / 100, 0.6, 1.3), avoid = ([x, y], r) => pointInPolygon([x, y], poly) && distToPolygon([x, y], poly) > r + 3 && (!nOpt || Math.hypot((x - nx) / (nr + r + 4), (y - ny) / (nr * aspect + r + 4)) > 1);
      const spots = [];
      for (let gy = -h / 2 + 8; gy < h / 2 - 8; gy += 7) for (let gx = -w / 2 + 8; gx < w / 2 - 8; gx += 7) if (avoid([gx, gy], 9 * k)) spots.push([gx, gy]);
      const pick = (want, list) => list.sort((p, q) => Math.hypot(p[0] - want[0], p[1] - want[1]) - Math.hypot(q[0] - want[0], q[1] - want[1]))[0];
      const mitoAt = [[-w * 0.28, -h * 0.22], [w * 0.3, h * 0.22], [w * 0.28, -h * 0.25]].map(t => spots.length ? pick(t, spots.slice()) : null).filter(Boolean);
      const mito = ([mx, my], i) => {
        const L = 17 * k, H = 8 * k, rot = [20, -25, 60][i % 3];
        const cr = Array.from({ length: 4 }, (_, j) => { const xx = -L / 2 + (j + 1) * L / 5; return `M${f(xx)} ${f(-H / 2 + 1.6)} L${f(xx + 1)} ${f(H / 2 - 1.6)}`; }).join(' ');
        return `<g transform="translate(${f(mx)} ${f(my)}) rotate(${rot})"><rect x="${f(-L / 2)}" y="${f(-H / 2)}" width="${f(L)}" height="${f(H)}" rx="${f(H / 2)}" fill="${P.mito.hi}" stroke="${P.mito.line}" stroke-width="${c.w('internal')}"/><rect x="${f(-L / 2 + 1.5)}" y="${f(-H / 2 + 1.5)}" width="${f(L - 3)}" height="${f(H - 3)}" rx="${f(H / 2 - 1.5)}" fill="${P.mito.base}"/><path d="${cr}" stroke="${P.mito.lo}" stroke-width="${c.w('detail')}" stroke-linecap="round"/></g>`;
      };
      org += `<g${c.d('organelles', D3)}>${mitoAt.slice(0, m > 70 ? 3 : 2).map(mito).join('')}</g>`;
      if (nOpt && m > 50) {
        // rough ER: sheets around the nucleus; Golgi: a stack of curved cisternae on the apical side
        const er = [1.25, 1.45].map(kk => { const pts = ellipsePts(nx, ny, (nr + 3) * kk, (nr * aspect + 3) * kk, 24).filter(([x, y]) => (x - nx) < 0 && pointInPolygon([x, y], poly) && distToPolygon([x, y], poly) > 4); return pts.length > 3 ? `M${pts.map(pt).join(' L')}` : ''; }).join(' ');
        const gy = ny - nr * aspect - 7 * k, gx = nx + nr * 0.35, gol = pointInPolygon([gx, gy - 6 * k], poly) && distToPolygon([gx, gy - 6 * k], poly) > 5 ? [0, 1, 2, 3].map(i => `M${f(gx - (9 - i) * k)} ${f(gy - i * 3 * k)} Q${f(gx)} ${f(gy - i * 3 * k + 3 * k)} ${f(gx + (9 - i) * k)} ${f(gy - i * 3 * k)}`).join(' ') : '';
        org += `<g${c.d('organelles')}><path d="${er}" fill="none" stroke="${P.er.line}" stroke-width="${c.w(2.6)}" stroke-linecap="round"/><path d="${er}" fill="none" stroke="${P.er.base}" stroke-width="${c.w(1.2)}" stroke-linecap="round"/>`
          + (gol ? `<path d="${gol}" fill="none" stroke="${P.er.line}" stroke-width="${c.w(2.4)}" stroke-linecap="round"/><path d="${gol}" fill="none" stroke="${P.er.base}" stroke-width="${c.w(1.1)}" stroke-linecap="round"/>` : '') + '</g>';
      }
    }
    const grad = `<defs>${volumeGradient(gid, 'cytoplasm', [-w / 2, -h / 2, w, h])}</defs>`;
    const edge = membrane === 'line' ? `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${c.w('outline')}" stroke-linejoin="round"/>` : '';
    let memSvg = '';
    if (membrane === 'band') memSvg = membraneBand({ d, w: 5, parts: c.opts.parts, _ws: c.s }).svg;
    if (membrane === 'bilayer') memSvg = bilayer({ d, parts: c.opts.parts, emphasis: c.opts.emphasis, _ws: c.s, key: c.key != null ? `${c.key}-m` : undefined }).svg;
    const body = `<g ${c.part('cell')}>${grad}<path d="${d}" fill="url(#${gid})"/>${spec(-w * 0.2, -h * 0.24, w * 0.16, h * 0.1, -20)}${org}${edge}</g>${memSvg}`;
    let nuc = '';
    if (nOpt) nuc = nucleus({ r: nr, aspect, ...nOpt, x: nx, y: ny, s: 1, _ws: c.s, parts: c.opts.parts, emphasis: c.opts.emphasis, key: c.key != null ? `${c.key}-n` : undefined }).svg;
    return {
      svg: body + nuc, box: [-w / 2, -h / 2, w, h],
      at: { centre: [0, 0], nucleus: [nx, ny], apical: [0, -h / 2], basal: [0, h / 2], left: [-w / 2, 0], right: [w / 2, 0] },
      outline: () => d,
    };
  });
}

/* ---------- epithelium ---------- */
const EPI_H = { columnar: 60, cuboidal: 40, squamous: 14 };
/** epithelium({ n = 4, kind: 'columnar' | 'cuboidal' | 'squamous', cw = 40, h (default by kind),
 *  brush = false (microvilli: brush border), junctions = true (tight junctions at the apical end of each
 *  lateral membrane), apical = 1 and basal = 1 (protein slots per cell), basement = true })
 *  A row of polarised cells, apical (lumen) side up, basolateral side down on a basement membrane, nuclei
 *  basal in columnar cells. Anchor: the top-left of the apical surface. Parts: epithelium, tight-junction,
 *  basement-membrane. Extra: slots { apical: [[x, y]], basal: [[x, y]] } in picture coordinates.
 *  at: apical, basal, lumen, interstitium, junction, basement, cell0..cellN. */
export function epithelium(opts = {}) {
  const { n = 4, kind = 'columnar', cw = 40, brush = false, junctions = true, apical = 1, basal = 1, basement = true } = opts;
  const h = opts.h ?? EPI_H[kind] ?? 60;
  return make(opts, c => {
    const C = P.cytoplasm, gap = 2.4, gid = c.id('epi'), N = P.nucleus, rr = Math.min(6, h * 0.25);
    let cells = '', vill = '', nucs = '', junc = '';
    const slots = { apical: [], basal: [] }, at = {};
    for (let i = 0; i < n; i++) {
      const x0 = i * cw + gap / 2, x1 = (i + 1) * cw - gap / 2, mx = (x0 + x1) / 2;
      at[`cell${i}`] = [mx, h / 2];
      cells += `<path d="M${f(x0)} 0 L${f(x1)} 0 L${f(x1)} ${f(h - rr)} Q${f(x1)} ${f(h)} ${f(x1 - rr)} ${f(h)} L${f(x0 + rr)} ${f(h)} Q${f(x0)} ${f(h)} ${f(x0)} ${f(h - rr)} Z" fill="url(#${gid})" stroke="${C.line}" stroke-width="${c.w('outline')}" stroke-linejoin="round" data-cell="${i}"/>`;
      if (brush) {
        const nv = Math.max(4, Math.round((x1 - x0) / 5));
        for (let j = 0; j < nv; j++) { const vx = x0 + 2.4 + j * (x1 - x0 - 4.8) / (nv - 1); vill += `<path data-villus="${i}-${j}" d="M${f(vx - 1.5)} 0.5 L${f(vx - 1.5)} -6.2 Q${f(vx)} -8.4 ${f(vx + 1.5)} -6.2 L${f(vx + 1.5)} 0.5"/>`; }
      }
      const nRx = kind === 'squamous' ? Math.min(cw * 0.28, 11) : kind === 'cuboidal' ? Math.min(cw * 0.22, h * 0.24) : Math.min(cw * 0.2, 8);
      const nRy = kind === 'squamous' ? Math.min(h * 0.24, 3.6) : kind === 'cuboidal' ? nRx : Math.min(h * 0.2, nRx * 1.45);
      const ny = kind === 'columnar' ? h * 0.66 : h / 2;
      nucs += `<ellipse cx="${f(mx)}" cy="${f(ny)}" rx="${f(nRx)}" ry="${f(nRy)}" fill="${fill('nucleus')}" stroke="${N.line}" stroke-width="${c.w('internal')}"/>` + (kind !== 'squamous' ? `<circle cx="${f(mx + nRx * 0.25)}" cy="${f(ny - nRy * 0.2)}" r="${f(nRx * 0.28)}" fill="${P.nucleolus.base}"${c.d('epithelium', D3)}/>` : '');
      for (let j = 0; j < apical; j++) slots.apical.push([x0 + (x1 - x0) * (j + 1) / (apical + 1), 0]);
      for (let j = 0; j < basal; j++) slots.basal.push([x0 + (x1 - x0) * (j + 1) / (basal + 1), h]);
      if (junctions && i < n - 1) {
        const jx = (i + 1) * cw;
        junc += `<g data-junction="${i}"><rect x="${f(jx - 2.6)}" y="0.6" width="5.2" height="${f(Math.min(9, h * 0.4))}" rx="2.2" fill="${P.protein.base}" stroke="${P.protein.line}" stroke-width="${c.w('internal')}"/><path${c.d('tight-junction')} d="M${f(jx - 2.6)} 3.4 H${f(jx + 2.6)} M${f(jx - 2.6)} 6 H${f(jx + 2.6)}" stroke="${P.protein.line}" stroke-width="${c.w('detail')}"/></g>`;
      }
    }
    // one light for the row, kept gentle so the far cell does not read as a different tissue
    const W = n * cw, grad = `<defs>${volumeGradient(gid, 'cytoplasm', [0, 0, W, h], { stops: [[0, C.hi], [0.55, C.base], [1, mix(C.base, C.lo, 0.45)]] })}</defs>`;
    const villSvg = vill ? `<g fill="${C.base}" stroke="${C.line}" stroke-width="${c.w('internal')}" stroke-linejoin="round">${vill}</g>` : '';
    const bm = basement ? `<g ${c.part('basement-membrane')}><rect x="0" y="${f(h + 0.8)}" width="${f(W)}" height="3.4" fill="${P.valve.base}" stroke="${P.valve.line}" stroke-width="${c.w('detail')}"/></g>` : '';
    const mid = W / 2, top = brush ? -9 : -1, bottom = h + (basement ? 5 : 1);
    Object.assign(at, { apical: [mid, 0], basal: [mid, h], lumen: [mid, top - 14], interstitium: [mid, bottom + 14], junction: [cw, 4], basement: [mid, h + 2.5] });
    return {
      svg: `<g ${c.part('epithelium')}>${grad}${villSvg}${cells}${nucs}</g>${junc ? `<g ${c.part('tight-junction')}>${junc}</g>` : ''}${bm}`,
      box: [0, top, W, bottom - top], at,
      outline: () => `M0 0 L${f(W)} 0 L${f(W)} ${f(h)} L0 ${f(h)} Z`,
      mapExtra: map => ({ slots: { apical: slots.apical.map(map), basal: slots.basal.map(map) } }),
    };
  });
}

/* ---------- enzyme ---------- */
// A globular body with an active-site cleft at its upper right (angle a, radians).
function enzymeBody(cx, cy, rx, ry, { cleft = true, a = -0.75, depth = 0.4, side = false } = {}) {
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const t = a + Math.PI / 9 + i * (2 * Math.PI - 2 * Math.PI / 9) / 17, k = 1 + 0.04 * Math.sin(i * 1.7);
    pts.push([cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)]);
  }
  if (cleft) {
    const bt = [cx + rx * depth * Math.cos(a), cy + ry * depth * Math.sin(a)];
    pts.push([cx + rx * 0.82 * Math.cos(a - 0.16), cy + ry * 0.82 * Math.sin(a - 0.16)]);
    if (side) pts.push([bt[0] + 1, bt[1] - 4]);
    pts.push(bt);
    pts.push([cx + rx * 0.82 * Math.cos(a + 0.16), cy + ry * 0.82 * Math.sin(a + 0.16)]);
  } else pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  return { d: closedD(pts), mouth: [cx + rx * 0.95 * Math.cos(a), cy + ry * 0.95 * Math.sin(a)], bottom: [cx + rx * (depth + 0.12) * Math.cos(a), cy + ry * (depth + 0.12) * Math.sin(a)], a };
}
/** enzyme({ shape: 'globular' | 'bilobed' | 'dimer', cleft = true, state: 'zymogen' | 'active' |
 *  'blocked', anchor: 'free' | 'membrane' | 'tethered', glow 0..1, sidePocket = false, plug: null |
 *  'reversible' | 'selective' | 'acetyl', mat = 'protein2' })
 *  An active-site cleft (never a pac-man), a propeptide over the cleft for a zymogen, a drug in the cleft
 *  when blocked (reversible plug, a selective plug reaching the side pocket, or aspirin's covalent acetyl
 *  flag), a single-pass stalk into the membrane (membrane) or a collagen tail (tethered, as AChE at the
 *  basal lamina). Anchor: centre. Native 56 x 50 (the dimer 92 x 50; anchors reach to at.foot).
 *  Parts: enzyme, propeptide, drug. at: site, mouth, foot (anchored forms), top. */
export function enzyme(opts = {}) {
  const { shape = 'globular', cleft = true, state = 'active', anchor = 'free', sidePocket = false, mat = 'protein2' } = opts;
  const glow = clamp(opts.glow ?? 0), plug = state === 'blocked' ? (opts.plug || 'reversible') : opts.plug || null;
  return make(opts, c => {
    const M_ = P[mat];
    const bodies = shape === 'dimer' ? [enzymeBody(-21, 0, 21, 19, { cleft, side: sidePocket, a: -2.39 }), enzymeBody(21, 0, 21, 19, { cleft, side: sidePocket })]
      : shape === 'bilobed' ? [enzymeBody(-2, -11, 17, 11, { cleft: false }), enzymeBody(0, 8, 25, 15, { cleft, a: -0.55, depth: 0.45, side: sidePocket })]
      : [enzymeBody(0, 0, 27, 23, { cleft, side: sidePocket })];
    let s = '';
    if (glow > 0) s += bodies.map(b => `<path d="${b.d}" fill="none" stroke="${P.ui.blueWash}" stroke-width="${f(12 * glow)}" stroke-linejoin="round"/>`).join('');
    // anchors first (behind the body)
    let foot = null;
    if (anchor === 'membrane') { foot = [0, 38]; s += `<rect x="-4.2" y="18" width="8.4" height="${f(foot[1] + MEMBRANE.thick / 2 + 2 - 18)}" rx="4.2" fill="${c.fill(mat)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/>`; }
    if (anchor === 'tethered') {
      foot = [0, 48];
      const strand = k => `M${f(k * 2)} 19 C${f(k * 2 + 4)} 27 ${f(k * 2 - 4)} 35 ${f(k * 2)} 41 S${f(k * 2 + 2)} 46 ${f(k * 2)} ${foot[1]}`;
      s += `<g data-tail="collagen">${[-1, 0, 1].map(k => `<path d="${strand(k)}" fill="none" stroke="${P.valve.line}" stroke-width="${c.w(1.25)}"/>`).join('')}</g>`;
    }
    s += bodies.map(b => bodyPath(c, b.d, mat)).join('');
    // the cleft shaded inside its mouth; the side pocket a darker branch
    if (cleft) s += bodies.filter((b, i) => !(shape === 'bilobed' && i === 0)).map(b => `<path data-cleft="1" d="M${pt(b.mouth)} L${pt(b.bottom)}" stroke="${M_.lo}" stroke-opacity=".8" stroke-width="${f(5.5 / c.s)}" stroke-linecap="round"/>` + (sidePocket ? `<circle data-pocket="1" cx="${f(b.bottom[0] + 1)}" cy="${f(b.bottom[1] - 3.5)}" r="2.4" fill="${M_.lo}" fill-opacity=".9"/>` : '')).join('');
    if (shape === 'bilobed') s += `<path${c.d('enzyme')} d="M-14 -2 Q-2 1 14 -3" fill="none" stroke="${M_.line}" stroke-width="${c.w('detail')}"/>`;
    s += bodies.map(b => spec(b.mouth[0] - (b.mouth[0] > 0 ? 26 : -8), b.mouth[1] - 2, 6, 3.5, -20)).join('');
    const main = bodies[bodies.length - 1], site = main.bottom, mouth = main.mouth, ang = main.a * 180 / Math.PI;
    let pro = '';
    if (state === 'zymogen') {
      const lx = mouth[0] + 3 * Math.cos(main.a), ly = mouth[1] + 3 * Math.sin(main.a);
      pro = `<g ${c.part('propeptide')}><path d="${capsule(lx - 7 * Math.sin(main.a), ly + 7 * Math.cos(main.a), lx + 7 * Math.sin(main.a), ly - 7 * Math.cos(main.a), 6)}" fill="${mix(M_.lo, M_.base, 0.3)}" stroke="${M_.line}" stroke-width="${c.w('internal')}"/></g>`;
    }
    let drug = '', drugAt = null;
    if (plug) {
      drugAt = [lerp(mouth[0], site[0], 0.45), lerp(mouth[1], site[1], 0.45)];
      const kind = plug === 'acetyl' ? 'acetyl' : plug === 'selective' ? 'selective' : 'plug';
      drug = `<g ${c.part('drug')} data-plug="${plug}">${drugGlyph(kind, drugAt[0], drugAt[1], c, { rot: kind === 'acetyl' ? ang - 90 + 180 : ang + 180 })}</g>`;
    }
    const half = shape === 'dimer' ? 46 : 29, bottom = foot ? foot[1] + (anchor === 'membrane' ? MEMBRANE.thick / 2 + 2 : 1) : 25;
    const at = { site, mouth, top: [0, shape === 'bilobed' ? -23 : -24] };
    if (foot) at.foot = foot;
    if (drugAt) at.drug = drugAt;
    return {
      svg: `<g ${c.part('enzyme')}>${s}</g>${pro}${drug}`, box: [-half, -26, 2 * half, bottom + 26], at,
      outline: () => bodies.map(b => b.d).join(' '),
    };
  });
}

/* ---------- nuclear receptor ---------- */
// Ligands drawn small. TODO(promote to molecules.js): steroid and thyronine, as molecules.steroid /
// molecules.thyronine (section 4.12) once that module exists.
const STEROIDS = { cortisol: 1, aldosterone: 1, cholesterol: 1, glucocorticoid: 1 };
function ligandGlyph(key, x, y, c) {
  if (STEROIDS[key]) {
    // rings A, B, C (six) and D (five), fused as in the steroid nucleus
    const drug = key === 'glucocorticoid', col = drug ? P.cortisol.base : P[key].base, line = drug ? P.drug.line : darker(col);
    const a = 3.1, hw = a * Math.sqrt(3) / 2, hex = (cx, cy) => polyD(Array.from({ length: 6 }, (_, i) => { const t = Math.PI / 6 + i * Math.PI / 3; return [cx + a * Math.cos(t), cy + a * Math.sin(t)]; }));
    const pent = (cx, cy) => polyD(Array.from({ length: 5 }, (_, i) => { const t = Math.PI + i * 2 * Math.PI / 5; return [cx + 2.75 * Math.cos(t), cy + 2.75 * Math.sin(t)]; }));
    const C0 = [x - 2 * hw - 0.6, y + 1.6], rings = [hex(...C0), hex(C0[0] + 2 * hw, C0[1]), hex(C0[0] + 3 * hw, C0[1] - 1.5 * a), pent(C0[0] + 3 * hw + hw + 2.4, C0[1] - 1.5 * a - 0.2)];
    return rings.map((d, i) => `<path data-ring="${'ABCD'[i]}" d="${d}" fill="${col}" fill-opacity="${drug ? 0.3 : 1}" stroke="${line}" stroke-width="${c.w('internal')}" stroke-linejoin="round"/>`).join('');
  }
  if (key === 'thyronine' || key === 'thyroxine') {
    // T3: inner ring iodines at 3 and 5, outer ring at 3'; T4 adds 5'
    const T = P.thyronine, a = 3.2, hex = (cx, cy) => polyD(Array.from({ length: 6 }, (_, i) => { const t = i * Math.PI / 3; return [cx + a * Math.cos(t), cy + a * Math.sin(t)]; }));
    const i1 = [x - 5.5, y], i2 = [x + 5.5, y], I = (ix, iy, n) => `<circle data-iodine="${n}" cx="${f(ix)}" cy="${f(iy)}" r="1.9" fill="${T.iodine}" stroke="${darker(T.iodine)}" stroke-width="${c.w('detail')}"/>`;
    return `<path d="${hex(...i1)}" fill="${T.base}" stroke="${darker(T.base)}" stroke-width="${c.w('internal')}"/><path d="${hex(...i2)}" fill="${T.base}" stroke="${darker(T.base)}" stroke-width="${c.w('internal')}"/>`
      + `<circle cx="${x}" cy="${y}" r="1.4" fill="${P.oxygen.base}"/>` + I(i1[0] + 1.6, y - 4.4, 3) + I(i1[0] + 1.6, y + 4.4, 5) + I(i2[0] - 1.6, y - 4.4, "3'") + (key === 'thyroxine' ? I(i2[0] - 1.6, y + 4.4, "5'") : '');
  }
  return glyph(key, x, y, c, { r: 4.6 });
}
/** nuclearReceptor({ where: 'cytoplasm' | 'nucleus', ligand: null | key ('cortisol', 'aldosterone',
 *  'glucocorticoid' (a drug: hollow, purple line), 'thyronine' (T3), 'thyroxine', or a messenger key),
 *  bound 0..1 (ligand docks into the ligand-binding domain), dna = true (in the nucleus, a short DNA helix
 *  under the DNA-binding domain), mat = 'protein' })
 *  An intracellular receptor: ligand-binding domain with its pocket, hinge, DNA-binding domain with two
 *  zinc fingers. The lesson moves it into the nucleus (x, y); where says which side it is on.
 *  Anchor: centre. Native 40 x 30 (ligand and DNA reach beyond). Parts: receptor, ligand (drug for
 *  glucocorticoid), dna. at: pocket, ligand, lbd, dbd, dna. */
export function nuclearReceptor(opts = {}) {
  const { where = 'cytoplasm', ligand = null, dna = true, mat = 'protein' } = opts;
  const bound = clamp(opts.bound ?? (ligand ? 1 : 0));
  return make(opts, c => {
    const M_ = P[mat], onDna = where === 'nucleus' && dna;
    const lbd = enzymeBody(7, -2, 13, 10.5, { cleft: true, a: -1.75, depth: 0.45 });
    const dbdD = closedD(ellipsePts(-11, 7, 7.5, 6, 12));
    const pocket = [f(lerp(lbd.mouth[0], lbd.bottom[0], 0.3)), f(lerp(lbd.mouth[1], lbd.bottom[1], 0.3))];
    let s = `<path d="M-6 3 Q-2 -1 -1 1" fill="none" stroke="${M_.line}" stroke-width="3.6" stroke-linecap="round"/><path d="M-6 3 Q-2 -1 -1 1" fill="none" stroke="${M_.base}" stroke-width="1.8" stroke-linecap="round"/>`;
    s += bodyPath(c, lbd.d, mat) + bodyPath(c, dbdD, mat, { tier: 'internal' });
    s += `<path data-cleft="1" d="M${pt(lbd.mouth)} L${pt(lbd.bottom)}" stroke="${M_.lo}" stroke-opacity=".8" stroke-width="${f(4.5 / c.s)}" stroke-linecap="round"/>`;
    // two zinc fingers on the DNA-binding domain
    s += `<path${c.d('receptor')} d="M-16 11.2 q1.6 4.6 3.2 0 M-10.6 12.4 q1.6 4.6 3.2 0" fill="${M_.base}" stroke="${M_.line}" stroke-width="${c.w('detail')}"/>`;
    const k = ease(bound), lp = [lerp(pocket[0] + 12, pocket[0], k), lerp(pocket[1] - 18, pocket[1], k)];
    const lig = ligand ? `<g ${c.part(ligand === 'glucocorticoid' ? 'drug' : 'ligand')}>${ligandGlyph(ligand, lp[0], lp[1], c)}</g>` : '';
    const dnaSvg = onDna ? `<g ${c.part('dna')} data-dna="1">${dnaHelix(-26, 10, 17, c)}</g>` : '';
    const top = ligand ? Math.min(-16, lp[1] - 8) : -16, bot = onDna ? 22 : 15, right = ligand ? Math.max(22, lp[0] + 13) : 22, left = onDna ? 27 : 20;
    return {
      svg: `${dnaSvg}<g ${c.part('receptor')}>${s}</g>${lig}`, box: [-left, top, left + right, bot - top],
      at: { pocket, ligand: lp, lbd: [7, -2], dbd: [-11, 7], dna: [-8, 17] },
      outline: () => `${lbd.d} ${dbdD}`,
    };
  });
}
