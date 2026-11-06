// Lesson 6: The autonomic synapse. The kit (/lab/kit/kit.js) runs the page; this file is the model,
// the pictures, and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, f, clamp, lerp, span, ease, arrow, readout } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means the normal resting state. No clinical numbers live here;
   the Clinical values tab scales these ratios with the guideline values in clinical-values.json. */
const NORMAL = { symp: 1, para: 1, che: 1, mFree: 1, aFree: 1, bFree: 1, mAg: 0, aAg: 0, bAg: 0, reflex: true };
const CHANGES = {
  mag: { mAg: 1.6 },     // extra muscarinic switching-on
  mant: { mFree: .1 },   // nine in ten muscarinic receptors blocked
  che: { che: .15 },     // cholinesterase mostly stopped
  aag: { aAg: 1.6 },
  ablock: { aFree: .15 },
  bag: { bAg: 1.6 },
  bblock: { bFree: .3 }
};
const REFLEX_GAIN = 1.5;

// The organs' answer for a given pressure as the reflex feels it.
function organs(p, sensed) {
  const g = p.reflex ? REFLEX_GAIN : 0;
  const sD = clamp(p.symp * Math.exp(-g * (sensed - 1)), .05, 6);  // sympathetic drive to heart and arterioles
  const pD = clamp(p.para * Math.exp(.6 * g * (sensed - 1)), .05, 6); // parasympathetic drive to the heart (reflex pulls it less)
  const clear = .25 + .75 * p.che;                                  // how fast cholinesterase clears the gap
  const ach = pD / clear, achRest = p.para / clear;
  const M = (ach + p.mAg) * p.mFree, Mr = (achRest + p.mAg) * p.mFree;  // muscarinic signal (heart; eye and airways)
  const Al = (sD + p.aAg) * p.aFree, Alr = (p.symp + p.aAg) * p.aFree;  // alpha signal
  const Be = (sD + p.bAg) * p.bFree;        // beta signal at the heart, from sympathetic nerves
  // Airway muscle and some vessel walls have almost no sympathetic nerves: their beta signal comes from
  // adrenaline that the adrenal glands release into the blood, tied here to the resting sympathetic drive.
  const adr = p.symp, Ber = (adr + p.bAg) * p.bFree;
  const HR = (.5 + .5 * Be) / (.6 + .4 * M);
  const SV = clamp(.7 + .3 * Be, .4, 1.8);  // squeeze strength of each beat
  // Arteriole tightness: alpha tightens; vessel beta receptors relax. The beta part is a bounded response
  // (between 0.4 and 1.3 times normal, continuous at normal), so tightness and pressure are always positive.
  const relax = Ber >= 1 ? 1 - .6 * Math.tanh(1.1 * (Ber - 1)) : 1 + .3 * Math.tanh(1.1 * (1 - Ber));
  const R = (.55 + .45 * Al) * relax;
  const P = Math.sqrt(HR) * SV * R;
  const airway = (.6 + .4 * Ber) / (.6 + .4 * Mr);
  const pupil = (.6 + .4 * Alr) / (.6 + .4 * Mr);
  return { sD, pD, ach, ne: sD, M, Al, Be, HR, SV, R, P, airway, pupil, p };
}
// Steady state: the pressure the reflex feels equals the pressure produced.
// Produced pressure never rises as felt pressure rises, so bisection finds the single crossing.
function steady(p) {
  // Every allowed setting gives a positive pressure well inside this bracket.
  let lo = .02, hi = 12;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (organs(p, mid).P > mid) lo = mid; else hi = mid; }
  return organs(p, (lo + hi) / 2);
}
const BASE = steady(NORMAL);
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17).
   Red is the sympathetic branch and its messengers, green the parasympathetic branch and acetylcholine,
   purple a drug, blue what a change moved. */
const INK = C.ink, SYM = C.red, PARA = C.green, DRUG = C.purple, BLUE = C.blue, MUTED = C.muted;
const ORGAN = '#f1d6d0', WALL = '#a8584c', ENZ = '#d6d9cc', IRIS = '#8c9b80', AIR = '#e7cfc8';
const T = text;
// A fade; a fully faded label is written as opacity 0 (and is not a label a reader can see).
const op = a => { const v = clamp(a, 0, 1); return v < .005 ? 'opacity="0"' : `opacity="${v.toFixed(2)}"`; };
const fadeIn = (a, body) => a < .005 ? '' : `<g ${op(a)}>${body}</g>`;
const dot = (x, y, r, col, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${col}" ${extra}/>`;
const tint = c => c === SYM ? 'red' : c === PARA ? 'green' : c === DRUG ? 'purple' : c === BLUE ? 'blue' : '';
// A drug that switches a receptor on (a diamond), one that blocks it (a plug), an enzyme stopped (a cross).
const diamond = (x, y, r = 7) => `<path d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${DRUG}"/>`;
const plug = (x, y, w = 18, h = 13) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="2" fill="${DRUG}"/>`;
const cross = (x, y, r = 8) => `<path d="M${f(x - r)} ${f(y - r)} L${f(x + r)} ${f(y + r)} M${f(x + r)} ${f(y - r)} L${f(x - r)} ${f(y + r)}" stroke="${DRUG}" stroke-width="4" stroke-linecap="round"/>`;
// Cholinesterase: a mouth that opens and shuts as it chops.
function enzyme(x, y, r = 12, open = .5) {
  const a = (.22 + .4 * clamp(open, 0, 1)) * Math.PI / 2, ax = Math.sin(a) * r, ay = Math.cos(a) * r;
  return `<path d="M${f(x)} ${f(y)} L${f(x - ax)} ${f(y - ay)} A${r} ${r} 0 1 0 ${f(x + ax)} ${f(y - ay)} Z" fill="${ENZ}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
}
const HEART = 'M0 -6 C-6 -20 -30 -18 -28 2 C-26 16 -8 26 0 34 C8 26 26 16 28 2 C30 -18 6 -20 0 -6 Z';
const heartIcon = (x, y, s) => `<path d="${HEART}" transform="translate(${f(x)} ${f(y)}) scale(${s.toFixed(3)})" fill="${ORGAN}" stroke="${WALL}" stroke-width="${(3 / s).toFixed(2)}"/>`;
const bez = (p0, p1, p2, p3, u) => { const v = 1 - u; return [0, 1].map(k => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]); };
const bezPath = ([p0, p1, p2, p3]) => `M${p0.join(' ')} C${p1.join(' ')} ${p2.join(' ')} ${p3.join(' ')}`;

