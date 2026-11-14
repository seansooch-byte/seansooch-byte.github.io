# Redraw brief: oxygen-hemoglobin-dissociation (Lesson 9, 16 steps)

Audited 2026-11-12 from captures at t=0.35 and t=1 (`tools/lab-shoot.mjs`), plus `lab/oxygen-hemoglobin-dissociation/app.js`, `index.html` and `style.css`.

**Overall grade: 4/10.** The graph work (steps 6 to 16) is sound. The curve is fitted from data, the dots and ghosts are honest, and the morphs move the right things. It reads as a decent textbook line chart, though it is gridless to the point of having no scale and its labels collide in five steps. The anatomy and molecule work (steps 1 to 5, and the rows of molecules in 12 to 16) is clip art. The lungs are two pink blobs, the tissues are a beige box, red cells are flat ellipses and hemoglobin is a pink rounded square holding four dots. Nothing in steps 1 to 5 would pass in Osmosis, Lecturio or BioRender. The biggest gap is hemoglobin itself. It is the star of the lesson and appears in 12 of 16 steps, but it is drawn as a die. Build one good hemoglobin tetramer primitive and the whole lesson improves.

## What a redraw must keep (all steps)

- **Model-driven geometry.** `CH` (`x0 70, x1 456, y0 250, top 58`), `px()/py()`, `XMAX() = 1.3 × K.pa`, `curvePath()`, `contentAt()`, `points()`, `givenArrow()`, `halfMarker()`, `ceiling()`. Every dot, ceiling and arrow comes from `model()` and from `K`, which is fitted at load time from `clinical-values.json` (pao2 95, sao2 97, pvo2 40, svo2 75, utilization 25). Nothing may be hard-coded to a pixel that the model sets.
- **`seatRow()` counts.** The number of molecules present (`6 × hb`, up to 7), the number of CO seats and the number of O2 seats all come from the model. Molecules fill one at a time (the teamwork rule). A new molecule glyph must accept the same `seats[]` array (`'o2' | 'co' | 'empty'`).
- **data-part names that `<dfn>` uses:** `molecule`, `seat` (step 2), `pressure` (3, 4), `saturation` (4), `plateau` (7), `slope` (8), `reserve` (9), `half` (10 and charts), `content` (11). The CO band also has `data-part="co"`, which no dfn uses. Step 1's dfns (`lungs`, `tissues`, `Red blood cells`) have **no** data-part. Add `lungs`, `tissues` and `rbc` to both the picture and the caption (that is a caption edit in index.html).
- **Hooks:** `data-ghost="normal"` and `data-new-state` both carry `attrs()` ratios (`data-pa/sa/p50/ca/pv/sv/seats`). Keep them. Also keep `data-curve`, `data-point="lungs|tissues"`, `data-given`, `data-grip`, `data-named`, `data-half`, `data-ceiling`, `data-co-band`, `data-molecule(="missing")` and `data-seat`.
- **Marker id scoping.** `svg()` rewrites `ah-` to `p<N>-ah-` so that hidden steps do not share ids. **Any new `<linearGradient>`, `<radialGradient>`, `<clipPath>` or `<filter>` id must also start with `ah-`** (or the rewrite must be widened). If it isn't, gradients from a hidden step will vanish in Safari and Chrome.
- **Fallback mode.** If the JSON fails, `K = FALLBACK` uses arbitrary pressure units. Show mmHg tick labels only when `data` is loaded.
- **Scene shapes:** `fill` (4200 ms), `curve` (4600), `given` (3600) and the four `change()` scenes (2800, readout) stay `{duration, render(t)}`. `aria-label`s must be rewritten to describe the new drawings.

## Palette and style for the redraw (lesson-wide)

