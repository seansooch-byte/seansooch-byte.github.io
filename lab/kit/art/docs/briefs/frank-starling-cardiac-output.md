# Redraw brief: frank-starling-cardiac-output (Lesson 3)

Audited 2026-11-12 from captures at t = 0.35 and t = 1 of all 16 steps
(`scratchpad/audit/shots/frank-starling-cardiac-output/`), plus `index.html`, `app.js`, `style.css`.

**Overall grade: 4/10.** The anatomy (steps 1, 2, 3, 5, 9) is the same "pink bag with two pipes" the owner
rejected in lesson 1, and it carries one real anatomical error: blood "in from the lungs" goes straight into
the ventricle, with no left atrium. The micro picture (step 4) is a fair schematic. The graphs (steps 6, 7,
11 to 16) are clean and already pass, but each has small things that would lift it. The change steps never
show a heart at all.

## House style for every anatomical redraw in this lesson

- **One shared left-heart primitive** (see Primitives) used by steps 1, 2, 3, 5 and 9 and by the optional change-step inset. It must stay **driven by `ventricleGeometry(cx, by, v, k)`**: `v` (EMPTY 0.4 to about 1.15) sets the cavity size, and the wall thickens as `v` falls. Keep `beat(u)` as the timing source.
- Palette: oxygenated blood `#c4453a` (BLOOD), with a radial gradient to `#a8322a` at the rim and a soft highlight `#e06a5c`. Myocardium is a warm muscle tone, `#e9b3a6` to `#c97a6c`, with a linear gradient across the wall (lighter on the epicardial light side, upper left) and a 2.5 stroke in `#7c2a22`. Endocardium: a 1 px lighter inner line. Valve leaflets are off-white `#f6efe6` with a `#7c2a22` 1.5 stroke. Epicardial fat or coronaries are optional: at most one LAD hint line in the interventricular groove, and only on step 1.
- Line weights: organ outline 2.5, internal structure 1.5, leader lines 1.25 in ink at 70 % opacity, ending in a 2.5 r dot on the structure. Labels sit in the free margin on a shared column (x = 330 to 464 or x = 16 to 150) and never sit inside the organ.
- Gradients need unique ids per scene (prefix `fs-`). The kit inlines several SVGs on one page, and the clinical tab and explore tab render `changeBody` at the same time.
- Accuracy anchors from `clinical-values.json`: EDV 110 to 120 mL, SV about 70 mL, so ESV is about 45 mL and EF about 60 %. Any picture that draws EDV, ESV and SV as areas or bars must keep **ESV/EDV near 0.4** (this already matches `EMPTY = .4`, but `v` is a shape parameter, not a volume; compute the drawn area ratio, or draw volume bars from the model rather than from the geometry).

---

## Step 1: "A pump for the body" (`heart`, loop, rest .55): grade 3

**Now:** a symmetric bullet-shaped bag hangs from two orthogonal L-pipes. "In from the lungs" enters the
ventricle directly, so the left atrium is missing (**anatomically wrong**: pulmonary veins → left atrium →
mitral valve → LV). The valves are two V-shaped strokes, and a shut valve is a flat bar. The apex points
straight down. Nothing reads as a heart. The label column is fine.

