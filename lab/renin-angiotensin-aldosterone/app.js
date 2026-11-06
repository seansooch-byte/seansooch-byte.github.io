// Lesson 5: The renin-angiotensin-aldosterone system. The kit (/lab/kit/kit.js) runs the page; this file
// is the teaching model, the pictures, and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease as EASE, span, svg, text, lines, circle, rect, path, arrowTo, part, readout, esc } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ease = EASE.out, easeIO = EASE.inOut;
const frac = x => x - Math.floor(x);

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means the normal resting state. No clinical numbers live here;
   the Clinical values tab multiplies these ratios by the textbook values in clinical-values.json. */
const NORMAL = { salt: 1, dri: 1, ace: 1, arb: 1, mra: 1, tumor: 0, feedback: true };
const CHANGES = {
  ace: { ace: .2 },        // ACE converts only a fifth as much angiotensin I
  arb: { arb: .2 },        // only a fifth of angiotensin II receptors are free
  mra: { mra: .25 },       // aldosterone's receptors are mostly blocked
  dri: { dri: .2 }         // renin cuts only a fifth as much angiotensinogen
};
const FEEDBACK_GAIN = 8;

// The chain for a given pressure as the kidney senses it.
function chain(p, sensed) {
  const S = p.feedback ? clamp(Math.exp(FEEDBACK_GAIN * (1 - sensed)), .05, 12) : 1; // renin released
  const Ract = S * p.dri;              // renin at work
  const A1 = Ract;                     // angiotensinogen never runs out, so angiotensin I follows working renin
  const A2 = A1 * p.ace;               // ACE converts angiotensin I to angiotensin II
  const E = A2 * p.arb;                // angiotensin II signal reaching cells through free receptors
  const aldo = .3 + .7 * E + p.tumor;  // aldosterone released: a resting floor, angiotensin II's call, and any tumor
  const act = aldo * p.mra;            // aldosterone's effect through free receptors
  const R = .5 * act + .5 * E;         // salt kept: aldosterone, plus angiotensin II acting on the kidney directly
  const V = (.9 + .1 * p.salt) * Math.pow(R, .2);
  const T = .75 + .25 * Math.sqrt(E);  // arteriole resistance
  const P = V * V * T;
  const K = clamp(1 - .1 * Math.log(act), .6, 1.6);
  const Na = 1 + .008 * Math.log(act); // water follows salt, so sodium concentration barely moves
  return { S, Ract, A1, A2, E, aldo, act, R, V, T, P, K, Na };
}
// Steady state: the pressure the chain produces equals the pressure the kidney senses.
// Produced pressure never rises as sensed pressure rises, so bisection finds the single crossing.
function steady(p) {
  let lo = .2, hi = 3;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (chain(p, mid).P > mid) lo = mid; else hi = mid; }
  return chain(p, (lo + hi) / 2);
}
const BASE = steady(NORMAL);
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing vocabulary ----------
   Enzymes (renin, ACE) are green mouths that cut; angiotensin I is a short chain of pale beads, angiotensin II
   a shorter chain of solid blue beads; aldosterone is a green hexagon; sodium an amber diamond and potassium a
   purple circle, as in Lesson 2. */
const ORGAN = '#f6dcd8', GLAND = '#f3e3b5', PALE = C.blueWash;
const bead = (x, y, kind, r = 7) => kind === 'two' ? circle(x, y, r, C.blue, C.ink, 1.5)
  : kind === 'one' ? circle(x, y, r, PALE, C.blue, 2) : circle(x, y, r, '#fff', C.ink, 1.5);
