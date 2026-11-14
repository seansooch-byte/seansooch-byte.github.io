# Redraw brief: arachidonic-acid-nsaids (Lesson 18, 15 steps)

Audited 2026-11-13 from lab-shoot captures at t=0.35 and t=1 (shots in `scratchpad/audit/shots/arachidonic-acid-nsaids/`), plus `app.js`, `model.js`, `index.html`, `style.css`.

## Where it stands

- **Overall grade: 4/10.** The teaching works: one pathway diagram builds up row by row, and the five drug steps morph over dashed ghosts, name each change in words, and drive meters from `model.js`. As art it is clip-art. The membrane is lollipops on sticks, the cell is a beige egg, PLA2 is a pair of office scissors, the enzymes are empty white rectangles, arachidonic acid is a zigzag, the steroid is two hexagons, the leukotriene blocker is a black bar, and every row ends in a word plus a half-filled box.
- **What is missing against Osmosis, Ninja Nerd or BioRender:**
  - Proteins that look like proteins: COX as a membrane-docked enzyme with a channel the drugs sit in, and PLA2 as an enzyme.
  - A recognisable arachidonic acid: a kinked C20 hairpin.
  - Targets drawn as anatomy: stomach lining, platelet, inflamed tissue, bronchiole.
  - A disciplined palette. Blue now means leukotrienes, framing, change words and the "taught thing" all at once. Amber means both arachidonic acid and the COX-2 prostaglandins.

**Keep the architecture.** Membrane on top, a trunk down the left, enzymes, one row per product, an effect on the right. This is the standard eicosanoid schematic (First Aid, Osmosis, Lecturio all use it). The redraw lifts every glyph inside it. It does not replace the layout.

## Global rules for the redraw

1. **Palette (FORMAT colours only, plus tints of them).**
   - Arachidonic acid: a lipid gold, `#c98a3a` (the existing `CELLEDGE`) with a light tint, so it is no longer the same amber as the COX-2 row.
   - COX-1 stomach prostaglandins: green `#2c6a2c`.
   - Thromboxane: red `#b3261e`.
   - COX-2 inflammatory prostaglandins: amber `#a34700`.
   - Leukotrienes: **purple `#6b3fa0`** (moved off blue).
   - Blue `#254dff` is reserved for change words, change arrows and the key-measure frames.
   - Drugs: ink plugs, a blue COX-2-selective plug (it is "the thing taught" in step 12), and a red acetyl tag.
   - Steroid: green.
2. **Shading.**
   - Proteins: soft radial gradients (`<radialGradient>` defined once in a `<defs>` per SVG), a 1.6-unit ink outline at 70% opacity, and one highlight crescent.
   - Membranes: a pale gradient band, with heads in two tones (phosphate darker, glycerol lighter).
   - No drop shadows over text.
3. **Line weights.**
   - Structure outlines: 2.
   - Detail: 1.2.
   - Flows follow the model (`flowWidth`).
   - Leader lines: 1.2 muted, ending in a 2.5-radius dot on the structure.
4. **Type.** Kit classes only, nothing under `.xs` (17). Enzyme names go *inside* protein bodies only where the body is at least 20 units wider than the text. Otherwise label beside them with a leader. "lipoxygenase" now touches its box edges, so either widen the body or use "5-LOX" with the full name in the caption. The caption already says lipoxygenase, so the short form "5-lipoxygenase" is accurate and allowed.
5. **The right-hand column becomes "target icon + gauge".** Each row ends in a 34x34 icon of the tissue it acts on, then the effect words, then the meter. The meter keeps `data-meter`, `data-level` and its geometry rule `meterFrac`. Restyle it as a rounded vertical gauge with a light track, a gradient fill, and a small tick for normal: half full, because 1 = the untreated injury.
6. **Change steps.**
   - Ghosts stay dashed grey (`#8a8f84`).
   - Draw ghosts *above* the live flow when the flow is wider. In the NSAID, COX-2-selective and aspirin steps the thicker leukotriene flow currently hides its own ghost.
   - The ghost line on each meter must stop 4 units clear of the effect text. Today it starts at x=441 and touches "platelet clumping".

