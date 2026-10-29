'use strict';
/* An illustrative teaching model of one parietal cell, settled (no time course).
   Every output is relative to the normal body (1), except gastricPH and bloodPH, which are offsets from the middle of
   the reference ranges loaded from clinical-values.json (mid is passed in; nothing clinical is hard-coded here). */
window.GastricModel = (() => {
  const NORMAL = { hist: 1, gastrin: 1, ach: 1, pg: 1, ppi: 0, h2: 0, antacid: 0, pgDrug: 0, sys: 0, vomit: 0 };
  // Each drug changes one step of the chain; sizes are illustrative choices only.
  const DRUGS = {
    ppi: p => ({ ...p, ppi: 0.97 }),          // share of working pumps locked
    h2: p => ({ ...p, h2: 0.9 }),             // share of H2 receptors plugged
    antacid: p => ({ ...p, antacid: 0.8 }),   // share of stomach acid neutralised
    pga: p => ({ ...p, pgDrug: 1.4 })         // extra prostaglandin signal
  };
  const STATES = {
    normal: p => p,
    'antacid-excess': p => ({ ...p, antacid: 0.8, sys: 1 }),
    vomiting: p => ({ ...p, vomit: 0.85 })
  };
  const REST = 0.4;   // share of the cell's pumps at the surface in the normal body; the rest wait in vesicles
  function settle(p) {
    const hEff = p.hist * (1 - p.h2);
    // Histamine pushes on its own and also boosts gastrin's and acetylcholine's push (potentiation).
    const push = (0.4 * hEff + 0.3 * p.gastrin + 0.3 * p.ach) * (0.5 + 0.5 * hEff);
    const pgAll = p.pg + p.pgDrug;
    const brake = 1 / (1 + 0.7 * (pgAll - 1));
    const drive = Math.max(0, push * brake);
    const up = Math.min(1, REST * drive);            // share of pumps called to the surface
    const working = up * (1 - p.ppi);
    const made = working / REST;                      // acid secreted, relative to normal
    const acid = Math.max(made * (1 - p.antacid), 0.002);   // acid left in the stomach
    const shield = Math.max(0.25, 1 + 0.55 * (pgAll - 1));
    const bicarb = 1 + 0.4 * p.vomit + 0.24 * p.sys;  // blood bicarbonate, relative
    const chloride = 1 - 0.13 * p.vomit;
    return {
      p, hEff, push, brake, drive, up, working, made, acid, shield, bicarb, chloride,
      gastricShift: -Math.log10(acid),                // pH units above the middle of the stomach range
      bloodShift: Math.log10(bicarb)                  // breathing (carbon dioxide) held fixed
    };
  }
  const mix = (a, b, t) => { const o = {}; for (const k of Object.keys(NORMAL)) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  const build = (state = 'normal', drugs = []) => {
    let p = (STATES[state] || STATES.normal)({ ...NORMAL });
    for (const d of drugs) p = DRUGS[d](p);
    return p;
  };
  return { NORMAL, DRUGS, STATES, REST, settle, mix, build };
})();
