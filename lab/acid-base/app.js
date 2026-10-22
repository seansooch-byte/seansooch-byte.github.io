'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Teaching model ----------
   The bicarbonate buffer, Henderson–Hasselbalch: pH = 6.1 + log10(HCO3 / (0.03 × PCO2)).
   Inside the model everything is relative to the baseline: rH = bicarbonate ÷ baseline, rP = carbon dioxide ÷ baseline,
   so pH − baseline pH = log10(rH / rP). The lesson pictures use only these relative values. Absolute numbers exist only
   once clinical-values.json loads: the baseline carbon dioxide is the centre of the quoted male and female ranges, and the
   baseline bicarbonate gives the quoted bicarbonate to carbonic acid ratio (see load()). */
const HH = { pK: 6.1, s: 0.03 };   // constants of the equation itself, not reference values
// How far compensation goes toward fully restoring the ratio (illustrative). Always below 1, so it never overshoots.
const EFF = { lungsAcid: 0.75, lungsAlk: 0.5, kidneys: 0.7 };
const NORMAL = { m: 1, r: 1, c: 0 };   // m: first change in bicarbonate, r: first change in carbon dioxide, c: compensation
function model(p) {
  let rH = p.m, rP = p.r, who = null;
  const e = Math.log10(rH / rP);
  if (p.c > 0 && Math.abs(e) > 1e-9) {
    // Compensation acts on the side that is not causing the disorder, and only if that side is not already pushing the same way.
    if (e < 0) { if (rH < 1 && rP <= 1) who = 'lungs'; else if (rP > 1 && rH >= 1) who = 'kidneys'; }
    else { if (rH > 1 && rP >= 1) who = 'lungs'; else if (rP < 1 && rH <= 1) who = 'kidneys'; }
  }
  if (who === 'lungs') rP += p.c * (e < 0 ? EFF.lungsAcid : EFF.lungsAlk) * (rH - rP);
  if (who === 'kidneys') rH += p.c * EFF.kidneys * (rP - rH);
  return { p, rH, rP, dpH: Math.log10(rH / rP), who, primary: { rH: p.m, rP: p.r, dpH: e } };
}
const mix = (a, b, t) => { const out = { ...a }; for (const k in b) out[k] = a[k] + (b[k] - a[k]) * t; return out; };
const BASE = model(NORMAL);

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', ACID = '#b3261e', RULE = '#babeb3', MUTED = '#53584d', PANEL = '#ecefe5';
const ACIDL = '#f3d6d1', BASEL = '#d6defd', NEUTRAL = '#e4e2d8';
let pictureId = 0;  // each picture gets its own ids: a gradient referenced from a hidden step would not draw
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${h}" role="img" aria-label="${label}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [ACID]: 'r', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}<linearGradient id="ah-ph" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${ACID}"/><stop offset=".5" stop-color="${NEUTRAL}"/><stop offset="1" stop-color="${BLUE}"/></linearGradient></defs>`;

