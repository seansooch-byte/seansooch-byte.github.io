# Redraw brief: blood-pressure-regulation (Lesson 4)

Audited 2026-11-12 from captures at t=0.35 and t=1 for all 17 steps (step 11 is a still).
Files: `lab/blood-pressure-regulation/app.js` (all pictures, the teaching model `circulate/steady`, the shared
bar board `bars/boardBody/story`), `index.html` (captions, dfn data-parts), `style.css` (4 lines, nothing to keep).

**Overall grade: 3/10.** The lesson is a clean diagram set: a valentine heart, rectangles for arteries, a
"blob" for veins, a box for the brainstem, and six "What changes it" steps that are the *same three bar
charts* with different words. Nothing looks like anatomy or a cell. The graphs (step 3 pressure wave, step
10 reflex trace, the bar board) are the strongest parts and mostly need polish. The biggest gap: the six drug
and bleed steps never show **where** the drug acts (a smooth-muscle cell with its calcium channel, an
alpha-1 receptor on a vessel, a brainstem nucleus, a beta-1 receptor on a cardiac cell, a bleeding vessel).
The bars should stay (they are model-driven and teach MAP = CO x TPR) but must share the frame with a
mechanism vignette.

## House style for this lesson (apply to every step)

- Palette: oxygenated blood `#c4453a` lumen with a lighter highlight band `#e06a5c`, deoxygenated `#4f5f86`
  with highlight `#6d7da6`; vessel walls drawn as three layers where scale allows (intima thin pale line,
  media `#d98f84` smooth-muscle band, adventitia `#efd9cf`), tissue `#efe6d8`. Nerves: sympathetic
  `C.blue`, vagus `C.purple`, sensory/afferent a third distinct treatment (blue dashed or teal is NOT in
  the palette, so use `C.green` for afferent baroreceptor fibres to separate "sensing" from "commanding";
  this also frees blue to mean "the thing being taught" consistently).
- Shading: linearGradient across every tube (dark edge, light centre stripe) so vessels read as cylinders;
  radial gradient on the heart chambers; 1 px darker outline on all organic shapes; no flat black meter bars.
- Line weights: organ outlines 2, vessel walls 2, leader lines 1.25 ink at 60 percent opacity ending in a 2.5 r
  dot on the structure; arrows via `arrowFixed` so heads do not scale.
- Labels: leader-lined, outside the drawing where possible; never on top of a fill unless it uses the
  existing `on-heart`/`on-vein`/`on-white` halo classes.
- Gradients need unique ids per SVG (the board is rendered in three places at once: lesson, Explore, Clinical).

## Shared new primitive: the anatomical heart (replaces `HEART` valentine everywhere)

Steps 1, 4, 7, 9 (and the change vignettes for beta-blocker, hemorrhage) use `heart()` (a valentine). Replace with
a shared `heartFrontal(x, y, k, {squeeze, showChambers})` from a course-level library: anterior view, apex down
and to the patient's left (viewer's right), right atrium/ventricle on viewer's left, aortic arch rising from
behind the pulmonary trunk and arching to the viewer's left-back, SVC entering RA from above, IVC from below,
pulmonary trunk anterior. For this lesson the chambers do not need to be opened except in step 4 (stroke
volume leaving the LV through the aortic valve). `squeeze` (0..1) shrinks ventricles by ~10 percent toward the
apex for the beat. Keep `data-part` hooks on outer group. Must keep the `on-heart` label legible: put the
word "heart" as a leader label outside instead of on the shape.

## Per step

### Step 1 `loop` - Blood travels in a loop. Grade 3.
Problems: valentine heart; arteries and veins are thick polylines with no wall or lumen; the artery leaves the
top of the heart and the vein enters the side with a visible gap (vein end at x=84 does not reach the heart
outline); "tissue" is a beige rounded rectangle; capillary bed is five purple strokes fanning to one point;
circulating dots are flat pale circles, not red cells; no pulmonary circuit (fine for the caption, but the
heart drawn should still be a heart).
Redraw: a simplified systemic circuit in the Netter "schematic circulation" style. Anatomical heart (primitive
above) left-centre; aorta leaves the LV, arches, and runs right as a shaded red tube (wall + lumen, ~14 u);
it branches into 2 arteries -> arterioles -> a **capillary bed** drawn as a mesh of 6-8 thin anastomosing
capillaries over a tissue patch with a few cell outlines (polygonal cells with nuclei, the tissue tone);
capillaries graded red -> purple -> blue left-to-right (linearGradient along the bed); venules merge into a
wider, thinner-walled blue vein (larger lumen, thinner wall than the artery: this difference is anatomically
true and teaches step 7) returning to the right atrium via the vena cava. Red cells as biconcave discs (ellipse
with a darker centre) moving along `LOOP_ART`/`LOOP_VEIN` (keep `along()`), turning from red to dark red as
they leave the bed. Labels via leaders: "arteries: away from the heart", "capillaries in the tissues", "veins:
back to the heart". Keep `data-part="arteries"` on the arterial tube group and `data-part="veins"` on the venous.
Keep loop duration 4800, loop:true.

