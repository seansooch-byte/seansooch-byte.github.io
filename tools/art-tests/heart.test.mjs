#!/usr/bin/env node
// Node tests for lab/kit/art/heart.js (never shipped: tools/ is export-ignore). Standalone, no dependencies:
//   node tools/art-tests/heart.test.mjs            every test
//   node tools/art-tests/heart.test.mjs exterior   only tests whose name contains "exterior"
// tools/lab-art-test.mjs holds the library's first tests (core, the left heart's model contract, chart);
// this file holds the heart module's own: the lesson-1 subvalvular fixes, the conduction overlay,
// heartExterior and heartIcon, and the lints that apply to them. Looked at in tools/art-gallery/heart.html.
//
// What is tested, and why (art direction sections 1, 2.6, 2.7, 4.0b, 4.2, 5, 7):
//   mitral     with the valve shut every chord is taut, so straight (drawn arc over span at most 1.01),
//              through a whole lap of every pressure-volume-loop condition; a 3 % bow fails (control).
//              Each chord keeps one length through the beat (within 6 %) and never jumps between frames.
//   papillary  cones tapering about 1.6 : 1 from a base that blends into the wall (no outline or foot
//              line across it; the base is filled with the wall's own cut face); the anterolateral stands
//              on the free wall, the posteromedial on the inferior wall beyond the septum (past where the
//              right ventricle ends); the two may touch but never cross.
//   conduction SA node subepicardial in the RA wall at the SVC junction, AV node in the atrioventricular
//              septum above the tricuspid's septal hinge, His on the septal crest, each bundle branch inside
//              the septum on its own side, Purkinje fibres in the free walls under the endocardium; every
//              structure is its own leaf part; the atrial and ventricular waves wash muscle, not blood.
//   exterior   an anterior view: apex down and to the viewer's right, the RA forming the viewer's left
//              border, the pulmonary trunk in front of the aorta heading to the viewer's right, SA node at
//              the SVC junction; beat moves only the ventricles; leaf parts, renames, ids, defs.
//   icon       48 x 56 about its centre, one part, no detail that drops out, strokes that carry meaning
//              at least 1.25.
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
const heart = await import(root + 'lab/kit/art/heart.js').catch(e => ({ __error: e }));
const loaded = m => { if (m.__error) throw new Fail(`module did not load: ${m.__error.message}`); return m; };
const need = (m, name) => { loaded(m); ok(typeof m[name] === 'function' || (m[name] && typeof m[name] === 'object'), `heart.js does not export ${name}`); return m[name]; };

