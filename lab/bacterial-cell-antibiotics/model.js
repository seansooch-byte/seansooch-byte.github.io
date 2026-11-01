/* Illustrative teaching model of one kind of bacterium and six antibiotic families.
   Every number here is a teaching choice, not a measurement: only the directions are meant to teach. */
(function () {
  'use strict';
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const DRUGS = ['betalactam', 'vancomycin', 'aminoglycoside', 'macrolide', 'fluoroquinolone', 'sulfa'];

  // How well a drug reaches its target in this kind of bacterium (1 = fully).
  function reach(drug, gram, betalactamase) {
    let r = 1;
    if (drug === 'vancomycin' && gram === 'negative') r = 0;        // too big to pass an intact outer membrane
    if (drug === 'betalactam' && gram === 'negative') r = 0.8;      // the outer membrane slows some of them
    if (drug === 'aminoglycoside' && gram === 'positive') r = 0.4;  // mostly aimed at gram-negative bacteria
    if (drug === 'betalactam' && betalactamase) r *= 0.1;           // a drug-cutting enzyme breaks the drug
    return r;
  }

  // Settled state of the bacterium's machinery with a set of drugs. Normal = 1 for everything.
  function settle(opt = {}) {
    const on = new Set(opt.drugs || []), gram = opt.gram || 'any';
    const b = d => on.has(d) ? reach(d, gram, !!opt.betalactamase) : 0;
    const bl = 0.85 * b('betalactam'), va = 0.85 * b('vancomycin');
    const am = 0.85 * b('aminoglycoside'), ma = 0.8 * b('macrolide');
    const fq = 0.9 * b('fluoroquinolone'), su = 0.85 * b('sulfa');
    const wallBlock = 1 - (1 - bl) * (1 - va);
    const proteins = (1 - am) * (1 - ma);
    const folate = 1 - su;
    // DNA copying needs the untangling enzymes and fresh DNA letters, which need folate.
    const dna = (1 - fq) * (1 - 0.9 * su);
    // Growth needs working proteins and copied DNA. A weak wall does not stop growth: it makes growing cells burst.
    const growth = proteins * dna;
    // Wall drugs kill only bacteria that are still growing, so a growth-stopping drug blunts them.
    const growthNoWall = (1 - ma) * dna * (1 - 0.5 * am);
    const killRate = 0.3 * wallBlock * growthNoWall + 0.3 * am + 0.32 * fq;
    const alive = Math.exp(-6 * killRate);
    return { wall: 1 - wallBlock, proteins, dna, folate, growth, alive, killRate };
  }
  const NORMAL = settle();
  const KEYS = ['wall', 'proteins', 'dna', 'folate', 'growth', 'alive'];
  const lerp = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

  // Bacteria over time: logistic growth, white cells clearing a little, drugs from time `start`.
  const STEPS = 120, START = 24;
  function simulate(opt = {}) {
    const s = settle(opt), out = [];
    let n = 0.04;
    for (let i = 0; i <= STEPS; i++) {
      out.push(n);
      const drug = i >= START && (opt.drugs || []).length;
      const g = drug ? s.growth : 1, k = drug ? s.killRate : 0;
      const grow = 0.16 * g * n * (1 - n);
      const kill = 0.6 * k * n;
      const clear = 0.012 * n / (n + 0.15);
      n = clamp(n + grow - kill - clear, 0, 1);
      if (n < 1e-4) n = 0;
    }
    return out;
  }

  /* White blood cells. `ref` comes from the clinical data file (the middle of each quoted range), so no clinical
     number lives here. Neutrophils, lymphocytes and "other" white cells are tracked relative to normal. */
  const BLOOD_NORMAL = { bacteria: 0, virus: 0, stress: 0, marrow: 0, wbcMul: 1, drugs: [] };
  function treatedLoad(bacteria, drugs) {
    if (!drugs || !drugs.length || bacteria <= 0) return bacteria;
    const s = settle({ drugs });
    const eff = 1 - s.growth * s.alive;             // share of the bacteria's success the drug takes away
    return bacteria * (1 - 0.9 * eff);
  }
  function blood(p, ref) {
    const q = { ...BLOOD_NORMAL, ...p };
    const load = treatedLoad(q.bacteria, q.drugs);
    const fN = (1 + 1.6 * load / (load + 0.4)) * (1 + 0.8 * q.stress) * (1 - 0.65 * q.marrow) * (1 - 0.1 * q.virus);
    const fL = 1 + 0.8 * q.virus;
    const nShare = ref.neutPct / 100, lShare = ref.lymphPct / 100, oShare = Math.max(0, 1 - nShare - lShare);
    const N = nShare * fN, L = lShare * fL, O = oShare;
    const total = N + L + O;
    return { load, wbc: ref.wbc * total * q.wbcMul, neutPct: 100 * N / total, lymphPct: 100 * L / total, relN: N, relL: L, relO: O, total: total * q.wbcMul };
  }

  window.BCModel = { DRUGS, reach, settle, NORMAL, KEYS, lerp, simulate, STEPS, START, blood, treatedLoad, BLOOD_NORMAL };
})();
