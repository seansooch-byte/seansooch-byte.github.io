// The Lab's shared illustration library: the foundation every art module and redrawn lesson uses.
// One palette, one light, one line system (the art direction, sections 2 to 5). Plain ES module, no
// dependencies; import it unversioned by one spelling, /lab/kit/art/core.js (or ./core.js from a
// sibling), so a page never holds two copies with two id counters.
//
// Expected behaviour (each item is tested by tools/lab-art-test.mjs):
//   - P holds every hex the art uses; art modules and redrawn lessons name P entries, never literals.
//   - Ids the library makes start with ax-. A string scene goes through the kit's svg() (or scopeArt()),
//     a mount scene through artContext(svgEl): both prefix every ax- id per picture and add only the
//     shared defs the markup uses, so a hidden step's defs never shadow a visible step's.
//   - Weight strokes (SW) keep their on-screen weight at any scale; geometry strokes (tube walls and
//     lumens) are model widths and are never compensated.
//   - Detail elements carry D2 / D3; kit.css hides them in small pictures with a container query.
//   - Every primitive returns an Art: { svg, box: [x, y, w, h], at: { name: [x, y] }, outline(state) },
//     whose toString() is its svg, so `${art}` works inside a template string.
//   - Path helpers are pure: smooth (Catmull-Rom to cubic), lerpPath (matched or resampled), offsetPath,
//     sampleAlong, samplePath, areaOf.
//   - Labels are laid out once per scene with measured widths (metrics.js), never per frame.
import { CHARS, W500, W700 } from './metrics.js';

