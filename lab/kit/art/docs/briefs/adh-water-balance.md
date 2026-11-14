# Redraw brief: adh-water-balance (Lesson 22, ADH and water balance)

Audited 2026-11-12 from 32 captures (16 steps x t=0.35, t=1) in
`scratchpad/audit/shots/adh-water-balance/`. Overall grade: **3 / 10**.

## How the pictures are built today (what a redraw must respect)

- This lesson is **not on the kit**. It loads `js/sources.js, draw.js, states.js, picture.js, predict.js,
  values.js, explore.js, quiz.js, lesson.js`, then `app.js`. Its own `js/draw.js` copies the kit
  palette `C` and helpers; `svg()` scopes arrow markers per picture by rewriting `url(#ah-` to
  `url(#adh<N>-ah-`.
- **Every step draws one shared schematic** (`A.picture.schematic(o)` in `js/picture.js`), revealing
  parts step by step via `show` sets (`UP_TO` in app.js; `FULL` for steps 9-16). Step 1 has its own
  close-up (`osmoScene`). The Explore tab (`js/explore.js`) draws the same `schematic` at h=420.
- Fixed geometry constants: `V` (vessel y 122-164), `CELLBOX` (10,180,282x78), `LUMEN` (y 258, h 38),
  `RECEPTORS` x [90,160,230], `CHANNELS` x [36..256], `FLASK` (x196, top 318, bot 412), gauges
  `G`/`GY` (x 300, rows 172/216/260/304), sodium track `NA` (y 372, lo 328, hi 448), callout box
  (196,8,282x86), legend (12,316).
- Levels are qualitative 0..1 positions from `LV` in picture.js, looked up from the quoted state table
  in `js/states.js`. **Nothing is computed from physiology; no number is drawn.** Baseline ADH,
  aquaporins and urine concentration are `unstated`; the building steps override with
  `adhUnknown: 0` etc. `unstated` parts draw hollow/dashed and gauges read "not stated".
- Flags in the level object drive special drawings: `block` (AVP resistance: red X on receptors),
  `extra` / `lost` (water in/out arrow), `hollow` (sodium marker), `adhUnknown`, `aquaUnknown`,
  `volUnknown`, `concUnknown`.
- Hooks: `data-part` names `solute, osmolality, hypothalamus, osmoreceptor, blood, pituitary, adh,
  duct, receptor, aquaporin, water, flask, sodium` (all used by caption `<dfn>`; lesson.js lights
  `[data-part]` whose space-separated names match). Also `data-gauge`, `data-word`, `data-callout`,
  `data-legend`, `class="ghost" data-ghost="normal"`. Scene options: `duration, loop, loopFrom: .5,
  rest, stages` (feedback). `changeScene` announces via `#lesson-live` once m reaches 1.
- Sources quoted in `js/sources.js` support: ADH released from the posterior pituitary; made in the
  hypothalamus, stored and released by the pituitary; binds the **type-2 receptor in principal cells
  of the collecting duct**; aquaporins move **from the interior to the apical surface** and are
  inserted; removed again when ADH falls; water passes out of urine into blood. Nothing quoted names
  AQP3/AQP4, cAMP/PKA, supraoptic/paraventricular nuclei or OVLT: **draw those structures only
  anonymously or not at all; do not label them.**

## What is wrong across the whole lesson

1. **Nothing looks like anatomy.** The brain is a plain ellipse with three grey squiggles; the
   hypothalamus is a blue ellipse inside it; the pituitary is two 8-unit beads. The "collecting duct
   cell" is a cream rounded rectangle; the duct is a yellow bar; receptors are U-cups; aquaporins are
   blue pills; the blood vessel is a pink band between two red lines with black dots. No walls, no
   nuclei, no membranes, no depth, no shading.
2. **The cell is not a cell.** One giant rectangle stands for the epithelium. Industry figures
   (Osmosis, Lecturio, BioRender "ADH mechanism") show a row of principal cells with nuclei, an apical
   membrane facing the lumen, a basolateral membrane facing an interstitium and a peritubular
   capillary, the V2 receptor as a 7-pass GPCR, and AQP2 in membrane-bound vesicles fusing into the
   apical bilayer.
