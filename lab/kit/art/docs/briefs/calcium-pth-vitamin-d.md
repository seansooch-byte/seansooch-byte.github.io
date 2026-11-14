# Redraw brief: calcium-pth-vitamin-d (Lesson 23, "Calcium, PTH and Vitamin D")

Audited 2026-11-12 against the industry bar (Osmosis / Ninja Nerd / BioRender / Netter-derived schematics).
Overall grade: **3 / 10**.

## 0. How this lesson is built (read before touching it)

This lesson is NOT on the kit. It was built by an outside pipeline and has its own runtime:

- `lab/calcium-pth-vitamin-d/index.html` holds ONE shared `<figure id="stage"><svg id="pic">` that `showStep()`
  physically moves into each step's `.fig-slot`. There is no `.visual` block and no `.lx-player`, so
  `tools/lab-shoot.mjs` times out on step 1 (`waiting for [data-step="1"][data-step-title] .visual`).
  Shots for this audit came from a one-off script that drives the lesson's own player
  (`[data-pl=back]` x8, then `[data-pl=fwd]` per beat, photographing `#stage`):
  `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/ca-shoot.mjs`
  (run `node ca-shoot.mjs <outdir> [phone]`). PNGs are in
  `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/audit/shots/calcium-pth-vitamin-d/`
  (`sNN-bK.png` desktop per keyframe, `ph-sNN-bK.png` phone 375 x 553, `s12-<state>-bK.png`, `summary-fig.png`).
- `app.js` draws everything as a pure function of `(step, p)` where `p` runs 0..K.length-1 over a list of
  keyframes per step (`SCENES`, plus `stateFrame(id)` for the four disease states built from
  `clinical-values.json` `states[].directions`). Two hand-coordinate layouts: `LAYOUTS.wide` (780 x 690)
  and `LAYOUTS.narrow` (400 x 680, chosen by `matchMedia('(max-width:600px)')`).
- Drawing layers, in order: `g-flows` (Bezier arrows, `FLOW` table, 15 flows), `g-nodes` (organs),
  `g-labels`, `g-blood` (moving Ca dots, phosphate rings, albumin, gauge fill), `g-tokens` (tokens riding
  the Beziers), `g-callouts` (pill-shaped change labels stacked into five fixed columns `co.top/blood/bone/kidney/gut`).
- Model-driven quantities a redraw must keep: `lv` (-1 low, 0 normal, +1 high; drives gauge fill and the
  number of free Ca dots `9 + 6*lv`), `f[flow]` (flow rate: stroke width `1.5 + 2.2*r`, token count
  `1 + 2.2*r`), `ph` (phosphate ring count `5*ph`), `alb`, `cc` (C-cell opacity), `lit[]`, `dim[]`,
  `mute` (flows "not stated in sources", drawn dotted grey), `ghost` (normal flows as wide grey bands).
- Contract deviations from `lab/FORMAT.md` "Pictures": frame is 780 x 690 / 400 x 680 (not 480 x <=420);
  text is 15 units (rule: never under 17); callout pills overlap each other and the dots; and NO
  `data-part` wiring exists at all: the caption `<dfn>`s have no `data-part`, and nothing lights on hover.

## 1. What the pictures are now

A flat flowchart of clip-art tokens: two pink eggs joined by a rounded rectangle (thyroid), four yellow
ovals (parathyroids), a pink pill (blood), a cartoon dog-bone (bone), a pink bean (kidney), a beige
rounded rectangle with three tan squiggles (small intestine). Coloured Bezier arrows join them and carry
hexagon/dot/triangle/square tokens. State changes are pills in fixed columns at the bottom of the frame,
far from what they describe. The system idea (one body map, hormones as tokens on arrows, a calcium
gauge, ghosted normal) is sound and worth keeping. The anatomy is not: nothing looks like the organ it
names, the cells the captions teach (osteoclast, osteoblast, tubule cell, C cell, calcium sensor) are never
drawn, and on a phone the sticky player covers the lower half of a 680-unit-tall map.

## 2. Global problems (apply to every step)

1. **Organs are icons, not anatomy.** Dog-bone, bean, rounded box. No cortex/medulla, no trabecular bone,
   no intestinal loops or villi, no trachea under the thyroid.
