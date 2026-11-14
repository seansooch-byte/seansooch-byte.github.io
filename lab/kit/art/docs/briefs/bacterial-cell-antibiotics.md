# Redraw brief: bacterial-cell-antibiotics (Lesson 19, 18 steps)

Audited 2026-11-13 from `tools/lab-shoot.mjs` captures at t=0.35 and t=1 (shots in `scratchpad/audit/shots/bacterial-cell-antibiotics/`), plus `lab/bacterial-cell-antibiotics/{index.html,app.js,model.js,style.css}`.

**Overall grade: 3/10.** Every picture is built from flat primitives: capsules with an amber stroke for bacteria, plain double lines for membranes, orange rectangles for peptidoglycan, a white Pac-Man for the penicillin-binding protein, two purple arcs for gyrase, two beige ellipses for the ribosome, white pills reading "earlier"/"later" for the folate enzymes and red rectangles for every drug. Nothing has depth, shading or texture. Nothing a student would recognise from a Lecturio, Osmosis or BioRender figure appears: no lipid bilayer, no glycan strands with peptide crosslinks, no LPS or porins, no tRNA, no supercoiled nucleoid. All six drugs are the same red rectangle, so the drug families cannot be told apart by look. The one graph (step 12) is already close to good. The teaching model, the readouts and the step order are sound. Keep all of them and redraw the art.

## House style for the redraw (applies to every step)

- **Palette.** Keep kit `C` for meaning: blue = what is being taught or what moved, red = drug or harm, amber = wall, purple = topoisomerases, green = food. Add a tissue ramp in app.js (or in a shared `bio.js`) and use it in every step:
  - cytoplasm: radial gradient `#fdf8ec` → `#f3e8cf`.
  - bilayer heads: `#e9b98a` with a `#c98a55` rim. Tails: `#f6e7c8`.
  - peptidoglycan glycan: NAG `#c86a1e`, NAM `#e79a4a`. Peptide stems and bridges: `#5b4a3a`.
  - outer-membrane LPS: `#8fa86a` sugar chains.
  - protein grey-violet `#b9b3d6`, purple `#6b3fa0` for the enzymes.
  - ribosome: 50S `#d9c7a3`, 30S `#efe2c6`, both with a soft top-left highlight.
  - DNA: blue `#254dff` and wash `#7d93ff` with pale rungs.
- **Depth.** Use one `<defs>` per SVG: a linear "lit from top-left" gradient for protein blobs, a radial gradient for cells, and a 1.5-unit inner shadow (a darker offset copy at 25% opacity) under large bodies. Never use filters that blur text.
- **Line weights.** Body outlines 2.4. Inner structure 1.4. Leader lines 1.2 ink `#53584d`, ending in a 2.5 r dot on the part. Change arrows use `arrowFixed` at 3.
- **Labels.** Every label gets a leader to its part, or sits inside the part with `on-white`. No floating labels like "no new bridge" or "the cut is never sealed" without a leader or arrow. Keep the type classes (20/18/17). Keep an 8-unit clearance around labels.
- **Drug glyphs.** Every drug is a small, schematic molecule glyph in red `#b3261e` with a white 1.5 halo, drawn once as a primitive and reused in step 11:
  - beta-lactam: a four-membered square ring fused to a five-membered ring (penam).
  - vancomycin: a large cup-shaped glycopeptide with two small sugar hexagons.
  - aminoglycoside: three linked hexagons.
  - macrolide: a large 14-membered ring drawn as a rounded polygon with one sugar.
  - tetracycline: four fused hexagons in a row.
  - fluoroquinolone: two fused hexagons with an F tag.
  - sulfonamide: a benzene ring with an SO2NH tag.
  - trimethoprim: two rings linked by CH2.
  
  These are icons, not structures to scale; say so in no picture text. Ring counts must be true to the class.

## Step-by-step

### 1. cell: "A bacterium is one tiny living cell" (still, h 316). Grade 3
**Problems.** The human cell is an empty white circle with a beige nucleus. It has no cytoplasm tone, organelles or membrane edge. The bacteria are five outlined amber pills with no interior. The arrow from the label points at empty space under the rods. Nothing says "living". Scale: a ratio of about 8:1 is plausible (a 15-20 µm cell beside 2 µm rods). Keep the ratio.

