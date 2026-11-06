// Lesson 21: The cell cycle and chemotherapy. The kit (/lab/kit/kit.js) runs the page; this file is the pictures
// and the Clinical values and Explore freely tabs. The teaching model is model.js (window.CCModel), a classic
// script loaded before this module.
//
// Expected behaviour:
//   - One idea per picture, 480 wide and at most 420 tall, with the kit's type (20, .sm 18, .xs 17).
//   - The phase steps show the ring alone, with the phase being taught lit and a cell travelling round it. The
//     mechanism steps show the close-up alone (the gate and its engines, the copying fork, the untwisting enzyme,
//     the spindle), each with a small ring in the corner that marks its phase.
//   - Every "What changes it" step shows one ring of tumour cells from the model: dots are the share of living
//     cells in each phase (dashed rings: normal), red crosses are cells killed in that phase, and a red bracket
//     marks where the drug strikes. It morphs from normal at t = 0 to the drug's result at t = 1, and names what
//     moved in words. Its readout comes from the same model as Explore freely.
import { lesson } from '/lab/kit/kit.js';
import { C, f, clamp, lerp, ease as EASE, span, svg, text, line, circle, rect, path, arrowTo, part, readout } from '/lab/kit/draw.js';

const ease = EASE.out;
const CC = window.CCModel;
const NV = CC.NORMAL;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Drawing ---------- */
const NUC = '#f1ede2', MARROW = '#8c3a2e';
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const show = (a, body) => (a <= 0.02 ? '' : `<g ${fade(a)}>${body}</g>`);
const cross = (x, y, s, col = C.red, extra = '') => `<path ${extra} d="M${f(x - s)} ${f(y - s)} L${f(x + s)} ${f(y + s)} M${f(x + s)} ${f(y - s)} L${f(x - s)} ${f(y + s)}" stroke="${col}" stroke-width="2.8" stroke-linecap="round" fill="none"/>`;
const block = (x, y, w, h, extra = '') => rect(x - w / 2, y - h / 2, w, h, C.red, '#fff', 1.5, `rx="3" ${extra}`);
// A chromosome: one rod before copying, an X of two joined copies after.
const chromo = (x, y, s, col, doubled = true, extra = '') => doubled
  ? `<path ${extra} d="M${f(x - 5 * s)} ${f(y - 9 * s)} L${f(x + 5 * s)} ${f(y + 9 * s)} M${f(x + 5 * s)} ${f(y - 9 * s)} L${f(x - 5 * s)} ${f(y + 9 * s)}" stroke="${col}" stroke-width="${f(4 * s)}" stroke-linecap="round" fill="none"/>`
  : `<path ${extra} d="M${f(x)} ${f(y - 9 * s)} L${f(x)} ${f(y + 9 * s)}" stroke="${col}" stroke-width="${f(4 * s)}" stroke-linecap="round" fill="none"/>`;
const cellBody = (x, y, r, stroke = C.ink, extra = '') => `<g ${extra}>${circle(x, y, r, '#fff', stroke, 2)}${circle(x, y, r * 0.42, NUC, C.muted, 1.5)}</g>`;
// Two overlapping circles drawn as one cell pinching in two.
const pinched = (x, y, r, d, stroke = C.ink) => `<g>${circle(x - d, y, r, '#fff', stroke, 2)}${circle(x + d, y, r, '#fff', stroke, 2)}${circle(x - d, y, r - 1.6, '#fff')}${circle(x + d, y, r - 1.6, '#fff')}${circle(x - d, y, r * 0.38, NUC, C.muted, 1.5)}${circle(x + d, y, r * 0.38, NUC, C.muted, 1.5)}</g>`;
// Two twisting strands of DNA, between x0 and x1.
function strands(x0, x1, y, amp, turns, cols = [C.blue, C.amber], w = 3) {
  let a = '', b = '';
  for (let i = 0; i <= 50; i++) { const x = x0 + (x1 - x0) * i / 50, ph = turns * 2 * Math.PI * i / 50; a += `${i ? 'L' : 'M'}${f(x)} ${f(y - amp * Math.cos(ph))} `; b += `${i ? 'L' : 'M'}${f(x)} ${f(y + amp * Math.cos(ph))} `; }
  return `<path d="${a}" fill="none" stroke="${cols[0]}" stroke-width="${w}"/><path d="${b}" fill="none" stroke="${cols[1]}" stroke-width="${w}"/>`;
}

