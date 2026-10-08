// The Nephron and Diuretics · The Lab · the nephron picture
// One drawing shared by the lesson and Explore freely: a nephron whose arrows are sized by
// how much salt and water each segment takes back, the urine left at the end, and a gauge
// for blood volume. Sizes come from the model (model.js); nothing here carries a number.

export const NS = 'http://www.w3.org/2000/svg';
export const VB = { w: 360, h: 340 };

export function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
export function label(parent, x, y, s, cls = '', anchor = 'start') {
  return el('text', { x, y, class: `np-t ${cls}`.trim(), 'text-anchor': anchor }, parent, s);
}
export function frame(svg) {
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  svg.replaceChildren();
}

// ---------- geometry: the tube's centre line, from simple curves ----------
const quad = (a, c, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
const line = (a, b) => [a, b];
const arc = (cx, cy, r, from, to, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const th = (from + (to - from) * i / n) * Math.PI / 180;
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
});
const join = (...parts) => parts.reduce((all, p, i) => all.concat(i ? p.slice(1) : p), []);

export const SEG = {
  pt: join(quad([63, 68], [76, 40], [90, 66]), quad([90, 66], [104, 92], [114, 66]), quad([114, 66], [124, 40], [136, 66]), quad([136, 66], [143, 74], [142, 92], 6)),
  desc: line([142, 92], [142, 266]),
  thin: join(arc(156, 266, 14, 180, 0), line([170, 266], [170, 214])),
  tal: line([170, 214], [170, 108]),
  dct: join(quad([170, 108], [168, 78], [198, 80]), quad([198, 80], [228, 82], [232, 104])),
  cd: join(line([232, 104], [232, 296]), quad([232, 296], [232, 312], [248, 312], 6), line([248, 312], [262, 312])),
};
export const SEG_ORDER = ['pt', 'desc', 'thin', 'tal', 'dct', 'cd'];
export const pathD = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');

// A function from 0..1 to a point evenly spaced along a polyline.
export function along(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  return f => {
    const s = Math.min(1, Math.max(0, f)) * total;
    let j = 0;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t];
  };
}

// ---------- the parts ----------
export function bands(svg, labels) {
  const g = el('g', { class: 'np-bands' }, svg);
  el('rect', { x: 0, y: 12, width: 252, height: 112, class: 'np-cortex' }, g);
  [['np-m1', 124], ['np-m2', 184], ['np-m3', 244]].forEach(([c, y]) => el('rect', { x: 0, y, width: 252, height: 60, class: c }, g));
  if (labels) {
    label(g, 6, 117, 'outer layer', 'np-small');
    label(g, 6, 298, 'medulla: deep and salty', 'np-small np-strong');
  }
  return g;
}

export function tube(svg, highlight) {
  const g = el('g', { class: 'np-tube' }, svg);
  for (const k of [].concat(highlight || [])) {
    if (k === 'glom') el('circle', { cx: 42, cy: 72, r: 28, class: 'np-hi-dot' }, g);
    else el('path', { d: pathD(SEG[k]), class: 'np-hi' }, g);
  }
  el('path', { d: 'M2 61L28 67', class: 'np-vessel' }, g);
  el('path', { d: 'M28 78L2 85', class: 'np-vessel' }, g);
  el('circle', { cx: 42, cy: 72, r: 21, class: 'np-capsule' }, g);
  el('circle', { cx: 42, cy: 72, r: 13, class: 'np-tuft' }, g);
  el('path', { d: 'M31 70q3.5-8 7 0t7 0t7 0M33 77q3.5 6 7 0t7 0', class: 'np-tuft-line' }, g);
  for (const k of SEG_ORDER) el('path', { d: pathD(SEG[k]), class: 'np-wall' }, g);
  for (const k of SEG_ORDER) el('path', { d: pathD(SEG[k]), class: 'np-lumen' }, g);
  return g;
}

