# Art reference: the four-chamber heart, worked SVG recipe (revision 2)

Companion to ART-DIRECTION.md. This is the starting drawing for `lab/kit/art/heart.js` `heartSection()`.
Revision 2 applies the three critiques (decisions are in ART-DIRECTION.md, section 9). It was redrawn by
hand in a 240 x 280 box and rendered with headless Chrome on the kit panel `#ecefe5`:

- full size: `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/heart.png` (source `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/heart.svg`)
- phone frame (s 1.25 in a 480 x 420 picture, shown at 375 px, in-cavity labels, right label column,
  art ghost and blue change arrow): `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/frame375.png` (source `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/frame.svg`)
- phone band size, 155 px wide: `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/small.png`
- conduction overlay check (RVOT in its `ghost` state): `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/cond.png` (source `/private/tmp/claude-501/-Users-seansooch--claude-spares-spare-RN8oe0/de937ab4-8b1b-4c49-b0b0-ae0335b77bbd/scratchpad/heart2/cond.svg`)

The revision 1 renders in `scratchpad/heart/` are superseded: they draw the pulmonary trunk on the left
atrium, the descending aorta ending on the left atrium roof and an internodal wire. Do not port from them.

## Orientation (read this first)

- The view is **anterior**: the viewer faces the patient. The patient's right is the viewer's left.
- "Apex down-left" in the lesson briefs means the **patient's** left. On the page the apex points **down
  and to the viewer's right**. RA and RV are on the viewer's left, LA and LV on the viewer's right. Never
  mirror the heart between steps or lessons.
- The cut is the textbook composite: a frontal section through all four chambers with the aortic root
  opened in the same plane (a "five-chamber" cut) so the aortic valve shows.
- **The right ventricular outflow tract (infundibulum) is drawn, by default, as the most anterior
  structure**: an opened muscular funnel that leaves the upper RV, rises in front of the atrioventricular
  septum, crosses **in front of the ascending aorta just above the sinuses**, and ends at the pulmonary
  valve, from which the pulmonary trunk rises to the viewer's right of the ascending aorta. The RVOT never
  touches the LA cavity, and its lumen is continuous with the RV cavity, so the RV to pulmonary trunk
  connection is visible at a glance. The aortic valve and sinuses stay visible below it.
- **Vessel convention (course-wide):** vessels outside the heart are drawn whole as see-through tubes (wall
  rims with the lumen colour between them); this is a convention, not a cut, and it is stated once in the
  lesson that first uses it. Valves are shown only where the drawing opens a chamber or outflow (the
  aortic root and the opened RVOT). Cut ends of vessels are elliptical faces.
- **Depth tiers:** structures behind the heart (descending aorta, right pulmonary artery, the IVC below the
  RA) are drawn first and mixed 30 % toward the panel. The descending aorta runs behind the heart and
  reappears below its inferior border with a cut face; it never ends on the LA.
- **Simplifications stated, not hidden:** only the two left pulmonary veins are drawn (the right two pass
  behind the RA and are hidden); only two of three aortic and pulmonary cusps show; the apex is pinned and
  the annular plane moves only a little (section "Ventricular volume").

## Anatomy checklist this recipe satisfies

