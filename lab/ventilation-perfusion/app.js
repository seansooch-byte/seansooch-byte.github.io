'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
let K = null, BASE = null, NARROW = null;
const NORMAL = { fio2: 1, airway: 1, flow: 1, fill: 0 };
const NARROWED = { ...NORMAL, airway: .2 };   // narrowed airway to the right sac (an asthma attack)
const CHANGES = {
  oxygen: { fio2: 2 },       // oxygen share of the air breathed in doubled
  beta2: { airway: .85 },    // from narrowed, the relaxing signal opens the airway most of the way
  antimusc: { airway: .8 },  // from narrowed, blocking the tightening signal opens it most of the way
  pe: { flow: .1 },          // a clot cuts blood to the right sac to a tenth; that blood goes to the left sac
  pneumonia: { fill: .7 }    // seven tenths of the right sac filled with fluid
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

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', ART = '#b3261e', VEN = '#5b3f8c', RULE = '#babeb3', MUTED = '#53584d', PANEL = '#ecefe5';
const AIR = '#ffffff', STALE = '#d6d2c3', FRESH = '#dfe6ff', RICH = '#b3c3ff', FLUID = '#e2cb86';
let pictureId = 0;  // each picture gets its own ids: a gradient or marker referenced from a hidden step would not draw
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [ART]: 'r', [VEN]: 'v', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const lerpHex = (a, b, t) => { const A = hex(a), B = hex(b), u = clamp(t, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, '0')).join(''); };
const bloodColor = c => lerpHex(VEN, ART, (c - K.Cv) / (content(K.pAo2n) - K.Cv));
const sacColor = po2 => po2 <= K.pAo2n ? lerpHex(STALE, FRESH, (po2 - K.pvo2) / (K.pAo2n - K.pvo2)) : lerpHex(FRESH, RICH, (po2 - K.pAo2n) / (K.pio2 * 2 - K.pAo2n));
const wAir = a => 4 + 18 * Math.sqrt(clamp(a, 0, 1.5));
const wBlood = q => 3 + 12 * Math.sqrt(Math.max(0, q) / K.half);
const wShunt = s => 1.5 + 30 * s;

// Tubes drawn in two passes, all outlines then all fills, so joins are seamless.
function tubes(list) {
  let out = '', fill = '';
  for (const [d, w, color, attr = ''] of list) {
    out += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3.5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    fill += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round" ${attr}/>`;
  }
  return out + fill;
}
// A capillary's colour runs from arriving blood (where it enters, x1) to the colour it leaves with (x2).
const gradient = (id, x1, x2, end) => `<linearGradient id="ah-g${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="0" x2="${f(x2)}" y2="0"><stop offset="0" stop-color="${VEN}"/><stop offset=".45" stop-color="${end}"/><stop offset="1" stop-color="${end}"/></linearGradient>`;

// Oxygen (blue dots) and carbon dioxide (rings) scattered through a sac, above any fluid.
const DISK = Array.from({ length: 64 }, (_, i) => { const a = i * 2.39996323, r = Math.sqrt((i + .5) / 64) * .8; return [r * Math.cos(a), r * Math.sin(a)]; });
function gas(cx, cy, R, u, fill) {
  const nO = Math.round(clamp(2 + 9 * (u.po2 - K.pvo2) / (K.pAo2n - K.pvo2), 0, 26));
  const nC = Math.round(clamp(6 * u.pco2 / K.pAco2n, 0, 10));
  const top = cy + R - 2 * R * fill;
  let s = '', o = 0, c = 0;
  for (let k = 0; k < 64 && (o < nO || c < nC); k++) {
    const [dx, dy] = DISK[(k * 37) % 64], x = f(cx + dx * R), y = f(cy + dy * R);
    if (y > top - R * .12) continue;
    if (k % 2 === 0 && o < nO) { s += `<circle data-gas="o2" cx="${x}" cy="${y}" r="${f(R * .075)}" fill="${BLUE}"/>`; o++; }
    else if (k % 2 === 1 && c < nC) { s += `<circle data-gas="co2" cx="${x}" cy="${y}" r="${f(R * .065)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`; c++; }
  }
  return s;
}
function sac(cx, cy, R, u, fill, id, gasOn = true) {
  let s = `<circle data-sac="${id}" cx="${cx}" cy="${cy}" r="${R}" fill="${sacColor(u ? u.po2 : K.pvo2)}"/>`;
  if (fill > .005) {
    const top = f(cy + R - 2 * R * fill);
    s += `<clipPath id="ah-c${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><rect data-fluid clip-path="url(#ah-c${id})" x="${cx - R}" y="${top}" width="${2 * R}" height="${f(2 * R * fill)}" fill="${FLUID}"/>`;
    if (fill > .25) s += text(cx, f(Math.min(cy + R - 12, top + 24)), 'fluid', 'xs b on-fluid');
  }
  if (gasOn && u) s += gas(cx, cy, R, u, fill);
  return s + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${INK}" stroke-width="2"/>`;
}
function keyRow(items, y) {
  let x = 16, row = 0, body = '';
  for (const [icon, word] of items) {
    const w = 44 + word.length * 8.6;
    if (x > 16 && x + w > 470) { x = 16; row++; }
    body += `<g transform="translate(${f(x)} ${y + row * 28})">${icon}${text(44, 5, word, 'xs', 'start')}</g>`;
    x += w + 18;
  }
  return { body, rows: row + 1 };
}
const GAS_KEY = [[`<circle cx="18" cy="0" r="6" fill="${BLUE}"/>`, 'oxygen'], [`<circle cx="18" cy="0" r="5.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`, 'carbon dioxide']];

