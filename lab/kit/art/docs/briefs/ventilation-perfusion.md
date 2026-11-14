# Redraw brief: ventilation-perfusion (Lesson 10, "Ventilation, perfusion and the alveolus")

Audited 2026-11-12 from captures at t=0.35 and t=1 of all 16 steps (shots in `scratchpad/audit/shots/ventilation-perfusion/`).
Source: `lab/ventilation-perfusion/app.js` (own helpers, does NOT import `/lab/kit/draw.js`), `index.html`, 4-line `style.css`.

**Overall grade: 4 / 10.** The teaching model is good. Every sac colour, gas-dot count, capillary width,
blood colour, bar length and scale marker comes from `unit()` / `lungs()` / `model()`, so the pictures are honest.
The drawing does not reach the bar. Every alveolus is a flat pale circle. Every capillary is a thick
cartoon "U" pipe with an ink outline, wrapping the lower half of the sac like a saddle. Airways are white
straight tubes. Airway smooth muscle is six pink rounded squares. Receptors are white rectangle stubs.
The overview lungs are two pink bean outlines with stick-figure twigs. There is no shading, no tissue texture,
no wall thickness (the "thin wall" that step 2 teaches is a blue line in a gap), and no visual difference
between pulmonary artery and pulmonary vein beyond the purple-to-red gradient. The two-sac lung (West's
two-compartment diagram) is the right teaching device. It is drawn as plumbing.

---

## Global direction (applies to every step)

1. **One alveolus primitive, used everywhere** (replace `sac()` and the circle in `drawUnit`):
   - Not a perfect circle. Use a soft lobed sac: a closed cubic path round the circle with 5 to 6 gentle bulges
     (radius modulation of about 4%), open at the top where the respiratory bronchiole / alveolar duct joins it.
     It must keep `data-sac` and stay a single fillable shape so `sacColor(po2)` still drives its fill.
   - The wall is a 3 to 4 unit band in tissue pink (`#e9b8ae` outer stroke with a lighter `#f6dcd5` inner stroke),
     not a 2 unit ink line. Add 3 to 4 flattened type I pneumocyte nuclei on the wall (tiny dark-pink ellipses
     about 5x2 units lying along the curve) and one rounder type II cell bump. These are optional detail and must
     stay under the labels.
   - Lumen fill: a radial gradient from the model colour at the centre to about 8% darker at the rim, plus a
     soft white highlight crescent at the upper left (opacity .35). The gradient's centre stop is the value
     `sacColor()` returns now, so the stale grey / fresh blue / rich blue scale still reads.
   - Gas: keep `gas()` and the counts. Draw O2 as a blue dot with a 1 unit white rim, and CO2 as a white
     ring with an ink stroke (as now) but slightly smaller, so they read as molecules over a shaded lumen.
     Keep `data-gas="o2"` and `data-gas="co2"`.
   - Fluid (pneumonia): not a flat yellow rect. Use a meniscus top (a gentle concave curve), a vertical gradient
     from `#e8d394` at the top to `#cfae5a` at the bottom, and 4 to 6 small round cells floating in it (white
     cells: pale circles with a lobed purple nucleus) so it reads as exudate. Keep `data-fluid`, `part('fluid')`
     and the clip to the sac shape.
2. **One capillary primitive** (replace `tubes()` U-pipes):
   - A vessel with a wall and a lumen: a 1.5 unit dark-red outer edge, a thin lighter inner wall line and a lumen
     filled with the existing `url(#ah-g…)` gradient (venous `#6b3fa0` to the computed `bloodColor(leave)`).
     Drop the 3.5 unit ink outline: it is what makes everything look like a cartoon.
   - The capillary should hug the sac (touching it, sharing the wall band) for most of its circumference, not
     float 8 units away under its lower half. The "air meets blood" interface IS the contact line, so the gap
     in the current drawing teaches the wrong thing. Run it from the lower left, under, and up the right side,
     about 270 degrees, as a net-like band (one main channel plus 2 to 3 short cross-connections drawn faintly)
     so it reads as a "mesh of capillaries" as the caption says.
   - Inflow and outflow vessels: label-free arteriole (purple, arriving) and venule (red, leaving), thicker than
     the capillary, with a soft cylindrical shading highlight (a 30% white stroke along one edge).
   - Red cells: biconcave discs. An ellipse with a darker rim and a pale centre dimple (current `perfPicture`
     cells are almost this; make them the shared primitive and use them in every step where blood moves).
