#!/usr/bin/env node
// Check every Lab lesson against lab/FORMAT.md: the parts a script can check without a browser.
// Never shipped (tools/ is export-ignore). Usage, from the repo root:
//   node tools/lab-check.mjs            every lesson in lab/apps.json, plus the course files
//   node tools/lab-check.mjs <slug>...  only these lessons
// Prints one line per problem and exits 1 if there are any.
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const read = p => fs.readFileSync(root + p, 'utf8');
const exists = p => fs.existsSync(root + p);
const problems = [];
const bad = (where, what) => problems.push(`${where}: ${what}`);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EM = '—';
// A dose: a number with a mass or unit-per-weight. Lab units in clinical-values.json (mg/dL) are not checked here.
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|μg|micrograms?|milligrams?|grams?|IU|units?)\b(?!\s?\/\s?(?:dL|L|mL|min|h)\b)|\/\s?kg\b|\bper kilogram\b/i;
const LAZY = /\b(all|none|both) of the above\b|\b(?:choice|option|answer) [A-F]\b|\b[A-F] (?:and|or) [A-F]\b/i;

const apps = JSON.parse(read('lab/apps.json'));
const syllabus = JSON.parse(read('lab/syllabus.json'));
const mods = syllabus.modules || [];
const units = syllabus.units || [];
const index = Object.fromEntries(mods.map((m, i) => [m.slug, i]));

/* ---------- The course ---------- */
const unitIds = new Set(units.map(u => u.id));
for (const u of units) {
  if (!SLUG.test(u.id || '')) bad('syllabus.json', `unit id "${u.id}" is not a plain slug`);
  if (!u.title || !u.summary) bad('syllabus.json', `unit ${u.id} needs a title and a summary`);
}
let lastUnit = null;
const closed = new Set();
for (const m of mods) {
  if (!unitIds.has(m.unit)) bad('syllabus.json', `${m.slug} has unit "${m.unit}", which is not in units`);
  if (m.unit !== lastUnit) {
    if (closed.has(m.unit)) bad('syllabus.json', `unit ${m.unit} is split: its modules must sit together`);
    if (lastUnit) closed.add(lastUnit);
    lastUnit = m.unit;
  }
}

