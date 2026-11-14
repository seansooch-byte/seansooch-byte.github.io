# Redraw brief: coagulation-cascade (Lesson 12, 19 steps)

Audited 2026-11-13 from captures at t=0.35 and t=1 (shots in `scratchpad/audit/shots/coagulation-cascade/`), plus
`lab/coagulation-cascade/{index.html,app.js,style.css}`. Overall grade **4/10**.

## What it is now

There are two picture families, plus two one-off scenes:

1. **Vessel family** (steps 1-6, 18, the Clinical tab, and the `clotBand` strip under every ladder). It is a side view of a
   vessel: two flat salmon bars for the walls, a beige tissue band, a gap for the tear, red ellipses with a pale centre for
   RBCs, small blue-outlined ellipses for platelets, 8-point blue stars for activated platelets, brown rods for fibrinogen,
   and brown quadratic curves for fibrin. It is clean and readable but schematic clip art. The wall has no layers (no
   endothelium, no smooth-muscle media, no adventitia), so "vascular spasm" (muscle) and "collagen under the lining" have
   nothing to sit on. The plug is a hexagonal lattice of identical stars. Fibrin is a scribble that overruns the plug into
   the wall and tissue.
2. **Ladder family** (steps 8-17 and Explore freely). These are white flowchart boxes, each with a blue progress bar, plus
   red T-bars, K badges and X/+ glyphs. It reads as a UI dashboard, not a cascade figure. Nothing shows zymogen to active
   enzyme, the phospholipid surface, calcium or cofactors.
3. **One-offs.** `switches` (step 7) uses iOS-style toggle switches in a binary tree. `lytic` (step 19) shows a 4x7 grid
   of stars between two flat bars.

