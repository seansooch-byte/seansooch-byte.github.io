// Lesson 4: Blood pressure regulation. The kit (/lab/kit/kit.js) runs the page: tabs, steps, the picture
// player, predictions, quiz and summary. This file holds the lesson's teaching model, one picture (scene)
// per step, and the code behind the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, line, circle, rect, path, arrow, arrowTo, part, readout, f, clamp, lerp, ease, span } from '/lab/kit/draw.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Teaching model ----------
   Every quantity is relative: 1 means the normal resting state. No clinical numbers live here; the
   Clinical values tab scales these ratios by the textbook values in clinical-values.json.
   Dials: vol (blood volume), art (arteriole muscle tone), alpha (how strongly vessels answer sympathetic
   signals), central (the brainstem's sympathetic setting), beta (how strongly the heart answers them),
   reflex (the baroreflex on or off). */
const NORMAL = { vol: 1, art: 1, alpha: 1, central: 1, beta: 1, reflex: true };
const CHANGES = {
  ccb: { art: .72 },          // arteriole muscle relaxes (the artery-relaxing, dihydropyridine kind)
  alpha1: { alpha: .5 },      // vessels answer sympathetic signals less
  alpha2: { central: .8 },    // the brainstem's sympathetic setting is turned down
  beta: { beta: .5 },         // the heart answers sympathetic signals less
  vasodilator: { art: .55 },  // arteriole muscle relaxes strongly
  hemorrhage: { vol: .7 },    // blood is lost
};
const REFLEX_GAIN = 1.6;
// Blood per beat rises with filling and levels off (Lesson 3's Frank–Starling curve, normal filling gives 1).
const fillCurve = x => (1 - Math.exp(-1.35 * x)) / (1 - Math.exp(-1.35));
// How long each beat has to fill, relative to normal: a slower heart fills a little longer, a faster one
// less (the same rule as Lesson 3), so a beta-blocker's slower heart keeps about the same blood per beat.
const fillTime = rate => rate > 1 ? 1 / (1 + 1.8 * Math.pow(rate - 1, 2)) : 1 + .5 * (1 - rate);

// The circulation, given the arterial pressure the baroreceptors sense.
function circulate(p, sensed) {
  // The brainstem compares the sensed pressure with the level it defends. Turning its sympathetic setting
  // down (a central alpha-2 agonist) lowers that level too, so the reflex holds the new, lower pressure
  // instead of fighting it: no reflex speeding of the heart.
  const reflex = p.reflex ? clamp(1 + REFLEX_GAIN * (p.central - sensed), .25, 2.4) : 1;
  const drive = p.central * reflex;                    // sympathetic signal leaving the brainstem
  const heartDrive = drive * p.beta, vesselDrive = drive * p.alpha;
  const hr = .35 + .65 * heartDrive;                   // the vagus alone would leave a slow rate
  const squeeze = .85 + .15 * heartDrive;              // sympathetic signals add a little strength
  const filling = p.vol * (.85 + .15 * vesselDrive) * fillTime(hr);   // firmer veins push more blood back
  const sv = squeeze * fillCurve(filling);
  const co = hr * sv;                                  // flow: heart rate × blood per beat
  const tpr = p.art * (.6 + .4 * vesselDrive);         // resistance: arteriole tone, tightened by nerves
  return { drive, hr, sv, co, tpr, vol: p.vol, filling, map: co * tpr };
}
// Steady state: the pressure the circulation produces equals the pressure the reflex senses. Produced
// pressure never rises as sensed pressure rises, so bisection finds the single crossing.
function steady(p) {
  let lo = .02, hi = 4;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (circulate(p, mid).map > mid) lo = mid; else hi = mid; }
  return circulate(p, (lo + hi) / 2);
}
const BASE = steady(NORMAL);
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = lerp(a[k], b[k], t); return out; };

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall; type uses the kit's classes (20, .sm 18, .xs 17). */
const BLOOD = '#c4453a', VEIN = '#4f5f86', WALL = '#f0cfc7', VEIN_WALL = '#d9deea', TISSUE = '#efe6d8';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const HEART = 'M0 -30 C-10 -48 -44 -48 -44 -16 C-44 10 -16 26 0 44 C16 26 44 10 44 -16 C44 -48 10 -48 0 -30Z';
const heart = (x, y, k = 1, extra = '') => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(k * 100) / 100})" ${extra}><path d="${HEART}" fill="${C.redWash}" stroke="${C.red}" stroke-width="3" vector-effect="non-scaling-stroke"/></g>`;
// A pressure dial: a half-disc with a needle; angle runs -70 (low) to +70 (high).
function dial(cx, cy, r, angle, { ghostAngle = null, labels = true } = {}) {
  let s = `<path d="M${f(cx - r)} ${f(cy)} A${r} ${r} 0 0 1 ${f(cx + r)} ${f(cy)} Z" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`;
  for (const a of [-60, -30, 0, 30, 60]) { const q = a * Math.PI / 180; s += line(cx + (r - 9) * Math.sin(q), cy - (r - 9) * Math.cos(q), cx + (r - 2) * Math.sin(q), cy - (r - 2) * Math.cos(q), C.ink, 2); }
  if (ghostAngle !== null) s += `<path d="M${f(cx)} ${f(cy)} V${f(cy - r + 8)}" transform="rotate(${f(ghostAngle)} ${f(cx)} ${f(cy)})" stroke="${C.ink}" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round" class="ghost"/>`;
  s += `<path d="M${f(cx)} ${f(cy)} V${f(cy - r + 8)}" transform="rotate(${f(angle)} ${f(cx)} ${f(cy)})" stroke="${C.blue}" stroke-width="5" stroke-linecap="round"/>`;
  s += circle(cx, cy, 5, C.ink);
  if (labels) s += text(cx - r - 6, cy + 2, 'low', 'xs muted', 'end') + text(cx + r + 6, cy + 2, 'high', 'xs muted', 'start');
  return s;
}
// Dots that travel along a polyline, looping: u is the moment (0 to 1), n dots evenly spaced.
function along(pts, u) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let d = (((u % 1) + 1) % 1) * total, i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const q = clamp(d / seg[i], 0, 1);
  return [lerp(pts[i][0], pts[i + 1][0], q), lerp(pts[i][1], pts[i + 1][1], q)];
}
const dotsAlong = (pts, u, n, r, col) => Array.from({ length: n }, (_, j) => { const [x, y] = along(pts, u + j / n); return circle(x, y, r, col); }).join('');