3. **Label collisions** (FORMAT violation): the vessel word ("more concentrated ↑", "in its range",
   "not stated") is drawn on top of moving ADH dots and solute dots (s03, s07, s09, s10, s11, s15);
   water drops cross "collecting duct cell" and pass through the receptor cups (s06-s12); in SIADH the
   flask's "volume: / not stated" sits on the "typical day" ghost line and the "minimum needed" tick,
   and the urine-volume gauge draws a dashed ghost box over its own "not stated" words (bug: `gl()`
   checks only the ghost's unknown flag, not the current state's).
4. **Hierarchy is flat.** Every label is bold 17 ink with a paper halo; the eye has nowhere to go.
   The callout panel (282x86) takes the top-right quarter of every frame and in step 8 at t=.35 it is
   a box with one heading and two empty rows.
5. **Motion that does not read.** Water drops in the urine scroll sideways forever even before any
   channel exists, and look identical to the reabsorbed water; the "water lost / water in" arrow
   floats beside the brain with no source (no mouth, no skin); osmoreceptor "firing" is rings on dots
   the size of a full stop.
6. **Conceptual mismatch in steps 4-6:** ADH is "high ↑" while the blood says "in its range"
   (BASE blood + HIGH adh). It contradicts step 2-3's rule (ADH rises because blood is concentrated).
7. **Change steps barely use the ghost on the picture.** The dashed "normal" appears on gauges,
   flask line and sodium dot only; the cell (channels, docked ADH) has no ghost, and no on-picture
   arrow names what moved (the gauge words carry the arrows). The legend's solid black swatch
   ("dehydrated", "too little ADH") matches nothing black in the picture.
8. Palette is fine in intent (water blue, ADH amber, urine yellow ramp, plasma pink ramp) but flat
   fills with 2-3 px ink outlines everywhere read as clip art.

## Global redraw direction (applies to every step)

Keep the **one-schematic architecture and every constant's role**, but replace each part renderer
with an illustrated version. Layout stays 480 wide, h 300/310/420 as now.

- **Style system**: 1.5 px outlines in a darker tone of each fill (not ink) for organic parts;
  ink 2 px only for instruments (flask, gauges). Soft linear/radial gradients for volume (tissue
  highlight top-left). Define gradients once in `svg()` `<defs>` and **scope their ids per picture**
  the same way markers are (extend the `url(#ah-` rewrite to a general `url(#` prefix, or build ids
  from `uid`). Leader lines: 1.25 px muted with a 3 px dot on the structure end.
- **Palette** (extend `C` in js/draw.js, do not change kit values): tissue cream `#f6e7d8` -> shadow
  `#e3c6a8`; nucleus `#8c6bb1` wash `#d9cdea`; brain grey-pink `#ecd9d6` -> `#cfa9a4`, gyri lines
  `#b98d88`; hypothalamus highlight `C.blueWash` + `C.blue` outline (it is the taught thing);
  posterior pituitary amber wash `#f3d3b4` + `C.amber`; anterior pituitary muted `#e6dfd2`;
  vessel wall `#c9544a` outer / `#e9a49b` inner, plasma ramp `bloodFill` kept; RBC `#c43a2f` with
  `#e57a70` centre; membrane bilayer heads `#e8b04a`, tails `#f7e3b5`; water `C.blue`; ADH
  `C.amber`; urine ramp `urineFill` kept.
- **Typography**: structure names `.xs` regular ink with leader lines; the one taught term per step
  `.sm b blue`; state words `.xs b`. Never place a word inside the vessel band or on a moving layer:
  give the vessel word a tag (pill) **outside** the band at its right end (x 400-478, y 100-120) or
  reserve a dot-free zone x > 380 in the band.
- **Callout**: shrink to a 2-line banner (head + one line) or move into the player readout so the
  picture gets the space; never show empty rows (step 8: reveal lines as stages advance, box height
  follows the line count).

### Part-by-part redraw (shared by all steps)