/* ---------- palette (art direction section 2; the tables' exact values) ---------- */
const m = (hi, base, lo, line, extra) => ({ ...(hi && { hi }), base, ...(lo && { lo }), ...(line && { line }), ...extra });
export const P = {
  ui: {
    ink: '#171916', blue: '#254dff', blueWash: '#d1d8fd', red: '#b3261e', redWash: '#f3d9d4', amber: '#a34700',
    green: '#2c6a2c', purple: '#6b3fa0', muted: '#53584d', ghost: '#8a8f84', rule: '#babeb3', panel: '#ecefe5',
    paper: '#f7f7f2', teal: '#0b6b70', white: '#ffffff',
  },
  // blood
  oxy: m('#e2685b', '#c8352f', '#8e1e1f', '#6e1518', { cut: '#7a1a1a' }),
  deoxy: m('#6f84c0', '#3e5196', '#24305e', '#1b2448', { cut: '#24305e' }),
  plasma: m('#f8e6cf', '#f2dcc0', '#e0c39f', '#b08a5e'),
  rbc: { base: '#e0705f', rim: '#c0342d', line: '#7d1d1c', deoxyRim: '#8a3a52', deoxyCentre: '#b0697e', deoxyLine: '#562b37' },
  // Rows promoted from the library modules (2026-11-13). Each was mixed from the rows above at load; the
  // values are those mixes, written out so P stays the one source of hex. Recipe in each comment.
  // lymph in a lymphatic lumen: plasma hi 45 % toward white (vessels.js)
  lymph: m('#ffffff', '#fbf1e5', '#f2dcc0', '#b08a5e', { cut: '#e0c39f' }),
  // globin subunits (blood.js hemoglobin): rbc base 50 % (alpha) and 27 % (beta) toward white; hi 40 % white,
  // lo 30 % toward oxy lo, line 62 % toward oxy line. heme: the porphyrin plate; iron: na lightened 12 %.
  hbAlpha: m('#f6d4cf', '#f0b8af', '#d38a84', '#9f5351'),
  hbBeta: m('#f1c1b9', '#e8978a', '#cd736a', '#9c4643'),
  heme: { hi: '#c8352f', base: '#8e1e1f', line: '#6e1518' },
  iron: { base: '#e4a644', line: '#7f3e13' },

  // tissues and organs. myo carries the worked heart's cut-face and rim stops (ART-REFERENCE, revision 2).
  myo: m('#efc6b4', '#d9a08f', '#a86a5c', '#6e3a30', { cut: '#dca796', cutEdge: '#c98b79', epiMid: '#d39684', epiLo: '#9c5a4a', papLine: '#8f5546', rvot: '#d29a88' }),
  septum: m(null, '#cb8d7b', null, '#6e3a30'),
  skeletal: m('#e3a49a', '#c46b62', '#8f3d38', '#5e2522'),
  smooth: m('#f0c2b0', '#dc9c88', '#b06b5a', '#7d4536'),
  artery: m('#f6dfd6', '#ecc9bd', '#c9958a', '#8a4a40'),
  intima: m('#fbf1ec', '#f8ece6', '#e8d2c8', '#b98a80'),
  adventitia: m('#f2e6d6', '#e7d6c3', '#c9b49a', '#8f7a5e'),
  vein: m('#eef0f6', '#d6dbe8', '#aeb6cc', '#4a5378'),
  // internal and external elastic laminae: artery lo 35 % toward artery line (vessels.js)
  elastic: { base: '#b37b70', line: '#8a4a40' },
  capillary: m('#f8e3dd', '#f3d7d0', '#d9aea4', '#a8655c'),
  // cord: chordae tendineae, a little lighter than the leaflet outline so they read as cords, not scratches
  valve: m('#fbf3e4', '#efe1c8', '#e3d0b0', '#8a6d4e', { cord: '#a4896a' }),
  conduction: m('#f2d77a', '#e2c044', '#b8952a', '#7a5a00'),
  cytoplasm: m('#fdf3ec', '#f6e3d6', '#e9c9b5', '#a9826a'),
  nucleus: m('#97a1c4', '#6b78a6', '#4c5682', '#343c5e'),
  nucleolus: m(null, '#3f4870', null, '#272d48'),
  mito: m('#d98a5a', '#f2b98f', '#b8643a', '#8a4a26'),
  er: m(null, '#c6b6e0', null, '#7d6aa8'),
  lipid: m('#fdf0c2', '#f7e3a3', '#e0c46e', '#a8892f'),
  boneCortical: m('#fbf6e9', '#efe3c6', '#cdb98e', '#8f7a52'),
  boneTrabecular: m(null, '#e6d6b0', null, '#8f7a52'),
  marrow: m('#de8a7c', '#c9665a', '#9a4038', '#6e2a24'),
  cartilage: m('#ebf3f5', '#d9e6ea', '#b4c9cf', '#7f9aa3'),
  nerve: m('#fff7d6', '#f6e3a2', '#d9bd6a', '#8f7430'),
  myelin: m('#ffffff', '#fbfbf3', '#e6e4d2', '#a9a58a'),
  grey: m('#f1d9d4', '#e6c3bd', '#c79a93', '#8f625c'),
  whiteMatter: m(null, '#f7eee8', null, '#c9b2a8'),
  pitAnterior: m('#e8b49a', '#d99a7a', '#b0705a', '#7a4634'),
  pitPosterior: m('#f2dcc4', '#e8c9a8', '#c9a47e', '#8a6a4a'),
  thyroid: m('#d77b6e', '#b8574e', '#8a3a33', '#5e2420'),
  colloid: m(null, '#f3d39a', null, '#b8924a'),
  parathyroid: m('#f0cc78', '#e0b04f', '#b48828', '#7a5a10'),
  adrenalCortex: m('#f5d27a', '#e8b84a', '#c08f2a', '#7d5a10'),
  adrenalMedulla: m('#b87a5a', '#9a5a3a', '#6e3a22', '#4e2614'),
  kidneyCortex: m('#c9705f', '#b05445', '#7d3229', '#5a2018'),
  kidneyMedulla: m('#a24a40', '#8f3a33', '#6f2a25', '#4e1a16'),
  // nephron segments (kidney.js TUBULE): proximal sage, thin limbs pale, thick ascending limb warm, distal
  // teal, collecting duct slate; hi 45 % white, lo 16 % and line 55 % toward ink (thin line: cytoplasm line 20 %)
  tubulePt: m('#d5e1d5', '#b2c9b2', '#99ad99', '#5d685c'),
  tubuleThin: m('#fcf4ef', '#faebe1', '#d6c9c1', '#8c6d59'),
  tubuleTal: m('#e5c2b1', '#cf9072', '#b27d63', '#6a4f3f'),
  tubuleDct: m('#bcd3d0', '#85afaa', '#739792', '#495d59'),
  tubuleCd: m('#c3cbe0', '#92a0c7', '#7e8aab', '#4e5666'),
  pelvis: m('#f8ecdc', '#f0dcc8', '#d6bc9e', '#a68a6a'),
  liver: m('#b8574a', '#8f3b33', '#63241f', '#4a1814'),
  gallbladder: m(null, '#7f9a4a', null, '#4a5e22'),
  pancreas: m('#f8dfbd', '#efc9a0', '#d6a774', '#9a7040'),
  islet: m(null, '#f6e6d0', null, '#b89a6a'),
  mucosa: m('#f2aaa2', '#e58c86', '#c86b66', '#8a3e3a'),
  muscularis: m('#efb7aa', '#e8a59a', '#c9776c', '#8a4a40'),
  mucus: m('#e6f4f1', '#d6ece9', '#aacfc8', '#6f9f97', { opacity: 0.8 }),
  lung: m('#f7d3cf', '#eab3ad', '#c98480', '#a85c58'),
  alveolarWall: m(null, '#e79a93', null, '#a85c58'),
  epidermis: m('#f8dccb', '#f0c7a8', '#d9a582', '#9a6a48'),
  corneum: m(null, '#e2b48f', null, '#9a6a48'),
  dermis: m('#fbe9e1', '#f6dcd0', '#e3bfb0', '#a9806e'),
  collagen: m(null, '#e8bfb3', null, null, { opacity: 0.5 }),
  bacterium: m('#eef3df', '#d6e2b6', '#a9bb7f', '#5e6e34'),
  peptidoglycan: m('#e4cc8a', '#c8a75a', '#9a7a30', '#6a5016'),
  neutrophil: m(null, '#f3e3ea', null, '#a87f93', { granule: '#d7a7c5' }),
  lymphocyte: m(null, '#d6e4f2', null, '#7f93a8'),
  macrophage: m(null, '#efdcc8', null, '#a6825e'),
  plasmaCell: m(null, '#cfd6ef', null, '#7c86b0'),
  platelet: m('#f6eef9', '#e4d3ee', '#c3a9d6', '#7d5a9a', { granule: '#8e6bb5' }),
  fibrin: m(null, '#f1e4a8', null, '#9a8a3a'),
  // inflammatory exudate (alveolar fluid in lung.js): the fibrin tone
  exudate: m(null, '#f1e4a8', null, '#9a8a3a'),
  // membranes
  lipidHead: m('#fff1d8', '#f2c98a', '#c9974f', '#9a6e33'),
  lipidTail: { base: '#f6edd8', line: '#c8b48e' },
  bilayerCore: { base: '#f6edd8', line: '#c9974f' },
  protein: m('#cfe0d2', '#9fc2a8', '#6e9a7a', '#3e6a4a'),
  protein2: m('#d9d4ee', '#b3a9dc', '#8478b8', '#4e4486'),
  glyco: { base: '#e8d48a' },
  // renin and ACE are enzymes: the alternate membrane-protein material (section 2.5)
  renin: m('#d9d4ee', '#b3a9dc', '#8478b8', '#4e4486'),
  // ions and small molecules (section 2.5)
  na: { base: '#e09a2b', line: '#8a5a10' }, k: { base: '#4c9a3f', line: '#24561c' }, ca: { base: '#12838a', line: '#0a4f54' },
  cl: { base: '#8a9bb0', line: '#4a5a6e' }, h: { base: '#d23f78', line: '#7a1a44' }, hco3: { base: '#1e9ac0', line: '#0c5a73' },
  po4: { base: '#b98a3a', line: '#6a4a12' }, oxygen: { base: '#e45b4f', line: '#8e1e1f' }, carbon: { base: '#4a4f57', line: '#2b2e33' },
  water: { base: '#8cc8e8', line: '#2f6f94' }, glucose: { base: '#f0b429', line: '#8a6100' },
  // molecules.js: Mg2+ pentagon (k and glucose mixed; line 55 % toward ink), the disulfide sulfur (glucose 15 %
  // toward white), and the nucleotide parts: adenine (nucleus 30 % toward white) and ribose (glucose 50 %)
  mg: { base: '#9ea734', line: '#545924' }, sulfur: { base: '#f2bf49', line: '#8a6100' },
  adenine: { base: '#97a1c1', line: '#343c5e' }, ribose: { base: '#f8da94', line: '#8a6100' },
  drug: { hi: '#b59be0', base: '#8a63c2', line: '#4b2a78' },
  // messengers. line: base mixed 55 % toward ink (molecules.js outlines; one line per messenger course-wide)
  ach: { base: '#c2577a', line: '#643543' }, noradrenaline: { base: '#9a6a1a', line: '#523d18' }, histamine: { base: '#e07b39', line: '#714526' }, insulin: { base: '#2a7f62', line: '#204738' },
  glucagon: { base: '#8a3a2a', line: '#4b281f' }, glp1: { base: '#7a8a2a', line: '#444c1f' }, adh: { base: '#5f86a8', line: '#374a58' }, angiotensin: { base: '#b0603a', line: '#5c3926' },
  aldosterone: { base: '#3f8f5f', line: '#294e37' }, cortisol: { base: '#d08a1a', line: '#6a4c18' }, cholesterol: { base: '#c9b48e', line: '#675f4c' },
  thyronine: { base: '#c98a2a', line: '#674c1f', iodine: '#7a3fa0' }, tsh: { base: '#8f6ac0', line: '#4d3d62' }, acth: { base: '#c06a8f', line: '#633d4c' }, crh: { base: '#6aa0c0', line: '#3c5662' },
  trh: { base: '#6ac08f', line: '#3c644c' }, pth: { base: '#7f5ab8', line: '#46365f' }, calcitriol: { base: '#c9a227', line: '#67571e' }, calcitonin: { base: '#3f8f8f', line: '#294e4c' },
  prostaglandin: { base: '#d08a3a', line: '#6a4c26' }, thromboxane: { base: '#b85a5a', line: '#5f3635' }, leukotriene: { base: '#5a8ab8', line: '#354c5f' },
  tnf: { base: '#d4733a', line: '#6c4226' }, il2: { base: '#9a6ac0', line: '#523d62' }, arachidonic: { base: '#b8892a', line: '#5f4b1f' },
  // fluids and spaces: flat tints, no gradient
  space: { ecf: '#e2ecec', filtrate: '#f4ecc4', gutLumen: '#efe3c8', air: '#f4f9fb', paper: '#f7f7f2', lensRim: '#53584d',
    // renal interstitium tints (kidney.js): cortex hi 80 %, outer medulla hi 76 %, inner medulla base 50 % toward
    // the panel; the zone edge is cortex line 55 % toward the panel
    renalCortex: '#e5d6ca', renalOuter: '#dac7bd', renalInner: '#be958c', renalEdge: '#aa9289' },
};

