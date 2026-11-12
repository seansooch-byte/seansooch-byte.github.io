// Calcium, PTH and Vitamin D: the lesson's words and every record they rest on.
// SOURCES is the single provenance object: each record is { file, section, quote }, and each quote is
// copied verbatim from the cached file under /workspace/lab-pipeline/sources/calcium-pth-vitamin-d/
// (the smoke test checks every one after collapsing whitespace). Everything else in this file points
// at SOURCES by id; nothing makes a physiological claim without one.
(function () {
  const F175 = 'openstax-ap2e-17-5-the-parathyroid-glands.txt';
  const F67 = 'openstax-ap2e-6-7-calcium-homeostasis-interactions-of-the-skeletal-system-and-other-organ-systems.txt';
  const F263 = 'openstax-ap2e-26-3-electrolyte-balance.txt';
  const sp = id => `statpearls-${id}-abstract.txt`;
  const S175 = 'OpenStax A&P 2e, 17.5 The Parathyroid Glands';
  const S67 = 'OpenStax A&P 2e, 6.7 Calcium Homeostasis';
  const S263 = 'OpenStax A&P 2e, 26.3 Electrolyte Balance';

  // Records whose quotes carry numbers live in clinical-values.json (sourceRecords) with the reference values;
  // app.js merges them into this same SOURCES object when that file loads.
  const SOURCES = {
    // OpenStax 17.5
    q175_location: { file: F175, section: `${S175}, Figure 17.15 caption`, quote: 'The small parathyroid glands are embedded in the posterior surface of the thyroid gland.' },
    q175_four: { file: F175, section: `${S175}, opening paragraph`, quote: 'Most people have four parathyroid glands, but occasionally there are more in tissues of the neck or chest.' },
    q175_pthmajor: { file: F175, section: `${S175}, opening paragraph`, quote: 'These epithelial cells produce and secrete the parathyroid hormone (PTH) , the major hormone involved in the regulation of blood calcium levels.' },
    q175_lowca: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'The parathyroid glands produce and secrete PTH, a peptide hormone, in response to low blood calcium levels' },
    q175_osteoclast: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'PTH secretion causes the release of calcium from the bones by stimulating osteoclasts, which secrete enzymes that degrade bone and release calcium into the interstitial fluid.' },
    q175_osteoblast: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'PTH also inhibits osteoblasts, the cells involved in bone deposition, thereby sparing blood calcium.' },
    q175_kidney: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'PTH causes increased reabsorption of calcium (and magnesium) in the kidney tubules from the urine filtrate.' },
    q175_gut: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'Calcitriol then stimulates increased absorption of dietary calcium by the intestines.' },
    q175_feedback: { file: F175, section: `${S175}, paragraph before Figure 17.16`, quote: 'A negative feedback loop regulates the levels of PTH, with rising blood calcium levels inhibiting further release of PTH.' },
    q175_fig16: { file: F175, section: `${S175}, Figure 17.16 caption`, quote: 'Parathyroid hormone increases blood calcium levels when they drop too low. Conversely, calcitonin, which is released from the thyroid gland, decreases blood calcium levels when they become too high.' },
    q175_calcitonin: { file: F175, section: `${S175}, closing paragraph`, quote: 'When blood calcium levels are high, calcitonin is produced and secreted by the parafollicular cells of the thyroid gland. As discussed earlier, calcitonin inhibits the activity of osteoclasts, reduces the absorption of dietary calcium in the intestine, and signals the kidneys to reabsorb less calcium, resulting in larger amounts of calcium excreted in the urine.' },
    q175_hyper: { file: F175, section: `${S175}, hyperparathyroidism paragraph`, quote: 'a disorder caused by an overproduction of PTH that results in excessive calcium reabsorption from bone' },

    // OpenStax 6.7
    q67_diet: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'Calcium is a chemical element that cannot be produced by any biological processes. The only way it can enter the body is through the diet.' },
    q67_store: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'The bones act as a storage site for calcium: The body deposits calcium in the bones when blood levels get too high, and it releases calcium when blood levels drop too low.' },
    q67_receptor: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'Cells of the parathyroid gland have plasma membrane receptors for calcium. When calcium is not binding to these receptors, the cells release PTH, which stimulates osteoclast proliferation and resorption of bone by osteoclasts.' },
    q67_kidney: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'PTH promotes reabsorption of calcium from the urine by the kidneys, so that the calcium returns to the blood.' },
    q67_vitd: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'Finally, PTH stimulates the synthesis of vitamin D, which in turn, stimulates calcium absorption from any digested food in the small intestine.' },
    q67_off: { file: F67, section: `${S67}, after Figure 6.24`, quote: 'When all these processes return blood calcium levels to normal, there is enough calcium to bind with the receptors on the surface of the cells of the parathyroid glands, and this cycle of events is turned off' },

    // OpenStax 26.3
    q263_bound: { file: F263, section: `${S263}, Calcium`, quote: 'A little more than one-half of blood calcium is bound to proteins, leaving the rest in its ionized form.' },
    q263_bonebreak: { file: F263, section: `${S263}, Roles of Electrolytes`, quote: 'In the event that calcium and phosphate are needed for other functions, bone tissue can be broken down to supply the blood and other tissues with these minerals.' },
    q263_excretion: { file: F263, section: `${S263}, Roles of Electrolytes`, quote: 'Excretion of ions occurs mainly through the kidneys, with lesser amounts lost in sweat and in feces.' },
    q263_vitd: { file: F263, section: `${S263}, Calcium`, quote: 'Calcium is absorbed through the intestines under the influence of activated vitamin D. A deficiency of vitamin D leads to a decrease in absorbed calcium and, eventually, a depletion of calcium stores from the skeletal system, potentially leading to rickets in children and osteomalacia in adults, contributing to osteoporosis.' },
    q263_hypocalc: { file: F263, section: `${S263}, Calcium`, quote: 'Hypocalcemia , or abnormally low calcium blood levels, is seen in hypoparathyroidism, which may follow the removal of the thyroid gland, because the four nodules of the parathyroid gland are embedded in it.' },
    q263_hypercalc: { file: F263, section: `${S263}, Calcium`, quote: 'Hypercalcemia , or abnormally high calcium blood levels, is seen in primary hyperparathyroidism.' },
    q263_hyperphos: { file: F263, section: `${S263}, Phosphate`, quote: 'Hyperphosphatemia , or abnormally increased levels of phosphates in the blood, occurs if there is decreased renal function or in cases of acute lymphocytic leukemia.' },
    q263_regulation: { file: F263, section: `${S263}, Regulation of Calcium and Phosphate`, quote: 'Calcium and phosphate are both regulated through the actions of three hormones: parathyroid hormone (PTH), dihydroxyvitamin D (calcitriol), and calcitonin. All three are released or synthesized in response to the blood levels of calcium.' },
    q263_pthbone: { file: F263, section: `${S263}, Regulation of Calcium and Phosphate`, quote: 'PTH is released from the parathyroid gland in response to a decrease in the concentration of blood calcium. The hormone activates osteoclasts to break down bone matrix and release inorganic calcium-phosphate salts.' },
    q263_calcitriol: { file: F263, section: `${S263}, Regulation of Calcium and Phosphate`, quote: 'PTH also increases the gastrointestinal absorption of dietary calcium by converting vitamin D into dihydroxyvitamin D (calcitriol), an active form of vitamin D that intestinal epithelial cells require to absorb calcium.' },
    q263_kidney: { file: F263, section: `${S263}, Regulation of Calcium and Phosphate`, quote: 'PTH raises blood calcium levels by inhibiting the loss of calcium through the kidneys. PTH also increases the loss of phosphate through the kidneys.' },

    // StatPearls NBK430912, Hypocalcemia
    q912_def: { file: sp('NBK430912'), section: 'StatPearls NBK430912, Hypocalcemia, abstract', quote: 'Hypocalcemia is an electrolyte disorder characterized by abnormally low serum calcium levels.' },
    q912_causes: { file: sp('NBK430912'), section: 'StatPearls NBK430912, Hypocalcemia, abstract', quote: 'Common causes include disorders of parathyroid glands, vitamin D deficiency, chronic kidney disease (CKD), or disturbances in magnesium balance.' },
    q912_albumin1: { file: sp('NBK430912'), section: 'StatPearls NBK430912, Hypocalcemia, abstract', quote: 'Because a substantial proportion of circulating calcium is bound to albumin, total serum calcium should be corrected for albumin level before diagnosing hypocalcemia.' },
    q912_ccells: { file: sp('NBK430912'), section: 'StatPearls NBK430912, Hypocalcemia, abstract', quote: 'The primary hormonal regulators include PTH hormone, produced by the parathyroid glands, and calcitonin, secreted by the thyroid parafollicular (C) cells.' },
    q912_suppress: { file: sp('NBK430912'), section: 'StatPearls NBK430912, Hypocalcemia, abstract', quote: 'Calcium and activated vitamin D suppress PTH secretion, whereas elevated serum phosphorus stimulates PTH release.' },

    // StatPearls NBK482128, Physiology, Calcium
    q128_bound: { file: sp('NBK482128'), section: 'StatPearls NBK482128, Physiology, Calcium, abstract', quote: 'Although physiologically inactive, this fraction can affect total serum calcium levels in hypoalbuminemic or hyperalbuminemic states.' },

    // StatPearls NBK499940, Physiology, Parathyroid Hormone
    q940_secretes: { file: sp('NBK499940'), section: 'StatPearls NBK499940, Physiology, Parathyroid Hormone, abstract', quote: 'The parathyroid gland secretes parathyroid hormone (PTH), a polypeptide, in response to low calcium levels detected in the blood.' },
    q940_drop: { file: sp('NBK499940'), section: 'StatPearls NBK499940, Physiology, Parathyroid Hormone, abstract', quote: 'As serum calcium levels drop, the secretion of PTH by the parathyroid gland increases.' },
    q940_feedback: { file: sp('NBK499940'), section: 'StatPearls NBK499940, Physiology, Parathyroid Hormone, abstract', quote: 'Increased calcium levels in the serum serve as a negative-feedback loop signaling the parathyroid glands to stop the release of PTH.' },

    // StatPearls NBK441895, Primary Hyperparathyroidism
    q895_def: { file: sp('NBK441895'), section: 'StatPearls NBK441895, Primary Hyperparathyroidism, abstract', quote: 'Primary hyperparathyroidism (PHPT) is an endocrine disorder defined by autonomous overproduction of parathyroid hormone (PTH), resulting in hypercalcemia and disrupted calcium homeostasis.' },
    q895_mech: { file: sp('NBK441895'), section: 'StatPearls NBK441895, Primary Hyperparathyroidism, abstract', quote: 'The underlying pathophysiology involves a shift in the calcium-sensing receptor (CaSR) set point, causing persistent PTH secretion despite elevated serum calcium. This leads to increased bone resorption, renal calcium reabsorption, and intestinal calcium absorption.' },
    q895_dx: { file: sp('NBK441895'), section: 'StatPearls NBK441895, Primary Hyperparathyroidism, abstract', quote: 'Diagnostic evaluation relies exclusively on biochemical testing, focusing on confirming elevated or inappropriately elevated PTH in the presence of hypercalcemia after secondary causes have been excluded.' },

    // StatPearls NBK441899, Hypoparathyroidism
    q899_def: { file: sp('NBK441899'), section: 'StatPearls NBK441899, Hypoparathyroidism, abstract', quote: 'Hypoparathyroidism is an uncommon endocrine abnormality in which parathyroid gland dysfunction causes parathyroid hormone deficiency. Subsequently, this absence or decreased level of PTH results in hypocalcemia, hyperphosphatemia, and increased neuromuscular irritability.' },
    q899_cause: { file: sp('NBK441899'), section: 'StatPearls NBK441899, Hypoparathyroidism, abstract', quote: 'Though there are multiple causes of hypoparathyroidism, unintended excision or iatrogenic injury during head and neck surgery (eg, thyroidectomy) is the most common etiology.' },

    // StatPearls NBK532266, Vitamin D Deficiency
    q266_role: { file: sp('NBK532266'), section: 'StatPearls NBK532266, Vitamin D Deficiency, abstract', quote: 'Vitamin D is a fat-soluble nutrient essential for calcium homeostasis and bone metabolism.' },
    q266_rickets: { file: sp('NBK532266'), section: 'StatPearls NBK532266, Vitamin D Deficiency, abstract', quote: 'Deficiency of this beneficial substance can lead to nutritional rickets in children and osteomalacia in adults.' },
    // These excerpts stop before the source's nmol/L parentheticals, whose conversions are not consistent.

    // StatPearls NBK493172, Hypophosphatemia
    q172_linked: { file: sp('NBK493172'), section: 'StatPearls NBK493172, Hypophosphatemia, abstract', quote: 'Phosphate regulation is intricately connected to calcium metabolism through regulation by these three important hormones.' },

    // StatPearls NBK430714, Hypercalcemia
    q714_albumin: { file: sp('NBK430714'), section: 'StatPearls NBK430714, Hypercalcemia, abstract', quote: 'Serum calcium levels fluctuate based on serum albumin levels, as a large percentage of calcium is bound to albumin. Therefore, calcium levels must be adjusted based on albumin levels.' },

    // StatPearls NBK482423, Malignancy-Related Hypercalcemia (used only for what supports the teaching on ionized calcium)
    // The albumin correction in mg/dL only. (NBK430912 states it too, but its mmol/L conversion is not right, so it is not used.)
    q423_ionized: { file: sp('NBK482423'), section: 'StatPearls NBK482423, Malignancy-Related Hypercalcemia, abstract', quote: 'Therefore, the ionized or free calcium levels should be measured when hypercalcemia is suspected for a more accurate assessment.' },
  };

  // The four conditions (labels, arrows and their quote ids) live in clinical-values.json, with the
  // reference numbers, so there is one source of truth for every shift the lesson shows.

  // The quantities every state is read against (hormones and ions), then the processes.
  const QUANTITIES = [
    { id: 'calcium', label: 'Calcium', sym: 'Ca²⁺' },
    { id: 'pth', label: 'PTH', sym: 'PTH' },
    { id: 'calcitriol', label: 'Calcitriol (1,25-dihydroxyvitamin D)', sym: 'calcitriol' },
    { id: 'phosphate', label: 'Phosphate', sym: 'phosphate' },
    { id: 'vitd25', label: '25-hydroxyvitamin D', sym: '25-OH D' },
  ];
  const PROCESSES = [
    { id: 'boneRelease', label: 'Calcium out of bone' },
    { id: 'boneStore', label: 'Calcium stores in bone' },
    { id: 'kidneyCa', label: 'Calcium reabsorbed by the kidney' },
    { id: 'gutCa', label: 'Calcium absorbed by the gut' },
    { id: 'kidneyFn', label: 'Kidney function' },
  ];

  const GOALS = [
    'Tell total serum calcium apart from ionized calcium, state the cited reference ranges, and read the albumin correction exactly as quoted.',
    'Describe how the parathyroid glands respond to blood calcium, and what PTH does at bone and at the kidney.',
    'Explain the kidney activation step: PTH reaches the kidney, the kidney makes calcitriol, and calcitriol makes the gut absorb more calcium.',
    'Describe calcitonin as OpenStax 17.5 describes it.',
    'Predict the direction of calcium, PTH, calcitriol and phosphate in four parathyroid, vitamin D and kidney states, as far as the sources allow.',
  ];

  // One prediction per lesson step (keyed by data-kind), then the caption's own records.
  const STEPS = {
    blood: {
      captionQ: ['q263_bound', 'q128_fractions', 'q128_complexed', 'q912_albumin1', 'q128_ionized'],
      predict: { prompt: 'A routine blood test reports total calcium. Which part of it is the active form the body responds to?',
        options: ['The free, ionized calcium', 'The calcium bound to albumin', 'Both parts count equally'], answer: 0,
        why: 'Ionized calcium is the biologically active form. The albumin-bound part is inactive, but it still counts in total calcium, so a total is read with albumin in mind.',
        q: ['q128_ionized', 'q128_bound'] } },
    sense: {
      captionQ: ['q175_location', 'q175_four', 'q67_receptor', 'q940_drop'],
      predict: { prompt: 'Blood calcium has just dropped below normal. What do the parathyroid glands do?',
        options: ['Release more PTH', 'Release less PTH', 'Release calcium straight into the blood'], answer: 0,
        why: 'The glands sense calcium directly. As calcium drops, they secrete more PTH, the hormone that brings calcium back up.',
        q: ['q940_drop', 'q175_lowca'] } },
    bone: {
      captionQ: ['q67_store', 'q175_osteoclast', 'q175_osteoblast'],
      predict: { prompt: 'PTH reaches bone. Which way does calcium move?',
        options: ['Out of bone into the blood', 'Out of the blood into bone', 'Neither: PTH does not act on bone'], answer: 0,
        why: 'PTH stimulates osteoclasts, which break bone down and release its calcium, and it holds back the bone-building osteoblasts.',
        q: ['q175_osteoclast', 'q175_osteoblast'] } },
    kidney: {
      captionQ: ['q175_kidney', 'q67_kidney', 'q263_kidney'],
      predict: { prompt: 'PTH reaches the kidney. What happens to the calcium that would leave in urine?',
        options: ['Less is lost: more is taken back into the blood', 'More is lost in urine', 'Nothing: PTH does not act on the kidney'], answer: 0,
        why: 'PTH makes the kidney tubules reabsorb more calcium from the fluid that becomes urine, so the calcium returns to the blood.',
        q: ['q67_kidney', 'q263_kidney'] } },
    activate: {
      captionQ: ['q175_calcitriol', 'q175_gut', 'q940_kidneys', 'q263_calcitriol', 'q67_diet'],
      predict: { prompt: 'PTH has reached the kidney. How does it get the gut to absorb more calcium from food?',
        options: ['The kidney makes calcitriol, which travels to the gut', 'PTH travels straight to the gut', 'Low blood calcium acts on the gut by itself'], answer: 0,
        why: 'PTH starts calcitriol production in the kidneys; calcitriol then stimulates the intestines to absorb more dietary calcium. The path runs PTH, kidney, calcitriol, gut.',
        q: ['q175_calcitriol', 'q175_gut'] } },
    feedback: {
      captionQ: ['q175_feedback', 'q940_feedback', 'q912_ccells', 'q175_calcitonin'],
      predict: { prompt: 'Calcium is climbing back to normal. What happens to PTH release?',
        options: ['It slows: rising calcium inhibits it', 'It keeps rising', 'It stays the same until calcitonin arrives'], answer: 0,
        why: 'Rising blood calcium inhibits further PTH release: a negative feedback loop. If calcium runs high, calcitonin from the thyroid lowers it.',
        q: ['q175_feedback', 'q175_fig16'] } },
    phosphate: {
      captionQ: ['q263_bonebreak', 'q263_pthbone', 'q263_kidney'],
      predict: { prompt: 'PTH acts on the kidney. What happens to phosphate there?',
        options: ['More phosphate is lost in urine', 'More phosphate is kept', 'Phosphate is turned into calcium'], answer: 0,
        why: 'At the kidney PTH keeps calcium but increases the loss of phosphate, so the two move opposite ways there.',
        q: ['q263_kidney'] } },
    phpt: {
      captionQ: ['q895_def', 'q895_mech'],
      predict: { prompt: 'A parathyroid gland keeps making PTH whatever the calcium level. What happens to blood calcium?',
        options: ['It rises', 'It falls', 'Feedback keeps it exactly normal'], answer: 0,
        why: 'Overproduction of PTH results in high blood calcium: bone gives up more calcium, the kidneys keep more and the gut absorbs more.',
        q: ['q895_def', 'q895_mech'] } },
    hypopara: {
      captionQ: ['q899_cause', 'q899_def', 'q899_dx'],
      predict: { prompt: 'The glands make almost no PTH. Which pattern follows?',
        options: ['Calcium down, phosphate up', 'Calcium up, phosphate down', 'Calcium down, phosphate down'], answer: 0,
        why: 'Too little PTH results in low calcium and high phosphate, and 1,25-dihydroxyvitamin D (calcitriol) is decreased.',
        q: ['q899_def', 'q899_dx'] } },
    vitd: {
      captionQ: ['q263_vitd', 'q266_def', 'q912_causes'],
      predict: { prompt: 'Vitamin D runs short. Which process does the source say decreases?',
        options: ['Calcium absorption from food in the gut', 'PTH release from the parathyroid glands', 'Calcium reabsorption in the kidney'], answer: 0,
        why: 'Calcium is absorbed through the intestines under the influence of activated vitamin D, and the source says a deficiency leads to a decrease in absorbed calcium. It gives no direction for PTH release or kidney reabsorption in this state.',
        q: ['q263_vitd'] } },
    ckd: {
      captionQ: ['q263_excretion', 'q263_hyperphos', 'q912_causes'],
      predict: { prompt: 'The kidneys work less well. What happens to phosphate in the blood?',
        options: ['It rises', 'It falls', 'It cannot change'], answer: 0,
        why: 'Abnormally high blood phosphate, hyperphosphatemia, occurs with decreased renal function.',
        q: ['q263_hyperphos'] } },
    compare: {
      captionQ: ['q899_dx', 'q895_dx', 'q263_hyperphos', 'q263_vitd'],
      predict: { prompt: 'A picture shows calcium down, PTH down, phosphate up and calcitriol down. Which state is it?',
        options: ['Hypoparathyroidism', 'Primary hyperparathyroidism', 'Decreased renal function / CKD'], answer: 0,
        why: 'This quoted pattern identifies hypoparathyroidism: low calcium, decreased PTH, high phosphorus and decreased 1,25-dihydroxyvitamin D. Where the sources give no direction for another state, it stays unknown.',
        q: ['q899_dx'] } },
  };

  const QUIZ = [
    { id: 'active', goal: 1, step: 'blood', stem: 'Which form of blood calcium is the biologically active one?',
      options: ['Ionized (free) calcium', 'Calcium bound to albumin', 'Calcium in complexes with small anions'], answer: 0,
      why: 'Ionized calcium is the biologically active form; the protein-bound part is physiologically inactive.', q: ['q128_ionized', 'q128_bound'] },
    { id: 'range', goal: 1, step: 'blood', stem: 'What normal range does StatPearls (NBK430912) give for total serum calcium?',
      options: ['{range:total_ca}', '{range:ionized_ca}', '{zone:vitd25:2}'], answer: 0,
      why: 'Total serum calcium: {range:total_ca}. The {range:ionized_ca} range is for ionized calcium, and {zone:vitd25:2} defines vitamin D sufficiency.', q: ['q912_total', 'q912_ionized', 'q266_suff'] },
    { id: 'albumin', goal: 1, step: 'blood', stem: 'Why is total calcium read alongside the albumin level?',
      options: ['A large share of blood calcium is bound to albumin, so low albumin lowers total calcium', 'Albumin makes PTH', 'Albumin is the active form of calcium'], answer: 0,
      why: 'Because so much calcium rides on albumin, total calcium is corrected for albumin. The source states the size of the correction exactly.', q: ['q912_albumin1', 'q423_albumin'] },
    { id: 'trigger', goal: 2, step: 'sense', stem: 'What makes the parathyroid glands release more PTH?',
      options: ['Falling blood calcium', 'Rising blood calcium', 'Calcitriol arriving from the gut'], answer: 0,
      why: 'As serum calcium drops, PTH secretion increases.', q: ['q940_drop'] },
    { id: 'bone', goal: 2, step: 'bone', stem: 'How does PTH release calcium from bone?',
      options: ['By stimulating osteoclasts, which break bone down', 'By stimulating osteoblasts to lay down bone', 'By blocking all bone cells'], answer: 0,
      why: 'PTH stimulates osteoclasts, which degrade bone and release calcium; it inhibits the bone-building osteoblasts.', q: ['q175_osteoclast', 'q175_osteoblast'] },
    { id: 'where', goal: 3, step: 'activate', stem: 'Where is calcitriol produced when PTH starts its production?',
      options: ['In the kidneys', 'In the small intestine', 'In the parathyroid glands'], answer: 0,
      why: 'PTH initiates the production of calcitriol in the kidneys.', q: ['q175_calcitriol', 'q940_kidneys'] },
    { id: 'path', goal: 3, step: 'activate', stem: 'Which path traces how PTH raises calcium absorption from food?',
      options: ['PTH → kidney → calcitriol → gut', 'PTH → gut, directly', 'Blood calcium → gut → calcitriol'], answer: 0,
      why: 'PTH acts on the kidney, the kidney makes calcitriol, and calcitriol stimulates the intestines to absorb more dietary calcium. Nothing goes from PTH straight to the gut.', q: ['q175_calcitriol', 'q175_gut'] },
    { id: 'calcitonin', goal: 4, step: 'feedback', stem: 'According to OpenStax 17.5, what does calcitonin do?',
      options: ['Inhibits osteoclasts, reduces gut absorption and signals the kidneys to reabsorb less calcium', 'Stimulates osteoclasts and the gut to raise calcium', 'Starts calcitriol production in the kidneys'], answer: 0,
      why: 'Calcitonin, made by the parafollicular cells of the thyroid when calcium is high, inhibits osteoclasts, reduces dietary calcium absorption and signals the kidneys to reabsorb less calcium.', q: ['q175_calcitonin'] },
    { id: 'id-phpt', goal: 5, step: 'phpt', stem: '{arrows:phpt}. Which state is this?',
      options: ['Primary hyperparathyroidism', 'Hypoparathyroidism', 'Decreased renal function / CKD'], answer: 0,
      why: 'Primary hyperparathyroidism is confirmed by elevated or inappropriately elevated PTH in the presence of high calcium.', q: ['q895_dx'] },
    { id: 'id-hypo', goal: 5, step: 'hypopara', stem: '{arrows:hypopara}. Which state is this?',
      options: ['Hypoparathyroidism', 'Vitamin D deficiency', 'Primary hyperparathyroidism'], answer: 0,
      why: 'Hypoparathyroidism: low corrected calcium, decreased PTH, elevated serum phosphorus and decreased 1,25-dihydroxyvitamin D.', q: ['q899_dx'] },
  ];

  const TAKEAWAYS = [
    { text: 'Blood calcium comes in three forms: bound to proteins (mainly albumin), free (ionized) and a small share in complexes with small ions. The ionized calcium is the active form, and total calcium counts all three, so it is read with albumin in mind.', q: ['q263_bound', 'q128_fractions', 'q128_complexed', 'q128_ionized', 'q912_albumin1'] },
    { text: 'When blood calcium drops, the parathyroid glands secrete more PTH; rising calcium inhibits further release (negative feedback).', q: ['q940_drop', 'q175_feedback'] },
    { text: 'At bone, PTH stimulates osteoclasts to release calcium. At the kidney, it increases calcium reabsorption and increases phosphate loss.', q: ['q175_osteoclast', 'q263_kidney'] },
    { text: 'PTH starts calcitriol production in the kidneys; calcitriol then makes the intestines absorb more dietary calcium. The path is PTH → kidney → calcitriol → gut.', q: ['q175_calcitriol', 'q175_gut'] },
    { text: 'When calcium is high, the thyroid’s parafollicular cells release calcitonin, which inhibits osteoclasts, reduces gut absorption and signals the kidneys to reabsorb less calcium.', q: ['q175_calcitonin'] },
    { text: '{allstates}', q: ['q895_dx', 'q899_dx', 'q263_vitd', 'q263_hyperphos', 'q912_causes'] },
  ];

  const GLOSSARY = [
    { term: 'Ionized calcium', def: 'The free calcium in blood, not bound to protein: the biologically active form.', q: ['q128_ionized'] },
    { term: 'PTH (parathyroid hormone)', def: 'The hormone of the parathyroid glands, released when blood calcium is low: the major hormone regulating blood calcium.', q: ['q175_pthmajor', 'q175_lowca'] },
    { term: 'Calcitriol', def: 'The active form of vitamin D (1,25-dihydroxyvitamin D), made in the kidneys when PTH starts its production.', q: ['q175_calcitriol'] },
    { term: '25-hydroxyvitamin D', def: 'The blood level used to define vitamin D sufficiency, insufficiency and deficiency.', q: ['q266_suff', 'q266_insuff', 'q266_def'] },
    { term: 'Osteoclast', def: 'A bone cell that secretes enzymes which degrade bone and release its calcium.', q: ['q175_osteoclast'] },
    { term: 'Calcitonin', def: 'A hormone from the parafollicular (C) cells of the thyroid, made when blood calcium is high; it lowers blood calcium.', q: ['q175_calcitonin', 'q912_ccells'] },
    { term: 'Hyperphosphatemia', def: 'Abnormally increased phosphate in the blood; it occurs with decreased renal function.', q: ['q263_hyperphos'] },
    { term: 'Hypophosphatemia', def: 'Abnormally low phosphate in the blood; for adults, defined by the number in the Clinical values tab.', q: ['q172_def'] },
    { term: 'Negative feedback', def: 'A loop in which the result switches off its cause: rising calcium inhibits further PTH release.', q: ['q175_feedback'] },
    { term: 'Osteoblast', def: 'A bone-building cell; PTH inhibits it, sparing blood calcium.', q: ['q175_osteoblast'] },
  ];

  window.SOURCES = SOURCES;
  window.LESSON = { SOURCES, QUANTITIES, PROCESSES, GOALS, STEPS, QUIZ, TAKEAWAYS, GLOSSARY, minutes: 20 };
})();