3. **Airways**: draw bronchi/bronchioles as tubes with a cartilage/wall band (pale pink-grey `#e7dcd6`, 1.5 unit ink
   edge) and a lumen tinted by `airColor(fio2)`. The trachea in the overview gets C-shaped cartilage rings
   (6 to 8 faint arcs). Narrowed airways should show a thickened wall, not just a thinner white line.
4. **Palette**: keep VEN `#6b3fa0` for deoxygenated and ART `#b3261e` for oxygenated (the lesson's whole logic
   rests on the lerp between them). Add tissue tones: lung parenchyma `#f1c9c0` with a deeper `#d99a8e` edge;
   wall pink `#e9b8ae`; smooth muscle `#c97b6b` with spindle texture. Ink outlines at 1.5 units for anatomy and
   2 units only for the frame-level shapes. Never use ink black for a clot (see step 15).
5. **Labels**: all leader lines 1.2 unit ink with a small 2.5 unit dot at the anchored structure. The current
   "thin wall" leader in step 2 crosses the capillary and ends in empty space.
6. **Keep** the kit text classes (`xs b` = 17, `sm` = 18), 480 wide, heights as now (all at or under 402).

---

## Per step

### Step 1 `overview` (still, h 392). Grade 4
Problems: the lungs are two symmetric pink beans with a red outline, so there is no left/right difference (no cardiac
notch, no lobes, no fissures, both the same size). The airway tree is stick lines that start inside the white main
bronchi and stop at random. The trachea has no cartilage. The magnifier shows a honeycomb of 7 identical circles with
a short white stub, and a vessel crescent clipped at the bottom. It does not look like an acinus (grape cluster on a
branching duct). The leader for "airways" points at blank lung. The magnifier's source lines start at an arbitrary
point in the left (patient's left = viewer's right) lung.
Redraw:
- Frontal view of both lungs, viewer's left = patient's right. Right lung: 3 lobes, horizontal and oblique fissure
  lines (1.2 unit, darker pink), slightly broader and shorter. Left lung: 2 lobes with oblique fissure, a
  **cardiac notch** on its medial lower border and the lingula. Apices rounded above, bases concave over the
  diaphragm (draw a faint diaphragm dome line under both).
- Fill each lung with a radial gradient (`#f6d8d1` centre to `#e5aaa0` edge) plus a soft highlight on the upper
  lateral surface. No red outline: a 1.5 unit `#c2766a` edge.
- Trachea with C-rings, carina, two main bronchi (right one shorter, wider and more vertical, which is true and
  a classic exam point), lobar bronchi (3 right, 2 left), then 2 more generations of tapering branches drawn as
  tubes that fade into the parenchyma. Keep `part('airways')` on the whole tree.
- Magnifier: keep the 88-radius lens at (380, 214) and its two dashed source lines, but anchor them at the tip of
  a terminal branch in the drawn tree. Inside: a terminal bronchiole dividing into 2 alveolar ducts, each ending in
  a grape cluster of 5 to 7 lobed alveoli (the shared primitive at small scale, ~16 to 20 radius), with a
  pulmonary arteriole (purple) coming in from one side, a capillary net draped over the cluster (thin vessels
  shading purple to red) and a venule (red) leaving. Keep `part('alveoli')` on the cluster.
- Labels: "windpipe" (leader to the trachea), "airways" (leader ending ON a bronchus), "lungs" under the pair,
  "alveoli: tiny air sacs" above the lens, "blood vessel" under the lens. Keep each at xs/sm.

### Step 2 `unit` (still, h 374). Grade 3
Problems: a plain circle on a white stick over a purple/red saddle. The thin wall is a blue arc floating in an
8-unit gap, which suggests the wall is a separate thing between sac and vessel. The "thin wall" leader crosses the
capillary and ends in the gap. Nothing says "mesh". The label "capillary" sits far below in purple although the
vessel is half red.
Redraw:
- The big alveolus primitive (R 84 at 240, 182) with its wall band, pneumocyte nuclei and a terminal airway entering
  at the top (with a thickened wall band, not a white stick).
