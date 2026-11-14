# Redraw brief: pharmacokinetics (Lesson 17)

Shots: /private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/audit/shots/pharmacokinetics/ (t=0.35 and t=1 per step; side-by-side pairs in pairs/).
Code: lab/pharmacokinetics/app.js (pictures), model.js (window.PKModel, drives every curve and every flow width), index.html (captions, dfn data-part).

## Verdict

Overall 4/10. The lesson is two kinds of picture:

1. **Graphs** (steps 2, 7 to 11 and the lower half of 3 to 6 and 12 to 16). They are model-driven, accurate and mostly clean: about 6 to 7/10. They need polish, not a rebuild: shaded areas, axis-anchored labels, one consistent mark vocabulary, and a few overlap or placement bugs.
2. **The "body strip"** (steps 1, 3 to 6, 12 to 16). It is five pastel rounded rectangles labelled gut, liver, blood, tissues, kidneys, joined by fat arrows. It is a flowchart, not a body: the same clip-art box problem the owner flagged in lesson 1's heart. It appears in 11 of 16 steps, so it is the biggest gap. It also hides the one anatomical fact the lesson depends on: gut blood drains through the **hepatic portal vein** to the liver *before* it reaches the general circulation (that is what first pass is).

The redraw priority is: (A) one new anatomical strip primitive, reused everywhere; (B) fix the glitched ghost-flow overlays and misplaced change labels in 13 to 16; (C) graph polish.

## A. The new body strip (used by steps 1, 3, 4, 5, 6, 12, 13, 14, 15, 16)

Stay inside the same band: 480 wide, y = -2 to 116 (UNDER_STRIP.PT = 158 depends on STRIP_H = 116; if the strip must grow, grow it to at most ~130 and shift UNDER_STRIP/FULL and every `h` in `scenes` accordingly, keeping each picture <= 420).

Left to right, a Netter-style schematic (flat-shaded silhouettes with one soft linear gradient and a 1.4 px darker outline; no boxes):