| Part (data-part) | Now | Redraw |
|---|---|---|
| brain + hypothalamus (`hypothalamus`) | ellipse + squiggles + blue ellipse, label on cerebrum | Mid-sagittal brain silhouette in the same box (x 6-186, y 8-96): cerebrum with 6-8 gyri/sulci strokes, corpus callosum arc, thalamus, brainstem stub and a hint of cerebellum at the back; the hypothalamus a blue-washed region at the floor of the third ventricle, just above the stalk. Label "hypothalamus" outside the silhouette with a leader to the blue region. |
| osmoreceptors (`osmoreceptor`) | four 3.6 r dots with rings | 3 small neuron somata (teardrop with nucleus, r 5-6) inside the hypothalamus region; firing = soma brightens to `C.blue`, a short spike travels down a dendrite/axon and 2 concentric arcs pulse. Keep `firing(L)` as the driver. Do **not** name OVLT. |
| pituitary (`pituitary`) | two beads + dashed amber line | Infundibulum (stalk) descending from the hypothalamus to a pituitary in the sella (a light bone-coloured cup under it): anterior lobe muted grey-beige, posterior lobe amber wash, labelled "posterior pituitary" with a leader. One hypothalamic neuron drawn soma (in hypothalamus) -> axon down the stalk -> terminal bulb in the posterior lobe with amber granules (supports "the hypothalamus makes it; the pituitary stores and releases it"); granule count and terminal glow scale with `L.adh`. A small capillary loop under the posterior lobe receives the released ADH and joins the main vessel. Do not name the nuclei. |
| ADH (`adh`) | 5.5 r amber dots | Small peptide glyph: an amber 9-bead chain curled into a ring with a tail (ADH is a 9-amino-acid peptide with a disulfide ring; drawn schematically, no residue labels), r about 6, white 1 px rim. Hollow/dashed version kept for `adhUnknown`. |
| blood vessel (`blood`) | pink band, 2 red lines, black dots | Vessel with a wall: outer adventitia stroke, a 4-unit wall band in vessel red gradient, a thin endothelial line, lumen filled by the `bloodFill(L.blood)` plasma ramp with a soft top highlight. Add 4-6 RBCs (biconcave discs, constant number and size, drifting with phase) so it reads as blood; solutes as small grey-ink ions (r 2.6) whose count tracks `L.blood` as now. Left end labelled "blood" outside the lumen; right end shows a cut (wavy break) because the vessel is schematic between head and kidney. Over the duct, show the wall thin and the vessel labelled as capillary only if the caption allows (it says "blood on the other side"); otherwise keep "blood". |
| collecting duct cell (`duct`) | one rounded rectangle | A row of 3 cuboidal principal cells (CELLBOX area, each about 90 wide, rounded corners 6, cream tissue gradient), each with an oval nucleus (purple wash) and tight-junction marks between them at the apical edge. Top (basolateral) membrane faces the vessel across a thin interstitium strip (y 166-178, pale); bottom (apical) membrane faces the lumen. Label "principal cell" is not in the caption; label stays "collecting duct cell" with a leader, placed in the interstitium gap or to the left outside, never under moving water. |
| apical membrane | a line | Draw the apical edge as a lipid bilayer strip (two rows of head circles r 2.2 with paired tail lines, 8-10 units thick) along y around 256, so inserted channels sit **in** a membrane. |
| receptor (`receptor`) | U-cup | V2 receptor as a 7-transmembrane serpentine (7 vertical loops crossing the basolateral membrane, muted purple-grey), with an open extracellular pocket at the top that the ADH glyph docks into; docked = the receptor turns `C.amber` outline and a small blue "signal" spark travels into the cell toward the vesicles (no cAMP label). `block` (AVP resistance): keep the red X but draw it as a clean red "no" cross over the pocket plus the word "no response" tag outside, and the spark does not fire. |
| aquaporins (`aquaporin`) | blue pills in dashed circles | Stored state: AQP2 inside small membrane vesicles (circle bilayer r 13 with head-dots), each holding a channel glyph. Channel glyph: hourglass/tetramer pore (two blue trapezoids meeting at a narrow waist, white pore line), 12 wide x 22 tall. Insertion: vesicle moves to the apical bilayer, fuses (bilayer opens), channel ends seated across the bilayer. Keep `insertion(L,i)` and the 6 x positions. Hollow-dashed glyph kept for `aquaUnknown`. |
| water (`water`) | blue drops | Keep the drop but smaller (r 3.5) and only on the reabsorption path: lumen -> through the channel waist (squeeze) -> across cytoplasm -> out the basolateral side (no labelled channel) -> interstitium -> vessel. Path must avoid the label boxes and the receptors (route between receptor x positions). The lumen's own flow becomes faint urine-coloured streak lines (no blue drops), so blue means "water being reabsorbed". |
| lumen | yellow bar | Tubule lumen with an epithelial floor hint (a second thin cell row at the bottom edge, cut away) so it reads as a tube in section; fill `urineOf(L)`; flow streaks move left -> right toward the exit pipe. |
| flask (`flask`) | rectangle beaker | Graduated collection cylinder: glass with a left highlight stripe, a rim lip, meniscus curve on the urine surface, `urineFill` with a vertical gradient. Keep `TYPICAL_VOL` / `MIN_VOL` marks as ticks outside left with their words. Add an on-picture change arrow beside the flask during change steps ("fills more ↑" / "fills less ↓") from the ghost line to the new level. For `volUnknown`, draw a grey dashed band without "volume:/not stated" inside the flask; put "volume not stated" as a tag to the right of the flask (x 292-300 is too narrow: use above the flask, y 300-316). |
| gauges (`adh`, `aquaporin`, `flask`, `sodium`) | flat bars | Rounded 13-unit pill tracks with inner shadow, fill in the part colour with a slightly lighter top half; ghost = dashed ink tick (a vertical 20-unit dashed marker at the baseline level) rather than a dashed box (box overlaps text). Fix `gl()` so no ghost is drawn when the current state is unstated. |
| sodium track (`sodium`) | already clear | Keep. Add tiny tick labels "low" / "high" under the shaded ends only if no overlap; marker gets a soft shadow. |
| water in / lost | arrow next to brain | Anchor to a source: a small mouth/cup glyph ("drinking") with arrow into the vessel for `extra`; a sweat-drop/heat glyph with arrow out for `lost`. Place at the vessel's left end (x 10-60, y 84-120), label beside. |
| legend | dashed line + solid black swatch | Dashed grey line = "normal"; the new-state key should be a solid colour line in `C.blue` (matching the change arrows) or drop the swatch and keep only "dashed = normal". |

