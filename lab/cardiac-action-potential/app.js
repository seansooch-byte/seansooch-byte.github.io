'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const range = n => Array.from({ length: n }, (_, i) => i);
const smooth = x => x * x * (3 - 2 * x);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const DRUG_KINDS = ['class1a', 'class1b', 'class1c', 'class2', 'class3', 'class4'];

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
  return { p, betaSig, up, peak, level, plateau, fall, refractory, spread, qtLen, squeeze, mdp, slope, drift, pmUp, pmPeak, pmFall, cycle };
}
const BASE = cell(NORMAL);
// Results relative to normal (1 = normal; mdp is a shift, 0 = normal).
const rel = o => ({
  rate: BASE.cycle / o.cycle, upstroke: o.up / BASE.up, peak: o.peak / BASE.peak, plateau: o.plateau / BASE.plateau,
  level: o.level / BASE.level, refractory: o.refractory / BASE.refractory, qrs: o.spread / BASE.spread,
  qt: o.qtLen / BASE.qtLen, squeeze: o.squeeze / BASE.squeeze, mdp: o.mdp - BASE.mdp
});
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Traces ---------- */
const T0 = .4, WM = 2.6, WP = 2.6 * BASE.cycle;
function muscleSegs(o) {
  const a = T0 + o.up, b = a + o.plateau, c = b + o.fall, hi = o.level + .07, lo = o.level - .07;
  return [
    { ion: 'rest', pts: [[0, 0], [T0, 0]] },
    { ion: 'na', pts: range(6).map(i => { const x = i / 5; return [T0 + o.up * x, o.peak * (1 - (1 - x) ** 2)]; }) },
    { ion: 'ca', pts: [[a, o.peak], ...range(13).map(i => { const x = i / 12; return [a + .035 + (b - a - .035) * x, hi - (hi - lo) * x * x]; })] },
    { ion: 'k', pts: range(15).map(i => { const x = i / 14; return [b + o.fall * x, lo * (1 - smooth(x))]; }) },
    { ion: 'rest', pts: [[c, 0], [WM, 0]] }
  ];
}
function pmSegs(o, W, plain = false) {
  const segs = [];
  let t = 0;
  const k = Math.exp(.9) - 1;
  while (t < W) {
    segs.push({ ion: 'na', pts: range(11).map(i => { const x = i / 10; return [t + o.drift * x, o.mdp + (1 - o.mdp) * (Math.exp(.9 * x) - 1) / k]; }) });
    t += o.drift;
    segs.push({ ion: plain ? 'rest' : 'ca', pts: range(7).map(i => { const x = i / 6; return [t + o.pmUp * x, 1 + (o.pmPeak - 1) * Math.sin(x * Math.PI / 2)]; }) });
    t += o.pmUp;
    segs.push({ ion: plain ? 'rest' : 'k', pts: range(11).map(i => { const x = i / 10; return [t + o.pmFall * x, o.pmPeak + (o.mdp - o.pmPeak) * smooth(x)]; }) });
    t += o.pmFall;
  }
  // Clip to the window.
  return segs.map(s => {
    const pts = [];
    for (let i = 0; i < s.pts.length; i++) {
      const [t1, v1] = s.pts[i];
      if (t1 <= W) { pts.push(s.pts[i]); continue; }
      if (i > 0) { const [t0, v0] = s.pts[i - 1]; if (t0 < W) pts.push([W, v0 + (v1 - v0) * (W - t0) / (t1 - t0)]); }
      break;
    }
    return { ...s, pts };
  }).filter(s => s.pts.length > 1);
}
function ecgShape(o) {
  const q = T0, w = .2 * o.spread, tEnd = T0 + BASE.up + o.qtLen, tDur = .45 * o.fall / BASE.fall;
  const pts = [[0, 0]];
  for (let i = 0; i <= 8; i++) { const x = i / 8; pts.push([q - .36 + .22 * x, .12 * Math.sin(Math.PI * x)]); }
  pts.push([q, 0], [q + .15 * w, -.12], [q + .45 * w, 1], [q + .75 * w, -.25], [q + w, 0]);
  for (let i = 0; i <= 14; i++) { const x = i / 14; pts.push([tEnd - tDur + tDur * x, .3 * Math.pow(Math.sin(Math.PI * x), 1.4) * (1 - .25 * x)]); }
  pts.push([WM, 0]);
  return { pts, q, w, tEnd };
}

