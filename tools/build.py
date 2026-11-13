#!/usr/bin/env python3
"""Build the edition's pages from the record. Never shipped (tools/ is export-ignore).

    python3 tools/build.py            write every edition page
    python3 tools/build.py --lab      write only the Lab course page and sitemap.xml (what a new lesson changes)
    python3 tools/build.py --check    write nothing; say which pages are not what the builder writes; exit 1 if
                                      any is stale (the home page merely behind the Lab's ledger is not: see verdicts)

Expected behaviour:
  - Reads content/record.json (works, papers, films, volumes, prose), content/two-stories.json (the paper),
    the Lab's ledger (lab/syllabus.json, lab/apps.json, each lesson's plan.json and index.html) and
    plates/manifest.json (which captures exist). Writes index.html, two-stories/index.html, lab/index.html,
    404.html and sitemap.xml. Nothing else is written, and a second run changes nothing.
  - Every count a page prints is computed here. A sentence in the record asks for one with {braces}.
  - Every string from the record or the ledger is escaped. The only markup a sentence can carry is **bold**;
    a paragraph of the paper may also carry <b> and <a href>.
  - The pages hold no inline script and no inline style: behaviour is /v4/boot.js and /v4/site.js, looks are
    /v4/site.css, each asked for by a stamp of its bytes (tools/stage.sh refuses a stale one).
  - Both tellings of a sentence (technical and plain) are in the page; <html data-voice> shows one.
  - A work with no capture gets a set title in place of a plate, so a missing image never breaks a page.
  - The record, the plates manifest and the ledger can be changed by a pull request or by a pipeline outside
    this repo, so nothing in them is trusted to be well formed: an id that is not plain lowercase words, an
    address that is not https, a film that is not under /videos/, a unit id that is not a slug, or two things
    wanting one anchor stops the build with a sentence saying which. A lesson whose slug or date is not what
    it should be is left out, as the Lab's own generator always did.
  - The home page prints only what stays true of the Lab when a lesson is added: the lessons it lists, by unit,
    and how many. Hours and question counts are the course page's to print. So a lesson's own deploy, which
    rewrites only the Lab's pages, leaves a home page that is behind and never wrong.

tools/edition_test.py holds the build to this.
"""
import os       # loaded before any script starts, so never looked up beside this file
import sys

# However this file is started, nothing left beside it is imported in place of the standard library. Python puts a
# script's own folder first on its path, and a pull request can leave an html.py in tools/. (stage.sh also runs it -I.)
if sys.path and os.path.realpath(sys.path[0]) == os.path.dirname(os.path.realpath(__file__)):      # realpath: /tmp is a link
    del sys.path[0]

import datetime  # noqa: E402
import hashlib   # noqa: E402
import html      # noqa: E402
import json      # noqa: E402
import re        # noqa: E402
from collections import Counter  # noqa: E402
from pathlib import Path         # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://seansooch.dev'
FONTS = ('https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900'
         '&family=Roboto+Serif:ital,opsz,wght@0,8..144,100..900;1,8..144,100..900&display=swap')
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*\Z')
ID = re.compile(r'^[a-z][a-z0-9]*\Z')
# An address on another host, and a path on this one. A browser reads "//host", "/\\host" and a path with a tab or a
# line break in it as another host, so a path has one leading slash, no backslash and no space or control character.
# Each pattern ends with \Z: in Python, $ also matches before a last line break.
HTTPS = re.compile(r'^https://[A-Za-z0-9.-]+(:\d+)?(/[^\\\x00-\x20]*)?\Z')
PATH = re.compile(r'^/(?![/\\])[^\\\x00-\x20]*\Z')
DAY = re.compile(r'^\d{4}(-\d{2}){0,2}\Z')
# Anchors the pages use for themselves: no work, paper or film may take one.
RESERVED = {'top', 'name', 'work', 'writing', 'guidance', 'films', 'editions', 'record', 'index', 'about', 'course', 'review', 'more',
            'palette', 'ld', 'probes', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'appa', 'appb', 'indexsec'}
LAB_PAGES = ('lab/index.html', 'sitemap.xml')    # what a lesson's own deploy rewrites (--lab)
LEDGER_FED = 'index.html'                        # the one other page that lists lessons: it may be behind the ledger
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
WORDS = ('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen '
         'seventeen eighteen nineteen').split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()
# Sections of this origin that are not built here. They ship from their own sources; the sitemap lists them.
ELSEWHERE = [
    ('/ekg/', 'monthly', '0.9'), ('/antibiotic-coverage/', 'monthly', '0.8'), ('/calculators/', 'monthly', '0.8'),
    ('/lab-values/cbc-cmp/', 'monthly', '0.8'), ('/lab-values/', 'monthly', '0.8'), ('/differentials/', 'monthly', '0.8'),
    ('/tccc/', 'monthly', '0.8'), ('/toolkit/', 'monthly', '0.7'), ('/force-multipliers/', 'monthly', '0.7'),
    ('/force-multipliers/graph-vs-loop/', 'monthly', '0.6'), ('/force-multipliers/obsidian-reader/', 'monthly', '0.6'),
    ('/force-multipliers/anki/', 'monthly', '0.6'), ('/music/', 'monthly', '0.7'), ('/music/last-light/', 'yearly', '0.7'),
    ('/music/three-roads/', 'yearly', '0.6'),
]


# ---------------------------------------------------------------- words and numbers

def esc(s):
    return html.escape(str(s), quote=True)


def inline(s):
    """A sentence from the record as markup: escaped, with **bold** as the only thing it can ask for."""
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', esc(s))


