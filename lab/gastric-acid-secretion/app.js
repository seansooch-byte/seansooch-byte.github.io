'use strict';
const GM = window.GastricModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const NORMAL_P = GM.build('normal');
const NV = GM.settle(NORMAL_P);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', AMBERF = '#f2a93b', GREEN = '#1d6b3a', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const LUMEN = '#fdf0e8', CELL = '#f5e7cf', NUCLEUS = '#e8d2b0', LINING = '#ece2d4', BLOOD = '#f6dcd6', MUCUS = '#d8e7c4', BANDF = '#d1d8fd', WALL = '#e7a993', FOOD = '#f2d27a';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const svg = (label, body, h) => `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body}</svg>`;
// A straight arrow with its own head (no markers, so hidden steps never share ids).
function arrow(x1, y1, x2, y2, w, color, extra = '') {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 6), hw = w * 1.1 + 4;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${color}" stroke-width="${f(w)}" fill="none"/>` +
    `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${color}"/></g>`;
}
// The ghost of an arrow: a dashed outline at its normal width.
function ghostArrow(x1, y1, x2, y2, w, color, extra = '') {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 6), hw = w * 1.1 + 4, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path ${extra} d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".8"/>`;
}
const signalWidth = d => d <= 0.03 ? 0 : clamp(2 + 6 * d, 2, 18);
const brakeWidth = pg => clamp(1.2 + 2.4 * pg, 1.2, 10);
const mucusH = s => 8 + 10 * s;

// Fixed, shuffled places for the dots inside the stomach.
const SLOTS = (() => {
  const s = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 20; c++) s.push([150 + c * 16 + (r % 2) * 8, 42 + r * 14]);
  let seed = 7;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const hDot = (x, y, extra = 'data-h') => `<circle ${extra} cx="${f(x)}" cy="${f(y)}" r="4.8" fill="${RED}"/>`;
const clDot = (x, y) => `<circle data-cl cx="${f(x)}" cy="${f(y)}" r="3.6" fill="#fff" stroke="${GREEN}" stroke-width="2"/>`;
const hexPts = (x, y, r) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join(' L');
const antacidDot = (x, y, extra = 'data-antacid') => `<g ${extra}><path d="M${hexPts(x, y, 8)} Z" fill="#fff" stroke="${BLUE}" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${RED}" opacity=".55"/></g>`;
const kDot = (x, y) => `<rect data-k x="${f(x - 3)}" y="${f(y - 3)}" width="6" height="6" fill="${INK}"/>`;
const histDot = (x, y) => `<path data-msg="histamine" d="M${f(x)} ${f(y - 6)} L${f(x + 6)} ${f(y + 5)} L${f(x - 6)} ${f(y + 5)} Z" fill="${AMBERF}" stroke="${AMBER}" stroke-width="1.6"/>`;
const gasDot = (x, y) => `<path data-msg="gastrin" d="M${f(x)} ${f(y - 6.5)} L${f(x + 6.5)} ${f(y)} L${f(x)} ${f(y + 6.5)} L${f(x - 6.5)} ${f(y)} Z" fill="${BLUE}"/>`;
const achDot = (x, y) => `<circle data-msg="acetylcholine" cx="${f(x)}" cy="${f(y)}" r="5" fill="${GREEN}"/>`;
const pgDot = (x, y) => `<circle data-msg="prostaglandin" cx="${f(x)}" cy="${f(y)}" r="4.6" fill="#fff" stroke="${AMBER}" stroke-width="2.2"/>`;
const pumpIcon = (x, y, r = 10) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BLUE}" stroke="${INK}" stroke-width="1.5"/><path d="M${f(x)} ${f(y + r * .5)} V${f(y - r * .5)} M${f(x - r * .35)} ${f(y - r * .1)} L${f(x)} ${f(y - r * .5)} L${f(x + r * .35)} ${f(y - r * .1)}" stroke="#fff" stroke-width="1.8" fill="none"/>`;
const lockIcon = (x, y) => `<path d="M${f(x - 12)} ${f(y - 12)} L${f(x + 12)} ${f(y + 12)} M${f(x + 12)} ${f(y - 12)} L${f(x - 12)} ${f(y + 12)}" stroke="${RED}" stroke-width="3.4"/>`;

// Ten pump places along the stomach-facing surface; the order spreads the raised pumps out.
const PUMP_X = [...Array(10)].map((_, i) => 162 + i * 27);
const PUMP_ORDER = [2, 6, 4, 8, 0, 5, 1, 7, 3, 9];
const MEMBRANE = 150;
const VESICLES = [[346, 210], [378, 242], [170, 230], [206, 230], [242, 230], [214, 294], [252, 286], [342, 272], [412, 236], [446, 230]];
const BRAKE_Y = 260;
const pumpsUp = v => clamp(Math.round(10 * v.up), 0, 10);
const pumpsLocked = v => clamp(Math.round(pumpsUp(v) * v.p.ppi), 0, 10);
const surfaceSlots = n => PUMP_ORDER.slice(0, n).sort((a, b) => a - b);

/* The gauges: acid made by the cell (an illustrative usual zone, no source gives a range) and how acidic the stomach
   is (the band comes from the stomach pH range in clinical-values.json; until it loads, an illustrative fallback). */
