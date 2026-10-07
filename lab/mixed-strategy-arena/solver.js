// Mixed Strategy Arena: pure game-theory functions, no DOM.
// Exact zero-sum solver (dense-tableau simplex, Bland's rule), dominance,
// a seedable PRNG, the Markov opponent model and two learning dynamics.

export const EPS = 1e-9;
const TOL = 1e-6;

// mulberry32: small, fast, seedable PRNG returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleMix(p, rng) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i; }
  return p.length - 1;
}

// Row player maximises in canonical form.
export function canonical(matrix, rowMaximizes) {
  return rowMaximizes ? matrix.map(r => r.slice()) : matrix.map(r => r.map(v => -v));
}

function cleanMix(v) {
  const c = v.map(t => (Math.abs(t) < EPS || t < 0 ? 0 : t));
  const s = c.reduce((a, b) => a + b, 0);
  return s > 0 ? c.map(t => t / s) : c.map(() => 1 / c.length);
}

// Maximise sum(w) s.t. B w <= 1, w >= 0, B > 0. Returns primal w and dual u.
// The dual (minimise sum(u) s.t. B^T u >= 1) is read from the slack columns
// of the optimal objective row.
export function simplexMaxOnes(B) {
  const m = B.length, n = B[0].length, W = n + m + 1;
  const T = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(W).fill(0);
    for (let j = 0; j < n; j++) row[j] = B[i][j];
    row[n + i] = 1;
    row[W - 1] = 1;
    T.push(row);
  }
  const obj = new Array(W).fill(0);
  for (let j = 0; j < n; j++) obj[j] = -1;
  const basis = [];
  for (let i = 0; i < m; i++) basis.push(n + i);
  for (let iter = 0; iter < 500; iter++) {
    // Bland: lowest-index column with a negative reduced cost enters.
    let enter = -1;
    for (let j = 0; j < W - 1; j++) if (obj[j] < -EPS) { enter = j; break; }
    if (enter < 0) break;
    let leave = -1, best = Infinity;
    for (let i = 0; i < m; i++) {
      const a = T[i][enter];
      if (a > EPS) {
        const ratio = T[i][W - 1] / a;
        if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[leave])) { best = ratio; leave = i; }
      }
    }
    if (leave < 0) break; // unbounded cannot happen for B > 0
    const pr = T[leave], pv = pr[enter];
    for (let j = 0; j < W; j++) pr[j] /= pv;
    for (let i = 0; i < m; i++) {
      if (i === leave) continue;
      const f = T[i][enter];
      if (f !== 0) for (let j = 0; j < W; j++) T[i][j] -= f * pr[j];
    }
    const f = obj[enter];
    for (let j = 0; j < W; j++) obj[j] -= f * pr[j];
    basis[leave] = enter;
  }
  const w = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (basis[i] < n) w[basis[i]] = T[i][W - 1];
  const u = [];
  for (let i = 0; i < m; i++) u.push(obj[n + i]);
  return { w, u, total: obj[W - 1] };
}

export function rowPayoffs(A, y) { return A.map(r => r.reduce((s, v, j) => s + v * y[j], 0)); }
export function colPayoffs(A, x) { return A[0].map((_, j) => A.reduce((s, r, i) => s + r[j] * x[i], 0)); }

// solveZeroSum(matrix, rowMaximizes) -> {x, y, value, verified, ...}
// value is in the original orientation (what the row player gets/gives up).
export function solveZeroSum(matrix, rowMaximizes = true) {
  const A = canonical(matrix, rowMaximizes);
  // Scale to unit magnitude so the simplex tolerances are relative, not absolute.
  let mx = 0;
  for (const r of A) for (const v of r) mx = Math.max(mx, Math.abs(v));
  const scale = mx > 0 ? mx : 1;
  const S = A.map(r => r.map(v => v / scale));
  let mn = Infinity;
  for (const r of S) for (const v of r) mn = Math.min(mn, v);
  const k = 1 - mn;
  const B = S.map(r => r.map(v => v + k));
  const { w, u } = simplexMaxOnes(B);
  const su = u.reduce((a, b) => a + b, 0), sw = w.reduce((a, b) => a + b, 0);
  const x = cleanMix(u.map(t => t / su));
  const y = cleanMix(w.map(t => t / sw));
  // Value read back from the original matrix: the row mix's guarantee and the column mix's cap.
  const rowGuarantee = Math.min(...colPayoffs(A, x));
  const colGuarantee = Math.max(...rowPayoffs(A, y));
  const lpValue = (1 / su - k) * scale;
  const vCanon = Math.abs(rowGuarantee - colGuarantee) <= TOL * Math.max(1, scale) ? (rowGuarantee + colGuarantee) / 2 : lpValue;
  // Verify in original units; the 1e-6 tolerance is relative to the payoff scale for big numbers.
  const tol = TOL * Math.max(1, scale);
  const verified = Math.abs(rowGuarantee - vCanon) < tol && Math.abs(colGuarantee - vCanon) < tol && Math.abs(lpValue - vCanon) < tol;
  const value = rowMaximizes ? vCanon : -vCanon;
  // Degenerate ties: an unused action that still earns the value hints at more equilibria.
  const rp = rowPayoffs(A, y), cp = colPayoffs(A, x);
  const offRowTie = rp.some((v, i) => x[i] < TOL && Math.abs(v - vCanon) < tol);
  const offColTie = cp.some((v, j) => y[j] < TOL && Math.abs(v - vCanon) < tol);
  const saddle = x.some(t => t > 1 - TOL) && y.some(t => t > 1 - TOL);
  return { x, y, value: clean0(value), verified, notUnique: offRowTie || offColTie, saddle, rowGuarantee, colGuarantee };
}