| key (keep) | draw | notes |
|---|---|---|
| `gut` | a J-shaped stomach (fundus up-left, greater curvature outward, pylorus right) flowing into 2 to 3 loops of small intestine, gradient #f1e3c6 to #e6cfa4, mucosal folds as 3 short lighter arcs. A small tablet (rounded capsule, white with amber half) sits in the stomach at t=0 and shrinks as it dissolves (`dots.gut` already decays with exp(-ka t)). | "swallowed" arrow comes down the oesophagus stub into the fundus, not into a box top. |
| portal vein (new, part `lost` for pass flow? no: part `gut` for absorb) | a short **vessel** (two parallel walls, lumen fill deoxygenated #8e5a8a at 35% opacity, wall stroke #6b3fa0) from the intestine to the liver's underside, labelled "portal vein" (xs) only in step 4 and 12. | This *is* the `absorb` flow: lumen width = `widths(p).absorb` so the model still drives it. |
| `liver` | the classic liver silhouette: large right lobe, tapering left lobe, flat inferior border, gradient #c9765f to #a8533f (liver brown-red, lighter than blood), a small green gallbladder (#7f9a4f) tucked under, a faint hepatocyte hex texture optional. | `broken` flow leaves the liver as a dashed ink arrow to the label "broken down" (metabolites); optionally via bile duct. Keep label text "broken down". |
| hepatic vein -> `blood` | a vessel from liver top-right into the main circulation. This is the `pass` flow, its lumen width = `widths(p).pass` (bioavailability). | |
| `blood` | a horizontal **cut-away blood vessel** (artery-red wall #b3261e, 3 px wall with inner highlight, lumen #f6dcd6) spanning ~x 208 to 318, with 4 or 5 biconcave red cells (ellipse + darker centre) drifting slowly with t, and the drug dots riding in the lumen in two lanes. Title "blood" above the vessel, in red. | `dotsIn('blood', n)` must place dots inside the lumen; keep 2 rows x 7. |
| `tissues` | a capillary loop leaving the vessel up-right into a block of 3 to 4 tissue cells (rounded polygons with nuclei, #e1e7d3 to #c9d4b5, like a skeletal muscle / fat block). Drug dots appear between cells (`dots.tissues`). | `spreadOut`/`spreadBack` become the capillary in/out limbs, width = `widths(p).spread`. |
| `kidneys` | one kidney bean (hilum facing the vessel, cortex #c47a6a to medulla pyramids hint #a85a4c, capsule outline) fed by a renal artery branch from the vessel (`kidney` flow), with a ureter dropping to a small bladder outline; "urine" label beside the bladder. | `urine` flow = the ureter, width = `widths(p).kidney`. |
| `vein` (step 16) | an IV cannula/syringe glyph (barrel, plunger, needle bevel) entering the blood vessel from above at x~262, blue liquid in the barrel; "into a vein" label to its left, kept fully inside the frame (y >= 17). | Replaces the plain blue arrow; width-driven lumen kept for `widths(p).vein`. |

Rules for the strip:
- Every flow is a vessel (two walls + lumen) or a thin directional arrow, never a thick block arrow. Flow width still comes from `widths()`; draw the lumen width as `w`, walls 1.4 px darker. Arrow direction shown by a small chevron in the lumen, or by drug dots moving along it.
- Ghost of a changed flow (`flowGhost`) must be drawn as a dashed outline of the *vessel walls at normal width*, offset so it is visible beside, not under, the new vessel (today the dashed polygon sits on top of the solid arrow and renders as jagged noise: see s13/s14/s15/s16 around liver->blood, broken down and urine). Draw ghost first, solid on top, and when the new width is *smaller* make the ghost wider so it shows as a dashed halo; when bigger, draw the ghost dashed *inside* the solid in white.
- Names never inside the silhouettes' dot lanes; put names above or beside each organ with a short leader where needed. Use `sm b` as now.
- Highlight (`hi`) = blue 3 px outline glow around the organ silhouette plus dimming the non-highlighted organs to 55% opacity, so steps 3 to 6 differ at a glance.
- Colours: oxygenated circulation red, portal (venous) purple, tissue green-grey, kidney red-brown, gut tan, drug always blue #254dff with a white 1.4 px rim (keep `drugDot`).

## B. Per step

### Step 1 `journey` (grade 3)
Problems: five boxes and arrows, no anatomy; at t=0.35 a moving dot sits on the word "gut" (ROUTES[*] go straight down x=44 through the name at y=52, contradicting the code's own comment); dots sit on top of the arrows; the 4 chips at the bottom are plain pills with no link to the picture beyond hover; ~40 units of dead space between strip and chips.
Redraw: the new strip, larger (it is the only content): scale it to ~480 x 200 (strip drawn at 1.6x via a `<g transform>` with its own text sizes rechecked >= 17 after scaling, or a dedicated large layout). Drug molecules (blue dots) travel along the vessels: oesophagus -> stomach -> intestine -> portal vein -> liver (some peel off as "broken down") -> hepatic vein -> blood vessel -> capillary into tissues and back -> renal artery -> kidney -> ureter -> bladder. Reroute ROUTES along vessel centrelines so no dot ever crosses a label. The four chips become four numbered labels placed *on* the picture at the organ where they happen (1 taken in at the gut, 2 spreads out at the tissues, 3 broken down at the liver, 4 sent out at the kidney), each with a small coloured badge circle; keep their data-part mapping (gut, tissues, liver, kidneys) and keep the heading "four things happen to every drug" (it can be the strip's subtitle). Keep loop: true, 7200 ms.

### Step 2 `level` (grade 6)
Good: marks appear one by one, then the curve joins them; clear axis words.
Problems: the "one drop of blood" is a flat pink circle with blue dots; the dashed leader from the latest mark to the drop is long and, at t=1, rises from the curve's tail into empty space; red sample marks are the same red as "harm" elsewhere.
Redraw: the drop becomes a magnifier: a teardrop of blood (red gradient, specular highlight) inside a lens ring, containing 3 to 4 biconcave red cells and the drug dots (count still `12 * lv / SO.peak`). Draw the sample marks as small test-tube glyphs or as ink-rimmed red dots with a vertical stem to the time axis (the "time of the test") so "one test at one time" reads. Leader: a short solid red line from the latest mark to the lens rim. Keep `data-sample`, `data-curve`, part `level`.

### Steps 3 to 6 `absorb`, `firstpass`, `spread`, `remove` (grade 4: strip 3, graph 6)
Shared problems: the strip is the box diagram; the four pictures are nearly identical (same curve, only a blue box outline changes); the blood "box" empties to a single dot with no sense of concentration.
Per step:
- **3 absorb**: fine annotations ("climbs...", "peak: in and out balance", "falls: removal wins"). Lift: shade the area under the rising limb pale amber and under the falling limb pale grey so "in wins" vs "out wins" is a filled shape; the tablet in the stomach visibly dissolves; the portal vein lumen carries the dots.
- **4 firstpass**: the dotted "if none were lost" curve runs straight through the words "first pass" (t=1): an overlap. Redraw: fill the gap between the dotted and blue curves with a light blue hatch (part `lost`), put "lost on the first pass" with a leader into the hatch from free space to the right (x ~ 330, y ~ PT+60), not over the curve. In the strip, show dots peeling off at the liver into "broken down" while fewer continue up the hepatic vein. Keep `data-alt="none-lost"`.
- **5 spread**: convention inversion: the *normal* curve is solid blue and the *changed* (wide Vd) curve is a grey dotted line, which reads as the ghost. The kit's grammar is grey = normal. This is a build step, not a "What changes it" step, so: draw the wide-Vd curve in purple (#6b3fa0) solid 3 px with its own legend swatch, keep normal blue; label "spreads widely: lower peak, slower fall" with a leader to the purple curve's peak and another to where it crosses above blue. In the strip, the tissue block fills with dots. Keep `data-alt="wide"`, part `wide`.
- **6 remove**: the free-floating black arrow parallel to the curve adds nothing. Redraw: highlight both liver and kidney silhouettes, animate dots leaving via "broken down" and via the ureter, and on the graph shade the area under the falling limb with a downward gradient labelled "liver and kidneys clear it: falls" with a short leader. Keep part `cleared`.

### Step 7 `halflife` (grade 7)
Good: clean, correct exponential, three equal half-life brackets.
Lift: move "half / a quarter / an eighth" to y-axis tick labels (1, 1/2, 1/4, 1/8 at the axis, with the dashed guide lines) and keep only dots on the curve; the free labels currently float at different offsets. Shade each half-life interval as alternating very light blue bands down to the axis. Keep part `halflife` and `level`, `data-now`.

### Step 8 `gone` (grade 7)
Good: clear halving bars, staged reveal.
Problems: label vocabulary mixes words, fractions and percents ("all, half, 1/4, 1/8, 6%, 3%"); dashed empty outlines are a little busy; the amber "all but gone" rule crosses the dashed outlines.
Redraw: one vocabulary: 100%, 50%, 25%, 12.5%, 6%, 3% (the caption says "a few percent"; 6.25 and 3.125 rounded is fine), or fractions throughout. Draw each bar as a vial/beaker silhouette with liquid level (blue gradient, meniscus highlight) so "drug left in the body" reads as an amount; empty part of the vial as a pale outline instead of dashed rects. "all but gone" as an amber bracket above bars 4 and 5. Keep `data-bar`, part `halflife`.

### Step 9 `buildup` (grade 7)
Good: accumulation reads; amber trough dots and trend arrow; dose triangles.
Lift: make dose markers small tablet glyphs (amber capsule) above the plot with a hairline to the axis; shade the trough-to-trough rise; the trend arrow should pass just under the troughs, not 30 units below. Keep part `troughs`, `data-given`.

### Step 10 `steady` (grade 7)
Good: half-life ruler on the time axis, bracket "about 4 to 5 half-lives".
Problems: "plateau" label floats top right, far from the dotted line; the vertical steady-state line cuts through the dose-marker row.
Redraw: stop the steady-state line below the dose row; shade the peak-to-trough envelope from steady state onward as a pale blue band (labelled "rises and falls around the plateau"), and put "plateau" at the dotted line's right end. Keep `data-ss`, part `plateau`.

### Step 11 `range` (grade 7)
Good: clear band, too high / too low words, curve settles inside.
Lift: tint above-band zone very pale red and below-band very pale grey (not just text), keep band amber; label "working range" sits fine. Keep part `band`, `plateau`.

### Step 12 `whole` (grade 4)
Problems: box strip; "bioavailability" has a hand-drawn blue hook leader that reads as a stray squiggle and points near (not at) the liver->blood arrow; "steady-state level ↓" sits far above the dotted line; the half-life (one of the "three measures" in the caption) is not marked at all; blood box wraps 8 dots onto 2 rows unevenly.
Redraw: new strip, with three numbered callouts in blue matching the caption: (1) bioavailability, leader to the hepatic-vein lumen (part `lost`); (2) half-life, as a bracket on the time axis or one half-life ruler segment; (3) steady-state level, label at the dotted line's right end (part `plateau`). Remove the squiggle.

### Steps 13, 14, 15 `inducer`, `inhibitor`, `kidney` (grade 5)
Good: dashed normal ghost, staged morph (strip then curve), readout, steady-state ticks with arrow.
Problems:
- Ghost flows render as jagged overlapping dashed polygons on the solid arrows (liver->blood, broken down, urine): looks like a rendering error.
- Label placement contradicts the message: inducer's "↓ settles lower, below the working range" sits *above* the band while the curve is below it; inhibitor/kidney "↑ settles higher, above the range" sits *below* the band while the curve is above.
- The right-edge `levelArrow` is crammed into x 462 to 478, overlapping the curve's last fall and touching the frame edge.
- "liver enzymes switched up" and the "level in the blood" axis word share one line; fine, but the strip itself shows no enzyme.
Redraw: new strip with the organ that changes drawn with a visible cause: inducer: the liver gains more enzyme glyphs (small Pac-man-like CYP blobs, 2 -> 5) and the "broken down" vessel widens; inhibitor: enzyme glyphs get a red block bar; kidney: the kidney silhouette shrinks/pales (scarred cortex) and the ureter lumen narrows. Place the change words on the side of the band where the new curve settles (inducer: inside the gap between band and axis, left of the arrow; inhibitor/kidney: above the band, under the dose row). Move `levelArrow` 30 units left into the plot over the last trough-to-trough gap, with a short dashed tick at the normal plateau and the blue arrow to the new plateau. Keep `data-ghost`, `data-ghost-curve`, `data-ghost-flow`, `data-ghost-ss`, `data-ss`, `data-delta`, `data-new-state`, `data-flow`, `data-w`.

### Step 16 `iv` (grade 5)
Problems: same ghost-flow noise on the gut and first-pass arrows; the blue jump arrow sits 14 units left of the first vertical jump and overlaps the falling curve; dose markers stay amber tablets although the drug is injected; "into a vein" label touches the top edge.
Redraw: syringe/cannula glyph into the blood vessel; gut, portal vein and liver-to-blood lumen fade to dashed ghost walls (they are bypassed); dose markers for the IV curve become small blue syringe ticks (ghost oral doses keep amber); the "jumps straight up" arrow placed to the right of the first vertical rise with clear space; keep "same half-life: same time to steady state" under the axis but clear of the ss tick.

## Reusable primitives (for the shared illustration library)

- Stomach + small intestine loops, with dissolving tablet
- Liver silhouette (right/left lobe, gallbladder), with optional enzyme glyphs (normal, induced count, inhibited with block bar)
- Kidney (bean, cortex/medulla hint, hilum) + ureter + bladder
- Vessel segment primitive: two walls + lumen, width-driven, oxygenated/venous/portal colourways, dashed-ghost variant, flow chevrons
- Cut-away blood vessel with biconcave red cells and drug-molecule lanes
- Capillary loop into a tissue-cell block
- Drug molecule dot (blue, white rim) and tablet/capsule glyph
- IV syringe / cannula glyph
- Blood drop under a magnifier lens
- Graph kit: axes with half-life ruler, dose-marker row (tablet / syringe variants), shaded area between two curves, shaded envelope band, therapeutic band with above/below zone tints, ghost curve, steady-state tick, axis-anchored value ticks
- Vial/beaker bar for "amount left"

## Risks a redraw could break

- **Model-driven geometry**: every curve comes from PK.curve/PK.level; every flow width from `widths(p)` (F, ka, CLh, CLr, Vd, iv); `PK.mix(NORMAL_P, CHANGES[kind], u)` morphs the strip. Vessels must keep width = model value or the change steps lose their meaning (CHANGE_WHERE text says arrows thicken/thin past dashed outlines: keep that true or rewrite it).
- **Hard-coded coordinates**: BOX, FLOWS, ROUTES (step 1 dot paths), dotsIn lanes, the `bioavailability` leader (`M198 8 Q190 10 194 38`), STRIP_H=116 and UNDER_STRIP {PT:158} all assume the box layout; scene heights 214/368 etc. in `scenes`.
- **Hooks**: data-part names used by dfn: gut, liver, kidneys, level, peak, lost, tissues, wide, cleared, halflife, troughs, plateau, band, vein (vein has a dfn in step 16; the part currently wraps the vein flow). Attributes: data-drug, data-now, data-curve, data-ghost-curve, data-ghost-flow, data-ghost="normal", data-ghost-ss, data-ss, data-given, data-bar, data-sample, data-delta, data-new-state, data-alt, data-flow, data-w. The shared tools/lab-walk.mjs checks label overlap and min 12 px on phone at the end of each picture.
- **aria-labels** describe "The body as five boxes" and arrows; must be rewritten to the new picture.
- **Label overlap**: organ names vs moving dots (step 1 already fails visually), dose row vs steady-state line, change words vs curves; at 375 px the strip text must stay >= 17 units (no scaling down of a group containing text).
- **Accuracy traps**: first pass happens via the hepatic portal vein before the general circulation (draw it in that order); grapefruit acts mainly on gut-wall enzymes (if drawn, enzymes in the intestinal wall, not the liver); IV bolus gives F=1 with unchanged half-life and unchanged time to steady state; wider Vd lowers the peak and lengthens the half-life only at fixed clearance (caption states that); steady state ~4 to 5 half-lives; do not draw a specific enzyme name (CYP3A4 etc.) unless the caption adds it; the working range is illustrative.
- **Reduced motion / rest**: scenes use default rest=1; final frames must still contain every named label.
