// The Nephron and Diuretics · The Lab · teaching model
// One nephron as a chain of segments. Amounts are shares of what the filter lets through
// (100 = everything filtered). Each segment takes back part of the salt that reaches it, so
// blocking one segment sends more salt downstream, where later segments catch some of it.
// Water follows salt where the walls let it; at the end, urine can only be so concentrated,
// so every bit of salt (or other solute) left in the tube carries water out with it.
//
// Every reference number (the share of sodium each segment takes back, typical urine output,
// plasma potassium and bicarbonate) comes from clinical-values.json through calibrate().
// The constants below are only the model's shape and the strength of each drug's effect.

export const DRUGS = ['loop', 'thiazide', 'ksp', 'ca', 'osmotic'];
export const NO_DRUG = Object.freeze({ loop: 0, thiazide: 0, ksp: 0, ca: 0, osmotic: 0 });

export const P = Object.freeze({
  caBlock: 0.28,        // share of proximal sodium uptake removed at the model's strongest CA inhibition
  osmPt: 0.15,          // ...and by an osmotic diuretic (it dilutes luminal salt)
  osmPtWater: 0.4,      // proximal water held in the tube by an unreabsorbed solute
  descFrac: 0.45,       // share of arriving water the descending limb gives up (full gradient)
  osmDesc: 0.5,
  loopBlock: 0.9,       // share of thick ascending limb uptake removed at the strongest setting
  thzBlock: 0.85,       // share of distal tubule uptake capacity removed
  kspBlock: 0.75,       // share of collecting duct uptake capacity removed
  gradLoop: 0.8, gradOsm: 0.3,            // loss of the medulla's salt gradient
  concGain: 1.2,        // most concentrated urine = (1 + concGain × gradient) × plasma strength
  saltOsm: 0.9, otherOsm: 1.26, mannitolOsm: 6,
  bvMaxLoss: 0.12, bvScale: 6,
  kExp: 0.18, kspK: 0.7,
  caHco3: 0.25, contraction: 0.08, kspHco3: 0.06,
});

// Filled in from clinical-values.json by calibrate().
export let CAL = null;

const typical = (cv, id) => {
  const v = cv.values.find(x => x.id === id);
  if (!v) throw new Error(`clinical-values.json has no value "${id}"`);
  return v;
};

export function calibrate(cv) {
  const pt = typical(cv, 'pt_na').typical, tal = typical(cv, 'tal_na').typical, dct = typical(cv, 'dct_na').typical;
  const fenaMax = typical(cv, 'fena').high;
  const dctLoad = 100 - pt - tal;            // sodium reaching the distal tubule with no drug
  const cdLoad = dctLoad - dct;              // ...and the collecting duct
  const out = fenaMax / 2;                   // excretion set halfway inside the "less than" limit
  CAL = {
    ptFrac: pt / 100,
    talFrac: tal / (100 - pt),
    // Uptake that saturates: half-saturated at the no-drug load, so it takes back the reference share there.
    dctHalf: dctLoad, dctMax: 2 * dct,
    cdHalf: cdLoad, cdMax: 2 * (cdLoad - out),
    urine: typical(cv, 'urine').typical,
    kBase: typical(cv, 'k').typical,
    hco3Base: typical(cv, 'hco3').typical,
  };
  B = core(NO_DRUG);
  return CAL;
}

const c01 = x => Math.min(1, Math.max(0, Number(x) || 0));