/* ---------- strokes, detail, numbers, colour ---------- */
export const SW = { outline: 1.75, internal: 1.1, detail: 0.9, leader: 1.25 };
// A weight stroke at scale s keeps its on-screen weight.
export const sw = (tier, s = 1) => +((SW[tier] ?? tier) / s).toFixed(3);
export const D2 = 'ax-d2', D3 = 'ax-d3';
export const f = n => +(+n).toFixed(2);
export const pt = p => `${f(p[0])} ${f(p[1])}`;
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, k) => '#' + hex2(a).map((v, i) => Math.round(v + (hex2(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
export const fill = mat => `url(#ax-${mat})`;
let uidN = 0;
// Ids are names: a key with spaces or punctuation is folded to hyphens (an id with a space breaks url()).
export const uid = (base, key) => key != null ? `ax-${base}-${String(key).replace(/[^A-Za-z0-9_-]+/g, '-')}` : `ax-${base}-${++uidN}`;

/* ---------- shared defs and per-picture id scoping (section 5) ---------- */
const SHARED = {};
for (const [k, v] of Object.entries(P)) if (v && v.hi && v.base && v.lo) SHARED[k] = 'grad';
SHARED.lift = 'filter';
function defFor(name) {
  if (name === 'lift') return '<filter id="ax-lift" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-opacity=".22"/></filter>';
  const c = P[name];
  // One objectBoundingBox radial per material, for small glyphs that are never rotated (section 2.6).
  return `<radialGradient id="ax-${name}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${c.hi}"/><stop offset=".6" stop-color="${c.base}"/><stop offset="1" stop-color="${c.lo}"/></radialGradient>`;
}
// The defs a body uses: a markup string (scanned for url(#ax-name)) or a Set of ids ('ax-name').
export function artDefs(used) {
  const names = new Set();
  if (typeof used === 'string') { for (const x of used.matchAll(/url\(#ax-([A-Za-z0-9]+)\)/g)) names.add(x[1]); }
  else for (const id of used) names.add(String(id).replace(/^ax-/, ''));
  return [...names].filter(n => SHARED[n]).map(defFor).join('');
}
export const scopeIds = (markup, prefix) => markup.replace(/(id="|url\(#|href="#)ax-/g, `$1${prefix}ax-`);
let sceneN = 0;
// For a finished SVG string from any svg() (the kit's own, old or new): prefix its ax- ids and add the
// shared defs it uses. Idempotent: a string that already carries scoped art defs comes back unchanged.
export function scopeArt(svgString) {
  if (/<defs data-ax/.test(svgString) || !/(id="|url\(#|href="#)ax-/.test(svgString)) return svgString;
  const prefix = `ax${++sceneN}-`, defs = scopeIds(artDefs(svgString), prefix);
  return scopeIds(svgString, prefix).replace(/^(\s*<svg\b[^>]*>)/, `$1<defs data-ax="">${defs}</defs>`);
}
// The kit's svg() (lab/kit/draw.js) calls this when a body uses art ids: no import between the two files,
// so a cached copy of either still works with the other.
globalThis.LabArtDefs = (body, prefix) => `<defs data-ax="">${scopeIds(artDefs(body), prefix)}</defs>`;
let ctxN = 0;
// For a mount scene, or a lesson that builds its own <svg>: one prefix per svg, defs added once each,
// and html() to place string primitives scoped to the same prefix.
export function artContext(svgEl) {
  if (svgEl.__axCtx) return svgEl.__axCtx;
  const prefix = `ax${++ctxN}m-`, NS = svgEl.namespaceURI, have = new Set();
  let defs = svgEl.querySelector(':scope > defs[data-ax]');
  if (!defs) { defs = svgEl.ownerDocument.createElementNS(NS, 'defs'); defs.setAttribute('data-ax', ''); svgEl.prepend(defs); }
  const ensure = markup => {
    const need = [];
    for (const x of markup.matchAll(/url\(#ax-([A-Za-z0-9]+)\)/g)) if (SHARED[x[1]] && !have.has(x[1])) { have.add(x[1]); need.push(x[1]); }
    if (need.length) defs.insertAdjacentHTML('beforeend', scopeIds(need.map(defFor).join(''), prefix));
  };
  const ctx = {
    prefix, svg: svgEl,
    url: mat => { ensure(`url(#ax-${mat})`); return `url(#${prefix}ax-${mat})`; },
    id: (base, key) => prefix + uid(base, key),
    // Parse markup into the SVG namespace at the end of parent; returns the elements added.
    html(parent, markup) {
      ensure(markup);
      const before = parent.childNodes.length;
      parent.insertAdjacentHTML('beforeend', scopeIds(String(markup), prefix));
      return [...parent.childNodes].slice(before).filter(n => n.nodeType === 1);
    },
  };
  svgEl.__axCtx = ctx;
  return ctx;
}

/* ---------- the Art type and placement ---------- */
export function artOf(svg, box, at = {}, outline = () => '', extra = {}) {
  return { svg, box, at, outline, ...extra, toString() { return this.svg; } };
}
// The common placement { x, y, s, rot, flip } (section 4.0b) as functions, so a primitive maps its own
// geometry, outline() and at points with the same numbers place() uses. origin: the native point that lands
// on (x, y) (default 0 0). map(point); mapD(path) maps every coordinate pair of an absolute M L C Q S T Z path
// in place (any other path is read by parsePath and written out as absolute M L C Q); boxOf(box) is the
// placed box's bounds; tf the transform attribute; angle(deg) turns a direction; wrap(svg) is one <g>.
export function placer({ x = 0, y = 0, s = 1, rot = 0, flip = false } = {}, origin = [0, 0]) {
  const a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), [ox, oy] = origin;
  const map = ([px, py]) => { const sx = (flip ? -(px - ox) : px - ox) * s, sy = (py - oy) * s; return [x + sx * c - sy * sn, y + sx * sn + sy * c]; };
  const mapD = d => {
    if (!/^[MLCQSTZ\d\s,.eE+-]*$/.test(d)) return pathOf(parsePath(d), map);
    return d.replace(/(-?\d*\.?\d+(?:e-?\d+)?)[ ,]+(-?\d*\.?\d+(?:e-?\d+)?)/g, (_, u, v) => pt(map([+u, +v])));
  };
  const boxOf = ([bx, by, bw, bh]) => {
    const cs = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(map), xs = cs.map(q => q[0]), ys = cs.map(q => q[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(f);
  };
  const tf = `translate(${f(x)} ${f(y)})${rot ? ` rotate(${f(rot)})` : ''}${s !== 1 || flip ? ` scale(${flip ? -f(s) : f(s)} ${f(s)})` : ''}${ox || oy ? ` translate(${f(-ox)} ${f(-oy)})` : ''}`;
  return {
    map, mapD, boxOf, tf, x, y, s, rot, flip, origin,
    angle: deg => flip ? 180 - deg + rot : deg + rot,
    wrap: svg => `<g transform="${tf}">${svg}</g>`,
    identity: !x && !y && s === 1 && !rot && !flip && !ox && !oy,
  };
}
// Wrap an Art in one transform and map its box and anchors into picture coordinates.
export function place(art, opts = {}, origin) {
  const m = placer(opts, origin);
  const at = Object.fromEntries(Object.entries(art.at).map(([k, p]) => [k, m.map(p)]));
  return artOf(m.wrap(art.svg), m.boxOf(art.box), at, art.outline, { mouth: art.mouth });
}
// A part name with the lesson's renames (parts), split into words, each written once: "heart lv" with
// { lv: 'ventricle' } is "heart ventricle". names may be a string or an array. Every module names its
// leaf groups through these, so one rename rule holds across the library.
export const partName = (parts = {}, names) => [...new Set((Array.isArray(names) ? names : [names]).flatMap(n => String(n).split(/\s+/)).filter(Boolean).map(k => parts[k] || k).flatMap(n => String(n).split(/\s+/)))].join(' ');
export const partAttr = (parts, names) => `data-part="${partName(parts, names)}"`;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- light and shading (section 2.6) ---------- */
// User-space gradient coordinates for an exterior: the picture's one light is at the upper left.
export const light = ([x, y, w, h]) => ({ x1: f(x + w * 0.1), y1: f(y), x2: f(x + w * 0.85), y2: f(y + h) });
export function volumeGradient(id, mat, box, { stops } = {}) {
  const c = typeof mat === 'string' ? P[mat] : mat, l = light(box);
  const st = stops || [[0, c.hi], [0.5, c.epiMid || c.base], [1, c.epiLo || c.lo]];
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}">${st.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('')}</linearGradient>`;
}
// A cut face: flat, darkening slightly toward the outside (a large user-space radial).
export function cutGradient(id, [cx, cy], r, from, to) {
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"><stop offset=".5" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></radialGradient>`;
}
const HEX = /#[0-9a-fA-F]{6}\b/g;
// Depth tier: mix every colour of a structure that passes behind others k toward the panel.
export function behind(art, k = 0.3) {
  const go = s => s.replace(HEX, h => mix(h, P.ui.panel, k));
  return typeof art === 'string' ? go(art) : artOf(go(art.svg), art.box, art.at, art.outline);
}
export const occlusionBreak = (d, w = 2) => `<path d="${d}" fill="none" stroke="${P.ui.panel}" stroke-width="${w}" stroke-linecap="butt"/>`;
// The endocardial (inner-edge) shadow: the cavity's lo at 45 %, a 5-unit stroke clipped to the cavity.
export function innerShadow(d, mat, id, { w = 5, opacity = 0.45, cls = '' } = {}) {
  const c = typeof mat === 'string' ? P[mat] : mat;
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="none" stroke="${c.lo}" stroke-opacity="${opacity}" stroke-width="${w}" clip-path="url(#${id})"${cls ? ` class="${cls}"` : ''}/>`;
}
// The exterior rim around a cut organ: an outline and a volume-lit band, drawn before the cut face.
export function rim(d, mat, gradId, { w = 3, s = 1 } = {}) {
  const c = typeof mat === 'string' ? P[mat] : mat;
  return `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="${f(2 * w + 2 * SW.outline / s)}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="url(#${gradId})" stroke-width="${f(2 * w)}" stroke-linejoin="round"/>`;
}
export const spec = (x, y, rx, ry, rot = 0) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : ''} fill="#ffffff" fill-opacity=".2"/>`;
export function contactShade(d, mat) { const c = typeof mat === 'string' ? P[mat] : mat; return `<path d="${d}" fill="none" stroke="${c.lo}" stroke-opacity=".35" stroke-width="2.5"/>`; }

/* ---------- path geometry ---------- */
// Absolute and relative M L H V C S Q T A Z. S and T reflect the previous control point; an arc is
// written as cubics (at most 90 degrees each), so every segment is L, Q or C. A Z closes with an L back to
// the subpath's start (when it is not there already) and then a { t: 'Z' } marker.
const TAU = 2 * Math.PI;
function arcCubics(p0, rx, ry, phi, large, sweep, p1) {
  if (!rx || !ry) return [[p0, p0, p1, p1]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const c = Math.cos(phi), s = Math.sin(phi), dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = c * dx + s * dy, y1 = -s * dx + c * dy, lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (den || 1)));
  const cx1 = k * rx * y1 / ry, cy1 = -k * ry * x1 / rx;
  const cx = c * cx1 - s * cy1 + (p0[0] + p1[0]) / 2, cy = s * cx1 + c * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= TAU; else if (sweep && dt < 0) dt += TAU;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), h = dt / n, a = 4 / 3 * Math.tan(h / 4);
  const at = t => [cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
  const dir = t => [-rx * Math.sin(t) * c - ry * Math.cos(t) * s, -rx * Math.sin(t) * s + ry * Math.cos(t) * c];
  const out = [];
  for (let i = 0; i < n; i++) {
    const ta = t0 + i * h, tb = ta + h, A = i ? at(ta) : p0, B = i === n - 1 ? p1 : at(tb), da = dir(ta), db = dir(tb);
    out.push([A, [A[0] + a * da[0], A[1] + a * da[1]], [B[0] - a * db[0], B[1] - a * db[1]], B]);
  }
  return out;
}
export function parsePath(d) {
  const segs = [], tok = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = '', cur = [0, 0], start = [0, 0], ctrl = null, prevC = '';
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), o = rel ? cur : [0, 0];
    const refl = kinds => ctrl && kinds.includes(prevC) ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : cur;
    let next = null;
    if (C === 'Z') {
      if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push({ t: 'L', p: [cur, start] });
      segs.push({ t: 'Z', p: [start] }); cur = start; segs.closed = true; prevC = 'Z'; ctrl = null; continue;
    }
    if (C === 'M') { cur = start = [o[0] + num(), o[1] + num()]; cmd = rel ? 'l' : 'L'; segs.push({ t: 'M', p: [cur] }); prevC = 'M'; ctrl = null; continue; }
    if (C === 'L') { next = [o[0] + num(), o[1] + num()]; segs.push({ t: 'L', p: [cur, next] }); ctrl = null; }
    else if (C === 'H') { next = [(rel ? cur[0] : 0) + num(), cur[1]]; segs.push({ t: 'L', p: [cur, next] }); ctrl = null; }
    else if (C === 'V') { next = [cur[0], (rel ? cur[1] : 0) + num()]; segs.push({ t: 'L', p: [cur, next] }); ctrl = null; }
    else if (C === 'C' || C === 'S') {
      const a = C === 'C' ? [o[0] + num(), o[1] + num()] : refl('CS'), b = [o[0] + num(), o[1] + num()];
      next = [o[0] + num(), o[1] + num()]; segs.push({ t: 'C', p: [cur, a, b, next] }); ctrl = b;
    } else if (C === 'Q' || C === 'T') {
      const a = C === 'Q' ? [o[0] + num(), o[1] + num()] : refl('QT');
      next = [o[0] + num(), o[1] + num()]; segs.push({ t: 'Q', p: [cur, a, next] }); ctrl = a;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
      next = [o[0] + num(), o[1] + num()];
      for (const c of arcCubics(cur, rx, ry, rot * Math.PI / 180, !!large, !!sweep, next)) segs.push({ t: 'C', p: c });
      ctrl = null;
    } else { i++; continue; }
    cur = next; prevC = C;
  }
  return segs;
}
// Write segments back out as one absolute M L Q C Z path, every point through map.
export function pathOf(segs, map = p => p) {
  return segs.map(s => s.t === 'Z' ? 'Z' : s.t === 'M' ? `M${pt(map(s.p[0]))}` : `${s.t}${s.p.slice(1).map(q => pt(map(q))).join(' ')}`).join(' ');
}
const segAt = (s, t) => {
  const u = 1 - t, p = s.p;
  if (s.t === 'L') return [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t];
  if (s.t === 'Q') return [0, 1].map(j => u * u * p[0][j] + 2 * u * t * p[1][j] + t * t * p[2][j]);
  return [0, 1].map(j => u * u * u * p[0][j] + 3 * u * u * t * p[1][j] + 3 * u * t * t * p[2][j] + t * t * t * p[3][j]);
};
// Dense polyline of a path (k points per curve).
export function flatten(d, k = 24) {
  const segs = typeof d === 'string' ? parsePath(d) : d, out = [];
  for (const s of segs) {
    if (s.t === 'Z') continue;
    if (s.t === 'M') { out.push(s.p[0]); continue; }
    const n = s.t === 'L' ? 1 : k;
    for (let i = 1; i <= n; i++) out.push(segAt(s, i / n));
  }
  return out;
}
// n points evenly spaced by arc length (a closed path does not repeat its first point).
export function samplePath(d, n) {
  const pts = flatten(d), closed = /[Zz]\s*$/.test(typeof d === 'string' ? d : '');
  if (closed && pts.length > 1) { const a = pts[0], b = pts[pts.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-9) pts.push(a); }
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1], out = [], steps = closed ? n : n - 1;
  for (let i = 0, j = 1; i < n; i++) {
    const want = total * i / steps;
    while (j < L.length - 1 && L[j] < want) j++;
    const seg = L[j] - L[j - 1] || 1, t = (want - L[j - 1]) / seg;
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}
export const pathLength = d => { const p = flatten(d); let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
// [[x, y, angle in degrees]], n points from start to end inclusive.
export function sampleAlong(d, n) {
  const p = samplePath(d, n), q = samplePath(d, Math.max(2 * n, 64));
  return p.map((a, i) => {
    const j = Math.min(q.length - 2, Math.round(i / (n - 1 || 1) * (q.length - 1)));
    const b = q[Math.max(0, j - 1)], c = q[Math.min(q.length - 1, j + 1)];
    const ang = Math.atan2(c[1] - b[1], c[0] - b[0]) * 180 / Math.PI;
    return [a[0], a[1], Math.abs(ang) < 1e-9 ? 0 : ang];
  });
}
export function areaOf(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function distToPolygon([x, y], poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
// The polygon helpers a primitive needs to fit one shape inside another (heart.js papillary muscles,
// kidney.js pyramids). poly is a closed list of points; directions need not be unit length unless said.
// Every crossing of the line p + t e with the polygon's edges, as t values (either sign).
export function lineCrossings(poly, p, e) {
  const hits = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ex = b[0] - a[0], ey = b[1] - a[1], den = e[0] * ey - e[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const wx = a[0] - p[0], wy = a[1] - p[1], t = (wx * ey - wy * ex) / den, u = (wx * e[1] - wy * e[0]) / den;
    if (u >= -1e-9 && u <= 1 + 1e-9) hits.push(t);
  }
  return hits;
}
// Distance along the ray p + t u (u unit) to the first edge at least min away; Infinity when none.
export function rayHit(p, u, poly, { min = 1e-6 } = {}) {
  let best = Infinity;
  for (const t of lineCrossings(poly, p, u)) if (t > min && t < best) best = t;
  return best;
}
// The polygon's extent along the line through p in direction e (unit), between its outermost crossings;
// with clip, only the part inside clip's nearest crossings either side of p.
export function widthAcross(poly, p, e, clip) {
  const h = lineCrossings(poly, p, e);
  if (h.length < 2) return 0;
  let lo = Math.min(...h), hi = Math.max(...h);
  if (clip) { const c = lineCrossings(clip, p, e); lo = Math.max(lo, Math.max(...c.filter(t => t <= 0), -Infinity)); hi = Math.min(hi, Math.min(...c.filter(t => t >= 0), Infinity)); }
  return Math.max(0, hi - lo);
}
// The nearest point on the polygon's outline.
export function nearestOn(poly, p) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2)), q = [a[0] + ex * t, a[1] + ey * t], dd = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (dd < bd) { bd = dd; best = q; }
  }
  return best;
}
// Catmull-Rom through the points as one cubic per interval ([p1, c1, c2, p2]), so a track can be split
// into segments that join with a continuous tangent; cubicsD writes them as one path (smooth()'s path).
export function crCubics(points) {
  const n = points.length, Q = i => points[Math.max(0, Math.min(n - 1, i))], out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}
export const cubicsD = cs => cs.length ? `M${pt(cs[0][0])}` + cs.map(c => ` C${f(c[1][0])} ${f(c[1][1])} ${f(c[2][0])} ${f(c[2][1])} ${pt(c[3])}`).join('') : '';
// Points about step apart along a path, each with its unit left normal (-ty, tx): [[x, y], [nx, ny]].
export function framesOf(d, step = 3) {
  const n = Math.max(3, Math.ceil(pathLength(d) / step)), p = samplePath(d, n);
  return p.map((a, i) => {
    const b = p[Math.max(0, i - 1)], c = p[Math.min(n - 1, i + 1)], tx = c[0] - b[0], ty = c[1] - b[1], L = Math.hypot(tx, ty) || 1;
    return [a, [-ty / L, tx / L]];
  });
}
// A highlight for a winding tube: the runs of the edge, off from the centreline, whose side faces the
// upper-left light (tube() picks one side for the whole path; this follows each bend). min: how squarely
// a side must face the light to be lit.
export function litEdge(d, off, { min = 0.3 } = {}) {
  const runs = [], Lx = -Math.SQRT1_2, Ly = -Math.SQRT1_2;
  let cur = [];
  for (const [p, n] of framesOf(d, 3)) {
    const k = n[0] * Lx + n[1] * Ly;
    if (Math.abs(k) < min) { if (cur.length > 2) runs.push(cur); cur = []; continue; }
    const side = k > 0 ? 1 : -1;
    if (cur.length && cur.side !== side) { if (cur.length > 2) runs.push(cur); cur = []; }
    cur.side = side; cur.push([p[0] + n[0] * side * off, p[1] + n[1] * side * off]);
  }
  if (cur.length > 2) runs.push(cur);
  return runs.map(r => `M${r.map(pt).join(' L')}`).join(' ');
}
// Catmull-Rom through the points, as cubic Bezier segments.
export function smooth(points, { closed = false } = {}) {
  const n = points.length, P_ = i => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(points[0])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P_(i - 1), p1 = P_(i), p2 = P_(i + 1), p3 = P_(i + 2);
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${pt(p2)}`;
  }
  return closed ? d + ' Z' : d;
}
const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
// Interpolate two paths. Matched command structure: number by number, keeping a's separators.
// Otherwise (or with n): resample both to n points and interpolate those.
export function lerpPath(a, b, t, { n } = {}) {
  const ca = a.replace(NUM, '#'), cb = b.replace(NUM, '#');
  if (!n && ca === cb) { const nb = b.match(NUM); let i = 0; return a.replace(NUM, x => String(f(+x + (+nb[i++] - +x) * t))); }
  const N = n || 48, closed = /[Zz]\s*$/.test(a), pa = samplePath(a, N), pb = samplePath(b, N);
  const pts = pa.map((p, i) => [p[0] + (pb[i][0] - p[0]) * t, p[1] + (pb[i][1] - p[1]) * t]);
  return smooth(pts, { closed });
}
// A parallel path at a distance (positive: toward the travel direction's left-hand normal (-ty, tx)).
export function offsetPath(d, dist, n = 48) {
  const closed = /[Zz]\s*$/.test(d), p = samplePath(d, n);
  const out = p.map((a, i) => {
    const b = p[Math.max(0, i - 1)], c = p[Math.min(p.length - 1, i + 1)];
    const pb = closed && i === 0 ? p[p.length - 1] : b, pc = closed && i === p.length - 1 ? p[0] : c;
    let tx = pc[0] - pb[0], ty = pc[1] - pb[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    return [a[0] - ty * dist, a[1] + tx * dist];
  });
  return closed ? smooth(out, { closed }) : `M${out.map(pt).join(' L')}`;
}
// A seeded organic outline (cells, granules, clots).
export function blob(cx, cy, r, { lobes = 0, wobble = 0.08, seed = 1, n = 12 } = {}) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pts = Array.from({ length: n }, (_, i) => {
    const a = i / n * 2 * Math.PI, k = 1 + wobble * (rnd() * 2 - 1) + (lobes ? 0.12 * Math.cos(lobes * a) : 0);
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)];
  });
  return smooth(pts, { closed: true });
}
const bboxOf = (pts, pad = 0) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map(f); };

/* ---------- vessels and tubes (section 2.6, "Tubes" and "Joins") ---------- */
// Layered strokes on one centreline: outline (line, total width w), wall (base), lumen (model width),
// then a highlight toward the light. cut: 'start' | 'end' | 'both' adds elliptical cut faces; into: a
// chamber's path gives art.mouth, a lumen-coloured stroke to draw over the chamber wall where it enters.
export function tube(d, { wall = 'artery', lumen = 'oxy', w = 24, lumenW, highlight = true, cut, into, s = 1, hiCls = D2, cap = 'butt' } = {}) {
  const W_ = typeof wall === 'string' ? P[wall] : wall, L_ = typeof lumen === 'string' ? P[lumen] : lumen;
  const lw = lumenW ?? w * 0.65, ol = 2 * SW.outline / s / 1.15;
  const stroke = (col, width, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(width)}" stroke-linecap="${cap}" stroke-linejoin="round"${extra}/>`;
  let svg = stroke(W_.line, w) + stroke(W_.base, w - ol) + stroke(L_.base, lw);
  if (highlight && lw > 6) {
    // the side of the lumen nearer the light (upper left)
    const [a, b] = samplePath(d, 2), tx = b[0] - a[0], ty = b[1] - a[1], nx = -ty, ny = tx, side = nx + ny < 0 ? 1 : -1;
    svg += `<path d="${offsetPath(d, side * (lw / 2 - 2.6), 24)}" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2.5" stroke-linecap="round" class="${hiCls}"/>`;
  }
  const ends = cut === 'both' ? ['start', 'end'] : cut ? [cut] : [];
  for (const e of ends) {
    const q = sampleAlong(d, 12), [x, y, ang] = e === 'start' ? q[0] : q[q.length - 1];
    svg += cutFace(x, y, w / 2, w / 2 * 0.3, { wall: W_, lumen: L_, rot: ang + 90, lumenR: lw / 2 }).svg;
  }
  let mouth;
  if (into) {
    const poly = samplePath(into, 160), q = samplePath(d, 80), seg = pathLength(d) / 79;
    const first = q.findIndex(p => pointInPolygon(p, poly) || distToPolygon(p, poly) < (w - lw) / 2 + 3);
    const from = Math.max(0, first < 0 ? q.length - 2 : first - Math.ceil(2 / seg));
    mouth = `<path d="M${q.slice(from).map(pt).join(' L')}" fill="none" stroke="${L_.base}" stroke-width="${f(lw)}" stroke-linecap="butt"/>`;
  }
  const pts = samplePath(d, 24);
  return artOf(svg, bboxOf(pts, w / 2), { start: pts[0], end: pts[pts.length - 1] }, () => d, { mouth });
}
// A cut end of a vessel: the wall ring in the wall's hi, the lumen in the lumen's cut tone.
export function cutFace(x, y, rx, ry, { wall = 'artery', lumen = 'oxy', rot = 0, lumenR } = {}) {
  const W_ = typeof wall === 'string' ? P[wall] : wall, L_ = typeof lumen === 'string' ? P[lumen] : lumen;
  const lr = lumenR ?? rx * 0.65, tf = rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : '';
  const svg = `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${tf} fill="${W_.hi || W_.base}" stroke="${W_.line}" stroke-width="1"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(lr)}" ry="${f(ry * lr / rx)}"${tf} fill="${L_.cut || L_.lo}"/>`;
  return artOf(svg, [x - rx, y - rx, 2 * rx, 2 * rx].map(f), { centre: [x, y] });
}
// A translucent flow streamline with a small chevron head. phase in [0, 1) loops seamlessly.
export function streamline(d, { phase = 0, opacity = 1, w = 3, head = true, cls = '' } = {}) {
  const off = f(-24 * phase);
  let s = `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="10 14" stroke-dashoffset="${off}"/>`;
  if (head) { const q = sampleAlong(d, 16), [x, y, a] = q[q.length - 1]; s += chevron(x, y, a, 6); }
  return `<g opacity="${f(opacity)}"${cls ? ` class="${cls}"` : ''}>${s}</g>`;
}
export const chevronD = (x, y, ang, size = 6) => {
  const a = ang * Math.PI / 180, b = 0.6, p = (k, s) => [x - size * Math.cos(a + k * b) * s, y - size * Math.sin(a + k * b) * s];
  return `M${pt(p(1, 1))} L${pt([x, y])} L${pt(p(-1, 1))}`;
};
export const chevron = (x, y, ang, size = 6, col = '#ffffff', op = 0.8) => `<path d="${chevronD(x, y, ang, size)}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;

// A straight arrow with a fixed-size head (the kit's style: the head never grows with the line), drawn
// without a marker so it needs no id. w: shaft weight; head: { l, w } its length and half-width; both are
// weight-compensated by s. The head comes first in the markup, then the shaft up to its base.
export function arrowFixed(a, b, { col = P.ui.ink, w = 2.5, s = 1, head = {}, attrs = '' } = {}) {
  const hl = (head.l ?? 7) / s, hw = (head.w ?? 4.2) / s, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), sn = Math.sin(ang);
  const base = [b[0] - c * hl, b[1] - sn * hl];
  return `<g${attrs}><path d="M${pt(b)} L${pt([base[0] - sn * hw, base[1] + c * hw])} L${pt([base[0] + sn * hw, base[1] - c * hw])} Z" fill="${col}"/><path d="M${pt(a)} L${pt(base)}" stroke="${col}" stroke-width="${f(w / s)}" stroke-linecap="round" fill="none"/></g>`;
}
// A material's volume radial for one glyph that is rotated (rot, degrees) or mirrored (flip): the
// highlight moves within the glyph so it stays at the picture's upper left (section 2.6). Unturned it is
// the shared fill(mat) gradient's geometry; the caller owns the id (uid()).
export function litGradient(id, mat, { rot = 0, flip = false } = {}) {
  const c = typeof mat === 'string' ? P[mat] : mat, a = -rot * Math.PI / 180, vx0 = -0.15, vy0 = -0.2;
  let vx = vx0 * Math.cos(a) - vy0 * Math.sin(a); const vy = vx0 * Math.sin(a) + vy0 * Math.cos(a);
  if (flip) vx = -vx;
  return `<radialGradient id="${id}" cx="${f(0.5 + vx)}" cy="${f(0.5 + vy)}" r=".85"><stop offset="0" stop-color="${c.hi}"/><stop offset=".6" stop-color="${c.base}"/><stop offset="1" stop-color="${c.lo}"/></radialGradient>`;
}

/* ---------- type, labels and leaders (section 3) ---------- */
const SIZE = { lg: 24, sm: 18, xs: 17 };
const classSize = cls => { const c = ` ${cls} `; return c.includes(' lg ') ? 24 : c.includes(' sm ') ? 18 : c.includes(' xs ') ? 17 : 20; };
const classBold = cls => / (b|lg) /.test(` ${cls} `);
export function textWidth(str, cls = '') {
  const W_ = classBold(cls) ? W700 : W500, size = classSize(cls), fallback = W_[CHARS.indexOf('n')];
  let sum = 0;
  for (const ch of String(str)) { const i = CHARS.indexOf(ch); sum += i < 0 ? fallback : W_[i]; }
  return f(sum * size / 1000);
}
// 1.25 ink leader from the label side to a 2.5-radius dot on the target; elbow: horizontal first, then one
// diagonal at angle degrees (30, 45 or 60).
export function leaderPoints(from, to, { elbow = true, angle = 45 } = {}) {
  const [x0, y0] = from, [x1, y1] = to, dy = Math.abs(y1 - y0), dir = Math.sign(x1 - x0) || 1;
  const ex = x1 - dir * dy / Math.tan(angle * Math.PI / 180);
  return elbow && dy > 1 && (ex - x0) * dir > 0 ? [from, [ex, y0], to] : [from, to];
}
export function leader(from, to, { elbow = true, angle = 45, s = 1, col = P.ui.ink } = {}) {
  const pts = leaderPoints(from, to, { elbow, angle }), [x1, y1] = to;
  return `<path d="M${pts.map(pt).join(' L')}" fill="none" stroke="${col}" stroke-width="${f(SW.leader / s)}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${f(x1)}" cy="${f(y1)}" r="${f(2.5 / s)}" fill="${col}"/>`;
}
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const ptSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
const segGap = (a, b, c, d) => segX(a, b, c, d) ? 0 : Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
// Two leaders clash if they cross or pass within 4 units of each other.
const polyX = (p, q, gap = 4) => { for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) if (segGap(p[i - 1], p[i], q[j - 1], q[j]) < gap) return true; return false; };
// The label budget: the widest label (a name with an optional descriptor under it), measured.
export function labelBudget(items, { margin = 8, gap = 14 } = {}) {
  const width = Math.max(0, ...items.map(it => Math.max(textWidth(it.text, it.cls || 'sm b'), it.sub ? textWidth(it.sub, it.subCls || 'xs muted') : 0)));
  return { width: f(width), fits: (artW, scale = 1, W = 480) => artW * scale + gap + width + 2 * margin <= W };
}
// Stack labels in one column by their targets' y; at least minGap between blocks; inside top..bottom;
// out of keepOut boxes. Run once per scene, never per frame.
export function placeLabels(items, { column, side = 'right', minGap = 4, keepOut = [], top = 8, bottom = 412, elbow = true } = {}) {
  const rows = items.map(it => {
    const size = classSize(it.cls || 'sm b'), subSize = it.sub ? classSize(it.subCls || 'xs muted') : 0;
    return { ...it, size, h: size + (it.sub ? 4 + subSize : 0), w: Math.max(textWidth(it.text, it.cls || 'sm b'), it.sub ? textWidth(it.sub, it.subCls || 'xs muted') : 0) };
  }).sort((a, b) => a.at[1] - b.at[1]);
  // y here is the top of each block; the first baseline sits at y + 0.8 size
  const x0 = column;
  const hits = (r, y) => keepOut.find(([kx, ky, kw, kh]) => {
    const rx = side === 'right' ? x0 : x0 - r.w;
    return rx < kx + kw && rx + r.w > kx && y < ky + kh && y + r.h > ky;
  });
  // Stack a column in the given order: each block as near its target as the one above, keepOut and the
  // bounds allow. Run again after any swap, so blocks of different heights never overlap.
  const stack = order => {
    const ys = [];
    order.forEach((r, i) => {
      let y = Math.max(r.at[1] - r.size * 0.45, top);
      if (i) y = Math.max(y, ys[i - 1] + order[i - 1].h + minGap);
      for (let k = 0, b; k < 20 && (b = hits(r, y)); k++) y = b[1] + b[3] + minGap;
      ys.push(y);
    });
    for (let i = order.length - 1; i >= 0; i--) {
      const lim = i === order.length - 1 ? bottom : ys[i + 1] - minGap;
      if (ys[i] + order[i].h > lim) ys[i] = lim - order[i].h;
    }
    return ys;
  };
  // Leaders never cross: each takes the first of 45, 60 or 30 degrees that crosses none drawn above it; if
  // none does, the two labels trade places and the column is restacked in the new order and tried again.
  const from = (r, y) => [side === 'right' ? x0 - 6 : x0 + 6, y + r.size * 0.8 - r.size * 0.32];
  let order = rows.slice(), slots = stack(order), angles = [];
  for (let pass = 0; pass < 8; pass++) {
    const lines = [];
    let clash = -1;
    angles = order.map((r, i) => {
      for (const a of [45, 60, 30]) { const q = leaderPoints(from(r, slots[i]), r.at, { elbow, angle: a }); if (!lines.some(l => polyX(l, q))) { lines.push(q); return a; } }
      if (clash < 0) clash = i;
      lines.push(leaderPoints(from(r, slots[i]), r.at, { elbow }));
      return 45;
    });
    if (clash < 1) break;
    [order[clash - 1], order[clash]] = [order[clash], order[clash - 1]];
    slots = stack(order);
  }
  return order.map((r, i) => {
    const yTop = slots[i], y = f(yTop + r.size * 0.8), anchor = side === 'right' ? 'start' : 'end';
    const text = `<text x="${f(x0)}" y="${y}" text-anchor="${anchor}" class="${r.cls || 'sm b'}">${r.text}</text>` + (r.sub ? `<text x="${f(x0)}" y="${f(y + 4 + classSize(r.subCls || 'xs muted'))}" text-anchor="${anchor}" class="${r.subCls || 'xs muted'}">${r.sub}</text>` : '');
    return { text: r.text, x: f(x0), y, anchor, box: [side === 'right' ? x0 : x0 - r.w, yTop, r.w, r.h].map(f), points: leaderPoints(from(r, yTop), r.at, { elbow, angle: angles[i] }), leader: leader(from(r, yTop), r.at, { elbow, angle: angles[i] }), svg: text };
  });
}

/* ---------- insets, inhibition, activation ---------- */
export function magnifier({ from, to, body, id = uid('lens') }) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (to.r - from.r) / d)));
  const tan = k => { const t = a + k * b; return `M${pt([from.x - from.r * Math.cos(t), from.y - from.r * Math.sin(t)])} L${pt([to.x - to.r * Math.cos(t), to.y - to.r * Math.sin(t)])}`; };
  const svg = `<g data-part="inset"><path d="${tan(1)} ${tan(-1)}" fill="none" stroke="${P.space.lensRim}" stroke-width="1.25"/><circle cx="${f(from.x)}" cy="${f(from.y)}" r="${f(from.r)}" fill="none" stroke="${P.space.lensRim}" stroke-width="1.5"/><clipPath id="${id}"><circle cx="${f(to.x)}" cy="${f(to.y)}" r="${f(to.r)}"/></clipPath><circle cx="${f(to.x)}" cy="${f(to.y)}" r="${f(to.r)}" fill="${P.space.paper}"/><g clip-path="url(#${id})">${body}</g><circle cx="${f(to.x)}" cy="${f(to.y)}" r="${f(to.r)}" fill="none" stroke="${P.space.lensRim}" stroke-width="1.5"/></g>`;
  return artOf(svg, [to.x - to.r, to.y - to.r, 2 * to.r, 2 * to.r].map(f), { lens: [to.x, to.y] });
}
export function inhibit(d, { w = 3, bar = 14 } = {}) {
  const q = sampleAlong(d, 8), [x, y, ang] = q[q.length - 1], a = (ang + 90) * Math.PI / 180, h = bar / 2;
  return `<path d="${d}" fill="none" stroke="${P.ui.red}" stroke-width="${f(w)}" stroke-linecap="round"/><path d="M${pt([x - h * Math.cos(a), y - h * Math.sin(a)])} L${pt([x + h * Math.cos(a), y + h * Math.sin(a)])}" stroke="${P.ui.red}" stroke-width="3.5" stroke-linecap="round"/>`;
}
// A blue wash clipped to a shape, growing from an origin with k.
export function activationWash(clipD, k, id, { from, r = 160, opacity = 0.3 } = {}) {
  if (k <= 0) return '';
  const [x, y] = from || samplePath(clipD, 1)[0];
  return `<clipPath id="${id}"><path d="${clipD}"/></clipPath><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * Math.min(1, k))}" fill="${P.ui.blue}" fill-opacity="${f(opacity)}" clip-path="url(#${id})"/>`;
}
// The art ghost: outline only, above the art: a panel underlay, then a muted dash (section 2.7).
export function artGhost(d, { dash = '5 4', s = 1 } = {}) {
  return `<g class="ax-ghost"><path d="${d}" fill="none" stroke="${P.ui.panel}" stroke-opacity=".85" stroke-width="${f(3 / s)}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P.ui.muted}" stroke-width="${f(1.6 / s)}" stroke-dasharray="${dash}" stroke-linejoin="round"/></g>`;
}
