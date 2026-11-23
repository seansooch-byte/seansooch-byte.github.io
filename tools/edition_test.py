#!/usr/bin/env python3
"""Checks on the edition: the record, the builder, and the pages in the tree. Never shipped.

    python3 -I tools/edition_test.py         (from the repo root; standard library only; -I so that nothing
                                              left beside the builder is imported in its place)

What it holds the edition to:
  - Census: every work, edition, paper, film, volume, view and lesson in the record and the Lab's ledger
    reaches a page, with its link. A dataset cannot drop out of the site silently.
  - Derived counts: every count a page prints is computed from the record, so two pages cannot disagree.
  - Hygiene: no em dash, unique ids, every in-page link lands, legacy anchors still land, shared assets are
    asked for by their current stamp, no inline script or style, every outside link is to a host the
    record names, and none is to a host this site must never link.
  - The paper is word for word what content/two-stories.json holds.
  - The tree is built: what tools/build.py would write is what is on disk, and building twice changes
    nothing.
  - The ledger moves without this repo's say: a lesson shipped tomorrow changes only the pages that list
    lessons, and an entry that is not a lesson, minutes that are not a number or a unit id that cannot be
    an address never reaches a page as markup.
  - The check a deploy runs (build.py --check) is walked through what really happens: a lesson's own deploy
    leaves the home page behind and nothing stale; a revised lesson or a module added to the syllabus does
    not touch the home page at all; an edited record, an edited sheet, a page edited by hand, a renamed or a
    withdrawn lesson is stale however the Lab's build is run.
  - A record that could not be set safely (an id that is not plain, an address that is not https, a film
    from somewhere else, two things wanting one anchor) stops the build, with the unbroken record as the
    control.
"""
import contextlib, copy, hashlib, html, io, json, os, re, shutil, subprocess, sys, tempfile, unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT / 'tools'))      # last, so the standard library is found first
import build  # noqa: E402

