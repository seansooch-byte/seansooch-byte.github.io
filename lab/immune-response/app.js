'use strict';
const IM = window.IRModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NV = IM.NORMAL;

/* ---------- Drawing helpers ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', RED = '#b3261e', MUTED = '#53584d', RULE = '#babeb3';
const PURPLE = '#6b3fa0', TISSUE = '#f8ecdf', SKIN = '#d9b38c', VESSEL = '#f1cdc6', NODE = '#e3e8ff', LOBE = '#7a5ea8';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const H = 620;
const svg = (label, body, h = H) => `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
const line = (x1, y1, x2, y2, col, w, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
function arrow(x1, y1, x2, y2, col, w = 2.5, extra = '') {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 5 + w * 1.6;
  const p = r => `${f(x2 - s * Math.cos(a + r))} ${f(y2 - s * Math.sin(a + r))}`;
  return `<g ${extra}>${line(x1, y1, x2 - Math.cos(a) * s * 0.6, y2 - Math.sin(a) * s * 0.6, col, w)}<path d="M${f(x2)} ${f(y2)} L${p(0.5)} L${p(-0.5)} Z" fill="${col}"/></g>`;
}
// A germ: a round body with short spikes, optionally wearing its name tags (antigens).
function germ(x, y, r = 7, extra = '', tags = false) {
  let s = `<g ${extra}>`;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; s += line(x + r * Math.cos(a), y + r * Math.sin(a), x + (r + 3) * Math.cos(a), y + (r + 3) * Math.sin(a), AMBER, 1.6); }
  s += `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${AMBER}"/>`;
  if (tags) for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2.1; s += tri(x + (r + 2) * Math.cos(a), y + (r + 2) * Math.sin(a), 3.6, INK); }
  return s + '</g>';
}
const tri = (x, y, s, col, extra = '') => `<path ${extra} d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y + s * 0.8)} L${f(x - s)} ${f(y + s * 0.8)} Z" fill="${col}"/>`;
const macrophage = (x, y, s = 1, extra = '') => `<g ${extra}><path d="M${f(x - 20 * s)} ${f(y)} C${f(x - 22 * s)} ${f(y - 18 * s)} ${f(x + 4 * s)} ${f(y - 22 * s)} ${f(x + 18 * s)} ${f(y - 10 * s)} C${f(x + 28 * s)} ${f(y)} ${f(x + 16 * s)} ${f(y + 20 * s)} ${f(x)} ${f(y + 17 * s)} C${f(x - 12 * s)} ${f(y + 16 * s)} ${f(x - 18 * s)} ${f(y + 10 * s)} ${f(x - 20 * s)} ${f(y)} Z" fill="#fff" stroke="${INK}" stroke-width="2"/><ellipse cx="${f(x - 2 * s)}" cy="${f(y + 1 * s)}" rx="${f(7 * s)}" ry="${f(5 * s)}" fill="${MUTED}"/></g>`;
const neutrophil = (x, y, extra = '') => `<g ${extra}><circle cx="${f(x)}" cy="${f(y)}" r="10" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${f(x - 4)}" cy="${f(y - 1)}" r="3" fill="${LOBE}"/><circle cx="${f(x + 1)}" cy="${f(y + 3)}" r="3" fill="${LOBE}"/><circle cx="${f(x + 4)}" cy="${f(y - 3)}" r="3" fill="${LOBE}"/></g>`;
const cell = (x, y, r, letter, kind, extra = '') => {
  const fill = kind === 'T' ? BLUE : kind === 'M' ? INK : '#fff', stroke = kind === 'B' ? BLUE : fill;
  const big = r >= 18, cls = (kind === 'B' ? 'xs b blue nostroke' : 'xs b on') + (big ? ' big' : '');
  return `<g ${extra}><circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>${text(x, y + (big ? 7 : 4), letter, cls)}</g>`;
};
const antibody = (x, y, s = 1, col = BLUE, extra = '', rot = 0) => `<path ${extra} transform="rotate(${rot} ${f(x)} ${f(y)})" d="M${f(x)} ${f(y + 8 * s)} L${f(x)} ${f(y)} L${f(x - 6 * s)} ${f(y - 7 * s)} M${f(x)} ${f(y)} L${f(x + 6 * s)} ${f(y - 7 * s)}" fill="none" stroke="${col}" stroke-width="${f(2.6 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const signal = (x, y, extra = '', s = 4.5) => `<path ${extra} d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y)} L${f(x)} ${f(y + s)} L${f(x - s)} ${f(y)} Z" fill="${PURPLE}"/>`;
const ghostSignal = (x, y, s = 4.5) => `<path data-ghost-signal d="M${f(x)} ${f(y - s)} L${f(x + s)} ${f(y)} L${f(x)} ${f(y + s)} L${f(x - s)} ${f(y)} Z" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="2 2"/>`;
const hexagon = (x, y, r, extra = '') => { const p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push(`${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`); } return `<path ${extra} d="M${p.join(' L')} Z" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`; };
const block = (x, y, w, h, extra) => `<rect ${extra} x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`;
const countOf = (base, v, cap) => clamp(Math.round(base * v), 0, cap);

/* ---------- The overview: a cut in the skin, and the nearest lymph node ---------- */
const GERM_AT = [[140, 84], [118, 104], [162, 106], [96, 88], [184, 86], [140, 128], [206, 120], [80, 120], [116, 150], [228, 96], [170, 152], [60, 98], [246, 132], [92, 170], [214, 164], [256, 80]];
const SIGNAL_AT = [[118, 134], [88, 150], [150, 172], [68, 136], [200, 136], [236, 150], [180, 178], [104, 186], [60, 172], [264, 118], [132, 190], [226, 186], [40, 150], [270, 168]];
const NODE_X = 392, NODE_Y = 146;
const NODE_SPOTS = (() => { const s = []; for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) s.push([360 + c * 22 + (r % 2) * 11, 92 + r * 19]); return s; })();
const AB_AT = [[226, 194], [250, 176], [204, 178], [272, 196], [182, 196], [156, 180], [282, 160], [132, 172], [260, 214], [110, 196], [300, 182], [86, 160], [64, 186], [298, 214]];
function overview(cur, o) {
  const sh = o.parts;
  let b = '';
  const alarm = sh.has('alarm') ? cur.alarm : 0;
  b += `<rect x="14" y="66" width="290" height="140" fill="${TISSUE}"/>`;
  if (sh.has('alarm')) b += `<rect data-swelling x="14" y="66" width="290" height="140" fill="#e39b8b" opacity="${clamp(0.32 * alarm, 0, 0.5).toFixed(2)}"/>`;
  // Skin with a cut.
  b += `<rect x="14" y="50" width="112" height="16" fill="${SKIN}" stroke="${INK}" stroke-width="1.4"/><rect x="154" y="50" width="150" height="16" fill="${SKIN}" stroke="${INK}" stroke-width="1.4"/>`;
  // A blood vessel along the bottom; it widens with the alarm.
  const vw = 20 + (sh.has('alarm') ? 8 * clamp(alarm, 0, 1.5) : 0);
  b += `<rect data-vessel x="14" y="${f(210)}" width="290" height="${f(vw)}" fill="${VESSEL}" stroke="#8c3a2e" stroke-width="1.6"/>`;
  b += text(22, 210 + vw / 2 + 5, 'blood vessel', 'xs', 'start');
  // Germs.
  const nG = countOf(7, cur.germs, GERM_AT.length);
  for (let i = 0; i < nG; i++) b += germ(GERM_AT[i][0], GERM_AT[i][1], 6.5, 'data-germ', sh.has('tag'));
  if (!sh.has('eat')) b += arrow(140, 34, 140, 62, AMBER, 2.2);
  // Eating cells.
  if (sh.has('eat')) {
    b += macrophage(108, 132, 0.95, 'data-eater') + macrophage(214, 146, 0.95, 'data-eater');
    const nN = sh.has('alarm') ? countOf(3, alarm, 5) : 2;
    for (let i = 0; i < nN; i++) b += neutrophil(60 + i * 52, 196 - (i % 2) * 8, 'data-eater');
  }
  if (sh.has('alarm')) { const n = countOf(8, alarm, SIGNAL_AT.length); for (let i = 0; i < n; i++) b += signal(SIGNAL_AT[i][0], SIGNAL_AT[i][1], 'data-signal'); }
  // The lymph node and the cells waiting in it.
  if (sh.has('tag')) {
    b += `<ellipse data-node cx="${NODE_X}" cy="${NODE_Y}" rx="68" ry="86" fill="${NODE}" stroke="${BLUE}" stroke-width="2"/>`;
    b += text(NODE_X, 52, 'lymph node', 'xs b blue');
    b += arrow(262, 102, 326, 102, INK, 2) + text(294, 92, 'tag', 'xs b');
  }
  let spot = 0;
  if (sh.has('tcell')) {
    const nT = sh.has('clone') ? countOf(6, cur.tcells, 12) : 1;
    for (let i = 0; i < nT; i++, spot++) b += cell(NODE_SPOTS[spot][0], NODE_SPOTS[spot][1], 8.5, 'T', 'T', 'data-tcell');
  }
  if (sh.has('bcell')) {
    spot = 12;
    for (let i = 0; i < 3; i++, spot++) b += cell(NODE_SPOTS[spot][0], NODE_SPOTS[spot][1], 8.5, 'B', 'B', 'data-bcell');
    const nA = countOf(6, cur.antibodies, AB_AT.length);
    for (let i = 0; i < nA; i++) b += antibody(AB_AT[i][0], AB_AT[i][1] - 6, 1, BLUE, 'data-antibody', (i * 47) % 360);
    b += arrow(330, 196, 306, 196, BLUE, 2);
  }
  if (sh.has('memory')) {
    spot = 20;
    const nM = countOf(3, cur.memory, 8);
    for (let i = 0; i < nM; i++, spot++) b += cell(NODE_SPOTS[spot][0], NODE_SPOTS[spot][1], 8.5, 'M', 'M', 'data-mcell');
  }
  b += text(20, 46, 'skin', 'xs muted', 'start');
  if (!sh.has('eat')) b += text(150, 30, 'germs get in', 'xs b amber', 'start');
  return b;
}

