'use strict';
/* An illustrative one-compartment teaching model of drug levels over time. Time is in model hours, levels in
   model units: nothing here is a real drug, a real amount or a prediction for a person.
   Absorption from the gut is first order (rate ka); a share F survives the liver's first pass; the drug spreads
   into a space Vd; the liver (CLh) and kidneys (CLr) clear it. Removal is first order, so the half-life is
   proportional to Vd / CL (the form of Equation 3 in the StatPearls half-life chapter), scaled so the usual drug
   has a half-life of H0 model hours. With no clearance at all there is no removal: no half-life and no steady state.
   iv blends from by mouth (0) to straight into a vein (1), so the lesson can morph between them. */
(function () {
  const LN2 = Math.LN2;
  const H0 = 6;
  // The model's own convergence rule (an illustrative choice, not a sourced value): steady state is reached once
  // the level stays within this fraction of its eventual level at the same point in every later gap.
  const SS_GAP = 0.05;
  const NORMAL = { iv: 0, ka: 0.7, F: 0.6, Vd: 1, CLh: 0.5, CLr: 0.5, tau: 6, repeat: 1, amount: 1 };
  const STATES = {
    normal: {},
    inducer: { CLh: 1.2, F: 0.4 },
    inhibitor: { CLh: 0.15, F: 0.75 },
    kidney: { CLr: 0.15 },
    iv: { iv: 1 }
  };
  const build = (id, extra = {}) => ({ ...NORMAL, ...(STATES[id] || {}), ...extra });
  const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : a[k]; return o; };
  const CL = p => Math.max(0, p.CLh + p.CLr);
  const removes = p => CL(p) > 1e-9;
  const kel = p => removes(p) ? LN2 * CL(p) / (p.Vd * H0) : 0;
  const halfLife = p => removes(p) ? H0 * p.Vd / CL(p) : Infinity;
  const share = p => p.F + (1 - p.F) * p.iv;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const kaOf = (p, k) => Math.abs(p.ka - k) < 1e-4 ? k * 1.001 + 1e-4 : p.ka;

  // Level s model hours after one amount. With k = 0 this is still exact: absorbed drug simply stays.
  function single(p, s) {
    if (s < 0) return 0;
    const k = kel(p), ka = kaOf(p, k), A = p.amount / p.Vd;
    const oral = p.F * A * ka / (ka - k) * (Math.exp(-k * s) - Math.exp(-ka * s));
    return (1 - p.iv) * oral + p.iv * A * Math.exp(-k * s);
  }
  const doseTimes = (p, span) => { if (!p.repeat) return [0]; const t = []; for (let x = 0; x < span - 1e-9; x += p.tau) t.push(x); return t; };
  function level(p, t) {
    if (!p.repeat) return single(p, t);
    let c = 0;
    for (let td = 0; td <= t + 1e-9; td += p.tau) c += single(p, t - td);
    return c;
  }
  // The settled (steady-state) level s model hours after an amount, 0 <= s <= tau. Only exists with removal.
  function plateauAt(p, s) {
    const k = kel(p), ka = kaOf(p, k), A = p.amount / p.Vd, tau = p.tau;
    const ek = 1 - Math.exp(-k * tau), ea = 1 - Math.exp(-ka * tau);
    const oral = p.F * A * ka / (ka - k) * (Math.exp(-k * s) / ek - Math.exp(-ka * s) / ea);
    return (1 - p.iv) * oral + p.iv * A * Math.exp(-k * s) / ek;
  }
  /* When the repeated curve has settled, accounting for absorption. After x amounts, the level at s hours into a
     gap falls short of its settled value at that same point by
       R = oral part x (q^x e^-ks/(1-q) - qa^x e^-ka.s/(1-qa)) + vein part x q^x e^-ks/(1-q),  q = e^-k.tau, qa = e^-ka.tau,
     and that shortfall only shrinks as amounts are added. Treating the count of amounts as continuous, so the
     answer does not jump with the gap length, steady state is the first time t after which the shortfall at every
     point of the gap stays below SS_GAP of the settled level. Slow absorption (small ka) delays it. */
  function steadyTime(p) {
    const k = kel(p);
    if (k <= 0) return Infinity;
    const ka = kaOf(p, k), tau = p.tau, A = p.amount / p.Vd, q = Math.exp(-k * tau), qa = Math.exp(-ka * tau);
    const co = (1 - p.iv) * p.F * A * ka / (ka - k), cv = p.iv * A;
    const phases = [];
    for (let i = 0; i <= 48; i++) {
      const s = i === 48 ? tau - 1e-9 : tau * i / 48;
      phases.push({ s, ek: Math.exp(-k * s) / (1 - q), ea: Math.exp(-ka * s) / (1 - qa), P: plateauAt(p, s) });
    }
    const gap = t => {
      let worst = 0;
      for (const ph of phases) {
        const x = (t - ph.s) / tau + 1;
        if (x < 1) return 1;
        const qx = Math.pow(q, x), r = co * (qx * ph.ek - Math.pow(qa, x) * ph.ea) + cv * qx * ph.ek;
        worst = Math.max(worst, ph.P > 0 ? r / ph.P : 1);
      }
      return worst;
    };
    let lo = 0, hi = tau;
    while (gap(hi) > SS_GAP && hi < 1e7) { lo = hi; hi *= 2; }
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (gap(m) > SS_GAP) lo = m; else hi = m; }
    return hi;
  }
  /* After a single amount: the first time after the peak at which the level has fallen below frac of that peak,
     solved on the real curve (absorption that is still going on keeps the level up). Infinity with no removal. */
  function fallTime(p, frac, peak, peakAt) {
    if (kel(p) <= 0) return Infinity;
    const target = frac * peak;
    let lo = peakAt, hi = Math.max(peakAt + 1, 1);
    while (single(p, hi) > target && hi < 1e7) { lo = hi; hi *= 2; }
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (single(p, m) > target) lo = m; else hi = m; }
    return hi;
  }
  // Points for drawing: a jump at each amount given into a vein, smooth curves between.
  function curve(p, span, n = 260) {
    const given = doseTimes(p, span), edges = [...given, span], pts = [[0, 0]];
    for (let i = 0; i < given.length; i++) {
      const a = edges[i], b = edges[i + 1], m = Math.max(3, Math.ceil((b - a) / span * n));
      for (let j = 0; j <= m; j++) { const t = a + (b - a) * j / m; pts.push([t, level(p, j === m ? b - 1e-7 : t)]); }
    }
    return pts;
  }
  function summary(p) {
    const k = kel(p), usual = halfLife(NORMAL);
    const out = { half: halfLife(p), f: share(p), ssTime: steadyTime(p), k, noRemoval: k <= 0 };
    out.ssUsual = out.ssTime / usual;
    out.removed = n => 1 - Math.exp(-k * n * usual);
    if (p.repeat && k > 0) {
      let hi = -Infinity, lo = Infinity, at = 0;
      for (let i = 0; i <= 240; i++) { const s = p.tau * i / 240, c = plateauAt(p, i === 240 ? p.tau - 1e-7 : s); if (c > hi) { hi = c; at = s; } if (c < lo) lo = c; }
      Object.assign(out, { peak: hi, trough: lo, peakAt: at, plateau: out.f * p.amount / (k * p.Vd * p.tau) });
    } else if (p.repeat) {
      // No removal: every amount adds to what is there, so there is no plateau to settle on.
      Object.assign(out, { peak: Infinity, trough: Infinity, peakAt: 0, plateau: Infinity });
    } else if (k <= 0) {
      // Given once with no removal: the level rises toward everything absorbed and stays there; it never falls.
      const A = p.amount / p.Vd, top = (1 - p.iv) * p.F * A + p.iv * A;
      Object.assign(out, { peak: top, peakAt: p.iv >= 1 ? 0 : Infinity, trough: 0, plateau: 0, fall: Infinity });
    } else {
      let hi = 0, at = 0;
      // Search far enough for slow absorption or slow removal to have peaked.
      const ka = kaOf(p, k), reach = clamp(10 / Math.max(1e-9, Math.min(k > 0 ? k : Infinity, ka)), 72, 5000);
      for (let i = 0; i <= 1200; i++) { const t = reach * i / 1200, c = single(p, t); if (c > hi) { hi = c; at = t; } }
      Object.assign(out, { peak: hi, peakAt: at, trough: 0, plateau: 0 });
      out.fall = fallTime(p, SS_GAP, hi, at);
    }
    // Steady state only means something for amounts given again and again.
    out.single = !p.repeat;
    if (out.single) { out.ssTime = NaN; out.ssUsual = NaN; }
    return out;
  }
  window.PKModel = { H0, SS_GAP, NORMAL, STATES, build, mix, CL, kel, halfLife, share, single, level, plateauAt, steadyTime, fallTime, curve, summary, doseTimes };
})();