| Structure | Where in the 240 x 280 box | Accuracy point |
|---|---|---|
| Superior vena cava | x 51 to 73, y 4 to 96, enters the RA roof | vein wall (thin), deoxygenated lumen; no valve |
| Inferior vena cava | x 29 to 51, enters the RA floor at y 186 to 196, cut face at y 226 | behind tier below the heart; no valve |
| Right atrium | cavity x 40 to 94, y 93 to 194 | thin wall; smaller than the RV (RV plus infundibulum) |
| Interatrial septum | darker band between the RA medial wall and the aortic root, x 90 to 121 | posterior to the root; carries the AV node at its base |
| Tricuspid valve | annulus (44,194) to (92,166), length 56 | annulus at least as long as the mitral (53); leaflets anterior and septal shown (posterior out of plane). In the four-chamber variant (`root: false`) the septal hinge sits at most 10 units (about 7 mm) below the mitral's |
| Right ventricle | cavity under the tricuspid, septal face (92,166) to (146,230) | free wall about 6 units; cavity stops well short of the apex (about 0.77 of LV length) |
| RV outflow tract | opened funnel from the upper RV, x 93 to 172, y 80 to 206 | anterior; lumen continuous with the RV; crosses in front of the ascending aorta above the sinuses |
| Interventricular septum | between the RV face and the LV face (121,147) to (185,250) | one shade darker than the free wall; bowed into the RV |
| Left atrium | cavity x 150 to 214, y 99 to 134 | posterior; receives the two left pulmonary veins from the viewer's right |
| Pulmonary veins | x 208 to 238 at y 104 and 126 | **vein** wall (thin, blue-grey rim), **oxygenated** lumen |
| Mitral valve | annulus (152,134) to (204,126) | anterior leaflet (about 38) hinged against the aortic annulus (aortomitral continuity); posterior leaflet short (about 21) |
| Left ventricle | cavity x 121 to 213, y 126 to 250 | free wall about 15 units; forms the apex |
| Papillary muscles | RV: anterior, from the inferior free wall (head 90,211); LV: anterolateral from the free wall (head 193,201), posteromedial from the inferior wall (head 179,225) | cones growing out of the wall in the same muscle; septal tricuspid leaflet tethered to the septum directly |
| Aortic root | annulus (121,147) to (146,139), sinus bulges to x 110 and 151, rises to the silhouette top at y 80 | artery-wall ring around the root (not muscle); lumen continuous with the LV outflow |
| Ascending aorta, arch, descending aorta | centreline `M129 116 L128 58 C128 36 142 24 159 24 C176 24 190 36 190 56`, descending `L190 272` | ascending to the viewer's left of the pulmonary trunk; descending behind the heart, cut face below it |
| Arch branches | brachiocephalic (x 131 to 137, 15 wide), left common carotid (x 157, 11), left subclavian (x 174 to 179, 11) | order from the viewer's left; brachiocephalic largest |
| Pulmonary trunk | from the valve (166,88) up to the bifurcation (162,60) under the arch | **artery** wall (thicker), **deoxygenated** lumen |
| Pulmonary arteries | LPA to the viewer's right, in front of the descending aorta, cut at (214,60); RPA to the viewer's left, behind the ascending aorta, cut at (98,60) | artery wall, deoxygenated lumen |
| Apex | epicardial tip near (200,268) | down and to the viewer's right; heart height about 0.98 to 1.0 of its width, long axis tilted about 30 degrees |

## Layer order (back to front)

1. **Behind tier** (30 % toward the panel): descending aorta (whole length, with its cut face below the
   heart), right pulmonary artery, IVC.
2. Aorta: arch branches, then the arch tube (outline, artery wall, lumen), then its highlight.
3. SVC, pulmonary veins.
4. **Heart exterior**: the silhouette stroked 10 in the outline colour, then 7 in the epicardial gradient
   (one user-space light from the upper left), then filled with the flat cut face. Result: a 3-unit lit
   epicardial rim and a 1.5-unit outline outside a flat section.
5. Septum and interatrial band (one step darker than the cut face).
6. Cavities: inflow mouths (small lumen patches that erase the cut edge where a vessel enters), flat blood
   fills, then a 2.5-unit endocardial shadow (the cavity's `lo` at 45 %, a 5-unit stroke clipped to the
   cavity). **No speculars on blood or on the cut face.**
7. Aortic root (artery-wall ring, lumen).
8. Papillary muscles, then valves with chordae.
9. **Front tier**: pulmonary trunk and arteries, then the opened RVOT, then the pulmonary valve.
10. Overlays by option: conduction (RVOT switches to `ghost`, 18 % opacity), flow streamlines, activation
    wash, the art ghost (above the art), labels.

## The SVG (diastole: atrioventricular valves open, semilunar valves shut)

