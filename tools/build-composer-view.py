#!/usr/bin/env python3
"""Generate Composer 2.5 view pages and patch shared switcher / edition listings."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SWITCHER_OLD = re.compile(
    r"<!-- design-switcher:start -->.*?<!-- design-switcher:end -->",
    re.DOTALL,
)

COMPOSER_LINK = (
    '<a class="design-choice" data-design="composer" href="/designs/composer/{suffix}">Composer 2.5</a>'
)

def switcher_block(selected: str, suffix: str = "", current: str | None = None) -> str:
    """suffix is path after designs root for non-composer home paths, e.g. two-stories/ or lab/."""
    paths = {
        "astra": f"/{suffix}",
        "fable": f"/designs/fable/{suffix}",
        "opus": f"/designs/opus/{suffix}",
        "composer": f"/designs/composer/{suffix}",
    }
    opts = []
    for design, label in (
        ("astra", "Astra"),
        ("fable", "Fable 5.1"),
        ("opus", "Opus 5.5"),
        ("composer", "Composer 2.5"),
    ):
        href = paths[design]
        cur = ' aria-current="page"' if design == current else ""
        opts.append(
            f'<a class="design-choice" data-design="{design}" href="{href}"{cur}>{label}</a>'
        )
    curtains = {
        "astra": ("ASTRA", "THE PERSONAL INDEX"),
        "fable": ("FABLE 5.1", "THE FIELD MANUAL"),
        "opus": ("OPUS 5.5", "THE COMMENTARY"),
        "composer": ("COMPOSER 2.5", "THE WORKBENCH"),
    }
    t, s = curtains[selected]
    return (
        f'<!-- design-switcher:start --><nav class="design-switcher" aria-label="Website design" data-selected="{selected}">'
        f'<span class="design-caption">SAME WORLD.<br>FOUR VIEWS.</span><div class="design-options">'
        + "".join(opts)
        + f'</div></nav><div class="design-curtain" data-destination="{selected}" aria-hidden="true">'
        f"<strong>{t}</strong><span>{s}</span></div><!-- design-switcher:end -->"
    )


HEAD_ASSETS_LAB = (
    '<!-- design-switcher:start --><link rel="stylesheet" href="/design-switcher.css?v=f0ec4a2cfd">'
    '<script src="/design-switcher.js?v=d8ab4df6ff"></script>'
    '<script src="/lab-course.js?v=5f7b63c4ab" defer></script><!-- design-switcher:end -->'
)
HEAD_ASSETS = (
    '<!-- design-switcher:start --><link rel="stylesheet" href="/design-switcher.css?v=f0ec4a2cfd">'
    '<script src="/design-switcher.js?v=d8ab4df6ff"></script><!-- design-switcher:end -->'
)


def patch_switchers() -> None:
    pages = [
        ("index.html", "astra", "", True),
        ("two-stories/index.html", "astra", "two-stories/", False),
        ("lab/index.html", "astra", "lab/", False),
        ("designs/fable/index.html", "fable", "", True),
        ("designs/fable/two-stories/index.html", "fable", "two-stories/", False),
        ("designs/fable/lab/index.html", "fable", "lab/", True),
        ("designs/opus/index.html", "opus", "", True),
        ("designs/opus/two-stories/index.html", "opus", "two-stories/", False),
        ("designs/opus/lab/index.html", "opus", "lab/", True),
    ]
    for rel, selected, suffix, lab_js in pages:
        path = ROOT / rel
        text = path.read_text()
        head, tail = text.split("</head>", 1)
        assets = HEAD_ASSETS_LAB if lab_js else HEAD_ASSETS
        head = SWITCHER_OLD.sub(assets, head, count=1)
        body_nav = switcher_block(selected, suffix, selected)
        # Replace only the bar before </body> (or end of file), not the head assets.
        if "</body>" in tail:
            pre, post = tail.rsplit("<!-- design-switcher:start -->", 1)
            post = "<!-- design-switcher:start -->" + post
            post = SWITCHER_OLD.sub(body_nav, post, count=1)
            tail = pre + post
        else:
            tail = SWITCHER_OLD.sub(body_nav, tail, count=1)
        path.write_text(head + "</head>" + tail)


def patch_astra_editions() -> None:
    path = ROOT / "index.html"
    text = path.read_text()
    text = text.replace("Same world. Three views.", "Same world. Four views.")
    text = text.replace("grid-template-columns:repeat(3,1fr)", "grid-template-columns:repeat(4,1fr)")
    text = text.replace(
        '<span class="view-no">03</span><span class="view-by">Claude Opus 5.5 · Vol. 03</span>',
        '<span class="view-no">03</span><span class="view-by">Claude Opus 5.5 · Vol. 03</span>',
    )
    fourth = (
        '<a class="view-cell" href="/designs/composer/" data-index="The Workbench (view C)" data-ref="06 / Editions" '
        'data-kw="editions view cursor composer 2.5"><span class="view-no">04</span>'
        '<span class="view-by">Cursor Composer 2.5 · Vol. 03</span><span class="view-name">The Workbench</span>'
        '<span class="view-note">A dark composing surface: panels, traces, and files as navigation.</span>'
        '<span class="view-go" aria-hidden="true">↗︎</span></a>'
    )
    if "The Workbench (view C)" not in text:
        text = text.replace(
            '<span class="view-go" aria-hidden="true">↗︎</span></a></div></div><!-- edition-views:end -->',
            '<span class="view-go" aria-hidden="true">↗︎</span></a>'
            + fourth
            + '</div></div><!-- edition-views:end -->',
            1,
        )
    text = text.replace(
        "Three views: the Field Manual, the Personal Index and the Commentary, switchable in place",
        "Four views: the Field Manual, the Personal Index, the Commentary and the Workbench, switchable in place",
    )
    path.write_text(text)


def patch_fable_editions() -> None:
    path = ROOT / "designs/fable/index.html"
    text = path.read_text()
    text = text.replace("grid-template-columns:repeat(3,1fr)", "grid-template-columns:repeat(4,1fr)")
    fourth = (
        '<a class="view" style="--w:var(--hum)" href="/designs/composer/" data-index="The Workbench (view C)" '
        'data-ref="Figure A-1" data-kw="editions view cursor composer 2.5"><span class="fn">'
        '<span class="dom">View C · fourth in line</span><span>Vol. 03</span></span>'
        '<span class="sig" aria-hidden="true">C</span><h3>The Workbench</h3>'
        '<p>A dark composing surface: panels, traces, and files as navigation.</p>'
        '<span class="by">Designed by <b>Cursor Composer 2.5</b></span>'
        '<span class="ft"><span>Switch view</span><span class="go">Read →</span></span></a>'
    )
    if "The Workbench (view C)" not in text:
        text = text.replace(
            '<span class="go">Read →</span></span></a></div><!-- edition',
            '<span class="go">Read →</span></span></a>' + fourth + '</div><!-- edition',
            1,
        )
    path.write_text(text)


def patch_opus_witness() -> None:
    path = ROOT / "designs/opus/index.html"
    text = path.read_text()
    wit = (
        '<a class="wit" href="/designs/composer/" data-index="The Workbench (view C)" data-ref="Editions" '
        'data-kw="editions view cursor composer 2.5" data-href="/designs/composer/">'
        '<span class="siglum">C</span><b>The Workbench</b><span>Cursor Composer 2.5</span>'
        '<em>Vol. 03 · fourth in line. A dark composing surface: panels, traces, and files as navigation. Read this view →</em></a>'
    )
    if "The Workbench (view C)" not in text:
        text = text.replace(
            '<div class="fork">',
            '<div class="fork">' + wit,
            1,
        )
    path.write_text(text)


SYSTEMS = [
    ("step2", "Step 2 CK Qbank", "med", "https://step2-ck.pages.dev/", "Public question bank for boards prep."),
    ("handoff", "Handoff Tracker", "med", "https://patient-handoff-tracker.onrender.com/", "I-PASS handoffs with a quality loop.", True),
    ("ekg", "Read This", "med", "https://seansooch.dev/ekg/", "EKG rhythms and chest films, taught stepwise."),
    ("microtd", "MICRO TD", "med", "https://micro-td.pages.dev/", "Tower defense that teaches antibiotic classes."),
    ("warrior", "Warrior Ready", "mil", "https://warrior-ready.pages.dev/", "PT test calculators and ruck planning."),
    ("toolkit", "Field Toolkit", "mil", "https://seansooch.dev/toolkit/", "Pocket cards for hospital and field reference."),
    ("agi", "AGI Capability Tracker", "mac", "https://differential-c57.pages.dev/", "Frontier model benchmarks in one ledger."),
    ("sims", "Simulators", "mac", "https://seansooch.dev/simulators", "Alignment, CPR, and curiosity toys."),
    ("forge", "Forge", "mac", "https://forge-8ce.pages.dev/", "Metal casting workflow as software."),
    ("space", "Space Explorer", "mac", "https://cic-dashboard.pages.dev/", "Orbital mechanics and mission planning."),
    ("multipliers", "Force Multipliers", "mac", "https://seansooch.dev/force-multipliers/", "Briefing cards on agent workflows."),
    ("reading", "Reading Room", "hum", "https://reading-room.pages.dev/", "A quiet shelf for long reads."),
    ("philosophy", "Philosophy Room", "hum", "https://philosophy-room.pages.dev/", "Primary texts with margin notes."),
    ("edge", "Edge Draft Terminal", "spt", "https://edge-7yj.pages.dev/", "Fantasy football draft wire."),
    ("ncaat", "NCAAT Bracket", "spt", "https://ncaat-bracket-2026.pages.dev/", "March Madness archive and model grades."),
    ("masters", "Masters 2026 Hub", "spt", "https://masters-2026.pages.dev/", "Augusta leaderboard and yardage book."),
    ("detroit", "Detroit Sports Hub", "spt", "https://detroit-sports.pages.dev/", "Scores and stories for Detroit teams."),
    ("greatbooks", "Great Books", "hum", "https://great-books.pages.dev/", "Canon texts with tri-band reading."),
    ("admissions", "AdmissionsAcademy", "med", "https://admissionsacademy.org/", "Medical school admissions guidance."),
    ("music", "Music", "mus", "https://seansooch.dev/music/", "Films and songs built with code."),
    ("situation", "Monitoring the Situation", "mac", "https://situation.seansooch.dev/", "Daily briefing, now its own site."),
]

WORLD = {
    "med": ("medicine", "#3fb950"),
    "mil": ("military", "#d29922"),
    "mac": ("machines", "#79c0ff"),
    "spt": ("sports", "#f778ba"),
    "hum": ("humanities", "#a371f7"),
    "mus": ("music", "#ffa657"),
}


def system_rows() -> str:
    rows = []
    for item in SYSTEMS:
        sid, name, w, url, desc = item[0], item[1], item[2], item[3], item[4]
        wake = len(item) > 5 and item[5]
        tag, color = WORLD[w]
        wake_note = " · cold start" if wake else ""
        rows.append(
            f'<a class="module" data-world="{w}" data-sys="{sid}" href="{url}" target="_blank" rel="noopener">'
            f'<span class="path" style="--c:{color}">systems/{tag}/{sid}.tsx</span>'
            f'<span class="name">{name}</span><span class="desc">{desc}</span>'
            f'<span class="status" data-sys="{sid}"><i></i>probing{wake_note}</span></a>'
        )
    return "\n".join(rows)


COMPOSER_CSS = """
:root{
  --bg:#0d1117;--panel:#161b22;--panel2:#1c2128;--line:#30363d;--line2:#21262d;
  --text:#e6edf3;--muted:#8b949e;--accent:#79c0ff;--accent2:#ffa657;--ok:#3fb950;--bad:#f85149;
  --mono:'JetBrains Mono',ui-monospace,monospace;--sans:'IBM Plex Sans',system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:72px;background:var(--bg)}
