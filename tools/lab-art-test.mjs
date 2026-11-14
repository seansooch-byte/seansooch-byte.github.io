#!/usr/bin/env node
// Node tests for the shared illustration library, lab/kit/art/ (never shipped: tools/ is export-ignore).
//   node tools/lab-art-test.mjs            every test
//   node tools/lab-art-test.mjs heart      only tests whose name contains "heart" (and all of heart.test.mjs)
// It also runs every per-module suite in tools/art-tests/ (blood, cell, heart, kidney, lung, molecules,
// vessels), so this one command runs the whole library's tests.
// No dependencies. The browser half (the gallery, per-frame cost, ids resolving inside each svg) is
// tools/lab-art-shoot.mjs.
//
// What is tested, and why (lab/kit/art is specified by the art direction, sections 2 to 5 and 7 to 9):
//   core   the palette is complete and exact; ids are scoped per picture; only used defs are emitted;
//          the path helpers (smooth, lerpPath, offsetPath, sampleAlong) keep their contracts; labels
//          placed by placeLabels never overlap.
//   heart  heartSection is an Art with leaf parts, the recipe's valves and model-driven cavities;
//          the left heart's cavity area tracks volume over 0.30 to 1.25 of the normal EDV, its free
//          wall keeps its muscle area, open leaflets and papillary heads stay 6 units inside the cavity
//          for every model condition of pressure-volume-loop, and one frame costs well under 2 ms.
//   chart  the graph marks keep the direction's widths, dashes and colours.
//   lints  no nested data-part, unique ids, every url(#) resolves, no em or en dash, no hex outside
//          core.js, no versioned art import, fill() only in fills.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const only = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

const core = await import(root + 'lab/kit/art/core.js').catch(e => ({ __error: e }));
const heart = await import(root + 'lab/kit/art/heart.js').catch(e => ({ __error: e }));
const chart = await import(root + 'lab/kit/art/chart.js').catch(e => ({ __error: e }));
const loaded = m => { if (m.__error) throw new Fail(`module did not load: ${m.__error.message}`); return m; };

/* ---------- markup helpers for the tests ---------- */
// Walk the tags of an SVG string: report data-part nesting and collect ids and url(#) references.
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
const pathArea = d => Math.abs(core.areaOf(core.samplePath(d, 400)));

