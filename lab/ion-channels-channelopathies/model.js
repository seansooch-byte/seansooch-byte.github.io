// Two illustrative teaching models, shared by the lesson's pictures and its two reference tabs.
// Nothing in this file is a reference value: the anchors that turn model outputs into the units of the
// Clinical values tab come from clinical-values.json (modelBaseline).
//
// The airway: chloride flow through CFTR is the share of channels that reach the membrane times how well
// their gates open (1 = normal). Sodium and water follow chloride, so the depth of the airway surface liquid
// follows the flow; cilia need a deep enough layer to beat, and mucus clearance follows the cilia.
//
// The heart: one ventricular muscle cell's voltage after its upswing, from four currents in arbitrary units:
// an inward calcium current that fades, a repolarizing potassium current that switches on slowly (scaled by
// its channels' function, 1 = normal), the inward rectifier that holds rest, and an optional late sodium
// current from sodium channels that fail to inactivate. The voltage moves against their sum.

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/* ---------- Airway ---------- */
export const AIRWAY_PRESETS = {
  normal: { surface: 1, gating: 1 },
  cf: { surface: 0.1, gating: 0.3 },          // most protein misfolds and is destroyed; what arrives barely opens
  modulators: { surface: 0.65, gating: 0.92 }, // a corrector brings protein to the membrane, a potentiator opens it
};
export function airway({ surface = 1, gating = 1 } = {}) {
  const flow = clamp(surface, 0, 1) * clamp(gating, 0, 1);
  const depth = 0.3 + 0.7 * flow;                    // liquid depth, 1 = normal
  const cilia = clamp((depth - 0.45) / 0.55, 0, 1);  // share of normal beating: flat below about half depth
  return { surface, gating, flow, depth, cilia, clearance: cilia };
}

/* ---------- Heart muscle cell ---------- */
export const HEART_PRESETS = {
  normal: { gK: 1, late: 0 },
  lqtk: { gK: 0.5, late: 0 },   // half the repolarizing potassium current
  lqtna: { gK: 1, late: 0.2 },  // a late sodium leak
};
const P = { ca: 0.6, k: 2, tf: 120, tx: 150, dt: 0.5, T: 800 };
const cache = new Map();
// Returns the trace (every 2 ms), its currents, and three times in ms: the plateau's end (the voltage
// falls below 0 mV), the refractory period's end (below -60 mV, most of the way back to rest), the action
// potential's end (90 percent of the way back to rest), and the rest voltage.
export function heart({ gK = 1, late = 0 } = {}) {
  const key = `${gK.toFixed(3)}|${late.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key);
  let V = 20, plateauEnd = null, apd = null, refEnd = null;
  const trace = [], iK = [], iIn = [], iNaL = [];
  for (let t = 0; t <= P.T; t += P.dt) {
    const f = Math.exp(-t / P.tf), x = 1 - Math.exp(-t / P.tx), r = 1 / (1 + Math.exp((V + 5) / 14));
    const ICa = P.ca * f * (V - 60) / 100;
    const IK = P.k * gK * x * r * (V + 90) / 100;
    const IK1 = 2.5 * (V + 90) / 100 / (1 + Math.exp((V + 50) / 7));
    const INaL = late * (V - 60) / 100 / (1 + Math.exp(-(V + 40) / 5));
    const Ito = 2.5 * Math.exp(-t / 5) * (V + 90) / 100;
    if (Math.round(t / P.dt) % 4 === 0) { trace.push([t, V]); iK.push([t, IK]); iIn.push([t, -ICa]); iNaL.push([t, -INaL]); }
    V += -(ICa + IK + IK1 + INaL + Ito) * P.dt;
    if (plateauEnd == null && t > 20 && V < 0) plateauEnd = t;
    if (apd == null && t > 20 && V < -81) apd = t;
    if (refEnd == null && t > 20 && V < -60) refEnd = t;   // refractory until most of the way back to rest
  }
  const out = { gK, late, trace, iK, iIn, iNaL, plateauEnd: plateauEnd ?? P.T, apd: apd ?? P.T, refEnd: refEnd ?? P.T, rest: V };
  cache.set(key, out);
  return out;
}
export const HEART_SPAN = P.T;
