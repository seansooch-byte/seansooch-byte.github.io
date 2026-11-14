# Redraw brief: hpa-axis-steroids (Lesson 15, The HPA axis and steroids)

Files: `lab/hpa-axis-steroids/app.js` (all pictures), `model.js` (window.HPAModel, drives every level),
`index.html` (captions and `dfn data-part`), `style.css` (nothing picture-related). Shots audited at t=0.35
and t=1 for all 17 steps (`audit/shots/hpa-axis-steroids/`).

## Verdict

Overall grade **3 / 10**. The lesson is two kinds of picture:

- **Steps 1 to 5** are one-off concept pictures. Each one uses a flat placeholder where an organ or cell should be:
  a gothic-arch "adrenal" sitting on a bean, a pill-shaped "body", an egg for the liver, a water drop for
  inflammation, a rounded bar for blood.
- **Steps 6 to 17, plus the Clinical values and Explore freely tabs**, reuse one `axis()` diagram. It is a
  flowchart: two pink pill boxes ("hypothalamus", "pituitary"), a half-dome "adrenal cortex", and a
  rounded bar for "blood". Its logic is good. Arrow widths come from the model, the brake uses the
  standard T-bar inhibition mark, the right-hand level meters have usual bands and ghost ticks, and the
  numbered stage lines play in order. Nothing in it looks like anatomy, though, and it has several real
  defects.

The biggest single gap is that there is no brain, no pituitary, no adrenal gland and no blood vessel
anywhere in an anatomy lesson about those exact organs. Fix the shared `axis()` once and 12 steps plus
2 tabs improve together.

### Defects found (fix these in any redraw, even a light one)

1. **Accuracy: the cortex's hormones leave from the medulla.** In `axis()` the cortisol arrow (x 134) and the
   aldosterone arrow (x 170) start at y 260, under the medulla (`MEDULLA_D` spans x 126 to 174). The
   medulla makes adrenaline, not steroids. In step 1 and in `kidneyAdrenal()`, the medulla also touches the
   kidney: its base sits on the gland's open floor, so the cortex does not wrap it. Anatomically the cortex
   surrounds the medulla completely.
2. **Accuracy: kidney orientation.** In step 1 both small kidneys are drawn with the same path, so both
   hila face viewer-left. One of them faces laterally, which is wrong: both hila face the midline. Both
   kidneys also sit at the same height (the right kidney sits lower), and both adrenals are identical
   symmetric caps. The right adrenal is pyramidal and the left is crescent-shaped, running down the medial
   border of the kidney toward the hilum.
3. **Accuracy: the glucocorticoid and mineralocorticoid tablet sits inside the blood bar** (`pill(50, BL.y0+4)`).
   A tablet is swallowed. Draw it outside the vessel, with an arrow into it.
4. **Step 4 ghost bug.** The dashed "usual size" flame is translated to x 256 while the live flame sits at
   x 240 (`inflamPicture`). At t=1 (usual cortisol, `fs = 1`) the flame is the right size but offset by
   16 units, so "usual" visibly does not match the ghost.
5. **Label overlaps (FORMAT rule):**
   - The `cortisol` label (text end x 124) is hit by the cortisol arrowhead. Its half-width is up to
     `w*.85+6`, about 20 units, so the head reaches x 114.
   - The `aldosterone` label (start x 182) is hit by the green arrowhead, which reaches x 190 at width.
   - `ACTH` / `ACTH ↑ more` (x 166) touches the blue arrowhead at large widths (steps 12, 13, 16, 17).
   - The Cushing's tumor circle (cx 198, r up to 16) covers the "y" of "pituitary".
   - The secondary-insufficiency red crosses (x 103 and 197) sit on the "pituitary" text and on the brake
     T-bar.
   - In step 13 at t=0.35 the meter word collides: "aldosteron↓ usual". `meter()`'s `room` estimate
     (9.6 units per char) leaves 3 chars. The fallback still prints "↓ usual" (7 chars), so the shortening
     never helps.
   - In step 5 at t=1 a potassium square sits on "passed out".
   - lab-walk only checks text against text at t=1, so none of these fail the suite. Several are text
     against an arrow, or mid-morph.
