'use strict';
const GM = window.GlucoseModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The model, viewed at one moment ----------
   view(): one run of the illustrative model (model.js), with the flows at the pictured moment (minutes after the meal). */
const SPAN = 240;
function view(p, t) {
  const r = GM.simulate(p, SPAN), s = t < 0 ? r.fasting : r.at(t);
  return { p: r.p, r, t, s, fasting: r.fasting.G, peak: r.peak.G };
}
const NORMAL_P = GM.build('normal');
const N45 = view(NORMAL_P, 45);   // the normal picture soon after a meal: the yardstick for arrow widths
const REF = { ra: N45.s.ra, liver: 1.2, cells: N45.s.cells, kidney: 0.6, secretion: N45.s.secretion, glucagon: 1, incretin: N45.s.incretin, I: N45.s.I };

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', SUGAR = '#a34700', SUGARF = '#f2a93b', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const BLOOD = '#f6dcd6', BANDF = '#d1d8fd', TISSUE = '#f1e3cf';
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const svg = (label, body, h) => `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${label.replace(/"/g, '&quot;')}">${body}</svg>`;
// A straight arrow with its own head (no markers, so hidden steps never break shared ids).
function arrow(x1, y1, x2, y2, w, color, extra = '') {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="butt" fill="none"/>` +
    `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${color}"/></g>`;
}
// The ghost of an arrow: a dashed outline of its normal width, set just beside the solid one.
function ghostArrow(x1, y1, x2, y2, w, color) {
  if (w <= 0) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .6, w * 1.1 + 7), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".7"/>`;
}
const width = (v, ref, max = 14) => v <= ref * 0.03 ? 0 : clamp(2 + 9 * v / ref, 2, max);
const glucoseDot = (x, y, r = 4.6) => `<circle data-glucose cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${SUGARF}" stroke="${SUGAR}" stroke-width="1.5"/>`;
const insulinDot = (x, y, r = 5.2) => `<path data-insulin d="M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z" fill="${BLUE}"/>`;