def word(n):
    if n < 20:
        return WORDS[n]
    if n < 100:
        return TENS[n // 10 - 2] + ('-' + WORDS[n % 10] if n % 10 else '')
    return f'{n:,}'


def day(iso):
    """'2026-09-22' -> '22 Sep 2026'; '2026-11' -> 'November 2026'; '2026' -> '2026'. Anything else is not a date."""
    if not isinstance(iso, str) or not DAY.match(iso) or not 1 <= int((iso + '-01')[5:7]) <= 12 or (len(iso) == 10 and not real_day(iso)):
        raise ValueError(f'{iso!r} is not a date: write 2026, 2026-11 or 2026-11-09')
    p = iso.split('-')
    if len(p) == 1:
        return p[0]
    if len(p) == 2:
        return f'{MONTHS[int(p[1]) - 1]} {p[0]}'
    return f'{int(p[2])} {MONTHS[int(p[1]) - 1][:3]} {p[0]}'


def month(iso):
    """'2026-11-09' or '2026-11' -> 'November 2026'."""
    day(iso)
    return day(iso[:7] if len(iso) > 4 else None)


def duration(minutes):
    """Whole minutes as a reader says them: 'about 9 and a half hours'."""
    if minutes < 60:
        return f'about {minutes} min'
    halves = round(minutes / 30) / 2
    if halves == 1:
        return 'about an hour'
    return f"about {int(halves)}{' and a half' if halves % 1 else ''} hours"


def fill(site, s):
    """Fill the {braces} in a sentence from the record. An unknown brace stops the build; it is never printed."""
    n = site['n']

    def one(m):
        key = m.group(1)
        if key not in n:
            raise ValueError(f'the record asks for {{{key}}}, which the build does not compute')
        return str(n[key])
    return re.sub(r'\{([A-Za-z_]+)\}', one, s)


def said(site, item, cls='say', tag='p'):
    """Both tellings of one sentence. /v4/site.css shows the one <html data-voice> asks for."""
    return (f'<{tag} class="{cls}"><span class="t">{inline(fill(site, item["tech"]))}</span>'
            f'<span class="p">{inline(fill(site, item["plain"]))}</span></{tag}>')


def breakable(name):
    """A name written as one word (AdmissionsAcademy) may break where its capitals meet."""
    return re.sub(r'(?<=[a-z])(?=[A-Z][a-z])', '<wbr>', esc(name))


def has_kept(w):
    """A work with an earlier edition that is still online at its own address."""
    return any(e.get('url') for e in w['editions'][:-1])


def comparable(site, w):
    """A work whose earlier edition can be set beside it: kept, and captured."""
    return any(e.get('url') and site['plates'].get(f"{w['id']}-e{e['n']}") for e in w['editions'][:-1])


def told(site, key):
    """A sentence of the record that has one telling."""
    return inline(fill(site, site['record']['text'][key]))


def plate_note(w, before):
    """What has to be said wherever a work's plate is shown (that its patients are made up, say). tools/plates.mjs
    also draws it into the capture, so the picture carries it when it travels without its caption."""
    return before + w['plate_note'] if w.get('plate_note') else ''


def edition_label(e):
    return f"Edition {e['n']}" + (f", {e['name']}" if e.get('name') else '')


def stamp(root, asset):
    return hashlib.md5((root / asset.lstrip('/')).read_bytes()).hexdigest()[:10]


def webp_size(path):
    """(width, height) of a WebP file, read from its header: lossy, lossless or extended."""
    d = path.read_bytes()[:40]
    if d[12:16] == b'VP8 ':
        return int.from_bytes(d[26:28], 'little') & 0x3fff, int.from_bytes(d[28:30], 'little') & 0x3fff
    if d[12:16] == b'VP8L':
        bits = int.from_bytes(d[21:25], 'little')
        return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    if d[12:16] == b'VP8X':
        return int.from_bytes(d[24:27], 'little') + 1, int.from_bytes(d[27:30], 'little') + 1
    raise ValueError(f'{path.name} is not a WebP file the pages can size')


# ---------------------------------------------------------------- reading

def real_day(d):
    """'2026-11-09' and nothing looser: a day that exists."""
    try:
        return bool(re.match(r'^\d{4}-\d{2}-\d{2}\Z', d)) and bool(datetime.date.fromisoformat(d))
    except (TypeError, ValueError):
        return False


def vol_key(v):
    """'Vol. 04' -> 'vol4': a volume's anchor and the name of its plate."""
    return 'vol' + str(int(re.search(r'\d+', v['vol']).group()))


def validate(record, essay, plates):
    """Stop the build on a record that could not be set safely. Every string is escaped where it is printed;
    this is about the strings that become ids, addresses and file names."""
    def need(cond, what):
        if not cond:
            raise ValueError(f'the record cannot be built: {what}')

    def dated(d):
        try:
            return bool(day(d))
        except ValueError:
            return False

    ed, site = record['edition'], record['site']
    need(real_day(ed.get('issued')) and real_day(ed.get('counted')), 'the edition needs the day it was issued and the day it was counted, as 2026-11-09')
    need(isinstance(site.get('first_deploy'), str) and re.match(r'^\d{4}-\d{2}\Z', site['first_deploy']) and dated(site['first_deploy']), 'the site needs the month of its first deploy, as 2026-04')
    worlds = set()
    for w in record['worlds']:
        need(ID.match(str(w.get('id', ''))) and SLUG.match(str(w.get('slug', ''))), f"world {w.get('id')!r} needs a plain id and slug")
        worlds.add(w['id'])
    anchors = set(RESERVED)

    def claim(anchor, who):
        need(anchor not in anchors, f'{who} wants the anchor #{anchor}, which is taken')
        anchors.add(anchor)

    for w in record['works']:
        wid = str(w.get('id', ''))
        need(ID.match(wid), f'work id {wid!r} is not plain lowercase letters and digits')
        claim(wid, f'work {wid}')
        claim(wid + '-prior', f'work {wid}')
        need(w.get('world') in worlds and set(w.get('also', [])) <= worlds - {w.get('world')}, f'{wid}: unknown world')
        need(w.get('tier') in ('major', 'minor'), f'{wid}: tier is major or minor')
        need(HTTPS.match(str(w.get('url', ''))), f'{wid}: its address must be https')
        need(w.get('plate_url') is None or HTTPS.match(str(w['plate_url'])) or PATH.match(str(w['plate_url'])), f'{wid}: its plate is taken from an https address or a path on this site')
        need(w.get('plate_scroll') is None or re.match(r'^#[a-z0-9-]+\Z', str(w['plate_scroll'])), f'{wid}: plate_scroll is the #id of something on the page')
        need(w.get('stats') == 'ledger' or isinstance(w.get('stats'), list) and all(isinstance(x, list) and len(x) == 2 for x in w['stats']), f'{wid}: a stat is a figure and a label')
        eds = w.get('editions', [])
        need(all(type(e.get('n')) is int for e in eds), f'{wid}: an edition needs a number')
        need(all(e.get('date') is None or dated(e['date']) for e in eds), f'{wid}: an edition is dated 2026, 2026-11 or 2026-11-09')
        need(not eds or eds[-1].get('current') is True, f'{wid}: editions are listed oldest first, the current one last')
        need(all(e.get('url') is None or HTTPS.match(str(e['url'])) for e in eds[:-1]), f'{wid}: a kept edition needs an https address, or null if it was not kept')
    for p in record['papers']:
        need(SLUG.match(str(p.get('id', ''))), f"paper id {p.get('id')!r} is not a slug")
        claim(p['id'], f"paper {p['id']}")
        need(all(HTTPS.match(str(link.get('href', ''))) or PATH.match(str(link.get('href', ''))) for link in p['links']), f"{p['id']}: a link is https or a path on this site")
    g = record['guidance']
    need(re.match(r'^https://www\.ama-assn\.org/', str(g.get('href', ''))), 'the guidance links to its source at the issuer')
    need(re.match(r'^/figures/[a-z0-9-]+\.webp\Z', str(g['figure'].get('src', ''))) and type(g['figure'].get('w')) is int and type(g['figure'].get('h')) is int,
         'the guidance figure is a sized webp under /figures/')
    need(all(isinstance(pt, list) and len(pt) == 3 for pt in g['points']), 'a guidance point is a heading, the question and the answer')
    need(all(isinstance(g.get(k), str) and g[k].strip() for k in ('title', 'label', 'name', 'issuer', 'reviewed', 'rights', 'link')), 'the guidance needs its title, label, name, issuer, link, rights line and the line that it has not reviewed this site')
    for f in record['films']:
        need(SLUG.match(str(f.get('id', ''))), f"film id {f.get('id')!r} is not a slug")
        claim(f['id'], f"film {f['id']}")
        need(re.match(r'^/videos/[A-Za-z0-9._-]+\.mp4\Z', str(f.get('src', ''))), f"{f['id']}: a film is an mp4 under /videos/")
        need(re.match(r'^/videos/[A-Za-z0-9._-]+\.jpg\Z', str(f.get('poster', ''))), f"{f['id']}: a film needs a jpg poster under /videos/")
    for v in record['volumes']:
        need(re.search(r'\d+', str(v.get('vol', ''))), 'a volume needs its number')
        if v['status'] != 'awaiting':
            claim(vol_key(v), v['vol'])
        need(HTTPS.match(str(v['href'])) if v.get('href') or v['status'] == 'retired' else True, f"{v['vol']}: a retired volume needs the https address of its archive")
        for view in v.get('views', []):
            need(re.match(r'^[A-Z]\Z', str(view.get('siglum', ''))) and re.match(r'^([a-z]+/)*\Z', str(view.get('path', 'x'))), f"{v['vol']}: a view needs a one-letter siglum and a plain path")
            claim(f"{vol_key(v)}-{view['siglum'].lower()}", f"view {view['siglum']}")
    theme = record['theme']
    need(ID.match(str(theme.get('id', ''))) and all(isinstance(theme.get(k), str) and theme[k].strip() for k in ('label', 'hint', 'note', 'notice')), 'the theme needs a plain id, a label, a hint, a note and the imagery notice')
    for photo in theme['photos']:
        need(ID.match(str(photo.get('id', ''))), f"theme photograph id {photo.get('id')!r} is not plain lowercase letters and digits")
        need(HTTPS.match(str(photo.get('source', ''))), f"{photo['id']}: a photograph names the https address it came from")
        need(dated(photo.get('taken')), f"{photo['id']}: a photograph is dated 2026-11-09")
    for name, p in plates.items():
        need(SLUG.match(name) and type(p.get('w')) is int and type(p.get('h')) is int, f'plates/manifest.json: {name!r} needs a plain name and whole-number sizes')
        need(real_day(p.get('taken')), f'plates/manifest.json: {name!r} needs the day it was taken')
    for part in essay['parts']:
        need(SLUG.match(str(part.get('id', ''))), f"the paper: part id {part.get('id')!r} is not a slug")
        need('rows' in part or re.match(r'^[A-Z]+\Z', str(part.get('mark', ''))), f"the paper: {part['id']} needs a mark of capital letters")


def read_lab(root, only=None):
    """The Lab's ledger and what each lesson's own files say. The ledger is written by a pipeline outside
    this repo, so nothing in it is trusted: a slug must be plain words, a date a real day. `only` cuts the ledger
    down to those lessons, as if the others had not shipped yet."""
    lab = root / 'lab'
    apps = [a for a in json.loads((lab / 'apps.json').read_text(encoding='utf-8'))
            if isinstance(a, dict) and SLUG.match(str(a.get('slug', ''))) and real_day(a.get('date'))
            and isinstance(a.get('title'), str) and a['title'].strip() and (lab / a['slug'] / 'index.html').is_file()
            and (only is None or a['slug'] in only)]
    syl = json.loads((lab / 'syllabus.json').read_text(encoding='utf-8'))
    mods = [m for m in syl.get('modules', []) if isinstance(m, dict) and SLUG.match(str(m.get('slug', '')))]
    units = syl.get('units', [])
    for u in units:
        if not SLUG.match(str(u.get('id', ''))) or u['id'] in RESERVED:
            raise ValueError(f"lab/syllabus.json: unit id {u.get('id')!r} is not a slug the course page can use as an address")
        u['title'] = u['title'] if isinstance(u.get('title'), str) and u['title'].strip() else u['id']
    for item in apps + mods:
        item['description'] = item['description'] if isinstance(item.get('description'), str) else ''
        item['title'] = item['title'] if isinstance(item.get('title'), str) and item['title'].strip() else item['slug']
    by = {a['slug']: a for a in apps}
    known = {m['slug'] for m in mods}
    # A lesson the syllabus has not placed yet is numbered after the ones it has, oldest first.
    extra = sorted((a for a in apps if a['slug'] not in known), key=lambda a: (a['date'], a['slug']))
    number = {m['slug']: i + 1 for i, m in enumerate(mods + extra)}
    facts = {}
    for a in apps:
        page = (lab / a['slug'] / 'index.html').read_text(encoding='utf-8')
        kinds = [(k, int(n)) for n, k in re.findall(r'<article data-step="(\d+)"[^>]*data-kind="([^"]+)"', page)]
        plan_file = lab / a['slug'] / 'plan.json'
        plan = json.loads(plan_file.read_text(encoding='utf-8')) if plan_file.is_file() else {}
        if not isinstance(plan, dict):
            plan = {}
        # A plan is written by whoever built the lesson: its minutes are a whole number or they are not used, and a
        # list that is not a list is an empty one.
        plan['minutes'] = plan['minutes'] if type(plan.get('minutes')) is int and 0 < plan['minutes'] < 600 else 0
        for key, kind in (('quiz', list), ('checks', dict), ('objectives', list), ('prerequisites', list)):
            plan[key] = plan[key] if isinstance(plan.get(key), kind) else kind()
        plan['objectives'] = [o for o in plan['objectives'] if isinstance(o, str)]
        plan['prerequisites'] = [p for p in plan['prerequisites'] if isinstance(p, str)]
        facts[a['slug']] = {'plan': plan, 'steps': len(kinds), 'step_of': dict(kinds)}
    groups = [{'unit': u, 'mods': [m for m in mods if m.get('unit') == u['id']]} for u in units]
    groups = [g for g in groups if g['mods']] or [{'unit': {'id': 'course', 'title': 'Core medicine', 'summary': ''}, 'mods': mods}]
    minutes = sum(f['plan']['minutes'] for f in facts.values())
    n_quiz = sum(len(f['plan']['quiz']) for f in facts.values())
    n_checks = sum(len(f['plan']['checks']) for f in facts.values())
    dates = sorted(a['date'] for a in apps)
    out = {
        'apps': apps, 'mods': mods, 'units': [g['unit'] for g in groups], 'groups': groups, 'extra': extra, 'by': by,
        'number': number, 'facts': facts, 'n_lessons': len(apps), 'n_units': len(groups), 'minutes': minutes,
        'n_quiz': n_quiz, 'n_checks': n_checks, 'first': dates[0] if dates else None, 'latest': dates[-1] if dates else None,
    }
    # What the home page says of the course: only what stays true when a lesson is added. Units are the ones with a
    # lesson shipped; hours and question counts move with every lesson and every revision, so the course page has them.
    out['units_shown'] = sum(1 for g in groups if any(m['slug'] in by for m in g['mods']))
    since = [[f"{MONTHS[int(dates[0][5:7]) - 1][:3]} {dates[0][:4]}", 'first lesson']] if dates else []
    out['stats'] = [[str(len(apps)), 'lessons'], [str(out['units_shown']), 'units']] + since
    return out


def load(root=ROOT, only=None):
    record = json.loads((root / 'content' / 'record.json').read_text(encoding='utf-8'))
    essay = json.loads((root / 'content' / 'two-stories.json').read_text(encoding='utf-8'))
    manifest = root / 'plates' / 'manifest.json'
    plates = json.loads(manifest.read_text(encoding='utf-8')) if manifest.is_file() else {}
    validate(record, essay, plates)
    lab = read_lab(root, only)
    c = record['counts']
    first = record['site']['first_deploy'].split('-')
    counted = record['edition']['counted'].split('-')
    months = (int(counted[0]) - int(first[0])) * 12 + int(counted[1]) - int(first[1])
    systems = sum(1 for w in record['works'] if w['counted'])
    kept = sum(1 for w in record['works'] if has_kept(w))
    views = next((len(v['views']) for v in record['volumes'] if v.get('views')), 0)
    n = {
        'systems': word(systems), 'Systems': word(systems).capitalize(), 'works': word(len(record['works'])),
        'addresses': len(record['works']), 'lines': f"{c['lines']:,}", 'files': f"{c['files']:,}", 'test_lines': f"{c['test_lines']:,}",
        'previous_lines': f"{c['previous']['lines']:,}", 'previous_files': f"{c['previous']['files']:,}",
        'months': word(months), 'Months': word(months).capitalize(),
        'units': word(lab['units_shown']),      # no brace for lessons, hours or questions: see read_lab
        'questions': f"{c['questions']:,}", 'banks': word(c['banks']), 'subjects': word(c['subjects']),
        'kept': word(kept), 'Kept': word(kept).capitalize(),
        'first': month(record['site']['first_deploy']), 'now': month(record['edition']['counted']),
        'designer': record['edition']['by'], 'issued': month(record['edition']['issued']), 'name': record['site']['name'],
        'views': word(views), 'views_more': word(max(views - 1, 0)),
    }
    return {'root': root, 'record': record, 'essay': essay, 'lab': lab, 'plates': plates, 'n': n, 'months': months}


# ---------------------------------------------------------------- shared parts

def head(site, title, description, path, kind='website', more=''):
    """The head every edition page shares. A page with no address of its own (the not-found page) passes path=None;
    a page with a sheet or script of its own passes them as `more`."""
    root = site['root']
    where = (f'\n<link rel="canonical" href="{ORIGIN}{path}">', f'\n<meta property="og:url" content="{ORIGIN}{path}">') if path else ('', '')
    card = site['plates'].get('card')
    share = (f'\n<meta property="og:image" content="{ORIGIN}/plates/card.jpg">\n<meta property="og:image:width" content="{card["w"]}">\n'
             f'<meta property="og:image:height" content="{card["h"]}">\n<meta name="twitter:card" content="summary_large_image">') if card else ''
    return f'''<!doctype html>
<html lang="en" data-voice="tech">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">{where[0]}
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:type" content="{kind}">{where[1]}{share}
<meta name="theme-color" content="#d1d1ce" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1b1a" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS.replace('&', '&amp;')}">
<link rel="stylesheet" href="/v4/site.css?v={stamp(root, '/v4/site.css')}">
<script src="/v4/boot.js?v={stamp(root, '/v4/boot.js')}"></script>
<script src="/v4/site.js?v={stamp(root, '/v4/site.js')}" defer></script>{more}'''


def bar(site, here=None, voices=False):
    ed, theme = site['record']['edition'], site['record']['theme']
    links = [('work', '/#work', 'Work'), ('lab', '/lab/', 'The Lab'), ('writing', '/#writing', 'Writing'),
             ('films', '/#films', 'Films'), ('editions', '/#editions', 'Editions'), ('record', '/#record', 'Record')]
    nav = ''.join(f'<a href="{h}"{" aria-current=" + chr(34) + "page" + chr(34) if key == here else ""}>{label}</a>' for key, h, label in links)
    return f'''<header class="topbar">
  <div class="wrap topbar-in">
    <a class="mark" href="/" aria-label="{esc(site['record']['site']['name'])}, home">{esc(site['record']['site']['name'])}<span class="mark-vol">{esc(ed['vol'])}</span></a>
    <nav class="topbar-nav" aria-label="Sections">{nav}</nav>
    <div class="topbar-ctl js-only">
      {'<button class="btn" type="button" data-voice-toggle aria-pressed="false">Plain language</button>' if voices else ''}
      <button class="btn flip" type="button" data-theme-flip="{theme['id']}" aria-pressed="false" title="{esc(theme['hint'])}"><i class="star" aria-hidden="true"></i><span class="flip-w">{esc(theme['label'])}</span></button>
      <button class="btn" type="button" data-palette-open aria-haspopup="dialog">Index<kbd aria-hidden="true">/</kbd></button>
    </div>
  </div>
</header>
{posted(site)}'''


def posted(site):
    """What the theme adds under the bar: its photographs, side by side. /v4/site.css shows it only while the theme is
    posted, and the images are lazy, so a reader who never posts it downloads nothing."""
    root, figs = site['root'], []
    for p in site['record']['theme']['photos']:
        full, small = f"/v4/{site['record']['theme']['id']}/{p['id']}.webp", f"/v4/{site['record']['theme']['id']}/{p['id']}-800.webp"
        w, h = webp_size(root / full.lstrip('/'))
        figs.append(f'''<figure class="jet jet-{p['id']}">
    <img src="{small}?v={stamp(root, small)}" srcset="{small}?v={stamp(root, small)} 800w, {full}?v={stamp(root, full)} {w}w" sizes="(max-width: 860px) 100vw, 50vw" width="{w}" height="{h}" alt="{esc(p['alt'])}" loading="lazy" decoding="async">
    <figcaption><b class="craft">{esc(p['craft'])}</b><span class="lbl">{esc(p['name'])} · {esc(p['where'])}, {day(p['taken'])} · <a href="{esc(p['source'])}" target="_blank" rel="noopener">{esc(p['credit'])}</a></span></figcaption>
  </figure>''')
    return f'''<div class="posted" role="group" aria-label="{esc(site['record']['theme']['hint'])}">
  {''.join(figs)}
</div>'''


def colophon(site, home=False):
    r = site['record']
    ed = r['edition']
    taken = sorted(p['taken'] for p in site['plates'].values())
    plates = f' Plates captured {day(taken[0])}.' if taken and taken[0] == taken[-1] else f' Plates captured {day(taken[0])} to {day(taken[-1])}.' if taken else ''
    dated = (f'\n      <p class="lbl">Counts recounted {day(ed["counted"])}.{plates} Round trips measured in your browser, now.</p>'
             if home else '')
    return f'''<footer class="colophon">
  <div class="wrap pair">
    <div>
      <p class="colophon-name">{esc(ed['vol'])}, {esc(ed['name'])}</p>
      <p class="say-s">{told(site, 'colophon')}</p>
      <p class="say-s when-posted">{esc(r['theme']['note'])}</p>
      <p class="lbl when-posted">{esc(r['theme']['notice'])}</p>
    </div>
    <div class="colophon-facts">
      <p class="lbl">Set in {esc(ed['faces'])}.</p>{dated}
      <p class="lbl js-only" role="group" aria-label="Appearance">Appearance: <button class="link" type="button" data-theme-set="auto" aria-pressed="true">as your device</button> <button class="link" type="button" data-theme-set="light" aria-pressed="false">light</button> <button class="link" type="button" data-theme-set="dark" aria-pressed="false">dark</button> <button class="link" type="button" data-theme-set="{r['theme']['id']}" aria-pressed="false">{esc(r['theme']['label'])}</button></p>
      <p class="lbl">© 2026 {esc(r['site']['name'])} · <a href="/#editions">Earlier volumes are kept</a> · <a href="#top">Top</a></p>
    </div>
  </div>
</footer>'''


def palette(site, entries):
    """The index as a dialog, opened with "/". Its entries are data; /v4/site.js draws and filters them, and adds the
    lessons from the Lab's ledger when the index is first opened."""
    data = json.dumps(entries, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    return f'''<dialog class="palette" id="palette" aria-label="Index">
  <form method="dialog" class="palette-in">
    <label class="lbl" for="palette-q">Index: every work, lesson, paper, film and edition</label>
    <input id="palette-q" type="search" autocomplete="off" spellcheck="false" placeholder="Type to search">
    <ol class="palette-list" id="palette-list" role="listbox" aria-label="Matches"></ol>
    <p class="lbl palette-keys">↑ ↓ move · ↵ open · esc close</p>
  </form>
</dialog>
<script type="application/json" id="index-data">{data}</script>'''


def plate_img(site, name, alt, sizes, eager=False):
    """A capture as a matted plate, or None when it has not been taken."""
    p = site['plates'].get(name)
    if not p:
        return None
    small = f'/plates/{name}-720.webp'
    full = f'/plates/{name}.webp'
    return (f'<img src="{small}" srcset="{small} 720w, {full} {p["w"]}w" sizes="{sizes}" width="{p["w"]}" height="{p["h"]}" '
            f'alt="{esc(alt)}" decoding="async"{"" if eager else " loading=" + chr(34) + "lazy" + chr(34)}>')


HALF = '(max-width: 860px) 92vw, 46vw'
QUARTER = '(max-width: 860px) 92vw, 23vw'


# ---------------------------------------------------------------- the home page

def directory(site):
    r = site['record']
    groups = []
    for world in r['worlds']:
        works = [w for w in r['works'] if w['world'] == world['id']]
        rows = ''.join(
            f'<a class="dir-row" href="#{w["id"]}"><i class="dot" data-dot="{w["id"]}"></i><span>{breakable(w["name"])}</span>'
            f'<span class="ms" data-ms="{w["id"]}"></span></a>' for w in works)
        groups.append(f'<div class="dir-g"><h3><a href="#world-{world["slug"]}">{esc(world["name"])}</a><span>{len(works)}</span></h3>{rows}</div>')
    return f'''<aside class="dir sheet" aria-labelledby="dir-h">
      <div class="dir-h"><h2 id="dir-h">Every address on this page</h2><p class="lbl" data-tally aria-live="polite">{len(r['works'])} addresses, asked from your browser when the page loads</p></div>
      <div class="dir-cols">{''.join(groups)}</div>
      <p class="lbl dir-key"><span><i class="dot is-yes"></i>answered</span><span><i class="dot is-wake"></i>waking</span><span><i class="dot is-no"></i>no answer</span><span>of {len(r['works'])}, in milliseconds</span></p>
    </aside>'''


def mast(site):
    r = site['record']
    ed = r['edition']
    name = esc(r['site']['name']).replace(' ', '<br>')
    return f'''<section class="mast pair" aria-labelledby="name">
    <div>
      <p class="lbl">{esc(r['site']['worlds_line'])}</p>
      <h1 id="name">{name}</h1>
      <p class="roles">{esc(r['site']['roles'])}</p>
      {said(site, r['prose']['lede'], 'lede')}
      <nav class="lbl mast-nav" aria-label="Sections"><a href="#work">Work</a><a href="/lab/">The Lab</a><a href="#writing">Writing</a><a href="#films">Films</a><a href="#editions">Editions</a><a href="#record">Record</a><a href="#index">Index</a></nav>
      <p class="lbl mast-ed"><span>{esc(ed['vol'])}, {esc(ed['name'])} · {month(ed['issued'])}</span><span>Designed by {esc(ed['by'])}</span><a href="#editions">{word(len([v for v in r['volumes'] if v['status'] == 'retired'])).capitalize()} earlier volumes are kept</a></p>
    </div>
    {directory(site)}
  </section>'''


def lineage(site, w):
    """What edition a work is on, which earlier ones are kept, and a button that sets the last of them beside it."""
    eds = w['editions']
    if not eds:
        return ''
    cur = eds[-1]
    kept = [e for e in eds[:-1] if e.get('url')]
    bits = [esc(edition_label(cur))]
    if cur.get('by'):
        bits.append(esc(cur['by']))
    if cur.get('date'):
        bits.append(day(cur['date']))
    line = f'<span>{" · ".join(bits)}</span>'
    if kept:
        links = ', '.join(f'<a href="{esc(e["url"])}" target="_blank" rel="noopener">{esc(edition_label(e))}</a>' for e in reversed(kept))
        line += f'<span>Kept: {links}</span>'
    if w.get('editions_note'):
        line += f'<span>{esc(w["editions_note"])}</span>'
    if comparable(site, w):
        line += (f'<button class="link js-only" type="button" data-beside="{w["id"]}" aria-expanded="false" aria-controls="{w["id"]}-prior">'
                 f'Set beside {esc(edition_label(kept[-1]))}</button>')
    return f'<p class="lin lbl">{line}</p>'


def prior(site, w, sizes):
    """The earlier editions' plates. Hidden until a reader sets them beside the current one."""
    kept = [e for e in w['editions'][:-1] if e.get('url') and site['plates'].get(f'{w["id"]}-e{e["n"]}')]
    if not kept:
        return ''
    figs = []
    for i, e in enumerate(reversed(kept)):
        img = plate_img(site, f'{w["id"]}-e{e["n"]}', f'{w["name"]}, {edition_label(e)}, as it is kept{plate_note(w, ". ")}', sizes)
        by = f' · {esc(e["by"])}' if e.get('by') else ''
        when = f' · {day(e["date"])}' if e.get('date') else ''
        figs.append(f'<figure class="prior-ed" data-ed="{e["n"]}"{"" if i == 0 else " hidden"}><div class="plate">{img}</div>'
                    f'<figcaption class="lbl"><span><b>Before.</b> {esc(edition_label(e))}{by}{when}{esc(plate_note(w, " · "))}</span>'
                    f'<a href="{esc(e["url"])}" target="_blank" rel="noopener">Open it<span aria-hidden="true"> ↗</span></a></figcaption></figure>')
    pick = ''
    if len(kept) > 1:
        pick = '<p class="lbl prior-pick">' + ''.join(
            f'<button class="link" type="button" data-prior-ed="{e["n"]}" aria-pressed="{"true" if i == 0 else "false"}">{esc(edition_label(e))}</button>'
            for i, e in enumerate(reversed(kept))) + '</p>'
    return f'<div class="prior" id="{w["id"]}-prior" hidden>{pick}{"".join(figs)}</div>'


def back(site, w):
    """The way back from side by side: shown in the work's header only while its earlier edition is beside it."""
    if not prior(site, w, HALF):
        return ''
    return f'<button class="link beside-back lbl" type="button" data-beside-back="{w["id"]}" hidden>Back to the description</button>'


def stats(site, w):
    rows = site['lab']['stats'] if w['stats'] == 'ledger' else w['stats']
    if not rows:
        return ''
    live = ' data-lab-n' if w['stats'] == 'ledger' else ''      # the first figure of the Lab's row is its lesson count
    return '<dl class="stats">' + ''.join(f'<div><dt>{esc(label)}</dt><dd{live if i == 0 else ""}>{esc(figure)}</dd></div>' for i, (figure, label) in enumerate(rows)) + '</dl>'


def worlds_of(w):
    return ' '.join([w['world']] + w['also'])


def label_of(site, w):
    world = next(x['name'] for x in site['record']['worlds'] if x['id'] == w['world'])
    return esc(world) + (f' · {esc(w["sub"])}' if w.get('sub') else '')


def live(w):
    note = f'<span class="note">{esc(w["note"])}</span>' if w.get('note') else ''
    return f'<span class="live"><i class="dot" data-dot="{w["id"]}"></i><span data-ms="{w["id"]}">not asked yet</span>{note}</span>'


def the_plate(site, w, sizes):
    cur = w['editions'][-1] if w['editions'] else None
    taken = site['plates'].get(w['id'], {}).get('taken')
    img = plate_img(site, w['id'], (f'{w["name"]}, as it looked on {day(taken)}' if taken else w['name']) + plate_note(w, '. '), sizes)
    if img:
        tab = f'<figcaption class="lbl now"><b>Now.</b> {esc(edition_label(cur))}{esc(plate_note(w, " · "))}</figcaption>' if cur and comparable(site, w) else ''
        return (f'<figure class="plate-fig"><a class="plate" href="{esc(w["url"])}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">{img}</a>{tab}</figure>')
    return f'<figure class="plate-fig"><div class="plate plate-type" aria-hidden="true"><span>{breakable(w["name"])}</span></div></figure>'


def major(site, w):
    extra = lab_outline(site) if w['kind'] == 'course' else ''
    return f'''<article class="work pair" id="{w['id']}" data-worlds="{worlds_of(w)}">
      {the_plate(site, w, HALF)}
      <header class="work-h">
        <p class="cap-top lbl"><span>{label_of(site, w)}</span>{live(w)}</p>
        <h4>{breakable(w['name'])}</h4>
        {back(site, w)}
      </header>
      <div class="cap">
        {said(site, w)}
        {stats(site, w)}
        {lineage(site, w)}
        <p class="cap-foot"><a class="go" href="{esc(w['url'])}" target="_blank" rel="noopener">{esc(w['go'])}<span aria-hidden="true"> ↗</span></a><span class="lbl host">{esc(w['host'])}</span></p>
      </div>
      {prior(site, w, HALF)}
    </article>{extra}'''


def minor(site, w):
    return f'''<article class="work minor" id="{w['id']}" data-worlds="{worlds_of(w)}">
        {the_plate(site, w, QUARTER)}
        <header class="work-h">
          <p class="cap-top lbl"><span>{label_of(site, w)}</span>{live(w)}</p>
          <h4>{breakable(w['name'])}</h4>
          {back(site, w)}
        </header>
        <div class="cap">
          {said(site, w)}
          {stats(site, w)}
          {lineage(site, w)}
          <p class="cap-foot"><a class="go" href="{esc(w['url'])}" target="_blank" rel="noopener">{esc(w['go'])}<span aria-hidden="true"> ↗</span></a><span class="lbl host">{esc(w['host'])}</span></p>
        </div>
        {prior(site, w, QUARTER)}
      </article>'''


def lab_outline(site):
    """The course in outline under the Lab's row: every unit that has a lesson, and every lesson, each a link. It
    lists what has shipped and counts it, and nothing else: no lesson numbers (a module added to the syllabus moves
    them), no lessons to come, no hours. A lesson shipped after this was built is added by /v4/site.js from the ledger."""
    lab = site['lab']
    cols = []
    for i, g in enumerate(lab['groups']):
        items = ''.join(f'<li><a href="/lab/{m["slug"]}/" data-lesson="{m["slug"]}">{esc(lab["by"][m["slug"]]["title"])}</a></li>'
                        for m in g['mods'] if m['slug'] in lab['by'])
        if items:
            cols.append(f'<div class="unit-col"><h5><span class="lbl">Unit {i + 1}</span>{esc(g["unit"]["title"])}</h5><ul>{items}</ul></div>')
    more = ''.join(f'<li><a href="/lab/{a["slug"]}/" data-lesson="{a["slug"]}">{esc(a["title"])}</a></li>' for a in lab['extra'])
    cols.append(f'<div class="unit-col" data-lab-more{"" if more else " hidden"}><h5><span class="lbl">Added since</span>Newest lessons</h5><ul data-lab-new>{more}</ul></div>')
    return f'''
    <div class="outline" data-worlds="med" aria-label="The course in outline">
      <p class="lbl outline-h"><span><span data-lab-n>{lab['n_lessons']}</span> lessons in {word(lab['units_shown'])} units. Educational only, not for clinical use.</span><a href="/lab/">The course page keeps your place<span aria-hidden="true"> →</span></a></p>
      <div class="outline-cols">{''.join(cols)}</div>
    </div>'''


def work(site):
    r = site['record']
    chips = [f'<button class="btn" type="button" data-filter="all" aria-pressed="true">All <span class="n">{len(r["works"])}</span></button>']
    sections = []
    for world in r['worlds']:
        mine = [w for w in r['works'] if w['world'] == world['id']]
        shown = [w for w in r['works'] if world['id'] == w['world'] or world['id'] in w['also']]
        chips.append(f'<button class="btn" type="button" data-filter="{world["id"]}" aria-pressed="false">{esc(world["name"])} <span class="n">{len(shown)}</span></button>')
        if not mine:
            continue
        majors = ''.join(major(site, w) for w in mine if w['tier'] == 'major')
        minors = ''.join(minor(site, w) for w in mine if w['tier'] == 'minor')
        has = sorted({x for w in mine for x in [w['world']] + w['also']})
        kept = sum(1 for w in mine if has_kept(w))
        note = f"{word(len(mine)).capitalize()} {'work' if len(mine) == 1 else 'works'}" + (f", {word(kept)} with an earlier edition kept" if kept else '')
        sections.append(f'''<section class="world" id="world-{world['slug']}" data-has="{' '.join(has)}" aria-labelledby="world-{world['id']}">
      <header class="world-h"><h3 id="world-{world['id']}">{esc(world['name'])}</h3><p class="lbl">{note}</p></header>
      {majors}
      {f'<div class="minors">{minors}</div>' if minors else ''}
    </section>''')
    n_kept = sum(1 for w in r['works'] if comparable(site, w))
    # The switch is offered only when there is an earlier edition's plate to set beside something.
    switch = f'''<div class="switch js-only" role="group" aria-label="How each work is shown">
          <button class="btn" type="button" data-view="described" aria-pressed="true">Described</button><button class="btn" type="button" data-view="beside" aria-pressed="false">Side by side <span class="n">{n_kept}</span></button>
        </div>''' if n_kept else ''
    return f'''<section class="sec" id="work" data-filter="all" aria-labelledby="work-h">
    <span class="alias" id="ch3"></span><span class="alias" id="ch5"></span>
    <header class="sec-h">
      <h2 id="work-h">Work</h2>
      <div class="sec-ctl">
        <div class="chips js-only" role="group" aria-label="Show one world">{''.join(chips)}</div>
        {switch}
      </div>
    </header>
    {''.join(sections)}
  </section>'''


def writing(site):
    r = site['record']
    papers = []
    for i, p in enumerate(r['papers']):
        points = ''.join(f'<li><b>{esc(a)}</b><span>{esc(b)}</span></li>' for a, b in p['points'])
        links = ''.join(
            f'<a class="go" href="{esc(l["href"])}"{"" if l["href"].startswith("/") else " target=" + chr(34) + "_blank" + chr(34) + " rel=" + chr(34) + "noopener" + chr(34)}>{esc(l["label"])}'
            f'<span aria-hidden="true">{" →" if l["href"].startswith("/") else " ↗"}</span></a>' for l in p['links'])
        papers.append(f'''<article class="paper pair" id="{p['id']}">
      <div>
        <p class="cap-top lbl"><span>{esc(p['tag'])}</span><span>{esc(p['when'])}</span></p>
        <h3>{esc(p['name'])}</h3>
        {said(site, p)}
        <p class="paper-links">{links}</p>
      </div>
      <div class="paper-parts sheet">
        <p class="lbl">The argument, in six parts</p>
        <ol>{points}</ol>
      </div>
    </article>''')
    rooms = [w for w in r['works'] if w.get('room')]
    world = next((x['name'] for x in r['worlds'] if rooms and x['id'] == rooms[0]['world']), '')
    also = ' and '.join(f'<a href="#{w["id"]}">{esc(w["name"])}</a>' for w in rooms)
    more = f" {word(len(rooms)).capitalize()} reading room{'' if len(rooms) == 1 else 's'} {'is' if len(rooms) == 1 else 'are'} under {esc(world)}: {also}." if rooms else ''
    return f'''<section class="sec" id="writing" aria-labelledby="writing-h">
    <span class="alias" id="ch4"></span>
    <header class="sec-h"><h2 id="writing-h">Writing</h2><p class="lbl">{word(len(r['papers'])).capitalize()} papers.{more}</p></header>
    {''.join(papers)}
  </section>'''


def guidance(site):
    """An outside standard, set beside this site's answer to each of its questions. The issuer's figure is held here,
    credited, and linked to the source; the section says the issuer has not reviewed the site."""
    g, root = site['record']['guidance'], site['root']
    fig = g['figure']
    points = ''.join(f'<li><b>{esc(h)}</b><span class="g-q">{esc(q)}</span><span class="g-a">{esc(a)}</span></li>' for h, q, a in g['points'])
    return f'''<section class="sec" id="guidance" aria-labelledby="guidance-h">
    <header class="sec-h"><h2 id="guidance-h">{esc(g['title'])}</h2><p class="lbl">{esc(g['label'])}</p></header>
    <article class="guide pair">
      <figure class="guide-fig sheet">
        <a href="{esc(g['href'])}" target="_blank" rel="noopener"><img src="{esc(fig['src'])}?v={stamp(root, fig['src'])}" width="{fig['w']}" height="{fig['h']}" alt="{esc(fig['alt'])}" loading="lazy" decoding="async"></a>
        <figcaption class="lbl">{esc(g['rights'])}</figcaption>
      </figure>
      <div>
        <p class="cap-top lbl"><span>{esc(g['issuer'])}</span><span>{esc(g['when'])}</span></p>
        <h3>{esc(g['name'])}</h3>
        {said(site, g)}
        <p class="guide-note">{esc(g['reviewed'])}</p>
        <div class="paper-parts sheet">
          <p class="lbl">Its questions, and this site's answers</p>
          <ol class="guide-qs">{points}</ol>
        </div>
        <p class="paper-links"><a class="go" href="{esc(g['href'])}" target="_blank" rel="noopener">{esc(g['link'])}<span aria-hidden="true"> ↗</span></a></p>
      </div>
    </article>
  </section>'''


def films(site):
    r = site['record']
    items = []
    for f in r['films']:
        poster = f['poster']
        img = (f'<img src="{esc(poster)}" width="1280" height="720" alt="" loading="lazy" decoding="async">' if poster
               else f'<span class="plate-type"><span>{esc(f["name"])}</span></span>')
        items.append(f'''<article class="film" id="{f['id']}">
        <button class="plate film-plate" type="button" data-film="{esc(f['src'])}" data-title="{esc(f['title'])}"{' data-poster="' + esc(poster) + '"' if poster else ''} aria-label="Play {esc(f['name'])}, {esc(f['length'])}">{img}<span class="play" aria-hidden="true"></span></button>
        <p class="cap-top lbl"><span>{esc(f['made_with'])}</span><span>{esc(f['length'])}</span></p>
        <h3>{esc(f['name'])}</h3>
        {said(site, f, 'say-s')}
      </article>''')
    return f'''<section class="sec" id="films" aria-labelledby="films-h">
    <span class="alias" id="appb"></span>
    <header class="sec-h"><h2 id="films-h">Films</h2><p class="lbl">{told(site, 'films')}</p></header>
    <div class="strip films">{''.join(items)}</div>
    <noscript><p class="lbl">Without scripts the films open as files: {', '.join(f'<a href="{esc(f["src"])}">{esc(f["name"])}</a>' for f in r['films'])}.</p></noscript>
  </section>'''


def editions(site):
    r = site['record']
    ed = r['edition']
    vols = []
    for v in r['volumes']:
        if v['status'] == 'awaiting':
            continue
        key = vol_key(v)
        by = ', '.join(v['by']) if v.get('by') else ', '.join(x['by'] for x in v['views'])
        here = v['status'] == 'current'
        img = plate_img(site, v.get('plate', key), f'{v["vol"]}, {v["name"]}', QUARTER)
        inner = img or f'<span class="plate-type"><span>{esc(v["vol"])}</span></span>'
        frame = (f'<div class="plate">{inner}</div>' if here else
                 f'<a class="plate" href="{esc(v["href"])}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">{inner}</a>')
        status = 'Current. You are here.' if here else f'Retired with honors{", " + esc(v["retired"]) if v.get("retired") else ""}.'
        link = '' if here else f'<a class="go" href="{esc(v["href"])}" target="_blank" rel="noopener">Open the archive<span aria-hidden="true"> ↗</span></a>'
        vols.append(f'''<article class="vol" id="{key}">
        {frame}
        <p class="cap-top lbl"><span>{esc(v['vol'])}</span><span>{esc(v['issued'])}</span></p>
        <h3>{esc(v['name'])}</h3>
        <p class="say-s">{esc(v['design'][0].upper() + v['design'][1:])}. Designed by {esc(by)}.</p>
        <p class="lbl">{status}</p>
        {link}
      </article>''')
    v3 = next(v for v in r['volumes'] if v.get('views'))
    views = []
    order = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
    for i, view in enumerate(v3['views']):
        href = v3['href'] + view['path']
        anchor = f'{vol_key(v3)}-{view["siglum"].lower()}'
        img = plate_img(site, anchor, f'{view["name"]}, the {v3["vol"]} view by {view["by"]}', '(max-width: 860px) 92vw, 18vw')
        inner = img or f'<span class="plate-type"><span>{esc(view["siglum"])}</span></span>'
        views.append(f'''<article class="vol" id="{anchor}">
        <a class="plate" href="{esc(href)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">{inner}</a>
        <p class="cap-top lbl"><span>View {esc(view['siglum'])} · {order[i]} in line</span></p>
        <h4>{esc(view['name'])}</h4>
        <p class="say-s">{esc(view['blurb'])} Designed by {esc(view['by'])}.</p>
        <a class="go" href="{esc(href)}" target="_blank" rel="noopener">Open this view<span aria-hidden="true"> ↗</span></a>
      </article>''')
    rows = []
    for w in r['works']:
        if not w['editions']:
            continue
        cur = w['editions'][-1]
        kept = ', '.join(f'<a href="{esc(e["url"])}" target="_blank" rel="noopener">{esc(edition_label(e))}</a>' for e in reversed(w['editions'][:-1]) if e.get('url')) or '<span class="quiet">none yet</span>'
        rows.append(f'<tr><th scope="row"><a href="#{w["id"]}">{breakable(w["name"])}</a></th><td>{esc(edition_label(cur))}</td>'
                    f'<td>{esc(cur.get("by") or "")}</td><td>{day(cur["date"]) if cur.get("date") else ""}</td><td>{kept}</td></tr>')
    nxt = next(v for v in r['volumes'] if v['status'] == 'awaiting')
    n_models = len({b for v in r['volumes'] if v['status'] != 'awaiting' for b in (v.get('by') or [x['by'] for x in v['views']])})
    return f'''<section class="sec" id="editions" aria-labelledby="editions-h">
    <span class="alias" id="appa"></span>
    <header class="sec-h"><h2 id="editions-h">Editions</h2><p class="lbl">{told(site, 'editions')}</p></header>
    <div class="pair">
      <div>{said(site, r['prose']['practice'], 'say lead')}</div>
      <dl class="facts sheet">
        <div><dt>This volume</dt><dd>{esc(ed['vol'])}, {esc(ed['name'])}</dd></div>
        <div><dt>Designed by</dt><dd>{esc(ed['by'])}</dd></div>
        <div><dt>Issued</dt><dd>{month(ed['issued'])}</dd></div>
        <div><dt>Designers so far</dt><dd>{word(n_models).capitalize()} models, {word(len([v for v in r['volumes'] if v['status'] != 'awaiting']))} volumes</dd></div>
        <div><dt>{esc(nxt['vol'])}</dt><dd>{esc(nxt['design'])} · {esc(nxt['by'][0])}</dd></div>
      </dl>
    </div>
    <h3 class="sub-h">The volumes, side by side</h3>
    <div class="strip vols">{''.join(vols)}</div>
    <h3 class="sub-h">{esc(v3['vol'])} was {word(len(v3['views']))} views of one text</h3>
    <p class="say-s wide">{told(site, 'vol3_story')}</p>
    <div class="strip views">{''.join(views)}</div>
    <h3 class="sub-h">The apps keep editions too</h3>
    <div class="table-wrap sheet"><table class="eds">
      <thead><tr><th scope="col">App</th><th scope="col">Current edition</th><th scope="col">Designed by</th><th scope="col">Issued</th><th scope="col">Kept</th></tr></thead>
      <tbody>{''.join(rows)}</tbody>
    </table></div>
    {said(site, r['prose']['since'], 'say-s wide') if 'since' in r['prose'] else ''}
  </section>'''


def record_section(site):
    r = site['record']
    c = r['counts']
    lab = site['lab']
    ed = r['edition']
    note = {k: fill(site, v) for k, v in c['notes'].items()}
    counted = [
        ('Lines of source', f"{c['lines']:,}", note['lines'], ''),
        ('Source files', f"{c['files']:,}", note['files'], ''),
        ('Board-style questions', f"{c['questions']:,}", note['questions'], ''),
        ('Lessons in the Lab', str(lab['n_lessons']), note['lessons'], ' data-lab-n'),
        ('Months since first deploy', str(site['months']), note['months'], ''),
    ]
    left = ''.join(f'<div><dt>{esc(k)}</dt><dd{live}>{esc(v)}</dd><dd class="std lbl">{esc(s)}</dd></div>' for k, v, s, live in counted)
    world = {w['id']: w['name'] for w in r['worlds']}
    rows = ''.join(
        f'<tr><th scope="row"><a href="#{w["id"]}">{breakable(w["name"])}</a></th><td><a href="{esc(w["url"])}" target="_blank" rel="noopener">{esc(w["host"])}</a></td>'
        f'<td>{esc(world[w["world"]])}</td><td><i class="dot" data-dot="{w["id"]}"></i><span data-state="{w["id"]}">not asked yet</span></td><td class="num" data-ms="{w["id"]}" data-bare></td></tr>'
        for w in r['works'])
    probes = json.dumps([{'id': w['id'], 'url': w['url'], 'wake': bool(w['wake'])} for w in r['works']], separators=(',', ':')).replace('<', '\\u003c')
    return f'''<section class="sec" id="record" aria-labelledby="record-h">
    <span class="alias" id="ch1"></span><span class="alias" id="ch2"></span>
    <header class="sec-h"><h2 id="record-h">Record</h2><p class="lbl">{told(site, 'record')}</p></header>
    <div class="pair">
      <div>
        <h3 class="sub-h first">Counted <span class="lbl">from source, {day(ed['counted'])}</span></h3>
        <dl class="ledger">{left}</dl>
      </div>
      <div>
        <h3 class="sub-h first">Measured <span class="lbl" data-asked>in your browser, when this page loaded</span></h3>
        <dl class="ledger" data-measured>
          <div><dt>Addresses answering</dt><dd><span data-answered>…</span> <span class="of">of {len(r['works'])}</span></dd><dd class="std lbl">each asked once, from this tab</dd></div>
          <div><dt>Median round trip</dt><dd><span data-median>…</span></dd><dd class="std lbl">milliseconds, the server that has to wake left out</dd></div>
          <div><dt>Slowest answer</dt><dd><span data-slowest>…</span></dd><dd class="std lbl" data-slowest-name>of the addresses that answered</dd></div>
        </dl>
        <p class="js-only"><button class="btn" type="button" data-ask>Ask them all again</button></p>
        <noscript><p class="lbl">The measurement needs scripts. Without them every dot stays open: nothing was asked.</p></noscript>
      </div>
    </div>
    <div class="table-wrap sheet"><table class="eds status">
      <thead><tr><th scope="col">Work</th><th scope="col">Address</th><th scope="col">World</th><th scope="col">Answer</th><th scope="col" class="num">Round trip</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
    {said(site, r['prose']['caution'], 'say-s wide')}
    <h3 class="sub-h">How it was made, and how it is checked</h3>
    <div class="pair about" id="about">
      <div>{said(site, r['prose']['purpose'])}{said(site, r['prose']['scope'])}</div>
      <div>{said(site, r['prose']['method'])}{said(site, r['prose']['note'], 'say note')}</div>
    </div>
    <script type="application/json" id="probes">{probes}</script>
  </section>'''


def index_entries(site, lessons=True):
    """Everything a reader can look up: its title, where it is, and the words it answers to. The printed index on the
    home page lists the lessons; the index a reader searches (on every page) leaves them out and reads them from the
    ledger in the browser, so a lesson shipped tomorrow is found there with no rebuild of any page but the Lab's."""
    r = site['record']
    lab = site['lab']
    out = []
    for w in r['works']:
        out.append({'t': w['index'], 'h': f'#{w["id"]}', 'k': w['kw'], 's': 'Work'})
    for a in lab['apps'] if lessons else []:
        out.append({'t': f'{a["title"]} (lesson)', 'h': f'/lab/{a["slug"]}/', 'k': 'lab lesson medicine ' + str(a.get('description', '')), 's': 'The Lab'})
    for p in r['papers']:
        out.append({'t': p['index'], 'h': f'#{p["id"]}', 'k': p['kw'], 's': 'Writing'})
    out.append({'t': 'The two stories, side by side (table)', 'h': '/two-stories/#table43', 'k': 'paper cosmology comparison big bang', 's': 'Writing'})
    out.append({'t': r['guidance']['index'], 'h': '#guidance', 'k': r['guidance']['kw'], 's': 'Writing'})
    for f in r['films']:
        out.append({'t': f['index'], 'h': f'#{f["id"]}', 'k': f['kw'], 's': 'Films'})
    for v in r['volumes']:
        if v['status'] == 'awaiting':
            continue
        key = vol_key(v)
        out.append({'t': f'{v["vol"]}, {v["name"]}' + (' (archive)' if v['status'] == 'retired' else ''), 'h': f'#{key}', 'k': v.get('kw', 'editions'), 's': 'Editions'})
        for view in v.get('views', []):
            out.append({'t': f'{view["name"]} ({v["vol"]}, view {view["siglum"]})', 'h': f'#{key}-{view["siglum"].lower()}', 'k': f'editions archive view {view["by"]}', 's': 'Editions'})
    for t, h, k in [('Work', '#work', 'section apps systems'), ('Writing', '#writing', 'section papers'), ('Films', '#films', 'section video'),
                    ('Editions', '#editions', 'section volumes archive'), ('Record', '#record', 'section counts status'),
                    ('Every address on this page (directory)', '#dir-h', 'status reachability live hosts'),
                    ('Counted and measured (record)', '#record', 'lines files questions round trip readiness'),
                    ('How it was made, and how it is checked', '#about', 'purpose scope method verification'),
                    ('App editions (table)', '#editions', 'retired editions redesign'),
                    ('The Lab, the course page', '/lab/', 'course lessons units progress')]:
        out.append({'t': t, 'h': h, 'k': k, 's': 'This page'})
    return sorted(out, key=lambda e: re.sub(r'^(the|a) ', '', e['t'].lower()))


def index_section(site, entries):
    letters = {}
    for e in entries:
        key = re.sub(r'^(the|a) ', '', e['t'].lower())[0].upper()
        letters.setdefault(key if key.isalpha() else '#', []).append(e)
    cols = ''.join(
        f'<div class="ix-g"><h3>{esc(letter)}</h3>' + ''.join(
            f'<a class="ix" href="{esc(e["h"])}">{esc(e["t"])}</a>' for e in items) + '</div>'
        for letter, items in sorted(letters.items()))
    return f'''<section class="sec" id="index" aria-labelledby="index-h">
    <span class="alias" id="indexsec"></span>
    <header class="sec-h"><h2 id="index-h">Index</h2><p class="lbl"><span data-ix-n>{len(entries)}</span> entries, alphabetically. Press <kbd>/</kbd> to search them.</p></header>
    <div class="ix-cols">{cols}</div>
  </section>'''


def film_dialog():
    return '''<dialog class="film-dialog" id="film-dialog" aria-labelledby="film-title">
  <div class="film-in">
    <p class="film-bar lbl"><span id="film-title"></span><button class="link" type="button" data-film-close>Close</button></p>
    <video controls playsinline preload="none"></video>
  </div>
</dialog>'''


def render_home(site):
    r = site['record']
    entries = index_entries(site)
    description = re.sub(r'\*\*', '', fill(site, r['prose']['lede']['tech']))
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'Person', 'name': r['site']['name'], 'url': ORIGIN + '/',
                     'description': r['site']['roles']}, ensure_ascii=False).replace('<', '\\u003c')
    return f'''{head(site, r['site']['title'], description, '/')}
<script type="application/ld+json" id="ld">{ld}</script>
</head>
<body>
<a class="skip" href="#work">Skip to the work</a>
{bar(site, voices=True)}
<main class="wrap" id="top">
  {mast(site)}
  {work(site)}
  {writing(site)}
  {guidance(site)}
  {films(site)}
  {editions(site)}
  {record_section(site)}
  {index_section(site, entries)}
</main>
{colophon(site, home=True)}
{film_dialog()}
{palette(site, index_entries(site, lessons=False))}
</body>
</html>
'''


