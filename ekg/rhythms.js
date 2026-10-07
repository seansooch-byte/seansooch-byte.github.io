/* EKG Rhythm Trainer - clinical data layer (source of truth).
 *
 * Criteria sourced from LITFL ECG Library, StatPearls/NCBI Bookshelf,
 * ECGpedia, and AHA/ACLS. Every entry carries its `source` URL.
 * Numbers are expressed as factual interval/rate/morphology data.
 *
 * Calibration the renderer assumes: paper speed 25 mm/s, gain 10 mm/mV.
 * 1 small box = 0.04 s = 0.1 mV. 1 big box = 0.20 s.
 * render durations are in milliseconds, render amplitudes in mV.
 *
 * danger: 'benign' | 'warning' | 'lethal'
 * regularity (render.rhythm): 'regular' | 'irregular' | 'grouped' | 'chaotic'
 */
window.RHYTHMS = [
  /* ---------------- SINUS ---------------- */
  {
    id: 'nsr', name: 'Normal Sinus Rhythm', abbr: 'NSR', category: 'Sinus',
    rate: '60-100 bpm (atrial = ventricular)',
    regularity: 'Regular',
    pWave: 'Normal P before every QRS (upright in I/II, inverted aVR), 1:1',
    pr: '120-200 ms, constant',
    qrs: 'Narrow (<120 ms)',
    defining: 'A normal P before every QRS at 60-100 bpm with a constant PR.',
    significance: 'Normal baseline rhythm.',
    danger: 'benign',
    source: 'https://litfl.com/normal-sinus-rhythm-ecg-library/',
    render: { rateBpm: 75, rhythm: 'regular', p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },
  {
    id: 'sinus-brady', name: 'Sinus Bradycardia', abbr: 'Sinus Brady', category: 'Sinus',
    rate: '<60 bpm (symptomatic often <50)',
    regularity: 'Regular',
    pWave: 'Normal sinus P before every QRS, 1:1',
    pr: '120-200 ms, constant',
    qrs: 'Narrow (<120 ms)',
    defining: 'An otherwise normal sinus rhythm at a rate below 60.',
    significance: 'Often benign (athletes, high vagal tone); pathologic with drugs, ischemia, hypothyroidism.',
    danger: 'benign',
    source: 'https://litfl.com/sinus-bradycardia-ecg-library/',
    render: { rateBpm: 45, rhythm: 'regular', p: { present: true, amp: 0.15, dur: 90 }, pr: 170, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 170 } }
  },
  {
    id: 'sinus-tach', name: 'Sinus Tachycardia', abbr: 'Sinus Tach', category: 'Sinus',
    rate: '>100 bpm (typically up to ~150-160 at rest)',
    regularity: 'Regular',
    pWave: 'Normal sinus P before every QRS; at fast rates P may bury in the prior T wave',
    pr: '120-200 ms (may shorten slightly at high rates)',
    qrs: 'Narrow (<120 ms)',
    defining: 'Normal sinus morphology at a rate above 100; rate tracks physiologic demand.',
    significance: 'Usually reactive (fever, pain, hypovolemia, hypoxia, sepsis); treat the cause.',
    danger: 'benign',
    source: 'https://litfl.com/sinus-tachycardia-ecg-library/',
    render: { rateBpm: 125, rhythm: 'regular', p: { present: true, amp: 0.15, dur: 80 }, pr: 140, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 130 } }
  },
  {
    id: 'sinus-arrhythmia', name: 'Sinus Arrhythmia', abbr: 'Sinus Arrhythmia', category: 'Sinus',
    rate: '60-100 bpm, waxing and waning',
    regularity: 'Regularly irregular (cyclic PP variation, often respiratory)',
    pWave: 'Normal sinus P, constant morphology, one per QRS',
    pr: 'Normal and constant (no progressive change)',
    qrs: 'Narrow (<120 ms)',
    defining: 'PP variation >120 ms with constant P morphology and constant PR.',
    significance: 'Normal physiologic finding, especially in the young and athletes.',
    danger: 'benign',
    source: 'https://litfl.com/sinus-arrhythmia-ecg-library/',
    render: { rateBpm: 70, rhythm: 'irregular', ppVariation: 0.25, respiratory: true, p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },

  /* ---------------- ATRIAL ---------------- */
  {
    id: 'afib', name: 'Atrial Fibrillation', abbr: 'AFib', category: 'Atrial',
    rate: 'Atrial 350-600 (chaotic); ventricular variable, commonly 80-180',
    regularity: 'Irregularly irregular',
    pWave: 'No organized P; fibrillatory (f) waves, fine or coarse; no isoelectric baseline',
    pr: 'Not measurable',
    qrs: 'Narrow (<120 ms) unless pre-existing block/aberrancy',
    defining: 'Irregularly irregular narrow-complex rhythm with no discernible P waves.',
    significance: 'Stroke risk from atrial thrombus (CHA2DS2-VASc); RVR can compromise.',
    danger: 'warning',
    source: 'https://litfl.com/atrial-fibrillation-ecg-library/',
    render: { rateBpm: 110, rhythm: 'irregular', p: { present: false }, fibWaves: 'coarse', qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 150 } }
  },
  {
    id: 'aflutter', name: 'Atrial Flutter', abbr: 'AFlutter', category: 'Atrial',
    rate: 'Atrial ~300 (range 250-350); ventricular per AV ratio (2:1 ~150, 3:1 ~100, 4:1 ~75)',
    regularity: 'Regular (fixed ratio) or irregular (variable conduction)',
    pWave: 'Sawtooth flutter (F) waves at ~300/min; inverted in II/III/aVF (typical), no isoelectric baseline',
    pr: 'Not applicable (use conduction ratio)',
    qrs: 'Narrow (<120 ms)',
    defining: 'Sawtooth flutter waves at ~300/min, classically 2:1 giving a regular ventricular rate ~150.',
    significance: 'Stroke risk like AF; 2:1 flutter is often mistaken for sinus tach at 150.',
    danger: 'warning',
    source: 'https://litfl.com/atrial-flutter-ecg-library/',
    render: { rateBpm: 150, rhythm: 'regular', p: { present: false }, flutterRate: 300, conduction: 2, qrs: { width: 90, amp: 1.0 }, t: { amp: 0.20, dur: 140 } }
  },
  {
    id: 'pac', name: 'Premature Atrial Complex', abbr: 'PAC', category: 'Atrial',
    rate: 'Underlying rhythm rate; PAC is a single early beat',
    regularity: 'Underlying regular, interrupted by the early beat',
    pWave: 'Early, abnormal (non-sinus) P; may flatten/peak or bury in prior T',
    pr: '>=120 ms when P visible (contrast PJC <120 ms)',
    qrs: 'Narrow when conducted; may be aberrant (RBBB) if very early; blocked PAC = P with no QRS',
    defining: 'Early beat with an abnormal P, followed by a non-compensatory (incomplete) pause.',
    significance: 'Benign and common; can initiate atrial tachyarrhythmias.',
    danger: 'benign',
    source: 'https://litfl.com/premature-atrial-complex-pac/',
    render: { rateBpm: 75, rhythm: 'regular', ectopic: { type: 'pac', every: 6, pause: 'noncompensatory' }, p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },
  {
    id: 'mat', name: 'Multifocal Atrial Tachycardia', abbr: 'MAT', category: 'Atrial',
    rate: '>100 bpm (typically 100-150)',
    regularity: 'Irregularly irregular',
    pWave: 'At least 3 distinct P morphologies in one lead; isoelectric baseline between',
    pr: 'Variable (multiple atrial foci)',
    qrs: 'Narrow; occasional nonconducted or aberrant',
    defining: '>=3 distinct P morphologies + rate >100 + irregularly irregular + isoelectric baseline.',
    significance: 'Marker of severe illness, classically COPD/CHF; treat the underlying disorder.',
    danger: 'warning',
    source: 'https://litfl.com/multifocal-atrial-tachycardia-mat-ecg-library/',
    render: { rateBpm: 130, rhythm: 'irregular', p: { present: true, multifocal: 3, amp: 0.15, dur: 90 }, pr: 'variable', qrs: { width: 90, amp: 1.2 }, t: { amp: 0.25, dur: 140 } }
  },
  {
    id: 'wap', name: 'Wandering Atrial Pacemaker', abbr: 'WAP', category: 'Atrial',
    rate: 'Normal (60-100 bpm)',
    regularity: 'Mildly irregular',
    pWave: 'At least 3 different P morphologies as the pacemaker migrates',
    pr: 'Variable beat to beat',
    qrs: 'Narrow (0.06-0.10 s)',
    defining: '>=3 P morphologies at a normal rate (<=100). Rate is the sole differentiator from MAT.',
    significance: 'Benign; young, elderly, athletes (high vagal tone).',
    danger: 'benign',
    source: 'https://en.ecgpedia.org/wiki/Wandering_Pacemaker',
    render: { rateBpm: 75, rhythm: 'irregular', p: { present: true, multifocal: 3, amp: 0.15, dur: 90 }, pr: 'variable', qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },

  /* ---------------- AV NODAL / SVT ---------------- */
  {
    id: 'svt-avnrt', name: 'SVT (AVNRT)', abbr: 'SVT', category: 'Supraventricular',
    rate: '140-280 bpm (commonly ~150-250)',
    regularity: 'Regular',
    pWave: 'Retrograde P usually buried in QRS; pseudo-R′ in V1, pseudo-S in II/III/aVF',
    pr: 'Not measurable',
    qrs: 'Narrow (<120 ms) unless aberrancy',
    defining: 'Abrupt regular narrow-complex tachy ~150-250 with no visible P.',
    significance: 'Usually stable; terminated by vagal maneuvers / adenosine.',
    danger: 'warning',
    source: 'https://litfl.com/supraventricular-tachycardia-svt-ecg-library/',
    render: { rateBpm: 180, rhythm: 'regular', p: { present: false, pseudo: true }, qrs: { width: 90, amp: 1.1 }, t: { amp: 0.25, dur: 110 } }
  },

  /* ---------------- JUNCTIONAL ---------------- */
  {
    id: 'junctional', name: 'Junctional Escape Rhythm', abbr: 'Junctional', category: 'Junctional',
    rate: '40-60 bpm',
    regularity: 'Regular',
    pWave: 'Absent, inverted (retrograde), or hidden; if visible, inverted in II/III/aVF',
    pr: 'Short (<120 ms) if retrograde P precedes QRS; else none',
    qrs: 'Narrow (<120 ms)',
    defining: 'Regular narrow-complex rhythm at 40-60 bpm with absent/inverted/retrograde P.',
    significance: 'Safety-net escape; suggests SA node dysfunction, vagal tone, or drug effect.',
    danger: 'warning',
    source: 'https://litfl.com/junctional-escape-rhythm-ecg-library/',
    render: { rateBpm: 50, rhythm: 'regular', p: { present: true, inverted: true, amp: 0.10, dur: 80, position: 'pre' }, pr: 90, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 170 } }
  },
  {
    id: 'pjc', name: 'Premature Junctional Complex', abbr: 'PJC', category: 'Junctional',
    rate: 'Underlying rhythm rate; PJC is a single early beat',
    regularity: 'Underlying regular, interrupted by early junctional beat',
    pWave: 'Absent or retrograde (inverted), before/during/after QRS',
    pr: '<120 ms if retrograde P precedes QRS (contrast PAC >=120 ms)',
    qrs: 'Narrow, matching sinus beats; may be aberrant if very early',
    defining: 'Early narrow QRS with no normal preceding P, usually a compensatory pause.',
    significance: 'Usually benign; may reflect digoxin toxicity or high catecholamines.',
    danger: 'benign',
    source: 'https://litfl.com/premature-junctional-complex-pjc/',
    render: { rateBpm: 75, rhythm: 'regular', ectopic: { type: 'pjc', every: 6, pause: 'compensatory' }, p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },

  /* ---------------- AV BLOCK ---------------- */
  {
    id: 'avb1', name: 'First-Degree AV Block', abbr: '1° AVB', category: 'AV Block',
    rate: 'Per underlying sinus rhythm (usually 60-100)',
    regularity: 'Regular',
    pWave: 'Normal; every P conducts (1:1), none dropped',
    pr: 'Prolonged >200 ms, fixed (marked if >300 ms)',
    qrs: 'Usually narrow (<120 ms)',
    defining: 'Constant PR >200 ms with no dropped beats.',
    significance: 'Benign in isolation; no treatment needed.',
    danger: 'benign',
    source: 'https://litfl.com/first-degree-heart-block-ecg-library/',
    render: { rateBpm: 70, rhythm: 'regular', p: { present: true, amp: 0.15, dur: 90 }, pr: 260, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },
  {
    id: 'avb2-mobitz1', name: 'Second-Degree AV Block, Mobitz I (Wenckebach)', abbr: 'Mobitz I', category: 'AV Block',
    rate: 'Atrial regular; ventricular slightly slower (dropped beats)',
    regularity: 'Regularly irregular (grouped beating)',
    pWave: 'Constant-rate P waves; periodically one P not followed by QRS (3:2, 4:3, 5:4)',
    pr: 'Progressively lengthens until a P is dropped, then resets',
    qrs: 'Usually narrow (block at AV node)',
    defining: 'Progressive PR prolongation culminating in a dropped QRS, then repeats.',
    significance: 'Usually benign/functional; rarely needs pacing.',
    danger: 'warning',
    source: 'https://litfl.com/av-block-2nd-degree-mobitz-i-wenckebach-phenomenon/',
    render: { rateBpm: 65, rhythm: 'grouped', block: { type: 'wenckebach', ratio: '4:3', prStart: 160, prIncrement: 60 }, p: { present: true, amp: 0.15, dur: 90 }, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 } }
  },
  {
    id: 'avb2-mobitz2', name: 'Second-Degree AV Block, Mobitz II', abbr: 'Mobitz II', category: 'AV Block',
    rate: 'Atrial regular; ventricular slower, irregular per dropped beats',
    regularity: 'Regular P-P; ventricular regular if fixed ratio',
    pWave: 'Constant-rate P; intermittent non-conducted P with NO PR change',
    pr: 'Constant on conducted beats (no progressive lengthening)',
    qrs: 'Often broad (~75%) - block distal to His; narrow in ~25%',
    defining: 'Sudden dropped QRS with a constant PR interval (no warning lengthening).',
    significance: 'Dangerous; high risk of progression to complete block; usually needs a pacemaker.',
    danger: 'warning',
    source: 'https://litfl.com/av-block-2nd-degree-mobitz-ii-hay-block/',
    // 4:3 (three conducted, one dropped without PR change). Was '3:1', which drew one QRS per three P waves:
    // that is high-grade (advanced) AV block, not the intermittent drop this entry teaches. Fixed 2026-09-23.
    render: { rateBpm: 60, rhythm: 'grouped', block: { type: 'mobitz2', ratio: '4:3' }, p: { present: true, amp: 0.15, dur: 90 }, pr: 180, qrs: { width: 130, amp: 1.0, morph: 'wide' }, t: { amp: 0.30, dur: 170 } }
  },
  {
    id: 'avb3', name: 'Third-Degree (Complete) AV Block', abbr: '3° AVB', category: 'AV Block',
    rate: 'Atrial ~60-100; ventricular = escape (junctional 40-60, ventricular 20-40)',
    regularity: 'Regular P-P and regular R-R, but independent of each other',
    pWave: 'Present at sinus rate, fully dissociated from QRS (no fixed PR)',
    pr: 'No relationship (complete AV dissociation)',
    qrs: 'Narrow if junctional escape; wide if ventricular escape',
    defining: 'Complete AV dissociation - P and QRS march at their own independent rates.',
    significance: 'Dangerous; risk of ventricular standstill; urgent pacing.',
    danger: 'lethal',
    source: 'https://litfl.com/av-block-3rd-degree-complete-heart-block/',
    render: { rateBpm: 38, rhythm: 'dissociated', atrialRate: 80, p: { present: true, amp: 0.15, dur: 90 }, qrs: { width: 130, amp: 1.0, morph: 'wide' }, t: { amp: 0.30, dur: 180 } }
  },

  /* ---------------- VENTRICULAR ---------------- */
  {
    id: 'pvc', name: 'Premature Ventricular Complex', abbr: 'PVC', category: 'Ventricular',
    rate: 'Underlying rhythm rate; PVC is a single early ectopic beat',
    regularity: 'Underlying regular, interrupted by the early wide beat (bigeminy/trigeminy/couplet patterns)',
    pWave: 'No preceding (premature) P; may show retrograde P after QRS',
    pr: 'Not applicable',
    qrs: 'Wide (>=120 ms), abnormal; T wave usually discordant',
    defining: 'Early WIDE QRS with NO preceding P, followed by a full compensatory pause.',
    significance: 'Usually benign; R-on-T with long QT can trigger VT/torsades.',
    danger: 'benign',
    source: 'https://litfl.com/premature-ventricular-complex-pvc-ecg-library/',
    render: { rateBpm: 75, rhythm: 'regular', ectopic: { type: 'pvc', every: 6, pause: 'compensatory' }, p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 90, amp: 1.2 }, t: { amp: 0.30, dur: 160 }, pvcQrs: { width: 150, amp: 1.8, discordantT: true } }
  },
  {
    id: 'vt', name: 'Monomorphic Ventricular Tachycardia', abbr: 'VT', category: 'Ventricular',
    rate: '100-250 bpm (commonly ~120-200)',
    regularity: 'Regular (or near-regular)',
    pWave: 'Often not visible; AV dissociation if present (independent slower P)',
    pr: 'No consistent relationship',
    qrs: 'Wide (>=120 ms), often >160 ms; uniform morphology',
    defining: 'Regular wide-complex tachy with uniform QRS; supportive: AV dissociation, capture/fusion beats.',
    significance: 'Dangerous; can be pulseless (shockable) or degenerate to VF.',
    danger: 'lethal', shockable: true,
    source: 'https://litfl.com/ventricular-tachycardia-monomorphic-ecg-library/',
    render: { rateBpm: 180, rhythm: 'regular', p: { present: false }, qrs: { width: 180, amp: 1.8, morph: 'wide' }, t: { amp: 0.40, dur: 160, discordant: true } }
  },
  {
    id: 'torsades', name: 'Torsades de Pointes (Polymorphic VT)', abbr: 'Torsades', category: 'Ventricular',
    rate: '~200-250 bpm',
    regularity: 'Irregular; cyclically varying',
    pWave: 'Not identifiable during the run',
    pr: 'Not applicable',
    qrs: 'Wide, continuously varying amplitude/axis/morphology, twisting around the baseline',
    defining: 'Polymorphic VT on a background of QT prolongation; complexes appear to twist around the isoelectric line.',
    significance: 'Dangerous; often self-terminating but can degenerate to VF. Treat with IV magnesium.',
    danger: 'lethal', shockable: true,
    source: 'https://litfl.com/polymorphic-vt-and-torsades-de-pointes-tdp/',
    render: { rateBpm: 230, rhythm: 'torsades', p: { present: false }, qrs: { width: 160, amp: 1.6, morph: 'wide' }, twistPeriodBeats: 8 }
  },
  {
    id: 'aivr', name: 'Accelerated Idioventricular Rhythm', abbr: 'AIVR', category: 'Ventricular',
    rate: '40-120 bpm (the "accelerated" band; common variant 50-110)',
    regularity: 'Regular (may vary at onset/offset)',
    pWave: 'Absent, retrograde, or AV-dissociated; fusion/capture beats common',
    pr: 'None (no consistent A-V relationship)',
    qrs: 'Wide (>120 ms)',
    defining: 'Regular wide-complex rhythm at 40-120 bpm with AV dissociation and fusion/capture beats.',
    significance: 'Usually benign and self-limited; classic reperfusion marker after STEMI/lysis.',
    danger: 'warning',
    source: 'https://litfl.com/accelerated-idioventricular-rhythm-aivr/',
    render: { rateBpm: 75, rhythm: 'regular', p: { present: false }, fusionBeats: true, qrs: { width: 140, amp: 1.6, morph: 'wide' }, t: { amp: 0.35, dur: 170, discordant: true } }
  },
  {
    id: 'idioventricular', name: 'Idioventricular / Agonal Rhythm', abbr: 'Idioventricular', category: 'Ventricular',
    rate: 'Idioventricular escape 20-40 bpm; agonal <20 bpm',
    regularity: 'Escape regular; agonal irregular/dying',
    pWave: 'Absent',
    pr: 'None',
    qrs: 'Wide and bizarre (>=120 ms), increasingly broad as it deteriorates',
    defining: 'Very slow, wide, bizarre complexes with no atrial activity - last activity before asystole.',
    significance: 'Pre-terminal/peri-arrest; agonal is typically pulseless (a form of PEA).',
    danger: 'lethal',
    source: 'https://litfl.com/ventricular-escape-rhythm-ecg-library/',
    render: { rateBpm: 28, rhythm: 'regular', p: { present: false }, qrs: { width: 180, amp: 1.0, morph: 'bizarre' }, t: { amp: 0.30, dur: 200, discordant: true } }
  },

  /* ---------------- ARREST ---------------- */
  {
    id: 'vf', name: 'Ventricular Fibrillation', abbr: 'VF', category: 'Arrest',
    rate: '~150-500 (disorganized, uncountable)',
    regularity: 'Chaotic / irregular',
    pWave: 'None (no identifiable P, QRS, or T)',
    pr: 'Not applicable',
    qrs: 'None identifiable',
    defining: 'Chaotic irregular baseline of varying amplitude; coarse VF progressing to fine VF.',
    significance: 'Pulseless arrest; the key shockable rhythm - immediate defibrillation + ACLS.',
    danger: 'lethal', shockable: true,
    source: 'https://litfl.com/ventricular-fibrillation-vf-ecg-library/',
    render: { rhythm: 'chaotic', amplitude: 'coarse', p: { present: false } }
  },
  {
    id: 'asystole', name: 'Asystole', abbr: 'Asystole', category: 'Arrest',
    rate: '0 (no ventricular activity)',
    regularity: 'Not applicable',
    pWave: 'Absent (rarely isolated P = "P-wave asystole")',
    pr: 'Not applicable',
    qrs: 'Absent',
    defining: 'Flat (near-isoelectric) line; confirm in two leads and exclude lead disconnection.',
    significance: 'Non-shockable arrest; CPR + epinephrine per ACLS; poor prognosis.',
    danger: 'lethal', shockable: false,
    source: 'https://www.ncbi.nlm.nih.gov/books/NBK568774/',
    render: { rhythm: 'flat', wander: 0.02, p: { present: false } }
  },
  {
    id: 'pea', name: 'Pulseless Electrical Activity', abbr: 'PEA', category: 'Arrest',
    rate: 'Any (PEA is not a specific waveform)',
    regularity: 'Any organized or partly organized rhythm',
    pWave: 'Variable - depends on the underlying displayed rhythm',
    pr: 'Variable',
    qrs: 'Variable (can look like NSR, bradycardia, or wide idioventricular)',
    defining: 'Organized electrical activity on the ECG with NO palpable pulse (a clinical, not ECG, finding).',
    significance: 'Cardiac arrest; ACLS PEA arm - CPR + epinephrine + treat the Hs and Ts.',
    danger: 'lethal', shockable: false,
    teachingOverlay: true,
    source: 'https://litfl.com/pulseless-electrical-activity/',
    render: { rhythm: 'regular', rateBpm: 50, noPulseFlag: true, p: { present: true, amp: 0.12, dur: 90 }, pr: 170, qrs: { width: 120, amp: 0.9 }, t: { amp: 0.25, dur: 180 } }
  },

  /* ---------------- CONDUCTION / MORPHOLOGY (best shown in one lead) ---------------- */
  {
    id: 'rbbb', name: 'Right Bundle Branch Block', abbr: 'RBBB', category: 'Conduction',
    rate: 'Per underlying (usually sinus) rhythm',
    regularity: 'Per underlying rhythm',
    pWave: 'Per underlying rhythm',
    pr: 'Per underlying rhythm',
    qrs: 'Complete >120 ms; rsR′ "M" pattern in V1, slurred S in I/V6',
    defining: 'QRS >120 ms with rsR′ (M-pattern) in V1 and a slurred S in I/V6.',
    significance: 'Often benign; new RBBB with chest pain can signal proximal LAD occlusion.',
    danger: 'benign',
    leadNote: '12-lead diagnosis; best shown on a strip in lead V1 (rsR′ M-pattern).',
    source: 'https://litfl.com/right-bundle-branch-block-rbbb-ecg-library/',
    render: { rateBpm: 75, rhythm: 'regular', lead: 'V1', p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 130, amp: 1.2, morph: 'rsr-prime' }, t: { amp: -0.20, dur: 160 } }
  },
  {
    id: 'lbbb', name: 'Left Bundle Branch Block', abbr: 'LBBB', category: 'Conduction',
    rate: 'Per underlying rhythm',
    regularity: 'Per underlying rhythm',
    pWave: 'Per underlying rhythm',
    pr: 'Per underlying rhythm',
    qrs: 'Complete >=120 ms; broad notched monophasic R in I/V6, dominant S (QS/rS) in V1',
    defining: 'QRS >=120 ms with broad notched R in I/V6 and dominant S in V1.',
    significance: 'Usually structural disease; new LBBB + chest pain -> use Sgarbossa criteria.',
    danger: 'warning',
    leadNote: '12-lead diagnosis; best shown on a strip in V6 or lead I (broad notched R).',
    source: 'https://litfl.com/left-bundle-branch-block-lbbb-ecg-library/',
    render: { rateBpm: 75, rhythm: 'regular', lead: 'V6', p: { present: true, amp: 0.15, dur: 90 }, pr: 160, qrs: { width: 140, amp: 1.6, morph: 'notched-r' }, t: { amp: -0.30, dur: 180 } }
  },
  {
    id: 'wpw', name: 'Wolff-Parkinson-White (Pre-excitation)', abbr: 'WPW', category: 'Conduction',
    rate: 'Underlying sinus rhythm during baseline pre-excitation',
    regularity: 'Per underlying rhythm',
    pWave: 'Normal sinus P',
    pr: 'Short (<120 ms)',
    qrs: 'Widened (>110-120 ms) with a delta wave (slurred upstroke)',
    defining: 'The triad: short PR (<120 ms) + delta wave + wide QRS (>110-120 ms).',
    significance: 'Predisposes to AVRT and dangerous pre-excited AF; AV-nodal blockers are hazardous in pre-excited AF.',
    danger: 'warning',
    leadNote: '12-lead pattern; best shown on a strip in a lead with a clear slurred delta upstroke (e.g. V1 for Type A/B polarity).',
    source: 'https://litfl.com/pre-excitation-syndromes-ecg-library/',
    render: { rateBpm: 75, rhythm: 'regular', p: { present: true, amp: 0.15, dur: 90 }, pr: 90, qrs: { width: 130, amp: 1.4, morph: 'delta' }, t: { amp: -0.20, dur: 170 } }
  },

  /* ---------------- PACED ---------------- */
  {
    id: 'paced', name: 'Paced Rhythm', abbr: 'Paced', category: 'Paced',
    rate: 'Device-set (commonly ~60-70 bpm lower rate)',
    regularity: 'Regular when fully paced',
    pWave: 'Atrial pacing: spike before paced P. VVI: native P may be dissociated',
    pr: 'AV-sequential (DDD): programmed AV delay between atrial and ventricular spikes',
    qrs: 'Paced QRS is wide with LBBB morphology (RV apex lead) and left axis',
    defining: 'Sharp vertical pacing spikes before P (atrial), QRS (ventricular), or both (AV-sequential).',
    significance: 'Indicates a pacemaker; recognizing normal capture is the baseline for spotting malfunction.',
    danger: 'benign',
    source: 'https://litfl.com/pacemaker-rhythms-normal-patterns/',
    render: { rateBpm: 70, rhythm: 'regular', mode: 'ventricular', spike: { amp: 2.0, dur: 6 }, p: { present: false }, qrs: { width: 150, amp: 1.6, morph: 'paced-lbbb' }, t: { amp: -0.30, dur: 180 } }
  }
];
