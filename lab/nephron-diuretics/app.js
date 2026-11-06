// Lesson 2: The nephron and diuretics. The kit (/lab/kit/kit.js) runs the page; this file is the
// pictures and the Clinical values and Explore freely tabs. The teaching model is model.js (untouched by
// the pictures) and the nephron drawing is nephron.js.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease as EASE, span, svg, text, lines, circle, rect, path, arrowTo, part, readout, esc } from '/lab/kit/draw.js';
import { run, calibrate, NO_DRUG, DRUGS, P, CAL, MODEL_NOTES } from './model.js';
import * as N from './nephron.js?v=2';

const ease = EASE.out, easeIO = EASE.inOut;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const H = 404;                  // height of every full-nephron picture
let cv = null, BASE = null, BV = null;   // reference data, the model with no drug, and its picture sizes

/* ---------- Words: which way a value moved ---------- */
// The same rule as the Clinical values tab: a 2 % relative change counts as a change.
const dir = (now, was) => { const tol = Math.max(Math.abs(was) * .02, 1e-6); return Math.abs(now - was) < tol ? 'same' : now > was ? 'up' : 'down'; };
const WORD = { up: 'more', down: 'less', same: 'about the same' };

/* ---------- Pictures that need the data file ---------- */
const missing = () => svg('This picture could not be drawn because the lesson data did not load.',
  text(240, 150, 'This picture needs the lesson data,', 'sm', 'middle') + text(240, 176, 'which did not load.', 'sm') + text(240, 214, 'Reload the page to try again.', 'sm b'), { h: 260 });
const needData = fn => (...a) => (BASE ? fn(...a) : missing());

/* ---------- Step 1: the nephron ---------- */
function kidneyBean() {
  const s = `<path d="M414 34 C452 28 472 62 468 98 C464 134 440 154 414 150 C398 148 396 130 404 120 C410 112 410 88 402 80 C394 72 382 74 378 62 C374 46 390 38 414 34 Z" fill="#f6dcd8" stroke="${C.red}" stroke-width="3" stroke-linejoin="round"/>`
    + [[428, 52, 446, 60], [434, 76, 454, 80], [434, 102, 454, 104], [428, 126, 446, 132]].map(([a, b, c, d]) => path(`M${a} ${b} L${c} ${d}`, C.red, 2.5)).join('')
    + circle(446, 104, 5, '#ffe29a', C.ink, 1.5);
  return s + text(422, 182, 'one kidney,', 'sm b') + text(422, 204, 'packed with', 'xs') + text(422, 225, 'nephrons', 'xs');
}
const meetPicture = needData(() => {
  let b = N.bands(1, { lit: false }) + N.tube({ parts: 'whole' });
  b += text(N.GLOM.x, 124, 'filter', 'sm b');
  b += text(12, 222, 'one long,', 'sm b', 'start') + text(12, 244, 'folded tube', 'sm b', 'start') + path('M122 236 H150', C.muted, 1.5);
  b += kidneyBean();
  b += arrowTo(354, 374, 404, 374, C.ink, 3) + text(358, 334, 'urine out,', 'sm b', 'start') + text(358, 356, 'to the bladder', 'xs', 'start');
  return svg('One nephron. At top left a round filter sits on a small tuft of blood vessels. One long tube leaves it, winds, dips down in a hairpin loop, climbs back up, winds again and joins a collecting duct that runs down and carries urine out towards the bladder. To the right, a kidney outline is packed with nephrons.', b, { h: H });
});