The biggest gap is that nothing looks like biology: platelets are stars, the vessel is two planks, and the cascade is a
settings panel. Second are **accuracy defects** (proteins C and S drawn braking thrombin; the DTI readout says thrombin
"less made") and **overlap or clipping defects** (WORDS label on top of RBCs, K badges clipped at the frame edge, cells
cut in half by the clot band's clip).

## Accuracy defects (fix regardless of the redraw)

- **Proteins C and S T-bar points at thrombin** (`ladder()`, `tbar('M324 190 ... 311 184')` lands on the thrombin box,
  y 158-198). Activated protein C, with protein S, inactivates **factors Va and VIIIa**, not thrombin. Redraw: add small
  cofactor chips, "VIIIa" on the intrinsic-to-X arrow and "Va" on the X-to-thrombin arrow, and aim the C/S T-bar at
  those chips. The caption calls C and S "brakes" without naming targets, so this is safe.
- **DTI readout**: `compare()` says Thrombin "less made" under a direct thrombin inhibitor. DTIs block thrombin's
  *activity*, not its formation. The model multiplies `thrombin` by `(1-0.8*dti)`. The fix is to split thrombin into
  `made` and `active`, or to word the row "less active" when only `dti` acts. The picture should show the thrombin node
  present but jammed (drug glyph in its active site), not a shrunken bar.
- **Intrinsic box text "contact, XI, IX"** omits XII, which the caption names ("factors XII, XI and IX"). Use
  "contact: XII, XI, IX". Optionally add "VIIIa" as the cofactor chip (see above).
- **K badges**: the badge on "tissue factor, VII" and on "contact, XI, IX" sits on the whole box. Tissue factor and XI
  are not vitamin-K dependent. Put the K badge on the **VII** and **IX** tokens specifically, and on X and II.
- **Step 9 caption** says Xa works "with calcium on the platelets' surface". The picture shows no surface. Draw the
  X-to-thrombin conversion sitting on a platelet membrane strip with "Ca²⁺". Build the superscript with chr() (see memory:
  no typed \u escapes).
- **Step 10 caption** names factor XIII cross-linking the net. Nothing is drawn. Add small cross-link dots on fibrin
  crossings with a "XIIIa" label (or leave it unlabeled and let the dfn have no part, but a dot is cheap).
- **Step 6 `<dfn data-part="fibrin">`** lights nothing: `meshBody(0)` returns an empty `fibrin` group, and the inset
  fibrin threads are not wrapped in `part('fibrin', …)`. Wrap the inset threads.

## Shared visual language for the redraw (applies to every step)

Palette, extending `C` in `lab/kit/draw.js` and keeping the FORMAT colours:

| thing | fill | stroke / detail |
|---|---|---|
| blood plasma (lumen) | linear gradient `#f7e3de` (centre) to `#f0d2ca` (near wall) | none |
| endothelium (intima) | single row of flat cells `#f3c9bd`, nuclei `#c98476` | ink 1.2 |
| smooth-muscle media | `#d98f80` with spindle cells (elongated ellipses `#c77768`, nuclei darker) | ink 1.5 outer edge |
| adventitia / tissue | `#ead9c0` with wavy collagen strokes `#b08a55` at 30 % | none |
| exposed subendothelial collagen | bundle of 3-4 parallel wavy strands `#7c6036`, 2.4 w, with light highlight strand | |
| RBC | radial gradient `#d9574a` rim to `#e98d82` centre (face-on) or dumbbell biconcave profile (edge-on) | `#962a1f` 1.2 |
| resting platelet | **lavender** discoid lens `#d9d0f0` with 3-4 purple granule dots `#6b3fa0` | `#6b3fa0` 1.2 |
| activated platelet | lavender rounded body with 4-7 irregular **filopodia** (curved tapering spikes, not star points), granules gone or fewer | `#6b3fa0` 1.4 |
| fibrinogen | short trinodular rod (three beads joined: D-E-D) `#a36a1f` | |
| fibrin | long strands `#8a4f00` 2.4 w, with a lighter 1 w highlight offset 0.8 and faint periodic band ticks | |
| thrombin / enzymes | protein glyph: rounded blob with a notch (active site) | |
| drug glyphs | red `#b3261e` (block) / blue (boost), keep `glyph()` | |

**Why lavender for platelets?** Blue is reserved by FORMAT for "the thing being taught and change arrows". Right now
platelets, progress bars, change arrows and WORDS are all the same blue, so nothing pops. Lavender/purple is the
Osmosis/BioRender convention for platelets and is in the kit palette (`purple`).

Line weights: outer anatomical outlines 1.5, internal detail 1, leaders 1.3 (keep `leader()`), arrows 2.5 / 3.5 for
change. Use one soft drop shadow filter (`feDropShadow dy=1 stdDeviation=1 opacity .18`) on cells and on the plug only.
Give each picture its own filter id via the existing `ah-` prefix rewrite in `svg()`.

## Per-step redraws

### 1. leak (`leakPicture`): grade 4
Problems: the walls are two flat planks with no layers, and the tear is a rectangular gap with a zig-zag. Blood inside
the gap is the lumen colour, not leaking blood. Drops fall into the tissue as 3 teardrops. RBCs are flat ellipses, and
platelets are tiny blue ovals indistinguishable from bubbles. "vessel wall" (top right) has no leader.
Redraw: a **longitudinal section of a small artery** across the whole width.
- Top and bottom walls each show three layers: a thin endothelial row (flat cells with nuclei), a thicker media of
  spindle smooth-muscle cells, and an outer adventitia fading into tissue. Wall thickness about 26 units each (VY..TOPIN
  is 24 now; keep `I`/`B` constants or rename, but every downstream geometry uses them).
- The tear sits in the bottom wall: a ragged, V-shaped breach through all three layers. The endothelium curls back at
  the edges, and the frayed collagen ends are faintly visible (not yet labelled).
- Blood escapes as a widening red plume of RBCs plus plasma tint through the breach into the tissue (2-3 RBCs moving out
  along t, not teardrops). Keep `drops`/`leak` driving it.
- RBCs face-on with a biconcave gradient, some edge-on as dumbbells, size about 15x8 (today 30x16 at 2x). Platelets are
  lavender lenses about 6x2.8 with granules.
- Labels: "blood flows →" top left; leader-tagged "vessel wall" to the top wall's media; "tear" leader to the breach;
  "leaking out" red beside the plume; "outside the vessel" muted bottom left.

### 2. spasm (`spasmPicture`): grade 4
Problems: the top wall bulges smoothly but the bottom wall forms a sharp triangular ridge. The ghost (normal line) is
drawn only on the top wall. "wall squeezes in" arrows rise from the tissue below, which reads as something pushing from
outside rather than muscle contracting. No muscle is drawn.
Redraw: the same artery. Over t the **media's spindle cells shorten and fatten** (scale x 0.8, y 1.25 near the tear) and
the media thickens inward on both walls around the tear. Use the existing `bump()` profile for both walls (fix the
bottom so it is a smooth bump, not a ridge). Dashed grey ghost of the normal inner wall line on **both** walls. Change
words on the picture: "muscle contracts: lumen narrows" with two short blue inward arrows *inside the lumen* (top wall
arrow pointing down, bottom wall arrow pointing up) at the bump crest. The plume of leaking blood thins (`leak` falls
0.45). Optional tiny "endothelin" or pain-nerve hint: no; the caption does not name endothelin, so do not invent it.

### 3. platelets (`plateletsPicture`): grade 4
Problems: the platelets are blue ovals that look like bubbles. The legend box covers a third of the tissue band and
sits beside the leak. Nothing shows platelets sliding past the smooth lining.
Redraw: the narrowed artery. Platelets (lavender discoid lenses with granules, about a fifth of RBC diameter, which is
accurate: 2-3 um vs 7-8 um) travel near the walls (margination). Place most `FLOAT` points within 20 units of each
wall, because platelets marginate; this is accurate and teaches. RBCs travel mid-stream. A magnified inset in the top
right corner (circle, 70 diameter, thin ink ring with a leader to one platelet) shows one platelet beside one RBC at true
relative scale, labelled "platelet" (purple) and "red blood cell" (red). Delete the white legend rectangle.
`data-part="platelets"` stays on the flowing platelets **and** the inset platelet.

### 4. stick (`stickPicture`): grade 4
Problems: the collagen is three tiny brown squiggles at each torn edge. Platelets become 8-point stars sitting on top of
the squiggles. Von Willebrand factor (named in the caption) is absent. The "sticky platelets" leader crosses the wall.
Redraw: zoom in. The picture now shows only about 200 units of wall around the tear, so the breach fills the middle
third. Exposed **subendothelial collagen fibre bundles** (thick banded strands) splay from the torn media on each side.
**vWF** drawn as thin uncoiled multimer strings (beaded purple-grey line `#7d6aa8`) tethered to the collagen, reaching
into the lumen. Platelets arriving along the wall touch the vWF, then morph over `k` from lens to rounded-with-filopodia
(`activatedPlatelet(x,y,k)` interpolating spike length 0→1) and spread flat on the collagen. Labels with leaders:
"collagen" (brown), "von Willebrand factor" (muted purple, sm), "platelets stick and spread" (purple). Keep
`data-part="collagen"`. Add `data-part="vwf"` (harmless even with no dfn; or add the dfn later).

### 5. plug (`plugPicture`): grade 4
Problems: the plug is a lattice of 44 identical stars in a hex grid, with no outline and no depth. It bulges out of the
bottom of the wall into the tissue. The "called in" arrows start at free platelets but the chemical messengers (ADP,
thromboxane, named in the caption) are not drawn.
Redraw: the plug is a **mound** of overlapping activated platelets inside the breach and capping it on the lumen side.
Draw each platelet with filopodia interlocking with its neighbours. Back rows are darker lavender, front rows lighter,
and one soft shadow under the mound gives depth. A thin outer contour (purple 1.2, opacity .5) unifies the mass. It
fills from the collagen outward (keep `PLUG.pts` sorted by `nd`, keep `plugBody(amt)` count-driven, keep `n0` as the
normal count). Small amber and blue dots puff from the stuck platelets (ADP and thromboxane: the same dot vocabulary as
step 18, so 18 reads as a callback). Curved blue arrows bring 2 marginated platelets in. Label "platelet plug" with a
leader. The bleed stops: remove drops as `k` reaches 1.

### 6. needmesh (`needMeshPicture`): grade 4
Problems: fibrinogen is drawn as straight brown sticks scattered through the lumen; they look like debris. The inset is
a white box with three sticks, a "?" arrow and three crossing curves. "soft plug" leader is fine. `dfn data-part="fibrin"` lights nothing.
Redraw: the plug in the breach as in step 5. Fibrinogen is drawn as **trinodular rods** (three small beads on a line,
about 14 long). Inset (rounded panel, no hard white box, `C.paper` fill, rule stroke): left shows 3 fibrinogen
molecules; a thick arrow labelled "?" (the enzyme to come); right shows a fibrin **mesh**: polymerised strands of the
same beads joined end to end (half-staggered), branching, with one RBC caught. Wrap the right side in
`part('fibrin', …)` and the left side plus lumen rods in `part('fibrinogen', …)`.

### 7. switches (`switchesPicture`): grade 4
Problems: iOS toggle switches read as a software settings page. The faint blue rectangles behind rows look like leftover
selection highlights. The binary doubling is a fair teaching simplification, but nothing ties it to proteins.
Redraw: keep the 1-2-4-8 tree and the row-by-row light-up by `t`. Each node is a **protein glyph**:
- inactive zymogen: grey rounded blob with a closed fold, a "lid" over the active site;
- active enzyme: blue blob, lid snipped off, active-site notch open, a soft glow (blue radial gradient, opacity .35).
Each arrow from an active enzyme to the next zymogen is a short curved catalysis arrow ending in a small "snip" mark
where the lid is cut. Remove the row background rectangles. Title text unchanged. Key: "switched off (inactive)" and
"switched on (active enzyme)" with the two glyphs. Add the muted xs note "numbers illustrative" bottom right, since real
amplification per step is far larger than 2x. Height can stay 376.

### 8. paths (`cascadePicture level 1`): grade 3
Problems: three white boxes with progress bars, and the bottom 40 % of the ladder area is blank. The bars sit at the
same 62 % for every box in every build step, so they carry no meaning while building. The intrinsic box omits XII. The
clot band's top clip cuts RBCs in half (y=272 boundary). Nothing shows where tissue factor lives: the caption says it
sits "on cells outside the vessel".
Redraw the ladder as a **cascade figure in the First Aid / Lecturio style**, keeping the same grid slots (`LB`) so
the model wiring stays:
- Each factor is a **pill node**: zymogen name in ink ("X") and an activation arrow to its active form ("Xa") in blue.
  Use one pill per slot: left half grey (zymogen), right half blue (active). The blue half's saturation or fill-level is
  the model value (`data-act` stays on the blue fill element; width or opacity = `act/1.6`).
- Extrinsic entry (top left): a tiny drawing of a subendothelial cell (fibroblast) with **tissue factor** as a membrane
  protein on its surface, with VII to VIIa binding it. Intrinsic entry (top right): "contact: XII → XI → IX" as three small
  pills chained.
- Common pathway (centre column): X → Xa.
- Unbuilt rows are drawn as a **faint dashed ghost of the full ladder** (opacity .25), so the layout never jumps and the
  student sees where the story is going. This also removes the dead space.
- Clot band: pick RBC positions inside the band so no cell is clipped, or soften the clip edge with a 6-unit fade mask.

### 9. thrombin (level 2): grade 3
Problems: the same box style. Prothrombin feeds into thrombin from the side as a box→box arrow. Calcium and the platelet
surface named in the caption are missing.
Redraw: under the X→Xa pill, draw a short **platelet membrane strip** (lipid bilayer segment: two rows of small
lavender head circles with tails, about 140 wide) spanning the X and II slots. Xa and its cofactor chip "Va" sit on it
with "Ca²⁺" beads. Prothrombin (II, with K badge) docks there and leaves as **thrombin (IIa)**: a protein glyph with an
open active site in blue, keeping `data-part="thrombin"`. The thrombin glyph glows as the model fills (`light`).

### 10. mesh (level 3): grade 4
Problems: fibrin threads in the clot band are 12 long Bézier curves extending past the plug into the wall and tissue.
At t=0.35 the net is already nearly complete (k = ease(0.31) ≈ 0.67), so the build barely shows. Trapped RBCs are faint
and overdrawn by threads. "fibrin net" leader crosses the threads.
Redraw: thrombin glyph → snips fibrinogen (trinodular) → fibrin strand. In the clot band, fibrin strands are **clipped
to the plug mound's contour plus 6 units**, woven over and under platelets (alternate strand segments drawn behind and in
front of the platelet layer), with XIIIa cross-link dots at crossings and 2-3 RBCs caught inside (fully opaque, not
faded). Retime: start the weave at t=.15 and spread thread appearance linearly to t=.9. Keep thread count driven by
`meshBody(mesh)` and `NORMAL_THREADS`.

