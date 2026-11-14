# Redraw brief: cell-cycle-chemotherapy (Lesson 21)

Audited 2026-11-13 from captures at t=0.35 and t=1 for all 17 steps
(`scratchpad/audit/shots/cell-cycle-chemotherapy/`), plus `lab/cell-cycle-chemotherapy/{index.html,app.js,model.js,style.css}`.

**Overall grade: 3 / 10.** Every picture is flat ink-on-panel geometry: cells are two concentric circles,
chromosomes are single 4-unit strokes, enzymes are a pac-man (CDK), a crescent (cyclin), two purple
brackets (topoisomerase) and a red rectangle (every drug). Nothing has shading, depth, membranes,
organelles, or a protein-like shape. The cycle ring (used in 11 of 17 steps) carries a real rendering
bug that makes each phase spill into the next. The "What changes it" steps are data-honest (driven
by `CCModel`) but read as a dot plot with word fragments, not as cells being killed. The bar is Osmosis /
Ninja Nerd cell-cycle art: a real cell with a nucleus and envelope, X-shaped sister chromatids with
centromeres, a spindle from centrosomes, a helix with depth, proteins as rounded multi-lobed blobs.

---

## 0. Bugs to fix whatever else happens

1. **Ring arcs have round caps, not butt caps.** `ring()` calls `path(arcD(...), col, 40, 'stroke-linecap="butt"')`,
   but kit `path()` already writes `stroke-linecap="round"` first. The duplicate attribute is dropped by the
   HTML parser, so each 40-unit-wide arc ends in a 20-unit round blob that runs over its neighbour (visible in
   every ring capture: the M blob covers the start of G1, the G1 blob covers the start of S). Fix: draw the
   arcs with `shape()` as closed annular sectors (outer arc, radial line, inner arc, close), never as fat strokes.
2. **The boundary chevrons sit inside those blobs and point inconsistently** (at the G2/M boundary the
   triangle reads as pointing backwards). Replace them (see the ring primitive below).
3. **The G0 box overflows.** `g0Slot` has room for 25 slots in 5 rows, but `G0BOX.h = 132` holds only 4
   (row 5 sits at y = 206, below the box bottom at 202). Steps 12 to 17 draw dashed ghost dots outside the box,
   crossing its dashed border (step 12 t=0.35 and t=1). Either cap at 20 or size the container from the slot count.
4. **The checkpoint bar sits on top of the G1/S chevron** (steps 4, 12, 17) and in step 12 the red break cross
   lands on that chevron too: three marks on one spot.
5. **Death crosses overlap each other** when a short phase gets many (step 14 t=1: five crosses fused into
   "xxxxx" along the 50-degree M arc). `deaths()` spaces by arc length without a minimum gap.