// A chain of n beads from (x, y), each step (dx, dy).
const chainOf = (x, y, n, kind, dx = 16, dy = 0, r = 7) => Array.from({ length: n }, (_, i) => bead(x + i * dx, y + i * dy, typeof kind === 'function' ? kind(i) : kind, r)).join('');
// An enzyme: a green disc with a mouth; open runs from 0 (shut) to 1 (wide).
function mouth(x, y, r = 15, angle = 0, open = .7) {
  const a = (12 + 30 * open) * Math.PI / 180, rot = angle * Math.PI / 180;
  const p1 = [x + r * Math.cos(rot + a), y + r * Math.sin(rot + a)], p2 = [x + r * Math.cos(rot - a), y + r * Math.sin(rot - a)];
  return `<path d="M${f(x)} ${f(y)} L${f(p1[0])} ${f(p1[1])} A${r} ${r} 0 1 1 ${f(p2[0])} ${f(p2[1])} Z" fill="${C.green}" stroke="#fff" stroke-width="1.5"/>`;
}
const hex = (x, y, r = 8, extra = '') => `<path d="${Array.from({ length: 6 }, (_, i) => { const t = (i * 60 + 30) * Math.PI / 180; return `${i ? 'L' : 'M'}${f(x + r * Math.cos(t))} ${f(y + r * Math.sin(t))}`; }).join('')}Z" fill="${C.green}" stroke="#fff" stroke-width="1.5" ${extra}/>`;
const na = (x, y, r = 6, extra = '') => `<path d="M${f(x)} ${f(y - r)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r)}L${f(x - r)} ${f(y)}Z" fill="${C.amber}" stroke="#fff" stroke-width="1.2" ${extra}/>`;
const kion = (x, y, r = 6, extra = '') => circle(x, y, r, C.purple, '#fff', 1.2, extra);
const drop = (x, y, r = 5.5, extra = '') => `<path d="M${f(x)} ${f(y - r * 1.35)}C${f(x + r * .5)} ${f(y - r * .6)} ${f(x + r)} ${f(y)} ${f(x + r)} ${f(y + r * .4)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y + r * .4)}C${f(x - r)} ${f(y)} ${f(x - r * .5)} ${f(y - r * .6)} ${f(x)} ${f(y - r * 1.35)}Z" fill="${C.blue}" stroke="#fff" stroke-width="1.2" ${extra}/>`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
// Chevrons along a vessel, moving with t.
const chevrons = (x0, x1, y, dir, t, col = '#fff') => {
  let s = '';
  const step = 46, off = frac(t * 2) * step;
  for (let x = x0 + (dir > 0 ? off : step - off); x < x1; x += step) s += path(`M${f(x - dir * 6)} ${y - 6} L${f(x)} ${y} L${f(x - dir * 6)} ${y + 6}`, col, 3);
  return s;
};
// A pressure dial; value is relative pressure (1 normal); ghost draws a dashed normal needle.
const needleAngle = P => clamp((P - 1) * 4, -1, 1) * 70;
function dial(cx, cy, r, P, { ghost = null, labels = true } = {}) {
  let s = `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`;
  s += [-60, -30, 0, 30, 60].map(a => { const t = a * Math.PI / 180; return path(`M${f(cx + (r - 9) * Math.sin(t))} ${f(cy - (r - 9) * Math.cos(t))} L${f(cx + (r - 2) * Math.sin(t))} ${f(cy - (r - 2) * Math.cos(t))}`, C.ink, 2); }).join('');
  if (ghost !== null) s += `<g class="ghost" data-ghost="normal">${path(`M${cx} ${cy} V${cy - r + 10}`, C.ink, 3, `transform="rotate(${f(needleAngle(ghost))} ${cx} ${cy})" stroke-dasharray="5 4"`)}</g>`;
  s += path(`M${cx} ${cy} V${cy - r + 8}`, C.blue, 5, `transform="rotate(${f(needleAngle(P))} ${cx} ${cy})"`) + circle(cx, cy, 5, C.ink);
  if (labels) s += text(cx - r - 4, cy + 20, 'low', 'xs', 'middle') + text(cx + r + 4, cy + 20, 'high', 'xs', 'middle');
  return s;
}
// A level bar with an optional dashed normal outline.
function bar(x, y, w, level, ghostLevel = null, h = 14) {
  let s = rect(x, y, w, h, '#fff', '#babeb3', 1) + rect(x, y, f(w * clamp(level, .02, 1)), h, C.blue);
  if (ghostLevel !== null) s += `<g class="ghost" data-ghost="normal">${rect(x, y - 3, f(w * clamp(ghostLevel, .02, 1)), h + 6, 'none', C.ink, 2, 'stroke-dasharray="5 4"')}</g>`;
  return s;
}
const lvl = L => clamp(.4 * Math.pow(Math.max(L, 0), .7), .02, 1);
const KIDNEY = 'M140 60 C70 60 38 130 42 196 C46 268 90 318 150 316 C200 314 226 290 222 262 C219 240 200 230 198 212 C196 194 200 180 216 170 C236 156 236 124 220 98 C204 74 176 60 140 60 Z';
const block = (x, y, a = 1) => `<g data-block data-part="block" ${fade(a)}>${circle(x, y, 12, '#fff', C.red, 3.5)}${path(`M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`, C.red, 3.5)}</g>`;

// A filled outline (draw.js path() is for lines, with no fill).
const shape = (d, fill, stroke = C.ink, w = 2, extra = '') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
// Points spread along a polyline, for particles riding a path.
function rider(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return s => {
    const d = clamp(s, 0, 1) * cum.at(-1);
    let j = 0;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const k = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    return [lerp(pts[j][0], pts[j + 1][0], k), lerp(pts[j][1], pts[j + 1][1], k)];
  };
}

/* ---------- Steps 1 and 2: the kidney watches pressure, and releases renin ---------- */
const LOW = .85;   // step 2: the kidney senses a fall in pressure
function kidneyCloseUp(t, { P = 1, ghost = null, renin = null, reninLevel = null, reninGhost = null } = {}) {
  let b = part('kidney', shape(KIDNEY, ORGAN, C.red, 3) + text(122, 196, 'kidney', 'lg b'));
  // Blood in through the artery, out through the vein.
  b += path('M474 180 H210', C.red, 20) + chevrons(214, 474, 180, -1, t);
  b += path('M210 222 H474', '#5d6270', 18) + chevrons(214, 474, 222, 1, t);
  b += text(296, 160, 'blood in', 'sm b', 'start') + text(474, 258, 'blood out', 'sm b', 'end');
  // The pressure sensors, in the walls of the small vessels that feed each filter.
  b += part('sensor', [[208, 194], [218, 202], [206, 207], [220, 190]].map(([x, y]) => circle(x, y, 6, C.green, '#fff', 1.5)).join('')
    + path('M212 214 L204 330', C.green, 1.5, 'stroke-dasharray="3 3"') + text(204, 352, 'sensor cells in the small vessels', 'xs b green'));
  // The dial on the artery.
  b += path('M380 120 V170', C.ink, 3) + part('pressure', dial(380, 116, 46, P, { ghost }) + text(380, 52, 'blood pressure', 'sm b'));
  // Renin leaves in the blood: a steady stream once it starts (renin: 0..1 since release began).
  if (renin !== null) {
    let r = '';
    for (let i = 0; i < 7; i++) { const q = renin * 1.5 - i / 7; if (q > 0) r += mouth(lerp(234, 470, frac(q)), 222 + 3 * Math.sin(i * 2.1), 7, 0, .6); }
    b += part('renin', r);
  }
  if (reninLevel !== null) b += part('renin', text(250, 300, 'renin released', 'sm b green', 'start') + bar(250, 310, 210, reninLevel, reninGhost));
  return b;
}
const watchScene = t => svg('Close-up of one kidney. Blood flows in through an artery and out through a vein. A dial on the artery shows the blood pressure, its needle in the middle and twitching with each heartbeat. Green sensor cells sit in the walls of the small vessels feeding the filters.',
  kidneyCloseUp(t, { P: 1 + .03 * Math.max(0, Math.sin(t * Math.PI * 8)) }), { h: 364 });