// Fixed, shuffled places for the dots inside the blood vessel.
const SLOTS = (() => {
  const s = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 28; c++) s.push([72 + c * 13.6 + (r % 2) * 6.8, 297 + r * 13]);
  let seed = 11;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const glucoseCount = G => clamp(Math.round(G / 9), 1, 52);
const insulinCount = I => clamp(Math.round(I * 2), 0, 30);
const doorsOpen = v => clamp(Math.round(5 * v.p.sens * v.s.I / REF.I), 0, 5);

/* The blood glucose chart at the top of every picture: time across, blood sugar up, no numbers. */
const CH = { l: 62, r: 464, t: 30, b: 132 };
const tx = t => CH.l + (t + 40) / (SPAN + 40) * (CH.r - CH.l);
const gy = g => CH.b - clamp((g - 40) / 280, -0.02, 1.04) * (CH.b - CH.t);
// The healthy band is the reference range from the data file, placed on the same scale as the curve.
// Only if the file fails to load does the picture fall back to an illustrative band.
let REFBAND = null;
const FALLBACK_BAND = [110, 121];   // pixels on the chart, illustrative, used only without the data file
const bandY = () => REFBAND ? [gy(REFBAND[1]), gy(REFBAND[0])] : FALLBACK_BAND;
function curvePath(v, until = SPAN) {
  const pts = [[-40, v.fasting], [0, v.fasting]];
  for (let t = 3; t <= until; t += 3) pts.push([t, v.r.at(t).G]);
  if (until % 3) pts.push([until, v.r.at(until).G]);
  return 'M' + pts.map(([t, g]) => `${f(tx(t))} ${f(gy(g))}`).join(' L');
}
function chart(cur, opt) {
  const { ghost = null, before = null, until = SPAN, now = true } = opt;
  let s = `<rect x="${CH.l}" y="${CH.t - 8}" width="${CH.r - CH.l}" height="${CH.b - CH.t + 8}" fill="#fff" stroke="${RULE}" stroke-width="1.2"/>`;
  const [b0, b1] = bandY();
  s += `<rect data-band x="${CH.l}" y="${f(b0)}" width="${CH.r - CH.l}" height="${f(b1 - b0)}" fill="${BANDF}"/>`;
  s += text(CH.l - 6, (b0 + b1) / 2 - 2, 'healthy', 'xs b blue', 'end') + text(CH.l - 6, (b0 + b1) / 2 + 12, 'band', 'xs b blue', 'end');
  s += text(CH.l - 6, CH.t + 4, '↑ blood', 'xs b', 'end') + text(CH.l - 6, CH.t + 19, 'sugar', 'xs b', 'end');
  s += `<path d="M${f(tx(0))} ${CH.t - 8} V${CH.b}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 3"/>` + text(tx(0), CH.t - 13, 'meal', 'xs b');
  s += text(CH.r, CH.b + 17, 'time after a meal →', 'xs b', 'end');
  if (ghost) s += `<path data-ghost-curve d="${curvePath(ghost)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
  if (before) s += `<path data-before-curve d="${curvePath(before)}" fill="none" stroke="${MUTED}" stroke-width="2.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>`;
  s += `<path data-curve d="${curvePath(cur, until)}" fill="none" stroke="${SUGAR}" stroke-width="3.4" stroke-linejoin="round"/>`;
  if (now) {
    const g = cur.t < 0 ? cur.fasting : cur.r.at(cur.t).G;
    s += `<path d="M${f(tx(cur.t))} ${CH.t - 8} V${CH.b}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="1 3"/><circle data-now cx="${f(tx(cur.t))}" cy="${f(gy(g))}" r="6" fill="${SUGAR}" stroke="#fff" stroke-width="2"/>`;
  }
  return s;
}

/* The body below the chart. `show` lists which parts the step has introduced so far. */
const ALL = ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin', 'doors', 'liver', 'glucagon', 'kidney'];
function organs(v, show, ghost) {
  const p = v.p, s = v.s, has = k => show.includes(k);
  let b = '';
  // Gut
  if (has('gut')) {
    b += text(66, 176, 'gut', 'xs b');
    b += `<rect x="18" y="184" width="96" height="62" rx="22" fill="${TISSUE}" stroke="${INK}" stroke-width="2"/>`;
    b += `<path d="M30 202 C40 190 52 214 62 202 S84 190 100 202 M30 226 C40 214 52 238 62 226 S84 214 100 226" fill="none" stroke="#b07a55" stroke-width="2.4" stroke-linecap="round"/>`;
    const food = Math.round(4 * clamp(s.ra / REF.ra, 0, 1.2));
    for (let i = 0; i < food; i++) b += glucoseDot(36 + i * 16, 214, 4);
  }
  // Pancreas with one islet: beta cells (blue) around an alpha cell (red)
  if (has('pancreas')) {
    b += text(244, 176, 'pancreas', 'xs b');
    b += `<path d="M178 224 C176 202 202 196 232 200 C262 204 286 192 304 198 C318 204 314 224 300 228 C280 234 256 228 236 232 C210 236 180 242 178 224 Z" fill="#f2d7c2" stroke="${INK}" stroke-width="2"/>`;
    b += `<circle cx="244" cy="214" r="17" fill="#fff" stroke="${INK}" stroke-width="1.5"${p.su > 0.01 ? ` data-pushed` : ''}/>`;
    if (p.su > 0.01) b += `<circle cx="244" cy="214" r="22" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="5 3"/>`;
    const lost = p.beta < 0.2, tired = !lost && p.beta < 0.8;
    for (const [dx, dy] of [[-8, -7], [8, -7], [-8, 7], [8, 7]]) {
      b += lost ? `<circle cx="${244 + dx}" cy="${214 + dy}" r="4.6" fill="none" stroke="${BLUE}" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M${241 + dx} ${211 + dy} l6 6 m0 -6 l-6 6" stroke="${INK}" stroke-width="1.3"/>`
        : `<circle cx="${244 + dx}" cy="${214 + dy}" r="4.6" fill="${tired ? '#9fb0ff' : BLUE}"/>`;
    }
    b += `<circle cx="244" cy="214" r="3.6" fill="${RED}"/>`;
    b += `<g data-beta="${p.beta.toFixed(2)}"></g>`;
  }
  // Liver
  if (has('liver')) {
    b += text(414, 176, 'liver', 'xs b');
    b += `<path d="M354 198 C362 184 412 180 450 186 C470 190 472 208 460 222 C442 242 394 250 366 238 C352 230 348 210 354 198 Z" fill="#e6bfae" stroke="${INK}" stroke-width="2"/>`;
  }
  // Muscle and fat cells, with their doors
  if (has('cells')) {
    b += `<rect x="24" y="372" width="144" height="58" rx="24" fill="#f0d3cd" stroke="${INK}" stroke-width="2"/>`;
    b += `<path d="M44 388 H148 M40 401 H152 M44 414 H148" stroke="#c99a92" stroke-width="2" stroke-linecap="round"/>`;
    b += `<circle cx="250" cy="406" r="34" fill="#f6ebc9" stroke="${INK}" stroke-width="2"/><circle cx="256" cy="412" r="19" fill="#efd98f"/>`;
    b += text(96, 450, 'muscle', 'xs b') + text(250, 456, 'fat', 'xs b');
  }
  if (has('doors')) {
    const open = doorsOpen(v), normalOpen = ghost ? doorsOpen(ghost) : 0;
    const spots = [[54, 372], [96, 372], [138, 372], [234, 375], [266, 375]];
    // Open doors are spread across both cells: middle muscle, fat, then the rest.
    const order = [1, 3, 4, 0, 2];
    order.forEach((k, rank) => {
      const [x, y] = spots[k], isOpen = rank < open;
      b += isOpen ? `<g data-door="open"><rect x="${x - 9}" y="${y - 6}" width="5" height="12" fill="${BLUE}"/><rect x="${x + 4}" y="${y - 6}" width="5" height="12" fill="${BLUE}"/></g>`
        : `<g data-door="shut"><rect x="${x - 9}" y="${y - 4}" width="18" height="8" fill="${INK}"/></g>`;
      if (ghost && !isOpen && rank < normalOpen) b += `<rect data-ghost-door x="${x - 12}" y="${y - 10}" width="24" height="20" fill="none" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    });
  }
  // Kidney and urine
  if (has('kidney')) {
    b += `<path d="M370 380 C352 380 346 400 350 416 C354 432 370 440 384 434 C394 430 390 420 388 412 C386 404 396 400 394 390 C392 382 380 380 370 380 Z" fill="#e6c7c0" stroke="${INK}" stroke-width="2"/>`;
    b += text(372, 456, 'kidney', 'xs b');
    b += `<path d="M440 404 C440 396 446 390 452 384 C458 390 464 396 464 404 A12 12 0 0 1 440 404 Z" fill="#f4eaa6" stroke="${INK}" stroke-width="1.6"/>` + text(452, 436, 'urine', 'xs b');
    const lostDots = Math.round(clamp(s.kidney / REF.kidney, 0, 1) * 3);
    for (let i = 0; i < lostDots; i++) b += glucoseDot(446 + (i % 2) * 10, 400 + Math.floor(i / 2) * 8, 3.4);
  }
  return b;
}
function flowsOf(v, show) {
  const s = v.s, p = v.p, has = k => show.includes(k), out = [];
  if (has('gut')) out.push(['gut', 66, 248, 66, 282, width(s.ra, REF.ra), SUGAR]);
  if (has('insulin')) out.push(['insulin', 244, 234, 244, 282, width(s.secretion, REF.secretion), BLUE]);
  if (has('liver')) {
    out.push(['liver', 398, 246, 398, 282, width(s.liver, REF.liver), SUGAR]);
    out.push(['store', 438, 286, 438, 238, width(s.cells * 0.45, REF.cells * 0.45, 11), SUGAR]);
  }
  if (has('cells')) {
    out.push(['muscle', 96, 338, 96, 368, width(s.cells * 0.6 + (has('doors') ? 0 : 0.6), REF.cells * 0.6 + 0.6), SUGAR]);
    out.push(['fat', 250, 338, 250, 368, width(s.cells * 0.4 + (has('doors') ? 0 : 0.4), REF.cells * 0.4 + 0.4, 11), SUGAR]);
  }
  if (has('kidney')) {
    const filtered = s.G / GM.G0;
    out.push(['filtered', 362, 338, 362, 378, width(filtered, 1, 9), SUGAR]);
    const back = Math.max(0, filtered - (p.renal > 0.01 ? 0.75 * p.renal * filtered : 0) - s.kidney);
    out.push(['returned', 392, 380, 392, 340, width(back, 1, 9), SUGAR]);
    out.push(['urine', 400, 412, 436, 406, width(s.kidney, REF.kidney, 9), SUGAR]);
  }
  if (p.inj > 0.01 && has('insulin')) out.push(['injected', 194, 364, 194, 340, width(s.inj, REF.secretion, 11), BLUE]);
  return out;
}
function signals(v, show) {
  const s = v.s, p = v.p, has = k => show.includes(k);
  let b = '';
  if (has('incretin')) {
    const w = clamp(1.2 + 3.2 * incretinSignal(v) / REF.incretin, 1.2, 9);
    b += `<path data-signal="incretin" data-w="${f(w)}" d="M114 206 C138 194 160 198 180 208" fill="none" stroke="${INK}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 3)} 4"/>`;
    b += text(146, 190, 'incretins', 'xs b');
  }
  if (has('glucagon')) {
    const w = clamp(1 + 3 * s.glucagon * (v.t < 0 ? 1 : 0.6) / REF.glucagon, 1, 8);
    b += `<path data-signal="glucagon" data-w="${f(w)}" d="M248 214 C292 206 322 204 356 208" fill="none" stroke="${RED}" stroke-width="${f(w)}" stroke-dasharray="${f(w + 3)} 4"/>`;
    b += text(318, 196, 'glucagon', 'xs b red');
  }
  // Injected insulin comes from outside the body, under the skin, not from the pancreas.
  if (p.inj > 0.01 && has('insulin')) {
    b += `<g data-syringe><rect x="187" y="378" width="14" height="30" fill="#fff" stroke="${BLUE}" stroke-width="2"/><rect x="187" y="378" width="14" height="14" fill="${BLUE}" opacity=".45"/><path d="M194 378 V366 M194 408 V420 M186 420 H202" stroke="${BLUE}" stroke-width="2.4"/></g>`;
    b += text(194, 446, 'injected', 'xs b blue');
  }
  return b;
}
function vessel(v, show) {
  let b = `<rect x="8" y="284" width="464" height="54" rx="27" fill="${BLOOD}" stroke="${RED}" stroke-width="2"/>` + text(16, 316, 'blood', 'xs b red', 'start');
  const ng = glucoseCount(v.s.G), ni = show.includes('insulin') ? insulinCount(v.s.I) : 0;
  SLOTS.slice(0, ng).forEach(([x, y]) => { b += glucoseDot(x, y); });
  SLOTS.slice(ng, ng + ni).forEach(([x, y]) => { b += insulinDot(x, y); });
  return b;
}
// The incretin signal the islet receives: the gut's own incretins plus a GLP-1 receptor agonist acting like one.
const incretinSignal = v => v.s.incretin + 0.9 * v.p.glp1;
function attrs(v) {
  return `data-g="${v.s.G.toFixed(1)}" data-fasting="${v.fasting.toFixed(1)}" data-peak="${v.peak.toFixed(1)}" data-insulin="${v.s.I.toFixed(3)}" data-secretion="${v.s.secretion.toFixed(3)}" data-liver="${v.s.liver.toFixed(3)}" data-cells="${v.s.cells.toFixed(3)}" data-urine="${v.s.kidney.toFixed(3)}" data-incretin="${incretinSignal(v).toFixed(3)}" data-glucagon="${v.s.glucagon.toFixed(3)}" data-open="${doorsOpen(v)}"`;
}
function keyRow(items, y) {
  let x = 10, row = 0, body = '';
  for (const [icon, word] of items) {
    const w = 40 + word.length * 7.6;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    body += `<g transform="translate(${f(x)} ${y + row * 26})">${icon}${text(40, 5, word, 'xs', 'start')}</g>`;
    x += w + 14;
  }
  return { body, rows: row + 1 };
}
const KEY = {
  glucose: [glucoseDot(17, 0), 'glucose'],
  insulin: [insulinDot(17, 0), 'insulin'],
  now: [`<circle cx="17" cy="0" r="6" fill="${SUGAR}" stroke="#fff" stroke-width="2"/>`, 'moment drawn below'],
  normal: [`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`, 'normal']
};
/* One full picture: chart on top, body below, legend at the bottom. */
function picture(cur, opt = {}) {
  const { show = ALL, ghost = null, before = null, legend = '', beforeWord = '', until = SPAN, extra = '', now = true } = opt;
  let b = chart(cur, { ghost, before, until, now });
  b += organs(cur, show, ghost);
  if (ghost) {
    let g = '';
    for (const [k, x1, y1, x2, y2, w, color] of flowsOf(ghost, show)) if (k !== 'injected') g += ghostArrow(x1 + 13, y1, x2 + 13, y2, w, color);
    b += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}>${g}</g>`;
  }
  if (before) b += `<g data-ghost="before" ${attrs(before)}></g>`;
  let flowsSvg = '';
  for (const [k, x1, y1, x2, y2, w, color] of flowsOf(cur, show)) flowsSvg += arrow(x1, y1, x2, y2, w, color, `data-flow="${k}" data-w="${f(w)}"`);
  b += `<g data-new-state="${legend || 'current'}" ${attrs(cur)}>${vessel(cur, show)}${flowsSvg}${signals(cur, show)}</g>`;
  b += extra;
  const items = [KEY.glucose];
  if (show.includes('insulin')) items.push(KEY.insulin);
  if (now) items.push(KEY.now);
  if (ghost) items.push(KEY.normal);
  if (before) items.push([`<path d="M0 0 H34" stroke="${MUTED}" stroke-width="2.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>`, beforeWord]);
  if (legend) items.push([`<path d="M0 0 H34" stroke="${SUGAR}" stroke-width="3.4"/>`, legend]);
  const key = keyRow(items, 484);
  return { body: b + key.body, h: 498 + 26 * (key.rows - 1) };
}
const pictureSvg = (label, cur, opt) => { const { body, h } = picture(cur, opt); return svg(label, body, h); };

/* ---------- Words: comparisons and text alternatives ---------- */
function amount(a, b) {
  if (Math.abs(a) < 0.02 && Math.abs(b) < 0.02) return ['none', 'same'];
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.04 ? ['more', 'up'] : r < 0.96 ? ['less', 'down'] : ['about the same', 'same'];
}
function compare(v, ref) {
  const g = v.s.G / ref.s.G;
  return [
    ['Blood sugar', g > 1.02 ? ['higher', 'up'] : g < 0.98 ? ['lower', 'down'] : ['about the same', 'same']],
    ['Blood sugar before the meal', v.fasting / ref.fasting > 1.02 ? ['higher', 'up'] : v.fasting / ref.fasting < 0.98 ? ['lower', 'down'] : ['about the same', 'same']],
    ['Insulin in the blood', amount(v.s.I, ref.s.I)],
    ['Glucose released by the liver', amount(v.s.liver, ref.s.liver)],
    ['Glucose into muscle and fat', amount(v.s.cells, ref.s.cells)],
    ['Glucose lost in urine', amount(v.s.kidney, ref.s.kidney)]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
function inBand(g) { const [y0, y1] = bandY(), y = gy(g); return y >= y0 - 0.01 && y <= y1 + 0.01; }
const bandWords = v => {
  const g = v.s.G;
  return inBand(g) ? 'The pictured moment sits inside the healthy band.' : `The pictured moment sits ${gy(g) < bandY()[0] ? 'above' : 'below'} the healthy band.`;
};

/* ---------- Core step pictures ---------- */
const STEP_SHOW = {
  fuel: ['blood', 'cells'], meal: ['blood', 'cells', 'gut'], pancreas: ['blood', 'cells', 'gut', 'pancreas', 'insulin'],
  incretin: ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin'], doors: ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin', 'doors'],
  liver: ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin', 'doors', 'liver'], feedback: ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin', 'doors', 'liver'],
  glucagon: ['blood', 'cells', 'gut', 'pancreas', 'insulin', 'incretin', 'doors', 'liver', 'glucagon'], kidney: ALL, diabetes: ALL, whole: ALL
};
function fail(x, y, words) {
  return `<g data-fail><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${RED}" stroke-width="2.5"/><path d="M${x - 5} ${y - 5} l10 10 m0 -10 l-10 10" stroke="${RED}" stroke-width="2.8" stroke-linecap="round"/>${words.map((w, i) => text(x + 18, y - 2 + i * 15, w, 'xs b red', 'start')).join('')}</g>`;
}
const CORE = {
  fuel: () => { const v = view(NORMAL_P, -20); return pictureSvg(`Top: a chart of blood sugar over time, with a shaded healthy band. Before any meal the line runs flat inside the band. Below: a blood vessel carrying glucose dots, with arrows of glucose leaving the blood into a muscle cell and a fat cell. ${bandWords(v)}`, v, { show: STEP_SHOW.fuel, until: 0 }); },
  meal: () => { const v = view(NORMAL_P, 30); return pictureSvg(`The gut, full after a meal, sends a thick arrow of glucose into the blood vessel, which now holds more glucose dots. On the chart the blood sugar line climbs after the meal and rises above the healthy band. ${bandWords(v)}`, v, { show: STEP_SHOW.meal, until: 30 }); },
  pancreas: () => { const v = view(NORMAL_P, 30); return pictureSvg('The pancreas appears above the blood vessel, with one islet drawn large: blue beta cells around it. A blue arrow carries insulin, drawn as blue diamonds, from the islet into the blood, where insulin now travels with the glucose.', v, { show: STEP_SHOW.pancreas, until: 30 }); },
  incretin: () => { const v = view(NORMAL_P, 20); return pictureSvg('A dashed signal labelled incretins runs from the gut to the islet in the pancreas, early, while blood sugar is still rising on the chart. The blue insulin arrow from the islet into the blood is already growing.', v, { show: STEP_SHOW.incretin, until: 20 }); },
  doors: () => { const v = view(NORMAL_P, 45); return pictureSvg(`On the top edge of the muscle cell and the fat cell, blue doorways stand open, ${doorsOpen(v)} of five. Thick glucose arrows pass from the blood through them into the cells.`, v, { show: STEP_SHOW.doors, until: 45 }); },
  liver: () => { const v = view(NORMAL_P, 45); return pictureSvg('The liver appears at the top right. A thick glucose arrow runs from the blood up into the liver, to be stored as glycogen, while the arrow of glucose the liver releases into the blood shrinks to a thin line.', v, { show: STEP_SHOW.liver, until: 45 }); },
  feedback: () => { const v = view(NORMAL_P, 150); return pictureSvg(`Later after the meal. The chart line has risen, peaked and fallen back into the healthy band. Below, the insulin arrow from the pancreas is thin again, few insulin diamonds remain, and fewer doors are open. ${bandWords(v)}`, v, { show: STEP_SHOW.feedback }); },
  glucagon: () => { const v = view(NORMAL_P, -20); return pictureSvg('Before the next meal. A red dashed signal labelled glucagon runs from the islet to the liver, and the liver sends a glucose arrow back into the blood, keeping blood sugar on the flat part of the chart inside the healthy band. The insulin arrow is thin.', v, { show: STEP_SHOW.glucagon }); },
  kidney: () => { const v = view(NORMAL_P, 45); return pictureSvg('The kidney appears at the bottom right. A glucose arrow runs from the blood down into the kidney, and an equal arrow carries it back up into the blood. Nothing reaches the urine drop beside it.', v, { show: STEP_SHOW.kidney }); },
  diabetes: () => {
    const v = view(GM.build('type2'), 45), g = view(NORMAL_P, 45);
    return pictureSvg(`The whole body with two failure points marked with red crosses: at the pancreas, too little insulin; at the muscle and fat cells, cells answer weakly. On the chart the solid diabetes line sits high above the dashed normal line, before and after the meal, above the healthy band. Compared with normal: ${describe(v, g)}.`, v, {
      show: STEP_SHOW.diabetes, ghost: g, legend: 'diabetes',
      extra: fail(186, 250, ['too little', 'insulin']) + fail(178, 358, ['cells answer', 'weakly'])
    });
  },
  whole: () => {
    const v = view(NORMAL_P, 45);
    return pictureSvg('The whole loop after a meal: the gut sends glucose into the blood, incretins and rising sugar make the islet release insulin, insulin opens doors on muscle and fat cells and sends glucose into the liver for storage, glucagon waits for lower sugar, and the kidney hands filtered glucose back. A box on the chart marks blood sugar as the key measure, and a bracket marks the flat line before the meal as fasting blood sugar.', v, {
      show: ALL,
      extra: `<rect x="${CH.l - 2}" y="${CH.t - 10}" width="${CH.r - CH.l + 4}" height="${CH.b - CH.t + 12}" fill="none" stroke="${BLUE}" stroke-width="3"/>` + text(CH.r - 6, CH.t + 8, 'key measure: blood sugar', 'xs b blue', 'end') +
        `<path d="M${f(tx(-38))} ${f(gy(N45.fasting) + 9)} V${f(gy(N45.fasting) + 15)} H${f(tx(-2))} V${f(gy(N45.fasting) + 9)}" fill="none" stroke="${INK}" stroke-width="1.6"/>` + text(tx(-20), CH.b - 4, 'fasting', 'xs b')
    });
  }
};

/* ---------- What changes it ---------- */
// Each change morphs the model's settings from where it starts to where it ends; sizes are illustrative.
const CHANGES = {
  type1: { from: 'normal', to: () => GM.build('type1'), legend: 'type 1 diabetes', against: null },
  type2: { from: 'normal', to: () => GM.build('type2'), legend: 'type 2 diabetes', against: null },
  insulin: { from: 'type1', to: () => GM.build('type1', ['insulin']), legend: 'with insulin injections', against: 'type 1 diabetes, untreated' },
  metformin: { from: 'type2', to: () => GM.build('type2', ['metformin']), legend: 'with metformin', against: 'type 2 diabetes, untreated' },
  sulfonylurea: { from: 'type2', to: () => GM.build('type2', ['sulfonylurea']), legend: 'with a sulfonylurea', against: 'type 2 diabetes, untreated' },
  sglt2: { from: 'type2', to: () => GM.build('type2', ['sglt2']), legend: 'with an SGLT2 inhibitor', against: 'type 2 diabetes, untreated' },
  glp1: { from: 'type2', to: () => GM.build('type2', ['glp1']), legend: 'with a GLP-1 receptor agonist', against: 'type 2 diabetes, untreated' },
  dpp4: { from: 'type2', to: () => GM.build('type2', ['dpp4']), legend: 'with a DPP-4 inhibitor', against: 'type 2 diabetes, untreated' }
};
const CHANGE_WHERE = {
  type1: 'The beta cells in the islet fade to crossed-out outlines and the insulin arrow all but disappears. Doors on muscle and fat close, the liver arrow into the blood thickens, glucose piles up in the blood and spills into the urine. On the chart the line lifts high above the band, even before the meal.',
  type2: 'The beta cells pale as they tire, yet the insulin arrow grows and more insulin diamonds fill the blood. Even so, most doors on muscle and fat stay shut, glucose piles up, and the chart line sits above the band before the meal and climbs much higher after it.',
  insulin: 'A syringe outside the body sends insulin into the blood; the beta cells stay destroyed. Doors on muscle and fat reopen, the liver arrow thins, the urine empties of glucose and the chart line falls back toward the dashed normal line.',
  metformin: 'The arrow of glucose the liver releases thins, the gut arrow thins a little, and a door or so reopens. The chart line comes down, most clearly before the meal.',
  sulfonylurea: 'A dashed ring appears around the islet as the drug pushes the remaining beta cells: the insulin arrow thickens and more insulin fills the blood. The chart line comes down before and after the meal.',
  sglt2: 'At the kidney, the arrow carrying glucose back into the blood thins and the arrow into the urine thickens, with glucose dots in the urine drop. The chart line comes down without any extra insulin.',
  glp1: 'The incretin signal from gut to islet thickens and the insulin arrow grows, the red glucagon signal thins, and the gut arrow thins as the stomach empties more slowly. The chart line rises later and less.',
  dpp4: 'The incretin signal from gut to islet thickens as the body’s own incretins last longer, and the insulin arrow grows a little. The chart line comes down a little.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const fromParams = kind => GM.build(CHANGES[kind].from);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const p0 = fromParams(kind), p1 = c.to(), cur = view(GM.mix(p0, p1, ease(t)), 45);
  const ghost = N45, before = c.against ? view(p0, 45) : null, ref = before || ghost;
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over a faint dashed outline of normal${before ? ` and a dotted line for ${c.against}` : ''}. ${CHANGE_WHERE[kind]} ${bandWords(cur)} Compared with ${before ? c.against : 'normal'}: ${describe(cur, ref)}.`;
  const pic = pictureSvg(label, cur, { show: ALL, ghost, before, legend: c.legend, beforeWord: c.against || '' });
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
const timeWords = m => m === 0 ? 'at the meal' : m < 60 ? `${m} minutes after` : `${Math.floor(m / 60)} hour${m >= 120 ? 's' : ''}${m % 60 ? ` ${m % 60} minutes` : ''} after`;
const betaWords = v => v < 0.08 ? 'almost none' : v < 0.45 ? 'much less than normal' : v < 0.9 ? 'less than normal' : v <= 1.1 ? 'normal' : 'more than normal';
const sensWords = v => v < 0.35 ? 'very weakly' : v < 0.9 ? 'weakly' : v <= 1.1 ? 'normally' : 'more strongly than normal';
const mealWords = v => v < 0.05 ? 'no meal' : v < 0.7 ? 'small' : v <= 1.3 ? 'ordinary' : 'large';
const mgdl = g => `${Math.round(g)} mg/dL`;

/* ---------- Clinical values ---------- */
let data = null;
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const domain = v => { const [lo, hi] = v.scale; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, shown) {
  if (hasRange(v)) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
// How each cited state is applied to the model, and what its directions are compared with.
const BASE_OF = { insulin: 'type1', metformin: 'type2', sulfonylurea: 'type2', sglt2: 'type2', glp1: 'type2', dpp4: 'type2' };
function stateParams(id) {
  if (id === 'type1' || id === 'type2') return GM.build(id);
  if (BASE_OF[id]) return GM.build(BASE_OF[id], [id]);
  return GM.build('normal');
}
function againstParams(id) {
  if (BASE_OF[id]) return GM.build(BASE_OF[id]);
  return GM.build('normal');
}
const cv = { state: 'normal', p: GM.build('normal'), time: 180, custom: false };
function cvValues(v) { return { glucoseAt: v.s.G, fasting: v.fasting }; }
function updateClinical() {
  $('#clinical-time').value = cv.time; $('#clinical-time-label').textContent = timeWords(cv.time);
  $('#clinical-beta').value = cv.p.beta; $('#clinical-beta-label').textContent = betaWords(cv.p.beta);
  $('#clinical-sens').value = cv.p.sens; $('#clinical-sens-label').textContent = sensWords(cv.p.sens);
  const cur = view(cv.p, cv.time), ghost = view(NORMAL_P, cv.time);
  const st = data?.states.find(s => s.id === cv.state);
  const meal = cv.state === 'meal';
  const before = st && cv.state !== 'normal' && !meal && BASE_OF[cv.state] ? view(againstParams(cv.state), cv.time) : null;
  const label = `Illustrative model ${timeWords(cv.time)} the meal${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over a faint dashed outline of normal. ${bandWords(cur)} Compared with normal: ${describe(cur, ghost)}.`;
  $('#clinical-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost, before, legend: st ? (cv.custom ? 'these settings' : st.label.toLowerCase()) : (cv.custom ? 'these settings' : ''), beforeWord: before ? `${BASE_OF[cv.state] === 'type1' ? 'type 1' : 'type 2'} diabetes, untreated` : '' });
  if (!data) return;
  const m = cvValues(cur);
  const ref = meal ? { glucoseAt: view(cv.p, 0).fasting, fasting: cur.fasting } : st && cv.state !== 'normal' ? cvValues(view(againstParams(cv.state), cv.time)) : null;
  const refWord = meal ? 'before the meal' : st && BASE_OF[cv.state] ? `untreated ${BASE_OF[cv.state] === 'type1' ? 'type 1' : 'type 2'} diabetes` : 'normal';
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    const note = d && st.shiftNotes?.[v.id] ? `: ${st.shiftNotes[v.id]}` : '';
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}${note}` : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = Math.round(val);
    row.querySelector('.reading').textContent = mgdl(val);
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (ref && !cv.custom) {
      const rv = ref[v.modelKey], rx = domain(v)(rv);
      cmp.textContent = `Model, ${refWord}: ${mgdl(rv)} (dashed line)`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id);
  if (id === 'meal') cv.time = 45;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this${BASE_OF[id] ? `, applied to untreated ${BASE_OF[id] === 'type1' ? 'type 1' : 'type 2'} diabetes` : ''}.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => { cv.time = 180; setState('normal'); });
$('#clinical-time').addEventListener('input', e => { cv.time = Number(e.target.value); updateClinical(); announce(); });
for (const k of ['beta', 'sens']) {
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
    const cur = view(cv.p, cv.time);
    $('#cv-live').textContent = `Model: blood glucose ${timeWords(cv.time)} the meal ${mgdl(cur.s.G)}, fasting ${mgdl(cur.fasting)}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { preset: 'normal', drugs: new Set(), beta: 1, sens: 1, meal: 1, time: 45 };
function exploreParams() {
  let p = { ...GM.NORMAL, beta: ex.beta, sens: ex.sens, meal: ex.meal };
  for (const d of ['insulin', 'metformin', 'sulfonylurea', 'sglt2', 'glp1', 'dpp4']) if (ex.drugs.has(d)) p = GM.DRUGS[d](p);
  return p;
}
function bigChart(cur, ghost) {
  const L = 64, R = 462, T = 18, B = 250, X = t => L + t / SPAN * (R - L), Y = g => B - clamp((g - 40) / 300, -0.02, 1.03) * (B - T);
  let b = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${RULE}"/>`;
  if (REFBAND) b += `<rect data-ref-band x="${L}" y="${f(Y(REFBAND[1]))}" width="${R - L}" height="${f(Y(REFBAND[0]) - Y(REFBAND[1]))}" fill="${BANDF}"/>` + text(L + 8, Y(REFBAND[0]) - 6, `reference ${REFBAND[0]}–${REFBAND[1]} mg/dL`, 'xs b blue', 'start');
  for (let g = 50; g <= 340; g += 50) b += `<path d="M${L - 5} ${f(Y(g))} H${L}" stroke="${INK}"/>` + text(L - 9, Y(g) + 5, String(g), 'xs', 'end');
  for (let h = 0; h <= 4; h++) b += `<path d="M${f(X(h * 60))} ${B} V${B + 5}" stroke="${INK}"/>` + text(X(h * 60), B + 21, `${h} h`, 'xs');
  const path = v => 'M' + v.r.series.filter((_, i) => i % 3 === 0 || i === SPAN).map(s => `${f(X(s.t))} ${f(Y(s.G))}`).join(' L');
  b += `<path d="${path(ghost)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-explore-curve d="${path(cur)}" fill="none" stroke="${SUGAR}" stroke-width="3.4"/>`;
  b += `<path d="M${f(X(ex.time))} ${T} V${B}" stroke="${MUTED}" stroke-dasharray="2 3"/><circle cx="${f(X(ex.time))}" cy="${f(Y(cur.s.G))}" r="6" fill="${SUGAR}" stroke="#fff" stroke-width="2"/>`;
  b += text(14, 12, 'blood glucose (mg/dL) ↑', 'xs b', 'start') + text(R, B + 42, 'hours after the meal →', 'xs b', 'end');
  return b;
}
function updateExplore() {
  for (const [id, words] of [['beta', betaWords], ['sens', sensWords], ['meal', mealWords]]) { $('#' + id).value = ex[id]; $(`#${id}-label`).textContent = words(ex[id]); }
  $('#time').value = ex.time; $('#time-label').textContent = timeWords(ex.time);
  const p = exploreParams(), cur = view(p, ex.time), ghost = view({ ...NORMAL_P, meal: ex.meal }, ex.time);
  const drugs = [...ex.drugs].map(d => ({ insulin: 'insulin', metformin: 'metformin', sulfonylurea: 'a sulfonylurea', sglt2: 'an SGLT2 inhibitor', glp1: 'a GLP-1 receptor agonist', dpp4: 'a DPP-4 inhibitor' })[d]);
  const who = `${{ normal: 'a normal body', type1: 'type 1 diabetes', type2: 'type 2 diabetes' }[ex.preset]}${drugs.length ? ` with ${drugs.join(', ')}` : ''}`;
  const label = `Illustrative model of ${who}, ${timeWords(ex.time)} the meal, drawn over a faint dashed outline of normal. ${bandWords(cur)} Compared with normal: ${describe(cur, ghost)}.`;
  $('#explore-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost, legend: 'your settings' }) + readout(cur, ghost, 'Compared with normal');
  const lowest = Math.min(cur.fasting, ...cur.r.series.map(s => s.G));
  const urine = cur.r.series.reduce((a, s) => a + s.kidney, 0);
  const pt = cur.r.peak.t, when = pt === 0 ? 'at the meal' : `${timeWords(pt)} the meal`;
  $('#model-results').textContent = `Illustrative model output for ${who}: fasting ${mgdl(cur.fasting)} · peak ${mgdl(cur.peak)} ${when} · ${timeWords(ex.time)}${ex.time ? ' the meal' : ''}: ${mgdl(cur.s.G)} · lowest ${mgdl(lowest)} · glucose lost in urine over four hours: ${urine < 0.5 ? 'none' : `${Math.round(urine)} mg/dL worth`}.`;
  $('#explore-chart').innerHTML = svg(`Illustrative chart of blood glucose over four hours after the meal, in mg/dL. Dashed: normal, fasting ${mgdl(ghost.fasting)}, peak ${mgdl(ghost.peak)}. Solid: ${who}, fasting ${mgdl(cur.fasting)}, peak ${mgdl(cur.peak)}.${REFBAND ? ` The shaded band is the quoted reference range, ${REFBAND[0]} to ${REFBAND[1]} mg/dL.` : ''}`, bigChart(cur, ghost), 300);
}
$$('#preset input').forEach(r => r.addEventListener('change', () => {
  ex.preset = r.value; const d = GM.build(r.value); ex.beta = d.beta; ex.sens = d.sens; updateExplore();
}));
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
for (const id of ['beta', 'sens', 'meal', 'time']) $('#' + id).addEventListener('input', e => { ex[id] = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  Object.assign(ex, { preset: 'normal', beta: 1, sens: 1, meal: 1, time: 45 }); ex.drugs.clear();
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
    const g = loaded.values?.find(v => v.id === 'glucose');
    if (!g || !Number.isFinite(g.low) || !Number.isFinite(g.high) || !loaded.values.every(v => Array.isArray(v.scale))) throw new Error('Invalid reference data');
    data = loaded;
    REFBAND = [g.low, g.high];
    $('#disclaimer').textContent = data.disclaimer;
    const base = view(NORMAL_P, cv.time);
    $('#baseline-note').textContent = `How the numbers are made: the teaching model settles overnight to a fasting level of ${mgdl(base.fasting)}, inside both quoted ranges, then eats one ordinary meal. Its blood glucose rises above the band for a while after eating, peaking near ${mgdl(base.peak)}, as the Figure 17.19 caption describes, and is back inside the band by ${timeWords(cv.time)}. The sizes of the disease and drug effects are illustrative; only their directions are meant to teach.`;
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = hasRange(v), typical = Number.isFinite(v.typical) && !range;
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = typical ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}</svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range as a shaded band${v.modelKey ? ', a solid marker for the current illustrative model and, when a state is compared, a dashed marker for what it is compared with' : ''}`);
      const [lo, hi] = v.scale;
      right.querySelector('.key').textContent = `${range ? `Source range ${v.low} to ${v.high} ${v.unit} (shaded)` : `Source typical value ${v.typical} ${v.unit} (tick; no range given)`} · bar runs ${lo} to ${hi} ${v.unit} · blue line: model`;
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
    data = null;
    REFBAND = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  startLesson();
  updateClinical();
  updateExplore();
}
load();