**Redraw.**
- Left: a shaded eukaryotic cell (radial cytoplasm gradient, 2.4 membrane outline). Inside it, a nucleus with a double-line nuclear envelope, three or four pore gaps and a darker nucleolus dot. Add a few mitochondria (small ovals with cristae squiggles) and some ER arcs at low contrast so it reads as a cell, not a circle. Keep `data-part="yours"`.
- Right: 5 to 6 rod bacteria drawn with the new `rod()` primitive: a layered envelope (amber wall rim over a thin bilayer line), a cytoplasm gradient, a pale blue nucleoid squiggle and a stipple of ribosome dots. Keep `data-part="bacterium"`.
- Add a scale bar under each: "10 µm" under the cell, and note that the bar applies to both. Use the same bar so "to scale" is shown, not claimed.
- Point the leader for "bacteria, to scale" at a rod.

### 2. membrane: "The membrane holds everything in" (moving, h 360). Grade 3
**Problems.** The membrane is a thin beige band between two black lines. It is not a bilayer. The "gates" are grey squares sitting on the line, not proteins spanning it. The food dot is pale green and nearly invisible at t=0.35. The waste square floats below the gate. "a gate" labels only one gate. "watery inside" sits on scattered grey dots with no meaning.

**Redraw.**
- Keep the capsule cell but make the envelope a true lipid bilayer drawn along the capsule path: two rows of head circles (r 3.2) facing out and in, with paired tail strokes between. Use a `bilayerAlong(path)` primitive.
- Add a top-left inset magnifier circle (r 70) showing 10 phospholipids at large scale, so the bilayer reads at 375 px. Label it "two layers of oily molecules".
- The gates become transmembrane transport proteins: a barrel-shaped protein (two lobes with a central channel, lit-gradient fill) spanning both leaflets. The top one carries food in (a green glucose-like hexagon passing through the channel). The bottom one exports a waste particle. Label both with leaders: "gate (transport protein)".
- Keep the motion. The particle must be visible inside the channel at mid-cycle.
- Remove the random dots or make them faint ribosomes.
- Keep `data-part="membrane"` and `"gate"`.

### 3. wall: "The wall: a net around the balloon" (moving, h 380). Grade 4
**Problems.** The idea (pressure inside, wall holds) reads. But the wall is three dashed amber rings with black tick marks, which looks like a railway or stitching, not a mesh. The left water arrow is cut off at the frame edge (it starts at x<0). The "presses out" arrows pulse too little to notice between t=0.35 and t=1. "membrane inside the wall" has a leader that crosses the wall rings.

**Redraw.**
- Make the wall a peptidoglycan mesh wrapped round the cell, drawn in perspective on the near half of the capsule:
  - glycan strands run around the circumference as chains of alternating small hexagons (NAG `#c86a1e`, NAM `#e79a4a`).
  - short peptide crosslinks run between neighbouring strands in `#5b4a3a`.
  - draw at least 4 strands so it reads as a woven net.
- Inside the mesh, show the bilayer membrane (primitive from step 2) and cytoplasm. Pressure arrows push the membrane against the mesh, with a visible 4 to 6 unit inflation.
- Water: blue droplets crossing from outside through the mesh, entering from within the frame (clamp every start point to x>=12).
- Add a small right-hand inset with no wall: a balloon-like cell that swells and pops, labelled "no wall: swells and bursts". This one is optional; drop it if it crowds the 375 px view.
- Keep `data-part="wall"` (mesh) and `"membrane"`.

### 4. build: "Building the wall, bridge by bridge" (moving, h 300). Grade 3
**Problems.** Bricks for sugar chains, a Pac-Man for the enzyme and two black dots for D-Ala-D-Ala. The enzyme floats in the air, but penicillin-binding proteins are anchored in the membrane. The new brick rises from inside without crossing the membrane visibly. The wall sits far above the membrane, with a 60-unit empty gap. The "new bridge" leader crosses bricks. The lower half of the picture is an empty cytoplasm block holding a muted sentence.

