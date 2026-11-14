// The Lab's kidney and nephron (art direction section 4.3). Plain ES module; import it unversioned as
// /lab/kit/art/kidney.js. Three shared primitives, each a pure function of its options returning an Art
// ({ svg, box, at, outline(state) }, toString() is svg); none emits text (labels are the lesson's):
//
//   kidneySection(opts)  the coronal section: fibrous capsule over a volume-lit rim, cortex, renal columns,
//     8 striated pyramids whose papillae sit in minor calyces, major calyces, renal pelvis in sinus fat,
//     ureter leaving downward, renal artery above the renal vein at the hilum, interlobar and arcuate
//     arteries (detail). Optional: a nephron placed in one lobe (corpuscle in the cortex, loop into the
//     pyramid, duct to the papilla), an adrenal on the upper pole (right pyramidal, left crescentic).
//     Anchor: the hilum. side 'right' (default, the patient's right kidney: on the viewer's left in an
//     anterior view, hilum facing the viewer's right) or 'left' (its mirror image).
//   walledTubule(opts)   one nephron in the cortex and medulla: renal corpuscle (Bowman capsule, lobed
//     capillary tuft, podocytes), afferent arteriole (wider, from a cortical radial artery) with
//     juxtaglomerular granular cells in its wall, efferent arteriole (narrower) giving the peritubular
//     capillary and the vasa recta, convoluted then straight proximal tubule with a brush border, thin
//     descending limb, thin ascending limb, thick ascending limb whose last cells (macula densa) touch the
//     vascular pole between the arterioles, a distal convoluted tubule that returns past its own
//     corpuscle, and a collecting duct shared with other nephrons. Thin ascending limb and TAL carry the
//     water-tight wall style. Every centre line is in NEPHRON_GEOM (a lesson may pass its own as geom).
//   tubuleCellRow(opts)  a row of tubule epithelial cells between the lumen and a peritubular capillary,
//     with the transporters of its segment: proximal (SGLT, NHE3; Na/K pump, GLUT2), thick ascending
//     limb (NKCC2, ROMK; pump, Cl channel), distal (NCC; pump, Cl channel), principal cell (ENaC, ROMK,
//     aquaporin-2; pump, basolateral aquaporin). Carriers are sage two-lobed bodies, channels lilac
//     subunit pairs around a pore, the pump a large alpha body with its beta subunit. Ions ride through
//     each in the right direction, moved by phase.
//
// Expected behaviour (tested by tools/art-tests/kidney.test.mjs; looked at in tools/art-gallery/kidney.html):
//   - Accuracy (section 4.3): JG granular cells in the afferent wall at the vascular pole; macula densa in
//     the last cortical part of the TAL, in the angle between its own afferent and efferent arterioles;
//     peritubular capillaries and vasa recta arise from the efferent arteriole (never an independent
//     vessel); vasa recta only with a juxtamedullary (long-looped) nephron; afferent wider than efferent;
//     the DCT returns to its own corpuscle; the collecting duct is shared; K+ leaves the principal cell
//     into the lumen; the pump moves 3 Na+ out and 2 K+ in across the basolateral membrane.
//   - Common options of section 4.0b: { x, y, s, rot, flip, emphasis, parts, key }. parts renames any
//     emitted data-part token; every part is a leaf group (never nested); multi-name leaves use spaces.
//   - Weight strokes keep their on-screen weight at any s; tube widths are geometry (model widths).
//   - Detail carries ax-d2 / ax-d3 (hidden by the .lx-pic container query in small pictures).
//   - Pure: the same options give the same markup (ids are stable when key is given). phase loops in [0, 1).
import {
  P, SW, D2, D3, f, pt, mix, uid, artOf, smooth, samplePath, pathLength, offsetPath, distToPolygon, cutGradient, volumeGradient, rim, spec, cutFace, chevronD, tube, partName, partAttr, placer, rayHit, crCubics, cubicsD, framesOf, litEdge,
} from './core.js';

/* ---------- small helpers ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = a => Math.hypot(a[0], a[1]);
const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dist = (a, b) => len(sub(a, b));
const dir = deg => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
const polyD = (pts, close = false) => `M${pts.map(pt).join(' L')}${close ? ' Z' : ''}`;
const nameOf = partName; // core: renames, multi-names, each word once
const idMaker = key => b => uid(b, key != null ? `${key}-${b}` : undefined);
const smoothstep = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
// Placement, ray hits, Catmull-Rom cubics, frames and lit edges are core.js helpers (placer, rayHit,
// crCubics, cubicsD, framesOf, litEdge).
const mapper = (o, origin) => placer(o, origin);

/* ---------- materials ---------- */
// The nephron segment materials are P rows (core.js): proximal sage, thin limbs pale, thick ascending
// limb warm, distal teal, collecting duct slate. The interstitium tints are P.space.renal*, renin P.renin.
export const TUBULE = Object.freeze({ pt: P.tubulePt, desc: P.tubuleThin, thin: P.tubuleThin, tal: P.tubuleTal, dct: P.tubuleDct, cd: P.tubuleCd });
const TISSUE = { cortex: P.space.renalCortex, outer: P.space.renalOuter, inner: P.space.renalInner, edge: P.space.renalEdge };
const RENIN = P.renin;

/* =====================================================================================================
 * kidneySection
 * ===================================================================================================== */
const K_HILUM = [94, 104], K_CENTRE = [52, 104], K_SINUS_C = [66, 104];
// The bean, right kidney, hilum facing +x. Native box 0..140 x 0..210 (vessels run out to x 140, the
// ureter down to y 210).
const K_OUTLINE = [[50, 8], [76, 14], [93, 32], [100, 58], [96, 80], [88, 91], [86, 104], [88, 117], [96, 128], [100, 150], [93, 176], [76, 194], [50, 200], [26, 194], [10, 174], [3, 140], [2, 104], [4, 66], [11, 34], [27, 14]];
const K_SINUS = [[90, 92], [82, 78], [72, 66], [62, 62], [56, 70], [54, 87], [53, 104], [54, 121], [56, 138], [62, 146], [72, 142], [82, 130], [90, 116]];
const K_ANGLES = [-152, -122, -94, -66, 66, 94, 122, 152];
const K_MAJOR = { up: [72, 88], down: [72, 126] }, K_PELVIS = [80, 112], K_EXIT = [97, 124];
const K_URETER = [[95, 122], [106, 131], [113, 148], [114, 176], [112, 210]];
const K_ARTERY = [[140, 85], [118, 85], [102, 88], [88, 94]], K_VEIN = [[140, 100], [118, 100], [100, 101], [86, 103]];
const K_SCARS = [-128, 132]; // polar angles about K_CENTRE where cortical scars draw in

/** The section's geometry in native coordinates, for the drawing and for tests. */
export function kidneyGeometry({ shrink = 0, scar = 0 } = {}) {
  const k = 1 - 0.2 * clamp(shrink, 0, 1), sc = p => add(K_HILUM, sub(p, K_HILUM), k);
  const cortex = 14 * (1 - 0.45 * clamp(shrink, 0, 1)) * k;
  // outline: sampled densely, then scars pull the surface in on gaussian profiles
  let poly = samplePath(smooth(K_OUTLINE, { closed: true }), 96);
  if (scar > 0) poly = poly.map(p => {
    const r = sub(p, K_CENTRE), a = Math.atan2(r[1], r[0]) * 180 / Math.PI;
    const pull = K_SCARS.reduce((acc, c) => { const d = ((a - c + 540) % 360) - 180; return acc + 9 * scar * Math.exp(-((d / 9) ** 2)); }, 0);
    return add(K_CENTRE, unit(r), len(r) - pull);
  });
  poly = poly.map(sc);
  const outline = smooth(poly, { closed: true }), outlinePoly = samplePath(outline, 200);
  const sinusD = smooth(K_SINUS.map(sc), { closed: true }), sinusPoly = samplePath(sinusD, 120), c = sc(K_SINUS_C);
  const delta = 12.5;
  const pyramids = K_ANGLES.map(th => {
    const u = dir(th), v = [-u[1], u[0]];
    // the base lies a full cortex thickness under the surface, measured square to it (not along the ray,
    // which near the hilum meets the surface obliquely)
    const rOut = a => rayHit(c, dir(a), outlinePoly), rIn = rayHit(c, u, sinusPoly);
    const under = a => { let r = rOut(a); while (r > 0 && distToPolygon(add(c, dir(a), r), outlinePoly) < cortex) r -= 0.5; return r; };
    const arc = [];
    for (let i = 0; i <= 6; i++) { const a = th - delta + 2 * delta * i / 6; arc.push(add(c, dir(a), under(a))); }
    const apex = add(c, u, rIn - 3), base = add(c, u, under(th));
    // sides run from the base corners to a blunt papilla, bowed slightly outward
    const sideR = add(apex, u, 5), sR = add(sideR, v, 4.6), sL = add(sideR, v, -4.6), half = (p, q, k) => add(add(p, sub(q, p), 0.5), v, k);
    const pts = [...arc, half(arc[6], sR, 1.6), sR, add(apex, v, 2.4), add(apex, u, -0.8), add(apex, v, -2.4), sL, half(sL, arc[0], -1.6)];
    const d = smooth(pts, { closed: true });
    return { angle: th, u, v, base, papilla: apex, calyx: add(apex, u, -5.5), arc, d, cortexEnd: add(c, u, rOut(th)), length: dist(base, apex) };
  });
  return { k, cortex, outline, outlinePoly, sinus: sinusD, sinusPoly, sinusCentre: c, pyramids, hilum: K_HILUM, scale: sc };
}