## Per step

### Step 1, membrane (still), grade 4
**Problems**
- The cell is a featureless beige ellipse: no nucleus, no cytoplasm, no depth. Neighbour cells are clipped ellipse arcs.
- The phospholipids are lollipops with two straight sticks. The two leaflets' tails do not meet, which leaves a visible gap in the bilayer core.
- The "zoom" is two dashed lines into a tiny dashed circle, which does not read as magnification.
- The picked-out phospholipid is a solid blue disc sitting on top of a blue ring (the halo overlaps the head).

**Redraw**
- **Cell (bottom half).** A tissue strip of three polygonal epithelial-type cells sharing walls. The centre one is `data-part="membrane"` with `data-cell`. Give it a cytoplasm gradient (cream to warm tint at the edge), a purple-grey nucleus with a nucleolus, and a membrane drawn as a double line (two 1.5 strokes, 3 units apart), so even at cell scale it reads as a bilayer.
- **Zoom.** A circular loupe (r about 26) on the centre cell's top membrane, joined by two solid muted tangent lines to the magnified panel above.
- **Magnified bilayer (top panel, y 16 to 120).**
  - 14 to 16 phospholipids per leaflet with tails touching at the midline.
  - Heads: a two-tone sphere (phosphate-choline darker gold above a lighter glycerol neck).
  - Tails: two wavy chains. One is straight (saturated). One has a kink (unsaturated), because arachidonic acid is the kinked sn-2 tail.
  - A watery tint above and below (extracellular and cytoplasm, labelled "outside" and "inside" in `.xs muted`) so the bilayer has context.
- **Highlighted phospholipid** (`data-part="lipid"`): drawn in blue with a soft glow behind it, not a ring on top. Use leader-line labels "head" and "two tails" on it. Keep the right-aligned caption block "one phospholipid: a head and two tails".
- Height 350, unchanged.

### Step 2, injury (moving, 5.2 s), grade 3
**Problems**
- "Injured tissue" is one giant egg-shaped cell with a pink dashed halo. It is neither tissue nor injury.
- The lightning bolt is a cartoon.
- The "first signals" are faint zigzags.
- The four cardinal signs are a row of red words with no anchor in the picture.
- The bottom third of the frame is empty.

**Redraw: a tissue cross-section, Osmosis-style.**
- Skin surface along the top: an epidermis band of small cells. A wedge-shaped cut or bruise at the right is the injury. Keep `data-injury` on it, and keep a small red "injury" label.
- Below it, dermis with:
  - One capillary drawn as a vessel with a wall: endothelial line, lumen, biconcave red cells.
  - One free nerve ending: an ink axon branching into fine endings.
  - The injured cells next to the cut (`data-part="membrane"`, `data-cell` on the central injured cell).
- **Motion with t.**
  - The capillary widens (lumen 10 to 18).
  - A red-pink warmth gradient blooms around the wound.
  - Clear fluid dots leave the vessel into the tissue, and the tissue edge bulges.
  - The nerve endings flash amber.
  - Small gold arachidonic-acid hairpins (see primitives) leave the injured cell membranes: "first signals: made from the membrane".
- **The four signs** (`data-part="signs"`) appear one by one as leader-line labels on what produces them:
  - "red" on the dilated vessel,
  - "warm" on the glow,
  - "swollen" on the bulge,
  - "painful" on the nerve ending.
- Keep the order and timing windows (0.5, 0.6, 0.7, 0.8).
- Height 330.

### Step 3, scissors (moving), grade 4
**Problems**
- **Label collision:** the falling arachidonic-acid chains run through "phospholipase A2" at both t=0.35 and t=1, and at t=0.35 the scissors sit under the label.
- The bolt overlaps the top row of heads.
- The scissors are office scissors.
- Freed arachidonic acid is identical zigzags.
- The cut leaves a phospholipid with one stick, but no lysophospholipid is named or drawn. That is acceptable, but the cut point is unclear.

