// Pressure–Volume Loop · The Lab · guided lesson
// Every loop in the lesson comes from the same model as Explore freely (model.js), run to a
// steady beat. It is drawn with worded axes and no numbers: the shapes carry the idea.
import { Simulator, DEFAULTS } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const VB = { w: 360, h: 290 };
const O = { x: 34, y: 254, top: 30, right: 350 }; // plot area: origin bottom-left
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// "What changes the loop": model settings changed from baseline. Where clinical-values.json
// has the matching state, these are that state's own model settings, so the lesson, the
// Clinical values tab and Explore freely all show the same ventricle.
const CONDITIONS = {
  fluids: { set: { Pla: 8 } },                           // as Explore freely's "↑ Preload" scenario
  afterload: { set: { Rs: 2 }, state: 'vasocon' },
  inotrope: { set: { Ees: 5 }, state: 'inotrope' },
  venodil: { set: { Pla: 2 }, state: 'venodil' },
  beta: { set: { HR: 56, Ees: 2.8 }, state: 'beta' },
  hfref: { set: { Ees: 1.3, Pla: 9, HR: 85 }, state: 'hfref' },
};
// Model outputs under the ids clinical-values.json uses, for the direction-of-change record.
const OUT = { edv: b => b.EDV, esv: b => b.ESV, sv: b => b.SV, ef: b => b.EF, co: b => b.CO, hr: b => b.HR, lvsp: b => b.PlvMax, map: b => b.PaoMean };

// ---------- model: steady beats and a shared scale ----------
const beats = { base: new Simulator({ ...DEFAULTS }).runToSteady(300) };
for (const [k, c] of Object.entries(CONDITIONS)) beats[k] = new Simulator({ ...DEFAULTS, ...c.set }).runToSteady(300);
let vMax = 0, pMax = 0;
for (const b of Object.values(beats)) { vMax = Math.max(vMax, b.EDV); pMax = Math.max(pMax, b.PlvMax); }
vMax *= 1.12; pMax *= 1.1;
const LIFT = 12; // filling runs near zero pressure: keep the bottom edge clear of the axis line
const X = v => O.x + v / vMax * (O.right - O.x);
const Y = p => O.y - LIFT - p / pMax * (O.y - LIFT - O.top);

function directions(base, b) {
  const out = {};
  for (const [k, f] of Object.entries(OUT)) {
    const a = f(base), c = f(b), tol = Math.max(Math.abs(a) * 0.02, 1e-6);
    out[k] = Math.abs(c - a) < tol ? 'none' : c > a ? 'up' : 'down';
  }
  return out;
}