const MADE_USUAL = [0.75, 1.33];
let ACID_BAND = [0.1, 10];
const madeRaw = m => Math.log(Math.max(m, 1e-4)) / Math.log(4);
const acidRaw = a => Math.log10(Math.max(a, 1e-4)) / 2;
const gX = (k, v) => 240 + clamp(k === 'made' ? madeRaw(v) : acidRaw(v), -1, 1) * 190;
const bandOf = k => k === 'made' ? MADE_USUAL : ACID_BAND;
const place = (k, v) => { const [lo, hi] = bandOf(k); return v > hi + 1e-9 ? 'above' : v < lo - 1e-9 ? 'below' : 'inside'; };
const GAUGE = { made: ['acid made by the parietal cell', 'less', 'more →', GREEN, 'shaded: usual amount'], acid: ['how acidic the stomach is', 'less acidic', 'more acidic →', RED, 'shaded: usual range'] };
function gaugeRow(k, cur, ghost, y) {
  const [title, lo, hi, col, note] = GAUGE[k], [b0, b1] = bandOf(k).map(v => gX(k, v));
  let b = text(24, y - 20, title, 'xs b', 'start') + text(456, y - 20, note, 'xs muted', 'end');
  b += `<path d="M40 ${y} H440" stroke="${RULE}" stroke-width="4"/>`;
  b += `<rect data-band="${k}" x="${f(b0)}" y="${y - 9}" width="${f(b1 - b0)}" height="18" fill="${BANDF}"/>`;
  if (ghost) b += `<path data-ghost-gauge="${k}" d="M${f(gX(k, ghost[k]))} ${y - 17} V${y + 17}" stroke="${INK}" stroke-width="2.2" stroke-dasharray="4 3"/>`;
  const x = gX(k, cur[k]), raw = k === 'made' ? madeRaw(cur[k]) : acidRaw(cur[k]);
  b += `<rect data-gauge="${k}" data-level="${cur[k].toFixed(4)}" x="${f(x - 4.5)}" y="${y - 14}" width="9" height="28" fill="${col}" stroke="#fff" stroke-width="1.4"/>`;
  if (raw < -1) b += `<path d="M24 ${y} l9 -7 v14 Z" fill="${col}"/>`;
  if (raw > 1) b += `<path d="M456 ${y} l-9 -7 v14 Z" fill="${col}"/>`;
  b += text(40, y + 30, lo, 'xs muted', 'start') + text(440, y + 30, hi, 'xs muted', 'end');
  return b;
}