**Redraw:** a **frontal-section left heart** in the Netter or Osmosis style, filling about 300 × 290 on the left:
- **Left atrium**: a rounded chamber above and behind (upper left), receiving **two pulmonary veins** from the left edge, labelled "from the lungs". The veins are tubes with a wall stroke and lumen and carry flow drops.
- **Mitral valve**: two leaflets (anterior longer) with 2 or 3 **chordae tendineae** running down to a **papillary muscle** bump on the LV wall. The leaflets swing open into the LV during `fill` and meet (coapt) during `shut` and `squeeze`.
- **Left ventricle**: a conical chamber with the **apex pointing down and to the left** (rotate the bullet about 25° by applying `transform="rotate(-25 cx by)"` to the chamber group only, so `ventricleGeometry` stays untouched). It has a thick muscular wall with gradient shading and the interventricular septum on its right side. A sliver of the RV, shown as a crescent in a muted, lower-saturation purple-red tone, makes it read as a heart. Wall thickness still comes from `w`.
- **Aortic valve**: three semilunar cusps drawn as small cups at the LV outflow, beside the mitral valve (they are in fibrous continuity, so keep them adjacent as now). Open cusps are pressed to the wall; shut cusps are three cups that meet.
- **Ascending aorta and arch**: rises from the base and curves up and over to the right, then descends off the right edge. It carries the "to the body" label and a tube with wall and lumen.
- Flow drops: keep `drops()`, but run them on a curved path through LA → mitral → LV during fill and LV → aorta during squeeze.
- Labels with leaders: "left atrium", "mitral valve", "left ventricle" (`data-part="ventricle"`), "aortic valve", "aorta". The phase words ("relaxes and fills" / "squeezes blood out" / "valves shut") stay in the bottom-right block. Rename "inlet valve" and "outlet valve" to "mitral valve open" and "aortic valve open". The caption already says "one-way valves", so naming them is safe.
- Height: keep at or under 340 and at least 17-unit text. On a 375 px phone, five leader labels is the maximum.

## Step 2: "First, blood returns" (`fill`, once): grade 3

**Now:** two identical bullets with stub pipes. The "returning blood" is a free-floating red rectangle with
a 26-unit gap above the inlet stub, so it connects to nothing. The outlet stub is drawn but irrelevant. A
grey rule splits the panes. The outcome words ("fills less" / "starts fuller") are not parallel.

**Redraw:** two copies of the step-1 left-heart primitive at k ≈ 0.7, cropped to **LA + LV only** (the aorta
as a short capped stub with its valve shut). The incoming **pulmonary vein is a real tube** whose lumen width
is the stream (6 vs 20 now). Better: draw the vein at constant width and vary **how many drops, and how fast,
flow down it**. Variable lumen wrongly implies a narrower vessel. Use drop density 2 vs 6 and speed 1 vs 1.8.
Under each LV, place an **end-diastolic outline ghost of the normal fill** (dashed `#8a8f84`), so "less" and
"more" read against normal. Keep `data-part="return"` on the vein and its drops. Bottom words should be
parallel: "fills less" / "fills more". Keep `u` from `span(t, .1, .85)` and the targets .74 and 1.14.

## Step 3: "Filling stretches the muscle" (`stretch`, once): grade 4

**Now:** a bullet LV with a blue arc in the wall, and a dashed leader that starts inside the blood cavity and
crosses it to a pill with 5 stripes, labelled "one muscle fibre". The pill does not look like cardiac muscle,
and the leader crosses the chamber.

**Redraw:** keep the left LV (the step-1 primitive, LA and aorta stubs), with the blue fibre arc in the wall
as now (`data-part="preload"`). Add a **magnifier callout**: a small circle on the wall where the arc is, with
two tangent lines (not one dashed line through the cavity) opening to a circular or rounded-rect inset on the
right. Inside the inset draw a **cardiomyocyte**: a branched, striated cell (Y-branch at one end), with
cross-striations (alternating light and dark bands at a period set by `L`), one central oval nucleus, and
**intercalated discs** as stepped dark lines at both ends joining stubs of the neighbouring cells. As `u` goes
0 → 1, the cell lengthens (118 → 176 now) and the band spacing widens. The dashed ghost outline of the
start-length cell stays (class `ghost`). Below: "stretched by filling", then "preload:" plus "the stretch
before the beat begins" (as now). Only the cell lengthens. The nucleus may elongate slightly but must not
multiply.

## Step 4: "More stretch, more force" (`stretchmore`, once): grade 5

**Now:** a reasonable sarcomere schematic. Z-lines are black bars, thin filaments are grey lines, thick
filaments are black rods with chevron "heads" (blue when they can pull, grey when crowded), the start-length Z
positions are dashed ghosts, and there is a force bar with a dashed baseline. Problems: the parts are
unnamed, so a learner cannot tell actin from myosin. The heads are tick marks. The picture shows only the
overlap or "crowding" story, while the caption also says stretch "makes them respond more strongly"
(length-dependent activation). The force bar has no scale or anchor. "blue heads can pull" is the only key.