/* ---------- Steps 1 and 2: the wiring ---------- */
const ORGANS = [['eyes', 36], ['lungs', 106], ['heart', 176], ['blood vessels', 246], ['gut', 316]];
function organIcons() {
  let b = `<path d="M342 36 Q380 12 418 36 Q380 60 342 36 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>${dot(380, 36, 12, IRIS)}${dot(380, 36, 5, INK)}`;
  b += `<path d="M376 88 C356 84 342 104 344 124 C346 138 370 138 376 126 Z M384 88 C404 84 418 104 416 124 C414 138 390 138 384 126 Z" fill="${ORGAN}" stroke="${WALL}" stroke-width="2.5"/>`;
  b += heartIcon(380, 172, .95);
  b += `<rect x="340" y="237" width="80" height="18" fill="${ORGAN}"/><path d="M340 237 H420 M340 255 H420" stroke="${WALL}" stroke-width="3"/>`;
  b += `<path d="M346 316 C356 302 366 330 376 316 C386 302 396 330 406 316 C412 308 418 320 412 330" fill="none" stroke="${WALL}" stroke-width="6" stroke-linecap="round"/>`;
  for (const [name, y] of ORGANS) b += T(380, y + 40, name, 'sm');
  return b;
}
function brainAndCord() {
  return `<ellipse cx="100" cy="54" rx="76" ry="44" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>${T(100, 61, 'brain', 'sm b on-organ')}`
    + `<rect x="89" y="94" width="22" height="262" rx="11" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>`
    + T(80, 212, 'spinal', 'sm', 'end') + T(80, 234, 'cord', 'sm', 'end');
}
// Nerves as curves from a start point to an organ, with signals (dots) running along them.
const nerve = (from, toY, dy = 0) => [from, [from[0] + 96, from[1]], [250, toY + dy], [336, toY + dy]];
const PLAIN = [[[176, 62], 36], [[111, 122], 106], [[111, 180], 176], [[111, 246], 246], [[111, 318], 316]];
// Sympathetic nerves leave the middle of the cord; airway muscle in the lungs gets almost none of them.
// Parasympathetic nerves leave the brainstem and the bottom of the cord, and most blood vessels get none.
const SYMP = [[[111, 142], 36], [[111, 188], 176], [[111, 236], 246], [[111, 282], 316]];
const PARAS = [[[150, 92], 36], [[111, 104], 106], [[111, 116], 176], [[111, 344], 316]];
function signals(curves, t, col, n = 2) {
  let s = '';
  curves.forEach((c, i) => { for (let k = 0; k < n; k++) { const u = (t * 2 + k / n + i * .17) % 1; const [x, y] = bez(...c, u); s += dot(x, y, 5, col, op(span(u, 0, .08) * (1 - span(u, .9, 1)))); } });
  return s;
}
function wiringArt(t) {
  const curves = PLAIN.map(([p, y]) => nerve(p, y));
  let b = brainAndCord() + organIcons();
  b += `<g data-part="nerves">${curves.map(c => arrow(bezPath(c), INK, 2.5)).join('')}${signals(curves, t, BLUE)}</g>`;
  b += T(12, 402, 'signals run all the time, without you thinking', 'xs muted', 'start');
  return b;
}
function branchesArt(t) {
  const s = SYMP.map(([p, y]) => nerve(p, y, -7)), q = PARAS.map(([p, y]) => nerve(p, y, 7));
  let b = brainAndCord() + organIcons();
  b += `<g data-part="symp">${s.map(c => arrow(bezPath(c), SYM, 3)).join('')}${signals(s, t, SYM, 1)}</g>`;
  b += `<g data-part="para">${q.map(c => arrow(bezPath(c), PARA, 3, 'stroke-dasharray="9 6"')).join('')}${signals(q, t, PARA, 1)}</g>`;
  b += `<g data-part="symp"><path d="M14 382 H52" stroke="${SYM}" stroke-width="4"/>${T(60, 388, 'sympathetic: the accelerator', 'sm b red', 'start')}</g>`;
  b += `<g data-part="para"><path d="M14 406 H52" stroke="${PARA}" stroke-width="4" stroke-dasharray="9 6"/>${T(60, 412, 'parasympathetic: the brake', 'sm b green', 'start')}</g>`;
  return b;
}

/* ---------- Steps 3 to 7: one synapse, one release, start to finish ----------
   For t from 0 to 1: an impulse comes down the nerve, two vesicles fuse with the ending and spill their
   messenger, it crosses the gap and docks in the receptors, which pass the signal on, then the gap is
   cleared (the messenger drifts off, is chopped by cholinesterase, or is pumped back in). */
