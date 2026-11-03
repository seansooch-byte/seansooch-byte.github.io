'use strict';
const CC = window.CCModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NV = CC.NORMAL;

/* ---------- Drawing helpers ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', RED = '#b3261e', MUTED = '#53584d', RULE = '#babeb3';
const PURPLE = '#6b3fa0', GREEN = '#2c6a2c', MARROW = '#8c3a2e', NUC = '#f1ede2';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const H = 620;
const svg = (label, body, h = H) => `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
const line = (x1, y1, x2, y2, col, w, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const circle = (x, y, r, fill, stroke = 'none', w = 0, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
function arrow(x1, y1, x2, y2, col, w = 2.5, extra = '') {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 5 + w * 1.6;
  const p = r => `${f(x2 - s * Math.cos(a + r))} ${f(y2 - s * Math.sin(a + r))}`;
  return `<g ${extra}>${line(x1, y1, x2 - Math.cos(a) * s * 0.6, y2 - Math.sin(a) * s * 0.6, col, w)}<path d="M${f(x2)} ${f(y2)} L${p(0.5)} L${p(-0.5)} Z" fill="${col}"/></g>`;
}
const cross = (x, y, s, col, extra = '') => `<path ${extra} d="M${f(x - s)} ${f(y - s)} L${f(x + s)} ${f(y + s)} M${f(x + s)} ${f(y - s)} L${f(x - s)} ${f(y + s)}" stroke="${col}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
// A chromosome: an X of two joined copies, or a single rod before copying.
const chromo = (x, y, s, col, extra = '', doubled = true) => doubled
  ? `<path ${extra} d="M${f(x - 5 * s)} ${f(y - 9 * s)} L${f(x + 5 * s)} ${f(y + 9 * s)} M${f(x + 5 * s)} ${f(y - 9 * s)} L${f(x - 5 * s)} ${f(y + 9 * s)}" stroke="${col}" stroke-width="${f(4 * s)}" stroke-linecap="round" fill="none"/>`
  : `<path ${extra} d="M${f(x)} ${f(y - 9 * s)} L${f(x)} ${f(y + 9 * s)}" stroke="${col}" stroke-width="${f(4 * s)}" stroke-linecap="round" fill="none"/>`;
const cellBody = (x, y, r, extra = '', stroke = INK) => `<g ${extra}>${circle(x, y, r, '#fff', stroke, 2)}${circle(x, y, r * 0.42, NUC, MUTED, 1.5)}</g>`;
// Two overlapping circles drawn as one pinched cell.
const pinched = (x, y, r, d, extra = '', stroke = INK) => `<g ${extra}>${circle(x - d, y, r, '#fff', stroke, 2)}${circle(x + d, y, r, '#fff', stroke, 2)}${circle(x - d, y, r - 1.6, '#fff')}${circle(x + d, y, r - 1.6, '#fff')}${circle(x - d, y, r * 0.38, NUC, MUTED, 1.5)}${circle(x + d, y, r * 0.38, NUC, MUTED, 1.5)}</g>`;
const PANEL = title => `<rect x="12" y="296" width="456" height="152" fill="#fff" stroke="${RULE}"/>${text(26, 318, title, 'xs b muted', 'start')}`;

/* ---------- The cycle ring ---------- */
const CX = 160, CY = 162, R = 92;
const PH = {
  G1: { a0: -90, a1: 40, tint: '#dde3ff', col: BLUE, cls: 'blue', word: 'grow', def: 4, lab: [205, 136] },
  S: { a0: 40, a1: 150, tint: '#f6e2cc', col: AMBER, cls: 'amber', word: 'copy', def: 6, lab: [152, 204] },
  G2: { a0: 150, a1: 220, tint: '#ebe1f4', col: PURPLE, cls: 'purple', word: 'check', def: 8, lab: [106, 156] },
  M: { a0: 220, a1: 270, tint: '#dcebd8', col: GREEN, cls: 'green', word: 'split', def: 9, lab: [140, 112] }
};
const G0_DEF = 10;
const rad = d => d * Math.PI / 180;
const pt = (r, d) => [CX + r * Math.cos(rad(d)), CY + r * Math.sin(rad(d))];
function arcPath(r, a0, a1) {
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}
const cols = p => Math.floor((PH[p].a1 - PH[p].a0 - 6) / 9);
const slot = (p, i) => { const c = Math.floor(i / 2), row = i % 2; return pt(row ? 100 : 84, PH[p].a0 + 5 + c * 9 + (row ? 4.5 : 0)); };
const dotsOf = (v, p) => clamp(Math.round(30 * v['sh' + p]), 0, 2 * cols(p));
const deadOf = (v, p) => { const d = v['dead' + p]; return d < 0.02 ? 0 : clamp(Math.max(1, Math.round(8 * d)), 1, p === 'G0' ? 10 : cols(p)); };
const named = (o, p) => o.n >= (p === 'G0' ? G0_DEF : PH[p].def);
const G0X = 324, G0Y = 50;
const g0Slot = i => [G0X + 24 + (i % 5) * 24, G0Y + 50 + Math.floor(i / 5) * 22];

