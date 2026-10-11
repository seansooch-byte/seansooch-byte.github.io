/* Force Multipliers briefing cards: the "Check yourself" block. Shipped at /force-multipliers/brief.js, loaded by every card.

   Expected behaviour (no test rig on these static pages, so this comment is the spec):
   - Markup: .quiz holds fieldset.q[data-answer], each with .opts button[data-o] and a details.why.
   - Before any answer the explanation is shut. Without this script the reader can still open it by hand.
   - Choosing an option commits that question: every option is disabled, the chosen one is marked right or
     wrong, the correct one is always marked right, and the explanation opens. Focus moves to the explanation's
     summary, because the button that held it has just been disabled.
   - .quiz-score (aria-live) reads "N of M answered" until the last one, then "X of M right".
   - Nothing is stored. A reload is a clean card. */
(function () {
  document.querySelectorAll('.quiz').forEach(function (quiz) {
    var qs = Array.prototype.slice.call(quiz.querySelectorAll('.q'));
    var score = quiz.querySelector('.quiz-score');
    var done = 0, right = 0;
    qs.forEach(function (q) {
      var answer = q.getAttribute('data-answer');
      var opts = Array.prototype.slice.call(q.querySelectorAll('.opts button'));
      opts.forEach(function (b) {
        b.addEventListener('click', function () {
          if (q.hasAttribute('data-done')) return;
          q.setAttribute('data-done', '');
          var ok = b.getAttribute('data-o') === answer;
          opts.forEach(function (o) {
            o.disabled = true;
            if (o.getAttribute('data-o') === answer) o.classList.add('right');
          });
          if (!ok) b.classList.add('wrong');
          b.setAttribute('aria-pressed', 'true');
          var why = q.querySelector('.why');
          if (why) { why.open = true; var sum = why.querySelector('summary'); if (sum) sum.focus({ preventScroll: true }); }
          done += 1; if (ok) right += 1;
          if (score) score.textContent = done < qs.length ? done + ' of ' + qs.length + ' answered' : right + ' of ' + qs.length + ' right';
        });
      });
    });
  });
})();
