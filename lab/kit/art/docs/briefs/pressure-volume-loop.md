# Redraw brief: pressure-volume-loop (lesson 1, 18 steps)

Audited 2026-11-12 from 36 captures (every step at t=0.35 and t=1) plus app.js, index.html, style.css, model.js.
The owner's complaint ("How can this be the heart?") is about THIS lesson. The heart glyph built by `heart()` in
app.js is in all 18 pictures: step 1 shows it alone and large, steps 2-18 show it small in the top band above the graph.
Redrawing that one function well lifts the whole lesson. The graphs are already decent. They need polish, not a rebuild.

## How the pictures are built (what a redraw must keep)

- Every scene is `{ loop, duration, mount(host) }` built by `picture(kind, build)`. The SVG is 480 x 418 (step 1: 480 x 350).
  Layout: `stage()` puts the heart at `translate(28 4)`, the readout or meters at `translate(240 30)` and the graph at `translate(0 168)`
  (TOP=168; plot area O = {x:42, y:212, top:34, right:462} inside the graph group).
- **The heart is driven by the model.** `heart(parent, {ref, mark}).set(m, clock)` takes a `moment` m with
  `V, P, mitral (0..1 open), aortic (0..1 open), squeeze (0..1), inflow, outflow`. The cavity's DRAWN AREA is proportional
  to model volume (`bagArea`, `BAG` table, `AREA_PER_ML`, `sizeFor(V)`). A redraw must keep that contract: build the
  new cavity shape from one size parameter s, tabulate its area the same way, keep it monotonic, and keep
  `sizeFor(V)` -> s. `ref: [EDV, ESV]` draws dashed outlines at fixed volumes (condition steps, and preload in blue).
  `mark: 'preload' | 'afterload' | 'contractility'` adds the blue cue on the heart.
- data-part names used by `<dfn>`: `ventricle`, `mitral`, `aortic`, `aorta` (on the heart), and `loop`, `sv`, `ef` (on the graph).
  The readout pills also carry `data-part="mitral"` / `"aortic"`. (The atrium has no data-part. Adding `atrium` is fine.)
- Smoke-test hooks: on condition steps the live loop path is `[data-loop]` with `data-final` equal to its final `d`, and the ghost
  is `[data-ghost]`. Steps carry `data-model-shifts`, `data-state`, `data-model-set`. `svg[data-anim]` reads "done" (per the app.js header).
  The loop geometry comes from `shapes`/`beats` (model.js `Simulator`). Never hand-draw a loop.
- model.js exports `espvr(V,p)` and `edpvr(V,p)`, so reference curves can be drawn from the same model if wanted.
- explore.js draws its own graphs and does NOT use `heart()`, so the heart redraw only touches app.js and style.css.

## Global problems

1. **The heart is not recognisable as a heart.** The left atrium is a rounded pink box. The aorta is an L-shaped pink pipe that ends flat in mid-air.
   The ventricle is a U-shaped bag with a flat lid. The valves are two black V-shaped strokes. There is no apex, no septum,
   no papillary muscles or chordae, no pulmonary veins, no aortic arch, no sinuses of Valsalva, no myocardium texture or shading.
   Line weights are mixed: 2 px black outlines on the atrium and aorta, a 11-25 px pink stroke on the ventricle, 2.6 px black leaflets.
2. **The anatomy breaks as it moves.** The valve plane (`HV.mitral`/`HV.aortic`) scales with the cavity, so at end-systole the
   ventricle's base narrows and the atrium's bottom-left corner hangs over empty air (s01 t1, s05 t1, s06 t1, s07 t1).
   The annulus is fibrous and barely moves. Only the cavity should shrink.
3. **Colour is used for two things at once.** Blood colour encodes pressure ("darker red: more pressure"), so the blood goes from almost white to deep red
   within one chamber that only ever holds oxygenated blood. The industry convention is oxygenated = saturated red and
   deoxygenated = blue/purple. The pale pink, near-white blood at low pressure reads as "empty" or "not blood".
