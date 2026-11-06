// Lesson 10: Ventilation, perfusion and the alveolus. The kit (/lab/kit/kit.js) runs the page; this file is the
// model, the pictures and the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number((+n).toFixed(1));
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Teaching model ----------
   Two air sacs share one blood supply after a small bypass. Each sac normally gets half the air and half the
   remaining blood. Per sac: alveolar CO2 = arriving CO2 ÷ (1 + kc × ratio), and alveolar O2 solves
   ko × ratio × (inspired O2 − alveolar O2) = content(alveolar O2) − content(arriving), so no air gives arriving gas and
   no blood gives inspired air. Content is Hill-curve saturation (oxygen on hemoglobin only; dissolved oxygen is left out).
   No clinical number lives here: once clinical-values.json loads, every constant is set from it (see load()). */
// The curve's steepness is an illustrative modelling choice (a Hill coefficient), not a reference value.
const STEEPNESS = 2.7;
// If the data file cannot load, the lesson still runs on illustrative stand-in constants (arbitrary pressure units).
const FALLBACK = { n: STEEPNESS, p50: 1, pio2: 5.6, pAo2n: 3.9, pAco2n: 1, pvo2: 1.5, pvco2: 1.12, s0: .03, vq: 1, o2pct: 1 };
let K = null, BASE = null;
const NORMAL = { fio2: 1, airway: 1, flow: 1, fill: 0 };
const NARROWED = { ...NORMAL, airway: .2 };   // narrowed airway to the right sac (an asthma attack)
const CHANGES = {
  oxygen: { fio2: 2 },       // oxygen share of the air breathed in doubled
  beta2: { airway: .85 },    // from narrowed, the relaxing signal opens the airway most of the way
  antimusc: { airway: .8 },  // from narrowed, blocking the tightening signal opens it most of the way
  pe: { flow: .04 },         // a clot cuts blood to the right sac to almost nothing; that blood goes to the left sac
  pneumonia: { fill: 1 }     // the right sac filled with fluid
};
const sat = P => P <= 0 ? 0 : 1 / (1 + Math.pow(P / K.p50, -K.n));
const content = P => sat(P) + K.d * P;
function invContent(c) {
  let lo = 0, hi = K.pio2 * 4;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (content(m) < c) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function derive() {
  K.d = 0;  // dissolved oxygen is left out of the content (see Explore freely's model notes)
  K.half = (1 - K.s0) / 2;
  K.Cv = content(K.pvo2);
  K.ko = (content(K.pAo2n) - K.Cv) / (K.pio2 - K.pAo2n);
  K.kc = K.pvco2 / K.pAco2n - 1;
}
// One air sac with air v and blood q (shares of the total); ratio 1 is the normal sac.
function unit(v, q, pio2) {
  if (q < 1e-9) return { po2: pio2, pco2: 0, c: content(pio2), r: Infinity, v, q };
  const r = v / q * 2 * K.half;
  if (r < 1e-9) return { po2: K.pvo2, pco2: K.pvco2, c: K.Cv, r: 0, v, q };
  let lo = K.pvo2, hi = pio2;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (K.ko * r * (pio2 - m) > content(m) - K.Cv) lo = m; else hi = m; }
  const po2 = (lo + hi) / 2;
  return { po2, pco2: K.pvco2 / (1 + K.kc * r), c: content(po2), r, v, q };
}
function lungs(p, squeeze) {
  const pio2 = K.pio2 * p.fio2;
  const qB = K.half * p.flow * squeeze, qA = 1 - K.s0 - qB;   // blood kept from the right sac goes to the left
  const qBfluid = qB * p.fill, qBair = qB - qBfluid;          // blood past fluid-filled alveoli meets no air
  const vA = .5, vB = .5 * p.airway * (1 - p.fill);
  const A = unit(vA, qA, pio2);
  const B = qBair > 1e-9 || vB > 1e-9 ? unit(vB, qBair, pio2) : null;
  const fixed = K.s0 + qBfluid;
  const shunt = fixed + (B && B.r === 0 ? qBair : 0);
  const ca = qA * A.c + (B ? qBair * B.c : 0) + fixed * K.Cv;
  const paco2 = qA * A.pco2 + (B ? qBair * B.pco2 : 0) + fixed * K.pvco2;
  const vT = vA + vB;
  const pao2 = invContent(ca);
  return {
    p, pio2, A, B, qA, qB, qBair, qBfluid, vA, vB, shunt, ca, pao2, sao2: sat(pao2), paco2,
    pAo2: (vA * A.po2 + (B ? vB * B.po2 : 0)) / vT, pAco2: (vA * A.pco2 + (B ? vB * B.pco2 : 0)) / vT,
    alv: vT, vqB: qB > 1e-9 ? vB / qB * 2 * K.half : Infinity, squeeze,
    cB: qB > 1e-9 ? ((B ? qBair * B.c : 0) + qBfluid * K.Cv) / qB : K.Cv
  };
}
// Hypoxic vasoconstriction (Explore freely only): the right sac's blood shrinks toward three tenths as its oxygen
// falls toward that of arriving blood; repeated half-steps until it settles.
function model(p) {
  if (!p.hpv) return lungs(p, 1);
  let sq = 1, o = lungs(p, sq);
  for (let i = 0; i < 40; i++) {
    const t = o.B ? clamp((o.B.po2 - K.pvo2) / (K.pAo2n - K.pvo2), 0, 1) : 0;
    sq += .5 * (.3 + .7 * (1 - p.fill) * t - sq);
    o = lungs(p, sq);
  }
  return o;
}
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) if (typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; return out; };

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17). The same air sac is
   drawn everywhere: its airway comes down from above, its capillary loops under it, blood enters purple on the
   outside and leaves coloured by how full of oxygen it is. */
const INK = '#171916', BLUE = '#254dff', ART = '#b3261e', VEN = '#6b3fa0', RULE = '#babeb3', MUTED = '#53584d';
const AIR = '#ffffff', RICHAIR = '#c3cfff', STALE = '#d6d2c3', FRESH = '#dfe6ff', RICH = '#aebcff', FLUID = '#e2cb86', MUSCLE = '#d9a194';
let pictureId = 0;  // each picture gets its own ids: a gradient or marker referenced from a hidden step would not draw
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [ART]: 'r', [VEN]: 'v', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const part = (name, body) => `<g data-part="${name}">${body}</g>`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const lerpHex = (a, b, t) => { const A = hex(a), B = hex(b), u = clamp(t, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, '0')).join(''); };
const bloodColor = c => lerpHex(VEN, ART, (c - K.Cv) / (content(K.pAo2n) - K.Cv));
const sacColor = po2 => po2 <= K.pAo2n ? lerpHex(STALE, FRESH, (po2 - K.pvo2) / (K.pAo2n - K.pvo2)) : lerpHex(FRESH, RICH, (po2 - K.pAo2n) / (K.pio2 * 2 - K.pAo2n));
const airColor = fio2 => lerpHex(AIR, RICHAIR, fio2 - 1);
const wAir = a => 4 + 16 * Math.sqrt(clamp(a, 0, 1.5));     // a: air, relative to a normal sac
const wBlood = q => 3 + 11 * Math.sqrt(Math.max(0, q));       // q: blood, relative to a normal sac