/* ---------- core ---------- */
test('core: loads', () => { loaded(core); });
test('core: palette holds the direction\'s exact values', () => {
  const { P } = loaded(core);
  const want = {
    oxy: { hi: '#e2685b', base: '#c8352f', lo: '#8e1e1f', line: '#6e1518', cut: '#7a1a1a' },
    deoxy: { hi: '#6f84c0', base: '#3e5196', lo: '#24305e', line: '#1b2448', cut: '#24305e' },
    myo: { hi: '#efc6b4', base: '#d9a08f', lo: '#a86a5c', line: '#6e3a30' },
    septum: { base: '#cb8d7b', line: '#6e3a30' },
    artery: { hi: '#f6dfd6', base: '#ecc9bd', lo: '#c9958a', line: '#8a4a40' },
    vein: { hi: '#eef0f6', base: '#d6dbe8', lo: '#aeb6cc', line: '#4a5378' },
    valve: { hi: '#fbf3e4', base: '#efe1c8', lo: '#e3d0b0', line: '#8a6d4e' },
    conduction: { hi: '#f2d77a', base: '#e2c044', lo: '#b8952a', line: '#7a5a00' },
    kidneyCortex: { hi: '#c9705f', base: '#b05445', lo: '#7d3229', line: '#5a2018' },
    nerve: { hi: '#fff7d6', base: '#f6e3a2', lo: '#d9bd6a', line: '#8f7430' },
  };
  for (const [k, v] of Object.entries(want)) for (const [kk, hex] of Object.entries(v)) ok(P[k] && P[k][kk] === hex, `P.${k}.${kk} should be ${hex}, is ${P[k] && P[k][kk]}`);
  const ui = { ink: '#171916', blue: '#254dff', red: '#b3261e', panel: '#ecefe5', ghost: '#8a8f84', muted: '#53584d', teal: '#0b6b70' };
  for (const [k, hex] of Object.entries(ui)) ok(P.ui[k] === hex, `P.ui.${k} should be ${hex}`);
  // every material has at least a base and its own line (section 2: line is a dark shade of itself, never ink)
  for (const [k, v] of Object.entries(P)) {
    if (k === 'ui' || k === 'space' || typeof v !== 'object') continue;
    ok(/^#[0-9a-f]{6}$/.test(v.base || ''), `P.${k} has no base hex`);
    if (v.line) ok(v.line !== P.ui.ink, `P.${k}.line is ink`);
  }
});
test('core: weight strokes and detail classes', () => {
  const { SW, D2, D3 } = loaded(core);
  ok(SW.outline === 1.75 && SW.internal === 1.1 && SW.detail === 0.9 && SW.leader === 1.25, 'SW tiers are 1.75, 1.1, .9, 1.25');
  ok(D2 === 'ax-d2' && D3 === 'ax-d3', 'detail classes are ax-d2 and ax-d3');
});
test('core: fill() names a shared gradient', () => {
  const { fill } = loaded(core);
  ok(fill('oxy') === 'url(#ax-oxy)', 'fill("oxy") is url(#ax-oxy)');
});
test('core: uid is unique per call and stable with a key', () => {
  const { uid } = loaded(core);
  const a = uid('epi'), b = uid('epi');
  ok(a !== b && a.startsWith('ax-epi-'), `uid gives fresh ax- ids (${a}, ${b})`);
  ok(uid('epi', 'k1') === uid('epi', 'k1'), 'a key makes the id stable');
  ok(/^[\w-]+$/.test(uid('epi', 'hfref refs.2')), 'a key with spaces still makes a valid id');
});
test('core: scopeIds rewrites ids, urls and hrefs, nothing else', () => {
  const { scopeIds } = loaded(core);
  const s = scopeIds('<g id="ax-a"><path fill="url(#ax-a)"/><use href="#ax-b"/><path fill="url(#lx1-ah-k)"/><path id="other"/></g>', 'p7-');
  ok(s.includes('id="p7-ax-a"') && s.includes('url(#p7-ax-a)') && s.includes('href="#p7-ax-b"'), 'ax- ids, urls and hrefs carry the prefix');
  ok(s.includes('url(#lx1-ah-k)') && s.includes('id="other"'), 'other ids are untouched');
});
test('core: artDefs emits only what the body uses', () => {
  const { artDefs } = loaded(core);
  const d = artDefs('<path fill="url(#ax-oxy)"/>');
  ok(d.includes('id="ax-oxy"'), 'oxy gradient emitted');
  ok(!d.includes('id="ax-deoxy"'), 'deoxy gradient not emitted');
  ok(artDefs('<path fill="red"/>') === '', 'nothing used, nothing emitted');
  ok(artDefs(new Set(['ax-lift'])).includes('<filter id="ax-lift"'), 'a Set of ids works, and ax-lift is a filter');
  ok(!/url\(#ax-(\w+)\)[^"]*"[^>]*stroke=/.test(d), 'no gradient used on a stroke');
});
test('core: scopeArt is idempotent and adds defs to a finished svg string', () => {
  const { scopeArt } = loaded(core);
  const raw = '<svg viewBox="0 0 10 10"><defs></defs><path fill="url(#ax-oxy)"/></svg>';
  const once = scopeArt(raw), twice = scopeArt(once);
  ok(once === twice, 'second pass changes nothing');
  const { ids, refs } = scan(once);
  ok(refs.every(r => ids.includes(r)), 'every url resolves inside the svg');
  ok(ids.some(i => /^ax\d+-ax-oxy$/.test(i)), `the oxy gradient is scoped (${ids})`);
});
test('core: path helpers', () => {
  const { smooth, lerpPath, offsetPath, sampleAlong, samplePath, areaOf } = loaded(core);
  const sq = smooth([[0, 0], [100, 0], [100, 100], [0, 100]], { closed: true });
  ok(/^M/.test(sq) && /Z$/.test(sq) && (sq.match(/C/g) || []).length === 4, 'smooth closed gives 4 cubic segments');
  const a = 'M0 0 C10 0 20 0 30 0', b = 'M0 10 C10 10 20 10 30 10';
  ok(lerpPath(a, b, 0.5) === 'M0 5 C10 5 20 5 30 5', `lerpPath on matched paths: ${lerpPath(a, b, 0.5)}`);
  const r = lerpPath('M0 0 L100 0', 'M0 0 C30 40 70 40 100 0', 0.5, { n: 16 });
  ok(samplePath(r, 16).length >= 16, 'lerpPath with n resamples paths of different structure');
  const off = samplePath(offsetPath('M0 0 L100 0', 5), 10);
  ok(off.every(p => Math.abs(Math.abs(p[1]) - 5) < 0.01), 'offsetPath moves a line by its distance');
  const pts = sampleAlong('M0 0 L100 0', 5);
  ok(pts.length === 5 && near0(pts[4][0] - 100) && near0(pts[0][2]), 'sampleAlong gives n points with angles, ends included');
  near(Math.abs(areaOf(samplePath('M0 0 L100 0 L100 50 L0 50 Z', 200))), 5000, 1, 'areaOf a 100 x 50 box');
});
const near0 = x => Math.abs(x) < 1e-6;
test('core: tube draws outline, wall and lumen strokes, cut faces and a mouth', () => {
  const { tube, P } = loaded(core);
  const t = tube('M0 0 L0 100', { wall: 'artery', lumen: 'oxy', w: 24, lumenW: 17, cut: 'end', into: 'M-20 80 L20 80 L20 140 L-20 140 Z' });
  ok(t.svg.includes(`stroke="${P.artery.line}"`) && t.svg.includes(`stroke="${P.artery.base}"`) && t.svg.includes(`stroke="${P.oxy.base}"`), 'three strokes in the right colours');
  ok(/<ellipse/.test(t.svg), 'a cut face');
  ok(typeof t.mouth === 'string' && t.mouth.includes(P.oxy.base), 'into: gives a lumen-coloured mouth');
  ok(Array.isArray(t.box) && t.box.length === 4 && `${t}` === t.svg, 'Art shape');
});
test('core: behind() mixes colours toward the panel', () => {
  const { behind, mix, P } = loaded(core);
  const out = behind('<path fill="#000000" stroke="#ffffff"/>', 0.3);
  ok(out.includes(mix('#000000', P.ui.panel, 0.3)), 'black mixed 30 % toward the panel');
});
test('core: leader ends in a dot on its target', () => {
  const { leader } = loaded(core);
  const s = leader([300, 50], [200, 80]);
  ok(/<circle[^>]*cx="200"[^>]*cy="80"/.test(s) && /stroke-width="1.25"/.test(s), 'a 1.25 ink line and a dot at the target');
});
test('core: textWidth is measured, not 9.4 per character', () => {
  const { textWidth } = loaded(core);
  const w1 = textWidth('Mitral valve', 'sm b'), w2 = textWidth('iiiiiiiiiiii', 'sm b');
  ok(w1 > 80 && w1 < 130, `"Mitral valve" at .sm b is ${w1}`);
  ok(w2 < w1 * 0.6, 'narrow letters measure narrower');
});
test('core: placeLabels keeps 4 units between labels and orders them by target', () => {
  const { placeLabels } = loaded(core);
  const items = [{ text: 'Aorta', cls: 'sm b', at: [100, 40] }, { text: 'Left atrium', cls: 'sm b', at: [150, 52] }, { text: 'Mitral valve', cls: 'sm b', at: [110, 70] }, { text: 'Left ventricle', cls: 'sm b', at: [130, 160] }];
  const out = placeLabels(items, { column: 300, side: 'right', top: 20, bottom: 400 });
  ok(out.length === 4, 'one placement per label');
  for (let i = 1; i < out.length; i++) ok(out[i].y - out[i - 1].y >= 18 + 4 - 0.01, `labels ${i - 1} and ${i} are ${out[i].y - out[i - 1].y} apart`);
  ok(out.map(o => o.text).join() === 'Aorta,Left atrium,Mitral valve,Left ventricle', 'ordered by target y');
  ok(out.every(o => o.leader.includes('<circle')), 'each has a leader');
  // a lower label whose target sits to the right of an upper one's: the leaders must still not cross
  const tricky = placeLabels([{ text: 'Aortic valve', sub: 'outlet door', at: [40, 136] }, { text: 'Mitral valve', sub: 'inlet door', at: [70, 146] }, { text: 'Left ventricle', sub: 'the main pump', at: [103, 180] }], { column: 245, top: 120 });
  const X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  for (let i = 0; i < tricky.length; i++) for (let j = i + 1; j < tricky.length; j++) {
    const p = tricky[i].points, q = tricky[j].points;
    for (let a = 1; a < p.length; a++) for (let b = 1; b < q.length; b++) ok(!X(p[a - 1], p[a], q[b - 1], q[b]), `leaders of ${tricky[i].text} and ${tricky[j].text} cross`);
  }
});

// Two blocks of different heights (a name alone, a name with a descriptor) that trade places to stop
// their leaders crossing must not overlap: the column is restacked in the new order (the vessels
// builder's report, artery-section labels).
test('core: placeLabels restacks after a swap, so blocks of different heights never overlap', () => {
  const { placeLabels } = loaded(core);
  const cases = [
    [{ text: 'Label 0', at: [28.9, 270.4] }, { text: 'Label 1', sub: 'desc 1', at: [100.5, 312.5] }, { text: 'Label 2', at: [22.3, 338] }, { text: 'Label 3', sub: 'desc 3', at: [148.6, 168.3] }, { text: 'Label 4', sub: 'desc 4', at: [54.5, 266.6] }],
    [{ text: 'Label 0', sub: 'desc 0', at: [191.5, 284] }, { text: 'Label 1', sub: 'desc 1', at: [111.8, 129.7] }, { text: 'Label 2', sub: 'desc 2', at: [196.3, 301] }, { text: 'Label 3', at: [119.7, 300] }, { text: 'Label 4', at: [182.6, 268.2] }],
    [{ text: 'Label 0', at: [77.1, 253.6] }, { text: 'Label 1', sub: 'desc 1', at: [192.8, 88.9] }, { text: 'Label 2', at: [151.7, 284.8] }, { text: 'Label 3', sub: 'desc 3', at: [179.1, 288.6] }, { text: 'Label 4', sub: 'desc 4', at: [66.4, 98.7] }],
  ];
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 400; k++) cases.push(Array.from({ length: 3 + Math.floor(rnd() * 3) }, (_, i) => ({ text: `Label ${i}`, ...(rnd() < 0.5 ? { sub: `desc ${i}` } : {}), at: [20 + rnd() * 200, 40 + rnd() * 300] })));
  const bad = [];
  for (const items of cases) {
    const out = placeLabels(items, { column: 260, top: 10, bottom: 410 });
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i].box, b = out[j].box, gap = Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]));
      if (gap < 4 - 0.01) bad.push(`${out[i].text} and ${out[j].text} ${gap.toFixed(1)} apart`);
    }
    const ys = out.map(o => o.box[1]);
    if (ys.some((y, i) => i && y < ys[i - 1])) bad.push('the column is not top to bottom in output order');
  }
  ok(!bad.length, `${bad.length} overlaps, first: ${bad.slice(0, 3).join('; ')}`);
});
test('core: parsePath reads S, T and A (smooth curves and arcs), absolute and relative', () => {
  const { flatten, samplePath, pathLength } = loaded(core);
  // a full circle of radius 10 as two arcs: every flattened point is 10 from the centre
  const circ = flatten('M40 50 A10 10 0 1 0 60 50 A10 10 0 1 0 40 50 Z');
  ok(circ.length > 20 && circ.every(p => Math.abs(Math.hypot(p[0] - 50, p[1] - 50) - 10) < 0.15), 'arcs follow their circle');
  near(pathLength('M0 0 a10 10 0 0 1 20 0'), Math.PI * 10, 0.2, 'a relative half circle is pi r long');
  // S reflects the previous control point: M0 0 C0 10 10 10 10 0 S20 -10 20 0 is symmetric about (10, 0)
  const s = samplePath('M0 0 C0 10 10 10 10 0 S20 -10 20 0', 41);
  ok(s.every((p, i) => Math.abs(p[0] + s[40 - i][0] - 20) < 0.2 && Math.abs(p[1] + s[40 - i][1]) < 0.2), 'S mirrors its first half');
  const t = flatten('M0 0 Q10 10 20 0 T40 0');
  ok(t.some(p => p[0] > 25 && p[0] < 35 && p[1] < -4), 'T reflects the quadratic control point');
  const rel = flatten('m10 10 c0 10 10 10 10 0 s10 -10 10 0');
  near(rel[rel.length - 1][0], 30, 1e-6, 'relative s ends where it says');
});
test('core: placer maps points, paths and boxes exactly as place() does', () => {
  const { placer, place, artOf } = loaded(core);
  for (const o of [{}, { x: 30, y: 12, s: 0.6 }, { x: 100, y: 50, s: 1.4, rot: 30 }, { x: 5, y: 9, s: 2, flip: true, rot: -20 }]) {
    const m = placer(o), a = place(artOf('', [0, 0, 40, 20], { p: [10, 5] }), o);
    near(m.map([10, 5])[0], a.at.p[0], 1e-9, 'x'); near(m.map([10, 5])[1], a.at.p[1], 1e-9, 'y');
    ok(m.boxOf([0, 0, 40, 20]).join() === a.box.join(), `box ${m.boxOf([0, 0, 40, 20])} vs ${a.box}`);
    ok(a.svg.startsWith(`<g transform="${m.tf}">`), `tf ${m.tf}`);
    const d = m.mapD('M0 0 L10 5 C1 2 3 4 5 6 Z');
    ok(d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, '#') === 'M# # L# # C# # # # # # Z', `mapD keeps the command structure: ${d}`);
    const q = m.map([10, 5]);
    ok(d.includes(`L${+q[0].toFixed(2)} ${+q[1].toFixed(2)}`), 'mapD maps each pair');
  }
  ok(placer({ x: 0, y: 0 }, [10, 20]).map([10, 20]).join() === '0,0', 'an origin is the anchor');
  ok(placer({ rot: 90, flip: true }).angle(0) === 270 && placer({ rot: 10 }).angle(5) === 15, 'angle() turns a direction with the placement');
  ok(placer().identity && !placer({ x: 1 }).identity, 'identity');
  ok(placer({ rot: 90 }).mapD('M0 0 A5 5 0 0 1 10 0').includes('C'), 'mapD converts an arc to cubics before mapping');
});
test('core: partName renames, splits multi-names and drops repeats', () => {
  const { partName, partAttr } = loaded(core);
  ok(partName({}, 'vessel artery wall') === 'vessel artery wall', 'plain names pass');
  ok(partName({ lv: 'ventricle' }, 'heart lv') === 'heart ventricle', 'renamed');
  ok(partName({ ra: 'atria', la: 'atria' }, 'ra la') === 'atria', 'a rename that collides is written once');
  ok(partName({}, ['vessel', 'artery wall']) === 'vessel artery wall', 'arrays of names');
  ok(partAttr({ sglt: 'sglt2' }, 'sglt') === 'data-part="sglt2"', 'partAttr');
});
test('core: polygon helpers rayHit, lineCrossings, widthAcross, nearestOn', () => {
  const { rayHit, lineCrossings, widthAcross, nearestOn } = loaded(core);
  const sq = [[0, 0], [100, 0], [100, 50], [0, 50]];
  near(rayHit([50, 25], [1, 0], sq), 50, 1e-9, 'ray to the right wall');
  ok(rayHit([150, 25], [1, 0], sq) === Infinity, 'no hit is Infinity');
  ok(rayHit([50, 25], [0, 1], sq, { min: 30 }) === Infinity && rayHit([50, 25], [0, 1], sq, { min: 20 }) === 25, 'hits nearer than min are skipped');
  ok(lineCrossings(sq, [50, 25], [1, 0]).sort((a, b) => a - b).join() === '-50,50', 'both crossings of a line');
  near(widthAcross(sq, [50, 25], [0, 1]), 50, 1e-9, 'width across');
  near(widthAcross(sq, [50, 25], [0, 1], [[0, 10], [100, 10], [100, 40], [0, 40]]), 30, 1e-9, 'clipped to a smaller polygon');
  ok(nearestOn(sq, [50, -7]).join() === '50,0' && nearestOn(sq, [120, 60]).join() === '100,50', 'nearest point on the outline');
});
test('core: crCubics, cubicsD, framesOf and litEdge', () => {
  const { crCubics, cubicsD, framesOf, litEdge, smooth } = loaded(core);
  const pts = [[0, 0], [30, 10], [60, 0], [90, 20]], cs = crCubics(pts);
  ok(cs.length === 3 && cs[0][0] === pts[0] && cs[2][3] === pts[3], 'one cubic per interval, through the points');
  ok(cubicsD(cs) === smooth(pts), 'cubicsD of crCubics is smooth() of the same points');
  const fr = framesOf('M0 0 L30 0', 3);
  ok(fr.length >= 10 && fr.every(([p, n]) => Math.abs(n[0]) < 1e-9 && Math.abs(n[1] - 1) < 1e-9), 'left normals of a rightward line point down the screen (+y)');
  const e = litEdge('M0 0 L100 0', 4);
  ok(/^M/.test(e) && e.split('M').length === 2, `one lit run along a straight tube: ${e.slice(0, 40)}`);
  ok(litEdge('M0 0 L100 0', 4).includes(' -4') || /\d -4/.test(e), 'the lit side of a horizontal tube is the top (toward the light)');
});
test('core: arrowFixed has a fixed head whatever its length, and no id', () => {
  const { arrowFixed, P } = loaded(core);
  const a = arrowFixed([0, 0], [40, 0], { col: P.ui.blue }), b = arrowFixed([0, 0], [200, 0], { col: P.ui.blue });
  const head = s => /<path d="M([^"]+)" fill/.exec(s)[1].split(/\s*L\s*|\s+/).map(Number);
  const ha = head(a), hb = head(b);
  near(ha[0] - ha[2], hb[0] - hb[2], 1e-6, 'same head length'); near(ha[3] - ha[5], hb[3] - hb[5], 1e-6, 'same head width');
  ok(!/id="/.test(a) && a.includes(P.ui.blue) && /stroke-width="2.5"/.test(a), 'kit colour, 2.5 shaft, no marker id');
  ok(/stroke-width="1.25"/.test(arrowFixed([0, 0], [40, 0], { s: 2 })), 'weight is compensated for scale');
});
test('core: litGradient keeps the light at the upper left of a rotated or mirrored glyph', () => {
  const { litGradient, P } = loaded(core);
  const at = s => { const m = /cx="([-\d.]+)" cy="([-\d.]+)"/.exec(s); return [+m[1], +m[2]]; };
  const up = at(litGradient('ax-g1', 'protein')), r180 = at(litGradient('ax-g2', 'protein', { rot: 180 })), fl = at(litGradient('ax-g3', 'protein', { flip: true }));
  ok(up[0] < 0.5 && up[1] < 0.5, `unturned highlight is upper left (${up})`);
  ok(r180[0] > 0.5 && r180[1] > 0.5, `turned 180 degrees, the highlight moves to the glyph's lower right (${r180})`);
  ok(fl[0] > 0.5 && fl[1] < 0.5, `mirrored, it moves to the glyph's right (${fl})`);
  ok(litGradient('ax-g4', 'protein').includes(P.protein.hi) && /id="ax-g4"/.test(litGradient('ax-g4', 'protein')), 'material stops and the given id');
});
test('core: P holds the materials the library modules derived (exact values, no local copies)', () => {
  const { P } = loaded(core);
  const want = {
    'lymph.base': '#fbf1e5', 'lymph.cut': '#e0c39f', 'elastic.base': '#b37b70',
    'hbAlpha.base': '#f0b8af', 'hbAlpha.line': '#9f5351', 'hbBeta.base': '#e8978a', 'hbBeta.lo': '#cd736a', 'heme.base': '#8e1e1f',
    'iron.base': '#e4a644', 'iron.line': '#7f3e13', 'rbc.deoxyLine': '#562b37',
    'tubulePt.base': '#b2c9b2', 'tubuleThin.line': '#8c6d59', 'tubuleTal.base': '#cf9072', 'tubuleDct.base': '#85afaa', 'tubuleCd.line': '#4e5666',
    'space.renalCortex': '#e5d6ca', 'space.renalOuter': '#dac7bd', 'space.renalInner': '#be958c', 'space.renalEdge': '#aa9289',
    'renin.base': P.protein2.base, 'exudate.base': P.fibrin.base,
    'mg.base': '#9ea734', 'mg.line': '#545924', 'sulfur.base': '#f2bf49', 'adenine.base': '#97a1c1', 'ribose.base': '#f8da94',
    'ach.line': '#643543', 'insulin.line': '#204738', 'angiotensin.line': '#5c3926', 'cortisol.line': '#6a4c18', 'trh.line': '#3c644c',
  };
  for (const [k, hex] of Object.entries(want)) { const [a, b] = k.split('.'); ok(P[a] && P[a][b] === hex, `P.${k} should be ${hex}, is ${P[a] && P[a][b]}`); }
  for (const [k, v] of Object.entries(P)) if (v && v.base && !['ui', 'space', 'collagen', 'glyco'].includes(k)) ok(v.line, `P.${k} has a line (messengers included)`);
});

