# The Lab: one art direction for all 23 lessons

Status: specification for the redraw phase. Audited 2026-11-13 from the 23 briefs and the captures in
`audit/shots/` (looked at directly: pressure-volume-loop 1 and 10, frank-starling-cardiac-output 1,
cardiac-action-potential 4 and 13, nephron-diuretics 1, autonomic-synapse 3 and 8,
oxygen-hemoglobin-dissociation 5 and 13, ventilation-perfusion 1 and 2, gastric-acid-secretion 4,
immune-response 2, thyroid-axis 10, coagulation-cascade 5, bacterial-cell-antibiotics 8,
renin-angiotensin-aldosterone 1, blood-pressure-regulation 8). The worked heart is in
`ART-REFERENCE.svg-notes.md`, revision 2 (rendered: `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/heart.png`, phone frame
`/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/frame375.png`, 155 px `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/small.png`, conduction `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/cond.png`).

Revision 2 (2026-11-13) applies the accepted points of three critiques (medical accuracy, medical
illustration, build feasibility). Every point and its decision is in section 9; section 8 is the build order.

**The verdict.** The course has a sound teaching engine (model-driven geometry, honest ghosts, named
changes) dressed in UI tokens: pills for organs, U-cups for receptors, pac-men for enzymes, flat bands
for membranes and vessels, a valentine for the heart. Every lesson draws its own versions of the same
twenty structures, so nothing matches across lessons. The fix is one illustrated textbook: one palette,
one light, one line system and one shared library of anatomically true primitives that every lesson draws
from, while the models, hooks and graphs stay as they are.

Lesson codes used below:
PV pressure-volume-loop, FS frank-starling-cardiac-output, BP blood-pressure-regulation,
RAAS renin-angiotensin-aldosterone, NEPH nephron-diuretics, ADH adh-water-balance,
CA calcium-pth-vitamin-d, ANS autonomic-synapse, CAP cardiac-action-potential,
NMJ neuromuscular-junction, O2 oxygen-hemoglobin-dissociation, VQ ventilation-perfusion, AB acid-base,
COAG coagulation-cascade, INS insulin-glucose, THY thyroid-axis, HPA hpa-axis-steroids,
GAS gastric-acid-secretion, PK pharmacokinetics, AA arachidonic-acid-nsaids, IMM immune-response,
BAC bacterial-cell-antibiotics, CC cell-cycle-chemotherapy.

---

## 1. Principles

**What "industry grade" means here.** A student who has seen Netter, Osmosis, Ninja Nerd or a BioRender
figure must recognise every structure without its label. Concretely:

1. **Silhouette first.** Each organ, cell and protein has its true outline: a heart is conical with its
   apex down and to the viewer's right (the patient's left), four chambers and a septum; a kidney is a
   coronal bean with cortex, pyramids and pelvis; receptors have their true class shape (7TM GPCR,
   pentameric ligand-gated channel, RTK dimer, intracellular nuclear receptor); a channel is its true
   subunit assembly around a pore. If the shape needs a label to be identified, it is not done.
2. **Structure is layered.** Vessels have a wall and a lumen and an elliptical cut face. Cells have a
   membrane, cytoplasm and a nucleus with an envelope. Membranes are bilayers at close range and a
   two-line golden band at icon range. Tissue sits on tissue (epithelium on basement membrane on
   capillary), never floating in panel space.
3. **One light, two shading modes.** Light comes from the upper left of the **picture**, not of each
   shape. **Volume shading is for exteriors** (organ surfaces, the epicardial rim, vessels, cells,
   proteins, free-standing glyphs). **Flat shading is for sections**: a cut face is a flat tone darkening
   slightly toward the outside, a cavity is flat blood with a thin endocardial shadow inside its edge.
   Speculars never sit on a cut face or on pooled blood. No blur in per-frame scenes.
4. **Colour carries meaning, and only one meaning.** Blood is red when oxygenated and a muted venous blue
   when deoxygenated (the convention every reference uses). Venous blue is only ever a filled volume or
   lumen; the kit's saturated blue is only ever a flat stroke, arrow or word, so the two never meet as the
   same kind of mark. Tissues have fixed tones course-wide. The kit's UI accents (blue = the thing taught and
   every change, red = block and harm, purple = drug) are never used as tissue colours.
5. **Clean leaders, clean type.** Chamber and region names may sit inside a large uniform area (the
   textbook convention: RA, RV, LA, LV); everything else sits in a margin column with an ink leader ending
   in a dot on the structure. No overlaps, kit classes only.
6. **Truthful simplification.** Leave out what the caption does not teach, but never draw something
   wrong to make it simpler. A simplification that changes anatomy (a channel moved, a vessel reconnected)
   is an error. Where a 2-D view puts one structure in front of another (the RV outflow in front of the
   aortic root), the front one is drawn in front, at its true connection, and the back one shows where it
   is not covered; nothing is rerouted. Simplifications that remain (hidden right pulmonary veins, a pinned
   apex) are stated in the aria-label or caption.
7. **Motion by t, from the model.** Art primitives are pure functions of their state parameters; lessons
   map `t` and model values onto those parameters. Morphs interpolate paths with identical command
   structure. Model-driven geometry (areas, widths, counts) stays model-driven; the art only changes the
   skin over it.

**The frame.** 480 units wide, at most 420 tall, on the kit panel `#ecefe5`. Every picture keeps 8 units
of clear margin at all four edges. One label column (at most), 150 units or wider when it carries `.sm b`
names such as "Pulmonary trunk"; the art takes the rest. **Label budget first:** before any art is placed,
the picture's labels are measured (section 3) and the art's scale is chosen so the column fits. Pictures that
need labels on both sides use in-region labels for one side.

**Phone legibility.** At 375 px a unit is 0.78 px, and in landscape (852 x 342, picture height capped by
kit.css) as little as 0.65 px. Therefore: text never under 17 units; a stroke that carries meaning is at
least 1.25 units; a glyph that carries meaning is at least 10 units across (molecules at least 8 when
repeated in a row, hemoglobin at least 12); decorative detail (bilayer tails, striations, chordae, granules,
collagen) may be finer (never under 0.9) but must be removable and must never be the only cue.
**Level of detail follows the rendered size, not `s`:** detail elements carry the class `ax-d2` or `ax-d3`
and a CSS container query on `.lx-pic` hides `ax-d2` below about 300 px of picture width and `ax-d3` below
about 200 px, with no JS. A primitive's `emphasis` option (for example `['mitral', 'aortic']`) lifts named
parts to the outline tier and keeps them at every size, because the part that is the lesson must never drop
out.

**Motion.** Only `t` moves a picture (FORMAT.md). Flows are dash offsets driven by a `phase` parameter that
loops seamlessly in [0, 1). Heartbeats, squeezes and openings are eased with the kit's `ease.inOut`.
Reduced-motion `rest` frames must be legible stills of the key state; re-check each one after a redraw.
Per-frame string scenes stay light: gradients are shared defs (never generated per molecule or per
frame), small repeated glyphs are inlined paths (each `<use>` clones a shadow tree on every rebuild, so
`<symbol>` and `<use>` belong to mount scenes, where only transforms change), and heavy pictures move to
`mount(host)` with `set()` updating attributes. Budget: 6 ms main thread per frame at 4x CPU throttle on the
densest step (`tools/art-bench.mjs`); a whole recipe heart rebuilt as a string measured 1.3 ms median.

---

## 2. Palette

All values exact. Each material has `hi` (lit side), `base`, `lo` (shadow side) and `line` (its outline,
always a dark shade of itself, never ink black). How volumes and sections are shaded is in section 2.6.
Text colours are only the kit text classes. **Every hex lives in `P` (`lab/kit/art/core.js`)**; art code
and redrawn lessons name `P` entries, never literals (lint, section 7). The tables below are the output of
the generation rule in section 2.8: they are the starting targets, and `tools/palette.mjs` regenerates
them by that rule; the generated values replace these. A new material is generated, never hand picked.

### 2.1 Kit UI accents (unchanged, `lab/kit/draw.js` `C`)

| Role | Hex | Use |
|---|---|---|
| ink | `#171916` | text, leader lines, axes, the default ghost dash on graphs |
| blue | `#254dff` | the thing being taught, every change arrow and change word, activation washes |
| blueWash | `#d1d8fd` | highlight behind a taught part; activation wash at 45 % |
| red | `#b3261e` | blocks, harm, inhibition T-bars, "danger" text. **Not blood.** |
| redWash | `#f3d9d4` | harm zones on gauges |
| amber | `#a34700` | text for sodium, warnings, brake words |
| green | `#2c6a2c` | text for potassium, "healthy band" words |
| purple | `#6b3fa0` | drugs: text and drug-glyph outline |
| muted | `#53584d` | secondary text, descriptors |
| ghost | `#8a8f84` | the dashed normal ghost on **graphs** only. On art the ghost uses muted `#53584d` over a panel underlay (section 2.7), because `#8a8f84` measures 1.04:1 on myocardium |
| rule | `#babeb3` | hairline separators |
| panel | `#ecefe5` | picture background and text halo |
| paper | `#f7f7f2` | inset lens backgrounds |
| **teal (new)** | `#0b6b70` | text for calcium; add `.visual text.teal{fill:#0b6b70}` to kit.css |

Contrast on `#ecefe5` (computed): ink 15.2, muted 6.3, blue 5.0, red 5.6, amber 5.2, teal 5.4, green 5.6, purple 6.3.
All pass 4.5:1 for text. Art fills need no text contrast because no text sits on art; graphical contrast
(3:1) is carried by each material's `line`.

### 2.2 Blood

| Material | hi | base | lo | line | Notes |
|---|---|---|---|---|---|
| Oxygenated blood | `#e2685b` | `#c8352f` | `#8e1e1f` | `#6e1518` | cut-face lumen `#7a1a1a` |
| Deoxygenated blood | `#6f84c0` | `#3e5196` | `#24305e` | `#1b2448` | muted venous blue, always a filled volume or lumen; cut-face lumen `#24305e`. Plum is retired |
| Mixed / capillary | linear gradient oxy base to deoxy base along the flow | | | | lung capillaries run deoxy to oxy |
| Plasma (lumen with a cell field) | `#f8e6cf` | `#f2dcc0` | `#e0c39f` | `#b08a5e` | straw; used when RBCs are drawn individually |
| Red blood cell | rim `#c0342d`, centre `#e0705f` | | | `#7d1d1c` | deoxy RBC rim `#8a3a52`, centre `#b0697e` (darker, bluer red; an RBC is never drawn blue) |

Blood against the kit accents, one rule for both colours: **blood is a fill, a kit accent is a flat mark.**
Oxygenated `#c8352f` against kit red `#b3261e`, and venous `#3e5196` against kit blue `#254dff`: blood is
always a filled lumen or volume (shaded per section 2.6), the accents are only strokes, arrows, T-bars,
crosses and words. Never draw a block cross in blood red, never fill a vessel with kit red or kit blue,
never draw a change arrow in venous blue.

### 2.3 Tissues and organs

| Material | hi | base | lo | line |
|---|---|---|---|---|
| Myocardium (cut face and exterior) | `#efc6b4` | `#d9a08f` | `#a86a5c` | `#6e3a30` |
| Myocardium, septum (one step darker, so it reads on its own) | | `#cb8d7b` | | `#6e3a30` |
| Skeletal muscle | `#e3a49a` | `#c46b62` | `#8f3d38` | `#5e2522` |
| Smooth muscle (spindle cells) | `#f0c2b0` | `#dc9c88` | `#b06b5a` | `#7d4536` |
| Artery wall (tunica media) | `#f6dfd6` | `#ecc9bd` | `#c9958a` | `#8a4a40` |
| Endothelium / intima lining | `#fbf1ec` | `#f8ece6` | `#e8d2c8` | `#b98a80` |
| Adventitia | `#f2e6d6` | `#e7d6c3` | `#c9b49a` | `#8f7a5e` |
| Vein wall (thin, blue-grey) | `#eef0f6` | `#d6dbe8` | `#aeb6cc` | `#4a5378` |
| Capillary wall | `#f8e3dd` | `#f3d7d0` | `#d9aea4` | `#a8655c` |
| Valve, chordae, tendon, fibrous tissue | `#fbf3e4` | `#efe1c8` | `#e3d0b0` | `#8a6d4e` |
| Conduction tissue (SA, AV, His, Purkinje) | `#f2d77a` | `#e2c044` | `#b8952a` | `#7a5a00` |
| Cytoplasm (generic cell) | `#fdf3ec` | `#f6e3d6` | `#e9c9b5` | `#a9826a` |
| Nucleus (euchromatin, hematoxylin blue-grey) | `#97a1c4` | `#6b78a6` | `#4c5682` | `#343c5e` |
| Nucleolus / condensed chromatin | | `#3f4870` | | `#272d48` |
| Mitochondrion | outer `#d98a5a`, matrix `#f2b98f` | | cristae `#b8643a` | `#8a4a26` |
| ER / Golgi stacks | | `#c6b6e0` | | `#7d6aa8` |
| Secretory granule | | per cargo (section 2.5) | | cargo `line` |
| Lipid droplet / adipocyte | `#fdf0c2` | `#f7e3a3` | `#e0c46e` | `#a8892f` |
| Bone, cortical | `#fbf6e9` | `#efe3c6` | `#cdb98e` | `#8f7a52` |
| Bone, trabecular | | `#e6d6b0` | | `#8f7a52` |
| Red marrow | `#de8a7c` | `#c9665a` | `#9a4038` | `#6e2a24` |
| Cartilage | `#ebf3f5` | `#d9e6ea` | `#b4c9cf` | `#7f9aa3` |
| Nerve / axon (Netter yellow) | `#fff7d6` | `#f6e3a2` | `#d9bd6a` | `#8f7430` |
| Myelin / Schwann cell | `#ffffff` | `#fbfbf3` | `#e6e4d2` | `#a9a58a` |
| Brain grey matter | `#f1d9d4` | `#e6c3bd` | `#c79a93` | `#8f625c` |
| Brain white matter | | `#f7eee8` | | `#c9b2a8` |
| Pituitary, anterior lobe | `#e8b49a` | `#d99a7a` | `#b0705a` | `#7a4634` |
| Pituitary, posterior lobe | `#f2dcc4` | `#e8c9a8` | `#c9a47e` | `#8a6a4a` |
| Thyroid | `#d77b6e` | `#b8574e` | `#8a3a33` | `#5e2420` |
| Thyroid colloid | | `#f3d39a` | | `#b8924a` |
| Parathyroid | `#f0cc78` | `#e0b04f` | `#b48828` | `#7a5a10` |
| Adrenal cortex | `#f5d27a` | `#e8b84a` | `#c08f2a` | `#7d5a10` |
| Adrenal medulla | `#b87a5a` | `#9a5a3a` | `#6e3a22` | `#4e2614` |
| Kidney cortex | `#c9705f` | `#b05445` | `#7d3229` | `#5a2018` |
| Kidney medulla (pyramids) | `#a24a40` | `#8f3a33` | `#6f2a25` | `#4e1a16` |
| Renal pelvis, ureter, bladder lining | `#f8ecdc` | `#f0dcc8` | `#d6bc9e` | `#a68a6a` |
| Liver | `#b8574a` | `#8f3b33` | `#63241f` | `#4a1814` |
| Gallbladder | | `#7f9a4a` | | `#4a5e22` |
| Pancreas (exocrine) | `#f8dfbd` | `#efc9a0` | `#d6a774` | `#9a7040` |
| Islet (endocrine) | | `#f6e6d0` | | `#b89a6a` |
| Stomach / gut mucosa | `#f2aaa2` | `#e58c86` | `#c86b66` | `#8a3e3a` |
| Gut muscularis / serosa | `#efb7aa` | `#e8a59a` | `#c9776c` | `#8a4a40` |
| Mucus gel | `#e6f4f1` | `#d6ece9` | `#aacfc8` | `#6f9f97` (fill at 80 %) |
| Lung parenchyma | `#f7d3cf` | `#eab3ad` | `#c98480` | `#a85c58` |
| Alveolar wall | | `#e79a93` | | `#a85c58` |
| Skin, epidermis | `#f8dccb` | `#f0c7a8` | `#d9a582` | `#9a6a48` |
| Skin, stratum corneum | | `#e2b48f` | | `#9a6a48` |
| Skin, dermis | `#fbe9e1` | `#f6dcd0` | `#e3bfb0` | `#a9806e` |
| Collagen fibres (texture) | | `#e8bfb3` at 50 % | | |
| Bacterium cytoplasm | `#eef3df` | `#d6e2b6` | `#a9bb7f` | `#5e6e34` |
| Peptidoglycan wall | `#e4cc8a` | `#c8a75a` | `#9a7a30` | `#6a5016` |
| Neutrophil / granulocyte cytoplasm | | `#f3e3ea` | | `#a87f93` (granules `#d7a7c5`) |
| Lymphocyte cytoplasm (thin rim) | | `#d6e4f2` | | `#7f93a8` |
| Macrophage cytoplasm | | `#efdcc8` | | `#a6825e` |
| Plasma cell cytoplasm | | `#cfd6ef` | | `#7c86b0` |
| Platelet | `#f6eef9` | `#e4d3ee` | `#c3a9d6` | `#7d5a9a` (granules `#8e6bb5`) |
| Fibrin | | `#f1e4a8` | | `#9a8a3a` |