# ---------------------------------------------------------------- the paper

def essay_inline(s):
    """A paragraph of the paper. It may carry <b> and <a href>, and nothing else gets through."""
    out, pos = [], 0
    for m in re.finditer(r'<(/?)(b|a)(?:\s+href="([^"]*)")?>', s):
        out.append(esc(html.unescape(s[pos:m.start()])))
        close, tag, href = m.groups()
        if close:
            out.append(f'</{tag}>')
        elif tag == 'b':
            out.append('<b>')
        elif href and (HTTPS.match(href) or PATH.match(href) or re.match(r'^#[A-Za-z0-9_-]+\Z', href)):
            outside = href.startswith('https://')
            out.append(f'<a href="{esc(href)}"' + (' target="_blank" rel="noopener"' if outside else '') + '>')
        else:
            out.append('<a>')
        pos = m.end()
    out.append(esc(html.unescape(s[pos:])))
    return ''.join(out)


def render_essay(site):
    e = site['essay']
    parts = []
    toc = []
    for part in e['parts']:
        toc.append(f'<a href="#{part["id"]}">{esc(part["label"])}: {esc(part["title"])}</a>')
        if 'rows' in part:
            body = ''.join(
                f'<tr{" class=" + chr(34) + "same" + chr(34) if row["same"] else ""}><th scope="row">{essay_inline(row["row"])}</th><td>{essay_inline(row["first"])}</td><td>{essay_inline(row["second"])}</td></tr>'
                for row in part['rows'])
            headcells = ''.join(f'<th scope="col">{esc(h)}</th>' if h else '<td></td>' for h in part['head'])
            parts.append(f'''<section class="part" id="{part['id']}" aria-labelledby="{part['id']}-h">
    <header class="sec-h"><h2 id="{part['id']}-h">{esc(part['title'])}</h2><p class="lbl">{esc(part['label'])} · {esc(part['meta'])}</p></header>
    <div class="table-wrap sheet"><table class="two">
      <thead><tr>{headcells}</tr></thead>
      <tbody>{body}</tbody>
    </table></div>
    <p class="lbl cap-note">{essay_inline(part['caption'])}</p>
  </section>''')
            continue
        paras = ''.join(
            f'<div class="para{" key" if p["key"] else ""}" id="{part["mark"].lower()}-{i + 1}"><span class="no lbl">{esc(part["mark"])}.{i + 1}</span><p>{essay_inline(p["html"])}</p></div>'
            for i, p in enumerate(part['paras']))
        parts.append(f'''<section class="part" id="{part['id']}" aria-labelledby="{part['id']}-h">
    <header class="sec-h"><h2 id="{part['id']}-h">{esc(part['title'])}</h2><p class="lbl">{esc(part['label'])} · {esc(part['meta'])}</p></header>
    <div>{paras}</div>
  </section>''')
    facts = ''.join(f'<div><dt>{esc(k)}</dt><dd>{essay_inline(v)}</dd></div>' for k, v in e['facts'])
    abstract = ''.join(f'<p>{essay_inline(p)}</p>' for p in e['abstract'])
    description = re.sub(r'<[^>]+>', '', e['abstract'][0])
    return f'''{head(site, e['title'] + ' · ' + site['record']['site']['name'], description, '/two-stories/', 'article')}
</head>
<body>
<a class="skip" href="#part1">Skip to the argument</a>
{bar(site, 'writing')}
<main class="wrap" id="top">
  <header class="mast pair essay-mast">
    <div>
      <p class="lbl"><a href="/#writing">Writing</a> · {esc(e['tag'])} · {esc(e['when'])}</p>
      <h1>{esc(e['title'])}</h1>
      <p class="lede">{essay_inline(e['standfirst'])}</p>
    </div>
    <aside class="sheet abstract" aria-labelledby="abstract-h">
      <h2 class="lbl" id="abstract-h">Abstract</h2>
      {abstract}
      <dl class="facts">{facts}</dl>
      <nav class="lbl essay-toc" aria-label="Parts of the paper">{''.join(toc)}</nav>
    </aside>
  </header>
  {''.join(parts)}
  <section class="part">
    <p class="say note wide">{essay_inline(e['note'])}</p>
  </section>
</main>
{colophon(site)}
{palette(site, index_entries_for_other_pages(site))}
</body>
</html>
'''