/* ---------- The ring: the cell cycle ---------- */
const RC = { x: 176, y: 206, r: 124, w: 40 };
const PH = {
  G1: { a0: -90, a1: 40, col: C.blue, tint: '#dde3ff', word: 'grow', cls: 'blue' },
  S: { a0: 40, a1: 150, col: C.amber, tint: '#f6e2cc', word: 'copy DNA', cls: 'amber' },
  G2: { a0: 150, a1: 220, col: C.purple, tint: '#ebe1f4', word: 'check', cls: 'purple' },
  M: { a0: 220, a1: 270, col: C.green, tint: '#dcebd8', word: 'split', cls: 'green' },
};
const CYCLE = ['G1', 'S', 'G2', 'M'];
const rad = d => d * Math.PI / 180;
const pt = (r, d, cx = RC.x, cy = RC.y) => [cx + r * Math.cos(rad(d)), cy + r * Math.sin(rad(d))];
function arcD(r, a0, a1, cx = RC.x, cy = RC.y) {
  const [x0, y0] = pt(r, a0, cx, cy), [x1, y1] = pt(r, a1, cx, cy);
  return `M${f(x0)} ${f(y0)} A${f(r)} ${f(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}
const GATE_A = 40;   // the G1 checkpoint, where G1 ends and S begins
// o: { lit: phase names to light, gate: 'shut' | 'broken' | '', labels: true }
function ring(o = {}) {
  const lit = o.lit || [];
  let s = '';
  for (const p of CYCLE) {
    const ph = PH[p], on = lit.includes(p) || !lit.length;
    s += part(`phase-${p}`, path(arcD(RC.r, ph.a0 + 0.6, ph.a1 - 0.6), lit.includes(p) ? ph.col : ph.tint, RC.w, 'stroke-linecap="butt"' + (on ? '' : ' opacity=".55"')));
  }
  // Chevrons at each boundary: the way round.
  for (const a of [-90, 40, 150, 220]) {
    const [x, y] = pt(RC.r, a), tx = -Math.sin(rad(a)), ty = Math.cos(rad(a)), nx = Math.cos(rad(a)), ny = Math.sin(rad(a));
    s += `<path d="M${f(x + tx * 8)} ${f(y + ty * 8)} L${f(x - tx * 5 + nx * 9)} ${f(y - ty * 5 + ny * 9)} L${f(x - tx * 5 - nx * 9)} ${f(y - ty * 5 - ny * 9)} Z" fill="#fff" stroke="${C.muted}" stroke-width="1"/>`;
  }
  if (o.labels !== false) for (const p of CYCLE) {
    const ph = PH[p], [x, y] = pt(RC.r, (ph.a0 + ph.a1) / 2);
    s += text(x, y + 7, p, lit.includes(p) ? 'sm b in-cell' : `sm b ${ph.cls} nohalo`);
  }
  if (o.gate) {
    const [x0, y0] = pt(RC.r - 26, GATE_A), [x1, y1] = pt(RC.r + 26, GATE_A);
    if (o.gate === 'broken') {
      const [xa, ya] = pt(RC.r - 8, GATE_A), [xb, yb] = pt(RC.r + 8, GATE_A);
      s += part('gate', line(x0, y0, xa, ya, C.ink, 6) + line(xb, yb, x1, y1, C.ink, 6) + cross((xa + xb) / 2, (ya + yb) / 2, 6));
    } else s += part('gate', line(x0, y0, x1, y1, C.ink, 6));
  }
  return s;
}
// A small ring for the corner of a close-up, with its phase (or phases) lit.
function badge(x, y, lit, col = null) {
  let s = circle(x, y, 40, '#fff', C.rule, 1.5);
  for (const p of CYCLE) { const ph = PH[p]; s += path(arcD(26, ph.a0 + 2, ph.a1 - 2, x, y), lit.includes(p) ? (col || ph.col) : ph.tint, 11, 'stroke-linecap="butt"'); }
  return `<g data-badge>${s}${text(x, y + 6, lit.join(' '), `xs b ${col ? 'red' : PH[lit[0]].cls} on-white`)}</g>`;
}
// A cell travelling round the ring, drawn for the phase it is in.
function traveller(a) {
  const [x, y] = pt(RC.r, a);
  const p = a < 40 ? 'G1' : a < 150 ? 'S' : a < 220 ? 'G2' : 'M';
  const grow = p === 'G1' ? 12 + 6 * clamp((a + 90) / 130, 0, 1) : 18;
  let s = circle(x, y, grow, '#fff', C.ink, 2.4);
  if (p === 'G1') s += chromo(x, y, 0.7, C.blue, false);
  if (p === 'S') s += chromo(x, y, 0.7, C.amber, (a - 40) / 110 > 0.5);
  if (p === 'G2') s += chromo(x, y, 0.7, C.purple, true) + circle(x + 8, y - 8, 6, 'none', C.ink, 1.8);
  if (p === 'M') { const d = 8 * clamp((a - 220) / 50, 0, 1); s = pinched(x, y, 14, d) + chromo(x - d, y, 0.5, C.green, false) + chromo(x + d, y, 0.5, C.green, false); }
  return part('traveller', s);
}

/* ---------- 1. A cell makes two ---------- */
function dividePic(t) {
  const grow = ease(span(t, 0.05, 0.4)), pinch = ease(span(t, 0.45, 0.7)), apart = ease(span(t, 0.7, 0.92));
  let s = '';
  if (pinch < 0.02) s += part('cell', cellBody(240, 132, 44 + 12 * grow));
  else if (apart < 0.02) s += part('cell', pinched(240, 132, 44, 34 * pinch));
  else s += part('cell', cellBody(240 - 34 - 64 * apart, 132, 44) + cellBody(240 + 34 + 64 * apart, 132, 44));
  const word = apart > 0.5 ? 'two cells, each a full copy' : pinch > 0.3 ? 'it pinches in two' : 'one cell grows';
  s += text(240, 236, word, 'sm b');
  s += text(240, 266, 'skin, blood and gut lining are renewed this way', 'xs muted');
  return s;
}

/* ---------- 2. The instructions inside ---------- */
function dnaPic() {
  let s = `<ellipse cx="160" cy="150" rx="140" ry="104" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>`;
  s += part('nucleus', circle(176, 150, 62, NUC, C.muted, 2));
  s += part('chromosome', [[150, 124, C.blue], [196, 124, C.amber], [158, 176, C.purple], [200, 172, C.green], [178, 148, C.blue]].map(([x, y, c]) => chromo(x, y, 1.1, c, false)).join(''));
  s += text(30, 40, 'a cell', 'sm b', 'start') + text(176, 238, 'nucleus', 'xs b muted');
  // One chromosome, unwound: DNA's two strands.
  s += `<path d="M200 168 L306 288" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="4 4"/>`;
  s += part('dna', strands(196, 464, 306, 15, 3.5) + Array.from({ length: 22 }, (_, i) => { const x = 202 + i * 12, ph = 3.5 * 2 * Math.PI * (x - 196) / 268; return line(x, 306 - 15 * Math.cos(ph), x, 306 + 15 * Math.cos(ph), C.rule, 2.2); }).join(''));
  s += text(464, 40, 'chromosomes:', 'xs b', 'end') + text(464, 62, 'bundles of DNA', 'xs', 'end') + line(370, 70, 216, 130, C.ink, 1.4);
  s += text(240, 356, 'DNA: two strands of coded instructions', 'xs b');
  return s;
}

/* ---------- 3. A loop of stages ---------- */
function phaseKey(lit = null) {
  let s = '';
  CYCLE.forEach((p, i) => {
    const y = 96 + i * 52, ph = PH[p], on = !lit || lit === p;
    s += rect(336, y - 16, 20, 20, ph.col, 'none', 0, `rx="4" ${on ? '' : 'opacity=".35"'}`);
    s += text(364, y, p, `sm b ${on ? ph.cls : 'muted'}`, 'start') + text(364 + (p.length > 1 ? 30 : 20), y, ph.word, on ? 'xs' : 'xs muted', 'start');
  });
  return s;
}
function cyclePic(t) {
  let s = ring() + traveller(-90 + 360 * t) + phaseKey();
  s += text(RC.x, RC.y - 6, 'one trip round', 'xs b') + text(RC.x, RC.y + 16, 'makes two cells', 'xs b');
  s += text(336, 330, 'always in', 'xs muted', 'start') + text(336, 352, 'this order', 'xs muted', 'start');
  return s;
}

/* ---------- 4. G1: grow and get ready ---------- */
function g1Pic(t) {
  const a = -90 + 124 * ease(span(t, 0.05, 0.75));
  let s = ring({ lit: ['G1'], gate: 'shut' }) + traveller(a);
  const [gx, gy] = pt(RC.r + 30, GATE_A);
  s += text(336, 90, 'G1: the new cell', 'xs b blue', 'start') + text(336, 112, 'grows and makes', 'xs', 'start') + text(336, 134, 'what it needs', 'xs', 'start');
  s += text(336, 300, 'checkpoint:', 'xs b', 'start') + text(336, 322, 'go on, or not?', 'xs', 'start') + line(334, 290, gx + 4, gy + 4, C.ink, 1.4);
  s += text(RC.x, RC.y + 6, 'grow', 'lg b blue');
  return s;
}

/* ---------- 5. The engines that open the gate ---------- */
const engine = (x, y, s = 1) => `<path d="M${f(x - 14 * s)} ${f(y)} A${f(14 * s)} ${f(14 * s)} 0 1 1 ${f(x + 9 * s)} ${f(y + 11 * s)} L${f(x)} ${f(y)} Z" fill="${C.blue}"/>`;
const cyclin = (x, y, s = 1) => `<path d="M${f(x)} ${f(y - 12 * s)} q${f(16 * s)} ${f(2 * s)} ${f(14 * s)} ${f(16 * s)} q${f(-8 * s)} ${f(8 * s)} ${f(-16 * s)} ${f(6 * s)} q${f(8 * s)} ${f(-10 * s)} ${f(2 * s)} ${f(-22 * s)} Z" fill="${C.amber}"/>`;
function gateScene(o) {
  // o: { meet (engine and cyclin come together), unlock, open, pass, drug }
  let s = line(16, 256, 464, 256, C.rule, 3) + text(16, 288, 'G1', 'sm b blue', 'start') + text(464, 288, 'S phase', 'sm b amber', 'end');
  // The gate: a post and a bar, held shut by a brake until the engines release it.
  const gx = 270, bar = o.open;
  s += line(gx, 150, gx, 256, C.muted, 3) + circle(gx, 156, 6, C.ink);
  s += part('gate', bar < 0.02 ? line(gx, 156, gx, 250, C.ink, 7) : line(gx, 156, gx + 92 * Math.sin(rad(80 * bar)), 156 + 94 * Math.cos(rad(80 * bar)) - 0, C.ink, 7));
  if (o.unlock < 0.98) s += part('brake', rect(gx - 13, 196, 26, 22, '#fff', C.ink, 2, `rx="4" ${fade(1 - o.unlock)}`) + text(gx, 213, 'Rb', 'xs b on-white', 'middle', fade(1 - o.unlock)));
  // The engine (CDK4 or CDK6) and its partner, cyclin D.
  const ex = lerp(150, 236, o.meet), cy = lerp(110, 196, o.meet);
  s += part('engine', engine(ex, 206, 1.5) + cyclin(lerp(120, ex + 14, o.meet), lerp(cy, 192, o.meet), 1.2));
  if (o.drug > 0.02) s += part('drug', block(ex, 200 - 60 * (1 - o.drug), 30, 18, fade(Math.min(1, o.drug * 2))));
  // The cell, waiting in G1, then through to S.
  s += part('cell', cellBody(lerp(150, 400, o.pass), 226, 26));
  return s;
}
function cdkPic(t) {
  const meet = ease(span(t, 0.05, 0.3)), unlock = ease(span(t, 0.32, 0.46)), open = ease(span(t, 0.46, 0.62)), pass = ease(span(t, 0.62, 0.92));
  let s = gateScene({ meet, unlock, open, pass }) + badge(424, 64, ['G1']);
  s += text(16, 40, 'CDK4 or CDK6', 'xs b blue', 'start') + text(16, 62, '+ its partner, cyclin D', 'xs b amber', 'start');
  s += show(1 - span(t, 0.4, 0.5), text(306, 212, 'the brake', 'xs b', 'start'));
  s += show(span(t, 0.46, 0.6), text(306, 128, 'brake off:', 'xs b blue', 'start') + text(306, 150, 'the gate opens', 'xs b blue', 'start'));
  s += show(span(t, 0.85, 1), text(400, 324, 'on to copying', 'xs b'));
  return s;
}

/* ---------- 6. S phase: copying the DNA ---------- */
function forkPic(t) {
  let s = badge(424, 64, ['S']);
  // The parent DNA comes in from the left and unzips at the fork; each old strand gets new partner blocks.
  s += strands(16, 170, 206, 10, 2.2);
  s += `<path d="M170 196 Q186 190 200 166 L464 166" fill="none" stroke="${C.blue}" stroke-width="3"/><path d="M170 216 Q186 222 200 246 L464 246" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  s += part('fork', circle(178, 206, 14, '#fff', C.ink, 2));
  const n = 8, u = t * n;
  let blocks = '';
  for (const [y, col] of [[180, C.amber], [232, C.blue]]) {
    for (let i = 0; i < n; i++) {
      const x = 210 + i * 30, a = clamp(u - i, 0, 1);
      if (a > 0.02) blocks += rect(x, lerp(y - 40, y, ease(a)) - 7, 22, 14, col, 'none', 0, `rx="2" ${fade(a)}`);
    }
  }
  s += part('blocks', blocks);
  s += text(16, 150, 'the old DNA', 'xs b', 'start') + text(16, 172, 'unzips', 'xs', 'start');
  s += text(464, 296, 'new building blocks,', 'xs b', 'end') + text(464, 318, 'one by one, on each strand', 'xs', 'end');
  s += text(16, 296, 'each chromosome becomes', 'xs muted', 'start') + text(16, 318, 'two joined copies', 'xs muted', 'start');
  return s;
}