**Redraw**
- Use the same bilayer primitive as step 1, in a horizontal strip y 30 to 116, with the cytoplasmic face down.
- **PLA2** (`data-part="scissors"`, keep `data-scissors` on the group): a globular enzyme (rounded bean, gold-grey gradient) docked on the inner leaflet's surface. Give it a small pocket that grips the kinked sn-2 tail. Optionally add a tiny scissors badge (12 units) on its back so the caption's metaphor still lands.
- Each pass cuts the kinked tail. The tail detaches and curls into an arachidonic-acid hairpin that drifts down and left into a loose pool, reaching about y 200 to 250.
- The remaining lysophospholipid keeps its one straight tail.
- **Labels.** "phospholipase A2" sits on a fixed leader to the enzyme, placed *above* the membrane at the left (y about 18), so falling acid never crosses it. "arachidonic acid, freed" sits under the pool. "injury switches it on" moves to the top left and clears the membrane, or becomes a small red Ca2+ / injury badge beside the enzyme. Do not stack it on the membrane.
- Keep `data-part="aa"` on the freed molecules.

### Steps 4 to 7, 9, 10: the pathway build (flowing loops), grade 5 each
These six steps share `pathway()`. Fix it once.

**Problems common to all**
- Enzymes are empty white rectangles: COX-1 is 114x96 with nothing in it, and the label sits off-centre (x=78 against a centre of 91) to leave room for a plug that is not there yet.
- "lipoxygenase" fills its box to the stroke.
- The trunk's arrowheads hide under the box edges, and the falling zigzags overlap the box's left edge (chain x 6 to 34 against a box at x=34).
- The membrane strip is generic lollipops, and the "snipped" tails are barely visible.
- The rows' targets are words. "stomach shield" is not drawn as a stomach, and "platelet clumping" not as a platelet.
- Colour clashes (see global rule 1).
- In step 10 the blue key frames run to x=476 and compete with the blue leukotriene row.

**Redraw of `pathway()`**
- **Membrane** (y 4 to 60): the bilayer primitive, compact. Keep the tails that lose their sn-2 chain near PLA2, driven by `release` as now.
- **PLA2:** the enzyme primitive docked under the membrane at the left (`data-part="scissors"`, `data-scissors`), opacity from `release` as now. Label it to the right.
- **Arachidonic acid:** 1 to 3 gold hairpins under PLA2 (count from `release`). The trunk becomes a gold *lipid stream*: a rounded tube with a lighter core and hairpins riding it (count from `release`). Its width keeps `2.5 + 4*release`. The branches into each enzyme end in a fixed-size head that stops 4 units before the protein outline.
- **Enzymes:** draw them as proteins, not boxes.
  - COX-1 and COX-2: rounded dimer shapes (two lobes), each with a visible hydrophobic channel, a darker slot entering from the left where the acid goes in.
  - COX-2's channel has a small **side pocket**. This is accurate: the Val523 side pocket is why bulky COX-2-selective drugs fit COX-2 only. It sets up step 12.
  - COX-2 body width still follows `cox2Made`, keep `data-enzyme="cox2"` and `data-w`, and keep the ghost outline when the width changes.
  - 5-lipoxygenase: a single-lobe protein in a different tint, labelled with room to spare.
  - Labels sit centred inside the bodies. The plug, tag and pocket go *into the channel*, not in a corner.
  - Step 4's single "COX" uses the same dimer shape, tall, with "cyclooxygenase" as a sub-label.
- **Rows:**
  - Product flows keep their model-driven width, `data-flow` and `data-w`.
  - Moving particles become tiny product glyphs in the row colour instead of white circles: a hairpin closed into a ring with two side chains for prostaglandins (a five-membered-ring glyph), a six-ring glyph for thromboxane, and a linear chain glyph for leukotrienes.
  - Product labels stay above the arrows.
- **Target icons**, 34x34, between the arrowhead and the words:
  - stomach shield: a slice of gastric lining (columnar cells with a green mucus/bicarbonate layer on top), `data-part="shield"`;
  - platelet clumping: two or three activated platelets with pseudopods touching, `data-part="clot"`;
  - pain, swelling and fever: a small swollen tissue bump with a thermometer, `data-part="inflam"`;
  - airway squeeze: a bronchiole cross-section (cartilage C-ring, smooth-muscle band, narrowed lumen), `data-part="airway"`.
  The effect words move right of the icon, two lines max. The meter stays at x 446, restyled per global rule 5.
