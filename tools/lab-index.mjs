#!/usr/bin/env node
// Render the course in lab/index.html from lab/syllabus.json, lab/apps.json and each lesson's
// plan.json, and make sure sitemap.xml lists /lab/ and every lesson. Never shipped (tools/ is
// export-ignore). Usage: node tools/lab-index.mjs   (from the repo root)
//
// lab/index.html is hand-written; only the block between the LAB:LIST markers is rewritten:
//   - the course's facts (lessons, units, hours, practice questions);
//   - a course map: every unit with a dot per lesson (lab/kit/course.js colours the dots by progress);
//   - each unit with its lessons: number, title, description, time, steps, questions, what it builds
//     on, its goals, and a progress bar for course.js to fill;
//   - the mixed review, and a small table of each lesson's step numbers by kind, so a review question
//     can link to the step that teaches it.
// A module in the syllabus that has not shipped is listed as "Coming soon" with no link. A shipped
// lesson that is no longer in the syllabus stays reachable, listed after the course.
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const read = p => fs.readFileSync(root + p, 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const apps = JSON.parse(read('lab/apps.json'));
const seen = new Set();
for (const a of apps) {
  for (const k of ['slug', 'title', 'date', 'description', 'builder', 'reviewer'])
    if (!a[k]) throw new Error(`apps.json: ${a.slug || '?'} is missing ${k}`);
  if (!SLUG.test(a.slug)) throw new Error(`apps.json: bad slug ${a.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error(`apps.json: bad date ${a.date}`);
  if (seen.has(a.slug)) throw new Error(`apps.json: duplicate slug ${a.slug}`);
  seen.add(a.slug);
  if (!fs.existsSync(`${root}lab/${a.slug}/index.html`)) throw new Error(`apps.json: lab/${a.slug}/index.html does not exist`);
}
const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const syllabus = fs.existsSync(root + 'lab/syllabus.json') ? JSON.parse(read('lab/syllabus.json')) : { modules: [] };
const mods = syllabus.modules || [];
const units = syllabus.units || [];
const mseen = new Set();
for (const m of mods) {
  for (const k of ['slug', 'title', 'description']) if (!m[k]) throw new Error(`syllabus.json: ${m.slug || '?'} is missing ${k}`);
  if (!SLUG.test(m.slug)) throw new Error(`syllabus.json: bad slug ${m.slug}`);
  if (mseen.has(m.slug)) throw new Error(`syllabus.json: duplicate slug ${m.slug}`);
  if (m.drugClasses && !Array.isArray(m.drugClasses)) throw new Error(`syllabus.json: ${m.slug} drugClasses must be a list`);
  if (units.length && !units.some(u => u.id === m.unit)) throw new Error(`syllabus.json: ${m.slug} has no known unit`);
  mseen.add(m.slug);
}
const bySlug = Object.fromEntries(apps.map(a => [a.slug, a]));
const numberOf = Object.fromEntries(mods.map((m, i) => [m.slug, i + 1]));
const pad = n => String(n).padStart(2, '0');

// What each shipped lesson's own files say: its plan, and its steps in order.
function lessonFacts(slug) {
  const html = read(`lab/${slug}/index.html`);
  const kinds = [...html.matchAll(/<article data-step="(\d+)"[^>]*data-kind="([^"]+)"/g)].map(m => [m[2], +m[1]]);
  let plan = null;
  if (fs.existsSync(`${root}lab/${slug}/plan.json`)) plan = JSON.parse(read(`lab/${slug}/plan.json`));
  return { plan, steps: kinds.length, stepOf: Object.fromEntries(kinds) };
}
const facts = Object.fromEntries(apps.map(a => [a.slug, lessonFacts(a.slug)]));
const time = mins => mins < 60 ? `about ${mins} min` : (h => h === 1 ? 'about an hour' : `about ${Math.floor(h)}${h % 1 >= .5 ? ' and a half' : ''} hours`)(Math.round(mins / 30) / 2);
const list = ns => ns.length === 1 ? `Lesson ${ns[0]}` : `Lessons ${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}`;

function lessonItem(m, n) {
  const app = bySlug[m.slug];
  if (!app) return `      <li class="lesson soon">
        <span class="no" aria-hidden="true">${pad(n)}</span>
        <div class="lesson-body"><h3>${esc(m.title)}</h3><p class="desc">${esc(m.description)}</p><p class="meta">Lesson ${n} · Coming soon</p></div>
      </li>`;
  const f = facts[m.slug], p = f.plan;
  const quiz = p?.quiz?.length || 0;
  const builds = (p?.prerequisites || []).map(s => numberOf[s]).filter(Boolean).sort((a, b) => a - b);
  const meta = [p ? `${p.minutes} min` : '', `${f.steps} steps`, quiz ? `${quiz} questions` : '', builds.length ? `Builds on ${list(builds)}` : 'A good place to start'].filter(Boolean).join(' · ');
  const goals = p?.objectives?.length ? `\n          <details class="goals"><summary>What you will be able to do</summary><ol>${p.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ol></details>` : '';
  return `      <li class="lesson ready" data-slug="${m.slug}" data-steps="${f.steps}" data-quiz="${quiz}">
        <span class="no" aria-hidden="true">${pad(n)}</span>
        <div class="lesson-body">
          <h3><a href="/lab/${m.slug}/">${esc(m.title)}</a></h3>
          <p class="desc">${esc(m.description)}</p>
          <p class="meta">${esc(meta)}</p>${goals}
          <p class="progress" data-lab-progress><span class="bar" aria-hidden="true"><i></i></span><span class="state">Not started</span></p>
        </div>
      </li>`;
}

// Units in course order; a syllabus with no units is one unnamed unit.
const groups = units.length
  ? units.map(u => ({ unit: u, mods: mods.filter(m => m.unit === u.id) })).filter(g => g.mods.length)
  : [{ unit: { id: 'course', title: 'Core medicine', summary: '' }, mods }];
const extra = apps.filter(a => !mseen.has(a.slug)).sort((x, y) => x.date.localeCompare(y.date));
const shipped = mods.filter(m => bySlug[m.slug]);
const minutes = shipped.reduce((s, m) => s + (facts[m.slug].plan?.minutes || 0), 0);
const questions = shipped.reduce((s, m) => s + (facts[m.slug].plan?.quiz?.length || 0), 0);
const predictions = shipped.reduce((s, m) => s + Object.keys(facts[m.slug].plan?.checks || {}).length, 0);
const latest = apps.length ? apps.map(a => a.date).sort().at(-1) : null;

const map = `  <nav class="map" aria-label="The course at a glance">
    <ol>
${groups.map((g, i) => `      <li><a class="map-unit" href="#${g.unit.id}"><span class="map-no">${i + 1}</span><span class="map-title">${esc(g.unit.title)}</span></a>
        <ol class="map-lessons">${g.mods.map(m => { const n = numberOf[m.slug]; return bySlug[m.slug] ? `<li><a href="/lab/${m.slug}/" data-lab-dot="${m.slug}" title="Lesson ${n}: ${esc(m.title)}"><span class="visually-hidden">Lesson ${n}: ${esc(m.title)}</span></a></li>` : `<li><span class="soon" title="Lesson ${n}: ${esc(m.title)}, coming soon"></span></li>`; }).join('')}</ol></li>`).join('\n')}
    </ol>
  </nav>`;

const unitsHtml = groups.map((g, i) => {
  const mins = g.mods.reduce((s, m) => s + (facts[m.slug]?.plan?.minutes || 0), 0);
  return `  <section class="unit" id="${g.unit.id}" aria-labelledby="unit-${g.unit.id}">
    <header class="unit-head">
      <p class="unit-no">Unit ${i + 1}</p>
      <h2 id="unit-${g.unit.id}">${esc(g.unit.title)}</h2>
      ${g.unit.summary ? `<p class="unit-sum">${esc(g.unit.summary)}</p>` : ''}
      <p class="unit-meta">${g.mods.length} lesson${g.mods.length === 1 ? '' : 's'}${mins ? ` · ${time(mins)}` : ''}</p>
    </header>
    <ol class="lessons">
${g.mods.map(m => lessonItem(m, numberOf[m.slug])).join('\n')}
    </ol>
  </section>`;
}).join('\n');

const extraHtml = extra.length ? `  <section class="unit" id="more" aria-labelledby="unit-more">
    <header class="unit-head"><p class="unit-no">More</p><h2 id="unit-more">Outside the course</h2></header>
    <ol class="lessons">
${extra.map(a => `      <li class="lesson ready" data-slug="${a.slug}" data-steps="${facts[a.slug].steps}" data-quiz="${facts[a.slug].plan?.quiz?.length || 0}">
        <span class="no" aria-hidden="true">+</span>
        <div class="lesson-body"><h3><a href="/lab/${a.slug}/">${esc(a.title)}</a></h3><p class="desc">${esc(a.description)}</p></div>
      </li>`).join('\n')}
    </ol>
  </section>` : '';

const steps = Object.fromEntries(apps.map(a => [a.slug, facts[a.slug].stepOf]));
const block = mods.length + extra.length ? `  <dl class="facts">
    <div><dt>Lessons</dt><dd>${shipped.length + extra.length}</dd></div>
    <div><dt>Units</dt><dd>${groups.length}</dd></div>
    <div><dt>To work through</dt><dd>${time(minutes).replace('about ', '')}</dd></div>
    <div><dt>Practice questions</dt><dd>${questions + predictions}</dd></div>
  </dl>
  <p class="tally"><span>${shipped.length + extra.length} of ${mods.length + extra.length} lessons ready</span>${latest ? `<span>Latest: ${fmt(latest)}</span>` : ''}</p>
  <div class="resume" data-lab-resume></div>
${map}
${unitsHtml}
${extraHtml}
  <section class="review" id="review" aria-labelledby="review-h">
    <h2 id="review-h">Mixed review</h2>
    <p>Ten questions drawn from the lessons you have started, shuffled together, each with its answer explained and a link back to the step that teaches it. Mixing topics is harder than one lesson's quiz, which is what makes it stick.</p>
    <div class="review-box" data-lab-review><button type="button" data-lab-review-start>Start a mixed review</button></div>
  </section>
  <script type="application/json" id="lab-steps">${JSON.stringify(steps).replace(/</g, '\\u003c')}</script>` : `  <p class="empty">The first lesson is on its way.</p>`;

const html = read('lab/index.html');
const re = /(<!-- LAB:LIST:START[^>]*-->\n)[\s\S]*?(\n\s*<!-- LAB:LIST:END -->)/;
if (!re.test(html)) throw new Error('lab/index.html: LAB:LIST markers not found');
fs.writeFileSync(root + 'lab/index.html', html.replace(re, `$1${block}$2`));

let sm = read('sitemap.xml');
const before = sm;
// Drop entries for lab apps that are no longer in the ledger (withdrawn apps). /lab/ itself always stays.
let dropped = 0;
sm = sm.replace(/^[ \t]*<url><loc>https:\/\/seansooch\.dev\/lab\/([a-z0-9-]+)\/<\/loc>.*<\/url>\r?\n/gm, (line, slug) => (seen.has(slug) ? line : (dropped++, '')));
const want = ['https://seansooch.dev/lab/', ...apps.map(a => `https://seansooch.dev/lab/${a.slug}/`)];
const add = want.filter(u => !sm.includes(`<loc>${u}</loc>`));
if (add.length) {
  const lines = add.map(u => `  <url><loc>${u}</loc><changefreq>${u.endsWith('/lab/') ? 'daily' : 'monthly'}</changefreq><priority>${u.endsWith('/lab/') ? '0.7' : '0.6'}</priority></url>`).join('\n');
  sm = sm.replace('</urlset>', `${lines}\n</urlset>`);
}
if (sm !== before) fs.writeFileSync(root + 'sitemap.xml', sm);
console.log(`lab index: ${apps.length} lesson(s), ${groups.length} unit(s), ${questions} quiz questions, ${predictions} predictions; sitemap +${add.length} -${dropped}`);
