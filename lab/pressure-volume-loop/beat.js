// Lesson 1's pictures, the arithmetic half: a beat as four edges of points, where a moment sits on the
// lap, what the valves are doing then, the phase word the readout shows, the state the left-heart art
// is set to, and a spot test that keeps the graph's words off the loops. Pure functions, no DOM, so
// tools/pv-beat-test.mjs runs them in node.
//
// Expected behaviour (tested by tools/pv-beat-test.mjs):
//   - lapAt(f) walks one lap in the teaching order fill, contract, eject, relax, covering [0, 1).
//   - moment() gives the dot's place, the volume and pressure there, how open each valve is, the
//     squeeze, and the flow through each valve. The squeeze begins as the mitral valve shuts at the
//     end of filling (where phaseOf already says Squeeze) and is continuous round the lap. Both valves are shut along the contract and relax
//     edges; each swings shut over the last 8 % of its own edge, as its flow fades.
//   - phaseOf(m) follows the valves, so the word never disagrees with the pills or the leaflets: it
//     says Filling only while the mitral valve shows open and Ejection only while the aortic valve
//     does; while both are shut it says Squeeze from the mitral valve shutting to the aortic valve
//     opening, and Relax from the aortic valve shutting to the mitral valve opening (so Squeeze at
//     the end-diastolic corner, Relax at the end-systolic one).
//   - heartState() is the state lab/kit/art/heart.js's set() takes, with a pressure fraction (0 to 1)
//     for its data-pressure hook, a flow phase that loops once per lap, and which normal outline a
//     change step shows (ref 0, the full size, while filling and squeezing; ref 1, the emptied size,
//     while ejecting and relaxing, and, given refMid, on into filling until the volume passes it).
//   - pickSpot() returns the first candidate word box clear of every line and box by the margin, and
//     inside the picture, or null.

// A beat as four edges, each resampled to a fixed number of points evenly spaced along the drawn line,
// so any two loops can be morphed point by point and edges can be drawn in turn.
const EDGES = [['contract', 'AO', 20], ['eject', 'AC', 56], ['relax', 'MO', 20], ['fill', null, 56]];
export function shape(b, { X, Y }) {
  const ev = Object.fromEntries(b.events.map(e => [e.kind, e.i]));
  const out = {};
  let from = 0;
  for (const [name, endKind, count] of EDGES) {
    const to = endKind ? ev[endKind] : b.n - 1;
    const xs = [], ys = [], cum = [0];
    for (let i = from; i <= to; i++) { xs.push(X(b.V[i])); ys.push(Y(b.Plv[i])); }
    for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const total = cum[cum.length - 1] || 1, pts = [];
    for (let k = 0, j = 0; k <= count; k++) {
      const s = total * k / count;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const span = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (s - cum[j]) / span));
      const j1 = Math.min(j + 1, xs.length - 1);
      pts.push([xs[j] + (xs[j1] - xs[j]) * t, ys[j] + (ys[j1] - ys[j]) * t]);
    }
    out[name] = pts;
    from = to;
  }
  return out;
}
export const LOOP_ORDER = ['fill', 'contract', 'eject', 'relax']; // teaching order: filling first
export const loopPoints = s => LOOP_ORDER.flatMap(k => s[k]);
export const ramp = x => Math.min(1, Math.max(0, x));

