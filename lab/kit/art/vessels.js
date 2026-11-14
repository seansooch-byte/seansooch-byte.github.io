// The Lab's shared vessel primitives (art direction sections 2.2, 2.3, 2.6, 2.7, 4.0b and 4.2).
// Import unversioned: /lab/kit/art/vessels.js. Depends only on ./core.js.
//
// Expected behaviour (tested by tools/art-tests/vessels.test.mjs, looked at in tools/art-gallery/vessels.html):
//   - Wall material follows the vessel TYPE, lumen colour follows OXYGEN CONTENT. A pulmonary artery is
//     artery wall with venous blood; a pulmonary vein is vein wall with oxygenated blood (pass blood).
//   - Walls are true to type: an artery has three tunics with the media thickest; an arteriole has a wall
//     about as thick as its lumen radius (one to three smooth muscle layers); a vein has a thin wall whose
//     adventitia is its thickest tunic; a capillary and a lymphatic are one endothelial layer.
//   - The lumen is a model width (a geometry stroke, never compensated for scale). Given restLumen, the
//     wall keeps its cross-sectional area as the lumen changes, so a constricted arteriole thickens.
//   - Venous valves are drawn only in limb veins and lymphatics, never in arteries, the venae cavae,
//     portal, pulmonary or cerebral veins (C1.30); they default off.
//   - Motion is a pure function of phase in [0, 1): cells and streamlines loop seamlessly.
//   - Every emitted data-part is a leaf. Names are multi-name (for example "vessel artery wall"), so a
//     lesson's dfn can light the whole vessel or one layer; parts renames any of them.
//   - Common options { x, y, s, rot, flip, emphasis, parts, key }; every primitive but streamline returns
//     an Art whose box, at and outline() are in picture coordinates.
//   - No hex literal here: every colour is a P entry or mixed from P entries.
import { P, SW, D2, D3, f, pt, mix, uid, artOf, place, samplePath, pathLength, offsetPath, smooth, blob, artGhost, chevron, streamline as coreStreamline, partName, placer } from './core.js';

/* ---------- colours ----------
   Lymph and the elastic laminae are P.lymph and P.elastic (core.js). Smooth muscle in tone is a
   continuous shade, so it stays a function: the wall's base mixed toward P.smooth by tone. */
const mediaTone = (wallMat, tone) => mix(wallMat.base, P.smooth.base, 0.4 + 0.45 * Math.max(0, Math.min(1, tone)));

/* ---------- common helpers ---------- */
const clamp01 = v => Math.max(0, Math.min(1, v));
const frac = v => v - Math.floor(v);
const nameOf = partName; // core: renames, multi-names, each word once
const detail = (emphasis, names, cls = D2) => names.some(n => emphasis.includes(n)) ? '' : ` class="${cls}"`;
// The common placement (core placer): map, mapD and identity, the same numbers place() uses.
const mapper = (o = {}) => placer(o);
// Place an Art and keep its extras; outline() and paths come back in picture coordinates.
function finish(art, opts, extra = {}) {
  const M = mapper(opts);
  const placed = M.identity ? art : place(art, opts);
  const outline = state => M.mapD(art.outline(state));
  return artOf(placed.svg, placed.box, placed.at, outline, extra);
}
// Points with their tangent angle at arc fractions of a path; pos(u) for u in [0, 1].
function walker(d, n = 160) {
  const p = samplePath(d, n), L = pathLength(d);
  const pos = u => {
    const t = clamp01(u) * (n - 1), i = Math.min(n - 2, Math.floor(t)), k = t - i, a = p[i], b = p[i + 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, ang];
  };
  return { pos, L, pts: p };
}
const pathD = pts => `M${pts.map(pt).join(' L')}`;
// The side of a path that faces the picture's light (upper left): +1 or -1 for offsetPath.
function lightSide(d) {
  const [a, b] = samplePath(d, 2), tx = b[0] - a[0], ty = b[1] - a[1];
  return (-ty) + tx < 0 ? 1 : -1;
}
const stroke = (d, col, w, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="butt" stroke-linejoin="round"${extra}/>`;

/* ---------- blood ---------- */
// Oxygen content to colours: 'oxy' (1), 'deoxy' (0), or a 0..1 mix; 'lymph' for a lymphatic.
export function bloodColour(blood) {
  if (blood === 'lymph') return { k: null, ...P.lymph, rbcRim: P.rbc.rim, rbcCentre: P.rbc.base };
  const k = blood === 'oxy' ? 1 : blood === 'deoxy' ? 0 : clamp01(+blood);
  const pick = key => k === 1 ? P.oxy[key] : k === 0 ? P.deoxy[key] : mix(P.deoxy[key], P.oxy[key], k);
  return {
    k, hi: pick('hi'), base: pick('base'), lo: pick('lo'), line: pick('line'), cut: pick('cut'),
    rbcRim: k === 1 ? P.rbc.rim : k === 0 ? P.rbc.deoxyRim : mix(P.rbc.deoxyRim, P.rbc.rim, k),
    rbcCentre: k === 1 ? P.rbc.base : k === 0 ? P.rbc.deoxyCentre : mix(P.rbc.deoxyCentre, P.rbc.base, k),
  };
}
const kOf = b => b === 'oxy' ? 1 : b === 'deoxy' ? 0 : clamp01(+b);

/* ---------- geometry: walls by vessel type ----------
   Thickness t of the whole wall for a lumen diameter L, and each tunic's share of it. Proportions follow the
   textbook histology picture (Junqueira, Ross): artery media thickest; arteriole wall about its lumen radius;
   vein thin with adventitia thickest; capillary and lymphatic one endothelial cell. Minimums keep each wall
   legible at 375 px (a meaning-carrying stroke is at least 1.25 units). */
const KINDS = {
  artery: { mat: 'artery', t: L => Math.max(3, 0.3 * L), tunics: { intima: 0.12, media: 0.58, adventitia: 0.3 }, blood: 'oxy' },
  arteriole: { mat: 'artery', t: L => Math.max(2.5, 0.55 * L), tunics: { intima: 0.15, media: 0.65, adventitia: 0.2 }, blood: 'oxy' },
  vein: { mat: 'vein', t: L => Math.max(2, 0.1 * L), tunics: { intima: 0.2, media: 0.3, adventitia: 0.5 }, blood: 'deoxy', valves: true },
  portal: { mat: 'vein', t: L => Math.max(2, 0.1 * L), tunics: { intima: 0.2, media: 0.3, adventitia: 0.5 }, blood: 'deoxy' },
  venule: { mat: 'vein', t: L => Math.max(1.6, 0.08 * L), tunics: { intima: 0.55, media: 0.15, adventitia: 0.3 }, blood: 'deoxy' },
  capillary: { mat: 'capillary', t: () => 1.4, tunics: { intima: 1 }, blood: [1, 0] },
  lymphatic: { mat: 'intima', t: () => 1.3, tunics: { intima: 1 }, blood: 'lymph', valves: true },
};
const kindOf = k => KINDS[k] || KINDS.artery;
// Whole-wall thickness. With rest (the lumen at which the wall has its type's thickness), the wall keeps
// its cross-sectional area: (R + t)^2 - R^2 is constant, so it thickens as the lumen narrows.
function wall(kind, L, rest) {
  const K = kindOf(kind);
  if (rest == null || K.tunics.intima === 1) return K.t(L);
  const R0 = rest / 2, t0 = K.t(rest), A = (R0 + t0) ** 2 - R0 ** 2, R = L / 2;
  return Math.sqrt(R * R + A) - R;
}
function layers(kind, L, rest) {
  const t = wall(kind, L, rest), T = kindOf(kind).tunics;
  return { intima: t * (T.intima || 0), media: t * (T.media || 0), adventitia: t * (T.adventitia || 0), t };
}
export const vesselGeometry = { KINDS, wall, layers, outer: (kind, L, rest) => L + 2 * wall(kind, L, rest) };

/* ---------- red cells in a lumen ---------- */
// The lumen-scale cell: two ellipses, cheap enough for a capillary bed of dozens per frame. blood.js rbc is
// the cell-scale primitive (true biconcave views, shading, cutaway); use it where one cell is the subject.
// A biconcave disc, face on: rim colour with a paler centre, tilted variants for a tumbling stream.
// squash < 1 shows the disc turned toward edge-on; long > 1 elongates it (deformed in a capillary).
function rbcGlyph(x, y, ang, r, bc, { squash = 0.86, long = 1, s = 1, opacity = 1 } = {}) {
  const rx = r * long, ry = r * squash;
  return `<g data-rbc="" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"${opacity < 1 ? ` opacity="${f(opacity)}"` : ''}><ellipse rx="${f(rx)}" ry="${f(ry)}" fill="${bc.rbcRim}" stroke="${P.rbc.line}" stroke-width="${f(0.9 / s)}"/><ellipse cx="${f(-rx * 0.06)}" cy="${f(-ry * 0.08)}" rx="${f(rx * 0.5)}" ry="${f(ry * 0.44)}" fill="${bc.rbcCentre}"/></g>`;
}