// A single air sac with its airway and capillary loop: blood enters on the left, loops under, leaves on the right.
function drawUnit(cx, cy, R, { v = 1, q = 1, id = 'u', gasOn = true, top = cy - R - 70 } = {}) {
  const u = unit(.5 * v, K.half * q, K.pio2);
  const k = R / 56, g = f(R + 12 * k + 6), ext = f(R * .8), low = f(cy + g + R * .35);
  const d = `M${f(cx - g - ext)} ${low} H${f(cx - g)} V${cy} A${g} ${g} 0 0 0 ${f(cx + g)} ${cy} V${low} H${f(cx + g + ext)}`;
  let s = '';
  if (q > 0) s += gradient(id, cx - g, cx + g, bloodColor(u.c)) + tubes([[d, wBlood(K.half * q) * k, `url(#ah-g${id})`, `data-blood="${id}"`]]);
  else s += `<path data-blood="empty" d="${d}" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="5 5"/>`;
  s += tubes([[`M${cx} ${f(top)} V${f(cy - R + 6)}`, wAir(v) * k * .9, AIR]]);
  if (v <= 0) s += `<path d="M${f(cx - 17 * k)} ${f(cy - R - 16 * k)} H${f(cx + 17 * k)}" stroke="${INK}" stroke-width="${f(6 * k)}"/>`;
  s += sac(cx, cy, R, u, 0, id, gasOn);
  return { s, u, low, g, ext };
}