/* ---------- Close-ups ---------- */
const PANEL = title => `<rect x="12" y="252" width="456" height="190" fill="#fff" stroke="${RULE}"/>${text(26, 276, title, 'xs b muted', 'start')}`;
function closeBarrier() {
  let s = PANEL('close up: the skin, a wall with a gap');
  s += `<rect x="30" y="318" width="186" height="34" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/><rect x="264" y="318" width="186" height="34" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/>`;
  s += text(122, 340, 'skin', 'xs b') + text(358, 340, 'skin', 'xs b') + text(240, 304, 'a cut', 'xs b');
  for (const [x, y] of [[70, 298], [130, 296], [380, 298], [430, 300]]) s += germ(x, y, 6);
  s += arrow(100, 300, 100, 312, MUTED, 1.6) + arrow(410, 300, 410, 312, MUTED, 1.6);
  for (const [x, y] of [[240, 334], [226, 370], [254, 388], [234, 408]]) s += germ(x, y, 6, 'data-entering');
  s += arrow(282, 362, 282, 394, AMBER, 2.2);
  s += text(120, 386, 'most germs are kept out', 'xs muted') + text(330, 424, 'inside: they multiply', 'xs b amber');
  return s;
}
function closeEat() {
  let s = PANEL('close up: an eating cell at work');
  const y = 356;
  s += macrophage(90, y, 1.6) + germ(132, y - 30, 7);
  s += macrophage(240, y, 1.6) + germ(262, y - 14, 7);
  s += `<path d="M${262 - 18} ${y - 28} q18 -12 30 6" fill="none" stroke="${INK}" stroke-width="2"/>`;
  s += macrophage(390, y, 1.6);
  for (const [dx, dy] of [[-6, -6], [6, 2], [-2, 8]]) s += `<circle cx="${390 + dx}" cy="${y + dy}" r="3" fill="${AMBER}"/>`;
  s += arrow(140, 410, 180, 410, MUTED, 2) + arrow(290, 410, 330, 410, MUTED, 2);
  s += text(90, 416, 'reach', 'xs b') + text(240, 416, 'swallow', 'xs b') + text(390, 416, 'break down', 'xs b');
  return s + text(240, 436, 'macrophages and neutrophils both eat germs', 'xs muted');
}
const ALARM_AT = [[140, 300], [170, 322], [196, 300], [226, 322], [252, 298], [282, 318], [310, 300], [338, 322], [366, 300], [392, 320]];
function closeAlarm(cur, o) {
  let s = PANEL('close up: alarm signals at the cut');
  s += macrophage(70, 330, 1.5) + germ(70, 290, 6);
  const n = countOf(8, cur.alarm, ALARM_AT.length);
  if (o.ghost) for (let i = 0; i < 8; i++) s += ghostSignal(ALARM_AT[i][0], ALARM_AT[i][1], 6);
  for (let i = 0; i < n; i++) s += signal(ALARM_AT[i][0], ALARM_AT[i][1], 'data-close-signal', 6);
  s += arrow(100, 316, 128, 308, PURPLE, 2);
  s += text(420, 290, 'alarm', 'xs b purple', 'end') + text(420, 306, 'signals', 'xs b purple', 'end');
  // The vessel wall: gaps open as the alarm rises, and neutrophils squeeze out.
  const leak = clamp(cur.alarm, 0, 1.4);
  const gap = 4 + 14 * leak;
  s += `<rect x="130" y="382" width="320" height="34" fill="${VESSEL}"/>`;
  let wall = '', x0 = 130;
  for (const x of [200, 300, 400]) { wall += line(x0, 380, x - gap / 2, 380, '#8c3a2e', 3); x0 = x + gap / 2; }
  wall += line(x0, 380, 450, 380, '#8c3a2e', 3) + line(130, 418, 450, 418, '#8c3a2e', 3);
  s += `<g data-leak="${leak.toFixed(2)}">${wall}</g>`;
  const nN = countOf(3, cur.alarm, 4);
  for (let i = 0; i < nN; i++) s += neutrophil([200, 300, 400, 250][i], 366, 'data-squeeze');
  s += text(290, 436, 'vessel leaks: eating cells get out', 'xs');
  if (o.drug === 'antitnf') {
    const op = clamp(o.markT, 0, 1).toFixed(2);
    // Two antibody-type drugs (Y shapes) and one decoy catcher (a cup), each holding a signal.
    const decoy = (x, y) => `<path data-drug="antitnf" d="M${x - 9} ${y - 8} L${x - 9} ${y + 4} Q${x} ${y + 14} ${x + 9} ${y + 4} L${x + 9} ${y - 8}" fill="none" stroke="${RED}" stroke-width="3.6" stroke-linecap="round"/>`;
    s += `<g opacity="${op}">${antibody(226, 326, 1.5, RED, 'data-drug="antitnf"')}${decoy(252, 300)}${antibody(282, 322, 1.5, RED, 'data-drug="antitnf"')}</g>`;
    s += text(26, 396, 'anti-TNF', 'xs red b', 'start') + text(26, 412, 'grabs TNF', 'xs red b', 'start');
  }
  return s;
}
function closeTag() {
  let s = PANEL('close up: name tags on a germ');
  s += germ(100, 350, 30, '', false);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; s += tri(100 + 36 * Math.cos(a), 350 + 36 * Math.sin(a), 7, INK, 'data-tag'); }
  s += text(100, 418, 'name tags (antigens)', 'xs b');
  // A tag-carrying eating cell on its way to the node.
  s += `<path d="M262 330 L280 316 L292 334 L314 330 L302 350 L318 368 L294 370 L282 390 L270 370 L248 368 L258 350 L244 332 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>` + tri(304, 322, 7, INK, 'data-carried');
  s += text(282, 418, 'eating cell carries a tag', 'xs b');
  s += arrow(150, 350, 236, 350, MUTED, 2) + arrow(334, 350, 392, 350, INK, 2.4);
  s += `<ellipse cx="428" cy="350" rx="26" ry="34" fill="${NODE}" stroke="${BLUE}" stroke-width="2"/>`;
  return s + text(428, 404, 'to the', 'xs b blue') + text(428, 420, 'lymph node', 'xs b blue');
}
const GROW_AT = [[284, 332], [304, 350], [324, 332], [344, 350], [364, 332], [384, 350]];
const COPY_AT = (() => { const a = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) a.push([318 + c * 34, 394 + r * 26]); return a; })();
function closeSwitch(cur, o) {
  let s = PANEL('close up: a helper T cell switching on');
  // The tag, held up by an eating cell, fits the T cell's receptor.
  s += `<path d="M30 320 L56 318 L66 350 L56 382 L30 380 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>` + tri(74, 350, 8, INK, 'data-shown-tag');
  s += `<circle cx="170" cy="350" r="62" fill="#eef1ff" stroke="${BLUE}" stroke-width="3"/>`;
  s += `<path d="M106 338 L94 350 L106 362" fill="none" stroke="${BLUE}" stroke-width="4"/>`;
  s += text(240, 300, 'helper T cell', 'xs b blue', 'start');
  s += `<rect data-switch x="138" y="338" width="64" height="26" rx="13" fill="#fff" stroke="${INK}" stroke-width="2"/>` + text(170, 356, 'switch', 'xs b');
  s += arrow(110, 350, 134, 350, INK, 2);
  s += text(170, 384, 'calcineurin', 'xs b');
  s += arrow(206, 350, 260, 342, BLUE, 2.4);
  const g = o.drug === 'cni' ? cur.tcells : 1;
  const nG = countOf(6, g, 6);
  if (o.ghost) for (const [x, y] of GROW_AT) s += `<circle data-ghost-grow cx="${x}" cy="${y}" r="5" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="2 2"/>`;
  for (let i = 0; i < nG; i++) s += `<circle data-grow cx="${GROW_AT[i][0]}" cy="${GROW_AT[i][1]}" r="5" fill="${BLUE}"/>`;
  s += text(420, 346, 'grow', 'xs b blue', 'start');
  if (o.drug === 'cni') {
    s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}">${block(170, 330, 30, 16, 'data-drug="cni"')}</g>` + text(26, 434, 'calcineurin inhibitor blocks the switch', 'xs red b', 'start');
    const nC = countOf(8, cur.tcells, 8);
    for (const [x, y] of COPY_AT) s += `<circle data-ghost-copy cx="${x}" cy="${y}" r="9" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
    for (let i = 0; i < nC; i++) s += cell(COPY_AT[i][0], COPY_AT[i][1], 8.5, 'T', 'T', 'data-copy');
    s += text(290, 412, 'copies', 'xs b', 'end');
  } else s += text(240, 432, 'the grow signal tells it to multiply', 'xs muted');
  return s;
}
function closeClone() {
  let s = PANEL('close up: one becomes many') + text(30, 300, 'days ↓', 'xs b', 'start');
  [1, 2, 4, 8].forEach((n, r) => { for (let i = 0; i < n; i++) s += cell(240 + (i - (n - 1) / 2) * 38, 306 + r * 36, 12, 'T', 'T', `data-clone="${r}"`); });
  return s + text(240, 436, 'every copy fits the same tag', 'xs b');
}
function closeBcell(cur) {
  let s = PANEL('close up: a B cell becomes an antibody factory');
  s += cell(70, 360, 24, 'B', 'B') + tri(70, 328, 7, INK) + cell(70, 306, 13, 'T', 'T');
  s += text(70, 412, 'B cell, helped', 'xs b') + text(70, 428, 'by a helper T cell', 'xs');
  s += arrow(102, 360, 142, 360, MUTED, 2);
  s += `<ellipse data-plasma cx="190" cy="360" rx="40" ry="32" fill="#fff" stroke="${BLUE}" stroke-width="3"/>`;
  for (let k = 0; k < 4; k++) s += `<path d="M164 ${344 + k * 9} q26 -6 52 0" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`;
  s += text(190, 412, 'plasma cell', 'xs b');
  const n = countOf(10, cur.antibodies, 16);
  for (let i = 0; i < n; i++) s += antibody(256 + (i % 6) * 34, 312 + Math.floor(i / 6) * 34 + (i % 2) * 10, 1.3, BLUE, 'data-close-antibody', (i * 53) % 360);
  return s + text(352, 428, 'antibodies pour out', 'xs b blue');
}
function closeAttack() {
  let s = PANEL('close up: clearing the germs');
  s += germ(70, 340, 9) + germ(98, 330, 9) + germ(84, 364, 9);
  s += antibody(84, 344, 1.2, BLUE, 'data-close-antibody', 0) + antibody(60, 318, 1.2, BLUE, 'data-close-antibody', -30) + antibody(110, 352, 1.2, BLUE, 'data-close-antibody', 40) + antibody(70, 382, 1.2, BLUE, 'data-close-antibody', 200);
  s += macrophage(170, 350, 1.3) + arrow(150, 330, 126, 336, INK, 2);
  s += text(110, 414, 'antibodies clump germs;', 'xs b') + text(110, 430, 'an eating cell swallows them', 'xs');
  s += line(240, 290, 240, 430, RULE, 1);
  s += `<circle data-infected cx="370" cy="350" r="40" fill="${TISSUE}" stroke="${INK}" stroke-width="2" stroke-dasharray="7 4"/>`;
  for (const [dx, dy] of [[-12, -8], [10, -12], [0, 10], [16, 8]]) s += `<circle cx="${370 + dx}" cy="${350 + dy}" r="4" fill="${AMBER}"/>`;
  s += cell(296, 334, 18, 'T', 'T', 'data-killer') + arrow(316, 340, 332, 344, INK, 2);
  s += text(354, 414, 'killer T cell destroys', 'xs b') + text(354, 430, 'a cell a virus took over', 'xs');
  return s;
}
// Time graph: germs, alarm and antibodies over time, scaled to the normal response's peaks.
const GX0 = 56, GX1 = 448, GY0 = 414, GH = 112;
const PEAK = { G: IM.BASE.raw.germs, Se: IM.BASE.raw.alarm, A: IM.BASE.raw.antibodies, T: IM.BASE.raw.tcells };
function curvePath(xs, ys, peak, x0 = GX0, x1 = GX1, t0 = 0, t1 = IM.DAYS) {
  const pts = [];
  xs.forEach((t, i) => { if (t >= t0 - 1e-9 && t <= t1 + 1e-9) pts.push(`${f(x0 + (x1 - x0) * (t - t0) / (t1 - t0))} ${f(GY0 - GH * clamp(ys[i] / peak, 0, 1.6) * 0.6)}`); });
  return `M${pts.join(' L')}`;
}
const CURVES = [['G', AMBER, 'germs'], ['Se', PURPLE, 'alarm'], ['A', BLUE, 'antibodies']];
function axes(label = 'amount ↑') {
  return line(GX0, 296, GX0, GY0, INK, 1.5) + line(GX0, GY0, GX1, GY0, INK, 1.5) + text(GX1, 434, 'time →', 'xs', 'end')
    + `<text transform="rotate(-90 36 356)" x="36" y="356" text-anchor="middle" class="xs">${label}</text>`;
}
function closeCurve(o) {
  let s = PANEL(o.ghostSeries ? 'one infection over time (illustrative model)' : 'one infection over time') + axes();
  const ser = o.series;
  if (o.ghostSeries) for (const [k] of CURVES) s += `<path data-ghost-curve="${k}" d="${curvePath(o.ghostSeries.t, o.ghostSeries[k], PEAK[k])}" fill="none" stroke="${MUTED}" stroke-width="1.8" stroke-dasharray="6 5"/>`;
  for (const [k, col] of CURVES) s += `<path data-curve="${k}" d="${curvePath(ser.t, ser[k], PEAK[k])}" fill="none" stroke="${col}" stroke-width="${k === 'Se' ? 2.2 : 3.2}"/>`;
  s += text(118, 294, 'germs', 'xs b amber') + text(86, 334, 'alarm', 'xs b purple', 'start') + text(250, 294, 'antibodies', 'xs b blue', 'start');
  if (!o.ghostSeries) s += text(66, 404, 'innate', 'xs muted', 'start') + text(206, 404, 'adaptive', 'xs muted', 'start');
  if (o.drug === 'vaccine') {
    const op = clamp(o.markT, 0, 1).toFixed(2);
    s += `<g opacity="${op}">${[0, 1, 2].map(i => tri(352 + i * 18, 322, 7, RED, 'data-drug="vaccine"')).join('')}${text(448, 346, 'vaccine given earlier:', 'xs red b', 'end')}${text(448, 362, 'harmless tags', 'xs red b', 'end')}</g>`;
  }
  return s;
}
const REPEAT = IM.run({ reinfect: true }).series;
function closeMemory() {
  let s = PANEL('the same germ, met twice') + axes();
  const segs = [[GX0, 244, 0, IM.DAYS], [262, GX1, 2 * IM.DAYS, 3 * IM.DAYS]];
  for (const [x0, x1, t0, t1] of segs) for (const [k, col] of [['G', AMBER], ['A', BLUE]]) s += `<path data-mem-curve="${k}" d="${curvePath(REPEAT.t, REPEAT[k], PEAK[k], x0, x1, t0, t1)}" fill="none" stroke="${col}" stroke-width="3"/>`;
  s += `<rect x="246" y="300" width="14" height="118" fill="#fff"/>` + line(244, 408, 252, 420, INK, 1.5) + line(254, 408, 262, 420, INK, 1.5);
  s += text(150, 296, 'first meeting', 'xs b') + text(356, 296, 'same germ, later', 'xs b');
  s += text(98, 330, 'germs', 'xs b amber', 'start') + text(196, 326, 'antibodies', 'xs b blue', 'start');
  return s + text(300, 344, 'sooner, higher', 'xs b blue', 'start') + text(276, 392, 'germs barely rise', 'xs b amber', 'start');
}
function closeWhole() {
  let s = PANEL('where medicines can steer it');
  const items = [[96, 316, 'memory', INK], [330, 316, 'T cell on switch', BLUE], [96, 396, 'TNF alarm signal', PURPLE], [330, 396, 'alarm instructions', PURPLE]];
  for (const [x, y, label, col] of items) s += `<g data-target><circle cx="${x - 56}" cy="${y - 5}" r="13" fill="none" stroke="${RED}" stroke-width="2.5"/><circle cx="${x - 56}" cy="${y - 5}" r="5" fill="${col}"/></g>` + text(x - 36, y, label, 'sm b', 'start');
  return s + text(240, 436, 'four points, four kinds of medicine', 'xs muted');
}
const OUT_AT = [[250, 300], [278, 314], [306, 300], [334, 314], [362, 300], [390, 314], [418, 300], [446, 314]];
const TOUT_AT = (() => { const a = []; for (let i = 0; i < 6; i++) a.push([262 + i * 34, 396]); return a; })();
function closeSteroid(cur, o) {
  let s = PANEL('close up: inside an immune cell');
  s += `<circle cx="150" cy="362" r="56" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="150" cy="362" r="25" fill="#f1ede2" stroke="${MUTED}" stroke-width="2"/>`;
  s += text(150, 436, 'instructions inside', 'xs muted');
  s += arrow(204, 334, 236, 312, PURPLE, 2) + arrow(204, 390, 236, 396, BLUE, 2);
  if (o.ghost) {
    for (const [x, y] of OUT_AT) s += ghostSignal(x, y, 6);
    for (const [x, y] of TOUT_AT) s += `<circle data-ghost-copy cx="${x}" cy="${y}" r="10" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
  }
  const nS = countOf(8, cur.alarm, 8), nT = countOf(6, cur.tcells, 6);
  for (let i = 0; i < nS; i++) s += signal(OUT_AT[i][0], OUT_AT[i][1], 'data-close-signal', 6);
  for (let i = 0; i < nT; i++) s += cell(TOUT_AT[i][0], TOUT_AT[i][1], 9, 'T', 'T', 'data-copy');
  s += text(448, 340, 'alarm signals made', 'xs b purple', 'end') + text(448, 428, 'T cells multiplying', 'xs b blue', 'end');
  if (o.drug === 'gc') {
    const op = clamp(o.markT, 0, 1).toFixed(2);
    s += `<g opacity="${op}">${hexagon(40, 322, 10, 'data-drug="gc"')}${hexagon(150, 362, 10, 'data-drug="gc"')}${arrow(50, 330, 132, 356, RED, 2)}</g>` + text(26, 300, 'glucocorticoid', 'xs red b', 'start');
  }
  return s;
}
function closeGraph(o) {
  const days = o.series.t[o.series.t.length - 1];
  let s = PANEL('germs, alarm and antibodies over time (illustrative model)') + axes();
  const all = [...CURVES, ['T', INK, 'T cells']];
  for (const [k] of all) if (o.ghostSeries) s += `<path data-ghost-curve="${k}" d="${curvePath(o.ghostSeries.t, o.ghostSeries[k], PEAK[k], GX0, GX1, 0, days)}" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="6 5"/>`;
  for (const [k, col] of all) s += `<path data-curve="${k}" d="${curvePath(o.series.t, o.series[k], PEAK[k], GX0, GX1, 0, days)}" fill="none" stroke="${col}" stroke-width="${k === 'A' || k === 'G' ? 3.2 : 2}"/>`;
  return s + text(448, 294, 'germs · alarm · T cells · antibodies', 'xs b', 'end');
}

