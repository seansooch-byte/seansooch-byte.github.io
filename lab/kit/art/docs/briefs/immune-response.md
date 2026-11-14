# Redraw brief: immune-response (Lesson 20, "The immune response")

Files: `lab/immune-response/app.js` (all pictures, lines ~20-480), `model.js` (window.IRModel, drives steps 9, 10, 12 and every readout), `index.html` (captions, dfn data-part), `style.css` (only `.in-cell`).
Shots audited: `.../scratchpad/audit/shots/immune-response/s01..s15-*-t0.35.png / -t1.png`.

**Overall grade: 3/10.** Every cell in the lesson is a flat circle or a clip-art shape: a white circle with three loose purple dots for a neutrophil, a five-point star for a dendritic cell, a blue disc with a "T" for every T cell (helper and killer look identical), a bare stick-Y for antibodies, a tan bar for skin and a pink rectangle for a blood vessel. Nothing has a membrane, cytoplasm, nucleus shape, organelles, shading or depth. The two timeline graphs (steps 9, 10, 12) are the strongest pictures but have label/curve collisions. Biggest gap: the cells are not recognisable as the cell types the captions name, and the tissue/vessel/lymph-node settings are boxes, not anatomy.

---

## House style for this lesson (apply to every step)

- **Cells** get: a soft radial gradient body (light centre, slightly darker rim), a 1.6-2 unit membrane outline in a darker shade of the fill (not pure ink), a nucleus drawn to the cell type with its own gradient, and a small specular highlight (white, 30-40% opacity, upper-left). One shared `<defs>` block per svg: `radialGradient` ids prefixed `ir-` so they do not clash.
- **Cell-type identity is carried by morphology, not letters.** Drop the "T"/"B"/"M" letters inside cells except in the summary ladder (step 11) where icons are tiny. Identify by shape + label + leader line.
  - Neutrophil: round, ~12-14 r, pale lilac-pink cytoplasm with fine granule stipple (6-10 dots, 1 unit, 40% opacity), **one multilobed nucleus: 3-4 lobes joined by thin chromatin strands** (deep purple `#6b3fa0`-ish, darker than now).
  - Macrophage: large irregular cell (2-3x neutrophil), 2-3 blunt pseudopods, oval/kidney nucleus off-centre, 2-4 pale vacuoles (phagosomes); one phagosome may hold a germ.
  - Dendritic cell: small body with **5-7 long, thin, branching, wavy dendrites of unequal length** (veil-like), not a symmetric star. Oval/irregular nucleus. Antigen shown on its surface on small MHC "cup" stalks (see step 5).
  - Lymphocyte (T, B, memory): small round cell with **a large round dark nucleus filling ~80% and a thin rim of cytoplasm**. Helper T: blue rim + TCR glyph; killer T: same lymphocyte body but teal/darker-blue rim and 3-4 dark cytotoxic granules (and text label "killer T cell"); B: lymphocyte body with membrane Y receptors (BCR); memory: lymphocyte with ink/charcoal rim (keep "memory" by label).
  - Plasma cell: oval, **eccentric round nucleus with clock-face chromatin** (5-6 dark clumps round the edge), abundant cytoplasm filled with stacked rough-ER lamellae (curved parallel lines, current idea is right) and a pale perinuclear Golgi patch.
- **Antibody (IgG)**: a real Y: two heavy chains (darker blue) forming the stem (Fc) and inner arms, two light chains (lighter blue) alongside the outer arms (Fab), rounded capsule ends, hinge at the fork. Build at scale 1 ≈ 22 units tall. Drug antibodies use the same glyph in red.
- **Germ (bacterium, the lesson's generic invader)**: keep it amber (palette rule), but make it a **coccus/short rod with a capsule halo** (a lighter amber 2-unit outer ring, darker body, a highlight) and its **name tags (antigens) as small black triangles on short stalks** on the surface (keep triangles: they are the lesson's antigen identity used from step 4 to step 12). Drop the 8 radiating spikes (they read as a virus/sun). The virus in step 8 (inside the infected cell) is a different glyph: small hexagonal capsids.
- **Alarm signals (cytokines/TNF)**: keep purple diamonds but small (s≈5) and give TNF a trimer look (three overlapping tiny diamonds/lobes) where TNF is named; other cytokines in step 15 keep circle/triangle variety.
- **Tissue**: warm pale background `#f8ecdf` with faint collagen fibres (3-6 long wavy strokes, `#ecd6bf`, 1.2 units) and a few fibroblast nuclei (thin spindles), so it reads as connective tissue not a box.
- **Blood vessel (post-capillary venule)**: a horizontal tube with **a wall of flattened endothelial cells** (a row of thin elongated cells, each with a flat nucleus bulge) on top and bottom, red-pink lumen with 4-6 **biconcave red blood cells** (discs with a paler centre, `#b3261e` family), and neutrophils in the lumen near the wall. Gaps open *between* endothelial cells.
- **Labels**: 17+ unit type only (existing classes), leader lines 1.2 units muted ink ending in a 2-unit dot on the structure; no label may sit on a curve, cell or wall. All labels outside the busy area where possible.
- **Colours** stay the kit palette: amber germs, purple signals, blue = adaptive/taught thing and change arrows, red = drugs that block and blood, ink/muted for structure. Introduce only tints of these (and a red-blood-cell red) via gradients.

