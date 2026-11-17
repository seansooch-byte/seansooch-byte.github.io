// Lesson 27: Resting membrane potential and potassium. The kit (/lab/kit/kit.js) runs the page; this file holds
// the pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: potassium is the green triangle, sodium the amber circle, chloride the grey
//     diamond, the cell's large negative proteins sage blobs with a minus. Kit blue is only ever a change or
//     the voltage being taught: an arrow, a marker, or the words that name it.
//   - Most pictures are a strip of membrane: the fluid outside the cell above, the cell's inside below, with
//     channels and the pump set in the membrane. A voltage ruler under the strip shows the resting potential
//     (a marker), the threshold (a dashed line) and, in the changes, a dashed marker of normal.
//   - Every voltage, gap and share of ready sodium channels comes from model.js, whose numbers all come from
//     clinical-values.json. If that file cannot load, the pictures that need the model say so instead.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, fill, mix, blob, artGhost, arrowFixed, leader, textWidth } from '/lab/kit/art/core.js';
import { bilayer, channel, transporter, membraneBand } from '/lab/kit/art/cell.js';
import { ion } from '/lab/kit/art/molecules.js';
import { changeArrow } from '/lab/kit/art/chart.js';
import { anchorsFrom, solve } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, GREEN_LINE = P.k.line;

/* ---------- Glyphs (each drawn once at the origin, then moved with translate) ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
const K = ion('k', { s: 0.8 }).svg;
const NA = ion('na', { s: 0.95 }).svg;
const CL = ion('cl', { s: 0.8 }).svg;
// A large negatively charged protein inside the cell: a folded globule with a minus mark. Lesson-local.
const PROT = [1, 2, 3].map(seed => `<g data-part="protein"><path d="${blob(0, 0, 9, { lobes: 3, wobble: 0.1, seed })}" fill="${fill('protein')}" stroke="${P.protein.line}" stroke-width="1.4"/><path d="M-4 0 H4" stroke="${P.protein.line}" stroke-width="2.2" stroke-linecap="round"/></g>`);
const RBC = `<g><ellipse rx="10" ry="6" fill="${P.rbc.rim}" stroke="${P.rbc.line}" stroke-width="1.1"/><ellipse cx="-.6" cy="-.5" rx="5" ry="2.7" fill="${P.rbc.base}"/></g>`;

/* ---------- Small helpers ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Points spread evenly at random in a box: each new point keeps a minimum distance from the others. Cached.
const POOLS = new Map();
function pool(seed, [x, y, w, h], minD, n = 80) {
  const key = `${seed}:${x}:${y}:${w}:${h}:${minD}`;
  if (POOLS.has(key)) return POOLS.get(key);
  const r = rng(seed), pts = [];
  for (let tries = 0; pts.length < n && tries < n * 300; tries++) {
    const p = { x: x + r() * w, y: y + r() * h };
    if (pts.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD * minD)) pts.push(p);
  }
  POOLS.set(key, pts);
  return pts;
}
const inBox = (x, y, [bx, by, bw, bh], pad = 0) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;
const rrect = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`; };
const ECF_LINE = mix(P.space.ecf, INK, 0.35);
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const arrowB = (a, b, w = 3.5) => arrowFixed(a, b, { col: BLUE, w, head: { l: 10, w: 6 } });
const mv = v => `${Math.round(v)}`;
// Interleave species so each kind spreads across a region instead of clumping: [['k', 3], ['na', 5]] -> keys.
function interleave(counts) {
  const out = [];
  for (const [key, n] of counts) for (let i = 0; i < n; i++) out.push({ key, at: (i + 0.5) / n });
  return out.sort((a, b) => a.at - b.at).map(o => o.key);
}
const GLYPH = { k: K, na: NA, cl: CL };

/* ---------- The membrane strip: outside above, inside below ---------- */
// ions: { out: [['na', 9], ...], in: [['k', 11], ['prot', 3], ...] }; proteins: [{ x, half, svg }] set in the
// membrane; keep: label boxes the ions avoid; charge: 0..1, how strong the split of charge across the membrane.
const X0 = 16, X1 = 464;
function strip({ top, my, bot, ions = {}, proteins = [], keep = [], charge = 0, seed = 1, skip = [] }) {
  let b = `<path d="${rrect(X0, top, X1 - X0, my - top + 12, 14)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" data-part="outside"/>`;
  b += `<path d="${rrect(X0, my - 12, X1 - X0, bot - my + 12, 14)}" fill="${P.cytoplasm.base}" stroke="${P.cytoplasm.line}" stroke-width="1.25" data-part="inside"/>`;
  const band = charge > 0.02 ? 38 : 30;
  const free = p => !keep.some(k => inBox(p.x, p.y, k, 10)) && !proteins.some(q => Math.abs(p.x - q.x) < q.half + 14 && Math.abs(p.y - my) < (q.reach || 64));
  const fillRegion = (box, list, sd) => {
    const keys = interleave(list), pts = pool(sd, box, 30).filter(free);
    return keys.map((k, i) => pts[i] ? at(k === 'prot' ? PROT[i % 3] : GLYPH[k], pts[i].x, pts[i].y) : '').join('');
  };
  b += fillRegion([X0 + 14, top + 14, X1 - X0 - 28, my - band - top - 14], ions.out || [], seed);
  b += fillRegion([X0 + 14, my + band, X1 - X0 - 28, bot - my - band - 14], ions.in || [], seed + 7);
  b += bilayer({ x1: X0, y1: my, x2: X1, y2: my, clear: proteins.map(q => [q.x - X0, q.half]) }).svg;
  b += proteins.map(q => q.svg).join('');
  if (charge > 0.02) b += chargeMarks(my, charge, proteins, skip);
  return b;
}
// The split of charge: plus marks along the outside face, minus marks along the inside face, spread evenly
// over the free stretches of membrane (not on a protein, not under an arrow: skip is [[x0, x1]]).
function chargeMarks(my, k, proteins, skip = []) {
  const slots = [];
  for (let i = 0; i < 22; i++) {
    const x = X0 + 14 + i * (X1 - X0 - 28) / 21;
    if (!proteins.some(q => Math.abs(x - q.x) < q.half + 8) && !skip.some(([a, z]) => x > a && x < z)) slots.push(x);
  }
  const n = Math.min(slots.length, Math.round(slots.length * clamp(k, 0, 1))), xs = [];
  for (let i = 0; i < n; i++) xs.push(slots[Math.floor((i + 0.5) * slots.length / n)]);
  const plus = xs.map(x => `M${f(x - 4.5)} ${my - 21} H${f(x + 4.5)} M${f(x)} ${my - 25.5} V${my - 16.5}`).join(' ');
  const minus = xs.map(x => `M${f(x - 4.5)} ${my + 21} H${f(x + 4.5)}`).join(' ');
  return `<g data-part="charge"><path d="${plus}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="${minus}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`;
}
// Channels set in the membrane (the art primitive, anchored on the membrane's midplane).
const kDoor = (x, my, opts = {}) => ({ x, half: 22, svg: channel({ kind: 'kir', open: 1, ion: 'k', x, y: my, parts: { channel: 'k-door' }, ...opts }).svg });
const naDoor = (x, my, opts = {}) => ({ x, half: 33, reach: 72, svg: channel({ kind: 'nav', open: 0, x, y: my, parts: { channel: 'na-door' }, ...opts }).svg });
const label = (x, y, words, cls, anchor = 'start') => text(x, y, words, cls, anchor);
const boxOf = (x, y, words, cls, anchor = 'start') => { const w = textWidth(words, cls), x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x; return [x0, y - 15, w, 20]; };

