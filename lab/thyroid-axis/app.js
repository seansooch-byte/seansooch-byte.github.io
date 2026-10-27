'use strict';
const TM = window.ThyroidModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The model ----------
   view(): the settled loop for a set of model settings (model.js); every level is relative to normal (1). */
const view = p => TM.settle(p);
const NORMAL_P = TM.build('normal');
const NV = view(NORMAL_P);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', AMBERF = '#f2a93b', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const BLOOD = '#f6dcd6', BANDF = '#d1d8fd', SKIN = '#f3e4d6', GLAND = '#e2a397';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const lines = (x, y, words, cls, anchor = 'start') => words.map((w, i) => text(x, y + i * 15, w, cls, anchor)).join('');
const svg = (label, body, h) => `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
// A straight arrow with its own head (no markers, so hidden steps never break shared ids).
function arrow(x1, y1, x2, y2, w, color, extra = '') {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${color}" stroke-width="${f(w)}" fill="none"/>` +
    `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${color}"/></g>`;
}
// The ghost of an arrow: a dashed outline of its normal width, set just beside the solid one.
function ghostArrow(x1, y1, x2, y2, w, color) {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".75"/>`;
}
const width = v => v <= 0.03 ? 0 : clamp(2 + 6 * v, 2, 14);

// Fixed, shuffled places for hormone dots inside the blood vessel.
const SLOTS = (() => {
  const s = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 30; c++) s.push([66 + c * 13.4 + (r % 2) * 6.7, 326 + r * 12]);
  let seed = 7;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const t4Dot = (x, y, r = 4.6) => `<circle data-t4 cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${AMBERF}" stroke="${AMBER}" stroke-width="1.5"/>`;
const t3Dot = (x, y, r = 5) => `<path data-t3 d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${AMBER}"/>`;
const hormoneDot = (x, y) => `<circle data-hormone cx="${f(x)}" cy="${f(y)}" r="4.6" fill="${AMBERF}" stroke="${AMBER}" stroke-width="1.5"/>`;
const iodineDot = (x, y, hot = false) => `<circle data-iodine cx="${f(x)}" cy="${f(y)}" r="3.2" fill="${hot ? RED : '#fff'}" stroke="${hot ? RED : INK}" stroke-width="1.4"/>`;

/* The gauges at the top right: TSH, T4 and T3 in the blood, on a ratio scale, with the healthy band from the data file. */
const GX = { tsh: 352, t4: 402, t3: 452 }, GTOP = 58, GBOT = 278, GMID = 168, GHALF = 108;
const SPAN = { tsh: Math.log(12), t4: Math.log(3.2), t3: Math.log(3.2) };
const relOf = (v, k) => k === 'tsh' ? v.tsh : k === 't4' ? v.t4 : v.t3;
const gyRaw = (k, rel) => Math.log(Math.max(rel, 1e-6)) / SPAN[k];
const gy = (k, rel) => GMID - clamp(gyRaw(k, rel), -1, 1) * GHALF;
let BANDS = null;   // set from clinical-values.json; until then the band is an illustrative fallback
const FALLBACK = { tsh: [GMID - 45, GMID + 45], t4: [GMID - 38, GMID + 38], t3: [GMID - 38, GMID + 38] };
const bandY = k => BANDS ? [gy(k, BANDS[k][1]), gy(k, BANDS[k][0])] : FALLBACK[k];
const inBand = (k, rel) => { const [a, b] = bandY(k), y = gy(k, rel); return y >= a - 0.01 && y <= b + 0.01; };
const GLABEL = { tsh: 'TSH', t4: 'T4', t3: 'T3' };
function gauges(cur, ghost, before, keys, header = 'in the blood') {
  let b = text(402, 22, header, 'xs b' + (header === 'in the blood' ? '' : ' blue'));
  b += text(330, 100, '↑', 'xs muted', 'end') + text(330, 116, 'higher', 'xs muted', 'end') + text(330, 206, 'lower', 'xs muted', 'end') + text(330, 222, '↓', 'xs muted', 'end');
  for (const k of keys) {
    const x = GX[k], col = k === 'tsh' ? BLUE : AMBER, [b0, b1] = bandY(k);
    b += `<path d="M${x} ${GTOP} V${GBOT}" stroke="${RULE}" stroke-width="4"/>`;
    b += `<rect data-band="${k}" x="${x - 15}" y="${f(b0)}" width="30" height="${f(b1 - b0)}" fill="${BANDF}"/>`;
    b += text(x, 46, GLABEL[k], 'xs b ' + (k === 'tsh' ? 'blue' : 'amber'));
    if (ghost) b += `<path data-ghost-gauge="${k}" d="M${x - 19} ${f(gy(k, relOf(ghost, k)))} H${x + 19}" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`;
    if (before) b += `<path data-before-gauge="${k}" d="M${x - 19} ${f(gy(k, relOf(before, k)))} H${x + 19}" stroke="${MUTED}" stroke-width="2.6" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>`;
    const rel = relOf(cur, k), y = gy(k, rel), raw = gyRaw(k, rel);
    b += `<rect data-gauge="${k}" data-level="${rel.toFixed(3)}" x="${x - 14}" y="${f(y - 4)}" width="28" height="8" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
    if (raw > 1) b += `<path d="M${x} ${GTOP - 12} l-7 9 h14 Z" fill="${col}"/>`;
    if (raw < -1) b += `<path d="M${x} ${GBOT + 12} l-7 -9 h14 Z" fill="${col}"/>`;
  }
  b += text(402, 300, 'shaded: healthy band', 'xs muted');
  return b;
}

/* The thyroid: two lobes joined by a bridge, drawn around the windpipe; size follows the model. */
const LOBES = 'M-9 -4 C-18 -38 -50 -46 -58 -16 C-63 8 -50 36 -26 36 C-14 36 -9 24 -9 12 Z M9 -4 C18 -38 50 -46 58 -16 C63 8 50 36 26 36 C14 36 9 24 9 12 Z M-10 0 H10 V12 H-10 Z';
const TC = [150, 238];
function gland(gs, extra = '') {
  return `<g transform="translate(${TC[0]} ${TC[1]}) scale(${gs.toFixed(3)})"${extra}><path d="${LOBES}" fill="${GLAND}" stroke="${INK}" stroke-width="${f(2 / gs)}"/>` +
    [[-40, -14], [-30, 12], [-46, 6], [40, -14], [30, 12], [46, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f4d9b0" stroke="#b06e60" stroke-width="${f(1 / gs)}"/>`).join('') + '</g>';
}
const glandGhost = gs => `<path data-ghost-gland transform="translate(${TC[0]} ${TC[1]}) scale(${gs.toFixed(3)})" d="${LOBES}" fill="none" stroke="${INK}" stroke-width="${f(1.6 / gs)}" stroke-dasharray="${f(5 / gs)} ${f(4 / gs)}" opacity=".7"/>`;
const sideX = gs => Math.min(246, TC[0] + 62 * gs + 6);
function trefoil(cx, cy, r) {
  let d = '';
  for (const a0 of [-90, 30, 150]) {
    const a = (a0 - 30) * Math.PI / 180, c = (a0 + 30) * Math.PI / 180, r0 = r * .3;
    d += `M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))} L${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))} A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(c))} ${f(cy + r * Math.sin(c))} L${f(cx + r0 * Math.cos(c))} ${f(cy + r0 * Math.sin(c))} Z `;
  }
  return `<g data-rai><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#f6d34a" stroke="${INK}" stroke-width="1.4"/><path d="${d}" fill="${INK}"/><circle cx="${cx}" cy="${cy}" r="${f(r * .18)}" fill="${INK}"/></g>`;
}
const antibody = (x, y, s = 1) => `<path data-antibody d="M${f(x)} ${f(y + 8 * s)} V${f(y)} M${f(x)} ${f(y)} L${f(x - 6 * s)} ${f(y - 7 * s)} M${f(x)} ${f(y)} L${f(x + 6 * s)} ${f(y - 7 * s)}" stroke="${RED}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;

/* Heartbeat trace and the body's pace dial. */
function trace(hr, y, extra) {
  const P = 38 / Math.max(hr, 0.2), x0 = 108, x1 = 288;
  let d = `M${x0} ${y}`, n = 0;
  for (let bx = x0 + 12; bx < x1 - 6; bx += P) { d += ` L${f(bx - 4)} ${y} L${f(bx - 1)} ${y - 18} L${f(bx + 2)} ${y + 8} L${f(bx + 5)} ${y}`; n++; }
  return `<path ${extra} data-beats="${n}" d="${d} L${x1} ${y}" fill="none" stroke-linejoin="round"/>`;
}
const DIAL = [398, 470, 52];
const needleAngle = pace => clamp((pace - 1) * 1.7, -1.4, 1.4);
function needle(pace, attrs) {
  const a = needleAngle(pace), [cx, cy, r] = DIAL;
  return `<path ${attrs} d="M${cx} ${cy} L${f(cx + (r - 8) * Math.sin(a))} ${f(cy - (r - 8) * Math.cos(a))}" stroke-linecap="round"/>`;
}

const ALL = ['neck', 'thyroid', 'blood', 'release', 'dial', 'forms', 'gauges', 'brain', 'pituitary', 'tsh', 'hypothalamus', 'trh', 'brake', 'heart'];
function body(v, show, ghost, before, marks) {
  const has = k => show.includes(k), p = v.p, gs = v.gland;
  let b = `<ellipse cx="150" cy="84" rx="118" ry="74" fill="${SKIN}" stroke="${RULE}" stroke-width="1.5"/>`;
  b += `<rect x="100" y="146" width="100" height="168" fill="${SKIN}" stroke="${RULE}" stroke-width="1.5"/><path d="M101 147 H199" stroke="${SKIN}" stroke-width="3"/>`;
  b += `<rect x="138" y="160" width="24" height="154" fill="#faf3ec" stroke="${RULE}" stroke-width="1.2"/>`;
  for (let y = 186; y < 312; y += 12) b += `<path d="M139 ${y} H161" stroke="${RULE}" stroke-width="1.2"/>`;
  b += `<rect x="130" y="156" width="40" height="22" rx="8" fill="#faf3ec" stroke="${RULE}" stroke-width="1.4"/>`;
  if (has('labels1')) {
    b += `<path d="M172 167 H232 M163 296 H232" stroke="${MUTED}" stroke-width="1"/>` + text(236, 171, 'voice box', 'xs b', 'start') + text(236, 300, 'windpipe', 'xs b', 'start');
    b += text(150, 30, 'head', 'xs muted') + text(84, 290, 'neck', 'xs muted', 'end');
  }
  // Brain: hypothalamus and pituitary
  if (has('brain')) b += text(150, 30, 'brain', 'xs b muted');
  if (has('hypothalamus')) {
    b += `<ellipse cx="150" cy="58" rx="38" ry="17" fill="#e8cfe0" stroke="${INK}" stroke-width="2"/>` + text(194, 62, 'hypothalamus', 'xs b', 'start');
  }
  if (has('pituitary')) {
    b += `<path d="M150 ${has('hypothalamus') ? 75 : 66} V112" stroke="${INK}" stroke-width="3"/><circle cx="150" cy="124" r="13" fill="#e8cfe0" stroke="${INK}" stroke-width="2"/>` + text(170, 129, 'pituitary', 'xs b', 'start');
  }
  // The thyroid
  if (ghost && has('thyroid')) b += glandGhost(ghost.gland);
  if (has('thyroid')) {
    b += gland(gs, ` data-thyroid="${gs.toFixed(3)}"`);
    b += text(sideX(gs), 228, 'thyroid', 'xs b', 'start');
  }
  // Marks for diseases and treatments at the gland
  let sideLabel = null;
  const imm = marks.immune || 0;
  if (imm > 0) {
    const pts = [[-40, -10], [-28, 18], [36, -6], [28, 20], [-50, 4], [48, 10]];
    pts.slice(0, Math.round(6 * imm)).forEach(([x, y]) => { b += `<g data-immune><circle cx="${f(TC[0] + x * gs)}" cy="${f(TC[1] + y * gs)}" r="5" fill="#fff" stroke="${RED}" stroke-width="2.2"/><circle cx="${f(TC[0] + x * gs)}" cy="${f(TC[1] + y * gs)}" r="1.8" fill="${RED}"/></g>`; });
    if (imm > 0.5) sideLabel = ['immune', 'attack'];
  }
  if (p.stim > 0.05) {
    const pts = [[-64, -20], [-62, 22], [64, -20], [62, 22], [-34, -46], [34, -46]];
    pts.slice(0, clamp(Math.round(3.2 * p.stim), 1, 6)).forEach(([x, y]) => { b += antibody(TC[0] + x * gs, TC[1] + y * gs); });
    sideLabel = sideLabel || ['antibodies'];
  }
  if (p.block > 0.02) {
    const o = clamp(p.block / 0.6, 0, 1);
    for (const sx of [-1, 1]) {
      const cx = TC[0] + sx * 34 * gs, cy = TC[1] + 4 * gs;
      b += `<g data-block opacity="${o.toFixed(2)}"><circle cx="${f(cx)}" cy="${f(cy)}" r="12" fill="#fff" fill-opacity=".6" stroke="${RED}" stroke-width="3"/><path d="M${f(cx - 8)} ${f(cy + 8)} L${f(cx + 8)} ${f(cy - 8)}" stroke="${RED}" stroke-width="3"/></g>`;
    }
    sideLabel = ['building', 'blocked'];
  }
  if (marks.rai > 0) {
    b += trefoil(TC[0], TC[1] + 4, 11);
    sideLabel = ['radioactive', 'iodine'];
  }
  if (sideLabel) b += lines(sideX(gs), 246, sideLabel, 'xs b red');
  // Iodine taken up from the blood
  if (has('iodine') || marks.rai > 0) {
    const hot = marks.rai > 0;
    b += arrow(262, 312, 222, 272, 3, hot ? RED : INK, 'data-flow="iodine"');
    for (const [x, y] of [[250, 332], [276, 344], [292, 328]]) b += iodineDot(x, y, hot);
    if (!hot) b += text(268, 300, 'iodine', 'xs b', 'start');
  }
  // A tablet of T4 from outside the body
  if (p.exo > 0.01) {
    b += `<g data-tablet><rect x="246" y="276" width="34" height="16" rx="8" fill="${AMBERF}" stroke="${AMBER}" stroke-width="2"/><path d="M263 277 V291" stroke="${AMBER}" stroke-width="1.5"/></g>`;
    b += arrow(263, 294, 263, 314, width(p.exo), AMBER, `data-flow="tablet" data-w="${f(width(p.exo))}"`);
    b += text(263, 270, 'tablet', 'xs b amber');
  }
  // Heart
  if (has('heart')) {
    b += `<path d="M64 458 C26 434 30 404 50 405 C59 406 64 413 64 418 C64 413 69 406 78 405 C98 404 102 434 64 458 Z" fill="#d9776b" stroke="${INK}" stroke-width="2"/>`;
    b += text(64, 482, 'heart', 'xs b');
    if (p.beta > 0.02) {
      const o = clamp(p.beta, 0, 1).toFixed(2);
      b += `<g data-betablock opacity="${o}">` + [44, 64, 84].map(x => `<rect x="${x - 6}" y="${x === 64 ? 413 : 404}" width="12" height="7" fill="${BLUE}"/>`).join('') + '</g>';
      b += text(64, 394, 'beta-blocker', 'xs b blue');
    }
  }
  return b;
}
function flowsOf(v, show) {
  const has = k => show.includes(k), out = [], gs = v.gland, y0 = Math.min(298, TC[1] + 36 * gs + 4);
  if (has('release')) {
    out.push(['release-l', TC[0] - 34 * gs, y0, TC[0] - 34 * gs, 314, width(v.out), AMBER]);
    out.push(['release-r', TC[0] + 34 * gs, y0, TC[0] + 34 * gs, 314, width(v.out), AMBER]);
  }
  if (has('tsh')) out.push(['tsh', 150, 140, 150, TC[1] - 40 * gs - 2, width(v.tsh), BLUE]);
  if (has('trh')) out.push(['trh', 116, 72, 132, 112, width(v.trh) * 0.8, INK]);
  return out;
}
function brake(v, ghost) {
  const w = clamp(1.5 + 2.5 * v.H, 1.5, 9);
  let b = '';
  if (ghost) { const gw = clamp(1.5 + 2.5 * ghost.H, 1.5, 9); b += `<path data-ghost-brake d="M${f(48 + gw / 2 + w / 2 + 4)} 312 V${f(64 + 6)}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".7" fill="none"/>`; }
  b += `<g data-flow="brake" data-w="${f(w)}"><path d="M48 314 V58 H104" fill="none" stroke="${AMBER}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 4)} 4"/><path d="M48 124 H128" fill="none" stroke="${AMBER}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 4)} 4"/>` +
    `<path d="M112 58 l-10 -${f(w / 2 + 5)} v${f(w + 10)} Z M136 124 l-10 -${f(w / 2 + 5)} v${f(w + 10)} Z" fill="${AMBER}"/></g>`;
  b += `<text x="40" y="236" transform="rotate(-90 40 236)" text-anchor="middle" class="xs b amber">brake</text>`;
  return b;
}
function vessel(v, show) {
  let b = `<rect x="8" y="314" width="464" height="50" rx="25" fill="${BLOOD}" stroke="${RED}" stroke-width="2"/>` + text(16, 344, 'blood', 'xs b red', 'start');
  if (!show.includes('blood')) return b;
  if (show.includes('forms')) {
    const n4 = clamp(Math.round(10 * v.t4), 0, 40), n3 = clamp(Math.round(5 * v.t3), 0, 22);
    SLOTS.slice(0, n4).forEach(([x, y]) => { b += t4Dot(x, y); });
    SLOTS.slice(n4, n4 + n3).forEach(([x, y]) => { b += t3Dot(x, y); });
  } else SLOTS.slice(0, clamp(Math.round(12 * v.t4), 0, 48)).forEach(([x, y]) => { b += hormoneDot(x, y); });
  return b;
}
function bottom(v, show, ghost, before) {
  let b = '';
  if (show.includes('heart')) {
    if (ghost) b += trace(ghost.hr, 452, `data-ghost-trace stroke="${INK}" stroke-width="1.8" stroke-dasharray="4 3" opacity=".7"`);
    b += trace(v.hr, 424, `data-trace stroke="${RED}" stroke-width="2.6"`);
    b += text(198, 482, 'heartbeat →', 'xs b');
  }
  if (show.includes('dial')) {
    const [cx, cy, r] = DIAL;
    b += `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${RULE}" stroke-width="10"/><path d="M${cx} ${cy - r - 7} V${cy - r + 7}" stroke="${INK}" stroke-width="2"/>`;
    b += text(cx, cy - r - 14, 'body’s pace', 'xs b') + text(cx - r - 2, cy + 18, 'slower', 'xs') + text(cx + r + 2, cy + 18, 'faster', 'xs');
    if (ghost) b += needle(ghost.pace, `data-ghost-needle stroke="${INK}" stroke-width="2" stroke-dasharray="4 3" opacity=".75"`);
    if (before) b += needle(before.pace, `stroke="${MUTED}" stroke-width="2.6" stroke-dasharray="1.5 3.5"`);
    b += needle(v.pace, `data-needle stroke="${AMBER}" stroke-width="4.5"`) + `<circle cx="${cx}" cy="${cy}" r="6" fill="${INK}"/>`;
  }
  return b;
}
function attrs(v) {
  return `data-tsh="${v.tsh.toFixed(3)}" data-t4="${v.t4.toFixed(3)}" data-t3="${v.t3.toFixed(3)}" data-out="${v.out.toFixed(3)}" data-hr="${v.hr.toFixed(3)}" data-pace="${v.pace.toFixed(3)}" data-gland="${v.gland.toFixed(3)}"`;
}
function keyRow(items, y) {
  let x = 10, row = 0, out = '';
  for (const [icon, word] of items) {
    const w = 40 + word.length * 7.4;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    out += `<g transform="translate(${f(x)} ${y + row * 24})">${icon}${text(40, 5, word, 'xs', 'start')}</g>`;
    x += w + 14;
  }
  return { body: out, rows: row + 1 };
}
const KEY = {
  hormone: [hormoneDot(17, 0), 'thyroid hormone'],
  t4: [t4Dot(17, 0), 'T4'],
  t3: [t3Dot(17, 0), 'T3'],
  normal: [`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`, 'normal']
};
/* One full picture: brain, neck and gland on the left, the blood levels on the right, the vessel across, the body below. */
function picture(cur, opt = {}) {
  const { show = ALL, ghost = null, before = null, legend = '', beforeWord = '', extra = '', marks = {}, header } = opt;
  let b = body(cur, show, ghost, before, marks);
  if (show.includes('inset')) b += extra;
  b += vessel(cur, show);
  if (ghost) {
    let g = '';
    for (const [, x1, y1, x2, y2, w, color] of flowsOf(ghost, show)) g += ghostArrow(x1 + 13, y1, x2 + 13, y2, w, color);
    b += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}>${g}</g>`;
  }
  if (before) b += `<g data-ghost="before" ${attrs(before)}></g>`;
  let flows = '';
  for (const [k, x1, y1, x2, y2, w, color] of flowsOf(cur, show)) flows += arrow(x1, y1, x2, y2, w, color, `data-flow="${k}" data-w="${f(w)}"`);
  let labels = '';
  if (show.includes('tsh')) labels += text(162, 166, 'TSH', 'xs b blue', 'start');
  if (show.includes('trh')) labels += text(108, 102, 'TRH', 'xs b', 'end');
  const brk = show.includes('brake') ? brake(cur, ghost) : '';
  const g = show.includes('gauges') ? gauges(cur, ghost, before, show.includes('tsh') ? ['tsh', 't4', 't3'] : ['t4', 't3'], header) : '';
  b += `<g data-new-state="${esc(legend || 'current')}" ${attrs(cur)}>${brk}${flows}${labels}${g}${bottom(cur, show, ghost, before)}</g>`;
  if (!show.includes('inset')) b += extra;
  const items = show.includes('forms') ? [KEY.t4, KEY.t3] : show.includes('blood') ? [KEY.hormone] : [];
  if (ghost) items.push(KEY.normal);
  if (before) items.push([`<path d="M0 0 H34" stroke="${MUTED}" stroke-width="2.6" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>`, beforeWord]);
  if (legend) items.push([`<path d="M0 -4 H34 V4 H0 Z" fill="${AMBER}"/>`, legend]);
  if (!items.length) return { body: b, h: 496 };
  const key = keyRow(items, 512);
  return { body: b + key.body, h: 526 + 24 * (key.rows - 1) };
}
const pictureSvg = (label, cur, opt) => { const { body: b, h } = picture(cur, opt); return svg(label, b, h); };

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.04 ? [up, 'up'] : r < 0.96 ? [down, 'down'] : ['about the same', 'same'];
}
function compare(v, ref) {
  return [
    ['TSH', more(v.tsh, ref.tsh)],
    ['T4', more(v.t4, ref.t4)],
    ['T3', more(v.t3, ref.t3)],
    ['Heartbeat', more(v.hr, ref.hr, 'faster', 'slower')],
    ['Body’s pace', more(v.pace, ref.pace, 'faster', 'slower')],
    ['Gland size', more(v.gland, ref.gland, 'larger', 'smaller')]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
// `upTo` keeps a core step's description to the pieces the lesson has introduced so far.
const describe = (v, ref, upTo = Infinity) => compare(v, ref).filter((_, i) => i < upTo).map(([k, [w]]) => `${k}: ${w}`).join('; ');
const bandWords = (v, keys = ['tsh', 't4', 't3']) => {
  const out = keys.filter(k => !inBand(k, relOf(v, k)));
  if (!out.length) return 'All the levels shown sit inside their healthy bands.';
  return out.map(k => `${GLABEL[k]} sits ${gy(k, relOf(v, k)) < bandY(k)[0] ? 'above' : 'below'} its healthy band.`).join(' ');
};

/* ---------- Core step pictures ---------- */
const STEP_SHOW = {
  gland: ['neck', 'thyroid', 'labels1'],
  pace: ['neck', 'thyroid', 'blood', 'release', 'dial'],
  iodine: ['neck', 'thyroid', 'blood', 'release', 'dial', 'iodine', 'inset'],
  forms: ['neck', 'thyroid', 'blood', 'release', 'dial', 'forms', 'gauges'],
  pituitary: ['neck', 'thyroid', 'blood', 'release', 'dial', 'forms', 'gauges', 'brain', 'pituitary', 'tsh'],
  hypothalamus: ['neck', 'thyroid', 'blood', 'release', 'dial', 'forms', 'gauges', 'brain', 'pituitary', 'tsh', 'hypothalamus', 'trh'],
  brake: ['neck', 'thyroid', 'blood', 'release', 'dial', 'forms', 'gauges', 'brain', 'pituitary', 'tsh', 'hypothalamus', 'trh', 'brake'],
  heart: ALL, whole: ALL
};
function follicleInset() {
  const cx = 390, cy = 160;
  let b = `<path d="M206 226 L${cx - 76} ${cy + 10}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="3 3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="76" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>`;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b += `<circle cx="${f(cx + 50 * Math.cos(a))}" cy="${f(cy + 50 * Math.sin(a))}" r="13" fill="${GLAND}" stroke="${INK}" stroke-width="1.4"/>`; }
  b += `<circle data-colloid cx="${cx}" cy="${cy}" r="35" fill="#f4d9b0" stroke="#b06e60" stroke-width="1.4"/>`;
  for (const [x, y] of [[-14, -10], [8, -16], [16, 6], [-6, 14], [-20, 6], [4, 0]]) b += iodineDot(cx + x, cy + y);
  for (const a of [2.3, 0.9]) b += arrow(cx + 92 * Math.cos(a), cy + 92 * Math.sin(a), cx + 64 * Math.cos(a), cy + 64 * Math.sin(a), 2.4, INK);
  b += text(cx, 22, 'one follicle, enlarged', 'xs b') + text(cx, cy + 102, 'stored protein in the middle', 'xs muted');
  return b;
}
function keyBox() {
  return `<rect data-key-measures x="333" y="34" width="88" height="256" fill="none" stroke="${BLUE}" stroke-width="3"/>`;
}
const CORE = {
  gland: () => pictureSvg('A head and neck in outline. Wrapped around the front of the windpipe, just below the voice box, sits a butterfly-shaped gland: the thyroid, two lobes joined by a narrow bridge.', NV, { show: STEP_SHOW.gland }),
  pace: () => pictureSvg('Two amber arrows run from the two lobes of the thyroid down into a blood vessel, which carries amber dots of thyroid hormone across the body. Below, a dial labelled body’s pace, from slower to faster, points straight up at its normal middle.', NV, { show: STEP_SHOW.pace }),
  iodine: () => pictureSvg('A small arrow carries iodine, drawn as white dots, from the blood up into the thyroid. A magnified circle beside it shows one follicle: a ring of cells around a store of protein in the middle, with iodine dots fixed onto that store.', NV, { show: STEP_SHOW.iodine, extra: follicleInset() }),
  forms: () => pictureSvg(`The blood now carries two kinds of hormone: many round T4 dots and fewer diamond-shaped T3 dots. At the top right, two level gauges, T4 and T3, each with a shaded healthy band; both markers sit inside their bands. ${bandWords(NV, ['t4', 't3'])}`, NV, { show: STEP_SHOW.forms, extra: text(198, 400, 'in body cells: T4 → T3', 'xs b amber') }),
  pituitary: () => pictureSvg('The head now shows the brain, with the pea-sized pituitary at its base. A thick blue arrow labelled TSH runs from the pituitary down the neck to the thyroid. A third gauge, TSH, joins T4 and T3 at the top right, its marker inside its healthy band.', NV, { show: STEP_SHOW.pituitary }),
  hypothalamus: () => pictureSvg('Above the pituitary sits the hypothalamus, joined to it by a short stalk. A dark arrow labelled TRH runs from the hypothalamus to the pituitary, which sends the blue TSH arrow on to the thyroid: a chain from brain to gland.', NV, { show: STEP_SHOW.hypothalamus }),
  brake: () => {
    const v = TM.open(NORMAL_P, 1.7);
    return pictureSvg(`Hormone running high. The blood is crowded with T4 and T3 dots, and a thick dashed amber line labelled brake runs from the blood up to the pituitary and hypothalamus. The TRH and TSH arrows shrink to thin lines beside their dashed normal outlines, and the gland’s release arrows thin. ${bandWords(v)} Compared with normal: ${describe(v, NV, 3)}.`, v, { show: STEP_SHOW.brake, ghost: NV, legend: 'hormone running high' });
  },
  lowbrake: () => {
    const v = TM.open(NORMAL_P, 0.5);
    return pictureSvg(`Hormone running low. Few T4 and T3 dots remain in the blood and the brake line is thin. The TSH arrow from the pituitary swells well past its dashed normal outline and the gland’s release arrows thicken. ${bandWords(v)} Compared with normal: ${describe(v, NV, 3)}.`, v, { show: STEP_SHOW.brake, ghost: NV, legend: 'hormone running low' });
  },
  heart: () => pictureSvg('A heart appears at the bottom left, with a heartbeat trace running beside it at a steady normal rhythm. Thyroid hormone in the blood makes the heart answer alarm signals more strongly, so more hormone would bunch the beats closer together and less would spread them out.', NV, { show: STEP_SHOW.heart }),
  whole: () => pictureSvg('The whole loop: the hypothalamus sends TRH to the pituitary, the pituitary sends TSH to the thyroid, the thyroid releases T4 and T3 into the blood, and the hormone sets the body’s pace and heartbeat while a dashed brake line runs back up to the brain. A blue box marks the TSH and T4 gauges as the key tests.', NV, { show: ALL, extra: keyBox(), header: 'key tests' })
};

/* ---------- What changes it ---------- */
// Each change morphs the model's settings from where it starts to where it ends; sizes are illustrative.
const CHANGES = {
  hypo: { from: 'normal', to: () => TM.build('hypo'), legend: 'hypothyroidism', against: null, marks: t => ({ immune: t }) },
  graves: { from: 'normal', to: () => TM.build('graves'), legend: 'Graves’ disease', against: null, marks: () => ({}) },
  levothyroxine: { from: 'hypo', to: () => TM.build('hypo', ['levothyroxine']), legend: 'with levothyroxine', against: 'hypothyroidism, untreated', marks: () => ({ immune: 1 }) },
  thionamide: { from: 'graves', to: () => TM.build('graves', ['thionamide']), legend: 'with a thionamide', against: 'Graves’ disease, untreated', marks: () => ({}) },
  rai: { from: 'graves', to: () => TM.build('graves', ['rai']), legend: 'after radioactive iodine', against: 'Graves’ disease, untreated', marks: t => ({ rai: t > 0.02 ? 1 : 0 }) },
  betablocker: { from: 'graves', to: () => TM.build('graves', ['betablocker']), legend: 'with a beta-blocker', against: 'Graves’ disease, untreated', marks: () => ({}) }
};
const CHANGE_WHERE = {
  hypo: 'Red immune cells gather on the gland and it shrinks inside its dashed normal outline. Its release arrows thin and the blood empties of T4 and T3, so the brake line thins and the blue TSH arrow swells. The pace dial swings toward slower and the heartbeats spread apart.',
  graves: 'Red Y-shaped antibodies cling to the gland, which swells past its dashed outline and pours thick amber arrows into the blood. T4 and T3 crowd the blood, the brake line thickens and the TSH arrow shrinks to a thread. The pace dial swings toward faster and the heartbeats bunch together.',
  levothyroxine: 'An amber tablet beside the neck sends T4 straight into the blood; the gland stays small and damaged. T4 and T3 climb back toward the dashed normal marks, the brake strengthens and the swollen TSH arrow shrinks back. The pace dial returns toward the middle.',
  thionamide: 'Red block signs appear over both lobes: the gland is still enlarged and the antibodies are still there, but its release arrows thin. T4 and T3 fall back toward their bands, the brake eases and the TSH arrow grows again. The pace dial and the heartbeat ease back toward normal.',
  rai: 'Radioactive iodine, drawn in red, flows from the blood into the gland, which shrinks to well under its dashed normal outline even though antibodies remain. Its release arrows thin, T4 and T3 fall back, the brake eases and TSH rises back. The pace dial and the heartbeat ease back toward normal.',
  betablocker: 'Blue blocks appear on the heart and the heartbeats spread back toward a normal rhythm. Nothing else moves: the gland stays enlarged, T4 and T3 stay high, TSH stays low and the pace dial still points toward faster.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const fromParams = kind => TM.build(CHANGES[kind].from);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const p0 = fromParams(kind), cur = view(TM.mix(p0, c.to(), ease(t)));
  const before = c.against ? view(p0) : null, ref = before || NV;
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal${before ? ` and dotted marks for ${c.against}` : ''}. ${CHANGE_WHERE[kind]} ${bandWords(cur)} Compared with ${before ? c.against : 'normal'}: ${describe(cur, ref)}.`;
  const pic = pictureSvg(label, cur, { show: ALL, ghost: NV, before, legend: c.legend, beforeWord: c.against || '', marks: c.marks(ease(t)) });
  return { pic, ro: readout(cur, ref, `Compared with ${before ? c.against : 'normal'}`) };
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
function drawCore() { steps.forEach(el => { const k = el.dataset.kind; if (CORE[k]) visualOf(el).innerHTML = CORE[k](); }); }
function startLesson() {
  drawCore();
  steps.forEach(el => {
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
  if (tab.id === 'tab-lesson') { if (started && isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
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

/* ---------- Words for the sliders ---------- */
const capWords = v => v < 0.2 ? 'very little' : v < 0.6 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : v <= 1.35 ? 'more than normal' : 'much more than normal';
const stimWords = v => v < 0.05 ? 'none' : v < 0.8 ? 'mild' : v < 1.8 ? 'strong' : 'very strong';
const iodWords = v => v < 0.15 ? 'severely short' : v < 0.5 ? 'short' : v < 0.85 ? 'a little short' : 'enough';

/* ---------- Where a model level sits against its band ----------
   The sources give only directions for diseases and drugs, so the model never prints a lab number:
   it reports where its marker sits (inside, above, below, or far beyond the band). */
let data = null;
function place(k, rel) {
  if (inBand(k, rel)) return 'inside';
  const above = gy(k, rel) < bandY(k)[0], far = Math.abs(gyRaw(k, rel)) >= 1;
  return `${far ? 'far ' : ''}${above ? 'above' : 'below'}`;
}
const PLACE_ARROW = { inside: '↔', above: '↑', 'far above': '⇈', below: '↓', 'far below': '⇊' };
const levelWords = (k, rel, band = 'its healthy band') => { const w = place(k, rel); return w === 'inside' ? `inside ${band}` : `${w} ${band}`; };

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
// The bar is a ratio scale centred on the model's normal, the same scale as the lesson's gauges.
const barX = (k, rel) => f(200 + clamp(gyRaw(k, rel), -1, 1) * 170);
// Print a range as the source does: the high end keeps the low end's decimals (0.5–4.0).
const rangeText = v => { const d = (String(v.low).split('.')[1] || '').length; return `${v.low}–${v.high.toFixed(d)}`; };
// How each cited state is applied to the model, and what its directions are compared with.
const BASE_OF = { levothyroxine: 'hypo', thionamide: 'graves', rai: 'graves', betablocker: 'graves' };
const BASE_WORD = { hypo: 'untreated hypothyroidism', graves: 'untreated Graves’ disease' };
const MARKS_OF = { hypo: { immune: 1 }, levothyroxine: { immune: 1 }, rai: { rai: 1 } };
function stateParams(id) {
  if (id === 'hypo' || id === 'graves') return TM.build(id);
  if (BASE_OF[id]) return TM.build(BASE_OF[id], [id]);
  return TM.build('normal');
}
const cv = { state: 'normal', p: TM.build('normal'), custom: false };
function updateClinical() {
  $('#clinical-cap').value = cv.p.cap; $('#clinical-cap-label').textContent = capWords(cv.p.cap);
  $('#clinical-stim').value = cv.p.stim; $('#clinical-stim-label').textContent = stimWords(cv.p.stim);
  const cur = view(cv.p);
  const st = data?.states.find(s => s.id === cv.state);
  const base = BASE_OF[cv.state], before = st && base ? view(TM.build(base)) : null;
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  const legend = cv.custom ? 'these settings' : st ? st.label.split(' (')[0].toLowerCase() : '';
  $('#clinical-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, before, legend, beforeWord: before ? BASE_WORD[base] : '', marks: cv.custom ? {} : (MARKS_OF[cv.state] || {}) });
  if (!data) return;
  const ref = st ? (before || NV) : null;
  const refWord = base ? BASE_WORD[base] : 'normal';
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    const note = d && st.shiftNotes?.[v.id] ? `: ${st.shiftNotes[v.id]}` : '';
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}${note}` : 'No direction given by the cited source for this row; the teaching model leaves it unchanged') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const k = v.modelKey, rel = relOf(cur, k), where = place(k, rel);
    const reading = row.querySelector('.reading');
    reading.textContent = `${PLACE_ARROW[where]} ${where === 'inside' ? 'Inside' : where[0].toUpperCase() + where.slice(1)} the typical range`;
    reading.dataset.rel = rel.toFixed(3);
    const x = barX(k, rel), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model position (illustrative, no number): ${where} typical range${where.startsWith('far') ? ', off the end of the bar' : ''}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (ref && !cv.custom) {
      const rv = relOf(ref, k), rx = barX(k, rv);
      cmp.textContent = `Dashed line: model, ${refWord} (${place(k, rv)} typical range)`;
      cmp.dataset.rel = rv.toFixed(3);
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; delete cmp.dataset.rel; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this${BASE_OF[id] ? `, applied to ${BASE_WORD[BASE_OF[id]]}` : ''}.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
for (const k of ['cap', 'stim']) {
  $('#clinical-' + k).addEventListener('input', e => {
    cv.p = { ...cv.p, [k]: Number(e.target.value) }; cv.custom = true;
    const s = data?.states.find(x => x.id === cv.state);
    $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
    updateClinical(); announce();
  });
}
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = view(cv.p);
    $('#cv-live').textContent = `Model: TSH ${levelWords('tsh', m.tsh, 'typical range')}, T4 ${levelWords('t4', m.t4, 'typical range')}, T3 ${levelWords('t3', m.t3, 'typical range')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), cap: 1, stim: 0, iod: 1 };
const DRUG_ORDER = ['levothyroxine', 'thionamide', 'rai', 'betablocker'];
function exploreParams() {
  let p = { ...TM.NORMAL, cap: ex.cap, stim: ex.stim, iod: ex.iod };
  for (const d of DRUG_ORDER) if (ex.drugs.has(d)) p = TM.DRUGS[d](p);
  return p;
}
function brakeChart(cur, p) {
  // Levels relative to normal, with no numbers: real reference numbers live only in the Clinical values tab.
  const L = 40, R = 462, T = 16, B = 256, xMax = 2.8, ax = 1, ay = 1, yLo = -2.3, yHi = 1.7;
  const X = t4 => L + clamp(t4 / xMax, 0, 1.02) * (R - L), Y = tsh => B - clamp((Math.log10(Math.max(tsh, 1e-6)) - yLo) / (yHi - yLo), -0.02, 1.02) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${RULE}"/>`;
  const [x0, x1] = BANDS ? BANDS.t4.map(X) : [X(0.7), X(1.35)], [y1, y0] = BANDS ? BANDS.tsh.map(Y) : [Y(0.4), Y(2.5)];
  b += `<rect data-ref-box x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="${BANDF}"/>`;
  b += text(x1 + 6, y0 + 14, 'both inside', 'xs b blue', 'start') + text(x1 + 6, y0 + 29, 'their healthy bands', 'xs b blue', 'start');
  b += text(L - 8, T + 14, 'more', 'xs muted', 'end') + text(L - 8, B, 'less', 'xs muted', 'end') + text(L, B + 20, 'less', 'xs muted', 'start') + text(R, B + 20, 'more', 'xs muted', 'end');
  // The brake: TSH the pituitary releases for each T4 level (fixed).
  let brakeD = '';
  for (let i = 0; i <= 60; i++) { const h = 0.05 + i / 60 * (xMax / ax - 0.05); brakeD += (i ? ' L' : 'M') + `${f(X(h * ax))} ${f(Y(TM.tshFor(h) * ay))}`; }
  b += `<path data-brake-curve d="${brakeD}" fill="none" stroke="${BLUE}" stroke-width="3"/>`;
  // The gland's answer: T4 it settles at for each TSH level (depends on the settings).
  const glandD = q => {
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const lt = (yLo - 0.3) + i / 60 * (yHi - yLo + 0.6), t = Math.pow(10, lt) / ay;
      const h = TM.releaseFor(q, t) + q.exo;
      d += (i ? ' L' : 'M') + `${f(X(h * ax))} ${f(Y(t * ay))}`;
    }
    return d;
  };
  b += `<path d="${glandD(NORMAL_P)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-gland-curve d="${glandD(p)}" fill="none" stroke="${AMBER}" stroke-width="3"/>`;
  b += `<circle cx="${f(X(ax))}" cy="${f(Y(ay))}" r="7" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2"/>`;
  b += `<circle data-explore-point cx="${f(X(cur.t4 * ax))}" cy="${f(Y(cur.tsh * ay))}" r="7" fill="${AMBER}" stroke="#fff" stroke-width="2"/>`;
  b += text(14, 10, 'TSH ↑ (ratio scale)', 'xs b', 'start') + text(R, B + 42, 'T4 →', 'xs b', 'end');
  const k = keyRow([[`<path d="M0 0 H34" stroke="${BLUE}" stroke-width="3"/>`, 'brake: TSH for each T4'], [`<path d="M0 0 H34" stroke="${AMBER}" stroke-width="3"/>`, 'gland: T4 for each TSH'], [KEY.normal[0], 'normal gland']], 318);
  return { body: b + k.body, h: 332 + 24 * (k.rows - 1) };
}
function updateExplore() {
  for (const [id, words] of [['cap', capWords], ['stim', stimWords], ['iod', iodWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  const p = exploreParams(), cur = view(p);
  const names = { levothyroxine: 'levothyroxine', thionamide: 'a thionamide', rai: 'radioactive iodine', betablocker: 'a beta-blocker' };
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => names[d]);
  const who = `${{ normal: 'a normal body', hypo: 'hypothyroidism', graves: 'Graves’ disease' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const marks = { immune: ex.preset === 'hypo' ? 1 : 0, rai: ex.drugs.has('rai') ? 1 : 0 };
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend: 'your settings', marks }) + readout(cur, NV, 'Compared with normal');
  const [hrW] = more(cur.hr, NV.hr, 'faster than normal', 'slower than normal'), [paceW] = more(cur.pace, NV.pace, 'faster than normal', 'slower than normal'), [gW] = more(cur.gland, NV.gland, 'larger than normal', 'smaller than normal');
  const levels = ['tsh', 't4', 't3'].map(k => `${GLABEL[k]} ${levelWords(k, relOf(cur, k))}`).join(' · ');
  const goiter = cur.gland > 1.15 ? ' (a goiter)' : '';
  const res = $('#model-results');
  res.textContent = `Illustrative model output for ${who}: ${levels} · heartbeat ${hrW === 'about the same' ? 'about normal' : hrW} · body’s pace ${paceW === 'about the same' ? 'about normal' : paceW} · gland ${gW === 'about the same' ? 'about normal size' : gW}${goiter}.`;
  Object.assign(res.dataset, { tsh: cur.tsh.toFixed(4), t4: cur.t4.toFixed(4), t3: cur.t3.toFixed(4) });
  const chart = brakeChart(cur, p);
  $('#explore-chart').innerHTML = svg(`Illustrative chart with total T4 across and TSH up, on a ratio scale; no numbers are shown. A falling blue curve is the brake: the TSH the pituitary releases for each T4 level. A rising amber curve is the gland: the T4 it makes for each TSH level, with a dashed curve for the normal gland. The loop settles where they cross, with TSH ${levelWords('tsh', cur.tsh)} and T4 ${levelWords('t4', cur.t4)}. The shaded box is where TSH and T4 are both inside their healthy bands.`, chart.body, chart.h);
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = TM.build(r.value); ex.cap = d.cap; ex.stim = d.stim; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['cap', 'stim', 'iod']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', cap: 1, stim: 0, iod: 1 }); ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; }); $('#preset input[value="normal"]').checked = true;
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byId = id => loaded.values?.find(v => v.id === id);
    const ok = ['tsh', 't4', 't3'].every(id => { const v = byId(id); return v && Number.isFinite(v.low) && Number.isFinite(v.high) && v.low > 0; });
    if (!ok) throw new Error('Invalid reference data');
    data = loaded;
    const tsh = byId('tsh'), t4 = byId('t4'), t3 = byId('t3');
    // Each band is drawn relative to the model's normal, which sits at the middle of the quoted range
    // (for TSH, the middle on a ratio scale). Nothing else is converted into lab units.
    const mid = { tsh: Math.sqrt(tsh.low * tsh.high), t4: (t4.low + t4.high) / 2, t3: (t3.low + t3.high) / 2 };
    BANDS = { tsh: [tsh.low / mid.tsh, tsh.high / mid.tsh], t4: [t4.low / mid.t4, t4.high / mid.t4], t3: [t3.low / mid.t3, t3.high / mid.t3] };
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the only numbers here are the quoted reference ranges. The teaching model works in levels relative to normal, and its normal is drawn in the middle of each band. For a disease or drug the sources give only a direction, so the model marker shows where the level moves (inside, above, below, or far beyond the band) and never a predicted number; how far it moves is an illustrative choice.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v.modelKey, n / mid[v.modelKey]), range = hasRange(v), typical = Number.isFinite(v.typical) && !range;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = typical ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      const [lo, hi] = range ? rangeText(v).split('–') : ['', ''];
      const edges = range ? `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>` : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${range ? `${rangeText(v)} ${v.unit}` : ''} as a shaded band${v.modelKey ? ', a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for what it is compared with' : ''}`);
      right.querySelector('.key').textContent = `${range ? `Source range ${rangeText(v)} ${v.unit} (shaded)` : `Source typical value ${v.typical} ${v.unit} (tick; no range given)`} · ratio scale · blue line: model position, illustrative, no number`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, ev, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null; BANDS = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  startLesson();
  updateClinical();
  updateExplore();
}
load();
