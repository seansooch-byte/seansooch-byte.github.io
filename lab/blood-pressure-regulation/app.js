'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means the normal resting state. No clinical numbers live here;
   the Clinical values tab scales these ratios by the textbook values in clinical-values.json. */
const NORMAL = { vol: 1, art: 1, alpha: 1, central: 1, beta: 1, reflex: true };
const CHANGES = {
  ccb: { art: .72 },          // arteriole muscle relaxes
  alpha1: { alpha: .5 },      // vessels respond less to sympathetic signals
  alpha2: { central: .62 },   // the brainstem sends less sympathetic signal
  beta: { beta: .5 },         // the heart responds less to sympathetic signals
  vasodilator: { art: .55 },  // arteriole muscle relaxes strongly
  hemorrhage: { vol: .7 }     // blood is lost
};
const REFLEX_GAIN = 1.6;
// Blood per beat rises with filling and levels off (the Frank–Starling curve, scaled so normal filling gives 1).
const fillCurve = x => (1 - Math.exp(-1.35 * x)) / (1 - Math.exp(-1.35));

// The circulation for a given arterial pressure as the baroreceptors sense it.
function circulate(p, sensedPressure) {
  const reflex = p.reflex ? clamp(1 + REFLEX_GAIN * (1 - sensedPressure), .25, 2.4) : 1;
  const drive = p.central * reflex;               // sympathetic signal leaving the brainstem
  const heartDrive = drive * p.beta, vesselDrive = drive * p.alpha;
  const hr = .35 + .65 * heartDrive;              // the vagus alone would leave a slow rate
  const squeeze = .75 + .25 * heartDrive;
  const filling = p.vol * (.85 + .15 * vesselDrive); // firmer veins push more blood back to the heart
  const sv = squeeze * fillCurve(filling);
  const co = hr * sv;
  const tpr = p.art * (.6 + .4 * vesselDrive);
  return { drive, hr, sv, co, tpr, vol: p.vol, filling, map: co * tpr };
}
// Steady state: the pressure the circulation produces equals the pressure the reflex senses.
// Produced pressure never rises as sensed pressure rises, so bisection finds the single crossing.
function steady(p) {
  let lo = .02, hi = 4;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (circulate(p, mid).map > mid) lo = mid; else hi = mid; }
  return circulate(p, (lo + hi) / 2);
}
const BASE = steady(NORMAL);
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ---------- */
const RED = '#b3261e', BLUE = '#254dff', INK = '#171916', VEIN = '#5d6270', HEART_FILL = '#f6dcd8';
const HEART = 'M0 -42 C-80 -130 -145 -25 -90 42 L0 126 L90 42 C145 -25 80 -130 0 -42Z';
const BRANCHES = [490, 540, 590];
const ALL = ['loop', 'gauge', 'beats', 'sensor', 'nerves'];
const svg = (label, body) => `<svg viewBox="0 0 640 450" role="img" aria-label="${label}">${body}</svg>`;
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;

// How the model's state is drawn. Exponents exaggerate differences so they read at a glance.
function look(o) {
  return {
    angle: clamp((o.map - 1) * 2.6, -1, 1) * 80,
    aw: clamp(11 * Math.pow(o.tpr, -1.8), 3, 24),
    vw: clamp(22 * Math.pow(o.vol, 1.6), 8, 34),
    flow: clamp(Math.pow(o.co, 1.6), .5, 1.6),
    heart: .55 * Math.pow(o.sv, .6),
    spacing: clamp(44 / Math.pow(o.hr, 1.6), 20, 90),
    nerve: clamp(1 + 2.6 * o.drive, 1.2, 7),
    sense: clamp(1 + 2.6 * o.map, 1.2, 7)
  };
}
const chevron = (x, y, dir, s) => `<path d="M${f(x - dir * 7 * s)} ${f(y - 7 * s)} L${x} ${y} L${f(x - dir * 7 * s)} ${f(y + 7 * s)}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
function beatRow(y, spacing, stroke, extra = '') {
  let d = '';
  for (let x = 150; x <= 612; x += spacing) d += `M${f(x)} ${y} l5 -9 l6 18 l5 -9 `;
  return `<path ${extra} d="${d}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function ring(m, color = BLUE) {
  return `<ellipse cx="${m.x}" cy="${m.y}" rx="${m.rx}" ry="${m.ry}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="8 6"/>${text(m.tx, m.ty, m.text, 'sm blue', m.anchor || 'middle')}`;
}
const SPOTS = {
  arterioles: { x: 540, y: 226, rx: 80, ry: 66, tx: 628, ty: 136, anchor: 'end' },
  brainstem: { x: 300, y: 229, rx: 90, ry: 40, tx: 300, ty: 182 },
  heart: { x: 110, y: 245, rx: 76, ry: 84, tx: 110, ty: 352 },
  veins: { x: 470, y: 380, rx: 84, ry: 30, tx: 470, ty: 344 },
  flow: { x: 420, y: 110, rx: 54, ry: 24, tx: 420, ty: 152 }
};
const spot = (name, label) => ({ ...SPOTS[name], text: label });

