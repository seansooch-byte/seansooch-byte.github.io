# Redraw brief: cardiac-action-potential (Lesson 7, 21 steps)

Audited 2026-11-12 from captures at t=0.35 and t=1 (shots in `scratchpad/audit/shots/cardiac-action-potential/`).
Source: `lab/cardiac-action-potential/app.js` (one file, ~645 lines), `index.html`, `style.css` (3 rules).

## Verdict

Two families of picture live in this lesson.

- **Graphs (steps 5-12, 14-21).** Model-driven traces of the ventricular and the SA-node action potential, plus an
  ECG, coloured per phase by ion (amber Na, red Ca, green K) with numbered badges, dashed-ghost morphs and
  interval brackets. These are already sound teaching graphics (5-7/10). Lift them; do not rebuild them.
- **Illustrations (steps 1-4, 13, plus the membrane strip under steps 6-8).** These fail the industry bar
  (2-4/10). Step 1 is a valentine heart and step 13 is a symmetric "heart" made of a dome and a shield, with
  bundle branches that curl upward mid-chamber. The cells are rounded rectangles, the membrane is a pink band
  between two lines, and the ion channels are two grey pills with a black bar. This is the same failure the owner
  named in lesson 1, and the heart here is worse: it is literally a love-heart.

The biggest gap: no recognisable heart (four chambers, septum, apex down and to the left, great vessels) and no
recognisable membrane or channel protein anywhere in the lesson.

## House style for the redraw (applies to every step)

- Palette: keep the kit colours for meaning (amber `#a34700` Na, red `#b3261e` Ca, green `#2c6a2c` K, blue
  `#254dff` signal and change, purple `#6b3fa0` drug, ghost dashed ink). Add **tissue tones** for anatomy only:
  myocardium `#c96a5b` to `#e9b3a6` (radial gradient, lit from the upper left), epicardial fat `#f1d9a0`
  (sparing, around the AV groove), deoxygenated vessels `#5a6fa8`, oxygenated `#c0392b`, lipid heads `#f2c9a0` with
  tails `#f7e6cf`, protein `#8fa7c4` to `#5f7896`.
  **Trap:** the ion code uses red for calcium and the anatomy uses red for oxygenated blood. Keep anatomical reds
  desaturated or pinkish-brown so a red square never reads as blood.
- Line weights: outer silhouettes 2.5, internal structures 1.5, leader lines 1.2 in muted `#53584d` ending in a
  2.5-unit dot on the structure, never touching text.
- Shading: one `<radialGradient>` per organ fill and a soft inner highlight (white at 0.25, offset towards the
  upper left). There are no drop shadows larger than 2 units. Gradient ids must be unique per render (the lesson
  already uses a `clipN` counter: reuse that pattern, because several SVGs live on one page and the Explore tab
  re-renders).
- Type: kit classes only (`.xs` 17 is the floor). Label halos use the existing `on-cell` / `on-in` stroke classes,
  extended with an `on-tissue` class for labels over myocardium.

## Per step

### Step 1: heart (`heartArt`, scene `heart`): grade 2
Problems
- A valentine heart: it has no chambers, septum, vessels or apex orientation. The apex points straight down at the
  midline.
- The SA node (red dot) sits at the top-left lobe of the valentine. The blue "wave" is a growing circle clipped to
  the outline, and blue at 0.16 over pink reads as lilac.
- The zoom box holds six rounded rectangles. They do not look like cardiomyocytes: no branching, no striations,
  no nuclei, no intercalated discs. The squeeze only narrows each box's width.
- The magnifier square and its two leader lines are thin and unshaded, and "heart" is a lone caption.

Redraw
- **Left (about x 20 to 230): an anterior-view heart.** Use a Netter-style simplified frontal silhouette with the
  apex down and to the viewer's right. Show the right atrium and auricle at the viewer's left, the right
  ventricle forming most of the front face, and the left ventricle at the viewer's right forming the apex. Draw
  the aortic arch rising from the centre and arching back towards the viewer's left, with the pulmonary trunk in
  front of it heading to the viewer's right, and the SVC entering the RA top-left. Add the anterior
  interventricular groove as a soft darker line. Fill with the myocardium radial gradient, colour the vessels by
  oxygenation, and add a slight highlight on the RV.