## Per-step brief

### Step 1 `osmo`: How concentrated is the blood? (grade 4)
Problems: flat pink strip; water drops and solute dots float on the band with no sense of a vessel;
meter is fine but generic; legend swatches "paler/deeper" duplicate the meter.
Redraw: top half a vessel segment in longitudinal cutaway (wall layers, endothelium, plasma ramp,
3-4 RBCs for identity) with a **magnified circular inset** (lens, r about 60, leader to the vessel)
showing water molecules (blue drops) and solute particles (grey ions) at the same particle count;
as water leaves, drops fade out of the inset and the plasma deepens. Keep the meter (data-part
`osmolality`) as the bottom instrument: rounded track, healthy band blue wash, needle as a
triangle pointer with stem. Replace the two swatches with a small gradient strip under the vessel
labelled "paler: dilute -> deeper: concentrated". Keep `solute`, `water`, `blood` parts and the
"water lost / water added" words (place them in a fixed tag, not floating).

### Step 2 `sensor`: A sensor in the brain (grade 3)
Problems: brain unrecognisable; "hypothalamus" sits on the cerebrum; firing rings tiny; big
empty right half below the callout.
Redraw: show the brain sagittal silhouette **larger** for this step (scale 1.4 into the left 260 x
190), hypothalamus highlighted, three osmoreceptor neurons inside it firing (spikes along short
axons). Vessel beneath with plasma ramp; a dashed sampling arrow from the vessel to the
hypothalamus ("senses the blood"). Meter stays bottom-left. Vessel word in an external tag.