EM = chr(0x2014)
# Hosts this site must never link or name, kept as SHA-256 so the names are not in the repo.
NEVER = {
    'a7b78d7215e1d978f9b27eee78ae11792abd7c6c53aa53db823855ca8c02ae9d',
    'c17530ea8ef86af89001598c332685554a4af20f21fb7877dc7b14ff980b7bfa',
    '66ce7f25c58da391d263e0929b6c31e1a33f59f600cb55357f7bcc305e57bcea',
    'cf53110af225adeda679f34e4f36ad6ca5494072f6bb5d8c06f4fbcd538602bd',
}
LEGACY_ANCHORS = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'appa', 'appb', 'indexsec']   # Vol. 03's, still linked from lesson pages
VOID = {'meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'wbr', 'col'}


class Doc(HTMLParser):
    """A parsed page: its elements in order, its visible text, and the text of its data blocks."""

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.els, self.text, self.data, self._skip, self._buf = [], [], {}, None, []
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.els.append((tag, a))
        if tag in ('script', 'style', 'template'):
            self._skip, self._buf, self._id = tag, [], a.get('id')

    def handle_endtag(self, tag):
        if tag == self._skip:
            if self._id:
                self.data[self._id] = ''.join(self._buf)
            self._skip = None

    def handle_data(self, d):
        (self._buf if self._skip else self.text).append(d)

    @property
    def words(self):
        return re.sub(r'\s+', ' ', ' '.join(self.text)).strip()

    def attr(self, name, tag=None):
        return [a[name] for t, a in self.els if name in a and (tag is None or t == tag)]


def norm(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def tracked(root):
    """Every path git holds or has staged. A sparse checkout leaves the video segments off disk, so the checks ask git."""
    return subprocess.run(['git', '-C', str(root), 'ls-files'], capture_output=True, text=True, check=True).stdout.splitlines()


def jpeg_size(data):
    """(width, height) from a JPEG's frame header."""
    i = 2
    while i < len(data):
        marker, size = data[i + 1], int.from_bytes(data[i + 2:i + 4], 'big')
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            return int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')
        i += 2 + size
    return None


def squash(s):
    """Text with every space removed: for comparing words across different markup."""
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', s)))


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = build.load(ROOT)
        cls.rec = cls.site['record']
        cls.out = build.pages(cls.site)
        cls.home = cls.out['index.html']
        cls.doc = Doc(cls.home)
        cls.flat = squash(cls.home)
        # The record of the site itself (its editions, its counts, its status, its index) is a page of its own, so the
        # home page is the work.
        cls.record = cls.out['record/index.html']
        cls.rdoc = Doc(cls.record)
        cls.rflat = squash(cls.record)


class Astra(Base):
    def test_notebook_is_a_separate_document_with_the_full_register(self):
        page = self.out['astra/index.html']
        d = Doc(page)
        self.assertEqual(set(d.attr('data-entry')), {w['id'] for w in self.rec['works']})
        for item in self.rec['papers'] + self.rec['films']:
            self.assertIn(item['id'], d.attr('id'))
        self.assertIn('href="/astra/"', self.home)
        self.assertNotIn('class="mast pair"', page)
        self.assertNotIn('class="topbar"', page)


class Record(Base):
    def test_works_are_whole(self):
        ids = [w['id'] for w in self.rec['works']]
        self.assertEqual(len(ids), len(set(ids)), 'work ids repeat')
        worlds = {w['id'] for w in self.rec['worlds']}
        for w in self.rec['works']:
            for k in ('id', 'world', 'tier', 'kind', 'name', 'url', 'host', 'tech', 'plain', 'go', 'index', 'kw'):
                self.assertTrue(w.get(k), f"{w.get('id')}: missing {k}")
            self.assertIn(w['world'], worlds)
            self.assertTrue(set(w['also']) <= worlds - {w['world']}, w['id'])
            self.assertIn(w['tier'], ('major', 'minor'))
            self.assertRegex(w['id'], r'^[a-z][a-z0-9]*$')
            self.assertTrue(w['url'].startswith('https://'), w['id'])
            if w['stats'] != 'ledger':
                for s in w['stats']:
                    self.assertEqual(len(s), 2, f"{w['id']}: a stat is a figure and a label")
            current = [e for e in w['editions'] if e.get('current')]
            self.assertLessEqual(len(current), 1, w['id'])
            if w['editions']:
                self.assertEqual(len(current), 1, f"{w['id']}: one edition is the current one")
                self.assertIs(w['editions'][-1].get('current'), True, f"{w['id']}: editions are oldest first")
                for e in w['editions'][:-1]:
                    self.assertIn('url', e, f"{w['id']}: an earlier edition says where it is kept, or null if it was not")
                    self.assertTrue(e['url'] is None or e['url'].startswith('https://'), w['id'])

    def test_every_sentence_has_two_tellings(self):
        for key, v in self.rec['prose'].items():
            self.assertTrue(v.get('tech') and v.get('plain'), f'prose.{key}')
        for group in ('works', 'papers', 'films'):
            for item in self.rec[group]:
                self.assertTrue(item.get('tech') and item.get('plain'), f"{group}: {item.get('id')}")

    def test_papers_and_films(self):
        self.assertEqual(len(self.rec['papers']), 3)
        for p in self.rec['papers']:
            self.assertEqual(len(p['points']), 6, p['id'])
            self.assertEqual(len(p['links']), 3, p['id'])
        held = set(tracked(ROOT))
        for f in self.rec['films']:
            self.assertIn(f['src'].lstrip('/'), held, f"{f['id']}: the film is not in the repo")
            self.assertIn(f['poster'].lstrip('/'), held, f"{f['id']}: its poster is not in the repo")
            self.assertRegex(f['length'], r'^\d+:\d\d$', f['id'])

    def test_one_volume_is_current_and_it_is_this_one(self):
        cur = [v for v in self.rec['volumes'] if v['status'] == 'current']
        self.assertEqual(len(cur), 1)
        self.assertEqual(cur[0]['vol'], self.rec['edition']['vol'])
        self.assertEqual(cur[0]['name'], self.rec['edition']['name'])
        self.assertEqual(cur[0]['by'], [self.rec['edition']['by']])

    def test_the_record_holds_words_not_markup(self):
        text = json.dumps({k: self.rec[k] for k in ('prose', 'text', 'works', 'papers', 'films', 'volumes')}, ensure_ascii=False)
        self.assertNotRegex(text, r'<[a-z/]', 'a sentence in the record carries a tag; **bold** is the only markup it can ask for')

    def test_no_em_dash_in_the_record(self):
        for name in ('record.json', 'two-stories.json'):
            self.assertNotIn(EM, (ROOT / 'content' / name).read_text(encoding='utf-8'), name)


class Census(Base):
    def test_every_work_reaches_the_page(self):
        for w in self.rec['works']:
            with self.subTest(work=w['id']):
                self.assertIn(squash(html.escape(w['name'], quote=False)), self.flat)
                self.assertIn(w['url'], self.doc.attr('href'), 'its address is linked')
                self.assertIn(w['id'], self.doc.attr('id'), 'it has an anchor')
                for voice in ('tech', 'plain'):
                    said = build.fill(self.site, w[voice])
                    self.assertIn(squash(build.inline(said)), self.flat, f'its {voice} telling')
                stats = self.site['lab']['stats'] if w['stats'] == 'ledger' else w['stats']
                for figure, label in stats:
                    self.assertIn(squash(html.escape(figure, quote=False)), self.flat)
                    if label:
                        self.assertIn(squash(html.escape(label, quote=False)), self.flat)
                for e in w['editions']:
                    if not e.get('current') and e['url']:
                        self.assertIn(e['url'], self.doc.attr('href'), 'each kept edition is linked')
                    if e.get('name'):
                        self.assertIn(squash(html.escape(e['name'], quote=False)), self.flat)

    def test_every_address_is_asked(self):
        for d in (self.doc, self.rdoc):
            probes = json.loads(d.data['probes'])
            self.assertEqual([p['id'] for p in probes], [w['id'] for w in self.rec['works']])
            for p, w in zip(probes, self.rec['works']):
                self.assertEqual(p['url'], w['url'])
                self.assertEqual(bool(p.get('wake')), bool(w['wake']))
        for w in self.rec['works']:
            self.assertIn(w['id'], self.rdoc.attr('data-state'), f"{w['id']}: a row in the record's status table")
        dots = self.doc.attr('data-dot')
        for w in self.rec['works']:
            self.assertGreaterEqual(dots.count(w['id']), 2, f"{w['id']}: a dot in the directory and one at the work")

    def test_every_paper_reaches_the_page(self):
        hrefs = self.doc.attr('href')
        for p in self.rec['papers']:
            with self.subTest(paper=p['id']):
                self.assertIn(squash(p['name']), self.flat)
                for voice in ('tech', 'plain'):
                    self.assertIn(squash(build.inline(p[voice])), self.flat)
                for head, gloss in p['points']:
                    self.assertIn(squash(html.escape(head, quote=False)), self.flat)
                    self.assertIn(squash(html.escape(gloss, quote=False)), self.flat)
                for link in p['links']:
                    self.assertIn(link['href'], hrefs)

    def test_the_outside_guidance_reaches_the_page_with_its_source(self):
        """The guidance section: the issuer's own figure (held here, sized, stamped, credited, linked to the
        source), every question with this site's answer, and the line that the issuer has not reviewed the site."""
        g = self.rec['guidance']
        section = re.search(r'<section class="sec" id="guidance".*?</section>', self.home, flags=re.S)
        self.assertTrue(section, 'the home page has a guidance section')
        part, hrefs = section.group(0), Doc(section.group(0)).attr('href')
        flat = squash(part)
        for s in ('title', 'name', 'issuer', 'rights', 'reviewed'):
            self.assertIn(squash(html.escape(g[s], quote=False)), flat, s)
        for voice in ('tech', 'plain'):
            self.assertIn(squash(build.inline(g[voice])), flat, voice)
        self.assertTrue(build.real_day(g['published']), 'the guidance carries the day the AMA published it')
        self.assertIn(squash(f"Published {build.day(g['published'])}"), flat)
        self.assertIn(f'<time datetime="{g["published"]}">', part)
        self.assertEqual(len(g['points']), 5, 'four questions and the flywheel')
        for head, question, answer in g['points']:
            for s in (head, question, answer):
                self.assertIn(squash(html.escape(s, quote=False)), flat)
        self.assertTrue(g['href'].startswith('https://www.ama-assn.org/'))
        self.assertIn(g['href'], hrefs)
        fig, path = g['figure'], ROOT / g['figure']['src'].lstrip('/')
        self.assertEqual(build.webp_size(path), (fig['w'], fig['h']), 'the figure is sized as the file is')
        img = [a for t, a in Doc(part).els if t == 'img']
        self.assertEqual(len(img), 1)
        self.assertEqual(img[0]['src'], f"{fig['src']}?v={build.stamp(ROOT, fig['src'])}")
        self.assertEqual((img[0]['width'], img[0]['height']), (str(fig['w']), str(fig['h'])))
        self.assertGreater(len(img[0]['alt']), 40, 'the figure is described in words')
        self.assertIn(fig['src'].lstrip('/'), tracked(ROOT), 'the figure is in git, so the bundle carries it')

    def test_the_guidance_keeps_a_timeline_of_alignment(self):
        """Two tabs: the framework, open, and the timeline beside it. Each entry is dated, says what it answers,
        lists its checks, and prints a score counted from them, never typed. Without scripts both panels show."""
        g = self.rec['guidance']
        part = re.search(r'<section class="sec" id="guidance".*?</section>', self.home, flags=re.S).group(0)
        flat, d = squash(part), Doc(part)
        self.assertIn(squash(html.escape(g['note'], quote=False)), flat, 'the note that future guidance is tracked')
        tabs = [a for t, a in d.els if a.get('role') == 'tab']
        self.assertEqual([a['aria-controls'] for a in tabs], ['guidance-framework', 'guidance-timeline'])
        self.assertEqual([a['aria-selected'] for a in tabs], ['true', 'false'], 'the framework is open first')
        panels = {a['id']: a for t, a in d.els if a.get('role') == 'tabpanel'}
        self.assertEqual(set(panels), {'guidance-framework', 'guidance-timeline'})
        self.assertTrue(all('hidden' not in a for a in panels.values()), 'without scripts both panels are on the page')
        self.assertIn('is-open', panels['guidance-framework']['class'])
        self.assertNotIn('is-open', panels['guidance-timeline']['class'])
        self.assertGreaterEqual(len(g['timeline']), 1)
        first = g['timeline'][0]
        self.assertEqual(first['kind'], 'First correspondence')
        self.assertEqual(first['published'], g['published'], 'the first entry is the framework this section shows')
        for e in g['timeline']:
            for k in ('published', 'checked'):
                self.assertTrue(build.real_day(e[k]))
                self.assertIn(f'<time datetime="{e[k]}">', part)
            for s in (e['kind'], e['title'], e['text']):
                self.assertIn(squash(html.escape(s, quote=False)), flat)
            met = sum(1 for c in e['checks'] if c[2] is True)
            self.assertIn(squash(f'{met}/{len(e["checks"])}'), flat, 'the score is counted from the checks')
            for area, check, ok in e['checks']:
                self.assertIs(type(ok), bool)
                self.assertIn(squash(html.escape(check, quote=False)), flat)
        self.assertEqual(len(first['checks']), 10)
        self.assertIn('separate realm from the study tools', first['text'])

    def test_every_film_reaches_the_page(self):
        films = self.doc.attr('data-film')
        for f in self.rec['films']:
            with self.subTest(film=f['id']):
                self.assertIn(f['src'], films)
                self.assertIn(squash(html.escape(f['name'], quote=False)), self.flat)
                self.assertIn(f['length'], self.home)
                for voice in ('tech', 'plain'):
                    self.assertIn(squash(build.inline(f[voice])), self.flat)

    def test_every_volume_and_view_reaches_the_record(self):
        hrefs = self.rdoc.attr('href')
        for v in self.rec['volumes']:
            with self.subTest(vol=v['vol']):
                self.assertIn(squash(v['vol']), self.rflat)
                if v.get('name'):
                    self.assertIn(squash(html.escape(v['name'], quote=False)), self.rflat)
                if v.get('href'):
                    self.assertIn(v['href'], hrefs)
                for name in v.get('by', []):
                    self.assertIn(squash(name), self.rflat)
                for view in v.get('views', []):
                    self.assertIn(squash(view['name']), self.rflat)
                    self.assertIn(squash(view['by']), self.rflat)
                    self.assertIn(v['href'] + view['path'], hrefs)

    def test_the_home_page_is_the_work_and_the_record_page_is_the_site(self):
        home, record = set(self.doc.attr('id')), set(self.rdoc.attr('id'))
        for part in ('work', 'writing', 'guidance', 'films'):
            self.assertIn(part, home)
            self.assertNotIn(part, record)
        for part in ('editions', 'record', 'about', 'index'):
            self.assertIn(part, record)
            self.assertNotIn(part, home, f'#{part} is still on the home page')

    def test_every_lesson_reaches_the_home_page_and_the_course_page(self):
        lab = Doc(self.out['lab/index.html'])
        for a in self.site['lab']['apps']:
            with self.subTest(lesson=a['slug']):
                self.assertIn(f"/lab/{a['slug']}/", self.doc.attr('href'))
                self.assertIn(f"/lab/{a['slug']}/", lab.attr('href'))
                self.assertIn(a['slug'], lab.attr('data-slug'))
        self.assertTrue(self.site['lab']['apps'], 'the ledger was read')

    def test_the_index_lists_everything(self):
        entries = {norm(t) for t in re.findall(r'<a class="ix"[^>]*>(.*?)</a>', self.record, flags=re.S)}
        want = [w['index'] for w in self.rec['works']] + [p['index'] for p in self.rec['papers']] + [f['index'] for f in self.rec['films']]
        for name in want:
            self.assertIn(name, entries)
        for a in self.site['lab']['apps']:
            self.assertNotIn(f"/lab/{a['slug']}/", self.record, 'a lesson is typed into the record page: a new lesson would leave it stale')
        printed = len(re.findall(r'<a class="ix"', self.record))
        self.assertIn(f'<span data-ix-n>{printed}</span> entries', self.record, 'the index says how many entries it prints')
        ids = {'/': set(self.doc.attr('id')), '/record/': set(self.rdoc.attr('id'))}
        printed = [html.unescape(h) for h in re.findall(r'<a class="ix" href="([^"]*)"', self.record)]
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            palette = json.loads(Doc(text).data['index-data'])
            self.assertGreaterEqual(len(palette), len(want), path)
            for h in [item['h'] for item in palette] + (printed if path == 'record/index.html' else []):
                self.assertRegex(h, r'^/', f'{path}: {h} is addressed to whatever page the reader is on')
                m = re.match(r'^(/|/record/)#([A-Za-z0-9_-]+)$', h)
                if m:
                    self.assertIn(m.group(2), ids[m.group(1)], f'{path}: the index sends a reader to {h}, which lands nowhere')

    def test_the_index_a_reader_searches_leaves_lessons_to_the_ledger(self):
        for path, text in self.out.items():
            if path.endswith('.html'):
                palette = json.loads(Doc(text).data['index-data'])
                self.assertFalse([e['t'] for e in palette if re.match(r'^/lab/[^/]+/$', e['h'])], f'{path}: a lesson is typed into the searched index')
        for a in self.site['lab']['apps']:
            for path in ('two-stories/index.html', '404.html'):
                self.assertNotIn(f"/lab/{a['slug']}/", self.out[path], f'{path} names a lesson, so a new lesson would leave it stale')

    def test_every_sentence_of_the_record_is_set(self):
        everything = squash(''.join(text for path, text in self.out.items() if path.endswith('.html')))
        for key, sentence in self.rec['text'].items():
            want = squash(build.inline(build.fill(self.site, sentence)))
            # lab_newest is the line under "Added since the units were set". It is printed only
            # while a shipped lesson is still unplaced; with none, that line would be false.
            if key == 'lab_newest' and not self.site['lab']['extra']:
                self.assertNotIn(want, everything, 'lab_newest is on a page even though every shipped lesson is placed')
                continue
            self.assertIn(want, everything, f'text.{key} is in the record and on no page')
        for path, text in self.out.items():
            if path.endswith('.html'):
                self.assertNotRegex(Doc(text).words, r'\{[A-Za-z_]+\}', f'{path}: a brace was printed instead of filled')

    def test_reading_rooms_are_the_works_the_record_marks(self):
        rooms = [w for w in self.rec['works'] if w.get('room')]
        self.assertTrue(rooms)
        line = norm(re.search(r'<h2 id="writing-h">.*?</header>', self.home, flags=re.S).group(0))
        self.assertIn(f"{build.word(len(rooms)).capitalize()} reading room", line)
        for w in rooms:
            self.assertIn(w['name'], line)


class Derived(Base):
    def test_the_page_counts_the_work_one_way(self):
        """How many works there are is printed in the lede, the directory, the filter and each world's heading. A work
        is counted once, in its own world, everywhere: the lede once said fifteen (the works whose lines are counted)
        beside a directory of twenty-three and a filter that counted a work in each world it is also shown in."""
        n, counted = len(self.rec['works']), sum(1 for w in self.rec['works'] if w['counted'])
        self.assertNotEqual(n, counted, 'CONTROL: some works are not in the line count, so the two numbers differ')
        self.assertIn(squash(f'{build.word(n).capitalize()} live works'), self.flat)
        self.assertIn(squash(f'{build.word(n).capitalize()} working projects'), self.flat)
        self.assertIn(squash(f'in {build.word(counted)} of them'), self.flat, 'the line count says which works it counts')
        self.assertNotRegex(self.flat, rf'(?i){build.word(counted)} (working|live) ', 'the count of works whose lines are counted is given as the count of works')
        groups = re.findall(r'<div class="dir-g"><h3><a href="#world-([a-z]+)">[^<]*</a><span>(\d+)</span></h3>', self.home)
        own = {x['slug']: sum(1 for w in self.rec['works'] if w['world'] == x['id']) for x in self.rec['worlds']}
        self.assertEqual({slug: int(k) for slug, k in groups}, {s: k for s, k in own.items() if k})
        self.assertEqual(sum(int(k) for _s, k in groups), n)
        for world in self.rec['worlds']:
            mine = own[world['slug']]
            if mine:
                note = norm(re.search(rf'<h3 id="world-{world["id"]}">.*?</header>', self.home, flags=re.S).group(0))
                self.assertIn(f"{build.word(mine)} work", note.lower(), world['name'])

    def test_the_filter_shows_what_it_says_and_counts_only_the_whole(self):
        chips = re.findall(r'<button class="btn" type="button" data-filter="([a-z]+)"[^>]*>(.*?)</button>', self.home, flags=re.S)
        self.assertEqual([c for c, _l in chips], ['all'] + [x['id'] for x in self.rec['worlds']])
        for world, label in chips:
            counts = re.findall(r'<span class="n">(\d+)</span>', label)
            self.assertEqual(counts, [str(len(self.rec['works']))] if world == 'all' else [],
                             f'{world}: a world counted in the filter, where a work shown in two worlds counts twice')
        for world in self.rec['worlds']:
            shown = sum(1 for w in self.rec['works'] if world['id'] == w['world'] or world['id'] in w['also'])
            tagged = sum(1 for t, a in self.doc.els if t == 'article' and world['id'] in a.get('data-worlds', '').split())
            self.assertEqual(tagged, shown, f"{world['name']}: rows the filter would show")

    def test_side_by_side_counts_what_can_be_set_side_by_side(self):
        plates = self.site['plates']
        can = [w['id'] for w in self.rec['works'] if any(e.get('url') and f"{w['id']}-e{e['n']}" in plates for e in w['editions'][:-1])]
        said = re.search(r'data-view="beside"[^>]*>Side by side <span class="n">(\d+)</span>', self.home)
        self.assertEqual(int(said.group(1)), len(can), 'the switch counts the works it can set side by side')
        self.assertEqual(sorted(re.findall(r'<div class="prior" id="([a-z0-9]+)-prior"', self.home)), sorted(can))
        self.assertLess(len(can), sum(1 for w in self.rec['works'] if len(w['editions']) > 1),
                        'CONTROL: the record holds a work whose earlier edition was not kept, so counting editions would overcount')

    def test_each_world_counts_the_editions_it_kept(self):
        for world in self.rec['worlds']:
            mine = [w for w in self.rec['works'] if w['world'] == world['id']]
            if not mine:
                continue
            kept = sum(1 for w in mine if any(e.get('url') for e in w['editions'][:-1]))
            note = norm(re.search(rf'<h3 id="world-{world["id"]}">.*?</header>', self.home, flags=re.S).group(0))
            if kept:
                self.assertIn(f'{build.word(kept)} with an earlier edition kept', note, world['name'])
            else:
                self.assertNotIn('earlier edition', note, world['name'])
        self.assertEqual(self.site['n']['kept'], build.word(sum(1 for w in self.rec['works'] if any(e.get('url') for e in w['editions'][:-1]))))

    def test_a_volume_is_addressed_by_its_number(self):
        self.assertEqual(build.vol_key({'vol': 'Vol. 04'}), 'vol4')
        self.assertEqual(build.vol_key({'vol': 'Vol. 10'}), 'vol10')

    def test_the_directory_says_how_many_it_asks(self):
        self.assertIn(f"of {len(self.rec['works'])}", self.home)

    def test_lab_figures_come_from_the_ledger(self):
        lab = self.site['lab']
        ledger = json.loads((ROOT / 'lab' / 'apps.json').read_text(encoding='utf-8'))
        self.assertEqual(lab['n_lessons'], len(ledger), 'an entry of the ledger was left out as not a lesson')
        plans = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((ROOT / 'lab').glob('*/plan.json'))]
        questions = sum(len(p.get('quiz', [])) + len(p.get('checks', {})) for p in plans)
        course = norm(self.out['lab/index.html'])
        self.assertIn(f'Lessons {len(ledger)} ', course, 'the course page prints the number of lessons the ledger holds')
        self.assertIn(f'Practice questions {questions} ', course)
        self.assertIn('To work through ' + build.duration(sum(p.get('minutes', 0) for p in plans)).replace('about ', ''), course)

    def test_the_home_page_says_of_the_lab_only_what_an_added_lesson_keeps_true(self):
        """Hours and question counts move with every lesson and every revision, and a lesson's own deploy does not
        rebuild this page: so it prints neither, and its lesson count sits where the browser can bring it up to date."""
        lab = self.site['lab']
        hooked = re.findall(r'<(?:span|dd) data-lab-n>(\d+)</(?:span|dd)>', self.home)
        self.assertEqual(hooked, [str(lab['n_lessons'])] * 2, 'the Lab row and its outline each print the lesson count, hooked')
        self.assertNotIn('data-lab-n', self.record, 'the record page prints a lesson count: a lesson shipped tomorrow would leave it stale')
        plans = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((ROOT / 'lab').glob('*/plan.json'))]
        questions = sum(len(p.get('quiz', [])) + len(p.get('checks', {})) for p in plans)
        outline = re.search(r'<div class="outline".*?</div>\s*</div>', self.home, flags=re.S).group(0)
        self.assertIn('data-lab-new', outline, 'CONTROL: the whole outline was found')
        block = ' '.join(norm(part) for part in (re.search(r'<article class="work[^"]*" id="lab".*?</article>', self.home, flags=re.S).group(0), outline))
        for said in ('to work through', 'practice questions', f' {questions} ', 'coming'):
            self.assertNotIn(said, block + ' ', f'the home page prints "{said.strip()}" of the Lab')
        self.assertNotRegex(block, r'about (an hour|\d+( and a half)? hours|\d+ min)|\b\d+ min\b', 'the home page prints how long the course or a lesson takes')
        self.assertNotIn('to work through', norm(self.home))
        for brace in ('{lessons}', '{Lessons}', '{practice}', '{lab_time}'):
            with self.assertRaises(ValueError, msg=f'{brace} can be asked for by a sentence'):
                build.fill(self.site, brace)
        self.assertNotRegex(outline, r'<ol|start=', 'the outline numbers its lessons: a module added to the syllabus would move the numbers')

    def test_no_count_is_typed_into_a_sentence(self):
        text = (ROOT / 'content' / 'record.json').read_text(encoding='utf-8')
        prose = json.dumps([self.rec['prose'], self.rec['text']]).lower()
        lab = self.site['lab']
        counts = {'systems': sum(1 for w in self.rec['works'] if w['counted']), 'works': len(self.rec['works']),
                  'lessons': lab['n_lessons'], 'kept editions': sum(1 for w in self.rec['works'] if any(e.get('url') for e in w['editions'][:-1]))}
        self.assertTrue(all(n >= 10 for n in counts.values()), 'CONTROL: these counts have words long enough not to be typed by chance')
        for name, n in counts.items():
            for near in (n - 1, n, n + 1):
                self.assertNotRegex(prose, rf'\b{build.word(near)}\b', f'"{build.word(near)}" is typed into a sentence (the count of {name} is {n}); use a {{brace}}')
        self.assertIn('{Works}', text)


