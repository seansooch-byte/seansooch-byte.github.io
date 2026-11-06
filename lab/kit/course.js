// The Lab kit, course page: the reader's own progress drawn over the course list that
// tools/lab-index.mjs wrote into /lab/, and the mixed review.
//
// Expected behaviour:
//   - Each lesson row ([data-slug] with data-steps and data-quiz) gets a bar for the steps seen and
//     a line of words: "Not started", "Step 7 of 16", "All 16 steps seen", plus the quiz score once
//     any question is answered. Its dot on the course map is empty, half filled or filled.
//   - The resume card offers the lesson read most recently that is not finished, at the step the
//     reader left; if every started lesson is finished, the next lesson in the course; if nothing is
//     started, Lesson 1. A change in another tab redraws everything.
//   - Mixed review: ten questions drawn at random from the lessons the reader has started (from the
//     whole course if fewer than two are started), each with its lesson named, one try each, its
//     answer explained and a link to the step that teaches it. Review answers are practice: they do
//     not change any lesson's quiz.
//   - Progress lives in this browser only (progress.js); the page works the same without it.
import { readAll, standing, onChange } from './progress.js';
import { choiceList } from './quiz.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rows = () => $$('.lesson[data-slug]');
const titleOf = row => row.querySelector('h3')?.textContent.trim() || row.dataset.slug;
const numberOf = row => row.querySelector('.no')?.textContent.trim().replace(/^0/, '') || '';
let stepTable = {};
try { stepTable = JSON.parse($('#lab-steps')?.textContent || '{}'); } catch { stepTable = {}; }

function draw() {
  const all = readAll().lessons;
  for (const row of rows()) {
    const slug = row.dataset.slug, steps = +row.dataset.steps || 0, quiz = +row.dataset.quiz || 0;
    const st = standing(all[slug] || {}, steps, quiz);
    const box = row.querySelector('[data-lab-progress]');
    if (box) {
      box.querySelector('.bar i').style.width = `${steps ? Math.round(100 * st.seen / steps) : 0}%`;
      const where = !st.started ? 'Not started' : st.finished ? `All ${steps} steps seen` : `Step ${(all[slug]?.step ?? 0) + 1} of ${steps}`;
      box.querySelector('.state').textContent = where + (st.answered ? ` · quiz ${st.right} of ${quiz} right` : '');
    }
    row.classList.toggle('is-started', st.started);
    row.classList.toggle('is-done', st.finished);
    const dot = $(`[data-lab-dot="${slug}"]`);
    if (dot) {
      dot.classList.toggle('is-started', st.started && !st.finished);
      dot.classList.toggle('is-done', st.finished);
      dot.title = `${dot.title.split(' (')[0]}${st.started ? ` (${st.finished ? 'done' : `step ${(all[slug]?.step ?? 0) + 1} of ${steps}`})` : ''}`;
    }
  }
  drawResume(all);
}

function drawResume(all) {
  const box = $('[data-lab-resume]');
  if (!box) return;
  const list = rows();
  const info = list.map(row => ({ row, rec: all[row.dataset.slug], st: standing(all[row.dataset.slug] || {}, +row.dataset.steps || 0, +row.dataset.quiz || 0) }));
  const open = info.filter(i => i.st.started && !i.st.finished).sort((a, b) => (b.rec.at || 0) - (a.rec.at || 0))[0];
  const startedAny = info.some(i => i.st.started);
  const done = info.filter(i => i.st.finished).length;
  let label, what, sub, href, go;
  if (open) {
    const step = (open.rec.step ?? 0) + 1;
    label = 'Pick up where you left off';
    what = `Lesson ${numberOf(open.row)}: ${titleOf(open.row)}`;
    sub = `Step ${step} of ${open.row.dataset.steps}${done ? ` · ${done} of ${list.length} lessons finished` : ''}`;
    href = `/lab/${open.row.dataset.slug}/#step-${step}`;
    go = 'Continue →';
  } else if (startedAny) {
    const next = info.find(i => !i.st.finished);
    if (!next) { label = 'Course finished'; what = `All ${list.length} lessons seen`; sub = 'Keep it fresh with a mixed review below.'; href = '#review'; go = 'Mixed review →'; }
    else { label = 'Next in the course'; what = `Lesson ${numberOf(next.row)}: ${titleOf(next.row)}`; sub = `${done} of ${list.length} lessons finished`; href = `/lab/${next.row.dataset.slug}/`; go = 'Start →'; }
  } else {
    const first = list[0];
    if (!first) { box.replaceChildren(); return; }
    label = 'New here?';
    what = `Start with Lesson ${numberOf(first)}: ${titleOf(first)}`;
    sub = 'Every lesson stands alone, so you can also start at any unit below.';
    href = `/lab/${first.dataset.slug}/`;
    go = 'Start →';
  }
  box.innerHTML = `<div class="card"><p class="label">${esc(label)}</p><p class="what">${esc(what)}</p><p class="sub">${esc(sub)}</p><a class="go" href="${esc(href)}">${esc(go)}</a></div>`;
}