function core(drugs) {
  if (!CAL) throw new Error('model not calibrated');
  const loop = c01(drugs.loop), thz = c01(drugs.thiazide), ksp = c01(drugs.ksp), ca = c01(drugs.ca), osm = c01(drugs.osmotic);
  const ptFrac = CAL.ptFrac * (1 - P.caBlock * ca) * (1 - P.osmPt * osm);
  const s = {}, w = {};

  // salt
  let salt = 100;
  s.pt = salt * ptFrac; salt -= s.pt;
  const saltToLoop = salt;
  s.desc = 0;
  s.tal = salt * CAL.talFrac * (1 - P.loopBlock * loop); salt -= s.tal;
  const saltToDct = salt;
  const dMax = CAL.dctMax * (1 - P.thzBlock * thz);
  s.dct = dMax * salt / (CAL.dctHalf + salt); salt -= s.dct;
  const saltToCd = salt;
  const cMax = CAL.cdMax * (1 - P.kspBlock * ksp);
  s.cd = cMax * salt / (CAL.cdHalf + salt); salt -= s.cd;
  const saltOut = salt;

  // water
  let water = 100;
  w.pt = 100 * ptFrac * (1 - P.osmPtWater * osm); water -= w.pt;
  const waterToLoop = water;
  const gradient = (1 - P.gradLoop * loop) * (1 - P.gradOsm * osm);
  w.desc = water * P.descFrac * gradient * (1 - P.osmDesc * osm); water -= w.desc;
  w.tal = 0; w.dct = 0;
  const waterToCd = water;
  const maxConc = 1 + P.concGain * gradient;
  const solute = P.saltOsm * saltOut + P.otherOsm + P.mannitolOsm * osm;
  const waterOut = Math.min(waterToCd, solute / maxConc);
  w.cd = waterToCd - waterOut;

  return {
    drugs: { loop, thiazide: thz, ksp, ca, osmotic: osm },
    s, w, saltOut, waterOut, gradient, maxConc, solute,
    saltIn: { pt: 100, desc: saltToLoop, tal: saltToLoop, dct: saltToDct, cd: saltToCd },
    waterIn: { pt: 100, desc: waterToLoop, tal: waterToCd, dct: waterToCd, cd: waterToCd },
    // what is left in the tube after each stop: filtered, proximal, loop down, loop up, distal, urine
    saltLeft: [100, saltToLoop, saltToLoop, saltToDct, saltToCd, saltOut],
    waterLeft: [100, waterToLoop, waterToCd, waterToCd, waterToCd, waterOut],
  };
}

let B = null;

export function run(drugs = NO_DRUG) {
  const m = core(drugs);
  const { ksp, ca } = m.drugs;
  // Salt and water lost beyond the baseline shrink blood volume, saturating (no reflexes or hormones).
  const loss = 0.6 * (m.saltOut - B.saltOut) + 0.4 * (m.waterOut - B.waterOut);
  const bv = 1 - P.bvMaxLoss * (1 - Math.exp(-Math.max(0, loss) / P.bvScale));
  const contraction = (1 - bv) / P.bvMaxLoss;
  // Potassium is pushed into the urine harder when more salt and flow reach the collecting duct,
  // and less when aldosterone's channel is blocked; plasma potassium settles lower or higher.
  const kDrive = Math.max(0.05, Math.sqrt(m.saltIn.cd / B.saltIn.cd) * (m.waterOut / B.waterOut) ** 0.2 * (1 - P.kspK * ksp));
  const k = CAL.kBase * kDrive ** -P.kExp;
  // Volume loss stands in, crudely, for the hormone-driven contraction alkalosis.
  const hco3 = CAL.hco3Base * (1 - P.caHco3 * ca) * (1 + P.contraction * contraction) * (1 - P.kspHco3 * ksp);
  const urine = CAL.urine * m.waterOut / B.waterOut; // mL/day, scaled from the typical value
  return { ...m, bv, kDrive, k, hco3, urine, fena: m.saltOut };
}

const pct = x => `${Math.round(x * 100)} %`;
// What each drug's strongest model setting actually does, for the Clinical values tab.
export const MODEL_NOTES = {
  loop: `Thick ascending limb sodium uptake cut by ${pct(P.loopBlock)}, and the medulla's salt gradient by ${pct(P.gradLoop)}; later segments are untouched.`,
  thiazide: `Early distal tubule sodium uptake capacity cut by ${pct(P.thzBlock)}.`,
  ksp: `Collecting duct sodium uptake capacity cut by ${pct(P.kspBlock)}; the drive pushing potassium into the urine cut by ${pct(P.kspK)}.`,
  ca: `Proximal tubule sodium uptake cut by ${pct(P.caBlock)}; plasma bicarbonate lowered by ${pct(P.caHco3)} as a simple stand-in for bicarbonate lost in the urine.`,
  osmotic: 'A solute that is filtered and never taken back, holding water in the proximal tubule and descending limb.',
};