- SA node: a small amber-to-red glowing node at the SVC-RA junction (viewer's upper left), with `data-part="sa"`
  optional.
- Signal: drive a blue activation front with t. Fill the atria first (an opacity mask from the SA node outward),
  pause, then fill the ventricles from the septum and apex upward. The model already has stage timings; use
  `span()` the way `spreadArt` does. Colour the activated myocardium blue-tinted, not lilac: blend the gradient
  stops towards `#7d8fff` rather than overlaying blue at 0.16.
- **Right (x 260 to 470): the zoom.** Draw a circular loupe ringed by a 3-unit ink ring with a soft inner shadow,
  joined to a small circle on the LV wall by two tangent lines. Inside, show 3 to 4 branching cardiomyocytes
  joined end to end. Each has a lighter fill with faint striations (thin 0.8-unit cross-bands at about 5-unit
  pitch, clipped to the cell), one oval central nucleus, and dark **intercalated discs** (stepped zig-zag lines)
  where cells meet. Label "intercalated disc" only if it fits; the caption does not require it.
- Motion: as the blue front reaches each cell (left to right), the cell shortens by about 8% along its long axis
  (scale about the cell centre) and the striation pitch tightens. Keep the current timing windows (`.3 + c*.12`).
- Keep: `data-part="cells"` on each cell group, scene shape `{duration 3800, loop, rest .5}`, h ≤ 372, and the
  bottom caption text (or move it into the loupe's label).

### Step 2: battery (`batteryArt`): grade 3
Problems
- The cell is a stadium shape with a 9-unit brown stroke. No bilayer, no nucleus: it reads as a pill, not a
  cell.
- The charge signs float with no relation to the membrane surface. The voltage scale is a bare tick line with a
  triangle.

Redraw
- Draw one cardiomyocyte in long section: an elongated, slightly irregular rounded rectangle with a branching end
  at the right, a central oval nucleus, and faint striations inside.
- Draw the membrane as a **bilayer ribbon**: two rows of small head circles (r 2.2) with paired tail strokes
  between them, about 10 units thick. Build it as a reusable path-following primitive (sample along the outline,
  place heads at both offsets).
- Put "+" just outside the outer leaflet and "−" just inside the inner leaflet, hugging the ribbon at regular arc
  spacing (not a free grid).
- Voltage scale: make it a proper horizontal gauge. Use a rounded bar with a gradient from blue-grey (negative)
  through white (0) to warm (positive), ticks at −90, 0 and +20 mV taken from `clinical-values.json` (vRest −90
  to −85, vPeak +20), and a marker labelled "this cell, about −90 mV". This is accurate and anchors the later
  graphs. If numbers are judged too early, keep "negative / positive" and add the 0 tick only.
- Keep: `data-part="membrane"` (wrap the bilayer ribbon) and `data-part="voltage"` (the gauge), h ≤ 420.

### Step 3: ions (`ionsArt`): grade 4
Problems
- The membrane is a flat pink band. The two compartments are told apart only by a background tint.
- The ion tokens are fine as a code (circle, square, triangle) but flat. The dashed arrows are generic.
- The legend row duplicates the side labels.

Redraw
- Use the bilayer ribbon primitive horizontally across the full width at y≈200. Give the extracellular fluid a
  very light blue-grey wash and the cytosol a light warm wash, with labels "outside the cell (fluid around
  cells)" and "inside the cell".
- Give the ions depth: a radial gradient (light centre offset to the upper left) and a 1-unit darker rim, keeping
  the shapes for colour-blind coding. Do not print charges inside the tokens (they are too small for 17-unit type);
  scale the tokens up 15% instead and leave charge to the caption.
- Concentration: make the density difference obvious. About 14 Na and 7 Ca outside versus 2 Na inside; about 14
  K inside versus 2 outside. Use seeded `spots()` so the layout is stable.
- Arrows: replace the dashed shafts with broad soft "gradient arrows". Draw a tapered translucent band in the ion
  colour, crossing the membrane with its arrowhead on the far side. Name each arrow at its tail.
- Keep: `data-part="ions"` on the token group, h ≤ 404, and the legend row (it is the shape key for the whole
  lesson).

### Step 4: channels (`channelsArt`, uses `strip()`): grade 3
Problems
- Each channel is two grey pills, with a black bar for "shut". They are not recognisable as proteins and look the
  same for all three ions.
- The ion crowds are sparse and randomly placed, and the "−" row touches triangles.
- "inside the cell" sits under the door labels, far from the membrane, so the compartments are ambiguous.
- The "potassium seeps out" text floats with no arrow to the K channel. The resting-potential gauge repeats step
  2's crude scale.

Redraw: build a reusable **ion-channel primitive** `channel(x, y, kind, open)` and use it in `strip()` so steps
6 to 8 inherit it.
- Shape: a transmembrane protein of 4 rounded subunits (draw 2 front subunits plus darker back ones for depth),
  in the protein gradient, spanning the bilayer and protruding about 8 units on each side.
- Open state: the front subunits splay apart and reveal a pore lit faintly in the ion colour. Shut state: the
  subunits meet and a **gate** closes the pore at the inner mouth. For Na, add the inactivation "ball and chain"
  (a small ball on a tether that plugs the inner mouth) for use in step 9; this is textbook-accurate for Nav
  channels.
- Tint: give each channel a thin collar band in its ion colour (amber, red, green) so the kind reads without the
  label.
- Ions passing through animate along the pore axis exactly as now (the `speed` and `i/3` phase logic stays).
- Labels: put "sodium channel / shut", "calcium channel / shut" and "potassium channel / open" under each protein
  with leader-free placement. Put the compartment labels "outside" and "inside" in the left margin directly
  against the membrane (as `strip()`'s `sides` option does).
- Charge: "+" and "−" rows hug the bilayer (2 to 4 units off the head groups).
- Gauge: reuse the step 2 gauge primitive with its marker at rest.
- Keep: `data-part="doors"` wrapper, the inner `data-part="door-na|door-ca|door-k"` groups (they come from
  `strip()`), `data-part="rest"`, and `{duration 3000, loop}`.

### Step 5: outline (`beatArt('outline')`): grade 6 (graph)
Already good: it draws itself, numbered badges sit by each phase, and the key is clear.
Problems
- Phase 0 is drawn from only 2 to 4 samples (`n = ceil((b-a)*40)` with a1≈.075), so the upstroke and the
  phase-1 notch show visible polyline facets.
- The axis is a bare stub with "voltage ↑" and no 0 mV or rest reference, so "negative inside" from steps 2 and
  4 is lost.
- Badge 1 crowds the notch.

Lift
- Set the minimum samples per phase to 24 (`n = Math.max(24, …)`). Slightly round the notch apex
  (`stroke-linejoin="round"` already set; the facets come from the samples).
- Add one faint horizontal 0 mV reference line (dashed `#c4c8bd`) labelled "0" and a "rest" tick at the baseline.
  If numbers are used, they must come from `clinical-values.json` (−90 rest, +20 peak, scaled the way
  `measures()` does). Gridless otherwise.
- Shade under the curve very lightly (fill to baseline at opacity .06) so the shape reads as a "hump of time".
- Move badge 1 up and right by about 8 units, clear of the notch.

### Steps 6, 7, 8: na, ca, k (`beatArt` + `strip()`): grade 5
Already good: phase colouring, a faint whole-beat preview, per-step dimming, and text cues in matching colours.
Problems
- The membrane strip under the graph inherits the crude pills and flat band (see step 4).
- At t=1 the strip shows the phase-4 door state, so step 7's end frame shows the calcium door **shut** while its
  caption is about calcium entering. The `rest: .7` frame is fine; the scrub end looks contradictory.
- Phase 0 is faceted (see step 5). In step 6 the "sodium rushes in" label floats with no link to the upstroke.
- The tip dot is always ink. A coloured tip in the current phase colour would tie the graph to the door below.

Redraw
- Replace the strip with the bilayer plus channel primitives from step 4. Keep `strip()`'s signature (`focus`,
  `words`, `state`, `speed`, `sides`) so the beat scenes need no change.
- Add a thin **vertical "now" cursor** from the tip dot down to the membrane (1.2-unit muted line) so the reader
  links the trace moment to the door state.
- Give the tip dot the colour of the current phase.
- Per step, freeze the scrub end on the step's own phase. Step 6 ends with Na open and its ions mid-pore; step 7
  with Ca open; step 8 with K open in phase 3 or resting K at phase 4. Do this by capping `beatClock` per kind
  (for example `tMax = sh.a2` for na/ca), or set `rest` and keep `t=1` consistent. **Do not** change the model
  timings.
- Step 7: the plateau "balance" reads better as a small **balance glyph**: two arrows of equal width, a red
  inward one and a green outward one, at the plateau's midpoint, instead of three stacked text lines.

### Step 9: refractory (`refractoryArt`): grade 5
Problems
- The refractory bar is a black slab below the graph, detached from the trace. Industry figures shade the
  absolute and relative refractory periods as bands **behind** the action potential.
- The "stray signal" arrow appears only between t .4 and .64, so neither capture shows it, and it does not show
  what happens at the channel.

Redraw
- Behind the trace, add two vertical bands from phase 0 to `sh.refr` (absolute: ink at .12) and from `sh.refr`
  to `sh.a4` (relative: ink at .05, hatched). Label them in the bands: "refractory", and "only a strong signal"
  for the later one. Drive the band edges from `sh.refr` and `sh.a4` (model-driven, which matters for the drug
  steps if reused).
- Keep the growing-bar idea by revealing the band with tau.
- Add a small inset: one Na channel (step 4 primitive) shown **inactivated**, with the ball-and-chain plugging
  the inner mouth, labelled "sodium doors locked". This illustrates the caption accurately: inactivation, not
  closure, is why it is refractory.
- Stray signal: keep it, but make it a blue lightning-style tick at the plateau, with a small "×" and the label
  "no effect", visible from t .35 to .7 so it is in the default rest frame (rest .7).
- Keep: `data-part="trace"` and `data-part="refractory"`.

### Step 10: pm (`pmArt('pm')`): grade 6 (graph)
Already good: the drift is highlighted and the dotted threshold is clear.
Problems
- The "threshold" label sits on the trace's opening fall (x≈140 to 185), so the curve runs under the text start.
- Half the frame below the graph is text only.

Lift
- Move the "threshold" label to the right end of the line (end-anchored at x 468), clear of all traces.
- Fill the empty lower band with a mini membrane: one **HCN ("funny") channel** using the channel primitive, with
  an amber Na token drifting in slowly, labelled "funny current: sodium leaks in". This is accurate: If is a mixed
  cation current, net inward Na at these voltages. Do not show it as K.
- Optional: shade between the drift curve and threshold (amber at .08) to show "distance still to climb".

### Step 11: pm-ca (`pmArt('pm-ca')`): grade 6 (graph)
Problems: as step 10. The badges are good. There is no picture of the calcium channel doing phase 0.
Lift: reuse step 10's mini membrane, with the L-type Ca channel opening during phase 0 (cursor-linked as in steps
6 to 8) and K opening in phase 3. Move the threshold label as in step 10.

