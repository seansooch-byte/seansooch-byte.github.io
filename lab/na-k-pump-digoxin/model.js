// An illustrative model of one heart muscle cell's Na+/K+ pumps, digoxin and calcium. Digoxin binds a pocket on
// the pump's outer face, and potassium bound to the pump weakens that binding; the pumps still working set how
// much sodium builds up inside; a smaller sodium gradient leaves more calcium in the store; calcium sets the
// squeeze, and an overfilled store spills calcium between beats (a delayed afterdepolarization). Everything but
// the plasma values and voltages is relative to normal (1 = a cell with no digoxin at the baseline potassium).
// Every number the model uses comes from clinical-values.json: the baseline (modelBaseline) and the model's own
// illustrative parameters (modelParams). Nothing here is a reference value.

// Digoxin amounts are model settings without units: 1 is the lesson's usual amount, 2.5 its toxic amount.
export const DIGOXIN = { none: 0, usual: 1, toxic: 2.5, max: 3 };

// The numbers solve() needs, read from the data file. Throws if one is missing.
export function anchorsFrom(cv) {
  const b = cv.modelBaseline, p = cv.modelParams || {};
  const v = key => { const x = p[key]?.value; if (typeof x !== 'number') throw new Error(`no model parameter ${key}`); return x; };
  const ap = p.actionPotential, tr = p.traceRange;
  if (![ap?.peak, ap?.notch, ap?.plateauEnd, tr?.low, tr?.high].every(x => typeof x === 'number')) throw new Error('no action potential or trace range');
  return {
    kOut: b.kOut, naOut: b.naOut, vRest: b.vRest, threshold: b.threshold,
    bind: v('digoxinBinding'), kHalf: v('potassiumHalfActivation'), naPower: v('sodiumPower'), naMax: v('sodiumInsideMax'),
    storeMax: v('storeMax'), squeezeMax: v('squeezeMax'), spill: v('calciumSpill'), dadGain: v('afterdepolarizationGain'),
    dadMax: v('afterdepolarizationMax'), slope: v('restingSlope'),
    ap: { peak: ap.peak, notch: ap.notch, plateauEnd: ap.plateauEnd }, trace: { low: tr.low, high: tr.high },
  };
}

// dig: illustrative digoxin amount (0 to 3); kOut: plasma potassium, mM.
export function solve(a, { dig = 0, kOut = a.kOut } = {}) {
  const k = Math.max(0.5, kOut);
  const g = a.bind * Math.max(0, dig) * (a.kOut / k) ** 2;
  const jammed = g / (1 + g);
  const act = (k / (k + a.kHalf)) / (a.kOut / (a.kOut + a.kHalf));
  const pump = (1 - jammed) * act;
  const naIn = Math.min(a.naMax, pump ** -a.naPower);
  const store = Math.min(a.storeMax, naIn ** 2);
  const squeeze = Math.min(a.squeezeMax, Math.sqrt(store));
  const vRest = a.vRest + a.slope * Math.log10(k / a.kOut);
  const dad = Math.min(a.dadMax, Math.max(0, store - a.spill) * a.dadGain);
  const peak = vRest + dad, triggered = dad > 0 && peak >= a.threshold;
  return {
    dig, kOut: k, jammed, pump, naIn, store, squeeze, vRest, dad, peak, triggered, threshold: a.threshold,
    values: { kOut: k, naOut: a.naOut, vRest },
  };
}
