// Lesson 29: Myelin and conduction velocity. The kit (/lab/kit/kit.js) runs the page; this file holds the
// pictures, drawn with the shared art library (/lab/kit/art/), and the Clinical values and Explore freely tabs.
//
// Expected behaviour (a single lesson has no test runner: lab-check and lab-walk are its tests):
//   - Every picture is 480 wide and at most 420 tall, set in the kit's text classes, with no two labels
//     overlapping at any moment.
//   - Colour means one thing: the axon is nerve yellow, myelin is near-white with its own outline, sodium
//     channels are sage. Kit blue is the impulse and every change (an arrow, or the words that name it);
//     red is harm: myelin stripped, charge leaking away, a block.
//   - The fiber pictures (steps 11 to 15, both reference tabs) are drawn from model.js: eight internodes
//     between nine nodes, a damaged patch from the third internode on. A node fires (a blue dot) only if the
//     model lifts it to threshold; the timing bar under the fiber is the model's time to the far end, over
//     a dashed bar for the healthy fiber (or the bare axon, in the saltatory step).
//   - When the impulse is blocked, no action potential reaches the far end, so the far end shows "No peak",
//     never a lower voltage or a zero speed.
//   - No reference number lives in this file. The resting, threshold and peak voltages come from
//     clinical-values.json; if it cannot load, the pictures run on a stated illustrative stand-in.
import { lesson } from '/lab/kit/kit.js';
import { svg, text, f, clamp, lerp, ease, span, readout, esc } from '/lab/kit/draw.js';
import { P, fill, mix, blob, artGhost, arrowFixed, leader, tube, magnifier } from '/lab/kit/art/core.js';
import { ion } from '/lab/kit/art/molecules.js';
import { INTERNODES, PATCH_START, PRESETS, FULL_RISE, anchorsFrom, solve, lastPassingLoss } from './model.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BLUE = P.ui.blue, INK = P.ui.ink, RED = P.ui.red, MUTED = P.ui.muted;

// If clinical-values.json cannot load: voltages in illustrative units above rest, said so on the page. The
// gap from rest to threshold keeps the same share of the full lift as the data file gives, so the lesson's
// pictures and words (block past three quarters lost) still hold.
const STAND_IN = { rest: 0, threshold: 15, peak: 100 };
let anchors = null, cv = null;
const A = () => anchors || STAND_IN;

/* ---------- Small helpers ---------- */
const at = (g, x, y, extra = '') => `<g transform="translate(${f(x)} ${f(y)})"${extra}>${g}</g>`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const rrect = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`; };
const circleD = (x, y, r) => `M${f(x - r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)} Z`;
const arrowB = (a, b, { col = BLUE, w = 3 } = {}) => arrowFixed(a, b, { col, w, head: { l: 10, w: 6 } });
const ghostG = body => `<g data-ghost="normal">${body}</g>`;
const NA = ion('na').svg;

// The axon: one nerve-yellow tube. The myelin sheath: near-white segments with their outline and two faint
// layer lines (detail). A sodium channel at a node: a small sage protein in the membrane.
const axonTube = (x0, x1, y, w = 12) => tube(`M${f(x0)} ${f(y)} H${f(x1)}`, { wall: 'nerve', lumen: { base: P.nerve.hi }, w, lumenW: w * 0.45, highlight: false, cap: 'round' }).svg;
function sheathSeg(xa, xb, y, h, op = 1) {
  const r = Math.min(h / 2, 9), w = xb - xa;
  const layers = h > 22 ? [-0.24, 0.24].map(k => `<path d="M${f(xa + r)} ${f(y + k * h)} H${f(xb - r)}" stroke="${P.myelin.lo}" stroke-width=".9" class="ax-d2"/>`).join('') : '';
  return `<g ${fade(op)}><path d="${rrect(xa, y - h / 2, w, h, r)}" fill="${fill('myelin')}" stroke="${P.myelin.line}" stroke-width="1.5"/>${layers}</g>`;
}
const chanMark = (x, y) => `<rect x="${f(x - 4.5)}" y="${f(y - 5.5)}" width="9" height="11" rx="3" fill="${fill('protein')}" stroke="${P.protein.line}" stroke-width="1.1"/>`;
const glow = (x, y, k = 1) => k <= 0.01 ? '' : `<g data-part="impulse" ${fade(k)}><circle cx="${f(x)}" cy="${f(y)}" r="17" fill="${BLUE}" fill-opacity=".2"/><circle cx="${f(x)}" cy="${f(y)}" r="8" fill="${BLUE}" fill-opacity=".75"/></g>`;
const cross = (x, y, s = 8) => `<path d="M${f(x - s)} ${f(y - s)} L${f(x + s)} ${f(y + s)} M${f(x + s)} ${f(y - s)} L${f(x - s)} ${f(y + s)}" stroke="${RED}" stroke-width="3.5" stroke-linecap="round"/>`;
const firedDot = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="${BLUE}"/>`;

