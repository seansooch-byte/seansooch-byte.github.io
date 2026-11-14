#!/usr/bin/env node
// Node tests for lab/kit/art/cell.js (never shipped: tools/ is export-ignore).
//   node tools/art-tests/cell.test.mjs            every test
//   node tools/art-tests/cell.test.mjs channel    only tests whose name contains "channel"
// No dependencies; same style as tools/lab-art-test.mjs. Written before cell.js existed and run failing.
//
// What is tested, and why (art direction sections 1, 2.4, 2.5, 2.7, 4.0b, 4.5, 5 and 7):
//   every primitive  an Art (svg, box, at, outline, toString); leaf-only data-parts that a lesson can
//                    rename; x, y, s, rot, flip placement; unique per-instance ids, stable keyed ids;
//                    every url(#) resolves; no <text>; pure for a given key; weight strokes at least 0.9
//                    on screen; outline(state) keeps one command structure so the ghost can morph.
//   bilayer          heads and tails are detail (ax-d2) over a core band that always shows; snipped
//                    lipids lose a tail; one head pair per gap along any path.
//   gpcr             seven helices, ECL and ICL loops, a G protein trimer (alpha, beta, gamma) that the
//                    alpha subunit leaves as gprotein goes to 1; an antagonist is a drug, never a messenger.
//   channel          the true assembly per kind (Nav, Cav one chain of four domains; Kv, Kir four
//                    subunits; ENaC three; K-ATP four Kir6.2 and four SUR1; ligand-gated a pentamer);
//                    the gate widens with open; Nav inactivates with a hinged lid, Kv with a ball and
//                    chain; a K-ATP drug binds SUR1, outside the pore.
//   transporter      alternating access by phase; symporter cargo one way, antiporter and pump both ways;
//                    a P-type pump has its beta subunit when asked; seamless in phase.
//   vesicle          an omega pore that widens with fuse and releases its cargo outward.
//   cellBody         every shape draws, with the nucleus as its own leaf part.
//   nucleus          a double envelope with pores; condensed chromosomes only replace the nucleolus;
//                    breakdown removes the envelope.
//   epithelium       n polarised cells, apical slots above basal slots, tight junctions between cells,
//                    a basement membrane.
//   enzyme           a cleft, a zymogen propeptide, plugs of three kinds, membrane and tethered anchors.
//   nuclearReceptor  a ligand that docks with bound; DNA only in the nucleus.
//   lints            no nested data-part, no em or en dash, no hex outside the TODO block, fill() only in
//                    fills, unversioned imports.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const only = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };

const core = await import(root + 'lab/kit/art/core.js');
const C = await import(root + 'lab/kit/art/cell.js').catch(e => ({ __error: e }));
const loaded = () => { if (C.__error) throw new Fail(`module did not load: ${C.__error.message}`); return C; };
const { P } = core;

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
const unresolved = markup => { const { ids, refs } = scan(markup); const shared = core.artDefs(markup); return refs.filter(r => !ids.includes(r) && !shared.includes(`id="${r}"`)); };
const isArt = a => a && typeof a.svg === 'string' && `${a}` === a.svg && Array.isArray(a.box) && a.box.length === 4 && a.box.every(Number.isFinite) && typeof a.at === 'object' && typeof a.outline === 'function';
const count = (svg, re) => (svg.match(re) || []).length;

