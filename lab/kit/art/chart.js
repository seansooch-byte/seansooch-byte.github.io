// Graph marks for The Lab (art direction section 4.14). Graphs stay model-driven: these helpers only
// standardise how the marks look. Every helper returns an SVG string; curveAttrs(role) gives the same
// styling as an attribute object, for lessons that build their graphs with their own DOM code.
//
// Expected behaviour (tested by tools/lab-art-test.mjs):
//   - axes: 1.5 ink lines with arrowheads, worded labels in kit classes, no gridlines.
//   - curve roles: live 4 (with a 2-unit panel underlay), ghost 3 dashed 6 5 in the graph ghost grey,
//     ref 1.5 ink, untreated dotted 2.5.
//   - loop: a closed live curve with a 6 to 8 % fill.
//   - changeArrow: a blue fixed-head arrow from the ghost to the new mark with its words at the end,
//     inside a data-delta group (the kit's change hook).
//   - valveEvent: a ring where a valve opens, a filled dot where it shuts.
import { P, f, pt, textWidth } from './core.js';

const INK = P.ui.ink, BLUE = P.ui.blue;
const ROLE = {
  live: { stroke: P.ui.red, 'stroke-width': 4 },
  ghost: { stroke: P.ui.ghost, 'stroke-width': 3, 'stroke-dasharray': '6 5' },
  ref: { stroke: INK, 'stroke-width': 1.5 },
  untreated: { stroke: INK, 'stroke-width': 2.5, 'stroke-dasharray': '0.1 5' },
};
const attrs = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
export const curveAttrs = (role = 'live', col) => ({ fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...ROLE[role], ...(col ? { stroke: col } : {}) });
const poly = (pts, close) => `M${pts.map(pt).join(' L')}${close ? ' Z' : ''}`;
// A filled arrowhead of one size at (x, y) pointing along angle a (radians).
const head = (x, y, a, col, size = 11) => `<path d="M${pt([x, y])} L${pt([x - size * Math.cos(a - 0.42), y - size * Math.sin(a - 0.42)])} L${pt([x - size * Math.cos(a + 0.42), y - size * Math.sin(a + 0.42)])} Z" fill="${col}"/>`;