2. **Hormones skip the blood.** `pthBone` and `pthKidney` run straight from one parathyroid to the organ
   over the vessel; `calcitriol` runs kidney -> gut directly under the map; calcitonin runs straight from
   the isthmus to each organ. Endocrine signals travel in the blood; the picture teaches a duct. All
   hormone paths should be gland -> vessel -> target.
3. **Only one gland ever secretes.** Every PTH path starts at the lower-left parathyroid (`pt[1]`).
4. **C cells are drawn in the isthmus** as five blue dots inside the rectangle. C (parafollicular) cells
   sit between follicles throughout the thyroid lobes; the isthmus placement is wrong.
5. **Callout pills float.** `co` columns put "osteoclasts up" 250 units below the bone and "PTH up" in the top
   right corner with no leader to the glands. On phone they overlap (step 7: "Ca2+, phosphate" runs into
   "Ca2+ kept"), and step 1's three pills sit on top of the albumin and dots they name.
6. **Labels collide with arrows.** "PTH into bloo[d]" is cut by the PTH arrow (steps 3, 7, 8, 12 normal,
   summary); "PTH -> bone" is crossed by the phosphate arrow (7, 8, summary); "Ca2+ in urine" and
   "phosphate in urine" are struck by their own arrowheads (6, 7, 12); phone: "PTH -> kidney" sits on the
   PTH arrow, "Ca2+ absorbed" on the Ca arrow.
7. **Type below the floor.** All picture text is 15 units in a 780-wide viewBox (about 13 px at desktop,
   about 13 px on the phone layout). The floor is 17 in a 480 frame.
8. **No shading, no depth.** Flat fills, a single 1.5 ink stroke on everything, no gradients, no highlights.
   Palette is coherent (teal Ca, amber PTH, violet calcitriol, grey phosphate, blue calcitonin), which is good,
   but organ tones are all near-identical pinks/beiges, so nothing separates.
9. **Phone layout is broken as a picture.** The 400 x 680 map is taller than a 553 px viewport; the sticky
   dock (`[data-step]>.dock{position:sticky;bottom:0}`) covers bone, kidney, gut and every callout. The
   viewer never sees the organ a step is about.
10. **Hover parts absent.** FORMAT requires at least three `<dfn data-part>` <-> `data-part` pairs. There are zero.

## 3. Per-step audit and redraw

Layout for every redraw below: one shared body map in a **480 x 420** frame (move to the kit contract), with
a **zoom inset** (a circle or rounded panel, 150-170 units, joined to its organ by two thin tangent lines,
the classic BioRender "magnifier") that carries the cellular action for that step. Callout pills are retired:
changes are named by short labels with leader lines and a blue arrow word ("more Ca2+ out", "less in urine")
placed next to the thing that moved. Suggested map positions (480 x 420): thyroid + parathyroids top-centre
(x 170-310, y 10-110); horizontal blood vessel band y 140-200 across the full width with the gauge at its right
end; bone bottom-left (x 20-140, y 250-400); kidney + ureter bottom-centre (x 190-290); small intestine
bottom-right (x 330-470). Insets overlay the empty upper corners (top-left for bone/C-cell/blood forms,
top-right for kidney/gut) so the organ stays visible.

### Step 1, "Calcium in the blood" (kind `blood`, 3 beats). Grade 3.
Problems: the "blood" is a pink pill with no wall; albumin is a grey ellipse with a dot glued on; the caption's
**third form (complexed with small ions) is never drawn**; the three pills sit on top of the albumin and dots
they label; "total" is pinned to the gauge, which reads as a level not a sum.
Redraw: a longitudinal section of a blood vessel: two-layer wall (outer adventitia tan, media pink-red with
faint smooth-muscle striations, thin endothelial line) with a lumen gradient (lighter centre, darker edge).
A few faint biconcave red cells for context (low opacity so tokens dominate). Inside, three clearly separated
groups with leader-line labels: (a) **albumin**: a lumpy globular protein (3-4 overlapping lobes, grey-blue
gradient, highlight top-left) with 2-3 Ca2+ dots docked on its surface; (b) **ionized Ca2+**: free teal dots
with a faint "2+" halo, drifting (existing `bloodSVG` motion); (c) **complexed**: a Ca2+ dot paired with a
small anion (a little grey citrate/phosphate glyph), labelled "with small ions" (keep it generic: the caption
says "small ions"; do not name citrate unless a source does). Beat 3 draws a brace or bracket spanning all
three groups into the gauge, labelled "total calcium = all three". Gauge: vertical capsule with soft
low/normal/high bands, ticks, and the existing `lv`-driven fill. data-parts: `albumin`, `ionized-calcium`,
`total-calcium` (bracket + gauge).