/* ---------- Drawing ---------- */
const NA = '#254dff', CA = '#b3261e', K = '#1d6b45', INK = '#171916', RULE = '#babeb3', MUTED = '#53584d', CELL = '#f4e2dd', WALL = '#a8584c', DOOR = '#d6d9cc';
const ION = { na: NA, ca: CA, k: K, rest: INK };
const X0 = 74, X1 = 460;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
let pictureId = 0;
// Each picture gets its own ids: a marker or clip path referenced from a hidden step would not draw.
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [NA]: 'na', [CA]: 'ca', [K]: 'kk' };
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#ah-${MARK[color]})" ${extra}/>`;
const map = (W, vmin, vmax, top, bot, x0 = X0, x1 = X1) => ({ x: t => x0 + t / W * (x1 - x0), y: v => bot - (v - vmin) / (vmax - vmin) * (bot - top) });
const pathOf = (pts, m) => 'M' + pts.map(([t, v]) => `${f(m.x(t))} ${f(m.y(v))}`).join(' L');
function traces(segs, m, ghost = false, w = 4) {
  if (ghost) return `<path d="${pathOf(segs.flatMap(s => s.pts), m)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="5 4"/>`;
  return segs.map(s => `<path d="${pathOf(s.pts, m)}" fill="none" stroke="${ION[s.ion]}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${s.ion === 'rest' ? '' : ` data-ion="${s.ion}"`}/>`).join('');
}
// Shapes stand for the ions as well as colours: circle sodium, square calcium, triangle potassium.
const ionShape = (kind, x, y, s = 1) => kind === 'na' ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(8 * s)}" fill="${NA}"/>`
  : kind === 'ca' ? `<rect x="${f(x - 7 * s)}" y="${f(y - 7 * s)}" width="${f(14 * s)}" height="${f(14 * s)}" fill="${CA}"/>`
    : `<path d="M${f(x)} ${f(y - 9 * s)} L${f(x + 9 * s)} ${f(y + 7 * s)} L${f(x - 9 * s)} ${f(y + 7 * s)} Z" fill="${K}"/>`;
const plug = (x, y) => `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" rx="2" fill="#5d6270" stroke="${INK}" stroke-width="1.5"/><path d="M${x - 4} ${y - 3} L${x + 4} ${y + 3} M${x + 4} ${y - 3} L${x - 4} ${y + 3}" stroke="#fff" stroke-width="2"/>`;
const BLOCK_WORD = { na: 'sodium channels blocked', k: 'potassium channels blocked', ca: 'calcium channels blocked', beta: 'beta receptors blocked' };
function frame(y, h, title, note = '', axis = 'voltage ↑') {
  return text(20, y + 20, title, 'sm b', 'start') + (note ? text(X1, y + 20, note, 'sm b blue', 'end') : '')
    + `<rect x="${X0}" y="${y + 32}" width="${X1 - X0}" height="${h}" fill="#fff" stroke="${RULE}"/>`
    + `<text transform="translate(${X0 - 12} ${y + 32 + h / 2}) rotate(-90)" text-anchor="middle" class="xs">${axis}</text>`;
}

