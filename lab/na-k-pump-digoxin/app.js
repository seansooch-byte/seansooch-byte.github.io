// Lesson 26: The Na+/K+ pump and digoxin. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: sodium is the amber circle, potassium the green triangle, calcium the teal
//     rounded square; the pump is the sage membrane protein, the exchanger the lilac one; digoxin is the
//     drug-purple plug. Kit blue is only ever a change (an arrow, or the words that name it) or the
//     highlighted site.
//   - The membrane pictures (steps 2 to 7, 10, 11) show outside the cell above and inside below a bilayer.
//   - The change pictures (steps 12 to 14, both reference tabs) are drawn from model.js: six pumps, of which
//     the model's share are jammed by digoxin, and four bars (pumps working, sodium inside, calcium in the
//     store, squeeze) over dashed marks for the state before. Step 15 draws the model's afterdepolarization
//     on a voltage trace over a dashed normal trace.
//   - No reference number lives in this file. The baseline potassium, sodium, resting potential and the
//     low and high potassium come from clinical-values.json, and nowhere else; if it cannot load, the
//     model's pictures and both tabs say so instead of drawing.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, mix, artGhost, arrowFixed, leader } from '/lab/kit/art/core.js';
import { cellBody, bilayer, channel, transporter } from '/lab/kit/art/cell.js';
import { ion } from '/lab/kit/art/molecules.js';
import { axes, curve } from '/lab/kit/art/chart.js';
import { DIGOXIN, anchorsFrom, solve } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink;

/* ---------- Glyphs (each drawn once at the origin, then moved with translate) ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
const NA = ion('na').svg;
const K = ion('k', { s: 0.82 }).svg;
const CA = ion('ca', { s: 0.85 }).svg;

/* ---------- Small helpers ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Points spread evenly at random over a w x h box: each new point keeps a minimum distance from the others.
function scatter(seed, n, w, h, minD) {
  const r = rng(seed), pts = [];
  for (let tries = 0; pts.length < n && tries < n * 400; tries++) {
    const p = { x: r() * w, y: r() * h };
    if (pts.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD * minD)) pts.push(p);
  }
  return pts;
}
const inBox = (x, y, [bx, by, bw, bh], pad = 0) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;
const rrect = (x, y, w, h, r) => roundBox(x, y, w, h, r, r);
// A box with its own corner radius on top and on the bottom (0: square corners where it meets the membrane).
function roundBox(x, y, w, h, rt, rb) {
  const arc = (r, ex, ey) => r ? ` A${r} ${r} 0 0 1 ${f(ex)} ${f(ey)}` : '';
  return `M${f(x + rt)} ${f(y)} H${f(x + w - rt)}${arc(rt, x + w, y + rt)} V${f(y + h - rb)}${arc(rb, x + w - rb, y + h)} H${f(x + rb)}${arc(rb, x, y + h - rb)} V${f(y + rt)}${arc(rt, x + rt, y)} Z`;
}
const ECF_LINE = mix(P.space.ecf, INK, 0.35);
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const arrowC = (a, b, col, w = 4, op = 1) => arrowFixed(a, b, { col, w, head: { l: 12, w: 7 }, attrs: op < 1 ? ` opacity="${f(op)}"` : '' });
const arrowB = (a, b, w = 3) => arrowFixed(a, b, { col: BLUE, w, head: { l: 10, w: 6 } });

// Ions scattered over a region, clear of keep-out boxes and of each other. The pool is fixed per seed, so a
// moving picture keeps its ions in place from frame to frame.
const POOLS = new Map();
function ions(glyph, n, [rx, ry, rw, rh], seed, keep = [], placed = [], minD = 22) {
  const key = `${seed}|${rx}|${ry}|${rw}|${rh}`;
  if (!POOLS.has(key)) POOLS.set(key, scatter(seed, 90, rw, rh, minD).map(p => ({ x: rx + p.x, y: ry + p.y })));
  let s = '', got = 0;
  for (const p of POOLS.get(key)) {
    if (got >= n) break;
    if (keep.some(k => inBox(p.x, p.y, k, 9)) || placed.some(q => Math.hypot(q.x - p.x, q.y - p.y) < minD)) continue;
    s += at(glyph, p.x, p.y); placed.push(p); got++;
  }
  return s;
}

/* ---------- A stretch of membrane: outside above, inside below (steps 2 to 7, 10, 11) ---------- */
// proteins: [{ x, half, up, down }] (what the ions and the lipids keep clear of); counts of each ion per side.
function membrane({ top = 48, my = 200, bot = 352, proteins = [], naOut = 0, naIn = 0, kOut = 0, kIn = 0, caIn = 0, keep = [] } = {}) {
  let b = `<path d="${roundBox(16, top, 448, my - top, 14, 0)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="ecf"/>`;
  b += `<path d="${roundBox(16, my, 448, bot - my, 0, 14)}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="1.25" data-part="cell"/>`;
  b += bilayer({ x1: 16, y1: my, x2: 464, y2: my, clear: proteins.map(p => [p.x - 16, p.half]) }).svg;
  const k = [...keep, ...proteins.map(p => [p.x - p.half - 6, my - p.up - 4, 2 * p.half + 12, p.up + p.down + 8])];
  const out = [28, top + 14, 424, my - top - 38], inn = [28, my + 24, 424, bot - my - 36];
  const pOut = [], pIn = [];
  b += ions(NA, naOut, out, 11, k, pOut) + ions(K, kOut, out, 12, k, pOut);
  b += ions(K, kIn, inn, 13, k, pIn) + ions(NA, naIn, inn, 14, k, pIn) + ions(CA, caIn, inn, 15, k, pIn);
  return b;
}
// Protein footprints at scale s (from the art library's native boxes).
const PUMP = s => ({ half: 25 * s, up: 44 * s, down: 50 * s });
const EXCH = s => ({ half: 29 * s, up: 38 * s, down: 38 * s });
const CHAN = s => ({ half: 23 * s, up: 28 * s, down: 30 * s });
const pumpArt = (x, y, s, phase, extra = {}) => transporter({ kind: 'pump', x, y, s, phase, beta: true, atp: true, arrows: false, ...extra });
const exchangerArt = (x, y, s, phase, extra = {}) => transporter({ kind: 'antiporter', x, y, s, phase, mat: 'protein2', cargo: [{ key: 'na', n: 3, dir: 'in' }, { key: 'ca', dir: 'out' }], parts: { carrier: 'exchanger' }, ...extra });
const rows = (top, bottom, topRight = '', bottomRight = '') => text(16, 32, 'outside the cell', 'sm b', 'start') + topRight + text(16, bottom, 'inside the cell', 'sm b', 'start') + bottomRight;

