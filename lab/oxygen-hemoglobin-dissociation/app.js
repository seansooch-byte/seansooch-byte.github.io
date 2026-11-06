// Lesson 9: Oxygen and hemoglobin. The kit (/lab/kit/kit.js) runs the page; this file is the model,
// the pictures and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

/* ---------- Teaching model ----------
   Saturation follows a Hill curve, sat = x^n / (1 + x^n), with x = oxygen pressure ÷ half-saturation pressure.
   No clinical number lives here: once clinical-values.json loads, the curve is fitted through its arterial and
   venous points and the resting oxygen use comes from its utilization coefficient (see load()). Contents are
   relative: 1 means every seat of a normal amount of hemoglobin holding oxygen. */
// If the data file cannot load, the lesson still runs on an illustrative stand-in curve (arbitrary pressure units).
const FALLBACK = { n: 2.5, p50: 1, pa: 3.6, use: .24 };
let K = null;
const NORMAL = { lung: 1, shift: 1, hb: 1, co: 0, demand: 1 };
const CHANGES = {
  right: { shift: 1.4 },   // acid, carbon dioxide, heat, 2,3-BPG: half-saturation pressure up by two fifths
  left: { shift: .7 },     // fetal hemoglobin, cold, alkalosis: down by three tenths
  co: { co: .5 },          // carbon monoxide on half the seats
  anemia: { hb: .5 }       // half the hemoglobin
};
const CO_GRIP = .6;        // carbon monoxide makes the remaining seats grip tighter: P50 × (1 − 0.6 × share taken)
const sat = x => x <= 0 ? 0 : 1 / (1 + Math.pow(x, -K.n));
const unsat = s => { const c = clamp(s, 1e-4, 1 - 1e-4); return Math.pow(c / (1 - c), 1 / K.n); };

function model(p) {
  const p50 = K.p50 * p.shift * (1 - CO_GRIP * p.co);
  const pa = K.pa * p.lung;
  const sa1 = sat(pa / p50);                 // share of the free seats holding oxygen, leaving the lungs
  const seats = p.hb * (1 - p.co);           // seats free for oxygen, relative to normal
  const ca = seats * sa1;
  const need = K.use * p.demand;             // oxygen the tissues remove on each pass
  const floor = seats * .02;
  const short = ca - need < floor;
  const cv = Math.min(ca, Math.max(ca - need, floor));
  const sv1 = cv / seats;
  return {
    p, p50, pa, pv: p50 * unsat(sv1), sa1, sv1, seats, ca, cv, short,
    // Two saturations: sa1/sv1 are functional (share of the seats free for oxygen that hold it; P50 is defined on
    // this one), sa/sv are fractional (share of all seats, including those taken by carbon monoxide). Without
    // carbon monoxide they are equal.
    sa: (1 - p.co) * sa1, sv: (1 - p.co) * sv1,
    given: ca - cv, util: ca > 0 ? (ca - cv) / ca : 0
  };
}
let BASE = null;
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17). */
const INK = '#171916', BLUE = '#254dff', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const HB = '#f6dcd7', CELL = '#efc3bb', CO_BAND = '#dcdfe4', BLUE_FILL = '#d1d8fd';
let pictureId = 0;  // each picture gets its own arrowhead ids: a marker referenced from a hidden step would not draw
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [RED]: 'r' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const o2dot = (x, y, r = 6) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${RED}"/>`;
const fade = a => `opacity="${f(a)}"`;

