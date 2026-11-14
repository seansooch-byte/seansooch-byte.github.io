#!/usr/bin/env node
// Node tests for lab/kit/art/lung.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/lung.test.mjs          every test
//   node tools/art-tests/lung.test.mjs capill   only tests whose name contains "capill"
// No dependencies; same style as tools/lab-art-test.mjs. The gallery is tools/art-gallery/lung.html.
//
// What is tested, and why (art direction sections 2, 4.0b, 4.4, 5 and 7):
//   alveolus           an Art (svg, box, at, outline) with leaf parts alveoli, wall, type1, type2 (and fluid,
//                      airway when drawn), renamable; a lobed sac with interalveolar septa, type I nuclei
//                      on the wall and a type II cell; the lumen is the caller's gas colour; fluid rises
//                      from the bottom with a meniscus; the duct narrows by its lumen, its outer wall stays.
//   alveolarCapillary  the capillary touches the alveolar wall along the whole contact arc (no gap: the
//                      contact line is the blood-air barrier); its lumen width is the model's width; blood
//                      runs deoxygenated to oxygenated along the flow; red cells loop seamlessly with phase;
//                      O2 crosses outward into the blood, CO2 inward into the air; the arteriole is artery
//                      wall with venous blood and the venule vein wall with arterial blood (vessel rule).
//   lungsFrontal       right lung three lobes (two fissures), left lung two lobes (one fissure) with a
//                      cardiac notch and lingula; right main bronchus shorter, wider and steeper than the
//                      left; trachea with C rings; the right dome higher; breathing enlarges the lungs.
//   lints              no nested data-part, unique ids per instance, every url(#) resolves, weight strokes
//                      compensated for scale, no em or en dash, no hex in lung.js, fill() only on fills.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const only = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

const core = await import(root + 'lab/kit/art/core.js').catch(e => ({ __error: e }));
const lung = await import(root + 'lab/kit/art/lung.js').catch(e => ({ __error: e }));
const loaded = m => { if (m.__error) throw new Fail(`module did not load: ${m.__error.message}`); return m; };