/* ---------- Step 1: a heart muscle cell ---------- */
function cellStill() {
  let b = `<path d="${rrect(16, 44, 448, 270, 14)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="ecf"/>`;
  b += cellBody({ shape: 'cuboidal', w: 300, h: 150, x: 240, y: 178, membrane: 'band' }).svg;
  b += text(32, 74, 'fluid outside the cell', 'sm b', 'start');
  b += text(448, 74, 'cell membrane', 'sm b', 'end') + leader([388, 82], [366, 103]);
  b += text(32, 300, 'inside the cell', 'sm b', 'start') + leader([166, 294], [196, 236]);
  return b;
}

/* ---------- Step 2: sodium outside, potassium inside ---------- */
function ionsStill() {
  let b = membrane({ naOut: 16, naIn: 3, kOut: 3, kIn: 16 });
  b += rows(32, 378, text(464, 32, 'sodium crowded here', 'sm b amber', 'end'), text(464, 378, 'potassium crowded here', 'sm b green', 'end'));
  return b;
}

/* ---------- Step 3: leaks down the gradients ---------- */
const MY = 200;
function leakPicture(t) {
  const sNa = 1.3, xNa = 150, xK = 330;
  const keep = [[186, MY - 92, 22, 184], [356, MY - 92, 22, 184]];
  let b = membrane({ naOut: 14, naIn: 3, kOut: 3, kIn: 14, keep, proteins: [{ x: xNa, ...CHAN(sNa) }, { x: xK, ...CHAN(sNa) }] });
  b += channel({ kind: 'generic', open: 1, ion: 'na', phase: (t * 2) % 1, x: xNa, y: MY, s: sNa }).svg;
  b += channel({ kind: 'kir', open: 1, ion: 'k', phase: (t * 2 + 0.5) % 1, x: xK, y: MY, s: sNa }).svg;
  b += `<g data-part="gradient">${arrowC([196, MY - 84], [196, MY + 84], P.ui.amber)}${arrowC([366, MY + 84], [366, MY - 84], P.ui.green)}</g>`;
  b += rows(32, 378, text(464, 32, 'potassium leaks out', 'sm b green', 'end'), text(464, 378, 'sodium leaks in', 'sm b amber', 'end'));
  return b;
}

/* ---------- Steps 4 and 5: the pump ---------- */
const PS = 1.6;
function pumpPicture(phase, moving) {
  const keep = moving ? [[16, MY - 100, 150, 22], [312, MY + 84, 152, 22], [128, MY - 76, 24, 152], [308, MY - 76, 24, 152]] : [[250, 66, 214, 26], [290, 92, 30, 74], [300, 300, 164, 26], [280, 270, 80, 40]];
  let b = membrane({ naOut: 10, naIn: 2, kOut: 2, kIn: 10, keep, proteins: [{ x: 240, ...PUMP(PS) }] });
  const pump = pumpArt(240, MY, PS, phase);
  b += pump.svg;
  if (!moving) {
    b += text(456, 84, 'sodium-potassium pump', 'sm b', 'end') + leader([304, 92], [262, MY - 18]);
    const [ax, ay] = pump.at.atp;
    b += text(456, 318, 'ATP, its fuel', 'sm b', 'end') + leader([352, 312], [ax, ay]);
  } else {
    // sodium crosses outward in the first half of the cycle, potassium inward in the second
    const naOn = phase >= 0.5 ? 1 : 0.3, kOn = phase < 0.5 ? 1 : 0.3;
    b += arrowC([140, MY + 70], [140, MY - 70], P.ui.amber, 4, naOn) + `<g ${fade(0.35 + 0.65 * naOn)}>${text(16, MY - 84, '3 sodium out', 'sm b amber', 'start')}</g>`;
    b += arrowC([320, MY - 70], [320, MY + 70], P.ui.green, 4, kOn) + `<g ${fade(0.35 + 0.65 * kOn)}>${text(464, MY + 100, '2 potassium in', 'sm b green', 'end')}</g>`;
  }
  b += rows(32, 378);
  return b;
}

/* ---------- Step 6: pump and leaks together ---------- */
function balancePicture(t) {
  const my = 186, s = 1.3, proteins = [{ x: 92, ...CHAN(s) }, { x: 240, ...PUMP(s) }, { x: 388, ...CHAN(s) }];
  let b = membrane({ my, bot: 300, naOut: 12, naIn: 2, kOut: 2, kIn: 9, proteins, keep: [[16, 270, 150, 26]] });
  b += channel({ kind: 'generic', open: 1, ion: 'na', phase: (t * 2) % 1, x: 92, y: my, s }).svg;
  b += pumpArt(240, my, s, (t * 2 + 0.5) % 1).svg;
  b += channel({ kind: 'kir', open: 1, ion: 'k', phase: (t * 2 + 0.25) % 1, x: 388, y: my, s }).svg;
  b += text(16, 32, 'outside the cell', 'sm b', 'start') + text(464, 32, 'leak in = pumped out', 'sm b', 'end');
  b += text(24, 290, 'inside the cell', 'sm b', 'start');
  const bar = (y, k, col, line) => `<rect x="16" y="${y}" width="448" height="12" rx="6" fill="${P.ui.panel}" stroke="${P.ui.rule}" stroke-width="1.25"/><rect x="16" y="${y}" width="${f(448 * k)}" height="12" rx="6" fill="${col}" stroke="${line}" stroke-width="1.25"/>`;
  b += `<g data-part="steady">${text(16, 334, 'sodium inside: low, and holding steady', 'xs b amber', 'start')}${bar(342, 0.1, P.na.base, P.na.line)}`
    + `${text(16, 384, 'potassium inside: high, and holding steady', 'xs b green', 'start')}${bar(392, 0.9, P.k.base, P.k.line)}</g>`;
  return b;
}