const GAP = 140, MEM = 204;                                   // ending's lower membrane; organ cell's membrane
const ENDING = 'M228 0 V30 C172 32 120 48 120 84 V128 Q120 140 132 140 H348 Q360 140 360 128 V84 C360 48 308 32 252 30 V0 Z';
const VES = [[166, 88], [212, 70], [266, 68], [314, 88], [200, 114], [282, 114]];   // the last two fuse
const FUSE = [200, 282];
const FREE = [[150, 164], [176, 182], [228, 158], [256, 184], [306, 164], [334, 182]]; // messenger left unbound
const cupUp = (x, col = INK) => `<path d="M${x - 12} ${MEM - 13} V${MEM} A12 12 0 0 0 ${x + 12} ${MEM} V${MEM - 13}" fill="#fff" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`;
const cupDown = x => `<path d="M${x - 12} ${GAP + 13} V${GAP} A12 12 0 0 1 ${x + 12} ${GAP} V${GAP + 13}" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
const vesicle = (x, y, col, a = 1) => `<g ${op(a)}><circle cx="${x}" cy="${f(y)}" r="14" fill="#fff" stroke="${col}" stroke-width="1.5"/>${[[-5, -3], [5, -4], [0, 5]].map(([dx, dy]) => dot(x + dx, y + dy, 3, col)).join('')}</g>`;
const signalArrow = (x, a, col, y0 = MEM + 22) => `<g ${op(a)}><rect x="${x - 6}" y="${y0}" width="12" height="34" fill="${col}"/><path d="M${x - 15} ${y0 + 34} H${x + 15} L${x} ${y0 + 52} Z" fill="${col}"/></g>`;
const PUMP = 340, A2 = 140;
function synapseArt(c, t) {
  const col = c.col, msg = c.msg || col;
  let b = `<rect x="0" y="${MEM}" width="480" height="${c.h - MEM}" fill="${ORGAN}"/><path d="M0 ${MEM} H480" stroke="${WALL}" stroke-width="3"/>`;
  b += `<g data-part="gap"><rect x="120" y="${GAP + 2}" width="240" height="${MEM - GAP - 4}" fill="#fff" opacity=".5"/>${c.gapLabel ? arrow(`M384 ${GAP + 18} V${MEM - 6}`, INK, 2, 'marker-start="url(#ah-k)"') + T(396, 168, 'the gap:', 'xs', 'start') + T(396, 190, 'synapse', 'sm b', 'start') : ''}</g>`;
  // The nerve ending, and the impulse arriving down its axon.
  b += `<path d="${ENDING}" fill="#fff" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>`;
  const pulse = span(t, 0, .1);
  if (pulse > 0 && pulse < 1) b += dot(240, lerp(2, 36, pulse), 9, col, 'opacity=".85"');
  // Vesicles: the last two move down, fuse and spill, and re-form for the next impulse.
  VES.forEach(([x, y], i) => {
    if (i < 4) { b += vesicle(x, y, col); return; }
    if (t < .17) b += vesicle(x, lerp(y, 124, ease.inOut(span(t, .06, .16))), col);
    else if (t < .9) b += `<rect x="${x - 12}" y="${GAP - 3}" width="24" height="6" fill="#fff"/><path d="M${x - 14} ${GAP} A14 14 0 0 1 ${x + 14} ${GAP}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
    else b += vesicle(x, y, col, span(t, .9, 1));
  });
  // Receptors on the organ cell, and the autoreceptor and pump on the ending (step 7).
  for (const g of c.groups) b += `<g data-part="${g.part}">${g.xs.map(x => cupUp(x)).join('')}</g>`;
  if (c.clear === 'reuptake') {
    b += `<g data-part="alpha2">${cupDown(A2)}</g>`;
    b += `<g data-part="reuptake"><rect x="${PUMP - 13}" y="${GAP - 11}" width="9" height="24" rx="3" fill="${ENZ}" stroke="${INK}" stroke-width="1.5"/><rect x="${PUMP + 4}" y="${GAP - 11}" width="9" height="24" rx="3" fill="${ENZ}" stroke="${INK}" stroke-width="1.5"/>${arrow(`M${PUMP} ${GAP + 6} V${GAP - 24}`, INK, 2.5)}</g>`;
  }
  const enzymes = c.clear === 'enzyme' ? [146, 334] : [];
  // The messenger: one dot per receptor, the rest left unbound in the gap.
  const docks = c.groups.flatMap(g => g.xs.map(x => [x, MEM - 5, true]));
  if (c.clear === 'reuptake') docks.push([A2, GAP + 5, true]);
  const trips = [...docks, ...FREE.map(([x, y]) => [x, y, false])];
  let dots = '', chomp = 0;
  trips.forEach(([tx, ty], i) => {
    const sx = tx < 241 ? FUSE[0] : FUSE[1], lag = (i % 5) * .014;
    const u = ease.out(span(t, .18 + lag, .4 + lag));
    if (u <= 0) return;
    let x = lerp(sx, tx, u) + Math.sin(u * Math.PI) * ((i % 3) - 1) * 12, y = lerp(GAP + 4, ty, u), a = 1, split = 0;
    if (c.clear === 'fade') a = 1 - span(t, .74 + lag, .86 + lag);
    if (c.clear === 'enzyme') {
      const ex = enzymes.reduce((m, e) => Math.abs(e - tx) < Math.abs(m - tx) ? e : m), k = i * .012;
      const go = ease.inOut(span(t, .58 + k, .66 + k));
      x = lerp(x, ex, go); y = lerp(y, MEM - 24, go);
      split = span(t, .66 + k, .8 + k);
      if (go > 0 && split < 1) chomp = Math.max(chomp, Math.sin(Math.PI * span(t, .6 + k, .7 + k)));
    }
    if (c.clear === 'reuptake') {
      const k = (i % 6) * .02, go = ease.inOut(span(t, .6 + k, .72 + k)), up = span(t, .72 + k, .8 + k);
      x = lerp(x, PUMP, go); y = lerp(y, GAP + 8, go) - 34 * up; a = 1 - span(up, .5, 1);
    }
    if (a <= .01 || split >= 1) return;
    dots += split > 0
      ? `<g ${op(1 - span(split, .5, 1))}><path d="M${f(x - 2 - 12 * split)} ${f(y - 6 - 10 * split)} a6 6 0 0 0 0 12 z" fill="${msg}"/><path d="M${f(x + 2 + 12 * split)} ${f(y - 6 - 10 * split)} a6 6 0 0 1 0 12 z" fill="${msg}"/></g>`
      : dot(x, y, 5.5, msg, a < 1 ? op(a) : '');
  });
  b += `<g data-part="${c.dotPart}">${dots}</g>`;
  if (enzymes.length) b += `<g data-part="enzyme">${enzymes.map(x => enzyme(x, MEM - 14, 15, .3 + .7 * chomp)).join('')}</g>`;
  // The signal each receptor family passes on, while its messenger is docked.
  const off = c.clear === 'enzyme' ? [.66, .74] : c.clear === 'reuptake' ? [.66, .76] : [.74, .84];
  for (const g of c.groups) b += signalArrow((g.xs[0] + g.xs.at(-1)) / 2, span(t, .42, .5) * (1 - span(t, ...off)), g.col || col, c.arrowTop);
  return b + c.labels(t);
}
const SYN = {
  synapse: {
    col: INK, msg: MUTED, h: 316, gapLabel: true, dotPart: 'messenger', clear: 'fade',
    groups: [{ part: 'receptor', xs: [186, 222, 258, 294] }],
    labels: () => T(262, 20, 'nerve', 'sm', 'start') + T(12, 34, 'nerve ending', 'sm b', 'start')
      + `<g data-part="messenger">${T(112, 177, 'messenger', 'xs b', 'end')}</g>`
      + `<g data-part="receptor">${T(170, 236, 'receptors', 'xs b on-organ', 'end')}</g>`
      + T(256, 264, 'signal passed on', 'xs b on-organ', 'start') + T(12, 304, 'organ cell', 'sm b on-organ', 'start'),
    label: 'Close-up of one nerve ending, a swelling of the nerve fibre, sitting just above an organ cell. An impulse comes down the nerve, two small sacs in the ending merge with its wall and spill grey messenger dots into the narrow gap between them, the synapse. The dots cross, dock in four cup-shaped receptors on the organ cell, and an arrow inside the cell shows the signal passed on. Then the dots drift away and the gap is clear again.'
  },
  ach: {
    col: PARA, h: 316, dotPart: 'ach', clear: 'fade',
    groups: [{ part: 'receptor', xs: [186, 222, 258, 294] }],
    labels: () => T(262, 20, 'parasympathetic nerve', 'xs b green', 'start')
      + `<g data-part="ach">${T(12, 177, 'acetylcholine', 'xs b green', 'start')}</g>`
      + `<g data-part="receptor">${T(170, 236, 'M receptors', 'xs b on-organ', 'end')}${T(170, 256, '(muscarinic)', 'xs on-organ', 'end')}</g>`
      + T(256, 264, 'signal passed on', 'xs b on-organ', 'start'),
    label: 'A parasympathetic nerve ending above an organ cell. An impulse arrives, sacs spill green acetylcholine dots into the gap, and each dot that reaches a cup-shaped muscarinic receptor docks in it like a key in a lock. A green arrow inside the cell shows the signal passed on while the dots are docked.'
  },
  enzyme: {
    col: PARA, h: 316, dotPart: 'ach', clear: 'enzyme',
    groups: [{ part: 'receptor', xs: [186, 222, 258, 294] }],
    labels: () => `<g data-part="enzyme">${T(476, 172, 'cholinesterase', 'sm b', 'end')}${T(476, 238, 'chops it apart', 'xs b on-organ', 'end')}</g>`
      + T(262, 20, 'parasympathetic nerve', 'xs b green', 'start')
      + `<g data-part="receptor">${T(150, 238, 'M receptors', 'xs b on-organ', 'end')}</g>`,
    label: 'The same parasympathetic synapse with cholinesterase, two mouth-shaped enzymes at the edges of the gap. Acetylcholine crosses and docks, and the signal arrow appears; within moments each dot is carried to an enzyme and chopped into two halves that fade away, so the receptors empty and the signal stops.'
  },
  ne: {
    col: SYM, h: 316, dotPart: 'ne', clear: 'fade', arrowTop: MEM + 42,
    groups: [{ part: 'alpha', xs: [160, 196] }, { part: 'beta', xs: [284, 320] }],
    labels: () => T(262, 20, 'sympathetic nerve', 'xs b red', 'start')
      + `<g data-part="ne">${T(12, 177, 'noradrenaline', 'xs b red', 'start')}</g>`
      + `<g data-part="alpha">${T(178, 234, 'alpha', 'sm b on-organ')}</g><g data-part="beta">${T(302, 234, 'beta', 'sm b on-organ')}</g>`
      + T(240, 306, 'each family passes on its own signal', 'xs on-organ'),
    label: 'A sympathetic nerve ending above an organ cell. Red noradrenaline dots spill into the gap and dock in two kinds of cup-shaped receptor: a pair labelled alpha and a pair labelled beta. Each family sends its own red signal arrow into the cell.'
  },
  reuptake: {
    col: SYM, h: 316, dotPart: 'ne', clear: 'reuptake', arrowTop: MEM + 42,
    groups: [{ part: 'alpha', xs: [160, 196] }, { part: 'beta', xs: [284, 320] }],
    labels: () => `<g data-part="reuptake">${T(476, 100, 'pumped back', 'xs b', 'end')}${T(476, 120, 'in: reuptake', 'xs b', 'end')}</g>`
      + `<g data-part="alpha2">${T(8, 168, 'alpha-2:', 'xs b', 'start')}${T(8, 188, 'less release', 'xs', 'start')}</g>`
      + T(262, 20, 'sympathetic nerve', 'xs b red', 'start')
      + `<g data-part="alpha">${T(178, 234, 'alpha', 'sm b on-organ')}</g><g data-part="beta">${T(302, 234, 'beta', 'sm b on-organ')}</g>`,
    label: 'The sympathetic synapse again. Noradrenaline docks on the alpha and beta receptors, and one dot docks on an alpha-2 receptor hanging from the nerve ending itself, which turns further release down. Then a pump in the ending’s wall carries the noradrenaline back inside: reuptake. No enzyme chops it in the gap.'
  }
};
const synapseScene = kind => ({ duration: 4600, loop: true, rest: .56, render: t => svg(SYN[kind].label, synapseArt(SYN[kind], t), { h: SYN[kind].h }) });

/* ---------- Steps 8 and 9: the heart, as a strip of beats ----------
   One dot per heartbeat over the same stretch of time: closer dots mean a faster rate, bigger dots a
   stronger squeeze. A sweep draws the beats as they happen, and the heart swells with each one. */
