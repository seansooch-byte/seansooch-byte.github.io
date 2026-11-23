// Lesson 31: GPCRs and second messengers. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - One membrane patch runs across each signalling picture: fluid outside above, the cell's fluid below.
//     The receptor is the library's seven-pass GPCR with its G protein; alpha slides off toward its enzyme
//     when it is switched on. Hormones are bronze spheres (adrenaline, noradrenaline), acetylcholine rose.
//     Cyclic AMP is the library's nucleotide glyph, calcium the teal rounded square, IP3 a ring carrying
//     three phosphates. Kit blue is only ever a change or the switched-on state; red marks a toxin's tag
//     and a brake.
//   - The "What changes it" pictures (and both reference tabs) are drawn from model.js: the meter on the
//     right and the number of messenger glyphs follow the model's level, over a dashed outline of the
//     normal level and of alpha's normal place.
//   - No reference number lives in this file. The pacemaker's resting rate comes from clinical-values.json;
//     if it cannot load, the tabs say so and show the model's relative levels only.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, mix, artGhost, arrowFixed, leader, inhibit, textWidth } from '/lab/kit/art/core.js';
import { gpcr, bilayer, enzyme, channel } from '/lab/kit/art/cell.js';
import { ion, camp, atp, adrenaline } from '/lab/kit/art/molecules.js';
import { solve, drawnOn, heartRate, STATES } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, RED = P.ui.red;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
// A label with its leader starting just clear of the text, level with the text's middle.
function named(x, y, words, cls, anchor, target) {
  const w = textWidth(words, cls), from = [anchor === 'end' ? x - w - 6 : x + w + 6, y - 6];
  return text(x, y, words, cls, anchor) + leader(from, target);
}

/* ---------- Placement: deterministic, evenly spread points ---------- */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
// n points inside [x, y, w, h], each at least gap from the others and outside every keep-out box.
function spread(seed, n, [x, y, w, h], gap, keep = []) {
  const r = seeded(seed), out = [];
  for (let tries = 0; out.length < n && tries < n * 500; tries++) {
    const p = [x + r() * w, y + r() * h];
    if (keep.some(([kx, ky, kw, kh]) => p[0] > kx && p[0] < kx + kw && p[1] > ky && p[1] < ky + kh)) continue;
    if (out.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap)) out.push(p);
  }
  return out;
}

/* ---------- Glyphs, drawn once at the origin ---------- */
const CAMP = camp({ s: 1.1 }).svg;
const CAMP_SM = camp({ s: 0.95 }).svg;
const ATP = atp({ s: 0.85 }).svg;
const AMP = atp({ s: 0.85, phosphates: 1 }).svg;
const CA = ion('ca', { charge: false }).svg;
const PHOS = ion('po4', { charge: false, s: 1.2, parts: { phosphate: 'phospho' } }).svg;
const HORMONE = adrenaline({ s: 1.5, parts: { adrenaline: 'signal' } }).svg;
// IP3: an inositol ring carrying three phosphate groups (lesson-local; the library has no IP3 yet).
const RING = mix(P.ribose.base, P.ui.white, 0.25);
const IP3 = (() => {
  const hex = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [7.5 * Math.cos(a), 7.5 * Math.sin(a)]; });
  let s = `<path d="M${hex.map(p => `${f(p[0])} ${f(p[1])}`).join(' L')} Z" fill="${RING}" stroke="${P.ribose.line}" stroke-width="1.2"/>`;
  for (const i of [0, 2, 4]) { const [x, y] = hex[i], k = 1.55; s += `<path d="M${f(x)} ${f(y)} L${f(x * k)} ${f(y * k)}" stroke="${P.po4.line}" stroke-width="1.3"/><circle cx="${f(x * k)}" cy="${f(y * k)}" r="3.6" fill="${P.po4.base}" stroke="${P.po4.line}" stroke-width="1.1"/>`; }
  return `<g data-part="ip3">${s}</g>`;
})();
// Protein kinase A: two braking parts (sage) and two working parts (the alternate protein colour).
const blobPart = (x, y, rx, ry, mat) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rx}" ry="${ry}" fill="${P[mat].base}" stroke="${P[mat].line}" stroke-width="1.75"/><ellipse cx="${f(x - rx * 0.35)}" cy="${f(y - ry * 0.4)}" rx="${f(rx * 0.32)}" ry="${f(ry * 0.25)}" fill="${P.ui.white}" fill-opacity=".3"/>`;
// The toxin's tag on alpha: a red-edged diamond.
const tagAt = ([x, y], op = 1) => `<g data-part="toxin" ${fade(op)}><path d="M${f(x)} ${f(y - 9)} l8 9 l-8 9 l-8 -9 Z" fill="${P.ui.redWash}" stroke="${RED}" stroke-width="2.2" stroke-linejoin="round"/></g>`;

/* ---------- The membrane patch ---------- */
const S = 1.6, MY = 150, RX = 110, EX = 215, H = 404;
const half = s => 12 * s;
function backdrop(h, my = MY, s = S) {
  return `<rect x="0" y="0" width="480" height="${f(my - half(s))}" fill="${P.space.ecf}"/>`
    + `<rect x="0" y="${f(my + half(s))}" width="480" height="${f(h - my - half(s))}" fill="${P.cytoplasm.hi}"/>`;
}
// clear: [[x, half-width]] in picture units, where a protein sits in the membrane
function membrane(clear = [], my = MY, s = S) {
  return bilayer({ x1: 0, y1: 0, x2: 480 / s, y2: 0, x: 0, y: my, s, clear: clear.map(([x, w]) => [x / s, w / s]) }).svg;
}
function receptor({ x = RX, y = MY, s = S, ligand = null, bound = 1, g = 0 } = {}) {
  return gpcr({ x, y, s, ligand: ligand ? 'agonist' : null, ligandCol: ligand || 'noradrenaline', bound, gprotein: g, parts: { ligand: 'ligand' } });
}
// The enzyme alpha works (adenylyl cyclase or phospholipase C): hanging from the inside of the membrane.
const ES = S * 0.85;
const membraneEnzyme = ({ x = EX, glow = 0, part = 'cyclase' } = {}) => enzyme({ x, y: MY + 38 * ES, s: ES, rot: 180, anchor: 'membrane', glow, parts: { enzyme: part } });
// GDP or GTP, written under alpha
function nucleotide(r, which, op = 1, dy = 30) {
  const [x, y] = r.at.alpha;
  return `<g data-part="${which === 'GTP' ? 'gtp' : 'gdp'}" ${fade(op)}>${text(x, y + dy, which, `xs b${which === 'GTP' ? ' blue' : ''}`)}</g>`;
}