### Step 2 `pressure` - Pressure is the push. Grade 3.
Problems: the artery is two flat pink slabs; the dial floats above it with no connection; the red flow arrow has a
black head (arrowTo default head ink) inside a red lumen; the caption's key claim, "much higher in the arteries
than in the veins", is not drawn at all.
Redraw: a longitudinal cut-away of an artery (top) and a vein (bottom) side by side horizontally at the same
scale. Artery: thick 3-layer wall (media with smooth muscle cells as spindle shapes), round-ended cut faces
showing the cross-section ring at the left end (an ellipse with the wall thickness visible), red lumen with red
cells. Vein: thin wall, wide floppy lumen, valve leaflet pair drawn inside (venous valves are real). Each vessel
has a pressure gauge connected by a short side-tube (manometer stub) through the wall, so the dial plainly
reads *that* vessel. Artery dial swings high with each beat (existing `surge`), wall bulges outward (existing
`b`), blue push arrows on the wall; vein dial sits low and barely moves. A thick blue `arrowFixed` from artery
to vein end labelled "the difference drives blood on". Keep `data-part="pressure"` on the artery push arrows
and artery dial. Keep duration 1600, loop, rest .22.

### Step 3 `wave` - It rises and falls with every beat. Grade 6 (graph, already good).
Good: correct waveform shape with dicrotic notch, true time-averaged mean nearer diastolic, draws itself.
Lift: replace the hard axis-only frame with a faint shaded band between diastolic and systolic (`C.redWash`
at 40 percent) labelled "pulse pressure" on the right, which is the standard textbook figure; shade the area
under the curve lightly so "the average" reads as area balance; use a soft red gradient stroke; end-of-line
labels already fine; add tiny tick labels on the y axis are NOT needed (no numbers in the model). Optionally a
small artery cross-section above the first peak that dilates on systole (recoil idea from the caption:
"held up between beats as the stretched arteries recoil"), drawn at 60 u wide in the top-left space. Keep
`data-part` systolic/diastolic/mean.

### Step 4 `flow` - Flow: what the heart sends out. Grade 2.
Problems: valentine heart not connected to the tube (gap at x 130-150); "blood per beat" is a red rounded
rectangle slug in a pink bar; the bracket over the slug is a crude staple; nothing shows heart rate as
something countable.
Redraw: the anatomical heart, left ventricle opened in a frontal section (LV cavity, mitral valve closed,
aortic valve open on ejection), aorta leaving upward and arching right into a shaded horizontal artery. Each
beat (two per cycle, as now) the LV squeezes (wall thickens, cavity shrinks) and a bolus, drawn as a
**cluster of red cells** with a bracket labelled "stroke volume: blood per beat", is pushed out and travels
right. A small ECG-style beat tick strip or a metronome counter under the heart ("beats: how often") ticks on
each squeeze so rate is visible. Equation block right-bottom stays. Keep `data-part="flow"` on the boluses.

### Step 5 `resist` - Resistance: the narrow ends. Grade 3.
Problems: smooth muscle drawn as brown square tiles sitting outside a grey wall, only on the right half;
resistance shown as a black progress bar (meter metaphor, no physiology); the narrow row's cells are the same
dot size as the wide row so "squeezes through" does not read.
Redraw: two arterioles in longitudinal cut-away with the **smooth muscle as a helical wrap of spindle-shaped
cells** (elongated ellipses with central nuclei) around the whole vessel, endothelium as a thin inner line.
Top: cells shortened and fat (contracted), lumen narrow, red cells squeezing in single file and moving
slowly. Bottom: cells long and thin (relaxed), lumen wide, cells moving fast. On the right, instead of the
black meter, a small cross-section of each arteriole (ring of muscle, lumen diameter) with "resistance: high
/ low" and a blue arrow; optionally note "radius halves -> resistance x16" ONLY if the lesson already teaches
Poiseuille (it does not: leave it out). Keep `data-part="arterioles"` on the muscle cells,
`data-part="resistance"` on the high/low indicators.