/* ---------- 7. Untwisting as it copies ---------- */
function untwistPic(t) {
  let s = badge(424, 64, ['S']);
  const wind = ease(span(t, 0, 0.3)) * (1 - ease(span(t, 0.6, 0.8))), gap = ease(span(t, 0.3, 0.42)) * (1 - ease(span(t, 0.66, 0.8)));
  const ex = 300, gw = 26 * gap;
  s += part('dna', strands(16, ex - gw / 2, 210, 13, 3 + 3 * wind) + strands(ex + gw / 2, 464, 210, 13, 1.6 + 0.8 * (1 - gap)));
  // Topoisomerase: two jaws round the DNA that cut it, let it spin and join it again.
  const jaw = 22 - 6 * gap;
  s += part('topo', `<path d="M${ex - 24} ${f(210 - jaw - 12)} Q${ex} ${f(210 - jaw - 34)} ${ex + 24} ${f(210 - jaw - 12)} M${ex - 24} ${f(210 + jaw + 12)} Q${ex} ${f(210 + jaw + 34)} ${ex + 24} ${f(210 + jaw + 12)}" fill="none" stroke="${C.purple}" stroke-width="7" stroke-linecap="round"/>`);
  if (gap > 0.3) s += `<path d="M${ex + 40} 162 a16 16 0 1 1 -2 -1" fill="none" stroke="${C.purple}" stroke-width="2.4" ${fade(gap)}/>`;
  s += text(ex, 128, 'topoisomerase', 'xs b purple');
  s += show(span(t, 0.1, 0.25) * (1 - span(t, 0.62, 0.72)), text(140, 160, 'wound tighter', 'xs b blue'));
  s += text(240, 318, 'cut, let it untwist, join it again', 'xs b') + text(240, 340, 'so copying, and later splitting, carry on', 'xs muted');
  return s;
}

