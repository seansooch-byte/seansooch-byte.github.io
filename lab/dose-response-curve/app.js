// Lesson 32: Dose-response: agonists, antagonists and partial agonists. The kit (/lab/kit/kit.js) runs the page;
// this file holds the pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and
// Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: every drug is drug purple, told apart by shape (an agonist a sphere, a partial
//     agonist a half-filled sphere, an antagonist a cap). Receptors are sage, their G proteins lilac. Kit blue is
//     the curve being taught and every change: an arrow, or the words that name it.
//   - The receptor pictures (steps 1 to 3, 8, 9) count receptors from the model: occupancy is the agonist's share
//     of the binding turns, and in the normal tissue the effect equals it.
//   - Every curve is drawn from model.js on one log axis (step 4 starts linear and step 5 stretches it). A
//     "What changes it" step draws the normal full agonist as a dashed grey ghost and morphs the live curve from
//     normal (t = 0) to changed (t = 1), naming what moved with a blue arrow and words.
//   - No reference number lives in this file. The resting rate and the rise the Clinical values tab adds come
//     from clinical-values.json; if it cannot load, that tab says so and the rest of the lesson runs as normal.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, arrowFixed, leader } from '/lab/kit/art/core.js';
import { bilayer, gpcr } from '/lab/kit/art/cell.js';
import { axes, curve, marker } from '/lab/kit/art/chart.js';
import { NORMAL, CHANGES, occupancy, effect, ceiling, ec50, occAtHalf, withChange, between } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, DR = P.drug;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const arrowB = (a, b, w = 3.5) => arrowFixed(a, b, { col: BLUE, w, head: { l: 10, w: 6 } });
const pct = x => `${Math.round(x * 100)}%`;

/* ---------- Drug glyphs, all drug purple, told apart by shape ---------- */
const hl = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${P.ui.white}" fill-opacity=".45"/>`;
const agoG = (x, y, r = 6) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${DR.base}" stroke="${DR.line}" stroke-width="1.25"/>${hl(x - r * 0.35, y - r * 0.35, r * 0.27)}`;
// a partial agonist: the same sphere, its right half pale (it switches the receptor only partly on)
const partG = (x, y, r = 6) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${DR.base}"/><path d="M${f(x)} ${f(y - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + r)} Z" fill="${DR.hi}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${DR.line}" stroke-width="1.25"/>${hl(x - r * 0.4, y - r * 0.35, r * 0.25)}`;
// an antagonist: an upright cap, the shape the art library seats in a receptor's pocket
const antG = (x, y, s = 1) => `<rect x="${f(x - 4.4 * s)}" y="${f(y - 8 * s)}" width="${f(8.8 * s)}" height="${f(16 * s)}" rx="${f(2.6 * s)}" fill="${DR.base}" stroke="${DR.line}" stroke-width="1.25"/><path d="M${f(x - 1.6 * s)} ${f(y - 5 * s)} V${f(y + 4 * s)}" stroke="${DR.hi}" stroke-width="1.25" stroke-linecap="round"/>`;

/* ---------- The membrane patch ---------- */
const half = s => 12 * s;
function backdrop(my, s, inside, h) {
  return `<rect x="0" y="0" width="480" height="${f(my - half(s))}" fill="${P.space.ecf}"/>`
    + `<rect x="0" y="${f(my + half(s))}" width="480" height="${f(inside - my - half(s))}" fill="${P.cytoplasm.hi}"/>`
    + (h > inside ? `<path d="M0 ${f(inside)} H480" stroke="${P.ui.rule}" stroke-width="1.25"/>` : '');
}
// clear: [[x, half-width]] in picture units, where a receptor sits in the membrane
const membrane = (my, s, clear = []) => bilayer({ x1: 0, y1: 0, x2: 480 / s, y2: 0, x: 0, y: my, s, clear: clear.map(([x, w]) => [x / s, w / s]) }).svg;
// One receptor. drug: null | 'agonist' | 'partial' | 'antagonist'; on: how far its G protein is switched on.
function receptor({ x, y, s, drug = null, bound = 1, on = 0, parts = {} }) {
  const lig = drug === 'agonist' ? 'agonist' : drug === 'antagonist' ? 'antagonist' : null;
  const r = gpcr({ x, y, s, ligand: lig, ligandCol: 'drug', bound, gprotein: on, parts: { ligand: 'ligand', ...parts } });
  let out = r.svg;
  if (drug === 'partial') { const [px, py] = r.at.pocket; out += `<g data-part="${parts.receptor || 'partial'}">${partG(px, py, 5.5 * s)}</g>`; }
  return { svg: out, r };
}

