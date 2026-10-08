// The Nephron and Diuretics · The Lab · guided lesson
// Every arrow, bar and gauge in the lesson is sized by the same model as Explore freely
// (model.js). The pictures carry words, not numbers: the sizes carry the idea.
import { run, NO_DRUG } from './model.js';
import { ready } from './ref.js';
import {
  el, label, frame, bands, tube, key, arrows, urineBox, urineBars, gauge, gaugeFill, fullScene,
  saltIcon, dropIcon, moveTo, along, SEG, vis, lerpVis, scaleArrows, ALL_ARROWS,
} from './nephron.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const clamp01 = t => Math.min(1, Math.max(0, t));

// "What changes it": each drug at the model's strongest setting. Where clinical-values.json has
// a matching state, its model settings are the same, so all three tabs show one nephron.
const DRUG_STEPS = {
  loop: { set: { loop: 1 } },
  thiazide: { set: { thiazide: 1 } },
  ksp: { set: { ksp: 1 } },
  ca: { set: { ca: 1 } },
  osmotic: { set: { osmotic: 1 } },
};
// Model outputs under the ids clinical-values.json uses, for the direction-of-change record.
const OUT = {
  urine: m => m.urine, pt_na: m => m.s.pt, tal_na: m => m.s.tal, dct_na: m => m.s.dct,
  cd_na: m => m.s.cd, fena: m => m.saltOut, k: m => m.k, hco3: m => m.hco3,
};
// If the reference data cannot load, the lesson still steps through its words, with a visible note.
let cv = null;
try { cv = await ready; } catch (e) {
  const note = document.createElement('p');
  note.className = 'notice';
  note.setAttribute('role', 'alert');
  note.textContent = 'The pictures could not be drawn because the lesson\'s reference data did not load. Reload the page to try again; the steps below still read in order.';
  document.getElementById('lpanel-lesson').prepend(note);
}
const base = cv ? run(NO_DRUG) : null, BV = cv ? vis(base) : null;
function directions(a, b) {
  const out = {};
  for (const [k, f] of Object.entries(OUT)) {
    const x = f(a), y = f(b), tol = Math.max(Math.abs(x) * 0.02, 1e-6);
    out[k] = Math.abs(y - x) < tol ? 'none' : y > x ? 'up' : 'down';
  }
  return out;
}

const still = { animate: false, render() {} };

// The arrows each segment step adds, in teaching order; earlier ones stay, faded.
const BUILD_UP = [
  ['pt', ['ptSalt', 'ptWater']],
  ['desc', ['descWater']],
  ['tal', ['talSalt']],
  ['dct', ['dctSalt']],
  ['cd', ['cdSalt', 'cdK']],
  ['cd', ['cdWater']],
];
const SEG_LABELS = {
  0: [[136, 110, 'proximal tubule', 'np-strong', 'end'], [62, 26, 'salt', 'np-strong', 'end'], [142, 26, 'water', 'np-strong', 'start']],
  1: [[6, 146, 'loop of Henle,', 'np-strong', 'start'], [6, 162, 'going down', 'np-strong', 'start'], [98, 183, 'water', 'np-strong', 'end']],
  2: [[246, 134, 'thick', 'np-strong', 'start'], [246, 150, 'ascending limb', 'np-strong', 'start'], [246, 168, 'walls block water', 'np-small', 'start'], [197, 136, 'salt', 'np-strong', 'middle']],
  3: [[246, 96, 'early distal', 'np-strong', 'start'], [246, 112, 'tubule', 'np-strong', 'start'], [246, 128, 'walls block water', 'np-small', 'start'], [200, 40, 'salt', 'np-strong', 'middle']],
  4: [[246, 120, 'collecting duct', 'np-strong', 'start'], [205, 212, 'salt', 'np-strong', 'middle'], [262, 167, 'potassium', 'np-small np-strong', 'start'], [262, 182, 'into the urine', 'np-small', 'start']],
  5: [[246, 120, 'collecting duct', 'np-strong', 'start'], [205, 244, 'water', 'np-strong', 'middle']],
};

