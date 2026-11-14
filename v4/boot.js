// seansooch.dev, Vol. 04. Runs before the first paint, so a returning reader never sees the page flash the other
// telling or the other theme. Everything else is /v4/site.js.
//
// Expected behaviour:
//   - <html> gets class "js": controls that need scripts are only shown when scripts run.
//   - A reader who chose plain language or a theme gets it at once (kept in this browser only).
//   - Storage can be missing or blocked: the page then keeps its defaults (technical, as the device).
//   - An address to an anchor the home page gave up (named in its data-moved, such as /#editions from a lesson's bar)
//     is sent on to the same anchor on the record page before anything is drawn.
(function () {
  var d = document.documentElement;
  var moved = d.getAttribute('data-moved'), at = location.hash.slice(1);
  if (moved && at && (' ' + moved + ' ').indexOf(' ' + at + ' ') > -1) { location.replace('/record/#' + at); return; }
  d.classList.add('js');
  try {
    if (localStorage.getItem('voice') === 'plain') d.setAttribute('data-voice', 'plain');
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark' || t === 'usa') d.setAttribute('data-theme', t);
  } catch (e) { /* defaults stand */ }
})();