/* ---------- The model's fiber (steps 11 to 15, Explore, Clinical values) ---------- */
// Nine nodes from FX0 to FX1; the sheath fills each internode but a 10-unit node gap.
const FX0 = 40, FX1 = 440, FS = (FX1 - FX0) / INTERNODES, SHEATH_H = 30, AXON_W = 12;
const nodeX = i => FX0 + i * FS;
const inPatch = (k, len) => k >= PATCH_START && k < PATCH_START + len;
// formed: how far the sheath has grown (0 bare, 1 whole); lossOf(k): share of internode k's myelin lost (0 to 1);
// ghostOf(k): draw internode k's normal sheath as a dashed outline; patchPart: the data-part of the damaged sheath.
function fiberBody(y, { formed = 1, lossOf = () => 0, ghostOf = () => false, patchPart = 'lost', channels = true } = {}) {
  let b = `<g data-part="axon">${axonTube(FX0 - 18, FX1 + 18, y)}</g>`;
  if (formed > 0.01) {
    let healthy = '', patch = '', ghost = '';
    for (let k = 0; k < INTERNODES; k++) {
      const L = clamp(lossOf(k), 0, 1), xa = nodeX(k) + 5, xb = nodeX(k + 1) - 5;
      const h = lerp(lerp(AXON_W + 3, SHEATH_H, formed), AXON_W + 3, L), op = formed < 1 ? formed : 1 - 0.7 * L;
      const seg = L > 0.985 ? '' : sheathSeg(xa, xb, y, h, op);
      if (L > 0.001) patch += seg; else healthy += seg;
      if (ghostOf(k)) ghost += artGhost(rrect(xa, y - SHEATH_H / 2, xb - xa, SHEATH_H, 9));
    }
    b += `<g data-part="sheath">${healthy}</g>`;
    if (patch) b += `<g data-part="${patchPart}">${patch}</g>`;
    if (channels && formed > 0.5) b += `<g data-part="channels" ${fade((formed - 0.5) * 2)}>${Array.from({ length: INTERNODES + 1 }, (_, i) => chanMark(nodeX(i), y - 6) + chanMark(nodeX(i), y + 6)).join('')}</g>`;
    if (ghost) b += ghostG(ghost);
  }
  return b;
}
// Where the live impulse is at time tau, on a myelinated fiber: fired nodes, the charge travelling to the next
// node (a blue streak over the sheath) and, if blocked, that charge fading out short of the next node.
function saltRun(y, m, tau, { jumps = false } = {}) {
  const T = m.times;
  let b = '', i = -1;
  for (let j = 0; j < T.length; j++) if (tau >= T[j]) i = j;
  if (i < 0) return '';
  let dots = '', arcs = '';
  for (let j = 0; j <= i; j++) {
    dots += firedDot(nodeX(j), y);
    if (jumps && j > 0) arcs += `<path d="M${f(nodeX(j - 1) + 4)} ${f(y - 22)} Q${f(nodeX(j - 1) + FS / 2)} ${f(y - 46)} ${f(nodeX(j) - 4)} ${f(y - 22)}" fill="none" stroke="${BLUE}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
  }
  if (arcs) b += `<g data-part="jump">${arcs}</g>`;
  b += `<g data-part="impulse">${dots}</g>`;
  const x = nodeX(i);
  if (i + 1 < T.length) {
    const p = (tau - T[i]) / (T[i + 1] - T[i]);
    b += `<path d="M${f(x)} ${f(y)} H${f(x + p * FS)}" stroke="${BLUE}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>` + glow(x, y, 1 - p);
  } else if (m.blockedAt != null) {
    const p = clamp((tau - T[i]) / (m.failTime - T[i]), 0, 1);
    b += `<path d="M${f(x)} ${f(y)} H${f(x + (0.15 + 0.5 * p) * FS)}" stroke="${BLUE}" stroke-width="3.5" stroke-linecap="round" ${fade(0.8 * (1 - p))}/>` + glow(x, y, 1 - p);
    if (p >= 1) b += `<g data-part="block">${cross(nodeX(m.blockedAt), y)}</g>`;
  } else b += glow(x, y, 1);
  return b;
}
// A bare axon: every patch fires in turn; a short trail of just-fired patches follows the impulse.
function bareRun(y, pos, { x0 = FX0, part = 'wave', head = true } = {}) {
  let ticks = '';
  for (let x = x0; x <= pos; x += 10) ticks += `<path d="M${f(x - 3)} ${f(y)} H${f(x + 3)}" stroke="${BLUE}" stroke-width="4" stroke-linecap="round" ${fade(Math.max(0.22, 1 - (pos - x) / 70))}/>`;
  return `<g data-part="${part}">${ticks}</g>` + (head ? glow(pos, y, 1) : '');
}
// The ghost impulse: a dashed ring where the normal fiber's impulse is at the same moment.
function ghostRing(y, m, tau) {
  if (tau <= 0) return '';
  let x;
  if (m.bare) x = lerp(FX0, FX1, clamp(tau / m.arrival, 0, 1));
  else {
    const T = m.times;
    let i = 0;
    while (i < T.length - 1 && tau >= T[i + 1]) i++;
    x = i >= T.length - 1 ? FX1 : lerp(nodeX(i), nodeX(i + 1), (tau - T[i]) / (T[i + 1] - T[i]));
  }
  return ghostG(artGhost(circleD(x, y, 14)));
}
// The timing bar: the live time so far over a dashed bar for the normal time, scaled to tmax.
const BX = 40, BW = 400;
function timeBars(y, { live, ghost, tmax, ghostLabel = 'dashed: healthy' }) {
  const k = BW / tmax;
  let b = text(BX, y - 10, 'time to reach the far end', 'xs muted', 'start') + text(BX + BW, y - 10, ghostLabel, 'xs muted', 'end');
  b += `<g data-part="clock"><path d="${rrect(BX, y, Math.max(2, live * k), 16, 3)}" fill="${INK}" fill-opacity=".78"/></g>`;
  b += ghostG(artGhost(rrect(BX, y, ghost * k, 16, 3)));
  return b;
}
// The change, named: a blue arrow from the normal bar's end to the live bar's end, and its words.
function barChange(y, liveEnd, ghostEnd, words, op = 1, cls = 'sm b blue') {
  let b = '';
  if (Math.abs(liveEnd - ghostEnd) > 16) b += arrowB([ghostEnd, y], [liveEnd, y]);
  return `<g ${fade(op)}>${b}${text(BX, y + 26, words, cls, 'start')}</g>`;
}