function ring(cur, o) {
  const has = k => o.parts.has(k);
  let s = '';
  for (const [p, ph] of Object.entries(PH)) {
    if (o.focus === p) s += `<path d="${arcPath(R, ph.a0, ph.a1)}" fill="none" stroke="${ph.col}" stroke-width="38"/>`;
    s += `<path data-phase="${p}" d="${arcPath(R, ph.a0, ph.a1)}" fill="none" stroke="${ph.tint}" stroke-width="${o.focus === p ? 31 : 32}"/>`;
  }
  // Chevrons on the band show the direction of travel.
  for (const a of [40, 150, 220, -90]) {
    const [x, y] = pt(R, a), tx = -Math.sin(rad(a)), ty = Math.cos(rad(a)), nx = Math.cos(rad(a)), ny = Math.sin(rad(a));
    s += `<path d="M${f(x + tx * 7)} ${f(y + ty * 7)} L${f(x - tx * 4 + nx * 7)} ${f(y - ty * 4 + ny * 7)} L${f(x - tx * 4 - nx * 7)} ${f(y - ty * 4 - ny * 7)} Z" fill="#fff" stroke="${MUTED}" stroke-width="1"/>`;
  }
  for (const [p, ph] of Object.entries(PH)) {
    const [lx, ly] = ph.lab;
    if (named(o, p)) s += text(lx, ly, p, `sm b ${ph.cls}`) + text(lx, ly + 16, ph.word, 'xs muted');
    else s += text(lx, ly + 6, ph.word, `xs b ${ph.cls}`);
  }
  // The checkpoint gate at the end of G1, and the engines that open it.
  if (has('gate')) {
    const [x0, y0] = pt(70, 40), [x1, y1] = pt(114, 40);
    if (has('broken')) {
      const [xa, ya] = pt(84, 40), [xb, yb] = pt(100, 40);
      s += `<g data-broken-gate>${line(x0, y0, xa, ya, INK, 5)}${line(xb, yb, x1, y1, INK, 5)}${cross((xa + xb) / 2, (ya + yb) / 2, 5, RED)}</g>`;
    } else s += line(x0, y0, x1, y1, INK, 5, 'data-gate');
    if (o.n >= 4 && o.n <= 10) s += text(266, 268, 'checkpoint', 'xs b', 'start') + line(262, 262, x1 + 2, y1 + 2, INK, 1.2);
  }
  if (has('engine')) {
    const [ex, ey] = pt(62, 40);
    s += `<g data-engine>${engine(ex, ey, 0.8)}</g>`;
    if (o.drug === 'cdk46') s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}"><rect data-drug="cdk46" x="${f(ex - 11)}" y="${f(ey - 7)}" width="22" height="14" rx="3" fill="${RED}" stroke="#fff" stroke-width="1.5"/></g>`;
  }
  // Cells in each phase (dashed outlines: the normal mix).
  for (const p of Object.keys(PH)) {
    if (o.ghost) for (let i = 0; i < dotsOf(o.ghost, p); i++) { const [x, y] = slot(p, i); s += circle(x, y, 6.5, 'none', MUTED, 1.3, `data-ghost-cell="${p}" stroke-dasharray="2 2"`); }
    for (let i = 0; i < dotsOf(cur, p); i++) { const [x, y] = slot(p, i); s += circle(x, y, 5.6, PH[p].col, '#fff', 1.2, `data-cell="${p}"`); }
    for (let i = 0; i < deadOf(cur, p); i++) { const [x, y] = pt(122, PH[p].a0 + 5 + i * 9); s += cross(x, y, 4, RED, `data-dead="${p}"`); }
  }
  if (has('g0')) {
    s += `<rect data-g0-box x="${G0X}" y="${G0Y}" width="144" height="160" fill="#fff" stroke="${o.drug === 'alkylating' && o.markT > 0.3 ? RED : MUTED}" stroke-width="${o.drug === 'alkylating' && o.markT > 0.3 ? 2.5 : 1.5}" stroke-dasharray="6 4"/>`;
    s += text(G0X + 72, G0Y + 22, 'G0', 'sm b') + text(G0X + 72, G0Y + 38, 'resting', 'xs muted');
    const n0 = clamp(Math.round(30 * cur.shG0), 0, 25), ng = o.ghost ? clamp(Math.round(30 * o.ghost.shG0), 0, 25) : 0;
    for (let i = 0; i < ng; i++) { const [x, y] = g0Slot(i); s += circle(x, y, 6.5, 'none', MUTED, 1.3, 'data-ghost-cell="G0" stroke-dasharray="2 2"'); }
    for (let i = 0; i < n0; i++) { const [x, y] = g0Slot(i); s += circle(x, y, 5.6, MUTED, '#fff', 1.2, 'data-g0-cell'); }
    for (let i = 0; i < deadOf(cur, 'G0'); i++) s += cross(G0X + 22 + i * 12, G0Y + 150, 4, RED, 'data-dead="G0"');
    s += arrow(258, 98, G0X - 4, 98, MUTED, 1.8) + arrow(G0X - 4, 128, 268, 132, MUTED, 1.8);
  }
  s += text(468, 42, 'dots: share of living cells', 'xs muted', 'end', 'data-share-key');
  if (o.drug && o.drug !== 'cdk46') s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}">${target(o.drug)}</g>`;
  return s;
}
// The red bracket that marks where a drug strikes.
function target(drug) {
  const arc = p => `<path data-drug="${drug}" d="${arcPath(131, PH[p].a0 + 2, PH[p].a1 - 2)}" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`;
  if (drug === 'antimetabolite') return arc('S');
  if (drug === 'spindle') return arc('M');
  if (drug === 'topo') return arc('S') + arc('G2');
  if (drug === 'alkylating') return `<circle data-drug="alkylating" cx="${CX}" cy="${CY}" r="131" fill="none" stroke="${RED}" stroke-width="3" stroke-dasharray="8 6"/>`;
  return '';
}
// A CDK engine (a notched wheel) with its cyclin partner.
const engine = (x, y, s = 1, col = BLUE) => `<path d="M${f(x - 12 * s)} ${f(y)} A${f(12 * s)} ${f(12 * s)} 0 1 1 ${f(x + 8 * s)} ${f(y + 9 * s)} L${f(x)} ${f(y)} Z" fill="${col}"/><path d="M${f(x + 6 * s)} ${f(y - 4 * s)} q${f(10 * s)} ${f(-2 * s)} ${f(12 * s)} ${f(8 * s)} q${f(-6 * s)} ${f(6 * s)} ${f(-12 * s)} ${f(6 * s)} Z" fill="${AMBER}"/>`;