function gauge(angle) {
  const ticks = [-60, -30, 0, 30, 60].map(a => { const r = a * Math.PI / 180; return `<path d="M${f(300 + 46 * Math.sin(r))} ${f(92 - 46 * Math.cos(r))} L${f(300 + 54 * Math.sin(r))} ${f(92 - 54 * Math.cos(r))}" stroke="${INK}" stroke-width="2"/>`; }).join('');
  return `${text(300, 26, 'pressure', 'sm')}<path d="M246 92 A54 54 0 0 1 354 92 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>${ticks}${text(240, 98, 'low', 'sm', 'end')}${text(360, 98, 'high', 'sm', 'start')}<rect x="296" y="92" width="8" height="12" fill="${INK}"/><path d="M300 92 V48" transform="rotate(${f(angle)} 300 92)" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/><circle cx="300" cy="92" r="6" fill="${INK}"/>`;
}

// The whole circulation: heart, arteries, arterioles, veins, plus optional gauge, beats, sensor and nerves.
function circuit(o, { parts = ALL, ghost = null, legend = '', marks = [], early = false } = {}) {
  const has = k => parts.includes(k), L = look(o);
  let b = `<rect x="455" y="140" width="170" height="160" rx="16" fill="#f3ece2" stroke="#babeb3"/>`;
  b += `<path d="M600 300 V380 H40 V250 H62" fill="none" stroke="${VEIN}" stroke-width="${f(L.vw)}" stroke-linejoin="round"/>`;
  b += `<path d="M110 222 V110 H540 V150" fill="none" stroke="${RED}" stroke-width="18" stroke-linejoin="round"/>`;
  for (const x of BRANCHES) {
    b += `<path d="M540 150 L${x} 182" stroke="${RED}" stroke-width="8" stroke-linecap="round"/><path d="M${x} 270 L600 300" stroke="${VEIN}" stroke-width="6" stroke-linecap="round"/><path d="M${x} 180 V272" stroke="${RED}" stroke-width="${f(L.aw)}" stroke-linecap="round"/>`;
    b += [204, 228, 252].map(y => `<path d="M${f(x - L.aw / 2 - 5)} ${y} H${f(x + L.aw / 2 + 5)}" stroke="${INK}" stroke-width="2"/>`).join('');
  }
  b += `<g transform="translate(110 245) scale(${f(L.heart * 100) / 100})"><path d="${HEART}" fill="${HEART_FILL}" stroke="${RED}" stroke-width="4" vector-effect="non-scaling-stroke"/></g>`;
  b += text(110, 262, 'heart', 'sm on-heart');
  const c = .6 + .4 * L.flow;
  b += chevron(390, 110, 1, c) + chevron(450, 110, 1, c) + chevron(270, 380, -1, c) + chevron(170, 380, -1, c);
  // "Arterioles" is defined in step 5; earlier pictures call them small vessels.
  b += text(300, 150, 'arteries') + text(222, 362, 'veins') + text(450, 284, early ? 'small vessels' : 'arterioles', '', 'end');
  if (has('gauge')) b += gauge(L.angle);
  if (has('sensor')) {
    b += `<path d="M160 121 C160 175 238 168 252 205" fill="none" stroke="${BLUE}" stroke-width="${f(L.sense)}" stroke-dasharray="2 7" stroke-linecap="round"/>`;
    b += `<circle cx="160" cy="110" r="12" fill="#fff" stroke="${BLUE}" stroke-width="4"/><path d="M142 92 q18 -14 36 0 M136 84 q24 -20 48 0" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`;
    b += text(178, 150, 'sensor', 'sm blue', 'start');
    b += `<rect x="230" y="205" width="140" height="48" rx="24" fill="#fff" stroke="${INK}" stroke-width="2"/>${text(300, 236, 'brainstem', 'sm on-box')}`;
  }
  if (has('nerves')) {
    const w = f(L.nerve);
    b += `<g fill="none" stroke="${BLUE}" stroke-width="${w}" stroke-linecap="round"><path d="M230 229 C195 229 182 238 166 244"/><path d="M370 222 C410 206 445 210 474 222"/><path d="M300 253 V356"/></g>`;
    b += `<g fill="${BLUE}"><circle cx="166" cy="244" r="6"/><circle cx="474" cy="222" r="6"/><circle cx="300" cy="358" r="6"/></g>${text(316, 320, 'nerves', 'sm blue', 'start')}`;
  }
  if (has('beats')) {
    b += ghost ? '' : text(20, 436, 'beats', 'sm', 'start');
    b += beatRow(ghost ? 438 : 430, L.spacing, BLUE);
  }
  let out = `<g data-new-state="${legend || 'current'}" data-pressure="${o.map.toFixed(4)}" data-rate="${o.hr.toFixed(4)}" data-flow="${o.co.toFixed(4)}" data-resistance="${o.tpr.toFixed(4)}" data-volume="${o.vol.toFixed(4)}">${b}</g>`;
  if (ghost) {
    const G = look(ghost);
    let g = '';
    if (has('gauge')) g += `<path d="M300 92 V48" transform="rotate(${f(G.angle)} 300 92)" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>`;
    for (const x of BRANCHES) g += `<path d="M${f(x - G.aw / 2)} 180 V272 M${f(x + G.aw / 2)} 180 V272" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    g += `<path d="M70 ${f(380 - G.vw / 2)} H590 M70 ${f(380 + G.vw / 2)} H590" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    g += `<g transform="translate(110 245) scale(${f(G.heart * 100) / 100})"><path d="${HEART}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/></g>`;
    if (has('beats')) g += beatRow(414, G.spacing, INK, 'stroke-dasharray="3 3"');
    out += `<g class="ghost" data-ghost="normal" data-pressure="${ghost.map.toFixed(4)}" data-rate="${ghost.hr.toFixed(4)}">${g}</g>`;
    out += `<g class="ghost"><path d="M20 22 H54" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/></g>${text(62, 29, 'normal', 'sm', 'start')}<path d="M20 50 H54" stroke="${BLUE}" stroke-width="5"/>${text(62, 57, legend, 'sm blue', 'start')}`;
    if (has('beats')) out += text(20, 420, 'normal', 'sm', 'start') + text(20, 444, 'beats', 'sm blue', 'start');
  }
  for (const m of marks) out += ring(m);
  return out;
}

