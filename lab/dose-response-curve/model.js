// An illustrative model of a dose-response curve. A drug at concentration c fills a share of the receptors
// (occupancy); each filled receptor adds a push set by the drug's efficacy; the cell's response adds up the
// pushes and cannot go past its own top effect (1). Concentrations are in units of the normal agonist's
// binding constant (c = 1 fills half the receptors), so nothing in this file is a dose or a reference value.
//
// p: {
//   eff:  efficacy of the agonist, how far it switches a receptor on (1 full agonist, 0.5 partial agonist)
//   k:    how tightly it binds: the concentration that fills half the receptors (1 normal, 0.1 ten times tighter)
//   comp: competitive antagonist present, in units of its own binding constant (0 none, 9 shifts the curve 10x)
//   nonc: share of receptors a noncompetitive antagonist puts out of action (0 to 1)
//   n:    receptor number compared with the normal tissue (1 normal, more than 1 spare receptors)
// }
export const NORMAL = Object.freeze({ eff: 1, k: 1, comp: 0, nonc: 0, n: 1 });

// The share of receptors the agonist holds: the competitive antagonist takes its share of the turns.
export const occupancy = (c, p) => c <= 0 ? 0 : c / (c + p.k * (1 + p.comp));
// Each filled, working receptor adds eff; the normal tissue needs every receptor fully on for its top.
const gain = p => p.n * (1 - p.nonc) * p.eff;
export const effect = (c, p) => Math.min(1, gain(p) * occupancy(c, p));
// The curve's ceiling: its effect with every receptor filled.
export const ceiling = p => Math.min(1, gain(p));
// The concentration giving half of the curve's own ceiling (null if it has none).
export function ec50(p) {
  const g = gain(p);
  if (g <= 0) return null;
  const occ = ceiling(p) / 2 / g;
  return p.k * (1 + p.comp) * occ / (1 - occ);
}
// The share of receptors filled when the effect is half its ceiling.
export const occAtHalf = p => { const e = ec50(p); return e == null ? null : occupancy(e, p); };

// The lesson's changes, each against NORMAL.
export const CHANGES = {
  full: { k: 0.1 },          // a full agonist that binds ten times more tightly
  partial: { eff: 0.5 },     // switches each receptor half on
  competitive: { comp: 9 },  // ten times the agonist for the same effect
  noncompetitive: { nonc: 0.6 }, // six receptors in ten out of action
  spare: { n: 10 },          // ten times the receptors the top effect needs
};
export const withChange = kind => ({ ...NORMAL, ...CHANGES[kind] });

// Between two settings, moving each in the way it acts (binding and receptor number on a log scale).
export function between(a, b, e) {
  const lg = (x, y) => 10 ** (Math.log10(x) + (Math.log10(y) - Math.log10(x)) * e);
  return {
    eff: a.eff + (b.eff - a.eff) * e,
    k: lg(a.k, b.k),
    comp: lg(1 + a.comp, 1 + b.comp) - 1,
    nonc: a.nonc + (b.nonc - a.nonc) * e,
    n: lg(a.n, b.n),
  };
}