/* ---------- Overviews before the ring ---------- */
function tissue() {
  let s = `<rect x="14" y="40" width="452" height="240" fill="#fbf3ea"/>`;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) {
    const x = 42 + c * 50 + (r % 2) * 25, y = 70 + r * 46;
    if (x > 450) continue;
    if (r === 2 && c === 4) { s += pinched(x + 6, y, 18, 11, 'data-dividing', BLUE); continue; }
    s += cellBody(x, y, 21);
  }
  return s + arrow(330, 196, 274, 172, BLUE, 2) + text(336, 212, 'one cell dividing', 'xs b blue', 'start');
}
function bigCell() {
  let s = `<ellipse cx="240" cy="166" rx="190" ry="114" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
  s += `<circle data-nucleus cx="250" cy="166" r="70" fill="${NUC}" stroke="${MUTED}" stroke-width="2"/>`;
  [[222, 140, BLUE], [276, 142, AMBER], [232, 190, PURPLE], [280, 188, GREEN], [252, 166, BLUE]].forEach(([x, y, c]) => { s += chromo(x, y, 1.1, c, 'data-chromosome', false); });
  s += text(80, 100, 'cell', 'sm b', 'start') + text(250, 258, 'nucleus', 'xs b');
  s += arrow(370, 92, 296, 134, INK, 1.8) + text(372, 86, 'chromosomes', 'xs b', 'start');
  return s;
}

/* ---------- Close-ups ---------- */
function closeDivide() {
  let s = PANEL('close up: one cell becomes two');
  s += cellBody(84, 384, 34, 'data-stage');
  s += pinched(232, 384, 30, 20, 'data-stage') + line(232, 352, 232, 360, INK, 2) + line(232, 408, 232, 416, INK, 2);
  s += `<g data-stage>${cellBody(364, 384, 26)}${cellBody(424, 384, 26)}</g>`;
  s += arrow(128, 384, 168, 384, MUTED, 2) + arrow(292, 384, 326, 384, MUTED, 2);
  return s + text(84, 440, 'one cell', 'xs b') + text(232, 440, 'pinching in', 'xs b') + text(394, 440, 'two cells', 'xs b');
}
function ladder(x0, x1, yTop, yBot, opts = {}) {
  // A twisted double strand drawn as two waves with rungs between them.
  const n = 40, amp = (yBot - yTop) / 2, mid = (yTop + yBot) / 2, turns = opts.turns ?? 3;
  let a = '', b = '', rungs = '';
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, ph = turns * 2 * Math.PI * i / n;
    a += `${i ? 'L' : 'M'}${f(x)} ${f(mid - amp * Math.cos(ph))} `;
    b += `${i ? 'L' : 'M'}${f(x)} ${f(mid + amp * Math.cos(ph))} `;
    if (i % 3 === 1) rungs += line(x, mid - amp * Math.cos(ph), x, mid + amp * Math.cos(ph), RULE, 2.5, opts.rung ? 'data-dna-rung' : '');
  }
  return rungs + `<path d="${a}" fill="none" stroke="${BLUE}" stroke-width="3"/><path d="${b}" fill="none" stroke="${AMBER}" stroke-width="3"/>`;
}
function closeDna() {
  let s = PANEL('close up: a chromosome, unwound');
  s += chromo(60, 384, 2, BLUE, 'data-chromosome', false);
  s += arrow(88, 384, 126, 384, MUTED, 2);
  s += ladder(140, 450, 360, 408, { rung: true, turns: 2.5 });
  return s + text(60, 440, 'a chromosome', 'xs b') + text(296, 440, 'DNA: two strands of coded instructions', 'xs b');
}
function closeCycle() {
  let s = PANEL('close up: what happens in each stage');
  const xs = [66, 182, 298, 414];
  s += `<g data-mini>${cellBody(xs[0] - 16, 382, 14)}${arrow(xs[0] - 1, 382, xs[0] + 10, 382, MUTED, 1.6)}${cellBody(xs[0] + 30, 382, 22)}</g>`;
  s += `<g data-mini>${chromo(xs[1] - 24, 382, 1.4, AMBER, '', false)}${arrow(xs[1] - 12, 382, xs[1] + 4, 382, MUTED, 1.6)}${chromo(xs[1] + 26, 382, 1.4, AMBER)}</g>`;
  s += `<g data-mini>${chromo(xs[2] - 8, 382, 1.4, PURPLE)}${circle(xs[2] + 10, 372, 16, 'none', INK, 2.5)}${line(xs[2] + 22, 384, xs[2] + 34, 398, INK, 4)}</g>`;
  s += `<g data-mini>${cellBody(xs[3] - 20, 382, 18)}${cellBody(xs[3] + 20, 382, 18)}</g>`;
  ['grow', 'copy the DNA', 'check', 'split'].forEach((w, i) => { s += text(xs[i], 432, w, `xs b ${['blue', 'amber', 'purple', 'green'][i]}`); });
  return s;
}
function gateDraw(x, y, open, extra = '') {
  // A gate on a path: a post and a bar that swings up when open.
  const bar = open ? line(x, y - 34, x + 18, y - 72, INK, 6) : line(x, y - 34, x, y + 30, INK, 6);
  return `<g ${extra}>${line(x, y - 40, x, y - 28, MUTED, 3)}${circle(x, y - 34, 5, INK)}${bar}</g>`;
}
function closeG1() {
  let s = PANEL('close up: G1, growing toward the gate');
  s += cellBody(56, 386, 16) + arrow(78, 386, 102, 386, MUTED, 1.6) + cellBody(136, 386, 24) + arrow(166, 386, 190, 386, MUTED, 1.6) + cellBody(226, 386, 30);
  s += line(270, 420, 450, 420, RULE, 2) + gateDraw(320, 390, false, 'data-gate-close');
  s += text(392, 368, 'go on', 'xs b', 'start') + text(392, 384, 'and divide?', 'xs b', 'start');
  return s + text(140, 440, 'the cell grows', 'xs b blue') + text(320, 440, 'checkpoint', 'xs b');
}
function closeCdk(cur, o) {
  let s = PANEL('close up: the engines push the gate open');
  s += line(40, 420, 450, 420, RULE, 2);
  s += cellBody(110, 386, 24);
  s += `<g data-engine>${engine(176, 380, 1.4)}</g><g data-engine>${engine(206, 404, 1.2)}</g>`;
  s += gateDraw(256, 390, true, 'data-gate-close') + arrow(290, 386, 372, 386, BLUE, 2.4) + cellBody(414, 386, 20);
  s += text(180, 346, 'CDK4 and CDK6', 'xs b blue') + text(222, 440, 'cyclin partner', 'xs b amber');
  return s + text(414, 440, 'on to copying', 'xs b');
}
// The copying fork: parent DNA on the left, unzipped into two strands, each getting new building blocks.
function closeCopy(cur, o) {
  let s = PANEL(o.drug === 'antimetabolite' ? 'close up: copying the DNA in S phase' : 'close up: S phase, copying the DNA');
  s += line(40, 372, 170, 372, BLUE, 3) + line(40, 392, 170, 392, AMBER, 3);
  for (let x = 48; x < 170; x += 12) s += line(x, 372, x, 392, RULE, 2.5);
  s += `<path d="M170 372 Q186 372 200 352 L440 352" fill="none" stroke="${BLUE}" stroke-width="3"/><path d="M170 392 Q186 392 200 412 L440 412" fill="none" stroke="${AMBER}" stroke-width="3"/>`;
  const anti = o.drug === 'antimetabolite', e = anti ? o.e : 0;
  const real = Math.round(8 - 6 * e);
  for (const [y, col] of [[366, AMBER], [398, BLUE]]) {
    for (let i = 0; i < 8; i++) {
      const x = 212 + i * 28;
      if (anti && i >= real) s += `<rect data-ghost-block x="${x}" y="${y - 6}" width="20" height="12" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="2 2"/>`;
      else s += `<rect data-block x="${x}" y="${y - 6}" width="20" height="12" fill="${col}" opacity=".85"/>`;
    }
    if (anti) s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}"><rect data-drug="antimetabolite" x="${212 + real * 28}" y="${y - 7}" width="20" height="14" fill="${RED}" stroke="#fff" stroke-width="1.5"/></g>`;
  }
  s += text(104, 360, 'parent DNA', 'xs b') + text(322, 340, 'new building blocks', 'xs b');
  if (anti) return s + text(240, 440, 'a fake block jams the copying', 'xs b red');
  return s + text(240, 440, 'each old strand gets a new partner', 'xs muted');
}
function twisted(x0, x1, y, amp, turns, extra = '') {
  let a = '', b = '';
  for (let i = 0; i <= 30; i++) { const x = x0 + (x1 - x0) * i / 30, ph = turns * 2 * Math.PI * i / 30; a += `${i ? 'L' : 'M'}${f(x)} ${f(y - amp * Math.cos(ph))} `; b += `${i ? 'L' : 'M'}${f(x)} ${f(y + amp * Math.cos(ph))} `; }
  return `<g ${extra}><path d="${a}" fill="none" stroke="${BLUE}" stroke-width="3"/><path d="${b}" fill="none" stroke="${AMBER}" stroke-width="3"/></g>`;
}
const topoEnzyme = (x, y, extra = '') => `<path ${extra} d="M${x - 16} ${y - 20} Q${x} ${y - 34} ${x + 16} ${y - 20} M${x - 16} ${y + 20} Q${x} ${y + 34} ${x + 16} ${y + 20}" fill="none" stroke="${PURPLE}" stroke-width="6" stroke-linecap="round"/>`;
function closeUntwist(cur, o) {
  const drug = o.drug === 'topo', e = drug ? o.e : 0;
  let s = PANEL(drug ? 'close up: the untwisting enzyme, trapped' : 'close up: cut, untwist, join');
  s += twisted(28, 140, 384, 14, 4);
  s += arrow(146, 384, 172, 384, MUTED, 1.8);
  // The enzyme holds a cut open.
  s += twisted(184, 222, 384, 14, 1) + twisted(250, 288, 384, 14, 1) + topoEnzyme(236, 384, 'data-topo-enzyme');
  s += arrow(296, 384, 322, 384, MUTED, 1.8);
  // Joined and relaxed (normal), or left broken (drug).
  if (drug) {
    const gap = 26 * e;
    s += `<g data-ghost-joined>${line(332, 376, 450, 376, MUTED, 1.5, 'stroke-dasharray="4 4"')}${line(332, 392, 450, 392, MUTED, 1.5, 'stroke-dasharray="4 4"')}</g>`;
    s += line(332, 376, 391 - gap / 2, 376, BLUE, 3) + line(332, 392, 391 - gap / 2, 392, AMBER, 3) + line(391 + gap / 2, 376, 450, 376, BLUE, 3) + line(391 + gap / 2, 392, 450, 392, AMBER, 3);
    if (e > 0.5) s += cross(391, 384, 6, RED, 'data-break');
    s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}"><rect data-drug="topo" x="226" y="374" width="20" height="20" rx="3" fill="${RED}" stroke="#fff" stroke-width="1.5"/></g>`;
    return s + text(80, 440, 'wound tight', 'xs b') + text(236, 440, 'cut, then trapped', 'xs b red') + text(391, 440, 'never rejoined', 'xs b red');
  }
  s += line(332, 376, 450, 376, BLUE, 3) + line(332, 392, 450, 392, AMBER, 3);
  return s + text(80, 440, 'wound tight', 'xs b') + text(236, 440, 'topoisomerase cuts', 'xs b purple') + text(391, 440, 'untwisted, joined', 'xs b');
}
function closeG2() {
  let s = PANEL('close up: G2, checking the copy');
  s += line(40, 368, 300, 368, BLUE, 3) + line(40, 384, 300, 384, AMBER, 3) + line(40, 400, 300, 400, AMBER, 3) + line(40, 416, 300, 416, BLUE, 3);
  s += `<g data-check>${circle(200, 390, 30, 'none', INK, 3)}${line(222, 412, 244, 434, INK, 6)}</g>` + cross(196, 384, 6, RED);
  s += text(386, 366, 'a break?', 'xs b red') + text(386, 390, 'fix it, stop,', 'xs b') + text(386, 406, 'or self-destruct', 'xs b');
  return s + text(150, 440, 'the doubled DNA', 'xs muted');
}
function spindleCell(cx, w, mode, e, o) {
  // mode: 'normal', 'vinca' (ropes cannot grow) or 'taxane' (ropes frozen, cannot shrink).
  let s = `<ellipse cx="${cx}" cy="378" rx="${w}" ry="50" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  const pl = cx - w + 16, pr = cx + w - 16;
  s += circle(pl, 378, 6, GREEN) + circle(pr, 378, 6, GREEN);
  const ys = [352, 378, 404];
  for (const y of ys) s += chromo(cx, y, 0.9, AMBER, 'data-chromosome');
  for (const y of ys) for (const [px, side] of [[pl, -1], [pr, 1]]) {
    const full = cx + side * 7 - px;
    if (mode !== 'normal' && o.ghost) s += line(px, 378, px + full, y, MUTED, 1.4, 'data-ghost-microtubule stroke-dasharray="3 3"');
    const reach = mode === 'vinca' ? 1 - 0.65 * e : 1;
    s += line(px, 378, px + full * reach, 378 + (y - 378) * reach, GREEN, 2.4, 'data-microtubule');
    if (mode === 'taxane' && e > 0.3) s += circle(px + full * 0.5, 378 + (y - 378) * 0.5, 3, '#fff', RED, 1.5, 'data-frozen');
  }
  return s;
}
function closeM(cur, o) {
  if (o.drug === 'spindle') {
    let s = PANEL('close up: the spindle, jammed');
    s += spindleCell(124, 102, 'vinca', o.e, o) + spindleCell(356, 102, 'taxane', o.e, o);
    s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}">${circle(124, 330, 7, RED, '#fff', 1.5, 'data-drug="spindle"')}${circle(356, 330, 7, RED, '#fff', 1.5, 'data-drug="spindle"')}</g>`;
    return s + text(124, 444, 'vinca: ropes cannot grow', 'xs b red') + text(356, 444, 'taxane: ropes cannot shrink', 'xs b red');
  }
  let s = PANEL('close up: mitosis, then cytokinesis');
  s += spindleCell(220, 150, 'normal', 0, o);
  s += arrow(130, 336, 90, 336, GREEN, 2) + arrow(310, 336, 350, 336, GREEN, 2);
  return s + text(240, 444, 'ropes pull copies apart, then the cell pinches in two', 'xs b green') + text(420, 384, 'pole', 'xs b', 'middle');
}
function closeG0() {
  let s = PANEL('close up: resting cells at work');
  const jobs = [[60, 'nerve'], [150, 'muscle'], [240, 'liver']];
  for (const [x, w] of jobs) s += cellBody(x, 382, 24, 'data-rest') + text(x, 432, w, 'xs b');
  s += line(300, 340, 300, 440, RULE, 1);
  s += cellBody(354, 382, 22) + arrow(380, 382, 430, 382, BLUE, 2.4);
  return s + text(382, 432, 'steps back in', 'xs b blue') + text(382, 356, 'to heal a wound', 'xs b blue');
}
// Healthy tissue stops when full (the dashed ghost row); cancer cells keep dividing and heap up as the morph runs.
const PILE = [[290, 392], [324, 392], [358, 392], [392, 392], [426, 392], [307, 362], [341, 362], [375, 362], [409, 362], [324, 334], [358, 334], [392, 334], [341, 308]];
function closeCancer(cur, o) {
  let s = PANEL('close up: healthy tissue, and a tumour');
  s += line(28, 412, 210, 412, RULE, 2);
  for (let i = 0; i < 5; i++) s += cellBody(46 + i * 36, 392, 16);
  s += text(118, 440, 'healthy: stops when full', 'xs b');
  s += line(250, 412, 456, 412, RULE, 2);
  if (o.ghost) for (let i = 0; i < 5; i++) s += circle(PILE[i][0], PILE[i][1], 15, 'none', MUTED, 1.3, 'data-ghost-row stroke-dasharray="3 3"');
  const n = Math.round(5 + (PILE.length - 5) * o.e);
  for (let i = 0; i < n; i++) s += cellBody(PILE[i][0], PILE[i][1], 15, 'data-tumour-pile', RED);
  return s + text(356, 440, 'cancer: keeps dividing', 'xs b red');
}
function closeWhole() {
  let s = PANEL('healthy tissues that divide all the time');
  // The bone marrow inside a bone, hair roots, and the gut lining.
  s += `<g data-target>${circle(96, 378, 50, 'none', BLUE, 2.5)}</g>`;
  s += `<rect x="52" y="364" width="88" height="28" rx="14" fill="#f4ead8" stroke="${INK}" stroke-width="2"/><rect x="62" y="370" width="68" height="16" rx="8" fill="#e8b3a8"/>`;
  for (let i = 0; i < 5; i++) s += circle(70 + i * 13, 378, 3.5, MARROW);
  s += `<g data-target>${circle(240, 378, 50, 'none', BLUE, 2.5)}</g>`;
  s += line(200, 404, 280, 404, SKINLINE, 4);
  for (let i = 0; i < 5; i++) s += `<path d="M${212 + i * 14} 404 q-6 -26 4 -50" fill="none" stroke="${INK}" stroke-width="2"/>` + circle(212 + i * 14, 408, 4, INK);
  s += `<g data-target>${circle(384, 378, 50, 'none', BLUE, 2.5)}</g>`;
  s += `<path d="M346 400 q9 -40 18 0 q9 -40 18 0 q9 -40 18 0 q9 -40 18 0" fill="#f2c9bf" stroke="${INK}" stroke-width="2"/>` + line(342, 400, 426, 400, INK, 2);
  return s + text(96, 444, 'bone marrow', 'xs b') + text(240, 444, 'hair roots', 'xs b') + text(384, 444, 'gut lining', 'xs b');
}
const SKINLINE = '#d9b38c';
function closeAlkyl(cur, o) {
  const e = o.e;
  let s = PANEL('close up: chemical groups stuck onto DNA');
  s += line(40, 370, 200, 370, BLUE, 3) + line(40, 398, 200, 398, AMBER, 3);
  // One-ended agents only add a chemical group (red dots); two-ended agents also tie the strands (red bars).
  for (const [x, y] of [[54, 362], [132, 406], [176, 362]]) s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}">${circle(x, y, 5, RED, '#fff', 1.2, 'data-drug="alkylating" data-alkyl-group')}</g>`;
  // Normal: the strands unzip at a fork. Drug: ties hold them shut.
  const open = 34 * (1 - e);
  if (o.ghost) s += `<path data-ghost-fork d="M200 370 L440 336 M200 398 L440 432" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  s += `<path d="M200 370 L440 ${f(370 - open)} M200 398 L440 ${f(398 + open)}" fill="none" stroke-width="3" stroke="${BLUE}"/>`;
  s += `<path d="M200 398 L440 ${f(398 + open)}" fill="none" stroke-width="3" stroke="${AMBER}"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 92 + i * 72, t = clamp((x - 200) / 240, 0, 1);
    const y1 = 370 - open * t, y2 = 398 + open * t;
    s += `<g opacity="${clamp(o.markT - i * 0.15, 0, 1).toFixed(2)}">${line(x, y1, x, y2, RED, 4, 'data-drug="alkylating" data-crosslink')}</g>`;
  }
  return s + text(26, 428, 'dots: one-ended agents add a group', 'xs b red', 'start') + text(26, 444, 'bars: two-ended agents also tie the strands', 'xs b red', 'start');
}
function closeCdk46(cur, o) {
  const e = o.e;
  let s = PANEL('close up: the G1 gate, held shut');
  s += line(28, 420, 452, 420, RULE, 2);
  s += gateDraw(300, 390, e < 0.5, 'data-gate-close');
  s += `<g data-engine>${engine(268, 360, 1.3)}</g>`;
  s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}"><rect data-drug="cdk46" x="250" y="350" width="34" height="20" rx="4" fill="${RED}" stroke="#fff" stroke-width="1.5"/></g>`;
  // Normal flow: cells pass the gate. Drug: they queue in G1.
  const passed = Math.round(3 * (1 - e)), queued = Math.round(2 + 4 * e);
  if (o.ghost) for (let i = 0; i < 3; i++) s += circle(340 + i * 38, 396, 15, 'none', MUTED, 1.3, 'data-ghost-pass stroke-dasharray="3 3"');
  for (let i = 0; i < passed; i++) s += cellBody(340 + i * 38, 396, 14, 'data-pass');
  for (let i = 0; i < queued; i++) s += cellBody(262 - i * 36, 396, 14, 'data-queue');
  return s + text(130, 444, 'cells wait in G1', 'xs b blue') + text(378, 444, 'few go on', 'xs b');
}
// Explore: tumour size and new blood cells over time.
const GX0 = 56, GX1 = 448, GY0 = 422, GH = 92;
function graph(cur, o) {
  let s = PANEL('tumour and marrow over time (illustrative model)');
  s += line(GX0, 326, GX0, GY0, INK, 1.5) + line(GX0, GY0, GX1, GY0, INK, 1.5) + text(GX1, 442, 'time →', 'xs', 'end');
  s += `<text transform="rotate(-90 36 374)" x="36" y="374" text-anchor="middle" class="xs">amount ↑</text>`;
  const path = (ts, ys, norm, from = 0) => 'M' + ts.slice(from).map((t, i) => `${f(GX0 + (GX1 - GX0) * t / CC.T_END)} ${f(GY0 - GH * clamp(ys[i + from] / norm, 0, 1.1))}`).join(' L');
  const gT = o.ghostSeries.tum, gM = CC.BASE.mar.series, endT = gT.size[gT.size.length - 1];
  const ratio = ser => ser.made.map((m, i) => (i === 0 ? 1 : m / gM.made[i]));
  s += `<path data-ghost-curve="tumour" d="${path(gT.t, gT.size, endT)}" fill="none" stroke="${MUTED}" stroke-width="1.8" stroke-dasharray="6 5"/>`;
  s += `<path data-ghost-curve="marrow" d="${path(gM.t, gM.made.map(() => 1), 1, 1)}" fill="none" stroke="${MUTED}" stroke-width="1.8" stroke-dasharray="6 5"/>`;
  s += `<path data-curve="tumour" d="${path(o.series.tum.t, o.series.tum.size, endT)}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  s += `<path data-curve="marrow" d="${path(o.series.mar.t, ratio(o.series.mar), 1, 1)}" fill="none" stroke="${MARROW}" stroke-width="3"/>`;
  return s + text(GX0 + 10, 340, 'new blood cells', 'xs b', 'start') + text(GX1 - 4, 360, 'tumour size', 'xs b', 'end');
}

/* ---------- Meters ---------- */
const SHARES = [['shG1', 'G1'], ['shS', 'S'], ['shG2', 'G2'], ['shM', 'M'], ['shG0', 'G0']];
const METERS = [['tumour', ['tumour', 'size'], INK], ['marrow', ['new blood', 'cells'], MARROW], ['damaged', ['damaged', 'cells'], RED], ['shG1', ['share', 'in G1'], BLUE], ['shM', ['share in', 'mitosis'], GREEN]];
const MX = i => 52 + i * 94, BASE_Y = 576, meterH = v => clamp(56 * v, 0, 84);
const relOf = (v, k) => k.startsWith('sh') ? v[k] / NV[k] : v[k];
function shareBars(cur, o) {
  let s = line(12, 456, 468, 456, RULE, 1) + text(12, 478, 'share of cells at each stage: taller bar, bigger share', 'xs b muted', 'start');
  SHARES.forEach(([k, p], i) => {
    if (p === 'G0' && !o.parts.has('g0')) return;
    const x = MX(i), h = clamp(220 * cur[k], 0, 84), ph = PH[p];
    s += line(x - 26, BASE_Y, x + 26, BASE_Y, INK, 1.5);
    s += `<rect data-share="${p}" x="${x - 14}" y="${f(BASE_Y - h)}" width="28" height="${f(h)}" fill="${ph ? ph.col : MUTED}"/>`;
    if (named(o, p)) s += text(x, 596, p, 'xs b') + text(x, 612, ph ? ph.word : 'resting', 'xs muted');
    else s += text(x, 596, ph.word, 'xs b');
  });
  return s;
}
function meters(cur, o) {
  if (o.shares) return shareBars(cur, o);
  let s = line(12, 456, 468, 456, RULE, 1);
  s += text(468, 478, o.ghost ? 'compared with normal' : 'taller bar: more of it', 'xs b muted', 'end');
  if (o.key) s += `<rect data-key-measure x="${MX(0) - 44}" y="486" width="${MX(1) - MX(0) + 88}" height="132" fill="none" stroke="${BLUE}" stroke-width="2"/>` + text((MX(0) + MX(1)) / 2, 478, 'key measures', 'xs b blue');
  METERS.forEach(([k, words, col], i) => {
    if (!o.meters.includes(k)) return;
    const x = MX(i), h = meterH(relOf(cur, k));
    s += line(x - 26, BASE_Y, x + 26, BASE_Y, INK, 1.5);
    if (o.ghost) s += `<rect data-ghost-meter="${k}" x="${x - 18}" y="${f(BASE_Y - meterH(relOf(o.ghost, k)))}" width="36" height="${f(meterH(relOf(o.ghost, k)))}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<rect data-meter="${k}" x="${x - 14}" y="${f(BASE_Y - h)}" width="28" height="${f(h)}" fill="${col}"/>`;
    // Before cancer is introduced, the first key measure is simply how many cells build up.
    (k === 'tumour' && o.n < 12 ? ['how many', 'cells'] : words).forEach((w, j) => { s += text(x, 596 + j * 16, w, 'xs b'); });
  });
  return s;
}
function header(o) {
  if (!o.legend) return text(12, 22, o.title, 'xs b muted', 'start');
  return line(14, 17, 44, 17, INK, 2, 'stroke-dasharray="5 4"') + text(52, 22, 'normal', 'xs b', 'start')
    + line(124, 17, 154, 17, INK, 5) + text(162, 22, o.legend, 'xs b', 'start');
}
const CLOSE = { divide: closeDivide, dna: closeDna, cycle: closeCycle, g1: closeG1, cdk: closeCdk, s: closeCopy, untwist: closeUntwist, g2: closeG2, m: closeM, g0: closeG0, cancer: closeCancer, whole: closeWhole, antimetabolite: closeCopy, spindle: closeM, alkylating: closeAlkyl, topo: closeUntwist, cdk46: closeCdk46, graph };
function picture(cur, o) {
  const over = o.parts.has('tissue') ? tissue() : o.parts.has('bigcell') ? bigCell() : ring(cur, o);
  const close = CLOSE[o.close](cur, o);
  const ghost = o.ghost ? `<g data-ghost="normal" ${attrs(o.ghost)}></g>` : '';
  const bottom = o.meters || o.shares ? meters(cur, o) : '';
  return header(o) + ghost + `<g data-new-state ${attrs(cur)}>` + over + close + bottom + '</g>';
}
const attrs = v => CC.KEYS.map(k => `data-${k.toLowerCase()}="${v[k].toFixed(4)}"`).join(' ');