/* ---------- A meter for a second messenger, relative to the resting cell ---------- */
function meter({ level, ghost = 1, max = 6.5, x = 404, y0 = 216, h = 140, w = 34, label, mat, part, lx, noArrow = false, short = false }) {
  const ly = y0 + h - clamp(level / max, 0, 1) * h, gy = y0 + h - clamp(ghost / max, 0, 1) * h, cx = x + w / 2;
  let s = `<rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="4" fill="${P.ui.paper}" stroke="${P.ui.rule}" stroke-width="1.5"/>`;
  s += `<rect x="${x + 2}" y="${f(ly)}" width="${w - 4}" height="${f(Math.max(1.5, y0 + h - ly - 2))}" rx="3" fill="${mat.base}" fill-opacity=".85" stroke="${mat.line}" stroke-width="1.25"/>`;
  s += artGhost(`M${x - 6} ${f(gy)} H${x + w + 6}`);
  if (!noArrow && Math.abs(ly - gy) > 12) s += arrowFixed([x + w + 13, gy + (ly < gy ? -3 : 3)], [x + w + 13, ly + (ly < gy ? 2 : -2)], { col: BLUE, w: 3, head: { l: 9, w: 5.5 } });
  s += text(lx ?? cx, y0 - 12, label, 'xs b');
  s += text(cx, y0 + h + 22, short ? `${level.toFixed(1)}×` : `${level.toFixed(1)} × rest`, 'xs');
  return `<g data-part="${part}">${s}</g>`;
}

/* ---------- The signalling picture: receptor, G protein, enzyme, messengers ---------- */
const POOL = spread(31, 40, [26, 272, 322, 98], 31);
const CA_POOL = spread(37, 40, [24, 258, 324, 50], 19, [[0, 236, 140, 36]]);
const IP3_POOL = spread(43, 14, [266, 176, 100, 76], 29);
const ER_D = 'M54 322 C40 322 30 332 30 346 C30 360 40 370 54 370 L326 370 C340 370 350 360 350 346 C350 332 340 322 326 322 Z';
const ER_CA = spread(41, 12, [52, 332, 280, 30], 22);
const erSac = (open = 0) => `<g data-part="er"><path d="${ER_D}" fill="${P.er.base}" stroke="${P.er.line}" stroke-width="1.75"/>${[120, 250].map(x => channel({ kind: 'generic', open, x, y: 322, rot: 180, s: 0.6, parts: { channel: 'er' } }).svg).join('')}</g>`;
// o: family 'gs' | 'gi' | 'gq', ligand key or null, bound, g (alpha's place, 0 docked .. 1 at its enzyme),
// nuc ('GDP' | 'GTP'), nucOp, glow, level (messenger, x rest), ghostLevel, ghostG (alpha's normal place,
// null for none), tag (toxin tag opacity), ip3 (x rest, Gq only), title, sub, words, wordsOp, note.
function pathway(o) {
  const gq = o.family === 'gq';
  let b = backdrop(H);
  b += membrane([[RX, 34], [EX, 12]]);
  // messengers sit behind the proteins
  if (gq) {
    b += erSac(clamp(o.level - 1, 0, 1));
    const stored = Math.max(4, Math.round(12 - (o.level - 1)));
    b += `<g data-part="calcium">${ER_CA.slice(0, stored).map(([x, y]) => at(CA, x, y)).join('')}${CA_POOL.slice(0, Math.round(3 * o.level)).map(([x, y]) => at(CA, x, y)).join('')}</g>`;
    b += IP3_POOL.slice(0, Math.round(2 * (o.ip3 ?? 1))).map(([x, y]) => at(IP3, x, y)).join('');
  } else {
    b += `<g data-part="camp">${POOL.slice(0, Math.min(POOL.length, Math.round(5 * o.level))).map(([x, y]) => at(CAMP_SM, x, y)).join('')}</g>`;
  }
  const r = receptor({ ligand: o.ligand, bound: o.bound ?? 1, g: o.g });
  b += membraneEnzyme({ glow: o.family === 'gi' ? 0 : o.glow, part: gq ? 'plc' : 'cyclase' }).svg;
  b += r.svg;
  const [ax, ay] = r.at.alpha;
  if (o.family === 'gi' && o.g > 0.4) b += `<g ${fade((o.g - 0.4) / 0.35)}>${inhibit(`M${f(ax + 17)} ${f(ay)} L${f(EX - 35)} ${f(ay)}`, { w: 3, bar: 16 })}</g>`;
  if (o.ghostG != null && Math.abs(o.ghostG - o.g) > 0.04) b += artGhost(r.outline({ gprotein: o.ghostG }));
  if (o.tag) b += tagAt([ax + 14, ay - 15], o.tag);
  if (o.nuc) b += nucleotide(r, o.nuc, o.nucOp ?? 1);
  b += meter(gq ? { level: o.level, ghost: o.ghostLevel ?? 1, max: 9, label: 'calcium', mat: P.ca, part: 'calcium' }
    : { level: o.level, ghost: o.ghostLevel ?? 1, label: 'cyclic AMP', mat: P.adenine, part: 'camp' });
  b += text(16, 28, o.title, 'sm b', 'start');
  if (o.sub) b += text(16, 52, o.sub, 'xs muted', 'start');
  b += text(464, 52, 'outside the cell', 'xs muted', 'end');
  b += text(16, 260, 'inside the cell', 'xs muted', 'start');
  if (o.note) b += `<g ${fade(o.note[1])}>${text(464, 84, o.note[0], 'xs b red', 'end')}</g>`;
  if (o.words) b += `<g ${fade(o.wordsOp ?? 1)}>${text(16, 396, o.words, 'sm b blue', 'start')}</g>`;
  return b;
}

