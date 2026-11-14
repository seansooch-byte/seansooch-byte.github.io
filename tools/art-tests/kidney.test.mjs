#!/usr/bin/env node
// Node tests for lab/kit/art/kidney.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/kidney.test.mjs            every test
//   node tools/art-tests/kidney.test.mjs nephron    only tests whose name contains "nephron"
// No dependencies; the same style as tools/lab-art-test.mjs. The browser half is the gallery,
// tools/art-gallery/kidney.html.
//
// What is tested, and why (art direction section 4.3, its "Accuracy" list, and sections 4.0b, 5, 7):
//   section  kidneySection is an Art anchored at the hilum, with leaf parts that rename; cortex outside
//            8 pyramids whose papillae point into the sinus and sit in minor calyces; artery, vein and
//            pelvis at the hilum, the ureter leaving downward; the left kidney is the mirror image;
//            shrink makes it smaller.
//   nephron  walledTubule: afferent wider than efferent; the DCT returns to its own corpuscle; the macula
//            densa is the end of the thick ascending limb, at the vascular pole between its own
//            arterioles; JG cells in the afferent wall; peritubular capillaries arise from the efferent
//            arteriole; vasa recta only with a juxtamedullary (long-looped) nephron; a collecting duct
//            shared with other nephrons; thin ascending limb and TAL water-tight; brush border only on
//            the proximal tubule; a track for particles that runs glomerulus to papilla.
//   cells    tubuleCellRow: the right transporters per segment (NHE3 and SGLT in PCT, NKCC2 in TAL,
//            NCC in DCT, ENaC, ROMK and aquaporin-2 in principal cells, the Na/K pump basolateral in
//            every one), apical slots on the apical membrane whatever the orientation, ions moving the
//            right way through each, block marks.
//   lints    no nested data-part, unique ids, every url(#) resolves, no text, no em or en dash, no hex
//            in kidney.js outside its TODO block, fill() only in fills, unversioned art imports.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const only = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const core = await import(root + 'lab/kit/art/core.js').catch(e => ({ __error: e }));
const kid = await import(root + 'lab/kit/art/kidney.js').catch(e => ({ __error: e }));
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
// Every url(#id) resolves: to an id in the same markup, or to a shared material that artDefs() emits.
function resolves(markup) {
  const { ids, refs } = scan(markup), have = new Set(ids), shared = loaded(core).artDefs(markup);
  return refs.filter(r => !have.has(r) && !shared.includes(`id="${r}"`));
}
// The opening tag attributes of every leaf group carrying a part name.
const partGroups = (markup, name) => [...markup.matchAll(/<g\b([^>]*\sdata-part="([^"]+)"[^>]*)>/g)].filter(m => m[2].split(/\s+/).includes(name)).map(m => m[1]);
function common(art, label) {
  ok(art && typeof art.svg === 'string' && art.svg.length > 200, `${label}: svg string`);
  ok(Array.isArray(art.box) && art.box.length === 4 && art.box.every(Number.isFinite), `${label}: box [x, y, w, h]`);
  ok(art.at && typeof art.at === 'object', `${label}: at`);
  ok(typeof art.outline === 'function' && typeof art.outline({}) === 'string', `${label}: outline(state) gives a path`);
  ok(`${art}` === art.svg, `${label}: toString is svg`);
  const sc = scan(art.svg);
  ok(!sc.nested.length, `${label}: nested parts: ${sc.nested.slice(0, 3).join('; ')}`);
  ok(new Set(sc.ids).size === sc.ids.length, `${label}: duplicate ids`);
  ok(sc.ids.every(i => /^ax-[\w-]+$/.test(i)), `${label}: every id is an ax- id without spaces`);
  const bad = resolves(art.svg);
  ok(!bad.length, `${label}: unresolved url(#): ${bad.slice(0, 3).join(' ')}`);
  ok(!/<text\b/.test(art.svg), `${label}: a primitive emits no text (labels are the lesson's)`);
  ok(!/font-size/.test(art.svg), `${label}: no font-size`);
  for (const [k, p] of Object.entries(art.at)) ok(Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite), `${label}: at.${k} is a point`);
}

/* ---------- module ---------- */
test('kidney: loads and exports', () => {
  const k = loaded(kid);
  for (const n of ['kidneySection', 'walledTubule', 'tubuleCellRow', 'NEPHRON_GEOM', 'nephronGeometry', 'SEGMENT_CELLS', 'TRANSPORT']) ok(k[n], `exports ${n}`);
});