/* ---------- Steps 1 and 2: one receptor, close up ---------- */
const S2 = 2.2, MY2 = 180, RX2 = 190, IN2 = 340;
function closeUp({ drug = null, bound = 1, on = 0, step = 1 }) {
  let b = backdrop(MY2, S2, IN2, IN2) + membrane(MY2, S2, [[RX2, 74]]);
  const { svg: rs, r } = receptor({ x: RX2, y: MY2, s: S2, drug, bound, on });
  b += rs;
  const [px, py] = r.at.pocket, [ax, ay] = r.at.alpha;
  b += text(16, 32, 'outside the cell', 'sm b', 'start');
  b += text(16, 326, 'inside the cell', 'sm b', 'start');
  if (step === 1) {
    b += `<g data-part="pocket"><ellipse cx="${f(px)}" cy="${f(py)}" rx="11" ry="19" fill="none" stroke="${BLUE}" stroke-width="2"/></g>`;
    b += text(464, 76, 'binding site', 'sm b', 'end') + leader([350, 82], [px + 10, py - 6]);
    b += text(464, 170, 'receptor', 'sm b', 'end') + leader([380, 176], [RX2 + 46, MY2 + 6]);
    b += text(464, 300, 'G protein', 'sm b', 'end') + leader([376, 306], [ax + 10, ay + 8]);
  } else {
    const [lx, ly] = r.at.ligand;
    b += text(464, 44, 'agonist, a drug', 'sm b purple', 'end') + leader([336, 50], [lx + 6, ly - 4]);
    b += text(464, 170, 'receptor', 'sm b', 'end') + leader([380, 176], [RX2 + 46, MY2 + 6]);
    const lit = on > 0.5;
    b += text(464, 300, lit ? 'G protein: switched on' : 'G protein: waiting', `sm b${lit ? ' blue' : ''}`, 'end') + leader([lit ? 262 : 290, 306], [ax + 4, ay + 10]);
  }
  return b;
}
function agonistScene() {
  return {
    duration: 4600, loop: true, rest: 0.6,
    stages: [[0, 'the drug arrives'], [0.3, 'the receptor switches on'], [0.75, 'the drug lets go']],
    render(t) {
      const bound = t < 0.75 ? span(t, 0.04, 0.3) : 1 - span(t, 0.78, 0.96);
      const on = t < 0.75 ? span(t, 0.3, 0.5) : 1 - span(t, 0.75, 0.92);
      return svg('A receptor crossing the cell membrane, close up. A purple agonist sphere drifts down into the binding site on its outer face; one of the receptor\'s coils swings out and the G protein underneath slides away, lit blue: switched on. Then the drug lets go and the G protein returns, switched off.', closeUp({ drug: 'agonist', bound, on, step: 2 }), { h: IN2 });
    },
  };
}