// One heartbeat, as a place on the loop. A slow lap gives each phase time to be seen: the two brief
// same-volume phases are held longer than they really last.
export const LAP = [['fill', 0.32], ['contract', 0.18], ['eject', 0.32], ['relax', 0.18]];
export function lapAt(f, first = 'fill') {
  let i = LAP.findIndex(l => l[0] === first);
  f = ((f % 1) + 1) % 1;
  for (let n = 0; n < 3; n++, i = (i + 1) % 4) {
    if (f < LAP[i][1]) break;
    f -= LAP[i][1];
  }
  return [LAP[i][0], Math.min(1, f / LAP[i][1])];
}
// Everything the pictures need to know about one moment: where the dot is, and from that the volume,
// the pressure, how far each valve is open and how hard the muscle is squeezing.
const EARLY = 0.15;
export function moment(s, edge, p, { VOL, PRS }) {
  const pts = s[edge], f = ramp(p) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
  // A valve swings open over the first 10 % of its edge and shut over the last 8 %, as its flow fades,
  // so it is already shut at the corner: pressure only rises or falls at one volume with both valves shut.
  const open = ramp(p / 0.1) * ramp((1 - p) / 0.08);
  return {
    x, y, edge, p: ramp(p), V: VOL(x), P: PRS(y),
    mitral: edge === 'fill' ? open : 0,
    aortic: edge === 'eject' ? open : 0,
    // the squeeze starts as the mitral valve shuts (the readout already says Squeeze there, phaseOf):
    // EARLY of it by the end of filling, the rest along the contract edge
    squeeze: edge === 'contract' ? EARLY + (1 - EARLY) * p : edge === 'eject' ? 1 : edge === 'relax' ? 1 - p : edge === 'fill' && p > 0.5 && open <= 0.5 ? Math.max(0.03, EARLY * (1 - 2 * open)) : 0,
    inflow: edge === 'fill' ? open : 0, outflow: edge === 'eject' ? open : 0,
  };
}
// The phase the valves show. Each valve is shut for the whole of both same-volume edges, so the word
// and the edge agree there. On a filling or ejection edge with both valves shut, the word depends on
// which end of the edge the dot is at: at the opening end it is still the phase before (Relax before
// filling, Squeeze before ejection); at the closing end it is already the phase after (Squeeze once
// the mitral valve has shut, Relax once the aortic valve has).
export function phaseOf(m) {
  if (m.mitral > 0.5) return 'fill';
  if (m.aortic > 0.5) return 'eject';
  const late = (m.p ?? 0) >= 0.5;
  if (m.edge === 'fill') return late ? 'contract' : 'relax';
  if (m.edge === 'eject') return late ? 'relax' : 'contract';
  return m.edge === 'relax' ? 'relax' : 'contract';
}
// The state lab/kit/art/heart.js's set() takes. The flow streamlines move 6 dash cycles per lap.
// refMid (mL, optional): the normal heart's mid volume, (EDV + ESV) / 2. While filling below it, a
// change step still shows the normal emptied outline, so at the end-systolic corner the cavity is
// compared with the normal emptied size, not the full one.
export function heartState(m, clock, { lapMs, pMax, refMid }) {
  const phase = ((clock / lapMs * 6) % 1 + 1) % 1;
  const ref = m.edge === 'eject' || m.edge === 'relax' || (m.edge === 'fill' && refMid != null && m.V < refMid) ? 1 : 0;
  return { volume: m.V, mitral: m.mitral, aortic: m.aortic, squeeze: m.squeeze, inflow: m.inflow, outflow: m.outflow, phase, pressure: ramp(m.P / pMax), ref };
}

// ---------- keeping words off the lines ----------
const segRect = ([ax, ay], [bx, by], [rx, ry, rw, rh]) => {
  // the distance from a segment to a rectangle (0 when they touch or cross)
  const inside = (x, y) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  if (inside(ax, ay) || inside(bx, by)) return 0;
  const cross = (p, q, r, s) => {
    const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return o(p, q, r) * o(p, q, s) <= 0 && o(r, s, p) * o(r, s, q) <= 0;
  };
  const c = [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]];
  for (let i = 0; i < 4; i++) if (cross([ax, ay], [bx, by], c[i], c[(i + 1) % 4])) return 0;
  const ptSeg = ([px, py], [x0, y0], [x1, y1]) => { const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)); return Math.hypot(px - x0 - dx * t, py - y0 - dy * t); };
  const ptRect = ([px, py]) => Math.hypot(Math.max(rx - px, 0, px - rx - rw), Math.max(ry - py, 0, py - ry - rh));
  return Math.min(ptRect([ax, ay]), ptRect([bx, by]), ...c.map(q => ptSeg(q, [ax, ay], [bx, by])));
};
/** Is the word box { x, y, w, h } (top-left) clear of every polyline and box by margin, and inside bounds [x0, y0, x1, y1]? */
export function spotClear({ x, y, w, h }, { lines = [], boxes = [], margin = 4, bounds } = {}) {
  if (bounds && (x < bounds[0] || y < bounds[1] || x + w > bounds[2] || y + h > bounds[3])) return false;
  for (const [bx, by, bw, bh] of boxes) if (x < bx + bw + margin && x + w + margin > bx && y < by + bh + margin && y + h + margin > by) return false;
  const r = [x, y, w, h];
  for (const pts of lines) for (let i = 1; i < pts.length; i++) if (segRect(pts[i - 1], pts[i], r) < margin) return false;
  return true;
}
/** The first spot that is clear, else null. */
export const pickSpot = (spots, obstacles) => spots.find(s => spotClear(s, obstacles)) || null;
