// The Lab kit: one multiple-choice question's choices, shared by a lesson's predictions and quiz and
// by the course page's mixed review.
//
// Expected behaviour:
//   - Choices are shown in a shuffled order that is fixed for each question id (so the right answer
//     is not always where its author wrote it, and a reload shows the same order).
//   - Before an answer every choice is a button; after one (picked is a choice index, or -1 for a
//     skipped prediction) they are disabled, the right one marked right, the picked wrong one wrong,
//     the rest dimmed.
const MARKS = ['A', 'B', 'C', 'D', 'E', 'F'];

// A stable shuffle per question, so the right answer is not always where the author wrote it.
export function order(n, seed) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function choiceList(id, choices, picked, answer, onPick) {
  const ord = order(choices.length, id);
  const ul = document.createElement('ul');
  ul.className = 'lx-choices';
  ord.forEach((orig, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.dataset.mark = MARKS[i];
    b.dataset.choice = String(orig);
    b.textContent = choices[orig];
    if (picked !== undefined && picked !== null) {
      b.disabled = true;
      if (orig === answer) b.classList.add('is-right');
      else if (orig === picked) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    } else b.addEventListener('click', () => onPick(orig));
    li.append(b);
    ul.append(li);
  });
  return ul;
}
