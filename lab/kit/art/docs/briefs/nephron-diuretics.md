# Redraw brief: nephron-diuretics (Lesson 2, "The Nephron and Diuretics")

Audit of 17 steps, shot at t=0.35 and t=1 (step 1 and 12 are stills). Shots:
`/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/audit/shots/nephron-diuretics/`

Overall grade: **3 / 10**. The teaching model and the motion logic are good (arrow widths, urine bars and
salt particles are all driven by `model.js` through `N.vis()`; dashed ghosts are present on every drug
step). The pictures are not. The nephron is a lilac garden hose with a black outline drawn over flat
horizontal stripes, the glomerulus is a white disc with a squiggle, every "segment" is shown by a
yellow highlighter glow, and every transport event is a block arrow pointing into empty space (there is
no capillary for anything to go back to). It reads as a subway map, not a nephron. Two anatomical
contradictions with the captions exist (the distal tubule is drawn far from the filter; the collecting
duct is drawn as one nephron's private tail).

## How the pictures are built (what a redraw must keep)

Files: `lab/nephron-diuretics/nephron.js` (the nephron drawing, shared by the lesson, the Clinical values
tab and Explore freely), `app.js` (step scenes 1 to 17 plus the two tabs), `model.js` (teaching model, do
not touch), `style.css` (2 lines).

- **Geometry is centralised in `nephron.js`:** `GLOM {x:54,y:72,r:24}`, `SEG` (pt, desc, thin, tal, dct,
  cd centre-line polylines), `ORDER`, `SPAN`/`trackAt` (salt particles ride `TR`, the concatenated
  centre line), `ARROWS` (x, y, dir, len, kind per transport arrow), `BLOCK_AT` (drug block marks),
  `UB` (urine box), `GA` (blood-volume gauge), `W_BANDS = 346` (band width). If the tube is redrawn
  the arrows, block marks, particle track and highlight glows must all be re-anchored to the new
  centre lines; derive them from SEG rather than hard-coding again.
- **Model-driven sizes:** `vis(m)` maps model to arrow width (`aw`), urine bar height (`bar`), gauge
  level, medulla tint `g` (loop and osmotic wash the gradient out). `lerpVis` morphs normal to drug.
  Keep every one of these as the thing that varies; the redraw changes how an amount is drawn, not
  where the amount comes from.
- **Hooks:** `data-arrow="<key>"` on each arrow polygon, `data-bars` / `data-bars="normal"` on urine bars,
  `data-ghost="normal"` + `class="ghost"` on dashed normal outlines (arrows, bars, gauge line),
  `data-block="<drug>"` on block marks, `data-flow` on the particle group, `data-named` on the
  drug words group. Keep them all.
- **data-part names used by `<dfn>`** (must survive): nephron, glomerulus, filtrate, reabsorption, sodium,
  osmosis, proximal, medulla, loop, tal, carrier, distal, collecting, aldosterone, potassium, adh, urine,
  blood-volume, block, bicarbonate, mannitol. Arrow parts are space-separated lists
  (`'loop tal carrier'`, `'collecting aldosterone'`, `'collecting adh'`), so one arrow lights for several terms.
- `N.nephron()` and `N.blocker()` are reused by Explore freely (several blocks at once, partial strength
  opacity) and the Clinical values tab. Any redraw of the nephron must still look right with two or
  three block marks and with arbitrary slider values.
- Text: kit classes only (`sm`, `xs`, `b`, colour classes); the pictures are 480 wide, H = 404 for every
  full-nephron step, 380/340/374 for steps 2/3/4.

## Global redraw direction (applies to steps 1, 5 to 17)

Replace the hose-on-stripes with a **schematic nephron in the Netter/Osmosis idiom**, at one fixed
layout reused by every step:

1. **Kidney tissue background.** Cortex as a warm pale tissue tone at top, outer medulla and inner
   medulla below, with the medulla as a *vertical gradient* (light to deep amber) instead of three hard
   stripes, a thin dashed cortico-medullary boundary, and small side labels "cortex" / "medulla". The
   gradient's depth still keys off `v.g` (wash-out on loop and osmotic). Optional faint "saltier"
   wedge arrow down the left edge.
2. **Renal corpuscle** (top-left, cortex): Bowman's capsule as a cup (outer parietal wall + inner space,
   pale blue filtrate tint) holding a glomerular tuft of 3 to 4 looping capillary lobes in red with a
   lighter highlight stroke; afferent arteriole (wider) and efferent arteriole (narrower) entering
   and leaving at the vascular pole on the left; the proximal tubule leaving from the urinary pole
   opposite. Keep `data-part="glomerulus"` on the tuft.