// One call per primitive in a few states; every generic test runs over all of them.
const NAMES = ['bilayer', 'membraneBand', 'gpcr', 'channel', 'transporter', 'vesicle', 'cellBody', 'nucleus', 'epithelium', 'enzyme', 'nuclearReceptor'];
const SAMPLES = () => {
  const c = loaded();
  return {
    bilayer: [{ x1: 0, y1: 0, x2: 200, y2: 0 }, { d: 'M0 0 C60 -30 140 30 200 0', snipped: [3], highlight: [0.2, 0.5] }],
    membraneBand: [{ d: 'M0 0 L200 0' }, { d: 'M0 0 C60 -30 140 30 200 0', w: 6 }],
    gpcr: [{}, { ligand: 'agonist', bound: 1, gprotein: 1 }, { ligand: 'antagonist', bound: 1, gprotein: 0 }, { gprotein: null }],
    channel: ['nav', 'cav', 'kv', 'kir', 'katp', 'enac', 'cl', 'lgic', 'generic'].flatMap(kind => [{ kind }, { kind, open: 1, ion: 'na', inactivated: 0.6, plug: 1, bound: 1 }]),
    transporter: ['uniporter', 'symporter', 'antiporter', 'pump', 'reuptake'].flatMap(kind => [{ kind, cargo: ['na', 'glucose'] }, { kind, phase: 0.6, cargo: ['na', 'k'], beta: true, atp: true, blocked: 1 }]),
    vesicle: [{ r: 12, cargo: 'ach', n: 5 }, { r: 12, cargo: 'ach', n: 5, fuse: 0.5, proteins: ['generic'] }, { r: 12, fuse: 1 }],
    cellBody: ['round', 'cuboidal', 'columnar', 'polygon', 'pyramidal', 'squamous', 'spindle'].map(shape => ({ shape, w: 120, h: 90 })).concat([{ shape: 'round', membrane: 'bilayer', w: 140, h: 120 }, { shape: 'round', nucleus: false }]),
    nucleus: [{ r: 30 }, { r: 30, chromatin: 'condensed', breakdown: 0.5 }, { r: 30, breakdown: 1 }, { r: 30, dna: true }],
    epithelium: [{ n: 3 }, { n: 4, kind: 'cuboidal', brush: true, apical: 2, basal: 2 }, { n: 5, kind: 'squamous' }],
    enzyme: [{}, { shape: 'bilobed', state: 'zymogen' }, { shape: 'dimer', state: 'blocked', plug: 'selective', sidePocket: true }, { anchor: 'membrane', plug: 'acetyl', state: 'blocked' }, { anchor: 'tethered', glow: 1 }, { plug: 'reversible', state: 'blocked' }],
    nuclearReceptor: [{}, { ligand: 'cortisol', bound: 1, where: 'nucleus' }, { ligand: 'thyronine', bound: 0.5 }, { ligand: 'aldosterone', bound: 1, where: 'nucleus', dna: false }],
  };
};
const call = (name, opts) => name === 'channel' || name === 'transporter' || name === 'vesicle' || name === 'enzyme' ? loaded()[name](opts) : loaded()[name](opts);
const every = fn => { for (const [name, list] of Object.entries(SAMPLES())) for (const o of list) fn(name, o, call(name, { key: 't', ...o })); };

/* ---------- module ---------- */
test('module: loads and exports the eleven primitives', () => {
  const c = loaded();
  for (const n of NAMES) ok(typeof c[n] === 'function', `cell.js exports ${n}`);
  ok(c.MEMBRANE && c.MEMBRANE.thick > 0, 'MEMBRANE.thick is exported so lessons line proteins up with the bilayer');
});