### Step 2, "When calcium falls, the parathyroid glands answer" (kind `sense`, 3 beats). Grade 3.
Problems: thyroid is two eggs and a box; "seen from behind" with no trachea/esophagus cue; PTH leaves one
gland only; "PTH up" pill sits top-right with no leader; the calcium sensor the caption names is absent;
all four glands just get a blue outline.
Redraw: posterior view of the thyroid: butterfly-shaped lobes with tapered superior poles and rounded inferior
poles, warm red-brown glandular gradient with subtle lobulation, the trachea (ringed cartilage, pale) running
behind the midline and the isthmus implied low-front (drawn dashed or hidden, since it is anterior). Four
parathyroids as small ochre-yellow ovoid glands with a darker rim and highlight, the superior pair at
mid-lobe and the inferior pair near the lower poles. Each gland has its own short venous outflow into the
vessel band. Inset (top-left): a parathyroid chief cell (rounded cell, nucleus, secretory granules as small
amber hexagons) with a calcium-sensing receptor drawn as a membrane protein (a seven-pass loop glyph is
fine; caption only says "calcium sensors", so label it "calcium sensor") with Ca2+ docking. Beat 2: fewer Ca2+
docked on the sensor (gauge drops). Beat 3: granules release PTH hexagons out of all four glands into the
blood; label "PTH up" with a leader to the glands. data-parts: `parathyroid`, `pth`, `hormone` (the PTH tokens).

### Step 3, "PTH at bone: calcium comes out of the store" (kind `bone`, 4 beats). Grade 2.
Problems: dog-bone icon; PTH goes gland -> bone over the blood; "osteoclasts up / Ca2+ out up / osteoblasts down"
pills stacked at y 1060-1160, 250 units below the bone; **osteoclasts and osteoblasts are never drawn**;
the "PTH into bloo[d]" label is cut by an arrow.
Redraw: a long bone (femur-like) cut lengthwise: compact cortical shell (ivory with fine lamellar lines),
spongy trabecular lattice at the ends, marrow cavity tinted. Inset on the bone surface: a trabecula with a
row of cuboidal **osteoblasts** (blue-grey, lining the surface over a pale osteoid strip) and one large
multinucleated **osteoclast** (3-5 nuclei, ruffled border facing the bone, sitting in a scalloped resorption
pit). Beat 2: PTH tokens leave the vessel to the bone. Beat 3: the pit deepens (animate the scallop depth by
t) and Ca2+ dots rise from the pit into a capillary in the inset and on into the vessel; label "osteoclasts
more active" with leader. Beat 4: osteoblasts dim/desaturate with "osteoblasts held back" label. Keep the
caption's wording; do not draw RANKL signalling (not in the caption or sources). data-parts: `osteoclast`,
`osteoblast`.

### Step 4, "PTH at the kidney: less calcium lost in urine" (kind `kidney`, 3 beats). Grade 2.
Problems: a bean; urine is two lines dropping out of the bottom of the bean; "reabsorb" is just an arrow
from the bean up to the pill; no tubule, though the caption is about tubules.
Redraw: coronal-section kidney: capsule, darker cortex, striped medullary pyramids, renal pelvis funnelling
into a ureter that carries the urine flow down and off the map (urine tokens travel in the ureter). Renal
artery/vein connect to the vessel band at the hilum. Inset: a tubule segment in cross-section (ring of cuboidal
epithelial cells around a lumen labelled "filtered fluid") beside a peritubular capillary. Ca2+ dots move
lumen -> cell -> capillary ("reabsorbed", teal arrow); a few continue down the lumen toward "urine". Beat 3:
more cross into the capillary, fewer continue to urine (the existing `caKidney` / `caUrine` rates). Do not
name the segment (DCT) unless a source quote supports it; label "tubule". data-part: `reabsorb`.