Ids use the `ax-` prefix so `svg()` or `artContext()` can scope them per picture (ART-DIRECTION.md,
section 5). In the library the gradients come from `artDefs()`; the user-space gradients for the heart's
exterior and cut face are per instance (`uid('epi')`), because their coordinates belong to this drawing.
Every hex below is a `P` value (ART-DIRECTION.md, section 2); the port replaces each literal with its `P`
name. The chamber parts use the short names `ra rv la lv`; the port emits them as leaf groups with multi-name
`data-part` values (ART-DIRECTION.md section 4.0b), for example `data-part="lv ventricle"`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="411" height="480" style="background:#ecefe5">
<defs>
  <linearGradient id="ax-epi" gradientUnits="userSpaceOnUse" x1="40" y1="70" x2="210" y2="270"><stop offset="0" stop-color="#efc6b4"/><stop offset=".5" stop-color="#d39684"/><stop offset="1" stop-color="#9c5a4a"/></linearGradient>
  <radialGradient id="ax-cut" gradientUnits="userSpaceOnUse" cx="130" cy="170" r="120"><stop offset=".5" stop-color="#dca796"/><stop offset="1" stop-color="#c98b79"/></radialGradient>
  <path id="sil" d="M64 82 C46 84 34 100 33 124 C32 150 32 176 38 198 C56 228 112 250 170 264 C184 268 196 270 202 263 C216 238 226 192 224 150 C222 122 216 106 206 96 C192 84 166 82 146 84 C122 82 90 78 64 82 Z"/>
  <path id="ra" d="M64 94 C50 96 42 108 41 128 C40 150 40 172 42 192 L44 194 L92 166 C94 140 94 116 90 100 C82 95 74 93 64 94 Z"/>
  <path id="rv" d="M44 194 L92 166 C104 192 124 214 146 230 C124 237 96 235 76 227 C60 219 50 208 44 194 Z"/>
  <path id="la" d="M152 134 C150 120 152 110 160 105 C176 98 196 100 207 107 C214 114 212 122 204 126 Z"/>
  <path id="lv" d="M121 147 L146 139 L152 134 L204 126 C213 152 212 196 203 226 C197 242 191 250 185 250 C162 236 134 194 121 147 Z"/>
  <clipPath id="ax-c-ra"><use href="#ra"/></clipPath>
  <clipPath id="ax-c-rv"><use href="#rv"/></clipPath>
  <clipPath id="ax-c-la"><use href="#la"/></clipPath>
  <clipPath id="ax-c-lv"><use href="#lv"/></clipPath>
</defs>

<!-- BEHIND TIER: posterior structures, mixed 30 % toward the panel -->
<g data-part="aorta-descending" fill="none">
  <path d="M190 56 L190 272" stroke="#a97d72" stroke-width="24"/>
  <path d="M190 56 L190 272" stroke="#efd6cc" stroke-width="21"/>
  <path d="M190 56 L190 272" stroke="#d66a5e" stroke-width="15"/>
  <ellipse cx="190" cy="272" rx="12" ry="3.6" fill="#efd6cc" stroke="#a97d72" stroke-width="1"/><ellipse cx="190" cy="272" rx="7.5" ry="2.3" fill="#a5463f"/>
</g>
<g data-part="pulmonary-artery" fill="none">
  <path d="M160 60 L98 60" stroke="#8a4a40" stroke-width="17"/><path d="M160 60 L98 60" stroke="#ecc9bd" stroke-width="14"/><path d="M160 60 L98 60" stroke="#3e5196" stroke-width="9"/>
  <ellipse cx="98" cy="60" rx="2.4" ry="8.5" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/><ellipse cx="98" cy="60" rx="1.3" ry="4.5" fill="#24305e"/>
</g>
<g data-part="vena-cava" fill="none">
  <path d="M40 186 L40 226" stroke="#4a5378" stroke-width="22"/><path d="M40 186 L40 226" stroke="#d6dbe8" stroke-width="20"/><path d="M40 186 L40 226" stroke="#3e5196" stroke-width="17"/>
  <ellipse cx="40" cy="226" rx="11" ry="3.3" fill="#d6dbe8" stroke="#4a5378" stroke-width="1"/><ellipse cx="40" cy="226" rx="8.5" ry="2.4" fill="#24305e"/>
</g>