/* ---------- vessel ---------- */
// The drawing parts of one vessel in native coordinates: { wall, lumen, cells, valves } markup strings,
// so capillaryBed can draw every wall before every lumen and join its vessels cleanly.
function vesselLayers(o) {
  const { d, kind = 'artery', s = 1, tone = 0, cutaway = true, gaps = 0, emphasis = [] } = o;
  const K = kindOf(kind), W_ = P[K.mat], L = o.lumen ?? (kind === 'capillary' ? 6 : kind === 'arteriole' ? 8 : 16);
  const ly = layers(kind, L, o.restLumen), t = ly.t, Wd = L + 2 * t, ol = SW.outline / s;
  const blood = o.blood ?? K.blood;
  const range = Array.isArray(blood) ? blood.map(kOf) : null;
  const bc = bloodColour(range ? range[0] : blood);
  const side = lightSide(d);
  const dash = gaps > 0 && ['capillary', 'venule', 'lymphatic', 'vein'].includes(kind) ? (() => { const g = 1.5 + 6.5 * clamp01(gaps); return ` stroke-dasharray="${f(22 - g)} ${f(g)}"`; })() : '';
  const texCls = detail(emphasis, ['wall', 'media', kind]);
  let wallSvg = '', lumenSvg = '';
  if (!cutaway) {
    // exterior: the wall seen from outside, the blood showing through as a tint
    const ext = mix(W_.base, bc.base, kind === 'lymphatic' ? 0.15 : 0.32);
    wallSvg += stroke(d, W_.line, Wd + 2 * ol, dash) + stroke(d, ext, Wd, dash);
    wallSvg += stroke(offsetPath(d, -side * Wd * 0.28, 48), mix(ext, W_.line, 0.35), Wd * 0.3, ` stroke-opacity=".45"`);
    wallSvg += stroke(offsetPath(d, side * (Wd / 2 - 2), 48), P.ui.white, Math.min(2.5, Wd * 0.18), ` stroke-opacity=".32" stroke-linecap="round"`);
  } else {
    // see-through tube: outline, adventitia, media, intima, then the lumen
    wallSvg += stroke(d, W_.line, Wd + 2 * ol, dash);
    if (ly.adventitia) wallSvg += stroke(d, K.mat === 'artery' ? P.adventitia.base : W_.base, Wd, dash);
    if (ly.media) {
      const mw = L + 2 * (ly.intima + ly.media);
      wallSvg += stroke(d, K.mat === 'artery' ? mediaTone(W_, tone) : mix(W_.base, W_.lo, 0.45), mw, dash);
      // circular smooth muscle seen side on: fine transverse bands across each media strip
      if (K.mat === 'artery' && ly.media >= 1.6) for (const sg of [1, -1]) {
        wallSvg += `<path d="${offsetPath(d, sg * (L / 2 + ly.intima + ly.media / 2), 64)}" fill="none" stroke="${P.smooth.lo}" stroke-opacity="${f(0.2 + 0.2 * clamp01(tone))}" stroke-width="${f(ly.media * 0.8)}" stroke-dasharray="${f(0.7 / s)} ${f(kind === 'arteriole' ? 1.9 : 2.3)}"${texCls}/>`;
      }
      if (K.mat === 'artery' && ly.media >= 1.6) wallSvg += [1, -1].map(sg => `<path d="${offsetPath(d, sg * (L / 2 + ly.intima), 64)}" fill="none" stroke="${P.elastic.base}" stroke-width="${f(0.9 / s)}"${texCls}/>`).join('');
    } else if (!ly.adventitia) {
      wallSvg += stroke(d, W_.base, Wd, dash);
    }
    wallSvg += stroke(d, P.intima.base, L + 2 * Math.max(ly.intima, 0.9), dash);
    // endothelial nuclei on single-layer walls (detail)
    if (ly.intima === t) {
      const w = walker(d), n = Math.max(2, Math.floor(w.L / 18));
      let nu = '';
      for (let i = 0; i < n; i++) {
        const [x, y, a] = w.pos((i + 0.5) / n), sg = i % 2 ? 1 : -1, off = sg * (L / 2 + t * 0.15), nx = -Math.sin(a) * off, ny = Math.cos(a) * off;
        nu += `<ellipse cx="${f(x + nx)}" cy="${f(y + ny)}" rx="${f(3.6)}" ry="${f(Math.max(1, t * 0.55))}" transform="rotate(${f(a * 180 / Math.PI)} ${f(x + nx)} ${f(y + ny)})" fill="${mix(P.nucleus.base, W_.base, 0.25)}"/>`;
      }
      wallSvg += `<g${detail(emphasis, ['wall', kind], D2)}>${nu}</g>`;
    }
    // the lumen: blood, or plasma with a cell field
    const cellField = !!o.cells && kind !== 'lymphatic';
    if (range && range[0] !== range[1]) {
      const w = walker(d, 97), N = 12;
      for (let i = 0; i < N; i++) {
        const seg = w.pts.slice(Math.floor(i * 96 / N), Math.min(97, Math.floor((i + 1) * 96 / N) + 2));
        const c = bloodColour(range[0] + (range[1] - range[0]) * (i + 0.5) / N);
        const col = i === 0 ? bloodColour(range[0]).base : i === N - 1 ? bloodColour(range[1]).base : c.base;
        lumenSvg += stroke(pathD(seg), cellField ? mix(col, P.plasma.base, 0.3) : col, L);
      }
    } else {
      lumenSvg += stroke(d, cellField ? mix(bc.base, P.plasma.base, 0.3) : bc.base, L);
    }
    if (L >= 7) {
      // roundness from stacked translucent strokes (never a gradient on a stroke): the far side falls off
      // toward lo, the near side lifts toward hi, then one soft highlight toward the light
      const lo = cellField ? 0.6 : 1;
      lumenSvg += stroke(offsetPath(d, -side * L * 0.36, 48), bc.lo, L * 0.28, ` stroke-opacity="${f(0.22 * lo)}"`);
      lumenSvg += stroke(offsetPath(d, -side * L * 0.42, 48), bc.lo, L * 0.16, ` stroke-opacity="${f(0.22 * lo)}"`);
      lumenSvg += stroke(offsetPath(d, side * L * 0.2, 48), bc.hi, L * 0.34, ` stroke-opacity="${f(0.2 * lo)}"`);
      lumenSvg += `<path d="${offsetPath(d, side * (L / 2 - Math.max(1.8, L * 0.16)), 48)}" fill="none" stroke="${P.ui.white}" stroke-opacity="${f(0.3 * lo)}" stroke-width="${f(Math.min(2.5, L * 0.14))}" stroke-linecap="round"/>`;
    }
    if (o.flow && L >= 7) {
      const ph = frac(o.flow.phase || 0);
      lumenSvg += coreStreamline(d, { phase: ph, opacity: o.flow.opacity ?? 1, w: Math.min(3, L * 0.22) });
    }
  }
  // cells: a stream of red cells, phase loops every 1
  let cells = '';
  if (o.cells && cutaway && kind !== 'lymphatic') {
    const n = o.cells.n ?? 6, ph = frac(o.cells.phase || 0), w = walker(d), cap = kind === 'capillary';
    const r = cap ? L * 0.46 : Math.min(6.5, L * 0.3), lane = Math.max(0, L / 2 - r * 0.95);
    for (let i = 0; i < n; i++) {
      const u = frac(i / n + ph), [x, y, a] = w.pos(u);
      const off = cap ? 0 : lane * [0.1, -0.55, 0.45, -0.15, 0.6, -0.4][i % 6], nx = -Math.sin(a) * off, ny = Math.cos(a) * off;
      const k = range ? range[0] + (range[1] - range[0]) * u : bc.k, c = bloodColour(k ?? 1);
      const fade = Math.min(1, u / 0.06, (1 - u) / 0.06);
      cells += rbcGlyph(x + nx, y + ny, a * 180 / Math.PI + (cap ? 0 : [0, 25, -20, 10, -30, 15][i % 6]), r, c, { squash: cap ? 0.62 : [0.86, 0.55, 0.8, 0.66, 0.9, 0.6][i % 6], long: cap ? 1.25 : 1, s, opacity: Math.max(0, fade) });
    }
  }
  // venous (and lymphatic) valves: paired cusps whose free edges point downstream (toward the heart)
  let valves = '', valveAt = null;
  const site = o.site;
  if (o.valves && cutaway && K.valves && !['caval', 'pulmonary', 'cerebral', 'portal'].includes(site)) {
    const v = o.valves === true ? {} : o.valves, n = v.n ?? 1, open = clamp01(v.open ?? 1), w = walker(d), h = L / 2;
    for (let i = 0; i < n; i++) {
      const [x, y, a] = w.pos(v.at ? v.at[i] : (i + 1) / (n + 1));
      if (!valveAt) valveAt = [x, y];
      const tx = L * (0.62 + 0.18 * open), ty = h * (0.05 + 0.5 * open), th = Math.max(3, L * 0.13);
      // each cusp in long section: hinged on the wall, bellied toward the centre, free edge downstream
      const yc = sg => -sg * (ty + (h - ty) * 0.42), yw = sg => -sg * (ty + (h - ty) * 0.62);
      const cusp = sg => `M0 ${f(-sg * h)} Q${f(tx * 0.12)} ${f(yc(sg))} ${f(tx)} ${f(-sg * ty)} Q${f(tx * 0.3 + th)} ${f(yw(sg))} ${f(th * 1.8)} ${f(-sg * h)} Z`;
      // blood pooled in the pockets when shut (backflow is what fills and shuts them)
      const pocket = sg => `M0 ${f(-sg * h)} Q${f(tx * 0.12)} ${f(yc(sg))} ${f(tx)} ${f(-sg * ty)} L${f(tx + 2)} ${f(-sg * h)} Z`;
      valves += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 180 / Math.PI)})">${open < 1 ? [1, -1].map(sg => `<path d="${pocket(sg)}" fill="${bc.lo}" fill-opacity="${f(0.45 * (1 - open))}"/>`).join('') : ''}${[1, -1].map(sg => `<path d="${cusp(sg)}" fill="${P.valve.base}" stroke="${P.valve.line}" stroke-width="${f(SW.internal / s)}" stroke-linejoin="round"/>`).join('')}</g>`;
    }
  }
  return { wallSvg, lumenSvg, cells, valves, L, t, Wd, valveAt, bc };
}