### 11. brake (level 4, still): grade 4
Problems: the antithrombin box joins with two thin red curved T-bars that end at box edges, and "heparin-like coat"
(in the caption) is not shown.
Redraw: antithrombin as a protein glyph (serpin: a compact blob with a reactive loop drawn as a small hook) on the right.
Red inhibitory T-bars run to the Xa pill and the thrombin glyph. In the clot band, add a thin green-grey stippled coat
on the **intact** endothelium either side of the tear, labelled muted xs "heparin-like coat (healthy lining)". This shows
spatially why the clot stays at the wound. `data-part="brake"` stays on glyph and T-bars.

### 12. cleanup (`cleanup`): grade 4
Problems: the plasmin box T-bars the "fibrin net" box. In the band, threads go dashed but stay at full length. Plasminogen
(named in the caption) is not drawn.
Redraw: the plasminogen pill (grey) → plasmin (blue protein glyph with scissor-like active site) at the bottom right.
In the band, plasmin glyphs sit on fibrin strands. Over t, strands break into **short fragments** (fibrin degradation
products) that drift up and fade, and the platelet mound slowly flattens into a re-endothelialised wall (the endothelial
row closes over the breach at t=1). Keep `lys` driving dash and fragment count.

### 13. whole: grade 4
Problems: it is the same as step 12's static figure, built in sequence. It works as choreography but inherits every
problem above.
Redraw: no new design; it inherits the new ladder and band. Make sure the stage order (plug, then cascade lights top to
bottom, then weave) uses the new glyphs, and add `stages: [[0,'plug'],[0.32,'cascade'],[0.68,'net']]` for the player.