// A beat as four edges, each resampled to a fixed number of points evenly spaced along the
// drawn line, so any two loops can be morphed point by point and edges can be drawn in turn.
const EDGES = [['contract', 'AO', 20], ['eject', 'AC', 56], ['relax', 'MO', 20], ['fill', null, 56]];
function shape(b) {
  const ev = Object.fromEntries(b.events.map(e => [e.kind, e.i]));
  const out = {};
  let from = 0;
  for (const [name, endKind, count] of EDGES) {
    const to = endKind ? ev[endKind] : b.n - 1;
    const xs = [], ys = [], cum = [0];
    for (let i = from; i <= to; i++) { xs.push(X(b.V[i])); ys.push(Y(b.Plv[i])); }
    for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const total = cum[cum.length - 1] || 1, pts = [];
    for (let k = 0, j = 0; k <= count; k++) {
      const s = total * k / count;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const span = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (s - cum[j]) / span));
      const j1 = Math.min(j + 1, xs.length - 1);
      pts.push([xs[j] + (xs[j1] - xs[j]) * t, ys[j] + (ys[j1] - ys[j]) * t]);
    }
    out[name] = pts;
    from = to;
  }
  return out;
}
const shapes = Object.fromEntries(Object.entries(beats).map(([k, b]) => [k, shape(b)]));
const LOOP_ORDER = ['fill', 'contract', 'eject', 'relax']; // teaching order: filling first
const loopPts = s => LOOP_ORDER.flatMap(k => s[k]);
const pathD = (pts, close) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');
const lerpPts = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// ---------- SVG helpers ----------
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
function label(parent, x, y, s, cls = '', anchor = 'start') {
  return el('text', { x, y, class: `lp-t ${cls}`, 'text-anchor': anchor }, parent, s);
}
function arrowHead(parent, x, y, dir, cls = 'lp-axis-head') {
  const d = { up: `M${x} ${y}l-5 9h10z`, right: `M${x} ${y}l-9 -5v10z`, down: `M${x} ${y}l-5 -9h10z`, left: `M${x} ${y}l9 -5v10z` }[dir];
  return el('path', { d, class: cls }, parent);
}
function arrow(parent, x1, y1, x2, y2, cls = 'lp-arrow') {
  const g = el('g', { class: cls }, parent);
  el('line', { x1, y1, x2, y2 }, g);
  const a = Math.atan2(y2 - y1, x2 - x1), s = 8;
  el('path', { d: `M${x2} ${y2}L${(x2 - s * Math.cos(a - 0.45)).toFixed(1)} ${(y2 - s * Math.sin(a - 0.45)).toFixed(1)}L${(x2 - s * Math.cos(a + 0.45)).toFixed(1)} ${(y2 - s * Math.sin(a + 0.45)).toFixed(1)}Z` }, g);
  return g;
}
function axes(svg) {
  const g = el('g', { class: 'lp-axes' }, svg);
  el('line', { x1: O.x, y1: O.y, x2: O.x, y2: O.top - 10 }, g);
  el('line', { x1: O.x, y1: O.y, x2: VB.w - 6, y2: O.y }, g);
  arrowHead(g, O.x, O.top - 16, 'up');
  arrowHead(g, VB.w - 2, O.y, 'right');
  label(svg, O.x + 10, O.top - 8, 'pressure ↑', 'lp-axis-label');
  label(svg, VB.w - 4, O.y + 24, 'volume →', 'lp-axis-label', 'end');
}
function valves(svg, mitral, aortic) {
  const g = el('g', { class: 'lp-valves' }, svg);
  [['mitral', mitral], ['aortic', aortic]].forEach(([name, open], i) => {
    const x = O.x + 10 + i * 102, y = O.top + 6;
    el('rect', { x, y, width: 96, height: 26, rx: 13, class: open ? 'lp-pill open' : 'lp-pill' }, g);
    label(g, x + 48, y + 17.5, `${name}: ${open ? 'open' : 'shut'}`, `lp-pill-t${open ? ' open' : ''}`, 'middle');
  });
}
const corner = (s, edge, end) => s[edge][end ? s[edge].length - 1 : 0];
// The normal loop, with one edge (if any) traced over in blue.
function lever(svg, edge) {
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  axes(svg);
  const s = shapes.base;
  el('path', { d: pathD(loopPts(s), true), class: 'lp-loop' }, svg);
  if (edge) el('path', { d: pathD(s[edge]), class: 'lp-edge' }, svg);
  return s;
}