/** The coronal section. Options: { x, y, s, rot, flip, side: 'right' | 'left', shrink 0..1, scar 0..1,
 *  adrenal: false | true, nephron: false | true | { lobe: index 0..7 }, hilum: true (hilar vessels),
 *  emphasis, parts, key }. Native box 140 x 210, anchor the hilum. Parts: kidney cortex medulla pelvis
 *  ureter renal-artery renal-vein (+ adrenal, nephron). at: hilum, cortex, medulla, pyramid, papilla,
 *  calyx, pelvis, ureter, renal-artery, renal-vein, capsule, lobe, nephron, adrenal. */
export function kidneySection(opts = {}) {
  const { x = 0, y = 0, s = 1, rot = 0, side = 'right', shrink = 0, scar = 0, adrenal = false, nephron = false, hilum = true, emphasis = [], parts = {}, key } = opts;
  const flip = (side === 'left') !== !!opts.flip;
  const id = idMaker(key), P_ = n => partAttr(parts, n), w = t => f((SW[t] ?? t) / s);
  const G = kidneyGeometry({ shrink, scar }), M = mapper({ x, y, s, rot, flip }, K_HILUM);
  const ids = { rim: id('krim'), cut: id('kcut'), adr: id('kadr'), ure: id('kure') };
  const KC = P.kidneyCortex, KM = P.kidneyMedulla, PV = P.pelvis;
  // cortex: volume-lit rim outside, flat cut face darkening toward the capsule, the capsule a pale line
  const cortexSvg = rim(G.outline, 'kidneyCortex', ids.rim, { w: 2.6, s })
    + `<path d="${G.outline}" fill="url(#${ids.cut})"/>`
    + `<path d="${G.outline}" fill="none" stroke="${mix(P.valve.hi, KC.hi, 0.25)}" stroke-width="${w(1.1)}" stroke-opacity=".9" class="${D2}"/>`
    + spec(28, 40, 9, 16, 20).replace('fill-opacity=".2"', `fill-opacity=".12" class="${D3}"`);
  const fat = `<path d="${G.sinus}" fill="${P.lipid.base}" stroke="${P.lipid.line}" stroke-opacity=".6" stroke-width="${w('internal')}"/>`
    + [[58, 70], [55, 92], [52, 116], [58, 140], [66, 62], [86, 96]].map(([px, py], i) => { const q = G.scale([px, py]); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(3.2 + (i % 2))}" fill="none" stroke="${P.lipid.lo}" stroke-width="${w('detail')}" class="${D2}"/>`; }).join('');
  // pyramids: flat darker section, striations (collecting ducts) running to the papilla
  const pyr = G.pyramids.map((p, i) => {
    const hw = dist(p.arc[0], p.arc[6]) / 2;
    const stri = [-0.55, -0.2, 0.2, 0.55].map(t => {
      const b = add(p.base, p.v, t * hw * 0.8), e = add(p.papilla, p.v, t * 2.2);
      return `M${pt(add(b, p.u, -3))} L${pt(add(e, p.u, 5))}`;
    }).join(' ');
    return `<path data-pyramid="${i}" d="${p.d}" fill="${KM.base}" stroke="${KM.line}" stroke-opacity=".7" stroke-width="${w('internal')}"/>`
      + `<path d="${stri}" fill="none" stroke="${KM.lo}" stroke-width="${w(1)}" stroke-linecap="round" class="${D2}"/>`
      + `<path d="${smooth(p.arc)}" fill="none" stroke="${KM.hi}" stroke-opacity=".5" stroke-width="${w(1.4)}" class="${D2}"/>`;
  }).join('');
  // interlobar arteries in the columns, arcuate arteries over the pyramid bases (detail)
  const c = G.sinusCentre, rOut = a => rayHit(c, dir(a), G.outlinePoly), rIn = a => rayHit(c, dir(a), G.sinusPoly);
  const cols = [];
  for (let i = 0; i < K_ANGLES.length - 1; i++) if (Math.sign(K_ANGLES[i]) === Math.sign(K_ANGLES[i + 1])) cols.push((K_ANGLES[i] + K_ANGLES[i + 1]) / 2);
  cols.push(-180);
  const inter = cols.map(a => `M${pt(add(c, dir(a), rIn(a) + 1))} L${pt(add(c, dir(a), rOut(a) - G.cortex - 1))}`).join(' ');
  const arcu = G.pyramids.map(p => smooth(p.arc.map(q => add(q, p.u, 1.5)))).join(' ');
  const vesselLine = (d, mat, wd) => `<path d="${d}" fill="none" stroke="${mat.line}" stroke-width="${w(wd + 1.2)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${mat.base}" stroke-width="${w(wd)}" stroke-linecap="round"/>`;
  const segmental = cols.map(a => `M${pt(K_ARTERY[3])} Q${pt(add(c, dir(a), rIn(a) * 0.5))} ${pt(add(c, dir(a), rIn(a) + 1))}`).join(' ');
  const intra = `<g class="${D2}">${vesselLine(segmental, P.oxy, 1.3)}${vesselLine(inter, P.oxy, 1.4)}${vesselLine(arcu, P.oxy, 1.2)}</g>`;
  // the urinary tree: minor calyx cups, infundibula, major calyces, pelvis, all cut open (urine inside)
  const cups = G.pyramids.map(p => {
    const a0 = Math.atan2(-p.u[1], -p.u[0]) * 180 / Math.PI, arcPts = [];
    for (let i = 0; i <= 8; i++) arcPts.push(add(p.papilla, dir(a0 - 118 + 236 * i / 8), 5.6));
    return smooth(arcPts);
  }).join(' ');
  const infund = G.pyramids.map(p => `M${pt(p.calyx)} L${pt(G.scale(p.angle < 0 ? K_MAJOR.up : K_MAJOR.down))}`).join(' ');
  const majors = `M${pt(G.scale(K_MAJOR.up))} Q${pt(G.scale([78, 98]))} ${pt(G.scale(K_PELVIS))} M${pt(G.scale(K_MAJOR.down))} Q${pt(G.scale([78, 122]))} ${pt(G.scale(K_PELVIS))}`;
  const pelvisD = `M${pt(G.scale(K_PELVIS))} L${pt(K_EXIT)}`;
  const layer = (d, wd, col, lc = 'round') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(wd)}" stroke-linecap="${lc}" stroke-linejoin="round"/>`;
  const ol = 2 * SW.internal / s;
  const urinary = layer(cups, 2.6 + ol, PV.line) + layer(infund, 5 + ol, PV.line) + layer(majors, 8 + ol, PV.line) + layer(pelvisD, 17 + ol, PV.line)
    + layer(cups, 2.6, PV.base) + layer(infund, 5, PV.base) + layer(majors, 8, PV.base) + layer(pelvisD, 17, PV.base)
    + layer(infund, 2.2, P.space.filtrate) + layer(majors, 4.4, P.space.filtrate) + layer(pelvisD, 12, P.space.filtrate);
  // ureter: an exterior tube leaving the hilum downward, lit from the upper left
  const ureD = smooth(K_URETER);
  const ureter = `<path d="${ureD}" fill="none" stroke="${PV.line}" stroke-width="9.5" stroke-linecap="butt"/><path d="${ureD}" fill="none" stroke="${PV.base}" stroke-width="${f(9.5 - 2 * SW.outline / s)}" stroke-linecap="butt"/>`
    + `<path d="${litEdge(ureD, 2)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".45" stroke-width="${w(1.8)}" stroke-linecap="round"/>`
    + `<path d="M${pt(K_URETER[3])} L${pt(K_URETER[4])}" fill="none" stroke="${PV.lo}" stroke-width="2" stroke-opacity=".5" transform="translate(2.2 0)" class="${D3}"/>`;
  // hilar vessels: a panel separation line (outline rule), wall, lumen; cut ends at the box edge
  const vessel = (pts, wall, lumen, wd, lw) => {
    const d = smooth(pts), t = tube(d, { wall, lumen, w: wd, lumenW: lw, s, highlight: true, cut: 'start' });
    return `<path d="${d}" fill="none" stroke="${P.ui.panel}" stroke-width="${f(wd + 3 / s)}"/>${t.svg}`;
  };
  const artery = hilum ? vessel(K_ARTERY, 'artery', 'oxy', 9, 5) : '';
  const vein = hilum ? vessel(K_VEIN, 'vein', 'deoxy', 12, 9) : '';
  // optional nephron in one lobe: corpuscle in the cortex, loop into the pyramid, duct to the papilla
  const lobe = typeof nephron === 'object' && nephron ? clamp(nephron.lobe | 0, 0, 7) : 1;
  const pyN = G.pyramids[lobe];
  const nephPts = (() => {
    const { u, v, base: B, papilla: A, length: L } = pyN, g = add(add(B, u, G.cortex * 0.55), v, 3.2);
    const tubule = [g, add(add(g, u, 2.5), v, 3.5), add(add(B, u, 2), v, 4.4), add(add(B, u, -L * 0.62), v, 3), add(B, u, -L * 0.7), add(add(B, u, -L * 0.62), v, -0.6), add(add(B, u, 1.5), v, -0.8), add(add(g, u, -2.6), v, -1.4)];
    const duct = [add(add(g, u, 1), v, -4.2), add(add(B, u, 2), v, -5), add(add(A, u, 3), v, -0.8)];
    return { g, tubule, duct };
  })();
  const nephSvg = nephron ? (() => {
    const lw = w(1.2), cw = w(2.6);
    const tD = smooth(nephPts.tubule), dD = smooth(nephPts.duct);
    return `<g ${P_('kidney nephron')}>${layer(tD, cw, PV.line)}${layer(dD, cw + w(0.6), PV.line)}${layer(tD, lw, P.space.filtrate)}${layer(dD, lw + w(0.4), P.space.filtrate)}`
      + `<circle cx="${f(nephPts.g[0])}" cy="${f(nephPts.g[1])}" r="${f(2.9)}" fill="${P.oxy.base}" stroke="${P.space.filtrate}" stroke-width="${w(1.2)}"/></g>`;
  })() : '';
  // optional adrenal: right pyramidal cap, left crescent down the medial upper border (mirrored with side)
  const adrPts = side === 'left'
    ? [[46, 6], [64, -6], [82, 2], [96, 24], [101, 50], [95, 62], [90, 40], [80, 20], [64, 10]]
    : [[30, 14], [44, -4], [56, -20], [68, -8], [80, 12], [62, 8], [46, 10]];
  const adrD = smooth(adrPts.map(G.scale), { closed: true });
  const adrSvg = adrenal ? `<g ${P_('adrenal')}><defs>${volumeGradient(ids.adr, 'adrenalCortex', [28, -22, 74, 86])}</defs><path d="${adrD}" fill="url(#${ids.adr})" stroke="${P.adrenalCortex.line}" stroke-width="${w('outline')}"/></g>` : '';
  const svg = `<g class="ax-kidney-section" transform="${M.tf}">`
    + `<defs>${volumeGradient(ids.rim, 'kidneyCortex', [0, 0, 104, 210])}${cutGradient(ids.cut, [56, 100], 108, mix(KC.base, KC.hi, 0.3), KC.base)}</defs>`
    + adrSvg
    + `<g ${P_('ureter')}>${ureter}</g>`
    + `<g ${P_('kidney cortex')}>${cortexSvg}</g>`
    + `<g ${P_('kidney')}>${fat}</g>`
    + `<g ${P_('kidney medulla')}>${pyr}</g>`
    + `<g ${P_('renal-artery')}>${intra}${artery}</g>`
    + `<g ${P_('kidney pelvis')}>${urinary}</g>`
    + `<g ${P_('renal-vein')}>${vein}</g>`
    + nephSvg + '</g>';
  const lat = add(G.sinusCentre, [-1, 0], rayHit(G.sinusCentre, [-1, 0], G.outlinePoly) - G.cortex / 2);
  const pm = G.pyramids[0], centroid = p => { const q = samplePath(p.d, 24); return [q.reduce((a, b) => a + b[0], 0) / 24, q.reduce((a, b) => a + b[1], 0) / 24]; };
  const at = {
    hilum: K_HILUM, cortex: add(G.sinusCentre, dir(-104), rayHit(G.sinusCentre, dir(-104), G.outlinePoly) - G.cortex / 2), 'cortex-lateral': lat,
    medulla: centroid(G.pyramids[2]), 'medulla-lateral': centroid(pm), pyramid: centroid(pm), papilla: pm.papilla, calyx: pm.calyx,
    pelvis: G.scale([84, 117]), ureter: K_URETER[3], 'renal-artery': [120, 85], 'renal-vein': [118, 100],
    capsule: add(G.sinusCentre, dir(-125), rayHit(G.sinusCentre, dir(-125), G.outlinePoly)), lobe: centroid(pyN), nephron: nephPts.g,
    ...(adrenal ? { adrenal: G.scale(side === 'left' ? [92, 30] : [55, -6]) } : {}),
  };
  const box = adrenal ? [0, -22, 140, 232] : [0, 0, 140, 210];
  return artOf(svg, M.boxOf(box), Object.fromEntries(Object.entries(at).map(([k_, p]) => [k_, M.map(p).map(f)])),
    (st = {}) => {
      const g = kidneyGeometry({ shrink: st.shrink ?? shrink, scar: st.scar ?? scar });
      return polyD(g.outlinePoly.filter((_, i) => i % 2 === 0).map(M.map), true);
    }, { geometry: G });
}

