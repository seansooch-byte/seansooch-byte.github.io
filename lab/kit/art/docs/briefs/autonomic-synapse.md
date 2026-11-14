# Redraw brief: autonomic-synapse (Lesson 6, "The autonomic synapse")

Audited 2026-11-12 from captures at t=0.35 and t=1 (`scratchpad/audit/shots/autonomic-synapse/`), plus
`lab/autonomic-synapse/{index.html,app.js,style.css}`. 22 steps: 2 wiring maps, 5 synapse close-ups
(one shared `synapseArt`), 2 heart beat strips, arteriole, adrenal, pupil, airway, baroreflex loop,
then the receptor map (`mapArt`) used by "The whole picture" and all 7 "What changes it" steps.

**Overall grade: 4/10.** The teaching logic is strong: a real model drives the change steps, ghosts
are in place, the change words are on the picture. The art is flat icon-clip-art: a valentine heart, a
white "bell" nerve ending with smiley-face vesicles, U-shaped cups for receptors, a pink bar for "blood
vessels", a squiggle for gut, a triangle on a bean for the adrenal. Nothing has depth, a membrane, a
wall with layers or a protein shape. The bar is Osmosis/BioRender: a varicosity with a bilayer, vesicles
with a halo, GPCRs drawn as seven-helix bundles, an anatomical heart, a vessel with intima/media/adventitia.

## House style for this lesson (apply everywhere)

- Palette, keep the lesson's semantic colours: sympathetic = `C.red` #b3261e, parasympathetic =
  `C.green` #2c6a2c, drug = `C.purple`, change = `C.blue`. Tissue tones: cytoplasm warm cream
  `#fbf3ea` -> `#f1dccb` radial gradient; organ cell `#f3d9d4` -> `#e9bfb5`; smooth muscle `#d98f86`
  with darker `#b8645a` fibre striae; nerve axoplasm `#fff8ee` with a 3-unit coloured sheath edge.
  Blood: oxygenated arterial lumen `#c8463c` -> `#a83228`; vein `#7a3a5c`. Do NOT reuse red for blood
  where red means "sympathetic": draw blood as a deep crimson fill and keep sympathetic as the stroke and
  messenger colour, or tint arterial blood toward `#c25a4e` with an inner highlight so the two read apart.
- Every filled shape gets a gradient (light top-left, darker bottom-right) and a 1.5-2.5 unit outline one
  shade darker than the fill. Outline weights: 2.5 organs/cells, 1.5 organelles/proteins, 1 detail.
- Leader lines: 1.25 unit `C.muted`, ending in a 2.5 r dot on the structure, label at the far end; never
  float a label over tissue without a leader.
- Kit type classes only, nothing under 17 units; labels do not overlap any shape they do not name.

## Step-by-step

### 1. wiring "Nerves that run you on autopilot", grade 3
Problems: brain is a pink ellipse, cord a pink capsule; organs are icons (almond eye, two-lobe lung
blob, valentine heart, a flat pink bar for "blood vessels", a brown squiggle for gut); nerves are generic
arrows with blue dots. No body context; reads as a flowchart, not anatomy.
Redraw: a left-side sagittal/lateral CNS: brain silhouette with gyri hint (two sulcus curves), cerebellum
and brainstem tapering into a spinal cord drawn as a segmented column (subtle vertebral ticks, labelled
regions not required here). Right column of five recognisable organ glyphs on soft gradients:
eye (globe with iris + pupil, side 3/4 view), lungs (paired lobed lungs with trachea and bronchi),
heart (anatomical heart glyph: see primitive `heartAnatomic`, apex down-left, aorta arching, pulmonary
trunk), an artery segment in longitudinal cut showing wall thickness and lumen, gut as a looped
small-intestine segment with a lumen tone. Nerves become smooth tapered fibres (2.5 units, ink 70%)
with travelling impulse glows (blue radial-gradient dot with a short tail) instead of flat dots.
Keep `data-part="nerves"`. Keep the caption line at the bottom.