// Step 3: the pressure wave over three beats.
function wave() {
  const v = ph => ph < .18 ? Math.sin(ph / .18 * Math.PI / 2) : ph < .38 ? 1 - .55 * (ph - .18) / .2 : ph < .46 ? .45 + .06 * Math.sin((ph - .38) / .08 * Math.PI) : .45 * Math.pow(1 - (ph - .46) / .54, 1.3);
  const y = val => 300 - val * 190;
  let d = '', sum = 0;
  for (let i = 0; i <= 360; i++) { const val = v((i % 120) / 120); if (i < 360) sum += val; d += `${i ? 'L' : 'M'}${f(80 + i * 1.45)} ${f(y(val))}`; }
  const mean = f(y(sum / 360));
  const dash = yy => `<path d="M72 ${yy} H620" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  return `<path d="M70 50 V340 H624" fill="none" stroke="#53584d" stroke-width="2"/>${text(32, 200, 'pressure ↑', 'sm', 'middle').replace('<text ', '<text transform="rotate(-90 32 200)" ')}${text(620, 372, 'time →', 'sm', 'end')}${dash(110)}${dash(300)}<path d="M72 ${mean} H620" stroke="${BLUE}" stroke-width="2.5" stroke-dasharray="10 5"/><path d="${d}" fill="none" stroke="${RED}" stroke-width="5" stroke-linejoin="round"/>${text(150, 98, 'systolic: the peak', '', 'start')}${text(82, 330, 'diastolic: the low point', '', 'start')}${text(612, mean - 12, 'mean: the average', 'blue', 'end')}${text(80, 420, 'One surge per heartbeat.', 'sm', 'start')}`;
}

// Step 6: the garden hose. Left: more flow in. Right: a narrower outlet. Both push the dial up.
function hose() {
  const panel = (x0, line1, line2, more) => {
    const cy = 250, gx = x0 + 140, gy = cy - 22;
    const needle = (a, ghost) => `<path d="M${gx} ${gy} V${gy - 38}" transform="rotate(${a} ${gx} ${gy})" stroke="${ghost ? INK : BLUE}" stroke-width="${ghost ? 3 : 5}" ${ghost ? 'stroke-dasharray="5 4" class="ghost"' : ''} stroke-linecap="round"/>`;
    const outlet = more ? 9 : 4;
    let s = `<path d="M${gx - 46} ${gy} A46 46 0 0 1 ${gx + 46} ${gy} Z" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="${x0 + 40}" y="${cy - 22}" width="200" height="44" rx="22" fill="${HEART_FILL}" stroke="${RED}" stroke-width="3"/>`;
    s += `<path d="M${x0 + 238} ${cy - 20} L${x0 + 278} ${cy - outlet} V${cy + outlet} L${x0 + 238} ${cy + 20} Z" fill="${HEART_FILL}" stroke="${RED}" stroke-width="3"/>`;
    if (!more) s += `<path class="ghost" d="M${x0 + 240} ${cy - 20} L${x0 + 278} ${cy - 9} M${x0 + 240} ${cy + 20} L${x0 + 278} ${cy + 9}" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    s += `<path d="M${x0 + 4} ${cy} H${x0 + 36}" stroke="${BLUE}" stroke-width="${more ? 18 : 9}" />`;
    if (more) s += `<path class="ghost" d="M${x0 + 4} ${cy - 4.5} H${x0 + 36} M${x0 + 4} ${cy + 4.5} H${x0 + 36}" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`;
    s += needle(0, true) + needle(48, false) + `<circle cx="${gx}" cy="${gy}" r="5" fill="${INK}"/>`;
    s += text(x0 + 150, 110, more ? 'Turn up the flow' : 'Narrow the outlet');
    s += text(x0 + 150, 330, line1, 'sm') + text(x0 + 150, 356, line2, 'sm blue');
    return s;
  };
  return panel(10, 'more flow in', '→ higher pressure', true) + panel(330, 'more resistance', '→ higher pressure', false) +
    `<path d="M320 70 V380" stroke="#babeb3" stroke-width="2"/><g class="ghost"><path d="M30 418 H64" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/></g>${text(72, 425, 'before', 'sm', 'start')}<path d="M190 418 H224" stroke="${BLUE}" stroke-width="5"/>${text(232, 425, 'after', 'sm blue', 'start')}`;
}

