#!/usr/bin/env node
// Node tests for lab/pressure-volume-loop/beat.js (never shipped: tools/ is export-ignore).
//   /usr/local/bin/node tools/pv-beat-test.mjs
// beat.js is the part of lesson 1's pictures that is pure arithmetic: where a moment sits on the lap,
// what the valves are doing then, which phase word the readout shows, the state the left-heart art is
// set to, and a spot test that keeps graph words clear of the loops. What is tested, and why:
//   lap      the lap's four phases run in order and cover the whole of [0, 1).
//   phase    the phase word always agrees with the valve pills and the leaflets: "Filling" only while
//            the mitral valve shows open, "Ejection" only while the aortic valve shows open, never
//            "Filling" with the mitral pill on shut (the audit's lap-boundary contradiction).
//   heart    the state passed to the left heart carries the moment's volume and valve values, a
//            pressure fraction for its data-pressure hook, and a flow phase that loops.
//   spots    pickSpot returns the first word box clear of every line it is given by the margin, and
//            reports when nothing fits.
import { Simulator, DEFAULTS } from '../lab/pressure-volume-loop/model.js';

const root = new URL('..', import.meta.url).pathname;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const beat = await import(root + 'lab/pressure-volume-loop/beat.js').catch(e => ({ __error: e }));
const loaded = () => { if (beat.__error) throw new Fail(`beat.js did not load: ${beat.__error.message}`); return beat; };

// A loop in the lesson's own form: four edges of points, from a real model beat.
function loopOf() {
  const { shape } = loaded();
  const b = new Simulator({ ...DEFAULTS }).runToSteady(300);
  const scale = { X: v => 42 + v / 200 * 420, Y: p => 200 - p / 170 * 166 };
  return { b, s: shape(b, scale), scale };
}

test('lap: the four phases run in order and cover [0, 1)', () => {
  const { lapAt } = loaded();
  const seen = [];
  for (let i = 0; i < 1000; i++) { const [edge, p] = lapAt(i / 1000); ok(p >= 0 && p <= 1, `p out of range at ${i}`); if (seen[seen.length - 1] !== edge) seen.push(edge); }
  ok(seen.join(' ') === 'fill contract eject relax', `order was ${seen.join(' ')}`);
  ok(lapAt(0.3, 'contract')[0] === 'eject', 'a lap starting at contract reaches eject by its middle');
});

test('phase: the word follows the valves at every moment of the lap', () => {
  const { lapAt, moment, phaseOf } = loaded();
  const { s, scale } = loopOf();
  const conv = { VOL: x => x, PRS: y => y };
  for (let i = 0; i <= 2000; i++) {
    const m = moment(s, ...lapAt(i / 2000), conv), ph = phaseOf(m);
    ok((ph === 'fill') === (m.mitral > 0.5), `at ${i / 2000}: word ${ph} with mitral ${m.mitral}`);
    ok((ph === 'eject') === (m.aortic > 0.5), `at ${i / 2000}: word ${ph} with aortic ${m.aortic}`);
    ok(m.mitral <= 0.5 || m.aortic <= 0.5, `at ${i / 2000}: both valves open`);
  }
  void scale;
});

test('phase: the lap boundary (t = 1, the start of filling) never says Filling with the mitral shut', () => {
  const { lapAt, moment, phaseOf } = loaded();
  const { s } = loopOf();
  const m = moment(s, ...lapAt(1), { VOL: x => x, PRS: y => y });
  ok(!(phaseOf(m) === 'fill' && m.mitral <= 0.5), `word ${phaseOf(m)}, mitral ${m.mitral}`);
});

test('phase: at each corner, approached from both sides, the word names the both-shut phase there', () => {
  // Once the mitral valve shuts at the end of filling the ventricle is squeezing (isovolumic
  // contraction); once the aortic valve shuts at the end of ejection it is relaxing (isovolumic
  // relaxation). At the opening end of an edge the word is still the phase before it.
  const { moment, phaseOf } = loaded();
  const { s } = loopOf();
  const conv = { VOL: x => x, PRS: y => y }, say = (edge, p) => phaseOf(moment(s, edge, p, conv));
  const cases = [
    ['bottom right, end of filling', 'fill', 0.999, 'contract'], ['bottom right, start of the squeeze', 'contract', 0, 'contract'],
    ['top right, end of the squeeze', 'contract', 1, 'contract'], ['top right, start of ejection', 'eject', 0.001, 'contract'],
    ['top left, end of ejection', 'eject', 0.999, 'relax'], ['top left, start of relaxing', 'relax', 0, 'relax'],
    ['bottom left, end of relaxing', 'relax', 1, 'relax'], ['bottom left, start of filling', 'fill', 0.001, 'relax'],
    ['end of filling, held', 'fill', 1, 'contract'], ['end of ejection, held', 'eject', 1, 'relax'],
  ];
  for (const [where, edge, p, want] of cases) ok(say(edge, p) === want, `${where} (${edge} p ${p}): said ${say(edge, p)}, want ${want}`);
});

// The readout's key "darker wall: squeezing" is lit for Squeeze and Ejection, so the picture must be
// squeezing whenever the word says so, and the squeeze must not jump anywhere round the lap.
test('phase: the wall is squeezing whenever the word says Squeeze or Ejection, and the squeeze is continuous', () => {
  const { moment, phaseOf, lapAt } = loaded();
  const { s } = loopOf();
  const conv = { VOL: x => x, PRS: y => y };
  let prev = null;
  for (let i = 0; i <= 2000; i++) {
    const [edge, p] = lapAt(i / 2000), m = moment(s, edge, p, conv), ph = phaseOf(m);
    if (ph === 'contract' || ph === 'eject') ok(m.squeeze > 0.02, `${edge} p ${p.toFixed(3)}: says ${ph} but squeeze is ${m.squeeze}`);
    if (ph === 'fill') ok(m.squeeze === 0, `${edge} p ${p.toFixed(3)}: says Filling but squeeze is ${m.squeeze}`);
    if (prev != null) ok(Math.abs(m.squeeze - prev) < 0.05, `squeeze jumps from ${prev.toFixed(3)} to ${m.squeeze.toFixed(3)} at ${edge} p ${p.toFixed(3)}`);
    prev = m.squeeze;
  }
});