- **Blood:** oxygenated = kit red `#b3261e`, with a lighter highlight `#d9483b` for gradients. Deoxygenated = a dark maroon-plum `#6e2a3c`. **Do not use the kit blue for veins**, because blue is "the thing being taught" (the curve and the change arrows).
- **Hemoglobin protein:** alpha subunits in a warm salmon (`#f2b9ad`) and beta subunits in a slightly deeper rose (`#e59a8c`). Use a 1.5 ink stroke at large sizes and 1.2 at row size. Heme is a flat dark-red plate (`#8c1d18`) with a small Fe dot.
- **O2:** a red diatomic dumbbell, two fused circles of radius r with centres 1.2 r apart. Use a small white specular highlight at sizes of 40 and up.
- **CO:** a dumbbell in slate (C `#3a3f47`, O `#6b717a`), never a black square.
- **Tissue:** muscle-fibre pink-tan `#e8c9b5` with striations in `#d3ab94`.
- **Gradients:** radial for cells (dark rim, pale centre), linear top-to-bottom for organs (a lighter top edge). Use one light direction (top-left) everywhere.
- **Strokes:** 2 for outlines, 1.2 for internal detail, 4.5 for the curve, 3.5 for change arrows (`arrowFixed`).
- **Charts:** add a light shaded area under the curve (`#254dff` at 0.06 opacity). Add mmHg ticks at 0, 20, 40, 60, 80 and 100 (class `xs muted`, short 6-unit ticks, no gridlines) and % ticks at 50 and 100 on y when the y axis is saturation. Leader lines are 1.2 muted.

---

## Step 1: trip (still, 396 tall), grade 3

**Problems**
- The lungs are two symmetric pink blobs on a Y-shaped stick. There are no lobes, no cardiac notch, no bronchial tree and no texture. They read as kidneys or mittens.
- The tissues are a beige rounded rectangle with words in it. It is a box, not a tissue.
- Red cells are flat ellipses. The red dots inside them imply that O2 is loose in the cell, and the cells coming back look identical apart from the dots.
- The heart is absent, so the loop implies blood goes straight from the lungs to the tissues. That is a simplification. It could be fine, but adding a small pump costs little.
- The colour coding is inconsistent. The outbound arrow is red but the return arrow is grey-black. Its arrowhead is ink, not matching the shaft.
- The centre of the picture is a block of words ("red blood cells / full going out…").

**Redraw**
- **Top, centred:** frontal lungs, about 200 wide by 130 tall. Draw the trachea with cartilage-ring hatching, splitting at the carina into two main bronchi with two or three visible branchings each. The right lung has 3 lobes and the left has 2, marked by fissure lines (1.2 stroke). The left lung has a cardiac notch. Fill with a linear gradient from pink `#f3c9c2` to `#e6a79d` and add a faint alveolar stipple. Label "lungs: oxygen in" (`sm b red`) with a leader line. Add `data-part="lungs"`.
- **Middle:** a small anatomical heart silhouette, about 60 wide, sitting between the lungs and below the carina with its apex down-left. Label "heart pumps" (`xs muted`). It is optional but preferred.
- **Bottom:** a tissue block drawn as a cut bundle of 3 or 4 striated muscle fibres in cross and longitudinal view. A capillary runs across the fibres, red at the arterial end and plum at the venous end. Label "tissues: oxygen used" with "muscle, brain, gut" beneath it (`xs`). Add `data-part="tissues"`.
- **Loop:** draw it as a vessel with walls (two parallel strokes 12 units apart with a lumen fill), not as an arrow. The right side runs from the lungs down to the tissues with a red lumen. The left side runs from the tissues back up with a plum lumen. Small arrowheads sit inside the lumen.
- **Cells:** draw 2 or 3 RBCs per side as biconcave discs (face-on, with central pallor from the radial gradient). They are bright red on the arterial side and darker plum on the venous side. **No loose O2 dots.** Colour carries the oxygen state. Add `data-part="rbc"` on one group.
- **Animation (optional upgrade):** make the scene `{duration: 4000, loop: true}` with the cells advancing along the vessel path by t (use `getPointAtLength` in a `mount()` or a precomputed polyline). Each cell changes tint from red to plum as it crosses the tissue bed and back to red in the lungs.
- Remove the centre text block. Put "full going out, lighter coming back" as small labels beside the two vessel sides instead ("oxygen-rich", "oxygen-poor").

## Step 2: cell (still, 320 tall), grade 4

**Problems**
- The RBC is an ellipse with a darker inner ellipse. That is closer than step 1, but there is no biconcave depth and no rim highlight.
- Hemoglobin is 30 identical pink rounded squares scattered on the cell, like dice. Hemoglobin is a globular tetramer and should look like protein.
- The enlarged "molecule" is a big rounded square with 4 circles in it. There are no subunits and no heme. The "seat" is just a circle, so the student never learns that a seat is a heme group.
- The zoom-callout lines leave from a blue-outlined square that is hard to see.

