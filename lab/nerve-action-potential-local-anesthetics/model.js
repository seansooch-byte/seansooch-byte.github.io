// An illustrative model of a nerve impulse and a local anesthetic. The resting potential, threshold and
// peak come from clinical-values.json (the cited typical values); every other number here is a teaching
// choice, not a reference value, and none of them is a drug amount a person could be given.
//
// The impulse: a patch of membrane that fires lets sodium in, and that charge spreading inside lifts the
// next patch by SPREAD mV when every sodium channel is free. The next patch fires if that lift reaches
// threshold. With a share of channels blocked, the lift shrinks with the free share, so the impulse stops
// once the free share falls below (threshold - rest) / SPREAD: half, with the cited values.
//
// The drug: a weak base. Outside the nerve a share of it is uncharged and crosses the membrane; inside it
// becomes charged and plugs the channel from within. Acid outside keeps more of it charged, so less gets in.
// It binds open and inactivated channels most easily, so a fiber that fires faster gains more block.

export const SPREAD = 30;    // mV the spreading charge lifts the next patch, with every channel free
export const STIM_MAX = 30;  // mV the strongest stimulus in the model lifts the first patch
export const USE = 3;        // how much extra binding fast firing brings (use-dependent block)

export const FAMILIES = {
  ester: { label: 'Ester', where: 'typically broken down by esterases in the blood plasma' },
  amide: { label: 'Amide', where: 'broken down mainly in the liver' },
  articaine: { label: 'Articaine (an amide with an ester group)', where: 'largely broken down in the blood plasma, the exception among amides' },
};

// The model's anchors: the three cited values (modelBaseline in clinical-values.json) and the drawn
// undershoot, a teaching shape.
export function anchorsFrom(cv) {
  const b = cv.modelBaseline;
  return { rest: b.rest, threshold: b.threshold, peak: b.peak, undershoot: b.undershoot };
}

// Share of the drug outside the nerve that is uncharged, at acidity 0 (normal tissue) to 1 (acidic).
export const uncharged = acid => 1 / (1 + 4 * Math.pow(10, acid));
// Drug inside the nerve, relative to the amount injected in normal tissue.
export const inside = (amount, acid) => amount * uncharged(acid) / uncharged(0);
// Share of sodium channels blocked at a steady firing rate (0 resting to 1 fast).
export function blocked(amount, acid, rate) {
  const a = inside(amount, acid) * (1 + USE * rate);
  return a / (a + 1);
}
// The free share below which the impulse stops.
export const critical = a => (a.threshold - a.rest) / SPREAD;

// settings: { amount 0..2, acid 0..1, rate 0..1, stim 0..1 }
export function solve(a, { amount = 0, acid = 0, rate = 0.2, stim = 0.6 } = {}) {
  const b = blocked(amount, acid, rate), free = 1 - b;
  const stimV = a.rest + STIM_MAX * stim;
  const starts = stimV >= a.threshold;
  const lift = SPREAD * free;
  const passes = a.rest + lift >= a.threshold;
  const fires = starts && passes;
  return {
    amount, acid, rate, stim, blocked: b, free, stimV, starts, lift, passes, fires,
    uncharged: uncharged(acid), inside: inside(amount, acid),
    values: { rest: a.rest, threshold: a.threshold, peak: fires ? a.peak : null },
  };
}

// Use-dependent block impulse by impulse: block starts at the slow-firing level and climbs toward the
// fast-firing level as each impulse opens more channels to the drug.
export function blockTrain(amount, n, { slow = 0.05, fast = 1, tau = 2 } = {}) {
  const b0 = blocked(amount, 0, slow), b1 = blocked(amount, 0, fast);
  return Array.from({ length: n }, (_, i) => b0 + (b1 - b0) * (1 - Math.exp(-i / tau)));
}

// The voltage of one action potential, x ms after it crosses threshold (a teaching shape): a fast rise to
// the peak, a fall that overshoots below rest, and a slower return. Before x = 0 the stimulus ramps the
// membrane from where it was up to threshold.
const ss = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
export const AP = { rise: 0.4, fall: 1.0, back: 1.6, foot: 0.3 };
export function apV(a, x, from = a.rest) {
  const low = a.rest - a.undershoot;
  if (x < -AP.foot) return from;
  // the foot accelerates into threshold, and the upstroke leaves it already climbing, so there is no shoulder
  if (x < 0) { const u = (x + AP.foot) / AP.foot; return from + (a.threshold - from) * u * u; }
  if (x < AP.rise) { const u = x / AP.rise; return a.threshold + (a.peak - a.threshold) * (0.35 * u + 0.65 * ss(u)); }
  if (x < AP.rise + AP.fall) return a.peak + (low - a.peak) * ss((x - AP.rise) / AP.fall);
  return low + (a.rest - low) * ss((x - AP.rise - AP.fall) / AP.back);
}
// A nudge that does not reach threshold: up by lift mV, then back to rest.
export function bumpV(a, x, lift) {
  if (x < 0) return a.rest;
  const up = 0.3;
  return a.rest + lift * (x < up ? ss(x / up) : Math.exp(-(x - up) / 0.7));
}
