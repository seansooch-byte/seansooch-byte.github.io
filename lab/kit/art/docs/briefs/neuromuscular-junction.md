# Redraw brief: neuromuscular-junction (Lesson 8)

Audited 2026-11-12 from captures at t=0.35 and t=1 (tools/lab-shoot.mjs), lab/neuromuscular-junction/index.html, app.js, style.css and lab/FORMAT.md "Pictures".
Overall grade: **4 / 10.** The graphs (steps 7, 8, 11) are clean and already close to the bar. The anatomy is not: the spinal cord is a pill, the muscle is a lens, fibres are sausages, the nerve ending is a white tub with a chimney, receptors are two pale bars, cholinesterase is a pac-man. Nothing has membranes, depth or texture. The four "What changes it" steps reuse a busy three-row chart whose top row (the gates) is small and has overlapping glyphs.

## What a redraw must keep (do not break)

- **Scenes and timing.** `scenes` keys: motor, junctions, gap, packets, release, receptors, voltage, margin, fire, enzyme, burst, whole, ndmb, sux, che, mg. Keep each scene's kind: animated `{duration, loop, rest, render(t)}` for motor, junctions, release, receptors, fire, enzyme (4400 ms loop, rest .55); voltage and margin play once (2800 ms); burst plays once (4400 ms); `whole` is a still; ndmb, sux and mg run 3200 ms and che runs 4000 ms (two stages, the blocker until t<.5, then the inhibitor).
- **`model()` drives the pictures in steps 11 to 16 and Explore.** The bar heights (`TH * shots[k].S`), twitch heights (`TW * twitch[k]`), the held band (`o.blocked`), gate states from `receptorStates(o)` (counts of 'ach', 'blocked', 'sux', 'missing') and the ACh dot count (`3 * o.A`) must stay computed from the model. Do not hand-place them. `tofArt` is also used by `#explore-visual` with any slider settings, so the redraw has to work for every mix of states, not just the four presets.
- **Hooks.** `tofArt` wraps the picture in `<g data-new-state=... data-ach data-opened data-epp data-safety data-twitch1 data-twitch4 data-fade data-held>`. Keep that element and those attributes exactly. Gates carry `data-gate="missing|empty|ach|sux|blocked"` in the close-up. Ghosts use `class="ghost"`. Consider moving to the kit's `ghost()` helper (`data-ghost="normal"`) without dropping the class.
- **data-part names used by `<dfn>`:** muscle, nerve, cellbody (step 1); fibres, nmj (2); gap, endplate (3); vesicles (4); calcium, ach (5); gates, sodium (6); trace (7, two terms); threshold, margin (8); wave, twitch (9); enzyme (10, 15); twitch (11); drug (13, 14); antibody (16, two terms). Every one must still wrap the drawn structure, not only its label. Note: the step 5 caption term "nerve impulse" has no data-part. Add `data-part="impulse"` to the dfn and the travelling pulse.
- **Frame and type.** 480 wide, at most 420 tall (current heights: 398, 408, 304 x5, 318 x2, 392, 400, about 362 to 406 for the tof charts). Text classes are `.xs` 17, `.sm` 18, default 20 and `.lg` 24, never smaller. `.on-organ` adds a halo stroke (`#f1d6d0`): if the tissue fill changes, update style.css to match or the halo shows as a pink smear.
- **Colour roles (stated in app.js):** green = acetylcholine, amber = sodium, red = calcium and antibodies (and threshold), purple = drugs, blue = end plate voltage, twitches and what a change moved. Keep these roles. The new anatomy palette sits under them in tissue tones.

## Accuracy notes the redraw must get right (and three it currently gets wrong)