---

## Step 1, `invader` (grade 3)
**Now:** tan bar skin with a gap, empty beige box, pink bar vessel; germs are spiky amber suns that fall and multiply in a 2-4-8 grid.
**Problems:** skin is a bar with no layers; "a cut" is a clean rectangular gap; the deep tissue is an empty colour field; the vessel is a flat rectangle with its label inside; germs look like viruses/suns; multiplication is a rigid lattice.
**Redraw:** a skin cross-section. Top: epidermis as a band of stacked keratinocytes (2-3 rows of small rounded-rectangle cells, outer row flattened and paler = stratum corneum), with a V-shaped wedge cut through it whose edges are ragged (a few torn cells), a drop of blood at the cut lip optional. Below: dermis with collagen fibres and a few fibroblasts. Bottom: venule cross-section per house style (endothelial wall, RBCs). Germs: capsule bacteria sitting on the corneum surface; one tumbles into the wedge and down. Inside, it divides by **binary fission** (each bacterium elongates, pinches at the middle, splits into two) so 1→2→4→8 is visible as division, clustering loosely (jittered positions, not a grid). Labels: "skin" + leader, "a cut" + leader to the wedge, "blood vessel" outside the tube (left, below or with a leader), "inside, they multiply" amber.
**Keep:** `data-part="skin"`, `data-part="germ"` (dfn "germ"/"pathogen"), CUTX geometry or equivalent, the 1/2/4/8 count (aria-label says "two, four and eight"), height 330.

## Step 2, `eat` (grade 3)
**Now:** macrophage = white blob with a stick "arm"; neutrophils = white circles with three separate purple dots floating down from a vessel bar; the germ "breaks" into four amber dots.
**Problems:** the pseudopod is a single line, not membrane; engulfment is not shown (no phagosome); neutrophil nucleus anatomy wrong (separate dots instead of one lobed nucleus); neutrophils do not visibly leave the vessel (no wall, no squeeze), they just appear in tissue; at t=1 the neutrophils' germs simply vanish.
**Redraw:** same tissue + venule as step 1. Left: macrophage per house style extends **two pseudopods that wrap round a germ** (membrane arms close into a cup, then a ring), the germ ends inside a **phagosome** (pale vacuole), which then fuses with small dark lysosome dots and the germ fades/fragments inside the vacuole (phagolysosome). Right: two neutrophils (multilobed nucleus) inside the venule lumen **squeeze between endothelial cells** (body pinched to an hourglass at the wall for a few frames), then crawl up to a germ and engulf it the same way (smaller pseudopod cup). Labels: "macrophage: already in the tissue" with leader; "neutrophils squeeze out of the blood" with leader; "swallow, then break down" near the phagosome with a leader.
**Keep:** `data-part="macrophage"`, `data-part="neutrophil"` (dfn "macrophage neutrophil" lights both), height 310.

