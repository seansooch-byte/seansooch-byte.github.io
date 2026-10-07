// Pressure–Volume Loop · The Lab
// A deterministic lumped model of the left ventricle: time-varying elastance
// (Suga & Sagawa), ideal-diode mitral and aortic valves with linear resistance,
// constant left atrial pressure, and a two-element Windkessel arterial load.

export const DT = 0.0005; // s, fixed RK4 step

// Tuned towards the typical adult values in clinical-values.json (EDV, ESV, EF,
// aortic pressures, atrial pressure). With filling at equilibrium, EDP is about the
// fixed atrial pressure, so it cannot also sit in the LVEDP range; the Clinical
// values tab says so.
export const DEFAULTS = Object.freeze({
  HR: 72,     // bpm
  Ees: 3.4,   // mmHg/mL
  V0: 10,     // mL
  A: 0.18,    // mmHg
  lam: 0.03,  // 1/mL
  Pla: 4,     // mmHg
  Rmv: 0.005, // mmHg·s/mL
  Rav: 0.01,  // mmHg·s/mL
  Rs: 1.2,    // mmHg·s/mL
  C: 1.4,     // mL/mmHg
});

export const INITIAL = Object.freeze({ V: 120, Pao: 80 });

export function timing(HR) {
  const T = 60 / HR;
  const Ts = Math.min(0.16 + 0.3 * T, 0.45 * T);
  return { T, Ts };
}

export function activation(tau, Ts) {
  return tau >= 0 && tau < Ts ? Math.sin(Math.PI * tau / Ts) : 0;
}

export const espvr = (V, p) => p.Ees * (V - p.V0);
export const edpvr = (V, p) => p.A * (Math.exp(p.lam * (V - p.V0)) - 1);

export function lvPressure(V, e, p) {
  const Vc = Math.max(V, p.V0 + 0.1);
  return e * espvr(Vc, p) + (1 - e) * edpvr(Vc, p);
}

// Right-hand side. Returns flows too, so the integrator can accumulate them.
function rhs(tau, V, Pao, p, Ts, out) {
  const e = activation(tau, Ts);
  const Plv = lvPressure(V, e, p);
  const Qmv = Math.max(0, (p.Pla - Plv) / p.Rmv);
  const Qav = Math.max(0, (Plv - Pao) / p.Rav);
  out.dV = Qmv - Qav;
  out.dP = (Qav - Pao / p.Rs) / p.C;
  out.Qmv = Qmv;
  out.Qav = Qav;
  return out;
}

const k1 = {}, k2 = {}, k3 = {}, k4 = {};

// Polygon area by the shoelace formula; positive when the points run counter-clockwise
// in a V-right, P-up frame.
export function shoelace(vs, ps, n = vs.length) {
  let s = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) s += vs[j] * ps[i] - vs[i] * ps[j];
  return s / 2;
}

// Valve events from flow transitions, anchored on peak LV pressure so the slow
// end of filling is never mistaken for mitral closure.
//   MC: mitral flow stops for good before the pressure peak
//   AO: aortic flow starts; AC: aortic flow stops; MO: mitral flow restarts.
function findEvents(c, n, t, V, P) {
  let iPk = 0;
  for (let i = 1; i < n; i++) if (P[i] > P[iPk]) iPk = i;
  const at = (kind, i) => ({ kind, i, t: t[i], V: V[i], P: P[i] });
  const out = [];
  let iMC = 0;
  for (let i = iPk; i >= 0; i--) if (c.mv[i]) { iMC = Math.min(i + 1, n - 1); break; }
  out.push(at('MC', iMC));
  let iAO = -1, iAC = -1;
  for (let i = iMC; i < n; i++) if (c.av[i]) { iAO = i; break; }
  if (iAO >= 0) {
    out.push(at('AO', iAO));
    for (let i = iAO; i < n; i++) if (!c.av[i]) { iAC = i; break; }
    if (iAC >= 0) out.push(at('AC', iAC));
  }
  for (let i = Math.max(iPk, iAC); i < n; i++) if (c.mv[i]) { out.push(at('MO', i)); break; }
  return out;
}

export class Simulator {
  constructor(params = DEFAULTS) {
    this.p = { ...params };
    this.reset();
  }

  reset() {
    this.V = INITIAL.V;
    this.Pao = INITIAL.Pao;
    this.tau = 0;
    this.time = 0;
    this.beatNo = 0;
    this.lastBeat = null;
    this.prevBeat = null;
    this._startBeat();
  }

  setParams(params) {
    this.p = { ...this.p, ...params };
    // A beat that straddles a change cannot count towards settling.
    this.cur.mixed = true;
  }

  _startBeat() {
    const { T, Ts } = timing(this.p.HR);
    const cap = Math.ceil(T / DT) + 8;
    this.cur = {
      T, Ts, n: 0,
      t: new Float32Array(cap), V: new Float64Array(cap), Plv: new Float64Array(cap),
      Pao: new Float32Array(cap), Pla: this.p.Pla,
      mv: new Uint8Array(cap), av: new Uint8Array(cap),
      EDV: this.V, intQmv: 0, intQav: 0,
      params: { ...this.p },
    };
    this._sample();
  }

  _sample() {
    const c = this.cur;
    if (c.n >= c.V.length) return;
    const e = activation(this.tau, c.Ts);
    const Plv = lvPressure(this.V, e, this.p);
    const Qmv = Math.max(0, (this.p.Pla - Plv) / this.p.Rmv);
    const Qav = Math.max(0, (Plv - this.Pao) / this.p.Rav);
    c.t[c.n] = this.tau; c.V[c.n] = this.V; c.Plv[c.n] = Plv; c.Pao[c.n] = this.Pao;
    c.mv[c.n] = Qmv > 0 ? 1 : 0; c.av[c.n] = Qav > 0 ? 1 : 0;
    c.n++;
    this.Plv = Plv; this.Qmv = Qmv; this.Qav = Qav;
  }