- Capillary net wrapping about 270 degrees, in contact with the wall, arteriole in at lower left (purple), venule out
  at lower right (red), 4 to 5 red cells in single file inside the main channel (static, already purple at left,
  red at right).
- Inset callout (a small rounded box, about 130x90, at upper right): the **blood-air barrier** in cross-section,
  three thin layers from air to blood: alveolar epithelium (pink), fused basement membrane (thin grey line),
  capillary endothelium (pink), then one red cell. Label it "thin wall: air meets blood" and keep `part('wall')` on
  both the contact arc and the inset. Do not print a thickness number (none is in clinical-values.json).
- Labels: "airway", "alveolus" (inside the sac, as now), "capillary" with a leader to the net, "blood in" and
  "blood out" at the two ends in purple and red.

### Step 3 `swap` (loop, h 402). Grade 4
Problems: the moving dots fade in mid-sac and out mid-vessel along two arbitrary straight radii. The O2 arrow and the
CO2 arrow are a thick blue and a thick black stick crossing the gap. At t=0.35 a CO2 ring overlaps the black arrow
shaft and a faded dot sits on the red vessel looking like a stain. There is no red cell for the oxygen to load onto.
Redraw:
- Same sac and capillary primitives as step 2 (re-use exactly), with a zoomed band of the contact zone: 3 red cells
  passing under the sac.
- O2 molecules drift from the lumen through the wall band and **into the nearest red cell** (dot shrinks into the
  cell, cell warms from purple to red). CO2 rings rise from the plasma through the wall into the lumen. Paths are
  short gentle curves at 3 or 4 places round the contact arc, not 1 straight line each.
- Two fixed-head arrows (`arrowFixed`), one blue "O2 in", one ink "CO2 out", drawn beside the wall, not across it,
  with their words next to them instead of at the bottom corners.
- Keep `part('exchange')`, `GAS_KEY`, `rest: .5`.

### Step 4 `vent` (loop, h 388). Grade 4
Problems: the sac swells by 4.5% (invisible at phone size) and dots slide down a white stick. "fresh air in" and
"used air out" are side by side and fade, so the breath reads as two labels blinking. Nothing changes in the sac's
colour or contents across the cycle.
Redraw:
- The alveolus primitive at the end of a short terminal bronchiole (wall band). Increase the swell to about 10% and
  ease it (`ease.inOut`), so expansion is visible.
- Inhale: a stream of 5 to 6 blue O2 dots (with a lighter blue air tint filling the airway lumen) moves down; the sac
  lumen brightens slightly. Exhale: CO2 rings plus a greyer tint move up and out.
- One curved two-way breath indicator at the airway's side: a single arrow whose direction and colour flip at t=.5
  (blue down "breathe in", muted up "breathe out"), with the inactive word hidden, not faded to 40%.
- Keep `part('airway')` on the airway plus moving gas, `rest: .3`.

### Step 5 `perf` (loop, h 382). Grade 5
Problems: best of the single-sac pictures: the red cells in single file are the right idea. But the plasma pipe is
a flat pink U-pipe with a heavy ink outline, the cells are flat ellipses, and the flow arrows sit detached below.
Redraw:
- Same capillary primitive as step 2 (now with a lumen and wall), plasma tinted pale straw/pink inside.
- Red cells as biconcave discs, rotating slightly as they turn the bend (rx/ry swap round the curve) and warming
  from purple to red along `pt.bend` as now. Space them a little closer (12 cells) so "single file" reads.
- Flow arrows drawn along the arteriole and venule ends, not floating under them. Keep the two labels.
- Keep `part('capillary')` on the cells and the `along()` geometry.

### Step 6 `match` (still, h 380). Grade 4
Problems: a smaller copy of step 2 plus a blue arrow and a scale. "balanced: a good match" sits in empty space on
the right. The scale is a white capsule with a tick and a blue triangle.
Redraw:
- Alveolus + capillary primitives at R 60. Air arrow and blood arrow drawn as two matched thick fixed-head arrows
  (blue down the airway, purple-to-red along the capillary) of equal visual weight, so balance is shown, not just said.