// Step 10: standing up, with and without the baroreflex. t (0–1) is how much of the time line is drawn.
const STAND = { ...NORMAL, vol: .8 };
function reflexChart(t) {
  const m0 = steady({ ...STAND, reflex: false }).map, m1 = steady(STAND).map, t0 = .2;
  const k = 170 / (1 - m0), xOf = s => 80 + s * 530, yOf = m => 140 + (1 - m) * k;
  const pressure = (s, reflex) => {
    if (s < t0) return 1;
    const x = s - t0, drop = 1 - Math.exp(-x / .025);
    if (!reflex) return 1 - (1 - m0) * drop;
    const recover = 1 - Math.exp(-Math.max(0, x - .03) / .09);
    return 1 - drop * ((1 - m0) - (m1 - m0) * recover);
  };
  const path = reflex => { let d = ''; for (let i = 0; i <= 200 && i / 200 <= t + 1e-9; i++) { const s = i / 200; d += `${i ? 'L' : 'M'}${f(xOf(s))} ${f(yOf(pressure(s, reflex)))}`; } return d; };
  return `<path d="M70 50 V350 H624" fill="none" stroke="#53584d" stroke-width="2"/>${text(32, 200, 'pressure ↑', 'sm').replace('<text ', '<text transform="rotate(-90 32 200)" ')}${text(620, 382, 'time →', 'sm', 'end')}` +
    `<path d="M72 140 H620" stroke="#babeb3" stroke-width="2"/>${text(616, 128, 'normal level', 'sm', 'end')}` +
    `<path d="M${xOf(t0)} 60 V346" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 5"/>${text(xOf(t0) + 8, 76, 'stand up', 'sm', 'start')}` +
    `<path class="ghost" data-ghost="without reflex" data-low="${m0.toFixed(4)}" d="${path(false)}" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="7 5"/>` +
    `<path data-new-state="with reflex" data-low="${m1.toFixed(4)}" d="${path(true)}" fill="none" stroke="${BLUE}" stroke-width="5" stroke-linejoin="round"/>` +
    `<g class="ghost"><path d="M80 412 H114" stroke="${INK}" stroke-width="3" stroke-dasharray="7 5"/></g>${text(122, 419, 'without the reflex', 'sm', 'start')}<path d="M80 438 H114" stroke="${BLUE}" stroke-width="5"/>${text(122, 445, 'with the reflex', 'sm blue', 'start')}`;
}

