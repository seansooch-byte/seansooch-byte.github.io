// Lesson 7: The cardiac action potential. The kit (/lab/kit/kit.js) runs the page; this file is the model,
// the pictures, and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, f, clamp, lerp, span, ease, arrow, readout } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const smooth = x => x * x * (3 - 2 * x);

/* ---------- Teaching model ----------
   Shapes are drawn from a few settings, in arbitrary time and voltage units; nothing here is a clinical number.
   The Clinical values tab scales the model's results relative to normal with the textbook values in clinical-values.json.
   Muscle voltage: 0 is rest, 1 is the normal peak. Pacemaker voltage: 0 is the normal lowest point between beats, 1 is threshold. */
const NORMAL = { symp: 1, para: 1, beta: 0, na: 0, naLate: 0, k: 0, ca: 0 };
const CHANGES = {
  class1a: { na: .35, k: .3 },       // moderate sodium block plus some potassium block
  class1b: { na: .03, naLate: .6 },  // quick release leaves little fast block at a normal rate; late sodium block trims the plateau
  class1c: { na: .6 },               // strong, slowly released sodium block
  class2: { beta: .6 },
  class3: { k: .6 },
  class4: { ca: .6 },
  symp: { symp: 1.6 },
  para: { para: 1.6 }
};

function cell(p) {
  const betaSig = p.symp * (1 - .85 * p.beta);            // beta signal reaching the cells
  const naEff = Math.pow(p.na, 1.6);                       // how much the fast sodium block slows the upswing
  // Ventricular muscle cell.
  const up = .03 * (1 + 3 * naEff);                        // upswing time
  const peak = 1 - .15 * p.na;
  const level = .8 - .15 * p.ca;                           // plateau height
  const plateau = (1 + .7 * p.k) * (1 - .12 * p.naLate);   // plateau length
  const fall = .35 * (1 + .5 * p.k);                       // repolarization time
  const refractory = up + plateau + .6 * fall;             // ends when the voltage has fallen most of the way back
  const spread = 1 + 1.6 * naEff;                          // time to spread through the ventricles (QRS width)
  const qtLen = plateau + fall;                            // what the Q-T interval stands for
  const squeeze = Math.max(.1, (1 - .55 * p.ca) * (.75 + .25 * betaSig));
  // Pacemaker cell.
  const mdp = clamp(.15 * (betaSig - 1) - .45 * (p.para - 1), -.9, .6);
  const slope = .5 * Math.max(.2, 1 + .4 * (betaSig - 1)) * Math.max(.4, 1 - .3 * (p.para - 1)) * (1 - .4 * p.ca);
  const drift = (1 - mdp) / slope;
  const pmUp = .15 * (1 + p.ca);
  const pmPeak = 2.3 - .4 * p.ca;
  const pmFall = .5 * (1 + .1 * p.k);
  const cycle = drift + pmUp + pmFall;
  // AV node (added with the PR interval): its cells rise on calcium like pacemaker cells, so calcium block and
  // beta block slow the signal through it, vagal drive slows it and sympathetic drive speeds it; a strong fast
  // sodium block also slows the spread through the atria and the fast wiring a little. 1 is normal.
  const av = (1 + .8 * p.ca) * (1 + .35 * (p.para - 1)) / (.6 + .4 * betaSig) * (1 + .5 * naEff);
  return { p, betaSig, up, peak, level, plateau, fall, refractory, spread, qtLen, squeeze, mdp, slope, drift, pmUp, pmPeak, pmFall, cycle, av };
}
const BASE = cell(NORMAL);
// Results relative to normal (1 = normal; mdp is a shift, 0 = normal).
const rel = o => ({
  rate: BASE.cycle / o.cycle, upstroke: o.up / BASE.up, peak: o.peak / BASE.peak, plateau: o.plateau / BASE.plateau,
  level: o.level / BASE.level, refractory: o.refractory / BASE.refractory, qrs: o.spread / BASE.spread,
  qt: o.qtLen / BASE.qtLen, squeeze: o.squeeze / BASE.squeeze, mdp: o.mdp - BASE.mdp, pr: o.av / BASE.av
});
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17).
   Each stretch of a trace is coloured by the ion that carries it: amber sodium, red calcium, green potassium
   (shapes too: circle, square, triangle). Purple is a drug, blue what a change moved. */
const INK = C.ink, NA = C.amber, CA = C.red, KK = C.green, BLUE = C.blue, MUTED = C.muted, DRUG = C.purple, RULE = C.rule;
const CELL = '#f4e2dd', WALL = '#a8584c', DOOR = '#d6d9cc', FAINT = '#c4c8bd';
const T = text;
const op = a => { const v = clamp(a, 0, 1); return v < .005 ? 'opacity="0"' : `opacity="${v.toFixed(2)}"`; };
const fadeIn = (a, body) => a < .005 ? '' : `<g ${op(a)}>${body}</g>`;
const dot = (x, y, r, col, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${col}" ${extra}/>`;
const PH_M = { 4: INK, 0: NA, 1: KK, 2: CA, 3: KK }, PH_P = { 4: NA, 0: CA, 3: KK };
const ION = { na: NA, ca: CA, k: KK }, CLS = { na: 'amber', ca: 'red', k: 'green' }, WORD = { na: 'sodium', ca: 'calcium', k: 'potassium' };
function ionShape(kind, x, y, s = 1, extra = '') {
  if (kind === 'na') return dot(x, y, 7 * s, NA, extra);
  if (kind === 'ca') return `<rect x="${f(x - 6.5 * s)}" y="${f(y - 6.5 * s)}" width="${f(13 * s)}" height="${f(13 * s)}" fill="${CA}" ${extra}/>`;
  return `<path d="M${f(x)} ${f(y - 8 * s)} L${f(x + 8 * s)} ${f(y + 6.5 * s)} L${f(x - 8 * s)} ${f(y + 6.5 * s)} Z" fill="${KK}" ${extra}/>`;
}
const plug = (x, y, w = 16, h = 12) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="2" fill="${DRUG}"/>`;
// A phase number in a circle, on or beside the trace.
const badge = (x, y, n, col) => `<g data-badge="${n}">${dot(x, y, 12, col, 'stroke="#fff" stroke-width="2"')}${T(x, y + 6, String(n), 'xs b on-badge')}</g>`;
// Time across, voltage up: a frame maps the cell's time t and voltage v to the picture.
const frame = (t0, t1, x0, x1, vLo, yLo, vHi, yHi) => ({ t0, t1, x0, x1, x: t => x0 + (t - t0) / (t1 - t0) * (x1 - x0), y: v => yLo + (v - vLo) / (vHi - vLo) * (yHi - yLo) });
const axis = (m, yTop, yBot, word = 'voltage ↑') => `<path d="M${m.x0 - 8} ${yTop} V${yBot}" stroke="${MUTED}" stroke-width="1.5"/>${T(m.x0 - 2, yTop + 4, word, 'xs muted', 'start')}`;

// The muscle cell's beat, phase by phase. Phase 0 is drawn 2.5 times its model length so its slope reads.
const DRAW_UP = 2.5;
function muscleShape(o) {
  const a1 = DRAW_UP * o.up, a2 = a1 + .045, a3 = Math.max(a2 + .1, DRAW_UP * .03 + o.plateau), a4 = a3 + o.fall, hi = o.level + .07, lo = o.level - .07;
  const v = t => t <= 0 ? 0 : t < a1 ? o.peak * (1 - (1 - t / a1) ** 2)
    : t < a2 ? o.peak + (hi - o.peak) * smooth((t - a1) / (a2 - a1))
      : t < a3 ? hi - (hi - lo) * ((t - a2) / (a3 - a2)) ** 2
        : t < a4 ? lo * (1 - smooth((t - a3) / (a4 - a3))) : 0;
  const phase = t => t < 0 ? 4 : t < a1 ? 0 : t < a2 ? 1 : t < a3 ? 2 : t < a4 ? 3 : 4;
  // When the falling voltage passes v (phase 3).
  const fallAt = v => { const x = 1 - v / lo; let lo2 = 0, hi2 = 1; for (let i = 0; i < 30; i++) { const m = (lo2 + hi2) / 2; if (smooth(m) < x) lo2 = m; else hi2 = m; } return a3 + (a4 - a3) * lo2; };
  return { v, phase, fallAt, cuts: [0, a1, a2, a3, a4], a1, a2, a3, a4, hi, lo, refr: a3 + .6 * o.fall };
}
// The pacemaker cell's beats, repeating. Phase 0 is drawn 1.6 times its model length.
const PM_UP = 1.6;
function pmShape(o) {
  const dr = o.drift, up = PM_UP * o.pmUp, fall = o.pmFall, cyc = dr + up + fall, k = Math.exp(.9) - 1;
  const local = t => ((t % cyc) + cyc) % cyc;
  const v = t => {
    const u = local(t);
    return u < dr ? o.mdp + (1 - o.mdp) * (Math.exp(.9 * u / dr) - 1) / k
      : u < dr + up ? 1 + (o.pmPeak - 1) * Math.sin((u - dr) / up * Math.PI / 2)
        : o.pmPeak + (o.mdp - o.pmPeak) * smooth((u - dr - up) / fall);
  };
  const phase = t => { const u = local(t); return u < dr ? 4 : u < dr + up ? 0 : 3; };
  const cuts = [];
  for (let n = -2; n < 8; n++) cuts.push(n * cyc, n * cyc + dr, n * cyc + dr + up);
  return { v, phase, cuts: cuts.sort((a, b) => a - b), dr, up, fall, cyc, fire: n => n * cyc + dr };
}
// One path per phase, coloured by phase; upTo stops the trace at a moment (a trace that draws itself);
// dim draws the phases not listed in faint grey.
function trace(sh, m, colors, { upTo = Infinity, ghost = false, dim = null, w = 4 } = {}) {
  const t1 = Math.min(m.t1, upTo);
  if (t1 <= m.t0) return '';
  const cuts = [m.t0, ...sh.cuts.filter(c => c > m.t0 && c < t1), t1];
  let out = '';
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], ph = sh.phase((a + b) / 2), n = Math.max(2, Math.ceil((b - a) * 40));
    let d = '';
    for (let k = 0; k <= n; k++) { const t = a + (b - a) * k / n; d += `${k ? ' L' : 'M'}${f(m.x(t))} ${f(m.y(sh.v(t)))}`; }
    out += ghost ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="6 5" stroke-linejoin="round"/>`
      : `<path d="${d}" fill="none" stroke="${dim && !dim.includes(ph) ? FAINT : colors[ph]}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" data-phase="${ph}"/>`;
  }
  return out;
}
const tip = (sh, m, t, col = INK) => t > m.t0 && t < m.t1 ? dot(m.x(t), m.y(sh.v(t)), 6, col, 'stroke="#fff" stroke-width="2"') : '';