### Step 12: nerves (`nervesArt`): grade 6 (graph)
Problems
- The title colours clash with the ion code: "noradrenaline" is in red (= calcium) and "acetylcholine" in green
  (= potassium).
- There is a large empty band between the two panels and nothing shows the nerves.

Lift
- Set the titles in ink with a small icon each: a sympathetic varicosity releasing dots onto a β1 receptor (a
  7-transmembrane serpentine strip, from a shared GPCR primitive), and a vagal ending releasing onto an M2
  receptor. Put each icon at the left of its panel (about 60 x 40 units).
- Keep the blue change notes. Add a blue arrow at threshold from the normal firing to the new firing in each panel
  (as `pmChangeArt` already does).
- Keep: `data-part="rate"`, the ghost groups `class="ghost"`, and h ≤ 408.

### Step 13: spread (`spreadArt`): grade 2
Problems (anatomy)
- The heart is left-right symmetric with the apex at the midline, a single dome for "atria" with no interatrial
  septum, and the AV node on a horizontal shelf.
- The bundle branches leave the His bundle and **curl upward into U-shapes mid-cavity**. They do not run down the
  septum to the apex and then up the free walls, so this is anatomically wrong.
- The septum line runs separately from the conduction system.
- At t=1 nothing is lit (the loop has faded), so the end frame says nothing.
- "fast wiring" is vague and could be named (the caption can stay plain).

