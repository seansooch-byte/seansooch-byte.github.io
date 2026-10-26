/* Illustrative teaching model of blood glucose around one meal. Not a clinical model.
   Glucose in mg/dL; insulin and glucagon relative to their normal fasting level (1 = normal fasting).
   Every flow is a rate of change of blood glucose (mg/dL per minute).
     gut      meal glucose absorbed from the gut (a smooth hump after the meal)
     liver    glucose released by the liver: raised by glucagon, held back by insulin
     brain    insulin-independent uptake (brain, red cells and others): nearly constant
     cells    insulin-dependent uptake into muscle and fat: insulin × how well cells answer it × glucose
     kidney   glucose lost in urine once blood glucose passes the kidney's carrying limit
   The beta cells release insulin as glucose rises (a steep curve), boosted by incretins from the gut. */
(function (root) {
  'use strict';
  const NORMAL = Object.freeze({ beta: 1, sens: 1, liver: 1, gut: 1, empty: 1, inc: 1, glp1: 0, su: 0, renal: 0, inj: 0, gnMult: 1, meal: 1 });
  const DISEASE = Object.freeze({
    normal: {},
    type1: { beta: 0.03 },             // beta cells destroyed: almost no insulin of its own
    type2: { beta: 0.35, sens: 0.25 }  //cells answer insulin weakly; tired beta cells cannot make up for it
  });
  // Each drug changes the model in the direction of its cited mechanism. Sizes are illustrative.
  const DRUGS = Object.freeze({
    insulin: p => ({ ...p, inj: p.inj + 1 }),                                                       // insulin from outside the body
    metformin: p => ({ ...p, liver: p.liver * 0.72, gut: p.gut * 0.92, sens: p.sens * 1.2 }),       // less liver glucose, a little less absorbed, better response
    sulfonylurea: p => ({ ...p, su: p.su + 0.8 }),                                                  // beta cells pushed to release insulin
    sglt2: p => ({ ...p, renal: 1 }),                                                               // kidneys stop carrying glucose back
    glp1: p => ({ ...p, glp1: p.glp1 + 1.5, empty: p.empty * 0.8, gnMult: p.gnMult * 0.75 }),       // more insulin when glucose is high, less glucagon, slower stomach
    dpp4: p => ({ ...p, inc: p.inc * 1.8 })                                                         // the body's own incretins last longer
  });
  const G0 = 88;                        // the model's normal fasting glucose (a teaching choice that sits inside the quoted reference ranges)
  const HGP0 = 1.2, UIND0 = 0.6, UINS0 = 0.6, MEAL = 280, KT = 35, K_HILL = 170, KR = 0.006, INJ_BASAL = 0.9, INJ_MEAL = 1.6;
  const hill = g => { const a = Math.pow(g, 4); return a / (a + Math.pow(K_HILL, 4)); };
  const INC_BASAL = 0.15;
  const H0 = hill(G0) * (1 + 0.8 * INC_BASAL);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const RA_PEAK = MEAL / (KT * Math.E);  // peak gut absorption in the normal model

  function withDefaults(p) { return { ...NORMAL, ...p }; }
  function build(disease = 'normal', drugs = []) {
    let p = withDefaults(DISEASE[disease] || {});
    for (const d of drugs) if (DRUGS[d]) p = DRUGS[d](p);
    return p;
  }
  function mix(a, b, t) { const o = {}; for (const k of Object.keys(NORMAL)) o[k] = a[k] + (b[k] - a[k]) * t; return o; }

  const gutRate = (p, t) => { if (t < 0) return 0; const k = p.empty / KT; return p.meal * p.gut * MEAL * k * k * t * Math.exp(-k * t); };
  const injected = (p, t) => p.inj * (INJ_BASAL + (t >= 0 ? INJ_MEAL * (t / 60) * Math.exp(1 - t / 60) : 0));
  function flows(p, t, G, Iendo) {
    const ra = gutRate(p, t);
    const incretin = p.inc * (INC_BASAL + 0.85 * ra / RA_PEAK);
    const secretion = p.beta * (hill(G) * (1 + 0.8 * incretin + 1.2 * p.glp1) * (1 + 0.8 * p.su) / H0 + 0.9 * p.su);
    const inj = injected(p, t);
    const I = Iendo + inj;
    const glucagon = p.gnMult * clamp(1 + 1.2 * (G0 - G) / G0, 0.5, 2.2);
    const liver = HGP0 * p.liver * glucagon * 2 / (1 + I * p.sens);
    const brain = UIND0 * (G / (G + 30)) / (G0 / (G0 + 30));
    const cells = UINS0 * p.sens * I * G / G0;
    const thr = 180 - 100 * p.renal;
    const kidney = KR * (1 + p.renal) * Math.max(0, G - thr);
    return { t, G, Iendo, inj, I, ra, incretin, secretion, glucagon, liver, brain, cells, kidney, dG: ra + liver - brain - cells - kidney };
  }
  // Fasting steady state, then the meal at t = 0. Returns one sample per minute from 0 to `until`.
  function simulate(pIn, until = 300) {
    const p = withDefaults(pIn);
    let G = G0, I = 1;
    for (let i = 0; i < 1600; i++) {      // settle overnight (no meal)
      const f = flows(p, -1, G, I);
      G = Math.max(20, G + f.dG); I += (f.secretion - I) / 12;
    }
    const fasting = flows(p, -1, G, I);
    const series = [];
    for (let t = 0; t <= until; t++) {
      const f = flows(p, t, G, I);
      series.push(f);
      G = Math.max(20, G + f.dG); I += (f.secretion - I) / 12;
    }
    let peak = series[0];
    for (const s of series) if (s.G > peak.G) peak = s;
    return { p, fasting, series, peak, at: m => series[clamp(Math.round(m), 0, until)] };
  }
  const api = { NORMAL, DISEASE, DRUGS, G0, build, mix, simulate, withDefaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GlucoseModel = api;
})(typeof window !== 'undefined' ? window : this);