**Redraw.** Use a cross-section close-up:
- Membrane bilayer strip along the bottom third (y about 210 to 230), with cytoplasm below it in the gradient.
- Above the membrane, 3 layers of glycan strands (hexagon chains) running left to right.
- Peptide stems hang down from every NAM as 4 to 5 small beads. Neighbouring stems are joined by crosslinks (short darker bars).
- The new subunit comes up through the membrane on a lipid carrier: a NAG-NAM pair with a 5-bead stem ending in two distinct tip beads labelled "D-Ala-D-Ala". Draw the last two beads in a separate tint `#7b5ea7`.
- The PBP is a bean-shaped protein with lit-gradient fill. A membrane anchor helix crosses the bilayer, and an active-site cleft faces the stem.
- Animation: the subunit rises, then the PBP swings its cleft onto the tip. The terminal D-Ala bead pops off and drifts away. A new crosslink bar draws from the penultimate bead to the neighbouring stem, and the glycan chain lengthens by one pair (that is the transglycosylase part; keep the words to "ties the brick in").
- Labels with leaders: "new wall unit", "D-Ala-D-Ala tip", "wall-building enzyme (penicillin-binding protein)", "membrane", "new bridge".
- Move "new bricks are made inside the cell" into a small arrow label beside the carrier.
- Keep data-parts `chain`, `newbrick`, `tip`, `bridge`, `enzyme`, `membrane`. The `slice(o)` options object is the shared model for steps 13 and 14, so keep its fields (brickY, enzX, tipCut, bridge, oldBridges, ghost, drug, clamp, bulge, burst) and map them onto the new geometry.

### 5. gram: "Two kinds of wall" (still, h 356). Grade 4
**Problems.** The layer order is right (gram-positive: thick wall over membrane; gram-negative: outer membrane, thin wall, membrane). But it is drawn as bricks and double lines. There is no periplasm, no LPS, no porins and no teichoic acids. The "large drug molecule" is a grey eyeball. The purple and pink colouring is only in the words. The picture never shows the stain colour.

**Redraw.** Two side-by-side envelope cross-sections, each about 200 wide, on matching baselines:
- **Gram-positive:**
  - a thick peptidoglycan block: 6 to 8 strands of the hexagon mesh, rendered as a dense layer.
  - teichoic acids threading through as thin wavy lines topped by small beads.
  - a bilayer below.
  - tint the mesh with a translucent purple wash `#6b3fa0` at 20% opacity, so the crystal violet retention is visible.
- **Gram-negative:**
  - a bilayer outer membrane, its outer leaflet carrying LPS (head groups with short branched green sugar chains).
  - a porin barrel crossing it.
  - a pale periplasm band.
  - one strand of thin peptidoglycan.
  - the inner bilayer.
  - a translucent pink wash `#d06a8a` at 18% opacity (safranin counterstain).
- A large drug glyph (the vancomycin cup from the drug kit) drops into the gram-positive mesh and is stopped above the gram-negative outer membrane, with a red X and the porin too narrow for it.
- Optionally, a small molecule passes through the porin. That fits the caption's "many large drug molecules out", but do not claim all.
- Keep `data-part="pos"`, `"neg"`, `"outer"`. Put `"outer"` on the outer membrane plus LPS.
- Add labels "outer membrane", "thin wall", "thick wall", "membrane", and "porin" (new, optional; keep the label count within the 375 px budget).

### 6. dna: "DNA: the instruction loop" (still, h 400). Grade 3
**Problems.** The DNA is a blue star-shaped squiggle, a sine-modulated ellipse that reads as a cartoon sun, not a coiled chromosome. The bacterium has no ribosomes or texture. The human-cell comparison is a tiny circle wedged into the bottom-right corner with a 5-pointed star for DNA. The 400 height is mostly empty cytoplasm.

**Redraw.**
- The bacterium uses the shared `rod()` primitive at large scale (layered envelope, shaded cytoplasm, ribosome stipple).
- The nucleoid is a supercoiled circular chromosome: one closed blue loop that folds into 8 to 10 plectonemic twisted loops radiating from a central region, each loop drawn as two interwound strokes. It occupies an irregular central zone with no surrounding membrane.
- Add a dashed blue "one loop" trace, or a small inset showing the relaxed circle, so "one loop" is legible.
- Right-hand comparison panel at equal visual weight (not a corner thumbnail): a section of a human cell with a nucleus. The double nuclear envelope with pores is clearly drawn, and chromatin squiggles sit inside. Label "your cell: DNA inside a nucleus".
- Label "no nucleus: DNA loose in the cell" with a leader to the nucleoid.
- Keep `data-part="dna"`.