const BUILD = {
  meet(svg) {
    frame(svg);
    bands(svg, false);
    tube(svg);
    label(svg, 42, 112, 'filter', 'np-strong', 'middle');
    label(svg, 6, 190, 'one long,', 'np-strong');
    label(svg, 6, 206, 'folded tube', 'np-strong');
    el('line', { x1: 80, y1: 196, x2: 134, y2: 196, class: 'np-lead' }, svg);
    label(svg, 274, 317, 'urine out,', 'np-strong');
    label(svg, 274, 333, 'to the bladder', 'np-small');
    const k = el('g', { class: 'np-kidney' }, svg);
    el('path', { d: 'M298 30C324 20 352 42 350 80C348 114 326 138 302 132C288 128 291 112 298 102C304 94 304 74 296 66C288 58 278 62 274 52C270 40 284 34 298 30Z', class: 'np-bean' }, k);
    for (const [x1, y1, x2, y2] of [[312, 46, 328, 52], [318, 66, 336, 70], [318, 88, 336, 90], [312, 108, 328, 114]]) el('line', { x1, y1, x2, y2, class: 'np-bean-line' }, k);
    el('circle', { cx: 330, cy: 88, r: 4, class: 'np-bean-dot' }, k);
    label(svg, 312, 152, 'one kidney', 'np-strong', 'middle');
    label(svg, 312, 168, 'packed with', 'np-small', 'middle');
    label(svg, 312, 184, 'nephrons', 'np-small', 'middle');
    return still;
  },

  filter(svg) {
    frame(svg);
    bands(svg, false);
    tube(svg, 'glom');
    label(svg, 2, 36, 'blood in', 'np-small np-strong');
    label(svg, 42, 118, 'filter', 'np-strong', 'middle');
    label(svg, 104, 112, 'filtrate', 'np-strong', 'middle');
    const f = along(SEG.pt), n = 10, parts = [];
    for (let i = 0; i < n; i++) parts.push(i % 3 === 1 ? saltIcon(svg, 0, 0) : dropIcon(svg, 0, 0));
    key(svg, ['salt', 'water']);
    return {
      animate: true, duration: 5000,
      render(t) {
        parts.forEach((p, i) => {
          const s = ((t >= 1 ? 0 : t * 3) + i / n) % 1;
          const [x, y] = f(s);
          moveTo(p, x, y);
        });
      },
    };
  },

  back(svg) {
    frame(svg);
    const top = 44, bottom = 286, H = bottom - top;
    const cols = [[22, 'filtered', 'each day', 'np-col-filt'], [136, 'taken back', 'into the blood', 'np-col-back'], [250, 'left as', 'urine', 'np-col-urine']];
    const rects = cols.map(([x, a, b, cls]) => {
      el('rect', { x, y: top, width: 88, height: H, class: 'np-col-frame' }, svg);
      label(svg, x + 44, bottom + 20, a, 'np-strong', 'middle');
      label(svg, x + 44, bottom + 36, b, 'np-strong', 'middle');
      return el('rect', { x, width: 88, class: cls }, svg);
    });
    el('line', { x1: 14, y1: bottom + 0.5, x2: 346, y2: bottom + 0.5, class: 'np-base' }, svg);
    const urineH = Math.max(3, H * base.waterOut / 100);
    const sliver = label(svg, 294, bottom - 22, 'only a sliver', 'np-strong', 'middle');
    el('path', { d: `M294 ${bottom - 16}V${bottom - 6}`, class: 'np-lead' }, svg);
    const set = (r, h) => { r.setAttribute('y', (bottom - h).toFixed(1)); r.setAttribute('height', h.toFixed(1)); };
    return {
      animate: true, duration: 2600,
      render(t) {
        const k = ease(clamp01((t - 0.15) / 0.75));
        set(rects[0], H);
        set(rects[1], (H - urineH) * k);
        set(rects[2], urineH);
        sliver.style.opacity = String(clamp01((t - 0.7) / 0.3));
      },
    };
  },

  osmosis(svg) {
    frame(svg);
    el('rect', { x: 10, y: 50, width: 150, height: 236, class: 'np-lumen-box' }, svg);
    el('rect', { x: 200, y: 50, width: 150, height: 236, class: 'np-blood-box' }, svg);
    for (const y of [50, 130, 210]) el('rect', { x: 162, y: y + 2, width: 36, height: 74, rx: 10, class: 'np-cell' }, svg);
    for (const y of [90, 170, 250]) el('circle', { cx: 180, cy: y, r: 5, class: 'np-carrier' }, svg);
    label(svg, 85, 40, 'inside the tube', 'np-strong', 'middle');
    label(svg, 275, 40, 'blood', 'np-strong', 'middle');
    label(svg, 180, 302, 'tube wall', 'np-small', 'middle');
    label(svg, 180, 320, 'salt is carried across;', 'np-strong', 'middle');
    label(svg, 180, 336, 'water follows on its own', 'np-strong', 'middle');
    const S = [[40, 80, 1, 230, 96, 90], [112, 72, 0], [70, 132, 1, 300, 150, 170], [130, 160, 1, 248, 206, 170], [40, 204, 0], [104, 236, 1, 318, 256, 250], [64, 270, 0]];
    const D = [[30, 104, 1, 226, 132, 90], [90, 100, 0], [134, 108, 1, 324, 112, 90], [56, 160, 1, 270, 186, 170], [104, 184, 0], [30, 236, 1, 232, 236, 250],
      [140, 214, 0], [82, 262, 1, 290, 272, 250], [128, 270, 1, 334, 214, 170], [52, 66, 0], [100, 150, 0], [134, 246, 0]];
    for (const [x, y] of [[290, 72], [244, 268]]) saltIcon(svg, x, y);
    for (const [x, y] of [[220, 160], [330, 80], [272, 236], [318, 176]]) dropIcon(svg, x, y);
    const mk = (list, icon) => list.map(([x, y, moves, tx, ty, door]) => ({ e: icon(svg, x, y), x, y, moves, tx, ty, door }));
    const salts = mk(S, saltIcon), drops = mk(D, dropIcon);
    const place = (p, k) => {
      if (!p.moves) return;
      // in to the wall, through it at a carrier or between cells, then out into the blood
      const pts = [[p.x, p.y], [156, p.door], [204, p.door], [p.tx, p.ty]];
      const seg = Math.min(2, Math.floor(k * 3)), u = k * 3 - seg;
      const a = pts[seg], b = pts[seg + 1];
      moveTo(p.e, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
    };
    return {
      animate: true, duration: 4200,
      render(t) {
        salts.forEach((p, i) => place(p, ease(clamp01((t - 0.06 - i * 0.02) / 0.4))));
        drops.forEach((p, i) => place(p, ease(clamp01((t - 0.5 - i * 0.015) / 0.42))));
      },
    };
  },

  // Segment steps: the new arrows grow in; the ones met earlier stay, faded.
  seg(svg, idx) {
    frame(svg);
    bands(svg, idx >= 1);
    tube(svg, BUILD_UP[idx][0]);
    const old = BUILD_UP.slice(0, idx).flatMap(b => b[1]), fresh = BUILD_UP[idx][1];
    const og = el('g', { class: 'np-old' }, svg);
    arrows(og, old).set(BV);
    const nw = arrows(svg, fresh);
    for (const [x, y, s, cls, a] of SEG_LABELS[idx]) label(svg, x, y, s, cls, a);
    key(svg, ['salt', 'water', ...(idx >= 4 ? ['k'] : [])]);
    return { animate: true, duration: 1300, render(t) { nw.set(scaleArrows(BV, ease(t), fresh)); } };
  },

  whole(svg) {
    frame(svg);
    bands(svg, true);
    tube(svg);
    urineBox(svg);
    const a = arrows(svg, ALL_ARROWS), u = urineBars(svg);
    key(svg, ['salt', 'water', 'k']);
    const order = ['ptSalt', 'ptWater', 'descWater', 'talSalt', 'dctSalt', 'cdSalt', 'cdK', 'cdWater'];
    return {
      animate: true, duration: 3200,
      render(t) {
        const v = { ...BV };
        order.forEach((k, i) => { v[k] = BV[k] * ease(clamp01(t * 1.25 * order.length - i)); });
        const k = ease(clamp01((t - 0.8) / 0.2));
        v.uSalt = Math.max(0.01, BV.uSalt * k); v.uWater = Math.max(0.01, BV.uWater * k);
        a.set(v); u.set(v);
      },
    };
  },

  volume(svg) {
    frame(svg);
    bands(svg, true);
    tube(svg);
    urineBox(svg);
    gauge(svg);
    arrows(svg, ALL_ARROWS).set(BV);
    urineBars(svg).set(BV);
    gaugeFill(svg).set(BV);
    key(svg, ['salt', 'water', 'k']);
    return still;
  },

  // Normal → drug: everything morphs from the normal nephron, which stays as a dashed ghost.
  drug(svg, drug) {
    const c = DRUG_STEPS[drug];
    const m = run({ ...NO_DRUG, ...c.set }), to = vis(m);
    const sc = fullScene(svg, { ghost: true });
    sc.setGhost(BV);
    sc.urine.salt.dataset.final = to.uSalt.toFixed(1);
    sc.urine.water.dataset.final = to.uWater.toFixed(1);
    return {
      animate: true, duration: 2600, model: m,
      render(t) {
        const k = ease(clamp01((t - 0.18) / 0.82));
        sc.set(lerpVis(BV, to, k));
        sc.setDrugs(c.set, clamp01(t / 0.18));
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
  const svg = step.querySelector('svg.np'), kind = step.dataset.visual;
  if (!cv) return { ...still, svg };
  const v = kind === 'drug' ? BUILD.drug(svg, step.dataset.drug)
    : kind === 'seg' ? BUILD.seg(svg, Number(step.dataset.seg)) : BUILD[kind](svg);
  if (kind === 'drug') {
    const c = DRUG_STEPS[step.dataset.drug];
    // A machine-readable record of which way the model moves each value, for checking
    // against the directions in clinical-values.json.
    step.dataset.modelShifts = JSON.stringify(directions(base, v.model));
    step.dataset.modelSet = JSON.stringify(c.set);
    const st = cv.states.find(s => JSON.stringify(s.model) === JSON.stringify(c.set));
    if (st) step.dataset.state = st.id;
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