**Vessel rule.** Wall material is chosen by **vessel type**, lumen colour by **oxygenation**. Pulmonary
trunk and arteries: artery wall (thick) with a deoxygenated lumen. Pulmonary veins: vein wall (thin) with an
oxygenated lumen. Umbilical vessels follow the same rule if ever drawn.

**Outline rule.** Any material under 1.5:1 against the panel (endothelium, extracellular fluid, bilayer
core, air, valve, plasma) always carries its `line` outline. Any material under 2:1 against the material it
sits on carries a 1.5-unit panel-coloured separation outline (for example the renal artery and vein at the
hilum against kidney cortex). The "tissue against the blood it carries" pairs (myocardium against both
bloods, kidney cortex against the renal vessels, liver against portal blood, lung against both bloods) must
measure 2:1 or more; a check computes them from `P`.

Fluids and spaces (flat tints, no gradient):

| Space | Fill | Edge |
|---|---|---|
| Extracellular / interstitial fluid | `#e2ecec` | none (it is the background inside tissue insets) |
| Tubular filtrate / urine | `#f4ecc4` | lumen wall carries the edge |
| Gut and stomach lumen | `#efe3c8` | |
| Alveolar and airway air | `#f4f9fb` | wall carries the edge |
| Inset lens background | `#f7f7f2` (paper) | lens rim `#53584d` 1.5 |

### 2.4 Membranes

| Part | Hex |
|---|---|
| Lipid head (sphere) | hi `#fff1d8`, base `#f2c98a`, lo `#c9974f`, line `#9a6e33` |
| Lipid tails | stroke `#c8b48e` 0.8 units on core `#f6edd8` |
| Bilayer core band (when `ax-d2` detail is hidden) | `#f6edd8`, edges `#c9974f` 1.4 units |
| Membrane protein body (generic) | hi `#cfe0d2`, base `#9fc2a8`, lo `#6e9a7a`, line `#3e6a4a` |
| Membrane protein, alternate (second protein in one picture) | hi `#d9d4ee`, base `#b3a9dc`, lo `#8478b8`, line `#4e4486` |
| Glycosylation / extracellular sugar | `#e8d48a` beads |

Proteins are sage by default so they never read as drug (purple), change (blue) or harm (red). A
protein that is the taught subject may take the blueWash halo, never a blue fill.

### 2.5 Ions, molecules, messengers, drugs

Each glyph has a fixed **shape** as well as colour, so the course stays readable for colour-blind
students. Every glyph has its `line` outline and a 1-unit inner highlight.

| Species | Shape | Fill | Line | Text class |
|---|---|---|---|---|
| Na+ | circle | `#e09a2b` | `#8a5a10` | amber |
| K+ | triangle (point up) | `#4c9a3f` | `#24561c` | green |
| Ca2+ | rounded square | `#12838a` | `#0a4f54` | teal (new) |
| Cl- | diamond | `#8a9bb0` | `#4a5a6e` | muted |
| H+ | small circle (r 0.7 of Na) with a plus | `#d23f78` | `#7a1a44` | ink |
| HCO3- | trefoil (centre dot and three lobes) | `#1e9ac0` | `#0c5a73` | ink |
| Phosphate | ring | `#b98a3a` | `#6a4a12` | ink |
| O2 | dumbbell, two spheres | O `#e45b4f` | `#8e1e1f` | ink |
| CO2 | linear three spheres | O ends `#e45b4f`, C centre `#4a4f57` | `#2b2e33` | ink |
| CO | dumbbell | C `#4a4f57`, O `#e45b4f` | `#2b2e33` | ink |

One atom colour per element across the course: oxygen is always `#e45b4f`, carbon always `#4a4f57`. The
shapes (two, three, two unequal spheres) carry the identity.
| Water | drop | `#8cc8e8` | `#2f6f94` | ink |
| Glucose | hexagon ring with one O vertex dot | `#f0b429` | `#8a6100` | ink |
| Amino acid / peptide bead | bead | per hormone | | |
| Drug (any) | family glyph (section 4, molecules.js) | `#8a63c2` hi `#b59be0` | `#4b2a78` | purple |

Messengers (hormones, transmitters, mediators) take one course-wide colour each, chosen away from the UI
accents and from the ions they meet in the same lesson:

| Messenger | Hex | Glyph |
|---|---|---|
| Acetylcholine | `#c2577a` rose | two-lobe (choline + acetate, splittable) |
| Noradrenaline | `#9a6a1a` bronze | sphere (dark, so it never reads as conduction-tissue yellow) |
| Adrenaline | `#9a6a1a` bronze with a white core dot | sphere with core |
| Histamine | `#e07b39` orange | small ring with tail |
| Insulin | `#2a7f62` deep teal-green | two-chain bead glyph (A and B chains, 2 links); never a blue (it read as "change"). Calcium shares the teal hue family but is a rounded square; in INS they meet only in the beta-cell step, where shape and the text class separate them |
| Glucagon | `#8a3a2a` red-brown | single bead chain |
| GLP-1 | `#7a8a2a` olive | short bead chain |
| ADH (vasopressin) | `#5f86a8` slate, lighter than bicarbonate | 6-bead disulfide ring (Cys1 to Cys6) plus a 3-bead tail: 9 beads, count-accurate |
| Angiotensin I / II | `#b0603a` | 10 / 8 beads (count-accurate) |
| Renin, ACE (enzymes) | membrane protein alternate | enzyme glyph |
| Aldosterone | `#3f8f5f` | steroid 6-6-6-5, filled |
| Cortisol | `#d08a1a` | steroid, filled |
| Cholesterol | `#c9b48e` | steroid, muted, with tail |
| Glucocorticoid drug | drug purple outline, cortisol fill at 30 % | steroid, hollow |
| T4 / T3 | `#c98a2a` rings, iodine `#7a3fa0` balls | thyronine with 4 / 3 iodines |
| TSH, ACTH, CRH, TRH | `#8f6ac0`, `#c06a8f`, `#6aa0c0`, `#6ac08f` | small bead clusters; TRH is a tripeptide and is drawn as exactly 3 beads |
| PTH / calcitriol / calcitonin | `#7f5ab8` hexagon / `#c9a227` triangle / `#3f8f8f` square | token set from CA, restyled. Calcitriol is a secosteroid (open B ring): it keeps its triangle token and never uses the 6-6-6-5 steroid glyph |
| Prostaglandins / thromboxane / leukotrienes | `#d08a3a` / `#b85a5a` / `#5a8ab8` | ring glyph / ring glyph / linear chain |
| Cytokines (TNF trimer, IL-2) | `#d4733a` / `#9a6ac0` | trimer / dot |
| Arachidonic acid | `#b8892a` | C20 hairpin with 4 kinks |

Where a lesson's existing colour code already teaches a meaning (for example CAP's Na amber, K green), the
table keeps it. CAP's calcium moves from red to teal: update its badges, text classes and aria wording.
Water is the drop glyph `#8cc8e8` with ink text, never kit blue (NEPH's `WATER = C.blue` changes).
Hue pairs that meet in one lesson must differ in shape **and** in lightness (OKLCH L difference 0.15 or
more) or hue (30 degrees or more); a check runs this per lesson over the glyphs it imports.

### 2.6 Shading recipe

- **Exteriors (volume).** Organ surfaces, the epicardial rim, cells, proteins and glyphs over 14 units. The
  light is shared: large exteriors (an organ, a heart) get a `userSpaceOnUse` linear or radial gradient
  positioned from the picture's light (upper left) and built once per instance (`uid()`), so every surface in
  the picture is lit from the same place. Small free-standing glyphs may share one `objectBoundingBox`
  radial gradient per material (`cx .35 cy .3 r .85`, stops hi / base / lo at 0 / .6 / 1) **only if they are
  never rotated or mirrored**; rotated glyphs (receptors on curved membranes) snap to four pre-built variants
  with a counter-rotating `gradientTransform`, made once in `artDefs()`.
- **Sections (flat).** A cut face is one flat tone with a slight darkening toward the outside (a large
  user-space radial gradient, centre to edge `base` to a step darker). A cavity is flat blood plus an
  **endocardial shadow**: the cavity's `lo` at 45 %, a 5-unit stroke clipped to the cavity (2.5 units
  visible), no blur. Septa one step darker than free walls. An exterior rim (3 to 5 units, volume-lit)
  surrounds a cut organ so it still reads as a solid.
- **Speculars**: one soft ellipse per exterior volume, white at 18 to 22 %, in the upper-left quarter, about
  a fifth of the volume. Never on a cut face, never on blood, never on icons.
- **Tubes** (vessels, tubules, axons, airways): layered strokes on one centreline: outline (`line`, total
  width), wall (`base` of the wall material), lumen (model-driven width), then a highlight stroke 2.5
  units, white 25 to 30 %, offset toward the light (`offsetPath`). **Never a gradient on a stroke** (a
  straight stroke has a zero-height box and paints nothing); `fill(mat)` is only ever used for fills.
- **Joins**: a tube entering a chamber uses `tube({ into: shapeD })`, which clips the tube at the chamber
  edge and draws a lumen-coloured mouth that erases the cut edge; no hand-placed patch rectangles.
- **Depth tier**: `behind(art, k = .3)` mixes a structure's colours `k` toward the panel for structures that
  pass behind others (descending aorta behind the heart). `occlusionBreak(d)` draws a 2-unit panel-coloured
  gap on the near structure's edge where a far one passes behind it.
- **Cut faces**: ellipse with the wall ring in the wall `hi` and the lumen in the lumen `lo`, ratio of axes
  0.3 for a perpendicular cut.
- **Contact shade**: where one structure rests on another, a 2.5-unit band of the lower structure's `lo` at
  35 % along the contact edge. No blur.
- **Texture** (only where the rendered size allows, class `ax-d2`, opacity at most .35): striation on
  skeletal muscle exteriors, wavy collagen in dermis and adventitia, fine ribosome stipple in bacteria,
  lobule hatching on liver. Patterns are user-space and built once per mount (or once per still).
- **State shading**: a squeeze or activation darkening is an overlay path (`lo` at `0.12 * k`) over the
  part's territory. Shared gradients never change per frame.
- **Drop shadow**: `ax-lift` (`feDropShadow dx 0 dy 1.5 stdDeviation 1.2 flood-opacity .22`) only on a
  top-level group **whose geometry never changes** (a still, or a mount scene's fixed silhouette). A moving
  outline fakes it with a `lo` copy of its path offset 1.5 units at 22 %. Never on string scenes, never on
  text.

### 2.7 Stroke tiers

Two kinds of stroke. **Weight strokes** (outlines, internal edges, detail, leaders) keep the same on-screen
weight at any scale: primitives divide them by their `s` (or set `vector-effect="non-scaling-stroke"`).
**Geometry strokes** (tube walls and lumens, which are model widths) are never compensated.

| Tier | Width | Colour | Use |
|---|---|---|---|
| T1 outline | 1.75 | material `line` | the silhouette of an organ, cell, vessel, protein |
| T2 internal | 1.1 | material `line` at 70 %, or the lining tone | septa edges, organelle edges, cut faces |
| T3 detail | 0.9 | material `lo` or `line` | chordae, striations, bilayer tails, fibres; class `ax-d2` |
| Leader | 1.25 | ink `#171916` | label leaders, with a 2.5-radius ink dot at the target |
| Flow / signal | 2.5 to 3.5 | kit colours | kit `arrow` / `arrowFixed` |
| Ghost on art | underlay 3, panel `#ecefe5` at 85 %; dash 1.6, `#53584d`, dash 5 4 | | outline only, drawn **above** the art; every stateful primitive exports `outline(state)` for it |
| Ghost on graphs | 3, dash 6 5 | ghost `#8a8f84` | dashed normal curve or bar, under the live mark |

Ink black outlines on art are retired. Ink is for type, leaders and axes.

### 2.8 Palette generation rule

Materials come from about 12 hue families defined in OKLCH (blood red, venous blue, muscle rose-tan, fibrous
cream, nerve yellow, gland amber, kidney brown-red, liver brown, mucosa pink, lung rose, bacterial olive,
membrane sage). For a material with base lightness L: `hi` = L + 0.12, `base` = L, `lo` = L - 0.12, `line` =
L - 0.30, same hue, chroma reduced 20 % at `hi` and `line`. `tools/palette.mjs` generates `P` from the family
table and writes the tables above as its output; hand edits to `P` are not allowed. It also runs the contrast
checks in sections 2.3 and 2.5.

---

## 3. Typography and labelling

- **Sizes come only from the kit classes**: default 20, `.sm` 18, `.xs` 17, `.lg` 24, plus `.b` and the colour
  classes. No inline `font-size`, no `transform: scale` on any group that contains text.
- **Hierarchy.** Picture title (when used): `.lg`. Structure names: `.sm b`. Descriptors under a name:
  `.xs muted`. Change words: `.sm b blue` with a blue arrow. Drug names: `.sm b purple`. Harm: `.sm b red`.
  Ion and messenger names use their text class from section 2.5.
- **Placement.** Labels live in one margin column or in clear panel space. **In-region labels** are the
  textbook convention and are allowed for chambers and regions: a short name (`RA`, `RV`, `LA`, `LV`,
  "cortex", "lumen") inside a uniform area at least twice the text box in both directions, in white `.b`
  on dark fills or ink with the panel halo on light fills, kept clear of every moving part at every t.
- **Leaders.** For valves, vessels, nodes and small parts. 1.25-unit ink line from 6 units off the text
  box to a 2.5-radius ink dot at least 4 units inside the target. Straight, or one elbow (horizontal first,
  then one diagonal at 30, 45 or 60 degrees). Leaders never cross each other, another label, a moving
  lane or another leader's target; crossing the body of the organ that contains the target is allowed (it
  is unavoidable for interior targets). Order labels in a column by their targets' y so leaders do not
  cross.
- **Columns.** One aligned label column (anchor start on the right, anchor end on the left), 150 units or
  wider for `.sm b` names. At most about six column labels per picture; extra names go in the caption or an
  inset. The label budget (measured widths of every label in the picture) is computed before the art's
  scale is chosen.
