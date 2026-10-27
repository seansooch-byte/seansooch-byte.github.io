#!/usr/bin/env python3
"""Generate Composer 2.5 view pages and patch design switchers across the site."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

COMPOSER_LINK = '<a class="design-choice" data-design="composer" href="{href}">Composer 2.5</a>'

SWITCHER_NAV_RE = re.compile(
    r'<!-- design-switcher:start --><nav class="design-switcher"[^>]*>.*?</nav><div class="design-curtain"[^>]*>.*?</div><!-- design-switcher:end -->',
    re.DOTALL,
)

def switcher_href(design: str, page: str) -> str:
    bases = {
        'astra': {'': '/', 'lab': '/lab/', 'two-stories': '/two-stories/'},
        'fable': {'': '/designs/fable/', 'lab': '/designs/fable/lab/', 'two-stories': '/designs/fable/two-stories/'},
        'opus': {'': '/designs/opus/', 'lab': '/designs/opus/lab/', 'two-stories': '/designs/opus/two-stories/'},
        'composer': {'': '/designs/composer/', 'lab': '/designs/composer/lab/', 'two-stories': '/designs/composer/two-stories/'},
    }
    return bases[design][page]

def build_switcher_nav(selected: str, page: str) -> str:
    parts = []
    for d, label in [
        ('astra', 'Astra'),
        ('fable', 'Fable 5.1'),
        ('opus', 'Opus 5.5'),
        ('composer', 'Composer 2.5'),
    ]:
        href = switcher_href(d, page)
        cur = ' aria-current="page"' if d == selected else ''
        parts.append(f'<a class="design-choice" data-design="{d}" href="{href}"{cur}>{label}</a>')
    curtain = {
        'astra': ('ASTRA', 'THE PERSONAL INDEX'),
        'fable': ('FABLE 5.1', 'THE FIELD MANUAL'),
        'opus': ('OPUS 5.5', 'THE COMMENTARY'),
        'composer': ('COMPOSER 2.5', 'THE LIVE STACK'),
    }[selected]
    return (
        f'<!-- design-switcher:start --><nav class="design-switcher" aria-label="Website design" data-selected="{selected}">'
        f'<span class="design-caption">SAME WORLD.<br>FOUR VIEWS.</span><div class="design-options">'
        + ''.join(parts)
        + f'</div></nav><div class="design-curtain" data-destination="{selected}" aria-hidden="true">'
        f'<strong>{curtain[0]}</strong><span>{curtain[1]}</span></div><!-- design-switcher:end -->'
    )

def patch_switchers(path: Path, selected: str, page: str) -> None:
    text = path.read_text(encoding='utf-8')
    new_nav = build_switcher_nav(selected, page)
    if not SWITCHER_NAV_RE.search(text):
        raise SystemExit(f'No switcher nav in {path}')
    text = SWITCHER_NAV_RE.sub(new_nav, text)
    text = text.replace('THREE VIEWS', 'FOUR VIEWS')
    path.write_text(text, encoding='utf-8')

COMPOSER_STYLE_PREFIX = """/* The Live Stack — Composer 2.5: an operations deck. Dark ground, monospace telemetry,
   one signal green. Same content as the other views, read like a status board. */