### 7. copy: "Untangling enzymes let DNA be copied" (moving, h 330). Grade 4
**Problems.**
- The helix ribbon is fine, but the replication fork is a white rounded square.
- Gyrase is two loose purple arcs above and below the DNA, not an enzyme.
- Topoisomerase IV is two arcs sitting on two linear daughter duplexes, which hides what it does: unlinking interlocked rings.
- The cut-pass-reseal cycle is almost invisible. The t=0.35 and t=1 frames look alike, and the passing segment is a faint short helix.
- The top 90 units are empty.

**Redraw.**
- Draw DNA as a double-helix ribbon (two backbones plus pale base-pair rungs).
- Fork: a ring-shaped helicase (hexamer drawn as a 6-segment donut) at the split.
- Ahead of the fork, show the overwound region with tighter twists and a red-tinted "strain" halo that grows with `wind`.
- Gyrase: a heart-shaped protein with lit gradient, two-lobed, made of A and B subunits (no letters needed), clamping the DNA. Show the cycle clearly:
  1. the gate opens and the duplex visibly splits into two ends with a gap.
  2. a second duplex segment (the passing stretch) moves through the gap, drawn at full opacity in a contrasting tint.
  3. the ends rejoin and the twists ahead relax, with the wavelength lengthening.
- Topo IV: move it to an inset at the bottom left (about 140 x 100). Two finished circular copies are interlinked like chain links. A smaller purple topo IV clamp sits at the crossing, cuts one ring, passes the other through and the rings separate. Loop this in sync with the main cycle.
- Use stages: `[[0,'winding'], [0.35,'cut'], [0.48,'pass'], [0.72,'reseal']]`.
- Keep data-parts `copies`, `fork`, `topo4`, `dna`, `enzyme`. `copyScene(o)` is reused by step 17, so keep the o fields (wind, gap, pass, trapped, ghost, drug4).

### 8. ribosome: "Ribosomes build proteins" (moving, h 370). Grade 3
**Problems.**
- Two flat beige ellipses stacked.
- Building blocks are grey squares sliding in with no tRNA.
- The "docking site" is a dashed square at the subunit seam.
- The exit tunnel is a 10-unit dotted stub.
- The chain flies off as a diagonal line of identical grey balls toward a membrane that has no role in this step.
- The motion is a one-bead shift every 1.2 s, invisible in stills. At t=0.35 and t=1 the frames differ only in the square's position.

**Redraw.** Use the standard textbook 70S side view:
- The 50S is a large rounded-crown body with a shallow central notch and lit gradient. The 30S is a smaller, flatter body below it with its own gradient. A visible cleft between them shows three tRNA slots outlined faintly and labelled small "E P A". Labels are optional, but the slots are needed.
- mRNA is a ribbon threading through the 30S neck, with codon ticks.
- Building blocks are tRNAs: an L-shaped or cloverleaf-silhouette glyph carrying a coloured amino-acid bead. They enter at A from the right, shift to P, and leave from E.
- The peptide chain is a string of multicolour beads (4 to 5 tints) that leaves through a tunnel drawn as a cut-away channel through the 50S, emerging at the top.
- Drop the membrane. Use the space for clean labels: "large part (50S)", "small part (30S)", "copied instruction (mRNA)", "building block on its carrier (tRNA)", "growing protein".
- Animation: per beat, a tRNA arrives at A, the bead joins the chain, the ribosome steps one codon, and the empty tRNA exits.
- Keep data-parts `large`, `small`, `mrna`, `chain`. `ribosomeScene(o)` is shared by steps 15 and 16, so keep its o fields.

### 9. folate: "Folate: a vitamin it makes itself" (moving, h 330). Grade 4
**Problems.**
- A metro-map line with white pills reading "earlier", "later" and a dashed "another".
- No molecule or enzyme names, though the caption names dihydropteroate synthase and dihydrofolate reductase.
- The "raw material" circle is unnamed (PABA).
- The folate output is a black dot, and the DNA letters are a 3x2 blue grid that the arrowhead overlaps.
- The "your cells take folate from food" plate of green leaves is clip-art.
- Moving pieces are small grey dots that barely change colour.