// Tubes drawn in two passes, all outlines then all fills, so joins are seamless.
const outline = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3.5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fillTube = (d, w, color, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const tubes = list => list.map(([d, w]) => outline(d, w)).join('') + list.map(([d, w, c, x]) => fillTube(d, w, c, x)).join('');
// The normal width of a tube, as a dashed outline drawn over it, so it shows whether the tube grew or shrank.
let ghostN = 0;
function ghostTube(d, w) {
  const id = `ah-gm${++ghostN}`;
  return `<g class="ghost" data-ghost="normal"><mask id="${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="500" height="440"><rect x="-10" y="-10" width="500" height="440" fill="#fff"/><path d="${d}" fill="none" stroke="#000" stroke-width="${f(Math.max(.5, w - .5))}" stroke-linecap="round" stroke-linejoin="round"/></mask><path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3.5)}" stroke-dasharray="7 5" stroke-linejoin="round" mask="url(#${id})"/></g>`;
}
// A capillary's colour runs from arriving blood (where it meets the sac, x1) to the colour it leaves with (x2).
const gradient = (id, x1, x2, end) => `<linearGradient id="ah-g${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="0" x2="${f(x2)}" y2="0"><stop offset="0" stop-color="${VEN}"/><stop offset=".55" stop-color="${end}"/><stop offset="1" stop-color="${end}"/></linearGradient>`;

// Oxygen (blue dots) and carbon dioxide (rings) scattered through a sac, above any fluid.
const DISK = Array.from({ length: 64 }, (_, i) => { const a = i * 2.39996323, r = Math.sqrt((i + .5) / 64) * .8; return [r * Math.cos(a), r * Math.sin(a)]; });
function gas(cx, cy, R, u, fill = 0) {
  const nO = Math.round(clamp(2 + 9 * (u.po2 - K.pvo2) / (K.pAo2n - K.pvo2), 0, 26));
  const nC = Math.round(clamp(5 * u.pco2 / K.pAco2n, 0, 8));
  const top = cy + R - 2 * R * fill, rO = Math.max(3.6, R * .075), rC = Math.max(3.4, R * .065);
  let s = '', o = 0, c = 0;
  for (let k = 0; k < 64 && (o < nO || c < nC); k++) {
    const [dx, dy] = DISK[(k * 37) % 64], x = f(cx + dx * R), y = f(cy + dy * R);
    if (y > top - R * .12) continue;
    if (k % 2 === 0 && o < nO) { s += `<circle data-gas="o2" cx="${x}" cy="${y}" r="${f(rO)}" fill="${BLUE}"/>`; o++; }
    else if (k % 2 === 1 && c < nC) { s += `<circle data-gas="co2" cx="${x}" cy="${y}" r="${f(rC)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`; c++; }
  }
  return s;
}
// A sac: coloured by its oxygen (stale grey, fresh pale blue, rich blue), with fluid rising from the bottom.
function sac(cx, cy, R, u, fill, id, gasOn = true) {
  let s = `<circle data-sac="${id}" cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${sacColor(u ? u.po2 : K.pvo2)}"/>`;
  if (fill > .005) {
    const top = f(cy + R - 2 * R * fill);
    s += part('fluid', `<clipPath id="ah-c${id}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}"/></clipPath><rect data-fluid clip-path="url(#ah-c${id})" x="${f(cx - R)}" y="${top}" width="${f(2 * R)}" height="${f(2 * R * fill)}" fill="${FLUID}"/>`);
    if (fill > .4) s += text(cx, f(Math.min(cy + R - 14, top + 28 + R * .25)), 'fluid', 'xs b on-fluid');
  }
  if (gasOn && u && fill < .999) s += gas(cx, cy, R, u, fill);
  return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
}
const GAS_KEY = (y, x = 16) => `<g transform="translate(${x} ${y})"><circle cx="8" cy="-6" r="6" fill="${BLUE}"/>${text(22, 0, 'oxygen', 'xs', 'start')}<circle cx="110" cy="-6" r="5.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/>${text(124, 0, 'carbon dioxide', 'xs', 'start')}</g>`;

/* ---------- One air sac ---------- */
// Geometry of one sac at (cx, cy), radius R: its capillary is a U under it, from the left stub to the right stub.
function geom(cx, cy, R) {
  const k = R / 56, g = f(R * 1.13 + 8), ext = f(R * .8), low = f(cy + g + R * .3);
  return { cx, cy, R, k, g, ext, low, d: `M${f(cx - g - ext)} ${low} H${f(cx - g)} V${cy} A${g} ${g} 0 0 0 ${f(cx + g)} ${cy} V${low} H${f(cx + g + ext)}` };
}
// A point a share s of the way along that capillary, and how far through the bend under the sac it is.
function along(G, s) {
  const L1 = G.ext, L2 = G.low - G.cy, L3 = Math.PI * G.g, total = 2 * L1 + 2 * L2 + L3;
  let d = clamp(s, 0, 1) * total;
  if (d < L1) return { x: G.cx - G.g - G.ext + d, y: G.low, bend: 0 };
  d -= L1;
  if (d < L2) return { x: G.cx - G.g, y: G.low - d, bend: 0 };
  d -= L2;
  if (d < L3) { const a = Math.PI - d / G.g; return { x: G.cx + G.g * Math.cos(a), y: G.cy + G.g * Math.sin(a), bend: d / L3 }; }
  d -= L3;
  if (d < L2) return { x: G.cx + G.g, y: G.cy + d, bend: 1 };
  return { x: G.cx + G.g + d - L2, y: G.low, bend: 1 };
}
// Draws one sac: air and blood relative to normal, fluid share, oxygen in the air breathed in (fio2 × room air).
function drawUnit(G, { air = 1, blood = 1, fill = 0, fio2 = 1, top = 0, id = 'u', gasOn = true, ghost = null, lumen = null, airPart = 'airway', bloodPart = 'capillary', sacR = G.R, plasma = false } = {}) {
  const u = unit(.5 * air, K.half * blood, K.pio2 * fio2);
  const leave = fill * K.Cv + (1 - fill) * u.c;
  const { cx, cy, R, k, d } = G;
  const aw = lumen ?? wAir(air) * k * .9, airway = `M${f(cx)} ${f(top)} V${f(cy - R + 6)}`;
  let s = '';
  if (plasma) s += part(bloodPart, tubes([[d, wBlood(blood) * k, '#f6dcd7']]));
  else if (blood > .004) s += gradient(id, cx - G.g, cx + G.g, bloodColor(leave)) + part(bloodPart, tubes([[d, wBlood(blood) * k, `url(#ah-g${id})`]]));
  else if (!ghost || ghost.blood == null) s += part(bloodPart, `<path d="${d}" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="5 5"/>`);
  let a = air > .02 || lumen ? tubes([[airway, aw, airColor(fio2)]]) : tubes([[airway, 8 * k, AIR]]);
  if (air <= .02 && !lumen) a += `<path d="M${f(cx - 16 * k)} ${f(cy - R - 12 * k)} H${f(cx + 16 * k)}" stroke="${INK}" stroke-width="${f(6 * k)}" stroke-linecap="round"/>`;
  s += part(airPart, a);
  if (ghost?.blood != null) s += ghostTube(d, wBlood(ghost.blood) * k);
  if (ghost?.air != null || ghost?.lumen != null) s += ghostTube(airway, ghost.lumen ?? wAir(ghost.air) * k * .9);
  s += sac(cx, cy, sacR, fill >= .999 ? null : u, fill, id, gasOn);
  return { s, u, leave };
}

/* ---------- The air-to-blood scale ---------- */
// No air at the left, matched in the middle, no blood at the right (a squashed log scale of the ratio).
const SC0 = 48, SC1 = 432;
const scaleX = r => r === Infinity ? SC1 : r <= 0 ? SC0 : f(240 + (SC1 - 240) * (2 / Math.PI) * Math.atan(Math.log10(r) / .5));
function ratioScale(y, r, { left = ['too little air'], right = ['too little blood'], leftCls = 'xs b', rightCls = 'xs b', part: pt = 'scale', leftPart = '', rightPart = '' } = {}) {
  let s = `<rect x="${SC0}" y="${y}" width="${SC1 - SC0}" height="10" rx="5" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
  s += `<path d="M240 ${y - 5} V${y + 15}" stroke="${INK}" stroke-width="2"/>`;
  s += text(240, y + 34, 'matched', 'xs b');
  const end = (rows, x, anchor, cls, p) => { const g = rows.map((w, i) => text(x, y + 34 + i * 21, w, cls, anchor)).join(''); return p ? part(p, g) : g; };
  s += end(left, SC0, 'start', leftCls, leftPart) + end(right, SC1, 'end', rightCls, rightPart);
  const x = scaleX(r);
  s += `<path data-marker d="M${f(x - 10)} ${y - 17} L${f(x + 10)} ${y - 17} L${f(x)} ${y - 1} Z" fill="${BLUE}" stroke="#fff" stroke-width="1.5"/>`;
  return part(pt, s);
}

/* ---------- The two-sac lung ---------- */
const LG = { ax: 124, bx: 356, cy: 140, R: 48 };
LG.g = f(LG.R * 1.13 + 8); LG.k = LG.R / 56;
const LP = {
  trachea: 'M240 0 V40',
  brA: `M240 36 C240 70 ${LG.ax} 60 ${LG.ax} ${LG.cy - LG.R + 6}`,
  brB: `M240 36 C240 70 ${LG.bx} 60 ${LG.bx} ${LG.cy - LG.R + 6}`,
  capA: `M34 300 V${LG.cy} H${f(LG.ax - LG.g)} A${LG.g} ${LG.g} 0 0 0 ${f(LG.ax + LG.g)} ${LG.cy} V256 H240`,
  capB: `M446 300 V${LG.cy} H${f(LG.bx + LG.g)} A${LG.g} ${LG.g} 0 0 1 ${f(LG.bx - LG.g)} ${LG.cy} V256 H240`,
  artery: 'M240 256 V292'
};
const satX = s => f(60 + 360 * clamp((s - .5) / .5, 0, 1));   // the bar runs from half full to full
function statusOf(u, fill) {
  if (fill > .5 || !u || u.r === 0) return ['shunt:', 'blood, no air'];
  if (u.r === Infinity || u.r > 8) return ['dead space:', 'air, no blood'];
  if (u.r < .6) return ['short of air', 'for its blood'];
  if (u.r > 1.7) return ['little blood', 'for its air'];
  return ['matched'];
}
// The lung: o is a model state. words: { A, B } replace the sacs' status lines; extra is drawn on top.
function lungPicture(o, opt = {}) {
  const { ghost = null, words = {}, clot = 0, squeeze = 0, delta = '', extra = '', key = !!ghost } = opt;
  const p = o.p, wA = wBlood(o.qA / K.half) * LG.k, wB = wBlood(o.qB / K.half) * LG.k, wArt = wBlood((o.qA + o.qB) / K.half) * LG.k;
  let b = DEFS;
  const cA = bloodColor(o.A.c), cB = bloodColor(o.cB), cArt = bloodColor(o.ca);
  b += gradient('A', LG.ax - LG.g, LG.ax + LG.g, cA) + gradient('B', LG.bx + LG.g, LG.bx - LG.g, cB);
  b += outline(LP.capA, wA) + outline(LP.capB, wB) + outline(LP.artery, wArt);
  b += part('capillary', fillTube(LP.capA, wA, 'url(#ah-gA)') + fillTube(LP.capB, wB, 'url(#ah-gB)'));
  b += part('artery', fillTube(LP.artery, wArt, cArt) + `<path d="M229 292 H251 L240 308 Z" fill="${cArt}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`);
  if (clot > .02) b += part('clot', `<ellipse data-clot cx="446" cy="270" rx="${f(5 + 5 * clot)}" ry="${f(8 + 8 * clot)}" fill="${INK}"/>` + text(428, 277, 'clot', 'xs b', 'end', fade(span(clot, .3, .6))));
  if (squeeze > .02) b += part('squeeze', `<g ${fade(span(squeeze, 0, .4))}>${arrow('M414 196 H432', INK, 3)}${arrow('M478 196 H460', INK, 3)}</g>`);
  const airCol = airColor(p.fio2);
  let air = tubes([[LP.trachea, 24, airCol], [LP.brA, wAir(1) * LG.k, airCol], [LP.brB, wAir(p.airway) * LG.k, airCol]]);
  if (p.airway < .03) air += `<path d="M${LG.bx - 14} ${LG.cy - LG.R - 12} H${LG.bx + 14}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  b += part('airway', air);
  if (ghost) {
    if (Math.abs(ghost.qA - o.qA) > .004) b += ghostTube(LP.capA, wBlood(ghost.qA / K.half) * LG.k);
    if (Math.abs(ghost.qB - o.qB) > .004) b += ghostTube(LP.capB, wBlood(ghost.qB / K.half) * LG.k);
    if (Math.abs(ghost.p.airway - p.airway) > .01) b += ghostTube(LP.brB, wAir(ghost.p.airway) * LG.k);
  }
  b += sac(LG.ax, LG.cy, LG.R, o.A, 0, 'A') + sac(LG.bx, LG.cy, LG.R, o.B, o.B ? p.fill : 1, 'B');
  const lines = (x, rows, cls = 'xs b') => rows.map((w, i) => text(x, 232 + i * 21, w, cls)).join('');
  b += lines(110, words.A || statusOf(o.A, 0)) + lines(370, words.B || statusOf(o.B, p.fill));
  b += text(226, 24, 'air in', 'xs b', 'end');
  b += text(16, 330, 'from the body', 'xs b purple', 'start') + text(240, 330, 'to the body', 'xs b red') + text(464, 330, 'from the body', 'xs b purple', 'end');
  // The bar: the saturation of the mixed blood going to the body (share of hemoglobin seats full), from half to full.
  b += text(16, 362, 'saturation of blood to the body', 'xs b', 'start') + text(16, 386, 'half', 'xs muted', 'start') + text(464, 386, 'full', 'xs muted', 'end');
  b += `<rect x="60" y="372" width="360" height="18" fill="#fff" stroke="${RULE}"/>` + part('artery', `<rect data-bar="o2" x="60" y="372" width="${f(satX(o.sao2) - 60)}" height="18" fill="${cArt}"/>`);
  if (ghost) b += `<path class="ghost" data-ghost-tick d="M${satX(ghost.sao2)} 366 V396" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
  if (key) b += `<path d="M340 12 H372 M340 24 H372" stroke="${INK}" stroke-width="1.8" stroke-dasharray="7 5"/>` + text(380, 24, 'normal', 'xs muted', 'start');
  if (delta) b += text(464, 362, delta, 'xs b blue', 'end');
  b += extra;
  return `<g data-new-state ${attrs(o)}>${b}</g>`;
}
const LUNG_H = 400;
function attrs(o) {
  const r = (a, b) => (b ? a / b : a > 1e-9 ? 99 : 1).toFixed(4);
  return `data-pao2="${r(o.pao2, BASE.pao2)}" data-air-b="${r(o.vB, BASE.vB)}" data-blood-b="${r(o.qB, BASE.qB)}" data-shunt="${r(o.shunt, BASE.shunt)}"`;
}
const lungSvg = (label, o, opt) => svg(label, lungPicture(o, opt), LUNG_H);

/* ---------- Words: comparisons and text alternatives ---------- */
function trend(v, b, up, down) { const r = b ? v / b : v > 1e-9 ? 2 : 1; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o, ref) {
  return [
    ['Oxygen pressure in blood to the body', trend(o.pao2, ref.pao2, 'higher', 'lower')],
    ['Air reaching the right sac', trend(o.vB, ref.vB, 'more', 'less')],
    ['Blood flowing past the right sac', trend(o.qB, ref.qB, 'more', 'less')],
    ['Blood that meets no air (shunt)', trend(o.shunt, ref.shunt, 'more', 'less')]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readoutOf = (rows, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${rows.map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const readout = (o, ref, head) => readoutOf(compare(o, ref), head);
const describe = (o, ref) => compare(o, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
const sacWords = o => `Left sac: ${statusOf(o.A, 0).join(' ')}. Right sac: ${statusOf(o.B, o.p.fill).join(' ')}.`;

/* ---------- Build the idea: the step pictures ---------- */
function overviewPicture() {
  let b = DEFS;
  const lung = 'M128 104 C92 96 34 150 28 250 C24 316 52 344 100 336 C134 330 140 300 140 260 L140 132 C140 116 136 106 128 104Z';
  const twigs = 'M100 170 L78 214 M100 170 L112 226 M78 214 L62 252 M78 214 L92 262 M112 226 L104 280 M112 226 L126 276';
  const half = `<path d="${lung}" fill="#f3dcd6" stroke="${ART}" stroke-width="2.5"/>`;
  const halfTwigs = `<path d="${twigs}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  b += half + `<g transform="translate(300 0) scale(-1 1)">${half}</g>`;
  b += part('airways', tubes([['M150 14 V108', 20, AIR], ['M150 104 C150 136 112 140 100 170', 10, AIR], ['M150 104 C150 136 188 140 200 170', 10, AIR]]) + halfTwigs + `<g transform="translate(300 0) scale(-1 1)">${halfTwigs}</g>`);
  // A magnifier on a cluster of alveoli at the end of one airway twig.
  b += `<path d="M206 282 L298 196 M206 282 L306 268" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  b += `<clipPath id="ah-mag"><circle cx="380" cy="214" r="88"/></clipPath><circle cx="380" cy="214" r="88" fill="#fff"/>`;
  let inner = gradient('O', 296, 466, ART) + tubes([['M380 100 V178', 14, AIR]]);
  inner += tubes([['M294 266 C326 302 434 302 466 262', 8, 'url(#ah-gO)']]);
  const centres = [[380, 214]].concat([0, 1, 2, 3, 4, 5].map(i => [380 + 40 * Math.cos(Math.PI / 6 + i * Math.PI / 3), 214 + 40 * Math.sin(Math.PI / 6 + i * Math.PI / 3)]));
  inner += part('alveoli', centres.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="21" fill="${FRESH}" stroke="${INK}" stroke-width="1.8"/>`).join(''));
  b += `<g clip-path="url(#ah-mag)">${inner}</g><circle cx="380" cy="214" r="88" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  b += text(168, 34, 'windpipe', 'xs b', 'start');
  b += `<path d="M44 106 L72 206" stroke="${INK}" stroke-width="1.5"/>` + text(16, 98, 'airways', 'xs b', 'start');
  b += text(150, 380, 'lungs', 'sm b red');
  b += text(380, 84, 'alveoli:', 'xs b') + text(380, 106, 'tiny air sacs', 'xs b');
  b += text(380, 332, 'blood vessel', 'xs b red');
  return b;
}
const BIG = () => geom(240, 182, 84);
function unitPicture() {
  const G = BIG(), u = drawUnit(G, { gasOn: false, top: 12 });
  let b = DEFS + u.s;
  // The wall: the narrow gap where the sac meets its capillary.
  const r1 = G.R + 3, a0 = Math.PI * .12, a1 = Math.PI * .88;
  b += part('wall', `<path d="M${f(G.cx + r1 * Math.cos(a0))} ${f(G.cy + r1 * Math.sin(a0))} A${r1} ${r1} 0 0 1 ${f(G.cx + r1 * Math.cos(a1))} ${f(G.cy + r1 * Math.sin(a1))}" fill="none" stroke="${BLUE}" stroke-width="3"/>`);
  b += text(262, 58, 'airway', 'xs b', 'start');
  b += text(240, 190, 'alveolus', 'sm b');
  b += text(240, 360, 'capillary', 'xs b purple');
  b += `<path d="M384 168 L${f(G.cx + r1 * Math.cos(.95))} ${f(G.cy + r1 * Math.sin(.95))}" stroke="${INK}" stroke-width="1.5"/>` + text(464, 132, 'thin wall:', 'xs b', 'end') + text(464, 154, 'air meets blood', 'xs b', 'end');
  return b;
}
// Moving: oxygen crosses the wall into the blood while carbon dioxide crosses out into the sac.
function swapPicture(t) {
  const G = BIG();
  let b = DEFS + drawUnit(G, { top: 12 }).s;
  const at = (a, r) => [G.cx + r * Math.cos(a), G.cy + r * Math.sin(a)];
  let moving = '';
  for (let i = 0; i < 3; i++) {
    const p = (t + i / 3) % 1, op = Math.sin(Math.PI * p);
    const aO = (118 + 12 * i) * Math.PI / 180, [ox, oy] = at(aO, G.R * .55 + (G.g - G.R * .55) * p);
    moving += `<circle cx="${f(ox)}" cy="${f(oy)}" r="7" fill="${BLUE}" stroke="#fff" stroke-width="1.5" ${fade(op)}/>`;
    const aC = (62 - 12 * i) * Math.PI / 180, [cx, cy] = at(aC, G.g - (G.g - G.R * .55) * p);
    moving += `<circle cx="${f(cx)}" cy="${f(cy)}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2" ${fade(op)}/>`;
  }
  const [o1x, o1y] = at(Math.PI * .72, G.R * .5), [o2x, o2y] = at(Math.PI * .72, G.g - 4);
  const [c1x, c1y] = at(Math.PI * .28, G.g + 2), [c2x, c2y] = at(Math.PI * .28, G.R * .52);
  b += part('exchange', arrow(`M${f(o1x)} ${f(o1y)} L${f(o2x)} ${f(o2y)}`, BLUE, 4) + arrow(`M${f(c1x)} ${f(c1y)} L${f(c2x)} ${f(c2y)}`, INK, 3.5) + moving);
  b += text(16, 356, 'oxygen into blood', 'xs b blue', 'start') + text(464, 356, 'carbon dioxide out to air', 'xs b', 'end');
  return b + GAS_KEY(392);
}
// Moving: one breath. The sac swells as fresh air comes in, then used air goes out.
function ventPicture(t) {
  const G = geom(240, 196, 84), inhale = t < .5, swell = (1 - Math.cos(2 * Math.PI * t)) / 2;
  const R = G.R * (1 + .045 * swell);
  let b = DEFS + drawUnit(G, { top: 0, sacR: R }).s;
  const p = inhale ? t / .5 : (t - .5) / .5;
  let flow = '';
  for (let i = 0; i < 3; i++) {
    const q = clamp(p * 1.3 - i * .15, 0, 1), y = inhale ? 6 + (G.cy - R - 2) * q : (G.cy - R - 2) * (1 - q) + 6, op = Math.sin(Math.PI * q);
    flow += inhale ? `<circle cx="240" cy="${f(y)}" r="6" fill="${BLUE}" ${fade(op)}/>` : `<circle cx="240" cy="${f(y)}" r="5.5" fill="#fff" stroke="${INK}" stroke-width="1.8" ${fade(op)}/>`;
  }
  b += part('airway', flow + `<g ${fade(inhale ? 1 : .4)}>${arrow('M200 22 V94', BLUE, 4)}${text(188, 52, 'fresh air in', 'xs b blue', 'end')}</g>` + `<g ${fade(inhale ? .4 : 1)}>${arrow('M280 94 V22', MUTED, 4)}${text(292, 52, 'used air out', 'xs b muted', 'start')}</g>`);
  return b + GAS_KEY(376);
}
// Moving: red cells flow round the capillary in single file, filling with oxygen as they pass the sac.
function perfPicture(t) {
  const G = geom(240, 170, 84);
  const u = drawUnit(G, { top: 0, plasma: true });
  let b = DEFS + u.s, cells = '';
  const out = bloodColor(u.leave);
  for (let i = 0; i < 10; i++) {
    const pt = along(G, (t + i / 10) % 1), c = lerpHex(VEN, out, pt.bend);
    cells += `<ellipse cx="${f(pt.x)}" cy="${f(pt.y)}" rx="9" ry="6.5" fill="${c}" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${f(pt.x)}" cy="${f(pt.y)}" rx="4" ry="2.2" fill="#fff" opacity=".35"/>`;
  }
  b += part('capillary', cells);
  b += arrow(`M${f(G.cx - G.g - G.ext)} ${f(G.low + 34)} H${f(G.cx - G.g - 8)}`, VEN, 4) + arrow(`M${f(G.cx + G.g + 8)} ${f(G.low + 34)} H${f(G.cx + G.g + G.ext)}`, ART, 4);
  b += text(16, 370, 'blood in: low in oxygen', 'xs b purple', 'start') + text(464, 370, 'blood out: topped up', 'xs b red', 'end');
  return b;
}
function matchPicture() {
  const G = geom(240, 132, 60);
  let b = DEFS + drawUnit(G, { top: 0 }).s;
  b += arrow('M206 8 V62', BLUE, 4) + text(194, 34, 'air delivered', 'xs b blue', 'end');
  b += text(240, 262, 'blood flowing past', 'xs b purple');
  b += text(464, 120, 'balanced:', 'sm b', 'end') + text(464, 144, 'a good match', 'sm b', 'end');
  b += ratioScale(312, 1);
  return b;
}
// Moving: the airway closes, the sac goes stale and the blood leaving it stops filling with oxygen.
function lowAirPicture(t) {
  const G = geom(240, 150, 62), a1 = ease(span(t, .05, .42)), a2 = ease(span(t, .58, .9));
  const air = 1 - .75 * a1 - .25 * a2;
  const u = drawUnit(G, { air, top: 0, ghost: { air: 1 } });
  let b = DEFS + u.s;
  const wA = span(t, .3, .42) - span(t, .52, .6), wB = span(t, .8, .92);
  if (wA > .01) b += `<g ${fade(wA)}>${text(464, 38, 'less air:', 'xs b blue', 'end')}${text(464, 60, 'blood leaves', 'xs b', 'end')}${text(464, 82, 'short of oxygen', 'xs b', 'end')}</g>`;
  if (wB > .01) b += `<g ${fade(wB)}>${text(464, 38, 'no air at all:', 'xs b blue', 'end')}${text(464, 60, 'blood leaves', 'xs b', 'end')}${text(464, 82, 'unchanged', 'xs b', 'end')}</g>`;
  b += text(f(G.cx - G.g - G.ext - 16), f(G.low + 6), 'blood in', 'xs b purple', 'end') + text(f(G.cx + G.g + G.ext + 16), f(G.low + 6), 'out', 'xs b ' + (u.leave > .9 ? 'red' : 'purple'), 'start');
  const r = air > .002 ? u.u.r : 0;
  b += ratioScale(306, r, { left: air <= .002 ? ['no air:', 'a shunt'] : ['too little air'], leftCls: air <= .002 ? 'xs b blue' : 'xs b', leftPart: 'shunt', right: ['too little blood'] });
  return b;
}
// Moving: the capillary empties, the sac's air goes unused and stays fresh.
function lowBloodPicture(t) {
  const G = geom(240, 150, 62), a1 = ease(span(t, .05, .42)), a2 = ease(span(t, .58, .9));
  const blood = 1 - .75 * a1 - .25 * a2;
  const u = drawUnit(G, { blood, top: 0, ghost: { blood: 1 } });
  let b = DEFS + u.s;
  const wA = span(t, .3, .42) - span(t, .52, .6), wB = span(t, .8, .92);
  if (wA > .01) b += `<g ${fade(wA)}>${text(464, 38, 'less blood:', 'xs b blue', 'end')}${text(464, 60, 'air only', 'xs b', 'end')}${text(464, 82, 'partly used', 'xs b', 'end')}</g>`;
  if (wB > .01) b += `<g ${fade(wB)}>${text(464, 38, 'no blood at all:', 'xs b blue', 'end')}${text(464, 60, 'air goes in and', 'xs b', 'end')}${text(464, 82, 'out for nothing', 'xs b', 'end')}</g>`;
  const r = blood > .002 ? u.u.r : Infinity;
  b += ratioScale(306, r, { left: ['too little air'], right: blood <= .002 ? ['no blood:', 'dead space'] : ['too little blood'], rightCls: blood <= .002 ? 'xs b blue' : 'xs b', rightPart: 'dead' });
  return b;
}

/* ---------- What changes it ---------- */
// Supplemental oxygen, side by side: a sac with too little air, and a shunt (a sac full of fluid).
function oxygenPicture(t) {
  const x = ease(span(t, .06, .8)), fio2 = 1 + x;
  const GA = geom(120, 138, 46), GB = geom(360, 138, 46);
  const room = { A: unit(.5 * .25, K.half, K.pio2), B: K.Cv };
  let b = DEFS;
  b += part('air', tubes([['M240 0 V40 H120 V96', 10, airColor(fio2)], ['M240 40 H360 V96', 10, airColor(fio2)]]));
  const A = drawUnit(GA, { air: .25, fio2, id: 'A', lumen: 8, top: 40, airPart: 'air' });
  const B = drawUnit(GB, { air: 1, fill: 1, fio2, id: 'B', lumen: 8, top: 40, airPart: 'air' });
  b += A.s + B.s;
  b += `<g ${fade(1 - span(t, .2, .4))}>${text(254, 20, 'room air in', 'xs b', 'start')}</g><g ${fade(span(t, .3, .5))}>${text(254, 20, 'extra oxygen in', 'xs b blue', 'start')}</g>`;
  b += text(120, 252, 'too little air', 'xs b') + text(360, 252, 'no air: a shunt', 'xs b');
  const bar = (x0, c, c0, id) => {
    const w = 170, X = s => f(x0 + w * clamp((s - .5) / .5, 0, 1));
    return `<rect x="${x0}" y="266" width="${w}" height="18" fill="#fff" stroke="${RULE}"/><rect data-bar="${id}" x="${x0}" y="266" width="${f(X(c) - x0)}" height="18" fill="${bloodColor(c)}"/><path class="ghost" d="M${X(c0)} 260 V290" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
  };
  b += bar(35, A.leave, room.A.c, 'a') + bar(275, B.leave, room.B, 'b');
  const a = span(t, .55, .85);
  if (a > .01) b += `<g data-named ${fade(a)}>${text(120, 316, '↑ blood fills', 'xs b blue')}${text(360, 316, '↔ no change', 'xs b muted')}</g>`;
  b += text(240, 348, 'bars: saturation of blood leaving', 'xs muted') + text(240, 370, 'each sac, half to full; dashed: room air', 'xs muted');
  return { svg: b, A, B, room };
}
// The airway muscle, its signal and the drug, for the two bronchodilators.
function airwayPicture(kind, t) {
  const tight = ease(span(t, .04, .36)), open = ease(span(t, .55, .92));
  const air = 1 - .8 * tight + (kind === 'beta2' ? .65 : .6) * open;
  const G = geom(140, 268, 58), lumen = 6 + 18 * air, band = 7 + 8 * clamp(tight - open * .9, 0, 1);
  const u = drawUnit(G, { air, top: 0, lumen, ghost: { lumen: 24 } });
  let b = DEFS + u.s;
  // Muscle bands round the airway: they bulge in as the muscle tightens.
  let m = '';
  for (const y of [52, 100, 148]) {
    m += `<rect x="${f(140 - lumen / 2 - band - 1.75)}" y="${y - 11}" width="${f(band)}" height="22" rx="4" fill="${MUSCLE}" stroke="${INK}" stroke-width="1.5"/>`;
    m += `<rect x="${f(140 + lumen / 2 + 1.75)}" y="${y - 11}" width="${f(band)}" height="22" rx="4" fill="${MUSCLE}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  b += part('muscle', m + text(104, 92, 'airway', 'xs b', 'end') + text(104, 114, 'muscle', 'xs b', 'end'));
  const rx = 140 + lumen / 2 + 1.75 + band;   // the receptor sits on the outer face of the middle band
  const drugIn = ease(span(t, .4, .55));
  let r = `<path d="M${f(rx)} 92 h8 v16 h-8" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  if (kind === 'beta2') {
    const dx = 330 - (330 - (rx + 9)) * drugIn;
    r += `<path d="M${f(dx)} 100 l9 -9 l9 9 l-9 9 z" fill="${BLUE}" stroke="${INK}" stroke-width="1.5" ${fade(span(t, .36, .42))}/>`;
    const coming = span(t, .36, .42) - span(t, .48, .54);
    if (coming > .01) r += `<g ${fade(coming)}>${text(352, 106, 'beta-2 agonist', 'xs b blue', 'start')}</g>`;
    r += `<g ${fade(span(t, .5, .6))}>${text(rx + 30, 92, 'beta-2 receptor', 'xs b', 'start')}${text(rx + 30, 114, 'switched on', 'xs b blue', 'start')}</g>`;
  } else {
    // A nerve ending drops acetylcholine onto the receptor until the antagonist sits in it.
    r += `<path d="M470 66 C380 66 330 84 ${f(rx + 46)} 96" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="${f(rx + 40)}" cy="98" r="9" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
    for (let i = 0; i < 3; i++) {
      const q = ((t * 4) + i / 3) % 1, stop = t > .5 ? .55 : 1;
      const x = rx + 30 - 20 * Math.min(q, stop), op = t > .5 ? Math.sin(Math.PI * q) * .8 : Math.sin(Math.PI * q);
      r += `<circle cx="${f(x)}" cy="${f(96 + 6 * (i - 1))}" r="3.2" fill="${ART}" ${fade(op)}/>`;
    }
    r += `<path d="M${f(rx + 1)} 94 h6 v12 h-6 z" fill="${ART}" stroke="${INK}" stroke-width="1" ${fade(drugIn)}/>`;
    r += text(470, 56, 'nerve', 'xs b', 'end');
    const ach = 1 - span(t, .4, .48);
    if (ach > .01) r += `<g ${fade(ach)}>${text(rx + 58, 120, 'acetylcholine', 'xs b red', 'start')}</g>`;
    r += `<g ${fade(span(t, .5, .6))}>${text(rx + 58, 120, 'antagonist blocks', 'xs b red', 'start')}${text(rx + 58, 142, 'the receptor', 'xs b red', 'start')}</g>`;
  }
  b += part('receptor', r);
  const w1 = span(t, .2, .3) - span(t, .44, .5), w2 = span(t, .7, .82);
  const on = kind === 'beta2' ? 'relax signal on:' : 'tighten signal blocked:';
  if (w1 > .01) b += `<g ${fade(w1)}>${text(464, 186, 'muscle tightens:', 'xs b red', 'end')}${text(464, 208, 'airway narrows', 'xs b', 'end')}${arrow(`M${f(140 - lumen / 2 - band - 20)} 126 H${f(140 - lumen / 2 - 4)}`, ART, 3)}${arrow(`M${f(140 + lumen / 2 + band + 20)} 126 H${f(140 + lumen / 2 + 4)}`, ART, 3)}</g>`;
  if (w2 > .01) b += `<g data-named ${fade(w2)}>${text(464, 186, on, 'xs b blue', 'end')}${text(464, 208, 'airway widens again', 'xs b', 'end')}${arrow(`M${f(140 - lumen / 2 - 3)} 126 H${f(140 - lumen / 2 - 24)}`, BLUE, 3)}${arrow(`M${f(140 + lumen / 2 + 3)} 126 H${f(140 + lumen / 2 + 24)}`, BLUE, 3)}</g>`;
  // How full the blood leaving the sac is, half full to full, with normal dashed.
  const X = s => f(268 + 192 * clamp((s - .5) / .5, 0, 1));
  b += text(268, 236, 'saturation of blood', 'xs b', 'start') + text(268, 256, 'leaving the sac', 'xs b', 'start');
  b += `<rect x="268" y="266" width="192" height="18" fill="#fff" stroke="${RULE}"/><rect data-bar="o2" x="268" y="266" width="${f(X(u.leave) - 268)}" height="18" fill="${bloodColor(u.leave)}"/>`;
  b += `<path class="ghost" d="M${X(unit(.5, K.half, K.pio2).c)} 260 V290" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
  b += text(268, 308, 'half', 'xs muted', 'start') + text(460, 308, 'full', 'xs muted', 'end');
  return { svg: b, air, leave: u.leave };
}
const CHANGE_WHERE = {
  pe: 'A black clot appears in the vessel bringing blood to the right sac, which thins to almost nothing; the left sac’s vessel swells with the extra blood, more than its air can serve. The right sac fills with unused fresh air: dead space, air but no blood. The saturation bar for blood to the body falls below its dashed normal tick.',
  pneumonia: 'Fluid rises until it fills the right sac, so no air reaches it, while blood keeps flowing past and leaves as purple as it came: a shunt, blood but no air. The mixed blood to the body turns darker and its saturation bar falls well below the dashed normal tick.'
};
function lungChange(kind) {
  return {
    duration: 2800,
    render(t) {
      const a = ease(t), o = model(mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, a));
      const named = span(t, .55, .9);
      let extra = '';
      if (kind === 'pe' && named > .01) extra = `<g data-named ${fade(named)}>${text(16, 58, 'more blood', 'xs b blue', 'start')}${text(16, 80, 'than air here', 'xs b blue', 'start')}${arrow('M34 90 V124', BLUE, 3)}</g>`;
      if (kind === 'pneumonia' && named > .01) extra = `<g data-named ${fade(named)}>${text(464, 58, 'blood still', 'xs b blue', 'end')}${text(464, 80, 'flows past', 'xs b blue', 'end')}${arrow('M446 90 V124', BLUE, 3)}</g>`;
      const label = `${kind === 'pe' ? 'Pulmonary embolism' : 'Pneumonia'}, drawn over a faint dashed outline of the normal lung. ${CHANGE_WHERE[kind]} ${sacWords(o)} Compared with normal: ${describe(o, BASE)}.`;
      const delta = o.sao2 < BASE.sao2 - .008 && named > .3 ? '↓ falls' : '';
      return { svg: lungSvg(label, o, { ghost: BASE, clot: kind === 'pe' ? a : 0, delta, extra }), readout: readout(o, BASE, 'Compared with normal') };
    }
  };
}
const still = (label, body, h) => () => svg(label, body(), h);
const scenes = {
  overview: still('Two lungs with branching airways leading down from the windpipe. A magnifying circle shows a cluster of tiny round air sacs, the alveoli, at the end of an airway, with a blood vessel curving past them that turns from purple to red.', overviewPicture, 392),
  unit: still('One air sac, the alveolus, at the end of its airway. A capillary loops round its lower half: blood enters on the left purple and leaves on the right red. A blue line marks the extremely thin wall where air meets blood.', unitPicture, 374),
  swap: { duration: 3200, loop: true, rest: .5, render: t => svg('The air sac holds blue oxygen dots and white carbon dioxide rings. Oxygen dots keep crossing the wall from the sac into the capillary along a blue arrow, while carbon dioxide rings cross from the blood up into the sac along a black arrow.', swapPicture(t), 402) },
  vent: { duration: 4400, loop: true, rest: .3, render: t => svg('The air sac with its airway, breathing. Breathing in, blue oxygen dots travel down the airway beside an arrow marked fresh air in and the sac swells a little. Breathing out, carbon dioxide rings travel up beside an arrow marked used air out.', ventPicture(t), 388) },
  perf: { duration: 4000, loop: true, render: t => svg('The air sac with red cells flowing in single file round its capillary loop. Each cell enters purple on the left, low in oxygen, and turns red as it passes under the sac, leaving on the right topped up.', perfPicture(t), 382) },
  match: still('One air sac with a blue arrow of air delivered down its airway and its capillary of blood flowing past, the two in balance: a good match. Below, a scale from too little air on the left to too little blood on the right has its marker in the middle, at matched.', matchPicture, 380),
  lowair: { duration: 4400, render: t => svg('One air sac whose airway narrows and then closes, drawn over a dashed outline of its normal airway. With less air the sac turns stale grey and the blood leaving it is only partly red: blood leaves short of oxygen. With no air at all the blood leaves as purple as it came. On the scale below, the marker slides from matched all the way left: no air, a shunt.', lowAirPicture(t), 384) },
  lowblood: { duration: 4400, render: t => svg('One air sac whose capillary thins and then empties, drawn over a dashed outline of its normal capillary. With less blood the air is only partly used; with no blood at all the vessel is empty and the sac stays full of fresh, unused air. On the scale below, the marker slides from matched all the way right: no blood, dead space.', lowBloodPicture(t), 384) },
  mix: { duration: 3000, render: t => { const o = model({ ...NORMAL, airway: 1 - .85 * ease(span(t, .05, .8)) }); return svg(`Two air sacs share one blood supply, drawn over a dashed outline of normal. The right sac's airway narrows: its air turns stale and its blood leaves purplish. The left sac is matched and its blood is already full. The two streams join into the blood going to the body, which is darker than the left sac's blood alone, and its saturation bar falls. ${sacWords(o)}`, lungPicture(o, { ghost: BASE, key: false, words: { A: ['matched,', 'already full'] }, delta: t > .6 ? '↓ mix falls' : '' }), LUNG_H); } },
  steer: { duration: 3000, render: t => {
    const a = ease(span(t, .05, .8)), from = model({ ...NORMAL, airway: .15 }), o = model({ ...NORMAL, airway: .15, flow: 1 - .6 * a });
    const named = span(t, .5, .85);
    const extra = named > .01 ? `<g data-named ${fade(named)}>${text(464, 58, 'vessel', 'xs b', 'end')}${text(464, 80, 'narrows', 'xs b', 'end')}${text(16, 58, 'blood steered', 'xs b blue', 'start')}${text(16, 80, 'to air', 'xs b blue', 'start')}${arrow('M34 90 V124', BLUE, 3)}</g>` : '';
    return svg(`The same two sacs, the right one short of air, drawn over a dashed outline of the picture before. Arrows squeeze the vessel bringing blood to the poorly aired right sac, so its capillary thins and more blood flows past the well-aired left sac. The saturation bar for blood to the body rises back part of the way. ${sacWords(o)}`, lungPicture(o, { ghost: from, key: false, squeeze: a, delta: named > .3 ? '↑ rises again' : '', extra }), LUNG_H);
  } },
  whole: () => svg('The whole picture. Air comes down the windpipe to two air sacs: ventilation. Blood comes from the body, loops under each sac and leaves mixed toward the body: perfusion. Both sacs are matched, and the saturation bar shows the blood to the body nearly full.', lungPicture(BASE, { extra: text(258, 24, 'ventilation', 'xs b blue', 'start') + text(16, 52, 'perfusion:', 'xs b purple', 'start') + text(16, 74, 'blood past', 'xs b purple', 'start') }), LUNG_H),
  oxygen: {
    duration: 3000,
    render(t) {
      const { svg: body, A, B, room } = oxygenPicture(t);
      const rows = [['Oxygen pressure in the sac with too little air', trend(A.u.po2, room.A.po2, 'higher', 'lower')], ['Saturation of blood leaving that sac', trend(A.leave, room.A.c, 'higher', 'lower')], ['Saturation of shunt blood', trend(B.leave, room.B, 'higher', 'lower')]];
      return { svg: svg('Supplemental oxygen, side by side, drawn over dashed ticks for room air. On the left, a sac with too little air: as extra oxygen comes in, the sac turns blue with oxygen, its blood turns red and its bar rises nearly to full. On the right, a shunt, a sac full of fluid: its blood stays purple and its bar does not move.', body, 376), readout: readoutOf(rows, 'Compared with room air') };
    }
  },
  beta2: { duration: 3600, render: t => svg('One airway wrapped in muscle bands, the air sac it feeds and the sac’s capillary, over a dashed outline of the normal airway. First the muscle tightens and the airway narrows: the sac goes stale and the saturation bar for the blood leaving it falls. Then a beta-2 agonist docks on the muscle’s beta-2 receptor, the relax signal switches on, and the airway opens again almost to normal; the sac freshens and the bar rises back.', airwayPicture('beta2', t).svg, 384) },
  antimusc: { duration: 3600, render: t => svg('One airway wrapped in muscle bands, the air sac it feeds and the sac’s capillary, over a dashed outline of the normal airway. A nerve ending drops acetylcholine onto the muscle’s receptor, the muscle tightens and the airway narrows: the sac goes stale and the saturation bar for the blood leaving it falls. Then a muscarinic antagonist sits in the receptor, the drops can no longer land, and the airway opens again almost to normal.', airwayPicture('antimusc', t).svg, 384) },
  pe: lungChange('pe'),
  pneumonia: lungChange('pneumonia'),
};

/* ---------- Explore: each sac on the ventilation–perfusion line ---------- */
function vqChart(o) {
  const x0 = 70, x1 = 450, y0 = 240, y1 = 40;
  const ymax = Math.max(o.pio2, K.pio2) * 1.06;
  const X = r => f(x0 + (x1 - x0) * (clamp(Math.log10(r), -2, 2) + 2) / 4);
  const Y = P => f(y0 - (y0 - y1) * P / ymax);
  const line = pio2 => { let d = ''; for (let i = 0; i <= 80; i++) { const r = Math.pow(10, -2 + 4 * i / 80); d += `${i ? ' L' : 'M'}${X(r)} ${Y(unit(.5 * r, K.half, pio2).po2)}`; } return d; };
  let b = DEFS;
  b += `<path d="M${x0} ${y1 - 14} V${y0} H${x1 + 8}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="M${x0} ${Y(K.pvo2)} H${x1}" stroke="${VEN}" stroke-width="1.5" stroke-dasharray="4 4"/>` + text(x1, f(Y(K.pvo2) + 22), 'blood arriving', 'xs purple', 'end');
  b += `<path d="M${x0} ${Y(o.pio2)} H${x1}" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="4 4"/>` + text(x0 + 8, f(Y(o.pio2) - 8), 'air breathed in', 'xs blue', 'start');
  if (o.p.fio2 > 1.01) b += `<path data-ghost="room air" d="${line(K.pio2)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-vq-line d="${line(o.pio2)}" fill="none" stroke="${BLUE}" stroke-width="4"/>`;
  b += `<path d="M${X(1)} ${y0} V${y0 + 8}" stroke="${INK}" stroke-width="2"/>` + text(X(1), y0 + 28, 'normal match', 'xs b');
  b += text(x0, y0 + 28, 'no air', 'xs b', 'start') + text(x1, y0 + 28, 'no blood', 'xs b', 'end');
  b += text(x1, y0 + 54, 'air ÷ blood, relative to normal → (log)', 'xs b', 'end') + text(12, 18, 'oxygen in the air sac ↑', 'xs b', 'start');
  const pt = (u, word, dy) => u ? `<circle data-sac-point cx="${X(u.r || .01)}" cy="${Y(u.po2)}" r="8" fill="#fff" stroke="${INK}" stroke-width="3"/>` + text(X(u.r || .01), f(Y(u.po2) + dy), word, 'xs b') : '';
  b += pt(o.A, 'left sac', -16) + pt(o.B, 'right sac', 30);
  return b;
}

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['fio2', 'airway', 'flow', 'fill'];
const STATE_PARAMS = { oxygen: CHANGES.oxygen, narrowed: { airway: NARROWED.airway }, widened: CHANGES.beta2, pe: CHANGES.pe, shunt: { fill: .7 } };
const level = (k, v) => k === 'fio2' ? (v < 1.05 ? 'room air' : v < 1.6 ? 'a little extra' : v < 2.4 ? 'extra' : 'much extra')
  : k === 'airway' ? (v < .03 ? 'blocked' : v < .5 ? 'very narrow' : v < .97 ? 'narrowed' : 'open')
  : k === 'flow' ? (v < .3 ? 'mostly blocked' : v < .97 ? 'reduced' : 'normal')
  : (v < .02 ? 'none' : v < .4 ? 'some' : v < .8 ? 'most' : 'nearly all');
function syncControls() {
  for (const k of SLIDERS) {
    $('#' + k).value = params[k]; $(`#${k}-label`).textContent = level(k, params[k]);
    $(`#clinical-${k}`).value = params[k]; $(`#clinical-${k}-label`).textContent = level(k, params[k]);
  }
  $('#hpv').checked = !!params.hpv;
}
const valueOf = id => data.values.find(v => v.id === id);
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const reference = id => { const v = valueOf(id); return Number.isFinite(v.typical) ? v.typical : (v.low + v.high) / 2; };
function measures(o) {
  return {
    o2pct: K.o2pct * o.p.fio2, pio2: o.pio2, pAo2: o.pAo2, pAco2: o.pAco2, ppvo2: o.pao2, sat: 100 * o.sao2,
    vq: o.alv * K.vq, vqRegion: o.vqB * K.vq
  };
}
const DECIMALS = { o2pct: 1, pio2: 1, vq: 2, vqRegion: 2 };
const fmt = (id, n) => n === Infinity ? '∞' : n.toFixed(DECIMALS[id] ?? 0);
const withUnit = (id, n) => { const u = valueOf(id).unit; return u === 'ratio' ? fmt(id, n) : u === '%' ? `${fmt(id, n)}%` : `${fmt(id, n)} ${u}`; };
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
function domain(v) {
  const [lo, hi] = v.scale;
  return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360);
}
function statusFor(v, shown) {
  if (hasRange(v)) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
function update() {
  if (!BASE) return;
  syncControls();
  const o = model(params);
  const label = `Illustrative model with these settings, drawn over a faint dashed outline of normal. ${sacWords(o)} Compared with normal: ${describe(o, BASE)}.`;
  const opt = { ghost: BASE, clot: o.p.flow < .95 && !params.hpv ? 1 - o.p.flow : 0, squeeze: params.hpv && o.squeeze < .97 ? 1 : 0 };
  $('#explore-visual').innerHTML = lungSvg(label, o, opt) + readout(o, BASE, 'Compared with normal');
  $('#clinical-visual').innerHTML = lungSvg(label, o, opt);
  const where = r => r === 0 ? 'at no air' : r === Infinity ? 'at no blood' : `at ${r.toFixed(2)} times a normal sac's ratio on the horizontal axis${data ? ` (an actual ventilation–perfusion ratio of ${(r * K.vq).toFixed(2)})` : ''}`;
  $('#vq-chart').innerHTML = svg(`Illustrative chart. The blue line shows the oxygen pressure an air sac settles at for every balance of air and blood, from the gas of arriving blood at no air to the air breathed in at no blood. Across, a log scale of each sac's air-to-blood ratio relative to a normal sac, so the centre tick (normal match) sits at 1, a normal sac${data ? `, whose actual ventilation–perfusion ratio is ${K.vq}` : ''}. Each position below gives the axis value and, in brackets, the actual ratio. The left sac sits ${where(o.A.r)}${o.B ? `; the right sac sits ${where(o.B.r)}` : '; the right sac is entirely filled with fluid'}.${o.p.fio2 > 1.01 ? ' A dashed line shows the same curve breathing room air.' : ''}`, vqChart(o), 306);
  const hpvNote = params.hpv ? ` Vessel narrowing has cut the right sac’s blood flow to ${Math.round(100 * o.squeeze)}% of its set value.` : '';
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: arterial oxygen ×${(o.pao2 / BASE.pao2).toFixed(2)} · arterial carbon dioxide ×${(o.paco2 / BASE.paco2).toFixed(2)} · shunt ×${(o.shunt / BASE.shunt).toFixed(2)}.${hpvNote}`;
    return;
  }
  const m = measures(o);
  $('#model-results').textContent = `Illustrative model: oxygen ${withUnit('o2pct', m.o2pct)} of the air breathed in (${withUnit('pio2', m.pio2)}) · alveolar oxygen ${withUnit('pAo2', m.pAo2)} and carbon dioxide ${withUnit('pAco2', m.pAco2)} (air-weighted average) · blood leaving the lungs: oxygen ${withUnit('ppvo2', m.ppvo2)}, saturation ${withUnit('sat', m.sat)}, carbon dioxide ${o.paco2.toFixed(0)} ${valueOf('pvco2').unit} (breathing held steady) · ventilation–perfusion ratio: whole lung ${withUnit('vq', m.vq)}, right sac ${withUnit('vqRegion', m.vqRegion)}.${hpvNote}`;
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = state?.shifts[v.id];
    const dir = row.querySelector('.direction');
    dir.textContent = state ? (d ? DIRECTION[d] : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = val === Infinity ? Infinity : Number(val.toFixed(DECIMALS[v.id] ?? 0));
    row.querySelector('.reading').textContent = withUnit(v.id, val);
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const k of SLIDERS) $('#' + k).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
$('#hpv').addEventListener('change', e => { params.hpv = e.target.checked; custom(); update(); });
for (const k of SLIDERS) $(`#clinical-${k}`).addEventListener('input', e => {
  params[k] = Number(e.target.value);
  const s = data?.states.find(x => x.id === $('#clinical-state').value);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
  update(); announce();
});
const resetAll = () => { params = { ...NORMAL }; $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Normal teaching baseline.'; $('#state-source').textContent = ''; update(); announce(); };
$('#reset').addEventListener('click', resetAll);
$('#clinical-reset').addEventListener('click', resetAll);
$('#clinical-state').addEventListener('change', e => {
  const id = e.target.value;
  params = { ...NORMAL, ...(STATE_PARAMS[id] || {}) };
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this change.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline.';
  $('#state-source').textContent = s ? `Directions: ${s.where} [${s.source}]` : '';
  update(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const m = measures(model(params));
    $('#cv-live').textContent = `Model: oxygen in blood leaving the lungs ${withUnit('ppvo2', m.ppvo2)}, saturation ${withUnit('sat', m.sat)}, whole-lung ventilation–perfusion ratio ${withUnit('vq', m.vq)}, right sac ratio ${withUnit('vqRegion', m.vqRegion)}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
const NEEDED = ['o2pct', 'pio2', 'pAo2', 'pAco2', 'pvo2', 'pvco2', 'ppvo2', 'sat', 'vq', 'vqRegion'];
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    data = loaded;
    for (const id of NEEDED) {
      const v = loaded.values?.find(x => x.id === id);
      if (!(v && Array.isArray(v.scale) && Number.isFinite(reference(id)) && reference(id) > 0)) throw new Error('Invalid reference data');
    }
    // Place the saturation curve so blood at the pulmonary-vein pressure sits mid-way through the saturation range.
    const s = reference('sat') / 100, pv = reference('ppvo2');
    K = {
      n: STEEPNESS, p50: pv * Math.pow((1 - s) / s, 1 / STEEPNESS),
      pio2: reference('pio2'), pAo2n: reference('pAo2'), pAco2n: reference('pAco2'), pvo2: reference('pvo2'), pvco2: reference('pvco2'),
      vq: reference('vq'), o2pct: reference('o2pct')
    };
    if (!(s > 0 && s < 1 && K.pio2 > K.pAo2n && K.pAo2n > pv && pv > K.pvo2 && K.pvco2 > K.pAco2n)) throw new Error('Reference values out of order');
    // Size the bypass so the healthy model's mixed blood lands on the pulmonary-vein value.
    K.s0 = (sat(K.pAo2n) - sat(pv)) / (sat(K.pAo2n) - sat(K.pvo2));
    if (!(K.s0 > 0 && K.s0 < .3)) throw new Error('Reference values do not fit the model');
    derive();
    const base = model(NORMAL);
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = `How the numbers are made: the air breathed in, the alveolar gas and the gas of blood arriving at the lungs all come from OpenStax section 22.4, and each healthy sac reproduces OpenStax’s alveolar gas exactly. The saturation curve is placed so that blood at OpenStax’s pulmonary-vein oxygen pressure sits at the middle of its saturation range, and a small bypass is sized so the healthy model’s mixed blood lands on that pulmonary-vein value (${withUnit('ppvo2', base.pao2)}, saturation ${withUnit('sat', 100 * base.sao2)}). Ratios are scaled so a healthy sac has StatPearls’ whole-lung ratio. Oxygen dissolved directly in the blood is left out. The sizes of the disease and drug changes are illustrative; only their directions are meant to teach.`;
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = hasRange(v), typical = Number.isFinite(v.typical);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = v.label;
      const right = document.createElement('div');
      const band = range ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>` : '';
      const typ = typical ? `<path class="typical" d="M${pos(v.typical)} 8 V38"/>` : '';
      const marker = v.modelKey ? '<line class="marker" x1="20" x2="20" y1="4" y2="42"/>' : '';
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 46" role="img"><path class="track" d="M20 23 H380"/>${band}${typ}${marker}</svg><div class="key"></div>`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${range ? 'the source range as a shaded band' : 'the source typical value as a tick'}${v.modelKey ? ', and a marker for the current illustrative model' : ''}`);
      const [lo, hi] = v.scale;
      const rangeText = range ? `${fmt(v.id, v.low)} to ${withUnit(v.id, v.high)}` : '';
      right.querySelector('.key').textContent = `${range ? `Source range ${rangeText} (shaded)` : `Source typical value ${withUnit(v.id, v.typical)} (tick; no range given)`} · bar runs ${fmt(v.id, lo)} to ${fmt(v.id, hi)}${v.modelKey ? ' · blue line: model' : ''}`;
      if (!v.modelKey) {
        left.querySelector('.reading').textContent = typical ? withUnit(v.id, v.typical) : rangeText;
        left.querySelector('.status').textContent = 'Reference only: a fixed input or reference, not a model output';
      }
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
      row.append(left, right, cite);
      $('#value-rows').append(row);
    }
    for (const [id, citation] of Object.entries(data.sources)) {
      const li = document.createElement('li'); li.textContent = `[${id}] ${citation}`;
      $('#sources').append(li);
    }
    clinicalControls.forEach(el => { el.disabled = false; });
  } catch (err) {
    data = null;
    K = null;
    $('#disclaimer').textContent = 'Reference values could not be loaded.';
    $('#load-error').hidden = false;
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on an illustrative model.';
  }
  if (!K) { K = { ...FALLBACK }; derive(); }
  BASE = model(NORMAL);
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
