// The lesson's one picture: brain and pituitary at the top left, the blood vessel along the top, a
// collecting duct cell and the urine in its duct below, the urine flask at the bottom, and gauges on
// the right. Every step draws this same schematic, showing only the parts taught so far.
// Levels are 0..1 drawing positions looked up from the qualitative table in states.js (LV below); a
// change morphs between two looked-up states. Nothing is computed from physiology, and no number
// is drawn: the reference numbers live only in the Clinical values tab. Where the sources give no
// direction ('unstated'), the part is drawn as an outline at its normal place and the gauge says so.
(() => {
const A = window.ADH;
const { C, f, clamp, lerp, lerpObj, ease, span, svg, text, circle, rect, path, arrowTo, part } = A.draw;
const { STATES, WORDS, LONG } = A;

const frac = x => x - Math.floor(x);
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;

/* ---------- From the table to drawing positions ---------- */
const LV = {
  adh: { absent: .04, low: .18, normal: .5, high: .9, ineffective: .5, unstated: .5 },
  aquaporins: { low: .17, normal: .5, high: 1, unstated: .5 },
  urineVolume: { low: .3, normal: .55, high: .92, unstated: .55 },
  urineConcentration: { low: .12, normal: .5, high: .9, unstated: .5 },
  blood: { low: .18, normal: .5, high: .86, unstated: .5 },
  sodiumMarker: { normal: .5, up: .64, down: .36, hypo: .07, hyper: .93, unstated: .5 },
};
function levelsOf(id) {
  const s = STATES[id];
  return {
    adh: LV.adh[s.adh], aqua: LV.aquaporins[s.aquaporins], vol: LV.urineVolume[s.urineVolume],
    conc: LV.urineConcentration[s.urineConcentration], blood: LV.blood[s.blood], na: LV.sodiumMarker[s.sodiumMarker],
    block: s.adh === 'ineffective' ? 1 : 0, extra: s.water === 'extra' ? 1 : 0, lost: s.water === 'lost' ? 1 : 0,
    hollow: s.sodiumMarker === 'unstated' ? 1 : 0, adhUnknown: s.adh === 'unstated' ? 1 : 0, aquaUnknown: s.aquaporins === 'unstated' ? 1 : 0, volUnknown: s.urineVolume === 'unstated' ? 1 : 0, concUnknown: s.urineConcentration === 'unstated' ? 1 : 0,
  };
}
const mix = (a, b, t) => lerpObj(a, b, clamp(t, 0, 1));
function wordsOf(id) {
  const s = STATES[id];
  return { adh: WORDS.adh[s.adh], aqua: WORDS.aquaporins[s.aquaporins], vol: WORDS.urineVolume[s.urineVolume],
    conc: WORDS.urineConcentration[s.urineConcentration], na: WORDS.sodiumMarker[s.sodiumMarker], blood: WORDS.blood[s.blood] };
}
// One sentence for the picture's text alternative and the live announcements.
function describeState(id) {
  const s = STATES[id];
  return [LONG.adh[s.adh], LONG.aquaporins[s.aquaporins], LONG.urineVolume[s.urineVolume], LONG.urineConcentration[s.urineConcentration], LONG.sodiumMarker[s.sodiumMarker]].join(', ');
}

/* ---------- Colours: water blue, ADH amber, solute concentration from pale to deep ---------- */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(lerp(v, rgb(b)[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
const bloodFill = c => mixHex('#fcefec', '#d9877b', c);
const urineFill = c => mixHex('#fcf8e6', '#d29a12', c);
// A concentration the sources do not state is drawn in a neutral tint, not as "normal".
const urineOf = L => (L.concUnknown > .5 ? '#ece9df' : urineFill(L.conc));
const CELL = '#fff7e8', CONC_BAR = '#8a5f00', VOL_BAR = C.muted;

/* ---------- Small shapes ---------- */
const drop = (x, y, r = 5, extra = '') => `<path d="M${f(x)} ${f(y - r * 1.35)}C${f(x + r * .5)} ${f(y - r * .6)} ${f(x + r)} ${f(y)} ${f(x + r)} ${f(y + r * .4)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y + r * .4)}C${f(x - r)} ${f(y)} ${f(x - r * .5)} ${f(y - r * .6)} ${f(x)} ${f(y - r * 1.35)}Z" fill="${C.blue}" stroke="#fff" stroke-width="1.2" ${extra}/>`;
// hollow: the sources give no level for this state, so the part is drawn as an outline.
const adhDot = (x, y, a = 1, hollow = false) => (hollow ? circle(x, y, 5, '#fff', C.amber, 2, `stroke-dasharray="3 2" ${fade(a)}`) : circle(x, y, 5.5, C.amber, '#fff', 1.5, fade(a)));
const channel = (x, y, hollow = false) => (hollow ? rect(x - 5.5, y - 11, 11, 22, '#fff', C.blue, 1.8, 'rx="3" stroke-dasharray="3 2"')
  : rect(x - 5.5, y - 11, 11, 22, C.blue, '#fff', 1.2, 'rx="3"') + path(`M${f(x)} ${f(y - 7)} V${f(y + 7)}`, '#fff', 2));
const ghostG = body => `<g class="ghost" data-ghost="normal">${body}</g>`;
const dashRect = (x, y, w, h) => rect(x, y, w, h, 'none', C.ink, 2, 'stroke-dasharray="5 4"');

/* ---------- Geometry ---------- */
const V = { top: 122, bot: 164, mid: 143 };              // blood vessel
const CELLBOX = { x: 10, y: 180, w: 282, h: 78 };        // collecting duct cell
const LUMEN = { y: 258, h: 38 };                         // urine in the duct
const RECEPTORS = [90, 160, 230];
const CHANNELS = [36, 80, 124, 168, 212, 256];
const FLASK = { x: 196, w: 92, top: 318, bot: 412, fill: 86 };
const flaskY = vol => FLASK.bot - vol * FLASK.fill;
const G = { x: 300, w: 96, word: 404 };                  // gauges
const GY = { adh: 172, aqua: 216, vol: 260, conc: 304, na: 348 };
const NA = { x: 300, w: 176, y: 372, lo: 328, hi: 448 };
const naX = v => NA.x + NA.w * v;
// The "typical day" and "minimum needed" marks are qualitative and not to scale: "typical day" sits
// where a typical flask fills, "minimum needed" is a fixed mark near the bottom. No ratio between
// the two reference values is drawn.
const TYPICAL_VOL = LV.urineVolume.normal, MIN_VOL = .1;

/* ---------- Parts of the picture ---------- */
function vessel(L, phase, word) {
  let s = rect(0, V.top, 480, V.bot - V.top, bloodFill(L.blood)) + path(`M0 ${V.top} H480`, C.red, 3) + path(`M0 ${V.bot} H480`, C.red, 3);
  const n = Math.round(lerp(7, 22, L.blood));
  for (let i = 0; i < 22; i++) {
    const x = 70 + frac(i * .1373 + phase) * 404, y = V.top + 9 + ((i * 29) % 25);
    s += circle(x, y, 2.6, C.ink, 'none', 0, fade(clamp(n - i, 0, 1) * .8));
  }
  s += text(10, 150, 'blood', 'sm b', 'start');
  if (word) s += text(470, 150, word, 'xs b', 'end');
  return part('blood', s);
}
function waterInOut(L, phase) {
  let s = '';
  if (L.extra > .02) {
    const y = lerp(88, 124, frac(phase * 2));
    s += `<g ${fade(L.extra)}>${arrowTo(24, 86, 24, 120, C.blue, 3)}${drop(24, y, 5)}${text(36, 106, 'water in', 'xs b blue', 'start')}</g>`;
  }
  if (L.lost > .02) {
    const y = lerp(124, 88, frac(phase * 2));
    s += `<g ${fade(L.lost)}>${arrowTo(24, 120, 24, 86, C.blue, 3)}${drop(24, y, 5)}${text(36, 106, 'water lost', 'xs b blue', 'start')}</g>`;
  }
  return s;
}
function brain(fire, phase) {
  let s = `<ellipse cx="96" cy="50" rx="86" ry="40" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`;
  s += path('M40 34 C56 22 74 30 88 22 M104 26 C120 18 140 26 152 36 M30 58 C44 50 58 58 70 50', C.rule, 2);
  s += part('hypothalamus', `<ellipse cx="132" cy="72" rx="32" ry="12" fill="${C.blueWash}" stroke="${C.blue}" stroke-width="1.5"/>` + text(84, 50, 'hypothalamus', 'xs b'));
  const dots = [[114, 73], [126, 76], [138, 73], [150, 71]];
  let o = '';
  dots.forEach(([x, y], i) => {
    const q = frac(phase * 4 + i * .25);
    if (fire > .02) o += circle(x, y, 4 + 10 * q, 'none', C.blue, 2, fade((1 - q) * fire));
    o += circle(x, y, 3.6, fire > .5 ? C.blue : '#fff', C.blue, 1.8);
  });
  return s + part('osmoreceptor', o);
}
function pituitary(adh) {
  let s = path('M146 84 C150 92 154 96 160 100', C.ink, 3);
  s += circle(156, 105, 8, '#e6dfd2', C.ink, 1.5) + circle(170, 107, 8.5, '#f6dcc2', C.amber, 2.5);
  s += path('M138 80 C150 90 160 96 168 102', C.amber, 2, `stroke-dasharray="3 4" ${fade(.3 + .7 * adh)}`);
  s += text(184, 113, 'posterior pituitary', 'xs b amber', 'start');
  return part('pituitary', s);
}
// ADH released from the posterior pituitary rides the blood to the right.
function adhFlow(L, phase) {
  let s = '';
  for (let i = 0; i < 8; i++) {
    const a = clamp(L.adh * 8 - i, 0, 1);
    if (a <= 0) continue;
    const q = frac(phase * 2 + i / 8);
    const x = q < .12 ? 170 : lerp(170, 476, (q - .12) / .88);
    const y = q < .12 ? lerp(116, V.mid - 4, q / .12) : V.mid - 4 + ((i * 7) % 12) - 6;
    s += adhDot(x, y, a * (q > .94 ? (1 - q) / .06 : 1), L.adhUnknown > .5);
  }
  return part('adh', s);
}
function cell(L, { dock = 1, showReceptors = true } = {}) {
  let s = rect(CELLBOX.x, CELLBOX.y, CELLBOX.w, CELLBOX.h, CELL, C.ink, 2, 'rx="12"');
  if (!showReceptors) return part('duct', s);
  let r = '';
  RECEPTORS.forEach((x, j) => {
    r += `<path d="M${x - 9} 170 V180 A9 9 0 0 0 ${x + 9} 180 V170" fill="${C.panel}" stroke="${C.ink}" stroke-width="2.5"/>`;
    const a = clamp(L.adh * 3.2 - j, 0, 1);
    if (a > 0) r += adhDot(x, lerp(V.mid, 178, dock), a, L.adhUnknown > .5);
    if (L.block > .02) r += `<g ${fade(L.block)}>${path(`M${x - 8} 164 L${x + 8} 180 M${x + 8} 164 L${x - 8} 180`, C.red, 3.5)}</g>`;
  });
  return part('duct', s) + part('receptor', r);
}
const insertion = (L, i) => clamp(L.aqua * CHANNELS.length - i, 0, 1);
function channels(L) {
  let s = '';
  CHANNELS.forEach((m, i) => {
    const p = ease.inOut(insertion(L, i));
    const x = lerp(m + 12, m, p), y = lerp(232, LUMEN.y, p);
    if (p < .6) s += circle(x, y, 14, 'none', C.muted, 1.5, `stroke-dasharray="3 3" ${fade(1 - p / .6)}`);
    s += channel(x, y, L.aquaUnknown > .5);
  });
  return part('aquaporin', s);
}
function lumen(L, phase, { exit = false } = {}) {
  let s = rect(CELLBOX.x, LUMEN.y, CELLBOX.w, LUMEN.h, urineOf(L), C.ink, 2);
  for (let i = 0; i < 5; i++) s += drop(16 + frac(phase * 2 + i / 5) * 268, 272, 5);
  if (exit) s += rect(234, LUMEN.y + LUMEN.h - 2, 16, FLASK.top - LUMEN.y - LUMEN.h + 6, urineOf(L), C.ink, 2);
  return part('duct', s);
}
// Water leaves the urine through each inserted channel and crosses the cell into the blood.
function waterBack(L, phase) {
  let s = '';
  if (L.aquaUnknown > .5) return part('water', s);
  CHANNELS.forEach((m, i) => {
    const p = insertion(L, i);
    if (p < .6) return;
    for (const k of [0, .5]) {
      const q = frac(phase * 3 + i * .37 + k);
      const y = lerp(278, V.mid, q);
      s += drop(m, y, 4.6, fade(((p - .6) / .4) * (q > .85 ? (1 - q) / .15 : 1)));
    }
  });
  return part('water', s);
}
function flask(L, phase, ghost) {
  let s = `<path d="M${FLASK.x} ${FLASK.top} V${FLASK.bot - 8} Q${FLASK.x} ${FLASK.bot + 2} ${FLASK.x + 10} ${FLASK.bot + 2} H${FLASK.x + FLASK.w - 10} Q${FLASK.x + FLASK.w} ${FLASK.bot + 2} ${FLASK.x + FLASK.w} ${FLASK.bot - 8} V${FLASK.top}" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>`;
  const top = flaskY(L.vol);
  // A volume the sources do not state: the urine's colour is shown, but no level, and the words say so.
  const unknown = L.volUnknown > .5;
  s += unknown ? rect(FLASK.x + 6, FLASK.top + 30, FLASK.w - 12, FLASK.bot - FLASK.top - 36, urineOf(L), C.muted, 1.5, 'rx="7" stroke-dasharray="4 3" opacity=".55"')
      + text(FLASK.x + FLASK.w / 2, FLASK.top + 64, 'volume:', 'xs b') + text(FLASK.x + FLASK.w / 2, FLASK.top + 84, 'not stated', 'xs b')
    : rect(FLASK.x + 2, top, FLASK.w - 4, FLASK.bot - top, urineOf(L), 'none', 0, 'rx="7"');
  for (let i = 0; i < 3; i++) {
    const q = frac(phase * 4 + i / 3), y = lerp(FLASK.top - 14, unknown ? FLASK.top + 20 : top, q);
    s += drop(242, y, 4.4, fade(lerp(.5, 1, L.vol) * (q > .9 ? (1 - q) / .1 : 1)));
  }
  s += text(FLASK.x + FLASK.w / 2, FLASK.top + 20, 'urine', 'xs b');
  for (const [v, words] of [[TYPICAL_VOL, 'typical day'], [MIN_VOL, 'minimum needed']]) {
    const y = flaskY(v);
    s += path(`M${FLASK.x - 10} ${f(y)} H${FLASK.x + 8}`, C.ink, 2) + text(FLASK.x - 14, y + 6, words, 'xs', 'end');
  }
  if (ghost) s += ghostG(path(`M${FLASK.x + 4} ${f(flaskY(ghost.vol))} H${FLASK.x + FLASK.w - 4}`, C.ink, 2.5, 'stroke-dasharray="6 5"'));
  return part('flask', s);
}
function gauge(y0, label, level, ghostLevel, word, col, name) {
  let s = text(G.x, y0 + 14, label, 'xs', 'start');
  const unknown = word === WORDS.adh.unstated;
  // No level stated: no bar, just the words over a dashed line.
  s += unknown ? path(`M${G.x} ${y0 + 40} H${G.x + 176}`, C.muted, 1.5, 'stroke-dasharray="4 3"')
    : rect(G.x, y0 + 22, G.w, 13, '#fff', C.rule, 1.5) + rect(G.x, y0 + 22, G.w * clamp(level, .03, 1), 13, col);
  if (ghostLevel !== null && ghostLevel !== undefined) s += ghostG(dashRect(G.x, y0 + 19, G.w * clamp(ghostLevel, .03, 1), 19));
  if (word) s += unknown ? text(G.x, y0 + 34, word, 'xs b muted', 'start') : text(G.word, y0 + 34, word, 'xs b', 'start');
  return part(name, s, `data-gauge="${label}" data-word="${word || ''}"`);
}
function sodium(L, ghost, word) {
  let s = text(NA.x, NA.y - 10, 'blood sodium', 'xs', 'start');
  s += rect(NA.x, NA.y, NA.w, 12, '#fff', C.rule, 1.5);
  s += rect(NA.x, NA.y, NA.lo - NA.x, 12, C.redWash) + rect(NA.hi, NA.y, NA.x + NA.w - NA.hi, 12, C.redWash);
  s += path(`M${NA.lo} ${NA.y - 6} V${NA.y + 18} M${NA.hi} ${NA.y - 6} V${NA.y + 18}`, C.red, 2.5);
  if (ghost) s += ghostG(circle(naX(ghost.na), NA.y + 6, 9, 'none', C.ink, 2, 'stroke-dasharray="4 3"'));
  const filled = L.hollow < .5;
  s += circle(naX(L.na), NA.y + 6, 7.5, filled ? C.ink : '#fff', C.ink, 2.5);
  if (word) s += text(NA.x + NA.w / 2, NA.y + 38, word, 'xs b', 'middle');
  return part('sodium', s, `data-gauge="blood sodium" data-word="${word || ''}"`);
}
function callout(rows, a = 1) {
  if (!rows || !rows.length || a <= 0) return '';
  const [head, ...rest] = rows;
  return `<g data-callout ${fade(a)}>${rect(196, 8, 282, 86, '#fff', C.rule, 1)}${rect(196, 8, 5, 86, C.blue)}`
    + text(210, 33, head, 'sm b blue', 'start') + rest.map((r, i) => text(210, 59 + i * 24, r, 'xs b', 'start')).join('') + '</g>';
}
function legend(name) {
  return `<g data-legend>${path('M12 316 H44', C.ink, 2.5, 'stroke-dasharray="6 5"')}${text(52, 322, 'normal', 'xs', 'start')}`
    + `${rect(12, 334, 32, 14, C.ink)}${text(52, 347, name, 'xs b', 'start')}</g>`;
}
// The blood-concentration meter of the first steps: a narrow healthy band, words at each end.
function meter(c, { x = 30, w = 420, y = 182, title = 'how concentrated the blood is', ends = ['← more dilute', 'more concentrated →'] } = {}) {
  const band = [x + w / 3, x + 2 * w / 3];
  let s = text(x + w / 2, y - 14, title, 'sm b');
  s += rect(x, y, w, 24, '#fff', C.ink, 1.5) + rect(band[0], y, band[1] - band[0], 24, C.blueWash, C.blue, 1.5);
  s += text(x + w / 2, y + 46, 'the narrow healthy range', 'xs b blue');
  s += text(x, y + 72, ends[0], 'xs', 'start') + text(x + w, y + 72, ends[1], 'xs', 'end');
  const nx = x + w * clamp(c, .03, .97);
  s += path(`M${f(nx)} ${y - 6} V${y + 30}`, C.ink, 5);
  return part('osmolality', s);
}

/* ---------- The whole schematic ---------- */
// o: { L, ghost, show: [...], phase, fire, dock, words, callout, calloutA, legend }
function schematic(o) {
  const show = new Set(o.show), L = o.L, ph = o.phase || 0, w = o.words || {};
  let s = '';
  if (show.has('meter')) s += meter(L.blood, { x: 20, w: 260, y: 212, title: 'blood concentration', ends: ['← dilute', 'concentrated →'] });
  if (show.has('lumen')) s += lumen(L, ph, { exit: show.has('flask') });
  if (show.has('cell')) s += cell(L, { dock: o.dock ?? 1, showReceptors: show.has('receptor') });
  if (show.has('aqua')) s += channels(L);
  if (show.has('flask')) s += flask(L, ph, o.ghost);
  s += vessel(L, ph * 1, w.blood);
  if (show.has('water')) s += waterBack(L, ph);
  // Labels go over the moving water, so drops never cut through the words.
  if (show.has('cell')) s += part('duct', text(22, 212, 'collecting duct cell', 'xs b', 'start'));
  if (show.has('lumen')) s += part('duct', text(22, 291, 'urine in the duct', 'xs b', 'start'));
  s += waterInOut(L, ph);
  if (show.has('brain')) s += brain(o.fire ?? 0, ph);
  if (show.has('pituitary')) s += pituitary(L.adh);
  if (show.has('adh')) s += adhFlow(L, ph);
  // A dashed "normal" outline is drawn only where the sources give the baseline a level.
  const g = o.ghost, gl = (k, unknown) => (g && !(g[unknown] > .5) ? g[k] : null);
  if (show.has('g-adh')) s += gauge(GY.adh, 'ADH in the blood', L.adh, gl('adh', 'adhUnknown'), w.adh, C.amber, 'adh');
  if (show.has('g-aqua')) s += gauge(GY.aqua, 'water channels', L.aqua, gl('aqua', 'aquaUnknown'), w.aqua, C.blue, 'aquaporin');
  if (show.has('g-vol')) s += gauge(GY.vol, 'urine volume', L.vol, gl('vol', 'volUnknown'), w.vol, VOL_BAR, 'flask');
  if (show.has('g-conc')) s += gauge(GY.conc, 'urine concentration', L.conc, gl('conc', 'concUnknown'), w.conc, CONC_BAR, 'flask');
  if (show.has('g-na')) s += sodium(L, g, w.na);
  if (o.legend) s += legend(o.legend);
  s += callout(o.callout, o.calloutA ?? 1);
  return s;
}
const firing = L => clamp((L.blood - .56) / .26, 0, 1);
const FULL = ['brain', 'pituitary', 'adh', 'cell', 'receptor', 'aqua', 'lumen', 'water', 'flask', 'g-adh', 'g-aqua', 'g-vol', 'g-conc', 'g-na'];

/* ---------- Step 1: what osmolality is (its own close-up of the blood) ---------- */
function osmoScene(t) {
  const c = .5 + .34 * Math.sin(t * Math.PI * 2);
  let s = rect(0, 44, 480, 70, bloodFill(c)) + path('M0 44 H480 M0 114 H480', C.red, 3);
  let solutes = '';
  for (let i = 0; i < 18; i++) solutes += circle(20 + frac(i * .0557 + t) * 450, 54 + ((i * 37) % 50), 3.4, C.ink);
  const nWater = Math.round(lerp(16, 3, (c - .16) / .68));
  let water = '';
  for (let i = 0; i < 16; i++) water += drop(28 + frac(i * .0625 + t + .03) * 440, 60 + ((i * 23) % 44), 5.5, fade(clamp(nWater - i, 0, 1)));
  s += part('blood', part('water', water) + part('solute', solutes));
  s += text(10, 30, 'blood: water carrying dissolved particles', 'sm b', 'start');
  s += `<g ${fade((c - .6) / .12)}>${text(470, 140, 'water lost: more concentrated', 'xs b', 'end')}</g>`;
  s += `<g ${fade((.4 - c) / .12)}>${text(10, 140, 'water added: more dilute', 'xs b', 'start')}</g>`;
  s += meter(c, { x: 30, w: 420, y: 190 });
  s += rect(30, 288, 22, 16, bloodFill(.15), C.ink, 1) + text(60, 302, 'paler: dilute', 'xs', 'start');
  s += rect(250, 288, 22, 16, bloodFill(.88), C.ink, 1) + text(280, 302, 'deeper: concentrated', 'xs', 'start');
  return svg('How concentrated the blood is', 'A stretch of blood vessel holding blue water drops and black dissolved particles, with a meter below it labelled from more dilute to more concentrated and a narrow healthy band in the middle. As water drops leave, the blood tint deepens and the needle moves toward more concentrated; as water is added, the tint pales and the needle moves toward more dilute.', s, { h: 316 });
}

A.picture = { levelsOf, mix, wordsOf, describeState, schematic, firing, FULL, osmoScene };
})();