test('heart: a change step keeps the emptied outline until the cavity has refilled partway', () => {
  const { heartState } = loaded();
  const o = { lapMs: 5600, pMax: 120, refMid: 85 };
  ok(heartState({ V: 60, P: 5, edge: 'fill' }, 0, o).ref === 1, 'early filling, below the normal mid volume: the emptied outline');
  ok(heartState({ V: 110, P: 5, edge: 'fill' }, 0, o).ref === 0, 'late filling, above it: the full outline');
  ok(heartState({ V: 60, P: 5, edge: 'fill' }, 0, { lapMs: 5600, pMax: 120 }).ref === 0, 'without refMid, filling shows the full outline as before');
});

test('valves: both valves are shut for the whole of each same-volume edge, and shut at their closing corners', () => {
  const { moment } = loaded();
  const { s } = loopOf();
  const conv = { VOL: x => x, PRS: y => y };
  for (const edge of ['contract', 'relax']) for (let i = 0; i <= 200; i++) {
    const m = moment(s, edge, i / 200, conv);
    ok(m.mitral === 0 && m.aortic === 0, `${edge} at p ${i / 200}: mitral ${m.mitral}, aortic ${m.aortic}`);
  }
  ok(moment(s, 'fill', 1, conv).mitral === 0, 'the mitral valve is shut at the end of filling (the bottom right corner)');
  ok(moment(s, 'eject', 1, conv).aortic === 0, 'the aortic valve is shut at the end of ejection (the top left corner)');
  ok(moment(s, 'fill', 0.5, conv).mitral === 1 && moment(s, 'eject', 0.5, conv).aortic === 1, 'each valve is fully open mid-edge');
  // the closing swing happens in the last part of the edge, as the flow fades
  const late = moment(s, 'fill', 0.96, conv);
  ok(late.mitral > 0 && late.mitral < 1, `the mitral valve is part-way through closing at fill p 0.96 (${late.mitral})`);
});

test('heart: the art state carries volume, valves, a pressure fraction and a looping flow phase', () => {
  const { heartState } = loaded();
  const m = { V: 100, P: 60, mitral: 0.2, aortic: 0.9, squeeze: 1, inflow: 0, outflow: 0.7 };
  const a = heartState(m, 2800, { lapMs: 5600, pMax: 120 }), b = heartState(m, 2800 + 5600, { lapMs: 5600, pMax: 120 });
  ok(a.volume === 100 && a.mitral === 0.2 && a.aortic === 0.9 && a.squeeze === 1 && a.outflow === 0.7 && a.inflow === 0, 'fields copied');
  ok(Math.abs(a.pressure - 0.5) < 1e-9, `pressure fraction ${a.pressure}`);
  ok(a.phase >= 0 && a.phase < 1 && Math.abs(a.phase - b.phase) < 1e-9, `flow phase ${a.phase} / ${b.phase} must loop with the lap`);
  ok(heartState({ ...m, P: 500 }, 0, { lapMs: 5600, pMax: 120 }).pressure === 1, 'pressure fraction is clamped to 1');
  // a change step keeps one normal outline on the heart: the full size while it fills and squeezes,
  // the emptied size while it ejects and relaxes
  for (const [edge, ref] of [['fill', 0], ['contract', 0], ['eject', 1], ['relax', 1]]) ok(heartState({ ...m, edge }, 0, { lapMs: 5600, pMax: 120 }).ref === ref, `${edge}: outline ${ref}`);
});

test('spots: the first clear word box wins; a box touching a line by less than the margin is refused', () => {
  const { pickSpot } = loaded();
  const line = [[0, 100], [200, 100]];
  const spots = [{ x: 50, y: 92, w: 60, h: 18 }, { x: 50, y: 60, w: 60, h: 18 }, { x: 50, y: 140, w: 60, h: 18 }];
  ok(pickSpot(spots, { lines: [line], margin: 4 }) === spots[1], 'a box crossing the line is skipped; the next clear one is taken');
  ok(pickSpot([{ x: 50, y: 79, w: 60, h: 18 }], { lines: [line], margin: 4 }) === null, 'a box 3 units from the line is not clear at margin 4');
  ok(pickSpot([{ x: 50, y: 70, w: 60, h: 18 }], { lines: [line], boxes: [[40, 60, 20, 20]], margin: 4 }) === null, 'boxes are obstacles too');
  ok(pickSpot([{ x: 5, y: 10, w: 60, h: 18 }], { lines: [], bounds: [8, 0, 472, 418] }) === null, 'a box outside the picture is refused');
});

test('spots: a loop drawn from the model is an obstacle along every edge', () => {
  const { pickSpot, loopPoints } = loaded();
  const { s } = loopOf();
  const pts = loopPoints(s), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2, left = Math.min(...xs);
  ok(pickSpot([{ x: left - 20, y: midY - 9, w: 40, h: 18 }], { lines: [pts], margin: 4 }) === null, 'a word over the left edge is refused');
  ok(pickSpot([{ x: left + 12, y: midY - 9, w: 40, h: 18 }], { lines: [pts], margin: 4 }) !== null, 'a word just inside the left edge is clear');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e instanceof Fail ? e.message : e.stack}`); }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
