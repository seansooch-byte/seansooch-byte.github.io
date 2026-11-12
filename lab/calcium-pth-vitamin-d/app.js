// Calcium, PTH and Vitamin D: the lesson runtime.
// One SVG body map is shared by every step: it moves into the step on screen, and a single player
// (restart, step back, play/pause, step forward, speed) moves its timeline. Each step's picture is a
// list of keyframes; the timeline p runs from 0 to the last keyframe, and everything drawn is a pure
// function of (step, p), so stepping back or returning to a step restores it exactly.
// Words and provenance come from data.js (window.LESSON, window.SOURCES); reference numbers come only
// from clinical-values.json.
const L = window.LESSON;
const SRC = window.SOURCES;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const frac = x => x - Math.floor(x);
const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
const narrowQ = matchMedia('(max-width: 600px)');
const reduced = () => reducedQ.matches;
const KEY = 'lab:calcium-pth-vitamin-d:v1';
const BEAT_SEC = 2.4;
const LEAD_MS = 450;
const NS = 'http://www.w3.org/2000/svg';

/* ---------------- Storage (falls back to defaults if missing or corrupt) ---------------- */
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
function loadStore() {
  const d = { predictions: {}, quiz: {}, speed: 1, compare: 'normal' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    if (!isObj(s)) return d;
    const predictions = {};
    if (isObj(s.predictions)) for (const [k, v] of Object.entries(s.predictions)) {
      const st = L.STEPS[k];
      if (!st) continue;
      if (v === 'skip') predictions[k] = 'skip';
      else if (isObj(v) && Number.isInteger(v.pick) && v.pick >= 0 && v.pick < st.predict.options.length) predictions[k] = { pick: v.pick };
    }
    const quiz = {};
    if (isObj(s.quiz)) for (const [k, v] of Object.entries(s.quiz)) {
      const q = L.QUIZ.find(x => x.id === k);
      if (q && Number.isInteger(v) && v >= 0 && v < q.options.length) quiz[k] = v;
    }
    return {
      predictions, quiz,
      speed: [0.5, 1, 2].includes(s.speed) ? s.speed : 1,
      compare: typeof s.compare === 'string' && /^[a-z]+$/.test(s.compare) ? s.compare : 'normal',
    };
  } catch (e) { return d; }
}
const store = loadStore();
const quizScore = () => (cv ? quizQs() : L.QUIZ).filter(q => store.quiz[q.id] === q.answer).length;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...store, quizScore: quizScore(), quizTotal: L.QUIZ.length })); } catch (e) { /* storage full or blocked: keep going */ }
}

/* ---------------- Quotes ---------------- */
// Display only: drop the stray spaces the cached text keeps before punctuation, and set D3 as a subscript.
const pretty = q => esc(q).replace(/ ([,.;:)])/g, '$1').replace(/vitamin D 3,/g, 'vitamin D<sub>3</sub>,');
const srcItems = ids => ids.filter(id => SRC[id]).map(id => {
  const r = SRC[id];
  return `<li data-src="${id}"><blockquote>“${pretty(r.quote)}”</blockquote><p class="cite">${esc(r.section)} · <span class="file">${esc(r.file)}</span></p></li>`;
}).join('');
const srcDetails = (ids, label = 'Source') => `<details class="src"><summary>${esc(label)}${ids.length > 1 && label === 'Source' ? 's' : ''} <span class="n">(${ids.length})</span></summary><ul class="srcs">${srcItems(ids)}</ul></details>`;

/* ---------------- The body map: two layouts ---------------- */
// Paths are cubic Béziers [start, control, control, end]; from/to name the nodes they join.
const FLOW = {
  pthBlood: { kind: 'pth', from: 'pt', to: 'blood', label: 'PTH into blood' },
  pthBone: { kind: 'pth', from: 'pt', to: 'bone', label: 'PTH → bone' },
  pthKidney: { kind: 'pth', from: 'pt', to: 'kidney', label: 'PTH → kidney' },
  caBone: { kind: 'ca', from: 'bone', to: 'blood', label: 'Ca²⁺ from bone' },
  phBone: { kind: 'ph', from: 'bone', to: 'blood', label: 'phosphate' },
  caKidney: { kind: 'ca', from: 'kidney', to: 'blood', label: 'Ca²⁺ reabsorbed' },
  caUrine: { kind: 'ca', from: 'kidney', to: 'urine', label: 'Ca²⁺ in urine' },
  phUrine: { kind: 'ph', from: 'kidney', to: 'urine', label: 'phosphate in urine' },
  calcitriol: { kind: 'ctr', from: 'kidney', to: 'gut', label: 'calcitriol → gut' },
  caGut: { kind: 'ca', from: 'gut', to: 'blood', label: 'Ca²⁺ absorbed' },
  diet: { kind: 'ca', from: 'food', to: 'gut', label: 'calcium in food' },
  feedback: { kind: 'fb', from: 'blood', to: 'pt', label: ['rising Ca²⁺', 'inhibits PTH'] },
  ctBone: { kind: 'ct', from: 'cc', to: 'bone' },
  ctKidney: { kind: 'ct', from: 'cc', to: 'kidney' },
  ctGut: { kind: 'ct', from: 'cc', to: 'gut', label: 'calcitonin' },
};

const LAYOUTS = {
  wide: {
    W: 780, H: 690,
    lobes: [[338, 98, 44, 58], [442, 98, 44, 58]], isth: [368, 100, 44, 30],
    pt: [[320, 58], [320, 140], [460, 58], [460, 140]], ptR: [14, 10], cc: [390, 116],
    vessel: [30, 214, 720, 104, 50], gauge: [706, 226, 22, 81], gaugeLabelX: 698, gaugeTitle: [717, 340],
    dots: [64, 600, 256, 306], albumin: [[150, 286], [290, 266], [430, 292], [560, 270]],
    bone: [130, 470, 150, 46], kidney: [390, 470, 1], gut: [650, 470, 150, 88],
    text: [['thyroid (seen from behind)', 390, 24, 'middle'], ['parathyroid glands', 298, 104, 'end'], ['blood (calcium pool)', 70, 242, 'start', 'b'],
      ['bone', 130, 476, 'middle', 'b'], ['kidney', 390, 476, 'middle', 'b'], ['small intestine (gut)', 650, 545, 'middle', 'b']],
    ccLabel: ['C cells', 390, 182, 'middle'],
    paths: {
      pthBlood: [[318, 150], [308, 172], [294, 194], [288, 214]],
      pthBone: [[306, 146], [250, 230], [170, 340], [146, 440]],
      pthKidney: [[336, 154], [346, 250], [358, 340], [366, 420]],
      caBone: [[174, 448], [186, 400], [196, 356], [200, 320]],
      phBone: [[110, 448], [114, 400], [120, 356], [122, 320]],
      caKidney: [[410, 420], [413, 385], [416, 350], [418, 320]],
      caUrine: [[378, 522], [378, 545], [378, 565], [378, 594]],
      phUrine: [[402, 522], [402, 545], [402, 565], [402, 594]],
      calcitriol: [[432, 490], [472, 540], [540, 540], [578, 505]],
      caGut: [[630, 426], [626, 388], [616, 352], [612, 320]],
      diet: [[774, 394], [752, 410], [730, 426], [714, 438]],
      feedback: [[500, 214], [516, 190], [502, 160], [476, 148]],
      ctBone: [[376, 126], [300, 220], [200, 330], [156, 440]],
      ctKidney: [[392, 134], [394, 250], [396, 340], [398, 420]],
      ctGut: [[408, 126], [520, 190], [630, 320], [646, 424]],
    },
    labels: {
      pthBlood: [282, 190, 'end'], pthBone: [150, 346, 'middle'], pthKidney: [352, 406, 'end'],
      caBone: [210, 374, 'start'], phBone: [104, 384, 'end'], caKidney: [428, 374, 'start'],
      caUrine: [368, 586, 'end'], phUrine: [412, 586, 'start'], calcitriol: [506, 558, 'middle'],
      caGut: [602, 400, 'end'], diet: [774, 386, 'end'], feedback: [516, 178, 'start'], ctGut: [522, 346, 'start'],
    },
    co: { top: [640, 44], blood: [470, 250], bone: [130, 620], kidney: [390, 620], gut: [650, 620] }, coDy: 28,
  },
  narrow: {
    W: 400, H: 680,
    lobes: [[170, 92, 32, 46], [230, 92, 32, 46]], isth: [190, 96, 20, 24],
    pt: [[156, 60], [156, 124], [244, 60], [244, 124]], ptR: [11, 8], cc: [200, 108],
    vessel: [8, 176, 384, 92, 44], gauge: [360, 186, 20, 72], gaugeLabelX: 352, gaugeTitle: null,
    dots: [24, 290, 208, 258], albumin: [[70, 238], [150, 222], [230, 240]],
    bone: [66, 440, 112, 40], kidney: [200, 440, 0.8], gut: [334, 440, 112, 76],
    text: [['thyroid (seen from behind)', 200, 20, 'middle'], ['parathyroid', 84, 88, 'middle'], ['glands', 84, 106, 'middle'], ['blood (calcium pool)', 26, 198, 'start', 'b'],
      ['bone', 66, 446, 'middle', 'b'], ['kidney', 200, 446, 'middle', 'b'], ['gut', 334, 446, 'middle', 'b']],
    ccLabel: ['C cells', 200, 162, 'middle'],
    paths: {
      pthBlood: [[152, 134], [142, 150], [134, 162], [130, 176]],
      pthBone: [[148, 132], [110, 220], [80, 330], [70, 418]],
      pthKidney: [[166, 138], [176, 240], [186, 330], [192, 400]],
      caBone: [[94, 420], [100, 380], [106, 320], [108, 268]],
      phBone: [[42, 420], [45, 380], [48, 320], [50, 268]],
      caKidney: [[212, 402], [214, 360], [216, 310], [218, 268]],
      caUrine: [[192, 482], [192, 505], [192, 525], [192, 546]],
      phUrine: [[208, 482], [208, 505], [208, 525], [208, 546]],
      calcitriol: [[228, 462], [248, 500], [282, 505], [294, 476]],
      caGut: [[328, 402], [326, 360], [322, 310], [318, 268]],
      diet: [[398, 506], [394, 496], [388, 488], [382, 478]],
      feedback: [[262, 176], [274, 156], [266, 140], [254, 130]],
      ctBone: [[190, 114], [140, 200], [90, 320], [72, 418]],
      ctKidney: [[200, 120], [202, 220], [202, 320], [202, 400]],
      ctGut: [[210, 114], [270, 190], [318, 320], [332, 402]],
    },
    labels: {
      pthBlood: [120, 160, 'end'], pthBone: [12, 294, 'start'], ctGut: [300, 294, 'start'],
      caBone: [116, 322, 'start'], caGut: [396, 322, 'end'], phBone: [6, 378, 'start'], pthKidney: [182, 350, 'end'],
      caKidney: [224, 378, 'start'], calcitriol: [262, 532, 'middle'], diet: [398, 524, 'end'],
      caUrine: [184, 566, 'end'], phUrine: [216, 566, 'start'], feedback: [276, 148, 'start'],
    },
    labelText: { diet: 'food' },
    co: { top: [338, 52], blood: [222, 218], bone: [70, 602], kidney: [200, 602], gut: [334, 602] }, coDy: 28,
  },
};