// The electrocardiogram: per beat, the P wave (the atria), the PR interval (P start to QRS start: atria, then the
// AV node's pause), the QRS complex (the ventricles' phase 0) and the T wave (their phase 3).
const PR0 = .62, P_LEN = .3;
function beat(o, q) {
  const sh = muscleShape(o), pr = PR0 * o.av, W = .2 * o.spread, tDur = .45 * o.fall / BASE.fall, tEnd = q + sh.a4;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const x = i / 8; pts.push([q - pr + P_LEN * x, .12 * Math.sin(Math.PI * x)]); }
  pts.push([q, 0], [q + .15 * W, -.12], [q + .45 * W, 1], [q + .75 * W, -.25], [q + W, 0]);
  for (let i = 0; i <= 14; i++) { const x = i / 14; pts.push([tEnd - tDur + tDur * x, .3 * Math.pow(Math.sin(Math.PI * x), 1.4) * (1 - .25 * x)]); }
  return { pts, q, pr, W, tEnd, p0: q - pr, tPeak: tEnd - .55 * tDur };
}
function ecgD(beats, m, upTo = Infinity) {
  const t1 = Math.min(m.t1, upTo), all = [[m.t0 - 9, 0], ...beats.flatMap(b => b.pts), [m.t1 + 9, 0]].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const [t, v] = all[i];
    if (t < m.t0) { const n = all[i + 1]; if (n && n[0] >= m.t0) out.push([m.t0, v + (n[1] - v) * (m.t0 - t) / (n[0] - t)]); continue; }
    if (t > t1) { const p = all[i - 1]; if (p) out.push([t1, p[1] + (v - p[1]) * (t1 - p[0]) / (t - p[0])]); break; }
    out.push([t, v]);
  }
  return out.length > 1 ? 'M' + out.map(([t, v]) => `${f(m.x(t))} ${f(m.y(v))}`).join(' L') : '';
}
// Beats driven by a pacemaker: each firing sets off the atria, then the AV node, then the ventricles.
const pmBeats = (o, sh, m) => { const out = []; for (let n = -1; n < 6; n++) { const s = sh.fire(n); if (s > m.t1) break; out.push(beat(o, s + .04 + PR0 * o.av)); } return out; };
// An interval as a bracket: [ from ... to ], solid for this state, dashed for normal.
const bracket = (m, a, b, y, col = BLUE, dashed = false) => `<path d="M${f(m.x(a))} ${y - 6} V${y + 6} M${f(m.x(a))} ${y} H${f(m.x(b))} M${f(m.x(b))} ${y - 6} V${y + 6}" fill="none" stroke="${col}" stroke-width="${dashed ? 2 : 3}"${dashed ? ' stroke-dasharray="4 3"' : ''}/>`;

// The membrane seen edge-on with three doors: sodium, calcium, potassium. Outside above, inside below.
// open: how open each door is, 0 to 1. Sodium and calcium flow in (down), potassium out (up).
const DOORS = [['na', 120], ['ca', 240], ['k', 360]];
const CROWD = {
  out: [['na', 74, -16], ['na', 168, -22], ['ca', 196, -12], ['na', 290, -20], ['ca', 314, -8], ['na', 410, -14], ['ca', 446, -22], ['k', 452, -6]],
  in: [['k', 92, 40], ['k', 168, 44], ['k', 196, 34], ['na', 284, 46], ['k', 312, 38], ['k', 414, 42], ['k', 446, 34]]
};
function strip(y, open, t, { focus = null, words = WORD, state = {}, speed = { na: 9, ca: 4, k: 6 }, sides = true } = {}) {
  let b = sides ? T(12, y - 30, 'outside', 'xs muted', 'start') + T(12, y + 58, 'inside', 'xs muted', 'start') : '';
  b += `<rect x="0" y="${y}" width="480" height="24" fill="${CELL}"/><path d="M0 ${y} H480 M0 ${y + 24} H480" stroke="${WALL}" stroke-width="3"/>`;
  for (const [ion, x, dy] of [...CROWD.out, ...CROWD.in]) b += ionShape(ion, x, y + dy, .8, 'opacity=".75"');
  for (const [ion, x] of DOORS) {
    const on = !focus || focus.includes(ion), o = on ? (open[ion] || 0) : 0, g = 3 + 8 * o;
    let d = `<rect x="${f(x - g - 9)}" y="${y - 7}" width="9" height="38" rx="3" fill="${DOOR}" stroke="${INK}" stroke-width="2"/><rect x="${f(x + g)}" y="${y - 7}" width="9" height="38" rx="3" fill="${DOOR}" stroke="${INK}" stroke-width="2"/>`;
    if (o < .15) d += `<rect x="${f(x - g - 1)}" y="${y + 8}" width="${f(2 * g + 2)}" height="8" fill="${INK}"/>`;
    for (let i = 0; o > .05 && i < 3; i++) {
      const u = (t * speed[ion] + i / 3) % 1, inward = ion !== 'k';
      d += ionShape(ion, x, inward ? lerp(y - 28, y + 52, u) : lerp(y + 52, y - 28, u), .9, op(o * Math.sin(Math.PI * u)));
    }
    if (words[ion]) d += T(x, y + 84, words[ion], `xs b ${CLS[ion]}`);
    if (state[ion]) d += T(x, y + 106, state[ion], 'xs');
    b += `<g data-part="door-${ion}"${on ? '' : ' opacity=".4"'}>${d}</g>`;
  }
  return b;
}