3. **Tubule as a walled tube with a lumen**, not an outlined line: outer wall stroke in a segment
   colour, inner lumen in pale filtrate blue, a thin highlight line along one side for depth. Wall
   thickness carries meaning: **proximal tubule thick-walled with a fuzzy brush-border inner edge**
   (short perpendicular ticks), **descending and thin ascending limbs thin-walled**, **thick ascending
   limb visibly thicker**, distal tubule medium, collecting duct medium and wider in calibre.
4. **Correct topology** (two current errors):
   - The **distal convoluted tubule must come back up to touch its own corpuscle** at the vascular
     pole (the macula densa contact), then wind briefly before joining the collecting duct. The caption
     of step 8 says "Back near the filter"; today it sits ~200 units away. Redraw: TAL rises in the
     medulla, enters the cortex, kinks to touch the afferent arteriole beside the glomerulus, then the
     DCT coils once and runs right to the collecting duct.
   - The **collecting duct is a shared trunk**: draw it as a separate, wider vertical duct on the right
     with the DCT/connecting tubule joining it from the side, plus one or two faint ghost connecting
     tubules from other (cropped) nephrons joining higher up, so "Many nephrons drain into one
     collecting duct" (step 9 caption) is visible. It runs from cortex to the bottom of the medulla
     and exits into a papilla tip / "to the renal pelvis" arrow.
   - Proximal tubule: convoluted part near the corpuscle, then a short straight part dropping toward
     the medulla before the thin descending limb. Hairpin loop bottom in the medulla.
5. **Peritubular capillary**: a single red/pink vessel (wall + lumen + 2 or 3 RBC ellipses) that runs
   alongside the tubule in the cortex and a vasa-recta hairpin beside the loop in the medulla, drawn
   behind the tubule. Every reabsorption arrow now ends *at this vessel* ("back to the blood" becomes
   literal). Arrows keep `data-arrow` and their model widths; give them a rounded tail and a crisp
   head (use `arrowFixed`-style fixed-size heads so a thin arrow still reads as an arrow), salt in
   amber, water in blue, potassium in purple pointing *into* the lumen.
6. **Segment identity by colour, not highlighter.** Give each segment a quiet wall tint (proximal
   green-grey, loop muted, TAL a warm tone, DCT teal-ish, CD slate) and, when a step teaches a segment,
   darken that segment's wall and dim the rest to 35 % instead of drawing the yellow glow. Keep
   `N.glow()`'s callers but make it a "focus" treatment.
7. **Labels**: every segment label sits in clear space with a 1.5 px muted leader line ending in a small
   dot on the segment. No label inside a band without a halo, no label touching the tube (step 9's
   "channels" currently sits on the tube end).
8. **Urine box and blood-volume gauge** become recognisable objects: urine as a small collecting-cup
   / ureter-drop glyph holding the two bars (keep `UB`, bars are model-driven); blood volume as a
   vessel cross-section or a graduated cylinder with a meniscus, gradient-filled blood, tick marks, and
   the dashed normal line (keep `GA`, `gaugeY`).

