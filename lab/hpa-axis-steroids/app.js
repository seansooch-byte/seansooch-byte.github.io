'use strict';
const HM = window.HPAModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The model ----------
   view(): the settled axis for a set of model settings (model.js); every level is relative to normal (1).
   The cited sources give a steroid synthesis inhibitor no direction for glucose (or inflammation), so its block is
   never allowed to move them: they are taken from the same body without the block, and flagged as held.
   Likewise the cited Addison’s passage gives no potassium direction, so a change in the working cortex is never
   allowed to move potassium: it is taken from the same body with a normal-sized cortex (Mk drives the urine picture). */
const view = p => {
  let v = { ...HM.settle(p), Mk: null, held: [] };
  v.Mk = v.M;
  if (p.block > 0.001) {
    const u = HM.settle({ ...p, block: 0 });
    v = { ...v, glucose: u.glucose, inflam: u.inflam, held: [...v.held, 'glucose', 'inflam'] };
  }
  if (Math.abs(p.cap - 1) > 1e-6) {
    const u = HM.settle({ ...p, cap: 1 });
    v = { ...v, potassium: u.potassium, Mk: u.M, held: [...v.held, 'potassium'] };
  }
  if (!v.held.length) delete v.held;
  return v;
};
const isHeld = (v, k) => !!v.held?.includes(k);
const NORMAL_P = HM.build('normal');
const NV = view(NORMAL_P);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', AMBERF = '#f2a93b', GREEN = '#1d6b3a', GREENF = '#8fcf9d', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const BLOOD = '#f6dcd6', BANDF = '#d1d8fd', SKIN = '#f3e4d6', CORTEX = '#f2c27a', MEDULLA = '#b86b4b', KIDNEY = '#d99a86', BRAIN = '#e8cfe0', URINE = '#f7eaa6';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
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
// A curved arrow (quadratic), its head following the curve's last direction.
function curveArrow(x1, y1, cx, cy, x2, y2, w, color, extra = '') {
  if (w <= 0) return '';
  const dx = x2 - cx, dy = y2 - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = w * 1.1 + 7, hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${x1} ${y1} Q${cx} ${cy} ${f(bx)} ${f(by)}" stroke="${color}" stroke-width="${f(w)}" fill="none"/>` +
    `<path d="M${x2} ${y2} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${color}"/></g>`;
}
const width = v => v <= 0.03 ? 0 : clamp(2 + 6 * v, 2, 15);