### Step 6 `hose` - Pressure comes from flow meeting resistance. Grade 5 (analogy, acceptable).
Problems: the tap is an abstract valve-wheel symbol on a grey box; the hose is a flat lilac rounded rect; the
water spray is three dashes; top panel's dial already at 35 percent shows the dashed ghost overlapping the
needle base so the ghost is hard to see; large empty band between panel 1 and 2.
Redraw: keep the analogy and timing (two panels, then the equation). Draw a real tap (spout + handle that
rotates), a hose with a cylinder gradient and slight bulge when pressure rises (radius +2 u), a nozzle that
visibly pinches in panel 2, and water as a tapered stream with droplets whose speed/length follows flow.
Ghost needle in `C.ghost` grey, not ink. Tighten vertical spacing so the equation sits nearer. Keep
duration 6000, no loop.

### Step 7 `volume` - Volume fills the system. Grade 2.
Problems: veins are a flat navy lozenge labelled "veins"; the heart is a valentine floating at top left with
a vein pipe stuck into its side; the outflow arrow has a black head on a red shaft; the dashed ghost is the
lozenge outline.
Redraw: a venous reservoir drawn as a **bundle of 3-4 thin-walled veins** (with valves) in a tissue bed that
swell from collapsed-oval to round cross-sections as volume rises (cross-section insets at the left end make
the swelling unambiguous), dashed grey ghost outline of their normal diameter; vena cava returning to the
right atrium of the anatomical heart; the LV outflow aortic tube thickening (outW) as stroke volume rises.
Labels with leaders: "veins hold most of the blood", "more returns to the heart", "each beat pumps more"
(blue arrow, per FORMAT change rule). A small kidney silhouette bottom-right with "over days, the kidneys set
it" (links Lesson 2). Keep `data-part="volume"` on the vein bundle; keep ghost class.

### Step 8 `sensor` - Sensors in the artery wall. Grade 3.
Problems: the "artery" is two slabs; the sensor is a stick with a circle; the signal dots travel along
`NERVE` (a straight-segment polyline) while the drawn nerve is a quadratic curve, so the dots visibly leave
the nerve at the bend (seen at t=0.35 and t=1); a dot overlaps the sensor ending at t=1; "neck and chest
arteries" is a floating grey note with no picture; the brainstem is a pill.
Redraw: a small anatomical vignette left (neck and chest): the **aortic arch** and the **carotid
bifurcation with the carotid sinus** (a bulge at the start of the internal carotid), each with a green
afferent fibre: the carotid sinus nerve joining the glossopharyngeal nerve (CN IX) and the aortic nerve
joining the vagus (CN X), both running up to the **medulla** (brainstem drawn as a sagittal silhouette of
medulla/pons, not a pill; nucleus tractus solitarius marked as a dot named "brainstem" for the dfn). Right: a
magnified inset (circle callout from the carotid sinus) showing the wall in section with **branched free
nerve endings** among elastic lamellae, stretching apart as the wall bulges. Action potentials as small
spikes moving along the afferent, rate following `SPIKES` (keep the generator), and a mini spike train strip
under the inset ("more stretch, faster signals"). Fix: make the dots travel the same path that is drawn
(sample the drawn path with `getPointAtLength` in a mount() scene, or draw the nerve as the polyline).
Keep `data-part="sensor"` and `data-part="brainstem"`. Accuracy: carotid sinus -> CN IX, aortic arch -> CN X,
both to NTS in the medulla. Do not draw the carotid body (chemoreceptor) as the sensor.

### Step 9 `nerves` - The brain answers through nerves. Grade 3.
Problems: subway-map lines; the "vagus nerve" label's second word collides with the sympathetic trunk at
x~245 y~100; the sympathetic branch to the heart stops 10 u short of the heart; the vein is a navy pill and
the arteriole a pink bar with brown bands; sympathetic fibres leave the brainstem directly, skipping the
spinal cord and chain ganglia, which is the one thing a med student expects to see.
Redraw: brainstem (same silhouette as step 8) top-centre, **spinal cord** descending, a **sympathetic chain**
(ganglia beads) beside it, and postganglionic fibres (blue) to three targets: the anatomical heart (SA node
region and ventricles), an arteriole in cut-away (spindle smooth muscle, same as step 5), a vein (thin wall,
same as step 7). The **vagus** (purple) leaves the medulla directly and runs down to the heart (SA/AV node
region), no spinal detour. Signals as small pulses along each. Effect words beside each target with leaders.
Keep `data-part="sympathetic"`, `data-part="vagus"`, `data-part="brainstem"`. Accuracy: preganglionic
sympathetic outflow is thoracolumbar (T1-L2); cardiac sympathetics come from upper thoracic levels via the
cervical/upper thoracic ganglia; keep it to "spinal cord" and "sympathetic chain" labels, no level numbers
needed.