// One drawing with any of three panels. opt.pm: true | 'plain' (drift coloured, the rest plain); opt.muscle: ions drawn so far.
function picture(o, opt = {}) {
  const { pm = false, muscle = null, outline = '', refractory = false, ecg = false, ghost = null, legend = '', notes = {}, blocks = [], key = false, extra = null, height = 0 } = opt;
  let y = 8, frames = '', gh = '', now = '', labels = '';
  const L = {};
  if (pm) {
    const h = 124, top = y + 32, m = map(WP, -1.05, 3.1, top, top + h);
    L.pm = { y, top, bot: top + h, m };
    frames += frame(y, h, 'pacemaker cell', notes.pm);
    frames += `<path d="M${X0} ${f(m.y(1))} H${X1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>` + text(X0 + 8, m.y(1) - 6, 'threshold', 'xs muted', 'start');
    if (ghost) gh += traces(pmSegs(ghost, WP), m, true);
    now += traces(pmSegs(o, WP, pm === 'plain'), m, false, 3.5);
    labels += text(X1, top + h + 17, 'time →', 'xs', 'end');
    y = top + h + 30;
  }
  if (muscle) {
    const h = 140, top = y + 32, m = map(WM, -.15, 1.15, top, top + h);
    L.muscle = { y, top, bot: top + h, m };
    frames += frame(y, h, 'heart muscle cell', notes.muscle);
    if (outline) frames += `<path d="${pathOf(muscleSegs(BASE).flatMap(s => s.pts), m)}" fill="none" stroke="${outline === 'strong' ? MUTED : RULE}" stroke-width="${outline === 'strong' ? 3 : 2.5}" stroke-dasharray="${outline === 'strong' ? '7 5' : '3 5'}"/>`;
    if (ghost) gh += traces(muscleSegs(ghost), m, true);
    const segs = muscleSegs(o).filter(s => s.ion === 'rest' ? muscle.length > 2 || s.pts[0][0] === 0 : muscle.includes(s.ion));
    if (muscle.length) now += traces(segs, m);
    labels += text(X1, top + h + 17, 'time →', 'xs', 'end');
    y = top + h + 26;
    if (refractory) {
      const bar = (s, cls, attrs = '') => {
        const a = T0, b1 = T0 + s.refractory, b2 = T0 + s.up + s.plateau + s.fall;
        return `<g ${attrs}><rect x="${f(m.x(a))}" y="${y}" width="${f(m.x(b1) - m.x(a))}" height="12" ${cls === 'ghost' ? `fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"` : `fill="${INK}"`}/>`
          + (cls === 'ghost' ? '' : `<rect x="${f(m.x(b1))}" y="${y}" width="${f(m.x(b2) - m.x(b1))}" height="12" fill="#8d9286"/>`) + '</g>';
      };
      if (ghost) gh += bar(ghost, 'ghost');
      now += bar(o, '', 'data-band="refractory"');
      labels += text(X0, y + 32, 'refractory period', 'sm', 'start');
      L.refractoryY = y;
      y += 46;
    } else y += 6;
  }
  if (ecg) {
    const h = 96, top = y + 32, m = map(WM, -.4, 1.15, top, top + h);
    L.ecg = { y, top, bot: top + h, m };
    frames += frame(y, h, 'electrocardiogram', notes.ecg, 'signal ↑');
    const bracket = (s, dashed) => {
      const e = ecgShape(s), r1 = top + h + 12, r2 = top + h + 30, st = dashed ? `stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"` : `stroke="${NA}" stroke-width="3"`;
      return `<path d="M${f(m.x(e.q))} ${r1 - 5} V${r1 + 5} M${f(m.x(e.q))} ${r1} H${f(m.x(e.q + e.w))} M${f(m.x(e.q + e.w))} ${r1 - 5} V${r1 + 5}" fill="none" ${st}/>`
        + `<path d="M${f(m.x(e.q))} ${r2 - 5} V${r2 + 5} M${f(m.x(e.q))} ${r2} H${f(m.x(e.tEnd))} M${f(m.x(e.tEnd))} ${r2 - 5} V${r2 + 5}" fill="none" ${st}/>`;
    };
    if (ghost) gh += `<path d="${pathOf(ecgShape(ghost).pts, m)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="5 4"/>` + bracket(ghost, true);
    now += `<path data-trace="ecg" d="${pathOf(ecgShape(o).pts, m)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` + bracket(o, false);
    labels += text(m.x(T0) - 8, top + h + 17, 'QRS', 'xs b', 'end') + text(m.x(T0) - 8, top + h + 35, 'Q-T', 'xs b', 'end');
    labels += text(X1, top + h + 54, 'time →', 'xs', 'end');
    y = top + h + 62;
  }
  if (extra) labels += extra(L, o);
  if (ghost || key) {
    y += 8;
    if (ghost) {
      labels += `<path d="M20 ${y} H48" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 4"/>` + text(56, y + 6, 'normal', 'sm', 'start');
      labels += `<path d="M190 ${y} H208" stroke="${NA}" stroke-width="5"/><path d="M208 ${y} H226" stroke="${CA}" stroke-width="5"/><path d="M226 ${y} H244" stroke="${K}" stroke-width="5"/>` + text(252, y + 6, legend, 'sm b', 'start');
      y += 30;
    }
    labels += [['na', 'sodium', NA], ['ca', 'calcium', CA], ['k', 'potassium', K]].map(([k, w, c], i) => `<path d="M${20 + i * 150} ${y} H${48 + i * 150}" stroke="${c}" stroke-width="5"/>${text(56 + i * 150, y + 6, w, `sm b ${k === 'na' ? 'blue' : k === 'ca' ? 'red' : 'green'}`, 'start')}`).join('');
    y += 30;
    blocks.forEach((b, i) => { const yy = y + i * 28; labels += `<g data-block="${b}">${plug(29, yy)}</g>` + text(46, yy + 6, BLOCK_WORD[b], 'sm', 'start'); });
    y += 28 * blocks.length;
    y += 4;
  }
  const r = rel(o), attrs = s => Object.entries(s).map(([k, v]) => `data-${k}="${v.toFixed(4)}"`).join(' ');
  let body = DEFS + frames;
  if (ghost) body += `<g class="ghost" data-ghost="normal" ${attrs(rel(ghost))}>${gh}</g>`;
  body += `<g data-new-state="${esc(legend || 'current')}" ${attrs(r)}>${now}</g>` + labels;
  return { body, h: Math.max(height, y + 6) };
}