/* ---------- generic contract, over every primitive and state ---------- */
test('all: every primitive returns an Art', () => every((n, o, a) => ok(isArt(a), `${n}(${JSON.stringify(o)}) is not an Art`)));
test('all: parts are leaves, ids unique, every url(#) resolves, no text', () => every((n, o, a) => {
  const s = scan(a.svg), tag = `${n}(${JSON.stringify(o)})`;
  ok(!s.nested.length, `${tag} nests parts: ${s.nested.slice(0, 2).join('; ')}`);
  ok(new Set(s.ids).size === s.ids.length, `${tag} repeats an id`);
  ok(s.ids.every(i => i.startsWith('ax-')), `${tag}: ids start ax- so svg() scopes them`);
  const bad = unresolved(a.svg);
  ok(!bad.length, `${tag}: url(#${bad[0]}) resolves nowhere`);
  ok(!/<text\b/.test(a.svg), `${tag} draws text (labels belong to the lesson)`);
  ok(!/NaN|undefined|Infinity/.test(a.svg), `${tag} has NaN or undefined in its markup`);
  ok(partsOf(a.svg).size >= 1, `${tag} emits no data-part`);
}));
test('all: weight strokes stay at least 0.9 on screen at s = 0.6', () => every((n, o) => {
  const a = call(n, { ...o, s: 0.6, key: 'w' });
  for (const m of a.svg.matchAll(/stroke-width="([\d.]+)"/g)) ok(+m[1] * 0.6 >= 0.89 || +m[1] === 0, `${n}: stroke ${m[1]} at s .6 is ${(+m[1] * 0.6).toFixed(2)} on screen`);
}));
test('all: pure for a given key', () => every((n, o) => ok(call(n, { ...o, key: 'p' }).svg === call(n, { ...o, key: 'p' }).svg, `${n} is not pure`)));
test('all: unkeyed instances never share ids', () => {
  for (const n of NAMES) {
    const o = SAMPLES()[n][1] || SAMPLES()[n][0], a = scan(call(n, o).svg).ids, b = scan(call(n, o).svg).ids;
    ok(!a.some(i => b.includes(i)), `${n}: two instances share ${a.find(i => b.includes(i))}`);
  }
});
test('all: parts can be renamed', () => every((n, o, a) => {
  const names = [...partsOf(a.svg)], ren = Object.fromEntries(names.map(p => [p, `zz-${p}`]));
  const b = call(n, { ...o, key: 't', parts: ren }), got = partsOf(b.svg);
  ok(names.every(p => got.has(`zz-${p}`) && !got.has(p)), `${n}: renaming ${names.join(',')} gave ${[...got].join(',')}`);
}));
test('all: x, y and s place the box and the anchors', () => {
  for (const n of NAMES) {
    const o = SAMPLES()[n][0], a = call(n, { ...o, key: 'a' }), b = call(n, { ...o, key: 'a', x: 100, y: 50, s: 2 });
    ok(Math.abs(b.box[0] - (100 + 2 * a.box[0])) < 0.6 && Math.abs(b.box[1] - (50 + 2 * a.box[1])) < 0.6, `${n}: box ${b.box} from ${a.box}`);
    ok(Math.abs(b.box[2] - 2 * a.box[2]) < 0.6, `${n}: box width scales`);
    for (const [k, p] of Object.entries(a.at)) ok(Math.abs(b.at[k][0] - (100 + 2 * p[0])) < 0.6 && Math.abs(b.at[k][1] - (50 + 2 * p[1])) < 0.6, `${n}: at.${k} maps`);
  }
});
test('all: rot and flip map the anchors', () => {
  const a = loaded().gpcr({ key: 'r' }), b = loaded().gpcr({ key: 'r', rot: 90 }), c = loaded().gpcr({ key: 'r', flip: true });
  const p = a.at.pocket, q = b.at.pocket, r = c.at.pocket;
  ok(Math.abs(q[0] + p[1]) < 0.6 && Math.abs(q[1] - p[0]) < 0.6, `rot 90 maps ${p} to ${q}`);
  ok(Math.abs(r[0] + p[0]) < 0.6 && Math.abs(r[1] - p[1]) < 0.6, 'flip mirrors x');
  ok(/<radialGradient id="ax-[^"]+" cx="(?!\.35")[\d.]+"/.test(b.svg), 'a rotated protein moves its highlight, so the light stays upper left');
});
test('all: outline(state) is a path whose structure does not change with state', () => {
  const c = loaded();
  const pairs = [
    ['channel', { kind: 'kv' }, { open: 0 }, { open: 1 }],
    ['transporter', { kind: 'symporter' }, { phase: 0 }, { phase: 0.5 }],
    ['vesicle', { r: 12 }, { fuse: 0.2 }, { fuse: 0.9 }],
    ['nucleus', { r: 30 }, { breakdown: 0 }, { breakdown: 0.4 }],
    ['gpcr', {}, { gprotein: 0 }, { gprotein: 1 }],
  ];
  for (const [n, o, s0, s1] of pairs) {
    const a = c[n](o), d0 = a.outline(s0), d1 = a.outline(s1);
    ok(typeof d0 === 'string' && /^M/.test(d0), `${n}.outline gives a path`);
    ok(d0.replace(/-?\d*\.?\d+(e-?\d+)?/g, '#') === d1.replace(/-?\d*\.?\d+(e-?\d+)?/g, '#'), `${n}.outline keeps one command structure`);
    ok(d0 !== d1, `${n}.outline moves with state`);
  }
});
test('all: detail is ax-d2 or ax-d3, and emphasis lifts it', () => {
  const c = loaded(), a = c.bilayer({ x1: 0, y1: 0, x2: 200, y2: 0 }), b = c.bilayer({ x1: 0, y1: 0, x2: 200, y2: 0, emphasis: ['membrane'] });
  ok(/class="ax-d2"/.test(a.svg), 'lipid heads and tails are ax-d2 detail');
  ok(!/class="ax-d2"/.test(b.svg), 'emphasis keeps them at every size');
});

