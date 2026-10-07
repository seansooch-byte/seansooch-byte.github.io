# Decisions

Append-only. Newest entries supersede older ones; never edit a past entry.

---

## 2026-05-28 - CXR rendering: schematic SVG engine for the drill, real images for recognition

**Context.** The Read the CXR module needs chest films to read. The EKG reader synthesizes its waveforms procedurally because an ECG is a 1D signal that can be reproduced faithfully from sourced numeric parameters. A chest radiograph is a complex grayscale image and cannot be procedurally generated to look real from parameters.

**Decision.** Two-part approach:
1. **Schematic SVG engine** drives the systematic-read *drill*. Anatomy and findings are drawn as SVG from `cxr.js` case data (`render` block). This preserves the project's core principle - clinical truth in data, rendering never improvises morphology - and keeps the single-file/0-dependency pattern.
2. **Real, license-cleared images** drive a separate *recognition* mode, so learners train on real radiographic texture and subtle findings the schematic cannot convey.

**Alternatives considered.**
- *Real images only.* Most authentic, but you cannot guarantee one-unambiguous-finding-per-step on a real film, licensing must be cleared per image, and it abandons the data-is-truth rendering discipline.
- *Schematic only.* Clean and fully controllable, but a diagram cannot teach real-film pattern recognition - a gap the user (the accuracy verifier) correctly flagged.

**Rationale.** The drill is about *the method* (fixed outside-in order, what each finding means, how it changes the read) - a schematic is sufficient and superior for control. Recognition is about *the eye* - only real films do that. Splitting the two lets each mode be honest about what it teaches. SVG (not Canvas, which the EKG engine uses) was chosen for the schematic because anatomy is naturally expressed as vector paths, gradients, and opacity.

**Constraints that follow.**
- Real images must be public domain, CC0, or CC-BY/BY-SA with attribution; license + source URL recorded per film in the manifest. Bundling licensed image files does not violate the "0 dependencies" claim (that refers to JS/build tooling).
- Read order is "outside-in" (adequacy, periphery, airway, lungs, heart/mediastinum, diaphragm, lines, impression), matching how films are read on the wards rather than the RIPE+ABCDE or A-G mnemonics.

---

## 2026-05-28 - Recognition ships with 5 real films; pneumoperitoneum dropped from recognition

**Context.** Recognition mode needed real, license-cleared chest films, sourced "I propose, you approve". Six findings were targeted to mirror the schematic drill: normal, consolidation, pneumothorax, pleural effusion, cardiomegaly, and pneumoperitoneum.

**Decision.** Ship 5 films, all from Wikimedia Commons, every one visually verified against its claimed finding before wiring in:
- normal (CC0, Mikael Häggström), right middle lobe pneumonia (CC0, Häggström), left pneumothorax (CC BY-SA 2.5, Ves Dimov / Clinical Cases), left pleural effusion (CC BY-SA 2.5, Clinical Cases), cardiomegaly (CC BY-SA 3.0, SCiardullo).
- A "Right middle lobe consolidation" option was added to the lungs step because the only well-licensed CC0 pneumonia film is RML, not lower-lobe; mislabeling it "lower lobe" would have been clinically wrong (RML silhouettes the right heart border, not the diaphragm).
- **Pneumoperitoneum is excluded from recognition.** No erect, un-annotated, acceptably-licensed chest film with a subdiaphragmatic free-air crescent exists on Commons; candidates were either supine abdominal films, composites with a CT panel, or had the answer burned into the image. The canonical teaching examples are almost all CC-BY-NC (Radiopaedia), which is excluded. The schematic drill still teaches pneumoperitoneum.

**Rationale.** Better to ship 5 films that are each unambiguous and correctly labeled than to pad the set with a weak or mislabeled image. Accuracy of the labeled finding is the whole point of recognition.

**Constraints that follow.**
- Read-key judgment calls on real films default to the conservative call when a secondary finding cannot be confirmed from the image (e.g. tracheal/mediastinal shift on the pneumothorax and effusion films is left "central" because deviation was not clearly visible, even though the source pages mention it).
- The ECG calibration header (25 mm/s, 10 mm/mV) is hidden on the CXR module; it is meaningless for a radiograph.

## 2026-09-22 - Edition 2 "Reading Room": the read becomes a report that fills in

