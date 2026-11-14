// The Lab's lungs and alveoli (art direction section 4.4). Plain ES module; import it unversioned as
// /lab/kit/art/lung.js. Shared because three or more lessons draw each primitive (section 4.0a):
//
//   alveolus(opts)          an alveolar sac in section: a gently lobed sac whose interalveolar septa jut
//                           into a common air space, a thin wall band carrying flat type I nuclei and one
//                           cuboidal type II cell, an optional alveolar duct, and exudate that rises from
//                           the bottom with a meniscus. Users: ventilation-perfusion (all sac steps),
//                           oxygen-hemoglobin-dissociation (3), acid-base (5), renin-angiotensin-aldosterone (4).
//   alveolarCapillary(opts) the pulmonary capillary hugging that sac for about 270 degrees: its inner wall
//                           lies on the alveolar wall (the contact line is the blood-air barrier), the lumen is
//                           the model's width and runs deoxygenated to oxygenated along the flow (or carries
//                           red cells in plasma), a faint outer mesh, an arteriole in and a venule out, and O2
//                           and CO2 crossing the barrier. Users: ventilation-perfusion, oxygen-hemoglobin-
//                           dissociation (3), acid-base (5).
//   lungsFrontal(opts)      both lungs from the front: trachea with C rings, carina, right main bronchus
//                           shorter, wider and steeper; right lung three lobes (horizontal and oblique fissures),
//                           left lung two lobes (oblique fissure) with the cardiac notch and lingula; lobar and
//                           two more generations of bronchi clipped inside the lungs; the diaphragm under both,
//                           the right dome higher. Users: ventilation-perfusion (1), oxygen-hemoglobin-
//                           dissociation (1), acid-base (7, badges).
//   o2Glyph, co2Glyph       the gas molecules (section 2.5 shapes and atom colours).
//
// Expected behaviour (tested by tools/art-tests/lung.test.mjs, looked at in tools/art-gallery/lung.html):
//   - Every primitive takes the common options { x, y, s, rot, flip, emphasis, parts, key } and returns an
//     Art { svg, box, at, outline(state), geom } in picture coordinates. Parts are leaves, renamable through
//     parts; detail carries ax-d2 / ax-d3 unless its part is in emphasis.
//   - The alveolus is a section, so it is flat (no specular): the air is the caller's gas colour with a thin
//     inner shadow, the wall is flat alveolar-wall tissue with its own line. Its anchor is the sac centre.
//   - The capillary is a pure function of w, from, to, cells.phase and exchange.phase; phase loops in [0, 1).
//     Its anchor is the alveolus it wraps (the same placement).
//   - The lungs are exteriors, lit from the picture's upper left with one user-space gradient per lung.
//     Their anchor is the top centre of the trachea; breathe 0..1 enlarges them (the trachea stays).
//   - Accuracy: pulmonary arteriole is artery wall with deoxygenated blood, venule is vein wall with
//     oxygenated blood; the arteriole arrives beside the airway (the bronchovascular bundle); red cells are
//     never blue; O2 moves air to blood and CO2 blood to air; nothing is labelled here (lessons label with
//     placeLabels and the at points, using only their captions' words).
import { P, SW, D2, D3, f, pt, mix, uid, artOf, smooth, samplePath, offsetPath, volumeGradient, spec, streamline, behind, pointInPolygon, placer, partName, arrowFixed } from './core.js';
import { o2, co2 } from './molecules.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const dir = a => [Math.cos(a), Math.sin(a)];
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
const polyD = (pts, closed = false) => `M${pts.map(pt).join(' L')}${closed ? ' Z' : ''}`;
const bbox = (pts, pad = 0) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map(f); };
const nameOf = partName; // core: renames, multi-names, each word once
const group = (parts, n, body, cls = '') => body ? `<g data-part="${nameOf(parts, n)}"${cls ? ` class="${cls}"` : ''}>${body}</g>` : '';
const pathS = (d, col, w, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}"${extra}/>`;

/* ---------- gas glyphs (section 2.5) ---------- */
// The gas molecules are molecules.js o2 and co2 (one drawing course-wide); these keep lung.js's call shape:
// (x, y, angle in degrees, size k, picture scale s). At k 1 the O2 is about 11 units long, the CO2 about 16.
// s is the picture's scale, kept for the call shape: molecules.js keeps its own outlines in range.
const GAS_K = 0.72;
/** o2Glyph(x, y, angle = 0, k = 1, s = 1): two oxygen spheres, about 11 units long at k 1. */
export function o2Glyph(x, y, ang = 0, k = 1, s = 1) { return o2({ x, y, rot: ang, s: GAS_K * k, part: false }).svg; }
/** co2Glyph(x, y, angle = 0, k = 1, s = 1): oxygen, carbon, oxygen in a line, about 16 units long at k 1. */
export function co2Glyph(x, y, ang = 0, k = 1, s = 1) { return co2({ x, y, rot: ang, s: GAS_K * k, part: false }).svg; }
// A fixed-head arrow without markers: core arrowFixed.
const arrowD = (a, b, col, s, w = 2.5) => arrowFixed(a, b, { col, s, w });

/* ---------- alveolus ---------- */
/**
 * alveolusGeometry({ r = 56, mouth = -90, duct = false, fluid = 0, cells = true, lobes }): the sac in its own
 * frame (centre 0 0). r is the mid-wall radius; mouth the angle (degrees, SVG) where the duct joins.
 * Returns { r, wallW, n, rho(a), outerAt(a), outerPts, innerPts, lumenPts, bandD, lumenD, outerD, innerD,
 * septa, type1, type2, duct, fluidLevel, fluidD, ductEdges(lumenW), mouthPt }.
 */