  // One RK4 step. Returns a finished beat record when a cycle completes, else null.
  // The last step of a cycle is shortened so it lands exactly on the boundary: the
  // next beat then starts at τ = 0 with zero activation, so EDV and EDP are sampled
  // at true end-diastole and no step integrates across two cycles.
  step() {
    const p = this.p, c = this.cur, Ts = c.Ts;
    const tau = this.tau, V = this.V, P = this.Pao;
    const h = Math.min(DT, c.T - tau);
    rhs(tau, V, P, p, Ts, k1);
    rhs(tau + h / 2, V + h / 2 * k1.dV, P + h / 2 * k1.dP, p, Ts, k2);
    rhs(tau + h / 2, V + h / 2 * k2.dV, P + h / 2 * k2.dP, p, Ts, k3);
    rhs(tau + h, V + h * k3.dV, P + h * k3.dP, p, Ts, k4);
    this.V = V + h / 6 * (k1.dV + 2 * k2.dV + 2 * k3.dV + k4.dV);
    this.Pao = P + h / 6 * (k1.dP + 2 * k2.dP + 2 * k3.dP + k4.dP);
    // Flows integrated with the same weights, so ∫Qmv − ∫Qav equals the volume change exactly.
    c.intQmv += h / 6 * (k1.Qmv + 2 * k2.Qmv + 2 * k3.Qmv + k4.Qmv);
    c.intQav += h / 6 * (k1.Qav + 2 * k2.Qav + 2 * k3.Qav + k4.Qav);
    if (!Number.isFinite(this.V) || !Number.isFinite(this.Pao)) throw new RangeError('non-finite state');
    if (this.V < p.V0 + 0.1) this.V = p.V0 + 0.1;
    if (this.Pao < 0) this.Pao = 0;
    this.tau += h;
    this.time += h;
    if (this.tau >= c.T - 1e-9) {
      this.tau = 0;
      const beat = this._finishBeat();
      this._startBeat();
      return beat;
    }
    this._sample();
    return null;
  }

  _finishBeat() {
    const c = this.cur, n = c.n;
    const V = c.V.slice(0, n), Plv = c.Plv.slice(0, n), Pao = c.Pao.slice(0, n), t = c.t.slice(0, n);
    let iMin = 0, PaoMax = -Infinity, PaoMin = Infinity, PlvMax = -Infinity, PaoSum = 0;
    for (let i = 0; i < n; i++) {
      PaoSum += Pao[i];
      if (V[i] < V[iMin]) iMin = i;
      if (Pao[i] > PaoMax) PaoMax = Pao[i];
      if (Pao[i] < PaoMin) PaoMin = Pao[i];
      if (Plv[i] > PlvMax) PlvMax = Plv[i];
    }
    const pp = c.params;
    const EDV = c.EDV, ESV = V[iMin], SV = EDV - ESV;
    const events = findEvents(c, n, t, V, Plv);
    const ev = Object.fromEntries(events.map(e => [e.kind, e]));
    const ejected = !!ev.AO && SV > 0.05;
    const ESP = Plv[iMin];
    const signedArea = shoelace(V, Plv, n);
    // Volume change while both valves are shut (isovolumic contraction and relaxation).
    let isoDV = 0;
    if (ev.MC && ev.AO) isoDV = Math.max(isoDV, Math.abs(ev.AO.V - ev.MC.V));
    if (ev.AC && ev.MO) isoDV = Math.max(isoDV, Math.abs(ev.MO.V - ev.AC.V));
    const beat = {
      no: ++this.beatNo,
      T: c.T, Ts: c.Ts, HR: pp.HR, params: pp, n,
      t, V, Plv, Pao, Pla: c.Pla,
      EDV, ESV, SV: ejected ? SV : 0, ejected,
      EF: ejected && EDV > 0 ? SV / EDV : 0,
      CO: ejected ? SV * pp.HR / 1000 : 0,
      SW: Math.abs(signedArea), signedArea,
      ESP, iES: iMin,
      Ea: ejected && SV > 0.5 ? ESP / SV : null,
      PaoSys: PaoMax, PaoDia: PaoMin, PaoMean: n ? PaoSum / n : 0, PlvMax, EDP: Plv[0],
      intQmv: c.intQmv, intQav: c.intQav,
      massError: c.intQmv > 1e-6 ? Math.abs(c.intQmv - c.intQav) / c.intQmv : 0,
      isoDV,
      espvrGap: Math.abs(ESP - espvr(ESV, pp)),
      events,
      endV: this.V,
      mixed: !!c.mixed,
    };
    this.prevBeat = this.lastBeat;
    this.lastBeat = beat;
    beat.settled = !!this.prevBeat && !beat.mixed && !this.prevBeat.mixed &&
      Math.abs(beat.EDV - this.prevBeat.EDV) < 0.1 && Math.abs(beat.ESV - this.prevBeat.ESV) < 0.1;
    return beat;
  }

  // Run whole beats until the loop settles (or maxBeats). Returns the beats run.
  runBeats(count) {
    const out = [];
    while (out.length < count) {
      const b = this.step();
      if (b) out.push(b);
    }
    return out;
  }

  runToSteady(maxBeats = 200) {
    let b = null;
    for (let i = 0; i < maxBeats; i++) {
      b = this.runBeats(1)[0];
      if (b.settled) break;
    }
    return b;
  }
}