// vessel({ d, kind, lumen, restLumen, blood, cutaway, cells: { n, phase }, tone, valves: true | { n, open, at },
//          site, gaps, flow: { phase, opacity }, cut, x, y, s, rot, flip, emphasis, parts, key })
// Anchor: the path's own coordinates (x, y place its origin). kind: artery | arteriole | vein | venule |
// capillary | portal | lymphatic. lumen: the model's lumen diameter in native units. blood: 'oxy' | 'deoxy' |
// 0..1 | [from, to] (capillary default [1, 0]). cut: 'start' | 'end' | 'both' adds layered cut faces.
// Parts: "vessel <kind> wall", "vessel <kind> lumen", "vessel <kind> rbc", "vessel <kind> valves".
export function vessel(opts = {}) {
  const { d = 'M0 0 L200 0', kind = 'artery', s = 1, parts = {}, emphasis = [], cut } = opts;
  const v = vesselLayers({ ...opts, d, kind, s, emphasis });
  const nm = extra => nameOf(parts, ['vessel', kind, extra]);
  let svg = `<g data-part="${nm('wall')}">${v.wallSvg}</g>`;
  if (v.lumenSvg) svg += `<g data-part="${nm('lumen')}">${v.lumenSvg}</g>`;
  if (v.cells) svg += `<g data-part="${nm('rbc')}">${v.cells}</g>`;
  if (v.valves) svg += `<g data-part="${nm('valves')}">${v.valves}</g>`;
  if (cut) {
    // layered cut faces (a perpendicular cut: axis ratio 0.3), in the wall's part
    const w = walker(d), ends = cut === 'both' ? [0, 1] : [cut === 'start' ? 0 : 1], ly = layers(kind, v.L, opts.restLumen), K = kindOf(kind);
    let cf = '';
    for (const e of ends) {
      const [x, y, a] = w.pos(e), rot = a * 180 / Math.PI, R = v.Wd / 2, el = (r, col, extra = '') => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.3)}" ry="${f(r)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" fill="${col}"${extra}/>`;
      cf += el(R, K.mat === 'artery' && ly.adventitia ? P.adventitia.hi : P[K.mat].hi, ` stroke="${P[K.mat].line}" stroke-width="${f(1 / s)}"`);
      if (ly.media) cf += el(v.L / 2 + ly.intima + ly.media, K.mat === 'artery' ? P.artery.hi : P[K.mat].base);
      cf += el(v.L / 2 + Math.max(ly.intima, 0.6), P.intima.hi);
      cf += el(v.L / 2, kind === 'lymphatic' ? P.lymph.cut : bloodColour(Array.isArray(opts.blood ?? K.blood) ? (opts.blood ?? K.blood)[e] : opts.blood ?? K.blood).cut);
    }
    svg += `<g data-part="${nm('wall')}">${cf}</g>`;
  }
  const w = walker(d), mid = w.pos(0.5), side = lightSide(d), na = mid[2], off = side * (v.L / 2 + v.t / 2);
  const pts = samplePath(d, 32), pad = v.Wd / 2 + SW.outline / s;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map(f);
  const at = { start: pts[0], end: pts[pts.length - 1], mid: [mid[0], mid[1]], lumen: [mid[0], mid[1]], wall: [mid[0] - Math.sin(na) * off, mid[1] + Math.cos(na) * off] };
  if (v.valveAt) at.valve = v.valveAt;
  const outline = (state = {}) => {
    const L = state.lumen ?? v.L, half = L / 2 + wall(kind, L, opts.restLumen ?? (state.lumen != null && opts.restLumen == null ? undefined : opts.restLumen));
    return `${offsetPath(d, half, 48)} ${offsetPath(d, -half, 48)}`;
  };
  return finish(artOf(svg, box, at, outline), opts, { wallT: f(v.t), outerW: f(v.Wd), lumen: v.L });
}