1. **Calcium enters at the active zones, not the corners.** Voltage-gated calcium channels sit in the presynaptic membrane facing the cleft, beside the docked vesicles at active zones. Today calcium squares slide in sideways at the terminal's lower corners (x 104 and 376), which is wrong. Redraw: calcium channels in the bottom membrane of the terminal, next to the two fusing vesicles, with calcium entering upward from the cleft.
2. **Active zones face the fold crests.** Release sites line up opposite the crests of the junctional folds, where the receptors cluster. Today the fusing vesicles (x 176 and 306) sit over fold mouths (170, 314). Move the fusing vesicles over crests, between folds.
3. **The myasthenia antibody is upside down.** IgG binds the receptor with the tips of its two Fab arms, so the arms point down onto the receptor and the stem points away. Today the Y has its stem on the receptor. Flip it: arms grasping the receptor's top, Fc stem up into the cleft.
4. Keep the correct detail already present: receptors on the fold **crests** (GATES avoid FOLDS). Add, since the sux caption leans on it, voltage-gated **sodium channels in the fold troughs** and the membrane beside the end plate. This is standard anatomy, not invention.
5. Cholinesterase sits in the basal lamina across the cleft and down into the folds. Drawing it at the fold mouths and in the folds is acceptable and matches the caption ("waiting in the folds").
6. Motor neuron cell bodies are in the **ventral (anterior) horn** of the spinal cord grey matter (or brainstem motor nuclei). The axon leaves through the **ventral root**, is myelinated along its course, and loses myelin at the terminal, where a Schwann cell caps the ending.
7. In step 14, the held level should read as "held depolarized, sodium channels inactivated", not "fails to reach threshold". Today the dashed held line lands on top of the red threshold line and reads as either. See step 14.
8. A twitch rises faster than it relaxes. The single twitch in step 9 is a symmetric sine and should be asymmetric. The small tof bumps can stay symmetric glyphs.

## Shared look (applies to every anatomical step)

- **Tissue palette:** muscle cytoplasm `#f1d0c8` to `#e3aea3` (radial gradient), sarcolemma stroke `#a8584c` 2.5; axon/terminal cytoplasm `#fbf6ec` to `#efe4cf` with ink stroke 2.5; myelin `#f4ecd8` with a `#c9b98f` edge; Schwann cell `#e8dcc0`; cleft/basal lamina `#f7f3ea` at about 0.7. Use `<defs>` gradients with ids namespaced per scene (for example `nmj-mus-g`), because several SVGs share one page.
- **Membranes as bilayers:** the presynaptic bottom membrane and the end plate (including its folds) drawn as a 6-unit bilayer strip (two thin ink lines with pale head beads every 5 units, or two strokes with a light fill between). Elsewhere, a single 2.5 stroke. The bilayer appears only where the step is about the membrane (steps 3 to 6 and 10).
- **Line weights:** structure outlines 2.5; proteins 1.5; leader lines 1.25 in muted `#53584d`, ending in a 2.5-radius dot on the part. Labels sit outside the tissue wherever space allows. Use `on-organ` halos only when a label must sit on tissue.
- **Depth:** one soft highlight per organelle (white at 0.5, offset top-left) and one shadow (multiply ink at 0.08, offset down). No drop shadows on text.

---

## Step 1 · motor · "Muscles move only when a nerve tells them" (grade 3)

**Now:** a pink pill for the cord, a black dot for the nerve cell, a black wire, and a pink lens with two beige stubs for the muscle. The label "a cable of axons" runs into the cord's outline (it starts at x≈100, over the cord edge at 76). The contraction is a slight widening of the lens.

**Problems:** unrecognisable cord (no grey matter, no roots), soma is a dot with no dendrites, nerve has no sheath, muscle has no fascicles, tendons or bone context, and there is a text/line overlap.