/* ---------- kidneySection ---------- */
test('section: an Art with leaf parts, anchored at the hilum', () => {
  const { kidneySection } = loaded(kid);
  const a = kidneySection({ x: 200, y: 150, key: 't1' });
  common(a, 'kidneySection');
  for (const n of ['kidney', 'cortex', 'medulla', 'pelvis', 'ureter', 'renal-artery', 'renal-vein']) ok(partsOf(a.svg).has(n), `part ${n}`);
  near(a.at.hilum[0], 200, 0.01, 'hilum x is the anchor'); near(a.at.hilum[1], 150, 0.01, 'hilum y is the anchor');
  near(a.box[2], 140, 1, 'native width 140'); near(a.box[3], 210, 1, 'native height 210');
  const b = kidneySection({ x: 200, y: 150, s: 0.5, key: 't2' });
  near(b.box[2], 70, 1, 's scales the box');
  near(dist(b.at.hilum, b.at.ureter), dist(a.at.hilum, a.at.ureter) / 2, 0.5, 's scales the anchors');
});
test('section: parts rename and stay leaves', () => {
  const { kidneySection } = loaded(kid);
  const a = kidneySection({ parts: { kidney: 'organ', 'renal-artery': 'artery-in' }, nephron: true, adrenal: true, key: 'rn' });
  const ps = partsOf(a.svg);
  ok(ps.has('organ') && ps.has('artery-in') && !ps.has('kidney') && !ps.has('renal-artery'), 'renamed');
  ok(ps.has('nephron') && ps.has('adrenal'), 'optional nephron and adrenal parts');
  ok(!scan(a.svg).nested.length, 'leaves only');
});
test('section: 8 pyramids, papillae into the sinus, cortex outside them, minor calyces on every papilla', () => {
  const { kidneySection, kidneyGeometry } = loaded(kid);
  ok(kidneyGeometry, 'exports kidneyGeometry');
  const g = kidneyGeometry();
  ok(g.pyramids.length === 8, `8 pyramids, got ${g.pyramids.length}`);
  const poly = core.samplePath(g.outline, 200);
  for (const p of g.pyramids) {
    ok(dist(p.papilla, g.sinusCentre) < dist(p.base, g.sinusCentre) - 15, 'papilla points toward the sinus (the pyramids beside the hilum are the shortest)');
    ok(core.pointInPolygon(p.base, poly) && core.distToPolygon(p.base, poly) >= g.cortex * 0.7, 'pyramid base lies under the cortex');
    ok(p.calyx && dist(p.calyx, p.papilla) < 8, 'a minor calyx cups each papilla');
  }
  const a = kidneySection({ key: 'py' });
  ok((a.svg.match(/data-pyramid=/g) || []).length === 8, 'the markup holds 8 pyramids');
});
test('section: hilum holds artery, vein and pelvis; the ureter leaves downward; left is the mirror', () => {
  const { kidneySection } = loaded(kid);
  const r = kidneySection({ x: 100, y: 100, key: 'hr' }), l = kidneySection({ x: 300, y: 100, side: 'left', key: 'hl' });
  for (const k of ['renal-artery', 'renal-vein', 'pelvis']) ok(dist(r.at[k], r.at.hilum) < 34, `${k} at the hilum`);
  ok(r.at.ureter[1] > r.at.hilum[1] + 60, 'ureter leaves downward');
  ok(r.at.cortex[0] < r.at.hilum[0], 'right kidney: hilum faces the viewer\'s right (medial)');
  ok(l.at.cortex[0] > l.at.hilum[0], 'left kidney: hilum faces the viewer\'s left (medial)');
  near(l.at.cortex[0] - 300, -(r.at.cortex[0] - 100), 0.01, 'left is the mirror image');
  ok(r.at['renal-artery'][1] < r.at['renal-vein'][1] && r.at['renal-vein'][1] < r.at.pelvis[1], 'artery above vein above pelvis at the hilum');
});
test('section: shrink is smaller with a thinner cortex; outline(state) follows it', () => {
  const { kidneySection, kidneyGeometry } = loaded(kid);
  const a = kidneySection({ key: 'sh' });
  const A0 = Math.abs(core.areaOf(core.samplePath(a.outline({}), 200))), A1 = Math.abs(core.areaOf(core.samplePath(a.outline({ shrink: 1 }), 200)));
  ok(A1 < 0.8 * A0, `shrunk area ${A1} vs ${A0}`);
  ok(kidneyGeometry({ shrink: 1 }).cortex < kidneyGeometry().cortex * 0.75, 'cortex thins');
  ok(kidneySection({ shrink: 0.6, scar: 1, key: 'sc' }).svg !== a.svg, 'shrink and scar change the drawing');
});
test('section: two instances share no ids', () => {
  const { kidneySection } = loaded(kid);
  const a = scan(kidneySection().svg).ids, b = scan(kidneySection().svg).ids;
  ok(a.length && a.every(i => !b.includes(i)), 'unique per instance');
  const c = scan(kidneySection({ key: 'k1' }).svg).ids, d = scan(kidneySection({ key: 'k1' }).svg).ids;
  ok(c.join() === d.join(), 'stable with a key');
});