/* ---------- Step 7: the sodium-calcium exchanger ---------- */
function exchangerPicture(t) {
  const s = 1.6, keep = [[40, MY - 100, 140, 22], [300, MY - 100, 164, 22], [222, MY + 84, 242, 22], [128, MY - 76, 24, 152], [328, MY - 76, 24, 152]];
  let b = membrane({ naOut: 12, naIn: 2, kIn: 5, caIn: 3, keep, proteins: [{ x: 240, ...EXCH(s) }] });
  b += exchangerArt(240, MY, s, t).svg;
  const naOn = t < 0.5 ? 1 : 0.3, caOn = t >= 0.5 ? 1 : 0.3;
  b += arrowC([140, MY - 70], [140, MY + 70], P.ui.amber, 4, naOn) + `<g ${fade(0.35 + 0.65 * naOn)}>${text(176, MY - 84, '3 sodium in', 'sm b amber', 'end')}</g>`;
  b += arrowC([340, MY + 70], [340, MY - 70], P.ui.teal, 4, caOn) + `<g ${fade(0.35 + 0.65 * caOn)}>${text(306, MY - 84, '1 calcium out', 'sm b teal', 'start')}</g>`;
  b += text(464, MY + 100, 'sodium-calcium exchanger', 'sm b', 'end') + leader([392, MY + 92], [262, MY + 22]);
  b += rows(32, 378);
  return b;
}

