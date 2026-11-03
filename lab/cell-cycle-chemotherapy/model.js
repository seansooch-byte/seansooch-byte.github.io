'use strict';
/* An illustrative teaching model of a population of dividing cells going round the cell cycle.
   Cells sit in five boxes: resting (G0), G1, S, G2 and M. Each phase is left at a fixed rate; a cell leaving M becomes
   two cells in G1. Some G1 cells step out to rest and some resting cells step back in. A drug can slow the way out of a
   phase (a block) or kill cells while they are in a phase. Time units are arbitrary and never shown as numbers. */
(function (root) {
  const PHASES = ['G0', 'G1', 'S', 'G2', 'M'];
  const CYCLE = ['G1', 'S', 'G2', 'M'];
  const DUR = { G1: 10, S: 8, G2: 4, M: 1.5 };
  const TISSUE = {
    tumour: { toRest: 0.03, fromRest: 0.02 },
    // Healthy tissue with working checkpoints: most cells step out to rest and few come back.
    healthy: { toRest: 0.15, fromRest: 0.01 },
    marrow: { toRest: 0.05, fromRest: 0.05 }
  };
  // What each drug class does, by phase: slow = share of the way out that is blocked; kill = death rate in that phase.
  const DRUGS = {
    antimetabolite: { slow: { S: 0.5 }, kill: { S: 0.1 } },
    spindle: { slow: { M: 0.85 }, kill: { M: 0.15 } },
    alkylating: { kill: { G0: 0.012, G1: 0.022, S: 0.04, G2: 0.04, M: 0.04 } },
    topo: { kill: { S: 0.06, G2: 0.12 } },
    cdk46: { slow: { G1: 0.9 }, marrowScale: 0.6 }
  };
  const DRUG_KEYS = Object.keys(DRUGS);
  const T_END = 40, DT = 0.05;

  function effects(opt, tissue) {
    const slow = {}, kill = {};
    for (const p of PHASES) { slow[p] = 0; kill[p] = 0; }
    for (const d of DRUG_KEYS) {
      if (!opt[d]) continue;
      const e = DRUGS[d], sc = tissue === 'marrow' ? (e.marrowScale ?? 1) : 1;
      for (const [p, v] of Object.entries(e.slow || {})) slow[p] = 1 - (1 - slow[p]) * (1 - v * sc);
      for (const [p, v] of Object.entries(e.kill || {})) kill[p] += v * sc;
    }
    return { slow, kill };
  }
  function step(x, dead, tissue, speed, eff, dt) {
    const t = TISSUE[tissue], k = p => speed / DUR[p] * (1 - eff.slow[p]);
    const out = { G1: k('G1') * x.G1, S: k('S') * x.S, G2: k('G2') * x.G2, M: k('M') * x.M };
    const rest = t.toRest * x.G1, wake = t.fromRest * x.G0;
    const die = {}; for (const p of PHASES) die[p] = eff.kill[p] * x[p];
    const d = {
      G0: rest - wake - die.G0,
      G1: 2 * out.M - out.G1 - rest + wake - die.G1,
      S: out.G1 - out.S - die.S,
      G2: out.S - out.G2 - die.G2,
      M: out.G2 - out.M - die.M
    };
    for (const p of PHASES) { x[p] = Math.max(0, x[p] + d[p] * dt); dead[p] += die[p] * dt; }
    return out.M * dt;
  }
  const total = x => PHASES.reduce((s, p) => s + x[p], 0);
  // The share of cells in each phase once an untreated population has settled into steady growth.
  const steady = {};
  function steadyMix(tissue, speed) {
    const key = tissue + speed.toFixed(3);
    if (steady[key]) return steady[key];
    const x = { G0: 0.2, G1: 0.4, S: 0.25, G2: 0.1, M: 0.05 }, dead = { G0: 0, G1: 0, S: 0, G2: 0, M: 0 };
    const none = effects({}, tissue);
    for (let i = 0; i < 8000; i++) { step(x, dead, tissue, speed, none, DT); const s = total(x); for (const p of PHASES) x[p] /= s; }
    return (steady[key] = { ...x });
  }
  // Run one tissue for the whole period. opt: drug flags, speed (tumour only), stopHalf (drug only in the first half).
  function runTissue(tissue, opt) {
    const speed = tissue === 'tumour' ? (opt.speed ?? 1) : 1;
    const x = { ...steadyMix(tissue, speed) }, dead = { G0: 0, G1: 0, S: 0, G2: 0, M: 0 };
    const on = effects(opt, tissue), off = effects({}, tissue);
    const n = Math.round(T_END / DT), every = 20;
    const series = { t: [0], size: [1], made: [0] };
    let made = 0, window = 0;
    for (let i = 1; i <= n; i++) {
      const eff = opt.stopHalf && i * DT > T_END / 2 ? off : on;
      const m = step(x, dead, tissue, speed, eff, DT);
      made += m; window += m;
      if (i % every === 0) { series.t.push(i * DT); series.size.push(total(x)); series.made.push(window / (every * DT)); window = 0; }
    }
    return { x, dead, made, size: total(x), series };
  }
  function run(opt = {}) {
    const tum = runTissue('tumour', opt), mar = runTissue('marrow', opt);
    const ref = opt.speed && opt.speed !== 1 ? { tum: runTissue('tumour', { speed: opt.speed }) } : null;
    return { tum, mar, ref };
  }
  const BASE = run({});
  const DEAD_REF = 1;
  // The numbers the pictures use, all relative to the untreated tumour (of the same speed) and marrow.
  function settle(opt = {}) {
    const r = run(opt), tum = r.tum, live = tum.size;
    const deadTotal = PHASES.reduce((s, p) => s + tum.dead[p], 0);
    const o = {
      tumour: tum.size / (r.ref || BASE).tum.size,
      marrow: r.mar.made / BASE.mar.made,
      damaged: deadTotal / DEAD_REF
    };
    for (const p of PHASES) { o['sh' + p] = tum.x[p] / live; o['dead' + p] = tum.dead[p] / DEAD_REF; }
    return o;
  }
  const NORMAL = settle({});
  const KEYS = Object.keys(NORMAL);
  // The same measures for healthy tissue, started from the same number of cells, for the lesson's cancer step.
  const HEALTHY = (() => {
    const h = runTissue('healthy', {}), o = { tumour: h.size / BASE.tum.size, marrow: 1, damaged: 0 };
    for (const p of PHASES) { o['sh' + p] = h.x[p] / h.size; o['dead' + p] = 0; }
    return Object.fromEntries(KEYS.map(k => [k, o[k]]));
  })();
  const lerp = (a, b, t) => Object.fromEntries(KEYS.map(k => [k, a[k] + (b[k] - a[k]) * t]));

  // Clinical values tab: blood counts from how many new blood cells the marrow makes (1 = as usual). In this model
  // short-lived white cells follow the marrow closely, while long-lived red cells change little.
  function blood(inp, REF) {
    const m = Math.min(1, Math.max(0, inp.marrow ?? 1)), red = 1 - 0.1 * (1 - m);
    return { wbc: REF.wbc * m, hctF: REF.hctF * red, hctM: REF.hctM * red };
  }

  root.CCModel = { PHASES, CYCLE, DRUGS: DRUG_KEYS, NORMAL, HEALTHY, KEYS, BASE, T_END, settle, run, lerp, blood };
})(typeof window !== 'undefined' ? window : globalThis);
