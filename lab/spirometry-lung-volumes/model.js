// Lesson 24 teaching model: the lung volumes and one forced breath, from three settings.
//   r  airway resistance, 1 = normal. Above 1 the airways are narrowed (asthma before a bronchodilator).
//   c  lung compliance, 1 = normal. Above 1 the lung stretches easily and recoils weakly (emphysema);
//      below 1 it is stiff (fibrosis).
//   e  effort, 1 = a full, fast blow. Below 1 the blow starts slowly and stops early.
// No reference number lives here: setBaseline() takes the normal tidal volume, residual volume, functional
// residual capacity and vital capacity from clinical-values.json. Every size of change is illustrative; only
// the directions are meant to teach.
//
// Expected behaviour (no test infrastructure for lesson models; lab-walk drives the pictures):
//   - normal (r 1, c 1, e 1): the volumes equal the baseline; most of the breath leaves in the first second
//     (TAU0 is a model setting chosen for that, not a reference value).
//   - r up: residual volume and FRC rise (air trapped behind narrow airways), TLC stays put, FEV1 falls far
//     more than FVC so the ratio falls, the peak falls and the loop's downslope scoops (bows inward).
//   - c up: RV, FRC and TLC all rise (hyperinflation), VC falls a little because RV rises more than TLC,
//     emptying slows (weak recoil, airways that collapse), the ratio falls and the downslope scoops.
//   - c down: every volume falls (a stiff lung also takes smaller quiet breaths); FEV1 and FVC fall together,
//     so the ratio stays normal or rises; the loop is narrow with a steep downslope, and its peak is a little
//     below normal: the push is the same but it drives a smaller lung (high flow for the volume, not overall).
//   - e down (p.fade false: the push is weaker but kept up): the peak falls, the downslope is unchanged.
//   - e down: the lung is unchanged, so every volume is unchanged; the peak is lower and later, the blow
//     stops early so FVC and FEV1 both fall, and the downslope it reaches is the normal one.

let B = { tv: .11, rv: .27, frc: .53, vc: 1 };   // stand-in, in vital capacities, until the data file loads
export const NORMAL = { r: 1, c: 1, e: 1 };
export function setBaseline(b) { B = { ...b }; }

const TAU0 = -1 / Math.log(1 - .8);   // model setting, seconds: the normal model empties 80 % of its breath in 1 s
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** The static volumes, in the baseline's units. */
export function volumes(p) {
  const r = clamp(p.r, .5, 4), c = clamp(p.c, .4, 2.5);
  const stiff = Math.sqrt(Math.min(c, 1)), loose = Math.max(0, c - 1), trap = .175 * Math.max(0, r - 1);
  const TLC0 = B.vc + B.rv;
  const tlc = TLC0 * stiff * (1 + .18 * loose);
  const rv = B.rv * stiff * (1 + .9 * loose) + B.rv * trap;
  const frc = B.frc * stiff * (1 + .45 * loose) + .7 * B.rv * trap;
  const tv = Math.min(B.tv * stiff, (tlc - frc) * .4);
  return { tlc, rv, frc, tv, erv: frc - rv, irv: tlc - frc - tv, ic: tlc - frc, vc: tlc - rv };
}

/** One forced breath out from TLC, then a full breath back in. Returns the volumes, the samples
 *  [t, volume out, flow] of the blow, the inspiratory limb [volume out, flow] and the measures. */
export function forced(p) {
  const r = clamp(p.r, .5, 4), c = clamp(p.c, .4, 2.5), e = clamp(p.e ?? 1, .3, 1);
  const v = volumes(p), F = v.vc;
  const tau = TAU0 * Math.pow(r, .7) * (c > 1 ? Math.pow(c, .3) : Math.pow(c, .75));
  // shape > 1 bows the downslope inward (a scooped loop): narrowed airways close off as the lung empties
  const shape = 1 + 1.1 * Math.max(0, r - 1) + 1.6 * Math.max(0, c - 1);
  // what the chest muscles can drive: it scales with the lung's own size, so a small stiff lung peaks at or
  // below normal even though it empties fast
  const Fn = B.vc, pmax = 1.3 * F / TAU0 * e, rise = .035 / e;
  const hold = e < 1 && p.fade !== false ? 1.7 * e : Infinity;                         // a poor blow also fades out early
  const cutoff = .005 * Fn, dt = .004;
  const pts = [[0, 0, 0]];
  let t = 0, V = 0, fev1 = null, pef = 0, tPef = 0;
  while (t < 12) {
    const limb = F / tau * Math.pow(Math.max(0, F - V) / F, shape);
    const q = Math.min(pmax * (1 - Math.exp(-(t + dt / 2) / rise)) * Math.exp(-t / hold), limb);
    if (q > pef) { pef = q; tPef = t; }
    V = Math.min(F, V + q * dt); t += dt;
    if (fev1 === null && t >= 1) fev1 = V;
    pts.push([t, V, q]);
    if (t > .3 && q < cutoff) break;
  }
  if (fev1 === null) fev1 = V;
  const fvc = V, tEnd = t;
  // breathing back in: a smooth limb under the axis, from the end of the blow to TLC
  const pif = .55 * F / TAU0 * e / (1 + .1 * Math.max(0, r - 1));
  const insp = [];
  for (let i = 0; i <= 48; i++) { const u = i / 48; insp.push([fvc * (1 - u), -pif * Math.pow(Math.sin(Math.PI * u), .8)]); }
  return { ...v, p: { r, c, e }, pts, insp, fev1, fvc, ratio: fvc > 0 ? fev1 / fvc : 0, pef, tPef, tEnd, tau, shape };
}
// The states the lesson teaches, as settings. Sizes are illustrative.
export const STATES = {
  normal: { r: 1, c: 1, e: 1 },
  asthma: { r: 2.1, c: 1, e: 1 },
  emphysema: { r: 1.3, c: 2.1, e: 1 },
  fibrosis: { r: 1, c: .5, e: 1 },
  bronchodilator: { r: 1.25, c: 1, e: 1 },   // the asthma lung after its airways reopen
  effort: { r: 1, c: 1, e: .45 },
};
