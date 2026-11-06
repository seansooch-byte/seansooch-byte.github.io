// Lesson 11: Acid–base balance. The kit (/lab/kit/kit.js) runs the page; this file is the model, the pictures and
// the Clinical values and Explore freely tabs.
import { lesson } from '/lab/kit/kit.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number((+n).toFixed(1));
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

/* ---------- Drawing ----------
   Every picture is 480 wide and at most 420 tall, with the kit's type (20 / .sm 18 / .xs 17). The seesaw carries six
   tokens a side at the normal mix: carbon dioxide (rings) on the acid side, bicarbonate (blue discs) on the base side.
   A token lost since normal stays as a dashed ring; a token added carries a ring of its own. Badges number the changes:
   1, the first change; 2, the other side answering (or, for salicylate, a second problem). */
const INK = '#171916', BLUE = '#254dff', ACID = '#b3261e', RULE = '#babeb3', MUTED = '#53584d';
const ACIDL = '#f3d6d1', BASEL = '#d6defd', NEUTRAL = '#e4e2d8';
let pictureId = 0;  // each picture gets its own ids: a gradient or marker referenced from a hidden step would not draw
const svg = (label, body, h) => { const id = `p${++pictureId}-`; return `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body.replace(/ah-/g, id + 'ah-')}</svg>`; };
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const MARK = { [INK]: 'k', [BLUE]: 'b', [ACID]: 'r', [MUTED]: 'm' };
const arrow = (d, color = INK, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${MARK[color] || 'k'})" ${extra}/>`;
const DEFS = `<defs>${Object.entries(MARK).map(([c, k]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}<linearGradient id="ah-ph" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${ACID}"/><stop offset=".5" stop-color="${NEUTRAL}"/><stop offset="1" stop-color="${BLUE}"/></linearGradient></defs>`;
const part = (name, body) => `<g data-part="${name}">${body}</g>`;
const fade = a => `opacity="${f(clamp(a, 0, 1))}"`;