/* ---------- The voltage ruler ---------- */
// A horizontal scale of the voltage inside: ticks below, the resting potential as a marker above, the
// threshold as a dashed line, and (in the changes) a dashed marker of normal with a blue arrow to the new one.
function ruler({ y, lo, hi, x0 = 44, x1 = 436, step = 10, v, ghost = null, threshold = null, eK = null, words = null, wordsOp = 1, restWord = 'rest' }) {
  const X = u => x0 + (clamp(u, lo, hi) - lo) / (hi - lo) * (x1 - x0);
  let b = `<g data-part="meter"><path d="M${x0} ${y} H${x1}" stroke="${P.ui.rule}" stroke-width="7" stroke-linecap="round"/><path d="M${x0} ${y} H${x1}" stroke="${INK}" stroke-width="1.5"/>`;
  for (let u = lo; u <= hi + 1e-6; u += step) {
    b += `<path d="M${f(X(u))} ${y + 4} V${y + 10}" stroke="${INK}" stroke-width="1.5"/>`;
    b += text(X(u), y + 28, u === hi ? `${u} mV` : `${u}`, 'xs muted', u === hi ? 'end' : 'middle', u === hi ? `dx="${f(textWidth(`${u}`, 'xs muted') / 2)}"` : '');
  }
  b += '</g>';
  const xT = threshold == null ? null : X(threshold);
  if (xT != null) {
    b += `<g data-part="threshold"><path d="M${f(xT)} ${y - 30} V${y + 8}" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>${text(xT + 7, y - 30, 'threshold', 'xs b', 'start')}</g>`;
  }
  if (eK != null) {
    const xk = X(eK);
    b += `<g data-part="kbal"><path d="M${f(xk)} ${y - 9} V${y + 9}" stroke="${GREEN_LINE}" stroke-width="3.5" stroke-linecap="round"/>${text(Math.max(16, xk - 12), y + 80, `potassium balance point ${mv(eK)} mV`, 'xs b green', 'start')}</g>`;
  }
  const tri = x => `M${f(x)} ${y - 5} L${f(x - 8)} ${y - 19} L${f(x + 8)} ${y - 19} Z`;
  if (ghost != null) b += `<g data-ghost="normal">${artGhost(tri(X(ghost)))}</g>`;
  const xv = X(v), rw = `${restWord} ${mv(v)} mV`, w = textWidth(rw, 'sm b');
  // the resting label sits over its marker, kept left of the threshold's own label
  let lx = xv + w / 2;
  if (xT != null && xv < xT) lx = Math.min(lx, xT - 8);
  lx = clamp(lx, 8 + w, 472);
  const ly = xT != null && xv >= xT - 2 ? y - 54 : y - 30;
  b += `<g data-part="rest"><path d="${tri(xv)}" fill="${BLUE}" stroke="${mix(BLUE, INK, 0.4)}" stroke-width="1.2"/>${text(lx, ly, rw, 'sm b', 'end')}</g>`;
  // words: the change named beside its arrow; '' draws the arrow alone (the words are elsewhere on the picture)
  if (ghost != null && words != null && Math.abs(X(ghost) - xv) > 16) {
    b += `<g ${fade(wordsOp)}>${words ? changeArrow([X(ghost), y + 46], [xv, y + 46], words, { cls: 'sm b blue', keepOut: [[0, y + 10, 480, 24]] }) : arrowB([X(ghost), y + 44], [xv, y + 44], 3.5)}</g>`;
  }
  return b;
}

/* ---------- Building the idea (steps 1 to 9) ---------- */
function ionsPicture() {
  const top = 16, my = 150, bot = 284;
  const keep = [boxOf(28, 42, 'outside the cell', 'sm b'), boxOf(28, 272, 'inside the cell', 'sm b'), boxOf(452, my - 36, 'cell membrane', 'xs b', 'end')];
  let b = strip({ top, my, bot, keep, seed: 3, ions: { out: [['na', 9], ['cl', 5], ['k', 2]], in: [['k', 11], ['prot', 4], ['na', 1]] } });
  b += label(28, 42, 'outside the cell', 'sm b') + label(28, 272, 'inside the cell', 'sm b') + label(452, my - 36, 'cell membrane', 'xs b', 'end');
  const row = (y, g, x, words, cls) => at(g, x, y - 6) + text(x + 16, y, words, cls, 'start');
  b += row(318, K, 30, 'potassium: positive', 'xs b green') + row(318, NA, 262, 'sodium: positive', 'xs b amber');
  b += row(350, CL, 30, 'chloride: negative', 'xs b muted') + row(350, PROT[0], 262, 'protein: negative', 'xs b');
  return b;
}