6. **Step 8 says "blood sugar climbs" (line 3) but hides the body meters** (`show` omits `'body'`). The
   picture never shows the claim it makes.
7. **Step 17's point is invisible.** "ACTH climbs higher still" happens while ACTH is already pinned at the
   meter's right end (log span `ln 5`, clamp). The bar moves about 3 units, and `acthWord` stays empty
   because the change is under the 0.2 log threshold.
8. **Step 16's "destroyed" label fades in from 0** (`cortexCause` alpha = `km`) even though the cortex is
   destroyed from t=0 (`marks: damage: 1`). The crosses are full while the word is ghosted at t=0.35.
9. **Steps 6 and 7 lose a lot of space.** Step 6 hides the hypothalamus but keeps its 100-unit slot, so the
   top quarter is empty. Steps 6, 7, 9 and 10 leave about 90 units empty under the blood bar.
10. **Noisy ghosts.** `flowGhost()` draws a dashed outline on top of the live arrow, which hatches the arrow
    shaft (visible on CRH and ACTH in every change step). The brake ghost is two dashed lines running
    inside the brake. Neither reads as "where normal was".
11. **Blood dots do not flow in the loop steps.** Only the dots on the arrows move. The cortisol dots in the
    blood (x from 200) sit still, and they start at x 200, so the left half of the vessel is always empty.

## Shared visual system (use in every step)

- **Palette (keep the kit's C):** ink #171916, blue #254dff (ACTH, change words), amber #a34700 (cortisol and the
  brake), green #2c6a2c (aldosterone, sodium), purple #6b3fa0 (potassium), red #b3261e (blood wall, harm marks).
- **Tissue tones, shaded with one gradient each (light top-left to darker bottom-right):**
  - adrenal cortex: golden yellow #f2c27a to #d9a24f. The real cortex is yellow from its lipid; keep that.
  - medulla: red-brown #b86b4b to #8f4e35.
  - kidney: #d99a86 to #b8735f, with a lighter capsule rim.
  - brain: #ecd6e2 to #d4b5c8.
  - pituitary anterior lobe: #e3b9c9.
  - posterior lobe: #d7c7e0.
  - liver: #b76e5a to #8e4a3a.
  - muscle: #c86b6b, with striations.
  - vessel lumen: #f6dcd6 with a 1.5 unit #b3261e wall and an inner #e9a49a endothelium line.
- **Line weights:** organ outlines 1.8, internal boundaries 1.2, leader lines 1 in muted #53584d, ending in
  a 2.2-unit dot on the structure.