<!-- ARCH: ascending aorta, arch and its three branches (brachiocephalic largest) -->
<g data-part="aorta" fill="none">
  <path d="M137 26 L131 5" stroke="#8a4a40" stroke-width="15"/><path d="M137 26 L131 5" stroke="#ecc9bd" stroke-width="12.5"/><path d="M137 26 L131 5" stroke="#c8352f" stroke-width="8"/>
  <path d="M157 21 L157 4 M174 25 L179 6" stroke="#8a4a40" stroke-width="11"/><path d="M157 21 L157 4 M174 25 L179 6" stroke="#ecc9bd" stroke-width="8.5"/><path d="M157 21 L157 4 M174 25 L179 6" stroke="#c8352f" stroke-width="5"/>
  <ellipse cx="131" cy="5" rx="7" ry="2.2" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/><ellipse cx="131" cy="5" rx="4" ry="1.3" fill="#7a1a1a"/>
  <ellipse cx="157" cy="4" rx="5.2" ry="1.8" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/><ellipse cx="157" cy="4" rx="2.5" ry="1" fill="#7a1a1a"/>
  <ellipse cx="179" cy="6" rx="5.2" ry="1.8" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/><ellipse cx="179" cy="6" rx="2.5" ry="1" fill="#7a1a1a"/>
  <path d="M129 116 L128 58 C128 36 142 24 159 24 C176 24 190 36 190 56 L190 64" stroke="#8a4a40" stroke-width="27"/>
  <path d="M129 116 L128 58 C128 36 142 24 159 24 C176 24 190 36 190 56 L190 64" stroke="#ecc9bd" stroke-width="24"/>
  <path d="M129 116 L128 58 C128 36 142 24 159 24 C176 24 190 36 190 56 L190 64" stroke="#c8352f" stroke-width="17"/>
  <path d="M123 106 L122.5 60 C122.5 44 133 33 150 30" stroke="#fff" stroke-opacity=".3" stroke-width="2.5" stroke-linecap="round"/>
</g>
<g data-part="vena-cava" fill="none">
  <path d="M62 4 L62 96" stroke="#4a5378" stroke-width="22"/><path d="M62 4 L62 96" stroke="#d6dbe8" stroke-width="20"/><path d="M62 4 L62 96" stroke="#3e5196" stroke-width="17"/>
  <path d="M56 8 L56 84" stroke="#fff" stroke-opacity=".25" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="62" cy="4.5" rx="11" ry="3.3" fill="#d6dbe8" stroke="#4a5378" stroke-width="1"/><ellipse cx="62" cy="4.5" rx="8.5" ry="2.4" fill="#24305e"/>
</g>
<g data-part="pulmonary-veins" fill="none">
  <path d="M238 104 L208 110 M238 126 L208 120" stroke="#4a5378" stroke-width="12"/><path d="M238 104 L208 110 M238 126 L208 120" stroke="#d6dbe8" stroke-width="10.5"/><path d="M238 104 L208 110 M238 126 L208 120" stroke="#c8352f" stroke-width="8"/>
  <ellipse cx="237.6" cy="104" rx="2" ry="5.6" fill="#d6dbe8" stroke="#4a5378" stroke-width="1"/><ellipse cx="237.6" cy="104" rx="1.1" ry="4" fill="#7a1a1a"/>
  <ellipse cx="237.6" cy="126" rx="2" ry="5.6" fill="#d6dbe8" stroke="#4a5378" stroke-width="1"/><ellipse cx="237.6" cy="126" rx="1.1" ry="4" fill="#7a1a1a"/>
</g>

<!-- THE HEART: epicardial rim (exterior, lit once from the upper left) around a flat cut face -->
<g data-part="heart">
  <use href="#sil" fill="none" stroke="#6e3a30" stroke-width="10"/>
  <use href="#sil" fill="none" stroke="url(#ax-epi)" stroke-width="7"/>
  <use href="#sil" fill="url(#ax-cut)" stroke="#a86a5c" stroke-width=".9"/>
</g>
<path data-part="septum" d="M92 166 C104 192 124 214 146 230 L166 240 C150 226 132 192 121 147 Z" fill="#cb8d7b"/>
<path data-part="interatrial-septum" d="M90 100 C102 102 112 108 116 116 L121 147 L92 166 C94 140 94 116 90 100 Z" fill="#cb8d7b"/>

<!-- CAVITIES: flat blood, 2.5-unit endocardial shadow, no speculars -->
<g data-part="ra">
  <rect x="52" y="80" width="20" height="18" fill="#3e5196"/><rect x="30" y="186" width="20" height="10" fill="#3e5196"/>
  <use href="#ra" fill="#3e5196"/>
  <use href="#ra" fill="none" stroke="#24305e" stroke-opacity=".45" stroke-width="5" clip-path="url(#ax-c-ra)"/>