/* ---------- Core step pictures ---------- */
const HEART = 'M0 -6 C-6 -20 -30 -18 -28 2 C-26 16 -8 26 0 34 C8 26 26 16 28 2 C30 -18 6 -20 0 -6 Z';
function heartPicture() {
  let b = DEFS + `<clipPath id="ah-clip"><path d="${HEART}" transform="translate(140 150) scale(3.6)"/></clipPath>`;
  b += `<path d="${HEART}" transform="translate(140 150) scale(3.6)" fill="${CELL}" stroke="${WALL}" stroke-width="${f(3 / 3.6)}"/>`;
  b += `<g clip-path="url(#ah-clip)">${[34, 74, 114, 154].map(r => `<circle cx="104" cy="96" r="${r}" fill="none" stroke="${NA}" stroke-width="3" stroke-dasharray="7 6"/>`).join('')}</g>`;
  b += text(140, 304, 'heart', 'b');
  b += `<rect x="176" y="188" width="30" height="30" fill="none" stroke="${INK}" stroke-width="2"/><path d="M206 188 L272 110 M206 218 L272 330" stroke="${INK}" stroke-width="1.5"/>`;
  b += `<rect x="272" y="110" width="190" height="220" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  // Cells joined end to end; those the signal has passed are squeezed shorter.
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const squeezed = c === 0 || (c === 1 && r !== 1), w = squeezed ? 46 : 54, x = 282 + c * 60 + (54 - w) / 2, yy = 124 + r * 64 + (r % 2) * 8;
    b += `<rect x="${x}" y="${yy}" width="${w}" height="44" rx="12" fill="${CELL}" stroke="${WALL}" stroke-width="2.5"/>`;
  }
  b += arrow('M282 210 H452', NA, 4) + text(366, 352, 'heart muscle cells', 'sm b');
  b += text(240, 400, 'a signal sweeps from cell to cell,', 'sm') + text(240, 424, 'and each cell squeezes as it passes', 'sm');
  return b;
}
function batteryPicture() {
  let b = DEFS + `<rect x="40" y="70" width="400" height="230" rx="100" fill="${CELL}" stroke="${WALL}" stroke-width="8"/>`;
  for (let x = 120; x <= 360; x += 48) b += text(x, 100, '−', 'b on-cell') + text(x, 302, '−', 'b on-cell') + text(x, 58, '+', 'b') + text(x, 334, '+', 'b');
  b += text(70, 192, '−', 'b on-cell') + text(410, 192, '−', 'b on-cell') + text(22, 192, '+', 'b') + text(460, 192, '+', 'b');
  b += text(240, 180, 'inside: negative', 'b on-cell') + text(240, 208, 'compared with outside', 'sm on-cell') + text(240, 28, 'outside: positive', 'sm');
  b += `<path d="M408 360 L392 286" stroke="${INK}" stroke-width="1.5"/>` + text(460, 378, 'cell membrane', 'sm b', 'end');
  b += text(20, 420, 'voltage', 'sm b', 'start') + `<path d="M120 414 H440" stroke="${INK}" stroke-width="3"/><path d="M120 406 V422 M440 406 V422 M280 408 V420" stroke="${INK}" stroke-width="2"/>`;
  b += text(120, 444, 'negative', 'xs', 'start') + text(440, 444, 'positive', 'xs', 'end') + `<path d="M170 410 l-9 -16 h18 z" fill="${NA}"/>` + text(170, 386, 'this cell', 'xs b blue');
  return b;
}
// Fixed scattered spots for drawing ions.
const spots = (n, x0, x1, y0, y1, seed = 0) => range(n).map(i => [x0 + (((i + seed) * .618034) % 1) * (x1 - x0), y0 + (((i + seed) * .381966 * 2.7) % 1) * (y1 - y0)]);
function membrane(y, h = 24, doors = []) {
  let b = `<rect x="0" y="${y}" width="480" height="${h}" fill="${CELL}"/><path d="M0 ${y} H480 M0 ${y + h} H480" stroke="${WALL}" stroke-width="3"/>`;
  for (const [x, open] of doors) {
    b += `<rect x="${x - 26}" y="${y - 10}" width="14" height="${h + 20}" fill="${DOOR}" stroke="${INK}" stroke-width="2"/><rect x="${x + 12}" y="${y - 10}" width="14" height="${h + 20}" fill="${DOOR}" stroke="${INK}" stroke-width="2"/>`;
    b += open ? `<rect x="${x - 12}" y="${y}" width="24" height="${h}" fill="#fff"/>` : `<rect x="${x - 12}" y="${y + h / 2 - 5}" width="24" height="10" fill="${INK}"/>`;
  }
  return b;
}
const ionKey = y => [['na', 'sodium'], ['ca', 'calcium'], ['k', 'potassium']].map(([k, w], i) => ionShape(k, 34 + i * 150, y - 5) + text(50 + i * 150, y, w, `sm b ${k === 'na' ? 'blue' : k === 'ca' ? 'red' : 'green'}`, 'start')).join('');
function ionsPicture() {
  let b = DEFS + `<rect x="0" y="274" width="480" height="210" fill="#fbf1ee"/>` + membrane(250);
  b += text(16, 34, 'outside the cell', 'sm b', 'start') + text(16, 304, 'inside the cell', 'sm b', 'start') + text(470, 266, 'membrane', 'xs on-cell', 'end');
  spots(10, 30, 280, 60, 230).forEach(([x, y]) => { b += ionShape('na', x, y); });
  spots(6, 40, 280, 70, 225, 11).forEach(([x, y]) => { b += ionShape('ca', x, y); });
  spots(2, 60, 280, 90, 210, 23).forEach(([x, y]) => { b += ionShape('k', x, y); });
  spots(10, 30, 280, 326, 460, 5).forEach(([x, y]) => { b += ionShape('k', x, y); });
  spots(2, 80, 260, 340, 440, 17).forEach(([x, y]) => { b += ionShape('na', x, y); });
  b += arrow('M350 130 V330', NA, 4, 'stroke-dasharray="8 6"') + arrow('M440 420 V180', K, 4, 'stroke-dasharray="8 6"');
  b += text(350, 96, 'sodium,', 'xs b blue') + text(350, 114, 'calcium', 'xs b red') + text(350, 356, 'tend to move in', 'xs b');
  b += text(474, 160, 'potassium', 'xs b green', 'end') + text(474, 446, 'tends to move out', 'xs b', 'end');
  b += ionKey(520);
  return b;
}
function channelsPicture() {
  let b = DEFS + `<rect x="0" y="274" width="480" height="210" fill="#fbf1ee"/>` + membrane(250, 24, [[96, false], [240, false], [384, true]]);
  b += text(16, 34, 'outside the cell', 'sm b', 'start') + text(16, 336, 'inside the cell', 'sm b', 'start');
  [['sodium door', 'closed', 96, 'blue'], ['calcium door', 'closed', 240, 'red'], ['potassium door', 'open', 384, 'green']].forEach(([w, s, x, c]) => { b += text(x, 196, w, `xs b ${c}`) + text(x, 214, s, 'xs'); });
  spots(7, 20, 300, 56, 170).forEach(([x, y]) => { b += ionShape('na', x, y, .9); });
  spots(4, 30, 300, 60, 165, 11).forEach(([x, y]) => { b += ionShape('ca', x, y, .9); });
  spots(8, 20, 290, 360, 470, 5).forEach(([x, y]) => { b += ionShape('k', x, y, .9); });
  b += arrow('M384 320 V232', K, 4) + ionShape('k', 384, 296, .9) + ionShape('k', 384, 262, .9) + ionShape('k', 352, 132, .9) + ionShape('k', 420, 112, .9) + ionShape('k', 452, 150, .9);
  b += text(16, 236, '+ + +', 'b', 'start') + text(160, 236, '+ + +', 'b', 'start') + text(16, 296, '− − −', 'b on-cell', 'start') + text(160, 296, '− − −', 'b on-cell', 'start');
  b += text(470, 350, 'potassium seeps out,', 'xs b green', 'end') + text(470, 368, 'taking positive charge', 'xs b green', 'end');
  b += text(20, 520, 'resting potential', 'sm b', 'start') + `<path d="M190 514 H460" stroke="${INK}" stroke-width="3"/><path d="M190 506 V522 M460 506 V522" stroke="${INK}" stroke-width="2"/>`;
  b += text(190, 544, 'negative', 'xs', 'start') + text(460, 544, 'positive', 'xs', 'end') + `<path d="M226 510 l-9 -16 h18 z" fill="${NA}"/>`;
  return b;
}
function spreadPicture() {
  let b = DEFS + `<path d="${HEART}" transform="translate(240 110) scale(4.2)" fill="${CELL}" stroke="${WALL}" stroke-width="${f(3 / 4.2)}"/>`;
  b += `<path d="M126 120 Q240 146 354 120" fill="none" stroke="${WALL}" stroke-width="3"/><path d="M240 140 V236" stroke="${WALL}" stroke-width="3"/>`;
  b += `<path d="M240 136 V228 M240 228 Q180 222 152 150 M240 228 Q300 222 328 150" fill="none" stroke="${NA}" stroke-width="5" stroke-linecap="round"/>`;
  b += arrow('M178 74 Q206 100 232 128', NA, 3, 'stroke-dasharray="6 5"') + arrow('M168 80 Q150 100 140 116', NA, 3, 'stroke-dasharray="6 5"');
  b += `<circle cx="172" cy="70" r="9" fill="${CA}" stroke="${INK}" stroke-width="2"/>` + `<path d="M160 64 L118 40" stroke="${INK}" stroke-width="1.5"/>` + text(20, 34, 'sinoatrial node', 'sm b', 'start');
  b += `<path d="M196 280 L200 214 M284 280 L280 214" stroke="${INK}" stroke-width="1.5"/>` + text(240, 300, 'ventricles', 'sm b');
  b += `<path d="M330 176 L400 200" stroke="${INK}" stroke-width="1.5"/>` + text(470, 220, 'fast wiring', 'sm b blue', 'end');
  // A row of cells, each upswing a moment after the last.
  const y0 = 330;
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 92, m = map(2.2, -.2, 1.2, y0 + 10, y0 + 110, x + 4, x + 70), shift = i * .2 - .3;
    b += `<rect x="${x}" y="${y0}" width="74" height="120" rx="14" fill="${CELL}" stroke="${WALL}" stroke-width="2.5"/>`;
    const segs = muscleSegs(BASE).map((s, j) => ({ ...s, pts: (j === 0 ? [[0, 0], [T0 + shift, 0]] : s.pts.map(([t, v]) => [t + shift, v])).filter(([t]) => t <= 2.2) })).filter(s => s.pts.length > 1);
    b += `<rect x="${x + 4}" y="${y0 + 10}" width="66" height="100" fill="#fff"/>` + traces(segs, m, false, 2.5);
    if (i < 4) b += arrow(`M${x + 75} ${y0 + 60} H${x + 90}`, NA, 2.5);
  }
  b += text(240, y0 + 172, 'each upswing sets off the next cell', 'sm') + text(240, y0 + 196, 'time runs left to right in each cell', 'xs muted');
  return b;
}

// Muscle-panel labels for the steps that build the action potential.
const muscleLabels = which => (L, o) => {
  const m = L.muscle.m;
  let s = '';
  if (which.includes('shape')) s += text(m.x(T0 + .05) + 8, m.y(.45), 'sharp rise', 'sm b', 'start') + text(m.x(1.1), m.y(1.03), 'long flat top', 'sm b') + text(X1 - 4, m.y(.55), 'fall back to rest', 'sm b', 'end') + text(X0 + 6, m.y(.07), 'rest', 'xs', 'start');
  if (which.includes('na')) s += text(m.x(T0 + .05) + 8, m.y(.45), 'sodium rushes in', 'sm b blue', 'start');
  if (which.includes('ca')) s += text(m.x(1.1), m.y(1.03), 'calcium holds it up', 'sm b red');
  if (which.includes('k')) s += text(X1 - 4, m.y(.55), 'potassium flows out', 'sm b green', 'end');
  if (which.includes('refr')) s += text(X1, L.refractoryY + 32, 'pale end: strong signal only', 'xs', 'end');
  return s;
};
const pmLabels = which => L => {
  const m = L.pm.m;
  let s = '';
  if (which === 'drift') s += text(X0 + 8, m.y(-.42), 'slow drift up:', 'xs b blue', 'start') + text(X0 + 8, m.y(-.8), 'sodium leaks in', 'xs blue', 'start') + text(m.x(BASE.drift + .15) + 8, m.y(2.55), 'fires', 'xs b', 'start');
  if (which === 'ca') s += text(m.x(BASE.drift + .1) - 6, m.y(2.6), 'calcium: gentle upswing', 'xs b red', 'start') + text(m.x(BASE.drift + .5) + 4, m.y(-.55), 'potassium: back down', 'xs b green', 'start');
  return s;
};
const ecgLabels = L => {
  const top = L.muscle.top, bot = L.ecg.bot, mm = L.muscle.m, e = ecgShape(BASE);
  return [e.q, e.tEnd].map(t => `<path d="M${f(mm.x(t))} ${top} V${bot}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="2 4"/>`).join('')
    + text(L.ecg.m.x(e.q + .25), L.ecg.m.y(.8), 'spike: signal sweeps', 'xs', 'start') + text(L.ecg.m.x(e.q + .25), L.ecg.m.y(.55), 'through the ventricles', 'xs', 'start');
};
// Step 12: one pacemaker panel per nerve, each over the normal ghost.
function nervesPicture() {
  const one = (o, y, title, note) => {
    const h = 124, top = y + 32, m = map(WP, -1.05, 3.1, top, top + h);
    return frame(y, h, title, note) + `<path d="M${X0} ${f(m.y(1))} H${X1}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 4"/>`
      + `<g class="ghost">${traces(pmSegs(BASE, WP), m, true)}</g>` + traces(pmSegs(o, WP), m, false, 3.5);
  };
  let b = DEFS + one(cell({ ...NORMAL, symp: 1.6 }), 8, 'noradrenaline', 'beats sooner: faster ↑') + one(cell({ ...NORMAL, para: 1.6 }), 196, 'acetylcholine', 'beats later: slower ↓');
  b += `<path d="M20 392 H48" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 4"/>` + text(56, 398, 'normal', 'sm', 'start') + text(X1, 398, 'time →', 'xs', 'end');
  return b;
}

