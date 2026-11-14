// The shared illustration library for lessons built from classic scripts (adh-water-balance): load this
// module before them, <script type="module" src="/lab/kit/art/global.js">, and read window.LabArt.
// Module and defer scripts run in document order from one queue, so LabArt exists before they run.
import * as core from './core.js';
import * as heart from './heart.js';
import * as chart from './chart.js';
window.LabArt = Object.freeze({ ...core, ...heart, ...chart });