function reninScene(t) {
  const fall = easeIO(span(t, .05, .35)), P = lerp(1, LOW, fall), S = chain(NORMAL, P).S;
  let b = kidneyCloseUp(t * .6, { P, ghost: 1, renin: span(t, .35, 1), reninLevel: lvl(lerp(1, S, ease(span(t, .35, .8)))), reninGhost: lvl(1) });
  b += `<g ${fade(span(t, .2, .35))}>${text(318, 112, 'falls', 'xs b blue', 'end')}</g>`;
  return svg('The same kidney close-up. The pressure needle falls below its dashed normal position. Green renin then streams out of the sensor cells into the blood leaving the kidney, and the renin bar grows past its dashed normal length.', b, { h: 364 });
}

/* ---------- Step 3: renin cuts angiotensinogen ---------- */
function cutScene(t) {
  const reach = easeIO(span(t, .05, .4)), snip = span(t, .4, .5), away = easeIO(span(t, .5, .85));
  const y0 = 128, x0 = 160, dx = 15, cut = 11, cx = x0 + (cut - .5) * dx;
  let b = shape('M18 120 C30 86 96 80 132 96 C150 104 152 132 134 148 C114 166 60 172 34 160 C14 150 8 136 18 120 Z', ORGAN, C.red, 3) + text(80, 134, 'liver', 'sm b');
  b += text(160, 74, 'angiotensinogen:', 'sm b', 'start') + text(160, 98, 'a long protein from the liver', 'xs', 'start');
  // The long chain; its last ten beads are the piece renin cuts off.
  b += part('angiotensinogen', path(`M146 ${y0} H${x0}`, C.ink, 2) + chainOf(x0, y0, cut, 'gen', dx));
  const piece = chainOf(x0 + cut * dx + away * 6, y0 + away * 100, 10, 'one', dx);
  b += away < .02 ? part('angiotensinogen', piece) : part('ang1', piece);
  // Renin rises from the blood below and snips.
  const ry = lerp(300, y0 + 28, reach);
  b += part('renin', mouth(cx, ry, 16, -90, .8 - .7 * Math.sin(snip * Math.PI)) + text(cx - 26, ry + 7, 'renin', 'sm b green', 'end'));
  if (snip > .3) b += path(`M${f(cx)} ${y0 - 18} V${y0 + 16}`, C.green, 2.5, `stroke-dasharray="4 3" ${fade(1 - away)}`);
  b += `<g ${fade(span(t, .7, .95))}>${part('ang1', text(392, 276, 'angiotensin I', 'b blue'))}${text(392, 300, 'does little by itself', 'xs')}</g>`;
  return svg('The liver releases angiotensinogen, drawn as a long chain of beads. Green renin rises from below and snips the last ten beads off its end. That short piece, angiotensin I, drifts away; it does little by itself.', b, { h: 318 });
}

/* ---------- Step 4: ACE in the lungs makes angiotensin II (a cycle) ---------- */
function aceScene(t) {
  let b = text(240, 32, 'a blood vessel in the lungs', 'sm b');
  b += rect(14, 104, 452, 132, ORGAN) + path('M14 104 H466', C.red, 4) + path('M14 236 H466', C.red, 4);
  b += part('ace', [140, 240, 340].map(x => mouth(x, 117, 13, 90, .55)).join('') + text(240, 92, 'ACE on the lining', 'xs b green'));
  // Two chains in flight: one still angiotensin I, one already trimmed to angiotensin II.
  const y = 178, gap = 14, at = 240;
  let one = '', two = '';
  for (const off of [.25, .75]) {
    const lead = lerp(-40, 620, frac(t + off));
    if (lead < at) { one += chainOf(lead, y, 10, 'one', -gap, 0, 6); continue; }
    const q = clamp((lead - at) / 160, 0, 1);
    for (let i = 0; i < 2; i++) one += bead(at + 14 * i + 30 * q, y - 18 - 46 * q - 8 * i, 'one', 6).replace('/>', ` ${fade(1 - q)}/>`);
    two += chainOf(lead - 2 * gap, y, 8, 'two', -gap, 0, 6);
  }
  b += part('ang1', one + text(100, 272, 'angiotensin I', 'sm b') + text(100, 294, 'flows in', 'xs'));
  b += part('ang2', two + text(380, 272, 'angiotensin II', 'sm b blue') + text(380, 294, 'the active hormone', 'xs'));
  b += text(240, 330, 'ACE trims off two pieces', 'xs b green');
  return svg('A blood vessel in the lungs, its lining carrying green ACE. Pale chains of ten beads, angiotensin I, flow in from the left; at ACE two beads are trimmed off, and solid blue chains of eight beads, angiotensin II, the active hormone, flow on to the right.', b, { h: 344 });
}