/* ---------- Steps 1 to 4: the cell and its doors ---------- */
const HEART = 'M0 -6 C-6 -20 -30 -18 -28 2 C-26 16 -8 26 0 34 C8 26 26 16 28 2 C30 -18 6 -20 0 -6 Z';
let clipN = 0;
function heartArt(t) {
  const wave = span(t, .05, .7), r = 30 + 200 * wave, cid = `heart-clip-${++clipN}`;
  let b = `<clipPath id="${cid}"><path d="${HEART}" transform="translate(128 132) scale(3.4)"/></clipPath>`;
  b += `<path d="${HEART}" transform="translate(128 132) scale(3.4)" fill="${CELL}" stroke="${WALL}" stroke-width="${f(3 / 3.4)}"/>`;
  b += `<g clip-path="url(#${cid})">${fadeIn(1 - span(t, .75, .95), `<circle cx="80" cy="78" r="${f(r)}" fill="${BLUE}" opacity=".16"/><circle cx="80" cy="78" r="${f(r)}" fill="none" stroke="${BLUE}" stroke-width="4"/>`)}</g>`;
  b += dot(80, 78, 8, CA, `stroke="#fff" stroke-width="2"`) + T(128, 274, 'heart', 'sm b');
  // A row of cells joined end to end: each squeezes as the signal reaches it.
  b += `<path d="M196 150 L268 112 M196 178 L268 270" stroke="${INK}" stroke-width="1.5"/><rect x="176" y="150" width="28" height="28" fill="none" stroke="${INK}" stroke-width="2"/>`;
  b += `<rect x="268" y="112" width="198" height="158" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  const cellsAt = [0, 1, 2];
  for (let r2 = 0; r2 < 2; r2++) cellsAt.forEach(c => {
    const when = .3 + c * .12 + r2 * .04, sq = Math.sin(Math.PI * span(t, when, when + .3)), w = 54 - 10 * sq, x = 278 + c * 62 + (54 - w) / 2, y = 130 + r2 * 66;
    b += `<g data-part="cells"><rect x="${f(x)}" y="${y}" width="${f(w)}" height="48" rx="12" fill="${CELL}" stroke="${WALL}" stroke-width="2.5"/></g>`;
  });
  const sx = 278 + 186 * span(t, .3, .62);
  b += fadeIn(span(t, .28, .32) * (1 - span(t, .64, .7)), `<path d="M${f(sx)} 120 V262" stroke="${BLUE}" stroke-width="4"/>`);
  b += T(367, 296, 'heart muscle cells', 'sm b') + T(240, 334, 'a signal sweeps from cell to cell,', 'sm') + T(240, 358, 'and each cell squeezes as it passes', 'sm');
  return b;
}
function batteryArt() {
  let b = `<rect x="40" y="60" width="400" height="200" rx="90" fill="${CELL}" stroke="${WALL}" stroke-width="9"/>`;
  b += `<g data-part="membrane"><rect x="40" y="60" width="400" height="200" rx="90" fill="none" stroke="${WALL}" stroke-width="9"/></g>`;
  for (let x = 130; x <= 350; x += 55) b += T(x, 90, '−', 'b on-cell') + T(x, 252, '−', 'b on-cell') + T(x, 46, '+', 'b') + T(x, 290, '+', 'b');
  b += T(72, 168, '−', 'b on-cell') + T(408, 168, '−', 'b on-cell') + T(22, 168, '+', 'b') + T(458, 168, '+', 'b');
  b += T(240, 158, 'inside: negative', 'b on-cell') + T(240, 184, 'compared with outside', 'sm on-cell') + T(240, 22, 'outside: positive', 'sm');
  b += `<path d="M420 318 L404 252" stroke="${INK}" stroke-width="1.5"/>${T(468, 336, 'cell membrane', 'sm b', 'end')}`;
  b += `<g data-part="voltage">${T(20, 386, 'voltage', 'sm b', 'start')}<path d="M130 380 H440" stroke="${INK}" stroke-width="3"/><path d="M130 372 V388 M440 372 V388 M285 374 V386" stroke="${INK}" stroke-width="2"/>`;
  b += `${T(130, 410, 'negative', 'xs', 'start')}${T(440, 410, 'positive', 'xs', 'end')}<path d="M172 376 l-9 -16 h18 z" fill="${BLUE}"/>${T(172, 352, 'this cell', 'xs b blue')}</g>`;
  return b;
}
// Fixed scattered spots for drawing ions.
const spots = (n, x0, x1, y0, y1, seed = 0) => Array.from({ length: n }, (_, i) => [x0 + (((i + seed) * .618034) % 1) * (x1 - x0), y0 + (((i + seed) * .381966 * 2.7) % 1) * (y1 - y0)]);
function ionsArt() {
  let b = `<rect x="0" y="214" width="480" height="150" fill="#fbf1ee"/><rect x="0" y="190" width="480" height="24" fill="${CELL}"/><path d="M0 190 H480 M0 214 H480" stroke="${WALL}" stroke-width="3"/>`;
  b += T(12, 26, 'outside the cell', 'sm b', 'start') + T(12, 248, 'inside the cell', 'sm b on-in', 'start');
  let ions = '';
  spots(9, 24, 300, 50, 170).forEach(([x, y]) => { ions += ionShape('na', x, y); });
  spots(6, 34, 300, 58, 168, 11).forEach(([x, y]) => { ions += ionShape('ca', x, y); });
  spots(2, 60, 280, 80, 160, 23).forEach(([x, y]) => { ions += ionShape('k', x, y); });
  spots(9, 24, 300, 268, 352, 5).forEach(([x, y]) => { ions += ionShape('k', x, y); });
  spots(2, 80, 260, 276, 340, 17).forEach(([x, y]) => { ions += ionShape('na', x, y); });
  b += `<g data-part="ions">${ions}</g>`;
  b += arrow('M352 110 V286', NA, 4, 'stroke-dasharray="8 6"') + arrow('M432 330 V142', KK, 4, 'stroke-dasharray="8 6"');
  b += T(352, 74, 'sodium,', 'xs b amber') + T(352, 94, 'calcium', 'xs b red') + T(352, 310, 'tend to', 'xs b on-in') + T(352, 330, 'move in', 'xs b on-in');
  b += T(468, 120, 'potassium', 'xs b green', 'end') + T(468, 352, 'moves out', 'xs b on-in', 'end');
  b += [['na', 'sodium', 'amber'], ['ca', 'calcium', 'red'], ['k', 'potassium', 'green']].map(([k, w, c], i) => ionShape(k, 26 + i * 150, 388) + T(42 + i * 150, 394, w, `xs b ${c}`, 'start')).join('');
  return b;
}
function channelsArt(t) {
  let b = T(12, 26, 'outside the cell', 'sm b', 'start') + T(12, 270, 'inside the cell', 'sm b', 'start');
  for (let x = 20; x <= 460; x += 30) b += T(x, 92, '+', 'b') + T(x, 196, '−', 'b');
  b += `<g data-part="doors">${strip(132, { na: 0, ca: 0, k: 1 }, t, { state: { na: 'shut', ca: 'shut', k: 'open' }, speed: { k: 4 }, sides: false })}</g>`;
  b += T(470, 270, 'potassium seeps out,', 'xs b green', 'end') + T(470, 292, 'taking positive charge', 'xs b green', 'end');
  b += `<g data-part="rest">${T(12, 352, 'resting potential', 'sm b', 'start')}<path d="M190 346 H460" stroke="${INK}" stroke-width="3"/><path d="M190 338 V354 M460 338 V354 M325 340 V352" stroke="${INK}" stroke-width="2"/>`;
  b += `${T(190, 378, 'negative', 'xs', 'start')}${T(460, 378, 'positive', 'xs', 'end')}<path d="M226 342 l-9 -16 h18 z" fill="${BLUE}"/></g>`;
  return b;
}

/* ---------- Steps 5 to 9: the muscle cell's beat, drawing itself ----------
   The beat runs in slow motion where it is quick (phases 0 and 1), so every phase can be watched. */
function beatClock(sh, t, tMax) {
  const K = [[0, -.3], [.08, 0], [.26, sh.a2], [.62, sh.a3], [.84, sh.a4], [1, tMax]];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [a, ta] = K[i - 1], [b, tb] = K[i]; return ta + (tb - ta) * (t - a) / (b - a); }
  return tMax;
}
const BEAT_M = frame(-.3, 1.95, 56, 468, 0, 222, 1, 60);
// Where each phase's number sits, beside the normal beat.
const BADGE_M = sh => ({ 0: [BEAT_M.x(0) - 18, 140], 1: [BEAT_M.x(sh.a1) + 22, 50], 2: [BEAT_M.x(.6), 62], 3: [BEAT_M.x(sh.fallAt(.45)) + 24, BEAT_M.y(.45)], 4: [BEAT_M.x(1.72), 200] });
const DOORS_AT = (sh, tau) => { const ph = sh.phase(tau); return { na: ph === 0 ? 1 : 0, ca: ph === 2 ? 1 : ph === 1 ? .4 : 0, k: ph === 3 ? 1 : ph === 1 ? .6 : ph === 2 ? .3 : .25 }; };
const STEP_PHASES = { outline: [0, 1, 2, 3, 4], na: [0], ca: [1, 2], k: [3, 4] };
function beatArt(kind, t) {
  const sh = muscleShape(BASE), m = BEAT_M, tau = beatClock(sh, t, m.t1), show = STEP_PHASES[kind], at = BADGE_M(sh);
  let b = axis(m, 34, 226) + T(468, 246, 'time →', 'xs muted', 'end');
  if (kind !== 'outline') b += `<g opacity=".9">${trace(sh, m, PH_M, { dim: [] })}</g>`;   // the whole beat, faint, to come
  const INKS = { 0: INK, 1: INK, 2: INK, 3: INK, 4: INK };
  b += `<g data-part="trace">${trace(sh, m, kind === 'outline' ? INKS : PH_M, { upTo: tau, dim: kind === 'k' || kind === 'outline' ? null : show })}</g>${tip(sh, m, tau)}`;
  for (const n of [0, 1, 2, 3, 4]) {
    if (!show.includes(n)) continue;
    const reached = n === 4 ? tau > sh.a4 : tau > sh.cuts[n];
    if (reached) b += `<g data-part="phase${n}">${badge(...at[n], n, kind === 'outline' ? INK : PH_M[n])}</g>`;
  }
  if (kind === 'outline') {
    const L = [[0, 'sharp rise'], [1, 'small dip'], [2, 'long flat top'], [3, 'fall back'], [4, 'rest till the next beat']];
    L.forEach(([n, w], i) => { const x = i < 3 ? 24 : 260, y = 290 + (i % 3) * 36; b += badge(x, y - 6, n, INK) + T(x + 22, y, w, 'xs b', 'start'); });
    return b;
  }
  if (kind === 'na' && tau > 0) b += T(at[0][0] + 44, 156, 'sodium rushes in', 'xs b amber', 'start');
  if (kind === 'ca') {
    if (tau > sh.a1) b += T(at[1][0] + 18, 40, 'potassium out, briefly', 'xs b green', 'start');
    if (tau > sh.a2) b += T(BEAT_M.x(.15), 128, 'calcium in,', 'xs b red', 'start') + T(BEAT_M.x(.15), 150, 'potassium out:', 'xs b green', 'start') + T(BEAT_M.x(.15), 172, 'a balance', 'xs b', 'start');
  }
  if (kind === 'k') {
    if (tau > sh.a3) b += T(at[3][0] + 18, at[3][1] - 10, 'potassium', 'xs b green', 'start') + T(at[3][0] + 18, at[3][1] + 12, 'rushes out', 'xs b green', 'start');
    if (tau > sh.a4) b += T(at[4][0] + 18, 206, 'rest', 'xs b', 'start');
  }
  b += strip(300, DOORS_AT(sh, tau), t, { focus: kind === 'na' ? ['na'] : kind === 'ca' ? ['ca', 'k'] : null });
  return b;
}
function refractoryArt(t) {
  const sh = muscleShape(BASE), m = frame(-.3, 1.95, 56, 468, 0, 206, 1, 56), tau = beatClock(sh, t, m.t1);
  let b = axis(m, 30, 210) + `<g data-part="trace">${trace(sh, m, PH_M, { upTo: tau })}</g>${tip(sh, m, tau)}`;
  const y = 240, x0 = m.x(0), xa = m.x(Math.min(tau, sh.refr)), xr = m.x(Math.min(tau, sh.a4));
  if (tau > 0) b += `<g data-part="refractory"><rect x="${f(x0)}" y="${y}" width="${f(xa - x0)}" height="16" fill="${INK}"/>${tau > sh.refr ? `<rect x="${f(m.x(sh.refr))}" y="${y}" width="${f(xr - m.x(sh.refr))}" height="16" fill="#8d9286"/>` : ''}</g>`;
  if (tau > .35) b += `<g data-part="refractory">${T(x0, 282, 'refractory period:', 'xs b', 'start')}${T(x0, 304, 'no new upswing can start', 'xs', 'start')}</g>`;
  if (tau > sh.refr) b += `${arrow(`M${f(m.x(sh.refr) + 30)} 330 V${y + 22}`, INK, 2)}${T(468, 350, 'late in phase 3:', 'xs b', 'end')}${T(468, 372, 'only a strong signal', 'xs', 'end')}`;
  // A stray signal arriving during the plateau finds the sodium doors locked.
  const s = span(t, .4, .46) * (1 - span(t, .58, .64));
  if (s > 0) b += fadeIn(s, `${arrow(`M${f(m.x(.6))} 34 V${f(m.y(sh.v(.6)) - 10)}`, BLUE, 3)}${T(m.x(.6) + 10, 34, 'a stray signal: no effect', 'xs b blue', 'start')}`);
  return b;
}

/* ---------- Steps 10 to 12: the pacemaker ---------- */
const PM_M = frame(-.25, 5.45, 56, 468, 0, 196, 1, 148);
function pmArt(kind, t) {
  const sh = pmShape(BASE), m = PM_M, tau = lerp(m.t0, m.t1, t), ca = kind === 'pm-ca';
  let b = axis(m, 54, 236) + T(468, 256, 'time →', 'xs muted', 'end');
  b += `<g data-part="threshold"><path d="M${m.x0} ${m.y(1)} H${m.x1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>${T(m.x0 + 4, m.y(1) - 8, 'threshold', 'xs muted', 'start')}</g>`;
  b += `<g opacity=".9">${trace(sh, m, PH_P, { dim: [] })}</g>`;
  b += `<g data-part="pm">${trace(sh, m, PH_P, { upTo: tau, dim: ca ? null : [4] })}</g>${tip(sh, m, tau)}`;
  const f0 = sh.fire(0);
  if (tau > 1) b += `<g data-part="phase4">${badge(m.x(1.05), m.y(sh.v(1.05)) + 26, 4, NA)}</g>`;
  if (!ca && tau > f0) b += `${T(m.x(f0) + 8, m.y(2.3) - 10, 'fires', 'xs b', 'start')}`;
  if (ca && tau > f0 + sh.up / 2) b += `<g data-part="phase0">${badge(m.x(f0) - 18, m.y(1.6), 0, CA)}</g>`;
  if (ca && tau > f0 + sh.up + sh.fall / 2) b += `<g data-part="phase3">${badge(m.x(f0 + sh.up + sh.fall * .45) + 22, m.y(1.4), 3, KK)}</g>`;
  // What the numbers mean.
  const L = ca ? [[4, 'slow drift up: sodium leaks in', NA], [0, 'rise: calcium in', CA], [3, 'fall: potassium out', KK]] : [[4, 'slow drift up: sodium leaks in', NA]];
  L.forEach(([n, w, c], i) => { const y = 286 + i * 30; b += badge(24, y - 6, n, c) + T(46, y, w, `xs b ${CLS[c === NA ? 'na' : c === CA ? 'ca' : 'k']}`, 'start'); });
  if (!ca) b += T(24, 330, 'no flat rest: the drift starts again', 'xs', 'start') + T(24, 352, 'as soon as each beat ends', 'xs', 'start');
  return b;
}
function nervesArt(t) {
  const tau = lerp(-.25, 5.45, t);
  const one = (o, y0, title, note, cls) => {
    const sh = pmShape(o), m = frame(-.25, 5.45, 56, 468, 0, y0 + 128, 1, y0 + 96);
    return T(12, y0 + 20, title, `sm b ${cls}`, 'start') + T(468, y0 + 20, note, 'xs b blue', 'end')
      + `<path d="M${m.x0} ${m.y(1)} H${m.x1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>`
      + `<g class="ghost">${trace(pmShape(BASE), m, PH_P, { ghost: true })}</g>` + `<g data-part="rate">${trace(sh, m, PH_P, { upTo: tau })}</g>` + tip(sh, m, tau);
  };
  let b = one(cell({ ...NORMAL, symp: 1.6 }), 4, 'noradrenaline', 'steeper drift: beats sooner ↑', 'red');
  b += one(cell({ ...NORMAL, para: 1.6 }), 190, 'acetylcholine', 'lower, flatter drift: later ↓', 'green');
  b += `<path d="M12 392 H40" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>${T(48, 398, 'normal', 'xs', 'start')}${T(468, 398, 'time →', 'xs muted', 'end')}`;
  return b;
}