Palette: blood red `#b3261e` (arterial tuft/arterioles), deoxy/venous a darker maroon for the capillary
outflow if shown, filtrate/lumen pale blue `#e4e9ff`, salt amber `#a34700`, water blue `#254dff`,
potassium purple `#6b3fa0`, mannitol muted grey `#53584d`, tissue tones warm creams to amber. Keep
stroke weights to three: 3 (outer walls), 1.5 (inner detail), 1.5 dashed (ghosts).

## Per step

### Step 1, meet (still). Grade 3
Problems: glomerulus is a white disc with a red squiggle; tube is a uniform lilac hose; DCT far from
the corpuscle; CD is a private tail; kidney bean top-right is a pink blob with four red dashes and a
yellow dot (the "packed with nephrons" idea does not read); bands are hard stripes with no names.
Redraw: the global nephron at full opacity, all segments in their tints, corpuscle with afferent/
efferent arterioles, capillary faint behind. Right column: a proper kidney coronal section (bean
silhouette with capsule, cortex rim, 5 to 6 medullary pyramids, renal pelvis and ureter, renal
artery/vein at the hilum) with a small square "zoom" box on one pyramid and two thin lines fanning to
the main nephron, replacing the yellow dot. Labels "filter" (leader to corpuscle), "one long, folded
tube", "urine out, to the bladder" (arrow from CD tip). `data-part="nephron"` on the whole nephron group.

### Step 2, filter (loop). Grade 4
Problems: Bowman's capsule is a filled blue circle (no cup, no parietal wall, no Bowman space);
the tuft is one red hose snake; afferent and efferent are the same width; proteins are green squares
and RBCs flat ellipses; particles sometimes sit on the capillary wall (t=1, bottom) and stack.
Labels "blood in"/"blood out" have no arrows.
Redraw: the corpuscle close-up. Double-walled cup (parietal layer as thin ink line, visceral layer
implied by podocyte foot bumps along the capillaries), Bowman space pale blue opening to the proximal
tubule on the right (urinary pole). Afferent arteriole visibly wider entering top-left, efferent
narrower leaving bottom-left (vascular pole), each with a direction chevron. Tuft as 3 or 4 capillary
lobes (one continuous track still, so `tuftAt` keeps working) with a darker wall, lighter lumen and a
highlight line. RBCs as biconcave discs (ellipse with a paler centre); proteins as small purple-grey
blobs larger than the pores (or keep green but round, labelled "protein"). Filtrate particles leave
through the capillary wall into Bowman space and stream into the tubule. Keep the drops/diamonds
glyphs (consistent with the rest of the lesson). Optional inset: a 3-layer filtration barrier strip
(fenestrated endothelium, basement membrane, podocyte slits) at bottom-right if space; otherwise skip.
Keep parts glomerulus, filtrate.

### Step 3, back (bar chart, plays once). Grade 5
The chart idea is right and the "only a sliver" call-out works. Problems: bars are generic rectangles
with no values; the "back" arrow floats; the sliver is 3 units and hard to see on a phone; three
dashed frames add noise.
Lift: drop the dashed frames except as the faint target ghost; add value-free but proportional labels
from the model ("about 99 % back", "about 1 % left", both computed from `BASE.waterOut`, never
typed); make the third column a magnifier inset (a circle zoom of the sliver base) so the sliver is
legible; curved arrow from column 1 top to column 2 top; soft top-to-bottom gradient fills (filtrate
blue, blood red) with 6 px rounded tops. Keep `data-part="reabsorption"` on the middle bar. Do not add
litre figures unless they are added to clinical-values.json (180 L/day is not there today).