/* ---------- Words for changes ---------- */
const ROWS = [['tumour', 'Tumour size', 'bigger', 'smaller'], ['marrow', 'New blood cells', 'more', 'fewer'], ['damaged', 'Damaged cells', 'more', 'fewer'], ['shG1', 'Share of living cells in G1', 'larger', 'smaller'], ['shM', 'Share of living cells in mitosis', 'larger', 'smaller']];
function more(a, b, up, down) {
  if (Math.abs(a - b) < 0.05 * Math.max(Math.abs(b), 0.05)) return ['about the same', 'same'];
  return a > b ? [up, 'up'] : [down, 'down'];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k[0].toLowerCase() + k.slice(1)}: ${w}`).join('; ');

/* ---------- Lesson steps ---------- */
const P3 = ['ring'], P4 = [...P3, 'gate'], P5 = [...P4, 'engine'], P10 = [...P5, 'g0'], P11 = [...P10, 'broken'];
const CORE = {
  divide: { n: 1, parts: ['tissue'], close: 'divide', title: 'a patch of tissue: cells side by side, as in skin',
    label: 'A patch of tissue drawn as rows of round cells, each with a darker centre. One cell, outlined in blue, is pinching in two. Close up, one cell pinches in at the middle and becomes two cells.' },
  dna: { n: 2, parts: ['bigcell'], close: 'dna', title: 'one cell, magnified',
    label: 'One cell drawn large, with a round nucleus in its middle holding several coloured rod-shaped chromosomes. Close up, one chromosome is unwound into DNA: two twisting strands joined by rungs, like a twisted ladder.' },
  cycle: { n: 3, parts: P3, close: 'cycle', shares: true, title: 'the cell cycle',
    label: 'The cell cycle drawn as a ring of four coloured stages, read clockwise from the top: grow, copy, check and split, with small arrows showing the direction of travel. Coloured dots on the ring show the share of cells at each stage; grow holds the largest share and split the smallest. Close up, a cell grows, a chromosome is copied into a double X, the copy is checked under a magnifier, and the cell splits in two. Bars below show the share of cells at each stage.' },
  g1: { n: 4, parts: P4, focus: 'G1', close: 'g1', shares: true, title: 'the cell cycle',
    label: 'The ring with its first stage, G1, outlined in blue and holding the largest share of cells. A thick black bar across the ring at the end of G1 marks the checkpoint. Close up, a small cell grows bigger as it moves toward a closed gate labelled checkpoint.' },
  cdk: { n: 5, parts: P5, focus: 'G1', close: 'cdk', shares: true, title: 'the cell cycle',
    label: 'The ring with G1 outlined and a small blue engine beside the checkpoint bar. Close up, blue CDK engines, each with an amber cyclin partner, push the gate open and a cell moves on toward copying.' },
  s: { n: 6, parts: P5, focus: 'S', close: 's', shares: true, title: 'the cell cycle',
    label: 'The ring with its second stage, S phase, outlined in amber. Close up, the two strands of DNA unzip at a fork, and each old strand gets a matching row of new coloured building blocks.' },
  untwist: { n: 7, parts: P5, focus: 'S', close: 'untwist', shares: true, title: 'the cell cycle',
    label: 'The ring with S phase outlined. Close up, a tightly wound stretch of DNA; then a purple clamp-shaped topoisomerase holding a cut in it; then the DNA joined up again and lying straight, untwisted.' },
  g2: { n: 8, parts: P5, focus: 'G2', close: 'g2', shares: true, title: 'the cell cycle',
    label: 'The ring with its third stage, G2, outlined in purple. Close up, a magnifier passes over the doubled DNA and finds a red break; the cell can fix it, stop, or self-destruct.' },
  m: { n: 9, parts: P5, focus: 'M', close: 'm', shares: true, title: 'the cell cycle',
    label: 'The ring with its last and shortest stage, M phase, outlined in green and holding the smallest share of cells. Close up, a cell in mitosis: doubled chromosomes lined up across the middle, green spindle ropes running to them from a pole at each end, and arrows showing the copies being pulled apart.' },
  g0: { n: 10, parts: P10, focus: 'G0', close: 'g0', shares: true, title: 'the cell cycle, and resting cells',
    label: 'Beside the ring, a dashed box labelled G0, resting, holds grey resting cells, with arrows showing cells stepping out of G1 into it and back. Close up, nerve, muscle and liver cells resting at their jobs, and one cell stepping back into the loop to heal a wound. A new bar shows the share of cells resting.' },
  whole: { n: 11, parts: P10, close: 'whole', meters: ['tumour', 'marrow'], key: true, title: 'the whole loop, and resting cells',
    label: 'The whole loop: G1, S, G2 and M around the ring with the checkpoint, and resting cells in G0 beside it. Close up, three healthy tissues that divide all the time, each circled in blue: the bone marrow inside a bone, hair roots, and the gut lining. Two bars, how many cells build up and how many new blood cells are made, are framed as the key measures.' }
};
const CHANGES = {
  cancer: { legend: 'with cancer', opt: {}, from: CC.HEALTHY, n: 12, focus: null, normal: 'healthy tissue',
    where: 'Halfway through, the checkpoint bar breaks, marked with a red cross. Fewer cells rest in G0 than in the dashed healthy normal, and a larger share sits in G1, S, G2 and M. Close up, healthy cells sit in a single neat row and stop when full, drawn again as dashed outlines on the right, while cancer cells, outlined in red, keep dividing and heap up over them.' },
  antimetabolite: { legend: 'with an antimetabolite', opt: { antimetabolite: true }, focus: 'S',
    where: 'A red bracket marks S phase. Red crosses pile up beside S phase, where cells die, and S, G2 and M hold a smaller share of the living cells. Close up, a red fake building block jams the copying fork and the rest of the new strand is left as dashed outlines.' },
  spindle: { legend: 'with a vinca alkaloid or taxane', opt: { spindle: true }, focus: 'M',
    where: 'A red bracket marks M phase. A larger share of the living cells sits in M phase than in the dashed normal, though fewer cells are alive overall, and red crosses beside it mark cells dying there. Close up, two cells in mitosis: with a vinca alkaloid the green spindle ropes stop short of the chromosomes; with a taxane the ropes reach them but are frozen, marked with small red rings, and cannot pull.' },
  alkylating: { legend: 'with an alkylating agent', opt: { alkylating: true }, focus: null,
    where: 'A red dashed circle surrounds the whole ring, and the resting box is outlined in red. Red crosses appear beside every phase and under the resting cells, most beside S and G1. Close up, red dots mark chemical groups stuck onto the DNA by one-ended agents, and red bars mark two-ended agents tying the two strands together, so they can no longer open into a copying fork, against a dashed normal fork.' },
  topo: { legend: 'with a topoisomerase inhibitor', opt: { topo: true }, focus: null,
    where: 'Red brackets mark S phase and G2. Red crosses pile up beside S and G2, where cells die. Close up, a red drug block traps the purple topoisomerase on a cut, and on the right the DNA stays broken where the dashed normal strand was joined.' },
  cdk46: { legend: 'with a CDK4/6 inhibitor', opt: { cdk46: true }, focus: 'G1',
    where: 'A red block sits on the engine beside the checkpoint. A larger share of the living cells sits in G1 than in the dashed normal, though the tumour holds fewer cells overall, while the shares in S, G2 and M shrink and no cells die. Close up, the gate stays shut, the red block sits on the engine, and cells queue up in G1 while only dashed outlines show where they would have gone on.' }
};
const ENDS = Object.fromEntries(Object.entries(CHANGES).map(([k, c]) => [k, CC.settle(c.opt)]));
function corePicture(kind) {
  const c = CORE[kind];
  const o = { ...c, parts: new Set(c.parts), markT: 0, e: 0 };
  return svg(c.label, picture(NV, o), c.meters || c.shares ? H : 460);
}
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind], e = ease(t);
  // A disease step morphs from healthy tissue to the untreated tumour; a drug step from the untreated tumour.
  const from = c.from || NV, cur = CC.lerp(from, ENDS[kind], e);
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal, ${c.normal || 'the untreated tumour'}. ${c.where} Compared with normal: ${describe(cur, from)}.`;
  const parts = new Set(c.from && e < 0.5 ? P10 : P11);
  const o = { n: c.n || 13, parts, focus: c.focus, close: kind, meters: METERS.map(m => m[0]), key: true, ghost: from, legend: c.legend, drug: c.from ? null : kind, markT: t * 3, e };
  return { pic: svg(label, picture(cur, o)), ro: readout(cur, from, 'Compared with normal') };
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
   The model's normal white cell count sits at the middle of the quoted range, and its hematocrits at the source's
   means (all read from the data file at load). The one model input here is how many new blood cells the marrow makes,
   the lesson's second key measure. No drug is applied on this tab: no source quoted here gives a direction for any
   chemotherapy class. A cited condition sets the marrow control, so the control always shows the model's input. */
