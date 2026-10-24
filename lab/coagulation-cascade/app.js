'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- Teaching model ----------
   Everything is relative to a normal clot, which scores 1 on each part. plt is the platelet count as a multiple of the
   baseline; the six drug strengths run from 0 (absent) to 1 (on board). The sizes are illustrative; only directions teach. */
const NORMAL = { plt: 1, hep: 0, vka: 0, xai: 0, dti: 0, apl: 0, lys: 0 };
function model(s) {
  const plug = (s.plt * 1.5 / (s.plt + 0.5)) * (1 - 0.6 * s.apl);     // more platelets, bigger plug, levelling off
  const surface = 0.6 + 0.4 * Math.min(plug, 1.3);                     // platelet surface helps make thrombin
  const factors = 1 - 0.65 * s.vka;                                    // working vitamin K–dependent factors
  const brake = 1;                                                     // antithrombin: the natural brake, unchanged here
  const ten = factors * (1 - 0.75 * s.xai);
  const thrombin = ten * surface * (1 - 0.7 * s.hep) * (1 - 0.8 * s.dti);   // heparin opposes prothrombin becoming thrombin
  const plasmin = 1 + 3 * s.lys;
  const mesh = thrombin * (1 - 0.8 * s.lys);
  return { s, plug, factors, brake, ten, thrombin, plasmin, mesh };
}
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };
const BASE = model(NORMAL);
const leakOf = o => clamp(1.1 - o.plug - 0.5 * o.mesh, 0, 1);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', RED = '#b3261e', FIB = '#8a4f00', RULE = '#babeb3', MUTED = '#53584d';
const LUMEN = '#f6e4df', WALL = '#e2ada1', TISSUE = '#e9e1cf', CELL = '#cf5a4c', CELLD = '#962a1f', CELLC = '#e48b7f', PLT = '#bac6ff', COLL = '#7c6036';
let pictureId = 0;  // each picture gets its own marker ids, so a marker in a hidden step never goes missing
const svg = (label, body, h, attr = '') => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}" ${attr}>${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [RED]: 'r', [FIB]: 'f', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#ah-${MARK[color] || 'k'})"/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
function keyRow(items, y) {
  let x = 16, row = 0, body = '';
  for (const [icon, word] of items) {
    const w = 44 + word.length * 9.4;
    if (x > 16 && x + w > 470) { x = 16; row++; }
    body += `<g transform="translate(${f(x)} ${y + row * 28})">${icon}${text(44, 5, word, 'xs b', 'start')}</g>`;
    x += w + 14;
  }
  return { body, rows: row + 1 };
}

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
const ghostDome = () => `<path d="M182 ${B} A58 50 0 0 1 298 ${B}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`;
const ghostThreads = n => THREADS.slice(0, Math.round(NORMAL_THREADS * clamp(n, 0, 1.33))).map(d => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-dasharray="2 4" opacity=".45"/>`).join('');
const stateAttrs = o => `data-plug="${o.plug.toFixed(3)}" data-ten="${o.ten.toFixed(3)}" data-thrombin="${o.thrombin.toFixed(3)}" data-mesh="${o.mesh.toFixed(3)}"`;
function glyph(x, y, kind) {
  const c = kind === 'block' ? RED : BLUE;
  const lines = kind === 'block' ? `M${x - 4.5} ${y - 4.5} L${x + 4.5} ${y + 4.5} M${x + 4.5} ${y - 4.5} L${x - 4.5} ${y + 4.5}` : `M${x - 5} ${y} H${x + 5} M${x} ${y - 5} V${y + 5}`;
  return `<circle cx="${x}" cy="${y}" r="10" fill="${c}"/><path d="${lines}" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`;
}
// v: { spasm, leak, float, stuck, collagen, fibrinogen, plug, mesh, lys, ghost, model, key, lessSticky }
function vessel(v) {
  const s = v.spasm ?? 0;
  let b = `<rect x="0" y="${VY}" width="480" height="${B - VY}" fill="${LUMEN}"/><rect x="0" y="${B}" width="480" height="${VH - B}" fill="${TISSUE}"/>`;
  b += CELLS.map(([x, y]) => cell(x, y)).join('');
  b += FLOAT.slice(0, clamp(Math.round(8 * (v.float ?? 1)), 0, FLOAT.length)).map(([x, y]) => flat(x, y)).join('');
  if (v.fibrinogen) b += RODS.map(([x, y, a]) => rod(x, y, a)).join('');
  b += walls(s);
  if (v.collagen) for (const [x, d] of [[190, 1], [290, -1]]) for (let k = 0; k < 3; k++) b += `<path d="M${x} ${I + 3 + k * 8} q${d * 5} -3 ${d * 10} 0 t${d * 10} 0" fill="none" stroke="${COLL}" stroke-width="2.4" stroke-linecap="round"/>`;
  const leak = v.leak ?? 0;
  if (leak > .01) b += [[236, B + 20], [250, B + 40], [238, B + 58]].map(([x, y], i) => drop(x, y, f(clamp(leak * 3 - i, 0, 1)))).join('');
  if (v.stuck) b += STUCK.map(([x, y]) => spiky(x, y)).join('');
  if (v.ghost) b += `<g class="ghost" data-ghost="normal" ${stateAttrs(v.ghost)}>${ghostDome()}${ghostThreads(v.ghost.mesh)}</g>`;
  const now = v.model ? `data-new-state="${v.key || 'current'}" ${stateAttrs(v.model)}` : '';
  b += `<g ${now}>${plugBody(v.plug ?? 0)}${meshBody(v.mesh ?? 0, v.lys ?? 0)}</g>`;
  if (v.lessSticky) b += glyph(304, B - 66, 'block') + text(318, B - 61, 'less sticky', 'xs b red', 'start');
  return b;
}
const leader = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="1.3"/>`;
const flowLabel = () => text(14, 15, 'blood flows →', 'xs b', 'start');

/* ---------- The cascade map, drawn under the vessel ---------- */
const Y0 = VH + 22;
function node(x, y, w, title, act, ghostAct, mark) {
  const bx = x + 10, bw = w - 20, pos = a => f(bx + bw * clamp(a / 1.6, 0, 1));
  let s = `<rect x="${x}" y="${y}" width="${w}" height="38" fill="#fff" stroke="${mark === 'block' ? RED : mark === 'boost' ? BLUE : INK}" stroke-width="${mark ? 3 : 1.5}"/>`;
  s += text(x + w / 2, y + 17, title, 'xs b on-white');
  s += `<rect x="${bx}" y="${y + 24}" width="${bw}" height="7" fill="#e1e4da"/><rect x="${bx}" y="${y + 24}" width="${f(pos(act) - bx)}" height="7" fill="${BLUE}"/>`;
  if (ghostAct != null) s += `<path class="ghost-tick" d="M${pos(ghostAct)} ${y + 20} V${y + 35}" stroke="${INK}" stroke-width="2" stroke-dasharray="2 2"/>`;
  if (mark) s += glyph(x + 4, y + 2, mark);
  return s;
}
const marksFor = s => ({ ten: s.xai > .05 ? 'block' : null, thrombin: s.dti > .05 ? 'block' : null, conv: s.hep > .05 ? 'block' : null, vitk: s.vka > .05 ? 'block' : null, plasmin: s.lys > .05 ? 'boost' : null, plug: s.apl > .05 });
// Levels add one piece at a time: 1 the two ways in and factor ten, 2 thrombin, 3 fibrin, 4 antithrombin, 5 plasmin.
// Labels on the picture explain each new term in plain words, so the picture never runs ahead of its caption.
function cascade(o, { level = 5, ghost = null, liver = false, watch = false }) {
  const Y = Y0, m = marksFor(o.s), g = k => ghost ? ghost[k] : null;
  let s = text(101, Y + 10, 'extrinsic: from outside', 'xs b muted') + text(379, Y + 10, 'intrinsic: from inside', 'xs b muted');
  s += node(16, Y + 18, 170, 'tissue factor', 1, g('one'), null) + node(294, Y + 18, 170, 'contact', 1, g('one'), null);
  s += arrow(`M101 ${Y + 56} C101 ${Y + 72} 196 ${Y + 64} 214 ${Y + 80}`, INK, 2) + arrow(`M379 ${Y + 56} C379 ${Y + 72} 284 ${Y + 64} 266 ${Y + 80}`, INK, 2);
  s += node(155, Y + 84, 170, 'factor ten', o.ten, g('ten'), m.ten);
  if (level <= 3) s += text(334, Y + 108, '← shared path', 'xs b muted', 'start');
  if (liver) s += node(16, Y + 84, 116, 'vitamin K', o.factors, g('factors'), m.vitk) + arrow(`M132 ${Y + 103} H151`, INK, 2);
  if (level >= 2) {
    s += arrow(`M240 ${Y + 122} V${Y + 142}`, INK, 2) + text(148, Y + 160, 'prothrombin,', 'xs b', 'end') + text(148, Y + 177, 'idle form →', 'xs b', 'end') + node(155, Y + 146, 170, 'thrombin', o.thrombin, g('thrombin'), m.thrombin);
    if (m.conv) s += glyph(240, Y + 132, 'block');
    if (level <= 3) s += text(334, Y + 170, '← net-builder', 'xs b muted', 'start');
  }
  if (level >= 3) s += arrow(`M240 ${Y + 184} V${Y + 204}`, INK, 2) + text(148, Y + 232, 'fibrinogen →', 'xs b fib', 'end') + node(155, Y + 208, 170, 'fibrin threads', o.mesh, g('mesh'), null) + text(240, Y + 268, 'the threads weave into the plug above ↑', 'xs b fib');
  const tb = (d, y) => `<path d="${d}" fill="none" stroke="${RED}" stroke-width="2.2"/><path d="M327 ${y - 8} V${y + 8}" stroke="${RED}" stroke-width="3"/>`;
  if (level >= 4) {
    s += tb(`M338 ${Y + 128} C330 ${Y + 128} 334 ${Y + 103} 327 ${Y + 103}`, Y + 103) + tb(`M338 ${Y + 144} C330 ${Y + 144} 334 ${Y + 165} 327 ${Y + 165}`, Y + 165);
    s += node(338, Y + 115, 130, 'antithrombin', o.brake, g('brake'), null);
    if (level === 4) s += text(403, Y + 172, 'the brake', 'xs b red');
  }
  if (level >= 5) s += tb(`M338 ${Y + 227} H327`, Y + 227) + node(338, Y + 208, 130, 'plasmin', o.plasmin, g('plasmin'), m.plasmin);
  if (watch) s += text(342, Y + 186, '← watch this', 'xs b blue', 'start');
  return s;
}
const cascadeHeight = level => Y0 + (level >= 3 ? 280 : level === 2 ? 196 : 132);
// The full picture: vessel above, cascade map below, and an optional legend.
function scene(o, opt = {}) {
  const { level = 5, ghost = null, liver = false, legend = '', key = 'current', labels = '', watch = false } = opt;
  const m = marksFor(o.s);
  let b = DEFS + vessel({ spasm: 1, leak: leakOf(o), float: o.s.plt, plug: o.plug, mesh: level >= 3 ? o.mesh : 0, lys: o.s.lys, ghost: ghost ? { ...ghost, mesh: level >= 3 ? ghost.mesh : 0 } : null, model: o, key, lessSticky: m.plug });
  b += flowLabel() + labels;
  b += `<path d="M0 ${VH} H480" stroke="${RULE}" stroke-width="1.5"/>`;
  b += cascade(o, { level, ghost: ghost ? { ...ghost, one: 1 } : null, liver, watch });
  let h = cascadeHeight(level);
  if (legend) {
    const items = [[`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`, 'normal'], [`${spiky(8, 0)}<path d="M18 0 H34" stroke="${FIB}" stroke-width="3"/>`, legend]];
    if (Object.entries(m).some(([k, v]) => v === 'block' || (k === 'plug' && v))) items.push([glyph(14, 0, 'block'), 'blocked']);
    if (Object.values(m).includes('boost')) items.push([glyph(14, 0, 'boost'), 'boosted']);
    const k = keyRow(items, h + 6);
    b += k.body; h += 24 + 28 * k.rows;
  }
  return { body: b, h };
}
const sceneSvg = (label, o, opt, attr) => { const { body, h } = scene(o, opt); return svg(label, body, h, attr); };

/* ---------- Words: comparisons and text alternatives ---------- */
function compare(o) {
  const row = (name, r, up, down) => [name, r > 1.04 ? [up, 'up'] : r < .96 ? [down, 'down'] : ['about the same', 'same']];
  const rows = [row('Platelet plug', o.plug, 'bigger', 'smaller'), row('Factor ten', o.ten, 'more active', 'less active'), row('Thrombin', o.thrombin, 'more made', 'less made'), row('Fibrin net', o.mesh, 'thicker', 'thinner')];
  if (Math.abs(o.factors - 1) > .04) rows.push(row('Working clotting factors', o.factors, 'more', 'fewer'));
  if (Math.abs(o.brake - 1) > .04) rows.push(row('Antithrombin brake', o.brake, 'pressed harder', 'eased off'));
  if (Math.abs(o.plasmin - 1) > .04) rows.push(row('Plasmin', o.plasmin, 'more active', 'less active'));
  return rows;
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (o, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${compare(o).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = o => compare(o).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');

/* ---------- Core step pictures ---------- */
function leakPicture() {
  return DEFS + vessel({ leak: 1 }) + flowLabel() + text(466, 15, 'vessel wall', 'xs b', 'end') + text(60, 122, 'blood', 'sm b red') +
    leader(198, B - 2, 172, B + 16) + text(168, B + 26, 'tear', 'xs b', 'end') + text(262, B + 46, 'leaking out', 'xs b red', 'start') + text(14, VH - 10, 'outside the vessel', 'xs b muted', 'start');
}
function spasmPicture() {
  return DEFS + vessel({ spasm: 1, leak: .45 }) + flowLabel() +
    arrow(`M150 ${B + 46} V${B + 8}`, INK, 3) + arrow(`M330 ${B + 46} V${B + 8}`, INK, 3) + text(150, B + 64, 'wall squeezes in', 'xs b') + text(330, B + 64, 'wall squeezes in', 'xs b') +
    `<path d="M140 30 Q240 ${TOPIN + 26} 340 30" fill="none" stroke="${BLUE}" stroke-width="2" stroke-dasharray="4 4"/>` + text(466, 15, 'narrower here', 'xs b blue', 'end');
}
function plateletsPicture() {
  let b = DEFS + vessel({ spasm: 1, leak: .45 }) + flowLabel();
  b += `<rect x="8" y="${B + 6}" width="196" height="62" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>`;
  b += cell(36, B + 22, 1.2) + text(64, B + 27, 'red blood cell', 'xs b on-white', 'start');
  b += flat(36, B + 50, 1.4) + text(64, B + 55, 'platelet', 'xs b blue on-white', 'start');
  b += text(466, 15, 'platelets ride along', 'xs b blue', 'end');
  return b;
}
function stickPicture() {
  return DEFS + vessel({ spasm: 1, leak: .35, collagen: true, stuck: true }) + flowLabel() +
    leader(290, I + 12, 330, B + 16) + text(334, B + 26, 'collagen:', 'xs b', 'start') + text(334, B + 44, 'tough fibres', 'xs b', 'start') +
    leader(196, I - 8, 150, B + 16) + text(146, B + 26, 'sticky platelets', 'xs b blue', 'end');
}
function plugPicture() {
  return DEFS + vessel({ spasm: 1, collagen: true, plug: 1, float: 1 }) + flowLabel() +
    arrow('M150 104 Q178 130 196 152', BLUE, 2.5) + arrow('M340 112 Q312 134 290 154', BLUE, 2.5) + text(466, 15, 'more platelets called in', 'xs b blue', 'end') +
    leader(276, B - 20, 330, B + 16) + text(334, B + 26, 'platelet plug', 'xs b', 'start');
}
function needMeshPicture() {
  let b = DEFS + vessel({ spasm: 1, plug: 1, fibrinogen: true }) + flowLabel() + text(466, 15, 'fibrinogen, dissolved in blood', 'xs b fib', 'end');
  b += leader(286, B - 24, 330, B + 10) + text(334, B + 20, 'soft plug', 'xs b', 'start');
  b += `<rect x="8" y="${B + 6}" width="300" height="62" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>`;
  b += rod(36, B + 22, 20) + rod(58, B + 32, -25) + rod(40, B + 40, 70);
  b += arrow(`M88 ${B + 30} H160`, INK, 2) + text(124, B + 22, '?', 'sm b on-white');
  b += ['M176 20 Q210 44 250 26', 'M176 36 Q214 14 252 40', 'M180 46 Q220 30 254 18'].map(d => `<path d="${d.replace(/(\d+) (\d+)/g, (m, x, y) => `${x} ${Number(y) + B}`)}" fill="none" stroke="${FIB}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  b += text(46, B + 62, 'fibrinogen', 'xs b fib on-white') + text(216, B + 62, 'fibrin threads', 'xs b fib on-white');
  return b;
}
function switchesPicture() {
  let b = DEFS;
  const sw = (x, y, on) => `<rect x="${f(x - 17)}" y="${y - 9}" width="34" height="18" rx="9" fill="${on ? BLUE : '#d5d8ce'}" stroke="${INK}" stroke-width="1.5"/><circle cx="${f(on ? x + 8 : x - 8)}" cy="${y}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`;
  const ys = [62, 132, 202, 272], xsOf = n => { const gap = Math.min(160, 416 / n); return Array.from({ length: n }, (_, i) => 240 + (i - (n - 1) / 2) * gap); };
  ys.forEach((y, k) => { b += `<rect x="${f(240 - 30 - k * 64)}" y="${y - 24}" width="${f(60 + k * 128)}" height="48" fill="#dfe5ff" opacity=".7"/>`; });
  ys.forEach((y, k) => {
    const xs = xsOf(2 ** k);
    if (k < ys.length - 1) { const next = xsOf(2 ** (k + 1)); xs.forEach((x, i) => { [next[2 * i], next[2 * i + 1]].forEach(nx => { b += arrow(`M${f(x)} ${y + 11} L${f(nx)} ${ys[k + 1] - 13}`, INK, 1.6); }); }); }
    xs.forEach(x => { b += sw(x, y, true); });
  });
  b += text(240, 28, 'one clotting factor switched on…', 'xs b') + text(240, 316, '…switches on more at every step', 'xs b blue');
  const key = keyRow([[sw(17, 0, false), 'switched off'], [sw(17, 0, true), 'switched on']], 346);
  return b + key.body;
}
const VESSEL_LABEL = 'The narrowed vessel with its platelet plug';
const CORE = {
  leak: () => svg('A blood vessel drawn from the side: blood with red blood cells flows left to right between two pink walls. The lower wall has a tear, and drops of blood leak out into the tissue outside the vessel.', leakPicture(), VH),
  spasm: () => svg('The same vessel. Arrows show the walls squeezing inward around the tear, so the tube is narrower there and fewer drops leak out.', spasmPicture(), VH),
  platelets: () => svg('The narrowed vessel with small flat blue discs, platelets, floating among the much larger red blood cells. A box in the corner compares one red blood cell with one platelet.', plateletsPicture(), VH),
  stick: () => svg('Close up of the tear: brown collagen fibres poke out of the torn ends of the wall, and a few platelets have turned spiky and cling to the torn edges. A little blood still leaks out.', stickPicture(), VH),
  plug: () => svg('A dome of spiky platelets now fills the tear: the platelet plug. Arrows show more platelets drifting in to join it. No more blood leaks out.', plugPicture(), VH),
  needmesh: () => svg('The platelet plug sits in the tear, labelled soft. Short amber rods of dissolved fibrinogen float in the blood. A small diagram below shows fibrinogen rods, a question mark, then long crossing fibrin threads.', needMeshPicture(), VH),
  switches: () => svg('A waterfall of switches. At the top, one clotting factor is switched on; it switches on two below it, those switch on four, and those switch on eight. A key shows a grey switch as off and a blue switch as on.', switchesPicture(), 362),
  paths: () => sceneSvg(`${VESSEL_LABEL}, and below it a map of the cascade. Tissue factor, on the fast extrinsic way in, and contact, on the slower intrinsic way in, both point to factor ten, the start of the common pathway. Each box has a blue bar showing how switched on it is.`, BASE, { level: 1, labels: leader(276, B - 20, 330, B + 16) + text(334, B + 26, 'platelet plug', 'xs b', 'start') }),
  thrombin: () => sceneSvg(`${VESSEL_LABEL}. In the cascade map below, factor ten now points down to thrombin, with prothrombin feeding in from the side.`, BASE, { level: 2 }),
  mesh: () => sceneSvg('Amber fibrin threads now weave across the platelet plug, trapping red blood cells. In the cascade map, thrombin points down to fibrin threads, with fibrinogen feeding in from the side.', BASE, { level: 3, labels: leader(296, B - 40, 340, B + 16) + text(344, B + 26, 'fibrin net', 'xs b fib', 'start') }),
  brake: () => sceneSvg('The plug and its fibrin net, with the cascade map below. One new box on the right, labelled the brake: antithrombin, with red brake lines to factor ten and to thrombin.', BASE, { level: 4 }),
  cleanup: () => sceneSvg('The plug and its fibrin net, with the cascade map below. One new box at the bottom right: plasmin, with a red line cutting into the fibrin threads.', BASE, { level: 5 }),
  whole: () => sceneSvg('The whole picture: the narrowed vessel, the platelet plug woven with fibrin threads, and below it the full cascade map with both ways in, factor ten, thrombin, fibrin threads, the antithrombin brake and plasmin. Labels point out the two things to watch: how many platelets there are and how much thrombin is made.', BASE, {
    level: 5, watch: true,
    labels: text(466, 15, 'watch: how many platelets', 'xs b blue', 'end') + leader(184, B - 22, 150, B + 16) + text(146, B + 26, 'platelet plug', 'xs b', 'end') + leader(296, B - 40, 340, B + 16) + text(344, B + 26, 'fibrin net', 'xs b fib', 'start')
  })
};

/* ---------- What changes it ---------- */
const CHANGES = { heparin: { hep: 1 }, vka: { vka: 1 }, xa: { xai: 1 }, dti: { dti: 1 }, antiplatelet: { apl: 1 }, lytic: { lys: 1 } };
const LEGEND = { heparin: 'with heparins', vka: 'with a vitamin K antagonist', xa: 'with a factor Xa inhibitor', dti: 'with a direct thrombin inhibitor', antiplatelet: 'with an antiplatelet drug', lytic: 'with a thrombolytic' };
const CHANGE_WHERE = {
  heparin: 'A red blocked mark sits on the arrow from factor ten to thrombin, where prothrombin is turned into thrombin. Factor ten stays at normal, but the thrombin bar shrinks below its dashed normal tick, the fibrin bar shrinks with it, and fewer fibrin threads cross the platelet plug, which itself is unchanged.',
  vka: 'A vitamin K box appears beside factor ten, marked blocked, and its bar shrinks: fewer working clotting factors. The factor ten, thrombin and fibrin bars shrink, and fewer fibrin threads cross the plug.',
  xa: 'The factor ten box is marked blocked and its bar shrinks. Thrombin and fibrin shrink with it, and fewer fibrin threads cross the platelet plug.',
  dti: 'The thrombin box is marked blocked and its bar shrinks, while factor ten stays at normal. The fibrin bar shrinks and only a few threads cross the platelet plug.',
  antiplatelet: 'The platelet plug is marked less sticky and shrinks to a smaller dome inside its dashed normal outline, and a little blood oozes out. Thrombin and fibrin dip a little.',
  lytic: 'The plasmin box is outlined in blue and its bar fills. The fibrin threads over the plug break into short pieces and most disappear; the platelet plug and the thrombin bar are unchanged.'
};
const DURATION = 2000;
const stateAt = (kind, t) => mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, 1 - Math.pow(1 - clamp(t, 0, 1), 3));
function changePicture(el, t) {
  const kind = el.dataset.kind, o = model(stateAt(kind, t));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed outlines and ticks of the normal clot. ${CHANGE_WHERE[kind]} Compared with normal: ${describe(o)}.`;
  const pic = sceneSvg(label, o, { level: 5, ghost: BASE, liver: kind === 'vka', legend: LEGEND[kind], key: kind }, `data-progress="${t >= 1 ? 'done' : 'running'}"`);
  return { pic, ro: readout(o, 'Compared with normal') };
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
function showStep(n, focus = false) {
  cancelAnimationFrame(frame);
  current = clamp(n, 0, steps.length - 1);
  steps.forEach((el, i) => { el.hidden = i !== current; });
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === steps.length - 1 ? 'Start again ↻' : 'Next →';
  progress.textContent = `Step ${current + 1} of ${steps.length}`;
  if (location.hash !== `#step-${current + 1}`) history.replaceState(null, '', `#step-${current + 1}`);
  const el = steps[current];
  if (isAnimated(el)) animate(el);
  // Scroll the whole step (not just its heading) so the top of a side-by-side visual is never under the sticky bar.
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
  if (tab.id === 'tab-lesson') { if (isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
  update();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => activate(t));
  t.addEventListener('keydown', e => {
    const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (n !== undefined) { e.preventDefault(); activate(tabs[n], true); }
  });
});
function fromHash(focus = false) {
  const m = location.hash.match(/^#step-(\d+)$/);
  if (!m) return false;
  if (tabs[0].getAttribute('aria-selected') !== 'true') activate(tabs[0]);
  showStep(Number(m[1]) - 1, focus);
  return true;
}
window.addEventListener('hashchange', () => fromHash(true));

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
  const label = `Illustrative model with these settings, drawn over faint dashed outlines and ticks of the normal clot. Platelets: ${pltWord(P.plt)}. Drugs: ${on.length ? on.map(k => DRUG_NAMES[k]).join(', ') : 'none'}. Compared with normal: ${describe(o)}.`;
  $('#explore-visual').innerHTML = sceneSvg(label, o, { level: 5, ghost: BASE, liver: true, legend: 'these settings', key: 'explore' }) + readout(o, 'Compared with normal');
  const howMany = pltWord(P.plt) === 'typical' ? 'a typical number of platelets' : `${pltWord(P.plt)} platelets than typical`;
  const cvLabel = `Illustrative model of the wound: ${howMany} in the blood, and a platelet plug that is ${compare(o)[0][1][0]} compared with the dashed normal outline.`;
  const cv = DEFS + vessel({ spasm: 1, leak: leakOf(o), float: P.plt, plug: o.plug, mesh: o.mesh, ghost: BASE, model: o, key: 'clinical' }) + flowLabel() + text(466, 15, `platelets: ${pltWord(P.plt)}`, 'xs b blue', 'end');
  const k = keyRow([[`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`, 'normal plug'], [spiky(8, 0), 'model now']], VH + 22);
  $('#clinical-visual').innerHTML = svg(cvLabel, cv + k.body, VH + 44);
  let results = `Illustrative model, relative to the normal clot (100%): platelets ${pct(P.plt)} · platelet plug ${pct(o.plug)} · factor ten ${pct(o.ten)} · thrombin ${pct(o.thrombin)} · fibrin net ${pct(o.mesh)}. Drugs on board: ${on.length ? on.map(k => DRUG_NAMES[k]).join(', ') : 'none'}.`;
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
      const a = document.createElement('a'); a.href = `#step-${d.step}`; a.textContent = `See it in the lesson, step ${d.step}`;
      // The hash may already name this step, so open it directly rather than waiting for a hashchange.
      a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); fromHash(true); });
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

/* ---------- Start ---------- */
steps.forEach(el => {
  const kind = el.dataset.kind;
  if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
  else drawAt(el, 1);
  el.querySelector('.replay')?.addEventListener('click', () => animate(el));
});
if (!fromHash()) showStep(0);
update();
load();