function heartArt(kind, t) {
  const para = kind === 'para-heart', X0 = 168, X1 = 466, sweep = lerp(X0, X1 + 10, t);
  const rows = para
    ? [{ y: 110, gap: 43, r: 9, ghost: true, label: 'if the brake were off', cls: 'xs muted' }, { y: 200, gap: 62, r: 9, label: 'with acetylcholine on M: slower', cls: 'xs b green' }]
    : [{ y: 110, gap: 62, r: 9, ghost: true, label: 'at rest', cls: 'xs muted' }, { y: 200, gap: 38, r: 12.5, label: 'noradrenaline on beta-1: faster', cls: 'xs b red' }];
  const col = para ? PARA : SYM;
  let b = '', beat = 0;
  for (const r of rows) {
    b += T(X0, r.y - 26, r.label, r.cls, 'start') + `<path d="M${X0} ${r.y} H${X1}" stroke="${C.rule}" stroke-width="2"/>`;
    let s = '';
    for (let x = X0 + 14; x <= X1 - 6; x += r.gap) {
      if (x > sweep) break;
      s += r.ghost ? `<circle cx="${f(x)}" cy="${r.y}" r="${r.r}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>` : dot(x, r.y, r.r, BLUE);
      if (!r.ghost) beat = Math.max(beat, Math.exp(-(sweep - x) / 14));
    }
    b += r.ghost ? `<g class="ghost">${s}</g>` : `<g data-part="rate">${s}</g>`;
  }
  b += `<path d="M${f(Math.min(sweep, X1))} 70 V226" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  b += T(X1, 254, 'beats over time →', 'xs muted', 'end');
  if (!para) b += T(X0, 282, 'bigger dots: stronger beats', 'xs', 'start');
  // The heart, its nerve and the messenger docking on it.
  const s = 1.45 * (1 + (para ? .07 : .13) * beat);
  b += heartIcon(76, 152, s) + T(76, 254, 'heart', 'sm b');
  const nerve = 'M22 0 C24 40 54 54 68 96';
  b += `<path d="${nerve}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"${para ? ' stroke-dasharray="10 6"' : ''}/>`;
  b += [[-6, 108], [6, 116], [-2, 124]].map(([dx, y]) => dot(70 + dx, y, 4, col)).join('');
  b += `<g data-part="${para ? 'muscarinic' : 'beta1'}">${T(50, 30, para ? 'parasympathetic nerve' : 'sympathetic nerve', `xs b ${para ? 'green' : 'red'}`, 'start')}</g>`;
  return b;
}
const heartScene = kind => ({
  duration: 4200, loop: true,
  render: t => svg(kind === 'para-heart'
    ? 'A heart with a dashed green parasympathetic nerve docking acetylcholine on its M receptors. Beside it, two strips of heartbeats drawn as dots over the same stretch of time: dashed, closer dots for how fast it would beat if the brake were off, and blue dots further apart for the real resting rate, held down by acetylcholine. A sweep draws the beats and the heart swells with each one.'
    : 'A heart with a red sympathetic nerve docking noradrenaline on its beta-1 receptors. Two strips of heartbeats over the same stretch of time: dashed dots for the resting rate, and bigger blue dots closer together with noradrenaline: a faster rate and a stronger squeeze. The heart swells more with each beat.', heartArt(kind, t), { h: 296 })
});

/* ---------- Step 10: an arteriole narrows ---------- */
function alphaArt(t) {
  const u = ease.inOut(span(t, .3, .82)), hw = lerp(40, 22, u), cy = 168, rel = span(t, .05, .45), RINGS = [80, 160, 320, 400];
  let b = `<path d="M240 0 V58" stroke="${SYM}" stroke-width="7" stroke-linecap="round"/><ellipse cx="240" cy="66" rx="26" ry="12" fill="#fff" stroke="${SYM}" stroke-width="3"/>`;
  b += T(258, 24, 'sympathetic nerve', 'xs b red', 'start');
  // The tube: walls, muscle rings carrying alpha-1 receptors, blood flowing through.
  b += `<g data-part="arteriole"><rect x="24" y="${f(cy - hw)}" width="432" height="${f(2 * hw)}" fill="${ORGAN}"/><path d="M24 ${f(cy - hw)} H456 M24 ${f(cy + hw)} H456" stroke="${WALL}" stroke-width="5"/>`;
  for (const x of RINGS) b += `<ellipse cx="${x}" cy="${cy}" rx="7" ry="${f(hw + 7)}" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  b += arrow(`M190 ${cy} H${f(lerp(290, 262, u))}`, SYM, f(lerp(9, 5, u))) + '</g>';
  b += `<g class="ghost"><path d="M18 ${cy - 40} H462 M18 ${cy + 40} H462" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/></g>`;
  b += `<g data-part="alpha1">${RINGS.map(x => dot(x, cy - hw - 8, 5.5, '#fff', `stroke="${SYM}" stroke-width="2.5"`)).join('')}${T(24, 108, 'alpha-1 receptors', 'xs b red', 'start')}</g>`;
  // Noradrenaline drifting from the nerve onto the receptors of the two nearest rings.
  [[160, 0], [320, .08], [160, .16], [320, .24], [200, .12], [280, .2]].forEach(([x, lag]) => {
    const v = ease.out(span(rel, lag, lag + .6));
    if (v > 0) b += dot(lerp(240, x, v), lerp(80, cy - hw - 18, v), 5, SYM, op(1 - .6 * span(t, .85, 1)));
  });
  b += T(24, cy + 70, 'arteriole: a muscle-ringed tube', 'xs b', 'start');
  b += `<g ${op(span(t, .45, .8))}>${arrow(`M440 ${cy - 62} V${f(cy - hw - 6)}`, BLUE, 3)}${arrow(`M440 ${cy + 62} V${f(cy + hw + 6)}`, BLUE, 3)}${T(430, cy - 46, 'narrower', 'sm b blue', 'end')}</g>`;
  // Blood pressure rises as the arteriole narrows.
  const bar = lerp(.42, .7, u);
  b += `<g data-part="bp">${T(24, 296, 'blood pressure', 'sm', 'start')}<rect x="172" y="282" width="270" height="18" fill="#fff" stroke="${C.rule}"/><rect x="172" y="282" width="${f(270 * bar)}" height="18" fill="${BLUE}"/></g>`;
  b += `<rect class="ghost" x="172" y="278" width="${f(270 * .42)}" height="26" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  b += `<g ${op(span(t, .55, .85))}>${T(442, 330, 'higher ↑', 'sm b blue', 'end')}</g>`;
  return b;
}

/* ---------- Step 11: the adrenal gland ---------- */
function adrenalArt(t) {
  let b = `<rect x="392" y="24" width="44" height="352" fill="${ORGAN}"/><path d="M392 24 V376 M436 24 V376" stroke="${WALL}" stroke-width="3"/>`;
  b += arrow('M414 70 V34', INK, 2.5) + T(386, 42, 'to the whole body', 'xs b', 'end');
  b += `<path d="M80 256 C60 196 150 186 196 214 C226 232 270 228 282 262 C296 304 250 342 194 338 C146 334 96 318 80 256 Z" fill="${ORGAN}" stroke="${WALL}" stroke-width="3"/>${T(186, 290, 'kidney', 'sm on-organ')}`;
  b += `<g data-part="adrenal"><path d="M104 214 Q138 150 182 146 Q226 152 246 210 Q178 190 104 214 Z" fill="#f0dfb4" stroke="#7a5c00" stroke-width="3"/>${T(12, 132, 'adrenal gland', 'sm b', 'start')}</g>`;
  b += `<path d="M240 190 C300 186 330 196 392 196" fill="none" stroke="${ORGAN}" stroke-width="18"/><path d="M240 181 C300 177 330 187 392 187 M240 199 C300 195 330 205 392 205" fill="none" stroke="${WALL}" stroke-width="2"/>`;
  // The sympathetic nerve fires; the gland answers with adrenaline into the blood.
  b += `<path d="M30 0 C60 60 130 90 172 150" fill="none" stroke="${SYM}" stroke-width="6" stroke-linecap="round"/>`;
  const p = span(t, 0, .18);
  if (p > 0 && p < 1) { const [x, y] = bez([30, 0], [60, 60], [130, 90], [172, 150], p); b += dot(x, y, 9, SYM, 'opacity=".85"'); }
  b += T(70, 24, 'sympathetic nerve', 'xs b red', 'start');
  let a = '';
  for (let k = 0; k < 9; k++) {
    const u = span(t, .16 + k * .04, .62 + k * .04);
    if (u <= 0 || u >= 1) continue;
    const x = u < .4 ? lerp(200, 414, u / .4) : 414 + (k % 3 - 1) * 8, y = u < .4 ? lerp(186, 196, u / .4) : lerp(196, 40, (u - .4) / .6);
    a += dot(x, y, 7, SYM);
  }
  b += `<g data-part="adrenaline">${a}${dot(30, 366, 7, SYM)}${T(46, 372, 'adrenaline, carried in the blood', 'sm', 'start')}</g>`;
  return b;
}

/* ---------- Step 12: the pupil's tug of war ---------- */
function pupilArt(t) {
  const cx = 240, cy = 168;
  // Brake wins, then the accelerator wins, then back to the middle.
  const small = Math.sin(Math.PI * span(t, .04, .44)), large = Math.sin(Math.PI * span(t, .52, .92));
  const r = 36 - 16 * small + 18 * large;
  let b = `<path d="M24 ${cy} Q240 -10 456 ${cy} Q240 346 24 ${cy} Z" fill="#fff" stroke="${INK}" stroke-width="3"/>${dot(cx, cy, 112, IRIS)}`;
  b += `<g data-part="spoke">`;
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, c = Math.cos(a), s = Math.sin(a);
    b += `<path d="M${f(cx + (r + 22) * c)} ${f(cy + (r + 22) * s)} L${f(cx + 104 * c)} ${f(cy + 104 * s)}" stroke="${SYM}" stroke-width="${f(3.5 + 2 * large)}" stroke-linecap="round"/>`;
  }
  b += `</g><g data-part="ring"><circle cx="${cx}" cy="${cy}" r="${f(r + 10)}" fill="none" stroke="${PARA}" stroke-width="${f(10 + 5 * small)}" stroke-dasharray="9 4"/></g>`;
  b += `<g data-part="pupil">${dot(cx, cy, r, INK)}</g>`;
  b += fadeIn(small, T(cx, 30, 'brake winning: smaller', 'sm b green')) + fadeIn(large, T(cx, 30, 'accelerator winning: larger', 'sm b red'));
  b += `<g data-part="ring">${T(16, 340, 'ring muscle', 'sm b green', 'start')}${T(16, 362, 'M receptors:', 'xs', 'start')}${T(16, 382, 'acetylcholine → smaller', 'xs', 'start')}</g>`;
  b += `<g data-part="spoke">${T(464, 340, 'spoke muscle', 'sm b red', 'end')}${T(464, 362, 'alpha-1 receptors:', 'xs', 'end')}${T(464, 382, 'noradrenaline → larger', 'xs', 'end')}</g>`;
  b += `<path d="M64 322 L150 236" stroke="${PARA}" stroke-width="2"/><path d="M416 322 L330 246" stroke="${SYM}" stroke-width="2"/>`;
  return b;
}

/* ---------- Step 13: an airway, narrowed by acetylcholine and widened by adrenaline ---------- */
function airwayArt(t) {
  const cx = 210, cy = 190;
  const narrow = Math.sin(Math.PI * span(t, .04, .44)), wide = Math.sin(Math.PI * span(t, .52, .92));
  const r = 46 - 20 * narrow + 22 * wide;
  let b = `<g data-part="airway"><circle cx="${cx}" cy="${cy}" r="118" fill="${AIR}" stroke="${WALL}" stroke-width="3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="${f(r + 20)}" fill="none" stroke="#b5776c" stroke-width="${f(14 + 6 * narrow)}" stroke-dasharray="14 5"/><circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="#fff" stroke="${INK}" stroke-width="2"/>${T(cx, cy + 7, 'air', 'sm on-white')}</g>`;
  // A parasympathetic nerve reaches the muscle from the top left and fires during the first half.
  b += `<path d="M0 54 C60 56 104 84 ${cx - 56} ${cy - 58}" fill="none" stroke="${PARA}" stroke-width="5" stroke-dasharray="9 6" stroke-linecap="round"/>`;
  if (narrow > .05) b += [0, 1, 2].map(k => dot(cx - 50 + k * 9, cy - 46 + k * 8, 4.5, PARA, op(narrow))).join('');
  b += T(8, 30, 'parasympathetic nerve', 'xs b green', 'start');
  // A blood vessel on the right carries adrenaline, which reaches the muscle in the second half.
  b += `<rect x="404" y="48" width="40" height="280" fill="${ORGAN}"/><path d="M404 48 V328 M444 48 V328" stroke="${WALL}" stroke-width="3"/>`;
  for (const y of [78, 138, 198, 258, 308]) b += dot(424, y, 6, SYM);
  b += T(472, 30, 'blood with adrenaline', 'xs b red', 'end');
  if (wide > .05) b += [0, 1, 2].map(k => dot(lerp(396, cx + r + 24, wide) - k * 8, cy - 8 + k * 10, 5, SYM, op(wide))).join('');
  b += fadeIn(narrow, T(cx, 336, 'brake: narrower', 'sm b green')) + fadeIn(wide, T(cx, 336, 'adrenaline: wider', 'sm b red'));
  b += `<g data-part="muscarinic">${T(8, 362, 'acetylcholine on M:', 'xs', 'start')}${T(8, 384, 'tightens: narrower', 'xs b green', 'start')}</g>`;
  b += `<g data-part="beta2">${T(472, 362, 'adrenaline on beta-2:', 'xs', 'end')}${T(472, 384, 'relaxes: wider', 'xs b red', 'end')}</g>`;
  return b;
}