### 14. heparin (`ladderChange('heparin')`): grade 3
Problems: the WORDS text "↓ Xa, ↓ thrombin" at (16,294) sits **on top of an RBC and a platelet** in the clot band
(overlap violation). The blue "+" glyph overlaps the antithrombin box border and the T-bar root. The "heparin" label
floats above the box with no molecule. The ghost normal ticks are 2-unit dotted lines, almost invisible at phone size.
Redraw: a **heparin chain** (short zig-zag polysaccharide in blue, 5 hexagon rings joined) docks onto the antithrombin
glyph over t. The antithrombin T-bars thicken (keep `w = 2.2 + 1.6*(brake-1)`). Xa and thrombin fills drop below a
**ghost marker** shown as an outlined dashed capsule at the normal level, at least 2 units wide, ghost grey. Move WORDS
into a dedicated change-callout slot in the ladder area (empty right column under plasmin, or x=330,y=210 when cs is
off) as blue text with a blue arrow pointing at the dropped fills: "Xa and thrombin switched off faster". Never
place words inside the clot band.

### 15. vka (`ladderChange('vka')`): grade 3
Problems: the K badges at the right edge clip (contact badge cx=468 r=11 reaches 479+stroke; proteins C, S badge
likewise). The "recycling blocked" text overflows its 148-wide box. The proteins C, S T-bar targets thrombin
(**inaccurate**, see above). The vitamin K box overlaps the TF→X arrow path. WORDS overlaps the RBC again.
Redraw: a **vitamin K cycle** inset at the left (two small arrows in a circle: "vitamin K" and "used (epoxide)") with a
red block glyph on the recycling arc (VKORC1 is the target; do not name it unless the caption does). Hollow dashed K
badges go on the **VII, IX, X, II pills** and the **protein C/S** glyph, each inside its node (not on corners), so
nothing reaches the frame edge. C/S T-bar goes to the Va/VIIIa cofactor chips. Badge `data-k` hooks stay.

