// The states the picture can show, as a table. Every field is qualitative and every field names the
// excerpts in ./sources.js that back it (why). Nothing here is computed: the picture looks each state up
// and draws it. A field the sources give no direction for is 'unstated', and the picture says
// "not stated" in words rather than guessing.
//   adh: 'high' | 'low' | 'normal' | 'absent' | 'ineffective' (present, but the kidney does not respond) | 'unstated'
//   aquaporins, urineVolume, urineConcentration: 'high' | 'low' | 'normal' | 'unstated'
//   blood (how concentrated the blood is): 'high' | 'low' | 'normal' | 'unstated'
//   sodiumMarker: 'normal' | 'up' | 'down' (moves, stays inside the lines) | 'hypo' | 'hyper' (crosses) | 'unstated'
//   water: 'normal' | 'lost' | 'extra' (water in or out of the body, drawn as an arrow on the blood vessel)
(() => {
const A = window.ADH;
const SOURCES = A.SOURCES;

const list = [
  {
    id: 'baseline', label: 'Baseline', short: 'Baseline', kind: 'physiologic', legend: 'normal',
    // The baseline is the reference every other state is drawn against. Only what an excerpt places
    // is stated: blood concentration in its narrow range, a typical day of urine, sodium in its
    // reference range. No excerpt gives a healthy level for ADH, the water channels or urine
    // concentration, so those are 'unstated'.
    adh: 'unstated', aquaporins: 'unstated', urineVolume: 'normal', urineConcentration: 'unstated', blood: 'normal', sodiumMarker: 'normal', water: 'normal',
    why: { blood: ['narrowRange', 'sosm'], urineVolume: ['uvol'], sodiumMarker: ['naTable', 'na', 'hypoWater', 'hyperWater'] },
    summary: 'The healthy starting point: blood concentration inside its narrow range, a typical day of urine, sodium inside its reference range. The sources give no healthy level for ADH, the water channels or urine concentration.',
    callout: ['Everything in balance', 'blood in its narrow range', 'urine: a typical day'],
  },
  {
    id: 'deficit', label: 'Water deficit (dehydration)', short: 'Too little water', kind: 'physiologic', legend: 'dehydrated',
    adh: 'high', aquaporins: 'high', urineVolume: 'low', urineConcentration: 'high', blood: 'high', sodiumMarker: 'up', water: 'lost',
    why: { water: ['dehydration'], blood: ['adhHighOsm'], adh: ['adhRelease', 'adhHighOsm'], aquaporins: ['aquaInsert'], urineVolume: ['lessUrine', 'dilute'], urineConcentration: ['concentrate'], sodiumMarker: ['hyperWater'] },
    summary: 'Water is lost, so the blood grows more concentrated; osmoreceptors fire, ADH rises, more water channels open and the kidney keeps water.',
    callout: ['Blood concentrated ↑', 'ADH ↑ → more water channels', '→ less urine, concentrated'],
  },
  {
    id: 'excess', label: 'Water excess (a lot of water drunk)', short: 'Too much water', kind: 'physiologic', legend: 'extra water',
    adh: 'low', aquaporins: 'low', urineVolume: 'high', urineConcentration: 'low', blood: 'low', sodiumMarker: 'down', water: 'extra',
    why: { water: ['diuresis'], blood: ['aquaRemove'], adh: ['feedback'], aquaporins: ['aquaRemove'], urineVolume: ['diuresis'], urineConcentration: ['dilute'], sodiumMarker: ['hypoWater'] },
    summary: 'Extra water dilutes the blood; ADH secretion falls, water channels are removed and the kidney lets the extra water go as dilute urine.',
    callout: ['Blood more dilute ↓', 'ADH ↓ → fewer water channels', '→ more urine, dilute'],
  },
  {
    id: 'avpd', label: 'AVP deficiency (central diabetes insipidus)', short: 'AVP deficiency', kind: 'disease', legend: 'too little ADH',
    adh: 'low', aquaporins: 'low', urineVolume: 'high', urineConcentration: 'low', blood: 'unstated', sodiumMarker: 'unstated', water: 'normal',
    why: { adh: ['diCause', 'diLittleAdh', 'diNames'], aquaporins: ['diLittleAdh', 'aquaRemove'], urineVolume: ['diDef', 'polyuria'], urineConcentration: ['diDef', 'diUosm'], sodiumMarker: ['diElectrolytes'] },
    summary: 'Too little ADH is made and released, so few water channels open: large volumes of dilute urine. The abstract names electrolyte imbalances but gives no direction for sodium.',
    callout: ['Too little ADH made ↓', '→ few water channels', '→ lots of dilute urine'],
  },
  {
    id: 'avpr', label: 'AVP resistance (nephrogenic diabetes insipidus)', short: 'AVP resistance', kind: 'disease', legend: 'ignored ADH',
    adh: 'ineffective', aquaporins: 'low', urineVolume: 'high', urineConcentration: 'low', blood: 'unstated', sodiumMarker: 'unstated', water: 'normal',
    why: { adh: ['diCause', 'renalUnresponsive', 'diNames'], aquaporins: ['diCause', 'aquaFig'], urineVolume: ['diDef', 'polyuria'], urineConcentration: ['diDef', 'diUosm'], sodiumMarker: ['diElectrolytes'] },
    summary: 'ADH reaches the kidney, but the collecting duct does not respond to it, so few water channels open: large volumes of dilute urine. No direction for sodium is given.',
    callout: ['ADH arrives, no response ✕', '→ few water channels', '→ lots of dilute urine'],
  },
  {
    id: 'siadh', label: 'SIADH (ADH that is not switched off)', short: 'SIADH', kind: 'disease', legend: 'ADH stuck on',
    adh: 'high', aquaporins: 'unstated', urineVolume: 'unstated', urineConcentration: 'unstated', blood: 'unstated', sodiumMarker: 'hypo', water: 'normal',
    why: { adh: ['siadhDef'], sodiumMarker: ['siadhHypo', 'hypoNa'] },
    summary: 'ADH release is not suppressed and water excretion is impaired, leading to hyponatremia. The abstract gives no direction for the water channels, urine volume, urine concentration or blood concentration (osmolality).',
    callout: ['ADH stays on ↑', '→ water excretion impaired', '→ sodium low: hyponatremia'],
  },
  {
    id: 'pp', label: 'Primary polydipsia (drinking too much)', short: 'Primary polydipsia', kind: 'disease', legend: 'over-drinking',
    adh: 'unstated', aquaporins: 'unstated', urineVolume: 'high', urineConcentration: 'low', blood: 'unstated', sodiumMarker: 'hypo', water: 'extra',
    why: { water: ['ppDef'], urineVolume: ['ppDef'], urineConcentration: ['ppDef'], sodiumMarker: ['ppDef', 'hypoNa'] },
    summary: 'Far more fluid is drunk than the body needs: polyuria with diluted urine and, ultimately, hyponatremia. The abstract gives no direction for ADH, the water channels or blood concentration.',
    callout: ['Far too much water in ↑', '→ polyuria, diluted urine', '→ in the end: hyponatremia'],
  },
];

// Every excerpt a state leans on, for the "why" lists and the checks.
for (const s of list) s.sourceIds = [...new Set(Object.values(s.why).flat())];
for (const s of list) for (const id of s.sourceIds) if (!SOURCES[id]) throw new Error(`states.js: ${s.id} cites unknown excerpt ${id}`);
// A field may only move away from normal if an excerpt says so.
for (const s of list) for (const k of ['adh', 'aquaporins', 'urineVolume', 'urineConcentration', 'blood', 'sodiumMarker'])
  if (s[k] !== 'unstated' && !(s.why[k] || []).length) throw new Error(`states.js: ${s.id}.${k} has no excerpt`);

const STATES = Object.freeze(Object.fromEntries(list.map(s => [s.id, s])));
const STATE_ORDER = list.map(s => s.id);

// Words for each field, so colour is never the only cue.
const WORDS = {
  adh: { high: 'high ↑', low: 'low ↓', normal: 'normal', absent: 'none', ineffective: 'present', unstated: 'not stated' },
  aquaporins: { high: 'more ↑', low: 'fewer ↓', normal: 'normal', unstated: 'not stated' },
  urineVolume: { high: 'more ↑', low: 'less ↓', normal: 'normal', unstated: 'not stated' },
  urineConcentration: { high: 'high ↑', low: 'low ↓', normal: 'normal', unstated: 'not stated' },
  blood: { high: 'more concentrated ↑', low: 'more dilute ↓', normal: 'in its range', unstated: 'not stated' },
  sodiumMarker: { normal: 'normal', up: '↑ higher', down: '↓ lower', hypo: '↓ hyponatremia', hyper: '↑ hypernatremia', unstated: 'not stated' },
};
// Longer words for tables and announcements.
const LONG = {
  adh: { high: 'ADH high', low: 'ADH low', normal: 'ADH normal', absent: 'no ADH', ineffective: 'ADH present, kidney does not respond', unstated: 'ADH not stated in the sources' },
  aquaporins: { high: 'more water channels', low: 'fewer water channels', normal: 'water channels normal', unstated: 'water channels not stated in the sources' },
  urineVolume: { high: 'more urine', low: 'less urine', normal: 'urine volume normal', unstated: 'urine volume not stated' },
  urineConcentration: { high: 'more concentrated urine', low: 'more dilute urine', normal: 'urine concentration normal', unstated: 'urine concentration not stated' },
  sodiumMarker: { normal: 'sodium normal', up: 'sodium higher', down: 'sodium lower', hypo: 'sodium below the hyponatremia line', hyper: 'sodium above the hypernatremia line', unstated: 'sodium direction not stated in the sources' },
};

// The answer to a prediction: which way urine volume goes compared with the baseline, the only
// comparison the sources make. Two states in the same category are never graded as equal to each
// other, and a state whose sources give no direction has no graded answer (null).
const VS_BASELINE = { high: 'up', low: 'down', normal: 'same' };
const FLIP = { up: 'down', down: 'up', same: 'same' };
function volumeAnswer(fromId, toId) {
  if (toId !== 'baseline') return VS_BASELINE[STATES[toId].urineVolume] ?? null;
  const d = VS_BASELINE[STATES[fromId].urineVolume];      // back to baseline: the reverse of the state left
  return d ? FLIP[d] : null;
}

Object.assign(A, { STATES, STATE_ORDER, WORDS, LONG, volumeAnswer });
})();
