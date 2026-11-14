#!/usr/bin/env node
// Node tests for lab/kit/art/molecules.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/molecules.test.mjs          every test
//   node tools/art-tests/molecules.test.mjs ion      only tests whose name contains "ion"
// No dependencies; same style as tools/lab-art-test.mjs. Written before molecules.js existed and run failing.
//
// What is tested, and why (art direction sections 2.5, 2.7, 3, 4.0b and 4.12):
//   ion          eight species (na k ca cl h hco3 po4 mg), each with its own shape AND colour (colour-blind
//                safe); the fill is the species' P entry; the charge is a vector mark (no <text>) whose
//                colour contrasts 3:1 or more with the fill; H+ is 0.7 of Na+; every glyph is at least 8
//                units across; marks and highlight stay upright when the glyph is rotated.
//   ionLabel     the species name in its text class (amber Na, green K, teal Ca, muted Cl, ink otherwise),
//                kit classes only (never under 17 units), the charge drawn as a vector superscript in the
//                same colour with the panel halo, so a "2+" is as legible as the letters.
//   molecules    O2 two oxygen spheres; CO2 O-C-O with carbon in the middle; CO two unequal spheres; water
//                a drop; glucose a hexagon with one ring-oxygen vertex; ATP adenine, ribose and three
//                phosphates (2 for ADP, 1 for AMP) with the terminal phosphate released by `release`;
//                cAMP one phosphate bonded back into the ribose (the cyclic ring); acetylcholine two
//                lobes (choline with its positive charge, acetate) that separate with `split`;
//                noradrenaline a bronze sphere, adrenaline the same with a core dot; histamine a ring
//                with a tail.
//   peptide      count-accurate beads (ang I 10, ang II 8, TRH 3, vasopressin a 6-bead disulfide ring plus
//                a 3-bead tail), two chains with two links (insulin), cleave moves the cut-off beads away.
//   steroid      6-6-6-5: three hexagons and one pentagon, each fused ring sharing an edge with the next;
//                cortisol, aldosterone, cholesterol (with its side chain) and the hollow drug form;
//                calcitriol is refused (a secosteroid never uses this glyph).
//   drug         every family in the direction is a distinct drug-purple glyph; the name tag is kit text
//                (sm b purple) outside every scaled group and clear of the glyph.
//   common       Art shape; placement maps box and at; parts renames; weight strokes keep their weight at
//                any scale; outline() is a path in picture coordinates; pure functions of their options.
//   lints        no nested data-part, unique ids (none are made), no em or en dash, no hex colour in
//                molecules.js, core imported unversioned, fill() never on a stroke.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const only = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

const core = await import(root + 'lab/kit/art/core.js');
const M = await import(root + 'lab/kit/art/molecules.js').catch(e => ({ __error: e }));
const loaded = () => { if (M.__error) throw new Fail(`module did not load: ${M.__error.message}`); return M; };
const { P } = core;

