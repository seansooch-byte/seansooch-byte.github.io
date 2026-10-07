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
const ordered = apps.map((a, i) => ({ ...a, no: i + 1 })).sort((x, y) => y.date.localeCompare(x.date) || y.no - x.no);
const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const who = m => esc(`${m.tool}${m.model ? ' (' + m.model + ')' : ''}`);

const items = ordered.map(a => `    <li class="app"><a class="card" href="/lab/${a.slug}/">
      <span class="no" aria-hidden="true">${String(a.no).padStart(3, '0')}</span>
      <div><h2>${esc(a.title)}</h2><p>${esc(a.description)}</p><p class="meta">Built by ${who(a.builder)} · reviewed by ${who(a.reviewer)}</p></div>
      <time class="date" datetime="${a.date}">${fmt(a.date)}</time>
    </a></li>`).join('\n');

const block = apps.length
  ? `  <p class="tally"><span>${apps.length} app${apps.length === 1 ? '' : 's'} shipped</span><span>Latest: ${fmt(ordered[0].date)}</span></p>
  <ol class="apps" reversed>
${items}
  </ol>`
  : `  <p class="empty">The first app ships soon.</p>`;

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