4. **Flow and squeeze cues are crude.** Inflow and outflow are black dashed arrows drawn over the chambers. The "squeeze" cue is two small grey
   block arrows outside the wall, and on contractility the blue arrows vanish whenever squeeze=0 (s12 t1).
5. **Wasted band.** Between the heart band and the graph's "pressure" label there is an empty strip about 40 units tall (y about 140-200),
   while the right-hand readout is crowded (s17: "and it beats slower" nearly touches the key).
6. **Small label collisions** (a FORMAT.md violation): s06 t0.35 the horizontal guide runs into "relax". s10 t0.35 the dot sits
   on "more filling". s18 "empties less" sits on the ghost's top edge and touches the new loop's corner, and "bigger" sits on the
   ghost's right edge. s08 "full" crowds "volume ->". s14 "with tighter arteries" ends at about x=478 of 480.
   s09 the EF bar is jammed against the y-axis arrowhead and the "pressure" label.
7. **A readout disagrees with the picture at the lap boundary.** At t=1 on the lap steps (s07-s12) the phase word says "Filling"
   while the mitral pill says "shut" (moment p=0, opening ramp 0). This is minor, but a student pausing there sees a contradiction.
   Fix: the phase word should follow the valve state, or start the opening ramp at p=0 with `opening = 1` on the fill edge after a tiny epsilon.

## The new heart primitive (used by every step)

**View:** a frontal (coronal) long-axis cutaway of the LEFT heart, in anatomical orientation (the viewer looks at the patient's front),
in the style of Netter, Osmosis or BioRender. Base at the top. The apex points down and to the VIEWER'S RIGHT (the patient's left).
State the orientation once in the step 1 aria-label. Do not mirror it between steps.

Structures, top to bottom:
- **Left atrium** (`data-part="atrium"`, new): a thin-walled, rounded, slightly irregular sac at the top right of the heart,
  sitting posterior and superior. Two short **pulmonary vein** stubs enter from the right (step 1 labels them "from the lungs"; the band steps leave them unlabelled).
  The wall is thin (about 2 units) in a muscle tone. The lumen is oxygenated red.
- **Mitral valve** (`mitral`): a fibrous annulus ring drawn as two small pale ellipse ends. Two leaflets: the anterior leaflet is longer and
  continuous with the aortic root (the aortomitral curtain), the posterior leaflet is shorter. Drawn as tapered filled shapes, not strokes.
  **Chordae tendineae** are three or four hairlines from each leaflet tip to two **papillary muscles** (rounded cones rising from the free wall and the floor).
  Open (m.mitral=1): the leaflets swing down toward the apex, chordae slack. Shut: the leaflets meet just below the annulus plane with a
  slight dome toward the atrium, chordae taut. The papillary muscles shorten a little with squeeze.
- **Left ventricle** (`ventricle`): a bullet or ellipsoid cone whose long axis is tilted about 25-30 degrees so the apex points down-right.
  The **myocardium** is a thick band (about 3 times the atrial wall) with a radial gradient (deep muscle `#7a2a24` outside to `#a8453b`
  at the endocardium), a faint highlight on the upper-left outer curve, and a few fine fibre striations at 15% opacity. The **interventricular septum**
  forms the left border of the cavity. Show a sliver of the **right ventricle** beyond it, muted and desaturated, with blue-purple
  deoxygenated blood (`#5b6fb0` at 35% opacity), so the heart reads as a heart without competing with the subject.
  **Wall thickening:** the myocardium AREA is conserved, so as the cavity shrinks the wall thickens. Compute the outer contour from the
  cavity contour plus the area of a fixed muscle mass. This replaces the ad-hoc `th = 5.5 + 7*(1-s) + 1.5*squeeze`.
  **Squeeze cue:** the wall tone deepens by about 15% and a faint inner highlight line runs along the endocardium. Drop the grey block arrows.