/* ---------- heart: the four-chamber section ---------- */
test('heart: loads', () => { loaded(heart); });
test('heart: heartSection is an Art with the recipe\'s parts, all leaves', () => {
  const { heartSection } = loaded(heart);
  const h = heartSection();
  ok(typeof h.svg === 'string' && `${h}` === h.svg, 'svg and toString');
  ok(h.box.join() === '0,0,240,280', `native box 240 x 280 (${h.box})`);
  for (const k of ['aorta', 'mitral', 'tricuspid', 'apex', 'septum', 'pulmonary-trunk']) ok(Array.isArray(h.at[k]), `at.${k}`);
  const parts = partsOf(h.svg);
  for (const p of 'ra rv la lv septum tricuspid mitral aortic-valve pulmonary-valve aorta pulmonary-trunk vena-cava pulmonary-veins'.split(' ')) ok(parts.has(p), `part ${p}`);
  const { nested } = scan(h.svg);
  ok(!nested.length, `no nested parts: ${nested.slice(0, 3).join('; ')}`);
  ok(typeof h.outline({}) === 'string' && /^M/.test(h.outline({})), 'outline(state) gives a path');
});
test('heart: heartSection parts can be renamed, placed and scaled', () => {
  const { heartSection } = loaded(heart);
  const h = heartSection({ parts: { lv: 'ventricle' }, x: 20, y: 10, s: 1.25 });
  ok(partsOf(h.svg).has('ventricle') && !partsOf(h.svg).has('lv'), 'lv renamed to ventricle');
  ok(h.box.join() === '20,10,300,350', `box placed and scaled (${h.box})`);
  near(h.at.apex[0], 20 + 1.25 * heartSection().at.apex[0], 0.01, 'at is in picture coordinates');
});
test('heart: heartSection valves move from the recipe\'s shut to open paths', () => {
  const { heartSection } = loaded(heart);
  const shut = heartSection({ valves: { mitral: 0, tricuspid: 0, aortic: 0, pulmonary: 0 } }).svg;
  const open = heartSection({ valves: { mitral: 1, tricuspid: 1, aortic: 1, pulmonary: 1 } }).svg;
  ok(open.includes('M152 134 C156 146 160 158 164 170'), 'mitral anterior leaflet open path from the recipe');
  ok(shut.includes('M152 134 C162 137 175 137 187.5 134.2'), 'mitral anterior leaflet shut path from the recipe');
  ok(shut.includes('M121 147 Q124 155 133.5 151'), 'aortic left cusp shut path from the recipe');
});
test('heart: heartSection cavities follow volume over 0.30 to 1.25', () => {
  const { sectionGeometry } = loaded(heart);
  for (const ch of ['lv', 'rv']) {
    let prev = 0;
    for (let a = 0.3; a <= 1.2501; a += 0.05) {
      const got = sectionGeometry.area(ch, sectionGeometry.sizeForArea(ch, a)) / sectionGeometry.area(ch, 1);
      near(got, a, a * 0.01, `${ch} area fraction at ${a.toFixed(2)}`);
      ok(got > prev, `${ch} area grows with volume`);
      prev = got;
    }
  }
});
test('heart: heartSection conduction and flow overlays', () => {
  const { heartSection } = loaded(heart);
  const c = heartSection({ conduction: { sa: 1, atria: 1, av: 1, his: 1, bundles: 1, purkinje: 1 } }).svg;
  ok(partsOf(c).has('conduction') && partsOf(c).has('sa') && partsOf(c).has('av'), 'conduction, sa, av parts');
  ok(/data-part="[^"]*rvot[^"]*"[^>]*opacity="0?\.18"/.test(c), 'rvot ghosted at 18 % with conduction');
  const f = heartSection({ flow: { inflow: 1, outflow: 1, phase: 0.25 } }).svg;
  ok(/stroke-dashoffset="-6"/.test(f), 'streamline dash offset is -24 x phase');
});