:root{--paper:#0c1018;--paper-2:#121a24;--white:#161f2c;--ink:#e8edf4;--ink-2:#8b9aad;--rule:#2a3544;--rule-2:#1e2836;--accent:#3dd9c4;--med:#5b9dff;--mil:#7dd87a;--mac:#3dd9c4;--spt:#ffb347;--hum:#c9a0ff;--mus:#ff6b9d;--ok:#3dd9c4;--bad:#ff6b6b;--sans:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace;--display:'IBM Plex Sans',system-ui,sans-serif;--space:clamp(22px,4vw,64px)}
"""

def transform_to_composer_home(src: str) -> str:
    out = src
    out = out.replace('data-design="astra"', 'data-design="composer"')
    out = out.replace('<title>Sean Sooch — Personal Index</title>', '<title>Sean Sooch: The Live Stack</title>')
    out = out.replace('Personal Index', 'The Live Stack', 1)  # title only if needed
    out = re.sub(
        r'<meta name="description" content="[^"]*">',
        '<meta name="description" content="Fourteen working systems across medicine, the military, and frontier AI, laid out as a live operations deck. Built by a medical student and military officer with AI as the engineering tool. Every host is probed from your browser when the page loads.">',
        out,
        count=1,
    )
    out = out.replace('content="https://seansooch.dev/"', 'content="https://seansooch.dev/designs/composer/"')
    out = out.replace('name="theme-color" content="#f7f7f2"', 'name="theme-color" content="#0c1018"')
    out = out.replace(
        "family=Anton&family=Space+Grotesk:wght@400;500;600;700",
        "family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400",
    )
    out = out.replace('<style>:root{', '<style>' + COMPOSER_STYLE_PREFIX + ':root{', 1)
    # Composer-specific overrides on top of inherited layout rules
    out = out.replace(
        '</style><!-- design-switcher:start -->',
        """
body{background:var(--paper);background-image:linear-gradient(180deg,#0c1018 0%,#0a0e14 100%)}
.top{background:rgba(12,16,24,.92);border-bottom-color:var(--rule)}
.brand{font-family:var(--mono);font-size:15px;letter-spacing:.06em;font-weight:600}
.brand span{color:var(--accent)}
.nav-note{font-family:var(--mono);font-size:8px;letter-spacing:.14em;color:var(--accent)}
.cover h1{font-family:var(--mono);font-weight:600;font-size:clamp(42px,9vw,120px);letter-spacing:-.04em}
.name-period{color:var(--accent)}
.discipline-band{background:var(--paper-2);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.triad button{font-family:var(--mono);font-size:14px;letter-spacing:.02em}
.card:first-child{background:linear-gradient(135deg,#12352c,#0c1018);border:1px solid var(--accent);color:var(--ink)}
.card:hover{background:#151d28}
.ch-head h2{font-family:var(--mono);font-weight:500;letter-spacing:-.03em}
.lbl{font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;font-size:10px}
.sdot.up i{box-shadow:0 0 6px var(--ok)}
footer{background:var(--paper-2);border-top:1px solid var(--accent);color:var(--ink)}
.footer-name{font-family:var(--mono)}
.views-band{background:var(--paper-2);border:1px solid var(--rule)}
.views-cap span:first-child{font-family:var(--mono);color:var(--accent)}
.view-cell.here .view-no{color:var(--accent)}
.view-cell.frontier{background:transparent;border:1px solid var(--accent)}
a.view-cell.frontier:hover{background:#12352c}
</style><!-- design-switcher:start -->""",
        1,
    )
    out = out.replace('A PERSONAL INDEX<br>SEPTEMBER 2026', 'THE LIVE STACK<br>COMPOSER 2.5 · OCT 2026')
    out = out.replace('href="https://seansooch.dev/lab/"', 'href="/designs/composer/lab/"')
    out = out.replace('href="/designs/fable/two-stories/"', 'href="/designs/composer/two-stories/"')
    # Edition stamp
    out = out.replace('FABLE 5.1 / DESIGN STUDY', 'CURSOR COMPOSER 2.5 / LIVE STACK')
    # Views band: 4 columns + composer cell
    out = out.replace('grid-template-columns:repeat(3,1fr)', 'grid-template-columns:repeat(4,1fr)')
    out = out.replace(
        'Same world. Three views.',
        'Same world. Four views.',
    )
    composer_cell = (
        '<a class="view-cell frontier" href="/designs/composer/" data-index="The Live Stack (view C)" '
        'data-ref="06 / Editions" data-kw="editions view cursor composer 2.5">'
        '<span class="view-no">04</span><span class="view-by">Cursor Composer 2.5 · Vol. 03</span>'
        '<span class="view-name">The Live Stack <span class="new">New</span></span>'
        '<span class="view-note">An operations deck: dark telemetry, green reachability lights, monospace labels.</span>'
        '<span class="view-go" aria-hidden="true">↗︎</span></a>'
    )
    if 'The Live Stack (view C)' not in out:
        out = out.replace(
            '<span class="view-go" aria-hidden="true">↗︎</span></a></div></div><!-- edition-views:end -->',
            '<span class="view-go" aria-hidden="true">↗︎</span></a>' + composer_cell + '</div></div><!-- edition-views:end -->',
            1,
        )
    # Editions table row
    if 'Composer 2.5' not in out.split('edition-views')[0]:
        pass
    out = out.replace(
        '<td>OpenAI Astra + Claude Fable 5.1 + Claude Opus 5.5</td>',
        '<td>OpenAI Astra + Claude Fable 5.1 + Claude Opus 5.5 + Cursor Composer 2.5</td>',
    )
    out = out.replace(
        '<p class="views-cap"><span>Same world. Four views.</span>',
        '<p class="views-cap"><span>Same world. Four views.</span>',
    )
    # Hands line in footer
    out = out.replace(
        'Vol. 03 by Claude Fable 5.1,<br>with OpenAI Astra as co-author.',
        'Vol. 03 · this view by <b>Cursor Composer 2.5</b>, fourth in line.',
    )
    return out

def transform_two_stories(src: str) -> str:
    out = src
    out = out.replace('data-design="astra"', 'data-design="composer"')
    out = out.replace('theme-color" content="#f7f7f2"', 'theme-color" content="#0c1018"')
    out = out.replace(
        "family=Anton&family=Space+Grotesk:wght@400;500;600;700",
        "family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400",
    )
    out = out.replace('<style>:root{', '<style>' + COMPOSER_STYLE_PREFIX + ':root{', 1)
    out = out.replace(
        '</style>\n<!-- design-switcher:start -->',
        """
body{background:var(--paper)}
.top{background:rgba(12,16,24,.94);border-bottom-color:var(--rule)}
.brand{font-family:var(--mono);font-size:15px;font-weight:600;letter-spacing:.06em}
.plate h1{font-family:var(--mono);font-weight:600;letter-spacing:-.03em;text-transform:none}
.abstract{background:linear-gradient(135deg,#12352c,#0f1a22);border:1px solid var(--accent)}
.abstract .lbl{color:var(--accent)}
.tbl th{background:var(--paper-2);color:var(--accent);border-color:var(--rule)}
footer{background:var(--paper-2);border-top:1px solid var(--rule)}
</style>
<!-- design-switcher:start -->""",
        1,
    )
    out = out.replace('href="/"', 'href="/designs/composer/"')
    out = out.replace('href="/lab/"', 'href="/designs/composer/lab/"')
    out = out.replace('href="/#ch4"', 'href="/designs/composer/#ch4"')
    out = out.replace('Table 4-3 in the Field Manual', 'Table 4-3 in The Live Stack')
    out = out.replace('Field Manual, Vol. 03', 'The Live Stack')
    out = out.replace('FM 03', 'LS 03')
    return out

def build_composer_lab() -> str:
    fable = (ROOT / 'designs/fable/lab/index.html').read_text(encoding='utf-8')
    out = fable.replace('data-design="fable"', 'data-design="composer"')
    out = out.replace('theme-color" content="#', 'theme-color" content="#0c1018" x="')
    out = out.replace('theme-color" content="#0c1018" x="e9e3d4"', 'theme-color" content="#0c1018"')
    out = out.replace('/designs/fable/', '/designs/composer/')
    out = out.replace('Field Manual', 'The Live Stack')
    out = out.replace('FM 03', 'LS 03')
    out = out.replace('Annex L', 'Module L')
    out = out.replace(
        '<title>The Lab | Sean Sooch, Field Manual Vol. 03</title>',
        '<title>The Lab | Sean Sooch, The Live Stack</title>',
    )
    # Inject composer palette at start of style
    out = out.replace('<style>', '<style>\n' + COMPOSER_STYLE_PREFIX, 1)
    out = out.replace(
        'body{background:var(--paper);',
        'body{background:var(--paper);font-family:var(--sans);\n',
        1,
    )
    return out

def patch_fable_views3(text: str) -> str:
    text = text.replace('grid-template-columns:repeat(3,1fr)', 'grid-template-columns:repeat(4,1fr)')
    if 'view C' in text or 'Composer 2.5' in text:
        return text
    cell = (
        '<a class="view" style="--w:var(--mac)" href="/designs/composer/" data-index="The Live Stack (view C)" '
        'data-ref="Figure A-1" data-kw="editions view cursor composer 2.5">'
        '<span class="fn"><span class="dom">View C · fourth in line</span><span>Vol. 03</span></span>'
        '<span class="sig" aria-hidden="true">C</span><h3>The Live Stack</h3>'
        '<p>Dark ops deck: reachability lights, monospace telemetry, one signal green.</p>'
        '<span class="by">Designed by <b>Cursor Composer 2.5</b></span>'
        '<span class="ft"><span>Open stack</span><span>↗︎</span></span></a>'
    )
    return text.replace(
        '<div class="views3">',
        '<div class="views3">' + cell,
        1,
    )

def main() -> None:
    # Retired 2026-10-27. This script made the first draft of view C, and the pages were then finished by hand: a
    # rerun on the current tree does not reproduce them (it brings back view A's light palette under the dark one),
    # it widens two unrelated grids on the Fable home page to four columns, and it writes the switcher without the
    # content stamps, which is how returning readers got a three-view bar with Composer wrapped under it. The pages in
    # designs/composer/ are now edited by hand (see ARCHITECTURE.md); the switcher comes from the preview.
    if '--i-know' not in sys.argv:
        raise SystemExit(__doc__.strip() + '\nRetired: edit designs/composer/ by hand. See the note in main().')
    patch_switchers(ROOT / 'index.html', 'astra', '')
    patch_switchers(ROOT / 'lab/index.html', 'astra', 'lab')
    patch_switchers(ROOT / 'two-stories/index.html', 'astra', 'two-stories')
    patch_switchers(ROOT / 'designs/fable/index.html', 'fable', '')
    patch_switchers(ROOT / 'designs/fable/lab/index.html', 'fable', 'lab')
    patch_switchers(ROOT / 'designs/fable/two-stories/index.html', 'fable', 'two-stories')
    patch_switchers(ROOT / 'designs/opus/index.html', 'opus', '')
    patch_switchers(ROOT / 'designs/opus/lab/index.html', 'opus', 'lab')
    patch_switchers(ROOT / 'designs/opus/two-stories/index.html', 'opus', 'two-stories')

    # Patch views sections on home pages
    idx = (ROOT / 'index.html').read_text(encoding='utf-8')
    if 'repeat(4,1fr)' not in idx:
        idx = idx.replace('grid-template-columns:repeat(3,1fr)', 'grid-template-columns:repeat(4,1fr)')
        composer_cell = (
            '<a class="view-cell frontier" href="/designs/composer/" data-index="The Live Stack (view C)" '
            'data-ref="06 / Editions" data-kw="editions view cursor composer 2.5">'
            '<span class="view-no">04</span><span class="view-by">Cursor Composer 2.5 · Vol. 03</span>'
            '<span class="view-name">The Live Stack <span class="new">New</span></span>'
            '<span class="view-note">An operations deck: dark telemetry, green reachability lights, monospace labels.</span>'
            '<span class="view-go" aria-hidden="true">↗︎</span></a>'
        )
        idx = idx.replace(
            '<span class="view-go" aria-hidden="true">↗︎</span></a></div></div><!-- edition-views:end -->',
            '<span class="view-go" aria-hidden="true">↗︎</span></a>' + composer_cell + '</div></div><!-- edition-views:end -->',
        )
        idx = idx.replace(
            '<td>OpenAI Astra + Claude Fable 5.1 + Claude Opus 5.5</td>',
            '<td>OpenAI Astra + Claude Fable 5.1 + Claude Opus 5.5 + Cursor Composer 2.5</td>',
        )
        (ROOT / 'index.html').write_text(idx, encoding='utf-8')

    for name in ('designs/fable/index.html', 'designs/opus/index.html'):
        p = ROOT / name
        t = p.read_text(encoding='utf-8')
        t2 = patch_fable_views3(t) if 'views3' in t else t
        if 'The Live Stack' not in t2 and 'views-band' in t2:
            t2 = t2.replace('grid-template-columns:repeat(3,1fr)', 'grid-template-columns:repeat(4,1fr)')
        p.write_text(t2, encoding='utf-8')

    home = transform_to_composer_home((ROOT / 'index.html').read_text(encoding='utf-8'))
    home = build_switcher_nav('composer', '')
    # fix: home already has switcher from transform - re-read and replace switcher only
    home_full = transform_to_composer_home((ROOT / 'index.html').read_text(encoding='utf-8'))
    home_full = SWITCHER_NAV_RE.sub(build_switcher_nav('composer', ''), home_full)
    (ROOT / 'designs/composer/index.html').write_text(home_full, encoding='utf-8')

    ts = transform_two_stories((ROOT / 'two-stories/index.html').read_text(encoding='utf-8'))
    ts = SWITCHER_NAV_RE.sub(build_switcher_nav('composer', 'two-stories'), ts)
    (ROOT / 'designs/composer/two-stories/index.html').write_text(ts, encoding='utf-8')

    lab = build_composer_lab()
    lab = SWITCHER_NAV_RE.sub(build_switcher_nav('composer', 'lab'), lab)
    (ROOT / 'designs/composer/lab/index.html').write_text(lab, encoding='utf-8')

    print('Composer view generated.')

if __name__ == '__main__':
    main()