### Step 10 `reflex` - A reflex that steadies pressure. Grade 5.
Good: the trace is model-driven (`steady(STAND)`), honest ghost (without reflex), clock synced to boxes.
Problems: the loop is four white text boxes (a flowchart, not a picture); "pressure recovers" label sits
between box 1 and 4 on the arrow; boxes and trace compete for space (the trace gets ~165 u).
Redraw: replace the four boxes with a compact **circular reflex loop of mini-icons** (reusing primitives at
small scale): (1) a standing figure silhouette with blood pooling in the legs, (2) carotid sinus with fewer
spikes, (3) medulla with blue sympathetic output up and purple vagal output down, (4) heart (faster) +
arteriole (narrower). The active node gets the blue highlight ring; the arrows around the circle light in
sequence (keep the `REFLEX_NODES` from/to timing). Trace below keeps its geometry and data hooks; add a light
fill between the two curves to show "what the reflex buys". Keep `data-part="loop"`,
`data-ghost="without reflex"` and `data-new-state="with reflex"` with `data-low`.

### Step 11 `whole` - The whole picture. Grade 3.
Problems: three flat rectangles with x and =; the top 110 u are empty; nothing ties the bars to the organs
that set them.
Redraw: keep the three bars (they are the board every change reuses), but put a small icon atop each bar:
anatomical heart (flow), arteriole cross-section (resistance), gauge or arterial wave (pressure). Fill bars
with soft vertical gradients in their colours, rounded tops 4 u. Below: two timescale lanes with icons:
brainstem + carotid sinus "seconds: the baroreflex steadies it"; kidney silhouette "days: the kidneys set
blood volume".

### Steps 12-17 change steps (`ccb`, `alpha1`, `alpha2`, `beta`, `vasodilator`, `hemorrhage`). Grade 3 each.
Shared problems: all six are the same bar chart; "acts here" is a word and arrow pointing at a bar, not at a
tissue; when a bar returns to normal its stroke sits exactly on the ghost's dashed stroke, giving a
red/black stitched edge (visible on flow in ccb and vasodilator at t=0.35, and pressure everywhere);
~110 u of empty space above the bars; the story box is a white text card. Motion does read (two stages, drug
then reflex), and the board wording agrees with the model.
Redraw (same layout for all six, height <= 420):
- **Top band (y 0-150): a mechanism vignette** that morphs with `u1` (stage 1) and shows the reflex with `u2`:
  - `ccb`: a vascular smooth-muscle cell (spindle, nucleus) with an **L-type calcium channel** drawn as a
    4-domain membrane protein in a lipid-bilayer strip; Ca2+ ions entering at t=0, a drug wedge (amlodipine)
    plugging the pore at t=1, the cell lengthening (relaxing) and the arteriole beside it widening over the
    ghost diameter. Reflex stage: small heart icon with a faster beat tick.
  - `alpha1`: a sympathetic varicosity releasing noradrenaline onto an **alpha-1 receptor** (7-helix GPCR
    in bilayer) on a vascular smooth-muscle cell; prazosin occupies the receptor, NA bounces off; arteriole
    and a vein both widen (caption: veins too). Reflex: heart rate tick speeds a little.
  - `alpha2`: brainstem silhouette with an **alpha-2 receptor** on a neuron in the medulla; clonidine binds;
    the blue sympathetic outflow pulses thin out (fewer, dimmer dots) to heart and arteriole. Reflex stage:
    note "reflex holds the new level" (no fast heart).
  - `beta`: a cardiac myocyte strip (striations) with a **beta-1 receptor** (GPCR); metoprolol-type blocker
    occupies it; the heart icon beats slower and contracts slightly less. Reflex stage: arteriole narrows a
    little.
  - `vasodilator`: arteriole smooth muscle relaxing directly (no receptor drawn, since hydralazine's
    molecular mechanism is not settled; do not invent one), arteriole widens a lot; reflex stage: heart icon
    racing (fast tick) and, as a faint note, kidney retaining salt and water "over days".
  - `hemorrhage`: a vessel with a wound and red cells leaving, the vein bundle (step 7 primitive) shrinking
    below its ghost; reflex stage: heart rate up, arteriole narrows.
  Each vignette names what moved in words with an arrow (FORMAT rule) e.g. "arteriole widens", "fewer
  signals", "heart slows".