/* ---------- Meters: how high each measure climbs ---------- */
const METERS = [['alarm', ['alarm', 'signals'], PURPLE], ['tcells', ['T cells'], BLUE], ['memory', ['memory', 'cells'], INK], ['germs', ['germs'], AMBER], ['antibodies', ['antibodies'], BLUE]];
const MX = i => 52 + i * 94, BASE_Y = 572, meterH = v => clamp(56 * v, 0, 84);
function meters(cur, o) {
  let s = line(12, 452, 468, 452, RULE, 1);
  s += text(12, 474, o.key ? 'how high each one climbs' : 'taller bar: more of it', 'xs b muted', 'start');
  if (o.key) s += `<rect data-key-measure x="${MX(3) - 44}" y="482" width="${MX(4) - MX(3) + 88}" height="134" fill="none" stroke="${BLUE}" stroke-width="2"/>` + text((MX(3) + MX(4)) / 2, 474, 'key measures', 'xs b blue');
  METERS.forEach(([k, words, col], i) => {
    if (!o.meters.includes(k)) return;
    const x = MX(i), h = meterH(cur[k]);
    s += line(x - 26, BASE_Y, x + 26, BASE_Y, INK, 1.5);
    if (o.ghost) s += `<rect data-ghost-meter="${k}" x="${x - 18}" y="${f(BASE_Y - meterH(o.ghost[k]))}" width="36" height="${f(meterH(o.ghost[k]))}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<rect data-meter="${k}" x="${x - 14}" y="${f(BASE_Y - h)}" width="28" height="${f(h)}" fill="${col}"/>`;
    words.forEach((w, j) => { s += text(x, 592 + j * 17, w, 'xs b'); });
  });
  return s;
}
function header(o) {
  if (!o.legend) return text(12, 22, o.title, 'xs b muted', 'start');
  return line(14, 17, 44, 17, INK, 2, 'stroke-dasharray="5 4"') + text(52, 22, 'normal', 'xs b', 'start')
    + line(124, 17, 154, 17, INK, 5) + text(162, 22, o.legend, 'xs b', 'start');
}
function picture(cur, o) {
  let close;
  switch (o.focus) {
    case 'barrier': close = closeBarrier(); break;
    case 'eat': close = closeEat(); break;
    case 'alarm': close = closeAlarm(cur, o); break;
    case 'tag': close = closeTag(); break;
    case 'switch': close = closeSwitch(cur, o); break;
    case 'clone': close = closeClone(); break;
    case 'bcell': close = closeBcell(cur); break;
    case 'attack': close = closeAttack(); break;
    case 'curve': close = closeCurve(o); break;
    case 'memory': close = closeMemory(); break;
    case 'steroid': close = closeSteroid(cur, o); break;
    case 'graph': close = closeGraph(o); break;
    default: close = closeWhole();
  }
  const ghost = o.ghost ? `<g data-ghost="normal" ${attrs(o.ghost)}></g>` : '';
  return header(o) + ghost + `<g data-new-state ${attrs(cur)}>` + overview(cur, o) + close + meters(cur, o) + '</g>';
}
const attrs = v => IM.KEYS.map(k => `data-${k}="${v[k].toFixed(4)}"`).join(' ');