## Step 3, `alarm` (grade 3)
**Now:** macrophage blob, scattered purple diamonds, pink vessel band whose top wall line breaks into 4 segments; tissue tints pink; three neutrophils pop up through gaps.
**Problems:** vessel has no wall cells so "widens and leaks" reads as a line moving; no fluid leaving; inflammation is just a pink wash; neutrophils float rather than roll/adhere/transmigrate; "macrophage" label sits on a signal.
**Redraw:** keep the composition (macrophage upper-left, signals spreading right and down, venule along the bottom). Venule drawn with endothelial cells; at t>0.35 the **venule diameter grows** (both walls move apart, lumen gets more RBCs = redness), **gaps open between endothelial cells**, small translucent blue-grey fluid droplets/streaks seep out into the tissue (oedema = swelling) and the tissue background shifts slightly warmer/redder near the vessel (graded, strongest near the vessel, not a flat wash). Neutrophils: roll along the inner wall, stop (adhere), then squeeze through gaps. TNF diamonds drawn as TNF glyph, with a short leader-labelled cluster "TNF". Place "inflammation: red, hot, swollen" in a clear corner with an arrow to the reddened zone; "the vessel widens and leaks" with an arrow to a gap.
**Keep:** `alarmScene(o)` contract shared with step 14 (spread, leak, cells, keep, grab, ghost), SIG_AT/GAPS geometry or equivalent, `data-part` macrophage/signal/vessel, `class="ghost" data-ghost="normal"` usage in step 14, height 356.

## Step 4, `tag` (grade 3)
**Now:** beige panel with three germs, a 5-point star "dendritic cell", a pale blue tube, a blue ellipse "lymph node" holding blue T discs and white B rings.
**Problems:** star is clip art; lymph node is an ellipse with no anatomy; T and B cells placed arbitrarily (T top, B bottom); the lymph vessel is a featureless pipe; the tag is a loose triangle beside the star, not on the cell surface.
**Redraw:** left = tissue with bacteria (tags visible on the big one, enlarged inset look kept: one large germ with labelled "antigens (name tags)" leader to the triangles). Dendritic cell per house style engulfs a germ (dendrites close round it), then displays triangles on its surface on MHC stalks, then migrates along an **afferent lymphatic vessel** (thin-walled tube with 2-3 **leaf valves** drawn as V-flaps, pale lymph fill) into the node. Right: **bean-shaped lymph node** in section: capsule outline (2.5 units), a **hilum notch** on the right side with an efferent vessel leaving, the afferent vessel entering the **convex** left side, the **outer cortex with 3 round B-cell follicles** (circles holding small B lymphocytes, slightly darker wash), the **paracortex** (deeper band, T lymphocytes), and paler **medulla** with medullary cords near the hilum. Labels: "lymph node", "B cells" (to a follicle), "T cells" (to paracortex), "lymph vessel"; "it carries a tag in" with leader to the arriving DC.
**Keep:** `data-part` node, tag, dendritic; travel bezier (or a new path) in the same t windows; aria-label mentions "star-shaped" and "large blue bean": update to match. Height 344. Caption calls DCs "star-shaped", a branched cell still honours that; do not draw a geometric star.