/* ---------- 8. G2: a final check ---------- */
function g2Pic(t) {
  const a = 152 + 60 * ease(span(t, 0.05, 0.4));
  let s = ring({ lit: ['G2'] }) + traveller(a);
  // In the middle: the doubled chromosome under a magnifier, which finds a break.
  const sweep = ease(span(t, 0.4, 0.75));
  s += chromo(RC.x, RC.y, 2.2, C.purple, true);
  const mx = lerp(RC.x - 40, RC.x + 8, sweep), my = lerp(RC.y - 30, RC.y - 10, sweep);
  s += show(span(t, 0.75, 0.85), cross(RC.x + 10, RC.y - 12, 7));
  s += part('check', circle(mx, my, 24, 'none', C.ink, 3) + line(mx + 17, my + 17, mx + 34, my + 34, C.ink, 6));
  s += text(336, 90, 'G2: grow a little,', 'xs b purple', 'start') + text(336, 112, 'check the copy', 'xs', 'start');
  s += show(span(t, 0.8, 0.95), text(336, 280, 'a break? fix it,', 'xs b red', 'start') + text(336, 302, 'stop here, or', 'xs b', 'start') + text(336, 324, 'self-destruct', 'xs b', 'start'));
  return s;
}

/* ---------- 9. M phase: pulling the copies apart ---------- */
function spindleCell(cx, cy, rx, o) {
  // o: { pull (0 to 1), pinch (0 to 1), grow (rope reach, 1 normal), frozen }
  let s = '';
  const waist = o.pinch;
  s += `<path d="M${cx} ${f(cy - 92 + 60 * waist)} C${f(cx + rx * 0.6)} ${cy - 96} ${cx + rx} ${cy - 70} ${cx + rx} ${cy} C${cx + rx} ${cy + 70} ${f(cx + rx * 0.6)} ${cy + 96} ${cx} ${f(cy + 92 - 60 * waist)} C${f(cx - rx * 0.6)} ${cy + 96} ${cx - rx} ${cy + 70} ${cx - rx} ${cy} C${cx - rx} ${cy - 70} ${f(cx - rx * 0.6)} ${cy - 96} ${cx} ${f(cy - 92 + 60 * waist)} Z" fill="#fff" stroke="${C.ink}" stroke-width="2.2"/>`;
  const pl = cx - rx + 26, pr = cx + rx - 26;
  s += circle(pl, cy, 7, C.green) + circle(pr, cy, 7, C.green);
  let ropes = '', ch = '';
  for (const dy of [-46, 0, 46]) {
    const y = cy + dy, sep = (rx - 46) * o.pull;
    for (const [px, side] of [[pl, -1], [pr, 1]]) {
      const tipX = cx + side * (8 + sep), reach = o.grow ?? 1;
      if (o.ghost) ropes += line(px, cy, cx + side * 8, y, C.ghost, 1.6, 'stroke-dasharray="3 3"');
      ropes += line(px, cy, lerp(px, tipX, reach), lerp(cy, y, reach), C.green, 2.6);
      if (o.frozen > 0.3) ropes += circle(lerp(px, tipX, 0.5), lerp(cy, y, 0.5), 3.5, '#fff', C.red, 1.6);
    }
    ch += o.pull < 0.05 ? chromo(cx, y, 1, C.amber, true) : chromo(cx - 8 - sep, y, 1, C.amber, false) + chromo(cx + 8 + sep, y, 1, C.amber, false);
  }
  return s + part('spindle', ropes) + part('chromosome', ch);
}
function mPic(t) {
  const pull = ease(span(t, 0.3, 0.65)), pinch = ease(span(t, 0.7, 0.95));
  let s = badge(424, 64, ['M']);
  s += spindleCell(220, 200, 170, { pull, pinch });
  s += text(16, 40, 'the spindle: microtubule ropes', 'xs b green', 'start');
  s += show(1 - span(t, 0.28, 0.36), text(220, 330, 'copies lined up in the middle', 'xs b'));
  s += show(span(t, 0.36, 0.5) * (1 - span(t, 0.68, 0.74)), text(220, 330, 'ropes shrink: one copy to each end', 'xs b'));
  s += show(span(t, 0.74, 0.86), text(220, 330, 'then the cell pinches in two', 'xs b'));
  return s;
}

