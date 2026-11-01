'use strict';
const BM = window.BCModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NV = BM.NORMAL;

/* ---------- Drawing helpers ---------- */
const INK = '#171916', BLUE = '#254dff', AMBER = '#a34700', RED = '#b3261e', MUTED = '#53584d', RULE = '#babeb3';
const CYTO = '#fbf5e8', RIBO_L = '#d8cfb8', RIBO_S = '#e6dfcc';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const H = 620;
const svg = (label, body, h = H) => `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
const line = (x1, y1, x2, y2, col, w, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
function arrow(x1, y1, x2, y2, col, w = 2.5, extra = '') {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 5 + w * 1.6;
  const p = (d, r) => `${f(x2 - s * Math.cos(a + r))} ${f(y2 - s * Math.sin(a + r))}`;
  return `<g ${extra}>${line(x1, y1, x2 - Math.cos(a) * s * 0.6, y2 - Math.sin(a) * s * 0.6, col, w)}<path d="M${f(x2)} ${f(y2)} L${p(0, 0.5)} L${p(0, -0.5)} Z" fill="${col}"/></g>`;
}
// A closed or cut loop, like a coiled DNA ring.
function loopPath(cx, cy, rx, ry, k, amp, gapAt = 0, gapW = 0) {
  const pts = [], n = 160;
  for (let i = 0; i <= n; i++) {
    const th = gapAt + gapW / 2 + (2 * Math.PI - gapW) * i / n;
    const r = 1 + amp * Math.sin(k * th);
    pts.push(`${f(cx + rx * r * Math.cos(th))} ${f(cy + ry * r * Math.sin(th))}`);
  }
  return `M${pts.join(' L')}${gapW > 0 ? '' : ' Z'}`;
}
const capsule = (cx, cy, w, h, extra) => `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" ${extra}/>`;
const wedge = (x, y, extra) => `<path ${extra} d="M${f(x - 9)} ${f(y - 12)} L${f(x + 9)} ${f(y - 12)} L${f(x)} ${f(y + 8)} Z" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`;
const block = (x, y, w, h, extra) => `<rect ${extra} x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`;

/* ---------- The overview: one bacterium, cut open ---------- */
const CX = 240, CY = 140;
const ring = (inset, extra) => `<rect x="${75 + inset}" y="${68 + inset}" width="${330 - 2 * inset}" height="${144 - 2 * inset}" rx="${72 - inset}" ${extra}/>`;
function overview(cur, o) {
  const sh = o.parts;
  let b = '';
  const swell = sh.has('wall') ? 1 + 0.1 * (1 - cur.wall) : 1;
  b += `<g data-cell transform="translate(${CX} ${CY}) scale(${swell.toFixed(3)}) translate(${-CX} ${-CY})">`;
  b += ring(0, `fill="${CYTO}"`);
  if (sh.has('wall')) {
    const w = o.gram === 'positive' ? 15 : o.gram === 'negative' ? 6 : 11;
    if (o.gram === 'negative') b += ring(-8, `fill="none" stroke="${INK}" stroke-width="2.5" data-outer`);
    const gap = (1 - cur.wall) * 16;
    b += ring(0, `fill="none" stroke="${AMBER}" stroke-width="${w}" data-wall-ring ${gap > 0.3 ? `stroke-dasharray="${f(6 + 26 * cur.wall)} ${f(gap)}"` : ''}`);
  }
  b += ring(sh.has('wall') ? 10 : 0, `fill="none" stroke="${INK}" stroke-width="2.5"${sh.has('membrane') ? ' data-membrane' : ''}`);
  if (!sh.has('dna')) for (let i = 0; i < 26; i++) b += `<circle cx="${118 + (i * 61) % 244}" cy="${94 + (i * 37) % 92}" r="${2 + (i % 3)}" fill="${MUTED}" opacity="0.35"/>`;
  if (sh.has('dna')) {
    const cut = o.dnaCut && cur.dna < 0.98;
    b += `<path data-dna-loop d="${loopPath(165, 140, 52, 38, 7, 0.13)}" fill="none" stroke="${BLUE}" stroke-width="3" ${cut ? `stroke-dasharray="${f(8 + 40 * cur.dna)} ${f(16 * (1 - cur.dna))}"` : ''}/>`;
  }
  if (sh.has('ribosome')) {
    for (const [x, y] of [[300, 106], [342, 140], [300, 174]]) {
      b += `<g data-ribosome><ellipse cx="${x}" cy="${y + 5}" rx="10" ry="6" fill="${RIBO_S}" stroke="${INK}" stroke-width="1.5"/><ellipse cx="${x}" cy="${y - 4}" rx="13" ry="8" fill="${RIBO_L}" stroke="${INK}" stroke-width="1.5"/>`;
      const n = 4 * cur.proteins;
      for (let k = 0; k < Math.ceil(n - 0.01); k++) {
        const op = clamp(n - k, 0, 1);
        b += o.faulty ? `<circle cx="${x + 14 + k * 7}" cy="${y - 12 - k * 3}" r="3" fill="#fff" stroke="${RED}" stroke-width="1.6" opacity="${op.toFixed(2)}"/>`
          : `<circle cx="${x + 14 + k * 7}" cy="${y - 12 - k * 3}" r="3" fill="${MUTED}" opacity="${op.toFixed(2)}"/>`;
      }
      b += '</g>';
    }
  }
  if (sh.has('folate')) {
    b += `<g data-folate-mini>${line(222, 190, 270, 190, MUTED, 1.6)}<circle cx="222" cy="190" r="3.5" fill="${MUTED}"/><circle cx="246" cy="190" r="3.5" fill="${MUTED}"/><circle cx="270" cy="190" r="${f(2 + 4 * cur.folate)}" fill="${INK}"/></g>`;
  }
  if (sh.has('divide')) {
    b += `<g data-pinch><path d="M226 62 L240 84 L254 62 Z" fill="${AMBER}"/><path d="M226 218 L240 196 L254 218 Z" fill="${AMBER}"/>${line(240, 88, 240, 192, MUTED, 1.6, 'stroke-dasharray="5 5"')}</g>`;
  }
  if (sh.has('wall') && cur.wall < 0.6) {
    const op = clamp((0.6 - cur.wall) * 2.5, 0, 1).toFixed(2);
    b += `<g data-leak opacity="${op}"><circle cx="300" cy="52" r="5" fill="${BLUE}"/><circle cx="54" cy="140" r="5" fill="${BLUE}"/><circle cx="428" cy="172" r="4" fill="${BLUE}"/></g>`;
  }
  b += '</g>';
  // Labels for the parts met so far.
  if (!sh.has('membrane')) b += text(240, 50, 'a bacterium', 'b');
  if (sh.has('wall')) b += text(76, 50, 'cell wall', 'sm b amber', 'start') + line(112, 56, 122, 70, AMBER, 1.6);
  if (sh.has('membrane')) b += text(76, 242, 'cell membrane', 'sm', 'start') + line(110, 228, 120, 206, INK, 1.4);
  if (sh.has('dna')) b += text(165, 146, 'DNA', 'sm b blue');
  if (sh.has('ribosome')) b += text(404, 242, 'ribosomes', 'sm', 'end') + line(362, 228, 316, 188, INK, 1.4);
  if (sh.has('folate')) b += text(250, 242, 'folate line', 'sm');
  return b;
}