function gradientPicture(t) {
  const top = 16, my = 132, bot = 248;
  const pump = { x: 240, half: 50, reach: 70, svg: transporter({ kind: 'pump', beta: true, atp: true, phase: t, x: 240, y: my }).svg };
  const pumpLabel = 'sodium-potassium pump', lw = textWidth(pumpLabel, 'xs b');
  const keep = [boxOf(28, 40, 'outside', 'sm b'), boxOf(28, 236, 'inside', 'sm b'), boxOf(452, 236, pumpLabel, 'xs b', 'end'), [300, 186, 60, 40]];
  let b = strip({ top, my, bot, keep, seed: 11, proteins: [pump], ions: { out: [['na', 9], ['k', 2]], in: [['k', 11], ['na', 2], ['prot', 3]] } });
  b += label(28, 40, 'outside', 'sm b') + label(28, 236, 'inside', 'sm b');
  b += `<g data-part="pump">${label(452, 236, pumpLabel, 'xs b', 'end')}${leader([452 - lw - 6, 230], [262, my + 40], { elbow: true })}</g>`;
  // how crowded each ion is on each side, from the model's settings (one shared scale)
  const a = anchors, max = Math.max(a.kIn, a.naOut), bx = 184, bw = 268;
  const rows = [['potassium inside', a.kIn, 'k', 'green'], ['potassium outside', a.kOut, 'k', 'green'], ['sodium outside', a.naOut, 'na', 'amber'], ['sodium inside', a.naIn, 'na', 'amber']];
  let bars = '';
  rows.forEach(([words, c, key, cls], i) => {
    const y = 286 + i * 26 + (i > 1 ? 10 : 0);
    bars += text(16, y + 5, words, `xs b ${cls}`, 'start');
    bars += `<rect x="${bx}" y="${y - 9}" width="${f(Math.max(2, bw * c / max))}" height="14" rx="3" fill="${P[key].base}" stroke="${P[key].line}" stroke-width="1.1"/>`;
  });
  b += `<g data-part="gradient">${bars}</g>`;
  return b;
}

function voltagePicture() {
  const top = 16, my = 124, bot = 232;
  const keep = [boxOf(28, 40, 'outside: extra positive charge', 'xs b'), boxOf(28, 222, 'inside: extra negative charge', 'xs b')];
  let b = strip({ top, my, bot, keep, charge: 1, seed: 21, ions: { out: [['na', 6], ['cl', 3], ['k', 1]], in: [['k', 7], ['prot', 3]] } });
  b += label(28, 40, 'outside: extra positive charge', 'xs b') + label(28, 222, 'inside: extra negative charge', 'xs b');
  b += ruler({ y: 300, lo: -100, hi: 0, step: 20, v: model().vRest, restWord: 'resting potential' });
  b += text(44, 358, 'voltage inside, compared with outside', 'xs muted', 'start');
  return b;
}

function channelsPicture(t) {
  const top = 16, my = 132, bot = 248;
  const kL = 'potassium leak channels: open', nL = 'sodium channel: shut';
  const keep = [boxOf(16, 34, kL, 'xs b'), boxOf(464, 34, nL, 'xs b', 'end'), [100, 36, 40, 70], [250, 36, 70, 70], boxOf(28, 238, 'inside', 'sm b')];
  const proteins = [kDoor(120, my, { phase: t % 1 }), naDoor(240, my), kDoor(370, my, { phase: (t + 0.5) % 1 })];
  let b = strip({ top, my, bot, keep, proteins, seed: 31, ions: { out: [['na', 8], ['cl', 3], ['k', 2]], in: [['k', 10], ['prot', 3], ['na', 1]] } });
  b += `<g data-part="k-door">${label(16, 34, kL, 'xs b green')}${leader([118, 40], [120, my - 26], { elbow: false })}</g>`;
  b += `<g data-part="na-door">${label(464, 34, nL, 'xs b amber', 'end')}${leader([300, 40], [246, my - 28])}</g>`;
  b += label(28, 238, 'inside', 'sm b');
  return b;
}

function forcesPicture() {
  const top = 16, my = 150, bot = 284;
  const pushW = 'push of crowding: out', pullW = 'pull of the negative inside: in';
  const keep = [boxOf(28, 42, pushW, 'sm b'), boxOf(452, 272, pullW, 'xs b', 'end'), [176, my - 84, 130, 168]];
  const door = kDoor(240, my, { ion: null });
  let b = strip({ top, my, bot, keep, charge: 1, proteins: [door], seed: 41, skip: [[186, 214], [268, 296]], ions: { out: [['k', 3], ['na', 5]], in: [['k', 12], ['prot', 3]] } });
  b += at(K, 240, my + 44);
  b += `<g data-part="push">${arrowFixed([200, my + 70], [200, my - 72], { col: GREEN_LINE, w: 4, head: { l: 11, w: 6.5 } })}${label(28, 42, pushW, 'sm b green')}</g>`;
  b += `<g data-part="pull">${arrowFixed([282, my - 72], [282, my + 70], { col: INK, w: 4, head: { l: 11, w: 6.5 } })}${label(452, 272, pullW, 'xs b', 'end')}</g>`;
  return b;
}