**Redraw.** A pathway diagram in the Lecturio style:
- Substrate nodes are small molecule glyphs on a horizontal track: PABA (benzene ring), dihydropteroate, dihydrofolate, tetrahydrofolate (active folate; a three-part glyph of a pteridine double ring, the PABA ring and a glutamate tail). Drop intermediate glyphs if width is tight, but keep PABA and the final folate.
- Enzymes are protein blobs (lit-gradient purple-grey) sitting above the arrows between nodes. The first is labelled "dihydropteroate synthase". The last is labelled "dihydrofolate reductase". The middle step stays unlabelled or "another enzyme", which keeps the caption's framing.
- Output: an arrow to a stack of nucleotide glyphs (a purine double ring and a thymine single ring in blue), labelled "DNA letters (purines, thymidine)".
- Bottom band: a human cell (the shared primitive) with a folate glyph entering through a membrane transporter from a "food" source. Use a simple bowl silhouette, not leaves. Labelled "your cells take folate from food instead".
- Keep data-parts `raw`, `step`, `folate`, `letters`. `folateScene(o)` is shared by step 18 (fields u, s1, s2, out, ghost).

### 10. divide: "Grow, split, repeat" (moving, h 300). Grade 2
**Problems.**
- Empty pills in a single row that become eight tiny pills.
- At t=0.35 the frame shows two pills far apart with a big empty middle.
- No DNA copying, no septum and no constriction you can see (the pinch is a background-coloured rect).
- The 1→2→4→8 counter does all the teaching.

**Redraw.**
- Top half: one large rod (the shared primitive) going through binary fission. The cell elongates, the nucleoid duplicates into two blue loops that move to the two halves, and a ring (the FtsZ division ring; label it just "dividing ring") forms at mid-cell. The envelope then constricts with a real waist made by path morphing of both outlines, not a cover rect, and two daughter rods separate.
- Bottom half: a generation tree. Row 1 has 1 small rod, row 2 has 2, row 3 has 4, row 4 has 8. Thin connector lines run from parent to daughters. Each row lights in turn, synced to the top animation.
- Keep the counter as the row labels (1, 2, 4, 8) at the left, and the "and on: 16, 32, 64" note.
- Keep `data-part="bacterium"`.

### 11. targets: "The whole bacterium: four targets" (still, h 384). Grade 4
**Problems.** The layout is the right idea: a central cell with four corner callouts. But the cell is a capsule with a thick amber stroke, the DNA is the same star squiggle, the ribosomes are three mushrooms, and the folate line is three dots. The red target rings overlap the parts and the leaders cross each other: the DNA leader crosses the folate leader, and the ribosome leader crosses the cell. "DNA untangling" is in blue, which collides with the blue = changed convention.

**Redraw.**
- A large cut-away rod (the shared primitive) showing the envelope layers at one end (mesh plus bilayer), the supercoiled nucleoid with a small purple gyrase blob on it, a cluster of 70S ribosomes on an mRNA strand (a polysome), and a tiny pathway chain (two enzyme blobs) for folate.
- Give each target a numbered red badge on the part (1 to 4), not a ring over it.
- Callouts at the four corners, each with a non-crossing leader routed orthogonally, and each listing the drug glyph(s) beside the family names:
  - 1, top-left: the wall.
  - 2, top-right: ribosomes, split into 30S (aminoglycosides, tetracyclines) and 50S (macrolides).
  - 3, bottom-left: DNA untangling (fluoroquinolones).
  - 4, bottom-right: the folate line (sulfonamides, trimethoprim).
- Use ink or purple for the "DNA untangling" title, not blue.
- Keep data-parts `wall`, `dna`, `ribosome`, `folate`, `target` (target = the four badges).

### 12. killstop: "Kill or stop" (moving once, h 364). Grade 7. Graph is already good
**Problems.**
- The shared pre-drug growth segment is drawn red under the dashed black line, so it reads as if the killing drug made bacteria grow. The red (kill) path starts at t=0.
- The y axis has no zero mark.
- End labels float without end markers.
- "key measures..." restates the caption.

**Lift.**
- Draw the pre-drug segment once in ink (solid) and branch the three runs from the drug-start point.
- Add 5 r end-dots on each curve. Lightly shade the area between the "no drug" and "stops growth" curves (blue wash at 12%), labelled "growth prevented". Shade the area under "stops growth" sloping down, with a small note "white blood cells clear them".
- Add a "0" tick, keep no gridlines, and keep `RUNS` from `BM.simulate` (model-driven geometry; do not hand-draw curves).
- Keep `data-part="kill"` and `"stop"`.