/* ---------- 10. Most cells are resting ---------- */
const G0BOX = { x: 340, y: 70, w: 128, h: 132 };
const g0Slot = i => [G0BOX.x + 22 + (i % 5) * 21, G0BOX.y + 52 + Math.floor(i / 5) * 21];
function g0Box(n, ghostN = 0, red = false, dead = 0) {
  let s = rect(G0BOX.x, G0BOX.y, G0BOX.w, G0BOX.h, '#fff', red ? C.red : C.muted, red ? 2.6 : 1.6, 'stroke-dasharray="6 4"');
  s += text(G0BOX.x + 12, G0BOX.y + 28, 'G0: resting', 'xs b', 'start');
  for (let i = 0; i < ghostN; i++) { const [x, y] = g0Slot(i); s += circle(x, y, 7.5, 'none', C.ghost, 1.3, 'stroke-dasharray="2 2"'); }
  for (let i = 0; i < n; i++) { const [x, y] = g0Slot(i); s += circle(x, y, 6.5, C.muted, '#fff', 1.2); }
  for (let i = 0; i < dead; i++) s += cross(G0BOX.x + 20 + i * 16, G0BOX.y + G0BOX.h - 14, 5);
  return part('g0', s);
}
function g0Pic(t) {
  let s = ring() + g0Box(12);
  // One cell steps out of G1 to rest; one resting cell steps back in.
  const out = ease(span(t, 0.05, 0.45)), back = ease(span(t, 0.5, 0.9));
  const [ax, ay] = pt(RC.r, -40), [bx, by] = pt(RC.r, -10);
  s += arrowTo(ax + 18, ay - 8, G0BOX.x - 6, G0BOX.y + 40, C.muted, 2) + arrowTo(G0BOX.x - 6, G0BOX.y + 96, bx + 22, by, C.muted, 2);
  s += circle(lerp(ax, G0BOX.x + 22, out), lerp(ay, G0BOX.y + 52 + 63, out), 7, C.muted, '#fff', 1.2);
  s += circle(lerp(G0BOX.x + 106, bx, back), lerp(G0BOX.y + 52 + 42, by, back), 7, back > 0.6 ? C.blue : C.muted, '#fff', 1.2);
  s += text(G0BOX.x, 240, 'most body cells', 'xs b', 'start') + text(G0BOX.x, 262, 'rest and do', 'xs', 'start') + text(G0BOX.x, 284, 'their jobs', 'xs', 'start');
  s += show(span(t, 0.6, 0.8), text(G0BOX.x, 330, 'some step back', 'xs b blue', 'start') + text(G0BOX.x, 352, 'in, to heal', 'xs b blue', 'start'));
  return s;
}

/* ---------- 11. The whole loop: tissues that never stop dividing ---------- */
function wholePic(t) {
  let s = '';
  // A bone, its marrow making new blood cells, which leave into the blood.
  s += part('marrow', `<rect x="20" y="70" width="200" height="120" rx="58" fill="#f4ead8" stroke="${C.ink}" stroke-width="2"/><rect x="42" y="92" width="156" height="76" rx="38" fill="#f2c9bf"/>`);
  for (let i = 0; i < 6; i++) { const x = 72 + (i % 3) * 46, y = 116 + Math.floor(i / 3) * 30; s += ((t * 3 + i * 0.37) % 1) < 0.5 ? pinched(x, y, 8, 4, MARROW) : circle(x, y, 9, '#fff', MARROW, 2); }
  s += line(240, 130, 464, 130, '#f1cdc6', 30);
  for (let k = 0; k < 5; k++) { const u = (t + k / 5) % 1; s += circle(lerp(232, 470, u), 130 + 6 * Math.sin(6.28 * (u + k)), 7, k % 2 ? '#fff' : '#d9524a', k % 2 ? C.blue : 'none', k % 2 ? 2.4 : 0, fade(Math.min(1, (1 - u) * 5))); }
  s += text(120, 220, 'bone marrow', 'sm b') + text(120, 242, 'makes new blood cells', 'xs');
  s += text(352, 172, 'into the blood', 'xs muted');
  // Two more tissues that divide all the time.
  s += `<path d="M30 330 q12 -40 24 0 q12 -40 24 0 q12 -40 24 0 q12 -40 24 0" fill="#f2c9bf" stroke="${C.ink}" stroke-width="2"/>` + line(26, 330, 130, 330, C.ink, 2);
  s += text(150, 318, 'gut lining', 'xs b', 'start');
  s += line(262, 330, 340, 330, '#d9b38c', 5);
  for (let i = 0; i < 4; i++) s += `<path d="M${272 + i * 18} 330 q-6 -26 4 -48" fill="none" stroke="${C.ink}" stroke-width="2"/>` + circle(272 + i * 18, 333, 4, C.ink);
  s += text(352, 318, 'hair roots', 'xs b', 'start');
  s += text(16, 40, 'healthy tissues that divide all the time:', 'xs b', 'start');
  s += text(240, 384, 'key measures: tumour size, new blood cells', 'xs b muted');
  return s;
}