**Redraw (h 398):**
- Left (x 20 to 150, y 40 to 210): a **spinal cord cross-section**: an oval of white matter (`#f3ece0`, ink 2.5) with the butterfly **grey matter** (`#d9c9c0`). Ventral horn at the lower right. Inside it, a **motor neuron**: a 14-unit soma (ink fill with a lighter nucleus) with 4 or 5 short tapering dendrites. Its axon leaves through a drawn **ventral root** (two parallel lines) at the cord's lower right. `data-part="cellbody"` on the soma and dendrites. Label "spinal cord" above the cord and "nerve cell" with a leader to the soma, placed left of the cord or above it, never over the outline.
- Middle: the **motor nerve** as a fascicle cable, 14 units wide (outer epineurium `#efe4cf`, ink 2), curving down-right. Inside it, 3 faint axon lines, one highlighted ink (our axon). Optional: 3 myelin segments shown on the highlighted axon. `data-part="nerve"`. Label "motor nerve: a cable of axons" in two lines below the curve at x≈150, y≈300, clear of the cord.
- Right (x 300 to 470): a **skeletal muscle belly** (fusiform, with radial gradient), with visible **fascicle striping** (5 to 6 long curved lines along its axis at 0.25 opacity), white-grey **tendons** at both ends, attaching to short stylised bone ends (`#ece6d6`, ink 2). `data-part="muscle"`. The nerve enters the belly near its middle and splits into 3 branches that end in small dark terminal knobs on the surface.
- **Motion:** keep the blue pulse along the nerve (span .05 to .5). Then contraction: the belly **shortens and fattens** (length −12%, width +18%), the tendons pull in (bones move toward each other a few units), and the striping compresses. Label "the muscle contracts" (xs b blue) fades in with a small blue double arrow showing the shortening.

## Step 2 · junctions · "Each nerve ending meets one muscle fibre" (grade 3)

**Now:** three pink sausages, a black stick nerve branching into three dark ellipses, and a dashed blue circle. The endings sit at x 168, 262 and 356, not near each fibre's middle.

**Redraw (h 408):**
- Three **muscle fibres** as long cylinders (y 214, 280, 346, about 46 tall): a linear gradient top-to-bottom for roundness, fine **cross-striations** (vertical lines every 6 units at 0.18 opacity, alternating thick and thin for A/I bands), and 2 or 3 flattened **peripheral nuclei** (dark ovals hugging the membrane). `data-part="fibres"`.
- The **motor axon** descends myelinated (segments with node gaps) and branches. Each branch loses its myelin just before the fibre and ends in a **terminal arborisation**: a small cluster of 3 to 4 knobs (a "pretzel" plaque, Netter style), ink with a highlight. Place the three plaques near each fibre's midline, x ≈ 220 to 260, staggered slightly.
- **NMJ callout:** replace the dashed circle with a magnifier: a solid blue circle round the top plaque with a short tapering cone toward a label "neuromuscular junction". This also sets up the zoom in step 3. `data-part="nmj"` on the circle plus the plaque.
- **Motion:** pulse down the axon (as now), then each fibre lights (blue at 0.18) spreading **outward from its junction** toward both ends, not as a whole-fibre flash. This foreshadows step 9.

## Steps 3 to 6 and 10 · the close-up (gap, packets, release, receptors, enzyme) (grade 3 each)

**Now:** `ENDING` is a white tub with a square chimney and a heavy 3-unit ink outline. The gap is a pale floating rectangle that does not reach the plate. The end plate is a flat red line with three narrow V-spikes. Vesicles are open rings with three dots. Gates are two pale bars. The enzyme is a pac-man. There are no organelles, no Schwann cell, no basal lamina and no membranes, and the labels sit in the tissue. At t=0.35 in step 5 the calcium is already gone (it plays at t .06 to .23), so the frame shows no calcium even though the label says "calcium flows in".