const bez = (P, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
};
const dOf = P => `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`;
const f1 = x => Math.round(x * 10) / 10;
const seed = i => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const textW = (t, fs) => [...t].length * fs * 0.6;
// A fixed, per-question display order for answer choices (the data lists the answer first).
function orderOf(key, n) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

/* ---------------- Keyframes ---------------- */
const C = (col, wide, narrow, dir = 'up') => ({ col, t: [wide, narrow || wide], dir });
const NORMAL_F = { pthBlood: 1, pthBone: 1, pthKidney: 1, caBone: 1, phBone: 1, caKidney: 1, caUrine: 0.6, phUrine: 1, calcitriol: 1, caGut: 1, diet: 1 };
const NORMAL_K = { lv: 0, f: NORMAL_F, ph: 1, beat: 'Normal', d: 'The normal picture: PTH flows from the parathyroid glands to bone and kidney, the kidney sends calcitriol to the gut, and calcium enters the blood from bone, kidney and gut; blood calcium sits in the normal zone.' };

const SCENES = {
  blood: { K: [
    { lv: 0, alb: 1, beat: 'The blood calcium pool', d: 'The blood calcium pool sits in the middle of the map; its gauge reads normal. Teal dots are calcium.' },
    { lv: 0, alb: 1, lit: ['blood'], co: [C('blood', 'bound to albumin', 'on albumin', 'info'), C('blood', 'free: ionized Ca²⁺', 'ionized Ca²⁺', 'info')], beat: 'Bound and free', d: 'Some calcium dots ride on grey albumin ovals; the others float free as ionized calcium.' },
    { lv: 0, alb: 1, lit: ['gauge'], co: [C('blood', 'bound to albumin', 'on albumin', 'info'), C('blood', 'free: ionized Ca²⁺', 'ionized Ca²⁺', 'info'), C('blood', 'total = all three forms', 'total = all forms', 'info')], beat: 'Total calcium counts every form', d: 'The gauge reads total calcium: the albumin-bound, the free (ionized) and the small complexed share together.' },
  ] },
  sense: { K: [
    { lv: 0, beat: 'Calcium normal', d: 'Blood calcium sits in the normal zone of the gauge.' },
    { lv: -1, lit: ['gauge'], co: [C('blood', 'calcium ↓', 'calcium ↓', 'down')], beat: 'Calcium falls', d: 'Blood calcium falls into the low zone.' },
    { lv: -1, f: { pthBlood: 1.6 }, lit: ['pt'], co: [C('blood', 'calcium ↓', 'calcium ↓', 'down'), C('top', 'PTH ↑', 'PTH ↑')], beat: 'The glands release PTH', d: 'The parathyroid glands light up and amber PTH hexagons flow into the blood.' },
  ] },
  bone: { K: [
    { lv: -1, f: { pthBlood: 1.4 }, beat: 'Calcium low, PTH in the blood', d: 'Calcium is low and PTH is in the blood.' },
    { lv: -1, f: { pthBlood: 1.4, pthBone: 1.6 }, co: [C('top', 'PTH ↑', 'PTH ↑')], beat: 'PTH reaches bone', d: 'PTH hexagons travel from the parathyroid glands to bone.' },
    { lv: -1, f: { pthBlood: 1.4, pthBone: 1.6, caBone: 1.8 }, lit: ['bone'], co: [C('top', 'PTH ↑', 'PTH ↑'), C('bone', 'osteoclasts ↑', 'osteoclasts ↑'), C('bone', 'Ca²⁺ out of bone ↑', 'Ca²⁺ out ↑')], beat: 'Osteoclasts release calcium', d: 'Osteoclasts break bone down and teal calcium dots move from bone into the blood.' },
    { lv: -1, f: { pthBlood: 1.4, pthBone: 1.6, caBone: 1.8 }, lit: ['bone'], co: [C('top', 'PTH ↑', 'PTH ↑'), C('bone', 'osteoclasts ↑', 'osteoclasts ↑'), C('bone', 'Ca²⁺ out of bone ↑', 'Ca²⁺ out ↑'), C('bone', 'osteoblasts ↓', 'osteoblasts ↓', 'down')], beat: 'Osteoblasts held back', d: 'Bone-building osteoblasts are held back, sparing blood calcium.' },
  ] },
  kidney: { K: [
    { lv: -1, f: { pthBlood: 1.4, caUrine: 1.2 }, beat: 'Calcium low', d: 'Some calcium leaves the kidney in urine.' },
    { lv: -1, f: { pthBlood: 1.4, pthKidney: 1.6, caUrine: 1.2 }, co: [C('top', 'PTH ↑', 'PTH ↑')], beat: 'PTH reaches the kidney', d: 'PTH hexagons travel from the parathyroid glands to the kidney.' },
    { lv: -1, f: { pthBlood: 1.4, pthKidney: 1.6, caKidney: 1.8, caUrine: 0.3 }, lit: ['kidney'], co: [C('top', 'PTH ↑', 'PTH ↑'), C('kidney', 'Ca²⁺ reabsorbed ↑', 'reabsorbed ↑'), C('kidney', 'Ca²⁺ in urine ↓', 'urine Ca²⁺ ↓', 'down')], beat: 'More taken back, less lost', d: 'Calcium dots move from the kidney back into the blood, and fewer leave in urine.' },
  ] },
  activate: { K: [
    { lv: -1, f: { pthBlood: 1.4, diet: 1, caGut: 0.5 }, beat: 'Calcium low', d: 'Calcium from food enters the gut, and a little is absorbed into the blood.' },
    { lv: -1, f: { pthBlood: 1.4, pthKidney: 1.6, diet: 1, caGut: 0.5 }, co: [C('top', 'PTH ↑', 'PTH ↑')], beat: 'PTH reaches the kidney', d: 'PTH hexagons travel from the parathyroid glands to the kidney.' },
    { lv: -1, f: { pthBlood: 1.4, pthKidney: 1.6, diet: 1, caGut: 0.5, calcitriol: 1.8 }, lit: ['kidney'], co: [C('top', 'PTH ↑', 'PTH ↑'), C('kidney', 'calcitriol made ↑', 'calcitriol ↑')], beat: 'The kidney makes calcitriol', d: 'Violet calcitriol triangles leave the kidney and travel to the gut.' },
    { lv: -1, f: { pthBlood: 1.4, pthKidney: 1.6, diet: 1, calcitriol: 1.8, caGut: 1.8 }, lit: ['gut'], co: [C('top', 'PTH ↑', 'PTH ↑'), C('kidney', 'calcitriol made ↑', 'calcitriol ↑'), C('gut', 'Ca²⁺ absorbed ↑', 'absorbed ↑')], beat: 'The gut absorbs more calcium', d: 'Calcitriol reaches the gut, and teal calcium dots move from the gut into the blood.' },
  ] },
  feedback: { K: [
    { lv: -1, f: { pthBlood: 1.6, pthBone: 1.4, pthKidney: 1.4, caBone: 1.4, caKidney: 1.4, calcitriol: 1.4, caGut: 1.4, diet: 1 }, co: [C('top', 'PTH ↑', 'PTH ↑')], beat: 'Calcium low, PTH at work', d: 'PTH acts on bone and kidney, and calcitriol on the gut; calcium flows into the blood.' },
    { lv: 0, f: { pthBlood: 0.35, pthBone: 0.35, pthKidney: 0.35, caBone: 0.6, caKidney: 1, calcitriol: 0.8, caGut: 1, diet: 1, feedback: 1 }, lit: ['pt'], co: [C('blood', 'calcium ↑', 'calcium ↑'), C('top', 'PTH ↓', 'PTH ↓', 'down')], beat: 'Rising calcium turns PTH down', d: 'Calcium rises back to normal; a dashed feedback arrow runs from the blood to the parathyroid glands, and PTH slows to a trickle.' },
    { lv: 1, f: { pthBlood: 0.15, feedback: 1, diet: 1, caGut: 1, caKidney: 1 }, cc: 1, lit: ['cc'], co: [C('blood', 'calcium high', 'calcium high'), C('top', 'calcitonin ↑', 'calcitonin ↑')], beat: 'If calcium runs high: calcitonin', d: 'Calcium runs into the high zone; the thyroid C cells light up and release calcitonin.' },
    { lv: 1, f: { pthBlood: 0.15, feedback: 1, ctBone: 1.5, ctKidney: 1.5, ctGut: 1.5, caBone: 0.3, caGut: 0.4, caKidney: 0.4, caUrine: 1.8, diet: 1 }, cc: 1, co: [C('top', 'calcitonin ↑', 'calcitonin ↑'), C('bone', 'osteoclasts ↓', 'osteoclasts ↓', 'down'), C('kidney', 'Ca²⁺ in urine ↑', 'urine Ca²⁺ ↑'), C('gut', 'absorption ↓', 'absorption ↓', 'down')], beat: 'Calcitonin acts on bone, kidney and gut', d: 'Blue calcitonin squares reach bone, kidney and gut: osteoclasts slow, the gut absorbs less, and more calcium leaves in urine.' },
    { lv: 0, f: { pthBlood: 0.3, feedback: 1, ctBone: 0.5, ctKidney: 0.5, ctGut: 0.5, caBone: 0.6, caGut: 0.8, caKidney: 0.8, caUrine: 1, diet: 1 }, cc: 1, co: [C('blood', 'calcium back to normal', 'calcium normal', 'info')], beat: 'Calcium back to normal', d: 'Calcium falls back into the normal zone.' },
  ] },
  phosphate: { K: [
    { lv: -1, f: { pthBlood: 1.4 }, ph: 1, beat: 'Calcium low, PTH in the blood', d: 'Grey phosphate rings float in the blood with the calcium.' },
    { lv: -1, f: { pthBlood: 1.4, pthBone: 1.6, caBone: 1.6, phBone: 1.6 }, ph: 1.6, lit: ['bone'], co: [C('bone', 'Ca²⁺ + phosphate out ↑', 'Ca²⁺, phosphate ↑')], beat: 'Bone releases both', d: 'PTH breaks bone down; calcium dots and phosphate rings both move into the blood.' },
    { lv: -1, f: { pthBlood: 1.4, pthBone: 1.6, caBone: 1.6, phBone: 1.6, pthKidney: 1.6, caKidney: 1.8, caUrine: 0.3, phUrine: 1.8 }, ph: 1.2, lit: ['kidney'], co: [C('bone', 'Ca²⁺ + phosphate out ↑', 'Ca²⁺, phosphate ↑'), C('kidney', 'Ca²⁺ kept ↑', 'Ca²⁺ kept ↑'), C('kidney', 'phosphate in urine ↑', 'phosphate out ↑')], beat: 'Kidney: keep calcium, lose phosphate', d: 'At the kidney, calcium returns to the blood while phosphate rings leave in urine.' },
  ] },
};