/* ---------- Close-ups ---------- */
const PANEL = (title) => `<rect x="12" y="252" width="456" height="190" fill="#fff" stroke="${RULE}"/>${text(26, 276, title, 'xs b muted', 'start')}`;
function bricks(x0, x1, y, h = 10, w = 30, gap = 4) {
  let s = '';
  for (let x = x0; x + w <= x1; x += w + gap) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${AMBER}"/>`;
  return s;
}
const bridgeOp = (wall, i, row) => clamp((wall - (((i * 7 + row * 3) % 10) / 10 * 0.85 + 0.08)) / 0.1 + 0.5, 0, 1);
function bridges(x0, x1, rows, h, wall, ghost, w = 30, gap = 4) {
  let s = '', g = '';
  for (let r = 0; r < rows.length - 1; r++) {
    let i = 0;
    for (let x = x0 + (r % 2 ? w : w / 2); x <= x1 - 6; x += (w + gap) * 1.5, i++) {
      const y1 = rows[r] + h, y2 = rows[r + 1];
      if (ghost) g += line(x, y1, x, y2, MUTED, 1.5, 'stroke-dasharray="2 3" data-ghost-bridge');
      const op = bridgeOp(wall, i, r);
      if (op > 0.01) s += line(x, y1, x, y2, INK, 3.5, `data-bridge opacity="${op.toFixed(2)}"`);
    }
  }
  return g + s;
}
function closeScale() {
  return PANEL('to scale') + `<g data-human><circle cx="150" cy="350" r="60" fill="${CYTO}" stroke="${INK}" stroke-width="2"/><circle cx="160" cy="342" r="22" fill="#e9dec4" stroke="${MUTED}" stroke-width="1.5"/></g>`
    + text(150, 432, 'one of your cells', 'sm') + capsule(340, 350, 24, 10, `fill="${CYTO}" stroke="${INK}" stroke-width="1.6" data-tiny`)
    + text(340, 384, 'a bacterium', 'sm b') + arrow(340, 368, 340, 360, INK, 1.6);
}
function closeMembrane() {
  let s = PANEL('close up: the cell membrane') + text(240, 302, 'outside', 'xs muted');
  s += `<g data-membrane-strip>${line(30, 330, 222, 330, INK, 3)}${line(30, 340, 222, 340, INK, 3)}${line(258, 330, 450, 330, INK, 3)}${line(258, 340, 450, 340, INK, 3)}<rect x="226" y="324" width="8" height="22" fill="${MUTED}"/><rect x="246" y="324" width="8" height="22" fill="${MUTED}"/></g>`;
  s += arrow(212, 296, 236, 352, INK, 2) + text(196, 312, 'food in', 'xs', 'end') + arrow(244, 352, 270, 300, INK, 2) + text(282, 312, 'waste out', 'xs', 'start');
  for (let i = 0; i < 22; i++) s += `<circle cx="${40 + (i * 53) % 400}" cy="${366 + (i * 17) % 50}" r="3" fill="${BLUE}" opacity="0.45"/>`;
  return s + text(240, 432, 'inside: watery, packed with parts', 'xs muted');
}
function closeWall(cur, ghost) {
  const rows = [292, 314, 336, 358];
  let s = PANEL('close up: the wall, a woven net');
  s += bridges(30, 450, rows, 10, cur.wall, ghost) + rows.map(y => bricks(30, 450, y)).join('');
  s += `${line(30, 386, 450, 386, INK, 3)}${line(30, 394, 450, 394, INK, 3)}` + text(450, 382, 'membrane', 'xs muted', 'end');
  for (const x of [100, 240, 380]) s += arrow(x, 424, x, 402, BLUE, 2.5);
  return s + text(240, 436, 'water presses out on the wall', 'xs blue');
}
function closeBuild(cur, o) {
  const rows = [292, 314, 336], ghost = !!o.ghost;
  let s = PANEL('close up: building the wall');
  s += bridges(30, 300, rows, 10, cur.wall, ghost) + rows.map(y => bricks(30, 300, y)).join('');
  // A new brick with its two-part tip, on its way in.
  s += `<g data-new-brick><rect x="336" y="314" width="34" height="10" rx="3" fill="${AMBER}"/><circle cx="376" cy="319" r="4" fill="${INK}"/><circle cx="386" cy="319" r="4" fill="${INK}"/></g>` + arrow(330, 319, 308, 319, MUTED, 2);
  s += text(366, 304, 'new brick, two-part tip', 'xs', 'middle');
  s += `${line(30, 362, 450, 362, INK, 3)}${line(30, 370, 450, 370, INK, 3)}`;
  for (const x of [170, 370]) s += `<rect data-enzyme x="${x - 30}" y="348" width="60" height="22" rx="11" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  s += text(240, 396, 'wall-building enzymes', 'xs b');
  const op = clamp(o.markT, 0, 1).toFixed(2);
  if (o.drug === 'betalactam') {
    s += `<g opacity="${op}">${wedge(170, 352, 'data-drug="betalactam"')}${wedge(370, 352, 'data-drug="betalactam"')}</g>` + text(240, 428, 'beta-lactam jammed in each enzyme', 'xs red b');
  }
  if (o.drug === 'vancomycin') {
    const clamps = [[381, 319], [303, 297], [303, 341]];
    s += `<g opacity="${op}">${clamps.map(([x, y]) => `<path data-drug="vancomycin" d="M${x - 12} ${y + 9} A 13 13 0 1 1 ${x + 12} ${y + 9}" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>`;
    s += text(240, 418, 'vancomycin covers each brick tip', 'xs red b') + text(240, 436, 'too big to pass an outer membrane', 'xs red');
  }
  return s;
}
function closeGram() {
  let s = PANEL('close up: two kinds of wall');
  s += `<g data-gram="positive">${text(127, 300, 'gram-positive', 'sm b')}${[312, 324, 336, 348].map(y => bricks(36, 220, y, 9, 26, 3)).join('')}${line(36, 368, 220, 368, INK, 3)}${line(36, 376, 220, 376, INK, 3)}</g>`;
  s += text(127, 404, 'thick wall outside', 'xs') + text(127, 424, 'stays purple', 'xs muted');
  s += line(240, 290, 240, 430, RULE, 1);
  s += `<g data-gram="negative">${text(352, 300, 'gram-negative', 'sm b')}${line(262, 316, 444, 316, INK, 3)}${line(262, 324, 444, 324, INK, 3)}${bricks(262, 446, 342, 9, 26, 3)}${line(262, 368, 444, 368, INK, 3)}${line(262, 376, 444, 376, INK, 3)}</g>`;
  return s + text(352, 404, 'outer membrane, then', 'xs') + text(352, 424, 'a thin wall', 'xs');
}
function closeDna() {
  return PANEL('close up: one loop of DNA, coiled tight') + `<path data-dna-big d="${loopPath(240, 360, 160, 58, 16, 0.16)}" fill="none" stroke="${BLUE}" stroke-width="3"/>` + text(240, 366, 'instructions for every part', 'xs blue b');
}
function closeCopy(cur, o) {
  let s = PANEL('close up: untangling enzymes at work');
  const gapW = 0.12 + (o.drug === 'fluoroquinolone' ? 0.5 * (1 - cur.dna) : 0);
  s += `<path data-dna-big d="${loopPath(170, 360, 120, 58, 9, 0.1, 0, gapW)}" fill="none" stroke="${BLUE}" stroke-width="3.5"/>`;
  // The copy being made runs round part of the loop; how far depends on copying.
  const arc = (frac, extra, col, w) => { const pts = []; for (let i = 0; i <= 60; i++) { const th = Math.PI * 0.55 + Math.PI * 1.3 * frac * i / 60; const r = 0.8 * (1 + 0.1 * Math.sin(9 * th)); pts.push(`${f(170 + 120 * r * Math.cos(th))} ${f(360 + 58 * r * Math.sin(th))}`); } return `<path ${extra} d="M${pts.join(' L')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  if (o.ghost) s += arc(1, 'data-ghost-copy stroke-dasharray="3 4"', MUTED, 2);
  if (cur.dna > 0.02) s += arc(cur.dna, 'data-copy', '#7d93ff', 3);
  s += `<rect data-enzyme x="270" y="342" width="44" height="36" rx="10" fill="#fff" stroke="${INK}" stroke-width="2.4"/>`;
  s += text(312, 312, 'untangling enzyme:', 'xs b', 'start') + text(312, 330, 'cut, pass, seal', 'xs', 'start');
  s += text(170, 368, 'copy being made', 'xs blue');
  if (o.drug === 'fluoroquinolone') {
    s += `<g opacity="${clamp(o.markT, 0, 1).toFixed(2)}">${wedge(292, 352, 'data-drug="fluoroquinolone"')}</g>` + text(326, 412, 'jammed: the cut', 'xs red b', 'start') + text(326, 430, 'is never sealed', 'xs red b', 'start');
  }
  return s;
}
function closeRibosome(cur, o) {
  let s = PANEL('close up: a ribosome making a protein');
  s += line(30, 412, 450, 412, MUTED, 3);
  for (let x = 40; x < 450; x += 12) s += line(x, 406, x, 412, MUTED, 2);
  s += text(450, 434, 'copied instruction', 'xs muted', 'end');
  s += `<ellipse data-small-part cx="210" cy="394" rx="62" ry="18" fill="${RIBO_S}" stroke="${INK}" stroke-width="2"/><ellipse data-large-part cx="210" cy="352" rx="76" ry="30" fill="${RIBO_L}" stroke="${INK}" stroke-width="2"/>`;
  s += text(296, 356, 'large part', 'xs', 'start') + text(282, 394, 'small part', 'xs', 'start');
  // Building blocks waiting to dock.
  for (const [x, y] of [[54, 358], [78, 372], [64, 384]]) s += `<rect x="${x}" y="${y}" width="9" height="9" fill="${MUTED}"/>`;
  s += text(68, 346, 'building blocks', 'xs muted') + arrow(92, 378, 136, 384, MUTED, 1.6);
  // The protein chain leaving the large part.
  const bead = k => [236 + 13 * k, 318 - 5 * k];
  if (o.ghost) for (let k = 0; k < 8; k++) { const [x, y] = bead(k); s += `<circle data-ghost-bead cx="${x}" cy="${y}" r="6" fill="none" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="2 2"/>`; }
  const faulty = o.drug === 'aminoglycoside';
  const n = faulty ? 8 : 8 * cur.proteins;
  const bad = faulty ? Math.round(8 * (1 - cur.proteins)) : 0;
  for (let k = 0; k < Math.ceil(n - 0.01); k++) {
    const [x, y] = bead(k), op = clamp(n - k, 0, 1).toFixed(2), wrong = k >= 8 - bad;
    s += wrong ? `<circle data-bead data-faulty cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${RED}" stroke-width="2.4" opacity="${op}"/>`
      : `<circle data-bead cx="${x}" cy="${y}" r="6" fill="${MUTED}" opacity="${op}"/>`;
  }
  s += text(352, 300, faulty ? 'faulty protein chain' : 'protein chain', `xs b${faulty ? ' red' : ''}`, 'start');
  const op = clamp(o.markT, 0, 1).toFixed(2);
  if (faulty) s += `<g opacity="${op}">${block(176, 394, 22, 14, 'data-drug="aminoglycoside"')}</g>` + text(150, 436, 'aminoglycoside grips the small part', 'xs red b');
  if (o.drug === 'macrolide') {
    s += `<g opacity="${op}">${block(232, 330, 20, 16, 'data-drug="macrolide"')}${block(150, 392, 20, 14, 'data-drug="tetracycline"')}</g>`;
    s += text(32, 296, 'macrolide: exit blocked', 'xs red b', 'start') + text(32, 436, 'tetracycline: docking blocked', 'xs red b', 'start');
  }
  return s;
}
function closeFolate(cur, o) {
  let s = PANEL('close up: the folate assembly line');
  const y = 350, xs = [50, 178, 306, 420];
  s += arrow(62, y, 160, y, MUTED, 2.5) + arrow(190, y, 288, y, MUTED, 2.5) + arrow(318 + 8 * cur.folate, y, 402, y, MUTED, 2.5);
  s += `<circle cx="${xs[0]}" cy="${y}" r="9" fill="${MUTED}"/><circle cx="${xs[1]}" cy="${y}" r="9" fill="${MUTED}" opacity="${(0.25 + 0.75 * cur.folate).toFixed(2)}"/>`;
  if (o.ghost) s += `<circle data-ghost-folate cx="${xs[2]}" cy="${y}" r="16" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  s += `<circle data-folate-dot cx="${xs[2]}" cy="${y}" r="${f(3 + 13 * cur.folate)}" fill="${INK}"/>`;
  const letters = Math.round(5 * cur.folate);
  for (let i = 0; i < 5; i++) s += `<rect ${i < letters ? 'data-letter' : ''} x="${408 + (i % 3) * 10}" y="${y - 12 + Math.floor(i / 3) * 14}" width="8" height="10" fill="${i < letters ? BLUE : 'none'}" stroke="${BLUE}" stroke-width="1" ${i < letters ? '' : 'stroke-dasharray="2 2"'}/>`;
  for (const x of [111, 239]) s += `<rect data-enzyme x="${x - 32}" y="${y + 18}" width="64" height="26" rx="13" fill="#fff" stroke="${INK}" stroke-width="2"/>` + text(x, y + 36, 'enzyme', 'xs');
  s += text(xs[0], 326, 'raw material', 'xs', 'start') + text(xs[2], 324, 'folate', 'sm b') + text(436, 324, 'DNA letters', 'xs blue b', 'end');
  const op = clamp(o.markT, 0, 1).toFixed(2);
  if (o.drug === 'sulfa') {
    s += `<g opacity="${op}">${block(111, y + 31, 30, 18, 'data-drug="sulfonamide"')}${block(239, y + 31, 30, 18, 'data-drug="trimethoprim"')}</g>`;
    s += text(111, 418, 'sulfonamide', 'xs red b') + text(239, 418, 'trimethoprim', 'xs red b') + text(240, 436, 'two blocks on one line', 'xs red');
  }
  return s;
}
function closeDivide() {
  let s = PANEL('close up: one becomes two, then four…') + text(30, 300, 'time ↓', 'xs b', 'start');
  [1, 2, 4, 8].forEach((n, r) => { for (let i = 0; i < n; i++) s += capsule(240 + (i - (n - 1) / 2) * 34, 304 + r * 34, 26, 11, `data-pop="${r}" fill="${CYTO}" stroke="${AMBER}" stroke-width="2.5"`); });
  return s + text(240, 436, 'numbers double and double', 'xs b');
}
function closeWhole() {
  let s = PANEL('where antibiotics can strike');
  const items = [[126, 316, 'the wall', AMBER], [354, 316, 'ribosomes', MUTED], [126, 396, 'DNA untangling', BLUE], [354, 396, 'folate line', INK]];
  for (const [x, y, label, col] of items) s += `<g data-target><circle cx="${x - 70}" cy="${y - 5}" r="13" fill="none" stroke="${RED}" stroke-width="2.5"/><circle cx="${x - 70}" cy="${y - 5}" r="5" fill="${col}"/></g>` + text(x - 50, y, label, 'sm b', 'start');
  return s + text(240, 436, 'parts your cells lack or build differently', 'xs muted');
}
function closeGraph(o) {
  let s = PANEL('bacteria over time (illustrative model)');
  const X = i => 56 + 392 * i / BM.STEPS, Y = n => 414 - 118 * n;
  s += line(56, 292, 56, 414, INK, 1.5) + line(56, 414, 450, 414, INK, 1.5);
  s += text(450, 434, 'time →', 'xs', 'end') + `<text transform="rotate(-90 36 354)" x="36" y="354" text-anchor="middle" class="xs">bacteria →</text>`;
  const pts = arr => arr.map((n, i) => `${f(X(i))} ${f(Y(n))}`).join(' L');
  s += `<path data-ghost-curve d="M${pts(o.ghostCurve)}" fill="none" stroke="${MUTED}" stroke-width="2" stroke-dasharray="6 5"/>`;
  if (o.drugsOn) s += line(X(BM.START), 296, X(BM.START), 414, RED, 1.5, 'stroke-dasharray="3 3"') + text(X(BM.START) + 6, 304, 'drugs start', 'xs red b', 'start');
  return s + `<path data-curve d="M${pts(o.curve)}" fill="none" stroke="${BLUE}" stroke-width="3.2"/>`;
}

/* ---------- Meters: how each part is doing ---------- */
const METERS = [['wall', ['wall', 'strength'], AMBER], ['proteins', ['proteins'], MUTED], ['dna', ['DNA', 'copying'], BLUE], ['folate', ['folate'], INK], ['growth', ['growth'], INK], ['alive', ['bacteria', 'alive'], INK]];
const MX = i => 44 + i * 76, BASE_Y = 572, meterH = v => clamp(64 * v, 0, 84);
function meters(cur, o) {
  let s = line(12, 452, 468, 452, RULE, 1);
  if (!o.meters.length) return s + text(240, 530, 'each part gets a gauge here as you meet it', 'xs muted');
  s += text(12, 474, o.key ? 'how each part is doing' : 'taller bar: the part works better', 'xs b muted', 'start');
  if (o.key) s += `<rect data-key-measure x="${MX(4) - 38}" y="482" width="${MX(5) - MX(4) + 76}" height="134" fill="none" stroke="${BLUE}" stroke-width="2"/>` + text((MX(4) + MX(5)) / 2, 474, 'key measures', 'xs b blue');
  METERS.forEach(([k, words, col], i) => {
    if (!o.meters.includes(k)) return;
    const x = MX(i), h = meterH(cur[k]);
    s += line(x - 24, BASE_Y, x + 24, BASE_Y, INK, 1.5);
    if (o.ghost) s += `<rect data-ghost-meter="${k}" x="${x - 17}" y="${f(BASE_Y - meterH(o.ghost[k]))}" width="34" height="${f(meterH(o.ghost[k]))}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<rect data-meter="${k}" x="${x - 13}" y="${f(BASE_Y - h)}" width="26" height="${f(h)}" fill="${col}"/>`;
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
    case 'scale': close = closeScale(); break;
    case 'membrane': close = closeMembrane(); break;
    case 'wall': close = closeWall(cur, !!o.ghost); break;
    case 'build': close = closeBuild(cur, o); break;
    case 'gram': close = closeGram(); break;
    case 'dna': close = closeDna(); break;
    case 'copy': close = closeCopy(cur, o); break;
    case 'ribosome': close = closeRibosome(cur, o); break;
    case 'folate': close = closeFolate(cur, o); break;
    case 'divide': close = closeDivide(); break;
    case 'graph': close = closeGraph(o); break;
    default: close = closeWhole();
  }
  const ghostAttrs = o.ghost ? `<g data-ghost="normal" ${attrs(o.ghost)}>${o.parts.has('wall') && cur.wall < 0.99 ? ring(0, `fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="5 4"`) : ''}</g>` : '';
  return header(o) + ghostAttrs + `<g data-new-state ${attrs(cur)}>` + overview(cur, o) + close + meters(cur, o) + '</g>';
}
const attrs = v => BM.KEYS.map(k => `data-${k}="${v[k].toFixed(4)}"`).join(' ');