### Step 3 `release`: The pituitary releases ADH (grade 3)
Problems: pituitary is two beads; no axon from hypothalamus; ADH dots overlap the vessel word.
Redraw: add stalk, sella, anterior (muted) and posterior (amber) lobes, one magnocellular-style
neuron (unlabelled) running from hypothalamus to the posterior lobe, ADH granules travelling down
the axon and released into the small capillary under the lobe, then into the vessel. Release rate
from `L.adh`. ADH gauge right. Callout trims to 2 lines.

### Step 4 `duct`: ADH travels to the kidney (grade 3)
Problems: cell is a box; cups are not receptors; "in its range" contradicts ADH high; no
indication this is in the kidney.
Redraw: small kidney silhouette (bean, cortex/medulla tint, one collecting duct traced through a
pyramid) at top right with a zoom wedge into the epithelium cutaway (3 principal cells, nuclei,
interstitium, apical bilayer, basolateral V2 serpentine receptors). ADH glyphs leave the vessel,
cross the interstitium and dock into receptor pockets (`dock` easing kept). Change the blood
level here to concentrated (or hide the vessel word) so ADH-high is consistent.

### Step 5 `channels`: ADH opens water channels (grade 3)
Problems: dashed circles are not vesicles; pills sit on, not in, a membrane.
Redraw: AQP2 hourglass channels in bilayer vesicles; on docking a signal spark runs to the
vesicles; vesicles travel to the apical bilayer and fuse, channels seated across it. Gauge
"water channels" fills. Label "apical membrane" is not in the caption, so label as "membrane facing
the urine" with a leader (matches the caption wording).

### Step 6 `water`: Water goes back into the blood (grade 3)
Problems: drops pass over the cell label and through receptor cups; lumen drops identical to
reabsorbed drops.
Redraw: blue water only on the reabsorption route, squeezing through each channel waist, crossing
the cytoplasm between nuclei, leaving the basolateral side into the interstitium, entering the
vessel (which pales slightly). Lumen flow as faint streaks. One curved blue arrow beside the
route "urine -> cell -> blood".

### Step 7 `output`: Less urine, and more concentrated (grade 3)
Problems: whole loop crammed; flask is a box; exit pipe a rectangle.
Redraw: whole loop in the new style, exit as a tapered tubule into the graduated cylinder; cylinder
fill level and colour ramp driven as now; the two reference ticks outside. Gauges as pills.

### Step 8 `feedback`: The loop switches itself off (grade 3)
Problems: empty callout rows at stage 1; feedback has no visual loop.
Redraw: add a thin blue return arc (dashed until active) from the vessel back to the hypothalamus
with a "-" (minus) badge when blood returns to range, so negative feedback is visible; callout lines
appear one per stage with the box growing. Keep `stages`.

### Step 9 `sodium`: Sodium, the main particle (grade 4)
Problems: the sodium track itself is clear; the rest repeats step 10.
Redraw: highlight the sodium gauge (others dimmed to 40%), and in the vessel render solutes as
labelled Na+ ions in a small lens inset (one "Na+" text 17 units next to an ion glyph). Track:
keep shaded ends and red limit lines; add "hyponatremia" / "hypernatremia" small tags under the ends
(caption terms) only if they fit without overlap; else rely on the caption.

### Step 10 `whole`: The whole loop (grade 3)
Redraw: the full illustrated loop; same fixes as step 7 plus the feedback arc from step 8. This is
the hero frame; it must read on a 375 px phone, so dim (60%) whatever the current loop phase is not
acting on.

### Steps 11-16 change states: `deficit`, `excess`, `avpd`, `avpr`, `siadh`, `pp` (grades 3-4)
Problems: ghost only on gauges/flask/sodium; nothing on the cell or pituitary shows "normal";
legend's black swatch matches nothing; vessel word overlaps dots; SIADH flask text overlaps marks
and a ghost box overlaps "not stated" in the volume gauge.
Redraw (shared): at t=0 the illustrated normal; morph to the state over dashed `#8a8f84` ghosts on
(a) flask level line, (b) gauge baseline ticks, (c) sodium marker, and (d) where the baseline is
stated, nothing else (baseline ADH/aquaporins/concentration are unstated, so no ghost there, which
is correct). Add one on-picture blue arrow with words per state at the part that moved most:
deficit "less urine ↓" at the flask + "water lost" source glyph; excess "more urine ↑" + drinking
glyph; avpd posterior pituitary dims with "little ADH ↓" tag at the lobe; avpr receptors show the
red "no" cross and "no response" tag at the receptor row; siadh pituitary keeps releasing with an
amber "stays on" tag and sodium marker arrow into the low zone; pp drinking glyph large with "water
in ↑↑" and flask "more ↑". Legend: "dashed = normal" only (or a blue line keyed to the state).
Fix the SIADH overlaps as listed under flask and gauges.

