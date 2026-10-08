/* The Lab on the three home pages and on the Lab pages of views F and O: one ledger, drawn by each view.

   Expected:
   - The course is /lab/syllabus.json (every lesson, in teaching order). /lab/apps.json says which lessons have
     shipped and when. The lab pipeline writes both, so a lesson that ships shows up here with no rebuild of the
     page. Wording comes from the syllabus and the date from the ledger, as on /lab/ itself.
   - A view marks a container [data-lab-list="ready"] (shipped lessons only) or [data-lab-list="all"] (the whole
     course) and writes its own row once, as <template data-lab-row="ready"> and, for a lesson not yet shipped,
     <template data-lab-row="soon">. Rows are added after whatever the container already holds.
   - Inside a row, [data-lab="no|no2|title|description|topics|date"] takes that text, [data-lab-link] takes the
     lesson's address (href on a link, data-href on anything else) and [data-lab-index] becomes an index entry.
   - Anywhere on the page, [data-lab-text="{ready} of {total} ready"] takes its pattern filled in ({ready},
     {total}, {left}, {latest}), and an element marked [data-lab-wait] is removed once the rows are in.
   - Everything is set as text, never as markup. A slug that is not a plain path segment is dropped. Titles are
     set with a hyphen where the syllabus has a dash.
   - If either file cannot be read, or the course is empty, the page keeps what it was served with. A ledger
     entry whose date is not a real day has not shipped. Nothing is sent anywhere.
   - Rows drawn above the window do not move the reader. When the rows are in, document gets a "lab:course"
     event, so a view can read its index again. */
(function () {
  'use strict';
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
  var TEXT = ['no', 'no2', 'title', 'description', 'topics', 'date'];
  var HOST = typeof location === 'undefined' ? '' : location.origin;  // an index entry prints its address in full

  function plain(s) { return String(s == null ? '' : s).replace(/[\u2013\u2014]/g, '-'); }
  function day(d) {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  }
  function real(d) { return typeof d === 'string' && DAY.test(d) && !isNaN(new Date(d + 'T12:00:00Z')); }
  function segment(s) { return typeof s === 'string' && SLUG.test(s); }  // test() alone would turn null into "null"
  function row(no, source, app) {
    return {
      no: no, no2: /^\d$/.test(no) ? '0' + no : no, slug: source.slug, ready: !!app,
      title: plain(source.title), description: plain(source.description),
      topics: plain((Array.isArray(source.drugClasses) ? source.drugClasses : []).join(', ')),
      date: app ? day(app.date) : '', href: app ? HOST + '/lab/' + source.slug + '/' : ''
    };
  }
  function course(syllabus, apps) {
    var shipped = Object.create(null), dates = [];  // keyed by slug: no inherited names
    (Array.isArray(apps) ? apps : []).forEach(function (a) {
      if (a && segment(a.slug) && real(a.date) && !shipped[a.slug]) { shipped[a.slug] = a; dates.push(a.date); }
    });
    var listed = Object.create(null), lessons = [];
    (syllabus && Array.isArray(syllabus.modules) ? syllabus.modules : []).forEach(function (m) {
      if (!m || !segment(m.slug) || listed[m.slug]) return;
      listed[m.slug] = true;
      lessons.push(row(String(lessons.length + 1), m, shipped[m.slug]));
    });
    // A shipped app that is not, or is no longer, in the syllabus stays reachable, after the course.
    Object.keys(shipped).filter(function (s) { return !listed[s]; })
      .sort(function (x, y) { return shipped[x].date.localeCompare(shipped[y].date); })
      .forEach(function (s) { lessons.push(row('+', shipped[s], shipped[s])); });
    var ready = lessons.filter(function (l) { return l.ready; }).length;
    return {lessons: lessons, ready: ready, total: lessons.length, left: lessons.length - ready, latest: dates.length ? day(dates.sort().pop()) : ''};
  }
  function fillText(pattern, c) {
    return String(pattern).replace(/\{(ready|total|left|latest)\}/g, function (_, key) { return String(c[key]); });
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {course: course, fillText: fillText}; return; }

  function draw(c) {
    var anchored = window.CSS && CSS.supports && CSS.supports('overflow-anchor', 'auto');
    [].forEach.call(document.querySelectorAll('[data-lab-list]'), function (list) {
      var was = list.getBoundingClientRect(), only = list.getAttribute('data-lab-list') === 'ready';
      [].forEach.call(list.querySelectorAll('[data-lab-drawn]'), function (e) { e.remove(); });
      c.lessons.forEach(function (l) {
        if (only && !l.ready) return;
        var mould = list.querySelector('template[data-lab-row="' + (l.ready ? 'ready' : 'soon') + '"]');
        if (!mould || !mould.content.firstElementChild) return;
        var el = mould.content.firstElementChild.cloneNode(true);
        el.setAttribute('data-lab-drawn', '');
        [el].concat([].slice.call(el.querySelectorAll('*'))).forEach(function (e) {
          var field = e.getAttribute('data-lab');
          if (TEXT.indexOf(field) >= 0) e.textContent = l[field];
          if (e.hasAttribute('data-lab-link') && l.href) e.setAttribute(e.tagName === 'A' ? 'href' : 'data-href', l.href);
          if (e.hasAttribute('data-lab-index')) {
            e.setAttribute('data-index', l.title + ' (Lab lesson)');
            e.setAttribute('data-kw', ('lab lesson ' + l.topics).toLowerCase());
          }
        });
        list.appendChild(el);
      });
      var grew = list.getBoundingClientRect().height - was.height;
      if (grew > 0 && was.bottom < 0 && !anchored) window.scrollBy({top: grew, left: 0, behavior: 'instant'});
    });
    [].forEach.call(document.querySelectorAll('[data-lab-text]'), function (e) { e.textContent = fillText(e.getAttribute('data-lab-text'), c); });
    [].forEach.call(document.querySelectorAll('[data-lab-wait]'), function (e) { e.remove(); });
    document.documentElement.setAttribute('data-lab', 'drawn');
    document.dispatchEvent(new CustomEvent('lab:course', {detail: c}));
  }
  function read(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });
  }
  function start() {
    if (!document.querySelector('[data-lab-list],[data-lab-text]')) return;
    Promise.all([read('/lab/syllabus.json'), read('/lab/apps.json')])
      .then(function (files) {
        var c = course(files[0], files[1]);
        if (!c.total) throw new Error('the course is empty');  // nothing to draw: keep what the page was served with
        draw(c);
      })
      .catch(function () { document.documentElement.setAttribute('data-lab', 'unread'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