/* ---------- One lesson ---------- */
function strip(html) { return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function checkLesson(slug) {
  const dir = `lab/${slug}`;
  for (const f of ['index.html', 'app.js', 'plan.json', 'clinical-values.json']) if (!exists(`${dir}/${f}`)) bad(slug, `missing ${f}`);
  if (!exists(`${dir}/index.html`)) return;
  const html = read(`${dir}/index.html`);
  const n = index[slug];
  const mod = mods[n];
  if (mod === undefined) { bad(slug, 'not in lab/syllabus.json'); return; }
  const unitNo = units.findIndex(u => u.id === mod.unit) + 1, unit = units[unitNo - 1];

  // Head and shell
  const need = [
    ['<link rel="stylesheet" href="/lab/kit/kit.css">', 'the kit stylesheet'],
    [/<script type="module" src="app\.js(\?v=[\w.]+)?"><\/script>/, 'app.js as a module'],
    [`<main id="main" data-slug="${slug}">`, `main[data-slug="${slug}"]`],
    ['data-lx-plan', 'the plan box (data-lx-plan)'],
    ['Educational, not for clinical use', 'the "Educational, not for clinical use" note'],
    [`<link rel="canonical" href="https://seansooch.dev/lab/${slug}/">`, 'its canonical address'],
    ['<header class="site-top">', 'the site top bar'],
  ];
  for (const [s, what] of need) if (!(s instanceof RegExp ? s.test(html) : html.includes(s))) bad(slug, `index.html lacks ${what}`);
  const crumb = `<a href="/lab/">The Lab</a> / <a href="/lab/#${mod.unit}">Unit ${unitNo}: ${unit?.title}</a> / Lesson ${n + 1}</p>`;
  if (!html.includes(crumb)) bad(slug, `the eyebrow should read: The Lab / Unit ${unitNo}: ${unit?.title} / Lesson ${n + 1}`);
  if (!html.includes(`Lesson ${n + 1} of The Lab`)) bad(slug, `the footer should say Lesson ${n + 1} of The Lab`);
  const tabs = [...html.matchAll(/<button type="button" role="tab" id="tab-([a-z]+)" aria-controls="([a-z]+)"/g)].map(m => [m[1], m[2]]);
  const want = ['lesson', 'quiz', 'summary', 'clinical', 'explore'];
  if (tabs.map(t => t[0]).join() !== want.join() || tabs.some(([a, b]) => a !== b)) bad(slug, `tabs must be ${want.join(', ')} (id tab-X controlling #X), found ${tabs.map(t => t[0]).join(', ') || 'none'}`);
  for (const id of want) if (!new RegExp(`<section id="${id}" role="tabpanel" aria-labelledby="tab-${id}"`).test(html)) bad(slug, `missing <section id="${id}" role="tabpanel" aria-labelledby="tab-${id}">`);
  if (/class="replay"/.test(html)) bad(slug, 'a Replay button is left over: the kit player replaces it');
  for (const m of html.matchAll(/<(?:script|link)\b([^>]*?)(?:src|href)="(?:https?:)?\/\/([^/"]+)/g)) if (!/rel="canonical"/.test(m[0]) && !/fonts\.(googleapis|gstatic)\.com$/.test(m[2])) bad(slug, `third-party request to ${m[2]}`);

  // Steps
  const steps = [...html.matchAll(/<article data-step="(\d+)" data-step-title="([^"]*)" data-kind="([^"]*)"(?: hidden)?>([\s\S]*?)<\/article>/g)]
    .map(m => ({ no: +m[1], title: m[2], kind: m[3], body: m[4] }));
  const raw = (html.match(/<article\b[^>]*data-step=/g) || []).length;
  if (raw !== steps.length) bad(slug, `${raw - steps.length} step(s) do not match <article data-step="N" data-step-title="..." data-kind="..."[ hidden]>`);
  if (steps.length < 10 || steps.length > 24) bad(slug, `${steps.length} steps; a lesson has 12 to 22`);
  const kinds = new Set();
  const stageOf = s => strip((s.body.match(/<p class="eyebrow">([\s\S]*?)<\/p>/) || [])[1] || '');
  steps.forEach((s, i) => {
    const at = `${slug} step ${s.no}`;
    if (s.no !== i + 1) bad(at, `numbered ${s.no}, expected ${i + 1}`);
    if (kinds.has(s.kind)) bad(at, `kind "${s.kind}" is used twice`);
    kinds.add(s.kind);
    if ((i === 0) === /^\s*<article[^>]*hidden/.test(s.body)) { /* the first step shows, the rest are hidden: checked below */ }
    const h2 = strip((s.body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '');
    if (h2 !== strip(s.title)) bad(at, `data-step-title "${s.title}" differs from its heading "${h2}"`);
    if (!/<div class="visual" data-visual><\/div>/.test(s.body)) bad(at, 'needs an empty <div class="visual" data-visual></div>');
    const cap = (s.body.match(/<p class="caption">([\s\S]*?)<\/p>/) || [])[1];
    if (!cap) bad(at, 'needs a <p class="caption">');
    else if (strip(cap).split(' ').length > 75) bad(at, `caption is ${strip(cap).split(' ').length} words; keep it under 75`);
    if (!stageOf(s)) bad(at, 'needs a stage eyebrow');
  });
  const hiddenOk = [...html.matchAll(/<article data-step="(\d+)"[^>]*?( hidden)?>/g)].every(m => (m[1] === '1') !== !!m[2]);
  if (!hiddenOk) bad(slug, 'step 1 shows and every later step carries hidden');
  const changeSteps = steps.filter(s => /^What changes/i.test(stageOf(s)));
  if (!changeSteps.length) bad(slug, 'no step has the stage "What changes it"');
  if (steps.length && changeSteps.length && steps.indexOf(changeSteps[0]) + changeSteps.length !== steps.length) bad(slug, 'the "What changes it" steps must be the last stage');
  const parts = (html.match(/<dfn data-part="/g) || []).length;
  if (parts < 3) bad(slug, `${parts} caption terms light a part of the picture (dfn data-part); give at least 3`);

  // app.js
  if (exists(`${dir}/app.js`)) {
    const js = read(`${dir}/app.js`);
    if (!/from '\/lab\/kit\/kit\.js'/.test(js) || !/\blesson\(\{/.test(js)) bad(slug, "app.js must import { lesson } from '/lab/kit/kit.js' and call lesson({...})");
    // A scene key may be written k: ..., 'k': ..., or as shorthand { k, ... }; or set as scenes['k'] = ...
    const keyed = k => new RegExp(`(^|[\\s{,'"])${k.replace(/[-]/g, '\\-')}['"]?\\s*:`, 'm').test(js)
      || (/^[a-zA-Z_$][\\w$]*$/.test(k) && new RegExp(`[{,]\\s*${k}\\s*[,}]`).test(js));
    for (const k of kinds) if (!keyed(k) && !js.includes(`scenes['${k}']`) && !js.includes(`scenes["${k}"]`) && !js.includes(`[${JSON.stringify(k)}]`)) bad(slug, `app.js seems to have no scene for kind "${k}"`);
    if (js.includes(EM)) bad(slug, 'app.js contains an em dash');
  }

  // plan.json
  let plan = null;
  try { plan = JSON.parse(read(`${dir}/plan.json`)); } catch (e) { bad(slug, `plan.json does not parse: ${e.message}`); }
  if (plan) {
    const p = `${slug} plan.json`;
    if (!Number.isInteger(plan.minutes) || plan.minutes < 10 || plan.minutes > 60) bad(p, 'minutes must be a whole number from 10 to 60');
    if (!Array.isArray(plan.prerequisites)) bad(p, 'prerequisites must be a list');
    else for (const q of plan.prerequisites) {
      if (index[q] === undefined) bad(p, `prerequisite ${q} is not in the syllabus`);
      else if (index[q] >= n) bad(p, `prerequisite ${q} is not an earlier lesson`);
    }
    const objs = plan.objectives || [];
    if (objs.length < 3 || objs.length > 5) bad(p, `${objs.length} goals; give 3 to 5`);
    const checks = plan.checks || {};
    for (const s of changeSteps) if (!checks[s.kind]) bad(p, `step ${s.no} (${s.kind}) is a "What changes it" step with no prediction`);
    for (const [k, c] of Object.entries(checks)) {
      if (!kinds.has(k)) bad(p, `prediction for "${k}", which is not a step kind`);
      if (!c.prompt || !c.why) bad(p, `prediction ${k} needs a prompt and a why`);
      if (!Array.isArray(c.choices) || c.choices.length < 3 || c.choices.length > 4) bad(p, `prediction ${k} needs 3 or 4 choices`);
      else if (new Set(c.choices).size !== c.choices.length) bad(p, `prediction ${k} repeats a choice`);
      if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= (c.choices || []).length) bad(p, `prediction ${k} answer is out of range`);
      if ([c.prompt, c.why, ...(c.choices || [])].some(t => LAZY.test(t))) bad(p, `prediction ${k} uses "of the above" or a letter`);
    }
    const quiz = plan.quiz || [];
    if (quiz.length < 6 || quiz.length > 10) bad(p, `${quiz.length} quiz questions; give 6 to 10`);
    const ids = new Set(), covered = new Set();
    for (const q of quiz) {
      const at = `${p} quiz ${q.id}`;
      if (!SLUG.test(q.id || '')) bad(at, 'id must be a short slug');
      if (ids.has(q.id)) bad(at, 'id is used twice');
      ids.add(q.id);
      if (!Number.isInteger(q.objective) || q.objective < 1 || q.objective > objs.length) bad(at, `objective ${q.objective} is not a goal number`);
      else covered.add(q.objective);
      if (!kinds.has(q.step)) bad(at, `step "${q.step}" is not a step kind`);
      if (!q.stem || !q.why) bad(at, 'needs a stem and a why');
      if (!Array.isArray(q.choices) || q.choices.length !== 4) bad(at, 'needs exactly 4 choices');
      else if (new Set(q.choices).size !== 4) bad(at, 'repeats a choice');
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) bad(at, 'answer must be 0 to 3');
      if ([q.stem, q.why, ...(q.choices || [])].some(t => LAZY.test(t))) bad(at, 'uses "of the above" or a letter');
    }
    for (let i = 1; i <= objs.length; i++) if (!covered.has(i)) bad(p, `goal ${i} has no quiz question`);
    const tk = plan.takeaways || [];
    if (tk.length < 5 || tk.length > 8) bad(p, `${tk.length} takeaways; give 5 to 8`);
    const text = JSON.stringify(plan);
    if (text.includes(EM)) bad(p, 'contains an em dash');
    const dose = text.match(DOSE);
    if (dose) bad(p, `looks like a dose: "${dose[0]}"`);
  }

  // Words on the page
  if (html.includes(EM.repeat(1)) && html.replace('SS<span aria-hidden="true">—</span>03', '').includes(EM)) bad(slug, 'index.html contains an em dash (other than the site mark)');
  const words = strip(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, ''));
  const dose = words.match(DOSE);
  if (dose) bad(slug, `index.html: looks like a dose: "${dose[0]}"`);
  if (exists(`${dir}/style.css`) && read(`${dir}/style.css`).includes(EM)) bad(slug, 'style.css contains an em dash');
  if (exists(`${dir}/clinical-values.json`)) {
    const cv = read(`${dir}/clinical-values.json`);
    if (cv.includes(EM) || cv.includes('\\u2014')) bad(slug, 'clinical-values.json contains an em dash (use a spaced en dash, even inside a quotation)');
  }
}

const only = process.argv.slice(2);
const slugs = only.length ? only : apps.map(a => a.slug);
for (const s of slugs) checkLesson(s);
for (const f of ['lab/kit/kit.js', 'lab/kit/kit.css', 'lab/kit/draw.js', 'lab/kit/progress.js', 'lab/syllabus.json', 'lab/FORMAT.md']) if (exists(f) && read(f).includes(EM)) bad(f, 'contains an em dash');

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} in ${slugs.length} lesson${slugs.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`lab-check: ${slugs.length} lesson${slugs.length === 1 ? '' : 's'} follow${slugs.length === 1 ? "s" : ""} lab/FORMAT.md.`);