/* ---------- The build steps' pictures ---------- */
// Step 1: the loop. Red blood leaves the heart in the arteries, crosses the tissues in small vessels, and
// returns, darker, in the veins.
const LOOP_ART = [[118, 118], [118, 56], [372, 56], [372, 98]];
const LOOP_VEIN = [[420, 236], [420, 268], [60, 268], [60, 178], [84, 178]];
function loopPicture(t) {
  let s = rect(352, 98, 112, 138, TISSUE, C.rule, 2, 'rx="14"');
  // small vessels across the tissue, red turning dark as the tissue takes oxygen
  for (const x of [372, 396, 420, 444]) s += path(`M372 98 C${x} 120 ${x} 150 ${x} 168 S420 220 420 236`, '#9b4a5a', 3);
  s += part('arteries', path(`M118 118 V56 H372 V98`, BLOOD, 16));
  s += part('veins', path(`M420 236 V268 H60 V178 H84`, VEIN, 20));
  s += heart(118, 168, 1.15);
  s += dotsAlong(LOOP_ART, t, 6, 4.5, '#fbe3df') + dotsAlong(LOOP_VEIN, t, 7, 4.5, '#cfd6ea');
  for (let j = 0; j < 4; j++) { const [x, y] = along([[372, 98], [396, 140], [420, 200], [420, 236]], t * 2 + j / 4); s += circle(x, y, 3.5, '#fbe3df'); }
  s += text(118, 176, 'heart', 'sm b on-heart', 'middle');
  s += text(140, 34, 'arteries: away from the heart', 'sm b', 'start');
  s += text(340, 132, 'small', 'xs b', 'end') + text(340, 152, 'vessels', 'xs b', 'end') + text(340, 172, 'in tissue', 'xs', 'end');
  s += text(240, 302, 'veins: back to the heart', 'sm b', 'middle');
  return s;
}
// Step 2: a stretch of artery, cut open. With each beat the blood pushes outward on the wall, the wall
// bulges, and the dial on the artery swings; the push drives blood on toward the tissues.
function pressurePicture(t) {
  const surge = Math.pow(Math.sin(Math.PI * clamp(t / .45, 0, 1)), 2);   // a beat early in each cycle
  const b = 5 * surge, top = 128 - b, bot = 212 + b;
  let s = rect(24, top - 16, 432, 16, WALL, '#8f3a30', 2) + rect(24, bot, 432, 16, WALL, '#8f3a30', 2);
  s += rect(24, top, 432, bot - top, '#e88c80');
  s += arrowTo(60, 170, 440, 170, BLOOD, 5);
  let push = '';
  for (const x of [84, 172, 260, 348]) push += arrowTo(x, 150, x, f(top + 5 - 6 * surge), C.blue, 3) + arrowTo(x, 190, x, f(bot - 5 + 6 * surge), C.blue, 3);
  s += part('pressure', push);
  s += text(30, 270, 'blood pushes on the wall', 'sm b blue', 'start');
  s += text(30, 294, 'and is driven on, toward the tissues →', 'xs', 'start');
  s += part('pressure', dial(330, 84, 40, lerp(-8, 34, surge)));
  s += text(30, 52, 'pressure', 'sm b', 'start') + text(30, 76, 'the push, shown', 'xs', 'start') + text(30, 96, 'on a dial', 'xs', 'start');
  return s;
}
// Step 3: the pressure wave over three beats: up to the systolic peak, down to the diastolic low, never to
// zero, because the stretched arteries recoil between beats. The mean line sits nearer the low point.
const wave = ph => ph < .18 ? Math.sin(ph / .18 * Math.PI / 2) : ph < .38 ? 1 - .55 * (ph - .18) / .2 : ph < .46 ? .45 + .06 * Math.sin((ph - .38) / .08 * Math.PI) : .45 * Math.pow(1 - (ph - .46) / .54, 1.3);
function wavePicture(t) {
  const X0 = 58, X1 = 330, yOf = v => 214 - v * 136, upTo = Math.max(.01, ease.inOut(span(t, .04, .8)));
  let d = '', sum = 0;
  const N = 300;
  for (let i = 0; i <= N; i++) { const v = wave((i * 3 / N) % 1); if (i < N) sum += v; if (i / N <= upTo) d += `${i ? 'L' : 'M'}${f(X0 + 6 + (X1 - X0 - 12) * i / N)} ${f(yOf(v))}`; }
  const mean = yOf(sum / N), LX = 350;
  let s = path(`M${X0} 36 V262 H${X1 + 6}`, C.ink, 2) + text(16, 24, 'pressure ↑', 'xs b', 'start') + text(X1 + 6, 290, 'time →', 'xs b', 'end');
  s += part('systolic', path(`M${X0 + 2} ${yOf(1)} H${LX - 8}`, C.ink, 1.5, 'stroke-dasharray="6 5"'));
  s += part('diastolic', path(`M${X0 + 2} ${yOf(0)} H${LX - 8}`, C.ink, 1.5, 'stroke-dasharray="6 5"'));
  s += path(d, BLOOD, 5);
  s += part('mean', path(`M${X0 + 2} ${f(mean)} H${LX - 8}`, C.blue, 3, `stroke-dasharray="10 6" ${fade(span(t, .8, .9))}`));
  const name = (y, a, b, cls, dpart, alpha) => part(dpart, `<g ${fade(alpha)}>${text(LX, y - 4, a, `sm b ${cls}`, 'start')}${text(LX, y + 18, b, 'xs', 'start')}</g>`);
  s += name(yOf(1), 'systolic:', 'the peak', '', 'systolic', span(upTo, .1, .2));
  s += name(mean, 'mean:', 'the average', 'blue', 'mean', span(t, .82, .92));
  s += name(yOf(0) + 8, 'diastolic:', 'the low point', '', 'diastolic', span(upTo, .3, .4));
  return s;
}
// Step 4: the heart sends a stroke volume into the artery with each beat; how often, times how much, is
// the flow: the cardiac output.
function flowPicture(t) {
  const beatPhase = (t * 2) % 1, squeeze = beatPhase < .18 ? Math.sin(beatPhase / .18 * Math.PI) : 0;
  let s = rect(150, 122, 314, 40, '#e88c80', '#8f3a30', 2, 'rx="6"');
  let marked = null;
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 2 + k) / 3) % 1, x = 156 + ph * 300;
    s += part('flow', rect(x, 128, 34, 28, BLOOD, 'none', 0, 'rx="10"'));
    if (x >= 200 && x < 300) marked = x;
  }
  if (marked !== null) s += path(`M${f(marked)} 112 V104 H${f(marked + 34)} V112`, C.ink, 2);
  s += heart(86, 140, 1.05 - .12 * squeeze);
  s += text(86, 148, 'heart', 'sm b on-heart', 'middle');
  s += text(250, 88, 'blood per beat', 'xs b', 'middle');
  s += text(86, 222, 'beats:', 'xs b', 'middle') + text(86, 242, 'how often', 'xs', 'middle');
  s += text(470, 214, 'flow = cardiac output', 'sm b blue', 'end');
  s += text(470, 240, 'heart rate × blood per beat', 'xs b', 'end');
  s += text(470, 262, 'the blood pumped each minute', 'xs muted', 'end');
  return s;
}
// Step 5: two arterioles. Tight muscle narrows one: blood squeezes through slowly and resistance is high.
// Relaxed muscle lets the other widen: blood flows easily and resistance is low.
function resistPicture(t) {
  let s = '';
  const row = (cy, half, band, speed, title, sub, meter, word) => {
    let r = text(16, cy - half - 34, title, 'sm b', 'start') + text(16, cy - half - 14, sub, 'xs', 'start');
    r += rect(16, cy - half - 6, 314, 6, C.rule) + rect(16, cy + half, 314, 6, C.rule);
    r += rect(16, cy - half, 314, half * 2, '#e88c80');
    let rings = '';
    for (let x = 206; x <= 306; x += 20) rings += rect(x, cy - half - 6 - band, 16, band, '#c98b6b', '#7a4a32', 1.5, 'rx="3"') + rect(x, cy + half + 6, 16, band, '#c98b6b', '#7a4a32', 1.5, 'rx="3"');
    r += part('arterioles', rings);
    for (let j = 0; j < 7; j++) { const x = 20 + ((t * speed + j / 7) % 1) * 306; r += circle(x, cy + ((j % 3) - 1) * half * .45, Math.min(4.5, half * .45), '#fbe3df'); }
    r += part('resistance', rect(352, cy - 12, 110, 24, '#fff', C.ink, 1.5) + rect(352, cy - 12, 110 * meter, 24, C.ink));
    r += text(352, cy - 22, 'resistance', 'xs b', 'start') + text(352, cy + 38, word, 'xs b', 'start');
    return r;
  };
  s += row(112, 9, 18, 1, 'muscle tightens', 'the arteriole narrows', .85, '↑ high');
  s += row(262, 24, 7, 3, 'muscle relaxes', 'the arteriole widens', .3, '↓ low');
  return s;
}
// Step 6: the garden hose. First the tap opens (more flow), then the nozzle narrows (more resistance);
// either way the pressure dial on the hose rises.
function hosePicture(t) {
  let s = '';
  const panel = (y0, n, title, flowUp, resistUp, a, sub) => {
    const cy = y0 + 104, flowW = lerp(8, 16, flowUp), out = lerp(10, 4.5, resistUp);
    let p = text(16, y0 + 22, `${n}  ${title}`, 'sm b', 'start');
    // the tap: a valve wheel on the inlet pipe, turning as it opens
    p += rect(16, cy - 9, 46, 18, '#cfd4c8', C.ink, 2) + circle(40, cy - 26, 13, '#fff', C.ink, 2.5) + line(40, cy - 13, 40, cy - 9, C.ink, 3);
    p += `<g transform="rotate(${f(90 * flowUp)} 40 ${f(cy - 26)})">${line(28, cy - 26, 52, cy - 26, C.ink, 3)}</g>`;
    p += rect(62, cy - flowW / 2, 24, flowW, C.blue);
    // the hose and its nozzle
    p += rect(86, cy - 16, 250, 32, '#bcd0f5', C.ink, 2, 'rx="12"');
    p += `<path d="M336 ${f(cy - 16)} L388 ${f(cy - out)} V${f(cy + out)} L336 ${f(cy + 16)} Z" fill="#bcd0f5" stroke="${C.ink}" stroke-width="2"/>`;
    for (let j = 0; j < 3; j++) { const x = 396 + ((t * 4 + j / 3) % 1) * 60; p += line(x, cy + (j - 1) * out * .6, x + 10, cy + (j - 1) * out * .6 * 1.4, C.blue, 2.5); }
    // the dial on the hose
    p += line(212, cy - 16, 212, cy - 30, C.ink, 3);
    p += dial(212, cy - 30, 34, lerp(-10, 42, Math.max(flowUp, resistUp)), { ghostAngle: -10 });
    p += text(470, y0 + 22, sub, 'xs b blue', 'end', fade(a));
    return p;
  };
  const a1 = ease.inOut(span(t, .08, .38)), a2 = ease.inOut(span(t, .56, .86));
  s += panel(4, '1', 'turn up the flow', a1, 0, a1, '↑ higher pressure');
  s += line(16, 186, 464, 186, C.rule, 2);
  s += panel(190, '2', 'narrow the outlet', 0, a2, a2, '↑ higher pressure');
  s += text(240, 396, 'pressure = flow × resistance', 'lg b', 'middle', fade(span(t, .88, .98)));
  return s;
}
// Step 7: more blood volume fills the stretchy veins; more returns to the heart, each beat pumps more.
function volumePicture(t) {
  const u = ease.inOut(span(t, .1, .85)), v = lerp(1, 1.3, u);
  const cy = 274, bagH = 34 * v;
  let s = '';
  // the veins, a stretchy store holding most of the blood, over a dashed outline of their normal fullness
  s += part('volume', `<path d="M70 ${f(cy - bagH)} Q240 ${f(cy - 14 - bagH * 1.6)} 410 ${f(cy - bagH)} V${f(cy + bagH)} Q240 ${f(cy + 14 + bagH * 1.6)} 70 ${f(cy + bagH)} Z" fill="${VEIN}" opacity=".85"/>`);
  s += `<path d="M70 ${cy - 34} Q240 ${f(cy - 14 - 54.4)} 410 ${cy - 34} V${cy + 34} Q240 ${f(cy + 14 + 54.4)} 70 ${cy + 34} Z" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 5" class="ghost"/>`;
  s += text(240, cy + 7, 'veins', 'sm b on-vein', 'middle');
  // the return to the heart, the heart, and what it sends out
  const ret = lerp(8, 16, u), outW = lerp(10, 18, u);
  s += path(`M72 ${cy} H42 V92 H62`, VEIN, ret);
  s += heart(104, 92, lerp(.9, 1.05, u));
  s += path('M148 88 H330', BLOOD, outW) + arrowTo(330, 88, 362, 88, BLOOD, 4);
  s += text(104, 100, 'heart', 'sm b on-heart', 'middle');
  s += text(170, 56, 'each beat pumps more', 'xs b', 'start', fade(span(t, .6, .8)));
  s += text(56, 182, 'more returns to the heart', 'xs b', 'start', fade(span(t, .5, .7)));
  s += text(410, 206, u > .5 ? '↑ more blood volume' : 'blood volume', `sm b ${u > .5 ? 'blue' : ''}`, 'end');
  s += text(240, 360, 'over days, the kidneys set it', 'xs muted', 'middle');
  return s;
}
// Step 8: the baroreceptor. Pressure rises and falls with each beat; the more the artery wall stretches,
// the faster the sensor fires signals up its nerve to the brainstem.
const SENSOR_PRESSURE = u => .5 + .5 * Math.pow(Math.sin(Math.PI * (u * 2 % 1)), 3);   // two beats a cycle
// Signal times over one cycle: the firing rate follows the stretch (an integer count per cycle keeps it looping).
const SPIKES = (() => { const out = []; let acc = 0; const N = 400; const rate = u => 6 + 10 * SENSOR_PRESSURE(u); let tot = 0; for (let i = 0; i < N; i++) tot += rate(i / N) / N; const k = Math.round(tot) / tot; for (let i = 0; i < N; i++) { acc += rate(i / N) * k / N; if (acc >= 1) { acc -= 1; out.push(i / N); } } return out; })();
const NERVE = [[232, 186], [232, 120], [300, 72], [348, 72]];
function sensorPicture(t) {
  const P = SENSOR_PRESSURE(t), b = 10 * P;
  let s = rect(16, 196 - b, 448, 14, WALL, '#8f3a30', 2) + rect(16, 286 + b, 448, 14, WALL, '#8f3a30', 2);
  s += rect(16, 210 - b, 448, 76 + 2 * b, '#e88c80');
  // the sensor: a branched nerve ending in the wall
  s += part('sensor', path(`M232 196 L232 ${f(186 - b * .2)} M232 202 L214 ${f(206 - b)} M232 202 L250 ${f(206 - b)} M232 202 L232 ${f(210 - b)}`, C.blue, 4) + circle(232, 186, 7, '#fff', C.blue, 3.5));
  s += part('sensor', path(`M232 180 V120 Q232 72 280 72 H348`, C.blue, 3));
  for (const ts of SPIKES) { const age = ((t - ts) % 1 + 1) % 1; if (age < .3) { const [x, y] = along(NERVE, age / .3); s += circle(x, y, 6, C.blue); } }
  s += part('brainstem', rect(348, 46, 116, 52, '#fff', C.ink, 2, 'rx="26"') + text(406, 78, 'brainstem', 'sm b on-white', 'middle'));
  s += text(16, 44, 'baroreceptor:', 'sm b blue', 'start') + text(16, 68, 'a stretch sensor', 'xs b', 'start') + text(16, 88, 'in the artery wall', 'xs', 'start');
  s += text(16, 136, 'neck and chest arteries', 'xs muted', 'start');
  s += text(240, 336, 'more stretch, faster signals', 'sm b', 'middle');
  return s;
}
// Step 9: the brainstem's two outputs. Sympathetic nerves (blue) speed and strengthen the heart, tighten
// arterioles and firm up veins; the vagus nerve (purple) slows the heart. Signals run down both.
const SYMP = [[[240, 62], [240, 120], [96, 120], [96, 196]], [[240, 62], [240, 222]], [[240, 62], [240, 120], [400, 120], [400, 212]]];
const VAGUS = [[180, 38], [40, 38], [40, 238], [58, 238]];
function nervesPicture(t) {
  let s = '';
  s += part('vagus', path('M180 38 H40 V238 H58', C.purple, 4));
  s += part('sympathetic', path('M240 62 V222 M96 196 V120 H400 V212', C.blue, 4));
  s += part('brainstem', rect(180, 14, 120, 48, '#fff', C.ink, 2, 'rx="24"') + text(240, 45, 'brainstem', 'sm b on-white', 'middle'));
  for (const pts of SYMP) s += dotsAlong(pts, t, 2, 6, C.blue);
  s += dotsAlong(VAGUS, t, 2, 6, C.purple);
  s += text(300, 108, 'sympathetic nerves', 'xs b blue', 'start') + text(50, 100, 'vagus', 'xs b purple', 'start') + text(50, 120, 'nerve', 'xs b purple', 'start');
  // the three targets: the heart, an arteriole with its muscle bands, a vein
  s += heart(96, 244, .92) + text(96, 252, 'heart', 'sm b on-heart', 'middle');
  s += rect(180, 222, 120, 26, '#e88c80', C.ink, 1.5, 'rx="6"');
  for (let x = 194; x <= 284; x += 18) s += rect(x, 216, 10, 38, '#c98b6b', '#7a4a32', 1.5, 'rx="3"');
  s += rect(340, 212, 120, 40, VEIN, C.ink, 1.5, 'rx="12"');
  s += text(96, 316, 'faster, stronger', 'xs b blue', 'middle') + text(96, 338, 'vagus: slower', 'xs b purple', 'middle');
  s += text(240, 284, 'arterioles', 'sm b', 'middle') + text(240, 306, 'tighter', 'xs b blue', 'middle');
  s += text(400, 284, 'veins', 'sm b', 'middle') + text(400, 306, 'firmer', 'xs b blue', 'middle');
  return s;
}
// Step 10: the baroreflex as a loop that runs in seconds. Standing pools blood in the legs and pressure
// dips; the sensors fire less; the brainstem sends more sympathetic and less vagal signal; the heart speeds
// up and arterioles tighten; pressure recovers. The trace below runs in step with the loop.
const STAND = { ...NORMAL, vol: .8 };
const REFLEX_NODES = [
  { x: 12, y: 12, rows: ['1  pressure dips', 'on standing up'], from: .12, to: .3 },
  { x: 268, y: 12, rows: ['2  sensors fire', 'less often'], from: .3, to: .44 },
  { x: 268, y: 116, rows: ['3  brainstem: more', 'sympathetic signal'], from: .44, to: .58 },
  { x: 12, y: 116, rows: ['4  heart faster,', 'arterioles tighter'], from: .58, to: .74 },
];
function reflexPicture(t) {
  const m0 = steady({ ...STAND, reflex: false }).map, m1 = steady(STAND).map;
  const s0 = .16;   // the moment of standing up, on the trace's time line
  const pressure = (s, withReflex) => {
    if (s < s0) return 1;
    const x = s - s0, drop = 1 - Math.exp(-x / .03);
    if (!withReflex) return 1 - (1 - m0) * drop;
    const recover = 1 - Math.exp(-Math.max(0, x - .07) / .1);
    return 1 - drop * ((1 - m0) - (m1 - m0) * recover);
  };
  let s = '';
  // the loop
  const active = REFLEX_NODES.findIndex(n => t >= n.from && t < n.to);
  REFLEX_NODES.forEach((n, i) => {
    const on = i === active;
    s += part('loop', rect(n.x, n.y, 200, 62, on ? C.blueWash : '#fff', on ? C.blue : C.ink, on ? 3 : 2, 'rx="10"'));
    s += text(n.x + 14, n.y + 26, n.rows[0], `xs b ${on ? 'on-blue' : 'on-white'}`, 'start') + text(n.x + 14, n.y + 48, n.rows[1], `xs ${on ? 'on-blue' : 'on-white'}`, 'start');
  });
  // the arrows between the boxes light up as the signal passes along them
  const ARROWS = [[216, 43, 262, 43], [368, 78, 368, 110], [264, 147, 218, 147], [112, 112, 112, 80]];
  ARROWS.forEach(([x1, y1, x2, y2], i) => {
    const at = REFLEX_NODES[i].to, on = i < 3 ? t > at - .05 && t < at + .05 : t > at - .05;
    s += arrowTo(x1, y1, x2, y2, on ? C.blue : C.ink, on ? 4.5 : 3);
  });
  s += text(126, 101, 'pressure recovers', 'xs b blue', 'start', fade(span(t, .72, .8)));
  // the trace: pressure over time, with and without the reflex
  // The trace's clock runs in step with the loop: the dip draws while boxes 1 and 2 are lit, the clock
  // nearly stops while the brainstem answers (it takes about a second), and the recovery draws with box 4.
  const clock = t < .3 ? lerp(0, .215, span(t, .02, .3)) : t < .58 ? lerp(.215, .235, span(t, .3, .58)) : lerp(.235, 1, span(t, .58, .96));
  const X0 = 40, X1 = 456, Y0 = 380, yOf = m => 246 + (1 - m) * (100 / (1 - m0)), upTo = clock;
  let dNo = '', dYes = '';
  for (let i = 0; i <= 160 && i / 160 <= upTo + 1e-9; i++) { const q = i / 160, x = f(X0 + 4 + (X1 - X0 - 8) * q); dNo += `${i ? 'L' : 'M'}${x} ${f(yOf(pressure(q, false)))}`; dYes += `${i ? 'L' : 'M'}${x} ${f(yOf(pressure(q, true)))}`; }
  s += path(`M${X0} 214 V${Y0} H${X1 + 4}`, C.ink, 2) + text(X0 + 8, 228, 'pressure ↑', 'xs b', 'start') + text(X1 + 4, 408, 'time →', 'xs b', 'end');
  s += line(X0 + 2, yOf(1), X1, yOf(1), C.rule, 2) + text(X1, yOf(1) - 8, 'normal', 'xs muted', 'end');
  const xs = X0 + 4 + (X1 - X0 - 8) * s0;
  s += line(xs, 236, xs, Y0 - 2, C.ink, 1.5, 'stroke-dasharray="2 5"') + text(xs + 8, 404, 'stand up', 'xs b', 'start');
  s += `<g class="ghost" data-ghost="without reflex" data-low="${m0.toFixed(4)}">${path(dNo, C.ink, 3, 'stroke-dasharray="7 5"')}</g>`;
  s += `<g data-new-state="with reflex" data-low="${m1.toFixed(4)}">${path(dYes, C.blue, 5)}</g>`;
  s += text(X1, yOf(m0) - 10, 'without the reflex', 'xs b', 'end', fade(span(t, .76, .86)));
  s += text(X1, yOf(m1) - 10, 'with the reflex', 'xs b blue', 'end', fade(span(t, .78, .9)));
  return s;
}