/* ---------- Words for changes ---------- */
const ROWS = [['wall', 'Wall strength', 'stronger', 'weaker'], ['proteins', 'Working proteins', 'more', 'fewer'], ['dna', 'DNA copying', 'more', 'less'], ['folate', 'Folate made', 'more', 'less'], ['growth', 'Growth', 'faster', 'slower'], ['alive', 'Bacteria alive', 'more', 'fewer']];
function more(a, b, up, down) {
  if (Math.abs(a - b) < 0.03 * Math.max(b, 0.05)) return ['about the same', 'same'];
  return a > b ? [up, 'up'] : [down, 'down'];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => [name, more(v[k], ref[k], up, down)]);
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (v, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(v, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (v, ref) => compare(v, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- Lesson steps ---------- */
const P1 = [], P2 = ['membrane'], P3 = [...P2, 'wall'], P6 = [...P3, 'dna'], P8 = [...P6, 'ribosome'], P9 = [...P8, 'folate'];
const M_ALL = METERS.map(m => m[0]);
const CORE = {
  cell: { parts: P1, focus: 'scale', meters: [], title: 'a bacterium, beside one of your cells',
    label: 'A single bacterium drawn as a rounded rod. Below, to scale, one of your own cells is a large round cell with a nucleus, and a bacterium is a tiny rod beside it.' },
  membrane: { parts: P2, focus: 'membrane', meters: [], title: 'a bacterium, cut open',
    label: 'The bacterium with its cell membrane outlined. Close up, the membrane is a thin double layer with the outside above and the watery inside below; a small gate lets food in and waste out.' },
  wall: { parts: P3, focus: 'wall', meters: ['wall'], title: 'a bacterium, cut open',
    label: 'A thick cell wall now surrounds the membrane. Close up, the wall is rows of sugar-chain bricks tied together by short bridges, sitting on the membrane, with water pressing out on it from inside. A new bar gauge, labelled wall strength, shows how well the wall holds against that pressure: the taller the bar, the stronger the wall. Here it stands at its normal, full height.' },
  build: { parts: P3, focus: 'build', meters: ['wall'], title: 'a bacterium, cut open',
    label: 'Close up of wall building: a new brick with a two-part tip moves in toward the net of bricks, and wall-building enzymes on the membrane tie it in with new bridges.' },
  gram: { parts: P3, focus: 'gram', meters: ['wall'], title: 'a bacterium, cut open',
    label: 'Two kinds of wall side by side. Gram-positive: many rows of bricks, a thick wall on the outside, over the membrane. Gram-negative: an outer membrane, then a single thin row of wall, then the membrane.' },
  dna: { parts: P6, focus: 'dna', meters: ['wall'], title: 'a bacterium, cut open',
    label: 'A coiled loop of DNA now floats inside the bacterium, with no nucleus around it. Close up, the loop is wound into many tight coils: the instructions for every part.' },
  copy: { parts: P6, focus: 'copy', meters: ['wall', 'dna'], title: 'a bacterium, cut open',
    label: 'Close up, a copy of the DNA loop is being made around the inside of the loop. An untangling enzyme sits on the loop where it cuts, passes a strand through and seals it. A new gauge shows DNA copying running.' },
  ribosome: { parts: P8, focus: 'ribosome', meters: ['wall', 'proteins', 'dna'], title: 'a bacterium, cut open',
    label: 'Ribosomes now sit inside the bacterium. Close up, a ribosome has a small part on a copied instruction strand and a large part above it; building blocks dock and a chain of beads, the protein, leaves the large part. A proteins gauge appears.' },
  folate: { parts: P9, focus: 'folate', meters: ['wall', 'proteins', 'dna', 'folate'], title: 'a bacterium, cut open',
    label: 'Close up of the folate assembly line: raw material passes two enzymes, one per step, to become folate, which is then used to make DNA letters. A folate gauge appears.' },
  divide: { parts: [...P9, 'divide'], focus: 'divide', meters: M_ALL, title: 'a bacterium, pinching in two',
    label: 'The bacterium pinches in the middle to split in two. Close up, one bacterium becomes two, then four, then eight down the page as time passes. Gauges for growth and for bacteria alive appear.' },
  whole: { parts: P9, focus: 'whole', meters: M_ALL, key: true, title: 'the whole bacterium',
    label: 'The whole bacterium with its wall, membrane, DNA loop, ribosomes and folate line. Four targets are marked: the wall, the ribosomes, DNA untangling and the folate line. The growth and bacteria alive gauges are framed as the key measures.' }
};
const CHANGES = {
  betalactam: { focus: 'build', legend: 'with a beta-lactam', where: 'Close up, red wedges jam both wall-building enzymes and the bridges between the bricks fade away; the cell swells and water leaks out.' },
  vancomycin: { focus: 'build', legend: 'with vancomycin', where: 'Close up, red clamps cover the two-part tips of the new bricks, so no new bridges form and the wall breaks up; a note says vancomycin is too big to pass an outer membrane.' },
  aminoglycoside: { focus: 'ribosome', legend: 'with an aminoglycoside', faulty: true, where: 'Close up, a red block grips the ribosome’s small part and most beads of the protein chain turn into red-ringed faulty ones.' },
  macrolide: { focus: 'ribosome', legend: 'with a macrolide or tetracycline', where: 'Close up, one red block sits in the large part’s exit, a macrolide, and another on the small part’s docking site, a tetracycline; the protein chain shrinks to a stub.' },
  fluoroquinolone: { focus: 'copy', legend: 'with a fluoroquinolone', dnaCut: true, where: 'Close up, a red wedge jams the untangling enzyme, the cut in the DNA loop gapes open and the copy stops early; in the cell above the DNA loop breaks into pieces.' },
  sulfa: { focus: 'folate', legend: 'with sulfonamide and trimethoprim', where: 'Close up, red blocks sit on both enzymes of the folate line, the folate dot shrinks and the DNA letters are no longer made.' }
};
const ENDS = Object.fromEntries(Object.keys(CHANGES).map(k => [k, BM.settle({ drugs: [k] })]));
function corePicture(kind) {
  const c = CORE[kind];
  return svg(c.label, picture(NV, { ...c, parts: new Set(c.parts), markT: 0 }));
}
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const cur = BM.lerp(NV, ENDS[kind], ease(t));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal, the untreated bacterium. ${c.where} Compared with normal: ${describe(cur, NV)}.`;
  const o = { parts: new Set(P9), focus: c.focus, meters: M_ALL, key: true, ghost: NV, legend: c.legend, drug: kind, markT: t * 3, faulty: !!c.faulty, dnaCut: !!c.dnaCut };
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
   The model's normal sits at the middle of each quoted range (read from the data file at load). Conditions are
   applied as model inputs, and the picture and every row read the same model output. */
let data = null;
const REF = {};
const DRUG_LABEL = { betalactam: 'a beta-lactam', vancomycin: 'vancomycin', aminoglycoside: 'an aminoglycoside', macrolide: 'a macrolide or tetracycline', fluoroquinolone: 'a fluoroquinolone', sulfa: 'a sulfonamide with trimethoprim' };
const STATE_INPUTS = { bacterial: { bacteria: 1 }, viral: { virus: 1 }, leukocytosis: { wbcMul: 1.8 }, leukopenia: { wbcMul: 0.5 } };
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
const cv = { state: 'normal', extra: {}, bacteria: 0, drug: '', custom: false };
const drugs = () => cv.drug ? [cv.drug] : [];
// The picture and every gauge come from one model output (cvInputs). The dashed comparison marker is the same
// model without the chosen condition. Cited directions are shown as words beside it, never mixed into the model.
const normalInputs = () => ({ bacteria: cv.bacteria, drugs: drugs() });
const cvInputs = () => ({ ...cv.extra, bacteria: cv.bacteria + (cv.extra.bacteria || 0), drugs: drugs() });
const modelValue = v => BM.blood(cvInputs(), REF)[v.modelKey];
const bacteriaWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'a few' : v <= 1.2 ? 'an infection' : 'a heavy infection';

function bloodPicture(m, label) {
  // An illustrative drop of blood: white cells in proportion to the model, and the bacteria it carries.
  let s = `<rect x="0" y="0" width="480" height="300" fill="#fbf1ef"/>` + text(16, 26, 'a drop of blood (illustrative model)', 'xs b muted', 'start');
  const per = 18, nN = Math.round(per * m.relN), nL = Math.round(per * m.relL), nO = Math.round(per * m.relO);
  const scale = m.total / (m.relN + m.relL + m.relO);
  const shown = Math.min(Math.round((nN + nL + nO) * scale), 48);
  const kinds = [...Array(nN).fill('n'), ...Array(nL).fill('l'), ...Array(nO).fill('o')];
  const picked = [];
  for (let i = 0; i < shown; i++) picked.push(kinds[Math.floor(i * kinds.length / shown)]);
  // A fixed shuffle, so the kinds are mixed but the picture does not jitter between redraws.
  const cells = picked.map((k, i) => [k, (i * 0.618034) % 1]).sort((a, b) => a[1] - b[1]).map(c => c[0]);
  cells.forEach((k, i) => {
    const col = i % 8, row = Math.floor(i / 8), x = 50 + col * 52 + (row % 2) * 24, y = 66 + row * 42;
    if (k === 'n') s += `<g data-cell-kind="neutrophil"><circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><circle cx="${x - 5}" cy="${y - 2}" r="4" fill="#7a5ea8"/><circle cx="${x + 1}" cy="${y + 4}" r="4" fill="#7a5ea8"/><circle cx="${x + 6}" cy="${y - 3}" r="4" fill="#7a5ea8"/></g>`;
    else if (k === 'l') s += `<g data-cell-kind="lymphocyte"><circle cx="${x}" cy="${y}" r="12" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="9" fill="${BLUE}"/></g>`;
    else s += `<g data-cell-kind="other"><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${MUTED}" stroke-width="1.5"/><path d="M${x - 6} ${y - 4} q6 10 12 0" fill="none" stroke="${MUTED}" stroke-width="4"/></g>`;
  });
  const nb = Math.round(10 * m.load);
  // Bacteria sit in the gaps between the white cells, spread over the drop.
  for (let i = 0; i < Math.min(nb, 30); i++) { const j = (i * 7) % 30; s += capsule(76 + (j % 6) * 64 + (Math.floor(j / 6) % 2) * 20, 87 + Math.floor(j / 6) * 42, 18, 8, `data-bug fill="${AMBER}"`); }
  return svg(label, s + legendRow(), 340);
}
const legendRow = () => `<g class="cv-legend"><circle cx="24" cy="320" r="7" fill="#7a5ea8"/>${text(36, 325, 'neutrophil', 'xs', 'start')}<circle cx="140" cy="320" r="7" fill="${BLUE}"/>${text(152, 325, 'lymphocyte', 'xs', 'start')}<circle cx="262" cy="320" r="7" fill="#fff" stroke="${MUTED}"/>${text(274, 325, 'other', 'xs', 'start')}${capsule(352, 320, 18, 8, `fill="${AMBER}"`)}${text(366, 325, 'bacteria', 'xs', 'start')}</g>`;