**Redraw: one shared close-up builder `closeUp(mode, t)` with the same modes (bare, still, spill, dock, chop) and the same exported constants (GAP, PLATE, FOLDS, GATES, VES) so `gate()` and the label functions still line up.** Geometry (h 304 kept):
- **Terminal (bouton):** a rounded, slightly asymmetric dome (x 96 to 384, y 30 to 126), entered from the top by a **myelinated axon** whose last myelin segment ends at y≈28 (myelin drawn as two cream bands either side of the axon). A **Schwann cell cap** (`#e8dcc0`, 0.9) drapes over the top of the dome, clear of the cleft side. Cytoplasm gets a gradient. Inside: 2 **mitochondria** (capsule with cristae squiggle, `#e9c9a4`/ink 1.25) in the upper part, and the vesicles below them, clustered toward the bottom membrane.
- **Presynaptic membrane:** the bottom edge as a bilayer strip. Mark 2 **active zones** (small dark dense bars on the inner face) at x≈206 and x≈278, both over fold **crests**. Next to each, a **voltage-gated calcium channel**: a two-lobed protein spanning the bilayer, `#e6b3ae`/red outline 1.5. `data-part="calcium"` on the channels plus the ions.
- **Cleft:** basal lamina as a faint fibrous band (`#f7f3ea` with 6 to 8 fine wavy lines at 0.25) filling the full cleft **and following the folds down**. Replace the floating rectangle. `data-part="gap"` on this band plus the step 3 double arrow.
- **End plate:** muscle surface as a bilayer that dips into **3 to 4 junctional folds**. Make them wider and rounder than today's spikes: U-shaped, about 22 wide at the mouth and 54 deep, with rounded bottoms. Sarcoplasm below gets a gradient and faint striation bands at the bottom edge (y > 260) plus one peripheral nucleus, so it reads as muscle. `data-part="endplate"` on the folded membrane.
- **Receptors (`gate()`), steps 6 and 10:** draw each nicotinic receptor as a **pentameric channel in side view**: two mirrored, rounded, bean-shaped subunit halves spanning the bilayer and rising about 14 units into the cleft (the large extracellular vestibule), with a pore between them. Closed: the halves meet at the membrane level (a narrow waist). Open: the waist widens about 5 units and a pale amber pore line appears. Two **binding pockets** (small notches) on the upper outer faces receive the green ACh. Fill `#dfe3d6` with ink 1.5 and a highlight stroke. These sit on the **crests** at the existing GATES x.
- **Sodium channels** (new, small, muted, for anatomical truth and for step 14 later): 1 per fold trough, a simpler 4-domain block. Unlabelled in steps 3 to 5; in step 6 they carry no label either, so one idea per picture holds.
- **Vesicles:** filled spheres (`#eef6ea` with a green 1.5 membrane and a highlight), 13 radius, with 5 to 6 small ACh dots inside. Two of them sit docked at the active zones.
- **ACh molecules:** green 4.5 dots, unchanged colour. When chopped (step 10), split into two different glyphs: **choline** (small green circle) and **acetate** (small green triangle), both fading.
- **Cholinesterase:** replace the pac-man with an enzyme that reads as a protein. Use a **globular enzyme** (three-lobed blob, `#d6d9cc`/ink 1.5) tethered to the basal lamina by a thin collagen-like tail (the real AChE form at the NMJ is anchored by a collagen tail, ColQ). Show a visible active-site cleft that opens and closes. Place one at each fold mouth or just inside it, on the lamina band.

**Per step labels and motion (all with leader lines, labels outside tissue where possible):**
- **3 gap:** labels "nerve ending" (left, leader to the bouton), "synaptic gap" (right, with the existing double arrow across the cleft), "end plate: the folded surface" (on the sarcoplasm under the folds), "muscle fibre" (bottom left). Still.
- **4 packets:** as 3 plus vesicles. Label "vesicles: bubbles of acetylcholine" with a leader to one vesicle, placed in the empty upper-right air, not in the cleft. Still. Add a small inset ring magnifying one vesicle with "thousands of molecules" only if it fits; otherwise skip it.
- **5 release:** pulse runs down the axon (`data-part="impulse"`). Calcium channels open (the lobes part) and red calcium enters **upward from the cleft** at the active zones. The docked vesicles **fuse** (an omega-shaped profile opening into the cleft) and ACh plumes out. Retime so calcium is visible from t .06 to .40 (extend the span), letting the t=0.35 frame show calcium, the fusion and the spill together. Labels: "nerve impulse" (top, blue), "calcium flows in" (left, red, leader to a channel), "acetylcholine spills into the gap" (green, under the folds or right).
- **6 receptors:** ACh crosses and docks two per receptor. The channel waist opens, an amber pore glow appears, and amber Na dots stream **down through the open pore** into the sarcoplasm. Labels: "gates: acetylcholine receptors" (leader to one receptor) and "open gates let sodium rush in" (amber, leader to the Na stream).
- **10 enzyme:** as 6, then ACh unbinds and drifts to cholinesterase, which splits it into choline and acetate. The gates close. Labels as now, but as leader lines to an enzyme.

