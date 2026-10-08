# Architecture

seansooch.dev is a static site: HTML, CSS, JavaScript and media, served as files. This repository has no build step, no
server and no dependencies to install. Branch `main` is the site.

## How it ships

```mermaid
flowchart LR
  subgraph Outside["Sources outside this repo (Sean's laptop)"]
    A["~/app-redesign/work/home-astra<br>homepage view A"]
    O["~/app-redesign/work/home-opus<br>homepage view O"]
    V["~/seansooch-astra-preview<br>shared record, view F, switcher, lab-course.js"]
    T["~/app-redesign/work/toolkit<br>seven tool pages"]
    L["~/lab-decoder<br>CBC and CMP decoder"]
    E["~/app-redesign/work/ekg<br>Read This"]
    M["~/mv-last-light<br>LAST LIGHT video segments"]
  end
  A & O -->|written into| V
  V & T & L & E & M -->|built output copied in| Repo["this repo, branch main"]
  Hand["pages written by hand here"] --> Repo
  Repo -->|git push| GH["GitHub, private"]
  Repo -->|"tools/stage.sh<br>git archive minus export-ignore"| Bundle["/tmp/seansooch-bundle"]
  Bundle -->|tools/audit.sh| Check{"equal to live,<br>or only the intended diffs"}
  Check -->|"wrangler pages deploy<br>direct upload"| CF["Cloudflare Pages<br>project sean-sooch-portfolio"]
  CF --> Live["https://seansooch.dev"]
  Pipe["lab pipeline<br>(outside this repo)"] -->|"pull request per lesson:<br>lab/, the ledger, lab lines of sitemap.xml"| Repo
  Live -.->|"in the reader's browser, lab-course.js reads<br>/lab/syllabus.json and /lab/apps.json"| Rows["lesson rows on the three home pages<br>and on the Lab pages of views F and O"]
```

- **Hosting.** Cloudflare Pages project `sean-sooch-portfolio`, production branch `main`, deployed by direct upload with
  wrangler from Sean's laptop. Cloudflare is not connected to GitHub. **Merging a pull request does not deploy.**
- **GitHub** is the record of what is live and the place changes are proposed. GitHub Pages is off and must stay off: it
  would serve the Markdown and `tools/` that the bundle leaves out. `CNAME` is left over from when it was on, and still
  ships because it always has.
- **The bundle** is a commit minus everything marked `export-ignore` in `.gitattributes` (Markdown, `tools/`, git
  plumbing). That file is the only definition of the difference between the repo and the site. Nothing ships from an
  uncommitted working tree, and nothing ships from a commit that holds a symlink: `tools/stage.sh` refuses both.
- **The audit.** `tools/audit.sh` compares every served file in the bundle with the live site by hash (`_headers` and
  `_redirects` are consumed by Pages, not served, so their effect is checked by behaviour). Before a deploy its DIFF
  list should be exactly the files you meant to change; after, it should be empty.

## What is in here