// States come from clinical-values.json (see loadCV); until it loads (or if it cannot), only Normal exists.
L.STATES = [{ id: 'normal', label: 'Normal', short: 'Normal', summary: 'The teaching baseline.', shifts: {} }];
const stateOf = id => L.STATES.find(s => s.id === id);
const fromCV = st => ({ id: st.id, label: st.label, short: st.short || st.label, summary: st.summary,
  shifts: Object.fromEntries(Object.entries(st.directions || {}).map(([k, d]) => [k, { dir: d.dir, word: d.word, note: d.note, q: d.quotes || [] }])) });
const ARROW = { up: '↑', down: '↓' };
const ORDER = ['calcium', 'pth', 'phosphate', 'calcitriol', 'vitd25', 'boneRelease', 'boneStore', 'kidneyCa', 'gutCa', 'kidneyFn'];
const NAMED = Object.fromEntries([...L.QUANTITIES, ...L.PROCESSES].map(x => [x.id, x.label]));
const shiftList = st => ORDER.filter(k => st.shifts[k]).map(k => ({ id: k, ...st.shifts[k] }));
const notStated = st => ['calcium', 'pth', 'calcitriol', 'phosphate'].filter(k => !st.shifts[k]).map(k => k === 'calcitriol' ? 'calcitriol' : k === 'pth' ? 'PTH' : k);
// "Hypoparathyroidism: calcium down, PTH down, phosphorus up, calcitriol down"
function announceState(id) {
  const st = stateOf(id);
  if (id === 'normal' || !st) return 'Normal: the baseline every state is compared with.';
  return `${st.label}: ${shiftList(st).map(s => `${s.word} ${s.dir}`).join(', ')}.`;
}

function stateFrame(id) {
  const st = stateOf(id);
  if (!st || id === 'normal') return { ...NORMAL_K };
  const s = st.shifts, f = { ...NORMAL_F }, mute = [], co = [], lit = [], dim = [];
  const R = d => (d === 'up' ? 2.1 : 0.3);
  const flows = (keys, sh) => { if (sh) keys.forEach(k => { f[k] = R(sh.dir); }); else mute.push(...keys); };
  let lv = 0, ph = 0;
  if (s.calcium) { lv = s.calcium.dir === 'up' ? 1 : -1; lit.push('gauge'); co.push(C('blood', `calcium ${ARROW[s.calcium.dir]}`, `calcium ${ARROW[s.calcium.dir]}`, s.calcium.dir)); }
  flows(['pthBlood', 'pthBone', 'pthKidney'], s.pth);
  if (s.pth) { lit.push('pt'); co.push(C('top', `PTH ${ARROW[s.pth.dir]}`, `PTH ${ARROW[s.pth.dir]}`, s.pth.dir)); }
  flows(['calcitriol'], s.calcitriol);
  if (s.calcitriol) co.push(C('kidney', `calcitriol ${ARROW[s.calcitriol.dir]}`, `calcitriol ${ARROW[s.calcitriol.dir]}`, s.calcitriol.dir));
  if (s.phosphate) { ph = s.phosphate.dir === 'up' ? 2.2 : 0.4; co.push(C('blood', `${s.phosphate.word} ${ARROW[s.phosphate.dir]}`, `${s.phosphate.word} ${ARROW[s.phosphate.dir]}`, s.phosphate.dir)); }
  mute.push('phBone', 'phUrine', 'diet');
  flows(['caBone'], s.boneRelease);
  if (s.boneRelease) co.push(C('bone', `Ca²⁺ out of bone ${ARROW[s.boneRelease.dir]}`, `Ca²⁺ out ${ARROW[s.boneRelease.dir]}`, s.boneRelease.dir));
  if (s.boneStore) co.push(C('bone', `Ca²⁺ stores ${ARROW[s.boneStore.dir]}`, `Ca²⁺ stores ${ARROW[s.boneStore.dir]}`, s.boneStore.dir));
  flows(['caKidney'], s.kidneyCa);
  if (s.kidneyCa) co.push(C('kidney', `Ca²⁺ reabsorbed ${ARROW[s.kidneyCa.dir]}`, `reabsorbed ${ARROW[s.kidneyCa.dir]}`, s.kidneyCa.dir));
  mute.push('caUrine');
  if (s.kidneyFn) { dim.push('kidney'); co.push(C('kidney', `kidney function ${ARROW[s.kidneyFn.dir]}`, `function ${ARROW[s.kidneyFn.dir]}`, s.kidneyFn.dir)); }
  flows(['caGut'], s.gutCa);
  if (s.gutCa) co.push(C('gut', `Ca²⁺ absorbed ${ARROW[s.gutCa.dir]}`, `absorbed ${ARROW[s.gutCa.dir]}`, s.gutCa.dir));
  if (s.vitd25) co.push(C('gut', '25-OH D: deficiency zone', '25-OH D ↓', 'down'));
  const ns = notStated(st);
  return { lv, f, ph, mute, co, lit, dim, ghost: true, beat: st.label,
    d: `${announceState(id)} Faint grey bands show the normal picture underneath${ns.length ? `; dotted grey arrows are not stated in these sources (${ns.join(', ')})` : ''}.` };
}
const stateScenes = {};
function stateScene(id) {
  if (!stateScenes[id]) {
    stateScenes[id] = id === 'normal'
      ? { K: [{ ...NORMAL_K }, { ...NORMAL_K }], state: id }
      : { K: [{ ...NORMAL_K, ghost: true, beat: 'Normal', d: 'The normal picture, before the change.' }, stateFrame(id)], beatSec: 3, state: id };
  }
  return stateScenes[id];
}

const ease = u => u * u * (3 - 2 * u);
function frameAt(scene, p) {
  const K = scene.K, m = K.length - 1;
  p = clamp(p, 0, m);
  const i = m === 0 ? 0 : Math.min(m - 1, Math.floor(p));
  const A = K[i], B = K[Math.min(m, i + 1)], e = m === 0 ? 0 : ease(p - i);
  const lerp = (a, b) => a + (b - a) * e;
  const f = {};
  for (const k of new Set([...Object.keys(A.f || {}), ...Object.keys(B.f || {})])) f[k] = lerp((A.f || {})[k] || 0, (B.f || {})[k] || 0);
  const j = Math.min(m, Math.floor(p + 0.5)), D = K[j];
  return {
    lv: lerp(A.lv || 0, B.lv || 0), f, ph: lerp(A.ph || 0, B.ph || 0), alb: lerp(A.alb || 0, B.alb || 0), cc: lerp(A.cc || 0, B.cc || 0),
    mute: new Set(D.mute || []), co: D.co || [], lit: D.lit || [], dim: D.dim || [], ghost: !!(A.ghost || B.ghost),
    j, m, beat: D.beat, d: D.d, clock: p * (scene.beatSec || BEAT_SEC),
  };
}