// ---------- the visuals ----------
// Each builder fills its SVG and returns { animate, render(t) } where t runs 0 → 1.
const BUILD = {
  heart(svg) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    const g = el('g', { class: 'hd' }, svg);
    // aorta: a tube rising from the ventricle and arching off to the body
    el('path', { d: 'M118 106V40Q118 16 142 16H186V40H170Q162 40 162 48V106Z', class: 'hd-vessel' }, g);
    // left atrium, then the ventricle, drawn as filled chambers
    el('rect', { x: 18, y: 40, width: 86, height: 68, rx: 24, class: 'hd-chamber' }, g);
    el('path', { d: 'M18 104H176C182 170 152 236 98 276C44 236 14 170 18 104Z', class: 'hd-chamber' }, g);
    // openings between them, so the wall line does not run across the valves
    el('rect', { x: 34, y: 98, width: 54, height: 12, class: 'hd-gap' }, g);
    el('rect', { x: 120, y: 98, width: 40, height: 12, class: 'hd-gap' }, g);
    // mitral valve open (leaflets hang into the ventricle); aortic valve shut while it fills
    el('path', { d: 'M34 104L46 130M88 104L76 130', class: 'hd-leaf' }, g);
    el('path', { d: 'M119 104L140 113L161 104', class: 'hd-leaf' }, g);
    arrow(g, 61, 22, 61, 156, 'hd-flow');
    arrow(g, 188, 28, 210, 28, 'hd-flow hd-flow-out');
    label(g, 8, 14, 'from the lungs', 'lp-small');
    label(g, 214, 32, 'to the body', 'lp-small');
    // labels with short definitions
    const tags = [
      [74, 'Aorta', 'main pipe to the body', 150, 66],
      [122, 'Left atrium', 'small holding chamber', 96, 76],
      [170, 'Aortic valve', 'outlet door', 152, 108],
      [218, 'Mitral valve', 'inlet door', 80, 118],
      [266, 'Left ventricle', 'the main pump', 140, 200],
    ];
    for (const [y, name, what, tx, ty] of tags) {
      el('line', { x1: 216, y1: y - 6, x2: tx, y2: ty, class: 'hd-lead' }, g);
      el('circle', { cx: tx, cy: ty, r: 3, class: 'hd-dot' }, g);
      label(g, 220, y - 4, name, 'lp-strong');
      label(g, 220, y + 12, what, 'lp-small');
    }
    return { animate: false, render() {} };
  },

  axes(svg) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const b = beats.base;
    const pts = [[X(b.ESV * 0.9), Y(pMax * 0.04), 'nearly empty, relaxed', 'start', 10, -14], [X(b.EDV * 1.02), Y(pMax * 0.7), 'full, squeezing hard', 'end', -12, -14]];
    for (const [x, y, s, anchor, dx, dy] of pts) {
      el('line', { x1: x, y1: y, x2: x, y2: O.y, class: 'lp-guide' }, svg);
      el('line', { x1: O.x, y1: y, x2: x, y2: y, class: 'lp-guide' }, svg);
      el('circle', { cx: x, cy: y, r: 7, class: 'lp-dot' }, svg);
      label(svg, x + dx, y + dy, s, 'lp-strong', anchor);
    }
    label(svg, O.x + 6, O.y + 24, 'empty', 'lp-small');
    return { animate: false, render() {} };
  },

  // The four phases: earlier edges stay drawn in grey, the new edge draws itself in red.
  phase(svg, which) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const s = shapes.base, upto = LOOP_ORDER.indexOf(which);
    const v = { fill: [true, false], contract: [false, false], eject: [false, true], relax: [false, false] }[which];
    valves(svg, ...v);
    for (const k of LOOP_ORDER.slice(0, upto)) el('path', { d: pathD(s[k]), class: 'lp-done' }, svg);
    const live = el('path', { d: '', class: 'lp-loop lp-now' }, svg);
    const dot = el('circle', { r: 7, class: 'lp-dot' }, svg);
    const pts = s[which];
    const tag = {
      fill: [(corner(s, 'fill', 0)[0] + corner(s, 'fill', 1)[0]) / 2, corner(s, 'fill', 1)[1] - 14, 'filling', 'middle'],
      contract: [corner(s, 'contract', 0)[0] + 10, (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2, 'squeeze', 'start'],
      eject: [(corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2, Math.min(...s.eject.map(p => p[1])) - 12, 'ejection', 'middle'],
      relax: [corner(s, 'relax', 0)[0] - 10, (corner(s, 'relax', 0)[1] + corner(s, 'relax', 1)[1]) / 2, 'relax', 'end'],
    }[which];
    label(svg, tag[0], tag[1], tag[2], 'lp-strong lp-red', tag[3]);
    return {
      animate: true, duration: 1800,
      render(t) {
        const n = Math.max(2, Math.round(1 + ease(t) * (pts.length - 1)));
        live.setAttribute('d', pathD(pts.slice(0, n)));
        const p = pts[n - 1];
        dot.setAttribute('cx', p[0].toFixed(1)); dot.setAttribute('cy', p[1].toFixed(1));
      },
    };
  },

  loop(svg) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const s = shapes.base, pts = loopPts(s);
    el('path', { d: pathD(pts, true), class: 'lp-loop' }, svg);
    const top = Math.min(...s.eject.map(p => p[1]));
    label(svg, (corner(s, 'fill', 0)[0] + corner(s, 'fill', 1)[0]) / 2, corner(s, 'fill', 1)[1] - 14, '1 filling', 'lp-strong', 'middle');
    label(svg, corner(s, 'contract', 0)[0] + 10, (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2, '2 squeeze', 'lp-strong', 'start');
    label(svg, (corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2, top - 12, '3 ejection', 'lp-strong', 'middle');
    label(svg, corner(s, 'relax', 0)[0] - 10, (corner(s, 'relax', 0)[1] + corner(s, 'relax', 1)[1]) / 2, '4 relax', 'lp-strong', 'end');
    const dot = el('circle', { r: 7, class: 'lp-dot' }, svg);
    return {
      animate: true, duration: 6000,
      render(t) {
        // two laps, then rest at the start of filling
        const f = t >= 1 ? 0 : (t * 2) % 1, p = pts[Math.round(f * (pts.length - 1))];
        dot.setAttribute('cx', p[0].toFixed(1)); dot.setAttribute('cy', p[1].toFixed(1));
      },
    };
  },

  sv(svg) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const s = shapes.base, b = beats.base;
    el('path', { d: pathD(loopPts(s), true), class: 'lp-loop' }, svg);
    const xl = X(b.ESV), xr = X(b.EDV), y = Y(pMax * 0.36);
    for (const x of [xl, xr]) el('line', { x1: x, y1: O.top + 30, x2: x, y2: O.y, class: 'lp-guide' }, svg);
    arrow(svg, (xl + xr) / 2, y, xl + 2, y, 'lp-arrow lp-arrow-red');
    arrow(svg, (xl + xr) / 2, y, xr - 2, y, 'lp-arrow lp-arrow-red');
    label(svg, (xl + xr) / 2, y - 10, 'stroke volume', 'lp-strong lp-red', 'middle');
    label(svg, xl, O.y + 18, 'after pumping', 'lp-small', 'middle');
    label(svg, xr, O.y + 18, 'full', 'lp-small', 'middle');
    return { animate: false, render() {} };
  },

  ef(svg) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const s = shapes.base, b = beats.base;
    el('path', { d: pathD(loopPts(s), true), class: 'lp-loop lp-soft' }, svg);
    const x0 = X(0), xl = X(b.ESV), xr = X(b.EDV), y = O.top + 22, h = 26;
    el('rect', { x: x0, y, width: xl - x0, height: h, class: 'ef-left' }, svg);
    el('rect', { x: xl, y, width: xr - xl, height: h, class: 'ef-out' }, svg);
    el('rect', { x: x0, y, width: xr - x0, height: h, class: 'ef-frame' }, svg);
    label(svg, (x0 + xl) / 2, y + 17.5, 'left behind', 'lp-small lp-strong', 'middle');
    label(svg, (xl + xr) / 2, y + 17.5, 'pumped out', 'lp-strong lp-on-red', 'middle');
    label(svg, x0, y - 6, 'empty', 'lp-small');
    label(svg, xr, y - 6, 'full', 'lp-small', 'end');
    for (const x of [xl, xr]) el('line', { x1: x, y1: y + h, x2: x, y2: O.y, class: 'lp-guide' }, svg);
    return { animate: false, render() {} };
  },

  // Preload, afterload, contractility: one step each, the loop with the part it governs
  // picked out in blue and one arrow showing which way more of it moves that part.
  preload(svg) {
    const s = lever(svg, 'contract');
    const xr = corner(s, 'contract', 0)[0], yMid = (corner(s, 'contract', 0)[1] + corner(s, 'contract', 1)[1]) / 2;
    arrow(svg, xr + 8, yMid, xr + 40, yMid, 'lp-arrow lp-arrow-blue');
    label(svg, xr + 8, yMid - 12, 'preload', 'lp-strong lp-blue');
    label(svg, xr + 8, yMid + 24, 'more filling', 'lp-small');
    return { animate: false, render() {} };
  },
  afterload(svg) {
    const s = lever(svg, 'eject');
    const top = Math.min(...s.eject.map(p => p[1]));
    const xm = (corner(s, 'eject', 0)[0] + corner(s, 'eject', 1)[0]) / 2;
    arrow(svg, xm, top - 40, xm, top - 8, 'lp-arrow lp-arrow-blue');
    label(svg, xm + 8, top - 30, 'afterload', 'lp-strong lp-blue');
    label(svg, xm + 8, top - 14, 'push-back', 'lp-small');
    return { animate: false, render() {} };
  },
  contractility(svg) {
    const s = lever(svg);
    const c = corner(s, 'relax', 0);
    el('circle', { cx: c[0], cy: c[1], r: 9, class: 'lp-spot' }, svg);
    arrow(svg, c[0] - 8, c[1] - 8, c[0] - 38, c[1] - 38, 'lp-arrow lp-arrow-blue');
    label(svg, c[0] - 30, c[1] - 48, 'contractility', 'lp-strong lp-blue', 'middle');
    label(svg, c[0] + 16, c[1] + 26, 'stronger squeeze', 'lp-small');
    return { animate: false, render() {} };
  },

  // Normal loop morphs into the condition's loop; the normal one stays as a faint ghost.
  cond(svg, key) {
    svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    axes(svg);
    const from = loopPts(shapes.base), to = loopPts(shapes[key]);
    el('path', { d: pathD(from, true), class: 'lp-ghost', 'data-ghost': '' }, svg);
    const live = el('path', { d: pathD(from, true), class: 'lp-loop', 'data-loop': '', 'data-final': pathD(to, true) }, svg);
    return {
      animate: true, duration: 2400,
      render(t) {
        // hold the normal loop for a moment, then morph
        const k = ease(Math.min(1, Math.max(0, (t - 0.2) / 0.8)));
        live.setAttribute('d', k >= 1 ? pathD(to, true) : pathD(lerpPts(from, to, k), true));
      },
    };
  },
};