function updateClinical() {
  $('#clinical-bacteria').value = cv.bacteria; $('#clinical-bacteria-label').textContent = bacteriaWords(cv.bacteria);
  $('#clinical-drug').value = cv.drug;
  const st = data?.states.find(s => s.id === cv.state);
  if (!data) { $('#clinical-visual').innerHTML = ''; return; }
  const m = BM.blood(cvInputs(), REF);
  const label = `Illustrative drop of blood${st ? `, set to ${st.label}` : ''}${cv.custom ? ', adjusted by hand' : ''}${cv.drug ? `, with ${DRUG_LABEL[cv.drug]} in the model` : ''}: white cells drawn in proportion to the model, ${Math.round(10 * m.load) ? 'with bacteria among them' : 'with no bacteria'}.`;
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
      const n0 = BM.blood(normalInputs(), REF)[v.modelKey], rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal (${placeWords(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.extra = { ...(STATE_INPUTS[id] || {}) }; cv.bacteria = 0; cv.drug = '';
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
  const drugNote = cv.drug ? ` The model gives ${DRUG_LABEL[cv.drug]} against bacteria it reaches: an illustrative effect, not a cited direction.` : '';
  $('#state-summary').textContent = (s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.') + drugNote;
  updateClinical(); announce();
}
$('#clinical-bacteria').addEventListener('input', e => { cv.bacteria = Number(e.target.value); customised(); });
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
const ex = { gram: 'positive', betalactamase: false, drugs: new Set() };
const exploreOpts = () => ({ drugs: BM.DRUGS.filter(d => ex.drugs.has(d)), gram: ex.gram, betalactamase: ex.betalactamase });
const UNTREATED = BM.simulate({});
const pct = x => `${Math.round(100 * x)}%`;
function updateExplore() {
  $$('#gram input').forEach(r => { r.checked = r.value === ex.gram; });
  $('#betalactamase').checked = ex.betalactamase;
  const opt = exploreOpts(), cur = BM.settle(opt), curve = BM.simulate(opt), end = curve[curve.length - 1], end0 = UNTREATED[UNTREATED.length - 1];
  const names = opt.drugs.map(d => DRUG_LABEL[d]);
  const who = `a ${ex.gram === 'positive' ? 'gram-positive' : 'gram-negative'} bacterium${ex.betalactamase ? ' that makes a beta-lactam-cutting enzyme' : ''}${names.length ? `, with ${names.join(', ')}` : ', untreated'}`;
  const trend = end < 0.02 ? 'are cleared' : end < end0 * 0.6 ? 'fall' : 'keep growing, close to the untreated curve';
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated bacterium. Compared with untreated: ${describe(cur, NV)}. Over time the bacteria ${trend}.`;
  const o = { parts: new Set(P9), focus: 'graph', meters: M_ALL, key: true, ghost: NV, legend: 'your settings', gram: ex.gram, faulty: ex.drugs.has('aminoglycoside'), dnaCut: ex.drugs.has('fluoroquinolone'), curve, ghostCurve: UNTREATED, drugsOn: opt.drugs.length > 0 };
  $('#explore-visual').innerHTML = svg(label, picture(cur, o)) + readout(cur, NV, 'Compared with untreated');
  const res = $('#model-results');
  res.textContent = `Illustrative model output, compared with the untreated bacterium: wall ${pct(cur.wall)} · working proteins ${pct(cur.proteins)} · DNA copying ${pct(cur.dna)} · folate ${pct(cur.folate)} · growth ${pct(cur.growth)} · bacteria alive after a short spell of the drugs ${pct(cur.alive)} · bacteria at the end of the run ${pct(end / end0)} of untreated.`;
  Object.assign(res.dataset, { wall: cur.wall.toFixed(4), proteins: cur.proteins.toFixed(4), dna: cur.dna.toFixed(4), folate: cur.folate.toFixed(4), growth: cur.growth.toFixed(4), alive: cur.alive.toFixed(4), end: (end / end0).toFixed(4) });
}
$$('#drugs input').forEach(c => c.addEventListener('change', () => { if (c.checked) ex.drugs.add(c.value); else ex.drugs.delete(c.value); updateExplore(); }));
$$('#gram input').forEach(r => r.addEventListener('change', () => { if (r.checked) { ex.gram = r.value; updateExplore(); } }));
$('#betalactamase').addEventListener('change', e => { ex.betalactamase = e.target.checked; updateExplore(); });
$('#reset').addEventListener('click', () => {
  ex.gram = 'positive'; ex.betalactamase = false; ex.drugs.clear();
  $$('#drugs input').forEach(c => { c.checked = false; });
  updateExplore();
});

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const MODEL_KEYS = ['wbc', 'neutPct', 'lymphPct'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const byKey = k => loaded.values?.find(v => v.modelKey === k);
    if (!MODEL_KEYS.every(k => { const v = byKey(k); return v && hasRange(v) && v.high > v.low; })) throw new Error('Invalid reference data');
    data = loaded;
    for (const k of MODEL_KEYS) { const v = byKey(k); REF[k] = (v.low + v.high) / 2; }
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'How the bars work: the shaded band and its edge numbers are the quoted reference ranges. The teaching model puts its normal in the middle of each band; the large number in each row is the model’s level turned into the row’s unit. It is an illustrative teaching value, not a measurement, not a prediction for a patient and not from any source. How far the model moves for a condition is an illustrative choice; only the cited direction is sourced.';
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
      const edges = `<text x="${pos(v.low)}" y="58" text-anchor="middle">${lo}</text><text x="${pos(v.high)}" y="58" text-anchor="middle">${hi}</text>`;
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
