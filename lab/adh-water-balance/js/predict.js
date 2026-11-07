// The state the reference tabs show, shared by Explore freely and Clinical values, and the
// prediction every change of it asks for first: "What happens to urine volume?" The answer comes
// from the table (states.js), always compared with the baseline, the only comparison the sources
// make; where they give no direction the answer is recorded but not graded. Nothing is skipped and
// nothing is remembered: every change, and every replay of one, asks again.
(() => {
const A = window.ADH;
const { STATES, volumeAnswer } = A;

const listeners = new Set();
let current = 'baseline';
const store = {
  get current() { return current; },
  // from: the state the change starts from (a replay starts again from the state before it).
  set(id, how, from = current) { current = id; for (const fn of listeners) fn(id, from, how); },
  on(fn) { listeners.add(fn); },
};

const CHOICES = [['up', 'Goes up'], ['down', 'Goes down'], ['same', 'No change']];
const SAID = { up: 'goes up', down: 'goes down', same: 'does not change' };

// box: an element the question is drawn into. ask(to, from) shows the question for a change from
// `from` (default: the current state) to `to`; answering applies it (store.set) and keeps the verdict.
function gate(box, { origin }) {
  let target = null, start = null;
  function clear() { target = null; box.replaceChildren(); box.hidden = true; }
  function ask(to, from = current) {
    if (to === from) { clear(); return; }
    target = to; start = from;
    box.hidden = false;
    box.className = 'lx-check adh-gate';
    box.innerHTML = '<p class="lx-tag">Predict first</p><p class="lx-q"></p><ul class="lx-choices adh-choices"></ul>';
    box.querySelector('.lx-q').textContent = to === 'baseline'
      ? `Going back from ${STATES[from].short} to the baseline: what happens to urine volume?`
      : `Compared with the baseline, what happens to urine volume in ${STATES[to].short}?`;
    const ul = box.querySelector('ul');
    for (const [key, words] of CHOICES) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = words; b.dataset.predict = key;
      b.addEventListener('click', () => answer(key));
      li.append(b); ul.append(li);
    }
  }
  function answer(key) {
    if (!target) return;
    const to = target, from = start, right = volumeAnswer(from, to);
    target = null;
    for (const b of box.querySelectorAll('[data-predict]')) {
      b.disabled = true;
      if (right === null) b.classList.add(b.dataset.predict === key ? 'is-picked' : 'is-dim');
      else if (b.dataset.predict === right) b.classList.add('is-right');
      else if (b.dataset.predict === key) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    }
    const v = document.createElement('p');
    v.tabIndex = -1;
    if (right === null) {
      v.className = 'lx-verdict';
      v.dataset.verdict = 'unstated';
      v.textContent = `You said urine volume ${SAID[key]}. The cited sources give no direction for urine volume here, so there is no graded answer.`;
    } else {
      v.className = `lx-verdict ${key === right ? 'is-right' : 'is-wrong'}`;
      v.dataset.verdict = key === right ? 'right' : 'wrong';
      v.textContent = `${key === right ? 'Right' : 'Not quite'}: you said urine volume ${SAID[key]}; ${to === 'baseline' ? 'it' : 'compared with the baseline, it'} ${SAID[right]}.`;
    }
    const why = document.createElement('p');
    why.className = 'lx-why';
    why.textContent = STATES[to].summary;
    box.append(v, why);
    store.set(to, origin, from);
    v.focus({ preventScroll: true });
  }
  return { ask, clear, get pending() { return target; } };
}

A.store = store;
A.gate = gate;
})();