### 13. betalactam: "Beta-lactams: the bridges stop" (change, h 314). Grade 4
**Problems.** It inherits step 4's bricks and Pac-Man. The drug is a red triangle in the Pac-Man's mouth. At t=0.35 the drug title is at about 25% opacity (pink), which reads as a rendering fault. "D-Ala-D-Ala tip" and "no new bridge" have no leaders. At t=1:
- the bulge membrane is drawn over the bottom-row bricks, and spilled content dots overlap bricks and a bridge.
- the membrane line overshoots the frame edges (x 12 to 468) while the cytoplasm fill stops at x=16.
- the bridge ghosts are 2-unit dashed lines that are hard to see.
- the bulge breaks through the wall but the wall itself does not open: the bricks stay intact around the hole.

**Redraw.**
- On the new step-4 cross-section, a penam glyph (beta-lactam ring) drops into the PBP active-site cleft and stays there. The PBP turns desaturated with a red rim.
- The newly arrived D-Ala-D-Ala stem stays uncrosslinked.
- As `oldBridges` falls, the existing crosslinks fade to the ghost dashes (`#8a8f84`, 2.4 wide, so they stay visible) and the glycan strands drift apart by 6 to 10 units. That makes the mesh visibly loosen.
- The membrane then herniates through the opened gap, with the strands parting around it, not overlapping it. It ruptures at the apex with cytoplasm particles escaping upward through the gap, not over intact bricks.
- Name the change with arrows on the picture: "↓ bridges fade: wall weakens", with an arrow pointing at the ghost crosslinks, and "↑ membrane bulges and bursts", with an arrow at the bulge.
- Fade the drug title in fully within 0.1 of its start, so it is never half-transparent in a capture.
- Clip all geometry to 16 to 464.
- Keep `data-part="drug"` on the glyph and the ghost group `class="ghost" data-ghost="normal"`.

### 14. vancomycin: "Vancomycin: the brick tips covered" (change, h 344). Grade 4
**Problems.**
- The same base as step 13. The drug is a red horseshoe arc over two dots, which reads as a magnet.
- The enzyme approaches but nothing shows it failing to grip.
- The gram-negative note is a long muted line at the bottom with no picture.
- The overlap issues are the same as step 13.

**Redraw.**
- The vancomycin glyph (a large cup with two sugar hexagons) caps the D-Ala-D-Ala tip.
- The PBP swings in, bumps the cap and recoils, with a short red "✕" at the contact.
- The wall then weakens and the cell bursts exactly as in step 13. Use "many kinds burst" wording; the caption notes that enterococci are often only stopped.
- Replace the bottom text with a mini inset (about 120 x 70, bottom-left): a gram-negative outer membrane with a porin and the vancomycin cup sitting above it, too big to enter. Label "gram-negative: too big to get in".
- Keep `data-part="drug"` and `"tip"`.

### 15. aminoglycoside: "the instructions misread" (change, h 370). Grade 4
**Problems.**
- Ribosome ellipses as in step 8. The drug is a red rectangle on the 30S, and its leader runs across the 50S outline.
- Faulty protein is drawn as red-ringed white beads, which is a clear and good idea.
- The "holes" are white pills on the membrane line with grey dots dripping.
- The ghost of the normal chain is hidden exactly under the drawn chain, so no ghost is visible.

**Redraw.**
- On the new 70S: the aminoglycoside glyph (three linked hexagons) lodges at the 30S decoding site, under the A site.
- Incoming tRNAs now carry wrong-coloured beads (one tint mismatching the codon tick colour). The emerging chain shows red-ringed, wrong-coloured beads.
- Keep the earlier normal chain as a dashed ghost path offset 10 units, so the ghost is visible.
- Top band: a short bilayer segment with misfolded red-ringed protein chunks inserting into it. Each opens a gap in the leaflets, and cytoplasm particles leak through. Label "faulty proteins punch holes: the cell dies" with an arrow to a hole.
- Route the drug leader around the 50S, not across it.

### 16. macrolide: "Macrolides and tetracyclines: the factory stalls" (change, h 370). Grade 4
**Problems.**
- Two identical red rectangles. The macrolide sits on top of the 50S, not in the exit tunnel. The tetracycline sits on the seam.
- The incoming block "bounces away" off-screen-left and is barely seen.
- "the chain stalls" has no arrow.
- In the t=0.35 capture the drug blocks are visible with no labels yet.

