// The Nephron and Diuretics · The Lab · reference data
// clinical-values.json is the only place reference numbers live. Loaded once, it calibrates the
// model before the lesson, Explore freely and the Clinical values tab draw anything.
import { calibrate } from './model.js';

export const ready = fetch('./clinical-values.json')
  .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  .then(cv => { calibrate(cv); return cv; });