| Path | What | Edit here? |
|---|---|---|
| `index.html`, `two-stories/` | Homepage and essay, view A (OpenAI Astra) | No. Generated. |
| `designs/fable/`, `designs/opus/` | The same two pages in views F and O, and each view's Lab course page (`lab/`) | No. Generated. |
| `design-switcher.css`, `design-switcher.js` | The fixed bar that switches views | No. Copied from the preview. |
| `lab-course.js` | Draws lesson rows from the lab ledger on the three home pages and on the Lab pages of views F and O | No. Copied from the preview. |
| `antibiotic-coverage/`, `calculators/`, `clinical-calculators/`, `differentials/`, `lab-values/index.html`, `tccc/`, `toolkit/` | Field Toolkit, Edition 2 "Pocket Cards" | No. Generated. |
| `lab-values/cbc-cmp/` | CBC and CMP decoder | No. Copied from `~/lab-decoder`. |
| `ekg/index.html` | Read This, Edition 2 | No. Generated. |
| `ekg/*.js`, `ekg/films/` | Read This data and chest films; `ekg/ARCHITECTURE.md` describes them | Yes, with care |
| `music/index.html`, `music/last-light/index.html` | Music category and the LAST LIGHT page | Yes |
| `music/last-light/media/` | HLS video segments (most of the repo's size) | No. Rendered elsewhere. |
| `videos/`, `screenshots/`, `*.pdf`, `favicon.svg` | Films, card images, papers | Yes |
| `lab/` | The Lab: one small app a day, its index and ledger (see The Lab below) | Yes |
| `monitor/` | Monitoring the Situation: the daily briefing page and its saved copy (see Monitoring the Situation below) | Yes |
| `_headers`, `_redirects`, `robots.txt`, `sitemap.xml` | Edge behaviour and crawl rules | Yes |
| `CNAME` | Left over from GitHub Pages; still ships | Leave it |
| `*.md`, `tools/`, `.gitattributes`, `.gitignore` | Never shipped | Yes |

A generated page is overwritten the next time its source is rebuilt, so a hand edit to one does not last. Its source is
on Sean's laptop, outside this repo:

- **Homepage, three views of one text.** The home page and essay of each view, the Lab course page of views F and O,
  the switcher and `lab-course.js` are assembled in `~/seansooch-astra-preview` and copied here. View A's content is built in `~/app-redesign/work/home-astra`; view O is built by
  `~/app-redesign/work/home-opus/build.py`, which writes into the preview; `build-designs.py` in the preview generates
  view F and stamps the shared record (`sources/editions.json`, `sources/corrections.json`) into views A and F, and the
  view O build applies the same record, so a fact changes in one place and agrees in every view. The preview's own `ARCHITECTURE.md` is the authority on the build order.
- **Field Toolkit.** `~/app-redesign/work/toolkit/build.py` writes the seven pages and `toolkit/pocket.css` from
  `src/<page>/index.html`.
- **Read This.** `~/app-redesign/work/ekg/build.py` assembles `ekg/index.html` from its parts.
- **CBC and CMP decoder.** `lab-values/cbc-cmp/index.html` is a copy of `~/lab-decoder/index.html`.

To change a generated page from a pull request, describe the change and name the page. Sean applies it at the source.

### Three views of the course

Three pages exist in every view, and the switcher moves between them: the home page, the Two Stories essay and the Lab
course page. A lesson is an app with one page, the same in every view.

| | View A (Astra) | View F (Fable 5.1) | View O (Opus 5.5) |
|---|---|---|---|
| Lab course page | `/lab/` (`lab/index.html`, written by the lab pipeline) | `/designs/fable/lab/` | `/designs/opus/lab/` |
| Where its lesson list comes from | Written into the page by `tools/lab-index.mjs` | Drawn in the browser by `lab-course.js` | Drawn in the browser by `lab-course.js` |

- **No generated page holds a lesson.** The Lab section of each home page and the Lab pages of views F and O carry a row
  template in that view's own markup. `lab-course.js` reads `/lab/syllabus.json` and `/lab/apps.json` in the reader's
  browser and fills the template once per lesson, so a lesson the pipeline ships appears in all three views with no
  rebuild of a generated page. If the files cannot be read, or hold no lessons, the page keeps what it was served with:
  the home pages still link to the course, and the two Lab pages point at `/lab/`.
- **The two ledger files are an interface.** `lab-course.js` reads `modules[].slug`, `title`, `description` and
  `drugClasses` from `lab/syllabus.json`, and `slug` and `date` from each entry of `lab/apps.json` (plus `title` and
  `description` for an app that is not in the syllabus). Renaming one of those fields empties the lesson rows on five
  pages outside `lab/`, and a lab deploy's audit would not notice. The script trusts neither file: every value is set
  as text, never as markup; a slug that is not lowercase words joined by hyphens is dropped; a link is this site's
  origin plus `/lab/<slug>/`; an entry whose date is not a real day has not shipped.
- **`lab/index.html` carries the switcher.** This is the one exception to what The Lab section below says about that
  file. Three things in it come from the preview, not from the pipeline: the `data-design="astra"` attribute on
  `<html>`, and the two blocks between `design-switcher:start` and `design-switcher:end` comments (the assets in
  `<head>`, the bar before `</body>`). The pipeline's own copy of that page must hold the same three or its next sync
  removes them. From this repo's root, `python3 ~/seansooch-astra-preview/build-designs.py --stamp lab/index.html`
  puts them back and is safe to repeat.
- The opening paragraphs of the two generated Lab pages are copies of the ones on `/lab/`. If the pipeline's wording
  changes, they change at their sources (`sources/fable-lab.html` in the preview, `src/lab.template.html` in
  `~/app-redesign/work/home-opus`).

## The Lab

`lab/` is written here, by hand or by the daily lab pipeline (which runs outside this repo and opens a pull request for
each app). Nothing in it is generated from a source on Sean's laptop.

- `lab/syllabus.json` is the course: about twenty core-medicine modules in teaching order (slug, title, one-line
  description, the drug classes and disease states each lesson animates). Sean reorders or edits it by hand. `/lab/`
  renders it as the course: shipped lessons link to their page, the rest say "Coming soon" and link nowhere. The daily
  pipeline builds the first module that is neither shipped nor withdrawn; never rename a shipped lesson's slug.
- Every lesson is a guided, step-by-step lesson for a first-year student: a Lesson tab of plain-language steps (one idea,
  one big visual, one short caption, Back/Next, "Step X of N"), then one animated step per drug class or disease state
  with a ghost of the normal picture; a Clinical values tab; and an optional Explore freely tab for the technical model.
- The Lab is presented on the site as a course in core medicine (step-by-step visual lessons in plain language); the
  `/lab/` page and its list say nothing about how lessons are built. Who built and reviewed each one is recorded in
  `lab/apps.json`, the commit and the pull request.
- `lab/<slug>/` is one app: static HTML, CSS and JavaScript from this origin only, no third-party requests except Google
  Fonts, no data sent anywhere. Each opens with the site's shared top bar (the homepage's view A bar: brand to `/`,
  Work, Writing, Films, Editions, and The Lab to `/lab/`), copied exactly from the pipeline's
  `templates/site-top-lesson.html` with `aria-current="true"` on The Lab, its CSS appended to the app's own stylesheet.
  `/lab/` carries the same bar with `aria-current="page"`, its CSS at the end of `lab/lab.css`.