/* ---------------- Drawing ---------------- */
const BEAN = 'M-5,-50 C40,-58 48,50 -5,50 C-38,50 -40,18 -18,8 C-8,3 -8,-3 -18,-8 C-40,-18 -38,-50 -5,-50 Z';
const KINDS = ['ca', 'pth', 'ctr', 'ph', 'ct', 'fb', 'mute'];
const markers = pre => `<defs>${KINDS.map(k => `<marker id="${pre}ah-${k}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path class="ah ah-${k}" d="M0,0 L10,5 L0,10 z"/></marker>`).join('')}</defs>`;
const T = (t, x, y, anchor = 'start', cls = '') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;

function nodesSVG(lay, fr) {
  const lit = new Set(fr.lit), dim = new Set(fr.dim);
  const cls = n => `node n-${n}${lit.has(n) ? ' lit' : ''}${dim.has(n) ? ' dim' : ''}`;
  let s = `<g class="node n-thyroid">${lay.lobes.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('')}<rect x="${lay.isth[0]}" y="${lay.isth[1]}" width="${lay.isth[2]}" height="${lay.isth[3]}" rx="8"/></g>`;
  s += `<g class="${cls('pt')}" data-node="pt">${lay.pt.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${lay.ptR[0]}" ry="${lay.ptR[1]}"/>`).join('')}</g>`;
  if (fr.cc > 0.01) {
    const [cx, cy] = lay.cc;
    s += `<g class="${cls('cc')}" data-node="cc" opacity="${f1(fr.cc)}">${[[-10, -4], [0, -7], [10, -4], [-5, 5], [6, 5]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="3.4"/>`).join('')}</g>`;
    s += `<g opacity="${f1(fr.cc)}">${T(lay.ccLabel[0], lay.ccLabel[1], lay.ccLabel[2], lay.ccLabel[3], 'lbl lbl-ct')}</g>`;
  }
  const [vx, vy, vw, vh, vr] = lay.vessel;
  s += `<g class="${cls('blood')}" data-node="blood"><rect class="vessel" x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="${vr}"/></g>`;
  const [gx, gy, gw, gh] = lay.gauge, z = gh / 3;
  s += `<g class="${cls('gauge')}" data-node="gauge"><rect class="z-hi" x="${gx}" y="${gy}" width="${gw}" height="${z}"/><rect class="z-no" x="${gx}" y="${gy + z}" width="${gw}" height="${z}"/><rect class="z-lo" x="${gx}" y="${gy + 2 * z}" width="${gw}" height="${z}"/><rect class="g-frame" x="${gx}" y="${gy}" width="${gw}" height="${gh}"/></g>`;
  s += T('high', lay.gaugeLabelX, f1(gy + z * 0.5 + 5), 'end', 'lbl sm') + T('normal', lay.gaugeLabelX, f1(gy + z * 1.5 + 5), 'end', 'lbl sm') + T('low', lay.gaugeLabelX, f1(gy + z * 2.5 + 5), 'end', 'lbl sm');
  if (lay.gaugeTitle) s += T('calcium level', lay.gaugeTitle[0], lay.gaugeTitle[1], 'middle', 'lbl sm');
  // bone: stroked silhouette under a fill, so the knobs and shaft read as one outline
  const [bx, by, bw, bh] = lay.bone, kr = bh * 0.36, t = bh * 0.2, x1 = bx - bw / 2 + kr, x2 = bx + bw / 2 - kr;
  const boneParts = `<rect x="${x1}" y="${by - t}" width="${x2 - x1}" height="${2 * t}"/>${[[x1, -1], [x1, 1], [x2, -1], [x2, 1]].map(([x, sg]) => `<circle cx="${x}" cy="${f1(by + sg * kr * 0.72)}" r="${f1(kr)}"/>`).join('')}`;
  s += `<g class="${cls('bone')}" data-node="bone"><g class="sil">${boneParts}</g><g class="fil">${boneParts}</g></g>`;
  const [kx, ky, ks] = lay.kidney;
  s += `<g class="${cls('kidney')}" data-node="kidney"><path class="bean" transform="translate(${kx} ${ky}) scale(${ks})" vector-effect="non-scaling-stroke" d="${BEAN}"/></g>`;
  const [ux, uy, uw, uh] = lay.gut, gx0 = ux - uw / 2, gx1 = ux + uw / 2;
  s += `<g class="${cls('gut')}" data-node="gut"><rect class="gut" x="${gx0}" y="${uy - uh / 2}" width="${uw}" height="${uh}" rx="${f1(uh * 0.34)}"/>${[-0.24, 0, 0.24].map(k => `<path class="coil" d="M${gx0 + 14},${f1(uy + k * uh)} C${f1(gx0 + uw * 0.3)},${f1(uy + k * uh - 12)} ${f1(gx0 + uw * 0.6)},${f1(uy + k * uh + 12)} ${gx1 - 14},${f1(uy + k * uh)}"/>`).join('')}</g>`;
  for (const [txt, x, y, a, b] of lay.text) s += T(txt, x, y, a, `lbl${b ? ' b' : ''}`);
  return s;
}

