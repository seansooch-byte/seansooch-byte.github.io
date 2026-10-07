/* Read the CXR - recognition mode manifest (real, license-cleared films).
 * window.CXR_FILMS = [ {
 *   id,
 *   src,            // path to the bundled image, e.g. 'films/pneumothorax.jpg'
 *   alt,            // accessible description
 *   finding,        // canonical finding label - this is also the "spot the finding" answer
 *   prompt,         // the spot-the-finding question
 *   options: [..],  // spot MCQ choices (MUST include `finding`)
 *   teaching,       // one-line teaching point revealed after answering
 *   read: {         // full 8-step answer key for the "Run the read" sub-mode,
 *     adequacy, periphery, airway, lungs, heart, diaphragm, lines, impression
 *   },              // each value MUST be one of CXR_READS.algorithm[step].options
 *   credit,         // attribution string shown on the film, e.g. 'Jane Doe, MD'
 *   license,        // e.g. 'CC BY-SA 4.0' or 'Public domain'
 *   sourceUrl       // the file/case page the image came from
 * } ]
 *
 * Every film MUST carry credit + license + sourceUrl. Only public-domain / CC0 /
 * CC-BY / CC-BY-SA images belong here - non-commercial (NC) and no-derivatives (ND)
 * images are excluded. Images are bundled under ekg/films/.
 * The array is populated after the user approves each proposed film.
 */
(function () {
  'use strict';
  window.CXR_FILMS = [
    {
      id: 'normal',
      src: 'films/normal.jpg',
      alt: 'PA chest radiograph of a healthy young adult, labeled Dx (right) and Sin (left).',
      finding: 'Normal chest radiograph',
      prompt: 'A 21-year-old after minor chest trauma. What is the finding?',
      options: ['Normal chest radiograph', 'Left lower lobe consolidation', 'Cardiomegaly (CTR > 0.5)', 'Right pneumothorax'],
      teaching: 'A normal film is a finding. Clear lungs, sharp costophrenic angles, a cardiothoracic ratio under 0.5, and a central trachea - confirm each one deliberately rather than assuming.',
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Normal PA chest radiograph: clear lungs, normal cardiomediastinal silhouette, sharp costophrenic angles, no acute finding.'
      },
      credit: 'Mikael Häggström, MD',
      license: 'CC0 1.0 (public domain)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Normal_posteroanterior_(PA)_chest_radiograph_(X-ray).jpg'
    },
    {
      id: 'rml-pneumonia',
      src: 'films/rml-pneumonia.jpg',
      alt: 'PA chest radiograph showing right-sided airspace consolidation.',
      finding: 'Right middle lobe consolidation',
      prompt: '67-year-old man, fever and productive cough. What is the finding?',
      options: ['Right middle lobe consolidation', 'Left lower lobe consolidation', 'Clear lung fields bilaterally', 'Right pneumothorax'],
      teaching: 'Right middle lobe consolidation silhouettes the right heart border (the right heart border is lost) while the right hemidiaphragm stays sharp - that is the silhouette sign localizing the disease to the RML.',
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Right middle lobe consolidation',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Right middle lobe pneumonia: airspace consolidation silhouetting the right heart border, no effusion. Correlate clinically and treat.'
      },
      credit: 'Mikael Häggström, MD',
      license: 'CC0 1.0 (public domain)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X-ray_of_lobar_pneumonia.jpg'
    },
    {
      id: 'pneumothorax-left',
      src: 'films/pneumothorax-left.jpg',
      alt: 'Frontal chest radiograph with a left-sided pneumothorax; monitoring electrodes overlie the film.',
      finding: 'Left pneumothorax',
      prompt: 'Acute dyspnea. What is the finding?',
      options: ['Left pneumothorax', 'Right pneumothorax', 'Left lower lobe consolidation', 'Clear lung fields bilaterally'],
      teaching: 'Look for the visceral pleural line with no lung markings peripheral to it. The pneumothorax is on the patient left (viewer right). Trace the lateral edge from apex downward.',
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Left pneumothorax',
        heart: 'Normal heart size and borders',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Left pneumothorax: visible visceral pleural line with absent peripheral lung markings. No tension features (trachea central). Treat per size and symptoms.'
      },
      credit: 'Ves Dimov, MD (Clinical Cases)',
      license: 'CC BY-SA 2.5',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pneumothorax_CXR.jpg'
    },
    {
      id: 'effusion-left',
      src: 'films/effusion-left.jpg',
      alt: 'Frontal chest radiograph with a large left pleural effusion opacifying the lower hemithorax.',
      finding: 'Left pleural effusion',
      prompt: 'Progressive breathlessness, dullness at the left base. What is the finding?',
      options: ['Left pleural effusion', 'Right pleural effusion', 'Left lower lobe consolidation', 'Cardiomegaly (CTR > 0.5)'],
      teaching: 'A large effusion opacifies the dependent hemithorax with a meniscus that rises laterally. It blunts and then obliterates the costophrenic angle and silhouettes the hemidiaphragm.',
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Normal heart size and borders',
        diaphragm: 'Blunted costophrenic angle (effusion)',
        lines: 'No lines, tubes, or devices',
        impression: 'Large left pleural effusion: homogeneous basal opacity with a rising lateral meniscus obscuring the left hemidiaphragm. Consider diagnostic aspiration.'
      },
      credit: 'Ves Dimov, MD (Clinical Cases)',
      license: 'CC BY-SA 2.5',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Left-sided_Pleural_Effusion.jpg'
    },
    {
      id: 'cardiomegaly',
      src: 'films/cardiomegaly.jpg',
      alt: 'PA chest radiograph with an enlarged cardiac silhouette, marked D (right).',
      finding: 'Cardiomegaly (CTR > 0.5)',
      prompt: 'PA chest film. Assess the cardiomediastinal silhouette.',
      options: ['Cardiomegaly (CTR > 0.5)', 'Normal heart size and borders', 'Widened mediastinum', 'Left pneumothorax'],
      teaching: 'On a PA film the cardiothoracic ratio (widest heart / widest thorax) should be under 0.5. Here the silhouette is clearly enlarged. CTR is only reliable on PA, not AP.',
      read: {
        adequacy: 'Adequate',
        periphery: 'Normal bones and soft tissues',
        airway: 'Trachea central, no deviation',
        lungs: 'Clear lung fields bilaterally',
        heart: 'Cardiomegaly (CTR > 0.5)',
        diaphragm: 'Sharp costophrenic angles, no free air',
        lines: 'No lines, tubes, or devices',
        impression: 'Cardiomegaly: cardiothoracic ratio exceeds 0.5 on this PA film. Correlate with echocardiography and clinical assessment of heart failure.'
      },
      credit: 'SCiardullo',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cardiomegalia.JPG'
    }
  ];
})();