- **Middle band: the bars**, compressed (UNIT ~80) but model-driven exactly as now. Draw the ghost first and
  the bar on top with a 1 u inset so the two strokes never coincide, or draw the ghost in `C.ghost` grey with
  the bar stroke slightly thicker. Replace the "acts here" text with a thin blue leader from the vignette to
  the bar it moves.
- **Bottom band: story rows** as now (drug / reflex), but tagged with tiny icons (pill, loop arrow) instead of
  grey words, and the white card dropped for a hairline rule to save height.
Keep: `stateAt`, `STAGE_1/STAGE_2`, `boardBody` data attributes (`data-new-state`, `data-pressure`,
`data-rate`, `data-flow`, `data-resistance`, `data-volume`), part names flow/resistance/pressure on the bars,
`CHANGE_LABEL` aria texts (update them if the vignette adds content), `readout(compare(o))`. Note that
`boardBody` is also rendered in Explore (h 274) and Clinical (h 274): the vignette must be added in
`change()` only, not inside `boardBody`, or those tabs will overflow.

## Reusable primitives this lesson needs

1. Anatomical heart, frontal, apex down-left (patient), great vessels, optional opened LV with aortic and
   mitral valves, animatable squeeze.
2. Shaded vessel tube (artery: thick 3-layer wall; vein: thin wall + valves; arteriole: helical spindle
   smooth muscle), longitudinal cut-away and cross-section ring, radius animatable.
3. Capillary bed mesh over tissue cells with red->blue gradient.
4. Red blood cell (biconcave disc) as a moving particle.
5. Pressure gauge on a manometer stub.
6. Carotid bifurcation with carotid sinus + aortic arch, afferent nerves (CN IX, CN X).
7. Brainstem (medulla/pons) sagittal silhouette with a nucleus dot.
8. Spinal cord + sympathetic chain ganglia; postganglionic fibre; nerve varicosity releasing transmitter.
9. Lipid bilayer strip; 7-transmembrane GPCR (alpha-1, alpha-2, beta-1 variants by label only);
   L-type voltage-gated Ca channel (4-domain pore) with drug plug.
10. Vascular smooth muscle cell (spindle, nucleus) contract/relax; cardiac myocyte strip.
11. Kidney silhouette (small icon).
12. Standing figure silhouette with pooled leg blood (reflex icon).
13. Bar with ghost that never shares a stroke with its ghost; leader-line label helper.

## Risks for the redraw

- **Model-driven geometry**: bar heights (`bars`, UNIT, clamp 1.55), the reflex trace (`steady`, `m0/m1`,
  `yOf` scaled to `1-m0`) and step 7's `v` must stay computed from the model; do not hand-draw final states.
- **Shared board**: `boardBody` renders in the lesson, Explore (`#explore-visual`, h 274) and Clinical
  (`#clinical-visual`, h 274) at the same time; gradient ids must be unique per instance and the board must
  still fit 274 u there.
- **Hooks to keep**: `data-new-state`, `data-ghost="without reflex"`, `data-low`, `data-pressure/rate/flow/
  resistance/volume`, `class="ghost"`; dfn data-parts: arteries, veins, pressure, systolic, diastolic, mean,
  flow, arterioles, resistance, volume, sensor, brainstem, sympathetic, vagus, loop. `data-part="brainstem"`
  appears in steps 8 and 9 (and must stay on both).
- **Animated paths**: step 8's dots must follow the drawn nerve (current bug); if pictures move to
  `mount()`, keep `render(t)` pure in `t` (scrub, half speed, reduced motion `rest`).
- **Label overlap**: denser anatomy (steps 8, 9, 10) on 480 x 420 with 17 u minimum type is tight; use
  leaders into margins, test at 375 x 553.
- **Accuracy traps**: baroreceptor afferents CN IX (carotid sinus) and CN X (aortic arch) to NTS, not the
  carotid body; vagus goes direct to the heart, sympathetics via cord and chain; alpha-1 blockers relax veins
  as well as arterioles; central alpha-2 agonists produce no reflex tachycardia; beta-blocker reflex raises
  TPR; direct vasodilator mechanism (hydralazine) should not be drawn as a specific receptor or channel;
  dihydropyridine CCBs block L-type channels in vascular smooth muscle (not the heart, per the caption); keep
  the arterial wall thicker than the venous wall; veins hold most blood volume.
- **Ghost colour**: FORMAT says ghost is dashed ink or `#8a8f84`; bars and ghost currently share strokes.
