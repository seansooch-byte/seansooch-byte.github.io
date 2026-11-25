// An illustrative model of enzyme speed. Substrate is counted in multiples of the plain enzyme's own Km
// (1 = the level that gives half speed), speed as a percent of the normal maximum speed (100 = every
// enzyme of a normal amount busy). Nothing in this file is a reference value.
//
//   plain enzyme:      speed = ceiling x S / (Km + S)               (the curve that bends and levels off)
//   allosteric enzyme: speed = ceiling x S^n / (K^n + S^n), n = HILL  (the S-shaped curve)
//
// What moves the curve:
//   enzyme amount      the ceiling, in proportion (Km unchanged)
//   competitive        Km x (1 + strength): same ceiling, more substrate needed
//   noncompetitive     ceiling / (1 + strength): the enzymes it holds are off; Km unchanged
//   irreversible       ceiling x (1 - share bonded): those molecules are gone for good; Km unchanged
//   modulator          the allosteric enzyme's half-speed level x factor (below 1 an activator, above 1 a brake)

export const HILL = 2.5;
export const S_MAX = 10;
// The allosteric enzyme's own half-speed level, so its S fits the same substrate axis.
export const ALLO_K = 3;

// The settings each "What changes it" step plays, so captions, predictions and pictures agree:
// competitive: Km three times normal; noncompetitive: the ceiling halved; irreversible: three quarters of
// the enzyme bonded (a quarter left); modulators: half-speed level halved (activator) or doubled (brake).
export const LESSON = { competitive: 2, noncompetitive: 1, irreversible: 0.75, activator: 0.5, brake: 2, more: 2 };

export const NORMAL = { enzyme: 1, comp: 0, nonc: 0, lost: 0, allosteric: false, mod: 1 };

export function params(o = {}) {
  const x = { ...NORMAL, ...o };
  return {
    vmax: 100 * x.enzyme * (1 - x.lost) / (1 + x.nonc),
    km: (1 + x.comp) * (x.allosteric ? ALLO_K * x.mod : 1),
    n: x.allosteric ? HILL : 1,
  };
}

export const speed = (s, p) => s <= 0 ? 0 : p.vmax * s ** p.n / (p.km ** p.n + s ** p.n);

// Points along the curve, substrate 0 to sMax.
export const curvePts = (p, sMax = S_MAX, n = 90) => Array.from({ length: n + 1 }, (_, i) => { const s = i / n * sMax; return [s, speed(s, p)]; });

// The share of the enzyme molecules holding a substrate at level s (inhibited ones hold none).
export function busyShare(s, o = {}) {
  const x = { ...NORMAL, ...o }, p = params(x);
  return speed(s, p) / (100 * x.enzyme);
}
