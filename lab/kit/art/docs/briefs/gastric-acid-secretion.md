# Redraw brief: gastric-acid-secretion (Lesson 16, "Stomach acid and the parietal cell")

Audited 2026-11-13 from lab-shoot captures at t=0.35 and t=1 for all 16 steps
(shots in `.../scratchpad/audit/shots/gastric-acid-secretion/`), plus `index.html`, `app.js`, `model.js`, `style.css`.

**Overall grade: 3 / 10.** Every picture is built from flat UI tokens: a rounded beige rectangle is "the parietal cell",
two grey boxes are "the lining", a pink band is "the blood side", blue circles with a white arrow are "proton pumps",
black cups are "receptors", a pac-man is "pepsin", a green ellipse is "a germ". Nothing reads as a cell, a membrane,
a protein, a vessel or tissue. The teaching logic (one shared scene, model-driven pump counts, ghosted "what changes it"
morphs, two meters) is sound and worth keeping; the drawing layer under it needs replacing.

## Global problems (apply to every step)

1. **No biology in the shapes.** The cell is a rectangle with a nucleus in its bottom-right corner; no membrane, no
   canaliculus, no mitochondria. The "blood side" is a pink band with no capillary wall. Messengers float in that band, so
   histamine (paracrine, through tissue fluid) and acetylcholine (from a nerve ending) look as if they travel in blood.
2. **A real rendering bug: mucus and ulcer have no fill.** `lining()` line 105, `shieldPicture()` lines 402 and 404 call
   `path(d, stroke, w, 'fill="..."')`, but kit `path()` already writes `fill="none"`, and the first duplicate attribute wins.
   So the mucus gel (steps 10, 11, 12, 13 to 16) and the ulcer crater (step 10) render as bare outlines. Use kit `shape()`.
3. **Colour overload.** Amber means histamine, the on signal, the brake, prostaglandins, pepsin, food, energy and the
   "acid made" meter at once. Red means hydrogen ions, blood, acidity, ulcer and "locked". Purple (`C.purple`) is unused.
4. **Ions have no charge.** H+ is a plain red dot; Cl- is a green ring; K+ is a black square. Nothing says "ion".
5. **Label collisions** (FORMAT violation): step 3 "hydrogen ion" sits on ions; step 4 "hydrogen out", "potassium in",
   "each swap uses energy" sit on ions; step 6 "acid switches pepsin on" sits on pepsin; step 8 "histamine" sits on the
   cell border, "H2 receptor" floats with no leader; step 11/16 "from prostaglandins" and "brake harder" run into the
   on-signal arrow; steps 13 to 16 the dashed ghost meter marks cut through the words "makes" and "acidity".
6. **Ghost noise in 13 to 16.** Dashed outlines are drawn round every pump, the signal and the brake even when they have
   not changed, doubling every edge. Draw a ghost only where the changed state differs from normal (or draw it under, in
   `#8a8f84`, offset so it peeks out only where the solid shape shrank).
7. **No depth.** Flat fills, uniform 1.5 to 2 px strokes everywhere, no gradients, no highlight; nothing separates
   foreground (the parietal cell) from context (neighbours, tissue).

## Palette for the redraw (keep kit colours for meaning, add tissue tones)

- Lumen (stomach contents): pale warm `#fdf0e8` to `#f8e3d6` vertical gradient.
- Epithelial cytoplasm (parietal cell): pink-eosinophilic `#f6d9d2` to `#efc2b8` radial gradient (parietal cells stain
  pink on H&E); nucleus `#8e6fae` to `#6b4f8f` with a darker chromatin speckle and a nucleolus dot.
- Surface mucous cells: pale `#f4ede4` with a translucent mucin cap `#e6efd9`.
- Chief cells: cytoplasm `#d9d3ea`, zymogen granules `#6b3fa0` (purple, basophilic).
- Lamina propria (tissue fluid side): `#f7ece4` with faint fibre strokes; capillary wall `#c96d62`, lumen `#f3c9c2`,
  RBCs `#c0392b` to `#9e2a20` biconcave (lighter centre).