// Plain-word comparison with normal (used for chips and text alternatives).
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o) {
  return [
    ['Pressure', trend(o.map, BASE.map, 'higher', 'lower')],
    ['Heart rate', trend(o.hr, BASE.hr, 'faster', 'slower')],
    ['Flow', trend(o.co, BASE.co, 'more', 'less')],
    ['Resistance', trend(o.tpr, BASE.tpr, 'higher', 'lower')],
    ['Blood volume', trend(o.vol, BASE.vol, 'more', 'less')]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = o => `<ul class="readout" aria-label="Compared with normal">${compare(o).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()} ${w}`).join(', ');

/* ---------- Lesson steps ---------- */
const BUILD = ['loop', 'gauge', 'beats'];
const CORE = {
  loop: () => svg('The circulation as a loop: the heart pumps blood into arteries, through small vessels in the body tissues, and back through veins.', circuit(BASE, { parts: ['loop'], early: true })),
  pressure: () => svg('A pressure dial sits on the artery leaving the heart; its needle points to the middle, the normal push.', circuit(BASE, { parts: ['loop', 'gauge'], early: true })),
  wave: () => svg('Arterial pressure over time rises sharply with each heartbeat to a peak, the systolic pressure, then falls to a low point, the diastolic pressure. A line through the middle marks the mean pressure.', wave()),
  flow: () => svg('The loop with the heartbeat trace beneath it. Arrows in the artery mark the flow the heart sends out with each beat.', circuit(BASE, { parts: BUILD, marks: [spot('flow', 'flow')], early: true })),
  resist: () => svg('The arterioles, the smallest arteries, ringed with muscle, are circled: their width sets the resistance to flow.', circuit(BASE, { parts: BUILD, marks: [spot('arterioles', 'resistance')] })),
  hose: () => svg('Two garden hoses. Left: more water flowing in moves the pressure dial up from its dashed starting position. Right: a narrower nozzle also moves the dial up.', hose()),
  volume: () => svg('The veins returning blood to the heart are circled: blood volume fills them and sets how much blood returns.', circuit(BASE, { parts: BUILD, marks: [spot('veins', 'blood volume')] })),
  sensor: () => svg('A stretch sensor on the artery sends signals along a dotted nerve to the brainstem.', circuit(BASE, { parts: [...BUILD, 'sensor'] })),
  nerves: () => svg('From the brainstem, nerves run to the heart, the arterioles and the veins.', circuit(BASE, { parts: ALL })),
  whole: () => svg('The whole picture: heart, arteries with a pressure dial, arterioles, veins, the beat trace, the pressure sensor, the brainstem and its nerves to the heart and vessels.', circuit(BASE, { parts: ALL }))
};
const CHANGE_INFO = {
  ccb: { legend: 'with the drug', marks: [spot('arterioles', 'acts here')] },
  alpha1: { legend: 'with the drug', marks: [spot('arterioles', 'acts here'), spot('veins', 'and here')] },
  alpha2: { legend: 'with the drug', marks: [spot('brainstem', 'acts here')] },
  beta: { legend: 'with the drug', marks: [spot('heart', 'acts here')] },
  vasodilator: { legend: 'with the drug', marks: [spot('arterioles', 'acts here')] },
  hemorrhage: { legend: 'after blood loss', marks: [spot('veins', 'less blood')] }
};
function changePicture(el, t) {
  const kind = el.dataset.kind, info = CHANGE_INFO[kind];
  const ease = 1 - Math.pow(1 - t, 3);
  const o = steady(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease));
  const name = el.dataset.stepTitle.split(':')[0];
  return svg(`${name}, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.`, circuit(o, { parts: ALL, ghost: BASE, legend: info.legend, marks: t >= 1 || reducedMotion() ? info.marks : [] })) + readout(o);
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frame = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind === 'reflex' || el.dataset.kind in CHANGE_INFO;
function drawAt(el, t) {
  visualOf(el).innerHTML = el.dataset.kind === 'reflex'
    ? svg('Pressure over time after standing up. Without the reflex (dashed) pressure drops and stays low. With the reflex (blue) it dips, then recovers most of the way toward normal within seconds.', reflexChart(t))
    : changePicture(el, t);
}
function animate(el) {
  cancelAnimationFrame(frame);
  if (reducedMotion()) { drawAt(el, 1); return; }
  const duration = el.dataset.kind === 'reflex' ? 2600 : 1400;
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / duration);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
steps.forEach(el => {
  const kind = el.dataset.kind;
  if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
  else drawAt(el, 1);
  el.querySelector('.replay')?.addEventListener('click', () => animate(el));
});
function showStep(n, focus = false) {
  cancelAnimationFrame(frame);
  current = clamp(n, 0, steps.length - 1);
  steps.forEach((el, i) => { el.hidden = i !== current; });
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === steps.length - 1 ? 'Start again ↻' : 'Next →';
  progress.textContent = `Step ${current + 1} of ${steps.length}`;
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  const el = steps[current];
  if (isAnimated(el)) animate(el);
  if (focus) { const h = el.querySelector('h2'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }
}
nextBtn.addEventListener('click', () => showStep(current === steps.length - 1 ? 0 : current + 1, true));
backBtn.addEventListener('click', () => showStep(current - 1, true));
$('#lesson').addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight' && current < steps.length - 1) { e.preventDefault(); showStep(current + 1, true); }
  if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); showStep(current - 1, true); }
});