/* =====================================================================================================
 * walledTubule: one nephron
 * ===================================================================================================== */
const arcPts = (cx, cy, r, from, to, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = (from + (to - from) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const joinPts = (...ps) => ps.reduce((all, p, i) => all.concat(i ? p.slice(1) : p), []);
const GLOM = [70, 74], CAPSULE_R = 28;
const onCap = deg => add(GLOM, dir(deg), CAPSULE_R);
/** The default nephron, native 300 x 380: cortex above y 160, outer medulla to 262, inner medulla below.
 *  Every polyline runs in the direction of flow (blood or filtrate). */
const G0 = {
  W: 300, H: 380, medullaTop: 160, innerTop: 262,
  glom: GLOM, capsuleR: CAPSULE_R, vascularPole: onCap(-40), urinaryPole: onCap(140),
  radial: [[7, 160], [7, 0]], // cortical radial artery, flowing toward the capsule
  afferent: [[7, 24], [26, 22], [50, 26], [70, 36], [83, 47], [88, 53]],
  efferent: [[93, 59], [106, 63], [124, 63], [144, 68]],
  pt: [onCap(140), [38, 105], [20, 108], [11, 124], [18, 140], [38, 145], [54, 132], [72, 121], [92, 123], [106, 134], [118, 136], [124, 148], [124, 160]],
  desc: [[124, 160], [124, 332]],
  thin: joinPts(arcPts(160, 332, 36, 180, 0, 14), [[196, 332], [196, 262]]),
  tal: [[196, 262], [196, 120], [193, 90], [181, 66], [160, 52], [134, 46], [112, 45], [98, 48]],
  dct: [[98, 48], [91, 39], [94, 25], [112, 15], [146, 11], [186, 13], [220, 22], [244, 42], [258, 66], [272, 86]],
  cd: [[272, 86], [272, 200], [273, 300], [274, 378]],
  cdAbove: [[272, 0], [272, 86]],
  others: [[[300, 30], [288, 34], [272, 44]], [[300, 132], [287, 136], [272, 146]]],
  peritubular: null, // filled below from the efferent arteriole around the proximal tubule
  vasaRecta: [[144, 68], [150, 92], [151, 130], [151, 160], [151, 322], ...arcPts(161, 322, 10, 180, 0, 6).slice(1), [171, 160], [172, 128], [178, 106]],
};
// The cortical (short-looped) variant: the loop turns in the outer medulla; the thick limb begins before
// the bend (no thin ascending limb); no vasa recta.
const CORTICAL = { desc: [[124, 160], [124, 194]], thin: [], tal: joinPts(arcPts(160, 194, 36, 180, 0, 14), [[196, 194], [196, 120], [193, 90], [181, 66], [160, 52], [134, 46], [112, 45], [98, 48]]) };
// Peritubular capillary: from the efferent arteriole down past the straight proximal tubule, then under
// the convolutions toward the venous side, where it is cut (it drains on into the cortical veins).
G0.peritubular = [[144, 68], [152, 92], [147, 116], [138, 138], [118, 151], [90, 154], [62, 155], [38, 155], [20, 150]];
export const NEPHRON_GEOM = Object.freeze(G0);
const SEG_ORDER = ['pt', 'desc', 'thin', 'tal', 'dct', 'cd'];
const SEG_NAMES = { pt: 'nephron proximal', desc: 'nephron loop descending', thin: 'nephron loop thin-ascending', tal: 'nephron loop tal', dct: 'nephron distal', cd: 'collecting' };
// tube widths (outer, lumen): the proximal tubule thick-walled with a brush border, thin limbs thin-walled,
// the TAL thicker, the distal medium, the collecting duct widest
export const TUBULE_W = { pt: [16, 6.6], desc: [8, 3.8], thin: [8, 3.8], tal: [13.5, 4.2], dct: [12, 5], cd: [18, 7.4] };

/** Geometry for a nephron (default NEPHRON_GEOM): { order, seg: { key: d }, cubics, span, track(s),
 *  length, along(key, s) -> [x, y, nx, ny] in native coordinates }. The track runs from the urinary pole
 *  to the papilla, so a particle at s rides the lumen. */
export function nephronGeometry(geom = NEPHRON_GEOM) {
  const order = SEG_ORDER.filter(k => geom[k] && geom[k].length > 1);
  const all = [], idx = {};
  for (const k of order) { const p = geom[k], start = all.length ? all.length - 1 : 0; all.push(...(all.length ? p.slice(1) : p)); idx[k] = [start, all.length - 1]; }
  const cubics = crCubics(all), seg = {};
  for (const k of order) seg[k] = cubicsD(cubics.slice(idx[k][0], idx[k][1]));
  const lens = order.map(k => pathLength(seg[k])), total = lens.reduce((a, b) => a + b, 0), span = {};
  let acc = 0;
  order.forEach((k, i) => { span[k] = [acc / total, (acc + lens[i]) / total]; acc += lens[i]; });
  const dense = {};
  const framesFor = k => dense[k] || (dense[k] = framesOf(seg[k], 1.5));
  const along = (k, sFrac) => { const fr = framesFor(k), i = Math.round(clamp(sFrac, 0, 1) * (fr.length - 1)); return [...fr[i][0], ...fr[i][1]]; };
  const track = sFrac => {
    const v = clamp(sFrac, 0, 1);
    const k = order.find(kk => v <= span[kk][1] + 1e-12) || order[order.length - 1], [a, b] = span[k];
    const q = along(k, b > a ? (v - a) / (b - a) : 0);
    return [q[0], q[1]];
  };
  return { order, seg, cubics, span, track, length: total, along };
}

/** One nephron. Options: { x, y, s, rot, flip, geom (NEPHRON_GEOM shape), juxtamedullary = true,
 *  afferentW = 10, efferentW = 7 (model widths), jg 0..1 (granular cells, renin), focus: [segment keys
 *  or 'glom'], tissue = true, g = 1 (medulla saltiness; a loop diuretic washes it toward 0),
 *  capillaries = true, radial = true, others = true (other nephrons draining into the duct),
 *  phase (red cells in the capillaries), emphasis, parts, key }. Native 300 x 380, top-left.
 *  Parts: cortex medulla radial-artery afferent efferent jg glomerulus (with nephron) proximal, loop
 *  descending, loop thin-ascending, loop tal, macula-densa, distal, collecting, capillary, vasa-recta.
 *  Returns Art plus widths, along(key, s) (picture point and normal), geometry. */
export function walledTubule(opts = {}) {
  const { x = 0, y = 0, s = 1, rot = 0, flip = false, juxtamedullary = true, afferentW = 10, efferentW = 7, jg = 0, focus = [],
    tissue = true, g = 1, capillaries = true, radial = true, others = true, phase = 0, emphasis = [], parts = {}, key } = opts;
  const base = opts.geom || NEPHRON_GEOM, geom = juxtamedullary ? base : { ...base, ...CORTICAL };
  const NG = nephronGeometry(geom), M = mapper({ x, y, s, rot, flip });
  const id = idMaker(key), P_ = n => partAttr(parts, n), w = t => f((SW[t] ?? t) / s);
  const lit = k => !focus.length || focus.includes(k);
  const dim = k => lit(k) ? '' : ' opacity=".35"';
  const layer = (d, wd, col, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(wd)}" stroke-linecap="butt" stroke-linejoin="round"${extra}/>`;
  const capTube = (pts, lumenCol, wd = 6.5, lw = 4, cut = false) => {
    const d = smooth(pts), C = P.capillary;
    const rbcs = framesOf(d, 13).slice(1, -1).map(([p, n], i) => {
      const t = Math.atan2(n[0], -n[1]) * 180 / Math.PI;
      return `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="1.9" ry="1.2" transform="rotate(${f(t)} ${f(p[0])} ${f(p[1])})" fill="${P.rbc.rim}"/>`;
    });
    const shift = Math.floor(((phase % 1) + 1) % 1 * 2);
    const end = cut ? (() => { const q = framesOf(d, 1), [e, nn] = q[q.length - 1]; return cutFace(e[0], e[1], wd / 2, wd / 2 * 0.3, { wall: C, lumen: { base: lumenCol, cut: mix(lumenCol, P.ui.ink, 0.3) }, rot: Math.atan2(nn[1], nn[0]) * 180 / Math.PI, lumenR: lw / 2 }).svg; })() : '';
    return layer(d, wd, C.line) + layer(d, wd - 2 * SW.internal / s, C.base) + layer(d, lw, lumenCol)
      + `<g class="${D2}">${rbcs.filter((_, i) => (i + shift) % 2 === 0).join('')}</g>` + end;
  };
  // tissue: cortex, then the medulla saltier with depth (g = 1 normal; 0 washed out)
  const gid = id('kmed'), gg = clamp(g, 0, 1);
  const tissueSvg = tissue ? `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${geom.medullaTop}" x2="0" y2="${geom.H}"><stop offset="0" stop-color="${mix(TISSUE.cortex, TISSUE.outer, 0.35 + 0.65 * gg)}"/><stop offset="1" stop-color="${mix(TISSUE.cortex, TISSUE.inner, 0.2 + 0.8 * gg)}"/></linearGradient></defs>`
    + `<g ${P_('cortex')}><rect x="0" y="0" width="${geom.W}" height="${geom.medullaTop}" fill="${TISSUE.cortex}"/></g>`
    + `<g ${P_('medulla')}><rect x="0" y="${geom.medullaTop}" width="${geom.W}" height="${geom.H - geom.medullaTop}" fill="url(#${gid})"/>`
    + `<path d="M0 ${geom.innerTop} H${geom.W}" stroke="${TISSUE.edge}" stroke-opacity=".5" stroke-width="${w('detail')}" stroke-dasharray="3 5" class="${D3}"/></g>`
    + `<path d="M0 ${geom.medullaTop} H${geom.W}" stroke="${TISSUE.edge}" stroke-width="${w('internal')}" stroke-dasharray="6 5" class="${D2}"/>` : '';
  // vessels behind the tubule: radial artery, afferent with JG cells, efferent, capillaries
  const affD = smooth(geom.afferent), effD = smooth(geom.efferent);
  const art = (d, wd, cut) => tube(d, { wall: 'artery', lumen: 'oxy', w: wd, lumenW: Math.max(2, wd * 0.5), s, highlight: false, cut }).svg;
  const radialSvg = radial && geom.radial ? `<g ${P_('radial-artery')}>${art(smooth(geom.radial), 11, 'start')}</g>` : '';
  const pcId = id('kpc');
  const venous = mix(P.oxy.base, P.deoxy.base, 0.55);
  const vrSvg = capillaries && juxtamedullary && geom.vasaRecta ? (() => {
    const vr = geom.vasaRecta, mid = vr.findIndex(p => p[1] >= Math.max(...vr.map(q => q[1])) - 0.01);
    return `<g ${P_('vasa-recta')}${dim('vasa')}>${capTube(vr.slice(0, mid + 1), P.oxy.base, 7, 4.4)}${capTube(vr.slice(mid), venous, 7, 4.4, true)}</g>`;
  })() : '';
  const pcSvg = capillaries && geom.peritubular ? `<g ${P_('capillary')}${dim('capillary')}>${capTube(geom.peritubular.slice(0, 5), P.oxy.base)}${capTube(geom.peritubular.slice(4), mix(P.oxy.base, P.deoxy.base, 0.3), 6.5, 4, true)}</g>` : '';
  // JG granular cells: modified smooth muscle in the afferent wall at the vascular pole, renin granules
  const affFr = framesOf(affD, 1), jgPts = [15, 10, 5].map(d_ => affFr[Math.max(0, affFr.length - 1 - d_)]);
  const jgk = clamp(jg, 0, 1), jgCentre = jgPts[1][0];
  const jgSvg = `<g ${P_('jg')}>`
    + (jgk > 0 ? `<circle cx="${f(jgCentre[0])}" cy="${f(jgCentre[1])}" r="${f(9 + 6 * jgk)}" fill="${P.ui.blueWash}" fill-opacity="${f(0.75 * jgk)}"/>` : '')
    + jgPts.flatMap(([p, n]) => [1, -1].map(sd => {
      const q = add(p, n, sd * (afferentW / 2 - 0.4)), t = Math.atan2(n[0], -n[1]) * 180 / Math.PI;
      const gr = [-1.7, 0, 1.7].map(o => { const r = add(q, [Math.cos(t * Math.PI / 180), Math.sin(t * Math.PI / 180)], o); return `<circle cx="${f(r[0])}" cy="${f(r[1] + (o ? 0.6 : -0.6))}" r="${f(0.75 + 0.3 * jgk)}" fill="${RENIN.lo}" fill-opacity="${f(0.6 + 0.4 * jgk)}"/>`; }).join('');
      return `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="4.1" ry="2.9" transform="rotate(${f(t)} ${f(q[0])} ${f(q[1])})" fill="${mix(P.smooth.hi, RENIN.hi, 0.35)}" stroke="${P.smooth.line}" stroke-width="${w(0.8)}"/>${gr}`;
    })).join('')
    + (jgk > 0.25 ? Array.from({ length: Math.round(jgk * 4) }, (_, i) => { const fr = affFr[Math.round((0.93 + 0.02 * i) * (affFr.length - 1))] || affFr[affFr.length - 1]; const q = add(fr[0], fr[1], (i % 2 ? 1 : -1) * 1.2); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="1.2" fill="${RENIN.base}" stroke="${RENIN.line}" stroke-width="${w(0.5)}"/>`; }).join('') : '')
    + '</g>';
  // renal corpuscle: parietal Bowman capsule, Bowman space (filtrate), lobed tuft of capillary loops
  const Gc = geom.glom, R = geom.capsuleR, pole = geom.vascularPole, phi = Math.atan2(pole[1] - Gc[1], pole[0] - Gc[0]) * 180 / Math.PI;
  const rt = R - 7.5, tuftC = add(Gc, dir(phi), 1.5);
  const tuftPts = Array.from({ length: 64 }, (_, i) => { const a = phi + i * 360 / 64; return add(tuftC, dir(a), rt * (1 - 0.12 * Math.cos(4 * (a - phi) * Math.PI / 180) - 0.18 * Math.exp(-(((((a - phi + 540) % 360) - 180) / 26) ** 2)))); });
  const tuftD = smooth(tuftPts, { closed: true });
  // the afferent arteriole runs in through the vascular pole and divides into the loops; they gather into
  // the efferent arteriole beside it
  const aIn = add(Gc, dir(phi - 16), rt * 0.62), eIn = add(Gc, dir(phi + 16), rt * 0.62);
  const loops = [45, 135, 225, 315].map(o => {
    const a = phi + o;
    return smooth([aIn, add(tuftC, dir(a - 30), rt * 0.5), add(tuftC, dir(a - 16), rt * 0.86), add(tuftC, dir(a + 4), rt * 0.94), add(tuftC, dir(a + 22), rt * 0.78), add(tuftC, dir(a + 30), rt * 0.4), eIn]);
  });
  const affIn = smooth([...geom.afferent, aIn]), effIn = smooth([eIn, ...geom.efferent]);
  const podo = [45, 135, 225, 315].flatMap(o => [-24, 24].map(dd => {
    const a = phi + o + dd, q = add(tuftC, dir(a), rt * 0.9 + 1.2);
    return `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="3.3" ry="2.3" transform="rotate(${f(a + 90)} ${f(q[0])} ${f(q[1])})" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="${w(0.8)}"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r="1.1" fill="${P.nucleus.base}"/>`;
  })).join('');
  const capsuleSvg = `<g ${P_('nephron glomerulus')}${dim('glom')}>`
    + `<circle cx="${f(Gc[0])}" cy="${f(Gc[1])}" r="${R}" fill="${TUBULE.desc.base}" stroke="${TUBULE.pt.line}" stroke-width="${w('outline')}"/>`
    + `<circle cx="${f(Gc[0])}" cy="${f(Gc[1])}" r="${f(R - 2.6)}" fill="${P.space.filtrate}"/></g>`;
  const glomSvg = `<g ${P_('nephron glomerulus')}${dim('glom')}>`
    + `<path d="${tuftD}" fill="${P.capillary.base}" stroke="${P.capillary.line}" stroke-width="${w('internal')}"/>`
    + loops.map(d => layer(d, 4.6, P.capillary.line, ' stroke-linecap="round"')).join('') + loops.map(d => layer(d, 3, P.oxy.base, ' stroke-linecap="round"')).join('')
    + `<g class="${D2}">${podo}</g>`
    + '</g>';
  // tubule segments: outline, wall, lit edge, (water-tight lining), (brush border), lumen
  const segSvg = k => {
    const d = NG.seg[k];
    if (!d) return '';
    const m = TUBULE[k], [W_, LW] = TUBULE_W[k], brush = k === 'pt', tight = k === 'thin' || k === 'tal' || (!juxtamedullary && k === 'tal');
    const halo = focus.length && lit(k) ? layer(d, W_ + 10, P.ui.blueWash, ' stroke-linecap="round" stroke-opacity=".9"') : '';
    // the wall and lumen start 1.5 units back inside the previous segment, so the join shows no seam
    const back = (() => { const i = NG.order.indexOf(k); if (i <= 0) return d; const prev = framesOf(NG.seg[NG.order[i - 1]], 1); const q = prev[Math.max(0, prev.length - 2)][0]; return d.replace(/^M[^C]+/, `M${pt(q)} L${pt(samplePath(d, 2)[0])} `); })();
    let o = layer(d, W_, m.line) + layer(back, W_ - 2 * SW.outline / s * 0.85, m.base);
    o += `<path d="${litEdge(d, W_ / 2 - 1.9)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".32" stroke-width="${w(1.3)}" stroke-linecap="round" class="${D3}"/>`;
    // epithelial nuclei along both walls: the tubule reads as a ring of cells, not a hose
    const nOff = (W_ + LW) / 4, gap = k === 'desc' || k === 'thin' ? 11 : 6.5, nw = k === 'desc' || k === 'thin' ? 1.5 : 2.1;
    const nL = Math.max(24, Math.ceil(pathLength(d) / 2));
    o += `<path d="${offsetPath(d, nOff, nL)} ${offsetPath(d, -nOff, nL)}" fill="none" stroke="${P.nucleus.base}" stroke-opacity=".7" stroke-width="${f(nw)}" stroke-linecap="round" stroke-dasharray="0.01 ${gap}" class="${D2}"/>`;
    if (tight) o += layer(back, LW + 2.4 / s, m.line, ' class="ax-watertight"');
    if (brush) o += layer(back, LW, m.lo, ` stroke-dasharray="${f(0.9)} ${f(1.5)}" class="ax-brush ${D2}"`);
    o += layer(back, brush ? LW - 3 : LW, P.space.filtrate);
    return `${halo}<g data-seg="${k}" ${P_(SEG_NAMES[k])}${dim(k)}>${o}</g><!--/seg-->`;
  };
  // macula densa: the TAL's last cells, crowded tall nuclei on the side that touches the vascular pole
  const talFr = NG.seg.tal ? framesOf(NG.seg.tal, 1) : [];
  const mdIdx = Math.max(0, talFr.length - 6), mdPt = talFr.length ? talFr[mdIdx] : [[0, 0], [0, 1]];
  const towardG = (p, n) => dist(add(p, n, 1), Gc) < dist(add(p, n, -1), Gc) ? 1 : -1;
  const mdSide = talFr.length ? towardG(mdPt[0], mdPt[1]) : 1;
  const mdAt = add(mdPt[0], mdPt[1], mdSide * (TUBULE_W.tal[0] / 2 - 1));
  const mdSvg = talFr.length ? `<g ${P_('nephron loop tal macula-densa')}${dim('tal')}>` + Array.from({ length: 5 }, (_, i) => {
    const [p, n] = talFr[Math.max(0, talFr.length - 3 - i * 2.6 | 0)], q = add(p, n, mdSide * (TUBULE_W.tal[0] / 2 - 2.3)), t = Math.atan2(n[1], n[0]) * 180 / Math.PI;
    return `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="2" ry="1.05" transform="rotate(${f(t)} ${f(q[0])} ${f(q[1])})" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${w(0.5)}"/>`;
  }).join('') + '</g>' : '';
  // collecting duct, with the connecting tubules of other nephrons and the mouths that open into it
  const cdAbove = geom.cdAbove ? smooth(geom.cdAbove) : '', [CW, CLW] = TUBULE_W.cd;
  const otherSvg = others && geom.others ? geom.others.map(o => {
    const d = smooth(o), m = TUBULE.dct;
    return `<path data-other-nephron="" d="${d}" fill="none" stroke="${m.line}" stroke-width="${TUBULE_W.dct[0]}" stroke-opacity=".55"/><path data-other-nephron="" d="${d}" fill="none" stroke="${m.base}" stroke-width="${f(TUBULE_W.dct[0] - 2.4 / s)}" stroke-opacity=".7"/>`;
  }).join('') : '';
  const mouth = (pts, lw) => { const fr = framesOf(smooth(pts), 1), cut = fr.findIndex(([p]) => Math.abs(p[0] - geom.cd[0][0]) < CW / 2 + 1); return cut < 0 ? '' : layer(polyD(fr.slice(Math.max(0, cut - 1)).map(q => q[0])), lw, P.space.filtrate); };
  const cdSvg = (() => {
    const d = NG.seg.cd; if (!d) return '';
    const m = TUBULE.cd, halo = focus.length && lit('cd') ? layer(d, CW + 10, P.ui.blueWash, ' stroke-linecap="round" stroke-opacity=".9"') : '';
    let o = otherSvg;
    for (const dd of [cdAbove, d].filter(Boolean)) o += layer(dd, CW, m.line);
    for (const dd of [cdAbove, d].filter(Boolean)) o += layer(dd, CW - 2 * SW.outline / s * 0.85, m.base);
    o += `<path d="${litEdge(d, CW / 2 - 1.9)}" fill="none" stroke="${P.ui.white}" stroke-opacity=".32" stroke-width="${w(1.3)}" class="${D3}"/>`;
    for (const dd of [cdAbove, d].filter(Boolean)) o += layer(dd, CLW, P.space.filtrate);
    o += mouth(geom.dct.slice(-3), TUBULE_W.dct[1]);
    if (others && geom.others) o += geom.others.map(q => mouth(q, TUBULE_W.dct[1])).join('');
    return `${halo}<g data-seg="cd" ${P_(SEG_NAMES.cd)}${dim('cd')}>${o}</g><!--/seg-->`;
  })();
  const svg = `<g class="ax-nephron" transform="${M.tf}">${tissueSvg}${radialSvg}${vrSvg}${pcSvg}`
    + capsuleSvg + `<g ${P_('efferent')}>${art(effIn, efferentW)}</g><g ${P_('afferent')}>${art(affIn, afferentW)}</g>`
    + glomSvg + jgSvg
    + ['pt', 'desc', 'thin', 'tal', 'dct'].map(segSvg).join('') + mdSvg + cdSvg + '</g>';
  // anchors (native first, mapped below)
  const mid = k => NG.seg[k] ? NG.along(k, 0.5).slice(0, 2) : null;
  const bendK = juxtamedullary ? 'thin' : 'tal';
  const bend = (() => { const fr = framesOf(NG.seg[bendK] || NG.seg.desc, 1); return fr.reduce((a, b) => b[0][1] > a[1] ? b[0] : a, [0, -1]); })();
  const at = {
    glomerulus: tuftC, capsule: add(Gc, dir(phi + 180), R - 1.2), 'vascular-pole': pole, 'urinary-pole': geom.urinaryPole,
    afferent: samplePath(affD, 3)[1], efferent: samplePath(effD, 3)[1], jg: jgCentre, 'macula-densa': mdAt,
    proximal: NG.along('pt', 0.3).slice(0, 2), 'proximal-straight': NG.along('pt', 0.95).slice(0, 2), descending: mid('desc'),
    'thin-ascending': mid('thin'), tal: NG.along('tal', 0.4).slice(0, 2), distal: NG.along('dct', 0.5).slice(0, 2), collecting: NG.along('cd', 0.4).slice(0, 2),
    papilla: geom.cd[geom.cd.length - 1], bend, capillary: geom.peritubular ? samplePath(smooth(geom.peritubular), 5)[2] : null,
    'vasa-recta': capillaries && juxtamedullary && geom.vasaRecta ? geom.vasaRecta[3] : null, cortex: [40, geom.medullaTop - 14], medulla: [40, geom.innerTop + 30],
  };
  const mapped = Object.fromEntries(Object.entries(at).filter(([, p]) => p).map(([k, p]) => [k, M.map(p).map(f)]));
  const along = (k, sFrac) => { const q = NG.along(k, sFrac), p = M.map([q[0], q[1]]), o = M.map([0, 0]), n = M.map([q[2], q[3]]), nn = unit(sub(n, o)); return [f(p[0]), f(p[1]), f(nn[0]), f(nn[1])]; };
  return artOf(svg, M.boxOf([0, 0, geom.W, geom.H]), mapped,
    () => NG.order.map(k => NG.seg[k]).filter(Boolean).map(d => polyD(samplePath(d, 40).map(M.map))).join(' '),
    { widths: { afferent: afferentW, efferent: efferentW, ...Object.fromEntries(Object.entries(TUBULE_W).map(([k, v]) => [k, v[0]])) }, along, geometry: NG });
}

/* =====================================================================================================
 * tubuleCellRow
 * ===================================================================================================== */
export const ION_SIZE = 9;
// Each transporter: its kind of glyph, its membrane, and the ions it moves (to: 'cell' or 'out', where
// out is the lumen for an apical one and the interstitium and blood for a basolateral one).
const I = (ion, to) => ({ ion, to });
export const TRANSPORT = Object.freeze({
  sglt: { side: 'apical', glyph: 'carrier', ions: [I('na', 'cell'), I('glucose', 'cell')] },
  nhe3: { side: 'apical', glyph: 'carrier', ions: [I('na', 'cell'), I('h', 'out')] },
  nkcc2: { side: 'apical', glyph: 'carrier', wide: true, ions: [I('na', 'cell'), I('k', 'cell'), I('cl', 'cell'), I('cl', 'cell')] },
  ncc: { side: 'apical', glyph: 'carrier', ions: [I('na', 'cell'), I('cl', 'cell')] },
  enac: { side: 'apical', glyph: 'enac', ions: [I('na', 'cell')] },
  romk: { side: 'apical', glyph: 'romk', ions: [I('k', 'out')] },
  aqp2: { side: 'apical', glyph: 'aqp', ions: [I('water', 'cell'), I('water', 'cell')] },
  ca: { side: 'apical', glyph: 'enzyme', ions: [] },
  nak: { side: 'basolateral', glyph: 'pump', ions: [I('na', 'out'), I('na', 'out'), I('na', 'out'), I('k', 'cell'), I('k', 'cell')] },
  glut2: { side: 'basolateral', glyph: 'carrier', ions: [I('glucose', 'out')] },
  nbc: { side: 'basolateral', glyph: 'carrier', ions: [I('na', 'out'), I('hco3', 'out'), I('hco3', 'out'), I('hco3', 'out')] },
  clc: { side: 'basolateral', glyph: 'channel', ions: [I('cl', 'out')] },
  aqp: { side: 'basolateral', glyph: 'aqp', ions: [I('water', 'out')] },
});
/** Segment defaults: which transporters sit where, brush border, mitochondria, apical dome. */
export const SEGMENT_CELLS = Object.freeze({
  pct: { apical: ['sglt', 'nhe3'], basolateral: ['nak', 'glut2'], brush: true, mito: 6, dome: 0, mat: 'pt' },
  tal: { apical: ['nkcc2', 'romk'], basolateral: ['nak', 'clc'], brush: false, mito: 6, dome: 0, mat: 'tal' },
  dct: { apical: ['ncc'], basolateral: ['nak', 'clc'], brush: false, mito: 5, dome: 0, mat: 'dct' },
  principal: { apical: ['enac', 'romk', 'aqp2'], basolateral: ['nak', 'aqp'], brush: false, mito: 2, dome: 4, mat: 'cd' },
});

// Ion glyphs at a picture point (never rotated, so their shapes keep their meaning).
function ionGlyph(ion, [x, y], op = 1, sw = 1) {
  const o = op < 1 ? ` opacity="${f(op)}"` : '';
  const hi = (cx, cy, r) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${P.ui.white}" fill-opacity=".45"/>`;
  switch (ion) {
    case 'na': return `<g${o}><circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="${P.na.base}" stroke="${P.na.line}" stroke-width="${f(sw)}"/>${hi(x - 1.4, y - 1.5, 1.2)}</g>`;
    case 'k': return `<g${o}><path d="M${f(x)} ${f(y - 5.6)} L${f(x + 5.2)} ${f(y + 3.4)} L${f(x - 5.2)} ${f(y + 3.4)} Z" fill="${P.k.base}" stroke="${P.k.line}" stroke-width="${f(sw)}" stroke-linejoin="round"/>${hi(x - 1, y - 0.6, 1)}</g>`;
    case 'cl': return `<g${o}><path d="M${f(x)} ${f(y - 5)} L${f(x + 5)} ${f(y)} L${f(x)} ${f(y + 5)} L${f(x - 5)} ${f(y)} Z" fill="${P.cl.base}" stroke="${P.cl.line}" stroke-width="${f(sw)}" stroke-linejoin="round"/>${hi(x - 1.2, y - 1.2, 1)}</g>`;
    case 'h': return `<g${o}><circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="${P.h.base}" stroke="${P.h.line}" stroke-width="${f(sw)}"/><path d="M${f(x - 1.7)} ${f(y)} H${f(x + 1.7)} M${f(x)} ${f(y - 1.7)} V${f(y + 1.7)}" stroke="${P.ui.white}" stroke-width="1.1"/></g>`;
    case 'hco3': return `<g${o}>${[0, 120, 240].map(a => { const q = add([x, y], dir(a - 90), 2.6); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="2.3" fill="${P.hco3.base}" stroke="${P.hco3.line}" stroke-width="${f(sw * 0.8)}"/>`; }).join('')}<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${P.hco3.line}"/></g>`;
    case 'glucose': { const hex = Array.from({ length: 6 }, (_, i) => add([x, y], dir(i * 60 - 90), 5)); return `<g${o}><path d="${polyD(hex, true)}" fill="${P.glucose.base}" stroke="${P.glucose.line}" stroke-width="${f(sw)}" stroke-linejoin="round"/><circle cx="${f(hex[0][0])}" cy="${f(hex[0][1])}" r="1.5" fill="${P.oxygen.base}" stroke="${P.oxygen.line}" stroke-width=".6"/></g>`; }
    case 'water': return `<g${o}><path d="M${f(x)} ${f(y - 5.6)} C${f(x + 1.5)} ${f(y - 3)} ${f(x + 4.2)} ${f(y - 0.4)} ${f(x + 4.2)} ${f(y + 1.8)} C${f(x + 4.2)} ${f(y + 4.3)} ${f(x + 2.3)} ${f(y + 5.6)} ${f(x)} ${f(y + 5.6)} C${f(x - 2.3)} ${f(y + 5.6)} ${f(x - 4.2)} ${f(y + 4.3)} ${f(x - 4.2)} ${f(y + 1.8)} C${f(x - 4.2)} ${f(y - 0.4)} ${f(x - 1.5)} ${f(y - 3)} ${f(x)} ${f(y - 5.6)} Z" fill="${P.water.base}" stroke="${P.water.line}" stroke-width="${f(sw)}"/>${hi(x - 1.5, y + 1, 1.1)}</g>`;
    default: return '';
  }
}
// A rounded rectangle as points (p, q local), corners r.
function rrect(p0, q0, p1, q1, r) {
  const out = [], c = [[p1 - r, q0 + r, -90], [p1 - r, q1 - r, 0], [p0 + r, q1 - r, 90], [p0 + r, q0 + r, 180]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= 3; i++) out.push(add([cx, cy], dir(a0 + 30 * i), r));
  return out;
}
// Glyph shapes in (p, q): p along the membrane, q toward the outside of the cell (lumen for apical,
// interstitium for basolateral). Each is a list of [points, material key, closed].
function glyphShapes(kind) {
  const T = TRANSPORT[kind];
  if (T.glyph === 'carrier') { const hw = T.wide ? 10 : 8; return [[rrect(-hw, -8.5, -0.9, 8.5, 3.6), 'protein'], [rrect(0.9, -8.5, hw, 8.5, 3.6), 'protein']]; }
  if (T.glyph === 'channel') return [[rrect(-7.5, -8, -2.2, 8, 2.4), 'protein2'], [rrect(2.2, -8, 7.5, 8, 2.4), 'protein2']];
  if (T.glyph === 'enac') return [[rrect(-2.4, 7, 2.4, 14, 2.2), 'protein2back'], [rrect(-7.8, -8, -2.2, 8, 2.4), 'protein2'], [rrect(2.2, -8, 7.8, 8, 2.4), 'protein2'],
    [rrect(-10.5, 6.5, -2.4, 14.5, 3.8), 'protein2'], [rrect(2.4, 6.5, 10.5, 14.5, 3.8), 'protein2']];
  if (T.glyph === 'romk') return [[rrect(-7.5, -8, -2.2, 8, 2.4), 'protein2'], [rrect(2.2, -8, 7.5, 8, 2.4), 'protein2'], [rrect(-9.5, -16, -1.4, -7, 3.4), 'protein2'], [rrect(1.4, -16, 9.5, -7, 3.4), 'protein2']];
  if (T.glyph === 'aqp') return [[[[-8, -8], [-3.2, -8], [-1.1, 0], [-3.2, 8], [-8, 8]], 'protein2', true], [[[8, -8], [3.2, -8], [1.1, 0], [3.2, 8], [8, 8]], 'protein2', true]];
  if (T.glyph === 'pump') return [[rrect(-9, -18, 9, 8, 4), 'protein'], [rrect(9.6, -6, 13.4, 7, 1.8), 'protein2'], [[[11.5, 7], [11.5, 9.5]], 'glycoLine', false]];
  if (T.glyph === 'enzyme') return [];
  return [];
}

/** A row of tubule epithelial cells. Options: { x, y, s, w = 300, h = 170, n = 3, segment: 'pct' | 'tal'
 *  | 'dct' | 'principal', facing: 'up' (lumen above, default) | 'down' | 'left' | 'right', apical: [kinds]
 *  and basolateral: [kinds] (default from SEGMENT_CELLS; each kind or { kind, cell, at 0..1 }), repeat =
 *  false (every slot on every cell), brush (default by segment), capillary = true, ions = true,
 *  phase 0..1 (ions ride through, red cells drift; loops), flux: { kind: 0..1 }, block: { kind: 0..1 },
 *  aqp2 0..1 (inserted; 0 waits in vesicles), emphasis, parts, key }. Box w x h, top-left. Parts:
 *  lumen epithelium capillary interstitium, and one per transporter kind. at: lumen, capillary,
 *  epithelium, nucleus, apical, basolateral, each kind (its first slot), block-kind. */
export function tubuleCellRow(opts = {}) {
  const { x = 0, y = 0, s = 1, w = 300, h = 170, n = 3, segment = 'pct', facing = 'up', repeat = false, capillary = true, ions = true,
    phase = 0, flux = {}, block = {}, emphasis = [], parts = {}, key } = opts;
  const GS = opts.glyphScale ?? 1.3, SEG = SEGMENT_CELLS[segment] || SEGMENT_CELLS.pct, brush = opts.brush ?? SEG.brush, aqIns = clamp(opts.aqp2 ?? 1, 0, 1);
  const vertical = facing === 'left' || facing === 'right';
  const U = vertical ? h / s : w / s, V = vertical ? w / s : h / s; // local extent along the row, and from lumen to blood
  const fr = ([u, v]) => facing === 'down' ? [x + u * s, y + (V - v) * s] : facing === 'left' ? [x + v * s, y + u * s] : facing === 'right' ? [x + (V - v) * s, y + u * s] : [x + u * s, y + v * s];
  const D = (pts, close = false) => polyD(pts.map(fr), close), Sm = (pts, close = false) => smooth(pts.map(fr), { closed: close });
  const id = idMaker(key), P_ = k => partAttr(parts, k), em = k => emphasis.includes(k);
  const ph = ((phase % 1) + 1) % 1;
  // depths (local units, lumen at v = 0)
  const a = Math.min(34, V * 0.2), capH = capillary ? Math.min(36, V * 0.2) : 0, bm = V - capH - (capillary ? 22 : 14), capTop = V - capH;
  const cw = U / n, M = TUBULE[SEG.mat];
  const apV = u => { const i = clamp(Math.floor(u / cw), 0, n - 1), t = (u - i * cw) / cw; return a - SEG.dome * Math.sin(Math.PI * t); };
  // slots: each cell gets the slots whose index falls to it; with fewer slots than cells they cycle
  const norm = (list, side) => (list || SEG[side]).map(k => typeof k === 'string' ? { kind: k } : k);
  const place = (list, side) => {
    const out = [], L = norm(list, side);
    if (!L.length) return out;
    for (let i = 0; i < n; i++) {
      const mine = repeat ? L : L.length >= n ? L.filter((_, j) => j % n === i) : [L[i % L.length]];
      const explicit = L.filter(sl => sl.cell === i), use = L.some(sl => sl.cell != null) ? explicit : mine;
      use.forEach((sl, j) => out.push({ ...sl, side, cell: i, u: i * cw + cw * (sl.at ?? (j + 1) / (use.length + 1)) }));
    }
    return out;
  };
  const slots = [...place(opts.apical, 'apical'), ...place(opts.basolateral, 'basolateral')];
  // lumen, interstitium, capillary
  const lumen = `<g ${P_('lumen')}><path d="${D([[0, 0], [U, 0], [U, a + 6], [0, a + 6]], true)}" fill="${P.space.filtrate}"/></g>`;
  const inter = `<g ${P_('interstitium')}><path d="${D([[0, bm - 4], [U, bm - 4], [U, capillary ? capTop : V], [0, capillary ? capTop : V]], true)}" fill="${P.space.ecf}"/>`
    + `<path d="${D([[0, bm + 2.6], [U, bm + 2.6]])}" stroke="${P.adventitia.lo}" stroke-width="${f(1.6)}" class="${D2}"/></g>`;
  const capSvg = capillary ? (() => {
    const C = P.capillary, wall = 2.6, top = capTop, bot = V - 0.5, mid = (top + wall + bot) / 2, sp = 26;
    const rbc = []; for (let u = -sp + ph * sp; u < U + sp; u += sp) { const c = fr([u, mid + (Math.round(u / sp) % 2 ? 1.5 : -1.5)]); if (u > 4 && u < U - 4) rbc.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="5.4" fill="${P.rbc.rim}" stroke="${P.rbc.line}" stroke-width=".7"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="2.4" fill="${P.rbc.base}"/>`); }
    const nuc = []; for (let u = U * 0.22; u < U; u += U * 0.5) nuc.push(`<path d="${Sm([[u - 12, top + wall], [u, top + wall + 3.2], [u + 12, top + wall]])}" fill="${C.lo}" stroke="${C.line}" stroke-width=".8"/>`);
    return `<g ${P_('capillary')}><path d="${D([[0, top], [U, top], [U, V], [0, V]], true)}" fill="${P.plasma.base}"/>${rbc.join('')}`
      + `<path d="${D([[0, top], [U, top], [U, top + wall], [0, top + wall]], true)}" fill="${C.base}" stroke="${C.line}" stroke-width="${f(SW.internal)}"/><g class="${D2}">${nuc.join('')}</g></g>`;
  })() : '';
  // cells: cut faces, lateral membranes, tight junctions, nuclei, mitochondria, basal infoldings
  // cut faces of the cells: flat, a shade lighter at the apical side
  const cgId = id('kcell'), cgA = fr([0, a]), cgB = fr([0, bm]);
  const cells = [`<defs><linearGradient id="${cgId}" gradientUnits="userSpaceOnUse" x1="${f(cgA[0])}" y1="${f(cgA[1])}" x2="${f(cgB[0])}" y2="${f(cgB[1])}"><stop offset="0" stop-color="${M.hi}"/><stop offset="1" stop-color="${mix(M.hi, M.base, 0.45)}"/></linearGradient></defs>`], details = [], nuclei = [];
  for (let i = 0; i < n; i++) {
    const u0 = i * cw, u1 = u0 + cw, top = []; for (let k = 0; k <= 8; k++) { const u = u0 + cw * k / 8; top.push([u, apV(u)]); }
    cells.push(`<path data-cell="${i}" d="${D([...top, [u1, bm], [u0, bm]], true)}" fill="url(#${cgId})" stroke="${M.line}" stroke-opacity=".75" stroke-width="${f(SW.internal)}"/>`);
    const nr = Math.min(cw * 0.16, (bm - a) * 0.17), nc = [u0 + cw * 0.5, a + (bm - a) * 0.5];
    const nP = fr(nc);
    nuclei.push(`<circle cx="${f(nP[0])}" cy="${f(nP[1])}" r="${f(nr * s)}" fill="${P.nucleus.base}" stroke="${P.nucleus.line}" stroke-width="${f(SW.internal)}"/><circle cx="${f(nP[0] - nr * 0.3 * s)}" cy="${f(nP[1] - nr * 0.25 * s)}" r="${f(nr * 0.28 * s)}" fill="${P.nucleolus.base}"/>`
      + `<circle cx="${f(nP[0] - nr * 0.35 * s)}" cy="${f(nP[1] - nr * 0.4 * s)}" r="${f(nr * 0.45 * s)}" fill="${P.nucleus.hi}" fill-opacity=".45" class="${D2}"/>`);
    const busy = u => slots.some(sl => Math.abs(sl.u - u) < 13 * GS);
    for (let k = 0; k < SEG.mito; k++) {
      const u = u0 + cw * (k + 0.75) / (SEG.mito + 0.5), v = bm - 14 - (k % 2) * 3;
      if (busy(u) || Math.abs(u - nc[0]) < nr + 3) continue;
      const c = fr([u, v]), rotDeg = vertical ? 90 : 0;
      details.push(`<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(1.9 * s)}" ry="${f(6.2 * s)}" transform="rotate(${rotDeg} ${f(c[0])} ${f(c[1])})" fill="${P.mito.base}" stroke="${P.mito.line}" stroke-width=".8"/>`);
    }
    if (SEG.mito >= 5) for (let u = u0 + 5; u < u1 - 4; u += 6) if (!busy(u)) details.push(`<path d="${D([[u, bm], [u, bm - 7]])}" stroke="${M.line}" stroke-opacity=".5" stroke-width="${f(SW.detail)}" class="${D3}"/>`);
  }
  const lateral = Array.from({ length: n - 1 }, (_, i) => { const u = (i + 1) * cw; return `<path d="${D([[u, apV(u)], [u, bm]])}" stroke="${M.line}" stroke-width="${f(SW.internal)}"/><path d="${D([[u, apV(u) - 0.5], [u, apV(u) + 7]])}" stroke="${P.protein.line}" stroke-width="2.6" stroke-linecap="round"/>`; }).join('');
  // membranes: a two-line golden band, apical and basal
  const apPts = []; for (let k = 0; k <= n * 12; k++) { const u = U * k / (n * 12); apPts.push([u, apV(u)]); }
  const band = d => `<path d="${d}" fill="none" stroke="${P.bilayerCore.line}" stroke-width="3.4"/><path d="${d}" fill="none" stroke="${P.bilayerCore.base}" stroke-width="1.5"/>`;
  const membranes = band(D(apPts)) + band(D([[0, bm], [U, bm]]));
  // brush border: microvilli on the apical membrane, clear of the transporters
  const villi = [];
  if (brush) for (let u = 2; u < U - 1; u += 2.5) { if (slots.some(sl => sl.side === 'apical' && Math.abs(sl.u - u) < 11 * GS)) continue; villi.push(D([[u, apV(u) - 1.2], [u, apV(u) - 9.5]])); }
  const brushSvg = brush ? `<g class="ax-brush ${D3}"><path d="${villi.join(' ')}" fill="none" stroke="${P.bilayerCore.line}" stroke-width="1.7" stroke-linecap="round"/><path d="${villi.join(' ')}" fill="none" stroke="${P.bilayerCore.base}" stroke-width=".6" stroke-linecap="round"/></g>` : '';
  // transporters, enzyme, vesicles, ions
  const at = {}, slotSvg = [], ionSvg = [];
  const mats = { protein: [() => 'url(#ax-protein)', P.protein.line], protein2: [() => 'url(#ax-protein2)', P.protein2.line], protein2back: [() => P.protein2.lo, P.protein2.line] };
  slots.forEach((sl, si) => {
    const T = TRANSPORT[sl.kind]; if (!T) return;
    const apical = sl.side === 'apical', vm = apical ? apV(sl.u) : bm, sgn = apical ? -1 : 1; // q (outside) -> v
    const L = ([p, q]) => [sl.u + p * GS, vm + sgn * q * GS];
    let ins = 1, vesicle = '';
    if (sl.kind === 'aqp2') {
      ins = aqIns;
      if (ins < 1) {
        // aquaporin-2 waits in subapical vesicles until ADH inserts it
        const v = vm + 24 * (1 - ins), c = fr([sl.u, v]);
        vesicle = `<g data-vesicle="" opacity="${f(1 - ins * 0.9)}"><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(10.5 * s)}" fill="${P.bilayerCore.base}" stroke="${P.bilayerCore.line}" stroke-width="1.5"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(7.5 * s)}" fill="${M.hi}" stroke="${P.bilayerCore.line}" stroke-width="1"/>`
          + `<path d="${Sm([[sl.u - 3, v - 4], [sl.u - 1, v], [sl.u - 3, v + 4]])} ${Sm([[sl.u + 3, v - 4], [sl.u + 1, v], [sl.u + 3, v + 4]])}" fill="none" stroke="${P.protein2.line}" stroke-width="1.8"/></g>`;
      }
    }
    const shapes = glyphShapes(sl.kind).map(([pts, mk, close = true]) => {
      if (mk === 'glycoLine') return `<path d="${D(pts.map(L))}" stroke="${P.protein.line}" stroke-width="1.2"/>` + [9.5, 12.4].map(q => { const c = fr(L([11.5, q])); return `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="1.7" fill="${P.glyco.base}" stroke="${P.protein.line}" stroke-width=".6"/>`; }).join('');
      const [fl, ln] = mats[mk];
      return `<path d="${close ? D(pts.map(L), true) : D(pts.map(L))}" fill="${fl()}" stroke="${ln}" stroke-width="${f(SW.internal)}" stroke-linejoin="round"/>`;
    }).join('');
    let glyph = shapes;
    if (T.glyph === 'enzyme') {
      // carbonic anhydrase: a globular enzyme anchored to the luminal surface of the brush border
      const c = L([0, 15]), anchor = D([L([0, 1.5]), L([0, 9])]);
      glyph = `<path d="${anchor}" stroke="${P.protein2.line}" stroke-width="1.2"/><path d="${smooth(Array.from({ length: 10 }, (_, k) => add(fr(c), dir(k * 36), (6.4 + (k % 2 ? 0.9 : -0.4)) * s)), { closed: true })}" fill="url(#ax-protein2)" stroke="${P.protein2.line}" stroke-width="${f(SW.internal)}"/>`;
    }
    const cx = fr(L([0, T.glyph === 'enzyme' ? 15 : 0]));
    const blk = clamp(block[sl.kind] ?? 0, 0, 1);
    const blockSvg = blk > 0 ? (() => { const p1 = fr(L([-12, -12])), p2 = fr(L([12, 12])); return `<g data-block="${sl.kind}" opacity="${f(blk)}"><path d="M${pt(p1)} L${pt(p2)}" stroke="${P.ui.panel}" stroke-width="6.5" stroke-linecap="round"/><path d="M${pt(p1)} L${pt(p2)}" stroke="${P.ui.red}" stroke-width="3.5" stroke-linecap="round"/></g>`; })() : '';
    const insOp = sl.kind === 'aqp2' ? ins : 1;
    slotSvg.push(`<g data-slot="${sl.kind}" data-side="${sl.side}" ${P_(sl.kind)}>${vesicle}${insOp > 0 ? `<g${insOp < 1 ? ` opacity="${f(insOp)}"` : ''}>${glyph}</g>` : ''}${blockSvg}</g>`);
    if (!(sl.kind in at)) at[sl.kind] = cx;
    at[`${sl.kind}-${sl.cell}`] = cx;
    if (blk > 0) at[`block-${sl.kind}`] = cx;
    // ions: each rides its own lane from one side to the other; seeded so the row is not in lockstep
    const amt = clamp(flux[sl.kind] ?? 1, 0, 1) * (1 - blk) * insOp;
    if (ions && amt > 0 && T.ions.length) {
      const m = T.ions.length, hw = T.wide ? 6 : 4.6;
      T.ions.forEach((io, k) => {
        const p = T.glyph === 'carrier' || T.glyph === 'pump' ? (m === 1 ? 0 : lerp(-hw, hw, k / (m - 1)) * 0.35) : 0;
        const toCell = io.to === 'cell', q0 = toCell ? 21 : -21, q1 = -q0;
        const fz = (ph + k / m + si * 0.137) % 1;
        const op = amt * Math.min(1, fz / 0.18, (1 - fz) / 0.18);
        if (op <= 0.02) return;
        ionSvg.push(ionGlyph(io.ion, fr(L([p, lerp(q0, q1, fz)])), op));
      });
      // a quiet direction mark beside the glyph for each way the ions go (reads in a still)
      const ways = [...new Set(T.ions.map(io => io.to))];
      ways.forEach((to, k) => {
        const side = ways.length === 2 ? (k ? 1 : -1) : 1, p = side * ((T.wide ? 10 : 8) + 4.5), q0 = to === 'cell' ? 10 : -10;
        const A = fr(L([p, q0])), B = fr(L([p, -q0])), ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
        ionSvg.push(`<g opacity="${f(amt * 0.85)}" class="${D2}"><path d="M${pt(A)} L${pt(B)}" stroke="${P.ui.muted}" stroke-width="${f(SW.leader)}" stroke-linecap="round"/><path d="${chevronD(B[0], B[1], ang, 4)}" fill="none" stroke="${P.ui.muted}" stroke-width="${f(SW.leader)}" stroke-linecap="round" stroke-linejoin="round"/></g>`);
      });
    }
  });
  const epi = `<g ${P_('epithelium')}>${cells.join('')}${lateral}<g class="${D2}">${details.join('')}</g>${nuclei.join('')}${membranes}${brushSvg}</g>`;
  const svg = `<g class="ax-tubule-cells">${lumen}${inter}${capSvg}${epi}${slotSvg.join('')}${ionSvg.join('')}</g>`;
  const box = vertical ? [x, y, V * s, U * s] : [x, y, U * s, V * s];
  Object.assign(at, {
    lumen: fr([U / 2, a * 0.4]), capillary: fr([U / 2, capillary ? (capTop + V) / 2 : (bm + V) / 2]), interstitium: fr([U / 2, (bm + (capillary ? capTop : V)) / 2]),
    epithelium: fr([U / 2, (a + bm) / 2]), nucleus: fr([cw * (Math.floor(n / 2) + 0.5), a + (bm - a) * 0.5]), apical: fr([U / 2, apV(U / 2)]), basolateral: fr([U / 2, bm]),
  });
  return artOf(svg, box.map(f), Object.fromEntries(Object.entries(at).map(([k, p]) => [k, p.map(f)])),
    () => D([...apPts, [U, bm], [0, bm]], true), { slots: slots.map(sl => ({ kind: sl.kind, side: sl.side, cell: sl.cell, at: at[`${sl.kind}-${sl.cell}`] })) });
}