/* ---------- bilayer and band ---------- */
test('bilayer: core band always, heads and tails as detail, one pair per gap', () => {
  const c = loaded(), a = c.bilayer({ x1: 0, y1: 0, x2: 210, y2: 0, gap: 7, key: 'b' });
  ok(a.svg.includes(P.bilayerCore.base) && a.svg.includes(P.bilayerCore.line), 'core band in the bilayer core colours');
  const heads = a.lipids;
  ok(heads >= 29 && heads <= 32, `about 30 lipid pairs on 210 units at gap 7, got ${heads}`);
  ok(a.svg.indexOf(P.bilayerCore.base) < a.svg.indexOf('class="ax-d2"'), 'the core band is under the detail');
  ok(Math.abs(a.box[3] - c.MEMBRANE.thick) < 2, `bilayer is MEMBRANE.thick thick: ${a.box[3]}`);
});
test('bilayer: snipped lipids lose a tail; clear leaves room for a protein', () => {
  const c = loaded(), base = c.bilayer({ x1: 0, y1: 0, x2: 70, y2: 0, key: 's' }), sn = c.bilayer({ x1: 0, y1: 0, x2: 70, y2: 0, snipped: [2, 4], key: 's' });
  ok(sn.tails === base.tails - 2, 'two tails fewer');
  const cl = c.bilayer({ x1: 0, y1: 0, x2: 210, y2: 0, clear: [[105, 20]], key: 'c' });
  ok(cl.lipids < c.bilayer({ x1: 0, y1: 0, x2: 210, y2: 0, key: 'c' }).lipids, 'clear removes lipids where a protein sits');
});
test('bilayer: works on a closed path (a cell)', () => {
  const c = loaded(), a = c.bilayer({ d: core.blob(0, 0, 60, { seed: 3 }) });
  ok(a.lipids > 40 && /data-lipid/.test(a.svg), 'lipids all round');
});
test('membraneBand: two lines in the core colours, w wide', () => {
  const c = loaded(), a = c.membraneBand({ d: 'M0 0 L100 0', w: 8 });
  ok(a.svg.includes(`stroke="${P.bilayerCore.line}" stroke-width="8"`), 'outer stroke w in the line colour');
  ok(a.svg.includes(P.bilayerCore.base), 'core fill');
});

