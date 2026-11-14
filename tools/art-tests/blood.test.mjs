#!/usr/bin/env node
// Node tests for lab/kit/art/blood.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/blood.test.mjs           every test
//   node tools/art-tests/blood.test.mjs hemo      only tests whose name contains "hemo"
// No dependencies; same style as tools/lab-art-test.mjs. Written before blood.js existed and run failing.
//
// What is tested, and why (art direction sections 2.2, 2.6, 2.7, 4.0b and 4.7; the O2 brief):
//   rbc          an Art anchored at its centre; a biconcave disc in face, oblique and edge views whose edge
//                profile is the measured red cell shape (thin centre, thick torus, about 0.33 as thick as
//                wide); oxygen tints between the deoxygenated and oxygenated cell colours of P and is never
//                blue; no nucleus; a cutaway packs hemoglobin glyphs inside the cut wedge only; weight
//                strokes keep their weight at any scale; parts are leaves and can be renamed.
//   rbcStream    n cells on a path; phase loops seamlessly (phase 0 and 1 draw the same frame); oxygen can
//                change along the path (lung capillary: deoxygenated in, oxygenated out); cells fade in and
//                out at the ends instead of popping.
//   hemoglobin   two alpha and two beta subunits (alphas on one diagonal), four hemes with iron, one seat per
//                heme in the seats[] order the lesson uses (top left, top right, bottom left, bottom right);
//                O2 binds bent (two oxygens), CO binds straight (carbon on the iron, then oxygen); T to R
//                by r: the two alpha-beta dimers turn about 15 degrees against each other, the central
//                cavity between the betas narrows, the iron moves into the heme plane, the T-state
//                salt-bridge ticks break; 2,3-BPG sits in the cavity of the T state only; missing draws a
//                dashed outline only; level of detail follows the drawn size; ligands stay at least 8 units
//                across in a row; outline() keeps one command structure for every r (it morphs).
//   lints        no nested data-part, unique scoped ids, every url(#) resolves, no em or en dash, no hex
//                colour in blood.js (every colour is a P entry or mixed from one), fill() only in fills,
//                no <text> (labels are the lesson's), core imported unversioned.
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
const B = await import(root + 'lab/kit/art/blood.js').catch(e => ({ __error: e }));
const loaded = () => { if (B.__error) throw new Fail(`module did not load: ${B.__error.message}`); return B; };
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
const resolves = markup => { const { ids, refs } = scan(markup); const shared = core.artDefs(markup); return refs.filter(r => !ids.includes(r) && !shared.includes(`id="${r}"`)); };
const isArt = a => a && typeof a.svg === 'string' && `${a}` === a.svg && Array.isArray(a.box) && a.box.length === 4 && typeof a.at === 'object' && typeof a.outline === 'function';
const colours = svg => [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map(m => m[1]);
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const count = (svg, re) => (svg.match(re) || []).length;

/* ---------- rbc ---------- */
test('rbc: loads and is an Art anchored at its centre', () => {
  const { rbc } = loaded();
  const a = rbc();
  ok(isArt(a), 'Art shape: svg, box, at, outline, toString');
  ok(a.box.join() === '-7,-7,14,14', `default r 7 at the origin: box ${a.box}`);
  const b = rbc({ x: 100, y: 50, r: 10, s: 2 });
  ok(b.box.join() === '80,30,40,40', `placed and scaled: box ${b.box}`);
  near(b.at.centre[0], 100, 1e-6, 'at.centre x'); near(b.at.centre[1], 50, 1e-6, 'at.centre y');
  ok(Array.isArray(b.at.rim) && Array.isArray(b.at.pallor), 'at.rim and at.pallor leader targets');
});
test('rbc: the edge profile is the measured biconcave disc', () => {
  const { rbcGeometry } = loaded();
  const z = rbcGeometry.halfThickness;
  // Evans and Fung: centre about 0.8 um and torus about 2.5 um thick on a 7.8 um disc
  const centre = 2 * z(0), torus = 2 * Math.max(...Array.from({ length: 101 }, (_, i) => z(i / 100)));
  near(centre / 2, 0.104, 0.01, 'centre thickness over diameter');
  near(torus / 2, 0.33, 0.03, 'torus thickness over diameter (about 2.6 um on 7.8)');
  ok(z(1) < 1e-6, 'zero thickness at the rim');
  ok(z(0.5) > z(0) && z(0.84) > z(0.5), 'thickens from the centre to the torus');
});
test('rbc: three views; the edge view is about 0.3 as tall as it is wide', () => {
  const { rbc } = loaded();
  const face = rbc({ r: 20 }), obl = rbc({ r: 20, view: 'oblique' }), edge = rbc({ r: 20, view: 'edge' });
  ok(face.svg !== obl.svg && obl.svg !== edge.svg, 'the views differ');
  near(edge.box[2], 40, 0.01, 'edge width is the diameter');
  ok(edge.box[3] > 0.25 * 40 && edge.box[3] < 0.36 * 40, `edge height ${edge.box[3]} is about 0.3 of 40`);
  ok(obl.box[3] < 40 && obl.box[3] > 20, `oblique is foreshortened: height ${obl.box[3]}`);
  for (const v of ['face', 'oblique', 'edge']) ok(/^M/.test(rbc({ r: 20, view: v }).outline()), `${v} outline is a path`);
});
test('rbc: oxygen tints between P\'s two cell colours and the cell is never blue', () => {
  const { rbc, rbcColours } = loaded();
  const oxy = rbc({ r: 20, ox: 1 }).svg, de = rbc({ r: 20, ox: 0 }).svg;
  ok(oxy.includes(P.rbc.rim) && oxy.includes(P.rbc.base), 'oxygenated uses the RBC rim and centre');
  ok(de.includes(P.rbc.deoxyRim) && de.includes(P.rbc.deoxyCentre), 'deoxygenated uses the deoxy RBC rim and centre');
  ok(rbcColours(0.5).rim === mix(P.rbc.deoxyRim, P.rbc.rim, 0.5), 'half way mixes the two');
  for (const ox of [0, 0.25, 0.5, 0.75, 1]) for (const v of ['face', 'oblique', 'edge']) {
    for (const c of colours(rbc({ r: 30, ox, view: v, cutaway: v === 'face' }).svg)) {
      const [r, , b] = rgb(c);
      ok(r >= b || c === P.ui.white, `ox ${ox} ${v}: ${c} is bluer than it is red`);
    }
  }
  ok(!/nucleus/.test(oxy) && ![P.nucleus.base, P.nucleus.line].some(c => oxy.includes(c)), 'no nucleus');
});
test('rbc: weight strokes keep their weight at any scale', () => {
  const { rbc, rbcColours } = loaded();
  const w = s => +new RegExp(`stroke="${rbcColours(1).line}"[^>]*?stroke-width="([\\d.]+)"`).exec(rbc({ r: 20, s }).svg)[1] * s;
  near(w(1), w(3), 0.02, 'outline on screen at s 1 and s 3');
  ok(w(1) >= 1.25, `outline at least 1.25 (${w(1)})`);
});
test('rbc: cutaway packs hemoglobin inside the cut wedge only', () => {
  const { rbc } = loaded();
  const a = rbc({ r: 105, cutaway: true }), plain = rbc({ r: 105 });
  const hb = [...a.svg.matchAll(/data-hb="([-\d.]+) ([-\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  ok(hb.length >= 20, `about 25 or more glyphs (${hb.length})`);
  ok(!/data-hb/.test(plain.svg), 'no glyphs without the cutaway');
  for (const [x, y] of hb) {
    const rr = Math.hypot(x, y), ang = Math.atan2(y, x) * 180 / Math.PI;
    ok(rr < 105 - 6 && ang > -2 && ang < 92, `glyph at ${x}, ${y} lies in the lower right wedge`);
  }
  ok(Array.isArray(a.at.cut), 'at.cut is a leader target on the wedge');
});
test('rbc: parts are leaves and can be renamed', () => {
  const { rbc } = loaded();
  for (const v of ['face', 'oblique', 'edge']) {
    const a = rbc({ r: 40, view: v, cutaway: true });
    ok(partsOf(a.svg).has('rbc'), `${v}: part rbc`);
    ok(!scan(a.svg).nested.length, `${v}: nested parts ${scan(a.svg).nested.slice(0, 2)}`);
  }
  const r = rbc({ parts: { rbc: 'cells' } });
  ok(partsOf(r.svg).has('cells') && !partsOf(r.svg).has('rbc'), 'rbc renamed to cells');
});

/* ---------- rbcStream ---------- */
const PATH = 'M20 100 C120 40 300 160 460 100';
test('rbcStream: n cells on the path', () => {
  const { rbcStream } = loaded();
  const a = rbcStream({ d: PATH, n: 6, phase: 0.3 });
  ok(isArt(a), 'Art shape');
  ok(a.cells.length === 6, `six cells (${a.cells.length})`);
  const poly = core.samplePath(PATH, 400);
  for (const c of a.cells) ok(Math.min(...poly.map(p => Math.hypot(p[0] - c.x, p[1] - c.y))) < 1, `cell at ${c.x}, ${c.y} sits on the path`);
  ok(count(a.svg, /data-cell=/g) === 6, 'six cell groups');
});
test('rbcStream: phase loops seamlessly', () => {
  const { rbcStream } = loaded();
  const o = { d: PATH, n: 5, r: 9 };
  ok(rbcStream({ ...o, phase: 0 }).svg === rbcStream({ ...o, phase: 1 }).svg, 'phase 0 and 1 draw the same frame');
  ok(rbcStream({ ...o, phase: 0 }).svg !== rbcStream({ ...o, phase: 0.37 }).svg, 'phase moves the cells');
  ok(rbcStream({ ...o, phase: 0.2 }).svg === rbcStream({ ...o, phase: 2.2 }).svg, 'any whole number of laps is the same');
});
test('rbcStream: oxygen along the path and faded ends', () => {
  const { rbcStream } = loaded();
  const a = rbcStream({ d: PATH, n: 10, phase: 0.02, ox: [0, 1] });
  const first = a.cells.reduce((m, c) => c.u < m.u ? c : m), last = a.cells.reduce((m, c) => c.u > m.u ? c : m);
  ok(first.ox < 0.15 && last.ox > 0.85, `ox runs 0 to 1 along the path (${first.ox}, ${last.ox})`);
  ok(first.opacity < 1, 'a cell entering the path fades in');
  const fn = rbcStream({ d: PATH, n: 4, ox: u => 1 - u });
  ok(fn.cells.every(c => Math.abs(c.ox - (1 - c.u)) < 1e-9), 'ox can be a function of the position');
  ok(partsOf(rbcStream({ d: PATH, parts: { rbc: 'red-cells' } }).svg).has('red-cells'), 'parts rename');
  ok(!scan(a.svg).nested.length, 'no nested parts');
});

/* ---------- hemoglobin ---------- */
test('hemoglobin: an Art anchored at its centre, 80 x 80 native', () => {
  const { hemoglobin } = loaded();
  const h = hemoglobin();
  ok(isArt(h), 'Art shape');
  ok(h.box.join() === '-40,-40,80,80', `box ${h.box}`);
  const p = hemoglobin({ x: 200, y: 100, s: 0.5 });
  ok(p.box.join() === '180,80,40,40', `placed and scaled: ${p.box}`);
  for (const k of ['centre', 'alpha', 'beta', 'cavity', 'heme', 'seat0', 'seat1', 'seat2', 'seat3']) ok(Array.isArray(p.at[k]), `at.${k}`);
});
test('hemoglobin: two alpha, two beta, alphas on one diagonal; four hemes with iron', () => {
  const { hemoglobin, hbGeometry } = loaded();
  const h = hemoglobin({ seats: ['o2', 'o2', 'empty', 'empty'] }).svg;
  const subs = [...h.matchAll(/data-subunit="(alpha|beta)"/g)].map(m => m[1]);
  ok(subs.filter(x => x === 'alpha').length === 2 && subs.filter(x => x === 'beta').length === 2, `2 alpha 2 beta (${subs})`);
  const g = hbGeometry(0);
  ok(g.subunits.map(s => s.kind).join() === 'alpha,beta,beta,alpha', `reading order TL TR BL BR is alpha beta beta alpha (${g.subunits.map(s => s.kind)})`);
  ok(count(h, /data-heme=/g) === 4 && count(h, /data-fe=/g) === 4, 'four hemes, four irons');
});
test('hemoglobin: seats follow the lesson\'s order and ligands bind as they really do', () => {
  const { hemoglobin, hbGeometry } = loaded();
  const h = hemoglobin({ seats: ['o2', 'co', 'empty', 'o2'] }).svg;
  const seats = [...h.matchAll(/data-seat="(\w+)"/g)].map(m => m[1]);
  ok(seats.join() === 'o2,co,empty,o2', `data-seat in order (${seats})`);
  // each heme sits on the outer side of its subunit, in the seat order of the old molecule
  const g = hbGeometry(0), want = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  g.hemes.forEach((m, i) => ok(Math.sign(m.c[0]) === want[i][0] && Math.sign(m.c[1]) === want[i][1], `heme ${i} in its quadrant`));
  const atoms = seat => { const m = new RegExp(`<g[^>]*data-seat="${seat}"[^>]*>([\\s\\S]*?)</g>`).exec(hemoglobin({ seats: [seat, 'empty', 'empty', 'empty'] }).svg); return m[1]; };
  ok(count(atoms('o2'), new RegExp(`fill="${P.oxygen.base}"`, 'g')) === 2, 'O2: two oxygen atoms');
  ok(count(atoms('co'), new RegExp(`fill="${P.carbon.base}"`, 'g')) === 1 && count(atoms('co'), new RegExp(`fill="${P.oxygen.base}"`, 'g')) === 1, 'CO: one carbon, one oxygen');
  ok(count(atoms('empty'), /<circle[^>]*data-atom/g) === 0, 'empty: no ligand');
  // O2 binds bent (Fe-O-O about 120 degrees); CO binds straight (Fe-C-O about 180)
  const L = hbGeometry(0).ligand;
  near(L('o2', 0).bend, 120, 8, 'Fe-O-O angle');
  near(L('co', 0).bend, 180, 6, 'Fe-C-O angle');
});
test('hemoglobin: T to R is the real quaternary change', () => {
  const { hemoglobin, hbGeometry } = loaded();
  const T = hbGeometry(0), R = hbGeometry(1);
  const turn = g => (g.subunits[1].angle - g.subunits[0].angle);
  near(Math.abs(turn(R) - turn(T)), 15, 1.5, 'the two dimers turn about 15 degrees against each other');
  ok(T.subunits[0].angle === T.subunits[2].angle && T.subunits[1].angle === T.subunits[3].angle, 'each dimer (left column, right column) turns as one');
  ok(R.betaGap < T.betaGap - 1, `the central cavity between the betas narrows (${T.betaGap} to ${R.betaGap})`);
  ok(T.hemes.every(m => m.feOut > 1) && R.hemes.every(m => Math.abs(m.feOut) < 0.2), 'iron out of the heme plane in T, in it in R');
  ok(count(hemoglobin({ r: 0 }).svg, /data-bridge/g) >= 4, 'T draws its salt-bridge ticks');
  ok(count(hemoglobin({ r: 1 }).svg, /data-bridge/g) === 0, 'R has none');
  const mid = hbGeometry(0.5);
  ok(mid.betaGap < T.betaGap && mid.betaGap > R.betaGap, 'r interpolates');
});
test('hemoglobin: 2,3-BPG binds the T state only', () => {
  const { hemoglobin } = loaded();
  ok(/data-bpg/.test(hemoglobin({ r: 0, bpg: 1 }).svg), 'BPG in the T cavity');
  ok(!/data-bpg/.test(hemoglobin({ r: 1, bpg: 1 }).svg), 'no BPG in R');
  ok(!/data-bpg/.test(hemoglobin({ r: 0 }).svg), 'off by default');
  ok(partsOf(hemoglobin({ r: 0, bpg: 1 }).svg).has('bpg'), 'part bpg');
});
test('hemoglobin: parts are leaves; seats light with the molecule', () => {
  const { hemoglobin } = loaded();
  const h = hemoglobin({ seats: ['o2', 'o2', 'empty', 'empty'], bpg: 1 });
  ok(!scan(h.svg).nested.length, `no nested parts: ${scan(h.svg).nested.slice(0, 2)}`);
  ok(/data-molecule=""/.test(h.svg) || /data-molecule(?=[\s>])/.test(h.svg), 'data-molecule hook on the whole');
  ok(count(h.svg, /data-part="molecule seat"/g) === 4, 'each seat is a leaf named "molecule seat"');
  ok(/data-part="molecule"/.test(h.svg), 'the globin bodies are a leaf named molecule');
  const r = hemoglobin({ parts: { molecule: 'hb', seat: 'heme' } });
  ok(partsOf(r.svg).has('hb') && partsOf(r.svg).has('heme') && !partsOf(r.svg).has('molecule'), 'parts rename');
});
test('hemoglobin: missing is a dashed outline only', () => {
  const { hemoglobin } = loaded();
  const m = hemoglobin({ missing: true, seats: ['o2', 'o2', 'o2', 'o2'] }).svg;
  ok(/data-molecule="missing"/.test(m), 'data-molecule="missing"');
  ok(/stroke-dasharray/.test(m) && !/data-seat/.test(m) && !/data-heme/.test(m), 'dashed, no seats, no hemes');
  ok(!/data-part/.test(m), 'a missing molecule lights nothing');
});
test('hemoglobin: level of detail follows the drawn size; ligands stay readable in a row', () => {
  const { hemoglobin, hbLod } = loaded();
  ok(hbLod(1) === 'full' && hbLod(0.375) === 'row' && hbLod(0.16) === 'symbol', `lod by drawn size (${hbLod(1)}, ${hbLod(0.375)}, ${hbLod(0.16)})`);
  const sym = hemoglobin({ s: 0.16, seats: ['o2', 'o2', 'o2', 'o2'] }).svg;
  ok(count(sym, /data-subunit/g) === 4 && !/data-heme/.test(sym), 'symbol: four subunits, no heme detail');
  // in a row (30 units), an O2 dumbbell is at least 8 units across on screen
  const s = 30 / 80, row = hemoglobin({ s, seats: ['o2', 'empty', 'empty', 'empty'] }).svg;
  const seat = /<g[^>]*data-seat="o2"[^>]*>([\s\S]*?)<\/g>/.exec(row)[1];
  const atoms = [...seat.matchAll(/<circle[^>]*cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"[^>]*data-atom/g)].map(m => m.slice(1).map(Number));
  ok(atoms.length === 2, 'two oxygens');
  const span = Math.hypot(atoms[0][0] - atoms[1][0], atoms[0][1] - atoms[1][1]) + atoms[0][2] + atoms[1][2];
  ok(span * s >= 8, `O2 span on screen ${span * s} is at least 8`);
  ok(atoms[0][2] * s >= 2, 'each atom at least 2 units in radius on screen');
});
test('hemoglobin: outline() morphs (one command structure for every r)', () => {
  const { hemoglobin } = loaded();
  const h = hemoglobin();
  const shape = r => h.outline({ r }).replace(/-?\d*\.?\d+(?:e-?\d+)?/g, '#');
  ok(/^M/.test(h.outline({ r: 0 })), 'a path');
  ok(shape(0) === shape(1) && shape(0) === shape(0.4), 'same commands at r 0, 0.4 and 1');
  ok((h.outline({ r: 0 }).match(/M/g) || []).length === 4, 'four subunit outlines');
  const sub = r => hemoglobin({ r }).svg.match(/data-subunit[^>]*>\s*<path d="([^"]+)"/)[1].replace(/-?\d*\.?\d+(?:e-?\d+)?/g, '#');
  ok(sub(0) === sub(0.7), 'subunit paths keep their structure as r changes');
});
test('hemoglobin: pure and cheap enough for per-frame rows', () => {
  const { hemoglobin } = loaded();
  const o = { r: 0.3, seats: ['o2', 'co', 'empty', 'o2'], s: 0.4 };
  ok(hemoglobin(o).svg === hemoglobin(o).svg, 'same input, same output');
  // best of three runs: other work on the machine must not fail a cost test
  const run = () => { const t0 = performance.now(); for (let i = 0; i < 400; i++) hemoglobin({ ...o, r: i / 400 }); return (performance.now() - t0) / 400; };
  const per = Math.min(run(), run(), run());
  ok(per < 0.3, `one row glyph costs ${per.toFixed(3)} ms`);
});

/* ---------- a picture made of everything ---------- */
test('picture: unique ids, every url resolves, no nested parts, no text', () => {
  const { rbc, rbcStream, hemoglobin } = loaded();
  const body = [rbc({ r: 60, cutaway: true }), rbc({ view: 'oblique', r: 20, x: 200 }), rbc({ view: 'edge', x: 300 }), rbcStream({ d: PATH, n: 5, ox: [0, 1] }), hemoglobin({ x: 240, y: 200, bpg: 1 }), hemoglobin({ x: 300, y: 200, r: 1, seats: ['o2', 'o2', 'o2', 'o2'] }), hemoglobin({ missing: true })].join('');
  const svg = core.scopeArt(`<svg viewBox="0 0 480 420">${body}</svg>`);
  const { ids, nested } = scan(svg);
  ok(new Set(ids).size === ids.length, 'ids are unique');
  ok(!resolves(svg).length, `unresolved urls: ${resolves(svg)}`);
  ok(!nested.length, `nested parts: ${nested.slice(0, 2)}`);
  ok(!/<text/.test(body), 'primitives draw no text');
});

/* ---------- lints ---------- */
const src = root + 'lab/kit/art/blood.js';
const own = [src, root + 'tools/art-tests/blood.test.mjs', root + 'tools/art-gallery/blood.html'].filter(f => fs.existsSync(f));
test('lint: no em or en dash', () => {
  for (const f of own) { const s = fs.readFileSync(f, 'utf8'); ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`); }
});
test('lint: no hex colour in blood.js (every colour is a P entry or mixed from one)', () => {
  ok(fs.existsSync(src), 'blood.js exists');
  const hits = fs.readFileSync(src, 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `hex literals: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: fill() only in fills; core imported unversioned', () => {
  const s = fs.readFileSync(src, 'utf8');
  ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), 'fill() on a stroke');
  ok(!/core\.js\?v=/.test(s), 'versioned core import');
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