- **Aortic valve and aorta** (`aortic`, `aorta`): the aortic root rises from the LV outflow tract at the top left of the ventricle, medial to the mitral
  valve. Draw two visible **semilunar cusps** with small **sinus of Valsalva** bulges behind them. Open: the cusps lie flat against the sinus walls.
  Shut: the cusps meet in the centre with a slight belly toward the ventricle. The ascending aorta rises up and to the viewer's left, then the **arch**
  curves over the top toward the viewer's right and the descending aorta is cut off behind the atrium with a clean
  elliptical cut face, showing wall thickness and lumen (not a flat-ended pipe). The vessel wall is a pale arterial tone with a 1.5 px darker outline.
  The lumen is oxygenated red. The three arch branches can be short stubs (optional; do not label them).
- **Blood:** always oxygenated red in the left heart (radial gradient `#d2473a` to `#a3281f`, with a soft specular highlight near the top of each chamber).
  **Remove the pressure-to-blood-colour encoding.** Pressure is already shown on the graph and by the dot. If a cue is wanted in the band,
  use a small vertical "pressure" gauge beside the heart in the readout column, and change the readout line "darker red: more pressure" to match.
- **Flow:** translucent pale streamlines inside the lumen (white at 55% opacity, 3 units wide, rounded, with dash offset animated by `clock`).
  From the pulmonary veins through the LA and the open mitral valve toward the apex in filling. From the apex up the outflow tract, through the
  aortic valve and round the arch in ejection. Use small chevron heads, not black triangles. Opacity follows `m.inflow` / `m.outflow` as now.
- **Fixed parts vs moving parts:** the LA, annuli, aortic root and arch are FIXED. Only the LV cavity, wall, papillary muscles, leaflets and cusps move.
  The overhang bug then cannot happen.
- **Refs** (`ref`): dashed outlines of the CAVITY (endocardium) at the given volumes, `#8a8f84` 1.5 px. In condition steps add a two-word key
  beside the heart or in the readout: dashed = "normal full / normal emptied". Better still, draw only the EDV ref dashed and the ESV ref dotted, and
  name them in the key.
- **Marks:** preload = a blue dashed endocardial outline at EDV plus a small blue arrow stretching the free wall outward.
  afterload = a blue arrow pressing down the ascending aorta onto the closed cusps (keep it, but draw it inside the lumen with a white halo).
  contractility = blue chevrons along the myocardium pointing inward, ALWAYS visible (not multiplied by m.squeeze), pulsing slightly with squeeze.
- Size: in step 1 the heart fills about 270 x 300 units. In the band (steps 2-18) the same drawing is scaled to fit about 200 x 160 at `translate(20 4)`.
  At 375 px the band heart is about 155 px wide: drop the chordae to two per leaflet and the striations at that scale (pass a `detail` flag).

## Per step

### 1 heart: "Meet the left ventricle". Grade 2/10
Problems: everything in "Global problems" 1-4. The atrium is a box, the aorta a pipe, the ventricle a bag. Leader lines all fan out from one column,
and the mitral leader runs across the whole ventricle. The aorta label sits right on the pipe's cut end.
"inlet door" / "outlet door" are fine plain words. The heart shrinks by about 40% at end-systole, so at t=1 the drawing looks broken (the atrium floats).
Redraw: the full heart primitive, large (left 60% of the frame), beating on the normal lap. A label column on the right at x about 300,
with 5 labels each in bold and small type: Left atrium ("holds blood from the lungs"), Mitral valve ("inlet door"),
Left ventricle ("the main pump"), Aortic valve ("outlet door"), Aorta ("main pipe to the body"). Optionally add "from the lungs" small at the
pulmonary vein stubs. Leader lines are 1.25 px ink with a 3-unit dot at the structure. Route each leader horizontally then diagonally,
so no two cross and none crosses the cavity. Order the labels top to bottom by their target's y. Keep `rest: 0.16` (mid-filling, mitral open)
so the reduced-motion still shows an open inlet. Keep data-parts ventricle, mitral, aortic, aorta. Add atrium.

