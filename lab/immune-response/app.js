// Lesson 20: The immune response. The kit (/lab/kit/kit.js) runs the page; this file is the pictures and the
// Clinical values and Explore freely tabs. The teaching model is model.js (window.IRModel), a classic script loaded
// before this module.
//
// Expected behaviour:
//   - Every picture is 480 wide and at most 420 tall, one idea each, with the kit's type (20, .sm 18, .xs 17).
//   - The response unfolds in time: germs get in, eating cells arrive, the alarm spreads, a tag travels to the lymph
//     node, a T cell switches on and multiplies, B cells pour out antibodies, the timeline draws itself, and memory
//     makes the second meeting faster. The whole response is a map that builds row by row, from hours to years.
//   - Each "What changes it" step starts from the normal picture over a dashed ghost of normal, then the drug acts
//     and what moved is named on the picture (blue: what moved; red: the drug). Its readout comes from the model.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease as EASE, span, svg, text, line, circle, rect, path, arrowTo, part, readout } from '/lab/kit/draw.js';

const ease = EASE.out;
const IM = window.IRModel;
const NV = IM.NORMAL;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Drawing ---------- */
const TISSUE = '#f8ecdf', SKIN = '#d9b38c', VESSEL = '#f1cdc6', VLINE = '#8c3a2e', NODE = '#e3e8ff', LOBE = '#7a5ea8', TWASH = '#dde3ff', SWELL = '#e39b8b', NUC = '#f1ede2';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const show = (a, body) => (a <= 0.02 ? '' : `<g ${fade(a)}>${body}</g>`);
const tri = (x, y, s, col = C.ink, extra = '') => `<path ${extra} d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y + s * 0.8)} L${f(x - s)} ${f(y + s * 0.8)} Z" fill="${col}"/>`;
// A germ: a round body with short spikes, wearing its name tags (antigens) as black triangles.
function germ(x, y, r = 8, tags = true, extra = '') {
  let s = `<g ${extra}>`;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; s += line(x + r * Math.cos(a), y + r * Math.sin(a), x + (r + 3.5) * Math.cos(a), y + (r + 3.5) * Math.sin(a), C.amber, 1.8); }
  s += circle(x, y, r, C.amber);
  if (tags) for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2.1; s += tri(x + (r + 1) * Math.cos(a), y + (r + 1) * Math.sin(a), r * 0.42); }
  return s + '</g>';
}
const macrophage = (x, y, s = 1, extra = '') => `<g ${extra}><path d="M${f(x - 20 * s)} ${f(y)} C${f(x - 22 * s)} ${f(y - 18 * s)} ${f(x + 4 * s)} ${f(y - 22 * s)} ${f(x + 18 * s)} ${f(y - 10 * s)} C${f(x + 28 * s)} ${f(y)} ${f(x + 16 * s)} ${f(y + 20 * s)} ${f(x)} ${f(y + 17 * s)} C${f(x - 12 * s)} ${f(y + 16 * s)} ${f(x - 18 * s)} ${f(y + 10 * s)} ${f(x - 20 * s)} ${f(y)} Z" fill="#fff" stroke="${C.ink}" stroke-width="2"/><ellipse cx="${f(x - 3 * s)}" cy="${f(y + 1 * s)}" rx="${f(7 * s)}" ry="${f(5 * s)}" fill="${C.muted}"/></g>`;
const neutrophil = (x, y, r = 11, extra = '') => `<g ${extra}>${circle(x, y, r, '#fff', C.ink, 1.6)}${circle(x - r * 0.38, y - r * 0.1, r * 0.3, LOBE)}${circle(x + r * 0.1, y + r * 0.3, r * 0.3, LOBE)}${circle(x + r * 0.42, y - r * 0.26, r * 0.3, LOBE)}</g>`;
// A dendritic cell: a star of long arms.
function dendritic(x, y, s = 1, extra = '') {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 14 : 34) * s; pts.push(`${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`); }
  return `<g ${extra}><path d="M${pts.join(' L')} Z" fill="#fff" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>${circle(x, y, 7 * s, C.muted)}</g>`;
}
// A T cell (filled blue, white letter), a B cell (white, blue rim) or a memory cell (black).
function cell(x, y, r, kind = 'T', extra = '') {
  const fill = kind === 'B' ? '#fff' : kind === 'M' ? C.ink : C.blue, stroke = kind === 'B' ? C.blue : fill;
  const letter = kind === 'K' ? 'T' : kind;
  const cls = kind === 'B' ? 'xs b blue on-white' : 'xs b in-cell';
  return `<g ${extra}>${circle(x, y, r, fill, stroke, 2.4)}${r >= 12 ? text(x, y + 6, letter, cls) : ''}</g>`;
}
const antibody = (x, y, s = 1, col = C.blue, rot = 0, extra = '') => `<path ${extra} transform="rotate(${f(rot)} ${f(x)} ${f(y)})" d="M${f(x)} ${f(y + 9 * s)} L${f(x)} ${f(y)} L${f(x - 7 * s)} ${f(y - 8 * s)} M${f(x)} ${f(y)} L${f(x + 7 * s)} ${f(y - 8 * s)}" fill="none" stroke="${col}" stroke-width="${f(2.8 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const signal = (x, y, s = 6, extra = '') => `<path ${extra} d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y)} L${f(x)} ${f(y + s)} L${f(x - s)} ${f(y)} Z" fill="${C.purple}"/>`;
const ghostSignal = (x, y, s = 6) => `<path d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y)} L${f(x)} ${f(y + s)} L${f(x - s)} ${f(y)} Z" fill="none" stroke="${C.ghost}" stroke-width="1.4" stroke-dasharray="2 2"/>`;
const hexagon = (x, y, r, extra = '') => { const p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push(`${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`); } return `<path ${extra} d="M${p.join(' L')} Z" fill="${C.red}" stroke="#fff" stroke-width="1.5"/>`; };
const block = (x, y, w, h, extra = '') => rect(x - w / 2, y - h / 2, w, h, C.red, '#fff', 1.5, `rx="3" ${extra}`);
const ghostCell = (x, y, r) => circle(x, y, r, 'none', C.ghost, 1.5, 'stroke-dasharray="3 3"');
const at = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

/* ---------- 1. An invader gets in ---------- */
const CUTX = [206, 252];
function invaderPic(t) {
  let s = rect(16, 120, 448, 168, TISSUE) + rect(16, 288, 448, 30, VESSEL, VLINE, 1.6);
  s += text(24, 309, 'blood vessel', 'xs muted', 'start');
  s += part('skin', rect(16, 96, CUTX[0] - 16, 24, SKIN, C.ink, 1.5) + rect(CUTX[1], 96, 464 - CUTX[1], 24, SKIN, C.ink, 1.5));
  // Germs fall on the skin: most stay outside; one finds the cut.
  let g = '';
  for (const [x, d] of [[70, 0], [140, 0.1], [330, 0.06], [410, 0.16]]) {
    const u = ease(span(t, d, d + 0.25));
    if (u > 0) g += germ(x, lerp(18, 84, u), 8);
  }
  const fall = ease(span(t, 0.12, 0.36)), dive = ease(span(t, 0.36, 0.5));
  const inside = span(t, 0.52, 1), gens = Math.min(3, Math.floor(inside * 4)), n = 2 ** gens;
  if (fall > 0 && dive < 1) g += germ(229, lerp(18, 84, fall) + 86 * dive, 8);
  if (dive >= 1) {
    const spots = [[229, 172], [200, 196], [258, 196], [229, 222], [176, 166], [282, 166], [176, 228], [282, 228]];
    for (let i = 0; i < n; i++) g += germ(spots[i][0], spots[i][1], 8);
  }
  s += part('germ', g);
  s += text(16, 36, 'germs land on the skin:', 'xs b', 'start') + text(16, 58, 'most are kept out', 'xs', 'start');
  s += text(262, 84, 'a cut', 'xs b', 'start');
  s += show(span(t, 0.6, 0.72), text(310, 186, 'inside,', 'xs b amber', 'start') + text(310, 208, 'they multiply', 'xs b amber', 'start'));
  return s;
}