// One trace of the voltage over time: rest, a small nudge that fades, then a nudge to threshold and a spike.
function traceV(u, a, rest) {
  const thr = a.threshold, peak = a.peak;
  if (u < 0.14) return rest;
  if (u < 0.36) { const s = (u - 0.14) / 0.22, bump = s < 0.18 ? s / 0.18 : Math.exp(-(s - 0.18) * 5); return rest + 0.48 * (thr - rest) * bump; }
  if (u < 0.44) return rest;
  if (u < 0.5) return lerp(rest, thr, ease.out((u - 0.44) / 0.06));
  if (u < 0.53) return lerp(thr, peak, ease.inOut((u - 0.5) / 0.03));
  const low = rest - a.undershoot;   // the brief dip below rest after the spike
  if (u < 0.66) return lerp(peak, low, ease.inOut((u - 0.53) / 0.13));
  if (u < 0.8) return lerp(low, rest, ease.inOut((u - 0.66) / 0.14));
  return rest;
}
function thresholdPicture(t) {
  const a = anchors, rest = model().vRest, x0 = 70, x1 = 460;
  const vy = v => 330 - (v + 100) * 260 / 140, ux = u => x0 + u * (x1 - x0);
  let b = `<path d="M${x0} 62 V340 H${x1}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
  for (const v of [0, -50, -100]) b += `<path d="M${x0 - 5} ${f(vy(v))} H${x0}" stroke="${INK}" stroke-width="1.5"/>` + text(x0 - 9, vy(v) + 6, `${v}`, 'xs muted', 'end');
  b += text(x0 - 9, 72, 'mV', 'xs muted', 'end') + text(x1, 364, 'time', 'xs muted', 'end');
  b += `<g data-part="threshold"><path d="M${x0} ${f(vy(a.threshold))} H${x1}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>${text(x1, vy(a.threshold) - 8, 'threshold', 'xs b', 'end')}</g>`;
  b += `<g data-part="rest">${text(x1, vy(rest) + 22, `rest ${mv(rest)} mV`, 'xs b', 'end')}</g>`;
  const n = 220, until = clamp(t, 0, 1), pts = [];
  for (let i = 0; i <= n * until; i++) { const u = i / n; pts.push([ux(u), vy(traceV(u, a, rest))]); }
  const d = pts.length > 1 ? `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}` : '';
  if (d) b += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  // the spike, as its own part
  const sp = pts.filter(([x]) => x >= ux(0.495) && x <= ux(0.68));
  if (sp.length > 1) b += `<g data-part="ap"><path d="M${sp.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}" fill="none" stroke="${BLUE}" stroke-width="3.5" stroke-linejoin="round"/></g>`;
  if (pts.length) { const [x, y] = pts[pts.length - 1]; b += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${BLUE}" stroke="${P.ui.white}" stroke-width="2"/>`; }
  b += `<g ${fade(span(t, 0.24, 0.3))}>${text(x0 + 10, vy(rest) + 22, 'small nudge: fades', 'xs b', 'start')}</g>`;
  b += `<g ${fade(span(t, 0.53, 0.58))}>${text(ux(0.61), vy(a.peak) + 6, 'reaches threshold:', 'sm b blue', 'start')}${text(ux(0.61), vy(a.peak) + 28, 'an action potential', 'sm b blue', 'start')}</g>`;
  return b;
}

function gapPicture() {
  const m = model(), y = 160;
  let b = ruler({ y, lo: -100, hi: -60, v: m.vRest, threshold: m.threshold });
  const X = u => 44 + (u + 100) / 40 * 392, xr = X(m.vRest), xT = X(m.threshold);
  b += `<g data-part="gap"><path d="M${f(xr)} ${y + 50} V${y + 58} H${f(xT)} V${y + 50}" fill="none" stroke="${BLUE}" stroke-width="2"/>${text((xr + xT) / 2, y + 82, `gap to threshold: ${mv(m.gap)} mV`, 'sm b blue', 'middle')}</g>`;
  b += arrowB([xr, 70], [xT - 4, 70], 3.5) + text((xr + xT) / 2, 54, 'the nudge it takes to fire', 'sm b blue', 'middle');
  b += text(16, 290, 'smaller gap: easier to fire', 'xs b', 'start') + text(16, 316, 'bigger gap: harder to fire', 'xs b', 'start');
  return b;
}

function gatesPicture() {
  const top = 56, my = 170, bot = 262, s = 1.3;
  const chans = [
    { x: 96, svg: channel({ kind: 'nav', open: 0, x: 96, y: my, s, parts: { channel: 'ready' } }).svg },
    { x: 240, svg: channel({ kind: 'nav', open: 1, ion: 'na', x: 240, y: my, s, parts: { channel: 'na-open' } }).svg },
    { x: 384, svg: channel({ kind: 'nav', open: 1, inactivated: 1, x: 384, y: my, s, parts: { channel: 'na-inact' } }).svg },
  ].map(c => ({ ...c, half: 42, reach: 90 }));
  let b = strip({ top, my, bot, proteins: chans, seed: 51, ions: { out: [['na', 6]], in: [] } });
  b += `<g data-part="ready">${text(96, 40, 'ready', 'sm b')}${text(96, 292, 'closed but ready', 'xs muted')}</g>`;
  b += text(240, 40, 'open', 'sm b') + text(240, 292, 'sodium flows in', 'xs muted');
  b += text(384, 40, 'inactivated', 'sm b') + text(384, 292, 'plugged shut', 'xs muted');
  b += arrowFixed([136, 34], [184, 34], { col: INK, w: 2.5 }) + arrowFixed([282, 34], [318, 34], { col: INK, w: 2.5 });
  b += arrowFixed([384, 304], [384, 326], { col: INK, w: 2 }) + `<path d="M384 326 V332 H96 V310" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` + arrowFixed([96, 318], [96, 304], { col: INK, w: 2.5 });
  b += text(240, 356, 'a negative rest resets it to ready', 'xs b', 'middle');
  return b;
}

function bloodkPicture() {
  let b = '';
  // plasma in a capillary, its wall with narrow gaps, then the fluid around the cell, then the cell
  b += `<g data-part="plasma"><path d="${rrect(16, 36, 448, 84, 14)}" fill="${P.plasma.base}" stroke="${P.plasma.line}" stroke-width="1.25"/>${[90, 250, 410].map(x => at(RBC, x, 98)).join('')}${at(K, 330, 98)}${at(K, 150, 98)}</g>`;
  let wall = '';
  for (let x = 16; x < 464; x += 64) wall += `<path d="${rrect(x, 114, Math.min(54, 464 - x), 12, 5)}" fill="${P.capillary.base}" stroke="${P.capillary.line}" stroke-width="1.4"/>`;
  b += wall;
  b += `<g data-part="fluid"><path d="${rrect(16, 126, 448, 86, 0)}" fill="${P.space.ecf}"/>${at(K, 390, 176)}${at(K, 120, 190)}</g>`;
  b += arrowFixed([203, 146], [203, 100], { col: INK, w: 2.5 }) + arrowFixed([221, 100], [221, 146], { col: INK, w: 2.5 });
  b += text(234, 166, 'trades freely', 'xs b', 'start');
  const cell = rrect(16, 222, 448, 132, 18);
  let ins = '';
  const pts = pool(61, [40, 244, 400, 64], 30).slice(0, 13);
  for (const p of pts) ins += at(K, p.x, p.y);
  b += `<g data-part="cell"><path d="${cell}" fill="${P.cytoplasm.base}"/>${membraneBand({ d: cell, w: 8 }).svg}${ins}</g>`;
  b += text(28, 62, 'blood plasma: what a blood test reads', 'xs b', 'start');
  b += text(28, 152, 'fluid around the cell', 'xs b', 'start');
  b += text(28, 340, 'inside the cell: almost all the potassium', 'xs b', 'start');
  return b;
}

/* ---------- The model, from the data file ---------- */
let anchors = null, cv = null;
const model = (s = {}) => solve(anchors, s);
const stateK = id => cv.states.find(s => s.id === id).model.kOut;
const noData = h => svg('Picture unavailable: the lesson\'s model settings could not be loaded, so its voltages cannot be drawn. Reload the page to try again.', text(240, h / 2, 'The model settings did not load. Reload to try again.', 'sm b'), { h });

// "Compared with normal", from the same model state the picture draws.
function compareRows(m, n) {
  const d = (x, y, tol = 0.4) => x > y + tol ? 'up' : x < y - tol ? 'down' : 'same';
  const rest = d(m.vRest, n.vRest), gap = d(m.gap, n.gap), ready = d(m.ready * 100, n.ready * 100, 0.5);
  return [
    ['Resting potential', rest, `${mv(m.vRest)} mV${rest === 'up' ? ', less negative' : rest === 'down' ? ', more negative' : ''}`],
    ['Gap to threshold', gap, `${mv(m.gap)} mV`],
    ['Sodium channels ready', ready, `${Math.round(m.ready * 100)}%`],
  ];
}
const describe = (m, n) => compareRows(m, n).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join('; ');

// The dashboard: one potassium leak channel with its push, sodium channels, the split of charge and the ruler.
function dash(m, { ghost = null, nNa = 2, words = [], wordsOp = 1, arrowWords = null, h = 384 } = {}) {
  const top = 56, my = 150, bot = 242, kx = 96, len = clamp(60 * m.push - 10, 30, 110);
  const shut = Math.round(nNa * (1 - m.ready));
  const na = Array.from({ length: nNa }, (_, i) => naDoor(nNa === 2 ? 270 + i * 120 : 262 + i * 76, my, { inactivated: i < shut ? 1 : 0 }));
  const pushW = 'push out', kOutN = clamp(Math.round(4 * m.kOut / anchors.kOut), 1, 12);
  const keep = [[kx + 30, Math.min(my + 40 - len, my - 48) - 6, 92, 26], ...words.map((_, i) => [0, 6 + i * 24, 480, 26])];
  let b = strip({ top, my, bot, keep, charge: Math.abs(m.vRest) / 90, proteins: [kDoor(kx, my), ...na], seed: 71, skip: [[kx + 30, kx + 130]], ions: { out: [['k', kOutN], ['na', 6]], in: [['k', 10], ['prot', 3]] } });
  b += `<g data-part="push">${arrowFixed([kx + 44, my + 40], [kx + 44, my + 40 - len], { col: GREEN_LINE, w: 4, head: { l: 11, w: 6.5 } })}${label(kx + 54, Math.min(my + 40 - len + 14, my - 34), pushW, 'xs b green')}</g>`;
  // the scale widens past its usual -110 to -50 mV when a setting takes the resting potential beyond it
  const lo = Math.min(-110, Math.floor((m.vRest - 6) / 10) * 10), hi = Math.max(-50, Math.ceil((m.vRest + 6) / 10) * 10);
  b += ruler({ y: 316, lo, hi, v: m.vRest, ghost, threshold: m.threshold, words: arrowWords, wordsOp });
  words.forEach(([w, cls], i) => { b += `<g ${fade(wordsOp)}>${text(16, 26 + i * 24, w, cls, 'start')}</g>`; });
  return svg(`A strip of cell membrane: outside above with ${kOutN} potassium triangles, inside below crowded with potassium and negative proteins, a potassium leak channel with a green arrow for the push out, and ${nNa} sodium channels, ${shut} of them inactivated. Below, a voltage ruler: the resting potential at ${mv(m.vRest)} mV${ghost != null ? `, drawn over a dashed marker of normal at ${mv(ghost)} mV` : ''}, and the threshold at ${mv(m.threshold)} mV.`, b, { h });
}

/* ---------- What changes it ---------- */
function diffusionScene() {
  return {
    duration: 4600,
    stages: [[0, 'channels shut'], [0.12, 'potassium leaks out'], [0.58, 'at potassium\'s balance point'], [0.66, 'a sodium leak lifts it']],
    render(t) {
      if (!anchors) return noData(400);
      // first the potassium-only voltage settles at potassium's balance point; then the small sodium leak
      // (partly offset by the pump) lifts it to the resting potential
      const m = model(), open = ease.inOut(span(t, 0.08, 0.2)), k = span(t, 0.18, 0.58);
      const v1 = m.eK * (1 - Math.exp(-4.2 * k)) / (1 - Math.exp(-4.2));
      const v = lerp(v1, m.vRest, ease.inOut(span(t, 0.66, 0.88)));
      const top = 56, my = 150, bot = 242;
      const doors = [kDoor(110, my, { open, ion: open > 0.05 ? 'k' : null, phase: (t * 5) % 1 }), naDoor(240, my), kDoor(370, my, { open, ion: open > 0.05 ? 'k' : null, phase: (t * 5 + 0.5) % 1 })];
      const wOp = span(t, 0.35, 0.5), first = span(t, 0.45, 0.55) * (1 - span(t, 0.62, 0.66)), second = span(t, 0.7, 0.8);
      const keep = [[0, 6, 480, 50]];
      let b = strip({ top, my, bot, keep, charge: Math.abs(v) / 90, proteins: doors, seed: 81, ions: { out: [['na', 7], ['k', 3]], in: [['k', 11], ['prot', 3]] } });
      b += `<g ${fade(wOp)}>${text(16, 26, '↓ the inside turns negative', 'sm b blue', 'start')}</g>`;
      b += `<g ${fade(first)}>${text(16, 50, 'and holds at potassium\'s balance point', 'xs b', 'start')}</g>`;
      b += `<g ${fade(second)}>${text(16, 50, 'then a slight sodium leak lifts it a few mV', 'xs b amber', 'start')}</g>`;
      b += ruler({ y: 300, lo: -100, hi: 0, step: 20, v, ghost: 0, eK: k > 0.3 ? m.eK : null, words: '', wordsOp: wOp, restWord: 'inside' });
      const aria = `A strip of cell membrane with two potassium leak channels and a shut sodium channel, over a voltage ruler that starts at a dashed marker at 0 mV. The potassium channels open, potassium drifts out, plus marks gather outside the membrane and minus marks inside, and the marker slides down to potassium's balance point at ${mv(m.eK)} mV. Then a slight sodium leak lifts it a few millivolts, to the resting potential at ${mv(m.vRest)} mV.`;
      const rows = [['Voltage inside', v < -0.5 ? 'down' : 'same', `${mv(v)} mV`], ['Potassium balance point', 'same', `${mv(m.eK)} mV`]];
      return { svg: svg(aria, b, { h: 400 }), readout: readout(rows, 'Compared with channels shut') };
    },
  };
}
function potassiumScene(id, words, arrowWords) {
  return {
    duration: 3800,
    stages: [[0, 'potassium outside changes'], [0.45, 'the rest settles']],
    render(t) {
      if (!anchors) return noData(384);
      const n = model(), target = stateK(id), e = ease.inOut(span(t, 0.08, 0.8));
      const m = model({ kOut: lerp(anchors.kOut, target, e) });
      const pic = dash(m, { ghost: n.vRest, words, wordsOp: span(t, 0.55, 0.85), arrowWords });
      return { svg: pic, readout: readout(compareRows(m, n)) };
    },
  };
}
// The upstroke panel: rest, a nudge to threshold, then the rise, whose height and speed follow the ready channels.
function upstroke(m, n, e) {
  const x0 = 70, x1 = 456, vy = v => 400 - (v + 100) * 136 / 140, ux = u => x0 + u * (x1 - x0);
  // the rise's height and speed scale with the share of sodium channels ready, compared with normal
  const curve = (s, k) => {
    const peakV = s.vRest + k * (anchors.peak - n.vRest), rise = 0.04 / Math.max(0.2, k);
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      let v = s.vRest;
      if (u >= 0.25 && u < 0.35) v = lerp(s.vRest, s.threshold, ease.out((u - 0.25) / 0.1));
      else if (u >= 0.35 && u < 0.35 + rise) v = lerp(s.threshold, peakV, ease.inOut((u - 0.35) / rise));
      else if (u >= 0.35 + rise) v = lerp(peakV, s.vRest, ease.inOut(clamp((u - 0.35 - rise) / 0.45, 0, 1)));
      pts.push([ux(u), vy(v)]);
    }
    return { pts, peak: [ux(0.35 + rise), vy(peakV)] };
  };
  const g = curve(n, 1), live = curve(m, m.ready / n.ready);
  const dOf = pts => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}`;
  let b = `<path d="M${x0} 262 V404 H${x1}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
  b += `<path d="M${x0 - 5} ${f(vy(0))} H${x0}" stroke="${INK}" stroke-width="1.5"/>` + text(x0 - 9, vy(0) + 6, '0 mV', 'xs muted', 'end');
  b += `<g data-part="threshold"><path d="M${x0} ${f(vy(m.threshold))} H${x1}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>${text(x1, vy(m.threshold) - 8, 'threshold', 'xs b', 'end')}</g>`;
  b += `<path d="${dOf(g.pts)}" fill="none" stroke="${P.ui.ghost}" stroke-width="3" stroke-dasharray="6 5" data-ghost="normal"/>`;
  b += `<g data-part="upstroke"><path d="${dOf(live.pts)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`;
  if (Math.hypot(g.peak[0] - live.peak[0], g.peak[1] - live.peak[1]) > 18) b += `<g ${fade(e)}>${changeArrow([g.peak[0] + 4, g.peak[1] + 4], [live.peak[0] + 2, live.peak[1] - 8], 'upstroke weaker, slower', { cls: 'sm b blue' })}</g>`;
  return b;
}
function inactivationScene() {
  return {
    duration: 4200,
    stages: [[0, 'the rest rises and stays up'], [0.5, 'sodium channels stay plugged']],
    render(t) {
      if (!anchors) return noData(412);
      const n = model(), e = ease.inOut(span(t, 0.08, 0.8)), m = model({ kOut: lerp(anchors.kOut, stateK('severe'), e) });
      const top = 56, my = 156, bot = 222, N = 6, order = [1, 4, 2, 5, 0, 3], shut = Math.round(N * (1 - m.ready));
      const plugged = new Set(order.slice(0, shut));
      const chans = Array.from({ length: N }, (_, i) => ({ ...naDoor(58 + i * 73, my, { inactivated: plugged.has(i) ? 1 : 0 }), reach: 40 }));
      const kOutN = clamp(Math.round(4 * m.kOut / anchors.kOut), 1, 12), wOp = span(t, 0.55, 0.85);
      let b = strip({ top, my, bot, proteins: chans, keep: [[0, 6, 480, 50]], charge: Math.abs(m.vRest) / 90, seed: 91, ions: { out: [['k', kOutN], ['na', 4]], in: [['k', 6]] } });
      b += `<g ${fade(wOp)}>${text(16, 26, '↓ about half the sodium channels plugged', 'sm b blue', 'start')}${text(16, 50, `rest held at ${mv(m.vRest)} mV, near threshold`, 'xs b', 'start')}</g>`;
      b += text(464, 246, `${N - shut} of ${N} sodium channels ready`, 'xs b', 'end');
      b += upstroke(m, n, wOp);
      const fin = model({ kOut: stateK('severe') });
      const aria = `Severe hyperkalemia. A strip of membrane with six sodium channels: as potassium outside rises and the resting potential rises to ${mv(fin.vRest)} mV, the inactivation gates of about half of them swing shut. Below, a voltage trace drawn over a dashed normal one: the rest sits higher, and the upstroke after threshold rises less high and less steeply.`;
      return { svg: svg(aria, b, { h: 412 }), readout: readout(compareRows(m, n)) };
    },
  };
}