/** Axes from the origin (x0, y0) to x1 (right) and y1 (top). ticks: { x: [[value, label, px]], y: [...] } in px. */
export function axes({ x0, y0, x1, y1, xLabel = '', yLabel = '', ticks = {}, arrows = true, cls = 'sm b' }) {
  let s = `<g class="ax-axes"><path d="M${f(x0)} ${f(y0)} L${f(x1 - (arrows ? 9 : 0))} ${f(y0)}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="square"/><path d="M${f(x0)} ${f(y0)} L${f(x0)} ${f(y1 + (arrows ? 9 : 0))}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="square"/>`;
  if (arrows) s += head(x1, y0, 0, INK) + head(x0, y1, -Math.PI / 2, INK);
  for (const [, label, px] of ticks.x || []) s += `<path d="M${f(px)} ${f(y0)} L${f(px)} ${f(y0 + 5)}" stroke="${INK}" stroke-width="1.5"/><text x="${f(px)}" y="${f(y0 + 22)}" text-anchor="middle" class="xs">${label}</text>`;
  for (const [, label, py] of ticks.y || []) s += `<path d="M${f(x0 - 5)} ${f(py)} L${f(x0)} ${f(py)}" stroke="${INK}" stroke-width="1.5"/><text x="${f(x0 - 9)}" y="${f(py + 6)}" text-anchor="end" class="xs">${label}</text>`;
  if (xLabel) s += `<text x="${f(x1)}" y="${f(y0 + 28)}" text-anchor="end" class="${cls}">${xLabel}</text>`;
  if (yLabel) s += `<text x="${f(x0 + 14)}" y="${f(y1 + 6)}" text-anchor="start" class="${cls}">${yLabel}</text>`;
  return s + '</g>';
}
/** A curve through points, styled by role ('live' | 'ghost' | 'ref' | 'untreated'). */
export function curve(pts, { role = 'live', col, close = false, extra = '' } = {}) {
  const d = poly(pts, close), a = curveAttrs(role, col);
  const under = role === 'live' ? `<path d="${d}" fill="none" stroke="${P.ui.panel}" stroke-width="${a['stroke-width'] + 4}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  return `${under}<path d="${d}" ${attrs(a)} ${extra}/>`;
}
/** A closed loop (a pressure-volume loop): live stroke, a light fill (6 to 8 %) giving it body. */
export function loop(pts, { role = 'live', col, fill = true, extra = '' } = {}) {
  const d = poly(pts, true), a = curveAttrs(role, col);
  const body = fill && role === 'live' ? `<path d="${d}" fill="${a.stroke}" fill-opacity=".07" stroke="none"/>` : '';
  return body + curve(pts, { role, col, close: true, extra });
}
/** Fill under a curve to baseY (10 to 14 %). */
export const areaFill = (pts, baseY, col = P.ui.red, opacity = 0.12) =>
  `<path d="${poly(pts)} L${f(pts[pts.length - 1][0])} ${f(baseY)} L${f(pts[0][0])} ${f(baseY)} Z" fill="${col}" fill-opacity="${opacity}" stroke="none"/>`;
/** The shaded change between a ghost curve and the new one. */
export const betweenFill = (a, b, col = BLUE, opacity = 0.12) => `<path d="${poly([...a, ...[...b].reverse()], true)}" fill="${col}" fill-opacity="${opacity}" stroke="none"/>`;
/** A named change: a blue arrow of fixed head size from the ghost to the new mark, its words placed at
 *  its end, else below it, else above it: the first spot that stays inside the picture (8 to W - 8) and
 *  clear of every keepOut box [x, y, w, h] (the loops' and ghost's boxes, other words). place: 'end' |
 *  'below' | 'above' forces one. */
export function changeArrow(from, to, words, { side, col = BLUE, cls = 'sm b blue', gap = 8, keepOut = [], W = 480, place } = {}) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]), end = [to[0] - 9 * Math.cos(a), to[1] - 9 * Math.sin(a)];
  const right = side ? side === 'right' : to[0] >= from[0], tw = textWidth(words, cls), size = /\bxs\b/.test(cls) ? 17 : /\bsm\b/.test(cls) ? 18 : 20;
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], lo = Math.max(from[1], to[1]), hi = Math.min(from[1], to[1]);
  const spots = [
    [right ? to[0] + gap : to[0] - gap - tw, to[1] + size * 0.35, right ? 'start' : 'end'],
    [mid[0] - tw / 2, lo + 8 + size * 0.8, 'middle'],
    [mid[0] - tw / 2, hi - 8, 'middle'],
  ];
  const fits = ([x, y]) => x >= 8 && x + tw <= W - 8 && !keepOut.some(([kx, ky, kw, kh]) => x < kx + kw + 4 && x + tw + 4 > kx && y - size * 0.8 < ky + kh + 4 && y + 4 > ky);
  const forced = { end: 0, below: 1, above: 2 }[place];
  const [bx, by, anchor] = forced != null ? spots[forced] : spots.find(fits) || spots[1];
  const tx = anchor === 'start' ? bx : anchor === 'end' ? bx + tw : bx + tw / 2;
  return `<g data-delta><path d="M${pt(from)} L${pt(end)}" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>${head(to[0], to[1], a, col, 12)}`
    + `<text x="${f(tx)}" y="${f(by)}" text-anchor="${anchor}" class="${cls}">${words}</text></g>`;
}
/** A label at a curve's end with a short leader, never on the curve. */
export function endLabel(pts, words, { col = INK, cls = 'sm b', dx = 10 } = {}) {
  const [x, y] = pts[pts.length - 1];
  return `<path d="M${pt([x + 2, y])} L${pt([x + dx - 3, y])}" stroke="${col}" stroke-width="1.25"/><text x="${f(x + dx)}" y="${f(y + 6)}" class="${cls}">${words}</text>`;
}
/** A marker: dot (r 5 with a 1-unit highlight), ring or pin. */
export function marker(x, y, { kind = 'dot', col = P.ui.red, r = 5 } = {}) {
  if (kind === 'ring') return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${P.ui.panel}" stroke="${col}" stroke-width="2.5"/>`;
  if (kind === 'pin') return `<path d="M${f(x)} ${f(y)} L${f(x)} ${f(y - 14)}" stroke="${col}" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y - 16)}" r="${r}" fill="${col}"/>`;
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${col}" stroke="${P.ui.white}" stroke-width="2.5"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="1" fill="${P.ui.white}" fill-opacity=".6"/>`;
}
/** A valve event at a loop corner: a ring where a valve opens, a filled dot where it shuts. */
export const valveEvent = (x, y, opens, { col = INK } = {}) => opens
  ? `<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="none" stroke="${col}" stroke-width="2.5"/>`
  : `<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="${col}"/>`;
/** A bar (model height h, from its base at y), with a dashed ghost bar inset 2 units so strokes never coincide. */
export function bar({ x, y, w, h, ghostH, col = P.ui.red, rounded = true }) {
  const r = rounded ? Math.min(4, w / 4) : 0;
  let s = `<rect x="${f(x)}" y="${f(y - h)}" width="${f(w)}" height="${f(Math.max(0, h))}" rx="${r}" fill="${col}"/>`;
  if (ghostH != null) s += `<rect x="${f(x + 2)}" y="${f(y - ghostH + 2)}" width="${f(w - 4)}" height="${f(Math.max(0, ghostH - 2))}" rx="${r}" fill="none" stroke="${P.ui.ghost}" stroke-width="2" stroke-dasharray="5 3"/>`;
  return s;
}
/** A range band (healthy or working range), its label inside the band. */
export function band({ x0, x1, y0, y1, col = P.ui.green, label, cls = 'xs green' }) {
  let s = `<rect x="${f(x0)}" y="${f(Math.min(y0, y1))}" width="${f(x1 - x0)}" height="${f(Math.abs(y1 - y0))}" fill="${col}" fill-opacity=".1"/>`;
  if (label) s += `<text x="${f(x0 + 6)}" y="${f(Math.min(y0, y1) + 18)}" class="${cls}">${label}</text>`;
  return s;
}
/** Bracket with end ticks and words above it (stroke volume and the like). */
export function bracket(x0, x1, y, words, { col = INK, cls = 'sm b' } = {}) {
  const w = textWidth(words, cls);
  return `<path d="M${f(x0)} ${f(y + 6)} L${f(x0)} ${f(y)} L${f(x1)} ${f(y)} L${f(x1)} ${f(y + 6)}" fill="none" stroke="${col}" stroke-width="1.5"/><text x="${f((x0 + x1) / 2)}" y="${f(y - 8)}" text-anchor="middle" class="${cls}" data-w="${w}">${words}</text>`;
}