### 2 axes: "Two things to watch". Grade 4/10
Problems: the band heart has the same faults. The two target spots are dashed rings whose labels float well to the side, so at t=0.35
"nearly empty, relaxed" reads as a label on the moving dot. The volume and pressure meters are plain red bars on white, with no tie to the axes.
Redraw: new heart. Graph: put each target label directly beside its ring with a 6-unit gap (relaxed: right and below; full: left and above).
Colour the meters to match the axes: draw a small "volume ->" and "pressure ^" glyph at the start of each bar, or make the pressure meter vertical, so the
mapping to the graph is obvious. Keep the guide projections (they are good).

### 3 fill. Grade 5/10
Problems: the heart (global). The graph is clean. The red edge draws itself and the projection guides are clear. The "filling" tag is good.
Redraw: new heart (mitral open, streamlines from the pulmonary veins into the LV, chordae slack). Graph unchanged, except a very light fill under
the drawn edge is NOT needed. Keep it as is.

### 4 contract. Grade 5/10
Problems: the heart's "squeeze" is grey block arrows. Both valves shut is shown only by black V lines.
Redraw: new heart with both valves visibly closed (mitral domed with taut chordae, aortic cusps coapted), wall deepening and thickening, cavity size held.
Graph unchanged.

### 5 eject. Grade 5/10
Problems: the black dashed arrow up the aorta crosses the cusp lines. At t=1 the shrunken ventricle detaches from the atrium.
Redraw: new heart with the cusps flat against the sinus walls and streamlines up the outflow tract and round the arch. The fixed annulus fixes the detachment.
Graph unchanged.

### 6 relax. Grade 4/10
Problems: at t=0.35 the horizontal guide runs into the "relax" tag (overlap). The heart detaches.
Redraw: new heart (both shut, wall paling and thinning, cavity small). Move the "relax" tag to the INSIDE of the loop (anchor start, x = left edge + 12),
or hide the horizontal guide's segment under the label. FORMAT forbids the current overlap.

### 7 loop: "One heartbeat, once round the loop". Grade 6/10
Problems: the graph is good (numbered phase tags, mid-edge arrowheads, active tag in red). Readout contradiction at t=1 ("Filling" / mitral shut).
Redraw: new heart. Graph lift: add four small valve-event markers at the corners (open ring = a valve opens, filled ring = a valve shuts,
2-3 px ink, no text) so the corners read as events. Optionally add a very light red fill inside the loop (6-8% opacity) to give it body.
Fix the boundary state (Global 7).