def index_entries_for_other_pages(site):
    """The same index from another page: an entry on the home page is addressed there."""
    return [dict(e, h=('/' + e['h']) if e['h'].startswith('#') else e['h']) for e in index_entries(site, lessons=False)]


# ---------------------------------------------------------------- the Lab's course page

def lesson_row(site, m, n):
    lab = site['lab']
    app = lab['by'].get(m['slug'])
    if not app:
        return f'''<li class="lesson soon">
        <span class="no" aria-hidden="true">{n:02d}</span>
        <div><h3>{esc(m['title'])}</h3><p class="desc">{esc(m['description'])}</p><p class="meta lbl">Lesson {n} · Coming soon</p></div>
      </li>'''
    f = lab['facts'][m['slug']]
    plan = f['plan']
    quiz = len(plan['quiz'])
    builds = sorted(lab['number'][s] for s in plan['prerequisites'] if s in lab['number'])
    if len(builds) == 1:
        on = f'Builds on Lesson {builds[0]}'
    elif builds:
        on = 'Builds on Lessons ' + ', '.join(str(b) for b in builds[:-1]) + f' and {builds[-1]}'
    else:
        on = 'A good place to start'
    meta = ' · '.join(x for x in [f"{plan['minutes']} min" if plan['minutes'] else '', f"{f['steps']} steps", f'{quiz} questions' if quiz else '', on] if x)
    goals = ''
    if plan['objectives']:
        goals = '<details class="goals"><summary>What you will be able to do</summary><ol>' + ''.join(f'<li>{esc(o)}</li>' for o in plan['objectives']) + '</ol></details>'
    return f'''<li class="lesson" data-slug="{m['slug']}" data-steps="{f['steps']}" data-quiz="{quiz}">
        <span class="no" aria-hidden="true">{n:02d}</span>
        <div>
          <h3><a href="/lab/{m['slug']}/">{esc(m['title'])}</a></h3>
          <p class="desc">{esc(m['description'])}</p>
          <p class="meta lbl">{esc(meta)}</p>{goals}
          <p class="progress lbl" data-lab-progress><span class="track" aria-hidden="true"><span class="bar"><i></i></span></span><span class="state">Not started</span></p>
        </div>
      </li>'''