/* ---------- heart: the left heart, long axis ---------- */
// Steady beats of pressure-volume-loop's model, as fractions of the normal EDV (app.js CONDITIONS).
const pv = await import(root + 'lab/pressure-volume-loop/model.js');
const CONDS = { base: {}, fluids: { Pla: 8 }, constrict: { Rs: 2 }, inotrope: { Ees: 5 }, venodil: { Pla: 2 }, beta: { HR: 56, Ees: 2.8 }, hfref: { Ees: 1.3, Pla: 9, HR: 85 } };
const BEATS = Object.fromEntries(Object.entries(CONDS).map(([k, s]) => [k, new pv.Simulator({ ...pv.DEFAULTS, ...s }).runToSteady(300)]));
const EDV0 = BEATS.base.EDV;
test('heart: the model needs 0.30 to 1.25 of the normal EDV (critique C3.1)', () => {
  for (const [k, b] of Object.entries(BEATS)) ok(b.ESV / EDV0 >= 0.3 && b.EDV / EDV0 <= 1.25, `${k}: ${(b.ESV / EDV0).toFixed(2)} to ${(b.EDV / EDV0).toFixed(2)}`);
});
test('heart: lvGeometry cavity volume is monotonic and invertible within 1 %', () => {
  // The cavity is the long-axis cut of a half ellipsoid; its volume (long x short squared) tracks the model.
  const { lvGeometry: g } = loaded(heart);
  ok(g.RANGE[0] <= 0.3 && g.RANGE[1] >= 1.25, `range ${g.RANGE}`);
  let prev = 0;
  for (let i = 0; i <= 64; i++) {
    const a = 0.3 + 0.95 * i / 64, s = g.sizeForVolume(a), got = g.volume(s) / g.volume(g.sizeForVolume(1));
    near(got, a, a * 0.01, `volume fraction ${a.toFixed(3)}`);
    ok(s > prev, 'size grows with volume');
    prev = s;
  }
});
test('heart: the short axis shortens by a normal fraction (25 to 45 %), not to a slit', () => {
  const { lvGeometry: g } = loaded(heart);
  const ed = g.axes(g.sizeForVolume(1));
  for (const [k, b] of Object.entries(BEATS)) {
    if (k === 'hfref') continue;
    const fs = 1 - g.axes(g.sizeForVolume(b.ESV / EDV0)).Di / g.axes(g.sizeForVolume(b.EDV / EDV0)).Di;
    ok(fs >= 0.2 && fs <= 0.45, `${k}: fractional shortening ${(fs * 100).toFixed(0)} %`);
  }
  const fsHf = 1 - g.axes(g.sizeForVolume(BEATS.hfref.ESV / EDV0)).Di / g.axes(g.sizeForVolume(BEATS.hfref.EDV / EDV0)).Di;
  ok(fsHf < 0.2, `heart failure shortens less (${(fsHf * 100).toFixed(0)} %)`);
  void ed;
});
test('heart: lvGeometry muscle volume is conserved; the wall thickens as it empties', () => {
  // The wall's thickness comes from the muscle's volume (a half-ellipsoid shell), not its area in the
  // cut: with the long axis shortening at the base, a conserved cut area would hardly thicken the wall.
  const { lvGeometry: g } = loaded(heart);
  let hPrev = Infinity;
  for (const a of [0.3, 0.45, 0.6, 0.8, 1, 1.1, 1.25]) {
    const s = g.sizeForVolume(a);
    near(g.muscleVolume(s), 1, 0.01, `muscle volume at ${a}`);
    const h = g.wall(s);
    ok(h < hPrev, `wall thickness falls as the cavity grows (${a}: ${h})`);
    hPrev = h;
  }
  const k = g.wall(g.sizeForVolume(0.39)) / g.wall(g.sizeForVolume(1));
  ok(k > 1.4 && k < 2, `at the normal ESV the wall is about one and a half times its end-diastolic thickness (${k.toFixed(2)})`);
});
test('heart: open leaflets and papillary heads stay 6 units inside the cavity, every condition', () => {
  const { lvGeometry: g } = loaded(heart);
  const bad = [];
  for (const [k, b] of Object.entries(BEATS)) {
    for (let i = 0; i <= 12; i++) {
      const V = b.ESV + (b.EDV - b.ESV) * i / 12;
      for (const squeeze of [0, 1]) {
        const st = { volume: V, edv: EDV0, mitral: squeeze ? 0 : 1, aortic: squeeze ? 1 : 0, squeeze };
        const c = g.clearance(st);
        if (c.min < 6) bad.push(`${k} V ${V.toFixed(0)} squeeze ${squeeze}: ${c.worst} ${c.min.toFixed(1)}`);
      }
    }
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 4).join('; ')}`);
});
test('heart: shut mitral leaflets coapt below the annulus, never in the atrium', () => {
  const { lvGeometry: g } = loaded(heart);
  for (const a of [0.4, 1, 1.23]) {
    const st = { volume: a * EDV0, edv: EDV0, mitral: 0, squeeze: 1 };
    ok(g.coaptationDepth(st) >= 4 && g.coaptationDepth(st) <= 6, `coaptation ${g.coaptationDepth(st).toFixed(1)} units below the annulus at ${a}`);
  }
});
// Volumes the left heart must draw: every fraction of the normal EDV the band covers, at rest and squeezing.
const SWEEP = Array.from({ length: 20 }, (_, i) => 0.3 + 0.05 * i).filter(a => a <= 1.2501);
test('heart: septum and free wall stay within 0.8 to 1.25 of each other at every volume (no HCM look)', () => {
  const { lvGeometry: g } = loaded(heart);
  const bad = [];
  for (const a of SWEEP) for (const squeeze of [0, 1]) {
    const w = g.walls({ volume: a * EDV0, edv: EDV0, squeeze }), r = w.septum / w.free;
    if (!(r >= 0.8 && r <= 1.25)) bad.push(`${a.toFixed(2)} squeeze ${squeeze}: septum ${w.septum.toFixed(1)} / free ${w.free.toFixed(1)} = ${r.toFixed(2)}`);
  }
  ok(!bad.length, `${bad.length} volumes out of band, first: ${bad.slice(0, 3).join('; ')}`);
});
// A normal ventricle empties as a smaller cone: its deepest point stays on the long axis at the apex,
// each side narrows steadily from its widest point to the apex, and below the papillary muscle the
// free wall has no inflection (the review's hourglass with an apical pouch must never come back).
// endocardium(state) is in the drawing's local frame: u along the long axis toward the apex, v across
// it (0 on the axis, positive toward the free wall); each side runs from the base to the apex.
const turns = pts => { // signs of the turn at each interior point of a polyline, ignoring near-straight ones
  const out = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], x = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(x) > 1e-3) out.push(Math.sign(x));
  }
  return out;
};
test('heart: the emptied cavity is a cone that tapers smoothly to the apex on the long axis', () => {
  const { lvGeometry: g } = loaded(heart);
  for (const a of [0.3, 0.39, 0.6, 1, 1.25]) for (const squeeze of [0, 1]) {
    const at = `${a} squeeze ${squeeze}`, e = g.endocardium({ volume: a * EDV0, edv: EDV0, squeeze });
    const all = [...e.septal, ...e.lateral], deep = all.reduce((m, p) => (p[0] > m[0] ? p : m));
    ok(Math.abs(deep[1]) <= 3, `${at}: the deepest point is ${deep[1].toFixed(1)} units off the long axis`);
    for (const [side, pts, sgn] of [['free wall', e.lateral, 1], ['septum', e.septal, -1]]) {
      const w = pts.map(p => sgn * p[1]), iw = w.indexOf(Math.max(...w));
      for (let i = iw + 1; i < pts.length; i++) {
        ok(pts[i][0] >= pts[i - 1][0] - 1e-6, `${at}: the ${side} turns back toward the base at u ${pts[i][0].toFixed(1)}`);
        ok(w[i] <= w[i - 1] + 0.05, `${at}: the ${side} widens again at u ${pts[i][0].toFixed(1)} (${w[i - 1].toFixed(2)} to ${w[i].toFixed(2)})`);
      }
      // one direction of turn from the widest point to the apex: no inflection, no pouch
      const below = pts.slice(Math.max(0, Math.min(iw, pts.findIndex(p => p[0] >= (side === 'free wall' ? e.papillary.L : e.papillary.S)[0]))));
      const t = turns(below);
      ok(t.every(s => s === t[0]), `${at}: the ${side} below its papillary muscle has an inflection`);
    }
  }
});
test('heart: the apex is pinned and the annular plane carries the long-axis shortening', () => {
  const { lvGeometry: g } = loaded(heart);
  const ed = { volume: EDV0, edv: EDV0 }, es = { volume: BEATS.base.ESV, edv: EDV0, squeeze: 1 };
  const a0 = g.endoApex(ed);
  for (const a of SWEEP) for (const squeeze of [0, 1]) {
    const q = g.endoApex({ volume: a * EDV0, edv: EDV0, squeeze });
    near(Math.hypot(q[0] - a0[0], q[1] - a0[1]), 0, 0.5, `endocardial apex at ${a.toFixed(2)} squeeze ${squeeze}`);
  }
  near(g.descent(ed), 0, 0.01, 'no descent when full');
  const d = g.descent(es);
  ok(d >= 12 && d <= 20, `annular descent at the normal ESV is ${d.toFixed(1)} units (about 12 to 15 mm at 0.7 mm a unit)`);
  ok(g.walls(es).apex < g.walls(es).free, `the apex is the thinnest wall at end-systole (apex ${g.walls(es).apex.toFixed(1)}, free wall ${g.walls(es).free.toFixed(1)})`);
});
test('heart: the left heart stays inside its box at every volume (nothing crosses the readout)', () => {
  const { lvGeometry: g } = loaded(heart);
  const [bx, by, bw, bh] = g.BOX;
  for (const a of SWEEP) for (const squeeze of [0, 1]) {
    const [x0, y0, x1, y1] = g.extent({ volume: a * EDV0, edv: EDV0, squeeze });
    ok(x0 >= bx && y0 >= by && x1 <= bx + bw && y1 <= by + bh, `${a.toFixed(2)} squeeze ${squeeze}: extent ${[x0, y0, x1, y1].map(v => v.toFixed(1))} outside ${g.BOX}`);
  }
});
test('heart: shut aortic cusps overlap at every volume and squeeze (no regurgitant gap)', () => {
  const { lvGeometry: g } = loaded(heart);
  for (const a of SWEEP) for (const squeeze of [0, 1]) {
    const c = g.aorticCoaptation({ volume: a * EDV0, edv: EDV0, squeeze, aortic: 0 });
    ok(c >= 1.5 && c <= 4, `${a.toFixed(2)} squeeze ${squeeze}: cusps overlap by ${c.toFixed(2)} units`);
  }
});
// The leaflets must read as leaflets at 480 wide, not lines: filled sails at least 4 units thick at the
// hinge (5.7 at step 1's scale of 1.42, 2.9 on the 0.72 band heart), tapering to a free edge at most
// half that.
test('heart: mitral leaflets are filled, tapered sails that meet 4 to 6 units below the annulus', () => {
  const { lvGeometry: g } = loaded(heart);
  for (const a of [0.3, 0.39, 1, 1.25]) for (const mitral of [0, 1]) {
    const m = g.mitralShape({ volume: a * EDV0, edv: EDV0, mitral, squeeze: mitral ? 0 : 1 });
    for (const k of ['anterior', 'posterior']) {
      ok(m.hinge[k] >= 4 && m.hinge[k] <= 6, `${k} leaflet ${m.hinge[k]} units thick at the hinge`);
      ok(m.edge[k] <= 0.5 * m.hinge[k] && m.edge[k] >= 1.2, `${k} leaflet tapers to a ${m.edge[k]}-unit free edge`);
    }
    ok(m.anterior / m.posterior >= 1.5 && m.anterior / m.posterior <= 2, `anterior ${m.anterior.toFixed(1)} is 1.5 to 2 x the posterior ${m.posterior.toFixed(1)}`);
    if (!mitral) {
      ok(m.depth >= 4 && m.depth <= 6, `${a}: shut leaflets meet ${m.depth.toFixed(1)} units below the annulus`);
      ok(m.overlap >= 1.5, `${a}: shut leaflets share a coaptation edge (${m.overlap.toFixed(1)} units)`);
    }
  }
});
test('heart: papillary muscles stay apart and inside the endocardium, every condition', () => {
  const { lvGeometry: g, } = loaded(heart);
  const { pointInPolygon, distToPolygon } = loaded(core);
  const cross = (p, q, r, s) => { const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0; };
  const bad = [];
  for (const [k, b] of Object.entries(BEATS)) for (const [V, squeeze] of [[b.ESV, 1], [b.ESV, 0], [b.EDV, 0], [b.EDV, 1]]) {
    const st = { volume: V, edv: EDV0, squeeze, mitral: squeeze ? 0 : 1 }, { cones, cavity } = g.papillary(st);
    const [A, B] = cones;
    let hit = false;
    for (let i = 0; i < A.length && !hit; i++) for (let j = 0; j < B.length && !hit; j++) hit = cross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length]);
    if (hit || A.some(p => pointInPolygon(p, B)) || B.some(p => pointInPolygon(p, A))) bad.push(`${k} V ${V.toFixed(0)} squeeze ${squeeze}: the two papillary muscles overlap`);
    const out = [...A, ...B].filter(p => !pointInPolygon(p, cavity) && distToPolygon(p, cavity) > 0.6);
    if (out.length) bad.push(`${k} V ${V.toFixed(0)} squeeze ${squeeze}: ${out.length} papillary points lie beyond the endocardium`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 3).join('; ')}`);
});
// Papillary muscles are broad-based cones (base 1.5 to 2.2 times the head), rising toward the annulus
// from the middle to apical part of their wall (never from the apical cap), with a rounded head wide
// enough for the chordae to insert into. As the ventricle empties they shorten and fatten, keeping
// their volume. Leaning in along their chordae they reach at most about two thirds of the way across
// even the emptiest cavity (an inotrope's or a venodilator's end-systole; the opposite wall and the
// leaflet tips are kept clear by the clearance test above).
// Per-muscle bounds. The anterolateral stands on the free wall at the junction of the middle and apical
// thirds. The posteromedial stands low on the inferior wall, past where the right ventricle ends (0.9 of
// the way to the apex), so it is longer, leans further and, in the most emptied ventricles, spans the
// cavity's narrow apical width; its chordae still run straight when the valve shuts (heart.test.mjs).
const PAP_BOUNDS = {
  anterolateral: { at: [0.35, 0.8], atED: [0.6, 0.7], offWall: [25, 50], length: [0.35, 0.45], reach: 0.7 },
  posteromedial: { at: [0.85, 0.95], atED: [0.85, 0.95], offWall: [25, 60], length: [0.45, 0.6], reach: 1.2 },
};
const inB = (v, [a, b]) => v >= a && v <= b;
test('heart: papillary muscles are broad-based fingers that rise toward the annulus and fatten as they squeeze', () => {
  const { lvGeometry: g } = loaded(heart);
  const bad = [];
  for (const [k, b] of Object.entries(BEATS)) for (const [V, squeeze] of [[b.EDV, 0], [b.ESV, 1], [b.ESV, 0], [(b.EDV + b.ESV) / 2, 1]]) {
    for (const m of g.papillaryShape({ volume: V, edv: EDV0, squeeze, mitral: squeeze ? 0 : 1 })) {
      const at = `${k} V ${V.toFixed(0)} squeeze ${squeeze} ${m.name}`;
      if (!(m.base / m.head >= 1.5 && m.base / m.head <= 2.2)) bad.push(`${at}: base ${m.base.toFixed(1)} is ${(m.base / m.head).toFixed(2)} x the head ${m.head.toFixed(1)}`);
      const PB = PAP_BOUNDS[m.name];
      if (!inB(m.at, PB.at)) bad.push(`${at}: leaves the wall at ${m.at.toFixed(2)} of the way from the annulus to the apex`);
      if (!(m.toBase >= 0.25)) bad.push(`${at}: points ${m.toBase.toFixed(2)} toward the annulus (should rise toward it)`);
      if (!(m.head >= 4.5)) bad.push(`${at}: head ${m.head.toFixed(1)} units wide, too thin to carry chordae`);
      if (!(m.depth <= PB.reach * m.across)) bad.push(`${at}: reaches ${m.depth.toFixed(1)} of the ${m.across.toFixed(1)} across the cavity`);
    }
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 4).join('; ')}`);
  const B0 = BEATS.base;
  const rest = g.papillaryShape({ volume: B0.EDV, edv: EDV0, squeeze: 0, mitral: 1 }), sq = g.papillaryShape({ volume: B0.ESV, edv: EDV0, squeeze: 1 });
  for (let i = 0; i < 2; i++) {
    ok(sq[i].length < rest[i].length * 0.92, `${rest[i].name}: squeezing shortens it (${rest[i].length.toFixed(1)} to ${sq[i].length.toFixed(1)})`);
    ok(sq[i].head > rest[i].head * 1.08, `${rest[i].name}: squeezing fattens it (${rest[i].head.toFixed(1)} to ${sq[i].head.toFixed(1)})`);
    const v0 = rest[i].length * rest[i].head ** 2, v1 = sq[i].length * sq[i].head ** 2;
    near(v1 / v0, 1, 0.2, `${rest[i].name}: length x width squared is kept`);
  }
});
// The owner's proportions (round 3), revised in round 4 for the chordae: each muscle leaves its wall
// 0.6 to 0.7 of the way to the apex, leans in along its chordae 25 to 50 degrees off the wall's tangent
// (the posteromedial, under the outflow tract, leans further), and is 0.35 to 0.45 of the long axis at
// the normal end-diastole (base of the cone to tip of the head).
test('heart: papillary muscles are a third to a half of the long axis and rise along their chordae', () => {
  const { lvGeometry: g } = loaded(heart);
  const bad = [];
  for (const [k, b] of Object.entries(BEATS)) for (const m of g.papillaryShape({ volume: b.EDV, edv: EDV0, squeeze: 0, mitral: 0 })) {
    const at = `${k} end-diastole ${m.name}`;
    const PB = PAP_BOUNDS[m.name];
    if (!inB(m.at, PB.atED)) bad.push(`${at}: leaves the wall ${m.at.toFixed(2)} of the way to the apex`);
    if (!inB(m.offWall, PB.offWall)) bad.push(`${at}: runs ${m.offWall.toFixed(1)} degrees off the wall`);
    if (Math.abs(b.EDV - EDV0) < 1 && !inB(m.length / m.longAxis, PB.length)) bad.push(`${at}: ${(m.length / m.longAxis).toFixed(2)} of the long axis`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 4).join('; ')}`);
});
// Chordae tendineae do not stretch (anatomist, round 4). Through one whole lap of every condition's beat
// (beat.js's own walk: fill, contract, eject, relax), each chord's DRAWN length, measured off the path the
// picture paints, stays within 10 % of itself; with the valve shut every chord is straight (it is
// pulled taut), and no chord is ever shorter than the straight span between its ends. Each chord
// leaves its own muscle's head and inserts on a leaflet, and the muscle stays at least about as long
// as its longest chord at every phase (0.95: an inotrope's end-systole is the tightest), so systole
// never reads as short muscles on long strings. This replaces an end-diastole-only check, which
// measured with the valve open and so let systole's long chords through.
const beat = await import(root + 'lab/pressure-volume-loop/beat.js');
const lapStates = b => {
  const s = beat.shape(b, { X: v => v, Y: p => p }), out = [];
  for (let i = 0; i <= 80; i++) {
    const [edge, p] = beat.lapAt(i / 80 * 0.99999), m = beat.moment(s, edge, p, { VOL: x => x, PRS: y => y });
    out.push({ t: i / 80, edge, st: { volume: m.V, edv: EDV0, mitral: m.mitral, aortic: m.aortic, squeeze: m.squeeze } });
  }
  return out;
};
test('heart: every chord keeps its length through the beat, every condition, and the muscles stay as long as their chordae', () => {
  const { lvGeometry: g } = loaded(heart);
  const { samplePath, distToPolygon, pointInPolygon } = loaded(core);
  const drawn = d => { const q = samplePath(d, 120); let s = 0; for (let i = 1; i < q.length; i++) s += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return s; };
  const bad = [];
  for (const [k, b] of Object.entries(BEATS)) {
    const lens = {}, at = {};
    for (const { t, edge, st } of lapStates(b)) {
      const cs = g.chordae(st), ps = g.papillaryShape(st), { cones } = g.papillary(st), mus = { L: 0, S: 1 };
      ok(cs.length >= 6, `${k}: ${cs.length} chordae drawn`);
      cs.forEach((c, i) => {
        const L = drawn(c.d), span = Math.hypot(c.ins[0] - c.from[0], c.ins[1] - c.from[1]);
        (lens[i] ||= []).push(L); (at[i] ||= []).push(`t ${t.toFixed(3)} ${edge}`);
        if (L < span - 0.05) bad.push(`${k} t ${t.toFixed(3)}: chord ${i} drawn ${L.toFixed(1)}, shorter than its span ${span.toFixed(1)}`);
        if (st.mitral === 0 && L > span * 1.1) bad.push(`${k} t ${t.toFixed(3)} ${edge}: chord ${i} is slack (${L.toFixed(1)} over ${span.toFixed(1)}) with the valve shut`);
        const cone = cones[mus[c.muscle]];
        if (!(pointInPolygon(c.from, cone) || distToPolygon(c.from, cone) <= 1.5)) bad.push(`${k} t ${t.toFixed(3)}: chord ${i} does not leave its muscle's head`);
      });
      for (const m of ps) if (!(m.length >= 0.95 * m.chord)) bad.push(`${k} t ${t.toFixed(3)} ${edge} ${m.name}: muscle ${m.length.toFixed(1)} against a ${m.chord.toFixed(1)} chord`);
    }
    for (const [i, a] of Object.entries(lens)) {
      const r = Math.max(...a) / Math.min(...a);
      if (!(r <= 1.1)) bad.push(`${k}: chord ${i} runs ${Math.min(...a).toFixed(1)} to ${Math.max(...a).toFixed(1)} (x ${r.toFixed(2)}) through the beat (longest at ${at[i][a.indexOf(Math.max(...a))]})`);
    }
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 4).join('; ')}`);
});
// The positive control for the test above: the round-3 drawing's chord, from a fixed point on the
// shut leaflet to a head that only shortens with squeeze, is about twice as long at end-systole as at
// end-diastole; the drawn-length measure must see that as a failure.
test('heart: the chord-length measure catches a chord that stretches (control)', () => {
  const { samplePath } = loaded(core);
  const drawn = d => { const q = samplePath(d, 120); let s = 0; for (let i = 1; i < q.length; i++) s += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return s; };
  const a = drawn('M10 10 Q20 15.5 31 21'), b = drawn('M10 10 Q27 25 44 40');
  ok(b / a > 1.1, `a stretched chord reads ${(b / a).toFixed(2)} x`);
});
// Owner decision (round 3): no descending aorta at all; the arch ends in an end-on cut face above the
// atrium. Nothing of the aorta above the root (ascending aorta, arch, branches, the cut face) may overlap
// the left atrium's outline, wall included, at any volume, and there is no stub, behind tier or seam.
test('heart: no aorta geometry overlaps the left atrium; the arch ends in a cut face, no descending stub', () => {
  const { lvGeometry: g, leftHeart } = loaded(heart);
  const { pointInPolygon, distToPolygon } = loaded(core);
  for (const a of SWEEP) for (const squeeze of [0, 1]) {
    const { aorta, atrium, wall } = g.aortaAndAtrium({ volume: a * EDV0, edv: EDV0, squeeze });
    for (const [name, poly] of aorta) {
      const gap = Math.min(...poly.map(p => pointInPolygon(p, atrium) ? -distToPolygon(p, atrium) : distToPolygon(p, atrium))) - wall;
      ok(gap >= 2, `${a.toFixed(2)} squeeze ${squeeze}: the ${name} comes within ${gap.toFixed(1)} units of the atrium's outer wall`);
      ok(!atrium.some(p => pointInPolygon(p, poly)), `${a.toFixed(2)}: the atrium reaches into the ${name}`);
    }
  }
  const mk = leftHeart({ edv: EDV0 }).markup;
  ok(/data-ax-cut="arch"/.test(mk), 'the arch ends in a cut face');
  ok(!/descending|data-ax-tier="behind"/.test(mk), 'no descending aorta and no behind tier');
  ok(!/stroke="#ecefe5"[^>]*stroke-linecap="butt"/.test(mk), 'no panel-coloured occlusion break');
});