/* ---------- Mixed review ---------- */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function startReview() {
  const box = $('[data-lab-review]');
  const all = readAll().lessons;
  const started = rows().filter(r => all[r.dataset.slug] && standing(all[r.dataset.slug], +r.dataset.steps || 0, +r.dataset.quiz || 0).started);
  const pool = started.length >= 2 ? started : rows();
  box.innerHTML = '<p class="rv-from">Gathering questions…</p>';
  const plans = await Promise.all(pool.map(row => fetch(`/lab/${row.dataset.slug}/plan.json`).then(r => r.ok ? r.json() : null).catch(() => null)));
  const items = [];
  pool.forEach((row, i) => { for (const q of plans[i]?.quiz || []) items.push({ ...q, slug: row.dataset.slug, lesson: `Lesson ${numberOf(row)}: ${titleOf(row)}` }); });
  if (!items.length) { box.innerHTML = '<p>The questions could not be loaded. Reload the page to try again.</p>'; return; }
  const set = shuffle(items).slice(0, 10), answers = new Map();
  const render = () => {
    const right = [...answers.values()].filter(Boolean).length;
    box.innerHTML = `<div class="rv-head"><p class="rv-from">${started.length >= 2 ? `From the ${started.length} lessons you have started` : 'From the whole course'}</p><p class="rv-score" aria-live="polite"><b>${right}</b> of ${set.length} right</p></div><ol class="rv-qs"></ol>`
      + `<div class="rv-foot"><p>${answers.size === set.length ? (right === set.length ? 'All right.' : 'Follow the links to the steps you missed, then try another set.') : ''}</p><button type="button" data-lab-review-start>Another ten</button></div>`;
    const list = box.querySelector('.rv-qs');
    for (const q of set) {
      const key = `${q.slug}:${q.id}`, li = document.createElement('li'), inner = document.createElement('div');
      inner.innerHTML = `<p class="rv-from">${esc(q.lesson)}</p><p class="rv-stem"></p>`;
      inner.querySelector('.rv-stem').textContent = q.stem;
      const got = answers.get(key);
      inner.append(choiceList(`review:${key}`, q.choices, got === undefined ? undefined : q.picked, q.answer, orig => {
        q.picked = orig;
        answers.set(key, orig === q.answer);
        render();
        box.querySelector(`[data-key="${CSS.escape(key)}"] .rv-verdict`)?.focus({ preventScroll: true });
      }));
      if (got !== undefined) {
        const n = stepTable[q.slug]?.[q.step];
        const fb = document.createElement('div');
        fb.innerHTML = `<p class="rv-verdict ${got ? 'is-right' : 'is-wrong'}" tabindex="-1">${got ? 'Right.' : 'Not quite.'}</p><p class="rv-why"></p>`
          + `<p class="rv-link"><a href="/lab/${esc(q.slug)}/${n ? `#step-${n}` : '#quiz'}">${n ? `Review step ${n} of ${esc(q.lesson)}` : `Open ${esc(q.lesson)}`}</a></p>`;
        fb.querySelector('.rv-why').textContent = q.why;
        inner.append(fb);
      }
      li.dataset.key = key;
      li.append(inner);
      list.append(li);
    }
    box.querySelector('[data-lab-review-start]').addEventListener('click', startReview);
  };
  render();
  box.querySelector('.rv-head')?.scrollIntoView({ block: 'nearest' });
}

function start() {
  draw();
  onChange(draw);
  addEventListener('pageshow', draw);   // coming back from a lesson with the back button
  $('[data-lab-review-start]')?.addEventListener('click', startReview);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
