'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* ---------- Drawing ---------- */
const RED = '#b3261e', GREEN = '#1d6b45', BLUE = '#254dff', INK = '#171916', ORGAN = '#f1d6d0', WALL = '#a8584c', PANEL = '#ecefe5', PLUG = '#5d6270';
// Each picture gets its own arrowhead ids: a marker referenced from a hidden step would not draw.
let pictureId = 0;
const svg = (label, body, h = 624) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [RED]: 'r', [GREEN]: 'g' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const block = (x, y, r = 12, attr = 'data-block="enzyme"') => `<g ${attr}><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${RED}" stroke-width="3"/><path d="M${x - r / 2} ${y - r / 2} L${x + r / 2} ${y + r / 2} M${x + r / 2} ${y - r / 2} L${x - r / 2} ${y + r / 2}" stroke="${RED}" stroke-width="3" stroke-linecap="round"/></g>`;
const diamond = (x, y, r = 6, attr = '') => `<path ${attr} d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${INK}"/>`;
const plug = (x, y) => `<rect x="${x - 8}" y="${y}" width="16" height="13" rx="2" fill="${PLUG}" stroke="${INK}" stroke-width="1.5"/>`;
const HEART = 'M0 -6 C-6 -20 -30 -18 -28 2 C-26 16 -8 26 0 34 C8 26 26 16 28 2 C30 -18 6 -20 0 -6 Z';
const heartIcon = (x, y, s) => `<path d="${HEART}" transform="translate(${x} ${y}) scale(${s})" fill="${ORGAN}" stroke="${WALL}" stroke-width="${f(3 / s)}"/>`;

// Messenger dots in the gap: fixed scattered spots, filled in order, so more messenger means more dots.
const DOTS = Array.from({ length: 30 }, (_, i) => [(i * .618034) % 1, 112 + ((i * 7) % 4) * 8]);
// A signal arrow whose thickness shows how strong the signal is.
function signalArrow(x, s, color) {
  const w = f(clamp(3 + 5 * s, 2, 18));
  return `<rect x="${f(x - w / 2)}" y="178" width="${w}" height="32" fill="${color}"/><path d="M${f(x - w / 2 - 6)} 210 L${f(x + w / 2 + 6)} 210 L${x} 226 Z" fill="${color}"/>`;
}
const ghostArrow = x => `<rect class="ghost" x="${x - 4}" y="176" width="8" height="36" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`;

// One synapse close-up: nerve ending, gap with messenger, organ cell with receptor cups, and the signal passed on.
function synapsePanel(side, o, G, { enzyme = false } = {}) {
  const symp = side === 'symp', x0 = symp ? 0 : 244, cx = x0 + 118, c = symp ? RED : GREEN, p = o.p;
  let s = text(cx, 20, symp ? 'sympathetic' : 'parasympathetic', `sm b ${symp ? 'red' : 'green'}`);
  s += `<path d="M${cx} 27 V46" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
  s += `<rect x="${cx - 56}" y="44" width="112" height="60" rx="28" fill="#fff" stroke="${c}" stroke-width="3"/>`;
  for (const [dx, y] of [[-28, 64], [0, 60], [28, 66]]) s += `<circle cx="${cx + dx}" cy="${y}" r="9" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="${cx + dx}" cy="${y}" r="3.5" fill="${c}"/>`;
  s += text(cx, 93, symp ? 'noradrenaline' : 'acetylcholine', 'xs');
  // Messenger in the gap.
  const [lo, hi] = symp ? [-84, 84] : enzyme ? [-86, 48] : [-86, 86];
  const n = clamp(Math.round((symp ? o.ne : o.ach) * 6), 0, DOTS.length);
  s += `<g data-dots="${n}">${DOTS.slice(0, n).map(([u, y]) => `<circle cx="${f(cx + lo + u * (hi - lo))}" cy="${y}" r="4.5" fill="${c}"/>`).join('')}</g>`;
  // Agonist drug molecules (diamonds) over the receptors they switch on.
  const fams = symp
    ? [['alpha', [-74, -40], p.aFree, p.aAg, o.Al], ['beta', [40, 74], p.bFree, p.bAg, o.Be]]
    : [['muscarinic', [-62, -28, 6], p.mFree, p.mAg, o.M]];
  for (const [, xs, , ag] of fams) {
    const k = Math.round(ag * 3), a = cx + xs[0] - 12, b = cx + xs[xs.length - 1] + 12;
    for (let i = 0; i < k; i++) s += diamond(a + ((i * .618034 + .3) % 1) * (b - a), 114 + (i % 3) * 9, 5.5, 'data-agonist');
  }
  // Organ cell membrane and receptor cups.
  s += `<rect x="${x0 + 6}" y="150" width="224" height="26" fill="${ORGAN}"/><path d="M${x0 + 6} 150 H${x0 + 230}" stroke="${WALL}" stroke-width="2"/>`;
  for (const [name, xs, free, ag, sig] of fams) {
    for (const dx of xs) {
      const x = cx + dx;
      s += `<path d="M${x - 10} 139 V150 A10 10 0 0 0 ${x + 10} 150 V139" fill="${PANEL}" stroke="${INK}" stroke-width="3"/>`;
      if (free < .6) s += `<g data-block="receptor">${plug(x, 142)}</g>`;
      else if (ag > .6) s += diamond(x, 150, 6);
      else if (sig > .05) s += `<circle cx="${x}" cy="151" r="4.5" fill="${c}"/>`;
    }
    const mid = cx + (xs[0] + xs[xs.length - 1]) / 2;
    s += text(mid, 169, name, 'xs on-organ');
    if (G) s += ghostArrow(mid);
    s += signalArrow(mid, sig, symp ? RED : GREEN);
  }
  s += symp ? text(cx, 206, 'signal', 'xs') : text(cx - 46, 206, 'signal', 'xs', 'end');
  if (enzyme && !symp) {
    const ex = cx + 82, ey = 139;
    s += `<path d="M${ex} ${ey} L${f(ex - 10.4)} ${ey - 6} A12 12 0 1 1 ${f(ex - 10.4)} ${ey + 6} Z" fill="#d6d9cc" stroke="${INK}" stroke-width="2"/>`;
    if (p.che < .6) s += block(ex, ey, 11);
    s += `<path d="M${ex} 154 V188" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 3"/>` + text(cx + 64, 204, 'cholinesterase', 'xs');
  }
  return s;
}