function flowsSVG(lay, fr, pre = '') {
  let ghost = '', body = '';
  for (const [k, meta] of Object.entries(FLOW)) {
    const P = lay.paths[k];
    if (!P) continue;
    const r = fr.f[k] || 0, muted = fr.mute.has(k);
    if (fr.ghost && NORMAL_F[k]) ghost += `<path class="ghost-flow" data-ghost="normal" d="${dOf(P)}" stroke-width="${f1(1.5 + 2.2 * NORMAL_F[k] + 7)}"/>`;
    if (!muted && r < 0.03) continue;
    const op = muted ? 1 : Math.min(1, r * 1.6), w = muted ? 2 : 1.5 + 2.2 * Math.min(r, 2.2);
    const kind = muted ? 'mute' : meta.kind;
    body += `<path class="flow f-${kind}${meta.kind === 'fb' ? ' f-dash' : ''}" data-flow="${k}" data-from="${meta.from}" data-to="${meta.to}"${fr.ghost && !muted ? ' data-state="changed"' : ''}${muted ? ' data-muted="not stated"' : ''} d="${dOf(P)}" stroke-width="${f1(w)}" opacity="${f1(op)}" marker-end="url(#${pre}ah-${kind})"/>`;
    const lab = (lay.labelText && lay.labelText[k]) || meta.label, at = lay.labels[k];
    if (lab && at) {
      const lines = Array.isArray(lab) ? lab : [lab];
      // a thinning arrow keeps a readable label; only a flow that is fading in or out fades its words
      const lop = muted || r >= 0.25 ? 1 : op;
      body += `<text class="lbl fl fl-${kind}" x="${at[0]}" y="${at[1]}" text-anchor="${at[2]}" opacity="${f1(lop)}">${lines.map((l, n) => `<tspan x="${at[0]}" dy="${n ? 18 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    }
  }
  if (fr.ghost) {
    const [gx, gy, gw, gh] = lay.gauge;
    ghost += `<line class="ghost-mark" data-ghost="normal" x1="${gx - 6}" x2="${gx + gw + 6}" y1="${f1(gy + gh / 2)}" y2="${f1(gy + gh / 2)}"/>`;
  }
  return `<g class="ghost">${ghost}</g>${body}`;
}

function shape(kind, x, y, a) {
  const o = `opacity="${a.toFixed(2)}"`;
  if (kind === 'ca') return `<circle class="t-ca" cx="${f1(x)}" cy="${f1(y)}" r="5.5" ${o}/>`;
  if (kind === 'ph') return `<circle class="t-ph" cx="${f1(x)}" cy="${f1(y)}" r="4.6" ${o}/>`;
  if (kind === 'ct') return `<rect class="t-ct" x="${f1(x - 5)}" y="${f1(y - 5)}" width="10" height="10" ${o}/>`;
  if (kind === 'ctr') return `<path class="t-ctr" d="M${f1(x)},${f1(y - 8)} L${f1(x + 7.5)},${f1(y + 5.5)} L${f1(x - 7.5)},${f1(y + 5.5)} Z" ${o}/>`;
  const pts = [0, 1, 2, 3, 4, 5].map(i => { const t = Math.PI / 3 * i + Math.PI / 6; return `${f1(x + 7.5 * Math.cos(t))},${f1(y + 7.5 * Math.sin(t))}`; }).join(' ');
  return `<polygon class="t-pth" points="${pts}" ${o}/>`;
}

function tokensSVG(lay, fr) {
  let s = '';
  Object.entries(FLOW).forEach(([k, meta], idx) => {
    const r = fr.f[k] || 0, P = lay.paths[k];
    if (!P || r < 0.05 || fr.mute.has(k) || meta.kind === 'fb') return;
    const n = clamp(Math.round(1 + 2.2 * r), 1, 6), op = Math.min(1, r * 1.6);
    for (let j = 0; j < n; j++) {
      const u = frac(fr.clock * 0.42 + j / n + idx * 0.137);
      const [x, y] = bez(P, u);
      s += shape(meta.kind, x, y, op * Math.min(1, u * 7, (1 - u) * 7));
    }
  });
  return s;
}

function bloodSVG(lay, fr) {
  const [x0, x1, y0, y1] = lay.dots, span = x1 - x0;
  let s = '';
  if (fr.alb > 0.01) {
    for (const [ax, ay] of lay.albumin) s += `<g opacity="${f1(fr.alb)}"><ellipse class="albumin" cx="${ax}" cy="${ay}" rx="15" ry="9"/>${shape('ca', ax + 12, ay - 7, 1)}</g>`;
  }
  const want = 9 + 6 * fr.lv;
  for (let i = 0; i < 15; i++) {
    const a = clamp(want - i, 0, 1);
    if (a <= 0) continue;
    const x = x0 + frac(seed(i) + fr.clock * (0.012 + seed(i + 40) * 0.02)) * span;
    const y = y0 + seed(i + 80) * (y1 - y0) + Math.sin(fr.clock * 1.4 + i) * 3;
    s += shape('ca', x, y, a);
  }
  const ph = 5 * fr.ph;
  for (let i = 0; i < 11; i++) {
    const a = clamp(ph - i, 0, 1);
    if (a <= 0) continue;
    const x = x0 + frac(seed(i + 200) + fr.clock * (0.01 + seed(i + 240) * 0.016)) * span;
    const y = y0 + seed(i + 280) * (y1 - y0) + Math.cos(fr.clock * 1.2 + i) * 3;
    s += shape('ph', x, y, a);
  }
  const [gx, gy, gw, gh] = lay.gauge, z = gh / 3, ly = gy + 1.5 * z - clamp(fr.lv, -1, 1) * z;
  s += `<rect class="g-fill" x="${gx + 3}" y="${f1(ly)}" width="${gw - 6}" height="${f1(gy + gh - ly)}"/>`;
  s += `<line class="g-mark" x1="${gx - 2}" x2="${gx + gw + 2}" y1="${f1(ly)}" y2="${f1(ly)}"/><path class="g-tri" d="M${gx + gw + 3},${f1(ly)} l9,-7 v14 z"/>`;
  return s;
}

// prev: the callouts already on screen; only the newly named changes pop in.
function calloutsSVG(lay, fr, narrow, prev = new Set()) {
  const rows = {};
  let s = '';
  for (const c of fr.co) {
    const i = (rows[c.col] = (rows[c.col] ?? -1) + 1);
    const [bx, by] = lay.co[c.col], y = by + i * lay.coDy;
    const text = c.t[narrow ? 1 : 0], w = textW(text, 15) + 16, x = clamp(bx - w / 2, 3, lay.W - w - 3);
    s += `<g class="co co-${c.dir}${prev.has(c.t[0]) ? '' : ' co-new'}" data-change="${esc(text)}"><rect x="${f1(x)}" y="${y - 12}" width="${f1(w)}" height="24" rx="12"/><text x="${f1(x + w / 2)}" y="${y + 5}" text-anchor="middle">${esc(text)}</text></g>`;
  }
  return s;
}

// A complete still picture (the summary's key diagram).
const TEXT_RE = /<text[\s\S]*?<\/text>/g;
function staticSVG(lay, fr, label) {
  const flows = flowsSVG(lay, fr, 's-');
  return `<svg class="pic" viewBox="0 0 ${lay.W} ${lay.H}" role="img" aria-label="${esc(label)}" xmlns="${NS}">${markers('s-')}<g>${flows.replace(TEXT_RE, '')}</g><g>${nodesSVG(lay, fr)}</g><g>${(flows.match(TEXT_RE) || []).join('')}</g><g>${bloodSVG(lay, fr)}</g><g>${tokensSVG(lay, fr)}</g></svg>`;
}

/* ---------------- The live figure ---------------- */
const svg = $('#pic');
const fig = { lay: null, narrow: false, sig: {}, g: {} };
function setLayout() {
  fig.narrow = narrowQ.matches;
  fig.lay = fig.narrow ? LAYOUTS.narrow : LAYOUTS.wide;
  svg.setAttribute('viewBox', `0 0 ${fig.lay.W} ${fig.lay.H}`);
  svg.innerHTML = `<title id="pic-title"></title><desc id="pic-desc"></desc>${markers('')}<g class="g-flows"></g><g class="g-nodes"></g><g class="g-labels"></g><g class="g-blood"></g><g class="g-tokens"></g><g class="g-callouts"></g>`;
  for (const k of ['flows', 'nodes', 'labels', 'blood', 'tokens', 'callouts']) fig.g[k] = svg.querySelector(`.g-${k}`);
  fig.sig = {};
}

/* ---------------- Steps ---------------- */
const lessonPanel = $('#lesson');
const steps = $$('#lesson [data-step]');
const stage = $('#stage'), dock = $('#dock');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
const live = $('#live');
const kindOf = i => steps[i].dataset.kind;
const compareIdx = steps.findIndex(s => s.dataset.kind === 'compare');
let cur = 0, started = false;
const mem = new Map();
const anim = { p: 0, playing: false, raf: 0, last: 0, hold: 0 };
// A repeated message gets a trailing no-break space so screen readers announce it again.
const say = t => { live.textContent = live.textContent === t ? `${t} ` : t; };

function sceneFor(i) {
  const k = kindOf(i);
  if (SCENES[k]) return SCENES[k];
  return stateScene(k === 'compare' ? store.compare : steps[i].dataset.state);
}
const lastP = i => sceneFor(i).K.length - 1;
const pending = i => !store.predictions[kindOf(i)];

function draw() {
  if (!fig.lay) return;
  const sc = sceneFor(cur), fr = frameAt(sc, anim.p), lay = fig.lay, g = fig.g;
  const sn = JSON.stringify([fr.lit, fr.dim, f1(fr.cc)]);
  if (sn !== fig.sig.n) { g.nodes.innerHTML = nodesSVG(lay, fr); fig.sig.n = sn; }
  const sf = JSON.stringify([Object.entries(fr.f).map(([k, v]) => [k, Math.round(v * 50)]), [...fr.mute], fr.ghost]);
  if (sf !== fig.sig.f) {
    // paths under the organs, labels above them
    const html = flowsSVG(lay, fr);
    g.flows.innerHTML = html.replace(TEXT_RE, '');
    g.labels.innerHTML = (html.match(TEXT_RE) || []).join('');
    fig.sig.f = sf;
  }
  g.blood.innerHTML = bloodSVG(lay, fr);
  g.tokens.innerHTML = tokensSVG(lay, fr);
  const sc2 = JSON.stringify(fr.co.map(c => c.t[0] + c.dir)) + fig.narrow;
  if (sc2 !== fig.sig.c) {
    g.callouts.innerHTML = calloutsSVG(lay, fr, fig.narrow, fig.sig.c ? fig.prevCo : new Set());
    fig.prevCo = new Set(fr.co.map(c => c.t[0]));
    fig.sig.c = sc2;
  }
  const title = `Step ${cur + 1} picture: ${steps[cur].dataset.stepTitle}`;
  const desc = `${fr.j + 1} of ${fr.m + 1}, ${fr.beat}. ${fr.d}`;
  if (fig.sig.d !== title + desc) {
    $('#pic-title', svg).textContent = title;
    $('#pic-desc', svg).textContent = desc;
    fig.sig.d = title + desc;
  }
  const bn = `${fr.j + 1} of ${fr.m + 1}`;
  if (fig.sig.b !== bn + fr.beat) { $('.beat-n', dock).textContent = bn; $('.beat-t', dock).textContent = fr.beat; fig.sig.b = bn + fr.beat; }
}

function syncPlayer() {
  const off = pending(cur);
  const play = $('[data-pl="play"]', dock);
  play.textContent = anim.playing ? '❚❚' : '▶';
  play.setAttribute('aria-label', anim.playing ? 'Pause' : 'Play');
  for (const b of $$('.player button', dock)) b.disabled = off;
  for (const b of $$('[data-speed]', dock)) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === store.speed));
  dock.classList.toggle('is-locked', off);
}
function tick(now) {
  if (!anim.playing) return;
  if (lessonPanel.hidden) { anim.playing = false; syncPlayer(); return; }
  const dt = anim.last ? Math.min(64, now - anim.last) : 16;
  anim.last = now;
  const m = lastP(cur);
  if (anim.hold > 0) anim.hold -= dt;
  else {
    anim.p += dt / 1000 / (sceneFor(cur).beatSec || BEAT_SEC) * store.speed;
    if (anim.p >= m) { anim.p = m; anim.playing = false; }
  }
  draw();
  if (anim.playing) anim.raf = requestAnimationFrame(tick);
  else syncPlayer();
}
function play(lead = false) {
  if (pending(cur)) return;
  const m = lastP(cur);
  cancelAnimationFrame(anim.raf);
  if (reduced()) { anim.p = m; anim.playing = false; draw(); syncPlayer(); return; }
  if (anim.p >= m - 1e-6) { anim.p = 0; lead = true; }
  anim.playing = true; anim.hold = lead ? LEAD_MS : 0; anim.last = 0;
  anim.raf = requestAnimationFrame(tick);
  syncPlayer();
}
function pause() { anim.playing = false; cancelAnimationFrame(anim.raf); syncPlayer(); }
function restart() { anim.p = 0; draw(); play(true); }
function stepBeat(d) {
  pause();
  const m = lastP(cur);
  anim.p = d > 0 ? Math.min(m, Math.floor(anim.p + 1e-6) + 1) : Math.max(0, Math.ceil(anim.p - 1e-6) - 1);
  draw();
}

function placeDock() {
  const el = steps[cur];
  if (fig.narrow) el.append(dock); else el.querySelector('.step-left').append(dock);
}