6. **Change-step words are hand-broken fragments** ("alkylating / agent: every / phase", "↑ deaths all /
   round, even / resting cells"), six lines stacked under the G0 box with unicode arrows. FORMAT asks for the
   change named on the picture with an arrow pointing at what moved; here nothing points anywhere.

---

## 1. Shared primitives to build first (in a lesson-local `cells.js` or the shared kit)

All are SVG strings from code, parameterised, animatable by `t`, using the kit palette `C` plus a small
tissue palette. Gradients live in one `<defs>` block per SVG (ids prefixed with the svg uid, as `svg()` does for markers).

| Primitive | What it draws | Parameters |
|---|---|---|
| `cell(x,y,r,{phase,shape})` | Eukaryotic cell: plasma membrane as a 2-line rim (outer ink 2, inner pale highlight 1), cytoplasm radial gradient (#fff8f2 centre to #f3e6dc rim), 3 to 5 faint organelle hints (mitochondria as small rounded capsules with a cristae squiggle, ER as two parallel arcs), nucleus with double envelope and 4 to 6 pore gaps, nucleolus (darker spot), chromatin as fine speckle. `shape` morphs circle to elongated ellipse to dumbbell (cleavage furrow), as one path, for steps 1, 9 and the traveller. | r, `elong` 0..1, `furrow` 0..1, `nucleus: 'interphase'|'none'|'two'` |
| `chromosome(x,y,s,{doubled,col,angle})` | Condensed chromosome: unreplicated = one rounded rod with a constriction (centromere); replicated = two sister chromatids as rounded capsules joined at a centromere with a small kinetochore plate, banding as 2 to 3 lighter stripes, a highlight along one edge. Not two crossed strokes. | s, doubled, angle, `split` 0..1 (sisters part) |
| `helix(x0,x1,y,{turns,amp,depth})` | DNA double helix with depth: back half of each backbone drawn lighter and thinner, front half darker and thicker, base-pair rungs coloured in complementary pairs (two tones per rung, meeting in the middle), visible major/minor groove by phase-offsetting the strands (about 0.35 turn), not mirror-image sine waves. | turns (supercoil tightness), `cut` {x, gap} |
| `fork(...)` | Replication fork: parental helix entering, helicase as a ring-shaped protein at the fork, two template strands, new strands growing from DNA polymerase blobs, new bases as short coloured rungs snapping onto the template (not floating rectangles). | progress t |
| `protein(x,y,kind)` | Rounded multi-lobed blob with gradient fill and a soft shadow: `kinase` (bilobed, with a cleft), `cyclin` (box-like folded blob that docks to the kinase), `rb` (elongated pocket protein), `topo` (two-lobed clamp that can open), `phosphate` (small amber circle "P", text at 17 units or larger), `drug` (small hexagon-ring molecule glyph in red, not a rectangle). | kind, scale, open 0..1 |
| `spindle(cx,cy,{poleGap,reach,frozen,stubs})` | Centrosomes as paired centrioles (two short barrels at right angles) inside a pale halo; kinetochore microtubules as thin double-line tubes ending on kinetochores; polar microtubules overlapping in the middle; a few astral rays. | reach, pull, `stubs` (vinca), `frozen` (taxane) |
| `cycleRing(o)` | Annular sectors (closed shapes, butt ends) with a 3-unit pale gap between phases, a thin outer arrow track with 4 small arrowheads in the gaps, all clockwise; checkpoint gates as short bars across the ring AT the G1/S and G2/M gaps (not on an arrowhead); G0 as a small side loop bud off G1 outside the ring, with in/out arrows. | lit, gate state, arc angles |
| `apoptotic(x,y,r)` | A dying cell: shrunken, blebbed outline, nucleus broken into 2 to 3 dark fragments, red outline. Replaces bare red crosses at scales of r 7 or more. | r |
| `tumourMass(x,y,n)` | Packed irregular cells of varying size with large dark nuclei, slight overlap, darker core. | n |
| `boneMarrow`, `villusCrypt`, `hairFollicle`, `vessel` | Tissue icons for step 11 (see there). | |

Palette additions: membrane ink `#3a3d36`, cytoplasm `#fbf3ea`, nucleoplasm `#e9e2f2` with envelope `#6b5a86`,
marrow red `#c4473a`, bone `#efe3c8` / trabecula `#d9c8a2`, red cell `#c8372d` with darker rim, white cell nucleus
`#5a4a9c`. Keep phase colours (G1 blue, S amber, G2 purple, M green) as the ring's code throughout.

---

## 2. Per step

### Step 1 "A cell makes two" (`divide`, moving, h 284). Grade 2
**Now:** a white circle with a beige inner circle grows, pinches as two overlapping circles, splits into two identical circles.
Nothing says "cell": no membrane, no cytoplasm, no organelles, and no chromosomes, so "each a full copy" is not shown.
**Redraw:** `cell()` with full interior. t 0 to 0.35: the cell grows (r 46 to 56). 0.4 to 0.6: nucleus envelope fades,
4 coloured X chromosomes appear on a midline (just a hint of mitosis, no labels). 0.6 to 0.9: cell elongates, a furrow
pinches in (one dumbbell path, smooth waist, not two overlapping circles), each half gets the same 4 coloured rods,
then two nuclei reform around them. End: two smaller cells side by side, each with an identical coloured chromosome
set visible through its nucleus, a thin blue bracket under them labelled "each a full copy". Keep the two text lines.
Keep `data-part="cell"` on the cell group (both daughters).

### Step 2 "The instructions inside" (`dna`, still, h 372). Grade 3
**Now:** an ellipse cell, a beige nucleus with five coloured sticks, a dashed line to a flat blue/amber sine helix
with grey rungs. Reads as a children's diagram; the "zoom" has no magnification frame.
**Redraw:** a zoom chain, left to right then down: (a) the cell (`cell()`, r about 90, at left) with nucleus holding
5 to 6 coloured unreplicated rod chromosomes (caption says "wound into bundles", so rods are fine, but give them
rounded ends, banding and a centromere waist); (b) a callout circle magnifying one chromosome, drawn as a coiled
fibre (a looped thick line) with the end teasing out; (c) a lower panel with `helix()` showing depth and paired
coloured bases, label "DNA: two strands" and a small bracket "one rung = a matched pair of building blocks" only if
it fits at 17 units (otherwise omit, caption does not need it). Leader lines: thin ink 1.2 with a small dot at the
target end. Keep parts `nucleus`, `chromosome`, `dna`. Labels: "a cell", "nucleus", "chromosome", "DNA"; no overlap with the outline.

### Step 3 "A loop of stages" (`cycle`, moving 8 s, h 372). Grade 4
**Now:** fat pastel arc ring with the round-cap overrun bug, white triangle chevrons, a key on the right, a tiny cell
traveller (circle with a 1-unit stroke chromosome). The traveller is the right idea but too small and too schematic.
**Redraw:** `cycleRing()` as closed sectors. Size arcs from the model's own phase lengths (`DUR` in model.js:
G1 10, S 8, G2 4, M 1.5, so about 152, 124, 62, 23 degrees) with a floor of 36 degrees for M so its label fits, and say in a
code comment that M is widened for legibility; today's hard-coded 130/110/70/50 match neither the model nor biology.
The traveller becomes `cell()` at r 18 to 24: in G1 it grows with one rod; in S the rod becomes an X; in G2 the X is
crisp; in M the cell elongates and pinches into two, which then re-enter G1 as two small cells (the point of "one trip
makes two"). Put the key as phase names plus one verb INSIDE each sector (white text on the lit colour), and drop the
side key, freeing the right column. Keep `data-part="traveller"` and `phase-<P>` parts.

### Step 4 "G1: grow and get ready" (`g1`, moving, h 372). Grade 4
**Now:** G1 lit solid blue, traveller grows and stops on a black bar laid over the chevron at the G1/S gap.
**Redraw:** same ring, G1 lit with a soft gradient (lighter at inner edge), others at 35% opacity. Checkpoint as a
gate glyph in the G1/S gap: two short posts and a bar across the ring, in ink with a white halo, clear of arrowheads.
Traveller (`cell()`) visibly grows from r 14 to 22 and makes "what it needs" (ribosome dots and a mitochondrion appear
in its cytoplasm). Leader from "checkpoint: go on, or not?" to the gate with a dot end. Keep parts `phase-G1`, `gate`.

### Step 5 "The engines that open the gate" (`cdk`, once, h 340). Grade 2
**Now:** a blue pac-man (CDK), an amber crescent (cyclin D), a grey "Rb" box on a vertical bar that swings open, a
bare circle cell rolling along a grey line. None of these read as proteins; "Rb" is a label in a box.
**Redraw:** a molecular close-up. CDK4/6 as a bilobed kinase blob (blue gradient, dark cleft); cyclin D as an amber
folded blob that docks onto it (0.05 to 0.3); the complex then reaches Rb, an elongated grey-green pocket protein that
is clamped onto the gate bar (Rb holds the gate). 0.32 to 0.46: two or three amber phosphate circles marked "P" pop
onto Rb (phosphorylation is how CDK4/6 switch Rb off; this is correct biology and matches "switch off a brake"), and
Rb lets go and drifts down and fades. 0.46 to 0.62: the gate swings open. 0.62 to 0.92: a `cell()` (r 26) with its G1
rod crosses through into an amber "S phase" zone. Ground the scene as a horizontal track split into a blue G1 floor and
an amber S floor, not a grey line. Keep parts `engine` (CDK + cyclin together), `brake` (Rb), `gate`, `cell`, `drug`
(step 17 reuses `gateScene` with `o.drug`). Keep the small G1 badge but draw it with `cycleRing()` mini.

### Step 6 "S phase: copying the DNA" (`s`, moving, h 340). Grade 3
**Now:** a sine helix runs into a white circle "fork", two flat lines, and coloured rectangles float above each
template and fill in all at once from left to right while the fork stays put.
**Redraw:** `fork()`. Parental `helix()` enters from the right, the fork travels left over t (that is how copying
progresses), a helicase ring sits at the fork, and behind it each template strand is paired by a new strand: coloured
base rungs snap onto the template one by one at the polymerase blob, so the region behind the fork becomes two
complete double helices (each half old, half new: draw the old strand in its original colour and the new strand
paler). Free building blocks (small single-base glyphs) drift in from above. Labels: "old DNA unzips" with leader to the
helicase, "new building blocks" with leader to a drifting block, "two copies" bracket over the finished daughter helices.
Keep parts `fork`, `blocks`. Do not label leading/lagging strands (not in the caption).

### Step 7 "Untwisting as it copies" (`untwist`, moving, h 360). Grade 4
**Now:** the left helix compresses (more turns), two purple brackets open, a gap appears, a thin circle-arrow shows
spin, then the helix relaxes. The idea reads; the drawing does not: brackets are not an enzyme, and the cut is a gap
across a flat sine pair.
**Redraw:** `helix()` with depth, overwound section shown as tighter turns plus a small supercoil loop rising out of
the line (the classic plectoneme), so "wound tighter" is visible, not only labelled. Topoisomerase as `protein('topo')`:
a two-lobed purple clamp that closes around the helix, its lobes part to open a gap in BOTH backbones (a double-strand
cut; this matches etoposide's target in step 16 and the caption's generic "cut"), a curved arrow shows the strand
passing/rotating, then the lobes close and the backbones rejoin, and the supercoil loop shrinks away. Keep part `topo`
and `dna`. "wound tighter" leader to the supercoil.

### Step 8 "G2: a final check" (`g2`, moving, h 372). Grade 3
**Now:** a big purple X stroke in the ring centre with a magnifier passing over and a small red cross at the "break".
**Redraw:** ring with G2 lit, a G2/M gate glyph at the G2/M gap (this is the second checkpoint; currently there is none).
Centre: `chromosome({doubled:true})` large (s about 2.2) in purple, and as the magnifier (ink ring with a glass highlight
gradient) passes, one chromatid shows a visible break: the capsule split into two pieces with a jagged gap and a red
outline. Then three small outcome glyphs to the right, at t 0.8 onward: a mended chromosome (green tick), a paused cell
at the G2/M gate, and an `apoptotic()` cell, under the words "fix it, / stop here, or / self-destruct". Keep part `check`, `phase-G2`.

### Step 9 "M phase: pulling the copies apart" (`m`, moving, h 350). Grade 3
**Now:** a rounded blob outline, two green dots for poles, green straight lines, sister chromatids as short vertical
amber bars that become T-shapes against the ropes; a sharp V notch for the furrow; no centrosomes, kinetochores or
nuclei. Chromosomes do not look like chromosomes.
**Redraw:** `cell()` without nucleus (envelope gone in mitosis), `spindle()` with centrosomes, 3 or 4 replicated
`chromosome()`s on the metaphase plate (each X oriented across the plate with a kinetochore microtubule from each pole
to its centromere). 0.3 to 0.65: sisters separate and move centromere-first as V shapes, their arms trailing, while
kinetochore tubes shorten and polar tubes push the poles apart (cell elongates). 0.7 to 0.95: a smooth cleavage furrow
(contractile ring shown as a thin red-brown band at the waist) pinches in, and two nuclear envelopes re-form around the
two chromosome sets. Keep part names `spindle` and `chromosome` (both dfns: "spindle", "microtubules", "mitosis" point
here). `spindleCell()` is reused in no other step, but its `o.frozen`, `o.grow`, `o.ghost` options are meant for the
spindle-drug picture: reuse the new `spindle()` there.

### Step 10 "Most cells are resting" (`g0`, moving, h 372). Grade 3
**Now:** the ring plus a dashed box of grey dots labelled "G0: resting", two grey arrows, one dot leaves and one returns.
**Redraw:** G0 as a side loop budding out of G1 (`cycleRing` G0 bud, a pale grey-green pocket attached to the outside of
G1 with a one-way arrow out and a dashed arrow back). Inside it, 8 to 10 small differentiated-looking cells (flattened,
some with a neighbouring cell's shape: e.g. a liver-cell polygon, a neuron-like cell is NOT appropriate since neurons do
not re-enter; keep them generic resting cells, drawn as small `cell()`s with darker, condensed nuclei). One cell exits G1
into G0 and one re-enters (turns blue and grows) while "some step back in, to heal" appears. Keep part `g0`. Note: the
G0 box is reused by every change step (see Step 12 to 17), so the bud layout must hold the model's up to 25 dots.

### Step 11 "The whole loop: the key measures" (`whole`, moving loop, h 400). Grade 3
**Now:** a stadium-shaped beige rectangle with pink inside and six circles (marrow), a pink bar with dots (blood),
four pink humps on a line (gut lining), four black curves on a tan bar (hair roots). Clip-art level; hair and gut are
unrecognisable without their labels.
**Redraw:** three tissue vignettes of equal weight, each in a soft rounded frame:
(a) **Bone marrow**: cross-section of a long bone (compact cortical ring in bone colour with a few osteon rings, spongy
trabecular lattice inside, red marrow filling the spaces) with dividing blood-forming cells (small round cells, some
mid-division dumbbells) and a sinusoid vessel leaving into (b).
(b) **Blood vessel**: a tube with wall (endothelium line + muscle layer band) and lumen; red cells as biconcave discs
(pale centre, darker rim), white cells as larger round cells with lobed purple nuclei, flowing right.
(c) **Gut lining**: two or three finger-like villi over crypts, columnar cells along the surface, dividing cells marked
at the crypt base (that is where gut renewal happens).
(d) **Hair root**: a follicle in skin section: the bulb at the base with a dermal papilla, a hair shaft rising through
epidermis; dividing cells in the bulb.
Each vignette has a small green "dividing" pulse (a dumbbell cell) to tie it to the cycle. Footer "key measures: tumour
size, new blood cells" with two small icons (a tumour mass and a red/white cell pair). Keep part `marrow`.

### Steps 12 to 17 "What changes it" (shared `changePic`, h 412, readout under). Grades: cancer 4, antimetabolite 4,
spindle 3, alkylating 4, topo 4, cdk46 3.
**What works and must stay:** the ring of living-cell dots is model-driven (`CC.lerp(ref, ENDS[kind], e)`, `dotsOf`,
`deadOf`, `ARC_SLOTS`), the dashed grey ghost of the reference state is present (`<g class="ghost" data-ghost="normal">`),
the morph runs 0.15 to 0.9, and the readout agrees with the picture.
**Problems:** the bug list in section 0 (round caps, chevrons, G0 overflow, crossed crosses, gate on chevron); deaths are
bare red Xs inside the ring that do not read as dead cells; the red drug bracket is a plain stroke with no drug identity;
the centre "drug at work" glyphs are illegible (a pac-man with a red rectangle, a black bar; a red dot on an ellipse for
the spindle; a ladder for crosslinks; a rectangle in a helix gap); the words are six stacked fragments with unicode arrows
instead of an arrow drawn to the part that moved.
**Redraw (all six):**
- Ring from `cycleRing()` (sectors, gates in gaps, G0 bud). Living dots become tiny cells: 6-unit circles with a white
  rim and a dark nucleus dot, coloured by phase; ghosts stay dashed grey rings at the same slots.
- Deaths become `apoptotic()` glyphs (r 6) inside the ring, spaced with a minimum 14-unit arc gap; if `deadOf` exceeds
  what fits, stack a second row further in rather than overlapping.
- The drug mark: a red outer arc over the struck phases (keep), with a `protein('drug')` hexagon glyph at its midpoint and
  the drug class name on a white chip next to it. Alkylating keeps the dashed red full circle plus the red G0 outline.
- Centre inset: a circular "lens" (white disc, thin ink rim, soft inner shadow) showing the mechanism properly:
  * cancer: `tumourMass()` growing with t; the G1/S gate glyph cracks (two halves, red break) at e > 0.5.
  * antimetabolite: a mini `fork()` where a red-outlined look-alike base slots into the new strand and the polymerase
    stalls (a stop bar after it); caption-matched label "fake building block".
  * spindle: split lens: left half vinca (microtubules as short stubs that cannot reach the chromosome), right half taxane
    (long, over-straight microtubules with red tick "locks" that cannot shorten), a stuck metaphase X in both. Label
    "can't grow | can't shrink". This is the caption's distinction and today's picture loses it.
  * alkylating: `helix()` with two or three small red alkyl tags on bases and one red interstrand crosslink bar; label
    "groups stuck on; strands tied".
  * topo: `helix()` with the topo clamp sitting open on a double-strand cut, a red drug hexagon wedged in the clamp
    (the drug traps the enzyme on the cut DNA; the enzyme, not a red block, holds the ends); label "cut never rejoined".
  * cdk46: the kinase blob from step 5 with the red drug hexagon in its cleft, Rb still clamped on the closed gate with
    no phosphates; label "gate held shut".
- Change words: two short labels max, each with a drawn blue `arrowFixed` to what moved, e.g. cancer: "fewer rest" pointing
  at the emptying G0 bud and "more divide" pointing at the swelling G1 arc; antimetabolite: "deaths in S" pointing at the
  apoptotic glyphs on S; spindle: "stuck in M" at the M crowd; alkylating: "deaths all round" at the dashed ring;
  topo: "deaths in S and G2"; cdk46: "piles up in G1" at the G1 crowd and "no deaths" plain. Drug name moves to the chip on the bracket.
- Update `CHANGE_WHERE` aria text to describe the new marks (it currently names "red crosses", "red bracket", "fake block").

---

## 3. Graphs (not steps, but on the lesson's tabs)
- **Explore freely** (`explorePicture`): a two-series line chart (tumour size in ink, new blood cells in marrow red) over
  dashed ghosts, then five horizontal bars with dashed reference outlines. Already sound and readable. Lifts: shade the
  area between treated and untreated tumour curves (pale blue) so the effect is an area; end-of-line direct labels at the
  line ends instead of the top-right legend; add the "drug stopped" moment as a thin vertical rule when stopHalf is on; give
  the bars rounded 3-unit ends and phase colours matching the new ring tints.
- **Clinical values** (`bloodPicture`, gauges): the marrow there is the same stadium clip-art as step 11 and the blood drop
  has flat ellipses; reuse `boneMarrow` and `vessel` red/white cells. Gauges are fine.

---

## 4. Risks for whoever redraws
- **Model-driven geometry:** `ARC_SLOTS` derives dot slots from `PH[p].a0/a1`; changing arc angles changes slot counts,
  and `dotsOf` clamps at `SLOTS[p].length`, so a smaller M arc can silently cap the M crowd that step 14 is about
  (more cells stuck in M). Recompute capacity and check `dotsOf(ENDS.spindle,'M') <= SLOTS.M.length`. `deadOf` max 9 per
  phase must fit with spacing. G0 can be asked for up to 25 dots (`clamp(..., 0, 25)`).
- `GATE_A = 40` is the G1/S boundary angle used by `ring()` and `g1Pic`; if arcs are resized from DUR it must follow.
- `traveller(a)` decides phase from hard-coded angles 40/150/220; derive from PH instead.
- **data-part names that `<dfn>` uses (keep exactly):** `cell`, `nucleus`, `dna`, `chromosome`, `traveller`, `phase-G1`,
  `gate`, `engine`, `brake`, `fork`, `blocks`, `topo`, `phase-G2`, `check`, `spindle`, `g0`, `marrow`, `cells`, `drug`.
  `chromosome` is used in steps 2 and 9, `spindle` twice in step 9, `drug` in steps 13 to 17, `engine` three times in step 5.
- **Hooks:** `<g class="ghost" data-ghost="normal">` on change steps; `data-badge` on the corner rings; `data-blood-wbc` and
  `data-marrow-ghost` in the Clinical picture; `#model-results` dataset keys. Keep them.
- **lab-walk checks** (tools/lab-walk.mjs): one SVG, 480 wide, at most 420 tall (change steps are at 412: little headroom
  for a lens), no label overlap at t=1 (text-box intersection), no label under 12 px at 375 wide (17 units). Labels on
  white chips over a busy ring must still not intersect each other.
- **Kit `path()` forces round caps**; use `shape()` or raw `<path>` for anything that needs butt ends.
- Gradients/filters need unique ids per SVG (the kit's `svg()` already prefixes marker ids with `lx<n>-`; follow suit).
- Step 5 is `loop:false` and is reused by step 17's centre; step 9's `spindleCell` options (`frozen`, `grow`, `ghost`) exist
  for drug use.
- **Accuracy traps:** CDK4/6 switch Rb off by phosphorylating it (show P tags, not a box disappearing); vincas block
  microtubule assembly, taxanes block disassembly (stabilise); both arrest in metaphase; irinotecan/topotecan target
  topo I (single-strand nick) and etoposide topo II (double-strand break): the lesson names irinotecan AND etoposide, so draw
  a generic trapped enzyme-on-cut, do not label it I or II; alkylating agents are cell-cycle nonspecific but hit dividing
  cells most (keep G0 deaths few); interphase chromosomes are decondensed, so condensed X shapes belong to M and to the
  G2 "check" icon only; the nuclear envelope breaks down in mitosis; G0 cells re-enter at G1; gut renewal is in crypts,
  hair growth in the follicle bulb. Do not label things the caption does not teach (no E2F, leading/lagging, cohesin).
- Aria labels (`scenes` and `CHANGE_WHERE`) describe today's shapes; rewrite them with the redraw.