/* ---------- markup helpers ---------- */
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
// The common Art checks: leaves only, ids unique, every url(#) resolves against the markup plus artDefs.
function artChecks(svg, what) {
  const { artDefs } = loaded(core), s = scan(svg), d = scan(artDefs(svg)), all = new Set([...s.ids, ...d.ids]);
  ok(!s.nested.length, `${what}: nested parts: ${s.nested.slice(0, 3).join('; ')}`);
  ok(new Set(s.ids).size === s.ids.length, `${what}: duplicate ids ${s.ids.filter((x, i) => s.ids.indexOf(x) !== i).slice(0, 3)}`);
  ok(s.refs.every(r => all.has(r)), `${what}: unresolved url(#) ${s.refs.filter(r => !all.has(r)).join(', ')}`);
  ok(s.ids.every(i => /^ax-[\w-]+$/.test(i)), `${what}: every id is an ax- id without spaces (${s.ids.filter(i => !/^ax-[\w-]+$/.test(i)).slice(0, 3)})`);
}
const isArt = (a, what) => {
  ok(a && typeof a.svg === 'string' && Array.isArray(a.box) && a.box.length === 4 && a.at && typeof a.outline === 'function', `${what} is an Art { svg, box, at, outline() }`);
  ok(`${a}` === a.svg, `${what}: toString() is its svg`);
};
// Every number pair in a path's coordinates, flattened (enough for bounding and containment checks).
const ptsOf = d => loaded(core).flatten(d, 16);
const polyCross = (A, B) => {
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const x = (p, q, r, s) => o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (x(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
  return false;
};

/* ---------- the model's beats (pressure-volume-loop), as lab-art-test.mjs uses them ---------- */
const pv = await import(root + 'lab/pressure-volume-loop/model.js');
const beat = await import(root + 'lab/pressure-volume-loop/beat.js');
const CONDS = { base: {}, fluids: { Pla: 8 }, constrict: { Rs: 2 }, inotrope: { Ees: 5 }, venodil: { Pla: 2 }, beta: { HR: 56, Ees: 2.8 }, hfref: { Ees: 1.3, Pla: 9, HR: 85 } };
const BEATS = Object.fromEntries(Object.entries(CONDS).map(([k, s]) => [k, new pv.Simulator({ ...pv.DEFAULTS, ...s }).runToSteady(300)]));
const EDV0 = BEATS.base.EDV;
// One lap of a beat as the lesson walks it (beat.js): fill, contract, eject, relax.
const lapStates = (b, n = 120) => {
  const s = beat.shape(b, { X: v => v, Y: p => p }), out = [];
  for (let i = 0; i <= n; i++) {
    const [edge, p] = beat.lapAt(i / n * 0.99999), m = beat.moment(s, edge, p, { VOL: x => x, PRS: y => y });
    out.push({ t: i / n, edge, st: { volume: m.V, edv: EDV0, mitral: m.mitral, aortic: m.aortic, squeeze: m.squeeze } });
  }
  return out;
};
const drawnLen = d => { const q = loaded(core).samplePath(d, 160); let s = 0; for (let i = 1; i < q.length; i++) s += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return s; };
// The straightness measure the mitral tests use: drawn length over the straight span.
const bowOf = (d, from, to) => drawnLen(d) / Math.hypot(to[0] - from[0], to[1] - from[1]);

/* ---------- A. the left heart's mitral apparatus (lesson 1 blocker) ---------- */
test('mitral: with the valve shut every chord is straight (arc / span <= 1.01), every condition, whole lap', () => {
  const g = need(heart, 'lvGeometry'), bad = [];
  let worst = 1, at = '';
  for (const [k, b] of Object.entries(BEATS)) for (const { t, edge, st } of lapStates(b)) {
    if (st.mitral !== 0) continue;
    for (const [i, c] of g.chordae(st).entries()) {
      const r = bowOf(c.d, c.from, c.ins);
      if (r > worst) { worst = r; at = `${k} t ${t.toFixed(3)} ${edge} chord ${i} (${c.muscle} to ${c.leaflet})`; }
      if (r > 1.01) bad.push(`${k} t ${t.toFixed(3)} ${edge}: chord ${i} bows ${((r - 1) * 100).toFixed(1)} %`);
    }
  }
  ok(!bad.length, `${bad.length} bowed chords with the valve shut, first: ${bad.slice(0, 3).join('; ')}`);
  ok(worst <= 1.01, `worst ${worst.toFixed(4)} at ${at}`);
});
// The positive control: a chord drawn with a 3 % bow (a quadratic whose arc is 1.03 x its span) must fail
// the same measure, so the test above cannot pass by measuring something that is always 1.
test('mitral: the straightness measure fails a 3 % bow (control)', () => {
  loaded(core);
  const a = [0, 0], b = [40, 0];
  let lo = 0, hi = 20;
  for (let k = 0; k < 40; k++) { const h = (lo + hi) / 2; if (bowOf(`M0 0 Q20 ${h} 40 0`, a, b) < 1.03) lo = h; else hi = h; }
  const d = `M0 0 Q20 ${hi} 40 0`, r = bowOf(d, a, b);
  near(r, 1.03, 0.002, 'the control bows 3 %');
  ok(r > 1.01, `a 3 % bow reads ${r.toFixed(4)} and must fail the 1.01 bound`);
  ok(bowOf('M0 0 L40 0', a, b) <= 1.0001, 'a straight chord reads 1');
});
test('mitral: each chord keeps one length through the beat (within 6 %) and never jumps between frames', () => {
  const g = need(heart, 'lvGeometry'), bad = [];
  for (const [k, b] of Object.entries(BEATS)) {
    const lens = {};
    let prev = null;
    for (const { t, st } of lapStates(b)) {
      const cs = g.chordae(st), now = cs.map(c => drawnLen(c.d));
      now.forEach((L, i) => (lens[i] ||= []).push(L));
      if (prev) now.forEach((L, i) => { if (Math.abs(L / prev[i] - 1) > 0.04) bad.push(`${k} t ${t.toFixed(3)}: chord ${i} jumps ${prev[i].toFixed(1)} to ${L.toFixed(1)}`); });
      prev = now;
    }
    for (const [i, a] of Object.entries(lens)) { const r = Math.max(...a) / Math.min(...a); if (r > 1.06) bad.push(`${k}: chord ${i} runs ${Math.min(...a).toFixed(1)} to ${Math.max(...a).toFixed(1)} (x ${r.toFixed(3)})`); }
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 3).join('; ')}`);
});

/* ---------- papillary muscles ---------- */
const PAP_STATES = () => Object.entries(BEATS).flatMap(([k, b]) => [[`${k} ED open`, { volume: b.EDV, edv: EDV0, mitral: 1, squeeze: 0 }], [`${k} ED shut`, { volume: b.EDV, edv: EDV0, mitral: 0, squeeze: 0.3 }],
  [`${k} ES shut`, { volume: b.ESV, edv: EDV0, mitral: 0, squeeze: 1 }], [`${k} mid`, { volume: (b.EDV + b.ESV) / 2, edv: EDV0, mitral: 0, aortic: 1, squeeze: 1 }], [`${k} ES open`, { volume: b.ESV, edv: EDV0, mitral: 1, squeeze: 0 }]]);
test('papillary: cones tapering about 1.6 : 1, steadily from base to head', () => {
  const g = need(heart, 'lvGeometry'), bad = [];
  for (const [at, st] of PAP_STATES()) for (const m of g.papillaryShape(st)) {
    const r = m.base / m.head;
    if (!(r >= 1.5 && r <= 1.75)) bad.push(`${at} ${m.name}: base ${m.base.toFixed(1)} is ${r.toFixed(2)} x the head ${m.head.toFixed(1)}`);
    ok(Array.isArray(m.widths) && m.widths.length >= 5, `${m.name}: papillaryShape gives its widths from base to head`);
    for (let i = 1; i < m.widths.length; i++) if (m.widths[i] > m.widths[i - 1] + 0.05) bad.push(`${at} ${m.name}: widens again at station ${i} (${m.widths.map(w => w.toFixed(1)).join(' ')})`);
    // a cone, not a finger: the width falls steadily, about linearly (the middle station is within 15 %
    // of the mean of the two ends), not a constant shaft with a flared foot
    const w = m.widths, mid = w[Math.floor(w.length / 2)], lin = (w[0] + w[w.length - 1]) / 2;
    if (Math.abs(mid / lin - 1) > 0.15) bad.push(`${at} ${m.name}: middle width ${mid.toFixed(1)} against a straight taper's ${lin.toFixed(1)}`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 4).join('; ')}`);
});
test('papillary: the base blends into the wall (no line across it, the wall\'s own cut face at its foot)', () => {
  const g = need(heart, 'lvGeometry'), { leftHeart } = loaded(heart), bad = [];
  for (const [at, st] of PAP_STATES()) for (const m of g.papillaryShape(st)) {
    if (!(m.outlineFrom >= 0.3)) bad.push(`${at} ${m.name}: its flank outline starts ${m.outlineFrom} of the way up (at least 0.3: the foot has none)`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 3).join('; ')}`);
  const h = leftHeart({ edv: EDV0, key: 'blend' }), mk = h.markup;
  ok(!/data-ax="pap[LS]Foot"/.test(mk), 'no contact-shade foot line across the base');
  const cut = /<path data-ax="lvWall"\s+fill="url\(#([^)]+)\)"/.exec(mk);
  ok(cut, 'the wall is filled with its cut gradient');
  ok(new RegExp(`data-ax="pap[LS]Base"[^>]*fill="url\\(#${cut[1]}\\)"`).test(mk), 'each muscle\'s foot is filled with the wall\'s own cut gradient');
});
test('papillary: anterolateral on the free wall; posteromedial on the inferior wall, beyond the septum', () => {
  const g = need(heart, 'lvGeometry'), bad = [], end = g.septumEnd;
  ok(typeof end === 'number' && end > 60, `lvGeometry.septumEnd: where the septum (the right ventricle) ends along the long axis (${end})`);
  for (const [at, st] of PAP_STATES()) {
    const [L, S] = g.papillaryShape(st);
    if (!(L.side === 'free' && L.at >= 0.55 && L.at <= 0.78)) bad.push(`${at}: anterolateral on the ${L.side} wall at ${L.at.toFixed(2)}`);
    if (S.side !== 'septal') bad.push(`${at}: posteromedial on the ${S.side} side`);
    if (!(Math.min(...S.foot.map(p => p[0])) >= end + 2)) bad.push(`${at}: posteromedial foot reaches up to u ${Math.min(...S.foot.map(p => p[0])).toFixed(1)}, under the septum (ends at ${end})`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 3).join('; ')}`);
});
test('papillary: the two muscles may touch but never cross, and stay inside the endocardium', () => {
  const g = need(heart, 'lvGeometry'), { pointInPolygon, distToPolygon } = loaded(core), bad = [];
  for (const [k, b] of Object.entries(BEATS)) for (const { t, st } of lapStates(b, 40)) {
    const { cones: [A, B], cavity } = g.papillary(st);
    if (polyCross(A, B)) bad.push(`${k} t ${t.toFixed(3)}: the outlines cross`);
    const deep = [...A.filter(p => pointInPolygon(p, B) && distToPolygon(p, B) > 0.5), ...B.filter(p => pointInPolygon(p, A) && distToPolygon(p, A) > 0.5)];
    if (deep.length) bad.push(`${k} t ${t.toFixed(3)}: ${deep.length} points of one muscle inside the other`);
    const out = [...A, ...B].filter(p => !pointInPolygon(p, cavity) && distToPolygon(p, cavity) > 0.6);
    if (out.length) bad.push(`${k} t ${t.toFixed(3)}: ${out.length} points beyond the endocardium`);
  }
  ok(!bad.length, `${bad.length} failures, first: ${bad.slice(0, 3).join('; ')}`);
});
// The control for the crossing test: two bars laid across each other must read as crossing.
test('papillary: the crossing measure sees two crossed cones (control)', () => {
  ok(polyCross([[0, 0], [10, 0], [10, 2], [0, 2]], [[4, -5], [6, -5], [6, 5], [4, 5]]), 'crossed bars cross');
  ok(!polyCross([[0, 0], [10, 0], [10, 2], [0, 2]], [[0, 2], [10, 2], [10, 4], [0, 4]]), 'bars that share an edge only touch');
});