### Step 4, osmosis (plays once). Grade 3
Problems: "tube wall" is three cream rounded squares with an amber ring for a nucleus; no apical or
basolateral membranes, no tight junctions, no carrier; "blood" is a pink rectangle; drops and diamonds
float in empty fields.
Redraw: a cross-section strip of tubular epithelium. Left: lumen (pale blue). Middle: 3 cuboidal cells
with brush-border microvilli on the luminal face, a basolateral membrane on the right, dark-ink tight
junctions at the top between cells, round nuclei with a nucleolus, soft cytoplasm gradient. On the
apical membrane draw one small carrier protein (a two-lobed transmembrane shape) per cell where the
salt diamonds cross; on the basolateral side a pump glyph. Right: interstitium then a peritubular
capillary (wall, lumen with 2 RBCs). Salt diamonds route lumen to carrier to cell to capillary;
water drops route between the cells (through the junction gap) and through the cells, then into the
capillary, after the salt. Keep the two-line caption in the picture ("salt is carried across;" amber,
"water follows on its own" blue). Keep parts sodium, osmosis. Geometry in OSM_SALT/OSM_DROP must be
re-routed to the new cell positions.

### Step 5, proximal tubule (grows). Grade 3
Problems: yellow glow; arrows point up into empty cortex; labels "salt"/"water" sit off the arrows;
right column text block "most salt and water go back to the blood" is detached. The PT looks no
different from any other segment.
Redraw: global nephron, PT in focus (thick brush-border wall), others dimmed; salt and water arrows
from the PT wall to the peritubular capillary, widths from `BV.ptSalt/ptWater`; a small "~2/3 of salt
and water" tag computed from `BASE.s.pt` (67 % from clinical-values). Label with leader.

### Step 6, descending limb (grows). Grade 3
Problems: glow covers both descending and thin ascending limb, so it looks like the whole loop loses
water; one arrow; "water" label and band labels sit over the stripes with halo patches; "outer layer"
should be "cortex".
Redraw: focus only the thin descending limb (keep `thin` in `hl` only if the redraw distinguishes it;
the thin ascending limb is water-impermeable and should not be highlighted as losing water); 2 or 3
small water arrows stacked down the limb, growing with depth, ending at the vasa recta; medulla
gradient visibly deepening; side labels "cortex", "medulla: saltier with depth".

### Step 7, thick ascending limb (grows). Grade 3
Problems: TAL is drawn as thin as the descending limb; label "thick ascending limb" plus "walls block
water" is a 5-line stack squeezed between the limb and the CD; the "carrier" is a 5-unit circle on the
tube edge.
Redraw: TAL with a clearly thicker wall, a row of 3 small carrier glyphs (two-lobed transmembrane
proteins, `data-part="carrier"`) on its outer wall from which the salt arrow leaves into the
interstitium; a small "no water" wall symbol (a blue drop with a bar against the wall). Labels on the
left of the loop in clear space with leaders.

### Step 8, distal tubule (grows). Grade 2
Problems: anatomically misplaced (far from the corpuscle, contradicting the caption); glow is a
banana; the salt arrow points up into nothing.
Redraw: DCT in its corrected place beside the corpuscle (touching the afferent arteriole), short
coil, salt arrow to the capillary, "walls block water" tag with a leader. Arrow `dctSalt` and
`BLOCK_AT.thiazide` re-anchored to the new DCT.

### Step 9, collecting duct salt + potassium (grows). Grade 3
Problems: "channels" overlaps the tube end; CD is the nephron's own tail; potassium arrow and label
fine but floating; "aldosterone opens salt channels" is a 3-line text stack.
Redraw: the shared collecting duct trunk with principal cells hinted on its wall (small channel
glyphs: an ENaC pore for Na+ in, a ROMK pore for K+ out); salt arrow from duct to capillary, potassium
arrow from capillary side into the lumen, both from those glyphs. A small hormone tag "aldosterone"
with a dashed arrow onto the channel row. Labels clear of the duct.

### Step 10, collecting duct water (grows). Grade 3
Problems: same glow; water arrow points into the band; ADH text stack crowded at right edge
("hormone opens" touches the frame).
Redraw: same duct, aquaporin glyphs (small hourglass pores) appear on the duct wall in the medullary
part as `t` grows, water arrows leave through them to the vasa recta; "ADH" tag with dashed arrow onto
the pores. Keep `data-part="adh"`.

