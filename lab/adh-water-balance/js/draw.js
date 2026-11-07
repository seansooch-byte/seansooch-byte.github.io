// Small helpers for drawing the lesson's pictures as SVG strings, after the Lab kit's /lab/kit/draw.js
// (the same colours, type classes and arrowheads), as a classic script so the lesson also runs from a
// file. Every picture is 480 wide (in SVG user space); the kit's type classes (default 20, .sm 18, .xs 17) keep the
// smallest label readable on a phone.
(() => {
const C = {
  ink: '#171916', blue: '#254dff', red: '#b3261e', amber: '#a34700', green: '#2c6a2c',
  purple: '#6b3fa0', muted: '#53584d', rule: '#babeb3', panel: '#ecefe5', paper: '#f7f7f2',
  white: '#fff', blueWash: '#d1d8fd', redWash: '#f3d9d4', ghost: '#8a8f84',
};
const f = n => Number((+n).toFixed(1));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpObj = (a, b, t) => { const o = { ...a }; for (const k in b) if (typeof b[k] === 'number' && typeof a[k] === 'number') o[k] = lerp(a[k], b[k], t); return o; };
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const ease = Object.assign(x => easeOut(x), {
  out: easeOut,
  inOut: x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
});
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HEADS = { k: C.ink, b: C.blue, r: C.red, a: C.amber, g: C.green, p: C.purple, m: C.muted };
const KEY = Object.fromEntries(Object.entries(HEADS).map(([k, c]) => [c, k]));
let uid = 0;
// title: a short name for the picture; desc: what the finished picture shows. Both are read out.
function svg(title, desc, body, { h = 360, w = 480 } = {}) {
  const id = `adh${++uid}-`;
  const defs = `<defs>${Object.entries(HEADS).map(([k, c]) => `<marker id="${id}ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
  return `<svg viewBox="0 0 ${w} ${f(h)}" role="img" aria-labelledby="${id}t ${id}d"><title id="${id}t">${esc(title)}</title><desc id="${id}d">${esc(desc)}</desc>${defs}${body.replace(/url\(#ah-/g, `url(#${id}ah-`)}</svg>`;
}
const text = (x, y, s, cls = '', anchor = 'middle', extra = '') =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
const line = (x1, y1, x2, y2, col = C.ink, w = 2, extra = '') =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const circle = (x, y, r, fill = C.ink, stroke = 'none', w = 0, extra = '') =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
const rect = (x, y, w, h, fill = 'none', stroke = 'none', sw = 0, extra = '') =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const path = (d, stroke = C.ink, w = 2.5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const arrow = (d, col = C.ink, w = 2.5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${KEY[col] || 'k'})" ${extra}/>`;
const arrowTo = (x1, y1, x2, y2, col = C.ink, w = 2.5, extra = '') => arrow(`M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, col, w, extra);
const part = (name, body, extra = '') => `<g data-part="${name}" ${extra}>${body}</g>`;

const A = (window.ADH = window.ADH || {});
A.draw = { C, f, clamp, lerp, lerpObj, ease, span, esc, svg, text, line, circle, rect, path, arrow, arrowTo, part };
})();
