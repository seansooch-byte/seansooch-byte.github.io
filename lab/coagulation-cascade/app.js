// Lesson 12: The coagulation cascade. The kit (/lab/kit/kit.js) runs the page; this file is the model, the pictures
// and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number((+n).toFixed(1));
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- Teaching model ----------
   Everything is relative to a normal clot, which scores 1 on each part. plt is the platelet count as a multiple of the
   baseline; the six drug strengths run from 0 (absent) to 1 (on board). The sizes are illustrative; only directions teach.
   Heparin works through antithrombin, the natural brake: it speeds the brake, which switches off factor Xa and thrombin.
   Vitamin K antagonists leave the vitamin K–dependent factors (II, VII, IX, X) and brakes (proteins C and S) unfinished. */
const NORMAL = { plt: 1, hep: 0, vka: 0, xai: 0, dti: 0, apl: 0, lys: 0 };
function model(s) {
  const plug = (s.plt * 1.5 / (s.plt + 0.5)) * (1 - 0.6 * s.apl);     // more platelets, bigger plug, levelling off
  const surface = 0.6 + 0.4 * Math.min(plug, 1.3);                     // platelet surface helps make thrombin
  const factors = 1 - 0.65 * s.vka;                                    // working factors II, VII, IX and X
  const cs = 1 - 0.65 * s.vka;                                         // working proteins C and S (drawn, not modelled further)
  const brake = 1 + 2 * s.hep;                                         // antithrombin's pull, sped up by heparin
  const ten = factors * (1 - 0.75 * s.xai) * (1 - 0.5 * s.hep);         // switched-on factor X left after drugs and brake
  const thrombin = ten * surface * (1 - 0.5 * s.hep) * (1 - 0.8 * s.dti);
  const plasmin = 1 + 3 * s.lys;
  const mesh = thrombin * (1 - 0.8 * s.lys);
  return { s, plug, factors, cs, brake, ten, thrombin, plasmin, mesh };
}
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };
const BASE = model(NORMAL);
const leakOf = o => clamp(1.1 - o.plug - 0.5 * o.mesh, 0, 1);

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17). */
const INK = '#171916', BLUE = '#254dff', RED = '#b3261e', FIB = '#8a4f00', RULE = '#babeb3', MUTED = '#53584d', AMBER = '#a34700';
const LUMEN = '#f6e4df', WALL = '#e2ada1', TISSUE = '#e9e1cf', CELL = '#cf5a4c', CELLD = '#962a1f', CELLC = '#e48b7f', PLT = '#bac6ff', COLL = '#7c6036';
let pictureId = 0;  // each picture gets its own ids, so a marker or clip in a hidden step never goes missing
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [RED]: 'r', [FIB]: 'f', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const part = (name, body) => `<g data-part="${name}">${body}</g>`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const leader = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="1.3"/>`;

/* ---------- The vessel, drawn from the side ---------- */
const VY = 22, TOPIN = VY + 24, I = VY + 164, B = VY + 190, VH = B + 74;   // walls, inner edge, outer edge, picture height
const GAP = [196, 284];                                                   // the tear in the lower wall
const bump = (x, s) => { const d = (x - 240) / 110; return Math.abs(d) >= 1 ? 0 : s * 22 * (Math.cos(d * Math.PI) + 1) / 2; };
function walls(s) {
  let top = `M0 ${VY} H480`;
  for (let x = 480; x >= 0; x -= 10) top += ` L${x} ${f(TOPIN + bump(x, s))}`;
  let left = `M0 ${B}`;
  for (let x = 0; x <= GAP[0]; x += 14) left += ` L${x} ${f(I - bump(x, s))}`;
  left += ` L${GAP[0]} ${f(I - bump(GAP[0], s))} L${GAP[0] - 6} ${I + 9} L${GAP[0] + 1} ${I + 16} L${GAP[0] - 5} ${B} Z`;
  let right = `M480 ${B}`;
  for (let x = 480; x >= GAP[1]; x -= 14) right += ` L${x} ${f(I - bump(x, s))}`;
  right += ` L${GAP[1]} ${f(I - bump(GAP[1], s))} L${GAP[1] + 6} ${I + 9} L${GAP[1] - 1} ${I + 16} L${GAP[1] + 5} ${B} Z`;
  const st = `fill="${WALL}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`;
  return `<path d="${top} Z" ${st}/><path d="${left}" ${st}/><path d="${right}" ${st}/>`;
}
const cell = (x, y, k = 1) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(15 * k)}" ry="${f(8 * k)}" fill="${CELL}" stroke="${CELLD}" stroke-width="1.5"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(7 * k)}" ry="${f(3 * k)}" fill="${CELLC}"/>`;
const flat = (x, y, k = 1) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(6 * k)}" ry="${f(2.8 * k)}" fill="${PLT}" stroke="${BLUE}" stroke-width="1.5"/>`;
function spiky(x, y, R = 7.5) {
  let p = '';
  for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7, r = i % 2 ? R * .55 : R; p += `${i ? 'L' : 'M'}${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }
  return `<path d="${p}Z" fill="${PLT}" stroke="${BLUE}" stroke-width="1.4"/>`;
}
const rod = (x, y, a) => `<path d="M${x - 8} ${y} H${x + 8}" transform="rotate(${a} ${x} ${y})" stroke="${FIB}" stroke-width="3.2" stroke-linecap="round"/>`;
const drop = (x, y, op) => `<path d="M${x} ${y - 9} C${x + 7} ${y} ${x + 6} ${y + 8} ${x} ${y + 8} C${x - 6} ${y + 8} ${x - 7} ${y} ${x} ${y - 9}Z" fill="${CELL}" stroke="${CELLD}" stroke-width="1.2" opacity="${op}"/>`;
const CELLS = [[34, 64], [86, 150], [128, 80], [166, 128], [214, 92], [270, 112], [322, 80], [356, 150], [402, 96], [448, 140], [30, 168], [458, 62]];
const FLOAT = [[60, 58], [110, 176], [150, 104], [200, 70], [236, 136], [300, 150], [340, 112], [384, 58], [430, 172], [470, 104], [20, 120], [252, 60], [96, 108], [180, 170], [318, 176], [420, 128], [134, 56], [56, 140], [362, 172], [456, 40]];
const STUCK = [[200, I + 2], [206, I - 9], [199, I + 14], [281, I + 3], [274, I - 8], [283, I + 15]];
const RODS = [[70, 92, 20], [150, 64, -30], [300, 126, 40], [372, 84, -15], [420, 156, 60], [112, 140, -50], [250, 92, 10]];
// Platelet positions for the plug, filled from the bottom of the tear outward; n0 of them make the normal plug.
const PLUG = (() => {
  const pts = [];
  for (let row = 0, y = B + 4; y >= B - 76; y -= 10, row++) for (let x = 162 + (row % 2) * 6; x <= 318; x += 12) {
    const nd = Math.hypot((x - 240) / 58, (y - B) / 50);
    if (nd > 1.4 || (y > I - 4 && (x < 192 || x > 288))) continue;
    pts.push({ x, y, nd });
  }
  pts.sort((a, b) => a.nd - b.nd);
  return { pts, n0: pts.filter(p => p.nd <= 1).length };
})();
// Fibrin threads across the plug (a fixed pseudo-random set, so every picture draws the same threads).
const THREADS = (() => {
  let x = 11; const r = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < 16; i++) { const y1 = B - 52 + r() * 60, y2 = B - 52 + r() * 60, x1 = 176 + r() * 14, x2 = 290 + r() * 14, cy = B - 74 + r() * 84; out.push(`M${f(x1)} ${f(y1)} Q240 ${f(cy)} ${f(x2)} ${f(y2)}`); }
  return out;
})();
const NORMAL_THREADS = 12;
function plugBody(amt) {
  const n = Math.min(PLUG.pts.length, Math.round(PLUG.n0 * clamp(amt, 0, 1.4)));
  return PLUG.pts.slice(0, n).map(p => spiky(p.x, p.y)).join('');
}
function meshBody(mesh, lys = 0) {
  const n = Math.round(NORMAL_THREADS * clamp(mesh, 0, 1.33));
  if (!n) return '';
  const dash = lys > .02 ? ` stroke-dasharray="${f(16 - 12 * lys)} ${f(3 + 12 * lys)}"` : '';
  const trapped = clamp((mesh - .3) / .5, 0, 1);
  const cells = trapped > 0 ? `<g opacity="${f(trapped)}">${cell(224, B - 20, .75)}${cell(258, B - 34, .75)}</g>` : '';
  return cells + THREADS.slice(0, n).map(d => `<path d="${d}" fill="none" stroke="${FIB}" stroke-width="2.4" stroke-linecap="round"${dash}/>`).join('');
}
const ghostDome = () => `<path class="ghost" d="M182 ${B} A58 50 0 0 1 298 ${B}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`;
const stateAttrs = o => `data-plug="${o.plug.toFixed(3)}" data-ten="${o.ten.toFixed(3)}" data-thrombin="${o.thrombin.toFixed(3)}" data-mesh="${o.mesh.toFixed(3)}"`;
function glyph(x, y, kind) {
  const c = kind === 'block' ? RED : BLUE;
  const lines = kind === 'block' ? `M${x - 4.5} ${y - 4.5} L${x + 4.5} ${y + 4.5} M${x + 4.5} ${y - 4.5} L${x - 4.5} ${y + 4.5}` : `M${x - 5} ${y} H${x + 5} M${x} ${y - 5} V${y + 5}`;
  return `<circle cx="${x}" cy="${y}" r="10" fill="${c}"/><path d="${lines}" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`;
}
// v: { spasm, leak, drops, shift, float, stuck, collagen, fibrinogen, plug, mesh, lys, ghost, model, key }
function vessel(v) {
  const s = v.spasm ?? 0, sh = v.shift ?? 0, wrap = x => ((x + sh) % 500 + 500) % 500 - 10;
  let b = `<rect x="0" y="${VY}" width="480" height="${B - VY}" fill="${LUMEN}"/><rect x="0" y="${B}" width="480" height="${VH - B}" fill="${TISSUE}"/>`;
  b += CELLS.map(([x, y]) => cell(wrap(x), y)).join('');
  b += part('platelets', FLOAT.slice(0, clamp(Math.round(8 * (v.float ?? 1)), 0, FLOAT.length)).map(([x, y]) => flat(wrap(x * 1.03), y)).join(''));
  if (v.fibrinogen) b += part('fibrinogen', RODS.map(([x, y, a]) => rod(f(wrap(x)), y, a)).join(''));
  b += walls(s);
  if (v.collagen) b += part('collagen', [[190, 1], [290, -1]].map(([x, d]) => [0, 1, 2].map(k => `<path d="M${x} ${I + 3 + k * 8} q${d * 5} -3 ${d * 10} 0 t${d * 10} 0" fill="none" stroke="${COLL}" stroke-width="2.4" stroke-linecap="round"/>`).join('')).join(''));
  const leak = v.leak ?? 0;
  if (leak > .01) {
    if (v.drops == null) b += [[236, B + 20], [250, B + 40], [238, B + 58]].map(([x, y], i) => drop(x, y, f(clamp(leak * 3 - i, 0, 1)))).join('');
    else for (let i = 0; i < 3; i++) { const p = (v.drops + i / 3) % 1; b += drop(236 + 8 * Math.sin(i * 2), f(B + 12 + 58 * p), f(clamp(leak * 1.4, 0, 1) * Math.sin(Math.PI * p))); }
  }
  if (v.stuck) b += part('platelets', STUCK.slice(0, Math.round(STUCK.length * clamp(v.stuck, 0, 1))).map(([x, y]) => spiky(x, y)).join(''));
  if (v.ghost) b += `<g class="ghost" data-ghost="normal" ${stateAttrs(v.ghost)}>${ghostDome()}</g>`;
  const now = v.model ? `data-new-state="${v.key || 'current'}" ${stateAttrs(v.model)}` : '';
  b += `<g ${now}>${part('plug', plugBody(v.plug ?? 0))}${part('fibrin', meshBody(v.mesh ?? 0, v.lys ?? 0))}</g>`;
  return b;
}
const flowLabel = () => text(14, 17, 'blood flows →', 'xs b', 'start');

/* ---------- Build the idea: the vessel pictures ---------- */
// Moving: blood flows past the tear and drips out of it.
function leakPicture(t) {
  return DEFS + vessel({ leak: 1, drops: t, shift: 480 * t }) + flowLabel() + text(466, 17, 'vessel wall', 'xs b', 'end') + text(60, 122, 'blood', 'sm b red') +
    leader(198, B - 2, 172, B + 16) + text(168, B + 28, 'tear', 'xs b', 'end') + text(268, B + 46, 'leaking out', 'xs b red', 'start') + text(14, VH - 8, 'outside the vessel', 'xs b muted', 'start');
}
// Moving: the walls squeeze in around the tear, and less blood escapes.
function spasmPicture(t) {
  const s = ease(span(t, .05, .75)), named = span(t, .5, .85);
  let b = DEFS + vessel({ spasm: s, leak: 1 - .55 * s, drops: (t * 3) % 1, shift: 60 * t }) + flowLabel();
  b += `<g class="ghost"><path d="M140 ${TOPIN} H340" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/></g>`;
  if (named > .01) b += `<g data-named ${fade(named)}>${arrow(`M150 ${B + 50} V${B + 10}`, BLUE, 3)}${arrow(`M330 ${B + 50} V${B + 10}`, BLUE, 3)}${text(150, B + 68, 'wall squeezes in', 'xs b blue')}${text(330, B + 68, 'wall squeezes in', 'xs b blue')}${text(466, 17, 'narrower here', 'xs b blue', 'end')}</g>`;
  return b;
}
// Moving: platelets ride along with the red cells.
function plateletsPicture(t) {
  let b = DEFS + vessel({ spasm: 1, leak: .45, drops: (t * 2) % 1, shift: 480 * t }) + flowLabel();
  b += `<rect x="8" y="${B + 6}" width="210" height="62" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>`;
  b += cell(36, B + 22, 1.2) + text(64, B + 28, 'red blood cell', 'xs b on-white', 'start');
  b += flat(36, B + 50, 1.4) + text(64, B + 56, 'platelet', 'xs b blue on-white', 'start');
  return b + text(466, 17, 'platelets ride along', 'xs b blue', 'end');
}
// Moving: platelets that touch the collagen at the torn edges turn spiky and stick.
function stickPicture(t) {
  const k = ease(span(t, .1, .8));
  return DEFS + vessel({ spasm: 1, leak: .45 - .1 * k, drops: (t * 2) % 1, collagen: true, stuck: k, shift: 40 * t }) + flowLabel() +
    leader(290, I + 12, 330, B + 16) + text(334, B + 28, 'collagen:', 'xs b', 'start') + text(334, B + 48, 'tough fibres', 'xs b', 'start') +
    (k > .3 ? `<g ${fade(span(k, .3, .6))}>${leader(196, I - 8, 150, B + 16)}${text(146, B + 28, 'sticky platelets', 'xs b blue', 'end')}</g>` : '');
}
// Moving: more platelets are called in and pile up into a plug; the leak stops.
function plugPicture(t) {
  const k = ease(span(t, .05, .85));
  return DEFS + vessel({ spasm: 1, collagen: true, plug: .12 + .88 * k, leak: clamp(.5 - k, 0, 1), drops: (t * 2) % 1, float: 1 }) + flowLabel() +
    arrow('M150 104 Q178 130 196 152', BLUE, 2.5) + arrow('M340 112 Q312 134 290 154', BLUE, 2.5) + text(466, 17, 'more platelets called in', 'xs b blue', 'end') +
    (k > .5 ? `<g ${fade(span(k, .5, .8))}>${leader(276, B - 20, 330, B + 16)}${text(334, B + 28, 'platelet plug', 'xs b', 'start')}</g>` : '');
}
function needMeshPicture() {
  let b = DEFS + vessel({ spasm: 1, plug: 1, fibrinogen: true }) + flowLabel() + text(466, 17, 'fibrinogen, dissolved', 'xs b fib', 'end');
  b += leader(286, B - 24, 330, B + 10) + text(334, B + 22, 'soft plug', 'xs b', 'start');
  b += `<rect x="8" y="${B + 6}" width="300" height="64" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>`;
  b += rod(36, B + 22, 20) + rod(58, B + 32, -25) + rod(40, B + 40, 70);
  b += arrow(`M88 ${B + 30} H160`, INK, 2) + text(124, B + 22, '?', 'sm b on-white');
  b += ['M176 20 Q210 44 250 26', 'M176 36 Q214 14 252 40', 'M180 46 Q220 30 254 18'].map(d => `<path d="${d.replace(/(\d+) (\d+)/g, (m, x, y) => `${x} ${Number(y) + B}`)}" fill="none" stroke="${FIB}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  b += text(50, B + 64, 'fibrinogen', 'xs b fib on-white') + text(216, B + 64, 'fibrin threads', 'xs b fib on-white');
  return b;
}
// Moving: one switch turns on two, those turn on four, and so on down the waterfall.
function switchesPicture(t) {
  let b = DEFS;
  const sw = (x, y, on) => `<rect x="${f(x - 17)}" y="${y - 9}" width="34" height="18" rx="9" fill="${on ? BLUE : '#d5d8ce'}" stroke="${INK}" stroke-width="1.5"/><circle cx="${f(on ? x + 8 : x - 8)}" cy="${y}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`;
  const ys = [70, 140, 210, 280], xsOf = n => { const gap = Math.min(160, 416 / n); return Array.from({ length: n }, (_, i) => 240 + (i - (n - 1) / 2) * gap); };
  const lit = k => t > .08 + k * .2;
  ys.forEach((y, k) => { b += `<rect x="${f(240 - 30 - k * 64)}" y="${y - 24}" width="${f(60 + k * 128)}" height="48" fill="#dfe5ff" opacity="${lit(k) ? .7 : .25}"/>`; });
  ys.forEach((y, k) => {
    const xs = xsOf(2 ** k);
    if (k < ys.length - 1) { const next = xsOf(2 ** (k + 1)); xs.forEach((x, i) => { [next[2 * i], next[2 * i + 1]].forEach(nx => { b += arrow(`M${f(x)} ${y + 11} L${f(nx)} ${ys[k + 1] - 13}`, lit(k + 1) ? BLUE : INK, 1.6); }); }); }
    xs.forEach(x => { b += sw(x, y, lit(k)); });
  });
  b += text(240, 30, 'one clotting factor switched on…', 'xs b') + text(240, 326, '…switches on more at every step', 'xs b blue');
  b += `<g transform="translate(110 362)">${sw(17, -6, false)}${text(44, 0, 'switched off', 'xs', 'start')}${sw(170, -6, true)}${text(197, 0, 'switched on', 'xs', 'start')}</g>`;
  return b;
}

/* ---------- The cascade ladder, with the clot it builds underneath ---------- */
// Boxes [x, y, w, h]. Middle: the chain; left: what feeds in; right: the brakes.
const LB = {
  tf: [10, 22, 200, 40], contact: [270, 22, 200, 40],
  ten: [172, 92, 136, 40], thrombin: [172, 158, 136, 40], fibrin: [172, 224, 136, 40],
  vitk: [8, 84, 148, 52], pro: [8, 150, 148, 52], fgn: [8, 224, 148, 40],
  brake: [324, 118, 148, 40], cs: [324, 170, 148, 40], plasmin: [324, 224, 148, 40]
};
function box(key, title, act, ghostAct, { mark = null, kTag = false, faulty = false, sub = '', op = 1, pt = key } = {}) {
  const [x, y, w, h] = LB[key];
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${mark === 'block' ? RED : mark === 'boost' ? BLUE : INK}" stroke-width="${mark ? 3 : 1.5}"/>`;
  s += text(x + w / 2, y + 20, title, 'xs b on-white');
  if (sub) s += text(x + w / 2, y + 41, sub, 'xs on-white');
  if (act != null) {
    const bx = x + 10, bw = w - 20, pos = a => f(bx + bw * clamp(a / 1.6, 0, 1));
    s += `<rect x="${bx}" y="${y + 28}" width="${bw}" height="6" fill="#e1e4da"/><rect data-act="${key}" x="${bx}" y="${y + 28}" width="${f(pos(act) - bx)}" height="6" fill="${BLUE}"/>`;
    if (ghostAct != null) s += `<path class="ghost" d="M${pos(ghostAct)} ${y + 24} V${y + 38}" stroke="${INK}" stroke-width="2" stroke-dasharray="2 2"/>`;
  }
  if (kTag) s += `<g data-k><circle cx="${x + w - 2}" cy="${y + 2}" r="11" fill="${faulty ? '#fff' : AMBER}" stroke="${AMBER}" stroke-width="2" ${faulty ? 'stroke-dasharray="3 2"' : ''}/>${text(x + w - 2, y + 8, 'K', `xs b ${faulty ? 'amber' : 'on-badge'}`)}</g>`;
  if (mark) s += glyph(x + 2, y + 2, mark);
  return part(pt, op < 1 ? `<g ${fade(op)}>${s}</g>` : s);
}
const tbar = (d, x, y, w = 2.2) => `<path d="${d}" fill="none" stroke="${RED}" stroke-width="${w}"/><path d="M${x} ${y - 8} V${y + 8}" stroke="${RED}" stroke-width="${w + 1}"/>`;
// opt: level (1 to 5: how much of the ladder is built), ghost, vitk (show vitamin K), cs (show proteins C and S),
// light (0 to 1: how far down the switches have lit, for the building animation), marks.
function ladder(o, opt = {}) {
  const { level = 5, ghost = null, vitk = false, cs = false, light = 1 } = opt, s0 = o.s, g = k => ghost ? ghost[k] : null;
  const on = k => clamp((light - k * .22) / .22, 0, 1);   // the lit share of each row, top to bottom
  const kt = vitk || cs, faulty = s0.vka > .05;
  let b = '';
  b += box('tf', 'tissue factor, VII', o.factors * on(0), g('factors'), { kTag: kt, faulty, pt: 'tf' });
  b += box('contact', 'contact, XI, IX', o.factors * on(0), g('factors'), { kTag: kt, faulty, pt: 'contact' });
  b += arrow('M110 62 C110 80 180 74 200 90', INK, 2) + arrow('M370 62 C370 80 300 74 280 90', INK, 2);
  b += box('ten', 'factor X', o.ten * on(1), g('ten'), { mark: s0.xai > .05 ? 'block' : null, kTag: kt, faulty });
  if (vitk) b += part('vitk', `<rect x="${LB.vitk[0]}" y="${LB.vitk[1]}" width="${LB.vitk[2]}" height="${LB.vitk[3]}" fill="#fff" stroke="${s0.vka > .05 ? RED : AMBER}" stroke-width="${s0.vka > .05 ? 3 : 1.5}"/>${text(82, 106, 'vitamin K', 'xs b amber on-white')}${text(82, 128, s0.vka > .05 ? 'recycling blocked' : 'used, recycled', 'xs amber on-white')}` + (s0.vka > .05 ? glyph(10, 86, 'block') : ''));
  if (level >= 2) {
    b += arrow('M240 132 V154', INK, 2);
    b += part('pro', `<rect x="${LB.pro[0]}" y="${LB.pro[1]}" width="${LB.pro[2]}" height="${LB.pro[3]}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>${text(82, 172, 'prothrombin', 'xs b on-white')}${text(82, 194, '(factor II)', 'xs on-white')}` + (kt ? `<g data-k><circle cx="154" cy="152" r="11" fill="${faulty ? '#fff' : AMBER}" stroke="${AMBER}" stroke-width="2" ${faulty ? 'stroke-dasharray="3 2"' : ''}/>${text(154, 158, 'K', `xs b ${faulty ? 'amber' : 'on-badge'}`)}</g>` : ''));
    b += arrow('M156 178 H168', INK, 2);
    b += box('thrombin', 'thrombin', o.thrombin * on(2), g('thrombin'), { mark: s0.dti > .05 ? 'block' : null });
  }
  if (level >= 3) {
    b += arrow('M240 198 V220', INK, 2);
    b += part('fibrinogen', `<rect x="${LB.fgn[0]}" y="${LB.fgn[1]}" width="${LB.fgn[2]}" height="${LB.fgn[3]}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>${text(82, 249, 'fibrinogen', 'xs b fib on-white')}`) + arrow('M156 244 H168', INK, 2);
    b += box('fibrin', 'fibrin net', o.mesh * on(3), g('mesh'), { pt: 'fibrin' });
  }
  if (level >= 4) {
    const w = 2.2 + 1.6 * clamp(o.brake - 1, 0, 2);
    b += part('brake', tbar('M324 132 C316 132 318 112 311 112', 311, 112, w) + tbar('M324 146 C316 146 318 178 311 178', 311, 178, w));
    b += box('brake', 'antithrombin', clamp(o.brake, 0, 1.6), g('brake'), { mark: s0.hep > .05 ? 'boost' : null, pt: 'brake' });
  }
  if (cs) b += box('cs', 'proteins C, S', o.cs, g('cs'), { kTag: true, faulty, pt: 'cs' }) + tbar('M324 190 C318 190 318 184 311 184', 311, 184);
  if (level >= 5) b += part('plasmin', tbar('M324 244 H311', 311, 244)) + box('plasmin', 'plasmin', o.plasmin, g('plasmin'), { mark: s0.lys > .05 ? 'boost' : null, pt: 'plasmin' });
  return b;
}
// The clot at the tear, under the ladder: the lower part of the vessel picture, moved up to y 272.
function clotBand(o, { ghost = null, plug = o.plug, mesh = o.mesh, lys = o.s.lys, key = 'current' } = {}) {
  const dy = 272 - 150;
  let b = `<clipPath id="ah-band"><rect x="0" y="150" width="480" height="136"/></clipPath>`;
  b += `<g transform="translate(0 ${dy})"><g clip-path="url(#ah-band)">${vessel({ spasm: 1, leak: leakOf({ plug, mesh }), plug, mesh, lys, float: o.s.plt, ghost, model: o, key })}</g></g>`;
  b += `<path d="M0 272 H480" stroke="${RULE}" stroke-width="1.5"/>`;
  b += leader(188, B + dy - 16, 150, B + dy + 34) + text(146, B + dy + 46, 'platelet plug', 'xs b', 'end');
  if (mesh > .05) b += leader(294, B + dy - 30, 334, B + dy + 34) + text(338, B + dy + 46, 'fibrin net', 'xs b fib', 'start');
  return b;
}
const LADDER_H = 408;
function cascadePicture(o, opt = {}) {
  const { level = 5, ghost = null, words = '', plug, mesh } = opt;
  let b = DEFS + ladder(o, opt);
  b += clotBand(o, { ghost, plug: plug ?? o.plug, mesh: level >= 3 ? (mesh ?? o.mesh) : 0 });
  if (words) b += `<g data-named>${text(16, 294, words, 'xs b blue', 'start')}</g>`;
  return b;
}

/* ---------- What changes it ---------- */
const CHANGES = { heparin: { hep: 1 }, vka: { vka: 1 }, xa: { xai: 1 }, dti: { dti: 1 }, antiplatelet: { apl: 1 }, lytic: { lys: 1 } };
const WORDS = { heparin: '↓ Xa, ↓ thrombin', vka: '↓ working factors', xa: '↓ thrombin, ↓ fibrin', dti: '↓ fibrin net' };
const CHANGE_WHERE = {
  heparin: 'Heparin latches on to antithrombin, whose box is marked boosted; its brake lines to factor X and to thrombin thicken. The factor X and thrombin bars fall below their dashed normal ticks, the fibrin bar falls with them, and fewer fibrin threads cross the platelet plug below, which itself is unchanged.',
  vka: 'A vitamin K box appears, marked blocked: its recycling is stopped. The vitamin K tags on factors VII, IX, X and prothrombin (II), and on the brakes proteins C and S, turn hollow: these are made faulty. Their bars shrink, the thrombin and fibrin bars shrink, and fewer fibrin threads cross the plug.',
  xa: 'The factor X box is marked blocked and its bar shrinks. Thrombin and fibrin shrink with it, and fewer fibrin threads cross the platelet plug below.',
  dti: 'The thrombin box is marked blocked and its bar shrinks, while factor X stays at normal. The fibrin bar shrinks and only a few threads cross the platelet plug below.'
};
function ladderChange(kind) {
  return {
    duration: 3000,
    render(t) {
      const a = ease(span(t, .05, .85)), o = model(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, a));
      const named = span(t, .55, .9);
      const label = `${TITLES[kind]}, drawn over dashed ticks and outlines of the normal clot. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o)}.`;
      const body = cascadePicture(o, { level: 5, ghost: BASE, vitk: kind === 'vka', cs: kind === 'vka', words: named > .3 ? WORDS[kind] : '' })
        + (kind === 'heparin' && named > .01 ? `<g ${fade(named)}>${text(398, 108, 'heparin', 'xs b blue')}</g>` : '');
      return { svg: svg(label, body, LADDER_H), readout: readout(o, 'Compared with normal') };
    }
  };
}
// Antiplatelet drugs: stuck platelets call in more with two signals; the drugs silence one and deafen the other.
function antiplateletPicture(t) {
  const a = ease(span(t, .05, .85)), o = model(mix(NORMAL, { ...NORMAL, apl: 1 }, a)), named = span(t, .5, .85);
  let b = DEFS + vessel({ spasm: 1, collagen: true, plug: o.plug, mesh: o.mesh * .6, leak: leakOf(o) * .8, drops: (t * 2) % 1, ghost: BASE, model: o, key: 'antiplatelet' }) + flowLabel();
  // Signals rising from the plug toward passing platelets: thromboxane (left) and ADP (right).
  const sig = (x0, y0, x1, y1, col, op) => [0, 1, 2].map(i => { const p = ((t * 2) + i / 3) % 1; return `<circle cx="${f(lerp(x0, x1, p))}" cy="${f(lerp(y0, y1, p))}" r="3.6" fill="${col}" ${fade(op * Math.sin(Math.PI * p))}/>`; }).join('');
  b += part('txa', sig(214, B - 40, 150, 100, AMBER, 1 - a) + text(122, 92, 'thromboxane', 'xs b amber', 'middle'));
  b += part('adp', sig(266, B - 40, 330, 100, BLUE, 1) + text(354, 92, 'ADP', 'xs b blue'));
  if (named > .01) b += `<g data-named ${fade(named)}>${glyph(176, 120, 'block')}${text(122, 150, 'aspirin: none made', 'xs b red')}${glyph(330, 110, 'block')}${text(372, 150, 'P2Y12 blocker:', 'xs b red')}${text(372, 170, 'cannot land', 'xs b red')}</g>`;
  b += part('signals', text(466, 17, 'platelets call in more', 'xs b', 'end'));
  b += leader(276, B - 16, 330, B + 16) + text(334, B + 28, 'smaller plug', 'xs b', 'start');
  return { svg: b, o };
}
// Thrombolytics: an unwanted clot blocks the vessel; plasmin cuts its fibrin and blood flows on.
function lyticPicture(t) {
  const act = ease(span(t, .05, .4)), cut = ease(span(t, .3, .75)), clear = ease(span(t, .6, .95));
  const top = 56, bot = 210;
  let b = DEFS + `<rect x="0" y="${top}" width="480" height="${bot - top}" fill="${LUMEN}"/>`;
  b += `<rect x="0" y="${top - 18}" width="480" height="18" fill="${WALL}" stroke="${INK}" stroke-width="1.5"/><rect x="0" y="${bot}" width="480" height="18" fill="${WALL}" stroke="${INK}" stroke-width="1.5"/>`;
  // Red cells: crowded behind the clot at first, then flowing through.
  const flow = 500 * clear * t;
  for (let i = 0; i < 16; i++) {
    const x0 = 20 + (i % 6) * 30 + (i > 11 ? 240 : 0), y = top + 22 + Math.floor(i / 6) % 3 * 46 + (i % 2) * 10;
    const x = clear > 0 ? ((x0 + flow) % 520) - 20 : x0;
    if (i > 11 && clear < .3) continue;
    b += cell(x, y, .9);
  }
  // The clot: platelets and fibrin across the whole vessel, breaking up as plasmin cuts.
  const keep = 1 - .85 * clear;
  let clot = '';
  for (let i = 0; i < 26; i++) { const x = 206 + (i % 4) * 22 + (i % 2) * 6, y = top + 16 + Math.floor(i / 4) * 24; if ((i * 7) % 10 < 10 * keep) clot += spiky(x + (1 - keep) * (i % 3 - 1) * 30, y); }
  let threads = '';
  for (let i = 0; i < 8; i++) {
    const y = top + 18 + i * 19, d = `M196 ${y} Q245 ${y + (i % 2 ? 18 : -18)} 294 ${y + 6}`;
    threads += `<path d="${d}" fill="none" stroke="${FIB}" stroke-width="2.6" stroke-linecap="round" ${cut > .02 ? `stroke-dasharray="${f(14 - 10 * cut)} ${f(2 + 14 * cut)}"` : ''} ${fade(1 - .9 * clear)}/>`;
  }
  b += part('clot', clot) + part('fibrin', threads);
  // Plasmin, switched on by the drug, on the fibrin.
  let pl = '';
  for (let i = 0; i < 5; i++) pl += `<path d="M${200 + i * 22} ${top + 30 + (i % 3) * 50} l7 -7 l7 7 l-7 7 z" fill="${BLUE}" ${fade(act * (1 - clear))}/>`;
  b += part('plasmin', pl);
  b += text(240, 22, act < .5 ? 'an unwanted clot blocks the vessel' : 'plasminogen → plasmin: fibrin cut', 'xs b ' + (act < .5 ? '' : 'blue'));
  b += text(110, bot + 46, 'blood held back', 'xs b red', 'middle', fade(1 - clear));
  if (clear > .4) b += `<g data-named ${fade(span(clear, .4, .8))}>${arrow(`M330 ${bot + 40} H430`, BLUE, 3.5)}${text(380, bot + 66, 'flow returns', 'xs b blue')}</g>`;
  b += `<g transform="translate(16 ${bot + 104})"><path d="M0 -6 l7 -7 l7 7 l-7 7 z" fill="${BLUE}"/>${text(22, 0, 'plasmin', 'xs', 'start')}<path d="M110 -12 Q130 0 150 -12" fill="none" stroke="${FIB}" stroke-width="2.6"/>${text(158, 0, 'fibrin', 'xs', 'start')}${spiky(240, -6)}${text(254, 0, 'platelet', 'xs', 'start')}</g>`;
  return b;
}
const TITLES = { heparin: 'Heparins', vka: 'A vitamin K antagonist', xa: 'A factor Xa inhibitor', dti: 'A direct thrombin inhibitor', antiplatelet: 'An antiplatelet drug', lytic: 'A thrombolytic' };

/* ---------- Words: comparisons and text alternatives ---------- */
function compare(o) {
  const row = (name, r, up, down) => [name, r > 1.04 ? [up, 'up'] : r < .96 ? [down, 'down'] : ['about the same', 'same']];
  const rows = [row('Platelet plug', o.plug, 'bigger', 'smaller'), row('Factor Xa', o.ten, 'more active', 'less active'), row('Thrombin', o.thrombin, 'more made', 'less made'), row('Fibrin net', o.mesh, 'thicker', 'thinner')];
  if (Math.abs(o.factors - 1) > .04) rows.push(row('Working vitamin K factors', o.factors, 'more', 'fewer'));
  if (Math.abs(o.brake - 1) > .04) rows.push(row('Antithrombin brake', o.brake, 'pressed harder', 'eased off'));
  if (Math.abs(o.plasmin - 1) > .04) rows.push(row('Plasmin', o.plasmin, 'more active', 'less active'));
  return rows;
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (o, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${compare(o).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- The lesson's scenes, one per step kind ---------- */
const VESSEL = 'The narrowed vessel with its platelet plug';
const still = (label, body, h) => () => svg(label, body(), h);
const scenes = {
  leak: { duration: 2400, loop: true, rest: .5, render: t => svg('A blood vessel drawn from the side: blood with red blood cells flows left to right between two pink walls. The lower wall has a tear, and drops of blood keep leaking out into the tissue outside the vessel.', leakPicture(t), VH) },
  spasm: { duration: 2800, render: t => svg('The same vessel. The walls squeeze inward around the tear, so the tube is narrower there than its dashed normal line, and fewer drops leak out.', spasmPicture(t), VH) },
  platelets: { duration: 4000, loop: true, rest: .3, render: t => svg('The narrowed vessel with small flat blue discs, platelets, flowing along among the much larger red blood cells. A box in the corner compares one red blood cell with one platelet.', plateletsPicture(t), VH) },
  stick: { duration: 3000, render: t => svg('Close up of the tear: brown collagen fibres poke out of the torn ends of the wall, and one by one platelets that touch them turn spiky and cling to the torn edges. A little blood still leaks out.', stickPicture(t), VH) },
  plug: { duration: 3600, render: t => svg('Platelets pile into the tear, one layer after another, until a dome of spiky platelets fills it: the platelet plug. Arrows show more platelets drifting in to join it, and the leak stops.', plugPicture(t), VH) },
  needmesh: still('The platelet plug sits in the tear, labelled soft. Short amber rods of dissolved fibrinogen float in the blood. A small diagram below shows fibrinogen rods, a question mark, then long crossing fibrin threads.', needMeshPicture, VH),
  switches: { duration: 3600, render: t => svg('A waterfall of switches lighting up row by row. At the top, one clotting factor switches on; it switches on two below it, those switch on four, and those switch on eight. A key shows a grey switch as off and a blue switch as on.', switchesPicture(t), 376) },
  paths: { duration: 2400, render: t => svg(`The cascade as a ladder of boxes above ${VESSEL.toLowerCase()}. Tissue factor with factor VII, the fast extrinsic way in, and contact with factors XI and IX, the slower intrinsic way in, light up and both point to factor X, the start of the common pathway. Each box has a blue bar showing how switched on it is.`, cascadePicture(BASE, { level: 1, light: .45 * ease(span(t, .05, .9)) }), LADDER_H) },
  thrombin: { duration: 2600, render: t => svg(`The ladder grows. Factor X now points down to thrombin, with prothrombin, factor II, feeding in from the side; thrombin's bar fills as it is made. Below, ${VESSEL.toLowerCase()}.`, cascadePicture(BASE, { level: 2, light: .45 + .22 * ease(span(t, .05, .9)) }), LADDER_H) },
  mesh: { duration: 3200, render: t => { const k = ease(span(t, .1, .9)); return svg('Thrombin now points down to the fibrin net, with fibrinogen feeding in from the side. Below, amber fibrin threads weave across the platelet plug one after another and trap red blood cells.', cascadePicture(BASE, { level: 3, light: .67 + .33 * k, mesh: k }), LADDER_H); } },
  brake: still('The ladder with one new box on the right: antithrombin, the brake, with red brake lines to factor X and to thrombin. Below, the plug and its fibrin net.', () => cascadePicture(BASE, { level: 4 }), LADDER_H),
  cleanup: { duration: 3600, render: t => { const k = ease(span(t, .15, .9)); return svg('The full ladder with plasmin at the bottom right, its brake line cutting into the fibrin net. Below, the fibrin threads break into short pieces as plasmin slowly clears them away.', DEFS + ladder({ ...BASE, plasmin: 1 + .9 * k }, { level: 5 }) + clotBand(BASE, { lys: .9 * k, mesh: 1 - .55 * k }), LADDER_H); } },
  whole: { duration: 6400, render: t => {
    const p = ease(span(t, .02, .3)), l = span(t, .32, .66), m = ease(span(t, .68, .96));
    return svg('The whole picture builds in order. First platelets pile into the tear as a plug; then the cascade lights from the two ways in, through factor X and thrombin, to the fibrin net, with the antithrombin brake and plasmin at the side; last, fibrin threads weave through the plug. The two things to watch are how many platelets there are and how much thrombin is made.',
      DEFS + ladder(BASE, { level: 5, light: l }) + clotBand(BASE, { plug: .1 + .9 * p, mesh: m }), LADDER_H);
  } },
  heparin: ladderChange('heparin'),
  vka: ladderChange('vka'),
  xa: ladderChange('xa'),
  dti: ladderChange('dti'),
  antiplatelet: { duration: 3000, render(t) { const { svg: body, o } = antiplateletPicture(t); return { svg: svg('An antiplatelet drug, drawn over a dashed outline of the normal plug. Stuck platelets call in more with two signals, thromboxane and ADP. Aspirin stops thromboxane being made, and a P2Y12 blocker stops ADP landing on passing platelets, so the plug shrinks to a smaller dome inside its dashed normal outline and a little blood oozes out.', body, VH + 10), readout: readout(o, 'Compared with normal') }; } },
  lytic: { duration: 3600, render: t => svg('A vessel blocked by an unwanted clot of platelets and fibrin, with red blood cells held back behind it. A thrombolytic switches plasminogen into plasmin, shown as blue diamonds on the fibrin; the fibrin threads are cut into pieces, the clot breaks up and blood flows on past it.', lyticPicture(t), 330) },
};

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let P = { ...NORMAL };
let data = null, PBASE = null;   // PBASE: the model's baseline platelet count, the middle of the quoted range
const DRUG_NAMES = { hep: 'heparins', vka: 'a vitamin K antagonist', xai: 'a factor Xa inhibitor', dti: 'a direct thrombin inhibitor', apl: 'an antiplatelet drug', lys: 'a thrombolytic' };
const pltWord = v => v < .6 ? 'far fewer' : v < .99 ? 'fewer' : v <= 1.01 ? 'typical' : v < 1.5 ? 'more' : 'far more';
const pct = r => `${Math.round(r * 100)}%`;
const count = () => Math.round(PBASE * P.plt / 1000) * 1000;
const countText = n => `${n.toLocaleString('en-US')} ${data.values[0].unit}`;
function statusFor(v, shown) { return shown < v.low ? 'below the quoted typical range' : shown > v.high ? 'above the quoted typical range' : 'inside the quoted typical range'; }
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
function syncControls() {
  for (const id of ['plt', 'clinical-plt']) { $('#' + id).value = P.plt; $(`#${id}-label`).textContent = pltWord(P.plt); }
  $$('[data-drug]').forEach(c => { c.checked = P[c.dataset.drug] > 0; });
}
function update() {
  syncControls();
  const o = model(P);
  const on = Object.keys(DRUG_NAMES).filter(k => P[k] > 0);
  const label = `Illustrative model with these settings, drawn over dashed ticks and outlines of the normal clot. Platelets: ${pltWord(P.plt)}. Drugs: ${on.length ? on.map(k => DRUG_NAMES[k]).join(', ') : 'none'}. Compared with normal: ${describe(o)}.`;
  $('#explore-visual').innerHTML = svg(label, cascadePicture(o, { level: 5, ghost: BASE, vitk: true, cs: true }), LADDER_H) + readout(o, 'Compared with normal');
  const howMany = pltWord(P.plt) === 'typical' ? 'a typical number of platelets' : `${pltWord(P.plt)} platelets than typical`;
  const cvLabel = `Illustrative model of the wound: ${howMany} in the blood, and a platelet plug that is ${compare(o)[0][1][0]} compared with the dashed normal outline.`;
  const cv = DEFS + vessel({ spasm: 1, leak: leakOf(o), float: P.plt, plug: o.plug, mesh: o.mesh, ghost: BASE, model: o, key: 'clinical' }) + flowLabel() + text(466, 17, `platelets: ${pltWord(P.plt)}`, 'xs b blue', 'end');
  $('#clinical-visual').innerHTML = svg(cvLabel, cv + `<g transform="translate(16 ${VH + 26})"><path d="M0 -6 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>${text(42, 0, 'normal plug', 'xs', 'start')}${spiky(170, -6)}${text(184, 0, 'model now', 'xs', 'start')}</g>`, VH + 40);
  const results = `Illustrative model, relative to the normal clot (100%): platelets ${pct(P.plt)} · platelet plug ${pct(o.plug)} · factor Xa ${pct(o.ten)} · thrombin ${pct(o.thrombin)} · fibrin net ${pct(o.mesh)} · antithrombin brake ${pct(o.brake)}. Drugs on board: ${on.length ? on.map(k => DRUG_NAMES[k]).join(', ') : 'none'}.`;
  if (data) {
    const v = data.values[0], n = count();
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    row.querySelector('.reading').textContent = countText(n);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, n)}`;
    const x = gaugeX(v)(PBASE * P.plt), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    const st = data.states.find(s => s.id === $('#clinical-state').value);
    const d = st?.shifts[v.id], dir = row.querySelector('.direction'), ev = row.querySelector('.evidence');
    dir.textContent = st ? `${DIRECTION[d]}: ${st.shiftNotes?.[v.id] || ''}` : '';
    const e = st?.shiftEvidence?.[v.id];
    ev.textContent = e ? `“${e.quote}” (${e.where} [${e.source}])` : '';
  }
  $('#model-results').textContent = results;
}
const gaugeX = v => { const [lo, hi] = v.scale; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function setPlatelets(val) {
  P.plt = val;
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrow still describes ${s.label} alone.` : 'Custom model settings.';
  update(); announce();
}
$('#plt').addEventListener('input', e => setPlatelets(Number(e.target.value)));
$('#clinical-plt').addEventListener('input', e => setPlatelets(Number(e.target.value)));
$$('[data-drug]').forEach(c => c.addEventListener('change', () => { P[c.dataset.drug] = c.checked ? 1 : 0; update(); announce(); }));
// How each cited state is applied to the model (sizes illustrative; directions follow the data file).
const STATE_PLT = { thrombocytopenia: .35, thrombocytosis: 2 };
const resetAll = () => { P = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value, s = data?.states.find(x => x.id === id);
  P = { ...NORMAL, plt: STATE_PLT[id] ?? 1 };
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Direction: ${s.where} [${s.source}]` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const n = count();
    $('#cv-live').textContent = `Model platelet count ${countText(n)}, ${statusFor(data.values[0], n)}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
function linkify(parent, s) {
  // Show citation URLs as links so students can open the source.
  for (const part of s.split(/(https:\/\/\S+?)(?=[\s)]|$)/)) {
    if (/^https:\/\//.test(part)) { const a = document.createElement('a'); a.href = part; a.textContent = part; parent.append(a); }
    else if (part) parent.append(part);
  }
}
// Each drug in the data file, by the lesson step that teaches it (found by the step's kind, so step numbers can move).
const DRUG_STEP = { heparins: 'heparin', vka: 'vka', xa: 'xa', dti: 'dti', antiplatelet: 'antiplatelet', thrombolytic: 'lytic' };
const stepOfKind = kind => $$('[data-step][data-step-title]').findIndex(a => a.dataset.kind === kind) + 1;
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const v = loaded.values?.[0];
    if (!v || v.modelKey !== 'platelets' || !Number.isFinite(v.low) || !Number.isFinite(v.high) || !Array.isArray(v.scale)) throw new Error('Invalid reference data');
    data = loaded;
    PBASE = (v.low + v.high) / 2;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = `How the number is made: the model’s baseline platelet count (${countText(Math.round(PBASE / 1000) * 1000)}) is the middle of OpenStax’s quoted typical range. The slider and the disease states scale it by an illustrative amount; only the direction of each state is meant to teach. The range is narrow, so even a small move takes the marker outside it: that is a property of the quoted figure, not a cut-off for anything.`;
    $('#omitted').textContent = data.omitted || '';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const val of data.values) {
      const pos = gaugeX(val);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = val.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div><p class="evidence"></p>';
      left.querySelector('h3').textContent = `${val.label} (${val.unit})`;
      const right = document.createElement('div');
      const [lo, hi] = val.scale;
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 56" role="img"><path class="track" d="M20 24 H380"/><rect class="band" x="${pos(val.low)}" y="12" width="${f(Math.max(2, pos(val.high) - pos(val.low)))}" height="24"/><path class="limit" d="M${pos(val.low)} 6 V42 M${pos(val.high)} 6 V42"/><line class="marker" x1="20" x2="20" y1="2" y2="46"/><text x="20" y="55" font-size="11" fill="${MUTED}">${lo.toLocaleString('en-US')}</text><text x="380" y="55" font-size="11" fill="${MUTED}" text-anchor="end">${hi.toLocaleString('en-US')}</text></svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${val.label}: the quoted range as a shaded band, and a blue marker for the current illustrative model`);
      right.querySelector('.key').textContent = `Quoted range ${val.low.toLocaleString('en-US')} to ${val.high.toLocaleString('en-US')} ${val.unit} (shaded) · bar runs ${lo.toLocaleString('en-US')} to ${hi.toLocaleString('en-US')} · blue line: model`;
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${val.where} [${val.source}]${val.note ? ' · ' + val.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const d of data.drugActions || []) {
      const li = document.createElement('li');
      const h = document.createElement('h4'); h.textContent = d.label;
      const p = document.createElement('p'); p.textContent = d.summary;
      li.append(h, p);
      for (const e of d.evidence) {
        const q = document.createElement('blockquote'); q.textContent = `“${e.quote}”`;
        const c = document.createElement('cite'); c.textContent = `${e.where} [${e.source}]`;
        q.append(c); li.append(q);
      }
      const n = stepOfKind(DRUG_STEP[d.id]) || d.step;
      const a = document.createElement('a'); a.href = `#step-${n}`; a.textContent = `See it in the lesson, step ${n}`;
      const pa = document.createElement('p'); pa.append(a); li.append(pa);
      $('#drug-actions').append(li);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.append(`[${id}] `); linkify(li, citation);
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