// Little symbols used across the pictures.
const bubble = (x, y, r = 9) => `<circle data-co2 cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${ACID}" stroke-width="2"/>`;
const hion = (x, y, r = 5) => `<circle data-h cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${ACID}"/>`;
const bicarb = (x, y, r = 12) => `<circle data-bicarb cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BLUE}"/>`;
const carbonic = (x, y, r = 12) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BASEL}" stroke="${BLUE}" stroke-width="2.5"/>` + hion(x + r * .8, y - r * .8, r * .42);
const lungsIcon = (x, y, s = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M0 -24 V-4 M0 -6 C-4 2 -8 2 -12 4 M0 -6 C4 2 8 2 12 4" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M-6 -6 C-22 -10 -30 10 -28 22 C-27 30 -18 32 -10 28 C-6 26 -5 20 -5 14 Z" fill="${ACIDL}" stroke="${INK}" stroke-width="2"/><path d="M6 -6 C22 -10 30 10 28 22 C27 30 18 32 10 28 C6 26 5 20 5 14 Z" fill="${ACIDL}" stroke="${INK}" stroke-width="2"/></g>`;
const kidneyIcon = (x, y, s = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-6 -26 C-26 -26 -30 -6 -26 8 C-22 22 -10 30 2 24 C10 20 6 10 4 4 C2 -2 10 -6 8 -14 C6 -22 2 -26 -6 -26 Z" fill="${BASEL}" stroke="${INK}" stroke-width="2"/><path d="M4 0 C14 2 18 12 18 28" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></g>`;
function keyRow(items, y) {
  let x = 16, row = 0, body = '';
  for (const [icon, word] of items) {
    const w = 44 + word.length * 8.4;
    if (x > 16 && x + w > 470) { x = 16; row++; }
    body += `<g transform="translate(${f(x)} ${y + row * 28})">${icon}${text(44, 5, word, 'xs', 'start')}</g>`;
    x += w + 18;
  }
  return { body, rows: row + 1 };
}

/* ---------- The seesaw ---------- */
// Tilt and needle follow the model's pH change (illustrative scales: tanh keeps big changes on the picture).
const tiltOf = dpH => 18 * Math.tanh(dpH / 0.12);
const needleX = dpH => 240 + 190 * Math.tanh(dpH / 0.15);
const blockH = rel => 58 * clamp(rel, 0.2, 2);
const PIV = { x: 240, y: 320 }, ARM = 170;
function ends(theta) {
  const a = theta * Math.PI / 180, c = Math.cos(a) * ARM, s = Math.sin(a) * ARM;
  return { L: { x: PIV.x - c, y: PIV.y - s }, R: { x: PIV.x + c, y: PIV.y + s } };
}
// The healthy band comes from the reference file's pH range, placed with the same pH-to-position mapping as the needle.
// Only if the file fails to load does the picture fall back to an illustrative band of fixed width.
const FALLBACK_BAND = [214, 266];
function bandX() {
  if (!K) return FALLBACK_BAND;
  const ph0 = absolute(BASE).ph;
  return [needleX(K.phLo - ph0), needleX(K.phHi - ph0)];
}
// The needle sits at the pH as printed (two decimals), so it agrees with the readouts and the Clinical values status.
function needleFor(o) {
  if (!K) return needleX(o.dpH);
  return needleX(Number(absolute(o).ph.toFixed(2)) - absolute(BASE).ph);
}
// Inside the band exactly when the Clinical values tab calls the printed pH "inside typical range".
function inBand(o) {
  if (!K) { const x = needleX(o.dpH); return x >= FALLBACK_BAND[0] && x <= FALLBACK_BAND[1]; }
  const ph = Number(absolute(o).ph.toFixed(2));
  return ph >= K.phLo && ph <= K.phHi;
}
function gauge(o, ghost) {
  let s = `<rect x="40" y="40" width="400" height="16" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.5"/>`;
  const [bx0, bx1] = bandX();
  s += `<rect data-band x="${f(bx0)}" y="34" width="${f(bx1 - bx0)}" height="28" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  s += text(40, 84, '← more acidic', 'xs b acid', 'start') + text(440, 84, 'more alkaline →', 'xs b blue', 'end') + text(240, 84, 'healthy band', 'xs b');
  s += text(20, 53, 'pH', 'xs b');
  if (ghost) { const g = needleFor(ghost); s += `<g data-ghost-needle><path d="M${f(g - 9)} 22 L${f(g + 9)} 22 L${f(g)} 38 Z" fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="3 2" opacity=".55"/></g>`; }
  const n = needleFor(o);
  s += `<g data-needle="${f(n)}"><path d="M${f(n - 10)} 20 L${f(n + 10)} 20 L${f(n)} 38 Z" fill="${INK}"/><path d="M${f(n)} 36 V60" stroke="${INK}" stroke-width="3"/></g>`;
  return s;
}
function blocks(o, theta, ghost = false) {
  const { L, R } = ends(theta);
  const hA = blockH(o.rP), hB = blockH(o.rH);
  if (ghost) {
    const st = `fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".5"`;
    return `<path d="M${f(L.x)} ${f(L.y)} L${f(R.x)} ${f(R.y)}" stroke="${INK}" stroke-width="7" stroke-dasharray="10 8" opacity=".3"/>` +
      `<rect x="${f(L.x - 42)}" y="${f(L.y - 8 - hA)}" width="84" height="${f(hA)}" ${st}/><rect x="${f(R.x - 42)}" y="${f(R.y - 8 - hB)}" width="84" height="${f(hB)}" ${st}/>`;
  }
  const dots = (x, y, h, color) => { let d = ''; for (let yy = y + h - 10; yy > y + 4; yy -= 14) for (let i = 0; i < 4; i++) d += `<circle cx="${f(x - 27 + i * 18)}" cy="${f(yy)}" r="3.2" fill="${color}" opacity=".55"/>`; return d; };
  let s = `<path d="M${f(L.x)} ${f(L.y)} L${f(R.x)} ${f(R.y)}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  s += `<path d="M${f(L.x - 48)} ${f(L.y - 4)} H${f(L.x + 48)} M${f(R.x - 48)} ${f(R.y - 4)} H${f(R.x + 48)}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  s += `<path d="M${f(L.x)} ${f(L.y - 4)} V${f(L.y)} M${f(R.x)} ${f(R.y - 4)} V${f(R.y)}" stroke="${INK}" stroke-width="4"/>`;
  s += `<rect data-side="acid" x="${f(L.x - 42)}" y="${f(L.y - 8 - hA)}" width="84" height="${f(hA)}" fill="${ACIDL}" stroke="${ACID}" stroke-width="2.5"/>` + dots(L.x, L.y - 8 - hA, hA, ACID);
  s += `<rect data-side="base" x="${f(R.x - 42)}" y="${f(R.y - 8 - hB)}" width="84" height="${f(hB)}" fill="${BASEL}" stroke="${BLUE}" stroke-width="2.5"/>` + dots(R.x, R.y - 8 - hB, hB, BLUE);
  return s;
}
// A note in the upper corners: an icon and up to three short lines.
function note(side, n) {
  if (!n) return '';
  const left = side === 'left', ix = left ? 52 : 428, tx = left ? 92 : 388, anchor = left ? 'start' : 'end';
  let s = n.icon === 'lungs' ? lungsIcon(ix, 132, 1) : n.icon === 'kidney' ? kidneyIcon(ix, 132, 1) : n.icon === 'add' ? `<circle cx="${ix}" cy="132" r="22" fill="#fff" stroke="${BLUE}" stroke-width="2.5"/><path d="M${ix - 11} 132 H${ix + 11} M${ix} 121 V143" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/>` : n.icon === 'acid' ? `<circle cx="${ix}" cy="132" r="22" fill="#fff" stroke="${ACID}" stroke-width="2.5"/>${hion(ix - 7, 128, 6)}${hion(ix + 7, 138, 6)}` : '';
  n.lines.forEach((w, i) => { s += text(tx, 118 + i * 18, w, `xs b ${i === 0 ? '' : n.cls || ''}`, anchor); });
  return `<g data-note="${side}">${s}</g>`;
}
function attrs(o) { return `data-bicarb="${o.rH.toFixed(4)}" data-co2="${o.rP.toFixed(4)}" data-ph="${o.dpH.toFixed(4)}"`; }
function seesaw(o, opt = {}) {
  const { ghost = null, ghostKey = 'normal', ghostWord = 'normal', legend = '', left = null, right = null, extra = '' } = opt;
  let s = DEFS + gauge(o, ghost);
  s += `<path d="M${PIV.x} ${PIV.y} L${PIV.x - 26} 368 H${PIV.x + 26} Z" fill="${INK}"/><path d="M150 368 H330" stroke="${INK}" stroke-width="2"/>`;
  if (ghost) s += `<g class="ghost" data-ghost="${ghostKey}" ${attrs(ghost)}>${blocks(ghost, tiltOf(ghost.dpH), true)}</g>`;
  s += `<g data-new-state="${legend || 'current'}" ${attrs(o)}>${blocks(o, tiltOf(o.dpH))}${note('left', left)}${note('right', right)}</g>`;
  s += text(96, 396, 'acid side', 'xs b acid') + text(96, 414, 'carbon dioxide', 'xs b');
  s += text(384, 396, 'base side', 'xs b blue') + text(384, 414, 'bicarbonate', 'xs b');
  s += extra;
  if (ghost) {
    const key = keyRow([[`<path d="M0 0 H34" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`, ghostWord], [`<rect x="0" y="-7" width="34" height="14" fill="${BASEL}" stroke="${INK}" stroke-width="2"/>`, legend]], 446);
    return { body: s + key.body, h: 462 + 28 * (key.rows - 1) };
  }
  return { body: s, h: 428 };
}
const seesawSvg = (label, o, opt) => { const { body, h } = seesaw(o, opt); return svg(label, body, h); };

/* ---------- Words: comparisons and text alternatives ---------- */
const amount = (v, b) => { const r = v / b; return r > 1.015 ? ['more', 'up'] : r < .985 ? ['less', 'down'] : ['about the same', 'same']; };
const phWord = d => d > .004 ? ['toward alkaline', 'alkaline'] : d < -.004 ? ['toward acidic', 'acidic'] : ['about normal', 'same'];
function compare(o, ref) {
  return [
    ['pH', phWord(o.dpH - ref.dpH)],
    ['Carbon dioxide (acid side)', amount(o.rP, ref.rP)],
    ['Bicarbonate (base side)', amount(o.rH, ref.rH)]
  ];
}
const ARROW = { up: '↑', down: '↓', same: '↔', acidic: '←', alkaline: '→' };
const readout = (o, ref, head) => `<ul class="readout" aria-label="${head}"><li class="head">${head}</li>${compare(o, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (o, ref) => compare(o, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
const tiltWords = o => { const t = tiltOf(o.dpH), inside = inBand(o); return Math.abs(t) < .6 ? `The beam sits level and the pH needle is ${inside ? 'inside' : 'just outside'} the healthy band.` : `The beam tips down on the ${t > 0 ? 'base' : 'acid'} side and the pH needle moves toward ${t > 0 ? 'alkaline' : 'acidic'}${inside ? ', still inside the healthy band' : ', out of the healthy band'}.`; };

/* ---------- Core step pictures ---------- */
function scalePicture() {
  // Positions along the scale are illustrative, not to scale.
  const X = u => 30 + 420 * u;
  let b = DEFS + `<rect x="30" y="74" width="420" height="22" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.5"/>`;
  const mark = (u, up, lines, cls) => {
    const x = X(u), y0 = up ? 74 : 96, y1 = up ? 56 : 114;
    let s = `<path d="M${f(x)} ${y0} V${y1}" stroke="${INK}" stroke-width="2"/>`;
    lines.forEach((w, i) => { s += text(x, up ? 50 - (lines.length - 1 - i) * 17 : 130 + i * 17, w, `xs b ${cls}`); });
    return s;
  };
  b += mark(.12, true, ['lemon juice'], 'acid') + mark(.5, true, ['water'], '') + mark(.82, true, ['soap'], 'blue');
  b += `<rect data-blood-band x="${f(X(.525))}" y="70" width="${f(420 * .03)}" height="30" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
  b += mark(.54, false, ['blood'], '');
  // Zoomed view of blood's band.
  b += `<path d="M${f(X(.525))} 100 L40 196 M${f(X(.555))} 100 L440 196" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  b += `<rect x="40" y="196" width="400" height="104" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
  b += text(240, 222, 'zoomed in on blood', 'xs b muted');
  b += `<rect x="60" y="240" width="360" height="18" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.2"/><rect x="200" y="232" width="80" height="34" fill="none" stroke="${INK}" stroke-width="3"/>`;
  b += `<path d="M230 226 L250 226 L240 242 Z" fill="${INK}"/>`;
  b += text(60, 288, '← too acidic', 'xs b acid on-white', 'start') + text(420, 288, 'too alkaline →', 'xs b blue on-white', 'end') + text(240, 288, 'the narrow band', 'xs b on-white');
  b += text(30, 160, '← more acidic', 'xs b acid', 'start') + text(450, 160, 'more alkaline →', 'xs b blue', 'end');
  return b;
}
function madePicture() {
  let b = DEFS;
  b += `<path d="M40 150 C34 90 110 60 160 76 C214 92 226 150 210 200 C194 252 120 270 74 240 C46 222 44 190 40 150 Z" fill="#f2e6d6" stroke="${INK}" stroke-width="2.5"/>`;
  b += `<ellipse cx="118" cy="160" rx="30" ry="24" fill="#e2d2bb" stroke="${INK}" stroke-width="1.5"/>`;
  b += text(126, 296, 'a working cell', 'sm b');
  b += `<rect x="330" y="30" width="120" height="290" rx="14" fill="${ACIDL}" stroke="${ACID}" stroke-width="2.5"/>` + text(390, 56, 'blood', 'sm b acid');
  b += arrow('M214 120 H322', INK, 3) + arrow('M214 210 H322', ACID, 3);
  b += text(268, 108, 'carbon dioxide', 'xs b') + text(268, 198, 'other acids', 'xs b acid');
  [[360, 100], [400, 128], [420, 90], [372, 150]].forEach(([x, y]) => { b += bubble(x, y); });
  [[356, 210], [384, 236], [416, 204], [402, 268], [364, 280], [428, 240]].forEach(([x, y]) => { b += hion(x, y, 6); });
  b += bubble(170, 140, 7) + hion(176, 196, 5);
  return b + keyRow([[bubble(18, 0, 7), 'carbon dioxide'], [hion(18, 0, 6), 'hydrogen ion']], 352).body;
}
function bufferPicture() {
  let b = DEFS;
  const beaker = (cx, fill, label, swing, word, buffered) => {
    let s = `<path d="M${cx - 70} 120 V250 Q${cx - 70} 268 ${cx - 52} 268 H${cx + 52} Q${cx + 70} 268 ${cx + 70} 250 V120" fill="none" stroke="${INK}" stroke-width="3"/>`;
    s += `<path d="M${cx - 68} 150 H${cx + 68} V250 Q${cx + 68} 266 ${cx + 52} 266 H${cx - 52} Q${cx - 68} 266 ${cx - 68} 250 Z" fill="${fill}"/>`;
    s += `<path d="M${cx - 8} 34 H${cx + 8} V74 L${cx} 86 L${cx - 8} 74 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>` + hion(cx, 104, 7) + text(cx + 18, 60, 'acid in', 'xs b acid', 'start');
    if (buffered) [[cx - 40, 190], [cx - 6, 220], [cx + 34, 186], [cx + 18, 240], [cx - 30, 244]].forEach(([x, y], i) => { s += i < 2 ? carbonic(x, y, 11) : bicarb(x, y, 11); });
    else [[cx - 30, 200], [cx + 10, 180], [cx + 30, 230], [cx - 10, 236]].forEach(([x, y]) => { s += hion(x, y, 6); });
    s += text(cx, 292, label, 'xs b');
    s += `<rect x="${cx - 80}" y="312" width="160" height="12" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.2"/>`;
    s += `<path d="M${cx - 6} 302 L${cx + 6} 302 L${cx} 312 Z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 2" opacity=".6"/>`;
    const n = cx - swing;
    s += `<path d="M${n - 8} 300 L${n + 8} 300 L${n} 314 Z" fill="${INK}"/>` + text(cx, 348, word, 'xs b');
    return s;
  };
  b += beaker(124, '#e3e9ef', 'plain water', 66, 'pH swings far', false);
  b += beaker(356, ACIDL, 'blood, with buffer', 6, 'pH barely moves', true);
  return b;
}
function bicarbPicture() {
  // A three-frame story, no reaction symbols: the ion drifts in, is caught, and is held.
  let b = DEFS;
  const frame = (cx, word1, word2) => `<rect x="${cx - 72}" y="14" width="144" height="100" fill="#fff" stroke="${RULE}" stroke-width="1.5"/>` + text(cx, 136, word1, 'xs b') + text(cx, 153, word2, 'xs b');
  b += frame(85, 'a hydrogen ion', 'drifts close') + frame(240, 'bicarbonate', 'catches it') + frame(395, 'carbonic acid', 'holds on tight');
  b += `<path d="M138 26 C122 34 116 44 106 50" fill="none" stroke="${ACID}" stroke-width="2" stroke-dasharray="3 4"/>` + bicarb(70, 74, 20) + hion(102, 52, 8);
  b += bicarb(240, 70, 20) + hion(258, 52, 8) + `<path d="M218 46 A32 32 0 0 1 270 40" fill="none" stroke="${BLUE}" stroke-width="2.5" stroke-linecap="round"/>`;
  b += carbonic(395, 66, 22);
  b += `<rect x="30" y="178" width="420" height="168" fill="${ACIDL}" stroke="${ACID}" stroke-width="2"/>` + text(46, 202, 'in blood', 'xs b acid', 'start');
  for (let i = 0; i < 21; i++) {
    const x = 84 + (i % 7) * 52, y = 232 + Math.floor(i / 7) * 40;
    b += i === 10 ? carbonic(x, y, 12) : bicarb(x, y, 12);
  }
  return b + text(240, 370, 'far more bicarbonate than carbonic acid', 'xs b');
}
function swapPicture() {
  // A picture of the process, no reaction symbols: carbonic acid splits in the blood and the gas leaves through the lungs.
  let b = DEFS;
  b += text(20, 40, 'the split also runs backward:', 'xs muted', 'start') + text(20, 58, 'carbon dioxide and water rejoin', 'xs muted', 'start');
  b += lungsIcon(420, 62, 1.3) + text(420, 118, 'lungs', 'xs b');
  b += `<rect x="20" y="196" width="440" height="124" rx="16" fill="${ACIDL}" stroke="${ACID}" stroke-width="2"/>` + text(36, 220, 'blood', 'xs b acid', 'start');
  b += carbonic(80, 272, 20);
  b += `<g data-enzyme><path d="M130 272 l14 -24 h102 l14 24 l-14 24 h-102 z" fill="#fff" stroke="${BLUE}" stroke-width="2.5"/>${text(195, 268, 'carbonic', 'xs b blue on-white')}${text(195, 286, 'anhydrase', 'xs b blue on-white')}</g>`;
  b += bubble(318, 262, 16) + `<path d="M378 248 C390 264 396 274 396 282 A18 18 0 0 1 360 282 C360 274 366 264 378 248 Z" fill="#cfe0f2" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="M318 244 C318 196 352 150 396 104" fill="none" stroke="${ACID}" stroke-width="2.5" stroke-dasharray="4 5"/>` + text(330, 150, 'breathed out', 'xs b acid', 'end');
  b += text(80, 344, 'carbonic acid', 'xs b') + text(195, 366, 'speeds the split', 'xs b blue') + text(318, 344, 'carbon dioxide', 'xs b') + text(420, 344, 'water', 'xs b');
  return b;
}
function speedsPicture() {
  let b = DEFS;
  const row = (y, icon, name, x1, word, color) => icon + text(84, y - 8, name, 'xs b', 'start') + `<rect x="84" y="${y}" width="${x1 - 84}" height="16" fill="${color}" stroke="${INK}" stroke-width="1.5"/>` + text(x1 + 8, y + 13, word, 'xs b', x1 > 360 ? 'end' : 'start');
  b += row(70, bicarb(46, 66, 14) + hion(56, 56, 6), 'buffers', 120, 'seconds', BASEL);
  b += row(150, lungsIcon(46, 146, .9), 'lungs', 220, 'minutes', ACIDL);
  b += row(230, kidneyIcon(46, 226, .9), 'kidneys', 456, '', BASEL) + text(456, 268, 'hours to days', 'xs b', 'end');
  b += arrow('M84 290 H460', INK, 2.5) + text(460, 314, 'time since acid arrives →', 'xs b', 'end');
  return b;
}
function mini(cx, cy, o, changed, word) {
  const t = tiltOf(o.dpH) * 1.1, a = t * Math.PI / 180, c = Math.cos(a) * 78, s = Math.sin(a) * 78;
  const L = { x: cx - c, y: cy - s }, R = { x: cx + c, y: cy + s };
  const hA = 30 * o.rP, hB = 30 * o.rH;
  let g = `<path d="M${cx} ${cy} L${cx - 13} ${cy + 26} H${cx + 13} Z" fill="${INK}"/>`;
  g += `<path d="M${f(L.x)} ${f(L.y)} L${f(R.x)} ${f(R.y)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  g += `<rect x="${f(L.x - 22)}" y="${f(L.y - 3 - hA)}" width="44" height="${f(hA)}" fill="${ACIDL}" stroke="${ACID}" stroke-width="${changed === 'acid' ? 4 : 2}"/>`;
  g += `<rect x="${f(R.x - 22)}" y="${f(R.y - 3 - hB)}" width="44" height="${f(hB)}" fill="${BASEL}" stroke="${BLUE}" stroke-width="${changed === 'base' ? 4 : 2}"/>`;
  g += text(cx, cy + 50, word, `xs b ${changed === 'acid' ? 'acid' : 'blue'}`);
  return g;
}
function fourPicture() {
  let b = DEFS;
  b += text(130, 26, 'acidosis', 'sm b acid') + text(360, 26, 'alkalosis', 'sm b blue');
  b += `<path d="M245 40 V400 M16 214 H470" stroke="${RULE}" stroke-width="1.5"/>`;
  b += text(16, 58, 'respiratory', 'xs b muted', 'start') + text(16, 238, 'metabolic', 'xs b muted', 'start');
  b += mini(130, 150, model({ m: 1, r: 1.5, c: 0 }), 'acid', 'more carbon dioxide');
  b += mini(360, 150, model({ m: 1, r: .62, c: 0 }), 'acid', 'less carbon dioxide');
  b += mini(130, 330, model({ m: .62, r: 1, c: 0 }), 'base', 'less bicarbonate');
  b += mini(360, 330, model({ m: 1.45, r: 1, c: 0 }), 'base', 'more bicarbonate');
  return b;
}
const UNCOMP = model({ m: .62, r: 1, c: 0 }), COMP = model({ m: .62, r: 1, c: 1 });
const CORE = {
  scale: () => svg('A pH scale running from more acidic on the left, red, to more alkaline on the right, blue. Lemon juice sits far to the acidic end, water in the middle, soap toward the alkaline end. Blood is a small box just on the alkaline side of water. A zoomed-in view shows that narrow band, with too acidic on one side and too alkaline on the other.', scalePicture(), 312),
  made: () => svg('A working cell on the left with two arrows into a blood vessel on the right: one carries white carbon dioxide bubbles, the other carries red dots, hydrogen ions from other acids.', madePicture(), 366),
  buffer: () => svg('Two beakers, each with a drop of acid falling in. Left: plain water, the acid dots float free and the pH pointer below swings far toward acidic. Right: blood with a buffer, blue particles catch the acid and the pH pointer barely moves.', bufferPicture(), 360),
  bicarb: () => svg('Three small frames. First, a red hydrogen ion drifts close to a blue bicarbonate. Then the bicarbonate catches it. Now the pair is carbonic acid, a pale circle holding on tight to the red dot. Below, a box of blood holds many blue bicarbonate circles and just one carbonic acid: far more bicarbonate than carbonic acid.', bicarbPicture(), 384),
  swap: () => svg('A blood vessel. Inside it, carbonic acid meets the enzyme carbonic anhydrase, which speeds up its split into a carbon dioxide bubble and a drop of water. A dotted trail carries the carbon dioxide up out of the blood to the lungs: breathed out. A note says the split also runs backward: carbon dioxide and water rejoin.', swapPicture(), 380),
  balance: () => seesawSvg(`A pH meter above a seesaw. On the left, the acid side, a red block of carbon dioxide; on the right, the base side, a blue block of bicarbonate. ${tiltWords(BASE)}`, BASE, {
    extra: text(240, 150, 'level beam:', 'sm b') + text(240, 174, 'pH in its band', 'sm b') + arrow('M240 186 V230', INK, 2.5)
  }),
  lungs: () => seesawSvg(`The seesaw with lungs above the acid side. Faster breathing makes the carbon dioxide block lighter, slower breathing makes it heavier. ${tiltWords(BASE)}`, BASE, { left: { icon: 'lungs', lines: ['lungs', 'faster: lighter', 'slower: heavier'], cls: 'acid' } }),
  kidneys: () => seesawSvg(`The seesaw with lungs above the acid side and kidneys above the base side. The kidneys keep bicarbonate or let it go. ${tiltWords(BASE)}`, BASE, { left: { icon: 'lungs', lines: ['lungs', 'set this side'], cls: 'muted' }, right: { icon: 'kidney', lines: ['kidneys', 'keep it or', 'let it go'], cls: 'blue' } }),
  speeds: () => svg('A timeline. Buffers respond within seconds, a short bar. Lungs take minutes, a longer bar. Kidneys take hours to days, a bar running across the whole timeline.', speedsPicture(), 324),
  four: () => svg('Four small seesaws in a grid. Columns: acidosis, alkalosis. Rows: respiratory, metabolic. Respiratory acidosis: carbon dioxide up, tipping acidic. Respiratory alkalosis: carbon dioxide down, tipping alkaline. Metabolic acidosis: bicarbonate down, tipping acidic. Metabolic alkalosis: bicarbonate up, tipping alkaline.', fourPicture(), 404),
  compensate: () => seesawSvg(`Metabolic acidosis: the bicarbonate block is smaller. A dashed outline shows the seesaw before compensating, tipped well toward acidic. After the lungs respond, the carbon dioxide block is smaller too and the beam is closer to level, still tipped a little toward acidic. ${tiltWords(COMP)}`, COMP, { ghost: UNCOMP, ghostKey: 'uncompensated', ghostWord: 'before compensating', legend: 'after the lungs respond', left: { icon: 'lungs', lines: ['lungs breathe', 'off extra', 'carbon dioxide'], cls: 'acid' } }),
  whole: () => seesawSvg(`The whole picture. Buffers act at once; lungs above the acid side set carbon dioxide; kidneys above the base side set bicarbonate. The three things a blood test reads are labelled: pH on the meter, carbon dioxide and bicarbonate on the two blocks. ${tiltWords(BASE)}`, BASE, {
    left: { icon: 'lungs', lines: ['lungs', 'minutes'], cls: 'acid' }, right: { icon: 'kidney', lines: ['kidneys', 'hours to days'], cls: 'blue' },
    extra: text(240, 200, 'buffers:', 'xs b') + text(240, 218, 'at once', 'xs b')
  })
};

/* ---------- What changes it ---------- */
// Each change runs in two phases: the first change, then the body's response (or a second change).
const CHANGES = {
  cai: [{ m: .72, r: 1, c: 0 }, { m: .72, r: 1, c: .6 }],
  diuretic: [{ m: 1.3, r: 1, c: 0 }, { m: 1.3, r: 1, c: .6 }],
  sodium: [{ m: 1.35, r: 1, c: 0 }, { m: 1.35, r: 1, c: .6 }],
  salicylate: [{ m: .7, r: 1, c: 0 }, { m: .7, r: .62, c: 0 }]
};
const LEGEND = { cai: 'carbonic anhydrase inhibitor', diuretic: 'diuretic causing potassium loss', sodium: 'sodium bicarbonate', salicylate: 'salicylate toxicity' };
const NOTES = {
  cai: [{ right: { icon: 'kidney', lines: ['kidneys', 'enzyme blocked:', 'bicarbonate lost'], cls: 'acid' } }, { left: { icon: 'lungs', lines: ['lungs', 'breathe faster', 'to compensate'], cls: 'muted' } }],
  diuretic: [{ right: { icon: 'kidney', lines: ['kidneys', 'potassium low:', 'bicarbonate kept'], cls: 'blue' } }, { left: { icon: 'lungs', lines: ['lungs', 'breathe a little', 'slower'], cls: 'muted' } }],
  sodium: [{ right: { icon: 'add', lines: ['bicarbonate', 'added', 'directly'], cls: 'blue' } }, { left: { icon: 'lungs', lines: ['lungs', 'breathe a little', 'slower'], cls: 'muted' } }],
  salicylate: [{ right: { icon: 'acid', lines: ['salicylic acid', 'uses up', 'bicarbonate'], cls: 'acid' } }, { left: { icon: 'lungs', lines: ['lungs', 'breathing', 'driven hard'], cls: 'blue' } }]
};
const CHANGE_WHERE = {
  cai: 'First the bicarbonate block shrinks as the kidneys lose bicarbonate, and the beam tips toward acidic. Then the lungs breathe faster and the carbon dioxide block shrinks a little, pulling the beam part of the way back.',
  diuretic: 'First, with potassium low, the kidneys push out more hydrogen ions and keep more bicarbonate: the bicarbonate block grows and the beam tips toward alkaline. Then breathing slows a little and the carbon dioxide block grows slightly, pulling the beam a little way back.',
  sodium: 'First the bicarbonate block grows as bicarbonate is added, and the beam tips toward alkaline. Then breathing slows a little and the carbon dioxide block grows slightly, pulling the beam a little way back.',
  salicylate: 'First the bicarbonate block shrinks as salicylic acid uses it up, and the beam tips toward acidic. Then breathing is driven hard, the carbon dioxide block shrinks a lot, and the beam swings past level toward alkaline.'
};
const DURATION = 2400;
function stateAt(kind, t) {
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const [a, b] = CHANGES[kind];
  return t < .5 ? mix(NORMAL, a, ease(t / .5)) : mix(a, b, ease((t - .5) / .5));
}
function changePicture(el, t) {
  const kind = el.dataset.kind, o = model(stateAt(kind, t));
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over a faint dashed outline of the normal balance. ${CHANGE_WHERE[kind]} ${tiltWords(o)} Compared with normal: ${describe(o, BASE)}.`;
  const [n1, n2] = NOTES[kind];
  const opt = { ghost: BASE, legend: LEGEND[kind], ...n1, ...(t >= .5 ? n2 : {}) };
  return { pic: seesawSvg(label, o, opt), ro: readout(o, BASE, 'Compared with normal') };
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

/* ---------- Absolute numbers (only once the data file has loaded) ---------- */
let K = null, data = null;
function absolute(o) {
  const pco2 = K.P0 * o.rP, hco3 = K.H0 * o.rH, ratio = hco3 / (HH.s * pco2);
  return { pco2, hco3, ratio, ph: HH.pK + Math.log10(ratio) };
}

/* ---------- Explore: the pH map (bicarbonate against carbon dioxide) ---------- */
function phMap(o) {
  const x0 = 70, x1 = 456, y0 = 270, y1 = 24;
  const pLo = K.P0 * .4, pHi = K.P0 * 2, hLo = K.H0 * .3, hHi = K.H0 * 1.8;
  const X = p => f(x0 + (x1 - x0) * (p - pLo) / (pHi - pLo)), Y = h => f(y0 - (y0 - y1) * (h - hLo) / (hHi - hLo));
  const iso = ph => p => HH.s * p * Math.pow(10, ph - HH.pK);
  let b = DEFS + `<clipPath id="ah-plot"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath>`;
  // Shaded wedge between the two pH limits of the source's normal range.
  const lo = iso(K.phLo), hi = iso(K.phHi);
  b += `<path data-ph-band d="M${X(pLo)} ${Y(lo(pLo))} L${X(pHi)} ${Y(lo(pHi))} L${X(pHi)} ${Y(hi(pHi))} L${X(pLo)} ${Y(hi(pLo))} Z" fill="#d1d8fd" clip-path="url(#ah-plot)"/>`;
  b += `<path d="M${x0} ${y1 - 10} V${y0} H${x1 + 6}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  for (let p = Math.ceil(pLo / 10) * 10; p <= pHi; p += 10) b += `<path d="M${X(p)} ${y0} V${y0 + 6}" stroke="${INK}" stroke-width="1.5"/>` + text(X(p), y0 + 22, String(p), 'xs');
  for (let h = Math.ceil(hLo / 10) * 10; h <= hHi; h += 10) b += `<path d="M${x0 - 6} ${Y(h)} H${x0}" stroke="${INK}" stroke-width="1.5"/>` + text(x0 - 10, Y(h) + 5, String(h), 'xs', 'end');
  b += text(x1, y0 + 46, 'carbon dioxide, PCO2 (mm Hg) →', 'xs b', 'end') + text(12, 14, 'bicarbonate (mM) ↑', 'xs b', 'start');
  b += text(X(pHi * .86), Y(hi(pHi * .86)) - 10, `pH ${K.phLo}–${K.phHi}`, 'xs b blue', 'end');
  b += text(x0 + 12, y1 + 18, '← more alkaline', 'xs b blue', 'start') + text(x1 - 6, y0 - 12, 'more acidic →', 'xs b acid', 'end');
  const n = absolute(BASE), pr = absolute(model({ ...o.p, c: 0 })), now = absolute(o);
  b += `<circle cx="${X(n.pco2)}" cy="${Y(n.hco3)}" r="5" fill="${INK}"/>` + text(X(n.pco2) + 9, Y(n.hco3) + 18, 'normal', 'xs b', 'start');
  if (o.who) b += `<circle data-primary cx="${X(pr.pco2)}" cy="${Y(pr.hco3)}" r="8" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/>` + arrow(`M${X(pr.pco2)} ${Y(pr.hco3)} L${X(now.pco2)} ${Y(now.hco3)}`, MUTED, 2);
  b += `<circle data-point cx="${X(now.pco2)}" cy="${Y(now.hco3)}" r="8" fill="${BLUE}" stroke="#fff" stroke-width="2"/>`;
  return b;
}

/* ---------- Shared model state (Clinical values + Explore freely) ---------- */
let params = { ...NORMAL };
const SLIDERS = { bicarb: 'm', co2: 'r', comp: 'c' };
const level = (k, v) => k === 'comp' ? (v < .05 ? 'none yet' : v < .5 ? 'starting' : v < .95 ? 'well under way' : 'as far as it goes')
  : (v < .62 ? 'much lower' : v < .97 ? 'lower' : v <= 1.03 ? 'normal' : v < 1.38 ? 'higher' : 'much higher');
function syncControls() {
  for (const [id, k] of Object.entries(SLIDERS)) {
    for (const pre of ['', 'clinical-']) { $('#' + pre + id).value = params[k]; $(`#${pre}${id}-label`).textContent = level(id, params[k]); }
  }
}
const valueOf = id => data.values.find(v => v.id === id);
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const DECIMALS = { ph: 2, pco2m: 0, pco2f: 0, hco3: 1, ratio: 1 };
const fmt = (id, n) => n.toFixed(DECIMALS[id] ?? 1);
const withUnit = (id, n) => { const u = valueOf(id).unit; return u === 'pH' ? fmt(id, n) : u === 'to 1' ? `${fmt(id, n)} to 1` : `${fmt(id, n)} ${u}`; };
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ Little or no change', variable: '↕ Variable' };
const domain = v => { const [lo, hi] = v.scale; return n => f(20 + clamp((n - lo) / (hi - lo), 0, 1) * 360); };
function statusFor(v, shown) {
  if (hasRange(v)) return shown < v.low ? 'below typical range' : shown > v.high ? 'above typical range' : 'inside typical range';
  const r = shown / v.typical;
  return Math.abs(r - 1) <= .1 ? 'close to the typical value' : r > 1 ? 'above the typical value' : 'below the typical value';
}
function changeWords(o) {
  const p = o.p, parts = [];
  if (p.m < .985) parts.push('bicarbonate lowered (a metabolic change toward acidosis)');
  if (p.m > 1.015) parts.push('bicarbonate raised (a metabolic change toward alkalosis)');
  if (p.r > 1.015) parts.push('carbon dioxide raised (a respiratory change toward acidosis)');
  if (p.r < .985) parts.push('carbon dioxide lowered (a respiratory change toward alkalosis)');
  if (!parts.length) return 'No first change: the normal balance.';
  let s = `First change: ${parts.join(' and ')}.`;
  if (o.who === 'lungs') s += ` The lungs compensate: carbon dioxide ${o.rP < o.primary.rP ? 'falls' : 'rises'} too.`;
  else if (o.who === 'kidneys') s += ` The kidneys compensate: bicarbonate ${o.rH < o.primary.rH ? 'falls' : 'rises'} too.`;
  else if (p.c > 0) s += parts.length > 1 ? ' No further compensation in this model: the two changes already decide the balance.' : '';
  else s += ' No compensation yet.';
  return s;
}
function update() {
  syncControls();
  const o = model(params);
  const label = `Illustrative model with these settings, drawn over a faint dashed outline of normal. ${tiltWords(o)} Compared with normal: ${describe(o, BASE)}.`;
  const side = (who, organ) => o.who === who ? ['compensating', organ === 'lungs' ? (o.rP < o.primary.rP ? 'breathing faster' : 'breathing slower') : (o.rH < o.primary.rH ? 'letting it go' : 'keeping more')] : ['set this side'];
  const opt = { ghost: BASE, legend: 'these settings', left: { icon: 'lungs', lines: ['lungs', ...side('lungs', 'lungs')], cls: o.who === 'lungs' ? 'blue' : 'muted' }, right: { icon: 'kidney', lines: ['kidneys', ...side('kidneys', 'kidneys')], cls: o.who === 'kidneys' ? 'blue' : 'muted' } };
  $('#explore-visual').innerHTML = seesawSvg(label, o, opt) + readout(o, BASE, 'Compared with normal');
  $('#clinical-visual').innerHTML = seesawSvg(label, o, opt);
  if (!data) {
    $('#model-results').textContent = `Illustrative model, relative to normal: bicarbonate ×${o.rH.toFixed(2)} · carbon dioxide ×${o.rP.toFixed(2)} · pH change ${o.dpH >= 0 ? '+' : '−'}${Math.abs(o.dpH).toFixed(2)}. ${changeWords(o)}`;
    $('#ph-map').innerHTML = '<p class="model-note">The pH map needs the reference file, which did not load.</p>';
    return;
  }
  const a = absolute(o);
  $('#model-results').textContent = `Illustrative model output: pH ${a.ph.toFixed(2)} · carbon dioxide (PCO2) ${a.pco2.toFixed(0)} mm Hg · bicarbonate ${a.hco3.toFixed(1)} mM · bicarbonate to carbonic acid ratio ${a.ratio.toFixed(1)} to 1. ${changeWords(o)}`;
  const pr = absolute(model({ ...o.p, c: 0 }));
  $('#ph-map').innerHTML = svg(`Illustrative pH map: bicarbonate up the side, carbon dioxide along the bottom. A shaded wedge between two straight lines through the origin marks the pH range from the reference file, ${K.phLo} to ${K.phHi}. The normal point sits inside it. The model now sits at carbon dioxide ${a.pco2.toFixed(0)} mm Hg and bicarbonate ${a.hco3.toFixed(1)} mM, pH ${a.ph.toFixed(2)}${o.who ? `; before compensation it sat at ${pr.pco2.toFixed(0)} mm Hg and ${pr.hco3.toFixed(1)} mM, pH ${pr.ph.toFixed(2)}, and an arrow shows compensation moving it toward the wedge` : ''}.`, phMap(o), 330);
  const state = data.states.find(s => s.id === $('#clinical-state').value);
  const m = { ph: a.ph, pco2: a.pco2, hco3: a.hco3, ratio: a.ratio };
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = state?.shifts[v.id], dir = row.querySelector('.direction');
    const extra = d && state.shiftNotes?.[v.id] ? `: ${state.shiftNotes[v.id]}` : '';
    dir.textContent = state ? (d ? DIRECTION[d] + extra : 'No direction given by the cited source for this row') : '';
    dir.classList.toggle('quiet', !d);
    if (!v.modelKey) continue;
    const val = m[v.modelKey], shown = Number(val.toFixed(DECIMALS[v.id] ?? 1));
    row.querySelector('.reading').textContent = withUnit(v.id, val);
    const x = domain(v)(val), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Model: ${statusFor(v, shown)}`;
  }
}
const custom = () => { $('#clinical-state').value = 'normal'; $('#state-summary').textContent = 'Custom model settings.'; $('#state-source').textContent = ''; };
for (const [id, k] of Object.entries(SLIDERS)) {
  $('#' + id).addEventListener('input', e => { params[k] = Number(e.target.value); custom(); update(); });
  $('#clinical-' + id).addEventListener('input', e => {
    params[k] = Number(e.target.value);
    const s = data?.states.find(x => x.id === $('#clinical-state').value);
    $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings.';
    update(); announce();
  });
}
// How each cited state is applied to the model (sizes illustrative; directions follow the data file).
const STATE_PARAMS = {
  'metabolic-acidosis': { m: .62, r: 1, c: .6 }, 'respiratory-acidosis': { m: 1, r: 1.5, c: .5 },
  'metabolic-alkalosis': { m: 1.4, r: 1, c: .5 }, 'respiratory-alkalosis': { m: 1, r: .62, c: .5 },
  'ca-inhibitor': CHANGES.cai[1], 'diuretic-k': CHANGES.diuretic[1], bicarbonate: CHANGES.sodium[1], salicylate: CHANGES.salicylate[1]
};
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
    const a = absolute(model(params));
    $('#cv-live').textContent = `Model: pH ${withUnit('ph', a.ph)}, carbon dioxide ${withUnit('pco2m', a.pco2)}, bicarbonate ${withUnit('hco3', a.hco3)}, ratio ${withUnit('ratio', a.ratio)}.`;
  }, 400);
}

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    const get = id => loaded.values?.find(x => x.id === id);
    const ph = get('ph'), pm = get('pco2m'), pf = get('pco2f'), hc = get('hco3'), ra = get('ratio');
    if (![ph, pm, pf, hc, ra].every(v => v && Array.isArray(v.scale)) || ![ph.low, ph.high, pm.low, pm.high, pf.low, pf.high, ra.typical].every(Number.isFinite)) throw new Error('Invalid reference data');
    data = loaded;
    // Baseline carbon dioxide: the centre of the quoted male and female ranges together. Baseline bicarbonate: the quoted ratio.
    const P0 = (pm.low + pm.high + pf.low + pf.high) / 4;
    K = { P0, H0: ra.typical * HH.s * P0, phLo: ph.low, phHi: ph.high };
    const base = absolute(BASE);
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = `How the numbers are made: the model's baseline carbon dioxide (${withUnit('pco2m', base.pco2)}) is the centre of OpenStax's male and female ranges taken together, and its baseline bicarbonate (${withUnit('hco3', base.hco3)}) gives OpenStax's 20 to 1 bicarbonate to carbonic acid ratio, with carbonic acid stood in for by 0.03 × PCO2. The Henderson–Hasselbalch equation then gives a baseline pH of ${withUnit('ph', base.ph)}, inside OpenStax's range. Both baseline values sit inside their ranges. The sizes of the disease and drug changes are illustrative; only their directions are meant to teach.`;
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = domain(v), range = hasRange(v), typical = Number.isFinite(v.typical) && !range;
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
      const rangeText = range ? `${String(v.low)} to ${v.unit === 'pH' ? v.high : `${v.high} ${v.unit}`}` : '';
      const typText = Number.isFinite(v.typical) ? (v.unit === 'to 1' ? `${v.typical} to 1` : v.unit === 'pH' ? v.typical.toFixed(2) : `${v.typical} ${v.unit}`) : '';
      right.querySelector('.key').textContent = `${range ? `Source range ${rangeText} (shaded)${Number.isFinite(v.typical) ? `; normal ${typText}` : ''}` : `Source typical value ${typText} (tick; no range given)`} · bar runs ${lo} to ${hi}${v.modelKey ? ' · blue line: model' : ''}`;
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
  startLesson();
  update();
}
load();
