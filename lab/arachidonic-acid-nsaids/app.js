'use strict';
const AM = window.AAModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const NORMAL_P = AM.build('normal');
const NV = AM.settle(NORMAL_P);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', GREEN = '#1d6b3a', RED = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const HEADC = '#efb562', CELL = '#f5e7cf', MEMB = '#f6ead6', CELLEDGE = '#c98a3a';
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
const flowWidth = v => v <= 0.03 ? 0 : clamp(2 + 6 * v, 2, 16);

/* The membrane: two rows of phospholipids, heads out, tails in. Snipped ones in the inner row lose a tail. */
const HEAD_X = [...Array(30)].map((_, i) => 8 + i * 16);
const SNIP_ORDER = [14, 15, 13, 16, 12, 17, 11, 18];
function bilayer(snipped = 0, hl = -1) {
  const gaps = SNIP_ORDER.slice(0, snipped);
  let b = `<g data-membrane><rect x="0" y="22" width="480" height="52" fill="${MEMB}"/>`;
  HEAD_X.forEach((x, i) => {
    const c = i === hl ? BLUE : INK, head = i === hl ? BLUE : HEADC;
    b += `<path d="M${x - 2.5} 36 V47 M${x + 2.5} 36 V47" stroke="${c}" stroke-width="1.6"/><circle cx="${x}" cy="31" r="5.5" fill="${head}" stroke="${c}" stroke-width="1.2"/>`;
    b += `<path d="M${x - 2.5} 60 V50${gaps.includes(i) ? '' : ` M${x + 2.5} 60 V50`}" stroke="${INK}" stroke-width="1.6"/><circle cx="${x}" cy="65" r="5.5" fill="${HEADC}" stroke="${INK}" stroke-width="1.2"${gaps.includes(i) ? ' data-snipped' : ''}/>`;
  });
  return b + '</g>';
}
const bolt = (x, y, s = 1, extra = 'data-injury') => `<path ${extra} transform="translate(${f(x)} ${f(y)}) scale(${s})" d="M10 0 L-6 30 L6 30 L-10 62 L20 22 L6 22 L18 0 Z" fill="${RED}"/>`;
const AA_X = [240, 210, 270, 180, 300, 150, 330, 120];
const chain = (x, y, extra = 'data-aa') => `<path ${extra} d="M${x - 12} ${y} l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5" fill="none" stroke="${AMBER}" stroke-width="2.6" stroke-linejoin="round"/>`;
const scissors = op => `<g data-scissors opacity="${op.toFixed(2)}"><path d="M232 98 L250 74 M248 98 L230 74" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="229" cy="102" r="5.5" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="251" cy="102" r="5.5" fill="none" stroke="${INK}" stroke-width="2.4"/></g>`;
const hexPts = (x, y, r) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join(' L');
const steroidIcon = (x, y, extra = 'data-steroid') => `<g ${extra}><path d="M${hexPts(x, y, 9)} Z" fill="#fff" stroke="${GREEN}" stroke-width="2.4"/><path d="M${hexPts(x + 15.6, y, 9)} Z" fill="#fff" stroke="${GREEN}" stroke-width="2.4"/></g>`;
const plug = (x, y, col, extra) => `<rect ${extra} x="${f(x)}" y="${f(y)}" width="18" height="26" rx="3" fill="${col}"/>`;
const tag = (x, y, extra = 'data-tag') => `<path ${extra} d="M${f(x)} ${f(y)} h14 l7 7 l-7 7 h-14 Z" fill="${RED}" stroke="#fff" stroke-width="1.2"/>`;

