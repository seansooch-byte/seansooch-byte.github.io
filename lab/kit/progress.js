// The Lab kit: what one reader has done, kept in this browser only (never sent anywhere).
//
// Expected behaviour:
//   - One record per lesson slug: the last step open, the steps seen, each predict-first answer and
//     each quiz answer (true when right, false when wrong, 'skip' for a skipped prediction), and when.
//   - Storage can be missing, full or blocked (private windows, previews): every read falls back to
//     an empty record and every write is tried and forgotten, so a page never breaks on it.
//   - A change in another tab (the course page, another lesson) reaches listeners through 'storage'.
const KEY = 'lab-progress-v1';
let memory = { v: 1, lessons: {} };

// The stored text is parsed again only when it changes (a lesson asks on every animation frame).
let lastRaw = null;
export function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === lastRaw) return memory;
    lastRaw = raw;
    if (raw) {
      const all = JSON.parse(raw);
      if (all && all.v === 1 && all.lessons && typeof all.lessons === 'object') return (memory = all);
    }
  } catch { /* storage blocked or unreadable: keep the in-memory copy */ }
  return memory;
}

const blank = () => ({ step: 0, seen: [], checks: {}, quiz: {}, at: 0 });

export function lessonRecord(slug) {
  const l = readAll().lessons[slug];
  return l ? { ...blank(), ...l } : blank();
}

export function updateLesson(slug, change) {
  const all = readAll();
  const l = { ...blank(), ...(all.lessons[slug] || {}) };
  change(l);
  l.at = Date.now();
  all.lessons[slug] = l;
  memory = all;
  try { const raw = JSON.stringify(all); localStorage.setItem(KEY, raw); lastRaw = raw; } catch { /* not kept: fine */ }
  return l;
}

export function forgetLesson(slug) {
  const all = readAll();
  delete all.lessons[slug];
  memory = all;
  try { const raw = JSON.stringify(all); localStorage.setItem(KEY, raw); lastRaw = raw; } catch { /* not kept: fine */ }
}

export function forgetAll() {
  memory = { v: 1, lessons: {} };
  try { localStorage.removeItem(KEY); lastRaw = null; } catch { /* nothing kept */ }
}

export function onChange(fn) {
  addEventListener('storage', e => { if (e.key === KEY) fn(readAll()); });
}

// A lesson's standing, for the course page and the lesson head.
export function standing(record, steps, quizTotal) {
  const seen = new Set(record.seen || []).size;
  const answers = Object.values(record.quiz || {});
  const right = answers.filter(a => a === true).length;
  return {
    seen, steps,
    started: seen > 0 || answers.length > 0,
    finished: steps > 0 && seen >= steps,
    answered: answers.length, right, quizTotal,
    quizDone: quizTotal > 0 && answers.length >= quizTotal,
  };
}