### 2. branches "Two branches, pulling opposite ways", grade 4
Problems: same clip-art organs; red and green curves cross each other in a tangle near the eye and lungs;
the "dot" synapse markers look like noise. No ganglia drawn, so a reader never sees that sympathetic
fibres relay in a chain beside the cord while parasympathetic ones relay near the organ.
Redraw: same base as step 1. Sympathetic: solid red fibres leaving the thoracolumbar cord, each passing a
small oval ganglion in a paravertebral chain (a vertical row of beads beside the cord), then a long
postganglionic fibre to eye, heart, vessels and gut. Parasympathetic: dashed green fibres leaving the
brainstem (cranial) and the sacral cord, long preganglionic fibres ending in a small ganglion right beside
or on the organ. Route fibres in separate lanes (sympathetic above each organ's midline, parasympathetic
below) so no two fibres cross. Accuracy: lungs keep green only on airway muscle (caption says sympathetic
barely reaches it); vessels keep red only. Keep `data-part="symp"`/`"para"` and the legend.
Note: the caption does not mention ganglia; if adding them, add only unlabelled ganglion beads, or add a
small "ganglion" label and confirm with the owner (no new teaching claim without caption support).

### 3. synapse "Nerve and organ never quite touch", grade 4
Problems: the nerve ending is a white bell with a stem; vesicles are smiley faces (three dots in a ring);
the gap is a lighter rectangle; receptors are U-cups; organ cell is a flat pink slab. The caption talks of
"many small swellings" (varicosities) but one bulb is drawn. "signal passed on" floats with no arrow
visible at rest.
Redraw: top half: an axon running left-to-right with two or three bead-like varicosities (the middle one
large and cut open, the others in silhouette), so the "swellings along a fibre" claim is visible.
The cut-open varicosity: phospholipid-bilayer outline (primitive `bilayerStrip`, two thin lines with
head-dot texture), cream axoplasm gradient, 5-6 vesicles as translucent spheres (white fill 85%, 1.5
outline, a highlight crescent, 6-10 small coloured transmitter dots inside), a mitochondrion (capsule
with cristae) for credibility. Bottom: organ (smooth muscle) cell membrane as a bilayer strip with the
receptors as membrane proteins (primitive `gpcr7tm`: seven rounded helix bars spanning the bilayer, a
binding pocket on top) and an intracellular G-protein blob that lights up when the signal passes on.
Gap: bracket with leader "synapse (gap)", not a white box. Vesicle fusion: omega-shaped fusion pore in
the bilayer. Messengers: small 5-unit spheres with highlight. "Signal passed on": the G-protein glow plus a
short blue cascade arrow into the cytoplasm. Keep data-parts `gap`, `messenger`, `receptor`; keep
model-free timeline (t 0-.1 impulse, .06-.16 vesicle approach, .18-.4 crossing, .42-.5 signal, fade .74-.86).

### 4. ach "The brake's messenger: acetylcholine", grade 4
Problems: identical to step 3 recoloured green; receptors still cups; "M receptors (muscarinic)" label
sits in the cell with no leader.
Redraw: step-3 synapse with green-edged varicosity and green ACh spheres; receptors are the `gpcr7tm`
primitive (muscarinic receptors ARE GPCRs, so this is accurate), labelled with a leader "M receptor
(muscarinic)". Keep `ach`, `receptor`.

### 5. enzyme "An enzyme keeps the signal short", grade 4
Problems: cholinesterase is a grey Pac-Man; it floats half in the gap half on the membrane; label
"chops it apart" sits in the organ cell far from the enzyme.
Redraw: acetylcholinesterase as a globular protein (lumpy blob of 3-4 overlapping circles with gradient,
a visible active-site cleft) tethered to the postsynaptic membrane / basal lamina by a short stalk at
both gap edges. Cleavage: ACh sphere drawn as two fused lobes (acetate + choline) that split at the
cleft; the two halves drift off and fade. Label with leader "cholinesterase" and a second line "splits
acetylcholine" next to it (not in the cell). Keep `enzyme`, the chomp timing.

### 6. ne "The accelerator's messenger: noradrenaline", grade 4
Problems: same as 3; alpha and beta are identical cups distinguished only by labels; "each family passes
on its own signal" is a sentence in an empty pink slab.
Redraw: step-3 synapse in red. Alpha-1 and beta receptors both as `gpcr7tm`, but distinguish families by
a coloured cap band (alpha: amber-red band, beta: deeper red band) or a shape tag on the extracellular
loop; each with its own intracellular G-protein blob, lit separately so "its own signal" is visible.
Labels "alpha" and "beta" with leaders below the membrane. Keep parts `ne`, `alpha`, `beta` (dfn uses
`data-part="alpha beta"`).