/* ---------- walledTubule (the nephron) ---------- */
test('nephron: an Art with the default parts', () => {
  const { walledTubule } = loaded(kid);
  const a = walledTubule({ key: 'n1' });
  common(a, 'walledTubule');
  for (const n of ['nephron', 'glomerulus', 'proximal', 'loop', 'tal', 'distal', 'collecting', 'afferent', 'efferent', 'jg', 'macula-densa', 'capillary', 'vasa-recta', 'cortex', 'medulla']) ok(partsOf(a.svg).has(n), `part ${n}`);
  near(a.box[2], 300, 1, 'native width 300'); near(a.box[3], 380, 1, 'native height 380');
});
test('nephron: afferent wider than efferent; JG cells in the afferent wall', () => {
  const { walledTubule, NEPHRON_GEOM } = loaded(kid);
  const a = walledTubule({ key: 'ae' });
  ok(a.widths.afferent > a.widths.efferent, 'afferent wider than efferent by default');
  const aff = NEPHRON_GEOM.afferent, jg = a.at.jg;
  const dAff = Math.min(...aff.map(p => dist(p, jg)));
  ok(dAff < a.widths.afferent, `JG cells on the afferent arteriole (${dAff})`);
  ok(dist(jg, a.at['vascular-pole']) < 20, 'JG cells at the vascular pole');
});
test('nephron: macula densa ends the TAL, at its own vascular pole between the arterioles', () => {
  const { walledTubule, NEPHRON_GEOM: G } = loaded(kid);
  const a = walledTubule({ key: 'md' });
  const md = a.at['macula-densa'], pole = a.at['vascular-pole'], tal = G.tal, dct = G.dct;
  ok(dist(md, tal[tal.length - 1]) < 10, 'macula densa at the end of the TAL');
  ok(dist(tal[tal.length - 1], dct[0]) < 0.01, 'the DCT begins where the TAL ends');
  ok(dist(md, pole) < 18, `macula densa touches the vascular pole (${dist(md, pole)})`);
  // between the arterioles: the angle at the pole from afferent to efferent contains the macula densa
  const ang = p => Math.atan2(p[1] - pole[1], p[0] - pole[0]);
  const aIn = ang(G.afferent[G.afferent.length - 3]), eOut = ang(G.efferent[2]), m = ang(md), g = ang(G.glom);
  const between = (x, lo, hi) => { const n = v => (v + 4 * Math.PI) % (2 * Math.PI); return n(x - lo) <= n(hi - lo); };
  // the two arterioles split the directions around the pole into two arcs: the glomerulus lies in one,
  // the macula densa must lie in the other (the notch between the arterioles, outside the capsule)
  ok(between(m, aIn, eOut) !== between(g, aIn, eOut), 'macula densa in the angle between afferent and efferent');
  const r = G.capsuleR;
  ok(dist(dct[0], G.glom) < r + 14, 'the DCT returns to its own corpuscle');
});
test('nephron: peritubular capillaries arise from the efferent arteriole; vasa recta only when long-looped', () => {
  const { walledTubule, NEPHRON_GEOM: G } = loaded(kid);
  const eEnd = G.efferent[G.efferent.length - 1];
  ok(dist(G.peritubular[0], eEnd) < 2, 'peritubular capillary starts at the efferent arteriole');
  ok(dist(G.vasaRecta[0], eEnd) < 2, 'vasa recta start at the efferent arteriole');
  const jm = walledTubule({ key: 'jm' }), co = walledTubule({ juxtamedullary: false, key: 'co' });
  ok(partsOf(jm.svg).has('vasa-recta') && !partsOf(co.svg).has('vasa-recta'), 'vasa recta only with a juxtamedullary nephron');
  ok(co.at.bend[1] < jm.at.bend[1] - 60, 'a cortical nephron has a short loop');
  ok(co.at.bend[1] > G.medullaTop, 'the short loop still turns in the (outer) medulla');
});
test('nephron: one collecting duct shared by several nephrons', () => {
  const { walledTubule, NEPHRON_GEOM: G } = loaded(kid);
  const a = walledTubule({ key: 'cd' });
  ok((a.svg.match(/data-other-nephron/g) || []).length >= 2, 'at least two other nephrons join the duct');
  const cdTop = G.cd[0], cdBot = G.cd[G.cd.length - 1];
  ok(cdTop[1] < G.medullaTop && cdBot[1] > G.medullaTop + 150, 'the duct runs cortex to papilla');
  const join = G.dct[G.dct.length - 1];
  ok(Math.min(...core.samplePath(`M${G.cd.map(core.pt).join(' L')}`, 200).map(p => dist(p, join))) < 10, 'the DCT drains into the shared duct');
});
test('nephron: brush border only on the proximal tubule; thin ascending limb and TAL water-tight', () => {
  const { walledTubule } = loaded(kid);
  const a = walledTubule({ key: 'bb' });
  const groups = [...a.svg.matchAll(/<g\b[^>]*data-seg="(\w+)"[^>]*>([\s\S]*?)<\/g><!--\/seg-->/g)];
  ok(groups.length >= 6, `segment groups found: ${groups.length}`);
  for (const [, k, body] of groups) {
    ok(/ax-brush/.test(body) === (k === 'pt'), `brush border on ${k}: ${/ax-brush/.test(body)}`);
    ok(/ax-watertight/.test(body) === (k === 'thin' || k === 'tal'), `water-tight wall on ${k}`);
  }
});
test('nephron: nephron name on glomerulus and segments, not on the collecting duct; parts rename', () => {
  const { walledTubule } = loaded(kid);
  const a = walledTubule({ key: 'nn', parts: { loop: 'hairpin', collecting: 'duct' } });
  const ps = partsOf(a.svg);
  ok(ps.has('hairpin') && ps.has('duct') && !ps.has('loop'), 'renamed');
  ok(partGroups(a.svg, 'duct').every(g => !/\bnephron\b/.test(g)), 'collecting duct is not part of the nephron');
  ok(partGroups(a.svg, 'proximal').every(g => /\bnephron\b/.test(g)), 'proximal tubule is part of the nephron');
});
test('nephron: focus dims the rest, model widths change the arterioles, jg grows', () => {
  const { walledTubule } = loaded(kid);
  const a = walledTubule({ key: 'f', focus: ['tal'] });
  ok(/data-seg="pt"[^>]*opacity="0?\.35"/.test(a.svg), 'unfocused segment at .35');
  ok(!/data-seg="tal"[^>]*opacity=/.test(a.svg), 'focused segment at full strength');
  const b = walledTubule({ key: 'w', afferentW: 5, efferentW: 9 });
  ok(b.widths.afferent === 5 && b.widths.efferent === 9, 'model widths pass through');
  ok(walledTubule({ key: 'j0', jg: 0 }).svg !== walledTubule({ key: 'j0', jg: 1 }).svg, 'jg changes the drawing');
});
test('nephron: geometry track runs glomerulus to papilla, spans in order; along() sits on the centreline', () => {
  const { nephronGeometry, NEPHRON_GEOM: G, walledTubule } = loaded(kid);
  const g = nephronGeometry();
  ok(dist(g.track(0), G.pt[0]) < 0.5 && dist(g.track(1), G.cd[G.cd.length - 1]) < 0.5, 'track ends');
  let last = 0;
  for (const k of g.order) { const [a, b] = g.span[k]; ok(a >= last - 1e-9 && b > a, `span ${k} in order`); last = b; }
  near(last, 1, 1e-6, 'spans cover the track');
  const a = walledTubule({ x: 10, y: 20, s: 0.5, key: 'al' });
  const p = a.along('tal', 0.5), q = G.tal;
  const nat = [(p[0] - 10) / 0.5, (p[1] - 20) / 0.5];
  ok(Math.min(...core.samplePath(`M${q.map(core.pt).join(' L')}`, 200).map(z => dist(z, nat))) < 1, 'along() is on the TAL centreline');
});
test('nephron: a lesson geometry (NEPH SEG) is accepted', () => {
  const { walledTubule, NEPHRON_GEOM } = loaded(kid);
  const geom = { ...NEPHRON_GEOM, pt: NEPHRON_GEOM.pt.map(([x, y]) => [x, y + 2]) };
  const a = walledTubule({ geom, key: 'g' });
  common(a, 'walledTubule with geom');
});