- Scale: a filled track with a soft gradient from purple-grey (left, "too little air") through a neutral middle to
  pale blue (right, "too little blood"), a short raised notch at "matched", and the marker as a blue teardrop pin.
  Keep `ratioScale()` geometry (`scaleX`, SC0 48, SC1 432) and `data-marker`, `part('scale')`.
- Graph verdict: the scale already reads; lift it with the gradient track and the pin.

### Step 7 `lowair` (change, h 384). Grade 4
Problems: the airway narrowing is a white line shrinking inside a dashed ghost (fine), but at t=1 a black bar caps
it, which looks like a lid, not an obstruction. The sac turns grey and keeps two blue dots (correct: venous level).
The right-hand words fade in and out over each other in time. The "out" label changes colour on a threshold.
Redraw:
- Airway with a wall band that thickens inward as `air` falls (the lumen shrinks; the outer wall stays), and at
  air 0 a mucus plug: an amber-grey rounded blob filling the lumen. Ghost: the normal airway lumen dashed grey.
- Sac primitive goes stale grey via `sacColor` as now; capillary via the gradient as now.
- A named change on the picture: arrow + "airway narrows" next to the airway; second stage "no air: blood leaves
  unchanged" with an arrow to the outflowing venule. Use the `stages` option (`[[0,'less air'],[.55,'no air']]`) so
  the player names the two stages rather than relying on cross-faded text.
- Keep `leftPart: 'shunt'` on the scale and the scale marker sliding left.

### Step 8 `lowblood` (change, h 384). Grade 3
Problems: at t=1 the capillary vanishes and only a masked dashed ghost remains, and the mask leaves broken
fragments (a solid rounded stub top-left, a gap on the right, two dashed stubs floating at the bottom). It reads as
a rendering error, not "no blood". At t=0.35 the ghost double-outline is busy.
Redraw:
- Keep the vessel drawn at all times: as `blood` falls the lumen narrows and empties (cells thin out, fill goes to
  pale pink), and at blood 0 the vessel is a collapsed pale pink tube with a dark-red clot plug at its arteriole
  entrance. Ghost: the normal vessel outline as one clean dashed path (draw the dashed outline as two offset
  strokes of the centreline, not a stroke-masked fat stroke, which is what breaks at the ends).
- Sac stays fresh/rich blue with many O2 dots (as the model already does).
- Named change: arrow + "blood flow cut"; second stage "no blood: dead space". `rightPart: 'dead'` on the scale.

### Step 9 `mix` (change, h 400). Grade 5
Problems: the two-compartment idea is right and model-driven. But the picture is plumbing: vessels come up from
the bottom, hook over each sac's outer side and run down into a rectangular manifold that drops to a downward
arrowhead. The right bronchus narrowing (to 15%) is subtle at t=1 because the tube width curve is sqrt-compressed
and the dashed ghost sits right on its edge. "air in" collides with the trachea outline. The saturation bar is
the strongest element.
Redraw (this is the shared `lungPicture`, used by steps 9, 10, 11, 15, 16 and the Explore / Clinical tabs):
- Keep LG geometry (sacs at x 124 and 356, cy 140, R 48) so ghost widths and attributes still line up.
- Airway: trachea with rings, carina, two bronchi with wall bands; narrowing shows as an inward-thickening wall.
  Move "air in" left of the trachea with 8 units clearance.
- Each sac: the alveolus primitive (lobed, shaded) with its capillary net hugging it.
- Blood: a **pulmonary artery** trunk (purple) entering from below centre-left labelled "from the heart (from the
  body)", splitting to each sac's arteriole on the outer side; each sac's venule (colour from the model) running
  to a **pulmonary vein** confluence at the centre that leaves downward as a red vessel "to the heart, then the
  body". Draw the confluence as a smooth Y-merge, with the two incoming colours mixing over 30 units into `cArt`
  (a gradient), so mixing is visible, not a rectangle with an arrowhead stuck on.
  If the arterial supply is kept on both outer edges (as now) for clarity, give them a shared stem name in the
  label row ("from the body" left and right is fine) and a cylindrical highlight.