### Step 11, whole journey (cycle). Grade 4
The moving salt diamonds that exit at each arrow are the best idea in the lesson and should be kept.
Problems: labels "distal tubule"/"collecting duct" stacked at right with no leaders (the reader can not
tell which is which); stray faded diamonds float in the band; urine box is a white card.
Redraw: global nephron with all segments in their tints, labels with leaders, particles exit to the
capillary instead of fading in mid-air, urine as the cup glyph with the two bars.

### Step 12, blood volume (still). Grade 3
Problems: a red rounded rectangle in a white box; left text "the arrows show salt and water kept: they
fill the blood" is a 4-line paragraph over the medulla.
Redraw: blood-volume as a graduated vessel/cylinder (or a vein cross-section whose lumen diameter is
the level) with a meniscus and gradient fill; a short curved arrow from the capillary to the gauge
labelled "kept salt and water fill the blood"; nephron as in step 11, not moving.

### Steps 13 to 17, drug "What changes it" steps (loop, thiazide, K-sparing, CA inhibitor, osmotic). Grades 4, 3, 3, 3, 4
Shared problems:
- The block mark is a generic red "no entry" disc on the tube; it does not show *what* is blocked
  (NKCC2 carrier, NCC carrier, ENaC channel / aldosterone receptor, carbonic anhydrase enzyme).