### Step 5, "The kidney makes calcitriol for the gut" (kind `activate`, 4 beats). Grade 3.
Problems: calcitriol arcs kidney -> gut under the map like a pipe; the gut is a rounded rectangle; "calcium in
food" arrow enters the box from outside the frame.
Redraw: the same kidney; violet calcitriol triangles leave via the renal vein into the vessel band and leave it
again at the gut (hormone in blood). Small intestine drawn as 3-4 overlapping coiled loops of tube with a
mesenteric fold, peach-pink with a lighter highlight on each loop's crest. Food calcium enters the lumen from
a short "from food" tube end (stomach-side cut end, labelled). Inset: a villus (finger with a single layer of
columnar enterocytes and a central capillary); calcitriol docks on enterocytes, Ca2+ dots cross the
enterocytes into the capillary. The quote under the caption is unchanged. data-part: `calcitriol`.

### Step 6, "Enough calcium turns PTH down; calcitonin" (kind `feedback`, 5 beats). Grade 3.
Problems: the most cluttered frame: 12 arrows at once in beat 4; calcitonin squares fly straight from the
isthmus to bone, kidney and gut; C cells sit in the isthmus (anatomically wrong); the feedback arrow hits one
gland; "Ca2+ in urine" label is struck by its arrowhead; pills at the bottom.
Redraw: beat 2: a dashed ink feedback arc from the gauge (rising) to the glands with a flat-headed inhibition
bar (T-end) rather than an arrowhead, so "inhibits" reads as a block; PTH token streams thin from all four
glands. Beat 3: inset on a thyroid lobe: a follicle cross-section (ring of follicular cells around pink colloid)
with **C cells** drawn as paler, larger cells nestled between follicles; they glow and release blue squares into
the vessel. Beat 4: calcitonin leaves the vessel to bone, kidney and gut (not direct lines); at each target a
short blue word: "osteoclasts slow" (osteoclast in the bone inset dims), "more Ca2+ in urine" (ureter stream
thickens), "less absorbed" (villus stream thins). Beat 5: gauge back to normal. Hide flows whose rate is <0.3
instead of drawing faint lines everywhere. data-parts: `negative-feedback`, `c-cells`, `calcitonin`.

### Step 7, "Phosphate: the kidney sends it the other way" (kind `phosphate`, 3 beats). Grade 3.
Problems: phosphate arrow from bone crosses the "PTH -> bone" label; urine arrows strike their labels; the
key contrast (Ca kept, phosphate lost) is two thin parallel lines out of the bean bottom; phone pills overlap.
Redraw: bone inset from step 3 releases teal dots and grey rings together from the pit (beat 2,
"calcium and phosphate come out together"). Beat 3: kidney tubule inset shows the opposite handling side by
side: teal dots turn toward the capillary (kept), grey rings turn down the lumen to the ureter (lost), with two
matching blue words "Ca2+ kept" / "phosphate lost in urine". In the ureter, rings outnumber dots. data-part:
`phosphate`.

### Step 8, "Primary hyperparathyroidism" (state `phpt`, 2 beats, What-changes-it). Grade 3.
Problems: **all four glands light identically**, but the caption says "a parathyroid gland overproduces";
the ghost (wide grey bands) reads as shadows, not "normal"; dotted "not stated" lines for calcitriol/urine/
phosphate add five extra grey arrows of noise; pills at the bottom.
Redraw: one parathyroid grows to about 2x (morph by t, ochre deepening) while the other three stay normal size
(do not shrink them: not stated); its PTH stream thickens. Bone pit deepens, tubule reabsorption and gut
absorption arrows thicken (the stated `boneRelease`, `kidneyCa`, `gutCa` up). Gauge rises into the high band;
dashed grey ghost line at the normal level with a blue arrow and the words "calcium rises". Ghost: draw the
normal flow as a 1.5-unit dashed `#8a8f84` line under each changed flow (FORMAT ghost), not a 10-unit band.
"Not stated" flows: drop them from the map and list them in the step's existing `.not-stated` note (they are
already listed there), or keep one small dotted legend chip. data-part: `primary-hyperparathyroidism` (the
enlarged gland).