</g>
<g data-part="rv">
  <use href="#rv" fill="#3e5196"/>
  <use href="#rv" fill="none" stroke="#24305e" stroke-opacity=".45" stroke-width="5" clip-path="url(#ax-c-rv)"/>
</g>
<g data-part="la">
  <rect x="204" y="104" width="16" height="10" fill="#c8352f"/><rect x="204" y="116" width="16" height="9" fill="#c8352f"/>
  <use href="#la" fill="#c8352f"/>
  <use href="#la" fill="none" stroke="#8e1e1f" stroke-opacity=".45" stroke-width="5" clip-path="url(#ax-c-la)"/>
</g>
<g data-part="lv">
  <use href="#lv" fill="#c8352f"/>
  <use href="#lv" fill="none" stroke="#8e1e1f" stroke-opacity=".45" stroke-width="5" clip-path="url(#ax-c-lv)"/>
</g>
<g data-part="aortic-root">
  <path d="M118 148 C110 140 110 126 117 117 L116.5 80 L140.5 80 L141 116 C150 122 151 136 149 141 Z" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/>
  <path d="M121 147 C114 139 114 127 120 119 L120 80 L137 80 L138 119 C146 125 147 134 146 139 Z" fill="#c8352f"/>
</g>

<!-- PAPILLARY MUSCLES: cones growing out of the wall, same muscle -->
<g fill="#c98b79" stroke="#8f5546" stroke-width=".9">
  <path d="M80 229 C84 222 87 216 90 211 C93 216 96 223 100 233"/>
  <path d="M209 190 C202 193 197 197 193 201 C198 206 203 210 207 216"/>
  <path d="M170 241 C173 235 176 230 179 225 C183 230 186 238 189 249"/>
</g>
<!-- VALVES (diastole: AV valves open, semilunar valves shut) -->
<g data-part="tricuspid">
  <path d="M44 194 C50 202 58 208 68 212 C59 206 52 199 47 192 Z" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9"/>
  <path d="M92 166 C93 174 94 182 95 190 C92 182 90 174 89 167 Z" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9"/>
  <path d="M68 212 Q80 214 89 212 M68 212 Q79 210 90 211 M68 212 Q80 218 88 214 M95 190 Q101 196 106 197 M95 190 Q101 192 104 192" stroke="#8a6d4e" stroke-width="1" fill="none"/>
</g>
<g data-part="mitral">
  <path d="M152 134 C156 146 160 158 164 170 C161 158 157 146 155.5 133.5 Z" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9"/>
  <path d="M204 126 C203 133 201 140 199 146 C200 140 201 133 200.5 126.5 Z" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9"/>
  <path d="M164 170 Q170 198 179 225 M164 170 Q174 196 180 225 M164 170 Q180 186 193 201 M199 146 Q194 174 193 201 M199 146 Q197 176 194 201" stroke="#8a6d4e" stroke-width="1" fill="none"/>
</g>
<g data-part="aortic-valve" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9">
  <path d="M121 147 Q124 155 133.5 151 Q127 150 121 147 Z"/><path d="M146 139 Q145 148 133.5 151 Q140 147 146 139 Z"/>
</g>

<!-- FRONT TIER: right ventricular outflow tract (infundibulum, anterior, opened), pulmonary valve and trunk -->
<g data-part="pulmonary-trunk" fill="none">
  <path d="M166 88 L162 58" stroke="#8a4a40" stroke-width="22"/><path d="M166 88 L162 58" stroke="#ecc9bd" stroke-width="19"/><path d="M166 88 L162 58" stroke="#3e5196" stroke-width="13"/>
  <path d="M162 60 C176 58 196 58 214 60" stroke="#8a4a40" stroke-width="15"/><path d="M162 60 C176 58 196 58 214 60" stroke="#ecc9bd" stroke-width="12.5"/><path d="M162 60 C176 58 196 58 214 60" stroke="#3e5196" stroke-width="8"/>
  <ellipse cx="214" cy="60" rx="2.3" ry="7.5" fill="#ecc9bd" stroke="#8a4a40" stroke-width="1"/><ellipse cx="214" cy="60" rx="1.2" ry="4" fill="#24305e"/>
  <path d="M157.5 82 L155 62" stroke="#fff" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round"/>