/* ---------- markup helpers ---------- */
function scan(markup) {
  const stack = [], ids = [], nested = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(markup))) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const part = /\sdata-part="([^"]*)"/.exec(attrs);
    if (part && stack.some(s => s.part)) nested.push(`${part[1]} inside ${stack.filter(s => s.part).map(s => s.part).join(' > ')}`);
    const id = /\sid="([^"]+)"/.exec(attrs);
    if (id) ids.push(id[1]);
    const tf = /\stransform="([^"]*)"/.exec(attrs);
    if (!self) stack.push({ tag, part: part ? part[1] : null, scaled: !!(tf && /scale\(/.test(tf[1])) });
    if (tag === 'text' && stack.some(s => s.scaled)) nested.push('text inside a scaled group');
  }
  return { ids, nested };
}
const partsOf = markup => new Set([...markup.matchAll(/data-part="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
const isArt = a => a && typeof a.svg === 'string' && `${a}` === a.svg && Array.isArray(a.box) && a.box.length === 4 && typeof a.at === 'object' && typeof a.outline === 'function';
const fills = svg => [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1]);
const count = (svg, re) => (svg.match(re) || []).length;
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const KEYS = ['na', 'k', 'ca', 'cl', 'h', 'hco3', 'po4', 'mg'];

/* ---------- ion ---------- */
test('ion: every key is an Art centred on its anchor', () => {
  const { ion } = loaded();
  for (const k of KEYS) {
    const a = ion(k, { x: 100, y: 50 });
    ok(isArt(a), `${k}: Art shape`);
    near(a.box[0] + a.box[2] / 2, 100, 1, `${k} box centre x`); near(a.box[1] + a.box[3] / 2, 50, 1, `${k} box centre y`);
    near(a.at.centre[0], 100, 1e-6, `${k} at.centre x`);
    ok(Math.min(a.box[2], a.box[3]) >= 8, `${k} is at least 8 units across (${a.box})`);
  }
  let threw = false; try { ion('zz'); } catch { threw = true; }
  ok(threw, 'an unknown species throws');
});
test('ion: each species has its own shape and its P colour', () => {
  const { ion, ION } = loaded();
  const shapes = new Set(KEYS.map(k => ION[k].shape));
  ok(shapes.size === KEYS.length, `distinct shapes: ${[...shapes]}`);
  for (const k of KEYS.filter(k => k !== 'mg')) ok(fills(ion(k).svg).includes(P[k].base), `${k} fill is P.${k}.base`);
  ok(ION.na.shape === 'circle' && ION.k.shape === 'triangle' && ION.ca.shape === 'roundSquare' && ION.cl.shape === 'diamond' && ION.hco3.shape === 'trefoil' && ION.po4.shape === 'ring', 'shapes follow section 2.5');
  near(ION.h.r / ION.na.r, 0.7, 0.01, 'H+ is 0.7 of Na+');
});
test('ion: charges are vector marks that contrast with the fill', () => {
  const { ion, ION } = loaded();
  const want = { na: '+', k: '+', ca: '2+', cl: '-', h: '+', hco3: '-', mg: '2+' };
  for (const [k, c] of Object.entries(want)) {
    ok(ION[k].charge === c, `${k} charge ${ION[k].charge}`);
    const a = ion(k);
    ok(!/<text/.test(a.svg), `${k}: no text in the glyph`);
    const mark = /data-charge="([^"]+)"[^>]*stroke="(#[0-9a-f]{6})"/.exec(a.svg);
    ok(mark && mark[1] === c, `${k}: a data-charge mark of ${c}`);
    ok(contrast(mark[2], ION[k].fill) >= 3, `${k}: mark ${mark[2]} on ${ION[k].fill} contrast ${contrast(mark[2], ION[k].fill).toFixed(2)}`);
    ok(!/data-charge/.test(ion(k, { charge: false }).svg), `${k}: charge false drops the mark`);
  }
  ok(/data-charge="2-"/.test(ion('po4', { charge: '2-' }).svg), 'a charge string overrides (hydrogen phosphate 2-)');
});
test('ion: rotation turns the shape but keeps marks and the light upright', () => {
  const { ion } = loaded();
  const a = ion('k'), b = ion('k', { rot: 40 });
  ok(a.outline() !== b.outline(), 'the triangle turns');
  // the mark's shape, relative to its first point: equal means upright (it only moved to the incentre)
  const mark = svg => { const n = [.../data-charge="[^"]+" d="([^"]+)"/.exec(svg)[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]]); return n.map(q => `${(q[0] - n[0][0]).toFixed(1)},${(q[1] - n[0][1]).toFixed(1)}`).join(' '); };
  ok(mark(a.svg) === mark(b.svg), 'the charge mark stays upright');
  ok(!/rotate\(/.test(b.svg), 'points are turned, not the light (no rotate transform on an ion)');
});
test('ion: weight strokes keep their on-screen weight', () => {
  const { ion } = loaded();
  const w = svg => +/data-outline[^>]*stroke-width="([\d.]+)"/.exec(svg)[1];
  near(w(ion('na', { s: 2 }).svg) * 2, w(ion('na').svg) * 1, 0.5, 'outline weight at s 2');
  ok(w(ion('na').svg) >= 1.25, 'outline at least 1.25 (meaningful stroke)');
});
test('ion: parts rename; ionSymbols for mount scenes', () => {
  const { ion, ionSymbols } = loaded();
  ok(partsOf(ion('na').svg).has('sodium'), 'default part sodium');
  ok(partsOf(ion('hco3').svg).has('bicarbonate'), 'default part bicarbonate');
  const r = ion('na', { parts: { sodium: 'ions' } });
  ok(partsOf(r.svg).has('ions') && !partsOf(r.svg).has('sodium'), 'renamed to ions');
  const sym = ionSymbols(['na', 'k']);
  ok(count(sym, /<symbol /g) === 2 && /id="ax-ion-na"/.test(sym), 'symbols with ax- ids');
});

/* ---------- ionLabel ---------- */
test('ionLabel: kit text class per species and a vector charge', () => {
  const { ionLabel } = loaded();
  const cls = { na: 'amber', k: 'green', ca: 'teal', cl: 'muted' };
  for (const [k, c] of Object.entries(cls)) {
    const a = ionLabel(k, { x: 10, y: 40 });
    ok(isArt(a), `${k} Art`);
    ok(new RegExp(`<text[^>]*class="[^"]*\\b${c}\\b`).test(a.svg), `${k} text class ${c}`);
    ok(!/<text[^>]*>[^<]*[+-]/.test(a.svg), `${k}: no charge characters in the text`);
  }
  const ca = ionLabel('ca', { x: 0, y: 30 });
  ok(/data-charge="2\+"/.test(ca.svg), 'Ca label carries a 2+ mark');
  ok(/stroke="#ecefe5"/.test(ca.svg), 'charge has the panel halo');
  ok(!/font-size|style=/.test(ca.svg), 'no inline sizes');
  const a = ionLabel('na', { x: 0, y: 30 }), b = ionLabel('na', { x: 0, y: 30, cls: 'lg b' });
  ok(b.box[2] > a.box[2] && b.box[3] > a.box[3], 'charge grows with the class');
  ok(a.box[3] >= 12, `label box tall enough for 17-unit type (${a.box})`);
  const sub = ionLabel('hco3', { x: 0, y: 30 });
  ok(/<tspan[^>]*dy=/.test(sub.svg), 'HCO3 subscript as a shifted tspan at the same size');
  let bad = false; try { ionLabel('na', { cls: 'tiny' }); } catch { bad = true; }
  ok(bad, 'non-kit classes refused');
});

/* ---------- small molecules ---------- */
test('molecules: O2, CO2, CO by their atoms', () => {
  const { o2, co2, co } = loaded();
  const atoms = svg => [...svg.matchAll(/data-atom="(\w+)"/g)].map(m => m[1]);
  ok(atoms(o2().svg).join() === 'O,O', `O2 atoms ${atoms(o2().svg)}`);
  ok(atoms(co2().svg).join() === 'O,C,O', `CO2 atoms ${atoms(co2().svg)}`);
  ok(atoms(co().svg).join() === 'C,O', `CO atoms ${atoms(co().svg)}`);
  ok(fills(o2().svg).includes(P.oxygen.base) && fills(co2().svg).includes(P.carbon.base), 'one atom colour per element');
  const r = svg => [...svg.matchAll(/data-atom="(\w)"[^>]*\sr="([\d.]+)"/g)].map(m => +m[2]);
  const [rc, ro] = r(co().svg);
  ok(rc > ro, 'CO spheres unequal (carbon larger: van der Waals C 1.70, O 1.52 angstrom)');
  for (const fn of [o2, co2, co]) ok(Math.min(fn().box[2], fn().box[3]) >= 8, 'at least 8 across');
});
test('molecules: water drop and glucose ring', () => {
  const { water, glucose } = loaded();
  ok(fills(water().svg).includes(P.water.base), 'water colour');
  ok(water().box[3] > water().box[2], 'a drop is taller than wide');
  const g = glucose();
  ok(fills(g.svg).includes(P.glucose.base), 'glucose colour');
  ok(count(g.svg, /data-atom="O"/g) === 1, 'one ring oxygen');
  ok(/data-ring="6"/.test(g.svg), 'six-membered ring');
  ok(partsOf(g.svg).has('glucose') && partsOf(glucose({ parts: { glucose: 'sugar' } }).svg).has('sugar'), 'parts');
});
test('molecules: ATP, ADP, AMP and release of the terminal phosphate', () => {
  const { atp } = loaded();
  const ph = svg => count(svg, /data-phosphate=/g);
  ok(ph(atp().svg) === 3 && ph(atp({ phosphates: 2 }).svg) === 2 && ph(atp({ phosphates: 1 }).svg) === 1, 'phosphate counts');
  ok(/data-base="adenine"/.test(atp().svg) && /data-sugar="ribose"/.test(atp().svg), 'adenine and ribose');
  const a0 = atp({ release: 0 }), a1 = atp({ release: 1 });
  ok(a1.at.gamma[0] - a0.at.gamma[0] >= 8, `released phosphate moves away (${a0.at.gamma} to ${a1.at.gamma})`);
  ok(atp({ release: 0 }).svg === atp().svg, 'release 0 is the default');
});
test('molecules: cAMP is cyclic', () => {
  const { camp } = loaded();
  const c = camp();
  ok(count(c.svg, /data-phosphate=/g) === 1, 'one phosphate');
  ok(count(c.svg, /data-bond="cyclic"/g) === 2, 'phosphate bonded twice into the ribose ring side');
});
test('molecules: acetylcholine splits; catecholamines and histamine', () => {
  const { acetylcholine, noradrenaline, adrenaline, histamine, transmitter } = loaded();
  const a = acetylcholine(), b = acetylcholine({ split: 1 });
  ok(/data-lobe="choline"/.test(a.svg) && /data-lobe="acetate"/.test(a.svg), 'two lobes');
  ok(/data-charge="\+"/.test(a.svg), 'choline carries its positive charge');
  ok(b.at.acetate[0] - b.at.choline[0] > a.at.acetate[0] - a.at.choline[0] + 6, 'split separates the lobes');
  ok(fills(a.svg).includes(P.ach.base), 'acetylcholine rose');
  ok(fills(noradrenaline().svg).includes(P.noradrenaline.base), 'noradrenaline bronze');
  ok(/data-core/.test(adrenaline().svg) && !/data-core/.test(noradrenaline().svg), 'adrenaline has the core dot');
  ok(fills(histamine().svg).includes(P.histamine.base), 'histamine orange');
  ok(transmitter('ne').svg === noradrenaline().svg && transmitter('ach').svg === acetylcholine().svg, 'transmitter(key)');
});

/* ---------- peptide ---------- */
test('peptide: count-accurate beads', () => {
  const { peptide } = loaded();
  const beads = svg => count(svg, /data-bead=/g);
  ok(beads(peptide({ n: 10 }).svg) === 10, 'n 10');
  ok(beads(peptide({ kind: 'angI' }).svg) === 10 && beads(peptide({ kind: 'angII' }).svg) === 8, 'angiotensin I 10, II 8');
  ok(beads(peptide({ kind: 'trh' }).svg) === 3, 'TRH 3');
  const adh = peptide({ kind: 'adh' });
  ok(beads(adh.svg) === 9, 'vasopressin 9');
  ok(count(adh.svg, /data-disulfide=/g) === 1, 'one disulfide closing the ring');
  ok(/data-disulfide="1-6"/.test(adh.svg), 'Cys1 to Cys6');
  const ins = peptide({ kind: 'insulin' });
  ok(count(ins.svg, /data-chain=/g) === 2 && count(ins.svg, /data-disulfide=/g) === 2, 'insulin: two chains, two links');
  ok(fills(ins.svg).includes(P.insulin.base), 'insulin teal-green');
  ok(partsOf(peptide({ kind: 'angII' }).svg).has('angiotensin'), 'angiotensin part');
});
test('peptide: cleave moves the cut-off beads', () => {
  const { peptide } = loaded();
  const a = peptide({ n: 10, cleave: { at: 8, gap: 0 } }), b = peptide({ n: 10, cleave: { at: 8, gap: 1 } });
  ok(b.at.cut[0] - a.at.cut[0] >= 6, `cut-off piece moves (${a.at.cut} to ${b.at.cut})`);
  ok(count(b.svg, /data-bond="peptide"/g) === count(a.svg, /data-bond="peptide"/g) - 1, 'the cut bond is gone');
  ok(peptide({ n: 10, cleave: { at: 8, gap: 0 } }).svg === peptide({ n: 10, cleave: { at: 8, gap: 0 } }).svg, 'pure');
});

/* ---------- steroid ---------- */
test('steroid: 6-6-6-5 fused rings', () => {
  const { steroid, steroidGeometry } = loaded();
  const g = steroidGeometry();
  ok(g.rings.map(r => r.length).join() === '6,6,6,5', `ring sizes ${g.rings.map(r => r.length)}`);
  const shared = (a, b) => a.filter(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)).length;
  ok(shared(g.rings[0], g.rings[1]) === 2 && shared(g.rings[1], g.rings[2]) === 2 && shared(g.rings[2], g.rings[3]) === 2, 'A-B, B-C, C-D each share one edge');
  ok(shared(g.rings[0], g.rings[2]) === 0, 'A and C are not fused');
  const s = steroid();
  near(s.box[2], 40, 2, 'native width 40'); ok(s.box[3] <= 30, 'native height about 26');
  for (const k of ['cortisol', 'aldosterone', 'cholesterol']) ok(fills(steroid({ kind: k }).svg).includes(P[k].base), `${k} colour`);
  ok(/data-tail/.test(steroid({ kind: 'cholesterol' }).svg) && !/data-tail/.test(steroid({ kind: 'cortisol' }).svg), 'cholesterol has its side chain');
  const d = steroid({ kind: 'drug' });
  ok(/fill-opacity="0?\.3"/.test(d.svg) && d.svg.includes(P.drug.line), 'the drug form is hollow: cortisol at 30 % with a drug outline');
  let threw = false; try { steroid({ kind: 'calcitriol' }); } catch { threw = true; }
  ok(threw, 'calcitriol refused (secosteroid)');
  ok(partsOf(steroid({ kind: 'aldosterone' }).svg).has('aldosterone'), 'part per kind');
});

/* ---------- drug ---------- */
test('drug: every family is a distinct drug-purple glyph', () => {
  const { drug, DRUG_FAMILIES } = loaded();
  const want = ['plug', 'selectivePlug', 'acetyl', 'wedge', 'cap', 'ring', 'bulky', 'dumbbell', 'hexagonAntacid', 'chain', 'clamp', 'stub', 'lock'];
  for (const k of want) ok(DRUG_FAMILIES.includes(k), `family ${k}`);
  const sils = new Set();
  for (const k of want) {
    const a = drug({ family: k });
    ok(isArt(a), `${k} Art`);
    ok(fills(a.svg).includes(P.drug.base) && a.svg.includes(P.drug.line), `${k} drug colours`);
    ok(partsOf(a.svg).has('drug'), `${k} part drug`);
    sils.add(a.outline());
    ok(Math.max(a.box[2], a.box[3]) >= 12, `${k} at least 12 across`);
  }
  ok(sils.size === want.length, 'distinct silhouettes');
});
test('drug: name tag is kit text, unscaled, clear of the glyph', () => {
  const { drug } = loaded();
  for (const side of ['right', 'left', 'above', 'below']) {
    const a = drug({ x: 200, y: 100, s: 1.6, name: 'aspirin', tag: side });
    ok(/<text[^>]*class="sm b purple"[^>]*>aspirin<\/text>/.test(a.svg), `${side}: sm b purple text`);
    ok(!scan(a.svg).nested.length, `${side}: ${scan(a.svg).nested}`);
    ok(a.at.tag && a.tagBox && !overlap(a.tagBox, a.glyphBox), `${side}: tag clear of glyph`);
    ok(a.box[0] <= a.tagBox[0] && a.box[0] + a.box[2] >= a.tagBox[0] + a.tagBox[2] - 0.01, `${side}: box includes the tag`);
  }
  ok(!/<text/.test(drug({ family: 'wedge' }).svg), 'no name, no text');
});

/* ---------- common ---------- */
const ALL = () => {
  const L = loaded();
  return [
    ...KEYS.map(k => ['ion ' + k, o => L.ion(k, o)]),
    ['o2', L.o2], ['co2', L.co2], ['co', L.co], ['water', L.water], ['glucose', L.glucose], ['atp', L.atp], ['camp', L.camp],
    ['ach', L.acetylcholine], ['ne', L.noradrenaline], ['adrenaline', L.adrenaline], ['histamine', L.histamine],
    ['peptide', o => L.peptide({ kind: 'adh', ...o })], ['insulin', o => L.peptide({ kind: 'insulin', ...o })],
    ['steroid', L.steroid], ['cholesterol', o => L.steroid({ kind: 'cholesterol', ...o })],
    ...L.DRUG_FAMILIES.map(k => ['drug ' + k, o => L.drug({ family: k, ...o })]),
  ];
};
test('common: placement, outline in picture coordinates, purity', () => {
  for (const [name, fn] of ALL()) {
    const a = fn(), b = fn({ x: 300, y: 200, s: 2 });
    ok(isArt(a), `${name} Art`);
    near(b.box[2], a.box[2] * 2, 0.6, `${name} box scales`);
    near(b.box[0] + b.box[2] / 2, 300 + (a.box[0] + a.box[2] / 2) * 2, 0.6, `${name} box moves`);
    const o = b.outline();
    ok(/^M[\d.-]/.test(o) && /Z$/.test(o.trim()), `${name} outline is a closed path`);
    const xs = [...o.matchAll(/[ML]?(-?[\d.]+) (-?[\d.]+)/g)].map(m => +m[1]);
    ok(Math.min(...xs) >= b.box[0] - 2 && Math.max(...xs) <= b.box[0] + b.box[2] + 2, `${name} outline inside its box`);
    ok(fn({ x: 3 }).svg === fn({ x: 3 }).svg, `${name} pure`);
    const P2 = o => new Set([...o.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => `${Math.sign(+m[1]) * Math.round(Math.abs(+m[1]) * 2)},${Math.round(+m[2] * 2)}`));
    const mir = new Set([...P2(fn().outline())].map(k => { const [x, y] = k.split(','); return `${-x},${y}`; }));
    const fl = P2(fn({ flip: true }).outline());
    ok([...fl].filter(k => mir.has(k)).length >= fl.size * 0.9, `${name} flip mirrors the outline`);
  }
});
test('common: leaf parts, no ids, no text in glyphs', () => {
  let body = '';
  for (const [, fn] of ALL()) body += fn({ x: 10, y: 10 }).svg;
  const { ids, nested } = scan(body);
  ok(!nested.length, `nested parts: ${nested.slice(0, 2)}`);
  ok(!ids.length, `primitives make no ids (${ids.slice(0, 3)})`);
  ok(!/<text/.test(body), 'glyphs draw no text');
  ok(!/url\(#/.test(body), 'no gradient references: flat layered shading only');
});
test('common: emphasis lifts detail out of ax-d2', () => {
  const { atp } = loaded();
  ok(/ax-d2/.test(atp().svg), 'detail class present');
  ok(!/ax-d2/.test(atp({ emphasis: ['atp'] }).svg), 'emphasis keeps every detail');
});

/* ---------- lints ---------- */
const src = root + 'lab/kit/art/molecules.js';
const own = [src, root + 'tools/art-tests/molecules.test.mjs', root + 'tools/art-gallery/molecules.html'].filter(f => fs.existsSync(f));
test('lint: no em or en dash', () => {
  for (const f of own) { const s = fs.readFileSync(f, 'utf8'); ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`); }
});
test('lint: no hex colour in molecules.js (every colour is a P entry or mixed from one)', () => {
  ok(fs.existsSync(src), 'molecules.js exists');
  const hits = fs.readFileSync(src, 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `hex literals: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: fill() only in fills; core imported unversioned', () => {
  const s = fs.readFileSync(src, 'utf8');
  ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), 'fill() on a stroke');
  ok(!/\.js\?v=/.test(s), 'versioned import');
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