/* ---------- Build the idea ---------- */
function outsideStill() {
  let b = backdrop(330) + membrane();
  b += [[70, 84], [160, 104], [250, 76], [330, 98], [420, 82]].map(([x, y]) => at(HORMONE, x, y)).join('');
  // one hormone reaches the membrane and is turned back
  b += at(HORMONE, 205, 116);
  b += `<path d="M198 106 l14 14 m0 -14 l-14 14" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>`;
  b += text(16, 30, 'outside the cell', 'sm b', 'start');
  b += text(464, 30, 'hormone: the first messenger', 'sm b', 'end') + leader([372, 38], [336, 92]);
  b += named(464, 222, 'cell membrane', 'sm b', 'end', [318, 160]);
  b += text(16, 260, 'inside the cell', 'sm b', 'start');
  b += text(16, 296, 'the hormone cannot cross', 'xs muted', 'start');
  return svg('A patch of cell membrane, a golden band of lipids, with fluid outside above it and the cell inside below it. Bronze hormone molecules float outside; one reaches the membrane and is turned back, marked with a red cross: the hormone, the first messenger, cannot cross.', b, { h: 330 });
}

// Close-up of the receptor (steps 2 and 3)
const S2 = 2.2, MY2 = 172, R2X = 200;
function closeReceptor(bound, { ligand = null, labels = 'parts', tOp = 1 } = {}) {
  let b = backdrop(340, MY2, S2) + membrane([[R2X, 74]], MY2, S2);
  const r = receptor({ x: R2X, y: MY2, s: S2, ligand, bound, g: null });
  b += r.svg;
  const [px, py] = r.at.pocket;
  b += text(16, 30, 'outside the cell', 'sm b', 'start');
  b += text(16, 330, 'inside the cell', 'sm b', 'start');
  if (labels === 'parts') {
    b += `<g data-part="pocket"><ellipse cx="${f(px)}" cy="${f(py)}" rx="11" ry="19" fill="none" stroke="${BLUE}" stroke-width="2"/></g>`;
    b += named(16, 62, 'binding pocket', 'sm b', 'start', [px - 6, py - 12]);
    b += text(464, 106, 'seven coils cross', 'sm b', 'end') + named(464, 128, 'the membrane', 'sm b', 'end', [R2X + 53, MY2 - 10]);
    const [lx, ly] = r.at.icl3;
    b += named(464, 290, 'loops inside the cell', 'sm b', 'end', [lx + 8, ly + 4]);
  } else {
    const [gx, gy] = r.at.ligand;
    b += named(464, 40, 'the hormone: the ligand', 'sm b', 'end', [gx + 9, gy - 6]);
    b += `<g ${fade(tOp)}>${arrowFixed([R2X + 44, MY2 + 52], [R2X + 66, MY2 + 62], { col: BLUE, w: 3, head: { l: 9, w: 5.5 } })}${text(R2X + 76, MY2 + 82, 'one coil swings out', 'sm b blue', 'start')}</g>`;
  }
  return b;
}

// The G protein under its receptor (steps 4, 5, 6)
const G4X = 190, S4 = 2.1, MY4 = 140;
function gproteinPicture({ bound = 0, g = 0, nuc = 'GDP', nucOp = 1, nucDy = 0, extra = '', ligand = 'noradrenaline' } = {}) {
  let b = backdrop(330, MY4, S4) + membrane([[G4X, 46]], MY4, S4);
  const r = receptor({ x: G4X, y: MY4, s: S4, ligand: bound > 0.001 ? ligand : null, bound, g });
  b += r.svg;
  b += nucleotide(r, nuc, nucOp, 38 + nucDy);
  b += text(16, 30, 'outside the cell', 'sm b', 'start');
  const [bx, by] = r.at.beta, [ax, ay] = r.at.alpha, on = nuc === 'GTP' && g > 0.5;
  b += named(16, 300, 'beta and gamma', 'sm b', 'start', [bx - 6, by + 8]);
  b += named(464, 300, on ? 'alpha, switched on' : 'alpha', `sm b${on ? ' blue' : ''}`, 'end', [ax + 6, ay + 8]);
  return { b: b + extra, r };
}
function gproteinStill() {
  const { b } = gproteinPicture({ extra: text(464, 30, 'G protein holding GDP: off', 'sm b', 'end') });
  return svg('A receptor in the membrane with no hormone bound. Under it, tethered to the inside of the membrane, sits a G protein of three parts: alpha, holding GDP, and beta with gamma beside it. The G protein is switched off.', b, { h: 330 });
}
const switchScene = {
  duration: 4400,
  stages: [[0, 'the hormone binds'], [0.3, 'GDP out, GTP in'], [0.6, 'alpha moves off']],
  render(t) {
    const bound = ease.inOut(span(t, 0.04, 0.28)), g = ease.inOut(span(t, 0.6, 0.9));
    const out = span(t, 0.3, 0.44), inn = span(t, 0.46, 0.6);
    const nuc = t < 0.45 ? 'GDP' : 'GTP', nucOp = t < 0.45 ? 1 - out : inn, nucDy = t < 0.45 ? 22 * out : 22 * (1 - inn);
    const { b } = gproteinPicture({ bound, g, nuc, nucOp, nucDy, extra: `<g ${fade(span(t, 0.62, 0.8))}>${text(464, 30, 'GTP in: switched on', 'sm b blue', 'end')}</g>` });
    return svg('A hormone settles into the receptor. Under it, the G protein\'s alpha lets go of GDP and takes up GTP, then slides away from beta and gamma along the inside of the membrane, switched on.', b, { h: 330 });
  },
};
const timerScene = {
  duration: 4400,
  stages: [[0, 'alpha on, holding GTP'], [0.25, 'GTP split to GDP'], [0.5, 'alpha rejoins']],
  render(t) {
    const split = span(t, 0.25, 0.42), g = 1 - ease.inOut(span(t, 0.5, 0.85));
    const nuc = t < 0.34 ? 'GTP' : 'GDP', nucOp = t < 0.34 ? 1 - split * 1.6 : clamp((split - 0.55) / 0.45, 0, 1);
    const pre = gproteinPicture({ g, nuc, nucOp });
    const [ax, ay] = pre.r.at.alpha;
    // the cut-off phosphate drifts away and fades
    const phos = split > 0 && t < 0.62 ? at(PHOS, ax + 26 + 30 * span(t, 0.3, 0.6), ay + 22 + 30 * span(t, 0.3, 0.6), ` ${fade(1 - span(t, 0.45, 0.62))}`) : '';
    const words = `<g ${fade(span(t, 0.2, 0.32) - span(t, 0.62, 0.72))}>${text(464, 30, 'alpha splits GTP to GDP', 'sm b blue', 'end')}</g><g ${fade(span(t, 0.8, 0.95))}>${text(464, 30, 'back together: off', 'sm b', 'end')}</g>`;
    return svg('With no hormone bound, switched-on alpha, holding GTP, splits it to GDP: a phosphate drifts off. Alpha then slides back and rejoins beta and gamma under the receptor, switched off.', pre.b + phos + words, { h: 330 });
  },
};