/* ---------- Step 13: the signal's path through the heart ---------- */
function spreadArt(t) {
  const atria = span(t, .04, .26) * (1 - span(t, .84, .96)), pause = span(t, .26, .3) * (1 - span(t, .5, .54)), down = span(t, .5, .6), vent = span(t, .58, .78) * (1 - span(t, .9, 1));
  let b = '';
  b += `<g data-part="atria"><path d="M96 120 C80 60 140 34 204 52 L240 64 L276 52 C340 34 400 60 384 120 Z" fill="${CELL}" stroke="${WALL}" stroke-width="3"/>${fadeIn(atria * .9, `<path d="M96 120 C80 60 140 34 204 52 L240 64 L276 52 C340 34 400 60 384 120 Z" fill="${BLUE}" opacity=".2"/>`)}</g>`;
  b += `<g data-part="ventricles"><path d="M96 130 H384 C392 220 320 320 240 352 C160 320 88 220 96 130 Z" fill="${CELL}" stroke="${WALL}" stroke-width="3"/>${fadeIn(vent * .9, `<path d="M96 130 H384 C392 220 320 320 240 352 C160 320 88 220 96 130 Z" fill="${BLUE}" opacity=".2"/>`)}<path d="M240 130 V330" stroke="${WALL}" stroke-width="3"/></g>`;
  // The wiring: sinoatrial node, AV node, then the fast bundle and its branches.
  const wire = 'M240 132 V196 M240 196 C220 240 170 260 150 200 M240 196 C260 240 310 260 330 200';
  b += `<path d="${wire}" fill="none" stroke="${FAINT}" stroke-width="6" stroke-linecap="round"/>`;
  b += `<path d="${wire}" fill="none" stroke="${BLUE}" stroke-width="6" stroke-linecap="round" stroke-dasharray="400" stroke-dashoffset="${f(400 * (1 - down))}" ${op(1 - span(t, .9, 1))}/>`;
  b += `<g data-part="sa">${dot(120, 72, 11, CA, 'stroke="#fff" stroke-width="2"')}</g>${T(12, 28, 'sinoatrial node', 'xs b', 'start')}<path d="M70 34 L112 62" stroke="${INK}" stroke-width="1.5"/>`;
  b += `<g data-part="av">${dot(240, 124, 10 + 4 * pause, pause > .05 ? BLUE : INK, 'stroke="#fff" stroke-width="2"')}</g>`;
  b += T(268, 158, 'AV node: a pause', 'xs b', 'start') + `<path d="M266 152 L250 132" stroke="${INK}" stroke-width="1.5"/>`;
  b += T(240, 98, 'atria', 'sm b on-cell') + T(240, 300, 'ventricles', 'sm b on-cell');
  b += T(344, 240, 'fast wiring', 'xs b blue', 'start') + `<path d="M342 236 L318 222" stroke="${BLUE}" stroke-width="1.5"/>`;
  // The signal as a dot on its way.
  const pts = t < .26 ? [lerp(120, 240, span(t, .04, .26)), lerp(72, 124, span(t, .04, .26))] : t < .5 ? [240, 124] : t < .6 ? [240, lerp(124, 196, span(t, .5, .6))] : null;
  if (pts && t < .6) b += dot(pts[0], pts[1], 7, BLUE);
  b += T(240, 392, 'the pause lets the atria finish filling the ventricles', 'xs muted');
  return b;
}