- Membrane bilayer: heads `#d9a441` beads, tails `#efe0b8`.
- Meaning colours: H+ red `C.red` with white "+"; Cl- green `C.green` with white "-"; K+ ink with white "+";
  pump protein blue `C.blue` (alpha subunit) + lighter `#8aa2ff` (beta subunit); on signal: gold ribbon
  `#e0a020` to `C.amber`; histamine amber; gastrin blue; acetylcholine green; **prostaglandins and the brake: purple
  `C.purple`** (frees amber); drugs: PPI red clamp, H2 blocker dark slate `#3a3f4b`, antacid blue hexagon (keep).
- Strokes: 2.5 for the hero cell outline, 1.5 for context cells, 1.2 for organelles; leader lines 1.2 ink.

## Model-driven geometry and hooks a redraw must keep

- Constants: `AP = 100` (apical face y), `BAS = 274` (basolateral face y), `BLOOD_B = 346`, `PUMP_X` (6 slots,
  filled in order), `VES` (7 stored slots), `RECEPTOR = {h2:160, gastrin:270, ach:380}`, `SIG_X/SIG_TOP/SIG_BASE`,
  `BRAKE_Y`, `TOTAL = 8`, meter block y 352 to 420. Counts come from `pumpsUp(v)`, `pumpsLocked(v)`, `poolCount(v.acid)`,
  `signalWidth(v.drive)`, `brakeWidth(pg)`, `mucusH(v.shield)`; these must keep driving the new drawing.
- `scene(v, o, phase)` is also used by `tabPicture()` (Clinical values and Explore freely tabs) with any slider mix
  (messengers 0 to 2.5, pg 0.2 to 2.5, drugs combined, vomiting state). Up to 6 pumps up, 0 histamine, etc. must all draw.