**Redraw.**
- With the tunnel cut-away from step 8, the macrolide glyph (large ring) sits inside the exit tunnel just past the peptidyl transferase site, and the chain stops at it with the last bead pressed against the ring.
- The tetracycline glyph (four fused hexagons) occupies the A site on the 30S. An incoming tRNA approaches, is turned away and drifts off with a short arc arrow.
- The stalled chain freezes, with a "‖" pause mark and "↓ chain stops growing" arrow on it.
- Show labels at the same moment as each drug lands.

### 17. fluoroquinolone: "the DNA left cut" (change, h 330). Grade 5
**Problems.**
- Reads moderately well: the gyrase arcs with red rectangles, a dashed ghost of the sealed DNA and a visible gap.
- Weaknesses: the arcs-plus-rectangles enzyme, a topo IV "trap" that is a red rectangle floating between two daughter strands, and an empty top 90 units at t=0.35.
- "the cut is never sealed" has no leader to the gap.

**Redraw.**
- On the redrawn step 7: the heart-shaped gyrase holds the duplex open (two DNA ends visibly apart). Fluoroquinolone glyphs (fused bicycle with an F) sit wedged into the break, one at each cut end, which is how the drug-enzyme-DNA cleavage complex works.
- In the topo IV inset, the interlinked rings stay locked with a red glyph at the crossing.
- The fork behind stalls, with a red "STOP" bar at the helicase.
- Add a few small break fragments ("broken DNA").
- Arrows: "the cut is never sealed" pointing at the gap. "↓ copying stops" pointing at the fork.

### 18. sulfa: "Sulfonamides and trimethoprim: folate cut off" (change, h 330). Grade 5
**Problems.**
- The concept reads: two red blocks on two steps, the folate dot shrinks, and the DNA letters go to dashed ghosts.
- But the blocks are identical rectangles hovering above the pills.
- At t=0.35 the trimethoprim block is already present with no label.
- The moving pieces vanish rather than piling up at the block.
- The lower 100 units hold only text.

**Redraw.**
- On the redrawn step-9 pathway, the sulfonamide glyph sits in the dihydropteroate synthase blob's active site. It is shaped like PABA, so put a faint "looks like PABA" link line between them.
- The trimethoprim glyph sits in the DHFR blob.
- Pieces pile up as a queue before the first block, so blocked flow is visible.
- Downstream, the folate glyph shrinks and fades to a ghost, and the nucleotide stack drains to dashed outlines.
- Add a small two-enzyme "sequential block" bracket spanning both drugs, labelled "two blocks on one line".
- Optional: a mini-panel with the human cell's DHFR drawn larger and a tiny trimethoprim glyph that grips it only loosely, to carry the selectivity sentence. The caption says trimethoprim grips bacterial DHFR far more tightly. Do not draw human cells as lacking DHFR.
- Label each drug the moment it lands.

## Reusable primitives (build once, in a shared module, then use across lessons)

1. `rod(cx, cy, w, h, {wall:'pos'|'neg'|'none', nucleoid, ribosomes})`: a layered bacterial rod with gradient cytoplasm.
2. `bilayerAlong(pathD, {heads, tails})` and `bilayerStrip(x0, x1, y)`: a phospholipid bilayer along any path, plus a magnified inset version.
3. `transporter(x, y, {open})`: a transmembrane channel or carrier protein.
4. `pgMesh(region, {layers, crosslinkStrength})`: a peptidoglycan net of NAG/NAM hexagon chains with peptide crosslinks. Crosslink opacity is driven by a 0-1 strength.
5. `pgSubunit(x, y, {tipCut})`: a NAG-NAM pair with a pentapeptide stem and a D-Ala-D-Ala tip.
6. `pbp(x, y, {occupied})`: a membrane-anchored penicillin-binding protein with an active-site cleft.
7. `gramEnvelope('pos'|'neg')`: an envelope cross-section with teichoic acids, LPS, porin and periplasm.
8. `eukCell(cx, cy, r, {organelles})`: a human cell with a double nuclear envelope and pores.
9. `nucleoid(cx, cy, rx, ry)`: a supercoiled circular chromosome with plectonemic loops.
10. `helix(x0, x1, y, {turns, gapAt, gap})`: a DNA ribbon with base-pair rungs and an optional cut.
11. `helicase` (hexamer donut), `gyrase` (heart-shaped clamp with an open/closed gate), `catenatedRings` (topo IV inset).
12. `ribosome70S(x, y, {sites, tunnel})`: 50S plus 30S with A, P and E slots and an exit tunnel cut-away; `tRNA(x, y, aaColour)`; `peptideChain(points, tints, faultyFrom)`.
13. `enzymeBlob(x, y, label)`, `molecule(kind)` and a pathway-node layout for metabolic lines.
14. A drug-glyph kit: `drug('penam'|'vanco'|'aminoglycoside'|'macrolide'|'tetracycline'|'fluoroquinolone'|'sulfonamide'|'trimethoprim', x, y, s)`.
15. `lysis(x, y, b, burst)`: a membrane herniation and rupture that respects the wall gap.
16. `fission(t)`: binary fission with a division ring and nucleoid segregation.
17. `callout(label, anchor, route)`: an orthogonally routed leader with an end dot, plus numbered badges.

