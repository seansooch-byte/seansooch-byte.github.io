// Lesson 25: Diffusion, osmosis and IV fluids. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: sodium is the amber circle, potassium the green triangle (the main particles
//     outside and inside cells), water the pale drop, glucose the hexagon, urea a small grey molecule,
//     plasma proteins sage blobs. Kit blue is only ever a change: an arrow, or the words that name it.
//   - The one-cell pictures (steps 1, 2, 6 to 9) show one cell in fluid. Its size moves with the water
//     that crosses its membrane; a dashed outline keeps its normal size.
//   - The body pictures (steps 10, 12 to 17, both reference tabs) are drawn from model.js: the cell, the
//     space between cells and the plasma take the model's sizes, exaggerated so the change can be seen,
//     over a dashed ghost of normal. Each change first spreads through the fluid outside cells, then water
//     crosses cell membranes until every compartment holds the same concentration.
//   - No reference number lives in this file. The body-water split and the marker baselines come from
//     clinical-values.json; if it cannot load, the pictures run on a stated illustrative stand-in.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, fill, mix, blob, artGhost, arrowFixed, leader } from '/lab/kit/art/core.js';
import { cellBody, bilayer, membraneBand, channel } from '/lab/kit/art/cell.js';
import { ion, water, glucose } from '/lab/kit/art/molecules.js';
import { FLUIDS, MAX_SHARE, anchorsFrom, solve, settingsFor } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink;

/* ---------- Glyphs (each drawn once at the origin, then moved with translate) ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
const NA = ion('na').svg;
const K = ion('k', { s: 0.82 }).svg;
const DROP = water({ s: 1.25 }).svg;
const SUGAR = glucose().svg;
// Urea, CO(NH2)2: a carbon with its oxygen and two nitrogens. Lesson-local (the library has no urea yet).
const N_TONE = mix(P.nucleus.base, P.ui.white, 0.3);
const sphere = (x, y, r, base, line) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${base}" stroke="${line}" stroke-width="1.1"/><circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.38)}" r="${f(r * 0.3)}" fill="${P.ui.white}" fill-opacity=".45"/>`;
const UREA = `<g data-part="urea">${sphere(-5.6, 3.6, 4, N_TONE, P.nucleus.line)}${sphere(5.6, 3.6, 4, N_TONE, P.nucleus.line)}${sphere(0, -6.4, 4, P.oxygen.base, P.oxygen.line)}${sphere(0, 0.8, 4.4, P.carbon.base, P.carbon.line)}</g>`;
// A plasma protein (albumin, or a colloid's large molecule): a folded globule in the protein material.
const PROTEIN = [1, 2, 3].map(seed => `<g data-part="protein"><path d="${blob(0, 0, 8.5, { lobes: 3, wobble: 0.1, seed })}" fill="${fill('protein')}" stroke="${P.protein.line}" stroke-width="1.4"/></g>`);
// A red cell in a plasma lumen, face on (the lumen-scale cell of vessels.js, drawn here because the
// lumen is drawn as plasma).
const RBC = `<g data-part="rbc"><ellipse rx="10" ry="6" fill="${P.rbc.rim}" stroke="${P.rbc.line}" stroke-width="1.1"/><ellipse cx="-.6" cy="-.5" rx="5" ry="2.7" fill="${P.rbc.base}"/></g>`;

/* ---------- Small helpers ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Points spread evenly at random: each new point keeps a minimum distance from the others.
function scatter(seed, n, w, h, minD, accept = () => true) {
  const r = rng(seed), pts = [];
  for (let tries = 0; pts.length < n && tries < n * 400; tries++) {
    const p = { x: r() * w, y: r() * h };
    if (!accept(p)) continue;
    if (pts.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD * minD)) pts.push(p);
  }
  return pts;
}
// Distance from point p to the segment a-z.
function segDist(p, a, z) {
  const dx = z[0] - a[0], dy = z[1] - a[1], k = clamp(((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(p.x - a[0] - k * dx, p.y - a[1] - k * dy);
}
const inBox = (x, y, [bx, by, bw, bh], pad = 0) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;
const rrect = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`; };
const circleD = (x, y, r) => `M${f(x - r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)} Z`;
const ECF_LINE = mix(P.space.ecf, INK, 0.35);
const fluidBox = (x, y, w, h, extra = '') => `<path d="${rrect(x, y, w, h, 14)}" fill="${P.space.ecf}" stroke="${ECF_LINE}" stroke-width="1.25" ${extra}/>`;
const arrowB = (a, b, w = 3.5, op = 1) => arrowFixed(a, b, { col: BLUE, w, head: { l: 10, w: 6 }, attrs: op < 1 ? ` opacity="${f(op)}"` : '' });
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
// A living cell: cytoplasm, nucleus and a membrane band (cell.js cellBody). Its part is named by the caller.
// No organelles: the particles inside (potassium, urea) are what these pictures are about, and they would
// land on the ER and mitochondria.
const cellArt = (cx, cy, R, part = 'cell') => cellBody({ shape: 'round', w: 2 * R, h: 2 * R * 0.95, x: cx, y: cy, membrane: 'band', organelles: false, parts: { cell: part } }).svg;

/* ---------- One cell in a fluid (steps 1, 2, 6, 7, 8, 9) ---------- */
// Panel 16..464 by 64..352; the cell sits at its centre and changes size with the water that crosses it.
const ONE = { cx: 240, cy: 208, R0: 80, box: [16, 64, 448, 288] };
const OUT_POOL = scatter(11, 160, 424, 264, 26).map(p => ({ x: 28 + p.x, y: 76 + p.y }));
const IN_POOL = scatter(5, 40, 2, 2, 0.34, p => { const r = Math.hypot(p.x - 1, p.y - 1); return r > 0.6 && r < 0.84; }).map(p => ({ x: p.x - 1, y: p.y - 1 }));
const UREA_OUT = scatter(17, 24, 424, 264, 34).map(p => ({ x: 28 + p.x, y: 76 + p.y }));
// where the urea that crosses settles inside the cell: clear of the nucleus and of the potassium (IN_POOL)
const UREA_IN = [[0.07, -0.76], [-0.73, -0.2], [0.73, -0.2]];
const K_IN = 7;   // about as crowded inside as sodium is outside, so an isotonic cell looks matched
// opt: outside (relative concentration of sodium outside), size (cell volume, 1 = normal), arrows (+1 water in,
// -1 water out, 2 both ways), ghost, keep (label boxes the particles avoid), urea (0..1: how far the urea added
// outside has spread in; null for none).
function oneCell({ outside = 1, size = 1, arrows = 0, arrowOp = 1, ghost = false, keep = [], urea = null, labels = true } = {}) {
  const { cx, cy, R0, box } = ONE, R = R0 * Math.sqrt(size);
  let b = fluidBox(...box, 'data-part="ecf"');
  // the water arrows, as segments, so particles keep clear of them (and of the ghost ring)
  const rays = [];
  if (arrows) for (const deg of [35, 145, 215, 325]) {
    const far = R + 46, near = R + 10, ray = (d, r1, r2) => { const a = (deg + d) * Math.PI / 180; return [[cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)], [cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)]]; };
    if (arrows === 2) rays.push(ray(-8, far, near), ray(8, near, far));
    else rays.push(arrows > 0 ? ray(0, far, near) : ray(0, near, far));
  }
  const offRay = p => rays.every(([a, z]) => segDist(p, a, z) > 14);
  const r = p => Math.hypot(p.x - cx, p.y - cy);
  const clearOf = p => r(p) > R + 13 && (!ghost || Math.abs(r(p) - R0) > 11) && offRay(p) && !keep.some(k => inBox(p.x, p.y, k, 9));
  const nOut = Math.round(34 * outside), placed = [];
  const free = p => clearOf(p) && placed.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 17);
  // urea added outside: the ones nearest the cell travel in as it spreads
  const ureaOut = urea == null ? [] : UREA_OUT.filter(p => clearOf(p)).slice(0, 14).sort((a, c) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(c.x - cx, c.y - cy));
  ureaOut.forEach(p => placed.push(p));
  let shown = 0, dots = '';
  for (const p of OUT_POOL) { if (shown >= nOut) break; if (!free(p)) continue; dots += at(NA, p.x, p.y); placed.push(p); shown++; }
  b += dots;
  b += ureaOut.slice(UREA_IN.length).map(p => at(UREA, p.x, p.y)).join('');
  b += cellArt(cx, cy, R, 'icf');
  // potassium rings the nucleus (about half the radius); once a cell swells past its ghost ring it stays
  // between the nucleus and that ring, so neither line runs through it
  const kr = rn => R <= R0 ? rn * R : lerp(0.51 * R + 9, R0 - 10, clamp((rn - 0.6) / 0.24, 0, 1));
  b += IN_POOL.slice(0, K_IN).map(p => { const rn = Math.hypot(p.x, p.y), k = kr(rn) / rn; return at(K, cx + p.x * k, cy + p.y * k * 0.95); }).join('');
  if (urea != null) b += ureaOut.slice(0, UREA_IN.length).map((p, i) => { const [ux, uy] = UREA_IN[i], e = clamp(urea, 0, 1); return at(UREA, lerp(p.x, cx + ux * R, e), lerp(p.y, cy + uy * R, e)); }).join('');
  if (ghost) b += artGhost(circleD(cx, cy, R0));
  if (rays.length) b += `<g data-part="water-flow">${rays.map(([a, z]) => arrowB(a, z, 3.5, arrowOp)).join('')}</g>`;
  return b;
}

