#!/usr/bin/env node
// Node tests for lab/kit/art/vessels.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/vessels.test.mjs           every test
//   node tools/art-tests/vessels.test.mjs section   only tests whose name contains "section"
// No dependencies; same style as tools/lab-art-test.mjs. Written before vessels.js existed and run failing.
//
// What is tested, and why (art direction sections 2.2, 2.3, 2.6, 2.7, 4.0b and 4.2):
//   vessel         an Art; wall material by vessel type, lumen colour by oxygen content (pulmonary vessels
//                  included); artery wall thicker than vein wall, arteriole wall thick for its lumen,
//                  capillary one thin layer; the lumen is a model width (never scaled away), weight
//                  strokes keep their weight; a constricted wall keeps its area and thickens; valves only
//                  in limb veins and lymphatics; cells and flow loop seamlessly in phase; outline() for the
//                  art ghost; parts are leaves and can be renamed.
//   vesselSection  centre anchor, three tunics for arteries, thin wall for veins, one endothelial ring for a
//                  capillary; layer parts; outline() is the outer edge for a given radius.
//   capillaryBed   an Art in its w x h box; blood runs from arteriole colour to venule colour across the bed;
//                  parts capillary, arteriole, venule, tissue.
//   streamline     a string with no parts that loops seamlessly in phase.
//   flowArrow      the shaft is the model width, the head is a fixed size, the ghost has its underlay.
//   lints          no nested data-part, unique scoped ids, every url(#) resolves, no em or en dash, no hex
//                  colour in vessels.js, fill() only in fills, no <text>.
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
const V = await import(root + 'lab/kit/art/vessels.js').catch(e => ({ __error: e }));
const loaded = () => { if (V.__error) throw new Fail(`module did not load: ${V.__error.message}`); return V; };
const { P, mix } = core;

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
// Every url(#) resolves to an id in the markup or to a shared def artDefs() emits for it.
const resolves = markup => { const { ids, refs } = scan(markup); const shared = core.artDefs(markup); return refs.filter(r => !ids.includes(r) && !shared.includes(`id="${r}"`)); };
const isArt = a => a && typeof a.svg === 'string' && `${a}` === a.svg && Array.isArray(a.box) && a.box.length === 4 && typeof a.at === 'object' && typeof a.outline === 'function';
// stroke widths of paths drawn in a colour
const widthsIn = (svg, col) => [...svg.matchAll(new RegExp(`stroke="${col}"[^>]*?stroke-width="([\\d.]+)"`, 'g'))].map(m => +m[1]);
const H = 'M0 40 C80 30 160 50 240 40';

/* ---------- module ---------- */
test('module: loads and exports the five primitives and the geometry', () => {
  const v = loaded();
  for (const k of ['vessel', 'vesselSection', 'capillaryBed', 'streamline', 'flowArrow', 'vesselGeometry', 'bloodColour']) ok(k in v, `exports ${k}`);
});

