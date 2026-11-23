// An illustrative model of one cell's G protein signalling. Nothing in this file is a reference value.
//
// Each G protein's alpha subunit is either off (holding GDP) or on (holding GTP). Receptors with a
// signal bound switch alpha on; alpha switches itself off by splitting GTP. At steady state the share of
// alpha that is on is on / (on + off), where on = a small resting rate plus the signal, and off = the
// GTP-splitting timer.
// Each toxin tags a share of its target, and the two groups are modelled separately:
//   - Cholera toxin: tagged Gs alpha cannot split GTP, so it locks on (all of it on, at steady state);
//     untagged Gs switches as normal.
//   - Pertussis toxin: tagged Gi cannot swap GDP for GTP, so it locks off; untagged Gi switches as normal.
// Gs drives adenylyl cyclase, Gi brakes it; cyclic AMP is made by the cyclase and cleared by a steady
// phosphodiesterase, so its level is proportional to the cyclase's rate. Gq drives phospholipase C, whose
// rate sets IP3, and IP3 sets how much calcium leaves the store. Every output is relative to the resting
// cell (1 = rest), except the shares of alpha switched on.

const REST = 0.1;        // receptor-free switching on, as a rate (the timer's rate is 1)
const GAIN = 3;          // extra switching on with a full signal
const CYCLASE = { base: 0.2, gs: 2, gi: 0.8 };
const PLC = { base: 0.2, gq: 2 };
const CA_GAIN = 2;       // calcium's rise for each unit IP3 rises

const share = (on, off) => (on + off > 0 ? on / (on + off) : 0);

// signals 0..1: gs, gi, gq (hormone at each kind of receptor); toxins 0..1: ctx (cholera), ptx (pertussis)
function raw({ gs = 0, gi = 0, gq = 0, ctx = 0, ptx = 0 } = {}) {
  // Two groups of each toxin's target: the tagged share is locked (Gs on, Gi off); the rest switch as normal.
  const sOn = ctx * 1 + (1 - ctx) * share(REST + GAIN * gs, 1);
  const iOn = ptx * 0 + (1 - ptx) * share(REST + GAIN * gi, 1);
  const qOn = share(REST + GAIN * gq, 1);
  const cyclase = (CYCLASE.base + CYCLASE.gs * sOn) * (1 - CYCLASE.gi * iOn);
  const plc = PLC.base + PLC.gq * qOn;
  return { sOn, iOn, qOn, cyclase, plc };
}
const R0 = raw();

export function solve(s = {}) {
  const r = raw(s);
  const camp = r.cyclase / R0.cyclase, ip3 = r.plc / R0.plc;
  // The heart pacemaker reading takes the receptor signals only: neither toxin is taken to reach the heart.
  const heart = raw({ gs: s.gs, gi: s.gi }).cyclase / R0.cyclase;
  return {
    gsOn: r.sOn, giOn: r.iOn, gqOn: r.qOn, rest: { gsOn: R0.sOn, giOn: R0.iOn, gqOn: R0.qOn },
    camp, ip3, calcium: 1 + CA_GAIN * (ip3 - 1),
    // a gut lining cell: cyclic AMP, through protein kinase A, opens CFTR chloride channels
    chloride: camp,
    heartCamp: heart,
  };
}

// How far a G protein's alpha has moved off its receptor in the pictures: 0 at rest, 1 fully on.
export const drawnOn = (on, rest) => Math.max(0, Math.min(1, (on - rest) / (1 - rest)));

// The pacemaker's rate rises with the fourth root of its cyclic AMP: an illustrative curve that keeps the
// rate inside a believable band. base comes from clinical-values.json (modelBaseline.hr).
export const heartRate = (base, heartCamp) => base * Math.pow(heartCamp, 0.25);

export const STATES = {
  rest: {},
  gs: { gs: 1 },
  gi: { gi: 1 },
  gq: { gq: 1 },
  cholera: { ctx: 1 },
  pertussis: { gi: 1, ptx: 1 },
};