- **Collision rule.** Text boxes keep 4 units from each other and from every dot, arrow and line they do not
  belong to, at every `t` (check 0, 0.35, 0.7, 1 and the rest frame), not only at t = 1. Moving parts get a
  reserved lane that no label enters. Labels are laid out **once per scene** over the union of the art's
  boxes at t = 0, .35, .7 and 1, then cached; `placeLabels` never runs per frame (labels would jitter).
- **Halo.** The kit's panel halo (paint-order stroke) stays on. Inside a paper-coloured lens use
  `.on-white` with the paper fill. Never put white text inside cells (`.in-cell` is retired for art).
- **Words.** Only terms the caption uses. Do not add labels such as ENaC, ROMK, AT1, AQP3, NFAT, CYP names,
  zona names, internodal tracts or ganglia names unless the caption is extended to teach them.
- **Measure, do not estimate.** Label placement uses measured widths: `art/metrics.js`, a per-class glyph
  width table measured from the real Space Grotesk in Chrome by `tools/measure-type.mjs` and committed,
  never a flat 9.4 units per character.
- **Words follow the art everywhere.** When the art changes, every text that names a shape or colour
  changes with it: aria-labels and scene strings, and also captions in `index.html`, `plan.json` and quiz
  text (twelve lessons' captions name colours or shapes today, for example "The blue line" in NEPH).

---

## 4. The shared illustration library: `lab/kit/art/`

Plain ES modules, no dependencies beyond `../draw.js`. (`_headers` already serves `/lab/*` with
`no-cache`, so the directory is not a cache device.) **Imports are always unversioned and by one absolute
spelling**, `/lab/kit/art/<name>.js`: the same module imported as `x.js` and `x.js?v=2` becomes two module
instances with two `uid` counters. A lint fails on `art/*.js?v=`; `?v=` stamps stay on lesson entry files.
The off-kit lessons load it as follows: CA imports from its `app.js` module (after its move to 480 x 420,
a prerequisite, section 6); ADH, whose eight files are classic `defer` scripts, gets
`<script type="module" src="/lab/kit/art/global.js">` placed before them, which assigns `window.LabArt`
(module and defer scripts run in document order from one queue, so the global exists before `picture.js`).

### 4.0a Scope: what is shared, what stays in the lesson

The shared library holds `core.js` and only the primitives with **three or more lesson users**, each signed
off for accuracy against its module's "Accuracy" list before any lesson uses it. Everything else in the
tables of 4.2 to 4.13 is a **lesson-local drawing spec**: it is drawn in that lesson's `app.js` from
`core.js` helpers and the palette, to the same spec, and is promoted to the library on its third use.
The first shared set (about 25):

| Module | Shared primitives |
|---|---|
| `heart.js` | `heartSection`, `heartExterior`, `heartIcon`, `mountLeftHeart` (2 users but the most-seen drawing), valve helpers |
| `vessels.js` | `vessel`, `vesselSection`, `capillaryBed`, `streamline`, `flowArrow` |
| `cell.js` | `bilayer`, `membraneBand`, `gpcr`, `channel`, `transporter`, `vesicle`, `cellBody`, `nucleus`, `epithelium`, `enzyme`, `nuclearReceptor` |
| `blood.js` | `rbc`, `rbcStream` |
| `kidney.js` | `kidneySection`, `tubuleCellRow`, `walledTubule` |
| `lung.js` | `alveolus`, `alveolarCapillary` |
| `molecules.js` | `ion`, `peptide`, `steroid`, `drug`, small molecules |
| `chart.js` | all helpers (every lesson with a graph) |

One-user primitives listed later (`carotidBifurcation`, `vqConfluence`, `exudate`, `hairFollicle`, `crypt`,
`standingFigure`, `lymphNode`, `mhcTcr`, `urineCup`, `eyeFrontal` and the like) are lesson-local.

### 4.0b Conventions for every primitive

- **Common options**: `{ x = 0, y = 0, s = 1, rot = 0, flip = false, emphasis = [], parts = {}, key }`.
  `x, y` place the primitive's **anchor** (stated per primitive); `s` scales from its native box (level of
  detail is not chosen from `s`; it follows the rendered size through CSS, section 1); `parts` renames emitted data-part names so a lesson keeps its existing
  `<dfn>` targets (for example `heartSection({ parts: { lv: 'ventricle' } })`); `key` makes per-instance
  ids stable in mount scenes.
- **Return types.** One type everywhere:
  - *Art* (every primitive): `{ svg, box: [x, y, w, h], at: { name: [x, y] }, outline(state) }`, with
    `toString()` returning `svg`, so `${heartIcon()}` works inside template strings. `box` and `at` are in
    picture coordinates after placement; `at` gives leader targets and attachment points; `outline()`
    returns the path the art ghost draws.
  - *Mount* is used only where a scene needs it (`mountLeftHeart`): `{ el, box, at, set(state) }`, built
    once inside a parent `<g>` with an `artContext` (section 5); `set()` only writes attributes (`d`,
    `transform`, `opacity`, `stroke-dashoffset`), never markup, and is idempotent.
- **State parameters** are numbers 0 to 1 unless stated, named for what they mean (`open`, `squeeze`,
  `volume`, `phase`, `activation`), and the primitive is a pure function of them.
- **Geometry exports.** Any primitive whose shape is model-driven also exports its geometry functions
  (`area(s)`, `sizeForArea(a)`, `centreline()`), so lessons and tests can assert the contract.
- **Emitted parts.** Defaults are listed per primitive. Every emitted part is a **leaf** `<g data-part>`
  that wraps the whole visible structure, filled shapes included. **Parts never nest** (the kit dims every
  `[data-part]` to .22 and opacities multiply, so a lit child inside a dimmed parent stays dim); a lint fails
  on nested `data-part`. Where a structure belongs to two names, use the kit's multi-name form on the leaf
  (`data-part="septum lv"`). Filled organs are split into territories so each part lights its own muscle
  (heart: LV free wall, RV free wall, septum, atrial walls, each named with its chamber). `parts` renames map
  onto these names, so PV keeps `ventricle`.
- **Detail classes.** Detail elements carry `ax-d2` / `ax-d3` (section 1); `emphasis: [names]` lifts named
  parts out of them.

### 4.1 `art/core.js` (foundation, used by every lesson)

| Export | Signature | Notes |
|---|---|---|
| `P` | palette object: `P.oxy = { hi, base, lo, line }`, etc. for every row of section 2 | single source of hex values |
| `artDefs(used)` | `(markup or Set) => string` | emits only the `ax-*` defs the body references (scans for `url(#ax-`); the full set is about 15 to 18 KB, so never send it whole |
| `artContext(svgEl)` | `(SVGElement) => { url(mat), id(base), html(markup) }` | for mount scenes and lessons with their own `<svg>`: injects `artDefs()` once with a per-svg prefix; `html()` scopes string primitives and parses them into the SVG namespace (`insertAdjacentHTML` on an SVG `<g>`) |
| `fill(mat)` | `(name) => 'url(#ax-name)'` | the only way art refers to a shared gradient; **fills only**, never strokes (lint) |
| `light(box)` | `([x, y, w, h]) => gradient attrs` | user-space gradient coordinates for an exterior, from the picture's one light |
| `behind(art, k = .3)` | Art | depth tier: mixes the art's colours `k` toward the panel |
| `occlusionBreak(d)` | string | 2-unit panel-coloured gap on a near edge where a far structure passes behind |
| `innerShadow(d, mat)` | string | the endocardial / inner-edge shadow (5-unit `lo` stroke at 45 %, clipped), no blur |
| `rim(d, mat, w = 3)` | string | exterior rim around a cut organ, volume-lit |
| `uid(base)` | `(base) => 'ax-<base>-<n>'` | per-instance ids (clip paths, masks) |
| `scopeIds(markup, prefix)` | `(string, string) => string` | rewrites `id="ax-`, `url(#ax-`, `href="#ax-` (section 5) |
| `SW` | `{ outline: 1.75, internal: 1.1, detail: .9, leader: 1.25 }` | weight strokes (section 2.7); geometry strokes are never in `SW` |
| `D2`, `D3` | `'ax-d2'`, `'ax-d3'` | detail classes hidden by the `.lx-pic` container query |
| `place(art, { x, y, s, rot, flip })` | wraps markup in one transform and maps `box` / `at` | |
| `tube(d, { wall, lumen, w, lumenW, highlight = true, cut, into, sinus })` | Art | layered-stroke vessel or tubule along any path; `cut: 'start' or 'end' or 'both'` adds cut faces; `into: shapeD` clips the tube to a chamber and draws the mouth; `sinus: true` adds three lobes at 1.25 x the diameter (aortic root) with the wall rim continuous |
| `cutFace(x, y, rx, ry, { wall, lumen, rot })` | Art | |
| `offsetPath(d, dist, n = 48)` | string | sampled parallel path for highlights and walls |
| `smooth(points, { closed })` | string | Catmull-Rom to cubic Bezier |
| `lerpPath(a, b, t, { n })` | string | interpolates two paths with identical command structure; with `n`, resamples both to `n` points first so hand matching is not needed (shapes whose outline changes: goitre, ulcer, scarring, apoptosis, envelope breakdown). If the topology changes, cross-fade on stills only |
| `sampleAlong(d, n)` | `[[x, y, angle]]` | for particles, beads, chordae ends |
| `blob(cx, cy, r, { lobes = 0, wobble = .08, seed })` | string | seeded organic outline (cells, granules, clots) |
| `spec(x, y, rx, ry, rot)` | string | the specular ellipse |
| `contactShade(d, mat)` | string | |
| `leader(from, to, { elbow })` | string | 1.25 ink line plus target dot |
| `placeLabels(items, { column, side, minGap = 4, keepOut })` | `[{ x, y, anchor, leader }]` | stacks labels by target y, avoids `keepOut` boxes and each other; run once per scene over the union box (section 3) |
| `labelBudget(items)` | `{ width, fits(scale) }` | measured widths from `metrics.js`, run before the art's scale is chosen |
| `magnifier({ from: { x, y, r }, to: { x, y, r }, body })` | Art | inset lens: rim, paper fill, tangent connectors, clip; parts `inset` |
| `inhibit(d, { w })` | string | red T-bar connector with fixed bar size, model width |
| `activationWash(clipD, k)` | string | blue wash clipped to a shape, growing with k |

Used by: all 23.

### 4.2 `art/heart.js` and `art/vessels.js` (heart and vessels)

| Primitive | API | Native box, anchor | Parts emitted (defaults) | Returns | Used by |
|---|---|---|---|---|---|
| `heartSection` | `({ valves: { tricuspid, mitral, aortic, pulmonary } open 0..1, volume: { lv, rv } area fraction 0.30..1.25, squeeze, conduction: false or { sa, atria, av, his, bundles, purkinje } 0..1, flow: false or { inflow, outflow, phase }, rvot: 'solid' (default) or 'ghost' (18 %, set automatically with conduction) })` | 240 x 280, top-left | `ra rv la lv septum tricuspid mitral aortic-valve pulmonary-valve aorta pulmonary-trunk vena-cava pulmonary-veins conduction sa av` | Art | CAP (13, 1), BP (1, 4), O2 (inset), ANS, FS (whole-heart view) |
| `mountLeftHeart` | `(g, ctx, { refs: [sizeA, sizeB], mark: 'preload' or 'afterload' or 'contractility', emphasis: ['mitral', 'aortic'] })` then `set({ size or volume, mitral, aortic, squeeze, inflow, outflow, phase })` | about 160 x 260, top-left; a **separate left-heart long-axis drawing** with its own fixed outer surface and area table (not a crop of the section) | `atrium mitral ventricle aortic aorta` (PV names) | Mount | PV (all 18), FS (1 to 5, 9, insets) |
| `lvGeometry` | `{ cavity(s), area(s), sizeForArea(a), wall(s, M), refOutline(s) }` | | | functions | PV, FS |
| `heartExterior` | `({ beat 0..1, sa = true, coronaries = true, apexGlow })` | 200 x 230, top-left | `heart sa aorta pulmonary-trunk vena-cava` | Art | ANS (8, 9, 14), THY (9, 16), CAP (1), BP (9), O2 (1) |
| `heartIcon` | `({ beat })` | 48 x 56, centre | `heart` | Art | AB, PK, BP rows, ANS map rows, FS flow map, THY |
| `valveAV` | `({ open, leaflets: 2 or 3, chordae = true, papillary = true, squeeze })` | 70 x 90, annulus centre | `mitral` or `tricuspid` | Art | via heart; FS close-ups |
| `valveSemilunar` | `({ open, sinus = true })` | 34 x 30, annulus centre | `aortic` or `pulmonary` | Art | via heart |
| `vessel` | `({ d, kind: 'artery' or 'arteriole' or 'vein' or 'venule' or 'capillary' or 'portal' or 'lymphatic', lumen (model width), blood: 'oxy' or 'deoxy' or 0..1 mix, cutaway = true, cells: { n, phase } , tone 0..1 (smooth muscle), valves = false (limb veins only), gaps 0..1 (leak), flow: { phase, opacity } })` | path-defined | `vessel` plus kind (`artery`, `vein`, ...) | Art | BP, RAAS, NEPH, ADH, CA, ANS, VQ, AB, COAG, INS, THY, HPA, GAS, PK, AA, IMM, CC |
| `vesselSection` | `({ r, kind, tone, blood })` cross-section ring (intima, media, adventitia) | 2r + wall, centre | `vessel` | Art | BP (5), ANS (10), AA |
| `capillaryBed` | `({ w, h, from: 'oxy', to: 'deoxy', cells, tissue: 'polygon' })` | w x h, top-left | `capillary` | Art | BP (1), O2 (3, 8), PK |
| `carotidBifurcation` | `({ sinusGlow 0..1, nerveIX = true })` with aortic arch option | 160 x 200, top-left | `sensor carotid aorta` | Art | BP (8, 9) |
| `streamline` | `({ d, phase, opacity, w = 3 })` | path | none | string | PV, FS, BP, VQ, PK |
| `flowArrow` | `({ d, w (model), ghostW, col })` model-width arrow with fixed head plus offset dashed ghost | path | caller's | string | NEPH, PK, THY, HPA, AA, GAS |

Accuracy built in: apex down and to the viewer's right, formed by the LV; RV cavity shorter than the LV
(about two-thirds to three-quarters); RV (with its infundibulum) larger than the RA; LV wall about 2.5 to 3 x
RV; RVOT anterior and connected to the RV, never touching the LA; descending aorta behind the heart, never
ending on the LA; aortomitral continuity; tricuspid annulus at least as large as the mitral and slightly more
apical (offset well short of the Ebstein range); tricuspid leaflets anterior, posterior, septal, with septal
chordae to the septum; mitral anterior leaflet 1.5 to 2 x the posterior's height, never attached to the
septum; papillary muscles grow from the wall; closed AV leaflets coapt below the annulus; closed semilunar
cusps belly toward the ventricle; aortic root is arterial wall, not muscle; four pulmonary veins (two drawn,
two stated hidden); interatrial septum drawn; SA node subepicardial in the lateral RA wall at the SVC
junction; AV node in the atrioventricular septum (triangle of Koch) above the tricuspid septal hinge; bundle
branches subendocardial on their own sides of the septum, Purkinje just under the free-wall endocardium;
ventricular activation septum first (left to right), then apex, free walls endocardium to epicardium, base
last; wall material by vessel type, lumen by oxygenation; venous valves only in limb veins (`vessel`
`valves` defaults off, and is never on for the venae cavae, portal, pulmonary or cerebral veins).

### 4.3 `art/kidney.js` (kidney and nephron)