- Saturation bar: keep `data-bar="o2"` geometry (60..420 at y 372) and the dashed ghost tick; add a subtle
  half/full track gradient and round the ends. Graph verdict: already clear; lift with the gradient fill
  coloured by `cArt` (as now) and an end cap.
- Named change: the "mix falls" word already exists; add an arrow from the right sac's purplish venule into the
  confluence labelled "oxygen-poor blood joins".

### Step 10 `steer` (change, h 400). Grade 5
Problems: the squeeze is two black arrows at x 414..478; the right arrow starts at the frame edge and looks
clipped. The vessel narrowing is shown only by ghost dashes on an already busy outline. "vessel narrows" floats in
the top right corner, far from the vessel. No smooth muscle on the vessel.
Redraw:
- On the right sac's arteriole draw a short segment of **vascular smooth muscle** (a ring of 3 to 4 spindle cells,
  same muscle tone as step 13) that contracts with `squeeze`, pinching the lumen; ghost lumen dashed.
- Squeeze arrows: two fixed-head ink arrows inside the frame (x 400..460 max) pressing on that ring.
- "vessel narrows where oxygen is low" placed next to the ring with a leader; "blood steered to air" as now on the
  left with its arrow. Keep `part('squeeze')`.

### Step 11 `whole` (still, h 400). Grade 5
Problems: same `lungPicture` as above at BASE; "ventilation" sits beside "air in" and both crowd the trachea;
"perfusion: blood past" floats in the top left with no leader.
Redraw: the redrawn `lungPicture`, with two brackets: a blue bracket along the airway tree labelled
"ventilation: air in and out", and a purple-to-red bracket along one capillary path labelled "perfusion: blood
past". No other changes.

### Step 12 `oxygen` (change, h 376). Grade 4
Problems: **text overlap at t=0.35**: "room air in" and "extra oxygen in" cross-fade on top of each other at the same
position (violates the no-overlap rule). The "too little air" sac's airway is drawn the same width as the shunt's
(`lumen: 8` for both), so its low air is never shown. The fluid-filled sac's airway is drawn open with oxygen-tinted
air entering a full sac. No ghost of the room-air sac colour. The two bars have no half/full end labels; only a
two-line muted footnote explains them. The left sac's colour change is small at phone size.
Redraw:
- Airway tree from a single trachea at top centre, its lumen tint going from white to a clearly richer blue as
  `fio2` rises, with a small "O2" nasal-cannula-style badge sliding in on the trachea (no device realism needed).
  Replace the cross-faded words with one label whose text changes at a stage boundary (`stages: [[0,'room air'],
  [.3,'extra oxygen']]`), so two strings never share a box.
- Left sac: narrowed bronchiole (thick wall band, small lumen) so "too little air" is visible. Right sac: fluid
  primitive with the bronchiole ending in a plug at the fluid surface (no tint entering).
- Under each sac: its bar with "half" and "full" end labels in xs muted (fit in 170 units) and the dashed room-air
  tick; named change "↑ blood fills" / "↔ no change" as now.
- Keep `part('air')`, `data-bar="a"`, `data-bar="b"`, `data-named`.

### Step 13 `beta2` (change, h 384). Grade 4
Problems: the airway is a bare white straight tube and the "muscle" is six pink rounded squares stacked beside it,
which reads as buttons, not a muscle layer. The receptor is a white 8x16 bracket; the agonist is a blue diamond
floating in from the right edge. The muscle relaxing is shown by the squares getting narrower. The airway and sac
take the left 55%; the bar and words are stacked tightly on the right.
Redraw:
- Bronchiole in longitudinal section: a mucosa line, a wall band and a **spiral of smooth muscle** drawn as 5 to 6
  diagonal spindle-shaped cells (elongated pointed ellipses with a central nucleus) wrapping the tube on both sides.
  Tightening: cells shorten and thicken and the lumen shrinks (lumen width driven by `air` as now). Relaxing: cells
  lengthen and thin.
- Callout from one muscle cell (a magnified rounded box at right, about 150x120): a patch of cell membrane drawn as
  a **lipid bilayer strip** with a **beta-2 receptor as a 7-transmembrane serpentine** (G-protein-coupled), a small
  G-protein blob under it. The agonist (blue, small rounded shape) binds the extracellular pocket and the receptor
  "lights" blue; label "beta-2 receptor switched on" and "relax signal".
  The drug arrives through the airway lumen (inhaled) to the wall, which is how it reaches the muscle; do not bring
  it in from the frame edge.