/* ---------- Scenes, one per step kind ---------- */
const need = (h, draw) => (...a) => anchors ? draw(...a) : noData(h);
const scenes = {
  ions: need(364, () => svg('A strip of cell membrane: fluid outside the cell above, crowded with amber sodium circles and grey chloride diamonds; the inside below, crowded with green potassium triangles and sage negative proteins. A key names each: potassium and sodium positive, chloride and protein negative.', ionsPicture(), { h: 364 })),
  gradient: { duration: 3600, loop: true, render: need(392, t => svg('A strip of membrane with the sodium-potassium pump rocking in it: sodium crowds the outside, potassium the inside. Below, bars on one scale: potassium inside long and outside very short; sodium outside long and inside short.', gradientPicture(t), { h: 392 })) },
  voltage: need(372, () => svg(`A strip of membrane with plus marks along its outside face and minus marks along its inside face. Below, a voltage ruler from -100 to 0 mV with a blue marker at the resting potential, ${mv(model().vRest)} mV.`, voltagePicture(), { h: 372 })),
  channels: { duration: 2600, loop: true, render: need(264, t => svg('A strip of membrane with two open potassium leak channels, potassium passing outward through them, and a shut sodium channel between them.', channelsPicture(t), { h: 264 })) },
  forces: need(300, () => svg('A potassium ion at the inner mouth of an open potassium channel. A green arrow points out: the push of crowding, with potassium crowded inside. A black arrow points in: the pull of the negative inside on the positive ion.', forcesPicture(), { h: 300 })),
  threshold: { duration: 5200, loop: true, render: need(372, t => svg(`A voltage trace over time. It sits at rest, ${mv(model().vRest)} mV; a small nudge lifts it and fades; a bigger nudge reaches the dashed threshold at ${mv(anchors.threshold)} mV and the voltage shoots up in an action potential, then falls back to rest.`, thresholdPicture(t), { h: 372 })) },
  gap: need(330, () => svg(`A voltage ruler with the resting potential at ${mv(model().vRest)} mV and a dashed threshold at ${mv(anchors.threshold)} mV. A blue bracket marks the gap between them, ${mv(model().gap)} mV: the nudge it takes to fire.`, gapPicture(), { h: 330 })),
  gates: () => svg('Three sodium channels in a membrane. Ready: closed, its inactivation gate hanging open below. Open: sodium passing in through the pore. Inactivated: the gate swung up into the pore, plugging it. An arrow back from inactivated to ready: a negative rest resets it.', gatesPicture(), { h: 370 }),
  bloodk: () => svg('Blood plasma with red cells in a capillary along the top, the fluid around the cell below it, and a cell below that. Potassium crosses the capillary wall both ways; a few potassium triangles sit in the plasma and the fluid, many inside the cell.', bloodkPicture(), { h: 364 }),
  diffusion: diffusionScene(),
  hyperkalemia: potassiumScene('hyperkalemia', [['↑ resting potential less negative', 'sm b blue'], ['closer to threshold: the gap shrinks', 'xs b']], 'rest rises'),
  hypokalemia: potassiumScene('hypokalemia', [['↓ resting potential more negative', 'sm b blue'], ['further from threshold: the gap grows', 'xs b']], 'rest falls'),
  inactivation: inactivationScene(),
};

