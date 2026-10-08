// Monitoring the Situation: loads the daily briefing from the feed Worker and renders it.
// Feed text comes from X and the web, so it is only ever set with textContent and
// createElement (never innerHTML), and only https: links are rendered.
(function () {
  'use strict';

  var FEED_URL = 'https://feed.seansooch.dev/v1/feed.json';
  var SAVED_URL = '/monitor/feed.json';
  var TIMEOUT_MS = 8000;
  var STALE_MS = 30 * 60 * 60 * 1000;
  var SOURCE_LABELS = { x: 'From X', web: 'From the web', both: 'X and web' };

  var feedEl = document.getElementById('feed');
  var statusEl = document.getElementById('status');
  var timeEl = document.getElementById('status-time');
  var staleEl = document.getElementById('status-stale');
  var savedEl = document.getElementById('status-saved');
  var tocList = null;
  var announceEl = document.getElementById('announce');
  var generatedAt = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function isStr(v) { return typeof v === 'string' && v.trim() !== ''; }

  function safeHttps(url) {
    if (typeof url !== 'string') return null;
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
    } catch (e) { return null; }
  }

  function getJSON(url, timeoutMs) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    return fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // Keep only well-formed sections, items and https links. Returns null if nothing usable is left.
  function clean(doc) {
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.sections)) return null;
    var t = Date.parse(doc.generated_at);
    if (isNaN(t)) return null;
    var sections = [];
    doc.sections.forEach(function (s) {
      if (!s || !isStr(s.name) || !Array.isArray(s.items)) return;
      var items = [];
      s.items.forEach(function (it) {
        if (!it || !isStr(it.headline)) return;
        var links = [];
        (Array.isArray(it.links) ? it.links : []).forEach(function (l) {
          var href = l && safeHttps(l.url);
          if (href && isStr(l.label)) links.push({ label: l.label, url: href });
        });
        items.push({
          headline: it.headline,
          summary: typeof it.summary === 'string' ? it.summary : '',
          links: links,
          source: SOURCE_LABELS[it.source_type] || null
        });
      });
      sections.push({ name: s.name, items: items });
    });
    return sections.length ? { generatedAt: new Date(t), sections: sections } : null;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function slug(name, i) {
    return 'sec-' + pad(i + 1) + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function renderSection(s, i) {
    var id = slug(s.name, i);
    var sec = el('section', 'sec');
    sec.id = id;
    sec.setAttribute('aria-labelledby', id + '-h');
    var no = el('span', 'no', pad(i + 1));
    no.setAttribute('aria-hidden', 'true');
    sec.appendChild(no);

    var body = el('div', 'sec-body');
    var h2 = el('h2', null, s.name);
    h2.id = id + '-h';
    body.appendChild(h2);

    if (!s.items.length) {
      body.appendChild(el('p', 'empty', 'Nothing to report today.'));
    } else {
      var list = el('ol', 'items');
      s.items.forEach(function (it) {
        var li = el('li', 'item');
        var art = el('article');
        art.appendChild(el('h3', null, it.headline));
        if (it.summary) art.appendChild(el('p', null, it.summary));
        if (it.links.length || it.source) {
          var links = el('ul', 'links');
          links.setAttribute('aria-label', 'Sources');
          it.links.forEach(function (l) {
            var a = el('a', null, l.label);
            a.href = l.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.appendChild(el('span', 'vh', ' (opens in a new tab)'));
            var lli = el('li');
            lli.appendChild(a);
            links.appendChild(lli);
          });
          if (it.source) {
            var sli = el('li');
            sli.appendChild(el('span', 'src', it.source));
            links.appendChild(sli);
          }
          art.appendChild(links);
        }
        li.appendChild(art);
        list.appendChild(li);
      });
      body.appendChild(list);
    }
    sec.appendChild(body);

    var tli = el('li');
    var ta = el('a');
    ta.href = '#' + id;
    var tno = el('span', 'no', pad(i + 1));
    tno.setAttribute('aria-hidden', 'true');
    ta.appendChild(tno);
    ta.appendChild(document.createTextNode(s.name));
    tli.appendChild(ta);
    tocList.appendChild(tli);
    return sec;
  }

  function ago(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.round(m / 60);
    if (h < 48) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    return d + ' days ago';
  }

  function updateTime() {
    if (!generatedAt) return;
    var age = Date.now() - generatedAt.getTime();
    var stamp = generatedAt.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
    var t = el('time', null, 'Updated ' + ago(Math.max(0, age)));
    t.dateTime = generatedAt.toISOString();
    t.title = stamp;
    timeEl.textContent = '';
    timeEl.appendChild(t);
    timeEl.appendChild(el('span', 'vh', ' (' + stamp + ')'));
    var stale = age > STALE_MS;
    staleEl.hidden = !stale;
    statusEl.classList.toggle('is-stale', stale);
  }

  function render(data, saved) {
    generatedAt = data.generatedAt;
    // The section index goes inside #feed, so it replaces the loading placeholder in one step (no layout shift).
    var frag = document.createDocumentFragment();
    var toc = el('nav', 'toc');
    toc.setAttribute('aria-label', 'Sections');
    tocList = el('ol');
    toc.appendChild(tocList);
    frag.appendChild(toc);
    var secs = el('div', 'secs');
    data.sections.forEach(function (s, i) { secs.appendChild(renderSection(s, i)); });
    frag.appendChild(secs);
    feedEl.textContent = '';
    feedEl.appendChild(frag);
    feedEl.setAttribute('aria-busy', 'false');
    savedEl.hidden = !saved;
    updateTime();
    setInterval(updateTime, 60000);
    // One announcement per load; the minute tick above updates the text silently.
    announceEl.textContent = 'Briefing loaded, ' + timeEl.textContent.replace(/^Updated/, 'updated') +
      (staleEl.hidden ? '' : '. ' + staleEl.textContent) + (saved ? '. ' + savedEl.textContent : '') + '.';
  }

  function fail() {
    feedEl.textContent = '';
    feedEl.appendChild(el('p', 'note', 'The briefing could not be loaded. Check your connection and reload the page.'));
    feedEl.setAttribute('aria-busy', 'false');
    timeEl.textContent = 'Briefing unavailable';
    announceEl.textContent = 'The briefing could not be loaded.';
  }

  function loadSaved() {
    return getJSON(SAVED_URL, TIMEOUT_MS).then(function (doc) {
      var data = clean(doc);
      if (!data) throw new Error('saved copy unusable');
      render(data, true);
    });
  }

  getJSON(FEED_URL, TIMEOUT_MS)
    .then(function (doc) {
      var data = clean(doc);
      if (!data) throw new Error('feed unusable');
      render(data, false);
    })
    .catch(function () { return loadSaved(); })
    .catch(fail);
})();
