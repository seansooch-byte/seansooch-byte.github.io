// Lesson 22: ADH and water balance. js/lesson.js runs the page (after the Lab kit); this file gives
// each step its picture (js/picture.js draws them all from one schematic), and starts the Clinical
// values (js/values.js) and Explore freely (js/explore.js) tabs. Every state the pictures show comes
// from the table in js/states.js, and every number and arrow from a quote in js/sources.js.
// Classic scripts throughout, so the lesson works served and opened from a file.
(() => {
const A = window.ADH;
const { svg, ease, span, lerp } = A.draw;
const { STATES, STATE_ORDER } = A;
const { schematic, levelsOf, wordsOf, mix, firing, FULL, osmoScene, describeState } = A.picture;

const $ = s => document.querySelector(s);
// The building steps draw the mechanism, not a sourced state: their middle level is "some", never
// "normal". Only the "What changes it" steps draw states, over the baseline as the sources state it.
const BASELINE = levelsOf('baseline');
const BASE = { ...BASELINE, adhUnknown: 0, aquaUnknown: 0, concUnknown: 0 }, HIGH = levelsOf('deficit'), LOW = levelsOf('excess');
const wave = t => .5 - .5 * Math.cos(t * Math.PI * 2);   // 0 → 1 → 0 over one loop

// Words beside a gauge while a building step moves it.
const said = {
  adh: v => (v > .7 ? 'high ↑' : v < .3 ? 'low ↓' : 'some'),
  aqua: v => (v > .75 ? 'more ↑' : v < .3 ? 'fewer ↓' : 'some'),
  vol: v => (v > .75 ? 'more ↑' : v < .42 ? 'less ↓' : 'typical'),
  conc: v => (v > .7 ? 'high ↑' : v < .3 ? 'low ↓' : 'medium'),
  na: v => (v > .58 ? '↑ higher' : v < .42 ? '↓ lower' : 'normal'),
  blood: v => (v > .66 ? 'more concentrated ↑' : v < .34 ? 'more dilute ↓' : 'in its range'),
};
const wordsAt = L => Object.fromEntries(Object.entries(said).map(([k, fn]) => [k, fn(L[k])]));
// Two callouts that cross-fade as a loop swings from one side to the other.
const swing = (s, hi, lo) => (s >= .5 ? { callout: hi, calloutA: Math.min(1, (s - .5) / .15) } : { callout: lo, calloutA: Math.min(1, (.5 - s) / .15) });

const announce = msg => { const el = $('#lesson-live'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = msg; }); } };