body{font:16px/1.55 var(--sans);color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;padding-bottom:120px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
::selection{background:#388bfd66}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.shell{min-height:100vh;display:grid;grid-template-columns:240px minmax(0,1fr);grid-template-rows:auto 1fr auto}
@media(max-width:900px){.shell{grid-template-columns:1fr}.side{border-right:0;border-bottom:1px solid var(--line)}}
.topbar{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--panel2);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px}
.topbar .logo{color:var(--text);font-weight:600;text-decoration:none}
.topbar .logo b{color:var(--accent2)}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tabs a{padding:6px 10px;border:1px solid var(--line);border-radius:6px;color:var(--muted);text-decoration:none}
.tabs a:hover{border-color:var(--accent);color:var(--text)}
.tabs a.on{background:var(--panel);color:var(--accent);border-color:var(--accent)}
.side{background:var(--panel);border-right:1px solid var(--line);padding:18px 14px;font-size:13px}
.side h2{font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--muted);margin-bottom:12px}
.side nav{display:grid;gap:4px}
.side a{color:var(--muted);padding:6px 8px;border-radius:6px;text-decoration:none}
.side a:hover{background:var(--panel2);color:var(--text)}
.side a.on{background:#388bfd1a;color:var(--accent)}
.main{padding:28px 24px 40px;max-width:1100px}
.hero{border:1px solid var(--line);border-radius:10px;background:linear-gradient(135deg,#161b22,#0d1117 55%);padding:28px 26px;margin-bottom:28px}
.hero .kicker{font-family:var(--mono);font-size:11px;color:var(--accent2);letter-spacing:.06em}
.hero h1{font-size:clamp(32px,5vw,52px);line-height:1.05;margin:10px 0 14px;letter-spacing:-.03em}
.hero .lede{color:var(--muted);max-width:52ch;font-size:17px}
.hero .lede b{color:var(--text);font-weight:500}
.metrics{display:flex;flex-wrap:wrap;gap:18px;margin-top:22px;font-family:var(--mono);font-size:12px;color:var(--muted)}
.metrics b{display:block;color:var(--text);font-size:20px;font-weight:500}
.sec{margin-top:40px}
.sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px}
.sec-h h2{font-family:var(--mono);font-size:13px;letter-spacing:.06em;color:var(--accent2)}
.sec-h span{font-size:12px;color:var(--muted)}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.filters button{font:12px var(--mono);padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
.filters button.on{border-color:var(--accent);color:var(--accent);background:#388bfd14}
.modules{display:grid;gap:8px}
.module{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto;gap:12px 16px;align-items:center;padding:14px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
.module:hover{border-color:var(--accent);transform:translateY(-1px)}
.module.hide{display:none}
.path{font-family:var(--mono);font-size:11px;color:var(--c,var(--muted));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.name{font-weight:600;font-size:15px}
.desc{font-size:13px;color:var(--muted);line-height:1.45}
.status{font-family:var(--mono);font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;white-space:nowrap}
.status i{width:7px;height:7px;border-radius:50%;background:var(--muted);display:inline-block}
.status.up{color:var(--ok)}.status.up i{background:var(--ok)}
.status.down{color:var(--bad)}.status.down i{background:var(--bad)}
.status.wake i{animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.35}}
.writing,.editions{display:grid;gap:10px}
.tile{border:1px solid var(--line);border-radius:8px;padding:16px 18px;background:var(--panel2);text-decoration:none;color:inherit}
.tile:hover{border-color:var(--accent)}
.tile h3{font-size:17px;margin-bottom:6px}
.tile p{font-size:13px;color:var(--muted);line-height:1.5}
.editions{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.editions .here{outline:2px solid var(--accent);outline-offset:-2px}
.lab-wait{font-size:13px;color:var(--muted);padding:12px 0}
.lab-row{display:grid;grid-template-columns:56px 1fr auto;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;background:var(--panel);text-decoration:none;color:inherit}
.lab-row:hover{border-color:var(--accent)}
.lab-row.soon{opacity:.75}
.lab-row .no{font-family:var(--mono);font-size:12px;color:var(--accent2)}
.lab-row .meta{font-family:var(--mono);font-size:11px;color:var(--muted)}
.statusbar{grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;padding:8px 16px;border-top:1px solid var(--line);background:var(--panel2);font-family:var(--mono);font-size:11px;color:var(--muted)}
@media(max-width:720px){.module{grid-template-columns:1fr;gap:6px}}
@media print{.topbar,.side,.statusbar,.filters{display:none}.shell{display:block}}
"""


def composer_head(title: str, desc: str, path_suffix: str) -> str:
    url = f"https://seansooch.dev/designs/composer/{path_suffix}"
    return f"""<!DOCTYPE html>
<html lang="en" data-design="composer">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta name="theme-color" content="#0d1117">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>{COMPOSER_CSS}</style>
<!-- design-switcher:start --><link rel="stylesheet" href="/design-switcher.css?v=f0ec4a2cfd"><script src="/design-switcher.js?v=d8ab4df6ff"></script><script src="/lab-course.js?v=5f7b63c4ab" defer></script><!-- design-switcher:end -->
</head>
"""


def write_composer_index() -> None:
    body = f"""{composer_head("Sean Sooch · The Workbench", "Fourteen live systems across medicine, the military, and machines — composed as a workbench by Cursor Composer 2.5.", "")}
<body>
<div class="shell">
<header class="topbar">
  <a class="logo" href="/designs/composer/" aria-label="Sean Sooch, The Workbench">seansooch<b>.dev</b></a>
  <nav class="tabs" aria-label="Open files">
    <a class="on" href="/designs/composer/">index.tsx</a>
    <a href="/designs/composer/two-stories/">two-stories.md</a>
    <a href="/designs/composer/lab/">lab.course</a>
  </nav>
</header>
<aside class="side">
  <h2>OUTLINE</h2>
  <nav aria-label="Sections">
    <a class="on" href="#intro">// intro</a>
    <a href="#systems">// systems</a>
    <a href="#writing">// writing</a>
    <a href="#lab">// lab</a>
    <a href="#editions">// editions</a>
  </nav>
</aside>
<main class="main">
  <section class="hero" id="intro">
    <p class="kicker">Vol. 03 · View C · Cursor Composer 2.5</p>
    <h1>Sean Sooch</h1>
    <p class="lede">Medical student, military officer, builder. <b>The same world as the other three views</b>, arranged like a workbench: files for navigation, a status line for reachability, and panels that stay out of the way until you need them.</p>
    <div class="metrics">
      <div><b id="sysTotal">{len(SYSTEMS)}</b>systems in registry</div>
      <div><b>150,906</b>lines counted</div>
      <div><b id="probeStamp">probing…</b>reachability</div>
    </div>
  </section>

  <section class="sec" id="systems">
    <div class="sec-h"><h2>// systems</h2><span>Figure 1-1 · live probe from your browser</span></div>
    <div class="filters" role="group" aria-label="Filter by world">
      <button type="button" class="on" data-filter="all">all</button>
      <button type="button" data-filter="med">medicine</button>
      <button type="button" data-filter="mil">military</button>
      <button type="button" data-filter="mac">machines</button>
      <button type="button" data-filter="spt">sports</button>
      <button type="button" data-filter="hum">humanities</button>
      <button type="button" data-filter="mus">music</button>
    </div>
    <div class="modules" id="modules">
{system_rows()}
    </div>
  </section>

  <section class="sec" id="writing">
    <div class="sec-h"><h2>// writing</h2><span>Doctrine · independent research</span></div>
    <div class="writing">
      <a class="tile" href="/designs/composer/two-stories/">
        <h3>Two Stories About the Beginning</h3>
        <p>Origin as a start plus a rule — why a run world and a world that simply began look the same from inside.</p>
      </a>
      <a class="tile" href="/#ch4">
        <h3>More papers on the shared record</h3>
        <p>The Frontier AI Risk Stack, Three Roads From Here, and the rest of Chapter 4 use the same text in every view.</p>
      </a>
    </div>
  </section>

  <section class="sec" id="lab">
    <div class="sec-h"><h2>// lab</h2><span data-lab-text="{{total}} modules · {{ready}} shipped">course ledger</span></div>
    <div data-lab-list="ready">
      <template data-lab-row="ready">
        <a class="lab-row" data-lab-link>
          <span class="no">L-<span data-lab="no"></span></span>
          <span><strong data-lab="title"></strong><br><span class="meta" data-lab="description"></span></span>
          <span class="meta" data-lab="date"></span>
        </a>
      </template>
      <p class="lab-wait" data-lab-wait>Loading lessons from /lab/syllabus.json…</p>
    </div>
    <p style="margin-top:12px;font-size:13px;color:var(--muted)">Full course · <a href="/designs/composer/lab/">open lab.course</a> · lessons are the same single-page apps in every view.</p>
  </section>

  <section class="sec" id="editions">
    <div class="sec-h"><h2>// editions</h2><span>four views · one text</span></div>
    <div class="editions">
      <a class="tile" href="/designs/fable/"><h3>F · Field Manual</h3><p>Claude Fable 5.1</p></a>
      <a class="tile" href="/"><h3>A · Personal Index</h3><p>OpenAI Astra</p></a>
      <a class="tile" href="/designs/opus/"><h3>O · Commentary</h3><p>Claude Opus 5.5 · frontier lead</p></a>
      <div class="tile here" aria-current="page"><h3>C · Workbench</h3><p>Cursor Composer 2.5 · you are here</p></div>
    </div>
  </section>
</main>
<footer class="statusbar">
  <span>© 2026 seansooch.dev · educational tools · not for clinical use</span>
  <span id="statusLine">Workbench view · Composer 2.5</span>
</footer>
</div>
<script>
(function(){{
  var SYSTEMS = {repr([{"id": s[0], "host": s[3].split("//")[1].split("/")[0], "wake": bool(len(s)>5 and s[5])} for s in SYSTEMS]).replace("False", "false").replace("True", "true")};
  function paint(s, st, ms) {{
    var el = document.querySelector('.status[data-sys="'+s.id+'"]');
    if (!el) return;
    el.className = 'status ' + st + (s.wake ? ' wake' : '');
    var note = st === 'up' ? (ms ? ms+'ms' : 'up') : st === 'down' ? 'down' : 'probing';
    el.innerHTML = '<i></i>'+note;
  }}
  function probe(s) {{
    var img = new Image();
    var t0 = performance.now();
    img.onload = img.onerror = function() {{
      paint(s, img.height ? 'up' : 'down', Math.round(performance.now()-t0));
      summarize();
    }};
    img.src = 'https://'+s.host+'/favicon.ico?'+Date.now();
  }}
  function summarize() {{
    var ups = document.querySelectorAll('.status.up').length;
    var done = document.querySelectorAll('.status.up, .status.down').length;
    var stamp = document.getElementById('probeStamp');
    if (stamp) stamp.textContent = ups+'/'+SYSTEMS.length+' up';
    var line = document.getElementById('statusLine');
    if (line && done === SYSTEMS.length) line.textContent = 'probe complete · '+ups+' reachable';
  }}
  SYSTEMS.forEach(function(s,i){{ setTimeout(function(){{ probe(s); }}, i*55); }});
  document.querySelectorAll('.filters button').forEach(function(b){{
    b.addEventListener('click', function(){{
      document.querySelectorAll('.filters button').forEach(function(x){{ x.classList.remove('on'); }});
      b.classList.add('on');
      var f = b.dataset.filter;
      document.querySelectorAll('.module').forEach(function(m){{
        m.classList.toggle('hide', f !== 'all' && m.dataset.world !== f);
      }});
    }});
  }});
}})();
</script>
{switcher_block("composer", "", "composer")}
</body></html>
"""
    (ROOT / "designs/composer/index.html").write_text(body)


def write_composer_lab() -> None:
    html = f"""{composer_head("The Lab · The Workbench", "Core medicine, one picture at a time. Educational only, not for clinical use.", "lab/")}
<body>
<div class="shell">
<header class="topbar">
  <a class="logo" href="/designs/composer/">seansooch<b>.dev</b></a>
  <nav class="tabs"><a href="/designs/composer/">index.tsx</a><a href="/designs/composer/two-stories/">two-stories.md</a><a class="on" href="/designs/composer/lab/">lab.course</a></nav>
</header>
<aside class="side"><h2>ANNEX</h2><nav>
  <a href="/designs/composer/#lab">back to index</a>
  <a class="on" href="#course">course list</a>
</nav></aside>
<main class="main">
  <section class="hero" id="top">
    <p class="kicker">Annex L · medicine</p>
    <h1>The Lab</h1>
    <p class="lede">A course in core medicine, taught one picture at a time. Step-by-step lessons in plain language, then drug classes and disease states animated against the model. <b>Educational only — not for clinical use.</b></p>
    <div class="metrics">
      <div><b data-lab-text="{{ready}}">…</b>lessons ready</div>
      <div><b data-lab-text="{{total}}">…</b>in syllabus</div>
      <div><b data-lab-text="{{latest}}">…</b>latest ship</div>
    </div>
  </section>
  <section class="sec" id="course">
    <div class="sec-h"><h2>// course</h2><span>teaching order</span></div>
    <div data-lab-list="all">
      <template data-lab-row="ready">
        <a class="lab-row" data-lab-link>
          <span class="no">L-<span data-lab="no"></span></span>
          <span><strong data-lab="title"></strong><br><span class="meta" data-lab="description"></span><br><span class="meta" data-lab="topics"></span></span>
          <span class="meta"><span data-lab="date"></span> · open</span>
        </a>
      </template>
      <template data-lab-row="soon">
        <div class="lab-row soon">
          <span class="no">L-<span data-lab="no"></span></span>
          <span><strong data-lab="title"></strong><br><span class="meta" data-lab="description"></span></span>
          <span class="meta">soon</span>
        </div>
      </template>
      <p class="lab-wait" data-lab-wait>Loading from <code>/lab/syllabus.json</code>…</p>
    </div>
  </section>
</main>
<footer class="statusbar"><span>Annex L · same lesson apps in every view</span><a href="/designs/composer/">← index.tsx</a></footer>
</div>
{switcher_block("composer", "lab/", "composer")}
</body></html>
"""
    (ROOT / "designs/composer/lab/index.html").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "designs/composer/lab/index.html").write_text(html)


def write_composer_two_stories() -> None:
    src = (ROOT / "two-stories/index.html").read_text()
    main = re.search(r"<main id=\"top\">.*</main>", src, re.DOTALL)
    if not main:
        raise SystemExit("two-stories main not found")
    main_html = main.group(0)
    main_html = main_html.replace('href="/"', 'href="/designs/composer/"')
    main_html = main_html.replace('href="/#ch4"', 'href="/designs/composer/#writing"')
    main_html = main_html.replace('href="/lab/"', 'href="/designs/composer/lab/"')
    essay_css = """
:root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#79c0ff;--accent2:#ffa657;
--mono:'JetBrains Mono',monospace;--sans:'IBM Plex Sans',sans-serif;--display:'IBM Plex Sans',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth;scroll-padding-top:90px;background:var(--bg)}
body{background:var(--bg);color:var(--text);font:17px/1.75 var(--sans);padding-bottom:120px}
a{color:var(--accent)}.wrap{max-width:920px;margin:auto;padding:0 22px}
.top{position:sticky;top:0;z-index:40;background:#0d1117e6;border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}
.top>.wrap{display:flex;align-items:center;justify-content:space-between;height:64px;font-family:var(--mono);font-size:12px}
.brand{color:var(--text);text-decoration:none;font-weight:600}.brand span{color:var(--accent2)}
.nav{display:flex;gap:14px;flex-wrap:wrap}.nav a{color:var(--muted);text-decoration:none}.nav a:hover{color:var(--accent)}
.nav .back{border:1px solid var(--line);padding:6px 10px;border-radius:6px;color:var(--text)}
.plate{margin-top:24px;border:1px solid var(--line);border-radius:10px;padding:26px;background:var(--panel)}
.plate .row{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:18px}
.plate .dom{color:var(--accent2)}.plate h1{font-size:clamp(36px,6vw,58px);line-height:1.05;letter-spacing:-.03em;margin-bottom:16px}
.plate .sub{color:var(--muted);font-size:16px;max-width:60ch}.plate .sub b{color:var(--text)}
.abstract{margin-top:20px;padding:16px;border-left:3px solid var(--accent);background:#388bfd12;font-size:15px;color:var(--muted)}
.abstract .lbl{font-family:var(--mono);font-size:10px;color:var(--accent2);letter-spacing:.08em}
.plate .foot{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:22px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.plate .foot b{display:block;color:var(--text);font-size:11px;margin-bottom:4px}
.part{padding-top:48px}.ch-head{border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:24px}
.ch-head h2{font-size:28px;letter-spacing:-.02em}.ch-head .lbl,.ch-head .meta{font-family:var(--mono);font-size:11px;color:var(--muted)}
.essay .para{padding:0 0 20px 0;border-left:2px solid var(--line);padding-left:18px;margin-left:4px}
.essay .para.key{border-left-color:var(--accent)}.tbl{overflow:auto;border:1px solid var(--line);border-radius:8px}
.tbl table{width:100%;border-collapse:collapse;font-size:14px}.tbl th{background:var(--panel);text-align:left;padding:12px}
.tbl td{padding:12px;border-top:1px solid var(--line);color:var(--muted);vertical-align:top}.tbl td.k{color:var(--text);font-weight:500}
.tbl td.same{color:var(--accent)}.cap{font-size:12px;color:var(--muted);margin-top:10px}
.box{border:1px solid var(--line);border-radius:8px;padding:16px;background:var(--panel);font-size:14px;color:var(--muted)}
.box .tag{font-family:var(--mono);font-size:10px;color:var(--accent2)}
footer{margin-top:48px;padding:24px 0;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
"""
    html = f"""{composer_head("Two Stories About the Beginning · The Workbench", "The Big Bang and a generated origin as the same kind of story.", "two-stories/")}
<body>
<a class="skip" href="#part1" style="position:absolute;left:-999px">Skip</a>
<header class="top"><div class="wrap">
  <a class="brand" href="/designs/composer/">SS<span>—</span>03</a>
  <nav class="nav" aria-label="Paper">
    <a href="#part1">§ I</a><a href="#table43">table</a><a href="#part2">§ II</a><a href="#sources">sources</a>
    <a href="/designs/composer/lab/">lab</a>
    <a class="back" href="/designs/composer/#writing">← writing</a>
  </nav>
</div></header>
<style>{essay_css}</style>
{main_html}
<footer><div class="wrap">
  <span>© 2026 seansooch.dev · Table 4-3 · Workbench view</span>
  <span><a href="/designs/composer/#writing">Back to writing</a> · <a href="/designs/composer/">index.tsx</a></span>
</div></footer>
{switcher_block("composer", "two-stories/", "composer")}
</body></html>
"""
    (ROOT / "designs/composer/two-stories/index.html").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "designs/composer/two-stories/index.html").write_text(html)


def patch_sitemap() -> None:
    path = ROOT / "sitemap.xml"
    text = path.read_text()
    block = """
  <url><loc>https://seansooch.dev/designs/composer/</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>
  <url><loc>https://seansooch.dev/designs/composer/two-stories/</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://seansooch.dev/designs/composer/lab/</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
"""
    if "designs/composer/" not in text:
        text = text.replace(
            "  <url><loc>https://seansooch.dev/designs/opus/lab/</loc>",
            block + "  <url><loc>https://seansooch.dev/designs/opus/lab/</loc>",
        )
    path.write_text(text)


def main() -> None:
    (ROOT / "designs/composer").mkdir(parents=True, exist_ok=True)
    write_composer_index()
    write_composer_lab()
    write_composer_two_stories()
    patch_switchers()
    patch_astra_editions()
    patch_fable_editions()
    patch_opus_witness()
    patch_sitemap()
    print("Composer view generated.")


if __name__ == "__main__":
    main()