class Hygiene(Base):
    def test_no_em_dash_anywhere(self):
        for path, text in self.out.items():
            self.assertNotIn(EM, text, path)
        for p in list((ROOT / 'v4').glob('*')):
            if p.suffix in ('.css', '.js'):
                self.assertNotIn(EM, p.read_text(encoding='utf-8'), p.name)

    def test_ids_are_unique_and_links_land(self):
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            d = Doc(text)
            ids = d.attr('id')
            dup = sorted({i for i in ids if ids.count(i) > 1})
            self.assertEqual(dup, [], f'{path}: repeated ids')
            for href in d.attr('href'):
                if href.startswith('#') and len(href) > 1:
                    self.assertIn(href[1:], ids, f'{path}: {href} lands nowhere')
            for t, a in d.els:
                for k in ('aria-controls', 'aria-labelledby', 'aria-describedby', 'for'):
                    for ref in a.get(k, '').split():
                        self.assertIn(ref, ids, f'{path}: {k}="{ref}" names nothing')

    def test_links_between_pages_land(self):
        ids = {path: set(Doc(text).attr('id')) for path, text in self.out.items() if path.endswith('.html')}
        route = {'/': 'index.html', '/two-stories/': 'two-stories/index.html', '/lab/': 'lab/index.html', '/record/': 'record/index.html'}
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            for href in Doc(text).attr('href'):
                m = re.match(r'^(/|/two-stories/|/lab/|/record/)#([A-Za-z0-9_-]+)$', href)
                if m:
                    self.assertIn(m.group(2), ids[route[m.group(1)]], f'{path}: {href} lands nowhere')

    def test_legacy_anchors_still_land(self):
        ids = set(self.doc.attr('id'))
        moved = self.moved()
        for a in LEGACY_ANCHORS:
            self.assertTrue(a in ids or a in moved, f'#{a} is linked from lesson pages and old addresses')
        essay = set(Doc(self.out['two-stories/index.html']).attr('id'))
        for a in ('part1', 'table43', 'part2', 'sources'):
            self.assertIn(a, essay)

    def moved(self):
        m = re.search(r'<html [^>]*data-moved="([^"]*)"', self.home)
        self.assertTrue(m, 'the home page names the anchors that moved to the record page')
        return m.group(1).split()

    def test_an_address_to_what_moved_is_sent_on_to_the_record(self):
        """Every lesson's bar links /#editions, and Vol. 03 and earlier pages linked /#record, /#index and each volume.
        The server never sees an anchor, so the home page names the ones it gave up and /v4/boot.js sends a reader on
        before the first paint. Every anchor of the record page's own parts is named, and none the home page keeps."""
        home, moved = set(self.doc.attr('id')), self.moved()
        record = set(self.rdoc.attr('id'))
        main = re.search(r'<main[^>]*>(.*)</main>', self.record, flags=re.S).group(1)
        parts = set(re.findall(r'\sid="([^"]*)"', main)) - {'record-top'}
        self.assertEqual(sorted(moved), sorted(parts - home), 'the anchors that moved are the record page\'s own, less any the home page keeps')
        for a in ('editions', 'record', 'about', 'index', 'indexsec', 'ch1', 'ch2', 'appa') + tuple(build.vol_key(v) for v in self.rec['volumes'] if v['status'] != 'awaiting'):
            self.assertIn(a, moved)
            self.assertIn(a, record)
        boot = (ROOT / 'v4' / 'boot.js').read_text(encoding='utf-8')
        self.assertIn("getAttribute('data-moved')", boot)
        self.assertIn("location.replace('/record/#'", boot)
        for path, text in self.out.items():
            if path.endswith('.html'):
                self.assertNotRegex(text, r'href="/#(editions|record|index|about)"', f'{path} still links an anchor that moved')
                if path != 'record/index.html':
                    self.assertNotRegex(text, r'href="#(editions|record|index|about)"', f'{path} links an anchor it does not have')

    def test_assets_are_asked_for_by_their_stamp(self):
        """Every reference to one of the edition's own assets carries the first ten hex of that file's MD5."""
        seen = set()
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            for tag, a in Doc(text).els:
                refs = [a.get('src')] if tag in ('script', 'img') else [a.get('href')] if tag == 'link' and a.get('rel') == 'stylesheet' else []
                refs += [part.split()[0] for part in a.get('srcset', '').split(',') if part.strip()] if tag == 'img' else []
                for ref in refs:
                    if ref and ref.startswith('/v4/'):
                        asset, _, stamp = ref.partition('?v=')
                        now = hashlib.md5((ROOT / asset.lstrip('/')).read_bytes()).hexdigest()[:10]
                        self.assertEqual(stamp, now, f'{path} asks for {asset} by {stamp or "no stamp"}; the file is {now}')
                        seen.add(asset)
        self.assertEqual(seen, {'/' + p.relative_to(ROOT).as_posix() for p in (ROOT / 'v4').rglob('*') if p.is_file()}, 'a file in v4/ that no page asks for, or the reverse')

    def test_plates_are_asked_for_by_their_stamp(self):
        """A plate is retaken under the same name, and the host keeps an image four hours: so every plate a page shows,
        and the share card, is asked for by a stamp of its current bytes, or a returning reader sees the old capture
        (2026-11-14: the situation's new plate did not show for Sean though the live file was new)."""
        seen = 0
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            refs = [a.get('src') for t, a in Doc(text).els if t == 'img']
            refs += [part.split()[0] for t, a in Doc(text).els if t == 'img' for part in a.get('srcset', '').split(',') if part.strip()]
            refs += re.findall(r'property="og:image" content="https://seansooch\.dev(/plates/[^"]+)"', text)
            for ref in refs:
                if ref and ref.startswith('/plates/'):
                    asset, _, stamp = ref.partition('?v=')
                    now = hashlib.md5((ROOT / asset.lstrip('/')).read_bytes()).hexdigest()[:10]
                    self.assertEqual(stamp, now, f'{path} asks for {asset} by {stamp or "no stamp"}; the file is {now}')
                    seen += 1
        self.assertGreater(seen, 50, 'CONTROL: the pages show plates')

    def test_every_class_is_styled_or_read(self):
        """A class on a page is in a sheet that page loads or in a script that reads it: a typed-wrong class, or a
        sheet from another edition, shows here before it shows on a screen."""
        site_css, lab_css = (ROOT / 'v4' / 'site.css').read_text(encoding='utf-8'), (ROOT / 'v4' / 'lab.css').read_text(encoding='utf-8')
        scripts = (ROOT / 'v4' / 'site.js').read_text(encoding='utf-8') + (ROOT / 'lab' / 'kit' / 'course.js').read_text(encoding='utf-8')
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            known = site_css + (ROOT / "astra" / "notebook.css").read_text() + scripts + (lab_css if path == 'lab/index.html' else '')
            for cls in sorted({c for a in Doc(text).attr('class') for c in a.split()}):
                self.assertRegex(known, r'\.' + re.escape(cls) + r'(?![\w-])', f'{path}: nothing styles or reads the class "{cls}"')

    def test_every_address_the_page_asks_is_allowed_by_the_policy(self):
        """Each probe is a fetch, so the policy's connect-src names its origin, and names no origin the record dropped."""
        policy = next(line for line in (ROOT / '_headers').read_text(encoding='utf-8').splitlines() if 'Content-Security-Policy' in line)
        allowed = re.search(r'connect-src ([^;]+)', policy).group(1).split()
        probes = json.loads(self.doc.data['probes'])
        self.assertEqual(len(probes), len(self.rec['works']), 'CONTROL: every work is asked')
        asked = {re.match(r'^https://[^/]+', p['url']).group(0) for p in probes}
        for origin in sorted(asked):
            self.assertIn(origin, allowed, f'_headers: connect-src does not allow {origin}, which the home page asks')
        # Besides the probes: this origin (absolute on the *.pages.dev aliases), the host one address redirects to,
        # and Cloudflare Web Analytics' collector, which the policy has always allowed.
        others = {"'self'", 'https://seansooch.dev', 'https://www.admissionsacademy.org', 'https://cloudflareinsights.com'}
        self.assertEqual(sorted(set(allowed) - asked - others), [], '_headers: connect-src still allows a host no page asks')

    def test_the_share_image_is_the_one_captured(self):
        card = self.site['plates'].get('card')
        self.assertTrue(card, 'no share image in the manifest: node tools/plates.mjs card')
        self.assertEqual(jpeg_size((ROOT / 'plates' / 'card.jpg').read_bytes()), (card['w'], card['h']))
        for path, text in self.out.items():
            if path.endswith('.html'):
                meta = {a.get('property'): a.get('content') for tag, a in Doc(text).els if tag == 'meta' and a.get('property')}
                self.assertEqual(meta.get('og:image', '').partition('?v=')[0], 'https://seansooch.dev/plates/card.jpg', path)
                self.assertEqual((meta.get('og:image:width'), meta.get('og:image:height')), (str(card['w']), str(card['h'])), path)

    def test_a_plate_note_goes_wherever_the_plate_goes(self):
        noted = [w for w in self.rec['works'] if w.get('plate_note')]
        self.assertIn('handoff', [w['id'] for w in noted], 'the handoff tracker shows a board of patients: its plates must say they are made up')
        for w in noted:
            block = re.search(rf'<article class="work[^"]*" id="{w["id"]}".*?</article>', self.home, flags=re.S).group(0)
            alts = re.findall(rf'<img src="/plates/{w["id"]}(?:-e\d+)?-720\.webp(?:\?v=[0-9a-f]{{10}})?"[^>]*alt="([^"]*)"', block)
            captions = re.findall(r'<figcaption.*?</figcaption>', block, flags=re.S)
            self.assertGreaterEqual(len(alts), 2, f"{w['id']}: CONTROL: the current plate and an earlier one")
            for said in alts + [norm(c) for c in captions]:
                self.assertIn(w['plate_note'], html.unescape(said), w['id'])

    def test_plates_are_dated_by_the_manifest(self):
        taken = sorted({p['taken'] for p in self.site['plates'].values()})
        self.assertIn(f'Plates captured {build.day(taken[0])}', norm(self.home))
        w = next(w for w in self.rec['works'] if w['id'] in self.site['plates'])
        self.assertIn(f"as it looked on {build.day(self.site['plates'][w['id']]['taken'])}", self.home)
        self.assertNotIn('captured', self.rec['edition'], 'the day a plate was taken is the manifest\'s to say')

    def test_no_inline_script_or_style(self):
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            d = Doc(text)
            for t, a in d.els:
                self.assertNotIn('style', a, f'{path}: inline style on <{t}>')
                for k in a:
                    self.assertFalse(k.startswith('on'), f'{path}: inline handler {k}')
                if t == 'script' and 'src' not in a:
                    self.assertIn(a.get('type'), ('application/json', 'application/ld+json'), f'{path}: inline script')
                self.assertNotEqual(t, 'style', f'{path}: inline <style>')

    def test_outside_links_are_named_in_the_record_and_safe(self):
        allowed = {'seansooch.dev', 'fonts.googleapis.com', 'fonts.gstatic.com', 'schema.org'}
        for w in self.rec['works']:
            allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', w['url']))
            for e in w['editions']:
                if e.get('url'):
                    allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', e['url']))
        for v in self.rec['volumes']:
            if v.get('href'):
                allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', v['href']))
        for p in self.rec['papers']:
            for link in p['links']:
                if link['href'].startswith('https://'):
                    allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', link['href']))
        for photo in self.rec['theme']['photos']:
            allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', photo['source']))
        allowed.add(re.sub(r'^https://([^/]+).*$', r'\1', self.rec['guidance']['href']))
        essay = json.loads((ROOT / 'content' / 'two-stories.json').read_text(encoding='utf-8'))
        for h in re.findall(r'href="https://([^/"]+)', json.dumps(essay, ensure_ascii=False).replace('\\"', '"')):
            allowed.add(h)
        for path, text in self.out.items():
            for host in set(re.findall(r'https?://([A-Za-z0-9.-]+)', text)):
                self.assertNotIn(hashlib.sha256(host.encode()).hexdigest(), NEVER, f'{path} names a host this site must never link')
                if path.endswith('.html'):
                    self.assertIn(host, allowed, f'{path}: {host} is not a host the record names')
            if path.endswith('.html'):
                for t, a in Doc(text).els:
                    if t == 'a' and a.get('target') == '_blank':
                        self.assertIn('noopener', a.get('rel', ''), f"{path}: {a.get('href')}")
                    self.assertFalse(a.get('href', '').startswith('http://'), f"{path}: {a.get('href')}")

    def test_images_have_sizes_and_words(self):
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            for t, a in Doc(text).els:
                if t == 'img':
                    self.assertTrue(a.get('width') and a.get('height'), f"{path}: {a.get('src')} has no size")
                    self.assertIn('alt', a, f"{path}: {a.get('src')} has no alt")

    def test_structured_data_parses(self):
        ld = json.loads(self.doc.data['ld'])
        self.assertEqual(ld['@type'], 'Person')
        self.assertEqual(ld['name'], self.rec['site']['name'])

    def test_every_ink_reads_on_both_grounds(self):
        """The edition has no colour, so contrast is its whole palette: each ink must clear 4.5 to 1 on the ground and on the sheet, in both themes."""
        css = (ROOT / 'v4' / 'site.css').read_text(encoding='utf-8')

        def tokens(block):
            return dict(re.findall(r'--(ground|sheet|ink|ink-2|ink-3):\s*(#[0-9a-fA-F]{6})', block))

        def lum(h):
            c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

        light = tokens(css[css.index(':root{'):css.index('}', css.index(':root{'))])
        dark = tokens(css[css.index(':root[data-theme=dark]{'):css.index('}', css.index(':root[data-theme=dark]{'))])
        auto = tokens(css[css.index(':root:not([data-theme=light]){'):css.index('}', css.index(':root:not([data-theme=light]){'))])
        self.assertEqual(dark, auto, 'the chosen dark theme and the device dark theme are one palette')
        for name, pal in (('light', light), ('dark', dark)):
            self.assertEqual(set(pal), {'ground', 'sheet', 'ink', 'ink-2', 'ink-3'}, name)
            for ink in ('ink', 'ink-2', 'ink-3'):
                for ground in ('ground', 'sheet'):
                    a, b = sorted((lum(pal[ink]), lum(pal[ground])), reverse=True)
                    ratio = (a + 0.05) / (b + 0.05)
                    self.assertGreaterEqual(ratio, 4.5, f'{name}: {ink} on {ground} is {ratio:.2f} to 1')
            hues = {max(int(h[i:i + 2], 16) for i in (1, 3, 5)) - min(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in pal.values()}
            self.assertLessEqual(max(hues), 4, f'{name}: a token has a colour; the page has none of its own')

    def test_the_usa_theme_is_red_white_and_blue_and_reads(self):
        """The one palette with colour. Every ink clears 4.5 to 1 on the ground, the sheet and the bar; the rule clears
        3 to 1 on the ground; and no token is anything but red, white or blue (Sean: no yellow)."""
        import colorsys
        css = (ROOT / 'v4' / 'site.css').read_text(encoding='utf-8')
        start = css.index(':root[data-theme=usa]{')
        pal = dict(re.findall(r'--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})', css[start:css.index('}', start)]))
        self.assertLessEqual({'ground', 'sheet', 'ink', 'ink-2', 'ink-3', 'union', 'on-union', 'on-union-2', 'stripe'}, set(pal))

        def lum(h):
            c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

        def ratio(a, b):
            hi, lo = sorted((lum(pal[a]), lum(pal[b])), reverse=True)
            return (hi + 0.05) / (lo + 0.05)
        for ink, grounds in (('ink', ('ground', 'sheet')), ('ink-2', ('ground', 'sheet')), ('ink-3', ('ground', 'sheet')),
                             ('on-union', ('union',)), ('on-union-2', ('union',))):
            for g in grounds:
                self.assertGreaterEqual(ratio(ink, g), 4.5, f'usa: {ink} on {g} is {ratio(ink, g):.2f} to 1')
        self.assertGreaterEqual(ratio('stripe', 'ground'), 3, f"usa: the rule on the ground is {ratio('stripe', 'ground'):.2f} to 1")
        self.assertLess(lum(pal['ground']), 0.02, 'usa: the ground is dark')
        for name, h in pal.items():
            hue, light, sat = colorsys.rgb_to_hls(*(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)))
            if sat > 0.12 and 0.03 < light < 0.97:
                self.assertTrue(hue * 360 >= 335 or hue * 360 <= 8 or 205 <= hue * 360 <= 235, f'usa: --{name} {h} is neither red, white nor blue')
        self.assertTrue(any(colorsys.rgb_to_hls(*(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)))[0] * 360 >= 335 for h in pal.values()), 'CONTROL: the palette holds a red')

    def test_one_h1_and_a_title_per_page(self):
        for path, text in self.out.items():
            if path.endswith('.html'):
                d = Doc(text)
                self.assertEqual(sum(1 for t, _a in d.els if t == 'h1'), 1, path)
                self.assertEqual(sum(1 for t, _a in d.els if t == 'title'), 1, path)
                self.assertTrue(any(t == 'meta' and a.get('name') == 'description' and a.get('content') for t, a in d.els), path)