### 7. reuptake "Noradrenaline is pumped back in", grade 4
Problems: alpha-2 is an upside-down cup glued to the ending's corner; the pump is two grey pills with an
arrow; labels far from parts ("pumped back in: reuptake" in the upper right, far from the pump).
Redraw: on the presynaptic bilayer, a transporter drawn as a 12-helix membrane protein (two half-barrels
with a central channel) with a red sphere passing through it and a curved arrow up into the varicosity;
an alpha-2 autoreceptor as a `gpcr7tm` on the presynaptic membrane, its intracellular side with a small
"minus" inhibition bar pointing at the nearest docked vesicle. Leaders: "reuptake pump" to the
transporter, "alpha-2 autoreceptor: less release" to the GPCR. Keep `reuptake`, `alpha2`, `alpha`, `beta`.

### 8. para-heart "Acetylcholine slows the heart", grade 3
Problems: a valentine heart, the single worst picture for the owner's complaint. The dashed playhead
line runs through the row labels ("if the brake were off", "with acetylcholine on M: slower"): a label
overlap. Beat strip dots are fine conceptually.
Redraw: left third: anatomical heart (primitive `heartAnatomic`, anterior view, apex down-left, right
atrium visible, SA node marked as a small amber oval at the SVC-RA junction with a leader "pacemaker").
Vagus nerve (green dashed, sheathed fibre) arriving at the SA node with ACh spheres. Heart pulse =
a subtle scale on the ventricles synced to beats. Right: keep the two beat strips (model reads well) but
start the playhead line BELOW each row label (y range limited to the dot rows, e.g. y 92-128 and 182-218)
so it never crosses text; dots get a soft radial highlight. Keep `rate`, `muscarinic` (map it to the
SA-node receptor marker, not only to the nerve label).

### 9. beta "Beta-1 receptors speed and strengthen the heart", grade 3
Problems: same valentine heart; playhead crosses "noradrenaline on beta-1: faster" text; t=1 bigger dots
touch each other. Redraw: same heart as 8 with a red sympathetic fibre reaching both the SA node and
the ventricular wall (beta-1 drives rate and squeeze); keep strips, clamp playhead to dot rows, cap
dot radius so dots never touch (r <= gap/2 - 3). Keep `beta1` (map it to receptor markers on heart).

### 10. alpha "Alpha-1 receptors squeeze the smallest arteries", grade 4
Problems: the arteriole is a pink rectangle with two wall lines; "muscle rings" are tall ink ellipses that
stick out past the wall; receptors are white circles above the tube; the nerve ending is an ellipse
lollipop. t=1 named change ("narrower" with arrows) and BP bar are good.
Redraw: arteriole in longitudinal cut-away: three-layer wall (thin endothelium line, thick smooth-muscle
media drawn as a band of spindle-shaped cells wrapping round, a thin adventitia), lumen with
crimson-gradient blood and a few biconcave red cells streaming (speed lowers as lumen narrows; keep the
flow arrow). The far end of the tube shows an elliptical cross-section so the "ring" of muscle is
legible. Sympathetic fibre runs along the adventitia with 2 varicosities (re-use the varicosity
primitive), NE spheres dropping onto small alpha-1 GPCR markers on the muscle cells. Muscle cells
visibly thicken as the lumen narrows. Keep dashed ghost walls at normal width, blue "narrower" arrows,
BP bar + ghost + "higher". Keep parts `arteriole`, `alpha1`, `bp`.

### 11. adrenal "The adrenal glands add adrenaline to the blood", grade 4
Problems: adrenal is a tan triangle on a pink bean without a hilum; the outflow is a pink pipe into a
pink vertical bar labelled "to the whole body"; adrenaline dots are the same red as the nerve.
Redraw: kidney with a proper hilum (renal artery, vein, ureter stubs) and capsule gradient; adrenal as a
pyramidal (right) or crescent (left) cap with a cut face showing yellow cortex rim and darker
red-brown medulla core (label "medulla" with leader: the cells that make adrenaline). The sympathetic
fibre enters the medulla. Adrenal vein drains into the inferior vena cava (drawn as a large vein, deep
venous tone `#7a3a5c`, flow arrow up, label "vena cava, to the heart and whole body"). If the drawn side
is right, the adrenal vein drains straight into the IVC; do not draw the left side (left adrenal vein
goes to the left renal vein). Adrenaline: distinct marker (red-outlined white-core sphere) so it is
told apart from noradrenaline. Keep parts `adrenal`, `adrenaline`. The `<dfn>beta-2 receptors</dfn>`
in this caption has no data-part; leave as is or add one only if a beta-2 marker is drawn.

