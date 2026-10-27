/* The Night Orbit's pictures: NASA's Astronomy Picture of the Day. Written by tools/build-grok-view.py.
   Expected behaviour:
   - Each <img data-apod="N"> shows the Nth newest picture day of APOD, read from its home on
     science.nasa.gov (WordPress REST, category 22766 = APOD, no key). Video days are skipped, so slot 0,
     the home hero, is today's picture, or the latest picture day when today is a video. The pages number
     their slots so no picture repeats across the view (home 0-4, Two Stories 5-7, Lab 8-9).
   - Pictures come through NASA's resizer at 960, 1600 and 2400 px wide; the page's CSS crops each slot.
     The resizer cannot change format, so a PNG day stops at 1280 px (2400 px of PNG is about 8 MB).
   - A day is used only if its post is on https://science.nasa.gov/ and its image on
     https://assets.science.nasa.gov/, so a tampered feed cannot put a script link or another host's image here.
   - Each caption keeps its label and adds the day, the title (a link to the APOD post) and the credit.
   - The parsed days are kept in localStorage for 30 minutes. If the feed cannot be read within 8 s, the
     slots use the last days kept, or failing that the fixed public-domain NASA days below.
   - Text from the feed is set with textContent and attributes only, never as HTML. */
(function(){
  'use strict';
  var FEED = 'https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=14&_fields=date,link,content';
  var KEY = 'gk-apod-v1', TTL = 30 * 60000;
  var FALLBACK = [{"date": "2026-06-01", "link": "https://science.nasa.gov/image-article/apod-2026-june-1-saturn-at-night/", "title": "Saturn at Night", "alt": "Saturn at Night", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/june/LastRingPortrait_Cassini_4472.jpg", "credit": "NASA, JPL-Caltech, Space Science Institute, Mindaugas Macijauskas"}, {"date": "2026-04-08", "link": "https://science.nasa.gov/image-article/apod-2026-april-8-earthset/", "title": "Earthset", "alt": "Earthset captured through the Orion spacecraft window at 6:41 p.m. EDT, April 6, 2026, during the Artemis II crew’s flyby of the Moon. A muted blue Earth with bright white clouds sets behind the cratered lunar surface. The dark portion of Earth is experiencing nighttime. On Earth’s day side, swirling clouds are visible over the Australia and Oceania region. In the foreground, Ohm crater has terraced edges and a flat floor interrupted by central peaks. Central peaks form in complex craters when the lunar surface, liquefied on impact, splashes upwards during the crater’s formation.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/april/earthset_original.jpg", "credit": "NASA Text:Keighley Rockcliffe (NASA GSFC, UMBC CSST, CRESST II)"}, {"date": "2026-01-11", "link": "https://science.nasa.gov/image-article/apod-2026-january-11-m104-the-sombrero-galaxy-in-infrared/", "title": "M104: The Sombrero Galaxy in Infrared", "alt": "A red-tinged ring of dust is seen nearly on edge. In the ring's center and extending around the frame, blue gas and stars are shown. Please see the explanation for more detailed information.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/january/sombrero_spitzer_3000.jpg", "credit": "NASA, JPL, Caltech, SSC, R. Kennicutt ( Steward Obs. ) et al.,"}, {"date": "2026-10-10", "link": "https://science.nasa.gov/image-article/apod-2026-october-10-lunar-farside/", "title": "Lunar Farside", "alt": "A mosaic image of the farside of the Moon.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/october/farside_lro1600.jpg", "credit": "NASA / GSFC / Arizona State Univ. / Lunar Reconnaissance Orbiter"}, {"date": "2026-02-06", "link": "https://science.nasa.gov/image-article/apod-2026-february-6-supernova-remnant-cassiopeia-a/", "title": "Supernova Remnant Cassiopeia A", "alt": "Supernova Remnant Cassiopeia A", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/february/CasA_nircam_4096.jpg", "credit": "NASA, ESA, CSA, STScI; D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (University of Gent)"}, {"date": "2026-05-17", "link": "https://science.nasa.gov/image-article/apod-2026-may-17-ngc-1300-barred-spiral-galaxy/", "title": "NGC 1300: Barred Spiral Galaxy", "alt": "The featured image shows a the big beautiful barred spiral galaxy NGC 1300 with encompassing spiral arms tinted blue from young stars. Please see the explanation for more detailed information.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/may/NGC1300_HST_6637.jpg", "credit": "NASA ESA, Hubble Heritage"}, {"date": "2026-04-04", "link": "https://science.nasa.gov/image-article/apod-2026-april-4-hello-world/", "title": "Hello World", "alt": "Hello World", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/april/art002e000192.jpg", "credit": "NASA, Reid Wiseman, Artemis II"}, {"date": "2026-01-20", "link": "https://science.nasa.gov/image-article/apod-2026-january-20-io-in-true-color/", "title": "Io in True Color", "alt": "A big ball that is mostly yellow is shown. The ball has many circular and irregular regions that are different colors, typically brown or olive green. Please see the explanation for more detailed information.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/january/iotruecolor_galileo_2796.jpg", "credit": "NASA, JPL, Galileo Project"}, {"date": "2026-09-06", "link": "https://science.nasa.gov/image-article/apod-2026-september-6-pluto-in-enhanced-color/", "title": "Pluto in Enhanced Color", "alt": "The picture shows Pluto in enhanced colors and high resolution and seen by the passing New Horizons spacecraft in 2015. Please see the explanation for more detailed information.", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2021/august/PlutoEnhancedHiRes_NewHorizons_5000.jpg", "credit": "NASA, Johns Hopkins Univ./APL, Southwest Research Inst."}, {"date": "2026-06-27", "link": "https://science.nasa.gov/image-article/apod-2026-june-27-mars-marathon-by-perseverance/", "title": "Mars Marathon by Perseverance", "alt": "Mars Marathon by Perseverance", "file": "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/june/PIA26726.jpg", "credit": "NASA, LPL (U. Arizona), MRO, HiRISE"}];
  var slots = Array.prototype.slice.call(document.querySelectorAll('img[data-apod]'));
  if (!slots.length) return;
  function text(n){ return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function parse(post){
    // NASA's media-detail-hero block: the media, an <h1> title, a meta table with a "Credit & Copyright" row
    var doc = new DOMParser().parseFromString(post.content.rendered, 'text/html'); // inert: nothing loads or runs
    var img = doc.querySelector('.media-detail-hero__media img'), title = text(doc.querySelector('h1'));
    var link = String(post.link || ''), src = img ? img.getAttribute('src') || '' : '';
    if (!title || !/^\d{4}-\d\d-\d\d/.test(post.date || '')) return null;
    if (link.indexOf('https://science.nasa.gov/') !== 0 || src.indexOf('https://assets.science.nasa.gov/') !== 0) return null;
    var credit = '';
    Array.prototype.forEach.call(doc.querySelectorAll('.media-detail-hero__meta-row'), function(row){
      if (!credit && /credit/i.test(text(row.querySelector('th')))) credit = text(row.querySelector('td'));
    });
    var alt = (img.getAttribute('alt') || '').trim();
    return {
      date: post.date.slice(0, 10), link: link, title: title,
      alt: !alt || /^see explanation/i.test(alt) ? title : alt,
      // /content/dam/ ignores size parameters; the same file under /dynamicimage/assets/ resizes
      file: src.split('?')[0].replace('/content/dam/', '/dynamicimage/assets/'),
      credit: credit.replace(/^Image Credit:\s*/i, '').replace(/\s+([,;])/g, '$1')
    };
  }
  function safe(post){ try { return parse(post); } catch (e) { return null; } }
  function sized(file, w){ return file + '?w=' + w + '&fit=clip'; }
  function widths(file){ return /\.png$/i.test(file) ? [960, 1280] : [960, 1600, 2400]; }
  function day(d){ return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fill(days){
    slots.forEach(function(img){
      var d = days[Number(img.getAttribute('data-apod')) % days.length], ws = widths(d.file);
      img.alt = d.alt;
      img.srcset = ws.map(function(w){ return sized(d.file, w) + ' ' + w + 'w'; }).join(', ');
      img.src = sized(d.file, ws[1]);
      var fig = img.closest('figure'), cap = fig && fig.querySelector('figcaption');
      if (!cap) return;
      var a = document.createElement('a');
      a.href = d.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = d.title;
      cap.textContent = (cap.getAttribute('data-label') || 'Plate') + ' · ' + day(d.date) + ' · ';
      cap.appendChild(a);
      if (d.credit) cap.appendChild(document.createTextNode(' · ' + d.credit));
    });
  }
  var kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  var keptDays = kept && kept.days && kept.days.length ? kept.days : null;
  if (keptDays && Date.now() - kept.t < TTL) return fill(keptDays);
  var ctl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function(){ if (ctl) ctl.abort(); }, 8000);
  fetch(FEED, ctl ? { signal: ctl.signal } : {}).then(function(r){
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(posts){
    var days = posts.map(safe).filter(Boolean);
    if (!days.length) throw new Error('no picture days');
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), days: days })); } catch (e) {}
    fill(days);
  }).catch(function(){
    fill(keptDays || FALLBACK);
  }).then(function(){ clearTimeout(timer); });
})();
