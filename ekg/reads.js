/* Read the EKG - data layer / source of truth.
 * window.ECG_READS = { algorithm (8 steps), teaching, cases (14) }
 * Clinical values are separated from rendering. The 12-lead engine in index.html
 * consumes case.render; it must not improvise morphology. ST values are in mV (1 mm = 0.1 mV).
 * Cases are realistic multi-finding 12-leads, one unambiguous answer per step, drilling all 8 steps:
 *   rhythm (sinus/afib/aflutter/junctional/ventricular), axis (rDom + axisDeg), intervals
 *   (pr/qrsWidth/qrsMorph/qt), chambers (LVH/RVH via rDom, atrial enlargement via chamber:'rae'),
 *   ischemia/infarct + culprit artery (per-lead st in mV).
 * Sourced to LITFL ECG Library, StatPearls/NCBI, ECGpedia, and the Fourth Universal Definition of MI (AHA/ACC).
 */
(function () {
  'use strict';

  // The fixed sequence. Read every EKG in this order, every time.
  // Each step drives both the guided-reveal walkthrough and the scored active-recall quiz.
  var algorithm = [
    {
      id: 'rate', label: 'Rate', n: 1,
      question: 'What is the ventricular rate?',
      how: '300 method: 300 / number of large boxes between R-R (300, 150, 100, 75, 60, 50). 6-second method for irregular rhythms: QRS count in 6 s x 10.',
      options: ['Bradycardic (< 60)', 'Normal (60-100)', 'Tachycardic (> 100)'],
      source: 'https://litfl.com/heart-rate-on-the-ecg/'
    },
    {
      id: 'rhythm', label: 'Rhythm', n: 2,
      question: 'What is the underlying rhythm?',
      how: 'Regular or irregular? P before every QRS, QRS after every P? Normal P axis (upright in II)?',
      options: ['Sinus', 'Atrial fibrillation', 'Atrial flutter', 'Junctional', 'Ventricular'],
      source: 'https://litfl.com/ecg-library/basics/'
    },
    {
      id: 'axis', label: 'Axis', n: 3,
      question: 'What is the QRS axis?',
      how: 'Quadrant method on leads I and aVF. Both up = normal. I up / aVF down = check lead II for LAD. I down / aVF up = RAD. Both down = extreme.',
      options: ['Normal', 'Left axis deviation', 'Right axis deviation', 'Extreme'],
      source: 'https://litfl.com/ecg-axis-interpretation/'
    },
    {
      id: 'intervals', label: 'Intervals', n: 4,
      question: 'Are the intervals normal (PR, QRS, QTc)?',
      how: 'PR 120-200 ms. QRS < 120 ms (>= 120 = bundle branch block). QTc by Bazett: normal <= 440 ms (men) / <= 460 ms (women); > 500 ms is high arrhythmia risk.',
      options: ['All normal', 'PR prolonged', 'QRS wide', 'QTc prolonged'],
      source: 'https://litfl.com/pr-interval-ecg-library/'
    },
    {
      id: 'chambers', label: 'P / Chambers', n: 5,
      question: 'Any chamber enlargement or hypertrophy?',
      how: 'P wave: > 2.5 mm tall = right atrial (P pulmonale); > 120 ms / notched = left atrial (P mitrale). QRS voltage criteria for LVH/RVH; R-wave progression across V1-V6.',
      options: ['None', 'Atrial enlargement', 'LVH', 'RVH'],
      source: 'https://litfl.com/r-wave-ecg-library/'
    },
    {
      id: 'ischemia', label: 'Ischemia / Infarct', n: 6,
      question: 'Is there ST elevation or depression? Which territory?',
      how: 'STE >= 1 mm in 2 contiguous leads (V2-V3: >= 1.5 mm women, >= 2 mm men >= 40, >= 2.5 mm men < 40). Localize by lead group; look for reciprocal depression. Tall R + STD in V1-V3 = posterior.',
      options: ['None', 'Anterior', 'Inferior', 'Lateral', 'Septal', 'Posterior', 'Right ventricular'],
      source: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000617'
    },
    {
      id: 'artery', label: 'Culprit artery', n: 7,
      question: 'If infarcting, which coronary artery is the likely culprit?',
      how: 'Inferior -> RCA (STE III > II + STD in I) or LCx. Anterior/septal -> LAD. Lateral -> LCx or diagonal. Posterior -> RCA or LCx by dominance. STE in aVR -> proximal LAD / left main.',
      options: ['None', 'RCA', 'LAD', 'LCx'],
      source: 'https://litfl.com/inferior-stemi-ecg-library/'
    },
    {
      id: 'impression', label: 'Impression', n: 8,
      question: 'State your one-line impression.',
      how: 'Pull it together the same way every time: rate, rhythm, axis, intervals, then the headline finding.',
      options: null,
      source: 'https://litfl.com/ecg-library/basics/'
    }
  ];

  // Teaching reference content, surfaced inline during the read.
  var teaching = {
    planes: 'Limb leads (I, II, III, aVR, aVL, aVF) view the heart in the FRONTAL plane. Precordial / chest leads (V1-V6) view the HORIZONTAL plane.',
    hexaxial: [
      { lead: 'I', deg: 0 }, { lead: 'II', deg: 60 }, { lead: 'III', deg: 120 },
      { lead: 'aVR', deg: -150 }, { lead: 'aVL', deg: -30 }, { lead: 'aVF', deg: 90 }
    ],
    axisBoundaries: [
      { cls: 'Normal', range: '-30 to +90', leadI: 'up', aVF: 'up' },
      { cls: 'Left axis deviation', range: '-30 to -90', leadI: 'up', aVF: 'down', note: 'Check lead II: up/equiphasic = physiologic; down = pathologic LAD.' },
      { cls: 'Right axis deviation', range: '+90 to +180', leadI: 'down', aVF: 'up' },
      { cls: 'Extreme / Northwest', range: '-90 to +/-180', leadI: 'down', aVF: 'down' }
    ],
    axisNote: 'Source disagreement: LITFL uses -30 as the normal lower bound; some texts use 0. RAD border is sometimes +100 to +110.',
    leadGroups: [
      { group: 'Inferior', leads: 'II, III, aVF' },
      { group: 'Septal', leads: 'V1-V2' },
      { group: 'Anterior', leads: 'V3-V4' },
      { group: 'Lateral', leads: 'I, aVL, V5-V6' }
    ],
    rwave: 'Normal R-wave progression: small r in V1 growing to a dominant R by V6, with the transition zone (R = S) at V3-V4. Poor progression = R <= 3 mm in V3.',
    // Territory -> leads -> artery -> reciprocal (MI localization)
    territories: [
      { name: 'Inferior', ste: 'II, III, aVF', recip: 'aVL, I', artery: 'RCA (~80%) or LCx', teach: 'STE III > II with reciprocal STD in I points to RCA. Watch for bradycardia / AV block.', source: 'https://litfl.com/inferior-stemi-ecg-library/' },
      { name: 'Septal', ste: 'V1-V2', recip: 'usually none', artery: 'LAD (septal branches)', teach: 'STE V1 > 2.5 mm or new RBBB suggests a proximal LAD occlusion.', source: 'https://litfl.com/anterior-myocardial-infarction-ecg-library/' },
      { name: 'Anterior', ste: 'V3-V4', recip: 'usually none', artery: 'LAD', teach: 'Loss of anterior R-wave progression. STE in aVR suggests proximal LAD / left main.', source: 'https://litfl.com/anterior-myocardial-infarction-ecg-library/' },
      { name: 'Lateral', ste: 'I, aVL, V5-V6', recip: 'III, aVF', artery: 'LCx or first diagonal', teach: 'Often subtle. Check high-lateral (I, aVL) and the inferior reciprocal change.', source: 'https://litfl.com/lateral-stemi-ecg-library/' },
      { name: 'Posterior', ste: 'V7-V9 (>= 0.5 mm)', recip: 'V1-V3 (horizontal STD, tall R)', artery: 'RCA or LCx (by dominance)', teach: 'A STEMI equivalent. Tall R + horizontal STD in V1-V3 is the mirror image; confirm with posterior leads V7-V9. The Fourth UDMI reclassifies this as "inferobasal."', source: 'https://litfl.com/posterior-myocardial-infarction-ecg-library/' },
      { name: 'Right ventricular', ste: 'V4R (+ V1)', recip: 'aVL, I', artery: 'proximal RCA', teach: 'Complicates ~40% of inferior STEMIs. Preload-dependent: give fluids, avoid nitrates. Get right-sided leads early; changes are transient.', source: 'https://litfl.com/right-ventricular-infarction-ecg-library/' }
    ],
    steCriteria: 'STEMI: STE at the J point in >= 2 contiguous leads. All leads except V2-V3: >= 1 mm. V2-V3: >= 1.5 mm (women), >= 2 mm (men >= 40), >= 2.5 mm (men < 40). V4R / V7-V9: >= 0.5 mm. Valid only without LVH or LBBB.',
    steSource: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000617'
  };

  // Sourced 12-lead teaching cases. render drives synthLead(); read is the answer key.
  // st: per-lead baseline offset in mV (positive = elevation, negative = depression).
  // pr/qt in ms, qrsWidth in ms, axisDeg in degrees. rDom: per-precordial-lead R dominance overrides.
  var cases = [
    {
      id: 'normal', title: 'Case 1 - Baseline',
      render: { rateBpm: 72, rhythm: 'sinus', axisDeg: 60, pr: 160, qrsWidth: 90, qt: 380, st: {} },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'None', artery: 'None',
        impression: 'Normal sinus rhythm at 72, normal axis and intervals, no acute ST changes. Normal 12-lead ECG.'
      },
      source: 'https://litfl.com/ecg-library/basics/'
    },
    {
      id: 'anterior', title: 'Case 2 - Chest pain, diaphoresis',
      render: {
        rateBpm: 95, rhythm: 'sinus', axisDeg: 30, pr: 160, qrsWidth: 90, qt: 360,
        st: { V2: 0.35, V3: 0.4, V4: 0.3 }, rDom: { V2: -0.2, V3: -0.1, V4: 0.4 }
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Anterior', artery: 'LAD',
        impression: 'Anterior STEMI - ST elevation V2-V4 with poor R-wave progression. Culprit: LAD. Activate the cath lab.'
      },
      source: 'https://litfl.com/anterior-myocardial-infarction-ecg-library/'
    },
    {
      id: 'inferior', title: 'Case 3 - Nausea, bradycardic',
      render: {
        rateBpm: 52, rhythm: 'sinus', axisDeg: 75, pr: 170, qrsWidth: 90, qt: 400,
        st: { II: 0.2, III: 0.3, aVF: 0.25, aVL: -0.15, I: -0.1 }
      },
      read: {
        rate: 'Bradycardic (< 60)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Inferior', artery: 'RCA',
        impression: 'Inferior STEMI - STE II/III/aVF with III > II and reciprocal depression in I and aVL. Culprit: RCA. Get a right-sided V4R.'
      },
      source: 'https://litfl.com/inferior-stemi-ecg-library/'
    },
    {
      id: 'lateral', title: 'Case 4 - Subtle, atypical pain',
      render: {
        rateBpm: 80, rhythm: 'sinus', axisDeg: 20, pr: 150, qrsWidth: 90, qt: 380,
        st: { I: 0.2, aVL: 0.2, V5: 0.2, V6: 0.2, III: -0.1, aVF: -0.1 }
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Lateral', artery: 'LCx',
        impression: 'Lateral STEMI - STE I/aVL/V5-V6 with inferior reciprocal change. Culprit: LCx (or diagonal). Easy to miss.'
      },
      source: 'https://litfl.com/lateral-stemi-ecg-library/'
    },
    {
      id: 'septal', title: 'Case 5 - Crushing chest pain',
      render: {
        rateBpm: 88, rhythm: 'sinus', axisDeg: 45, pr: 160, qrsWidth: 90, qt: 370,
        st: { V1: 0.3, V2: 0.3 }, rDom: { V1: -0.6, V2: -0.2 }
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Septal', artery: 'LAD',
        impression: 'Septal STEMI - STE V1-V2. STE V1 > 2.5 mm raises concern for proximal LAD. Culprit: LAD.'
      },
      source: 'https://litfl.com/anterior-myocardial-infarction-ecg-library/'
    },
    {
      id: 'posterior', title: 'Case 6 - Chest pain, "normal" front',
      render: {
        rateBpm: 84, rhythm: 'sinus', axisDeg: 50, pr: 160, qrsWidth: 90, qt: 380,
        st: { V1: -0.2, V2: -0.25, V3: -0.2 }, rDom: { V1: 0.6, V2: 0.9, V3: 0.6 }
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Posterior', artery: 'RCA|LCx',
        impression: 'Posterior STEMI - tall R + horizontal ST depression V1-V3 (mirror image). A STEMI equivalent. Confirm with V7-V9. Culprit: RCA or LCx.'
      },
      source: 'https://litfl.com/posterior-myocardial-infarction-ecg-library/'
    },
    {
      id: 'rv', title: 'Case 7 - Inferior pattern, hypotensive',
      render: {
        rateBpm: 48, rhythm: 'sinus', axisDeg: 80, pr: 180, qrsWidth: 90, qt: 410,
        st: { II: 0.2, III: 0.3, aVF: 0.25, V1: 0.15, aVL: -0.15, I: -0.1 }
      },
      read: {
        rate: 'Bradycardic (< 60)', rhythm: 'Sinus', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'Right ventricular', artery: 'RCA',
        impression: 'Inferior STEMI with RV involvement - STE III/aVF and STE V1 (with V1 > V2). Confirm with V4R. Culprit: proximal RCA. Fluids, not nitrates.'
      },
      source: 'https://litfl.com/right-ventricular-infarction-ecg-library/'
    },
    {
      id: 'afib-lvh', title: 'Case 8 - Palpitations, hypertensive',
      render: {
        rateBpm: 130, rhythm: 'afib', axisDeg: -45, qrsWidth: 90, qt: 360,
        st: {}, rDom: { V1: -1.4, V2: -1.2, V5: 2.4, V6: 2.2 }
      },
      read: {
        rate: 'Tachycardic (> 100)', rhythm: 'Atrial fibrillation', axis: 'Left axis deviation', intervals: 'All normal',
        chambers: 'LVH', ischemia: 'None', artery: 'None',
        impression: 'Atrial fibrillation with rapid ventricular response (~130), left axis deviation, and LVH by voltage (deep S in V1-V2, tall R in V5-V6). No acute ST changes. Rate control and anticoagulation assessment.'
      },
      source: 'https://litfl.com/atrial-fibrillation-ecg-library/'
    },
    {
      id: 'aflutter-rvh', title: 'Case 9 - Dyspnea, fast and regular',
      render: {
        rateBpm: 150, rhythm: 'aflutter', flutterRate: 300, conduction: 2, axisDeg: 120, qrsWidth: 90, qt: 350,
        st: {}, rDom: { V1: 1.0, V2: 0.4, V5: -0.5, V6: -0.6 }
      },
      read: {
        rate: 'Tachycardic (> 100)', rhythm: 'Atrial flutter', axis: 'Right axis deviation', intervals: 'All normal',
        chambers: 'RVH', ischemia: 'None', artery: 'None',
        impression: 'Atrial flutter with 2:1 conduction (ventricular rate ~150), right axis deviation, and RVH (dominant R in V1). Look for underlying pulmonary or right-heart disease.'
      },
      source: 'https://litfl.com/atrial-flutter-ecg-library/'
    },
    {
      id: 'vt', title: 'Case 10 - Wide, fast, unwell',
      render: {
        rateBpm: 180, rhythm: 'ventricular', qrsMorph: 'wide', axisDeg: -120, qrsWidth: 160, qt: 400, st: {}
      },
      read: {
        rate: 'Tachycardic (> 100)', rhythm: 'Ventricular', axis: 'Extreme', intervals: 'QRS wide',
        chambers: 'None', ischemia: 'None', artery: 'None',
        impression: 'Monomorphic ventricular tachycardia - wide regular tachycardia at ~180 with extreme (northwest) axis and no preceding P waves. Treat as VT until proven otherwise; assess hemodynamic stability.'
      },
      source: 'https://litfl.com/ventricular-tachycardia-monomorphic-ecg-library/'
    },
    {
      id: 'junctional', title: 'Case 11 - Lightheaded, slow',
      render: {
        rateBpm: 45, rhythm: 'junctional', axisDeg: 60, qrsWidth: 90, qt: 400, st: {}
      },
      read: {
        rate: 'Bradycardic (< 60)', rhythm: 'Junctional', axis: 'Normal', intervals: 'All normal',
        chambers: 'None', ischemia: 'None', artery: 'None',
        impression: 'Junctional escape rhythm at ~45 - narrow QRS with no preceding P waves. Consider sinus node dysfunction or high-grade AV block; correlate with symptoms and medications.'
      },
      source: 'https://litfl.com/junctional-escape-rhythm/'
    },
    {
      id: 'avblock1-rae', title: 'Case 12 - Routine pre-op ECG',
      render: {
        rateBpm: 75, rhythm: 'sinus', axisDeg: 60, pr: 260, qrsWidth: 90, qt: 380, chamber: 'rae', st: {}
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'PR prolonged',
        chambers: 'Atrial enlargement', ischemia: 'None', artery: 'None',
        impression: 'Sinus rhythm with first-degree AV block (PR ~260 ms) and right atrial enlargement (tall peaked P waves in II). No acute ischemia. Usually benign in isolation.'
      },
      source: 'https://litfl.com/first-degree-heart-block-ecg-library/'
    },
    {
      id: 'lbbb', title: 'Case 13 - Wide QRS, P before each beat',
      render: {
        rateBpm: 78, rhythm: 'sinus', qrsMorph: 'wide', axisDeg: 0, pr: 160, qrsWidth: 150, qt: 400, st: {}
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'QRS wide',
        chambers: 'None', ischemia: 'None', artery: 'None',
        impression: 'Sinus rhythm with a wide QRS (~150 ms) in a bundle branch block pattern, with appropriate discordant T waves. New LBBB with ischemic symptoms is a STEMI equivalent - get priors and apply Sgarbossa criteria.'
      },
      source: 'https://litfl.com/left-bundle-branch-block-lbbb-ecg-library/'
    },
    {
      id: 'longqt', title: 'Case 14 - Syncope, on new medication',
      render: {
        rateBpm: 70, rhythm: 'sinus', axisDeg: 60, pr: 160, qrsWidth: 90, qt: 520, st: {}
      },
      read: {
        rate: 'Normal (60-100)', rhythm: 'Sinus', axis: 'Normal', intervals: 'QTc prolonged',
        chambers: 'None', ischemia: 'None', artery: 'None',
        impression: 'Sinus rhythm with marked QT prolongation (QTc ~520 ms). High torsades risk - review QT-prolonging drugs and correct electrolytes (K, Mg, Ca).'
      },
      source: 'https://litfl.com/qt-interval/'
    }
  ];

  window.ECG_READS = { algorithm: algorithm, teaching: teaching, cases: cases };
})();