// One hemoglobin molecule: a rounded square with four seats. seats: array of 'o2' | 'co' | 'empty'.
function molecule(x, y, size, seats, { round = .32 } = {}) {
  const r = size * round, q = size * .29, sr = size * .16;
  let s = `<g data-molecule data-part="molecule"><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(r)}" fill="${HB}" stroke="${INK}" stroke-width="1.5"/>`;
  [[q, q], [size - q, q], [q, size - q], [size - q, size - q]].forEach(([dx, dy], i) => {
    const st = seats[i], cx = f(x + dx), cy = f(y + dy);
    if (st === 'o2') s += `<circle data-seat="o2" data-part="seat" cx="${cx}" cy="${cy}" r="${f(sr)}" fill="${RED}"/>`;
    else if (st === 'co') s += `<rect data-seat="co" data-part="seat" x="${f(cx - sr)}" y="${f(cy - sr)}" width="${f(sr * 2)}" height="${f(sr * 2)}" fill="${INK}"/>`;
    else s += `<circle data-seat="empty" data-part="seat" cx="${cx}" cy="${cy}" r="${f(sr)}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
  });
  return s + '</g>';
}
const filled = n => [0, 1, 2, 3].map(i => i < n ? 'o2' : 'empty');

// The curve, in its frame. Pressures run to 1.3 × the normal lung pressure.
const CH = { x0: 70, x1: 456, y0: 250, top: 58 };
const XMAX = () => K.pa * 1.3;
const px = P => f(CH.x0 + (CH.x1 - CH.x0) * clamp(P / XMAX(), 0, 1));
const py = c => f(CH.y0 - (CH.y0 - CH.top) * c);
const contentAt = (o, P) => o.seats * sat(P / o.p50);
function curvePath(o, upTo = 1) {
  let d = '';
  const n = Math.max(2, Math.round(96 * upTo));
  for (let i = 0; i <= n; i++) { const P = XMAX() * upTo * i / n; d += `${i ? ' L' : 'M'}${px(P)} ${py(contentAt(o, P))}`; }
  return d;
}
function axes(yWord) {
  return `<path d="M${CH.x0} 30 V${CH.y0} H${CH.x1 + 10}" fill="none" stroke="${INK}" stroke-width="2"/>`
    + text(16, 20, yWord, 'xs b', 'start') + text(CH.x1 + 14, CH.y0 + 44, 'oxygen pressure →', 'xs b', 'end');
}
function ceiling(o, cls = '') {
  let s = '';
  if (o.p.co > .02) {
    s += `<rect data-co-band data-part="co" x="${CH.x0}" y="${py(o.p.hb)}" width="${CH.x1 - CH.x0}" height="${f(py(o.seats) - py(o.p.hb))}" fill="${CO_BAND}"/>`;
    if (o.p.co > .2) s += text(CH.x1 - 6, f((py(o.p.hb) + py(o.seats)) / 2 + 6), 'seats taken by carbon monoxide', 'xs on-band', 'end');
  }
  s += `<path data-ceiling d="M${CH.x0} ${py(o.seats)} H${CH.x1}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 4"/>`;
  if (cls !== 'quiet') s += text(CH.x0 + 8, f(py(o.seats) - 9), 'all seats full', 'xs muted', 'start');
  return s;
}
function points(o, { lungs = true, tissues = true, labels = true } = {}) {
  let s = '';
  if (lungs) {
    s += `<circle data-point="lungs" cx="${px(o.pa)}" cy="${py(o.ca)}" r="9" fill="${RED}" stroke="#fff" stroke-width="2"/>`;
    if (labels) s += text(px(o.pa), f(py(o.ca) + 32), 'lungs', 'sm b red');
  }
  if (tissues) {
    s += `<circle data-point="tissues" cx="${px(o.pv)}" cy="${py(o.cv)}" r="8" fill="#fff" stroke="${RED}" stroke-width="3.5"/>`;
    if (labels) s += text(f(px(o.pv) + 14), f(py(o.cv) + 26), 'tissues', 'sm b red', 'start');
  }
  return s;
}
function givenArrow(o, label = true, grow = 1) {
  const x = px(o.pv), y1 = py(o.ca), y2 = py(o.cv), yEnd = y1 + (y2 - y1) * grow;
  let s = `<path d="M${px(o.pa)} ${y1} H${x}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  if (yEnd - y1 > 22) s += arrow(`M${x} ${y1} V${f(yEnd - 13)}`, RED, 4);
  if (label && y2 - y1 > 30 && grow > .6) s += text(f(x - 10), f((y1 + y2) / 2 + 6), 'unloaded', 'xs b red', 'end', fade(span(grow, .6, 1)));
  return `<g data-given>${s}</g>`;
}
function halfMarker(o, label = true) {
  const x = px(o.p50), y = py(o.seats / 2);
  let s = `<path d="M${CH.x0} ${y} H${x} V${CH.y0}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<circle cx="${x}" cy="${y}" r="6" fill="${INK}"/>`;
  s += text(CH.x0 - 8, f(y + 6), 'half', 'xs b', 'end');
  if (label) s += text(Math.max(x, 120), CH.y0 + 22, 'half-saturation pressure', 'xs b');
  return `<g data-half data-part="half">${s}</g>`;
}
function chart(o, opt = {}) {
  const { ghost = null, yWord = 'oxygen carried ↑', lungs = true, tissues = true, given = true, half = true, labels = true, grip = '', reveal = 1 } = opt;
  let s = '';
  s += ceiling(o, ghost ? 'quiet' : '');
  if (ghost) {
    let gh = `<path d="${curvePath(ghost)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
    if (Math.abs(ghost.seats - o.seats) > .01) gh += `<path d="M${CH.x0} ${py(ghost.seats)} H${CH.x1}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>`;
    gh += `<circle cx="${px(ghost.pa)}" cy="${py(ghost.ca)}" r="7" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${px(ghost.pv)}" cy="${py(ghost.cv)}" r="7" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/>`;
    s += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}>${gh}</g>`;
  }
  s += axes(yWord);
  s += `<path data-curve d="${curvePath(o, reveal)}" fill="none" stroke="${BLUE}" stroke-width="4.5" stroke-linejoin="round"/>`;
  if (half) s += halfMarker(o, labels);
  if (grip && ghost) {
    const x = px(ghost.pv), y1 = py(contentAt(ghost, ghost.pv)), y2 = py(contentAt(o, ghost.pv));
    if (Math.abs(y2 - y1) > 16) {
      s += `<g data-grip>${arrow(`M${x} ${y1} V${f(y2 + (y2 > y1 ? -9 : 9))}`, INK, 3)}</g>`;
    }
  }
  if (given && lungs && tissues && !grip) s += givenArrow(o, labels);
  s += points(o, { lungs, tissues, labels });
  return s;
}

// Two rows of molecules (six is normal): leaving the lungs, leaving the tissues. Extra hemoglobin adds a seventh.
function seatRow(o, s1, y, word) {
  const present = clamp(Math.round(6 * o.p.hb), 0, 7), total = present * 4, slots = Math.max(6, present);
  const step = slots > 6 ? 36 : 40, size = slots > 6 ? 30 : 32;
  const coN = Math.round(total * o.p.co), o2N = Math.round((total - coN) * s1);
  const st = Array.from({ length: slots }, () => ['empty', 'empty', 'empty', 'empty']);
  let k = 0;
  for (let j = 0; j < 4; j++) for (let m = 0; m < present; m++) if (k < coN) { st[m][j] = 'co'; k++; }
  k = 0;  // with teamwork, molecules tend to be either full or empty: fill one molecule at a time
  for (let m = 0; m < present; m++) for (let j = 0; j < 4; j++) if (k < o2N && st[m][j] === 'empty') { st[m][j] = 'o2'; k++; }
  let s = text(16, y + 23, word, 'xs b', 'start');
  for (let m = 0; m < slots; m++) {
    const x = 214 + m * step;
    s += m < present ? molecule(x, y, size, st[m]) : `<rect data-molecule="missing" x="${x}" y="${y}" width="${size}" height="${size}" rx="10" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  }
  return s;
}
const seatRows = (o, y) => seatRow(o, o.sa1, y, 'leaving the lungs') + seatRow(o, o.sv1, y + 42, 'leaving the tissues');
// The key under a picture: normal and this state, then whatever the seat rows need, wrapping as needed.
function key(o, y, legend) {
  const items = [];
  if (legend) {
    items.push([`<path d="M0 -6 H30" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5"/>`, 'normal', 38]);
    items.push([`<path d="M0 -6 H30" stroke="${BLUE}" stroke-width="5"/>`, legend, 38]);
  }
  items.push([o2dot(9, -6), 'oxygen', 22]);
  if (o.p.co > .02) items.push([`<rect x="3" y="-12" width="12" height="12" fill="${INK}"/>`, 'seat taken by carbon monoxide', 22]);
  if (o.p.hb < .9) items.push([`<rect x="0" y="-15" width="18" height="18" rx="6" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="4 4"/>`, 'missing hemoglobin', 24]);
  let x = 16, row = 0, body = '';
  for (const [icon, word, pad] of items) {
    const w = pad + word.length * 9.2;
    if (x > 16 && x + w > 470) { x = 16; row++; }
    body += `<g transform="translate(${f(x)} ${y + row * 28})">${icon}${text(pad, 0, word, 'xs', 'start')}</g>`;
    x += w + 20;
  }
  return { body, rows: row + 1 };
}

function attrs(s) {
  return `data-pa="${(s.pa / BASE.pa).toFixed(4)}" data-sa="${(s.sa / BASE.sa).toFixed(4)}" data-p50="${(s.p50 / BASE.p50).toFixed(4)}" data-ca="${(s.ca / BASE.ca).toFixed(4)}" data-pv="${(s.pv / BASE.pv).toFixed(4)}" data-sv="${(s.sv / BASE.sv).toFixed(4)}" data-seats="${(s.seats / BASE.seats).toFixed(4)}"`;
}
// What a change moved, named on the picture itself: an arrow on the chart, and its words in the empty
// space under the curve's flat top (the steep middle is too crowded for words).
function named(kind, o, g, a) {
  if (!g || a <= 0) return '';
  let s = '';
  // Under a lowered ceiling the lungs dot and its label sit lower too, so the words drop below them.
  const top = Math.max(186, py(o.seats) + 66);
  const words = (rows) => rows.map(([w, cls], i) => text(452, top + i * 24, w, cls, 'end')).join('');
  if (kind === 'right' || kind === 'left') {
    const level = kind === 'right' ? .8 : .92, k = Math.pow(level / (1 - level), 1 / K.n);
    const x1 = px(g.p50 * k), x2 = px(o.p50 * k), y = py(level * g.seats);
    if (Math.abs(x2 - x1) > 18) s += arrow(`M${x1} ${y} H${f(x2 + (x2 > x1 ? -8 : 8))}`, BLUE, 3.5);
    s += kind === 'right'
      ? words([['→ curve slides right', 'xs b blue'], ['↓ lets go more', 'xs b'], ['at the same pressure', 'xs muted']])
      : words([['← curve slides left', 'xs b blue'], ['↑ holds on tighter', 'xs b'], ['at the same pressure', 'xs muted']]);
  }
  if (kind === 'co' || kind === 'anemia') {
    const x = CH.x0 + 40, y1 = py(g.seats) + 6, y2 = py(o.seats) - 10;
    if (y2 - y1 > 20) s += arrow(`M${x} ${f(y1)} V${f(y2)}`, BLUE, 3.5);
    s += kind === 'co'
      ? words([['↓ fewer seats for oxygen', 'xs b blue'], ['and the rest grip tighter', 'xs']])
      : words([['↓ fewer seats', 'xs b blue'], ['each still fills fully', 'xs']]);
  }
  return `<g data-named ${fade(a)}>${s}</g>`;
}
// The whole picture: the curve, then the seats, then the key.
function picture(o, { ghost = null, legend = '', grip = '', kind = '', a = 1 } = {}) {
  let b = DEFS + `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${chart(o, { ghost, grip })}${named(kind, o, ghost, a)}${seatRows(o, 306)}</g>`;
  const keyY = 412, k = key(o, keyY, ghost ? legend : '');
  return { body: b + k.body, h: keyY + 12 + 28 * (k.rows - 1) };
}
const pictureSvg = (label, o, opt) => { const { body, h } = picture(o, opt); return svg(label, body, h); };

/* ---------- Build the curve: the step pictures ---------- */
function tripPicture() {
  let b = DEFS;
  // Lungs
  b += `<path d="M240 14 V48 M240 48 Q222 58 206 70 M240 48 Q258 58 274 70" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  b += `<path d="M200 58 C160 38 120 68 118 112 C116 150 150 164 196 150 C214 142 214 78 200 58 Z" fill="#f3d9d4" stroke="${RED}" stroke-width="2.5"/>`;
  b += `<path d="M280 58 C320 38 360 68 362 112 C364 150 330 164 284 150 C266 142 266 78 280 58 Z" fill="#f3d9d4" stroke="${RED}" stroke-width="2.5"/>`;
  b += text(240, 190, 'lungs: oxygen in', 'sm b red');
  // Tissues
  b += `<rect x="110" y="300" width="260" height="78" rx="16" fill="#e6dccb" stroke="${INK}" stroke-width="2"/>`;
  b += text(240, 334, 'tissues: oxygen used', 'sm b') + text(240, 360, 'muscle, brain, gut', 'xs');
  // The loop of blood: out on the right, back on the left.
  b += arrow('M380 124 C446 170 446 270 384 312', RED, 5);
  b += arrow('M96 312 C34 270 34 170 98 130', MUTED, 5);
  for (const [x, y] of [[428, 186], [436, 248]]) b += `<ellipse cx="${x}" cy="${y}" rx="17" ry="11" fill="${CELL}" stroke="${RED}" stroke-width="2"/>${o2dot(x - 6, y, 3.5)}${o2dot(x + 6, y, 3.5)}`;
  for (const [x, y] of [[50, 248], [44, 186]]) b += `<ellipse cx="${x}" cy="${y}" rx="17" ry="11" fill="${CELL}" stroke="${RED}" stroke-width="2"/>`;
  b += text(240, 234, 'red blood cells', 'sm b') + text(240, 258, 'full going out, lighter coming back', 'xs');
  return b;
}
function cellPicture() {
  let b = DEFS;
  b += `<ellipse cx="132" cy="180" rx="112" ry="90" fill="${CELL}" stroke="${RED}" stroke-width="3"/><ellipse cx="132" cy="180" rx="54" ry="38" fill="#e9b2a8" opacity=".55"/>`;
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39996, r = 16 + 70 * Math.sqrt((i + .5) / 30), x = 132 + r * Math.cos(a) * 1.05, y = 180 + r * Math.sin(a) * .8;
    b += `<rect x="${f(x - 6)}" y="${f(y - 6)}" width="12" height="12" rx="4" fill="${HB}" stroke="${INK}" stroke-width="1"/>`;
  }
  b += text(132, 300, 'red blood cell', 'sm b red');
  b += `<path d="M186 150 L292 92 M186 166 L292 248" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  b += `<rect x="180" y="148" width="14" height="14" rx="4" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`;
  b += molecule(292, 92, 156, ['o2', 'o2', 'empty', 'empty']);
  b += text(370, 72, 'hemoglobin', 'sm b');
  b += text(370, 280, 'four oxygen seats', 'sm b');
  b += text(370, 304, 'two full, two empty', 'xs');
  return b;
}
function pressurePicture() {
  let b = DEFS;
  const panel = (x, w, word, n, level, levelWord) => {
    let s = `<rect x="${x}" y="44" width="${w}" height="170" rx="14" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
    // An evenly scattered (R2 low-discrepancy) sprinkle of oxygen.
    for (let i = 0; i < n; i++) s += o2dot(x + 18 + ((.5 + i * .7548777) % 1) * (w - 36), 62 + ((.5 + i * .5698403) % 1) * 134, 5.5);
    s += text(x + w / 2, 30, word, 'sm b');
    s += `<g data-part="pressure"><rect x="${x}" y="250" width="${w}" height="26" fill="#fff" stroke="${RULE}"/><rect data-gauge x="${x}" y="250" width="${f(w * level)}" height="26" fill="${RED}"/></g>`;
    s += text(x + w / 2, 304, levelWord, 'sm b');
    return s;
  };
  b += panel(16, 196, 'air sac in the lungs', 34, .9, 'pressure: high');
  b += panel(268, 196, 'working tissue', 7, .32, 'pressure: low');
  b += text(240, 240, 'oxygen pressure', 'xs muted');
  b += arrow('M212 128 H260', INK, 4);
  b += text(240, 344, 'oxygen moves from high pressure to low', 'sm');
  return b;
}
// Moving: oxygen pressure rises around one molecule, and its seats fill.
function fillPicture(t) {
  const P = XMAX() * ease(span(t, .05, .95)), s = sat(P / K.p50), n = clamp(Math.round(4 * s - .2), 0, 4);
  let b = DEFS;
  b += text(16, 34, 'oxygen pressure around it', 'xs b', 'start');
  b += `<g data-part="pressure"><rect x="16" y="46" width="448" height="22" fill="#fff" stroke="${RULE}"/><rect x="16" y="46" width="${f(448 * P / XMAX())}" height="22" fill="${RED}" opacity=".85"/></g>`;
  b += text(16, 92, 'low', 'xs muted', 'start') + text(464, 92, 'high', 'xs muted', 'end');
  b += molecule(70, 118, 120, filled(n));
  b += text(318, 160, `${n} of 4`, 'lg b red') + text(318, 188, 'seats full', 'sm b');
  b += text(16, 286, 'saturation: share of seats full', 'xs b', 'start');
  b += `<g data-part="saturation"><rect x="16" y="298" width="448" height="22" fill="#fff" stroke="${RULE}"/><rect x="16" y="298" width="${f(448 * s)}" height="22" fill="${BLUE}"/></g>`;
  b += text(16, 344, 'empty', 'xs muted', 'start') + text(240, 344, 'half', 'xs muted') + text(464, 344, 'full', 'xs muted', 'end');
  return b;
}
function teamPicture() {
  let b = DEFS;
  b += molecule(24, 60, 92, filled(0), { round: .08 }) + molecule(194, 60, 92, filled(1), { round: .2 }) + molecule(364, 60, 92, filled(4));
  b += text(70, 186, 'empty, tight', 'xs b') + text(240, 186, 'first one on', 'xs b') + text(410, 186, 'full, relaxed', 'xs b');
  b += arrow('M124 106 H184', RED, 4) + text(154, 90, 'hard', 'xs b red');
  b += arrow('M294 106 H354', BLUE, 4) + text(324, 90, 'easy', 'xs b blue');
  b += arrow('M410 220 C410 262 300 270 240 270 C180 270 70 262 70 228', INK, 2.5, 'stroke-dasharray="6 5"');
  b += text(240, 300, 'letting go works the same way in reverse', 'xs');
  return b;
}
// The curve frame for the build steps, 330 tall.
const CURVE_H = 330;
function curvePicture(kind, t = 1) {
  const o = BASE;
  const opt = { yWord: kind === 'content' ? 'oxygen carried ↑' : 'seats filled ↑', lungs: false, tissues: false, given: false, half: false };
  if (kind === 'lungs') opt.lungs = true;
  if (kind === 'tissues' || kind === 'given') Object.assign(opt, { lungs: true, tissues: true, given: false });
  if (kind === 'half') opt.half = true;
  if (kind === 'content') Object.assign(opt, { lungs: true, labels: false });
  let b = DEFS;
  if (kind === 'curve') opt.reveal = Math.max(.02, ease(span(t, .02, .92)));
  if (kind === 'content') b += `<rect data-content data-part="content" x="${f(px(o.pa) - 11)}" y="${py(o.ca)}" width="22" height="${f(CH.y0 - py(o.ca))}" fill="${RED}" opacity=".8"/>`;
  if (kind === 'lungs') b += `<rect data-part="plateau" x="${px(o.pa * .72)}" y="${CH.top - 16}" width="${f(px(XMAX()) - px(o.pa * .72))}" height="${f(py(.8) - CH.top + 16)}" fill="${BLUE_FILL}" opacity=".7"/>`;
  if (kind === 'tissues') b += `<rect data-part="slope" x="${px(o.p50 * .55)}" y="${CH.top}" width="${f(px(o.pv * 1.2) - px(o.p50 * .55))}" height="${CH.y0 - CH.top}" fill="${BLUE_FILL}" opacity=".7"/>`;
  b += chart(o, opt);
  if (kind === 'curve') {
    // The curve draws itself from left to right; a molecule rides the tip, filling as it climbs.
    const P = XMAX() * opt.reveal, x = px(P), y = py(contentAt(o, P)), n = clamp(Math.round(4 * sat(P / o.p50) - .2), 0, 4);
    b += `<circle cx="${x}" cy="${y}" r="6" fill="${INK}"/>` + molecule(f(clamp(x - 18, CH.x0 + 4, CH.x1 - 40)), f(Math.max(y - 56, 34)), 36, filled(n));
    b += text(f(px(o.p50 * .45) + 6), CH.y0 - 12, 'slow start', 'xs b', 'start', fade(span(opt.reveal, .12, .22)));
    b += text(f(px(o.p50 * 1.1) + 26), f(py(.5) + 6), 'steep middle', 'xs b', 'start', fade(span(opt.reveal, .3, .42)));
    b += text(CH.x1, f(py(.86) + 30), 'flat top', 'xs b', 'end', fade(span(opt.reveal, .8, .95)));
  }
  if (kind === 'lungs') {
    const P2 = o.pa * .8;
    b += `<circle cx="${px(P2)}" cy="${py(contentAt(o, P2))}" r="7" fill="#fff" stroke="${RED}" stroke-width="2.5"/>`;
    b += arrow(`M${f(px(o.pa) - 14)} ${f(py(o.ca) + 58)} H${f(px(P2) + 4)}`, INK, 2.5);
    b += text(CH.x1, f(py(o.ca) + 84), 'less lung oxygen:', 'xs b', 'end') + text(CH.x1, f(py(o.ca) + 104), 'still nearly full', 'xs b', 'end');
    b += text(CH.x1, CH.top - 24, 'flat top', 'xs b blue', 'end');
  }
  if (kind === 'tissues') b += text(px(o.p50 * .55) + 6, CH.top + 20, 'steep slope', 'xs b blue', 'start');
  if (kind === 'given') {
    // Moving: one red cell's trip down the curve, from the lungs to the tissues, handing oxygen over.
    const u = ease(span(t, .1, .8)), P = o.pa + (o.pv - o.pa) * u, x = px(P), y = py(contentAt(o, P));
    b += givenArrow(o, true, u);
    b += `<ellipse cx="${x}" cy="${y}" rx="15" ry="10" fill="${CELL}" stroke="${RED}" stroke-width="2.5"/>`;
    const a = span(t, .82, .98), xb = f(px(o.pv) + 88);
    b += `<g data-part="reserve" ${fade(a)}><path d="M${f(xb - 6)} ${py(o.cv)} H${f(xb + 6)} M${xb} ${py(o.cv)} V${CH.y0} M${f(xb - 6)} ${CH.y0} H${f(xb + 6)}" stroke="${INK}" stroke-width="2"/>`;
    b += text(f(xb + 10), f((py(o.cv) + CH.y0) / 2), 'still on board:', 'xs b', 'start') + text(f(xb + 10), f((py(o.cv) + CH.y0) / 2 + 20), 'the reserve', 'xs b', 'start') + '</g>';
  }
  if (kind === 'half') {
    const x = px(o.p50), y = py(.5);
    b += arrow(`M${f(x + 16)} ${f(y + 40)} H${f(x + 84)}`, BLUE, 3.5) + text(f(x + 92), f(y + 46), 'right shift:', 'xs b blue', 'start') + text(f(x + 92), f(y + 66), 'lets go easily', 'xs b blue', 'start');
    b += arrow(`M${f(x - 16)} ${f(y - 34)} H${f(x - 56)}`, RED, 3.5) + text(CH.x0 + 10, f(y - 74), 'left shift:', 'xs b red', 'start') + text(CH.x0 + 10, f(y - 54), 'holds tighter', 'xs b red', 'start');
  }
  if (kind === 'content') {
    const x = px(o.pa);
    b += text(f(x - 20), f(py(o.ca) + 26), 'lungs', 'sm b red', 'end');
    b += text(f(x - 26), f(py(.42) + 6), 'oxygen content', 'xs b', 'end');
    b += arrow(`M${f(x - 22)} ${f(py(.42) + 14)} L${f(x - 13)} ${f(py(.42) + 14)}`, INK, 2);
    b += text(CH.x1, f(py(o.seats) - 30), 'the ceiling: set by', 'xs b', 'end') + text(CH.x1, f(py(o.seats) - 10), 'the amount of hemoglobin', 'xs b', 'end');
  }
  return b;
}

/* ---------- Words: comparisons and text alternatives ---------- */
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o) {
  return [
    ['Oxygen pressure leaving the lungs', trend(o.pa, BASE.pa, 'higher', 'lower')],
    ['Share of all seats holding oxygen, leaving the lungs', trend(o.sa, BASE.sa, 'higher', 'lower')],
    ['Half-saturation pressure', trend(o.p50, BASE.p50, 'higher: curve right', 'lower: curve left')],
    ['Oxygen content', trend(o.ca, BASE.ca, 'more', 'less')],
    ['Tissue oxygen pressure', trend(o.pv, BASE.pv, 'higher', 'lower')]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = o => `<ul class="readout" aria-label="Compared with normal"><li class="head">Compared with normal</li>${compare(o).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const CHANGE_WHERE = {
  right: 'The blue curve slides right of the dashed normal curve. At the normal tissue pressure, an arrow shows hemoglobin letting go of more oxygen, and the tissues dot sits at a higher pressure.',
  left: 'The blue curve slides left of the dashed normal curve. At the normal tissue pressure, an arrow shows hemoglobin holding on tighter, and the tissues dot moves to a lower pressure.',
  co: 'A grey band of seats taken by carbon monoxide lowers the ceiling to half, the blue curve drops and moves slightly left, and black squares fill seats in every molecule.',
  anemia: 'Three of the six molecules go missing. The ceiling and the blue curve drop, though the curve keeps its shape, and the tissues dot moves to a lower pressure.'
};
const LEGEND = { right: 'right shift', left: 'left shift', co: 'with carbon monoxide', anemia: 'anemia' };
const TITLE = { right: 'Right shift', left: 'Left shift', co: 'Carbon monoxide', anemia: 'Anemia' };
function change(kind) {
  return {
    duration: 2800,
    render(t) {
      const o = model(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease(t)));
      const label = `${TITLE[kind]}, drawn over a faint dashed picture of normal. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o)}.`;
      const grip = kind === 'right' || kind === 'left' ? kind : '';
      return { svg: pictureSvg(label, o, { ghost: BASE, legend: LEGEND[kind], grip, kind, a: span(t, .55, .9) }), readout: readout(o) };
    }
  };
}
const still = (label, body, h) => () => svg(label, body(), h);
const scenes = {
  trip: still('Lungs at the top and a block of body tissues at the bottom. A red arrow carries red blood cells, each holding oxygen, down from the lungs to the tissues; a grey arrow brings lighter, emptier cells back up to the lungs.', tripPicture, 396),
  cell: still('A red blood cell, a flattened disc, packed with small hemoglobin molecules. One is enlarged: a rounded block with four seats; two hold red oxygen, two are empty.', cellPicture, 320),
  pressure: still('Two boxes. On the left, an air sac in the lungs crowded with oxygen; its pressure bar is nearly full: high. On the right, working tissue with only a few oxygen dots; its pressure bar is short: low. An arrow points from high to low.', pressurePicture, 362),
  fill: { duration: 4200, render: t => svg('One hemoglobin molecule while the oxygen pressure around it rises from low to high. Its four seats fill one by one, and a saturation bar below fills from empty, through half, to full.', fillPicture(t), 356) },
  team: still('Three hemoglobin molecules. The first is empty and tight. A red arrow marked hard leads to the second, with one oxygen on and its shape starting to loosen. A blue arrow marked easy leads to the third, relaxed and full. A dashed arrow underneath notes that letting go works the same way in reverse.', teamPicture, 312),
  curve: { duration: 4600, render: t => svg('A graph with oxygen pressure across and seats filled upward. The blue curve draws itself from left to right in an S shape: a slow start at low pressure, a steep middle, and a flat top near all seats full. A small hemoglobin molecule rides the tip of the curve, filling as it climbs.', curvePicture('curve', t), CURVE_H) },
  lungs: still('The S-shaped curve with a red dot on its flat top, labelled lungs, where almost every seat is full. A highlighted band covers the flat top. A second dot, with less lung oxygen pressure, is still nearly as high: still nearly full.', () => curvePicture('lungs'), CURVE_H),
  tissues: still('The S-shaped curve with a red dot for the lungs on the flat top and a hollow red dot for the tissues, lower down on the steep slope, which is highlighted.', () => curvePicture('tissues'), CURVE_H),
  given: { duration: 3600, render: t => svg('The S-shaped curve. A red blood cell slides down the curve from the lungs dot high on the flat top to the tissues dot lower on the slope, and a red arrow grows between their heights: the oxygen unloaded. A bracket below the tissues dot then marks the oxygen still on board: the reserve.', curvePicture('given', t), CURVE_H) },
  half: still('The S-shaped curve with a black dot where it is half full, and dashed lines from it down to the oxygen pressure axis: the half-saturation pressure. A blue arrow to the right reads right shift: lets go easily. A red arrow to the left reads left shift: holds tighter.', () => curvePicture('half'), CURVE_H),
  content: still('The curve redrawn with oxygen carried upward. The dotted ceiling, all seats full, is labelled as set by the amount of hemoglobin. A red column under the lungs dot shows the oxygen content: how much oxygen the blood carries.', () => curvePicture('content'), CURVE_H),
  whole: () => pictureSvg('The whole picture. The S-shaped curve with the lungs dot on the flat top, the tissues dot on the steep slope, a red arrow for the oxygen unloaded between them, and the half-full point marking the half-saturation pressure. Below, six hemoglobin molecules leaving the lungs are almost all full; leaving the tissues, about a quarter of the seats are empty.', BASE),
  right: change('right'),
  left: change('left'),
  co: change('co'),
  anemia: change('anemia'),
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['lung', 'shift', 'hb', 'co', 'demand'];
const CLINICAL_SLIDERS = ['shift', 'hb', 'co', 'demand'];
const STATE_PARAMS = { right: CHANGES.right, left: CHANGES.left, co: CHANGES.co, anemia: CHANGES.anemia, exercise: { demand: 3, shift: 1.2 } };
const level = (k, v) => k === 'lung' ? (v < .6 ? 'much less' : v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : k === 'shift' ? (v < .78 ? 'far left' : v < .97 ? 'left' : v > 1.3 ? 'far right' : v > 1.03 ? 'right' : 'normal')
  : k === 'hb' ? (v < .6 ? 'much less' : v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : k === 'co' ? (v < .02 ? 'none' : v < .2 ? 'a little' : v < .4 ? 'a lot' : 'very much')
  : (v < .95 ? 'resting, light' : v <= 1.05 ? 'at rest' : v < 2 ? 'busier' : 'hard exercise');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  for (const k of CLINICAL_SLIDERS) { $(`#clinical-${k}`).value = params[k]; $(`#clinical-${k}-label`).textContent = level(k, params[k]); }
}
const valueOf = id => data.values.find(v => v.id === id);
const reference = id => { const v = valueOf(id); return v.typical ?? (v.low + v.high) / 2; };
// Model results in the textbook's units: pressures are already in mmHg once the curve is fitted to the data file.
function measures(o) {
  const perFull = reference('hb') * reference('o2PerGram');
  return {
    pao2: o.pa, sao2: 100 * o.sa, pvo2: o.pv, svo2: 100 * o.sv, p50: o.p50,
    hb: reference('hb') * o.p.hb, cao2: perFull * o.ca, cvo2: perFull * o.cv, utilization: 100 * o.util
  };
}
const DECIMALS = { p50: 1, cao2: 1, cvo2: 1, o2PerGram: 2 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
function domain(v) {
  const [lo, hi] = v.scale;
  return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
}
function statusFor(v, shown) {
  if (v.low !== null && v.high !== null) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
function update() {
  if (!BASE) return;
  syncControls();
  const o = model(params);
  const label = `Illustrative model with these settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.${o.short ? ' The tissues cannot get all the oxygen they need.' : ''}`;
  $('#explore-visual').innerHTML = pictureSvg(label, o, { ghost: BASE, legend: 'these settings' }) + readout(o);
  $('#clinical-visual').innerHTML = svg(label, DEFS + `<g data-new-state="these settings" ${attrs(o)}>${chart(o, { ghost: BASE })}</g>`, CURVE_H);
  const shortNote = o.short ? ' Tissues short of oxygen: they would need more than the blood carries.' : '';
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: half-saturation pressure ×${(o.p50 / BASE.p50).toFixed(2)} · oxygen content ×${(o.ca / BASE.ca).toFixed(2)} · tissue oxygen pressure ×${(o.pv / BASE.pv).toFixed(2)}.${shortNote}`;
    return;
  }
  const m = measures(o), u = id => valueOf(id).unit;
  const functional = (s1, id) => o.p.co > .005 ? ` (functional saturation, of seats free for oxygen: ${fmt(id, 100 * s1)}${u(id)})` : '';
  $('#model-results').textContent = `Illustrative model: arterial oxygen pressure ${fmt('pao2', m.pao2)} ${u('pao2')}, fractional saturation ${fmt('sao2', m.sao2)}${u('sao2')}${functional(o.sa1, 'sao2')} · P50, on the functional curve, ${fmt('p50', m.p50)} ${u('p50')} · arterial oxygen content ${fmt('cao2', m.cao2)} ${u('cao2')} · venous oxygen pressure ${fmt('pvo2', m.pvo2)} ${u('pvo2')}, fractional saturation ${fmt('svo2', m.svo2)}${u('svo2')}${functional(o.sv1, 'svo2')} · tissues take ${fmt('utilization', m.utilization)}${u('utilization')} of the arterial oxygen.${shortNote}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = state?.shifts[v.id];
    const dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = Number(val.toFixed(DECIMALS[v.id] ?? 0));
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
for (const k of CLINICAL_SLIDERS) $(`#clinical-${k}`).addEventListener('input', e => {
  params[k] = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  update(); announce();
});
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(STATE_PARAMS[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(model(params)), u = id => valueOf(id).unit;
    $('#cv-live').textContent = `Model P50 ${fmt('p50', m.p50)} ${u('p50')}, arterial oxygen content ${fmt('cao2', m.cao2)} ${u('cao2')}, venous oxygen pressure ${fmt('pvo2', m.pvo2)} ${u('pvo2')}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
// Fit the Hill curve through two (pressure, saturation %) points.
function fit(p1, s1, p2, s2) {
  const L = s => Math.log(s / (100 - s));
  const n = (L(s1) - L(s2)) / (Math.log(p1) - Math.log(p2));
  return { n, p50: Math.exp(Math.log(p1) - L(s1) / n) };
}
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['pao2', 'sao2', 'pvo2', 'svo2', 'hb', 'o2PerGram', 'utilization']) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && Array.isArray(v.scale) && Number.isFinite(v.typical) && v.typical > 0)) throw new Error('Invalid reference data');
    }
    data = loaded;
    const { n, p50 } = fit(reference('pao2'), reference('sao2'), reference('pvo2'), reference('svo2'));
    if (!(n > 1 && n < 6 && p50 > 0)) throw new Error('Reference points do not make an S-shaped curve');
    K = { n, p50, pa: reference('pao2'), use: 0 };
    K.use = sat(K.pa / K.p50) * reference('utilization') / 100;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = `How the numbers are made: the teaching curve is drawn through Guyton’s arterial and venous points, and the tissues’ resting oxygen use comes from the utilization coefficient. Because the textbook values come from different chapters and books, they do not all sit on one curve: the model’s P50 lands at ${fmt('p50', K.p50)} ${valueOf('p50').unit}, a little above Costanzo’s typical value, and its venous oxygen pressure and saturation sit just below Guyton’s. The sizes of the disease and state changes are illustrative; only their directions are meant to teach.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}</svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the textbook range as a shaded band' : 'the textbook typical value as a tick'}${v.modelKey ? ', and a marker for the current illustrative model' : ''}`);
      const [lo, hi] = v.scale;
      right.querySelector('.key').textContent = `${range ? `Textbook range ${fmt(v.id, v.low)} to ${fmt(v.id, v.high)} ${v.unit} (shaded)` : `Textbook typical value ${fmt(v.id, v.typical)} ${v.unit} (tick; no range given)`} · bar runs ${fmt(v.id, lo)} to ${fmt(v.id, hi)}${v.modelKey ? ' · blue line: model' : ''}`;
      if (!v.modelKey) {
        left.querySelector('.reading').textContent = `${fmt(v.id, v.typical)} ${v.unit}`;
        left.querySelector('.status').textContent = 'Reference only: a fixed property the model uses';
      }
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    K = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative curve.';
  }
  if (!K) K = { ...FALLBACK };
  BASE = model(NORMAL);
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