class Theme(Base):
    """The USA theme: a fourth appearance a reader can post from the bar of every page."""

    def test_every_page_offers_it_in_the_bar_and_in_the_colophon(self):
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            flips = re.findall(r'<button[^>]*data-theme-flip="usa"[^>]*>(.*?)</button>', text, flags=re.S)
            self.assertEqual(len(flips), 1, f'{path}: one button in the bar posts the theme')
            self.assertIn(self.rec['theme']['label'], norm(flips[0]), path)
            self.assertEqual(len(re.findall(r'data-theme-set="usa"', text)), 1, f'{path}: the colophon offers it beside light and dark')

    def test_each_photograph_is_held_sized_credited_and_named(self):
        held = set(tracked(ROOT))
        photos = self.rec['theme']['photos']
        self.assertEqual([p['id'] for p in photos], ['f22', 'f35'])
        for path, text in self.out.items():
            if not path.endswith('.html'):
                continue
            imgs = {a['src'].split('?')[0]: a for t, a in Doc(text).els if t == 'img' and a.get('src', '').startswith('/v4/usa/')}
            for p in photos:
                a = imgs.get(f"/v4/usa/{p['id']}-800.webp")
                self.assertTrue(a, f"{path}: {p['id']} is not on the page")
                self.assertEqual(a.get('alt'), p['alt'], path)
                self.assertEqual(a.get('loading'), 'lazy', f'{path}: a reader who never posts the theme must not download it')
                for name in (f"v4/usa/{p['id']}.webp", f"v4/usa/{p['id']}-800.webp"):
                    self.assertIn(name, held, f'{name} is not in the repo, so it would not ship')
                # a lossy WebP says its size at bytes 26 to 29
                data = (ROOT / 'v4' / 'usa' / f"{p['id']}.webp").read_bytes()
                self.assertEqual(data[12:16], b'VP8 ', 'CONTROL: a simple lossy WebP')
                w, h = int.from_bytes(data[26:28], 'little') & 0x3fff, int.from_bytes(data[28:30], 'little') & 0x3fff
                self.assertEqual((a.get('width'), a.get('height')), (str(w), str(h)), f"{path}: {p['id']}")
                self.assertIn(html.escape(p['credit']), text, path)
                self.assertIn(f'href="{html.escape(p["source"])}"', text, path)
            words = norm(text)
            self.assertIn(self.rec['theme']['notice'], words, f'{path}: the imagery notice is printed word for word')
            self.assertIn(self.rec['theme']['note'], words, path)

    def test_the_theme_shows_aircraft_and_says_nothing_about_the_author(self):
        said = json.dumps(self.rec['theme'], ensure_ascii=False)
        self.assertNotRegex(said, r'(?i)pilot|airman|crew|officer', 'aircraft only: no person is named or described')
        self.assertNotRegex(said, r'<[a-z/]')