// Abstract beat counter: one dot per heartbeat over the same stretch of time, so closer dots mean a faster rate.
// (Not a heart tracing; squeeze strength gets its own bar.)
function beatXs(HR) {
  const gap = clamp(54 / HR, 18, 150), xs = [];
  for (let x = 128; x < 452; x += gap) xs.push(f(x));
  return xs;
}
// How the model's state is drawn. Exponents exaggerate differences so they read at a glance.
const pow = (x, k) => Math.pow(Math.max(x, 1e-6), k);
const look = o => ({
  tube: clamp(30 * pow(o.R, -1.8), 8, 54),
  lumen: clamp(24 * pow(o.airway, 1.2), 6, 40),
  pupil: clamp(13 * pow(o.pupil, 1.3), 4, 29),
  bp: clamp(.45 * pow(o.P, 1.3), .03, 1),
  squeeze: clamp(.5 * pow(o.SV, 1.6), .03, 1)
});
const PART_NOTE_POS = { heart: [458, 244, 'end'], vessel: [86, 376, 'middle'], airway: [240, 374, 'middle'], pupil: [394, 384, 'middle'], bp: [464, 520, 'end'] };
// Parts in teaching order: each core step adds the next one or two.
const ALL = ['para', 'enzyme', 'heart', 'symp', 'squeeze', 'vessel', 'bp', 'pupil', 'airway', 'adrenaline', 'reflex'];

