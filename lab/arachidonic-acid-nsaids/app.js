// Lesson 18: Inflammation and the arachidonic acid pathway. The kit (/lab/kit/kit.js) runs the page; this file is
// the pictures, and the Clinical values and Explore freely tabs. The teaching model is model.js (window.AAModel),
// a classic script loaded before this module.
//
// Expected behaviour of the pictures:
//   - The pathway is drawn as rows: the membrane and its scissors along the top, arachidonic acid running down a
//     trunk on the left into three enzymes, and one row per signal: COX-1 to the stomach shield, COX-1 to platelet
//     clumping, COX-2 to pain, swelling and fever, lipoxygenase to the airway squeeze. Each row ends in a meter.
//   - The pathway moves: arachidonic acid flows down the trunk and each signal flows along its row, faster where
//     more is made, so a blocked enzyme visibly starves its rows.
//   - A "What changes it" step starts on the untreated injury (t = 0), morphs to the drug's state over dashed
//     outlines of normal, names what moved in each row, then keeps flowing in the new state.
import { lesson } from '/lab/kit/kit.js';
import { C, svg, text, line, circle, rect, path, arrowTo, part, f, clamp, lerp, ease as EASE, span, esc } from '/lab/kit/draw.js';

const AM = window.AAModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ease = EASE.out, inOut = EASE.inOut;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const frac = x => x - Math.floor(x);

const NORMAL_P = AM.build('normal');
const NV = AM.settle(NORMAL_P);

/* ---------- Drawing ---------- */
const HEADC = '#efb562', CELL = '#f5e7cf', MEMB = '#f6ead6', CELLEDGE = '#c98a3a', GLOW = '#f4d6d1';
const hexPts = (x, y, r) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join(' L');
const bolt = (x, y, s = 1) => `<path data-injury transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M10 0 L-6 30 L6 30 L-10 62 L20 22 L6 22 L18 0 Z" fill="${C.red}"/>`;
const chain = (x, y, w = 4) => `<path d="M${f(x - 14)} ${f(y)} l4.7 -5 l4.7 5 l4.7 -5 l4.7 5 l4.7 -5 l4.7 5" fill="none" stroke="${C.amber}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const steroidIcon = (x, y) => `<g data-steroid><path d="M${hexPts(x, y, 9)} Z" fill="#fff" stroke="${C.green}" stroke-width="2.6"/><path d="M${hexPts(x + 15.6, y, 9)} Z" fill="#fff" stroke="${C.green}" stroke-width="2.6"/></g>`;
const plug = (x, y, col, extra = '') => rect(x, y, 18, 28, col, '#fff', 1.4, `rx="4" ${extra}`);
const tag = (x, y) => `<path data-tag d="M${f(x)} ${f(y)} h17 l8 8 l-8 8 h-17 Z" fill="${C.red}" stroke="#fff" stroke-width="1.4"/>`;
function scissors(x, y, open = 1, op = 1) {
  const a = 0.35 + 0.25 * open;
  return `<g data-scissors ${fade(op)}>${path(`M${f(x - 10 * Math.sin(a))} ${f(y + 6)} L${f(x + 22 * Math.sin(a))} ${f(y - 22)} M${f(x + 10 * Math.sin(a))} ${f(y + 6)} L${f(x - 22 * Math.sin(a))} ${f(y - 22)}`, C.ink, 3.2)}${circle(x - 9, y + 12, 6, 'none', C.ink, 2.6)}${circle(x + 9, y + 12, 6, 'none', C.ink, 2.6)}</g>`;
}
// A flow arrow whose width follows the model, with its own head (a marker head would grow with the stroke).
function flow(x1, y1, x2, y2, w, col, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.1 + 8), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${col}" stroke-width="${f(w)}" fill="none"/>`
    + `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${col}"/></g>`;
}
function flowGhost(x1, y1, x2, y2, w, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .5, w * 1.1 + 8), hw = w * 1.1 + 5, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path ${extra} d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
}
const flowWidth = v => v <= 0.03 ? 0 : clamp(2 + 5.5 * v, 2, 13);