/* ---------- Step 5: a messenger needs a receptor ---------- */
function receptorScene(t) {
  const membrane = (x0, x1) => {
    let s = rect(x0, 236, x1 - x0, 130, ORGAN) + path(`M${x0} 236 H${x1} M${x0} 256 H${x1}`, C.red, 2.5);
    for (let x = x0 + 8; x < x1; x += 16) s += circle(x, 236, 4, '#fff', C.red, 1.5) + circle(x, 256, 4, '#fff', C.red, 1.5);
    return s;
  };
  const dock = easeIO(span(t, .05, .5)), answer = span(t, .5, .8);
  let b = membrane(14, 228) + membrane(252, 466) + path('M240 30 V370', '#babeb3', 2);
  b += text(121, 34, 'a cell with', 'sm b') + text(121, 56, 'the receptor', 'sm b') + text(359, 34, 'a cell without', 'sm b') + text(359, 56, 'the receptor', 'sm b');
  b += part('receptor', shape('M95 196 V250 A26 26 0 0 0 147 250 V196', '#ecefe5', C.ink, 5) + text(28, 184, 'receptor', 'xs b', 'start') + path('M62 190 L92 206', C.ink, 1.5));
  const rTop = lerp(92, 150, dock);
  b += part('ang2', chainOf(121, lerp(92, 202, dock), 8, 'two', 0, 7, 6) + chainOf(359, rTop, 8, 'two', 0, 7, 6) + text(359, rTop - 14, 'angiotensin II', 'xs b blue'));
  b += `<g ${fade(answer)}>${text(150, 214, 'docks', 'xs b', 'start')}${[[-34, 330], [0, 342], [34, 330]].map(([dx, y]) => arrowTo(121 + dx * .3, 290, 121 + dx, y, C.blue, 3.5)).join('')}${text(121, 362, 'the cell answers', 'sm b on-organ')}</g>`;
  b += `<g ${fade(answer)}>${text(359, 314, 'no receptor:', 'sm b on-organ')}${text(359, 338, 'nothing happens', 'sm b on-organ')}</g>`;
  return svg('Two cells side by side. On the left, a blue chain of angiotensin II drops into a cup-shaped receptor in the cell surface, like a key into a lock, and arrows show the cell answering. On the right, a cell with no receptor: the same messenger stops above it and nothing happens.', b, { h: 378 });
}

/* ---------- Step 6: it squeezes the smallest arteries ---------- */
function squeezeScene(t) {
  const k = easeIO(span(t, .25, .7)), w = lerp(64, 30, k), P = lerp(1, 1.14, k), yc = 196;
  let b = part('arteriole', rect(20, yc - w / 2 - 12, 300, w + 24, '#e7c9a8', 'none', 0, 'rx="10"') + rect(20, yc - w / 2, 300, w, C.red)
    + [58, 108, 158, 208, 258].map(x => `<ellipse cx="${x}" cy="${yc}" rx="9" ry="${f(w / 2 + 14)}" fill="none" stroke="#8a5a2b" stroke-width="3"/>`).join(''));
  b += `<g class="ghost" data-ghost="normal">${path(`M20 ${yc - 32} H320 M20 ${yc + 32} H320`, C.ink, 2, 'stroke-dasharray="6 5"')}</g>`;
  b += chevrons(24, 316, yc, 1, t * .5);
  b += text(20, 90, 'an arteriole, ringed', 'sm b', 'start') + text(20, 112, 'with muscle', 'sm b', 'start');
  const land = easeIO(span(t, 0, .25));
  b += part('ang2', [83, 183].map(x => chainOf(x, lerp(124, yc - 44, land) - 30, 5, 'two', 0, 7, 5)).join('') + text(198, 128, 'angiotensin II', 'xs b blue', 'start'));
  b += `<g ${fade(span(t, .4, .7))}>${text(170, 296, 'muscle tightens: narrower,', 'xs b')}${part('resistance', text(170, 320, 'harder to get through', 'sm b'))}</g>`;
  b += part('pressure', dial(404, 186, 44, P, { ghost: 1 }) + text(404, 122, 'blood pressure', 'sm b'));
  b += `<g ${fade(span(t, .55, .8))}>${text(404, 246, 'rises', 'sm b blue')}</g>`;
  return svg('An arteriole, a small vessel ringed with muscle, with blood flowing through. Blue angiotensin II lands on its outside; the muscle tightens and the vessel narrows inside its dashed normal width, so blood finds it harder to get through. A blood pressure dial beside it rises above its dashed normal position.', b, { h: 340 });
}

