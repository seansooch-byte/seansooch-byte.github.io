'use strict';
/* An illustrative steady-state model of the brain–pituitary–thyroid loop.
   Every level is relative to the normal body (1 = normal); the app turns them into lab units only by
   anchoring 1 to the middle of the quoted reference ranges in clinical-values.json.

   - The pituitary's TSH falls steeply as thyroid hormone (T4) in the blood rises: the negative-feedback brake.
   - The gland's release = working tissue × (1 − synthesis block) × iodine supply × (TSH drive + antibody push).
     TSH drive saturates: twice normal at most.
   - T4 in the blood = gland release + T4 from a tablet. T3 is made mostly from T4 in body cells, a little by the gland.
   - The body's pace follows T3; the heartbeat follows the pace, blunted by a beta-blocker.
   The loop settles where the gland's release matches the T4 it is assumed to produce (bisection on T4). */
(function () {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const NORMAL = { cap: 1, stim: 0, block: 0, exo: 0, iod: 1, beta: 0 };
  const FEEDBACK = 2.2;
  const tshFor = H => clamp(Math.pow(Math.max(H, 1e-4), -FEEDBACK), 0.005, 60);
  const trhFor = H => clamp(Math.pow(Math.max(H, 1e-4), -1.2), 0.05, 12);
  const drive = t => 2 * t / (t + 1);                        // drive(1) = 1, at most 2
  const iodineSupply = i => 1.1 * i / (i + 0.1);              // 1 at a normal diet, falls when iodine runs short
  // What the gland releases when the pituitary sends TSH level t.
  const releaseFor = (p, t) => Math.max(0, p.cap) * clamp(1 - p.block, 0, 1) * iodineSupply(Math.max(p.iod, 0)) * (drive(t) + Math.max(0, p.stim));
  const releaseAt = (p, H) => releaseFor(p, tshFor(H));
  function settle(p) {
    let lo = 1e-4, hi = 30;
    for (let i = 0; i < 70; i++) {
      const H = (lo + hi) / 2;
      if (releaseAt(p, H) + Math.max(0, p.exo) > H) lo = H; else hi = H;
    }
    return describe(p, (lo + hi) / 2);
  }
  // The whole loop at a given T4 level. With `open`, the brake is shown answering a T4 level the
  // picture sets by hand (the core steps on feedback); otherwise H is the settled level.
  function describe(p, H, snapshot = false) {
    // In a snapshot the gland has not yet caught up, so T3 in the blood still follows the T4 level set by hand.
    const tsh = tshFor(H), out = releaseAt(p, H), t3 = snapshot ? H : 0.2 * out + 0.8 * H;
    const pace = clamp(Math.sqrt(Math.max(t3, 0)), 0.3, 2.2);
    const hr = pace * (1 - 0.35 * clamp(p.beta, 0, 1));
    const gland = clamp(Math.sqrt(Math.max(p.cap, 0.02)) * (1 + 0.12 * Math.min(Math.max(p.stim, 0), 2)) * (1 + 0.1 * clamp(Math.log2(tsh), 0, 3)), 0.3, 1.6);
    return { p, H, t4: H, tsh, trh: trhFor(H), out, t3, pace, hr, gland };
  }
  const open = (p, H) => describe(p, H, true);
  const PRESETS = {
    normal: () => ({ ...NORMAL }),
    hypo: () => ({ ...NORMAL, cap: 0.3 }),            // Hashimoto thyroiditis: much of the gland lost
    graves: () => ({ ...NORMAL, cap: 1.3, stim: 1.6 }) // antibodies push the TSH docking sites; the gland grows
  };
  const DRUGS = {
    levothyroxine: p => ({ ...p, exo: p.exo + 0.6 }),   // T4 from outside the gland
    thionamide: p => ({ ...p, block: 1 - (1 - p.block) * 0.4 }), // the gland builds less hormone
    rai: p => ({ ...p, cap: p.cap * 0.25 }),           // overactive tissue destroyed
    betablocker: p => ({ ...p, beta: 1 })              // the heart answers alarm signals less; the loop is untouched
  };
  function build(preset, drugs = []) {
    let p = PRESETS[preset]();
    for (const d of drugs) p = DRUGS[d](p);
    return p;
  }
  function mix(a, b, t) { const o = {}; for (const k of Object.keys(NORMAL)) o[k] = a[k] + (b[k] - a[k]) * t; return o; }
  window.ThyroidModel = { NORMAL, PRESETS, DRUGS, build, mix, settle, open, tshFor, releaseFor };
})();
