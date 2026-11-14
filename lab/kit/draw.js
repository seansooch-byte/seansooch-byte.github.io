// The Lab kit: small helpers for drawing lesson pictures as SVG strings.
// Every picture is 480 units wide (lab/FORMAT.md, "Pictures"), so type set with the kit's classes
// (default 20, .sm 18, .xs 17) reads at 12 px or more on a 375 px phone.
export const C = {
  ink: '#171916', blue: '#254dff', red: '#b3261e', amber: '#a34700', green: '#2c6a2c',
  purple: '#6b3fa0', muted: '#53584d', rule: '#babeb3', panel: '#ecefe5', paper: '#f7f7f2',
  white: '#fff', blueWash: '#d1d8fd', redWash: '#f3d9d4', ghost: '#8a8f84',
};
export const W = 480;
export const f = n => Number((+n).toFixed(1));
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpObj = (a, b, t) => { const o = { ...a }; for (const k in b) if (typeof b[k] === 'number' && typeof a[k] === 'number') o[k] = lerp(a[k], b[k], t); return o; };
// ease(x) is ease.out(x); ease.inOut(x) starts and ends gently.
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
export const ease = Object.assign(x => easeOut(x), {
  out: easeOut,
  inOut: x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
});
// A part of a timeline: where t sits between a and b, from 0 to 1.
export const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Arrowheads, one per colour. Each picture gets its own ids, because a marker referenced from a
// hidden step does not draw.
const HEADS = { k: C.ink, b: C.blue, r: C.red, a: C.amber, g: C.green, p: C.purple, m: C.muted };
const KEY = Object.fromEntries(Object.entries(HEADS).map(([k, c]) => [c, k]));
let uid = 0;
const ART_ID = /(?:id="|url\(#|href="#)ax-/, ART_IDS = /(id="|url\(#|href="#)ax-/g;
export function svg(label, body, { h = 360, w = W } = {}) {
  const id = `lx${++uid}-`;
  // ah-: heads that grow with the line; fh-: heads of one fixed size (12 units) whatever the line's width.
  const defs = `<defs>${Object.entries(HEADS).map(([k, c]) => `<marker id="${id}ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`
    + `<marker id="${id}fh-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
  let inner = body.replace(/url\(#(ah|fh)-/g, (_, m) => `url(#${id}${m}-`), art = '';
  // Art from /lab/kit/art/ uses ax- ids: they take this picture's prefix too, and the shared defs the body
  // uses are added by art/core.js (it sets globalThis.LabArtDefs when a lesson loads it). A body without
  // art ids comes out exactly as before.
  if (ART_ID.test(inner)) {
    if (typeof globalThis.LabArtDefs === 'function') art = globalThis.LabArtDefs(body, id);
    inner = inner.replace(ART_IDS, `$1${id}ax-`);
  }
  return `<svg viewBox="0 0 ${w} ${f(h)}" role="img" aria-label="${esc(label)}">${defs}${art}${inner}</svg>`;
}
export const text = (x, y, s, cls = '', anchor = 'middle', extra = '') =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${s}</text>`;
// Several lines of text, one under the other.
export const lines = (x, y, rows, cls = '', anchor = 'middle', lh = 22) =>
  rows.map((r, i) => text(x, y + i * lh, r, cls, anchor)).join('');
export const line = (x1, y1, x2, y2, col = C.ink, w = 2, extra = '') =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
export const circle = (x, y, r, fill = C.ink, stroke = 'none', w = 0, extra = '') =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
export const rect = (x, y, w, h, fill = 'none', stroke = 'none', sw = 0, extra = '') =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
export const path = (d, stroke = C.ink, w = 2.5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
// A closed or filled shape (path() above is always an unfilled line).
export const shape = (d, fill = C.panel, stroke = C.ink, w = 2, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
export const arrow = (d, col = C.ink, w = 2.5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${KEY[col] || 'k'})" ${extra}/>`;
export const arrowTo = (x1, y1, x2, y2, col = C.ink, w = 2.5, extra = '') => arrow(`M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, col, w, extra);
// The same, with a head of one fixed size, for thick arrows whose growing heads would swamp the picture.
export const arrowFixed = (d, col = C.ink, w = 2.5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#fh-${KEY[col] || 'k'})" ${extra}/>`;
// The dashed grey copy of the normal picture that a change is drawn over.
export const ghost = (body, extra = '') => `<g class="ghost" data-ghost="normal" ${extra}>${body}</g>`;
export const dashed = (d, col = C.ink, w = 2.5) => path(d, col, w, 'stroke-dasharray="6 5"');
// A named part, so a term in the caption can light it (data-part on the <dfn> and here).
export const part = (name, body, extra = '') => `<g data-part="${name}" ${extra}>${body}</g>`;
// A change named on the picture: an arrow and its words, e.g. "fills more".
export function delta(x1, y1, x2, y2, words, { col = C.blue, at = 'end', dx = 8, dy = 6, cls = 'sm b' } = {}) {
  const tx = at === 'end' ? x2 : (x1 + x2) / 2, ty = at === 'end' ? y2 : (y1 + y2) / 2;
  const anchor = x2 >= x1 ? 'start' : 'end';
  const tone = col === C.red ? 'red' : col === C.blue ? 'blue' : col === C.amber ? 'amber' : col === C.green ? 'green' : '';
  return `<g data-delta>${arrowTo(x1, y1, x2, y2, col, 3.5)}${text(tx + (anchor === 'start' ? dx : -dx), ty + dy, words, `${cls} ${tone}`, anchor)}</g>`;
}
// A key: [{ mark: 'dash' | 'line' | 'dot' | 'box', col, words }], laid left to right from x, wrapping at the right edge.
export function legend(x, y, items, { maxX = W - 12, gap = 22 } = {}) {
  let cx = x, row = 0, out = '';
  for (const it of items) {
    const w = 40 + it.words.length * 9.4;
    if (cx > x && cx + w > maxX) { cx = x; row++; }
    const yy = y + row * 28, col = it.col || C.ink;
    const mark = it.mark === 'dash' ? dashed(`M${cx} ${yy - 6} H${cx + 30}`, col)
      : it.mark === 'dot' ? circle(cx + 10, yy - 6, 7, col)
      : it.mark === 'box' ? rect(cx, yy - 15, 22, 18, it.fill || col, col, 1.5)
      : path(`M${cx} ${yy - 6} H${cx + 30}`, col, 5);
    out += mark + text(cx + (it.mark === 'dot' ? 24 : 38), yy, it.words, 'xs', 'start');
    cx += w + gap;
  }
  return { body: `<g data-legend>${out}</g>`, height: (row + 1) * 28 };
}
// A "compared with normal" list for under a picture: rows of [label, 'up' | 'down' | 'same', words].
const SIGN = { up: '↑', down: '↓', same: '↔' };
export const readout = (rows, head = 'Compared with normal') =>
  `<ul class="readout" aria-label="${esc(head)}"><li class="head">${esc(head)}</li>${rows.map(([k, d, w]) => `<li><b>${esc(k)}</b> <span class="${d}">${SIGN[d] || ''} ${esc(w)}</span></li>`).join('')}</ul>`;