- Attributes: `data-part` names used by `<dfn>`: `lining, pit, gland, cell, blood, acidity, hydrogen, pump, potassium,
  chloride, channel, hcl, pepsin, vesicle, histamine, receptor, signal, gastrin, ach, mucus, bicarbonate, ulcer, pg,
  brake, made, antacid`. Note step 13's dfn uses `pump`, step 14's uses `histamine`, step 16's uses `pg`.
  Keep also `data-pump`, `data-locked`, `data-vesicle`, `data-flow="signal|brake"` + `data-w`, `data-meter` +
  `data-level`, `data-plug`, `data-antacid`, `data-h`, `data-cl`, `data-k`, `data-msg`, `data-ghost-*`,
  `data-key-measures`, `data-delta` (no repo tool greps them today, but they are the lesson's own test surface).
- Text alternatives: every aria-label in `scenes` and every `CHANGE_WHERE` sentence names colours and shapes
  ("red crosses", "dark blocker", "blue antacid hexagons", "cup-shaped H2 receptor", "amber brake line",
  "green chloride rings"). Rewrite them with the new drawing or they will lie.
- Change timing: `HOLD .08, DONE .46, LOOP .5`, `loopFrom`; step 8 `loopFrom .76`.

## Reusable primitives (build once in a shared illustration module, `lab/kit/anatomy.js` or similar)

1. `bilayer(x1, x2, y, {curve})`: lipid bilayer strip, two rows of head beads + paired tails, clip-safe, ~10 units thick.
2. `transmembraneProtein(x, y, kind)`: blob spanning a bilayer. Kinds: `pump` (H+/K+-ATPase: large alpha + small beta
   with a glycan sprig on the lumen side), `channel` (barrel with central pore), `exchanger`, `gpcr` (7-loop serpentine
   with a ligand pocket on the outside face).
3. `ion(x, y, kind)`: H+ (red disc, white "+"), K+ (ink disc, white "+"), Cl- (green disc, white "-"), HCO3- (blue,
   small), drawn with vector glyphs (no text under 17 units).
4. `epithelialCell(path, {nucleus, granules, mucinCap, microvilli})`: rounded polygon with gradient, nucleus with
   chromatin speckle and nucleolus.
5. `parietalCell(...)`: broad pyramidal cell, central round nucleus, dense small mitochondria (ellipses with a cristae
   squiggle), an apical secretory canaliculus with microvilli, tubulovesicle pool.
6. `capillary(x1, x2, y, r, phase)`: endothelial wall (two strokes with flattened nuclei), lumen, drifting biconcave RBCs.
7. `nerveTerminal(x, y)`: axon with a varicosity holding synaptic vesicles (reuse in autonomic-synapse lesson).
8. `ECLcell(x, y)`: small basal endocrine cell with granules on its base (histamine source).
9. `mucusGel(x1, x2, y, h)`: translucent gel with wavy top, gradient, embedded HCO3- glyphs, strand texture.
10. `gastricGland(...)`: oxyntic gland column: pit with surface mucous cells, neck, parietal cells bulging outward, chief
    cells at the base.
11. `stomachOrgan()`: anterior-view stomach silhouette with oesophagus, cardia, fundus, body, antrum, pylorus,
    duodenal stub, rugae, muscular wall with layered tones.
12. `bacteriumRod(x, y, {lysed})`, `proteinChain(points, {folded})`, `enzyme(x, y, {pro})` (pepsinogen with a
    propeptide lid / pepsin with an open cleft).
13. `signalRibbon(path, w)`: glowing gold ribbon (core + soft halo) for the intracellular on signal;
    `inhibitBar(path)` purple T-bar.
14. `meterBar(...)` with a shaded "usual" band, a normal tick, a ghost tick kept inside the bar height.

## Per-step brief

### Step 1, `stomach` (still, h 330). Grade 4.
**Now:** a pink J/kidney silhouette with a stub tube at the top-left, a dotted inner edge for "lining", yellow circles for
food, and a magnifier circle with one pit-plus-gland tube flanked by eight identical tan boxes. No fundus above the
cardia, no pylorus or duodenum (the stomach dead-ends), no rugae. The "lining" leader ends in the wall, not on the dotted
line. The magnifier source ring is tiny and the dashed connector is faint.
**Redraw:** left two-thirds: an anterior-view stomach (`stomachOrgan`): oesophagus entering at the cardia right of a
fundus dome that rises above it; greater curvature sweeping down the left and along the bottom; lesser curvature short and
concave on the right; antrum narrowing to a pylorus and a short duodenal stub exiting right. Cutaway window over the body
showing the inner surface with rugae folds and a thin pink mucosa band (data-part `lining`) over a thicker muscular wall
(two tones, faint fibre direction). Food as irregular chyme lumps with a highlight, not circles. Right third: a magnified
circular inset joined by two tangent leader lines to a clearly marked spot on the body mucosa. Inside the inset, a
`gastricGland`: surface with a pit (`pit`) lined by tall surface mucous cells with pale mucin caps, opening into a long
gland (`gland`) whose walls hold large pink parietal cells bulging outward and, at the base, smaller purple chief cells.
Labels with 1.2 ink leaders: stomach, lining, pit, gland, food; "magnified" under the inset. Optionally a light
region label "body" on the stomach (step 2's caption says the glands of the domed top and main body hold parietal cells),
only if it fits without crowding at 375 px.

### Step 2, `cell` (loop 5 s, h 348). Grade 2.
**Now:** a beige rounded rectangle labelled parietal cell, two grey rectangles labelled lining, a pink band labelled
blood side with ellipses sliding along two thin lines. Blue and red arrows say "faces the stomach / faces the blood".
"blood side" label sits on a vessel line.
**Redraw:** a tissue slice. Top: lumen gradient (`inside the stomach`). Middle: an epithelial row: two surface mucous
cells on the left (`lining`, mucin caps, basal nuclei) joined by tight-junction dots to one large `parietalCell`
(`cell`): broad base, rounded apical face at `AP`, central round nucleus, dense mitochondria texture, faint apical
canaliculus with microvilli fringe. Apical membrane and basolateral membrane drawn as thin bilayers. Under `BAS`: a
basement-membrane line, then lamina propria with a `capillary` (`blood`) running across: walls, lumen, RBCs drifting
with `t` (keep the loop). Keep the two face arrows, but place their labels in clear space beside the arrows (not over the
nucleus). "blood side" label sits in the lamina propria above the capillary, not on its wall.

### Step 3, `acid` (4.6 s, h 420). Grade 3.
**Now:** the step-2 rectangle with red dots rising from nowhere along its top line, a single right-hand meter, the
left half of the meter row empty. "hydrogen ion" label overlaps two dots.
**Redraw:** same slice as step 2 (shared base). H+ `ion` glyphs (red, white "+") bud from the apical surface and drift
up, accumulating in the lumen (`hydrogen`). One H+ is called out with a leader to a label placed in an empty lane (top
left, under "inside the stomach"). The acidity meter (`acidity`) centred under the picture (x 132 to 348), with a
"less / more" scale, a shaded usual band and the fill in red. Optional micro-lift: tint the lumen gradient slightly
warmer as acidity rises, so the stomach itself looks more acidic.

### Step 4, `pump` (loop 2.8 s, h 330). Grade 3.
**Now:** two blue rounded squares with two white bars (reads as a "pause" icon) set in a tan band; H+ dots and black
squares scattered on both sides; a tiny amber spark scaled up near one pump; three labels collide with ions.
**Redraw:** a magnified membrane strip across the middle: a real `bilayer` (head beads, tails). Two
`transmembraneProtein('pump')` (`pump`): blue alpha subunit spanning the bilayer, small paler beta subunit with a glycan
sprig on the lumen side. Each cycle: an H+ ion enters a pocket on the cell side, the protein's two halves rock
(swing ~6 degrees), the H+ exits on the lumen side while a K+ (`potassium`, ink disc with white "+") takes the reverse
trip. Energy: on the cytoplasmic face an "ATP" disc becomes "ADP" + small "P" with a brief yellow flash each cycle
(ATP is the true energy source; the caption's "uses energy" stays the label, with "(ATP)" allowed). Lumen crowded with
H+, cytoplasm sparse (keep the gradient message). Labels in clear lanes: "proton pump" with a leader to one pump,
"hydrogen out" and "potassium in" beside their own lane arrows, "each swap uses energy" next to the ATP glyph. No
label over an ion: reserve ion-free lanes for text.

### Step 5, `chloride` (loop 3 s, h 420). Grade 3.
**Now:** a dashed green line runs straight from the blood band, through the nucleus, to a white box at the cell's top
right corner; green rings slide along it. H+ dots and green rings sit in touching pairs in the lumen labelled
"hydrochloric acid" from the top-right corner with no leader.
**Redraw:** in the shared slice, Cl- (`chloride`, green with white "-") enters through a carrier protein on the basolateral
bilayer (draw it as `exchanger`, unlabelled, so nothing new is claimed), wanders up through cytoplasm on a curved path
that avoids the nucleus, and leaves through an apical `channel` protein with a visible pore (`channel`). In the lumen,
H+ and Cl- mix as free ions (not glued pairs) inside a soft bracket or haze labelled "hydrochloric acid" (`hcl`) with a
leader. Pumps keep streaming H+. Both meters under the picture with usual bands.

### Step 6, `pepsin` (4.6 s, h 304). Grade 2.
**Now:** a pac-man (pepsin) eats a chain of beige beads; a green ellipse gets a red X ("germ killed"); a tan strip says
"parietal cells below". The caption's chief cells and pepsinogen are not drawn. "acid switches pepsin on" overlaps
pepsin at mid-time.
**Redraw:** bottom strip: gland epithelium with a purple chief cell (zymogen granules) next to a pink parietal cell.
Sequence on `t`: (1) the chief cell releases pepsinogen (`enzyme({pro:true})`: rounded globular protein with a small
coloured lid blocking its cleft); (2) in the acid (H+ around it) the lid clips off and drifts away; the enzyme becomes
pepsin (`pepsin`) with an open cleft, warmer colour; (3) a food protein shown first as a folded coil unravels in acid
(caption: "acid unravels the proteins") into a bead strand, and pepsin's cleft closes on it, cutting it into two
fragments; (4) right side: a rod bacterium (`bacteriumRod`, membrane + flagellum) surrounded by H+ swells and breaks into
fragments (no red X). Labels in lanes: "pepsinogen (idle)", "acid switches it on", "pepsin cuts protein",
"germ killed", each with its own leader, staged by time so they never stack.

### Step 7, `store` (loop 6 s, h 420). Grade 4.
**Now:** white circles holding mini pump icons slide from the right half of the rectangle to the top line, then vanish;
phase words at top-right change. The motion reads; the shapes do not. "vesicles" label floats with no leader.
**Redraw:** stored pumps live in tubulovesicles (`vesicle`): small bilayer-walled circles/ovals in the apical cytoplasm,
each with 1 to 2 pump proteins embedded in its wall (not an icon inside). Called: a vesicle moves to the apical membrane,
its wall merges into the membrane (omega-shaped fusion over ~0.1 of the cycle), the pump ends up in the surface and starts
streaming H+; the apical surface visibly gains microvilli as pumps arrive. Call stops: the reverse (membrane pinches back
in). Keep the three phase words; put a leader from "vesicles" to the nearest vesicle. Meters as now.

### Step 8, `histamine` (6 s, h 420, loopFrom .76). Grade 3.
**Now:** a beige rounded rectangle "neighbour cell" sits in the pink blood band; amber triangles slide from it into a black
cup hanging under the cell; a thick amber arrow rises; pumps pop up. Histamine travels through "blood". Labels
overlap (histamine on the cell border, neighbour-cell label at the band edge), and "H2 receptor" has no leader.
**Redraw:** below `BAS`, lamina propria (tissue fluid) with the capillary further down. The neighbouring histamine cell
(`ECLcell`, small, granules at its base) sits beside the parietal cell's base. Histamine (`histamine`, amber small
molecule glyph) diffuses through tissue fluid (not the vessel) to an H2 receptor (`receptor`) drawn as a 7-loop GPCR
embedded in the basolateral bilayer, its pocket facing out. On docking, the receptor's inner loops glow and a gold
`signalRibbon` (`signal`) grows from its cytoplasmic face up to the apical region; vesicles then fuse (reuse step 7's
motion). Labels: "histamine" by the molecules, "H2 receptor" with a leader to the GPCR, "neighbouring cell" beside the
ECL cell, "on signal" beside the ribbon, all in clear space.

### Step 9, `messengers` (loop 6 s, h 420). Grade 3.
**Now:** three black cups under the cell with clusters of triangles, diamonds and dots beneath; lines from the outer two
receptors meet the signal arrow, but the middle (gastrin) receptor has no connector; at t 0.35 and t 1 the pump count is
the same (3), so "more pumps up" is not visible at either captured point. Gastrin's push on histamine release (caption)
is not drawn.
**Redraw:** three basolateral receptors in the bilayer at `RECEPTOR` x: H2 (histamine, amber), gastrin receptor (blue),
acetylcholine receptor (green). Sources drawn as anatomy: gastrin (`gastrin`, blue) leaves the capillary lumen through
its wall (a hormone carried in blood); acetylcholine (`ach`, green) is released from a `nerveTerminal` varicosity that
reaches in from the side; histamine from the ECL cell. All three receptors feed the gold signal ribbon (three tributaries
merging), ribbon width = `signalWidth(v.drive)`. A thin blue arrow from the gastrin stream to the ECL cell, which then
releases a burst of extra histamine (caption). Restage timing so the gastrin and ACh join completes after t 0.5 and at
least one more pump rises between t 0.35 and t 1. Labels: each messenger under its source, short, no overlaps.

### Step 10, `shield` (loop 4.2 s, h 360). Grade 2.
**Now:** grey square "lining cells", a mucus outline with **no fill** (bug), blue dots, a red outline half-bowl inside one
cell called an ulcer. H+ dots fall and simply vanish. A defect inside the epithelium is an erosion, not an ulcer: an ulcer
breaches the muscularis mucosae.
**Redraw:** a mucosa cross-section: lumen above; a translucent `mucusGel` (`mucus`) with a wavy surface, strand texture
and HCO3- glyphs (`bicarbonate`) more concentrated near the cells; a row of tall surface mucous cells (mucin caps, basal
nuclei); lamina propria; a thin muscularis mucosae band; submucosa with a small vessel. On the right, an ulcer
(`ulcer`) as a crater that cuts through epithelium, lamina propria and muscularis mucosae into submucosa, base tinted
inflamed red, gel absent above it. Motion: H+ that fall into the gel meet an HCO3-, both fade into a tiny neutral puff
(caught and cancelled); H+ over the crater fall into it and the base pulses darker. Labels: "mucus with bicarbonate",
"soaks up the acid" (by the gel), "lining cells", "ulcer: where the shield fails" with a leader into the crater.

### Step 11, `prostaglandin` (5.6 s, h 420). Grade 3.
**Now:** amber rings appear in the grey lining boxes; an amber dashed line crosses from them through the cell wall to a
T-bar beside the signal arrow; mucus (no fill) is a 98-unit box on the far left. "from prostaglandins" runs into the
arrow; "mucus thickens" shows from t 0.35 on.
**Redraw:** prostaglandins (`pg`) drawn in purple as a small hairpin lipid glyph (two chains joined by a ring) made by
the surface cells; some diffuse to a purple receptor on the parietal cell's basolateral face, from which a purple
`inhibitBar` (`brake`, width = `brakeWidth`) presses on the base of the gold signal ribbon (the drug and the body act
where histamine's signal starts). Others act on the surface cells: the gel over them thickens (`mucusH`). Labels:
"prostaglandins" by the glyphs, "brake" beside the T-bar, "mucus thickens" only once the gel has grown (gate on k > .6),
all clear of the ribbon.

### Step 12, `whole` (loop 3 s, h 420). Grade 4.
**Now:** the step-11 composite plus a blue box round the meters. It works as a summary but inherits every weakness.
**Redraw:** the full composite at rest with the new primitives: surface cells with gel on the left, parietal cell with
pumps streaming, three receptors and sources, signal ribbon, purple brake. Keep the blue key-measures box
(`data-key-measures`) and the top-right pointer. Make the context (surface cells, lamina propria, capillary) lower contrast
than the parietal cell so the eye lands on the cell and the meters.

### Step 13, `ppi` (change, loop from .5, h 420). Grade 4.
**Now:** red X crosses over blue pump circles (reads "deleted"); dashed rings round every pump; dashed outline doubling
the unchanged signal and brake; ghost meter dashes slice through "makes" and "acidity". The meter deltas and arrows are
clear.
**Redraw:** PPI molecules (small red-orange drug glyph) arrive from the lumen side, bind into each pump's lumen-facing
face and a red clamp/latch closes over the pore; the pump protein desaturates to grey-blue and its H+ stream stops. The
signal ribbon is unchanged (no ghost drawn where nothing changed; say "messengers still call" by it). Ghost: only the H+
pool count and the meters. Words on the picture: "pumps locked shut" (top) and a short blue arrow + "acid stream stops"
by a pump. Ghost meter marks drawn within the bar height only.

### Step 14, `h2` (change). Grade 4.
**Now:** a black square fills the cup; the signal shrinks inside its dashed outline; two pump slots become dashed rings;
same ghost noise and meter-label collisions as step 13.
**Redraw:** an H2 blocker molecule (dark slate glyph, shaped to fit the GPCR pocket) occupies the H2 receptor; histamine
glyphs approach and bounce off. The histamine tributary of the signal ribbon fades to a thin grey line and the merged
ribbon narrows inside a grey ghost of its normal width; gastrin and ACh tributaries also thin (histamine's boost is lost,
per the model). Pumps return to vesicles (reverse fusion), with grey dashed ghosts only at the vacated pump slots.
Words: "H2 blocked: fewer pumps up" plus a blue arrow + "signal thinner" by the ribbon.

### Step 15, `antacid` (change). Grade 4.
**Now:** blue hexagons with faded red centres scatter over the lumen, overlapping live H+ dots; the made meter shows
"same" and the acidity meter falls. Concept reads; clutter does not.
**Redraw:** antacid particles (`antacid`, blue hexagon kept, with a subtle chalky gradient) drift down into the lumen; each
H+ it meets merges into it and a couple of small CO2 bubbles rise (true of calcium carbonate). Neutralised H+ fade out
rather than sit inside hexagons. Cell, ribbon, pumps draw solid with no ghost (unchanged), and a small ink note by the
pumps "pumps carry on". Ghost only on the lumen H+ count and the acidity meter.

### Step 16, `pga` (change). Grade 3.
**Now:** amber rings multiply in the grey boxes, the dashed brake line thickens, labels "brake harder" and
"from prostaglandins" collide with the signal arrow; the mucus (no fill) grows a few units.
**Redraw:** the same purple prostaglandin glyphs, now joined by the drug's glyphs (same shape, outlined "analogue" style),
more of them; the purple brake bar thickens (`brakeWidth`); the gold ribbon narrows inside a ghost of normal width; one
pump returns to its vesicle (ghost ring at the vacated slot); the gel thickens over a dashed grey ghost of its normal top
edge, with a blue arrow + "thicker mucus". Words: "brake harder: fewer pumps up". Keep all labels off the ribbon (put
"brake harder" left of the bar, below the brake line).

## Meters (all steps that use them)

The two meter bars are already clean and readable; they are the best part of these pictures. To lift them: draw the
usual band already defined in code (`MADE_USUAL`, `ACID_BAND`) as a light shaded zone inside each bar; keep the normal
ghost tick inside the bar height (y 374 to 402) so it never crosses the title; add a fine normal tick on steps 5 to 12
too; round the bar ends; use amber-free colours if amber is freed for the signal (e.g. made = deep gold, acidity = red).

## Risks

- Model-driven counts and widths (pumps, locked pumps, vesicles, pool ions, signal and brake widths, mucus height) must
  keep reading from `GM.settle`; do not hard-code a picture per step for steps 9, 11 to 16 or the Explore/Clinical tabs
  break.
- `scene()` is shared by Explore freely and Clinical values (`tabPicture`); test those with all four drugs on, all
  messengers at 0 and at 2.5, and the vomiting state.
- `data-part` names listed above are wired to captions; renaming any breaks the hover links (lab-check needs at least 3).
- aria-labels in `scenes` and `CHANGE_WHERE` describe today's colours and shapes; they must be rewritten.
- Detail density: a parietal cell with mitochondria, canaliculus, vesicles, receptors, ribbon and pumps can turn to mush
  at 375 px. Keep organelle texture low-contrast and small; reserve saturated colour for the parts being taught.
- Text floor 17 units; ion glyphs carry "+"/"-" as vector strokes, never text.
- Accuracy traps: ulcer must breach the muscularis mucosae (else it is an erosion); histamine is paracrine (tissue fluid,
  not blood); gastrin arrives in blood; acetylcholine from nerve endings; pepsinogen comes from chief cells, not parietal
  cells; H+/K+-ATPase is ATP-driven and electroneutral 1:1; Cl- leaves through an apical channel; do not glue H+ and Cl-
  into molecules; PPIs bind active (surface) pumps covalently; misoprostol's pregnancy warning is caption-only.
- Fix the `path(..., 'fill=...')` duplicate-attribute bug by using `shape()`; grep the file for any other `path(` with a
  `fill=` extra (lines 105, 402, 404).