- **Step 10 key frames:** rounded rects inset to x ≤ 470, 2.5 stroke, blue at 0.9 opacity. Possible now that leukotrienes are purple.
- **Step 7 (COX-2 grows):** keep the model-driven growth. Add a few small white-cell or macrophage outlines fading in beside COX-2 to show "injured tissue and the white cells it calls in make more". Keep the blue words at the top right.

### Step 8, effects (moving), grade 4
**Problems**
- The vessel is a pink rectangle between two red lines, with no wall and no blood cells. "Leak" is three red dots dropping out.
- The nerve is a Y of ink lines.
- The fever thermometer is fine but generic, and nothing says "brain".
- The prostaglandin rings are floating circles.

**Redraw: three panels on one tissue background, sharing a soft amber prostaglandin haze that rains from the top.**
1. **Vessel** (`data-part="vessel"`), a longitudinal capillary or venule:
   - The wall is a row of flattened endothelial cells, with lens-shaped nuclei, along both edges.
   - The lumen holds biconcave red cells.
   - As k rises: the lumen widens 16 to 30 (keep the lerp), small gaps open between endothelial cells, and pale plasma droplets (not red cells) seep out into the surrounding tissue. Plasma, not cells, matches oedema; the caption says the vessels "help them leak".
   - A red-warm glow tints the surroundings.
2. **Nerve** (`data-part="nerve"`): a free nerve ending, an axon with a short myelin sheath segment, branching into 3 bare terminals.
   - Prostaglandin glyphs bind small receptor dots on the terminals.
   - Action-potential sparks travel *up* the axon more often as k rises (driven by t). This replaces the flashing bolts at the tips.
3. **Fever** (`data-part="fever"`): a sagittal brain silhouette (cerebrum, cerebellum, brainstem) with the hypothalamus picked out as a small amber spot, and a "set point" dial or thermometer beside it.
   - The fill keeps `lerp(0.35, 0.8, k)`.
   - Say "thermostat (hypothalamus) up: fever". Accurate: PGE2 acts on the preoptic hypothalamus.
4. Keep the three two-line labels under each panel. They read well now.

Height 296. Drop the panel-top floating rings in favour of the shared haze.

### Steps 11 to 15: what changes it (drug morphs, 6.4 s, loopFrom 0.5), grades 6, 6, 5, 5, 5
The *teaching* here is the best in the lesson:
- ghost flows and ghost meter lines;
- per-row words computed by `rowWord` from the model;
- the drug named at the top right.

The pictures inherit every pathway problem, plus these drug glyphs.

- **Step 11, NSAID** (`data-plug="nsaid"`, `data-part="plug"`).
  - *Now:* a dark rounded rectangle in each box's corner.
  - *Redraw:* a small ink-grey drug molecule (a rounded wedge with an aromatic-ring hint) lodged **inside the channel** of both COX-1 and COX-2. Opacity from `p.nsaid` as now.
  - The "↓" words stay.
  - Fix the hidden leukotriene ghost (draw the ghost on top).
  - Small text near the plug: "reversible" in `.xs muted`, only if it fits clear of the flows.
- **Step 12, COX-2 selective** (`data-plug="cox2i"`).
  - *Now:* a blue rectangle in the COX-2 box.
  - *Redraw:* a **bulkier** blue drug glyph that fills COX-2's channel *and side pocket*. Beside COX-1, a faint dashed outline of the same glyph shows it would not fit COX-1's narrower channel (no side pocket).
  - Keep "COX-2 selective: only COX-2 plugged".
  - Optional and only if it fits: a faint note about the vessel-lining prostacyclin trade-off. The caption already carries it; do not invent a row.