function showStep(i, focus = false) {
  if (started) { mem.set(cur, anim.p); pause(); }
  cur = clamp(i, 0, steps.length - 1);
  const el = steps[cur];
  steps.forEach((s, k) => { s.hidden = k !== cur; });
  el.querySelector('.fig-slot').append(stage);
  placeDock();
  backBtn.disabled = cur === 0;
  nextBtn.textContent = cur === steps.length - 1 ? 'Take the quiz →' : 'Next →';
  progress.textContent = `Step ${cur + 1} of ${steps.length}`;
  if (!lessonPanel.hidden && location.hash !== `#step-${cur + 1}`) history.replaceState(null, '', `#step-${cur + 1}`);
  renderStep(el);
  const sc = sceneFor(cur), m = sc.K.length - 1;
  fig.sig = {};
  if (pending(cur)) anim.p = 0;
  else if (mem.has(cur)) anim.p = Math.min(mem.get(cur), m);
  else if (reduced()) anim.p = m;
  else { anim.p = 0; draw(); play(true); }
  draw();
  syncPlayer();
  started = true;
  if (focus) {
    el.querySelector('h2').focus({ preventScroll: true });
    if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > innerHeight * 0.5) el.scrollIntoView({ block: 'start' });
  }
}
function next() {
  if (cur === steps.length - 1) { activate('quiz', { scroll: true }); $('#quiz h2')?.focus({ preventScroll: true }); }
  else showStep(cur + 1, true);
}

/* ---------------- Predictions, captions, changes ---------------- */
function verdictHTML(k) {
  const P = L.STEPS[k].predict, got = store.predictions[k];
  const right = got !== 'skip' && got.pick === P.answer;
  const head = got === 'skip' ? 'Skipped.' : right ? 'Right.' : 'Not quite.';
  return `<div class="verdict ${got === 'skip' ? 'is-skip' : right ? 'is-right' : 'is-wrong'}"><p class="v-head" tabindex="-1"><b>${head}</b> The answer: ${esc(P.options[P.answer])}.</p><p class="v-why">${esc(P.why)}</p>${srcDetails(P.q)}</div>`;
}
function renderPredict(el) {
  const k = el.dataset.kind, P = L.STEPS[k].predict, got = store.predictions[k], box = el.querySelector('[data-predict]');
  const name = `pred-${k}`;
  box.innerHTML = `<fieldset class="pq"><legend><span class="tag">Predict first</span> <span class="pq-q">${esc(P.prompt)}</span></legend><div class="opts">${orderOf(`p:${k}`, P.options.length).map(i => {
    const o = P.options[i], mark = got ? (i === P.answer ? ' is-answer' : (got !== 'skip' && got.pick === i ? ' is-picked' : '')) : '';
    return `<label class="opt${mark}"><input type="radio" name="${name}" value="${i}"${got && got !== 'skip' && got.pick === i ? ' checked' : ''}${got ? ' disabled' : ''}><span>${esc(o)}</span>${got && i === P.answer ? '<em class="flag">✓ answer</em>' : ''}</label>`;
  }).join('')}</div>${got ? verdictHTML(k) : `<div class="pq-actions"><button type="button" class="btn-primary" data-commit>Check my prediction</button><button type="button" class="btn-quiet" data-skip>Skip, just show me</button></div><p class="pq-msg" aria-live="polite"></p>`}</fieldset>`;
  el.querySelector('[data-reveal]').hidden = !got;
  if (!got) {
    box.querySelector('[data-commit]').addEventListener('click', () => {
      const c = box.querySelector('input:checked');
      if (!c) { box.querySelector('.pq-msg').textContent = 'Choose one answer first, or skip.'; return; }
      commit(el, { pick: Number(c.value) });
    });
    box.querySelector('[data-skip]').addEventListener('click', () => commit(el, 'skip'));
  }
}
function commit(el, value) {
  const k = el.dataset.kind;
  store.predictions[k] = value;
  save();
  renderStep(el);
  mem.delete(cur);
  anim.p = 0;
  draw();
  syncPlayer();
  play(true);
  if (el.dataset.state || k === 'compare') say(announceState(k === 'compare' ? store.compare : el.dataset.state));
  el.querySelector('.v-head')?.focus({ preventScroll: true });
  const v = stage.getBoundingClientRect();
  if (v.bottom < 80) stage.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
}
function changesHTML(id) {
  const st = stateOf(id);
  if (!st) return '<p class="load-error">The state data could not be loaded. Reload the page to try again.</p>';
  if (id === 'normal') return `<p class="ch-normal"><b>Normal.</b> No shifts: the baseline every state is compared with.</p>`;
  const items = shiftList(st).map(s => `<li><span class="arr arr-${s.dir}" aria-hidden="true">${ARROW[s.dir]}</span><span class="ch-txt"><b>${esc(NAMED[s.id] || s.word)}</b> ${s.dir}${s.note ? `: ${esc(s.note)}` : ''}</span>${srcDetails(s.q)}</li>`).join('');
  const ns = notStated(st);
  return `<h3 class="ch-head">What changed: ${esc(st.label)}</h3><ul class="ch-list">${items}</ul>${ns.length ? `<p class="not-stated"><b>Not stated in sources:</b> ${ns.join(', ')}. Drawn dotted grey, with no tokens.</p>` : ''}`;
}
function fillOnce(el) {
  if (el.dataset.filled) return;
  el.dataset.filled = '1';
  const k = el.dataset.kind, reveal = el.querySelector('[data-reveal]');
  for (const bq of el.querySelectorAll('[data-quote]')) {
    const ids = bq.dataset.quote.split(' ').filter(id => SRC[id]);
    if (!ids.length) { bq.hidden = true; continue; }
    bq.innerHTML = `<p>“${ids.map(id => pretty(SRC[id].quote)).join(' ')}”</p><cite>${esc(SRC[ids[0]].section.split(',').slice(0, 2).join(','))}</cite>`;
  }
  const changes = reveal.querySelector('[data-changes]');
  const anchor = changes || reveal.lastElementChild;
  anchor.insertAdjacentHTML(changes ? 'beforebegin' : 'afterend', srcDetails(L.STEPS[k].captionQ, 'Where this comes from'));
  const replay = reveal.querySelector('[data-replay]');
  if (replay) replay.addEventListener('click', restart);
  const pick = reveal.querySelector('[data-state-pick]');
  if (pick) {
    pick.insertAdjacentHTML('beforeend', `<div class="pick-opts">${L.STATES.map(s => `<label class="opt"><input type="radio" name="cmp" value="${s.id}"><span>${esc(s.label)}</span></label>`).join('')}</div>`);
    pick.addEventListener('change', e => { if (e.target.name === 'cmp') chooseState(e.target.value, 'lesson'); });
  }
}
function renderStep(el) {
  fillOnce(el);
  renderPredict(el);
  const id = el.dataset.kind === 'compare' ? store.compare : el.dataset.state;
  const ch = el.querySelector('[data-changes]');
  if (ch && id) ch.innerHTML = changesHTML(id);
  for (const r of el.querySelectorAll('input[name="cmp"]')) r.checked = r.value === store.compare;
  const legend = $('[data-legend]', stage);
  if (id && id !== 'normal' && stateOf(id)) {
    legend.hidden = false;
    legend.innerHTML = `<span class="ls ls-ghost" aria-hidden="true"></span>faint band: normal <span class="ls ls-solid" aria-hidden="true"></span>solid: ${esc(stateOf(id).short)} <span class="ls ls-mute" aria-hidden="true"></span>dotted: not stated in sources`;
  } else legend.hidden = true;
}

// One state choice is shared by the Compare step and the Clinical values tab.
function chooseState(id, from) {
  if (!stateOf(id)) return;
  store.compare = id;
  save();
  for (const r of $$('input[name="cmp"], input[name="cvs"]')) r.checked = r.value === id;
  if (cur === compareIdx && from === 'lesson') {
    renderStep(steps[cur]);
    fig.sig = {};
    anim.p = 0; draw(); play(true);
    say(announceState(id));
  } else {
    mem.set(compareIdx, lastP(compareIdx));
    if (cur === compareIdx) { renderStep(steps[cur]); fig.sig = {}; anim.p = lastP(cur); draw(); }
  }
  renderCVState();
  if (from === 'clinical') say(announceState(id));
}

/* ---------------- Tabs and address ---------------- */
const tabs = $$('.tabs [role=tab]');
const panelOf = t => t.getAttribute('aria-controls');
function activate(name, { focus = false, scroll = false } = {}) {
  const tab = tabs.find(t => panelOf(t) === name);
  if (!tab) return;
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(panelOf(t)).hidden = !on;
  }
  if (focus) tab.focus();
  if (name === 'lesson') showStep(cur);
  else {
    pause();
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  }
  if (name === 'quiz') renderQuiz();
  if (scroll) $('.tabs').scrollIntoView({ block: 'start' });
}
function fromHash() {
  const h = location.hash.slice(1), m = h.match(/^step-(\d+)$/);
  if (m) {
    const n = clamp(Number(m[1]), 1, steps.length) - 1;
    if ($('#lesson').hidden) { cur = n; activate('lesson'); } else if (n !== cur) showStep(n);
    return true;
  }
  if (tabs.some(t => panelOf(t) === h)) { activate(h); return true; }
  return false;
}