/* ---------- Tabs ---------- */
const tabs = $$('[role=tab]');
function activate(tab, focus = false) {
  tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
  if (focus) tab.focus();
  if (tab.id === 'tab-lesson') { if (isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
  update();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => activate(t));
  t.addEventListener('keydown', e => {
    const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (n !== undefined) { e.preventDefault(); activate(tabs[n], true); }
  });
});
function fromHash() {
  const m = location.hash.match(/^#step-(\d+)$/);
  if (m) { if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]); showStep(Number(m[1]) - 1); }
}
window.addEventListener('hashchange', fromHash);
if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(0);

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['vol', 'art', 'central', 'beta', 'alpha'];
const level = v => v < .97 ? 'lower' : v > 1.03 ? 'higher' : 'normal';
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(params[k]); }
  $('#clinical-volume').value = params.vol;
  $('#clinical-volume-label').textContent = level(params.vol);
  $('#reflex').checked = $('#clinical-reflex').checked = params.reflex;
}
const reference = id => { const v = data.values.find(x => x.id === id); return v.typical ?? (v.low + v.high) / 2; };
// Physical units, consistent with each other: flow (mL/s) = heart rate × stroke volume / 60, and
// mean pressure (mmHg) = flow × resistance (PRU, mmHg per mL/s), with venous pressure taken as zero.
// The baseline uses the textbook heart rate, stroke volume and mean pressure; its resistance is whatever
// those three require (so it differs from the textbook's rounded resistance example, as the tab explains).
function baselineUnits() {
  const T = reference, flow = T('hr') * T('sv') / 60;
  return { flow, resistance: T('map') / flow, compliance: T('sv') / (T('sbp') - T('dbp')) };
}
function measures(o) {
  const T = reference, B = baselineUnits();
  const hr = o.hr * T('hr'), sv = o.sv * T('sv'), flow = hr * sv / 60, tpr = o.tpr * B.resistance, map = flow * tpr;
  const pulse = sv / B.compliance; // the arteries' stretchiness turns each beat's volume into the pressure swing
  return { map, sbp: map + pulse / 2, dbp: map - pulse / 2, hr, sv, flow, co: hr * sv / 1000, tpr };
}
const DECIMALS = { co: 1, tpr: 2 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ No direct change', variable: '↕ Variable' };
function update() {
  syncControls();
  const o = steady(params);
  $('#explore-visual').innerHTML = svg(`Illustrative model with your settings, drawn over a faint dashed picture of normal. Compared with normal: ${describe(o)}.`, circuit(o, { parts: ALL, ghost: BASE, legend: 'your settings' })) + readout(o);
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: pressure ×${o.map.toFixed(2)} · heart rate ×${o.hr.toFixed(2)} · flow ×${o.co.toFixed(2)} · resistance ×${o.tpr.toFixed(2)}`;
    return;
  }
  const m = measures(o), unit = id => data.values.find(v => v.id === id).unit;
  $('#model-results').textContent = `Illustrative model: mean pressure ${fmt('map', m.map)} ${unit('map')} = flow ${m.flow.toFixed(1)} mL/s × resistance ${fmt('tpr', m.tpr)} ${unit('tpr')} · heart rate ${fmt('hr', m.hr)} ${unit('hr')} · cardiac output ${fmt('co', m.co)} ${unit('co')}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    const typical = v.typical ?? (v.low + v.high) / 2, max = (v.high ?? typical) * 2, pos = n => f(20 + clamp(n / max, 0, 1) * 360);
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const marker = row.querySelector('.marker'); marker.setAttribute('x1', pos(val)); marker.setAttribute('x2', pos(val));
    let status;
    if (v.low !== null && v.high !== null) status = val < v.low ? 'below typical range' : val > v.high ? 'above typical range' : 'within typical range';
    else { const r = val / typical; status = r > 1.015 ? 'above the textbook typical value' : r < .985 ? 'below the textbook typical value' : 'at the textbook typical value'; }
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id];
    row.querySelector('.direction').textContent = state ? (d ? DIRECTION[d] : 'Not listed for this state') : '';
  }
}
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; update(); });
$('#reflex').addEventListener('change', e => { params.reflex = e.target.checked; update(); });
$('#clinical-reflex').addEventListener('change', e => { params.reflex = e.target.checked; update(); announce(); });
$('#clinical-volume').addEventListener('input', e => {
  params.vol = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s
    ? `Custom settings: ${s.label} with blood volume adjusted by hand. The arrows still describe ${s.label.toLowerCase()} alone.`
    : 'Custom settings: blood volume adjusted by hand.';
  update(); announce();
});
$('#reset').addEventListener('click', () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; update(); });
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(CHANGES[id] || {}), reflex: params.reflex };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { if (data) { const m = measures(steady(params)); $('#cv-live').textContent = `Model mean arterial pressure ${fmt('map', m.map)}, heart rate ${fmt('hr', m.hr)}, cardiac output ${fmt('co', m.co)}.`; } }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['map', 'sbp', 'dbp', 'hr', 'sv', 'co', 'tpr']) {
      const v = loaded.values?.find(x => x.id === id);
      const ok = v && (Number.isFinite(v.typical) && v.typical > 0 || Number.isFinite(v.low) && Number.isFinite(v.high) && v.high >= v.low && v.low > 0);
      if (!ok) throw new Error('Invalid reference data');
    }
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    const B = baselineUnits(), m0 = measures(BASE), tprRef = data.values.find(v => v.id === 'tpr');
    $('#baseline-note').textContent = `How the model’s baseline differs from the references: it is built from the textbook heart rate (${reference('hr')} beats/min), stroke volume (${reference('sv')} mL) and mean pressure (${reference('map')} mmHg). That heart rate and stroke volume give ${fmt('co', m0.co)} L/min, or ${B.flow.toFixed(1)} mL/s. Mean pressure always equals flow × resistance here (venous pressure taken as zero), so at that flow the model’s resistance is ${fmt('tpr', B.resistance)} PRU, above the textbook’s ${tprRef.typical} PRU example, which uses a rounded-up resting flow (see the resistance citation). Systolic and diastolic pressures sit half a pulse swing above and below the mean, an illustrative simplification.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.label} (${s.kind})`; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const typical = v.typical ?? (v.low + v.high) / 2, max = (v.high ?? typical) * 2, pos = n => f(20 + clamp(n / max, 0, 1) * 360);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = v.low !== null && v.high !== null ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: textbook typical value and the current illustrative model marker`);
      right.querySelector('.key').textContent = `Textbook: ${v.low !== null && v.high !== null ? `${v.low}–${v.high}` : `about ${v.typical}`} ${v.unit} (${v.low !== null ? 'shaded band' : 'black line'}) · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'Source'; li.append(' · ', a); }
      $('#sources').append(li);
    }
    const li = document.createElement('li');
    li.textContent = 'Directions for each drug or condition: ' + data.states.map(s => `${s.label}: ${s.where} [${s.source}]`).join(' ');
    $('#sources').append(li);
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
  update();
}
update();
load();