- **Step 13, aspirin** (`data-tag`, `data-part="tag"`).
  - *Now:* a red arrow-tag pasted on the box.
  - *Redraw:* a small red "acetyl" flag (a short stalk with a CH3-C=O cap, labelled "acetyl" once) **covalently attached to the channel wall** (a serine in the channel). It is drawn joined to the protein outline, not floating. That is the visual difference from the NSAID plug: bonded, not lodged.
  - COX-1's channel is fully capped. COX-2's flag is a little smaller, matching `0.7*p.aspirin`.
  - Add one platelet icon in the clot row with a small "no nucleus: can't rebuild" note. This is accurate and it is the caption's point.
- **Step 14, glucocorticoid** (`data-steroid`).
  - *Now:* two hexagons, which is not a steroid. They collide with the COX-2 ghost outline and the prostaglandin arrow tail, and touch the top-right words.
  - *Redraw:* the real steroid nucleus, a **6-6-6-5 fused ring** (three hexagons and one pentagon, the cholesterol/cortisol skeleton), in green at about 34x20. Two placements:
    1. Beside PLA2, joined by a short green arrow to a small **annexin A1** protein (a green globule) sitting on PLA2, with PLA2's opacity falling as now. Caption: "annexin A1".
    2. Beside COX-2, with a small "fewer COX-2 made" note, *outside* the COX-2 ghost outline and clear of the row arrow. Do not place it at x = BOX_X+BOX_W−18, which lands on the ghost.
  - The top-right words must start right of x 300 so they clear the ring beside PLA2. Reflow to three lines if needed.
  - The dfn `data-part="scissors"` is used twice in the caption, for "Glucocorticoids" and "annexin A1". Either keep annexin inside the scissors part, or add a `steroid` part and change the dfn (an index.html edit, allowed in the build phase).
- **Step 15, leukotriene modifier** (`data-plug="ltm"`, `data-part="ltm"`).
  - *Now:* a black bar at the arrow tip, touching the "eases a lot" text.
  - *Redraw:* at the airway icon, draw the **CysLT1 receptor** as a small 7-transmembrane-ish protein glyph on a smooth-muscle cell strip. A purple montelukast glyph sits in it, and the leukotriene particles bounce off.
  - The bronchiole icon's lumen widens with `airway`, which is model-driven. That is the "what moved" in the picture as well as in words.
  - Keep 6 units between the receptor glyph and any text.
  - The caption also mentions zileuton-style 5-LOX block. Do not draw it: the model does not simulate it.

## Graphs and charts
There are no conventional graphs. The **meters** are the only quantitative marks:
- they are model-true;
- their ghost line works;
- they read on a phone.

What would lift them:
- a rounded gauge with a light track and a gradient fill;
- a short solid "normal" tick (in place of the dashed line running to the frame edge);
- the ghost line clipped to the gauge width plus 4;
- consistent 28x48 sizing.

Outside the lesson picture, the Clinical values tab's gauge bars (`.gauge`, 400x62) are already clean: a band, a marker and a dashed comparison marker. Leave them.

## Reusable primitives (for a shared library)
- Phospholipid bilayer strip: two-tone heads, saturated plus kinked tails, leaflets meeting, optional highlight and per-lipid "sn-2 tail removed" state.
- Tissue-cell sheet: polygonal cells with a nucleus and a double-line membrane, plus a magnifier loupe callout.
- Arachidonic acid hairpin glyph (C20, 4 cis kinks, COOH end), small and medium.
- Eicosanoid product glyphs: prostaglandin (cyclopentane ring with two chains), thromboxane (six-ring with an oxygen), leukotriene (linear conjugated chain).
- Globular enzyme body with gradient and highlight; membrane-docked variant (PLA2).
- COX homodimer with substrate channel and optional side pocket (COX-2), with sockets for "plug in channel" and "acetyl flag on wall".
- Drug glyphs: reversible plug, bulky selective plug, covalent acetyl flag, receptor antagonist.
- Steroid nucleus 6-6-6-5.
- Annexin A1 small protein.
- GPCR / 7TM receptor on a smooth-muscle strip.
- Bronchiole cross-section (cartilage ring, smooth-muscle band, lumen radius driven by t).
- Gastric lining slice with mucus/bicarbonate layer (shared with gastric-acid-secretion).
- Platelets, resting and activated with pseudopods (shared with coagulation-cascade).
- Capillary with endothelial wall, biconcave RBCs, widening lumen and leak gaps.
- Free nerve ending / nociceptor with firing sparks.
- Sagittal brain silhouette with hypothalamus highlight, plus a set-point thermometer.
- Skin and dermis cross-section with a wound.
- Gauge meter (track, gradient fill, normal tick, ghost line).
- Flow arrow with model-driven width and a fixed head (exists: `flow` / `flowGhost`).