function cellStill() {
  const keep = [[28, 76, 220, 26], [300, 76, 160, 26], [28, 316, 190, 26]];
  let b = oneCell({ keep });
  const { cx, cy, R0 } = ONE;
  b += text(36, 96, 'fluid outside the cell', 'sm b', 'start');
  b += text(452, 96, 'cell membrane', 'sm b', 'end') + leader([380, 104], [cx + R0 * 0.7, cy - R0 * 0.67]);
  b += text(36, 336, 'fluid inside the cell', 'sm b', 'start') + leader([150, 322], [cx - R0 * 0.48, cy + R0 * 0.32]);
  b += text(240, 44, 'one cell, bathed in fluid', 'sm b');
  return b;
}
function soluteStill() {
  let b = oneCell();
  b += at(NA, 30, 30) + text(44, 36, 'sodium: the main particle outside', 'xs b amber', 'start');
  b += at(K, 30, 362);
  b += text(44, 372, 'potassium: the main particle inside', 'xs b green', 'start');
  return b;
}

// Tonicity steps: the fluid outside is matched, more dilute or more concentrated than the cell.
function tonicScene(kind) {
  const C = {
    iso: { outside: 1, size: 1, arrows: 2, head: 'outside matches inside', verdict: 'water in = water out: same size' },
    hypo: { outside: 0.45, size: 1.55, arrows: 1, head: 'outside: fewer particles than inside', verdict: 'water moves in: the cell swells' },
    hyper: { outside: 1.9, size: 0.55, arrows: -1, head: 'outside: more particles than inside', verdict: 'water moves out: the cell shrinks' },
  }[kind];
  const draw = t => {
    const e = ease.inOut(span(t, 0.12, 0.9)), size = lerp(1, C.size, e);
    const pulse = kind === 'iso' ? 1 : 0.35 + 0.65 * Math.sin(Math.PI / 2 * span(t, 0.05, 0.5));
    let b = oneCell({ outside: C.outside, size, arrows: C.arrows, arrowOp: pulse, ghost: true });
    b += text(240, 44, C.head, 'sm b');
    b += `<g ${kind === 'iso' ? '' : fade(span(t, 0.55, 0.85))}>${text(240, 384, C.verdict, 'sm b blue')}</g>`;
    return b;
  };
  const label = {
    iso: 'A cell in fluid with the same crowding of sodium outside as of particles inside. Paired blue arrows show water moving in and out equally; the cell stays on the dashed outline of its normal size.',
    hypo: 'A cell in fluid with fewer sodium particles outside. Blue arrows point inward as water enters, and the cell swells past the dashed outline of its normal size.',
    hyper: 'A cell in fluid crowded with sodium outside. Blue arrows point outward as water leaves, and the cell shrinks inside the dashed outline of its normal size.',
  }[kind];
  if (kind === 'iso') return () => svg(label, draw(1), { h: 398 });
  return { duration: 3000, render: t => svg(label, draw(t), { h: 398 }) };
}

// Osmolality and tonicity: urea added outside spreads into the cell, so no water moves.
function effectiveScene() {
  return {
    duration: 3600,
    stages: [[0, 'urea added outside'], [0.25, 'urea crosses'], [0.85, 'evened out']],
    render(t) {
      const e = ease.inOut(span(t, 0.25, 0.85));
      let b = oneCell({ urea: e, ghost: true });
      b += text(240, 44, 'urea added outside the cell', 'sm b');
      b += `<g ${fade(span(t, 0.7, 0.92))}>${text(240, 384, 'urea evens out: the cell keeps its size', 'sm b blue')}</g>`;
      b += at(UREA, 30, 404) + text(44, 410, 'urea: crosses', 'xs b', 'start');
      b += at(NA, 262, 404) + text(276, 410, 'sodium: stays out', 'xs b amber', 'start');
      return svg('A cell in fluid. Small grey urea molecules are added outside; over time some cross the membrane into the cell until urea is as crowded inside as outside. Sodium stays outside. The cell stays on the dashed outline of its normal size: urea moves no water.', b, { h: 420 });
    },
  };
}