/* ---------- Second messengers ---------- */
const cyclaseScene = {
  duration: 3600, loop: true, rest: 0.4,
  render(t) {
    let b = backdrop(400) + membrane([[RX, 34], [EX, 12]]);
    const en = membraneEnzyme({ glow: 1 });
    const r = receptor({ ligand: 'noradrenaline', g: 1 });
    const [sx, sy] = en.at.site, IN = [44, 330], OUT = [330, 318];
    let mol = '';
    for (let i = 0; i < 3; i++) {
      const u = (t + i / 3) % 1;
      if (u < 0.5) { const k = ease.inOut(u / 0.5); mol += at(ATP, lerp(IN[0], sx, k), lerp(IN[1], sy + 14, k), ` ${fade(Math.min(1, (0.5 - u) * 12))}`); }
      else { const k = ease.inOut((u - 0.5) / 0.5); mol += `<g data-part="camp">${at(CAMP, lerp(sx, OUT[0], k), lerp(sy + 14, OUT[1], k), ` ${fade(Math.min(1, (u - 0.5) * 12))}`)}</g>`; }
    }
    const made = [[300, 360], [348, 340], [392, 362], [420, 320], [380, 290]];
    b += `<g data-part="camp">${made.map(([x, y]) => at(CAMP, x, y)).join('')}</g>`;
    b += en.svg + r.svg + mol + nucleotide(r, 'GTP');
    b += text(16, 30, 'outside the cell', 'sm b', 'start');
    b += named(464, 222, 'adenylyl cyclase', 'sm b', 'end', [EX + 30, MY + 50]);
    b += text(16, 384, 'ATP in', 'sm b', 'start');
    b += text(464, 396, 'cyclic AMP out', 'sm b', 'end');
    b += text(16, 244, 'Gs alpha, on', 'xs b blue', 'start');
    return svg('Hormone bound, the receptor\'s Gs alpha, holding GTP, sits against adenylyl cyclase, an enzyme hanging from the inside of the membrane. ATP molecules drift into the enzyme and come out as cyclic AMP, which gathers in the cell\'s fluid.', b, { h: 400 });
  },
};