## Risks: what a redraw can break
- **Model-driven geometry must survive:**
  - `flowWidth(rowFlow(v,k))` for every row;
  - `meterFrac(rowLevel(v,k))`;
  - the COX-2 width from `cox2Made`;
  - the trunk width and hairpin count from `release`;
  - the snipped-tail count from `release`;
  - PLA2 opacity from `release`;
  - each drug glyph's opacity from `p.<drug>`.
  The words (`rowWord`, `NAMED`) and the readout (`readoutOf`) are computed from the same model and must still agree with the picture.
- **Hooks to keep** (no external test reads them today, but they are the lesson's own contract and some may be read by future checks): `data-meter` + `data-level`, `data-flow` + `data-w`, `data-enzyme="cox1|cox2"` + `data-w`, `data-ghost-flow`, `data-ghost-meter`, `data-ghost-enzyme`, `data-plug="nsaid|cox2i|ltm"`, `data-tag`, `data-steroid`, `data-scissors`, `data-injury`, `data-cell`, `data-trunk`, `data-key-measure`. lab-check requires at least 3 `<dfn data-part>`. The kit player relies on `{duration, loop, loopFrom}`, and `change()` uses HOLD/DONE/LOOP timing.
- **data-part names used by the dfn tags must remain on the right structures:** membrane, lipid, signs, scissors (also used for glucocorticoid and annexin), aa, cox, cox1, cox2, pgA, tx, pgC, nerve, fever, lt, airway, inflam, plug (NSAID and COX-2 selective steps), tag, ltm, shield, clot. Without a dfn: lox, vessel.
- **Shared renderer.** `pathway()` is also used by `tabPicture()` for the **Clinical values** and **Explore freely** tabs, at any drug combination and injury 0 to 2. Glyphs must not collide when several drugs are on at once: NSAID plug, COX-2-selective plug and acetyl flag in the same channel, and steroid rings. Test Explore with every box ticked and injury at 2 and at 0.
- **The aria-labels and `CHANGE_WHERE` strings describe the current glyphs** ("Dark plugs sit in both...", "Red tags...", "Green steroid rings...", "A dark bar blocks..."). Rewrite them to match the new drawing. The same goes for scene labels in `scenes` (scissors, egg-shaped cell, lightning bolt).
- **Label overlap traps found now:**
  - step 3 label under the falling acid;
  - "lipoxygenase" text against its stroke;
  - the ghost meter line against "platelet clumping";
  - the steroid rings against the COX-2 ghost, the prostaglandin arrow and the top-right words;
  - the LTM bar against "eases a lot";
  - key frames at x=476.
  Re-measure at 375x553 after the redraw. Effect words plus an icon plus a meter in the 160 units right of x≈290 is tight. The icon may need to replace the first word line, or the words go to `.xs` on two lines.
- **Accuracy traps:**
  - Draw the steroid as 6-6-6-5, never as two hexagons.
  - Aspirin is a covalent acetylation of a channel serine, irreversible. NSAIDs are reversible plugs. Do not draw them the same.
  - The COX-2 side pocket is the real basis of selectivity. Do not invent a different mechanism.
  - The vessel leak is plasma/fluid, not red cells.
  - Fever acts on the hypothalamus.
  - Leukotriene receptor antagonists act on CysLT1 at airway smooth muscle; leukotrienes are still made (the model says "about the same").
  - Leave out prostacyclin (named in the caption, not modelled) and zileuton (named, not modelled). Drawing them would invent model states.
  - The "stays" under glucocorticoid for platelet clumping is a model statement. Do not draw a platelet change there.