/* ---------- Steps 3 and 9: a row of receptors ---------- */
const RS = 0.75, RMY = 150, RIN = 204, NR = 8;
const RXS = Array.from({ length: NR }, (_, i) => 34 + i * 57);
// which receptor fills first (so filling looks scattered, not left to right)
const ORDER = [3, 6, 1, 4, 7, 0, 5, 2];
// slots for free drug molecules outside the cell: 12 columns, 2 rows, jittered
const SLOTS = Array.from({ length: 24 }, (_, i) => { const c = i % 12, r = Math.floor(i / 12); return [28 + c * 38 + (r ? 19 : 0) + ((i * 7) % 5) - 2, 62 + r * 30 + ((i * 11) % 7) - 3]; });
function bars(rows, y0 = 228) {
  // rows: [label, share 0..1, value words, colour material, part]
  return rows.map(([label, share, words, mat, part], i) => {
    const y = y0 + i * 66, x = 172, w = 270;
    return `<g data-part="${part}">${text(16, y + 15, label, 'xs b', 'start')}`
      + `<rect x="${x}" y="${y}" width="${w}" height="20" rx="4" fill="${P.ui.paper}" stroke="${P.ui.rule}" stroke-width="1.5"/>`
      + `<rect x="${x + 2}" y="${y + 2}" width="${f(Math.max(0, (w - 4) * share))}" height="16" rx="3" fill="${mat.fill}" stroke="${mat.line}" stroke-width="1.25"/>`
      + `${text(x, y + 44, words, 'xs', 'start')}</g>`;
  }).join('');
}
const OCC_BAR = { fill: DR.hi, line: DR.line }, EFF_BAR = { fill: P.ui.blueWash, line: BLUE };
function occupancyPicture(t) {
  // the concentration climbs on a log scale from a twentieth to ten times the normal agonist's binding constant
  // (from 0 to 7 of the 8 receptors filled)
  const c = 10 ** lerp(-1.3, 1, ease.inOut(span(t, 0.05, 0.92)));
  const filled = Math.round(NR * occupancy(c, NORMAL)), held = new Set(ORDER.slice(0, filled));
  let b = backdrop(RMY, RS, RIN, 360) + membrane(RMY, RS, RXS.map(x => [x, 20]));
  const free = clamp(Math.round(2 + 3.2 * Math.log10(c * 20)), 1, 12);
  b += SLOTS.slice(0, 24).filter((_, i) => i % 2 === 0).slice(0, free).map(([x, y]) => agoG(x, y)).join('');
  RXS.forEach((x, i) => { b += receptor({ x, y: RMY, s: RS, drug: held.has(i) ? 'agonist' : null, on: held.has(i) ? 1 : 0 }).svg; });
  b += text(16, 30, `drug around the cell: ${c < 0.4 ? 'a little' : c < 4 ? 'more' : 'a lot'}`, 'sm b', 'start');
  b += bars([
    ['receptors filled', filled / NR, `${filled} of ${NR} hold the drug`, OCC_BAR, 'occupancy'],
    ['effect', filled / NR, `${pct(filled / NR)} of the top effect`, EFF_BAR, 'effect'],
  ]);
  return b;
}
// Step 9: the same antagonist throughout; the agonist climbs from 1 to 100 times its binding constant.
const COMP = CHANGES.competitive.comp;
function competeCounts(a) {
  const tot = 1 + a + COMP, nA = Math.round(NR * a / tot);
  return { nA, nB: Math.min(NR - nA, Math.round(NR * COMP / tot)) };
}
function competePicture(t) {
  const a = 10 ** lerp(0, 2, ease.inOut(span(t, 0.08, 0.9)));
  const { nA, nB } = competeCounts(a);
  let b = backdrop(RMY, RS, RIN, 360) + membrane(RMY, RS, RXS.map(x => [x, 20]));
  // free molecules: the antagonist on fixed slots, the agonist filling the others as it is raised
  const antSlots = SLOTS.filter((_, i) => i % 4 === 1), agoSlots = SLOTS.filter((_, i) => i % 4 !== 1);
  b += antSlots.map(([x, y]) => antG(x, y)).join('');
  b += agoSlots.slice(0, clamp(Math.round(2 + 7 * Math.log10(a)), 2, agoSlots.length)).map(([x, y]) => agoG(x, y)).join('');
  RXS.forEach((x, i) => {
    const k = ORDER.indexOf(i), drug = k < nA ? 'agonist' : k >= NR - nB ? 'antagonist' : null;
    b += receptor({ x, y: RMY, s: RS, drug, on: drug === 'agonist' ? 1 : 0, parts: { drug: 'antag-held' } }).svg;
  });
  b += agoG(22, 24) + text(36, 30, 'agonist: raised', 'sm b purple', 'start');
  b += antG(300, 24) + text(312, 30, 'antagonist: same', 'sm b purple', 'start');
  b += bars([
    ['agonist holds', nA / NR, `${nA} of ${NR}; the antagonist holds ${nB}`, OCC_BAR, 'occupancy'],
    ['effect', nA / NR, `${pct(nA / NR)} of the top effect`, EFF_BAR, 'effect'],
  ]);
  return b;
}