/* ---------- Step 14: the electrocardiogram, drawn with the muscle cell's beat ---------- */
const ECG_T = [-.85, 2.15];
function ecgStepArt(t) {
  const o = BASE, sh = muscleShape(o), mA = frame(...ECG_T, 56, 468, 0, 160, 1, 44), mE = frame(...ECG_T, 56, 468, 0, 286, 1, 222);
  const tau = lerp(ECG_T[0], ECG_T[1], t), bt = beat(o, 0);
  let b = T(12, 24, 'heart muscle cell', 'xs b', 'start') + `<g data-part="trace">${trace(sh, mA, PH_M, { upTo: tau, w: 3.5 })}</g>${tip(sh, mA, tau)}`;
  b += T(12, 200, 'electrocardiogram', 'xs b', 'start') + `<path data-part="ecg" d="${ecgD([bt], mE, tau)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  // Guides: the QRS lines up with phase 0, the end of the T wave with the end of phase 3.
  for (const [tt, a] of [[0, tau > 0], [sh.a4, tau > sh.a4]]) if (a) b += `<path d="M${f(mA.x(tt))} 40 V300" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="2 4"/>`;
  if (tau > bt.p0 + .15) b += T(mE.x(bt.p0 + .15), 248, 'P', 'xs b');
  if (tau > .05) b += T(mE.x(.1), 212, 'QRS', 'xs b', 'start');
  if (tau > bt.tPeak) b += T(mE.x(bt.tPeak), 250, 'T', 'xs b');
  // The intervals, each appearing once it is complete.
  if (tau > 0) b += `<g data-part="pr">${bracket(mE, bt.p0, 0, 318)}${T(mE.x(bt.p0) - 8, 324, 'PR', 'xs b blue', 'end')}</g>`;
  if (tau > bt.W) b += `<g data-part="qrs">${bracket(mE, 0, bt.W, 342)}${T(mE.x(bt.W) + 8, 348, 'QRS: phase 0', 'xs b blue', 'start')}</g>`;
  if (tau > bt.tEnd) b += `<g data-part="qt">${bracket(mE, 0, bt.tEnd, 366)}${T(mE.x(0) - 8, 372, 'QT', 'xs b blue', 'end')}</g>`;
  if (tau > 0) b += T(mE.x(bt.p0), 398, 'PR: atria, then the AV node pause', 'xs', 'start');
  return b;
}

/* ---------- The whole picture: pacemaker, muscle cell and electrocardiogram (also Explore freely) ---------- */
const BLOCK_WORD = { na: 'sodium doors blocked', k: 'potassium doors blocked', ca: 'calcium doors blocked', beta: 'beta-1 receptors blocked' };
function wholeArt(o, { ghost = null, legend = '', blocks = [] } = {}) {
  const mP = frame(-.25, 5.45, 56, 468, 0, 100, 1, 82), mA = frame(...ECG_T, 56, 468, 0, 236, 1, 146), mE = frame(...ECG_T, 56, 468, 0, 322, 1, 282);
  const shP = pmShape(o), shA = muscleShape(o), bt = beat(o, 0);
  let b = T(12, 18, 'pacemaker cell', 'xs b', 'start') + T(468, 18, 'two beats', 'xs muted', 'end');
  b += `<path d="M${mP.x0} ${mP.y(1)} H${mP.x1}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="3 4"/>`;
  if (ghost) b += `<g class="ghost" data-ghost="normal">${trace(pmShape(ghost), mP, PH_P, { ghost: true })}</g>`;
  b += `<g data-part="pm">${trace(shP, mP, PH_P, { w: 3 })}</g>`;
  b += T(12, 132, 'heart muscle cell', 'xs b', 'start') + T(468, 132, 'one beat', 'xs muted', 'end');
  if (ghost) b += `<g class="ghost" data-ghost="normal">${trace(muscleShape(ghost), mA, PH_M, { ghost: true })}</g>`;
  b += `<g data-part="trace">${trace(shA, mA, PH_M, { w: 3.5 })}</g>`;
  b += T(12, 266, 'electrocardiogram', 'xs b', 'start');
  if (ghost) b += `<path class="ghost" d="${ecgD([beat(ghost, 0)], mE)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  b += `<path data-part="ecg" d="${ecgD([bt], mE)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
  const rows = [['PR', bt.p0, 0, 346], ['QRS', 0, bt.W, 368], ['QT', 0, bt.tEnd, 390]];
  for (const [w, a, z, y] of rows) {
    if (ghost) { const g = beat(ghost, 0), ga = w === 'PR' ? g.p0 : 0, gz = w === 'PR' ? 0 : w === 'QRS' ? g.W : g.tEnd; b += bracket(mE, ga, gz, y + 6, INK, true); }
    b += `<g data-part="${w.toLowerCase()}">${bracket(mE, a, z, y)}${T(mE.x(w === 'PR' ? a : 0) - 8, y + 6, w, 'xs b blue', 'end')}</g>`;
  }
  let h = 404;
  if (ghost || blocks.length) {
    const items = [];
    if (ghost) items.push([`<path d="M0 -6 H28" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>`, 'normal', 36], [`<path d="M0 -6 H10" stroke="${NA}" stroke-width="5"/><path d="M10 -6 H20" stroke="${CA}" stroke-width="5"/><path d="M20 -6 H30" stroke="${KK}" stroke-width="5"/>`, legend, 38]);
    for (const k of blocks) items.push([plug(8, -6), BLOCK_WORD[k], 22]);
    let x = 12, y = 424;
    for (const [icon, w, pad] of items) { const width = pad + w.length * 9.6; if (x > 12 && x + width > 472) { x = 12; y += 24; } b += `<g transform="translate(${f(x)} ${y})">${icon}${T(pad, 0, w, 'xs', 'start')}</g>`; x += width + 18; }
    h = y + 10;
  }
  const r = rel(o), attrs = Object.entries(r).map(([k, v]) => `data-${k}="${v.toFixed(4)}"`).join(' ');
  return { body: `<g data-new-state="${legend || 'current'}" ${attrs}>${b}</g>`, h };
}

