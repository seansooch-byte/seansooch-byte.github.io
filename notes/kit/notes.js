/* Field Notes, the list of posts (/notes/): show one desk's posts.
   Expected behaviour:
   - The page is complete without this file: every post is listed and every day with a post is a link. The desk
     buttons are in the page hidden; this file shows them, so a reader without scripts never sees a dead control.
   - A click on a desk button hides every row (.row) that does not carry that desk in data-desks, marks the
     calendar days (.day.has) that do not carry it as .off, and hides every month left with no row showing.
     "Every desk" (data-desk="") shows them all again.
   - Exactly one button is pressed (aria-pressed) at a time. Nothing is stored and nothing is fetched. */
(function () {
  'use strict';
  var nav = document.querySelector('[data-notes-filter]');
  if (!nav) return;
  nav.hidden = false;
  function carries(el, desk) {
    return !desk || (' ' + el.getAttribute('data-desks') + ' ').indexOf(' ' + desk + ' ') > -1;
  }
  nav.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-desk]');
    if (!button) return;
    var desk = button.getAttribute('data-desk');
    nav.querySelectorAll('button[data-desk]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === button));
    });
    document.querySelectorAll('[data-notes-month]').forEach(function (month) {
      var shown = 0;
      month.querySelectorAll('.row').forEach(function (row) {
        row.hidden = !carries(row, desk);
        if (!row.hidden) shown += 1;
      });
      month.querySelectorAll('.day.has').forEach(function (day) {
        day.classList.toggle('off', !carries(day, desk));
      });
      month.hidden = !shown;
    });
  });
})();