/* The scene: the stomach's inside at the top, the lining and the parietal cell in the middle, the blood side below. */
const SIG_Y0 = 322, SIG_Y1 = 168, SIG_X = 300;
function lumen(v, show) {
  const has = k => show.includes(k), p = v.p;
  let b = `<rect x="0" y="0" width="480" height="${MEMBRANE}" fill="${LUMEN}"/>` + text(12, 24, 'inside the stomach', 'xs b muted', 'start');
  let i = 0;
  if (has('h')) {
    const n = clamp(Math.round(14 * Math.pow(v.acid, 0.75)), 0, 46);
    SLOTS.slice(i, i += n).forEach(([x, y]) => { b += hDot(x, y); });
  }
  if (has('cl')) {
    const n = clamp(Math.round(9 * Math.pow(v.made, 0.75)), 0, 30);
    SLOTS.slice(i, i += n).forEach(([x, y]) => { b += clDot(x, y); });
  }
  if (p.antacid > 0.02) {
    const n = clamp(Math.round(14 * p.antacid), 0, 14);
    SLOTS.slice(-n).forEach(([x, y]) => { b += antacidDot(x, y); });
    b += text(468, 24, 'antacid swallowed', 'xs b blue', 'end');
  }
  if (p.vomit > 0.02) b += arrow(440, 120, 440, 30, 2 + 5 * p.vomit, RED, 'data-vomit') + text(428, 24, 'acid lost by vomiting', 'xs b red', 'end');
  if (has('pepsin')) {
    // A protein chain cut in two by pepsin, and a germ crossed out.
    b += `<g data-pepsin><path d="M18 62 Q30 50 42 62 T66 62" fill="none" stroke="${INK}" stroke-width="3"/><path d="M80 62 Q92 50 104 62 T126 62" fill="none" stroke="${INK}" stroke-width="3"/>`;
    b += `<path d="M66 48 L80 76 M80 48 L66 76" stroke="${AMBER}" stroke-width="3"/></g>` + text(72, 94, 'pepsin cuts protein', 'xs b amber');
    b += `<g data-germ><ellipse cx="34" cy="116" rx="13" ry="8" fill="#cfe0a8" stroke="${GREEN}" stroke-width="2"/><path d="M20 104 L48 128 M48 104 L20 128" stroke="${RED}" stroke-width="3"/></g>` + text(56, 121, 'germ killed', 'xs b red', 'start');
  }
  return b;
}
function wall(v, show, ghost) {
  const has = k => show.includes(k), p = v.p;
  let b = '';
  // Two surface cells of the lining, then the parietal cell.
  b += `<rect x="8" y="${MEMBRANE}" width="56" height="186" fill="${LINING}" stroke="${RULE}" stroke-width="1.5"/><rect x="66" y="${MEMBRANE}" width="58" height="186" fill="${LINING}" stroke="${RULE}" stroke-width="1.5"/>`;
  b += `<ellipse cx="36" cy="292" rx="12" ry="9" fill="${NUCLEUS}"/><ellipse cx="95" cy="292" rx="12" ry="9" fill="${NUCLEUS}"/>`;
  b += text(66, 196, has('mucus') ? 'surface' : 'lining', 'xs b muted') + text(66, 214, 'cells', 'xs b muted');
  if (has('mucus')) {
    const h = mucusH(v.shield);
    if (ghost) b += `<rect data-ghost-shield x="6" y="${f(MEMBRANE - mucusH(ghost.shield))}" width="120" height="${f(mucusH(ghost.shield))}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    b += `<g data-mucus="${f(h)}"><path d="M6 ${MEMBRANE} V${f(MEMBRANE - h + 4)} Q36 ${f(MEMBRANE - h - 4)} 66 ${f(MEMBRANE - h + 2)} T126 ${f(MEMBRANE - h + 2)} V${MEMBRANE} Z" fill="${MUCUS}" stroke="${GREEN}" stroke-width="1.6"/>`;
    const nb = clamp(Math.round(4 * v.shield), 1, 9);
    for (let i = 0; i < nb; i++) b += `<circle data-bicarb cx="${f(16 + i * (100 / Math.max(nb - 1, 1)))}" cy="${f(MEMBRANE - h / 2 + 1)}" r="3" fill="${BLUE}"/>`;
    b += '</g>' + text(66, f(MEMBRANE - h - 10), 'mucus shield', 'xs b green');
  }
  // The parietal cell
  b += `<rect data-cell x="134" y="${MEMBRANE}" width="338" height="182" rx="16" fill="${CELL}" stroke="${INK}" stroke-width="2"/>`;
  b += `<ellipse cx="430" cy="282" rx="28" ry="22" fill="${NUCLEUS}"/>`;
  b += text(146, 206, 'parietal cell', 'sm b', 'start');
  if (has('store')) {
    const stored = 10 - pumpsUp(v);
    VESICLES.slice(0, stored).forEach(([x, y]) => { b += `<g data-vesicle><circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${MUTED}" stroke-width="1.6"/>${pumpIcon(x, y, 6.5)}</g>`; });
    if (show.includes('rise')) VESICLES.slice(0, 2).forEach(([x, y]) => { b += arrow(x, y - 17, x, MEMBRANE + 14, 2.4, MUTED, 'data-rise'); });
  }
  if (has('cl')) {
    b += `<g data-channel><rect x="446" y="${MEMBRANE - 12}" width="16" height="24" rx="4" fill="#fff" stroke="${GREEN}" stroke-width="2"/></g>`;
    if (v.made > 0.05) b += arrow(454, MEMBRANE + 26, 454, MEMBRANE - 30, clamp(1.5 + 2 * v.made, 1.5, 6), GREEN, 'data-flow="chloride"');
    b += text(440, MEMBRANE + 44, 'chloride', 'xs b green', 'end');
  }
  if (has('pumps')) {
    const n = pumpsUp(v), nl = pumpsLocked(v), slots = surfaceSlots(n);
    if (ghost) surfaceSlots(pumpsUp(ghost)).forEach(i => { b += `<circle data-ghost-pump cx="${PUMP_X[i] + 0}" cy="${MEMBRANE}" r="14" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>`; });
    slots.forEach((i, j) => {
      const x = PUMP_X[i], locked = j < nl;
      b += `<g data-pump data-locked="${locked ? 1 : 0}">${pumpIcon(x, MEMBRANE)}${locked ? lockIcon(x, MEMBRANE) : ''}</g>`;
      if (!locked) {
        b += arrow(x - 4, MEMBRANE - 12, x - 4, MEMBRANE - 30, 2.4, RED, 'data-flow="hydrogen"');
        if (has('k')) b += arrow(x + 5, MEMBRANE + 12, x + 5, MEMBRANE + 26, 2, INK, 'data-flow="potassium"') + kDot(x + 5, MEMBRANE + 32);
      }
    });
    if (nl > 0) b += text(140, 132, 'pumps locked', 'xs b red', 'start');
  }
  return b;
}
const MSG_OFF = [[-26, 366], [8, 362], [-8, 386], [26, 382], [-34, 396], [18, 400], [36, 364], [-16, 404], [40, 394], [0, 376], [-40, 374], [30, 408]];
function receptor(x, docked, plug, label) {
  let b = `<path d="M${x - 13} ${SIG_Y0 + 24} V${SIG_Y0 + 8} Q${x - 13} ${SIG_Y0 + 2} ${x - 7} ${SIG_Y0 + 2} H${x + 7} Q${x + 13} ${SIG_Y0 + 2} ${x + 13} ${SIG_Y0 + 8} V${SIG_Y0 + 24}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  if (plug > 0.02) b += `<rect data-plug x="${x - 8}" y="${SIG_Y0 + 6}" width="16" height="16" rx="2" fill="${INK}" opacity="${clamp(plug / 0.6, 0, 1).toFixed(2)}"/>`;
  else if (docked) b += docked;
  return `<g data-receptor="${label}">${b}</g>`;
}
function bloodSide(v, show) {
  const has = k => show.includes(k), p = v.p;
  let b = `<rect x="0" y="${SIG_Y0 + 14}" width="480" height="104" fill="${BLOOD}"/><path d="M0 ${SIG_Y0 + 14} H480" stroke="${RED}" stroke-width="2"/>` + text(14, SIG_Y0 + 42, 'blood side', 'xs b red', 'start');
  const cluster = (x, n, dot) => MSG_OFF.slice(0, clamp(Math.round(n), 0, 12)).map(([dx, y]) => dot(x + dx, y)).join('');
  if (has('hist')) {
    b += cluster(200, 4 * p.hist, histDot);
    b += text(200, SIG_Y0 + 108, 'histamine', 'xs b amber');
  }
  if (has('gas')) {
    b += cluster(300, 4 * p.gastrin, gasDot) + cluster(400, 4 * p.ach, achDot);
    b += text(300, SIG_Y0 + 108, 'gastrin', 'xs b blue') + text(400, SIG_Y0 + 108, 'acetylcholine', 'xs b green');
    b += `<path data-nerve d="M480 ${SIG_Y0 + 60} C462 ${SIG_Y0 + 54} 452 ${SIG_Y0 + 66} 440 ${SIG_Y0 + 58}" fill="none" stroke="${GREEN}" stroke-width="3"/>`;
  }
  if (p.sys > 0.02) {
    [[30, 414], [60, 418], [90, 414]].forEach(([x, y]) => { b += `<path data-absorbed d="M${hexPts(x, y, 7)} Z" fill="#fff" stroke="${BLUE}" stroke-width="2"/>`; });
    b += text(14, SIG_Y0 + 62, 'extra', 'xs b blue', 'start') + text(14, SIG_Y0 + 80, 'bicarbonate', 'xs b blue', 'start');
  }
  if (p.vomit > 0.02) b += text(14, SIG_Y0 + 62, 'chloride lost,', 'xs b red', 'start') + text(14, SIG_Y0 + 80, 'bicarbonate up', 'xs b red', 'start');
  return b;
}
// The receptors sit in the cell's bottom face, so they are drawn over the cell.
function receptors(v, show) {
  const has = k => show.includes(k), p = v.p;
  let b = '';
  if (has('hist')) {
    b += receptor(200, histDot(200, SIG_Y0 + 16), p.h2, 'h2') + text(180, SIG_Y0 - 4, 'H2', 'xs b', 'end');
    if (p.h2 > 0.02) b += text(218, SIG_Y0 - 4, 'blocker', 'xs b', 'start');
  }
  if (has('gas')) b += receptor(300, gasDot(300, SIG_Y0 + 16), 0, 'gastrin') + receptor(400, achDot(400, SIG_Y0 + 16), 0, 'acetylcholine');
  return b;
}
function signals(v, show, ghost) {
  const has = k => show.includes(k), p = v.p;
  let b = '';
  if (!has('hist')) return b;
  const w = signalWidth(v.drive);
  if (ghost) b += ghostArrow(SIG_X + 16, SIG_Y0 - 8, SIG_X + 16, SIG_Y1, signalWidth(ghost.drive), INK, 'data-ghost-signal');
  b += `<path d="M200 ${SIG_Y0 + 2} Q220 ${SIG_Y0 - 22} ${SIG_X - 4} ${SIG_Y0 - 14}" fill="none" stroke="${AMBER}" stroke-width="${f(clamp(1 + 2.2 * v.hEff, 0.6, 6))}" opacity="${v.hEff > 0.05 ? 1 : 0.35}"/>`;
  if (has('gas')) b += `<path d="M400 ${SIG_Y0 + 2} Q380 ${SIG_Y0 - 22} ${SIG_X + 4} ${SIG_Y0 - 14}" fill="none" stroke="${GREEN}" stroke-width="2.6"/>`;
  b += arrow(SIG_X, SIG_Y0 - 6, SIG_X, SIG_Y1, w, AMBER, `data-flow="signal" data-w="${f(w)}"`);
  b += `<text x="${SIG_X - 20}" y="220" transform="rotate(-90 ${SIG_X - 20} 220)" text-anchor="middle" class="xs b amber">on signal</text>`;
  if (has('pg')) {
    const pgAll = p.pg + p.pgDrug, bw = brakeWidth(pgAll);
    b += cluster2(pgAll);
    if (ghost) b += `<path data-ghost-brake d="M140 ${f(BRAKE_Y - brakeWidth(1) / 2 - bw / 2 - 4)} H${SIG_X - 14}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".8"/>`;
    b += `<g data-flow="brake" data-w="${f(bw)}"><path d="M122 ${BRAKE_Y} H${SIG_X - 16}" stroke="${AMBER}" stroke-width="${f(bw)}" stroke-dasharray="${f(bw + 5)} 4"/><path d="M${SIG_X - 14} ${f(BRAKE_Y - bw - 8)} V${f(BRAKE_Y + bw + 8)}" stroke="${AMBER}" stroke-width="4"/></g>`;
    b += text(146, BRAKE_Y + 24, 'brake', 'xs b amber', 'start');
  }
  return b;
}
function cluster2(pgAll) {
  const pts = [[30, 246], [50, 232], [80, 240], [104, 228], [40, 266], [96, 260], [66, 254], [22, 226], [112, 248], [60, 270]];
  return pts.slice(0, clamp(Math.round(3 * pgAll), 0, 10)).map(([x, y]) => pgDot(x, y)).join('') + text(66, 320, 'prostaglandin', 'xs b amber');
}
const KEYS = ['drive', 'up', 'working', 'made', 'acid', 'shield', 'hEff'];
const attrs = v => KEYS.map(k => `data-${k.toLowerCase()}="${v[k].toFixed(4)}"`).join(' ') + ` data-pumps="${pumpsUp(v)}" data-locked-pumps="${pumpsLocked(v)}"`;
function keyRow(items, y) {
  let x = 10, row = 0, out = '';
  for (const [icon, word] of items) {
    const w = 38 + word.length * 8.4;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    out += `<g transform="translate(${f(x)} ${y + row * 26})">${icon}${text(38, 5, word, 'xs', 'start')}</g>`;
    x += w + 14;
  }
  return { body: out, rows: row + 1 };
}
const KEY = {
  h: [hDot(16, 0, ''), 'hydrogen ion'],
  cl: [clDot(16, 0).replace('data-cl ', ''), 'chloride'],
  pump: [pumpIcon(16, 0, 9), 'proton pump'],
  stored: [`<circle cx="16" cy="0" r="11" fill="#fff" stroke="${MUTED}" stroke-width="1.6"/>${pumpIcon(16, 0, 5.5)}`, 'pump stored in a vesicle'],
  k: [kDot(16, 0).replace('data-k ', ''), 'potassium'],
  locked: [`<g>${pumpIcon(16, 0, 9)}${lockIcon(16, 0)}</g>`, 'pump locked'],
  antacid: [antacidDot(16, 0, ''), 'antacid with acid it cancelled'],
  plug: [`<rect x="9" y="-7" width="14" height="14" rx="2" fill="${INK}"/>`, 'blocker in receptor'],
  normal: [`<path d="M0 0 H32" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/>`, 'normal']
};
const ALL = ['lining', 'h', 'g:acid', 'pumps', 'k', 'cl', 'g:made', 'store', 'hist', 'gas', 'mucus', 'pg'];
function picture(cur, opt = {}) {
  const { show = ALL, ghost = null, legend = '', box = false } = opt;
  let b = lumen(cur, show) + bloodSide(cur, show) + wall(cur, show, ghost) + receptors(cur, show);
  const sig = signals(cur, show, ghost);
  const rows = ['g:made', 'g:acid'].filter(k => show.includes(k)).map(k => k.slice(2));
  let y = 476, g = '';
  for (const k of rows) { g += gaugeRow(k, cur, ghost, y); y += 78; }
  if (box && rows.length) g += `<rect data-key-measures x="6" y="440" width="468" height="${78 * rows.length - 4}" fill="none" stroke="${BLUE}" stroke-width="3"/>`;
  if (ghost) b += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}></g>`;
  b += `<g data-new-state="${esc(legend || 'current')}" ${attrs(cur)}>${sig}${g}</g>`;
  const items = [];
  if (show.includes('h')) items.push(KEY.h);
  if (show.includes('cl')) items.push(KEY.cl);
  if (show.includes('pumps')) items.push(KEY.pump);
  if (show.includes('store') && pumpsUp(cur) < 10) items.push(KEY.stored);
  if (show.includes('k')) items.push(KEY.k);
  if (pumpsLocked(cur) > 0) items.push(KEY.locked);
  if (cur.p.antacid > 0.02) items.push(KEY.antacid);
  if (cur.p.h2 > 0.02) items.push(KEY.plug);
  if (ghost) items.push(KEY.normal);
  if (legend) items.push([`<path d="M0 -5 H32 V5 H0 Z" fill="${AMBER}"/>`, legend]);
  const top = rows.length ? y - 22 : 452;
  if (!items.length) return { body: b, h: top };
  const key = keyRow(items, top + 14);
  return { body: b + key.body, h: top + 30 + 26 * (key.rows - 1) };
}
const pictureSvg = (label, cur, opt) => { const { body: b, h } = picture(cur, opt); return svg(label, b, h); };

/* Step 1: the whole stomach, with a magnified gland. */
function overview() {
  const S = 'M178 70 C130 84 100 150 112 238 C124 330 226 392 322 366 C398 346 436 292 424 250 C414 214 374 214 352 236 C326 262 286 262 268 224 C252 190 262 116 226 76 C214 64 194 64 178 70 Z';
  let b = `<rect x="0" y="0" width="480" height="420" fill="none"/>`;
  b += `<path d="M168 0 V74 M206 0 V66" stroke="${INK}" stroke-width="2"/><rect x="169" y="0" width="36" height="72" fill="${WALL}"/>`;
  b += text(214, 22, 'swallowed food ↓', 'xs b', 'start');
  b += `<path data-stomach d="${S}" fill="${WALL}" stroke="${INK}" stroke-width="2.5"/>`;
  b += `<path d="${S}" transform="translate(268 238) scale(.84) translate(-268 -238)" fill="${LUMEN}" stroke="#b5533b" stroke-width="4" stroke-dasharray="2 5" stroke-linecap="round"/>`;
  [[176, 250, 20], [214, 296, 14], [150, 190, 13], [262, 318, 11]].forEach(([x, y, r]) => { b += `<circle cx="${x}" cy="${y}" r="${r}" fill="${FOOD}" stroke="${AMBER}" stroke-width="1.5"/>`; });
  b += text(196, 352, 'stomach', 'sm b');
  b += text(200, 226, 'food', 'xs b amber');
  // Regions: the acid-making glands are in the domed top and the main body, not the lower end.
  b += text(166, 124, 'domed top', 'xs muted') + text(196, 156, 'main body', 'xs b') + text(372, 306, 'lower end', 'xs muted');
  b += `<path d="M118 160 L40 136" stroke="${MUTED}" stroke-width="1.2"/>` + text(36, 128, 'lining', 'xs b', 'start');
  // A pit in the main body's lining, magnified: a narrow opening leading down into a wider gland.
  b += `<circle cx="260" cy="170" r="8" fill="none" stroke="${INK}" stroke-width="2"/><path d="M267 166 L314 146" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  b += `<g data-gland><circle cx="384" cy="112" r="78" fill="${LINING}" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="M334.2 52 A78 78 0 0 1 433.8 52 Z" fill="${LUMEN}"/>`;
  b += `<path d="M335 54 H374 V88 L362 96 V164 Q384 182 406 164 V96 L394 88 V54 H433" fill="none" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 2; i++) { const y = 58 + i * 14; b += `<rect x="363" y="${y}" width="10" height="11" rx="2" fill="#fff" stroke="${MUTED}"/><rect x="395" y="${y}" width="10" height="11" rx="2" fill="#fff" stroke="${MUTED}"/>`; }
  for (let i = 0; i < 5; i++) { const y = 100 + i * 13; b += `<rect x="349" y="${y}" width="12" height="11" rx="3" fill="${CELL}" stroke="${MUTED}"/><rect x="407" y="${y}" width="12" height="11" rx="3" fill="${CELL}" stroke="${MUTED}"/>`; }
  b += '</g>';
  b += `<path d="M304 72 H370" stroke="${MUTED}" stroke-width="1.2"/>` + text(300, 76, 'pit', 'xs b', 'end');
  b += `<path d="M308 128 H356" stroke="${MUTED}" stroke-width="1.2"/>` + text(304, 132, 'gland', 'xs b', 'end');
  b += text(384, 212, 'gastric pit and gland', 'xs b') + text(384, 230, '(magnified)', 'xs muted');
  return svg('A J-shaped stomach in outline, with a tube bringing swallowed food in from above. Lumps of food sit inside. Labels mark its domed top, its main body and its lower end. A dotted inner edge marks the lining. A magnifying circle shows a spot in the lining of the main body: a narrow gastric pit opens from the inside of the stomach and leads down into a wider gastric gland, walled with small cells.', b, 420);
}

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS = [['drive', 'On signal from the messengers', 'stronger', 'weaker'], ['up', 'Pumps at the surface', 'more', 'fewer'], ['working', 'Working pumps', 'more', 'fewer'], ['made', 'Acid made by the cell', 'more', 'less'], ['acid', 'Stomach acidity', 'more acidic', 'less acidic'], ['shield', 'Mucus and bicarbonate shield', 'thicker', 'thinner']];
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
function madeWords(m) { const w = place('made', m); return w === 'inside' ? 'its usual amount of acid' : w === 'above' ? 'more acid than usual' : m < 0.3 ? 'far less acid than usual' : 'less acid than usual'; }
function acidWords(a) { const w = place('acid', a); return w === 'inside' ? 'inside its usual acidity range' : w === 'below' ? 'less acidic than its usual range' : 'more acidic than its usual range'; }
const bandWords = (v, keys = ['made', 'acid']) => keys.map(k => k === 'made' ? `The cell makes ${madeWords(v.made)}.` : `The stomach is ${acidWords(v.acid)}.`).join(' ');

/* ---------- Core step pictures ---------- */
const S2 = ['lining'], S3 = [...S2, 'h', 'g:acid'], S4 = [...S3, 'pumps', 'k'], S5 = [...S4, 'cl', 'g:made'];
const S7 = [...S5, 'store', 'rise'], S8 = [...S5, 'store', 'hist'], S9 = [...S8, 'gas'], S10 = [...S9, 'mucus'], S11 = [...S10, 'pg'];
const REST_V = GM.settle({ ...NORMAL_P, hist: 0.25, gastrin: 0.25, ach: 0.25 });
const CORE = {
  stomach: overview,
  cell: () => pictureSvg('A slice of the wall of a gland in the stomach’s main body, magnified. Across the top is the hollow inside of the stomach. Below it, two narrow lining cells sit on the left and one large cell, the parietal cell, fills the rest, with its top face touching the inside of the stomach. Along the bottom runs the blood side, a pink band where blood vessels bring supplies.', NV, { show: S2 }),
  acid: () => pictureSvg(`Red dots, each a hydrogen ion, crowd the inside of the stomach above the parietal cell. Under the picture, a gauge labelled how acidic the stomach is runs from less acidic on the left to more acidic on the right, with a shaded usual range; its red marker sits inside the range. ${bandWords(NV, ['acid'])}`, NV, { show: S3 }),
  pump: () => pictureSvg('Four blue proton pumps sit in the parietal cell’s top face. From each, a small red arrow pushes a hydrogen ion up into the stomach, and a small dark arrow brings a potassium square down into the cell.', NV, { show: S4 }),
  chloride: () => pictureSvg(`At the top right of the parietal cell, a small green-edged channel lets a green arrow of chloride out into the stomach, where green-ringed chloride dots mix with the red hydrogen ions to make hydrochloric acid. A second gauge, acid made by the parietal cell, appears above the acidity gauge, with its marker inside its usual amount. ${bandWords(NV)}`, NV, { show: S5 }),
  pepsin: () => pictureSvg('In the stomach, at the top left, a wavy protein chain is cut in two by pepsin, drawn as an amber cross, and a small germ is crossed out in red: killed by the acid. The pumps, chloride channel, hydrogen ions and gauges stay as before.', NV, { show: [...S5, 'pepsin'] }),
  store: () => pictureSvg(`Between meals. Inside the parietal cell, round vesicles each hold a resting pump; only one pump sits in the top face. Small grey arrows show vesicles rising to the surface when the cell is called. Fewer hydrogen ions sit in the stomach. ${bandWords(REST_V)}`, REST_V, { show: S7 }),
  histamine: () => pictureSvg(`On the blood side, amber triangles of histamine drift below the parietal cell, and one sits docked in a cup-shaped receptor labelled H2 on the cell’s bottom face. From it, a thick amber arrow labelled on signal rises through the cell to the top face, where four pumps now work and fewer vesicles stay inside. ${bandWords(NV)}`, NV, { show: S8 }),
  messengers: () => pictureSvg('Two more receptors join the H2 receptor on the cell’s bottom face. Blue diamonds of gastrin dock in the middle one, under the on signal arrow, and green dots of acetylcholine, from a nerve entering at the right, dock in the right-hand one. Lines from all three receptors join the on signal arrow.', NV, { show: S9 }),
  shield: () => pictureSvg('Over the two surface cells on the left lies a green-edged layer of mucus, the mucus shield, dotted with blue bicarbonate dots that soak up acid before it reaches the cells. The parietal cell beside it keeps sending acid into the stomach.', NV, { show: S10 }),
  prostaglandin: () => pictureSvg('Amber-ringed prostaglandin dots appear inside the surface cells. From them, a dashed amber line labelled brake runs into the parietal cell and ends in a bar across the on signal arrow, holding it in check. The mucus shield stays at its normal thickness.', NV, { show: S11 }),
  whole: () => pictureSvg(`The whole cell. Histamine, gastrin and acetylcholine dock on the blood side and send the on signal up to the pumps, which push hydrogen ions into the stomach while chloride follows through its channel. Prostaglandins from the surface cells brake the signal, and the mucus shield guards the lining. A blue box marks the two key measures under the picture: acid made by the parietal cell, and how acidic the stomach is. ${bandWords(NV)}`, NV, { show: ALL, box: true })
};

/* ---------- What changes it ---------- */
const CHANGES = {
  ppi: { to: () => GM.build('normal', ['ppi']), legend: 'with a proton pump inhibitor' },
  h2: { to: () => GM.build('normal', ['h2']), legend: 'with an H2 receptor blocker' },
  antacid: { to: () => GM.build('normal', ['antacid']), legend: 'with an antacid' },
  pga: { to: () => GM.build('normal', ['pga']), legend: 'with a prostaglandin analogue' }
};
const CHANGE_WHERE = {
  ppi: 'Red crosses lock the pumps in the cell’s top face, and their red hydrogen arrows stop. The on signal arrow stays as thick as its dashed normal outline, because the messengers still call. Hydrogen and chloride dots thin out in the stomach.',
  h2: 'Dark blocker squares fill the H2 receptor, so histamine cannot dock. The on signal arrow shrinks inside its dashed normal outline, fewer pumps stay in the top face, and more wait in vesicles. Fewer hydrogen ions sit in the stomach.',
  antacid: 'Blue-edged antacid hexagons fill the stomach, each holding a faded hydrogen ion it has cancelled. The pumps, the on signal and the acid made stay on their dashed normal marks; only the acidity of the stomach falls.',
  pga: 'More amber-ringed prostaglandin dots fill the surface cells, the brake line thickens, and the on signal arrow shrinks inside its dashed normal outline, leaving fewer pumps at the surface. The mucus shield grows thicker than its dashed normal outline.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const cur = GM.settle(GM.mix(NORMAL_P, c.to(), ease(t)));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal. ${CHANGE_WHERE[kind]} ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  return { pic: pictureSvg(label, cur, { show: ALL, ghost: NV, legend: c.legend }), ro: readout(cur, NV, 'Compared with normal') };
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
const levelWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'low' : v < 0.9 ? 'a little low' : v <= 1.1 ? 'normal' : v <= 1.8 ? 'raised' : 'high';
const vomitWords = v => v < 0.02 ? 'none' : v < 0.35 ? 'some' : v < 0.7 ? 'a lot' : 'severe';

/* ---------- Clinical values ----------
   The sources give only directions for drugs and conditions. The model's live value is printed as an illustrative
   number: for the two pH rows, the middle of the quoted range shifted by the model's ten-fold change; for bicarbonate
   and chloride, the middle of the range times the model's relative level. Always labelled as a teaching-model value. */
let data = null;
const MID = {}, DEC = {};
const VALUE_OF = {
  gastricPH: v => MID.gastricPH + v.gastricShift,
  bloodPH: v => MID.bloodPH + v.bloodShift,
  bicarb: v => MID.bicarb * v.bicarb,
  chloride: v => MID.chloride * v.chloride
};
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const decimals = n => (String(n).split('.')[1] || '').length;
const rangeText = v => { const d = decimals(v.low); return `${v.low.toFixed(d)}–${v.high.toFixed(d)}`; };
const barX = (v, n) => { const w = v.high - v.low; return f(20 + clamp((n - (v.low - w)) / (3 * w), 0, 1) * 360); };
const fmt = (v, n) => v.unit === 'pH' ? `pH ${n.toFixed(DEC[v.modelKey])}` : `${n.toFixed(DEC[v.modelKey])} ${v.unit}`;
const placeOf = (v, n) => n > v.high + 1e-9 ? 'above' : n < v.low - 1e-9 ? 'below' : 'inside';
const phNote = (v, w) => v.unit !== 'pH' || w === 'inside' ? '' : w === 'above' ? ' (less acidic)' : ' (more acidic)';
function stateParams(id) {
  if (GM.DRUGS[id]) return GM.build('normal', [id]);
  if (GM.STATES[id]) return GM.build(id);
  return GM.build('normal');
}
const cv = { state: 'normal', p: GM.build('normal'), signal: 1, custom: false };
const cvParams = () => ({ ...cv.p, hist: cv.signal, gastrin: cv.signal, ach: cv.signal });
function updateClinical() {
  $('#clinical-signal').value = cv.signal; $('#clinical-signal-label').textContent = levelWords(cv.signal);
  $('#clinical-vomit').value = cv.p.vomit; $('#clinical-vomit-label').textContent = vomitWords(cv.p.vomit);
  const cur = GM.settle(cvParams());
  const st = data?.states.find(s => s.id === cv.state);
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  const legend = cv.custom ? 'these settings' : st ? st.label.split(' (')[0] : '';
  $('#clinical-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend });
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = st ? (d ? `${DIRECTION[d]}${v.unit === 'pH' && d === 'up' ? ' (less acidic)' : ''}, compared with ${st.comparedWith}` : 'No direction shown for this state: none is cited, so the model holds this value where it was') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    const n = VALUE_OF[v.modelKey](cur), w = placeOf(v, n);
    const reading = row.querySelector('.reading');
    reading.textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${w === 'inside' ? 'inside' : w} typical range${phNote(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = VALUE_OF[v.modelKey](NV), rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeOf(v, n0)} typical range)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id); cv.signal = 1;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
function customised() {
  cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  updateClinical(); announce();
}
$('#clinical-signal').addEventListener('input', e => { cv.signal = Number(e.target.value); customised(); });
$('#clinical-vomit').addEventListener('input', e => { cv.p = { ...cv.p, vomit: Number(e.target.value) }; customised(); });
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = GM.settle(cvParams());
    $('#cv-live').textContent = `Illustrative model: ${data.values.map(v => { const n = VALUE_OF[v.modelKey](m), w = placeOf(v, n); return `${v.label} ${fmt(v, n)}, ${w} typical range`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { hist: 1, gastrin: 1, ach: 1, pg: 1, drugs: new Set() };
const DRUG_ORDER = ['ppi', 'h2', 'antacid', 'pga'];
const DRUG_NAME = { ppi: 'a proton pump inhibitor', h2: 'an H2 receptor blocker', antacid: 'an antacid', pga: 'a prostaglandin analogue' };
function exploreParams() {
  let p = { ...GM.NORMAL, hist: ex.hist, gastrin: ex.gastrin, ach: ex.ach, pg: ex.pg };
  for (const d of DRUG_ORDER) if (ex.drugs.has(d)) p = GM.DRUGS[d](p);
  return p;
}
const pct = x => `${Math.round(100 * x)}%`;
function updateExplore() {
  for (const id of ['hist', 'gastrin', 'ach', 'pg']) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = levelWords(ex[id]); }
  const cur = GM.settle(exploreParams());
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => DRUG_NAME[d]);
  const who = drugs.length ? `your messenger settings with ${drugs.join(', ')}` : 'your messenger settings';
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend: 'your settings' }) + readout(cur, NV, 'Compared with normal');
  const [shW] = more(cur.shield, NV.shield, 'thicker than normal', 'thinner than normal');
  const res = $('#model-results');
  res.textContent = `Illustrative model output: on signal ${pct(cur.drive / NV.drive)} of normal · ${pumpsUp(cur)} of ten pumps at the surface, ${pumpsLocked(cur)} locked · acid made ${pct(cur.made)} of normal · acid left in the stomach ${pct(cur.acid)} of normal, so the stomach is ${acidWords(cur.acid)} · shield ${shW === 'about the same' ? 'about normal' : shW}.`;
  Object.assign(res.dataset, { drive: cur.drive.toFixed(4), made: cur.made.toFixed(4), acid: cur.acid.toFixed(4), up: cur.up.toFixed(4), shield: cur.shield.toFixed(4) });
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['hist', 'gastrin', 'ach', 'pg']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { hist: 1, gastrin: 1, ach: 1, pg: 1 }); ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; });
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['gastricPH', 'bloodPH', 'bicarb', 'chloride'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!MODEL_KEYS.every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    data = loaded;
    // The model's normal sits at the middle of each quoted range.
    for (const k of MODEL_KEYS) { const v = byKey(k); MID[k] = (v.low + v.high) / 2; DEC[k] = Math.max(1, decimals(v.low)); }
    const g = byKey('gastricPH');
    ACID_BAND = [Math.pow(10, MID.gastricPH - g.high), Math.pow(10, MID.gastricPH - g.low)];
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal in the middle of each band; the large number in each row is the model’s level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. For a drug or condition the sources give only a direction; how far the model moves is an illustrative choice.';
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
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${rangeText(v)} ${v.unit} as a shaded band, a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `Source range ${rangeText(v)} ${v.unit} (shaded) · blue line: illustrative teaching-model value`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, ev, cite);
      $('#value-rows').append(row);
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