/* ---------- Step 8: three drugs on three receptors ---------- */
function kindsPicture() {
  const s = 1.3, my = 140, inside = 212;
  const cols = [[86, 'agonist', 1, 'full', 'full agonist', 'fully on', 'blue'], [240, 'partial', 0.5, 'partial', 'partial agonist', 'partly on', 'blue'], [394, 'antagonist', 0, 'antag', 'antagonist', 'stays off', 'muted']];
  let b = backdrop(my, s, inside, 300) + membrane(my, s, cols.map(([x]) => [x, 40]));
  for (const [x, drug, on, part, name, state, cls] of cols) {
    b += receptor({ x, y: my, s, drug, on, parts: { receptor: part, gprotein: part, ligand: part, drug: part } }).svg;
    b += text(x, 246, name, 'sm b purple') + text(x, 272, state, `xs b ${cls}`);
  }
  b += text(16, 30, 'outside the cell', 'xs muted', 'start');
  return b;
}

/* ---------- The graph: one log axis for every curve ---------- */
const G = { x0: 78, x1: 452, y0: 330, yT: 110, d0: -3, d1: 3 };
const GH = 394;
const xLog = c => G.x0 + (Math.log10(c) - G.d0) / (G.d1 - G.d0) * (G.x1 - G.x0);
const xLin = c => G.x0 + c / 10 * (G.x1 - G.x0);
const yOf = e => G.y0 - e * (G.y0 - G.yT);
const CS = Array.from({ length: 145 }, (_, i) => 10 ** (G.d0 + i * (G.d1 - G.d0) / 144));
// mode: 0 a linear axis from 0 to 10, 1 the log axis; upTo: draw only to this concentration
function curvePts(p, { mode = 1, upTo = Infinity } = {}) {
  const out = [[lerp(G.x0, xLog(CS[0]), mode), G.y0]];
  for (const c of CS) {
    if (c > upTo) break;
    const x = lerp(xLin(c), xLog(c), mode), y = yOf(effect(c, p));
    if (x > G.x1) { const [px, py] = out[out.length - 1]; out.push([G.x1, py + (y - py) * (G.x1 - px) / (x - px)]); break; }
    out.push([x, y]);
  }
  return out;
}
function frame({ mode = 1, title = '', sub = '' } = {}) {
  let b = axes({ x0: G.x0, y0: G.y0, x1: G.x1 + 18, y1: G.yT - 28, ticks: { y: [[0, '0%', G.y0], [0.5, '50%', yOf(0.5)], [1, '100%', G.yT]] } });
  b += text(G.x0 + 12, G.yT - 14, 'effect', 'sm b', 'start');
  let ticks = '';
  for (let d = G.d0; d <= G.d1; d++) { const x = xLog(10 ** d); ticks += `<path d="M${f(x)} ${G.y0} V${G.y0 + 7}" stroke="${INK}" stroke-width="1.5"/>`; }
  b += `<g data-part="ticks" ${fade(mode)}>${ticks}${text(G.x0, 382, 'each tick: ten times more drug', 'xs muted', 'start')}</g>`;
  b += text(464, 360, mode >= 0.5 ? 'concentration, log scale' : 'concentration', 'sm b', 'end');
  if (title) b += text(16, 30, title, 'sm b', 'start');
  if (sub) b += text(16, 54, sub, 'xs muted', 'start');
  return b;
}
const liveCurve = (p, o) => `<g data-part="curve">${curve(curvePts(p, o), { role: 'live', col: BLUE })}</g>`;
const ghostCurve = (p = NORMAL) => `<g data-ghost="normal">${curve(curvePts(p), { role: 'ghost' })}</g>`;