### 16. xa (`ladderChange('xa')`): grade 4
Problems: the red X glyph sits on the box corner and the arrow tip. It reads, but a drug that "jams" Xa should sit in
Xa's active site. WORDS overlap as in step 14.
Redraw: a small red drug wedge slides into the Xa glyph's active-site notch over t (the notch closes, the glyph greys
out to 40 % saturation). Fills downstream drop under ghost capsules. Callout "Xa jammed: less thrombin, thinner net" in
the callout slot.

### 17. dti (`ladderChange('dti')`): grade 4
Problems: as step 16, plus the thrombin **bar** shrinks (implying less made, which is inaccurate for a DTI).
Redraw: the drug wedge fills thrombin's active site. The thrombin glyph **stays full size** but greys and loses its glow.
The fibrin fill drops. The band shows few threads. Callout "thrombin present but blocked: net barely forms". Fix the
readout wording in the model (see accuracy).

### 18. antiplatelet (`antiplateletPicture`): grade 3
Problems: "thromboxane", "aspirin: none made" and "P2Y12 blocker: cannot land" sit on top of RBCs. The signal dots are
3.6 radius and nearly invisible. The red X glyphs float in mid-lumen, not on any platelet. Fibrin threads (mesh × .6)
dominate the shrunken plug and distract from the platelet story. "platelets call in more" headline has no visual anchor.
Redraw: two halves around a **zoomed plug**. Left: one stuck platelet makes thromboxane (amber dot stream); at t, an
aspirin red block glyph lands *inside* that platelet on a small "COX" enzyme blob. Name it only as "aspirin: no
thromboxane made", since the caption does not name COX; draw an unlabeled enzyme blob or skip it. Right: ADP (blue
dots) streams toward a passing platelet, whose surface shows a **receptor** (small Y-shaped membrane protein, purple)
labelled "P2Y12". At t a red cap plugs the receptor and the dots bounce off. Plug mound shrinks inside its ghost dome.
Hide fibrin in this picture or reduce it to 3 faint strands. Clear all RBCs from a 120x60 label zone on each side.
Data-parts `txa`, `adp`, `signals` stay. Put `signals` on the dot streams, not just on the headline text.