// Small icons: salt is a diamond, water a drop, so shape (not only colour) tells them apart.
export function saltIcon(parent, x, y, cls = 'np-salt') {
  return el('path', { d: 'M0 -4.5L4.5 0L0 4.5L-4.5 0Z', class: cls, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, parent);
}
export function dropIcon(parent, x, y, cls = 'np-drop') {
  return el('path', { d: 'M0 -6C2.5 -2.5 4.2 0 4.2 2.2A4.2 4.2 0 0 1 -4.2 2.2C-4.2 0 -2.5 -2.5 0 -6Z', class: cls, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, parent);
}
export const moveTo = (e, x, y) => e.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

// Arrows out of the tube ("back to the blood"), and potassium into it.
export const ARROWS = {
  ptSalt: { x: 76, y: 47, dir: 'up', len: 29, kind: 'salt' },
  ptWater: { x: 124, y: 47, dir: 'up', len: 29, kind: 'water' },
  descWater: { x: 136, y: 178, dir: 'left', len: 32, kind: 'water' },
  talSalt: { x: 179, y: 150, dir: 'right', len: 36, kind: 'salt' },
  dctSalt: { x: 200, y: 73, dir: 'up', len: 27, kind: 'salt' },
  cdSalt: { x: 225, y: 226, dir: 'left', len: 34, kind: 'salt' },
  cdWater: { x: 225, y: 258, dir: 'left', len: 34, kind: 'water' },
  cdK: { x: 258, y: 170, dir: 'left', len: 20, kind: 'k' },
};
export const ALL_ARROWS = Object.keys(ARROWS);
const UNIT = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function arrowPoints(a, w) {
  if (w < 0.3) return `${a.x},${a.y} ${a.x},${a.y} ${a.x},${a.y}`;
  const hw = w / 2, hh = Math.max(hw + 4, w * 0.75), hl = Math.min(a.len * 0.45, Math.max(8, w * 0.6));
  const loc = [[0, -hw], [a.len - hl, -hw], [a.len - hl, -hh], [a.len, 0], [a.len - hl, hh], [a.len - hl, hw], [0, hw]];
  const [ux, uy] = UNIT[a.dir];
  return loc.map(([s, c]) => `${(a.x + ux * s - uy * c).toFixed(1)},${(a.y + uy * s + ux * c).toFixed(1)}`).join(' ');
}

export function arrows(parent, keys, ghost) {
  const els = {};
  for (const k of keys) els[k] = el('polygon', { class: ghost ? 'np-ghost-shape' : `ar ar-${ARROWS[k].kind}`, 'data-arrow': k }, parent);
  return { els, set(v) { for (const k of keys) els[k].setAttribute('points', arrowPoints(ARROWS[k], v[k])); } };
}

export function urineBox(svg) {
  const g = el('g', { class: 'np-urine' }, svg);
  el('rect', { x: 262, y: 196, width: 92, height: 138, rx: 4, class: 'np-box' }, g);
  label(g, 308, 214, 'urine', 'np-strong', 'middle');
  el('line', { x1: 268, y1: 314.5, x2: 348, y2: 314.5, class: 'np-base' }, g);
  label(g, 287, 329, 'salt', 'np-small', 'middle');
  label(g, 331, 329, 'water', 'np-small', 'middle');
  return g;
}
export function urineBars(parent, ghost) {
  const cls = k => ghost ? 'np-ghost-shape' : `np-bar np-bar-${k}`;
  const salt = el('rect', { x: 272, width: 30, class: cls('salt'), 'data-bar': 'salt' }, parent);
  const water = el('rect', { x: 316, width: 30, class: cls('water'), 'data-bar': 'water' }, parent);
  return {
    salt, water,
    set(v) {
      for (const [r, h] of [[salt, v.uSalt], [water, v.uWater]]) { r.setAttribute('y', (314 - h).toFixed(1)); r.setAttribute('height', h.toFixed(1)); }
    },
  };
}

export function gauge(svg) {
  const g = el('g', { class: 'np-gauge' }, svg);
  label(g, 308, 30, 'blood volume', 'np-strong', 'middle');
  el('rect', { x: 284, y: 40, width: 48, height: 100, rx: 10, class: 'np-box' }, g);
  return g;
}
export function gaugeFill(parent, ghost) {
  const r = ghost ? el('line', { x1: 278, x2: 338, class: 'np-ghost-line', 'data-level': '' }, parent)
    : el('rect', { x: 287, width: 42, rx: 7, class: 'np-blood', 'data-level': '' }, parent);
  return {
    el: r,
    set(v) {
      const h = v.level * 94, y = 137 - h;
      if (ghost) { r.setAttribute('y1', y.toFixed(1)); r.setAttribute('y2', y.toFixed(1)); }
      else { r.setAttribute('y', y.toFixed(1)); r.setAttribute('height', h.toFixed(1)); }
    },
  };
}

// The "blocked" mark sits on the tube where each drug acts.
export const BLOCK_AT = { ca: [76, 52], loop: [170, 150], thiazide: [200, 80], ksp: [232, 226] };
export function blocker(parent, drug) {
  const [x, y] = BLOCK_AT[drug];
  const g = el('g', { class: 'np-block', 'data-block': drug }, parent);
  el('circle', { cx: x, cy: y, r: 9 }, g);
  el('line', { x1: x - 6, y1: y + 6, x2: x + 6, y2: y - 6 }, g);
  return g;
}

// An osmotic diuretic: particles that ride the whole tube and are never taken back.
export function mannitolDots(parent) {
  const g = el('g', { class: 'np-mannitol' }, parent);
  for (const k of SEG_ORDER) {
    const f = along(SEG[k]), n = { pt: 5, desc: 5, thin: 3, tal: 3, dct: 3, cd: 6 }[k];
    for (let i = 0; i < n; i++) { const [x, y] = f((i + 0.5) / n); el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6 }, g); }
  }
  return g;
}