- `lab/apps.json` is the ledger of shipped apps (slug, title, date, description, builder, reviewer).
- `lab/rejected.json` lists apps Sean turned down and why. A withdrawn app is deleted from `lab/`, the ledger, the index
  and the sitemap in the same pull request that records it here, so the pipeline never proposes it, or anything like
  it, again. Its old URL then falls back to the homepage like any unknown path.
- `lab/index.html` and `lab/lab.css` are hand-written in the pipeline's `bootstrap/lab/` and synced on every run;
  `lab/index.html` is fixed except the block between its `LAB:LIST` markers, which `node tools/lab-index.mjs`
  rewrites from `lab/apps.json`. The same script adds `/lab/` and each app to `sitemap.xml`, and drops the sitemap
  entries of apps no longer in the ledger.
- Lab apps are deployed automatically after checks (Sean approved this for `lab/` only): a lab deploy is cut from a
  pushed commit on `main` with `tools/stage.sh`, and is aborted if `tools/audit.sh` reports a difference outside `lab/`
  and the lab lines of `sitemap.xml`.
- Lab apps are never AI-themed (no AI opponents, no "learns your habits", no frontier-AI topics, no machine learning as
  the gimmick), and games are optional rather than the default.
- Anything in the lab that touches medicine is educational, says it is not for clinical use, never gives drug doses,
  and never changes or restates the clinical values in the toolkit or Read This.