| Primitive | API | Native box, anchor | Parts | Returns | Used by |
|---|---|---|---|---|---|
| `kidneySection` | `({ side: 'left' or 'right', shrink 0..1, scar 0..1, adrenal: false or true, hilum = true, wedge: false or { at, r } })` coronal: capsule, cortex, columns, 8 pyramids with papillae, minor and major calyces, pelvis, ureter, renal artery and vein | 140 x 210, hilum point | `kidney cortex medulla pelvis ureter renal-artery renal-vein` | Art | NEPH (1), RAAS (1, 2, 7), CA, INS (9), PK, ADH (zoom), HPA (1, 5) |
| `kidneyExterior` | `({ side })` shaded bean, medial hilum | 110 x 170, hilum | `kidney` | Art | HPA (1), ANS (11), PK icon |
| `renalCorpuscle` | `({ afferent, efferent (model widths), jg 0..1 glow, maculaDensa = true, filtrate 0..1, cells, proteins })` Bowman's capsule, tuft, vascular and urinary poles | 180 x 160, urinary pole | `glomerulus filtrate sensor (jg) afferent efferent` | Art | NEPH (2), RAAS (1, 2) |
| `nephronArt` | `({ seg: SEG polylines, wash 0..1, arrows: {...model widths}, blocks: {...0..1}, phase })` string primitive (all 17 NEPH scenes are string `render(t)` scenes, so the scene contracts stay unchanged); draws walled tubule with brush border on the proximal part, thin limbs, TAL with the macula densa at its end, DCT returning to its own corpuscle, shared collecting duct, peritubular capillaries arising from the efferent arteriole, and vasa recta only when the nephron is drawn long-looped (juxtamedullary); emits the `bicarbonate` part through `part()` instead of NEPH's regex | 300 x 380, top-left | NEPH's names: `nephron glomerulus proximal loop tal distal collecting medulla bicarbonate` | Art | NEPH (5 to 17, Explore, Clinical) |
| `walledTubule` | `({ pts, wall, lumen, brush = false, tone })` | path | caller's | string | NEPH, INS (9), HPA (5), RAAS (8), AB (8), CA |
| `tubuleCellRow` | `({ n, w, h, kind: 'cuboidal', brush, apical: [slots], basolateral: [slots], capillary = true })` slots take transport glyphs from cell.js | w x h, apical-left | `epithelium` plus slot parts | Art | NEPH (4, 5, 7 to 10), INS (9), RAAS (8), HPA (5), AB (8, 13), CA |
| `medullaGradient` | `({ w, h, wash 0..1 })` cortex-to-papilla tint bands | w x h | `medulla` | string | NEPH |
| `urineCup` | `({ bars: [{ v, ghost }], level })` graduated cup holding model bars | 90 x 130, base centre | `urine` | Art | NEPH, ADH (flask) |

Accuracy: JG granular cells in the afferent arteriole wall at the vascular pole; macula densa in the last
cortical part of the **thick ascending limb**, at its transition to the DCT, lying in the angle between the
afferent and efferent arterioles of its own glomerulus (in NEPH it sits beside the NKCC2 loop-diuretic
target); peritubular capillaries arise from the efferent arteriole (a portal arrangement), never as an
independent vessel; vasa recta only with a juxtamedullary nephron; afferent wider than efferent; DCT returns to its own corpuscle; collecting duct
shared by several nephrons; thin ascending limb and TAL drawn with the water-tight wall style.

### 4.4 `art/lung.js` (lung and alveolus)

| Primitive | API | Native box, anchor | Parts | Returns | Used by |
|---|---|---|---|---|---|
| `lungsFrontal` | `({ breathe 0..1, lobes: highlight list, tree = true, heart: false or 'behind' })` trachea with C rings, carina, right main bronchus shorter, wider, steeper; right 3 lobes, left 2 with cardiac notch and lingula; fissures; diaphragm line | 300 x 260, trachea top centre | `lungs trachea airways right-lung left-lung` | Art | VQ (1), O2 (1), AB (7) |
| `airwayTree` | `({ depth, narrow 0..1, mucus 0..1 })` | 120 x 120, stem top | `airways` | Art | VQ |
| `alveolus` | `({ r, gas: colour input or po2, fluid 0..1, mouth angle, cells = true })` lobed sac, wall band with type I and II nuclei | 2.2 r square, centre | `alveoli wall` | Art | VQ (all), O2, AB (5) |
| `acinus` | `({ n = 7, duct })` alveolar cluster on a duct | 110 x 110, duct top | `alveoli` | Art | VQ (1, lens), O2 |
| `alveolarCapillary` | `({ around: alveolus anchor, w (model), from, to, cells: { n, phase } })` main channel plus faint cross-links hugging the sac | wraps the alveolus | `capillary` | Art | VQ, O2 (3), AB (5) |
| `barrierInset` | `()` epithelium, fused basement membrane, endothelium, one RBC | 140 x 90 | `wall exchange` | Art | VQ (3) |
| `bronchiole` | `({ section: 'cross' or 'long', lumen 0..1, tone 0..1, mucus, receptors: slots })` folded epithelium, smooth-muscle ring, adventitia | 120 x 120 | `airway muscle` | Art | VQ (13, 14), ANS (13), AA (9) |
| `vqConfluence` | `({ a, b colours, w })` Y-merge with colour mixing | 140 x 80 | `artery` or `vein` | Art | VQ (9 to 16) |
| `thrombus` | see blood.js | | | | VQ (15) |
| `exudate` | `({ fill 0..1, cells })` fluid with meniscus and white cells, clipped to an alveolus | alveolus box | `fluid` | Art | VQ (16) |

Accuracy: pulmonary artery deoxygenated (venous blue lumen, artery wall), pulmonary vein oxygenated (red lumen, vein wall); HPV acts in small
pulmonary arteries; a PE lodges in a pulmonary artery branch upstream of the capillaries.

### 4.5 `art/cell.js` (cell, membrane, receptors, channels, transporters, vesicles, enzymes)

| Primitive | API | Native box, anchor | Parts | Returns | Used by |
|---|---|---|---|---|---|
| `bilayer` | `({ d or x1, y1, x2, y2, gap = 7 (head spacing), highlight: [from, to], snipped: [indices] })` heads plus tail pairs as `ax-d2` detail, golden core band always underneath (it shows alone when detail is hidden) | path | `membrane` | string | CAP, ANS, NMJ, GAS, INS, RAAS, ADH, AA, BAC, CC, COAG, BP, VQ |
| `membraneBand` | `({ d, w = 8 })` two-line icon membrane | path | `membrane` | string | everywhere at icon scale |
| `phospholipid` | `({ kinked = true })` one lipid: head, glycerol, saturated and kinked sn-2 tail | 16 x 40, head centre | `lipid` | Art | AA (1, 3), BAC (2) |
| `gpcr` | `({ ligand: null or 'agonist' or 'antagonist', ligandCol, gprotein 0..1, cap: colour })` 7 helices, ECL and ICL loops, binding pocket, G-protein trimer under it | 60 x 90, membrane mid centre | `receptor` | Art | ANS (alpha, beta, M), BP (alpha1, alpha2, beta1), RAAS (AT1 unlabelled), ADH (V2), CAP (beta1, M2), VQ (beta2, M3), GAS (H2, gastrin, M), THY (beta1), AA (CysLT1) |
| `rtk` | `({ bound 0..1, phospho 0..1 })` insulin receptor alpha2-beta2 | 70 x 110, membrane mid | `receptor` | Art | INS |
| `channel` | `({ kind: 'nav' or 'cav' or 'kv' or 'enac' or 'kir' or 'katp' or 'cl' or 'generic', open 0..1, inactivated 0..1, ion: key, plug 0..1 (drug), collar = true })` true assembly per kind: Nav and Cav one chain with four domains; Kv and Kir four subunits; ENaC three subunits (alpha, beta, gamma); K-ATP four Kir6.2 around the pore with four SUR1 outside them (sulfonylureas bind SUR1, so SUR1 is drawn); `cl` generic unless the caption names one (ClC is a double-barrelled dimer, CFTR an ABC transporter). Inactivation: Nav uses a **hinged lid on the intracellular III to IV loop** (the h gate, called "inactivation gate"); ball and chain is only for Kv (Shaker-type). Pore lit in ion colour when open | 44 x 72, membrane mid | `channel` (CAP: `door-na` etc. via `parts`) | Art | CAP, NMJ, BP (L-type), INS (K-ATP with SUR1, CaV), NEPH (ENaC, ROMK unlabelled), GAS (Cl), RAAS, ADH |
| `nuclearReceptor` | `({ where: 'cytoplasm' or 'nucleus', ligand: null or key, bound 0..1, dna = true })` intracellular receptor with a ligand-binding part and a DNA-binding part; moves into the nucleus and sits on a short DNA helix when bound | 40 x 30, centre | `receptor` | Art | HPA (cortisol), IMM (glucocorticoid), AA (glucocorticoid), RAAS (aldosterone), THY (T3) |
| `nachr` | `({ state: 'empty' or 'ach' or 'open' or 'blocked' or 'agonist' or 'lost', open 0..1 })` pentamer side view, two binding pockets | 40 x 80, membrane mid | `gates` | Art | NMJ |
| `aquaporin` | `({ inMembrane 0..1, hollow })` hourglass | 26 x 60 | `aquaporin` | Art | ADH, NEPH (10) |
| `transporter` | `({ kind: 'uniporter' or 'symporter' or 'antiporter' or 'pump' or 'reuptake', phase 0..1 (rocking), cargo: [keys], beta = false (glycosylated beta subunit for P-type pumps), atp = false, blocked 0..1 })` | 50 x 76, membrane mid | `pump` or `carrier` or caller's | Art | GAS (H+/K+ ATPase), NEPH (NKCC, NCC, Na/K), INS (GLUT2, GLUT4, SGLT2, Na/K), ANS (NE reuptake, 12 helices), RAAS (Na/K), HPA (5), AB (8, 13), BAC (2), CA |
| `vesicle` | `({ r, cargo: key, n, fuse 0..1 (omega pore), proteins: [glyphs] })` | 2r, centre | `vesicles` | Art | ANS, NMJ, INS (GLUT4, granules), ADH (AQP vesicles), GAS (tubulovesicles), THY |
| `cellBody` | `({ shape: 'round' or 'cuboidal' or 'columnar' or 'polygon' or 'pyramidal' or 'squamous' or 'spindle', w, h, nucleus: {...}, organelles as `ax-d2` / `ax-d3` detail, membrane: 'line' or 'bilayer', polarity })` | w x h, centre | `cell` | Art | GAS, INS, HPA, THY, AA, IMM, CC, ADH, CA, RAAS |
| `epithelium` | `({ n, kind, brush, junctions = true, apical: slots, basal: slots, basement = true })` | per cell 40 x 60 | `epithelium` | Art | NEPH, ADH, GAS, RAAS, INS, THY (follicle), VQ (barrier) |
| `nucleus` | `({ r, pores = true, nucleolus = true, chromatin: 'loose' or 'condensed', breakdown 0..1, dna: false or slot })` | 2r, centre | `nucleus` | Art | CC, IMM (15), HPA, THY (4), AA |
| `mitochondrion` | `({ w, h, glow 0..1 })` | w x h | `mito` | string | NMJ, ANS, HPA, THY, GAS, O2 (8), AB (2) |
| `granules` | `({ n, r, col, region })` | region | caller's | string | INS, IMM, COAG, HPA |
| `enzyme` | `({ shape: 'globular' or 'bilobed' or 'dimer', cleft = true, state: 'zymogen' or 'active' or 'blocked', anchor: 'free' or 'membrane' or 'tethered', glow 0..1, sidePocket = false, plug: null or 'reversible' or 'selective' or 'acetyl' })` | 56 x 50, centre | `enzyme` | Art | RAAS (renin, ACE), ANS (AChE, tethered), NMJ (AChE with collagen tail), AA (PLA2, COX-1, COX-2 with side pocket), AB (carbonic anhydrase), COAG (factors), INS (DPP-4), THY (deiodinase), GAS (pepsin with propeptide lid), CC (CDK, topoisomerase via `bilobed`) |
| `factorPill` | `({ active 0..1 (model), ghost })` zymogen half, active half fill level | 64 x 26 | caller's | Art | COAG ladder |

Accuracy: GPCRs are never drawn as channels; M and adrenergic receptors, beta2, AT1, V2, H2 are 7TM;
cortisol, prednisolone, aldosterone and T3 act on intracellular receptors (`nuclearReceptor`), never on a
membrane GPCR; nicotinic receptors are pentamer channels; ACE membrane-bound on endothelium; insulin binds its receptor,
not GLUT4; SGLT2 apical, GLUT2 basolateral; sulfonylureas bind SUR1 of the K-ATP channel.

### 4.6 `art/nerve.js` (nerve, synapse, neuromuscular junction, muscle)

| Primitive | API | Native box, anchor | Parts | Returns | Used by |
|---|---|---|---|---|---|
| `neuron` | `({ kind: 'motor' or 'generic' or 'neurosecretory', dendrites = 6, axon: d, myelin, granules (secretory) })` soma, nucleus, hillock | 120 x 120, soma centre | `cellbody` or `neuron` | Art | NMJ (1), ADH (2, 3), ANS |
| `axon` | `({ d, myelin = false, nodes, impulse 0..1 (position of a blue glow), dashed: 'para' })` | path | `nerve` | string | NMJ, ANS, BP, VQ (14), GAS |
| `nerveCable` | `({ n, highlight })` epineurium, several axons | 200 x 40 | `nerve` | Art | NMJ (1) |
| `varicosity` | `({ cut = true, vesicles: n, fuse 0..1, mito = true, transmitter: key })` bead on an autonomic axon | 120 x 90, release face centre | `nerves gap` | Art | ANS (3 to 7), VQ (14), GAS (9), BP (9) |
| `bouton` | `({ activeZones: [x], schwann = true, vesicles: n, calcium 0..1, fuse 0..1 })` | 220 x 120, cleft centre | `nmj vesicles calcium` | Art | NMJ (3 to 6, 10) |
| `junctionalFolds` | `({ n, depth, crests: 'nachr', troughs: 'nav', lamina = true, ache: n })` | 300 x 90, top-left | `endplate gates enzyme` | Art | NMJ |
| `spinalCord` | `({ section: 'cross', highlight: 'ventral horn', roots = true })` butterfly grey matter | 120 x 110, centre | `cord` | Art | NMJ (1), ANS (1), BP (9) |
| `sympatheticChain` | `({ ganglia: n })` beads beside the cord | 30 x 200 | `symp` | Art | ANS (1, 2), BP (9) |
| `brainSagittal` | `({ highlight: ['hypothalamus' or 'brainstem' or 'medulla' or 'pons'], pituitary = true })` | 220 x 170, brainstem base | `hypothalamus brainstem` | Art | BP (8 to 10), AB (16), ADH (2), AA (fever), THY, HPA |
| `brainLateral` | `()` silhouette | 160 x 120 | `brain` | Art | INS (1), ANS (1) |
| `muscleBelly` | `({ length 0..1, width, tendons = true, bones = true, fascicles = true })` | 260 x 90 | `muscle` | Art | NMJ (1, 9) |
| `muscleFibre` | `({ sarcomere 0..1, wave 0..1, nuclei = 'peripheral', endPlate: x })` | 300 x 40 | `fibres wave` | Art | NMJ (2, 9), INS, HPA (3) |
| `sarcomere` | `({ length 0..1, heads: 'pull' or 'idle', titin = true })` zig-zag Z discs, bead actin, golf-club myosin, M line | 200 x 70 | `sarcomere` | Art | FS (3, 4) |
| `cardiomyocyte` | `({ branch = true, discs = true, squeeze 0..1, length })` | 160 x 60 | `cells` | Art | CAP (1, 2), FS (3), BP |
| `smoothMuscleCell` | `({ contract 0..1 })` spindle with elongated nucleus | 80 x 16 | `muscle` | string | BP, VQ, ANS, RAAS, AA |

Accuracy: calcium enters at active zones; active zones face fold crests; AChRs on crests, Na channels in
troughs; the end plate is a patch; a twitch is asymmetric; neuron colour is nerve yellow, the impulse is a
blue glow.