// ---------- steps ----------
const panel = document.getElementById('lpanel-lesson');
const steps = [...panel.querySelectorAll('[data-step]')];
const N = steps.length;
const back = panel.querySelector('[data-step-back]'), next = panel.querySelector('[data-step-next]');
const progress = panel.querySelector('[data-step-progress]'), bar = document.getElementById('step-bar');
const visuals = steps.map(step => {
  const svg = step.querySelector('svg.lp'), kind = step.dataset.visual;
  const v = kind === 'cond' ? BUILD.cond(svg, step.dataset.condition)
    : ['fill', 'contract', 'eject', 'relax'].includes(kind) ? BUILD.phase(svg, kind) : BUILD[kind](svg);
  if (kind === 'cond') {
    const c = CONDITIONS[step.dataset.condition];
    // A machine-readable record of which way the model moves each value, for checking
    // against the directions in clinical-values.json.
    step.dataset.modelShifts = JSON.stringify(directions(beats.base, beats[step.dataset.condition]));
    if (c.state) step.dataset.state = c.state;
    step.dataset.modelSet = JSON.stringify(c.set);
  }
  v.svg = svg;
  return v;
});

let cur = -1, raf = 0;
function stop() { cancelAnimationFrame(raf); raf = 0; }
function play(i) {
  stop();
  const v = visuals[i];
  if (!v.animate || reduceMotion.matches || panel.hidden) { v.render(1); v.svg.dataset.anim = 'done'; return; }
  v.svg.dataset.anim = 'running';
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / v.duration);
    v.render(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else { raf = 0; v.svg.dataset.anim = 'done'; }
  };
  v.render(0);
  raf = requestAnimationFrame(tick);
}