/* ---------- The fiber in a given state, held still (step 15, Explore, Clinical values) ---------- */
const STATE_H = 300;
function statePicture(m, { ghost = true } = {}) {
  const a = A(), need = a.threshold - a.rest, y = 140, healthy = solve(a, PRESETS.healthy);
  let b = text(BX, 24, m.bare ? 'a bare axon: no myelin' : `myelin lost in the patch: ${m.loss}%`, 'sm b', 'start');
  if (!m.bare) {
    // the charge reaching the next node in the patch, against threshold
    const gk = BW / FULL_RISE, tx = BX + need * gk, w = Math.max(2, m.patchRise * gk);
    b += text(BX, 50, 'charge reaching the next node in the patch', 'xs muted', 'start');
    b += `<path d="${rrect(BX, 58, w, 14, 3)}" fill="${m.fires ? BLUE : RED}" fill-opacity=".85"/>`;
    if (ghost) b += ghostG(artGhost(rrect(BX, 58, BW, 14, 3)));
    b += `<g data-part="threshold"><path d="M${f(tx)} 52 V78" stroke="${INK}" stroke-width="2.5"/></g>`;
    b += text(tx, 98, 'threshold', 'xs b');
    if (!m.fires) b += text(tx + 52, 98, 'falls short of threshold', 'xs b red', 'start');
  } else b += text(BX, 60, 'every patch fires in turn', 'xs muted', 'start');
  // the fiber, with the nodes that fire
  b += fiberBody(y, { formed: m.bare ? 0 : 1, lossOf: k => inPatch(k, m.len) ? m.loss / 100 : 0, ghostOf: k => ghost && !m.bare && m.loss > 0 && inPatch(k, m.len) });
  if (m.bare) b += bareRun(y, FX1, { head: false });
  else {
    b += `<g data-part="impulse">${m.times.map((_, i) => firedDot(nodeX(i), y)).join('')}</g>`;
    if (m.blockedAt != null) b += `<g data-part="block">${cross(nodeX(m.blockedAt), y)}</g>`;
  }
  // time to the far end, against the healthy fiber
  const tmax = Math.max(2 * healthy.arrival, m.arrival || 0), yb = 206, k = BW / tmax;
  if (m.arrival != null) {
    b += timeBars(yb, { live: m.arrival, ghost: healthy.arrival, tmax });
    const rel = m.arrival / healthy.arrival;
    b += barChange(yb + 30, BX + m.arrival * k, BX + healthy.arrival * k, rel > 1.005 ? '↑ takes longer: slower velocity' : 'same time as a healthy fiber', 1, rel > 1.005 ? 'sm b blue' : 'sm b muted');
    b += text(BX, yb + 84, 'far end: a full action potential', 'sm b', 'start');
  } else {
    b += text(BX, yb - 10, 'time to reach the far end', 'xs muted', 'start') + text(BX + BW, yb - 10, 'dashed: healthy', 'xs muted', 'end');
    b += ghostG(artGhost(rrect(BX, yb, healthy.arrival * k, 16, 3)));
    b += text(BX, yb + 56, 'blocked: the impulse never arrives', 'sm b red', 'start');
    b += text(BX, yb + 84, 'far end: No peak, it stays at rest', 'sm b red', 'start');
  }
  return b;
}
function stateLabel(m) {
  if (m.bare) return 'A bare axon with no myelin. Every patch fires in turn, and the bar for its time to reach the far end runs far past the dashed bar of a healthy myelinated fiber. A full action potential arrives at the far end.';
  if (m.loss === 0) return 'A healthy myelinated fiber of eight internodes. The charge reaching each node stays well above threshold, every node fires, and the impulse reaches the far end as a full action potential.';
  if (m.fires) return `A myelinated fiber whose patch of ${m.len} internode${m.len > 1 ? 's' : ''} has lost ${m.loss}% of its myelin, drawn over dashed outlines of the healthy sheath. The charge reaching each node in the patch is weaker but still reaches threshold, so every node fires; the timing bar runs past the dashed healthy bar: the impulse is slower, and arrives as a full action potential.`;
  return `A myelinated fiber whose patch has lost ${m.loss}% of its myelin, drawn over dashed outlines of the healthy sheath. The charge reaching the next node falls short of threshold, marked by a red cross: that node never fires, no impulse reaches the far end, and the far end shows no peak.`;
}
function rowsFor(m) {
  if (m.bare) return [['Myelin', 'down', 'none'], ['Places that fire', 'up', 'every patch, in turn'], ['Conduction velocity', 'down', 'much slower'], ['Far-end peak', 'same', 'a full action potential']];
  const lost = m.loss > 0;
  return [
    ['Myelin in the patch', lost ? 'down' : 'same', lost ? `${m.loss}% lost` : 'intact'],
    ['Charge at the next node', lost ? 'down' : 'same', !m.fires ? 'falls short of threshold' : lost ? 'weaker, still reaches threshold' : 'well above threshold'],
    ['Conduction velocity', !m.fires ? 'absent' : lost ? 'down' : 'same', !m.fires ? 'no impulse arrives' : lost ? 'slower' : 'healthy'],
    ['Far-end peak', m.fires ? 'same' : 'absent', m.fires ? 'a full action potential' : 'No peak'],
  ];
}
const HEAD = 'Compared with a healthy fiber';

/* ---------- The "What changes it" runs (steps 12 to 14) ---------- */
// A run: the structure changes first (t 0 to 0.25), then the live impulse races the ghost impulse of the
// normal fiber to the far end, timed by the model; whichever is slower arrives at t = 0.97.
const RUN = {
  saltatory: {
    live: () => PRESETS.healthy, normal: () => PRESETS.bare, ghostLabel: 'dashed: bare axon', head: 'the same length of axon, now wrapped in myelin',
    stages: [[0, 'myelin wraps the axon'], [0.28, 'the impulse jumps from node to node']],
    words: '↓ much less time: faster velocity', readHead: 'Compared with the bare axon',
    rows: [['Myelin', 'up', 'wraps the axon'], ['Places that fire', 'down', 'only the nodes'], ['Conduction velocity', 'up', 'much faster'], ['Far-end peak', 'same', 'a full action potential']],
  },
  ms: {
    live: () => PRESETS.ms, normal: () => PRESETS.healthy, head: 'a fiber in the white matter of the spinal cord', patchLabel: 'plaque: half the myelin lost', patchPart: 'plaque',
    stages: [[0, 'a plaque strips myelin'], [0.28, 'the impulse slows through it']], words: '↑ takes longer: slower velocity',
  },
  gbs: {
    live: () => PRESETS.gbs, normal: () => PRESETS.healthy, head: 'a fiber in a peripheral nerve to the leg', patchLabel: 'half the myelin stripped', patchPart: 'lost',
    stages: [[0, 'the immune attack strips myelin'], [0.28, 'the impulse slows through it']], words: '↑ takes longer: slower velocity',
  },
};
const RUN_H = 330;
function runScene(kind) {
  const c = RUN[kind];
  return {
    duration: kind === 'saltatory' ? 6400 : 5200,
    stages: c.stages,
    render(t) {
      const a = A(), live = solve(a, c.live()), normal = solve(a, c.normal());
      const tmax = Math.max(live.arrival, normal.arrival) * 1.02, morph = ease.inOut(span(t, 0.02, 0.25)), tau = span(t, 0.28, 0.97) * tmax;
      const y = 150, len = live.len, salt = kind === 'saltatory';
      let b = text(BX, 26, c.head, 'xs muted', 'start');
      if (kind === 'ms') {
        // white matter of the spinal cord, and the plaque: a scar where myelin is stripped
        b += `<path d="${rrect(16, 112, 448, 76, 14)}" fill="${P.whiteMatter.base}" stroke="${P.whiteMatter.line}" stroke-width="1.25"/>`;
        b += `<g data-part="plaque" ${fade(morph)}><path d="${rrect(nodeX(PATCH_START) - 6, y - 30, len * FS + 12, 60, 24)}" fill="${mix(P.grey.base, P.whiteMatter.base, 0.35)}" stroke="${P.grey.line}" stroke-width="1.25" stroke-opacity=".6"/></g>`;
      }
      b += fiberBody(y, {
        formed: salt ? morph : 1,
        lossOf: k => !salt && inPatch(k, len) ? live.loss / 100 * morph : 0,
        ghostOf: k => !salt && inPatch(k, len),
        patchPart: c.patchPart || 'lost',
      });
      if (!salt) {
        const x0 = nodeX(PATCH_START), x1 = nodeX(PATCH_START + len), yl = 66;
        b += `<g ${fade(morph)}>${text((x0 + x1) / 2, yl, c.patchLabel, 'sm b red')}<path d="M${f(x0)} ${yl + 20} V${yl + 12} H${f(x1)} V${yl + 20}" fill="none" stroke="${RED}" stroke-width="2"/></g>`;
      } else b += `<g ${fade(span(t, 0.4, 0.55))}>${text(240, 72, 'only the nodes fire', 'sm b blue')}</g>`;
      // the impulses: live, and the ghost of the normal fiber's
      if (tau > 0) {
        b += salt ? saltRun(y, live, tau, { jumps: true }) : saltRun(y, live, tau);
        b += ghostRing(y, normal, tau);
      }
      const yb = 220, k = BW / tmax, liveT = Math.min(tau, live.arrival);
      b += timeBars(yb, { live: liveT, ghost: normal.arrival, tmax, ghostLabel: c.ghostLabel });
      const done = span(t, 0.9, 0.97);
      b += barChange(yb + 30, BX + live.arrival * k, BX + normal.arrival * k, c.words, done);
      b += `<g ${fade(tau >= live.arrival ? 1 : 0)}>${text(BX, yb + 84, 'far end: a full action potential', 'sm b', 'start')}</g>`;
      const label = salt
        ? 'A bare axon becomes wrapped in myelin segments with bare nodes between them. The impulse then jumps from node to node, blue arcs, and its timing bar ends far short of the dashed bar of the bare axon: it reaches the far end much sooner, as a full action potential.'
        : `A myelinated fiber ${kind === 'ms' ? 'in the white matter of the spinal cord, where a plaque' : 'in a peripheral nerve, where an immune attack'} strips half the myelin from ${len} internodes, drawn over dashed outlines of the healthy sheath. Every node still fires, but the impulse slows through the patch: its timing bar runs past the dashed healthy bar, and a full action potential arrives at the far end, late.`;
      return { svg: svg(label, b, { h: RUN_H }), readout: readout(c.rows || rowsFor(live), c.readHead || HEAD) };
    },
  };
}

