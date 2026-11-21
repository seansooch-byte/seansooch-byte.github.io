// An illustrative model of one nerve fiber: eight internodes (covered stretches) between nine nodes. An
// action potential at one node sends charge spreading along the axon to the next. Under healthy myelin
// that charge still lifts the next node FULL_RISE mV above rest; where a patch has lost myelin, charge
// leaks out and the lift shrinks in step with the share lost. The next node fires if the lift reaches
// threshold (threshold minus rest, from clinical-values.json), and the weaker the lift, the longer the
// node takes to get there. A lift below threshold fires nothing: the impulse is blocked. A bare axon has
// no sheath and fires patch by patch, far more slowly. Nothing in this file is a reference value: the
// resting, threshold and peak voltages come from clinical-values.json; every other number is a teaching
// choice.

export const INTERNODES = 8;
// The first internode of a patch that loses myelin (internodes are numbered from 0, left to right).
export const PATCH_START = 2;
// How far above rest the spreading charge lifts the next node under healthy myelin (mV, illustrative).
export const FULL_RISE = 60;
// Model time per internode: a node's own firing, plus the time its charge takes to lift the next node,
// which grows as the lift shrinks. A bare axon takes BARE_T to cover the same length, firing patch by patch.
const NODE_T = 0.02, CHARGE_T = 0.32, BARE_T = 0.5;

// The presets the lesson, Explore freely and Clinical values share. loss: percent of myelin lost in the
// patch; len: internodes in the patch.
export const PRESETS = {
  healthy: { bare: false, loss: 0, len: 3 },
  ms: { bare: false, loss: 50, len: 3 },
  gbs: { bare: false, loss: 50, len: 5 },
  block: { bare: false, loss: 90, len: 3 },
  bare: { bare: true, loss: 0, len: 3 },
};

export function anchorsFrom(cv) {
  const v = id => cv.values.find(x => x.id === id)?.typical;
  return { rest: v('rest'), threshold: v('threshold'), peak: v('peak') };
}

// Lift at a node beyond an internode that has lost `loss` percent of its myelin (integers keep 75% exact).
export const riseFor = loss => FULL_RISE * (100 - loss) / 100;
// The largest loss that still lets the next node reach threshold; more than this blocks.
export const lastPassingLoss = a => 100 * (1 - (a.threshold - a.rest) / FULL_RISE);

export function solve(a, { bare = false, loss = 0, len = 3 } = {}) {
  const need = a.threshold - a.rest;
  const healthyStep = NODE_T + CHARGE_T * need / FULL_RISE;
  const healthyTotal = INTERNODES * healthyStep;
  const inPatch = k => !bare && loss > 0 && k >= PATCH_START && k < PATCH_START + len;
  const times = [0];
  let blockedAt = null;
  for (let k = 0; k < INTERNODES; k++) {
    if (bare) { times.push(times[k] + BARE_T); continue; }
    const rise = riseFor(inPatch(k) ? loss : 0);
    if (rise < need) { blockedAt = k + 1; break; }
    times.push(times[k] + NODE_T + CHARGE_T * need / rise);
  }
  const arrival = blockedAt == null ? times[INTERNODES] : null;
  const patchRise = bare ? null : riseFor(loss);
  return {
    bare, loss, len, need, times, blockedAt, arrival, healthyTotal,
    // when the charge from the last node to fire has faded out, if the impulse is blocked
    failTime: blockedAt == null ? null : times[blockedAt - 1] + NODE_T + CHARGE_T,
    relTime: arrival == null ? null : arrival / healthyTotal,
    speed: arrival == null ? null : healthyTotal / arrival,
    patchRise, fires: blockedAt == null,
    values: { rest: a.rest, threshold: a.threshold, peak: arrival == null ? null : a.peak },
  };
}