// Fixed, shuffled places for dots inside the blood vessel.
const SLOTS = (() => {
  const s = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 29; c++) s.push([70 + c * 13.2 + (r % 2) * 6.6, 411 + r * 12]);
  let seed = 11;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const cortDot = (x, y) => `<circle data-cort cx="${f(x)}" cy="${f(y)}" r="4.6" fill="${AMBERF}" stroke="${AMBER}" stroke-width="1.5"/>`;
const drugDot = (x, y, r = 5.4) => `<path data-drug d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${AMBER}"/>`;
const hexPts = (x, y, r) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join(' L');
const glucDot = (x, y) => `<path data-gluc d="M${hexPts(x, y, 4.4)} Z" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`;
const kDot = (x, y) => `<rect data-k x="${f(x - 3)}" y="${f(y - 3)}" width="6" height="6" fill="${INK}"/>`;

/* The gauges on the right: the three signals of the axis (ratio scale, with an illustrative usual zone, no numbers)
   and three blood levels (with the healthy band from the data file). */
const SIGNALS = ['crh', 'acth', 'cortisol'], BLOODK = ['glucose', 'sodium', 'potassium'];
const GX = { crh: 326, acth: 388, cortisol: 448, glucose: 326, sodium: 388, potassium: 448 };
const GTOP = { crh: 48, acth: 48, cortisol: 48, glucose: 242, sodium: 242, potassium: 242 }, GLEN = 128, GHALF = 60;
const GMID = k => GTOP[k] + GLEN / 2;
const SPAN = { glucose: 0.6, sodium: 0.085, potassium: 0.5 };
const USUAL = [0.75, 1.33];   // the illustrative usual zone for CRH, ACTH and cortisol (no source gives a range)
const isSignal = k => SIGNALS.includes(k);
const gyRaw = (k, rel) => isSignal(k) ? Math.log(Math.max(rel, 1e-6)) / Math.log(5) : (rel - 1) / SPAN[k];
const gy = (k, rel) => GMID(k) - clamp(gyRaw(k, rel), -1, 1) * GHALF;
let BANDS = null;   // set from clinical-values.json; until then the blood bands are an illustrative fallback
const FALLBACK = { glucose: [0.85, 1.15], sodium: [0.97, 1.03], potassium: [0.85, 1.15] };
const bandOf = k => isSignal(k) ? USUAL : (BANDS ? BANDS[k] : FALLBACK[k]);
const bandY = k => { const [lo, hi] = bandOf(k); return [gy(k, hi), gy(k, lo)]; };
const place = (k, rel) => { const [lo, hi] = bandOf(k); return rel > hi + 1e-9 ? 'above' : rel < lo - 1e-9 ? 'below' : 'inside'; };
const LABEL = { crh: 'CRH', acth: 'ACTH', cortisol: 'cortisol', glucose: 'glucose', sodium: 'sodium', potassium: 'potassium' };
const NAME = { crh: 'CRH', acth: 'ACTH', cortisol: 'Cortisol', glucose: 'Glucose', sodium: 'Sodium', potassium: 'Potassium' };
const GCOL = { crh: INK, acth: BLUE, cortisol: AMBER, glucose: INK, sodium: GREEN, potassium: INK };
function gauges(cur, ghost, keys, boxed) {
  let b = '';
  const has1 = keys.some(isSignal), has2 = keys.some(k => !isSignal(k));
  if (has1) b += text(388, 16, 'signals', 'xs b muted');
  if (has2) b += text(388, 210, 'in the blood', 'xs b' + (boxed ? ' blue' : ' muted'));
  for (const k of keys) {
    const x = GX[k], col = GCOL[k], [b0, b1] = bandY(k), top = GTOP[k];
    b += `<path d="M${x} ${top} V${top + GLEN}" stroke="${RULE}" stroke-width="4"/>`;
    b += `<rect data-band="${k}" x="${x - 14}" y="${f(b0)}" width="28" height="${f(b1 - b0)}" fill="${BANDF}"/>`;
    b += text(k === 'potassium' ? 478 : x, top - 10, LABEL[k], 'gl ' + (k === 'acth' ? 'blue' : k === 'cortisol' ? 'amber' : k === 'sodium' ? 'green' : ''), k === 'potassium' ? 'end' : 'middle');
    if (ghost) b += `<path data-ghost-gauge="${k}" d="M${x - 18} ${f(gy(k, ghost[k]))} H${x + 18}" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`;
    if (isHeld(cur, k)) b += `<rect data-held-gauge="${k}" x="${x - 21}" y="${top - 4}" width="42" height="${GLEN + 8}" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="3 3"/>`;
    const rel = cur[k], y = gy(k, rel), raw = gyRaw(k, rel);
    b += `<rect data-gauge="${k}" data-level="${rel.toFixed(3)}" x="${x - 13}" y="${f(y - 4)}" width="26" height="8" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
    if (raw > 1) b += `<path d="M${x} ${top - 24} l-6 8 h12 Z" fill="${col}"/>`;
    if (raw < -1) b += `<path d="M${x} ${top + GLEN + 14} l-6 -8 h12 Z" fill="${col}"/>`;
  }
  if (has1 || has2) b += text(388, has2 ? 392 : 198, 'shaded: usual range', 'xs muted');
  return b;
}

/* Anatomy */
const CORTEX_D = 'M112 266 Q116 222 150 204 Q184 222 188 266 Z';
const ZONES_D = 'M118 263 Q122 229 150 212 Q178 229 182 263 M124 263 Q128 235 150 220 Q172 235 176 263';
const MEDULLA_D = 'M133 264 Q137 242 150 232 Q163 242 167 264 Z';
const KIDNEY_D = 'M150 258 C194 256 200 344 152 346 C120 347 106 322 116 304 C121 296 121 288 116 282 C110 268 126 258 150 258 Z';
const FLAME_D = 'M0 0 C-15 0 -19 -12 -13 -22 C-9 -29 -4 -27 -2 -36 C7 -28 17 -19 15 -8 C14 -3 8 0 0 0 Z';
const FLAME = [264, 232];
const flameScale = inf => clamp(0.35 + 0.65 * inf, 0.3, 1.8);
function bolt(x, y, o) {
  return `<g data-bolt opacity="${o.toFixed(2)}"><path d="M${x + 4} ${y} L${x - 8} ${y + 20} L${x} ${y + 20} L${x - 5} ${y + 36} L${x + 11} ${y + 13} L${x + 3} ${y + 13} L${x + 9} ${y} Z" fill="${AMBERF}" stroke="${RED}" stroke-width="1.6"/></g>` + text(x + 18, y + 22, 'stress', 'xs b red', 'start');
}
function anatomy(v, show, ghost) {
  const has = k => show.includes(k), p = v.p;
  let b = '';
  // Head, neck and body
  b += `<ellipse cx="150" cy="76" rx="112" ry="64" fill="${SKIN}" stroke="${RULE}" stroke-width="1.5"/>`;
  b += `<rect x="62" y="150" width="176" height="252" rx="26" fill="${SKIN}" stroke="${RULE}" stroke-width="1.5"/>`;
  b += `<rect x="122" y="132" width="56" height="26" fill="${SKIN}"/><path d="M122 136 V151 M178 136 V151" stroke="${RULE}" stroke-width="1.5"/>`;
  if (has('brain')) b += text(150, 30, 'brain', 'xs b muted');
  if (has('hypothalamus')) b += `<ellipse cx="150" cy="58" rx="36" ry="15" fill="${BRAIN}" stroke="${INK}" stroke-width="2"/>` + text(192, 62, 'hypothalamus', 'xs b', 'start');
  if (has('pituitary')) {
    const tr = clamp(p.tumor, 0, 4), r = 12 + 2.2 * tr;
    b += `<path d="M150 ${has('hypothalamus') ? 73 : 64} V${f(118 - r)}" stroke="${INK}" stroke-width="3"/><circle cx="150" cy="118" r="12" fill="${BRAIN}" stroke="${INK}" stroke-width="2"/>`;
    if (tr > 0.02) b += `<g data-tumor opacity="${clamp(tr / 1.5, 0, 1).toFixed(2)}"><circle cx="150" cy="118" r="${f(r)}" fill="#f0b7ae" fill-opacity=".85" stroke="${RED}" stroke-width="2.6"/></g>` + text(150 + r + 6, 116, 'pituitary', 'xs b', 'start') + text(150 + r + 6, 131, 'tumor', 'xs b red', 'start');
    else b += text(168, 123, 'pituitary', 'xs b', 'start');
  }
  if (p.stress > 1.15 && has('hypothalamus')) b += bolt(56, 18, clamp((p.stress - 1.1) / 0.8, 0, 1));
  // Kidney and adrenal gland
  b += `<path d="${KIDNEY_D}" fill="${KIDNEY}" stroke="${INK}" stroke-width="2"/>`;
  const dmg = clamp((1 - p.cap) / 0.8, 0, 1);
  b += `<path data-cortex="${p.cap.toFixed(3)}" d="${CORTEX_D}" fill="${CORTEX}" fill-opacity="${(1 - 0.7 * dmg).toFixed(2)}" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="${ZONES_D}" fill="none" stroke="#c98a3a" stroke-width="1.2"/><path d="${MEDULLA_D}" fill="${MEDULLA}" stroke="${INK}" stroke-width="1.5"/>`;
  if (has('labels1')) {
    b += `<path d="M178 228 L226 214 M160 252 L226 250 M196 306 L226 306" stroke="${MUTED}" stroke-width="1"/>`;
    b += text(230, 218, 'cortex', 'xs b', 'start') + text(230, 254, 'medulla', 'xs b', 'start') + text(230, 310, 'kidney', 'xs b', 'start');
    b += text(104, 222, 'adrenal gland', 'xs b', 'end') + text(104, 238, '(one of two)', 'xs muted', 'end');
  } else b += text(106, 226, 'adrenal', 'xs b', 'end') + text(154, 312, 'kidney', 'xs muted');
  let side = null;
  if (dmg > 0.3) {
    const o = clamp((dmg - 0.3) / 0.5, 0, 1).toFixed(2);
    b += `<g data-damage opacity="${o}">` + [[126, 246], [174, 246], [150, 214], [138, 228], [162, 228]].map(([x, y]) => `<path d="M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}" stroke="${RED}" stroke-width="2.4"/>`).join('') + '</g>';
    side = ['damaged', 'cortex'];
  }
  if (p.block > 0.02) {
    const o = clamp(p.block / 0.4, 0, 1).toFixed(2);
    b += `<g data-block opacity="${o}">` + [[127, 248], [173, 248]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#fff" fill-opacity=".6" stroke="${RED}" stroke-width="3"/><path d="M${x - 7} ${y + 7} L${x + 7} ${y - 7}" stroke="${RED}" stroke-width="3"/>`).join('') + '</g>';
    side = ['building', 'blocked'];
  }
  if (side) b += text(106, 248, side[0], 'xs b red', 'end') + text(106, 263, side[1], 'xs b red', 'end');
  // Inflammation: a flame that the glucocorticoid signal shrinks
  if (has('flame')) {
    if (ghost) b += `<path data-ghost-flame transform="translate(${FLAME[0] + 8} ${FLAME[1]}) scale(${flameScale(ghost.inflam).toFixed(3)})" d="${FLAME_D}" fill="none" stroke="${INK}" stroke-width="${f(1.6 / flameScale(ghost.inflam))}" stroke-dasharray="4 3" opacity=".75"/>`;
    const s = flameScale(v.inflam);
    b += `<path data-flame="${v.inflam.toFixed(3)}" transform="translate(${FLAME[0]} ${FLAME[1]}) scale(${s.toFixed(3)})" d="${FLAME_D}" fill="#e66a55" stroke="${RED}" stroke-width="${f(1.6 / s)}"/>`;
    b += text(FLAME[0] - 8, 160, 'inflammation', 'xs b red');
  }
  // Tablets from outside the body
  if (p.exoG > 0.01) {
    b += `<g data-tablet="gluco"><rect x="38" y="352" width="22" height="14" rx="7" fill="${AMBERF}" stroke="${AMBER}" stroke-width="2"/><path d="M49 353 V365" stroke="${AMBER}" stroke-width="1.4"/></g>`;
    b += arrow(49, 368, 49, 398, width(Math.min(p.exoG, 2) * 0.5), AMBER, 'data-flow="tablet-g"');
  }
  if (p.exoM > 0.01) {
    b += `<g data-tablet="mineral"><rect x="64" y="352" width="22" height="14" rx="7" fill="${GREENF}" stroke="${GREEN}" stroke-width="2"/><path d="M75 353 V365" stroke="${GREEN}" stroke-width="1.4"/></g>`;
    b += arrow(75, 368, 75, 398, width(Math.min(p.exoM, 2) * 0.5), GREEN, 'data-flow="tablet-m"');
  }
  if (p.exoG > 0.01 || p.exoM > 0.01) b += text(62, 344, 'tablet', 'xs b');
  // Urine, with potassium leaving
  if (has('aldo')) {
    b += `<path d="M238 338 C246 350 252 356 252 363 A14 14 0 0 1 224 363 C224 356 230 350 238 338 Z" fill="${URINE}" stroke="${INK}" stroke-width="1.5"/>`;
    const nk = clamp(Math.round(2.5 * (v.Mk ?? v.M)), 0, 6);
    [[232, 362], [242, 360], [237, 370], [229, 352], [246, 369], [238, 351]].slice(0, nk).forEach(([x, y]) => { b += kDot(x, y); });
    b += text(238, 394, 'urine', 'xs b');
  }
  return b;
}
function flowsOf(v, show) {
  const has = k => show.includes(k), out = [];
  if (has('release')) out.push(['release', 116, 256, 90, 398, width(v.cortisol), AMBER]);
  if (has('acth')) out.push(['acth', 150, 136, 150, 202, width(v.acth), BLUE]);
  if (has('crh')) out.push(['crh', 122, 70, 138, 106, width(v.crh) * 0.8, INK]);
  if (has('aldo')) {
    const w = clamp(1.5 + 1.6 * v.M, 1.5, 9);
    out.push(['sodium', 150, 348, 150, 398, w, GREEN]);
    out.push(['potassium', 184, 330, 226, 346, clamp(1.5 + 1.6 * (v.Mk ?? v.M), 1.5, 9) * 0.8, INK]);
  }
  return out;
}
// The brake follows the whole glucocorticoid signal the brain reads: the body's own cortisol plus any glucocorticoid drug.
function brake(v, ghost) {
  const w = clamp(1.5 + 2.6 * v.E, 1.5, 9);
  let b = '';
  if (ghost) { const gw = clamp(1.5 + 2.6 * ghost.E, 1.5, 9); b += `<path data-ghost-brake d="M${f(30 + gw / 2 + w / 2 + 4)} 398 V66" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".7" fill="none"/>`; }
  b += `<g data-flow="brake" data-w="${f(w)}"><path d="M30 400 V58 H104" fill="none" stroke="${AMBER}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 4)} 4"/><path d="M30 118 H128" fill="none" stroke="${AMBER}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 4)} 4"/>` +
    `<path d="M113 58 l-10 -${f(w / 2 + 5)} v${f(w + 10)} Z M138 118 l-10 -${f(w / 2 + 5)} v${f(w + 10)} Z" fill="${AMBER}"/></g>`;
  b += `<text x="20" y="250" transform="rotate(-90 20 250)" text-anchor="middle" class="xs b amber">brake</text>`;
  return b;
}
function vessel(v, show) {
  let b = `<rect x="8" y="400" width="464" height="46" rx="23" fill="${BLOOD}" stroke="${RED}" stroke-width="2"/>` + text(464, 438, 'blood', 'xs b red', 'end');
  if (!show.includes('blood')) return b;
  const nc = clamp(Math.round(10 * v.cortisol), 0, 34), nd = clamp(Math.round(9 * v.p.exoG), 0, 24), ng = show.includes('glucose') ? clamp(Math.round(9 * v.glucose), 0, 26) : 0;
  let i = 0;
  SLOTS.slice(i, i += nc).forEach(([x, y]) => { b += cortDot(x, y); });
  SLOTS.slice(i, i += nd).forEach(([x, y]) => { b += drugDot(x, y); });
  SLOTS.slice(i, i += ng).forEach(([x, y]) => { b += glucDot(x, y); });
  return b;
}
const KEYS = ['crh', 'acth', 'cortisol', 'glucose', 'sodium', 'potassium', 'inflam'];
const attrs = v => KEYS.map(k => `data-${k}="${v[k].toFixed(3)}"`).join(' ') + ` data-signal="${v.E.toFixed(3)}"`;
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
  cortisol: [cortDot(17, 0), 'cortisol'],
  glucose: [glucDot(17, 0), 'glucose'],
  drug: [drugDot(17, 0), 'steroid drug'],
  sodium: [`<path d="M0 0 H30" stroke="${GREEN}" stroke-width="4"/><path d="M34 0 l-8 -6 v12 Z" fill="${GREEN}"/>`, 'sodium kept'],
  potassium: [kDot(17, 0), 'potassium out'],
  normal: [`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`, 'normal']
};
const ALL = ['blood', 'release', 'glucose', 'flame', 'aldo', 'brain', 'pituitary', 'acth', 'hypothalamus', 'crh', 'brake', 'g:crh', 'g:acth', 'g:cortisol', 'g:glucose', 'g:sodium', 'g:potassium'];
/* One full picture: brain and body on the left, the gauges on the right, the blood vessel across the bottom. */
function picture(cur, opt = {}) {
  const { show = ALL, ghost = null, legend = '', extra = '' } = opt;
  let b = anatomy(cur, show, ghost);
  b += vessel(cur, show);
  if (ghost) {
    let g = '';
    for (const [, x1, y1, x2, y2, w, color] of flowsOf(ghost, show)) g += ghostArrow(x1 + 12, y1, x2 + 12, y2, w, color);
    b += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}>${g}</g>`;
  }
  let flows = '';
  for (const [k, x1, y1, x2, y2, w, color] of flowsOf(cur, show)) flows += arrow(x1, y1, x2, y2, w, color, `data-flow="${k}" data-w="${f(w)}"`);
  if (show.includes('aldo')) {
    const w = clamp(1.5 + 1.6 * cur.M, 1.5, 9);
    if (ghost) b += `<path data-ghost-aldo d="M196 236 Q246 262 206 294" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".7"/>`;
    flows += curveArrow(186, 236, 236, 262, 196, 292, w, GREEN, `data-flow="aldo" data-w="${f(w)}"`);
  }
  let labels = '';
  if (show.includes('acth')) labels += text(162, 178, 'ACTH', 'xs b blue', 'start');
  if (show.includes('crh')) labels += text(116, 100, 'CRH', 'xs b', 'end');
  if (show.includes('release')) labels += text(97, 300, 'cortisol', 'xs b amber', 'end');
  if (show.includes('aldo')) labels += text(226, 282, 'aldosterone', 'xs b green', 'start');
  const brk = show.includes('brake') ? brake(cur, ghost) : '';
  const keys = [...SIGNALS, ...BLOODK].filter(k => show.includes('g:' + k));
  const g = gauges(cur, ghost, keys, show.includes('boxed'));
  b += `<g data-new-state="${esc(legend || 'current')}" ${attrs(cur)}>${brk}${flows}${labels}${g}</g>`;
  b += extra;
  const items = [];
  if (show.includes('blood')) items.push(KEY.cortisol);
  if (show.includes('glucose')) items.push(KEY.glucose);
  if (cur.p.exoG > 0.01) items.push(KEY.drug);
  if (show.includes('aldo')) items.push(KEY.sodium, KEY.potassium);
  if (ghost) items.push(KEY.normal);
  if (legend) items.push([`<path d="M0 -4 H34 V4 H0 Z" fill="${AMBER}"/>`, legend]);
  const heldShown = (cur.held || []).filter(k => k === 'inflam' ? show.includes('flame') : show.includes('g:' + k));
  if (heldShown.length) items.push([`<g data-held><rect x="4" y="-6" width="26" height="12" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="3 3"/></g>`, `${heldShown.map(k => k === 'inflam' ? 'inflammation' : k).join(', ')}: held, no cited direction`]);
  if (!items.length) return { body: b, h: 456 };
  const key = keyRow(items, 474);
  return { body: b + key.body, h: 488 + 24 * (key.rows - 1) };
}
const pictureSvg = (label, cur, opt) => { const { body: b, h } = picture(cur, opt); return svg(label, b, h); };

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS = [['crh', 'CRH'], ['acth', 'ACTH'], ['cortisol', 'Cortisol made by the body'], ['glucose', 'Glucose'], ['sodium', 'Sodium'], ['potassium', 'Potassium'], ['inflam', 'Inflammation']];
function compare(v, ref, keys = ROWS.map(r => r[0])) {
  return ROWS.filter(([k]) => keys.includes(k)).map(([k, name]) => [name, isHeld(v, k) ? ['not shown: no cited direction', 'same'] : k === 'inflam' ? more(v.inflam, ref.inflam, 'fiercer', 'calmer') : more(v[k], ref[k])]);
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref, keys) => compare(v, ref, keys).map(([k, [w]]) => `${k}: ${w}`).join('; ');
const SIGNAL_WORD = { above: 'high', below: 'low', inside: 'usual' };
function bandWords(v, keys = [...SIGNALS, ...BLOODK]) {
  const parts = [];
  for (const k of keys) {
    const w = place(k, v[k]);
    if (isHeld(v, k)) parts.push(`${NAME[k]} is left where it was, because no direction is cited for this change.`);
    else if (isSignal(k)) parts.push(`${NAME[k]} runs ${SIGNAL_WORD[w]}.`);
    else parts.push(w === 'inside' ? `${NAME[k]} sits inside its healthy band.` : `${NAME[k]} sits ${w} its healthy band.`);
  }
  return parts.join(' ');
}

/* ---------- Core step pictures ---------- */
const BASE = ['blood', 'release', 'g:cortisol'];
const STEP_SHOW = {
  glands: ['labels1'],
  cortisol: BASE,
  fuel: [...BASE, 'glucose', 'g:glucose'],
  inflam: [...BASE, 'glucose', 'g:glucose', 'flame'],
  aldo: [...BASE, 'glucose', 'g:glucose', 'flame', 'aldo', 'g:sodium', 'g:potassium'],
  pituitary: [...BASE, 'glucose', 'g:glucose', 'flame', 'aldo', 'g:sodium', 'g:potassium', 'brain', 'pituitary', 'acth', 'g:acth'],
  hypothalamus: [...BASE, 'glucose', 'g:glucose', 'flame', 'aldo', 'g:sodium', 'g:potassium', 'brain', 'pituitary', 'acth', 'g:acth', 'hypothalamus', 'crh', 'g:crh']
};
STEP_SHOW.stress = STEP_SHOW.hypothalamus;
function keyBox() {
  return `<rect data-key-measures x="306" y="196" width="168" height="202" fill="none" stroke="${BLUE}" stroke-width="3"/>`;
}
const LOOP = ['crh', 'acth', 'cortisol', 'glucose', 'inflam'];
const CORE = {
  glands: () => pictureSvg('A head and body in outline. Low in the body sits a kidney, bean-shaped, with an adrenal gland sitting on top of it like a cap: an outer layer, the cortex, wrapped around an inner core, the medulla. The body has two of these, one on each kidney.', NV, { show: STEP_SHOW.glands }),
  cortisol: () => pictureSvg(`An amber arrow labelled cortisol runs from the adrenal cortex down into a blood vessel, which carries amber cortisol dots across the body. At the top right, a level gauge for cortisol has a shaded usual zone, and its marker sits inside it. ${bandWords(NV, ['cortisol'])}`, NV, { show: STEP_SHOW.cortisol }),
  fuel: () => pictureSvg(`White six-sided glucose dots join the cortisol dots in the blood. A second gauge, glucose, appears under the heading in the blood, with a shaded healthy band; its marker sits inside the band. More cortisol would raise it. ${bandWords(NV, ['cortisol', 'glucose'])}`, NV, { show: STEP_SHOW.fuel }),
  inflam: () => pictureSvg('A small red flame labelled inflammation appears beside the body. Cortisol in the blood keeps the flame at a modest normal size: more cortisol would shrink it, less would let it flare.', NV, { show: STEP_SHOW.inflam }),
  aldo: () => pictureSvg(`A green curved arrow labelled aldosterone runs from the adrenal cortex to the kidney. From the kidney, a green arrow carries sodium back into the blood, and a dark arrow sends potassium, drawn as small squares, into a drop of urine. Two new gauges, sodium and potassium, sit inside their healthy bands. ${bandWords(NV, ['sodium', 'potassium'])}`, NV, { show: STEP_SHOW.aldo }),
  pituitary: () => pictureSvg('The head now shows the brain, with the pea-sized pituitary at its base. A thick blue arrow labelled ACTH runs from the pituitary down the body to the adrenal gland. A new ACTH gauge, under the heading signals, has its marker inside its usual zone.', NV, { show: STEP_SHOW.pituitary }),
  hypothalamus: () => pictureSvg('Above the pituitary sits the hypothalamus, joined to it by a short stalk. A dark arrow labelled CRH runs from the hypothalamus to the pituitary, which sends the blue ACTH arrow on to the adrenal gland: a chain from brain to gland. A CRH gauge joins the signals, inside its usual zone.', NV, { show: STEP_SHOW.hypothalamus }),
  stress: () => {
    const v = view(HM.mix(NORMAL_P, { ...NORMAL_P, stress: 2.5 }, 1));
    return pictureSvg(`Long-term stress, drawn as a lightning bolt beside the brain. The CRH and ACTH arrows thicken past their dashed normal outlines, the cortisol arrow thickens and more cortisol and glucose dots fill the blood. ${bandWords(v)} Compared with normal: ${describe(v, NV, LOOP)}.`, v, { show: STEP_SHOW.stress, ghost: NV, legend: 'long-term stress' });
  },
  brake: () => {
    const v = HM.open(NORMAL_P, 2);
    return pictureSvg(`Cortisol running high. The blood is crowded with cortisol dots, and a thick dashed amber line labelled brake runs from the blood up to the hypothalamus and pituitary. The CRH and ACTH arrows shrink to thin lines beside their dashed normal outlines. ${bandWords(v, SIGNALS)} Compared with normal: ${describe(v, NV, LOOP)}.`, v, { show: [...STEP_SHOW.hypothalamus, 'brake'], ghost: NV, legend: 'cortisol running high' });
  },
  lowbrake: () => {
    const v = HM.open(NORMAL_P, 0.45);
    return pictureSvg(`Cortisol running low. Few cortisol dots remain in the blood and the brake line is thin. The CRH and ACTH arrows swell well past their dashed normal outlines. ${bandWords(v, SIGNALS)} Compared with normal: ${describe(v, NV, LOOP)}.`, v, { show: [...STEP_SHOW.hypothalamus, 'brake'], ghost: NV, legend: 'cortisol running low' });
  },
  whole: () => pictureSvg('The whole axis: the hypothalamus sends CRH to the pituitary, the pituitary sends ACTH to the adrenal cortex, and the cortex releases cortisol, which frees glucose and calms inflammation, and aldosterone, which keeps sodium and sends potassium out. A dashed brake line runs from the blood back up to the brain. A blue box marks the three blood gauges, glucose, sodium and potassium, as the key blood tests.', NV, { show: [...ALL, 'boxed'], extra: keyBox() })
};

/* ---------- What changes it ---------- */
// Each change morphs the model's settings from a normal body to the changed one; sizes are illustrative.
const CHANGES = {
  cushing: { to: () => HM.build('cushing'), legend: 'Cushing’s disease' },
  addison: { to: () => HM.build('addison'), legend: 'Addison’s disease' },
  glucocorticoid: { to: () => HM.build('normal', ['glucocorticoid']), legend: 'with a glucocorticoid drug' },
  mineralocorticoid: { to: () => HM.build('normal', ['mineralocorticoid']), legend: 'with a mineralocorticoid drug' },
  inhibitor: { to: () => HM.build('normal', ['inhibitor']), legend: 'with a synthesis inhibitor' }
};
const CHANGE_WHERE = {
  cushing: 'A red tumor swells on the pituitary and pours out a thick blue ACTH arrow. The cortex answers with a thick cortisol arrow and the blood fills with cortisol and glucose dots. The thick brake line shrinks the CRH arrow to a thread, and the inflammation flame shrinks.',
  addison: 'Red crosses mark the damaged adrenal cortex, which fades. Its cortisol arrow thins and the blood empties of cortisol and glucose dots; the aldosterone arrow thins, so less sodium is kept. The brake line thins, the CRH and ACTH arrows swell, and the inflammation flame flares. The potassium gauge, boxed with a dashed line, stays where it was: the cited passage gives no potassium direction for this disease.',
  glucocorticoid: 'An amber tablet sends steroid drug, drawn as amber diamonds, into the blood. The brake line thickens with the drug, the CRH and ACTH arrows shrink to threads and the gland’s own cortisol arrow thins, while glucose dots multiply and the inflammation flame shrinks well below its dashed normal outline.',
  mineralocorticoid: 'A green tablet sends an aldosterone-like drug into the blood. The green aldosterone arrow thickens, the kidney returns more sodium to the blood and sends more potassium squares into the urine. The CRH, ACTH and cortisol arrows stay on their dashed normal outlines.',
  inhibitor: 'Red block signs appear over the adrenal cortex and its cortisol arrow thins. Fewer cortisol dots remain, the brake line thins, and the CRH and ACTH arrows swell past their dashed normal outlines as the brain pushes the blocked cortex harder. The glucose gauge, boxed with a dashed line, and the inflammation flame stay where they were: the cited sources give no direction for them with this drug class.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const cur = view(HM.mix(NORMAL_P, c.to(), ease(t)));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal. ${CHANGE_WHERE[kind]} ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  const pic = pictureSvg(label, cur, { show: ALL, ghost: NV, legend: c.legend });
  return { pic, ro: readout(cur, NV, 'Compared with normal') };
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
const capWords = v => v < 0.2 ? 'very little' : v < 0.6 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : 'more than normal';
const stressWords = v => v < 0.75 ? 'calmer than usual' : v <= 1.25 ? 'usual' : v <= 2 ? 'raised' : 'severe';
const tumorWords = v => v < 0.05 ? 'none' : v < 1.2 ? 'small' : v < 2.5 ? 'large' : 'very large';

/* ---------- Clinical values ----------
   The sources give only directions for diseases and drugs. The model's live value is printed as an illustrative
   number: its relative level × the middle of the quoted range, at the source's precision, always labelled as a
   teaching-model value, never as a sourced one. */
let data = null;
const MID = {}, DEC = {};
const modelNumber = (k, rel) => (MID[k] * rel).toFixed(DEC[k]);
const PLACE_ARROW = { inside: '↔', above: '↑', 'far above': '⇈', below: '↓', 'far below': '⇊' };
function farPlace(k, rel) { const w = place(k, rel); return w !== 'inside' && Math.abs(gyRaw(k, rel)) >= 1 ? `far ${w}` : w; }
const levelWords = (k, rel, band = 'its healthy band') => { const w = farPlace(k, rel); return w === 'inside' ? `inside ${band}` : `${w} ${band}`; };
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const barX = (k, rel) => f(200 + clamp(gyRaw(k, rel), -1, 1) * 170);
// Print a range as the source does: the high end keeps the low end's decimals (3.5–5.0).
const rangeText = v => { const d = (String(v.low).split('.')[1] || '').length; return `${v.low}–${v.high.toFixed(d)}`; };
function stateParams(id) {
  if (id === 'cushing' || id === 'addison' || id === 'hyperaldo' || id === 'hypoaldo') return HM.build(id);
  if (HM.DRUGS[id]) return HM.build('normal', [id]);
  return HM.build('normal');
}
const cv = { state: 'normal', p: HM.build('normal'), custom: false };
function updateClinical() {
  $('#clinical-cap').value = cv.p.cap; $('#clinical-cap-label').textContent = capWords(cv.p.cap);
  $('#clinical-stress').value = cv.p.stress; $('#clinical-stress-label').textContent = stressWords(cv.p.stress);
  const cur = view(cv.p);
  const st = data?.states.find(s => s.id === cv.state);
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  const legend = cv.custom ? 'these settings' : st ? st.label.split(' (')[0] : '';
  $('#clinical-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend });
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}` : 'No direction shown for this state; see the note under the selector') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const k = v.modelKey, rel = cur[k], where = farPlace(k, rel);
    const reading = row.querySelector('.reading');
    reading.textContent = `${PLACE_ARROW[where]} ${modelNumber(k, rel)} ${v.unit}`;
    reading.dataset.rel = rel.toFixed(4);
    const x = barX(k, rel), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${where} typical range${where.startsWith('far') ? ', off the end of the bar' : ''}${isHeld(cur, k) ? '; held where it was, as no direction is cited' : ''}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const rx = barX(k, NV[k]);
      cmp.textContent = `Dashed line: model, normal (${place(k, NV[k])} typical range)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
for (const k of ['cap', 'stress']) {
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
    $('#cv-live').textContent = `Illustrative model: ${BLOODK.map(k => `${k} ${modelNumber(k, m[k])}, ${levelWords(k, m[k], 'typical range')}`).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), stress: 1, cap: 1, tumor: 0, stop: 'sudden' };
