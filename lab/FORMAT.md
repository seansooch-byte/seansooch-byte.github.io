# The Lab lesson format

Every lesson in `lab/<slug>/` follows this contract. `node tools/lab-check.mjs` checks the parts a
script can check; `node tools/lab-walk.mjs <served base>` drives every lesson in a browser. A lesson
is not done until both pass and its pictures have been looked at, step by step, on a phone and on a
wide screen.

## What a lesson is

A lesson is a lesson plan a first-year student can work through alone, in plain language:

1. **The plan** (top of the page): what you will be able to do (3 to 5 goals), how long it takes,
   and which earlier lessons it builds on. The kit draws it from `plan.json`.
2. **Learn** (Lesson tab): 12 to 22 steps, one idea, one picture and one caption each. First the
   idea is built, stage by stage; then the last stage, "What changes it", gives one step to each
   drug class and disease state in the syllabus, each drawn over a ghost of the normal picture.
3. **Predict first**: every "What changes it" step asks a question before its change plays. The
   picture holds on "before" and the caption stays hidden until the reader answers or skips.
4. **Quiz** (Quiz tab): 6 to 10 questions, each tied to a goal and to the step that teaches it.
5. **Summary** (Summary tab): the takeaways, each goal with the reader's score on it, every term the
   lesson defines, and the next lesson. It prints on its own.