function curveScene() {
  return {
    duration: 3400,
    render(t) {
      const upTo = 10 * ease.inOut(span(t, 0.05, 0.9)) + 1e-3;
      const pts = curvePts(NORMAL, { mode: 0, upTo }), [dx, dy] = pts[pts.length - 1];
      let b = frame({ mode: 0, title: 'the effect at each concentration' });
      b += liveCurve(NORMAL, { mode: 0, upTo }) + marker(dx, dy, { col: BLUE });
      b += `<g ${fade(span(t, 0.75, 0.95))}>${text(452, 186, 'the dose-response curve', 'sm b blue', 'end')}</g>`;
      return svg('A graph of effect against drug concentration on an ordinary scale. A blue curve climbs steeply from zero at first, then bends over and flattens as it nears the top.', b, { h: GH });
    },
  };
}
function logScene() {
  return {
    duration: 3600,
    stages: [[0, 'ordinary scale'], [0.15, 'stretching the low doses'], [0.9, 'log scale']],
    render(t) {
      const mode = ease.inOut(span(t, 0.15, 0.9));
      const b = frame({ mode, title: mode < 0.5 ? 'the same curve, low doses squeezed' : 'the same curve, as an S' }) + liveCurve(NORMAL, { mode });
      return svg('The same dose-response curve as its concentration axis is stretched into a log scale, where each tick means ten times more drug. The bend squeezed into the left corner spreads out, and the curve becomes an S: flat, a steep middle, then flat at the top.', b, { h: GH });
    },
  };
}
function ceilingScene() {
  return {
    duration: 3200, rest: 1,
    render(t) {
      const c = 10 ** lerp(-2, 3, ease.inOut(span(t, 0.05, 0.85)));
      let b = frame({ title: 'more and more drug' });
      b += `<g data-part="ceiling" ${fade(0.35 + 0.65 * span(t, 0.6, 0.9))}><path d="M${G.x0} ${G.yT} H${G.x1}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 4"/>${text(464, G.yT - 14, 'ceiling: efficacy', 'sm b', 'end')}</g>`;
      b += liveCurve(NORMAL) + marker(xLog(c), yOf(effect(c, NORMAL)), { col: BLUE });
      return svg('The S-shaped dose-response curve on a log scale. A dot climbs the curve as the concentration rises, and stops rising at the top, where a dotted line marks the ceiling: the most effect the drug can give, its efficacy.', b, { h: GH });
    },
  };
}
function ec50Scene() {
  return {
    duration: 3000,
    render(t) {
      const xE = xLog(ec50(NORMAL)), yH = yOf(0.5), a = span(t, 0.05, 0.5), v = span(t, 0.5, 0.9);
      let b = frame({ title: 'half of the top effect' });
      b += liveCurve(NORMAL);
      let g = `<path d="M${G.x0} ${f(yH)} H${f(lerp(G.x0, xE, a))}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
      if (v > 0) g += `<path d="M${f(xE)} ${f(yH)} V${f(lerp(yH, G.y0, v))}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
      if (a >= 1) g += marker(xE, yH, { col: BLUE });
      g += `<g ${fade(v * 1.5)}>${text(xE + 10, G.y0 - 12, 'EC50', 'sm b blue', 'start')}</g>`;
      b += `<g data-part="ec50">${g}</g>` + text(G.x0 + 8, yH - 10, 'half the top', 'xs b', 'start');
      return svg('The S-shaped dose-response curve. A dashed line runs across from half the top effect to the curve, then straight down to the concentration axis: that concentration is the EC50, in the steep middle of the S.', b, { h: GH });
    },
  };
}

