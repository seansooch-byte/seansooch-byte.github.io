# Architecture

seansooch.dev is a static site: HTML, CSS, JavaScript and media, served as files. This repository has no build step, no
server and no dependencies to install. Branch `main` is the site.

## How it ships

```mermaid
flowchart LR
  subgraph Outside["Sources outside this repo (Sean's laptop)"]
    A["~/app-redesign/work/home-astra<br>homepage view A"]
    O["~/app-redesign/work/home-opus<br>homepage view O"]
    V["~/seansooch-astra-preview<br>shared record, view F, switcher"]
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
| `designs/fable/`, `designs/opus/` | The same two pages in views F and O | No. Generated. |
| `design-switcher.css`, `design-switcher.js` | The fixed bar that switches views | No. Copied from the preview. |
| `antibiotic-coverage/`, `calculators/`, `clinical-calculators/`, `differentials/`, `lab-values/index.html`, `tccc/`, `toolkit/` | Field Toolkit, Edition 2 "Pocket Cards" | No. Generated. |
| `lab-values/cbc-cmp/` | CBC and CMP decoder | No. Copied from `~/lab-decoder`. |
| `ekg/index.html` | Read This, Edition 2 | No. Generated. |
| `ekg/*.js`, `ekg/films/` | Read This data and chest films; `ekg/ARCHITECTURE.md` describes them | Yes, with care |
| `music/index.html`, `music/last-light/index.html` | Music category and the LAST LIGHT page | Yes |
| `music/last-light/media/` | HLS video segments (most of the repo's size) | No. Rendered elsewhere. |
| `videos/`, `screenshots/`, `*.pdf`, `favicon.svg` | Films, card images, papers | Yes |
| `lab/` | The Lab: one small app a day, its index and ledger (see The Lab below) | Yes |
| `_headers`, `_redirects`, `robots.txt`, `sitemap.xml` | Edge behaviour and crawl rules | Yes |
| `CNAME` | Left over from GitHub Pages; still ships | Leave it |
| `*.md`, `tools/`, `.gitattributes`, `.gitignore` | Never shipped | Yes |

A generated page is overwritten the next time its source is rebuilt, so a hand edit to one does not last. Its source is
on Sean's laptop, outside this repo:

- **Homepage, three views of one text.** All six pages and the switcher are assembled in `~/seansooch-astra-preview`
  and copied here. View A's content is built in `~/app-redesign/work/home-astra`; view O is built by
  `~/app-redesign/work/home-opus/build.py`, which writes into the preview; `build-designs.py` in the preview generates
  view F and stamps the shared record (`sources/editions.json`, `sources/corrections.json`) into all three, so a fact
  changes in one place and agrees in every view. The preview's own `ARCHITECTURE.md` is the authority on the build order.
- **Field Toolkit.** `~/app-redesign/work/toolkit/build.py` writes the seven pages and `toolkit/pocket.css` from
  `src/<page>/index.html`.
- **Read This.** `~/app-redesign/work/ekg/build.py` assembles `ekg/index.html` from its parts.
- **CBC and CMP decoder.** `lab-values/cbc-cmp/index.html` is a copy of `~/lab-decoder/index.html`.

To change a generated page from a pull request, describe the change and name the page. Sean applies it at the source.

## The Lab

`lab/` is written here, by hand or by the daily lab pipeline (which runs outside this repo and opens a pull request for
each app). Nothing in it is generated from a source on Sean's laptop.

- `lab/<slug>/` is one app: static HTML, CSS and JavaScript from this origin only, no third-party requests except Google
  Fonts, no data sent anywhere. Each links back to `/lab/` and `/`.
- `lab/apps.json` is the ledger of shipped apps (slug, title, date, description, builder, reviewer).
- `lab/index.html` is hand-written except the block between its `LAB:LIST` markers, which `node tools/lab-index.mjs`
  rewrites from `lab/apps.json`. The same script adds `/lab/` and each app to `sitemap.xml`.
- Lab apps are deployed automatically after checks (Sean approved this for `lab/` only): a lab deploy is cut from a
  pushed commit on `main` with `tools/stage.sh`, and is aborted if `tools/audit.sh` reports a difference outside `lab/`
  and the added `sitemap.xml` lines.
- Anything in the lab that touches medicine is educational, says it is not for clinical use, and never changes or
  restates the clinical values in the toolkit or Read This as authoritative.

## Edge behaviour

- `_redirects` sends `/sims`, `/simulators`, `/cpr`, `/codeblue`, `/alignment` and `/alignment-simulator` to the
  simulators site, a separate Pages project.
- `_headers` marks every `*.pages.dev` host of this project `noindex`. Only the custom domain is indexable. Keep the file
  in every deploy; it never appears in the upload receipt.
- `_headers` also sets security headers on every path and host: HSTS (one year, no `includeSubDomains`, no `preload`),
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, a `Permissions-Policy`, and a **report-only**
  Content-Security-Policy that logs violations to the console and blocks nothing. Its `connect-src` names every host the
  homepage probes: a new probed host needs an entry there. Cloudflare injects Web Analytics
  (`static.cloudflareinsights.com`) into live HTML, so the policy allows that script too.
- `www.seansooch.dev` redirects to the apex by a Cloudflare Redirect Rule, not by anything in this repo.
- An unknown path answers **200 with the homepage**. A status code proves nothing about a deploy; compare bytes.

## Third-party requests at runtime

Google Fonts on most pages, and `hls.js` from cdn.jsdelivr.net (pinned by integrity hash) on `/music/last-light/`.
Nothing else is loaded from another origin (the homepage host probes are requests whose responses are never read), and no page posts data anywhere.

## Other hosts

The systems on the homepage (Step 2 CK, Detroit Sports, the simulators, the AGI tracker and the rest) are separate
Cloudflare Pages projects with their own sources. None of them live in this repo. The homepage probes each host from the
browser to show whether it is up.

## Clinical content

The toolkit and Read This are reference and training tools written by a medical student. Several items carry a visible
"flagged for clinician review" note. A change to a clinical value, threshold, dose or grading rule needs Sean's sign-off
and goes in at the source, never in the generated page.