class Essay(Base):
    def test_the_paper_is_word_for_word(self):
        src = json.loads((ROOT / 'content' / 'two-stories.json').read_text(encoding='utf-8'))
        page = squash(self.out['two-stories/index.html'])
        self.assertIn(squash(src['title']), page)
        self.assertIn(squash(src['standfirst']), page)
        n = 0
        for part in src['parts']:
            for para in part.get('paras', []):
                self.assertIn(squash(para['html']), page, para['html'][:60])
                n += 1
            for row in part.get('rows', []):
                for k in ('row', 'first', 'second'):
                    self.assertIn(squash(row[k]), page)
        self.assertEqual(n, 31, 'the paper has thirty-one paragraphs')
        self.assertIn(squash(src['note']), page)

    def test_paragraphs_are_numbered_as_the_paper_cites_them(self):
        page = self.out['two-stories/index.html']
        for mark in ('I.1', 'I.12', 'I.14', 'II.1', 'II.8'):
            self.assertRegex(page, r'>\s*' + re.escape(mark) + r'\s*<', f'paragraph {mark} is cited by number')


class Lab(Base):
    def test_the_course_page_keeps_what_its_script_reads(self):
        page = self.out['lab/index.html']
        d = Doc(page)
        self.assertIn('lab-steps', d.data, 'the table of step numbers the mixed review links with')
        steps = json.loads(d.data['lab-steps'])
        for a in self.site['lab']['apps']:
            self.assertIn(a['slug'], steps)
        self.assertTrue(any('data-lab-resume' in a for _t, a in d.els))
        self.assertTrue(any('data-lab-review' in a for _t, a in d.els))
        self.assertTrue(any('data-lab-review-start' in a for _t, a in d.els))
        rows = [a for t, a in d.els if 'data-slug' in a]
        for a in rows:
            self.assertRegex(a.get('data-steps', ''), r'^\d+$')
            self.assertRegex(a.get('data-quiz', ''), r'^\d+$')
        self.assertEqual(len(rows), len(self.site['lab']['apps']))
        self.assertIn('/lab/kit/course.js', page)

    def test_every_lesson_has_a_number_and_a_dot_placed_or_not(self):
        page = self.out['lab/index.html']
        d = Doc(page)
        numbers = re.findall(r'<span class="no" aria-hidden="true">([^<]*)</span>', page)
        self.assertEqual(len(numbers), len(self.site['lab']['mods']) + len(self.site['lab']['extra']))
        self.assertTrue(all(re.match(r'^\d\d$', n) for n in numbers), f'a lesson number the course script cannot read: {numbers}')
        self.assertEqual(sorted(int(n) for n in numbers), list(range(1, len(numbers) + 1)), 'the lessons are numbered from 1 with none skipped or shared')
        dots = set(d.attr('data-lab-dot'))
        for a in self.site['lab']['apps']:
            self.assertIn(a['slug'], dots, f"{a['slug']} has no dot on the course map")

    def test_units_keep_the_addresses_lessons_link_to(self):
        ids = set(Doc(self.out['lab/index.html']).attr('id'))
        for u in self.site['lab']['units']:
            self.assertIn(u['id'], ids, f"lesson pages link /lab/#{u['id']}")

    def test_the_course_says_it_is_not_for_clinical_use(self):
        self.assertIn('not for clinical use', self.out['lab/index.html'])
        self.assertIn('not for clinical use', self.home)


class Tree(Base):
    def test_the_tree_is_built(self):
        for path, text in self.out.items():
            on_disk = (ROOT / path)
            self.assertTrue(on_disk.is_file(), f'{path} is not written: run tools/build.py')
            self.assertEqual(on_disk.read_text(encoding='utf-8'), text, f'{path} is stale: run tools/build.py')

    def test_building_twice_changes_nothing(self):
        again = build.pages(build.load(ROOT))
        self.assertEqual(again, self.out)

    def test_another_process_builds_the_same_pages(self):
        for seed in ('0', '1', '4242'):
            run = subprocess.run([sys.executable, str(ROOT / 'tools' / 'build.py'), '--check'], capture_output=True, text=True,
                                 env={'PATH': os.environ.get('PATH', ''), 'PYTHONHASHSEED': seed, 'PYTHONDONTWRITEBYTECODE': '1'})
            self.assertEqual((run.returncode, run.stdout, run.stderr), (0, '', ''), f'hash seed {seed}')

    def test_the_check_runs_with_nothing_but_the_builder(self):
        """tools/stage.sh runs it as python3 -I: no file left beside the builder is imported."""
        run = subprocess.run([sys.executable, '-I', str(ROOT / 'tools' / 'build.py'), '--check'], capture_output=True, text=True)
        self.assertEqual((run.returncode, run.stdout, run.stderr), (0, '', ''))
        stage = [line for line in (ROOT / 'tools' / 'stage.sh').read_text(encoding='utf-8').splitlines() if 'python3' in line and not line.lstrip().startswith('#')]
        self.assertTrue(stage and all('python3 -I ' in line for line in stage), f'tools/stage.sh runs python3 without -I: {stage}')
        wrapper = [line for line in (ROOT / 'tools' / 'lab-index.mjs').read_text(encoding='utf-8').splitlines() if "spawnSync('python3'" in line]
        self.assertTrue(wrapper and all("['-I'," in line for line in wrapper), f'tools/lab-index.mjs runs python3 without -I: {wrapper}')

    def test_the_sitemap_lists_the_edition_and_nothing_retired(self):
        sm = self.out['sitemap.xml']
        for path in ('/', '/record/', '/two-stories/', '/lab/'):
            self.assertIn(f'<loc>https://seansooch.dev{path}</loc>', sm)
        for a in self.site['lab']['apps']:
            self.assertIn(f"<loc>https://seansooch.dev/lab/{a['slug']}/</loc>", sm)
        self.assertNotIn('/designs/', sm)
        self.assertEqual(len(re.findall(r'<loc>', sm)), len(set(re.findall(r'<loc>(.*?)</loc>', sm))))

    def test_the_sitemap_dates_each_page_by_the_newest_day_the_record_gives_for_it(self):
        """Google re-crawls a page sooner when its <lastmod> moves, so a redesign is not shown under the old title
        for weeks. A date is only ever one the record or the ledger states; a page built elsewhere gets none."""
        sm = self.out['sitemap.xml']
        got = dict(re.findall(r'<loc>https://seansooch\.dev(\S*?)</loc>(?:<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>)?', sm))
        r, ed = self.rec, self.rec['edition']
        home = max([ed['issued'], ed['counted'], r['guidance']['published']]
                   + [d for t in r['guidance']['timeline'] for d in (t['published'], t['checked'])]
                   + [e['date'] for w in r['works'] for e in w.get('editions', [])])
        lessons = {a['slug']: max([a['date']] + [v['date'] for v in a.get('revisions', []) if isinstance(v, dict) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(v.get('date')))])
                   for a in self.site['lab']['apps']}
        want = {'/': home, '/record/': max(ed['issued'], ed['counted']), '/two-stories/': ed['issued'], '/lab/': max(lessons.values())}
        want |= {f'/lab/{s}/': d for s, d in lessons.items()}
        self.assertEqual({p: d for p, d in got.items() if d}, want)
        # The claim is that a work's new edition moves the home page's date. It used to be pinned to one day's
        # record ('2026-11-22'), which failed the next time any work shipped an edition. Checked against what the
        # builder wrote instead (not against `home`, which this test worked out itself): the page is never dated
        # before the newest edition of a work it shows. It holds on a day the volume's own dates are newer too.
        newest = max(e['date'] for w in r['works'] for e in w.get('editions', []))
        self.assertGreaterEqual(got['/'], newest, 'the home page is dated before the newest edition of a work it shows')
        self.assertEqual(sm.count('<changefreq>'), 0, 'Google ignores changefreq and priority; lastmod is the signal')
        self.assertEqual(sm.count('<priority>'), 0)

    def test_retired_addresses_are_sent_to_the_archive(self):
        rules = [line.split() for line in (ROOT / '_redirects').read_text(encoding='utf-8').splitlines() if line.strip() and not line.startswith('#')]
        archive = next(v['href'] for v in self.rec['volumes'] if v['vol'] == 'Vol. 03')
        for view in ('fable', 'opus', 'composer', 'grok'):
            self.assertIn([f'/designs/{view}/*', f'{archive}designs/{view}/:splat', '301'], rules)
        # Field Notes moved to the situation as its Newsletter on 2026-11-14: every address it had answers there, day for day.
        self.assertIn(['/notes', 'https://situation.seansooch.dev/newsletter/', '301'], rules)
        self.assertIn(['/notes/*', 'https://situation.seansooch.dev/newsletter/:splat', '301'], rules)
        self.assertFalse((ROOT / 'notes').exists(), 'nothing is served under /notes/ here any more')
        self.assertLessEqual(sum(1 for r in rules if '*' in r[0] or ':' in r[0]), 100, 'Pages allows 100 dynamic redirects')
        self.assertLessEqual(len(rules), 2000)

    def test_nothing_on_the_site_still_asks_for_the_switcher(self):
        for path, text in self.out.items():
            self.assertNotIn('design-switcher', text, path)
            self.assertNotIn('lab-course.js', text, path)

    def test_with_no_plates_every_page_still_builds(self):
        """A work with no capture gets its name set in type; a page with no share image names none."""
        bare = build.load(ROOT)
        bare['plates'] = {}
        out = build.pages(bare)
        for path, text in out.items():
            self.assertNotIn('/plates/', text, path)
        self.assertEqual(out['index.html'].count('plate-type'), len(self.rec['works']), 'every work has its name set in type where its plate would be')
        self.assertEqual(out['record/index.html'].count('plate-type'), sum(1 for v in self.rec['volumes'] if v['status'] != 'awaiting') + sum(len(v.get('views', [])) for v in self.rec['volumes']),
                         'every volume and view has its name set in type where its plate would be')
        self.assertNotIn('data-view=', out['index.html'], 'with nothing to set side by side, the switch is still offered')
        self.assertNotIn('og:image', out['index.html'])

    def test_plates_exist_at_both_sizes(self):
        for src in set(re.findall(r'(?:src|srcset)="([^"]+)"', self.home)):
            for part in src.split(','):
                p = part.strip().split(' ')[0].partition('?v=')[0]
                if p.startswith('/plates/'):
                    self.assertTrue((ROOT / p.lstrip('/')).is_file(), f'{p} is not captured: run tools/plates.mjs')