/* ---------- What changes it: each class over a dashed ghost of normal ---------- */
const PM_KINDS = ['class2', 'class4'];
const BLOCKS = { class1a: ['na', 'k'], class1b: ['na'], class1c: ['na'], class2: ['beta'], class3: ['k'], class4: ['ca'] };
const NOTES = {
  class1a: ['phase 0 slower, phase 3 later', 'QRS wider, QT longer'],
  class1b: ['phases 2 and 3 a little shorter', 'QT a little shorter'],
  class1c: ['phase 0 much slower and lower', 'QRS much wider, PR longer'],
  class2: ['flatter phase 4: beats later ↓', 'PR longer, beats further apart'],
  class3: ['phase 3 later and slower', 'QT longer'],
  class4: ['slower drift up: beats later ↓', 'PR longer, beats further apart']
};
function keyRows(y, legend, blocks) {
  let b = `<path d="M12 ${y - 6} H40" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>${T(48, y, 'normal', 'xs', 'start')}`;
  b += `<path d="M130 ${y - 6} H140" stroke="${NA}" stroke-width="5"/><path d="M140 ${y - 6} H150" stroke="${CA}" stroke-width="5"/><path d="M150 ${y - 6} H160" stroke="${KK}" stroke-width="5"/>${T(168, y, legend, 'xs', 'start')}`;
  b += `<g data-part="drug">${plug(20, y + 18)}${T(36, y + 24, blocks.map(k => BLOCK_WORD[k]).join(' and '), 'xs', 'start')}</g>`;
  return b;
}
function muscleChangeArt(kind, o, a) {
  const g = BASE, mA = frame(...ECG_T, 56, 468, 0, 182, 1, 52), mE = frame(...ECG_T, 56, 468, 0, 266, 1, 222);
  const shA = muscleShape(o), shG = muscleShape(g), bt = beat(o, 0), bg = beat(g, 0), [noteA, noteE] = NOTES[kind];
  let b = T(12, 24, 'heart muscle cell', 'sm b', 'start') + fadeIn(a, T(468, 24, noteA, 'xs b blue', 'end'));
  b += `<g class="ghost" data-ghost="normal">${trace(shG, mA, PH_M, { ghost: true })}</g><g data-part="trace">${trace(shA, mA, PH_M)}</g>`;
  // What moved, marked on the trace.
  let marks = '';
  if (kind === 'class1a' || kind === 'class1c') marks += arrow(`M${f(mA.x(0) - 54)} ${f(mA.y(.5))} H${f(mA.x(0) - 10)}`, BLUE, 3) + badge(mA.x(0) - 66, mA.y(.5), 0, NA);
  if (kind === 'class1a' || kind === 'class3' || kind === 'class1b') {
    const v = .42, x1 = mA.x(shG.fallAt(v)), x2 = mA.x(shA.fallAt(v));
    if (Math.abs(x2 - x1) > 14) marks += arrow(`M${f(x1)} ${f(mA.y(v))} H${f(x2 + (x2 > x1 ? -8 : 8))}`, BLUE, 3.5);
    marks += badge(Math.max(x1, x2) + 22, mA.y(v) + 4, 3, KK);
  }
  b += fadeIn(a, marks);
  b += T(12, 210, 'electrocardiogram', 'sm b', 'start') + fadeIn(a, T(468, 210, noteE, 'xs b blue', 'end'));
  b += `<path class="ghost" d="${ecgD([bg], mE)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  b += `<path data-part="ecg" d="${ecgD([bt], mE)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const rows = [['PR', bt.p0, 0, bg.p0, 0, 296], ['QRS', 0, bt.W, 0, bg.W, 318], ['QT', 0, bt.tEnd, 0, bg.tEnd, 340]];
  for (const [w, x0, x1, g0, g1, y] of rows) b += bracket(mE, g0, g1, y + 6, INK, true) + `<g data-part="${w.toLowerCase()}">${bracket(mE, x0, x1, y)}${T(mE.x(w === 'PR' ? Math.min(x0, g0) : 0) - 8, y + 6, w, 'xs b blue', 'end')}</g>`;
  return b + keyRows(376, 'with the drug', BLOCKS[kind]);
}
function pmChangeArt(kind, o, a) {
  const g = BASE, m = frame(0, 5.7, 56, 468, 0, 172, 1, 134), mE = frame(0, 5.7, 56, 468, 0, 286, 1, 240);
  const sh = pmShape(o), sg = pmShape(g), [noteP, noteE] = NOTES[kind];
  let b = T(12, 24, 'pacemaker cell', 'sm b', 'start') + fadeIn(a, T(468, 24, noteP, 'xs b blue', 'end'));
  b += `<path d="M${m.x0} ${m.y(1)} H${m.x1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>${T(m.x0 + 4, m.y(1) - 8, 'threshold', 'xs muted', 'start')}`;
  b += `<g class="ghost" data-ghost="normal">${trace(sg, m, PH_P, { ghost: true })}</g><g data-part="pm">${trace(sh, m, PH_P)}</g>`;
  // The first beat comes later: an arrow from the normal firing to this one, at threshold.
  const x1 = m.x(sg.fire(0)), x2 = m.x(sh.fire(0));
  let marks = x2 - x1 > 16 ? arrow(`M${f(x1)} ${f(m.y(1))} H${f(x2 - 8)}`, BLUE, 3.5) : '';
  marks += kind === 'class2' ? badge(m.x(1.1), m.y(sh.v(1.1)) + 26, 4, NA) : badge(x2 - 20, m.y(1.7), 0, CA);
  b += fadeIn(a, marks);
  b += T(12, 216, 'electrocardiogram', 'sm b', 'start') + fadeIn(a, T(468, 216, noteE, 'xs b blue', 'end'));
  const beats = pmBeats(o, sh, mE), gBeats = pmBeats(g, sg, mE);
  b += `<path class="ghost" d="${ecgD(gBeats, mE)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  b += `<path data-part="ecg" d="${ecgD(beats, mE)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const first = beats.find(x => x.p0 > mE.t0);
  if (first) {
    b += `<g class="ghost">${bracket(mE, first.p0, first.p0 + PR0 * g.av, 322, INK, true)}</g>`;
    b += `<g data-part="pr">${bracket(mE, first.p0, first.q, 314)}${T(mE.x(first.p0) - 8, 322, 'PR', 'xs b blue', 'end')}</g>`;
  }
  return b + keyRows(356, 'with the drug', BLOCKS[kind]);
}
// The readout under a change: every measure that moved.
const ROWS = [
  ['Heart rate', 'rate', 'faster', 'slower'], ['Phase 0 rise', 'upstroke', 'slower', 'quicker', true], ['Plateau length', 'plateau', 'longer', 'shorter'],
  ['Plateau height', 'level', 'higher', 'lower'], ['Refractory period', 'refractory', 'longer', 'shorter'], ['PR interval', 'pr', 'longer', 'shorter'],
  ['QRS width', 'qrs', 'wider', 'narrower'], ['QT interval', 'qt', 'longer', 'shorter'], ['Squeeze strength', 'squeeze', 'stronger', 'weaker']
];
function compare(o) {
  const r = rel(o);
  // A slower rise means the upswing takes longer: its time goes up while its speed goes down.
  return ROWS.map(([name, key, up, down, inverse]) => { const v = r[key], d = v > 1.015 ? 'up' : v < .985 ? 'down' : 'same'; const shown = inverse ? { up: 'down', down: 'up', same: 'same' }[d] : d; return [name, shown, d === 'up' ? up : d === 'down' ? down : 'about the same']; });
}
const readoutOf = (o, all = false) => { const rows = compare(o).filter(r => all || r[1] !== 'same'); return readout(rows.length ? rows : [['Everything', 'same', 'about the same']]); };
const describe = o => { const ch = compare(o).filter(r => r[1] !== 'same'); return ch.length ? ch.map(([n, , w]) => `${n.toLowerCase()} ${w}`).join(', ') : 'everything about the same as normal'; };