Redraw: a **frontal-section heart** (the standard conduction-system figure from Netter, Osmosis and Ninja Nerd).
- Show four chambers in coronal section with an anatomical silhouette: apex down and to the viewer's right, the
  thicker LV wall at the viewer's right and the thinner RV wall at the left, an interatrial septum and a muscular
  interventricular septum, the AV valves as thin leaflets at the AV junction, and the SVC, IVC and aortic stub
  cut off at the top. Fill the walls with myocardium gradients and leave the chambers as pale blood (RA and RV
  blue-grey, LA and LV pinkish) so it reads as a section.
- Conduction system in a single colour (pale grey when idle, blue when active). The SA node is an ellipse at the
  SVC-RA junction. Add optional faint internodal pathways. The AV node is a small ellipse at the base of the
  interatrial septum, just above the tricuspid annulus. The His bundle descends into the membranous septum, then
  divides into the right and left bundle branches running **down both sides of the septum to the apex**. Purkinje
  fibres fan **up the ventricular free walls** from the apex.
- Motion (keep the existing stage windows): atrial activation spreads as a blue wash from the SA node across both
  atria (`atria`); the AV node pulses and enlarges during `pause`; then a dash-offset reveal runs down the
  His/bundle branches and up the Purkinje (`down`), and the ventricular wash spreads from the septum and apex
  upward (`vent`). End frame: freeze the fully activated state at t=1, or set `rest` to a mid-activation frame.
  The current rest of .7 is mid-ventricle, which is good, but t=1 should not be blank.