/* ---------- vesselSection ---------- */
// vesselSection({ r, kind, restR, tone, blood, cells, x, y, s, emphasis, parts, key })
// A transverse cut: lumen radius r (model), tunics outside it. Anchor: the centre. Flat section shading
// (a cut face is flat; the lumen has an inner-edge shadow, no speculars). A vein's lumen is a slightly
// flattened oval of the same area. Parts: "vessel <kind> adventitia | media | intima | lumen" (+ "rbc").
export function vesselSection(opts = {}) {
  const { r = 20, kind = 'artery', tone = 0, s = 1, parts = {}, emphasis = [], key } = opts;
  const K = kindOf(kind), W_ = P[K.mat], L = 2 * r, ly = layers(kind, L, opts.restR != null ? 2 * opts.restR : undefined);
  const bc = bloodColour(opts.blood ?? (Array.isArray(K.blood) ? K.blood[0] : K.blood));
  const ov = K.mat === 'vein' ? [1.1, 0.9] : [1, 1];   // vein: rx, ry factors (area kept: 0.99)
  const ring = (rad, n = 72, wob = 0, freq = 0) => smooth(Array.from({ length: n }, (_, i) => {
    const a = i / n * 2 * Math.PI, q = rad + wob * Math.sin(freq * a);
    // the oval applies to the lumen and scales outward with it
    return [(q + (ov[0] - 1) * r) * Math.cos(a), (q + (ov[1] - 1) * r) * Math.sin(a)];
  }), { closed: true });
  const nm = layer => nameOf(parts, ['vessel', kind, layer]);
  const Rout = r + ly.t, Rmed = r + ly.intima + ly.media, Rint = r + Math.max(ly.intima, 0.9);
  const lineW = SW.outline / s, tex = layer => detail(emphasis, [layer, kind]);
  let svg = '';
  if (ly.adventitia) {
    // adventitia: loose connective tissue with wavy collagen (detail)
    let col = '';
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * 2 * Math.PI + 0.2 * (i % 3), rr = Rmed + ly.adventitia * (0.35 + 0.3 * (i % 3) / 2), a2 = a + 0.22;
      const p = t2 => [(rr + (ov[0] - 1) * r) * Math.cos(t2), (rr + (ov[1] - 1) * r) * Math.sin(t2)];
      const m = p((a + a2) / 2), c = [m[0] * (1 + 0.04 * (i % 2 ? 1 : -1)), m[1] * (1 + 0.04 * (i % 2 ? 1 : -1))];
      col += `M${pt(p(a))} Q${pt(c)} ${pt(p(a2))} `;
    }
    svg += `<g data-part="${nm('adventitia')}"><path d="${ring(Rout)}" fill="${K.mat === 'artery' ? P.adventitia.base : W_.base}" stroke="${W_.line}" stroke-width="${f(lineW)}"/>${ly.adventitia >= 1.8 ? `<path d="${col}" fill="none" stroke="${P.adventitia.lo}" stroke-width="${f(SW.detail / s)}" stroke-linecap="round"${tex('adventitia')}/>` : ''}</g>`;
  }
  if (ly.media) {
    // media: concentric smooth muscle, cigar-shaped nuclei running around the circumference (detail);
    // internal and external elastic laminae as wavy rings in arteries, crimped more as tone rises
    const fillCol = K.mat === 'artery' ? mediaTone(W_, tone) : mix(W_.base, W_.lo, 0.45);
    let nuc = '';
    const rows = Math.max(1, Math.min(4, Math.floor(ly.media / 3.2)));
    for (let j = 0; j < rows; j++) {
      const rr = r + ly.intima + ly.media * (j + 0.5) / rows, n = Math.max(6, Math.round(2 * Math.PI * rr / 14));
      for (let i = 0; i < n; i++) {
        const a = (i + (j % 2) * 0.5) / n * 2 * Math.PI, x = (rr + (ov[0] - 1) * r) * Math.cos(a), y = (rr + (ov[1] - 1) * r) * Math.sin(a);
        nuc += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(Math.min(3.6, rr * 0.2))}" ry="${f(Math.min(0.9, ly.media / rows * 0.3))}" transform="rotate(${f(a * 180 / Math.PI + 90)} ${f(x)} ${f(y)})"/>`;
      }
    }
    const solo = !ly.adventitia;
    svg += `<g data-part="${nm('media')}"><path d="${ring(Rmed)}" fill="${fillCol}"${solo ? ` stroke="${W_.line}" stroke-width="${f(lineW)}"` : ` stroke="${W_.line}" stroke-opacity=".5" stroke-width="${f(SW.internal / s)}"`}/>${ly.media >= 2 ? `<g fill="${P.nucleus.base}" fill-opacity="${f(0.55 + 0.25 * clamp01(tone))}"${tex('media')}>${nuc}</g>` : ''}${K.mat === 'artery' ? `<path d="${ring(Rint + 0.4, 96, 0.35 + 0.5 * clamp01(tone), 28)}" fill="none" stroke="${P.elastic.base}" stroke-width="${f(SW.internal / s)}"${tex('media')}/>${kind === 'artery' ? `<path d="${ring(Rmed, 96, 0.3, 22)}" fill="none" stroke="${P.elastic.base}" stroke-opacity=".7" stroke-width="${f(SW.detail / s)}"${tex('media')}/>` : ''}` : ''}</g>`;
  }
  // intima: the endothelium, one flat cell layer with nuclei bulging into the lumen
  {
    const solo = !ly.media && !ly.adventitia;
    const nN = Math.max(1, Math.min(6, Math.round(2 * Math.PI * r / 26)));
    let nu = '';
    for (let i = 0; i < nN; i++) {
      const a = (i + 0.3) / nN * 2 * Math.PI - Math.PI / 2, rr = r + 0.2, x = (rr + (ov[0] - 1) * r) * Math.cos(a), y = (rr + (ov[1] - 1) * r) * Math.sin(a);
      nu += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(Math.min(4, Math.max(2.2, r * 0.45)))}" ry="${f(Math.max(1.2, Math.min(1.8, r * 0.18)))}" transform="rotate(${f(a * 180 / Math.PI + 90)} ${f(x)} ${f(y)})"/>`;
    }
    const iw = solo ? Math.max(ly.intima, 1.3) : Math.max(ly.intima, 0.9);
    svg += `<g data-part="${nm('intima')}"><path d="${ring(r + iw)}" fill="${solo ? W_.base : P.intima.base}" stroke="${solo ? W_.line : P.intima.line}" stroke-width="${f((solo ? SW.outline : SW.detail) / s)}"/><g fill="${P.nucleus.base}"${solo ? '' : tex('intima')}>${nu}</g></g>`;
  }
  // lumen: flat blood with its inner-edge shadow (a section: no specular)
  const id = uid('vsec', key);
  const lumD = ring(r);
  let lum = `<path d="${lumD}" fill="${bc.base}"/><clipPath id="${id}"><path d="${lumD}"/></clipPath><path d="${lumD}" fill="none" stroke="${bc.lo}" stroke-opacity=".45" stroke-width="5" clip-path="url(#${id})"/>`;
  svg += `<g data-part="${nm('lumen')}">${lum}</g>`;
  if (opts.cells) {
    const n = kind === 'capillary' ? 1 : Math.max(1, Math.min(5, Math.round(r * r / 90)));
    let c = '';
    const rc = kind === 'capillary' ? r * 0.8 : Math.min(7, r * 0.42);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, q = n === 1 ? 0 : (r - rc) * 0.55;
      c += rbcGlyph(q * Math.cos(a), q * Math.sin(a), i * 47, rc, bc, { squash: [0.86, 0.6, 0.8, 0.7, 0.9][i % 5], s });
    }
    svg += `<g data-part="${nm('rbc')}">${c}</g>`;
  }
  const R = Rout * Math.max(...ov);
  const ang = d0 => [Math.cos(d0 * Math.PI / 180), Math.sin(d0 * Math.PI / 180)];
  const atR = (rr, deg) => { const [c, sn] = ang(deg); return [(rr + (ov[0] - 1) * r) * c, (rr + (ov[1] - 1) * r) * sn]; };
  const at = {
    centre: [0, 0], lumen: [0, 0],
    intima: atR(r + Math.max(ly.intima, 0.9) / 2, -60),
    media: atR(r + ly.intima + ly.media / 2, -20),
    adventitia: atR(Rmed + ly.adventitia / 2, 25),
    wall: atR(r + ly.t / 2, -20),
  };
  const outline = (state = {}) => {
    const rr = state.r ?? r, ll = layers(kind, 2 * rr, opts.restR != null ? 2 * opts.restR : state.r != null ? undefined : undefined);
    return smooth(Array.from({ length: 48 }, (_, i) => { const a = i / 48 * 2 * Math.PI; return [(rr + ll.t + (ov[0] - 1) * rr) * Math.cos(a), (rr + ll.t + (ov[1] - 1) * rr) * Math.sin(a)]; }), { closed: true });
  };
  return finish(artOf(svg, [-R, -R, 2 * R, 2 * R].map(f), at, outline), opts, { wallT: f(ly.t), outerR: f(R) });
}