/* ---------------- Clinical values ---------------- */
let cv = null;
const cvStateOf = id => (cv?.states || []).find(s => s.id === id);
function zonesOf(v) {
  if (v.cuts) return { names: v.zones, ticks: v.cuts.map(String), cls: ['z-def', 'z-ins', 'z-suf'], band: 2 };
  return { names: v.zones, ticks: [`${v.low}`, `${v.high}`], alt: [`${v.lowAlt}`, `${v.highAlt}`], cls: ['z-low', 'z-band', 'z-high'], band: 1 };
}
function rangeLine(v) {
  if (v.cuts) return v.zones.map((z, i) => `${z}: ${v.zoneText[i]} ${v.unitMain}`).join(' · ');
  return `Normal range: ${v.low} to ${v.high} ${v.unitMain} (${v.lowAlt}–${v.highAlt} ${v.unitAlt})`;
}
const quoteIdsOf = v => (Array.isArray(v.quoteId) ? v.quoteId : [v.quoteId]);
// Bars are schematic: the zones are drawn at fixed shares (no numeric axis), the numbers sit on the boundaries.
const zoneWeights = v => (v.cuts ? [1, 1, 1] : [1, 2, 1]);
function renderCV() {
  $('#cv-disclaimer').textContent = cv.disclaimer;
  const pick = $('#cv-pick');
  pick.insertAdjacentHTML('beforeend', `<div class="pick-opts">${L.STATES.map(s => `<label class="opt"><input type="radio" name="cvs" value="${s.id}"${s.id === store.compare ? ' checked' : ''}><span>${esc(s.label)}</span></label>`).join('')}</div>`);
  pick.addEventListener('change', e => { if (e.target.name === 'cvs') chooseState(e.target.value, 'clinical'); });
  $('#cv-rows').innerHTML = cv.values.map(v => {
    const z = zonesOf(v), w = zoneWeights(v), tot = w.reduce((a, b) => a + b, 0);
    const tickPos = [w[0] / tot, (w[0] + w[1]) / tot];
    return `<div class="cv-row" data-cv="${v.id}">
      <div class="cv-head"><h4>${esc(v.label)}</h4><span class="unit">${esc(v.unit)}</span></div>
      <div class="bar-wrap" aria-hidden="true">
        <div class="bar">${z.names.map((n, i) => `<div class="zone ${z.cls[i]}" style="flex:${w[i]}"><span>${esc(n)}</span></div>`).join('')}<div class="marker" hidden><span class="marker-dot"></span></div></div>
        <div class="ticks">${z.ticks.map((t, i) => `<span style="left:${(tickPos[i] * 100).toFixed(2)}%">${esc(t)}${z.alt ? `<small>${esc(z.alt[i])}</small>` : ''}</span>`).join('')}</div>
      </div>
      <p class="range-line">${esc(rangeLine(v))}</p>
      <p class="status" data-status></p>
      ${srcDetails(quoteIdsOf(v), 'ⓘ Source for the range')}
      <div class="state-src" data-state-src></div>
    </div>`;
  }).join('');
  $('#cv-defs').innerHTML = (cv.definitions || []).map(d => `<div class="cv-def" data-def="${d.id}"><p><b>${esc(d.label)}:</b> ${esc(d.text)}. A definition line only: no bar and no state marker.</p>${srcDetails([d.quoteId], 'ⓘ Source')}</div>`).join('');
  $('#cv-albumin').innerHTML = `<p>A large share of blood calcium is bound to albumin, so the source corrects total calcium for the albumin level. Read it exactly as quoted; there is no calculator here.</p><ul class="srcs open">${srcItems(cv.albuminNote.quoteIds)}</ul>`;
  $('#cv-sources').innerHTML = Object.values(cv.sources).map(s => `<li>${esc(s)}</li>`).join('');
  renderCVState();
}
function renderCVState() {
  if (!cv) return;
  const id = store.compare, st = stateOf(id), cs = cvStateOf(id) || { shifts: {}, quotes: {} };
  $('#cv-state').innerHTML = `<b>${esc(st.label)}.</b> ${esc(st.summary)}`;
  for (const v of cv.values) {
    const row = $(`[data-cv="${v.id}"]`), mk = $('.marker', row), status = $('[data-status]', row), z = zonesOf(v);
    const w = zoneWeights(v), tot = w.reduce((a, b) => a + b, 0);
    const center = i => { let a = 0; for (let k = 0; k < i; k++) a += w[k]; return (a + w[i] / 2) / tot * 100; };
    let zone = null, text;
    const dir = cs.shifts[v.id];
    if (id === 'normal') { zone = z.band; text = v.cuts ? 'Normal teaching baseline: marker in the sufficiency zone.' : 'Normal teaching baseline: marker inside the normal range.'; }
    else if (dir === 'up') { zone = 2; text = `↑ ${st.short}: above the normal range (direction only, no number).`; }
    else if (dir === 'down') { zone = 0; text = v.cuts ? `↓ ${st.short}: in the deficiency zone (by definition).` : `↓ ${st.short}: below the normal range (direction only, no number).`; }
    else text = `Not stated in sources for ${st.short.toLowerCase()}: no marker.`;
    mk.hidden = zone === null;
    if (zone !== null) { mk.style.left = `${center(zone).toFixed(2)}%`; mk.dataset.zone = z.names[zone]; }
    status.textContent = text;
    status.dataset.dir = zone === null ? 'none' : dir || 'baseline';
    const q = cs.quotes?.[v.id];
    $('[data-state-src]', row).innerHTML = q ? srcDetails(q, `ⓘ Source for ${st.short.toLowerCase()}`) : '';
  }
  $('#cv-dirs').innerHTML = [['pth', 'PTH'], ['calcitriol', 'Calcitriol (1,25-dihydroxyvitamin D)'], ['phosphate', 'Phosphate']].map(([k, label]) => {
    const sh = st.shifts[k];
    let body;
    if (id === 'normal') body = '<p class="dir dir-none">Normal teaching baseline: no shift.</p>';
    else if (sh) body = `<p class="dir dir-${sh.dir}"><span class="arr arr-${sh.dir}" aria-hidden="true">${ARROW[sh.dir]}</span> ${st.short}: ${sh.dir}${sh.note ? ` (${esc(sh.note)})` : ''}</p>${srcDetails(sh.q, 'ⓘ Source')}`;
    else body = `<p class="dir dir-none">Not stated in sources for ${esc(st.short.toLowerCase())}.</p>`;
    return `<div class="dir-row" data-dir="${k}"><h4>${esc(label)}</h4>${body}</div>`;
  }).join('');
}
async function loadCV() {
  try {
    const r = await fetch('./clinical-values.json');
    if (!r.ok) throw new Error(`status ${r.status}`);
    cv = await r.json();
    // Source records that carry numbers are kept with the values; they join the one SOURCES object here.
    Object.assign(SRC, cv.sourceRecords || {});
    L.STATES = cv.states.map(fromCV);
    if (!stateOf(store.compare)) store.compare = 'normal';
  } catch (e) {
    $('#cv-disclaimer').textContent = 'Typical adult reference ranges could not be loaded.';
    const er = $('#cv-error');
    er.hidden = false;
    er.textContent = 'The reference values could not be loaded. Reload the page to try again; the lesson itself still works.';
  }
}

/* ---------------- Words that carry numbers or state arrows: filled from clinical-values.json ---------------- */
// {range:id} a value's quoted range; {zone:id:i} a zone's quoted bound; {arrows:state} a state's directions;
// {allstates} every state in one line. A text whose token cannot be filled is left out (fill returns null).
const arrowsOf = st => shiftList(st).filter(s => ['calcium', 'pth', 'phosphate', 'calcitriol', 'vitd25'].includes(s.id)).map(s => `${s.word} ${ARROW[s.dir]}${s.id === 'pth' && s.note ? ` (${s.note})` : ''}`).join(', ');
function fill(t) {
  let ok = true;
  const out = String(t).replace(/\{([a-z]+)(?::([a-z0-9_]+))?(?::(\d))?\}/g, (m, kind, id, i) => {
    const v = cv && cv.values.find(x => x.id === id);
    if (kind === 'range' && v) return `${v.low} to ${v.high} ${v.unitMain} (${v.lowAlt}-${v.highAlt} ${v.unitAlt})`;
    if (kind === 'zone' && v && v.zoneText) return `${v.zoneText[Number(i)]} ${v.unitMain}`;
    if (kind === 'arrows' && stateOf(id)) { const a = arrowsOf(stateOf(id)); return a.charAt(0).toUpperCase() + a.slice(1); }
    if (kind === 'allstates' && L.STATES.length > 1) return L.STATES.filter(x => x.id !== 'normal').map(x => `${x.label}: ${shiftList(x).map(s => `${s.word} ${ARROW[s.dir]}`).join(', ')}`).join('. ') + '.';
    ok = false; return m;
  });
  return ok ? out : null;
}
const quizQs = () => L.QUIZ.map(q => ({ ...q, stem: fill(q.stem), options: q.options.map(fill), why: fill(q.why) })).filter(q => q.stem && q.why && q.options.every(o => o !== null));