## Step 7 · voltage · "Sodium makes the end plate's voltage jump" (grade 6, graph)

**Now:** clean and readable: a single blue trace, an axis label, a rest label and an "impulse arrives" arrow. Problems: no x axis line (the trace floats), the y axis has no baseline or zero tick, "rest" sits on top of the trace's rest segment, and the axis labels are muted grey at xs.

**Lift:** draw a hairline x-axis under the rest line (rule colour). Add a pale blue **area fill** under the EPP (blue at 0.12) so the "bump" has mass. Put "rest" left of the y axis or below the rest line with a 6-unit gap. Optional: a tiny inset icon (an open receptor with Na arrow) at the rise, tying the graph to step 6. Keep `traceShape`, `T_PEAK` and `data-part="trace"`.

## Step 8 · margin · "A wide margin of safety" (grade 6, graph)

**Now:** good: a red threshold and a black double arrow from threshold to peak. Problems: at t=0.35 the double arrow is drawn on top of the steep rising trace (overlap). The label "safety margin: far more than needed" floats with no tie to the arrow.

**Lift:** offset the margin arrow 14 units right of the peak x and add short horizontal dashed ticks from the peak and from the threshold to the arrow ends (a dimension-line style). Shade the band between threshold and peak, over the trace's width above threshold, with a light green or blue hatch at 0.15. Put the label beside the arrow with a leader. Fill under the trace as in step 7, and a slightly stronger tint above threshold.

## Step 9 · fire · "The fibre fires, then twitches" (grade 3)

**Now:** a pink pill with a black nerve stick and an ellipse. The whole fibre is labelled "end plate", which is wrong: the end plate is the patch under the terminal. The action-potential band turns the pill lavender (blue 0.22 over pink). "the fibre shortens" is visible, greyed, at t=0.35 before any shortening. The **"one twitch" label overlaps the twitch curve** (FORMAT violation). The twitch is a symmetric sine.