### 12. pupil "The pupil: a tug of war", grade 5
Problems: decent idea. But the iris is a flat green-grey disc; spokes are thick red sticks and the
sphincter a green dashed ring; the leader lines end on the iris rim, not on the muscle they name; the
sclera almond is huge and empty. Redraw: frontal eye with eyelids and lashes line, sclera gradient,
iris with radial fibrous texture (fine strokes) and a collarette; sphincter pupillae as a narrow
concentric green band hugging the pupil margin; dilator as fine radial red fibres in the outer iris
(thin, many, not 20 bold sticks); corneal highlight. Leaders: "ring muscle" to the sphincter band,
"spoke muscle" to a dilator fibre. Keep the radius animation and `pupil`, `ring`, `spoke` parts.

### 13. airway "The airways: acetylcholine narrows, adrenaline widens", grade 4
Problems: two concentric pink discs with a dashed muscle ring; "air" in a white circle; the blood vessel
is a pink bar with dots; the vagal fibre enters the wall arbitrarily.
Redraw: bronchiole cross-section in histology style: folded mucosa (wavy inner epithelium outline that
folds more as lumen narrows), a smooth-muscle ring of spindle cells, outer connective tissue with a
cartilage plate fragment (bronchus) or none (bronchiole: pick bronchiole and omit cartilage), a small
accompanying arteriole in cross-section beside it carrying adrenaline markers that diffuse to the
muscle. Vagal fibre with varicosities on the muscle ring. Keep the narrow/wide sequence, labels and
parts `airway`, `muscarinic`, `beta2`.

### 14. reflex "Pressure sensors close the loop", grade 4
Problems: the sensors are not drawn: a blue dot on top of a bar stands for the carotid sinus; the bar is
a thermometer; the heart is a valentine; at t=1 "pressure rises" (faded) sits next to a bar that has
already fallen. Redraw: a schematic head-and-neck/thorax: carotid artery with the carotid sinus bulge
and aortic arch with baroreceptor endings (small branching nerve endings in the wall, blue), afferent
fibre (blue dotted) to the medulla (brainstem silhouette), red sympathetic and green vagal efferents to
the anatomical heart. Keep a pressure gauge but as a small dial or the existing bar placed beside the
artery. Fade out "pressure rises" before the bar starts falling (end its opacity by t=.7). Keep parts
`bp`, `reflex`.

### 15. whole "The whole picture" (receptor map), grade 5
This is a chart, and it works: rows, receptor tags, consistent marks. Problems: organ glyphs are tiny
clip art (ring for airway, almond for eye); the enzyme Pac-Man overlaps the header rule; the legend
"red: sympathetic receptors / green: M" repeats information. Lift: each row gets a small consistent
glyph from the shared primitives (heart mini, arteriole segment with wall, bronchiole section, iris);
beat dots with highlights; a pale row band alternation instead of thin rules; move the enzyme icon off
the rule (y <= 40). Keep every hook below.

### 16-22. mag, mant, che, aag, ablock, bag, bblock ("What changes it"), grade 5 (18 and 19: 4)
What works: model-driven, ghost of normal, purple diamond/plug/cross per receptor tag, named changes in
blue on the picture, readout agrees.
Problems:
- Heart row: ghost dashed circles and solid dots overlap at partial offsets (16, 17, 21, 22 at t=1),
  making a mess of rings. Draw the ghost strip on its own baseline 10 units above the live strip (or
  render ghost beats as small ticks on the axis) so they never overlap.
- 21 (bag): at t=1 solid dots grow to touch each other; cap r at gap/2 - 3.
- 18 (che): extra ACh dots (`CL` cluster, rows at y=28) overprint the "parasympathetic" header and the
  enzyme cross sits on the enzyme and the rule. Move the ACh cluster to grow rightward/downward under
  the header (y >= 34) and put the cross beside the enzyme.