/* ---------- The lesson's scenes, one per step kind ---------- */
const TITLE = { class1a: 'Class IA', class1b: 'Class IB', class1c: 'Class IC', class2: 'Class II, beta-blockers', class3: 'Class III', class4: 'Class IV' };
function change(kind) {
  return {
    duration: 3200,
    render(t) {
      const o = cell(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease.inOut(span(t, .12, .78)))), a = span(t, .6, .92);
      const pm = PM_KINDS.includes(kind), body = pm ? pmChangeArt(kind, o, a) : muscleChangeArt(kind, o, a);
      const label = `${TITLE[kind]}: ${pm ? 'the pacemaker cell and a strip of electrocardiogram beats' : 'the heart muscle cell’s beat and its electrocardiogram'}, each drawn over a dashed picture of normal. Key: ${BLOCKS[kind].map(k => BLOCK_WORD[k]).join(' and ')}. Compared with normal: ${describe(o)}.`;
      return { svg: svg(label, body, { h: pm ? 386 : 406 }), readout: readoutOf(o) };
    }
  };
}
const beatScene = (kind, label) => ({ duration: kind === 'outline' ? 4600 : 5200, loop: true, rest: .7, render: t => svg(label, beatArt(kind, t), { h: kind === 'outline' ? 370 : 404 }) });
const scenes = {
  heart: { duration: 3800, loop: true, rest: .5, render: t => svg('A heart with a blue ring spreading across it from a red dot at its upper left, the signal sweeping through. A zoomed box shows heart muscle cells joined end to end; a blue line runs across them and each cell squeezes shorter as it passes.', heartArt(t), { h: 372 }) },
  battery: () => svg('A large cell wrapped in a thick membrane. Minus signs line the inside of the membrane and plus signs the outside: the inside is negative compared with the outside. A voltage scale below marks this cell on the negative side.', batteryArt(), { h: 420 }),
  ions: () => svg('A strip of membrane separates outside the cell, above, from inside, below. Outside are many sodium circles and calcium squares and few potassium triangles; inside are many potassium triangles. Arrows show sodium and calcium tending to move in and potassium tending to move out.', ionsArt(), { h: 404 }),
  channels: { duration: 3000, loop: true, render: t => svg('The membrane seen edge-on with three doors. The sodium door and the calcium door are shut by a bar; the potassium door is open, and green potassium triangles pass out through it, carrying positive charge. Plus signs line the outside and minus signs the inside. A scale marks the resting potential on the negative side.', channelsArt(t), { h: 390 }) },
  outline: beatScene('outline', 'A graph of a heart muscle cell’s voltage against time, drawing itself: flat at rest, a sharp rise, a small dip, a long flat top, a fall back and rest. As each stage is drawn, its number appears beside it, 0 to 4, and a key below names them.'),
  na: beatScene('na', 'The heart muscle cell’s beat drawing itself, with phase 0, the sharp rise, in amber. Below it, the membrane: when phase 0 comes, the sodium door opens and amber sodium circles rush in.'),
  ca: beatScene('ca', 'The beat drawing itself with phase 1, a small green dip, and phase 2, the long red plateau. Below, a potassium door opens briefly, then the calcium door opens and red calcium squares trickle in while potassium triangles leak out, balancing.'),
  k: beatScene('k', 'The whole beat drawing itself in colour: amber phase 0, green phase 1, red phase 2, green phase 3 falling back, and phase 4 at rest. Below, during phase 3 the potassium door opens wide and potassium rushes out; at rest it stays a little open.'),
  refractory: { duration: 5200, loop: true, rest: .7, render: t => svg('The heart muscle cell’s beat drawing itself, with a bar growing beneath it: the refractory period, solid black from the upswing until the voltage has fallen most of the way back, then a pale end where only a strong signal can start a new upswing. A stray signal arriving during the plateau has no effect.', refractoryArt(t), { h: 384 }) },
  pm: { duration: 6000, loop: true, render: t => svg('A pacemaker cell’s voltage against time, drawing itself. It never stays flat: in phase 4, drawn in amber, it drifts slowly upward as sodium leaks in. Each time it reaches the dashed threshold line it fires, then falls back, and the drift starts again. Two beats are shown.', pmArt('pm', t), { h: 362 }) },
  'pm-ca': { duration: 6000, loop: true, render: t => svg('The pacemaker cell’s voltage again, drawing itself in colour: an amber phase 4 drift as sodium leaks in, a red phase 0 that rises gently on calcium, and a green phase 3 fall as potassium flows out. A key below names the three phases.', pmArt('pm-ca', t), { h: 382 }) },
  nerves: { duration: 6000, loop: true, render: t => svg('Two pacemaker graphs drawing themselves over a dashed normal trace. With noradrenaline, the drift starts a little higher and is steeper, so beats come sooner. With acetylcholine, the drift starts lower and is flatter, so beats come later.', nervesArt(t), { h: 408 }) },
  spread: { duration: 5200, loop: true, rest: .7, render: t => svg('A heart drawn as two upper chambers, the atria, over two lower chambers, the ventricles. A red dot at the upper left, the sinoatrial node, fires; the signal spreads across the atria, pauses at the AV node in the middle, then runs fast down blue wiring between the ventricles and out along their walls, and the ventricles light up.', spreadArt(t), { h: 404 }) },
  ecg: { duration: 5600, loop: true, rest: .99, render: t => svg('A heart muscle cell’s beat above an electrocardiogram on the same time line, both drawing themselves. Dotted guides show the electrocardiogram’s spike, the QRS complex, starting with the cell’s phase 0, and the end of its T wave matching the end of phase 3. Brackets mark the PR interval, the QRS complex and the QT interval.', ecgStepArt(t), { h: 408 }) },
  whole: () => { const { body, h } = wholeArt(BASE); return svg('The whole picture: a pacemaker cell drifting to threshold and firing twice, a heart muscle cell’s beat coloured by phase, and the electrocardiogram of one beat with the PR interval, the QRS complex and the QT interval bracketed.', body, { h }); },
  class1a: change('class1a'), class1b: change('class1b'), class1c: change('class1c'), class2: change('class2'), class3: change('class3'), class4: change('class4')
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['symp', 'para', 'na', 'naLate', 'beta', 'k', 'ca'];
const level = (k, v) => (k === 'symp' || k === 'para') ? (v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : (v < .02 ? 'none' : v < .4 ? 'some' : 'a lot');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  for (const k of ['k', 'symp']) { $(`#clinical-${k}`).value = params[k]; $(`#clinical-${k}-label`).textContent = level(k, params[k]); }
}
// The model's resting point on each bar: the textbook's single typical value, or the middle of its range.
const valueOf = id => data.values.find(x => x.id === id);
const reference = id => { const v = valueOf(id); return v.typical ?? (v.low + v.high) / 2; };
function measures(o) {
  const r = rel(o), rest = reference('vRest'), mdp0 = reference('sanMdp'), thr = reference('sanThreshold');
  return {
    vRest: rest, vPeak: rest + r.peak * (reference('vPeak') - rest), vPlateau: reference('vPlateau') * r.plateau,
    vRefractory: reference('vRefractory') * r.refractory, sanMdp: mdp0 + r.mdp * (thr - mdp0), sanThreshold: thr,
    sanRate: reference('sanRate') * r.rate, qrs: reference('qrs') * r.qrs, qt: reference('qt') * r.qt
  };
}
const DECIMALS = { mV: 1, s: 3, 'per min': 0 };
const num = (n, unit) => n.toFixed(DECIMALS[unit] ?? 2);
const show = (n, unit) => num(n, unit).replace(/^-/, '−');
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const pos = (v, n) => { const [a, b] = v.scale; return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
function update() {
  syncControls();
  const o = cell(params), { body, h } = wholeArt(o, { ghost: BASE, legend: 'your settings', blocks: ['na', 'beta', 'k', 'ca'].filter(b => params[b] > .02) });
  $('#explore-visual').innerHTML = svg(`Illustrative model with your settings, drawn over a dashed picture of normal. Compared with normal: ${describe(o)}.`, body, { h }) + readoutOf(o, true);
  const r = rel(o);
  const relText = `heart rate ×${r.rate.toFixed(2)} · phase 0 rise time ×${r.upstroke.toFixed(2)} · plateau ×${r.plateau.toFixed(2)} · refractory period ×${r.refractory.toFixed(2)} · PR ×${r.pr.toFixed(2)} · QRS width ×${r.qrs.toFixed(2)} · QT ×${r.qt.toFixed(2)} · squeeze ×${r.squeeze.toFixed(2)}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${relText}`; return; }
  const m = measures(o);
  $('#model-results').textContent = `Illustrative model, relative to normal: ${relText}. Scaled as in the Clinical values tab: sinus rate ${show(m.sanRate, valueOf('sanRate').unit)} ${valueOf('sanRate').unit} · QRS ${show(m.qrs, 's')} s · QT ${show(m.qt, 's')} s`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    const shown = Number(num(val, v.unit));
    row.querySelector('.reading').textContent = `${show(val, v.unit)} ${v.unit}`;
    const marker = row.querySelector('.marker'); marker.setAttribute('x1', pos(v, val)); marker.setAttribute('x2', pos(v, val));
    const status = v.low !== null && v.high !== null
      ? (shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range')
      : (shown > v.typical ? 'above the typical value' : shown < v.typical ? 'below the typical value' : 'at the typical value');
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'Not part of this state’s cited directions') : '';
    dir.classList.toggle('quiet', Boolean(state && !d));
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
for (const k of ['k', 'symp']) $(`#clinical-${k}`).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); announce(); });
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value, s = data?.states.find(x => x.id === id);
  params = { ...NORMAL, ...(CHANGES[id] || {}) };
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]${s.mechanismWhere ? ` · Channel physiology: ${s.mechanismWhere} [${s.mechanismSource}]` : ''}` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(cell(params));
    $('#cv-live').textContent = `Model sinus rate ${show(m.sanRate, 'per min')} per minute, plateau ${show(m.vPlateau, 's')} seconds, QRS ${show(m.qrs, 's')} seconds, QT ${show(m.qt, 's')} seconds.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['vRest', 'vPeak', 'vPlateau', 'vRefractory', 'sanMdp', 'sanThreshold', 'sanRate', 'qrs', 'qt'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of MODEL_KEYS) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && (Number.isFinite(v.typical) || (Number.isFinite(v.low) && Number.isFinite(v.high))) && Array.isArray(v.scale))) throw new Error('Invalid reference data');
    }
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'The teaching model’s resting point sits on each textbook typical value, or in the middle of each textbook range. Each number shown is the model’s relative result scaled from that resting point. Drug strengths in the model are arbitrary, so the size of each change is illustrative; only its direction is meant to teach.';
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const hasBand = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = hasBand ? `<rect class="band" x="${pos(v, v.low)}" y="12" width="${f(pos(v, v.high) - pos(v, v.low))}" height="22"/><path class="limit" d="M${pos(v, v.low)} 6 V40 M${pos(v, v.high)} 6 V40"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v, v.typical)} 0 V46"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${hasBand ? 'the textbook range as a shaded band' : 'the textbook typical value as a black tick'}, and a marker for the current illustrative model`);
      const n = x => String(x).replace(/^-/, '−');
      right.querySelector('.key').textContent = hasBand ? `Textbook range ${n(v.low)} to ${n(v.high)} ${v.unit} (shaded) · blue line: model`
        : `Textbook typical value ${n(v.typical)} ${v.unit} (black tick; no range given) · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceDois?.[id]) { const a = document.createElement('a'); a.href = `https://doi.org/${data.sourceDois[id]}`; a.textContent = `DOI ${data.sourceDois[id]}`; li.append(' · ', a); }
      $('#sources').append(li);
    }
    for (const s of data.states) {
      const li = document.createElement('li');
      li.textContent = `Directions for ${s.label}: ${s.where} [${s.source}]${s.mechanismWhere ? ` · Channel physiology: ${s.mechanismWhere} [${s.mechanismSource}]` : ''}`;
      $('#sources').append(li);
    }
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