export function alveolusGeometry({ r = 56, mouth = -90, duct = false, fluid = 0, cells = true, lobes } = {}) {
  const wallW = clamp(r * 0.075, 3, 6.5), n = lobes ?? (r >= 40 ? 6 : 5), A = r >= 26 ? 0.034 : 0.026, m = rad(mouth);
  // gently scalloped: each alveolus bulges between shallow creases (where the septa meet the outer wall),
  // every 360 / n degrees, one of them at the mouth
  const rho = a => 1 + A * (Math.sqrt(Math.abs(Math.sin(n * (a - m) / 2))) - 0.75);
  const outerAt = a => r * rho(a) + wallW / 2;
  const septL = r >= 26 ? r * 0.2 : 0, sd = 1.35 * wallW / r;
  const D = duct === false || duct == null ? null : typeof duct === 'number' ? { len: duct } : { ...duct };
  const creases = Array.from({ length: n }, (_, k) => m + k * 2 * Math.PI / n).filter((_, k) => k || !D);
  const spike = a => {
    let best = 0;
    for (const c of creases) { let d = Math.abs(((a - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (d < sd) best = Math.max(best, Math.pow(1 - (d / sd) * (d / sd), 0.55)); }
    return best;
  };
  const innerAt = a => r * rho(a) - wallW / 2 - septL * spike(a);
  let ductW = 0, lumW = 0, g = 0;
  if (D) {
    ductW = D.w ?? clamp(0.42 * r, 10, 44); lumW = D.lumen ?? ductW - 2 * wallW; D.len = D.len ?? r * 0.5;
    g = Math.asin(clamp((ductW / 2 - wallW) / (r * rho(m)), 0, 0.9));
  }
  // angles: a 5 degree base step, refined across each septum
  const a0 = m + g, a1 = m + 2 * Math.PI - g, set = new Set();
  const nBase = Math.ceil((a1 - a0) / rad(5));
  const nearCrease = a => septL && creases.some(c => Math.abs(((a - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < sd * 1.15);
  for (let i = 0; i <= nBase; i++) { const a = a0 + (a1 - a0) * i / nBase; if (i === 0 || i === nBase || !nearCrease(a)) set.add(+a.toFixed(5)); }
  if (septL) for (const c0 of creases) for (let j = -7; j <= 7; j++) { const a = c0 + sd * Math.sin(j / 7 * Math.PI / 2) * 1.02 + (c0 < a0 ? 2 * Math.PI : 0); if (a > a0 && a < a1) set.add(+a.toFixed(5)); }
  let angles = [...set].sort((p, q) => p - q);
  if (!D) angles = angles.slice(0, -1);
  const outerPts = angles.map(a => add([0, 0], dir(a), outerAt(a))), innerPts = angles.map(a => add([0, 0], dir(a), innerAt(a)));
  const sm = (q, closed) => smooth(q, { closed }), outerD = sm(outerPts, !D), innerD = sm(innerPts, !D);
  const lumenPts = D ? [...innerPts, outerPts[outerPts.length - 1], outerPts[0]] : innerPts;
  const lumenD = D ? `${innerD} L${pt(outerPts[outerPts.length - 1])} L${pt(outerPts[0])} Z` : innerD;
  const bandD = D ? `${outerD} ${sm([...innerPts].reverse(), false).replace(/^M/, 'L')} Z` : `${outerD} ${innerD}`;
  const septa = septL ? creases.map(c => ({ angle: deg(c), tip: add([0, 0], dir(c), innerAt(c)) })) : [];
  // cells: flat type I nuclei on most lobes, one cuboidal type II cell on the lower lobe opposite the mouth's left
  const lobeAt = k => m + (k + 0.5) * 2 * Math.PI / n;
  const want = m + rad(230);
  let k2 = 0;
  for (let k = 0; k < n; k++) if (Math.abs(Math.cos(lobeAt(k) - want) - 1) < Math.abs(Math.cos(lobeAt(k2) - want) - 1)) k2 = k;
  const nT1 = !cells ? 0 : r >= 40 ? 4 : r >= 26 ? 2 : 0;
  const order = Array.from({ length: n }, (_, k) => (k2 + 2 + k) % n).filter(k => k !== k2);
  const type1 = order.slice(0, nT1).map((k, i) => {
    const a = lobeAt(k) + (i % 2 ? 1 : -1) * 0.18 * Math.PI / n, rx = clamp(0.1 * r, 5.5, 9), ry = clamp(0.3 * wallW + 1, 2, 3.2);
    return { angle: deg(a), rx, ry, c: add([0, 0], dir(a), r * rho(a) - wallW / 2 + 0.2) };
  });
  let type2 = null;
  if (cells && r >= 26) {
    const a = lobeAt(k2), w = clamp(0.3 * r, 13, 28), h = clamp(0.17 * r, 8, 15);
    type2 = { angle: deg(a), w, h, base: add([0, 0], dir(a), r * rho(a) - wallW / 2), inward: dir(a + Math.PI), tangent: dir(a + Math.PI / 2) };
  }
  // fluid: level from the bottom of the air space; the surface is a meniscus that climbs the walls
  const ys = innerPts.map(p => p[1]), top = Math.min(...ys), bottom = Math.max(...ys);
  const fluidLevel = bottom - (bottom - top) * clamp(fluid, 0, 1), mh = clamp(0.06 * r, 2, 6), X = r * 1.4;
  const fluidD = fluid >= 0.995 ? `M${-X} ${-X} H${X} V${X} H${-X} Z` : `M${f(-X)} ${f(fluidLevel - mh)} Q0 ${f(fluidLevel + mh)} ${f(X)} ${f(fluidLevel - mh)} L${f(X)} ${f(X)} L${f(-X)} ${f(X)} Z`;
  const surfaceD = `M${f(-X)} ${f(fluidLevel - mh)} Q0 ${f(fluidLevel + mh)} ${f(X)} ${f(fluidLevel - mh)}`;
  const mouthPt = add([0, 0], dir(m), r * rho(m));
  const ductInfo = D ? { len: D.len, w: ductW, lumen: lumW, from: add(mouthPt, dir(m), -wallW * 0.9), to: add(mouthPt, dir(m), D.len), d: `M${pt(add(mouthPt, dir(m), -wallW * 0.9))} L${pt(add(mouthPt, dir(m), D.len))}` } : null;
  const ductEdges = lw => {
    if (!ductInfo) return '';
    const nrm = dir(m + Math.PI / 2), e = k => `M${pt(add(ductInfo.from, nrm, k * lw / 2))} L${pt(add(ductInfo.to, nrm, k * lw / 2))}`;
    return `${e(1)} ${e(-1)}`;
  };
  return { r, wallW, n, rho, outerAt, innerAt, mouth, outerPts, innerPts, lumenPts, bandD, lumenD, outerD, innerD, septa, type1, type2, duct: ductInfo, fluid, fluidLevel, fluidD, surfaceD, ductEdges, mouthPt };
}

/**
 * alveolus({ x, y, s, rot, flip, r = 56, gas = P.space.air, fluid = 0, fluidCells = 0, mouth = -90,
 *   duct = false | len | { len, w, lumen }, cells = true, hooks: { lumen, fluid }, emphasis, parts, key })
 * Anchor: the sac centre. Native box about 2.2 r square (plus the duct). gas is the air's colour (a lesson
 * passes its model colour); duct.lumen is the airway's model width (the outer wall stays when it narrows).
 * Parts: alveoli (the air space), wall (band and septa), wall type1, wall type2, fluid, airway.
 */
export function alveolus(opts = {}) {
  const { r = 56, gas = P.space.air, fluid = 0, fluidCells = 0, mouth = -90, duct = false, cells = true, hooks = {}, emphasis = [], parts = {}, key } = opts;
  const pl = placer(opts), s = pl.s, G = alveolusGeometry({ r, mouth, duct, fluid, cells });
  const em = n => emphasis.includes(n), d2 = n => em(n) ? '' : D2;
  const W = P.alveolarWall, k = key != null ? key : undefined;
  const shadowId = uid('alvsh', k != null ? `${k}` : undefined), clipId = uid('alvcl', k != null ? `${k}` : undefined);
  // the air space: flat gas colour and a thin inner shadow (a section, never a specular)
  let air = `<path d="${G.lumenD}" fill="${gas}"${hooks.lumen ? ` ${hooks.lumen}` : ''}/>`;
  air += `<clipPath id="${shadowId}"><path d="${G.lumenD}"/></clipPath><path d="${G.innerD}" fill="none" stroke="${P.lung.lo}" stroke-opacity=".38" stroke-width="${f(5 / s)}" clip-path="url(#${shadowId})"/>`;
  // exudate: protein-rich fluid with a meniscus, white cells floating in it, clipped to the air space
  let fl = '';
  if (fluid > 0.005) {
    fl += `<clipPath id="${clipId}"><path d="${G.lumenD}"/></clipPath><g clip-path="url(#${clipId})"><path d="${G.fluidD}" fill="${P.fibrin.base}"${hooks.fluid ? ` ${hooks.fluid}` : ''}/>`;
    fl += `<path d="${G.fluidD}" fill="${P.fibrin.line}" fill-opacity=".08"/>`;
    if (fluid < 0.995) fl += pathS(G.surfaceD, P.fibrin.line, SW.internal / s);
    const cr = clamp(0.075 * r, 5, 8), poly = G.innerPts, taken = [];
    let placed = 0;
    for (let i = 0; i < 64 && placed < fluidCells; i++) {
      const ga = i * 2.39996323, rr = Math.sqrt((i + 0.5) / 64) * r * 0.78, c = [rr * Math.cos(ga), rr * Math.sin(ga)];
      if (c[1] < G.fluidLevel + cr + 3 || !pointInPolygon(c, poly) || Math.min(...poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))) < cr + 2 || taken.some(q => Math.hypot(q[0] - c[0], q[1] - c[1]) < cr * 3.2)) continue;
      taken.push(c);
      const lobesN = [[-0.48, -0.06], [0.02, -0.38], [0.46, 0.08], [0.04, 0.42]];
      fl += `<g data-cell="wbc"><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(cr)}" fill="${P.neutrophil.base}" stroke="${P.neutrophil.line}" stroke-width="${f(SW.internal / s)}"/>` +
        pathS(`M${lobesN.map(([u, v]) => pt([c[0] + u * cr, c[1] + v * cr])).join(' L')}`, P.nucleus.base, 1.4 / s, ' stroke-linejoin="round"') + lobesN.map(([u, v]) => `<circle cx="${f(c[0] + u * cr)}" cy="${f(c[1] + v * cr)}" r="${f(cr * 0.22)}" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${f(0.6 / s)}"/>`).join('') + '</g>';
      placed++;
    }
    fl += '</g>';
  }
  // the wall: flat alveolar wall tissue; the outer edge is the silhouette, the air-side edge a finer line
  const wallSvg = `<path d="${G.bandD}" fill="${W.base}" fill-rule="evenodd"/>` + pathS(G.outerD, W.line, SW.outline / s, ' stroke-linejoin="round"') +
    pathS(G.innerD, W.line, SW.internal / s, ' stroke-opacity=".75" stroke-linejoin="round"');
  const t1 = G.type1.map(nu => `<ellipse cx="${f(nu.c[0])}" cy="${f(nu.c[1])}" rx="${f(nu.rx)}" ry="${f(nu.ry)}" transform="rotate(${f(nu.angle + 90)} ${f(nu.c[0])} ${f(nu.c[1])})" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${f(0.9 / s)}"/>`).join('');
  let t2 = '';
  if (G.type2) {
    const T = G.type2, p = (u, v) => add(add(T.base, T.tangent, u), T.inward, v), w = T.w / 2, h = T.h;
    t2 = `<path d="M${pt(p(-w, -1))} C${pt(p(-w, h * 0.8))} ${pt(p(-w * 0.6, h))} ${pt(p(0, h))} C${pt(p(w * 0.6, h))} ${pt(p(w, h * 0.8))} ${pt(p(w, -1))} Z" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="${f(SW.internal / s)}" stroke-linejoin="round"/>`;
    const nc = p(0, h * 0.42);
    t2 += `<circle cx="${f(nc[0])}" cy="${f(nc[1])}" r="${f(Math.min(h * 0.3, w * 0.34))}" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${f(0.9 / s)}"/>`;
    // lamellar bodies (surfactant stores): detail only
    t2 += `<g class="${d2('type2')}">${[[-0.62, 0.42], [0.62, 0.38], [0.5, 0.78]].map(([u, v]) => { const q = p(u * w, v * h); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(Math.max(1.3, h * 0.14))}" fill="${P.lipidHead.hi}" stroke="${P.lipidHead.line}" stroke-width="${f(0.7 / s)}"/>`; }).join('')}</g>`;
  }
  // the alveolar duct (respiratory bronchiole end): same wall, its lumen the model's width
  let airway = '';
  if (G.duct) {
    const D = G.duct, ol = 2 * SW.outline / s;
    airway = pathS(D.d, W.line, D.w, ' stroke-linecap="butt"') + pathS(D.d, W.base, D.w - ol, ' stroke-linecap="butt"') +
      `<path d="M${pt(add(D.from, dir(rad(mouth)), -G.wallW * 0.3))} L${pt(D.to)}" fill="none" stroke="${gas}" stroke-width="${f(D.lumen)}" stroke-linecap="butt"/>`;
  }
  const svg = group(parts, 'alveoli', air) + group(parts, 'fluid', fl) + group(parts, 'wall', wallSvg) +
    group(parts, 'wall type1', t1) + group(parts, 'wall type2', t2) + group(parts, 'airway', airway);
  const nat = [...G.outerPts, ...(G.duct ? [add(G.duct.to, dir(rad(mouth + 90)), G.duct.w / 2), add(G.duct.to, dir(rad(mouth - 90)), G.duct.w / 2)] : [])];
  const box = bbox(nat.map(pl.map), 0.5);
  const wallA = rad(mouth - 50);
  const at = {
    centre: pl.map([0, 0]), lumen: pl.map([0, -r * 0.1]), wall: pl.map(add([0, 0], dir(wallA), r * G.rho(wallA))),
    mouth: pl.map(G.duct ? G.duct.to : G.mouthPt), duct: pl.map(G.duct ? add(G.mouthPt, dir(rad(mouth)), G.duct.len * 0.6) : G.mouthPt),
    type1: pl.map(G.type1[0] ? G.type1[0].c : add([0, 0], dir(wallA), r)), type2: pl.map(G.type2 ? add(G.type2.base, G.type2.inward, G.type2.h * 0.5) : [0, 0]),
    septum: pl.map(G.septa[0] ? G.septa[0].tip : [0, 0]), bottom: pl.map([0, G.outerAt(rad(90))]),
  };
  if (fluid > 0.005) at.fluid = pl.map([0, Math.min(G.fluidLevel + r * 0.35, (G.fluidLevel + G.innerAt(rad(90))) / 2)]);
  // outline({ r }): the sac's outer surface at that radius; outline({ duct: lumenW }): the duct's two lumen edges.
  const outline = (state = {}) => {
    if (state.duct != null) { if (!G.duct) return ''; const nrm = dir(rad(mouth + 90)), e = k => `M${pt(pl.map(add(G.duct.from, nrm, k * state.duct / 2)))} L${pt(pl.map(add(G.duct.to, nrm, k * state.duct / 2)))}`; return `${e(1)} ${e(-1)}`; }
    const g = state.r != null && state.r !== r ? alveolusGeometry({ r: state.r, mouth, duct, cells: false }) : G; return polyD(g.outerPts.map(pl.map), !g.duct);
  };
  return artOf(pl.wrap(svg), box, at, outline, { geom: { ...G, place: { x: pl.x, y: pl.y, s, rot: pl.rot, flip: pl.flip }, gas } });
}

/* ---------- the capillary on the sac ---------- */
/**
 * alveolarCapillary({ around, w = 10, from = 0, to = 1, equil = 0.45, span = 270, cells = false | { n, phase },
 *   exchange = false | { phase, sites = 3, o2 = true, co2 = true, arrows = true, cols }, feeders = true | { len },
 *   net = true, flow = false | { phase }, emphasis, parts, key, x, y, s, rot, flip })
 * around: an alveolus() Art (its placement is reused) or { x, y, r, s, mouth }. w: lumen width (model).
 * from / to: oxygenation 0..1 (0 venous, 1 arterial) arriving and leaving; the blood reaches `to` by equil
 * of the way (equilibration early in transit). Parts: capillary (net, channel, cells), arteriole, venule,
 * exchange. Returns Art plus along(s) -> { x, y, angle, sat } and geom.
 */
export function alveolarCapillary(opts = {}) {
  const { around = {}, w = 10, from = 0, to = 1, equil = 0.45, span = 270, cells = false, exchange = false, feeders = true, net = true, flow = false, emphasis = [], parts = {} } = opts;
  const A = around.geom || alveolusGeometry({ r: around.r ?? 56, mouth: around.mouth ?? -90 });
  const plOpts = around.geom ? { ...A.place } : { x: around.x, y: around.y, s: around.s };
  for (const k of ['x', 'y', 's', 'rot', 'flip']) if (opts[k] != null) plOpts[k] = opts[k];
  const pl = placer(plOpts), s = pl.s, r = A.r, m = rad(A.mouth), em = n => emphasis.includes(n), d2 = n => em(n) ? '' : D2;
  const wallT = clamp(0.02 * r + 1, 1.6, 2.6), lw = Math.max(0, w), collapsed = lw < 1;
  const sat = u => from + (to - from) * (1 - Math.pow(1 - clamp(u / equil, 0, 1), 2));
  const bloodAt = u => mix(P.deoxy.base, P.oxy.base, clamp(sat(u), 0, 1));
  // the arc runs from the upper left shoulder, down, under and up the right side (span degrees, centred
  // opposite the mouth); a(u) decreases, so the flow is anticlockwise on screen
  const aStart = m + Math.PI + rad(span) / 2, aOf = u => aStart - u * rad(span);
  const N = 72, us = Array.from({ length: N + 1 }, (_, i) => i / N);
  const ring = (u, off) => { const a = aOf(u); return add([0, 0], dir(a), A.outerAt(a) + off); };
  const cR = wallT + lw / 2, centreN = us.map(u => ring(u, cR)), centreD = polyD(centreN);
  const tangent = u => { const a = aOf(u); return [Math.sin(a), -Math.cos(a)]; };
  const ol = 1.25 / s * 2, Wt = (collapsed ? 0.8 : lw) + 2 * wallT;
  const C = P.capillary;
  // the network goes on into the interalveolar septa: each septum carries a capillary, seen cut across (detail)
  let mesh = '';
  if (net && A.septa && A.septa.length) {
    const rr = clamp(A.wallW * 0.5, 1.5, 3.2), col = collapsed ? C.base : bloodAt(0.5);
    mesh = `<g class="${d2('capillary')}">${A.septa.map(sp => {
      const c = rad(sp.angle), tipR = Math.hypot(sp.tip[0], sp.tip[1]), L = r * A.rho(c) - A.wallW / 2 - tipR, q = add([0, 0], dir(c), tipR + 0.45 * L);
      return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(rr + 1.1)}" fill="${C.base}" stroke="${C.line}" stroke-width="${f(0.8 / s)}"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(rr)}" fill="${col}"/>`;
    }).join('')}</g>`;
  }
  // the channel: outline, endothelial wall, lumen (blood, or plasma when red cells are drawn)
  let ch = pathS(centreD, C.line, Wt + ol, ' stroke-linejoin="round"') + pathS(centreD, C.base, Wt, ' stroke-linejoin="round"');
  const K = 24, lumenColours = [];
  const nCells = cells && cells.n && lw >= 4 ? cells.n : 0;
  if (!collapsed) {
    if (cells && cells.n) ch += pathS(centreD, P.plasma.base, lw, ' stroke-linejoin="round"');
    else for (let i = 0; i < K; i++) {
      const ua = i / K, ub = Math.min(1, (i + 1) / K + 0.006), col = bloodAt(i / (K - 1));
      lumenColours.push(col);
      ch += pathS(polyD([ring(ua, cR), ...us.filter(u => u > ua && u < ub).map(u => ring(u, cR)), ring(ub, cR)]), col, lw, ' stroke-linejoin="round"');
    }
    if (flow && lw > 6 && !nCells) ch += streamline(centreD, { phase: flow.phase || 0, opacity: 0.7, w: 2 });
  }
  // endothelial nuclei on the outer wall (detail)
  ch += `<g class="${d2('capillary')}">${[0.3, 0.58, 0.83].map(u => { const a = aOf(u), c = ring(u, wallT * 2 + lw - wallT * 0.3); return `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="4.2" ry="1.7" transform="rotate(${f(deg(a) + 90)} ${f(c[0])} ${f(c[1])})" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${f(0.7 / s)}"/>`; }).join('')}</g>`;
  // feeders: the arteriole arrives beside the airway (bronchovascular bundle), the venule leaves on the other side
  let art1 = '', art2 = '', ven1 = '', ven2 = '', dIn = '', dOut = '';
  const S = centreN[0], E = centreN[N], tS = tangent(0), tE = tangent(1);
  const Lf = feeders ? (feeders.len ?? r * 0.75) : 0;
  let F0 = S, F1 = E;
  if (feeders) {
    const outS = dir(aOf(0)), outE = dir(aOf(1));
    F0 = add(add(S, tS, -Lf * 0.25), outS, Lf); F1 = add(add(E, tE, Lf * 0.25), outE, Lf);
    dIn = `M${pt(F0)} C${pt(add(F0, outS, -Lf * 0.4))} ${pt(add(S, tS, -Lf * 0.35))} ${pt(add(S, tS, 1))}`;
    dOut = `M${pt(add(E, tE, -1))} C${pt(add(E, tE, Lf * 0.35))} ${pt(add(F1, outE, -Lf * 0.4))} ${pt(F1)}`;
    const la = collapsed ? 0 : clamp(lw * 1.3 + 2, 4, 32), wa = la + 2 * 2.2, wv = la + 2 * 1.8;
    const capEnd = ' stroke-linecap="butt" stroke-linejoin="round"';
    art1 = pathS(dIn, P.artery.line, wa + ol + 0.5, capEnd) + pathS(dIn, P.artery.base, wa, capEnd);
    ven1 = pathS(dOut, P.vein.line, wv + ol, capEnd) + pathS(dOut, P.vein.base, wv, capEnd);
    if (la) {
      art2 = pathS(dIn, nCells ? P.plasma.base : bloodAt(0), la, capEnd) + `<path d="${offsetPath(dIn, la / 2 - 2.2, 16)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".28" stroke-width="2" class="${D2}"/>`;
      ven2 = pathS(dOut, nCells ? P.plasma.base : bloodAt(1), la, capEnd) + `<path d="${offsetPath(dOut, la / 2 - 2.2, 16)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".28" stroke-width="2" class="${D2}"/>`;
    }
  }
  // red cells in single file along the whole route (arteriole, capillary, venule), squeezed by the
  // capillary lumen, warming as they load oxygen; phase moves every cell one full route per unit
  const cellList = [];
  let cellSvg = '';
  if (nCells) {
    const ry = Math.min(0.42 * lw, 5.5), rx = Math.max(5.6, 30 / ry);
    const pre = dIn ? samplePath(dIn, 14).slice(0, -1) : [], post = dOut ? samplePath(dOut, 14).slice(1) : [];
    const route = [...pre, ...centreN, ...post], Lc = [0];
    for (let i = 1; i < route.length; i++) Lc.push(Lc[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const total = Lc[Lc.length - 1], arc0 = Lc[pre.length], arc1 = Lc[pre.length + N];
    const at_ = d => { let j = 1; while (j < Lc.length - 1 && Lc[j] < d) j++; const t = (d - Lc[j - 1]) / (Lc[j] - Lc[j - 1] || 1), q0 = route[j - 1], q1 = route[j]; return [[lerp(q0[0], q1[0], t), lerp(q0[1], q1[1], t)], [q1[0] - q0[0], q1[1] - q0[1]]]; };
    for (let i = 0; i < nCells; i++) {
      const u = (((i / nCells + (cells.phase || 0)) % 1) + 1) % 1, dd = u * total, [c, tg] = at_(dd);
      const k = clamp(sat(clamp((dd - arc0) / (arc1 - arc0), 0, 1)), 0, 1);
      const op = clamp(Math.min(u, 1 - u) / 0.04, 0, 1), ang = deg(Math.atan2(tg[1], tg[0]));
      cellList.push({ s: u, sat: k, rx, ry, op, x: c[0], y: c[1], angle: ang });
      const tf = `transform="rotate(${f(ang)} ${f(c[0])} ${f(c[1])})"`;
      cellSvg += `<g opacity="${f(op)}"><ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" ${tf} fill="${mix(P.rbc.deoxyRim, P.rbc.rim, k)}" stroke="${P.rbc.line}" stroke-width="${f(0.8 / s)}"/><ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.42)}" ${tf} fill="${mix(P.rbc.deoxyCentre, P.rbc.base, k)}"/></g>`;
    }
  }
  // gas exchange: O2 from the air across the barrier into the blood, CO2 the other way
  let ex = '';
  const molecules = [];
  if (exchange) {
    const { phase = 0, sites = 3, o2 = true, co2 = true, arrows = true } = exchange;
    const cols = { o2: P.ui.blue, co2: P.ui.ink, ...(exchange.cols || {}) };
    const L1 = clamp(0.22 * r, 10, 20), de = clamp(11 / r, 0.09, 0.26);
    let arrowsSvg = '', glyphs = '';
    for (let i = 0; i < sites; i++) {
      const ua = (i + 0.5) / sites, a = aOf(0.08 + 0.84 * ua);
      for (const [kind, on, sgn] of [['o2', o2, -1], ['co2', co2, 1]]) {
        if (!on) continue;
        const b = a + sgn * de, pIn = add([0, 0], dir(b), A.innerAt(b) - L1), pOut = add([0, 0], dir(b), A.outerAt(b) + cR);
        const [p0, p1] = kind === 'o2' ? [pIn, pOut] : [pOut, pIn];
        if (arrows) {
          // the arrow crosses the barrier and stays mostly over the air, where it reads; the molecule runs the whole way
          const edge = add([0, 0], dir(b), A.outerAt(b) + wallT + 2.5), wallIn = add([0, 0], dir(b), A.innerAt(b) - 1);
          const [q0, q1] = kind === 'o2' ? [pIn, edge] : [add([0, 0], dir(b), A.outerAt(b) + wallT), add(wallIn, dir(b), -L1 * 0.8)];
          arrowsSvg += pathS(`M${pt(q0)} L${pt(q1)}`, P.space.air, 5.5 / s, ' stroke-linecap="round" stroke-opacity=".75"') + arrowD(q0, q1, cols[kind], s, 2.4);
        }
        const u = (((phase + i * 0.37 + (kind === 'co2' ? 0.5 : 0)) % 1) + 1) % 1, p = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)];
        const op = clamp(Math.min(u / 0.15, (1 - u) / 0.15), 0, 1), ang = deg(b) + 90;
        molecules.push({ kind, u, op, ...Object.fromEntries([['x', pl.map(p)[0]], ['y', pl.map(p)[1]]]) });
        glyphs += `<g opacity="${f(op)}">${kind === 'o2' ? o2Glyph(p[0], p[1], ang, 1, s) : co2Glyph(p[0], p[1], ang, 0.9, s)}</g>`;
      }
    }
    ex = `<g opacity=".9">${arrowsSvg}</g>${glyphs}`;
  }
  const svg = group(parts, 'arteriole', art1) + group(parts, 'venule', ven1) + group(parts, 'capillary', mesh + ch) +
    group(parts, 'arteriole', art2) + group(parts, 'venule', ven2) + group(parts, 'capillary', cellSvg) + group(parts, 'exchange', ex);
  const allPts = [...centreN.map(p => add(p, dir(Math.atan2(p[1], p[0])), lw / 2 + wallT + (net ? lw + 12 : 0))), F0, F1, add(F0, [-20, 0]), add(F1, [20, 0])];
  const box = bbox(allPts.map(pl.map), 2);
  const mid = 0.5, aMid = aOf(mid);
  const at = {
    capillary: pl.map(ring(mid, wallT + lw * 0.85)), contact: pl.map(add([0, 0], dir(aMid), A.outerAt(aMid))),
    start: pl.map(S), end: pl.map(E), in: pl.map(F0), out: pl.map(F1),
    arteriole: pl.map(add(F0, [0, 1], Lf * 0.15)), venule: pl.map(add(F1, [0, 1], Lf * 0.15)),
  };
  const edges = ww => { const e1 = us.map(u => ring(u, wallT)), e2 = us.map(u => ring(u, wallT + ww)); return `${polyD(e1.map(pl.map))} ${polyD(e2.map(pl.map))}`; };
  const outline = (state = {}) => edges(state.w ?? lw);
  const along = u => { const c = ring(clamp(u, 0, 1), cR), tg = tangent(clamp(u, 0, 1)), p = pl.map(c); return { x: p[0], y: p[1], angle: pl.angle(deg(Math.atan2(tg[1], tg[0]))), sat: clamp(u, 0, 1) === 0 ? from : sat(clamp(u, 0, 1)) }; };
  const geom = { centre: centreN.map(pl.map), wallT, span, lumenColours, cells: cellList.map(c => { const p = pl.map([c.x, c.y]); return { ...c, x: p[0], y: p[1] }; }), molecules, ends: { in: [...pl.map(S), pl.angle(deg(Math.atan2(tS[1], tS[0])))], out: [...pl.map(E), pl.angle(deg(Math.atan2(tE[1], tE[0])))] } };
  return artOf(pl.wrap(svg), box, at, outline, { along, geom });
}

/* ---------- the lungs from the front ---------- */
// Native frame: origin at the top centre of the trachea; viewer's left is the patient's right.
const RIGHT = [[-62, 14], [-84, 20], [-106, 40], [-124, 72], [-137, 110], [-145, 150], [-148, 190], [-145, 218], [-139, 231],
  [-118, 222], [-90, 208], [-60, 204], [-38, 210], [-24, 218], [-18, 200], [-16, 170], [-18, 140], [-20, 110], [-24, 80], [-30, 50], [-42, 24]];
const LEFT = [[62, 14], [46, 24], [36, 48], [28, 80], [24, 112], [24, 138], [30, 155], [40, 168], [45, 183], [42, 199], [34, 213], [30, 228], [38, 241],
  [60, 240], [90, 226], [120, 234], [139, 247], [146, 222], [148, 182], [144, 140], [134, 100], [118, 64], [98, 34], [80, 19]];
const FISS = {
  rh: [[-150, 138], [-100, 136], [-50, 134], [-12, 134]],
  ro: [[-150, 136], [-118, 160], [-88, 184], [-60, 206], [-38, 224]],
  lo: [[152, 102], [126, 138], [100, 174], [76, 210], [52, 246]],
};
// lobar bronchi: [from, to, width]; each lobe's ends grow two more generations
const LOBAR = {
  rul: [[-14, 100], [-48, 82], 7.2], bi: [[-20, 108], [-30, 138], 9], rml: [[-30, 138], [-58, 160], 6], rll: [[-30, 138], [-58, 196], 7],
  lul: [[36, 110], [58, 96], 7.5], lulUp: [[58, 96], [72, 62], 6], ling: [[58, 96], [54, 158], 5.4], lll: [[40, 112], [82, 156], 7],
};
const TIPS = ['rul', 'rml', 'rll', 'lulUp', 'ling', 'lll'];

/**
 * lungsFrontal({ x, y, s, rot, flip, breathe = 0, lobes = [], tree = true, under = '', emphasis, parts, key })
 * Native box 300 x 260, anchor the top centre of the trachea. breathe 0..1 enlarges the lungs (about 6 %
 * wider and 8 % longer below the hila) and lowers the diaphragm. lobes highlights any of rul rml rll lul lll
 * with the blue wash. under: markup in picture coordinates, drawn on the diaphragm and behind the lungs (a heart
 * from heart.js placed at at.heart; the lungs'
 * medial borders overlap it, the cardiac notch shows it). Parts: lungs right-lung, lungs left-lung, airways
 * trachea, airways (bronchial tree), diaphragm.
 */
export function lungsFrontal(opts = {}) {
  const { breathe = 0, lobes = [], tree = true, under = '', emphasis = [], parts = {}, key } = opts;
  const pl = placer(opts), s = pl.s, b = clamp(breathe, 0, 1), em = n => emphasis.includes(n), d2 = n => em(n) ? '' : D2, d3 = n => em(n) ? '' : D3;
  const B = ([x, y]) => [x * (1 + 0.055 * b), y < 60 ? y : 60 + (y - 60) * (1 + 0.085 * b)];
  const outlinePts = pts => samplePath(smooth(pts.map(B), { closed: true }), 180);
  const right = outlinePts(RIGHT), left = outlinePts(LEFT), rD = polyD(right, true), lD = polyD(left, true);
  const kk = key != null ? String(key) : undefined, id = base => uid(base, kk != null ? `${kk}` : undefined);
  const gR = id('lungR'), gL = id('lungL'), clip = id('lungclip'), cR = id('lungcR'), cL = id('lungcL');
  const fiss = { right: [FISS.rh, FISS.ro].map(q => q.map(B)), left: [FISS.lo.map(B)] };
  const ext = (q, a, z) => [a, ...q, z];
  const rhE = ext(fiss.right[0], B([-170, 140]), B([0, 136])), roE = ext(fiss.right[1], B([-170, 138]), B([-24, 270]));
  const loE = ext(fiss.left[0], B([170, 108]), B([44, 270]));
  const lobePolys = {
    rul: [B([-170, -20]), B([0, -20]), ...[...rhE].reverse()],
    rml: [...rhE, B([0, 270]), ...[...roE].reverse()],
    rll: [...roE, B([-170, 270])],
    lul: [B([0, -20]), B([170, -20]), ...loE, B([0, 270])],
    lll: [...loE, B([170, 270])],
  };
  // diaphragm: two domes, the right higher, the central tendon between them
  const dia = [[-146, 236], [-120, 224], [-88, 210], [-60, 206], [-36, 212], [-14, 224], [0, 228], [20, 234], [44, 242], [70, 236], [96, 226], [124, 236], [146, 250]].map(([x, y]) => B([x, y + 4]));
  const diaD = smooth(dia);
  const Lg = P.lung;
  const lungBody = (d, gid, cid, box, lobeKeys, fis, specAt) => {
    let g = volumeGradient(gid, 'lung', box) + `<clipPath id="${cid}"><path d="${d}"/></clipPath>`;
    g += `<path d="${d}" fill="url(#${gid})"/>`;
    const wash = lobeKeys.filter(k => lobes.includes(k)).map(k => `<path d="${polyD(lobePolys[k], true)}" fill="${P.ui.blueWash}" fill-opacity=".62"/>`).join('');
    if (wash) g += `<g clip-path="url(#${cid})">${wash}</g>`;
    // the lower edges sit on the diaphragm: a contact shade inside the base
    g += `<g clip-path="url(#${cid})">${pathS(diaD, Lg.lo, 7 / s, ' stroke-opacity=".35"')}</g>`;
    g += spec(...specAt) + `<g clip-path="url(#${cid})">${fis.map(q => pathS(smooth(q), Lg.line, SW.internal * 1.2 / s, ' stroke-opacity=".85"')).join('')}</g>`;
    return g + pathS(d, Lg.line, SW.outline / s, ' stroke-linejoin="round"');
  };
  const rBox = bbox(right), lBox = bbox(left);
  const rLung = lungBody(rD, gR, cR, rBox, ['rul', 'rml', 'rll'], fiss.right, [...B([-104, 88]), 11, 24, 22]);
  const lLung = lungBody(lD, gL, cL, lBox, ['lul', 'lll'], fiss.left, [...B([108, 88]), 10, 22, -22]);
  // airways: whitish cartilage tubes over the lungs, lit from the upper left
  const Ct = P.cartilage, olw = 1.1 / s;
  const tubeL = (d, w) => pathS(d, Ct.line, w + 2 * olw, ' stroke-linecap="round" stroke-linejoin="round"');
  const tubeB = (d, w) => pathS(d, Ct.base, w, ' stroke-linecap="round" stroke-linejoin="round"');
  const tubeH = (d, w) => w > 5 ? `<path d="${offsetPath(d, -w * 0.22, 8)}" fill="none" stroke="${Ct.hi}" stroke-width="${f(w * 0.28)}" stroke-linecap="round"/>` : '';
  const seg = (a, c) => `M${pt(a)} L${pt(c)}`;
  const curve = (a, c, bend) => { const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, dx = c[0] - a[0], dy = c[1] - a[1]; return `M${pt(a)} Q${pt([mx - dy * bend, my + dx * bend])} ${pt(c)}`; };
  // lobar bronchi and three generations beyond them (the deeper two are detail)
  const branches = [];
  for (const [k, [a, c, w]] of Object.entries(LOBAR)) branches.push({ d: curve(B(a), B(c), 0.06), w, gen: 0, k });
  const tips = {};
  const grow = (from, ang, len, w, gen, k) => {
    const to = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len];
    branches.push({ d: seg(B(from), B(to)), w, gen, k });
    if (gen < 3) for (const sg of [-1, 1]) grow(to, ang + sg * rad(28 - gen * 4), len * (gen === 2 ? 0.6 : 0.68), w * 0.68, gen + 1, k);
    else if (!tips[k]) tips[k] = B(to);
  };
  for (const k of TIPS) { const [a, c, w] = LOBAR[k]; grow(c, Math.atan2(c[1] - a[1], c[0] - a[0]), Math.hypot(c[0] - a[0], c[1] - a[1]) * 0.62 + 8, w * 0.72, 1, k); }
  let lobar = '';
  if (tree) {
    const deep = branches.filter(q => q.gen === 2), deeper = branches.filter(q => q.gen === 3), mid = branches.filter(q => q.gen < 2);
    lobar = `<clipPath id="${clip}"><path d="${rD} ${lD}"/></clipPath><g clip-path="url(#${clip})">` +
      `<g opacity=".55" class="${d3('airways')} ${d2('airways')}">${deeper.map(q => tubeL(q.d, q.w)).join('')}${deeper.map(q => tubeB(q.d, q.w)).join('')}</g>` +
      `<g opacity=".8" class="${d3('airways')}">${deep.map(q => tubeL(q.d, q.w)).join('')}${deep.map(q => tubeB(q.d, q.w)).join('')}</g>` +
      mid.map(q => tubeL(q.d, q.w)).join('') + mid.map(q => tubeB(q.d, q.w)).join('') + mid.map(q => tubeH(q.d, q.w)).join('') + '</g>';
  }
  const main = { right: { from: [0, 78], to: B([-20, 108]), w: 13.5 }, left: { from: [0, 78], to: B([40, 112]), w: 10.5 } };
  const mainD = { right: curve(main.right.from, main.right.to, -0.05), left: curve(main.left.from, main.left.to, 0.08) };
  const TW = 19, trachD = 'M0 0 L0 80';
  const rings = [];
  for (let yy = 7; yy <= 72; yy += 7.2) rings.push(`M${f(-TW / 2 + 1.2)} ${f(yy)} Q0 ${f(yy + 2.6)} ${f(TW / 2 - 1.2)} ${f(yy)}`);
  const mainRings = ['right', 'left'].flatMap(k => { const q = samplePath(mainD[k], 5).slice(1, 4), M = main[k], ang = Math.atan2(M.to[1] - M.from[1], M.to[0] - M.from[0]) + Math.PI / 2, hw = M.w / 2 - 1; return q.map(p => seg(add(p, dir(ang), hw), add(p, dir(ang), -hw))); });
  const ringsSvg = `<g class="${d3('trachea')}">${rings.map(d => pathS(d, Ct.lo, 2.6 / s, ' stroke-linecap="round"') + pathS(d, Ct.line, 0.7 / s, ' stroke-opacity=".6" stroke-linecap="round"')).join('')}</g>`;
  const mainRingsSvg = `<g class="${d2('airways')}">${mainRings.map(d => pathS(d, Ct.lo, 2.2 / s, ' stroke-linecap="round"')).join('')}</g>`;
  const bronchiL = tubeL(mainD.right, main.right.w) + tubeL(mainD.left, main.left.w);
  const bronchiB = tubeB(mainD.right, main.right.w) + tubeB(mainD.left, main.left.w) + tubeH(mainD.right, main.right.w) + tubeH(mainD.left, main.left.w) + mainRingsSvg;
  const trachL = pathS(trachD, Ct.line, TW + 2 * olw, ' stroke-linecap="butt"');
  const trachB = pathS(trachD, Ct.base, TW, ' stroke-linecap="butt"') + `<path d="M${f(-TW * 0.22)} 2 L${f(-TW * 0.22)} 78" stroke="${Ct.hi}" stroke-width="${f(TW * 0.26)}" stroke-linecap="round"/>` + ringsSvg +
    // the carina: the floor of the bifurcation, a short rounded ridge between the two main bronchi
    `<path d="M-5 84 Q0 78 5 84" fill="none" stroke="${Ct.line}" stroke-width="${f(1.1 / s)}"/>`;
  const diaSvg = pathS(diaD, P.skeletal.base, 3.4 / s, ' stroke-linecap="round" stroke-opacity=".65"');
  const body = group(parts, 'lungs right-lung', rLung) + group(parts, 'lungs left-lung', lLung) +
    (tree ? group(parts, 'airways', lobar) : '') +
    group(parts, 'airways', bronchiL) + group(parts, 'airways trachea', trachL) + group(parts, 'airways', bronchiB) + group(parts, 'airways trachea', trachB);
  const nat = [...right, ...left, [-TW / 2, 0], [TW / 2, 0], ...dia.map(p => [p[0], p[1] + 2.5])];
  const box = bbox(nat.map(pl.map), 1);
  const at = {
    trachea: pl.map([0, 40]), carina: pl.map([0, 84]), 'right-main': pl.map(samplePath(mainD.right, 3)[1]), 'left-main': pl.map(samplePath(mainD.left, 3)[1]),
    'right-lung': pl.map(B([-92, 104])), 'left-lung': pl.map(B([96, 110])), lungs: pl.map(B([-92, 104])),
    notch: pl.map(B([49, 181])), lingula: pl.map(B([46, 220])), 'apex-r': pl.map(B([-60, 22])), 'apex-l': pl.map(B([60, 22])),
    'fissure-h': pl.map(B([-80, 137])), 'fissure-r': pl.map(B([-88, 178])), 'fissure-l': pl.map(B([96, 172])),
    rul: pl.map(B([-80, 100])), rml: pl.map(B([-62, 170])), rll: pl.map(B([-118, 200])), lul: pl.map(B([84, 120])), lll: pl.map(B([118, 212])),
    'twig-r': pl.map(tips.rll || B([-50, 214])), 'twig-l': pl.map(tips.lll || B([80, 220])), heart: pl.map(B([22, 196])),
    diaphragm: pl.map(B([-60, 210])),
  };
  const outline = (state = {}) => {
    const g = state.breathe != null && state.breathe !== breathe ? lungsFrontal({ ...opts, breathe: state.breathe, tree: false, key: 'outline' }).geom : { right, left };
    return `${polyD(g.right.map(pl.map), true)} ${polyD(g.left.map(pl.map), true)}`;
  };
  const geom = { right, left, fissures: fiss, lobes: lobePolys, main, rings: rings.length, heartBox: bbox([B([-36, 150]), B([64, 236])]) };
  // under (a heart) is in picture coordinates: on the diaphragm, behind the lungs
  const svg = pl.wrap(group(parts, 'diaphragm', diaSvg)) + (under ? `<g>${under}</g>` : '') + pl.wrap(body);
  return artOf(svg, box, at, outline, { geom });
}