/* ---------- What changes it: the normal full agonist as a ghost, the change as the live curve ---------- */
// what moved and where its words sit (see the comments: each spot is clear of both curves at every t)
const CHANGE = {
  full: { title: 'a second, more potent full agonist', move: 'left',
    label: 'A second full agonist that binds ten times more tightly, drawn over the dashed curve of the normal one: the blue curve slides left to a lower EC50 and reaches the same ceiling.' },
  partial: { title: 'a partial agonist', move: 'down',
    label: 'A partial agonist, drawn over the dashed curve of a full agonist: the blue curve keeps the same EC50 but its ceiling falls to half the top effect.' },
  competitive: { title: 'agonist with a competitive antagonist', move: 'right',
    label: 'The agonist with a competitive antagonist present, drawn over the dashed normal curve: the blue curve slides right, needing ten times the concentration for each effect, and still reaches the same ceiling.' },
  noncompetitive: { title: 'agonist with a noncompetitive antagonist', move: 'down',
    label: 'The agonist with a noncompetitive antagonist present, drawn over the dashed normal curve: the blue curve keeps the same EC50 but its ceiling falls to 40% of the top effect.' },
  spare: { title: 'the agonist in a tissue with spare receptors', move: 'left',
    label: 'The agonist in a tissue with ten times the receptors it needs, drawn over the dashed curve, which is both the normal effect and the share of receptors filled: the blue curve slides left and reaches the same ceiling; at its half effect only 1 receptor in 20 is filled.' },
};
function compareRows(p) {
  const top = ceiling(p), r = ec50(p) / ec50(NORMAL);
  const ceil = Math.abs(top - 1) < 0.005 ? ['same', `${pct(top)}, the same`] : [top > 1 ? 'up' : 'down', `falls to ${pct(top)}`];
  const pot = Math.abs(r - 1) < 0.02 ? ['same', 'the same'] : r < 1 ? ['down', `${f(1 / r)} times lower: more potent`] : ['up', `${f(r)} times higher: less potent`];
  return [['Ceiling (efficacy)', ...ceil], ['EC50', ...pot]];
}
function changeWords(kind, p, op) {
  const xG = xLog(ec50(NORMAL)), xN = xLog(ec50(p)), yH = yOf(0.5), top = yOf(ceiling(p));
  let s = '';
  if (CHANGE[kind].move === 'left') {
    // below and right of both curves: they rise to the left of the ghost's middle
    if (xG - xN > 14) s += arrowB([xG - 4, yH], [xN + 6, yH]);
    s += text(xG + 8, yH + 34, 'curve slides left', 'sm b blue', 'start');
    s += text(464, G.yT - 14, 'ceiling holds', 'xs b', 'end');
  } else if (CHANGE[kind].move === 'right') {
    // above and left of both curves: they are still low there
    if (xN - xG > 14) s += arrowB([xG + 4, yH], [xN - 6, yH]);
    s += text(G.x0 + 10, 166, 'curve slides right', 'sm b blue', 'start');
    s += text(464, G.yT - 14, 'ceiling holds', 'xs b', 'end');
  } else {
    // under the lowered ceiling, at the right, where the curve has flattened
    if (top - G.yT > 16) s += arrowB([432, G.yT + 5], [432, top - 6]);
    s += text(464, top + 46, 'ceiling falls', 'sm b blue', 'end');
    s += text(464, top + 70, kind === 'partial' ? 'to half; EC50 stays put' : 'EC50 stays put', 'xs b', 'end');
  }
  return `<g data-delta ${fade(op)}>${s}</g>`;
}
function spareMark(p, op) {
  // at the new half effect, how many receptors are filled: read off the dashed curve (the normal effect is occupancy)
  const c = ec50(p), x = xLog(c), occ = occupancy(c, p), y = yOf(occ);
  return `<g data-part="spare-mark" ${fade(op)}><path d="M${f(x)} ${f(yOf(0.5) + 8)} V${f(y - 7)}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>${marker(x, y, { col: INK, r: 4.5 })}`
    + `${text(464, 288, 'at half effect, only 1', 'xs b', 'end')}${text(464, 310, `receptor in ${Math.round(1 / occ)} is filled`, 'xs b', 'end')}</g>`;
}
function changeScene(kind) {
  const to = withChange(kind), c = CHANGE[kind];
  return {
    duration: 3600,
    stages: [[0, 'normal'], [0.12, 'the change'], [0.85, 'changed']],
    render(t) {
      const e = ease.inOut(span(t, 0.12, 0.85)), p = between(NORMAL, to, e), op = span(t, 0.55, 0.85);
      let b = frame({ title: c.title, sub: kind === 'spare' ? 'dashed: receptors filled, also the normal effect' : 'dashed grey: the normal full agonist' });
      b += ghostCurve() + liveCurve(p) + changeWords(kind, p, op);
      if (kind === 'spare') b += spareMark(p, op);
      return { svg: svg(c.label, b, { h: GH }), readout: readout(compareRows(p)) };
    },
  };
}

/* ---------- Scenes, one per step kind ---------- */
const scenes = {
  receptor: () => svg('A receptor protein threading back and forth through the cell membrane, close up, with fluid outside above and the cell inside below. A blue ring marks the binding site, a pocket on its outer face; a G protein waits underneath it, inside the cell.', closeUp({ step: 1 }), { h: IN2 }),
  agonist: agonistScene(),
  occupancy: { duration: 5200, render: t => svg('A row of eight receptors in a cell membrane, with purple agonist molecules outside. As more drug is added, more receptors hold a molecule and switch on, up to seven of eight. Two bars below rise together: receptors filled and effect.', occupancyPicture(t), { h: 360 }) },
  curve: curveScene(),
  logscale: logScene(),
  ceiling: ceilingScene(),
  ec50: ec50Scene(),
  kinds: () => svg('Three receptors side by side in a membrane. A full agonist sphere sits in the first, whose G protein is switched fully on; a half-pale partial agonist sits in the second, whose G protein is only partly on; an antagonist cap sits in the third, whose G protein stays off.', kindsPicture(), { h: 300 }),
  compete: { duration: 5200, render: t => svg('A row of eight receptors with the same amount of purple antagonist caps outside and more and more agonist spheres added. At first the antagonist holds seven of the eight receptors; by the end the agonist holds seven and the antagonist one. The bars for receptors held and effect rise.', competePicture(t), { h: 360 }) },
  full: changeScene('full'),
  partial: changeScene('partial'),
  competitive: changeScene('competitive'),
  noncompetitive: changeScene('noncompetitive'),
  spare: changeScene('spare'),
};