### 4.7 `art/blood.js` (blood cells, hemoglobin, clotting)

| Primitive | API | Native box, anchor | Parts | Returns | Used by |
|---|---|---|---|---|---|
| `rbc` | `({ view: 'face' or 'edge' or 'oblique', ox 0..1, r = 7, cutaway = false })` biconcave disc | 2r, centre | `rbc` | string (inlined paths; `<symbol>` only in mount scenes) | BP, VQ, O2, AB, COAG, ADH, CA, INS, THY, HPA, PK, CC, IMM |
| `rbcStream` | `({ d, n, phase, ox })` | path | `rbc` | string | VQ, O2, ADH, COAG |
| `hemoglobin` | `({ seats: 4 of 'o2' or 'co' or 'empty', r 0..1 (T to R), missing = false })` two alpha, two beta globules, four heme plates with Fe | 80 x 80 (full) down to 14 (symbol), centre | `molecule seat` | Art | O2 (2 to 16) |
| `platelet` | `({ activation 0..1, granules = true })` discoid lens to spread form with filopodia | 26 x 12 resting | `platelets` | string | COAG (3 to 5, 18) |
| `plateletPlug` | `({ amount 0..1, pts })` interlocking activated platelets with depth | model pts | `plug` | string | COAG |
| `fibrinogen` | `()` trinodular rod | 30 x 8 | `fibrinogen` | string | COAG |
| `fibrinMesh` | `({ threads, lysis 0..1 })` banded strands with cross-link dots | model threads | `fibrin` | string | COAG |
| `vwf` | `({ d })` beaded string | path | `vwf` | string | COAG (4) |
| `collagen` | `({ d })` fibre bundle | path | `collagen` | string | COAG, AA (2) |
| `thrombus` | `({ lysis 0..1, occlusive })` dark-red clot with fibrin strands | 80 x 50 | `clot` | Art | COAG (19), VQ (15) |
| `albumin` | `({ ca: 0..3 bound })` globular protein with Ca2+ sites | 34 x 26 | `albumin` | string | CA |

Accuracy: no nucleus in RBCs; BPG binds the T state only (O2); fetal Hb is alpha2 gamma2 if ever drawn.

### 4.8 `art/immune.js` (immune cells and molecules)