/* ---------- Words for changes ---------- */
const ROWS = [
  ['Heart rate', 'rate', '↑ faster', '↓ slower'],
  ['Upswing', 'upstroke', '↓ slower', '↑ quicker'],
  ['Upswing height', 'peak', '↑ higher', '↓ lower'],
  ['Plateau length', 'plateau', '↑ longer', '↓ shorter'],
  ['Plateau height', 'level', '↑ higher', '↓ lower'],
  ['Refractory period', 'refractory', '↑ longer', '↓ shorter'],
  ['QRS width', 'qrs', '↑ wider', '↓ narrower'],
  ['Q-T interval', 'qt', '↑ longer', '↓ shorter'],
  ['Squeeze strength', 'squeeze', '↑ stronger', '↓ weaker']
];
function compare(o) {
  const r = rel(o);
  return ROWS.map(([name, key, up, down]) => { const v = r[key]; const d = v > 1.015 ? 'up' : v < .985 ? 'down' : 'same'; return [name, d, d === 'up' ? up : d === 'down' ? down : '↔ about the same']; });
}
function readout(o, all = false) {
  const rows = compare(o), changed = rows.filter(r => r[1] !== 'same');
  const items = (all ? rows : changed).map(([n, d, w]) => `<li><b>${n}</b> <span class="${d}">${w}</span></li>`);
  if (!all && changed.length < rows.length) items.push('<li><b>Everything else</b> <span>↔ about the same</span></li>');
  return `<ul class="readout" aria-label="Compared with normal">${items.join('')}</ul>`;
}
const describe = o => { const ch = compare(o).filter(r => r[1] !== 'same'); return ch.length ? ch.map(([n, , w]) => `${n.toLowerCase()} ${w.slice(2)}`).join(', ') : 'everything about the same as normal'; };

