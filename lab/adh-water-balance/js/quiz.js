// The Quiz and Summary tabs, after the Lab kit: plan.json's questions, one try each, every answer
// explained with its source and a link back to the step that teaches it; then the lesson on one
// printable page: takeaways, goals with the reader's score, the loop, a table of every state, and
// a glossary of every term the steps define.
(() => {
const A = window.ADH;
const $ = (s, r = document) => r.querySelector(s);
const { esc } = A.draw;

function stepLink(ctx, kind) {
  const i = ctx.steps.findIndex(s => s.dataset.kind === kind);
  return i < 0 ? '' : `<a href="#step-${i + 1}">Review step ${i + 1}: ${esc(ctx.steps[i].dataset.stepTitle)}</a>`;
}

function renderQuiz(ctx) {
  const box = $('#quiz'), plan = ctx.plan;
  const qs = plan?.quiz || [];
  if (!qs.length) { box.innerHTML = '<p class="hint">The questions for this lesson could not be loaded. Reload the page to try again.</p>'; return; }
  const rec = ctx.record();
  const right = qs.filter(q => rec.quiz[q.id] === true).length, answered = qs.filter(q => rec.quiz[q.id] !== undefined).length;
  box.innerHTML = `<div class="lx-quiz-head"><h2 tabindex="-1">Check yourself</h2><p class="lx-score" aria-live="polite"><b>${right}</b> of ${qs.length} right${answered < qs.length ? ` · ${qs.length - answered} to go` : ''}</p></div>`
    + '<p class="hint">One try each. Every answer explains itself, names its source and links back to the step that teaches it.</p><ol class="lx-qs"></ol>'
    + `<div class="lx-quiz-foot"><p>${answered === qs.length ? (right === qs.length ? 'All right. The summary has the whole lesson on one page.' : 'Review the steps linked above, then try again.') : ''}</p>`
    + '<button type="button" data-lx-again>Try again</button><a href="#summary">Lesson summary</a></div>';
  const list = $('.lx-qs', box);
  for (const q of qs) {
    const li = document.createElement('li');
    li.dataset.q = q.id;
    const got = rec.quiz[q.id], pick = rec.picks?.[`quiz:${q.id}`];
    li.innerHTML = `<div><p class="lx-meta">Goal ${esc(q.objective)}</p><p class="lx-stem"></p></div>`;
    $('.lx-stem', li).textContent = q.stem;
    li.firstElementChild.append(A.choiceList(`quiz:${ctx.slug}:${q.id}${rec.round ? `:${rec.round}` : ''}`, q.choices, got === undefined ? undefined : pick, q.answer, orig => {
      ctx.update(l => { l.quiz[q.id] = orig === q.answer; l.picks = { ...(l.picks || {}), [`quiz:${q.id}`]: orig }; });
      renderQuiz(ctx);
      ctx.renderPlan();
      $(`[data-q="${q.id}"] .lx-verdict`, box)?.focus({ preventScroll: true });
    }));
    if (got !== undefined) {
      const fb = document.createElement('div');
      fb.innerHTML = `<p class="lx-verdict ${got ? 'is-right' : 'is-wrong'}" tabindex="-1">${got ? 'Right.' : 'Not quite.'}</p><p class="lx-why"></p><p class="lx-review">${stepLink(ctx, q.step)}</p>`;
      $('.lx-why', fb).textContent = q.why;
      li.firstElementChild.append(fb);
    }
    list.append(li);
  }
  $('[data-lx-again]', box).addEventListener('click', () => {
    ctx.update(l => { l.quiz = {}; l.round = (l.round || 0) + 1; l.picks = Object.fromEntries(Object.entries(l.picks || {}).filter(([k]) => !k.startsWith('quiz:'))); });
    renderQuiz(ctx); ctx.renderPlan();
    $('h2', box).focus();
  });
}

// Every term the steps define (their <dfn>s), with the sentence that defines it.
function glossary(ctx) {
  const seen = new Map();
  ctx.steps.forEach((el, i) => {
    const cap = $('.caption', el);
    if (!cap) return;
    const sentences = cap.textContent.replace(/\s+/g, ' ').trim().replace(/([.!?])\s+(?=[A-Z0-9])/g, '$1\n').split('\n');
    for (const d of cap.querySelectorAll('dfn')) {
      const term = d.textContent.replace(/\s+/g, ' ').trim(), key = term.toLowerCase();
      if (!term || seen.has(key)) continue;
      seen.set(key, { term, sentence: sentences.find(s => s.includes(term)) || sentences[0], step: i });
    }
  });
  return [...seen.values()];
}

function renderSummary(ctx) {
  const box = $('#summary'), plan = ctx.plan;
  if (!plan) { box.innerHTML = '<p class="hint">The summary could not be loaded. Reload the page to try again.</p>'; return; }
  const { STATES, STATE_ORDER, WORDS } = A;
  const cols = [['adh', 'ADH'], ['aquaporins', 'Water channels'], ['urineVolume', 'Urine volume'], ['urineConcentration', 'Urine concentration'], ['sodiumMarker', 'Blood sodium']];
  const rows = STATE_ORDER.map(id => {
    const s = STATES[id];
    return `<tr><th scope="row">${esc(s.label)}</th>${cols.map(([k, name]) => `<td data-label="${esc(name)}">${esc(WORDS[k][s[k]])}</td>`).join('')}</tr>`;
  }).join('');
  const terms = glossary(ctx), before = plan.before ? ctx.lessonLink(plan.before) : '';
  box.innerHTML = '<div class="lx-sum">'
    + `<section><p class="note">Educational, not for clinical use</p><h2 tabindex="-1">The lesson in one minute</h2><ol class="lx-takeaways">${(plan.takeaways || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
    + `<h2 style="margin-top:28px">Your goals</h2>${ctx.goalsList()}`
    + `<div class="lx-next">${before ? `<p><b>Before this:</b> ${before}</p>` : ''}<p><a href="/lab/">All lessons</a></p></div>`
    + '<button type="button" class="lx-print" data-lx-print>Print this summary</button></section>'
    + `<section><h2>Terms</h2><dl class="lx-terms">${terms.map(t => `<dt>${esc(t.term)}</dt><dd>${esc(t.sentence)} <a href="#step-${t.step + 1}">step ${t.step + 1}</a></dd>`).join('')}</dl></section>`
    + '<section class="adh-sum"><h2>The loop</h2><p class="adh-loop">Blood too concentrated → osmoreceptors in the hypothalamus fire → the posterior pituitary releases ADH → ADH docks on collecting duct cells → water channels move into the membrane → water returns to the blood → less, more concentrated urine → the blood dilutes and ADH falls.</p>'
    + `<h2>Each state at a glance</h2><table class="adh-table"><thead><tr><th scope="col">State</th>${cols.map(([, n]) => `<th scope="col">${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
    + '<p class="model-note">“Not stated” means the cited sources give no direction; the Clinical values tab shows every quote.</p></section>'
    + '</div>';
  $('[data-lx-print]', box).addEventListener('click', () => print());
}

A.quiz = { renderQuiz, renderSummary };
})();