const DRUG_ORDER = ['glucocorticoid', 'mineralocorticoid', 'inhibitor'];
function exploreParams() {
  let p = { ...HM.NORMAL, stress: ex.stress, cap: ex.cap, tumor: ex.tumor };
  for (const d of DRUG_ORDER) if (ex.drugs.has(d)) p = HM.DRUGS[d](p);
  return p;
}
const STOP = { sudden: HM.stopping('sudden'), taper: HM.stopping('taper') };
const LOW_ZONE = 0.75;   // illustrative "too little steroid signal" line in the stopping chart
const minAfter = run => Math.min(...run.series.filter(s => s.t >= run.on).map(s => s.E));
function stopChart(mode) {
  const run = STOP[mode], other = STOP[mode === 'sudden' ? 'taper' : 'sudden'], n = run.series.length;
  const L = 44, R = 466, T = 16, B = 236, yMax = 2.8;
  const X = t => L + t / (n - 1) * (R - L), Y = e => B - clamp(e / yMax, 0, 1) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${RULE}"/>`;
  b += `<rect data-low-zone x="${L}" y="${f(Y(LOW_ZONE))}" width="${R - L}" height="${f(B - Y(LOW_ZONE))}" fill="${BLOOD}"/>`;
  b += text(R - 6, B - 8, 'too little steroid signal', 'xs b red', 'end');
  b += `<rect x="${L}" y="${T}" width="${f(X(run.on) - L)}" height="${B - T}" fill="${BANDF}" opacity=".7"/>` + text(f((L + X(run.on)) / 2), T + 16, 'drug taken', 'xs b blue');
  if (mode === 'taper') b += `<rect x="${f(X(run.on))}" y="${T}" width="${f(X(run.on + run.taperLen) - X(run.on))}" height="${B - T}" fill="${BANDF}" opacity=".35"/>` + text(f((X(run.on) + X(run.on + run.taperLen)) / 2), T + 16, 'tapering', 'xs b blue');
  b += `<path d="M${L} ${f(Y(1))} H${R}" stroke="${INK}" stroke-width="1.4" stroke-dasharray="6 5" opacity=".6"/>` + text(L + 6, Y(1) - 6, 'normal', 'xs muted', 'start');
  const line = (s, key) => s.series.map((d, i) => `${i ? 'L' : 'M'}${f(X(d.t))} ${f(Y(d[key]))}`).join(' ');
  b += `<path d="${line(other, 'E')}" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".7"/>`;
  b += `<path data-own-line d="${line(run, 'own')}" fill="none" stroke="${BLUE}" stroke-width="2.2"/>`;
  b += `<path data-total-line d="${line(run, 'E')}" fill="none" stroke="${AMBER}" stroke-width="3.2"/>`;
  b += text(L - 8, T + 12, 'more', 'xs muted', 'end') + text(L - 8, B, 'less', 'xs muted', 'end');
  b += text(R, B + 20, 'time →', 'xs b', 'end') + text(L, B + 20, 'steroid signal ↑', 'xs b', 'start');
  const k = keyRow([[`<path d="M0 0 H34" stroke="${AMBER}" stroke-width="3.2"/>`, 'total: drug + own cortisol'], [`<path d="M0 0 H34" stroke="${BLUE}" stroke-width="2.2"/>`, 'own cortisol'], [`<path d="M0 0 H34" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="3 4"/>`, mode === 'sudden' ? 'if tapered' : 'if stopped suddenly']], 266);
  return { body: `<g data-stop="${mode}" data-min-sudden="${minAfter(STOP.sudden).toFixed(3)}" data-min-taper="${minAfter(STOP.taper).toFixed(3)}">${b}</g>` + k.body, h: 280 + 24 * (k.rows - 1) };
}
function updateStop() {
  const mode = ex.stop, dips = minAfter(STOP[mode]) < LOW_ZONE;
  const c = stopChart(mode);
  $('#stop-chart').innerHTML = svg(`Illustrative chart of the steroid signal over time, with no numbers. A shaded stretch at the start is the drug being taken: the total signal sits high while the body’s own cortisol line lies near the floor. ${mode === 'sudden' ? 'When the drug stops all at once, the total drops straight into the shaded too-little zone and climbs back only slowly as the axis recovers.' : 'While the drug is tapered, the body’s own cortisol line climbs as the drug line falls, and the total stays above the shaded too-little zone.'}`, c.body, c.h);
  $('#stop-results').textContent = mode === 'sudden'
    ? `Stopped suddenly (illustrative model): the drug had held ACTH low, so the cortex lost working capacity; ${dips ? 'the total steroid signal falls into the too-little zone' : 'the total steroid signal dips'} until the axis recovers.`
    : `Tapered (illustrative model): as the drug falls slowly, ACTH returns and the cortex recovers while some drug remains; ${dips ? 'the total still dips into the too-little zone' : 'the total stays out of the too-little zone'}.`;
}
function updateExplore() {
  for (const [id, words] of [['stress', stressWords], ['cap', capWords], ['tumor', tumorWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  const p = exploreParams(), cur = view(p);
  const names = { glucocorticoid: 'a glucocorticoid drug', mineralocorticoid: 'a mineralocorticoid drug', inhibitor: 'a synthesis inhibitor' };
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => names[d]);
  const who = `${{ normal: 'a normal body', cushing: 'Cushing’s disease', addison: 'Addison’s disease' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for normal. ${bandWords(cur)} Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend: 'your settings' }) + readout(cur, NV, 'Compared with normal');
  const sig = SIGNALS.map(k => `${LABEL[k]} ${SIGNAL_WORD[place(k, cur[k])]}`).join(' · ');
  const blood = BLOODK.map(k => `${LABEL[k]} ${levelWords(k, cur[k])}${isHeld(cur, k) ? ' (held where it was: no cited direction)' : ''}`).join(' · ');
  const [infW] = more(cur.inflam, NV.inflam, 'fiercer than normal', 'calmer than normal');
  const res = $('#model-results');
  res.textContent = `Illustrative model output for ${who}: ${sig} · ${blood} · inflammation ${infW === 'about the same' ? 'about normal' : infW}.`;
  Object.assign(res.dataset, { crh: cur.crh.toFixed(4), acth: cur.acth.toFixed(4), cortisol: cur.cortisol.toFixed(4), glucose: cur.glucose.toFixed(4), sodium: cur.sodium.toFixed(4), potassium: cur.potassium.toFixed(4) });
  updateStop();
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = HM.build(r.value); ex.cap = d.cap; ex.tumor = d.tumor; ex.stress = d.stress; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['stress', 'cap', 'tumor']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$$('#stop-mode input').forEach(r => r.addEventListener('change', () => { ex.stop = r.value; updateStop(); }));
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', stress: 1, cap: 1, tumor: 0 }); ex.drugs.clear();
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
    const ok = BLOODK.every(id => { const v = byId(id); return v && hasRange(v) && v.low > 0; });
    if (!ok) throw new Error('Invalid reference data');
    data = loaded;
    // Each band is drawn relative to the model's normal, which sits at the middle of the quoted range.
    // Nothing else is converted into lab units.
    const mid = {};
    BANDS = {};
    for (const id of BLOODK) {
      const v = byId(id); mid[id] = (v.low + v.high) / 2; BANDS[id] = [v.low / mid[id], v.high / mid[id]];
      MID[id] = mid[id]; DEC[id] = (String(v.low).split('.')[1] || '').length;
    }
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model works in levels relative to normal and puts its normal in the middle of each band; the large number in each row is that model level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. For a disease or drug the sources give only a direction; how far the model moves is an illustrative choice.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v.modelKey, n / mid[v.modelKey]), range = hasRange(v);
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