**Redraw**
- **Left:** an RBC as a biconcave disc in about 30° oblique view (radius 105). Use a radial gradient that is dark at the rim (`#a3201a`), lighter on the torus and pale in the central pallor, plus a specular highlight arc at the top-left. Cut a wedge out of the lower-right quarter (a clip-path) to reveal the interior packed with about 25 tiny hemoglobin glyphs (the primitive at 12 units: a four-lobed cloverleaf). Label "red blood cell" (`sm b red`). Accuracy: there is no nucleus, so don't draw one.
- **Right:** a zoom circle (radius 80), joined by two tangent callout lines from the cutaway wedge. Inside it is the **hemoglobin tetramer primitive** at about 140: four globular subunits in a 2×2 cluster (α1, β1, α2, β2 diagonally paired). Each is a lumpy blob path with an inner shading gradient. Each holds a heme plate drawn as a flat disc seen edge-on at about 20°, with an Fe dot. Two hemes carry an O2 dumbbell docked on the Fe and two are empty, as now.
- Labels with leader lines: "hemoglobin" (`sm b`) on the whole cluster, and "oxygen seat (heme)" (`sm b`) pointing to one empty heme. "α" and "β" are optional `xs muted` tags, and are accurate if used. Keep "four oxygen seats / two full, two empty".
- Keep `data-part="molecule"` on the cluster and `data-part="seat"` on each heme.

## Step 3: pressure (still, 362 tall), grade 3

**Problems**
- The panels are two white rounded boxes with scattered red dots. There is no alveolus, no capillary, no tissue and no membrane.
- **Accuracy mismatch with the caption.** The caption says oxygen pressure is "the oxygen dissolved in the blood itself, not the oxygen held by hemoglobin". The picture puts the dots in an "air sac" box and a "tissue" box, with no blood, plasma or hemoglobin to contrast against.
- The arrow between the boxes floats in the gap and implies that O2 moves from the lung to the tissue directly.
- The gauge bars are flat red rectangles that look like progress bars, and the "oxygen pressure" label sits between them, belonging to neither.

**Redraw**
- Two matched circular insets (radius about 95), side by side, each a cross-section through a capillary.
- **Left, "lungs":** an alveolus, a thin-walled air sac whose top arc is drawn with type I cell nuclei as small flattened bumps, wrapped by a capillary with walls and lumen. The air sac holds many O2 dumbbells. The plasma in the capillary holds a dense sprinkle of small dissolved O2. One or two RBCs sit in the lumen (bright red). Short blue arrows cross the alveolar wall into the plasma.
- **Right, "working tissue":** a capillary beside 2 or 3 striated muscle fibres, with a few mitochondria drawn as ovals with cristae. The plasma has a sparse O2 sprinkle and the RBCs are plum. Short arrows run from the plasma into the fibre.
- Both insets mark "dissolved oxygen" with a leader to a plasma O2. That is what the caption defines.
- **Under each inset:** a gauge drawn as a thermometer-style tube with a red fill, sized from the model. Use `K.pa` for the lungs side and `BASE.pv` for the tissue side, as a share of `XMAX()`, instead of the hard-coded `.9` and `.32`. Label it "pressure: high", or "≈ 95 mmHg" when the data is loaded. Wrap the gauges in `data-part="pressure"`.
- Bottom line: "oxygen moves from high pressure to low", with one long arrow under both insets from left to right.

## Step 4: fill (moving, 4200 ms, 356 tall), grade 4

**Problems**
- The motion does not read. The pressure ramp uses ease-out (`1-(1-x)^3`) up to `XMAX = 1.3 × arterial`, so by t=0.35 the pressure bar is at 70% and all four seats are full. Two thirds of the timeline shows a full, static molecule. The interesting part (0 to 3 seats) flashes by in about 0.6 s.
- The molecule is the dice glyph, and the seats change instantly with no binding motion.
- There are three stacked horizontal bars and labels. The picture is mostly bars.