def render_lab(site):
    lab = site['lab']
    r = site['record']
    shipped = [m for m in lab['mods'] if m['slug'] in lab['by']]
    total = len(shipped) + len(lab['extra'])
    planned = len(lab['mods']) + len(lab['extra'])
    # The units, then whatever shipped since the units were set: one shape for both, on the map and in the list.
    sections = [(f'Unit {i + 1}', g['unit']['id'], g['unit']['title'], esc(g['unit'].get('summary') or ''), g['mods']) for i, g in enumerate(lab['groups'])]
    if lab['extra']:
        sections.append(('Newest', 'more', 'Added since the units were set', told(site, 'lab_newest'), lab['extra']))

    def dot(m):
        name = f'Lesson {lab["number"][m["slug"]]}: {esc(m["title"])}'
        if m['slug'] not in lab['by']:
            return f'<li><span class="soon" title="{name}, coming soon"></span></li>'
        return f'<li><a href="/lab/{m["slug"]}/" data-lab-dot="{m["slug"]}" title="{name}"><span class="visually-hidden">{name}</span></a></li>'

    course_map = ''.join(
        f'''<li><a class="map-unit" href="#{uid}"><span class="map-no lbl">{label}</span><span class="map-title">{esc(title)}</span></a>
          <ol class="map-lessons">{''.join(dot(m) for m in mods)}</ol></li>''' for label, uid, title, _summary, mods in sections)
    units = []
    for label, uid, title, summary, mods in sections:
        mins = sum(lab['facts'][m['slug']]['plan']['minutes'] for m in mods if m['slug'] in lab['facts'])
        units.append(f'''<section class="unit pair" id="{uid}" aria-labelledby="unit-{uid}">
    <header class="unit-head">
      <p class="lbl">{label} · {len(mods)} lesson{'' if len(mods) == 1 else 's'}{' · ' + duration(mins) if mins else ''}</p>
      <h2 id="unit-{uid}">{esc(title)}</h2>
      {f'<p class="say-s">{summary}</p>' if summary else ''}
    </header>
    <ol class="lessons">
      {''.join(lesson_row(site, m, lab['number'][m['slug']]) for m in mods)}
    </ol>
  </section>''')
    steps = json.dumps({a['slug']: lab['facts'][a['slug']]['step_of'] for a in lab['apps']}, separators=(',', ':')).replace('<', '\\u003c')
    root = site['root']
    title = 'The Lab · ' + r['site']['name']
    description = (f"The Lab: a course in core medicine in {word(lab['n_units'])} units, taught one picture at a time. Step-by-step visual lessons in plain "
                   'language, each with goals, predictions, a quiz and a summary. Educational only, not for clinical use.')
    page_head = head(site, title, description, '/lab/', more=(
        f'\n<link rel="stylesheet" href="/v4/lab.css?v={stamp(root, "/v4/lab.css")}">\n<script type="module" src="/lab/kit/course.js"></script>'))
    return f'''{page_head}
</head>
<body class="page-lab">
<a class="skip" href="#course">Skip to the lessons</a>
{bar(site, 'lab')}
<main class="wrap" id="top">
  <header class="mast pair lab-mast">
    <div>
      <p class="lbl">A course in core medicine · since {month(lab['first'])}</p>
      <h1>The Lab</h1>
      <p class="lede">{told(site, 'lab_lede')}</p>
      <p class="say-s">{told(site, 'lab_rules')}</p>
    </div>
    <aside class="sheet lab-facts">
      <dl class="facts">
        <div><dt>Lessons</dt><dd>{total}</dd></div>
        <div><dt>Units</dt><dd>{lab['n_units']}</dd></div>
        <div><dt>To work through</dt><dd>{duration(lab['minutes']).replace('about ', '')}</dd></div>
        <div><dt>Practice questions</dt><dd>{lab['n_quiz'] + lab['n_checks']}</dd></div>
      </dl>
      <p class="lbl tally"><span>{total} of {planned} lessons ready</span><span>Latest: {day(lab['latest'])}</span></p>
      <div class="resume" data-lab-resume></div>
    </aside>
  </header>
  <nav class="map sec" aria-label="The course at a glance">
    <ol>{course_map}</ol>
    <p class="lbl map-key"><span><i class="dot is-no"></i>not started</span><span><i class="dot is-wake"></i>started</span><span><i class="dot is-yes"></i>every step seen</span></p>
  </nav>
  <div id="course">
  {''.join(units)}
  </div>
  <section class="sec review pair" id="review" aria-labelledby="review-h">
    <header class="unit-head">
      <h2 id="review-h">Mixed review</h2>
      <p class="say-s">{told(site, 'lab_review')}</p>
    </header>
    <div class="review-box" data-lab-review><button class="btn" type="button" data-lab-review-start>Start a mixed review</button></div>
  </section>
  <script type="application/json" id="lab-steps">{steps}</script>
</main>
{colophon(site)}
{palette(site, index_entries_for_other_pages(site))}
</body>
</html>
'''