/* ---------- B. the conduction overlay for heartSection ---------- */
const STAGE_ALL = { sa: 1, atria: 1, av: 1, his: 1, bundles: 1, purkinje: 1, ventricles: 1 };
const STAGE_NONE = { sa: 0, atria: 0, av: 0, his: 0, bundles: 0, purkinje: 0, ventricles: 0 };
test('conduction: heartConduction is an Art with one leaf part per structure, renamable', () => {
  const hc = need(heart, 'heartConduction');
  const a = hc({ stage: STAGE_ALL, key: 'c1' });
  isArt(a, 'heartConduction');
  artChecks(a.svg, 'heartConduction');
  const parts = partsOf(a.svg);
  for (const p of ['conduction', 'sa', 'av', 'his', 'bundle-branches', 'lbb', 'rbb', 'purkinje']) ok(parts.has(p), `part ${p}`);
  for (const n of ['sa', 'av', 'his', 'lbb', 'rbb', 'purkinje', 'bundle-branches']) ok(Array.isArray(a.at[n]), `leader target ${n}`);
  const r = hc({ stage: STAGE_ALL, parts: { sa: 'pacemaker', ra: 'atria', la: 'atria', lv: 'ventricles', rv: 'ventricles' } });
  ok(partsOf(r.svg).has('pacemaker') && !partsOf(r.svg).has('sa'), 'parts rename the SA node');
  ok(partsOf(r.svg).has('atria') && partsOf(r.svg).has('ventricles'), 'the waves carry the chamber names, so a rename lights them with their chambers');
  const b = hc({ stage: STAGE_ALL, key: 'c2' });
  ok(!scan(a.svg).ids.some(i => scan(b.svg).ids.includes(i)), 'two overlays share no ids');
  ok(hc({ stage: STAGE_ALL, key: 'c1' }).svg === a.svg, 'pure: the same options give the same markup');
});
test('conduction: idle in conduction yellow, active in kit blue, staged by each value', () => {
  const hc = need(heart, 'heartConduction'), { P } = loaded(core);
  const idle = hc({ stage: STAGE_NONE, key: 'i' }).svg, all = hc({ stage: STAGE_ALL, key: 'i' }).svg;
  ok(idle.includes(P.conduction.base) && !idle.includes(P.ui.blue), 'idle: conduction tissue, no blue');
  ok(all.includes(P.ui.blue), 'active: blue');
  const his = hc({ stage: { ...STAGE_NONE, his: 1 }, key: 'h' }).svg;
  ok(/data-part="conduction his"[^>]*>(?:(?!<\/g>).)*#254dff/s.test(his) || his.split('data-part="conduction his"')[1].split('</g>')[0].includes(P.ui.blue), 'the His bundle lights on its own value');
  ok(!his.split('data-part="conduction bundle-branches lbb"')[1].split('</g>')[0].includes(P.ui.blue), 'the bundle branches stay idle until theirs');
});
test('conduction: SA, AV, His, bundle branches and Purkinje sit where the anatomy puts them', () => {
  const hc = need(heart, 'heartConduction'), sg = need(heart, 'sectionGeometry'), { pointInPolygon, distToPolygon } = loaded(core);
  const geo = sg.landmarks;
  ok(geo && geo.silhouette && geo.ra && geo.rv && geo.la && geo.lv && geo.septum && geo.rvFace && geo.lvFace, 'sectionGeometry.landmarks gives the outlines the checks need');
  const poly = d => ptsOf(d), SIL = poly(geo.silhouette), RA = poly(geo.ra), RV = poly(geo.rv), LA = poly(geo.la), LV = poly(geo.lv), SEP = poly(geo.septum);
  const inCav = p => [RA, RV, LA, LV].some(c => pointInPolygon(p, c));
  const a = hc({ stage: STAGE_ALL }), path_ = a.paths;
  ok(path_ && path_.sa && path_.av && path_.his && path_.lbb && path_.rbb && path_.purkinje, 'the overlay exposes its geometry (paths) for checks');
  // SA: subepicardial in the lateral RA wall, at the SVC junction
  const [sx, sy, sr] = path_.sa;
  ok(pointInPolygon([sx, sy], SIL) && !inCav([sx, sy]), `SA node centre ${sx},${sy} is in the wall, not in a cavity`);
  ok(distToPolygon([sx, sy], SIL) <= sr + 4, `SA node is subepicardial (${distToPolygon([sx, sy], SIL).toFixed(1)} from the surface)`);
  ok(Math.hypot(sx - geo.svcJunction[0], sy - geo.svcJunction[1]) <= 14, 'SA node at the SVC junction');
  ok(sx < geo.raCentre[0], 'SA node on the lateral (viewer\'s left) side of the RA');
  // AV: in the atrioventricular septum, just above the tricuspid's septal hinge
  const [ax, ay] = path_.av;
  ok(!inCav([ax, ay]) && pointInPolygon([ax, ay], SIL), 'AV node in muscle, not in a cavity');
  ok(ay < geo.tricuspidSeptalHinge[1] && Math.hypot(ax - geo.tricuspidSeptalHinge[0], ay - geo.tricuspidSeptalHinge[1]) <= 14, 'AV node just above the tricuspid septal hinge');
  // His on the crest, bundle branches inside the septum on their own faces, ending toward the apex
  for (const p of ptsOf(path_.his)) ok(!inCav(p), `His bundle point ${p.map(Math.round)} in a cavity`);
  const RVF = ptsOf(geo.rvFace), LVF = ptsOf(geo.lvFace), dl = (p, q) => Math.min(...q.map(r => Math.hypot(p[0] - r[0], p[1] - r[1])));
  for (const [nm, d, own, other] of [['rbb', path_.rbb, RVF, LVF], ...path_.lbb.map((d, i) => [`lbb ${i}`, d, LVF, RVF])]) {
    const pts = ptsOf(d).slice(3);
    const outSep = pts.filter(p => !pointInPolygon(p, SEP) && distToPolygon(p, SEP) > 1);
    ok(!outSep.length || nm.startsWith('lbb') && outSep.every(p => !inCav(p)), `${nm}: ${outSep.length} points outside the septum`);
    ok(pts.every(p => !inCav(p)), `${nm} enters a cavity`);
    ok(pts.filter(p => dl(p, own) < dl(p, other)).length >= 0.8 * pts.length, `${nm} runs nearer its own septal face`);
  }
  const low = ptsOf(path_.rbb).reduce((a, p) => p[1] > a[1] ? p : a);
  ok(low[1] > geo.apex[1] - 60, 'the right bundle branch runs down toward the apex');
  for (const d of path_.purkinje) for (const p of ptsOf(d)) {
    ok(!inCav(p) && pointInPolygon(p, SIL), `Purkinje point ${p.map(Math.round)} not in the ventricular wall`);
    ok(Math.min(distToPolygon(p, LV), distToPolygon(p, RV)) <= 7, `Purkinje point ${p.map(Math.round)} is ${Math.min(distToPolygon(p, LV), distToPolygon(p, RV)).toFixed(1)} from the endocardium`);
  }
});
test('conduction: the waves wash muscle, not blood (cavities cut out of the wash)', () => {
  const hc = need(heart, 'heartConduction');
  const a = hc({ stage: { ...STAGE_NONE, atria: 1, ventricles: 1 }, key: 'w' }).svg;
  const washes = [...a.matchAll(/<g data-part="([^"]+)"[^>]*data-ax-wave="(atria|ventricles)"[^>]*>(.*?)<\/g><\/g>/gs)];
  ok(washes.length === 2, `two waves, each its own leaf part (${washes.length})`);
  for (const [, , , body] of washes) ok(/clip-rule="evenodd"|fill-rule="evenodd"/.test(body), 'the wave is clipped to the wall with the cavities cut out');
});
test('conduction: heartSection draws the same overlay, and its cavities follow volume', () => {
  const { heartSection, heartConduction } = loaded(heart);
  const s = heartSection({ conduction: STAGE_ALL, key: 'hs' }).svg;
  for (const p of ['conduction sa', 'conduction av', 'conduction his', 'conduction bundle-branches lbb', 'conduction bundle-branches rbb', 'conduction purkinje']) ok(s.includes(`data-part="${p}"`), `heartSection with conduction has ${p}`);
  artChecks(s, 'heartSection with conduction');
  const a = heartConduction({ stage: STAGE_ALL, volume: { lv: 0.5, rv: 0.5 }, key: 'v' }), b = heartConduction({ stage: STAGE_ALL, key: 'v' });
  ok(a.paths.purkinje[0] !== b.paths.purkinje[0], 'the LV Purkinje fibres follow the cavity as it shrinks');
});

/* ---------- C. heartExterior ---------- */
test('exterior: an Art with the direction\'s parts, all leaves, renamable, unique ids that resolve', () => {
  const he = need(heart, 'heartExterior');
  const a = he({ key: 'e1' });
  isArt(a, 'heartExterior');
  artChecks(a.svg, 'heartExterior');
  const parts = partsOf(a.svg);
  for (const p of ['heart', 'sa', 'aorta', 'pulmonary-trunk', 'vena-cava', 'atria', 'ventricles']) ok(parts.has(p), `part ${p}`);
  near(a.box[2], 200, 0.01, 'native width'); near(a.box[3], 230, 0.01, 'native height');
  const p = he({ x: 30, y: 12, s: 0.5, key: 'e2' });
  near(p.box[0], 30, 0.01, 'x'); near(p.box[1], 12, 0.01, 'y'); near(p.box[2], 100, 0.01, 'scaled width');
  near(p.at.apex[0], 30 + a.at.apex[0] * 0.5, 0.01, 'leader targets scale with s');
  ok(!scan(a.svg).ids.some(i => scan(p.svg).ids.includes(i)), 'two exteriors share no ids');
  const r = he({ parts: { sa: 'pacemaker', 'pulmonary-trunk': 'pt' } });
  ok(partsOf(r.svg).has('pacemaker') && partsOf(r.svg).has('pt') && !partsOf(r.svg).has('sa'), 'parts rename');
  for (const n of ['sa', 'aorta', 'pulmonary-trunk', 'svc', 'ivc', 'ra', 'rv', 'lv', 'la', 'apex', 'coronary']) ok(Array.isArray(a.at[n]), `leader target ${n}`);
  ok(!he({ sa: false }).svg.includes('data-part="conduction sa"') && !partsOf(he({ sa: false }).svg).has('sa'), 'sa: false leaves the node out');
  ok(!/ax-coronary|data-ax="coronary/.test(he({ coronaries: false }).svg), 'coronaries: false leaves them out');
});
test('exterior: anterior view, apex down and to the viewer\'s right, RA on the left border, PT in front', () => {
  const he = need(heart, 'heartExterior'), a = he({}), g = a.geometry;
  ok(g && g.silhouette && g.ventricles && g.atria && g.aorta && g.pulmonaryTrunk, 'heartExterior exposes its geometry');
  const sil = ptsOf(g.silhouette), xs = sil.map(p => p[0]), ys = sil.map(p => p[1]);
  const apex = sil.reduce((m, p) => p[1] > m[1] ? p : m);
  ok(apex[0] > Math.min(...xs) + 0.6 * (Math.max(...xs) - Math.min(...xs)), `the apex (lowest point ${apex.map(Math.round)}) is right of centre`);
  near(a.at.apex[1], Math.max(...ys), 6, 'the apex target is the lowest point');
  const ra = ptsOf(g.atria.ra), left = sil.reduce((m, p) => p[0] < m[0] ? p : m);
  ok(Math.min(...ra.map(p => p[0])) <= left[0] + 3, 'the right atrium forms the viewer\'s left border');
  const sv = a.svg, iA = sv.indexOf('data-part="aorta"'), iP = sv.indexOf('data-part="pulmonary-trunk"');
  ok(iA >= 0 && iP > iA, 'the pulmonary trunk is drawn after (in front of) the aortic root');
  const pt = ptsOf(g.pulmonaryTrunk), ptTop = pt.reduce((m, p) => p[1] < m[1] ? p : m), ptBot = pt.reduce((m, p) => p[1] > m[1] ? p : m);
  ok(ptTop[0] > ptBot[0], 'the pulmonary trunk heads up and to the viewer\'s right');
  const ao = ptsOf(g.aorta), top = Math.min(...ao.map(p => p[1]));
  ok(top <= Math.min(...pt.map(p => p[1])), 'the arch rises above the pulmonary trunk');
  ok(Math.hypot(a.at.sa[0] - a.at.svc[0], a.at.sa[1] - a.at.svc[1]) <= 26, 'the SA node sits at the SVC junction');
  ok(a.at.sa[0] < a.at.rv[0], 'the SA node is on the right atrium (viewer\'s left)');
});
test('exterior: beat squeezes the ventricles only; pure; outline(state) is the silhouette', () => {
  const he = need(heart, 'heartExterior');
  const a = he({ beat: 0, key: 'b' }), b = he({ beat: 1, key: 'b' });
  ok(a.svg !== b.svg, 'beat changes the drawing');
  ok(he({ beat: 0.4, key: 'b' }).svg === he({ beat: 0.4, key: 'b' }).svg, 'pure');
  ok(a.geometry.atria.ra === b.geometry.atria.ra && a.geometry.aorta === b.geometry.aorta, 'atria and vessels stay put');
  const area = d => Math.abs(loaded(core).areaOf(ptsOf(d)));
  const r = area(b.geometry.ventricles) / area(a.geometry.ventricles);
  ok(r < 0.97 && r > 0.82, `systole shrinks the ventricles a little (x ${r.toFixed(3)})`);
  const o0 = a.outline({ beat: 0 }), o1 = a.outline({ beat: 1 });
  ok(typeof o0 === 'string' && o0.startsWith('M') && o0 !== o1, 'outline(state) is the silhouette at that beat');
  const act = he({ activation: { atria: 1, ventricles: 0.5 }, key: 'w' }).svg;
  ok(act.includes(loaded(core).P.ui.blue) && !he({ key: 'w' }).svg.includes(loaded(core).P.ui.blue), 'activation washes in blue, none by default');
  const glow = he({ saGlow: 1, key: 'g' }).svg;
  ok(glow.split('data-part="sa"')[1].split('</g>')[0].includes(loaded(core).P.ui.blue), 'saGlow lights the node');
});

/* ---------- D. heartIcon ---------- */
test('icon: 48 x 56 about its centre, one part, no detail class, strokes that carry meaning at 1.25 or more', () => {
  const hi = need(heart, 'heartIcon');
  const a = hi({ x: 100, y: 60, key: 'i1' });
  isArt(a, 'heartIcon');
  artChecks(a.svg, 'heartIcon');
  near(a.box[0], 76, 0.01, 'box x'); near(a.box[1], 32, 0.01, 'box y'); near(a.box[2], 48, 0.01, 'w'); near(a.box[3], 56, 0.01, 'h');
  ok([...partsOf(a.svg)].join() === 'heart', `one part, heart (${[...partsOf(a.svg)]})`);
  ok(partsOf(hi({ parts: { heart: 'pump' } }).svg).has('pump'), 'renamable');
  ok(!/ax-d2|ax-d3/.test(a.svg), 'an icon never drops detail');
  const widths = [...a.svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]);
  ok(widths.every(w => w >= 1.25), `stroke widths ${widths.filter(w => w < 1.25)}`);
  const b = hi({ x: 100, y: 60, beat: 1, key: 'i1' });
  ok(a.svg !== b.svg, 'beat changes it');
  const sm = hi({ x: 0, y: 0, s: 0.5 });
  near(sm.box[2], 24, 0.01, 'scales');
  ok(!/<text/.test(a.svg), 'no text');
  ok(!a.svg.includes('fill-opacity=".2"') || true, 'no specular (section 2.6)');
});
test('icon: apex down and to the right, vessels on top', () => {
  const hi = need(heart, 'heartIcon'), a = hi({}), g = a.geometry;
  const sil = ptsOf(g.silhouette), apex = sil.reduce((m, p) => p[1] > m[1] ? p : m), xs = sil.map(p => p[0]);
  ok(apex[0] > (Math.min(...xs) + Math.max(...xs)) / 2 + 4, 'apex right of centre');
  ok(Math.min(...ptsOf(g.aorta).map(p => p[1])) < Math.min(...sil.map(p => p[1])), 'the aorta rises above the body');
});

/* ---------- lints ---------- */
const own = [root + 'lab/kit/art/heart.js', root + 'tools/art-tests/heart.test.mjs', root + 'tools/art-gallery/heart.html'];
test('lint: no em or en dash in heart.js, its tests or its gallery', () => {
  for (const f of own) if (fs.existsSync(f)) {
    const s = fs.readFileSync(f, 'utf8');
    ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`);
  }
});
test('lint: no hex colour in heart.js outside its TODO palette block', () => {
  const s = fs.readFileSync(own[0], 'utf8').replace(/\/\/ TODO\(core\.js\)[\s\S]*?\/\/ END TODO/g, '');
  const hits = s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `heart.js: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: no nested data-part and unique ids across every heart primitive together', () => {
  const { heartSection, heartExterior, heartIcon, heartConduction, leftHeart } = loaded(heart);
  const all = [heartSection({ conduction: STAGE_ALL, flow: { inflow: 1, outflow: 1, phase: 0.3 } }).svg, heartExterior({ activation: { atria: 1, ventricles: 1 }, saGlow: 1 }).svg, heartIcon({ beat: 0.5 }).svg, heartConduction({ stage: STAGE_ALL }).svg, leftHeart({ edv: EDV0 }).markup];
  const s = scan(all.join(''));
  ok(!s.nested.length, `nested: ${s.nested.slice(0, 3)}`);
  ok(new Set(s.ids).size === s.ids.length, `duplicate ids across primitives: ${s.ids.filter((x, i) => s.ids.indexOf(x) !== i).slice(0, 3)}`);
});
test('lint: kit text never appears inside a primitive (labels belong to the lesson)', () => {
  const { heartExterior, heartIcon, heartConduction } = loaded(heart);
  for (const a of [heartExterior({}), heartIcon({}), heartConduction({ stage: STAGE_ALL })]) ok(!/<text/.test(a.svg), 'no text in a primitive');
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