/* ---------- Step 14: the baroreflex, once round the loop ---------- */
function reflexArt(t) {
  const up = ease.inOut(span(t, .02, .2)), down = ease.inOut(span(t, .7, .92)), level = .5 + .32 * up - .32 * down;
  const hot = span(t, .14, .26) * (1 - span(t, .78, .9));      // sensors firing faster
  const brake = span(t, .3, .42) * (1 - span(t, .82, .94));    // brake pressed, accelerator eased
  let b = '';
  // Pressure, felt by sensors in the artery wall.
  b += `<g data-part="bp"><rect x="40" y="56" width="30" height="140" fill="#fff" stroke="${C.rule}" stroke-width="2"/><rect x="40" y="${f(196 - 140 * level)}" width="30" height="${f(140 * level)}" fill="${BLUE}"/></g>`;
  b += `<path class="ghost" d="M32 126 H78" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 4"/>`;
  b += T(55, 224, 'blood', 'xs b') + T(55, 246, 'pressure', 'xs b');
  const path = [[78, 62], [150, 36], [250, 36], [298, 64]];
  b += `<g data-part="reflex">${dot(74, 62, 7, BLUE)}<path d="${bezPath(path)}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-dasharray="3 6"/>`;
  for (let k = 0; k < 6; k++) { if (k >= 2 + Math.round(4 * hot)) continue; const [x, y] = bez(...path, (t * (2 + 4 * hot) + k / 6) % 1); b += dot(x, y, 4.5, BLUE); }
  b += T(188, 22, 'sensors report pressure', 'xs b blue') + '</g>';
  // The brainstem sets the two branches.
  b += `<ellipse cx="372" cy="80" rx="80" ry="34" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>${T(372, 86, 'brainstem', 'sm b on-organ')}`;
  b += `<path d="M338 112 C322 170 302 210 274 248" fill="none" stroke="${SYM}" stroke-width="${f(5.5 - 3.5 * brake)}" stroke-linecap="round"/>`;
  b += `<path d="M404 112 C414 170 380 220 316 254" fill="none" stroke="${PARA}" stroke-width="${f(3 + 4 * brake)}" stroke-dasharray="9 6" stroke-linecap="round"/>`;
  b += `<g ${op(.35 + .65 * brake)}>${T(304, 168, 'accelerator eased', 'xs b red', 'end')}${T(472, 266, 'brake pressed', 'xs b green', 'end')}</g>`;
  // The heart slows, and pressure falls back.
  const rate = lerp(1, .55, span(t, .4, .55) * (1 - span(t, .88, 1)));
  const beat = Math.pow(Math.max(0, Math.sin(Math.PI * ((t * 9 * rate) % 1))), 8);
  b += heartIcon(294, 290, 1.2 * (1 + .1 * beat)) + T(294, 356, 'heart', 'sm b');
  b += `<g ${op(span(t, .45, .55))}>${T(350, 304, 'slower beats', 'xs b', 'start')}</g>`;
  b += arrow('M252 306 C170 326 96 300 64 262', INK, 2.5, 'stroke-dasharray="6 5"');
  b += `<g ${op(span(t, .72, .82))}>${T(150, 352, 'pressure falls back', 'xs b blue')}</g>`;
  b += `<g ${op(1 - span(t, .2, .3) + span(t, .92, 1))}>${T(88, 120, 'pressure rises', 'xs b blue', 'start')}</g>`;
  return b;
}