**Redraw**
- Drive pressure **linearly** in t from 0 to about `1.05 × K.pa`, so the steep part of the S occupies the middle of the timeline. Optionally add `stages: [[0,'low pressure'],[0.5,'rising'],[0.85,'high']]`.
- **Centre:** the hemoglobin tetramer primitive at about 130. Ambient O2 dumbbells float around it, and their count is proportional to pressure, which replaces the top bar. As each seat fills, animate one O2 sliding in from the surroundings to dock on its heme, over about 0.1 of t. Use the existing rounding to decide when.
- Keep the pressure gauge as a slim vertical thermometer at the left and the saturation gauge as a vertical bar at the right, labelled with %. When data is loaded, label the saturation bar with % and the pressure gauge with mmHg. Keep `data-part="pressure"` and `data-part="saturation"`.
- Keep the "n of 4 seats full" counter, placed under the molecule.

## Step 5: team (still, 312 tall), grade 4

**Problems**
- "Tight" vs "relaxed" is signalled only by the corner radius of the dice (0.08 vs 0.2 vs 0.32), and nobody can see that. Cooperative binding is a **shape change** (the T to R quaternary transition), and the picture does not show any shape change.
- The return arrow is a big dashed U that dominates the lower half and says little.

**Redraw**
- Draw three tetramers left to right, using the primitive's `state` parameter:
  - **T (tense):** the four subunits pressed tightly together in a compact square, the hemes slightly recessed (drawn half-hidden in their pockets) and a few short "bond" ticks (`xs` ink lines) between subunits.
  - **One O2 bound:** the subunit holding the O2 is drawn rotated about 8° and slightly separated, and a small curved arrow on the neighbouring subunits says they are loosening.
  - **R (relaxed):** all four subunits rotated outward with a visible central cavity between them, and every heme exposed and filled.
- Arrows: the first is red, labelled "hard (first one)". The second is blue, labelled "easy (the rest)".
- Replace the dashed U with a slim reverse arrow under the row: "letting go: the same, in reverse" (`xs`).
- Accuracy: do not label the cavity "2,3-BPG pocket" here. BPG binds the T state's central cavity, so if the cavity is ever annotated, it must sit on the T molecule. Leave it unannotated.

## Step 6: curve (moving, 4600 ms, 330 tall), grade 6

**Problems**
- The chart is clean, but it has no scale at all: no ticks, no units, no %. Industry figures always show PO2 in mmHg and SO2 in %.
- The riding molecule overlaps the curve tip and the "all seats full" ceiling line. At t=1 it sits on the ceiling text line, with the tip dot poking out of its right edge.
- There are about 80 units of dead space between the x axis (y 250) and "oxygen pressure →" (y 294).
- The reveal advances linearly in pressure up to 1.3 × arterial, so the climb is over by t≈0.35 and the rest is a slow crawl along the plateau.
- "flat top" floats under the curve, away from it.

**Redraw**
- Use the shared chart frame with ticks and units (mmHg on x, % on y when the y word is "seats filled"). Put the x title directly under the tick labels, at about y0+40.
- Shade the area under the drawn portion of the curve as it is revealed.
- Move the rider molecule (primitive at 36) to sit **above-left** of the tip, with a 1.2 leader to the tip dot. Clamp it below the ceiling text so that it never crosses the ceiling line or the label.
- Optionally time-warp the reveal (spend 60% of t on 0 to P50 × 2).
- Put the three region labels on short leaders: "slow start", "steep middle" and "flat top", with "flat top" placed *above* the curve under the ceiling, right-aligned.

## Step 7: lungs (still, 330 tall), grade 6

**Problems**
- The `plateau` highlight rectangle overflows above the ceiling line and the "all seats full" row, and its top edge collides with the "flat top" label.
- The "less lung oxygen" arrow sits 58 units below the points, disconnected from the two dots it compares.
- The hollow second dot uses the same style as the "tissues" dot in step 8, so it is confusing.

**Redraw**
- Draw the plateau as a soft blue band hugging the curve from `0.72 × pa` to the right edge, clipped below the ceiling. Keep `data-part="plateau"`.
- Draw the comparison dot as a small grey-filled dot, distinct from the tissues ring. Draw a horizontal blue arrow **on the curve's height** from the lungs dot to the comparison dot, with a tiny vertical "Δ saturation" bracket showing the near-zero drop.
- Labels: "lungs" (`sm b red`) above its dot, and "less lung oxygen: still nearly full" in two lines below, joined to the comparison dot by a leader. With ticks present, show the lungs dot at the data-derived ≈95 mmHg.

## Step 8: tissues (still, 330 tall), grade 6

**Problems**
- The slope highlight is a full-height rectangle from the axis to the ceiling, so it reads as a column, not a slope.
- The "steep slope" label has a white text halo that overlaps the curve.