export function key(svg, kinds) {
  const g = el('g', { class: 'np-key' }, svg);
  let x = 8;
  const y = 324;
  for (const kd of kinds) {
    if (kd === 'salt') saltIcon(g, x + 4, y - 4);
    else if (kd === 'water') dropIcon(g, x + 4, y - 3);
    else if (kd === 'k') el('polygon', { points: arrowPoints({ x: x + 13, y: y - 4, dir: 'left', len: 13 }, 3), class: 'ar ar-k' }, g);
    const word = { salt: 'salt', water: 'water', k: 'potassium' }[kd];
    label(g, x + (kd === 'k' ? 17 : 12), y, word, 'np-small');
    x += { salt: 44, water: 54, k: 80 }[kd];
  }
  return g;
}

// ---------- model → picture sizes ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const aw = v => Math.min(22, 2 + 2 * Math.sqrt(Math.max(0, v)));
const bar = v => Math.max(3, 84 * Math.min(1, Math.sqrt(Math.max(0, v) / 25)));
export function vis(m) {
  return {
    ptSalt: aw(m.s.pt), ptWater: aw(m.w.pt), descWater: aw(m.w.desc), talSalt: aw(m.s.tal),
    dctSalt: aw(m.s.dct), cdSalt: aw(m.s.cd), cdWater: aw(m.w.cd),
    cdK: Math.min(16, 2 + 4 * Math.sqrt(m.kDrive)),
    uSalt: bar(m.saltOut), uWater: bar(m.waterOut),
    level: clamp(0.72 - (1 - m.bv) * 2.8, 0.12, 0.92),
  };
}
export const lerpVis = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * t]));
export const scaleArrows = (v, t, keys) => ({ ...v, ...Object.fromEntries(keys.map(k => [k, v[k] * t])) });

// The whole nephron, live, with an optional dashed ghost of a reference state.
export function fullScene(svg, { ghost = true } = {}) {
  frame(svg);
  bands(svg, true);
  tube(svg);
  urineBox(svg);
  gauge(svg);
  const man = mannitolDots(svg);
  const live = el('g', { 'data-live': '' }, svg);
  const la = arrows(live, ALL_ARROWS), lu = urineBars(live), lg = gaugeFill(live);
  const blocks = Object.fromEntries(Object.keys(BLOCK_AT).map(d => [d, blocker(svg, d)]));
  let gh = null;
  if (ghost) {
    const gg = el('g', { 'data-ghost': '', class: 'np-ghost' }, svg);
    gh = { a: arrows(gg, ALL_ARROWS, true), u: urineBars(gg, true), g: gaugeFill(gg, true) };
  }
  key(svg, ['salt', 'water', 'k']);
  return {
    live, urine: lu,
    set(v) { la.set(v); lu.set(v); lg.set(v); },
    setGhost(v) { if (gh) { gh.a.set(v); gh.u.set(v); gh.g.set(v); } },
    setDrugs(d, t = 1) {
      for (const [k, g] of Object.entries(blocks)) g.style.opacity = String(Math.min(1, (d[k] || 0) * 1.4) * t);
      man.style.opacity = String((d.osmotic || 0) * t);
    },
  };
}