const AMP_X = [256, 344, 432];
const amplifyScene = {
  duration: 3400,
  stages: [[0, 'one hormone'], [0.15, 'several G proteins'], [0.35, 'several cyclases'], [0.5, 'many messengers']],
  render(t) {
    const a1 = span(t, 0.15, 0.32), a2 = span(t, 0.35, 0.5), a3 = span(t, 0.5, 0.95);
    let b = at(HORMONE, 344, 56);
    const line = (x1, y1, x2, y2, op) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="1.5" ${fade(op)}/>`;
    for (const x of AMP_X) {
      b += line(344, 70, x, 116, a1);
      b += `<g ${fade(a1)}>${blobPart(x, 132, 15, 11, 'protein2')}</g>`;
      b += line(x, 146, x, 172, a2);
      b += `<g ${fade(a2)}>${enzyme({ x, y: 196, s: 0.65, glow: 1, parts: { enzyme: 'cyclase' } }).svg}</g>`;
    }
    let many = '', n = 0;
    const show = Math.round(a3 * 24);
    for (let row = 0; row < 4; row++) for (const x of AMP_X) for (const dx of [-21, 21]) { if (n++ < show) many += at(CAMP_SM, x + dx, 252 + row * 30); }
    b += `<g data-part="many">${many}</g>`;
    b += text(16, 62, '1 hormone', 'sm b', 'start');
    b += `<g ${fade(a1)}>${text(16, 138, 'several G proteins', 'sm b', 'start')}</g>`;
    b += `<g ${fade(a2)}>${text(16, 202, 'one cyclase each', 'sm b', 'start')}</g>`;
    b += `<g ${fade(a3)}>${text(16, 304, 'many cyclic AMP', 'sm b blue', 'start')}</g>`;
    return svg('A fan that widens downward: one hormone molecule at the top switches on several G protein alphas, each alpha works an adenylyl cyclase, and each cyclase makes many cyclic AMP molecules, which fill the bottom of the picture.', b, { h: 380 });
  },
};

const PKA = { r: [[212, 180], [268, 180]], c: [[212, 216], [268, 216]], free: [[146, 300], [334, 300]], tgt: [[92, 318], [388, 318]], dock: [[176, 152], [222, 146], [258, 146], [304, 152]] };
const pkaScene = {
  duration: 4400,
  stages: [[0, 'cyclic AMP binds the brakes'], [0.42, 'working parts freed'], [0.7, 'phosphates added']],
  render(t) {
    const d = ease.inOut(span(t, 0.08, 0.38)), m = ease.inOut(span(t, 0.42, 0.7)), p = span(t, 0.72, 0.86);
    let b = '';
    b += PKA.tgt.map(([x, y]) => enzyme({ x, y, s: 0.8, cleft: false, mat: 'protein', parts: { enzyme: 'phospho' } }).svg).join('');
    let pka = PKA.r.map(([x, y]) => blobPart(x, y, 28, 17, 'protein')).join('');
    pka += PKA.c.map(([x, y], i) => blobPart(lerp(x, PKA.free[i][0], m), lerp(y, PKA.free[i][1], m), 24, 15, 'protein2')).join('');
    b += `<g data-part="pka">${pka}</g>`;
    b += PKA.dock.map(([x, y], i) => `<g data-part="camp">${at(CAMP_SM, lerp(150 + i * 60, x, d), lerp(40, y, d))}</g>`).join('');
    b += `<g ${fade(p)}>${PKA.tgt.map(([x, y]) => at(PHOS, x + 22, y - 24)).join('')}</g>`;
    b += text(16, 96, 'cyclic AMP', 'sm b', 'start');
    b += named(464, 128, 'braking parts', 'sm b', 'end', [PKA.r[1][0] + 14, PKA.r[1][1] - 6]);
    const [cx, cy] = [lerp(PKA.c[1][0], PKA.free[1][0], m), lerp(PKA.c[1][1], PKA.free[1][1], m)];
    b += named(464, 250, 'working parts', 'sm b', 'end', [cx + 10, cy + 2]);
    b += text(16, 204, 'protein kinase A', 'sm b', 'start');
    b += text(92, 372, 'target protein', 'xs muted') + text(388, 372, 'target protein', 'xs muted');
    b += `<g ${fade(p)}>${text(240, 398, 'phosphate added: target switched', 'sm b blue')}</g>`;
    return svg('Protein kinase A: two sage braking parts holding two lilac working parts. Four cyclic AMP molecules come down and bind the braking parts; the working parts are freed and move to two target proteins, which each gain a phosphate group.', b, { h: 404 });
  },
};

const pdeScene = {
  duration: 3600, loop: true, rest: 0.45,
  render(t) {
    const en = enzyme({ x: 240, y: 170, s: 1.5, rot: 90, parts: { enzyme: 'pde' } });
    const [sx, sy] = en.at.site;
    let b = en.svg;
    for (let i = 0; i < 3; i++) {
      const u = (t + i / 3) % 1;
      if (u < 0.5) { const k = ease.inOut(u / 0.5); b += `<g data-part="camp">${at(CAMP, lerp(40, sx, k), lerp(170, sy, k), ` ${fade(Math.min(1, (0.5 - u) * 12))}`)}</g>`; }
      else { const k = ease.inOut((u - 0.5) / 0.5); b += at(AMP, lerp(sx, 440, k), lerp(sy, 170, k), ` ${fade(Math.min(1, (u - 0.5) * 12))}`); }
    }
    b += text(16, 100, 'cyclic AMP', 'sm b', 'start');
    b += text(464, 100, 'AMP: no message', 'sm b', 'end');
    b += text(240, 262, 'phosphodiesterase', 'sm b');
    b += text(240, 300, 'the level of cyclic AMP:', 'xs muted') + text(240, 322, 'made by the cyclase, cleared here', 'xs muted');
    return svg('Phosphodiesterase, an enzyme, in the middle. Cyclic AMP molecules drift in from the left, and plain AMP, which carries no message, leaves on the right: the enzyme opens cyclic AMP\'s ring.', b, { h: 340 });
  },
};

function familiesStill() {
  const s = 1.2, my = 110, xs = [84, 240, 390];
  let b = backdrop(360, my, s) + membrane(xs.map(x => [x, 26]), my, s);
  const rows = { gs: ['cyclase on', '↑ cyclic AMP'], gi: ['cyclase braked', '↓ cyclic AMP'], gq: ['phospholipase C', '↑ IP3, calcium'] };
  ['gs', 'gi', 'gq'].forEach((k, i) => {
    const x = xs[i];
    let c = receptor({ x, y: my, s, g: 0 }).svg;
    c += text(x, 42, { gs: 'Gs', gi: 'Gi', gq: 'Gq' }[k], 'lg b');
    c += arrowFixed([x + 10, 182], [x + 10, 214], { col: INK, w: 2.5 });
    c += text(x, 246, rows[k][0], 'xs b') + text(x, 274, rows[k][1], 'sm b blue');
    b += `<g data-part="${k}">${c}</g>`;
  });
  b += text(240, 338, 'each receptor shown with its main family', 'xs muted');
  return svg('Three receptors side by side, each with its main G protein family. Gs: adenylyl cyclase switched on, cyclic AMP up. Gi: the same cyclase braked, cyclic AMP down. Gq: phospholipase C switched on, IP3 and then calcium up.', b, { h: 360 });
}

const LX = 272;
const plcScene = {
  duration: 3800,
  stages: [[0, 'Gq works phospholipase C'], [0.3, 'the lipid is cut'], [0.5, 'IP3 drifts off']],
  render(t) {
    const cut = span(t, 0.3, 0.45), drift = ease.inOut(span(t, 0.5, 0.92));
    let b = backdrop(360) + membrane([[RX, 34], [EX, 12], [LX, 8]]);
    const en = membraneEnzyme({ glow: 1, part: 'plc' });
    const r = receptor({ ligand: 'noradrenaline', g: 1 });
    b += en.svg + r.svg + nucleotide(r, 'GTP');
    // the lipid: two tails in the membrane, its glycerol at the inner surface, IP3 as its head
    const gy = MY + 14;
    b += `<g data-part="dag">${cut > 0 ? `<circle cx="${LX}" cy="${gy}" r="13" fill="${P.ui.blueWash}" fill-opacity="${f(0.9 * cut)}"/>` : ''}<path d="M${LX - 4} ${gy} L${LX - 5} ${MY - 16} M${LX + 4} ${gy} L${LX + 6} ${MY - 6} L${LX + 3} ${MY - 16}" fill="none" stroke="${P.lipidHead.line}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${LX}" cy="${gy}" r="5" fill="${P.lipid.base}" stroke="${P.lipid.line}" stroke-width="1.3"/></g>`;
    const hx = lerp(LX, 340, drift), hy = lerp(gy + 18, 296, drift);
    if (cut < 1) b += `<path d="M${LX} ${gy + 5} L${f(hx)} ${f(hy - 9)}" stroke="${P.po4.line}" stroke-width="1.6" ${fade(1 - cut)}/>`;
    b += at(IP3, hx, hy);
    b += text(16, 30, 'outside the cell', 'sm b', 'start');
    b += text(464, 76, 'DAG stays in the membrane', 'xs b', 'end') + leader([380, 84], [LX + 2, MY - 10]);
    b += named(16, 330, 'phospholipase C', 'sm b', 'start', [EX - 18, MY + 74]);
    b += `<g ${fade(span(t, 0.6, 0.85))}>${text(464, 340, 'IP3 drifts off', 'sm b blue', 'end')}</g>`;
    return svg('Hormone bound, Gq alpha sits against phospholipase C under the membrane. The enzyme cuts a membrane lipid in two: DAG, its tails and backbone, stays in the membrane, and IP3, a ring carrying three phosphates, drifts off into the cell\'s fluid.', b, { h: 360 });
  },
};

const STORE_CA = spread(53, 30, [30, 84, 310, 120], 21);
const storeScene = {
  duration: 4200,
  stages: [[0, 'IP3 arrives'], [0.32, 'channels open'], [0.45, 'calcium floods out']],
  render(t) {
    const dock = ease.inOut(span(t, 0.05, 0.32)), open = span(t, 0.32, 0.45), lv = lerp(1, 8, ease.inOut(span(t, 0.45, 0.95)));
    let b = `<rect x="0" y="0" width="480" height="404" fill="${P.cytoplasm.hi}"/>`;
    // shift the store's art up: the sac sits at 250 to 298 here
    const sac = `<g transform="translate(0 -72)">${erSac(open)}${ER_CA.slice(0, Math.max(5, Math.round(12 - (lv - 1)))).map(([x, y]) => at(CA, x, y)).join('')}</g>`;
    b += `<g data-part="calcium">${STORE_CA.slice(0, Math.round(3 * lv)).map(([x, y]) => at(CA, x, y)).join('')}</g>`;
    b += sac;
    b += [120, 250].map(x => at(IP3, x + 22, lerp(60, 222, dock))).join('');
    b += meter({ level: lv, ghost: 1, max: 9, x: 404, y0: 112, h: 180, label: 'calcium', mat: P.ca, part: 'calcium' });
    b += text(16, 30, 'IP3 reaches the store', 'sm b', 'start');
    b += text(186, 336, 'endoplasmic reticulum:', 'sm b') + text(186, 360, 'the calcium store', 'sm b');
    b += `<g ${fade(span(t, 0.55, 0.85))}>${text(16, 396, 'calcium floods into the cell\'s fluid', 'sm b blue', 'start')}</g>`;
    return svg('Inside a cell: the endoplasmic reticulum, a lilac membrane sac holding teal calcium. IP3 molecules bind two channels in its membrane and open them; calcium floods out into the cell\'s fluid, and a meter on the right rises to several times its resting level.', b, { h: 404 });
  },
};

/* ---------- What changes it ---------- */
const M = {};
function buildModels() { for (const k of Object.keys(STATES)) M[k] = solve(STATES[k]); }
const times = l => `${l.toFixed(1)} times rest`;
const dirOf = (v, tol = 0.02) => (v > 1 + tol ? 'up' : v < 1 - tol ? 'down' : 'same');
const CHANGES = {
  gs: { family: 'gs', ligand: 'noradrenaline', title: 'Gs: adrenaline at a beta-1 receptor', sub: 'a heart pacemaker cell', words: '↑ cyclic AMP rises' },
  gi: { family: 'gi', ligand: 'ach', title: 'Gi: acetylcholine at an M2 receptor', sub: 'a heart pacemaker cell', words: '↓ cyclic AMP falls', gMax: 0.75 },
  gq: { family: 'gq', ligand: 'noradrenaline', title: 'Gq: noradrenaline at alpha-1', sub: 'a smooth muscle cell in a vessel wall', words: '↑ calcium rises' },
  cholera: { family: 'gs', ligand: null, title: 'Cholera toxin: Gs locked on', sub: 'a gut lining cell, no hormone bound', words: '↑ cyclic AMP rises and stays high' },
  pertussis: { family: 'gi', ligand: 'ach', title: 'Pertussis toxin: Gi locked off', sub: 'the same acetylcholine signal', words: '↑ cyclic AMP no longer falls', gMax: 0.75 },
};
function changeFrame(kind, t) {
  const c = CHANGES[kind], m = M[kind], gq = c.family === 'gq', gMax = c.gMax ?? 1;
  const o = { family: c.family, ligand: c.ligand, title: c.title, sub: c.sub, words: c.words, wordsOp: span(t, 0.72, 0.9), ghostG: 0 };
  const rise = ease.inOut(span(t, 0.45, 0.95));
  if (kind === 'pertussis') {
    // the normal cell's response to the same signal at t = 0; the toxin's cell at t = 1
    const back = ease.inOut(span(t, 0.18, 0.5)), normal = solve({ gi: 1 }).camp;
    Object.assign(o, { bound: 1, g: gMax * (1 - back), ghostG: gMax, tag: span(t, 0.04, 0.18), nuc: t < 0.32 ? 'GTP' : 'GDP', nucOp: t < 0.32 ? 1 - span(t, 0.2, 0.32) : span(t, 0.32, 0.44), level: lerp(normal, m.camp, ease.inOut(span(t, 0.4, 0.9))), ghostLevel: normal, note: ['Gi stays off', span(t, 0.5, 0.7)] });
    return o;
  }
  if (kind === 'cholera') {
    Object.assign(o, { bound: 0, g: ease.inOut(span(t, 0.35, 0.6)), tag: span(t, 0.04, 0.2), nuc: t < 0.3 ? 'GDP' : 'GTP', nucOp: t < 0.3 ? 1 - span(t, 0.22, 0.3) : span(t, 0.3, 0.38), level: lerp(1, m.camp, rise), note: ['tag: GTP never split', span(t, 0.2, 0.35)] });
    o.glow = o.g;
    return o;
  }
  const g = gMax * ease.inOut(span(t, 0.3, 0.55));
  Object.assign(o, { bound: ease.inOut(span(t, 0.04, 0.28)), g, glow: g, nuc: t < 0.3 ? 'GDP' : 'GTP', nucOp: t < 0.3 ? 1 - span(t, 0.22, 0.3) : span(t, 0.3, 0.38), level: lerp(1, gq ? m.calcium : m.camp, rise) });
  if (gq) o.ip3 = lerp(1, m.ip3, ease.inOut(span(t, 0.4, 0.8)));
  return o;
}
function changeRows(kind, o) {
  const gq = CHANGES[kind].family === 'gq';
  if (gq) return [['Gq', o.g > 0.5 ? 'up' : 'same', o.g > 0.5 ? 'switched on' : 'off'], ['IP3', dirOf(o.ip3 ?? 1), times(o.ip3 ?? 1)], ['Calcium in the cell', dirOf(o.level), times(o.level)], ['Cyclic AMP', 'same', 'no change']];
  const name = CHANGES[kind].family === 'gs' ? 'Gs' : 'Gi';
  if (kind === 'pertussis') {
    // compared with a healthy cell given the same signal
    const on = o.g > 0.4;
    return [['Gi', on ? 'same' : 'down', on ? 'switched on, as in a healthy cell' : 'stays off'], ['Cyclic AMP', dirOf(o.level / o.ghostLevel), `${times(o.level)}, against ${times(o.ghostLevel)} in a healthy cell`]];
  }
  const on = o.g > 0.5;
  const rows = [[name, on ? 'up' : 'same', on ? 'switched on' : 'off'], ['Cyclic AMP', dirOf(o.level), times(o.level)]];
  if (kind === 'cholera') rows.push(['Chloride and water into the gut', dirOf(o.level), o.level > 1.02 ? 'pouring out' : 'resting']);
  else rows.push(['Pacemaker', dirOf(o.level), o.level > 1.02 ? 'fires sooner: faster heart' : o.level < 0.98 ? 'fires later: slower heart' : 'resting rate']);
  return rows;
}
const CHANGE_LABEL = {
  gs: 'A heart pacemaker cell. Adrenaline binds a beta-1 receptor, Gs alpha takes up GTP and moves against adenylyl cyclase, and cyclic AMP fills the cell: the meter on the right rises to more than four times the dashed resting level.',
  gi: 'A heart pacemaker cell. Acetylcholine binds an M2 receptor, Gi alpha takes up GTP and brakes adenylyl cyclase, marked with a red bar, and cyclic AMP falls: the meter drops to less than half the dashed resting level.',
  gq: 'A smooth muscle cell. Noradrenaline binds an alpha-1 receptor, Gq alpha works phospholipase C, IP3 opens the calcium store below, and calcium fills the cell: the meter rises to several times the dashed resting level.',
  cholera: 'A gut lining cell with no hormone bound. Cholera toxin tags Gs alpha, shown as a red diamond; alpha takes up GTP, moves against adenylyl cyclase from its dashed resting place and stays there, and cyclic AMP climbs to almost six times the dashed resting level.',
  pertussis: 'A pacemaker cell given acetylcholine. Pertussis toxin tags Gi alpha, shown as a red diamond; instead of moving to brake adenylyl cyclase, at its dashed place in a healthy cell, alpha stays docked, and cyclic AMP rises from the healthy cell\'s low dashed level back to about its resting level.',
};
const changeScene = kind => ({
  duration: 4200,
  stages: kind === 'cholera' ? [[0, 'the toxin tags alpha'], [0.3, 'alpha locked on'], [0.45, 'cyclic AMP builds']]
    : kind === 'pertussis' ? [[0, 'a healthy cell\'s response'], [0.18, 'the toxin\'s cell'], [0.4, 'cyclic AMP does not fall']]
    : [[0, 'the hormone binds'], [0.3, 'alpha switched on'], [0.45, 'the messenger changes']],
  render(t) {
    const o = changeFrame(kind, t);
    return { svg: svg(CHANGE_LABEL[kind], pathway(o), { h: H }), readout: readout(changeRows(kind, o)) };
  },
});

/* ---------- Scenes, one per step kind ---------- */
const scenes = {
  outside: outsideStill,
  receptor: () => svg('A close-up of a receptor crossing the membrane: seven sage coils side by side, loops above and below, a binding pocket ringed in blue in its outer half, and loops hanging into the cell.', closeReceptor(0), { h: 340 }),
  binding: {
    duration: 2800,
    stages: [[0, 'the hormone arrives'], [0.55, 'the receptor changes shape']],
    render: t => svg('The same receptor. A bronze hormone molecule comes down into its binding pocket, and the inside end of one coil swings outward, marked with a blue arrow: the receptor has changed shape.', closeReceptor(ease.inOut(span(t, 0.05, 0.6)), { ligand: 'noradrenaline', labels: 'binding', tOp: span(t, 0.55, 0.85) }), { h: 340 }),
  },
  gprotein: gproteinStill,
  switch: switchScene,
  timer: timerScene,
  cyclase: cyclaseScene,
  amplify: amplifyScene,
  pka: pkaScene,
  pde: pdeScene,
  families: familiesStill,
  plc: plcScene,
  store: storeScene,
  gs: changeScene('gs'),
  gi: changeScene('gi'),
  gq: changeScene('gq'),
  cholera: changeScene('cholera'),
  pertussis: changeScene('pertussis'),
};

/* ---------- Explore freely: one cell with all three receptors ---------- */
const XS = [62, 172, 282], XMY = 110, XS_S = 1.3;
const X_CAMP = spread(61, 30, [16, 236, 150, 62], 30), X_CA = spread(67, 30, [186, 236, 140, 62], 19);
function explorePicture(sig, m) {
  let b = backdrop(336, XMY, XS_S) + membrane(XS.map(x => [x, 28]), XMY, XS_S);
  b += `<g data-part="camp">${X_CAMP.slice(0, Math.round(4 * m.camp)).map(([x, y]) => at(CAMP_SM, x, y)).join('')}</g>`;
  b += `<g data-part="calcium">${X_CA.slice(0, Math.round(3 * m.calcium)).map(([x, y]) => at(CA, x, y)).join('')}</g>`;
  const fam = [['gs', 'Gs', 'noradrenaline', m.gsOn, m.rest.gsOn, sig.ctx], ['gi', 'Gi', 'ach', m.giOn, m.rest.giOn, sig.ptx], ['gq', 'Gq', 'noradrenaline', m.gqOn, m.rest.gqOn, 0]];
  fam.forEach(([k, name, col, on, rest, tox], i) => {
    const g = drawnOn(on, rest), r = gpcr({ x: XS[i], y: XMY, s: XS_S, ligand: sig[k] > 0 ? 'agonist' : null, ligandCol: col, gprotein: g, parts: { ligand: 'ligand', gprotein: `gprotein ${k}` } });
    b += r.svg;
    if (g > 0.04) b += artGhost(r.outline({ gprotein: 0 }));
    if (tox > 0) b += tagAt([r.at.alpha[0] + 12, r.at.alpha[1] - 13], 0.4 + 0.6 * tox);
    b += text(XS[i] + 8, 214, name, `sm b${g > 0.3 ? ' blue' : ''}`);
  });
  b += meter({ level: m.camp, max: 6.5, x: 356, y0: 152, h: 136, w: 30, label: 'cAMP', mat: P.adenine, part: 'camp', noArrow: true, short: true });
  b += meter({ level: m.calcium, max: 9, x: 428, y0: 152, h: 136, w: 30, label: 'calcium', mat: P.ca, part: 'calcium', noArrow: true, short: true });
  b += text(16, 326, 'levels: times the resting cell', 'xs muted', 'start');
  b += text(16, 28, 'outside the cell', 'xs muted', 'start');
  return b;
}

const ui = () => ({ gs: $('#sig-gs'), gi: $('#sig-gi'), gq: $('#sig-gq'), ctx: $('#tox-ctx'), ptx: $('#tox-ptx') });
const signals = () => { const u = ui(); return { gs: +u.gs.value / 100, gi: +u.gi.value / 100, gq: +u.gq.value / 100, ctx: +u.ctx.value / 100, ptx: +u.ptx.value / 100 }; };
let cv = null, baseHr = null, selectedState = 'rest';
const pctOn = x => `${Math.round(x * 100)}% on`;
function describe(sig, m) {
  return `Gs ${pctOn(m.gsOn)}, Gi ${pctOn(m.giOn)}, Gq ${pctOn(m.gqOn)}; cyclic AMP ${m.camp.toFixed(2)} times rest, IP3 ${m.ip3.toFixed(2)} times rest, calcium ${m.calcium.toFixed(2)} times rest`;
}
function renderExplore() {
  const sig = signals(), m = solve(sig), u = ui();
  $('#explore-visual').innerHTML = svg(`One cell with Gs, Gi and Gq receptors, drawn over a dashed outline of each alpha's resting place and of the resting messenger levels. Now: ${describe(sig, m)}.`, explorePicture(sig, m), { h: 336 });
  for (const k of ['gs', 'gi', 'gq']) $(`#sig-${k}-out`).textContent = +u[k].value === 0 ? 'none' : `${u[k].value}%`;
  for (const k of ['ctx', 'ptx']) $(`#tox-${k}-out`).textContent = +u[k].value === 0 ? 'none' : `${u[k].value}%`;
  const rate = baseHr != null ? ` · read as a heart pacemaker cell (receptor signals only): ${Math.round(heartRate(baseHr, m.heartCamp))} per min` : '';
  $('#model-results').innerHTML = `<b>Illustrative model output.</b> Share of each alpha switched on: Gs ${esc(pctOn(m.gsOn))}, Gi ${esc(pctOn(m.giOn))}, Gq ${esc(pctOn(m.gqOn))} · cyclic AMP <span data-out="camp">${m.camp.toFixed(2)}</span> × rest · IP3 ${m.ip3.toFixed(2)} × rest · calcium in the cell's fluid ${m.calcium.toFixed(2)} × rest · read as a gut lining cell, chloride secreted ${m.chloride.toFixed(2)} × rest${rate}.`;
}
function setSignals(st) {
  const u = ui();
  for (const k of ['gs', 'gi', 'gq', 'ctx', 'ptx']) u[k].value = Math.round((st[k] || 0) * 100);
}
function syncState() {
  const sig = signals(), match = Object.entries(STATES).find(([, st]) => ['gs', 'gi', 'gq', 'ctx', 'ptx'].every(k => Math.abs((st[k] || 0) - sig[k]) < 1e-9));
  selectedState = match ? match[0] : 'custom';
  const sel = $('#clinical-state');
  if (sel) sel.value = cv && cv.states.some(s => s.id === selectedState) ? selectedState : 'custom';
}
function wireExplore() {
  for (const el of Object.values(ui())) el.addEventListener('input', () => { syncState(); update(); });
  $('#reset').addEventListener('click', () => { setSignals({}); syncState(); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = hi - lo || Math.abs(hi) * 0.4;
  const pad = v.low != null && v.high != null ? sp * 2.6 : sp * 0.9;
  return [lo - pad, hi + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, x) {
  const shown = +fmtV(v, x);
  if (v.low != null && v.high != null) return shown < v.low ? 'below the typical range' : shown > v.high ? 'above the typical range' : 'inside the typical range';
  const rel = (x - v.typical) / v.typical;
  return Math.abs(rel) < 0.03 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value';
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  $('#cv-about').textContent = cv.about;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-reset').addEventListener('click', () => applyState('rest'));
  for (const v of cv.values) {
    const pos = posOf(v), range = v.low != null && v.high != null;
    const row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`;
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the cited range as a shaded band' : 'the cited typical value as a tick'}, and a blue marker for the teaching model`);
    const [lo, hi] = scaleFor(v);
    right.querySelector('.key').textContent = `${range ? `Cited range ${v.display} ${v.unit} (shaded)` : `Cited typical value ${v.display} ${v.unit} (tick; no range given)`} · bar runs ${fmtV(v, lo)} to ${fmtV(v, hi)} · blue line: model`;
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const [id, citation] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    li.textContent = `[${id}] ${citation}`;
    $('#sources').append(li);
  }
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = false; });
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id);
  if (!st) return;
  setSignals(STATES[st.model] || {});
  selectedState = id;
  $('#clinical-state').value = id;
  update();
}
function renderClinical() {
  if (!cv) return;
  const sig = signals(), m = solve(sig);
  $('#clinical-visual').innerHTML = svg(`The teaching model now: ${describe(sig, m)}.`, explorePicture(sig, m), { h: 336 });
  const st = cv.states.find(s => s.id === selectedState);
  $('#state-summary').textContent = st ? `${st.label}. ${st.summary}` : 'Custom settings from Explore freely: no cited state matches, so no directions are shown.';
  $('#state-evidence').innerHTML = st ? `<p>${esc(st.where)} <span>[${esc(st.source)}]</span></p>${st.context ? `<p>${esc(st.context)}</p>` : ''}` : '<p>No cited state matches these settings.</p>';
  const rate = heartRate(baseHr, m.heartCamp);
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    row.querySelector('.reading').textContent = `${fmtV(v, rate)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, rate)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(rate);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]} (${st.label.toLowerCase()})` : 'No direction stated by the cited source';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  buildModels();
  $$('#clinical select, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (typeof data.modelBaseline?.hr !== 'number' || !Array.isArray(data.values) || !Array.isArray(data.states)) throw new Error('no model baseline');
    cv = data;
    baseHr = data.modelBaseline.hr;
    buildClinical();
  } catch (err) {
    cv = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson and Explore freely still run, showing the model's levels relative to the resting cell.`;
  }
  wireExplore();
  syncState();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