/* ---------- Conduction block: one patch loses more and more myelin (step 15) ---------- */
const BLOCK_MAX = 90;
const blockLossAt = t => Math.round(BLOCK_MAX * ease.inOut(span(t, 0.05, 0.92)));
const blockFrom = (() => { const pass = lastPassingLoss(STAND_IN); let t = 0; while (t < 1 && blockLossAt(t) <= pass) t += 0.005; return Math.min(0.95, +t.toFixed(3)); })();
const blockScene = {
  duration: 6000,
  stages: [[0, 'myelin thins'], [0.12, 'the impulse slows'], [blockFrom, 'blocked']],
  render(t) {
    const m = solve(A(), { ...PRESETS.block, loss: blockLossAt(t) });
    return { svg: svg(stateLabel(m), statePicture(m), { h: STATE_H }), readout: readout(rowsFor(m), HEAD) };
  },
};

/* ---------- Building the idea (steps 1 to 11) ---------- */
// Step 1: a neuron, its axon, and an impulse running along it.
function neuronPicture(t) {
  const sx = 80, sy = 150;
  let den = '';
  for (const [a, l, s] of [[150, 64, 1], [195, 70, -1], [115, 58, 1], [245, 62, -1], [75, 52, -1], [285, 50, 1]]) {
    const r = a * Math.PI / 180, x0 = sx + 26 * Math.cos(r), y0 = sy + 26 * Math.sin(r), x1 = sx + l * Math.cos(r), y1 = sy + l * Math.sin(r);
    const mx = (x0 + x1) / 2 - s * 8 * Math.sin(r), my = (y0 + y1) / 2 + s * 8 * Math.cos(r);
    const d = `M${f(x0)} ${f(y0)} Q${f(mx)} ${f(my)} ${f(x1)} ${f(y1)}`;
    den += `<path d="${d}" fill="none" stroke="${P.nerve.line}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.nerve.base}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  const soma = `<path d="${blob(sx, sy, 32, { lobes: 5, wobble: 0.1, seed: 3 })}" fill="${fill('nerve')}" stroke="${P.nerve.line}" stroke-width="1.75"/><circle cx="${sx - 4}" cy="${sy - 2}" r="11" fill="${fill('nucleus')}" stroke="${P.nucleus.line}" stroke-width="1.1"/>`;
  let term = '';
  for (const [dx, dy] of [[34, -26], [40, 0], [34, 26]]) {
    const d = `M418 ${sy} Q${418 + dx * 0.5} ${sy + dy * 0.2} ${418 + dx} ${sy + dy}`;
    term += `<path d="${d}" fill="none" stroke="${P.nerve.line}" stroke-width="5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.nerve.base}" stroke-width="3" stroke-linecap="round"/><circle cx="${418 + dx}" cy="${sy + dy}" r="6" fill="${fill('nerve')}" stroke="${P.nerve.line}" stroke-width="1.4"/>`;
  }
  let b = `<g data-part="neuron">${den}${term}</g><g data-part="neuron axon">${axonTube(104, 420, sy)}</g><g data-part="neuron">${soma}</g>`;
  b += glow(lerp(118, 412, t), sy, Math.min(1, t * 12, (1 - t) * 12));
  b += text(24, 266, 'cell body', 'sm b', 'start') + leader([62, 250], [80, 176], { elbow: false });
  b += text(262, 194, 'axon', 'sm b');
  b += text(262, 104, 'impulse travels this way →', 'sm b blue');
  return b;
}

// Steps 2, 3 and 9: how far the spreading charge lifts the membrane above rest, along the axon.
const G = { x0: 40, x1: 440, H: 150 };
const LAMBDA_BARE = 30, LAMBDA_MYELIN = 235;   // in picture units; the myelinated value keeps the lift at the next node, one internode on, at FULL_RISE of the full swing
const thrShare = () => { const a = A(); return (a.threshold - a.rest) / (a.peak - a.rest); };
function curve(src, lambda, base, { x1 = G.x1, stopAt = 0.015 } = {}) {
  const pts = [];
  for (let x = src; x <= x1; x += 3) { const s = Math.exp(-(x - src) / lambda); pts.push([x, base - G.H * s]); if (s < stopAt) break; }
  return 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join(' L');
}
function graphFrame(base, { title = true } = {}) {
  let b = `<path d="M${G.x0} ${base - G.H - 14} V${base} H${G.x1}" fill="none" stroke="${INK}" stroke-width="1.25"/>`;
  if (title) b += text(G.x0, 36, 'lift above the resting voltage', 'xs muted', 'start');
  b += text(G.x1, base + 20, 'rest', 'xs muted', 'end');
  return b;
}
function spreadPicture({ threshold = false } = {}) {
  const base = 210, src = 80, ya = 286;
  let b = graphFrame(base);
  b += `<g data-part="spread"><path d="${curve(src, LAMBDA_BARE, base)}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linecap="round"/></g>`;
  b += text(120, 110, 'spreading charge', 'sm b blue', 'start');
  b += `<g data-part="axon">${axonTube(24, 456, ya)}</g>`;
  // sodium entering where the impulse is
  b += at(NA, 66, 238) + at(NA, 80, 228) + at(NA, 94, 238) + arrowFixed([80, 248], [80, ya - 9], { col: P.ui.amber, w: 2.5, head: { l: 7, w: 4.5 } });
  b += glow(src, ya, 0.8);
  if (!threshold) {
    b += text(110, 244, 'sodium enters', 'xs b amber', 'start');
    let leaks = '';
    for (const x of [120, 160, 200, 240]) { const l = 8 + 22 * Math.exp(-(x - src) / 60); leaks += arrowFixed([x, ya + 8], [x, ya + 8 + l], { col: MUTED, w: 2, head: { l: 7, w: 4 } }); }
    b += `<g data-part="leak">${leaks}${text(262, 318, 'leaks out', 'xs b muted', 'start')}</g>`;
  } else {
    const yT = base - G.H * thrShare(), xc = src - LAMBDA_BARE * Math.log(thrShare());
    b += `<g data-part="threshold"><path d="M${G.x0} ${f(yT)} H${G.x1}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="6 5"/>${text(G.x1, yT - 7, 'threshold', 'xs b', 'end')}</g>`;
    b += `<path d="M${f(xc)} ${f(yT)} V${ya - 10}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="3 4"/>`;
    b += `<path d="M${src} ${ya} H${f(xc)}" stroke="${BLUE}" stroke-width="6" stroke-linecap="round" opacity=".55"/>`;
    b += text(24, 322, 'reaches threshold: fires', 'xs b blue', 'start') + text(300, 322, 'too weak to fire', 'xs b muted', 'start');
  }
  return b;
}
function insulatePicture() {
  const base = 220, src = 60, ya = 300, nodes = [60, 180, 300, 420];
  let b = graphFrame(base, { title: false });
  b += `<path d="M40 22 H70" stroke="${P.ui.ghost}" stroke-width="3" stroke-dasharray="6 5"/>` + text(80, 28, 'bare axon, from step 2', 'xs muted', 'start');
  b += `<path d="M40 50 H70" stroke="${BLUE}" stroke-width="3"/>` + text(80, 56, 'under myelin', 'xs b blue', 'start');
  const yT = base - G.H * thrShare();
  b += `<g data-part="threshold"><path d="M${G.x0} ${f(yT)} H${G.x1}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="6 5"/>${text(G.x1, yT + 17, 'threshold', 'xs b', 'end')}</g>`;
  b += ghostG(`<path d="${curve(src, LAMBDA_BARE, base)}" fill="none" stroke="${P.ui.ghost}" stroke-width="3" stroke-dasharray="6 5"/>`);
  b += `<g data-part="spread"><path d="${curve(src, LAMBDA_MYELIN, base)}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linecap="round"/></g>`;
  const yn = base - G.H * Math.exp(-120 / LAMBDA_MYELIN);
  b += `<path d="M180 ${f(yn + 6)} V${ya - 22}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="3 4"/>` + `<circle cx="180" cy="${f(yn)}" r="5" fill="${BLUE}"/>`;
  b += text(194, 92, 'at the next node:', 'xs b blue', 'start') + text(194, 112, 'still above threshold', 'xs b blue', 'start');
  // the fiber under the graph: sheath segments between the nodes
  b += `<g data-part="axon">${axonTube(12, 468, ya)}</g>`;
  b += `<g data-part="sheath">${[[16, 54], [66, 174], [186, 294], [306, 414], [426, 464]].map(([xa, xb]) => sheathSeg(xa, xb, ya, SHEATH_H)).join('')}</g>`;
  b += `<g data-part="channels">${nodes.map(x => chanMark(x, ya - 6) + chanMark(x, ya + 6)).join('')}</g>`;
  b += glow(src, ya, 0.8) + text(180, ya + 40, 'next node', 'xs muted');
  return b;
}

// Step 4 and 5: a bare axon, firing patch by patch; step 5 adds the timing bar.
function barePicture(t) {
  const y = 140, pos = lerp(FX0, FX1, t);
  let b = text(BX, 60, 'a bare axon: no wrapping', 'xs muted', 'start');
  b += `<g data-part="axon">${axonTube(FX0 - 16, FX1 + 16, y)}</g>` + bareRun(y, pos);
  b += text(240, 210, 'every patch fires in turn', 'sm b blue');
  return b;
}
function velocityPicture(t) {
  const y = 110, pos = lerp(FX0, FX1, t);
  let b = text(FX0, 64, 'start', 'xs muted', 'start');
  b += `<g data-part="end"><path d="M${FX1} 84 V136" stroke="${INK}" stroke-width="2.5"/>${text(FX1, 64, 'far end', 'xs b', 'end')}</g>`;
  b += `<g data-part="axon">${axonTube(FX0 - 16, FX1 + 6, y)}</g>` + bareRun(y, pos);
  b += text(BX, 186, 'time to reach the far end', 'xs muted', 'start');
  b += `<g data-part="clock"><path d="${rrect(BX, 196, Math.max(2, t * BW), 16, 3)}" fill="${INK}" fill-opacity=".78"/></g>`;
  b += `<g ${fade(span(t, 0.97, 1))}>${text(BX + BW, 244, 'arrived: the time it took', 'sm b', 'end')}</g>`;
  return b;
}

// Step 6: myelin wrapped round the axon, with a lens on a cut end.
function myelinPicture() {
  const y = 86, nodes = [60, 180, 300, 420];
  let b = `<g data-part="axon">${axonTube(12, 468, y, 14)}</g>`;
  b += `<g data-part="sheath">${[[16, 54], [66, 174], [186, 294], [306, 414], [426, 464]].map(([xa, xb]) => sheathSeg(xa, xb, y, 38)).join('')}</g>`;
  b += nodes.map(x => chanMark(x, y - 7) + chanMark(x, y + 7)).join('');
  let rings = '';
  for (let r = 37; r <= 77; r += 5) rings += `<circle cx="240" cy="272" r="${r}" fill="none" stroke="${P.myelin.line}" stroke-width=".9" stroke-opacity=".75"/>`;
  const body = `<circle cx="240" cy="272" r="80" fill="${P.myelin.base}" stroke="${P.myelin.line}" stroke-width="1.5"/><g data-part="myelin">${rings}</g><g data-part="axon"><circle cx="240" cy="272" r="32" fill="${fill('nerve')}" stroke="${P.nerve.line}" stroke-width="1.5"/></g>`;
  b += magnifier({ from: { x: 240, y, r: 24 }, to: { x: 240, y: 272, r: 100 }, body }).svg;
  b += text(240, 279, 'axon', 'sm b');
  b += text(20, 34, 'myelin sheath', 'sm b', 'start') + leader([156, 29], [120, 74]);
  b += text(352, 238, 'myelin:', 'sm b', 'start') + text(352, 260, 'many layers', 'xs muted', 'start') + text(352, 280, 'of membrane', 'xs muted', 'start');
  b += leader([346, 232], [298, 250], { elbow: false });
  return b;
}

// Step 7: the oligodendrocyte (brain and spinal cord) and the Schwann cell (peripheral nerves).
function makersPicture() {
  let b = `<g data-part="cns"><path d="${rrect(16, 40, 212, 282, 14)}" fill="${P.whiteMatter.base}" stroke="${P.whiteMatter.line}" stroke-width="1.25"/></g>`;
  b += `<g data-part="pns"><path d="${rrect(252, 40, 212, 282, 14)}" fill="${mix(P.ui.panel, P.nerve.hi, 0.55)}" stroke="${P.nerve.lo}" stroke-width="1.25"/></g>`;
  b += text(24, 64, 'brain and spinal cord', 'xs b muted', 'start') + text(260, 64, 'nerves to the body', 'xs b muted', 'start');
  // left: two axons, three sheath segments, all from one cell
  b += `<g data-part="axon">${axonTube(24, 220, 200, 10)}${axonTube(24, 220, 270, 10)}</g>`;
  const arm = d => `<path d="${d}" fill="none" stroke="${P.myelin.line}" stroke-width="5.5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.myelin.base}" stroke-width="3" stroke-linecap="round"/>`;
  let oligo = arm('M50 124 Q58 160 64 189') + arm('M60 114 Q150 118 180 189') + arm('M54 126 Q122 168 124 259');
  oligo += sheathSeg(34, 94, 200, 24) + sheathSeg(150, 210, 200, 24) + sheathSeg(94, 154, 270, 24);
  oligo += `<path d="${blob(46, 108, 17, { lobes: 3, wobble: 0.12, seed: 5 })}" fill="${fill('myelin')}" stroke="${P.myelin.line}" stroke-width="1.75"/><circle cx="45" cy="107" r="7" fill="${fill('nucleus')}" stroke="${P.nucleus.line}" stroke-width="1.1"/>`;
  b += `<g data-part="oligo">${oligo}</g>`;
  b += text(74, 100, 'oligodendrocyte', 'xs b', 'start') + text(122, 308, 'one cell, several axons', 'xs muted');
  // right: one axon, one Schwann cell per stretch, each with its nucleus
  b += `<g data-part="axon">${axonTube(260, 456, 200, 10)}</g>`;
  let sch = '';
  for (const [xa, xb] of [[266, 354], [366, 454]]) {
    const cx = (xa + xb) / 2;
    sch += sheathSeg(xa, xb, 200, 26) + `<ellipse cx="${cx}" cy="184" rx="15" ry="8" fill="${fill('myelin')}" stroke="${P.myelin.line}" stroke-width="1.4"/><ellipse cx="${cx}" cy="183" rx="8" ry="4.2" fill="${fill('nucleus')}" stroke="${P.nucleus.line}" stroke-width="1"/>`;
  }
  b += `<g data-part="schwann">${sch}</g>`;
  b += text(310, 256, 'Schwann cell', 'xs b') + leader([310, 240], [310, 210], { elbow: false });
  b += text(358, 292, 'each wraps one stretch', 'xs muted');
  return b;
}

// Step 8: a close view of three segments: the nodes, an internode, the sodium channels at a node.
function nodesPicture() {
  const y = 170, nodes = [80, 240, 400];
  let b = `<g data-part="axon">${axonTube(12, 468, y, 20)}</g>`;
  b += `<g data-part="sheath">${sheathSeg(16, 68, y, 60)}${sheathSeg(92, 228, y, 60)}${sheathSeg(412, 464, y, 60)}</g>`;
  b += `<g data-part="internode">${sheathSeg(252, 388, y, 60)}</g>`;
  b += `<g data-part="node">${tube(`M229 ${y} H251`, { wall: 'nerve', lumen: { base: P.nerve.hi }, w: 20, lumenW: 9, highlight: false }).svg}</g>`;
  b += `<g data-part="channels">${nodes.map(x => chanMark(x - 5.5, y - 10) + chanMark(x + 5.5, y - 10) + chanMark(x - 5.5, y + 10) + chanMark(x + 5.5, y + 10)).join('')}</g>`;
  b += text(240, 60, 'node of Ranvier', 'sm b') + leader([240, 68], [240, 150], { elbow: false });
  b += text(320, 106, 'internode', 'xs b') + `<path d="M252 124 V116 H388 V124" fill="none" stroke="${INK}" stroke-width="1.25"/>`;
  b += text(240, 276, 'sodium channels', 'sm b') + leader([240, 258], [245, 184], { elbow: false });
  return b;
}

// Step 10: the central nervous system (brain and spinal cord) and the peripheral nerves.
function mapPicture() {
  const skin = mix(P.ui.panel, P.ui.muted, 0.14);
  let b = `<g fill="none" stroke="${skin}" stroke-linecap="round"><path d="M96 124 L58 252" stroke-width="20"/><path d="M144 124 L182 252" stroke-width="20"/><path d="M107 246 L101 398" stroke-width="24"/><path d="M133 246 L139 398" stroke-width="24"/></g>`;
  b += `<path d="${rrect(88, 108, 64, 146, 16)}" fill="${skin}"/><path d="M110 96 H130 V112 H110 Z" fill="${skin}"/><circle cx="120" cy="62" r="42" fill="${skin}"/>`;
  // peripheral nerves
  const nerve = d => `<path d="${d}" fill="none" stroke="${P.nerve.line}" stroke-width="2.6" stroke-linecap="round"/>`;
  b += `<g data-part="nerves">${nerve('M120 132 Q100 136 88 162 L64 244')}${nerve('M120 132 Q140 136 152 162 L176 244')}${nerve('M120 250 L109 320 L104 394')}${nerve('M120 250 L131 320 L136 394')}${nerve('M120 180 Q104 184 96 200')}${nerve('M120 180 Q136 184 144 200')}</g>`;
  // brain and spinal cord
  b += `<g data-part="cns"><path d="M120 90 V252" stroke="${P.whiteMatter.line}" stroke-width="9" stroke-linecap="round"/><path d="M120 90 V252" stroke="${P.whiteMatter.base}" stroke-width="5.5" stroke-linecap="round"/>`;
  b += `<path d="${blob(120, 60, 30, { lobes: 6, wobble: 0.06, seed: 9 })}" fill="${fill('grey')}" stroke="${P.grey.line}" stroke-width="1.75"/></g>`;
  b += `<g data-part="white"><path d="${blob(120, 62, 19, { lobes: 5, wobble: 0.12, seed: 4 })}" fill="${P.whiteMatter.base}" stroke="${P.whiteMatter.line}" stroke-width="1.1"/></g>`;
  b += text(234, 48, 'white matter', 'sm b', 'start') + leader([228, 43], [128, 62]);
  b += text(234, 160, 'spinal cord', 'sm b', 'start') + leader([228, 155], [123, 160], { elbow: false });
  b += text(234, 184, 'central: with the brain', 'xs muted', 'start');
  b += text(234, 330, 'peripheral nerves', 'sm b', 'start') + leader([228, 325], [130, 318], { elbow: false });
  b += text(234, 354, 'to muscles and skin', 'xs muted', 'start');
  return b;
}

// Step 11: a stretch of the sheath stripped; charge leaks out where it is gone.
function demyelinationPicture() {
  const y = 150, len = 3;
  let b = fiberBody(y, { lossOf: k => inPatch(k, len) ? 0.85 : 0, ghostOf: k => inPatch(k, len) });
  let leaks = '';
  for (let k = PATCH_START; k < PATCH_START + len; k++) { const x = nodeX(k) + FS / 2; leaks += arrowFixed([x, y + 10], [x, y + 36], { col: RED, w: 2.5, head: { l: 8, w: 5 } }) + arrowFixed([x, y - 10], [x, y - 36], { col: RED, w: 2.5, head: { l: 8, w: 5 } }); }
  const x0 = nodeX(PATCH_START), x1 = nodeX(PATCH_START + len);
  b += `<g data-part="lost">${leaks}${text((x0 + x1) / 2, 70, 'myelin stripped', 'sm b red')}<path d="M${x0} 96 V88 H${x1} V96" fill="none" stroke="${RED}" stroke-width="2"/></g>`;
  b += text((x0 + x1) / 2, 216, 'charge leaks out', 'xs b red') + text(80, 216, 'healthy myelin', 'xs muted') + text(380, 216, 'healthy myelin', 'xs muted');
  return b;
}

/* ---------- Scenes, one per step kind ---------- */
const still = (label, draw, h) => () => svg(label, draw(), { h });
const scenes = {
  neuron: { duration: 2600, loop: true, rest: 0.55, render: t => svg('A neuron: a yellow cell body with its nucleus and short branches, and a long axon running to the right, ending in small branches. A blue glow, the impulse, travels along the axon from the cell body toward its far end.', neuronPicture(t), { h: 290 }) },
  spread: still('A graph above a bare axon. Where sodium enters the axon, a blue curve shows the spreading charge lifting the membrane well above its resting voltage; the curve falls off quickly with distance along the axon, and grey arrows show charge leaking out through the membrane, more near the impulse.', () => spreadPicture(), 330),
  threshold: still('The same graph with a dashed threshold line just above rest. Close to the impulse the spreading charge stays above threshold, and that stretch of axon is shaded blue: it can fire. Farther on the curve has fallen below threshold: too weak to fire.', () => spreadPicture({ threshold: true }), 334),
  bare: { duration: 5200, render: t => svg('A bare axon with no wrapping. A blue glow, the impulse, creeps from left to right while every small patch of membrane behind it lights up blue in turn.', barePicture(t), { h: 230 }) },
  velocity: { duration: 5200, render: t => svg('A bare axon from a start mark to a far-end mark. As the impulse creeps along it, a dark timing bar below grows from left to right; it stops when the impulse reaches the far end, showing the time it took.', velocityPicture(t), { h: 262 }) },
  myelin: still('An axon wrapped in white segments of myelin sheath with short bare gaps between them. A lens below shows the cut end: a yellow axon in the middle, surrounded by many thin rings, the layers of membrane that make up myelin.', myelinPicture, 384),
  makers: still('Two panels. Left, brain and spinal cord: one oligodendrocyte reaches out three arms, each wrapping a stretch of sheath, on two different axons. Right, nerves to the body: one axon wrapped by two Schwann cells, each with its nucleus, each wrapping one stretch.', makersPicture, 330),
  nodes: still('A close view of a myelinated axon: thick white sheath segments with short bare gaps, the nodes of Ranvier. Small sage sodium channels sit in the membrane at each node. A bracket marks one internode, the covered stretch between two nodes.', nodesPicture, 292),
  insulate: still('A graph above a myelinated axon. From one node, a solid blue curve shows the spreading charge under myelin falling off slowly: at the next node it is still well above the dashed threshold line. A dashed grey curve, the bare axon, falls below threshold within a short distance.', insulatePicture, 344),
  map: still('A body outline. The brain, with paler white matter inside, and the spinal cord running down the back form the central nervous system. Yellow peripheral nerves branch from the spinal cord out to the arms and legs.', mapPicture, 404),
  demyelination: still('A myelinated axon on which three internodes in the middle have lost most of their sheath, shown faint and thin inside dashed outlines of the healthy sheath. Red arrows show charge leaking out where myelin is stripped; healthy myelin stays on either side.', demyelinationPicture, 230),
  saltatory: runScene('saltatory'),
  ms: runScene('ms'),
  gbs: runScene('gbs'),
  block: blockScene,
};

/* ---------- Explore freely ---------- */
const ui = () => ({ preset: $('#preset'), fiber: $('#fiber'), loss: $('#loss'), len: $('#len') });
const settings = () => { const u = ui(); return { bare: u.fiber.value === 'bare', loss: +u.loss.value, len: +u.len.value }; };
const model = () => solve(A(), settings());
function presetOf(s) {
  if (s.bare) return 'bare';
  if (s.loss === 0) return 'healthy';
  const hit = Object.entries(PRESETS).find(([, p]) => !p.bare && p.loss === s.loss && p.len === s.len);
  return hit ? hit[0] : 'custom';
}
// Explore freely prints no reference voltage (those live only in the Clinical values tab): the charge at a
// node is a share of the healthy fiber's lift, and the far end is described in words.
function renderExplore() {
  const u = ui(), s = settings(), m = model(), a = A();
  $('#explore-visual').innerHTML = svg(stateLabel(m), statePicture(m), { h: STATE_H }) + readout(rowsFor(m), HEAD);
  u.loss.disabled = u.len.disabled = s.bare;
  $('#loss-out').textContent = s.bare ? 'no myelin' : `${s.loss}%`;
  $('#len-out').textContent = `${s.len} internode${s.len > 1 ? 's' : ''}`;
  u.preset.value = presetOf(s);
  const rows = [
    ['time', 'Time to reach the far end', m.arrival == null ? 'never arrives' : `${m.relTime.toFixed(2)} × healthy`],
    ['speed', 'Conduction velocity', m.arrival == null ? 'no impulse arrives' : `${Math.round(m.speed * 100)}% of healthy`],
    ['lift', 'Charge at the next node in the patch', s.bare ? 'not a myelinated fiber' : `${Math.round(m.patchRise / FULL_RISE * 100)}% of a healthy node's, ${m.fires ? 'reaches' : 'falls short of'} threshold (which needs ${Math.round(m.need / FULL_RISE * 100)}%)`],
    ['peak', 'Far end', m.values.peak == null ? 'No peak' : 'a full action potential'],
    ['rest', 'Far end between impulses', 'at its resting voltage'],
  ];
  const name = u.preset.selectedOptions[0]?.textContent || '';
  $('#model-results').innerHTML = `<b>${esc(name)}.</b> ` + rows.map(([k, l, v]) => `${esc(l)}: <span data-model="${k}">${esc(v)}</span>`).join(' · ') + `. In this model a patch can lose up to ${Math.round(lastPassingLoss(a))}% of its myelin and still pass the impulse; more than that blocks it.`;
}
function setSettings(p) {
  const u = ui();
  u.fiber.value = p.bare ? 'bare' : 'myelin';
  u.loss.value = p.loss; u.len.value = p.len;
}
function wireExplore() {
  const u = ui();
  u.preset.addEventListener('change', () => { const p = PRESETS[u.preset.value]; if (p) setSettings(p); update(); });
  for (const el of [u.fiber, u.loss, u.len]) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', update);
  $('#reset').addEventListener('click', () => { setSettings(PRESETS.healthy); update(); });
}

/* ---------- Clinical values ---------- */
const DIRECTION = { up: '↑ Expected to rise', down: '↓ Expected to fall', none: '↔ Expected to stay the same', variable: '↕ Can go either way' };
const fmtV = (v, x) => `${x > 0 && v.display.startsWith('+') ? '+' : ''}${x.toFixed(v.decimals ?? 0)}`;
function scaleFor(v) { const sp = Math.abs(v.typical) * 0.4 || 10; return [v.typical - sp, v.typical + sp]; }
const posOf = v => { const [lo, hi] = scaleFor(v); return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, x) { const rel = (x - v.typical) / Math.abs(v.typical); return Math.abs(rel) < 0.02 ? 'close to the typical value' : rel > 0 ? 'above the typical value' : 'below the typical value'; }
function selectedState() {
  if (!cv) return null;
  const id = presetOf(settings());
  return cv.states.find(s => s.model === id) || null;
}
function buildClinical() {
  $('#disclaimer').textContent = cv.disclaimer;
  const sel = $('#clinical-state');
  sel.innerHTML = cv.states.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') + '<option value="custom">Custom model settings</option>';
  // "Custom" only reports settings made in Explore freely: it is disabled while a named state is shown, and
  // picking it never leaves the selector out of step with the model (update() sets it back from the settings).
  sel.addEventListener('change', e => { const st = cv.states.find(s => s.id === e.target.value); if (st) setSettings(PRESETS[st.model]); update(); });
  $('#clinical-loss').addEventListener('input', e => { const u = ui(); u.fiber.value = 'myelin'; u.loss.value = e.target.value; update(); });
  $('#clinical-reset').addEventListener('click', () => { setSettings(PRESETS.healthy); update(); });
  for (const v of cv.values) {
    const pos = posOf(v), row = document.createElement('div');
    row.className = 'value-row'; row.dataset.cv = v.id;
    const left = document.createElement('div');
    left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
    left.querySelector('h3').textContent = v.label;
    const right = document.createElement('div');
    right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/><path class="typical" d="M${pos(v.typical)} 8 V38"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/></svg><div class="key"></div>`;
    right.querySelector('svg').setAttribute('aria-label', `${v.label}: the cited typical value as a tick, and a blue marker for the teaching model`);
    const [lo, hi] = scaleFor(v);
    right.querySelector('.key').textContent = `Cited typical value ${v.display} ${v.unit} (tick; no range given) · bar runs ${fmtV(v, lo)} to ${fmtV(v, hi)} · blue line: model`;
    const cite = document.createElement('div');
    cite.className = 'citation';
    cite.textContent = `"${v.excerpt}" ${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
    row.append(left, right, cite);
    $('#value-rows').append(row);
  }
  for (const [id, citation] of Object.entries(cv.sources)) {
    const li = document.createElement('li');
    li.textContent = `[${id}] ${citation}`;
    $('#sources').append(li);
  }
  const at = cv.attribution;
  if (at) {
    const access = esc(at.access).replace(esc(at.accessUrl), `<a href="${esc(at.accessUrl)}">${esc(at.accessUrl)}</a>`);
    $('#cv-attribution').innerHTML = `${esc(at.text)} ${access}. ${esc(at.license)} <a href="${esc(at.licenseUrl)}">${esc(at.licenseUrl)}</a>`;
  }
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = false; });
}
function renderClinical() {
  if (!cv) return;
  const m = model(), u = ui(), st = selectedState();
  $('#clinical-visual').innerHTML = svg(`The teaching model now. ${stateLabel(m)}`, statePicture(m), { h: STATE_H });
  $('#clinical-loss').value = u.loss.value;
  $('#clinical-loss-label').textContent = m.bare ? 'no myelin' : `${u.loss.value}%`;
  const sel = $('#clinical-state'), customOpt = sel.querySelector('option[value="custom"]');
  if (customOpt) { customOpt.disabled = !!st; customOpt.textContent = st ? 'Custom model settings (change the slider or Explore freely)' : 'Custom model settings'; }
  sel.value = st ? st.id : 'custom';
  $('#state-summary').textContent = st ? `${st.label}. ${st.summary}` : 'Custom model settings: no cited state matches, so no directions are shown.';
  $('#state-evidence').innerHTML = st ? st.evidence.map(q => `<p>"${esc(q.excerpt)}" <span>${esc(q.where)} [${esc(q.source)}]</span></p>`).join('') + (st.unstatedNote ? `<p>${esc(st.unstatedNote)}</p>` : '') : '<p>Custom model settings: no cited state matches, so no directions are shown.</p>';
  for (const v of cv.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const x = m.values[v.modelKey], mk = row.querySelector('.marker');
    if (x == null) {
      row.querySelector('.reading').textContent = 'No peak';
      row.querySelector('.status').textContent = 'Model: no action potential reaches the far end, so there is no peak to read';
      mk.style.visibility = 'hidden';
    } else {
      row.querySelector('.reading').textContent = `${fmtV(v, x)} ${v.unit}`;
      row.querySelector('.status').textContent = `Model: ${statusFor(v, x)}`;
      const px = posOf(v)(x);
      mk.setAttribute('x1', px); mk.setAttribute('x2', px); mk.style.visibility = '';
    }
    const dir = row.querySelector('.direction'), d = st?.shifts?.[v.id], absent = st?.absent?.[v.id];
    dir.textContent = !st ? '' : d ? `${DIRECTION[d]} (${st.label.toLowerCase()})` : absent ? `No peak: ${absent.charAt(0).toLowerCase()}${absent.slice(1)}` : 'No direction stated by the cited sources';
    dir.classList.toggle('quiet', !d);
  }
}
function update() { renderExplore(); renderClinical(); }

/* ---------- Start ---------- */
async function load() {
  $$('#clinical select, #clinical input, #clinical button').forEach(el => { el.disabled = true; });
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    for (const id of ['rest', 'threshold', 'peak']) if (typeof data.values?.find(v => v.id === id)?.typical !== 'number') throw new Error(`no ${id}`);
    cv = data;
    anchors = anchorsFrom(cv);
    buildClinical();
  } catch (err) {
    cv = null;
    anchors = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = `The reference file did not load (${err.message}). Reload the page to try again; the lesson and Explore freely run on an illustrative stand-in, in units above rest, meanwhile.`;
  }
  wireExplore();
  setSettings(PRESETS.healthy);
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