**Redraw**
- Draw the highlight as a band that follows the curve (a polygon offset ±14 units around the steep segment from `0.55 × P50` to `1.2 × pv`), or a light parallelogram along the slope. Keep `data-part="slope"`.
- Add a small "Δ pressure → big Δ seats" triangle at the tissues dot (a horizontal leg and a vertical leg, drawn in ink at 1.5).
- Label "steep slope" on a leader to the band's upper end. Label "tissues" beside its ring, on the side away from the curve.

## Step 9: given (moving, 3600 ms, 330 tall), grade 5

**Problems**
- The sliding "red cell" is a flat pink ellipse, and at t=1 it sits on top of the tissues dot and hides it.
- The "unloaded" label butts against the arrow shaft.
- The reserve bracket floats far to the right (`pv + 88`), unconnected to anything. Its line from the tissues height down to the axis is not visibly tied to the tissues dot.
- The dashed reference line from the lungs dot runs into the ceiling dotted line, so two dotted lines sit 3 units apart.

**Redraw**
- The traveller is the RBC primitive (biconcave disc, radius 12). Its tint interpolates from red to plum as u goes from 0 to 1. At the end it parks *beside* the tissues ring (offset +20 x) instead of covering it.
- Draw the given drop as a red-shaded vertical band from the lungs height to the tissues height, at the tissues pressure, with a downward arrow and the label "handed over ≈ 25%" (the percentage from `BASE.util`, shown when data is loaded). Leave a 10-unit gap between the label and the arrow.
- Draw the reserve as a plum-shaded band directly under the given band, at the same x and down to the axis, with a right-side brace and the label "still on board: the reserve". Keep `data-part="reserve"`. This makes the 25/75 split a single stacked column that reads at a glance.
- Drop the dashed horizontal reference when it is within 6 units of the ceiling.

## Step 10: half (still, 330 tall), grade 6

**Problems**
- "half-saturation pressure" sits under the axis where the pressure tick labels would go, and the x title sits below it. That gives two stacked "pressure" labels.
- The left-shift arrow and its words float in the upper-left corner, away from the curve, in red. Red is the "blood, harm" colour, while the right shift is in blue, so the colour scheme implies one shift is bad and the other is the lesson.

**Redraw**
- Put "P50" (`xs b`) on the x axis as a tick at P50, labelled "≈ 27 mmHg" when data is loaded. The model's fitted P50 is about 26 to 27, not the textbook 25. The baseline note already explains this, so show the model value. Put "half-saturation pressure" on a leader from the half dot, placed to the upper right.
- Draw two faint ghost curves (dashed, `#8a8f84`) shifted to `P50 × 0.7` and `P50 × 1.4`, the same factors as `CHANGES`, with small horizontal arrows at the 50% line from the normal half dot to each ghost's half point. Label them "left shift: holds tighter" and "right shift: lets go easily". Use **the same ink or blue for both**, distinguishing them by position only.
- Keep `data-part="half"` on the dot and the drop lines.

## Step 11: content (still, 330 tall), grade 5

**Problems**
- "Oxygen content" is a red bar under the lungs dot. It looks like a bar chart dropped onto a line chart.
- The "oxygen content" label's arrow is 9 units long and points at the bar's side.
- The ceiling label is crammed into the top-right corner, above "all seats full", so the same line carries two labels.
- The y axis is now "oxygen carried" and still has no units.

**Redraw**
- With data loaded, show the y axis in mL O2 per 100 mL (ceiling = `hb × 1.34` ≈ 20.1, from `reference('hb') * reference('o2PerGram')`), with ticks at 5, 10, 15 and 20.
- Show content as a filled column under the lungs dot, styled as a test tube or capillary segment: a red gradient fill rising to the dot, with a white meniscus line. Label "oxygen content" with a proper leader.
- Show the ceiling as a heavier dashed line labelled once, at the right: "ceiling: set by the amount of hemoglobin". Drop "all seats full" in this step, or merge it: "all seats full = the ceiling".
- Do not draw a dissolved-oxygen sliver. The model leaves dissolved O2 out, so any sliver would be invented geometry.
- Keep `data-part="content"`.

## Step 12: whole (still, 424 tall), grade 5