/* ---------- Building the loop, one piece per step ---------- */
const UP_TO = {
  sensor: ['brain', 'meter'],
  release: ['brain', 'pituitary', 'adh', 'meter', 'g-adh'],
  duct: ['brain', 'pituitary', 'adh', 'cell', 'receptor', 'lumen', 'g-adh'],
  channels: ['brain', 'pituitary', 'adh', 'cell', 'receptor', 'aqua', 'lumen', 'g-adh', 'g-aqua'],
  water: ['brain', 'pituitary', 'adh', 'cell', 'receptor', 'aqua', 'lumen', 'water', 'g-adh', 'g-aqua'],
  output: FULL.filter(p => p !== 'g-na'),
};
const scenes = {
  osmo: { duration: 7000, loop: true, render: osmoScene },
  sensor: {
    duration: 6000, loop: true,
    render(t) {
      const s = wave(t), L = mix(BASE, { ...BASE, blood: HIGH.blood }, s), fire = firing(L);
      const body = schematic({ L, show: UP_TO.sensor, phase: t * 2, fire, words: { blood: said.blood(L.blood) },
        callout: fire > .4 ? ['Osmoreceptors fire', 'the blood has grown', 'too concentrated'] : ['Osmoreceptors quiet', 'the blood is inside', 'its narrow range'] });
      return svg('The brain senses the blood', 'The brain, with the hypothalamus at its base marked in blue, above a blood vessel. Below the vessel, the blood concentration meter. As the blood tint deepens and the needle moves toward more concentrated, the osmoreceptor dots in the hypothalamus fire, sending out rings; as it pales back into the narrow range, they go quiet.', body, { h: 300 });
    },
  },
  release: {
    duration: 6000, loop: true,
    render(t) {
      const s = wave(t), L = mix(BASE, { ...BASE, blood: HIGH.blood, adh: HIGH.adh }, s), fire = firing(L);
      const body = schematic({ L, show: UP_TO.release, phase: t * 2, fire, words: wordsAt(L),
        ...swing(s, ['More ADH released ↑', 'the pituitary lets it', 'out into the blood'], ['Little ADH released', 'the blood is in range,', 'the signal is quiet']) });
      return svg('The pituitary releases ADH', 'The brain and, hanging below it, the posterior pituitary, drawn in amber. As the blood grows more concentrated, the osmoreceptors fire and the pituitary releases more amber ADH dots into the blood vessel, which carries them away to the right. The ADH gauge rises from normal to high, then falls back.', body, { h: 300 });
    },
  },
  duct: {
    duration: 4200, rest: 1,
    render(t) {
      const L = { ...BASE, adh: HIGH.adh, aqua: 0 };
      const body = schematic({ L, show: UP_TO.duct, phase: t * 2, dock: ease.inOut(span(t, .2, .75)), words: wordsAt(L),
        callout: ['ADH reaches the kidney', 'and docks on receptors', 'of collecting duct cells'], calloutA: span(t, .6, .8) });
      return svg('ADH reaches the collecting duct', 'Below the blood vessel, a collecting duct cell, with urine flowing through the duct beneath it. Three cup-shaped receptors sit on the side of the cell facing the blood. Amber ADH dots drop out of the blood and settle into the receptors.', body, { h: 310 });
    },
  },
  channels: {
    duration: 4600, rest: 1,
    render(t) {
      const k = ease.inOut(span(t, .15, .85)), L = { ...BASE, adh: HIGH.adh, aqua: lerp(0, 1, k) };
      const body = schematic({ L, show: UP_TO.channels, phase: t * 2, words: { ...wordsAt(L), aqua: k > .5 ? 'more ↑' : 'stored' },
        callout: ['Water channels move', 'into the membrane', 'that faces the urine'], calloutA: span(t, .7, .9) });
      return svg('ADH opens water channels', 'The collecting duct cell with ADH docked on its receptors. Six blue water channels, aquaporins, start inside the cell in little bubbles and move down into the membrane facing the urine. The water channel gauge rises.', body, { h: 310 });
    },
  },
  water: {
    duration: 5000, loop: true,
    render(t) {
      const L = { ...BASE, adh: HIGH.adh, aqua: 1 };
      const body = schematic({ L, show: UP_TO.water, phase: t * 2, words: { ...wordsAt(L), aqua: 'more ↑' },
        callout: ['Water crosses back', 'urine → channel → cell', '→ back into the blood'] });
      return svg('Water goes back into the blood', 'Blue water drops leave the urine in the duct, pass through the water channels in the cell membrane, cross the cell and enter the blood vessel above.', body, { h: 310 });
    },
  },
  output: {
    duration: 9000, loop: true,
    render(t) {
      const s = wave(t), L = mix(LOW, HIGH, s);
      const body = schematic({ L, show: UP_TO.output, phase: t * 4, fire: firing(L), words: wordsAt(L),
        ...swing(s, ['More ADH ↑', '→ less urine,', 'more concentrated'], ['Less ADH ↓', '→ more urine,', 'more dilute']) });
      return svg('ADH sets the urine', 'The whole path from brain to urine flask. As ADH rises, more water channels open, the flask holds less urine and its colour deepens: less, more concentrated urine. As ADH falls, the channels leave the membrane and the flask fills higher with pale, dilute urine. Marks on the flask show a typical day and the minimum needed.', body, { h: 420 });
    },
  },
  feedback: {
    duration: 7600, rest: 1,
    stages: [[0, 'too concentrated'], [.15, 'water returns'], [.45, 'ADH falls'], [.7, 'back in balance']],
    render(t) {
      const b = ease.inOut(span(t, .15, .5)), a = ease.inOut(span(t, .45, .75)), u = ease.inOut(span(t, .55, .9));
      const L = { ...HIGH, blood: lerp(HIGH.blood, BASE.blood, b), na: lerp(HIGH.na, BASE.na, b), adh: lerp(HIGH.adh, BASE.adh, a), aqua: lerp(HIGH.aqua, BASE.aqua, a), vol: lerp(HIGH.vol, BASE.vol, u), conc: lerp(HIGH.conc, BASE.conc, u), lost: 0 };
      const rows = [t > .15 ? 'Water returns to blood' : 'Blood too concentrated', t > .35 ? '→ blood less concentrated' : '', t > .6 ? '→ ADH ↓, channels removed' : ''];
      const body = schematic({ L, show: UP_TO.output, phase: t * 3, fire: firing(L), words: wordsAt(L), callout: rows });
      return svg('The loop switches itself off', 'The whole loop, starting with concentrated blood and high ADH. Water returns through the channels and the blood tint pales back into its range; the osmoreceptors stop firing, ADH falls, the water channels are pulled back out of the membrane and the urine returns to a typical day.', body, { h: 420 });
    },
  },
  sodium: {
    duration: 6000, loop: true,
    render(t) {
      const s = wave(t), L = mix(LOW, HIGH, s);
      const body = schematic({ L, show: FULL, phase: t * 2, fire: firing(L), words: wordsAt(L),
        callout: ['Sodium: the main particle', 'left shaded end: too low', 'right shaded end: too high'] });
      return svg('Blood sodium', 'The whole loop with a blood sodium gauge added at the bottom right: a track with a shaded end on each side, too low on the left and too high on the right. As water is lost the marker drifts right; as water is gained it drifts left, staying between the shaded ends.', body, { h: 420 });
    },
  },
  whole: {
    duration: 9000, loop: true,
    render(t) {
      const s = wave(t), L = mix(BASE, HIGH, s);
      const body = schematic({ L, show: FULL, phase: t * 4, fire: firing(L), words: wordsAt(L),
        ...swing(s, ['Too concentrated', 'ADH ↑ → water kept,', '→ blood dilutes again'], ['Back in range', 'ADH ↓ → channels removed', '→ urine back to normal']) });
      return svg('The whole loop', 'The whole loop, cycling: the blood grows concentrated, the osmoreceptors fire, the pituitary releases ADH, water channels move into the duct cell membrane, water returns to the blood and the flask holds less, darker urine; then the blood dilutes, ADH falls and the urine returns to normal.', body, { h: 420 });
    },
  },
};