/* ---------- vessel ---------- */
test('vessel: is an Art with leader targets', () => {
  const a = loaded().vessel({ d: H, kind: 'artery', lumen: 16 });
  ok(isArt(a), 'Art shape');
  for (const k of ['start', 'end', 'mid', 'wall', 'lumen']) ok(Array.isArray(a.at[k]), `at.${k}`);
  ok(a.box[2] >= 240 && a.box[3] >= 16, `box spans the path (${a.box})`);
});
test('vessel: wall material by vessel type', () => {
  const { vessel } = loaded();
  const art = vessel({ d: H, kind: 'artery', lumen: 16 }).svg, vein = vessel({ d: H, kind: 'vein', lumen: 16 }).svg;
  ok(art.includes(P.artery.line) && art.includes(P.adventitia.base), 'artery: artery wall and adventitia');
  ok(vein.includes(P.vein.line) && !vein.includes(P.artery.line), 'vein: vein wall, no artery line');
  const cap = vessel({ d: H, kind: 'capillary', lumen: 6 }).svg;
  ok(cap.includes(P.capillary.line) && !cap.includes(P.adventitia.base), 'capillary: one endothelial layer, no adventitia');
});
test('vessel: lumen colour by oxygen content, defaults by kind', () => {
  const { vessel, bloodColour } = loaded();
  ok(bloodColour(1).base === P.oxy.base && bloodColour('oxy').base === P.oxy.base, 'oxy');
  ok(bloodColour(0).base === P.deoxy.base && bloodColour('deoxy').base === P.deoxy.base, 'deoxy');
  ok(bloodColour(0.5).base === mix(P.deoxy.base, P.oxy.base, 0.5), 'a 0..1 mix');
  ok(vessel({ d: H, kind: 'artery', lumen: 16 }).svg.includes(P.oxy.base), 'artery defaults to oxygenated');
  ok(vessel({ d: H, kind: 'vein', lumen: 16 }).svg.includes(P.deoxy.base), 'vein defaults to deoxygenated');
  ok(vessel({ d: H, kind: 'portal', lumen: 16 }).svg.includes(P.deoxy.base), 'portal vein carries venous blood');
  // the vessel rule: pulmonary artery = artery wall with deoxygenated lumen; pulmonary vein = vein wall, oxygenated
  const pa = vessel({ d: H, kind: 'artery', blood: 'deoxy', lumen: 16 }).svg, pvn = vessel({ d: H, kind: 'vein', blood: 'oxy', lumen: 16 }).svg;
  ok(pa.includes(P.artery.line) && pa.includes(P.deoxy.base) && !pa.includes(`stroke="${P.oxy.base}"`), 'pulmonary artery');
  ok(pvn.includes(P.vein.line) && pvn.includes(P.oxy.base), 'pulmonary vein');
});
test('vessel: artery wall thicker than vein wall; arteriole thick for its lumen; capillary thinnest', () => {
  const { vesselGeometry: g } = loaded();
  ok(g.wall('artery', 20) > 2 * g.wall('vein', 20), `artery ${g.wall('artery', 20)} vs vein ${g.wall('vein', 20)}`);
  ok(g.wall('arteriole', 8) / 8 > g.wall('artery', 20) / 20, 'arteriole wall-to-lumen ratio above the artery\'s');
  ok(g.wall('capillary', 6) < g.wall('venule', 12) + 0.01 && g.wall('capillary', 6) <= 1.6, 'capillary is one thin layer');
  const L = g.layers('artery', 20);
  ok(L.media > L.adventitia && L.media > L.intima, 'artery: media is the thickest tunic');
  const Lv = g.layers('vein', 20);
  ok(Lv.adventitia > Lv.media, 'vein: adventitia is the thickest tunic');
});
test('vessel: lumen is a geometry stroke (model width), outline a weight stroke', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'artery', lumen: 14 }).svg, b = vessel({ d: H, kind: 'artery', lumen: 14, s: 2 }).svg;
  ok(widthsIn(a, P.oxy.base).includes(14), `lumen stroke 14 (${widthsIn(a, P.oxy.base)})`);
  ok(widthsIn(b, P.oxy.base).includes(14), 'lumen not compensated for scale');
  ok(/transform="translate\(0 0\) scale\(2 2\)"/.test(b), 'placed with one transform');
});
test('vessel: a constricted wall keeps its area and thickens', () => {
  const { vesselGeometry: g } = loaded();
  const R0 = 6, t0 = g.wall('arteriole', 12), R1 = 3, t1 = g.wall('arteriole', 6, 12);
  near((R1 + t1) ** 2 - R1 ** 2, (R0 + t0) ** 2 - R0 ** 2, 0.01, 'wall area');
  ok(t1 > t0, 'wall thickens as the lumen narrows');
});
test('vessel: valves only in limb veins and lymphatics', () => {
  const { vessel } = loaded();
  ok(!partsOf(vessel({ d: H, kind: 'artery', lumen: 16, valves: true }).svg).has('valves'), 'never in an artery');
  ok(!partsOf(vessel({ d: H, kind: 'portal', lumen: 16, valves: true }).svg).has('valves'), 'never in the portal vein');
  for (const site of ['caval', 'pulmonary', 'cerebral']) ok(!partsOf(vessel({ d: H, kind: 'vein', site, lumen: 16, valves: true }).svg).has('valves'), `never in a ${site} vein`);
  ok(!partsOf(vessel({ d: H, kind: 'vein', lumen: 16 }).svg).has('valves'), 'off by default');
  const v = vessel({ d: H, kind: 'vein', lumen: 16, valves: { n: 2, open: 1 } });
  ok(partsOf(v.svg).has('valves') && Array.isArray(v.at.valve), 'limb vein valves');
  const shut = vessel({ d: H, kind: 'vein', lumen: 16, valves: { n: 2, open: 0 } }).svg;
  ok(shut !== v.svg, 'open changes the cusps');
});
test('vessel: cells and flow loop seamlessly in phase', () => {
  const { vessel } = loaded();
  const at = p => vessel({ d: H, kind: 'artery', lumen: 16, cells: { n: 6, phase: p }, flow: { phase: p } }).svg;
  ok(at(0) === at(1) && at(0.25) === at(1.25), 'phase 0 = phase 1');
  ok(at(0) !== at(0.3), 'phase moves the cells');
  ok(partsOf(at(0)).has('rbc'), 'cells part');
  const n = (at(0.37).match(/data-rbc/g) || []).length;
  ok(n === 6, `six cells (${n})`);
  // with a cell field the lumen is blood thinned toward plasma (it keeps its oxygen colour so a stream of
  // cells never reads as a beige pipe)
  ok(at(0).includes(`stroke="${mix(P.oxy.base, P.plasma.base, 0.3)}"`), 'a lumen with a cell field is blood thinned toward plasma');
});
test('vessel: gaps open the wall of a venule', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'venule', lumen: 12, gaps: 0 }).svg, b = vessel({ d: H, kind: 'venule', lumen: 12, gaps: 1 }).svg;
  ok(a !== b && /stroke-dasharray/.test(b), 'gaps break the wall');
});
test('vessel: outline(state) is both outer edges and narrows with the lumen', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'arteriole', lumen: 10 });
  const wide = a.outline(), thin = a.outline({ lumen: 4 });
  ok((wide.match(/M/g) || []).length === 2, 'two edges');
  const ys = d => d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2);
  const span = d => Math.max(...ys(d)) - Math.min(...ys(d));
  ok(span(thin) < span(wide), `narrower (${span(thin)} < ${span(wide)})`);
});
test('vessel: parts are leaves and can be renamed', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'artery', lumen: 16, cells: { n: 4 } });
  for (const p of ['vessel', 'artery', 'wall', 'lumen', 'rbc']) ok(partsOf(a.svg).has(p), `part ${p}`);
  ok(!scan(a.svg).nested.length, 'no nested parts');
  const b = vessel({ d: H, kind: 'artery', lumen: 16, parts: { artery: 'arteriole', vessel: 'resistance' } });
  ok(partsOf(b.svg).has('arteriole') && partsOf(b.svg).has('resistance') && !partsOf(b.svg).has('artery'), 'renamed');
});
test('vessel: detail is D2 unless emphasised', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'artery', lumen: 20 }).svg;
  ok(a.includes('ax-d2'), 'smooth muscle texture is detail');
  const b = vessel({ d: H, kind: 'vein', lumen: 16, valves: true }).svg;
  ok(/data-part="[^"]*valves"(?![^>]*ax-d2)/.test(b), 'valves are never detail');
});
test('vessel: every kind draws without error and with its kind part', () => {
  const { vessel } = loaded();
  for (const kind of ['artery', 'arteriole', 'vein', 'venule', 'capillary', 'portal', 'lymphatic']) {
    const a = vessel({ d: H, kind, lumen: kind === 'capillary' ? 6 : 12, cutaway: kind !== 'portal' });
    ok(partsOf(a.svg).has(kind), `${kind} part`);
    ok(!resolves(a.svg).length, `${kind}: unresolved url(#) ${resolves(a.svg)}`);
  }
  const ext = vessel({ d: H, kind: 'artery', lumen: 12, cutaway: false }).svg;
  ok(!ext.includes(`stroke="${P.oxy.base}" stroke-width="12"`), 'exterior view hides the lumen');
});