## Risks a redraw could break

- **Shared scene functions.** `slice(o)` (steps 4, 13, 14), `copyScene(o)` (7, 17), `ribosomeScene(o)` (8, 15, 16) and `folateScene(o)` (9, 18) each feed several steps. Change the geometry but keep the option fields and their 0-1 meanings, or update every caller.
- **Model-driven geometry.** Step 12 curves come from `BM.simulate`, and every change readout comes from `BM.settle`/`BM.lerp` through `change(kind)`. Do not hard-code curves or readout values. Keep the `HEIGHT` table in step with each new picture height (at most 420).
- **Ghosts.** Change steps must keep a `<g class="ghost" data-ghost="normal">`. Step 15's ghost is currently invisible because it sits under the chain; offset it.
- **Fade convention.** `show()` emits nothing at alpha ≤ 0.02, and `fade()` writes `opacity`. The lab-walk overlap checker counts a label as visible when its effective opacity is above 0.05, at the end of each picture (t=1). New labels that appear late must not collide at t=1. Partial-opacity titles (pink "beta-lactam jams the enzyme" at t=0.35) look broken in captures; ramp them faster.
- **data-part names used by `<dfn>`.** Keep these: bacterium, membrane, gate, wall, tip, enzyme, pos, neg, outer, dna, topo4, small, large, folate, target, kill, stop, drug.
  - `"enzyme topo4"` lights two parts in step 7, and `"large small"` lights two in step 8.
  - Non-dfn parts also exist (yours, chain, newbrick, bridge, copies, fork, mrna, raw, step, letters, ribosome). Keep them for Explore and future captions.
  - `lab-check` needs at least 3 dfn data-parts.
- **aria-labels.** Each scene's label and `CHANGE_WHERE[kind]` describe the drawing literally ("red rectangle", "amber bricks", "white grabber"). Rewrite them to match the new art. The lab walk requires them to be over 30 characters.
- **Label budget at 375 px.** Industry art adds detail. Keep at most about 6 labels per picture and push extra names into insets or the caption, or the 17-unit floor and the no-overlap rule will fail.
- **Frame bounds.** The current wall step's water arrow starts at x<0, and the burst membrane in steps 13 and 14 overshoots x 16 to 464. Clamp all geometry.
- **Accuracy traps.**
  - Beta-lactams bind the PBP, not the tip. Vancomycin binds the D-Ala-D-Ala tip, not the enzyme.
  - Tetracyclines act on the 30S (A site) and macrolides on the 50S exit tunnel. Aminoglycosides act on the 30S decoding site and cause misreading.
  - Gyrase works ahead of the fork. Topo IV unlinks the daughter chromosomes. Fluoroquinolones trap the cleavage complex.
  - Humans lack dihydropteroate synthase but do have DHFR, and trimethoprim is selective, not exclusive.
  - Gram-negatives have a periplasm and LPS in the outer leaflet only. Gram-positives have no outer membrane.
  - The bacterial chromosome has no membrane around it.
  - Do not add flagella, capsules, plasmids, pili or resistance enzymes; the captions do not teach them.
  - Keep the bacterium/human-cell scale ratio about 1:8 or smaller, or the "to scale" claim breaks.
- **Version stamp.** Bump the lesson's `?v=` query on edits (the project rule for The Lab).