// The whole picture. parts: what is drawn so far; ghost: the normal state drawn dashed; notes: short direction words.
function picture(o, { parts = ALL, ghost = null, legend = '', notes = {}, color = INK } = {}) {
  const has = k => parts.includes(k), L = look(o), G = ghost ? look(ghost) : null;
  let b = DEFS;
  if (has('symp')) b += synapsePanel('symp', o, ghost);
  if (has('para')) b += synapsePanel('para', o, ghost, { enzyme: has('enzyme') });
  if (has('heart')) {
    b += heartIcon(50, 296, 1.15);
    b += `<rect x="100" y="250" width="368" height="92" fill="#fff" stroke="#babeb3"/>${text(50, 352, 'heart rate', 'sm')}`;
    b += `<path d="M112 274 H458" stroke="#babeb3" stroke-width="2"/>${text(458, 300, 'beats over time →', 'xs', 'end')}`;
    if (ghost) b += `<g class="ghost">${beatXs(ghost.HR).map(x => `<circle cx="${x}" cy="274" r="11" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`).join('')}</g>`;
    b += `<g data-strip>${beatXs(o.HR).map(x => `<circle cx="${x}" cy="274" r="8" fill="${BLUE}"/>`).join('')}</g>`;
    if (has('squeeze')) {
      const SQ = 204;
      b += text(112, 331, 'squeeze strength', 'xs', 'start');
      b += `<rect x="252" y="319" width="${SQ}" height="14" fill="#fff" stroke="#babeb3"/><rect data-bar="squeeze" x="252" y="319" width="${f(SQ * L.squeeze)}" height="14" fill="${BLUE}"/>`;
      if (G) b += `<rect class="ghost" x="252" y="315" width="${f(SQ * G.squeeze)}" height="22" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    }
  }
  if (has('vessel')) {
    const w = f(L.tube), y = 428;
    b += `<rect x="24" y="${f(y - w / 2)}" width="124" height="${w}" fill="${ORGAN}"/><path d="M24 ${f(y - w / 2)} H148 M24 ${f(y + w / 2)} H148" stroke="${WALL}" stroke-width="4"/>`;
    b += [48, 86, 124].map(x => `<ellipse cx="${x}" cy="${y}" rx="5" ry="${f(w / 2 + 5)}" fill="none" stroke="${INK}" stroke-width="2"/>`).join('');
    if (G) b += `<path class="ghost" d="M20 ${f(y - G.tube / 2)} H152 M20 ${f(y + G.tube / 2)} H152" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    b += text(86, 496, 'arteriole', 'sm');
  }
  if (has('airway')) {
    b += `<circle cx="240" cy="428" r="44" fill="#e7cfc8" stroke="${WALL}" stroke-width="3"/><circle cx="240" cy="428" r="${f(L.lumen)}" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
    if (G) b += `<circle class="ghost" cx="240" cy="428" r="${f(G.lumen)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    b += text(240, 496, 'airway', 'sm');
    if (has('adrenaline')) b += text(240, 515, 'opened by adrenaline in blood', 'xs red');
  }
  if (has('pupil')) {
    b += `<path d="M330 428 Q394 374 458 428 Q394 482 330 428 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="394" cy="428" r="32" fill="#8c9b80"/><circle cx="394" cy="428" r="${f(L.pupil)}" fill="${INK}"/>`;
    if (G) b += `<circle class="ghost" cx="394" cy="428" r="${f(G.pupil)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/>`;
    b += text(394, 496, 'pupil', 'sm');
  }
  if (has('bp')) {
    const W = 292;
    b += text(20, 540, 'blood pressure', 'sm', 'start');
    b += `<rect x="168" y="527" width="${W}" height="16" fill="#fff" stroke="#babeb3"/><rect data-bar="pressure" x="168" y="527" width="${f(W * L.bp)}" height="16" fill="${BLUE}"/>`;
    if (G) b += `<rect class="ghost" x="168" y="523" width="${f(W * G.bp)}" height="24" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  if (has('reflex')) {
    b += arrow('M6 552 V36 H106', BLUE, 2.5, 'stroke-dasharray="2 7"') + arrow('M130 36 H350', BLUE, 2.5, 'stroke-dasharray="2 7"');
    b += text(20, 240, 'pressure reflex', 'xs blue', 'start');
  }
  for (const [part, word] of Object.entries(notes)) { const [x, y, a] = PART_NOTE_POS[part]; b += text(x, y, word, `sm b ${color === RED ? 'red' : 'green'}`, a); }
  return withState(o, b, ghost, legend);
}
// Wraps a drawing with the state it shows (read by the smoke test) and the normal-versus-changed legend.
function withState(o, b, ghost, legend) {
  const attrs = s => `data-hr="${s.HR.toFixed(4)}" data-strength="${s.SV.toFixed(4)}" data-pressure="${s.P.toFixed(4)}" data-arteriole="${s.R.toFixed(4)}" data-airway="${s.airway.toFixed(4)}" data-pupil="${s.pupil.toFixed(4)}" data-ach="${s.ach.toFixed(4)}"`;
  let out = `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${b}</g>`;
  if (ghost) {
    out += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}><path d="M20 592 H46" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/></g>${text(52, 598, 'normal', 'sm', 'start')}`;
    out += `<path d="M150 592 H176" stroke="${BLUE}" stroke-width="6"/>${text(182, 598, legend, 'sm blue', 'start')}`;
    const p = o.p, keys = [];
    if (p.mFree < .6 || p.aFree < .6 || p.bFree < .6) keys.push([`<g>${plug(28, 606)}</g>`, 'blocker in receptor']);
    if (p.mAg > .3 || p.aAg > .3 || p.bAg > .3) keys.push([diamond(28, 613, 6), 'agonist drug']);
    if (p.che < .6) keys.push([`<g transform="translate(28 613) scale(.7) translate(-28 -613)">${block(28, 613, 11, '')}</g>`, 'enzyme stopped']);
    keys.forEach(([icon, word], i) => { out += `<g transform="translate(${i * 200} 0)">${icon}${text(44, 619, word, 'sm', 'start')}</g>`; });
  }
  return out;
}

// Zoomed close-up of one synapse for the steps that introduce it.
function zoomPicture(side, { enzyme = false, note = '' } = {}) {
  const cx = (side === 'symp' ? 0 : 244) + 118, k = 1.75;
  const b = DEFS + `<g transform="translate(${f(240 - k * cx)} 96) scale(${k})">${synapsePanel(side, BASE, null, { enzyme })}</g>` + text(240, 528, note[0], 'sm') + text(240, 554, note[1], 'sm');
  return withState(BASE, b, null, '');
}

// Steps 1 and 2: brain and spinal cord wired to the organs.
const ORGANS = [['eyes', 84], ['lungs', 196], ['heart', 300], ['blood vessels', 404], ['gut', 500]];
function wiringPicture(branches) {
  let b = DEFS + `<ellipse cx="110" cy="84" rx="74" ry="52" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/>${text(110, 90, 'brain', 'on-organ')}`;
  b += `<rect x="100" y="130" width="22" height="400" rx="11" fill="#f3e3df" stroke="${WALL}" stroke-width="3"/><text transform="translate(80 330) rotate(-90)" text-anchor="middle" class="sm">spinal cord</text>`;
  // Organ icons.
  b += `<path d="M330 84 Q370 58 410 84 Q370 110 330 84 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="370" cy="84" r="13" fill="#8c9b80"/><circle cx="370" cy="84" r="6" fill="${INK}"/>`;
  b += `<path d="M366 170 C346 166 330 190 332 214 C334 230 360 230 366 216 Z M374 170 C394 166 410 190 408 214 C406 230 380 230 374 216 Z" fill="${ORGAN}" stroke="${WALL}" stroke-width="2.5"/>`;
  b += heartIcon(370, 292, 1);
  b += `<rect x="326" y="394" width="88" height="20" fill="${ORGAN}"/><path d="M326 394 H414 M326 414 H414" stroke="${WALL}" stroke-width="3"/>`;
  b += `<path d="M334 486 C344 470 356 502 368 486 C380 470 392 502 404 486 C412 476 418 492 410 504 C398 520 386 492 374 506 C362 520 350 494 338 506" fill="none" stroke="${WALL}" stroke-width="6" stroke-linecap="round"/>`;
  for (const [name, y] of ORGANS) b += text(370, y + 44, name, 'sm');
  if (!branches) {
    const from = { eyes: [180, 90], lungs: [122, 196], heart: [122, 290], 'blood vessels': [122, 400], gut: [122, 470] };
    for (const [name, y] of ORGANS) { const [x0, y0] = from[name]; b += arrow(`M${x0} ${y0} C${x0 + 80} ${y0} ${240} ${y} 316 ${y}`, INK, 2.5); }
    b += text(240, 600, 'signals run without you thinking', 'sm');
  } else {
    // Sympathetic leaves the middle of the spinal cord; airway muscle in the lungs gets almost none of it.
    // Parasympathetic leaves the brainstem and the bottom of the cord, and most blood vessels get none.
    const sympFrom = { eyes: 200, heart: 260, 'blood vessels': 330, gut: 380 };
    for (const [name, y] of ORGANS) if (sympFrom[name]) b += arrow(`M122 ${sympFrom[name]} C200 ${sympFrom[name]} 230 ${y - 8} 316 ${y - 8}`, RED, 3);
    const paraFrom = { eyes: [168, 112], lungs: [122, 146], heart: [122, 156], gut: [122, 510] };
    for (const [name, y] of ORGANS) {
      if (!paraFrom[name]) continue;
      const [x0, y0] = paraFrom[name];
      b += arrow(`M${x0} ${y0} C${x0 + 90} ${y0} 240 ${y + 8} 316 ${y + 8}`, GREEN, 3, 'stroke-dasharray="9 6"');
    }
    b += `<path d="M24 576 H62" stroke="${RED}" stroke-width="4"/>${text(70, 582, 'sympathetic: accelerator', 'sm red b', 'start')}`;
    b += `<path d="M24 606 H62" stroke="${GREEN}" stroke-width="4" stroke-dasharray="9 6"/>${text(70, 612, 'parasympathetic: brake', 'sm green b', 'start')}`;
  }
  return b;
}

// Step 3: a generic close-up of one synapse.
function synapseCloseUp() {
  const GREY = '#5d6270';
  let b = DEFS + `<path d="M240 20 V96" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>${text(258, 52, 'nerve', 'sm', 'start')}`;
  b += `<rect x="130" y="88" width="220" height="150" rx="74" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  for (const [x, y] of [[190, 140], [240, 128], [290, 142], [215, 186], [265, 190]]) b += `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="${x - 4}" cy="${y - 3}" r="4" fill="${GREY}"/><circle cx="${x + 5}" cy="${y + 4}" r="4" fill="${GREY}"/>`;
  b += text(240, 226, 'nerve ending', 'sm');
  for (let i = 0; i < 14; i++) b += `<circle cx="${f(170 + ((i * .618034) % 1) * 140)}" cy="${262 + (i * 7 % 5) * 16}" r="6" fill="${GREY}"/>`;
  b += arrow('M120 258 V340', INK, 2) + arrow('M120 340 V258', INK, 2);
  b += text(108, 296, 'the gap:', 'sm', 'end') + text(108, 318, 'synapse', 'sm b', 'end');
  b += `<path d="M314 286 H354" stroke="${INK}" stroke-width="1.5"/>${text(360, 292, 'messenger', 'sm', 'start')}`;
  b += `<rect x="40" y="352" width="400" height="230" fill="${ORGAN}"/><path d="M40 352 H440" stroke="${WALL}" stroke-width="3"/>`;
  b += text(240, 420, 'organ cell', 'on-organ') + arrow('M240 440 V520', INK, 5) + text(240, 556, 'signal passed on', 'sm on-organ');
  return b;
}

// Step 10: a sympathetic nerve reaches the adrenal gland, which releases adrenaline into the blood.
const KIDNEY = 'M80 26 C44 22 30 52 34 76 C38 102 64 112 90 106 C112 101 120 86 110 78 C102 72 102 62 110 56 C122 46 112 28 80 26 Z';
function adrenalPicture() {
  let b = DEFS;
  // Blood vessel on the right, carrying adrenaline up and away.
  b += `<rect x="380" y="96" width="44" height="470" fill="${ORGAN}"/><path d="M380 96 V566 M424 96 V566" stroke="${WALL}" stroke-width="3"/>`;
  b += arrow('M402 150 V104', INK, 2.5) + text(470, 84, 'to the whole body', 'sm', 'end');
  // Kidney with the adrenal gland sitting on top.
  b += `<path d="${KIDNEY}" transform="translate(2 250) scale(2.6)" fill="${ORGAN}" stroke="${WALL}" stroke-width="${f(3 / 2.6)}"/>${text(186, 400, 'kidney', 'on-organ')}`;
  b += `<path d="M120 318 Q160 232 214 218 Q268 236 292 300 Q210 286 120 318 Z" fill="#f0dfb4" stroke="#7a5c00" stroke-width="3"/>`;
  b += text(206, 206, 'adrenal gland', 'sm b');
  // Sympathetic nerve arriving from above.
  b += arrow('M206 30 V168', RED, 6) + text(192, 60, 'sympathetic nerve', 'sm red b', 'end');
  // Adrenaline leaving the gland through a small vein into the vessel.
  b += `<path d="M268 266 C320 266 340 300 380 300" fill="none" stroke="${ORGAN}" stroke-width="22"/><path d="M268 255 C320 255 340 289 380 289 M268 277 C320 277 340 311 380 311" fill="none" stroke="${WALL}" stroke-width="2"/>`;
  for (const [x, y] of [[240, 262], [292, 270], [334, 290], [402, 290], [396, 240], [408, 196], [398, 160], [392, 350], [410, 420], [396, 500]]) b += `<circle cx="${x}" cy="${y}" r="7" fill="${RED}"/>`;
  b += `<circle cx="40" cy="574" r="7" fill="${RED}"/>${text(56, 580, 'adrenaline, carried in the blood', 'sm', 'start')}`;
  return b;
}

// Step 11: the pupil's two muscles, pulling in opposite directions.
function pupilPicture() {
  const cx = 240, cy = 236;
  let b = DEFS + `<path d="M28 ${cy} Q240 46 452 ${cy} Q240 426 28 ${cy} Z" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="118" fill="#8c9b80"/>`;
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, c = Math.cos(a), s = Math.sin(a);
    b += `<path d="M${f(cx + 66 * c)} ${f(cy + 66 * s)} L${f(cx + 110 * c)} ${f(cy + 110 * s)}" stroke="${RED}" stroke-width="4" stroke-linecap="round"/>`;
  }
  b += `<circle cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${GREEN}" stroke-width="12" stroke-dasharray="10 4"/><circle cx="${cx}" cy="${cy}" r="44" fill="${INK}"/>`;
  b += `<path d="M96 412 L196 280" stroke="${GREEN}" stroke-width="2"/><path d="M384 412 L318 312" stroke="${RED}" stroke-width="2"/>`;
  b += `<path d="M${cx} ${cy} L${cx + 150} 70" stroke="#fff" stroke-width="5"/><path d="M${cx} ${cy} L${cx + 150} 70" stroke="${INK}" stroke-width="2"/>${text(cx + 156, 66, 'pupil', 'sm b', 'start')}`;
  b += text(24, 438, 'ring muscle', 'sm b green', 'start') + text(24, 460, 'muscarinic receptors:', 'xs', 'start') + text(24, 480, 'acetylcholine → smaller', 'xs', 'start');
  b += text(456, 438, 'spoke muscle', 'sm b red', 'end') + text(456, 460, 'alpha receptors:', 'xs', 'end') + text(456, 480, 'noradrenaline → larger', 'xs', 'end');
  const mini = (x, r) => `<path d="M${x - 54} 556 Q${x} 522 ${x + 54} 556 Q${x} 590 ${x - 54} 556 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="556" r="20" fill="#8c9b80"/><circle cx="${x}" cy="556" r="${r}" fill="${INK}"/>`;
  b += mini(130, 5) + text(130, 612, 'brake wins', 'sm green b') + mini(350, 15) + text(350, 612, 'accelerator wins', 'sm red b');
  return b;
}

// Step 12: an airway in cross-section, its muscle tightened by nerves and relaxed by adrenaline in the blood.
function airwayPicture() {
  const cx = 230, cy = 250;
  let b = DEFS + `<circle cx="${cx}" cy="${cy}" r="128" fill="#e7cfc8" stroke="${WALL}" stroke-width="3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="#b5776c" stroke-width="16" stroke-dasharray="14 5"/><circle cx="${cx}" cy="${cy}" r="70" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  b += text(cx, cy + 6, 'air', 'sm') + `<path d="M${cx} ${cy + 90} V${cy + 134}" stroke="${INK}" stroke-width="1.5"/>${text(cx, cy + 152, 'muscle ring', 'sm')}`;
  // Parasympathetic nerve from the left.
  b += arrow(`M6 120 C70 120 110 150 ${cx - 70} ${cy - 50}`, GREEN, 5, 'stroke-dasharray="9 6"') + text(10, 100, 'parasympathetic nerve', 'sm green b', 'start');
  // Blood vessel carrying adrenaline on the right.
  b += `<rect x="404" y="60" width="40" height="400" fill="${ORGAN}"/><path d="M404 60 V460 M444 60 V460" stroke="${WALL}" stroke-width="3"/>`;
  for (const y of [100, 170, 240, 310, 380, 430]) b += `<circle cx="424" cy="${y}" r="7" fill="${RED}"/>`;
  b += arrow(`M398 ${cy} H${cx + 100}`, RED, 3, 'stroke-dasharray="6 5"') + text(470, 46, 'blood with adrenaline', 'sm red b', 'end');
  b += text(14, 420, 'acetylcholine:', 'xs', 'start') + text(14, 440, 'muscle tightens,', 'xs', 'start') + text(14, 460, 'airway narrows', 'xs b green', 'start');
  b += text(390, 420, 'adrenaline on beta', 'xs', 'end') + text(390, 440, 'receptors: relaxes,', 'xs', 'end') + text(390, 460, 'airway widens', 'xs b red', 'end');
  const mini = (x, r) => `<circle cx="${x}" cy="548" r="34" fill="#e7cfc8" stroke="${WALL}" stroke-width="2"/><circle cx="${x}" cy="548" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  b += mini(130, 7) + text(130, 610, 'brake wins', 'sm green b') + mini(350, 24) + text(350, 610, 'adrenaline wins', 'sm red b');
  return b;
}

// Plain-word comparison with normal (used for chips and text alternatives).
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o, kind = '') {
  const rows = [];
  if (kind === 'che' || kind === 'explore') rows.push(['Acetylcholine in the gap', trend(o.ach, BASE.ach, 'more', 'less')]);
  rows.push(['Heart rate', trend(o.HR, BASE.HR, 'faster', 'slower')], ['Squeeze strength', trend(o.SV, BASE.SV, 'stronger', 'weaker')],
    ['Arterioles', trend(BASE.R, o.R, 'wider', 'narrower')], ['Blood pressure', trend(o.P, BASE.P, 'higher', 'lower')],
    ['Airways', trend(o.airway, BASE.airway, 'wider', 'narrower')], ['Pupils', trend(o.pupil, BASE.pupil, 'larger', 'smaller')]);
  return rows;
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (o, kind) => `<ul class="readout" aria-label="Compared with normal">${compare(o, kind).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (o, kind) => compare(o, kind).map(([k, [w]]) => `${k.toLowerCase()} ${w}`).join(', ');

/* ---------- Lesson steps ---------- */
const UPTO = n => ALL.slice(0, n);
const CORE = {
  wiring: () => svg('The brain and spinal cord on the left, with nerves running out to five organs on the right: the eyes, lungs, heart, blood vessels and gut. The signals run without conscious thought.', wiringPicture(false)),
  branches: () => svg('The same wiring in two branches. Solid red nerves, the sympathetic accelerator, leave the middle of the spinal cord and reach the eyes, heart, blood vessels and gut, but hardly the muscle of the lungs. Dashed green nerves, the parasympathetic brake, leave the brainstem and the bottom of the cord and reach the eyes, lungs, heart and gut, but not the blood vessels.', wiringPicture(true)),
  synapse: () => svg('Close-up of a nerve ending sitting just above an organ cell. Small sacs inside the ending hold messenger. Messenger dots drift across the narrow gap between them, the synapse, and an arrow inside the cell shows the signal passed on.', synapseCloseUp()),
  ach: () => svg('Close-up of a parasympathetic synapse. Green acetylcholine dots cross the gap; each one fits a cup-shaped muscarinic receptor in the organ cell, and a green arrow shows the signal going into the cell.', zoomPicture('para', { note: ['acetylcholine docks in its receptor', 'and the signal passes into the cell'] })),
  enzyme: () => svg('The same parasympathetic synapse with cholinesterase, a mouth-shaped enzyme sitting on the cell surface at the edge of the gap, chopping up acetylcholine.', zoomPicture('para', { enzyme: true, note: ['cholinesterase chops acetylcholine', 'apart, so the signal stays short'] })),
  'para-heart': () => svg('The parasympathetic synapse above the heart. A heartbeat strip shows one dot per beat, evenly spaced, and a green word marks what acetylcholine does: the heart slower.', picture(BASE, { parts: UPTO(3), notes: { heart: 'slower ↓' }, color: GREEN }), 372),
  ne: () => svg('Close-up of a sympathetic synapse. Red noradrenaline dots cross the gap to two kinds of cup-shaped receptor: a pair labelled alpha and a pair labelled beta, each passing its own signal into the cell.', zoomPicture('symp', { note: ['two receptor families,', 'alpha and beta'] })),
  beta: () => svg('Both synapses above the heart. A new bar shows how hard each beat squeezes. Red words mark what the beta signal does: faster beats and a stronger squeeze.', picture(BASE, { parts: UPTO(5), notes: { heart: 'faster, stronger ↑' }, color: RED }), 372),
  alpha: () => svg('Both synapses above the heart. New: an arteriole, a muscle-ringed tube, and a blood pressure bar. Red words mark what the alpha signal does: the arteriole narrower and blood pressure higher.', picture(BASE, { parts: UPTO(7), notes: { vessel: 'narrower', bp: 'higher ↑' }, color: RED })),
  adrenal: () => svg('A kidney with an adrenal gland sitting on top. A red sympathetic nerve reaches the gland from above, and red dots of adrenaline leave it through a small vein into a blood vessel that carries them to the whole body.', adrenalPicture()),
  pupil: () => svg('A large eye. Around the black pupil, a green ring muscle with muscarinic receptors pulls it smaller when acetylcholine arrives; red spoke-like muscles with alpha receptors pull it larger when noradrenaline arrives. Below, a small pupil where the brake wins and a large one where the accelerator wins.', pupilPicture()),
  airway: () => svg('An airway in cross-section: air in the middle, wrapped in a ring of muscle. A green parasympathetic nerve from the left releases acetylcholine, which tightens the muscle and narrows the airway. On the right, a blood vessel carries red dots of adrenaline, which reach beta receptors on the muscle, relax it and widen the airway. Below, a narrow airway where the brake wins and a wide one where adrenaline wins.', airwayPicture()),
  reflex: () => svg('The whole picture with a dotted blue line running from the blood pressure bar up to both nerves: the pressure reflex, which eases the accelerator and presses the brake when pressure rises.', picture(BASE, { parts: ALL })),
  whole: () => svg('The whole picture: a sympathetic synapse releasing noradrenaline onto alpha and beta receptors, a parasympathetic synapse releasing acetylcholine onto muscarinic receptors with cholinesterase clearing the gap, and below them the heartbeat strip with its squeeze-strength bar, an arteriole, an airway opened by adrenaline in the blood, a pupil and the blood pressure bar, linked back to the nerves by the pressure reflex.', picture(BASE, { parts: ALL }))
};
const CHANGE_WHERE = {
  mag: 'Black diamond-shaped drug molecules sit in the muscarinic receptors.',
  mant: 'Grey blockers fill every muscarinic receptor, so acetylcholine cannot dock.',
  che: 'A red cross stops cholinesterase, and acetylcholine dots crowd the gap.',
  aag: 'Black diamond-shaped drug molecules sit in the alpha receptors.',
  ablock: 'Grey blockers fill the alpha receptors.',
  bag: 'Black diamond-shaped drug molecules sit in the beta receptors.',
  bblock: 'Grey blockers fill the beta receptors.'
};
function changePicture(el, t) {
  const kind = el.dataset.kind, ease = 1 - Math.pow(1 - t, 3);
  const o = steady(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease));
  const name = el.dataset.stepTitle.split(':')[0];
  return { pic: svg(`${name}, drawn over a faint dashed picture of normal. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o, kind)}.`, picture(o, { parts: ALL, ghost: BASE, legend: 'with the drug' })), ro: readout(o, kind) };
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frame = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind in CHANGES;
// During a morph only the picture is replaced each frame; the word readout is rewritten only when its words change.
const lastReadout = new WeakMap();
function drawAt(el, t) {
  const v = visualOf(el), { pic, ro } = changePicture(el, t), old = v.querySelector('svg');
  if (!old) { v.innerHTML = pic + ro; lastReadout.set(v, ro); return; }
  old.outerHTML = pic;
  if (lastReadout.get(v) !== ro) { v.querySelector('.readout').outerHTML = ro; lastReadout.set(v, ro); }
}
function animate(el) {
  cancelAnimationFrame(frame);
  if (reducedMotion()) { drawAt(el, 1); return; }
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / 1600);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
steps.forEach(el => {
  const kind = el.dataset.kind;
  if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
  else drawAt(el, 1);
  el.querySelector('.replay')?.addEventListener('click', () => animate(el));
});
function showStep(n, focus = false) {
  cancelAnimationFrame(frame);
  current = clamp(n, 0, steps.length - 1);
  steps.forEach((el, i) => { el.hidden = i !== current; });
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === steps.length - 1 ? 'Start again ↻' : 'Next →';
  progress.textContent = `Step ${current + 1} of ${steps.length}`;
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  const el = steps[current];
  if (isAnimated(el)) animate(el);
  if (focus) { const h = el.querySelector('h2'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }
}
nextBtn.addEventListener('click', () => showStep(current === steps.length - 1 ? 0 : current + 1, true));
backBtn.addEventListener('click', () => showStep(current - 1, true));
$('#lesson').addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight' && current < steps.length - 1) { e.preventDefault(); showStep(current + 1, true); }
  if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); showStep(current - 1, true); }
});

/* ---------- Tabs ---------- */
const tabs = $$('[role=tab]');
function activate(tab, focus = false) {
  tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
  if (focus) tab.focus();
  if (tab.id === 'tab-lesson') { if (isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
  update();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => activate(t));
  t.addEventListener('keydown', e => {
    const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (n !== undefined) { e.preventDefault(); activate(tabs[n], true); }
  });
});
function fromHash() {
  const m = location.hash.match(/^#step-(\d+)$/);
  if (m) { if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]); showStep(Number(m[1]) - 1); }
}
window.addEventListener('hashchange', fromHash);
if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(0);

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['symp', 'para', 'che', 'mFree', 'aFree', 'bFree', 'mAg', 'aAg', 'bAg'];
const LESSON_LABEL = { mag: 'Muscarinic agonists', mant: 'Muscarinic antagonists', che: 'Cholinesterase inhibitors', aag: 'Peripheral alpha-1 agonists', ablock: 'Alpha-1 blockers', bag: 'Nonselective beta agonists', bblock: 'Beta blockers' };
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
  const a = v.low ?? v.high * .6, b = v.high ?? v.low * 2, span = b - a, lo = a - .6 * span, hi = b + .6 * span;
  const pos = n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
  return { pos, lo, hi };
}
function update() {
  syncControls();
  const o = steady(params);
  $('#explore-visual').innerHTML = svg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o, 'explore')}.`, picture(o, { parts: ALL, ghost: BASE, legend: 'your settings' })) + readout(o, 'explore');
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
    const d = state?.shifts[v.id];
    row.querySelector('.direction').textContent = state ? (d ? DIRECTION[d] : 'No direction listed for this row') : '';
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
        : hasLow && hasHigh ? `Guideline band ${v.low}–${v.high} ${v.unit} (shaded) · blue line: model`
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
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'Full text'; li.append(' · ', a); }
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
update();
load();