/* Layout of the pathway picture */
const AA_Y = 124, ENZ_Y = 196, ENZ_H = 36, PROD_Y = 290, LABEL_Y = 308, BASE = 440;
const ENZ = { cox1: 100, cox2: 300, lox: 418 };
const METERS = {
  shield: [62, GREEN, ['stomach', 'shield'], 'prostaglandins'],
  clot: [178, RED, ['platelet', 'clumping'], 'thromboxane'],
  inflam: [300, AMBER, ['pain, swelling', 'and fever'], 'prostaglandins'],
  airway: [418, BLUE, ['airway', 'squeeze'], 'leukotrienes']
};
const meterH = v => clamp(52 * v, 0, 110);
function meter(k, cur, ghost, key) {
  const [x, col, [l1, l2]] = METERS[k], h = meterH(cur[k]);
  let b = `<rect x="${x - 24}" y="${BASE - 114}" width="48" height="114" fill="#fff" stroke="${RULE}"/>`;
  b += `<rect data-meter="${k}" data-level="${cur[k].toFixed(4)}" x="${x - 18}" y="${f(BASE - h)}" width="36" height="${f(h)}" fill="${col}"/>`;
  if (ghost) { const g = meterH(ghost[k]); b += `<rect data-ghost-meter="${k}" x="${x - 21}" y="${f(BASE - g)}" width="42" height="${f(g)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 3"/>`; }
  if (cur[k] > 110 / 52 + 0.01) b += `<path d="M${x} ${BASE - 124} l-8 9 h16 Z" fill="${col}"/>`;
  b += text(x, BASE + 20, l1, `xs b`) + text(x, BASE + 38, l2, 'xs b');
  if (key) b += `<rect data-key-measure="${k}" x="${x - 56}" y="${BASE - 122}" width="112" height="172" fill="none" stroke="${BLUE}" stroke-width="3"/>` + text(x, BASE + 70, 'key measure', 'xs b blue');
  return b;
}
function enzymeBox(id, label, cur, ghost, show) {
  const p = cur.p, x = ENZ[id];
  let w = id === 'lox' ? 110 : 104;
  if (id === 'cox2') w = 104 * clamp(0.45 + 0.55 * cur.cox2Made, 0.45, 1.3);
  let b = '';
  if (ghost && id === 'cox2' && Math.abs(cur.cox2Made - ghost.cox2Made) > 0.02) b += `<rect data-ghost-enzyme="cox2" x="${f(x - 52)}" y="${ENZ_Y - 3}" width="104" height="${ENZ_H + 6}" rx="7" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  b += `<rect data-enzyme="${id}" data-w="${f(w)}" x="${f(x - w / 2)}" y="${ENZ_Y}" width="${f(w)}" height="${ENZ_H}" rx="6" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  b += text(x - (id === 'lox' ? 0 : 6), ENZ_Y + 24, label, id === 'lox' ? 'xs b' : 'sm b');
  if (!show.includes('drugs') || id === 'lox') return b;
  const right = x + w / 2 - 22;
  if (p.nsaid > 0.02) b += plug(right, ENZ_Y + 5, INK, `data-plug="nsaid" opacity="${clamp(p.nsaid / 0.8, 0.2, 1).toFixed(2)}"`);
  if (id === 'cox2' && p.cox2i > 0.02) b += plug(x - w / 2 + 4, ENZ_Y + 5, BLUE, `data-plug="cox2i" opacity="${clamp(p.cox2i / 0.85, 0.2, 1).toFixed(2)}"`);
  if (p.aspirin > 0.02) b += `<g opacity="${clamp(p.aspirin / 0.9, 0.2, 1).toFixed(2)}">${tag(x - w / 2 - 8, ENZ_Y - 10)}</g>`;
  return b;
}
const ALL = ['membrane', 'injury', 'scissors', 'enzymes', 'cox1', 'shield', 'clot', 'cox2', 'inflam', 'lox', 'airway', 'drugs'];
function picture(cur, opt = {}) {
  const { show = ALL, ghost = null, legend = '', box = false } = opt;
  const has = k => show.includes(k), p = cur.p;
  let b = text(12, 16, 'outside the cell', 'xs b muted', 'start');
  const snipped = has('scissors') ? clamp(Math.round(4 * cur.release), 0, 8) : 0;
  b += bilayer(snipped);
  b += text(250, 16, 'cell membrane', 'xs b') + text(12, 140, 'inside the cell', 'xs b muted', 'start');
  if (has('injury') && p.injury > 0.04) b += bolt(436, 0, clamp(0.55 + 0.45 * p.injury, 0.6, 1.2)) + text(426, 14, 'injury', 'xs b red', 'end');
  let fl = '';
  if (has('scissors')) {
    b += scissors(clamp(cur.release, 0.3, 1)) + text(262, 96, 'phospholipase', 'xs b', 'start');
    AA_X.slice(0, snipped).forEach(x => { b += chain(x, AA_Y); });
    b += text(240, 152, 'arachidonic acid', 'xs b amber');
    if (has('drugs') && p.steroid > 0.02) b += steroidIcon(190, 88) + text(176, 98, 'glucocorticoid', 'xs b green', 'end');
    if (!has('enzymes')) {
      // One freed chain, enlarged, so the raw material is easy to see.
      let z = 'M80 236';
      for (let i = 0; i < 20; i++) z += ` l16 ${i % 2 ? 14 : -14}`;
      b += `<circle cx="240" cy="${AA_Y - 2}" r="18" fill="none" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="4 3"/><path d="M226 136 L120 214 M254 136 L360 214" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      b += `<path data-aa-big d="${z}" fill="none" stroke="${AMBER}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
      b += `<circle cx="80" cy="236" r="7" fill="${AMBER}"/>` + text(240, 282, 'one freed arachidonic acid, enlarged', 'xs b amber');
    }
  }
  if (has('enzymes')) {
    const lines = [['cox1', cur.via1, ghost?.via1], ...(has('cox2') ? [['cox2', cur.via2, ghost?.via2]] : []), ['lox', cur.lt, ghost?.lt]];
    for (const [id, v, g] of lines) {
      if (ghost) fl += ghostArrow(240, 160, ENZ[id], ENZ_Y - 2, flowWidth(g), INK, `data-ghost-flow="to-${id}"`);
      fl += arrow(240, 160, ENZ[id], ENZ_Y - 2, flowWidth(v), AMBER, `data-flow="to-${id}" data-w="${f(flowWidth(v))}"`);
    }
    b += enzymeBox('cox1', has('cox1') ? 'COX-1' : 'COX', cur, ghost, show);
    if (has('cox2')) b += enzymeBox('cox2', 'COX-2', cur, ghost, show);
    b += enzymeBox('lox', 'lipoxygenase', cur, ghost, show);
    if (has('drugs') && p.steroid > 0.02 && has('cox2')) b += steroidIcon(196, 214, 'data-steroid="cox2"');
  }
  const out = [];
  if (has('shield')) out.push(['shield', 84, ENZ_Y + ENZ_H + 2]);
  if (has('clot')) out.push(['clot', 120, ENZ_Y + ENZ_H + 2]);
  if (has('cox2')) out.push(['inflam', 300, ENZ_Y + ENZ_H + 2]);
  if (has('airway')) out.push(['airway', 418, ENZ_Y + ENZ_H + 2]);
  const flowOf = { shield: v => v.shield, clot: v => v.clot, inflam: v => v.via2, airway: v => v.lt };
  for (const [k, x0, y0] of out) {
    const [x, col, , name] = METERS[k];
    if (ghost) fl += ghostArrow(x0, y0, x, PROD_Y, flowWidth(flowOf[k](ghost)), INK, `data-ghost-flow="${k}"`);
    fl += arrow(x0, y0, x, PROD_Y, flowWidth(flowOf[k](cur)), col, `data-flow="${k}" data-w="${f(flowWidth(flowOf[k](cur)))}"`);
    b += text(x, LABEL_Y, name, `xs b ${({ shield: 'green', clot: 'red', inflam: 'amber', airway: 'blue' })[k]}`);
  }
  const meters = ['shield', 'clot', has('inflam') ? 'inflam' : null, has('airway') ? 'airway' : null].filter(k => k && has(k));
  let g = '';
  for (const k of meters) g += meter(k, cur, ghost, box && (k === 'inflam' || k === 'shield'));
  if (has('drugs') && p.ltm > 0.02 && has('airway')) g += `<rect data-plug="ltm" x="392" y="314" width="52" height="9" fill="${INK}" opacity="${clamp(p.ltm / 0.85, 0.2, 1).toFixed(2)}"/>`;
  if (ghost) b += `<g class="ghost" data-ghost="normal" ${attrs(ghost)}></g>`;
  b += `<g data-new-state="${esc(legend || 'current')}" ${attrs(cur)}>${fl}${g}</g>`;
  const items = [];
  if (has('scissors')) items.push(KEY.aa);
  if (has('drugs')) {
    if (p.nsaid > 0.02) items.push(KEY.nsaid);
    if (p.cox2i > 0.02) items.push(KEY.cox2i);
    if (p.aspirin > 0.02) items.push(KEY.aspirin);
    if (p.steroid > 0.02) items.push(KEY.steroid);
    if (p.ltm > 0.02) items.push(KEY.ltm);
  }
  if (ghost) items.push(KEY.normal);
  if (legend) items.push([`<path d="M0 -5 H32 V5 H0 Z" fill="${AMBER}"/>`, legend]);
  let top = meters.length ? BASE + (box ? 82 : 52) : has('enzymes') ? 248 : has('scissors') ? 296 : 168;
  if (out.length && !meters.length) top = LABEL_Y + 14;
  if (!items.length) return { body: b, h: top + 10 };
  const key = keyRow(items, top + 14);
  return { body: b + key.body, h: top + 30 + 26 * (key.rows - 1) };
}
const KEYS = ['release', 'via1', 'via2', 'cox2Made', 'pg', 'lt', 'inflam', 'shield', 'clot', 'airway'];
const attrs = v => KEYS.map(k => `data-${k.toLowerCase()}="${v[k].toFixed(4)}"`).join(' ');
function keyRow(items, y) {
  let x = 10, row = 0, out = '';
  for (const [icon, word] of items) {
    const w = 38 + word.length * 8.2;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    out += `<g transform="translate(${f(x)} ${y + row * 26})">${icon}${text(38, 5, word, 'xs', 'start')}</g>`;
    x += w + 14;
  }
  return { body: out, rows: row + 1 };
}
const KEY = {
  aa: [chain(16, 2, ''), 'arachidonic acid'],
  nsaid: [plug(7, -13, INK, ''), 'NSAID plug'],
  cox2i: [plug(7, -13, BLUE, ''), 'COX-2 selective plug'],
  aspirin: [tag(5, -7, ''), 'aspirin tag, for good'],
  steroid: [steroidIcon(9, 0, ''), 'glucocorticoid'],
  ltm: [`<rect x="2" y="-4" width="30" height="8" fill="${INK}"/>`, 'leukotriene blocker'],
  normal: [`<path d="M0 0 H32" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/>`, 'normal']
};
const pictureSvg = (label, cur, opt) => { const { body: b, h } = picture(cur, opt); return svg(label, b, h); };