/* ---------- gpcr ---------- */
test('gpcr: seven helices, three outer and three inner loops, N outside, C inside', () => {
  const c = loaded(), a = c.gpcr({ key: 'g' });
  ok(count(a.svg, /data-helix="/g) === 7, `7 helices, got ${count(a.svg, /data-helix="/g)}`);
  ok(count(a.svg, /data-loop="ecl/g) === 3 && count(a.svg, /data-loop="icl/g) === 3, 'ECL1 to 3 and ICL1 to 3');
  ok(a.at.n[1] < -c.MEMBRANE.thick / 2 && a.at.c[1] > c.MEMBRANE.thick / 2, 'N terminus outside, C terminus inside');
});
test('gpcr: G protein trimer under the membrane; alpha leaves as it activates', () => {
  const c = loaded(), a = c.gpcr({ key: 'g', gprotein: 0 }), b = c.gpcr({ key: 'g', gprotein: 1 });
  for (const s of ['alpha', 'beta', 'gamma']) ok(a.svg.includes(`data-sub="${s}"`), `G protein ${s}`);
  ok(a.at.alpha[1] > c.MEMBRANE.thick / 2 && b.at.alpha[1] > c.MEMBRANE.thick / 2, 'G protein is intracellular');
  ok(b.at.alpha[0] - a.at.alpha[0] > 12, 'alpha moves away when active');
  ok(Math.abs(b.at.beta[0] - a.at.beta[0]) < 1, 'beta-gamma stays');
  ok(!partsOf(c.gpcr({ gprotein: null }).svg).has('gprotein'), 'gprotein: null draws none');
});
test('gpcr: agonist is a messenger, antagonist is a drug, docking with bound', () => {
  const c = loaded(), ag = c.gpcr({ key: 'l', ligand: 'agonist', ligandCol: P.noradrenaline.base, bound: 1 }), an = c.gpcr({ key: 'l', ligand: 'antagonist', bound: 1 });
  ok(ag.svg.includes(P.noradrenaline.base) && partsOf(ag.svg).has('ligand'), 'agonist in its messenger colour');
  ok(an.svg.includes(P.drug.base) && partsOf(an.svg).has('drug'), 'antagonist in drug purple');
  const far = c.gpcr({ key: 'l', ligand: 'agonist', bound: 0 });
  ok(far.at.ligand[1] < ag.at.ligand[1] - 15, 'unbound ligand waits above the pocket');
  ok(Math.abs(ag.at.ligand[1] - ag.at.pocket[1]) < 2, 'bound ligand sits in the pocket');
});

/* ---------- channel ---------- */
test('channel: true assembly per kind', () => {
  const c = loaded(), A = k => c.channel({ kind: k }).assembly;
  ok(A('nav').chains === 1 && A('nav').domains === 4, 'Nav: one chain, four domains');
  ok(A('cav').chains === 1 && A('cav').domains === 4, 'Cav: one chain, four domains');
  ok(A('kv').subunits === 4 && A('kir').subunits === 4, 'Kv and Kir: four subunits');
  ok(A('enac').subunits === 3, 'ENaC: three subunits');
  ok(A('katp').kir === 4 && A('katp').sur === 4, 'K-ATP: four Kir6.2 and four SUR1');
  ok(A('lgic').subunits === 5, 'ligand-gated: pentamer');
  ok(c.channel({ kind: 'katp' }).svg.includes('data-sub="sur1"'), 'SUR1 is drawn');
  ok(count(c.channel({ kind: 'nav' }).svg, /data-loop="linker/g) === 3, 'Nav: I-II, II-III, III-IV linkers draw one chain');
});
test('channel: the gate widens with open and the pore lights in the ion colour', () => {
  const c = loaded();
  for (const k of ['nav', 'kv', 'kir', 'generic', 'lgic']) {
    const w0 = c.channelGeometry.gate(k, 0), w1 = c.channelGeometry.gate(k, 1);
    ok(w0 < 1.5 && w1 > 5, `${k}: gate ${w0} shut, ${w1} open`);
  }
  const o = c.channel({ kind: 'nav', open: 1, ion: 'na' });
  ok(o.svg.includes(P.na.base), 'open pore shows sodium');
  ok(!c.channel({ kind: 'nav', open: 0, ion: 'na' }).svg.includes(P.na.base), 'a shut pore passes no ion');
});
test('channel: Nav inactivates with a hinged lid on the III-IV loop, Kv with a ball and chain', () => {
  const c = loaded(), nav = c.channel({ kind: 'nav', inactivated: 1 }), kv = c.channel({ kind: 'kv', inactivated: 1 });
  ok(/data-gate="lid"/.test(nav.svg) && !/data-gate="ball"/.test(nav.svg), 'Nav lid');
  ok(/data-gate="ball"/.test(kv.svg) && !/data-gate="lid"/.test(kv.svg), 'Kv ball');
  ok(!/data-gate="(lid|ball)"/.test(c.channel({ kind: 'cav', inactivated: 1 }).svg), 'no invented Cav gate');
  ok(partsOf(nav.svg).has('inactivation-gate'), 'the lid is its own part');
  const n0 = c.channel({ kind: 'nav', inactivated: 0 }), n1 = nav;
  ok(Math.abs(n1.at.lid[0]) < Math.abs(n0.at.lid[0]) - 3, 'the lid swings over the pore mouth');
});
test('channel: voltage-gated kinds carry sensor charges; ligand-gated binds its ligands', () => {
  const c = loaded();
  for (const k of ['nav', 'cav', 'kv']) ok(/data-sensor="/.test(c.channel({ kind: k }).svg), `${k} has voltage sensors`);
  ok(!/data-sensor="/.test(c.channel({ kind: 'lgic' }).svg), 'ligand-gated has none');
  const l = c.channel({ kind: 'lgic', bound: 1, ligandCol: P.ach.base, sites: 2 });
  ok(count(l.svg, /data-ligand="/g) === 2 && l.svg.includes(P.ach.base), 'two ligands in their colour');
});
test('channel: a drug plugs the pore, except on K-ATP where it binds SUR1', () => {
  const c = loaded(), nav = c.channel({ kind: 'nav', plug: 1 }), katp = c.channel({ kind: 'katp', plug: 1 });
  ok(Math.abs(nav.at.drug[0]) < 3, 'pore blocker on the axis');
  ok(Math.abs(katp.at.drug[0]) > 14, 'sulfonylurea on SUR1, off the pore');
  ok(partsOf(nav.svg).has('drug') && nav.svg.includes(P.drug.base), 'drug part in drug purple');
});

/* ---------- transporter ---------- */
test('transporter: alternating access', () => {
  const c = loaded(), g = c.transporterGeometry;
  ok(g.facing(0) === 0 && g.facing(0.5) === 1 && Math.abs(g.facing(1) - 0) < 1e-9, 'outward at 0, inward at .5, back at 1');
  const out = c.transporter({ kind: 'uniporter', phase: 0 }), inn = c.transporter({ kind: 'uniporter', phase: 0.5 });
  ok(out.at.mouth[1] < 0 && inn.at.mouth[1] > 0, 'the open mouth faces out, then in');
});
test('transporter: cargo directions by kind', () => {
  const c = loaded(), dirs = o => c.transporter(o).cargo.map(q => q.dir);
  ok(dirs({ kind: 'symporter', cargo: ['na', 'glucose'] }).every(d => d === 'in'), 'symporter: both in');
  ok(dirs({ kind: 'antiporter', cargo: ['na', 'h'] }).join() === 'in,out', 'antiporter: in and out');
  ok(dirs({ kind: 'pump', cargo: ['na', 'k'] }).join() === 'out,in', 'pump: the first out (Na), the second in (K)');
  ok(dirs({ kind: 'symporter', cargo: [{ key: 'na', dir: 'out' }, 'k'] })[0] === 'out', 'explicit direction wins');
  const s = c.transporter({ kind: 'pump', cargo: [{ key: 'na', n: 3 }, { key: 'k', n: 2 }] });
  ok(count(s.svg, /data-cargo="na"/g) === 3 && count(s.svg, /data-cargo="k"/g) === 2, 'three Na, two K');
});
test('transporter: in-cargo moves inward through the first half', () => {
  const c = loaded(), y = ph => c.transporter({ kind: 'symporter', cargo: ['na'], phase: ph }).cargo[0].y;
  ok(y(0.1) < y(0.3) && y(0.3) < y(0.45), 'down through the carrier');
  const o = ph => c.transporter({ kind: 'antiporter', cargo: ['na', 'h'], phase: ph }).cargo[1].y;
  ok(o(0.6) > o(0.8) && o(0.8) > o(0.95), 'out-cargo moves up in the second half');
});
test('transporter: seamless in phase; pump beta subunit and ATP', () => {
  const c = loaded();
  ok(c.transporter({ kind: 'pump', cargo: ['na', 'k'], phase: 0, key: 'z' }).svg === c.transporter({ kind: 'pump', cargo: ['na', 'k'], phase: 1, key: 'z' }).svg, 'phase 1 draws phase 0');
  const p = c.transporter({ kind: 'pump', beta: true, atp: true });
  ok(p.svg.includes('data-sub="beta"') && p.svg.includes(P.glyco.base), 'glycosylated beta subunit');
  ok(partsOf(p.svg).has('atp'), 'ATP part');
  ok(partsOf(c.transporter({ kind: 'pump' }).svg).has('pump') && partsOf(c.transporter({ kind: 'symporter' }).svg).has('carrier'), 'pump or carrier part');
  const b = c.transporter({ kind: 'reuptake', blocked: 1 });
  ok(partsOf(b.svg).has('drug') && b.at.drug[1] < 0, 'a blocker sits in the outer mouth');
});

/* ---------- vesicle ---------- */
test('vesicle: omega pore widens with fuse; cargo leaves outward', () => {
  const c = loaded(), g = c.vesicleGeometry;
  ok(g.pore(12, 0) === 0 && g.pore(12, 0.3) > 0 && g.pore(12, 0.6) > g.pore(12, 0.3), 'pore half-width grows');
  const a = c.vesicle({ r: 12, cargo: 'ach', n: 4, fuse: 0 }), b = c.vesicle({ r: 12, cargo: 'ach', n: 4, fuse: 1 });
  ok(count(a.svg, /data-cargo="ach"/g) === 4, 'four cargo molecules');
  ok(b.at.cargo[1] < a.at.cargo[1] - 12, 'released cargo is outside the membrane');
  ok(a.at.membrane[1] < -12, 'the plasma membrane line sits above the docked vesicle');
});

/* ---------- cell body and nucleus ---------- */
test('cellBody: shapes fill their box; the nucleus is its own leaf part', () => {
  const c = loaded();
  for (const shape of ['round', 'cuboidal', 'columnar', 'polygon', 'pyramidal', 'squamous', 'spindle']) {
    const a = c.cellBody({ shape, w: 120, h: 90 });
    ok(Math.abs(a.box[2] - 120) < 8 && Math.abs(a.box[3] - 90) < 8, `${shape}: box ${a.box}`);
    ok(partsOf(a.svg).has('cell') && partsOf(a.svg).has('nucleus'), `${shape}: cell and nucleus`);
  }
  ok(c.cellBody({ shape: 'columnar', w: 40, h: 90, polarity: 'apical-up' }).at.nucleus[1] > 0, 'columnar nucleus sits basally');
});
test('nucleus: double envelope with pores; condensed chromosomes replace the nucleolus', () => {
  const c = loaded(), a = c.nucleus({ r: 30 });
  ok(count(a.svg, /data-pore="/g) >= 4, 'pores');
  ok(a.svg.includes(P.nucleolus.base) && /data-nucleolus/.test(a.svg), 'a nucleolus');
  const m = c.nucleus({ r: 30, chromatin: 'condensed' });
  ok(count(m.svg, /data-chromosome="/g) >= 4 && !/data-nucleolus/.test(m.svg), 'chromosomes, no nucleolus');
  ok(!/data-envelope/.test(c.nucleus({ r: 30, breakdown: 1 }).svg), 'envelope gone at breakdown 1');
  ok(/data-dna/.test(c.nucleus({ r: 30, dna: true }).svg) && c.nucleus({ r: 30, dna: true }).at.dna, 'DNA slot');
});

/* ---------- epithelium ---------- */
test('epithelium: polarised cells, slots, tight junctions, basement membrane', () => {
  const c = loaded(), a = c.epithelium({ n: 4, apical: 2, basal: 1 });
  ok(a.slots.apical.length === 8 && a.slots.basal.length === 4, 'slots per cell');
  ok(a.slots.apical.every(p => p[1] < a.slots.basal[0][1]), 'apical side above basal side');
  ok(count(a.svg, /data-junction="/g) === 3, 'a tight junction between each pair of cells');
  ok(partsOf(a.svg).has('tight-junction') && partsOf(a.svg).has('basement-membrane') && partsOf(a.svg).has('epithelium'), 'parts');
  ok(count(c.epithelium({ n: 3, brush: true }).svg, /data-villus="/g) > 12, 'brush border microvilli');
  ok(a.at.lumen[1] < a.at.apical[1] && a.at.interstitium[1] > a.at.basal[1], 'lumen above, interstitium below');
});

/* ---------- enzyme ---------- */
test('enzyme: cleft, zymogen lid, plugs, anchors', () => {
  const c = loaded();
  ok(/data-cleft/.test(c.enzyme({}).svg), 'active-site cleft');
  ok(partsOf(c.enzyme({ state: 'zymogen' }).svg).has('propeptide'), 'zymogen has a propeptide');
  ok(!partsOf(c.enzyme({ state: 'active' }).svg).has('propeptide'), 'active form has none');
  for (const plug of ['reversible', 'selective', 'acetyl']) ok(new RegExp(`data-plug="${plug}"`).test(c.enzyme({ state: 'blocked', plug }).svg), `${plug} plug`);
  ok(/data-pocket/.test(c.enzyme({ sidePocket: true }).svg), 'side pocket');
  ok(c.enzyme({ anchor: 'membrane' }).at.foot && c.enzyme({ anchor: 'tethered' }).at.foot, 'anchored forms give the foot point');
  ok(/data-tail="collagen"/.test(c.enzyme({ anchor: 'tethered' }).svg), 'tethered by a collagen tail');
  ok(count(c.enzyme({ shape: 'dimer' }).svg, /data-cleft/g) === 2, 'a dimer has two active sites');
});

/* ---------- nuclear receptor ---------- */
test('nuclearReceptor: ligand docks with bound; DNA only in the nucleus', () => {
  const c = loaded(), a = c.nuclearReceptor({ ligand: 'cortisol', bound: 0 }), b = c.nuclearReceptor({ ligand: 'cortisol', bound: 1 });
  ok(Math.hypot(b.at.ligand[0] - b.at.pocket[0], b.at.ligand[1] - b.at.pocket[1]) < 2, 'bound ligand in the pocket');
  ok(Math.hypot(a.at.ligand[0] - a.at.pocket[0], a.at.ligand[1] - a.at.pocket[1]) > 10, 'unbound ligand outside');
  ok(b.svg.includes(P.cortisol.base), 'cortisol colour');
  ok(!/data-dna/.test(b.svg), 'no DNA in the cytoplasm');
  ok(/data-dna/.test(c.nuclearReceptor({ ligand: 'cortisol', bound: 1, where: 'nucleus' }).svg), 'DNA in the nucleus');
  ok(count(c.nuclearReceptor({ ligand: 'cortisol', bound: 1 }).svg, /data-ring="/g) === 4, 'a steroid ligand is 6-6-6-5, four rings');
  ok(count(c.nuclearReceptor({ ligand: 'thyronine', bound: 1 }).svg, /data-iodine="/g) === 3, 'T3 has three iodines');
});

/* ---------- performance ---------- */
test('perf: 200 mixed primitives build in under 150 ms', () => {
  const c = loaded(), t0 = performance.now();
  for (let i = 0; i < 40; i++) { c.channel({ kind: 'nav', open: i / 40 }); c.transporter({ kind: 'pump', phase: i / 40, cargo: [{ key: 'na', n: 3 }, { key: 'k', n: 2 }] }); c.gpcr({ gprotein: i / 40 }); c.vesicle({ r: 10, fuse: i / 40, n: 5, cargo: 'ach' }); c.bilayer({ x1: 0, y1: 0, x2: 480, y2: 0 }); }
  const ms = performance.now() - t0;
  ok(ms < 150, `${ms.toFixed(1)} ms`);
});

/* ---------- lints ---------- */
const file = root + 'lab/kit/art/cell.js';
const src = () => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
test('lint: no em or en dash in cell.js, this test or the gallery', () => {
  for (const f of [file, root + 'tools/art-tests/cell.test.mjs', root + 'tools/art-gallery/cell.html']) {
    if (!fs.existsSync(f)) { ok(false, `${path.basename(f)} missing`); continue; }
    const s = fs.readFileSync(f, 'utf8');
    ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)), `${path.basename(f)} has an em or en dash`);
  }
});
test('lint: no hex colour in cell.js outside its TODO block', () => {
  const s = src().replace(/\/\* TODO\(promote to core\.js\)[\s\S]*?\*\//g, '').replace(/\/\/ TODO\(promote[^\n]*\n(const LOCAL[\s\S]*?\n\};)/, '');
  ok(src().length > 0, 'cell.js exists');
  const hits = s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  ok(!hits, `cell.js: ${hits && hits.slice(0, 3).join(' ')}`);
});
test('lint: fill() only in fills; art imported unversioned', () => {
  const s = src();
  ok(!/stroke[=:]\s*["'`]?\$?\{?\s*fill\(/.test(s), 'fill() on a stroke');
  ok(!/art\/[\w-]+\.js\?v=|core\.js\?v=/.test(s), 'versioned import');
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