/* ---------- Step 7: it calls out aldosterone ---------- */
const ALDO_PATH = rider([[178, 128], [262, 150], [300, 200], [292, 268], [214, 300]]);
function adrenalScene(t) {
  const land = easeIO(span(t, .02, .3)), out = span(t, .32, 1);
  let b = part('kidney', shape(KIDNEY, ORGAN, C.red, 3, 'transform="translate(10 84) scale(.8)" vector-effect="non-scaling-stroke"') + text(118, 254, 'kidney', 'lg b'));
  b += part('adrenal', shape('M58 152 L118 62 L180 140 C150 126 92 130 58 152 Z', GLAND, '#7a5c00', 2.5) + text(118, 42, 'adrenal gland', 'sm b'));
  b += part('ang2', chainOf(lerp(330, 194, land), 100, 8, 'two', 12, 0, 5.5)) + text(318, 76, 'angiotensin II', 'xs b blue', 'start');
  let h = '';
  for (let i = 0; i < 8; i++) { const q = out * 1.6 - i / 8; if (q > 0) { const [x, y] = ALDO_PATH(frac(q)); h += hex(x, y, 8); } }
  b += part('aldosterone', h + `<g ${fade(span(t, .4, .6))}>${text(318, 200, 'aldosterone', 'sm b green', 'start')}${text(318, 222, 'in the blood,', 'xs', 'start')}${text(318, 243, 'back to the kidney', 'xs', 'start')}</g>`);
  return svg('A kidney with an adrenal gland sitting on top like a cap. Blue angiotensin II arrives and docks on the gland. Green hexagons of aldosterone then stream out of the gland into the blood and travel back round to the kidney.', b, { h: 344 });
}

/* ---------- Step 8: aldosterone holds on to salt ---------- */
function saltScene(t) {
  let b = rect(14, 60, 150, 236, C.blueWash) + rect(316, 60, 150, 236, ORGAN) + rect(172, 60, 136, 236, '#fff7e8', C.ink, 2, 'rx="12"');
  b += text(89, 44, 'inside the tube', 'sm b') + text(391, 44, 'blood', 'sm b') + text(240, 44, 'tube cell', 'sm b');
  b += part('nephron', text(89, 318, 'end of a nephron:', 'xs') + text(89, 338, 'becomes urine', 'xs'));
  const inA = easeIO(span(t, .02, .25)), go = span(t, .25, 1);
  b += part('aldosterone', shape('M226 168 V184 A14 14 0 0 0 254 184 V168', 'none', C.green, 3) + hex(lerp(430, 240, inA), lerp(110, 184, inA), 10)
    + text(240, 222, 'aldosterone', 'xs b green'));
  // Sodium is taken from the tube into the blood; potassium goes the other way, into the urine.
  b += `<g ${fade(span(t, .25, .4))}>${arrowTo(40, 118, 440, 118, C.amber, 3)}${arrowTo(440, 262, 40, 262, C.purple, 3)}</g>`;
  let s = '', k = '';
  for (let i = 0; i < 5; i++) { const q = go * 1.4 - i / 5; if (q > 0) s += na(lerp(30, 450, frac(q)), 118); }
  for (let i = 0; i < 3; i++) { const q = go * 1.2 - .1 - i / 3; if (q > 0) k += kion(lerp(450, 30, frac(q)), 262); }
  b += part('sodium', s + text(89, 104, 'sodium', 'xs b amber')) + part('potassium', k + text(391, 248, 'potassium', 'xs b purple'));
  b += `<g ${fade(span(t, .4, .6))}>${text(240, 340, 'sodium kept,', 'sm b amber')}${text(240, 362, 'potassium sent out', 'sm b purple')}</g>`;
  return svg('Close-up of a cell in the wall near the end of a nephron: inside the tube on the left, blood on the right. A green aldosterone hexagon enters the cell from the blood and docks. Then amber sodium diamonds move along an arrow from the tube through the cell into the blood, while purple potassium circles move the other way, out into the urine.', b, { h: 372 });
}

/* ---------- Step 9: water follows the salt ---------- */
function volumeScene(t) {
  const fill = easeIO(span(t, .3, .85)), P = lerp(1, 1.12, fill);
  let b = text(20, 40, 'salt kept', 'sm b amber', 'start') + text(20, 62, 'water follows', 'sm b blue', 'start');
  for (let i = 0; i < 10; i++) {
    const q = t * 1.4 - i * .07;
    if (q <= 0) continue;
    const u = frac(q), x = lerp(30 + (i % 3) * 30, 220, u), y = lerp(96 + (i % 4) * 24, 230, u);
    b += i % 3 === 0 ? na(x, y, 6, fade(u < .85 ? 1 : (1 - u) / .15)) : drop(x, y, 5.5, fade(u < .85 ? 1 : (1 - u) / .15));
  }
  const top = lerp(250, 170, fill);
  b += part('blood-volume', rect(170, 110, 130, 210, '#fff', C.ink, 2, 'rx="14"') + rect(174, top, 122, 316 - top, C.red, 'none', 0, 'rx="10"'));
  b += `<g class="ghost" data-ghost="normal">${path('M160 250 H310', C.ink, 2, 'stroke-dasharray="6 4"')}</g>`;
  b += text(235, 96, 'blood volume', 'sm b') + `<g ${fade(span(t, .6, .85))}>${text(235, 346, 'fuller', 'sm b blue')}</g>`;
  b += part('pressure', dial(400, 228, 44, P, { ghost: 1 }) + text(400, 164, 'blood pressure', 'sm b'));
  b += `<g ${fade(span(t, .65, .9))}>${text(400, 290, 'pushes harder', 'xs b blue')}</g>`;
  b += arrowTo(306, 230, 350, 230, C.ink, 3);
  return svg('Amber salt and blue water drops keep flowing into a container of blood, which fills above its dashed normal level: blood volume grows. A blood pressure dial to the right rises above its dashed normal position.', b, { h: 360 });
}

