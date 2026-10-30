'use strict';
const PK = window.PKModel;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f = n => Number(n.toFixed(1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The teaching drug ---------- */
const NORMAL_P = PK.build('normal');
const NS = PK.summary(NORMAL_P);
const ONCE = PK.build('normal', { repeat: 0 });
const SPAN_ONE = 36, SPAN_REP = 54;
const Y_ONE = PK.summary(PK.build('normal', { repeat: 0, F: 1 })).peak * 1.18;
const Y_REP = Math.max(...Object.keys(PK.STATES).map(id => PK.summary(PK.build(id)).peak)) * 1.1;
// An illustrative working range drawn around the normal teaching drug's plateau (no source gives one).
const RANGE = [NS.trough * 0.8, NS.peak * 1.2];

/* ---------- Drawing ---------- */
const INK = '#171916', BLUE = '#254dff', RED = '#b3261e', AMBER = '#a34700', MUTED = '#53584d', RULE = '#babeb3';
const GUT = '#f1e3c6', LIVER = '#ecd0c2', BLOOD = '#f6dcd6', TISSUE = '#e1e7d3', KIDNEY = '#e3def1', BANDF = '#f8e3cc', CHIP = '#fff';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (x, y, s, cls = '', anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const svg = (label, body, h) => `<svg viewBox="0 0 480 ${f(h)}" role="img" aria-label="${esc(label)}">${body}</svg>`;
// A straight arrow with its own head (no markers, so hidden steps never share ids).
function arrow(x1, y1, x2, y2, w, color, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .55, w * 1.1 + 6), hw = w * 1.05 + 4, bx = x2 - ux * hl, by = y2 - uy * hl;
  return `<g ${extra}><path d="M${f(x1)} ${f(y1)} L${f(bx)} ${f(by)}" stroke="${color}" stroke-width="${f(w)}" fill="none"/>` +
    `<path d="M${f(x2)} ${f(y2)} L${f(bx - uy * hw)} ${f(by + ux * hw)} L${f(bx + uy * hw)} ${f(by - ux * hw)} Z" fill="${color}"/></g>`;
}
// The ghost of an arrow: a dashed outline at its normal width.
function ghostArrow(x1, y1, x2, y2, w, extra = '') {
  if (w <= 0.05) return '';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hl = Math.min(L * .55, w * 1.1 + 6), hw = w * 1.05 + 4, bx = x2 - ux * hl, by = y2 - uy * hl, h = w / 2;
  const pts = [[x1 - uy * h, y1 + ux * h], [bx - uy * h, by + ux * h], [bx - uy * hw, by + ux * hw], [x2, y2], [bx + uy * hw, by - ux * hw], [bx + uy * h, by - ux * h], [x1 + uy * h, y1 - ux * h]];
  return `<path ${extra} d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".8"/>`;
}

/* The body strip: gut, liver, blood, tissues and kidneys, with arrows whose widths follow the model. */
const STRIP_H = 190;
const BOX = { gut: [8, 56, 92, 58, GUT, 'gut'], liver: [130, 56, 86, 58, LIVER, 'liver'], blood: [246, 40, 106, 90, BLOOD, 'blood'], tissues: [380, 20, 92, 56, TISSUE, 'tissues'], kidneys: [380, 96, 92, 54, KIDNEY, 'kidneys'] };
const BLOOD_SLOTS = (() => {
  const s = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) s.push([258 + c * 13 + (r % 2) * 6, 70 + r * 15]);
  let seed = 11;
  for (let i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
})();
const drugDot = (x, y, extra = 'data-drug') => `<circle ${extra} cx="${f(x)}" cy="${f(y)}" r="4.4" fill="${BLUE}" stroke="#fff" stroke-width="1.2"/>`;
// Arrow widths from the model, so the strip changes with each drug or disease.
function widths(p) {
  const oral = 1 - p.iv;
  return {
    swallow: oral > 0.03 ? 2 + 4 * oral : 0,
    absorb: oral > 0.03 ? clamp(1.5 + 4 * oral * Math.min(1, p.ka / 0.7), 1.5, 7) : 0,
    pass: oral > 0.03 ? clamp(1.5 + 7 * p.F * oral, 1.5, 9) : 0,
    broken: clamp(1.5 + 6 * ((1 - p.F) * oral * 0.8 + p.CLh * 0.6), 1.5, 11),
    cleared: clamp(1.5 + 7 * p.CLh, 1.2, 11),
    kidney: clamp(1.5 + 7 * p.CLr, 1.2, 11),
    vein: p.iv > 0.02 ? 2 + 5 * p.iv : 0,
    spread: clamp(1.2 + 2.2 * p.Vd, 1.2, 8)
  };
}
const ARROWS = {
  swallow: [54, 4, 54, 54], absorb: [100, 85, 128, 85], pass: [216, 72, 244, 72], cleared: [244, 104, 218, 104],
  broken: [173, 116, 173, 152], vein: [299, 2, 299, 38], spreadOut: [354, 56, 378, 50], spreadBack: [378, 66, 354, 72],
  kidney: [354, 112, 378, 118], urine: [426, 152, 426, 182]
};
const ARROW_COL = { swallow: AMBER, absorb: AMBER, pass: BLUE, cleared: INK, broken: INK, vein: BLUE, spreadOut: MUTED, spreadBack: MUTED, kidney: INK, urine: INK };
const ARROW_W = { spreadOut: 'spread', spreadBack: 'spread', urine: 'kidney' };
const ARROW_GROUP = { swallow: 'absorb', absorb: 'absorb', pass: 'absorb', broken: 'firstpass', cleared: 'remove', kidney: 'remove', urine: 'remove', spreadOut: 'spread', spreadBack: 'spread', vein: 'absorb' };
const ALL_STRIP = ['absorb', 'firstpass', 'spread', 'remove'];
function strip(p, opt = {}) {
  const { show = ALL_STRIP, ghost = null, dots = 8, labels = 'plain', hi = '' } = opt;
  const w = widths(p), gw = ghost ? widths(ghost) : null;
  let b = '';
  for (const [k, [x, y, bw, bh, fill, name]] of Object.entries(BOX)) {
    const on = hi === k;
    b += `<rect data-box="${k}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="${fill}" stroke="${on ? BLUE : INK}" stroke-width="${on ? 3.5 : 1.6}"/>`;
    b += text(x + bw / 2, k === 'blood' ? y + 20 : y + bh / 2 + 6, name, `sm b${k === 'blood' ? ' red' : ''}`);
  }
  BLOOD_SLOTS.slice(0, clamp(Math.round(dots), 0, BLOOD_SLOTS.length)).forEach(([x, y]) => { b += drugDot(x, y); });
  for (const [k, [x1, y1, x2, y2]] of Object.entries(ARROWS)) {
    const grp = ARROW_GROUP[k], wk = ARROW_W[k] || k;
    if (!show.includes(grp)) continue;
    if (gw && gw[wk] > 0.05 && Math.abs(gw[wk] - w[wk]) > 0.3) b += ghostArrow(x1, y1, x2, y2, gw[wk], `data-ghost-arrow="${k}"`);
    b += arrow(x1, y1, x2, y2, w[wk], ARROW_COL[k], `data-arrow="${k}" data-w="${f(w[wk])}"`);
  }
  if (w.vein > 0 || (gw && gw.vein > 0)) b += text(310, 14, 'into a vein', 'xs b blue', 'start');
  if (show.includes('absorb') && w.swallow > 0) b += text(66, 22, 'swallowed', 'xs b amber', 'start');
  if (labels === 'journey') {
    b += text(114, 134, 'taken in', 'xs muted') + text(354, 18, 'spreads', 'xs muted', 'middle');
    b += text(173, 172, 'broken down', 'xs muted') + text(414, 178, 'sent out', 'xs muted', 'end');
  } else {
    if (show.includes('firstpass')) b += text(173, 172, 'broken down', 'xs b');
    if (show.includes('remove')) b += text(228, 148, 'cleared', 'xs b', 'middle') + text(414, 178, 'urine', 'xs b', 'end');
    if (labels === 'pass') b += text(240, 46, 'reaches blood', 'xs b blue', 'end');
  }
  return b;
}

/* The graph: level in the blood against time. */
const GX0 = 34, GX1 = 466;
function frame(top, span, ymax) {
  const PT = top + 40, PB = top + 238;
  return { top, PT, PB, span, ymax, xOf: t => GX0 + t / span * (GX1 - GX0), yOf: c => PB - clamp(c / ymax, 0, 1.06) * (PB - PT) };
}
function pathOf(p, fr) {
  return PK.curve(p, fr.span).map(([t, c], i) => `${i ? 'L' : 'M'}${f(fr.xOf(t))} ${f(fr.yOf(c))}`).join(' ');
}
function curveSvg(p, fr, kind, extra = '') {
  const d = pathOf(p, fr);
  if (kind === 'ghost') return `<path ${extra} d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".75"/>`;
  if (kind === 'dotted') return `<path ${extra} d="${d}" fill="none" stroke="${MUTED}" stroke-width="2.4" stroke-dasharray="1 5" stroke-linecap="round"/>`;
  if (kind === 'faint') return `<path ${extra} d="${d}" fill="none" stroke="${RULE}" stroke-width="1.6"/>`;
  return `<path ${extra} d="${d}" fill="none" stroke="${BLUE}" stroke-width="3.2" stroke-linejoin="round"/>`;
}
function axes(fr, opt = {}) {
  let b = '';
  if (opt.band) {
    const y1 = fr.yOf(RANGE[1]), y0 = fr.yOf(RANGE[0]);
    b += `<rect data-band x="${GX0}" y="${f(y1)}" width="${GX1 - GX0}" height="${f(y0 - y1)}" fill="${BANDF}"/>`;
    b += `<path d="M${GX0} ${f(y1)} H${GX1} M${GX0} ${f(y0)} H${GX1}" stroke="${AMBER}" stroke-width="1" opacity=".55"/>`;
    if (opt.bandWords) b += text(GX0 + 8, y1 + 17, 'working range', 'xs b amber', 'start') + text(GX1 - 6, y1 - 7, 'too much: harms', 'xs muted', 'end') + text(GX1 - 6, y0 + 19, 'too little to work', 'xs muted', 'end');
  }
  b += `<path d="M${GX0} ${fr.PT - 8} V${fr.PB} H${GX1}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  b += text(8, fr.top + 14, '↑ level in the blood', 'xs b', 'start') + text(GX1, fr.PB + 22, 'time →', 'xs b', 'end');
  return b;
}
const tri = (x, y) => `<path d="M${f(x - 5.5)} ${f(y)} L${f(x + 5.5)} ${f(y)} L${f(x)} ${f(y + 9)} Z" fill="${AMBER}"/>`;
function doseMarks(p, fr) {
  const ts = PK.doseTimes(p, fr.span), y = fr.top + 22;
  let b = '';
  if (ts.length > 40) ts.forEach(t => { b += `<path data-given d="M${f(fr.xOf(t))} ${y} V${y + 8}" stroke="${AMBER}" stroke-width="1.4"/>`; });
  else ts.forEach(t => { b += `<g data-given>${tri(fr.xOf(t), y)}</g>`; });
  if (ts.length === 1) b += text(fr.xOf(ts[0]) + 10, y + 9, 'given once', 'xs b amber', 'start');
  return b;
}
function ssMark(s, fr, kind) {
  if (s.ssTime > fr.span) return '';
  const x = fr.xOf(s.ssTime);
  if (kind === 'ghost') return `<path data-ss-mark="ghost" d="M${f(x)} ${fr.PT - 4} V${fr.PB}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 4"/>`;
  return `<path data-ss-mark="main" d="M${f(x)} ${fr.PT - 4} V${fr.PB}" stroke="${BLUE}" stroke-width="1.6"/>`;
}
function ssLabel(s, fr, words = 'steady state') {
  if (s.ssTime > fr.span) return '';
  const x = fr.xOf(s.ssTime), right = x < 330;
  return text(right ? x + 6 : x - 6, fr.PB - 8, words, 'xs b blue', right ? 'start' : 'end');
}
function keyRow(items, y) {
  let x = 10, row = 0, out = '';
  for (const [icon, word] of items) {
    const w = 40 + word.length * 7.9;
    if (x > 10 && x + w > 474) { x = 10; row++; }
    out += `<g transform="translate(${f(x)} ${y + row * 26})">${icon}${text(40, 5, word, 'xs', 'start')}</g>`;
    x += w + 12;
  }
  return { body: out, rows: row + 1 };
}
const KEY = {
  curve: [`<path d="M0 0 H32" stroke="${BLUE}" stroke-width="3.2"/>`, 'blood level'],
  normal: [`<path d="M0 0 H32" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5" opacity=".75"/>`, 'normal'],
  band: [`<rect x="0" y="-7" width="32" height="14" fill="${BANDF}" stroke="${AMBER}" stroke-width="1"/>`, 'working range'],
  given: [`<g>${tri(16, -5)}</g>`, 'amount given'],
  drug: [drugDot(16, 0, ''), 'drug in the blood'],
  sample: [`<circle cx="16" cy="0" r="5.5" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`, 'one blood test']
};
function withKey(body, bottom, items) {
  if (!items.length) return { body, h: bottom };
  const k = keyRow(items, bottom + 14);
  return { body: body + k.body, h: bottom + 30 + 26 * (k.rows - 1) };
}

/* ---------- Words ---------- */
function rangeWords(s) {
  const [lo, hi] = RANGE;
  if (s.noRemoval) return 'keeps climbing with every amount and never settles, because nothing removes the drug';
  if (s.trough > hi) return 'stays above the working range';
  if (s.peak < lo) return 'stays below the working range';
  if (s.peak > hi && s.trough < lo) return 'swings both above and below the working range';
  if (s.peak > hi) return 'peaks above the working range';
  if (s.trough < lo) return 'dips below the working range';
  return 'stays inside the working range';
}
/* Compare one measure with normal. A measure that does not exist (no removal: no half-life, no steady state, no
   plateau, never falls) is never compared as a number: it gets its own words, and two missing ones are "neither". */
function more(a, b, up, down, none) {
  const fa = Number.isFinite(a), fb = Number.isFinite(b);
  if (!fa && !fb) return [`${none}, in both`, 'none'];
  if (!fa) return [none, 'none'];
  if (!fb) return ['exists here, not in normal', 'up'];
  const r = (a + 1e-6) / (b + 1e-6);
  return r > 1.03 ? [up, 'up'] : r < 0.97 ? [down, 'down'] : ['about the same', 'same'];
}
// Measures for amounts given at regular intervals, and the ones that apply to a single amount.
const ROWS_REPEAT = [['plateau', 'Steady-state level', 'higher', 'lower', 'none: it keeps climbing'], ['peak', 'Highest level', 'higher', 'lower', 'none: it keeps climbing'], ['half', 'Half-life', 'longer', 'shorter', 'none: nothing removes the drug'], ['ssUsual', 'Time to steady state', 'later', 'sooner', 'never: there is no steady state'], ['f', 'Share reaching the blood', 'more', 'less', 'none']];
const ROWS_ONCE = [['peak', 'Highest level', 'higher', 'lower', 'none'], ['peakAt', 'Time of the peak', 'later', 'sooner', 'none: it never stops rising'], ['half', 'Half-life', 'longer', 'shorter', 'none: nothing removes the drug'], ['fall', 'Time to fall nearly to nothing', 'later', 'sooner', 'never: the level does not fall'], ['f', 'Share reaching the blood', 'more', 'less', 'none']];
const compare = (s, ref) => (s.single ? ROWS_ONCE : ROWS_REPEAT).map(([k, name, up, down, none]) => [name, more(s[k], ref[k], up, down, none)]);
const ARROW_TXT = { up: '↑', down: '↓', same: '↔', none: '—' };
const readout = (s, ref, head) => `<ul class="readout" aria-label="${esc(head)}"><li class="head">${head}</li>${compare(s, ref).map(([k, [w, d]]) => `<li><b>${k}</b> <span class="${d}">${ARROW_TXT[d]} ${w}</span></li>`).join('')}</ul>`;
const describe = (s, ref) => compare(s, ref).map(([k, [w]]) => `${k.toLowerCase()}: ${w}`).join('; ');
const ATTR_KEYS = ['peak', 'plateau', 'trough', 'half', 'ssUsual', 'f'];
const num4 = x => Number.isFinite(x) ? x.toFixed(4) : 'none';
const attrs = s => ATTR_KEYS.map(k => `data-${k.toLowerCase()}="${num4(s[k])}"`).join(' ');

/* ---------- A full state picture: strip, then the repeated-amount curve over a dashed normal ghost ---------- */
function dotsFor(s, ref) { return 8 * (ref.plateau > 0 ? s.plateau / ref.plateau : s.peak / ref.peak); }
function statePicture(label, cur, opt = {}) {
  const { ghost = null, legend = '', span = SPAN_REP, ymax = Y_REP, keyMeasures = false } = opt;
  const s = PK.summary(cur), gs = ghost ? PK.summary(ghost) : null;
  const ref = gs || NS;
  let b = strip(cur, { ghost, dots: dotsFor(s, ref), labels: keyMeasures ? 'pass' : 'plain' });
  const fr = frame(STRIP_H + 2, span, ymax);
  b += axes(fr, { band: true });
  b += doseMarks(cur, fr);
  if (ghost) b += `<g class="ghost" data-ghost="normal" ${attrs(gs)}>${curveSvg(ghost, fr, 'ghost')}${cur.repeat ? ssMark(gs, fr, 'ghost') : ''}</g>`;
  b += `<g data-new-state="${esc(legend || 'current')}" ${attrs(s)}>${curveSvg(cur, fr, 'main')}${cur.repeat ? ssMark(s, fr, 'main') + ssLabel(s, fr, ghost ? 'steady state' : 'steady state reached') : ''}</g>`;
  if (keyMeasures) {
    const y = fr.yOf(s.plateau);
    b += `<path d="M${f(fr.xOf(s.ssTime))} ${f(y)} H${GX1}" stroke="${BLUE}" stroke-width="1.6" stroke-dasharray="2 3"/>` + text(GX1 - 6, f(y - 8), 'steady-state level', 'xs b blue', 'end');
    b += `<rect data-key-measures x="${GX0 + 10}" y="${fr.PT - 2}" width="182" height="64" fill="#fff" stroke="${BLUE}" stroke-width="2.5"/>`;
    b += text(GX0 + 20, fr.PT + 16, 'key measures', 'xs b blue', 'start') + text(GX0 + 20, fr.PT + 34, 'share reaching blood', 'xs', 'start') + text(GX0 + 20, fr.PT + 52, 'half-life · steady state', 'xs', 'start');
  }
  const items = [KEY.curve];
  if (ghost) items.push(KEY.normal);
  items.push(KEY.band, KEY.given, KEY.drug);
  if (legend) items[0] = [KEY.curve[0], legend];
  const o = withKey(b, fr.PB + 30, items);
  return svg(label, o.body, o.h);
}

/* ---------- Core step pictures ---------- */
function journey() {
  let b = strip(NORMAL_P, { labels: 'journey' });
  const chips = [['taken in', AMBER], ['spread out', MUTED], ['broken down', INK], ['sent out', INK]];
  const y = 214;
  b += text(8, y - 6, 'four things happen to every drug', 'xs b muted', 'start');
  chips.forEach(([w, col], i) => {
    const x = 8 + i * 120;
    b += `<rect data-stage x="${x}" y="${y}" width="104" height="38" rx="19" fill="${CHIP}" stroke="${col}" stroke-width="2"/>` + text(x + 52, y + 25, w, 'xs b');
    if (i < 3) b += arrow(x + 106, y + 19, x + 119, y + 19, 2, MUTED);
  });
  return svg('The body as five connected boxes. A swallowed drug enters the gut at the left, passes to the liver, and reaches the blood in the middle, where blue dots stand for drug. From the blood, drug spreads into the body tissues at the top right, returns to the liver to be broken down, and passes to the kidneys at the bottom right, which send it out in urine. Under the boxes, four stages are linked by arrows: taken in, spread out, broken down, sent out.', b, 266);
}
const SAMPLE_T = [1, 3, 6, 10, 15, 21, 28];
function levelPic() {
  let b = strip(NORMAL_P, { show: [], hi: 'blood' });
  const fr = frame(STRIP_H + 2, SPAN_ONE, Y_ONE);
  b += axes(fr);
  b += curveSvg(ONCE, fr, 'faint');
  SAMPLE_T.forEach(t => { b += `<circle data-sample cx="${f(fr.xOf(t))}" cy="${f(fr.yOf(PK.level(ONCE, t)))}" r="6" fill="${RED}" stroke="#fff" stroke-width="1.6"/>`; });
  b += `<path d="M299 132 C300 150 ${f(fr.xOf(3))} ${fr.top + 10} ${f(fr.xOf(3))} ${f(fr.yOf(PK.level(ONCE, 3)) - 10)}" fill="none" stroke="${RED}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  b += text(fr.xOf(10) + 10, fr.yOf(PK.level(ONCE, 10)) - 14, 'each mark: one blood test', 'xs b red', 'start');
  const o = withKey(b, fr.PB + 30, [KEY.sample, KEY.drug]);
  return svg('The body boxes again, with the blood box outlined in blue and drug dots inside it. Below, an empty graph: level in the blood upward, time to the right. Red marks, one per blood test, rise quickly at first, then sink slowly, and a faint line joins them into a curve.', o.body, o.h);
}
function oncePic(kind) {
  const show = { absorb: ['absorb'], firstpass: ['absorb', 'firstpass'], spread: ['absorb', 'firstpass', 'spread'], remove: ALL_STRIP }[kind];
  let b = strip(ONCE, { show, labels: kind === 'firstpass' ? 'pass' : 'plain', hi: { absorb: 'gut', firstpass: 'liver', spread: 'tissues', remove: 'kidneys' }[kind] });
  const fr = frame(STRIP_H + 2, SPAN_ONE, Y_ONE), s = PK.summary(ONCE);
  b += axes(fr) + doseMarks(ONCE, fr);
  const px = fr.xOf(s.peakAt), py = fr.yOf(s.peak);
  let label = '';
  if (kind === 'firstpass') {
    const all = PK.build('normal', { repeat: 0, F: 1 }), sa = PK.summary(all);
    b += curveSvg(all, fr, 'dotted', 'data-alt="none-lost"') + text(fr.xOf(sa.peakAt) + 12, fr.yOf(sa.peak) - 4, 'if none were lost', 'xs b muted', 'start');
    label = 'The body boxes, with the liver outlined. A thick arrow takes drug from the gut into the liver; a thinner blue arrow labelled reaches blood carries on into the blood, and a dark arrow down from the liver, labelled broken down, carries away the share lost on the first pass. On the graph, the solid curve sits below a dotted curve labelled if none were lost.';
  } else if (kind === 'spread') {
    const wide = PK.build('normal', { repeat: 0, Vd: 2.2 }), sw = PK.summary(wide);
    b += curveSvg(wide, fr, 'dotted', 'data-alt="wide"') + text(fr.xOf(sw.peakAt + 8), fr.yOf(PK.level(wide, sw.peakAt + 8)) + 22, 'if it spread more widely', 'xs b muted', 'start');
    label = 'The body boxes, with the tissues outlined. Grey arrows carry drug from the blood out into the tissues and back. On the graph, a dotted curve labelled if it spread more widely rises to a lower peak than the solid curve, then falls more slowly, so later on it crosses the solid curve and stays above it in a longer tail.';
  } else if (kind === 'absorb') {
    b += arrow(px - 60, fr.yOf(s.peak * 0.25), px - 10, py + 8, 2, AMBER) + text(px - 2, fr.yOf(s.peak * 0.16), 'drug comes in faster', 'xs b amber', 'start') + text(px - 2, fr.yOf(s.peak * 0.16) + 17, 'than it leaves: climbs', 'xs b amber', 'start');
    label = 'The body boxes, with the gut outlined. An amber arrow labelled swallowed drops a drug into the gut, and amber arrows carry it through the liver into the blood. On the graph the blood level climbs steeply after the amount is given, reaches a rounded peak, then slowly falls.';
  } else {
    const t1 = s.peakAt + 9, t2 = s.peakAt + 21;
    b += arrow(fr.xOf(t1), fr.yOf(PK.level(ONCE, t1)) - 16, fr.xOf(t2), fr.yOf(PK.level(ONCE, t2)) - 14, 2, INK) + text(fr.xOf(t1) + 8, fr.yOf(PK.level(ONCE, t1)) - 30, 'removal wins: falls', 'xs b', 'start');
    label = 'The body boxes, with the kidneys outlined. Dark arrows clear drug from the blood back into the liver, where it is broken down, and into the kidneys, which send it out in urine. On the graph, after the peak, an arrow follows the curve as removal wins and the level falls.';
  }
  b += `<circle cx="${f(px)}" cy="${f(py)}" r="4" fill="${INK}"/>` + text(px, py - 12, 'peak', 'xs b');
  b += curveSvg(ONCE, fr, 'main');
  const items = [KEY.curve, KEY.given];
  if (kind === 'firstpass' || kind === 'spread') items.push([`<path d="M0 0 H32" stroke="${MUTED}" stroke-width="2.4" stroke-dasharray="1 5" stroke-linecap="round"/>`, kind === 'firstpass' ? 'if none were lost' : 'spread more widely']);
  const o = withKey(b, fr.PB + 30, items);
  return svg(label, o.body, o.h);
}
function halfLifePic() {
  const span = 32, fr = frame(6, span, Y_ONE * 0.62);
  let b = axes(fr) + doseMarks(ONCE, fr) + curveSvg(ONCE, fr, 'main');
  const words = ['start', 'half', 'a quarter', 'an eighth'];
  const t0 = 6, H = PK.H0;
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * H, c = PK.level(ONCE, t), x = fr.xOf(t), y = fr.yOf(c);
    b += `<path data-halving d="M${GX0} ${f(y)} H${f(x)}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="2 3"/>`;
    b += `<circle cx="${f(x)}" cy="${f(y)}" r="5.5" fill="${INK}" stroke="#fff" stroke-width="1.5"/>` + text(x + 8, y - 10, words[i], 'xs b', 'start');
    if (i < 3) {
      const xa = fr.xOf(t), xb = fr.xOf(t + H), yb = fr.PB + 12;
      b += `<path data-bracket d="M${f(xa + 2)} ${yb - 6} V${yb} H${f(xb - 2)} V${yb - 6}" fill="none" stroke="${BLUE}" stroke-width="2"/>` + text((xa + xb) / 2, yb + 18, 'half-life', 'xs b blue');
    }
  }
  const o = withKey(b, fr.PB + 40, [KEY.curve, KEY.given]);
  return svg('A graph of the blood level after one amount, falling after its peak. Four dots sit on the falling curve, labelled start, half, a quarter and an eighth, each joined to the level axis by a dotted line. Under the time axis, three equal blue brackets, each labelled half-life, span the gaps between the dots: every half-life the level halves again.', o.body, o.h);
}
function gonePic() {
  const top = 6, PT = top + 40, PB = top + 250, x0 = 40, bw = 56, gap = 16;
  let b = `<path d="M${x0 - 6} ${PT - 8} V${PB} H468" fill="none" stroke="${INK}" stroke-width="2"/>` + text(8, top + 14, '↑ drug left in the body', 'xs b', 'start');
  for (let i = 0; i < 6; i++) {
    const x = x0 + 6 + i * (bw + gap), hFull = PB - PT, h = hFull / Math.pow(2, i);
    b += `<rect x="${f(x)}" y="${PT}" width="${bw}" height="${f(hFull)}" fill="none" stroke="${RULE}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    b += `<rect data-bar="${i}" x="${f(x)}" y="${f(PB - h)}" width="${bw}" height="${f(h)}" fill="${BLUE}"/>`;
    if (i === 0) b += text(x + bw / 2, PT - 6, 'start', 'xs b');
  }
  const xr = x0 + 6 + 4 * (bw + gap);
  b += `<path d="M${f(xr)} ${PB - 40} H${f(xr + 2 * bw + gap)}" stroke="${AMBER}" stroke-width="2"/>` + text(xr + bw + gap / 2, PB - 48, 'almost all gone', 'xs b amber');
  b += text(468, PB + 22, 'each bar: one more half-life →', 'xs b', 'end');
  const o = withKey(b, PB + 30, [[`<rect x="0" y="-7" width="32" height="14" fill="${BLUE}"/>`, 'drug left'], [`<rect x="0" y="-7" width="32" height="14" fill="none" stroke="${RULE}" stroke-width="1.5" stroke-dasharray="4 3"/>`, 'already removed']]);
  return svg('Six bars in a row, each standing for one more half-life. The first is full height, labelled start; each next bar is half as tall as the one before, inside a dashed outline of the full bar showing what has been removed. The last two bars are tiny, labelled almost all gone.', o.body, o.h);
}
function repeatPic(kind) {
  const s = NS;
  let b = strip(NORMAL_P, { dots: 8 });
  const fr = frame(STRIP_H + 2, SPAN_REP, Y_REP);
  b += axes(fr, { band: kind === 'range' || kind === 'whole', bandWords: kind === 'range' }) + doseMarks(NORMAL_P, fr);
  let label;
  if (kind === 'buildup') {
    const tr = [1, 2, 3, 4].map(n => [fr.xOf(n * NORMAL_P.tau - 0.02), fr.yOf(PK.level(NORMAL_P, n * NORMAL_P.tau - 0.02))]);
    b += arrow(tr[0][0], tr[0][1] + 18, tr[3][0], tr[3][1] + 16, 2.4, AMBER, 'data-buildup') + text(tr[1][0], tr[1][1] + 44, 'each low point higher: builds up', 'xs b amber', 'start');
    label = 'A graph of the blood level when the same amount is given at regular times, marked by amber triangles along the top. After each amount the level rises and falls, but each new rise starts from a higher low point, and an amber arrow along the low points shows the level building up, more slowly each time.';
  } else {
    const y = fr.yOf(s.plateau);
    b += `<path data-plateau d="M${f(fr.xOf(s.ssTime))} ${f(y)} H${GX1}" stroke="${BLUE}" stroke-width="1.8" stroke-dasharray="2 3"/>`;
    if (kind === 'steady') b += text(GX1 - 6, f(fr.yOf(s.peak) - 12), 'plateau', 'xs b blue', 'end');
    b += ssMark(s, fr, 'main') + ssLabel(s, fr, 'steady state reached');
    label = kind === 'steady'
      ? 'The same graph of regular amounts. The rises and falls build up, then level off: from a blue line marked steady state reached, the curve rises and falls around a flat dotted plateau line instead of climbing further.'
      : 'The same graph, now with a pale amber band across the middle labelled working range, with too much: harms above it and too little to work below it. Once steady state is reached, the curve rises and falls inside the band, never peaking above it or dipping below it.';
  }
  b += curveSvg(NORMAL_P, fr, 'main');
  const items = [KEY.curve, KEY.given];
  if (kind === 'range') items.push(KEY.band);
  const o = withKey(b, fr.PB + 30, items);
  return svg(label, o.body, o.h);
}
const CORE = {
  journey, level: levelPic,
  absorb: () => oncePic('absorb'), firstpass: () => oncePic('firstpass'), spread: () => oncePic('spread'), remove: () => oncePic('remove'),
  halflife: halfLifePic, gone: gonePic,
  buildup: () => repeatPic('buildup'), steady: () => repeatPic('steady'), range: () => repeatPic('range'),
  whole: () => statePicture(`The whole picture. The body boxes show drug swallowed into the gut, partly broken down by the liver on the first pass, the rest reaching the blood, spreading into the tissues and being cleared by the liver and kidneys. Below, regular amounts build up to a steady state that ${rangeWords(NS)}, with a dotted steady-state level line. A blue box lists the key measures: the share reaching the blood, the half-life and the steady state.`, NORMAL_P, { keyMeasures: true })
};

/* ---------- What changes it ---------- */
const CHANGES = {
  inducer: { to: PK.build('inducer'), legend: 'with an enzyme inducer' },
  inhibitor: { to: PK.build('inhibitor'), legend: 'with an enzyme inhibitor' },
  kidney: { to: PK.build('kidney'), legend: 'with weaker kidneys' },
  iv: { to: PK.build('iv'), legend: 'into a vein' }
};
const CHANGE_WHERE = {
  inducer: 'In the body boxes, the liver’s clearing and breakdown arrows thicken past their dashed normal outlines, and the arrow from the liver into the blood thins. On the graph the solid curve settles sooner, at a lower plateau, under the dashed normal curve.',
  inhibitor: 'In the body boxes, the liver’s clearing and breakdown arrows thin inside their dashed normal outlines, and the arrow from the liver into the blood thickens. On the graph the solid curve keeps climbing for longer and settles later, at a higher plateau, above the dashed normal curve.',
  kidney: 'In the body boxes, the arrows into the kidneys and out in urine thin inside their dashed normal outlines; the liver arrows are unchanged. On the graph the solid curve keeps climbing for longer and settles later, at a higher plateau, above the dashed normal curve.',
  iv: 'In the body boxes, a new blue arrow feeds the drug straight into the blood, while the gut, absorption and first-pass arrows fade away; the clearing arrows stay on their dashed normal outlines. On the graph each amount now makes the solid curve jump straight up to a higher peak, then fall at the same pace as the dashed normal curve.'
};
const DURATION = 2200;
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function changePicture(el, t) {
  const kind = el.dataset.kind, c = CHANGES[kind];
  const cur = PK.mix(NORMAL_P, c.to, ease(t)), s = PK.summary(cur);
  const name = el.dataset.stepTitle.split(':')[0];
  const label = `${name}, drawn over faint dashed marks for normal. ${CHANGE_WHERE[kind]} The new curve ${rangeWords(s)}. Compared with normal: ${describe(s, NS)}.`;
  return { pic: statePicture(label, cur, { ghost: NORMAL_P, legend: c.legend }), ro: readout(s, NS, 'Compared with normal') };
}

const steps = $$('[data-step]');
const backBtn = $('[data-step-back]'), nextBtn = $('[data-step-next]'), progress = $('[data-step-progress]');
let current = 0, frameId = 0;
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
  cancelAnimationFrame(frameId);
  if (reducedMotion()) { drawAt(el, 1); return; }
  let start = null;
  drawAt(el, 0);
  const tick = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / DURATION);
    drawAt(el, t);
    if (t < 1) frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
}
let started = false;
function startLesson() {
  steps.forEach(el => {
    const k = el.dataset.kind;
    if (CORE[k]) visualOf(el).innerHTML = CORE[k]();
    if (isAnimated(el)) drawAt(el, 1);
    el.querySelector('.replay')?.addEventListener('click', () => animate(el));
  });
  started = true;
  if (/^#step-\d+$/.test(location.hash)) fromHash(); else showStep(current);
}
function showStep(n, focus = false) {
  if (!started) return;
  cancelAnimationFrame(frameId);
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
  if (tab.id === 'tab-lesson') { if (started && isAnimated(steps[current])) drawAt(steps[current], 1); } else cancelAnimationFrame(frameId);
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

const levelWords = v => v < 0.05 ? 'none' : v < 0.6 ? 'low' : v < 0.9 ? 'a little low' : v <= 1.1 ? 'normal' : v <= 1.8 ? 'raised' : 'high';

/* ---------- Clinical values ----------
   Every reference number comes from clinical-values.json. The model's live value for each row is read from the
   teaching model: how much it has removed after so many usual half-lives, how many usual half-lives it takes to
   reach steady state, and the share of each amount that reaches the blood. Always labelled as a model value. */
let data = null;
// How many usual half-lives a "removed after" row is read at comes from the row itself in clinical-values.json:
// a single count, or the middle of a quoted span.
const afterOf = v => { const a = v.after || {}; return Number.isFinite(a.halfLives) ? a.halfLives : (a.low + a.high) / 2; };
const VALUE_OF = {
  removedAfter: (s, v) => 100 * s.removed(afterOf(v)),
  steadyHalfLives: s => s.ssUsual,
  bioavailability: s => 100 * s.f
};
const validValue = v => VALUE_OF[v.modelKey] && (hasRange(v) || Number.isFinite(v.typical)) && (v.modelKey !== 'removedAfter' || Number.isFinite(afterOf(v)));
const DIRECTION = { up: '↑ Expected increase', down: '↓ Expected decrease', none: '↔ No change expected', variable: '↕ Variable' };
const hasRange = v => Number.isFinite(v.low) && Number.isFinite(v.high);
const SCALE = v => v.unit === '%' ? [0, 100] : [0, 10];
const barX = (v, n) => { const [a, b] = SCALE(v); return f(20 + clamp((n - a) / (b - a), 0, 1) * 360); };
const fmt = (v, n) => v.unit === '%' ? `${n.toFixed(n > 98 && n < 99.95 ? 1 : 0)}%` : `${n.toFixed(1)} ${v.unit}`;
function placeOf(v, n) {
  if (hasRange(v)) return n > v.high + 1e-9 ? 'above' : n < v.low - 1e-9 ? 'below' : 'inside';
  const [a, b] = SCALE(v), tol = 0.02 * (b - a);
  return Math.abs(n - v.typical) <= tol ? 'near' : n > v.typical ? 'above' : 'below';
}
const PLACE_WORDS = { inside: 'inside typical range', above: 'above typical range', below: 'below typical range' };
const placeText = (v, w) => { const ref = `the ${v.referenceLabel || 'typical value'}`; return hasRange(v) ? PLACE_WORDS[w] : w === 'near' ? `close to ${ref}` : `${w} ${ref}`; };
const PLACE_ARROW = { inside: '↔', near: '↔', above: '↑', below: '↓' };
const cv = { state: 'normal', clear: 1, custom: false };
const cvParams = () => { const p = PK.build(cv.state); return { ...p, CLh: p.CLh * cv.clear, CLr: p.CLr * cv.clear }; };
function updateClinical() {
  $('#clinical-clear').value = cv.clear; $('#clinical-clear-label').textContent = levelWords(cv.clear);
  const cur = cvParams(), s = PK.summary(cur);
  const st = data?.states.find(x => x.id === cv.state);
  const compared = st || cv.custom;
  const label = `Illustrative model${st ? `, set to ${st.label}` : ''}${cv.custom ? ' and adjusted by hand' : ''}${compared ? ', drawn over a faint dashed curve for normal' : ''}. Given at regular times, the curve ${rangeWords(s)}.${compared ? ` Compared with normal: ${describe(s, NS)}.` : ''}`;
  const legend = cv.custom ? 'these settings' : st ? st.label.split(' (')[0].toLowerCase() : '';
  $('#clinical-visual').innerHTML = statePicture(label, cur, { ghost: compared ? NORMAL_P : null, legend });
  if (!data) return;
  for (const v of data.values) {
    const row = document.querySelector(`[data-cv="${v.id}"]`);
    if (!row) continue;
    const d = st?.shifts[v.id], dir = row.querySelector('.direction');
    const notStated = st && !d;
    dir.textContent = st ? (d ? `${DIRECTION[d]}, compared with ${st.comparedWith}` : 'Not stated in the source: no arrow is shown, and the model holds this value where it was') : '';
    dir.classList.toggle('quiet', !d || d === 'none');
    row.querySelector('.evidence').textContent = st && st.evidence?.[v.id] ? `Why: ${st.evidence[v.id]}` : '';
    row.dataset.notStated = notStated ? '1' : '0';
    const n = VALUE_OF[v.modelKey](s, v), w = placeOf(v, n);
    row.querySelector('.reading').textContent = `${PLACE_ARROW[w]} ${fmt(v, n)}`;
    const x = barX(v, n), marker = row.querySelector('.marker');
    marker.setAttribute('x1', x); marker.setAttribute('x2', x);
    row.querySelector('.status').textContent = `Illustrative teaching-model value, not a measurement and not from the source: ${placeText(v, w)}`;
    const cmp = row.querySelector('.compare'), cm = row.querySelector('.cmp-marker');
    if (st && !cv.custom) {
      const n0 = VALUE_OF[v.modelKey](NS, v), rx = barX(v, n0);
      cmp.textContent = `Dashed line: model, normal by mouth (${fmt(v, n0)}, ${placeText(v, placeOf(v, n0))})`;
      cm.setAttribute('x1', rx); cm.setAttribute('x2', rx); cm.removeAttribute('visibility');
    } else { cmp.textContent = ''; cm.setAttribute('visibility', 'hidden'); }
  }
}
function setState(id) {
  cv.state = id; cv.custom = false; cv.clear = 1;
  $('#clinical-state').value = id;
  const s = data?.states.find(x => x.id === id);
  $('#state-summary').textContent = s ? `${s.label}: ${s.summary} The model now shows this.${s.modelNote ? ' ' + s.modelNote : ''}` : 'Normal teaching baseline, by mouth.';
  $('#state-source').textContent = s ? `Source: ${s.where} [${s.source}]` : '';
  updateClinical(); announce();
}
$('#clinical-state').addEventListener('change', e => setState(e.target.value));
$('#clinical-reset').addEventListener('click', () => setState('normal'));
$('#clinical-clear').addEventListener('input', e => {
  cv.clear = Number(e.target.value); cv.custom = true;
  const s = data?.states.find(x => x.id === cv.state);
  $('#state-summary').textContent = s ? `Custom settings: ${s.label} with the model’s clearance adjusted by hand. The arrows still describe ${s.label} alone.` : 'Custom model settings: clearance adjusted by hand.';
  updateClinical(); announce();
});
let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!data) return;
    const s = PK.summary(cvParams());
    $('#cv-live').textContent = `Illustrative model: ${data.values.map(v => { const n = VALUE_OF[v.modelKey](s, v); return `${v.label} ${fmt(v, n)}, ${placeText(v, placeOf(v, n))}`; }).join('; ')}.`;
  }, 400);
}

/* ---------- Explore freely ---------- */
const EX_KEYS = ['tau', 'ka', 'F', 'Vd', 'CLh', 'CLr'];
let ex = { ...NORMAL_P };
const EX_WORDS = {
  tau: v => `${v} model hours`,
  ka: v => v < 0.3 ? 'slow' : v < 1.2 ? 'medium' : 'fast',
  F: v => `${Math.round(v * 100)}%`,
  Vd: v => v < 0.8 ? 'narrowly' : v <= 1.3 ? 'normally' : v <= 2 ? 'widely' : 'very widely',
  CLh: v => levelWords(v / 0.5), CLr: v => levelWords(v / 0.5)
};
const n2 = x => x.toFixed(2), n1 = x => x.toFixed(1);
function updateExplore() {
  for (const k of EX_KEYS) { $('#' + k).value = ex[k]; $(`#${k}-label`).textContent = EX_WORDS[k](ex[k]); }
  $$('input[name=route]').forEach(r => { r.checked = (r.value === 'iv') === (ex.iv > 0.5); });
  $$('input[name=schedule]').forEach(r => { r.checked = (r.value === 'repeat') === Boolean(ex.repeat); });
  const oral = ex.iv < 0.5;
  $('#ka').disabled = !oral; $('#F').disabled = !oral; $('#tau').disabled = !ex.repeat;
  const s = PK.summary(ex);
  const ghost = PK.build('normal', { repeat: ex.repeat });
  const gs = PK.summary(ghost);
  const span = ex.repeat ? clamp(Math.max(SPAN_REP, s.ssTime * 1.3), SPAN_REP, 240) : clamp(Math.max(SPAN_ONE, s.fall * 1.15), SPAN_ONE, 240);
  const drawnPeak = Math.max(...PK.curve(ex, span).map(([, c]) => c));
  const ymax = Math.max(ex.repeat ? Y_REP : Y_ONE, drawnPeak * 1.12);
  const label = `Illustrative model of your settings, drawn over a faint dashed curve for the normal teaching drug. ${ex.repeat ? `Given at regular times, the curve ${rangeWords(s)}.` : 'Given once.'} Compared with normal: ${describe(s, gs)}.`;
  $('#explore-visual').innerHTML = statePicture(label, ex, { ghost, legend: 'your settings', span, ymax }) + readout(s, gs, 'Compared with normal');
  const res = $('#model-results');
  const head = 'Illustrative model output, in model hours and model units (not a real drug):';
  const shareText = `share reaching the blood ${Math.round(100 * s.f)}%`;
  const common = `half-life ${n1(s.half)} model hours · ${shareText}`;   // only used when the drug is removed (finite half-life)
  const fall = `${Math.round(100 * PK.SS_GAP)}`;
  if (s.noRemoval) {
    res.textContent = ex.repeat
      ? `${head} no removal: liver and kidney clearance are both zero, so there is no half-life and no steady state. Each amount adds to what is already there and the level keeps climbing for as long as the drug is given · ${shareText}.`
      : `${head} no removal: liver and kidney clearance are both zero, so there is no half-life. The level rises to about ${n2(s.peak)} model units and stays there; it never falls · ${shareText}.`;
  } else {
    res.textContent = ex.repeat
      ? `${head} ${common} · steady state after about ${n1(s.ssTime)} model hours (${n1(s.ssUsual)} usual half-lives), counting the time absorption takes · plateau between ${n2(s.trough)} and ${n2(s.peak)} model units, average ${n2(s.plateau)} · the curve ${rangeWords(s)}.`
      : `${head} ${common} · highest level ${n2(s.peak)} model units, ${n1(s.peakAt)} model hours after it is given · below ${fall}% of that peak about ${n1(s.fall)} model hours after it is given, read off the curve itself, so absorption still going on is counted.`;
  }
  Object.assign(res.dataset, { half: num4(s.half), ss: num4(s.ssUsual), f: num4(s.f), plateau: num4(s.plateau), peak: num4(s.peak), noRemoval: s.noRemoval ? '1' : '0' });
}
for (const k of EX_KEYS) $('#' + k).addEventListener('input', e => { ex[k] = Number(e.target.value); updateExplore(); });
$$('input[name=route]').forEach(r => r.addEventListener('change', () => { ex.iv = r.value === 'iv' ? 1 : 0; updateExplore(); }));
$$('input[name=schedule]').forEach(r => r.addEventListener('change', () => { ex.repeat = r.value === 'repeat' ? 1 : 0; updateExplore(); }));
$('#preset').addEventListener('change', e => { ex = PK.build(e.target.value, { repeat: ex.repeat }); updateExplore(); });
$('#reset').addEventListener('click', () => { ex = { ...NORMAL_P }; $('#preset').value = 'normal'; updateExplore(); });

/* ---------- Reference data ---------- */
const clinicalControls = $$('#clinical select, #clinical input, #clinical button');
clinicalControls.forEach(el => { el.disabled = true; });
async function load() {
  try {
    const res = await fetch('./clinical-values.json');
    if (!res.ok) throw new Error('Reference file unavailable');
    const loaded = await res.json();
    if (!Array.isArray(loaded.values) || !loaded.values.every(validValue)) throw new Error('Invalid reference data');
    data = loaded;
    $('#disclaimer').textContent = data.disclaimer;
    $('#baseline-note').textContent = 'At the teaching baseline the four half-life rows sit on their reference values, because the model removes drug in the same first-order way the chapter describes. The bioavailability row is different: its reference is for the intravenous route, and the baseline gives the drug by mouth, so its marker sits below that value. Choose the intravenous route to see it reach the reference. How far each state moves the model is an illustrative choice; only the directions come from the quoted text.';
    for (const st of data.states) { const opt = document.createElement('option'); opt.value = st.id; opt.textContent = st.label; $('#clinical-state').append(opt); }
    for (const v of data.values) {
      const pos = n => barX(v, n);
      const row = document.createElement('div');
      row.className = 'value-row'; row.dataset.cv = v.id;
      const left = document.createElement('div');
      left.innerHTML = '<h3></h3><div class="reading"></div><div class="status"></div><div class="compare"></div><div class="direction"></div>';
      left.querySelector('h3').textContent = `${v.label} (${v.unit})`;
      const right = document.createElement('div');
      const [a, b] = SCALE(v);
      // Reference labels under the bar; a narrow band gets one "low–high" label, and an end label too close to one is dropped.
      const narrow = hasRange(v) && pos(v.high) - pos(v.low) < 40;
      const refLabels = hasRange(v)
        ? (narrow ? [[(pos(v.low) + pos(v.high)) / 2, `${v.low}–${v.high}`, 'middle']] : [[pos(v.low), v.low, 'end'], [pos(v.high), v.high, 'start']])
        : [[pos(v.typical), v.typical, 'middle']];
      const ref = (hasRange(v)
        ? `<rect class="band" x="${pos(v.low)}" y="12" width="${f(pos(v.high) - pos(v.low))}" height="22"/><path class="limit" d="M${pos(v.low)} 6 V40 M${pos(v.high)} 6 V40"/>`
        : `<path class="typical" d="M${pos(v.typical)} 4 V42"/><path class="typical-tip" d="M${pos(v.typical) - 6} 4 H${pos(v.typical) + 6} L${pos(v.typical)} 12 Z"/>`) +
        refLabels.map(([x, t, anchor]) => `<text x="${f(x)}" y="58" text-anchor="${anchor}">${t}</text>`).join('');
      const marker = '<line class="cmp-marker" x1="20" x2="20" y1="2" y2="44" visibility="hidden"/><line class="marker" x1="20" x2="20" y1="4" y2="42"/>';
      const clear = x => refLabels.every(([rx, t]) => Math.abs(rx - x) > 18 + String(t).length * 5);
      const ends = (clear(20) ? `<text x="20" y="58" class="end">${a}</text>` : '') + (clear(380) ? `<text x="380" y="58" text-anchor="end" class="end">${b}</text>` : '');
      right.innerHTML = `<svg class="gauge" viewBox="0 0 400 62" role="img"><path class="track" d="M20 23 H380"/>${ref}${marker}${ends}</svg><div class="key"></div>`;
      const refName = v.referenceLabel || 'typical value';
      const refWords = hasRange(v) ? `the source range ${v.low}–${v.high} ${v.unit} as a shaded band` : `the source’s ${refName} ${v.typical}${v.unit === '%' ? '%' : ' ' + v.unit} as a black mark`;
      right.querySelector('svg').setAttribute('aria-label', `${v.label}: ${refWords}, a blue marker for where the illustrative model sits and, when a state is compared, a dashed marker for the normal model`);
      right.querySelector('.key').textContent = hasRange(v) ? `Source range ${v.low}–${v.high} ${v.unit} (shaded) · blue line: illustrative teaching-model value` : `Source ${refName} ${v.typical}${v.unit === '%' ? '%' : ' ' + v.unit} (black mark; the source gives no range) · blue line: illustrative teaching-model value${v.referenceLabel ? ' for the route in use' : ''}`;
      const ev = document.createElement('div'); ev.className = 'evidence';
      const cite = document.createElement('div'); cite.className = 'citation';
      cite.textContent = `${v.where} [${v.source}]${v.note ? ' · ' + v.note : ''}`;
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
    $('#load-error').textContent = 'The reference file did not load. Reload the page to try again; the lesson and Explore freely still work on the illustrative model.';
  }
  startLesson();
  updateClinical();
  updateExplore();
}
load();
