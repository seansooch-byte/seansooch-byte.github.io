/* Illustrative teaching model of one infection and the immune response to it, and of four ways to steer it.
   Every number here is a teaching choice, not a measurement: only the directions are meant to teach. */
(function () {
  'use strict';
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const DRUGS = ['vaccine', 'cni', 'antitnf', 'gc'];
  const DT = 0.025, DAYS = 30, SAMPLE = 0.25;   // time in illustrative "days"; never shown as numbers on the lesson

  /* One run of the response.
     G germs at the site (1 = as many as the site can hold), S alarm signals made, Se alarm signals still active,
     T matching T cells, P antibody-making plasma cells, A antibodies, M memory cells.
     opt: { vaccine, cni, antitnf, gc, growth (germ multiplying speed, 1 = normal), reinfect (a second exposure) } */
  function run(opt = {}) {
    const vac = !!opt.vaccine, cni = !!opt.cni, tnf = !!opt.antitnf, gc = !!opt.gc;
    // A second exposure comes long after the first, once most antibodies have faded but memory cells remain.
    const growth = opt.growth ?? 1, days = opt.reinfect ? 3 * DAYS : DAYS;
    // Drug effects on each step of the response (1 = untouched).
    const alarmMade = gc ? 0.4 : 1;                 // glucocorticoids turn down the instructions for alarm signals
    const alarmLeft = tnf ? 0.35 : 1;               // anti-TNF drugs mop up the loudest alarm signal
    const tSwitch = (cni ? 0.12 : 1) * (gc ? 0.5 : 1); // calcineurin inhibitors block the T cell's on switch
    let G = 0.01, S = 0, T = 0.002, P = 0, A = vac ? 0.12 : 0, M = vac ? 1 : 0;
    const series = { t: [], G: [], Se: [], T: [], A: [], M: [] };
    const peak = { G: 0, Se: 0, T: 0, A: 0 };
    const n = Math.round(days / DT), every = Math.round(SAMPLE / DT);
    for (let i = 0; i <= n; i++) {
      const t = i * DT;
      if (opt.reinfect && Math.abs(t - 2 * DAYS) < DT / 2) G += 0.01;
      const Se = S * alarmLeft;
      if (i % every === 0) { series.t.push(t); series.G.push(G); series.Se.push(Se); series.T.push(T); series.A.push(A); series.M.push(M); }
      if (t <= DAYS + 1e-9) { peak.G = Math.max(peak.G, G); peak.Se = Math.max(peak.Se, Se); peak.T = Math.max(peak.T, T); peak.A = Math.max(peak.A, A); }
      const innate = 0.25 + 0.55 * Se;                // eating cells at the site, drawn in by active alarm signals
      const ag = G / (G + 0.02);                      // how much of the germ's tag there is to see
      const agM = G / (G + 0.001);                    // memory cells wake at far smaller amounts of the tag
      const help = 0.6 + 0.4 * Math.min(1, Se);       // alarm signals also help wake the T cells
      const dG = 1.7 * growth * G * (1 - G) - 0.55 * innate * G - 2.2 * A * G - 1.2 * T * G;
      const dS = 2.2 * alarmMade * G / (G + 0.08) - 1.4 * S;
      const dT = 1.25 * tSwitch * help * (ag * T + 0.35 * agM * M) * (1 - T / 1.6) - 0.35 * (1 - ag) * T;
      const dP = 0.9 * T * (cni ? 0.4 : 1) * ag + 6 * M * tSwitch * agM - 0.3 * P;
      const dA = 0.9 * P - 0.1 * A;
      const dM = 0.8 * T * ag * (1 - M / 2.2);
      G = clamp(G + DT * dG, 0, 1); if (G < 1e-6) G = 0;
      S = Math.max(0, S + DT * dS); T = Math.max(0, T + DT * dT); P = Math.max(0, P + DT * dP);
      A = Math.max(0, A + DT * dA); M = Math.max(0, M + DT * dM);
    }
    const endM = series.M[Math.round(DAYS / SAMPLE)];
    return { series, raw: { germs: peak.G, alarm: peak.Se, tcells: peak.T, antibodies: peak.A, memory: endM } };
  }

  const KEYS = ['germs', 'alarm', 'tcells', 'antibodies', 'memory'];
  const BASE = run();
  // The five measures, each relative to the untreated, unvaccinated response (normal = 1).
  function settle(opt = {}) {
    const r = opt === null ? BASE : run(opt), o = {};
    for (const k of KEYS) o[k] = BASE.raw[k] > 0 ? r.raw[k] / BASE.raw[k] : 0;
    return o;
  }
  const NORMAL = settle({});
  const lerp = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

  /* White blood cells in a drop of blood. `ref` holds the model's baseline counts and shares, worked out from the
     clinical data file at load, so no clinical number lives here. Effects are illustrative teaching choices. */
  const BLOOD_NORMAL = { infection: 0, germ: 'bacteria', drug: '', neutMul: 1, lymphMul: 1, monoMul: 1, eosMul: 1, wbcMul: 1 };
  function blood(p, ref) {
    const q = { ...BLOOD_NORMAL, ...p };
    const innate = q.drug === 'antitnf' ? 0.5 : q.drug === 'gc' ? 0.6 : 1;
    const tcell = q.drug === 'cni' ? 0.2 : q.drug === 'gc' ? 0.5 : 1;
    const x = q.infection, bac = q.germ === 'bacteria';
    let N = ref.neut * (1 + (bac ? 1.3 : 0.1) * x * innate) * q.neutMul;
    let L = ref.lymph * (1 + (bac ? 0.05 : 0.9) * x * tcell) * q.lymphMul;
    let Mo = ref.mono * (1 + (bac ? 0.2 : 0.35) * x * innate) * q.monoMul;
    let E = ref.eos * q.eosMul;
    if (q.drug === 'gc') { N *= 1.3; L *= 0.55; E *= 0.5; Mo *= 0.7; }
    const rel = N + L + Mo + E;
    const wbc = ref.wbc * rel * q.wbcMul;
    return { wbc, neutPct: 100 * N / rel, lymphPct: 100 * L / rel, monoPct: 100 * Mo / rel, eosPct: 100 * E / rel,
      relN: N * q.wbcMul, relL: L * q.wbcMul, relMo: Mo * q.wbcMul, relE: E * q.wbcMul, total: rel * q.wbcMul, load: x };
  }

  const api = { DRUGS, run, settle, NORMAL, BASE, KEYS, lerp, blood, BLOOD_NORMAL, DAYS };
  if (typeof window !== 'undefined') window.IRModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