</g>
<g data-part="rvot">
  <path d="M93 198 C93 166 95 132 102 116 C112 98 136 88 160 80 L172 98 C148 106 128 112 123 124 C119 138 119 168 121 198 Z" fill="#d29a88" stroke="#6e3a30" stroke-width="1.4"/>
  <path d="M97.5 206 C97.5 166 99.5 134 105.5 119.5 C115 103 138 94 162 85.5 L169 95.5 C146 103 124 109 118.5 122.5 C115 137 115 168 116.5 206 Z" fill="#3e5196"/>
</g>
<g data-part="pulmonary-valve" fill="#efe1c8" stroke="#8a6d4e" stroke-width=".9">
  <path d="M160 86 Q163 94 166 90 Q163 90 160 86 Z"/><path d="M172.5 84.5 Q171.5 93 166 90 Q169.5 88 172.5 84.5 Z"/>
</g>
</svg>
```

## Animating it by t

Every moving part is a pair of paths with the **same command structure**, so `lerpPath(open, shut, k)`
interpolates them point by point. Hand-matched pairs are listed below; anything else uses `lerpPath`'s
resampling mode (both paths resampled to N points) instead of hand matching.

### Valves

| Part | Open (k = 1) | Shut (k = 0) |
|---|---|---|
| Tricuspid, anterior leaflet | `M44 194 C50 202 58 208 68 212 C59 206 52 199 47 192 Z` | `M44 194 C50 191 60 187 70.5 184.3 C60 186 51 189 47 192 Z` |
| Tricuspid, septal leaflet | `M92 166 C93 174 94 182 95 190 C92 182 90 174 89 167 Z` | `M92 166 C86 172 78 180 70.5 184.3 C78 178 85 172 89 167 Z` |
| Mitral, anterior leaflet | `M152 134 C156 146 160 158 164 170 C161 158 157 146 155.5 133.5 Z` | `M152 134 C162 137 175 137 187.5 134.2 C175 135 162 135 155.5 133.5 Z` |
| Mitral, posterior leaflet | `M204 126 C203 133 201 140 199 146 C200 140 201 133 200.5 126.5 Z` | `M204 126 C199 130 193 133 187.5 134.2 C193 131 198 128 200.5 126.5 Z` |
| Aortic, left cusp | `M121 147 Q116 139 118 129 Q118.5 139 121 147 Z` | `M121 147 Q124 155 133.5 151 Q127 150 121 147 Z` |
| Aortic, right cusp | `M146 139 Q148 131 143 123 Q145 131 146 139 Z` | `M146 139 Q145 148 133.5 151 Q140 147 146 139 Z` |
| Pulmonary, left cusp | `M160 86 Q157.5 78 158.5 70 Q159.5 78 160 86 Z` | `M160 86 Q163 94 166 90 Q163 90 160 86 Z` |
| Pulmonary, right cusp | `M172.5 84.5 Q172.5 76 170.5 69 Q171.5 77 172.5 84.5 Z` | `M172.5 84.5 Q171.5 93 166 90 Q169.5 88 172.5 84.5 Z` |

- Shut atrioventricular leaflets meet **below** the annulus line (normal tenting): coaptation at (70.5,184.3)
  for the tricuspid and (187.5,134.2) for the mitral, offset toward the posterior hinge because the anterior
  leaflet is longer. The shut leaflet bodies bow slightly **toward the ventricle**, as the paths do. No
  leaflet ever crosses the annulus line into the atrium (that would be prolapse).
- Leaflets are thin sails: about 3 units wide at the hinge, tapering to a point; valve fill `P.valve.base`,
  edge `P.valve.line` at 0.9. Never wide wedges.
- Chordae are fans of 2 or 3 lines at 1 unit in `P.valve.line`, from each leaflet tip to a papillary head;
  the tricuspid septal leaflet's chordae go to the **septum**. Slack when open (a quadratic with its control
  3 units toward the apex), taut when shut (straight). The tip end follows the interpolated leaflet tip
  (the third point of each leaflet path).
- Semilunar cusps open lie flat against the sinus wall; shut, their bellies point toward the ventricle and
  meet in the centre of the root.

### Ventricular volume and squeeze (the model contract)

The pressure-volume-loop and frank-starling-cardiac-output hearts use the **left-heart long-axis drawing**
(`mountLeftHeart`, below), not a crop of this section. Both drawings share this contract:

- **The apex is pinned.** In a real heart the apex barely moves and the atrioventricular plane descends
  toward it in systole. The drawing follows that: the annular plane (both annuli and the LA floor) moves
  toward the apex by `d = 5 * squeeze` units; the LA roof, the root above the sinotubular junction and all
  vessels stay fixed. The aria-label does not claim more than this.
- **Short axis carries most of the change.** The cavity at area fraction `a` (cavity area / reference
  full-cavity area) is the reference cavity scaled about the pinned apex by `along = 1 - 0.2 (1 - a)`
  (clamped at 0.8 to 1.05) along the long axis and by `across = a / along` across it. Long-axis shortening is
  at most 20 %, short axis does the rest, as in a real ventricle.
- **Range.** `a` must cover every model volume. As fractions of the normal EDV the model's steady beats
  need 0.39 (normal ESV), 0.32 (inotrope ESV), 0.33 (venodilator ESV) and 1.23 (heart failure EDV)
  (critique 3, measured with `model.js`). Tabulate `areaFor(a)` over **0.30 to 1.25** with 64 samples and
  the shoelace formula, keep it monotonic and invert it as `sizeFor(volume)`; nothing clamps inside the band,
  so the inotrope step visibly empties further than normal.
- **Wall.** Muscle area is conserved. The septum's RV face and the RV are held fixed, so the septum thickens
  toward the LV only and nothing collides with the RV. The free wall's outer contour moves inward only as
  far as conservation requires, with the thickness taken from a table `h(a)` precomputed when the scene is
  built (never solved per frame: an outward offset folds at the concave base corners and the area comes out
  wrong).
- **Squeeze.** A squeeze overlay over the LV wall territory: the wall path filled `P.myo.lo` at opacity
  `0.12 * squeeze`. Gradients are never changed per frame.
- **Test (required).** For every model condition and every volume from its ESV to its EDV: the open leaflet
  tips and the papillary heads stay at least 6 units inside the cavity, and `areaFor(sizeFor(V))` returns
  `V` within 1 %.
- RV: the same method with its own `a`, or held at 1 when only the left heart is taught.

### Conduction overlay (`conduction` option)

Rendered in `cond.png`. In this mode the RVOT is drawn at 18 % opacity (`rvot: 'ghost'`) so the septal
crest shows. Tissue colours are `P.conduction` (`#e2c044` base, `#7a5a00` line), never the noradrenaline
messenger colour.