/* ---------- 12 to 17. What changes it: one ring of tumour cells ---------- */
const ARC_SLOTS = p => {
  const ph = PH[p], out = [];
  // Leave the middle of each phase clear for its name.
  for (let a = ph.a0 + 6; a <= ph.a1 - 6; a += 10) if (Math.abs(a - (ph.a0 + ph.a1) / 2) >= 10) { out.push(pt(RC.r - 9, a)); out.push(pt(RC.r + 9, a + 5)); }
  return out;
};
const SLOTS = Object.fromEntries(CYCLE.map(p => [p, ARC_SLOTS(p)]));
const dotsOf = (v, p) => clamp(Math.round(34 * v['sh' + p]), 0, SLOTS[p].length);
const deadOf = (v, p) => { const d = v['dead' + p]; return d < 0.03 ? 0 : clamp(Math.round(9 * d), 1, 9); };
// Cells killed in a phase: red crosses just inside the ring, along that phase.
function deaths(v, p) {
  const n = deadOf(v, p), ph = PH[p];
  let s = '';
  for (let i = 0; i < n; i++) { const [x, y] = pt(RC.r - 36, ph.a0 + 8 + i * (ph.a1 - ph.a0 - 16) / Math.max(1, n - 1 || 1)); s += cross(x, y, 4.5); }
  return s;
}
function ringPop(cur, ghostV, o) {
  // o: { strike: phases the drug hits, all: true for every phase, gate, a (alpha of the drug marks) }
  let s = ring({ gate: o.gate });
  let gh = '', dots = '';
  for (const p of CYCLE) {
    for (let i = 0; i < dotsOf(ghostV, p); i++) { const [x, y] = SLOTS[p][i]; gh += circle(x, y, 7, 'none', C.ghost, 1.3, 'stroke-dasharray="2 2"'); }
    for (let i = 0; i < dotsOf(cur, p); i++) { const [x, y] = SLOTS[p][i]; dots += circle(x, y, 6, PH[p].col, '#fff', 1.2); }
  }
  s += `<g class="ghost" data-ghost="normal">${gh}</g>` + part('cells', dots);
  s += part('dead', CYCLE.map(p => deaths(cur, p)).join(''));
  const n0 = clamp(Math.round(34 * cur.shG0), 0, 25), g0 = clamp(Math.round(34 * ghostV.shG0), 0, 25);
  s += g0Box(n0, g0, o.all && o.a > 0.3, deadOf(cur, 'G0'));
  if (o.a > 0.02) {
    let mark = '';
    if (o.all) mark += circle(RC.x, RC.y, RC.r + 30, 'none', C.red, 3, 'stroke-dasharray="9 6"');
    for (const p of o.strike || []) mark += path(arcD(RC.r + 28, PH[p].a0 + 3, PH[p].a1 - 3), C.red, 6);
    s += part('drug', `<g ${fade(o.a)}>${mark}</g>`);
  }
  return s;
}
// The middle of the ring: a small picture of the drug at work, and its words.
const MIDDLE = {
  cancer: e => { let s = ''; const n = Math.round(4 + 9 * e); for (let i = 0; i < n; i++) { const a = i * 2.4, r = 6 + 4.5 * Math.sqrt(i * 2); s += circle(RC.x + r * Math.cos(a), RC.y - 16 + r * Math.sin(a) * 0.8, 8, '#fff', C.red, 1.8); } return s + text(RC.x, RC.y + 40, 'tumour', 'xs b red'); },
  antimetabolite: () => `<path d="M${RC.x - 50} ${RC.y - 16} L${RC.x - 14} ${RC.y - 16} L${RC.x + 30} ${RC.y - 34} M${RC.x - 50} ${RC.y - 6} L${RC.x - 14} ${RC.y - 6} L${RC.x + 30} ${RC.y + 12}" fill="none" stroke="${C.blue}" stroke-width="3"/>` + block(RC.x + 6, RC.y - 26, 14, 12) + text(RC.x, RC.y + 40, 'fake block', 'xs b red'),
  spindle: () => `<ellipse cx="${RC.x}" cy="${RC.y - 14}" rx="44" ry="26" fill="#fff" stroke="${C.ink}" stroke-width="2"/>` + line(RC.x - 34, RC.y - 14, RC.x - 6, RC.y - 24, C.green, 2) + line(RC.x + 34, RC.y - 14, RC.x + 6, RC.y - 4, C.green, 2) + chromo(RC.x, RC.y - 14, 0.8, C.amber) + circle(RC.x, RC.y - 44, 6, C.red) + text(RC.x, RC.y + 40, 'spindle jammed', 'xs b red'),
  alkylating: () => line(RC.x - 50, RC.y - 26, RC.x + 50, RC.y - 26, C.blue, 3) + line(RC.x - 50, RC.y - 2, RC.x + 50, RC.y - 2, C.amber, 3) + [-30, 0, 30].map(dx => line(RC.x + dx, RC.y - 26, RC.x + dx, RC.y - 2, C.red, 4)).join('') + text(RC.x, RC.y + 40, 'strands tied', 'xs b red'),
  topo: () => strands(RC.x - 56, RC.x - 8, RC.y - 14, 9, 1.5) + strands(RC.x + 8, RC.x + 56, RC.y - 14, 9, 1.5) + block(RC.x, RC.y - 14, 12, 22) + text(RC.x, RC.y + 40, 'cut held open', 'xs b red'),
  cdk46: () => engine(RC.x - 10, RC.y - 14, 1.3) + block(RC.x - 10, RC.y - 20, 26, 14) + line(RC.x + 26, RC.y - 44, RC.x + 26, RC.y + 10, C.ink, 6) + text(RC.x, RC.y + 40, 'gate held shut', 'xs b red'),
};
const WORDS = {
  cancer: [['checkpoint', 'red'], ['broken', 'red'], ['↓ fewer rest', 'blue'], ['↑ more divide:', 'blue'], ['a tumour', 'blue'], ['builds up', 'blue']],
  antimetabolite: [['antimetabolite', 'red'], ['strikes S', 'red'], ['↑ cells copying', 'blue'], ['their DNA die', 'blue']],
  spindle: [['vinca, taxane:', 'red'], ['strike M', 'red'], ['↑ cells stuck', 'blue'], ['in mitosis die', 'blue']],
  alkylating: [['alkylating', 'red'], ['agent: every', 'red'], ['phase', 'red'], ['↑ deaths all', 'blue'], ['round, even', 'blue'], ['resting cells', 'blue']],
  topo: [['topoisomerase', 'red'], ['inhibitor:', 'red'], ['S and G2', 'red'], ['↑ breaks kill', 'blue'], ['cells copying', 'blue'], ['and checking', 'blue']],
  cdk46: [['CDK4/6', 'red'], ['inhibitor:', 'red'], ['G1 held shut', 'red'], ['↑ cells pile up', 'blue'], ['in G1, waiting', 'blue'], ['no deaths', 'blue']],
};
const STRIKE = { antimetabolite: ['S'], spindle: ['M'], topo: ['S', 'G2'], cdk46: ['G1'], alkylating: [], cancer: [] };
function changePic(kind, t) {
  const e = ease(span(t, 0.15, 0.9));
  const from = kind === 'cancer' ? CC.HEALTHY : NV, cur = CC.lerp(from, ENDS[kind], e);
  const gate = kind === 'cancer' ? (e > 0.5 ? 'broken' : 'shut') : kind === 'cdk46' ? 'shut' : '';
  let s = ringPop(cur, from, { strike: STRIKE[kind], all: kind === 'alkylating', gate, a: span(t, 0.08, 0.25) });
  s += show(span(t, 0.1, 0.3), MIDDLE[kind](e));
  WORDS[kind].forEach(([w, tone], i) => { s += show(span(t, 0.3 + i * 0.08, 0.4 + i * 0.08), text(G0BOX.x, 244 + i * 24, w, `xs b ${tone}`, 'start')); });
  return s;
}