## Reusable primitives this lesson needs

- Mid-sagittal brain silhouette with hypothalamus region, stalk, pituitary (anterior/posterior lobes)
  in the sella; scalable.
- Neuron (soma with nucleus, axon, terminal bulb with granules), firing state.
- Blood vessel segment, longitudinal cutaway (adventitia, wall, endothelium, lumen with plasma ramp,
  RBC discs), wavy cut ends.
- RBC biconcave disc glyph.
- Magnifier lens inset with leader.
- Epithelial cell row (cuboidal cells with nuclei, tight junctions), polarised apical/basolateral.
- Lipid bilayer strip (straight) and bilayer vesicle (circle), with fuse animation.
- GPCR 7-transmembrane serpentine receptor with ligand pocket; docked and blocked states.
- Aquaporin hourglass channel glyph (in-membrane and in-vesicle states, hollow variant).
- Peptide hormone glyph (small bead ring with tail), hollow variant.
- Water drop / water molecule glyph; ion glyph with optional label.
- Kidney silhouette with cortex/medulla and a zoom wedge.
- Graduated cylinder with meniscus and gloss, fill-level + colour-ramp animatable.
- Pill gauge with baseline ghost tick; range track with shaded ends.
- Drinking (cup) and water-loss (sweat/heat) source glyphs.
- Negative-feedback return arc with minus badge.
- Leader-line label and external tag pill.

## Risks

- `schematic()` is shared by all 16 steps **and** the Explore tab: a renderer change lands everywhere;
  re-shoot all steps and Explore (every state) after each part.
- Geometry constants (`V, CELLBOX, LUMEN, RECEPTORS, CHANNELS, FLASK, G, GY, NA`) are used by drop
  paths, docking (`lerp(V.mid, 178, dock)`), insertion (`lerp(232, LUMEN.y, p)`) and exit pipe; move
  them together or the animations detach.
- Levels come only from `LV` + the quoted `STATES` table; a redraw must not add levels, numbers or
  directions the sources do not state (baseline ADH/aquaporins/concentration remain unstated; SIADH
  aquaporins/volume/concentration and PP ADH remain "not stated"; AVPD/AVPR blood and sodium remain
  not stated). Do not have osmoreceptors fire in AVPD unless `firing(L)` says so.
- Do not label AQP3/AQP4, cAMP/PKA, supraoptic/paraventricular nuclei, OVLT: not in sources.js.
  "type-2 receptor", "principal cells", "apical surface" are quoted and safe.
- Keep every `data-part` name (`solute, osmolality, hypothalamus, osmoreceptor, blood, pituitary, adh,
  duct, receptor, aquaporin, water, flask, sodium`); the multi-name dfn `osmoreceptor adh` must still
  light both. Keep `data-gauge`, `data-word`, `data-callout`, `data-legend`, `.ghost[data-ghost=normal]`.
- Gradient/clipPath/filter ids must be per-picture scoped (multiple SVGs on one page, plus Explore);
  the current `svg()` only rewrites `url(#ah-`.
- Scene contract: keep `duration, loop, loopFrom: .5, rest, stages`; only `t` may move the picture
  (no CSS animation, no Date.now()).
- Type floor 17 units and no overlaps: the 480 x 420 frame is already full; adding anatomy means
  shrinking the callout and moving vessel words out of the band, or the new detail will collide.
- Phone legibility: keep strokes >= 1.25 units and glyphs >= 10 units; bilayer head dots below r 2
  will vanish at 375 px.
- This lesson is off the kit: if the redraw moves it onto `/lab/kit/draw.js`, palette names and
  helper signatures differ (e.g. `arrowFixed`), and `lesson.js` part-lighting must still work.