/* ---------- The board: flow × resistance = pressure ----------
   The whole picture and every change share it: three bars over dashed normal levels, the words for what
   moved under them, and two lines naming what the drug (or bleed) did and how the baroreflex answered. */
const COL = { flow: 86, tpr: 240, map: 394 }, BAR_W = 84, BASE_Y = 212, UNIT = 104;
const KEY = { flow: 'co', tpr: 'tpr', map: 'map' };   // the model's name for each bar's measure
const BAR_STYLE = { flow: [C.redWash, C.red], tpr: ['#e3e0d6', C.ink], map: [C.blueWash, C.blue] };
// How a measure moved, in a few words: about the same, a little, or plainly.
function moved(r) {
  if (r > 1.015) return r < 1.16 ? ['↑ a little', 'blue'] : r < 1.35 ? ['↑ rises', 'blue'] : ['↑ a lot', 'blue'];
  if (r < .985) return r > .9 ? ['↓ a little', 'blue'] : r > .7 ? ['↓ falls', 'blue'] : ['↓ a lot', 'blue'];
  return ['↔ the same', 'muted'];
}
function bars(o, { ghost = true, words = null } = {}) {
  let s = '';
  for (const [k, word] of [['flow', 'flow'], ['tpr', 'resistance'], ['map', 'pressure']]) {
    const r = o[KEY[k]] / BASE[KEY[k]], x = COL[k] - BAR_W / 2, hgt = UNIT * clamp(r, 0, 1.55), [fill, stroke] = BAR_STYLE[k];
    s += part(k === 'flow' ? 'flow' : k === 'tpr' ? 'resistance' : 'pressure', rect(x, BASE_Y - hgt, BAR_W, hgt, fill, stroke, 2.5));
    if (ghost) s += rect(x, BASE_Y - UNIT, BAR_W, UNIT, 'none', C.ink, 1.5, 'stroke-dasharray="6 5" class="ghost"');
    s += text(COL[k], BASE_Y + 28, word, 'sm b', 'middle');
    const w = words ? words[k] : moved(r);
    if (w) s += text(COL[k], BASE_Y + 50, w[0], `xs b ${w[1] || ''}`, 'middle');
  }
  s += line(24, BASE_Y, 456, BASE_Y, C.ink, 2);
  s += text(163, 150, '×', 'lg b', 'middle') + text(317, 150, '=', 'lg b', 'middle');
  return s;
}
// The two story lines under the bars: [tag, words, class] rows, each with its own fade.
function story(rows) {
  let s = `<g ${fade(Math.max(...rows.map(r => r[3] ?? 1)))}>${rect(12, 282, 456, 96, '#fff', C.rule, 1.5, 'rx="10"')}</g>`;
  rows.forEach(([tag, words, cls, a = 1], i) => {
    const y = 314 + i * 36;
    s += `<g ${fade(a)}>${text(26, y, tag, 'xs b muted on-white', 'start')}${text(124, y, words, `sm b ${cls} on-white`, 'start')}</g>`;
  });
  return s;
}
// What each change does, in words for the picture: the direct effect, then the baroreflex's answer.
const STORY = {
  ccb: { tag: 'the drug', did: 'relaxes arteriole muscle', reflex: 'speeds the heart a little', acts: ['tpr'] },
  alpha1: { tag: 'the drug', did: 'blocks the signal to vessels', reflex: 'speeds the heart a little', acts: ['tpr'] },
  alpha2: { tag: 'the drug', did: 'quiets the brainstem', reflex: 'barely answers: no fast heart', acts: ['flow', 'tpr'] },
  beta: { tag: 'the drug', did: 'slows and softens the heart', reflex: 'tightens arterioles a little', acts: ['flow'] },
  vasodilator: { tag: 'the drug', did: 'relaxes arterioles a lot', reflex: 'the heart races', acts: ['tpr'] },
  hemorrhage: { tag: 'the bleed', did: 'less blood to fill the heart', reflex: 'faster heart, tighter arterioles', acts: ['flow'] },
};
// Each change in two stages: first the direct effect (the reflex held off), then the reflex answers.
const STAGE_1 = [.06, .42], STAGE_2 = [.56, .92];
function stateAt(kind, t) {
  const changed = { ...NORMAL, ...CHANGES[kind] };
  const direct = steady({ ...changed, reflex: false }), full = steady(changed);
  const u1 = ease.inOut(span(t, ...STAGE_1)), u2 = ease.inOut(span(t, ...STAGE_2));
  return mix(mix(BASE, direct, u1), full, u2);
}
function actsHere(keys, a) {
  let s = '';
  for (const k of keys) s += `<g ${fade(a)}>${text(COL[k], 26, 'acts here', 'xs b blue', 'middle')}${arrowTo(COL[k], 34, COL[k], 52, C.blue, 3)}</g>`;
  return s;
}
function boardBody(o, { kind = '', t = 1 } = {}) {
  let s = `<g data-new-state="${kind || 'these settings'}" data-pressure="${o.map.toFixed(4)}" data-rate="${o.hr.toFixed(4)}" data-flow="${o.co.toFixed(4)}" data-resistance="${o.tpr.toFixed(4)}" data-volume="${o.vol.toFixed(4)}">${bars(o)}</g>`;
  if (kind) {
    const st = STORY[kind];
    s += actsHere(st.acts, span(t, .02, .1));
    s += story([[st.tag, st.did, 'blue', span(t, .02, .1)], ['the reflex', st.reflex, 'amber', span(t, .5, .58)]]);
  }
  return s;
}
const wholeBody = () => bars(BASE, { ghost: false, words: { flow: ['rate × per beat', 'muted'], tpr: ['arteriole width', 'muted'], map: ['the push', 'muted'] } })
  + story([['seconds', 'the baroreflex steadies it', 'blue'], ['days', 'the kidneys set blood volume', 'amber']]);