**Redraw (h 392):**
- Top: one **striated muscle fibre** (the step 2 primitive), y 96 to 156, with the terminal plaque at its middle (the step 2 primitive, myelinated axon above). A small bracket under the plaque reads "end plate" (xs, leader). `data-part="fibre"` is not used by a dfn; keep it anyway.
- **Action potential:** two blue wavefronts (a bright band 18 wide with a soft trailing gradient) travelling outward from the end plate along the sarcolemma, drawn **on the membrane edge** (top and bottom outlines turning blue as the wave passes), not as a translucent box. `data-part="wave"`. Keep the arrows and the label "the muscle action potential spreads both ways" below.
- **Contraction:** after the wave, the striation spacing compresses (sarcomere lines move closer), the fibre shortens about 10% and fattens. The ink inward arrows at the ends appear only during the squeeze. Show "the fibre shortens" only from t .3 (currently its opacity is 0 to 1 over .3 to .4, but it renders grey at .35; check `op()`; better to fade it in at .32 to .42 and place it above the fibre's right end).
- **Twitch graph:** an asymmetric twitch (fast rise, slower relaxation; for example rise over 30% of the bump width, decay over 70%) with a blue area fill at 0.12. Place "one twitch" **above the peak's right shoulder with a 10-unit clearance** or to the right of the curve end, never on the line. Mark latency with a small tick "impulse" at the start of the time axis. `data-part="twitch"`.

## Step 11 · burst · "Quick bursts test the margin" (grade 6, chart)

**Now:** a clear three-row small-multiples chart: green ACh bars declining, blue EPP bars against a red threshold, blue twitch bumps equal. Problems: during the reveal each column **grows from zero height**, so at t=0.35 the second twitch and EPP look weaker (it reads as fade, the opposite of the lesson). The y axes have no baseline label or scale. The bars are flat-filled.

**Lift:** reveal each impulse at **full height with an opacity and 6-unit upward slide**, or with a left-to-right clip wipe. Never scale the height during the reveal. Add a faint dashed reference line at bar 1's height in the ACh row so "a little less each time" can be read against it. Give the bars a 2-unit rounded top and a slightly darker bottom edge (a subtle gradient). Number the impulses "1 2 3 4" under the twitch row in xs muted, replacing or joining "four quick impulses →". Keep the model-driven heights.

## Step 12 · whole · "The whole picture" (grade 4)

**Now:** the three-row tof chart. The top row ("gates on the end plate") is a flat red line with bar-pair gates and pac-man enzymes, and the **enzymes overlap the gate pillars** at x 168, 276 and 384 (each sits between two gates only 36 apart, with a radius of 9 at y+24 while the pillars reach y+20). Open and closed gates are hard to tell apart (the pillars shift only 4 units). The ACh dots float without a cleft.

**Redraw the top row (`gateRow`) as a strip of the real end plate:** a band 64 tall showing a slice of the cleft (basal lamina tint) over a bilayer membrane with **2 shallow folds** between gate groups. The 8 receptors use the step 6 **pentamer side-view primitive** at a reduced scale (about 0.75), on the crests, with open versus closed told by the pore glow (amber) and the waist gap, not only spacing. Put the **cholinesterase** primitive (scaled) **inside the two folds**, where it cannot touch a receptor. Keep the xs positions model-driven (8 slots), but space them to 4 + 4 around the folds, for example `[146,176,206,236 | 284,314,344,374]` with folds at 260 and either end. Keep the row title. Rows 2 and 3 get the step 11 lifts. The whole chart also serves steps 13 to 16 and Explore, so do this once in `gateRow`/`eppRow`/`twitchRow`.

## Step 13 · ndmb · "Nondepolarizing blockers: gates jammed shut" (grade 5)

**Now:** the tof chart with a dashed ghost of normal on rows 2 and 3, purple bar "plugs" floating above gates, and blue notes at the right of each row ("jammed shut by the blocker", "many fall below threshold", "weaker, and fading ↓"). The ghost and the changes read well. Problems: the plugs float **above** the gates rather than sitting in the binding pockets. The row 1 overlap problems from step 12 carry over. The "↓" is a glyph in the note, not an arrow on the picture pointing at what moved. The legend's "blocker" swatch is a lozenge that matches nothing anatomical.

**Redraw:** the blocker becomes a **purple bulky molecule** (a rounded rectangle with two quaternary-ammonium "knobs", about 18 x 10) **seated in a receptor's binding pocket**, the receptor drawn closed (no pore glow). On rows 2 and 3, add a **blue change arrow** from the ghost top to the new top on bar 4 and on twitch 4, with the note text attached to that arrow ("weaker, and fading"). On row 1 the arrow points at a blocked receptor ("jammed shut"). The legend uses the same glyphs as the picture. Keep the timing (mix over span .1 to .7, notes fade in .62 to .92).

## Step 14 · sux · "Succinylcholine: the end plate held depolarized" (grade 4)

**Now:** purple diamonds over open gates. A blue "held" band rises to just above the red threshold line, so the dashed blue held line and the red threshold **coincide** and read as one line. The flurry is a black zigzag that runs **over the twitch bumps and ghost curves**. The label "a flurry of small twitches" **overlaps the dashed ghost curves** (FORMAT violation, visible at t=0.35).

**Redraw:**
- Row 1: succinylcholine as a **purple dumbbell** (two linked ACh-sized beads, honest to "two acetylcholine molecules joined") occupying **both** binding pockets of a receptor, which is drawn **open** (pore glow). Add the step 6 **sodium channel** primitive at the row's right end in the fold trough, drawn **inactivated** (a purple-grey ball-and-chain plug closing it) with a short label "sodium doors lock". This puts the mechanism in the picture instead of only in a note.
- Row 2: draw the held level as a **solid blue band whose top is clearly above threshold** (at least 8 units), labelled "held depolarized" with a leader. The bars sit inside it. Move the row note so it does not repeat "held up". Accuracy: the fibre fails to fire because the sodium channels beside the end plate are inactivated, not because the end plate stays below threshold. The picture must not suggest the latter. (Model: `TH*1.25*held`. A small constant offset in drawing only, not in `model()`, is acceptable if the band is labelled as illustrative. Check that Explore still agrees with the readout.)
- Row 3: draw the flurry as **small, thin blue spikes in their own lane** under the twitch baseline (y base+4 to base+18), or in a dedicated mini-strip above row 3's baseline, before the four impulses. Spikes must not cross the ghost or the bumps. Place "a flurry of small twitches" left-aligned over that strip, clear of the ghosts. Then "small, but no fade" with an arrow from ghost to bump 1.

## Step 15 · che · "Cholinesterase inhibitors: reversing the block" (grade 5)

**Now:** good two-stage story ("1: the blocker acts", "2: the inhibitor is added"). At t=1, ACh dots crowd the strip, purple crosses sit over the enzymes and twitches recover. Problems: the crosses are bare X marks over pac-men. The row 1 overlaps remain. In stage 2 the ACh dots overlap the blocker plugs and the gate tops.

**Redraw:** the inhibitor (neostigmine) as a **small purple wedge lodged in the enzyme's active-site cleft** (the step 10 enzyme primitive), so "enzyme stopped" reads as a molecule in the pocket, not a cross-out. ACh accumulates as a visibly **denser cleft band** (more dots in the lamina strip, kept off the receptor tops by a 4-unit clearance). It displaces blockers: animate 2 or 3 blockers leaving their pockets (drifting up and fading) as ACh takes them, keyed to `occB` falling. Stage tag stays bottom-left. Change arrows on bar 4 and twitch 4 point up ("back above threshold", "twitches recover").

## Step 16 · mg · "Myasthenia gravis: too few gates" (grade 4)

**Now:** red Y antibodies **with their stems on dashed empty boxes** (wrong orientation, see accuracy note 3). An ACh dot touches an antibody arm at x≈386. The ghost twitch peaks at t=0.35 show only as a tiny dark tick on bump 4. The change is small and the "fading with use ↓" arrow is a glyph.

**Redraw:**
- Row 1: lost receptors drawn as a **pale dashed pentamer outline** (the receptor primitive at 0.35 opacity, dashed), with an **IgG antibody** (a proper Y: two Fab arms, each a pair of rounded segments, Fc stem, red `#b3261e` fill at 0.85 with a darker outline) whose **Fab tips bind the top of a remaining or departing receptor**, stem up into the cleft. Show one antibody bound to a still-present receptor that is fading out (internalised) as t rises, to tell "blocking and destroying". Optional and accurate: **flatten the folds** slightly as t→1 (simplified postsynaptic membrane is a recognised MG finding). Do this only if it reads cleanly; it is not in the caption.
- Rows 2 and 3: change arrows on bar 4 ("only just above threshold") and twitch 4 ("fading with use").
- Keep 'missing' states from `receptorStates()` (`Math.round(8 * receptors)`).

---

## Reusable primitives this lesson needs

1. Spinal cord cross-section (white matter oval, butterfly grey matter, ventral horn, ventral root exit).
2. Multipolar motor neuron (soma with nucleus, dendrites, axon hillock).
3. Myelinated axon segment (myelin bands, nodes of Ranvier) that terminates unmyelinated.
4. Peripheral nerve cable (epineurium with several axons, one highlightable).
5. Skeletal muscle belly (fusiform, fascicle striping, tendons, bone ends), animatable length and width.
6. Skeletal muscle fibre (cylinder shading, A/I cross-striations, peripheral nuclei), animatable sarcomere spacing and a membrane wavefront.
7. NMJ terminal plaque, surface view (pretzel cluster of knobs).
8. Presynaptic bouton, section view (Schwann cap, mitochondria, vesicle cluster, active zones).
9. Synaptic vesicle (filled sphere with transmitter dots), with docked and omega-fusion states.
10. Lipid bilayer strip that follows an arbitrary path (flat and folded).
11. Junctional folds (parametric U-folds) with basal lamina band following them.
12. Nicotinic AChR pentamer, side view, two binding pockets, closed/open waist, pore glow, states: empty, ACh x2, blocked, depolarizing agonist, lost (dashed).
13. Voltage-gated calcium channel (two-lobed, open/closed).
14. Voltage-gated sodium channel (resting, open, inactivated ball-and-chain).
15. Acetylcholinesterase, globular with collagen tail and an active-site cleft (open, chopping, inhibitor-lodged).
16. IgG antibody (Fab arms, Fc stem) that binds by its arm tips.
17. Ligand glyphs: ACh dot, choline plus acetate fragments, succinylcholine dumbbell, bulky nondepolarizing blocker, inhibitor wedge, Ca2+ and Na+ ions with consistent colour roles.
18. Mitochondrion (capsule with cristae).
19. Chart kit: bar with ghost outline and a ghost-to-new change arrow, threshold line with label, area-filled trace, asymmetric twitch curve, full-height reveal by opacity or clip.

## Risks

- **Model-driven geometry:** steps 11 to 16 and Explore draw from `model()` and `receptorStates()`. Do not hard-code any bar, twitch, gate count or ACh count. The redraw must render arbitrary slider mixes (for example sux plus ndmb plus missing receptors at once) without overlap.
- **Hooks:** keep `data-new-state` with its eight `data-*` metric attributes, `data-gate` states on close-up gates, and `class="ghost"`. Smoke and walk tools (tools/lab-walk.mjs, lab-check.mjs) may read them. lab-check requires at least 3 `<dfn data-part>`.
- **data-part coverage:** every dfn part listed above must still wrap the drawn structure. The receptor primitive must carry `data-part="gates"` and the drug glyphs `data-part="drug"` in the tof rows. Antibody glyphs `data-part="antibody"`, enzyme `data-part="enzyme"`. Add `impulse` for step 5.
- **Shared builders:** `closeUp` serves 5 steps and `tofArt` serves 5 steps plus Explore. A change there changes all of them, so re-shoot all 16 steps and Explore after every change.
- **Label overlap hot spots today:** step 1 "a cable of axons" against the cord; step 9 "one twitch" on the curve; step 12 to 16 enzymes on gates; step 14 flurry label and spikes on the ghost curves; step 16 an ACh dot on an antibody. Check at 1280 and at 375 x 553.
- **Gradient id collisions:** several SVGs can exist in the DOM at once (steps plus Explore). Namespace `<defs>` ids per scene, or use the kit's defs.
- **`.on-organ` halo colour** is hard-coded to `#f1d6d0` in style.css. Change it together with the muscle fill.
- **Reveal timing:** step 5's calcium must be visible at the `rest` moment (.55) and at t=0.35. Moving calcium spans also moves the vesicle fusion and spill. Keep `rest` frames meaningful under reduced motion.
- **Accuracy traps:** calcium entry site (active zone, not corners); active zones opposite crests; receptors on crests and Na channels in troughs; antibody binds by Fab tips; sux held level must not read as "below threshold"; a twitch is asymmetric; the end plate is a patch, not the whole fibre; NMJ near the fibre's middle. Do not add anything outside the captions as a labelled teaching point; unlabelled anatomical context (mitochondria, Schwann cap, nuclei) is fine.
- **Height budget:** the tof charts with legend already reach about 406 units. A taller row 1 must come out of other rows' spacing to stay at 420 or under.
- **No em dashes** anywhere in the lesson files (lab-check enforces this).