**Context:** App redesign program (Claude Opus 5.5). Edition 1 (dark teal/rose cards, Fraunces/Inter) presented each read step as a card that replaced the previous one, so a finished read left nothing on screen but the impression.

**Decision:** A reading-room layout: worklist, lightbox, report. The 8-step read is a single report: finished steps stay written with their answers (and a tick or cross in quiz mode), the open step shows question, method and choices, and finishing writes the impression. One `makeReader` drives both the 12-lead and chest-film reads. Any case can be opened from the worklist (Edition 1 only cycled "New case"). Keyboard: digits choose, Enter advances, L toggles room lights. Engines untouched.

**Also fixed:** the rhythm quiz printed the rhythm's rate range in the strip header, which gave the answer away; it now reads "rate: measure it" until answered. Real-film titles (which name the finding) stay hidden in the worklist until answered. On phones the 12-lead keeps a readable 720 px width and scrolls sideways.

**Alternatives considered:** keeping the card-per-step flow in a new skin (rejected: the report metaphor is the redesign, and it teaches the systematic read better because the whole read stays visible).

## 2026-09-23 - The chest-film drill renders synthesized radiographs, not a schematic (supersedes "deliberately not photorealistic")

**Context:** Sean: "Repair the chest films in Read This. The SVG generated ones can look so much better." Edition 1's schematic (flat shapes, evenly spaced rib arcs, no lung markings) could not show what a film is read for: markings stopping at a pleural line, a border lost against an opacity, overlap of bone and soft tissue.

**Decision:** Replace the SVG schematic with a radiograph synthesizer (Edition 2 engine, `part2-cxr.js`): build an attenuation field from anatomy plus the case's findings, then develop it (blur, mottle, characteristic curve). Signs fall out of the physics instead of being drawn: the silhouette sign, the meniscus, the deep lateral recesses, the spine fading behind the heart. The data contract is unchanged (cxr.js is untouched; nothing is drawn that is not in `case.render`).

**Alternatives considered:** a better SVG (gradients and filters can soften shapes but cannot sum overlapping densities, so every sign would still be painted by hand); licensed real films for the drill (the multi-finding cases need films that exactly match each answer key; recognition mode already uses the 5 real films that could be cleared).

**Also fixed:** Edition 1 drew the rotated film's spinous process as a red marker (a colour a real film never has); rotation is now shown the way it is read, by the spinous processes and clavicular heads moving opposite ways. Verified: all 8 cases render (about 150 ms first paint, cached after), identical pixels in forward and reverse render order, desktop and 375 px.

## 2026-09-23 - Rhythm strips: a new single-lead engine, and three accuracy fixes

**Context:** Sean: "Improve the rhythm strips next." Edition 1 summed Gaussians for every wave, so complexes were round humps (VT looked like a sine wave), the monitor scrolled a 14 s loop with a seam, VF was per-sample noise, and three render flags in rhythms.js were silently ignored (t.discordant, p.pseudo, fusionBeats).

**Decision:** A new rhythm engine (`part2-rhythm.js`, spliced by build.py in place of Edition 1's block, keeping the helpers the 12-lead engine shares): vertex-built QRS complexes smoothed into a real trace, asymmetric P and T, rate-dependent QT, every render flag honoured, rhythm-specific signals, real paper (calibration pulse, 3-second marks, calipers) and an erase-bar monitor. Data stays the single source of truth.

**Accuracy fixes found on the way:**
- **Mobitz II was drawn as high-grade block.** Its data said ratio '3:1' and the engine conducted one P in three, while the entry teaches an intermittent drop with a constant PR. rhythms.js now says '4:3' (three conducted, one dropped) with a comment.
- **"Compensatory" PVCs and PJCs were interpolated.** Edition 1 drew the next sinus beat 0.34 s after the PVC; a compensatory pause means that sinus impulse is not conducted and the next beat lands two RRs after the last normal beat. Fixed; the blocked sinus P still fires on time, hidden in the PVC's ST-T.
- **VT and idioventricular T waves were concordant** although the data said discordant.

**Verified:** `lab_rhythm.py` measures the rate of every organized rhythm from the signal with an R-peak detector: all within 3% of the data (NSR 74.9 vs 75, flutter 150.0 at 2:1, Wenckebach 49.6 vs 48.75, Mobitz II 45.5 vs 45, complete block 38.0). Calipers read 800 ms / 75 per min / 20 small boxes for a 0.8 s drag. Quiz still masks the rate header.