- Labels (leader lines, `.xs`): "sinoatrial node", "AV node: a pause", "atria", "ventricles", and "fast wiring
  (bundle branches)" pointing at the left bundle branch.
- Keep: `data-part="sa"`, `"av"`, `"ventricles"` (dfn terms), and `"atria"`. Keep the bottom note or fold it into
  the AV label. h ≤ 404.

### Step 14: ecg (`ecgStepArt`): grade 6 (graph)
Already good: the cell action potential and the ECG share a time axis, the dotted guides tie the QRS to phase 0
and the T end to phase 3, and the brackets build in order.
Problems
- The ECG QRS is 4 straight segments (a sawtooth). The P and T waves are fine.
- There is no ECG paper, so it does not look like an ECG.
- The bottom note "PR: atria, then the AV node pause" sits under the QT bracket, far from the PR bracket.

Lift
- Smooth the QRS with a Catmull-Rom or cubic through its 5 points (keep `beat()`'s timing points; only the path
  builder changes). Draw the ECG on a faint **pink ECG grid** (minor 1 mm-style lines `#f3c9c9` at .5 opacity,
  major lines every 5) clipped to the ECG band only. This is the standard idiom and lifts it at once.
- Move the PR explanation next to the PR bracket (left side, two lines), or drop it, since the caption says it.
- Keep: `data-part="ecg"`, `"pr"`, `"qrs"`, `"qt"`, `"trace"`, and the ECG_T frame.

### Step 15: whole (`wholeArt(BASE)`): grade 6 (graph)
Problems
- Three stacked graphs with no visual separation and no colour key (the phase colours are unexplained here).
- The ECG is a sawtooth with no grid. The pacemaker panel's two beats and the muscle panel's one beat sit on
  different time scales without saying so clearly ("two beats" and "one beat" are muted).

Lift
- Give each panel a faint rounded panel background (`#f6f4ee`) with its title inside, and add the ECG grid and
  smoothed QRS from step 14.
- Add a compact ion key (circle, square and triangle with sodium, calcium and potassium) in the free space at the
  bottom right.
- **Risk:** `wholeArt` also renders the Explore tab with `ghost`, `legend` and `blocks`, and its outer `<g>` carries
  `data-new-state` plus `data-rate`, `data-qrs` and the other rel attributes. Keep that wrapper and its attributes
  exactly.