/* ---------- capillaryBed ---------- */
// capillaryBed({ w, h, from, to, cells: { n, phase }, tissue: 'polygon' | 'muscle' | 'none', n, flow: { phase },
//                lumens: { arteriole, capillary, venule }, seed, x, y, s, emphasis, parts, key })
// Anchor: top-left of its w x h box. A terminal arteriole down the left feeds n capillaries that cross the
// tissue and join a venule up the right; blood colour runs from `from` to `to` across the bed (systemic:
// oxy to deoxy; a lung capillary: deoxy to oxy). Capillaries in muscle run between and along the fibres.
// Parts: arteriole, capillary, venule, tissue. Returns also paths (capillary centrelines, picture coords).
export function capillaryBed(opts = {}) {
  const { w = 260, h = 150, from = 'oxy', to = 'deoxy', tissue = 'polygon', s = 1, parts = {}, emphasis = [], key, seed = 3 } = opts;
  const n = opts.n ?? (tissue === 'muscle' ? 3 : 4);
  const lum = { arteriole: 8, capillary: 5, venule: 11, ...(opts.lumens || {}) };
  const kA = kOf(from), kV = kOf(to);
  const nm = p => nameOf(parts, [p]);
  const xa = w * 0.15, xv = w * 0.85;
  // the arteriole enters at the upper left and runs down; the venule rises on the right and leaves at the
  // upper right (both cut by the box edge, so they read as continuing)
  const aD = smooth([[-4, h * 0.14], [xa * 0.6, h * 0.15], [xa, h * 0.3], [xa + 2, h * 0.6], [xa + 4, h * 0.92]]);
  const vD = smooth([[xv - 4, h * 0.92], [xv - 2, h * 0.6], [xv, h * 0.32], [xv + (w - xv) * 0.45, h * 0.17], [w + 4, h * 0.15]]);
  const aW = walker(aD), vW = walker(vD);
  let rs = seed >>> 0;
  const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const caps = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, a = aW.pos(0.3 + 0.62 * u), b = vW.pos(0.62 - 0.55 * u);
    const y0 = a[1], y1 = b[1];
    const pts = [[a[0], y0]];
    const steps = 4;
    for (let k = 1; k < steps; k++) {
      const t = k / steps, wob = tissue === 'muscle' ? 2 : h * 0.035;
      pts.push([a[0] + (b[0] - a[0]) * t, y0 + (y1 - y0) * t + (rnd() * 2 - 1) * wob]);
    }
    pts.push([b[0], y1]);
    caps.push(smooth(pts));
  }
  // anastomoses: short links between neighbouring capillaries
  const links = [];
  if (tissue !== 'muscle') for (let i = 0; i + 1 < n; i += 2) {
    const p = walker(caps[i]).pos(0.42 + 0.1 * i / n), q = walker(caps[i + 1]).pos(0.55 + 0.1 * i / n);
    links.push(smooth([[p[0], p[1]], [(p[0] + q[0]) / 2 + 6, (p[1] + q[1]) / 2], [q[0], q[1]]]));
  }
  const capRange = d => { const pp = samplePath(d, 2); const k0 = clamp01((pp[0][0] - xa) / (xv - xa)), k1 = clamp01((pp[1][0] - xa) / (xv - xa)); return [kA + (kV - kA) * k0, kA + (kV - kA) * k1]; };
  const capLayers = [...caps, ...links].map(d => vesselLayers({ d, kind: 'capillary', lumen: lum.capillary, blood: capRange(d), s, emphasis, cells: opts.cells ? { n: opts.cells.n ?? 3, phase: opts.cells.phase } : false }));
  const aL = vesselLayers({ d: aD, kind: 'arteriole', lumen: lum.arteriole, blood: kA, s, emphasis, flow: opts.flow, cells: opts.cells ? { n: 3, phase: opts.cells.phase } : false });
  const vL = vesselLayers({ d: vD, kind: 'venule', lumen: lum.venule, blood: kV, s, emphasis, flow: opts.flow, cells: opts.cells ? { n: 4, phase: opts.cells.phase } : false });
  // tissue
  let tis = '';
  const tid = uid('cbed', key);
  if (tissue !== 'none') {
    const frame = `M6 0 L${f(w - 6)} 0 Q${f(w)} 0 ${f(w)} 6 L${f(w)} ${f(h - 6)} Q${f(w)} ${f(h)} ${f(w - 6)} ${f(h)} L6 ${f(h)} Q0 ${f(h)} 0 ${f(h - 6)} L0 6 Q0 0 6 0 Z`;
    let body = `<path d="${frame}" fill="${P.space.ecf}"/>`;
    if (tissue === 'muscle') {
      // skeletal muscle fibres running with the capillaries, striated (detail), nuclei at the periphery
      const capY = caps.map(d => samplePath(d, 2).reduce((s0, p) => s0 + p[1], 0) / 2);
      const edges = [-8, ...capY.map(y => y), h + 8];
      let fib = '', str = '', nuc = '';
      for (let i = 0; i + 1 < edges.length; i++) {
        const y0 = edges[i] + lum.capillary / 2 + 3.2, y1 = edges[i + 1] - lum.capillary / 2 - 3.2;
        if (y1 - y0 < 6) continue;
        fib += `<rect x="-4" y="${f(y0)}" width="${f(w + 8)}" height="${f(y1 - y0)}" rx="${f(Math.min(8, (y1 - y0) / 2))}" fill="${P.skeletal.base}" stroke="${P.skeletal.line}" stroke-width="${f(SW.internal / s)}"/>`;
        fib += `<rect x="-4" y="${f(y0 + 1.2)}" width="${f(w + 8)}" height="${f((y1 - y0) * 0.3)}" rx="${f(Math.min(6, (y1 - y0) / 4))}" fill="${P.skeletal.hi}" fill-opacity=".45"/>`;
        // cross striations: a dashed band across the fibre (A and I bands, detail)
        str += `<path d="M0 ${f((y0 + y1) / 2)} L${f(w)} ${f((y0 + y1) / 2)}" stroke-width="${f(y1 - y0 - 3)}"/>`;
        for (let k = 0; k < 2; k++) { const nx = w * (0.3 + 0.38 * k) + 9 * i, ny = k ? y1 - 1.8 : y0 + 1.8; nuc += `<ellipse cx="${f(nx)}" cy="${f(ny)}" rx="5" ry="1.4"/>`; }
      }
      body += fib + `<g fill="none" stroke="${P.skeletal.lo}" stroke-opacity=".38" stroke-dasharray="0.9 3.2"${detail(emphasis, ['tissue'])}>${str}</g><g fill="${P.nucleus.base}"${detail(emphasis, ['tissue'])}>${nuc}</g>`;
    } else {
      // polygonal tissue cells (parenchyma): a jittered hex lattice whose cells share edges (each corner is
      // the centroid of the three cells meeting there), inset to leave thin interstitial clefts
      const cw = 30, rh = 26, rows = Math.ceil(h / rh) + 3, cols = Math.ceil(w / cw) + 3;
      const C = Array.from({ length: rows }, (_, r0) => Array.from({ length: cols }, (_, c0) => [(c0 - 1) * cw + (r0 % 2) * cw / 2 + (rnd() - 0.5) * 7, (r0 - 1) * rh + (rnd() - 0.5) * 6]));
      const nb = (r0, c0) => { const o = r0 % 2; return [[r0, c0 + 1], [r0 + 1, c0 + o], [r0 + 1, c0 - 1 + o], [r0, c0 - 1], [r0 - 1, c0 - 1 + o], [r0 - 1, c0 + o]]; };
      let cl = '', nu = '';
      for (let r0 = 1; r0 < rows - 1; r0++) for (let c0 = 1; c0 < cols - 1; c0++) {
        const me = C[r0][c0], ns = nb(r0, c0).map(([a, b]) => C[a][b]);
        const poly = ns.map((q, k) => { const q2 = ns[(k + 1) % 6], cx = (me[0] + q[0] + q2[0]) / 3, cy = (me[1] + q[1] + q2[1]) / 3, dx = cx - me[0], dy = cy - me[1], dd = Math.hypot(dx, dy) || 1, k2 = (dd - 1.4) / dd; return [me[0] + dx * k2, me[1] + dy * k2]; });
        cl += `M${poly.map(pt).join(' L')} Z `;
        nu += `<ellipse cx="${f(me[0] + (rnd() - 0.5) * 3)}" cy="${f(me[1] + (rnd() - 0.5) * 3)}" rx="4" ry="3.3"/>`;
      }
      body += `<path d="${cl}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-opacity=".5" stroke-width="${f(SW.detail / s)}" stroke-linejoin="round"/><g fill="${mix(P.nucleus.base, P.cytoplasm.base, 0.2)}" stroke="${P.nucleus.line}" stroke-opacity=".35" stroke-width="${f(0.6 / s)}"${detail(emphasis, ['tissue'])}>${nu}</g>`;
    }
    tis = `<g data-part="${nm('tissue')}"><clipPath id="${tid}"><path d="${frame}"/></clipPath><g clip-path="url(#${tid})">${body}</g><path d="${frame}" fill="none" stroke="${tissue === 'muscle' ? P.skeletal.line : P.cytoplasm.line}" stroke-opacity=".6" stroke-width="${f(SW.internal / s)}"/></g>`;
  }
  // order: all capillary walls, arteriole and venule walls, then every lumen, so channels join cleanly
  const vid = uid('cbedv', key);
  const clipFrame = `M-1 -1 L${f(w + 1)} -1 L${f(w + 1)} ${f(h + 1)} L-1 ${f(h + 1)} Z`;
  let svg = tis + `<clipPath id="${vid}"><path d="${clipFrame}"/></clipPath><g clip-path="url(#${vid})">`;
  svg += `<g data-part="${nm('capillary')}">${capLayers.map(c => c.wallSvg).join('')}</g>`;
  svg += `<g data-part="${nm('arteriole')}">${aL.wallSvg}</g><g data-part="${nm('venule')}">${vL.wallSvg}</g>`;
  svg += `<g data-part="${nm('capillary')}">${capLayers.map(c => c.lumenSvg).join('')}${capLayers.map(c => c.cells).join('')}</g>`;
  svg += `<g data-part="${nm('arteriole')}">${aL.lumenSvg}${aL.cells}</g><g data-part="${nm('venule')}">${vL.lumenSvg}${vL.cells}</g></g>`;
  const mc = walker(caps[Math.floor(n / 2)]).pos(0.5);
  const at = {
    in: aW.pos(0.02).slice(0, 2), out: vW.pos(0.98).slice(0, 2),
    arteriole: aW.pos(0.12).slice(0, 2), venule: vW.pos(0.86).slice(0, 2), capillary: [mc[0], mc[1]],
    tissue: (() => { const c0 = walker(caps[0]).pos(0.3), c1 = walker(caps[Math.min(1, n - 1)]).pos(0.3); return [c0[0], (c0[1] + c1[1]) / 2]; })(),
  };
  const outline = () => [aD, vD, ...caps].join(' ');
  const M = mapper(opts);
  return finish(artOf(svg, [0, 0, w, h], at, outline), opts, { paths: caps.map(M.mapD), arteriole: M.mapD(aD), venule: M.mapD(vD) });
}