6. **Reference**: the Clinical values tab (sourced reference ranges beside the lesson's model) and
   the Explore freely tab (the model, with every control).

The kit (`lab/kit/`) runs all of it: tabs, steps, the step rail, the picture player, predictions,
the quiz, the summary, the glossary, terms that light parts of a picture, and the reader's progress
(kept in their browser only). A lesson supplies only its words, its pictures, its model and its
reference tabs.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The page: head, the site's top bar, the intro, five tabs, the steps, the reference tabs. |
| `app.js` | An ES module: the lesson's pictures (one scene per step kind), its model if it has one, and its Clinical values and Explore freely code. It ends by calling `lesson({...})`. |
| `plan.json` | Minutes, prerequisites, goals, predictions, quiz, takeaways. |
| `clinical-values.json` | Every reference number the lesson shows, each with its source (unchanged by this format). |
| `style.css` | Only the classes the lesson's own pictures use. Everything else is `/lab/kit/kit.css`. |
| `model.js` | Optional: a model shared by the pictures and the tabs (a classic script loaded with `defer` before `app.js`, or imported by it). |

## index.html

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/lab/kit/kit.css">
<link rel="stylesheet" href="style.css">
<script type="module" src="app.js"></script>
...
<main id="main" data-slug="<slug>">
  <div class="intro">
    <p class="eyebrow"><a href="/lab/">The Lab</a> / <a href="/lab/#<unit id>">Unit N: <unit title></a> / Lesson M</p>
    <h1>Title <span>in two tones</span>.</h1>
    <p class="lede">One or two sentences: what the reader will see.</p>
    <p class="note">Educational, not for clinical use</p>
    <div class="lx-plan" data-lx-plan></div>
  </div>
  <div class="tabs" role="tablist" aria-label="Lesson views">
    <button type="button" role="tab" id="tab-lesson" aria-controls="lesson" aria-selected="true">Lesson</button>
    <button type="button" role="tab" id="tab-quiz" aria-controls="quiz" aria-selected="false" tabindex="-1">Quiz</button>
    <button type="button" role="tab" id="tab-summary" aria-controls="summary" aria-selected="false" tabindex="-1">Summary</button>
    <button type="button" role="tab" id="tab-clinical" aria-controls="clinical" aria-selected="false" tabindex="-1">Clinical values</button>
    <button type="button" role="tab" id="tab-explore" aria-controls="explore" aria-selected="false" tabindex="-1">Explore freely</button>
  </div>
  <section id="lesson" role="tabpanel" aria-labelledby="tab-lesson">
    <article data-step="1" data-step-title="Step title" data-kind="kind">
      <p class="eyebrow">Build the idea</p>
      <h2 tabindex="-1">Step title</h2>
      <div class="visual" data-visual></div>
      <p class="caption">One idea. Every new term is a <dfn data-part="part">dfn</dfn>, defined in the same sentence.</p>
    </article>
    <!-- every later step carries hidden -->
    <div class="step-nav">
      <button type="button" data-step-back disabled>← Back</button>
      <span data-step-progress aria-live="polite">Step 1 of N</span>
      <button type="button" data-step-next>Next →</button>
    </div>
    <p class="hint">...</p>
  </section>
  <section id="quiz" role="tabpanel" aria-labelledby="tab-quiz" hidden></section>
  <section id="summary" role="tabpanel" aria-labelledby="tab-summary" hidden></section>
  <section id="clinical" role="tabpanel" aria-labelledby="tab-clinical" hidden>...</section>
  <section id="explore" role="tabpanel" aria-labelledby="tab-explore" hidden>...</section>
  <footer>Lesson M of The Lab · Added YYYY-MM-DD · <a href="/lab/">All lessons</a></footer>
</main>
```

- The unit and lesson number in the eyebrow match `lab/syllabus.json`.
- The site top bar is copied exactly from any other lesson (`aria-current="true"` on The Lab).
- Steps are numbered 1 to N in order; `data-step-title` equals the `<h2>` text; every `data-kind`
  is unique and has a scene in `app.js`. No Replay buttons: the kit's player replaces them.
- Stages are the steps' eyebrows. The building stages come first (any names, such as "Build the
  idea"); the last stage is named "What changes it" and holds one step per drug class or state.

## Pictures

- A scene is either a function returning an SVG string (a still picture),
  `{ duration, loop, render(t) }` (a moving one: `render` draws the moment `t`, from 0 to 1, and may
  return `{ svg, readout }`), or `{ duration, loop, mount(host) }` for a picture with many moving
  parts: `mount` builds its SVG once inside `host` and returns `{ render(t), readout(t) }` (readout
  optional). Only `t` moves a picture, so pausing, scrubbing, half speed and reduced motion all work
  without the scene knowing. Optional: `loopFrom` (where a loop restarts, so a change can play once
  and then keep cycling on the changed state), `rest` (the moment shown under reduced motion,
  default 1) and `stages: [[0, 'the drug'], [0.55, 'the reflex']]` (names the player shows).
- **Size and type.** Every picture is 480 units wide and at most 420 tall. Text uses the kit's
  classes: default 20, `.sm` 18, `.xs` 17, `.lg` 24 (never smaller than 17), so the smallest label
  reads at 12 px on a 375 px phone. Labels never overlap one another, a dot, an arrow or a line
  they do not belong to. Check every step at 1280 wide and at 375 x 553.
- **One idea per picture.** A picture shows what its caption says and little else. A process moves
  (a heartbeat, a signal, a cell's trip round a curve): give it a `duration` and, if it repeats,
  `loop: true`. A structure can hold still.
- **Changes.** A "What changes it" step draws the normal picture as a dashed grey ghost, and morphs
  from normal at `t = 0` to the changed state at `t = 1`. What moved is named on the picture
  itself, in words with an arrow ("curve slides right", "fills more"), not only in a readout. A
  readout under the picture (`Compared with normal`, from `/lab/kit/draw.js`'s `readout()`) is
  optional and must agree with the picture.
- **Parts.** Give the picture's key structures `data-part="name"` and the caption's matching term
  `<dfn data-part="name">`. Hovering, focusing or tapping the term lights that part (at least three
  per lesson).
- Every SVG has `role="img"` and an `aria-label` that says what the finished picture shows.
- Colours: ink `#171916`, blue `#254dff` (the thing being taught, and change arrows), red `#b3261e`
  (blood, blocks, harm), amber `#a34700`, green `#2c6a2c`, purple `#6b3fa0`, muted `#53584d`, the
  ghost is dashed ink or `#8a8f84`. `/lab/kit/draw.js` has these and small drawing helpers
  (`arrowFixed` for a thick arrow whose head should not grow with its line).

## plan.json

```json
{
  "minutes": 25,
  "prerequisites": ["earlier-lesson-slug"],
  "objectives": ["Explain ...", "Predict ...", "Tell ... apart from ..."],
  "checks": {
    "<kind of a What changes it step>": {
      "prompt": "Gives the mechanism, asks for the consequence.",
      "choices": ["...", "...", "..."],
      "answer": 0,
      "why": "Why the right answer is right, in two or three sentences."
    }
  },
  "quiz": [
    {
      "id": "short-slug",
      "objective": 1,
      "step": "<kind of the step that teaches it>",
      "stem": "A question or a two-line scenario.",
      "choices": ["...", "...", "...", "..."],
      "answer": 0,
      "why": "Explains the right answer and the most tempting wrong one."
    }
  ],
  "takeaways": ["Five to eight sentences that stand alone."]
}
```

- **Goals** (3 to 5) start with a verb a reader can be tested on: explain, predict, read, name,
  tell apart, trace. Every goal has at least one quiz question.
- **Predictions**: one for every "What changes it" step, and only on moving steps (the picture must
  show "before" at `t = 0`). The prompt states the mechanism in plain words and asks for the
  consequence the step then shows; it can be answered from the earlier steps. Three or four choices,
  one right.
- **Quiz**: 6 to 10 questions, four choices each, one right. Mix recall, mechanism and applied
  questions (a short scenario: "A patient taking a loop diuretic..."). Distractors are real
  misconceptions, not jokes. Never "all of the above", "none of the above" or a letter ("B is
  wrong"): the kit shuffles the choices. Each `step` is the step a reader should review.
- **Takeaways**: the lesson on one page, high-yield, in the lesson's plain language.
- **Minutes**: about one per step, plus one per quiz question.
- **Prerequisites**: earlier lessons in the syllabus that this one leans on; empty for a first lesson.

## Rules that bind every lesson

- Educational only: the page says "Educational, not for clinical use". No drug doses, anywhere
  (no mg, micrograms, units per kilogram, rates). Never AI-themed.
- Medically correct. If a lesson being ported says something wrong, correct it and say so in the
  commit message; never carry an error across.
- Reference numbers live only in `clinical-values.json`, each with its source. A textbook carries no
  link; a guideline links to its DOI only. Do not change a value without its source.
- Lessons agree with each other: a state two lessons share (beta-blockers, fluids, a loop diuretic)
  moves the same way in both.
- No em dashes (U+2014) in any file. No third-party requests except Google Fonts. No data sent
  anywhere.
- The Clinical values and Explore freely tabs keep the shared class names that `kit.css` styles
  (`.visual`, `.value-row`, `.gauge`, `.cv-top`, `.explore-grid`, ...). Long notes on how to read a
  tab go in `<details class="lx-fine">`.