/* Steps 1 and 2: one whole cell, with its membrane magnified above it. */
function cellPicture(injured) {
  let b = text(12, 16, 'outside the cell', 'xs b muted', 'start') + bilayer(0, injured ? -1 : 23);
  b += text(12, 98, 'the membrane, magnified', 'xs b', 'start');
  if (!injured) b += `<path d="M376 76 V84" stroke="${BLUE}" stroke-width="2"/>` + text(468, 98, 'one phospholipid', 'xs b blue', 'end');
  const rx = injured ? 188 : 176, ry = injured ? 124 : 114, cy = 290;
  b += `<ellipse cx="-30" cy="${cy + 20}" rx="70" ry="100" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/><ellipse cx="510" cy="${cy + 20}" rx="70" ry="100" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="4" opacity=".7"/>`;
  if (injured) b += `<ellipse data-glow cx="240" cy="${cy}" rx="${rx + 18}" ry="${ry + 18}" fill="#f4d6d1" stroke="${RED}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
  b += `<path d="M150 72 L196 ${cy - ry + 6} M330 72 L284 ${cy - ry + 6}" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  b += `<ellipse data-cell cx="240" cy="${cy}" rx="${rx}" ry="${ry}" fill="${CELL}" stroke="${CELLEDGE}" stroke-width="7"/>`;
  b += `<ellipse cx="240" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  b += `<circle cx="240" cy="${cy - ry}" r="16" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  [[180, 260, 18, 11], [300, 330, 22, 12], [200, 340, 14, 9], [310, 250, 15, 10]].forEach(([x, y, a, c]) => { b += `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${c}" fill="#ead3ae"/>`; });
  b += text(240, cy + 6, 'one cell', 'sm b');
  b += `<path d="M78 196 L${240 - rx * 0.83} ${f(cy - ry * 0.56)}" stroke="${MUTED}" stroke-width="1.4"/>` + text(20, 190, 'membrane', 'xs b', 'start');
  if (injured) {
    b += bolt(400, 150, 1.1);
    b += text(470, 150, 'injury', 'xs b red', 'end');
    [[66, 'red'], [176, 'warm'], [300, 'swollen'], [414, 'painful']].forEach(([x, w]) => { b += text(x, 452, w, 'sm b red'); });
  }
  return svg(injured
    ? 'The same cell, hit by an injury drawn as a red lightning bolt at its upper right. The cell has swollen and a red dashed glow surrounds it. Four words under it name the signs of inflammation: red, warm, swollen, painful. The magnified membrane above it is unchanged.'
    : 'At the top, a magnified strip of membrane: two rows of phospholipids, round orange heads facing outward on each side and pairs of tails tucked into the middle. One phospholipid, a head and two tails, is coloured blue and labelled. Below, dashed lines lead down to one whole oval cell, its outline labelled membrane, with neighbouring cells at the edges.', b, injured ? 470 : 430);
}