### Step 9, "Hypoparathyroidism" (state `hypopara`). Grade 3.
Problems: glands get a blue "lit" outline when they are the failing organ; "calcium down" and "phosphorus up"
pills overlap dots in the vessel; calcitriol-down is a pill under the kidney with no visual link.
Redraw: all four glands shrink and fade toward grey (morph by t) with a faint dashed outline of their normal
size; PTH stream thins to a trickle. Gauge falls (ghost line + "calcium falls"). Phosphate rings multiply in
the vessel ("phosphate rises" with up arrow). Calcitriol triangles from the renal vein thin ("less calcitriol").
Caption says "most often after injury during neck surgery": optional tiny scalpel-free cue such as a dashed
suture line on the neck outline; skip if it clutters. data-part: `hypoparathyroidism`.

### Step 10, "Vitamin D deficiency" (state `vitd`). Grade 2.
Problems: picture shows almost nothing changing except the gut arrow thinning and two pills; "25-OH D:
deficiency zone" is a pill under the gut with no gauge; PTH, kidney, phosphate all drawn as dotted "not stated"
grey (the frame is mostly grey noise).
Redraw: villus inset: few Ca2+ cross ("gut absorbs less"); bone cortex thins and trabeculae sparsen by t
("stores drawn out"); gauge falls. Add a small second gauge for **25-OH D** beside the calcium gauge (same capsule
style, zones from `clinical-values.json` values: deficiency / insufficiency / sufficiency, labels from that file
only), its marker sliding into the deficiency zone. Do NOT draw PTH up (secondary hyperparathyroidism) unless a
source quote is added to `clinical-values.json`; the lesson's rule is sourced claims only. data-part: `vitd25`.

### Step 11, "Decreased renal function" (state `ckd`). Grade 3.
Problems: the kidney's change is a dashed outline and 45 % opacity, which reads as "disabled UI"; phosphate-up
pill overlaps the dots; most of the map is grey dotted.
Redraw: kidney shrinks (about 80 %), cortex thins, surface becomes finely irregular/scarred (morph by t), colour
shifts duller; ghost outline of the normal kidney size dashed grey with "kidney shrinks, works less". Phosphate
rings accumulate in the vessel ("phosphate builds up", blue up arrow), gauge falls ("calcium falls"). Unstated
flows removed from the map (listed in the note). data-parts: `chronic-kidney-disease` (kidney), `hyperphosphatemia`
(the ring cloud).

### Step 12, "Compare the four states" (kind `compare`, state picker). Grade 3.
Problems: same frame as 8-11 replayed; nothing aids comparison; on phone the dock and a 5-line legend cover
most of it.
Redraw: keep the replay-from-normal behaviour (it is good), using the redrawn organs and the same per-state
morphs as steps 8-11. Add a compact 4-row "signature strip" along the bottom (calcium / PTH / phosphate /
calcitriol as four small icons with up/down/blank arrows, blank = not stated), so the four states can be told
apart at a glance; it must use only `states[].directions`. Legend: a single line "dashed grey = normal".

### Summary key diagram (`staticSVG`, Summary tab). Grade 3.
Same map as step 12 normal, still at 780 x 690 with clipped/overlapping labels ("PTH -> bo[ne]" under a hexagon,
"PTH into blood" struck). Regenerate from the redrawn map at its final normal frame.

## 4. Graphs and charts

There is no chart in the step pictures; the only quantitative mark is the vertical calcium gauge (three bands +
`lv`-driven teal fill + black triangle). It works as a model readout and should stay model-driven. Lift it: a
capsule with rounded ends and a soft inner shadow, the normal band green-washed and the two outer bands a calm
neutral (not peach for both), tick labels at 17+ units outside the capsule, the marker as a small blue chevron,
and a dashed grey ghost tick for "normal" on every What-changes-it step. The Clinical values tab bars (HTML,
not SVG) are fine.

## 5. Reusable primitives this lesson needs