/* ---------- What changes it: each state morphs from normal over a dashed ghost ---------- */
const announced = new Set();
function changeScene(id) {
  const st = STATES[id], to = levelsOf(id), W0 = wordsOf('baseline'), W1 = wordsOf(id);
  const desc = `Drawn over dashed outlines of normal. Compared with normal: ${describeState(id)}. ${st.callout.join(' ')}`;
  return {
    duration: 7000, loop: true, loopFrom: .5,
    render(t) {
      const m = ease.inOut(span(t, 0, .45)), L = mix(BASELINE, to, m);
      if (t < .05) announced.delete(id);
      if (m >= 1 && !announced.has(id)) { announced.add(id); announce(`${st.label}: ${describeState(id)}. ${st.callout.join(' ')}`); }
      // The legend and callout appear once the change starts: before it, the picture is plain normal.
      const body = schematic({ L, ghost: BASELINE, show: FULL, phase: t * 4, fire: firing(L), words: m > .5 ? W1 : W0,
        callout: st.callout, calloutA: span(t, .36, .48), legend: t > 0 ? st.legend : null });
      return svg(st.label, desc, body, { h: 420 });
    },
  };
}
for (const id of STATE_ORDER) if (id !== 'baseline') scenes[id] = changeScene(id);

A.lesson({
  scenes,
  async before() {
    A.explore.initExplore(announce);
    await A.values.loadValues();
  },
  onTab: { clinical: () => A.values.updateValues(false), explore: A.explore.showExplore },
});
})();