/* ---------- Diffusion: a crowd spreads out (step 3) ---------- */
const DIF = { x0: 16, y0: 56, w: 448, h: 240 };
// Start and end are paired in order across the box, so the crowd spreads as one front, not a shuffle.
const DIF_START = scatter(21, 40, 92, 214, 19).map(p => ({ x: DIF.x0 + 16 + p.x, y: DIF.y0 + 13 + p.y })).sort((a, b) => a.x - b.x);
// The end is evenly mixed: four particles in each tenth of the box, jittered so it does not read as a grid.
const DIF_END = (() => { const r = rng(22); return Array.from({ length: 40 }, (_, i) => ({ x: DIF.x0 + DIF.w / 10 * (Math.floor(i / 4) + 0.5) + (r() - 0.5) * 16, y: DIF.y0 + 13 + 214 / 4 * (i % 4 + 0.5) + (r() - 0.5) * 20 })); })().sort((a, b) => a.x - b.x);
function diffusionPicture(t) {
  const e = ease.inOut(span(t, 0.08, 0.92));
  let b = fluidBox(DIF.x0, DIF.y0, DIF.w, DIF.h);
  b += artGhost(rrect(DIF.x0 + 6, DIF.y0 + 6, 116, DIF.h - 12, 10));
  const xs = [];
  DIF_START.forEach((a, i) => {
    const z = DIF_END[i % DIF_END.length], wob = Math.sin(t * 40 + i * 1.7) * 3 * (1 - e * 0.4);
    const x = lerp(a.x, z.x, e) + wob, y = lerp(a.y, z.y, e) + Math.cos(t * 37 + i) * 3;
    xs.push(x);
    b += at(SUGAR, x, y);
  });
  // How crowded each tenth of the box is, from where the particles are now.
  const bins = Array(10).fill(0);
  for (const x of xs) bins[clamp(Math.floor((x - DIF.x0) / DIF.w * 10), 0, 9)]++;
  const top = Math.max(...bins.map(n => n / xs.length * 10), 1);
  let strip = '';
  bins.forEach((n, i) => {
    const h = 34 * (n / xs.length * 10) / Math.max(top, 3.6);
    strip += `<rect x="${f(DIF.x0 + 6 + i * 44)}" y="${f(352 - h)}" width="40" height="${f(Math.max(1.5, h))}" fill="${P.glucose.base}" stroke="${P.glucose.line}" stroke-width="1.1"/>`;
  });
  b += `<g data-part="gradient">${strip}<path d="M${DIF.x0} 352.5 H${DIF.x0 + DIF.w}" stroke="${INK}" stroke-width="1.25"/></g>`;
  b += text(DIF.x0, 380, 'how crowded, along the box', 'xs muted', 'start');
  b += text(DIF.x0 + 4, 40, 'crowded', `sm b${e < 0.5 ? '' : ' muted'}`, 'start');
  b += text(DIF.x0 + DIF.w - 4, 40, 'evenly spread', `sm b${e >= 0.5 ? '' : ' muted'}`, 'end');
  b += arrowFixed([120, 34], [318, 34], { col: INK, w: 2 });
  return b;
}

/* ---------- A membrane that chooses (step 4) ---------- */
const MEM = { x0: 16, y0: 56, w: 448, h: 270, mx: 240, gaps: [136, 250] };
const MEM_WATER = scatter(31, 40, 424, 250, 26).map(p => ({ x: 28 + p.x, y: 66 + p.y })).filter(p => Math.abs(p.x - MEM.mx) > 26 && !MEM.gaps.some(g => Math.abs(p.y - g) < 20 && Math.abs(p.x - MEM.mx) < 84));
const MEM_NA = scatter(32, 9, 170, 220, 44).map(p => ({ x: 34 + p.x, y: 80 + p.y }));
function membranePicture(t) {
  const { x0, y0, w, h, mx, gaps } = MEM;
  let b = fluidBox(x0, y0, w, h);
  for (const p of MEM_WATER) b += at(DROP, p.x, p.y);
  for (const p of MEM_NA) b += at(NA, p.x, p.y);
  const clear = gaps.map(g => [g - y0, 26]);
  b += bilayer({ d: `M${mx} ${y0} L${mx} ${y0 + h}`, clear }).svg;
  b += gaps.map(g => channel({ kind: 'generic', open: 1, x: mx, y: g, rot: 90, s: 0.7, parts: { channel: 'pore' } }).svg).join('');
  // water slips through each channel, one way then the other, slowing as it passes through the pore
  const k = (t * 2) % 1;
  const along = k < 0.35 ? lerp(-70, -9, ease.out(k / 0.35)) : k < 0.65 ? lerp(-9, 9, (k - 0.35) / 0.3) : lerp(9, 70, ((k - 0.65) / 0.35) ** 2);
  gaps.forEach((g, i) => { b += at(DROP, mx + (i ? -along : along), g); });
  // a sodium particle tries to cross and is turned back
  const bump = Math.sin(Math.PI * k), yb = 194;
  b += at(NA, mx - 70 + 50 * bump, yb);
  b += `<g ${fade(bump * 1.4 - 0.3)}><path d="M${mx - 14} ${yb - 8} l12 12 m0 -12 l-12 12" stroke="${P.ui.red}" stroke-width="3" stroke-linecap="round"/></g>`;
  b += text(x0, 40, 'water crosses', 'sm b', 'start') + at(DROP, 154, 33);
  b += text(x0 + w, 40, 'sodium is held back', 'sm b amber', 'end');
  b += text(240, 356, 'cell membrane, with water channels', 'xs muted');
  return b;
}