| Element | Geometry | Placement |
|---|---|---|
| SA node | circle (45,100) r 4.2 | subepicardial, in the lateral RA wall where the SVC meets the RA (sulcus terminalis region), not in the lumen |
| AV node | circle (96,158) r 3.8 | in the atrioventricular septum (triangle of Koch) at the base of the interatrial septum, just above the tricuspid septal hinge |
| Bundle of His | `M96 158 L106 166` | on the crest of the muscular septum |
| Left bundle branch | `M106 166 L119 158 C130 196 156 234 180 250`, early second fascicle `M119 158 C122 188 138 216 160 236` | subendocardial, 3 to 4 units inside the septum from the LV face; fans early |
| Right bundle branch | `M106 166 C106 190 126 212 148 227` | 3 to 4 units inside the septum from the RV face |
| Purkinje, LV | `M182 254 C192 254 201 246 206 230 C215 200 216 160 210 134` (dashed 3 2.5) | just inside the free wall's endocardial edge, never across a cavity |
| Purkinje, RV | `M148 233 C124 240 96 238 75 230 C60 223 52 214 48 206` (dashed) | just inside the RV free wall |

- Atrial spread is a **wave** (a blue wash clipped to both atrial cavities and the interatrial band, growing
  from the SA node). No internodal tracts are drawn, ever.