- Keep the saturation bar for "blood leaving the sac" (half/full labels and dashed normal tick), placed under the
  callout. Keep `part('muscle')` on the muscle cells and `part('receptor')` on the receptor in the callout.

### Step 14 `antimusc` (change, h 384). Grade 4
Problems: same muscle squares; the "nerve" is a black line ending in a white circle; acetylcholine is three tiny red
dots; the antagonist is a red rectangle inside the white bracket. The red dots are 3.2 units: barely visible on a
phone.
Redraw:
- Same bronchiole and spindle muscle as step 13.
- Callout: a **varicosity of a parasympathetic (vagal) nerve fibre** (a swelling on an axon, containing 4 to 5
  vesicles), a synaptic gap, and the muscle membrane (lipid bilayer strip) with a **muscarinic receptor** (also a
  7-transmembrane serpentine, the M3 subtype is the airway one but do not label a subtype unless the caption adds it).
  Acetylcholine as small amber or red molecules (radius >= 4) released from vesicles and docking. Then the
  antagonist (a larger, distinct-coloured blocker shape, e.g. a red wedge) occupies the pocket and ACh bounces off.
- Keep `part('receptor')`, labels "nerve", "acetylcholine", "antagonist blocks the receptor" with leaders.

### Step 15 `pe` (change, h 400). Grade 5
Problems: the clot is a black ink ellipse (looks like a hole or a bead) in the right supply vessel near the frame
bottom, with "clot" in black beside it. The ghost round the shrunken right capillary breaks into fragments (same mask
issue as step 8). "more blood than air here" (t=1) runs into the left bronchus.
Redraw:
- Clot as a **thrombus**: an irregular elongated dark-red shape (`#5c1712` to `#8a2a20` gradient) with a few fibrin
  strands (thin pale lines) and trapped red cells, lodged in the right pulmonary artery branch, growing with `clot`.
  Keep `part('clot')` and `data-clot`. Label "clot" in red with a leader.
- The right capillary empties (pale) as in the step 8 primitive; the left capillary visibly widens (the model drives it).
- Move "more blood than air here" to sit left of the left sac's outer vessel with 10 units clearance from the bronchus.
- Ghost as clean dashed outlines (see step 8).

### Step 16 `pneumonia` (change, h 400). Grade 5
Problems: the fluid rises as a flat beige rect with a hard horizontal edge; the bronchus to the full sac stays open
and white (air drawn reaching fluid). Nothing marks infection. The picture still reads, and the shunt label is right.
Redraw:
- Fluid primitive (meniscus, gradient, a few white cells) rising with `fill`. At fill 1, the bronchus lumen ends in a
  plug of exudate at the sac mouth.
- Optionally a faint inflamed (redder) wall band on the right sac only. Keep `part('fluid')`, `data-fluid` and the
  "fluid" word with its `.on-fluid` halo (style.css).

---

## Reusable primitives this lesson needs
- Alveolus (lobed sac, wall band with pneumocyte nuclei, radial-shaded lumen driven by a colour input, open mouth
  for the airway, clip path for fluid)
- Alveolar cluster / acinus (grape cluster on alveolar ducts) for the overview lens
- Pulmonary capillary net hugging an alveolus (main channel + faint cross-links, lumen gradient input, width input)
- Arteriole / venule with wall, lumen and cylindrical highlight; Y-merge confluence with colour mixing
- Red blood cell (biconcave disc, colour input, orientation input)
- Gas molecules: O2 dot and CO2 ring
- Blood-air barrier inset (epithelium, basement membrane, endothelium, red cell)
- Airway tube with wall band and cartilage rings; narrowing by wall thickening; mucus / exudate plug
- Lungs frontal pair (3-lobe right, 2-lobe left with cardiac notch, fissures, diaphragm line) with bronchial tree
- Smooth muscle spindle cells wrapping a tube (contract/relax by t), for airway and arteriole
- Lipid bilayer strip
- G-protein-coupled receptor (7-TM serpentine) with ligand pocket, agonist and antagonist shapes
- Nerve varicosity with vesicles releasing transmitter
- Thrombus (irregular dark-red clot with fibrin strands)
- Exudate fluid with meniscus and white cells
- Gradient bar (saturation, half to full) with dashed ghost tick
- V/Q scale with gradient track, notch at matched and pin marker

