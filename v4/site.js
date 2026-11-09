// seansooch.dev, Vol. 04 "Side by Side". Behaviour for every edition page; the pages are written by tools/build.py.
//
// Expected behaviour:
//   - Telling: "Plain language" switches every sentence that has two tellings, on every page, and is remembered.
//   - Asking: each address in #probes is asked once from this tab (an opaque fetch with no cookies and no referrer,
//     stopped as soon as the host answers, so no page is downloaded). Its dots fill, its round trip is printed wherever it is named, and the
//     tallies (directory, record) follow. A host that has to wake reads "waking" after four seconds and gets
//     ninety; the rest get twenty. "Ask them all again" repeats it.
//   - Worlds: a chip shows one world's works. Following a link to a hidden work shows everything again.
//   - Side by side: a work with an earlier edition can give its caption's half to that edition's plate, one row
//     at a time or all at once. A work with two kept editions lets the reader pick which.
//   - Films open in a dialog and stop when it closes.
//   - Index: "/" opens it anywhere outside a text field; typing filters every entry by title and keyword; arrows
//     move, Enter opens, Escape closes. No lesson is typed into its data: the first time it opens it reads the
//     Lab's ledger, so a lesson shipped after the page was built is found on every page.
//   - The Lab: on the home page, lessons shipped after it was built are read from the same ledger and added to the
//     outline and to the printed index, in their alphabetical place, and both counts follow. An entry that is not
//     a lesson (a slug that is not plain words, a day that does not exist, a title that is not text) is left out,
//     and a title is only ever set as text.
//   - Nothing here is needed to read the page: without it every link, plate and sentence is still there.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var store = function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* not kept */ } };
  var read = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ---------- telling and theme ---------- */
  function drawVoice() {
    var plain = root.getAttribute('data-voice') === 'plain';
    $$('[data-voice-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(plain)); });
  }
  $$('[data-voice-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var plain = root.getAttribute('data-voice') !== 'plain';
      root.setAttribute('data-voice', plain ? 'plain' : 'tech');
      store('voice', plain ? 'plain' : null);
      drawVoice();
    });
  });
  drawVoice();

  function drawTheme() {
    var t = root.getAttribute('data-theme') || 'auto';
    $$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === t)); });
  }
  $$('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-theme-set');
      if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
      store('theme', t === 'auto' ? null : t);
      drawTheme();
    });
  });
  drawTheme();

  /* ---------- asking every address ---------- */
  var probes = [];
  try { probes = JSON.parse(($('script#probes') || {}).textContent || '[]'); } catch (e) { probes = []; }
  var answers = {};
  var WORDS = { asking: ['asking', 'asking now', ''], wake: ['waking', 'waking', ''], no: ['no answer', 'no answer', ''] };
  var STATE = { asking: 'asking', wake: 'waking', no: 'no answer', yes: 'answered' };

  function show(id, state, ms) {
    answers[id] = { state: state, ms: ms };
    $$('[data-dot="' + id + '"]').forEach(function (d) { d.className = 'dot is-' + state; });
    $$('[data-ms="' + id + '"]').forEach(function (el) {
      var form = el.hasAttribute('data-bare') ? 2 : el.classList.contains('ms') ? 0 : 1;
      el.textContent = state === 'yes' ? [ms + ' ms', 'answered in ' + ms + ' ms', ms + ' ms'][form] : WORDS[state][form];
    });
    $$('[data-state="' + id + '"]').forEach(function (el) { el.textContent = STATE[state]; });
  }

  function tally() {
    var done = 0, yes = [], slow = null;
    probes.forEach(function (p) {
      var a = answers[p.id];
      if (!a || a.state === 'asking' || a.state === 'wake') return;
      done++;
      if (a.state !== 'yes') return;
      yes.push(p);
      if (!slow || a.ms > answers[slow.id].ms) slow = p;
    });
    var quick = yes.filter(function (p) { return !p.wake; }).map(function (p) { return answers[p.id].ms; }).sort(function (a, b) { return a - b; });
    var median = quick.length ? (quick.length % 2 ? quick[(quick.length - 1) / 2] : Math.round((quick[quick.length / 2 - 1] + quick[quick.length / 2]) / 2)) : null;
    var all = done === probes.length;
    $$('[data-tally]').forEach(function (el) {
      el.textContent = all ? yes.length + ' of ' + probes.length + ' answered' + (median === null ? '' : ' · median ' + median + ' ms')
        : 'asking ' + probes.length + ' addresses, ' + yes.length + ' answered so far';
    });
    $$('[data-answered]').forEach(function (el) { el.textContent = String(yes.length); });
    $$('[data-median]').forEach(function (el) { el.textContent = median === null ? '…' : median + ' ms'; });
    $$('[data-slowest]').forEach(function (el) { el.textContent = slow ? answers[slow.id].ms + ' ms' : '…'; });
    if (slow) {
      var name = ($('#' + slow.id + ' h4') || {}).textContent || slow.id;
      $$('[data-slowest-name]').forEach(function (el) { el.textContent = name + (slow.wake ? ', which had to wake' : ''); });
    }
  }

  function ask(p) {
    show(p.id, 'asking');
    var t0 = performance.now(), ctl = new AbortController(), settled = false;
    var limit = setTimeout(function () { ctl.abort(); }, p.wake ? 90000 : 20000);
    var waking = p.wake ? setTimeout(function () { if (!settled) show(p.id, 'wake'); }, 4000) : 0;
    return fetch(p.url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal })
      .then(function () { settled = true; show(p.id, 'yes', Math.max(1, Math.round(performance.now() - t0))); ctl.abort(); })
      .catch(function () { settled = true; show(p.id, 'no'); })
      .then(function () { clearTimeout(limit); clearTimeout(waking); tally(); });
  }

  function askAll() {
    if (!probes.length) return;
    var at = new Date();
    $$('[data-asked]').forEach(function (el) {
      el.textContent = 'in your browser, at ' + at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    answers = {};
    tally();
    probes.forEach(ask);
  }
  $$('[data-ask]').forEach(function (b) { b.addEventListener('click', askAll); });
  if (probes.length) {
    if (doc.readyState === 'complete') askAll(); else addEventListener('load', askAll);
  }

  /* ---------- one world at a time ---------- */
  var work = $('#work');
  function filter(to) {
    if (!work) return;
    work.setAttribute('data-filter', to);
    $$('[data-filter]', work).forEach(function (b) { if (b !== work) b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === to)); });
  }
  if (work) $$('button[data-filter]', work).forEach(function (b) { b.addEventListener('click', function () { filter(b.getAttribute('data-filter')); }); });

  // A link to a work the filter hides shows everything again, then goes there.
  function reveal() {
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { /* not an address this page made */ }
    var target = id && doc.getElementById(id);
    if (!target || !work || !work.contains(target)) return;
    if (!target.offsetParent && work.getAttribute('data-filter') !== 'all') { filter('all'); target.scrollIntoView(); }
  }
  addEventListener('hashchange', reveal);
  reveal();

  /* ---------- side by side ---------- */
  function beside(article, on) {
    var prior = $('.prior', article);
    if (!prior) return;
    article.classList.toggle('is-beside', on);
    prior.hidden = !on;
    $$('[data-beside]', article).forEach(function (b) { b.setAttribute('aria-expanded', String(on)); });
    $$('[data-beside-back]', article).forEach(function (b) { b.hidden = !on; });
  }
  function drawSwitch() {
    var rows = $$('.work').filter(function (a) { return $('.prior', a); });
    var on = rows.filter(function (a) { return a.classList.contains('is-beside'); }).length;
    $$('[data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === 'beside' ? on === rows.length && on > 0 : on === 0));
    });
  }
  $$('[data-beside]').forEach(function (b) {
    b.addEventListener('click', function () {
      var article = doc.getElementById(b.getAttribute('data-beside'));
      beside(article, true);
      drawSwitch();
      var back = $('[data-beside-back]', article);
      if (back) back.focus();
    });
  });
  $$('[data-beside-back]').forEach(function (b) {
    b.addEventListener('click', function () {
      var article = doc.getElementById(b.getAttribute('data-beside-back'));
      beside(article, false);
      drawSwitch();
      var open = $('[data-beside]', article);
      if (open) open.focus();
    });
  });
  $$('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('data-view') === 'beside';
      $$('.work').forEach(function (a) { beside(a, on); });
      drawSwitch();
    });
  });
  $$('[data-prior-ed]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = b.closest('.prior'), n = b.getAttribute('data-prior-ed');
      $$('.prior-ed', box).forEach(function (f) { f.hidden = f.getAttribute('data-ed') !== n; });
      $$('[data-prior-ed]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });

  /* ---------- films ---------- */
  var film = $('#film-dialog');
  if (film && film.showModal) {
    var video = $('video', film);
    $$('[data-film]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#film-title', film).textContent = b.getAttribute('data-title') || '';
        if (b.getAttribute('data-poster')) video.poster = b.getAttribute('data-poster'); else video.removeAttribute('poster');
        video.src = b.getAttribute('data-film');
        film.showModal();
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () { /* the reader presses play */ });
      });
    });
    film.addEventListener('close', function () { video.pause(); video.removeAttribute('src'); video.load(); });
    film.addEventListener('click', function (e) { if (e.target === film) film.close(); });
    $$('[data-film-close]', film).forEach(function (b) { b.addEventListener('click', function () { film.close(); }); });
  } else {
    // No dialog element: a film opens as a file.
    $$('[data-film]').forEach(function (b) { b.addEventListener('click', function () { location.href = b.getAttribute('data-film'); }); });
  }

  /* ---------- the Lab's ledger ---------- */
  // Lessons ship without these pages being rebuilt, so whatever names a lesson here can be read from the ledger. It
  // is written outside this repo: a slug must be plain words, a date a real day, a title text. Asked once a page.
  var ledger = null;
  function realDay(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var t = new Date(d + 'T00:00:00Z');
    return !isNaN(t) && t.toISOString().slice(0, 10) === d;
  }
  function lessons() {
    if (!ledger) {
      ledger = fetch('/lab/apps.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (apps) {
        var seen = Object.create(null);
        return (Array.isArray(apps) ? apps : []).filter(function (a) {
          if (!a || typeof a.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug) || seen[a.slug]) return false;
          if (typeof a.title !== 'string' || !a.title.trim() || !realDay(a.date)) return false;
          return (seen[a.slug] = true);
        }).map(function (a) {
          // The same entry the builder prints in the index: title, address, the words it answers to, where it is.
          return { slug: a.slug, title: a.title, t: a.title + ' (lesson)', h: '/lab/' + a.slug + '/',
            k: 'lab lesson medicine ' + (typeof a.description === 'string' ? a.description : ''), s: 'The Lab' };
        });
      }).catch(function () { return []; });
    }
    return ledger;
  }
  // The order of the index, as the builder sorts it.
  function indexKey(t) { return t.toLowerCase().replace(/^(the|a) /, ''); }

  /* ---------- index ---------- */
  var palette = $('#palette'), entries = [];
  try { entries = JSON.parse(($('script#index-data') || {}).textContent || '[]'); } catch (e) { entries = []; }
  if (palette && palette.showModal && entries.length) {
    var q = $('#palette-q'), list = $('#palette-list'), at = 0, shown = [], asked = false;
    var draw = function () {
      var terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = entries.filter(function (e) {
        var hay = (e.t + ' ' + (e.k || '') + ' ' + (e.s || '')).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) > -1; });
      }).slice(0, 40);
      at = Math.min(at, Math.max(0, shown.length - 1));
      list.replaceChildren.apply(list, shown.map(function (e, i) {
        var li = doc.createElement('li'), name = doc.createElement('span'), where = doc.createElement('small');
        li.setAttribute('role', 'option');
        li.id = 'palette-' + i;
        li.setAttribute('aria-selected', String(i === at));
        name.textContent = e.t;
        where.textContent = e.s || '';
        li.append(name, where);
        li.addEventListener('click', function () { open(e); });
        return li;
      }));
      q.setAttribute('aria-activedescendant', shown.length ? 'palette-' + at : '');
      var sel = $('[aria-selected=true]', list);
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    };
    var open = function (e) {
      palette.close();
      // An entry leads to a place on this page or to a path on this site, and nowhere else.
      if (/^#[\w-]+$/.test(e.h)) { location.hash = e.h; reveal(); } else if (/^\/(?![\/\\])[^\\\s]*$/.test(e.h)) location.href = e.h;
    };
    var openPalette = function () {
      if (palette.open) return;
      q.value = '';
      at = 0;
      draw();
      palette.showModal();
      q.focus();
      if (asked || !window.fetch) return;
      asked = true;
      lessons().then(function (found) {
        if (!found.length) return;
        entries = entries.concat(found).sort(function (a, b) { var x = indexKey(a.t), y = indexKey(b.t); return x < y ? -1 : x > y ? 1 : 0; });
        draw();
      });
    };
    q.setAttribute('role', 'combobox');
    q.setAttribute('aria-controls', 'palette-list');
    q.setAttribute('aria-expanded', 'true');
    q.addEventListener('input', function () { at = 0; draw(); });
    q.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { at = Math.min(shown.length - 1, at + 1); draw(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { at = Math.max(0, at - 1); draw(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (shown[at]) open(shown[at]); }
      // A search field spends its first Escape on clearing itself; here one press closes the index, as its foot says.
      else if (ev.key === 'Escape') { ev.preventDefault(); palette.close(); }
    });
    palette.addEventListener('click', function (e) { if (e.target === palette) palette.close(); });
    $$('[data-palette-open]').forEach(function (b) { b.addEventListener('click', openPalette); });
    addEventListener('keydown', function (ev) {
      if (ev.key !== '/' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var el = doc.activeElement, tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      if ($('dialog[open]')) return;
      ev.preventDefault();
      openPalette();
    });
  }

  /* ---------- the home page: lessons shipped after it was built ---------- */
  var fresh = $('[data-lab-new]'), printed = $('.ix-cols');
  // A lesson's line in the printed index: under its letter, in its alphabetical place.
  function indexLine(e) {
    var key = indexKey(e.t), c = key.charAt(0), letter = c.toUpperCase() !== c.toLowerCase() ? c.toUpperCase() : '#';
    var groups = $$('.ix-g', printed);
    var group = groups.filter(function (g) { return $('h3', g).textContent === letter; })[0];
    if (!group) {
      group = doc.createElement('div');
      group.className = 'ix-g';
      group.append(doc.createElement('h3'));
      group.firstChild.textContent = letter;
      printed.insertBefore(group, groups.filter(function (g) { return $('h3', g).textContent > letter; })[0] || null);
    }
    var line = doc.createElement('a');
    line.className = 'ix';
    line.href = e.h;
    line.textContent = e.t;
    group.insertBefore(line, $$('a.ix', group).filter(function (x) { return indexKey(x.textContent) > key; })[0] || null);
  }
  if (fresh && window.fetch) {
    lessons().then(function (found) {
      var have = Object.create(null), added = 0;
      $$('[data-lesson]').forEach(function (a) { have[a.getAttribute('data-lesson')] = true; });
      found.forEach(function (e) {
        if (have[e.slug]) return;
        var li = doc.createElement('li'), link = doc.createElement('a');
        link.href = e.h;
        link.setAttribute('data-lesson', e.slug);
        link.textContent = e.title;
        li.append(link);
        fresh.append(li);
        if (printed) indexLine(e);
        have[e.slug] = true;
        added++;
      });
      if (!added) return;
      var box = fresh.closest('[data-lab-more]');
      if (box) box.hidden = false;
      $$('[data-lab-n]').forEach(function (el) { el.textContent = String(Object.keys(have).length); });
      if (printed) $$('[data-ix-n]').forEach(function (el) { el.textContent = String($$('a.ix', printed).length); });
    });
  }
})();