function show(i, { focus = false, hash = true } = {}) {
  i = Math.max(0, Math.min(N - 1, i));
  const changed = i !== cur;
  cur = i;
  steps.forEach((s, k) => { s.hidden = k !== i; });
  back.disabled = i === 0;
  const last = i === N - 1;
  next.innerHTML = last ? 'Explore freely<span aria-hidden="true"> →</span>' : 'Next<span aria-hidden="true"> →</span>';
  progress.textContent = `Step ${i + 1} of ${N}`;
  bar.style.width = `${(i + 1) / N * 100}%`;
  if (hash && location.hash !== `#step-${i + 1}`) history.replaceState(null, '', `#step-${i + 1}`);
  if (changed) play(i);
  if (focus) steps[i].querySelector('h2').focus();
}

function fromHash() {
  const m = /^#step-(\d+)$/.exec(location.hash);
  return m ? Number(m[1]) - 1 : null;
}

back.addEventListener('click', () => show(cur - 1, { focus: true }));
next.addEventListener('click', () => {
  if (cur < N - 1) { show(cur + 1, { focus: true }); return; }
  document.getElementById('ltab-explore').click();
  document.getElementById('h-explore').focus();
});
for (const [i, step] of steps.entries()) {
  const r = step.querySelector('[data-replay]');
  if (r) r.addEventListener('click', () => play(i));
}
panel.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target.closest('input, select, textarea, [contenteditable]')) return;
  if (e.key === 'ArrowRight' && cur < N - 1) { e.preventDefault(); show(cur + 1, { focus: true }); }
  else if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); show(cur - 1, { focus: true }); }
});
window.addEventListener('hashchange', () => {
  const i = fromHash();
  if (i === null) return;
  const tab = document.getElementById('ltab-lesson');
  if (tab.getAttribute('aria-selected') !== 'true') tab.click();
  show(i);
});
// Leaving the lesson stops the animation; coming back replays the current step.
new MutationObserver(() => { if (panel.hidden) stop(); else play(cur); })
  .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
reduceMotion.addEventListener('change', () => play(cur));

const start = fromHash();
show(start ?? 0, { hash: false });