- **Highlights:** each organ gets one soft white highlight (an ellipse at 25% opacity, top-left).
- **Shadows:** no drop shadows; one darker inner rim stroke is enough.
- **Molecules (the lesson's signature mark).** Cortisol is a small amber steroid glyph: three fused
  hexagons and a pentagon, about 14 units wide, 1.2 stroke, amber fill at 85%. Cholesterol is the same
  ring glyph plus a short zig-zag tail, in muted ink. A glucocorticoid drug is the same ring glyph hollow:
  amber outline, white fill. Aldosterone is the ring glyph in green. These replace the plain dots and
  diamonds, so "a steroid, built from cholesterol" is visible in the shape itself. ACTH dots stay small
  blue circles (a peptide; no ring glyph).
- **Blood:** one primitive, a vessel segment with a wall, a lumen, and 3 to 5 biconcave red blood cells
  (an ellipse plus a paler inner ellipse) that drift with `t`. Use it everywhere a "blood" bar appears.
  Keep the "blood" label in red at the vessel's right end.
- **Type:** kit classes only. Labels sit in clear space with leader lines, never on top of a shape's
  outline.

---

## Step 1: glands (still). Grade 3

**Now:** a pill-shaped "the body" holding two identical bean kidneys with symmetric arch caps; a dashed
line to one enlarged kidney with an arch cap and labels.

**Problems:**
- The body is a capsule, not a torso.
- Both kidneys are identical, so one hilum faces outward. They sit at the same height.
- The adrenals are identical symmetric caps.
- The medulla sits on the kidney instead of inside the cortex.
- The cortex and medulla read as a flat two-tone sticker with no depth.
- About 30% of the frame is empty (top right, bottom left).

**Redraw (480 x ~360):**
- **Left panel (x 12 to 190): a posterior or anterior trunk silhouette.**
  - Shoulders cropped off, with a soft skin tone #f3e4d6 and a gentle waist.
  - A faint spine (stacked rounded vertebral bodies in #e6d6c6) down the midline.
  - Optionally, the aorta (red) and IVC (blue-violet) as thin midline tubes for context.
  - Two kidneys at roughly T12 to L3. The right kidney (viewer-left on an anterior view) sits about
    10 units lower. Both hila face the midline.
  - The right adrenal is a small pyramid on the right kidney's upper pole. The left adrenal is a crescent
    hugging the upper medial border of the left kidney.
  - `data-part="adrenal"` on both glands.
- **Zoom callout:** a thin muted circle around the left gland, with two tangent lines opening to the
  right panel (a proper magnifier, not a dashed diagonal).
- **Right panel (x 210 to 470): one adrenal gland cut open, sitting on a kidney's upper pole.**
  - The kidney is cropped at the bottom, with a capsule rim and a hint of renal cortex texture.
  - The gland has a thin capsule line.
  - The cortex (golden gradient) is a continuous band that wraps all the way round.
  - The medulla (red-brown) is an inner core, fully enclosed.
  - Optional: very subtle tonal banding inside the cortex (outer thin, middle thick, inner thin) for the
    three zones. **Unlabelled**, since the caption does not name them.
  - Leader lines to "cortex / outer layer" and "medulla / inner core", right-aligned in the x 360 to 470
    column; "kidney" under the kidney.
- **Title:** keep "adrenal gland: one on each kidney" (sm b) at top-left, or move it into the aria-label and
  free the space.
- **Parts:** `adrenal` (both small glands and the big one's outline group), `cortex` on the big gland's
  cortex band only, `medulla` on the core. Do not tag the big cortex as "adrenal cortex", or the "adrenal"
  dfn will light the zoomed cortex too.

## Step 2: cortisol (loop, 4 s). Grade 3

**Now:** the same arch, larger, with "cholesterol, a fatty substance" and a grey arrow into it; an amber arrow
down to a pink bar where amber dots slide left and right.

**Problems:**
- No cell, so nothing shows "built from cholesterol".
- The blood is a bar.
- At t=1 the dots pair up and overlap.
- The medulla is again on the floor of the gland.

**Redraw: zoom to a cortex cell beside a capillary.**
- **Top band (y 30 to 230): one large polygonal adrenal cortex cell.**
  - Pale gold cytoplasm gradient and a 1.5 ink membrane, drawn as a double line (a 3-unit membrane band
    with a light centre, which reads as a bilayer at this scale).
  - A round nucleus with a darker nucleolus.
  - 6 to 8 pale yellow lipid droplets: spheres with a white highlight. Label one "cholesterol / a fatty
    substance".
  - 2 or 3 mitochondria: capsule shapes with cristae lines. Unlabelled, since the caption does not name them.
- **Animation:** cholesterol glyphs (rings plus tail) leave a droplet, pass a mitochondrion, lose the tail
  and turn into amber cortisol ring glyphs. These cross the membrane at the bottom (steroids pass through
  the membrane; draw no channel) into the vessel below.
- **Bottom band (y 250 to 320): the vessel primitive (a capillary)**, with red cells and cortisol glyphs
  drifting right with `t`. Label "blood" at the right; "carried to cells all over the body" under it
  (xs).
- **Label:** "cortisol, a steroid" (xs b amber), with a leader to one glyph in the vessel.
- **Parts:** `cortex adrenal` (the cell), `cholesterol` (droplets and cholesterol glyphs), `cortisol` (cortisol
  glyphs and their label).

## Step 3: fuel (plays once, 6 s). Grade 3

**Now:**
- A cortisol bar top-left.
- An amber arrow that starts in mid-air into a flat egg labelled "liver".
- A caption line, a black arrow down into the blood bar with white hexagons, and a blood sugar meter.

**Problems:**
- The liver is an egg.
- "Partly from muscle protein" is text only; no muscle is drawn.
- The cortisol bar is disconnected from the arrow.
- The glucose hexagons in the blood are fine, but static.

**Redraw:**
- **Liver (centre-right, about x 230 to 450, y 40 to 170):** an anterior silhouette. A large right lobe, a
  wedge-shaped left lobe tapering to the left, a notch for the falciform ligament on the top edge, and a
  smooth inferior edge. Liver gradient and a highlight. Label "liver" (sm b), with a leader line, placed
  outside the shape.
- **Left (x 20 to 150): a skeletal muscle bundle**, fusiform with fine parallel striations. Label "muscle".
  A thin arrow of small amino-acid beads (open circles) runs from muscle to liver, labelled "muscle
  protein" (xs). Its rate scales with E.
- **Cortisol:** cortisol ring glyphs arrive at the liver along an amber vessel stub from the top-left.
  Their count scales with E, and they replace the separate cortisol bar. If a level bar is still wanted,
  keep it, but run the arrow out of its end.
- **Glucose:** glucose hexagons leave the liver's lower edge into the vessel primitive (y 230 to 270), drift
  right, and increase in number with `gl`.
- **Bottom:** keep the blood sugar meter (it is good) and the blue result line.
- **Parts:** `cortisol` (glyphs and the vessel stub), `sugar` (glucose, the vessel, the meter).

## Step 4: inflam (plays once, 7 s). Grade 2

**Now:** a cortisol bar, a single red water-drop shape over a dashed outline, the text "inflammation: redness,
heat, swelling", and "dashed: usual size". The top 40% is empty.

**Problems:**
- A drop is not inflammation.
- The ghost is mis-registered by 16 units (defect 4).
- There is no tissue and no immune system, although the caption names both.

**Redraw: a tissue cross-section (x 20 to 460, y 90 to 320).**
- **Layers:**
  - A skin surface (an epidermis strip, 8 units, pink-beige with a darker basal line).
  - A dermis (pale).
  - One capillary running across: the vessel primitive, seen in section along its length.
- **Inflamed state, driven by `inf` (as now):**
  - redness: the capillary widens and the surrounding dermis takes a red radial glow, opacity proportional
    to `inf`;
  - swelling: the skin surface bulges upward (bump height proportional to `inf`) and pale blue fluid dots
    collect in the dermis;
  - immune cells: 2 to 6 white blood cells (white spheres with a purple multilobed nucleus) squeeze
    through the vessel wall into the tissue, count proportional to `inf`;
  - heat: optional small wavy lines above the bump.
- **Ghost:** a dashed grey outline of the skin surface at `inf = 1`, from the same function and the same
  origin, so at E=1 it coincides exactly.
- **Labels:** "redness", "swelling", "immune cells", with leaders. Keep the bottom blue line ("more cortisol:
  calmer").
- **Cortisol:** a row of cortisol glyphs entering from the vessel (count proportional to E), or keep the
  top bar and tie it in.
- **Parts:** `flame` (rename in both places to `inflammation` if you like, but keep the dfn and the picture
  in step) on the bump, glow and cells; `cortisol` on the glyphs or bar.

## Step 5: aldo (loop, 4 s). Grade 3

**Now:**
- A half-dome "adrenal cortex" with a green arrow to a bean "kidney".
- Green dots arc from the kidney to the blood bar; purple squares run to a yellow drop "urine".
- A two-line note about renin.

**Problems:**
- No tubule, so "keep sodium, pass potassium" happens in empty air.
- The labels float.
- At t=1 a square overlaps "passed out".

**Redraw:**
- **Top-left (x 12 to 150, y 20 to 140):** a small adrenal gland on a kidney's upper pole (reuse the step 1
  primitive). A green arrow carries aldosterone ring glyphs right.
- **Top-right:** a kidney silhouette (hilum medial) with a small square marking a tubule. Two tangent lines
  open to the zoom below.
- **Zoom (x 20 to 460, y 160 to 320): a kidney tubule wall in section.**
  - Top: the tubule lumen as a pale yellow band labelled "urine side".
  - Middle: a row of 3 cuboidal tubule cells with nuclei.
  - Bottom: the vessel primitive labelled "blood".
- **Animation:**
  - Aldosterone glyphs enter a cell from the blood side.
  - Sodium (green circles, labelled "Na⁺ sodium kept") moves lumen → cell → blood.
  - Potassium (purple squares, "K⁺ potassium passed out") moves blood → cell → lumen.
  - Both run along fixed, non-crossing lanes.
  - Optional: small protein channel shapes on the cell's lumen face (one for Na⁺, one for K⁺) and a pump on
    the blood face, drawn as rounded protein blobs. Unlabelled unless the caption grows.
- **Note:** keep the renin note at the bottom, one line if it fits ("set mainly by the kidney's renin system,
  not the brain"). Otherwise keep two.
- **Parts:** `aldo` (gland, arrow, glyphs), `sodium` (Na⁺ marks and label), `potassium` (K⁺ marks and label).

---

## Steps 6 to 17 and both tabs: the shared `axis()` picture

### Current grades

- step 6, pituitary (loop): **3**
- step 7, hypothalamus (loop): **3**
- step 8, stress (plays once): **4**
- step 9, brake (plays once): **4**
- step 10, lowbrake (plays once): **4**
- step 11, whole (loop): **4**
- step 12, cushing (change): **4**
- step 13, addison (change): **4**
- step 14, secondary (change): **4**
- step 15, glucocorticoid (change): **3**
- step 16, mineralocorticoid (change): **3**
- step 17, inhibitor (change): **3**

**What is already good (keep it):**
- arrow width encodes amount (`widthOf`);
- T-bar brake on both the hypothalamus and the pituitary, with width from `v.E`;
- the right-hand meter column with usual bands and dashed ghost ticks, and blue "↑ high" words;
- numbered stage lines that fade in order;
- the readout under the change steps agrees with the picture;
- the model drives everything.

### Redraw of the anatomy column (x 12 to 300; meters stay at x 320 to 470)

1. **Brain and pituitary (y 8 to 150), replacing the two pill boxes.**
   - **The brain:** a midsagittal crop of the base of the brain, as a soft lilac cerebrum underside curve
     across the top. A darker oval region marks the **hypothalamus** (`data-part="hypothalamus"`), with
     its label in clear space to the right with a leader line.
   - **Small landmarks:** the optic chiasm as a small bump at the front, unlabelled.
   - **The stalk:** the **infundibulum (stalk)** descends about 35 units to the **pituitary**, sitting in
     the **sella turcica**: a bone-coloured (#e8e0cc) saddle cup of the sphenoid drawn under it.
   - **The pituitary:** an anterior lobe (larger, front, pink) and a posterior lobe (smaller, back, lilac),
     both inside `data-part="pituitary"`. Label "pituitary" with a leader.
   - **CRH path:** the CRH arrow becomes the **hypophyseal portal vessel**, a thin red-violet vessel pair
     down the front of the stalk from hypothalamus to anterior lobe. Width = `widthOf(v.crh)`, still built
     by `flow()`, curved to follow the stalk. Dots flow down it. Keep `data-part="crh" data-flow="crh"
     data-w`. Put "CRH" and its change word to the left of the stalk (the brake is further left; reserve
     x 40 to 120).
   - **Accuracy:** CRH acts on the **anterior** lobe; ACTH leaves from the anterior lobe.
2. **ACTH (y 150 to 205).** The blue `flow()` arrow leaves the anterior lobe's lower edge and runs down to
   the adrenal. Put "ACTH" and the change word at x ≥ 176 (clear of the maximum arrowhead half-width of
   about 20).
3. **Adrenal gland on the kidney's upper pole (y 200 to 262).**
   - The step 1 primitive at about 1.0x: a pyramidal gland with a capsule, a golden cortex wrapping all
     round, and a red-brown medulla fully enclosed.
   - Underneath, the top 20 units of the kidney's upper pole, cropped by the vessel.
   - `data-part="adrenal cortex"` on the cortex band only.
   - **The cortisol and aldosterone arrows must start at the cortex band** (left and right flanks of the
     gland, for example x 112 and x 188), never under the medulla.
   - Labels sit outside the arrowheads: cortisol `end` at x ≤ 88, aldosterone `start` at x ≥ 212, or
     stacked above the vessel with leaders.
4. **Blood (y 296 to 330):** the vessel primitive across the full width (x 12 to 468), with a wall,
   a lumen and drifting red cells.
   - **Cortisol:** body cortisol as amber ring glyphs, count from `v.cortisol` (keep the `n` formula),
     **spread over the whole length** and drifting with `t` (or with `flowT` in loop steps).
   - **Drug:** glucocorticoid drug as hollow amber ring glyphs (keep `nd` from `exoG`), on their own lane so
     they never sit on body glyphs.
   - **Aldosterone:** a few green glyphs, count from `v.ald`.
5. **The tablet:** outside the vessel, at about x 20 to 60, y 340. An arrow labelled "taken by mouth" (xs),
   or simply an arrow, enters the vessel. Keep `data-part="tablet"`.
6. **The brake (left edge, x 30):**
   - **The line:** it rises from the vessel's top wall and ends in T-bars on the hypothalamus region and on
     the anterior lobe. Keep the width from `v.E` and `data-flow="brake"`.
   - **The badge:** add a small "−" badge (a white circle with an amber minus) at each T-bar, the standard
     inhibition notation.
   - **Labels:** "brake" and the brake word stay at x 48, y 160 to 190. Re-check them against the new
     stalk position.
   - **Ghost:** a single thin dashed grey line offset 6 units to the left at normal width. Not two lines
     inside the live one.
7. **Marks:**
   - **tumor (Cushing's disease):** a rounded adenoma inside the anterior lobe that swells with `k`. It is
     slightly darker pink with a red outline, and the lobe and sella floor bulge a little to hold it. It
     never covers the label. "tumor: extra ACTH" sits at x 222 with a leader, below "blood tests"'
     baseline. Accuracy: Cushing's disease is usually a small (micro) adenoma, so cap the radius so it
     stays inside an enlarged lobe.
   - **pitfail (secondary):** hatch the anterior lobe in grey, with 2 small red crosses **inside the lobe**,
     clear of the label and the T-bar.
   - **damage (Addison's):** the cortex band thins (scale its thickness by `1 - .5*dmg`) and pales, with
     red crosses inside the cortex band only. The medulla is untouched. Atrophic adrenals are accurate for
     autoimmune adrenalitis.
   - **block (inhibitor):** two block signs on the cortex band's flanks where the cortisol arrow leaves, not
     over the medulla. "blocked" with a leader.
   - **stress:** keep the bolt, placed beside the hypothalamus label, not over the brain.
   - **Optional, only if the caption is extended:** in Cushing's disease the cortex thickens (ACTH-driven
     hyperplasia), and after long glucocorticoid use it thins. Both are true, but neither is in the
     caption, so leave them out unless the text says so.
8. **Ghost for the change steps:** draw the normal arrows **behind** the live arrows as a grey fill
   (#8a8f84 at 30%) with a dashed edge, so a thinner live arrow sits inside a visible grey "normal" shape
   and a thicker one covers it. No dashed outline on top of the live shaft.
9. **Meters (x 320 to 470):** keep the design.
   - **Layout:** name above the bar at left, word above the bar at right. The word is measured with
     `getComputedTextLength` once at mount, or set from a fixed width table. If it collides, drop the
     word to a second line under the bar (y + 22).
   - **Saturation:** widen `SIGNAL_SPAN` to `ln 8`, or add a "far high" end cap with "⇈", so step 17's
     "higher still" moves the bar visibly. Set `acthWord`'s threshold to whatever makes "↑ more" appear
     when the readout says "higher".
10. **Layout per step:**
    - **Step 6:** hide the brain but shift the whole column up, or show the brain greyed (opacity .25,
      unlabelled) so the pituitary has context and the top is not empty.
    - **Steps 6, 7, 9, 10:** use the freed bottom (y 340 to 410) for the stage lines, or end the picture
      at y 340 (`h` per step).
    - **Step 8:** add the `'body'` meters back (blood sugar only), or change line 3. The model already
      computes glucose.
11. **Step 16:** the `cortexCause` alpha should be 1 when the cortex was already destroyed at t=0 (pass
    `[c.cortexCause, 1]` when `from` already carries `damage: 1`).
12. **Step 11 (whole):** keep the blue solid box around ACTH and cortisol and the dashed box around blood
    sugar and potassium. Give them 6-unit radius corners and 8-unit padding so the box does not touch the
    meter labels, as it does now on the right edge.

### Per-step notes for the axis steps

- **6 pituitary:** problems are the empty top quarter and the pill boxes. Redraw as above; the loop moves
  ACTH dots and blood glyphs.
- **7 hypothalamus:** the brain appears; the CRH portal flow is visible.
- **8 stress:** fine sequencing. Problems are that blood sugar is claimed but not shown, the arrowheads
  touch the labels, and the CRH ghost hatching.
- **9 and 10 brake / lowbrake:** sequencing is good. In the redraw, pulse the brake T-bar badges at stage
  2, a 0.2 s glow, so "the brake tightens / eases" is located.
- **11 whole:** good summary. Fix the box padding and the static blood.
- **12 cushing:** the tumor covers the label, "tumor: extra ACTH" crowds "blood tests", and the arrowhead
  touches "ACTH ↑ more".
- **13 addison:** the meter word collides mid-morph. The faded cortex works; redraw it as a thinning band.
- **14 secondary:** the crosses sit on the label and the T-bar.
- **15 glucocorticoid:** the tablet is in the blood, and the drug diamonds overlap the cortisol dots.
- **16 mineralocorticoid:** the tablet is in the blood, and the "destroyed" fade is wrong. Add a tiny
  kidney icon beside the potassium meter with a green glyph arrow, to say where the tablet acts.
- **17 inhibitor:** ACTH is saturated, and the block icons sit on the medulla. The ghost is normal while
  the comparison is untreated Cushing's: draw the ghost from `start` (Cushing's) instead of NV for steps
  16 and 17, so the dashed marks agree with the readout header.

---

## Reusable primitives this lesson needs

- **Steroid ring glyph:** three hexagons and a pentagon. Variants are filled amber (cortisol), hollow amber
  (glucocorticoid drug), green (aldosterone), and muted with a tail (cholesterol).
- **Adrenal gland on the kidney's upper pole:** right is pyramidal and left is crescent. A cut-face variant
  has a capsule, a cortex band fully wrapping a medulla, optional unlabelled three-zone banding, and
  thinning and hyperplasia parameters.
- **Kidney:** bean with a medial hilum, mirrorable, with capsule rim and gradient; a cropped upper-pole
  variant.
- **Midsagittal brain base:** hypothalamus region, optic chiasm bump, infundibulum, pituitary (anterior and
  posterior lobes) in the sella turcica, and hypophyseal portal vessels as a flow path.
- **Blood vessel segment:** wall, endothelium line, lumen gradient, drifting biconcave red cells, and lanes
  for molecule glyphs.
- **Biconcave red blood cell.**
- **Tablet / capsule:** with a "taken by mouth" entry arrow.
- **Liver:** anterior silhouette, right and left lobes, falciform notch.
- **Skeletal muscle bundle:** fusiform, striated.
- **Inflamed tissue cross-section:** epidermis, dermis, capillary, white blood cells with lobed nuclei,
  edema dots, red glow, and a bump height parameter.
- **Kidney tubule wall cross-section:** lumen, cuboidal cells, capillary, Na⁺ and K⁺ lanes, and optional
  channel and pump protein blobs.
- **Polygonal steroid-making cell:** bilayer membrane band, nucleus, lipid droplets, mitochondria with
  cristae.
- **Inhibition T-bar** with a minus badge, and width from the model.
- **Level meter:** usual band, ghost tick, measured change word, far-end cap.
- **Pituitary adenoma blob** (grows with k) and **lobe hatch** for failure.
- **Zoom callout:** circle plus tangent lines.
- **Trunk silhouette** with spine (step 1).
- **Glucose hexagon** and **amino-acid bead.**

## Risks for whoever redraws

- **Model-driven geometry must survive:**
  - `widthOf(v.crh / v.acth / v.release ?? v.cortisol / v.ald)` for the arrow widths;
  - the brake width `2 + 3*v.E`;
  - blood glyph counts from `v.cortisol` and `v.p.exoG`;
  - meter positions from `log(rel)/span` and `bandOf()`;
  - glucose in step 3 and `inf`/`fs` in step 4;
  - `feedback()` and `stressPicture()` staging, which set E, lagE, the burst and the `release` override.
  The redraw changes shapes, not these numbers.
- **Hooks in the SVG to keep:**
  - `data-level` and `data-rel` on the meter markers;
  - `data-flow` and `data-w` on the crh, acth, cortisol, aldo and brake flows;
  - `data-ghost="normal"` and `class="ghost"` on the ghosts;
  - `role="img"` and the aria-label from `svg()`.
  Grep any test or audit script for these before renaming. lab-walk measures text overlap and the
  minimum font size at t=1, at 1280 and 375 widths, and requires 480 wide by at most 424 tall.
- **data-part names the captions use:** adrenal, cortex, medulla, cortisol, cholesterol, sugar, flame,
  aldo, sodium, potassium, pituitary, acth, hypothalamus, crh, the triple `hypothalamus pituitary
  adrenal`, stress, brake, tests, effects, tumor, damage, tablet, block.
  - **Matching:** the kit matches whitespace tokens, so `data-part="adrenal cortex"` lights for both
    "adrenal" and "cortex".
  - **Existing group names:** "effects sugar", "effects potassium" and "cortex adrenal".
  - **Rules:** keep every token reachable. Do not put "adrenal" on anything in step 1 that "adrenal" should
    not light.
- **`axis()` is shared** by steps 6 to 17, the Clinical values picture (`updateClinical`, with marks from
  `MARKS_OF`) and Explore freely (`updateExplore`). One regression breaks 14 views. Check both tabs at 375
  wide after the redraw.
- **aria-labels and `WHERE[]` describe the current drawing** ("pink bar", "amber diamonds", "red block
  signs", "lightning bolt", "pill", "half-dome"). Rewrite them alongside the redraw, or they will describe
  shapes that no longer exist.
- **Label space:** the anatomy column is only about 290 wide. The brain, stalk, gland, labels, change
  words and the brake must all fit without overlap at 17 units (12 px on a phone). Reserve fixed lanes:
  brake x 20 to 40, brake words x 44 to 120, stalk and arrows x 130 to 190, right-side labels x 196 to
  300.
- **Accuracy traps:**
  - Do not draw cortisol or aldosterone leaving the medulla.
  - CRH goes by portal vessels to the **anterior** pituitary.
  - Kidney hila face medially, and the right kidney sits lower.
  - The right adrenal is pyramidal and the left crescentic.
  - A tablet does not float in the blood.
  - Aldosterone stays near-normal in secondary insufficiency (do not route the ACTH arrow visibly into
    aldosterone output).
  - Metyrapone is not to be labelled with an enzyme unless the caption says so.
  - The adrenal cortex is yellow (lipid), not orange-tan, if anyone "fixes" the colour.
  - Do not add zone names, enzymes, MR receptors or channel names as labels unless the caption is
    extended; drawing them unlabelled is fine.
- **Ghost semantics:** the change steps currently ghost "normal" even when the readout compares with
  untreated disease (steps 16 and 17). If the ghost is changed to `start`, update the aria-label sentence
  "drawn over dashed marks for normal" to match.
- **Not audited here:** the Explore freely "Stopping a long-term glucocorticoid" chart and the Clinical
  values gauges (not captured by lab-shoot).