/* ---------- Words: comparisons and text alternatives ---------- */
function more(a, b, up = 'higher', down = 'lower') {
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
const ROWS = [['release', 'Arachidonic acid freed', 'more', 'less'], ['inflam', 'Pain, swelling and fever', 'more', 'less'], ['shield', 'Stomach shield', 'thicker', 'thinner'], ['clot', 'Platelet clumping', 'more', 'less'], ['lt', 'Leukotrienes made', 'more', 'fewer'], ['airway', 'Airway squeeze', 'stronger', 'weaker']];
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- Core step pictures ---------- */
const S3 = ['membrane', 'injury', 'scissors'], S4 = [...S3, 'enzymes'], S5 = [...S4, 'cox1', 'shield'], S6 = [...S5, 'clot'];
const S7 = [...S6, 'cox2'], S8 = [...S7, 'inflam'], S9 = [...S8, 'lox', 'airway'];
const CORE = {
  membrane: () => cellPicture(false),
  injury: () => cellPicture(true),
  scissors: () => pictureSvg('The magnified membrane runs across the top, with a red injury bolt at its right end. Just under the membrane, a pair of scissors labelled phospholipase has snipped one tail from four phospholipids in the inner row. The four freed tails float below as amber zigzag chains labelled arachidonic acid, and one of them is shown enlarged underneath: a long amber zigzag.', NV, { show: S3 }),
  roads: () => pictureSvg('Under the freed amber chains of arachidonic acid, amber arrows fork down two roads: one to the left into a box labelled COX, and one to the right into a box labelled lipoxygenase. Nothing comes out of either box yet.', NV, { show: S4 }),
  cox1: () => pictureSvg('The left-hand box is now labelled COX-1. Below it, a green arrow carries prostaglandins down to a green meter labelled stomach shield, filled to its everyday level.', NV, { show: S5 }),
  platelets: () => pictureSvg('A second arrow leaves COX-1: a red one carrying thromboxane to a red meter labelled platelet clumping, beside the green stomach shield meter.', NV, { show: S6 }),
  cox2: () => pictureSvg('A third box, COX-2, has appeared between COX-1 and lipoxygenase, drawn as large as COX-1 because the injured cell has made plenty of it. A thick amber arrow from arachidonic acid feeds it, and an amber arrow carries its prostaglandins downward.', NV, { show: S7 }),
  effects: () => pictureSvg('Under COX-2, its prostaglandins now fill an amber meter labelled pain, swelling and fever, beside the stomach shield and platelet clumping meters.', NV, { show: S8 }),
  lox: () => pictureSvg('On the right, lipoxygenase now sends a blue arrow of leukotrienes down to a blue meter labelled airway squeeze. Leukotrienes also call in white blood cells. Four meters now stand in a row: stomach shield, platelet clumping, pain swelling and fever, and airway squeeze.', NV, { show: S9 }),
  whole: () => pictureSvg('The whole pathway. The injury frees arachidonic acid from the membrane; it flows to COX-1, COX-2 and lipoxygenase. COX-1 feeds the stomach shield and platelet clumping meters, COX-2 feeds pain, swelling and fever, and lipoxygenase feeds airway squeeze. Blue frames mark the two key measures: pain, swelling and fever, and the stomach shield.', NV, { show: ALL, box: true })
};

/* ---------- What changes it ---------- */
const CHANGES = {
  nsaid: { to: () => AM.build('normal', ['nsaid']), legend: 'with an NSAID' },
  cox2i: { to: () => AM.build('normal', ['cox2i']), legend: 'with a COX-2 selective inhibitor' },
  aspirin: { to: () => AM.build('normal', ['aspirin']), legend: 'with aspirin' },
  steroid: { to: () => AM.build('normal', ['steroid']), legend: 'with a glucocorticoid' },
  ltm: { to: () => AM.build('normal', ['ltm']), legend: 'with a leukotriene modifier' }
};
const CHANGE_WHERE = {
  nsaid: 'Dark plugs sit in both the COX-1 and COX-2 boxes. The arrows through them shrink inside their dashed normal outlines, and the stomach shield, platelet clumping and pain, swelling and fever meters drop below their dashed normal levels. The arrow to lipoxygenase grows a little.',
  cox2i: 'A blue plug sits in the COX-2 box only. Its arrows shrink inside their dashed normal outlines and the pain, swelling and fever meter drops, while COX-1, the stomach shield and platelet clumping stay on their dashed normal marks.',
  aspirin: 'Red tags are stuck onto both COX boxes. COX-1 is almost completely shut, so the platelet clumping and stomach shield meters fall far below their dashed normal levels; COX-2 is partly shut, so pain, swelling and fever fall too.',
  steroid: 'Green steroid rings sit beside the phospholipase scissors, which fade, and beside a shrunken COX-2 box inside its dashed normal outline. Fewer arachidonic acid chains are freed, every arrow from them thins, and both the pain, swelling and fever meter and the airway squeeze meter drop. Platelet clumping stays at normal.',
  ltm: 'A dark blocker bar lies across the top of the airway squeeze meter, which drops far below its dashed normal level, though the arrow of leukotriene still flows. COX-1, COX-2 and their meters stay on their dashed normal marks.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const cur = AM.settle(AM.mix(NORMAL_P, c.to(), ease(t)));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal, the untreated injury. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(cur, NV)}.`;
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
function startLesson() {
  steps.forEach(el => {
    const k = el.dataset.kind;
    if (CORE[k]) visualOf(el).innerHTML = CORE[k]();
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
const span = v => hasRange(v) ? [v.low - (v.high - v.low), v.high + (v.high - v.low)] : [v.typical * 0.95, v.typical * 1.05];
const barX = (v, n) => { const [a, b] = span(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
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
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}, drawn over faint dashed marks for normal, the untreated injury. Compared with normal: ${describe(cur, NV)}.`;
  const legend = cv.custom ? 'these settings' : st ? st.label.split(' (')[0] : '';
  $('#clinical-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend });
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
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for normal, the untreated injury. Compared with normal: ${describe(cur, NV)}.`;
  $('#explore-visual').innerHTML = pictureSvg(label, cur, { show: ALL, ghost: NV, legend: 'your settings' }) + readout(cur, NV, 'Compared with normal');
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
  startLesson();
  updateClinical();
  updateExplore();
}
load();