/* ---------- Step 8: calcium makes the cell squeeze ---------- */
const STORE = { x: 40, y: 128, w: 270, h: 44 };
const STORE_CA = Array.from({ length: 7 }, (_, i) => [STORE.x + 26 + i * 36, STORE.y + STORE.h / 2]);
const storeArt = (extra = '') => `<g data-part="store"${extra}><path d="${rrect(STORE.x, STORE.y, STORE.w, STORE.h, 22)}" fill="${P.er.base}" stroke="${P.er.line}" stroke-width="1.75"/><path d="${rrect(STORE.x + 6, STORE.y + 6, STORE.w - 12, STORE.h - 12, 16)}" fill="${mix(P.er.base, P.ui.white, 0.45)}"/></g>`;
// A sarcomere: Z discs at each end, thin filaments from them, thick filaments in the middle. k: 0 relaxed, 1 squeezed.
function sarcomere(cx, cy, k) {
  const half = lerp(140, 112, k), thinL = 104, thick = 76;
  let s = '';
  for (const sx of [-1, 1]) {
    const zx = cx + sx * half;
    s += `<path d="M${f(zx)} ${cy - 40} l${sx * 5} 10 l${-sx * 10} 10 l${sx * 10} 10 l${-sx * 10} 10 l${sx * 10} 10 l${-sx * 10} 10 l${sx * 10} 10 l${-sx * 5} 10" fill="none" stroke="${P.valve.line}" stroke-width="2.4" stroke-linejoin="round"/>`;
    for (const yy of [-30, -15, 0, 15, 30]) s += `<path d="M${f(zx)} ${cy + yy} H${f(zx - sx * thinL)}" stroke="${P.myo.lo}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  for (const yy of [-22.5, -7.5, 7.5, 22.5]) {
    s += `<path d="M${cx - thick} ${cy + yy} H${cx + thick}" stroke="${P.myo.line}" stroke-width="5" stroke-linecap="round"/>`;
    s += `<path d="${Array.from({ length: 8 }, (_, i) => { const x = cx - thick + 8 + i * 20 + (i >= 4 ? 4 : 0); return `M${x} ${cy + yy - 2} l${i < 4 ? -4 : 4} -4 M${x} ${cy + yy + 2} l${i < 4 ? -4 : 4} 4`; }).join(' ')}" stroke="${P.myo.line}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  return `<g data-part="filaments">${s}</g>`;
}
function squeezePicture(t) {
  const out = ease.inOut(span(t, 0.04, 0.24)), back = ease.inOut(span(t, 0.55, 0.85));
  const k = ease.inOut(span(t, 0.12, 0.3)) * (1 - ease.inOut(span(t, 0.58, 0.85)));
  const cx = 220, cy = 280;
  let b = `<path d="${roundBox(16, 40, 448, 40, 14, 0)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="ecf"/>`;
  b += `<path d="${roundBox(16, 80, 448, 290, 0, 14)}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="1.25" data-part="cell"/>`;
  b += bilayer({ x1: 16, y1: 80, x2: 464, y2: 80, clear: [[420 - 16, 25]] }).svg;
  b += exchangerArt(420, 80, 1, (t * 2) % 1, { arrows: false }).svg;
  b += storeArt();
  b += sarcomere(cx, cy, k);
  // calcium: out of the store to the filaments, then back; the last one leaves through the exchanger
  const dest = i => [cx - 90 + i * 30, cy + (i % 2 ? -46 : 46)];
  let ca = '';
  STORE_CA.forEach(([sx, sy], i) => {
    const [dx, dy] = dest(i), last = i === STORE_CA.length - 1;
    let x = lerp(sx, dx, out), y = lerp(sy, dy, out);
    if (last) { const e = ease.inOut(span(t, 0.55, 0.8)); x = lerp(x, 410, e); y = lerp(y, 104, e); const e2 = ease.inOut(span(t, 0.8, 0.95)); y = lerp(y, 60, e2); x = lerp(x, 430, e2); }
    else { x = lerp(x, sx, back); y = lerp(y, sy, back); }
    const op = last ? 1 - span(t, 0.95, 1) : 1;
    ca += at(CA, x, y, op < 1 ? ` opacity="${f(op)}"` : '');
  });
  b += `<g data-part="calcium">${ca}</g>`;
  b += text(324, 156, 'calcium store', 'sm b', 'start');
  b += text(40, 204, 'the sarcoplasmic reticulum', 'xs muted', 'start');
  b += text(cx, 354, 'contractile filaments', 'sm b');
  b += text(384, 112, 'exchanger', 'xs b', 'end');
  b += `<g ${fade(k * 1.4)}>${arrowC([cx - 172, cy], [cx - 146, cy], INK, 3)}${arrowC([cx + 172, cy], [cx + 146, cy], INK, 3)}${text(456, cy + 34, 'shortens', 'xs b', 'end')}</g>`;
  return b;
}

/* ---------- Steps 9 and 15: a voltage trace ---------- */
const TR = { x0: 56, x1: 372, lab: 382 };
const AP_L = s => 0.03 + s + 0.07;
// The voltage s after an upstroke, from a start level, with a plateau of length pl; null after it ends. The
// peak, notch and plateau-end voltages are the model's illustrative parameters (clinical-values.json).
function apShape(s, from, rest, pl = 0.19) {
  const { peak, notch, plateauEnd } = anchors.ap;
  if (s < 0.008) return lerp(from, peak, s / 0.008);
  if (s < 0.03) return lerp(peak, notch, (s - 0.008) / 0.022);
  if (s < 0.03 + pl) return lerp(notch, plateauEnd, (s - 0.03) / pl);
  if (s < AP_L(pl)) { const k = (s - 0.03 - pl) / 0.07; return plateauEnd + (rest - plateauEnd) * (0.5 - 0.5 * Math.cos(Math.PI * k)); }
  return null;
}
const BUMP_AT = 0.36, BUMP_W = 0.055, TRIG_AT = 0.32;
// One beat at u = b; after it, the afterdepolarization (dad, mV) and, when triggered, an extra beat.
function voltage(u, { rest, dad = 0, triggered = false, threshold }, beats) {
  const b = [...beats].reverse().find(x => u >= x);
  if (b == null) return rest;
  const s = u - b, v = apShape(s, rest, rest);
  if (v != null) return v;
  if (!triggered) return rest + dad * Math.exp(-(((s - BUMP_AT) / BUMP_W) ** 2));
  if (s < TRIG_AT) { const k = clamp((s - AP_L(0.19)) / (TRIG_AT - AP_L(0.19)), 0, 1); return rest + (threshold - rest) * k * k; }
  const v2 = apShape(s - TRIG_AT, threshold, rest, 0.1);
  return v2 ?? rest;
}
function traceChart({ top, y0, live, ghost = null, beats, dot = null, parts = true }) {
  const { low, high } = anchors.trace;
  const vy = v => y0 - 12 - (v - low) / (high - low) * (y0 - 12 - (top + 24));
  const ux = u => TR.x0 + u * (TR.x1 - TR.x0);
  const pts = st => Array.from({ length: 241 }, (_, i) => { const u = i / 240; return [ux(u), vy(voltage(u, st, beats))]; });
  let b = axes({ x0: TR.x0 - 6, y0, x1: TR.x1 + 4, y1: top, xLabel: 'time', cls: 'xs b' });
  const yRest = vy(live.rest), yTh = vy(live.threshold);
  const ln = (y, part) => `<path d="M${TR.x0} ${f(y)} H${TR.x1}" stroke="${P.ui.muted}" stroke-width="1.5" stroke-dasharray="3 4"${parts ? ` data-part="${part}"` : ''}/>`;
  b += ln(yTh, 'threshold') + ln(yRest, 'rest');
  if (ghost) b += curve(pts(ghost), { role: 'ghost', extra: 'data-ghost="normal"' });
  b += `<g${parts ? ' data-part="ap"' : ''}>${curve(pts(live), { role: 'live', col: INK })}</g>`;
  b += `<g${parts ? ' data-part="threshold"' : ''}>${text(TR.lab, yTh + 6, 'threshold', 'xs b', 'start')}</g>`;
  b += `<g${parts ? ' data-part="rest"' : ''}>${text(TR.lab, yRest + 8, 'rest', 'xs b', 'start')}</g>`;
  if (dot != null) { const v = voltage(dot, live, beats); b += `<circle cx="${f(ux(dot))}" cy="${f(vy(v))}" r="6" fill="${BLUE}" stroke="${P.ui.white}" stroke-width="2"/>`; }
  return { svg: b, vy, ux };
}
function beatPicture(t) {
  const st = { rest: anchors.vRest, threshold: anchors.threshold };
  const c = traceChart({ top: 40, y0: 300, live: st, beats: [0.06, 0.56], dot: t });
  return c.svg + text(c.ux(0.06) + 12, c.vy(anchors.ap.peak) - 14, 'action potential', 'sm b', 'start');
}

/* ---------- Step 10: the chain ---------- */
function chainStill() {
  const my = 170, s = 1.3, keep = [[200, 70, 250, 26], [400, 60, 24, 100], [300, 280, 150, 30]];
  let b = membrane({ my, bot: 344, naOut: 12, naIn: 2, kIn: 6, caIn: 2, keep: [...keep, [STORE.x - 6, 262, STORE.w - 40, 56]], proteins: [{ x: 130, ...PUMP(s) }, { x: 330, ...EXCH(s) }] });
  b += pumpArt(130, my, s, 0.75).svg + exchangerArt(330, my, s, 0.25).svg;
  b += `<g transform="translate(0 140)">${storeArt()}</g>`;
  b += `<g data-part="gradient">${arrowC([412, 66], [412, my - 8], P.ui.amber, 5)}${text(402, 88, 'steep sodium gradient', 'xs b amber', 'end')}</g>`;
  b += text(320, 296, 'a normal store', 'xs b', 'start');
  b += text(16, 32, '1  the pump carries sodium out', 'sm b', 'start');
  b += text(16, 374, '2  sodium flowing in pushes calcium out', 'sm b', 'start');
  return b;
}

/* ---------- Step 11: digoxin in its pocket on the pump's outer face ---------- */
function digoxinStill() {
  const keep = [[60, 92, 100, 22], [330, 82, 134, 22], [150, 96, 90, 72], [262, 92, 100, 74], [350, 124, 90, 56]];
  let b = membrane({ naOut: 5, naIn: 2, kIn: 9, keep, proteins: [{ x: 240, ...PUMP(PS) }] });
  b += pumpArt(240, MY, PS, 0, { blocked: 1 }).svg;
  b += `<ellipse data-part="site" cx="240" cy="${MY - 32}" rx="24" ry="17" fill="none" stroke="${BLUE}" stroke-width="2.2" stroke-dasharray="4 3"/>`;
  b += [[392, 138], [424, 162], [366, 166]].map(([x, y]) => at(K, x, y)).join('');
  b += text(150, 108, 'digoxin', 'sm b purple', 'end') + leader([156, 102], [232, MY - 34]);
  b += text(464, 98, 'digoxin pocket', 'sm b', 'end') + leader([328, 92], [264, MY - 34]);
  b += text(16, 32, 'outside the cell', 'sm b', 'start') + text(464, 32, 'potassium loosens its grip', 'xs b green', 'end');
  b += text(16, 378, 'inside the cell', 'sm b', 'start');
  return b;
}

/* ---------- The model's picture: six pumps and four bars (steps 12 to 14, Explore, Clinical values) ---------- */
const PX = [52, 124, 196, 268, 340, 412], JAM_ORDER = [1, 4, 2, 5, 0, 3], DS = 0.85, DMY = 128;
const K_SPOTS = [40, 232, 424, 136, 328, 88, 184, 280, 376];
const NA_SPOTS = [[96, 150], [312, 176], [168, 176], [384, 150], [240, 150], [96, 180], [312, 150], [168, 150], [384, 180], [240, 180], [24, 156]];
const BARS = [
  { key: 'pump', label: 'pumps working', max: 1.2, mat: P.protein, fmt: v => `${Math.round(v * 100)}% of normal` },
  { key: 'naIn', label: 'sodium inside the cell', max: 2.4, mat: P.na, fmt: v => `${v.toFixed(2)} × normal` },
  { key: 'store', label: 'calcium in the store', max: 3.6, mat: P.ca, fmt: v => `${v.toFixed(2)} × normal` },
  { key: 'squeeze', label: 'strength of each squeeze', max: 2.0, mat: P.myo, fmt: v => `${v.toFixed(2)} × normal` },
];
// m: the model now; g: the dashed "before"; jam: pumps jammed (0 to 6, may be fractional mid-change).
function dashboard(m, g, { jam = Math.round(m.jammed * 6), phase = 0, words = [], wordsOp = 1 } = {}) {
  let b = `<path d="${roundBox(16, 60, 448, DMY - 60, 14, 0)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="ecf"/>`;
  b += `<path d="${roundBox(16, DMY, 448, 66, 0, 14)}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="1.25" data-part="cell"/>`;
  b += bilayer({ x1: 16, y1: DMY, x2: 464, y2: DMY, clear: PX.map(x => [x - 16, 22]) }).svg;
  const nK = clamp(Math.round(5 * m.kOut / anchors.kOut), 1, K_SPOTS.length);
  b += K_SPOTS.slice(0, nK).map(x => at(K, x, 76)).join('');
  const nNa = clamp(Math.round(3 * m.naIn), 0, NA_SPOTS.length);
  b += NA_SPOTS.slice(0, nNa).map(([x, y]) => at(NA, x, y)).join('');
  PX.forEach((x, i) => {
    const k = clamp(jam - JAM_ORDER.indexOf(i), 0, 1);
    b += pumpArt(x, DMY, DS, k > 0 ? 0 : (phase * 2 + i * 0.17) % 1, k > 0 ? { blocked: k } : {}).svg;
  });
  const shown = Math.round(jam);
  b += text(240, 218, shown ? `${shown} of 6 pumps jammed by digoxin` : 'no pumps jammed: all 6 working', `sm b${shown ? ' purple' : ''}`);
  BARS.forEach((r, i) => {
    const y = 250 + i * 44, v = m[r.key], gv = g[r.key], X = v2 => 16 + clamp(v2 / r.max, 0, 1) * 448;
    b += text(16, y, r.label, 'xs b', 'start') + text(464, y, r.fmt(v), 'xs', 'end');
    b += `<rect x="16" y="${y + 8}" width="448" height="14" rx="7" fill="${P.ui.panel}" stroke="${P.ui.rule}" stroke-width="1.25"/>`;
    b += `<rect x="16" y="${y + 8}" width="${f(X(v) - 16)}" height="14" rx="7" fill="${r.mat.base}" stroke="${r.mat.line}" stroke-width="1.25"/>`;
    b += `<g data-ghost="normal">${artGhost(`M${f(X(gv))} ${y + 3} V${y + 27}`)}</g>`;
    if (Math.abs(X(v) - X(gv)) > 10) b += arrowB([X(gv), y + 15], [X(v), y + 15], 3);
  });
  words.forEach(([w, cls], i) => { b += `<g ${fade(wordsOp)}>${text(16, 22 + i * 22, w, cls, 'start')}</g>`; });
  return b;
}
const DASH_H = 402;
function compareRows(m, g) {
  const dir = (v, w, tol = 0.01) => v > w + tol ? 'up' : v < w - tol ? 'down' : 'same';
  const say = (v, w, up, down, same = 'no change') => { const d = dir(v, w); return [d, d === 'up' ? up : d === 'down' ? down : same]; };
  const after = x => x.triggered ? 2 : x.dad > 0.5 ? 1 : 0;
  const a = after(m), b = after(g);
  return [
    ['Pumps jammed', ...say(m.jammed, g.jammed, 'more', 'fewer')],
    ['Sodium inside', ...say(m.naIn, g.naIn, 'builds up', 'falls')],
    ['Calcium in the store', ...say(m.store, g.store, 'more', 'less')],
    ['Squeeze', ...say(m.squeeze, g.squeeze, 'stronger', 'weaker')],
    ['After each beat', a === b ? 'same' : a > b ? 'up' : 'down', ['no bump', 'a small bump', 'an extra beat'][a]],
  ];
}
const describe = (m, g) => compareRows(m, g).map(([k, , w]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The model: anchors and states from the data file ---------- */
// Every potassium, sodium and voltage number comes from clinical-values.json; the digoxin amounts are model
// settings from model.js. Until the file loads (or if it cannot), the model's pictures say so instead.
let anchors = null, cv = null, SET = null;
const run = st => solve(anchors, st);
// The lesson's settings: baseline and the low and high potassium from the data file, with no digoxin, the
// lesson's usual amount or its toxic amount.
function lessonSettings() {
  const k = id => cv.states.find(s => s.id === id).model.kOut, base = anchors.kOut;
  return {
    baseline: { dig: DIGOXIN.none, kOut: base }, digoxin: { dig: DIGOXIN.usual, kOut: base },
    hypokalemia: { dig: DIGOXIN.usual, kOut: k('hypokalemia') }, hyperkalemia: { dig: DIGOXIN.usual, kOut: k('hyperkalemia') },
    toxicity: { dig: DIGOXIN.toxic, kOut: base },
  };
}
const NO_DATA = 'The reference file has not loaded, so this picture, which is drawn from the model and its reference values, cannot be drawn yet. Reload the page to try again.';
const noData = h => svg(NO_DATA, text(240, h / 2 - 12, 'reference values not loaded', 'sm b') + text(240, h / 2 + 14, 'reload the page to draw this picture', 'xs muted'), { h });

// A change: from one setting to another, solved at every moment, so the picture always draws the model.
const CHANGE = {
  glycoside: { from: 'baseline', to: 'digoxin', title: 'Digoxin', words: [['↑ sodium and calcium build up inside', 'sm b blue'], ['dashed marks: no digoxin', 'xs muted']] },
  hypokalemia: { from: 'digoxin', to: 'hypokalemia', title: 'Hypokalemia with digoxin', words: [['↓ potassium outside: more pumps jammed', 'sm b blue'], ['dashed marks: digoxin at normal potassium', 'xs muted']] },
  hyperkalemia: { from: 'digoxin', to: 'hyperkalemia', title: 'Hyperkalemia with digoxin', words: [['↑ potassium outside: fewer pumps jammed', 'sm b blue'], ['dashed marks: digoxin at normal potassium', 'xs muted']] },
};
const between = (a, b, e) => ({ dig: lerp(a.dig, b.dig, e), kOut: lerp(a.kOut, b.kOut, e) });
function changeScene(kind) {
  const c = CHANGE[kind];
  return {
    duration: 3600,
    stages: [[0, c.from === 'baseline' ? 'no digoxin' : 'digoxin, normal potassium'], [0.12, kind === 'glycoside' ? 'digoxin binds' : 'potassium changes'], [0.85, 'settled']],
    render(t) {
      if (!SET) return noData(DASH_H);
      const e = ease.inOut(span(t, 0.12, 0.85)), a = SET[c.from], z = SET[c.to];
      const g = run(a), m = run(between(a, z, e)), fin = run(z);
      const jam = lerp(Math.round(g.jammed * 6), Math.round(fin.jammed * 6), e);
      const label = `${c.title}, drawn over dashed marks for the state before: six pumps in a stretch of heart cell membrane, then bars for the pumps working, sodium inside the cell, calcium in the store and the strength of each squeeze. At the end ${Math.round(fin.jammed * 6)} of 6 pumps are jammed; compared with before: ${describe(fin, g)}.`;
      return { svg: svg(label, dashboard(m, g, { jam, phase: t, words: c.words, wordsOp: span(t, 0.55, 0.85) }), { h: DASH_H }), readout: readout(compareRows(m, g), 'Compared with before') };
    },
  };
}
function dadScene() {
  return {
    duration: 4200,
    stages: [[0, 'no digoxin'], [0.1, 'calcium builds up'], [0.6, 'the bump grows']],
    render(t) {
      if (!SET) return noData(410);
      const e = ease.inOut(span(t, 0.1, 0.9)), a = SET.baseline, z = SET.toxicity;
      const g = run(a), m = run(between(a, z, e)), fin = run(z);
      const st = x => ({ rest: x.vRest, dad: x.dad, triggered: x.triggered, threshold: x.threshold });
      const top = 60, y0 = 236, c = traceChart({ top, y0, live: st(m), ghost: st(g), beats: [0.05] });
      let b = c.svg;
      b += text(c.ux(0.05) + 12, c.vy(anchors.ap.peak) - 12, 'the beat', 'xs b', 'start');
      if (m.dad > 2) {
        const xb = c.ux(0.05 + BUMP_AT), yTop = c.vy(m.triggered ? m.threshold : m.vRest + m.dad);
        b += `<g data-part="dad">${arrowB([xb - 16, c.vy(m.vRest) - 2], [xb - 16, yTop + 2], 3)}</g>`;
      }
      if (m.triggered) b += text(c.ux(0.05 + TRIG_AT) + 6, c.vy(anchors.ap.peak) - 7, 'extra beat', 'sm b red', 'start');
      // below: the cell, its overfilled store and the exchanger in the membrane at the right
      const sy = 266;
      b += `<path d="${roundBox(16, sy, 384, 138, 14, 0)}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="1.25" data-part="cell"/>`;
      b += `<path d="${roundBox(400, sy, 64, 138, 0, 14)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="ecf"/>`;
      b += bilayer({ x1: 400, y1: sy, x2: 400, y2: sy + 138, clear: [[70, 28]] }).svg;
      b += exchangerArt(400, sy + 70, 1.1, (t * 3) % 1, { rot: 90, arrows: false }).svg;
      b += `<g transform="translate(-4 ${sy + 34 - STORE.y}) scale(1 1)">${storeArt()}</g>`;
      const nCa = clamp(Math.round(4 * m.store), 0, 12);
      let ca = '';
      for (let i = 0; i < Math.min(nCa, 7); i++) ca += at(CA, STORE.x + 22 + i * 38, sy + 46);
      for (let i = 7; i < Math.min(nCa, 12); i++) ca += at(CA, STORE.x + 41 + (i - 7) * 38, sy + 66);
      // spilled calcium on its way to the exchanger
      // how far the store is past its spill point, as a share of the toxic state's overshoot
      const spill = clamp((m.store - anchors.spill) / Math.max(0.01, fin.store - anchors.spill), 0, 1);
      for (let i = 0; i < 3; i++) { const k = ((t * 1.5 + i / 3) % 1); if (spill > 0.05) ca += at(CA, lerp(300, 384, k), sy + 70 + (i - 1) * 14, ` opacity="${f(spill)}"`); }
      b += `<g data-part="calcium">${ca}</g>`;
      b += text(32, sy + 26, 'calcium store', 'xs b', 'start');
      b += text(388, sy + 26, 'exchanger', 'xs b', 'end');
      b += ions(NA, 3, [412, sy + 14, 44, 110], 21, [[400, sy + 46, 40, 48]], [], 20);
      b += `<g ${fade(span(t, 0.5, 0.8))}>${text(32, sy + 120, '↑ store overfills', 'xs b blue', 'start')}${text(388, sy + 120, 'charge flows in', 'xs b blue', 'end')}</g>`;
      b += `<g ${fade(span(t, 0.6, 0.9))}>${text(16, 22, '↑ a bump after the beat reaches threshold', 'sm b blue', 'start')}${text(16, 44, 'dashed line: the same beat with no digoxin', 'xs muted', 'start')}</g>`;
      const label = `Too much digoxin, drawn over a dashed normal voltage trace. Above, one beat: after it the voltage bumps up, a delayed afterdepolarization, and the bump reaches threshold and fires an extra beat. Below, the heart cell's calcium store overfills, spilled calcium heads to the exchanger in the membrane, and charge flows in. Compared with no digoxin: ${describe(fin, g)}.`;
      return { svg: svg(label, b, { h: 410 }), readout: readout(compareRows(m, g), 'Compared with no digoxin') };
    },
  };
}

/* ---------- Scenes, one per step kind ---------- */
const still = (label, draw, h) => () => svg(label, draw(), { h });
const scenes = {
  cell: still('One heart muscle cell, a rounded block with its nucleus, floating in fluid. Labels mark the fluid outside the cell, the thin golden cell membrane around it and the inside of the cell.', cellStill, 330),
  ions: still('A stretch of cell membrane with the outside of the cell above and the inside below. Many amber sodium circles crowd the outside and only a few are inside; many green potassium triangles crowd the inside and only a few are outside.', ionsStill, 392),
  leak: { duration: 3000, loop: true, render: t => svg('A stretch of cell membrane with two protein channels. Sodium passes through the left channel into the cell, and potassium through the right channel out of it. An amber arrow points in and a green arrow points out, each from the crowded side to the sparse side.', leakPicture(t), { h: 392 }) },
  pump: still('One sodium-potassium pump, a sage protein spanning the membrane with a smaller lilac partner beside it, holding sodium and potassium ions. Its head inside the cell carries ATP, the fuel it splits each cycle.', () => pumpPicture(0.62, false), 392),
  cycle: { duration: 4400, loop: true, stages: [[0, '3 sodium carried out'], [0.5, '2 potassium carried in']], render: t => svg('The sodium-potassium pump rocks between facing inside and facing outside. In the first half of each cycle three amber sodium ions are carried up and out of the cell; in the second half two green potassium triangles are carried down and in.', pumpPicture((t + 0.5) % 1, true), { h: 392 }) },
  balance: { duration: 4400, loop: true, render: t => svg('A sodium leak channel, a sodium-potassium pump and a potassium channel side by side in the membrane, all working at once. Below, two bars show sodium inside the cell low and potassium inside high, both holding steady.', balancePicture(t), { h: 404 }) },
  exchanger: { duration: 4000, loop: true, stages: [[0, '3 sodium flow in'], [0.5, '1 calcium pushed out']], render: t => svg('The sodium-calcium exchanger, a lilac protein in the membrane. In the first half of each cycle three amber sodium ions flow into the cell through it; in the second half one teal calcium square is pushed out.', exchangerPicture(t), { h: 392 }) },
  squeeze: { duration: 4400, loop: true, stages: [[0, 'calcium floods out'], [0.3, 'the filaments slide'], [0.55, 'calcium goes back']], render: t => svg('Inside a heart cell: a long lilac calcium store near the top and a set of contractile filaments below. Teal calcium squares leave the store and reach the filaments, which slide over each other so the set shortens; then the calcium returns to the store and one leaves through the exchanger in the membrane.', squeezePicture(t), { h: 376 }) },
  beat: { duration: 4400, loop: true, render: t => anchors ? svg('A voltage trace over time with two heartbeats. The line sits at the resting level, then each action potential rises quickly, holds a long plateau and falls back to rest. Dashed lines mark the resting level and the higher threshold.', beatPicture(t), { h: 340 }) : noData(340) },
  chain: still('The pump and the sodium-calcium exchanger side by side in the membrane, with a calcium store inside the cell. An amber arrow marks the steep sodium gradient from outside to inside that drives sodium in through the exchanger, which pushes calcium out, so the store holds a normal load.', chainStill, 388),
  digoxin: still('The sodium-potassium pump with a drug-purple digoxin plug jammed in its outer face. A dashed blue ring marks that spot, the digoxin pocket. Green potassium triangles wait outside; potassium binding the pump makes digoxin hold on less tightly.', digoxinStill, 392),
  glycoside: changeScene('glycoside'),
  hypokalemia: changeScene('hypokalemia'),
  hyperkalemia: changeScene('hyperkalemia'),
  dad: dadScene(),
};

/* ---------- Explore freely ---------- */
const ui = () => ({ dig: $('#dig'), k: $('#kout') });
const settings = () => { const u = ui(); return { dig: +u.dig.value, kOut: +u.k.value }; };
const digWords = d => d === 0 ? 'none' : `${d.toFixed(2)}: ${d < 0.9 ? 'below the lesson\'s usual amount' : d <= 1.1 ? 'the lesson\'s usual amount' : d < 2.25 ? 'above the usual amount' : 'the lesson\'s toxic range'}`;
const afterWords = m => m.triggered ? 'a bump that reaches threshold and fires an extra beat' : m.dad > 0.5 ? `a small bump, ${m.dad.toFixed(0)} mV, below threshold` : 'no afterdepolarization';
function renderExplore() {
  if (!SET) { $('#explore-visual').innerHTML = noData(DASH_H); $('#model-results').textContent = 'The reference file has not loaded, so the model cannot start. Reload the page to try again.'; return; }
  const s = settings(), m = run(s), g = run(SET.baseline);
  $('#explore-visual').innerHTML = svg(`The teaching model now, drawn over dashed marks for a cell with no digoxin at normal potassium. ${Math.round(m.jammed * 6)} of 6 pumps are jammed; compared with normal: ${describe(m, g)}.`, dashboard(m, g), { h: DASH_H }) + readout(compareRows(m, g));
  $('#dig-out').textContent = digWords(s.dig);
  $('#kout-out').textContent = `${s.kOut.toFixed(1)} mM`;
  const rowsOut = [
    ['Pumps jammed', `${Math.round(m.jammed * 100)}%`], ['Pumps working', `${Math.round(m.pump * 100)}% of normal`],
    ['Sodium inside', `${m.naIn.toFixed(2)} × normal`], ['Calcium in the store', `${m.store.toFixed(2)} × normal`],
    ['Squeeze', `${m.squeeze.toFixed(2)} × normal`], ['Resting potential', `${m.vRest.toFixed(0)} mV`],
  ];
  $('#model-results').innerHTML = `<b>Digoxin ${esc(digWords(s.dig))}; potassium ${s.kOut.toFixed(1)} mM.</b> ` + rowsOut.map(([k, v]) => `${k}: <span data-model="${k.toLowerCase().replace(/\s+/g, '-')}">${v}</span>`).join(' · ') + `. After each beat: ${afterWords(m)}.`;
}
function wireExplore() {
  const u = ui();
  u.dig.addEventListener('input', () => { syncState(); update(); });
  u.k.addEventListener('input', () => { syncState(); update(); });
  $('#reset').addEventListener('click', () => applyState('baseline'));
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
const rangeText = v => `${v.display} ${v.unit}`;
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = hi - lo || Math.abs(hi) * 0.4;
  const pad = v.low != null && v.high != null ? sp * 1.1 : sp * 0.6;
  return [lo - pad, hi + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
// Judged on the model's own number, not the rounded reading, so the words always agree with the marker.
function statusFor(v, x) {
  if (v.low != null && v.high != null) return x < v.low ? 'below the typical range' : x > v.high ? 'above the typical range' : 'inside the typical range';
  const rel = (x - v.typical) / Math.abs(v.typical);
  return Math.abs(rel) < 0.02 ? 'close to the typical value' : x > v.typical ? 'above the typical value' : 'below the typical value';
}
let selectedState = 'baseline';
// A cited state matches when every setting its model names (potassium, and digoxin for the baseline) is the
// current one; the potassium states leave digoxin as it is.
const matches = (model, s) => Object.entries(model).every(([k, v]) => Math.abs(s[k] - v) < (k === 'dig' ? 0.01 : 0.05));
function syncState() {
  if (!cv) return;
  const s = settings(), hit = cv.states.find(st => matches(st.model, s));
  selectedState = hit ? hit.id : 'custom';
  const sel = $('#clinical-state');
  if (sel) sel.value = selectedState;
}
function applyState(id) {
  const st = cv?.states.find(x => x.id === id), u = ui();
  if (!st) return;
  if (st.model.dig != null) u.dig.value = st.model.dig;
  if (st.model.kOut != null) u.k.value = st.model.kOut;
  selectedState = id;
  update();
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom" disabled>Custom settings (change them in Explore freely)</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-k').addEventListener('input', e => { ui().k.value = e.target.value; syncState(); update(); });
  $('#clinical-reset').addEventListener('click', () => applyState('baseline'));
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
    cite.textContent = `${v.excerpt ? `"${v.excerpt}" ` : ''}${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
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
  if (!SET) { $('#clinical-visual').innerHTML = noData(DASH_H); return; }
  const s = settings(), m = run(s), g = run(SET.baseline);
  $('#clinical-visual').innerHTML = svg(`The teaching model now, over dashed marks for no digoxin at normal potassium: ${describe(m, g)}.`, dashboard(m, g), { h: DASH_H });
  $('#clinical-k').value = s.kOut;
  $('#clinical-k-label').textContent = `${s.kOut.toFixed(1)} mM`;
  if (!cv) return;
  const st = cv.states.find(x => x.id === selectedState);
  $('#state-summary').textContent = st ? `${st.label}. ${st.summary}` : `Custom settings: digoxin ${digWords(s.dig)}, potassium ${s.kOut.toFixed(1)} mM (illustrative).`;
  $('#state-evidence').innerHTML = st ? st.evidence.map(q => `<p>${esc(q.text)} <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') + (st.unstatedNote ? `<p>${esc(st.unstatedNote)}</p>` : '') : '<p>Custom settings: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey];
    row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]} (${st.label.toLowerCase()})` : 'No direction stated by the cited sources';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const id of ['kOut', 'naOut', 'vRest', 'threshold']) if (typeof data.modelBaseline?.[id] !== 'number') throw new Error(`no ${id}`);
    for (const id of ['baseline', 'hypokalemia', 'hyperkalemia']) if (!data.states?.some(s => s.id === id && typeof s.model?.kOut === 'number')) throw new Error(`no state ${id}`);
    cv = data;
    anchors = anchorsFrom(cv);
    SET = lessonSettings();
    buildClinical();
    ui().k.value = anchors.kOut;
    ui().dig.max = DIGOXIN.max;
    wireExplore();
    syncState();
  } catch (err) {
    cv = null; anchors = null; SET = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the model's pictures, this tab and Explore freely need it.`;
    $$('#explore input, #explore button').forEach(el => { el.disabled = true; });
  }
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