/* ---------- The two-sac lung ---------- */
const D = {
  trachea: 'M240 4 V54',
  brA: 'M240 50 C240 88 130 76 130 120', brB: 'M240 50 C240 88 350 76 350 120',
  capA: 'M240 290 H200 V170 A70 70 0 0 1 60 170 V318', capB: 'M240 290 H280 V170 A70 70 0 0 0 420 170 V318',
  stemTop: 'M240 304 V284', stem: 'M240 396 V300', shunt: 'M240 362 H440 V322',
  h1: 'M60 318 H420', h2: 'M420 318 H440', h3: 'M440 318 H460 V378'
};
const o2Frac = o => clamp(o.pao2 / (BASE.pao2 * 2.5), 0, 1);
const co2Frac = o => clamp(o.paco2 / (K.pvco2 * 1.3), 0, 1);
function statusOf(u, fill) {
  if (fill > .3 || !u) return ['fluid:', 'shunt'];
  if (u.r === 0) return ['no air:', 'shunt'];
  if (u.r === Infinity) return ['no blood:', 'dead space'];
  if (u.r < .6) return ['too little', 'air'];
  if (u.r > 1.7) return ['too little', 'blood'];
  return ['matched'];
}
function attrs(o) {
  const r = (a, b) => (b ? a / b : a > 1e-9 ? 99 : 1).toFixed(4);
  return `data-pao2="${r(o.pao2, BASE.pao2)}" data-paco2="${r(o.paco2, BASE.paco2)}" data-alveolar-o2="${r(o.pAo2, BASE.pAo2)}" data-air-b="${r(o.vB, BASE.vB)}" data-blood-b="${r(o.qBair, BASE.qBair)}" data-shunt="${r(o.shunt, BASE.shunt)}"`;
}
function lungPicture(o, opt = {}) {
  const { ghost = null, legend = '', narrowed = null, cause = 'clot', labels = false, signal = null } = opt;
  const p = o.p;
  let s = DEFS;
  if (ghost) {
    const gl = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="${f(w + 8)}" stroke-dasharray="8 6" stroke-linejoin="round"/>`;
    s += `<g class="ghost" data-ghost="normal">${gl(D.brA, wAir(1)) + gl(D.brB, wAir(ghost.p.airway)) + gl(D.capA, wBlood(ghost.qA)) + gl(D.capB, wBlood(ghost.qB)) + gl(D.shunt, wShunt(ghost.shunt))}</g>`;
  }
  const cA = bloodColor(o.A.c), cB = bloodColor(o.cB), cMid = bloodColor((o.qA * o.A.c + o.qB * o.cB) / (o.qA + o.qB)), cArt = bloodColor(o.ca);
  let b = gradient('A', 200, 60, cA) + gradient('B', 280, 420, cB);
  b += tubes([
    [D.capA, wBlood(o.qA), 'url(#ah-gA)', 'data-blood="A"'], [D.capB, wBlood(o.qB), 'url(#ah-gB)', 'data-blood="B"'],
    [D.shunt, wShunt(o.shunt), VEN, 'data-blood="shunt"'], [D.stemTop, wBlood(1), VEN],
    [D.h1, wBlood(o.qA), cA], [D.h2, wBlood(o.qA + o.qB), cMid], [D.h3, wBlood(1), cArt, 'data-blood="arterial"']
  ]);
  b += `<polygon points="445,376 475,376 460,396" fill="${cArt}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  // The vein from the body passes over the arterial header: a gap in the panel colour makes it read as a bridge.
  b += `<path d="M240 336 V302" stroke="${PANEL}" stroke-width="${f(wBlood(1) + 12)}"/>` + tubes([[D.stem, wBlood(1), VEN]]);
  if (cause === 'clot' && p.flow < .95) {
    const k = 1 - p.flow;
    b += `<ellipse data-clot cx="280" cy="232" rx="${f(5 + 8 * k)}" ry="${f(8 + 12 * k)}" fill="${INK}"/>` + text(262, 238, 'clot', 'xs b', 'end');
  }
  if (cause === 'squeeze' && p.flow < .95) {
    b += arrow('M256 222 H269', INK, 3) + arrow('M304 222 H291', INK, 3);
    b += text(240, 134, 'vessel', 'xs b') + text(240, 152, 'narrows', 'xs b') + `<path d="M254 160 L272 204" stroke="${INK}" stroke-width="1.5"/>`;
  }
  b += tubes([[D.trachea, 26, AIR], [D.brA, wAir(1), AIR], [D.brB, wAir(p.airway), AIR, 'data-airway="B"']]);
  if (narrowed) b += `<path data-ghost="narrowed" d="${D.brB}" fill="none" stroke="${ART}" stroke-opacity=".75" stroke-width="${f(wAir(narrowed.airway))}" stroke-dasharray="2 4"/>`;
  if (p.airway < .03) b += `<path d="M330 106 H370" stroke="${INK}" stroke-width="6"/>`;
  if (signal) b += `<g data-signal>${text(472, 40, signal[0], 'xs b blue', 'end')}${text(472, 58, signal[1], 'xs b blue', 'end')}${arrow('M394 66 L340 90', BLUE, 2.5)}</g>`;
  b += sac(130, 170, 56, o.A, 0, 'A') + sac(350, 170, 56, o.B, p.fill, 'B');
  [[130, statusOf(o.A, 0)], [350, statusOf(o.B, p.fill)]].forEach(([x, lines]) => { lines.forEach((w, i) => { b += text(x, 270 + i * 18, w, 'xs b'); }); });
  b += text(222, 24, 'air in ↓', 'xs b', 'end');
  b += text(240, 418, 'from the body ↑', 'xs b ven') + text(474, 418, 'to the body', 'xs b red', 'end');
  if (labels) b += text(258, 30, 'ventilation', 'xs b blue', 'start') + text(254, 388, 'perfusion', 'xs b ven', 'start');
  // Two bars: oxygen and carbon dioxide in the mixed arterial blood.
  const bar = (y, word, frac, key, color) => text(16, y, word, 'xs b', 'start') + `<rect x="16" y="${y + 8}" width="448" height="14" fill="#fff" stroke="${RULE}"/><rect data-bar="${key}" x="16" y="${y + 8}" width="${f(448 * frac)}" height="14" fill="${color}"/>`;
  b += bar(446, 'oxygen in arterial blood', o2Frac(o), 'o2', cArt) + bar(486, 'carbon dioxide in arterial blood', co2Frac(o), 'co2', MUTED);
  s += `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${b}</g>`;
  if (ghost) {
    const tick = (y, frac) => `<path d="M${f(16 + 448 * frac)} ${y + 3} V${y + 27}" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
    s += `<g data-ghost-tick>${tick(446, o2Frac(ghost)) + tick(486, co2Frac(ghost))}</g>`;
    const items = [[`<path d="M0 0 H34" stroke="${INK}" stroke-opacity=".35" stroke-width="12" stroke-dasharray="8 6"/>`, 'normal']];
    if (narrowed) items.push([`<path d="M0 0 H34" stroke="${ART}" stroke-opacity=".75" stroke-width="7" stroke-dasharray="2 4"/>`, 'narrowed airway']);
    items.push([`<path d="M0 0 H34" stroke="${INK}" stroke-width="10"/><path d="M1 0 H33" stroke="#fff" stroke-width="6"/>`, legend]);
    const key = keyRow(items, 540);
    return { body: s + key.body, h: 556 + 28 * (key.rows - 1) };
  }
  return { body: s, h: 516 };
}
const lungSvg = (label, o, opt) => { const { body, h } = lungPicture(o, opt); return svg(label, body, h); };

/* ---------- Words: comparisons and text alternatives ---------- */
function trend(v, b, up, down) { const r = b ? v / b : v > 1e-9 ? 2 : 1; return r > 1.015 ? [up, 'up'] : r < .985 ? [down, 'down'] : ['about the same', 'same']; }
function compare(o, ref) {
  return [
    ['Oxygen in arterial blood', trend(o.pao2, ref.pao2, 'more', 'less')],
    ['Carbon dioxide in arterial blood', trend(o.paco2, ref.paco2, 'more', 'less')],
    ['Oxygen in the air sacs', trend(o.pAo2, ref.pAo2, 'more', 'less')],
    ['Air reaching the right sac', trend(o.vB, ref.vB, 'more', 'less')],
    ['Blood meeting air in the right sac', trend(o.qBair, ref.qBair, 'more', 'less')],
    ['Blood bypassing air (shunt)', trend(o.shunt, ref.shunt, 'more', 'less')]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔' };
const readout = (o, ref, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${compare(o, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (o, ref) => compare(o, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
const sacWords = o => `Left sac: ${statusOf(o.A, 0).join(' ')}. Right sac: ${statusOf(o.B, o.p.fill).join(' ')}.`;

/* ---------- Core step pictures ---------- */
function overviewPicture() {
  let b = DEFS;
  const lung = 'M128 104 C92 96 34 150 28 250 C24 316 52 344 100 336 C134 330 140 300 140 260 L140 132 C140 116 136 106 128 104Z';
  const twigs = 'M100 170 L78 214 M100 170 L112 226 M78 214 L62 252 M78 214 L92 262 M112 226 L104 280 M112 226 L126 276';
  const half = `<path d="${lung}" fill="#f3dcd6" stroke="${ART}" stroke-width="2.5"/><path d="${twigs}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  b += half + `<g transform="translate(300 0) scale(-1 1)">${half}</g>`;
  b += tubes([['M150 14 V108', 20, AIR], ['M150 104 C150 136 112 140 100 170', 10, AIR], ['M150 104 C150 136 188 140 200 170', 10, AIR]]);
  // Magnifier on a cluster of alveoli.
  b += `<path d="M196 280 L296 178 M196 280 L304 262" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  b += `<clipPath id="ah-mag"><circle cx="384" cy="214" r="88"/></clipPath><circle cx="384" cy="214" r="88" fill="#fff"/>`;
  let inner = gradient('O', 300, 468, ART) + tubes([['M384 100 V178', 14, AIR]]);
  inner += tubes([['M298 266 C330 300 438 300 470 262', 7, 'url(#ah-gO)']]);
  const centres = [[384, 214]].concat([0, 1, 2, 3, 4, 5].map(i => [384 + 40 * Math.cos(Math.PI / 6 + i * Math.PI / 3), 214 + 40 * Math.sin(Math.PI / 6 + i * Math.PI / 3)]));
  inner += centres.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="21" fill="${FRESH}" stroke="${INK}" stroke-width="1.8"/>`).join('');
  b += `<g clip-path="url(#ah-mag)">${inner}</g><circle cx="384" cy="214" r="88" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  b += text(166, 36, 'windpipe', 'xs b', 'start');
  b += `<path d="M40 104 L74 206" stroke="${INK}" stroke-width="1.5"/>` + text(14, 96, 'airways', 'xs b', 'start');
  b += text(150, 372, 'lungs', 'sm b red');
  b += text(384, 116, 'blood vessels', 'xs b red') + text(384, 330, 'alveoli: tiny air sacs', 'xs b');
  return b;
}
function bigUnit(opt = {}) { return drawUnit(240, 190, 88, { top: 18, ...opt }); }
function unitPicture() {
  const u = bigUnit({ gasOn: false });
  let b = DEFS + u.s;
  b += text(262, 64, 'airway', 'xs b', 'start');
  b += text(240, 196, 'alveolus', 'sm b');
  b += text(240, 336, 'capillary', 'xs b ven');
  b += `<path d="M304 128 L340 96" stroke="${INK}" stroke-width="1.5"/>` + text(470, 74, 'an extremely', 'xs b', 'end') + text(470, 92, 'thin wall', 'xs b', 'end');
  return b;
}
function swapPicture() {
  let b = DEFS + bigUnit().s;
  b += arrow('M204 238 L186 290', BLUE, 4.5) + arrow('M284 292 L268 242', INK, 3.5);
  b += text(16, 384, 'oxygen into blood', 'xs b blue', 'start') + text(464, 384, 'carbon dioxide out to air', 'xs b', 'end');
  return b + keyRow(GAS_KEY, 414).body;
}
function ventPicture() {
  let b = DEFS + bigUnit().s;
  b += arrow('M206 24 V92', BLUE, 4) + arrow('M274 92 V24', MUTED, 4);
  b += text(194, 48, 'fresh air in', 'xs b blue', 'end') + text(286, 48, 'used air out', 'xs b muted', 'start');
  return b + keyRow(GAS_KEY, 374).body;
}
function perfPicture() {
  let b = DEFS + bigUnit().s;
  b += arrow('M60 364 H124', VEN, 4) + arrow('M356 364 H420', ART, 4);
  b += text(16, 394, 'blood in: low in oxygen', 'xs b ven', 'start') + text(464, 394, 'blood out: topped up', 'xs b red', 'end');
  return b;
}
function matchPicture() {
  let b = DEFS;
  b += `<path d="M240 252 L208 306 H272 Z" fill="${INK}"/><path d="M64 252 H416" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  b += `<path d="M84 252 V236 H164 V252 M316 252 V236 H396 V252" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  [[106, 196], [134, 186], [120, 214], [148, 210], [92, 220]].forEach(([x, y]) => { b += `<circle cx="${x}" cy="${y}" r="16" fill="${FRESH}" stroke="${INK}" stroke-width="1.8"/>`; });
  [[100, 200], [128, 190], [142, 212], [116, 216]].forEach(([x, y]) => { b += `<circle cx="${x}" cy="${y}" r="4.5" fill="${BLUE}"/>`; });
  b += `<path d="M356 140 C376 170 388 186 388 202 A32 32 0 0 1 324 202 C324 186 336 170 356 140Z" fill="${ART}" stroke="${INK}" stroke-width="2"/>`;
  b += text(124, 138, 'air', 'sm b blue') + text(124, 160, 'ventilation', 'xs b');
  b += text(356, 100, 'blood', 'sm b red') + text(356, 122, 'perfusion', 'xs b');
  b += text(240, 346, 'balanced: a good match', 'sm b');
  return b;
}
function pairPicture(left, right) {
  let b = DEFS;
  [[120, left, 'L'], [360, right, 'R']].forEach(([cx, d, id]) => {
    const u = drawUnit(cx, 150, 46, { v: d.v, q: d.q, id, top: 36 });
    b += u.s + text(cx, 24, d.title, 'sm b');
    d.lines.forEach((w, i) => { b += text(cx, 266 + i * 18, w, `xs b ${d.cls || ''}`); });
  });
  return b + keyRow(GAS_KEY, 320).body;
}
const CORE = {
  overview: () => svg('Two lungs with branching airways leading down from the windpipe. A magnifying circle shows a cluster of tiny round air sacs, the alveoli, with a blood vessel curving past them, changing from purple to red.', overviewPicture(), 390),
  unit: () => svg('One air sac, the alveolus, at the end of its airway. A capillary loops around its lower half: blood enters on the left purple and leaves on the right red. A note points to the wall between air and blood: an extremely thin wall.', unitPicture(), 360),
  swap: () => svg('The air sac holds blue oxygen dots and white carbon dioxide rings. A blue arrow carries oxygen from the sac into the capillary; a black arrow carries carbon dioxide from the blood into the sac.', swapPicture(), 428),
  vent: () => svg('The air sac with its airway. A blue arrow beside the airway points down: fresh air in. A grey arrow points up: used air out.', ventPicture(), 388),
  perf: () => svg('The air sac with blood flowing through its capillary loop. A purple arrow on the left: blood in, low in oxygen. A red arrow on the right: blood out, topped up.', perfPicture(), 404),
  match: () => svg('A level seesaw. On the left pan, a cluster of air sacs: air, ventilation. On the right pan, a drop of blood: perfusion. The beam is level: balanced, a good match.', matchPicture(), 364),
  lowair: () => svg('Two air sacs. Left: a narrowed airway, stale grey air with few oxygen dots, and blood leaving only partly red: blood leaves short of oxygen. Right: the airway is blocked, the sac is stale and blood leaves as purple as it came: a shunt.', pairPicture(
    { v: .25, q: 1, title: 'less air', lines: ['blood leaves', 'short of oxygen'], cls: 'ven' },
    { v: 0, q: 1, title: 'no air', lines: ['shunt: blood', 'leaves unchanged'], cls: 'ven' }), 336),
  lowblood: () => svg('Two air sacs with open airways. Left: a thin trickle of blood and a sac full of oxygen dots: the air is only partly used. Right: no blood at all, an empty dashed vessel and a sac of unused fresh air: dead space.', pairPicture(
    { v: 1, q: .25, title: 'less blood', lines: ['air only', 'partly used'] },
    { v: 1, q: 0, title: 'no blood', lines: ['dead space:', 'air wasted'] }), 336),
  mix: () => { const o = model({ ...NORMAL, airway: .15 }); return lungSvg(`Two air sacs sharing one blood supply. The left sac is well aired and its blood leaves red. The right sac's airway is narrow, its air is stale and its blood leaves purplish. The two streams join into arterial blood, which is darker than the left sac's blood alone; the oxygen bar is shorter than normal. ${sacWords(o)}`, o); },
  steer: () => { const o = model({ ...NORMAL, airway: .15, flow: .4 }); return lungSvg(`The same two sacs. Around the poorly aired right sac, arrows show its vessel narrowing, so its capillary is thinner and more blood flows past the well-aired left sac. Arterial blood is redder than in the previous picture. ${sacWords(o)}`, o, { cause: 'squeeze' }); },
  whole: () => lungSvg(`The whole picture. Air comes down the windpipe to two air sacs, ventilation; blood comes up from the body, splits around the two sacs and a thin bypass, perfusion, and leaves mixed as arterial blood to the body. Both sacs are matched; bars show oxygen and carbon dioxide in arterial blood.`, BASE, { labels: true })
};

/* ---------- What changes it ---------- */
const LEGEND = { oxygen: 'supplemental oxygen', beta2: 'beta-2 agonist', antimusc: 'muscarinic antagonist', pe: 'pulmonary embolism', pneumonia: 'pneumonia' };
const OPENERS = ['beta2', 'antimusc'];   // drugs that start from narrowed airways and open them
// Shown beside the right airway while the drug acts: what it does to the muscle's signals.
const SIGNAL = { beta2: ['relaxing signal', 'switched on'], antimusc: ['tightening signal', 'blocked'] };
const CHANGE_WHERE = {
  oxygen: 'Both air sacs turn a deeper blue with many more oxygen dots, and the oxygen bar for arterial blood grows well past the dashed normal tick.',
  beta2: 'The right airway first narrows to the dotted red narrowed width, its sac turning stale. Then a note appears beside it, relaxing signal switched on, and the airway widens again almost to the dashed normal outline.',
  antimusc: 'The right airway first narrows to the dotted red narrowed width, its sac turning stale. Then a note appears beside it, tightening signal blocked, and the airway widens again almost to the dashed normal outline.',
  pe: 'A black clot sits in the right sac\'s vessel, which thins to a trickle; the left sac\'s vessel swells with the extra blood. The right sac fills with unused fresh air while the left one turns staler.',
  pneumonia: 'Fluid rises to fill most of the right sac, and the bypass vessel carrying unaired purple blood thickens. Arterial blood turns darker and the oxygen bar shrinks.'
};
const DURATION = { beta2: 2400, antimusc: 2400 };
function stateAt(kind, t) {
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  if (OPENERS.includes(kind)) return t < .45 ? mix(NORMAL, NARROWED, ease(t / .45)) : mix(NARROWED, { ...NORMAL, ...CHANGES[kind] }, ease((t - .45) / .55));
  return mix(NORMAL, { ...NORMAL, ...CHANGES[kind] }, ease(t));
}
function changePicture(el, t) {
  const kind = el.dataset.kind, o = model(stateAt(kind, t)), opener = OPENERS.includes(kind);
  const ref = opener ? NARROW : BASE, head = opener ? 'Compared with narrowed airways' : 'Compared with normal';
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over a faint dashed outline of the normal lung. ${CHANGE_WHERE[kind]} ${sacWords(o)} ${head}: ${describe(o, ref)}.`;
  const opt = { ghost: BASE, legend: LEGEND[kind], narrowed: opener ? NARROWED : null, signal: opener && t >= .45 ? SIGNAL[kind] : null };
  return { pic: lungSvg(label, o, opt), ro: readout(o, ref, head) };
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
  const length = DURATION[el.dataset.kind] || 1600;
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / length);
    drawAt(el, t);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
let started = false;
function startLesson() {
  steps.forEach(el => {
    const kind = el.dataset.kind;
    if (CORE[kind]) visualOf(el).innerHTML = CORE[kind]();
    else drawAt(el, 1);
    el.querySelector('.replay')?.addEventListener('click', () => animate(el));
  });
  started = true;
  if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(current);
}
function showStep(n, focus = false) {
  if (!started) return;
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
  if (tab.id === 'tab-lesson') { if (started && isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frame);
  update();
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

/* ---------- Explore: each sac on the ventilation–perfusion line ---------- */
function vqChart(o) {
  const x0 = 70, x1 = 450, y0 = 240, y1 = 34;
  const ymax = Math.max(o.pio2, K.pio2) * 1.06;
  const X = r => f(x0 + (x1 - x0) * (clamp(Math.log10(r), -2, 2) + 2) / 4);
  const Y = P => f(y0 - (y0 - y1) * P / ymax);
  const line = pio2 => { let d = ''; for (let i = 0; i <= 80; i++) { const r = Math.pow(10, -2 + 4 * i / 80); d += `${i ? ' L' : 'M'}${X(r)} ${Y(unit(.5 * r, K.half, pio2).po2)}`; } return d; };
  let b = DEFS;
  b += `<path d="M${x0} ${y1 - 14} V${y0} H${x1 + 8}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="M${x0} ${Y(K.pvo2)} H${x1}" stroke="${VEN}" stroke-width="1.5" stroke-dasharray="4 4"/>` + text(x0 + 6, f(Y(K.pvo2) - 6), 'blood arriving', 'xs ven', 'start');
  b += `<path d="M${x0} ${Y(o.pio2)} H${x1}" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="4 4"/>` + text(x0 + 6, f(Y(o.pio2) - 6), 'air breathed in', 'xs blue', 'start');
  if (o.p.fio2 > 1.01) b += `<path data-ghost="room air" d="${line(K.pio2)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="6 5" opacity=".6"/>`;
  b += `<path data-vq-line d="${line(o.pio2)}" fill="none" stroke="${BLUE}" stroke-width="4"/>`;
  b += `<path d="M${X(1)} ${y0} V${y0 + 8}" stroke="${INK}" stroke-width="2"/>` + text(X(1), y0 + 26, 'normal match', 'xs b');
  b += text(x0, y0 + 26, 'no air', 'xs b', 'start') + text(x1, y0 + 26, 'no blood', 'xs b', 'end');
  b += text(x1, y0 + 50, 'air ÷ blood, relative to a normal sac → (log)', 'xs b', 'end') + text(12, 18, 'oxygen in the air sac ↑', 'xs b', 'start');
  const pt = (u, word, dy) => u ? `<circle data-sac-point cx="${X(u.r || .01)}" cy="${Y(u.po2)}" r="8" fill="#fff" stroke="${INK}" stroke-width="3"/>` + text(X(u.r || .01), f(Y(u.po2) + dy), word, 'xs b') : '';
  b += pt(o.A, 'left sac', -14) + pt(o.B, 'right sac', 26);
  return b;
}

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL }, data = null;
const SLIDERS = ['fio2', 'airway', 'flow', 'fill'];
const STATE_PARAMS = { oxygen: CHANGES.oxygen, narrowed: { airway: NARROWED.airway }, widened: CHANGES.beta2, pe: CHANGES.pe, shunt: CHANGES.pneumonia };
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
  $('#explore-visual').innerHTML = lungSvg(label, o, { ghost: BASE, legend: 'these settings' }) + readout(o, BASE, 'Compared with normal');
  $('#clinical-visual').innerHTML = lungSvg(label, o, { ghost: BASE, legend: 'these settings' });
  const where = r => r === 0 ? 'at no air' : r === Infinity ? 'at no blood' : `at ${r.toFixed(2)} times a normal sac's ratio on the horizontal axis${data ? ` (an actual ventilation–perfusion ratio of ${(r * K.vq).toFixed(2)})` : ''}`;
  $('#vq-chart').innerHTML = svg(`Illustrative chart. The blue line shows the oxygen pressure an air sac settles at for every balance of air and blood, from the gas of arriving blood at no air to the air breathed in at no blood. Across, a log scale of each sac's air-to-blood ratio relative to a normal sac, so the centre tick (normal match) sits at 1, a normal sac${data ? `, whose actual ventilation–perfusion ratio is ${K.vq}` : ''}. Each position below gives the axis value and, in brackets, the actual ratio. The left sac sits ${where(o.A.r)}${o.B ? `; the right sac sits ${where(o.B.r)}` : '; the right sac is entirely filled with fluid'}.${o.p.fio2 > 1.01 ? ' A dashed line shows the same curve breathing room air.' : ''}`, vqChart(o), 300);
  const hpvNote = params.hpv ? ` Vessel narrowing has cut the right sac’s blood flow to ${Math.round(100 * o.squeeze)}% of its set value.` : '';
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: arterial oxygen ×${(o.pao2 / BASE.pao2).toFixed(2)} · arterial carbon dioxide ×${(o.paco2 / BASE.paco2).toFixed(2)} · shunt ×${(o.shunt / BASE.shunt).toFixed(2)}.${hpvNote}`;
    return;
  }
  const m = measures(o);
  $('#model-results').textContent = `Illustrative model: oxygen ${withUnit('o2pct', m.o2pct)} of the air breathed in (${withUnit('pio2', m.pio2)}) · alveolar oxygen ${withUnit('pAo2', m.pAo2)} and carbon dioxide ${withUnit('pAco2', m.pAco2)} (air-weighted average) · blood leaving the lungs: oxygen ${withUnit('ppvo2', m.ppvo2)}, saturation ${withUnit('sat', m.sat)}, carbon dioxide ${o.paco2.toFixed(0)} ${valueOf('pvco2').unit} · ventilation–perfusion ratio: whole lung ${withUnit('vq', m.vq)}, right sac ${withUnit('vqRegion', m.vqRegion)}.${hpvNote}`;
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
  NARROW = model(NARROWED);
  startLesson();
  update();
}
load();