/* ---------- tubuleCellRow ---------- */
const kindsIn = (svg, side) => new Set([...svg.matchAll(new RegExp(`data-slot="(\\w+)" data-side="${side}"`, 'g'))].map(m => m[1]));
test('cells: the right transporters per segment', () => {
  const { tubuleCellRow } = loaded(kid);
  const want = { pct: [['sglt', 'nhe3'], ['nak']], tal: [['nkcc2'], ['nak']], dct: [['ncc'], ['nak']], principal: [['enac', 'romk', 'aqp2'], ['nak']] };
  const never = { pct: ['nkcc2', 'ncc', 'enac', 'aqp2'], tal: ['sglt', 'ncc', 'enac', 'aqp2', 'nhe3'], dct: ['nkcc2', 'sglt', 'aqp2', 'enac'], principal: ['nkcc2', 'ncc', 'sglt', 'nhe3'] };
  for (const [seg, [ap, bl]] of Object.entries(want)) {
    const a = tubuleCellRow({ segment: seg, key: seg });
    common(a, `tubuleCellRow ${seg}`);
    const A = kindsIn(a.svg, 'apical'), B = kindsIn(a.svg, 'basolateral');
    for (const k of ap) ok(A.has(k), `${seg}: apical ${k}`);
    for (const k of bl) ok(B.has(k), `${seg}: basolateral ${k}`);
    for (const k of never[seg]) ok(!A.has(k) && !B.has(k), `${seg}: no ${k}`);
    ok(!B.has('nkcc2') && !A.has('nak'), `${seg}: pump basolateral only`);
  }
});
test('cells: n cells, parts, brush border only in the proximal tubule', () => {
  const { tubuleCellRow } = loaded(kid);
  const a = tubuleCellRow({ segment: 'pct', n: 4, key: 'c4' });
  ok((a.svg.match(/data-cell=/g) || []).length === 4, '4 cells');
  for (const n of ['epithelium', 'lumen', 'capillary', 'sglt', 'nhe3', 'nak']) ok(partsOf(a.svg).has(n), `part ${n}`);
  ok(/ax-brush/.test(a.svg) && !/ax-brush/.test(tubuleCellRow({ segment: 'tal', key: 't' }).svg) && !/ax-brush/.test(tubuleCellRow({ segment: 'principal', key: 'p' }).svg), 'brush border on the PCT only');
  ok(!partsOf(tubuleCellRow({ segment: 'dct', capillary: false, key: 'nc' }).svg).has('capillary'), 'capillary optional');
  const r = tubuleCellRow({ segment: 'pct', parts: { sglt: 'sglt2', epithelium: 'tubule' }, key: 'r' });
  ok(partsOf(r.svg).has('sglt2') && partsOf(r.svg).has('tubule') && !partsOf(r.svg).has('sglt'), 'parts rename');
});
test('cells: apical slots on the apical membrane in every orientation', () => {
  const { tubuleCellRow } = loaded(kid);
  for (const facing of ['up', 'down', 'left', 'right']) {
    const apical = facing;
    const a = tubuleCellRow({ segment: 'principal', facing, x: 10, y: 10, w: 300, h: 170, key: facing });
    const lum = a.at.lumen, blood = a.at.capillary, ap = a.at.enac, bl = a.at.nak;
    ok(dist(ap, lum) < dist(ap, blood), `${apical}: ENaC nearer the lumen`);
    ok(dist(bl, blood) < dist(bl, lum), `${apical}: pump nearer the blood`);
    const [bx, by, bw, bh] = a.box;
    for (const p of [lum, blood, ap, bl]) ok(p[0] >= bx - 0.5 && p[0] <= bx + bw + 0.5 && p[1] >= by - 0.5 && p[1] <= by + bh + 0.5, `${apical}: anchors inside the box`);
  }
});
test('cells: ions move the right way', () => {
  const { tubuleCellRow, TRANSPORT } = loaded(kid);
  // into the cell from the lumen: sglt, nhe3 (Na), nkcc2, ncc, enac; out to the lumen: romk (K), nhe3 (H);
  // pump: 3 Na out to the blood, 2 K in
  const dir = (k, ion) => TRANSPORT[k].ions.filter(i => i.ion === ion).map(i => i.to);
  ok(dir('sglt', 'na').every(t => t === 'cell') && dir('sglt', 'glucose').every(t => t === 'cell'), 'SGLT: Na and glucose into the cell');
  ok(dir('nhe3', 'na').every(t => t === 'cell') && dir('nhe3', 'h').every(t => t === 'out'), 'NHE3: Na in, H out to the lumen');
  ok(dir('nkcc2', 'na').length === 1 && dir('nkcc2', 'k').length === 1 && dir('nkcc2', 'cl').length === 2 && TRANSPORT.nkcc2.ions.every(i => i.to === 'cell'), 'NKCC2: 1 Na, 1 K, 2 Cl into the cell');
  ok(TRANSPORT.ncc.ions.length === 2 && TRANSPORT.ncc.ions.every(i => i.to === 'cell'), 'NCC: Na and Cl into the cell');
  ok(dir('enac', 'na').every(t => t === 'cell'), 'ENaC: Na into the cell');
  ok(dir('romk', 'k').every(t => t === 'out'), 'ROMK: K out to the lumen');
  ok(dir('nak', 'na').length === 3 && dir('nak', 'na').every(t => t === 'out') && dir('nak', 'k').length === 2 && dir('nak', 'k').every(t => t === 'cell'), 'pump: 3 Na out, 2 K in');
  ok(dir('aqp2', 'water').every(t => t === 'cell'), 'aquaporin-2: water into the cell');
  ok(TRANSPORT.sglt.side === 'apical' && TRANSPORT.nak.side === 'basolateral' && TRANSPORT.glut2.side === 'basolateral', 'sides');
  const a = tubuleCellRow({ segment: 'tal', phase: 0.3, key: 'ph' }), b = tubuleCellRow({ segment: 'tal', phase: 0.6, key: 'ph' });
  ok(a.svg !== b.svg, 'phase moves the ions');
  ok(tubuleCellRow({ segment: 'tal', phase: 0, key: 'lp' }).svg === tubuleCellRow({ segment: 'tal', phase: 1, key: 'lp' }).svg, 'phase loops seamlessly');
});
test('cells: a block marks its target; aquaporin-2 inserts with ADH', () => {
  const { tubuleCellRow } = loaded(kid);
  const a = tubuleCellRow({ segment: 'tal', block: { nkcc2: 1 }, key: 'b' });
  ok(/data-block="nkcc2"/.test(a.svg) && a.at['block-nkcc2'], 'block mark and its anchor');
  ok(!/data-block=/.test(tubuleCellRow({ segment: 'tal', key: 'nb' }).svg), 'no block by default');
  const p0 = tubuleCellRow({ segment: 'principal', aqp2: 0, key: 'q' }), p1 = tubuleCellRow({ segment: 'principal', aqp2: 1, key: 'q' });
  ok(p0.svg !== p1.svg, 'aqp2 insertion changes the drawing');
  ok(/data-vesicle/.test(p0.svg), 'aquaporin-2 waits in vesicles without ADH');
});
test('cells: ion glyphs stay legible (at least 8 units across)', () => {
  const { ION_SIZE } = loaded(kid);
  ok(ION_SIZE >= 8, `ION_SIZE ${ION_SIZE}`);
});

/* ---------- lints ---------- */
const files = [root + 'lab/kit/art/kidney.js', root + 'tools/art-tests/kidney.test.mjs', root + 'tools/art-gallery/kidney.html'];
test('lint: files exist', () => { for (const f of files) ok(fs.existsSync(f), `${path.relative(root, f)} exists`); });
test('lint: no em or en dash', () => {
  for (const f of files.filter(fs.existsSync)) {
    const s = fs.readFileSync(f, 'utf8');
    ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`);
  }
});
test('lint: no hex colour in kidney.js outside its TODO block', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/kidney.js', 'utf8').replace(/\/\* TODO\(core\.js\)[\s\S]*?\*\/|\/\/ TODO-HEX-START[\s\S]*?\/\/ TODO-HEX-END/g, '');
  const hits = s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `kidney.js: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: fill() only in fills; art imported unversioned', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/kidney.js', 'utf8');
  ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), 'fill() on a stroke');
  for (const f of files.filter(fs.existsSync)) ok(!/art\/[\w-]+\.js\?v=/.test(fs.readFileSync(f, 'utf8')), `${path.basename(f)} imports a versioned art module`);
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