## Risks a redraw could break
- **Model-driven geometry**: sac colour (`sacColor(po2)`), gas dot counts (`gas()`), capillary widths
  (`wBlood(q)`), airway widths (`wAir(a)` / `lumen`), blood colours (`bloodColor(c)`), bar widths (`satX`, local
  `X()`), scale marker (`scaleX(r)`) must all stay outputs of `unit()` / `lungs()` / `model()`. Do not hard-code any
  colour or width that is now computed.
- **Shared lungPicture**: steps 9, 10, 11, 15, 16 AND the Explore and Clinical values tabs (`update()` renders
  `lungSvg` into `#explore-visual` and `#clinical-visual`) all use it. A redraw must work for every slider state,
  including airway 0, flow 0.04, fill 0 to 1, fio2 up to about 3 and `hpv` squeeze. Test the tabs, not just the steps.
- **Data attributes** read by the page or probes: `data-new-state` with `data-pao2`, `data-air-b`, `data-blood-b`,
  `data-shunt` (from `attrs()`); `data-bar="o2" | "a" | "b"`; `data-marker`; `data-clot`; `data-fluid`; `data-sac`;
  `data-gas="o2" | "co2"`; `data-named`; `class="ghost"` and `data-ghost="normal"` / `data-ghost-tick`;
  `data-vq-line`, `data-sac-point` and `data-ghost="room air"` in the Explore chart (`vqChart`).
- **data-part names used by `<dfn>`**: airways, alveoli (step 1); capillary, wall (2); exchange (3); airway (4);
  capillary (5); scale (6); shunt (7); dead (8); artery (9); squeeze (10); air (12); muscle, receptor (13);
  receptor (14); clot (15); fluid (16). `capillary` is used in two steps and `receptor` in two; keep the names.
- **Id uniquifying**: this file's own `svg()` rewrites only ids beginning `ah-` per picture (`body.replace(/ah-/g, …)`).
  Every new gradient, clipPath, mask, marker or filter id MUST start with `ah-` or it will collide across hidden steps
  and fail to draw (the comment at line 97 says why). If the redraw moves the lesson onto `/lab/kit/draw.js`, its
  `svg()` only rewrites `url(#ah-` and `url(#fh-`, so gradient/clip ids need their own uniquifying.
- **Ghost masks**: `ghostTube` uses a per-call mask id `ah-gm{n}`; the broken-fragment look in steps 8 and 15 comes
  from masking a fat dashed stroke with a thinner black stroke. Replace with offset dashed outlines.
- **Label overlap**: step 12 already overlaps ("room air in" / "extra oxygen in"); step 15 "than air here" touches
  the bronchus; "air in" touches the trachea in every lungPicture step. Richer drawings will crowd 480 units more:
  check at 375 x 553.
- **Accuracy traps**: right main bronchus is shorter, wider, more vertical; right lung 3 lobes, left 2 with cardiac
  notch and lingula; pulmonary ARTERY carries deoxygenated (purple) blood and pulmonary VEIN oxygenated (red); the
  muscarinic receptor and beta-2 receptor are both GPCRs (7-TM), not channels; acetylcholine comes from
  parasympathetic (vagal) fibres; inhaled drugs reach airway muscle from the lumen side; hypoxic vasoconstriction is
  in small pulmonary ARTERIES/arterioles, not the capillary itself; a PE lodges in a pulmonary artery branch upstream
  of the capillaries; pneumonia exudate fills alveoli (consolidation) with blood flow preserved. Do not print any
  number not in clinical-values.json (no barrier thickness, no V/Q value on the step pictures).
- **Reduced motion / rest**: `swap` rest .5, `vent` rest .3; change steps default rest 1. Animations must stay pure
  functions of t (no Date, no CSS animation).
- **Heights**: overview 392, unit 374, swap 402, vent 388, perf 382, match 380, lowair/lowblood/beta2/antimusc 384,
  oxygen 376, lungs 400. Stay at or under 420.
