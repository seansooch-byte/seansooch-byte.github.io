#!/usr/bin/env node
// Render the app list in lab/index.html from lab/apps.json, and make sure
// sitemap.xml lists /lab/ and every app. Never shipped (tools/ is export-ignore).
//
// lab/index.html is hand-written; only the block between the LAB:LIST markers
// is rewritten. lab/apps.json is the ledger: one entry per shipped app.
// Usage: node tools/lab-index.mjs        (from the repo root)
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const read = p => fs.readFileSync(root + p, 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const apps = JSON.parse(read('lab/apps.json'));
const seen = new Set();
for (const a of apps) {
  for (const k of ['slug', 'title', 'date', 'description', 'builder', 'reviewer'])
    if (!a[k]) throw new Error(`apps.json: ${a.slug || '?'} is missing ${k}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) throw new Error(`apps.json: bad slug ${a.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error(`apps.json: bad date ${a.date}`);
  if (seen.has(a.slug)) throw new Error(`apps.json: duplicate slug ${a.slug}`);
  seen.add(a.slug);
  if (!fs.existsSync(`${root}lab/${a.slug}/index.html`)) throw new Error(`apps.json: lab/${a.slug}/index.html does not exist`);
}
// The course: lab/syllabus.json lists every module in teaching order. Shipped lessons (in apps.json) are links; the rest
// are listed as "Coming soon" with no link, so the page never points at a page that does not exist.
const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
let syllabus = { modules: [] };
if (fs.existsSync(root + 'lab/syllabus.json')) syllabus = JSON.parse(read('lab/syllabus.json'));
const mods = syllabus.modules || [];
const mseen = new Set();
for (const m of mods) {
  for (const k of ['slug', 'title', 'description']) if (!m[k]) throw new Error(`syllabus.json: ${m.slug || '?'} is missing ${k}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug)) throw new Error(`syllabus.json: bad slug ${m.slug}`);
  if (mseen.has(m.slug)) throw new Error(`syllabus.json: duplicate slug ${m.slug}`);
  if (m.drugClasses && !Array.isArray(m.drugClasses)) throw new Error(`syllabus.json: ${m.slug} drugClasses must be a list`);
  mseen.add(m.slug);
}
const bySlug = Object.fromEntries(apps.map(a => [a.slug, a]));
const pad = n => String(n).padStart(2, '0');
const lessons = mods.map((m, i) => ({ ...m, no: i + 1, app: bySlug[m.slug] }));
// Shipped apps that are not (or no longer) in the syllabus stay reachable, listed after the course.
const extra = apps.filter(a => !mseen.has(a.slug)).sort((x, y) => x.date.localeCompare(y.date));
const ready = lessons.filter(l => l.app).length + extra.length;
const latest = apps.length ? apps.map(a => a.date).sort().at(-1) : null;

const item = l => l.app
  ? `    <li class="app ready"><a class="card" href="/lab/${l.slug}/">
      <span class="no" aria-hidden="true">${pad(l.no)}</span>
      <div><h2>${esc(l.title)}</h2><p>${esc(l.description)}</p><p class="meta">Lesson ${l.no}${l.drugClasses && l.drugClasses.length ? ' · ' + esc(l.drugClasses.join(', ')) : ''}</p></div>
      <time class="date" datetime="${l.app.date}">${fmt(l.app.date)}</time>
    </a></li>`
  : `    <li class="app soon"><div class="card">
      <span class="no" aria-hidden="true">${pad(l.no)}</span>
      <div><h2>${esc(l.title)}</h2><p>${esc(l.description)}</p><p class="meta">Lesson ${l.no}${l.drugClasses && l.drugClasses.length ? ' · ' + esc(l.drugClasses.join(', ')) : ''}</p></div>
      <span class="date">Coming soon</span>
    </div></li>`;
const extraItem = a => `    <li class="app ready"><a class="card" href="/lab/${a.slug}/">
      <span class="no" aria-hidden="true">+</span>
      <div><h2>${esc(a.title)}</h2><p>${esc(a.description)}</p></div>
      <time class="date" datetime="${a.date}">${fmt(a.date)}</time>
    </a></li>`;

const total = mods.length + extra.length;
const block = total
  ? `  <p class="tally"><span>${ready} of ${total} lesson${total === 1 ? '' : 's'} ready</span>${latest ? `<span>Latest: ${fmt(latest)}</span>` : ''}</p>
  <ol class="apps course">
${[...lessons.map(item), ...extra.map(extraItem)].join('\n')}
  </ol>`
  : `  <p class="empty">The first lesson is on its way.</p>`;

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
console.log(`lab index: ${apps.length} app(s); sitemap +${add.length} -${dropped}`);