**Problems**
- The SVG is 424 tall, over the 420 maximum (`keyY 412 + 12`).
- The two molecule rows are packed right under the x-axis title, and "oxygen pressure →" collides visually with the first row.
- There are two pressure labels again ("half-saturation pressure" and "oxygen pressure →").
- The "unloaded" label touches its arrow.
- The rows use dice glyphs.

**Redraw**
- Reduce `CH.y0` or the row spacing so that the whole picture is 420 or less. Put the x title inline at the right end of the axis, at tick-label height.
- Draw the rows with the tetramer primitive at 30. Sit each row inside a faint RBC-shaped capsule: a red-tinted capsule for "leaving the lungs" and a plum-tinted one for "leaving the tissues". This links the rows to the blood colour coding.
- Reuse the step 9 stacked given/reserve column at the tissues pressure, and the P50 tick from step 10.
- Key: an O2 dumbbell and the word "oxygen".

## Step 13: right shift (change, 2800 ms), grade 5

**Problems**
- The black "grip" arrow at the normal tissue pressure runs through the ghost tissues ring and the ghost curve (overlap).
- The blue "slides right" arrow lies on the new curve, and its head sits on the curve line.
- The "half-saturation pressure" label slides along the axis and collides with tick space.
- The named words ("→ curve slides right / ↓ lets go more / at the same pressure") are a three-line block in the lower right, far from either arrow.
- The picture is 424 tall, which breaks the limit.
- The causes (CO2, acid, heat, 2,3-BPG) are not drawn at all.

**Redraw**
- Keep the morph, the ghost and the readout as they are.
- Draw the slide arrow **at the 50% level**, from the ghost's P50 point to the new P50 point. That puts it in clear space between the curves, horizontal, in blue, with its words directly above it: "curve slides right".
- Draw the grip arrow at the normal tissue pressure as a short vertical blue bracket between the ghost and new curves, labelled "lets go more" on the side away from the ghosts. Offset it 12 units right of the ghost ring.
- Add a compact cause strip at the top right, four small icons each about 26 units with an `xs` label: "CO₂", "H⁺ (acid)", "heat" (a thermometer) and "2,3-BPG". All have ↑ arrows. This is accurate and named in the caption.
- Use the tetramer primitive in the rows.
- Keep the total height at 420 or less.

## Step 14: left shift (change), grade 5

**Problems**
- The black grip arrow crosses the ghost ring, and its head lands in "tissues".
- The tissues label overlaps the dashed ghost curve.
- The slide arrow lies along the plateau, where the curves are 5 units apart, and is unreadable.

**Redraw**
- Follow the step 13 layout, mirrored. Put the slide arrow at 50%.
- Cause strip: "fetal Hb", "cold" (thermometer ↓), "alkalosis" (H⁺ ↓). For fetal hemoglobin, a small label "α₂γ₂" is accurate if used, and optional.
- Place the tissues label on the left of its dot (up-left), away from the ghost.

## Step 15: carbon monoxide (change), grade 4

**Problems**
- The ghost curve and ghost tissues ring cut straight through "seats taken by carbon monoxide". That breaks the label-overlap rule.
- At t=1 the half-saturation dot is completely hidden under the tissues ring.
- "unloaded" overlaps the ghost curve and the half dashed line.
- "and the rest grip tighter" sits on the x axis line, with its baseline touching it.
- CO is drawn as a black square on the dice. It is not a molecule.
- The SVG is 452 tall (two key rows), over the 420 maximum.

**Redraw**
- Draw the CO band as diagonal slate hatching between the two ceilings. Put its label at the far left inside the band (start-anchored at x0+10), where the ghost curve is still low. Or put the label outside the chart with a leader. Either way, test that no ghost path crosses it.
- When the tissues and half points are within 14 units, draw the half dot as a tick on the axis only, or nudge the half label: "half (of free seats)".
- Draw CO as the slate dumbbell primitive docked on the heme, so it visibly occupies the same seat O2 would.
- Words: "↓ fewer seats for oxygen" sits at the ceiling-drop arrow. Put "the rest grip tighter (curve bends left)" next to the low part of the curve, above the axis with a 10-unit clearance.
- Reduce the key to one row ("normal", "with CO", plus the O2 and CO icons in short words) to get back to 420 or less.

## Step 16: anemia (change), grade 5

**Problems**
- "unloaded" crosses the ghost curve.
- The tissues ring hides the half dot at t=1.
- "each still fills fully" sits on the x axis.
- The SVG is 452 tall.
- The missing-hemoglobin outlines are fine, but the remaining molecules are dice.