/* ---------- Words: comparisons and text alternatives ---------- */
const ROWS = [['tumour', 'Tumour size', 'bigger', 'smaller'], ['marrow', 'New blood cells', 'more', 'fewer'], ['damaged', 'Damaged cells', 'more', 'fewer'], ['shG1', 'Share of living cells in G1', 'larger', 'smaller'], ['shM', 'Share of living cells in mitosis', 'larger', 'smaller']];
function trend(a, b, up, down) {
  if (Math.abs(a - b) < 0.05 * Math.max(Math.abs(b), 0.05)) return ['same', 'about the same'];
  return a > b ? ['up', up] : ['down', down];
}
const compare = (v, ref) => ROWS.map(([k, name, up, down]) => { const [d, w] = trend(v[k], ref[k], up, down); return [name, d, w]; });
const changedFirst = rows => [...rows.filter(r => r[1] !== 'same'), ...rows.filter(r => r[1] === 'same')];
const describe = (v, ref) => compare(v, ref).map(([k, , w]) => `${k[0].toLowerCase() + k.slice(1)}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const DRUG_OPT = { cancer: {}, antimetabolite: { antimetabolite: true }, spindle: { spindle: true }, alkylating: { alkylating: true }, topo: { topo: true }, cdk46: { cdk46: true } };
const ENDS = Object.fromEntries(Object.entries(DRUG_OPT).map(([k, o]) => [k, CC.settle(o)]));
const CHANGE_WHERE = {
  cancer: 'The ring of cells starts as healthy tissue, with most cells resting in the G0 box. The checkpoint bar at the end of G1 breaks with a red cross, the resting cells fall from many to few, more dots fill G1, S, G2 and M, and a lump of red-ringed cells, the tumour, grows in the middle.',
  antimetabolite: 'A red bracket marks S phase. Red crosses pile up along S, where cells copying their DNA die, and the dots in S, G2 and M thin out against dashed outlines; in the middle, a red fake block jams a copying fork.',
  spindle: 'A red bracket marks M phase. More dots crowd into M than the dashed outlines, cells stuck in mitosis, and red crosses along M mark cells dying there; in the middle, a spindle is jammed.',
  alkylating: 'A red dashed circle surrounds the whole ring and the resting box turns red: red crosses appear along every phase and under the resting cells, most along G1 and S; in the middle, red bars tie the two DNA strands together.',
  topo: 'Red brackets mark S phase and G2. Red crosses pile up along S and G2, where the DNA is copied and checked; in the middle, a red block holds a cut in the DNA open.',
  cdk46: 'The checkpoint bar at the end of G1 stays shut and a red bracket marks G1. Dots pile up in G1 beyond the dashed outlines while S, G2 and M empty, and no red crosses appear: the cells wait rather than die; in the middle, a red block sits on the engine.'
};
const TITLE = { cancer: 'Cancer', antimetabolite: 'Antimetabolites', spindle: 'Vinca alkaloids and taxanes', alkylating: 'Alkylating agents', topo: 'Topoisomerase inhibitors', cdk46: 'CDK4/6 inhibitors' };
function change(kind) {
  const ref = kind === 'cancer' ? CC.HEALTHY : NV;
  const order = changedFirst(compare(ENDS[kind], ref)).map(r => r[0]);
  const sorted = rows => order.map(k => rows.find(r => r[0] === k));
  return {
    duration: 4800,
    render(t) {
      const cur = CC.lerp(ref, ENDS[kind], ease(span(t, 0.15, 0.9)));
      const label = `${TITLE[kind]}, drawn over dashed outlines for normal, ${kind === 'cancer' ? 'healthy tissue' : 'the untreated tumour'}. Dots on the ring are the share of living cells in each phase. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(cur, ref)}.`;
      return { svg: svg(label, changePic(kind, t), { h: 412 }), readout: readout(sorted(compare(cur, ref))) };
    }
  };
}
const still = (label, draw, h) => () => svg(label, draw(), { h });
const moving = (label, draw, h, duration, loop = true) => ({ duration, loop, render: t => svg(label, draw(t), { h }) });
const scenes = {
  divide: moving('One round cell with a darker nucleus grows, pinches in at the middle and splits into two cells, each a full copy.', dividePic, 284, 4200),
  dna: still('One cell drawn large, with a round nucleus holding several coloured rod-shaped chromosomes. A dashed line leads from one chromosome to its DNA, unwound: two twisting strands joined by rungs, like a twisted ladder.', dnaPic, 372),
  cycle: moving('The cell cycle as a ring of four coloured stages, read clockwise from the top: G1, grow; S, copy the DNA; G2, check; and M, split. A cell travels round the ring: it grows in G1, its chromosome doubles in S, it is checked in G2 and it pinches in two in M.', cyclePic, 372, 8000),
  g1: moving('The ring with its first stage, G1, lit in blue. A small new cell travels round G1, growing, until it reaches a thick black bar across the ring at the end of G1: the checkpoint.', g1Pic, 372, 5200),
  cdk: moving('A close-up of the G1 checkpoint: a cell waits at a gate held shut by a brake labelled Rb. A blue CDK engine and its amber partner, cyclin D, come together, release the brake, and the gate swings open; the cell moves on to S phase. A small ring in the corner marks G1.', cdkPic, 340, 5600, false),
  s: moving('A close-up of DNA being copied: the parent DNA comes in from the left and unzips at a fork into two strands, and new coloured building blocks drop into place one by one along each strand. A small ring in the corner marks S phase.', forkPic, 340, 4800),
  untwist: moving('A close-up of DNA twisted like a rope. As it is copied, the DNA on the left winds tighter; a purple topoisomerase clamps it, cuts it, lets it spin loose and joins it again, and the twists relax. A small ring in the corner marks S phase.', untwistPic, 360, 4800),
  g2: moving('The ring with its third stage, G2, lit in purple. A cell travels through G2; in the middle, a magnifier passes over a doubled chromosome and finds a red break. The cell can fix it, stop, or destroy itself.', g2Pic, 372, 5000),
  m: moving('A close-up of a cell in M phase. Doubled chromosomes line up across the middle; green spindle ropes run to them from a pole at each end and shrink, pulling one copy to each end; then the cell pinches in two. A small ring in the corner marks M phase.', mPic, 350, 5600),
  g0: moving('The ring, and beside it a dashed box labelled G0, resting, full of grey resting cells. One cell steps out of G1 into the box, and one resting cell steps back into the loop.', g0Pic, 372, 5200),
  whole: moving('Healthy tissues that divide all the time: a bone with its marrow, where cells divide and new blood cells stream out into the blood; the gut lining; and hair roots. The key measures are named below: tumour size and new blood cells.', wholePic, 400, 4000),
};
for (const k of Object.keys(DRUG_OPT)) scenes[k] = change(k);

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
const barSpan = v => hasRange(v) ? [Math.max(0, v.low - (v.high - v.low)), v.high + (v.high - v.low)] : [v.typical * 0.5, v.typical * 1.5];
const barX = (v, n) => { const [a, b] = barSpan(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
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
  s += `<rect x="20" y="70" width="160" height="150" rx="70" fill="#f4ead8" stroke="${C.ink}" stroke-width="2"/><rect x="40" y="96" width="120" height="98" rx="46" fill="#f2c9bf"/>`;
  const nDiv = Math.round(8 * cv.marrow);
  for (let i = 0; i < 8; i++) {
    const x = 66 + (i % 4) * 23, y = 126 + Math.floor(i / 4) * 34;
    s += i < nDiv ? pinched(x, y, 8, 4, MARROW) : circle(x, y, 8, 'none', C.muted, 1.3, 'data-marrow-ghost stroke-dasharray="2 2"');
  }
  s += text(100, 246, 'marrow: cells dividing', 'xs b', 'middle') + arrowTo(190, 145, 236, 145, C.muted, 2.2) + text(212, 132, 'new', 'xs muted');
  s += `<path d="M360 50 C 420 124 440 160 440 190 A80 80 0 0 1 280 190 C280 160 300 124 360 50 Z" fill="#fbe9e6" stroke="${C.red}" stroke-width="2"/>`;
  const RBC = [[300, 200], [334, 176], [368, 150], [402, 180], [420, 218], [300, 240], [340, 262], [392, 258], [428, 248], [356, 214], [384, 112], [326, 222]];
  const inDrop = ([x, y]) => [f(360 + (x - 360) * 0.82), f(190 + (y - 190) * 0.82)];
  RBC.map(inDrop).forEach(([x, y]) => { s += `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" fill="#d9524a" opacity=".8"/>`; });
  const WBC = [[318, 206], [352, 186], [386, 206], [366, 240], [404, 232], [336, 244], [372, 168], [420, 196], [310, 228], [396, 264], [350, 140], [288, 218]];
  const nW = clamp(Math.round(6 * wRel), 0, WBC.length);
  const W = WBC.map(inDrop);
  for (let i = 0; i < nW; i++) s += circle(W[i][0], W[i][1], 9, '#fff', C.blue, 2.5, 'data-blood-wbc') + circle(W[i][0], W[i][1], 3.5, C.blue);
  s += text(360, 292, 'blood: white cells are blue rings', 'xs b', 'middle');
  return svg(label, s, { h: 304 });
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
// Tumour size and new blood cells over time on top; below, the share of living tumour cells in each phase.
function explorePicture(cur, base, runs, ghostRun, label) {
  const E = { x0: 60, x1: 456, y0: 196, h: 150 }, T = CC.T_END;
  const X = t => f(E.x0 + (E.x1 - E.x0) * t / T);
  const gT = ghostRun.tum.series, gM = CC.BASE.mar.series, endT = gT.size[gT.size.length - 1];
  const tumD = ser => ser.t.map((t, i) => `${i ? 'L' : 'M'}${X(t)} ${f(E.y0 - E.h * clamp(ser.size[i] / endT, 0, 1.1))}`).join(' ');
  const marD = ser => ser.t.slice(1).map((t, i) => `${i ? 'L' : 'M'}${X(t)} ${f(E.y0 - E.h * 0.8 * clamp(ser.made[i + 1] / gM.made[i + 1], 0, 1.3))}`).join(' ');
  let s = line(E.x0, 30, E.x0, E.y0, C.ink, 2) + line(E.x0, E.y0, E.x1 + 8, E.y0, C.ink, 2);
  s += text(16, 22, 'amount ↑', 'xs b', 'start') + text(E.x1 + 8, E.y0 + 24, 'time →', 'xs b', 'end');
  s += path(tumD(gT), C.ghost, 2.2, 'stroke-dasharray="6 5"') + path(marD(gM), C.ghost, 2.2, 'stroke-dasharray="6 5"');
  s += path(tumD(runs.tum.series), C.ink, 4) + path(marD(runs.mar.series), MARROW, 4);
  s += text(470, 52, 'tumour size', 'xs b', 'end') + text(470, 74, 'new blood cells', 'xs b red', 'end');
  s += text(16, 252, 'share of living tumour cells (dashed: untreated)', 'xs b muted', 'start');
  [['shG0', 'G0 resting', C.muted], ['shG1', 'G1', C.blue], ['shS', 'S', C.amber], ['shG2', 'G2', C.purple], ['shM', 'M', C.green]].forEach(([k, w, col], i) => {
    const y = 270 + i * 27;
    s += text(16, y + 13, w, 'xs', 'start');
    s += rect(140, y, 300 * clamp(base[k] / 0.6, 0, 1), 15, 'none', C.ink, 1.5, 'stroke-dasharray="4 3"');
    s += rect(140, y, 300 * clamp(cur[k] / 0.6, 0, 1), 15, col);
  });
  return svg(label, s, { h: 410 });
}
function updateExplore() {
  $('#speed').value = ex.speed; $('#speed-label').textContent = speedWords(ex.speed);
  $('#stop-half').checked = ex.stopHalf;
  $$('#drugs input').forEach(c => { c.checked = ex.drugs.has(c.value); });
  const opt = exploreOpts(), cur = CC.settle(opt), runs = CC.run(opt);
  const base = CC.settle({ speed: ex.speed }), ghostRun = ex.speed === 1 ? CC.BASE : CC.run({ speed: ex.speed });
  const names = CC.DRUGS.filter(d => ex.drugs.has(d)).map(d => EX_NAMES[d]);
  const who = `a tumour whose cells divide ${speedWords(ex.speed)}${names.length ? `, treated with ${names.join(', ')}` : ', untreated'}${names.length && ex.stopHalf ? ', with the drug stopped halfway' : ''}`;
  const label = `Illustrative model of ${who}, drawn over faint dashed marks for the untreated tumour of the same speed. The top panel plots tumour size and new blood cells over time; the bars below show what share of the living tumour cells sits in each phase. Compared with untreated: ${describe(cur, base)}.`;
  $('#explore-visual').innerHTML = explorePicture(cur, base, runs, ghostRun, label) + readout(changedFirst(compare(cur, base)), 'Compared with untreated');
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
  updateClinical();
  updateExplore();
}

lesson({ scenes, before: load, onTab: { clinical: updateClinical, explore: updateExplore } });
