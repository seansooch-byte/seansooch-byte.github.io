# Redraw brief: thyroid-axis (Lesson 14, "The thyroid axis")

Audited 2026-11-12 from captures at t=0.35 and t=1 for all 16 steps
(`scratchpad/audit/shots/thyroid-axis/s01..s16`). Source: `lab/thyroid-axis/app.js` (drawing),
`model.js` (window.ThyroidModel, steady-state loop), `index.html` (captions and dfn parts).

**Overall grade: 3 / 10.** The *logic* of the pictures is strong (model-driven arrow widths, level bars
with healthy bands, dashed normal ghosts, numbered feedback steps). The *drawing* is clip art: the brain is
two lilac pills with words in them, the heart is a Valentine, the follicle is a ring of beads, cells are
rounded boxes, blood is a pink capsule. Twelve of sixteen steps reuse one flowchart (`axis()`), so lifting
that one function lifts 75 % of the lesson.

## What must survive any redraw

- **Model-driven geometry.** Arrow widths come from `widthOf(v.trh|v.tsh|v.out)`; brake width from
  `2 + 3*v.t4`; blood dot count from `9*v.t4`; gland scale from `v.gland` (goitre in Graves, shrink in RAI);
  heartbeat spacing from `v.hr`; meter marker positions from `log(rel)/SPAN[k]`. Keep every one of these
  bindings; only the shapes they drive change.
- **Hooks used by the page:** `data-part` names `thyroid windpipe hormone pace follicle store iodine t4 t3
  cell pituitary tsh hypothalamus trh brake out blood receptor heart tests attack antibody block rai tablet`
  (dfn terms in index.html target `thyroid windpipe hormone pace iodine follicle store t4 t3 pituitary tsh
  hypothalamus trh brake receptor tests attack antibody tablet block ptu rai heart`). Note `ptu` is a dfn
  with **no matching data-part** in the picture today (bug: add `data-part="ptu"` to the thionamide note or
  a conversion mark in the body row). Also keep `data-flow`, `data-w`, `data-level`, `data-rel`,
  `data-trace`, `data-ghost="normal"`, `class="ghost"`; and in the Explore chart `data-ref-box`,
  `data-brake-curve`, `data-gland-curve`, `data-explore-point`.
- **Shared layout with Lesson 15** (`lab/hpa-axis-steroids/app.js` line 69 copies `HYP`, `PIT` and the
  column layout "so the two loops read as one pattern"). Redraw the axis as a shared kit primitive
  (`kit/draw.js` or a new `kit/anatomy.js`) and port both lessons together, or the two lessons diverge.
- `axis()` is also drawn in the Clinical values and Explore freely tabs: one redraw covers all three.
- Frame: 480 wide, AXIS_H 416, steps 7/8 at 420. Text classes only (xs 17 minimum).

## Palette (adopt for the whole lesson)

- Gland tissue: base `#d98b7e`, shade `#b9665a`, highlight `#f0b8ab` (radial gradient, light from upper left).
- Colloid: `#f3d79b` to `#e8bf6e`; thyroglobulin strands `#c48a3a`.
- Brain tissue: `#efd3cf` base, `#d9aea8` sulci; hypothalamus highlight in the lesson's brain lilac `#c9a3d6`.
- Pituitary: anterior lobe `#e7a6a0`, posterior lobe `#d8c2b5` (paler, neural).
- Vessel: wall `#b3261e` (C.red) 2.5 stroke, lumen gradient `#f7d9d3`→`#f1c1b8`, RBC discs `#c8443a`
  with paler centre.