/* ---------- Words for changes ---------- */
const ROWS = [['germs', 'Germs at their worst', 'more', 'fewer'], ['alarm', 'Alarm signals', 'more', 'fewer'], ['tcells', 'T cells', 'more', 'fewer'], ['antibodies', 'Antibodies', 'more', 'fewer'], ['memory', 'Memory cells', 'more', 'fewer']];
function more(a, b, up, down) {
  if (Math.abs(a - b) < 0.03 * Math.max(b, 0.05)) return ['about the same', 'same'];
  return a > b ? [up, 'up'] : [down, 'down'];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- Lesson steps ---------- */
const P1 = [], P2 = ['eat'], P3 = [...P2, 'alarm'], P4 = [...P3, 'tag'], P5 = [...P4, 'tcell'], P6 = [...P5, 'clone'], P7 = [...P6, 'bcell'], P10 = [...P7, 'memory'];
const M_ALL = METERS.map(m => m[0]);
const CORE = {
  invader: { parts: P1, focus: 'barrier', meters: ['germs'], title: 'a cut in the skin',
    label: 'Germs, drawn as small spiky balls, enter the body through a cut in the skin and spread into the tissue above a blood vessel. Close up, the skin is a wall that keeps most germs out, but they pass through the gap of the cut and multiply inside. A bar gauge labelled germs shows how many there are.' },
  eat: { parts: P2, focus: 'eat', meters: ['germs'], title: 'a cut in the skin',
    label: 'Eating cells have arrived among the germs: two large macrophages and smaller neutrophils with lobed centres, some leaving the blood vessel. Close up, a macrophage reaches for a germ, swallows it and breaks it into pieces.' },
  alarm: { parts: P3, focus: 'alarm', meters: ['alarm', 'germs'], title: 'a cut in the skin',
    label: 'Small purple diamonds, the alarm signals, spread through the tissue, which turns pink and swollen, and the blood vessel widens. Close up, a macrophage that has met a germ sends out alarm signals; the vessel wall opens gaps and neutrophils squeeze out. A new gauge shows the alarm signals.' },
  tag: { parts: P4, focus: 'tag', meters: ['alarm', 'germs'], title: 'the cut, and the nearest lymph node',
    label: 'The germs now show small black triangles on their surface, their name tags. A lymph node, drawn as a large blue bean, sits beside the tissue, and an arrow carries a tag to it. Close up, a germ covered with tags, and a star-shaped eating cell carrying one tag toward the lymph node.' },
  switch: { parts: P5, focus: 'switch', meters: ['alarm', 'germs'], title: 'the cut, and the nearest lymph node',
    label: 'One blue T cell waits in the lymph node. Close up, an eating cell holds up a tag that fits the notch on a helper T cell. Inside the T cell, the fit flips a switch, calcineurin, which sends out a stream of blue dots: the grow signal.' },
  clone: { parts: P6, focus: 'clone', meters: ['alarm', 'tcells', 'germs'], title: 'the cut, and the nearest lymph node',
    label: 'The lymph node fills with blue T cells. Close up, one T cell becomes two, then four, then eight down the page as days pass, all fitting the same tag. A T cells gauge appears.' },
  bcell: { parts: P7, focus: 'bcell', meters: ['alarm', 'tcells', 'germs', 'antibodies'], title: 'the cut, and the nearest lymph node',
    label: 'B cells, white circles with a blue rim, sit in the lymph node, and Y-shaped antibodies flow from the node into the tissue. Close up, a B cell holding the tag is helped by a helper T cell, turns into a large plasma cell and pours out antibodies. An antibodies gauge appears.' },
  attack: { parts: P7, focus: 'attack', meters: ['alarm', 'tcells', 'germs', 'antibodies'], title: 'the cut, and the nearest lymph node',
    label: 'Close up, on the left, antibodies stick germs together in a clump and a macrophage moves in to swallow it. On the right, a killer T cell presses against a body cell full of virus and destroys it.' },
  curve: { parts: P7, focus: 'curve', meters: ['alarm', 'tcells', 'germs', 'antibodies'], title: 'the cut, and the nearest lymph node',
    label: 'A timeline with time to the right and amount upward. The germ curve rises first and falls; the alarm curve rises with the germs and fades after them; the antibody curve starts late, climbs high after the germs peak, and slowly drifts down. Innate is marked early and adaptive later.' },
  memory: { parts: P10, focus: 'memory', meters: M_ALL, title: 'the cut, and the nearest lymph node',
    label: 'Black memory cells now sit in the lymph node. Close up, two timelines side by side: the first meeting with a germ, where germs climb high and antibodies rise late, and the same germ met again later, where germs barely rise and antibodies rise sooner and higher. A memory cells gauge appears.' },
  whole: { parts: P10, focus: 'whole', meters: M_ALL, key: true, title: 'the whole response',
    label: 'The whole response: germs at the cut, eating cells, alarm signals and swelling, and the lymph node with T cells, B cells, antibodies and memory cells. Four targets are marked: memory, the T cell on switch, the TNF alarm signal and the instructions for alarm signals. The germs and antibodies gauges are framed as the key measures.' }
};
const CHANGES = {
  vaccine: { focus: 'curve', legend: 'after a vaccine', opt: { vaccine: true }, where: 'Close up, on the timeline, red tags mark a vaccine given earlier; when the real germ arrives the germ curve stays almost flat and the antibody curve rises early, against the dashed normal curves.' },
  cni: { focus: 'switch', legend: 'with a calcineurin inhibitor', opt: { cni: true }, where: 'Close up, a red block sits on the T cell’s calcineurin switch, the blue grow signal dots fade away and only one or two T cell copies form among dashed outlines of the normal crowd.' },
  antitnf: { focus: 'alarm', legend: 'with an anti-TNF biologic', opt: { antitnf: true }, where: 'Close up, red drug molecules, two Y-shaped antibodies and one cup-shaped decoy catcher, grab the alarm signals, most of the purple signals vanish leaving dashed outlines, the gaps in the vessel wall narrow and fewer neutrophils squeeze out.' },
  gc: { focus: 'steroid', legend: 'with a glucocorticoid', opt: { gc: true }, where: 'Close up, a red glucocorticoid hexagon enters an immune cell and sits on its instructions; fewer alarm signals are made and fewer T cells multiply, against dashed outlines of the normal numbers.' }
};
const ENDS = Object.fromEntries(Object.entries(CHANGES).map(([k, c]) => [k, IM.settle(c.opt)]));
const END_SERIES = Object.fromEntries(Object.entries(CHANGES).map(([k, c]) => [k, IM.run(c.opt).series]));
const lerpSeries = (a, b, t) => { const o = { t: a.t }; for (const k of ['G', 'Se', 'T', 'A', 'M']) o[k] = a[k].map((v, i) => v + (b[k][i] - v) * t); return o; };
function corePicture(kind) {
  const c = CORE[kind];
  return svg(c.label, picture(NV, { ...c, parts: new Set(c.parts), markT: 0, series: IM.BASE.series }));
}
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind], e = ease(t);
  const cur = IM.lerp(NV, ENDS[kind], e);
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal, the untreated, unvaccinated response. ${c.where} Compared with normal: ${describe(cur, NV)}.`;
  const o = { parts: new Set(P10), focus: c.focus, meters: M_ALL, key: true, ghost: NV, legend: c.legend, drug: kind, markT: t * 3,
    series: lerpSeries(IM.BASE.series, END_SERIES[kind], e), ghostSeries: IM.BASE.series };
  return { pic: svg(label, picture(cur, o)), ro: readout(cur, NV, 'Compared with normal') };
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frame = 0;
const visualOf = el => el.querySelector('[data-visual]');
const isAnimated = el => el.dataset.kind in CHANGES;
const lastReadout = new WeakMap();
function drawAt(el, t) {
  const v = visualOf(el), { pic, ro } = changePicture(el, t), old = v.querySelector('svg');
  if (!old) { v.innerHTML = pic + ro; lastReadout.set(v, ro); return; }
  old.outerHTML = pic;
  if (lastReadout.get(v) !== ro) { v.querySelector('.readout').outerHTML = ro; lastReadout.set(v, ro); }
}
function animate(el) {
  cancelAnimationFrame(frame);
  if (reducedMotion()) { drawAt(el, 1); return; }
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / DURATION);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
let started = false;
function startLesson() {
  steps.forEach(el => {
    const k = el.dataset.kind;
    if (CORE[k]) visualOf(el).innerHTML = corePicture(k);
    if (isAnimated(el)) drawAt(el, 1);
    el.querySelector('.replay')?.addEventListener('click', () => animate(el));
  });
  started = true;
  if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(current);
}
function showStep(n, focus = false) {
  if (!started) return;
  cancelAnimationFrame(frame);
  if (isAnimated(steps[current])) drawAt(steps[current], 1);   // a step left mid-morph keeps its end state
  current = clamp(n, 0, steps.length - 1);
  steps.forEach((el, i) => { el.hidden = i !== current; });
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === steps.length - 1 ? 'Start again ↻' : 'Next →';
  progress.textContent = `Step ${current + 1} of ${steps.length}`;
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  const el = steps[current];
  if (isAnimated(el)) animate(el);
  if (focus) { el.querySelector('h2').focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
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
  cancelAnimationFrame(frame);   // a morph left running must not overwrite the end state drawn below
  if (tab.id === 'tab-lesson' && started && isAnimated(steps[current])) drawAt(steps[current], 1);
  if (tab.id === 'tab-clinical') updateClinical();
  if (tab.id === 'tab-explore') updateExplore();
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
  if (m && started) { if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]); showStep(Number(m[1]) - 1); }
}
window.addEventListener('hashchange', fromHash);

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
const span = v => hasRange(v) ? [Math.max(0, v.low - (v.high - v.low)), v.high + (v.high - v.low)] : [v.typical * 0.5, v.typical * 1.5];
const barX = (v, n) => { const [a, b] = span(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
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
  n: (x, y) => `<g data-cell-kind="neutrophil"><circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><circle cx="${x - 5}" cy="${y - 2}" r="4" fill="${LOBE}"/><circle cx="${x + 1}" cy="${y + 4}" r="4" fill="${LOBE}"/><circle cx="${x + 6}" cy="${y - 3}" r="4" fill="${LOBE}"/></g>`,
  l: (x, y) => `<g data-cell-kind="lymphocyte"><circle cx="${x}" cy="${y}" r="12" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="9" fill="${BLUE}"/></g>`,
  m: (x, y) => `<g data-cell-kind="monocyte"><circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><path d="M${x - 7} ${y - 4} q7 12 14 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g>`,
  e: (x, y) => `<g data-cell-kind="eosinophil"><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><circle cx="${x - 4}" cy="${y}" r="4" fill="${AMBER}"/><circle cx="${x + 4}" cy="${y}" r="4" fill="${AMBER}"/><circle cx="${x}" cy="${y - 6}" r="2" fill="${RED}"/><circle cx="${x}" cy="${y + 6}" r="2" fill="${RED}"/></g>`
};
function bloodPicture(m, label) {
  // An illustrative drop of blood: white cells in proportion to the model.
  let s = `<rect x="0" y="0" width="480" height="300" fill="#fbf1ef"/>` + text(16, 26, 'a drop of blood (illustrative model)', 'xs b muted', 'start');
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
  const legend = `<g>${KIND_DRAW.n(24, 320).replace('data-cell-kind="neutrophil"', '')}${text(44, 325, 'neutrophil', 'xs', 'start')}${KIND_DRAW.l(146, 320).replace('data-cell-kind="lymphocyte"', '')}${text(164, 325, 'lymphocyte', 'xs', 'start')}${KIND_DRAW.m(270, 320).replace('data-cell-kind="monocyte"', '')}${text(290, 325, 'monocyte', 'xs', 'start')}${KIND_DRAW.e(384, 320).replace('data-cell-kind="eosinophil"', '')}${text(402, 325, 'eosinophil', 'xs', 'start')}</g>`;
  return svg(label, s + legend, 344);
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
function updateExplore() {
  $('#growth').value = ex.growth; $('#growth-label').textContent = growthWords(ex.growth);
  $('#reinfect').checked = ex.reinfect;
  $$('#drugs input').forEach(c => { c.checked = ex.drugs.has(c.value); });
  const opt = exploreOpts(), cur = IM.settle(opt), series = IM.run(opt).series;
  const ghostSeries = ex.reinfect ? IM.run({ reinfect: true }).series : IM.BASE.series;
  const names = IM.DRUGS.filter(d => ex.drugs.has(d)).map(d => EX_NAMES[d]);
  const who = `a germ that multiplies ${growthWords(ex.growth)}${names.length ? `, ${names.join(', ')}` : ', untreated and unvaccinated'}${ex.reinfect ? ', and the same germ returning long after' : ''}`;
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated, unvaccinated response. The lower panel plots germs, alarm signals, T cells and antibodies over time. Compared with normal: ${describe(cur, NV)}.`;
  const o = { parts: new Set(P10), focus: 'graph', meters: M_ALL, key: true, ghost: NV, legend: 'your settings', series, ghostSeries, markT: 0 };
  $('#explore-visual').innerHTML = svg(label, picture(cur, o)) + readout(cur, NV, 'Compared with normal');
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
  startLesson();
  updateClinical();
  updateExplore();
}
load();