### 8 sv: "Stroke volume". Grade 6/10
Problems: the dashed guides at ESV and EDV are drawn on top of the loop's red vertical edges (a muddy double stroke). "full" crowds "volume ->".
Redraw: run the guides only BELOW the loop (from the loop's bottom corners down to the axis) and above it, not along the edges.
Put "after pumping" / "full" in a row just under the axis, and move "volume ->" to sit right-aligned on the axis line's end, or one row lower.
Optionally shade the band between ESV and EDV under the axis as a red bracket. Keep `data-part="sv"`.

### 9 ef: "Ejection fraction". Grade 5/10
Problems: the EF bar sits at the very top of the plot, jammed under "pressure ^" and over the axis arrowhead. "left behind" has a halo bleed on the
light-grey segment. The loop is faded to 45%, which looks washed out rather than intentional.
Redraw: put the bar UNDER the volume axis (a horizontal stacked bar spanning 0 -> EDV, aligned to the same x scale, about 26 units tall), so it reads as
a measure of the x axis. Use a hatched or light-grey "left behind" segment and a solid red "pumped out" segment. Keep the loop at full strength but thinner (3 px).
In the heart band, show the ventricle cavity at EDV with the ESV portion tinted darker, as a second, anatomical view of the same share (optional).
Keep `data-part="ef"`.

### 10 preload. Grade 5/10
Problems: at t=0.35 the dot sits on "more filling". The blue arrow is short and floats. The blue dashed EDV outline on the bag is the best cue in the
lesson, but it sits over a bag, not a ventricle.
Redraw: new heart with the blue EDV endocardial outline (mark). Graph: move "preload / more filling" to the right of the edge, ABOVE the
squeeze-start corner (y < corner y - 12), so the dot never passes over it. Lengthen the arrow to about 50 units.
Lift (optional, accurate): a faint EDPVR curve from `edpvr()` under the bottom edge, unlabelled or labelled "stretch limit". Only if the caption is
updated to name it. Otherwise leave it out.

### 11 afterload. Grade 5/10
Problems: the arrow on the heart is a blue line on the pink pipe. On the graph the arrow and words float above the top edge (acceptable).
Redraw: new heart with the arrow inside the ascending aorta, pressing on the closed cusps. Optionally show the arterial wall slightly thicker or tighter.
Graph as is. Lift: none needed.

### 12 contractility. Grade 4/10
Problems: the blue ring on the top-left corner plus an arrow into empty space is abstract. The heart's blue squeeze arrows are invisible at rest (t=1)
and near-invisible at t=0.35. Industry figures show contractility as the slope of the end-systolic pressure-volume line (ESPVR).
Redraw: new heart with always-visible inward blue chevrons on the myocardium. Graph: draw the ESPVR from `espvr(V, DEFAULTS)` as a thin ink line from
the V0 point on the volume axis through the top-left corner, extended about 30 units beyond it, and a blue ghost line rotated steeper with the label
"stronger squeeze: steeper line, empties further". Accuracy: the line must pass through the model's end-systolic point. Check this against `beats.base`.
If the caption is not updated to mention the line, keep the current ring-and-arrow but move the label outside the loop.

### 13-18 condition steps (fluids, constrict, inotrope, venodil, beta, hfref). Grade 5/10 each
What is good: the dashed grey ghost, the morph from normal to changed, blue note arrows naming what moved, the stroke-volume bar against a dashed normal bar,
and a key. These meet FORMAT's "What changes it" rule.
Problems: the heart (global), with two unlabelled dashed cavity outlines inside it. The readout column is cramped (s17 "and it beats slower" nearly touches the key).
s14's title runs to the edge. s18 "empties less" sits on the ghost's top edge, and "bigger" sits on the ghost's right edge and touches the red edge at t=0.35.
s16 "fills less" butts against the red edge.
Redraw:
- The new heart with the normal EDV (dashed) and ESV (dotted) cavity outlines, named in the key ("normal: full / emptied").
- Readout column: the title (24, red) wraps to two lines if it is longer than 220 units. "blood pumped per beat" bars stay. Put the "more/less per beat"
  and "beats slower" lines in one block with 22-unit spacing, then the key 30 units below.
- `notes()` placement: keep the label clear of BOTH loops and the ghost. Use a halo (paint-order stroke, already in .lp-t) AND a placement test against the ghost's
  points, the same way `clear` does for the top edge. For hfref put "empties less" BELOW the arrow inside the old loop, and "bigger" to the right of the new right edge.
- Optional lift: for inotrope, beta and hfref, draw the ESPVR ghost and the new ESPVR (both from `espvr()` with that condition's Ees). This is the
  textbook way these three are drawn. Only add it if step 12 introduces the line.
- Beta-blocker: the slower-rate statement is only in words. Optionally show a small "beats per minute" pulse dot that blinks at the model HR beside the heart.

## Graphs: verdict
The loop graphs are the strong part of this lesson: model-driven, worded axes, clear dot plus projection guides, edges drawn in order, mid-edge arrowheads,
a clean ghost-and-morph on the change steps. They are about 6/10 against the bar. What would lift them:
- Consistent marks: one loop stroke (4 px red) and one ghost (3 px dashed #8a8f84), and stop drawing guides on top of loop edges (s08, s09).
- A very light area fill inside the active loop (stroke work), the same across steps.
- Valve-event corner markers on step 7 and onward.
- Optional model-derived ESPVR/EDPVR reference lines for steps 10, 12 and the inotrope, beta and hfref steps. Add them only with caption support.
- Fix the label collisions listed above. Keep axes gridless (already).

## Reusable primitives (for a shared library)
- `leftHeartLongAxis({ size, mitral, aortic, squeeze, inflow, outflow, clock, refs, mark, detail })`: frontal cutaway, fixed LA/annuli/aortic root/arch,
  area-calibrated LV cavity with a conserved myocardial mass, papillary muscles and chordae, RV sliver. (Also wanted by heart-anatomy and the cardiac lessons.)
- `atrioventricularValve(open)`: two tapered leaflets plus chordae plus papillary muscles.
- `semilunarValve(open)`: cusps plus sinuses of Valsalva, in section.
- `vesselSection(path, { wallTone, lumen: 'oxy' | 'deoxy', cutEnd: 'ellipse' })`: a vessel with wall thickness, lumen and an elliptical cut face.
- `bloodFill('oxy' | 'deoxy')`: radial gradient plus specular highlight, shared ids.
- `myocardiumFill`: radial gradient plus a striation pattern.
- `flowStreamline(path, opacity, clock)`: a translucent animated flow arrow inside a lumen.
- `leaderLabel(target, labelXY, title, sub)`: an orthogonal or diagonal leader with a dot, plus collision-avoidance stacking.
- Graph: `pvLoop`, `ghostLoop`, `projectionGuides`, `edgeNote` (exists as `notes()`), `espvrLine`, `edpvrCurve`, `valveEventMarker`.

## Risks
- **Area-volume contract:** the new cavity shape must be re-tabulated (`BAG`, `AREA_PER_ML`) or the ventricle stops matching the model.
  Keep `sizeFor` monotonic over s in 0.2-1.6. The HFrEF EDV is the largest, so check it does not overflow the band (it already reaches about x=440 of the band).
- **Fixed annulus:** the cavity top must stay attached to a fixed valve plane at every size, from the smallest inotrope ESV to the HFrEF EDV.
- **heart() signature:** `heart(parent, {ref, mark}).set(m, clock)` is used by every step. Keep it, or change all callers together.
  `moment()` fields (mitral, aortic, squeeze, inflow, outflow) are the API.
- **data-part names:** `ventricle`, `mitral`, `aortic`, `aorta` must stay on the new structures (the dfn highlights in captions 1 and following).
  The readout pills share `mitral`/`aortic`. Highlight styling must work on filled shapes, not just strokes.
- **Hooks:** `[data-loop]`/`data-final`, `[data-ghost]`, step `data-model-shifts`/`data-state`/`data-model-set`, `svg[data-anim]`, and `rest`/`loopFrom` timings
  (`condTiming`) must be untouched. The graph geometry (X, Y, O, TOP) must not change scale, or the notes and the clinical-values cross-check drift.
- **Colour change:** dropping the pressure-to-blood-colour mapping means editing the readout line "darker red: more pressure" and the aria-labels for
  steps 4 and 6 ("turns a darker red as its wall squeezes", "turns paler"). Update LABEL text to match the new cue, or the aria and the picture disagree.
- **Orientation flip:** moving the aorta to the viewer's left and the LA to the right changes where the readout sits relative to the arch. Recheck that
  nothing crosses x=240 in the band (the readout starts there).
- **Accuracy traps:** the anterior mitral leaflet is continuous with the aortic root (aortomitral continuity). The aortic valve is anterior and medial to the mitral.
  Closed aortic cusps belly toward the LV. Closed mitral leaflets coapt slightly below the annulus with no prolapse into the LA. The apex points to the patient's left.
  The LV wall is about 3x the RV wall. Do not draw a tricuspid aortic valve as 2 visible cusps plus a "third" leaflet in front. In section, two cusps are correct.
  Do not invent coronary anatomy. Any ESPVR or EDPVR must come from model.js, not be drawn by eye.
- **Phone legibility:** the band heart is about 155 px wide at 375. Chordae and striations become noise, so use the detail flag.
- **Text minimums:** all labels at 17 units or more (`.lp-small` is 17, OK). New key text in the band must not drop below 17.