- Hormones stay as now: TSH blue `C.blue`, T4/T3 amber `C.amber` fill `#f2a93b`, TRH ink. Iodine atoms:
  purple `C.purple` (#6b3fa0) small balls (purple is the conventional CPK colour for iodine) instead of
  white rings.
- Line weights: organ outlines 2, internal detail 1.2, leader lines 1.2 muted, change arrows `arrowFixed`.

## Per step

### Step 1, "A small gland in the neck" (still, h 340), grade 3
**Now.** A mushroom-shaped ellipse "head" on a straight rectangular "neck"; the voice box is a rounded
box; the windpipe is a ladder; the thyroid lobes are two plain pink ovals with six large yellow dots on
them and a black-outlined square for the isthmus. Labels "head" and "neck" are filler.
**Problems.** No recognisable anatomy: no thyroid cartilage (Adam's apple), no cricoid ring, no
sternocleidomastoids, no clavicles or sternal notch, so nothing places the gland. The surface dots imply
follicles visible to the eye (they are microscopic). The isthmus square looks like a hinge.
**Redraw.** Anterior view of the neck, chin to clavicles, no head (crop at the jaw line, which reads as a
neck instantly). From top: mandible edge as a soft skin-tone curve; hyoid as a thin U; **thyroid cartilage**
as a shield with the V-notch at top (laryngeal prominence), shaded `#f4ece2` with a darker edge; **cricoid**
as a narrow ring below it; **trachea** as a tube of C-shaped cartilage rings (each ring a slightly curved
band with a shaded underside, not ladder lines) running down behind the clavicles. **Thyroid**: two
pear-shaped lobes with pointed upper poles reaching the sides of the thyroid cartilage and rounded lower
poles at about the 5th-6th tracheal ring; isthmus a soft band crossing tracheal rings 2-4 (not a box).
Radial-gradient tissue, faint lobular texture (fine cross-hatched stipple, not circles). Optional pyramidal
lobe: omit (variant, would invite questions). Sternocleidomastoid muscles as two faint diagonal bands from
behind the ears to the sternum and clavicles; clavicles as two shallow S-curves; suprasternal notch.
Labels right side with leader lines: "voice box" (to thyroid cartilage), "thyroid" lg b with sub-lines
"two lobes and / a bridge" (leader to the right lobe), "windpipe" left (leader to rings below the isthmus).
Keep `data-part="thyroid"` on the lobes+isthmus group and `data-part="windpipe"` on the trachea.
Drop the "head"/"neck" labels.

### Step 2, "Its hormone sets the body's pace" (7 s, plays once), grade 3
**Now.** Small thyroid, a thick amber arrow into a pink capsule labelled blood, three down-arrows into three
beige circles each holding a flame, a pace slider. Flames grow and shrink with H.
**Problems.** Blood is a capsule, not a vessel. "Cells" are circles with no membrane, nucleus or
mitochondria. The flame is a cartoon icon.
**Redraw.** Keep the layout (gland top-left, vessel across, three cells below, pace bar, blue status
line). Vessel = shared vessel primitive (wall, lumen, a few RBC discs drifting, hormone dots in amber).
Cells = shared "body cell" primitive: soft rounded irregular outline with a thin double line membrane,
cytoplasm gradient, a nucleus with nucleolus, and 3-4 bean-shaped **mitochondria** with cristae. The
pace is shown by mitochondria glowing (amber inner glow, opacity tied to `pace`) and by 2-3 wavy heat lines
rising off each cell whose amplitude and count follow `pace`. A tiny fuel dot (glucose) entering each cell
optional. Keep the arrow width from `widthOf(H)` and the dot count `10*H`. Keep `data-part="hormone"` and
`data-part="pace"`.

### Step 3, "Built from iodine" (4.5 s loop), grade 4
**Now.** Fourteen overlapping pink balls around a peach disc with three wavy lines; white rings travel from
a pink capsule up through the beads onto the lines.
**Problems.** Label "stored protein / with iodine fixed / onto it" is **clipped at the right edge** (starts
at x=344, line 2 runs past 480; visible in both captures). The wall reads as beads, not a cuboidal
epithelium; no nuclei; no capillary against the follicle; iodine dots ride from a flat bar at the bottom.
Floating legend "iodine o".
**Redraw.** Histology cross-section of one follicle (centre ~(200,175), R ~110). Wall = ring of 14
**cuboidal thyrocytes** drawn as wedge/trapezoid cells sharing walls, each with a round dark-violet
nucleus near the basal side, cytoplasm `#e9a79a`, apical edge slightly scalloped (microvilli tick marks).
Lumen = **colloid** with gradient and 3 loosely coiled thyroglobulin strands; a few pale resorption
vacuoles at the colloid edge. A **capillary** arcs against the lower-left basal side (vessel primitive,
curved, with two RBCs). Iodine = purple balls: leave the capillary, enter the basal side of one cell
through a small channel protein (two-lobed transmembrane blob, unlabelled or labelled "iodine pump"
only if the caption is extended; the caption does not name it, so leave unlabelled), cross the cell, and
**latch onto a thyroglobulin strand at the colloid edge** (iodination happens at the apical surface), then
the strands accumulate seated iodines. Labels on the right with leaders, wrapped to fit inside x<=470:
"wall of cells", "stored protein" (b) + "with iodine" + "fixed onto it", left-bottom "iodine" next to a
purple ball, "blood" on the capillary. Keep `data-part` follicle (wall), store (colloid+strands), iodine
(moving balls).

### Step 4, "Two forms: T4 and T3" (5.2 s once), grade 3
**Now.** Thyroid top-left, blood capsule, a big rounded box "a body cell" with an ellipse "its centre"; an
amber lozenge with four white rings travels in, loses one ring and becomes a white lozenge with three.
Key on the left: "T4: four iodines", "T3: three, stronger".
**Problems.** "T3: three," **touches the left frame edge** (centred at x=40). Cell is a box, nucleus is an
ellipse labelled "its centre". Hormones are pills, not molecules. No enzyme does the snipping; T3 lands
on the nucleus surface with no receptor.
**Redraw.** Molecule primitive for thyronine: two hexagon rings joined by an ether O bridge, iodines as
purple balls at 3,5 (inner ring) and 3',5' (outer ring); T3 = same minus the 5' iodine (outer ring keeps
one). Draw at ~56 units long so it reads at 375 px. Key on the left, left-aligned at x=14: T4 molecule +
"T4: four iodines"; T3 molecule + "T3: three," "the stronger form". Cell = body-cell primitive (membrane,
cytoplasm, nucleus with double membrane, nuclear pores, chromatin texture). Inside the cytoplasm a
**deiodinase** enzyme as a rounded protein blob with a cleft; T4 docks in the cleft, one purple iodine pops
off (fades away), T3 leaves and travels into the nucleus to sit on a **receptor on DNA** (a small double
helix segment with a receptor blob). Labels: "an enzyme snips one iodine off" (fade in at snip),
"T3 does the work" blue near the nucleus, "a body cell", "its centre" (keep the caption's word) on the
nucleus. Keep data-part t4, t3 (and t4-key/t3-key nested), cell.

### Steps 5 and 6, "The pituitary gives the order" / "The hypothalamus starts the chain" (3 s loops), grade 3
**Now.** Two lilac rounded pills with the word inside, a vertical flowchart (TRH ink arrow, TSH blue arrow,
T4/T3 amber arrow) through a small butterfly to a pink capsule; right column of three level bars.
Step 5 has 130 units of empty space above the pituitary.
**Problems.** Brain structures are text boxes. The pituitary is "pea-sized at the base of the brain" in the
caption but a pill in the picture. Step 5 wastes the top third.
**Redraw (the shared AXIS primitive, used by steps 5-8 and 10-16).** Keep the left column x 30-300 and
the right meters column x 320-470 exactly. Replace the top nodes with a **midsagittal brain-base inset**
occupying x 50-260, y 4-150: a soft outline of the inferior brain (curve of the diencephalon floor and the
optic chiasm as a small knob in front), the **hypothalamus** as a shaded lilac region on the floor of the
third ventricle (label "hypothalamus" to the right of the inset with a leader), the **pituitary stalk**
(infundibulum) descending with a fine portal capillary drawn on it, and the **pituitary** as a bean in a
cup of bone (sella turcica, a grey U) with a larger pinker anterior lobe and paler posterior lobe (label
"pituitary"). The TRH arrow runs down along the stalk (model width still from `widthOf(v.trh)`, dots
flow on it); the TSH arrow leaves the anterior lobe and runs down to the gland. Thyroid in the middle is
the step-1 gland at small scale (lobes + isthmus over a short segment of trachea with 3 rings) so it
reads as the same organ. Blood = vessel primitive across the full width at y 300-326, hormone dots
inside. In step 5 the hypothalamus inset is present but greyed (opacity .25, no label), so the frame is
not empty and step 6 reads as "lighting up" the part above. Meter rows unchanged.

### Step 7, "Enough hormone puts on the brake" (7.5 s once), grade 4
**Now.** Same flowchart with the amber brake bar up the left edge ending in T-bars at both pills; numbered
lines 1-4 fade in under the blood; dashed ghosts on arrows and markers.
**Problems.** Diagram logic is good; drawing inherits the pill problem. Brake is a thick plumbing pipe;
ghost brake is two dashed rails hugging it and is hard to read. "↓ usual" on TSH at t=.35 is confusing
(TSH heading down while still inside its band) but is correct per `moved()`.
**Redraw.** On the AXIS primitive. Brake = a smooth curved amber path (not orthogonal pipe) from the
vessel up the left margin, branching to the hypothalamus and pituitary, ending in proper flat inhibition
bars (the standard ⊣ glyph) drawn with `arrowFixed`-style fixed heads. Width still `2 + 3*v.t4`. Ghost as a
single dashed centre-line stroke at normal width rather than two rails. Keep the four numbered lines but set
them in a left-aligned list with circular step badges (blue filled circle with white numeral) for
hierarchy.

### Step 8, "Too little hormone turns the order up", grade 4
Same as step 7 with dir=-1. Same redraw. Check that the swollen TSH arrow (width up to 16) clears the
"TSH" label (currently it nearly touches at max).

### Step 9, "It also speeds the heart" (6.5 s once), grade 2
**Now.** A large Valentine heart with blue "T"-shaped blocks on its edge, an amber level bar, and an ECG
strip of identical spikes.
**Problems.** A Valentine heart in a medical course (the owner's exact complaint about lesson 1). The
docking sites are on the outside of a cartoon. "Harder" in the caption and the label is not drawn
(amplitude constant). The ECG has no P or T waves. Large dead space on the right. "high: more docking
sites" runs to the frame edge.
**Redraw.** Left: the **shared anatomical heart** primitive (anterior view, apex down-left, ventricles,
atria, aorta arch, pulmonary trunk, coronary vessels, gradient shading) at ~170 units tall. A magnifier
circle callout from the left-ventricle wall to a right-side inset: a strip of **cardiomyocyte membrane**
(lipid bilayer strip primitive) with **beta-1 receptors** drawn as 7-helix GPCR barrels; the number of
receptors on the strip follows H (2 low, 4 usual, 7 high), new ones fade in. Small adrenaline (catechol)
ligand dots docking on them; label "docking sites for alarm signals" blue. Thyroid-hormone level bar
across the top with a healthy band (same meter style as the axis). Bottom: ECG trace with real P-QRS-T
morphology; rate from `sqrt(H)` and R-wave height scaled 0.85-1.2 with H so "harder" is visible; the heart
itself pulses (scale 1 ± .03*H) on each R wave. Keep data-part heart and receptor.

### Step 10, "The whole loop: the key measures" (3 s loop), grade 4
**Now.** Full flowchart, blue box around TSH and T4 bars, Valentine heart icon and spike trace bottom-left.
**Problems.** Same pill nodes, capsule blood, Valentine icon. The blue box runs past x=470 to the edge.
**Redraw.** AXIS primitive. Body row: small anatomical heart icon (from the heart primitive at 44 units)
in place of the Valentine; ECG with P-QRS-T. Tests box as a rounded rect with a tab label "key tests"
inside x 312-472.

### Step 11, "Hypothyroidism" (What changes it, 2.8 s), grade 4
**Now.** Bullseye "target" markers on the lobes for immune attack; arrows morph; notes in blue; readout.
**Problems.** Bullseyes read as targets, not immune cells. "immune attack" fades in pale pink at mid-morph
(low contrast). Everything else (ghosts, words, readout agreement) works.
**Redraw.** Attack = 6-8 **lymphocytes** (round cells, large dark-violet nucleus filling most of the cell,
thin pale rim) clustering over the lobes, a few tissue areas desaturating to a pale scarred tone as k
rises (Hashimoto: lymphocytic infiltration and fibrosis). Gland stays normal size (c.gland=1, keep). Label
"immune attack" in C.red, full opacity once shown (fade only from 0 to 1 over the first 30 % of its
window).

### Step 12, "Hyperthyroidism" (Graves'), grade 3
**Now.** Red stick Y antibodies, gland swells to ~1.4x over a dashed outline, thick amber arrow, crowded
dots and trace.
**Problems.** **Label collisions:** the right-side antibody touches the "antibody" label (reads
"Yantibody"); the swollen left lobe touches "T4, T3"; the swollen top of the gland meets the ghost TSH
arrowhead. Antibodies float beside the gland instead of binding it.
**Redraw.** Antibodies as proper IgG Y glyphs (two-tone: heavy chains darker red, light chains lighter
outer segments, rounded tips), 4 of them **bound to small TSH-receptor stubs** on the lobe surface
(receptor = small blue 7TM stub to echo TSH colour). Move the cause label to x >= lx + 18 and
compute `lx` from the actual goitre width plus the antibody reach; move "T4, T3" to the right of the out
arrow (x = CX + 14) or below the lobes; end the TSH arrow at the *current* top of the gland
(GC[1] - 46*gs) so ghost and real heads do not stack on the gland.

### Step 13, "Levothyroxine", grade 4
**Now.** A pill-shaped capsule appears inside the blood bar; "T4 tablet" label above it.
**Problems.** A tablet floating in the bloodstream is a category error; works as a symbol but looks odd.
Two `data-part="tablet"` groups.
**Redraw.** Draw the tablet outside the vessel (above it, right of the out arrow), a round white scored
tablet with a short amber arrow into the vessel releasing T4 molecules (the step-4 molecule glyph at
small scale) into the lumen. Keep `data-part="tablet"` on one group containing both tablet and label.

### Step 14, "Thionamides" (4.2 s, two moves), grade 3
**Now.** Red no-entry signs over both enlarged lobes, sitting on the yellow dots; "building blocked".
**Problems.** Same collisions as step 12 ("Ybuilding"). No-entry signs cover the tissue. The PTU second
move (T3 falls further because conversion in body cells is slowed) is said only in the bottom note;
`dfn data-part="ptu"` lights nothing.
**Redraw.** Block = a small inset glyph on each lobe: a thyroglobulin strand with a purple iodine held off
by a red bar (or a crossed-out enzyme blob), smaller than now and placed off the tissue centre. In the
second move, add a small "body cell" chip in the body row near the T3 bar showing the step-4 enzyme with a
red block mark, `data-part="ptu"`, fading in with k2.

### Step 15, "Radioactive iodine", grade 3
**Now.** A trefoil radiation symbol sits on the isthmus and grows; gland shrinks below a dashed goitre
outline.
**Problems.** At t=1 the antibodies overlap the shrunken lobes and the right antibody touches "thyroid";
the trefoil hides the isthmus. The symbol says "radiation" but not "iodine collects in the gland".
**Redraw.** Purple iodine balls with a yellow glow ring drift from the vessel into the gland and stay
(that is the mechanism in the caption), small trefoil badge beside the gland (not on it) labelled with the
cause label. Tissue darkens slightly and shrinks with `v.gland`; antibody positions computed from the
current lobe outline so they stay attached.

### Step 16, "Beta-blockers", grade 2
**Now.** Two small blue rectangles appear on the Valentine heart icon.
**Problems.** **The two blue rectangles read as sunglasses on a cartoon face.** Nothing shows a receptor
being blocked. "the symptoms ease" note good; model readout agrees.
**Redraw.** Body-row heart = anatomical heart icon; next to it a tiny receptor chip (two GPCR barrels
from the step-9 inset) with blue blocker caps fitted onto them (a wedge sitting in the binding pocket),
`data-part="heart"` covering heart + chip. A small tremor glyph (shaky hand) is optional; do not add
unless the caption mentions it (it does: "shaky hands settle") so a hand outline with tremor lines that
calm with k is allowed, sized <= 40 units.

## Graphs and charts

- **Level bars (meters):** clear and honest (band from clinical-values.json, ratio scale, ghost). Lift:
  give the band a subtle inner label tick at normal, round the marker into a lozenge with a drop shadow,
  and right-align the status words in a fixed column so "↓ still high" never touches the bar end.
- **ECG trace:** spike-only zigzag. Lift: P-QRS-T morphology with amplitude, a faint grid-free baseline,
  and a fading sweep head so motion reads as a monitor.
- **Explore "brake curve" chart (tab, not a step):** already good (shaded band box, two curves, dashed
  normal, settle point). Lift: drop the white plot rectangle frame in favour of two axis lines, label the
  curves at their ends instead of a key row, shade the region between the curves faintly.

## Reusable primitives this lesson needs

1. Neck, anterior view: thyroid cartilage, cricoid, trachea with C-rings, thyroid lobes + isthmus
   (scalable, goitre/shrink by one scale param), SCMs, clavicles.
2. Thyroid gland icon (same drawing at small scale) with anchor points for marks (lymphocytes,
   antibodies, block, iodine uptake).
3. Brain-base midsagittal inset: hypothalamus region, infundibulum with portal capillary, anterior and
   posterior pituitary in sella turcica (shared with hpa-axis-steroids).
4. Blood vessel strip (straight and arc): wall, lumen gradient, RBC discs, hormone particles.
5. Body cell: membrane, cytoplasm, nucleus with nucleolus, mitochondria (glow param).
6. Thyroid follicle cross-section: cuboidal thyrocytes with nuclei, colloid, thyroglobulin strands,
   adjacent capillary.
7. Thyronine molecule glyph (T4 / T3 / reverse T3 by iodine mask), iodine atom ball.
8. Enzyme blob with cleft (deiodinase), DNA segment with nuclear receptor.
9. Anatomical heart (frontal, four chambers implied, apex down-left, great vessels), with icon size.
10. Lipid bilayer strip with 7-transmembrane GPCR (beta-1 receptor), ligand dot, blocker cap.
11. IgG antibody Y glyph; lymphocyte; TSH-receptor stub.
12. Inhibition (⊣) connector with fixed head; flow arrow with model width (existing `flow`) and its ghost.
13. ECG trace with P-QRS-T, rate and amplitude params.
14. Round scored tablet.

## Risks

- **Model bindings:** arrow widths, brake width, blood dot count, gland scale, heartbeat spacing, meter
  positions all read model values; a redraw that hard-codes shapes breaks the What-changes-it morphs and
  the Clinical values / Explore tabs that call `axis()`.
- **Lesson 15 coupling:** hpa-axis-steroids copies HYP/PIT/layout; changing only this lesson splits the
  pattern the lessons claim to share.
- **Hooks:** keep `data-part` names (and add the missing `ptu`), `data-flow`, `data-w`, `data-level`,
  `data-rel`, `data-trace`, `data-ghost`, `.ghost`, and the chart's `data-ref-box`, `data-brake-curve`,
  `data-gland-curve`, `data-explore-point`.
- **Label overlap:** goitre growth (gland up to 1.6x) collides with "T4, T3", the cause label and the TSH
  arrowhead; any new anatomy must place labels from the *current* geometry, not fixed x.
- **Frame:** the brain-base inset must fit inside y 4-150 with TRH arrow length >= 36 units so width
  differences still read; steps 7/8 need 4 numbered lines under the vessel within 420.
- **Accuracy traps:** iodination happens at the apical (colloid) surface, not mid-colloid; isthmus over
  tracheal rings 2-4; T3 lacks the 5' (outer ring) iodine; Hashimoto = lymphocytic infiltration (not
  "targets"); Graves antibodies bind the TSH receptor; beta-blockers block beta-adrenergic receptors on the
  heart, not the thyroid; TSH from the anterior lobe, not posterior; do not draw the posterior lobe as the
  TSH source; RAI collects because the gland takes up iodine (draw uptake, not just a symbol).
- **Phone legibility:** molecule glyphs and receptor barrels must stay >= ~40 units or they become mush at
  375 px; avoid fine stipple below 1 unit stroke.