# ---------------------------------------------------------------- not found, sitemap

def render_404(site):
    r = site['record']
    worlds = ''.join(f'<a class="go" href="/#world-{w["slug"]}">{esc(w["name"])}</a>' for w in r['worlds'])
    return f'''{head(site, 'Nothing at this address · ' + r['site']['name'], 'There is no page at this address on seansooch.dev.', None)}
<meta name="robots" content="noindex">
</head>
<body class="page-404">
<a class="skip" href="#top">Skip to the page</a>
{bar(site)}
<main class="wrap" id="top">
  <section class="mast pair">
    <div>
      <p class="lbl">404</p>
      <h1>Nothing at this address</h1>
      <p class="lede">{told(site, 'lost')}</p>
    </div>
    <aside class="sheet lost">
      <p class="lbl">Where things are</p>
      <p class="lost-links"><a class="go" href="/">The front page</a><a class="go" href="/lab/">The Lab</a><a class="go" href="/#writing">Writing</a><a class="go" href="/#editions">Editions</a></p>
      <p class="lbl">The work, by world</p>
      <p class="lost-links">{worlds}</p>
    </aside>
  </section>
</main>
{colophon(site)}
{palette(site, index_entries_for_other_pages(site))}
</body>
</html>
'''


def render_sitemap(site):
    lab = site['lab']
    rows = [('/', 'weekly', '1.0'), ('/two-stories/', 'yearly', '0.7')] + ELSEWHERE + [('/lab/', 'daily', '0.7')] + [
        (f'/lab/{a["slug"]}/', 'monthly', '0.6') for a in lab['apps']]
    body = '\n'.join(f'  <url><loc>{ORIGIN}{p}</loc><changefreq>{f}</changefreq><priority>{q}</priority></url>' for p, f, q in rows)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