/* ---------- 2. First responders eat the germs ---------- */
function eatPic(t) {
  let s = rect(16, 20, 448, 244, TISSUE) + rect(16, 264, 448, 34, VESSEL) + line(16, 264, 464, 264, VLINE, 2.5) + line(16, 298, 464, 298, VLINE, 2.5);
  // A macrophage already in the tissue reaches for a germ, swallows it and breaks it down.
  const reach = ease(span(t, 0.08, 0.35)), digest = ease(span(t, 0.42, 0.85));
  s += part('macrophage', macrophage(140, 140, 1.8));
  const gp = at([218, 104], [138, 142], reach);
  if (digest < 0.05) s += germ(gp[0], gp[1], 9, false);
  else for (const [dx, dy] of [[-10, -6], [8, 2], [-2, 9], [10, -9]]) s += circle(138 + dx * (1 + digest), 142 + dy * (1 + digest), 4 * (1 - 0.5 * digest), C.amber, 'none', 0, fade(1 - 0.6 * digest));
  if (reach > 0.02 && digest < 0.05) s += `<path d="M${f(170)} ${f(118)} Q${f(lerp(200, 180, reach))} ${f(lerp(90, 110, reach))} ${f(gp[0] + 12)} ${f(gp[1] - 6)}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  // Neutrophils squeeze out of the blood vessel and eat the germs further away.
  let nt = '';
  for (const [x0, gx, gy, d] of [[330, 312, 96, 0.05], [404, 404, 140, 0.2]]) {
    const u = ease(span(t, d, d + 0.45)), eaten = span(t, d + 0.45, d + 0.55);
    if (eaten < 1) nt += germ(gx, gy - 18, 8, false, fade(1 - eaten));
    const [x, y] = at([x0, 281], [gx, gy + 6], u);
    nt += neutrophil(x, y, 13);
  }
  s += part('neutrophil', nt);
  s += text(140, 218, 'macrophage:', 'xs b') + text(140, 240, 'already in the tissue', 'xs');
  s += text(464, 218, 'neutrophils rush in', 'xs b', 'end') + text(464, 240, 'from the blood', 'xs', 'end');
  s += show(span(t, 0.45, 0.6), text(140, 48, 'swallow, then break down', 'xs b muted'));
  s += text(24, 287, 'blood vessel', 'xs muted', 'start');
  return s;
}

/* ---------- 3, 14. Alarm signals bring inflammation ---------- */
const MAC = [110, 104];
const SIG_AT = [[176, 74], [214, 112], [158, 156], [252, 70], [292, 120], [214, 186], [336, 82], [360, 150], [272, 176], [404, 104], [418, 176], [316, 214]];
const GAPS = [150, 260, 370];
function alarmScene(o) {
  // o: { spread (0 to 1: signals out), leak (0 to 1), cells (0 to 1: eating cells out), keep (share of signals left),
  //      grab (0 to 1: the drug catching TNF), ghost }
  let s = rect(16, 20, 448, 236, TISSUE) + rect(16, 20, 448, 236, SWELL, 'none', 0, fade(0.34 * o.leak * o.keep));
  s += part('macrophage', macrophage(MAC[0], MAC[1], 1.5)) + germ(64, 78, 8) + germ(70, 132, 8);
  let sig = '', gh = '';
  SIG_AT.forEach(([x, y], i) => {
    const u = ease(clamp(o.spread * 1.4 - i * 0.03, 0, 1));
    if (o.ghost) gh += ghostSignal(x, y);
    const kept = i < Math.round(SIG_AT.length * o.keep);
    if (u > 0.02 && (kept || o.grab < 0.98)) {
      const [px, py] = at([MAC[0] + 20, MAC[1]], [x, y], u);
      sig += kept ? signal(px, py) : `<g ${fade(1 - o.grab)}>${signal(px, py)}</g>`;
    }
  });
  if (o.ghost) s += `<g class="ghost" data-ghost="normal">${gh}</g>`;
  s += part('signal', sig);
  // The vessel widens, and gaps open in its top wall.
  const top = 262 - 10 * o.leak * o.keep, gap = (4 + 22 * o.leak * o.keep);
  s += rect(16, top, 448, 330 - top - 14, VESSEL);
  let wall = '', x0 = 16;
  for (const g of GAPS) { wall += line(x0, top, g - gap / 2, top, VLINE, 3); x0 = g + gap / 2; }
  wall += line(x0, top, 464, top, VLINE, 3) + line(16, 316, 464, 316, VLINE, 3);
  if (o.ghost) wall += `<g class="ghost" data-ghost="normal">${line(16, 252, 464, 252, C.ghost, 1.6, 'stroke-dasharray="5 4"')}</g>`;
  s += part('vessel', wall);
  // Neutrophils squeeze out through the gaps.
  const out = o.cells * o.keep;
  GAPS.forEach((g, i) => {
    const u = ease(clamp(out * 1.3 - i * 0.15, 0, 1));
    s += neutrophil(g, lerp(292, 232, u), 12);
  });
  return s;
}
function alarmPic(t) {
  let s = alarmScene({ spread: span(t, 0.05, 0.6), leak: ease(span(t, 0.35, 0.75)), cells: span(t, 0.55, 1), keep: 1, grab: 0 });
  s += text(16, 336, 'vessel', 'xs muted', 'start');
  s += show(span(t, 0.15, 0.3), text(464, 44, 'alarm signals: TNF and others', 'xs b purple', 'end'));
  s += show(span(t, 0.6, 0.75), text(464, 344, 'the vessel widens and leaks', 'xs b', 'end'));
  s += show(span(t, 0.8, 0.95), text(16, 36, 'inflammation:', 'xs b red', 'start') + text(16, 58, 'red, hot, swollen', 'xs b red', 'start'));
  s += text(110, 172, 'macrophage', 'xs b');
  return s;
}
function antiTnfPic(t) {
  const grab = ease(span(t, 0.15, 0.5)), calm = ease(span(t, 0.45, 0.9));
  let s = alarmScene({ spread: 1, leak: 1, cells: 1 - 0.6 * calm, keep: 1 - 0.65 * calm, grab, ghost: true });
  // The drug: Y-shaped antibodies and a cup-shaped decoy, each holding a signal.
  const cup = (x, y) => `<path d="M${x - 10} ${y - 9} L${x - 10} ${y + 4} Q${x} ${y + 15} ${x + 10} ${y + 4} L${x + 10} ${y - 9}" fill="none" stroke="${C.red}" stroke-width="3.8" stroke-linecap="round"/>`;
  let d = '';
  [[252, 70], [292, 120], [336, 82], [404, 104]].forEach(([x, y], i) => {
    const [px, py] = at([x, y - 46], [x, y + 12], grab);
    d += i === 2 ? cup(px, py) : antibody(px, py, 1.6, C.red);
  });
  s += part('drug', `<g ${fade(Math.min(1, grab * 3))}>${d}</g>`);
  s += text(110, 172, 'macrophage', 'xs b');
  s += show(span(t, 0.25, 0.4), text(464, 44, 'anti-TNF biologic grabs TNF', 'xs b red', 'end'));
  s += show(span(t, 0.65, 0.8), text(464, 236, '↓ less swelling', 'xs b blue', 'end'));
  s += show(span(t, 0.75, 0.9), text(464, 344, '↓ vessel leaks less, fewer cells out', 'xs b blue', 'end'));
  s += text(16, 336, 'vessel', 'xs muted', 'start');
  return s;
}

/* ---------- 4. Name tags travel to the lymph node ---------- */
function tagPic(t) {
  let s = rect(16, 20, 230, 300, TISSUE);
  // The lymph vessel, from the tissue to the node.
  s += path('M150 230 C210 236 250 250 316 214', '#c9d3f6', 16) + path('M150 230 C210 236 250 250 316 214', NODE, 10);
  s += part('node', `<ellipse cx="384" cy="190" rx="78" ry="112" fill="${NODE}" stroke="${C.blue}" stroke-width="2.5"/>`);
  for (const [x, y] of [[372, 130], [404, 150], [366, 176], [410, 196]]) s += cell(x, y, 13, 'T');
  for (const [x, y] of [[376, 238], [412, 252], [372, 276]]) s += cell(x, y, 13, 'B');
  s += part('tag', germ(84, 96, 20) + germ(176, 70, 9) + germ(186, 150, 9));
  // A dendritic cell swallows a germ, shows a piece of its tag and travels to the node.
  const swallow = ease(span(t, 0.05, 0.25)), shown = span(t, 0.28, 0.4), go = ease(span(t, 0.42, 0.92));
  const travel = u => { const b = (p0, p1, p2, p3) => (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2 + u ** 3 * p3; return [b(150, 210, 250, 316), b(230, 236, 250, 214)]; };
  const [dx, dy] = go > 0 ? travel(go) : [110, 236];
  if (swallow < 1) s += germ(lerp(150, 110, swallow), lerp(196, 232, swallow), 8, true, fade(1 - swallow));
  s += part('dendritic', dendritic(dx, dy, 1));
  if (shown > 0.02) s += part('tag', tri(dx + 34, dy - 2, 8, C.ink, fade(shown)));
  s += text(16, 40, 'a germ’s name tags', 'xs b', 'start') + text(16, 62, 'are its antigens', 'xs', 'start');
  s += text(384, 60, 'lymph node', 'sm b blue') + text(384, 330, 'T and B cells wait here', 'xs blue');
  s += show(1 - span(t, 0.4, 0.5), text(110, 296, 'dendritic cell', 'xs b'));
  s += show(span(t, 0.88, 1), text(232, 296, 'it carries a tag in', 'xs b', 'middle'));
  return s;
}

/* ---------- 5, 13. A helper T cell's on switch ---------- */
const TC = [206, 176], COPY_AT = Array.from({ length: 8 }, (_, i) => [86 + i * 44, 318]);
function switchScene(o) {
  // o: { dock (0 to 1), on (0 to 1: the switch), flow (0 to 1: signal clock), signal (0 to 1: how much IL-2),
  //      copies (0 to 8), ghost, drug (0 to 1) }
  let s = text(16, 34, 'inside the lymph node', 'xs muted', 'start');
  s += part('dendritic', dendritic(84, 176, 1.5));
  s += part('tag', tri(140, 176, 10, C.ink));
  const x = lerp(330, TC[0], o.dock);
  let tc = circle(x, TC[1], 64, TWASH, C.blue, 3);
  tc += `<path d="M${f(x - 64)} ${f(TC[1] - 13)} L${f(x - 50)} ${f(TC[1])} L${f(x - 64)} ${f(TC[1] + 13)}" fill="${TWASH}" stroke="${C.blue}" stroke-width="3" stroke-linejoin="round"/>`;
  s += part('tcell', tc);
  // The switch: a pill whose knob slides across and turns blue when it is on.
  const knob = lerp(x - 14, x + 14, o.on);
  s += part('switch', rect(x - 30, TC[1] - 32, 60, 28, '#fff', C.ink, 2, 'rx="14"') + circle(knob, TC[1] - 18, 10, o.on > 0.5 ? C.blue : C.muted));
  s += text(x, TC[1] + 18, 'calcineurin', 'xs b');
  // IL-2, the grow signal, streams out of the switched-on cell.
  if (o.signal > 0.02) {
    let d = '';
    for (let k = 0; k < 6; k++) { const u = (o.flow + k / 6) % 1; d += circle(lerp(x + 46, 470, u), TC[1] + 30 + 18 * Math.sin(6.28 * u + k), 5, C.blue, '#fff', 1, fade(o.signal * Math.min(1, (1 - u) * 4))); }
    s += part('il2', d);
  }
  if (o.drug > 0.02) s += part('drug', block(x, TC[1] - 18 - 50 * (1 - o.drug), 34, 18, fade(Math.min(1, o.drug * 2))));
  if (o.copies !== undefined) {
    if (o.ghost) s += `<g class="ghost" data-ghost="normal">${COPY_AT.map(([cx, cy]) => ghostCell(cx, cy, 14)).join('')}</g>`;
    s += part('clone', COPY_AT.slice(0, Math.round(o.copies)).map(([cx, cy]) => cell(cx, cy, 14, 'T')).join(''));
  }
  return s;
}
function switchPic(t) {
  const dock = ease(span(t, 0.05, 0.3)), on = ease(span(t, 0.35, 0.48)), signal = span(t, 0.5, 0.65);
  let s = switchScene({ dock, on, flow: t * 3, signal });
  s += text(84, 248, 'dendritic cell', 'xs b') + text(84, 270, 'shows the tag', 'xs');
  s += text(206, 270, 'helper T cell', 'xs b blue');
  s += show(span(t, 0.28, 0.38), text(84, 112, 'the tag fits', 'xs b'));
  s += show(span(t, 0.6, 0.75), text(464, 112, 'IL-2: grow!', 'xs b blue', 'end'));
  return s;
}
function cniPic(t) {
  const drug = ease(span(t, 0.12, 0.3)), off = ease(span(t, 0.3, 0.45)), fadeSig = 1 - ease(span(t, 0.38, 0.55));
  const copies = lerp(8, 1, ease(span(t, 0.5, 0.88)));
  let s = switchScene({ dock: 1, on: 1 - off, flow: t * 3, signal: fadeSig, copies, ghost: true, drug });
  s += text(84, 248, 'dendritic cell', 'xs b') + text(84, 270, 'shows the tag', 'xs');
  s += text(206, 270, 'helper T cell', 'xs b blue');
  s += show(span(t, 0.22, 0.36), text(464, 60, 'calcineurin inhibitor', 'xs b red', 'end') + text(464, 82, 'blocks the switch', 'xs b red', 'end'));
  s += show(span(t, 0.5, 0.64), text(464, 112, 'less IL-2', 'xs b blue', 'end'));
  s += show(span(t, 0.82, 0.96), text(16, 364, '↓ fewer T cells multiply', 'xs b blue', 'start') + text(464, 364, 'B cells get less help', 'xs b blue', 'end'));
  return s;
}

/* ---------- 6. One matching cell becomes an army ---------- */
const TREE_X = [[240], [132, 348], [78, 186, 294, 402], [51, 105, 159, 213, 267, 321, 375, 429]];
const TREE_Y = [56, 124, 192, 260];
function clonePic(t) {
  let s = text(16, 34, 'days pass ↓', 'xs muted', 'start');
  let c = '';
  for (let g = 0; g < 4; g++) {
    const u = g === 0 ? 1 : ease(span(t, (g - 1) * 0.3 + 0.05, (g - 1) * 0.3 + 0.28));
    if (u <= 0) continue;
    TREE_X[g].forEach((x, i) => {
      const [px, py] = g === 0 ? [x, TREE_Y[0]] : [TREE_X[g - 1][i >> 1], TREE_Y[g - 1]];
      const [cx, cy] = at([px, py], [x, TREE_Y[g]], u);
      if (g > 0) s += line(px, py + 15, cx, cy - 15, C.rule, 2, fade(u));
      c += cell(cx, cy, 15, 'T');
    });
  }
  s += part('clone', c);
  const n = [1, 2, 4, 8][Math.min(3, Math.floor(t / 0.3))];
  s += text(464, 34, `${n} matching cell${n > 1 ? 's' : ''}`, 'xs b blue', 'end');
  s += text(240, 314, 'a clone: every copy fits the same tag', 'xs b');
  return s;
}

/* ---------- 7. B cells make antibodies ---------- */
const AB_AT = Array.from({ length: 18 }, (_, i) => [250 + (i % 6) * 38 + (Math.floor(i / 6) % 2) * 16, 84 + Math.floor(i / 6) * 74 + ((i * 7) % 3) * 8]);
function bcellPic(t) {
  const bind = ease(span(t, 0.02, 0.22)), help = ease(span(t, 0.18, 0.38)), turn = ease(span(t, 0.42, 0.58)), pour = span(t, 0.56, 1);
  let s = '';
  // The B cell, with Y-shaped receptors that fit one tag; then it becomes a plasma cell.
  const bx = 120, by = 176;
  if (turn < 1) {
    let b = cell(bx, by, 34, 'B', fade(1 - turn));
    for (const a of [-2.2, -1.2, 0.2, 1.1]) b += antibody(bx + 40 * Math.cos(a), by + 40 * Math.sin(a), 0.9, C.blue, a * 57.3 + 90, fade(1 - turn));
    s += part('bcell', b);
  }
  if (turn > 0) {
    let p = `<ellipse cx="${bx}" cy="${by}" rx="${f(34 + 14 * turn)}" ry="${f(34 + 4 * turn)}" fill="#fff" stroke="${C.blue}" stroke-width="3" ${fade(turn)}/>`;
    for (let k = 0; k < 4; k++) p += `<path d="M${bx - 28} ${by - 16 + k * 10} q28 -6 56 0" fill="none" stroke="${C.blue}" stroke-width="1.8" ${fade(turn)}/>`;
    s += part('plasma', p);
  }
  // A germ's tag binds the receptor.
  if (turn < 1) s += germ(lerp(40, bx - 32, bind), lerp(60, by - 46, bind), 9, true, fade(1 - turn));
  // A helper T cell arrives and gives help.
  const [hx, hy] = at([bx, 320], [bx + 2, by + 66], help);
  s += cell(hx, hy, 16, 'T');
  if (help > 0.95 && turn < 0.9) for (const a of [-2.4, -1.6, -0.8]) s += line(hx + 22 * Math.cos(a), hy + 22 * Math.sin(a), hx + 32 * Math.cos(a), hy + 32 * Math.sin(a), C.blue, 2.4);
  // Antibodies pour out.
  let ab = '';
  AB_AT.forEach(([x, y], i) => {
    const u = ease(clamp(pour * 2.2 - i * 0.07, 0, 1));
    if (u > 0.02) { const [px, py] = at([bx + 48, by], [x, y], u); ab += antibody(px, py, 1.3, C.blue, (i * 53) % 360); }
  });
  s += part('antibody', ab);
  s += show(1 - turn, text(120, 112, 'B cell', 'xs b'));
  s += show(turn, text(120, 112, 'plasma cell', 'xs b'));
  s += show(span(t, 0.3, 0.42), text(150, 302, 'helper T cell gives help', 'xs b blue', 'start'));
  s += show(span(t, 0.8, 0.95), text(464, 40, 'antibodies pour out', 'xs b blue', 'end'));
  return s;
}

/* ---------- 8. Antibodies and killer T cells clear the germs ---------- */
function attackPic(t) {
  let s = line(240, 20, 240, 270, C.rule, 1.5);
  // Left: antibodies stick to germs, clump them, and an eating cell swallows the clump.
  const coat = ease(span(t, 0.02, 0.3)), clump = ease(span(t, 0.3, 0.5)), eat = 0.8 * ease(span(t, 0.55, 0.85));
  const G0 = [[60, 70], [150, 90], [96, 168]], CL = [[110, 118], [128, 128], [112, 140]];
  let left = '';
  G0.forEach((p, i) => {
    const [x, y] = at(p, CL[i], clump), [x2, y2] = at([x, y], [x, y + 50], eat);
    left += germ(x2, y2, 9, false);
    left += antibody(x2 + 12, y2 - 12, 1.1, C.blue, 40 + i * 90, fade(coat));
  });
  s += part('antibody', left);
  s += part('macrophage', macrophage(lerp(150, 118, eat), lerp(236, 214, eat), 1.6));
  // Right: a killer T cell finds a body cell a virus has taken over and destroys it.
  const come = ease(span(t, 0.08, 0.38)), hit = span(t, 0.42, 0.52), burst = ease(span(t, 0.58, 0.92));
  let body = circle(370, 130, 52, TISSUE, C.ink, 2, burst > 0.02 ? `stroke-dasharray="${f(30 - 22 * burst)} ${f(4 + 18 * burst)}" ${fade(1 - 0.7 * burst)}` : '');
  for (const [dx, dy] of [[-16, -10], [12, -18], [0, 10], [20, 12], [-20, 18]]) body += circle(370 + dx * (1 + 0.6 * burst), 130 + dy * (1 + 0.6 * burst), 4.5, C.amber, 'none', 0, fade(1 - 0.5 * burst));
  s += part('infected', body);
  const [kx, ky] = at([300, 250], [318, 186], come);
  s += part('killer', cell(kx, ky, 20, 'K'));
  if (hit > 0.02 && burst < 0.6) for (const a of [-0.9, -0.5, -0.1]) s += line(kx + 24 * Math.cos(a), ky + 24 * Math.sin(a), kx + 36 * Math.cos(a), ky + 36 * Math.sin(a), C.red, 2.6);
  s += text(124, 300, 'antibodies clump germs;', 'xs b') + text(124, 322, 'eating cells swallow them', 'xs');
  s += text(356, 300, 'a killer T cell kills', 'xs b') + text(356, 322, 'a cell a virus took over', 'xs');
  return s;
}

/* ---------- 9, 10, 12. The response over time ---------- */
const GR = { x0: 60, x1: 456, y0: 296, h: 236 };
const PEAK = { G: IM.BASE.raw.germs, Se: IM.BASE.raw.alarm, A: IM.BASE.raw.antibodies, T: IM.BASE.raw.tcells, M: IM.run({}).series.M.reduce((a, b) => Math.max(a, b), 0) };
const SCALE = { G: 0.9, Se: 0.55, A: 0.62, T: 0.7, M: 0.45 };
const gyOf = (k, v) => GR.y0 - GR.h * SCALE[k] * clamp(v / PEAK[k], 0, 1.6);
function curveD(series, k, upTo, x0 = GR.x0, x1 = GR.x1, t0 = 0, t1 = IM.DAYS) {
  const pts = [];
  for (let i = 0; i < series.t.length; i++) {
    const tt = series.t[i];
    if (tt < t0 - 1e-9 || tt > t1 + 1e-9 || tt > t0 + (t1 - t0) * upTo + 1e-9) continue;
    pts.push(`${pts.length ? 'L' : 'M'}${f(x0 + (x1 - x0) * (tt - t0) / (t1 - t0))} ${f(gyOf(k, series[k][i]))}`);
  }
  return pts.join(' ');
}
const COL = { G: C.amber, Se: C.purple, A: C.blue, T: C.ink, M: C.ink };
function axes() {
  return line(GR.x0, 40, GR.x0, GR.y0, C.ink, 2) + line(GR.x0, GR.y0, GR.x1 + 8, GR.y0, C.ink, 2)
    + text(16, 30, 'amount ↑', 'xs b', 'start') + text(GR.x1 + 8, GR.y0 + 58, 'time →', 'xs b', 'end');
}
const xOfDay = d => GR.x0 + (GR.x1 - GR.x0) * d / IM.DAYS;
function curvePic(t) {
  const up = ease(span(t, 0.04, 0.92)), S = IM.BASE.series;
  let s = axes();
  // Under the axis: the innate response in the first hours, the adaptive response over the days after.
  s += rect(GR.x0, GR.y0 + 8, xOfDay(5) - GR.x0, 22, '#f1dcc4') + rect(xOfDay(5), GR.y0 + 8, xOfDay(22) - xOfDay(5), 22, TWASH);
  s += text(GR.x0 + 4, GR.y0 + 25, 'innate', 'xs b amber', 'start') + text(xOfDay(5) + 6, GR.y0 + 25, 'adaptive: takes days', 'xs b blue', 'start');
  s += part('germs', path(curveD(S, 'G', up), C.amber, 4));
  s += part('alarm', path(curveD(S, 'Se', up), C.purple, 3));
  s += part('antibody', path(curveD(S, 'A', up), C.blue, 4));
  const day = up * IM.DAYS;
  s += show(clamp((day - 4.5) / 2, 0, 1), text(xOfDay(4) - 8, gyOf('G', PEAK.G) - 10, 'germs', 'xs b amber', 'end'));
  s += show(clamp((day - 5.5) / 2, 0, 1), text(xOfDay(5.6) + 8, gyOf('Se', PEAK.Se) + 4, 'alarm', 'xs b purple', 'start'));
  s += show(clamp((day - 12) / 2, 0, 1), text(xOfDay(11.5) + 12, gyOf('A', PEAK.A) - 10, 'antibodies', 'xs b blue', 'start'));
  return s;
}
const REPEAT = IM.run({ reinfect: true }).series;
function memoryPic(t) {
  const up = ease(span(t, 0.03, 0.95));
  let s = axes();
  const L = [GR.x0, 248, 0, IM.DAYS], R = [272, GR.x1, 2 * IM.DAYS, 3 * IM.DAYS];
  const u1 = clamp(up * 2, 0, 1), u2 = clamp(up * 2 - 1, 0, 1);
  // Memory cells: built in the first meeting, still there for the second.
  s += part('memory', path(curveD(REPEAT, 'M', u1, ...L), C.ink, 3, 'stroke-dasharray="2 5"') + (u2 > 0 ? path(curveD(REPEAT, 'M', u2, ...R), C.ink, 3, 'stroke-dasharray="2 5"') : ''));
  for (const k of ['G', 'A']) {
    s += part(k === 'G' ? 'germs' : 'antibody', path(curveD(REPEAT, k, u1, ...L), COL[k], 4) + (u2 > 0 ? path(curveD(REPEAT, k, u2, ...R), COL[k], 4) : ''));
  }
  s += rect(250, 40, 20, GR.y0 - 30, '#ecefe5') + line(250, GR.y0 - 6, 258, GR.y0 + 6, C.ink, 2) + line(262, GR.y0 - 6, 270, GR.y0 + 6, C.ink, 2);
  s += text(154, GR.y0 + 30, 'first meeting', 'xs b') + text(364, GR.y0 + 30, 'same germ, years later', 'xs b');
  s += show(clamp(u1 * 3 - 1, 0, 1), text(76, 70, 'germs climb high', 'xs b amber', 'start'));
  s += show(clamp(u1 * 2 - 1.2, 0, 1), text(150, 228, 'memory cells stay', 'xs b', 'start'));
  s += show(clamp(u2 * 3 - 1.2, 0, 1), text(464, 52, 'antibodies: sooner, higher', 'xs b blue', 'end'));
  s += show(clamp(u2 * 3 - 1.5, 0, 1), text(464, 258, 'germs climb less', 'xs b amber', 'end'));
  return s;
}
const VAC = IM.run({ vaccine: true }).series;
const lerpSeries = (a, b, u) => { const o = { t: a.t }; for (const k of ['G', 'Se', 'T', 'A', 'M']) o[k] = a[k].map((v, i) => v + (b[k][i] - v) * u); return o; };
function vaccinePic(t) {
  const e = ease(span(t, 0.2, 0.85)), S = lerpSeries(IM.BASE.series, VAC, e);
  let s = axes();
  s += `<g class="ghost" data-ghost="normal">${['G', 'A', 'M'].map(k => path(curveD(IM.BASE.series, k, 1), C.ghost, 2.5, 'stroke-dasharray="6 5"')).join('')}</g>`;
  s += part('memory', path(curveD(S, 'M', 1), C.ink, 3, 'stroke-dasharray="2 5"'));
  s += part('germs', path(curveD(S, 'G', 1), C.amber, 4));
  s += part('antibody', path(curveD(S, 'A', 1), C.blue, 4));
  // The vaccine, given beforehand: harmless tags at the start of the timeline.
  s += part('drug', show(span(t, 0.05, 0.2), [0, 1, 2].map(i => tri(GR.x0 + 14 + i * 16, 34, 7, C.red)).join('') + text(GR.x0 + 62, 40, 'vaccine beforehand: memory ready', 'xs b red', 'start')));
  s += show(span(t, 0.6, 0.78), text(464, 70, '↑ antibodies sooner, higher', 'xs b blue', 'end'));
  s += show(span(t, 0.7, 0.88), text(xOfDay(3) + 14, 262, '↓ germs climb less', 'xs b blue', 'start'));
  s += text(GR.x1, GR.y0 + 30, 'dashed: no vaccine', 'xs muted', 'end');
  return s;
}

/* ---------- 11. The whole response, row by row, and where drugs steer it ---------- */
const MAP = [
  ['germ gets in', '', 'g'],
  ['eating cells, alarm signals (TNF)', 'anti-TNF, glucocorticoids', 'a'],
  ['tag carried to a lymph node', '', 'd'],
  ['helper T cell switch: calcineurin', 'calcineurin inhibitors', 's'],
  ['T cells multiply, B cells make antibodies', '', 'b'],
  ['memory cells stay', 'vaccines make them ahead of time', 'm'],
];
function wholePic(t) {
  let s = '';
  const rowY = i => 46 + i * 58;
  // Time, down the left: hours, days, years.
  const brace = (y1, y2, word) => line(52, y1, 52, y2, C.muted, 2) + line(52, y1, 60, y1, C.muted, 2) + line(52, y2, 60, y2, C.muted, 2) + `<text transform="rotate(-90 36 ${f((y1 + y2) / 2)})" x="36" y="${f((y1 + y2) / 2 + 6)}" text-anchor="middle" class="xs b muted">${word}</text>`;
  const r = i => span(t, i * 0.13, i * 0.13 + 0.12);
  s += show(r(0), brace(rowY(0) - 16, rowY(1) + 22, 'hours'));
  s += show(r(2), brace(rowY(2) - 16, rowY(4) + 22, 'days'));
  s += show(r(5), brace(rowY(5) - 16, rowY(5) + 22, 'years'));
  MAP.forEach(([stage, drug, icon], i) => {
    const y = rowY(i), a = r(i);
    let row = '';
    const ix = 86;
    if (icon === 'g') row += germ(ix, y, 10);
    if (icon === 'a') row += macrophage(ix - 2, y + 2, 0.9) + signal(ix + 24, y - 8, 6);
    if (icon === 'd') row += dendritic(ix, y, 0.62);
    if (icon === 's') row += cell(ix, y, 15, 'T');
    if (icon === 'b') row += cell(ix - 6, y, 13, 'B') + antibody(ix + 20, y, 1, C.blue);
    if (icon === 'm') row += cell(ix, y, 14, 'M');
    row += text(118, y + 6, stage, 'sm b', 'start');
    if (drug) row += part('drugpoint', text(118, y + 30, `← ${drug}`, 'xs b red', 'start'));
    s += show(a, row);
    if (i < MAP.length - 1) s += show(r(i + 1), arrowTo(86, y + (drug ? 20 : 18), 86, rowY(i + 1) - 20, C.muted, 2));
  });
  s += show(span(t, 0.85, 1), text(240, 398, 'key measures: germ peak, antibodies made', 'xs muted'));
  return s;
}

/* ---------- 15. Glucocorticoids: many alarms turned down ---------- */
const OUT_AT = [[300, 70], [336, 92], [372, 70], [408, 92], [444, 70], [318, 126], [354, 148], [390, 126], [426, 148]];
function gcPic(t) {
  const enter = ease(span(t, 0.08, 0.3)), inNuc = ease(span(t, 0.3, 0.45)), down = ease(span(t, 0.48, 0.88));
  let s = '';
  const cx = 150, cy = 190;
  s += part('cell', circle(cx, cy, 104, '#fff', C.ink, 2.4) + circle(cx + 6, cy + 14, 46, NUC, C.muted, 2));
  // The instructions in the nucleus: strands of DNA.
  for (let k = 0; k < 3; k++) s += path(`M${cx - 30} ${cy + k * 12} q15 -8 30 0 t30 0`, C.blue, 2.5);
  s += text(cx + 6, cy + 54, 'instructions', 'xs muted on-white');
  // The drug: in through the membrane, into the nucleus, onto the instructions.
  const [hx, hy] = inNuc > 0 ? at([cx - 50, cy - 50], [cx - 8, cy + 6], inNuc) : at([30, 50], [cx - 50, cy - 50], enter);
  s += part('drug', hexagon(hx, hy, 11, fade(Math.min(1, enter * 3))));
  // Out of the cell: many kinds of alarm signal, fewer and fewer as the instructions are turned down.
  const shapes = [(x, y) => signal(x, y, 7), (x, y) => circle(x, y, 7, C.purple), (x, y) => tri(x, y, 8, C.purple)];
  const keep = Math.round(OUT_AT.length * (1 - 0.7 * down));
  s += `<g class="ghost" data-ghost="normal">${OUT_AT.map(([x, y]) => circle(x, y, 9, 'none', C.ghost, 1.4, 'stroke-dasharray="2 2"')).join('')}</g>`;
  s += part('signal', OUT_AT.slice(0, keep).map(([x, y], i) => shapes[i % 3](x, y)).join(''));
  s += arrowTo(250, 140, 282, 116, C.purple, 2.4);
  // Below: T cells multiplying, fewer of them.
  const copies = Math.round(8 - 5 * down);
  const row = Array.from({ length: 8 }, (_, i) => [130 + i * 44, 350]);
  s += `<g class="ghost" data-ghost="normal">${row.map(([x, y]) => ghostCell(x, y, 14)).join('')}</g>`;
  s += part('clone', row.slice(0, copies).map(([x, y]) => cell(x, y, 14, 'T')).join(''));
  s += text(464, 40, 'alarm signals made', 'xs b purple', 'end');
  s += text(16, 312, 'T cells multiplying', 'xs b blue', 'start');
  s += show(span(t, 0.2, 0.34), text(16, 30, 'glucocorticoid', 'xs b red', 'start'));
  s += show(span(t, 0.42, 0.56), text(16, 384, 'it sits on the instructions', 'xs b red', 'start'));
  s += show(span(t, 0.7, 0.85), text(464, 196, '↓ many alarms at once', 'xs b blue', 'end'));
  s += show(span(t, 0.8, 0.94), text(464, 384, '↓ fewer T cells', 'xs b blue', 'end'));
  return s;
}

/* ---------- Words: comparisons and text alternatives ---------- */
const ROWS = [['germs', 'Germs at their worst', 'more', 'fewer'], ['alarm', 'Alarm signals', 'more', 'fewer'], ['tcells', 'T cells', 'more', 'fewer'], ['antibodies', 'Antibodies', 'more', 'fewer'], ['memory', 'Memory cells', 'more', 'fewer']];
function trend(a, b, up, down) {
  if (Math.abs(a - b) < 0.03 * Math.max(b, 0.05)) return ['same', 'about the same'];
  return a > b ? ['up', up] : ['down', down];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => { const [d, w] = trend(v[k], ref[k], up, down); return [name, d, w]; });
const changedFirst = rows => [...rows.filter(r => r[1] !== 'same'), ...rows.filter(r => r[1] === 'same')];
const describe = (v, ref) => compare(v, ref).map(([k, , w]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const CHANGES = { vaccine: { vaccine: true }, cni: { cni: true }, antitnf: { antitnf: true }, gc: { gc: true } };
const ENDS = Object.fromEntries(Object.entries(CHANGES).map(([k, o]) => [k, IM.settle(o)]));
const CHANGE_WHERE = {
  vaccine: 'Red tags at the start of the timeline mark a vaccine given beforehand, so the dotted memory line starts high; when the germ arrives, the blue antibody curve rises sooner and higher and the amber germ curve climbs much less, against dashed normal curves.',
  cni: 'A red calcineurin inhibitor block drops onto the T cell’s switch; the knob slides back to off, the blue IL-2 dots stop and the row of eight T cell copies shrinks to one among dashed outlines.',
  antitnf: 'Red Y-shaped anti-TNF antibodies and a cup-shaped decoy catch the purple alarm signals, most of which vanish leaving dashed outlines; the pink swelling fades, the gaps in the vessel wall close and fewer neutrophils squeeze out.',
  gc: 'A red glucocorticoid hexagon enters the immune cell and sits on the instructions in its nucleus; the purple alarm signals of several kinds drop from nine to three, and the row of T cell copies shrinks, against dashed outlines.'
};
const TITLE = { vaccine: 'Vaccines', cni: 'Calcineurin inhibitors', antitnf: 'Anti-TNF biologics', gc: 'Glucocorticoids' };
const DRAW = { vaccine: vaccinePic, cni: cniPic, antitnf: antiTnfPic, gc: gcPic };
const HEIGHT = { vaccine: 362, cni: 378, antitnf: 356, gc: 396 };
function change(kind) {
  const order = changedFirst(compare(ENDS[kind], NV)).map(r => r[0]);
  const sorted = rows => order.map(k => rows.find(r => r[0] === k));
  return {
    duration: 4600,
    render(t) {
      const cur = IM.lerp(NV, ENDS[kind], ease(span(t, 0.2, 0.9)));
      const label = `${TITLE[kind]}, drawn over faint dashed marks for normal, the untreated, unvaccinated response. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(cur, NV)}.`;
      return { svg: svg(label, DRAW[kind](t), { h: HEIGHT[kind] }), readout: readout(sorted(compare(cur, NV))) };
    }
  };
}
const moving = (label, draw, h, duration, loop = false) => ({ duration, loop, render: t => svg(label, draw(t), { h }) });
const scenes = {
  invader: moving('Skin with a cut in it, over the tissue and a blood vessel. Germs, drawn as small spiky amber balls with black name tags, fall onto the skin; most stay outside, but one slips through the cut and, inside, multiplies to two, four and eight.', invaderPic, 330, 5200),
  eat: moving('Inside the tissue, a large white macrophage that already lives there reaches out, swallows a germ and breaks it into pieces. Two neutrophils, round cells with purple lobes, squeeze out of the blood vessel below and swallow germs further away.', eatPic, 310, 5200),
  alarm: moving('A macrophage next to germs sends out purple diamond alarm signals that spread through the tissue. The tissue turns pink and swollen, the blood vessel below widens, gaps open in its wall and neutrophils squeeze out toward the germs: inflammation.', alarmPic, 356, 5200),
  tag: moving('On the left, germs in the tissue wear black triangle name tags, their antigens. A star-shaped dendritic cell swallows a germ, holds a piece of its tag up on one arm and travels along a lymph vessel into a lymph node, a large blue bean where T cells and B cells wait.', tagPic, 344, 5600),
  switch: moving('Inside the lymph node, a star-shaped dendritic cell holds up a black triangle tag. A helper T cell, a large blue circle with a matching notch, slides in and fits the tag; the switch inside it, calcineurin, flips on and blue dots, the IL-2 grow signal, stream out of the cell.', switchPic, 290, 5200),
  clone: moving('One T cell at the top divides into two, then four, then eight, drawn as a family tree down the picture as days pass: a clone in which every copy fits the same tag.', clonePic, 330, 5200),
  bcell: moving('A B cell, a white circle with a blue rim and Y-shaped receptors, grips a germ by its tag. A helper T cell comes up from below and gives help; the B cell becomes a larger plasma cell, and Y-shaped antibodies pour out of it across the picture.', bcellPic, 322, 5600),
  attack: moving('Two halves. Left: blue Y-shaped antibodies stick to germs and pull them into a clump, which a macrophage swallows. Right: a killer T cell presses on a body cell full of virus, sends a kill signal and the cell breaks apart.', attackPic, 334, 5600),
  curve: moving('A timeline that draws itself from left to right. The amber germ curve rises first and falls; the purple alarm curve rises with the germs and fades after them; the blue antibody curve starts late, climbs high after the germs peak and slowly drifts down. A band under the axis marks the innate response in the first hours and the adaptive response, which takes days.', curvePic, 360, 5600),
  memory: moving('Two timelines side by side. At the first meeting the amber germ curve climbs high and the blue antibody curve rises late; a dotted line of memory cells rises and stays. When the same germ comes back years later, the antibodies rise sooner and higher and the germs climb much less.', memoryPic, 340, 6000),
  whole: moving('The whole response as a ladder, built row by row: a germ gets in; eating cells and alarm signals such as TNF, in the first hours; a tag carried to a lymph node; the helper T cell’s calcineurin switch; T cells multiplying and B cells making antibodies, over days; and memory cells that stay for years. Red notes mark where drugs steer it: anti-TNF biologics and glucocorticoids at the alarm, calcineurin inhibitors at the switch, and vaccines, which make memory ahead of time.', wholePic, 404, 6000),
  vaccine: change('vaccine'),
  cni: change('cni'),
  antitnf: change('antitnf'),
  gc: change('gc'),
};

/* ---------- Clinical values ----------
   The model's normal total sits at the middle of the quoted range, and its shares are the middles of the quoted share
   ranges scaled to add up to the whole (all read from the data file at load). Conditions are applied as model inputs,
   and the picture and every row read the same model output. */
let data = null;
const REF = {};
const DRUG_LABEL = { gc: 'a glucocorticoid', cni: 'a calcineurin inhibitor', antitnf: 'an anti-TNF biologic' };
// What each state does to the model. Any infection, germ or drug in a preset is copied into the visible controls,
// so the controls always show, and always decide, the model's inputs.
const STATE_INPUTS = { leukocytosis: { wbcMul: 1.8 }, leukopenia: { wbcMul: 0.5 } };
const CONTROL_KEYS = ['infection', 'germ', 'drug'];
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const num = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const rangeText = v => `${num(v.low)}–${num(v.high)}`;
const barSpan = v => hasRange(v) ? [Math.max(0, v.low - (v.high - v.low)), v.high + (v.high - v.low)] : [v.typical * 0.5, v.typical * 1.5];
const barX = (v, n) => { const [a, b] = barSpan(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const roundFor = (v, n) => v.unit === '%' ? Math.round(n) : Math.round(n / 100) * 100;
const fmt = (v, n) => v.unit === '%' ? `${num(roundFor(v, n))}%` : `${num(roundFor(v, n))} ${v.unit}`;
function placeOf(v, n) {
  const r = roundFor(v, n);
  if (!hasRange(v)) return r > v.typical ? 'above' : r < v.typical ? 'below' : 'inside';
  return r > v.high ? 'above' : r < v.low ? 'below' : 'inside';
}
const placeWords = (v, w) => hasRange(v) ? `${w} typical range` : w === 'inside' ? 'at the typical value' : `${w} the typical value`;
const cv = { state: 'normal', extra: {}, infection: 0, germ: 'bacteria', drug: '', custom: false };
// The picture and every gauge come from one model output (cvInputs). The dashed comparison marker is the same
// model without the chosen condition. Cited directions are shown as words beside it, never mixed into the model.
const normalInputs = () => ({ infection: cv.infection, germ: cv.germ, drug: cv.drug });
const cvInputs = () => ({ ...cv.extra, ...normalInputs() });
const modelValue = v => IM.blood(cvInputs(), REF)[v.modelKey];
const infectionWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'mild' : v <= 1.2 ? 'an infection' : 'a heavy infection';

const KIND_DRAW = {
  n: (x, y) => `<g data-cell-kind="neutrophil">${neutrophil(x, y, 14)}</g>`,
  l: (x, y) => `<g data-cell-kind="lymphocyte">${circle(x, y, 12, '#fff', C.muted, 1.5)}${circle(x, y, 9, C.blue)}</g>`,
  m: (x, y) => `<g data-cell-kind="monocyte">${circle(x, y, 15, '#fff', C.muted, 1.5)}<path d="M${x - 7} ${y - 4} q7 12 14 0" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/></g>`,
  e: (x, y) => `<g data-cell-kind="eosinophil">${circle(x, y, 13, '#fff', C.muted, 1.5)}${circle(x - 4, y, 4, C.amber)}${circle(x + 4, y, 4, C.amber)}${circle(x, y - 6, 2, C.red)}${circle(x, y + 6, 2, C.red)}</g>`
};
function bloodPicture(m, label) {
  // An illustrative drop of blood: white cells in proportion to the model.
  let s = rect(0, 0, 480, 300, '#fbf1ef') + text(16, 28, 'a drop of blood (illustrative model)', 'xs b muted', 'start');
  const per = 30;
  const counts = { n: Math.round(per * m.relN), l: Math.round(per * m.relL), m: Math.max(m.relMo > 0.01 ? 1 : 0, Math.round(per * m.relMo)), e: Math.max(m.relE > 0.01 ? 1 : 0, Math.round(per * m.relE)) };
  let kinds = [...Array(counts.n).fill('n'), ...Array(counts.l).fill('l'), ...Array(counts.m).fill('m'), ...Array(counts.e).fill('e')];
  if (kinds.length > 48) { const step = kinds.length / 48; kinds = Array.from({ length: 48 }, (_, i) => kinds[Math.floor(i * step)]); }
  // A fixed shuffle, so the kinds are mixed but the picture does not jitter between redraws.
  const cells = kinds.map((k, i) => [k, (i * 0.618034) % 1]).sort((a, b) => a[1] - b[1]).map(c => c[0]);
  cells.forEach((k, i) => {
    const col = i % 8, row = Math.floor(i / 8), x = 50 + col * 52 + (row % 2) * 24, y = 66 + row * 42;
    s += KIND_DRAW[k](x, y);
  });
  s += `<g>${KIND_DRAW.n(24, 322)}${text(44, 328, 'neutrophil', 'xs', 'start')}${KIND_DRAW.l(150, 322)}${text(168, 328, 'lymphocyte', 'xs', 'start')}</g>`;
  s += `<g>${KIND_DRAW.m(24, 358)}${text(44, 364, 'monocyte', 'xs', 'start')}${KIND_DRAW.e(150, 358)}${text(168, 364, 'eosinophil', 'xs', 'start')}</g>`;
  return svg(label, s, { h: 380 });
}

function updateClinical() {
  $('#clinical-infection').value = cv.infection; $('#clinical-infection-label').textContent = infectionWords(cv.infection);
  $('#clinical-drug').value = cv.drug; $('#clinical-germ').value = cv.germ;
  const st = data?.states.find(s => s.id === cv.state);
  if (!data) { $('#clinical-visual').innerHTML = ''; return; }
  const m = IM.blood(cvInputs(), REF), inp = cvInputs();
  const label = `Illustrative drop of blood${st ? `, set to ${st.label}` : ''}${cv.custom ? ', adjusted by hand' : ''}${inp.infection > 0.05 ? `, with ${infectionWords(inp.infection)} caused by ${inp.germ === 'virus' ? 'a virus' : 'bacteria'}` : ''}${inp.drug ? `, with ${DRUG_LABEL[inp.drug]} in the model` : ''}: neutrophils, lymphocytes, monocytes and eosinophils drawn in proportion to the model.`;
  $('#clinical-visual').innerHTML = bloodPicture(m, label);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = !st ? '' : d === 'variable' ? `Cited: ${DIRECTION.variable}, can be lower or higher than ${st.comparedWith}`
      : d ? `Cited: ${DIRECTION[d]}, compared with ${st.comparedWith}` : 'No cited direction for this condition: the marker shows the teaching model only';
    dir.classList.toggle('quiet', !d || d === 'variable');
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    const n = modelValue(v), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${placeWords(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = IM.blood(normalInputs(), REF)[v.modelKey], rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeWords(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  const preset = STATE_INPUTS[id] || {};
  cv.state = id; cv.custom = false; cv.infection = 0; cv.germ = 'bacteria'; cv.drug = '';
  cv.extra = Object.fromEntries(Object.entries(preset).filter(([k]) => !CONTROL_KEYS.includes(k)));
  for (const k of CONTROL_KEYS) if (k in preset) cv[k] = preset[k];
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline: no infection, no drug.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
function customised() {
  cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  const drugNote = cv.drug ? ` The model applies ${DRUG_LABEL[cv.drug]}: an illustrative effect, not a cited direction.` : '';
  $('#state-summary').textContent = (s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.') + drugNote;
  updateClinical(); announce();
}
$('#clinical-infection').addEventListener('input', e => { cv.infection = Number(e.target.value); customised(); });
$('#clinical-germ').addEventListener('change', e => { cv.germ = e.target.value; customised(); });
$('#clinical-drug').addEventListener('change', e => { cv.drug = e.target.value; customised(); });
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const st = data.states.find(s => s.id === cv.state);
    $('#cv-live').textContent = `Illustrative model${st ? `, ${st.label}` : ''}: ${data.values.map(v => { const n = modelValue(v); return `${v.label} ${fmt(v, n)}, ${placeWords(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { growth: 1, drugs: new Set(), reinfect: false };
const EX_NAMES = { vaccine: 'vaccinated beforehand', cni: 'a calcineurin inhibitor', antitnf: 'an anti-TNF biologic', gc: 'a glucocorticoid' };
const exploreOpts = () => { const o = { growth: ex.growth, reinfect: ex.reinfect }; for (const d of ex.drugs) o[d] = true; return o; };
const pct = x => `${Math.round(100 * x)}%`;
const growthWords = g => g < 0.8 ? 'slowly' : g <= 1.2 ? 'at the normal pace' : g <= 1.6 ? 'quickly' : 'very quickly';
// Germs, alarm, T cells and antibodies over time on top; below, how high each measure climbs against normal.
function explorePicture(cur, series, ghostSeries, label) {
  const days = series.t[series.t.length - 1];
  const E = { x0: 60, x1: 456, y0: 200, h: 156 };
  const d = (ser, k) => ser.t.map((tt, i) => `${i ? 'L' : 'M'}${f(E.x0 + (E.x1 - E.x0) * tt / days)} ${f(E.y0 - E.h * SCALE[k] * clamp(ser[k][i] / PEAK[k], 0, 1.25))}`).join(' ');
  let s = line(E.x0, 30, E.x0, E.y0, C.ink, 2) + line(E.x0, E.y0, E.x1 + 8, E.y0, C.ink, 2);
  s += text(16, 22, 'amount ↑', 'xs b', 'start') + text(E.x1 + 8, E.y0 + 24, 'time →', 'xs b', 'end');
  for (const k of ['G', 'A']) s += path(d(ghostSeries, k), C.ghost, 2.2, 'stroke-dasharray="6 5"');
  for (const k of ['Se', 'T', 'G', 'A']) s += path(d(series, k), COL[k], k === 'G' || k === 'A' ? 4 : 2.4);
  s += text(68, 58, 'germs', 'xs b amber', 'start') + text(180, 58, 'antibodies', 'xs b blue', 'start') + text(300, 58, 'alarm', 'xs b purple', 'start') + text(376, 58, 'T cells', 'xs b', 'start');
  s += text(16, 254, 'how high each climbs (dashed: normal)', 'xs b muted', 'start');
  const rows = [['germs', 'germs at worst', C.amber], ['alarm', 'alarm signals', C.purple], ['tcells', 'T cells', C.ink], ['antibodies', 'antibodies', C.blue], ['memory', 'memory cells', C.ink]];
  rows.forEach(([k, w, col], i) => {
    const y = 272 + i * 27;
    s += text(16, y + 13, w, 'xs', 'start');
    s += rect(190, y, 170, 15, 'none', C.ink, 1.5, 'stroke-dasharray="4 3"');
    s += rect(190, y, 170 * clamp(cur[k], 0, 1.6), 15, col);
  });
  return svg(label, s, { h: 420 });
}
function updateExplore() {
  $('#growth').value = ex.growth; $('#growth-label').textContent = growthWords(ex.growth);
  $('#reinfect').checked = ex.reinfect;
  $$('#drugs input').forEach(c => { c.checked = ex.drugs.has(c.value); });
  const opt = exploreOpts(), cur = IM.settle(opt), series = IM.run(opt).series;
  const ghostSeries = ex.reinfect ? IM.run({ reinfect: true }).series : IM.BASE.series;
  const names = IM.DRUGS.filter(d => ex.drugs.has(d)).map(d => EX_NAMES[d]);
  const who = `a germ that multiplies ${growthWords(ex.growth)}${names.length ? `, ${names.join(', ')}` : ', untreated and unvaccinated'}${ex.reinfect ? ', and the same germ returning long after' : ''}`;
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated, unvaccinated response. The top panel plots germs, alarm signals, T cells and antibodies over time; the bars below show how high each climbs. Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = explorePicture(cur, series, ghostSeries, label) + readout(changedFirst(compare(cur, NV)));
  const res = $('#model-results');
  res.textContent = `Illustrative model output, compared with the normal response: germs at their worst ${pct(cur.germs)} · alarm signals at their peak ${pct(cur.alarm)} · T cells at their peak ${pct(cur.tcells)} · antibodies at their peak ${pct(cur.antibodies)} · memory cells left after the first infection ${pct(cur.memory)}.`;
  for (const k of IM.KEYS) res.dataset[k] = cur[k].toFixed(4);
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
$('#growth').addEventListener('input', e => { ex.growth = Number(e.target.value); updateExplore(); });
$('#reinfect').addEventListener('change', e => { ex.reinfect = e.target.checked; updateExplore(); });
$('#reset').addEventListener('click', () => { ex.growth = 1; ex.reinfect = false; ex.drugs.clear(); updateExplore(); });

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const SHARE_KEYS = { neutPct: 'neut', lymphPct: 'lymph', monoPct: 'mono', eosPct: 'eos' };
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    const keys = ['wbc', ...Object.keys(SHARE_KEYS)];
    if (!keys.every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    data = loaded;
    REF.wbc = (byKey('wbc').low + byKey('wbc').high) / 2;
    const mids = Object.fromEntries(Object.entries(SHARE_KEYS).map(([k, r]) => [r, (byKey(k).low + byKey(k).high) / 2]));
    const sum = Object.values(mids).reduce((a, b) => a + b, 0);
    for (const [r, m] of Object.entries(mids)) REF[r] = m / sum;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal total in the middle of its band, and takes the middle of each share band, scaled so the four shares make up the whole (other, rarer white cells are left out), which keeps every share inside its band. The large number in each row is the model’s level turned into the row’s unit: an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. How far the model moves for a condition or a drug is an illustrative choice; only a cited direction is sourced.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v, n);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const [lo, hi] = rangeText(v).split('–');
      const band = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="${pos(v.high) - pos(v.low) < 40 ? 'end' : 'middle'}">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="${pos(v.high) - pos(v.low) < 40 ? 'start' : 'middle'}">${hi}</text>`;
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${rangeText(v)} ${v.unit} as a shaded band, a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `Source range ${rangeText(v)} ${v.unit} (shaded) · blue line: illustrative teaching-model value`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''} `;
      const srcUrl = data.sources[v.source]?.match(/https:\/\/\S+$/)?.[0];
      if (srcUrl) { const a = document.createElement('a'); a.href = srcUrl; a.rel = 'noopener'; a.className = 'cite-link'; a.textContent = 'Read the source section'; cite.append(a); }
      row.append(left, right, ev, cite);
      $('#value-rows').append(row);
    }
    for (const n of data.countNotes || []) {
      const li = document.createElement('li'), b = document.createElement('b');
      li.dataset.countNote = n.id;
      b.textContent = `${n.label}. `;
      li.append(b, `${n.where} [${n.source}]`);
      $('#count-notes').append(li);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'), url = citation.match(/https:\/\/\S+$/)?.[0];
      li.textContent = `[${id}] ${url ? citation.slice(0, -url.length) : citation}`;
      if (url) { const a = document.createElement('a'); a.href = url; a.textContent = url; a.rel = 'noopener'; li.append(a); }
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
