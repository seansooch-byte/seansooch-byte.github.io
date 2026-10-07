/* Read the CXR - data layer / source of truth.
 * window.CXR_READS = { algorithm (8 steps), teaching, cases }
 * Clinical truth is separated from rendering. The schematic SVG engine in index.html
 * consumes case.render; it must not improvise morphology - every finding it draws is
 * a value in the case data, never inferred.
 * Read order is "outside-in", the way films are read on the wards: quality first, then
 * the periphery (bones/soft tissue, easy to miss), then airway, then down and in through
 * lungs, heart/mediastinum, and diaphragm, then lines/devices, then the impression.
 * Cases are realistic multi-finding films, one unambiguous answer per step.
 * Sourced to the Radiology Masterclass CXR tutorials, Radiopaedia, LITFL, and StatPearls.
 */
(function () {
  'use strict';

  // The fixed sequence. Read every chest film in this order, every time.
  var algorithm = [
    {
      n: 1, id: 'adequacy', label: 'Adequacy',
      question: 'Is the film adequate to interpret?',
      how: 'RIPE: Rotation (spinous processes midway between the clavicular heads), Inspiration (8-10 posterior ribs above the diaphragm), Picture/penetration (vertebrae faintly visible behind the heart), Exposure/projection (PA vs AP - heart size is only reliable on PA).',
      options: ['Adequate', 'Inadequate - rotated', 'Inadequate - poor inspiration', 'Inadequate - underpenetrated'],
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_quality/chest_xray_quality_projection'
    },
    {
      n: 2, id: 'periphery', label: 'Periphery',
      question: 'Soft tissues and bones - anything abnormal at the edges?',
      how: 'Start outside the lung fields, where findings are easily missed: clavicles, ribs, scapulae, shoulders, and the soft tissues of the chest wall and neck. Look for fractures, lucency (subcutaneous emphysema/gas), masses, and surgical changes.',
      options: ['Normal bones and soft tissues', 'Rib fracture', 'Subcutaneous emphysema', 'Shoulder/clavicle abnormality'],
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_home_anatomy/chest_anatomy_start'
    },
    {
      n: 3, id: 'airway', label: 'Airway',
      question: 'Is the trachea central, and are the airways normal?',
      how: 'Trace the trachea from the neck to the carina. It should sit central or just slightly right of midline at the aortic knob. Deviation points toward volume loss (pulled toward) or a space-occupying process such as a large pneumothorax or effusion (pushed away).',
      options: ['Trachea central, no deviation', 'Tracheal deviation to the left', 'Tracheal deviation to the right', 'Trachea central but bronchi abnormal'],
      source: 'https://radiopaedia.org/articles/tracheal-deviation'
    },
    {
      n: 4, id: 'lungs', label: 'Lungs',
      question: 'Are the lung fields and pleura normal?',
      how: 'Compare the zones side to side, top to bottom. Look for consolidation (opacity with air bronchograms), masses/nodules, interstitial markings (edema), and the pleura - a visible visceral pleural line with absent peripheral markings is a pneumothorax.',
      options: ['Clear lung fields bilaterally', 'Left lower lobe consolidation', 'Right lower lobe consolidation', 'Right middle lobe consolidation', 'Right pneumothorax', 'Left pneumothorax', 'Bilateral interstitial edema', 'Pulmonary mass'],
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_pathology/chest_pathology_lung_disease'
    },
    {
      n: 5, id: 'heart', label: 'Heart & mediastinum',
      question: 'Is the cardiomediastinal silhouette normal?',
      how: 'Cardiothoracic ratio (widest heart / widest thorax) should be under 0.5 on a PA film. Check the heart borders are sharp and the mediastinum is not widened. Heart size cannot be judged reliably on an AP or rotated film.',
      options: ['Normal heart size and borders', 'Cardiomegaly (CTR > 0.5)', 'Cannot assess - AP/rotated film', 'Widened mediastinum'],
      source: 'https://radiopaedia.org/articles/cardiothoracic-ratio'
    },
    {
      n: 6, id: 'diaphragm', label: 'Diaphragm',
      question: 'Are the diaphragm and costophrenic angles normal?',
      how: 'Both hemidiaphragms should be dome-shaped with sharp costophrenic angles (the right usually sits slightly higher than the left). Blunting suggests pleural fluid; a lucent crescent of gas under the diaphragm on an erect film is free intraperitoneal air.',
      options: ['Sharp costophrenic angles, no free air', 'Blunted costophrenic angle (effusion)', 'Free air under the diaphragm', 'Hemidiaphragm elevated'],
      source: 'https://radiopaedia.org/articles/pneumoperitoneum'
    },
    {
      n: 7, id: 'lines', label: 'Lines & devices',
      question: 'Are any lines, tubes, or devices present and correctly positioned?',
      how: 'Account for every device. ETT tip should sit 3-5 cm above the carina; an NG tube should pass below the diaphragm into the stomach; central line tip at the cavoatrial junction. Malposition is a common and important finding.',
      options: ['No lines, tubes, or devices', 'ETT correctly positioned', 'ETT in right main bronchus', 'Central venous catheter', 'NG tube', 'Chest tube'],
      source: 'https://radiopaedia.org/articles/endotracheal-tube'
    },
    {
      n: 8, id: 'impression', label: 'Impression',
      question: 'Pull it together: what is the read?',
      how: 'State the single most important finding first, then secondary findings, then what the film does not show. Close the loop with the clinical implication or the next step.',
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_home_anatomy/chest_anatomy_start'
    }
  ];

  var teaching = {
    approach: 'Read every film the same way, outside-in. Check quality first (a film you cannot trust is not worth interpreting), then deliberately look at the periphery - the bones and soft tissues - before your eye is pulled to the lungs. Then work down and in: airway, lungs, heart and mediastinum, diaphragm. Finish by accounting for every line and device. The order matters more than speed: it is what stops you from satisfaction-of-search misses.',
    ripe: [
      { k: 'Rotation', v: 'The spinous processes should sit midway between the medial ends of the clavicles. If not, the patient is rotated and the mediastinum/heart will look distorted.' },
      { k: 'Inspiration', v: 'Count 8-10 posterior ribs (or 5-6 anterior) above the diaphragm. Fewer means a poor inspiratory effort, which crowds the markings and falsely enlarges the heart.' },
      { k: 'Picture / penetration', v: 'The lower thoracic vertebrae should be just visible through the heart. Too white = underpenetrated; too black = overpenetrated.' },
      { k: 'Exposure / projection', v: 'PA is the standard erect film. AP (often portable/supine) magnifies the heart, so cardiomegaly cannot be called on an AP film.' }
    ],
    signs: [
      { name: 'Silhouette sign', meaning: 'Loss of a normal border (heart, diaphragm) means the adjacent opacity is in contact with it, which localizes the pathology to a specific lobe.' },
      { name: 'Air bronchogram', meaning: 'Air-filled bronchi outlined by surrounding airspace opacity - a marker of consolidation rather than collapse.' },
      { name: 'Meniscus', meaning: 'A concave-up fluid level at the costophrenic angle that rises laterally, the classic look of a free-flowing pleural effusion on an erect film.' },
      { name: 'Deep sulcus / pleural line', meaning: 'A visible visceral pleural line with no lung markings beyond it is a pneumothorax; on a supine film it shows as an abnormally deep, lucent costophrenic sulcus.' }
    ],
    reviewAreas: 'Before you sign off, deliberately revisit the areas that hide pathology: the lung apices, behind the heart (retrocardiac), the costophrenic angles, below the diaphragm, and the bones. Most missed findings live in these blind spots.'
  };

  // Each case: render params consumed by the SVG engine, and a read key per step.
  var cases = [
    {
      id: 'normal',
      title: 'Routine pre-op film, asymptomatic',
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_home_anatomy/chest_normal_anatomy',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.45, mediastinum: 'normal', gastricBubble: true, lines: []
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Normal chest radiograph. Adequate PA film, clear lungs, normal cardiomediastinal silhouette, and sharp costophrenic angles.'
      }
    },
    {
      id: 'lll-pneumonia',
      title: 'Fever, productive cough, left-sided crackles',
      source: 'https://radiopaedia.org/articles/lobar-pneumonia',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.46, mediastinum: 'normal', gastricBubble: true, lines: [],
        consolidation: { side: 'L', zone: 'lower', silhouette: 'diaphragm' }
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Left lower lobe consolidation',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Left lower lobe pneumonia. Airspace consolidation in the left lower zone with air bronchograms and loss of the medial left hemidiaphragm border; no effusion. Correlate clinically and treat.'
      }
    },
    {
      id: 'tension-ptx',
      title: 'Sudden dyspnea and chest pain after a fall, hypotensive',
      source: 'https://radiopaedia.org/articles/tension-pneumothorax',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'left', ctr: 0.45, mediastinum: 'shift-left', gastricBubble: true, lines: [],
        pneumothorax: { side: 'R', size: 'tension' }, subcutaneousEmphysema: 'R'
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Subcutaneous emphysema',
        airway: 'Tracheal deviation to the left',
        lungs: 'Right pneumothorax',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Right tension pneumothorax. Large right pneumothorax with contralateral tracheal and mediastinal shift and chest-wall surgical emphysema - a clinical emergency requiring immediate needle decompression, not further imaging.'
      }
    },
    {
      id: 'left-effusion',
      title: 'Progressive breathlessness, dullness to percussion at the left base',
      source: 'https://radiopaedia.org/articles/pleural-effusion',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.47, mediastinum: 'normal', gastricBubble: true, lines: [],
        effusion: { side: 'L', size: 'moderate' }
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Normal heart size and borders',
        diaphragm: 'Blunted costophrenic angle (effusion)',
        lines: 'No lines, tubes, or devices',
        impression: 'Moderate left pleural effusion. Blunting of the left costophrenic angle with a rising lateral meniscus and basal homogeneous opacity; no focal consolidation. Consider diagnostic aspiration.'
      }
    },
    {
      id: 'chf',
      title: 'Orthopnea, bilateral basal crackles, raised JVP',
      source: 'https://radiopaedia.org/articles/cardiac-failure',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.62, mediastinum: 'normal', gastricBubble: true, lines: [],
        edema: true
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Bilateral interstitial edema',
        heart: 'Cardiomegaly (CTR > 0.5)',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Cardiomegaly with pulmonary venous congestion, consistent with congestive heart failure. CTR exceeds 0.5 on this PA film with upper-zone vascular redistribution and interstitial edema.'
      }
    },
    {
      id: 'ett-malposition',
      title: 'Intubated ICU patient, portable film for line check',
      source: 'https://radiopaedia.org/articles/endotracheal-tube-position',
      render: {
        projection: 'AP', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.55, mediastinum: 'normal', gastricBubble: true,
        lines: [{ type: 'ETT', pos: 'rightmain' }, { type: 'NG', pos: 'stomach' }]
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Cannot assess - AP/rotated film',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'ETT in right main bronchus',
        impression: 'Endotracheal tube tip projects in the right main bronchus and should be withdrawn 3-5 cm to sit above the carina; selective right intubation risks left lung collapse. NG tube tip below the diaphragm. AP projection, so heart size is not assessable.'
      }
    },
    {
      id: 'rotated',
      title: 'Portable film, restless patient',
      source: 'https://www.radiologymasterclass.co.uk/tutorials/chest/chest_quality/chest_xray_quality_rotation',
      render: {
        projection: 'AP', inspiration: 'adequate', rotation: 0.7, penetration: 'adequate',
        trachea: 'central', ctr: 0.5, mediastinum: 'normal', gastricBubble: true, lines: []
      },
      read: {
        adequacy: 'Inadequate - rotated',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Cannot assess - AP/rotated film',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Technically inadequate film: the patient is rotated to the right (spinous processes are not midway between the clavicular heads), which distorts the mediastinum and heart. Interpret with caution and repeat the film if a real finding is suspected.'
      }
    },
    {
      id: 'pneumoperitoneum',
      title: 'Acute abdomen, rigid and peritonitic',
      source: 'https://radiopaedia.org/articles/pneumoperitoneum',
      render: {
        projection: 'PA', inspiration: 'adequate', rotation: 0, penetration: 'adequate',
        trachea: 'central', ctr: 0.46, mediastinum: 'normal', gastricBubble: true, lines: [],
        freeAir: true
      },
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Normal heart size and borders',
        diaphragm: 'Free air under the diaphragm',
        lines: 'No lines, tubes, or devices',
        impression: 'Free air under the right hemidiaphragm (pneumoperitoneum) on this erect film, indicating a perforated viscus until proven otherwise. Urgent surgical review.'
      }
    }
  ];

  window.CXR_READS = { algorithm: algorithm, teaching: teaching, cases: cases };
})();