/* ---------- The pathway: membrane on top, a trunk of arachidonic acid, one row per signal ---------- */
const LIPID_X = [...Array(19)].map((_, i) => 14 + i * 24);
function membrane(snipped = 0) {
  let s = rect(0, 4, 480, 56, MEMB);
  LIPID_X.forEach((x, i) => {
    const gone = i >= 1 && i <= snipped;   // the inner phospholipids nearest the scissors lose a tail first
    s += path(`M${x - 2.5} 20 V30 M${x + 2.5} 20 V30`, C.ink, 1.6) + circle(x, 13, 6.5, HEADC, C.ink, 1.2);
    s += path(`M${x - 2.5} 44 V34${gone ? '' : ` M${x + 2.5} 44 V34`}`, C.ink, 1.6) + circle(x, 51, 6.5, HEADC, C.ink, 1.2);
  });
  return part('membrane', s);
}
// Rows: the middle of each, top to bottom.
const ROW = { shield: 160, clot: 216, inflam: 272, airway: 328 };
const ROW_ORDER = ['shield', 'clot', 'inflam', 'airway'];
const ROW_COL = { shield: C.green, clot: C.red, inflam: C.amber, airway: C.blue };
const ROW_TONE = { shield: 'green', clot: 'red', inflam: 'amber', airway: 'blue' };
const PRODUCT = { shield: 'prostaglandins', clot: 'thromboxane', inflam: 'prostaglandins', airway: 'leukotrienes' };
const EFFECT = { shield: ['stomach shield'], clot: ['platelet clumping'], inflam: ['pain, swelling', 'and fever'], airway: ['airway squeeze'] };
const PRODUCT_PART = { shield: 'pgA', clot: 'tx', inflam: 'pgC', airway: 'lt' };
const EFFECT_PART = { shield: 'shield', clot: 'clot', inflam: 'inflam', airway: 'airway' };
const BOX_X = 34, BOX_W = 114, ARROW_X0 = 152, ARROW_X1 = 284, EFFECT_X = 292, METER_X = 446;
// How strongly each row flows, and how full its meter is (1 = the untreated injury, this lesson's normal).
const rowFlow = (v, k) => k === 'shield' ? v.shield : k === 'clot' ? v.clot : k === 'inflam' ? v.via2 : v.lt;
const rowLevel = (v, k) => v[k];
const meterFrac = x => clamp(0.5 * x, 0.02, 1);
function enzymes(v, o) {
  let s = '';
  const p = v.p;
  if (o.cox === 'one') {
    s += part('cox', rect(BOX_X, 140, BOX_W, 152, '#fff', C.ink, 2, 'rx="8"') + text(BOX_X + BOX_W / 2, 214, 'COX', 'sm b') + text(BOX_X + BOX_W / 2, 236, 'cyclo-', 'xs muted') + text(BOX_X + BOX_W / 2, 256, 'oxygenase', 'xs muted'));
  } else if (o.cox) {
    s += part('cox cox1', rect(BOX_X, 140, BOX_W, 96, '#fff', C.ink, 2, 'rx="8" data-enzyme="cox1"') + text(BOX_X + 44, 194, 'COX-1', 'sm b'));
    if (o.rows.includes('inflam')) {
      const w = BOX_W * clamp(0.4 + 0.6 * v.cox2Made, 0.4, 1.3), x = BOX_X;
      if (o.ghost && Math.abs(v.cox2Made - o.ghost.cox2Made) > 0.02) s += rect(x, 252, BOX_W, 40, 'none', C.ink, 1.6, 'rx="8" stroke-dasharray="4 3" data-ghost-enzyme="cox2"');
      s += part('cox cox2', rect(x, 252, w, 40, '#fff', C.ink, 2, `rx="8" data-enzyme="cox2" data-w="${f(w)}"`) + text(x + Math.min(w, BOX_W) / 2 - 8, 279, 'COX-2', 'sm b'));
    }
    // Drugs on the COX enzymes: an NSAID's plug, a COX-2 selective plug, aspirin's tag.
    const a1 = p.nsaid > 0.02, a2 = p.cox2i > 0.02, as = p.aspirin > 0.02;
    if (a1) s += part('plug', plug(BOX_X + BOX_W - 26, 172, C.ink, `data-plug="nsaid" ${fade(clamp(p.nsaid / 0.8, 0.15, 1))}`) + (o.rows.includes('inflam') ? plug(BOX_X + BOX_W - 26, 258, C.ink, `data-plug="nsaid" ${fade(clamp(p.nsaid / 0.8, 0.15, 1))}`) : ''));
    if (a2 && o.rows.includes('inflam')) s += part('plug', plug(BOX_X + BOX_W - 26, 258, C.blue, `data-plug="cox2i" ${fade(clamp(p.cox2i / 0.85, 0.15, 1))}`));
    if (as) s += part('tag', `<g ${fade(clamp(p.aspirin / 0.9, 0.15, 1))}>${tag(BOX_X + BOX_W - 30, 178)}${o.rows.includes('inflam') ? tag(BOX_X + BOX_W - 30, 264) : ''}</g>`);
  }
  if (o.lox) s += part('lox', rect(BOX_X, 308, BOX_W, 40, '#fff', C.ink, 2, 'rx="8"') + text(BOX_X + BOX_W / 2, 334, 'lipoxygenase', 'xs b'));
  if (p.steroid > 0.02 && o.cox && o.rows.includes('inflam')) s += `<g ${fade(clamp(p.steroid / 0.8, 0.15, 1))}>${steroidIcon(BOX_X + BOX_W - 18, 272)}</g>`;
  return s;
}
// Arachidonic acid down the trunk, and each signal along its row, moving with phase.
function trunk(v, o, phase) {
  const w = clamp(2.5 + 4 * v.release, 2.5, 9);
  const bottom = o.lox ? ROW.airway : 272;
  let s = path(`M20 120 V${bottom}`, C.amber, w, 'data-trunk');
  const into = [o.cox === 'one' ? 216 : 188, ...(o.cox && o.cox !== 'one' && o.rows.includes('inflam') ? [272] : []), ...(o.lox ? [ROW.airway] : [])];
  if (o.cox) into.forEach(y => { s += arrowTo(20, y, BOX_X - 2, y, C.amber, 3); });
  else if (o.lox) s += arrowTo(20, ROW.airway, BOX_X - 2, ROW.airway, C.amber, 3);
  if (phase !== null) {
    const n = clamp(Math.round(4 * v.release), 0, 6);
    for (let i = 0; i < n; i++) { const u = frac(phase + i / n), y = lerp(122, bottom - 6, u); s += `<g ${fade(Math.min(1, u / .1, (1 - u) / .15))}>${chain(20, y, 3)}</g>`; }
  }
  return part('aa', s);
}
function rows(v, o, phase) {
  let s = '';
  for (const k of o.rows) {
    const y = ROW[k], col = ROW_COL[k], fl = rowFlow(v, k), ay = y + 6;
    const fromCox = k !== 'airway';
    if (!(fromCox ? o.cox && o.cox !== 'one' : o.lox)) continue;
    let r = '';
    if (o.ghost) { const g = flowWidth(rowFlow(o.ghost, k)); if (Math.abs(g - flowWidth(fl)) > 0.4) r += flowGhost(ARROW_X0, ay, ARROW_X1, ay, g, `data-ghost-flow="${k}"`); }
    r += flow(ARROW_X0, ay, ARROW_X1, ay, flowWidth(fl), col, `data-flow="${k}" data-w="${f(flowWidth(fl))}"`);
    if (phase !== null) {
      const n = clamp(Math.round(3 * fl), 0, 6);
      for (let i = 0; i < n; i++) { const u = frac(phase * 1.5 + i / n), x = lerp(ARROW_X0 + 4, ARROW_X1 - 14, u); r += `<g ${fade(Math.min(1, u / .1, (1 - u) / .15))}>${circle(x, ay, 4.2, '#fff', col, 2.2)}</g>`; }
    }
    s += part(PRODUCT_PART[k], r + text((ARROW_X0 + ARROW_X1) / 2, y - 6, PRODUCT[k], `xs b ${ROW_TONE[k]}`));
    // A leukotriene modifier blocks the airway receptors: a bar across the row's end.
    if (k === 'airway' && v.p.ltm > 0.02) s += part('ltm', rect(ARROW_X1 - 2, ay - 18, 8, 36, C.ink, 'none', 0, `rx="2" data-plug="ltm" ${fade(clamp(v.p.ltm / 0.85, 0.15, 1))}`));
    if (o.effects !== false) s += effect(v, o, k);
  }
  return s;
}
function effect(v, o, k) {
  const y = ROW[k], lines = EFFECT[k], two = lines.length > 1;
  let s = lines.map((w, i) => text(EFFECT_X, (two ? y - 12 : y - 2) + i * 20, w, 'xs b', 'start')).join('');
  const delta = o.deltas?.[k];
  if (delta) s += `<g ${fade(o.a ?? 1)}>${text(EFFECT_X, (two ? y + 28 : y + 19), delta, 'xs b blue', 'start')}</g>`;
  // The meter: fills from the bottom; a dashed line marks normal.
  const top = y - 24, h = 48, level = rowLevel(v, k), fh = h * meterFrac(level);
  let m = rect(METER_X, top, 28, h, '#fff', C.rule, 1.5) + rect(METER_X, top + h - fh, 28, fh, ROW_COL[k], 'none', 0, `data-meter="${k}" data-level="${level.toFixed(4)}"`);
  if (o.ghost) m += path(`M${METER_X - 5} ${f(top + h - h * meterFrac(rowLevel(o.ghost, k)))} H${METER_X + 33}`, C.ink, 2.2, 'stroke-dasharray="4 3" data-ghost-meter');
  s += part(EFFECT_PART[k], m);
  if (o.key && (k === 'shield' || k === 'inflam')) s += rect(EFFECT_X - 6, y - 28, 190, 56, 'none', C.blue, 3, 'data-key-measure');
  return s;
}
function top(v, o) {
  const snipped = o.scissors ? clamp(Math.round(4 * v.release), 0, 6) : 0;
  let s = membrane(snipped);
  if (o.scissors) {
    s += part('scissors', scissors(52, 84, 1, clamp(0.35 + 0.65 * v.release, 0.3, 1)));
    s += text(78, 90, 'phospholipase A2', 'xs b', 'start');
    if (v.p.steroid > 0.02) s += `<g ${fade(clamp(v.p.steroid / 0.8, 0.15, 1))}>${steroidIcon(246, 84)}</g>`;
    const nc = clamp(Math.round(3 * v.release), 0, 3);
    for (let i = 0; i < nc; i++) s += part('aa', chain(22 + i * 30, 112, 3.4));
    s += text(116, 118, 'arachidonic acid', 'xs b amber', 'start');
  }
  return s;
}
function pathway(v, o = {}, phase = 0) {
  const opt = { cox: true, lox: true, rows: ROW_ORDER, scissors: true, ...o };
  let s = top(v, opt) + trunk(v, opt, phase) + enzymes(v, opt) + rows(v, opt, phase);
  if (opt.words) s += `<g ${fade(opt.a ?? 1)}>${opt.words.map((w, i) => text(470, 92 + i * 21, w, `xs b ${opt.tone || 'blue'}`, 'end')).join('')}</g>`;
  if (opt.ghost) s += text(470, 384, 'dashed: the untreated injury', 'xs muted', 'end');
  return s;
}
const H_PATH = 392;