- What moved is named only as a left-hand list of "↑ salt out" lines in a band, not at the thing
  that moved. FORMAT asks for the change named on the picture with an arrow ("arrow shrinks", "bar
  rises").
- The ghosted normal arrow and the current arrow overlap so closely that the change is invisible for
  thiazide, K-sparing and CA (shots t=1).
- Blood volume drop is only arrowed on the loop step (`y1 - y0 > 12` gate); on the others the gauge
  barely moves and nothing names it.
- The readout reports blood potassium and bicarbonate; the picture has no potassium level or
  bicarbonate on it (except a text line on CA). The potassium *arrow* changes, which is fine, but say
  so on the picture ("more K+ pushed out").
- Drug name is not on the picture.
- t=0.35 is already almost fully morphed (HOLD .12, MORPH .42): fine, but the loop continues for 58 %
  of the time with nothing new; consider showing the particle flood more strongly.
Redraw for all five:
- Drug as a small labelled pill/molecule tag (e.g. "furosemide") with a short line to a **specific
  block glyph drawn on the target protein**: loop and thiazide, a red bar across the carrier glyph
  on the TAL / DCT wall; K-sparing, a red bar across the ENaC pore plus (spironolactone) a red cross on
  the aldosterone tag; CA inhibitor, a red cross on a small "CA" enzyme glyph on the PT brush border;
  osmotic, no block, grey mannitol particles in the lumen labelled "mannitol stays in the tube".
- Ghost arrows drawn offset (or as a dashed outline *larger* than the shrunken arrow, centred on the
  same tail) so the shrink reads; put the words at the arrow: "salt uptake blocked" with a small
  delta arrow (`delta()` in draw.js) on the blocked arrow; "more salt reaches here" on the downstream
  arrow; "more K+ out" on the potassium arrow (loop, thiazide, CA) or "less K+ out" (K-sparing);
  "urine rises" beside the bars; "blood volume falls" beside the gauge whenever the model says it
  falls (drop the `> 12` gate or lower it).
- Loop: label the paling medulla "medulla loses its salt" (the gradient wash-out is correct and is the
  key teaching point). Thiazide: medulla stays, say "gradient kept" in muted text. CA: a few small
  bicarbonate glyphs (HCO3- label, kit `xs`) staying in the PT lumen and riding to the urine, with
  `data-part="bicarbonate"` on them (today the part is on a text line). Osmotic: water arrows from PT
  and descending limb shrink; water bar rises far above salt bar; name both.
- Keep the left-side word list only if it fits as a compact 3-item legend; it must not cover the loop.

## Reusable primitives this lesson needs

- Renal corpuscle: Bowman's capsule cup + glomerular capillary tuft, afferent (wide) / efferent (narrow)
  arterioles, vascular and urinary poles; two scales (icon in nephron, close-up for step 2).
- Kidney coronal section: capsule, cortex, pyramids, papillae, pelvis, ureter, hilar vessels.
- Walled tubule segment with lumen, parametric wall thickness and optional brush border, drawn along
  any centre-line polyline (shared with any GI/renal lesson).
- Peritubular capillary / vasa recta vessel along a polyline with RBC ellipses.
- Cuboidal epithelial cell row with microvilli, tight junctions, nuclei, apical and basolateral membranes.
- Membrane transport glyphs: cotransporter/carrier (two-lobed), channel pore (ENaC/ROMK), aquaporin
  (hourglass), Na/K pump; each with a "blocked" overlay variant.
- Enzyme glyph (carbonic anhydrase) with blocked overlay.
- Hormone tag with dashed action arrow (aldosterone, ADH).
- Drug tag (pill/molecule label) with leader to its target.
- Model-width transport arrow with fixed-size head and dashed ghost outline.
- Solute glyphs: salt diamond (Na+), water drop, K+ dot, HCO3- glyph, mannitol grey dot, RBC
  biconcave disc, plasma protein blob.
- Medulla osmotic gradient background (vertical gradient, washable by a 0..1 factor).
- Blood-volume gauge (graduated vessel with meniscus, dashed normal line).
- Urine collecting-cup glyph holding two bars with ghost outlines.
- Labels with leader lines and halos; magnifier inset for a tiny bar.

## Risks a redraw could break

- `nephron.js` is shared by three places (steps 11 to 17, Clinical values tab, Explore freely with any
  mix of five sliders and multiple simultaneous block marks at partial opacity). Test the Explore tab
  with all five drugs on.
- Moving the tube moves everything: `SEG`, `SPAN`, `trackAt` (particles), `ARROWS`, `BLOCK_AT`, `glow`,
  the `UB` box and `GA` gauge, and the hard-coded label coordinates in `BUILD.words` and `whole`.
  Derive arrow anchors and block points from the SEG polylines.
- Arrow widths, urine bar heights, gauge level and medulla tint must remain from `vis(m)`; do not
  hand-tune them per step. Do not edit `model.js`.
- Hooks to keep: `data-arrow`, `data-bars` / `data-bars="normal"`, `data-ghost="normal"` with
  `class="ghost"`, `data-block`, `data-flow`, `data-named`, and every `data-part` listed above,
  including the space-separated multi-part arrows (`'loop tal carrier'`, `'collecting aldosterone'`,
  `'collecting adh'`, `'potassium'`).
- `changeScene` injects `data-part="bicarbonate"` by regex over the CA word list; if the words change,
  move the part to the new bicarbonate glyphs explicitly.
- aria-labels (SEG_LABEL, DRUG_LABEL, step 1/2/3/4 labels) describe the current geometry ("second
  winding stretch near the filter", "urine box"); rewrite them with the redraw.
- Label density: 480 x 404 with a nephron, a capillary, the urine cup and a gauge is tight; at 375 px
  the `xs` class is 12.75 px. Budget the right-hand column (x 352 to 474) for the gauge and urine cup
  only; put segment labels at left with leaders.
- Accuracy traps: DCT must return to its own corpuscle; CD is shared by many nephrons; thin ascending
  limb is water-impermeable (do not show water leaving it); TAL is water-impermeable; afferent wider
  than efferent; K+ moves *into* the lumen in the CD; loop diuretics wash out the medullary gradient,
  thiazides do not; acetazolamide causes bicarbonate loss and hypokalaemia; K-sparing raises plasma K+;
  mannitol is filtered and not reabsorbed. Do not add numeric values (GFR 180 L/day, 300 to 1200
  mOsm/kg) unless they are first added to clinical-values.json.