let data = null;
const REF = {};
const STATE_INPUTS = { leukopenia: { marrow: 0.5 } };
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const PLACE_ARROW = { inside: '↔', above: '↑', below: '↓' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const num = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const rangeText = v => `${num(v.low)}–${num(v.high)}`;
const span = v => hasRange(v) ? [Math.max(0, v.low - (v.high - v.low)), v.high + (v.high - v.low)] : [v.typical * 0.5, v.typical * 1.5];
const barX = (v, n) => { const [a, b] = span(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const roundFor = (v, n) => v.unit === '%' ? Math.round(n) : Math.round(n / 100) * 100;
const fmt = (v, n) => v.unit === '%' ? `${num(roundFor(v, n))}%` : `${num(roundFor(v, n))} ${v.unit}`;
// Above or below is judged on the unrounded model value; only the printed number is rounded.
function placeOf(v, n) {
  if (!hasRange(v)) return n > v.typical ? 'above' : n < v.typical ? 'below' : 'inside';
  return n > v.high ? 'above' : n < v.low ? 'below' : 'inside';
}
const placeWords = (v, w) => hasRange(v) ? `${w} typical range` : w === 'inside' ? 'at the typical value' : `${w} the typical value`;
const cv = { state: 'normal', marrow: 1, custom: false };
const cvInputs = () => ({ marrow: cv.marrow });
const modelValue = v => CC.blood(cvInputs(), REF)[v.modelKey];
const marrowWords = m => m >= 0.97 ? 'as usual' : m >= 0.75 ? 'somewhat fewer' : m >= 0.5 ? 'far fewer' : 'very few';

function bloodPicture(label) {
  // The marrow making new cells, and a drop of blood: white cells drawn in proportion to the model's count.
  const m = CC.blood(cvInputs(), REF), wRel = m.wbc / REF.wbc;
  let s = `<rect x="0" y="0" width="480" height="300" fill="#fff"/>` + text(16, 24, 'bone marrow and blood (illustrative model)', 'xs b muted', 'start');
  s += `<rect x="20" y="70" width="160" height="150" rx="70" fill="#f4ead8" stroke="${INK}" stroke-width="2"/><rect x="40" y="96" width="120" height="98" rx="46" fill="#f2c9bf"/>`;
  const nDiv = Math.round(8 * cv.marrow);
  for (let i = 0; i < 8; i++) {
    const x = 66 + (i % 4) * 23, y = 126 + Math.floor(i / 4) * 34;
    s += i < nDiv ? pinched(x, y, 8, 4, 'data-marrow-cell', MARROW) : circle(x, y, 8, 'none', MUTED, 1.3, 'data-marrow-ghost stroke-dasharray="2 2"');
  }
  s += text(100, 246, 'marrow: cells dividing', 'xs b', 'middle') + arrow(190, 145, 236, 145, MUTED, 2.2) + text(212, 132, 'new', 'xs muted');
  s += `<path d="M360 50 C 420 124 440 160 440 190 A80 80 0 0 1 280 190 C280 160 300 124 360 50 Z" fill="#fbe9e6" stroke="${RED}" stroke-width="2"/>`;
  const RBC = [[300, 200], [334, 176], [368, 150], [402, 180], [420, 218], [300, 240], [340, 262], [392, 258], [428, 248], [356, 214], [384, 112], [326, 222]];
  const inDrop = ([x, y]) => [f(360 + (x - 360) * 0.82), f(190 + (y - 190) * 0.82)];
  RBC.map(inDrop).forEach(([x, y]) => { s += `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" fill="#d9524a" opacity=".8"/>`; });
  const WBC = [[318, 206], [352, 186], [386, 206], [366, 240], [404, 232], [336, 244], [372, 168], [420, 196], [310, 228], [396, 264], [350, 140], [288, 218]];
  const nW = clamp(Math.round(6 * wRel), 0, WBC.length);
  const W = WBC.map(inDrop);
  for (let i = 0; i < nW; i++) s += circle(W[i][0], W[i][1], 9, '#fff', BLUE, 2.5, 'data-blood-wbc') + circle(W[i][0], W[i][1], 3.5, BLUE);
  s += text(360, 292, 'blood: white cells are blue rings', 'xs b', 'middle');
  return svg(label, s, 300);
}
function updateClinical() {
  $('#clinical-marrow').value = cv.marrow; $('#clinical-marrow-label').textContent = marrowWords(cv.marrow);
  if (!data) { $('#clinical-visual').innerHTML = ''; return; }
  const st = data.states.find(s => s.id === cv.state);
  const made = cv.marrow >= 0.97 ? 'new cells made as usual' : `${marrowWords(cv.marrow)} new cells made than usual`;
  const label = `Illustrative model: a bone with its marrow making new blood cells (${made}${st ? `, set to ${st.label}` : ''}), and a drop of blood whose white cells, drawn as blue rings, are in proportion to the model’s white cell count. Red cells change little in this model.`;
  $('#clinical-visual').innerHTML = bloodPicture(label);
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
      const n0 = CC.blood({ marrow: 1 }, REF)[v.modelKey], rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeWords(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false;
  cv.marrow = (STATE_INPUTS[id] || {}).marrow ?? 1;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline: the marrow makes new blood cells as usual.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
$('#clinical-marrow').addEventListener('input', e => {
  cv.marrow = Number(e.target.value); cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings: the lesson model’s marrow output, set by hand.';
  updateClinical(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const st = data.states.find(s => s.id === cv.state);
    $('#cv-live').textContent = `Illustrative model${st ? `, ${st.label}` : ''}, new blood cells made: ${marrowWords(cv.marrow)}: ${data.values.map(v => { const n = modelValue(v); return `${v.label} ${fmt(v, n)}, ${placeWords(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const ex = { speed: 1, drugs: new Set(), stopHalf: false };
const EX_NAMES = { antimetabolite: 'an antimetabolite', spindle: 'a vinca alkaloid or taxane', alkylating: 'an alkylating agent', topo: 'a topoisomerase inhibitor', cdk46: 'a CDK4/6 inhibitor' };
const exploreOpts = () => { const o = { speed: ex.speed, stopHalf: ex.stopHalf }; for (const d of ex.drugs) o[d] = true; return o; };
const pct = x => `${Math.round(100 * x)}%`;
const speedWords = g => g < 0.8 ? 'slowly' : g <= 1.2 ? 'at the usual pace' : g <= 1.6 ? 'quickly' : 'very quickly';
function updateExplore() {
  $('#speed').value = ex.speed; $('#speed-label').textContent = speedWords(ex.speed);
  $('#stop-half').checked = ex.stopHalf;
  $$('#drugs input').forEach(c => { c.checked = ex.drugs.has(c.value); });
  const opt = exploreOpts(), cur = CC.settle(opt), runs = CC.run(opt);
  const base = CC.settle({ speed: ex.speed }), ghostRun = ex.speed === 1 ? CC.BASE : CC.run({ speed: ex.speed });
  const names = CC.DRUGS.filter(d => ex.drugs.has(d)).map(d => EX_NAMES[d]);
  const who = `a tumour whose cells divide ${speedWords(ex.speed)}${names.length ? `, treated with ${names.join(', ')}` : ', untreated'}${names.length && ex.stopHalf ? ', with the drug stopped halfway' : ''}`;
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated tumour of the same speed. The ring shows what share of the living cells sits in each phase and red crosses show where cells died; the lower panel plots tumour size and new blood cells over time. Compared with untreated: ${describe(cur, base)}.`;
  const o = { n: 99, parts: new Set(P11), focus: null, close: 'graph', meters: METERS.map(m => m[0]), key: true, ghost: base, legend: 'your settings', markT: 0, e: 0,
    series: { tum: runs.tum.series, mar: runs.mar.series }, ghostSeries: { tum: ghostRun.tum.series } };
  $('#explore-visual').innerHTML = svg(label, picture(cur, o)) + readout(cur, base, 'Compared with untreated');
  const res = $('#model-results');
  res.textContent = `Illustrative model output, compared with the untreated run: tumour size ${pct(cur.tumour)} · new blood cells made ${pct(cur.marrow)} · share of living tumour cells in G1 ${pct(cur.shG1)}, in mitosis ${pct(cur.shM)}, resting ${pct(cur.shG0)}.`;
  for (const k of CC.KEYS) res.dataset[k.toLowerCase()] = cur[k].toFixed(4);
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
$('#speed').addEventListener('input', e => { ex.speed = Number(e.target.value); updateExplore(); });
$('#stop-half').addEventListener('change', e => { ex.stopHalf = e.target.checked; updateExplore(); });
$('#reset').addEventListener('click', () => { ex.speed = 1; ex.stopHalf = false; ex.drugs.clear(); updateExplore(); });

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!['wbc', 'hctF', 'hctM'].every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    if (!['hctF', 'hctM'].every(k => Number.isFinite(byKey(k).typical))) throw new Error('Invalid reference data');
    data = loaded;
    REF.wbc = (byKey('wbc').low + byKey('wbc').high) / 2;
    REF.hctF = byKey('hctF').typical; REF.hctM = byKey('hctM').typical;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal white cell count in the middle of its band and each hematocrit at the source’s mean, so every baseline sits inside its band. The large number in each row is the model’s level turned into the row’s unit: an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. In the model, the white cell count follows how many new blood cells the marrow makes, while the red cell share changes little; how strongly each follows is an illustrative choice. Only a cited direction is sourced.';
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
      const typ = Number.isFinite(v.typical) ? `<path class="typical" d="M${pos(v.typical)} 12 V34"/>` : '';
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}${edges}<text x="20" y="58" class="end">← lower</text><text x="380" y="58" text-anchor="end" class="end">higher →</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: the source range ${rangeText(v)} ${v.unit} as a shaded band${Number.isFinite(v.typical) ? `, a thin tick at the source’s mean of ${num(v.typical)}` : ''}, a solid marker for where the illustrative model sits and, when a condition is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = `Source range ${rangeText(v)} ${v.unit} (shaded)${Number.isFinite(v.typical) ? `, mean ${num(v.typical)} (tick)` : ''} · blue line: illustrative teaching-model value`;
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