/* ---------- The chain: steps 10 to 15, Clinical values and Explore freely ----------
   Two columns of links, each with a bar for how much there is (dashed: normal). Upstream on the left:
   renin, angiotensin I, angiotensin II; then angiotensin II's two jobs: narrowing arterioles (left) and
   calling out aldosterone (right), which keeps salt and water. Both raise blood pressure, which the kidney
   feels: the feedback line up the left side. */
const NODE = {
  renin: { x: 58, y: 36, name: 'renin', level: o => lvl(o.S) },
  ang1: { x: 58, y: 102, name: 'angiotensin I', level: o => lvl(o.A1) },
  ang2: { x: 58, y: 168, name: 'angiotensin II', level: o => lvl(o.A2) },
  arteriole: { x: 58, y: 234, name: 'arterioles narrow', level: o => clamp(.4 * Math.pow(o.T, 6), .03, 1) },
  pressure: { x: 58, y: 300, name: 'blood pressure', level: o => clamp(.4 * Math.pow(o.P, 4), .03, 1) },
  aldosterone: { x: 282, y: 168, name: 'aldosterone', level: o => lvl(o.aldo) },
  salt: { x: 282, y: 234, name: 'salt and water kept', level: o => clamp(.4 * Math.pow(o.R, 1.6), .03, 1) },
  potassium: { x: 282, y: 300, name: 'potassium in blood', level: o => clamp(.4 * Math.pow(o.K, 6), .03, 1) },
};
const BAR_W = 120;
const VALUE = { renin: o => o.S, ang1: o => o.A1, ang2: o => o.A2, arteriole: o => o.T, pressure: o => o.P, aldosterone: o => o.aldo, salt: o => o.R, potassium: o => o.K };
const BLOCKS = { dri: [[118, 77]], ace: [[118, 143]], arb: [[118, 209], [230, 162]], mra: [[342, 209]] };
const trend = (v, b) => v / b > 1.015 ? 'up' : v / b < .985 ? 'down' : 'same';   // the original lesson's threshold
// blockA: how far the red crosses have faded in; changeA: the same for the "more" and "less" words.
function chainMap(o, { ghost = null, blocks = [], words = '', blockA = 1, changeA = 1, signal = null, feedback = false, changes = false } = {}) {
  let s = '';
  // Links between the nodes.
  s += arrowTo(118, 64, 118, 84, C.ink, 2.5) + text(130, 80, 'cuts angiotensinogen', 'xs', 'start');
  s += arrowTo(118, 130, 118, 150, C.ink, 2.5) + text(130, 146, 'ACE, in the lungs', 'xs', 'start');
  s += arrowTo(118, 196, 118, 216, C.ink, 2.5) + arrowTo(186, 162, 272, 162, C.ink, 2.5);
  s += arrowTo(342, 196, 342, 216, C.ink, 2.5) + arrowTo(118, 262, 118, 282, C.ink, 2.5) + arrowTo(300, 262, 204, 292, C.ink, 2.5);
  // The feedback line: pressure felt by the kidney turns renin up or down.
  const fb = `M58 315 H24 V51 H50`;
  s += part('feedback', `<path d="${fb}" fill="none" stroke="${feedback ? C.blue : C.ink}" stroke-width="${feedback ? 4 : 2}" stroke-dasharray="${feedback ? '2 8' : '2 6'}" stroke-linecap="round" marker-end="url(#ah-${feedback ? 'b' : 'k'})"/>`
    + `<text transform="translate(15 183) rotate(-90)" text-anchor="middle" class="xs b${feedback ? ' blue' : ''}">felt by the kidney</text>`);
  // The nodes.
  for (const [k, n] of Object.entries(NODE)) {
    let nd = text(n.x, n.y, n.name, 'sm b', 'start') + bar(n.x, n.y + 8, BAR_W, n.level(o), ghost ? n.level(ghost) : null);
    if (changes && ghost) {
      const d = trend(VALUE[k](o), VALUE[k](ghost));
      if (d !== 'same') nd += text(n.x + BAR_W + 8, n.y + 21, d === 'up' ? '↑ more' : '↓ less', 'xs b blue', 'start', fade(changeA));
    }
    s += part(k, nd);
  }
  // A signal travelling down the relay, for the whole-chain step.
  if (signal !== null) {
    const legs = [[[118, 62], [118, 86]], [[118, 128], [118, 152]], [[186, 162], [272, 162]], [[342, 194], [342, 218]], [[300, 262], [204, 292]], [[58, 315], [24, 315], [24, 51], [50, 51]]];
    const leg = Math.floor(signal * legs.length) % legs.length, q = frac(signal * legs.length), pts = legs[leg];
    const seg = Math.min(pts.length - 2, Math.floor(q * (pts.length - 1))), u = q * (pts.length - 1) - seg;
    s += circle(lerp(pts[seg][0], pts[seg + 1][0], u), lerp(pts[seg][1], pts[seg + 1][1], u), 7, C.blue, '#fff', 2);
  }
  for (const [x, y] of blocks) s += block(x, y, blockA);
  if (ghost) s += `<g data-key>${path('M60 356 H88', C.ink, 3, 'stroke-dasharray="5 4"')}${text(96, 362, 'normal', 'xs', 'start')}${rect(176, 349, 28, 14, C.blue)}${text(212, 362, 'with the drug', 'xs', 'start')}</g>`;
  return s + words;
}
const CHAIN_H = 372;
const NAMES = { ace: 'ACE inhibitor', arb: 'Angiotensin receptor blocker', mra: 'Aldosterone antagonist', dri: 'Direct renin inhibitor' };
const CHANGE_WORDS = {
  ace: [['ACE blocked:', 'sm b red'], ['after it: less;', 'xs b'], ['before it: more,', 'xs b'], ['as the kidney', 'xs'], ['feels the drop', 'xs']],
  arb: [['dock blocked:', 'sm b red'], ['after it: less;', 'xs b'], ['before it: more,', 'xs b'], ['as the kidney', 'xs'], ['feels the drop', 'xs']],
  mra: [['its dock blocked:', 'sm b red'], ['after it: less;', 'xs b'], ['before it: more,', 'xs b'], ['as the kidney', 'xs'], ['feels the drop', 'xs']],
  dri: [['renin blocked:', 'sm b red'], ['after it: less;', 'xs b'], ['renin made: more,', 'xs b'], ['as the kidney', 'xs'], ['feels the drop', 'xs']],
};
const wordsAt = (rows, a) => `<g data-named ${fade(a)}>${rows.map(([w, cls], i) => text(318, 30 + i * 21 + (i ? 2 : 0), w, cls, 'start')).join('')}</g>`;
function compare(o, kind = '') {
  const t = (v, b, up, down) => { const d = trend(v, b); return [d === 'up' ? up : d === 'down' ? down : 'about the same', d]; };
  const rows = [['Renin released', t(o.S, BASE.S, 'more', 'less')]];
  if (kind === 'dri' || kind === 'explore') rows.push(['Renin at work', t(o.Ract, BASE.Ract, 'more', 'less')]);
  rows.push(['Angiotensin I', t(o.A1, BASE.A1, 'more', 'less')], ['Angiotensin II', t(o.A2, BASE.A2, 'more', 'less')]);
  if (kind === 'arb' || kind === 'explore') rows.push(['Angiotensin II signal', t(o.E, BASE.E, 'stronger', 'weaker')]);
  rows.push(['Aldosterone', t(o.aldo, BASE.aldo, 'more', 'less')]);
  rows.push(['Salt and water kept', t(o.R, BASE.R, 'more', 'less')], ['Blood volume', t(o.V, BASE.V, 'more', 'less')], ['Blood pressure', t(o.P, BASE.P, 'higher', 'lower')], ['Potassium', t(o.K, BASE.K, 'higher', 'lower')]);
  return rows;
}
const readoutOf = (o, kind) => readout(compare(o, kind).map(([k, [w, d]]) => [k, d, w]));
const describe = (o, kind) => compare(o, kind).map(([k, [w]]) => `${k.toLowerCase()} ${w}`).join(', ');