function clean0(v) { return Math.abs(v) < 1e-12 ? 0 : v; }

// Strict dominance in the original matrix, respecting who maximises.
export function dominated(matrix, rowMaximizes) {
  const A = canonical(matrix, rowMaximizes);
  const m = A.length, n = A[0].length;
  const rows = [], cols = [];
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < m; k++) if (k !== i && A[k].every((v, j) => v > A[i][j])) { rows.push({ index: i, by: k }); break; }
  }
  for (let j = 0; j < n; j++) {
    for (let l = 0; l < n; l++) if (l !== j && A.every(r => r[l] < r[j])) { cols.push({ index: j, by: l }); break; }
  }
  return { rows, cols };
}

// Best guaranteed payoff for a row mix x (original orientation) and the column best response.
export function rowMixReport(matrix, rowMaximizes, x) {
  const cp = colPayoffs(matrix, x);
  let br = 0;
  for (let j = 1; j < cp.length; j++) if (rowMaximizes ? cp[j] < cp[br] : cp[j] > cp[br]) br = j;
  return { guaranteed: cp[br], bestResponse: br, payoffs: cp };
}

// Exploitability (duality gap) of a strategy pair in canonical form; >= 0, 0 at equilibrium.
export function exploitability(A, x, y) {
  return Math.max(...rowPayoffs(A, y)) - Math.min(...colPayoffs(A, x));
}

export function argmax(v) { let b = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[b] + 1e-12) b = i; return b; }
export function argmin(v) { let b = 0; for (let i = 1; i < v.length; i++) if (v[i] < v[b] - 1e-12) b = i; return b; }

// Markov predictor over a history of action indices with Laplace smoothing and backoff.
export function predictNext(history, n, order, alpha = 1, minObs = 3) {
  for (let k = Math.min(order, history.length); k >= 0; k--) {
    const ctx = history.slice(history.length - k).join(',');
    const counts = new Array(n).fill(0);
    let total = 0;
    for (let t = k; t < history.length; t++) {
      if (k === 0 || history.slice(t - k, t).join(',') === ctx) { counts[history[t]]++; total++; }
    }
    if (total >= minObs || k === 0) {
      return { q: counts.map(c => (c + alpha) / (total + alpha * n)), order: k, observations: total };
    }
  }
  return { q: new Array(n).fill(1 / n), order: 0, observations: 0 };
}

// The AI's move. aiIsRow: AI controls rows of canonical A (row maximises).
export function aiMove({ A, history, aiIsRow, eq, order, epsilon, rng }) {
  const nUser = aiIsRow ? A[0].length : A.length;
  if (history.length === 0) {
    return { action: sampleMix(eq, rng), predicted: null, q: null, mode: 'equilibrium' };
  }
  const { q } = predictNext(history, nUser, order);
  const predicted = argmax(q);
  if (rng() < epsilon) return { action: sampleMix(eq, rng), predicted, q, mode: 'equilibrium' };
  const action = aiIsRow ? argmax(rowPayoffs(A, q)) : argmin(colPayoffs(A, q));
  return { action, predicted, q, mode: 'exploit' };
}

// Learning dynamics on canonical A. Each returns a stateful stepper.
export function fictitiousPlay(A) {
  const m = A.length, n = A[0].length;
  const cx = new Array(m).fill(0), cy = new Array(n).fill(0);
  cx[0] = 1; cy[0] = 1;
  let t = 1;
  return {
    get t() { return t; },
    avg() { return { x: cx.map(c => c / t), y: cy.map(c => c / t) }; },
    step() {
      const { x, y } = this.avg();
      const i = argmax(rowPayoffs(A, y)), j = argmin(colPayoffs(A, x));
      cx[i]++; cy[j]++; t++;
    },
  };
}

export function regretMatching(A) {
  const m = A.length, n = A[0].length;
  const rx = new Array(m).fill(0), ry = new Array(n).fill(0);
  const sx = new Array(m).fill(0), sy = new Array(n).fill(0);
  let t = 0;
  const strat = r => { const p = r.map(v => Math.max(v, 0)); const s = p.reduce((a, b) => a + b, 0); return s > 0 ? p.map(v => v / s) : p.map(() => 1 / p.length); };
  // Start from a deliberately lopsided first strategy so the path is visible.
  rx[0] = 1e-3; ry[0] = 1e-3;
  return {
    get t() { return t; },
    avg() { return t === 0 ? { x: strat(rx), y: strat(ry) } : { x: sx.map(v => v / t), y: sy.map(v => v / t) }; },
    step() {
      const x = strat(rx), y = strat(ry);
      const ur = rowPayoffs(A, y), uc = colPayoffs(A, x);
      const v = ur.reduce((s, u, i) => s + u * x[i], 0);
      for (let i = 0; i < m; i++) rx[i] += ur[i] - v;
      for (let j = 0; j < n; j++) ry[j] += v - uc[j];
      for (let i = 0; i < m; i++) sx[i] += x[i];
      for (let j = 0; j < n; j++) sy[j] += y[j];
      t++;
    },
  };
}