// Plain-word comparison with normal (for the readout and the text alternatives).
function trend(v, b, up, down) { const r = v / b; return r > 1.015 ? ['up', up] : r < .985 ? ['down', down] : ['same', 'about the same']; }
function compare(o) {
  return [
    ['Pressure', ...trend(o.map, BASE.map, 'higher', 'lower')],
    ['Heart rate', ...trend(o.hr, BASE.hr, 'faster', 'slower')],
    ['Flow', ...trend(o.co, BASE.co, 'more', 'less')],
    ['Resistance', ...trend(o.tpr, BASE.tpr, 'higher', 'lower')],
    ['Blood volume', ...trend(o.vol, BASE.vol, 'more', 'less')],
  ];
}
const describe = o => compare(o).map(([k, , w]) => `${k.toLowerCase()} ${w}`).join(', ');
const CHANGE_LABEL = {
  ccb: 'Calcium channel blockers. Bars for flow, resistance and pressure over dashed normal levels. First the resistance bar, where the drug acts, falls and the pressure bar falls with it; then the reflex speeds the heart a little, so the flow bar rises a little and pressure recovers part of the way.',
  alpha1: 'Alpha-1 blockers. First the resistance bar falls, flow dips as relaxed veins hold blood, and pressure falls; then the reflex speeds the heart a little, so flow ends a little above normal while resistance and pressure stay low.',
  alpha2: 'Central alpha-2 agonists. The drug quiets the brainstem, so the flow and resistance bars both fall, and the pressure bar falls further. The reflex barely answers, because the drug works in its own centre: no fast heart.',
  beta: 'Beta-blockers. First the flow bar falls as the heart slows, and pressure falls with it; then the reflex tightens arterioles, so the resistance bar rises a little above normal and pressure recovers part of the way.',
  vasodilator: 'Direct vasodilators. First the resistance bar falls a lot and pressure falls with it; then the reflex makes the heart race, so the flow bar rises well above normal and pressure recovers part of the way.',
  hemorrhage: 'Hemorrhage. First the flow bar falls, with less blood to fill the heart, and pressure falls with it; then the reflex speeds the heart and tightens arterioles, so resistance rises a little and pressure falls less than flow.',
};
function change(kind) {
  return {
    duration: 4600,
    render(t) {
      const o = stateAt(kind, t);
      const label = `${CHANGE_LABEL[kind]} Compared with normal: ${describe(o)}.`;
      return { svg: svg(label, boardBody(o, { kind, t }), { h: 388 }), readout: readout(compare(o)) };
    }
  };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const scenes = {
  loop: { duration: 4800, loop: true, render: t => svg('The circulation as a loop: the heart pumps red blood up into the arteries, across to a block of body tissue where it runs through small vessels, and back, darker, through the veins to the heart. Blood cells keep moving round the loop.', loopPicture(t), { h: 316 }) },
  pressure: { duration: 1600, loop: true, rest: .22, render: t => svg('A stretch of artery cut open. With each heartbeat, blue arrows show the blood pushing outward on the wall, the wall bulges a little, and a pressure dial on the artery swings toward high. A red arrow shows the blood being driven on toward the tissues.', pressurePicture(t), { h: 306 }) },
  wave: { duration: 4600, render: t => svg('Arterial pressure over time draws itself across three heartbeats: a sharp rise to the peak, the systolic pressure, then a fall to the low point, the diastolic pressure, which never reaches zero. A blue dashed line, nearer the low point, marks the mean pressure.', wavePicture(t), { h: 300 }) },
  flow: { duration: 2400, loop: true, render: t => svg('A beating heart sends a slug of blood, one stroke volume, into the artery with every beat, and the slugs travel away along it. Words say that flow, the cardiac output, is heart rate times blood per beat: the blood pumped each minute.', flowPicture(t), { h: 280 }) },
  resist: { duration: 3200, loop: true, render: t => svg('Two arterioles with blood flowing through. Top: the muscle bands around it are tight, the arteriole is narrow, blood squeezes through slowly, and a resistance meter reads high. Bottom: the muscle is relaxed, the arteriole is wide, blood flows quickly, and resistance reads low.', resistPicture(t), { h: 320 }) },
  hose: { duration: 6000, render: t => svg('Two garden hoses, each with a pressure dial. Top: the tap turns open, more water flows in, and the dial rises from its dashed starting position: higher pressure. Bottom: the nozzle narrows, and the dial rises too. Below: pressure equals flow times resistance.', hosePicture(t), { h: 410 }) },
  volume: { duration: 3600, render: t => svg('The veins, drawn as a stretchy store holding most of the blood, swell beyond their dashed normal outline as blood volume rises. More blood returns to the heart, the heart fills more and sends out a thicker stream with each beat. A note says the kidneys set blood volume over days.', volumePicture(t), { h: 372 }) },
  sensor: { duration: 3200, loop: true, render: t => svg('An artery with a stretch sensor, a baroreceptor, in its wall. With each beat the pressure rises and the wall stretches, and the sensor fires signals faster up its nerve to the brainstem; as pressure falls, the signals slow.', sensorPicture(t), { h: 346 }) },
  nerves: { duration: 2000, loop: true, render: t => svg('The brainstem sends signals down two kinds of nerve. Blue sympathetic nerves run to the heart, which beats faster and stronger, to an arteriole, which tightens, and to a vein, which firms up. A purple vagus nerve runs to the heart and slows it.', nervesPicture(t), { h: 352 }) },
  reflex: { duration: 6400, render: t => svg('The baroreflex as a loop of four boxes, lit one after another: pressure dips on standing up; the sensors fire less often; the brainstem sends more sympathetic signal; the heart speeds up and arterioles tighten. Below, a pressure trace: after standing it dips, then recovers most of the way with the reflex, while a dashed line without the reflex stays low.', reflexPicture(t), { h: 416 }) },
  whole: () => svg('Three bars: flow, which is heart rate times blood per beat, times resistance, set by arteriole width, equals pressure, the push. Below, the baroreflex steadies pressure within seconds, and the kidneys set blood volume over days.', wholeBody(), { h: 388 }),
  ccb: change('ccb'),
  alpha1: change('alpha1'),
  alpha2: change('alpha2'),
  beta: change('beta'),
  vasodilator: change('vasodilator'),
  hemorrhage: change('hemorrhage'),
};

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
// Physical units, consistent with each other: flow (mL/s) = heart rate × stroke volume / 60, and mean
// pressure (mmHg) = flow × resistance (PRU, mmHg per mL/s), with venous pressure taken as zero. The baseline
// uses the textbook heart rate, stroke volume and mean pressure; its resistance is whatever those three
// require (so it differs from the textbook's rounded resistance example, as the Clinical values tab explains).
function baselineUnits() {
  const T = reference, flow = T('hr') * T('sv') / 60;
  return { flow, resistance: T('map') / flow, compliance: T('sv') / (T('sbp') - T('dbp')) };
}
function measures(o) {
  const T = reference, B = baselineUnits();
  const hr = o.hr * T('hr'), sv = o.sv * T('sv'), flow = hr * sv / 60, tpr = o.tpr * B.resistance, map = flow * tpr;
  const pulse = sv / B.compliance;   // the arteries' stretchiness turns each beat's volume into the pressure swing
  return { map, sbp: map + pulse / 2, dbp: map - pulse / 2, hr, sv, flow, co: hr * sv / 1000, tpr };
}
const DECIMALS = { co: 1, tpr: 2 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 0);
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ No direct change', variable: '↕ Variable' };
const scaleMax = v => (v.high ?? v.typical ?? (v.low + v.high) / 2) * 2;
const posOf = v => n => f(20 + clamp(n / scaleMax(v), 0, 1) * 360);
function update() {
  syncControls();
  const o = steady(params);
  const label = `Illustrative model with these settings, over dashed normal levels. Compared with normal: ${describe(o)}.`;
  $('#explore-visual').innerHTML = svg(label, boardBody(o), { h: 274 }) + readout(compare(o));
  $('#clinical-visual').innerHTML = svg(label, boardBody(o), { h: 274 });
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: pressure ×${o.map.toFixed(2)} · heart rate ×${o.hr.toFixed(2)} · flow ×${o.co.toFixed(2)} · resistance ×${o.tpr.toFixed(2)}.`;
    return;
  }
  const m = measures(o), unit = id => data.values.find(v => v.id === id).unit;
  $('#model-results').textContent = `Illustrative model: mean pressure ${fmt('map', m.map)} ${unit('map')} = flow ${m.flow.toFixed(1)} mL/s × resistance ${fmt('tpr', m.tpr)} ${unit('tpr')} · heart rate ${fmt('hr', m.hr)} ${unit('hr')} · cardiac output ${fmt('co', m.co)} ${unit('co')}.`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`), val = m[v.modelKey];
    if (!row || val === undefined) continue;
    row.querySelector('.reading').textContent = `${fmt(v.id, val)} ${v.unit}`;
    const x = posOf(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    let status;
    if (v.low !== null && v.high !== null) status = val < v.low ? 'below the typical range' : val > v.high ? 'above the typical range' : 'inside the typical range';
    else { const r = val / v.typical; status = r > 1.015 ? 'above the textbook typical value' : r < .985 ? 'below the textbook typical value' : 'at the textbook typical value'; }
    row.querySelector('.status').textContent = `Model: ${status}`;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
  }
}
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; update(); });
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
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', () => { resetAll(); announce(); });
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(CHANGES[id] || {}), reflex: params.reflex };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { if (data) { const m = measures(steady(params)); $('#cv-live').textContent = `Model mean arterial pressure ${fmt('map', m.map)}, heart rate ${fmt('hr', m.hr)}, cardiac output ${fmt('co', m.co)}.`; } }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
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
      const pos = posOf(v), range = v.low !== null && v.high !== null;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/>` : '';
      const typ = v.typical !== null ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}<line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the textbook typical value and the current illustrative model marker`);
      right.querySelector('.key').textContent = `Textbook: ${range ? `${v.low} to ${v.high}` : `about ${v.typical}`} ${v.unit} (${range ? 'shaded band' : 'black line'}) · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      if (data.sourceLinks?.[id]) { const a = document.createElement('a'); a.href = data.sourceLinks[id]; a.textContent = 'DOI'; li.append(' · ', a); }
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

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