// Step 10: pressure climbs back to normal, and the kidney turns renin down.
function feedbackScene(t) {
  const k = easeIO(span(t, .08, .85)), sensed = lerp(LOW, 1, k), o = { ...chain(NORMAL, sensed), P: sensed };
  const words = `<g ${fade(span(t, .45, .8))}>${lines(318, 32, ['pressure climbs', 'back, so the', 'kidney releases', 'less renin:', 'negative feedback'], 'xs b', 'start', 21)}</g>`;
  return svg('The whole chain as two columns of bars, with a blue dotted feedback line running from blood pressure at the bottom back up to renin at the top. Pressure starts low and climbs back to normal; as it does, the renin bar shrinks, and every later link shrinks with it, back to its dashed normal length.',
    chainMap(o, { ghost: BASE, feedback: true, words }), { h: CHAIN_H });
}
function wholeScene(t) {
  const words = lines(318, 32, ['each link makes', 'the next; the', 'result is felt', 'back at the', 'kidney'], 'xs', 'start', 21);
  return svg('The whole chain as two columns. Renin cuts angiotensinogen into angiotensin I; ACE in the lungs makes angiotensin II; it narrows arterioles and calls out aldosterone, which keeps salt and water and lowers potassium in the blood; both raise blood pressure, which is felt back at the kidney. A blue dot travels the relay link by link.',
    chainMap(BASE, { signal: t, words }), { h: CHAIN_H });
}
function changeScene(kind) {
  return {
    duration: 3000,
    render(t) {
      const o = steady(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, easeIO(t)));
      const a = span(t, .55, .9);
      const label = `${NAMES[kind]}, drawn over dashed bars for normal. A red cross marks where the drug cuts the chain. Compared with normal: ${describe(o, kind)}.`;
      const pic = chainMap(o, { ghost: BASE, blocks: BLOCKS[kind], words: wordsAt(CHANGE_WORDS[kind], a), blockA: span(t, 0, .15), changeA: a, changes: true });
      return { svg: svg(label, pic, { h: CHAIN_H }), readout: readoutOf(o, kind) };
    },
  };
}