/* ---------- vesselSection ---------- */
test('section: centre anchor, box is lumen plus wall', () => {
  const { vesselSection, vesselGeometry: g } = loaded();
  const a = vesselSection({ r: 20, kind: 'artery', x: 100, y: 80 });
  ok(isArt(a), 'Art');
  const R = 20 + g.wall('artery', 40);
  near(a.box[0], 100 - R, 0.6, 'box x'); near(a.box[2], 2 * R, 1.2, 'box w');
  near(a.at.centre[0], 100, 0.01, 'centre x'); near(a.at.centre[1], 80, 0.01, 'centre y');
});
test('section: tunics and their parts', () => {
  const { vesselSection } = loaded();
  const a = vesselSection({ r: 20, kind: 'artery' }).svg;
  for (const p of ['vessel', 'artery', 'intima', 'media', 'adventitia', 'lumen']) ok(partsOf(a).has(p), `artery part ${p}`);
  ok(!scan(a).nested.length, 'no nested parts');
  const c = vesselSection({ r: 4, kind: 'capillary' }).svg;
  ok(!partsOf(c).has('media') && !partsOf(c).has('adventitia'), 'capillary: endothelium only');
  ok(vesselSection({ r: 20, kind: 'vein' }).svg.includes(P.deoxy.base), 'vein lumen venous');
  const tone = vesselSection({ r: 10, kind: 'arteriole', tone: 1 }).svg, relaxed = vesselSection({ r: 10, kind: 'arteriole', tone: 0 }).svg;
  ok(tone !== relaxed, 'tone shades the media');
});
test('section: outline(state) is the outer edge', () => {
  const { vesselSection } = loaded();
  const a = vesselSection({ r: 20, kind: 'artery' });
  ok(/^M/.test(a.outline()) && a.outline({ r: 10 }) !== a.outline(), 'outline follows r');
});