**Redraw (keep the `sarcomere(L)` force model exactly, since it computes `force`):**
- **Z discs**: zig-zag vertical lines (classic EM-schematic look), ink.
- **Thin filament (actin)**: a double row of small beads (two offset circle rows, r ≈ 2.5, `#8a8f84` fill with ink 0.75 stroke), anchored to the Z disc.
- **Thick filament (myosin)**: a rod with **golf-club heads** (a short neck plus an oval head). A pulling head is blue, angled 45° toward the M line, and touching an actin bead. An idle head is grey, at 90° and not touching. Bare zone in the middle, **M line** as a thin vertical.
- **Titin**: a thin spring (sine or coil) from each Z disc to the thick filament tip. It stretches visibly with `L`. This is accurate and is the best visual cue for "stretch".
- Labels with leaders (17-unit text): "Z disc", "thin filament (actin)", "thick filament (myosin)". Keep "myosin heads that can pull" as a small key swatch (blue head glyph) rather than the free sentence.
- **Length-dependent activation, optional and only if the owner agrees**: a few Ca²⁺ dots near the thin filaments, a little denser at t = 1, with a small label "more sensitive to calcium". This matches the caption's "respond more strongly". Do not add it without the caption's support; the caption already supports it.
- Force bar: keep `data-part="force"`. Add a base tick labelled "force" and the ghost line labelled "before" (17 xs muted). Give the bar a subtle vertical gradient. The "↑ more" word stays.
- The double-headed stretch arrow and the dashed start Z lines stay.

## Step 5: "Blood in one beat" (`eject`, loop, rest .96): grade 3

**Now:** the bullet-and-pipes heart, plus a dashed arrow from the aorta pipe's cut end into an open cup that
fills to roughly 2.5× the area the chamber lost. **The cup's volume visibly contradicts the chamber's**, which
teaches the wrong proportion. "some stays behind" appears only after the squeeze.

**Redraw:** the step-1 heart primitive (LA, mitral, LV, aortic valve, aorta) at k ≈ 0.85 on the left. On the
right, replace the cup with a **volume column** (a graduated cylinder or a stacked bar) built from the model,
not freehand:
- During `fill`, the column shows the LV's contents rising to **EDV**.
- During `squeeze`, the top segment (SV, BLOOD with a highlight) visibly lifts off and arcs into the aorta, while the bottom segment (ESV, darker `#8e2a22`, hatched or labelled "stays behind") remains.
- Bracket labels: "filled: end-diastolic volume", "stroke volume" (`data-part="sv"`) and "left behind". ESV ≈ 0.4 × EDV, from the reference data.
- Alternatively, draw the LV at end-diastole as a dashed ghost outline over the end-systolic cavity and shade the crescent between them blue-wash as "stroke volume". This is the Osmosis convention, and it reads at phone size. **Pick one, not both**; the column is clearer.
- Keep "some stays behind" as a persistent label on the ESV segment.

## Step 6: "Follow the rising curve" (`curve`, once): grade 6, a graph that already works

**Good:** a clean self-drawing curve, a dot that rides the tip, dashed drop-lines, and a resting point.
**Problems:** the "steep" note sits in empty space top-left, far from the steep segment. The curve's early
part is not visibly "steep" relative to the axes. Axes have no anchoring ticks.
**Lift:**
- Add **slope triangles**: a small Δx with a large Δy on the early rise (blue-wash fill), and the same Δx with a tiny Δy on the plateau. Each triangle carries its words, so "steep" and "levels off" point to geometry.
- Add a faint blue-wash area under the curve (opacity 0.12) for weight, and a soft drop shadow (or a 7-unit white underlay) under the 5-unit curve stroke so it lifts off the panel.
- Add an x-axis tick at the resting filling labelled "normal" (xs muted), and small muted secondary axis names under the plain ones: "(end-diastolic volume)" and "(stroke volume)". The caption introduces both.
- Keep `data-part="fscurve"`, `CH`, `px`, `py` and `curveD` untouched.