/* ---------- Explore freely ---------- */
const ui = () => ({ preset: $('#preset'), k: $('#kout'), leak: $('#leak') });
const settings = () => { const u = ui(); return { kOut: +u.k.value, leak: +u.leak.value / 100 }; };
function renderExplore() {
  if (!anchors) return;
  const s = settings(), m = model(s), n = model();
  $('#explore-visual').innerHTML = dash(m, { ghost: n.vRest, nNa: 3 }) + readout(compareRows(m, n));
  $('#kout-out').textContent = `${s.kOut.toFixed(1)} mM`;
  $('#leak-out').textContent = `${(+ui().leak.value).toFixed(1)}%`;
  // Readiness first: once many sodium channels stay inactivated, a smaller gap no longer makes firing easier.
  const fire = m.vRest >= m.threshold ? 'The resting potential sits at or above threshold: in this model the cell cannot rest, and most sodium channels stay inactivated.'
    : m.ready < 0.65 ? `The rest sits near threshold, but only ${Math.round(m.ready * 100)}% of the sodium channels stand ready: the upstroke is weaker and slower, and the cell is harder, not easier, to fire.`
    : m.gap < 15 ? 'The gap to threshold is small and most sodium channels still stand ready: at first, a smaller nudge fires the cell.'
    : m.gap > 22 ? 'The gap to threshold is large: a bigger nudge is needed to fire.' : 'The gap to threshold is near normal.';
  const rows = [['Resting potential', `${mv(m.vRest)} mV`], ['Potassium balance point', `${mv(m.eK)} mV`], ['Sodium balance point', `+${mv(m.eNa)} mV`], ['Gap to threshold', `${mv(m.gap)} mV`], ['Sodium channels ready', `${Math.round(m.ready * 100)}%`]];
  $('#model-results').innerHTML = `<b>Plasma potassium ${s.kOut.toFixed(1)} mM; sodium leak ${(s.leak * 100).toFixed(1)}% of potassium's.</b> ` + rows.map(([k, v]) => `${k}: <span data-model="${k.toLowerCase().replace(/\s+/g, '-')}">${v}</span>`).join(' · ') + `. ${fire}`;
}
let selectedState = 'baseline';
function syncState() {
  if (!cv) return;
  const s = settings(), sameLeak = Math.abs(s.leak - anchors.leak) < 1e-9;
  const st = sameLeak ? cv.states.find(x => Math.abs(x.model.kOut - s.kOut) < 0.05) : null;
  selectedState = st ? st.id : 'custom';
  $('#clinical-state').value = selectedState;
  ui().preset.value = selectedState;
}
function applyState(id) {
  const st = cv?.states.find(s => s.id === id), u = ui();
  if (!st) return;
  u.k.value = st.model.kOut;
  u.leak.value = anchors.leak * 100;
  syncState(); update();
}
function wireExplore() {
  const u = ui();
  u.preset.addEventListener('change', () => { if (u.preset.value !== 'custom') applyState(u.preset.value); });
  u.k.addEventListener('input', () => { syncState(); update(); });
  u.leak.addEventListener('input', () => { syncState(); update(); });
  $('#reset').addEventListener('click', () => applyState('baseline'));
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
const rangeText = v => `${v.display} ${v.unit}`;
function scaleFor(v) {
  const lo = v.low ?? v.typical, hi = v.high ?? v.typical, sp = Math.abs(hi - lo) || Math.max(4, Math.abs(hi) * 0.15);
  const pad = v.low != null && v.high != null ? sp * 1.1 : sp * 1.2;
  return [Math.min(lo, hi) - pad, Math.max(lo, hi) + pad];
}
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
// Which side of the cited range the unrounded model value is on: -1 below, 0 inside, 1 above.
const sideOf = (v, x) => x < v.low ? -1 : x > v.high ? 1 : 0;
// The model reading, with more decimals when rounding would put it on the other side of a range limit
// (for example -84.87 would round to -85, which looks inside a -90 to -85 range).
function readingOf(v, x) {
  let d = v.decimals ?? 0;
  if (v.low != null && v.high != null) while (d < 3 && sideOf(v, +x.toFixed(d)) !== sideOf(v, x)) d++;
  return x.toFixed(d);
}
function statusFor(v, x) {
  if (v.low != null && v.high != null) { const s = sideOf(v, x); return s < 0 ? 'below the typical range' : s > 0 ? 'above the typical range' : 'inside the typical range'; }
  const rel = Math.abs((x - v.typical) / v.typical);
  return rel < 0.02 ? 'close to the typical value' : x > v.typical ? 'above the typical value' : 'below the typical value';
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
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
  if (!cv || !anchors) return;
  const s = settings(), m = model(s), n = model();
  $('#clinical-visual').innerHTML = dash(m, { ghost: n.vRest });
  $('#clinical-k').value = s.kOut;
  $('#clinical-k-label').textContent = `${s.kOut.toFixed(1)} mM`;
  const st = cv.states.find(x => x.id === selectedState);
  $('#state-summary').textContent = st ? `${st.label}. ${st.summary}` : `Custom settings: plasma potassium ${s.kOut.toFixed(1)} mM, sodium leak ${(s.leak * 100).toFixed(1)}% of potassium's (illustrative). Resting potential ${mv(m.vRest)} mV.`;
  $('#state-evidence').innerHTML = st ? st.evidence.map(q => `<p>${esc(q.text)} <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') + (st.unstatedNote ? `<p>${esc(st.unstatedNote)}</p>` : '') : '<p>Custom settings: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey];
    row.querySelector('.reading').textContent = `${readingOf(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    const toward = v.unit === 'mV' && d === 'up' ? ', toward zero (less negative)' : v.unit === 'mV' && d === 'down' ? ', more negative' : '';
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]}${toward} (${st.label.toLowerCase()})` : 'No direction stated by the cited sources';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

// Every number in the lesson's words comes from the model, so the words and the pictures always agree.
function fillNumbers() {
  const a = anchors, n = model(), hyper = model({ kOut: stateK('hyperkalemia') }), hypo = model({ kOut: stateK('hypokalemia') }), severe = model({ kOut: stateK('severe') });
  const v = {
    kRatio: Math.round(a.kIn / a.kOut), naRatio: Math.round(a.naOut / a.naIn), leakInv: Math.round(1 / a.leak),
    vRest: mv(n.vRest), eK: mv(n.eK), threshold: mv(a.threshold), gap: mv(n.gap),
    hyperRest: mv(hyper.vRest), hyperGap: mv(hyper.gap), hypoRest: mv(hypo.vRest), hypoGap: mv(hypo.gap),
    severeRest: mv(severe.vRest), slope: a.slope, naHalf: mv(a.naHalf),
  };
  for (const el of $$('[data-v]')) if (v[el.dataset.v] != null) el.textContent = String(v[el.dataset.v]);
}

/* ---------- Start ---------- */
async function load() {
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const id of ['kOut', 'threshold']) if (typeof data.modelBaseline?.[id] !== 'number') throw new Error(`no ${id}`);
    for (const id of ['kIn', 'naIn', 'naOut', 'leakRatio', 'slope', 'pumpShift', 'naHalf', 'naSlope', 'spikePeak', 'undershoot']) if (typeof data.modelParams?.[id]?.value !== 'number') throw new Error(`no ${id}`);
    for (const id of ['baseline', 'hypokalemia', 'hyperkalemia', 'severe']) if (!data.states?.some(s => s.id === id && typeof s.model?.kOut === 'number')) throw new Error(`no state ${id}`);
    cv = data;
    anchors = anchorsFrom(cv);
    fillNumbers();
    buildClinical();
    ui().k.value = anchors.kOut;
    ui().leak.value = anchors.leak * 100;
    wireExplore();
    syncState();
    update();
  } catch (err) {
    cv = null; anchors = null;
    for (const el of $$('[data-v]')) el.textContent = '(not loaded)';
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson's pictures and Explore freely need its model settings.`;
    $('#model-results').textContent = 'The model settings did not load. Reload the page to try again.';
  }
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