// Little symbols used across the pictures.
const bubble = (x, y, r = 9, extra = '') => `<circle data-co2 cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${ACID}" stroke-width="2" ${extra}/>`;
const hion = (x, y, r = 5, extra = '') => `<circle data-h cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${ACID}" ${extra}/>`;
const bicarb = (x, y, r = 12, extra = '') => `<circle data-bicarb cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BLUE}" ${extra}/>`;
const carbonic = (x, y, r = 12) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BASEL}" stroke="${BLUE}" stroke-width="2.5"/>` + hion(x + r * .8, y - r * .8, r * .42);
const drop = (x, y, s = 1) => `<path d="M${f(x)} ${f(y - 16 * s)} C${f(x + 12 * s)} ${f(y)} ${f(x + 16 * s)} ${f(y + 8 * s)} ${f(x)} ${f(y + 16 * s)} C${f(x - 16 * s)} ${f(y + 8 * s)} ${f(x - 12 * s)} ${f(y)} ${f(x)} ${f(y - 16 * s)} Z" fill="#cfe0f2" stroke="${INK}" stroke-width="2"/>`;
const lungsIcon = (x, y, s = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M0 -24 V-4 M0 -6 C-4 2 -8 2 -12 4 M0 -6 C4 2 8 2 12 4" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M-6 -6 C-22 -10 -30 10 -28 22 C-27 30 -18 32 -10 28 C-6 26 -5 20 -5 14 Z" fill="${ACIDL}" stroke="${INK}" stroke-width="2"/><path d="M6 -6 C22 -10 30 10 28 22 C27 30 18 32 10 28 C6 26 5 20 5 14 Z" fill="${ACIDL}" stroke="${INK}" stroke-width="2"/></g>`;
const kidneyIcon = (x, y, s = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-6 -26 C-26 -26 -30 -6 -26 8 C-22 22 -10 30 2 24 C10 20 6 10 4 4 C2 -2 10 -6 8 -14 C6 -22 2 -26 -6 -26 Z" fill="${BASEL}" stroke="${INK}" stroke-width="2"/><path d="M4 0 C14 2 18 12 18 28" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></g>`;
const plusIcon = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="#fff" stroke="${BLUE}" stroke-width="2.5"/><path d="M${x - 10} ${y} H${x + 10} M${x} ${y - 10} V${y + 10}" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/>`;
const acidIcon = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="#fff" stroke="${ACID}" stroke-width="2.5"/>${hion(x - 6, y - 3, 5.5)}${hion(x + 6, y + 6, 5.5)}`;

/* ---------- The pH meter ---------- */
const MX0 = 88, MX1 = 392;
const needleX = dpH => f(240 + 152 * Math.tanh(dpH / .15));
// The healthy band comes from the reference file's pH range, placed with the same pH-to-position mapping as the needle.
// Only if the file fails to load does the picture fall back to an illustrative band of fixed width.
const FALLBACK_BAND = [192, 288];
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
// word: what the needle did, written under it with an arrow from the dashed normal needle.
function meter(o, ghost, word = '', from = ghost) {
  const [b0, b1] = bandX(), n = needleFor(o);
  let s = text(MX0, 18, 'blood pH', 'xs b', 'start') + text((b0 + b1) / 2, 18, 'healthy band', 'xs b');
  s += part('meter', `<rect x="${MX0}" y="28" width="${MX1 - MX0}" height="14" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.5"/><rect data-band x="${f(b0)}" y="23" width="${f(b1 - b0)}" height="24" fill="none" stroke="${INK}" stroke-width="2.5"/>`);
  s += text(MX0 - 8, 41, 'acidic', 'xs b acid', 'end') + text(MX1 + 8, 41, 'alkaline', 'xs b blue', 'start');
  if (ghost) {
    const g = needleFor(ghost);
    s += `<path class="ghost" data-ghost-needle d="M${g} 46 L${f(g - 9)} 62 L${f(g + 9)} 62 Z" fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="3 2"/>`;
    const g0 = from ? needleFor(from) : g;
    if (word && Math.abs(n - g0) > 22) s += `<g data-named>${arrow(`M${g0} 72 H${f(n + (n > g0 ? -6 : 6))}`, BLUE, 3)}${text(clamp((g0 + n) / 2, 80, 400), 92, word, 'xs b blue')}</g>`;
  }
  s += `<path data-needle="${n}" d="M${n} 44 L${f(n - 10)} 62 L${f(n + 10)} 62 Z" fill="${INK}"/>`;
  return s;
}

/* ---------- The seesaw ---------- */
const PIV = { x: 240, y: 300 }, ARM = 170, TOK = 11, GAP = 26;
const tiltOf = dpH => 11 * Math.tanh(dpH / .12);   // degrees; heavier side down (an illustrative scale)
function ends(theta) {
  const a = theta * Math.PI / 180, c = Math.cos(a) * ARM, s = Math.sin(a) * ARM;
  return { L: { x: PIV.x - c, y: PIV.y - s }, R: { x: PIV.x + c, y: PIV.y + s } };
}
function token(x, y, kind, added = false, op = 1, r = TOK) {
  const col = kind === 'acid' ? ACID : BLUE;
  let s = kind === 'acid' ? `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${ACID}" stroke-width="2.5"/>` : `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BLUE}"/>`;
  if (added) s += `<circle data-added cx="${f(x)}" cy="${f(y)}" r="${f(r + 4)}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
  return op < 1 ? `<g ${fade(op)}>${s}</g>` : s;
}
const lost = (x, y, r = TOK) => `<circle data-lost cx="${f(x)}" cy="${f(y)}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3.5 3" opacity=".75"/>`;
// One side's tokens on its pan: six at the normal mix, three to a row, filled from the bottom; lost ones leave from the top.
function stack(cx, baseY, rel, kind, r = TOK, gap = GAP) {
  const n = 6 * clamp(rel, 0, 2), full = Math.floor(n + 1e-6), frac = n - full;
  let s = '';
  for (let i = 0; i < Math.max(6, Math.ceil(n - 1e-6)); i++) {
    const x = cx + ((i % 3) - 1) * gap, y = baseY - r - 3 - Math.floor(i / 3) * gap;
    if (i < 6 && i >= full) s += lost(x, y, r);
    if (i < full) s += token(x, y, kind, i >= 6, 1, r);
    else if (i === full && frac > .03) s += token(x, y, kind, i >= 6, frac, r);
  }
  return s;
}
// A note above one pan: an organ icon, an optional numbered badge, and up to three short lines.
function note(side, n) {
  if (!n) return '';
  const left = side === 'left', ix = left ? 34 : 446, tx = left ? 72 : 408, anchor = left ? 'start' : 'end';
  let s = n.icon === 'lungs' ? lungsIcon(ix, 140, 1) : n.icon === 'kidney' ? kidneyIcon(ix, 140, 1) : n.icon === 'add' ? plusIcon(ix, 136) : n.icon === 'acid' ? acidIcon(ix, 136) : '';
  if (n.badge) {
    const bx = left ? tx + 11 : tx - 11, col = n.badge === 1 ? INK : n.tone === 'second' ? ACID : BLUE;
    s += `<circle data-badge="${n.badge}" cx="${bx}" cy="110" r="11.5" fill="${col}"/>` + text(bx, 116, String(n.badge), 'xs b on-badge');
    s += text(left ? tx + 30 : tx - 30, 116, n.lines[0], 'xs b', anchor);
  } else s += text(tx, 116, n.lines[0], 'xs b', anchor);
  n.lines.slice(1).forEach((w, i) => { s += text(tx, 138 + 22 * i, w, `xs b ${n.cls || ''}`, anchor); });
  const g = `<g data-note="${side}" ${n.op != null && n.op < 1 ? fade(n.op) : ''}>${s}</g>`;
  return n.part ? part(n.part, g) : g;
}
const anyLost = o => o.rP < .995 || o.rH < .995, anyAdded = o => o.rP > 1.005 || o.rH > 1.005;
// opt: { ghost (normal state, or null), left, right (notes), word (what the needle did), center (lines under the meter) }
function seesaw(o, opt = {}) {
  const { ghost = BASE, left = null, right = null, word = '', center = null, centerY = 112, from = ghost } = opt;
  const { L, R } = ends(tiltOf(o.dpH));
  let b = DEFS + meter(o, ghost, word, from);
  if (center) b += center.map((w, i) => text(240, centerY + 24 * i, w, 'sm b')).join('');
  if (ghost) b += `<path class="ghost" data-ghost="normal" d="M66 ${PIV.y} H414" stroke="${INK}" stroke-width="2" stroke-dasharray="7 6" opacity=".55"/>`;
  b += `<path d="M${PIV.x} ${PIV.y} L${PIV.x - 26} ${PIV.y + 30} H${PIV.x + 26} Z" fill="${INK}"/><path d="M150 ${PIV.y + 30} H330" stroke="${INK}" stroke-width="2"/>`;
  b += `<path d="M${f(L.x)} ${f(L.y)} L${f(R.x)} ${f(R.y)}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  b += `<path d="M${f(L.x - 46)} ${f(L.y - 4)} H${f(L.x + 46)} M${f(R.x - 46)} ${f(R.y - 4)} H${f(R.x + 46)}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  b += `<g data-new-state ${attrs(o)}>${part('acid-side', stack(L.x, L.y - 6, o.rP, 'acid'))}${part('base-side', stack(R.x, R.y - 6, o.rH, 'base'))}</g>`;
  b += note('left', left) + note('right', right);
  b += part('acid-side', text(70, 362, 'acid side:', 'xs b acid') + text(70, 384, 'carbon dioxide', 'xs b'));
  b += part('base-side', text(410, 362, 'base side:', 'xs b blue') + text(410, 384, 'bicarbonate', 'xs b'));
  const keys = [];
  if (anyLost(o)) keys.push([lost(0, -6, 8), 'lost']);
  if (anyAdded(o)) keys.push([`<circle cx="0" cy="-6" r="7" fill="${MUTED}"/><circle cx="0" cy="-6" r="10.5" fill="none" stroke="${MUTED}" stroke-width="1.6"/>`, 'added']);
  keys.forEach(([icon, w], i) => { const x = keys.length === 1 ? 200 : 170 + i * 80; b += `<g transform="translate(${x} 386)">${icon}${text(16, 0, w, 'xs muted', 'start')}</g>`; });
  return b;
}
const SEESAW_H = 398;
const seesawSvg = (label, o, opt) => svg(label, seesaw(o, opt), SEESAW_H);
function attrs(o) { return `data-bicarb="${o.rH.toFixed(4)}" data-co2="${o.rP.toFixed(4)}" data-ph="${o.dpH.toFixed(4)}"`; }

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
const tokenWords = o => `Carbon dioxide side: ${f(6 * o.rP)} of 6 tokens; bicarbonate side: ${f(6 * o.rH)} of 6 tokens.`;

/* ---------- Build the idea: the step pictures ---------- */
function scalePicture() {
  // Positions along the scale are illustrative, not to scale.
  const X = u => 30 + 420 * u;
  let b = DEFS + part('scale', `<rect x="30" y="76" width="420" height="22" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.5"/>`);
  const mark = (u, word, cls) => `<path d="M${f(X(u))} 76 V60" stroke="${INK}" stroke-width="2"/>` + text(X(u), 52, word, `xs b ${cls}`);
  b += mark(.12, 'lemon juice', 'acid') + mark(.5, 'water', '') + mark(.82, 'soap', 'blue');
  b += `<rect data-blood-band x="${f(X(.525))}" y="72" width="${f(420 * .03)}" height="30" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` + text(X(.54), 126, 'blood', 'xs b');
  b += text(30, 126, 'acidic', 'xs b acid', 'start') + text(450, 126, 'alkaline', 'xs b blue', 'end');
  // Zoomed view of blood's band.
  b += `<path d="M${f(X(.525))} 102 L40 176 M${f(X(.555))} 102 L440 176" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  b += `<rect x="40" y="176" width="400" height="116" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
  b += text(240, 200, 'zoomed in on blood', 'xs b muted on-white');
  b += `<rect x="60" y="212" width="360" height="18" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.2"/><rect x="196" y="204" width="88" height="34" fill="none" stroke="${INK}" stroke-width="3"/>`;
  b += `<path d="M240 230 L231 246 H249 Z" fill="${INK}"/>`;
  b += text(60, 274, 'too acidic', 'xs b acid on-white', 'start') + text(240, 274, 'healthy band', 'xs b on-white') + text(420, 274, 'too alkaline', 'xs b blue on-white', 'end');
  return b;
}
// Moving: carbon dioxide and other acids stream out of a working cell into the blood.
function madePicture(t) {
  let b = DEFS;
  b += `<path d="M30 150 C26 96 86 66 128 80 C170 94 182 146 170 190 C158 238 100 258 62 232 C38 216 34 186 30 150 Z" fill="#f2e6d6" stroke="${INK}" stroke-width="2.5"/>`;
  b += `<ellipse cx="96" cy="160" rx="26" ry="20" fill="#e2d2bb" stroke="${INK}" stroke-width="1.5"/>` + text(100, 290, 'a working cell', 'sm b');
  b += `<rect x="330" y="40" width="130" height="240" rx="14" fill="${ACIDL}" stroke="${ACID}" stroke-width="2.5"/>` + text(395, 70, 'blood', 'sm b acid');
  let co2 = arrow('M182 124 H320', INK, 3) + text(251, 108, 'carbon dioxide', 'xs b');
  let acids = arrow('M182 214 H320', ACID, 3) + text(251, 198, 'other acids', 'xs b acid');
  let hs = '';
  for (let i = 0; i < 3; i++) {
    const p = (t + i / 3) % 1, op = Math.sin(Math.PI * p);
    co2 += bubble(188 + 124 * p, 124, 8, fade(op));
    hs += hion(188 + 124 * ((p + .17) % 1), 214, 6, fade(Math.sin(Math.PI * ((p + .17) % 1))));
  }
  b += part('co2', co2 + [[360, 100], [404, 128], [424, 92], [372, 150]].map(([x, y]) => bubble(x, y)).join(''));
  b += part('acids', acids);
  b += part('h', hs + [[356, 206], [386, 232], [418, 200], [404, 262], [362, 258], [432, 236]].map(([x, y]) => hion(x, y, 6)).join(''));
  b += `<g transform="translate(16 330)">${bubble(8, -6, 7)}${text(24, 0, 'carbon dioxide', 'xs', 'start')}${hion(170, -6, 6)}${text(184, 0, 'hydrogen ion', 'xs', 'start')}</g>`;
  return b;
}
// Moving: a drop of acid into plain water, and into blood with its buffer.
function bufferPicture(t) {
  const fall = ease(span(t, .06, .36)), react = ease(span(t, .42, .78));
  let b = DEFS;
  const beaker = (cx, fill, label, buffered) => {
    let s = `<path d="M${cx - 70} 120 V250 Q${cx - 70} 268 ${cx - 52} 268 H${cx + 52} Q${cx + 70} 268 ${cx + 70} 250 V120" fill="none" stroke="${INK}" stroke-width="3"/>`;
    s += `<path d="M${cx - 68} 150 H${cx + 68} V250 Q${cx + 68} 266 ${cx + 52} 266 H${cx - 52} Q${cx - 68} 266 ${cx - 68} 250 Z" fill="${fill}"/>`;
    s += `<path d="M${cx - 8} 34 H${cx + 8} V74 L${cx} 86 L${cx - 8} 74 Z" fill="#fff" stroke="${INK}" stroke-width="2"/>` + text(cx + 18, 62, 'acid in', 'xs b acid', 'start');
    const dy = lerp(98, 176, fall);
    if (buffered) {
      // The buffer: bicarbonate that catches the acid, and carbonic acid already made.
      s += part('buffer', [[cx - 40, 236], [cx + 34, 226]].map(([x, y]) => carbonic(x, y, 11)).join('') + bicarb(cx + 36, 186, 11) + bicarb(cx - 34, 196, 11)
        + (react < 1 ? bicarb(lerp(cx + 4, cx, react), lerp(236, 182, react), 11, fade(1 - react)) : '') + (react > 0 ? `<g ${fade(react)}>${carbonic(cx, 182, 11)}</g>` : ''));
      if (react < .02) s += hion(cx, dy, 7);
    } else {
      if (react < .02) s += hion(cx, dy, 7);
      else [[cx - 34, 204], [cx + 12, 188], [cx + 36, 232], [cx - 10, 240]].forEach(([x, y]) => { s += hion(lerp(cx, x, react), lerp(176, y, react), 6); });
    }
    s += text(cx, 292, label, 'xs b');
    s += `<rect x="${cx - 80}" y="306" width="160" height="12" fill="url(#ah-ph)" stroke="${INK}" stroke-width="1.2"/>`;
    s += `<path class="ghost" d="M${cx} 320 L${cx - 7} 332 H${cx + 7} Z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 2"/>`;
    const n = cx - (buffered ? 6 : 66) * react;
    s += `<path d="M${f(n)} 319 L${f(n - 8)} 333 H${f(n + 8)} Z" fill="${INK}"/>` + text(cx, 356, buffered ? 'pH barely moves' : 'pH swings far', 'xs b');
    return s;
  };
  b += beaker(124, '#e3e9ef', 'plain water', false) + beaker(356, ACIDL, 'blood, with buffer', true);
  return b;
}
// Moving: a hydrogen ion drifts in and bicarbonate catches it, becoming carbonic acid.
function bicarbPicture(t) {
  const go = ease(span(t, .1, .45)), caught = span(t, .45, .55), out = span(t, 0, .08);
  let b = DEFS;
  const hx = lerp(70, 222, go), hy = lerp(56, 66, go);
  let top = '';
  top += caught < 1 ? part('bicarb', bicarb(240, 84, 24, fade(1 - caught))) : '';
  top += caught > 0 ? part('carbonic', `<g ${fade(caught)}><circle cx="240" cy="84" r="24" fill="${BASEL}" stroke="${BLUE}" stroke-width="3"/></g>`) : '';
  top += hion(caught > 0 ? 222 : hx, caught > 0 ? 66 : hy, 9);
  if (go < .3) top += `<g ${fade(1 - span(go, .1, .3))}>${text(70, 34, 'hydrogen ion', 'xs b acid')}</g>`;
  if (caught < 1) top += `<g ${fade(1 - caught)}>${text(240, 136, 'bicarbonate', 'xs b blue')}</g>`;
  if (caught > 0) top += `<g ${fade(caught)}>${text(240, 136, 'carbonic acid: holds on', 'xs b')}</g>`;
  b += `<g ${fade(out)}>${top}</g>`;
  b += `<rect x="30" y="166" width="420" height="160" fill="${ACIDL}" stroke="${ACID}" stroke-width="2"/>` + text(46, 190, 'in blood', 'xs b acid', 'start');
  let crowd = '', one = '';
  for (let i = 0; i < 21; i++) {
    const x = 84 + (i % 7) * 52, y = 222 + Math.floor(i / 7) * 38;
    if (i === 10) one += carbonic(x, y, 12); else crowd += bicarb(x, y, 12);
  }
  b += part('bicarb', crowd) + part('carbonic', one);
  return b + text(240, 356, 'far more bicarbonate than carbonic acid', 'xs b');
}
// Moving: carbonic anhydrase splits carbonic acid into carbon dioxide and water; the gas is breathed out.
function swapPicture(t) {
  const split = span(t, .25, .42), rise = ease(span(t, .5, .9)), back = 0;
  let b = DEFS;
  b += text(16, 36, 'the split also runs backward:', 'xs muted', 'start') + text(16, 58, 'carbon dioxide and water rejoin', 'xs muted', 'start');
  b += lungsIcon(420, 66, 1.3) + text(420, 128, 'lungs', 'xs b');
  b += `<rect x="20" y="196" width="440" height="124" rx="16" fill="${ACIDL}" stroke="${ACID}" stroke-width="2"/>` + text(36, 220, 'blood', 'xs b acid', 'start');
  b += arrow('M100 272 H296', BLUE, 3, 'stroke-dasharray="2 7"');
  b += part('enzyme', `<path d="M130 272 l14 -24 h102 l14 24 l-14 24 h-102 z" fill="#fff" stroke="${BLUE}" stroke-width="2.5"/>${text(195, 268, 'carbonic', 'xs b blue on-white')}${text(195, 288, 'anhydrase', 'xs b blue on-white')}`);
  b += `<g ${fade(1 - split)}>${carbonic(70, 272, 20)}</g>` + (split > 0 ? `<circle cx="70" cy="272" r="20" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3.5 3" ${fade(split * .75)}/>` : '');
  // The path the carbon dioxide takes out to the lungs.
  b += `<path d="M330 248 C334 196 360 150 400 108" fill="none" stroke="${ACID}" stroke-width="2.5" stroke-dasharray="4 5"/>` + text(316, 178, 'breathed out', 'xs b acid', 'end');
  const bx = lerp(330, 404, rise), by = lerp(264, 84, rise) + (rise > 0 && rise < 1 ? -10 * Math.sin(Math.PI * rise) : 0);
  b += bubble(bx, by, 16, fade(split * (1 - .55 * span(t, .82, .95))));
  b += `<g ${fade(split * (1 - back))}>${drop(420, 270, 1)}</g>`;
  b += text(70, 346, 'carbonic acid', 'xs b') + text(318, 346, 'carbon dioxide', 'xs b') + text(420, 346, 'water', 'xs b') + text(195, 370, 'speeds the split', 'xs b blue');
  return b;
}
// The four disorders, each on a small seesaw: which side changed first, and which way the beam tips.
function mini(cx, cy, o, title, tone, word) {
  const th = tiltOf(o.dpH) * 1.1, a = th * Math.PI / 180, c = Math.cos(a) * 64, s = Math.sin(a) * 64;
  const L = { x: cx - c, y: cy - s }, R = { x: cx + c, y: cy + s };
  let g = text(cx, cy - 100, title, `xs b ${tone}`);
  g += `<path d="M${cx} ${cy} L${cx - 13} ${cy + 24} H${cx + 13} Z" fill="${INK}"/>`;
  g += `<path d="M${f(L.x)} ${f(L.y)} L${f(R.x)} ${f(R.y)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  g += `<path d="M${f(L.x - 26)} ${f(L.y - 3)} H${f(L.x + 26)} M${f(R.x - 26)} ${f(R.y - 3)} H${f(R.x + 26)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  g += stack(L.x, L.y - 5, o.rP, 'acid', 6.5, 15) + stack(R.x, R.y - 5, o.rH, 'base', 6.5, 15);
  return g + text(cx, cy + 52, word, 'xs b');
}
function fourPicture() {
  let b = DEFS + `<path d="M240 8 V386 M8 196 H472" stroke="${RULE}" stroke-width="1.5"/>`;
  b += mini(124, 126, model({ m: 1, r: 1.5, c: 0 }), 'respiratory acidosis', 'acid', '↑ carbon dioxide first');
  b += mini(356, 126, model({ m: 1, r: .62, c: 0 }), 'respiratory alkalosis', 'blue', '↓ carbon dioxide first');
  b += mini(124, 322, model({ m: .62, r: 1, c: 0 }), 'metabolic acidosis', 'acid', '↓ bicarbonate first');
  b += mini(356, 322, model({ m: 1.45, r: 1, c: 0 }), 'metabolic alkalosis', 'blue', '↑ bicarbonate first');
  return b;
}
// Moving: the three defences start one after another as time runs on.
function speedsPicture(t) {
  const cur = lerp(84, 456, span(t, .04, .92));
  let b = DEFS;
  const rows = [
    { y: 70, icon: bicarb(40, 72, 14) + hion(52, 60, 6), name: 'buffers', x0: 104, fill: BASEL },
    { y: 160, icon: lungsIcon(40, 158, .9), name: 'lungs', x0: 206, fill: ACIDL },
    { y: 250, icon: kidneyIcon(42, 252, .9), name: 'kidneys', x0: 322, fill: BASEL }
  ];
  for (const r of rows) {
    b += r.icon + text(84, r.y - 10, r.name, 'xs b', 'start');
    b += `<rect x="84" y="${r.y}" width="372" height="18" fill="#fff" stroke="${RULE}"/>`;
    if (cur > r.x0) b += `<rect x="${r.x0}" y="${r.y}" width="${f(cur - r.x0)}" height="18" fill="${r.fill}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  b += arrow('M84 300 H462', INK, 2.5);
  [[104, 'seconds'], [206, 'minutes'], [322, 'hours'], [432, 'days']].forEach(([x, w]) => { b += `<path d="M${x} 294 V306" stroke="${INK}" stroke-width="2"/>` + text(x, 326, w, 'xs b'); });
  b += `<path d="M${f(cur)} 40 V296" stroke="${BLUE}" stroke-width="2" stroke-dasharray="5 4"/>`;
  return b + text(456, 356, 'time since acid arrives →', 'xs b', 'end');
}

/* ---------- The notes the seesaw pictures carry ---------- */
const LUNGS_SET = { icon: 'lungs', lines: ['lungs set', 'this side'], cls: 'muted' };
function lungsLoop(t) {
  const r = 1 - .38 * Math.sin(2 * Math.PI * t), o = model({ m: 1, r, c: 0 });
  const fast = t < .5, level = Math.abs(r - 1) < .07;
  const left = { icon: 'lungs', part: 'lungs', lines: level ? ['lungs set', 'this side'] : fast ? ['breathe faster:', 'carbon dioxide', 'blown off'] : ['breathe slower:', 'carbon dioxide', 'builds up'], cls: level ? 'muted' : fast ? 'blue' : 'acid' };
  return { o, left, word: o.dpH > .01 ? 'pH rises' : o.dpH < -.01 ? 'pH falls' : '' };
}
function kidneysLoop(t) {
  const m = 1 + .38 * Math.sin(2 * Math.PI * t), o = model({ m, r: 1, c: 0 });
  const keep = t < .5, level = Math.abs(m - 1) < .07;
  const right = { icon: 'kidney', part: 'kidneys', lines: level ? ['kidneys set', 'this side'] : keep ? ['kidneys keep', 'more bicarbonate'] : ['kidneys let', 'more go'], cls: level ? 'muted' : keep ? 'blue' : 'acid' };
  return { o, left: LUNGS_SET, right, word: o.dpH > .01 ? 'pH rises' : o.dpH < -.01 ? 'pH falls' : '' };
}
// Each change runs in two parts: the first change (badge 1), then the other side answering (badge 2).
const CHANGES = {
  compensate: [{ m: .62, r: 1, c: 0 }, { m: .62, r: 1, c: 1 }],
  cai: [{ m: .72, r: 1, c: 0 }, { m: .72, r: 1, c: .6 }],
  diuretic: [{ m: 1.3, r: 1, c: 0 }, { m: 1.3, r: 1, c: .6 }],
  sodium: [{ m: 1.35, r: 1, c: 0 }, { m: 1.35, r: 1, c: .6 }],
  // Salicylate: breathing is driven first (carbon dioxide falls), then acids build up (bicarbonate falls): a mixed picture.
  salicylate: [{ m: 1, r: .62, c: 0 }, { m: .65, r: .62, c: 0 }]
};
const ANSWER_SLOWER = { side: 'left', icon: 'lungs', badge: 2, part: 'answer', lines: ['lungs answer:', 'breathe slower'], cls: 'blue' };
const NOTES = {
  compensate: [{ side: 'right', icon: 'acid', badge: 1, lines: ['bicarbonate', 'falls first'], cls: 'acid' }, { side: 'left', icon: 'lungs', badge: 2, part: 'answer', lines: ['lungs answer:', 'breathe off', 'carbon dioxide'], cls: 'blue' }],
  cai: [{ side: 'right', icon: 'kidney', badge: 1, part: 'kidney', lines: ['enzyme blocked:', 'bicarbonate', 'lost in urine'], cls: 'acid' }, { side: 'left', icon: 'lungs', badge: 2, part: 'answer', lines: ['lungs answer:', 'breathe faster'], cls: 'blue' }],
  diuretic: [{ side: 'right', icon: 'kidney', badge: 1, part: 'kidney', lines: ['less fluid, same', 'bicarbonate:', 'it rises'], cls: 'blue' }, ANSWER_SLOWER],
  sodium: [{ side: 'right', icon: 'add', badge: 1, part: 'added', lines: ['bicarbonate', 'added directly'], cls: 'blue' }, ANSWER_SLOWER],
  salicylate: [{ side: 'left', icon: 'lungs', badge: 1, part: 'drive', lines: ['breathing', 'driven hard'], cls: 'blue' }, { side: 'right', icon: 'acid', badge: 2, tone: 'second', lines: ['then acids', 'build up, using', 'up bicarbonate'], cls: 'acid' }]
};
function twoPart(kind, t) {
  const [a, b] = CHANGES[kind], first = t < .5;
  const o = model(first ? mix(NORMAL, a, ease(span(t, .04, .42))) : mix(a, b, ease(span(t, .56, .94))));
  const [n1, n2] = NOTES[kind], side = {};
  const a1 = span(t, .1, .24), a2 = span(t, .58, .72);
  if (a1 > .01) side[n1.side] = { ...n1, op: a1 };
  if (a2 > .01) side[n2.side] = { ...n2, op: a2 };
  const firstDp = model(a).dpH;
  const word = first ? (o.dpH < -.01 ? 'pH falls' : o.dpH > .01 ? 'pH rises' : '') : (Math.abs(o.dpH) < Math.abs(firstDp) - .01 ? (kind === 'salicylate' ? 'back near normal' : 'back toward normal') : o.dpH < 0 ? 'pH falls' : 'pH rises');
  return { o, left: side.left || null, right: side.right || null, word, from: first ? BASE : model(a) };
}

/* ---------- The lesson's scenes, one per step kind ---------- */
const CHANGE_WHERE = {
  compensate: 'First, badge 1: bicarbonate falls, three of the six blue tokens become dashed rings, the beam tips down on the acid side and the pH needle moves toward acidic. Then, badge 2: the lungs answer by breathing off carbon dioxide, so the carbon dioxide side loses tokens too; the beam comes back toward level and the needle back toward the band, but not past normal.',
  cai: 'First, badge 1 on the base side: with the kidney enzyme blocked, bicarbonate is lost in urine; blue tokens leave, the beam tips down on the acid side and the needle moves toward acidic. Then, badge 2 on the acid side: the lungs answer by breathing faster, carbon dioxide tokens leave too, and the needle comes part of the way back.',
  diuretic: 'First, badge 1 on the base side: with less fluid around the same bicarbonate, bicarbonate rises; ringed blue tokens are added, the beam tips down on the base side and the needle moves toward alkaline. Then, badge 2 on the acid side: the lungs answer by breathing slower, a little carbon dioxide is added, and the needle comes a little way back.',
  sodium: 'First, badge 1 on the base side: bicarbonate is added directly; ringed blue tokens appear, the beam tips down on the base side and the needle moves toward alkaline. Then, badge 2 on the acid side: the lungs answer by breathing slower, a little carbon dioxide is added, and the needle comes a little way back.',
  salicylate: 'First, badge 1 on the acid side: breathing is driven hard and carbon dioxide tokens leave, so the beam tips down on the base side and the needle swings toward alkaline: a respiratory alkalosis. Then, badge 2 in red on the base side: acids build up and use up bicarbonate, so blue tokens leave too and the needle swings back near normal, with both sides now short: a mixed picture.'
};
const TITLE = { compensate: 'Compensation', cai: 'Carbonic anhydrase inhibitor', diuretic: 'Loop or thiazide diuretic', sodium: 'Sodium bicarbonate', salicylate: 'Salicylate toxicity' };
function changeScene(kind, withReadout = true) {
  return {
    duration: 4200,
    render(t) {
      const { o, left, right, word, from } = twoPart(kind, t);
      const label = `${TITLE[kind]}, drawn over a dashed level beam and a dashed pH needle for normal. ${CHANGE_WHERE[kind]} ${tiltWords(o)} ${tokenWords(o)}`;
      const pic = seesawSvg(label, o, { left, right, word, from });
      return withReadout ? { svg: pic, readout: readout(o, BASE, 'Compared with normal') } : pic;
    }
  };
}
const still = (label, body, h) => () => svg(label, body(), h);
const scenes = {
  scale: still('A pH scale running from acidic on the left, red, to alkaline on the right, blue. Lemon juice sits far toward the acidic end, water in the middle, soap toward the alkaline end. Blood is a small box just on the alkaline side of water. A zoomed-in view shows that narrow healthy band, with too acidic on one side and too alkaline on the other.', scalePicture, 302),
  made: { duration: 3200, loop: true, rest: .4, render: t => svg('A working cell on the left with two arrows into a blood vessel on the right. Along the upper arrow, white carbon dioxide bubbles keep streaming into the blood; along the lower arrow, red dots, hydrogen ions from other acids.', madePicture(t), 342) },
  buffer: { duration: 4200, render: t => svg('Two beakers, each with a drop of acid falling in. Left: plain water; the acid breaks up into free red hydrogen ions and the pH pointer below swings far toward acidic. Right: blood with a buffer; a blue bicarbonate catches the acid and becomes carbonic acid, and the pH pointer barely moves.', bufferPicture(t), 366) },
  bicarb: { duration: 3600, loop: true, rest: .7, render: t => svg('A red hydrogen ion drifts toward a blue bicarbonate, which catches it and becomes carbonic acid, a pale circle holding on to the red dot. Below, a box of blood holds many blue bicarbonates and just one carbonic acid: far more bicarbonate than carbonic acid.', bicarbPicture(t), 368) },
  swap: { duration: 4200, render: t => svg('Inside a blood vessel, carbonic acid passes the enzyme carbonic anhydrase, which speeds its split into a carbon dioxide bubble and a drop of water. The carbon dioxide bubble then rises along a dotted path out of the blood to the lungs: breathed out. A note says the split also runs backward: carbon dioxide and water rejoin.', swapPicture(t), 380) },
  balance: () => seesawSvg(`A pH meter above a seesaw. On the left, the acid side, six carbon dioxide tokens; on the right, the base side, six bicarbonate tokens: the normal mix. ${tiltWords(BASE)}`, BASE, { ghost: null, center: ['level beam:', 'pH in its band'] }),
  lungs: { duration: 6400, loop: true, rest: .25, render: t => { const s = lungsLoop(t); return svg(`The seesaw with lungs above the acid side, breathing faster and then slower. Breathing faster blows off carbon dioxide tokens, the beam tips down on the base side and the pH needle rises; breathing slower lets carbon dioxide build up, the beam tips down on the acid side and the needle falls. ${tokenWords(s.o)}`, seesaw(s.o, { left: s.left, word: s.word }), SEESAW_H); } },
  kidneys: { duration: 7000, loop: true, rest: .25, render: t => { const s = kidneysLoop(t); return svg(`The seesaw with lungs above the acid side and kidneys above the base side. The kidneys keep more bicarbonate, adding ringed blue tokens so the beam tips toward alkaline, then let more go, so blue tokens leave and the beam tips toward acidic. ${tokenWords(s.o)}`, seesaw(s.o, { left: s.left, right: s.right, word: s.word }), SEESAW_H); } },
  speeds: { duration: 4600, render: t => svg('A timeline that runs on from seconds to days. Buffers start within seconds, a bar from the start; the lungs join within minutes; the kidneys join over hours and keep working for days.', speedsPicture(t), 364) },
  four: still('Four small seesaws in a grid. Respiratory acidosis: carbon dioxide up first, tokens added on the acid side, tipping toward acidic. Respiratory alkalosis: carbon dioxide down first, tokens lost, tipping toward alkaline. Metabolic acidosis: bicarbonate down first, tipping toward acidic. Metabolic alkalosis: bicarbonate up first, tipping toward alkaline.', fourPicture, 392),
  compensate: changeScene('compensate', false),
  whole: () => seesawSvg(`The whole picture. Buffers act at once; lungs above the acid side set carbon dioxide in minutes; kidneys above the base side set bicarbonate over hours to days. The three things a blood test reads: pH on the meter, carbon dioxide and bicarbonate on the two sides. ${tiltWords(BASE)}`, BASE, {
    ghost: null, center: ['buffers: at once'], centerY: 92,
    left: { icon: 'lungs', lines: ['lungs set this', 'side in minutes'], cls: 'muted' }, right: { icon: 'kidney', lines: ['kidneys set it', 'over hours', 'to days'], cls: 'muted' }
  }),
  cai: changeScene('cai'),
  diuretic: changeScene('diuretic'),
  sodium: changeScene('sodium'),
  salicylate: changeScene('salicylate'),
};

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
  for (let p = Math.ceil(pLo / 10) * 10; p <= pHi; p += 10) b += `<path d="M${X(p)} ${y0} V${y0 + 6}" stroke="${INK}" stroke-width="1.5"/>` + text(X(p), y0 + 24, String(p), 'xs');
  for (let h = Math.ceil(hLo / 10) * 10; h <= hHi; h += 10) b += `<path d="M${x0 - 6} ${Y(h)} H${x0}" stroke="${INK}" stroke-width="1.5"/>` + text(x0 - 10, Y(h) + 6, String(h), 'xs', 'end');
  b += text(x1, y0 + 50, 'carbon dioxide, PCO2 (mm Hg) →', 'xs b', 'end') + text(12, 14, 'bicarbonate (mM) ↑', 'xs b', 'start');
  b += text(X(pHi * .86), Y(hi(pHi * .86)) - 12, `pH ${K.phLo} to ${K.phHi}`, 'xs b blue', 'end');
  b += text(x0 + 12, y1 + 20, '← more alkaline', 'xs b blue', 'start') + text(x1 - 6, y0 - 12, 'more acidic →', 'xs b acid', 'end');
  const n = absolute(BASE), pr = absolute(model({ ...o.p, c: 0 })), now = absolute(o);
  b += `<circle cx="${X(n.pco2)}" cy="${Y(n.hco3)}" r="5" fill="${INK}"/>` + text(X(n.pco2) + 10, Y(n.hco3) + 22, 'normal', 'xs b', 'start');
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
// The notes for any model state: badge 1 on the side that changed first, badge 2 on the side that answers.
function notesFor(o) {
  const p = o.p, side = { left: null, right: null };
  if (Math.abs(p.r - 1) > .015) side.left = { icon: 'lungs', badge: 1, lines: ['carbon dioxide', p.r > 1 ? 'rises first' : 'falls first'], cls: p.r > 1 ? 'acid' : 'blue' };
  if (Math.abs(p.m - 1) > .015) side.right = { icon: 'kidney', badge: 1, lines: ['bicarbonate', p.m > 1 ? 'rises first' : 'falls first'], cls: p.m > 1 ? 'blue' : 'acid' };
  if (o.who === 'lungs') side.left = { icon: 'lungs', badge: 2, lines: ['lungs answer:', o.rP < p.r ? 'breathe faster' : 'breathe slower'], cls: 'blue' };
  if (o.who === 'kidneys') side.right = { icon: 'kidney', badge: 2, lines: ['kidneys answer:', o.rH < p.m ? 'let more go' : 'keep more'], cls: 'blue' };
  return side;
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
  const label = `Illustrative model with these settings, drawn over a dashed level beam and a dashed pH needle for normal. ${tiltWords(o)} ${tokenWords(o)} Compared with normal: ${describe(o, BASE)}.`;
  const opt = { ...notesFor(o), word: o.dpH < -.01 ? 'toward acidic' : o.dpH > .01 ? 'toward alkaline' : '' };
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
  $('#ph-map').innerHTML = svg(`Illustrative pH map: bicarbonate up the side, carbon dioxide along the bottom. A shaded wedge between two straight lines through the origin marks the pH range from the reference file, ${K.phLo} to ${K.phHi}. The normal point sits inside it. The model now sits at carbon dioxide ${a.pco2.toFixed(0)} mm Hg and bicarbonate ${a.hco3.toFixed(1)} mM, pH ${a.ph.toFixed(2)}${o.who ? `; before compensation it sat at ${pr.pco2.toFixed(0)} mm Hg and ${pr.hco3.toFixed(1)} mM, pH ${pr.ph.toFixed(2)}, and an arrow shows compensation moving it toward the wedge` : ''}.`, phMap(o), 336);
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
  update();
}

lesson({ scenes, before: load, onTab: { clinical: update, explore: update } });