**Redraw**
- Use the same clearance rules as step 15.
- Draw missing molecules as faint dashed tetramer outlines, the same primitive drawn in outline only.
- Add a short annotation at the given arrow: "same oxygen handed over, from a lower ceiling". This is model-true, because `need` is fixed. The current picture already implies it, so state it.
- Use a one-row key to stay at 420 or less.
- Accuracy note: chronic anemia raises 2,3-BPG, which right-shifts the curve, and the step 13 caption says so. This step's model keeps P50 unchanged. That is fine as long as no words say "no shift".

---

## Reusable primitives

1. **Hemoglobin tetramer:** 2α + 2β globular subunits, 4 heme plates with Fe, and per-seat state (`o2 | co | empty`). It has a conformation parameter (T compact to R relaxed, interpolable by t), an outline-only "missing" mode, and should scale from 12 to 160 with simplified detail below 30.
2. **O2 diatomic dumbbell** and **CO dumbbell**, in docked and free forms.
3. **Red blood cell:** a biconcave disc face-on, oblique and in profile, with a radial gradient tinted oxy (red) or deoxy (plum) and interpolable between them. It also needs a cutaway mode that shows the packed hemoglobin.
4. **Lungs, frontal:** trachea with rings, carina, bronchial branching, 3 right lobes and 2 left lobes, fissures and a cardiac notch.
5. **Small heart silhouette:** apex down-left, great vessels stubbed.
6. **Alveolus with wrapped pulmonary capillary:** a cross-section inset.
7. **Systemic capillary in muscle:** striated fibres, mitochondria and plasma.
8. **Vessel segment with walls and lumen** along an arbitrary path, with a fill gradient from oxy to deoxy.
9. **Chart frame:** mmHg and % ticks (hidden in fallback mode), a shaded area under the curve, a labelled point marker, a leader line, a brace or bracket, and a stacked given/reserve column.
10. **Gauge:** a thermometer-style vertical or horizontal fill.
11. **Cause icons:** thermometer, H⁺ badge, CO₂ badge, 2,3-BPG badge.
12. **Kit `delta()`, `arrowFixed` and `ghost()`** for the change arrows (already in `lab/kit/draw.js`).

## Risks

- **Model-driven geometry.** The dots, ceiling, CO band, rows and named arrows all derive from `model()`, `K` and `CH`. A redraw that hard-codes positions will drift from the readout and the Explore tab, which reuses `pictureSvg()`.
- **Gradient and clip ids.** New defs must be scoped per picture (the `ah-` rewrite in `svg()`), or hidden steps lose their fills.
- **Hooks and parts.** Keep `data-part` names `molecule`, `seat`, `pressure`, `saturation`, `plateau`, `slope`, `reserve`, `half`, `content` and `co`. Keep `data-ghost="normal"` and `data-new-state` with the `attrs()` ratios, `data-point`, `data-seat` and `data-molecule="missing"`. `lab-check.mjs` requires at least 3 dfn parts.
- **Height.** Steps 12 to 16 are already 424 to 452 tall, over the 420 limit. Adding ticks, cause strips or richer glyphs will make that worse unless the frame is re-budgeted: chart about 250, rows about 90, key 1 row.
- **Label overlap at t=1 in CO and anemia,** where the tissues ring and half dot coincide and the ghost curve sweeps through the band label. Test at both t=0.35 and t=1, and at 375 px wide.
- **Fallback mode** has no mmHg. Tick labels must not appear when `data` is null.
- **Accuracy traps.**
  - P50: the model's P50 is about 26 to 27 (fitted), not the textbook 25. Label the model's value or none.
  - Never draw a nucleus in an RBC.
  - BPG binds the T state only.
  - Do not put a dissolved-O2 sliver on the content chart (it is not modelled).
  - Fetal Hb is α₂γ₂.
  - Venous blood must not be kit blue, which collides with the "thing being taught" colour.
  - The heart, if added to step 1, must be anatomically oriented with its apex down-left.
- **Performance.** The rows hold 6 or 7 tetramers × 2 rows × 4 change steps, all rerendered every frame in `render(t)`. Keep the small tetramer glyph cheap: a `<use>`/`<symbol>` or a precomputed path string, not per-frame gradients for each molecule.