# ---------------------------------------------------------------- writing

def pages(site):
    out = {
        'index.html': render_home(site),
        'two-stories/index.html': render_essay(site),
        'lab/index.html': render_lab(site),
        '404.html': render_404(site),
        'sitemap.xml': render_sitemap(site),
    }
    # No two elements of a page share an id. A film or a unit named after one of the page's own parts (its index
    # data, say) would otherwise be found in that part's place by the page's script.
    for p, text in out.items():
        twice = sorted(i for i, n in Counter(re.findall(r'\sid="([^"]*)"', text)).items() if n > 1)
        if twice:
            raise ValueError(f'{p} would have two elements with the id {twice[0]!r}: rename the work, paper, film, part or unit that takes it')
    return out


def behind(site, on_disk):
    """Is this home page only behind the ledger? Yes if it is, byte for byte, what the builder writes from this record,
    this design and a ledger cut down to the lessons the page lists: nothing has happened to it but lessons shipping
    since. A lesson it lists that was withdrawn or renamed, a record or sheet that changed, an edit by hand: all no."""
    listed = set(re.findall(r'data-lesson="([^"]+)"', on_disk))
    if not listed < {a['slug'] for a in site['lab']['apps']}:      # every lesson it lists still shipped, and more besides
        return False
    return render_home(load(site['root'], only=listed)) == on_disk


