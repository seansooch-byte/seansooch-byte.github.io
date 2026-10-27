// The Grok view's pictures, driven in a real browser. Not part of any suite: it needs a served site and the network.
//
// Expected:
//   - No Grok view page asks for /screenshots/grok/ or /videos/grok/ (the Grok Imagine stills and loop are retired),
//     and the home hero has no video.
//   - Every picture slot (img[data-apod]) on the three pages shows a NASA Astronomy Picture of the Day, served by
//     NASA's resizer on assets.science.nasa.gov, and the image actually loads.
//   - The home hero is the newest picture day in APOD's feed on science.nasa.gov (a video day is skipped).
//   - While the feed holds at least ten picture days, no picture repeats across the three pages.
//   - Every caption links the APOD post on science.nasa.gov and carries that post's title and credit.
//   - With the feed unreachable, every slot still shows a NASA picture (the fallback set) and nothing throws.
// What the page must show is worked out here from the feed itself (regex over the post HTML), not from the page's
// own parser, so a parser bug cannot pass its own test.
//
// Usage: node tools/grok-nasa.walk.mjs <base>          e.g. http://127.0.0.1:8098 or https://seansooch.dev
//        V=1 node tools/grok-nasa.walk.mjs <base>      prints every check
// Needs playwright-core and an installed Chrome (same require path as the preview's lab-views walk).
import { createRequire } from 'module';
const require = createRequire('/Users/seansooch/aa-main/node_modules/');
const { chromium } = require('playwright-core');