/* ---------- Build the idea: the step pictures ---------- */
// Step 1: a cell, and its membrane magnified: a double layer of phospholipids, one picked out.
function membranePicture() {
  let s = rect(0, 18, 480, 86, MEMB);
  for (let i = 0; i < 16; i++) {
    const x = 15 + i * 30, on = i === 10, c = on ? C.blue : C.ink;
    s += (on ? part('lipid', '') : '') + path(`M${x - 3.5} 40 V58 M${x + 3.5} 40 V58`, c, on ? 2.6 : 1.8) + circle(x, 30, 9, on ? C.blue : HEADC, c, 1.4);
    s += path(`M${x - 3.5} 64 V82 M${x + 3.5} 64 V82`, C.ink, 1.8) + circle(x, 92, 9, HEADC, C.ink, 1.4);
  }
  s += part('lipid', circle(315, 30, 13, 'none', C.blue, 2) + path('M318 44 L336 116', C.blue, 1.5));
  s += text(470, 132, 'one phospholipid:', 'xs b blue', 'end') + text(470, 153, 'a head and two tails', 'xs b blue', 'end');
  s += text(12, 132, 'the membrane, magnified:', 'xs b', 'start') + text(12, 153, 'a double layer', 'xs b', 'start');
  s += path('M196 104 L232 194 M284 104 L248 194', C.muted, 1.4, 'stroke-dasharray="5 4"') + circle(240, 196, 9, 'none', C.muted, 1.6, 'stroke-dasharray="3 3"');
  s += `<ellipse cx="-30" cy="262" rx="60" ry="64" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/><ellipse cx="510" cy="262" rx="60" ry="64" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/>`;
  s += part('membrane', `<ellipse data-cell cx="240" cy="262" rx="160" ry="66" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="7"/>`);
  s += text(240, 270, 'one cell', 'sm b') + path('M96 300 L72 324', C.ink, 1.5) + text(8, 340, 'membrane', 'xs b', 'start');
  return s;
}
// Step 2, moving: an injury, then the four signs of inflammation one by one.
function injuryPicture(t) {
  const k = ease(span(t, .1, .5)), rx = lerp(150, 170, k), ry = lerp(76, 88, k);
  let s = `<ellipse cx="-20" cy="170" rx="56" ry="78" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/><ellipse cx="500" cy="170" rx="56" ry="78" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/>`;
  s += `<ellipse cx="236" cy="170" rx="${f(rx + 22)}" ry="${f(ry + 20)}" fill="${GLOW}" stroke="${C.red}" stroke-width="2.5" stroke-dasharray="6 5" ${fade(k)}/>`;
  s += part('membrane', `<ellipse data-cell cx="236" cy="170" rx="${f(rx)}" ry="${f(ry)}" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="7"/>`);
  s += text(236, 178, 'injured tissue', 'sm b');
  s += `<g ${fade(span(t, .02, .1))}>${bolt(384, 16, 1.1)}${text(374, 40, 'injury', 'xs b red', 'end')}</g>`;
  // The first signals, made from the cell membrane itself.
  for (let i = 0; i < 6; i++) { const a = -2.4 + i * .4, d = 10 + 26 * frac(t * 2 + i / 6); s += `<g ${fade(span(t, .3, .45) * (1 - frac(t * 2 + i / 6)))}>${chain(236 + (rx + d) * Math.cos(a) * .98, 170 + (ry + d) * Math.sin(a), 3)}</g>`; }
  s += `<g ${fade(span(t, .35, .5))}>${text(12, 34, 'first signals: made', 'xs b amber', 'start')}${text(12, 55, 'from the membrane', 'xs b amber', 'start')}</g>`;
  [['red', 64], ['warm', 178], ['swollen', 296], ['painful', 414]].forEach(([w, x], i) => { s += part('signs', `<g ${fade(span(t, .5 + i * .1, .58 + i * .1))}>${text(x, 316, w, 'sm b red')}</g>`); });
  return s;
}
// Step 3, moving: phospholipase A2 snips arachidonic acid out of the membrane, one phospholipid after another.
function scissorsPicture(t) {
  const L = [...Array(16)].map((_, i) => 15 + i * 30);
  const travel = span(t, .18, .92), sx = lerp(440, 90, travel);
  let s = rect(0, 30, 480, 86, MEMB);
  L.forEach(x => {
    const cut = x > sx + 6 && x < 452;
    s += path(`M${x - 3.5} 52 V70 M${x + 3.5} 52 V70`, C.ink, 1.8) + circle(x, 42, 9, HEADC, C.ink, 1.4);
    s += path(`M${x - 3.5} 76 V94${cut ? '' : ` M${x + 3.5} 76 V94`}`, C.ink, 1.8) + circle(x, 104, 9, HEADC, C.ink, 1.4);
  });
  s += part('membrane', path('M0 30 H480 M0 116 H480', C.rule, 1.5));
  s += `<g ${fade(span(t, 0, .08))}>${bolt(436, -2, .9)}${text(426, 22, 'injury switches it on', 'xs b red', 'end')}</g>`;
  s += part('scissors', scissors(sx, 140, 0.5 + 0.5 * Math.sin(t * 40), span(t, .1, .2)));
  s += `<g ${fade(span(t, .12, .22))}>${text(clamp(sx + 26, 110, 300), 156, 'phospholipase A2', 'xs b', 'start')}</g>`;
  // Freed tails fall away below as arachidonic acid.
  L.forEach((x, i) => {
    if (!(x > sx + 6 && x < 452)) return;
    const age = clamp((x - sx) / 120, 0, 1), y = lerp(126, 196 + (i % 3) * 18, age);
    s += part('aa', chain(x + 4, y, 4.2));
  });
  s += `<g ${fade(span(t, .5, .62))}>${text(240, 268, 'arachidonic acid, freed', 'xs b amber')}</g>`;
  return s;
}
// Step 8, moving: what COX-2's prostaglandins do: widen and loosen vessels, wake pain nerves, raise the thermostat.
function effectsPicture(t) {
  const k = ease(span(t, .15, .7));
  let s = text(240, 24, 'COX-2’s prostaglandins at the injury', 'xs b amber');
  for (let i = 0; i < 9; i++) { const u = frac(t * 1.5 + i / 9), x = 40 + (i % 3) * 160 + (i * 17) % 60, y = lerp(40, 92, u); s += `<g ${fade(Math.min(1, u / .1, (1 - u) / .2))}>${circle(x, y, 4.2, '#fff', C.amber, 2.2)}</g>`; }
  // A vessel that widens and leaks.
  const g = lerp(16, 30, k);
  s += part('vessel', rect(10, 150 - g, 140, 2 * g, '#f6dcd6', 'none', 0) + path(`M10 ${f(150 - g)} H150 M10 ${f(150 + g)} H150`, C.red, 3));
  for (let i = 0; i < 3; i++) { const u = frac(t * 1.2 + i / 3); s += `<g ${fade(k * Math.min(1, u / .1, (1 - u) / .2))}>${circle(40 + i * 40, 150 + g + 6 + 26 * u, 5, C.red)}</g>`; }
  s += text(80, 240, 'vessels widen', 'xs b', 'middle') + text(80, 261, 'and leak: red,', 'xs b', 'middle') + text(80, 282, 'warm, swollen', 'xs b', 'middle');
  // A pain nerve ending that fires more easily.
  s += part('nerve', path('M200 200 C210 170 236 160 240 130 M240 130 C236 112 224 104 216 96 M240 130 C246 112 258 104 266 96 M240 130 V100', C.ink, 3));
  for (let i = 0; i < 3; i++) { const x = [216, 240, 266][i], y = [94, 96, 94][i]; s += `<g ${fade(k * (0.4 + 0.6 * Math.abs(Math.sin(t * 9 + i))))}><path d="M${x} ${y - 4} l5 -10 l-2 8 l7 -1 l-5 10 l2 -8 Z" fill="${C.amber}"/></g>`; }
  s += text(240, 240, 'pain nerves', 'xs b', 'middle') + text(240, 261, 'more sensitive:', 'xs b', 'middle') + text(240, 282, 'painful', 'xs b', 'middle');
  // The brain's thermostat, turned up.
  const lvl = lerp(0.35, 0.8, k);
  s += part('fever', rect(388, 104, 24, 96, '#fff', C.ink, 2, 'rx="12"') + circle(400, 206, 16, C.red, C.ink, 2) + rect(394, 104 + 96 * (1 - lvl), 12, 96 * lvl, C.red, 'none', 0));
  s += path('M368 120 H382 M368 152 H382', C.muted, 1.5);
  s += text(400, 240, 'thermostat up:', 'xs b', 'middle') + text(400, 261, 'fever', 'xs b red', 'middle');
  return s;
}

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS = [['release', 'Arachidonic acid freed', 'more', 'less'], ['inflam', 'Pain, swelling and fever', 'more', 'less'], ['shield', 'Stomach shield', 'thicker', 'thinner'], ['clot', 'Platelet clumping', 'more', 'less'], ['lt', 'Leukotrienes made', 'more', 'fewer'], ['airway', 'Airway squeeze', 'stronger', 'weaker']];
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const SIGN = { up: '↑', down: '↓', same: '↔' };
const readoutOf = (v, ref, head = 'Compared with the untreated injury') => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${esc(head)}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${esc(k)}</b> <span class="${d}">${SIGN[d]} ${esc(w)}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- What changes it ---------- */
const CHANGES = {
  nsaid: AM.build('normal', ['nsaid']), cox2i: AM.build('normal', ['cox2i']), aspirin: AM.build('normal', ['aspirin']),
  steroid: AM.build('normal', ['steroid']), ltm: AM.build('normal', ['ltm'])
};
// The row words: how each meter moved, worked out from the model so the words always agree with the picture.
function rowWord(k, v) {
  const r = rowLevel(v, k) / rowLevel(NV, k);
  if (r < 0.35) return k === 'shield' ? '↓ much thinner' : k === 'airway' ? '↓ eases a lot' : '↓ far less';
  if (r < 0.9) return k === 'shield' ? '↓ thinner' : k === 'airway' ? '↓ eases' : '↓ less';
  if (r > 1.1) return '↑ a little more';
  return 'stays';
}
const NAMED = {
  nsaid: ['NSAID: both COX', 'enzymes plugged'],
  cox2i: ['COX-2 selective:', 'only COX-2 plugged'],
  aspirin: ['aspirin tags COX', 'for good'],
  steroid: ['glucocorticoid: scissors', 'slowed, less COX-2 made'],
  ltm: ['leukotrienes blocked', 'at the airways']
};
const CHANGE_WHERE = {
  nsaid: 'Dark plugs sit in both the COX-1 and COX-2 boxes. The rows through them thin inside their dashed normal outlines, and the stomach shield, platelet clumping and pain, swelling and fever meters drop below their dashed normal lines. The leukotriene row and its airway meter rise a little.',
  cox2i: 'A blue plug sits in the COX-2 box only. Its row thins and the pain, swelling and fever meter drops, while COX-1, the stomach shield and platelet clumping stay on their dashed normal lines.',
  aspirin: 'Red tags are stuck onto both COX boxes. COX-1 is almost completely shut, so the platelet clumping and stomach shield meters fall far below their dashed normal lines; COX-2 is partly shut, so pain, swelling and fever fall too.',
  steroid: 'Green steroid rings sit beside the phospholipase A2 scissors, which fade, and on a shrunken COX-2 box inside its dashed normal outline. Less arachidonic acid is freed, so the trunk thins and the pain, swelling and fever and airway squeeze meters drop; the stomach shield thins a little and platelet clumping stays at normal.',
  ltm: 'A dark bar blocks the end of the leukotriene row, where leukotrienes act on the airways. The airway squeeze meter drops far below its dashed normal line, though leukotrienes are still made; the COX rows and their meters stay on their dashed normal lines.'
};
const TITLE = { nsaid: 'NSAIDs', cox2i: 'COX-2 selective inhibitors', aspirin: 'Aspirin', steroid: 'Glucocorticoids', ltm: 'Leukotriene modifiers' };
const HOLD = .08, DONE = .46, LOOP = .5;
function change(kind) {
  const end = AM.settle(CHANGES[kind]);
  const deltas = Object.fromEntries(ROW_ORDER.map(k => [k, rowWord(k, end)]));
  return {
    duration: 6400, loop: true, loopFrom: LOOP,
    render(t) {
      const u = inOut(span(t, HOLD, DONE)), a = span(t, DONE - .1, DONE);
      const v = AM.settle(AM.mix(NORMAL_P, CHANGES[kind], u));
      const phase = t < LOOP ? t / LOOP : (t - LOOP) / (1 - LOOP);
      const s = pathway(v, { ghost: NV, deltas, a, words: NAMED[kind] }, phase);
      const label = `${TITLE[kind]}, drawn over dashed marks for the untreated injury. ${CHANGE_WHERE[kind]} Compared with the untreated injury: ${describe(end, NV)}.`;
      return { svg: svg(label, s, { h: H_PATH }), readout: readoutOf(v, NV) };
    }
  };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const moving = (duration, label, draw, h, loop = false) => ({ duration, loop, render: t => svg(label, draw(t), { h }) });
const flowing = (label, o, h = H_PATH, words) => moving(3200, label, t => pathway(NV, { ...o, words }, t), h, true);
const scenes = {
  membrane: () => svg('At the top, a magnified strip of membrane: two rows of phospholipids, round heads facing outward on each side and pairs of tails tucked into the middle. One phospholipid, a head and two tails, is picked out in blue. Below, dashed lines lead down to one whole oval cell, its outline labelled membrane, with neighbouring cells at the edges.', membranePicture(), { h: 350 }),
  injury: moving(5200, 'A patch of tissue is hit by an injury, drawn as a red lightning bolt. It swells and a red dashed glow spreads round it, and small amber signals made from the cell membrane drift off. Four words appear under it, one by one: red, warm, swollen, painful.', injuryPicture, 330),
  scissors: moving(5200, 'A magnified strip of membrane with an injury bolt at its right end. A pair of scissors, phospholipase A2, travels along the inner row of phospholipids from right to left, snipping one tail from each; the freed tails fall away below as amber zigzag chains: arachidonic acid.', scissorsPicture, 286),
  roads: flowing('The pathway begins. Arachidonic acid, freed from the membrane by phospholipase A2, flows down an amber trunk on the left and splits into two roads: one into a tall box labelled COX, cyclooxygenase, and one into a box labelled lipoxygenase.', { cox: 'one', rows: [], effects: false }, H_PATH, ['one raw material,', 'two roads']),
  cox1: flowing('The COX box is now COX-1. Out of it, a green row of prostaglandins flows to a meter labelled stomach shield, filled to its everyday level. Lipoxygenase waits below.', { rows: ['shield'] }),
  platelets: flowing('A second row leaves COX-1: red thromboxane, made in platelets, flowing to a meter labelled platelet clumping, beside the stomach shield row.', { rows: ['shield', 'clot'] }),
  cox2: { duration: 5200, loop: false, render: t => { const v = AM.settle({ ...NORMAL_P, injury: lerp(0.15, 1, ease(span(t, .1, .8))) }); return svg('A third box, COX-2, appears under COX-1. At first small, because healthy tissue holds little of it, it grows as the injured tissue makes more; its amber row of prostaglandins thickens and the pain, swelling and fever meter fills.', pathway(v, { rows: ['shield', 'clot', 'inflam'], words: t > .5 ? ['injured tissue', 'makes more COX-2'] : null, a: span(t, .5, .7) }, t * 3), { h: H_PATH }); } },
  effects: moving(5200, 'Amber prostaglandin rings from COX-2 drift down onto three things. On the left, a blood vessel widens and leaks red dots: red, warm, swollen. In the middle, a pain nerve ending sparks more easily: painful. On the right, a thermometer rises: the brain’s thermostat turned up, fever.', effectsPicture, 296),
  lox: flowing('On the bottom row, lipoxygenase sends a blue row of leukotrienes to a meter labelled airway squeeze. Four rows now run side by side: stomach shield, platelet clumping, pain, swelling and fever, and airway squeeze.', {}),
  whole: flowing('The whole pathway. Phospholipase A2 frees arachidonic acid from the membrane; it flows down to COX-1, COX-2 and lipoxygenase. COX-1 feeds the stomach shield and platelet clumping rows, COX-2 feeds pain, swelling and fever, and lipoxygenase feeds the airway squeeze. Blue frames mark the two key measures: pain, swelling and fever, and the stomach shield.', { key: true }, H_PATH, ['the two key', 'measures, framed']),
  nsaid: change('nsaid'),
  cox2i: change('cox2i'),
  aspirin: change('aspirin'),
  steroid: change('steroid'),
  ltm: change('ltm')
};

/* ---------- Words for the sliders ---------- */
const injuryWords = v => v < 0.05 ? 'no injury' : v < 0.6 ? 'mild' : v < 0.9 ? 'a little milder' : v <= 1.1 ? 'the lesson’s injury' : v <= 1.6 ? 'worse' : 'severe';
const feverWords = v => v < 0.02 ? 'none' : v < 0.5 ? 'slight' : v < 1 ? 'moderate' : 'strong';

/* ---------- Clinical values ----------
   The sources give only directions for drugs. The model's live value is printed as an illustrative number built on the
   quoted value: temperature is the typical value raised by the prostaglandin signal reaching the brain; glucose is the
   middle of the range times the model's relative level; blood pH stays at the middle of its range, because the model
   has no breathing or kidneys to move it. Always labelled as a teaching-model value. */
let data = null;
const REF = {}, DEC = {};
const VALUE_OF = {
  temperature: v => REF.temperature * (1 + 0.04 * v.feverOut),
  glucose: v => REF.glucose * v.glucose,
  bloodPH: () => REF.bloodPH
};
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', at: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const decimals = n => (String(n).split('.')[1] || '').length;
const rangeText = v => { const d = decimals(v.low); return `${v.low.toFixed(d)}–${v.high.toFixed(d)}`; };
const spanOf = v => hasRange(v) ? [v.low - (v.high - v.low), v.high + (v.high - v.low)] : [v.typical * 0.95, v.typical * 1.05];
const barX = (v, n) => { const [a, b] = spanOf(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const fmt = (v, n) => v.unit === 'pH' ? `pH ${n.toFixed(DEC[v.id])}` : `${n.toFixed(DEC[v.id])} ${v.unit}`;
function placeOf(v, n) {
  if (hasRange(v)) return n > v.high + 1e-9 ? 'above' : n < v.low - 1e-9 ? 'below' : 'inside';
  const tol = Math.pow(10, -DEC[v.id]) / 2;
  return n > v.typical + tol ? 'above' : n < v.typical - tol ? 'below' : 'at';
}
const placeWords = (v, w) => hasRange(v) ? `${w} typical range` : w === 'at' ? 'at the typical value' : `${w} the typical value`;
const phNote = (v, w) => v.unit !== 'pH' || w === 'inside' ? '' : w === 'above' ? ' (less acidic)' : ' (more acidic)';
function stateParams(id) {
  if (AM.STATES[id]) return AM.build(id);
  const drug = { glucocorticoid: 'steroid', aspirin: 'aspirin' }[id];
  return drug ? AM.build('normal', [drug]) : AM.build('normal');
}
const tabPicture = (label, cur) => svg(label, pathway(cur, { ghost: NV, deltas: Object.fromEntries(ROW_ORDER.map(k => [k, rowWord(k, cur)])) }, 0.3), { h: H_PATH });
const cv = { state: 'normal', p: AM.build('normal'), injury: 1, fever: 0, custom: false };
const cvParams = () => ({ ...cv.p, injury: cv.injury, fever: cv.fever });
const heldParams = () => ({ ...AM.NORMAL, injury: cv.injury, fever: cv.fever });
// A row with no cited direction, or a variable one, is held at the model without the chosen state.
const held = (v, st) => st && (!st.shifts[v.id] || st.shifts[v.id] === 'variable');
function modelValue(v, st) {
  const m = held(v, st) ? AM.settle(heldParams()) : AM.settle(cvParams());
  return VALUE_OF[v.modelKey](m);
}
function updateClinical() {
  $('#clinical-fever').value = cv.fever; $('#clinical-fever-label').textContent = feverWords(cv.fever);
  $('#clinical-injury').value = cv.injury; $('#clinical-injury-label').textContent = injuryWords(cv.injury);
  const cur = AM.settle(cvParams());
  const st = data?.states.find(s => s.id === cv.state);
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over dashed marks for the untreated injury. Compared with the untreated injury: ${describe(cur, NV)}.`;
  $('#clinical-visual').innerHTML = tabPicture(label, cur);
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    dir.textContent = !st ? '' : d === 'variable' ? `${DIRECTION.variable}: can be lower or higher than ${st.comparedWith}, so the model holds this value where it was`
      : d ? `${DIRECTION[d]}${v.unit === 'pH' && d === 'down' ? ' (more acidic)' : ''}, compared with ${st.comparedWith}` : 'No direction shown for this state: none is cited, so the model holds this value where it was';
    dir.classList.toggle('quiet', !d || d === 'variable');
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    const n = modelValue(v, st), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${placeWords(v, w)}${phNote(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = VALUE_OF[v.modelKey](NV), rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeWords(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.p = stateParams(id); cv.injury = 1; cv.fever = 0;
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
$('#clinical-fever').addEventListener('input', e => { cv.fever = Number(e.target.value); customised(); });
$('#clinical-injury').addEventListener('input', e => { cv.injury = Number(e.target.value); customised(); });
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const st = data.states.find(s => s.id === cv.state);
    $('#cv-live').textContent = `Illustrative model: ${data.values.map(v => { const n = modelValue(v, st); return `${v.label} ${fmt(v, n)}, ${placeWords(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { injury: 1, drugs: new Set() };
const DRUG_ORDER = ['nsaid', 'cox2i', 'aspirin', 'steroid', 'ltm'];
const DRUG_NAME = { nsaid: 'an NSAID', cox2i: 'a COX-2 selective inhibitor', aspirin: 'aspirin', steroid: 'a glucocorticoid', ltm: 'a leukotriene modifier' };
const exploreParams = () => ({ ...AM.build('normal', DRUG_ORDER.filter(d => ex.drugs.has(d))), injury: ex.injury });
const pct = x => `${Math.round(100 * x)}%`;
function updateExplore() {
  $('#injury').value = ex.injury; $('#injury-label').textContent = injuryWords(ex.injury);
  const cur = AM.settle(exploreParams());
  const drugs = DRUG_ORDER.filter(d => ex.drugs.has(d)).map(d => DRUG_NAME[d]);
  const who = drugs.length ? `your injury setting with ${drugs.join(', ')}` : 'your injury setting';
  const label = `Illustrative model of ${who}, drawn over dashed marks for the untreated injury. Compared with the untreated injury: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = tabPicture(label, cur) + readoutOf(cur, NV);
  const res = $('#model-results');
  res.textContent = `Illustrative model output, compared with the untreated injury: arachidonic acid freed ${pct(cur.release)} · pain, swelling and fever ${pct(cur.inflam)} · stomach shield ${pct(cur.shield)} · platelet clumping ${pct(cur.clot)} · leukotrienes made ${pct(cur.lt)} · airway squeeze ${pct(cur.airway)}.`;
  Object.assign(res.dataset, { release: cur.release.toFixed(4), inflam: cur.inflam.toFixed(4), shield: cur.shield.toFixed(4), clot: cur.clot.toFixed(4), lt: cur.lt.toFixed(4), airway: cur.airway.toFixed(4) });
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
$('#injury').addEventListener('input', e => { ex.injury = Number(e.target.value); updateExplore(); });
$('#reset').addEventListener('click', () => {
  ex.injury = 1; ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; });
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['temperature', 'glucose', 'bloodPH'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!MODEL_KEYS.every(k => { const v = byKey(k); return v && (hasRange(v) ? v.high > v.low : Number.isFinite(v.typical)); })) throw new Error('Invalid reference data');
    data = loaded;
    // The model's normal sits at the middle of each quoted range, or on the quoted typical value.
    for (const k of MODEL_KEYS) {
      const v = byKey(k);
      REF[k] = hasRange(v) ? (v.low + v.high) / 2 : v.typical;
      DEC[v.id] = v.unit === 'pH' ? 2 : hasRange(v) ? decimals(v.low) : 1;
    }
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges, and the dark tick is a quoted typical value. The teaching model puts its normal in the middle of each band, or on the typical value; the large number in each row is the model’s level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. For a drug the sources give only a direction; how far the model moves is an illustrative choice.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v, n);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      let band, edges, quoted;
      if (hasRange(v)) {
        const [lo, hi] = rangeText(v).split('–');
        band = `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`;
        edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
        quoted = `Source range ${rangeText(v)} ${v.unit} (shaded)`;
      } else {
        band = `<path class="typical" d="M${pos(v.typical)} 6 V40"/>`;
        edges = `<text x="${pos(v.typical)}" y="58" text-anchor="middle">typical ${v.typical}</text>`;
        quoted = `Source typical value ${v.typical} ${v.unit} (dark tick; no range given)`;
      }
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${hasRange(v) ? `the source range ${rangeText(v)} ${v.unit} as a shaded band` : `the source typical value ${v.typical} ${v.unit} as a dark tick`}, a solid marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `${quoted} · blue line: illustrative teaching-model value`;
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
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