/* ---------- Step 2: the filter, close up (moving) ---------- */
const CAP = { x: 212, y: 186, r: 128 };
// A Catmull-Rom curve through points, as a polyline.
function smooth(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function track(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum.at(-1);
  return s => {
    const d = clamp(s, 0, 1) * total;
    let j = 0;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const k = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = pts[j], b = pts[j + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
}
const TUFT = smooth([[0, 150], [82, 158], [126, 112], [188, 92], [244, 106], [268, 146], [238, 176], [198, 160], [170, 192], [206, 214], [262, 216], [272, 258], [228, 282], [168, 270], [128, 236], [82, 216], [0, 224]]);
const tuftAt = track(TUFT);
const TUFT_D = TUFT.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
const frac = x => x - Math.floor(x);
function filterPicture(t) {
  let b = '';
  // Bowman's capsule: the cup round the tuft, opening on the right into the tube.
  b += part('filtrate', circle(CAP.x, CAP.y, CAP.r, '#e4e9ff', C.ink, 3)
    + path(`M${CAP.x + CAP.r - 4} ${CAP.y} H474`, C.ink, 22) + path(`M${CAP.x + CAP.r - 8} ${CAP.y} H476`, '#e4e9ff', 15));
  // The tuft of capillaries: blood in at the top left, out at the bottom left.
  b += part('glomerulus', path(TUFT_D, C.red, 22) + path(TUFT_D, '#f6dcd8', 15));
  // Blood cells and proteins ride the capillaries and stay in the blood.
  for (let i = 0; i < 8; i++) {
    const [x, y, a] = tuftAt(frac(t + i / 8));
    b += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="8" ry="5" transform="rotate(${f(a * 180 / Math.PI)} ${f(x)} ${f(y)})" fill="${C.red}" stroke="#fff" stroke-width="1"/>`;
  }
  for (let i = 0; i < 6; i++) { const [x, y] = tuftAt(frac(t + i / 6 + .06)); b += rect(x - 3.5, y - 3.5, 7, 7, C.green, '#fff', 1); }
  // Water and salt pass out of the capillaries into the cup, then flow round it into the tube.
  let fl = '';
  const n = 16;
  for (let i = 0; i < n; i++) {
    const p = frac(t * 2 + i / n), from = tuftAt(.12 + .76 * frac(i * .618 + .2));
    const th0 = Math.atan2(from[1] - CAP.y, from[0] - CAP.x), rIn = CAP.r - 16;
    let x, y;
    if (p < .2) { const k = p / .2, rr = Math.hypot(from[0] - CAP.x, from[1] - CAP.y); const r = lerp(rr + 12, rIn, k); x = CAP.x + r * Math.cos(th0); y = CAP.y + r * Math.sin(th0); }
    else if (p < .72) { const k = (p - .2) / .52, th = lerp(th0, 0, k); x = CAP.x + rIn * Math.cos(th); y = CAP.y + rIn * Math.sin(th); }
    else { const k = (p - .72) / .28; x = lerp(CAP.x + rIn, 476, k); y = CAP.y; }
    fl += i % 3 === 1 ? N.saltIcon(x, y, 5.5) : N.dropIcon(x, y, 5);
  }
  b += part('filtrate', fl);
  b += text(8, 132, 'blood in', 'sm b', 'start') + text(8, 254, 'blood out', 'sm b', 'start');
  b += text(CAP.x, 40, 'the filter: glomerulus', 'sm b');
  b += text(408, 222, 'filtrate:', 'sm b') + text(408, 244, 'water and salt', 'xs') + text(408, 264, 'into the tube', 'xs');
  b += text(CAP.x, 346, 'blood cells and proteins', 'sm b') + text(CAP.x, 368, 'stay in the blood', 'sm b');
  return b;
}

/* ---------- Step 3: almost all of it goes back (moving) ---------- */
function backPicture(t) {
  const top = 54, bottom = 276, Hc = bottom - top, wcol = 110;
  const urineH = Math.max(3, Hc * BASE.waterOut / 100);
  const cols = [
    { x: 22, a: 'filtered', b: 'each day', fill: '#e4e9ff', stroke: C.blue, h: Hc * ease(span(t, 0, .25)) },
    { x: 185, a: 'taken back', b: 'into the blood', fill: '#f6dcd8', stroke: C.red, h: (Hc - urineH) * ease(span(t, .3, .8)), part: 'reabsorption' },
    { x: 348, a: 'left as', b: 'urine', fill: C.blue, stroke: C.blue, h: urineH * span(t, .82, .9) },
  ];
  let b = '';
  for (const c of cols) {
    b += rect(c.x, top, wcol, Hc, 'none', '#babeb3', 1.5, 'stroke-dasharray="4 4"');
    const bar = c.h > .2 ? rect(c.x, bottom - c.h, wcol, c.h, c.fill, c.stroke, 2) : '';
    b += c.part ? part(c.part, bar) : bar;
    b += text(c.x + wcol / 2, bottom + 26, c.a, 'sm b') + text(c.x + wcol / 2, bottom + 48, c.b, 'sm');
  }
  b += path(`M14 ${bottom + .5} H466`, C.ink, 1.5);
  const a = span(t, .86, 1);
  b += `<g opacity="${f(a)}">${text(403, bottom - 44, 'only a sliver', 'sm b')}${path(`M403 ${bottom - 36} V${bottom - 8}`, C.ink, 1.5)}</g>`;
  b += `<g opacity="${f(span(t, .55, .8))}">${arrowTo(120, 40, 190, 40, C.red, 3)}${text(240, 46, 'back', 'sm b red')}</g>`;
  return b;
}

/* ---------- Step 4: water follows salt (moving) ---------- */
const OSM_SALT = [[40, 84, 1, 300, 96, 92], [118, 76, 0], [74, 140, 1, 372, 150, 172], [140, 168, 1, 318, 210, 172], [42, 212, 0], [110, 244, 1, 400, 260, 252], [66, 272, 0]];
const OSM_DROP = [[30, 108, 1, 296, 130, 129], [92, 104, 0], [150, 112, 1, 404, 112, 129], [60, 164, 1, 340, 186, 209], [110, 190, 0], [30, 240, 1, 302, 236, 209],
  [150, 220, 0], [86, 266, 1, 368, 274, 209], [140, 276, 1, 430, 214, 129], [54, 70, 0], [104, 152, 0], [146, 250, 0]];
function osmosisPicture(t) {
  let b = rect(14, 52, 162, 236, '#e4e9ff') + rect(254, 52, 212, 236, '#f6dcd8');
  for (const y of [52, 132, 212]) b += rect(184, y, 62, 76, '#fff7e8', C.ink, 2, 'rx="10"');
  for (const y of [92, 172, 252]) b += circle(215, y, 7, '#f3e0c8', N.SALT, 2.5);
  b += text(95, 38, 'inside the tube', 'sm b') + text(360, 38, 'blood', 'sm b') + text(215, 310, 'tube wall', 'xs muted');
  for (const [x, y] of [[300, 72], [420, 270]]) b += N.saltIcon(x, y, 6);
  for (const [x, y] of [[276, 160], [440, 82], [356, 238], [430, 176]]) b += N.dropIcon(x, y, 5.5);
  const place = (p, k) => {
    if (!p[2]) return [p[0], p[1]];
    const pts = [[p[0], p[1]], [178, p[5]], [252, p[5]], [p[3], p[4]]];
    const sgm = Math.min(2, Math.floor(k * 3)), u = k * 3 - sgm, a = pts[sgm], c = pts[sgm + 1];
    return [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u];
  };
  b += part('sodium', OSM_SALT.map((p, i) => { const [x, y] = place(p, ease(span(t, .04 + i * .02, .44 + i * .02))); return N.saltIcon(x, y, 6); }).join(''));
  b += part('osmosis', OSM_DROP.map((p, i) => { const [x, y] = place(p, ease(span(t, .5 + i * .015, .9 + i * .008))); return N.dropIcon(x, y, 5.5); }).join(''));
  b += `<g opacity="${f(span(t, .1, .3))}">${text(240, 338, 'salt is carried across;', 'sm b amber')}</g><g opacity="${f(span(t, .55, .75))}">${text(240, 362, 'water follows on its own', 'sm b blue')}</g>`;
  return b;
}

/* ---------- Steps 5 to 10: along the nephron (the new arrows grow) ---------- */
const BUILD = {
  pt: { hl: ['pt'], fresh: ['ptSalt', 'ptWater'], words: () => text(10, 130, 'proximal tubule', 'sm b', 'start')
    + text(70, 30, 'salt', 'sm b amber', 'end') + text(168, 30, 'water', 'sm b blue', 'start')
    + lines(350, 62, ['most salt and', 'water go back', 'to the blood'], 'sm', 'start', 23) },
  desc: { hl: ['desc', 'thin'], fresh: ['descWater'], bandWords: true, words: () => text(12, 190, 'loop of Henle,', 'sm b', 'start') + text(12, 212, 'going down', 'sm b', 'start')
    + text(108, 242, 'water', 'sm b blue', 'end') + lines(12, 276, ['water out,', 'salt stays in'], 'xs', 'start', 21) },
  tal: { hl: ['tal'], fresh: ['talSalt'], bandWords: true, words: () => lines(238, 264, ['thick', 'ascending', 'limb'], 'sm b', 'start', 22)
    + text(248, 186, 'salt', 'sm b amber') + lines(238, 334, ['walls block', 'water'], 'xs', 'start', 21)
    + part('carrier', circle(222, 206, 5.5, '#fff', N.SALT, 2.5)) },
  dct: { hl: ['dct'], fresh: ['dctSalt'], words: () => text(296, 46, 'distal tubule', 'sm b', 'start')
    + text(248, 40, 'salt', 'sm b amber', 'end') + lines(348, 86, ['walls block', 'water'], 'xs', 'start', 21) },
  'cd-salt': { hl: ['cd'], fresh: ['cdSalt', 'cdK'], words: () => lines(348, 284, ['collecting', 'duct'], 'sm b', 'start', 22)
    + text(306, 238, 'salt', 'sm b amber') + text(346, 222, 'potassium', 'sm b purple', 'start') + text(346, 242, 'into the urine', 'xs', 'start')
    + part('aldosterone', lines(348, 330, ['aldosterone', 'opens salt', 'channels'], 'xs', 'start', 21)) },
  'cd-water': { hl: ['cd'], fresh: ['cdWater'], words: () => lines(348, 240, ['collecting', 'duct'], 'sm b', 'start', 22)
    + text(306, 298, 'water', 'sm b blue') + part('adh', lines(348, 296, ['antidiuretic', 'hormone opens', 'water channels'], 'xs', 'start', 21)) },
};
const BUILD_ORDER = ['pt', 'desc', 'tal', 'dct', 'cd-salt', 'cd-water'];
const SEG_LABEL = {
  pt: 'The nephron with its first winding stretch, the proximal tubule, highlighted. Two large arrows leave it back towards the blood: a salt arrow and a water arrow of about the same size.',
  desc: 'The nephron with the downward limb of its hairpin loop, the loop of Henle, highlighted. It dips into the deep layer of the kidney, shaded darker as it gets saltier. A water arrow leaves the downward limb; no salt leaves here. The proximal tubule\'s arrows are shown faded.',
  tal: 'The nephron with the thick upward limb of the loop highlighted. A large salt arrow leaves it through a salt carrier; no water leaves, because its walls block water. Earlier arrows are shown faded.',
  dct: 'The nephron with the distal tubule, the second winding stretch near the filter, highlighted. A small salt arrow leaves it; its walls block water. Earlier arrows are shown faded.',
  'cd-salt': 'The nephron with the collecting duct highlighted. A small salt arrow leaves it back to the blood, opened by aldosterone, and a purple potassium arrow points into it, into the urine. Earlier arrows are shown faded.',
  'cd-water': 'The collecting duct highlighted again as it runs down through the salty deep layer. A large water arrow now leaves it back to the blood, through water channels opened by antidiuretic hormone. Earlier arrows are shown faded.',
};
function segPicture(kind, t) {
  const st = BUILD[kind], i = BUILD_ORDER.indexOf(kind);
  const old = BUILD_ORDER.slice(0, i).flatMap(k => BUILD[k].fresh), grow = ease(t);
  let b = N.bands(1, { labels: !!st.bandWords }) + N.glow(st.hl) + N.tube();
  b += N.arrows(BV, old, { faded: true });
  b += N.arrows(Object.fromEntries(st.fresh.map(k => [k, BV[k] * grow])), st.fresh);
  return b + `<g opacity="${f(span(t, .3, .8))}">${st.words()}</g>`;
}
const segScene = kind => ({ duration: 1800, render: needData(t => svg(SEG_LABEL[kind], segPicture(kind, t), { h: H })) });

/* ---------- Step 11: the whole journey (a cycle) ---------- */
const whole = needData(t => {
  let b = N.bands(1) + N.tube() + N.arrows(BV, N.ALL) + N.saltFlow(BV.shares, t) + N.urineBox() + N.urineBars(BV);
  b += text(10, 130, 'proximal tubule', 'xs b', 'start') + text(10, 300, 'loop of Henle', 'xs b', 'start')
    + lines(348, 90, ['distal', 'tubule'], 'xs b', 'start', 21) + lines(348, 146, ['collecting', 'duct'], 'xs b', 'start', 21)
    + text(N.ARROWS.cdK.x + 6, N.ARROWS.cdK.y + 6, 'potassium', 'xs b purple', 'start');
  return svg('The whole nephron with every arrow: big salt and water arrows from the proximal tubule, water from the downward limb of the loop of Henle, salt from its thick upward limb, a little salt from the distal tubule, and salt and water from the collecting duct, with potassium going in. Diamonds of salt travel the tube and leave it at each arrow; almost none reach the urine box, which holds only a short salt bar and a short water bar.', b, { h: H });
});

/* ---------- Step 12: blood volume ---------- */
const volumePicture = needData(() => {
  let b = N.nephron({ v: BV }) + lines(10, 270, ['the arrows show', 'salt and water', 'kept: they fill', 'the blood'], 'xs b', 'start', 21);
  return svg('The whole nephron with all its arrows of salt and water taken back, a urine box with short salt and water bars, and a blood volume container at top right, filled with blood to its normal level.', b, { h: H });
});

/* ---------- Steps 13 to 17: what changes it ----------
   Each drug at the model's strongest setting. The picture holds on normal, morphs to the drug, then
   keeps cycling the salt on the changed nephron. Where clinical-values.json has a matching state, its
   model settings are the same, so all three tabs show one nephron. */
const DRUG_SET = { loop: { loop: 1 }, thiazide: { thiazide: 1 }, ksp: { ksp: 1 }, ca: { ca: 1 }, osmotic: { osmotic: 1 } };
const HOLD = .12, MORPH = .42;     // t: normal until HOLD, the change until MORPH, then a cycle on the changed nephron
const CYCLE = 1 - MORPH;
const DRUG_WORDS = {
  loop: [['carrier blocked', 'red'], ['↑ salt out', ''], ['↑ water out', ''], ['↓ blood volume', ''], ['↑ potassium out', '']],
  thiazide: [['carrier blocked', 'red'], ['↑ a little salt', ''], ['and water out', ''], ['↓ blood volume', ''], ['↑ potassium out', '']],
  ksp: [['channel blocked', 'red'], ['↑ a little salt', ''], ['and water out', ''], ['↓ potassium out:', ''], ['potassium kept', '']],
  ca: [['enzyme blocked', 'red'], ['↑ a little more', ''], ['salt and water', ''], ['↑ bicarbonate', ''], ['lost in urine', '']],
  osmotic: [['mannitol stays', ''], ['in the tube', ''], ['↑ water out,', ''], ['far more than', ''], ['salt', '']],
};
const DRUG_NAME = { loop: 'A loop diuretic', thiazide: 'A thiazide diuretic', ksp: 'A potassium-sparing diuretic', ca: 'Acetazolamide, a carbonic anhydrase inhibitor', osmotic: 'Mannitol, an osmotic diuretic' };
const DRUG_LABEL = {
  loop: 'blocks the salt carrier in the thick upward limb of the loop. Its salt arrow shrinks almost to nothing, the distal tubule and collecting duct arrows grow a little, and the medulla pales as it loses its salt. A stream of salt diamonds now reaches the urine, whose salt and water bars rise far above their dashed normal heights; the potassium arrow grows and blood volume falls below its dashed normal level.',
  thiazide: 'blocks the salt carrier in the distal tubule. Its small salt arrow shrinks, the collecting duct takes back a little more, the urine salt and water bars rise moderately above normal, the potassium arrow grows, and blood volume dips.',
  ksp: 'blocks the salt channel in the collecting duct. Its salt arrow shrinks, the urine salt and water bars rise a little, the potassium arrow becomes much thinner than normal, and blood volume dips slightly.',
  ca: 'blocks carbonic anhydrase in the proximal tubule. Its big salt and water arrows shrink, the thick upward limb takes back much more, so the urine bars rise only moderately; blood volume dips a little.',
  osmotic: 'Grey mannitol particles ride the whole tube and are never taken back. The water arrows from the proximal tubule and the downward limb shrink while salt changes little. In the urine box the water bar rises well above normal, much more than the salt bar, and blood volume dips.',
};
// Directions the readout and the words agree on, straight from the model.
function changeRows(kind, m) {
  const rows = [['Salt in urine', dir(m.saltOut, BASE.saltOut)], ['Water in urine', dir(m.waterOut, BASE.waterOut)], ['Blood volume', dir(m.bv, BASE.bv)]];
  if (kind !== 'osmotic') rows.push(['Blood potassium', dir(m.k, BASE.k)], ['Blood bicarbonate', dir(m.hco3, BASE.hco3)]);
  return rows.map(([k, d]) => [k, d, d === 'same' ? 'about the same' : k.startsWith('Blood ') && k !== 'Blood volume' ? (d === 'up' ? 'higher' : 'lower') : WORD[d]]);
}
function changeScene(kind) {
  return {
    duration: 9000, loop: true, loopFrom: MORPH,
    render: needData(t => {
      const m = run({ ...NO_DRUG, ...DRUG_SET[kind] }), to = N.vis(m);
      const k = easeIO(span(t, HOLD, MORPH)), v = N.lerpVis(BV, to, k);
      const phase = t / CYCLE, a = span(t, MORPH - .1, MORPH);
      let words = '';
      const lw = DRUG_WORDS[kind];
      const said = lw.map(([w, tone], i) => text(10, 268 + i * 22, w, `xs b ${tone}`, 'start')).join('');
      words += `<g data-named opacity="${f(a)}">${kind === 'ca' ? said.replace(/(<text[^>]*>↑ bicarbonate<\/text><text[^>]*>lost in urine<\/text>)/, '<g data-part="bicarbonate">$1</g>') : said}</g>`;
      // An arrow on the gauge from the normal level to the new one.
      const y0 = N.gaugeY(BV.level), y1 = N.gaugeY(v.level);
      if (y1 - y0 > 12) words += arrowTo(N.GA.x - 14, y0, N.GA.x - 14, y1 - 2, C.ink, 3);
      const pic = N.nephron({ v, ghost: BV, target: to, flow: phase, drug: kind, block: span(t, HOLD, HOLD + .06), mannitol: kind === 'osmotic' ? span(t, HOLD, HOLD + .1) : 0, words });
      const label = `${DRUG_NAME[kind]}, drawn over dashed outlines of the normal nephron. ${kind === 'osmotic' ? '' : 'A red blocked mark appears where it acts. '}${DRUG_NAME[kind] && kind === 'osmotic' ? '' : 'It '}${DRUG_LABEL[kind]}`;
      return { svg: svg(label, pic, { h: H }), readout: readout(changeRows(kind, m).map(([k2, d, w]) => [k2, d, w])) };
    }),
  };
}

const scenes = {
  meet: meetPicture,
  filter: { duration: 6000, loop: true, render: needData(t => svg('Close-up of the filter. Blood flows in at the top left through a tuft of looping capillaries inside a round cup and out at the bottom left. Red blood cells and green proteins stay in the capillaries. Blue drops of water and orange diamonds of salt pass out of the capillaries into the cup, flow round it and leave on the right into the tube as filtrate.', filterPicture(t), { h: 380 })) },
  back: { duration: 3200, render: needData(t => svg('Three columns. The first, filtered each day, is very tall. The second, taken back into the blood, rises to almost the same height. The third, left as urine, is only a thin sliver.', backPicture(t), { h: 340 })) },
  osmosis: { duration: 4600, render: t => svg('Close-up of the tube wall: inside the tube on the left, blood on the right, a wall of cells between. First orange diamonds of salt are carried through carriers in the wall cells into the blood. Then blue drops of water follow them across on their own, between the cells.', osmosisPicture(t), { h: 374 }) },
  pt: segScene('pt'),
  desc: segScene('desc'),
  tal: segScene('tal'),
  dct: segScene('dct'),
  'cd-salt': segScene('cd-salt'),
  'cd-water': segScene('cd-water'),
  whole: { duration: 6000, loop: true, render: whole },
  volume: volumePicture,
  loop: changeScene('loop'),
  thiazide: changeScene('thiazide'),
  ksp: changeScene('ksp'),
  ca: changeScene('ca'),
  osmotic: changeScene('osmotic'),
};

/* ---------- Shared drug settings (Clinical values + Explore freely) ---------- */
const STORE_KEY = 'lab.nephron-diuretics.v1';
const SLIDERS = [
  { key: 'loop', label: 'Loop diuretic', what: 'thick ascending limb carrier blocked' },
  { key: 'thiazide', label: 'Thiazide', what: 'distal tubule carrier blocked' },
  { key: 'ksp', label: 'Potassium-sparing', what: 'collecting duct channel or its aldosterone signal blocked' },
  { key: 'ca', label: 'Carbonic anhydrase inhibitor', what: 'proximal bicarbonate-linked salt uptake blocked' },
  { key: 'osmotic', label: 'Osmotic diuretic', what: 'a solute the tube never takes back' },
];
const PRESETS = [
  { id: 'none', label: 'No drug', set: {},
    text: 'The reference nephron, calibrated to the textbook share of sodium each segment takes back (see Clinical values): most goes back in the proximal tubule, a large share in the thick ascending limb, a little in the distal tubule and collecting duct, and only a sliver reaches the urine. Every other scenario starts from here.' },
  { id: 'loop', label: 'Loop diuretic', set: { loop: 1 },
    text: 'The thick ascending limb normally takes back a large share of the filtered sodium. Blocked, it sends that sodium on; the distal tubule and collecting duct catch some, but their uptake saturates, so far more sodium leaves than with any other single drug. The medulla also loses much of its salt gradient, so the kidney can concentrate urine much less: a large volume of urine closer to the strength of plasma.' },
  { id: 'thiazide', label: 'Thiazide', set: { thiazide: 1 },
    text: 'The distal tubule normally takes back only a small share of the filtered sodium, so blocking it adds only a little to what leaves. The medulla keeps its gradient, so urine stays concentrated. A modest, steady effect.' },
  { id: 'ksp', label: 'Potassium-sparing', set: { ksp: 1 },
    text: 'The collecting duct handles only the last few percent of sodium, so the extra sodium lost is small. Its sodium uptake is what drives potassium into the urine, so potassium is kept and plasma potassium rises.' },
  { id: 'ca', label: 'Carbonic anhydrase inhibitor', set: { ca: 1 },
    text: 'Much more sodium leaves the proximal tubule, but the thick ascending limb, sitting downstream with spare capacity, catches most of it. Only a few percent more reach the urine. In the model, plasma bicarbonate is simply lowered to stand for the bicarbonate lost in the urine.' },
  { id: 'osmotic', label: 'Osmotic diuretic', set: { osmotic: 1 },
    text: 'Mannitol is filtered and never taken back. It holds water in the proximal tubule and descending limb, and at the end it needs water to carry it out. Water out rises far more than sodium out.' },
  { id: 'loop-thz', label: 'Loop + thiazide', set: { loop: 1, thiazide: 1 },
    text: 'Sequential blockade: with the loop blocked, the distal tubule is the main place left to catch the flood of sodium. Blocking it too lets even more through: more than either drug alone, and more potassium is lost.' },
];
let drugs = loadSaved(), activeState = null, picked = null;
function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'), d = { ...NO_DRUG };
    for (const k of DRUGS) { const v = Number(raw[k]); if (Number.isFinite(v) && v >= 0 && v <= 1) d[k] = v; }
    return d;
  } catch { return { ...NO_DRUG }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(drugs)); } catch { /* storage unavailable */ } }
const same = (a, b) => DRUGS.every(k => Math.abs((a[k] || 0) - (b[k] || 0)) < 1e-9);
const matchingPreset = () => PRESETS.find(p => same({ ...NO_DRUG, ...p.set }, drugs));
const strength = v => v <= 0 ? 'off' : `${Math.round(v * 100)} % of the model's strongest`;

function setDrugs(next, note) {
  drugs = { ...drugs, ...next };
  for (const k of DRUGS) drugs[k] = Math.round(clamp(drugs[k], 0, 1) * 100) / 100;
  save();
  if (note !== undefined) picked = note;
  update();
}
function syncControls() {
  for (const s of SLIDERS) for (const pre of ['', 'clinical-']) {
    const input = $(`#${pre}${s.key}`), out = $(`#${pre}${s.key}-label`);
    if (!input) continue;
    input.value = drugs[s.key];
    out.textContent = drugs[s.key] <= 0 ? 'off' : `${Math.round(drugs[s.key] * 100)} %`;
    input.setAttribute('aria-valuetext', strength(drugs[s.key]));
  }
  const match = matchingPreset();
  for (const r of $$('#presets input')) r.checked = !!match && r.value === match.id;
  const note = $('#preset-note');
  if (match) note.innerHTML = `<b>${esc(match.label)}.</b> ${esc(match.text)}`;
  else note.innerHTML = `<b>Custom mix:</b> ${esc(SLIDERS.filter(s => drugs[s.key] > 0).map(s => `${s.label.toLowerCase()} ${Math.round(drugs[s.key] * 100)} %`).join(', '))}. The dashed outlines show the nephron with no drug.`;
}

/* ---------- Explore freely: the nephron, the tube chart, the numbers ---------- */
function picture(m, label) {
  const v = N.vis(m), blocks = DRUGS.filter(k => k !== 'osmotic' && drugs[k] > 0);
  let words = '';
  const y0 = N.gaugeY(BV.level), y1 = N.gaugeY(v.level);
  if (y1 - y0 > 12) words += arrowTo(N.GA.x - 14, y0, N.GA.x - 14, y1 - 2, C.ink, 3);
  let s = N.nephron({ v, ghost: BV, flow: drugs.osmotic > 0 ? 0 : null, mannitol: drugs.osmotic, words });
  for (const k of blocks) s += N.blocker(k, clamp(drugs[k] * 1.4, .25, 1));
  return svg(label, s, { h: H });
}
// Salt and water left in the tube after each stop, as a share of what was filtered (log scale).
const STOPS = ['filtered', 'proximal', 'loop down', 'loop up', 'distal', 'urine'];
function chartSvg(m) {
  const X0 = 84, X1 = 452, Y0 = 50, Y1 = 250, LO = -1, HI = 2;
  const cx = i => X0 + i * (X1 - X0) / (STOPS.length - 1);
  const cy = v => Y0 + (HI - Math.log10(Math.max(10 ** LO, v))) / (HI - LO) * (Y1 - Y0);
  const pts = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${f(cx(i))} ${f(cy(v))}`).join('');
  let s = '';
  for (const v of [.1, 1, 10, 100]) s += path(`M${X0} ${f(cy(v))} H${X1}`, '#d3d6cc', 1) + text(X0 - 8, cy(v) + 6, `${v} %`, 'xs muted', 'end');
  STOPS.forEach((w, i) => { s += path(`M${f(cx(i))} ${Y0} V${Y1}`, '#d3d6cc', 1); s += `<text transform="translate(${f(cx(i) + 4)} ${Y1 + 18}) rotate(-40)" text-anchor="end" class="xs">${w}</text>`; });
  s += `<g class="ghost" data-ghost="normal">${path(pts(BASE.saltLeft), N.SALT, 2, 'stroke-dasharray="6 5"')}${path(pts(BASE.waterLeft), N.WATER, 2, 'stroke-dasharray="6 5"')}</g>`;
  s += path(pts(m.waterLeft), N.WATER, 4) + path(pts(m.saltLeft), N.SALT, 4);
  m.saltLeft.forEach((v, i) => { s += N.saltIcon(cx(i), cy(v), 6.5); });
  m.waterLeft.forEach((v, i) => { s += N.dropIcon(cx(i), cy(v), 5.5); });
  const up = m.saltOut >= m.waterOut;
  s += text(X1, cy(m.saltOut) + (up ? -12 : 26), `salt ${fmt(m.saltOut, 1)} %`, 'xs b amber', 'end');
  s += text(X1, cy(m.waterOut) + (up ? 26 : -12), `water ${fmt(m.waterOut, 1)} %`, 'xs b blue', 'end');
  s += text(16, 26, 'left in the tube, % of filtered', 'xs b', 'start');
  return svg(`Chart of salt and water left in the tube after each stop, on a log scale, with dashed lines for no drug. Salt: ${m.saltLeft.map(v => fmt(v, 1)).join(', ')} %. Water: ${m.waterLeft.map(v => fmt(v, 1)).join(', ')} %. Stops: ${STOPS.join(', ')}.`, s, { h: 336 });
}
function exploreRows(m) {
  return [['Salt in urine', dir(m.saltOut, BASE.saltOut)], ['Water in urine', dir(m.waterOut, BASE.waterOut)], ['Blood volume', dir(m.bv, BASE.bv)], ['Blood potassium', dir(m.k, BASE.k)], ['Blood bicarbonate', dir(m.hco3, BASE.hco3)]]
    .map(([k, d]) => [k, d, d === 'same' ? 'about the same' : k === 'Blood volume' || k.startsWith('Salt') || k.startsWith('Water') ? WORD[d] : (d === 'up' ? 'higher' : 'lower')]);
}
function describe(m) {
  return `Sodium taken back: proximal tubule ${fmt(m.s.pt, 1)} %, thick ascending limb ${fmt(m.s.tal, 1)} %, distal tubule ${fmt(m.s.dct, 1)} %, collecting duct ${fmt(m.s.cd, 1)} % of the filtered amount. In the urine: sodium ${fmt(m.saltOut, 1)} % and water ${fmt(m.waterOut, 1)} % of the filtered amount. Blood volume index ${fmt(m.bv * 100, 1)}.`;
}

function update() {
  if (!BASE) return;
  syncControls();
  const m = run(drugs);
  const label = `Model nephron with these settings, drawn over dashed outlines of the nephron with no drug. ${describe(m)}`;
  $('#explore-visual').innerHTML = picture(m, label) + readout(exploreRows(m));
  $('#explore-chart').innerHTML = chartSvg(m);
  $('#clinical-visual').innerHTML = picture(m, label);
  $('#model-results').textContent = `Illustrative model: salt out ${fmt(m.saltOut, 1)} % of filtered · water out ${fmt(m.waterOut, 1)} % of filtered · urine ${fmt(m.urine / 1000, 1)} L/day · blood volume index ${fmt(m.bv * 100, 1)} (100 with no drug) · potassium ${fmt(m.k, 1)} mmol/L · bicarbonate ${fmt(m.hco3, 1)} mmol/L.`;
  const rows = [
    ['Proximal tubule', m.saltIn.pt, m.s.pt, m.waterIn.pt, m.w.pt],
    ['Loop, going down', m.saltIn.desc, m.s.desc, m.waterIn.desc, m.w.desc],
    ['Thick ascending limb', m.saltIn.tal, m.s.tal, m.waterIn.tal, m.w.tal],
    ['Distal tubule', m.saltIn.dct, m.s.dct, m.waterIn.dct, m.w.dct],
    ['Collecting duct', m.saltIn.cd, m.s.cd, m.waterIn.cd, m.w.cd],
  ];
  $('#seg-list').innerHTML = rows.map(([n, si, sb, wi, wb]) => `<li><b>${n}</b>: salt in ${fmt(si, 1)}, salt back ${fmt(sb, 1)}; water in ${fmt(wi, 1)}, water back ${fmt(wb, 1)}</li>`).join('')
    + `<li><b>Urine</b>: salt ${fmt(m.saltOut, 1)}, water ${fmt(m.waterOut, 1)}</li>`;
  renderClinical(m);
  announce(m);
}
let announceTimer = 0;
function announce(m) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $('#cv-live').textContent = `Model: sodium in urine ${fmt(m.saltOut, 1)} percent of filtered, water ${fmt(m.waterOut, 1)} percent, urine ${fmt(m.urine / 1000, 1)} litres a day, potassium ${fmt(m.k, 1)}, bicarbonate ${fmt(m.hco3, 1)}.`;
  }, 400);
}

/* ---------- Clinical values ---------- */
// Every reference number lives in clinical-values.json; this code only draws it.
const SHIFT = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const MODEL_DIR = { up: 'model rises', down: 'model falls', same: 'model about the same' };
const places = x => x === null ? 0 : (String(x).split('.')[1] || '').length;
const decimals = v => /%/.test(v.unit) ? 1 : Math.max(places(v.low), places(v.high), places(v.typical));
const hasBand = v => v.low !== null && v.high !== null;
const upperOnly = v => v.low === null && v.high !== null;
function modelValue(key, m) {
  if (!m || !key) return null;
  return { urine: m.urine, pt_na: m.s.pt, tal_na: m.s.tal, dct_na: m.s.dct, cd_na: m.s.cd, fena: m.saltOut, k: m.k, hco3: m.hco3 }[key] ?? null;
}
function niceCeil(x) { const mag = 10 ** Math.floor(Math.log10(x)); return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * mag).find(s => s >= x - 1e-9); }
function niceFloor(x) { if (x <= 0) return 0; const mag = 10 ** Math.floor(Math.log10(x)); return [10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1].map(k => k * mag).find(s => s <= x + 1e-9); }
// The bar's ends: wide enough for the reference and for the model now and with no drug.
function axisFor(v, cur, bas) {
  let lo = 0, hi;
  if (hasBand(v)) { const w = v.high - v.low; lo = Math.max(0, v.low - 1.5 * w); hi = v.high + 1.5 * w; }
  else hi = (upperOnly(v) ? v.high : v.typical) * 2.5;
  if (/%/.test(v.unit)) hi = Math.min(100, hi);
  for (const x of [cur, bas]) if (x !== null) { if (x > hi) hi = x * 1.05; if (x < lo) lo = x * .95; }
  return [niceFloor(lo), niceCeil(hi)];
}
function gaugeSvg(v, cur, bas) {
  const [a, b] = axisFor(v, cur, bas), pos = x => f(20 + clamp((x - a) / (b - a), 0, 1) * 360);
  let s = '<path class="track" d="M20 23 H380"/>';
  if (hasBand(v)) s += `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
  if (upperOnly(v)) s += `<rect class="band" x="${pos(a)}" y="12" width="${f(pos(v.high) - pos(a))}" height="22"/><path class="limit" d="M${pos(v.high)} 6 V40"/>`;
  if (v.typical !== null) s += `<path class="typical" d="M${pos(v.typical)} 8 V38"/>`;
  if (bas !== null) s += `<line x1="${pos(bas)}" x2="${pos(bas)}" y1="2" y2="44" stroke="${C.muted}" stroke-width="3" stroke-dasharray="3 3"/>`;
  if (cur !== null) s += `<line class="marker" x1="${pos(cur)}" x2="${pos(cur)}" y1="4" y2="42"/>`;
  return { s, a, b };
}
function refText(v) {
  const d = decimals(v);
  if (hasBand(v)) return `Textbook range ${fmt(v.low, d)} to ${fmt(v.high, d)} ${v.unit} (shaded)${v.typical !== null ? `, normal value ${fmt(v.typical, d)} (tick)` : ''}`;
  if (upperOnly(v)) return `Textbook: less than ${fmt(v.high)} ${v.unit} (shaded from zero)`;
  return `Textbook typical value about ${fmt(v.typical)} ${v.unit} (tick; no range given)`;
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  for (const st of cv.states) { const o = document.createElement('option'); o.value = st.id; o.textContent = st.label; $('#clinical-state').append(o); }
  for (const v of cv.values) {
    const row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction quiet"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${refText(v)}, a blue marker for the current illustrative model and a dashed marker for the model with no drug`);
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const [id, full] of Object.entries(cv.sources)) { const li = document.createElement('li'); li.textContent = `[${id}] ${full}`; $('#sources').append(li); }
  // Say plainly where the teaching model's own baseline differs from the reference values.
  const gaps = cv.values.map(v => {
    const x = modelValue(v.modelKey, BASE), d = decimals(v);
    if (x === null) return null;
    if (hasBand(v) && (x < v.low || x > v.high)) return `${v.label}: model ${fmt(x, d)} ${v.unit}, outside the typical ${fmt(v.low, d)} to ${fmt(v.high, d)}`;
    if (upperOnly(v) && x >= v.high) return `${v.label}: model ${fmt(x, d)} ${v.unit}, not below the typical upper limit`;
    if (!hasBand(v) && !upperOnly(v) && Math.abs(+x.toFixed(d) - v.typical) >= 10 ** -d / 2) return `${v.label}: model ${fmt(x, d)} against a typical ${fmt(v.typical)} ${v.unit}`;
    return null;
  }).filter(Boolean);
  $('#baseline-note').textContent = gaps.length ? `With no drug, the teaching model differs from the reference here: ${gaps.join('; ')}.` : 'With no drug, the teaching model sits on every reference value shown.';
}
function renderClinical(m) {
  if (!cv) return;
  const st = activeState && same({ ...NO_DRUG, ...activeState.model }, drugs) ? activeState : null;
  if (!st) { $('#clinical-state').value = same(drugs, NO_DRUG) ? '' : '__custom'; }
  $('#state-summary').textContent = st ? `${st.label}: ${st.summary} The model now shows this drug at its strongest setting.`
    : same(drugs, NO_DRUG) ? 'No drug: the model\'s baseline. The dashed marker on each bar is where it sits.' : 'Custom model settings. Pick a drug to see which way the source says each value moves.';
  $('#state-source').textContent = st ? `${st.context ? 'Assumes: ' + st.context + ' ' : ''}In the model: ${MODEL_NOTES[Object.keys(st.model)[0]] || ''} Directions: ${st.where} [${st.source}]` : '';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const cur = modelValue(v.modelKey, m), bas = modelValue(v.modelKey, BASE), d = decimals(v);
    const g = gaugeSvg(v, cur, bas);
    row.querySelector('svg').innerHTML = g.s;
    row.querySelector('.key').textContent = `${refText(v)} · bar runs ${fmt(g.a, g.b - g.a < 20 ? 1 : 0)} to ${fmt(g.b, g.b - g.a < 20 ? 1 : 0)} · blue line: model now · dashed line: model with no drug`;
    if (cur === null) { row.querySelector('.reading').textContent = '–'; row.querySelector('.status').textContent = 'Not in the model'; continue; }
    let where, shown = d;
    if (hasBand(v) || upperOnly(v)) {
      const inside = x => (!hasBand(v) || x >= v.low) && (hasBand(v) ? x <= v.high : x < v.high);
      where = inside(cur) ? 'within typical range' : hasBand(v) && cur < v.low ? 'below typical range' : 'above typical range';
      // If rounding would hide which side of a bound the value is on, print one more decimal.
      while (!inside(cur) && shown < d + 3 && inside(+cur.toFixed(shown))) shown++;
    } else {
      const diff = +cur.toFixed(d) - v.typical;
      where = Math.abs(diff) < 10 ** -d / 2 ? 'at the typical value' : `${diff > 0 ? 'above' : 'below'} the typical value`;
    }
    row.querySelector('.reading').textContent = `${fmt(cur, shown)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${where}`;
    const dirEl = row.querySelector('.direction');
    const md = dir(cur, bas), expect = st?.shifts[v.id];
    const differs = expect && expect !== 'variable' && ((expect === 'none') !== (md === 'same') || (expect === 'up' && md === 'down') || (expect === 'down' && md === 'up'));
    dirEl.textContent = st ? `${expect ? SHIFT[expect] : 'Not listed in the cited source'} · ${MODEL_DIR[md]}${differs ? ' (differs)' : ''}` : '';
    dirEl.classList.toggle('quiet', !expect);
  }
}

/* ---------- About the model: written from the calibrated constants, so it always matches ---------- */
function describeModel() {
  const n = (x, d = 3) => String(+x.toFixed(d));
  $('#eq').innerHTML = [
    `Proximal: Na_pt = 100 · ${n(CAL.ptFrac)} · (1 − ${P.caBlock}·CA) · (1 − ${P.osmPt}·Osm); W_pt = Na_pt · (1 − ${P.osmPtWater}·Osm)`,
    `Gradient: g = (1 − ${P.gradLoop}·Loop) · (1 − ${P.gradOsm}·Osm)`,
    `Loop down: W_d = W_in · ${P.descFrac} · g · (1 − ${P.osmDesc}·Osm)`,
    `Loop up: Na_tal = Na_in · ${n(CAL.talFrac)} · (1 − ${P.loopBlock}·Loop)`,
    `Distal: Na_dct = ${n(CAL.dctMax)} · (1 − ${P.thzBlock}·Thz) · Na_in ÷ (${n(CAL.dctHalf)} + Na_in)`,
    `Collecting: Na_cd = ${n(CAL.cdMax)} · (1 − ${P.kspBlock}·Ksp) · Na_in ÷ (${n(CAL.cdHalf)} + Na_in)`,
    `Urine water: W_out = min(W_in, (${P.saltOsm}·Na_out + ${P.otherOsm} + ${P.mannitolOsm}·Osm) ÷ (1 + ${P.concGain}·g))`,
    `Urine: ${fmt(CAL.urine)} mL/day × W_out ÷ W_out(no drug)`,
  ].map(l => `<code>${esc(l)}</code>`).join('<br>');
  $('#about-cal').textContent = `The proximal and thick ascending limb fractions and the distal and collecting duct constants are calculated from the textbook share of sodium each segment takes back, in clinical-values.json; the collecting duct is set so that, with no drug, half of the source's "less than ${fmt(cv.values.find(v => v.id === 'fena').high)} %" upper limit is excreted. Urine output is scaled to the typical daily value in the same file.`;
  $('#about-k').textContent = `Potassium: secretion is driven by the sodium and flow reaching the collecting duct and cut by blocking aldosterone's channel; plasma potassium settles at ${fmt(CAL.kBase, 1)} × drive to the power −${P.kExp}, where ${fmt(CAL.kBase, 1)} is the textbook normal value.`;
  $('#about-hco3').textContent = `Bicarbonate starts at the textbook normal value (${fmt(CAL.hco3Base)}), falls with carbonic anhydrase inhibition and dips a little with potassium-sparing drugs. It rises with volume loss as a crude stand-in for contraction alkalosis, which in the body is driven by angiotensin II and aldosterone, hormones the model leaves out.`;
}

/* ---------- Wiring ---------- */
function buildControls() {
  const box = $('#presets');
  for (const p of PRESETS) {
    const l = document.createElement('label');
    l.className = 'choice';
    l.innerHTML = `<input type="radio" name="preset" value="${p.id}"> ${esc(p.label)}`;
    l.querySelector('input').addEventListener('change', () => { activeState = null; setDrugs({ ...NO_DRUG, ...p.set }); });
    box.append(l);
  }
  for (const s of SLIDERS) for (const pre of ['', 'clinical-']) {
    const input = $(`#${pre}${s.key}`);
    input?.addEventListener('input', () => { activeState = null; setDrugs({ [s.key]: Number(input.value) }); });
  }
  $('#reset').addEventListener('click', () => { activeState = null; setDrugs({ ...NO_DRUG }); });
  $('#clinical-reset').addEventListener('click', () => { activeState = null; setDrugs({ ...NO_DRUG }); });
  $('#clinical-state').addEventListener('change', e => {
    activeState = cv?.states.find(s => s.id === e.target.value) || null;
    setDrugs({ ...NO_DRUG, ...(activeState ? activeState.model : {}) });
  });
}
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    cv = await res.json();
    calibrate(cv);
    BASE = run(NO_DRUG);
    BV = N.vis(BASE);
    buildClinical();
    describeModel();
    buildControls();
    clinicalControls.forEach(el => { el.disabled = false; });
    update();
  } catch (err) {
    cv = null; BASE = null;
    console.warn('nephron-diuretics: reference data did not load', err);
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load, so the model cannot be calibrated. Reload the page to try again; the lesson\'s words still read in order.';
  }
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