- Staged activation by t (defaults; a lesson's model timings win): SA (0 to .08), atrial wash (.05 to .3),
  AV pause (.3 to .45, the AV node pulses), His and bundles (.45 to .55, a bright dash travels with
  `stroke-dashoffset`), then the ventricular wash in the true order: **septum first (left to right), then the
  apex, then the free walls from endocardium to epicardium, the base last** (.55 to .8).

### Flow streamlines (`flow` option)

White at 55 % opacity, 3 units wide, round caps, `stroke-dasharray="10 14"` with `stroke-dashoffset`
`= -24 * phase` (phase from t, loops seamlessly). Small chevron heads, never black triangles. Streamlines
never cross a wall.

- Right heart filling: SVC and IVC into the RA, through the open tricuspid toward the RV apex.
- Left heart filling: pulmonary veins into the LA, through the open mitral toward the LV apex.
- Ejection, left: LV apex up the outflow under the anterior mitral leaflet, through the aortic valve, round
  the arch.
- Ejection, right: RV body up the RVOT lumen, through the pulmonary valve, up the trunk.
- Opacity follows the model's inflow and outflow values.

## Level of detail (phone)

The level of detail follows the **rendered** size, not `s`: detail elements carry `ax-d2` (dropped below
about 300 px of picture width) or `ax-d3` (dropped below about 200 px), hidden by a CSS container query on
`.lx-pic` (ART-DIRECTION.md, section 1). The `emphasis` option (for example `['mitral', 'aortic']`) raises
named parts to the outline tier and keeps them at every level.

| Class | Elements |
|---|---|
| always | silhouette and rim, the four cavities, septum, aortic root, RVOT, great vessels, emphasised valves |
| `ax-d2` | chordae beyond one per leaflet, endocardial shadows, vessel highlights, arch branch cut faces |
| `ax-d3` | valves and papillary muscles that are not emphasised, interatrial band, all chordae |

At 155 px (`small.png`) the drawing still reads as a heart: four chambers, septum, apex, arch and the RV to
pulmonary trunk path.

## Labels

- **In-cavity labels** (the textbook convention, allowed by ART-DIRECTION.md section 3): `RA` (66,146),
  `RV` (100,226), `LA` (180,122), `LV` (178,200), in white `.b` with no halo, or the full words at `.sm` where
  the cavity is at least twice the text box. Check `RV` against the chordae at every t.
- **Leader targets** (dots at least 4 units inside the structure): aorta (159,24), pulmonary trunk
  (163,72), aortic valve (133.5,150 shut), pulmonary valve (166,88), mitral (176,150 open, 180,134 shut),
  tricuspid (64,200 open, 70,184 shut), septum (136,200), SVC (62,40), IVC (40,214), pulmonary veins (226,104),
  apex (196,258), SA node (45,100), AV node (96,158), RVOT (108,150).
- At s 1.25 the heart is 300 x 350 and leaves a 160-unit right column (`frame375.png`): enough for
  "Pulmonary trunk" at `.sm b`. At s 1.4 the column is too narrow; the label budget check (section 3) must
  run before the scale is chosen.

## Derived views (for the library builder)

- **Left heart long axis** (`mountLeftHeart`, PV and FS): a **separate drawing** with its own fixed outer
  surface and area table, in the parasternal long-axis arrangement turned to this page's orientation: LA with
  two pulmonary veins, mitral, LV with apex down and to the viewer's right, LV outflow under the anterior
  mitral leaflet, aortic root with sinuses, ascending aorta and arch with the descending limb going behind,
  and the RV as a thin crescent in front of the septum (deoxygenated, 60 % opacity, drawn fixed). It shares
  this recipe's palette, valves, tubes and contract. It is not a crop of the four-chamber section.
- **Anterior exterior** (`heartExterior`): same silhouette and great vessels, with the surface instead of the
  cut: RV and its infundibulum form most of the anterior surface, LV a strip on the viewer's right with the
  apex, RA border on the viewer's left with its appendage over the aortic root, left atrial appendage beside
  the pulmonary trunk. Volume shading on the whole surface (this is an exterior). Coronary arteries as
  1.4-unit vessels in the grooves (anterior interventricular groove from under the pulmonary trunk to near the
  apex; right coronary in the right AV groove). SA node marker at the SVC and RA junction.
- **Icon** (`heartIcon`, 48 x 56): silhouette, arch and pulmonary trunk, one highlight, volume shaded.