### Steps 16, 17, 18, 20: class1a, class1b, class1c, class3 (`muscleChangeArt`): grades 7, 5, 7, 7
Already good: a dashed ghost of normal, a morph from t=0 to 1 driven by `mix()`, blue arrows plus badges naming
what moved, matching ECG ghost and brackets, and a readout that agrees.
Problems
- **Class IB (17):** no change arrow at all. `|x2-x1| ≤ 14` suppresses it, so only badge 3 shows. FORMAT requires
  the change to be named on the picture in words with an arrow. Draw a short **leftward** blue arrow at phase 3
  anyway (minimum length 18, pointing from ghost to new), or a blue "‹ a little shorter" tag at the QT bracket.
- The phase-0 arrow (1A, 1C) is horizontal at mid-height, which suggests "shifted right" rather than "less
  steep". Better: draw a small blue **slope wedge**, two short tangent ticks at the upstroke (ghost and new) with
  an arc between them, labelled "less steep".
- Drug key: the purple "plug" is a bare rounded rectangle. Replace it with the channel primitive (mini, 26 units)
  with a purple drug molecule (small hexagon or pill) lodged in the pore. Use the same icon at the blocked phase
  on the trace (for example, a tiny purple plug badge beside badge 0 for Na blockers).
- ECG: the sawtooth QRS and no grid (lift as in step 14). The 1C "lower" peak is only shown by the ghost; a small
  downward blue tick at the peak would name it.
- Keep: `class="ghost" data-ghost="normal"` groups, `data-part` on trace, ecg, pr, qrs, qt and drug, the
  `change()` scene shape (`duration 3200`, `a = span(t, .6, .92)` fade for marks), and h 406.

### Steps 19, 21: class2, class4 (`pmChangeArt`): grade 6
Problems
- In the ECG strip the beats are clipped at the frame edges, so half-spikes at x≈56 and x≈468 read as artefacts.
- Class II: badge 4 (centre about y 198, radius 12) nearly touches the "electrocardiogram" title
  (baseline y 216); check overlap at 375 px.
- Class IV: the caption says the AV node and muscle are also affected (PR longer, weaker squeeze, plateau lower in
  the readout), but only the pacemaker and ECG are drawn. Plateau height is in the readout but not on the picture.
- There is no picture of the receptor or channel being blocked.

Lift
- Clip the ECG path with a `clipPath` and fade the ends (a linear-gradient mask over 12 units), or start and end
  the window on the isoelectric line between beats (choose `mE` t0 and t1 at mid-diastole).
- Class II: a drug icon of a β1 receptor (GPCR primitive) with a purple blocker in its pocket. Class IV: an L-type
  Ca channel with a purple plug. Put these in the key row, replacing the plain plug.
- Class IV: add a blue arrow on the phase-0 slope ("rises more slowly") in addition to the threshold arrow,
  because the caption leads with phase 0.
- Move badge 4 up by 10 units, or the ECG title down by 8 (h allows up to 420; currently 386).

## Reusable primitives this lesson needs

1. `bilayer(path | x0,y,x1)`: a phospholipid bilayer ribbon that follows a straight line or a closed outline
   (head circles plus tail pairs), with optional tint and `data-part` passthrough.
2. `channel(x, y, kind, open, { inactivated, drug })`: a 4-subunit transmembrane channel protein with gate,
   optional Na inactivation ball-and-chain, a collar in the ion colour, and an optional purple drug in the pore.
   Used in steps 4, 6-11, 16-21 and the Explore key.
3. `gpcr(x, y, { ligand, blocker })`: a 7-transmembrane serpentine receptor (β1 or M2) for steps 12, 19 and 21.
4. `ionToken(kind, x, y, s)`: the existing circle, square and triangle with a radial gradient and rim.
5. `cardiomyocyte(x, y, len, { squeeze })`: a branching striated cell with a central nucleus and intercalated
   disc ends (step 1, step 2).