/* ---------------- Quiz ---------------- */
function quizItem(q, n) {
  const got = store.quiz[q.id], answered = got !== undefined, right = got === q.answer;
  const stepIdx = steps.findIndex(s => s.dataset.kind === q.step);
  return `<fieldset><legend><span class="meta">Question ${n} · Goal ${q.goal}</span> <span class="stem">${esc(q.stem)}</span></legend><div class="opts">${orderOf(`q:${q.id}`, q.options.length).map(i => {
    const o = q.options[i], mark = answered ? (i === q.answer ? ' is-answer' : got === i ? ' is-picked' : '') : '';
    return `<label class="opt${mark}"><input type="radio" name="quiz-${q.id}" value="${i}"${answered && got === i ? ' checked' : ''}${answered ? ' disabled' : ''}><span>${esc(o)}</span>${answered && i === q.answer ? '<em class="flag">✓ answer</em>' : ''}</label>`;
  }).join('')}</div>${answered
    ? `<div class="verdict ${right ? 'is-right' : 'is-wrong'}"><p class="v-head" tabindex="-1"><b>${right ? 'Right.' : 'Not quite.'}</b> The answer: ${esc(q.options[q.answer])}.</p><p class="v-why">${esc(q.why)}</p>${srcDetails(q.q)}${stepIdx >= 0 ? `<p class="review"><a href="#step-${stepIdx + 1}">Review step ${stepIdx + 1}: ${esc(steps[stepIdx].dataset.stepTitle)}</a></p>` : ''}</div>`
    : `<div class="pq-actions"><button type="button" class="btn-primary" data-check="${q.id}">Check answer</button></div><p class="pq-msg" aria-live="polite"></p>`}</fieldset>`;
}
function scoreText() {
  const qs = quizQs(), n = qs.length, answered = qs.filter(q => store.quiz[q.id] !== undefined).length;
  return `<b>${quizScore()}</b> of ${n} right${answered < n ? ` · ${n - answered} to go` : ' · all answered'}`;
}
function renderQuiz() {
  const box = $('#quiz');
  box.innerHTML = `<div class="quiz-head"><h2 tabindex="-1">Quiz</h2><p class="score" id="quiz-score" aria-live="polite">${scoreText()}</p></div><p class="hint">Ten questions, each tied to one of the goals. One try each; every answer cites its source and links back to the step that teaches it. Your score is kept in this browser.</p><ol class="qs">${quizQs().map((q, i) => `<li data-q="${q.id}">${quizItem(q, i + 1)}</li>`).join('')}</ol><div class="quiz-foot"><button type="button" class="btn-quiet" data-quiz-reset>Try again</button> <a href="#summary">Go to the summary</a></div>`;
}
$('#quiz').addEventListener('click', e => {
  const b = e.target.closest('[data-check]');
  if (b) {
    const q = quizQs().find(x => x.id === b.dataset.check), li = b.closest('li'), c = li.querySelector('input:checked');
    if (!c) { li.querySelector('.pq-msg').textContent = 'Choose one answer first.'; return; }
    store.quiz[q.id] = Number(c.value);
    save();
    li.innerHTML = quizItem(q, quizQs().findIndex(x => x.id === q.id) + 1);
    $('#quiz-score').innerHTML = scoreText();
    li.querySelector('.v-head').focus();
    renderSummaryScore();
    return;
  }
  if (e.target.closest('[data-quiz-reset]')) {
    store.quiz = {};
    save();
    renderQuiz();
    renderSummaryScore();
    $('#quiz h2').focus();
  }
});

/* ---------------- Summary ---------------- */
const dirCell = (st, k) => {
  if (st.id === 'normal') return '<td class="d-base">baseline</td>';
  const s = st.shifts[k];
  return s ? `<td class="d-${s.dir}"><span aria-hidden="true">${ARROW[s.dir]}</span> ${s.dir}</td>` : '<td class="d-none">not stated</td>';
};
function renderSummaryScore() { const el = $('#sum-score'); if (el) el.innerHTML = `Quiz: ${scoreText()}`; }
function renderSummary() {
  const lay = LAYOUTS.wide;
  const fr = frameAt({ K: [{ ...NORMAL_K, co: [] }] }, 0);
  fr.clock = 1.3;
  const cols = ['calcium', 'pth', 'calcitriol', 'phosphate', 'vitd25'];
  const head = { calcium: 'Calcium', pth: 'PTH', calcitriol: 'Calcitriol', phosphate: 'Phosphate', vitd25: '25-OH D' };
  const vals = cv ? cv.values.map(v => `<li><b>${esc(v.label)}</b> (${esc(v.unit)}): ${esc(rangeLine(v))}<ul class="srcs">${srcItems(quoteIdsOf(v))}</ul></li>`).join('')
    + (cv.definitions || []).map(d => `<li><b>${esc(d.label)}</b>: ${esc(d.text)} (definition only)<ul class="srcs">${srcItems([d.quoteId])}</ul></li>`).join('')
    : '<li>The reference values could not be loaded.</li>';
  $('#summary').innerHTML = `<div class="sum">
    <div class="sum-head"><h2 tabindex="-1">Summary</h2><button type="button" class="btn-quiet" data-print>Print this summary</button></div>
    <p class="note banner print-note"><strong>Educational, not for clinical use.</strong> Calcium, PTH and vitamin D · The Lab · seansooch.dev</p>
    <p class="sum-score" id="sum-score"></p>
    <section><h3>Goals</h3><ol class="goals">${L.GOALS.map(g => `<li>${esc(g)}</li>`).join('')}</ol></section>
    <section class="sum-fig"><h3>The key diagram</h3><figure>${staticSVG(lay, fr, 'Key diagram: PTH flows from the parathyroid glands to bone and kidney; the kidney sends calcitriol to the gut; calcium enters the blood from bone, kidney and gut; phosphate leaves bone and is lost in urine.')}<figcaption>Teal dots: calcium. Amber hexagons: PTH. Violet triangles: calcitriol (kidney to gut only). Grey rings: phosphate.</figcaption></figure></section>
    <section><h3>The lesson in six lines</h3><ol class="takeaways">${L.TAKEAWAYS.filter(t => fill(t.text)).map(t => `<li><p>${esc(fill(t.text))}</p><p class="cite-line">${t.q.filter(id => SRC[id]).map(id => esc(SRC[id].section.split(',').slice(0, 2).join(','))).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</p>${srcDetails(t.q)}</li>`).join('')}</ol></section>
    <section><h3>The four states, as far as the sources go</h3><div class="table-wrap"><table class="state-table"><caption class="visually-hidden">Direction of each value in each state</caption><thead><tr><th scope="col">State</th>${cols.map(c => `<th scope="col">${head[c]}</th>`).join('')}</tr></thead><tbody>${L.STATES.map(st => `<tr><th scope="row">${esc(st.label)}</th>${cols.map(c => dirCell(st, c)).join('')}</tr>`).join('')}</tbody></table></div><p class="hint">“Not stated” means these sources give no direction for it; nothing is filled in by guesswork. Phosphorus in hypoparathyroidism is the source’s word for the phosphate level.</p></section>
    <section><h3>Clinical values with sources</h3><p class="hint">${cv ? esc(cv.disclaimer) : ''} No reference range is shown for PTH, calcitriol or phosphate: the sources used here give none.</p><ul class="sum-values">${vals}</ul></section>
    <section><h3>Glossary</h3><dl class="glossary">${L.GLOSSARY.map(g => `<dt>${esc(g.term)}</dt><dd><p>${esc(g.def)}</p><p class="cite-line">${g.q.filter(id => SRC[id]).map(id => esc(SRC[id].section.split(',').slice(0, 2).join(','))).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</p></dd>`).join('')}</dl></section>
  </div>`;
  $('#summary [data-print]').addEventListener('click', () => print());
  renderSummaryScore();
}

/* ---------------- Sources ---------------- */
function renderSources() {
  const groups = new Map();
  for (const [id, r] of Object.entries(SRC)) { if (!groups.has(r.file)) groups.set(r.file, []); groups.get(r.file).push([id, r]); }
  $('#sources').innerHTML = `<h2 tabindex="-1">Sources</h2><p class="hint">Every record this lesson rests on: ${Object.keys(SRC).length} quotes from ${groups.size} cached files, each copied word for word (only line breaks differ). Section names locate the passage; the file is the cached copy the quote was checked against.</p>${[...groups].map(([file, recs]) => `<section class="src-file"><h3>${esc(recs[0][1].section.split(',').slice(0, 2).join(','))}</h3><p class="file">${esc(file)}</p><ol class="src-table">${recs.map(([id, r]) => `<li id="src-${id}"><p class="sec">${esc(r.section)}</p><blockquote>“${pretty(r.quote)}”</blockquote><p class="rid">record ${esc(id)} · file ${esc(r.file)}</p></li>`).join('')}</ol></section>`).join('')}`;
}

/* ---------------- Wiring ---------------- */
function wire() {
  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', () => showStep(cur - 1, true));
  dock.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const pl = b.dataset.pl;
    if (pl === 'play') { if (anim.playing) pause(); else play(); }
    else if (pl === 'restart') restart();
    else if (pl === 'back') stepBeat(-1);
    else if (pl === 'fwd') stepBeat(1);
    else if (b.dataset.speed) { store.speed = Number(b.dataset.speed); save(); syncPlayer(); }
  });
  lessonPanel.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea, summary') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'ArrowRight' && cur < steps.length - 1) { e.preventDefault(); showStep(cur + 1, true); }
    if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); showStep(cur - 1, true); }
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(panelOf(t)));
    t.addEventListener('keydown', e => {
      const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (n !== undefined) { e.preventDefault(); activate(panelOf(tabs[n]), { focus: true }); }
    });
  });
  addEventListener('hashchange', fromHash);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !$('main').contains(a)) return;
    const h = a.getAttribute('href').slice(1);
    if (/^step-\d+$/.test(h) || tabs.some(t => panelOf(t) === h)) {
      e.preventDefault();
      history.pushState(null, '', `#${h}`);
      fromHash();
      if (/^step-/.test(h)) { steps[cur].querySelector('h2').focus({ preventScroll: true }); steps[cur].scrollIntoView({ block: 'start' }); }
      else document.getElementById(h)?.querySelector('h2')?.focus();
    }
  });
  const relayout = () => { setLayout(); placeDock(); draw(); };
  narrowQ.addEventListener('change', relayout);
  reducedQ.addEventListener('change', () => { if (reduced()) { pause(); anim.p = lastP(cur); draw(); } });
}

async function start() {
  $('#goals').innerHTML = L.GOALS.map(g => `<li>${esc(g)}</li>`).join('');
  if (matchMedia('(min-width: 900px)').matches) $('#plan').open = true;
  setLayout();
  // The states, their directions and every number come from clinical-values.json: read it before drawing.
  await loadCV();
  renderSources();
  wire();
  if (cv) renderCV();
  renderSummary();
  if (!fromHash()) showStep(0);
  else if (!started) showStep(cur);
  document.documentElement.dataset.lesson = 'ready';
}
start();
