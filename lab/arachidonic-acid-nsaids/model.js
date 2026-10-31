'use strict';
/* An illustrative teaching model of the arachidonic acid pathway in one injured patch of tissue.
   Every output is relative to the untreated injured tissue (1 = this lesson's normal). The drug strengths are
   illustrative shares of each step blocked; only their directions are meant to teach. */
window.AAModel = (() => {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const NORMAL = { injury: 1, fever: 0, nsaid: 0, cox2i: 0, aspirin: 0, steroid: 0, ltm: 0 };
  const DRUGS = {
    nsaid: p => ({ ...p, nsaid: 0.8 }),     // plugs both COX enzymes, for a while
    cox2i: p => ({ ...p, cox2i: 0.85 }),    // plugs COX-2 only
    aspirin: p => ({ ...p, aspirin: 0.9 }), // tags COX for good: COX-1 fully, COX-2 less so
    steroid: p => ({ ...p, steroid: 0.8 }), // slows phospholipase and the making of COX-2
    ltm: p => ({ ...p, ltm: 0.85 })         // blocks leukotrienes where they act
  };
  // The model has no breathing, so an aspirin overdose is drawn only as COX tagged; its blood pH is not simulated.
  const STATES = { 'aspirin-overdose': p => DRUGS.aspirin(p) };
  function build(base = 'normal', drugs = []) {
    let p = { ...NORMAL };
    if (STATES[base]) p = STATES[base](p);
    for (const d of drugs) p = DRUGS[d](p);
    return p;
  }
  const mix = (a, b, t) => { const o = {}; for (const k of Object.keys(a)) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  function settle(p) {
    const inj = clamp(p.injury, 0, 2);
    // Phospholipase frees arachidonic acid: a trickle at rest, more with injury, less under a glucocorticoid.
    const release = (0.4 + 0.6 * inj) * (1 - 0.7 * p.steroid);
    // COX-2 is made on demand at the injury; a glucocorticoid stops cells making much of it.
    const cox2Made = inj * (1 - 0.6 * p.steroid);
    const c1 = (1 - p.nsaid) * (1 - p.aspirin);                          // share of COX-1 still working
    const c2 = (1 - p.nsaid) * (1 - p.cox2i) * (1 - 0.7 * p.aspirin);    // share of COX-2 still working
    const coxShare = (0.3 * c1 + 1.7 * c2 * cox2Made) / 2;               // COX capacity at the injury, normal 1
    const via1 = release * c1, via2 = release * c2 * cox2Made;
    const pg = release * coxShare;                                       // prostaglandins made at the injury
    // Arachidonic acid that COX cannot take spills a little toward lipoxygenase.
    const lt = release * Math.max(0.5, 1 + 0.3 * (1 - coxShare));
    return {
      p, release, cox2Made, c1, c2, via1, via2, pg, lt,
      inflam: pg * (1 - 0.3 * p.steroid),        // pain, swelling and fever at the injury
      shield: c1 * (1 - 0.35 * p.steroid),        // the stomach's own COX-1 prostaglandins
      clot: c1,                                   // platelets' COX-1 thromboxane
      airway: lt * (1 - p.ltm),                   // leukotriene squeeze on the airways
      feverOut: p.fever * pg,                     // prostaglandin signal reaching the brain's thermostat
      glucose: 1 + 0.35 * p.steroid
    };
  }
  return { NORMAL, DRUGS, STATES, build, mix, settle };
})();