| Primitive | API | Native box | Parts | Used by |
|---|---|---|---|---|
| `neutrophil` | `({ squeeze 0..1, lobes = 3 })` one multilobed nucleus, granular cytoplasm | 30 x 30 | `neutrophil` | IMM, AA (2) |
| `macrophage` | `({ engulf 0..1 })` pseudopods, oval eccentric nucleus (the kidney-shaped nucleus is the monocyte's), phagosomes, lysosome fusion | 70 x 56 | `macrophage` | IMM |
| `dendriticCell` | `({ antigen = true })` wavy branching dendrites, surface MHC cups | 80 x 70 | `dendritic` | IMM |
| `lymphocyte` | `({ kind: 'helperT' or 'killerT' or 'B' or 'memory', receptor = true, divide 0..1 })` large nucleus, thin rim | 30 x 30 | `tcell` or `bcell` or `killer` or `memory` | IMM |
| `plasmaCell` | `()` eccentric clock-face nucleus, RER lamellae, Golgi patch | 40 x 30 | `plasma` | IMM |
| `antibody` | `({ bound: 'fab' or 'none', col, decoy = false })` IgG heavy and light chains, hinge, Fab and Fc | 24 x 30 | `antibody` | IMM, NMJ (16), THY (12) |
| `mhcTcr` | `({ docked 0..1 })` | 30 x 40 | `switch` | IMM |
| `cytokine` | `({ kind: 'tnf' or 'il2' or 'generic' })` | 10 | `signal` or `il2` | IMM, AA |
| `apoptosis` | `({ k 0..1 })` shrink, bleb, fragment | cell box | `infected` | IMM, CC |
| `mitosis` | `({ k 0..1 })` for clone trees | cell box | `clone` | IMM |
| `bacterium` | see microbe.js | | `germ` | IMM |
| `skinSection` | `({ cut = true, inflamed 0..1, wound })` | 480 x 160 | `skin` | IMM, AA (2) |
| `lymphNode` | `({ follicles, paracortex, afferent valves, efferent, hilum })` | 200 x 150 | `node` | IMM |

Accuracy: B follicles in the cortex, T cells in the paracortex, afferent vessels on the convex side;
killer T cells kill by apoptosis; IL-2 acts on the T cell's own receptor; agglutination needs antibodies
bridging germs; insulitis spares alpha cells (INS).

### 4.9 `art/endocrine.js` (glands)

| Primitive | API | Native box, anchor | Parts | Used by |
|---|---|---|---|---|
| `hypothalamusPituitary` | `({ portal 0..1 flow, stalk = true, anterior: scale, posterior: scale, adenoma 0..1, failure 0..1 (hatch), neurosecretory = false })` midsagittal brain-base inset: hypothalamus, optic chiasm, infundibulum, portal capillaries, anterior and posterior lobes in the sella turcica | 200 x 150, stalk top | `hypothalamus pituitary` plus `portal` | THY, HPA (one shared drawing, matched layout), ADH |
| `thyroidNeck` | `({ view: 'anterior' or 'posterior', scale 0.6..1.6 (goitre), parathyroids: [4 sizes] or false, rings = true, scm = false, attack: 0..1 })` thyroid and cricoid cartilages, trachea with C rings, lobes and isthmus over rings 2 to 4 | 200 x 220, isthmus centre | `thyroid windpipe` | THY, CA (posterior with 4 parathyroids) |
| `thyroidFollicle` | `({ n = 14, colloid, tg = true, iodine 0..1, cCells: n (between follicles) })` | 180 x 180, centre | `follicle store iodine` | THY (3, 4), CA |
| `adrenalOnKidney` | `({ side: 'right' (pyramidal) or 'left' (crescentic), cut = false, cortex 0..1 thickness, medulla = true, ivc = true })` | 110 x 190, hilum | `adrenal cortex medulla kidney` | HPA (1), RAAS (7), ANS (11) |
| `adrenalSection` | `({ cortex 0..1, damage 0..1, hyperplasia 0..1, zones = false })` | 120 x 80 | `cortex medulla` | HPA, RAAS |
| `pancreas` | `({ duodenum = true, duct = true, islets: n })` head in the duodenal C, body, tail | 260 x 110 | `pancreas` | INS |
| `islet` | `({ beta, alpha, delta, intermingled = true, capillary = true, acinarRim = true, insulitis 0..1 })` | 160 x 160, centre | `islet beta alpha` | INS |
| `betaCell` | `({ granules: n, katp: open 0..1, cav: open 0..1, release 0..1 })` | 120 x 110 | `beta channel` | INS (3, 16) |
| `endocrineCell` | `({ granules, sensor: 'casr' or null, kind })` | 70 x 60 | caller's | CA (C cell, parathyroid cell), GAS (ECL), INS (L cell) |
| `adrenalCortexCell` | `({ droplets, mito })` polygonal steroid-making cell | 120 x 100 | `cortex cholesterol` | HPA (2) |

Accuracy: TSH, ACTH from the anterior lobe; ADH stored in and released from the posterior lobe; CRH and TRH
reach the anterior lobe through portal vessels; C cells sit between follicles in the lobes; isthmus anterior
(hidden in a posterior view); right adrenal pyramidal, left crescentic; right kidney lower. Cortisol and
aldosterone are **made** in the cortex (aldosterone in the outermost zone; zones unlabelled unless captioned),
adrenaline and noradrenaline (about 80 : 20) in the medulla; **all** of them reach the blood through
sinusoids that drain centripetally through the medulla to the central adrenal vein, so every hormone flow
leaves at the adrenal vein (right to the IVC, left to the left renal vein), never out through the capsule.

### 4.10 `art/gut.js` (stomach, gut, liver)

| Primitive | API | Native box, anchor | Parts | Used by |
|---|---|---|---|---|
| `stomach` | `({ cutaway = true, rugae = true, regions: labelsOff })` oesophagus, fundus, body, antrum, pylorus, duodenum | 220 x 220, oesophagus top | `stomach lining` | GAS (1), PK (1), INS (18) |
| `mucosaStack` | `({ ulcer 0..1 depth, mucus h, pits })` epithelium, lamina propria, muscularis mucosae, submucosa | 480 x 160 | `lining mucus ulcer` | GAS (10, 11, 16), AA (stomach shield) |
| `gastricGland` | `({ pit = true, parietal: n, chief: n, ecl: n })` | 90 x 220 | `pit gland` | GAS (1, 2) |
| `parietalCell` | `({ pumpsUp 0..1, tubulovesicles: n, canaliculus = true, mito = true })` pyramidal | 220 x 200, apical centre | `cell vesicle` | GAS |
| `mucusLayer` | `({ h, bicarbonate: n })` | w x h | `mucus bicarbonate` | GAS |
| `smallIntestine` | `({ loops })` | 200 x 140 | `gut` | PK, INS, CA |
| `villus` | `({ enterocytes: n, lCell = false, capillary = true, lacteal = false })` | 80 x 160 | `gut` | INS (4), CA |
| `liver` | `({ lobes = true, gallbladder = true, portal = true, enzymes: { n, state: 'normal' or 'induced' or 'inhibited' } })` | 220 x 140 | `liver` | PK, INS (6, 15), HPA (3), RAAS (3) |
| `hepatocyte` | `({ glycogen 0..1, transporter: 'glut2' })` | 120 x 100 | `liver glycogen` | INS |
| `glycogen` | `({ size 0..1 })` branched granule | 30 | `glycogen` | INS |

Accuracy: first pass via the hepatic portal vein before the general circulation; grapefruit acts mainly on
gut-wall enzymes; an ulcer breaches the muscularis mucosae, an erosion does not; histamine is paracrine
(tissue fluid), gastrin comes via blood, ACh from nerve endings; pepsinogen from chief cells.

### 4.11 `art/microbe.js` (bacteria, DNA machinery)

| Primitive | API | Native box | Parts | Used by |
|---|---|---|---|---|
| `bacterium` | `({ shape: 'rod' or 'coccus', gram: 'pos' or 'neg', nucleoid = true, ribosomes = true, burst 0..1, divide 0..1, antigens = false })` layered: wall rim, bilayer, cytoplasm gradient, nucleoid | rod 60 x 24 | `bacterium` | BAC, IMM |
| `envelope` | `({ gram, crosslink 0..1, lps = true, porin = true, teichoic = true, periplasm })` cross-section | 300 x 140 | `wall outer membrane pos neg` | BAC (3 to 5, 13, 14) |
| `peptidoglycanMesh` | `({ crosslink 0..1, capped: [] })` NAG/NAM hexagon strands with peptide bridges | 260 x 100 | `wall bridge` | BAC |
| `pbp` | `({ jammed 0..1 })` membrane-anchored, active-site cleft | 50 x 60 | `enzyme` | BAC |
| `ribosome70S` | `({ sites = true, tunnel = true, blocked: null or 'tunnel' or 'A' or 'decode', chain: n })` 50S crown and 30S | 160 x 130 | `ribosome large small` | BAC (8, 15, 16) |
| `trna` | `({ aa: col })` L-shaped | 24 x 30 | `trna` | BAC |
| `peptideChain` | `({ n, faulty: [i] })` | path | `chain` | BAC |
| `dnaHelix` | `({ length, depth = true, cut 0..1, supercoil 0..1 })` front and back strands, grooves, base rungs | per turn 40 x 24 | `dna` | BAC, CC |
| `replicationFork` | `({ progress 0..1, helicase = true, polymerase = true, blocks: n })` | 220 x 100 | `fork blocks` | CC (6), BAC (7) |
| `topoisomerase` | `({ kind: 'gyrase' or 'topo4' or 'generic', cut 0..1, trapped 0..1 })` | 60 x 50 | `topo topo4 enzyme` | BAC, CC (7, 16) |
| `nucleoid` | `({ supercoil 0..1 })` | 80 x 40 | `dna` | BAC |
| `virus` | `()` small capsid | 12 | `germ` | IMM |

Accuracy: LPS only in the outer leaflet of the gram-negative outer membrane; gram-positives have no outer
membrane; nucleoid has no membrane; no invented flagella, capsules, plasmids or pili; tetracycline at the 30S
A site, macrolides at the 50S exit tunnel, aminoglycosides at the 30S decoding site; gyrase ahead of the
fork, topo IV unlinks daughters; keep the bacterium to human cell scale about 1 to 8.

### 4.12 `art/molecules.js` (ions, small molecules, drug glyphs, props)

| Primitive | API | Native size | Used by |
|---|---|---|---|
| `ion(key, { x, y, s, charge = true })` | keys `na k ca cl h hco3 po4 mg` (section 2.5 shapes, vector charge marks) | 10 to 14 | CAP, NMJ, GAS, NEPH, RAAS, ADH, CA, AB, INS, HPA |
| `ionSymbols()` | `<symbol>` defs for repeated ions, for **mount scenes only**; string scenes inline the glyph paths | | mount scenes |
| `o2`, `co2`, `co`, `water`, `glucose`, `aminoAcid` | `({ x, y, s, docked })` | 10 to 16 | O2, VQ, AB, ADH, NEPH, INS, HPA |
| `peptide` | `({ n, col, ring = 0 (beads in a disulfide ring), tail = 0, chains: 1 or 2 })` count-accurate beads | 6 per bead | RAAS (ang I 10, ang II 8), ADH (ring 6 plus tail 3), INS (insulin 2 chains, glucagon, GLP-1), THY (TRH 3), HPA |
| `proteinRibbon` | `({ w, col })` folded large protein (angiotensinogen, thyroglobulin) | 60 x 30 | RAAS, THY |
| `steroid` | `({ fill: 'cortisol' or 'aldosterone' or 'drug' or 'cholesterol', tail })` 6-6-6-5 rings | 40 x 26 | HPA, RAAS, AA (glucocorticoid), IMM (15) |
| `thyronine` | `({ iodines: 4 or 3 })` two rings, iodines on the correct positions (T3 lacks the outer-ring 5') | 40 x 20 | THY |
| `arachidonic` | `({ kinks = 4 })` C20 hairpin with COOH | 46 x 20 | AA |
| `eicosanoid` | `({ kind: 'pg' or 'tx' or 'lt' })` | 20 | AA |
| `transmitter(key)` | `ach` (splittable), `ne`, `adrenaline`, `histamine` | 8 to 12 | ANS, NMJ, GAS, VQ |
| `drug` | `({ family: 'plug' or 'selectivePlug' or 'acetyl' or 'wedge' or 'cap' or 'ring' or 'bulky' or 'dumbbell' or 'hexagonAntacid' or 'chain' (heparin) or 'clamp' (PPI) or 'stub' (vinca) or 'lock' (taxane) })` drug purple, each family a distinct shape. Heparin's chain always binds **antithrombin**, and the heparin-antithrombin complex inactivates thrombin and Xa; never a direct T-bar from heparin to the factors | 12 to 24 | every drug step in BP, RAAS, NEPH, ANS, CAP, NMJ, AB, COAG, INS, THY, HPA, GAS, PK, AA, IMM, BAC, CC |
| `tablet`, `capsule`, `syringe`, `insulinPen`, `ivLine` | props | 20 to 40 | PK, INS, THY, HPA, IMM (vaccine), COAG |
| `beaker`, `cylinder` | `({ level 0..1, ticks, meniscus = true, gloss = true, colour })` | 60 x 110 | AB (3), FS (9), ADH, NEPH |

Accuracy: aspirin is drawn as a covalent acetyl flag, NSAIDs as reversible plugs; steroids (cortisol,
aldosterone, cholesterol, glucocorticoid drugs) are 6-6-6-5, and calcitriol, a secosteroid with an open B
ring, never uses that glyph; ang I 10 beads, ang II 8; vasopressin 6-bead ring plus 3-bead tail; TRH 3
beads; T3 lacks the outer-ring 5' iodine; heparin acts through antithrombin.

### 4.13 `art/body.js` (body, bone, skin, senses)

| Primitive | API | Native box | Parts | Used by |
|---|---|---|---|---|
| `torso` | `({ organs: slots, spine = true })` silhouette with organ slots | 200 x 300 | `body` | HPA (1), INS (11), PK (1), ANS (1) |
| `boneLong` | `({ section = true, thin 0..1, marrow = true })` cortex, trabeculae, marrow | 70 x 260 | `bone marrow` | CA, CC (11) |
| `boneSurface` | `({ pit 0..1, osteoclast = true, osteoblasts: n, osteoid })` remodelling surface | 300 x 120 | `bone` | CA |
| `eyeFrontal` | `({ pupil 0..1 })` lids, sclera, textured iris, sphincter band, dilator fibres | 160 x 90 | `pupil ring spoke` | ANS (12) |
| `hairFollicle` | `({ bulb = true })` | 60 x 140 | `cells` | CC (11) |
| `crypt` | `({ dividing: n })` intestinal villus and crypt | 80 x 160 | `cells` | CC (11) |
| `tumourMass` | `({ n, irregular })` | 100 x 80 | `cells` | CC |
| `standingFigure` | `({ pool 0..1 })` | 60 x 180 | `veins` | BP (10) |
| `adipocytes` | `({ n })` | 100 x 70 | `fat` | INS |

### 4.14 `art/chart.js` (graph styling helpers)

Graphs stay model-driven; these helpers only standardise how marks look.

| Helper | API | Rule |
|---|---|---|
| `axes` | `({ x0, y0, x1, y1, xLabel, yLabel, ticks: { x: [[v, label]], y: [...] }, arrows = true })` | 1.5 ink, worded labels in kit classes, no gridlines (ECG paper is the only grid) |
| `curve` | `(pts, { role: 'live' or 'ghost' or 'ref' or 'untreated', col })` | live 4 units, ghost 3 dashed `#8a8f84`, ref 1.5 ink, untreated dotted 2.5; 2-unit panel underlay under live curves |
| `areaFill` | `(pts, baseY, col, opacity = .12)` | fills 10 to 14 % |
| `betweenFill` | `(a, b, col = blue, opacity = .12)` | the shaded change between ghost and new |
| `band` | `({ y0, y1, col, label, inside = true })` | healthy / working range bands; label inside the band |
| `zoneTints` | `(zones)` | sub- and supra-range tints |
| `changeArrow` | `(from, to, words, { side })` | blue `arrowFixed` from the ghost to the new mark, words at its end, collision-checked |
| `endLabel` | `(pts, words, { col })` | label at a curve's end with a short leader; never on a curve |
| `marker` | `(x, y, { kind: 'dot' or 'ring' or 'pin', col })` | dots r 5 with a 1-unit highlight |
| `valveEvent` | `(x, y, opens)` | ring = opens, filled = shuts (PV) |
| `bar` | `({ x, y, w, h (model), ghostH, band, rounded = true, col, gradient = true })` | ghost inset 2 units so strokes never coincide |
| `meter` | `({ x, y, w, value, band, ghost, ends: [low, high], cap = true })` | pill track, gradient fill, dashed ghost tick inside the track height, word column fixed to the right |
| `rangeTrack` | `({ zones, value, ghost })` | ADH sodium track, AB pH gauge |
| `slopeTriangle` | `(p, q, words)` | FS, CAP (slope wedge) |
| `axisBreak` | `(x, y)` | two-stroke break (IMM) |
| `ecgGrid` | `({ x, y, w, h })` | faint pink paper, clipped, only behind ECG traces (CAP, FS, THY) |
| `ecgTrace` | `({ rate, amp, pts, phase })` | P, QRS (smoothed), T morphology |
| `smoothTrace` | `(samples, { minPerPhase = 24 })` | Catmull-Rom so phases never facet |
| `stackedBar` | `({ parts: [{ v, col, label }] })` | EF, given / reserve |
| `bracket` | `(x0, x1, y, words)` | brackets with end ticks |

Used by: PV, FS, BP, CAP, NMJ, O2, VQ, AB, INS, THY, HPA, GAS, PK, AA, IMM, BAC, CC, ADH, CA, NEPH, RAAS,
COAG, ANS (every lesson with a meter, bar or trace).

---

## 5. Defs strategy (unique ids per picture)

1. **One prefix for art ids.** Every gradient, pattern, clip path, mask, filter and symbol the library makes
   has an id starting `ax-`. Shared materials are `ax-<material>` (from `artDefs()`); per-instance defs
   (user-space exterior gradients, cavity clips) come from `uid(base)` as `ax-<base>-<n>`.
2. **Only what is used.** `artDefs(used)` scans the body for `url(#ax-` and emits only those defs; nothing
   creates a gradient per molecule or per frame.
3. **String scenes go through kit `svg()`.** Extend `lab/kit/draw.js` `svg()`: after building its marker
   defs it (a) appends `artDefs(body)` when the body contains `url(#ax-`, and (b) rewrites `id="ax-`,
   `url(#ax-` and `href="#ax-` with the per-picture `lx<n>-` prefix it already uses for `ah-` and `fh-`.
   Each call gets a fresh prefix, so ids are unique per frame and per picture, and a hidden step's defs never
   shadow a visible step's.
4. **Mount scenes and lessons that build their own `<svg>` use `artContext(svgEl)`.** PV builds its 18
   pictures with its own `el()` (app.js line 577) and they all stay in the DOM, so fixed ids would resolve to
   the first copy in document order, often a hidden step's (which does not draw). `artContext` injects the
   defs once per `<svg>` with that svg's own prefix and returns `{ url, id, html }`; every `mount*` primitive
   takes it, and `ctx.html()` lets a mount scene place string primitives (`heartIcon()`) scoped to the same
   prefix. No new ids after mount; `set()` rewrites only `d` and attributes.
5. **Lessons with their own `svg()`** (AB, COAG, O2, VQ rewrite every `ah-` occurrence): move to the kit
   `svg()` during the redraw, or widen their rewrite to `/\b(ah|ax)-/g` and append `artDefs(body)`. Pick one
   per lesson and test with two steps visible plus the Explore tab.
6. **Off-kit lessons.** CA (module) imports `artDefs` and `scopeIds` from `/lab/kit/art/core.js`; ADH reads
   them from `window.LabArt` (section 4). Each calls `scopeIds(markup, prefix)` once per built picture (the
   summary static SVG keeps its `s-` prefix by passing it in).
7. **Explore and Clinical tabs** render separate SVG copies of the same builders; each goes through `svg()`
   or `artContext`, so their ids are distinct from the step pictures'.
8. **Filters**: only `ax-lift`, only on groups whose geometry never changes (section 2.6).
9. **Tests** (in `tools/lab-walk.mjs`): every `url(#...)` in every rendered `.visual svg` resolves to an
   element inside the same `<svg>`; no `<text>` has a scale other than 1 relative to its svg; the art ghost is
   above the art it ghosts.

---

## 6. Per-lesson notes (worst first)

Order: the owner's complaint and the shared heart first, then lessons with drawn errors or broken contracts,
then the rest by how far their art is from the bar. Every lesson: re-shoot all steps at 0.35 and 1, the rest
frame, Explore and Clinical tabs, at 1280 and 375 x 553.

1. **pressure-volume-loop.** The rejected heart is in all 18 pictures. Replace `heart()` with
   `mountLeftHeart` (a separate long-axis drawing, not a crop of the section; it takes an `artContext`
   because PV builds its own `<svg>`): apex down and to the viewer's right and pinned, fixed LA roof, annular
   plane that descends a few units with squeeze, aortic root with sinuses as artery wall, arch whose descending
   limb passes behind the heart, area-calibrated LV cavity over 0.30 to 1.25 of the normal EDV area (normal
   ESV 0.39, inotrope 0.32, venodilator 0.33, HF EDV 1.23, so nothing clamps), short axis carrying most of
   the change, conserved muscle area from a precomputed `h(a)` table (wall thickens as it empties), squeeze as
   an overlay, valves in the `emphasis` list, bileaflet mitral with chordae and papillary muscles, aortic cusps that
   lie flat open and belly toward the LV shut, deoxygenated RV crescent beyond the septum, translucent streamlines
   instead of black dashed arrows, chevron contractility marks that are always visible, the dashed normal
   ghost above the art with its panel underlay. Leaf parts with multi-name `data-part` so `ventricle` lights
   its own wall and blood. Blood is always oxygenated red; drop the pressure-to-colour code and rewrite "darker red: more pressure" and the step 4 and
   6 aria-labels. Keep `heart(parent, { ref, mark }).set(m, clock)`, re-tabulate the area table so
   `sizeFor(V)` stays monotonic, and keep HFrEF EDV inside the band. Graph polish: guides below and above
   loops (never along edges), EF bar under the volume axis, valve-event corner markers, 6 to 8 % loop fill,
   fix the relax, preload, hfref, venodil and sv label collisions, fix the "Filling" versus "mitral shut"
   boundary. ESPVR / EDPVR only from `model.js` and only with caption support.
2. **frank-starling-cardiac-output.** Same heart problem plus a real error: blood "in from the lungs" enters
   the ventricle with no left atrium or mitral valve. Port after PV's sign-off. Use `mountLeftHeart` for steps 1, 2, 3, 5 and 9,
   driven by `ventricleGeometry` (skin only), with LA and pulmonary veins. Add a mini LV inset over a dashed
   normal outline on the change steps (budget height, keep within 420). Replace the step 3 fibre with
   `cardiomyocyte` plus a `magnifier` into `sarcomere`. Step 5's cup must hold what the ventricle lost (no
   more than about 60 % of EDV, ESV/EDV about 0.4 from clinical-values.json). Step 8's time-to-fill bracket
   must exclude systole and the QRS must be well formed (`ecgTrace`). Graphs: slope triangles, between-curve
   wash, white underlay, red weakened curve in failure, fix the collapsed failure arrow and draw the missing
   beta arrows.
3. **nephron-diuretics.** A lilac hose over beige stripes, a highlighter glow, and two drawings that contradict
   their captions (DCT far from its corpuscle, a collecting duct owned by one nephron). Rebuild with
   `nephronArt` (a string primitive; every NEPH scene stays a string `render(t)` scene) on the existing SEG
   polylines (derive every anchor, ARROW, BLOCK_AT and label from SEG):
   walled tubule with brush border, true DCT return to its own corpuscle, shared collecting duct, peritubular
   capillary and vasa recta so reabsorption arrows land in blood, `renalCorpuscle` close-up, `tubuleCellRow`
   with transport glyphs for each drug target, washable `medullaGradient`, `urineCup` and blood-volume gauge
   in a reserved right column. Macula densa at the end of the TAL beside the NKCC2 target; peritubular
   capillaries from the efferent arteriole. Keep `vis(m)` / `lerpVis` widths and every data-part, including
   the multi-name arrows; `bicarbonate` is emitted by `part()` instead of the regex. `WATER` becomes the drop
   glyph `#8cc8e8` (not kit blue). Rewrite SEG_LABEL, DRUG_LABEL and the captions that name colours ("The
   blue line").
4. **renin-angiotensin-aldosterone.** Clip art in steps 1 to 9 and a placement error: the JG sensor cells
   are drawn at the hilum. Use `kidneySection` plus a `magnifier` to `renalCorpuscle` with JG cells in the
   afferent wall; `liver` with a `proteinRibbon` angiotensinogen; pulmonary endothelium with membrane-bound
   ACE (`enzyme anchor: membrane`); `gpcr` for the angiotensin II receptor; `vessel` arteriole with smooth
   muscle tone from the model; `adrenalOnKidney` with a cortex cut face (aldosterone made in the outer cortex,
   leaving by the adrenal vein); `nuclearReceptor` for aldosterone in the principal cell; principal cell from `epithelium`
   with channel and pump glyphs (unlabelled unless captions name them); count-accurate peptides (10 and 8).
   The relay chart (steps 10 to 15, Explore, Clinical): crosses on arrow shafts, bars in molecule colours,
   capped levels, add the aldosterone to potassium arrow, fix step 10's "with the drug" key, small node icons.
   Update the `.on-organ` halo colour with the organ fill.
5. **insulin-glucose.** Placeholders everywhere plus two misleading pictures: insulin appears to bind GLUT4,
   and filtered glucose returns through empty air. Draw `rtk` (insulin binds it) separate from GLUT4
   vesicles that fuse (`vesicle fuse`), proximal tubule `tubuleCellRow` with apical SGLT2 and basolateral GLUT2
   into a peritubular capillary, `islet` with intermingled cells (no alpha core) and insulitis sparing alpha
   cells, `betaCell` with K-ATP (SUR1) and CaV, `pancreas`, `liver` plus `hepatocyte` and `glycogen`,
   `villus` with an L cell, DPP-4 on endothelium. Glucagon red-brown, insulin deep teal-green two-chain
   glyph, never any blue.
   Meal chart: hour ticks, borderless panels, glucose-above-band and insulin-area shading, "healthy band"
   inside the band, insulin panel about 52 tall, step 2 axis fitted to its data.
6. **hpa-axis-steroids.** Accuracy errors (cortisol and aldosterone leave from the medulla; tablets float in
   blood; kidney hila and adrenal shapes wrong) on top of clip art. Use the shared `hypothalamusPituitary`
   (portal CRH to the anterior lobe) in a column layout matched to THY, `adrenalOnKidney` (right pyramidal,
   left crescentic, hila medial, right kidney lower) with cortisol and aldosterone made in the cortex and
   leaving through the central adrenal vein (right to the IVC, left to the left renal vein), never out
   through the capsule, `adrenalCortexCell`, `nuclearReceptor` for cortisol and prednisolone,
   `steroid` glyphs (cortisol amber, aldosterone green, drug hollow), tablet entering by mouth, never inside
   the vessel, `skinSection` for inflammation, `tubuleCellRow` for aldosterone. Meters: measured word widths,
   two-line fallback, far-end cap for saturated ACTH. Fix the step 4 ghost registration. Rewrite WHERE[] and
   aria-labels. Shared with THY: change both lessons in one pass.
7. **calcium-pth-vitamin-d.** Off the kit: 780 x 690 body map, 15-unit text, collisions in nearly every
   frame, no data-part wiring, the sticky dock covers the lower map on phones. **Moving to the 480 x 420
   contract is a prerequisite** (one layout, both coordinate tables replaced): every stroke tier and detail
   class assumes 480 units, and a 1.75 outline in a 780-wide picture renders at about 0.8 px. Then import the
   library from `app.js` (a module).
   Draw the cells the captions teach: `thyroidNeck view: 'posterior'` with four `parathyroids`, C cells
   between follicles, `endocrineCell` with a calcium sensor, `boneSurface` with osteoclast pit and osteoblasts,
   `kidneySection` plus a tubule inset, `villus`; route every hormone through a `vessel` (blood), with
   `albumin`-bound and ionised calcium in the plasma pool; calcitriol keeps its own token (a secosteroid,
   never the 6-6-6-5 glyph). Gauge: capsule with green normal band, neutral
   outer bands, blue chevron, dashed ghost tick. Add local hover lighting for data-parts and keep every
   `data-node` / `data-flow` hook; new animated morphs join the draw signature.
8. **adh-water-balance.** Off the kit (eight classic `defer` scripts, shared globals): load the library
   through `<script type="module" src="/lab/kit/art/global.js">` placed before them (`window.LabArt`); do not
   convert the files to modules. One flat schematic is shared by 16 steps and Explore. Replace with
   `brainSagittal` plus `hypothalamusPituitary` (neurosecretory neuron to the posterior lobe), a `vessel`
   cutaway whose plasma tint follows osmolality, an `epithelium` collecting-duct row with `gpcr` V2
   receptors on the blood side, `aquaporin` vesicles that insert apically, `urineCup` flask with gloss,
   vasopressin as a 6-bead ring plus 3-bead tail in slate (never close to the bicarbonate cyan).
   Fix the SIADH flask text over the ghost line and the ghost box drawn over "not stated"; no ghost where the
   value is not stated. Do not label AQP numbers, cAMP or nuclei names. Move vessel words out of the moving
   band. Scope new ids with `scopeIds`.
9. **coagulation-cascade.** An accuracy error (proteins C and S drawn braking thrombin instead of Va and
   VIIIa; DTI readout "less made") plus planks, stars and dashboard boxes. Fix the brake target and the DTI
   wording (blocks activity). Heparin binds antithrombin, and the complex inactivates thrombin and Xa (no
   direct heparin T-bar). Vessel: three-layer wall with a tear window over collagen, `rbc`, `platelet`
   activation morph, `vwf`, `plateletPlug`, `fibrinMesh`, `thrombus` with lysis. Ladder: `factorPill` nodes
   with model fill and a visible ghost capsule, `inhibit` T-bars with model weight, `heparin` chain,
   vitamin K inset with a blockable arc (K-dependent II, VII, IX, X, C, S only). Reserve RBC-free label
   zones, 8-unit edge margin for K badges, no clipped half-cells.
10. **neuromuscular-junction.** Three drawn-wrong details: calcium enters at the terminal corners, active
    zones sit over fold mouths, the myasthenia antibody is upside down. Rebuild the shared close-up with
    `bouton` (Schwann cap, mitochondria, active zones opposite fold crests, calcium at active zones, visible at
    0.35 and rest .55), `junctionalFolds` (AChRs on crests, Na channels in troughs, basal lamina, AChE with
    collagen tail), `nachr` states from `receptorStates`, `antibody` binding by Fab tips. Step 1:
    `spinalCord`, `neuron`, `nerveCable`, `muscleBelly`. Gate row: richer glyphs taken from other rows' height.
    Graphs: EPP area fill, margin as offset dimension band, asymmetric twitch, full-height TOF reveal. Change
    `.on-organ` halo with the tissue fill.
11. **gastric-acid-secretion.** A real rendering bug (mucus and ulcer fills never draw: duplicate fill loses
    to `path()`'s `fill="none"`; use `shape()`) and messengers in the wrong places. Draw `parietalCell` with
    canaliculus and tubulovesicles carrying `transporter kind: 'pump' beta: true`, `gpcr` H2 / gastrin / M
    receptors on the basolateral side, histamine from a neighbouring ECL `endocrineCell` through tissue fluid,
    gastrin arriving by `vessel`, ACh from a `varicosity`, `mucusLayer` with bicarbonate, `mucosaStack` whose
    ulcer breaches the muscularis mucosae, chief cell pepsinogen to pepsin, `stomach` for step 1. Meters: usual
    band drawn, ghost tick inside the bar height, colours off the overloaded amber. Rewrite CHANGE_WHERE.
12. **thyroid-axis.** The shared `axis()` flowchart (12 of 16 steps and both tabs) uses pills and a valentine
    that looks like it wears sunglasses in step 16. Replace with `hypothalamusPituitary` (shared with HPA,
    same layout), `thyroidNeck` with a goitre scale whose labels are placed from current geometry, `vessel`
    with hormone particles, `thyroidFollicle` (iodination at the apical / colloid surface), `thyronine` T4 and
    T3, `heartExterior` with `gpcr` beta-1 for the beta-blocker. Heartbeat trace: P-QRS-T with R height from
    the model and a sweeping head. Keep arrow widths, brake width and counts bound to the model. Add a `ptu`
    data-part in the thionamide step.
13. **blood-pressure-regulation.** Clean but generic, with a bug (step 8's dots leave the nerve at the bend).
    Use `heartSection` or `heartExterior` with squeeze, `vessel` artery versus vein (thick versus thin wall,
    venous valves, veins holding more blood), arterioles with helical smooth muscle and model radius,
    `carotidBifurcation` with CN IX and aortic arch with CN X to the brainstem (`brainSagittal`), cord and
    `sympatheticChain` efferents, vagus direct to the heart, and drug vignettes at the real site: `channel`
    L-type CaV in vascular smooth muscle, `gpcr` alpha-1 on vascular smooth muscle, beta-1 on the heart,
    alpha-2 for clonidine **in the brainstem and on the presynaptic terminal** (never on vascular smooth
    muscle); no receptor for hydralazine. Dots
    follow the drawn nerve path via `sampleAlong`. Bars: ghost inset, gradient, rounded tops; vignettes in
    `change()` only, keep the board within 274 for Explore and Clinical.
14. **immune-response.** Every cell is a disc. Use `neutrophil` (one multilobed nucleus), `macrophage` with an
    engulf morph, `dendriticCell`, `lymphocyte` variants, `plasmaCell`, `antibody` IgG, `mhcTcr`, `cytokine`
    trimer, `vessel kind: 'venule'` with openable gaps, `skinSection`, `lymphNode` (B follicles in cortex, T in
    paracortex, afferent on the convex side), `apoptosis` for killer T cells, `steroid` plus
    `nuclearReceptor` for glucocorticoids, macrophages with an oval eccentric nucleus. Remove the dashed-grey dying cell (it reads as a ghost). Graphs: area fills,
    end-of-curve labels, two-stroke axis break, blue ghost-to-new arrows, vaccine not in harm red; raise the
    secondary-response scale only through presentation or flag it to the model owner. Step 6's counter must
    match the solid cells on screen.
15. **bacterial-cell-antibiotics.** Pills, bricks and a pac-man. Use the layered `bacterium`, `bilayer`,
    `envelope` (LPS outer leaflet only on gram-negative), `peptidoglycanMesh` with crosslink 0 to 1, `pbp`,
    `ribosome70S` with E/P/A sites and exit tunnel, `trna`, `dnaHelix`, `topoisomerase` gyrase and topo IV,
    folate pathway as enzyme blobs with small-molecule nodes; each of the eight drugs gets its own `drug`
    family shape. Keep the human cell to bacterium scale near 8 to 1 and clamp every shape inside 8 to 472.
    Kill-or-stop graph: ink pre-drug segment, branching at the drug line, shaded prevented-growth area.
    Offset step 15's invisible ghost.
16. **cell-cycle-chemotherapy.** Concentric circles and strokes, plus a ring bug (sectors spill because
    `path()` forces round caps; draw sectors as closed `shape()` paths) and an overflowing G0 box. Use
    `cellBody` with `nucleus` (envelope breaks down in mitosis), condensed X chromosomes **only in M phase**
    (chromatin condenses in prophase); in G2 the DNA is doubled but loose (paired loose threads), `dnaHelix` with cut, `replicationFork`, bilobed CDK4/6 with cyclin phosphorylating Rb, generic
    topoisomerase trapped on the cut (do not label I or II), mitotic spindle with vinca stub and taxane lock
    variants, `apoptosis`, tissue insets (`boneLong` marrow, `crypt`, `hairFollicle`). Recheck ARC_SLOTS
    capacity against `CC.settle` ends after resizing arcs.
17. **cardiac-action-potential.** Graphs are sound; the illustrations are a valentine (step 1), a dome heart
    with bundle branches curling upward mid-cavity (step 13), and pill channels. Use `heartExterior` for step
    1, `heartSection` with the conduction overlay and staged activation for step 13 (SA at the SVC and RA
    junction, AV at the septal base above the tricuspid, bundles down the septum, Purkinje up the free walls),
    `cardiomyocyte` chain, `bilayer` plus `channel` (Nav with its hinged inactivation gate on the III to IV
    loop for refractoriness, never ball and chain; L-type Ca; K) and drug plugs. Step 13 uses the RVOT
    `ghost` state, the conduction geometry of the recipe (bundle branches on their own septal faces, no
    internodal tracts) and the true ventricular activation order (septum, apex, free walls, base last). Calcium moves from red to teal. Graphs: 24+ samples per phase, smooth QRS on
    `ecgGrid`, 0 mV and rest references from clinical-values.json, refractory bands behind the trace, slope
    wedges, always an arrow in class IB, faded ECG strip edges. Fix the t = 1 frames that contradict captions
    in steps 6 to 8 and 13 without changing model timings.
18. **autonomic-synapse.** Strong model, icon art. Use `varicosity` with omega fusion, `gpcr` M / alpha / beta
    (never channels), `transporter kind: 'reuptake'`, tethered AChE `enzyme`, `heartExterior` with SA node,
    `vessel` arteriole with alpha-1 receptors and model radius, `bronchiole` cross-section, `eyeFrontal` with
    sphincter and dilator, `adrenalOnKidney` with adrenal veins (right to IVC, left to left renal vein;
    the medulla releases adrenaline and noradrenaline, about 80 : 20),
    `brainSagittal`, `spinalCord`, `sympatheticChain` (ganglia unlabelled). Blood crimson, sympathetic
    signal in its own colour. Fix the playhead crossing row labels (steps 8, 9) and the ACh cluster on the
    header (18, 19). Resolve the unnamed step 22 arteriole narrowing with the owner before drawing it.
19. **oxygen-hemoglobin-dissociation.** Graphs are the lesson's strength; hemoglobin is a pink die and CO a
    black square; steps 12 to 16 are 424 to 452 tall (over the limit). Use `hemoglobin` (alpha2 beta2, four
    hemes, T to R by t, inlined at row size), `o2` / `co` dumbbells, `rbc` with deoxy tint and cutaway,
    `lungsFrontal`, `alveolus` with capillary, systemic capillary beside striated muscle. Re-budget heights to
    420 or less. Graph: mmHg and % ticks (hidden in fallback), area under curve, P50 as an axis tick (model
    value about 26 to 27, not 25), stacked given / reserve column, change arrows at the 50 % level, label
    clearance from axes and ghosts. Use the `ah-` or kit scoping for every new id.
20. **ventilation-perfusion.** Honest model, plumbing art. Rebuild the shared unit with `alveolus` (wall,
    pneumocyte nuclei, gas colour from `sacColor(po2)`), `alveolarCapillary` hugging the sac with model
    width, `rbcStream`, `vqConfluence`; `lungsFrontal` (right 3 lobes, left 2 with cardiac notch, right main
    bronchus shorter, wider, steeper); `bronchiole` with `smoothMuscleCell`, `gpcr` beta-2 and M3, ACh from a
    vagal `varicosity`; `thrombus` in a pulmonary artery branch; `exudate`. Replace the `ghostTube` mask (it
    fragments at zero width) with offset dashed outlines. Fix step 12's cross-fade overlap and the "air in"
    touches. Works for every Explore slider state.
21. **acid-base.** Wireframes and one stick seesaw for 10 of 16 steps. Draw the mechanisms the captions name:
    `tubuleCellRow` with carbonic anhydrase (`enzyme`, blockable) both on the luminal brush border and inside
    the cell (acetazolamide blocks both), secreting H+ and returning HCO3- (steps 8, 13), RBC with carbonic anhydrase beside an `alveolus` (step 5), shrinking volume for contraction
    alkalosis (14), `brainSagittal` brainstem drive (16), an arterial blood-gas syringe (12). Seesaw: shaded
    fulcrum, pans that hang level, ghost that never runs through tokens, x20 / x1 plates or a "one token =
    one sixth of normal" note (keep six tokens). Gauge: stage-1 ghost and always a named change (14).
22. **arachidonic-acid-nsaids.** The pathway logic is good; lollipops, scissors and empty rectangles are not.
    Use `bilayer` with kinked sn-2 tails and the release state, `enzyme` PLA2 docked on the membrane, COX
    dimers with substrate channel (COX-2 with the side pocket), `drug` plug (reversible), selective plug in the
    side pocket, covalent acetyl flag for aspirin, `steroid` 6-6-6-5, `arachidonic` hairpin, product glyphs,
    effect vignettes (`mucosaStack` shield, `platelet`, `bronchiole`, capillary leak of plasma not RBCs,
    nociceptor, hypothalamus). Fix the colour overload (leukotrienes off blue, COX-2 off amber), clip the
    ghost meter line, draw ghost flows above wider live flows. Rewrite CHANGE_WHERE.
23. **pharmacokinetics.** Graphs are 6 to 7 out of 10; the body strip in 11 steps is five pastel boxes.
    Replace with an anatomical strip: `stomach` and `smallIntestine` with a dissolving `tablet`, hepatic
    portal vein into the `liver` (first pass drawn as anatomy), general circulation `vessel` with model
    lumen widths, tissue capillary bed, `kidneyExterior` with ureter and bladder, `ivLine` for the IV step.
    Rebuild BOX, FLOWS, ROUTES and the leader paths from the new anchors; keep widths from `widths(p)`.
    Graphs: shaded lost-on-first-pass area, absorption and elimination fills, steady-state envelope, zone
    tints, value ticks, dose markers, change labels on the correct side of the band; step 5 changed curve not in
    ghost grey.

---

## 7. Hard rules carried over

1. **FORMAT.md "Pictures" rules hold**: 480 wide, at most 420 tall (lab-walk allows 424; design to 420);
   kit text classes only, never under 17 units; no label overlaps a label, dot, arrow or line it does not
   belong to; "What changes it" steps morph from normal at t = 0 to changed at t = 1 over a dashed grey
   ghost and name what moved on the picture in words with an arrow; `role="img"` and an aria-label over 30
   characters describing the finished picture; at least three `<dfn data-part>` per lesson.
2. **Hooks survive.** Every data-part name listed in each brief keeps a target that wraps the drawn
   structure (rename through `parts`, never drop). Every smoke-test hook stays: `data-new-state` and its
   attributes, `class="ghost" data-ghost="normal"`, `data-loop` / `data-final`, `data-model-*`,
   `data-anim`, `data-named`, `data-delta`, `data-flow` / `data-w`, `data-level`, `data-gate`, `data-bars`,
   and the lesson-specific ones in the briefs. Scene contracts (`duration`, `loop`, `loopFrom`, `rest`,
   `stages`, timing windows) do not change unless a lesson note says so.
3. **Model-driven geometry stays model-driven.** Areas, widths, counts, needle angles, bar heights, curve
   points and gate states come from the lesson's model exactly as now. The art redraws the skin over them.
   Where a new shape replaces an old one (the LV cavity), re-tabulate its geometry so the model contract is
   preserved and testable.
4. **No invented clinical facts.** Draw and label only what the captions and sources support. No numbers
   that are not in clinical-values.json. No new structure names, enzyme names, transporter names, nuclei or
   zones unless the caption is extended to teach them. When the art would show something the caption does
   not say (step 22 of ANS), ask the owner.
5. **Accuracy traps listed in each brief are binding**, and so are the orientation rules: anterior view, apex
   down and to the viewer's right, never mirrored.
6. **No em dashes anywhere** (text, labels, aria-labels, comments, commit messages). No en dashes either,
   including number ranges: write "to". lab-check enforces this.
7. **`clinical-values.json` is untouched.** Read from it; never edit it.
8. **Rewrite descriptive text with the art.** Every aria-label, CHANGE_WHERE / WHERE / SEG_LABEL /
   DRUG_LABEL string, readout line, caption in `index.html`, `plan.json` entry and quiz text that names an old
   shape or colour ("pink bar", "cup-shaped", "red rectangle", "darker red: more pressure", "the blue line")
   is rewritten in the same change.
9. **CSS follows fills.** Lesson CSS that hard-codes tissue colours (`.on-organ` halos in RAAS and NMJ)
   changes with the new fills.
10. **Performance.** Per-frame string scenes: shared gradients only, inlined glyph paths (no `<use>`), no
    blur filters, no filters at all on moving geometry; heavy pictures use `mount`. `tools/art-bench.mjs`
    holds each lesson's densest step to 6 ms main thread per frame at 4x CPU throttle, plus one real-device
    check per lesson.
11. **Cache and imports.** Art modules are imported unversioned by one absolute path
    (`/lab/kit/art/<name>.js`); bump each lesson's own `?v=` stamp when its imports change.
12. **Verification is visual.** Shoot every step at t = 0.35 and 1, the rest frame, both tabs, at 1280 and
    375 x 553, and look at the pictures; a green lab-walk is necessary, not sufficient.
13. **Lints** (in lab-check): no hex literal in `lab/kit/art/*.js` outside `core.js`, and none in a lesson's
    art code once that lesson is redrawn (an allowlist shrinks as lessons are ported); no nested `data-part`;
    no `art/*.js?v=`; `fill(` only in fill attributes; every ghost on art has its underlay; no em or en
    dashes.

---

## 8. Build order for `lab/kit/art/`

Nothing goes wide before the owner signs off the bar on one lesson.

1. **Harness first.** `tools/art-bench.mjs` (frame budget), the new lab-walk checks (label-over-art hit test
   with `elementsFromPoint` at 0.35 and 1, `url(#...)` resolves inside its own svg, no scaled `<text>`, art
   ghost above the art), the lints of section 7 rule 13, `tools/measure-type.mjs` writing `art/metrics.js`,
   `tools/palette.mjs` writing `P` and running the contrast checks, and `lab/kit/art/gallery.html` (every
   shared primitive at full size, at 300 px and at 200 px, in its key states), captured with lab-shoot.
2. **`core.js`**: `P`, `artDefs(used)`, `artContext`, `scopeIds`, `uid`, `light`, `behind`,
   `occlusionBreak`, `innerShadow`, `rim`, `lerpPath` (with resampling), `smooth`, `offsetPath`,
   `sampleAlong`, `tube` (`into`, `sinus`), `cutFace`, `leader`, `labelBudget`, `placeLabels`, `magnifier`,
   `inhibit`, `activationWash`. Then the kit changes: `svg()` scoping of `ax-` ids, the `.lx-pic` container
   query for `ax-d2` / `ax-d3`, the teal text class in kit.css, and `global.js` for ADH.
3. **`heart.js`**: `heartSection` as a still, ported from the revision 2 recipe; then `mountLeftHeart` as its
   own long-axis drawing with the re-tabulated area (0.30 to 1.25) and the leaflet-clearance test. Port
   **pressure-volume-loop** end to end, shoot it, and **get the owner's sign-off on the bar**.
4. **The other hearts**: frank-starling-cardiac-output, cardiac-action-potential steps 1 and 13
   (`heartExterior`, conduction overlay), the blood-pressure-regulation heart, `heartIcon`.
5. **`vessels.js`, then `cell.js`** (bilayer, gpcr, channel, transporter, vesicle, cellBody, nucleus,
   epithelium, enzyme, nuclearReceptor; the widest reach, 13 or more lessons). Port blood-pressure-regulation,
   autonomic-synapse and cardiac-action-potential.
6. **`molecules.js` and `blood.js`** (ion, peptide, steroid, drug, rbc), needed by almost every later port.
7. **`kidney.js`**, then nephron-diuretics (`nephronArt`), renin-angiotensin-aldosterone and insulin-glucose.
8. **`lung.js`**, then ventilation-perfusion, oxygen-hemoglobin-dissociation and acid-base.
9. **Lesson-local work on core**: thyroid-axis and hpa-axis-steroids in one pass (shared
   hypothalamus-pituitary drawing), coagulation-cascade, neuromuscular-junction, gastric-acid-secretion,
   immune-response, bacterial-cell-antibiotics, cell-cycle-chemotherapy, arachidonic-acid-nsaids,
   pharmacokinetics; promote any drawing to the library on its third user.
10. **Off-kit lessons last**: adh-water-balance through `global.js`; calcium-pth-vitamin-d only after its
    move to 480 x 420.

`chart.js` is built alongside step 3 (PV's graphs need it) and extended as lessons port.

Redraw priority (1 = worst now) is the order of section 6: 1 PV, 2 FS, 3 NEPH, 4 RAAS, 5 INS, 6 HPA, 7 CA,
8 ADH, 9 COAG, 10 NMJ, 11 GAS, 12 THY, 13 BP, 14 IMM, 15 BAC, 16 CC, 17 CAP, 18 ANS, 19 O2, 20 VQ, 21 AB,
22 AA, 23 PK. The build order above differs from it only where a dependency forces it (a lesson waits for
the shared module it needs, and the off-kit lessons wait for their bootstrap or resize).

---

## 9. Decisions on the critiques

Three critiques were received on revision 1: C1 medical accuracy (32 points), C2 medical illustration
(19 points), C3 build feasibility (15 points). Accepted fixes are applied above and in the recipe.

### C1, medical accuracy

1. Pulmonary trunk appears to arise from the LA. **Accept.** The RVOT is now drawn by default as an opened
   anterior funnel from the RV to the pulmonary valve, never on the LA; the RVOT streamline is restored
   because the connection now exists.
2. Descending aorta appears to drain into the LA. **Accept.** It runs behind the heart in the depth tier and
   reappears below the inferior border with a cut face.
3. Both bundle branches on the RV face, the right one inside the RV cavity. **Accept.** Each branch is now 3
   to 4 units inside its own septal face; the left bundle fans early; His on the crest.
4. cond.png drew an internodal wire. **Accept.** Regenerated from the table; the atrial spread is a wash.
5. SA node in the lumen, AV node in the RA cavity. **Accept.** SA subepicardial in the lateral RA wall at the
   SVC junction; AV inside the atrioventricular septum.
6. RV longer than the LV, RA larger than the RV. **Accept.** RV cavity now about 0.77 of LV length, RA shrunk,
   RV plus infundibulum the larger right chamber.
7. Tricuspid annulus smaller than the mitral; apical offset near the Ebstein range. **Accept.** Tricuspid 56,
   mitral 53. The five-chamber cut has no mitral septal hinge (the anterior leaflet hinges on the aortic
   root), so the offset is not drawn there; the four-chamber variant (`root: false`) puts the tricuspid
   septal hinge at most 10 units (about 7 mm at the implied scale of 1 unit to 0.7 mm) below the mitral's.
8. Squeeze rule inverts wall motion; "base fixed" called physiological. **Accept.** Short axis carries most of
   the change (long axis at most 20 %), the apex is pinned and the annular plane descends with squeeze; the
   text no longer calls a fixed base physiological.
9. Septal tricuspid leaflet tethered to a free-wall papillary muscle; "lateral leaflet". **Accept.** Septal
   chordae go to the septum; the leaflet is named anterior.
10. Wall material follows blood colour. **Accept.** Wall by vessel type, lumen by oxygenation (section 2.3);
    the recipe draws the pulmonary arteries with artery wall and the pulmonary veins with vein wall.
11. No interatrial septum. **Accept both remedies.** A darker interatrial band is drawn behind the root, and
    the AV node is placed "in the atrioventricular septum (triangle of Koch)".
12. Aortic sinuses wrapped in ventricular myocardium. **Accept.** The root has an artery-wall ring.
13. "Receives two pulmonary veins". **Accept (reword).** The two left veins are drawn and the right two are
    stated as hidden behind the RA; drawing them would make them appear to enter the RA.
14. Posterior mitral leaflet too long. **Accept.** About 21 against the anterior's 38.
15. Closed-leaflet text and geometry disagree. **Accept.** Text now says the bodies bow toward the
    ventricle, coaptation below the annulus.
16. Pulmonary trunk opened while vessels are "drawn whole". **Accept.** One stated convention: vessels are
    see-through tubes; valves show only where a chamber or outflow is opened (aortic root, opened RVOT).
17. Label anchors on the panel and between chordae. **Accept.** New anchors checked on the new geometry; RV
    is an in-cavity label clear of the chordae.
18. Arch branches all one width. **Accept.** Brachiocephalic 15, the others 11.
19. Activation default skips the septum. **Accept.** Septum (left to right), apex, free walls endocardium to
    epicardium, base last.
20. Adrenal hormone exit route. **Accept.** Made in cortex or medulla, all leave through the central adrenal
    vein; adrenaline and noradrenaline about 80 : 20 (sections 4.9 and 6).
21. Four domains for every channel. **Accept.** Subunit assembly per kind; K-ATP draws SUR1; ENaC three
    subunits; Cl generic unless named.
22. Nav inactivation as ball and chain. **Accept.** Hinged lid on the III to IV loop, "inactivation gate".
23. Condensed X chromosomes in G2. **Accept.** M phase only; G2 shows doubled loose chromatin.
24. Macula densa in the distal tubule. **Accept.** End of the TAL, between its own arterioles.
25. Peritubular capillaries and vasa recta. **Accept.** From the efferent arteriole; vasa recta only with a
    juxtamedullary nephron.
26. No intracellular receptor primitive. **Accept.** `nuclearReceptor` added; principle 1 reworded.
27. ADH glyph count. **Accept.** 6-bead ring plus 3-bead tail.
28. Calcitriol is a secosteroid. **Accept.** Keeps its own token; the steroid rule excludes it.
29. Alpha-2 at the vascular site. **Accept.** Brainstem and presynaptic terminal.
30. "Veins have valves". **Accept.** `valves` defaults off; never on caval, portal, pulmonary or cerebral
    veins.
31. Heparin as a direct T-bar. **Accept.** Acts through antithrombin on thrombin and Xa.
32. Minor (macrophage nucleus, oxygen colour, TRH beads, acetazolamide sites). **Accept all four.**

### C2, medical illustration

1. Pulmonary trunk from the LA. **Accept** (same fix as C1.1), drawn opaque in front rather than at 70 to 80 %
   opacity: translucent blue over red reads as mud, and the RVOT is truly anterior, so opaque is honest; the
   aortic valve and sinuses stay visible below it.
2. Descending aorta into the LA; a `behind()` tier. **Accept.** `behind()` and `occlusionBreak()` added to core.
3. Lighting makes balloons. **Accept.** Exteriors volume-lit from one user-space light; sections flat with an
   endocardial shadow; no speculars on cut faces or blood (sections 1 and 2.6).
4. Ghost invisible on tissue. **Accept.** Two-layer ghost above the art (panel underlay, `#53584d` dash).
   The proposed "3:1 against whatever it crosses" test is replaced by "every art ghost has its underlay",
   because the dash is then always measured against the underlay (6.3:1).
5. Chamber colours merge on a phone. **Accept.** Myocardium `#d9a08f` / `#a86a5c`, septum one step darker.
6. Plum breaks convention and collides with drug purple. **Accept.** Muted venous blue as a volume or lumen;
   kit blue stays a flat mark (the same rule as red). Plum retired.
7. Fang leaflets, invisible chordae, floating papillary muscles. **Accept.** Thin sails, chordae fans at 1 unit
   in the valve line colour, papillary cones grown from the wall.
8. Conduction overlay contradicts the rules. **Accept** (same as C1.3 and C1.4), and the overlay uses
   `P.conduction`.
9. Squat outline; squeeze moves the apex and cuts the septum. **Accept the outline and the pinned apex,
   reject "outer surface changes 4 % or less".** Height is now about equal to width with a pointed apex and a
   tilted long axis; the apex is pinned and the septum's RV face is fixed. Conserving muscle area (a model
   contract and the teaching point "the wall thickens as it empties") requires the outer free wall to move by
   about the stroke area, so the 4 % cap cannot hold; collisions are prevented by pinning instead.
10. Lollipop root, mixed vessel styles, patch rectangles. **Accept.** Root drawn as artery wall with sinuses
    (`tube({ sinus })`); `tube({ into })` replaces patch rectangles in the library (the recipe still shows
    the patches as the reference for what `into` must produce).
11. Recipe off palette and tiers. **Accept**, with the lint scoped to art modules and to lessons as they are
    redrawn (an allowlist), because unported lessons legitimately hold their current hex values.
12. Too many one-off primitives; missing depth, occlusion, rim, user-space light, resampling lerp.
    **Accept.** Three-user rule (section 4.0a), one return type, and all five helpers added to core.
13. Weight vs geometry strokes; sub-pixel detail; gradient strokes. **Accept.** Section 2.7 split; detail 0.9,
    internal 1.1, outline 1.75; gradients never on strokes.
14. Label layout cannot be met. **Accept.** In-cavity chamber labels allowed, leaders for small parts, one
    column of 150, label budget computed first (verified in `frame375.png`).
15. Hue collisions. **Accept.** Insulin re-keyed (teal-green, shape-separated from calcium), nuclei
    hematoxylin blue-grey, ADH slate and lighter than bicarbonate, noradrenaline bronze, hilum separation
    outlines, mandatory outlines under 1.5:1.
16. No rule for new colours. **Accept.** OKLCH families with fixed lightness steps (section 2.8); the tables
    become generated output.
17. Defs size and per-frame defs. **Accept.** `artDefs(used)`; patterns user-space, built once per mount.
18. Left heart as a crop. **Accept.** Separate long-axis drawing sharing parts and contract.
19. Smaller drawing issues. **Accept all five**: septum bowed into the RV, arch about 0.8 of revision 1 with
    branches thinner than the trunk, aortomitral continuity visible, see-through vessels stated as the
    convention, and endocardial shadows (not white outlines) separating cavities.

### C3, build feasibility

1. LV cannot draw the model's volumes. **Accept.** Range re-tabulated to 0.30 to 1.25, short axis carries the
   change, leaflet-clearance test, precomputed `h(a)`.
2. Mount scenes bypass `svg()`. **Accept.** `artContext(svgEl)` with per-svg prefix and `html()`.
3. Off-kit lessons cannot load the library as written. **Accept.** `global.js` bootstrap for ADH; CA's move to
   480 x 420 is a prerequisite and the 17-unit-type fallback is dropped.
4. `data-part` nesting. **Accept.** Leaf parts only, multi-name form, wall territories, lint.
5. Level of detail from `s`. **Accept.** Container-query classes and the `emphasis` option.
6. Ghost on filled art. **Accept** (merged with C2.4); `outline(state)` on every stateful primitive;
   resampled lerps or still-only cross-fades for topology changes.
7. Darkening by gradient stops. **Accept.** Squeeze overlay.
8. objectBoundingBox traps. **Accept.** Fills only, tubes as layered strokes, four counter-rotated variants
   for rotated glyphs; large exteriors use user-space gradients anyway.
9. Drop shadow on moving geometry. **Accept.** Static groups only; offset `lo` copy for moving outlines.
10. Performance and `<use>`. **Accept.** Inline paths in string scenes, `<use>` in mount scenes, a 6 ms budget
    in `tools/art-bench.mjs`.
11. Cache reasoning and double module instances. **Accept.** Unversioned single-spelling imports, lint.
12. NEPH does not fit a mount primitive; `WATER` is kit blue; captions name colours. **Accept.**
    `nephronArt` string primitive, `part()` for bicarbonate, water drop colour, rule 8 covers captions.
13. Labels and checks. **Accept.** Layout once per scene over union boxes, measured `metrics.js`, four new
    lab-walk checks.
14. Library scope. **Accept** (with C2.12): three users and an accuracy sign-off per shared primitive.
15. Minor (one myocardium gradient, teal class, muddy dimming). **Accept the first two**; the single
    panel-coloured veil for dimming is **accepted as a kit experiment**, tried on PV first and adopted only if
    lab-walk's highlight checks still pass, because it changes kit behaviour for all 23 lessons.

Rejected or modified in part: C2.1 (opacity), C2.4 (form of the contrast test), C2.9 (4 % outer cap), C2.10
(patches kept in the recipe only as a reference), C2.11 (lint scope), C3.15 (veil as an experiment). Nothing
else was rejected.