- 19 (aag): a fourth ACh dot (reflex) overprints "parasympathetic" too. Same fix.
- 22 (bblock): the arteriole draws narrower (the model's beta-2 vessel term) but the step neither names
  nor captions it. Either add "Arterioles" to `NAMED.bblock` with a word, or confirm with the owner;
  do not leave a silent visible change.
- Organ glyphs as in step 15.
Redraw: keep the map exactly as a layout; upgrade glyphs and fix the overlaps above.

## Reusable primitives this lesson needs
1. `varicosity(x,y,{col,cut})`: axon bead, cut-open with bilayer outline, axoplasm gradient, vesicles,
   mitochondrion; animatable vesicle fusion (omega pore).
2. `bilayerStrip(path,{len})`: two-leaflet membrane with head-dot texture, any orientation.
3. `vesicle(x,y,{col,n})`: translucent sphere with highlight and transmitter dots.
4. `gpcr7tm(x,y,{cap,lit})`: seven-helix receptor spanning a bilayer, binding pocket, G-protein blob
   with a lit state.
5. `transporter12(x,y)`: membrane transporter with a channel for reuptake.
6. `enzymeGlobular(x,y,{open})`: tethered globular enzyme with active-site cleft.
7. `messenger(x,y,{kind})`: ACh (two-lobe, splittable), NE, adrenaline (distinct marker).
8. `heartAnatomic(x,y,{scale,beat,showSA})`: anterior heart, four chambers implied, apex down-left,
   aortic arch, pulmonary trunk, SVC, SA node marker; beat scale on ventricles.
9. `arterioleLong(x,y,{len,radius})`: three-layer wall with spindle smooth muscle, blood gradient and
   RBCs, end cross-section.
10. `bronchioleSection(cx,cy,{lumen})`: folded epithelium, muscle ring, adventitia.
11. `eyeFront(cx,cy,{pupil})`: lids, sclera, textured iris, sphincter band, dilator fibres.
12. `kidneyAdrenal(...)`: kidney with hilum, adrenal with cortex/medulla cut face, IVC.
13. `brainCord(...)`, `sympChain(...)`, `ganglion(...)`, `nerveFibre(path,{dashed,glow})`.
14. `organMini(id)`: small consistent glyphs for the receptor map rows.
15. `leader(from,to,label)`: muted leader with end dot.

## Risks a redraw could break
- Model-driven geometry: steps 15-22 and the Explore tab use `look(o)` from `steady()`; arteriole half
  width, lumen, pupil radius, beat gap/radius and BP bar must still come from `look()`. Do not hard-code.
- Hooks read by tests/kit: `data-new-state`, `data-hr/strength/pressure/arteriole/airway/pupil/ach`
  attributes on the map root, `class="ghost" data-ghost="normal"`, `data-named` groups, `data-part`.
  `#explore-visual` renders the same `mapSvg`, so glyph changes land there too.
- data-part names used by `<dfn>`: nerves, symp, para, gap, messenger, ach, receptor, enzyme, ne,
  "alpha beta" (multi), alpha, beta, reuptake, alpha2, muscarinic, rate, beta1, arteriole, alpha1, bp,
  adrenal, adrenaline, pupil, ring, spoke, airway, beta2, reflex, drug. Keep every one present.
- Timing: synapse scenes use `rest: .56` (reduced motion shows docked state); change scenes ease over
  t .12-.78 and fade words .6-.92; keep these windows.
- Height: synapse scenes 316, heart 296, alpha 340, adrenal 384, pupil 392, airway 394, reflex 364,
  map ky+10 (grows with legend wrap; 21 at t=1 adds a second legend row). Stay <= 420.
- Label overlap traps: playhead in 8/9, ACh cluster in 18/19, enzyme on rule in 15-22, ghost vs live
  beat dots; dense anatomy adds more, so measure at 375 x 553.
- Colour trap: red = sympathetic AND blood. Keep sympathetic as stroke/messenger red and give blood a
  distinct crimson with highlight, or readers will read blood as "sympathetic".
- Accuracy traps: muscarinic and adrenergic receptors are GPCRs (7TM is right, do not draw ion
  channels); nicotinic receptors are out of scope (caption and model exclude them); airway smooth
  muscle has sparse sympathetic innervation (adrenaline via blood); most vessels have no
  parasympathetic supply; right adrenal vein -> IVC, left -> left renal vein; adrenal medulla, not
  cortex, makes adrenaline; SA node sits at the SVC/right atrium junction. Ganglia are not in the
  captions: adding labelled ganglia is a new teaching claim to confirm.