### 19. lytic (`lyticPicture`): grade 3
Problems: the vessel is two flat bars. The "clot" is a 4x7 grid of stars with straight brown dashes. Plasmin is
floating blue diamonds. At t=1 the RBCs bunch on the left and in one row mid-vessel rather than flowing through. The
"flow returns" arrow sits outside the vessel. The legend repeats symbols the picture should make obvious.
Redraw: a longitudinal artery (same wall primitive as steps 1-5) **occluded by a thrombus**. The thrombus is an organic
lumen-shaped mass: a lavender platelet core, a dense fibrin meshwork with trapped RBCs giving it a dark red-brown body,
and a slightly lobulated edge. Upstream, RBCs pile up (crowded, compressed). Over t: tPA molecules (small blue glyph,
labelled once "tPA (drug)") bind on the fibrin. Plasminogen beads on fibrin turn into plasmin (blue scissor glyphs). The
fibrin breaks into fragments, the mass shrinks from its centre outward to a residual mural wisp, and RBCs stream
through at even spacing (`flow` wraps all 16 cells). "flow returns" blue arrow drawn **inside** the lumen downstream.
Delete the legend, or keep only "plasmin" if the glyph is novel.

## Clinical values and Explore freely tabs (not stepped, but they reuse the same functions)
- `#clinical-visual` uses `vessel()` with `float: P.plt`, so platelet count changes the number of flowing platelets. With
  margination (step 3), keep the count model-driven: `FLOAT.slice(0, round(8*float))`.
- `#explore-visual` uses `cascadePicture(o, {vitk: true, cs: true})`, the busiest layout. It must fit the new
  callout slot, the vitamin K cycle inset and the C/S glyph without overlap. Test it with every drug checkbox on at once.

## Reusable primitives this lesson needs
1. `arteryWall(x0, x1, side, {bump, tear})`: three-layer wall (endothelium row, smooth-muscle media with spindle cells,
   adventitia), parameterised by the inward bump (spasm) and a tear window.
2. `rbc(x, y, {view: 'face'|'edge', k})`: biconcave red cell with gradient.
3. `platelet(x, y, {activation: 0..1, k})`: discoid lens with granules → spread form with filopodia.
4. `plateletMound(points, n)`: a plug made of interlocking activated platelets, with back-to-front shading and a contour.
5. `fibrinogen(x, y, angle)`: trinodular rod. `fibrinStrand(d, {crosslinks, cut})`: banded strand with highlight that
   can fragment.