const scenes = {
  watch: { duration: 4000, loop: true, render: watchScene },
  renin: { duration: 4200, render: reninScene },
  cut: { duration: 4200, render: cutScene },
  'ace-step': { duration: 4200, loop: true, render: aceScene },
  receptor: { duration: 3600, render: receptorScene },
  squeeze: { duration: 3800, render: squeezeScene },
  adrenal: { duration: 4200, render: adrenalScene },
  salt: { duration: 4600, render: saltScene },
  volume: { duration: 4200, render: volumeScene },
  feedback: { duration: 4400, render: feedbackScene },
  whole: { duration: 6000, loop: true, render: wholeScene },
  ace: changeScene('ace'),
  arb: changeScene('arb'),
  mra: changeScene('mra'),
  dri: changeScene('dri'),
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['salt', 'dri', 'ace', 'arb', 'mra', 'tumor'];
const level = (k, v) => k === 'tumor' ? (v < .05 ? 'none' : v < 1.2 ? 'some' : 'a lot')
  : k === 'salt' ? (v < .97 ? 'less' : v > 1.03 ? 'more' : 'normal')
  : (v > .97 ? 'normal' : v > .55 ? 'partly blocked' : 'mostly blocked');
function syncControls() {
  for (const k of SLIDERS) { $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]); }
  $('#clinical-salt').value = params.salt;
  $('#clinical-salt-label').textContent = level('salt', params.salt);
  $('#feedback').checked = params.feedback;
}
const reference = id => { const v = data.values.find(x => x.id === id); return v.typical ?? (v.low + v.high) / 2; };
const measures = o => ({ map: o.P * reference('map'), na: o.Na * reference('na'), k: o.K * reference('k') });
const DECIMALS = { k: 1 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const domain = v => { const lo = (v.low ?? v.typical) * .8, hi = (v.high ?? v.typical) * 1.2; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
// Where a drug is set below full strength in Explore freely, mark the cut on the chain.
const BLOCK_PARAM = { dri: 'dri', ace: 'ace', arb: 'arb', mra: 'mra' };
function update() {
  syncControls();
  const o = steady(params);
  const blocks = Object.entries(BLOCK_PARAM).filter(([, p]) => params[p] < .97).flatMap(([k]) => BLOCKS[k]);
  const label = `Illustrative model with these settings, drawn over dashed bars for normal. Compared with normal: ${describe(o, 'explore')}.`;
  // Two separate pictures: each needs its own arrowhead ids, or the hidden tab's copy would hide them.
  const pic = () => svg(label, chainMap(o, { ghost: BASE, blocks, changes: true }), { h: CHAIN_H });
  $('#explore-visual').innerHTML = pic() + readoutOf(o, 'explore');
  $('#clinical-visual').innerHTML = pic();
  const rel = `renin released ×${o.S.toFixed(2)} · angiotensin II ×${o.A2.toFixed(2)} · aldosterone ×${o.aldo.toFixed(2)} · blood volume ×${o.V.toFixed(2)} · pressure ×${o.P.toFixed(2)} · potassium ×${o.K.toFixed(2)}`;
  if (!data) { $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}`; return; }
  const m = measures(o), unit = id => data.values.find(v => v.id === id).unit;
  $('#model-results').textContent = `Illustrative model, relative to normal: ${rel}. Scaled by the textbook values: mean pressure ${fmt('map', m.map)} ${unit('map')} · sodium ${fmt('na', m.na)} ${unit('na')} · potassium ${fmt('k', m.k)} ${unit('k')}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    const pos = domain(v);
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const marker = row.querySelector('.marker'); marker.setAttribute('x1', pos(val)); marker.setAttribute('x2', pos(val));
    let status;
    if (v.low !== null && v.high !== null) status = val < v.low ? 'below typical range' : val > v.high ? 'above typical range' : 'within typical range';
    else { const r = val / v.typical; status = r > 1.015 ? 'above the textbook typical value' : r < .985 ? 'below the textbook typical value' : 'near the textbook typical value'; }
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'Not listed for this state') : '';
    dir.classList.toggle('quiet', !d);
  }
}
const markCustom = () => {
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s
    ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.`
    : 'Custom model settings.';
};
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; update(); });
$('#feedback').addEventListener('change', e => { params.feedback = e.target.checked; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; update(); });
$('#clinical-salt').addEventListener('input', e => { params.salt = Number(e.target.value); markCustom(); update(); announce(); });
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(CHANGES[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(steady(params)), u = id => data.values.find(v => v.id === id).unit;
    $('#cv-live').textContent = `Model mean arterial pressure ${fmt('map', m.map)} ${u('map')}, sodium ${fmt('na', m.na)} ${u('na')}, potassium ${fmt('k', m.k)} ${u('k')}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    for (const id of ['map', 'na', 'k']) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && Number.isFinite(v.typical) && v.typical > 0)) throw new Error('Invalid reference data');
    }
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    const u = id => data.values.find(v => v.id === id).unit;
    $('#baseline-note').textContent = `The model’s normal state is set to the textbook typical values (mean pressure ${reference('map')} ${u('map')}, sodium ${reference('na')} ${u('na')}, potassium ${reference('k')} ${u('k')}), so every marker starts on its typical value. Each number shown is a relative model result multiplied by that typical value. The model’s drug strengths are arbitrary, so the size of each change is illustrative; only its direction is meant to teach. Blood volume is part of the model but has no reference value here; Explore freely shows it relative to normal.`;
    for (const s of data.states) { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.label} (${s.kind})`; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), hasRange = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction quiet"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = hasRange ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: textbook ${hasRange ? 'range' : 'typical value'} and the current illustrative model marker`);
      right.querySelector('.key').textContent = hasRange
        ? `Textbook range ${v.low} to ${v.high} ${v.unit} (shaded band), typical ${v.typical} (black line) · blue line: model`
        : `Textbook typical value about ${v.typical} ${v.unit} (black line) · blue line: model`;
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
    for (const s of data.states) {
      const li = document.createElement('li'); li.textContent = `Directions for ${s.label}: ${s.where} [${s.source}]`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work.';
  }
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