/* ---------- streamline ---------- */
// streamline({ d, phase, opacity, w = 3, head = true, x, y, s }): translucent white dashes along a path
// (inside a lumen or a chamber), a small chevron head. phase loops seamlessly every 1. No parts (string).
export function streamline(opts = {}) {
  const { d, phase = 0, opacity = 1, w = 3, head = true, x = 0, y = 0, s = 1 } = opts;
  const svg = coreStreamline(d, { phase: frac(phase), opacity, w, head });
  return x || y || s !== 1 ? `<g transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${f(s)})` : ''}">${svg}</g>` : svg;
}

/* ---------- flowArrow ---------- */
// flowArrow({ d, w, ghostW, col = 'blue', head: { l, w }, phase, part, attrs, x, y, s, rot, flip, parts })
// A model-width flow band (water reabsorbed, drug absorbed, hormone secreted): the shaft is exactly w wide,
// the head a fixed size (it never balloons with the model), so a halved flow reads as half as thick.
// ghostW draws the normal band as the art ghost (panel underlay, muted dash) above the live one; when the
// widths nearly match, the ghost stands 2 units off so its strokes never coincide. col: a kit accent name
// ('blue', 'red', 'purple', ...) or a P material name (its base). w = 0 draws no live arrow (no head that
// would claim a flow). The live group carries data-arrow and data-w (lesson hooks) and the caller's part.
export function flowArrow(opts = {}) {
  const { d = 'M0 0 L100 0', w = 6, ghostW, col = 'blue', phase, part, attrs = '', s = 1, parts = {} } = opts;
  const hl = (opts.head?.l ?? 14) / s, hwFix = (opts.head?.w ?? 20) / s;
  const colour = P.ui[col] || (P[col] && P[col].base) || col;
  const edge = mix(colour, P.ui.ink, 0.4);
  const W = walker(d, 96), L = W.L;
  const bandD = (bw) => {
    const hw = Math.max(hwFix, bw + 6 / s), cut = Math.max(0, 1 - hl / L), shaft = [];
    for (let i = 0; i <= 40; i++) shaft.push(W.pos(cut * i / 40));
    const side = sg => shaft.map(([x, y, a]) => [x - Math.sin(a) * sg * bw / 2, y + Math.cos(a) * sg * bw / 2]);
    const [bx, by, ba] = W.pos(cut), [tx, ty] = W.pos(1), nx = -Math.sin(ba), ny = Math.cos(ba);
    const left = side(1), right = side(-1).reverse();
    return `M${left.map(pt).join(' L')} L${pt([bx + nx * hw / 2, by + ny * hw / 2])} L${pt([tx, ty])} L${pt([bx - nx * hw / 2, by - ny * hw / 2])} L${right.map(pt).join(' L')} Z`;
  };
  let svg = '';
  const pa = part ? ` data-part="${nameOf(parts, [part])}"` : '';
  if (w > 0.25) {
    let live = `<path d="${bandD(w)}" fill="${colour}" stroke="${edge}" stroke-width="${f(SW.internal / s)}" stroke-linejoin="round"/>`;
    if (phase != null && w >= 5) {
      const cut = Math.max(0, 1 - hl / L), sh = [];
      for (let i = 0; i <= 40; i++) sh.push(W.pos(cut * i / 40));
      live += `<path d="${pathD(sh)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".45" stroke-width="${f(Math.min(2.5, w * 0.3))}" stroke-linecap="round" stroke-dasharray="6 10" stroke-dashoffset="${f(-16 * frac(phase))}"/>`;
    }
    svg += `<g data-arrow="" data-w="${f(w)}"${pa}${attrs ? ' ' + attrs : ''}>${live}</g>`;
  }
  if (ghostW != null) {
    const gw = Math.abs(ghostW - w) < 2.5 ? Math.max(ghostW, w) + 4 / s : ghostW;
    svg += artGhost(bandD(gw), { s });
  }
  const tip = W.pos(1), tail = W.pos(0), mid = W.pos(0.5);
  const big = Math.max(hwFix, (Math.max(w, ghostW || 0)) + 6 / s) / 2 + 2;
  const xs = W.pts.map(p => p[0]), ys = W.pts.map(p => p[1]);
  const box = [Math.min(...xs) - big, Math.min(...ys) - big, Math.max(...xs) - Math.min(...xs) + 2 * big, Math.max(...ys) - Math.min(...ys) + 2 * big].map(f);
  const art = artOf(svg, box, { tip: tip.slice(0, 2), tail: tail.slice(0, 2), mid: mid.slice(0, 2) }, (state = {}) => bandD(state.w ?? w));
  return finish(art, opts, { shaftW: w, headL: f(hl * s), headW: f(Math.max(hwFix, w + 6 / s) * s) });
}

// chevron is re-exported for lessons that mark flow direction on a drawn vessel without a streamline.
export { chevron };