6. `heartAnterior(t-driven activation)`: the anterior-view heart with great vessels (step 1).
7. `heartSection({ conduction, activation })`: a four-chamber frontal section with the conduction system (SA, AV,
   His, bundle branches, Purkinje) and activation masks (step 13; shareable with other cardiac lessons).
8. `ecgPaper(x0, y0, w, h)`: a clipped pink ECG grid; `smoothPath(points)`: a Catmull-Rom path builder for the
   QRS.
9. `voltGauge(x, y, w, value, { ticks })`: the membrane-voltage gauge (steps 2, 4).
10. `bands(m, [a,b,style]...)`: shaded vertical time bands behind a trace (refractory periods).
11. `loupe(cx, cy, r, src)`: a magnifier circle with tangent connector lines.

## Risks a redraw could break

- **Model-driven geometry.** Every trace comes from `cell()`, `muscleShape()`, `pmShape()` and `beat()` through
  `frame()` maps (BEAT_M, PM_M, ECG_T, the `wholeArt` frames). Only presentation may change. Do not touch the
  constants in `cell()` or the cut times. The Clinical values tab and Explore readouts depend on `rel()`.
- **`data-part` names used by `<dfn>`.** These must survive: cells, membrane, voltage, ions, doors, rest, trace,
  phase0, phase2, phase3, refractory, pm, threshold, rate, sa, av, ventricles, ecg, pr, qrs, qt, drug. `phase0`
  is used in both step 6 (muscle) and step 11 (the pacemaker's calcium phase 0), and `pm` in step 10 and step 19.
  Also keep `door-na`, `door-ca`, `door-k` and `atria`.
- **Hooks.** `data-badge`, `data-phase` on trace segments, `class="ghost"` with `data-ghost="normal"`, and the
  `data-new-state` wrapper with `data-rate`, `data-upstroke`, `data-qrs`, `data-qt` and the other rel attributes
  (Explore and tests may read them). `tools/lab-walk.mjs` checks label overlap (end frame) and the 12 px minimum
  at the phone width, and needs an aria-label longer than 30 characters. `tools/lab-check.mjs` needs at least 3
  `dfn data-part`.
- **Scene contracts.** Durations, `loop`, `rest` (.5, .7, .99), and `h` per scene (≤420). Adding the membrane
  insets in steps 10 and 11 must stay within 420.
- **Unique ids.** Gradients, clipPaths and masks must be per-render unique (follow `clipN`). Explore re-renders on
  every slider input, so avoid heavy filters (no `feGaussianBlur` in per-frame scenes). These pictures animate
  at 60 fps on phones.
- **Colour semantics.** Amber, red and green are ions; blue is signal and change; purple is drug. Anatomy reds
  must not be confused with calcium, and the nerve titles in step 12 currently break the code.
- **Label overlap on the phone.** Steps 10-12 threshold labels, step 19 badge 4 against the ECG title, and step 13
  leader lines across chambers.
- **Accuracy traps.**
  - The SA node is at the SVC-RA junction (the viewer's upper left in anterior view).
  - The AV node is in the atrial septum near the coronary sinus ostium, above the tricuspid annulus.
  - The bundle branches run down the septum to the apex; the Purkinje fibres climb the free walls.
  - The apex points down and to the left (the viewer's right). The LV wall is thicker than the RV wall.
  - The funny current is mixed cation, net Na inward (the caption says sodium leaks in: keep it).
  - Phase 1 is a transient outward K current. Phase 2 is the L-type Ca balance against delayed-rectifier K.
  - The refractory period is due to Na-channel **inactivation** (draw ball-and-chain, not a closed gate).
  - Pacemaker phase 0 is L-type Ca with no plateau. Class IB acts on inactivated channels, so its effect at a
    normal rate is small: do not exaggerate the 1B morph.
  - Any mV or time numbers must come from `clinical-values.json` (rest −90 to −85 mV, peak +20 mV, SA MDP −60 to
    −55, SA threshold −40, QRS 0.06 to 0.08 s, QT about 0.35 s).
- **Scrub end frames.** Steps 6 to 8 and 13 currently show a "finished" state that contradicts the caption at
  t=1. If you change this, keep `loop` and `rest` semantics. The smoke test grabs the end frame for overlap
  checks.