/* ---------- Explore freely ---------- */
const SPARE = [1, 2, 5, 10, 20];
const ui = () => ({ agonist: $('#agonist'), affinity: $('#affinity'), conc: $('#conc'), comp: $('#comp'), nonc: $('#nonc'), spare: $('#spare') });
function settings() {
  const u = ui();
  return { eff: u.agonist.value === 'partial' ? 0.5 : 1, k: 10 ** -+u.affinity.value, comp: 10 ** +u.comp.value - 1, nonc: +u.nonc.value / 100, n: SPARE[+u.spare.value] };
}
const concOf = v => v <= -3.4 ? 0 : 10 ** v;
const concText = v => v <= -3.4 ? 'none' : `${+v === 0 ? '1' : f(10 ** v) >= 1 ? f(10 ** v) : `1/${f(10 ** -v)}`} × the normal half-fill level`;
const timesText = r => Math.abs(r - 1) < 0.02 ? 'the same' : r < 1 ? `${f(1 / r)} times lower` : `${f(r)} times higher`;
const isNormal = p => p.eff === 1 && Math.abs(p.k - 1) < 1e-9 && p.comp === 0 && p.nonc === 0 && p.n === 1;
function picture(p, c) {
  let b = frame({ title: 'your settings', sub: 'dashed grey: the normal full agonist' }) + ghostCurve() + liveCurve(p);
  if (c > 0) b += marker(xLog(clamp(c, 1e-3, 1e3)), yOf(effect(clamp(c, 1e-3, 1e3), p)), { col: BLUE });
  return b;
}
function renderExplore() {
  const u = ui(), p = settings(), c = concOf(+u.conc.value);
  const top = ceiling(p), r = ec50(p) / ec50(NORMAL), oh = occAtHalf(p);
  $('#explore-visual').innerHTML = svg(`Your curve drawn over the dashed normal full agonist: ceiling ${pct(top)}, EC50 ${timesText(r)} than normal${c > 0 ? `; the dot sits at ${pct(effect(c, p))} effect` : ''}.`, picture(p, c), { h: GH }) + readout(compareRows(p));
  $('#affinity-out').textContent = +u.affinity.value === 0 ? 'as the normal agonist' : `${timesText(10 ** -+u.affinity.value).replace('lower', 'tighter').replace('higher', 'looser')}`;
  $('#conc-out').textContent = concText(+u.conc.value);
  $('#comp-out').textContent = +u.comp.value === 0 ? 'none' : `enough to shift ${f(10 ** +u.comp.value)} times`;
  $('#nonc-out').textContent = +u.nonc.value === 0 ? 'none' : `${u.nonc.value}% of receptors out of action`;
  $('#spare-out').textContent = p.n === 1 ? 'normal number' : `${p.n} times normal`;
  const rows = [
    ['Ceiling', `${pct(top)} of the tissue's top`],
    ['EC50', Math.abs(r - 1) < 0.02 ? "the same as the normal agonist's" : `${timesText(r)} than the normal agonist's`],
    ['Receptors filled at half effect', oh == null ? 'none' : `${(oh * 100).toFixed(oh < 0.1 ? 1 : 0)}%`],
  ];
  let html = rows.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ') + '.';
  html += c > 0 ? ` <b>At the dot</b>: the agonist holds ${(occupancy(c, p) * 100).toFixed(1)}% of the receptors and the effect is ${(effect(c, p) * 100).toFixed(1)}% of the top.` : ' No agonist at the dot: raise the concentration.';
  $('#model-results').innerHTML = html;
}
function resetControls(conc = 0) {
  const u = ui();
  u.agonist.value = 'full'; u.affinity.value = 0; u.comp.value = 0; u.nonc.value = 0; u.spare.value = 0; u.conc.value = conc;
}
function wireExplore() {
  for (const el of Object.values(ui())) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { syncState(); update(); });
  $('#reset').addEventListener('click', () => { resetControls(0); syncState(); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
let cv = null, selectedState = 'start';
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
const rangeText = v => `${v.display} ${v.unit}`;
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = hi - lo || Math.abs(hi) * 0.4;
  const pad = v.low != null && v.high != null ? sp * 1.1 : sp * 0.6;
  return [lo - pad, hi + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, x) {
  const shown = +fmtV(v, x);
  if (v.low != null && v.high != null) return shown < v.low ? 'below the typical range' : shown > v.high ? 'above the typical range' : 'inside the typical range';
  const rel = (x - v.typical) / v.typical;
  return Math.abs(rel) < 0.05 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value';
}
// The model's reading for the tab: the sinus node's rate, from the effect at the chosen concentration.
const modelValues = () => { const p = settings(), c = concOf(+ui().conc.value); return { hr: cv.modelBaseline.hr + cv.modelBaseline.hrRise * effect(c, p) }; };
// 'start' is the model's own starting point (no agonist added): a model setting, not a cited state, so it lives
// here rather than in the data file's states and never shows a direction.
const START = 'start';
function syncState() {
  if (!cv) return;
  const p = settings(), v = +ui().conc.value;
  const match = isNormal(p) && cv.states.find(s => Math.abs(v - s.model.conc) < 1e-9);
  selectedState = match ? match.id : isNormal(p) && v <= -3.4 ? START : 'custom';
  $('#clinical-state').value = selectedState;
}
function applyState(id) {
  if (id === START) { resetControls(-3.5); selectedState = START; update(); return; }
  const st = cv.states.find(s => s.id === id);
  if (!st) return;
  resetControls(st.model.conc);
  ui().agonist.value = st.model.agonist || 'full';
  selectedState = id;
  update();
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = `<option value="${START}">Model starting point, no agonist added (not a cited state)</option>`
    + `<optgroup label="Cited states">${cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</optgroup>`
    + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-conc').addEventListener('input', e => { ui().conc.value = e.target.value; syncState(); update(); });
  $('#clinical-reset').addEventListener('click', () => applyState(START));
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
    right.querySelector('.key').textContent = `${range ? `Cited range ${rangeText(v)} (shaded)` : `Cited typical value ${rangeText(v)} (tick; no range given)`} · bar runs ${fmtV(v, lo)} to ${fmtV(v, hi)} · blue line: model`;
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
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = false; });
}
function renderClinical() {
  if (!cv) return;
  const u = ui(), p = settings(), c = concOf(+u.conc.value), m = modelValues();
  $('#clinical-visual').innerHTML = svg(`The teaching model's curve now: ceiling ${pct(ceiling(p))}, and at the chosen concentration an effect of ${pct(effect(c, p))}.`, picture(p, c), { h: GH });
  $('#clinical-conc').value = u.conc.value;
  $('#clinical-conc-label').textContent = concText(+u.conc.value);
  const st = cv.states.find(s => s.id === selectedState);
  const start = selectedState === START;
  $('#state-summary').textContent = st ? `${st.label}: ${st.summary} Model effect ${pct(effect(c, p))} of the top (illustrative).`
    : start ? "The teaching model's starting point: no agonist added, so the effect is 0% and the rate sits at a model setting chosen inside the cited sinus node range. A model condition, not a cited state, so no directions are shown."
    : `Custom settings from Explore freely: model effect ${pct(effect(c, p))} of the top (illustrative). No cited state matches, so no directions are shown.`;
  $('#state-evidence').innerHTML = st ? `<p>${esc(st.context)} <span>${esc(st.where)} [${esc(st.source)}]</span></p>`
    : start ? `<p>${esc(cv.modelBaseline.about)}</p>` : '<p>Custom settings: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m[v.modelKey];
    row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? 'No cited state selected' : d ? `${DIRECTION[d]} (${st.label.toLowerCase()})` : 'No direction stated by the cited source';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  wireExplore();
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const k of ['hr', 'hrRise']) if (typeof data.modelBaseline?.[k] !== 'number') throw new Error(`no model ${k}`);
    cv = data;
    buildClinical();
  } catch (err) {
    cv = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson and Explore freely work without it.`;
  }
  syncState();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