/* ---------- capillaryBed ---------- */
test('capillaryBed: an Art in its box with its parts', () => {
  const { capillaryBed } = loaded();
  const a = capillaryBed({ w: 260, h: 150, x: 10, y: 20 });
  ok(isArt(a), 'Art');
  ok(a.box.join() === '10,20,260,150', `box (${a.box})`);
  for (const p of ['capillary', 'arteriole', 'venule', 'tissue']) ok(partsOf(a.svg).has(p), `part ${p}`);
  ok(!scan(a.svg).nested.length, 'no nested parts');
  for (const k of ['in', 'out', 'arteriole', 'venule', 'capillary', 'tissue']) ok(Array.isArray(a.at[k]), `at.${k}`);
  ok(Array.isArray(a.paths) && a.paths.length >= 3, 'capillary centrelines for particles');
});
test('capillaryBed: blood runs from the arteriole colour to the venule colour', () => {
  const { capillaryBed } = loaded();
  const a = capillaryBed({ w: 260, h: 150 }).svg;
  ok(a.includes(`stroke="${P.oxy.base}"`) && a.includes(`stroke="${P.deoxy.base}"`), 'oxy in, deoxy out');
  const lung = capillaryBed({ w: 260, h: 150, from: 'deoxy', to: 'oxy', tissue: 'none' });
  ok(!partsOf(lung.svg).has('tissue'), 'no tissue');
  for (const t of ['polygon', 'muscle']) ok(!resolves(capillaryBed({ tissue: t, cells: { n: 3, phase: 0.2 } }).svg).length, `${t}: urls resolve`);
  const c = p => capillaryBed({ key: 'loop', cells: { n: 3, phase: p } }).svg;
  ok(c(0) === c(1), 'cells loop seamlessly');
});

