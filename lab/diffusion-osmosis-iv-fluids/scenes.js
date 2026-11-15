// The lesson's pictures. Each scene draws into an <svg> once and returns render(t), where t runs
// from 0 (normal) to 1 (the end state), plus how long its animation lasts. Shapes that show the
// normal picture carry data-ghost; shapes that move carry data-current.
const NS = 'http://www.w3.org/2000/svg';
export const C = { ink: '#171916', rule: '#babeb3', blue: '#254dff', water: '#e6eaff', salt: '#b4400f', prot: '#6d2f8e', vessel: '#f7e6e0', paper: '#f7f7f2', soft: '#5a5d55' };
const FONT = "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function label(parent, x, y, str, attrs = {}) {
  const t = el('text', { x, y, 'font-size': 16, 'font-family': FONT, fill: C.ink, ...attrs }, parent);
  t.textContent = str;
  return t;
}
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
  for (let tries = 0; pts.length < n && tries < n * 300; tries++) {
    const p = { x: r() * w, y: r() * h };
    if (!accept(p)) continue;
    if (pts.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD * minD)) pts.push(p);
  }
  return pts;
}
let uid = 0;
function setup(svg, w, h) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const id = `s${++uid}`;
  const defs = el('defs', {}, svg);
  for (const [name, color] of [['blue', C.blue], ['ink', C.ink], ['salt', C.salt], ['prot', C.prot]]) {
    const m = el('marker', { id: `${id}-${name}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
  }
  return name => `url(#${id}-${name})`;
}
function arrow(parent, x1, y1, x2, y2, color, marker, width = 3, attrs = {}) {
  return el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'marker-end': marker, ...attrs }, parent);
}
function blobPath(cx, cy, r, wobble) {
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2, rr = r * (1 + wobble * Math.sin(a * 11));
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

/* ---------- One cell in a fluid (steps 1, 2, 6, 7, 8) ---------- */
export function cellScene(svg, { dots = true, outside = 1, target = 1, mode = 'intro', arrows = null, verdict = '' } = {}) {
  const mk = setup(svg, 480, 330);
  const cx = 240, cy = 172, R0 = 78;
  el('rect', { x: 8, y: 8, width: 464, height: 314, rx: 18, fill: C.water }, svg);
  // keep particles clear of the swollen cell and of the label strips at top left and bottom
  const clear = p => { const x = p.x + 8, y = p.y + 8; return Math.hypot(x - cx, y - cy) > R0 * 1.32 + 10 && !(y < 56 && x < 318) && !(y > 276 && x > 110 && x < 470); };
  const outPool = scatter(11, 150, 464, 314, 17, clear);
  const inPool = scatter(5, 14, 2, 2, 0.42, p => Math.hypot(p.x - 1, p.y - 1) < 0.82);
  if (dots) {
    const n = Math.round(70 * outside);
    for (const p of outPool.slice(0, n)) el('circle', { cx: p.x + 8, cy: p.y + 8, r: 4.2, fill: C.salt }, svg);
  }
  const ghost = target !== 1 || mode === 'tonic' ? el('circle', { cx, cy, r: R0, fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.5, 'data-ghost': 'cell' }, svg) : null;
  const cell = el('path', { fill: '#d5ddff', 'fill-opacity': 0.75, stroke: C.ink, 'stroke-width': 3, 'data-current': 'cell' }, svg);
  const inside = dots ? inPool.map(() => el('circle', { r: 4.2, fill: C.salt }, svg)) : [];
  const arrowG = el('g', { 'data-arrows': arrows || 'none' }, svg);
  const arrowLines = arrows ? [35, 145, 215, 325].map(() => [el('line', {}, arrowG), el('line', {}, arrowG)]) : [];

  if (mode === 'intro') {
    label(svg, cx, cy + 6, 'inside the cell', { 'text-anchor': 'middle', 'font-weight': 600 });
    label(svg, 28, 40, 'outside the cell', { 'font-weight': 600 });
    el('line', { x1: 352, y1: 66, x2: cx + R0 * 0.72 + 4, y2: cy - R0 * 0.72 - 2, stroke: C.ink, 'stroke-width': 1.5 }, svg);
    label(svg, 356, 60, 'cell membrane', { 'font-weight': 600 });
  } else if (mode === 'solute') {
    el('circle', { cx: 30, cy: 34, r: 5, fill: C.salt }, svg);
    label(svg, 42, 40, 'solute particle', { 'font-weight': 600 });
    label(svg, 452, 306, 'water fills every gap', { 'text-anchor': 'end', fill: C.blue, 'font-weight': 600 });
  } else if (mode === 'tonic') {
    const words = outside === 1 ? 'outside matches inside' : outside < 1 ? 'outside: fewer solute particles' : 'outside: more solute particles';
    el('rect', { x: 18, y: 18, width: 286, height: 30, rx: 6, fill: C.paper, opacity: 0.92 }, svg);
    label(svg, 28, 39, words, { 'font-weight': 600 });
  }
  const verdictBox = verdict ? el('g', {}, svg) : null;
  if (verdictBox) {
    el('rect', { x: 120, y: 280, width: 240, height: 32, rx: 6, fill: C.paper, opacity: 0.94 }, verdictBox);
    label(verdictBox, 240, 302, verdict, { 'text-anchor': 'middle', 'font-weight': 700 });
  }

  const animated = target !== 1;
  function render(t) {
    const e = ease(clamp(t, 0, 1));
    const s = lerp(1, target, e), R = R0 * Math.sqrt(s);
    cell.setAttribute('d', blobPath(cx, cy, R, Math.max(0, 1 - s) * 0.16));
    inPool.forEach((p, i) => { if (!inside[i]) return; inside[i].setAttribute('cx', (cx + (p.x - 1) * R).toFixed(1)); inside[i].setAttribute('cy', (cy + (p.y - 1) * R).toFixed(1)); });
    const op = animated ? 0.45 + 0.55 * Math.sin(Math.PI * clamp(t, 0, 1)) : 1;
    [35, 145, 215, 325].forEach((deg, i) => {
      if (!arrowLines[i]) return;
      const far = R + 44, near = R + 10;
      const [l1, l2] = arrowLines[i];
      // one line along the ray at angle d (degrees), from radius r1 to radius r2
      const set = (l, d, r1, r2, on) => {
        const a = d * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        for (const [k, v] of Object.entries({ x1: cx + r1 * cos, y1: cy + r1 * sin, x2: cx + r2 * cos, y2: cy + r2 * sin })) l.setAttribute(k, v.toFixed(1));
        l.setAttribute('stroke', C.blue); l.setAttribute('stroke-width', 3.5); l.setAttribute('stroke-linecap', 'round'); l.setAttribute('marker-end', mk('blue')); l.setAttribute('opacity', on ? op : 0);
      };
      if (arrows === 'both') { set(l1, deg - 7, far, near, true); set(l2, deg + 7, near, far, true); }
      else if (arrows === 'in') { set(l1, deg, far, near, true); set(l2, deg, near, near, false); }
      else { set(l1, deg, near, far, true); set(l2, deg, near, near, false); }
    });
    if (verdictBox) verdictBox.setAttribute('opacity', animated ? clamp((t - 0.6) / 0.4, 0, 1) : 1);
  }
  return { render, duration: animated ? 2400 : 0 };
}

/* ---------- Diffusion: a crowd spreads out (step 3) ---------- */
export function diffusionScene(svg) {
  const mk = setup(svg, 480, 330);
  const x0 = 16, y0 = 48, w = 448, h = 262;
  el('rect', { x: x0, y: y0, width: w, height: h, rx: 14, fill: C.water }, svg);
  el('rect', { x: x0 + 6, y: y0 + 6, width: 104, height: h - 12, rx: 10, fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.5, 'data-ghost': 'start' }, svg);
  label(svg, x0 + 58, y0 + h + 0 - 12, 'started here', { 'text-anchor': 'middle', 'font-size': 14, fill: C.soft });
  const start = scatter(21, 46, 92, h - 30, 11).map(p => ({ x: x0 + 14 + p.x, y: y0 + 14 + p.y }));
  const end = scatter(22, 46, w - 30, h - 30, 30).map(p => ({ x: x0 + 15 + p.x, y: y0 + 15 + p.y }));
  const dots = start.map(() => el('circle', { r: 5, fill: C.salt, 'data-current': 'dot' }, svg));
  const crowded = label(svg, x0 + 4, 34, 'crowded', { 'font-weight': 700 });
  const spread = label(svg, x0 + w, 34, 'evenly spread', { 'font-weight': 700, 'text-anchor': 'end' });
  arrow(svg, 120, 28, 330, 28, C.ink, mk('ink'), 2);
  function render(t) {
    const e = ease(clamp(t, 0, 1));
    dots.forEach((d, i) => { const a = start[i], b = end[i] || end[i % end.length]; d.setAttribute('cx', lerp(a.x, b.x, e).toFixed(1)); d.setAttribute('cy', lerp(a.y, b.y, e).toFixed(1)); });
    // the label for the current moment is ink, the other a softer grey (both stay readable)
    crowded.setAttribute('fill', e < 0.5 ? C.ink : C.soft); crowded.setAttribute('font-weight', e < 0.5 ? 700 : 500);
    spread.setAttribute('fill', e >= 0.5 ? C.ink : C.soft); spread.setAttribute('font-weight', e >= 0.5 ? 700 : 500);
  }
  return { render, duration: 2800 };
}

/* ---------- A semipermeable membrane (step 4) ---------- */
export function membraneScene(svg) {
  const mk = setup(svg, 480, 330);
  const x0 = 16, y0 = 50, w = 448, h = 250, mx = 240;
  el('rect', { x: x0, y: y0, width: w, height: h, rx: 14, fill: C.water }, svg);
  const pores = [];
  for (let y = y0; y < y0 + h; y += 50) {
    el('rect', { x: mx - 5, y, width: 10, height: 34, fill: C.ink }, svg);
    if (y + 34 < y0 + h) pores.push(y + 42);
  }
  const water = scatter(31, 44, w - 24, h - 20, 22).map(p => ({ x: x0 + 12 + p.x, y: y0 + 10 + p.y })).filter(p => Math.abs(p.x - mx) > 14);
  for (const p of water) el('circle', { cx: p.x, cy: p.y, r: 3.4, fill: C.blue }, svg);
  const salt = scatter(32, 9, 180, h - 40, 40).map(p => ({ x: x0 + 20 + p.x, y: y0 + 20 + p.y }));
  for (const p of salt) el('circle', { cx: p.x, cy: p.y, r: 8, fill: C.salt }, svg);
  // a salt particle that tries to cross and is turned back
  const bump = el('circle', { r: 8, fill: C.salt, 'data-current': 'salt' }, svg);
  const cross = label(svg, mx - 30, pores[2] - 16, '✕', { 'font-size': 20, 'font-weight': 700, fill: C.salt, 'text-anchor': 'middle' });
  const travellers = pores.map((py, i) => ({ py, dir: i % 2 ? -1 : 1, node: el('circle', { r: 3.8, fill: C.blue, 'data-current': 'water' }, svg) }));
  label(svg, x0, 30, 'water passes through', { 'font-weight': 700, fill: C.blue });
  label(svg, x0 + w, 30, 'salt is held back', { 'font-weight': 700, fill: C.salt, 'text-anchor': 'end' });
  arrow(svg, mx - 40, pores[0], mx + 40, pores[0], C.blue, mk('blue'), 2.5, { opacity: 0.6 });
  function render(t) {
    const k = clamp(t, 0, 1);
    travellers.forEach((tr, i) => {
      const local = clamp(k * 1.4 - i * 0.08, 0, 1), e = ease(local);
      const x = tr.dir > 0 ? lerp(mx - 70, mx + 70, e) : lerp(mx + 70, mx - 70, e);
      tr.node.setAttribute('cx', x.toFixed(1)); tr.node.setAttribute('cy', (tr.py + Math.sin(e * Math.PI) * 4).toFixed(1));
    });
    const b = Math.sin(clamp(k, 0, 1) * Math.PI);
    bump.setAttribute('cx', (mx - 60 + 44 * b).toFixed(1)); bump.setAttribute('cy', pores[2]);
    cross.setAttribute('opacity', 0.3 + 0.7 * b);
  }
  return { render, duration: 2600 };
}

/* ---------- Osmosis: a two-sided tank (step 5) ---------- */
export function osmosisScene(svg) {
  const mk = setup(svg, 480, 330);
  const L = 56, R = 424, mx = 240, bottom = 286, top = 56, start = 172;
  const left = el('rect', { x: L, width: mx - L - 3, fill: '#c9d3ff' }, svg);
  const right = el('rect', { x: mx + 3, width: R - mx - 3, fill: '#c9d3ff', 'data-current': 'level' }, svg);
  el('path', { d: `M${L},${top} V${bottom} H${R} V${top}`, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, svg);
  el('line', { x1: mx, y1: top + 10, x2: mx, y2: bottom, stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '10 6' }, svg);
  el('line', { x1: L, y1: start, x2: R, y2: start, stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.5, 'data-ghost': 'level' }, svg);
  const solutes = scatter(41, 16, 1, 1, 0.2).map(p => ({ u: 0.08 + p.x * 0.84, v: 0.08 + p.y * 0.84, node: el('circle', { r: 6, fill: C.salt }, svg) }));
  label(svg, (L + mx) / 2, 312, 'plain water', { 'text-anchor': 'middle', 'font-weight': 600 });
  label(svg, (mx + R) / 2, 312, 'salty water', { 'text-anchor': 'middle', 'font-weight': 600 });
  label(svg, mx + 8, top - 10, 'membrane: water only', { 'text-anchor': 'middle', 'font-size': 14, fill: C.soft });
  const flow = arrow(svg, mx - 46, 252, mx + 46, 252, C.blue, mk('blue'), 4);
  const flowText = label(svg, mx - 50, 240, 'water moves', { 'text-anchor': 'end', fill: C.blue, 'font-weight': 700, 'font-size': 15 });
  // the taller column's weight is what stops the flow, not equal saltiness
  const rises = el('g', {}, svg);
  label(rises, R - 8, 84, 'level rises until its', { 'text-anchor': 'end', 'font-weight': 700, 'font-size': 15 });
  label(rises, R - 8, 102, 'weight pushes back', { 'text-anchor': 'end', 'font-weight': 700, 'font-size': 15 });
  function render(t) {
    const e = ease(clamp(t, 0, 1));
    const ly = lerp(start, start + 40, e), ry = lerp(start, start - 46, e);
    left.setAttribute('y', ly.toFixed(1)); left.setAttribute('height', (bottom - ly).toFixed(1));
    right.setAttribute('y', ry.toFixed(1)); right.setAttribute('height', (bottom - ry).toFixed(1));
    for (const s of solutes) { s.node.setAttribute('cx', (mx + 3 + s.u * (R - mx - 3)).toFixed(1)); s.node.setAttribute('cy', (ry + s.v * (bottom - ry)).toFixed(1)); }
    const op = 0.45 + 0.55 * Math.sin(Math.PI * clamp(t, 0, 1));
    flow.setAttribute('opacity', op);
    flowText.setAttribute('font-weight', op > 0.8 ? 700 : 600);
    rises.setAttribute('opacity', clamp((t - 0.5) / 0.5, 0, 1));
  }
  return { render, duration: 2800 };
}

/* ---------- The vessel wall holds large molecules (step 10) ---------- */
export function wallScene(svg) {
  const mk = setup(svg, 480, 330);
  const wy = 156;
  el('rect', { x: 8, y: 8, width: 464, height: wy - 8, rx: 14, fill: C.water }, svg);
  el('rect', { x: 8, y: wy, width: 464, height: 314 - wy, rx: 14, fill: C.vessel }, svg);
  const gaps = [];
  for (let x = 8; x < 472; x += 58) { el('rect', { x, y: wy - 5, width: 40, height: 10, fill: C.ink }, svg); gaps.push(x + 49); }
  label(svg, 20, 34, 'between cells', { 'font-weight': 700 });
  label(svg, 20, 302, 'inside the vessel: plasma', { 'font-weight': 700 });
  const saltTop = scatter(51, 14, 440, wy - 40, 32).map(p => ({ x: 20 + p.x, y: 46 + p.y * 0.9 }));
  const saltBot = scatter(52, 14, 440, 314 - wy - 60, 32).map(p => ({ x: 20 + p.x, y: wy + 18 + p.y }));
  for (const p of [...saltTop, ...saltBot]) el('circle', { cx: p.x, cy: p.y, r: 4, fill: C.salt }, svg);
  const prot = scatter(53, 7, 420, 314 - wy - 70, 54, p => !(p.x + 30 > 240 && p.y + wy + 30 > 258) && !(p.x + 30 < 250 && p.y + wy + 30 > 270)).map(p => ({ x: 30 + p.x, y: wy + 30 + p.y }));
  for (const p of prot) el('circle', { cx: p.x, cy: p.y, r: 11, fill: C.prot, 'data-current': 'protein' }, svg);
  const crossers = gaps.slice(1, 7).map((x, i) => ({ x, dir: i % 2 ? 1 : -1, node: el('circle', { r: 4.5, fill: C.salt, stroke: C.paper, 'stroke-width': 1.5 }, svg) }));
  const pulls = [120, 240, 360].map(x => arrow(svg, x, wy - 52, x, wy - 14, C.blue, mk('blue'), 4));
  label(svg, 460, 34, 'water pulled back in', { 'text-anchor': 'end', fill: C.blue, 'font-weight': 700 });
  // key
  el('circle', { cx: 268, cy: 288, r: 9, fill: C.prot }, svg);
  label(svg, 284, 294, 'protein stays in', { 'font-size': 15, 'font-weight': 600 });
  function render(t) {
    const k = clamp(t, 0, 1);
    crossers.forEach((c, i) => {
      const e = ease(clamp(k * 1.3 - i * 0.05, 0, 1));
      const y = c.dir > 0 ? lerp(wy - 34, wy + 34, e) : lerp(wy + 34, wy - 34, e);
      c.node.setAttribute('cx', c.x); c.node.setAttribute('cy', y.toFixed(1));
    });
    const op = 0.5 + 0.5 * Math.sin(Math.PI * k);
    pulls.forEach(p => p.setAttribute('opacity', op));
  }
  return { render, duration: 2400 };
}

/* ---------- The body's three rooms: cell, between cells, plasma (steps 9, 11-16, Explore) ---------- */
// A frame: cell, isf, plasma (volume ratios to normal), conc (outside concentration ratio), protein
// (ratio), sugar (0..1 shown), uptake (0..1 taken into the cell), arrow (signed: + water into cell),
// spread (0..1 fluid leaving the vessel). Changes are drawn larger than life so they can be seen.
export const AMP = 2.4;
export function bodyScene(svg, { bar = null, drip = false, labels = true, routes = false } = {}) {
  const mk = setup(svg, 480, 360);
  const TB = 252, W0 = 330, H0 = 150, R0 = 44, VC = 302, VH0 = 26, VX = 40, VW = 428, CX = 240;
  const g = {};
  // ghost of normal
  const ghost = el('g', { 'data-ghost': 'normal' }, svg);
  const dash = { fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.5 };
  g.tissue = el('rect', { rx: 14, fill: C.water, stroke: C.ink, 'stroke-width': 2, 'data-current': 'tissue' }, svg);
  g.vessel = el('rect', { fill: C.vessel, stroke: C.ink, 'stroke-width': 2.5, 'data-current': 'vessel' }, svg);
  svg.appendChild(ghost);
  el('rect', { x: CX - W0 / 2, y: TB - H0, width: W0, height: H0, rx: 14, ...dash, 'data-ghost': 'tissue' }, ghost);
  el('rect', { x: VX, y: VC - VH0 / 2, width: VW, height: VH0, rx: VH0 / 2, ...dash, 'data-ghost': 'vessel' }, ghost);
  const ghostCell = el('circle', { cx: CX, cy: TB - H0 / 2, r: R0, ...dash, 'data-ghost': 'cell' }, ghost);
  const isfPool = scatter(61, 170, 442, 201, 12.5).map(p => ({ u: p.x / 442, v: p.y / 201 }));
  const vesPool = scatter(62, 70, 428, 60, 11).map(p => ({ u: p.x / 428, v: p.y / 60 }));
  const cellPool = scatter(63, 9, 2, 2, 0.5, p => Math.hypot(p.x - 1, p.y - 1) < 0.8);
  const sugarPool = scatter(64, 16, 1, 1, 0.16).map((p, i) => ({ u: 0.05 + p.x * 0.9, v: 0.08 + p.y * 0.84, inX: Math.cos(i * 2.4) * 0.5, inY: Math.sin(i * 2.4) * 0.5 }));
  const dotsG = el('g', {}, svg);
  const isfDots = isfPool.map(() => el('circle', { r: 3.4, fill: C.salt }, dotsG));
  const vesDots = vesPool.map(() => el('circle', { r: 3.2, fill: C.salt }, dotsG));
  const protDots = Array.from({ length: 16 }, (_, i) => el('circle', { r: 6.5, fill: C.prot, 'data-protein': i }, dotsG));
  g.cell = el('path', { fill: '#d5ddff', 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 2.5, 'data-current': 'cell' }, svg);
  const cellDots = cellPool.map(() => el('circle', { r: 3.4, fill: C.salt }, svg));
  const sugar = sugarPool.map(() => el('rect', { width: 8, height: 8, fill: C.paper, stroke: C.ink, 'stroke-width': 1.8, 'data-sugar': '' }, svg));
  const cellArrows = [30, 150, 210, 330].map(() => el('line', { stroke: C.blue, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'marker-end': mk('blue') }, svg));
  const spreadArrows = [110, 370].map(() => el('line', { stroke: C.salt, 'stroke-width': 3, 'stroke-linecap': 'round', 'marker-end': mk('salt') }, svg));
  const text = el('g', {}, svg);
  const tTissue = labels ? label(text, 0, 0, 'between cells', { 'font-size': 15, 'font-weight': 600 }) : null;
  const tCell = labels ? label(text, 0, 0, 'inside cell', { 'font-size': 14, 'font-weight': 600, 'text-anchor': 'middle' }) : null;
  const tVessel = labels ? label(text, VX + 6, 0, 'plasma, inside a blood vessel', { 'font-size': 15, 'font-weight': 600 }) : null;
  if (drip) {
    arrow(svg, 4, VC, 34, VC, C.ink, mk('ink'), 3);
    label(svg, 4, VC - 12, 'IV', { 'font-size': 14, 'font-weight': 700 });
  }
  let barParts = null;
  if (bar) {
    barParts = ['inside cells', 'between cells', 'plasma'].map((name, i) => ({
      rect: el('rect', { y: 22, height: 16, fill: [ '#d5ddff', C.water, C.vessel ][i], stroke: C.ink, 'stroke-width': 1.5 }, svg),
      text: label(svg, 0, 15, name, { 'font-size': 13, 'font-weight': 600, 'text-anchor': i === 2 ? 'end' : 'start' }),
    }));
  }
  if (routes) {
    arrow(svg, 128, VC - 18, 128, TB - 30, C.salt, mk('salt'), 4, { 'data-route': 'salt' });
    arrow(svg, 300, VC, 400, VC, C.prot, mk('prot'), 4, { 'data-route': 'colloid' });
    el('path', { d: `M206,${VC - 16} C206,${TB - 30} 216,${TB - 60} 226,${TB - 70}`, fill: 'none', stroke: C.blue, 'stroke-width': 4, 'stroke-linecap': 'round', 'marker-end': mk('blue'), 'data-route': 'water' }, svg);
  }

  function render(f) {
    const isfD = clamp(f.isf, 0.55, 1.8), s = Math.sqrt(isfD);
    const W = W0 * s, H = H0 * s, tx = CX - W / 2, ty = TB - H, cy = TB - H / 2;
    const cellD = clamp(1 + (f.cell - 1) * AMP, 0.4, 1.9), R = R0 * Math.sqrt(cellD);
    const plD = clamp(f.plasma, 0.5, 2.5), vh = VH0 * plD, vy = VC - vh / 2;
    const concD = Math.max(0.2, 1 + (f.conc - 1) * AMP);
    g.tissue.setAttribute('x', tx.toFixed(1)); g.tissue.setAttribute('y', ty.toFixed(1)); g.tissue.setAttribute('width', W.toFixed(1)); g.tissue.setAttribute('height', H.toFixed(1));
    g.vessel.setAttribute('x', VX); g.vessel.setAttribute('y', vy.toFixed(1)); g.vessel.setAttribute('width', VW); g.vessel.setAttribute('height', vh.toFixed(1)); g.vessel.setAttribute('rx', (vh / 2).toFixed(1));
    ghostCell.setAttribute('cy', (TB - H0 / 2).toFixed(1));
    g.cell.setAttribute('d', blobPath(CX, cy, R, Math.max(0, 1 - cellD) * 0.12));
    svg.dataset.cell = cellD.toFixed(3); svg.dataset.plasma = plD.toFixed(3);
    // particles between cells: as many as the space and the concentration hold
    const freeArea = W * H - Math.PI * R * R, freeArea0 = W0 * H0 - Math.PI * R0 * R0;
    let want = Math.round(46 * (freeArea / freeArea0) * concD), shown = 0;
    isfPool.forEach((p, i) => {
      const x = tx + 6 + p.u * (W - 12), y = ty + 6 + p.v * (H - 12);
      const ok = shown < want && Math.hypot(x - CX, y - cy) > R + 5 && !(labels && x < tx + 118 && y < ty + 26);
      if (ok) { shown++; isfDots[i].setAttribute('cx', x.toFixed(1)); isfDots[i].setAttribute('cy', y.toFixed(1)); }
      isfDots[i].setAttribute('opacity', ok ? 1 : 0);
    });
    const wantV = Math.round(12 * plD * concD);
    vesPool.forEach((p, i) => {
      const on = i < wantV;
      vesDots[i].setAttribute('opacity', on ? 1 : 0);
      if (on) { vesDots[i].setAttribute('cx', (VX + 8 + p.u * (VW - 16)).toFixed(1)); vesDots[i].setAttribute('cy', (vy + 5 + p.v * Math.max(0, vh - 10)).toFixed(1)); }
    });
    const wantP = Math.min(16, Math.round(4 * f.protein));
    protDots.forEach((d, i) => {
      const on = i < wantP;
      d.setAttribute('opacity', on ? 1 : 0);
      if (on) { d.setAttribute('cx', (VX + 30 + ((i * 0.618034) % 1) * (VW - 60)).toFixed(1)); d.setAttribute('cy', (vy + vh / 2 + Math.sin(i * 1.7) * Math.max(0, vh / 2 - 9)).toFixed(1)); }
    });
    cellPool.forEach((p, i) => { cellDots[i].setAttribute('cx', (CX + (p.x - 1) * R).toFixed(1)); cellDots[i].setAttribute('cy', (cy + (p.y - 1) * R).toFixed(1)); });
    sugarPool.forEach((p, i) => {
      const sx = tx + 10 + p.u * (W - 28), sy = ty + 10 + p.v * (H - 28);
      const ix = CX + p.inX * R - 4, iy = cy + p.inY * R - 4;
      const k = ease(clamp(f.uptake, 0, 1));
      let x = lerp(sx, ix, k), y = lerp(sy, iy, k);
      if (k === 0 && Math.hypot(x + 4 - CX, y + 4 - cy) < R + 8) { const a = Math.atan2(y + 4 - cy, x + 4 - CX); x = CX + Math.cos(a) * (R + 10) - 4; y = cy + Math.sin(a) * (R + 10) - 4; }
      sugar[i].setAttribute('x', x.toFixed(1)); sugar[i].setAttribute('y', y.toFixed(1));
      sugar[i].setAttribute('opacity', (f.sugar * (1 - k * 0.92)).toFixed(2));
    });
    [30, 150, 210, 330].forEach((deg, i) => {
      const a = deg * Math.PI / 180, far = R + 34, near = R + 7, inward = f.arrow > 0;
      const [r1, r2] = inward ? [far, near] : [near, far];
      const l = cellArrows[i];
      l.setAttribute('x1', (CX + r1 * Math.cos(a)).toFixed(1)); l.setAttribute('y1', (cy + r1 * Math.sin(a)).toFixed(1));
      l.setAttribute('x2', (CX + r2 * Math.cos(a)).toFixed(1)); l.setAttribute('y2', (cy + r2 * Math.sin(a)).toFixed(1));
      l.setAttribute('opacity', Math.abs(f.arrow).toFixed(2));
    });
    svg.dataset.water = f.arrow > 0.05 ? 'into-cells' : f.arrow < -0.05 ? 'out-of-cells' : 'none';
    spreadArrows.forEach((l, i) => {
      const x = [110, 370][i];
      l.setAttribute('x1', x); l.setAttribute('y1', (vy - 2).toFixed(1)); l.setAttribute('x2', x); l.setAttribute('y2', (TB - 22).toFixed(1));
      l.setAttribute('opacity', clamp(f.spread, 0, 1).toFixed(2));
    });
    if (labels) {
      tTissue.setAttribute('x', (tx + 10).toFixed(1)); tTissue.setAttribute('y', (ty + 20).toFixed(1));
      tCell.setAttribute('x', CX); tCell.setAttribute('y', (cy + 5).toFixed(1)); tCell.setAttribute('opacity', R > 36 ? 1 : 0);
      tVessel.setAttribute('y', Math.min(355, vy + vh + 18).toFixed(1));
    }
    if (barParts && f.shares) {
      let x = 8; const total = 464;
      f.shares.forEach((sh, i) => {
        const w = total * sh;
        barParts[i].rect.setAttribute('x', x.toFixed(1)); barParts[i].rect.setAttribute('width', Math.max(0, w).toFixed(1));
        barParts[i].text.setAttribute('x', i === 2 ? 472 : (x + 2).toFixed(1));
        x += w;
      });
    }
  }
  return { render };
}

export const NORMAL = { cell: 1, isf: 1, plasma: 1, conc: 1, protein: 1, sugar: 0, uptake: 0, arrow: 0, spread: 0 };

// Keyframes for a fluid, from the model's answer m: the fluid first spreads through the space
// outside cells, then water crosses cell membranes until every room matches.
export function fluidTimeline(m, { colloid = false, sugar = false } = {}) {
  const dir = Math.abs(m.cell - 1) > 0.01 ? Math.sign(m.cell - 1) : 0;
  const after = { cell: m.cell, isf: m.isf, plasma: m.plasma, conc: m.conc, protein: m.protein, sugar: sugar ? 1 : 0, uptake: sugar ? 1 : 0, arrow: dir * 0.45, spread: 0 };
  const pre = { cell: 1, isf: m.pre.isf, plasma: m.pre.plasma, conc: m.pre.conc, protein: m.protein, sugar: sugar ? 1 : 0, uptake: 0, arrow: 0, spread: colloid ? 0 : 1 };
  if (sugar) {
    const taken = { ...pre, conc: m.pre.concNoSugar, uptake: 1, spread: 0 };
    return { keys: [{ t: 0, ...NORMAL }, { t: 0.3, ...pre }, { t: 0.62, ...taken }, { t: 1, ...after }], shift: [0.62, 1], dir, spreadPhase: [0, 0.3], duration: 3800 };
  }
  return { keys: [{ t: 0, ...NORMAL }, { t: 0.45, ...pre }, { t: 1, ...after }], shift: [0.45, 1], dir, spreadPhase: [0, 0.45], duration: 2800 };
}
export function frameAt(tl, t) {
  const k = tl.keys;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[i], b = k[i + 1], local = ease(clamp((t - a.t) / (b.t - a.t), 0, 1));
  const f = {};
  for (const key of Object.keys(NORMAL)) f[key] = lerp(a[key], b[key], local);
  const [s0, s1] = tl.shift, p = clamp((t - s0) / (s1 - s0), 0, 1);
  f.arrow = tl.dir && p > 0 ? tl.dir * (0.45 + 0.55 * Math.sin(Math.PI * p)) : 0;
  const [p0, p1] = tl.spreadPhase, q = clamp((t - p0) / (p1 - p0), 0, 1);
  f.spread = b.spread || a.spread ? Math.sin(Math.PI * q) : 0;
  return f;
}