/* ---------- The whole picture: a map of the receptors, the base for every change ----------
   Two messengers along the top. Each row is an organ: its receptor types (red for the sympathetic family,
   green for M) and a drawing of what it does: beats (closer: faster; bigger: stronger), a tube, a bar, a
   ring and an eye. A change is drawn over a dashed ghost of normal, with what moved named in blue. */
const ROWS = [
  { id: 'heart', name: 'heart', part: 'rate', tags: [['beta-1', 'b', 'b1'], ['M', 'm', 'm']] },
  { id: 'arteriole', name: 'arterioles', part: 'arteriole', tags: [['alpha-1', 'a', 'a1']] },
  { id: 'bp', name: 'blood pressure', part: 'bp', tags: [] },
  { id: 'airway', name: 'airways', part: 'airway', tags: [['beta-2', 'b', 'b2'], ['M', 'm', 'm']] },
  { id: 'pupil', name: 'pupil', part: 'pupil', tags: [['alpha-1', 'a', 'a1'], ['M', 'm', 'm']] }
];
const TOP = 54, ROW = 62;
const pw = (x, k) => Math.pow(Math.max(x, 1e-6), k);
// How each organ is drawn for a state (exponents exaggerate differences so they read at a glance).
const look = o => ({
  gap: clamp(46 * pw(o.HR, -1.05), 18, 90), r: clamp(7.5 * pw(o.SV, .9), 4, 12),
  hw: clamp(15 * pw(o.R, -1.5), 5, 26), bp: clamp(.5 * pw(o.P, 1.5), .06, 1),
  lumen: clamp(13 * pw(o.airway, 1.1), 3, 25), pupil: clamp(10 * pw(o.pupil, 1.15), 3, 21)
});
// Which receptors a state's drugs act on.
const drugsOf = p => ({
  m: p.mAg > .3 ? 'on' : p.mFree < .6 ? 'block' : '',
  a: p.aAg > .3 ? 'on' : p.aFree < .6 ? 'block' : '',
  b: p.bAg > .3 ? 'on' : p.bFree < .6 ? 'block' : '',
  che: p.che < .6
});
const tw = (s, px = 17) => s.length * px * .56;  // a label's rough width
function organDrawing(id, L, y, ghost) {
  const cy = y + 32;
  let s = '', g = '';
  if (id === 'heart') {
    for (let x = 176; x <= 352; x += L.gap) s += dot(x, cy, L.r, BLUE);
    if (ghost) for (let x = 176; x <= 352; x += ghost.gap) g += `<circle cx="${f(x)}" cy="${cy}" r="${f(ghost.r)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`;
    s = `<path d="M166 ${cy} H356" stroke="${C.rule}" stroke-width="2"/>` + s;
  }
  if (id === 'arteriole') {
    s = `<rect x="166" y="${f(cy - L.hw)}" width="190" height="${f(2 * L.hw)}" fill="${ORGAN}"/><path d="M166 ${f(cy - L.hw)} H356 M166 ${f(cy + L.hw)} H356" stroke="${WALL}" stroke-width="3.5"/>`;
    if (ghost) g = `<path d="M162 ${f(cy - ghost.hw)} H360 M162 ${f(cy + ghost.hw)} H360" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  }
  if (id === 'bp') {
    s = `<rect x="166" y="${cy - 9}" width="190" height="18" fill="#fff" stroke="${C.rule}"/><rect x="166" y="${cy - 9}" width="${f(190 * L.bp)}" height="18" fill="${BLUE}"/>`;
    if (ghost) g = `<rect x="166" y="${cy - 13}" width="${f(190 * ghost.bp)}" height="26" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  if (id === 'airway') {
    s = `${dot(261, cy, 28, AIR, `stroke="${WALL}" stroke-width="2.5"`)}${dot(261, cy, L.lumen, '#fff', `stroke="${INK}" stroke-width="2"`)}`;
    if (ghost) g = `<circle cx="261" cy="${cy}" r="${f(ghost.lumen)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`;
  }
  if (id === 'pupil') {
    s = `<path d="M201 ${cy} Q261 ${cy - 34} 321 ${cy} Q261 ${cy + 34} 201 ${cy} Z" fill="#fff" stroke="${INK}" stroke-width="2"/>${dot(261, cy, 23, IRIS)}${dot(261, cy, L.pupil, INK)}`;
    if (ghost) g = `<circle cx="261" cy="${cy}" r="${f(ghost.pupil)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 3"/>`;
  }
  return { s, g };
}
// What a change moved, in words: [measure, word if it rose, word if it fell].
const MEASURES = {
  HR: ['Heart rate', 'faster ↑', 'slower ↓'], SV: ['Squeeze strength', 'stronger', 'weaker'],
  R: ['Arterioles', 'narrower ↓', 'wider ↑'], P: ['Blood pressure', 'higher ↑', 'lower ↓'],
  airway: ['Airways', 'wider ↑', 'narrower ↓'], pupil: ['Pupils', 'larger ↑', 'smaller ↓']
};
// The changes each step names on the picture (its main effects; the rest of the picture moves too).
const NAMED = {
  mag: ['HR', 'P', 'airway', 'pupil'], mant: ['HR', 'airway', 'pupil'], che: ['HR', 'P', 'airway', 'pupil'],
  aag: ['R', 'P', 'HR', 'pupil'], ablock: ['R', 'P', 'HR', 'pupil'], bag: ['HR', 'SV', 'R', 'airway'], bblock: ['HR', 'SV', 'P', 'airway'],
  explore: ['HR', 'SV', 'R', 'P', 'airway', 'pupil']
};
const REFLEX_NOTE = { aag: 'the reflex', ablock: 'the reflex' };
const moved = (o, k) => { const r = o[k] / BASE[k]; return r > 1.05 ? 'up' : r < .95 ? 'down' : 'same'; };
const word = (o, k) => { const d = moved(o, k); return d === 'up' ? MEASURES[k][1] : d === 'down' ? MEASURES[k][2] : ''; };
function mapArt(o, { ghost = null, kind = '', legend = '', a = 1, drugA = 1 } = {}) {
  const L = look(o), G = ghost ? look(ghost) : null, d = drugsOf(o.p), named = NAMED[kind] || [];
  let b = '';
  // The messengers along the top.
  b += `<g data-part="ne">${T(12, 22, 'sympathetic', 'sm b red', 'start')}${T(12, 44, 'noradrenaline', 'xs', 'start')}${[0, 1, 2].map(k => dot(148 + 14 * k, 39, 5, SYM)).join('')}</g>`;
  const nAch = clamp(Math.round(3 * Math.pow(o.ach / BASE.ach, 1.2)), 1, 9);
  const CL = [[398, 39], [412, 39], [426, 39], [405, 28], [419, 28], [405, 50], [419, 50], [433, 28], [433, 50]];
  b += `<g data-part="ach">${T(468, 22, 'parasympathetic', 'sm b green', 'end')}${T(268, 44, 'acetylcholine', 'xs', 'start')}${CL.slice(0, nAch).map(([x, y]) => dot(x, y, 5, PARA)).join('')}</g>`;
  b += `<g data-part="enzyme">${enzyme(458, 46, 10, .5)}${d.che ? `<g ${op(drugA)}>${cross(458, 40, 7)}</g>` : ''}</g>`;
  b += `<path d="M12 ${TOP - 2} H468" stroke="${C.rule}" stroke-width="1.5"/>`;
  ROWS.forEach((row, i) => {
    const y = TOP + i * ROW;
    if (i) b += `<path d="M12 ${y} H468" stroke="${C.panel}" stroke-width="1"/>`;
    const { s, g } = organDrawing(row.id, L, y, G);
    b += `<g data-part="${row.part}">${T(12, y + 26, row.name, 'sm b', 'start')}${s}</g>`;
    if (g) b += `<g class="ghost" data-ghost="normal">${g}</g>`;
    let x = 12;
    for (const [tag, fam, part] of row.tags) {
      const act = d[fam], col = fam === 'm' ? PARA : SYM;
      let t = '';
      if (act) { t += `<g data-part="drug" ${op(drugA)}>${act === 'on' ? diamond(x + 7, y + 47, 7) : plug(x + 7, y + 47, 14, 12)}</g>`; x += 18; }
      t += T(x, y + 53, tag, `xs b ${tint(col)}`, 'start');
      b += `<g data-part="${part}">${t}</g>`;
      x += tw(tag) + 14;
    }
    // What moved, named in blue on the row.
    const keys = { heart: ['HR', 'SV'], arteriole: ['R'], bp: ['P'], airway: ['airway'], pupil: ['pupil'] }[row.id].filter(k => named.includes(k));
    const words = keys.map(k => word(o, k)).filter(Boolean);
    if (words.length && a > 0) {
      let w = `${T(470, y + 28, words[0], 'sm b blue', 'end')}`;
      if (words[1]) w += T(470, y + 50, words[1], 'xs b blue', 'end');
      else if (row.id === 'heart' && REFLEX_NOTE[kind]) w += T(470, y + 50, REFLEX_NOTE[kind], 'xs muted', 'end');
      b += `<g data-named ${op(a)}>${w}</g>`;
    }
  });
  // The key under the picture.
  let ky = TOP + ROWS.length * ROW + 22, kx = 12;
  const items = [];
  if (ghost) items.push([`<path d="M0 -6 H28" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>`, 'normal', 36]);
  if (ghost && legend) items.push([`<path d="M0 -6 H28" stroke="${BLUE}" stroke-width="5"/>`, legend, 36]);
  if (d.m === 'on' || d.a === 'on' || d.b === 'on') items.push([diamond(8, -6, 7), 'drug switches it on', 22]);
  if (d.m === 'block' || d.a === 'block' || d.b === 'block') items.push([plug(8, -6, 14, 12), 'drug blocks it', 22]);
  if (d.che) items.push([cross(8, -6, 6), 'enzyme stopped', 22]);
  if (!ghost) items.push([dot(6, -6, 6, SYM), 'red: sympathetic receptors', 18], [dot(6, -6, 6, PARA), 'green: M', 18]);
  let rows = 1;
  for (const [icon, w, pad] of items) {
    const width = pad + tw(w);
    if (kx > 12 && kx + width > 472) { kx = 12; ky += 24; rows++; }
    b += `<g transform="translate(${f(kx)} ${ky})">${icon}${T(pad, 0, w, 'xs', 'start')}</g>`;
    kx += width + 18;
  }
  const attrs = s => `data-hr="${(s.HR / BASE.HR).toFixed(4)}" data-strength="${(s.SV / BASE.SV).toFixed(4)}" data-pressure="${(s.P / BASE.P).toFixed(4)}" data-arteriole="${(s.R / BASE.R).toFixed(4)}" data-airway="${(s.airway / BASE.airway).toFixed(4)}" data-pupil="${(s.pupil / BASE.pupil).toFixed(4)}" data-ach="${(s.ach / BASE.ach).toFixed(4)}"`;
  return { body: `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${b}</g>`, h: ky + 10 };
}
const mapSvg = (label, o, opt) => { const { body, h } = mapArt(o, opt); return svg(label, body, { h }); };

/* ---------- Words: comparisons and text alternatives ---------- */
// Arterioles are drawn and named by their width, which falls as their tightness rises.
const FLIP = { up: 'down', down: 'up', same: 'same' };
const rowsFor = (o, kind) => (NAMED[kind] || NAMED.explore).map(k => {
  const dir = k === 'R' ? FLIP[moved(o, k)] : moved(o, k), w = word(o, k).replace(/ [↑↓]$/, '');
  return [MEASURES[k][0], dir, dir === 'same' ? 'about the same' : w];
});
const readoutOf = (o, kind) => readout(rowsFor(o, kind));
const describe = (o, kind) => rowsFor(o, kind).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join(', ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const TITLE = { mag: 'Muscarinic agonists', mant: 'Muscarinic antagonists', che: 'Cholinesterase inhibitors', aag: 'Alpha-1 agonists', ablock: 'Alpha-1 blockers', bag: 'Nonselective beta agonists', bblock: 'Beta-blockers' };
const WHERE = {
  mag: 'Purple diamonds, the drug, sit on every M receptor tag: heart, airways and pupil.',
  mant: 'Purple plugs, the blocker, sit on every M receptor tag, so acetylcholine cannot dock.',
  che: 'A purple cross stops cholinesterase, and green acetylcholine dots crowd the top of the picture.',
  aag: 'Purple diamonds sit on the alpha-1 tags of the arterioles and the pupil.',
  ablock: 'Purple plugs sit on the alpha-1 tags of the arterioles and the pupil.',
  bag: 'Purple diamonds sit on the beta-1 tag of the heart and the beta-2 tag of the airways.',
  bblock: 'Purple plugs sit on the beta-1 tag of the heart and the beta-2 tag of the airways.'
};
function change(kind) {
  return {
    duration: 3000,
    render(t) {
      const o = steady(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease.inOut(span(t, .12, .78))));
      const label = `${TITLE[kind]}, drawn over a faint dashed picture of normal. ${WHERE[kind]} Compared with normal: ${describe(o, kind)}.`;
      return { svg: mapSvg(label, o, { ghost: BASE, kind, legend: 'with the drug', a: span(t, .6, .92), drugA: span(t, 0, .2) }), readout: readoutOf(o, kind) };
    }
  };
}
const scenes = {
  wiring: { duration: 3600, loop: true, render: t => svg('The brain and spinal cord on the left, with nerves running out to five organs on the right: the eyes, lungs, heart, blood vessels and gut. Blue signals run along every nerve, all the time.', wiringArt(t), { h: 410 }) },
  branches: { duration: 3600, loop: true, render: t => svg('The same wiring in two branches. Solid red nerves, the sympathetic accelerator, leave the middle of the spinal cord and reach the eyes, heart, blood vessels and gut, but hardly the airway muscle of the lungs. Dashed green nerves, the parasympathetic brake, leave the brainstem and the bottom of the cord and reach the eyes, lungs, heart and gut, but not the blood vessels.', branchesArt(t), { h: 420 }) },
  synapse: synapseScene('synapse'),
  ach: synapseScene('ach'),
  enzyme: synapseScene('enzyme'),
  ne: synapseScene('ne'),
  reuptake: synapseScene('reuptake'),
  'para-heart': heartScene('para-heart'),
  beta: heartScene('beta'),
  alpha: { duration: 3400, render: t => svg('A sympathetic nerve above an arteriole, a small artery ringed with muscle. Red noradrenaline dots fall onto the muscle’s alpha-1 receptors, the muscle tightens and the tube narrows inside its dashed, wider outline. Blue arrows mark it narrower, and a blood pressure bar below grows past its dashed normal: higher.', alphaArt(t), { h: 340 }) },
  adrenal: { duration: 4400, loop: true, render: t => svg('A kidney with an adrenal gland sitting on top. A red sympathetic nerve fires into the gland, and red dots of adrenaline leave it through a small vein into a large blood vessel that carries them up to the whole body.', adrenalArt(t), { h: 384 }) },
  pupil: { duration: 5200, loop: true, render: t => svg('A large eye. Around the black pupil, a green ring muscle with M receptors pulls it smaller when acetylcholine arrives; red spoke-like muscles with alpha-1 receptors pull it larger when noradrenaline arrives. The pupil shrinks while the brake wins, then grows while the accelerator wins.', pupilArt(t), { h: 392 }) },
  airway: { duration: 5200, loop: true, render: t => svg('An airway in cross-section: air in the middle, wrapped in a ring of muscle. First a dashed green parasympathetic nerve releases acetylcholine onto M receptors: the muscle tightens and the airway narrows. Then red adrenaline from a blood vessel on the right reaches beta-2 receptors: the muscle relaxes and the airway widens.', airwayArt(t), { h: 394 }) },
  reflex: { duration: 6400, loop: true, render: t => svg('The baroreflex as a loop. A blood pressure bar rises; blue signals from pressure sensors run faster to the brainstem; the brainstem eases the red accelerator nerve and presses the green brake nerve; the heart beats more slowly; and the pressure bar falls back to its dashed normal level.', reflexArt(t), { h: 364 }) },
  whole: () => mapSvg('The whole picture as a map. Along the top, noradrenaline from the sympathetic branch and acetylcholine from the parasympathetic branch, cleared by cholinesterase. Then one row per organ, with its receptor types: the heart, beta-1 and M, drawn as a strip of beats; the arterioles, alpha-1, drawn as a tube; blood pressure as a bar; the airways, beta-2 and M, as a ring; and the pupil, alpha-1 and M, in an eye.', BASE),
  mag: change('mag'), mant: change('mant'), che: change('che'), aag: change('aag'), ablock: change('ablock'), bag: change('bag'), bblock: change('bblock'),
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['symp', 'para', 'che', 'mFree', 'aFree', 'bFree', 'mAg', 'aAg', 'bAg'];
const LESSON_LABEL = { mag: 'Muscarinic agonists', mant: 'Muscarinic antagonists', che: 'Cholinesterase inhibitors', aag: 'Peripheral alpha-1 agonists', ablock: 'Alpha-1 blockers', bag: 'Nonselective beta agonists', bblock: 'Beta-blockers' };
const level = (k, v) => (k === 'symp' || k === 'para') ? (v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : k === 'che' ? (v > .97 ? 'normal' : v > .55 ? 'slowed' : 'mostly stopped')
  : k.endsWith('Ag') ? (v < .05 ? 'none' : v < 1 ? 'some' : 'a lot')
  : (v > .97 ? 'all' : v > .55 ? 'some blocked' : 'mostly blocked');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  for (const k of ['symp', 'para']) { $(`#clinical-${k}`).value = params[k]; $(`#clinical-${k}-label`).textContent = level(k, params[k]); }
  $('#reflex').checked = params.reflex;
}
// The model's resting point on each reference bar (illustrative teaching choices; the guidelines give limits, not
// typical values): a tenth below an upper limit, three-tenths above a lower limit, the middle of a two-sided band.
const BELOW_LIMIT = .9, ABOVE_LIMIT = 1.3;
const reference = id => { const v = data.values.find(x => x.id === id); return v.typical ?? (v.low !== null && v.high !== null ? (v.low + v.high) / 2 : v.high !== null ? v.high * BELOW_LIMIT : v.low * ABOVE_LIMIT); };
function measures(o) {
  const sbp0 = reference('sbp'), dbp0 = reference('dbp'), pp0 = sbp0 - dbp0, map0 = dbp0 + pp0 / 3;
  const map = map0 * o.P, pp = pp0 * o.SV;
  return { hr: o.HR * reference('hr'), sbp: map + 2 * pp / 3, dbp: map - pp / 3 };
}
const fmt = n => n.toFixed(0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
function domain(v) {
  const a = v.low ?? v.high * .6, b = v.high ?? v.low * 2, w = b - a, lo = a - .6 * w, hi = b + .6 * w;
  const pos = n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
  return { pos, lo, hi };
}
function update() {
  syncControls();
  const o = steady(params);
  $('#explore-visual').innerHTML = mapSvg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o, 'explore')}.`, o, { ghost: BASE, kind: 'explore', legend: 'your settings' }) + readoutOf(o, 'explore');
  const rel = `heart rate ×${o.HR.toFixed(2)} · squeeze strength ×${o.SV.toFixed(2)} · arteriole tightness ×${o.R.toFixed(2)} · blood pressure ×${o.P.toFixed(2)} · airway width ×${o.airway.toFixed(2)} · pupil size ×${o.pupil.toFixed(2)}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}`; return; }
  const m = measures(o), unit = id => data.values.find(v => v.id === id).unit;
  $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}. Scaled as in the Clinical values tab: heart rate ${fmt(m.hr)} ${unit('hr')} · pressure ${fmt(m.sbp)}/${fmt(m.dbp)} ${unit('sbp')}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    const { pos } = domain(v), shown = Number(fmt(val));
    row.querySelector('.reading').textContent = `${fmt(val)} ${v.unit}`;
    const marker = row.querySelector('.marker'); marker.setAttribute('x1', pos(val)); marker.setAttribute('x2', pos(val));
    // A two-sided band includes its limits; a "below X" category does not include X.
    // A diagnostic threshold is not a normal range, so the model is only placed relative to the line.
    const above = v.high !== null && (v.low !== null ? shown > v.high : shown >= v.high);
    const status = v.kind === 'threshold' ? (shown < v.low ? 'below the guideline threshold' : 'at or above the guideline threshold')
      : v.low !== null && shown < v.low ? 'below the guideline zone' : above ? 'above the guideline zone' : 'inside the shaded guideline zone';
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'No direction listed for this row') : '';
    dir.classList.toggle('quiet', Boolean(state && !d));
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
$('#reflex').addEventListener('change', e => { params.reflex = e.target.checked; custom(); update(); });
for (const k of ['symp', 'para']) $(`#clinical-${k}`).addEventListener('input', e => {
  params[k] = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the nerves adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  update(); announce();
});
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(CHANGES[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(steady(params)), u = id => data.values.find(v => v.id === id).unit;
    $('#cv-live').textContent = `Model heart rate ${fmt(m.hr)} ${u('hr')}, systolic pressure ${fmt(m.sbp)} ${u('sbp')}, diastolic pressure ${fmt(m.dbp)} ${u('dbp')}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['hr', 'sbp', 'dbp']) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && [v.low, v.high, v.typical].some(n => Number.isFinite(n) && n > 0))) throw new Error('Invalid reference data');
    }
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    const u = id => data.values.find(v => v.id === id).unit;
    $('#baseline-note').textContent = `The guidelines give limits, not typical values, so the teaching model’s resting point is an illustrative choice: heart rate three-tenths above the bradycardia threshold (${fmt(reference('hr'))} ${u('hr')}) and each pressure a tenth below the guideline’s “normal” limit (${fmt(reference('sbp'))}/${fmt(reference('dbp'))} ${u('sbp')}). Each number shown is a relative model result scaled from that resting point. The model’s drug strengths are arbitrary, so the size of each change is illustrative; only its direction is meant to teach.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const { pos, lo, hi } = domain(v), hasLow = v.low !== null, hasHigh = v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const threshold = v.kind === 'threshold';
      const x1 = pos(hasLow ? v.low : lo), x2 = pos(hasHigh ? v.high : hi);
      const band = threshold ? '' : `<rect class="band" x="${x1}" y="12" width="${f(x2 - x1)}" height="22"/>`;
      const edges = threshold ? `<path class="threshold" data-threshold d="M${x1} 2 V44"/>`
        : (hasLow ? `<path class="limit" d="M${x1} 6 V40"/>` : '') + (hasHigh ? `<path class="limit" d="M${x2} 6 V40"/>` : '');
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${edges}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', threshold
        ? `${v.label}: a dashed line marks the guideline's diagnostic threshold, with no normal band, and a marker shows the current illustrative model`
        : `${v.label}: the guideline band and the current illustrative model marker`);
      right.querySelector('.key').textContent = threshold
        ? `Diagnostic threshold, not a normal range: ${v.thresholdMeaning} (${v.low} ${v.unit}, dashed line). No normal band is shown · blue line: model`
        : hasLow && hasHigh ? `Guideline band ${v.low} to ${v.high} ${v.unit} (shaded) · blue line: model`
          : hasHigh ? `Guideline “normal” category: below ${v.high} ${v.unit} (shaded; no lower limit given) · blue line: model`
            : `Guideline lower limit ${v.low} ${v.unit} · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      const quotes = (v.quotes || []).map(q => `“${q.text}” [${q.source}]`).join(' · ');
      cite.textContent = `${quotes ? quotes + ' · ' : ''}${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceDois?.[id]) { const a = document.createElement('a'); a.href = `https://doi.org/${data.sourceDois[id]}`; a.textContent = `DOI ${data.sourceDois[id]}`; li.append(' · ', a); }
      $('#sources').append(li);
    }
    for (const s of data.states) {
      const li = document.createElement('li'); li.textContent = `Directions for ${s.label}: ${s.where} [${s.source}]`;
      $('#sources').append(li);
    }
    const missing = Object.keys(CHANGES).filter(k => !data.states.some(s => s.id === k)).map(k => LESSON_LABEL[k]);
    if (missing.length) $('#unlisted').textContent = `${missing.join(' and ')} appear in the lesson but not here: no open guideline source used for this tab gives a verifiable direction for them on these values, so they are left out rather than guessed.`;
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
