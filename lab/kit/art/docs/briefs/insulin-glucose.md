# Redraw brief: insulin-glucose (Lesson 13, 19 steps)

Audited 2026-11-12 from captures at t = 0.35 and t = 1 (shots/insulin-glucose/*.png), app.js, index.html, style.css.
Overall grade: **3 / 10**. The lesson is clear and the model-driven meal chart is good, but every anatomical or
cellular subject is a placeholder: the pancreas is a sausage, the liver is an unlabeled brown potato, muscle and fat
are pink rounded rectangles, the islet is a white disc of flat blue/red dots, insulin is a blue diamond, glucose
transporters are pairs of blue bars, SGLT2 is a green lozenge on a yellow pipe, the stomach is a beige blob, immune
cells are target symbols. Nothing has a membrane, a wall, a lumen or shading. Two depictions are physiologically
misleading (insulin appears to bind the glucose "doors"; the islet puts alpha cells in the core), and the kidney
pictures send glucose back through empty air rather than through a tubule cell into a capillary.

## Ground rules for the redraw (keep)

- 480 wide, heights as now (fuel 330, meal 364, pancreas 352, incretin 232, doors 330, liver 340, feedback 400,
  glucagon 412, kidney 260, diabetes 366, whole 396, change steps 420). Text classes only (20 / .sm 18 / .xs 17).
- Everything stays a function of `t`. Do not touch `model.js`, `mealChart()`'s curve maths (`X`, `G`, `I`,
  `curvePts`), `CHANGES`, `rows()`, `describe()` or the readouts: the chart and readouts are model-driven.
- Keep every `data-part` that a `<dfn>` uses (see Risks) and `data-curve` on the glucose path.
- One visual vocabulary for the molecules, used in every step:
  - **glucose**: small amber hexagon ring (6-sided, r ~5, fill `#f2a93b`, stroke `C.amber`), not a circle.
  - **insulin**: blue two-chain glyph (two short parallel rounded bars joined by two thin bridges = A and B chains
    with disulfides), ~12 x 8, fill `C.blue`. Not a diamond (the diamond reads as a generic token).
  - **glucagon**: single red-brown curled peptide (short helix squiggle), `C.red`-ish but darker than blood
    (`#8c1d18`) so it does not vanish against vessels.
  - **GLP-1**: purple short helix squiggle (`C.purple`), same family as glucagon (it is a proglucagon product).
  - **Na+**: small grey-violet circle with "+" (only in the kidney steps).
- Palette for tissue: blood lumen `#f6dcd6` with a vessel wall in two tones (outer `#c9493f`, inner endothelium
  `#e59a8f`), RBCs as biconcave discs (`#c8372d` with lighter centre) used sparingly; liver `#a4553f` lobes with a
  `#c97760` highlight gradient; pancreas `#efc9a6` lobulated with `#d9a77f` lobule lines; muscle fibre `#d77a6e`
  with striations; adipocyte pale yellow `#f8ecc2` lipid droplet with a thin rim of cytoplasm; brain `#e8c6d6`
  with gyri lines; kidney `#b8574a`. One soft radial gradient (light top-left) per organ, one 2px ink outline weight
  for organs, 1.5px for cells, 1px for organelles. Shared `<defs>` for gradients so ids do not collide between
  steps (prefix with the step kind).
- Membranes: every cell that something crosses gets a **lipid bilayer strip** at the crossing (two rows of small
  head circles with paired tails), not a single line. Elsewhere the cell outline can be a plain 1.5px stroke.

## Per step

### Step 1 fuel (grade 3)
Problems: blood is a pink pill; brain is a two-lobed bean; muscle and fat are identical rounded boxes in two tints;
glucose dots float down through empty space into the box tops; no sense of a capillary feeding tissue. The meter is fine.
Redraw: a horizontal **capillary** across the top (wall + lumen, a few RBCs, glucose hexagons riding the flow,
label "blood" outside the vessel at its right end, not on top of the dots). Below it three tissue vignettes, each
fed by a short branch capillary (so glucose leaves through the wall, not the air): **brain** in lateral silhouette
(frontal/temporal lobes, a few gyri strokes, cerebellum hint), **skeletal muscle** as a bundle of 3 striated fibres
(cut end showing round fibre profiles), **fat** as a cluster of 4 to 5 adipocytes (large lipid droplets, crescent
nuclei). Glucose hexagons step across the capillary wall into each. Keep the blood-sugar meter (`data-part="meter"`)
but draw it as a slim gauge with the green band and an amber needle; keep "kept in a narrow healthy band".
Keep `data-part="glucose"` on the riding molecules.

### Step 2 meal (grade 4)
Problems: gut is a rounded box with two squiggles; glucose dots run over the "blood" label at t = 1; the chart
spans 4 hours but the curve stops at 45 min, so 70% of the plot is empty at the end of the step; "gut" and
"blood sugar" labels stack into one another at left.
Redraw: top band, left: a **small-intestine wall cut-away**: 3 villi (finger-shaped, columnar epithelium edge,
a capillary loop inside each), starch/sugar hexagons in the lumen breaking into single hexagons, entering the villus
capillary, which drains right into the horizontal blood vessel (label "blood" outside, right). Label "small
intestine" (keep `data-part="gut"`; the dfn is "carbohydrates"). Bottom: keep `mealChart` but set the x range to the
part that is drawn, or keep 4 h and let `until` run to ~90 min so the peak and early fall show; put "healthy band"
inside the band at left so it never meets the curve. Keep the blue "↑ climbs above the band" and "something has to
clear it".

### Step 3 pancreas (grade 3)
Problems: pancreas is a sausage with no head, body or tail and no duodenum; the islet puts **two alpha cells in the
centre and beta cells around them**, which is backwards for the classic rodent mantle picture and wrong for human
islets (cells intermingled, beta the majority); "(blue)"/"(red)" colour keys are a crutch; insulin diamonds ride
inside the arrow as notches; insulin and glucose dots overlap in the vessel; the blood label sits on a dot.
Redraw: top-left a recognisable **pancreas**: head nestled in the C of the duodenum (draw the duodenal C in
`#e8b9a0`), neck, body, tail tapering up-right toward the spleen (spleen optional, omit), lobulated outline,
main pancreatic duct as a thin line. A magnifier circle on the tail (islets are densest in the tail) with leader
lines to the enlarged **islet**: a pale cluster ringed by exocrine acinar cells (wedge cells with dark basal
nuclei, grey-tan), inside it ~10 polygonal endocrine cells with nuclei: beta (blue, ~60%, with small dark
insulin granules), alpha (red, ~25%, scattered, more toward the rim), 1 to 2 delta (grey, unlabeled or "delta"),
and a capillary threading through. Labels with leader lines to one cell of each kind ("beta cells", "alpha
cells"), no colour-word keys. Insulin glyphs leave the beta cells into the islet capillary, which drains into the
vessel at the bottom; the glow on beta cells (`glow`) stays as a rim highlight. Keep `data-part` pancreas, islet,
beta, alpha, insulin, blood.

### Step 4 incretin (grade 3)
Problems: GLP-1 dots travel through air from a box "gut" to the islet; the blood vessel below is unlabeled and
unused; scissors are a metaphor with no enzyme.
Redraw: left, the same small-intestine wall as step 2 with one **L cell** in the epithelium (flask-shaped, purple
granules) releasing GLP-1 squiggles into a villus capillary; the capillary runs right as a labeled blood vessel to
the islet (reuse the step-3 islet primitive). On the vessel wall midway, **DPP-4** as an enzyme on the endothelial
surface (a small two-lobed protein with a cleft, ink outline, grey fill) cutting most GLP-1 squiggles into two
fragments that fade; survivors reach the beta cells, which brighten and release insulin glyphs. Keep a tiny
scissors badge next to the DPP-4 label if wanted, but the enzyme is the shape. Keep `data-part` glp1, dpp4, islet,
beta. This function is reused by the dpp4 change step (`incretinPicture(.3, {blocked, site:true})`): keep that
signature and the `blocked` overlay (blue ring and bar over the enzyme).

### Step 5 doors (grade 3), the most important cell picture in the lesson
Problems: the cell is a pink rectangle with two random horizontal lines; there is **no insulin receptor**, so
insulin appears to land on bare membrane while the "doors" (two blue bars) rise; doors look like gaps, not proteins;
a glucose dot runs under "1 insulin docks" at t = 1.
Redraw: a close-up of the top of a **muscle cell**: the plasma membrane as a lipid bilayer strip across the full
width, capillary above it (wall, lumen, glucose hexagons, insulin glyphs). In the membrane, 2 **insulin receptors**
drawn as the textbook α2β2 tyrosine-kinase shape (two extracellular α cups forming a binding pocket, two β stalks
crossing the bilayer, intracellular kinase blocks that get small phosphate "P" dots when active). Inside the cell,
4 to 5 **GLUT4 storage vesicles** (small bilayer circles each carrying a transporter). Animation: (1) insulin
glyphs drop into the receptor pockets (`span .05-.3`), kinase domains light; (2) a dashed signal arrow runs from
receptor to the vesicles, vesicles rise and fuse with the membrane (`.3-.6`), leaving **GLUT4** as a 12-helix
barrel drawn as a transmembrane pore (two rounded half-cylinders with a channel between); (3) glucose hexagons pass
through the GLUT4 pores into the cytoplasm (`.6-1`). Numbered labels 1/2/3 at the right in clear space (no
molecule paths through them). Label "muscle cell" (caption says muscle or fat; "muscle or fat cell" is fine).
Keep `data-part="doors"` on the GLUT4/vesicles group and `insulin` on the hormone; add `data-part="receptor"` (no
dfn needs it yet).

### Step 6 liver (grade 3)
Problems: the liver is an **unlabeled** brown oval (the dfn "liver" lights it, but the eye cannot tell what it is);
the "insulin" arrow points at nothing; glycogen is a spiral of glucose circles; glucose and insulin markers overlap
in the vessel.
Redraw: a recognisable **liver** in anterior view: large right lobe, smaller left lobe tapering left, falciform
ligament line, inferior border notch, gallbladder tip (green-grey, optional), radial gradient. Label "liver".
Inside, a magnified **hepatocyte** inset (polygonal cell, round nucleus) holding a **glycogen granule** drawn as a
branched tree (central dot, branching chains of linked hexagons; branches every 4 to 5 units) that grows with `k`.
Arrows: glucose from the vessel into the hepatocyte ("stored"), insulin glyph binding at the hepatocyte
membrane (receptor primitive, small), glucose out of the liver back to blood ("released") thinning over its ghost
outline, with "release turned down" in blue beside it. Keep `data-part` liver, glycogen.

### Step 7 feedback (grade 6), graph, already good
Good: two stacked panels sharing a time axis, the marker dots, the numbered words appearing in order.
Lift: add a faint y-axis scale (three ticks, "mg/dL" not required) or at least "fasting" tick; shade the area of the
glucose curve above the band in pale amber (`#f2a93b` at .18) and the insulin area under its curve in pale blue,
so "rises and falls back" reads as a filled hump; drop the boxed white frames for a borderless plot on a white card
with only a baseline; hour ticks (0, 1, 2, 3, 4 h) on the shared axis; move "healthy band" inside the band at the
left. Keep `data-part="curve icurve"` behaviour (dfn lights both).

### Step 8 glucagon (grade 3)
Problems: the islet is the same flat dot disc with alpha cells in the centre; the liver is unlabeled again; the
glucagon arrow shows serrated notches at t = 1 (triangles riding inside the thick arrow); "blood" label collides
with a dot.
Redraw: islet primitive (alpha cells lit, beta dim) top-left, glucagon squiggles travelling in a vessel (not air) to
the labeled liver primitive; the hepatocyte inset's glycogen tree shrinks branch by branch (glycogenolysis) and a
small "new glucose" source (a hexagon assembling from three small precursor dots, labeled "made new") adds a
second stream (gluconeogenesis, which the caption names). Glucose flows into the vessel; the gauge needle climbs
back into the band. Draw glucagon riders beside the arrow, not inside it. Keep `data-part` alpha, glucagon, liver.

### Step 9 kidney (grade 3)
Problems: SGLT2 sits on the outside of a yellow pipe facing the blood, and glucose returns to the blood **through
empty air**; no tubule cells, no capillary; dots cross "filtered" and "SGLT2 carriers hand it back"; the urine drop
is clip art.
Redraw as the standard **proximal tubule cross-section** strip: left-to-right lumen (pale yellow) at the bottom,
a row of 3 tubule epithelial cells (cuboidal, brush border of short villi on the lumen side, nuclei), a
peritubular capillary across the top. On each cell's **apical** (lumen) membrane an **SGLT2** symporter (protein
with two binding sites, one Na+ and one glucose) and on the **basolateral** membrane a **GLUT2** uniporter; a small
Na+/K+ ATPase on the basolateral side (unlabeled or "Na pump"). Glucose hexagons: filtered in from a glomerulus
stub at left, carried along the lumen, taken up by SGLT2 with a Na+, cross the cell, leave by GLUT2 into the
capillary. Lumen exits right toward "urine" (a short collecting arrow, no clip-art drop), empty of glucose. Labels
"proximal tubule", "SGLT2", "blood" in clear lanes no rider crosses. The caption mentions a second carrier (SGLT1)
taking most of the rest: optional single further-along SGLT1 on the last cell, labeled small. Keep `data-part`
tubule, sglt2, blood. `kidneyPicture(t, blocked)` signature is not reused by change steps (sglt2 draws its own),
but keep `blocked` working.

### Step 10 diabetes (grade 4)
Problems: four white text boxes in a circle with arrows; correct, but a flowchart, not a picture; the two red X
markers sit on the arrow and box corner.
Redraw: keep the loop but make each node a small icon from the shared primitives (gauge needle up, islet with
insulin glyphs, muscle cell with open GLUT4, gauge needle down) with the short words under each; arrows as curved
arcs round a circle. Mark the two failure points with the red X on the arc into "cells take in glucose"
("too little insulin", from the islet) and on the GLUT4 node ("cells answer weakly"). Keep `data-part="high"` on
the failure marks.

### Step 11 whole (grade 3)
Problems: "pancreas" labels an islet disc; the arrow from the liver runs through the "liver: between meals" label
(the "l" is hidden); the kidney arrowhead lands on top of the kidney; organ icons are the same placeholders.
Redraw: a **body-map schematic**: a pale translucent torso outline (head, trunk) with the organs in their real
positions (brain in the head, liver upper right of the figure's body = viewer's left, stomach and pancreas behind
it, small intestine loops, kidneys posterior at waist level, a thigh muscle and a fat layer at the flank), each
using the shared primitives at icon scale; blood sugar as a central vessel/pool. Arrows in/out of the pool sit in
clear lanes, labels outside arrow paths. Keep "insulin: down / glucagon: up" and the blue `data-part="fasting"`
box. Keep `data-part` blood, pancreas, fasting.

### Step 12 type1 (grade 4)
Problems: immune cells are target icons; destroyed beta cells are crossed-out pale dots; the insulin arrow is an
abstract bar; "healthy band" label straddles the chart's bottom border.
Redraw site: islet primitive with **insulitis**: 4 to 5 T lymphocytes (small round cells, large dark nucleus,
thin rim, pale lilac `#d9cbe6` with `C.purple` outline, or ink if purple is reserved for GLP-1) infiltrating from
the rim; beta cells shrink, lose their granules and fade to empty outlines (`lost`), alpha cells remain. Insulin
glyph stream leaving the islet thins over its ghost. Keep the three red words. Chart: see "change chart" below.

### Step 13 type2 (grade 3)
Problems: **insulin diamonds sit directly above the "doors" and the closed doors are black slabs, so insulin seems
to bind the glucose transporter itself**; that is the wrong mechanism to teach.
Redraw site: the step-5 membrane close-up at small scale: insulin glyphs **bound to their receptors** (more of them
than normal), but the signal arrow from receptor to GLUT4 vesicles is dimmed/broken (dashed, faded) and only 1 of 4
vesicles reaches the membrane; the others stay inside (ghost outlines where they would be normally). Words in red
as now. Keep `data-part` doors, insulin.

### Step 14 insulin injection (grade 4)
Problems: syringe is a flat outline; the same diamond/door confusion as step 13.
Redraw site: skin cross-section corner (epidermis line, dermis, subcutaneous fat lobules) with an insulin **pen or
syringe** needle into the subcutaneous fat, insulin glyphs diffusing into a small capillary, then the membrane
close-up (receptors filling, GLUT4 rising) as in step 5 at small scale. Keep `data-part="syringe"`.

### Step 15 metformin (grade 4)
Problems: liver blob with a text label; blood is a pill; the long blue sentence runs to the right edge (x ~ 468).
Redraw site: liver primitive with hepatocyte inset; the gluconeogenesis source (from step 8) dims and its output
arrow thins over its ghost; a small "metformin" tablet glyph (white oval with score line) beside the hepatocyte.
Break the blue sentence in two lines. Keep `data-part="liver"`.

### Step 16 sulfonylurea (grade 4)
Problems: the beta cell is a lavender circle; the K channel is two purple squares; the labels "potassium channel"
and "channel shut by the drug" sit over the cell outline (their halo cuts the circle); no granules or calcium, so
"insulin out" has no mechanism on the page.
Redraw site: a **beta cell** close-up (polygonal, nucleus, many dark-cored insulin granules) with a membrane bilayer
strip on its left edge holding the **K-ATP channel** (four-subunit pore Kir6.2 with the SUR1 regulatory subunit as
a side lobe; the drug, an orange tablet glyph, docks on SUR1), a **voltage-gated Ca channel** below it. Sequence by
`k`: K+ efflux arrow stops, membrane tint shifts (depolarized), Ca2+ dots enter, granules move to the membrane and
fuse, insulin glyphs leave right. Labels in clear space to the left and below, not over the outline. Keep
`data-part` channel, beta.

### Step 17 sglt2 inhibitor (grade 4)
Problems: same air-gap tubule as step 9; glucose dots pile on the outer edge of the urine drop; the faded sentence
at t = 0.35 is fine.
Redraw: the step-9 proximal-tubule strip at reduced height (fits in SITE_H 172); the drug glyph (small orange
tablet) docked in each SGLT2; hexagons stay in the lumen and flow to "urine" at right. Keep the blue sentence.
Keep `data-part` sglt2, tubule.

### Step 18 GLP-1 agonist (grade 3)
Problems: the drug is never drawn; stomach is a blob; a separate "alpha cell" with red triangles duplicates the
islet's alpha cells; the whole site fades in from 35% opacity, which reads as a rendering glitch at t = 0.35.
Redraw: injection pen glyph at top-left releasing purple GLP-1 squiggles (drug); three targets each drawn as a real
organ with a GLP-1 receptor mark: **stomach** (J-shaped silhouette with fundus, body, antrum, pylorus; "empties
slower" with a thin outflow arrow at the pylorus), **islet** (beta cells brighter: "↑ insulin, while sugar is
high"), and the same islet's **alpha cells** dimmed (one islet, two labels; drop the separate alpha cell). No
global fade: animate the effects. Keep `data-part` glp1, alpha.

### Step 19 DPP-4 inhibitor (grade 4)
Problems: inherits step 4; the blue block ring covers two GLP-1 dots; "beta cells" sits between the islet and the
sentence.
Redraw: reuse the redrawn step-4 vessel picture; the inhibitor (tablet glyph) sits in DPP-4's cleft, the enzyme
greys, more GLP-1 squiggles reach the islet. Keep `data-part` dpp4.

### Change chart (steps 12 to 19) (grade 6)
Good: dashed normal ghost, dotted untreated, live curve; words with arrows; readouts agree at t = 1.
Problems: "healthy band" label is pushed below the band (narrow band at scale 20 to 300) and straddles the chart
border; the insulin panel is only 40 tall so insulin changes are hard to see; legend line "dashed: normal · dotted:
untreated" is the only key.
Lift: put the band label at left inside or above the band; insulin panel 52 tall (take 12 from the site or the
glucose panel); shade the area between the untreated (dotted) and current curve in pale blue as the curve moves
("what the drug removed"); short inline legend swatches (dash, dot, solid) instead of words; hour ticks.

## Reusable primitives (shared library candidates)
- glucose hexagon ring; insulin two-chain glyph; glucagon / GLP-1 peptide squiggle; Na+ / K+ / Ca2+ ion dots
- blood vessel / capillary segment (wall, endothelium, lumen, RBCs), horizontal and branching
- lipid bilayer strip (heads + tails), with slots for transmembrane proteins
- insulin receptor (α2β2 receptor tyrosine kinase, phospho dots)
- GLUT4 transporter + GLUT4 storage vesicle (fuses into membrane); GLUT2 uniporter
- SGLT2 / SGLT1 symporter (Na+ and glucose sites); Na+/K+ ATPase
- K-ATP channel (Kir6.2 pore + SUR1) and voltage-gated Ca2+ channel
- beta cell close-up with insulin secretory granules (exocytosis)
- pancreas (head in duodenal C, neck, body, tail; duct) and islet of Langerhans (beta, alpha, delta, capillary, acinar rim)
- liver anterior view (right/left lobes, falciform, gallbladder tip) + hepatocyte inset
- glycogen granule as branched tree (grow/shrink by n)
- small intestine villus wall with enteroendocrine L cell
- stomach (fundus, body, antrum, pylorus)
- skeletal muscle fibre bundle (striations), adipocyte cluster (lipid droplet, crescent nucleus), brain lateral silhouette
- proximal tubule strip (lumen, brush border epithelium, basolateral membrane, peritubular capillary); kidney silhouette
- T lymphocyte (insulitis)
- DPP-4 enzyme on endothelium; tablet glyph; insulin pen / syringe; skin-subcutis cross-section corner
- body-map torso schematic with organ slots
- gauge (band + needle); time-course chart with shaded areas, ghost/before lines, hour ticks

## Risks
- **dfn data-part names** in index.html that must keep a target: glucose, meter, gut, pancreas, islet, beta, insulin,
  glp1, dpp4, doors, liver, glycogen, curve + icurve (one dfn lights both), alpha, glucagon, tubule, sglt2, high,
  fasting, attack, syringe, channel. Step 13's dfn "type 2 diabetes" uses `doors`; step 15's "Metformin" uses
  `liver`; steps 16 uses `channel` twice. The kit needs >= 3 per lesson (lab-check.mjs) and lights by name, so a
  redraw that renames a group silently breaks highlighting.
- `data-curve` on the glucose path in `mealChart` (keep).
- Model-driven geometry: `mealChart`, `X/G/I`, `curvePts`, `CHANGES`, `rows()`, `REFBAND` from clinical-values.json,
  the `site(kind, k)` contract (k = min(1, 1.5 * eased t)) and the readout. The Explore tab's `chartSvg` also calls
  `mealChart` (y 6, gH 150, iH 70): chart changes must still work at that size.
- `incretinPicture(t, {blocked, drug, site})` is reused by the dpp4 site (translated -18 inside SITE_H 172): the
  redraw must fit 172 tall in site mode.
- lab-walk.mjs fails on overlapping `<text>` boxes and any label under 12 px on a 375 px phone. Riding molecules are
  not text, but labels must sit in lanes the riders never cross (current failures by eye: step 2 blood label,
  step 5 "1 insulin docks", step 9 "filtered" and carrier label, step 11 liver label, step 16 channel labels,
  change-step "healthy band" on the chart border).
- Detail versus phone legibility: at 375 px one unit is ~0.78 px; bilayer heads under r 2 and granules under r 1.5
  disappear. Keep molecules >= 8 units across, organelles as hints.
- Accuracy traps: insulin binds its receptor, never GLUT4; GLUT4 is insulin-dependent (muscle, fat), the liver and
  beta cells use GLUT2; human islets are intermingled with beta the majority (do not draw an alpha core); SGLT2 is
  apical in the early proximal tubule, glucose leaves basolaterally by GLUT2; sulfonylureas bind SUR1 of K-ATP;
  DPP-4 acts in the circulation/endothelium; GLP-1 comes from intestinal L cells; type 1 insulitis spares alpha
  cells; caption claims (metformin mainly cuts hepatic glucose output; does not push the pancreas) must stay true.
- Colour clash: blue is both insulin and the kit's "change" colour; red is blood, harm, alpha cells and glucagon.
  Keep insulin blue (the thing taught), make glucagon a darker red-brown, keep vessel red for walls only.
- Gradient/`<defs>` ids must be unique per SVG; each render(t) rebuilds the SVG string, so ids reused across steps
  on one page can bind to the wrong step's defs.
- No smoke-test hooks (`data-anim`, `data-loop`, `data-final`, `data-model-shifts`) are used by this lesson.