const B = (process.argv[2] || '').replace(/\/$/, '');
if (!B) { console.error('usage: node tools/grok-nasa.walk.mjs <base>'); process.exit(2); }
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  if (!ok || process.env.V) console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  [' + detail + ']' : ''));
};
const PAGES = ['/designs/grok/', '/designs/grok/two-stories/', '/designs/grok/lab/'];
const GROK_MEDIA = /\/(screenshots|videos)\/grok\//;
const NASA_IMG = /^https:\/\/assets\.science\.nasa\.gov\/dynamicimage\/assets\/science\/.+\?w=\d+/;
const ch = String.fromCharCode;
const NAMED = { amp: '&', quot: '"', lt: '<', gt: '>', nbsp: ' ', rsquo: ch(8217), lsquo: ch(8216), rdquo: ch(8221), ldquo: ch(8220), ndash: ch(8211) };
const squash = s => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (m, n) => ch(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => ch(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? m).replace(/\s+/g, ' ').trim();
// The caption's credit rule: the cell's text, "Image Credit:" dropped, no space before a comma or semicolon.
const creditOf = cell => squash(cell).replace(/^Image Credit:\s*/i, '').replace(/\s+([,;])/g, '$1');

// ---- what the feed says, read independently of the page
const FEED = 'https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=14&_fields=date,link,content';
const posts = await (await fetch(FEED)).json();
const feed = posts.map(p => {
  const c = p.content.rendered, i = c.indexOf('media-detail-hero__media'), media = c.slice(i, c.indexOf('<h1', i));
  const credit = (c.match(/Credit[^<]*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/) || [])[1] || '';
  return { date: p.date.slice(0, 10), link: p.link, picture: /<img\s/.test(media),
    title: squash((c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ''), credit: creditOf(credit) };
});
const pictures = feed.filter(d => d.picture);
check('the feed answers with picture days', pictures.length > 0, `${pictures.length} of ${feed.length}`);
const byLink = new Map(feed.map(d => [d.link, d]));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const slotState = () => [...document.querySelectorAll('img[data-apod]')].map(img => {
  const fig = img.closest('figure'), cap = fig && fig.querySelector('figcaption'), a = cap && cap.querySelector('a');
  return { slot: img.dataset.apod, src: img.currentSrc || img.src, srcset: img.srcset, loaded: img.complete && img.naturalWidth > 0,
    alt: img.alt, cap: cap ? cap.textContent.replace(/\s+/g, ' ').trim() : '', href: a ? a.href : '' };
});
// a feed that has been tampered with: a script link, an image from another host, then one good-looking day on wrong hosts
const HOSTILE = [
  { date: '2026-10-27T00:05:00', link: 'javascript:alert(1)', content: { rendered: '<div class="media-detail-hero__media"><img src="https://assets.science.nasa.gov/dynamicimage/assets/science/x.jpg" alt="x"></div><h1>Script link</h1>' } },
  { date: '2026-10-26T00:05:00', link: 'https://science.nasa.gov/image-article/x/', content: { rendered: '<div class="media-detail-hero__media"><img src="https://evil.example/x.jpg" alt="x"></div><h1>Foreign image</h1>' } },
  { date: '2026-10-25T00:05:00', link: 'https://science.nasa.gov.evil.example/x/', content: { rendered: '<div class="media-detail-hero__media"><img src="//assets.science.nasa.gov.evil.example/x.jpg" alt="x"></div><h1>Lookalike hosts</h1>' } },
];
async function visit(path, { block = false, hostile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const asked = [], errs = [];
  p.on('request', r => asked.push(r.url()));
  p.on('pageerror', e => errs.push(e.message));
  if (block) await p.route(/science\.nasa\.gov\/wp-json\//, r => r.abort());
  if (hostile) await p.route(/science\.nasa\.gov\/wp-json\//, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(HOSTILE) }));
  const res = await p.goto(B + path, { waitUntil: 'domcontentloaded' });
  const html = await res.text();
  // once the slots are filled, walk the page so every lazy slot comes into view, then wait for the pictures
  await p.waitForFunction(() => [...document.querySelectorAll('img[data-apod]')].every(i => i.getAttribute('src')), null, { timeout: 15000 }).catch(() => {});
  // (the page scrolls smoothly, so jump to each slot instantly and give its picture time to start)
  await p.evaluate(async () => {
    for (const img of document.querySelectorAll('img[data-apod]')) { img.scrollIntoView({ block: 'center', behavior: 'instant' }); await new Promise(r => setTimeout(r, 400)); }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await p.waitForFunction(() => { const s = [...document.querySelectorAll('img[data-apod]')]; return s.length && s.every(i => i.complete && i.naturalWidth > 0); }, null, { timeout: 20000 }).catch(() => {});
  const slots = await p.evaluate(slotState);
  const video = await p.evaluate(() => !!document.querySelector('.gk-hero video, video.gk-video'));
  await ctx.close();
  return { html, asked, errs, slots, video };
}

const seen = [];
for (const path of PAGES) {
  const v = await visit(path);
  check(`${path}: the page names no Grok Imagine file`, !GROK_MEDIA.test(v.html));
  check(`${path}: the browser asks for no Grok Imagine file`, !v.asked.some(u => GROK_MEDIA.test(u)), v.asked.filter(u => GROK_MEDIA.test(u)).join(' '));
  check(`${path}: has picture slots`, v.slots.length > 0, String(v.slots.length));
  check(`${path}: nothing throws`, v.errs.length === 0, v.errs.join(' | '));
  for (const s of v.slots) {
    const d = byLink.get(s.href);
    check(`${path} slot ${s.slot}: a NASA picture from the resizer`, NASA_IMG.test(s.src), s.src);
    check(`${path} slot ${s.slot}: the picture loaded`, s.loaded);
    check(`${path} slot ${s.slot}: caption links an APOD post in the feed`, !!d, s.href);
    if (d) {
      check(`${path} slot ${s.slot}: that post is a picture day`, d.picture, d.date);
      check(`${path} slot ${s.slot}: caption carries the post's title`, s.cap.includes(d.title), `${d.title} / ${s.cap}`);
      check(`${path} slot ${s.slot}: caption carries the post's credit`, !!d.credit && s.cap.includes(d.credit), `${d.credit} / ${s.cap}`);
    }
    check(`${path} slot ${s.slot}: the picture has alt text`, s.alt.length > 3);
    // NASA's resizer cannot change format, so a PNG day stops at 1280 px (2400 px of PNG is about 8 MB)
    if (/\.png\?/i.test(s.src)) check(`${path} slot ${s.slot}: a PNG day asks for at most 1280 px`, [...s.srcset.matchAll(/\?w=(\d+)/g), ...s.src.matchAll(/\?w=(\d+)/g)].every(m => +m[1] <= 1280), s.srcset);
    seen.push({ path, ...s });
  }
  if (path === '/designs/grok/') {
    check('home: the hero has no video', !v.video);
    const hero = v.slots.find(s => s.slot === '0');
    check('home: the hero is the newest picture day', !!hero && !!pictures[0] && hero.href === pictures[0].link, `${hero && hero.href} vs ${pictures[0] && pictures[0].link}`);
  }
}
const files = seen.map(s => s.src.split('?')[0]);
if (pictures.length >= 10) check('no picture repeats across the view', new Set(files).size === files.length, files.join(' '));
check('the view numbers its slots without repeats', new Set(seen.map(s => s.slot)).size === seen.length, seen.map(s => s.slot).join(','));

// ---- feed unreachable: the fallback set fills every slot
for (const path of PAGES) {
  const v = await visit(path, { block: true });
  check(`${path} (feed down): nothing throws`, v.errs.length === 0, v.errs.join(' | '));
  check(`${path} (feed down): every slot still shows a NASA picture`, v.slots.length > 0 && v.slots.every(s => NASA_IMG.test(s.src) && s.loaded), v.slots.map(s => s.src).join(' '));
  check(`${path} (feed down): every caption links science.nasa.gov`, v.slots.every(s => s.href.startsWith('https://science.nasa.gov/')));
}

// ---- a tampered feed: nothing from it reaches the page; the fallback fills every slot
{
  const v = await visit('/designs/grok/', { hostile: true });
  check('hostile feed: nothing throws', v.errs.length === 0, v.errs.join(' | '));
  check('hostile feed: no caption link leaves science.nasa.gov', v.slots.every(s => s.href.startsWith('https://science.nasa.gov/')), v.slots.map(s => s.href).join(' '));
  check('hostile feed: no picture from another host', v.slots.every(s => NASA_IMG.test(s.src)), v.slots.map(s => s.src).join(' '));
  check('hostile feed: no request to the foreign hosts', !v.asked.some(u => /evil\.example/.test(u)), v.asked.filter(u => /evil\.example/.test(u)).join(' '));
  check('hostile feed: every slot still shows a picture', v.slots.length > 0 && v.slots.every(s => s.loaded));
}

// ---- a PNG day, served through the real page: forced by a feed of one real PNG post
{
  const PNG_FEED = 'https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=1&search=Ghosts%20Revealed%20in%20Cassiopeia&_fields=date,link,content';
  const one = await (await fetch(PNG_FEED)).json();
  if (Array.isArray(one) && one.length && /\.png/i.test(one[0].content.rendered.slice(0, 20000))) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.route(/science\.nasa\.gov\/wp-json\//, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(one) }));
    await p.goto(B + '/designs/grok/', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelector('img[data-apod="0"]').getAttribute('src'), null, { timeout: 15000 }).catch(() => {});
    const hero = await p.evaluate(() => { const i = document.querySelector('img[data-apod="0"]'); return { src: i.getAttribute('src') || '', srcset: i.srcset }; });
    check('PNG day (2x screen): the hero asks for at most 1280 px', /\.png\?/i.test(hero.src) && [...(hero.srcset + ' ' + hero.src).matchAll(/\?w=(\d+)/g)].every(m => +m[1] <= 1280), hero.srcset || hero.src);
    await ctx.close();
  } else check('PNG day: the PNG control post was found', false, 'search for the IC 63 post returned nothing usable');
}

await browser.close();
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