## Step 5, `switch` (grade 3)
**Now:** star DC and a big blue circle with a notch touching a triangle; inside, a pill toggle switch labelled calcineurin; blue dots stream right ("IL-2: grow!").
**Problems:** no receptor shapes (TCR, MHC); the toggle is a UI widget metaphor, acceptable but flat; the T cell has no nucleus so "turns on the gene" has nowhere to happen; IL-2 drifts off-frame instead of acting back on T cells (it is the cell's own grow signal); large empty top half.
**Redraw:** a zoom on the contact (immunological synapse). Left: a section of the DC (dendrite arms off-frame) with **an MHC "cup" holding the triangle tag**. Right: the helper T lymphocyte (large nucleus) with a **TCR** (two-chain stalk with a shaped tip that matches the triangle) docking into it. Inside the T cell: keep the switch pill for calcineurin (it is the lesson's visual metaphor, fine) but render it as a rounded enzyme blob with a knob that slides, then a thin arrow from the switch into the **nucleus**, where a short DNA segment labelled "IL-2 gene" lights blue. IL-2 (blue dots) leaves the cell and **binds IL-2 receptors on the same and neighbouring T cells** (draw 1-2 receptor stalks; dots land on them). Labels: "tag on the dendritic cell", "T cell receptor", "calcineurin", "IL-2 gene", "IL-2: grow!".
**Keep:** `switchScene(o)` contract shared with step 13 (dock, on, flow, signal, copies, ghost, drug), `data-part` dendritic, tag, tcell, switch, il2, clone, drug; TC/COPY_AT geometry used by step 13; height 290. Do not name NFAT in text (caption does not); an unlabeled arrow is accurate.

## Step 6, `clone` (grade 5)
**Now:** a clean binary tree of blue "T" discs, 1→2→4→8, with a "N matching cells" counter.
**Problems:** discs are clip art; parents stay on screen, so 15 cells are visible while the counter says 8 (a dividing cell becomes its two daughters); no visual of "fits the same tag".
**Redraw:** keep the tree layout (it reads well). Each node a helper T lymphocyte with its matching TCR glyph (same tip shape on every cell = same clone). Show division as **mitosis**: the parent elongates, pinches (cleavage furrow), and splits into two daughters that slide to the next row; the parent position then becomes a faint dotted outline (lineage), so the solid cells always equal the counter. Optional thin "days pass" arrow down the left margin. Label "a clone: every copy fits the same tag" with a bracket under the bottom row.
**Keep:** `data-part="clone"`, TREE_X/TREE_Y, counter text, height 330.

## Step 7, `bcell` (grade 3)
**Now:** white circle "B" with stick Y receptors grabs a germ; a blue "T" disc below with three tick marks for "help"; the B circle cross-fades into an ellipse with 4 lines (plasma cell); 18 stick Ys spread right.
**Problems:** B cell and plasma cell look like generic icons; "help" is three ticks; antibody glyph is a stick; plasma cell is labelled but not recognisable; the antibodies are a uniform field.
**Redraw:** B lymphocyte (large nucleus) with membrane BCR Ys (house-style antibody, anchored by a short transmembrane stub) binding the germ's triangle; helper T lymphocyte docks below with a short contact line and a few small blue cytokine dots passing to the B cell (help). The B cell enlarges into a **plasma cell** (eccentric clock-face nucleus, RER lamellae, Golgi patch) and **IgG Ys bud from its surface** and drift right in a loose stream (varying rotation and small scale variation for depth, nearer ones slightly larger and more saturated). Labels with leaders: "B cell", "receptor fits the tag", "helper T cell gives help", "plasma cell", "antibodies pour out".
**Keep:** `data-part` bcell, plasma, antibody (dfn antibody also used in step 8 and 9/10/12 curves), height 322. Caption says "B cell multiplies, and its copies become plasma cells": optional 1→2 split before the plasma turn would match the caption better.

## Step 8, `attack` (grade 3)
**Now:** left half: three spiky germs each with one stick Y, pulled together and moved toward a white blob; right half: a beige circle with amber dots (infected cell) and a blue "T" disc; the cell becomes a dashed circle.
**Problems:** agglutination needs antibodies **bridging** two germs (each Y's two arms on two different germs); macrophage does not visibly engulf (no Fc grip); killer T cell is identical to helper T cell; the infected cell's "death" uses the dashed-grey **ghost** convention (which means "normal" elsewhere in the lesson): a real conflict; virus inside drawn as amber dots like germs; killing by "burst" is inaccurate: killer T cells trigger apoptosis.
**Redraw:** left: 3-4 bacteria cross-linked by IgG Ys (each Y arm on a different germ = clump), a macrophage with Fc receptors grips the Ys' stems and wraps pseudopods round the clump (phagocytosis). Right: an infected body cell (epithelial-looking, nucleus, cytoplasm with small hexagonal **virus capsids** in a distinct colour, e.g. muted purple-grey, and an MHC cup on its surface showing a viral fragment); the **killer T cell** (teal rim + dark granules, labelled) docks via TCR, granules move to the contact and release (small dots crossing the gap), then the target cell **shrinks and blebs into apoptotic bodies** (round membrane-bound fragments) instead of turning into a dashed ghost. Labels with leaders.
**Keep:** `data-part` antibody, macrophage, infected, killer; height 334; aria-label says "breaks apart": update to "shrinks and breaks into small pieces" (apoptosis). Never use dashed grey for anything except the normal ghost.

## Step 9, `curve` (grade 6, graph)
**Now:** model-driven germ (amber), alarm (purple) and antibody (blue) curves drawing left to right; innate/adaptive band under the axis.
**Problems:** the "alarm" label touches the rising blue antibody curve; no area shading; axes heavy; band ends at day 22 but the antibody curve runs on, so the band looks arbitrary; "germs" label sits on the y axis.
**Lift (keep the graph):** light fills under each curve (same hue, 10-14% opacity) so the overlaps read as layers; thinner axes (1.5) in muted ink with no gridlines; move "alarm" label to the left of the purple peak with a short leader, "germs" label to the right of its peak; extend the adaptive band to the plot end or label its edge "takes days"; add a vertical dotted "now" cursor at the drawing tip while it animates; consistent end caps (round).
**Keep:** `curveD`, `gyOf`, SCALE/PEAK, `data-part` germs/alarm/antibody, height 360.

## Step 10, `memory` (grade 5, graph)
**Now:** split timeline (first meeting / same germ years later) with germ, antibody and a dotted memory line; axis break.
**Problems:** "memory cells stay" label sits across the blue curve; "germs climb less" label overlaps the blue curve and is far from the tiny germ bump it names; the second antibody peak is barely higher than the first (~5% in the picture), so "sooner, higher" is not visible; the dotted memory line is unlabeled at its end and jumps at the break; the break is a grey rectangle over the axis.
**Redraw/lift:** keep the model curves but present the secondary response clearly higher (raise SCALE for the right panel only or use a shared scale where the model's reinfect peak is visibly taller; if the model's A peak on reinfection is truly only marginally higher, flag to the model owner: textbook secondary responses are several-fold higher and the caption says "stronger"). Labels: "memory cells" at the right end of each dotted line (on clear background); "germs climb less" with a leader to the small amber bump; "antibodies: sooner, higher" with an arrow from the first peak height to the second (blue change arrow). Proper axis break: two short slanted strokes on the axis only, no grey rectangle. Shaded areas as in step 9.
**Keep:** REPEAT series, L/R panel mapping, `data-part` memory/germs/antibody, height 340.

## Step 11, `whole` (grade 5, map)
**Now:** a vertical ladder of six rows with tiny icons, bold text, red "← drug" notes, and hours/days/years braces.
**Problems:** red "←" notes point at nothing (an arrow pointing left at the text start); the B+Y icon collides with the text "T cells multiply…"; icons are the clip-art glyphs at tiny size; vaccine (which helps) uses the same red as blockers.
**Redraw:** keep the ladder. Icons become miniatures of the new cell primitives (bacterium, macrophage with TNF, DC, T lymphocyte with switch, plasma cell with Ys, memory lymphocyte). The connecting chain is a vertical line with arrowheads; **drug notes become red inhibition bars (⊣) placed on the chain at the step they block** (anti-TNF + glucocorticoids at the alarm, calcineurin inhibitors at the switch) with the text to the right; vaccines get a **green "+" marker** (C.green) on the memory row ("made ahead of time"). Fix icon/text spacing (text starts at x≥124 when the icon is wide). Braces stay.
**Keep:** `data-part="drugpoint"` on the drug notes (dfn "Immune drugs"), row timing, height 404 (stay under 420).

## Step 12, `vaccine` (grade 5, change graph)
**Now:** model-morphed curves over dashed grey normal; three red triangles + red text "vaccine beforehand: memory ready"; readout below.
**Problems:** red triangles overlap the "amount ↑" axis title; "↓ germs climb less" crosses the blue curve and dashed ghosts and sits far from the (now tiny) amber curve; no labels on which line is which (germs/antibodies/memory) at t=1; a vaccine is drawn in red (the "block/harm" colour) though it boosts.
**Redraw/lift:** move the vaccine marker below the axis at time zero (a small syringe or tag-triangle trio in green/ink with "vaccine given beforehand" label below the axis, clear of the title). End labels on each curve ("antibodies", "memory cells", "germs"), ghosts labelled once ("dashed: no vaccine" keep). Change arrows: a blue arrow from the ghost antibody peak to the new peak ("sooner, higher"), a blue down-arrow from the ghost germ peak to the new tiny germ curve ("germs climb less") placed in clear space left of the blue rise. Shaded areas.
**Keep:** ghost `class="ghost" data-ghost="normal"`, `lerpSeries`, VAC series, `data-part` memory/germs/antibody/drug, HEIGHT.vaccine 362, CHANGE_WHERE.vaccine text (update colour words if the vaccine marker stops being red).

## Step 13, `cni` (grade 4, change)
**Now:** step 5's picture with a red block dropping on the switch knob, IL-2 dots stopping, a row of 8 T discs shrinking to 1 among dashed outlines.
**Problems:** inherits step 5's flat shapes; "less IL-2" floats in the top-right far from anything; the red block covers the knob so it is unclear the switch is off; the copies row is a row of discs not lymphocytes.
**Redraw:** step 5 redrawn (synapse, TCR/MHC, switch, nucleus). The drug: a red molecule (small red pill/hexagon cluster labelled "calcineurin inhibitor") binds onto the calcineurin blob, the knob slides back to off and greys; the arrow to the nucleus dims; the "IL-2 gene" stays dark; IL-2 dots stop at their source with "less IL-2" placed right beside the cell membrane where they used to exit, with a blue down-arrow. The copies row: lymphocyte miniatures over dashed ghost outlines, "↓ fewer T cells multiply" with arrow; "B cells get less help" kept.
**Keep:** `switchScene` contract, ghost row, `data-part` drug/switch/il2/clone, HEIGHT.cni 378, CHANGE_WHERE.cni.

## Step 14, `antitnf` (grade 4, change)
**Now:** step 3 picture; red Ys and a red U drop onto purple diamonds; most diamonds go to dashed ghosts; swelling fades; vessel wall closes with a dashed ghost wall line; neutrophils sink back.
**Problems:** at t=1 a neutrophil straddles the vessel wall line (overlap); the U-shaped decoy is unlabeled (caption names "decoy TNF catchers"); swelling change is a tint fade only; the ghost wall line and real wall nearly coincide.
**Redraw:** step 3 redrawn (endothelium, RBCs, fluid). Drug glyphs: red IgG Ys (house-style antibody) with **TNF trimer held in the Fab arms**, plus one **decoy receptor** drawn as two receptor stalks fused to an Fc stem (labelled "decoy" with a leader). Ghost: the normal (inflamed) vessel outline dashed grey, wider, so the narrowing is visible; fluid droplets fewer; neutrophils stay in the lumen (none on the wall line). Change labels: "↓ less swelling" with an arrow to the tissue, "↓ vessel leaks less, fewer cells out" with an arrow to a closed gap.
**Keep:** `alarmScene` contract, ghost classes, `data-part` drug/signal/vessel/macrophage, HEIGHT.antitnf 356, CHANGE_WHERE.antitnf (update "cup-shaped").

## Step 15, `gc` (grade 3, change)
**Now:** a big white circle cell with a beige nucleus holding three blue wavy lines ("instructions"); a red hexagon flies in and sits on them; purple signals (diamond/circle/triangle) drop from 9 to 3 among dashed outlines; a row of T discs shrinks 8→3.
**Problems:** the "instructions" label crosses the nucleus outline; the cell is anonymous (which cell?); the steroid goes straight to DNA with no receptor (glucocorticoids bind the **cytoplasmic glucocorticoid receptor** and the pair moves into the nucleus); the T cell row is disconnected from the cell above; "glucocorticoid" label is far from the hexagon; the picture runs to y≈396, little headroom.
**Redraw:** a macrophage-like immune cell (house style) in section with nucleus and a DNA double-helix segment (two twisted strands, rungs) labelled "instructions (genes)" outside the nucleus with a leader. The steroid: a small red **four-ring steroid glyph** (three hexagons + one pentagon, fused) crosses the membrane, binds a **receptor** blob in the cytoplasm (label "receptor"), and the pair passes through a nuclear pore onto the DNA; transcript dots (mRNA squiggles) leaving the nucleus thin out, and cytokines leaving the cell fall 9→3 (ghost outlines stay). Below, separated by a hairline: "T cells multiplying" row of lymphocyte miniatures 8→3 over ghosts. Labels: "glucocorticoid" with leader to the steroid, "it switches the genes down" (or keep caption-aligned "it sits on the instructions"), "↓ many alarms at once", "↓ fewer T cells".
**Keep:** `data-part` cell, drug, signal, clone; ghost groups; HEIGHT.gc 396 (≤420; keep labels ≥17 and below 410); CHANGE_WHERE.gc (update "hexagon"). Accuracy note: adding the receptor is accurate and does not contradict the caption ("They enter immune cells and turn down the instructions"); do not add NF-κB names.

---

## Reusable primitives (shared library candidates)
1. Bacterium (coccus/short rod) with capsule halo, highlight and stalked antigen triangles; binary-fission animation (t: elongate, pinch, split).
2. Virus capsid (small hexagon/icosahedron glyph).
3. Neutrophil: 3-4-lobed segmented nucleus joined by strands, granular cytoplasm; "squeeze through wall" hourglass deformation.
4. Macrophage: irregular body, pseudopods, kidney nucleus, phagosomes; engulf animation (pseudopod cup closing to phagosome, lysosome fusion).
5. Dendritic cell: branching wavy dendrites, surface MHC cups carrying antigen.
6. Lymphocyte base (large nucleus, thin cytoplasm rim) with variants: helper T (blue, TCR), killer T (teal, granules), B (BCR Ys), memory (charcoal rim); mitosis/division animation.
7. Plasma cell: eccentric clock-face nucleus, RER lamellae, Golgi patch.
8. IgG antibody: heavy/light chains, Fab/Fc, hinge; colour param (blue body, red drug); membrane-anchored BCR variant; decoy-receptor-Fc variant.
9. MHC-peptide cup + TCR docking pair (immunological synapse).
10. Cytokine glyphs: TNF trimer, generic small cytokines (diamond/circle/triangle), IL-2 dot, receptor stalk.
11. Post-capillary venule section: endothelial-cell wall with openable inter-cell gaps (param), RBC discs in lumen, width param (vasodilation), fluid seep droplets.
12. Skin section: epidermis with keratinocyte rows + corneum, dermis with collagen fibres and fibroblasts; cut wedge param.
13. Lymph node section: capsule, cortex follicles (B), paracortex (T), medulla, hilum, afferent lymphatic with valves, efferent vessel.
14. Steroid four-ring glyph + intracellular receptor blob + nuclear pore.
15. DNA double-helix segment with a "gene on/off" highlight.
16. Apoptosis animation (shrink, bleb, apoptotic bodies).
17. Graph kit: soft area fills under curves, end-of-curve labels with leaders, axis break strokes, change arrow between ghost peak and new peak.
18. Inhibition bar (⊣) and enhancement (+) markers for pathway ladders.

## Risks
- **Model-driven geometry:** steps 9, 10, 12 read `IM.BASE.series`, `IM.run({reinfect:true})`, `IM.run({vaccine:true})` through `curveD`/`gyOf`/`SCALE`/`PEAK`; label positions are computed from `xOfDay`/`gyOf` peaks. Moving labels must stay model-driven (anchor to computed peaks), not hard-coded pixels. Making the secondary peak visibly higher must not fake data: change scale/presentation or raise it with the model owner.
- **Readouts:** every change step's readout comes from `IM.settle`/`compare`; the picture must keep agreeing (e.g. step 12 readout says T cells fewer with vaccine; the picture does not show T cells, fine, but do not draw more T cells).
- **Shared scene contracts:** `alarmScene` (steps 3, 14) and `switchScene` (steps 5, 13) are reused; redraw both callers together. COPY_AT/TC/MAC/SIG_AT/GAPS coordinates are shared.
- **data-part names used by dfn** (must survive): germ, macrophage, neutrophil, signal, vessel, tag, dendritic, node, tcell, switch, il2, clone, bcell, plasma, antibody, killer, germs, memory, drugpoint, drug. Also present in pictures: skin, infected, alarm, cell. `dfn data-part="macrophage neutrophil"` lights two parts at once. `antibody` is used both for cell glyphs (7, 8) and curves (9, 10, 12).
- **Ghost hooks:** `class="ghost" data-ghost="normal"` groups in steps 12-15 (kit/lab tools read them). Do not reuse dashed grey for non-ghost meaning (step 8 currently does).
- **Heights:** HEIGHT map (vaccine 362, cni 378, antitnf 356, gc 396) and `moving(..., h)` heights; step 11 at 404 and step 15 at 396 have little headroom for 420 max.
- **aria-labels and CHANGE_WHERE strings** describe current glyphs ("spiky amber balls", "star-shaped", "large blue bean", "cup-shaped decoy", "red hexagon", "breaks apart"): update with the redraw.
- **`.in-cell` CSS class** (white letters inside T/M cells) becomes unused if letters are dropped from cells (keep for step 11 icons or remove).
- **Gradient ids:** many svgs per page; prefix ids per scene to avoid duplicate-id clashes across steps; or put shared defs in one hidden svg.
- **Phone legibility:** the richer cells must stay readable at 375 px (scale 0.78): keep strokes ≥1.2 units, don't put text inside cells, avoid detail smaller than ~3 units.
- **Accuracy traps:** neutrophil nucleus is one multilobed nucleus (not 3 dots); killer T kills by apoptosis, not burst; glucocorticoids act via an intracellular receptor; IL-2 acts on T cells' own receptors (autocrine), not into empty space; lymph node B cells sit in cortical follicles, T cells in the paracortex, afferent vessels enter the convex surface; agglutination needs antibodies bridging germs; vaccine should not be coded as "block/harm" red.