- Every medicine or physiology lesson has a "Clinical values" tab (Sean's sign-off, 2026-10-07): typical adult
  reference ranges from Guyton & Hall, Costanzo, Boron & Boulpaep or a major guideline, each cited with its location,
  drawn as live range bars against the lesson's model, with the expected direction of change in each disease and drug
  state, and the note "Typical adult reference ranges; labs vary; not for clinical decisions." All of a lesson's values
  live in one file, `lab/<slug>/clinical-values.json`, so they can be audited in one place; the second-opinion
  reviewer must verify each against its source.

## Monitoring the Situation

`/monitor/` shows Sean's daily news briefing (finance, politics, pop culture, sports, tech and AI, medicine). It is
written by hand here; nothing in `monitor/` is generated. The briefing itself is **not** in this repo's deploys: the page
fetches it at runtime, so a new briefing goes live without a site deploy.

- `monitor/index.html`, `monitor/monitor.css`, `monitor/monitor.js`: the page. Self-hosted script, no inline JavaScript,
  no third-party scripts. It opens with the site's shared top bar (as on `/lab/`), with a Monitoring item marked
  `aria-current="page"`; the bar's CSS is copied at the end of `monitor/monitor.css`. The homepage's own nav is
  generated off-repo and has no Monitoring link yet.
- `/monitor/` is not one of the three views (see Three views of the course): it has no `data-design` attribute and no
  `design-switcher` blocks, and `design-switcher.js` routes only the home page, the essay and the Lab course page. If
  Sean adds it to the views, the blocks come from the preview's `build-designs.py --stamp`, not a hand copy.
- The page fetches `https://feed.seansooch.dev/v1/feed.json` and renders it with `textContent` and `createElement`
  only, never `innerHTML`: the briefing is gathered from X and the web and is treated as untrusted. Only `https:` links
  are rendered. It shows "Updated … ago" from `generated_at` and flags the briefing as stale after about 30 hours.
- `monitor/feed.json` is a saved copy of one briefing. If the feed cannot be reached (or returns something unusable),
  the page shows that copy with a visible "Showing saved copy" note. Refresh it now and then by copying a newer
  briefing over it; it only ships with a site deploy.
- **The feed** is a Cloudflare Worker, `monitor-feed`, on the Workers Custom Domain `feed.seansooch.dev`, backed by
  the KV namespace `monitor-feed` (keys `latest`, `prev`, `archive:YYYY-MM-DD` kept 30 days). Its source lives outside
  this repo (`/workspace/monitor-feed` on the agent box, with its own README). `GET /v1/feed.json` is public, cached 60
  seconds, with an ETag; CORS is allowed only for `https://seansooch.dev` and `https://sean-sooch-portfolio.pages.dev`,
  so the page reads the feed on those hosts and falls back to the saved copy elsewhere (local previews, archive
  hosts). Publishing is `PUT /v1/feed` with a bearer secret that is not in this repo; the Worker validates the schema
  and rejects non-`https` links.

## Edge behaviour

- `_redirects` sends `/sims`, `/simulators`, `/cpr`, `/codeblue`, `/alignment` and `/alignment-simulator` to the
  simulators site, a separate Pages project.
- `_headers` marks every `*.pages.dev` host of this project `noindex`. Only the custom domain is indexable. Keep the file
  in every deploy; it never appears in the upload receipt.
- `_headers` also sets security headers on every path and host: HSTS (one year, no `includeSubDomains`, no `preload`),
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, a `Permissions-Policy`, and a **report-only**
  Content-Security-Policy that logs violations to the console and blocks nothing. Its `connect-src` names every host the
  homepage probes: a new probed host needs an entry there. It also names `https://feed.seansooch.dev`, the briefing
  feed that `/monitor/` reads; that entry is written as if the policy were enforced. Cloudflare injects Web Analytics
  (`static.cloudflareinsights.com`) into live HTML, so the policy allows that script too.
- `www.seansooch.dev` redirects to the apex by a Cloudflare Redirect Rule, not by anything in this repo.
- An unknown path answers **200 with the homepage**. A status code proves nothing about a deploy; compare bytes.

## Third-party requests at runtime

Google Fonts on most pages, `hls.js` from cdn.jsdelivr.net (pinned by integrity hash) on `/music/last-light/`, and
the briefing JSON from `https://feed.seansooch.dev/v1/feed.json` on `/monitor/` (data only, rendered as text; see
Monitoring the Situation). That feed is the one place a page reads data from another origin (`lab-course.js` reads
`/lab/syllabus.json` and `/lab/apps.json` from this origin); nothing else is loaded
from another origin (the homepage host probes are requests whose responses are never read), and no page posts data
anywhere.

## Other hosts

The systems on the homepage (Step 2 CK, Detroit Sports, the simulators, the AGI tracker and the rest) are separate
Cloudflare Pages projects with their own sources. None of them live in this repo. The homepage probes each host from the
browser to show whether it is up.

## Clinical content

The toolkit and Read This are reference and training tools written by a medical student. Several items carry a visible
"flagged for clinician review" note. A change to a clinical value, threshold, dose or grading rule needs Sean's sign-off
and goes in at the source, never in the generated page.