- Blood vessel, longitudinal section: layered wall + lumen gradient + optional RBC field; with "branch-off" ports.
- Plasma proteins: albumin (lumpy globular protein) with binding sites; small-anion complex glyph.
- Thyroid, posterior view, with trachea; four parathyroid glands (size/opacity animatable per gland).
- Thyroid follicle cross-section with interfollicular C cells.
- Endocrine cell with secretory granules and a membrane receptor (calcium sensor) glyph.
- Long bone, longitudinal section (cortex, trabeculae, marrow); thinning by t.
- Bone remodelling surface: osteoclast (multinucleated, ruffled border, resorption pit with animatable depth), osteoblast row with osteoid.
- Kidney, coronal section (cortex, pyramids, pelvis, ureter, hilum vessels); shrink/scar morph by t.
- Renal tubule cross-section with peritubular capillary (transepithelial transport arrows).
- Small intestine loops; villus with enterocytes and central capillary.
- Zoom inset (circle or rounded panel with tangent connector lines to its organ).
- Hormone tokens: PTH hexagon, calcitriol triangle, calcitonin square, Ca2+ dot, phosphate ring (existing shapes, add a 1-unit highlight).
- Inhibition connector (dashed arc with T-bar end).
- Vertical level gauge with zones and ghost tick (shared with other endocrine lessons).
- Leader-line label with collision-free placement.

## 6. Risks for a redraw

- **Not on the kit.** Moving to 480 x 420 means rewriting both `LAYOUTS` (every coordinate in `paths`, `labels`,
  `co`, `text`) or replacing them with one layout. The narrow/wide split by `matchMedia` and the dock placement
  (`placeDock`) live in app.js; a single 480 x 420 picture removes the need for `LAYOUTS.narrow`.
- **Model-driven geometry.** Token counts, stroke widths, dot counts and gauge level are derived from `f`, `lv`,
  `ph`, `alb`, `cc`; keep those as the only drivers. `stateFrame()` derives everything from
  `clinical-values.json` `states[].directions`; a redraw must not hard-code state effects that the JSON does not
  state (e.g. PTH up in vitamin D deficiency or CKD: true clinically, but unsourced here and the lesson promises
  every claim is quoted).
- **Hooks in the SVG.** `data-node` (pt, cc, blood, gauge, bone, kidney, gut), `data-flow` / `data-from` /
  `data-to`, `data-state="changed"`, `data-muted="not stated"`, `data-ghost="normal"`, `data-change` (callouts).
  No test in the repo references them today, but keep them (or rename consistently) for any future smoke test.
  The `<title id="pic-title">`/`<desc id="pic-desc">` are rewritten each frame by `draw()`; keep both ids.
- **data-part wiring is new work.** No `<dfn data-part>` exists; adding it needs the kit's hover handler or a local
  one (the kit's `kit.js` is not loaded here).
- **Shared stage.** The `#stage` figure is moved between steps; any per-step defs (gradients, clip paths,
  markers) must be defined once in the shared SVG with unique ids, and the summary `staticSVG` uses a `s-`
  prefix for markers; gradients need the same treatment to avoid id clashes on the Summary tab.
- **Signature caching.** `draw()` only re-renders nodes/flows/callouts when a JSON signature changes
  (`fig.sig.n/f/c`). Any new animated organ morph (gland size, kidney shrink, pit depth) must be added to the
  signature or drawn in the per-frame layers (`g-blood`/`g-tokens`), or it will freeze.
- **Accuracy traps.** C cells are interfollicular in the lobes, not in the isthmus; the isthmus is anterior, so it is
  hidden in a posterior view; superior vs inferior parathyroids sit on the posterior lobes; PHPT is drawn as one
  gland (caption wording); calcitriol and calcitonin travel in blood; do not name tubule segments, transporters
  (TRPV6, calbindin, NCX1), RANKL or FGF23 unless a source quote is added.
- **Label overlap.** Every current frame has at least one label/arrow collision; check at 1280 and 375 x 553 with the
  dock visible, since the sticky dock sits over the lower third of the picture on phones.
- **Type floor.** Raising text from 15 to 17+ units in a smaller frame will not fit the current long labels
  ("Ca2+ out of bone up", "25-OH D: deficiency zone"); budget short wording.
