// An illustrative model of a resting membrane. Potassium and sodium each have a balance voltage set by how
// crowded they are inside compared with outside. The resting membrane is open mostly to potassium (a small
// sodium leak), so its resting voltage sits close to potassium's balance point; the pump adds a few
// millivolts more negative. Sodium channels stand ready at a negative rest and stay inactivated when the
// rest rises. Every number comes from clinical-values.json (modelBaseline, modelParams); nothing in this file
// is a reference value.

export function anchorsFrom(cv) {
  const b = cv.modelBaseline, p = cv.modelParams, v = k => p[k].value;
  return {
    kOut: b.kOut, threshold: b.threshold,
    kIn: v('kIn'), naIn: v('naIn'), naOut: v('naOut'), leak: v('leakRatio'), slope: v('slope'),
    pump: v('pumpShift'), naHalf: v('naHalf'), naSlope: v('naSlope'), peak: v('spikePeak'), undershoot: v('undershoot'),
  };
}

// kOut: potassium outside, mM; leak: sodium's openness compared with potassium's (default the baseline's).
export function solve(a, { kOut = a.kOut, leak = a.leak } = {}) {
  const k = Math.max(0.5, kOut), r = Math.max(0, leak);
  const eK = a.slope * Math.log10(k / a.kIn);
  const eNa = a.slope * Math.log10(a.naOut / a.naIn);
  const vRest = a.slope * Math.log10((k + r * a.naOut) / (a.kIn + r * a.naIn)) + a.pump;
  // share of sodium channels ready to open at this resting voltage
  const ready = 1 / (1 + Math.exp((vRest - a.naHalf) / a.naSlope));
  return {
    kOut: k, leak: r, eK, eNa, vRest, ready, gap: a.threshold - vRest, threshold: a.threshold,
    // how strongly crowding pushes potassium out: the inside-to-outside ratio, on a tenfold scale
    push: Math.log10(a.kIn / k),
    values: { kOut: k, vRest, eK },
  };
}