## Step 7: "Strength is a separate input" (`strength`, still): grade 7, a good graph

**Good:** three curves, end labels, a same-filling guide, and dots stacked on it. **Lift:**
- Draw the normal curve as the **dashed ghost** (`#8a8f84`, 3 wide) to match the change steps' convention for "normal".
- Fill the band between normal and stronger with blue-wash and the band between normal and weaker with red-wash (opacity 0.18), so "whole curve sits higher or lower" reads as an area, not three lines.
- Add short vertical arrows from the normal dot up to the blue dot and down to the red dot.
- `data-part="contractility"` is currently on two separate groups (curves and dots). Keep both, or merge them into one group.

## Step 8: "Count the beats" (`rhythm`, loop): grade 4

**Now:** two pseudo-ECG traces whose complexes are drawn **up, deep down, tall up**: a malformed QRS with no P
or T wave. Red dots pop above each R. The "time to fill" bracket spans from the end of one QRS to the start of
the next, so it **includes systole**, which is inaccurate (filling happens in diastole only). The "shorter"
label floats under a bracket that is offset from the beats.

**Redraw:** two rows, "slower heart" and "faster heart". Each is a **timeline strip of cardiac cycles**:
- **Top line (small, muted)**: a proper ECG, P wave, then QRS (small Q down, tall R up, small S down), then T wave, at 2.5 width.
- **Under it, a two-tone band** aligned to the ECG. Each cycle has a **systole block** (rose `#f3d9d4` with a red edge, labelled once "squeeze") of **nearly constant width** in both rows, and a **diastole block** (blue-wash, labelled once "fill", `data-part="fillgap"` on one representative) whose width is what shrinks in the faster heart. This is the physiologically correct message: rising heart rate shortens diastole far more than systole.
- Optionally, a thin LV-volume trace above the band (it rises during fill and drops during squeeze). Skip it if the phone height is tight.
- The sweep line stays. Swept cycles turn from grey to colour. The beat count in each row is labelled at the right end ("4 beats", "7 beats") and fades in at t ≈ 0.95. `data-part="rate"` goes on the beat-count labels, so the dfn lights something in this step too (currently `rate` lights nothing here).
- Clip-path ids `fs-sweep-${y}` must stay unique.

## Step 9: "The flow over a minute" (`output`, once): grade 3

**Now:** a tiny stub ventricle, a red ball that arcs across, and a beaker with 5 ticks that fills in 6 steps.
Six beats are presented as "a minute of beats" with no hint that this is compressed. The ventricle has no
outflow.