class Ledger(Base):
    """The ledger, the syllabus and each lesson's plan are written outside this repo, and so is whatever a careless
    sync leaves behind. These tests build in a copy of the tree."""

    def tree(self):
        """A copy of the repo a test can change and build in: links for what is only read; real files for the record,
        the ledger, the syllabus and the five pages the builder writes (a write through a link lands in the real tree)."""
        tmp = Path(tempfile.mkdtemp(prefix='edition-test-'))
        self.addCleanup(shutil.rmtree, tmp)
        real = {'content/record.json', 'content/two-stories.json', 'lab/apps.json', 'lab/syllabus.json', *self.out}
        folders = {str(Path(p).parent) for p in real} - {'.'}

        def fill(src, dst, rel):
            for p in src.iterdir():
                name = rel + p.name
                if name in folders:
                    (dst / p.name).mkdir()
                    fill(p, dst / p.name, name + '/')
                elif name in real:
                    shutil.copyfile(p, dst / p.name)
                elif name not in ('.git', 'tools/__pycache__'):
                    (dst / p.name).symlink_to(p)
        fill(ROOT, tmp, '')
        self.assertFalse([p for p in self.out if (tmp / p).is_symlink()], 'a page the builder writes is a link into the real tree')
        self.run_build(tmp)     # the copy is as this builder builds it, whatever the tree it was copied from
        return tmp

    def edit(self, path, change):
        data = json.loads(path.read_text(encoding='utf-8'))
        change(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    def ship(self, tmp, slug='a-new-lesson', plan=None, **entry):
        """What the pipeline does: a lesson's folder (a real lesson's page, and a plan of its own if one is given)
        and its line in the ledger."""
        model = ROOT / 'lab' / self.site['lab']['apps'][0]['slug']
        if plan is None:
            (tmp / 'lab' / slug).symlink_to(model)
        else:
            (tmp / 'lab' / slug).mkdir()
            (tmp / 'lab' / slug / 'index.html').symlink_to(model / 'index.html')
            (tmp / 'lab' / slug / 'plan.json').write_text(json.dumps(plan), encoding='utf-8')
        line = {'slug': slug, 'title': 'A new lesson', 'date': '2026-12-01', 'description': 'What it teaches.', **entry}
        self.edit(tmp / 'lab' / 'apps.json', lambda apps: apps.append(line))

    def run_build(self, tmp, *flags):
        with contextlib.redirect_stdout(io.StringIO()) as said:
            code = build.main(list(flags), tmp)
        return code, said.getvalue()

    def test_a_lesson_shipped_tomorrow_changes_only_the_pages_that_list_lessons(self):
        tmp = self.tree()
        self.ship(tmp)
        site = build.load(tmp)
        self.assertEqual(site['lab']['n_lessons'], self.site['lab']['n_lessons'] + 1, 'CONTROL: the moved ledger was read')
        out = build.pages(site)
        self.assertEqual(sorted(p for p in out if out[p] != self.out[p]), sorted(build.LAB_PAGES + (build.LEDGER_FED,)))

    def test_a_lessons_own_deploy_leaves_the_home_page_behind_and_nothing_stale(self):
        tmp = self.tree()
        self.assertEqual(self.run_build(tmp, '--check'), (0, ''), 'CONTROL: the copy starts as built')
        self.ship(tmp)
        code, said = self.run_build(tmp, '--check')
        self.assertEqual(code, 1)
        for line in ('stale: lab/index.html', 'stale: sitemap.xml', 'behind: index.html', 'run: python3 tools/build.py --lab, then commit'):
            self.assertIn(line, said)
        self.assertNotIn('stale: index.html', said)
        self.assertEqual(self.run_build(tmp, '--lab')[0], 0)                 # what node tools/lab-index.mjs runs
        self.assertEqual((tmp / 'index.html').read_text(encoding='utf-8'), self.home, 'the Lab\'s build wrote the home page')
        code, said = self.run_build(tmp, '--check')
        self.assertEqual(code, 0, said)
        self.assertEqual([line.split(':')[0] for line in said.splitlines()], ['behind'], said)
        self.assertEqual(self.run_build(tmp)[0], 0)                          # the next full build catches the home page up
        self.assertEqual(self.run_build(tmp, '--check'), (0, ''))
        self.assertIn('/lab/a-new-lesson/', (tmp / 'index.html').read_text(encoding='utf-8'))

    def test_a_withdrawn_or_renamed_lesson_makes_the_home_page_stale_not_behind(self):
        gone = self.site['lab']['apps'][-1]['slug']
        self.assertIn(f'data-lesson="{gone}"', self.home, 'CONTROL: the home page lists the lesson about to change')
        changes = {'withdrawn': lambda apps: apps.pop(), 'renamed': lambda apps: apps[-1].update(title=apps[-1]['title'] + ', revised')}
        for what, change in changes.items():
            with self.subTest(what):
                tmp = self.tree()
                self.edit(tmp / 'lab' / 'apps.json', change)
                self.run_build(tmp, '--lab')
                code, said = self.run_build(tmp, '--check')
                self.assertEqual(code, 1, f'a home page that lists a {what} lesson passed')
                self.assertIn('stale: index.html', said)
                self.assertIn('run: python3 tools/build.py, then commit', said)
                self.run_build(tmp)
                self.assertEqual(self.run_build(tmp, '--check'), (0, ''))
        tmp = self.tree()          # both at once: a lesson ships and another is renamed
        self.ship(tmp)
        self.edit(tmp / 'lab' / 'apps.json', lambda apps: apps[0].update(title=apps[0]['title'] + ', revised'))
        self.run_build(tmp, '--lab')
        self.assertIn('stale: index.html', self.run_build(tmp, '--check')[1], 'a renamed lesson hid behind a new one')

    def test_a_revised_lesson_or_a_new_module_does_not_touch_the_home_page(self):
        """What the pipeline does most days after shipping: it revises a lesson's plan, or the syllabus gains modules
        that are not built yet. Neither is on the home page, so the Lab's build is all it takes."""
        slug = self.site['lab']['apps'][0]['slug']

        def revise(tmp):
            (tmp / 'lab' / slug).unlink()
            (tmp / 'lab' / slug).mkdir()
            for f in (ROOT / 'lab' / slug).iterdir():
                if f.name != 'plan.json':
                    (tmp / 'lab' / slug / f.name).symlink_to(f)
            plan = json.loads((ROOT / 'lab' / slug / 'plan.json').read_text(encoding='utf-8'))
            plan['minutes'] += 45
            plan['quiz'] = plan['quiz'] + plan['quiz'][:1]
            (tmp / 'lab' / slug / 'plan.json').write_text(json.dumps(plan), encoding='utf-8')

        def plan_more(tmp):
            def add(syl):
                unit = syl['units'][1]['id']
                at = max(i for i, m in enumerate(syl['modules']) if m.get('unit') == unit) + 1
                syl['modules'].insert(at, {'slug': 'a-lesson-to-come', 'title': 'A lesson to come', 'description': 'Planned.', 'unit': unit})
                syl['units'].append({'id': 'a-unit-to-come', 'title': 'A unit to come', 'summary': 'Planned.'})
                syl['modules'].append({'slug': 'another-to-come', 'title': 'Another to come', 'description': 'Planned.', 'unit': 'a-unit-to-come'})
            self.edit(tmp / 'lab' / 'syllabus.json', add)

        for what, change in (('a revised plan', revise), ('modules and a unit added to the syllabus', plan_more)):
            with self.subTest(what):
                tmp = self.tree()
                change(tmp)
                code, said = self.run_build(tmp, '--check')
                self.assertEqual(code, 1, f'CONTROL: {what} changes the course page')
                self.assertIn('stale: lab/index.html', said)
                self.assertNotIn('index.html (the record', said)
                self.assertNotIn('behind', said, f'{what} is on the home page')
                self.run_build(tmp, '--lab')
                self.assertEqual(self.run_build(tmp, '--check'), (0, ''), f'after {what}, the Lab\'s build is not all it takes')
                self.assertEqual((tmp / 'index.html').read_text(encoding='utf-8'), self.home)

    def test_an_edited_record_cannot_be_passed_by_the_labs_build(self):
        for with_a_new_lesson in (False, True):
            with self.subTest(with_a_new_lesson=with_a_new_lesson):
                tmp = self.tree()
                if with_a_new_lesson:
                    self.ship(tmp)
                self.edit(tmp / 'content' / 'record.json', lambda r: r['works'][0].update(tech=r['works'][0]['tech'] + ' One more sentence.'))
                code, said = self.run_build(tmp, '--check')
                self.assertEqual(code, 1)
                self.assertIn('stale: index.html', said)
                self.assertIn('run: python3 tools/build.py, then commit', said)
                self.run_build(tmp, '--lab')
                code, said = self.run_build(tmp, '--check')
                self.assertEqual(code, 1, 'the Lab\'s build passed a record the home page was not built from')
                self.assertIn('stale: index.html', said)
                self.assertNotIn('behind', said)
                self.run_build(tmp)
                self.assertEqual(self.run_build(tmp, '--check'), (0, ''))

    def test_an_edited_sheet_cannot_be_passed_by_the_labs_build(self):
        tmp = self.tree()
        (tmp / 'v4').unlink()
        shutil.copytree(ROOT / 'v4', tmp / 'v4')
        (tmp / 'v4' / 'site.css').write_text('/* a sheet from another edition */\n.lesson{color:red}\n', encoding='utf-8')
        self.assertEqual(self.run_build(tmp, '--check')[0], 1)
        self.run_build(tmp, '--lab')
        code, said = self.run_build(tmp, '--check')
        self.assertEqual(code, 1, 'the Lab\'s build passed a sheet the pages were not built for')
        for page in ('index.html', 'two-stories/index.html', '404.html'):
            self.assertIn(f'stale: {page}', said)
        self.assertIn('run: python3 tools/build.py, then commit', said)

    def test_the_course_pages_sheet_is_the_editions_not_the_labs(self):
        """A lesson's own deploy may change only lab/, and the pipeline has synced an older lab/lab.css over this
        repo's before: so the sheet lives in v4/, where such a sync cannot reach it and the audit would see it."""
        self.assertFalse((ROOT / 'lab' / 'lab.css').exists())
        self.assertIn('href="/v4/lab.css?v=', self.out['lab/index.html'])
        self.assertNotIn('/lab/lab.css', self.out['lab/index.html'])
        check = (ROOT / 'tools' / 'lab-check.mjs').read_text(encoding='utf-8')
        self.assertIn("exists('lab/lab.css')", check, 'the Lab\'s own check no longer names a lab/lab.css that comes back')

    def test_a_page_edited_by_hand_is_stale(self):
        for page in ('index.html', 'record/index.html', 'two-stories/index.html', '404.html', 'lab/index.html'):
            with self.subTest(page=page):
                tmp = self.tree()
                text = (tmp / page).read_text(encoding='utf-8')
                (tmp / page).write_text(text.replace('</h1>', '!</h1>', 1), encoding='utf-8')
                code, said = self.run_build(tmp, '--check')
                self.assertEqual(code, 1, f'{page} was edited by hand and passed')
                self.assertIn(f'stale: {page}', said)
        tmp = self.tree()
        self.ship(tmp)
        self.run_build(tmp, '--lab')
        text = (tmp / 'index.html').read_text(encoding='utf-8')
        (tmp / 'index.html').write_text(text.replace('</h1>', '!</h1>', 1), encoding='utf-8')
        code, said = self.run_build(tmp, '--check')
        self.assertEqual(code, 1, 'a home page edited by hand passed as only behind the ledger')
        self.assertIn('stale: index.html', said)
        self.assertNotIn('behind', said)

    def test_a_course_page_from_somewhere_else_is_put_right_by_the_labs_build(self):
        tmp = self.tree()
        (tmp / 'lab' / 'index.html').write_text('<!doctype html><title>The Lab</title><p>An older course page.</p>', encoding='utf-8')
        code, said = self.run_build(tmp, '--check')
        self.assertEqual(code, 1)
        self.assertIn('run: python3 tools/build.py --lab, then commit', said)
        self.run_build(tmp, '--lab')
        self.assertEqual(self.run_build(tmp, '--check'), (0, ''))

    def test_an_entry_that_is_not_a_lesson_is_left_out(self):
        tmp = self.tree()
        for slug in ('no-such-day', 'no-date', 'no-title', 'a-real-one'):
            (tmp / 'lab' / slug).symlink_to(ROOT / 'lab' / self.site['lab']['apps'][0]['slug'])
        self.edit(tmp / 'lab' / 'apps.json', lambda apps: apps.extend([
            'a string', None, 7,
            {'slug': '../evil', 'title': 'Bad slug', 'date': '2026-12-01'},
            {'slug': 'no-such-day', 'title': 'No such day', 'date': '2026-02-31'},
            {'slug': 'no-date', 'title': 'No date', 'date': 'soon'},
            {'slug': 'no-title', 'title': 5, 'date': '2026-12-01'},
            {'slug': 'no-folder', 'title': 'No folder', 'date': '2026-12-01'},
            {'slug': 'a-real-one', 'title': 'A real one', 'date': '2026-12-01'}]))
        lab = build.read_lab(tmp)
        self.assertEqual([a['slug'] for a in lab['apps']], [a['slug'] for a in self.site['lab']['apps']] + ['a-real-one'])

    def test_a_lesson_the_syllabus_has_not_placed_is_numbered_after_the_ones_it_has(self):
        tmp = self.tree()
        self.ship(tmp, 'zz-newest', date='2026-12-02')
        self.ship(tmp, 'aa-newer', date='2026-12-01')
        site = build.load(tmp)
        last = len(site['lab']['mods']) + len(self.site['lab']['extra'])
        self.assertEqual((site['lab']['number']['aa-newer'], site['lab']['number']['zz-newest']), (last + 1, last + 2), 'oldest first')
        page = build.pages(site)['lab/index.html']
        for slug, n in (('aa-newer', last + 1), ('zz-newest', last + 2)):
            self.assertRegex(page, rf'<li class="lesson" data-slug="{slug}"[^>]*>\s*<span class="no" aria-hidden="true">{n:02d}</span>')
            self.assertIn(f'data-lab-dot="{slug}" title="Lesson {n}: ', page)
        self.assertIn(site['record']['text']['lab_newest'], page, 'an unplaced lesson is listed without the line that introduces it')

    def test_a_plan_that_is_not_what_it_should_be_puts_no_markup_on_a_page(self):
        evil = '<img src=x onerror=alert(1)>'
        plans = [{'minutes': evil}, {'minutes': -5}, {'minutes': 5.5}, {'minutes': 100000}, {'minutes': True}, {'minutes': None},
                 ['not', 'a', 'plan'], {'quiz': evil, 'checks': evil, 'objectives': evil, 'prerequisites': 7},
                 {'objectives': [evil, 5, None], 'prerequisites': [evil, 5], 'quiz': {}, 'checks': []}]
        for plan in plans:
            with self.subTest(plan=plan):
                tmp = self.tree()
                self.ship(tmp, plan=plan)
                site = build.load(tmp)
                read = site['lab']['facts']['a-new-lesson']['plan']
                self.assertEqual(read['minutes'], 0)
                self.assertEqual(site['lab']['minutes'], self.site['lab']['minutes'])
                self.assertEqual((type(read['quiz']), type(read['checks']), type(read['objectives']), type(read['prerequisites'])), (list, dict, list, list))
                for path, text in build.pages(site).items():
                    self.assertNotIn('<img src=x', text, path)

    def test_a_lesson_with_no_plan_is_a_lesson_with_an_empty_one(self):
        tmp = self.tree()
        (tmp / 'lab' / 'no-plan').mkdir()
        (tmp / 'lab' / 'no-plan' / 'index.html').symlink_to(ROOT / 'lab' / self.site['lab']['apps'][0]['slug'] / 'index.html')
        self.edit(tmp / 'lab' / 'apps.json', lambda apps: apps.append({'slug': 'no-plan', 'title': 'No plan', 'date': '2026-12-01'}))
        site = build.load(tmp)
        self.assertEqual(site['lab']['facts']['no-plan']['plan'], {'minutes': 0, 'quiz': [], 'checks': {}, 'objectives': [], 'prerequisites': []})
        self.assertIn('data-slug="no-plan"', build.pages(site)['lab/index.html'])

    def test_a_unit_id_that_cannot_be_an_address_stops_the_build(self):
        for bad in ('a b', '"><script>', 'review', 'course', 'more', '', 'unit\n'):
            with self.subTest(unit=bad):
                tmp = self.tree()
                self.edit(tmp / 'lab' / 'syllabus.json', lambda syl: syl['units'][0].update(id=bad))
                with self.assertRaises(ValueError):
                    build.read_lab(tmp)

    def test_a_title_or_a_summary_that_is_not_text_becomes_no_markup(self):
        tmp = self.tree()
        self.edit(tmp / 'lab' / 'syllabus.json', lambda syl: (syl['units'][0].update(title=['<b>x</b>'], summary='<i>y</i>'), syl['modules'][0].update(title=5, description=['<u>z</u>'])))
        page = build.pages(build.load(tmp))['lab/index.html']
        for bad in ('<b>x</b>', '<i>y</i>', '<u>z</u>'):
            self.assertNotIn(bad, page)


class Hostile(unittest.TestCase):
    def test_a_record_that_cannot_be_set_safely_stops_the_build(self):
        site = build.load(ROOT)

        def broken(change):
            parts = copy.deepcopy((site['record'], site['essay'], site['plates']))
            change(*parts)
            return parts

        def kept(r):
            return next(e for w in r['works'] for e in w['editions'][:-1] if e.get('url'))

        build.validate(*broken(lambda r, e, p: None))    # CONTROL: the record as it stands can be built
        cases = {
            'a work id that is not plain': lambda r, e, p: r['works'][0].update(id='x" onclick="1'),
            'a work id that takes one of the page anchors': lambda r, e, p: r['works'][0].update(id='work'),
            'two works with one id': lambda r, e, p: r['works'][1].update(id=r['works'][0]['id']),
            'a work in a world the record does not have': lambda r, e, p: r['works'][0].update(world='x'),
            'a world whose id is markup': lambda r, e, p: r['worlds'][0].update(id='m"><b>'),
            'a world whose slug has a space': lambda r, e, p: r['worlds'][0].update(slug='the med'),
            'a work that is neither major nor minor': lambda r, e, p: r['works'][0].update(tier='huge'),
            'an edition numbered in words': lambda r, e, p: kept(r).update(n='1'),
            'a work whose address is not https': lambda r, e, p: r['works'][0].update(url='javascript:alert(1)'),
            'a kept edition whose address is not https': lambda r, e, p: kept(r).update(url='http://example.com/'),
            'editions out of order': lambda r, e, p: next(w for w in r['works'] if len(w['editions']) > 1)['editions'].reverse(),
            'a film from another host': lambda r, e, p: r['films'][0].update(src='https://example.com/x.mp4'),
            'a film that climbs out of /videos/': lambda r, e, p: r['films'][0].update(src='/videos/../x.mp4'),
            'a poster that is not a jpg under /videos/': lambda r, e, p: r['films'][0].update(poster='/videos/x.jpg" onerror="1'),
            'a film id with a space': lambda r, e, p: r['films'][0].update(id='a b'),
            'a film that takes a work anchor': lambda r, e, p: r['films'][0].update(id=r['works'][0]['id']),
            'a paper link with a script scheme': lambda r, e, p: r['papers'][0]['links'][0].update(href='javascript:alert(1)'),
            'a paper link to another host by two slashes': lambda r, e, p: r['papers'][0]['links'][0].update(href='//example.com/x'),
            'a paper id with a quote': lambda r, e, p: r['papers'][0].update(id='a"b'),
            'a view whose path climbs': lambda r, e, p: next(v for v in r['volumes'] if v.get('views'))['views'][0].update(path='../x/'),
            'a view with no letter': lambda r, e, p: next(v for v in r['volumes'] if v.get('views'))['views'][0].update(siglum='a"'),
            'a retired volume with no archive': lambda r, e, p: next(v for v in r['volumes'] if v['status'] == 'retired').update(href=''),
            'a volume with no number': lambda r, e, p: r['volumes'][0].update(vol='Vol.'),
            'a plate whose name climbs': lambda r, e, p: p.update({'../x': {'w': 1, 'h': 1}}),
            'a plate whose size is not a number': lambda r, e, p: p[next(iter(p))].update(w='1" onload="x'),
            'a part of the paper whose id has a space': lambda r, e, p: e['parts'][0].update(id='a b'),
            'a part of the paper whose mark is markup': lambda r, e, p: next(x for x in e['parts'] if 'rows' not in x).update(mark='<b>'),
            'an edition dated with markup': lambda r, e, p: kept(r).update(date='<script>'),
            'an edition dated on a day that does not exist': lambda r, e, p: kept(r).update(date='2026-02-31'),
            'an edition issued on something that is not a day': lambda r, e, p: r['edition'].update(issued='EVIL-11-09'),
            'a count dated in words': lambda r, e, p: r['edition'].update(counted='9 November 2026'),
            'a first deploy that is not a month': lambda r, e, p: r['site'].update(first_deploy='<b>-04'),
            'a work also in a world that is markup': lambda r, e, p: r['works'][0].update(also=['x" onmouseover="alert(1)']),
            'a plate taken from a file on this machine': lambda r, e, p: r['works'][0].update(plate_url='file:///Users/someone/'),
            'a plate taken from another host by two slashes': lambda r, e, p: r['works'][0].update(plate_url='//example.com/'),
            'a plate scrolled to something that is not an id': lambda r, e, p: r['works'][0].update(plate_scroll='body *'),
            'a work whose address has a space in it': lambda r, e, p: r['works'][0].update(url='https://example.com/a b'),
            'a volume whose address is a script': lambda r, e, p: r['volumes'][0].update(href='javascript:alert(1)'),
            'a paper link to another host by a backslash': lambda r, e, p: r['papers'][0]['links'][0].update(href='/\\example.com/x'),
            'a paper link to another host by a tab': lambda r, e, p: r['papers'][0]['links'][0].update(href='/\t/example.com/x'),
            'a plate with no day': lambda r, e, p: p[next(iter(p))].pop('taken'),
            'a work id that ends in a line break': lambda r, e, p: r['works'][0].update(id=r['works'][0]['id'] + '\n'),
            'a work address that ends in a line break': lambda r, e, p: r['works'][0].update(url=r['works'][0]['url'] + '\n'),
            'a film that ends in a line break': lambda r, e, p: r['films'][0].update(src=r['films'][0]['src'] + '\n'),
            'an edition dated with a line break': lambda r, e, p: kept(r).update(date='2026\n'),
            'a paper path that ends in a line break': lambda r, e, p: r['papers'][0]['links'][0].update(href='/two-stories/\n'),
            'a work with no stats': lambda r, e, p: r['works'][0].pop('stats'),
            'a plate taken on markup': lambda r, e, p: p[next(iter(p))].update(taken='<b>'),
        }
        for name, change in cases.items():
            with self.subTest(name):
                with self.assertRaises(ValueError):
                    build.validate(*broken(change))

    def test_a_link_in_the_paper_stays_on_this_site_or_is_https(self):
        for href in ('javascript:alert(1)', '//example.com/x', '/\\example.com/x', '/\t/example.com/x', '/\n/example.com/x', 'http://example.com/',
                     'data:text/html,x', 'https://example.com/a b', '#a b'):
            self.assertEqual(build.essay_inline(f'<a href="{href}">x</a>'), '<a>x</a>', href)
        self.assertIn('href="https://example.com/"', build.essay_inline('<a href="https://example.com/">x</a>'))
        self.assertIn('href="/two-stories/"', build.essay_inline('<a href="/two-stories/">x</a>'))
        self.assertIn('href="#part2"', build.essay_inline('<a href="#part2">x</a>'))

    def test_nothing_can_take_the_id_of_one_of_the_pages_own_parts(self):
        """The page's script finds its data by id. A film called index-data would be found in its place."""
        site = build.load(ROOT)
        build.pages(site)                                           # CONTROL: the record as it stands builds
        slipped = build.load(ROOT)
        slipped['record']['films'][0]['id'] = 'index-data'
        build.validate(slipped['record'], slipped['essay'], slipped['plates'])     # CONTROL: this one is a slug like any other; only the page knows
        for group, own in (('films', 'index-data'), ('films', 'palette-list'), ('papers', 'film-dialog'), ('films', 'probes')):
            with self.subTest(group=group, id=own):
                broken = build.load(ROOT)
                broken['record'][group][0]['id'] = own
                with self.assertRaises(ValueError):       # some are refused as anchors the page keeps; the rest as a second id
                    build.validate(broken['record'], broken['essay'], broken['plates'])
                    build.pages(broken)
        for own in ('lab-steps', 'index-data', 'palette-q'):
            with self.subTest(unit=own):
                broken = build.load(ROOT)
                broken['lab']['groups'][0]['unit']['id'] = own
                with self.assertRaises(ValueError):
                    build.pages(broken)

    def test_the_builder_imports_nothing_left_beside_it(self):
        """Run as the refusal prints it (python3 tools/build.py, no -I), a file planted in tools/ is still not imported."""
        tmp = Path(tempfile.mkdtemp(prefix='edition-test-'))
        self.addCleanup(shutil.rmtree, tmp)
        for p in ROOT.iterdir():
            if p.name == 'tools':
                shutil.copytree(p, tmp / 'tools', ignore=shutil.ignore_patterns('__pycache__'))
            elif p.name != '.git':
                (tmp / p.name).symlink_to(p)
        marker = tmp / 'planted-ran'
        (tmp / 'tools' / 'html.py').write_text(f"open({str(marker)!r}, 'w').write('ran')\nraise SystemExit(9)\n", encoding='utf-8')
        env = {'PATH': os.environ.get('PATH', ''), 'PYTHONDONTWRITEBYTECODE': '1'}
        plant = subprocess.run([sys.executable, '-c', 'import html'], cwd=tmp / 'tools', capture_output=True, text=True, env=env)
        self.assertTrue(marker.exists() and plant.returncode == 9, 'CONTROL: the planted file runs when Python is allowed to find it')
        marker.unlink()
        run = subprocess.run([sys.executable, str(tmp / 'tools' / 'build.py'), '--check'], capture_output=True, text=True, env=env)
        self.assertFalse(marker.exists(), 'a file left beside the builder was imported in place of the standard library')
        self.assertEqual((run.returncode, run.stdout, run.stderr), (0, '', ''))

    def test_a_date_is_a_date_or_the_build_stops(self):
        self.assertEqual((build.day('2026'), build.day('2026-11'), build.day('2026-11-09'), build.month('2026-11-09')), ('2026', 'November 2026', '9 Nov 2026', 'November 2026'))
        for bad in ('<b>', 'EVIL-11-09', '2026-13', '2026-02-31', '9 November 2026', '', None, 2026, '2026\n', '2026-11-09\n'):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    build.day(bad)
                with self.assertRaises(ValueError):
                    build.month(bad)

    def test_a_brace_the_build_does_not_compute_stops_it(self):
        site = build.load(ROOT)
        self.assertIn(str(len(site['record']['works'])), build.fill(site, '{addresses} addresses'))
        with self.assertRaises(ValueError):
            build.fill(site, 'There are {nope} of them.')

    def test_a_broken_record_is_reported_in_a_sentence(self):
        """Run as a command, the builder says what cannot be built, and writes nothing."""
        tmp = Path(tempfile.mkdtemp(prefix='edition-test-'))
        self.addCleanup(shutil.rmtree, tmp)
        for name in ('content', 'tools'):
            shutil.copytree(ROOT / name, tmp / name, ignore=shutil.ignore_patterns('__pycache__'))
        record = json.loads((tmp / 'content' / 'record.json').read_text(encoding='utf-8'))
        record['works'][0]['url'] = 'javascript:alert(1)'
        (tmp / 'content' / 'record.json').write_text(json.dumps(record), encoding='utf-8')
        run = subprocess.run([sys.executable, '-I', str(tmp / 'tools' / 'build.py')], capture_output=True, text=True)
        self.assertEqual(run.returncode, 1)
        self.assertIn('the record cannot be built', run.stderr)
        self.assertNotIn('Traceback', run.stderr)
        self.assertFalse((tmp / 'index.html').exists())
        record = json.loads((ROOT / 'content' / 'record.json').read_text(encoding='utf-8'))
        del record['volumes']                                       # sound as far as it goes, and a part of it is missing
        (tmp / 'content' / 'record.json').write_text(json.dumps(record), encoding='utf-8')
        run = subprocess.run([sys.executable, '-I', str(tmp / 'tools' / 'build.py')], capture_output=True, text=True)
        self.assertEqual(run.returncode, 1)
        self.assertIn('not the shape the pages need', run.stderr, 'a record of the wrong shape is reported in a sentence too')
        self.assertNotIn('Traceback', run.stderr)
        self.assertFalse((tmp / 'index.html').exists())

    def test_an_unknown_flag_is_refused(self):
        with contextlib.redirect_stderr(io.StringIO()) as said:
            self.assertEqual(build.main(['--chek']), 2)
        self.assertIn('usage', said.getvalue())

    def test_a_string_from_the_record_cannot_become_markup(self):
        site = build.load(ROOT)
        w = site['record']['works'][0]
        w['name'] = '<img src=x onerror=alert(1)>'
        w['tech'] = 'a <script>alert(1)</script> b'
        w['stats'] = [['"><b>1', 'x']]
        out = build.pages(site)['index.html']
        self.assertNotIn('<img src=x', out)
        self.assertNotIn('<script>alert', out)
        self.assertNotIn('"><b>1', out)

    def test_a_lesson_title_cannot_become_markup(self):
        site = build.load(ROOT)
        site['lab']['apps'][0]['title'] = '<i>x</i>'
        site['lab']['apps'][0]['description'] = '"><svg onload=1>'
        for path, text in build.pages(site).items():
            self.assertNotIn('<i>x</i>', text, path)
            self.assertNotIn('<svg onload', text, path)


if __name__ == '__main__':
    unittest.main(verbosity=1)