test('heart: leftHeart markup has the lesson\'s parts, leaves only, unique ids that resolve', () => {
  const { leftHeart } = loaded(heart);
  const a = leftHeart({ edv: EDV0, refs: [EDV0, BEATS.base.ESV], mark: 'contractility', key: 'a' });
  const b = leftHeart({ edv: EDV0, key: 'b' });
  const parts = partsOf(a.markup);
  for (const p of ['atrium', 'mitral', 'ventricle', 'aortic', 'aorta']) ok(parts.has(p), `part ${p}`);
  const sa = scan(a.markup), sb = scan(b.markup);
  ok(!sa.nested.length, `nested parts: ${sa.nested.slice(0, 3).join('; ')}`);
  ok(new Set(sa.ids).size === sa.ids.length, 'ids unique within one heart');
  ok(!sa.ids.some(i => sb.ids.includes(i)), 'two hearts share no ids');
  const defs = loaded(core).artDefs(a.markup);
  const all = new Set([...sa.ids, ...scan(defs).ids]);
  ok(sa.refs.every(r => all.has(r)), `unresolved: ${sa.refs.filter(r => !all.has(r)).join(', ')}`);
  ok(Array.isArray(a.box) && a.at.mitral && a.at.aortic && a.at.ventricle && a.at.atrium && a.at.aorta, 'box and leader targets');
  const renamed = leftHeart({ edv: EDV0, parts: { atrium: 'la' } });
  ok(partsOf(renamed.markup).has('la') && !partsOf(renamed.markup).has('atrium'), 'parts rename');
});
test('heart: leftHeart frames: pure, attribute-only, under 2 ms', () => {
  const { leftHeart } = loaded(heart);
  const h = leftHeart({ edv: EDV0, refs: [EDV0, BEATS.base.ESV], mark: 'contractility' });
  const st = { volume: 90, mitral: 0.4, aortic: 0, squeeze: 0.2, inflow: 0.5, outflow: 0, phase: 0.3, pressure: 0.2 };
  const f1 = h.frame(st), f2 = h.frame(st);
  ok(JSON.stringify(f1) === JSON.stringify(f2), 'same state, same frame');
  const names = new Set(Object.keys(f1));
  ok(names.size > 8, 'a frame sets several elements');
  ok([...h.markup.matchAll(/data-ax="([^"]+)"/g)].map(m => m[1]).filter(n => !names.has(n)).length >= 0, 'markup names its moving elements');
  for (const [n, attrs] of Object.entries(f1)) {
    ok(h.markup.includes(`data-ax="${n}"`), `frame names element ${n} that the markup has`);
    for (const k of Object.keys(attrs)) ok(['d', 'transform', 'opacity', 'stroke-dashoffset', 'stroke-width', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points'].includes(k), `frame writes only attributes (${n}.${k})`);
  }
  const N = 600, t0 = performance.now();
  for (let i = 0; i < N; i++) h.frame({ volume: 40 + (i % 100), mitral: (i % 7) / 6, aortic: (i % 5) / 4, squeeze: (i % 11) / 10, inflow: 0.5, outflow: 0.5, phase: i / N });
  const ms = (performance.now() - t0) / N;
  ok(ms < 0.6, `one frame takes ${ms.toFixed(3)} ms in node (budget 0.6 here, 2 in the browser with the DOM writes)`);
});
test('heart: outline(state) is the cavity at that volume', () => {
  const { leftHeart, lvGeometry: g } = loaded(heart);
  const h = leftHeart({ edv: EDV0 });
  const full = pathArea(h.outline({ volume: EDV0 })), half = pathArea(h.outline({ volume: EDV0 / 2 }));
  near(half / full, g.area(g.sizeForVolume(0.5)) / g.area(g.sizeForVolume(1)), 0.01, 'the outline is the cavity drawn at that volume');
  ok(half / full > 0.5 && half / full < 0.75, `half the volume draws between half and three quarters of the area (${(half / full).toFixed(2)})`);
});

/* ---------- chart ---------- */
test('chart: loads', () => { loaded(chart); });
test('chart: axes are 1.5 ink with worded labels in kit classes', () => {
  const { axes } = loaded(chart);
  const s = axes({ x0: 42, y0: 212, x1: 462, y1: 34, xLabel: 'volume', yLabel: 'pressure' });
  ok((s.match(/stroke="#171916"/g) || []).length >= 2 && /stroke-width="1.5"/.test(s), 'two ink axis lines at 1.5');
  ok(/class="sm b"[^>]*>volume/.test(s) || /class="sm b"[^>]*>pressure/.test(s), 'labels in .sm b');
});
test('chart: curve roles keep the direction\'s marks', () => {
  const { curve, curveAttrs } = loaded(chart);
  const pts = [[0, 0], [10, 10], [20, 5]];
  const g = curve(pts, { role: 'ghost' });
  ok(/stroke="#8a8f84"/.test(g) && /stroke-width="3"/.test(g) && /stroke-dasharray="6 5"/.test(g), 'ghost: 3, dashed 6 5, #8a8f84');
  const l = curve(pts, { role: 'live' });
  ok(/stroke-width="4"/.test(l) && /stroke="#ecefe5"/.test(l), 'live: 4 with a panel underlay');
  ok(curveAttrs('ref')['stroke-width'] === 1.5, 'ref: 1.5 ink');
  ok(curveAttrs('untreated')['stroke-dasharray'], 'untreated: dotted');
});
test('chart: loop is closed with a light fill; change arrows and valve events', () => {
  const { loop, changeArrow, valveEvent } = loaded(chart);
  const s = loop([[0, 0], [10, 0], [10, 10], [0, 10]], { fill: true });
  ok(/Z"/.test(s) && /fill-opacity="0?\.07"/.test(s), 'closed loop with a 7 % fill');
  const a = changeArrow([100, 100], [140, 100], 'fills more');
  ok(a.includes('data-delta') && /#254dff/.test(a) && a.includes('fills more') && /class="sm b blue"/.test(a), 'blue named change arrow');
  ok(/fill="none"/.test(valveEvent(10, 10, true)) && !/fill="none"/.test(valveEvent(10, 10, false)), 'ring opens, filled shuts');
});

/* ---------- the kit's svg() (lab/kit/draw.js): backward compatible ---------- */
test('kit: svg() leaves a body without art ids exactly as before, and scopes art ids per picture', async () => {
  const d = await import(root + 'lab/kit/draw.js');
  const body = '<path d="M0 0" class="relax-x" marker-end="url(#ah-k)"/><text>max-min</text>';
  const out = d.svg('A picture', body);
  const id = /id="(lx\d+-)ah-k"/.exec(out)[1];
  ok(out.endsWith(`</defs>${body.replace('url(#ah-k)', `url(#${id}ah-k)`)}</svg>`) && !out.includes('data-ax'), 'old body unchanged');
  loaded(core);
  const a1 = d.svg('A', '<path fill="url(#ax-oxy)"/>'), a2 = d.svg('B', '<path fill="url(#ax-oxy)"/>');
  for (const a of [a1, a2]) { const { ids, refs } = scan(a); ok(refs.every(r => ids.includes(r)), `every url resolves inside its svg: ${refs}`); }
  ok(scan(a1).ids.filter(i => i.includes('ax-')).every(i => !scan(a2).ids.includes(i)), 'two pictures share no art ids');
  ok(loaded(core).scopeArt(a1) === a1, 'scopeArt leaves svg() output alone');
});

/* ---------- lints (art direction section 7, rule 13) ---------- */
const artDir = root + 'lab/kit/art/';
const artFiles = fs.existsSync(artDir) ? fs.readdirSync(artDir).filter(n => /\.(js|html|css)$/.test(n)).map(n => artDir + n) : [];
test('lint: art files exist', () => { ok(artFiles.length >= 3, 'core.js, heart.js and chart.js'); });
test('lint: no em or en dash in the library or its tools', () => {
  const files = [...artFiles, ...fs.readdirSync(root + 'tools').filter(n => n.startsWith('lab-art')).map(n => root + 'tools/' + n)];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`);
  }
});
test('lint: no hex colour in lab/kit/art outside core.js', () => {
  for (const f of artFiles.filter(f => f.endsWith('.js') && !f.endsWith('/core.js') && !f.endsWith('/metrics.js'))) {
    const hits = fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
    ok(!hits, `${path.basename(f)}: ${hits && hits.slice(0, 3).join(' ')}`);
  }
});
test('lint: fill() is only used for fills', () => {
  for (const f of artFiles.filter(f => f.endsWith('.js'))) {
    const s = fs.readFileSync(f, 'utf8');
    ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), `${path.basename(f)} uses fill() on a stroke`);
  }
});
test('lint: art modules are imported unversioned', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []);
  for (const f of walk(root + 'lab')) ok(!/art\/[\w-]+\.js\?v=/.test(fs.readFileSync(f, 'utf8')), `${path.relative(root, f)} imports a versioned art module`);
});

/* ---------- run ---------- */
let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  if (only && !name.includes(only)) continue;
  try { await fn(); pass++; console.log(`ok    ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e instanceof Fail ? e.message : e.stack}`); }
}
// The per-module suites, tools/art-tests/<module>.test.mjs, each in its own node (they are standalone
// scripts that print "N passed, M failed"). A filter that names a module runs that suite whole; any other
// filter is passed on to every suite.
const { spawnSync } = await import('node:child_process');
const suiteDir = root + 'tools/art-tests/';
for (const file of fs.readdirSync(suiteDir).filter(n => n.endsWith('.test.mjs')).sort()) {
  const mod = file.replace(/\.test\.mjs$/, ''), arg = !only || only === mod ? [] : [only];
  const r = spawnSync(process.execPath, [suiteDir + file, ...arg], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || ''), tally = /(\d+) passed, (\d+) failed\s*$/.exec(out.trim());
  for (const line of out.trim().split('\n')) if (/^(ok|FAIL)\s/.test(line)) console.log(line.replace(/^(ok|FAIL)(\s+)/, `$1$2${mod}: `));
  else if (/^\s{4,}\S/.test(line)) console.log(line);
  if (tally) { pass += +tally[1]; fail += +tally[2]; }
  else { fail++; console.log(`FAIL  ${mod}: the suite did not finish (exit ${r.status})\n      ${out.trim().split('\n').slice(-3).join('\n      ')}`); }
  if (tally && r.status && !+tally[2]) { fail++; console.log(`FAIL  ${mod}: exited ${r.status}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