**Redraw:** the step-1 heart primitive at k ≈ 0.6 (LV and aorta only), with the aorta arching right. Each
squeeze sends one **SV dose** (a rounded blob the same visual size as step 5's SV segment, `data-part="sv"`)
along the aorta into a **graduated cylinder** whose tick spacing equals one dose (the existing tick logic).
Beat counter: six small heart glyphs or ECG ticks under the heart (`data-part="rate"`) that fill blue as they
fire. Add an equation strip under the cylinder: "stroke volume × beats per minute = cardiac output"
(`data-part="co"` on the cylinder fill). Add a muted footnote "6 beats shown; a resting heart beats about 72
a minute". The number comes from `clinical-values.json` hr.typical; render it from data, not hard-coded.

## Step 10: "See the whole picture" (`whole`, still): grade 5

**Now:** a tidy flowchart of white rounded boxes, arrows, a × node and a blue output box. It is functional
but clip-art. The afterload box floats with no relation to anything.
**Redraw:** keep the layout and all `data-part`s (`preload`, `contractility`, `rate`, `sv`, `afterload`,
`co`). Give each input a **36-unit glyph** at the left of its box: filling = a mini LV with a fill level;
strength = a mini sarcomere or muscle fibre; heart rate = 2 ECG complexes; blood per beat = a blood drop;
cardiac output = a mini graduated cylinder. Give the afterload box a mini aortic arch glyph and a **dashed
arrow into "blood per beat"** labelled "held steady". This is more accurate: afterload does affect stroke
volume, and the lesson simply holds it fixed. Use consistent 2-unit strokes and a subtle box shadow
(feDropShadow dy 1, opacity .12).

## Steps 11 to 16: the "What changes it" charts (`fluids`, `diuretics`, `inotropes`, `beta`, `nitrates`, `failure`): grade 6 each

**Shared good:** the dashed ghost of normal, morphing state, named words and arrows, per-minute bars over
dashed normal bars, and the readout. These meet FORMAT.md.

**Shared problems:**
1. **No heart anywhere.** The learner spent nine steps on a ventricle, then sees only a graph.
2. **Colour inconsistency:** step 7 draws a weaker heart in **red**, but the failure step draws its weakened curve in **blue**. The words say red, the curve says blue.
3. The heart-rate bar is constant ("the same") in 5 of 6 steps, which is dead weight, though harmless.
4. In fluids, diuretics and nitrates, the dashed ghost curve is hidden under the identical blue curve, so the "dashed grey ghost" is invisible apart from the ghost dot.

**Shared lift:**
- Add a **mini ventricle inset** in the empty lower-right of the chart (about 90 × 110, at x 360 to 450, y 150 to 250, *after* moving the named words to the upper-left free area, or stacking words above the inset). It shows the end-diastolic LV outline from the shared primitive driven by `v = o.filling` (with ESV derived from `o.sv`), drawn over a dashed ghost of the normal outline. It is static per frame (no beating needed) and makes "fills more or less" and "squeezes harder" visible as anatomy. It must accept any Explore-slider state (filling 0.5 to 1.6, strength 0.45 to 1.5, rate 0.6 to 2.2) without leaving its box.
- Fill the area between ghost and new curve with blue-wash (lift) or red-wash (drop) for inotropes, beta's first stage and failure.
- In fluids, diuretics and nitrates, label the shared curve once, "same curve", near its plateau, so the ghost's invisibility is explained.

**Per step:**
- **11 fluids:** good. Inset: LV outline larger than ghost. Optional vein glyph with a "+ IV fluid" drop.
- **12 diuretics:** good. Inset smaller.
- **13 inotropes:** good. Add the blue-wash band between the curves. Inset: same EDV outline, smaller end-systolic cavity (stronger squeeze).
- **14 beta (two stages):** **no arrow is drawn at all** (`namedArrows` has no `beta` branch). The normal ghost dot, the stage-1 mid ghost dot and the final dot pile up in a 30-unit cluster, and the four lines of words crowd under the curve. Fix: add a short down-arrow (stage 1, ghost dot to mid dot) and a short right-arrow (stage 2, mid dot to final dot), both offset 18 units below the curve. Move the stage-2 words below the stage-1 words with an 8-unit gap, or put stage 2 above the curve at upper left.
- **15 nitrates:** good. Optional mini vein glyph widening (venodilation) beside "veins hold more blood".
- **16 failure (two stages):** **bug:** at t = 1 the red stage-1 arrow collapses to a bare triangle head over the ghost dot. `namedArrows` clamps its end to `min(y2, py(o.sv) - 10)`, and once stage 2 lifts `o.sv` the shaft has zero length. Fix: draw the stage-1 arrow from the normal ghost dot to the **mid** dot (`mid.sv`) and leave it there. Draw the weakened curve **red** (matching step 7) with the dot red-ringed, or keep the blue dot as "the heart now" but make the curve red. Add a red-wash band between ghost and curve. Inset: a dilated LV with a thin wall is **not** accurate for every failure type (the caption says some failure keeps a normal squeeze), so show only "larger end-diastolic outline, larger leftover cavity" and say nothing about remodelling.

Graph lift common to all charts: no gridlines (keep it gridless). Axis stroke 2, curve 5 with a white
underlay, dots 9 r with a white 2.5 ring (as now). One annotation per idea, placed on the geometry it names.

---

## Reusable primitives this lesson needs

1. **Left heart, frontal section, animatable**: LA with 2 pulmonary veins, mitral valve (2 leaflets, chordae, papillary muscle, open↔shut by a parameter), LV whose cavity and wall are driven by `ventricleGeometry` (v, wall thickness), apex down-left, septum edge with an RV crescent, aortic valve (3 semilunar cusps, open↔shut), ascending aorta and arch. Options: `crop: 'lv' | 'la+lv' | 'full'`, scale `k`, a flow-path accessor for drops. The same primitive is wanted by pressure-volume-loop (lesson 1).
2. **Vessel tube with wall and lumen** along an arbitrary path, with flow drops (generalising `tube` and `drops`).
3. **Cardiomyocyte**: branched, striated, central nucleus, intercalated discs, parametric length.
4. **Sarcomere**: zig-zag Z discs, bead-chain actin, golf-club myosin heads (pulling or idle states), titin springs, M line, driven by length L (keep the existing overlap-force logic).
5. **Magnifier callout**: a circle on the source plus tangent lines to a round inset.
6. **ECG trace**: P-QRS-T complexes at a given rate, with a systole and diastole band strip beneath.
7. **Volume column or graduated cylinder**: stacked EDV, SV and ESV segments, dose blobs, tick spacing in SV units.
8. **Chart kit additions**: a white underlay for curves, a between-curves wash band, slope triangles, an x-tick marker with label.
9. **Mini glyphs** (36 units) for flow-map boxes: LV fill level, muscle fibre, ECG, drop, cylinder, aortic arch.

## Risks for whoever redraws this

- **Model-driven geometry:** `ventricleGeometry`, `beat()`, `EMPTY`, `perBeat`, `model`, `CHANGES`, `stateAt` and the `CH` and `px`/`py` mapping drive the pictures and the Clinical and Explore tabs. Redraw the skin, not the model. `namedArrows` and `namedWords` position by `px`/`py`; moving the words for an inset must not break the walker's overlap check at t = 1.
- **Rotating the LV** (apex down-left) must be a transform on the drawn group only. `fibre` and the magnifier source point are computed in unrotated coordinates, so apply the same transform to them.
- **data-part names** that dfns rely on: `ventricle` (s1), `return` (s2), `preload` (s3, and reused in s10), `force` (s4), `sv` (s5, s9, s10), `fscurve` (s6), `contractility` (s7, s10), `rate` (s8, s9, s10; s8 currently lights nothing), `fillgap` (s8), `co` (s9, s10, and the change-step bars), `afterload` (s10). `lab-check` needs at least 3 `<dfn data-part>` per lesson.
- **Test or inspection hooks** in change pictures: `<g class="ghost" data-ghost="normal" data-filling data-sv data-rate data-co>` and `<g data-new-state="…" data-…>` from `attrs()`. Keep both groups and their attributes. The inset must sit outside them, or carry the same values.
- `changeBody` is reused by the **Explore and Clinical tabs** with arbitrary slider states (rate up to 2.2, strength down to 0.45). The inset and any wash bands must stay in-frame and sensible at the extremes.
- **SVG heights**: s1 316, s2 330, s3 318, s4 310, s5 330, s6 290, s7 290, s8 330, s9 340, s10 384, change 368. The anatomy redraws may grow toward 420 but must check the 375 × 553 phone view with the player bar.
- **Gradient and clipPath id collisions** across simultaneous SVGs (step pictures plus the explore and clinical tabs): prefix and suffix ids per scene and instance.
- **Accuracy traps:** do not omit the left atrium again. Do not show the mitral valve as tricuspid or the aortic valve as bileaflet. Do not let drawn SV exceed about 60 % of EDV. Do not show failure as always dilated or thin-walled. The "time to fill" band must exclude systole. Do not add Ca²⁺ cues beyond what the caption says. Do not hard-code 72 bpm or 70 mL into pictures; read them from `clinical-values.json`.
- `rest` moments (.55 heart, .96 eject) are the reduced-motion frames: the heart at .55 is "valves shut" and the eject frame at .96 shows a full column. Recheck what those frames show after the redraw.
- `.visual text.on-blue` in `style.css` is used only by step 10's output box; keep it, or move the halo into the kit.
