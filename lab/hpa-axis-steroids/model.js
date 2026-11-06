'use strict';
/* An illustrative steady-state model of the hypothalamus–pituitary–adrenal (HPA) axis.
   Every level is relative to the normal body (1 = normal). Nothing here is a lab number.

   - The hypothalamus's CRH rises with stress and falls as the glucocorticoid signal in the blood (E) rises.
   - The pituitary's ACTH follows CRH and is braked by E directly too, scaled by how much working pituitary there is
     (pit: below 1 in secondary adrenal insufficiency); a pituitary tumor adds ACTH the brake cannot touch.
   - The cortex's own cortisol = working cortex × (1 − synthesis block) × drive from ACTH (three times normal at most).
   - E = own cortisol + any glucocorticoid drug. The loop settles where these agree (bisection on E).
   - The mineralocorticoid signal M = working cortex × aldosterone output + any mineralocorticoid drug.
     Aldosterone is set mainly by the kidney's renin system, not by ACTH, so a failing pituitary leaves it alone.
     More M: the kidneys keep more sodium and lose more potassium.
   - Glucose follows E; inflammation is calmed by E. */
(function () {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const NORMAL = { stress: 1, cap: 1, aldo: 1, tumor: 0, exoG: 0, exoM: 0, block: 0, pit: 1 };
  const crhFor = (p, E) => clamp(Math.max(p.stress, 0) / Math.max(E, 1e-4), 0.02, 20);
  const acthFor = (p, E) => clamp(crhFor(p, E) / Math.sqrt(Math.max(E, 1e-4)), 0.01, 30) * clamp(p.pit ?? 1, 0, 2) + Math.max(0, p.tumor);
  const drive = a => 3 * a / (a + 2);                         // drive(1) = 1, at most 3
  const ownFor = (p, E) => Math.max(0, p.cap) * clamp(1 - p.block, 0, 1) * drive(acthFor(p, E));
  function settle(p) {
    let lo = 1e-4, hi = 40;
    for (let i = 0; i < 70; i++) {
      const E = (lo + hi) / 2;
      if (ownFor(p, E) + Math.max(0, p.exoG) > E) lo = E; else hi = E;
    }
    return describe(p, (lo + hi) / 2);
  }
  // The whole axis at a glucocorticoid level E. With `snapshot`, E is set by hand (the core steps on feedback):
  // the brain has answered, but the cortex has not caught up, so the cortisol drawn is E itself.
  function describe(p, E, snapshot = false) {
    const crh = crhFor(p, E), acth = acthFor(p, E);
    const own = snapshot ? E : ownFor(p, E);
    const M = Math.max(0, p.cap) * Math.max(0, p.aldo) + Math.max(0, p.exoM);
    const lm = clamp(Math.log2(Math.max(M, 1e-3)), -3, 3);
    return {
      p, E, crh, acth, cortisol: own, M,
      glucose: clamp(Math.pow(E, 0.4), 0.35, 2.4),
      sodium: 1 + 0.032 * lm,
      potassium: 1 - 0.18 * lm,
      inflam: clamp(Math.pow(E, -0.9), 0.08, 4)
    };
  }
  const open = (p, E) => describe(p, E, true);
  const PRESETS = {
    normal: () => ({ ...NORMAL }),
    cushing: () => ({ ...NORMAL, tumor: 3 }),      // a pituitary tumor making ACTH the brake cannot stop
    addison: () => ({ ...NORMAL, cap: 0.2 }),      // most of the cortex no longer works (primary adrenal insufficiency)
    secondary: () => ({ ...NORMAL, pit: 0.1 }),    // the pituitary makes little ACTH (secondary adrenal insufficiency)
    hyperaldo: () => ({ ...NORMAL, aldo: 3 }),     // too much aldosterone
    hypoaldo: () => ({ ...NORMAL, aldo: 0.25 })    // too little aldosterone
  };
  const DRUGS = {
    glucocorticoid: p => ({ ...p, exoG: p.exoG + 2 }),   // a cortisol-like drug from outside the gland
    mineralocorticoid: p => ({ ...p, exoM: p.exoM + 2 }),// an aldosterone-like drug from outside the gland
    inhibitor: p => ({ ...p, block: 1 - (1 - p.block) * 0.5 }) // the cortex builds half as much cortisol
  };
  function build(preset, drugs = []) {
    let p = PRESETS[preset]();
    for (const d of drugs) p = DRUGS[d](p);
    return p;
  }
  function mix(a, b, t) { const o = {}; for (const k of Object.keys(NORMAL)) o[k] = a[k] + (b[k] - a[k]) * t; return o; }

  /* Stopping a long-term glucocorticoid: an illustrative time course.
     While ACTH is held low, the cortex's working capacity drifts down toward what ACTH asks of it, and back up slowly
     once ACTH returns. The drug runs for the first stretch, then stops suddenly or is tapered. */
  function stopping(mode, steps = 100) {
    const on = 30, taperLen = 46, tau = 9;
    let cap = 1;
    const out = [];
    for (let t = 0; t < steps; t++) {
      let exoG = 0;
      if (t < on) exoG = 2;
      else if (mode === 'taper' && t < on + taperLen) exoG = 2 * (1 - (t - on) / taperLen);
      const p = { ...NORMAL, cap, exoG };
      const v = settle(p);
      out.push({ t, exoG, cap, E: v.E, own: v.cortisol, acth: v.acth });
      const target = clamp(0.1 + 0.9 * v.acth, 0.1, 1);
      cap += (target - cap) / tau;
    }
    return { on, taperLen, series: out };
  }
  window.HPAModel = { NORMAL, PRESETS, DRUGS, build, mix, settle, open, stopping, drive };
})();