/* ---------- streamline ---------- */
test('streamline: a string with no parts, seamless in phase', () => {
  const { streamline } = loaded();
  const a = streamline({ d: H, phase: 0.25 });
  ok(typeof a === 'string' && !/data-part/.test(a), 'string, no parts');
  ok(streamline({ d: H, phase: 0 }) === streamline({ d: H, phase: 1 }), 'phase 0 = 1');
  ok(/stroke-dashoffset="-6"/.test(a), 'dash offset -24 x phase');
});

/* ---------- flowArrow ---------- */
test('flowArrow: model-width shaft, fixed head, ghost with underlay', () => {
  const { flowArrow } = loaded();
  const a = flowArrow({ d: 'M0 50 L200 50', w: 10, ghostW: 18 }), b = flowArrow({ d: 'M0 50 L200 50', w: 4 });
  ok(isArt(a), 'Art');
  near(a.shaftW, 10, 0.01, 'shaft width is the model width');
  ok(a.headL === b.headL && a.headL > 0, 'head length is fixed');
  ok(/class="ax-ghost"/.test(a.svg) && a.svg.includes(P.ui.panel) && /stroke-dasharray/.test(a.svg), 'ghost with its underlay');
  ok(/data-w="10"/.test(a.svg), 'data-w hook');
  const z = flowArrow({ d: 'M0 50 L200 50', w: 0, ghostW: 12 });
  ok(!/data-arrow/.test(z.svg) && /ax-ghost/.test(z.svg), 'no live arrow at zero flow, ghost stays');
  ok(flowArrow({ d: 'M0 50 L200 50', w: 6, part: 'water' }).svg.includes('data-part="water"'), 'caller part');
  ok(!flowArrow({ d: 'M0 50 L200 50', w: 6 }).svg.includes('data-part'), 'no part unless asked');
  ok(Array.isArray(a.at.tip) && near(a.at.tip[0], 200, 0.5, 'tip at the end') === undefined, 'at.tip');
});

/* ---------- ids and placement ---------- */
test('ids: per-instance ids are unique, keyed ids are stable', () => {
  const { vessel, vesselSection, capillaryBed } = loaded();
  const all = [vessel({ d: H, kind: 'artery', lumen: 16 }), vessel({ d: H, kind: 'artery', lumen: 16 }), vesselSection({ r: 10 }), vesselSection({ r: 10 }), capillaryBed({}), capillaryBed({})].map(a => a.svg).join('');
  const ids = scan(all).ids;
  ok(new Set(ids).size === ids.length, `duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i).slice(0, 3)}`);
  ok(ids.every(i => i.startsWith('ax-')), 'ids start ax-');
  ok(vesselSection({ r: 10, key: 'k1' }).svg === vesselSection({ r: 10, key: 'k1' }).svg, 'key gives stable markup');
  ok(!resolves(all).length, `unresolved: ${resolves(all).slice(0, 3)}`);
});
test('placement: x, y, s, rot, flip map box and at', () => {
  const { vessel } = loaded();
  const a = vessel({ d: H, kind: 'artery', lumen: 16 }), b = vessel({ d: H, kind: 'artery', lumen: 16, x: 30, y: 10, s: 0.5 });
  near(b.at.start[0], 30 + 0.5 * a.at.start[0], 0.01, 'start x'); near(b.at.end[1], 10 + 0.5 * a.at.end[1], 0.01, 'end y');
  ok(!/<text/.test(a.svg), 'no text in a primitive');
});

/* ---------- lints ---------- */
const files = ['lab/kit/art/vessels.js', 'tools/art-tests/vessels.test.mjs', 'tools/art-gallery/vessels.html'].map(f => root + f).filter(f => fs.existsSync(f));
test('lint: no em or en dash', () => {
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`); }
});
test('lint: no hex colour in vessels.js (every colour is a P entry or mixed from one)', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/vessels.js', 'utf8');
  const hits = s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `hex: ${hits && hits.slice(0, 3)}`);
});
test('lint: fill() only in fills; core imported unversioned', () => {
  const s = fs.readFileSync(root + 'lab/kit/art/vessels.js', 'utf8');
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