/* ---------- Lesson steps ---------- */
const FULL = ['na', 'ca', 'k'];
const draw = (label, pic) => svg(label, pic.body, pic.h);
const CORE = {
  heart: () => svg('A heart with dashed rings spreading across it from its upper left. A zoomed box shows heart muscle cells joined end to end, with an arrow for the electrical signal passing across them; the cells it has passed are squeezed shorter.', heartPicture(), 440),
  battery: () => svg('A large cell wrapped in a thick membrane. Minus signs line the inside of the membrane and plus signs the outside: the inside is negative compared with the outside. A voltage scale below marks this cell on the negative side.', batteryPicture(), 456),
  ions: () => svg('A strip of membrane separates outside the cell, above, from inside, below. Outside are many sodium circles and calcium squares and few potassium triangles; inside are many potassium triangles. Arrows show sodium and calcium tending to move in and potassium tending to move out.', ionsPicture(), 532),
  channels: () => svg('The membrane strip with three doors. The sodium door and the calcium door are closed by a bar; the potassium door is open, and potassium triangles pass out through it, carrying positive charge. Plus signs line the outside and minus signs the inside. A scale marks the resting potential on the negative side.', channelsPicture(), 556),
  outline: () => draw('A graph of a heart muscle cell’s voltage against time, drawn as a dashed outline: flat at rest, a sharp rise, a long flat top, then a fall back to rest.', picture(BASE, { muscle: [], outline: 'strong', extra: muscleLabels(['shape']) })),
  na: () => draw('The voltage graph with its first piece drawn in blue: the sharp rise, made by sodium rushing in. The rest of the shape is a faint outline.', picture(BASE, { muscle: ['na'], outline: 'faint', extra: muscleLabels(['na']) })),
  ca: () => draw('The voltage graph with the blue sodium rise and now a red, nearly flat plateau, held up by calcium. The fall is still a faint outline.', picture(BASE, { muscle: ['na', 'ca'], outline: 'faint', extra: muscleLabels(['na', 'ca']) })),
  k: () => draw('The complete action potential: a blue sodium rise, a red calcium plateau and a green potassium fall back to rest.', picture(BASE, { muscle: FULL, key: true, extra: muscleLabels(['na', 'ca', 'k']) })),
  refractory: () => draw('The complete action potential with a bar beneath it: the refractory period, solid black from the rise until the voltage has fallen most of the way back, then a pale end where only a strong signal can start a new upswing.', picture(BASE, { muscle: FULL, refractory: true, key: true, extra: muscleLabels(['refr']) })),
  pm: () => draw('A pacemaker cell’s voltage against time: it never stays flat but drifts slowly upward, in blue, as sodium leaks in. Each time it reaches the dashed threshold line it fires, then falls back, and the drift starts again. Three beats are shown.', picture(BASE, { pm: 'plain', extra: pmLabels('drift') })),
  'pm-ca': () => draw('The pacemaker cell’s voltage again, now coloured by ion: a blue sodium drift, a red calcium upswing that rises gently, and a green potassium fall back down.', picture(BASE, { pm: true, key: true, extra: pmLabels('ca') })),
  nerves: () => svg('Two pacemaker graphs over a dashed normal trace. With noradrenaline, the drift is steeper and starts higher, so beats come sooner and the heart rate is faster. With acetylcholine, the drift starts lower and is flatter, so beats come later and the heart rate is slower.', nervesPicture(), 412),
  spread: () => svg('A heart. A red dot at its upper left is the sinoatrial node; dashed arrows carry the signal across the top of the heart to blue fast wiring that runs down the middle and up the walls of the ventricles, the two big pumping chambers. Below, a row of five cells each shows its action potential a moment after the cell before.', spreadPicture(), 540),
  ecg: () => draw('A heart muscle cell’s action potential above an electrocardiogram on the same time line. Dotted guides show the electrocardiogram’s spike, the QRS complex, starting with the upswing, and the end of its later bump matching the end of the fall. Brackets mark the QRS complex and the Q-T interval.', picture(BASE, { muscle: FULL, ecg: true, extra: ecgLabels })),
  whole: () => draw('The whole picture: a pacemaker cell drifting to threshold and firing, a heart muscle cell’s action potential with its sodium rise, calcium plateau and potassium fall above its refractory period, and the electrocardiogram with its QRS complex and Q-T interval bracketed.', picture(BASE, { pm: true, muscle: FULL, refractory: true, ecg: true, key: true }))
};
const CHANGE_NOTES = {
  class1a: { muscle: 'slower upswing, longer plateau', ecg: 'wider QRS, longer Q-T' },
  class1b: { muscle: 'slightly shorter plateau', ecg: 'shorter Q-T' },
  class1c: { muscle: 'slower, lower upswing', ecg: 'wider QRS' },
  class2: { pm: 'flatter drift: slower rate' },
  class3: { muscle: 'longer plateau', ecg: 'longer Q-T' },
  class4: { pm: 'slower drift and upswing', muscle: 'lower plateau' }
};
const BLOCKS = { class1a: ['na', 'k'], class1b: ['na'], class1c: ['na'], class2: ['beta'], class3: ['k'], class4: ['ca'] };
function changePicture(el, t) {
  const kind = el.dataset.kind, ease = 1 - Math.pow(1 - t, 3);
  const o = cell(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease));
  const name = el.dataset.stepTitle.split(':')[0];
  const pic = picture(o, { pm: true, muscle: FULL, refractory: true, ecg: true, ghost: BASE, legend: 'with the drug', notes: CHANGE_NOTES[kind], blocks: BLOCKS[kind] });
  const label = `${name} drugs: the pacemaker cell, the heart muscle cell with its refractory period, and the electrocardiogram, each drawn over a dashed picture of normal. Legend: ${BLOCKS[kind].map(b => BLOCK_WORD[b]).join(' and ')}. Compared with normal: ${describe(o)}.`;
  return { pic: svg(label, pic.body, pic.h), ro: readout(o) };
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frameId = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind in CHANGES;
const lastReadout = new WeakMap();
function drawAt(el, t) {
  const v = visualOf(el), { pic, ro } = changePicture(el, t), old = v.querySelector('svg');
  if (!old) { v.innerHTML = pic + ro; lastReadout.set(v, ro); return; }
  old.outerHTML = pic;
  if (lastReadout.get(v) !== ro) { v.querySelector('.readout').outerHTML = ro; lastReadout.set(v, ro); }
}
function animate(el) {
  cancelAnimationFrame(frameId);
  if (reducedMotion()) { drawAt(el, 1); return; }
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / 1600);
    drawAt(el, t);
    if (t < 1) frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
}
steps.forEach(el => {
  const kind = el.dataset.kind;
  if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
  else drawAt(el, 1);
  el.querySelector('.replay')?.addEventListener('click', () => animate(el));
});
function showStep(n, focus = false) {
  cancelAnimationFrame(frameId);
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
  if (tab.id === 'tab-lesson') { if (isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frameId);
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
  const o = cell(params);
  $('#explore-visual').innerHTML = draw(`Illustrative model with your settings, drawn over a dashed picture of normal. Compared with normal: ${describe(o)}.`,
    picture(o, { pm: true, muscle: FULL, refractory: true, ecg: true, ghost: BASE, legend: 'your settings', blocks: ['na', 'beta', 'k', 'ca'].filter(b => params[b] > .02) })) + readout(o, true);
  const r = rel(o);
  const relText = `heart rate ×${r.rate.toFixed(2)} · upswing time ×${r.upstroke.toFixed(2)} · plateau ×${r.plateau.toFixed(2)} · refractory period ×${r.refractory.toFixed(2)} · QRS width ×${r.qrs.toFixed(2)} · Q-T ×${r.qt.toFixed(2)} · squeeze ×${r.squeeze.toFixed(2)}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${relText}`; return; }
  const m = measures(o);
  $('#model-results').textContent = `Illustrative model, relative to normal: ${relText}. Scaled as in the Clinical values tab: sinus rate ${show(m.sanRate, valueOf('sanRate').unit)} ${valueOf('sanRate').unit} · QRS ${show(m.qrs, 's')} s · Q-T ${show(m.qt, 's')} s`;
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
    $('#cv-live').textContent = `Model sinus rate ${show(m.sanRate, 'per min')} per minute, plateau ${show(m.vPlateau, 's')} seconds, QRS ${show(m.qrs, 's')} seconds, Q-T ${show(m.qt, 's')} seconds.`;
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
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'Full text'; li.append(' · ', a); }
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
update();
load();