/* ---------- markup helpers ---------- */
function scan(markup) {
  const stack = [], ids = [], refs = [], nested = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(markup))) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const part = /\sdata-part="([^"]*)"/.exec(attrs);
    if (part && stack.some(s => s.part)) nested.push(`${part[1]} inside ${stack.filter(s => s.part).map(s => s.part).join(' > ')}`);
    const id = /\sid="([^"]+)"/.exec(attrs);
    if (id) ids.push(id[1]);
    for (const r of attrs.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) refs.push(r[1] || r[2]);
    if (!self) stack.push({ tag, part: part ? part[1] : null });
  }
  return { ids, refs, nested };
}
const partsOf = markup => new Set([...markup.matchAll(/data-part="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
// The markup of the first leaf group whose data-part includes name (parts never nest, so the next </g> at
// depth 0 closes it).
function partMarkup(markup, name) {
  const re = new RegExp(`<g[^>]*data-part="([^"]*\\b${name}\\b[^"]*)"[^>]*>`, 'g');
  const out = [];
  for (const m of markup.matchAll(re)) {
    let depth = 1, i = m.index + m[0].length;
    const tag = /<(\/?)g\b[^>]*?(\/?)>/g; tag.lastIndex = i;
    let t;
    while (depth && (t = tag.exec(markup))) { if (t[1]) depth--; else if (!t[2]) depth++; i = tag.lastIndex; }
    out.push(markup.slice(m.index, i));
  }
  return out.join('');
}
const resolves = svg => {
  const { ids, refs } = scan(svg), shared = new Set(Object.keys(loaded(core).P));
  return refs.filter(r => !ids.includes(r) && !(r.startsWith('ax-') && shared.has(r.slice(3))));
};
const isArt = (a, msg) => {
  ok(a && typeof a.svg === 'string' && a.svg.length > 50, `${msg}: svg string`);
  ok(Array.isArray(a.box) && a.box.length === 4 && a.box.every(Number.isFinite), `${msg}: box [x, y, w, h]`);
  ok(a.at && typeof a.at === 'object', `${msg}: at`);
  ok(typeof a.outline === 'function' && typeof a.outline() === 'string', `${msg}: outline(state)`);
  ok(String(a) === a.svg && `${a}` === a.svg, `${msg}: toString is the svg`);
};
const pathArea = d => Math.abs(loaded(core).areaOf(loaded(core).samplePath(d, 400)));
const centroid = d => { const p = loaded(core).samplePath(d, 200); return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };

/* ---------- alveolus ---------- */
test('alveolus: loads and exports the primitives', () => {
  const L = loaded(lung);
  for (const k of ['alveolus', 'alveolarCapillary', 'lungsFrontal', 'alveolusGeometry', 'o2Glyph', 'co2Glyph']) ok(typeof L[k] === 'function', `exports ${k}`);
});
test('alveolus: is an Art with leaf parts alveoli, wall, type1, type2', () => {
  const a = loaded(lung).alveolus({ x: 240, y: 200, r: 80, duct: 40 });
  isArt(a, 'alveolus');
  const parts = partsOf(a.svg);
  for (const n of ['alveoli', 'wall', 'type1', 'type2', 'airway']) ok(parts.has(n), `part ${n}`);
  ok(!parts.has('fluid'), 'no fluid part when fluid is 0');
  ok(scan(a.svg).nested.length === 0, `parts nest: ${scan(a.svg).nested[0]}`);
  for (const k of ['centre', 'lumen', 'wall', 'mouth', 'type1', 'type2']) ok(Array.isArray(a.at[k]), `at.${k}`);
  ok(resolves(a.svg).length === 0, `url(#) unresolved: ${resolves(a.svg)[0]}`);
});
test('alveolus: parts can be renamed for a lesson\'s dfn targets', () => {
  const a = loaded(lung).alveolus({ r: 60, duct: 30, parts: { alveoli: 'sac', airway: 'air' } });
  const parts = partsOf(a.svg);
  ok(parts.has('sac') && parts.has('air') && !parts.has('alveoli') && !parts.has('airway'), 'renamed');
});
test('alveolus: x, y is the centre and s scales; the box is about 2.2 r square', () => {
  const L = loaded(lung), a = L.alveolus({ x: 240, y: 200, r: 80 });
  near(a.box[0] + a.box[2] / 2, 240, 4, 'centre x'); near(a.box[1] + a.box[3] / 2, 200, 4, 'centre y');
  ok(a.box[2] > 1.9 * 80 && a.box[2] < 2.4 * 80, `box width ${a.box[2]}`);
  const b = L.alveolus({ x: 100, y: 100, r: 80, s: 0.5 });
  near(b.box[2], a.box[2] / 2, 2, 'box scales with s');
  near(b.at.centre[0], 100, 0.5, 'at is in picture coordinates');
  ok(/transform="translate\(100 100\) scale\(0\.5 0\.5\)"/.test(b.svg), 'one transform');
});
test('alveolus: the lumen is the caller\'s gas colour', () => {
  const a = loaded(lung).alveolus({ r: 60, gas: '#9fb6d6', hooks: { lumen: 'data-sac="a"' } });
  ok(/<path[^>]*data-sac="a"[^>]*fill="#9fb6d6"|<path[^>]*fill="#9fb6d6"[^>]*data-sac="a"/.test(a.svg), 'lumen path carries the hook and the gas fill');
  const b = loaded(lung).alveolus({ r: 60 });
  ok(b.svg.includes(loaded(core).P.space.air), 'default gas is air');
});
test('alveolus: a lobed sac with septa, not a circle', () => {
  const G = loaded(lung).alveolusGeometry({ r: 80 });
  const radii = G.lumenPts.map(p => Math.hypot(p[0], p[1]));
  const spread = (Math.max(...radii) - Math.min(...radii)) / 80;
  ok(spread > 0.12, `lumen radius varies (septa jut in): ${spread.toFixed(3)}`);
  const outer = G.outerPts.map(p => Math.hypot(p[0], p[1])), os = (Math.max(...outer) - Math.min(...outer)) / 80;
  ok(os > 0.03 && os < 0.14, `outer surface gently lobed (3 to 14 %): ${os.toFixed(3)}`);
  ok(G.septa.length >= 4, `septa: ${G.septa.length}`);
  ok(G.wallW >= 3 && G.wallW <= 7, `wall band ${G.wallW}`);
});
test('alveolus: type I nuclei lie flat in the wall; one type II cell bulges into the air', () => {
  const L = loaded(lung), G = L.alveolusGeometry({ r: 80 });
  ok(G.type1.length >= 3, 'three or more type I nuclei at r 80');
  for (const n of G.type1) { ok(n.rx >= 2.5 * n.ry, `type I nucleus is flat: ${n.rx} x ${n.ry}`); ok(2 * n.rx >= 9, 'type I nucleus at least 9 units long'); }
  ok(G.type2 && G.type2.w >= 12 && G.type2.h >= 7, 'type II cell is a cuboidal bump at least 12 x 7');
  ok(L.alveolusGeometry({ r: 20 }).type1.length <= 2, 'small sacs carry fewer nuclei');
  const a = L.alveolus({ r: 80, cells: false });
  ok(!partsOf(a.svg).has('type1') && !partsOf(a.svg).has('type2'), 'cells: false draws no cells');
});
test('alveolus: fluid rises from the bottom with a meniscus, clipped to the lumen', () => {
  const L = loaded(lung);
  const lvl = fl => L.alveolusGeometry({ r: 80, fluid: fl }).fluidLevel;
  ok(lvl(0.2) > lvl(0.5) && lvl(0.5) > lvl(0.9), 'level rises with fluid');
  near(lvl(0.5), 0, 12, 'half full is near the centre');
  const a = L.alveolus({ r: 80, fluid: 0.6, fluidCells: 4, hooks: { fluid: 'data-fluid' } });
  ok(partsOf(a.svg).has('fluid'), 'fluid part');
  const fm = partMarkup(a.svg, 'fluid');
  ok(/clip-path="url\(#ax-/.test(fm) && fm.includes('data-fluid'), 'fluid is clipped and carries its hook');
  ok((fm.match(/data-cell="wbc"/g) || []).length === 4, 'four white cells in the exudate');
  ok(/\bQ|\bC/.test(L.alveolusGeometry({ r: 80, fluid: 0.5 }).fluidD), 'the surface is a curve (meniscus)');
});
test('alveolus: the duct narrows by its lumen; its outer wall stays', () => {
  const L = loaded(lung);
  const w = d => [...partMarkup(L.alveolus({ r: 80, duct: d }).svg, 'airway').matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]);
  const open = w({ len: 40 }), narrow = w({ len: 40, lumen: 4 });
  near(Math.max(...open), Math.max(...narrow), 0.01, 'outer width unchanged');
  ok(narrow.includes(4), 'lumen stroke is the model width');
  const g = L.alveolusGeometry({ r: 80, duct: { len: 40 } });
  ok(g.ductEdges(6).split('M').length === 3, 'ductEdges gives the two lumen edges for a ghost');
});
test('alveolus: outline(state) follows r', () => {
  const a = loaded(lung).alveolus({ r: 60 });
  ok(pathArea(a.outline({ r: 66 })) > pathArea(a.outline({ r: 60 })) * 1.15, 'bigger sac, bigger outline');
});
test('alveolus: outline({ duct }) gives the duct\'s lumen edges in picture coordinates', () => {
  const a = loaded(lung).alveolus({ x: 90, y: 112, r: 52, duct: { len: 40 } });
  const xs = [...a.outline({ duct: 14 }).matchAll(/M(-?[\d.]+) /g)].map(m => +m[1]);
  ok(xs.length === 2, 'two edges'); near(Math.abs(xs[0] - xs[1]), 14, 0.05, 'edges are the lumen width apart'); near((xs[0] + xs[1]) / 2, 90, 0.05, 'centred on the duct');
  ok(loaded(lung).alveolus({ r: 52 }).outline({ duct: 10 }) === '', 'no duct, no edges');
});
test('alveolus: rot and flip map the at points with the drawing', () => {
  const L = loaded(lung), a = L.alveolus({ x: 200, y: 200, r: 50, duct: 30, rot: 90 });
  ok(a.at.mouth[0] > 200 + 50 && Math.abs(a.at.mouth[1] - 200) < 1, `rot 90 turns the mouth to the right: ${a.at.mouth}`);
  const b = L.alveolus({ x: 200, y: 200, r: 50, flip: true });
  ok(b.at.type2[0] > 200, 'flip mirrors the type II cell to the right');
});
test('alveolus: weight strokes keep their on-screen weight at any s', () => {
  const a = loaded(lung).alveolus({ r: 60, s: 0.5 });
  ok(a.svg.includes(`stroke-width="${1.75 / 0.5}"`), 'outline 1.75 / s');
});
test('alveolus: emphasis lifts detail out of ax-d2', () => {
  const L = loaded(lung);
  ok(/data-part="wall type2"[^>]*class="ax-d2"|class="ax-d2"[^>]*data-part="wall type2"/.test(L.alveolus({ r: 60 }).svg) || /ax-d2/.test(partMarkup(L.alveolus({ r: 60 }).svg, 'type2')), 'type II detail is ax-d2 by default');
  ok(!/ax-d2/.test(partMarkup(L.alveolus({ r: 60, emphasis: ['type2'] }).svg, 'type2')), 'emphasis lifts it');
});

/* ---------- alveolarCapillary ---------- */
const sac = (o = {}) => loaded(lung).alveolus({ x: 240, y: 190, r: 70, duct: 40, ...o });
test('capillary: is an Art with parts capillary, arteriole, venule, exchange', () => {
  const c = loaded(lung).alveolarCapillary({ around: sac(), w: 12, exchange: { phase: 0.3 } });
  isArt(c, 'capillary');
  for (const n of ['capillary', 'arteriole', 'venule', 'exchange']) ok(partsOf(c.svg).has(n), `part ${n}`);
  ok(scan(c.svg).nested.length === 0, 'leaf parts');
  for (const k of ['capillary', 'in', 'out', 'contact']) ok(Array.isArray(c.at[k]), `at.${k}`);
  ok(resolves(c.svg).length === 0, 'url(#) resolve');
  const r = loaded(lung).alveolarCapillary({ around: sac(), w: 12, parts: { capillary: 'blood' } });
  ok(partsOf(r.svg).has('blood') && !partsOf(r.svg).has('capillary'), 'renamable');
});
test('capillary: touches the alveolar wall along the contact arc (no gap)', () => {
  const L = loaded(lung);
  for (const w of [3, 8, 14]) {
    const a = sac(), c = L.alveolarCapillary({ around: a, w }), G = c.geom;
    const outer = a.geom.outerPts.map(p => [p[0] + 240, p[1] + 190]);
    for (const [x, y] of G.centre.filter((_, i) => i % 6 === 0)) {
      const d = core.distToPolygon([x, y], outer);
      near(d, G.wallT + w / 2, 1.2, `w ${w}: centreline sits one capillary half-width off the wall`);
    }
    ok(G.span >= 240, `contact arc about 270 degrees: ${G.span}`);
  }
});
test('capillary: lumen width is the model width', () => {
  const c = loaded(lung).alveolarCapillary({ around: sac(), w: 9.5 });
  ok(new RegExp(`stroke-width="9\\.5"`).test(partMarkup(c.svg, 'capillary')), 'a 9.5 lumen stroke');
});
test('capillary: blood runs deoxygenated to oxygenated along the flow', () => {
  const { P, mix } = loaded(core), c = loaded(lung).alveolarCapillary({ around: sac(), w: 12, from: 0, to: 1 });
  const cols = c.geom.lumenColours;
  ok(cols[0] === P.deoxy.base && cols[cols.length - 1] === P.oxy.base, `ends ${cols[0]} to ${cols[cols.length - 1]}`);
  const red = h => parseInt(h.slice(1, 3), 16);
  for (let i = 1; i < cols.length; i++) ok(red(cols[i]) >= red(cols[i - 1]), 'warms monotonically');
  const half = loaded(lung).alveolarCapillary({ around: sac(), w: 12, from: 0, to: 0.5 }).geom.lumenColours;
  ok(half[half.length - 1] === mix(P.deoxy.base, P.oxy.base, 0.5), 'leaves at the model\'s mix');
});
test('capillary: red cells loop seamlessly with phase and fill the lumen in single file', () => {
  const L = loaded(lung), cells = ph => L.alveolarCapillary({ around: sac(), w: 12, cells: { n: 8, phase: ph } }).geom.cells;
  const a = cells(0), b = cells(1);
  ok(a.length === 8, 'eight cells');
  for (let i = 0; i < 8; i++) { near(a[i].x, b[i].x, 0.01, 'phase 0 = phase 1'); near(a[i].y, b[i].y, 0.01, 'phase 0 = phase 1'); }
  for (const c of a) { ok(2 * c.ry <= 12 && 2 * c.rx >= 10, `cell ${2 * c.rx} x ${2 * c.ry} fits the lumen and stays 10 units long`); }
  ok(cells(0.25)[0].sat > cells(0)[0].sat || cells(0.25)[0].s < cells(0)[0].s, 'cells move along the flow');
  const plasma = L.alveolarCapillary({ around: sac(), w: 12, cells: { n: 8 } });
  ok(partMarkup(plasma.svg, 'capillary').includes(core.P.plasma.base), 'lumen is plasma when cells are drawn');
  ok(L.alveolarCapillary({ around: sac(), w: 3, cells: { n: 8 } }).geom.cells.length === 0, 'no cells where they cannot fit');
});
test('capillary: O2 crosses outward into the blood, CO2 inward into the air', () => {
  const L = loaded(lung), a = sac();
  const at = ph => L.alveolarCapillary({ around: a, w: 12, exchange: { phase: ph } }).geom.molecules;
  const r = p => Math.hypot(p.x - 240, p.y - 190);
  const m1 = at(0.2), m2 = at(0.4);
  const o1 = m1.filter(m => m.kind === 'o2'), o2 = m2.filter(m => m.kind === 'o2'), c1 = m1.filter(m => m.kind === 'co2'), c2 = m2.filter(m => m.kind === 'co2');
  ok(o1.length >= 3 && c1.length >= 3, 'at least three sites of each');
  ok(o1.every((m, i) => r(o2[i]) > r(m) || o2[i].u < m.u), 'O2 moves outward');
  ok(c1.every((m, i) => r(c2[i]) < r(m) || c2[i].u < m.u), 'CO2 moves inward');
  const svg = L.alveolarCapillary({ around: a, w: 12, exchange: { phase: 0.3 } }).svg, ex = partMarkup(svg, 'exchange');
  ok(ex.includes(core.P.ui.blue), 'O2 arrows in kit blue (a flat mark, never venous blue)');
  ok(ex.includes(core.P.oxygen.base) && ex.includes(core.P.carbon.base), 'O2 and CO2 glyphs in the atom colours');
});
test('capillary: no blood draws a collapsed pale vessel, never a gap', () => {
  const c = loaded(lung).alveolarCapillary({ around: sac(), w: 0 });
  const m = partMarkup(c.svg, 'capillary');
  ok(m.length > 100, 'the vessel is still drawn');
  ok(!m.includes(core.P.deoxy.base) && !m.includes(core.P.oxy.base), 'no blood colour');
});
test('capillary: arteriole is artery wall with venous blood; venule is vein wall with arterial blood', () => {
  const { P } = loaded(core), c = loaded(lung).alveolarCapillary({ around: sac(), w: 12 });
  const a = partMarkup(c.svg, 'arteriole'), v = partMarkup(c.svg, 'venule');
  ok(a.includes(P.artery.line) && a.includes(P.deoxy.base), 'arteriole: artery wall, deoxygenated lumen');
  ok(v.includes(P.vein.line) && v.includes(P.oxy.base), 'venule: vein wall, oxygenated lumen');
  const n = loaded(lung).alveolarCapillary({ around: sac(), w: 12, feeders: false });
  ok(!partsOf(n.svg).has('arteriole'), 'feeders: false');
});
test('capillary: outline(state) gives the two lumen edges for a dashed ghost', () => {
  const c = loaded(lung).alveolarCapillary({ around: sac(), w: 12 });
  const g = c.outline({ w: 12 });
  ok(g.split('M').length === 3, 'two edges');
  ok(c.outline({ w: 4 }) !== g, 'edges follow w');
});
test('capillary: along(s) gives a point, angle and oxygenation on the channel', () => {
  const c = loaded(lung).alveolarCapillary({ around: sac(), w: 12, from: 0, to: 1 });
  const p0 = c.along(0), p1 = c.along(1);
  ok(p0.sat === 0 && p1.sat === 1, 'oxygenation from 0 to 1');
  ok(Number.isFinite(p0.x) && Number.isFinite(p0.angle), 'point and angle');
});
test('capillary: two instances share no ids', () => {
  const a = loaded(lung).alveolarCapillary({ around: sac(), w: 12 }).svg + sac().svg;
  const b = loaded(lung).alveolarCapillary({ around: sac(), w: 12 }).svg + sac().svg;
  const ia = scan(a).ids, ib = scan(b).ids;
  ok(ia.every(i => !ib.includes(i)), 'unique per instance');
  const k1 = sac({ key: 'k' }).svg, k2 = sac({ key: 'k' }).svg;
  ok(scan(k1).ids.join() === scan(k2).ids.join(), 'a key makes ids stable');
});

/* ---------- lungsFrontal ---------- */
test('lungs: is an Art with parts lungs, right-lung, left-lung, trachea, airways, diaphragm', () => {
  const a = loaded(lung).lungsFrontal({ x: 240, y: 20 });
  isArt(a, 'lungs');
  const parts = partsOf(a.svg);
  for (const n of ['lungs', 'right-lung', 'left-lung', 'trachea', 'airways', 'diaphragm']) ok(parts.has(n), `part ${n}`);
  ok(scan(a.svg).nested.length === 0, 'leaf parts');
  ok(resolves(a.svg).length === 0, `url(#) resolve: ${resolves(a.svg)[0]}`);
  near(a.box[0] + a.box[2] / 2, 240, 6, 'anchor is the trachea top centre (x)');
  near(a.box[1], 20, 6, 'anchor is the trachea top (y)');
  ok(a.box[2] <= 300 && a.box[3] <= 262, `native box about 300 x 260: ${a.box}`);
  for (const k of ['trachea', 'carina', 'right-lung', 'left-lung', 'notch', 'lingula', 'twig-r', 'twig-l', 'heart', 'diaphragm']) ok(Array.isArray(a.at[k]), `at.${k}`);
});
test('lungs: right three lobes (two fissures), left two lobes (one fissure)', () => {
  const G = loaded(lung).lungsFrontal().geom;
  ok(G.fissures.right.length === 2 && G.fissures.left.length === 1, 'fissure counts');
  ok(Object.keys(G.lobes).sort().join() === 'lll,lul,rll,rml,rul', 'five lobes');
});
test('lungs: the left lung has a cardiac notch above the lingula', () => {
  const G = loaded(lung).lungsFrontal().geom;
  const medialX = (y0, y1) => Math.min(...G.left.filter(p => p[1] >= y0 && p[1] <= y1).map(p => p[0]));
  const above = medialX(100, 140), notch = medialX(165, 195), ling = medialX(212, 232);
  ok(notch > above + 14, `notch cuts laterally: ${notch} vs ${above}`);
  ok(ling < notch - 6, `lingula comes back medially below it: ${ling} vs ${notch}`);
});
test('lungs: the right main bronchus is shorter, wider and steeper than the left', () => {
  const { right, left } = loaded(lung).lungsFrontal().geom.main;
  const L = b => Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]), steep = b => Math.atan2(Math.abs(b.to[0] - b.from[0]), b.to[1] - b.from[1]) * 180 / Math.PI;
  ok(L(right) < L(left), 'shorter'); ok(right.w > left.w, 'wider'); ok(steep(right) < steep(left) - 12, `steeper: ${steep(right).toFixed(0)} vs ${steep(left).toFixed(0)} degrees from vertical`);
});
test('lungs: trachea has C rings; the right dome sits higher', () => {
  const L = loaded(lung).lungsFrontal(), G = L.geom;
  ok(G.rings >= 6, `rings ${G.rings}`);
  const base = pts => Math.max(...pts.map(p => p[1]));
  ok(base(G.right) < base(G.left), 'right base above left base');
});
test('lungs: breathing enlarges the lungs; the trachea stays', () => {
  const L = loaded(lung), a = L.lungsFrontal({ breathe: 0 }), b = L.lungsFrontal({ breathe: 1 });
  const area = pts => Math.abs(core.areaOf(pts));
  const k = area(b.geom.right) / area(a.geom.right);
  ok(k > 1.06 && k < 1.25, `inspiration enlarges by 6 to 25 %: ${k.toFixed(3)}`);
  near(a.at.trachea[1], b.at.trachea[1], 0.01, 'trachea fixed');
  ok(pathArea(b.outline({ breathe: 1 })) > pathArea(a.outline({ breathe: 0 })), 'outline follows breathe');
});
test('lungs: a lobe highlight is a blue wash clipped to its lung', () => {
  const a = loaded(lung).lungsFrontal({ lobes: ['rml'] });
  ok(a.svg.includes(core.P.ui.blueWash), 'wash');
  ok(!loaded(lung).lungsFrontal().svg.includes(core.P.ui.blueWash), 'none by default');
});
test('lungs: the deeper airways stay inside the lungs (clipped)', () => {
  const a = loaded(lung).lungsFrontal({ key: 'clip' });
  ok(/<g[^>]*clip-path="url\(#ax-/.test(partMarkup(a.svg, 'airways')), 'the bronchial tree is clipped to the lungs');
});

/* ---------- glyphs ---------- */
test('glyphs: O2 is two oxygen spheres, CO2 is oxygen, carbon, oxygen', () => {
  const L = loaded(lung), { P } = loaded(core);
  const o = L.o2Glyph(0, 0), c = L.co2Glyph(0, 0);
  // drawn by molecules.js (one gas drawing course-wide): atoms are marked data-atom
  ok((o.match(/data-atom="O"/g) || []).length === 2 && !/data-atom="C"/.test(o) && o.includes(P.oxygen.base), 'O2 dumbbell');
  ok((c.match(/data-atom="O"/g) || []).length === 2 && (c.match(/data-atom="C"/g) || []).length === 1 && c.includes(P.carbon.base), 'CO2 three spheres');
});

/* ---------- lints ---------- */
const files = ['lab/kit/art/lung.js', 'tools/art-tests/lung.test.mjs', 'tools/art-gallery/lung.html'].map(f => root + f).filter(f => fs.existsSync(f));
test('lint: no em or en dash', () => {
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`); }
});
test('lint: no hex colour in lung.js', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/lung.js', 'utf8'), hits = s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `lung.js: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: fill() only on fills; art imported unversioned', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/lung.js', 'utf8');
  ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), 'fill() on a stroke');
  for (const f of files) ok(!/art\/[\w-]+\.js\?v=/.test(fs.readFileSync(f, 'utf8')), `${path.basename(f)} imports a versioned art module`);
});
test('lint: every primitive at every state has leaf parts and resolving ids', () => {
  const L = loaded(lung);
  const all = [
    L.alveolus({ r: 30, fluid: 1, duct: 20 }), L.alveolus({ r: 120, fluid: 0.3, fluidCells: 5, duct: { len: 30, lumen: 2 } }),
    L.alveolarCapillary({ around: sac(), w: 0.5, cells: { n: 5 }, exchange: {} }), L.lungsFrontal({ breathe: 0.5, lobes: ['rul', 'lll'], under: '<g></g>' }),
  ];
  for (const a of all) { ok(scan(a.svg).nested.length === 0, 'leaf parts'); ok(resolves(a.svg).length === 0, 'ids resolve'); ok(!/NaN|undefined/.test(a.svg), 'no NaN or undefined in markup'); }
});
test('lint: one frame of a capillary with cells and exchange costs well under 2 ms', () => {
  const L = loaded(lung), a = sac({ key: 'perf' });
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) L.alveolarCapillary({ around: a, w: 12, cells: { n: 10, phase: i / 50 }, exchange: { phase: i / 50 }, key: 'perf' });
  const ms = (performance.now() - t0) / 50;
  ok(ms < 2, `${ms.toFixed(2)} ms per frame`);
});

/* ---------- run ---------- */
let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  if (only && !name.includes(only)) continue;
  try { await fn(); pass++; console.log(`ok    ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e instanceof Fail ? e.message : e.stack}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
