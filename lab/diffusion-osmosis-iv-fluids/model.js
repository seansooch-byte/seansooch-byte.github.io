// An illustrative model of where an IV fluid goes. Body water is one unit split into three rooms:
// inside cells, between cells and plasma. Water moves until every room holds the same concentration
// of particles that cannot cross the cell membrane. Salt stays outside cells, colloid stays in the
// vessels, and sugar counts as a particle until cells take it up. The split and the marker anchors
// come from clinical-values.json; nothing in this file is a reference value.

// Strengths are relative to the body's own fluid (1 = the same concentration).
export const FLUIDS = {
  isotonic:   { label: 'Isotonic crystalloid', salt: 1,   sugar: 0, colloid: false },
  hypotonic:  { label: 'Hypotonic fluid',      salt: 0.5, sugar: 0, colloid: false },
  hypertonic: { label: 'Hypertonic fluid',     salt: 3,   sugar: 0, colloid: false },
  colloid:    { label: 'Colloid',              salt: 1,   sugar: 0, colloid: true },
  glucose:    { label: 'Glucose solution',     salt: 0,   sugar: 1, colloid: false },
  water:      { label: 'Free water',           salt: 0,   sugar: 0, colloid: false },
};

// The largest amount the Explore sliders give, as a share of body water.
export const MAX_SHARE = 0.1;

// The model's starting point lives in clinical-values.json (modelBaseline), next to the references it
// must sit inside. Total osmolality = tonicity + particles that cross cell membranes freely.
export function anchorsFrom(cv) {
  const b = cv.modelBaseline;
  return {
    inside: b.icfShare / 100,
    plasmaOfOutside: b.plasmaShare / 100,
    tonicity: b.tonicity, crossing: b.sosm - b.tonicity, na: b.na, bcop: b.bcop,
  };
}

// volume: share of body water given; salt, sugar: strengths; uptake: 0..1 of the sugar taken up.
export function solve(a, { volume = 0, salt = 1, sugar = 0, uptake = 0, colloid = false } = {}) {
  const in0 = a.inside, out0 = 1 - a.inside, pl0 = a.plasmaOfOutside * out0, isf0 = out0 - pl0;
  const V = Math.max(0, volume);
  const particlesIn = in0;
  const particlesOut = out0 + V * salt + V * sugar * (1 - uptake);
  const water = 1 + V;
  const conc = (particlesIn + particlesOut) / water;
  const inside = particlesIn / conc;
  const outside = water - inside;
  const held = colloid ? V : 0;
  const plasma = a.plasmaOfOutside * (outside - held) + held;
  const isf = outside - plasma;
  const pull = (pl0 + held) / plasma; // colloid brings its own pull at the plasma's strength
  const sodium = (out0 + V * salt) / outside;
  // Before any water crosses the cell membrane: the fluid has only spread through the space outside cells.
  const preOutside = out0 + V;
  const prePlasma = colloid ? pl0 + V : a.plasmaOfOutside * preOutside;
  return {
    volume: V, conc, sodium, pull, protein: (pl0 + held) / pl0,
    cell: inside / in0, isf: isf / isf0, plasma: plasma / pl0,
    pre: {
      isf: (preOutside - prePlasma) / isf0, plasma: prePlasma / pl0,
      conc: (out0 + V * salt + V * sugar) / preOutside, // the sugar still outside cells
      concNoSugar: (out0 + V * salt) / preOutside,       // the sugar taken up, no water moved yet
    },
    went: V > 0 ? { inside: (inside - in0) / V, isf: (isf - isf0) / V, plasma: (plasma - pl0) / V } : { inside: 0, isf: 0, plasma: 0 },
    values: {
      // freely crossing particles (such as urea) spread through all body water, so the fluid only dilutes them
      sosm: a.tonicity * conc + a.crossing / water,
      tonicity: a.tonicity * conc,
      na: a.na * sodium,
      bcop: a.bcop * pull,
      icfShare: 100 * inside / water,
      plasmaShare: 100 * plasma / outside,
    },
  };
}

export const settingsFor = (fluid, amount, uptake = 1) => {
  const f = FLUIDS[fluid];
  return { volume: amount / 100 * MAX_SHARE, salt: f.salt, sugar: f.sugar, uptake, colloid: f.colloid };
};