def verdicts(site, out):
    """Each page on disk that is not what the builder writes, and what puts it right:
      'lab'      one of the Lab's pages: a lesson's own deploy rewrites those (--lab);
      'behind'   the home page, when lessons shipping is all that has happened since it was built (see behind). A
                 lesson's own deploy rewrites only the Lab's pages, and the reader's browser adds the new lessons to
                 this one, so it is correct as it stands: a note, not a fault;
      'edition'  anything else: the record, the design or the builder has changed since, a lesson the home page lists
                 was renamed or withdrawn, or a page was edited by hand or came from somewhere else. Only a full build
                 puts that right, so the Lab's build cannot pass any of it."""
    found = {}
    for p, text in out.items():
        on_disk = (site['root'] / p).read_text(encoding='utf-8') if (site['root'] / p).is_file() else ''
        if on_disk != text:
            found[p] = 'lab' if p in LAB_PAGES else 'behind' if p == LEDGER_FED and behind(site, on_disk) else 'edition'
    return found


def main(argv, root=ROOT):
    unknown = [a for a in argv if a not in ('--lab', '--check')]
    if unknown:
        print(f"usage: build.py [--lab] [--check]   (unknown: {' '.join(unknown)})", file=sys.stderr)
        return 2
    site = load(root)
    out = pages(site)
    if '--lab' in argv:
        out = {p: out[p] for p in LAB_PAGES}
    found = verdicts(site, out)
    if '--check' in argv:
        says = {'lab': "stale: {} (not what the builder writes from the Lab's ledger)",
                'edition': 'stale: {} (the record, the design or the builder has changed since it was written, a lesson it lists was renamed or withdrawn, or it was edited by hand)',
                'behind': "behind: {} (correct; a reader's browser adds the lessons shipped since, and the next full build catches it up)"}
        for p, why in found.items():
            print(says[why].format(p))
        stale = {why for why in found.values() if why != 'behind'}
        if stale:
            print('run: python3 tools/build.py --lab, then commit' if stale == {'lab'} else 'run: python3 tools/build.py, then commit')
        return 1 if stale else 0
    for p in found:
        (root / p).parent.mkdir(parents=True, exist_ok=True)
        (root / p).write_text(out[p], encoding='utf-8')
    lab = site['lab']
    print(f"built {len(out)} pages ({len(found)} changed): {len(site['record']['works'])} works, {lab['n_lessons']} lessons in {lab['n_units']} units, "
          f"{len(site['plates'])} plates")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except ValueError as stop:      # a record, ledger or manifest that cannot be set safely: say which, and build nothing
        sys.exit(f'build.py: {stop}')
    except (KeyError, TypeError, AttributeError) as stop:      # one that is the wrong shape altogether
        sys.exit(f'build.py: the record, the ledger or the manifest is not the shape the pages need ({type(stop).__name__}: {stop})')