6. `collagenBundle(x, y, angle)`, `vwfString(points)`.
7. `proteinGlyph(x, y, {state: 'zymogen'|'active'|'jammed', label})`: blob with active-site notch and lid.
8. `factorPill(slot, zymogen, active, act, ghostAct)`: replaces `box()`, keeps `data-act`.
9. `membraneStrip(x, y, w)`: lipid bilayer segment (heads plus tails), shared with membrane lessons.
10. `receptorY(x, y)`: membrane receptor (P2Y12-style GPCR stub).
11. `inhibitTbar(from, to, w)`: red inhibitory connector (exists as `tbar`).
12. `heparinChain(x, y, n)`, `vitKCycle(x, y, blocked)`.
13. `thrombus(x, y, w, h, lysis)`: occlusive clot mass.
14. `insetLens(cx, cy, r, body)`: circular magnified inset with leader.
15. `ghostCapsule(x, y, w)`: a visible dashed normal-level marker for fills.

## Graphs and charts
This lesson has no true graphs. The **progress bars** inside the ladder boxes are the only quantitative marks. They
are fine as model readouts but dead in the build steps (all 62 %). The ghost ticks are 2-unit dotted lines that vanish
on a phone. What would lift them: integrate the value into the node itself (fill level of the active half of the pill,
or glow intensity on the enzyme glyph); show the normal as a clear dashed capsule; drop the bars entirely in build steps
8-13, where the value is constant.

## Risks a redraw could break
- **Model-driven geometry**: `plugBody(amt)` (count of `PLUG.pts`, `n0` = normal), `meshBody(mesh, lys)` (thread count
  `NORMAL_THREADS`), `leakOf()`, `vessel({float})` platelet count, `bump(x,s)` spasm profile, ladder fills from
  `model()`, T-bar width from `o.brake`. Every redraw must keep these as the inputs, not hard-code the final state.
- **Hooks**: `class="ghost"` plus `data-ghost="normal"` with `data-plug/data-ten/data-thrombin/data-mesh` (`stateAttrs`);
  `data-new-state="<kind>"` on the current-state group; `data-named` on the change-words group (steps 2, 14-19);
  `data-act="<key>"` on fills; `data-k` on vitamin K badges. Keep the per-picture id prefix (`ah-` rewrite in `svg()`)
  for any new gradients, filters and clipPaths, or hidden steps lose them.
- **data-part names used by dfn**: platelets, collagen, plug, fibrinogen, fibrin, tf, contact, ten, pro, thrombin, brake,
  vitk, plasmin, signals, txa, adp (and cs, clot without dfns). Note that `fibrinogen` and `fibrin` exist in both the
  vessel and the ladder. `lab-check` requires 3 or more dfn parts per lesson.
- **Heights**: vessel VH=286, antiplatelet VH+10, Clinical VH+40, ladder 408, switches 376, lytic 330. All are 420 or
  less. The ladder at 408 has little headroom for the vitamin K cycle inset plus the callout slot: lay them out in the
  existing blank right-middle region, not below.
- **Label overlap**: today's WORDS position (16,294) and the antiplatelet labels collide with moving cells. Any
  moving-cell picture needs reserved label zones that cells avoid (filter `CELLS`/`FLOAT` by zone).
- **Frame edge**: badges and glyphs at x=468-472 clip. Keep 8 units of margin.
- **Accuracy traps**: protein C/S targets (Va, VIIIa, not thrombin); DTI = activity not production; K-dependence only
  for II, VII, IX, X, C, S (not TF, not XI); platelets about 1/3 RBC diameter, no nucleus; fibrinogen is soluble and
  trinodular; tPA converts plasminogen bound on fibrin. Do not add named enzymes (COX, VKORC1, endothelin, GPIIb/IIIa)
  to the picture unless the caption also names them, or add them as muted unlabeled shapes.
- **Phone legibility**: filopodia, granules and bilayer tails must stay decorative at 375 px. Label nothing smaller
  than xs (17), and do not rely on detail under about 3 units to carry meaning.
- **Shared tabs**: Clinical and Explore reuse `vessel()` and `cascadePicture()`. Re-shoot both tabs after the redraw.