/* ---------- Osmosis: a tank split by a membrane (step 5) ---------- */
const TANK = { L: 56, R: 424, mx: 240, bottom: 300, top: 62, level: 186 };
const TANK_NA = scatter(41, 13, 1, 1, 0.22).map(p => ({ u: 0.08 + p.x * 0.84, v: 0.08 + p.y * 0.84 }));
const LIQUID = mix(P.water.base, P.ui.white, 0.55);
function osmosisPicture(t) {
  const { L, R, mx, bottom, top, level } = TANK, e = ease.inOut(span(t, 0.1, 0.9));
  const ly = lerp(level, level + 42, e), ry = lerp(level, level - 46, e);
  let b = `<rect x="${L}" y="${f(ly)}" width="${mx - L - 4}" height="${f(bottom - ly)}" fill="${LIQUID}"/>`;
  b += `<rect x="${mx + 4}" y="${f(ry)}" width="${R - mx - 4}" height="${f(bottom - ry)}" fill="${LIQUID}"/>`;
  for (const s of TANK_NA) b += at(NA, mx + 14 + s.u * (R - mx - 28), ry + 12 + s.v * (bottom - ry - 24));
  b += `<path d="M${L} ${top} V${bottom} H${R} V${top}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  b += membraneBand({ d: `M${mx} ${top + 14} L${mx} ${bottom}`, w: 8 }).svg;
  b += artGhost(`M${L} ${level} H${R}`);
  const op = 0.35 + 0.65 * Math.sin(Math.PI / 2 * span(t, 0.05, 0.5));
  b += `<g data-part="water-flow">${arrowB([mx - 54, 262], [mx + 54, 262], 4, op)}${at(DROP, mx - 30, 244, ` opacity="${f(op)}"`)}</g>`;
  b += text(mx - 64, 268, 'water moves', 'xs b blue', 'end');
  b += text((L + mx) / 2, 326, 'plain water', 'sm b');
  b += text((mx + R) / 2, 326, 'salty water', 'sm b');
  b += text(mx, 48, 'membrane: water only', 'xs muted');
  b += `<g ${fade(span(t, 0.55, 0.9))}>${text(R - 8, 100, 'level rises until its', 'xs b', 'end')}${text(R - 8, 120, 'weight pushes back', 'xs b', 'end')}</g>`;
  b += text(L + 8, level - 8, 'start level', 'xs muted', 'start');
  return b;
}

/* ---------- The capillary wall holds big molecules (step 11) ---------- */
const WALL_Y = 166;
const WALL_NA_TOP = scatter(51, 12, 420, 70, 34).map(p => ({ x: 30 + p.x, y: 84 + p.y }));
const WALL_NA_BOT = scatter(52, 12, 420, 70, 34).map(p => ({ x: 30 + p.x, y: 196 + p.y }));
const WALL_PROT = [[70, 290], [150, 250], [228, 296], [300, 244], [380, 286], [440, 240]];
const WALL_ARROWS = [106, 362];
function wallPicture(t) {
  let b = fluidBox(16, 56, 448, WALL_Y - 56 + 6, 'data-part="isf"');
  b += `<path d="${rrect(16, WALL_Y, 448, 170, 14)}" fill="${P.plasma.base}" stroke="${P.plasma.line}" stroke-width="1.25" data-part="plasma"/>`;
  // the wall: endothelial cells with narrow gaps between them
  const gapX = [];
  let wall = '';
  for (let x = 16; x < 464; x += 64) {
    const w = Math.min(54, 464 - x);
    wall += `<path d="${rrect(x, WALL_Y - 6, w, 12, 5)}" fill="${P.capillary.base}" stroke="${P.capillary.line}" stroke-width="1.4"/>`;
    if (x + 59 < 464) gapX.push(x + 59);
  }
  b += `<g data-part="wall">${wall}</g>`;
  for (const p of [...WALL_NA_TOP, ...WALL_NA_BOT]) if (!WALL_ARROWS.some(x => Math.abs(p.x - x) < 16) && !WALL_PROT.some(([x, y]) => Math.hypot(p.x - x, p.y - y) < 24)) b += at(NA, p.x, p.y);
  b += WALL_PROT.map(([x, y], i) => at(PROTEIN[i % 3], x, y)).join('');
  // sodium slips through the gaps both ways
  const k = (t * 1.5) % 1;
  gapX.slice(1, 6).forEach((x, i) => {
    const e = ease.inOut(clamp(k * 1.25 - i * 0.05, 0, 1)), dir = i % 2 ? 1 : -1;
    b += at(NA, x, dir > 0 ? lerp(WALL_Y - 34, WALL_Y + 34, e) : lerp(WALL_Y + 34, WALL_Y - 34, e));
  });
  const op = 0.45 + 0.55 * Math.sin(Math.PI * ((t * 1.5) % 1));
  b += `<g data-part="water-pull">${WALL_ARROWS.map(x => arrowB([x, 92], [x, WALL_Y + 34], 4, op)).join('')}</g>`;
  b += text(28, 80, 'between cells', 'sm b', 'start');
  b += text(452, 80, 'water pulled back in', 'sm b blue', 'end');
  b += text(28, 360, 'plasma, inside a capillary', 'sm b', 'start');
  b += at(PROTEIN[0], 330, 354) + text(346, 360, 'protein stays', 'xs b', 'start');
  return b;
}

/* ---------- The body's three compartments (steps 10, 12 to 17, Explore, Clinical values) ---------- */
// fr: { cell, isf, plasma, conc, protein, sugar, uptake, arrow, spread }, sizes as ratios to normal.
// The capillary (centre VC) runs along the bottom edge of the space between cells (TB), as it runs through it in the body.
const B = { TB: 262, W0: 300, H0: 150, CX: 240, R0: 44, VC: 272, VH0: 24, VX: 44, VW: 420 };
B.CY = B.TB - B.H0 / 2;
const AMP = 2.4;        // volume changes drawn larger than life, so they can be seen
const AMP_CONC = 1.5;   // and crowding changes, a little less
const NORMAL = { cell: 1, isf: 1, plasma: 1, conc: 1, protein: 1, sugar: 0, uptake: 0, arrow: 0, spread: 0 };
const ISF_POOL = scatter(61, 220, 1, 1, 0.052).map(p => ({ u: p.x, v: p.y }));
const VES_POOL = scatter(62, 90, 1, 1, 0.045).map(p => ({ u: p.x, v: p.y }));
const SUGAR_POOL = scatter(64, 14, 1, 1, 0.2).map((p, i) => ({ u: 0.06 + p.x * 0.88, v: 0.1 + p.y * 0.8, a: i * 2.4 }));
const RBC_AT = [0.14, 0.52, 0.86];
// [position along the vessel, lane: 0 centre, -1 top, +1 bottom]
const PROT_AT = [[0.33, 0], [0.69, 0], [0.97, 0], [0.24, -1], [0.62, 1], [0.42, 1], [0.8, -1], [0.05, 1], [0.9, 1], [0.5, -1]];
function drawn(fr) {
  const isfD = clamp(fr.isf, 0.55, 1.8), s = Math.sqrt(isfD), W = B.W0 * s, H = B.H0 * s;
  const cellD = clamp(1 + (fr.cell - 1) * AMP, 0.4, 1.9), R = B.R0 * Math.sqrt(cellD);
  const plD = clamp(fr.plasma, 0.5, 2.6), vh = B.VH0 * plD;
  return { W, H, tx: B.CX - W / 2, ty: B.TB - H, R, vh, vy: B.VC - vh / 2, plD, concD: Math.max(0.25, 1 + (fr.conc - 1) * AMP_CONC) };
}
function bodyPicture(fr, { drip = true, ghost = true, bar = null, words = [], wordsOp = 1, routes = false } = {}) {
  const d = drawn(fr), { W, H, tx, ty, R, vh, vy, plD, concD } = d, { CX, CY, TB, VX, VW, VC } = B;
  let b = '';
  b += fluidBox(tx, ty, W, H, 'data-part="isf"');
  // 'between cells' sits inside both the live box and the ghost, so no outline runs through it
  const gx0 = B.CX - B.W0 / 2, gy0 = TB - B.H0;
  const lx = (ghost ? Math.max(tx, gx0) : tx) + 10, ly = (ghost ? Math.max(ty, gy0) : ty) + 22;
  // particles between cells: as many as the space and the concentration hold, clear of the cell, the labels,
  // the ghost's top edge and the capillary
  const keep = [[lx - 6, ly - 18, 128, 26], [CX + Math.max(R, ghost ? B.R0 : 0) + 4, CY - 14, 56, 26]];
  // the ghost's top and sides; it has no bottom edge, which lies under the capillary
  const gBot = Math.min(TB, vy) - 3;
  if (ghost) keep.push([gx0, gy0 - 4, B.W0, 8], [gx0 - 4, gy0, 8, gBot - gy0], [gx0 + B.W0 - 4, gy0, 8, gBot - gy0]);
  // and the arrows drawn over this space
  const gx = gx0 + B.W0, nx = tx + W, ny = ty, grew = ghost && Math.hypot(nx - gx, ny - gy0) > 14;
  const boxArrow = [[gx + (nx > gx ? 4 : -4), gy0 + (ny < gy0 ? -4 : 4)], [nx + (nx > gx ? 2 : -2), ny + (ny < gy0 ? -2 : 2)]];
  const spreadArrows = [120, 360].map(x => [[x, vy - 3], [x, TB - 56]]);
  const segs = [...(ghost ? spreadArrows : []), ...(grew ? [boxArrow] : []), ...(routes ? ROUTES.segs : [])];
  const area = W * H - Math.PI * R * R, area0 = B.W0 * B.H0 - Math.PI * B.R0 * B.R0;
  const want = Math.round(30 * (area / area0) * concD), placed = [];
  const roomy = (x, y, gap = 16) => placed.every(([px, py]) => Math.hypot(px - x, py - y) > gap);
  let n = 0, dots = '';
  for (const p of ISF_POOL) {
    if (n >= want) break;
    const x = tx + 10 + p.u * (W - 20), y = ty + 10 + p.v * (H - 20);
    if (Math.hypot(x - CX, y - CY) < R + 12 || y > vy - 10 || keep.some(k => inBox(x, y, k, 8)) || segs.some(([a, z]) => segDist({ x, y }, a, z) < 13) || !roomy(x, y)) continue;
    dots += at(NA, x, y); placed.push([x, y]); n++;
  }
  b += dots;
  // sugar: arrives outside cells, then cells take it up and use it
  if (fr.sugar > 0.01) {
    const k = ease.inOut(clamp(fr.uptake, 0, 1));
    for (const p of SUGAR_POOL) {
      let sx = tx + 14 + p.u * (W - 28), sy = ty + 14 + p.v * (H - 28);
      if (Math.hypot(sx - CX, sy - CY) < R + 14) { const a = Math.atan2(sy - CY, sx - CX); sx = CX + Math.cos(a) * (R + 16); sy = CY + Math.sin(a) * (R + 16); }
      const ix = CX + Math.cos(p.a) * R * 0.55, iy = CY + Math.sin(p.a) * R * 0.55;
      b += at(SUGAR, lerp(sx, ix, k), lerp(sy, iy, k), ` opacity="${f(fr.sugar * (1 - k))}"`);
    }
  }
  // the vessel: plasma in a capillary, with red cells, proteins and sodium
  let ves = `<path d="${rrect(VX, vy, VW, vh, vh / 2)}" fill="${P.plasma.base}" stroke="${P.capillary.line}" stroke-width="5"/><path d="${rrect(VX, vy, VW, vh, vh / 2)}" fill="none" stroke="${P.capillary.base}" stroke-width="2.6"/>`;
  // the vessel's normal outline sits under its contents, so red cells, proteins and sodium are never cut by it
  if (ghost) ves += `<g data-ghost="normal">${artGhost(rrect(VX, VC - B.VH0 / 2, VW, B.VH0, B.VH0 / 2))}</g>`;
  const items = routes ? ROUTES.lumen.map(([x, y]) => [x, y, 10]) : [];
  for (const u of RBC_AT) { const x = VX + 20 + u * (VW - 40); items.push([x, VC, 16]); ves += at(RBC, x, VC); }
  // proteins: three on the centre line between the red cells; a colloid's extra ones in lanes above and below
  const nProt = clamp(Math.round(3 * fr.protein), 0, PROT_AT.length);
  for (let i = 0; i < nProt; i++) {
    const [u, lane] = PROT_AT[i], x = VX + 20 + u * (VW - 40), y = VC + lane * Math.max(0, vh / 2 - 12);
    items.push([x, y, 14]); ves += at(PROTEIN[i % 3], x, y);
  }
  const wantV = Math.round(7 * plD * concD);
  let nv = 0;
  for (const p of VES_POOL) {
    if (nv >= wantV) break;
    const x = VX + 18 + p.u * (VW - 36), y = vy + 9 + p.v * Math.max(0, vh - 18);
    if (items.some(([ix, iy, r]) => Math.hypot(ix - x, iy - y) < r + 4)) continue;
    ves += at(NA, x, y); items.push([x, y, 12]); nv++;
  }
  b += `<g data-part="plasma">${ves}</g>`;
  b += cellArt(CX, CY, R, 'icf');
  // potassium rings the nucleus; in a swollen cell it stays between the nucleus (about half the radius) and the
  // ghost ring, so neither line runs through it
  const rk = R <= B.R0 ? 0.74 * R : (0.5 * R + B.R0) / 2;
  b += Array.from({ length: 6 }, (_, i) => { const a = i / 6 * 2 * Math.PI + 0.4; return at(K, CX + Math.cos(a) * rk, CY + Math.sin(a) * rk * 0.95); }).join('');
  if (ghost) {
    const gr = 14, gx1 = gx0 + B.W0;
    const open = `M${f(gx0)} ${f(gBot)} V${f(gy0 + gr)} A${gr} ${gr} 0 0 1 ${f(gx0 + gr)} ${f(gy0)} H${f(gx1 - gr)} A${gr} ${gr} 0 0 1 ${f(gx1)} ${f(gy0 + gr)} V${f(gBot)}`;
    b += `<g data-ghost="normal">${artGhost(open)}${artGhost(circleD(CX, CY, B.R0))}</g>`;
  }
  // water crossing cell membranes
  if (Math.abs(fr.arrow) > 0.02) {
    const rays = [35, 145, 215, 325].map(deg => {
      const a = deg * Math.PI / 180, far = R + 34, near = R + 7, p = r => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
      return fr.arrow > 0 ? arrowB(p(far), p(near), 3.5) : arrowB(p(near), p(far), 3.5);
    });
    b += `<g data-part="water-flow" ${fade(Math.abs(fr.arrow))}>${rays.join('')}</g>`;
  }
  // fluid leaving the vessel for the space between cells
  if (fr.spread > 0.02) b += `<g ${fade(fr.spread)}>${spreadArrows.map(([a, z]) => arrowB(a, z, 3.5)).join('')}</g>`;
  // what grew or shrank, named by a blue arrow from the normal outline to the new one
  if (ghost) {
    if (grew) b += `<g ${fade(wordsOp)}>${arrowB(...boxArrow, 3)}</g>`;
    const gb = VC + B.VH0 / 2, nb = vy + vh, xv = VX + VW - 36;
    if (Math.abs(nb - gb) > 7) b += `<g ${fade(wordsOp)}>${arrowB([xv, gb + 10], [xv, nb + 12], 3)}</g>`;
  }
  if (drip) b += arrowFixed([2, VC], [VX - 4, VC], { col: INK, w: 3 }) + text(4, VC - 14, 'IV', 'xs b', 'start');
  if (routes) b += routeArrows();
  // labels
  b += text(lx, ly, 'between cells', 'xs b', 'start');
  if (R > 30) b += text(CX + Math.max(R, ghost ? B.R0 : 0) + 10, CY + 6, 'a cell', 'xs b', 'start');
  b += text(VX + 4, Math.max(vy + vh, VC + B.VH0 / 2) + 24, 'plasma, in a capillary', 'xs b', 'start');
  words.forEach(([w, cls], i) => { b += `<g ${fade(wordsOp)}>${text(16, 24 + i * 24, w, cls, 'start')}</g>`; });
  if (bar) b += shareBar(bar);
  return b;
}
const BODY_H = 338;
// Where each part of a drip goes (step 12): sodium stays outside cells, protein stays in the vessel, water goes
// everywhere. Drawn on the normal picture; segs and lumen are the stretches the particles keep clear of.
const ROUTES = (() => {
  const vy = B.VC - B.VH0 / 2, a = 2.05;
  const sodium = [[122, vy - 4], [122, B.TB - 46]];
  const protein = [[132, B.VC], [177, B.VC]];   // along the lumen, between a red cell and a protein
  const water = [[220, B.VC - 2], [B.CX + Math.cos(a) * (B.R0 + 4), B.CY + Math.sin(a) * (B.R0 + 4)]];   // ends on the membrane, between two potassium glyphs
  return { sodium, protein, water, segs: [[sodium[0], [122, B.TB - 74]], water], lumen: [[140, B.VC], [160, B.VC], [176, B.VC], [220, B.VC]] };
})();
function routeArrows() {
  const { TB } = B, head = { l: 11, w: 6.5 };
  let s = '';
  s += `<g data-part="route-sodium">${arrowFixed(...ROUTES.sodium, { col: P.ui.amber, w: 4, head })}${at(NA, 122, TB - 64)}</g>`;
  s += `<g data-part="route-protein">${arrowFixed(...ROUTES.protein, { col: P.protein.line, w: 4, head })}</g>`;
  // the key: one row per route, its arrow colour first
  const key = (y, col, words, cls) => arrowFixed([16, y - 6], [44, y - 6], { col, w: 4, head: { l: 9, w: 5.5 } }) + text(54, y, words, cls, 'start');
  s += key(26, P.ui.amber, 'sodium: stays outside cells', 'xs b amber') + key(50, P.protein.line, 'protein: stays in the capillary', 'xs b sage') + key(74, BLUE, 'plain water: goes everywhere, into cells too', 'xs b blue');
  s += `<g data-part="route-water">${arrowFixed(...ROUTES.water, { col: BLUE, w: 4, head })}</g>`;
  return s;
}
// The share of body water in each compartment, as one bar across the top (step 10).
function shareBar(shares) {
  const x0 = 16, w = 448, y = 54, h = 26, cols = [P.cytoplasm.base, P.space.ecf, P.plasma.base], lines = [P.cytoplasm.line, ECF_LINE, P.plasma.line];
  const names = ['icf', 'isf', 'plasma'];
  let x = x0, s = '';
  shares.forEach((sh, i) => {
    const ww = w * sh;
    s += `<rect data-part="${names[i]}" x="${f(x)}" y="${y}" width="${f(ww)}" height="${h}" fill="${cols[i]}" stroke="${lines[i]}" stroke-width="1.4"/>`;
    x += ww;
  });
  const xB = x0 + w * shares[0];
  s += text(x0, 22, 'all the water in the body', 'xs muted', 'start');
  s += text(x0 + 6, 46, 'inside cells', 'xs b', 'start') + text(xB + 6, 46, 'between cells', 'xs b', 'start') + text(x0 + w, 102, 'plasma', 'xs b', 'end');
  return s;
}

/* ---------- The model: anchors from the data file ---------- */
// If clinical-values.json cannot load, the pictures run on an illustrative stand-in split, said so on the page:
// two thirds of body water inside cells (the rounding StatPearls NBK470386 uses, quoted in the icfShare note of
// clinical-values.json) and a quarter of the rest in plasma, a round teaching number. Not shown as reference values.
const STAND_IN = { inside: 2 / 3, plasmaOfOutside: 0.25, tonicity: 1, crossing: 0, na: 1, bcop: 1 };
let anchors = null, cv = null;
// Lesson amounts: exaggerated shares of body water, so each change can be seen.
const LESSON_AMOUNT = { isotonic: 0.3, hypotonic: 0.3, hypertonic: 0.1, colloid: 0.12, glucose: 0.3 };
function shares(m) {
  const inside = m ? m.values.icfShare / 100 : anchors.inside, out = 1 - inside, pl = m ? m.values.plasmaShare / 100 : anchors.plasmaOfOutside;
  return [inside, out * (1 - pl), out * pl];
}
// Keyframes for a fluid: it spreads through the space outside cells first, then water crosses cell membranes.
function timeline(m, { colloid = false, sugar = false } = {}) {
  const dir = Math.abs(m.cell - 1) > 0.01 ? Math.sign(m.cell - 1) : 0;
  const after = { cell: m.cell, isf: m.isf, plasma: m.plasma, conc: m.conc, protein: m.protein, sugar: sugar ? 1 : 0, uptake: sugar ? 1 : 0, arrow: 0, spread: 0 };
  const pre = { cell: 1, isf: m.pre.isf, plasma: m.pre.plasma, conc: m.pre.conc, protein: m.protein, sugar: sugar ? 1 : 0, uptake: 0, arrow: 0, spread: colloid ? 0 : 1 };
  if (sugar) {
    const taken = { ...pre, conc: m.pre.concNoSugar, uptake: 1, spread: 0 };
    return { keys: [{ t: 0, ...NORMAL }, { t: 0.28, ...pre }, { t: 0.56, ...taken }, { t: 1, ...after }], shift: [0.56, 1], dir, spreadPhase: [0, 0.28] };
  }
  // no water crosses cell membranes (isotonic, colloid): the spread fills almost the whole play
  const split = dir ? 0.42 : 0.85;
  return { keys: [{ t: 0, ...NORMAL }, { t: split, ...pre }, { t: 1, ...after }], shift: [split, 1], dir, spreadPhase: [0, split] };
}
function frameAt(tl, t) {
  const k = tl.keys;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[i], b = k[i + 1], local = ease.inOut(clamp((t - a.t) / (b.t - a.t), 0, 1));
  const out = {};
  for (const key of Object.keys(NORMAL)) out[key] = lerp(a[key], b[key], local);
  const [s0, s1] = tl.shift, p = clamp((t - s0) / (s1 - s0), 0, 1);
  out.arrow = tl.dir && p > 0 && p < 1 ? tl.dir * Math.sin(Math.PI * p) : 0;
  const [p0, p1] = tl.spreadPhase, q = clamp((t - p0) / (p1 - p0), 0, 1);
  out.spread = b.spread || a.spread ? Math.sin(Math.PI * q) : 0;
  return out;
}
// "Compared with normal", from the same frame the picture draws.
function compareRows(fr) {
  const dir = (v, tol = 0.004) => v > 1 + tol ? 'up' : v < 1 - tol ? 'down' : 'same';
  const w = (v, up, down, same = 'no change') => { const d = dir(v); return [d, d === 'up' ? up : d === 'down' ? down : same]; };
  return [
    ['Cell size', ...w(fr.cell, 'swell', 'shrink')],
    ['Space between cells', ...w(fr.isf, 'more fluid', 'less fluid')],
    ['Plasma', ...w(fr.plasma, 'more fluid', 'less fluid')],
    ['Particles outside cells', ...w(fr.conc, 'more concentrated', 'more dilute', 'same concentration')],
  ];
}
const describe = fr => compareRows(fr).map(([k, , w]) => `${k.toLowerCase()}: ${w}`).join('; ');

const CHANGE = {
  isotonic: { fluid: 'isotonic', title: 'An isotonic crystalloid', words: [['↑ space between cells fills', 'sm b blue'], ['plasma gains a part; cells keep their size', 'xs b']] },
  hypotonic: { fluid: 'hypotonic', title: 'A hypotonic fluid', words: [['↑ cells swell', 'sm b blue'], ['the space between cells fills too', 'xs b']] },
  hypertonic: { fluid: 'hypertonic', title: 'A hypertonic fluid', words: [['↓ cells shrink', 'sm b blue'], ['water leaves cells for the fluid outside them', 'xs b']] },
  colloid: { fluid: 'colloid', title: 'A colloid', words: [['↑ plasma fills the most', 'sm b blue'], ['cells and the space between barely change', 'xs b']] },
  freewater: { fluid: 'glucose', title: 'Free water, from a glucose solution', words: [['↑ cells swell a little', 'sm b blue'], ['every compartment gains some water', 'xs b']] },
};
const TL = {};
function buildTimelines() {
  for (const [kind, c] of Object.entries(CHANGE)) {
    const fl = FLUIDS[c.fluid];
    const m = solve(anchors, { volume: LESSON_AMOUNT[c.fluid], salt: fl.salt, sugar: fl.sugar, uptake: 1, colloid: fl.colloid });
    TL[kind] = timeline(m, { colloid: fl.colloid, sugar: fl.sugar > 0 });
  }
}
function changeScene(kind) {
  const c = CHANGE[kind], fl = FLUIDS[c.fluid], sugar = kind === 'freewater';
  // a salt fluid at the body's own strength moves no water across cell membranes (timeline's dir is 0)
  const matched = fl.salt === 1 && fl.sugar === 0;
  const stages = sugar ? [[0, 'the drip spreads'], [0.28, 'cells take up the sugar'], [0.56, 'water crosses into cells']]
    : matched ? [[0, fl.colloid ? 'the drip stays in the vessel' : 'the drip spreads outside cells'], [0.85, 'cells keep their size']]
    : [[0, 'the drip spreads'], [0.42, 'water crosses cell membranes']];
  return {
    duration: sugar ? 4400 : 3400,
    stages,
    render(t) {
      const fr = frameAt(TL[kind], t), fin = frameAt(TL[kind], 1);
      const path = fl.colloid ? 'stays in the plasma, and no water crosses cell membranes' : matched ? 'spreads through the fluid outside cells, and no water crosses cell membranes' : `spreads through the fluid outside cells${sugar ? ', cells take up and use its sugar,' : ''} and then water crosses cell membranes`;
      const label = `${c.title}, drawn over a dashed outline of normal: the space between cells, a cell and the plasma in a capillary along its lower edge. The fluid enters the capillary from an IV, ${path}. At the end, compared with normal: ${describe(fin)}.`;
      return { svg: svg(label, bodyPicture(fr, { words: c.words, wordsOp: span(t, 0.62, 0.9) }), { h: BODY_H }), readout: readout(compareRows(fr)) };
    },
  };
}

/* ---------- Scenes, one per step kind ---------- */
const still = (label, draw, h) => () => svg(label, draw(), { h });
const scenes = {
  cell: still('One round cell, with its nucleus, floating in fluid. Labels mark the fluid outside the cell, the fluid inside it, and the thin golden cell membrane between them.', cellStill, 352),
  solute: still('The same cell. Amber sodium circles are dissolved in the fluid outside it; green potassium triangles are dissolved inside it.', soluteStill, 384),
  diffusion: { duration: 4200, render: t => svg('Glucose molecules crowded at the left of a box of fluid spread out until they are evenly mixed through the whole box. A bar chart under the box shows how crowded each part is: tall at the left at first, then level.', diffusionPicture(t), { h: 390 }) },
  membrane: { duration: 3200, loop: true, rest: 0.25, render: t => svg('A box of fluid split down the middle by a cell membrane with two water channels. Water drops pass through the channels both ways. An amber sodium particle bumps the membrane and is turned back, marked with a red cross.', membranePicture(t), { h: 364 }) },
  osmosis: { duration: 3400, render: t => svg('A tank split by a membrane that lets only water through: plain water on the left, salty water on the right. A blue arrow shows water crossing to the salty side. The right level rises and the left falls, away from the dashed start level, until the taller column pushes back.', osmosisPicture(t), { h: 336 }) },
  effective: effectiveScene(),
  iso: tonicScene('iso'),
  hypo: tonicScene('hypo'),
  hyper: tonicScene('hyper'),
  rooms: () => svg('A bar across the top splits all the water in the body into three parts: inside cells is the largest, between cells next, plasma the smallest. Below, a cell sits in the fluid between cells, and a capillary holding plasma with red cells and proteins runs along the lower edge of that fluid.', bodyPicture(NORMAL, { drip: false, ghost: false, bar: shares() }), { h: BODY_H }),
  wall: { duration: 3600, loop: true, render: t => svg('A close-up of a capillary wall. Above it, fluid between cells; below it, plasma with sage protein molecules. Sodium particles slip through narrow gaps in the wall both ways; the proteins are too big and stay in. Blue arrows show water pulled back into the capillary.', `<g transform="translate(0 -40)">${wallPicture(t)}</g>`, { h: 328 }) },
  routes: () => svg('The space between cells, a cell and a capillary, with an IV entering the capillary. An amber arrow takes sodium out of the capillary into the space between cells, where it stays outside the cell. A sage arrow runs along inside the capillary: protein stays in it. A blue arrow takes plain water on into the cell.', bodyPicture(NORMAL, { ghost: false, routes: true }), { h: BODY_H }),
  isotonic: changeScene('isotonic'),
  hypotonic: changeScene('hypotonic'),
  hypertonic: changeScene('hypertonic'),
  colloid: changeScene('colloid'),
  freewater: changeScene('freewater'),
};

/* ---------- Explore freely ---------- */
const ui = () => ({ fluid: $('#fluid'), amount: $('#amount'), salt: $('#salt'), uptake: $('#uptake') });
function exploreSettings() {
  const u = ui(), fluid = u.fluid.value, amount = +u.amount.value;
  if (fluid === 'custom') return { volume: amount / 100 * MAX_SHARE, salt: +u.salt.value / 100, sugar: 0, uptake: 1, colloid: false };
  return settingsFor(fluid, amount, +u.uptake.value / 100);
}
const model = () => solve(anchors, exploreSettings());
const pct = x => `${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(1)}%`;
const fluidName = () => $('#fluid').selectedOptions[0]?.textContent || '';
const amountText = m => m.volume === 0 ? 'none' : `${(m.volume * 100).toFixed(1)}% of body water`;
function frameOf(m) {
  const u = ui();
  return { cell: m.cell, isf: m.isf, plasma: m.plasma, conc: m.conc, protein: m.protein, sugar: u.fluid.value === 'glucose' ? 1 : 0, uptake: +u.uptake.value / 100, arrow: Math.abs(m.cell - 1) > 0.002 ? Math.sign(m.cell - 1) * 0.7 : 0, spread: 0 };
}
function renderExplore() {
  if (!anchors) return;
  const u = ui(), m = model(), fr = frameOf(m);
  $('#explore-visual').innerHTML = svg(`The three body water compartments after ${fluidName().toLowerCase()}, ${amountText(m)}, drawn over a dashed outline of normal. Compared with normal: ${describe(fr)}.`, bodyPicture(fr), { h: BODY_H }) + readout(compareRows(fr));
  $('#amount-out').textContent = amountText(m);
  $('#salt-out').textContent = `${u.salt.value}% of the body's own`;
  $('#uptake-out').textContent = u.uptake.disabled ? 'not a sugar fluid' : `${u.uptake.value}%`;
  const same = x => Math.abs(x - 1) < 0.0005;
  const rows = [['Cell size', same(m.cell) ? 'unchanged' : `${pct(m.cell - 1)} (${m.cell > 1 ? 'swell' : 'shrink'})`], ['Space between cells', same(m.isf) ? 'unchanged' : pct(m.isf - 1)], ['Plasma volume', same(m.plasma) ? 'unchanged' : pct(m.plasma - 1)], ['Concentration outside cells', `${m.conc.toFixed(3)} × normal`], ['Protein pull', `${m.pull.toFixed(3)} × normal`]];
  let html = `<b>${esc(fluidName())}, ${esc(amountText(m))}.</b> ` + rows.map(([k, v]) => `${k}: ${v}`).join(' · ') + '.';
  if (m.volume > 0) {
    const went = [['inside cells', m.went.inside], ['between cells', m.went.isf], ['plasma', m.went.plasma]];
    html += ` Where the water ended up, as a share of the fluid given: ${went.map(([k, x]) => `${k} ${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(0)}%`).join(', ')}.${m.went.inside < -0.005 ? ' A negative share means water was pulled out of that compartment.' : ''}`;
  } else html += ' Nothing given yet: choose a fluid, then raise the amount.';
  $('#model-results').innerHTML = html;
}
function presetFromFluid() {
  const u = ui(), fl = u.fluid.value;
  if (fl !== 'custom') u.salt.value = Math.round(FLUIDS[fl].salt * 100);
  u.uptake.disabled = fl !== 'glucose';
  if (fl !== 'glucose') u.uptake.value = 100;
}
function wireExplore() {
  const u = ui();
  u.fluid.addEventListener('change', () => { presetFromFluid(); if (+u.amount.value === 0) u.amount.value = 50; syncState(); update(); });
  u.amount.addEventListener('input', () => { syncState(); update(); });
  u.uptake.addEventListener('input', () => { syncState(); update(); });
  u.salt.addEventListener('input', () => {
    const s = +u.salt.value / 100, match = Object.entries(FLUIDS).find(([k, fl]) => !fl.colloid && fl.sugar === 0 && fl.salt === s && k !== 'water');
    u.fluid.value = match ? match[0] : s === 0 ? 'water' : 'custom';
    u.uptake.disabled = true;
    syncState(); update();
  });
  $('#reset').addEventListener('click', () => { u.fluid.value = 'isotonic'; u.amount.value = 0; presetFromFluid(); syncState(); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => x.toFixed(v.decimals ?? 0);
// The cited value as its source writes it (display); decimals is only the model reading's precision.
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
  return Math.abs(rel) < 0.02 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value';
}
let selectedState = 'baseline';
function syncState() {
  if (!cv) return;
  const u = ui(), fl = u.fluid.value, amount = +u.amount.value;
  let id = 'custom';
  if (amount === 0) id = 'baseline';
  else if (fl === 'water' || (fl === 'glucose' && +u.uptake.value === 100)) id = 'freewater';
  else if (cv.states.some(s => s.id === fl)) id = fl;
  selectedState = id;
  const sel = $('#clinical-state');
  if (sel) sel.value = cv.states.some(s => s.id === id) ? id : 'custom';
}
function applyState(id) {
  const st = cv.states.find(s => s.id === id), u = ui();
  if (!st) return;
  const m = st.model || {};
  if (m.fluid) u.fluid.value = m.fluid;
  presetFromFluid();
  u.amount.value = m.amount ?? 50;
  if (m.uptake != null && u.fluid.value === 'glucose') u.uptake.value = m.uptake;
  selectedState = id;
  update();
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom settings from Explore freely</option>';
  sel.addEventListener('change', e => { if (e.target.value !== 'custom') applyState(e.target.value); });
  $('#clinical-amount').addEventListener('input', e => { ui().amount.value = e.target.value; syncState(); update(); });
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
    cite.textContent = `"${v.excerpt}" ${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
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
  const m = model(), fr = frameOf(m), u = ui();
  $('#clinical-visual').innerHTML = svg(`The teaching model now: ${describe(fr)}.`, bodyPicture(fr), { h: BODY_H });
  $('#clinical-amount').value = u.amount.value;
  $('#clinical-amount-label').textContent = amountText(m);
  const st = cv.states.find(s => s.id === selectedState);
  $('#state-summary').textContent = +u.amount.value === 0 ? 'No fluid given: the teaching model sits at its baseline.' : `${fluidName()}, ${amountText(m)} (illustrative).${st && st.id !== 'baseline' ? ` ${st.summary}` : ''}`;
  $('#state-evidence').innerHTML = st ? st.evidence.map(q => `<p>"${esc(q.excerpt)}" <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') + (st.unstatedNote ? `<p>${esc(st.unstatedNote)}</p>` : '') : '<p>Custom settings: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey];
    row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
    row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
    const mk = row.querySelector('.marker'), px = posOf(v)(x);
    mk.setAttribute('x1', px); mk.setAttribute('x2', px);
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id];
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]} (${st.id === 'baseline' ? 'no fluid given' : st.label.toLowerCase()})` : 'No direction stated by the cited sources';
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
    for (const id of ['sosm', 'tonicity', 'na', 'bcop', 'icfShare', 'plasmaShare']) if (typeof data.modelBaseline?.[id] !== 'number' || !data.values?.some(v => v.id === id)) throw new Error(`no ${id}`);
    cv = data;
    anchors = anchorsFrom(cv);
    buildClinical();
  } catch (err) {
    cv = null;
    anchors = { ...STAND_IN };
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson and Explore freely run on an illustrative stand-in split of body water meanwhile.`;
  }
  buildTimelines();
  wireExplore();
  presetFromFluid();
  syncState();
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
