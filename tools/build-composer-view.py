#!/usr/bin/env python3
"""Build view C (Cursor Composer 2.5, "The Live Stack") from the content of views A and F.

Reads    index.html, two-stories/index.html      (view A: the home page and the essay)
         designs/fable/lab/index.html            (view F: the Lab course page)
Writes   designs/composer/index.html, designs/composer/two-stories/index.html, designs/composer/lab/index.html
         and nothing else.

The words, links, figures and data hooks come from the source pages; the markup, class names, layout, type scale,
colours and motion are this view's own: a console with a process rail on the left and the work stacked as panes.
The switcher's head block (with its ?v= content stamps) and its nav are carried over from each source page, retargeted
to this view. Rerun after view A or view F content changes; the output is deterministic, so a rerun on an unchanged
tree leaves git clean. A source whose structure this script no longer recognises stops the build with a message
rather than writing a page with something missing.

Usage: python3 tools/build-composer-view.py
"""
from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'designs/composer'
BASE = '/designs/composer/'

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


# ---------------------------------------------------------------------------------------------------------------
# A small DOM over the source text. Every node remembers where it sits in the source, so content is copied as the
# exact markup it was written in (entities and inline tags included), never re-serialised.

class Node:
    def __init__(self, tag, attrs, parent, start):
        self.tag, self.attrs, self.parent, self.children = tag, attrs, parent, []
        self.start = self.inner_start = self.inner_end = self.end = start

    def has(self, cls):
        return cls in self.attrs.get('class', '').split()

    def get(self, name, default=None):
        return self.attrs.get(name, default)


class Tree(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.lines = [0]
        for line in src.splitlines(keepends=True):
            self.lines.append(self.lines[-1] + len(line))
        self.root = Node('#root', {}, None, 0)
        self.cur = self.root
        self.feed(src)
        self.close()
        self.root.inner_end = self.root.end = len(src)

    def _at(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        at = self._at()
        node = Node(tag, {k: (v if v is not None else '') for k, v in attrs}, self.cur, at)
        node.inner_start = node.inner_end = node.end = at + len(self.get_starttag_text())
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.cur = self.cur.parent

    def handle_endtag(self, tag):
        at = self._at()
        node = self.cur
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is self.root:
            return
        # anything left open inside closes here too
        while self.cur is not node:
            self.cur.inner_end = self.cur.end = at
            self.cur = self.cur.parent
        node.inner_end = at
        node.end = at + len(f'</{tag}>')
        self.cur = node.parent


class Page:
    def __init__(self, path):
        self.path = path
        self.src = (ROOT / path).read_text(encoding='utf-8')
        self.root = Tree(self.src).root

    def inner(self, node):
        return self.src[node.inner_start:node.inner_end].strip()

    def outer(self, node):
        return self.src[node.start:node.end]

    def text(self, node):
        return html.unescape(re.sub(r'<[^>]+>', '', self.inner(node))).strip()

    def all(self, pred, under=None):
        out = []

        def walk(n):
            for c in n.children:
                if pred(c):
                    out.append(c)
                walk(c)
        walk(under or self.root)
        return out

    def one(self, pred, under=None, what='element'):
        found = self.all(pred, under)
        if not found:
            raise SystemExit(f'{self.path}: no {what} found; the source changed shape, update tools/build-composer-view.py')
        return found[0]

    def need(self, found, what, n=1):
        if len(found) < n:
            raise SystemExit(f'{self.path}: expected at least {n} {what}, found {len(found)}; update tools/build-composer-view.py')
        return found


def by_cls(cls, tag=None):
    return lambda n: n.has(cls) and (tag is None or n.tag == tag)


def by_id(i):
    return lambda n: n.get('id') == i


def by_tag(tag):
    return lambda n: n.tag == tag


def kids(node, tag=None):
    return [c for c in node.children if tag is None or c.tag == tag]


def esc(s):
    return html.escape(s, quote=False)


def attr(name, value):
    return f' {name}="{value.replace("&", "&amp;").replace(chr(34), "&quot;")}"'


def attrs(node, *names, **override):
    """Carry the named attributes over from a source node, in the order given."""
    out = []
    for name in names:
        key = name.replace('_', '-')
        if key in override:
            value = override[key]
        elif name in override:
            value = override[name]
        else:
            value = node.get(key)
        if value is None:
            continue
        out.append(key if value is True else attr(key, value))
    return ''.join(' ' + o if not o.startswith(' ') else o for o in out)


def swap(text, pairs):
    for old, new in pairs:
        text = text.replace(old, new)
    return text


def tech(page, node, cls, tag='p'):
    """A paragraph that the Plain language button rewrites: the data-tech/data-simple pair travels with it."""
    pair = attrs(node, 'data-tech', 'data-simple')
    return f'<{tag} class="{cls}"{pair}>{page.inner(node)}</{tag}>'


# ---------------------------------------------------------------------------------------------------------------
# The switcher: the head block is copied byte for byte (its ?v= stamps are what tools/stage.sh checks), and the nav is
# the source page's nav with this view selected.

SWITCH_HEAD = re.compile(r'<!-- design-switcher:start --><link.*?<!-- design-switcher:end -->', re.S)
SWITCH_NAV = re.compile(r'<!-- design-switcher:start --><nav class="design-switcher".*?<!-- design-switcher:end -->', re.S)


def switcher(src, path):
    head, nav = SWITCH_HEAD.search(src), SWITCH_NAV.search(src)
    if not head or not nav:
        raise SystemExit(f'{path}: no design-switcher block; update tools/build-composer-view.py')
    nav = nav.group(0)
    nav = re.sub(r'data-selected="[a-z]+"', 'data-selected="composer"', nav)
    nav = nav.replace(' aria-current="page"', '')
    nav = re.sub(r'(<a class="design-choice" data-design="composer" href="[^"]*")>', r'\1 aria-current="page">', nav)
    nav = re.sub(r'<div class="design-curtain" data-destination="[a-z]+" aria-hidden="true"><strong>[^<]*</strong><span>[^<]*</span></div>',
                 '<div class="design-curtain" data-destination="composer" aria-hidden="true"><strong>COMPOSER 2.5</strong><span>THE LIVE STACK</span></div>', nav)
    if 'data-design="composer"' not in nav or 'aria-current="page"' not in nav:
        raise SystemExit(f'{path}: the switcher has no Composer 2.5 link; update tools/build-composer-view.py')
    return head.group(0), nav


def meta(src, prop=None, name=None):
    key = f'property="{prop}"' if prop else f'name="{name}"'
    m = re.search(r'<meta ' + key + r' content="([^"]*)">', src)
    return m.group(1) if m else None


FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap" rel="stylesheet">\n')


def head(title, description, og_title, og_desc, og_type, url, css, switch_head, canonical=None):
    out = ['<!DOCTYPE html>\n<html lang="en" data-design="composer">\n<head>\n<meta charset="UTF-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
           f'<title>{esc(title)}</title>\n<meta name="description"{attr("content", description)}>\n']
    if canonical:
        out.append(f'<link rel="canonical" href="{canonical}">\n')
    out.append(f'<meta property="og:title"{attr("content", og_title)}>\n'
               f'<meta property="og:description"{attr("content", og_desc)}>\n'
               f'<meta property="og:type" content="{og_type}">\n<meta property="og:url" content="{url}">\n'
               '<meta name="theme-color" content="#0a1311">\n'
               '<link rel="icon" href="https://seansooch.dev/favicon.svg" type="image/svg+xml">\n' + FONTS)
    out.append(f'<style>\n{css.strip()}\n</style>\n{switch_head}</head>\n')
    return ''.join(out)


# ---------------------------------------------------------------------------------------------------------------
# The Live Stack's stylesheet. One shared base for all three pages, then each page's own components.

BASE_CSS = r"""
/* The Live Stack, view C (Cursor Composer 2.5). A console: a process rail down the left, the work stacked in panes,
   green status lights measured from the reader's browser. Generated by tools/build-composer-view.py; do not edit. */
:root{
  --bg:#0a1311;--bg-2:#0e1a17;--pane:#11201c;--pane-2:#162924;--line:#22372f;--line-2:#2f4c42;
  --ink:#e6f2ee;--ink-2:#a6c0b7;--ink-3:#8faa9f;
  --accent:#3dd9c4;--on-accent:#04201a;
  --med:#ff9d87;--mil:#cfe07c;--mac:#3dd9c4;--spt:#ffbe5c;--hum:#eaa9e4;--mus:#ff86ad;
  --ok:#5fe3a1;--bad:#ff8f7f;--warn:#ffc86b;
  --sans:'Geist',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  --mono:'Geist Mono',ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;
  /* type scale: a perfect fourth (1.333) on a 16px step */
  --s-2:.6875rem;--s-1:.8125rem;--s0:1rem;--s1:1.333rem;--s2:1.777rem;--s3:2.369rem;--s4:3.157rem;--s5:4.209rem;--s6:5.61rem;
  --rail:17rem;--gut:clamp(20px,3.6vw,56px);
  --ease:cubic-bezier(.2,.8,.2,1);
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 var(--s0)/1.62 var(--sans);font-feature-settings:'ss01','tnum';
  background-image:linear-gradient(90deg,rgba(61,217,196,.035) 1px,transparent 1px);background-size:64px 100%}
a{color:inherit}
b,strong{font-weight:600}
img{max-width:100%;height:auto;display:block}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.design-switcher .design-choice:focus-visible{outline-color:#3dd9c4}
kbd{font:500 var(--s-2)/1 var(--mono);padding:3px 5px;border:1px solid currentColor;border-radius:3px}
.skiplink{position:absolute;left:12px;top:-60px;z-index:90;padding:10px 14px;background:var(--accent);color:var(--on-accent);font:600 var(--s-1) var(--mono);text-decoration:none}
.skiplink:focus{top:12px}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.console{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);min-height:100vh}

/* the rail */
.rail{position:sticky;top:0;align-self:start;height:100vh;display:flex;flex-direction:column;gap:22px;overflow-y:auto;
  padding:26px 20px 120px;background:var(--bg-2);border-right:1px solid var(--line)}
.rail-id{display:flex;flex-direction:column;gap:8px}
.rail-mark{font:600 var(--s1)/1 var(--mono);letter-spacing:.02em;text-decoration:none}
.rail-mark span{color:var(--accent)}
.rail-sub{margin:0;font:500 var(--s-2)/1.6 var(--mono);letter-spacing:.12em;color:var(--ink-2)}
.rail-live{display:flex;align-items:center;gap:10px;margin:0;padding:10px 12px;border:1px solid var(--line);border-radius:6px;
  font:500 var(--s-1)/1.3 var(--mono);color:var(--ink-2)}
.rail-live b{color:var(--ink)}
.rail-head{margin:0 0 6px;font:500 var(--s-2)/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}
.rail-nav{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.rail-link{position:relative;display:grid;grid-template-columns:2.6rem 1fr;align-items:baseline;padding:7px 10px;border-radius:5px;
  text-decoration:none;font-size:var(--s-1);color:var(--ink-2);transition:background .2s var(--ease),color .2s var(--ease)}
.rail-link span:first-child{font:500 var(--s-2)/1 var(--mono);letter-spacing:.06em;color:var(--ink-3)}
.rail-link::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:2px;border-radius:2px;background:var(--accent);
  transform:scaleY(0);transition:transform .25s var(--ease)}
.rail-link:hover{background:var(--pane);color:var(--ink)}
.rail-link[aria-current]{color:var(--ink);background:var(--pane)}
.rail-link[aria-current] span:first-child{color:var(--accent)}
.rail-link[aria-current]::before{transform:scaleY(1)}
.rail-ctl{display:flex;flex-direction:column;gap:8px;margin-top:auto}
.rail-btn{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid var(--line-2);
  border-radius:6px;background:var(--pane);color:var(--ink);font:500 var(--s-1)/1.2 var(--mono);text-align:left;text-decoration:none;cursor:pointer;
  transition:background .2s var(--ease),border-color .2s var(--ease)}
.rail-btn:hover{border-color:var(--accent);background:var(--pane-2)}
.rail-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.rail-btn--go{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.rail-btn--go:hover{background:#6ee4d3;border-color:#6ee4d3}
.rail-nav-the{display:inline}

/* the stage */
.stage{min-width:0;padding:0 var(--gut) 40px}
.pane{max-width:1120px;padding:clamp(48px,7vw,92px) 0 8px;border-top:1px solid var(--line)}
.pane-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px 32px;margin-bottom:clamp(26px,3.5vw,40px)}
.pane-path{grid-column:1/-1;display:flex;align-items:center;gap:12px;margin:0;font:500 var(--s-1)/1 var(--mono);letter-spacing:.12em;color:var(--ink-2)}
.pane-pid{display:inline-grid;place-items:center;min-width:2.7em;height:1.9em;padding:0 .5em;border:1px solid var(--accent);border-radius:4px;color:var(--accent)}
.pane-path::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line-2),transparent)}
.pane-title{margin:0;font:600 var(--s4)/1.04 var(--sans);letter-spacing:-.035em;text-wrap:balance}
.pane-sub{max-width:24rem;margin:0;font:400 var(--s-1)/1.55 var(--mono);color:var(--ink-2);text-align:right}
.pane-note{max-width:46rem;margin:0 0 32px;font-size:var(--s1);line-height:1.55;color:var(--ink)}
.callout{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;max-width:58rem;margin:28px 0 0;padding:16px 18px;
  border:1px solid var(--line-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;background:var(--pane)}
.callout p{margin:0;font-size:var(--s-1);line-height:1.65;color:var(--ink)}
.callout-tag{font:600 var(--s-2)/1.9 var(--mono);letter-spacing:.14em;color:var(--accent)}
.callout[data-tone="caution"]{border-left-color:var(--warn)}
.callout[data-tone="caution"] .callout-tag{color:var(--warn)}
.tcap{margin:30px 0 10px;font:400 var(--s-1)/1.5 var(--mono);color:var(--ink-2)}
.tcap b{color:var(--ink)}
.scroll-x{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--bg-2)}
.scroll-x table{width:100%;border-collapse:collapse;font-size:var(--s-1)}
.scroll-x th{padding:11px 14px;text-align:left;font:500 var(--s-2)/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);
  background:var(--pane);border-bottom:1px solid var(--line-2);white-space:nowrap}
.scroll-x td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
.scroll-x tr:last-child td{border-bottom:0}
.colophon{max-width:1120px;margin-top:72px;padding:30px 0 8px;border-top:1px solid var(--line)}
.colophon-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:20px 40px;max-width:1120px}
.colophon-name{font:600 var(--s3)/1 var(--mono);letter-spacing:-.03em;text-decoration:none}
.colophon-name span{color:var(--accent);margin-left:.15em}
.colophon-line{display:flex;flex-wrap:wrap;gap:10px 36px;font:400 var(--s-1)/1.6 var(--mono);color:var(--ink-2)}
.colophon-line a{color:var(--accent)}
.colophon-line b{color:var(--ink)}

/* motion */
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes slide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes blink{50%{opacity:0}}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(95,227,161,.55)}70%,100%{box-shadow:0 0 0 7px rgba(95,227,161,0)}}

@media (max-width:1000px){
  .console{grid-template-columns:1fr}
  .rail{position:sticky;z-index:40;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px var(--gut);
    border-right:0;border-bottom:1px solid var(--line);overflow:visible}
  .rail-id{flex-direction:row;align-items:baseline;gap:12px;margin-right:auto}
  .rail-sub br{display:none}
  .rail-live,.rail-head{display:none}
  .rail-ctl{flex-direction:row;margin:0}
  .rail-btn{width:auto;padding:8px 10px}
  .rail-nav{order:3;flex:1 0 100%;flex-direction:row;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 calc(var(--gut) * -1);padding:0 var(--gut)}
  .rail-link{grid-template-columns:auto auto;gap:6px;white-space:nowrap;padding:6px 9px}
  .rail-link::before{left:9px;right:9px;top:auto;bottom:0;width:auto;height:2px;transform:scaleX(0)}
  .rail-link[aria-current]::before{transform:scaleX(1)}
  .pane-head{grid-template-columns:1fr}
  .pane-sub{text-align:left}
}
@media (max-width:620px){
  .rail{top:0}
  .rail-sub{display:none}
  .rail-btn kbd,.rail-nav-the{display:none}
  .pane-title{font-size:var(--s3)}
  .callout{grid-template-columns:1fr;gap:6px}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation:none!important;transition:none!important}
}
@media print{
  body{background:#fff;color:#000}
  .rail,.design-switcher{display:none}
  .console{display:block}
}
"""

HOME_CSS = r"""
/* boot: the introduction, written as a session starting */
.boot{max-width:1120px;padding:clamp(28px,5vw,64px) 0 clamp(36px,5vw,64px)}
.boot-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin:0 0 clamp(28px,5vw,56px);padding:10px 14px;
  border:1px solid var(--line);border-radius:6px;background:var(--bg-2);font:500 var(--s-1)/1.3 var(--mono);letter-spacing:.1em;color:var(--ink-2)}
.boot-bar span:first-child{color:var(--accent);transition:color .2s}
.boot-cmd{margin:0 0 10px;font:400 var(--s-1)/1.4 var(--mono);color:var(--ink-3)}
.boot-cmd b{font-weight:500;color:var(--accent)}
.boot-name{display:inline-block;margin:0;font:600 clamp(52px,9.4vw,var(--s6))/.95 var(--mono);letter-spacing:-.06em;white-space:nowrap;
  animation:type 1.1s steps(11,end) .15s both}
.boot-dot{color:var(--accent)}
.boot-caret{display:inline-block;width:.09em;height:.82em;margin-left:.08em;vertical-align:-.04em;background:var(--accent);animation:blink 1.05s steps(1) infinite}
.boot-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:clamp(24px,4vw,64px);margin-top:clamp(28px,4vw,48px)}
.boot-grid>*{animation:rise .6s var(--ease) both}
.boot-grid>:nth-child(2){animation-delay:.35s}
.boot-tagline{margin:0 0 22px;font:500 var(--s3)/1.12 var(--sans);letter-spacing:-.03em}
.boot-bio{max-width:34rem;margin:0 0 26px;font-size:var(--s1);line-height:1.5;color:var(--ink-2)}
.boot-cta{display:inline-flex;gap:10px;align-items:center;padding:12px 18px;border-radius:6px;background:var(--accent);color:var(--on-accent);
  font:600 var(--s-1)/1 var(--mono);text-decoration:none;transition:transform .2s var(--ease)}
.boot-cta:hover{transform:translateX(4px)}
.boot-edition{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto 1fr auto;gap:6px 20px;align-self:end;padding:20px;
  border:1px solid var(--line-2);border-radius:8px;background:var(--pane);text-decoration:none;transition:border-color .2s}
.boot-edition:hover{border-color:var(--accent)}
.boot-edition span{grid-column:1/-1;font:500 var(--s-2)/1.5 var(--mono);letter-spacing:.14em;color:var(--ink-2)}
.boot-edition span:last-child{color:var(--accent)}
.boot-edition strong{grid-column:1/-1;font:600 var(--s5)/1 var(--mono);letter-spacing:-.05em}

/* switchboard: the three disciplines as keys */
.switchboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,.8fr);gap:10px;max-width:1120px;margin:0 0 clamp(40px,5vw,64px)}
.sw-key{position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:28px;min-height:132px;padding:16px;
  border:1px solid var(--line-2);border-radius:8px;background:var(--pane);font:600 var(--s2)/1 var(--sans);letter-spacing:-.03em;text-align:left;
  cursor:pointer;overflow:hidden;transition:border-color .2s var(--ease),transform .2s var(--ease),background .2s var(--ease)}
.sw-key span{order:-1;font:500 var(--s-1)/1 var(--mono);letter-spacing:.1em;color:var(--ink-2)}
.sw-key::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--d);transform:scaleX(.18);transform-origin:left;
  transition:transform .35s var(--ease)}
.sw-key:hover,.sw-key:focus-visible{border-color:var(--d);background:var(--pane-2);transform:translateY(-2px)}
.sw-key:hover::after,.sw-key:focus-visible::after{transform:scaleX(1)}
.sw-all{display:flex;align-items:flex-end;padding:16px;border:1px dashed var(--line-2);border-radius:8px;font:500 var(--s-1)/1.45 var(--mono);
  color:var(--ink-2);text-decoration:none;transition:color .2s,border-color .2s}
.sw-all:hover{color:var(--ink);border-color:var(--accent)}
[data-d="med"]{--d:var(--med)}[data-d="mil"]{--d:var(--mil)}[data-d="mac"]{--d:var(--mac)}
[data-d="spt"]{--d:var(--spt)}[data-d="hum"]{--d:var(--hum)}[data-d="mus"]{--d:var(--mus)}

/* seg: the domain filter */
.seg{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg-2)}
.seg-btn{padding:8px 12px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--ink-2);font:500 var(--s-1)/1.2 var(--mono);
  cursor:pointer;transition:background .2s var(--ease),color .2s var(--ease)}
.seg-btn:hover{color:var(--ink);border-color:var(--line-2)}
.seg-btn[aria-pressed="true"]{background:var(--accent);color:var(--on-accent)}

/* procs: one row per system, the stack itself */
.procs{display:flex;flex-direction:column;gap:10px}
.proc{display:grid;grid-template-columns:7.5rem minmax(0,1fr) 15rem;gap:8px 28px;padding:20px 22px;
  border:1px solid var(--line);border-left:3px solid var(--d);border-radius:4px 8px 8px 4px;background:var(--pane);text-decoration:none;
  animation:slide .45s var(--ease) both;animation-delay:calc(var(--n,0) * 35ms);transition:background .2s var(--ease),border-color .2s var(--ease)}
.proc:hover{background:var(--pane-2);border-color:var(--line-2);border-left-color:var(--d)}
.proc[hidden]{display:none}
.proc-id{display:flex;flex-direction:column;gap:12px}
.proc-num{font:600 var(--s3)/1 var(--mono);letter-spacing:-.05em;color:var(--d)}
.proc-state{display:flex;align-items:flex-start;gap:8px;font:400 var(--s-2)/1.45 var(--mono);color:var(--ink-2)}
.proc-dom{display:block;margin-bottom:6px;font:500 var(--s-2)/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--d)}
.proc-name{margin:0 0 8px;font:600 var(--s2)/1.08 var(--sans);letter-spacing:-.03em}
.proc-flag{display:inline-block;margin-left:10px;padding:3px 7px;vertical-align:.45em;border-radius:3px;background:var(--d);color:var(--on-accent);
  font:600 var(--s-2)/1 var(--mono);letter-spacing:.06em}
.proc-text{margin:0;font-size:.9375rem;line-height:1.6;color:var(--ink-2)}
.proc-side{display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.proc-kv{display:flex;flex-direction:column;gap:0;margin:0;font:400 var(--s-1)/1.4 var(--mono);color:var(--ink-2)}
.proc-kv>span{display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)}
.proc-kv b{color:var(--ink);font-weight:600}
.proc-open{align-self:flex-start;padding:8px 12px;border:1px solid var(--line-2);border-radius:5px;font:600 var(--s-1)/1 var(--mono);color:var(--ink);
  transition:background .2s,color .2s,border-color .2s}
.proc:hover .proc-open{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}

/* status lights */
.light{flex:none;display:inline-block;width:9px;height:9px;margin-top:.25em;border-radius:50%;background:var(--ink-3);opacity:.7}
.light[data-state="up"]{background:var(--ok);opacity:1;animation:ping 2.4s ease-out infinite}
.light[data-state="down"]{background:var(--bad);opacity:1}
.light[data-state="wake"]{background:var(--warn);opacity:1;animation:blink 1.2s steps(1) infinite}

/* ledger: rows of lessons, films and experiments */
.ledger{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:8px;background:var(--bg-2);overflow:hidden}
.entry{display:grid;grid-template-columns:4.5rem minmax(0,1fr) 10rem 6rem;align-items:baseline;gap:4px 24px;width:100%;
  padding:16px 20px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;text-decoration:none;
  font:inherit;cursor:pointer;transition:background .2s var(--ease)}
.entry:last-child{border-bottom:0}
.entry:hover{background:var(--pane)}
.entry-no{font:500 var(--s-1)/1.4 var(--mono);color:var(--accent)}
.entry-name{display:flex;align-items:baseline;gap:8px;font-weight:600;font-size:var(--s0)}
.entry-text{grid-column:2;grid-row:2;max-width:44rem;font-size:var(--s-1);line-height:1.55;color:var(--ink-2)}
.entry-meta{grid-column:3;grid-row:1;font:400 var(--s-2)/1.5 var(--mono);color:var(--ink-2)}
.entry-act{grid-column:4;grid-row:1;justify-self:end;font:600 var(--s-1)/1 var(--mono);color:var(--accent);transition:transform .2s var(--ease)}
.entry:hover .entry-act{transform:translateX(3px)}
.entry-name .light{margin-top:0}

/* briefs: the papers, each with its argument drawn as a stack of tiers */
.briefs{display:flex;flex-direction:column;gap:16px}
.brief{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,3vw,40px);padding:clamp(20px,3vw,32px);
  border:1px solid var(--line);border-radius:8px;background:var(--pane)}
.brief-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;margin:0 0 14px;font:500 var(--s-2)/1.5 var(--mono);letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-2)}
.brief-meta span:first-child{color:var(--hum)}
.brief-title{margin:0 0 12px;font:600 var(--s2)/1.1 var(--sans);letter-spacing:-.03em}
.brief-text{margin:0 0 20px;font-size:.9375rem;line-height:1.62;color:var(--ink-2)}
.brief-links{display:flex;flex-wrap:wrap;gap:8px}
.brief-links a{padding:8px 11px;border:1px solid var(--line-2);border-radius:5px;font:500 var(--s-1)/1.2 var(--mono);text-decoration:none;
  transition:border-color .2s,color .2s}
.brief-links a:hover{border-color:var(--accent);color:var(--accent)}
.tiers{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:5px;margin:0;padding:0;list-style:none}
.tier{--w:calc(100% - var(--i) * 7%);position:relative;display:grid;grid-template-columns:2.2rem 1fr;gap:12px;align-items:baseline;width:var(--w);
  max-width:100%;padding:9px 12px;border:1px solid var(--line-2);border-radius:5px;background:var(--bg-2);transition:transform .25s var(--ease),border-color .25s}
.tier:hover{transform:translateX(6px);border-color:var(--accent)}
.tier-n{font:500 var(--s-2)/1 var(--mono);color:var(--accent)}
.tier b{display:block;font-size:var(--s-1)}
.tier span:last-child{font-size:var(--s-1);line-height:1.4;color:var(--ink-2)}
.annex{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.annex-card{display:flex;flex-direction:column;gap:10px;padding:22px;border:1px solid var(--line);border-radius:8px;background:var(--bg-2);text-decoration:none;
  transition:border-color .2s,background .2s}
.annex-card:hover{border-color:var(--hum);background:var(--pane)}
.annex-card p{margin:0;flex:1;font-size:.9375rem;line-height:1.6;color:var(--ink-2)}
.annex-foot{display:flex;justify-content:space-between;gap:12px;font:500 var(--s-1)/1.4 var(--mono);color:var(--ink-2)}
.annex-foot>span:first-child{display:flex;gap:8px;align-items:flex-start}
.annex-foot>span:last-child{color:var(--accent)}

/* screen: the launch film */
.screen{margin:0 0 16px;border:1px solid var(--line-2);border-radius:10px;overflow:hidden;background:var(--bg-2)}
.screen-cap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 20px;padding:12px 16px;border-bottom:1px solid var(--line);
  font:400 var(--s-1)/1.5 var(--mono);color:var(--ink-2)}
.screen-cap b{color:var(--ink)}
.screen-btn{position:relative;display:block;width:100%;padding:0;border:0;background:#000;cursor:pointer}
.screen-btn img{width:100%;aspect-ratio:16/9;object-fit:cover;opacity:.88;transition:opacity .3s}
.screen-btn:hover img{opacity:1}
.screen-play{position:absolute;left:50%;top:50%;display:grid;place-items:center;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;
  background:var(--accent);box-shadow:0 0 0 10px rgba(61,217,196,.18);transition:transform .25s var(--ease)}
.screen-play::after{content:'';margin-left:6px;border-style:solid;border-width:13px 0 13px 21px;border-color:transparent transparent transparent var(--on-accent)}
.screen-btn:hover .screen-play{transform:scale(1.08)}

/* notes: the person, in margin-keyed paragraphs */
.notes{display:flex;flex-direction:column;max-width:58rem}
.note-row{display:grid;grid-template-columns:9rem minmax(0,1fr);gap:24px;padding:20px 0;border-bottom:1px dashed var(--line-2)}
.note-key{font:600 var(--s0)/1.3 var(--mono);color:var(--accent)}
.note-key small{display:block;margin-top:4px;font-weight:400;font-size:var(--s-2);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
.note-row p{margin:0;font-size:var(--s1);line-height:1.55}

/* changelog and the four views */
.changelog .cl-vol{font:600 var(--s-1)/1.3 var(--mono);color:var(--accent);white-space:nowrap}
.changelog .cl-dim,.changelog .cl-retired{color:var(--ink-2)}
.changelog .cl-current{color:var(--ok);font-weight:600}
.changelog .cl-link a{color:var(--accent);white-space:nowrap}
.changelog tr[data-href]{cursor:pointer}
.quad{margin:28px 0 0;border:1px solid var(--line-2);border-radius:10px;overflow:hidden;background:var(--bg-2)}
.quad-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 24px;margin:0;padding:16px 20px;border-bottom:1px solid var(--line)}
.quad-head span:first-child{font:600 var(--s2)/1.1 var(--sans);letter-spacing:-.03em}
.quad-head span:last-child{font:400 var(--s-1)/1.5 var(--mono);color:var(--ink-2)}
.quad-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.quad-cell{position:relative;display:flex;flex-direction:column;gap:10px;min-height:250px;padding:20px;border-right:1px solid var(--line);text-decoration:none;
  transition:background .2s}
.quad-cell:last-child{border-right:0}
a.quad-cell:hover{background:var(--pane)}
.quad-cell[aria-current]{background:var(--pane-2);box-shadow:inset 0 3px 0 var(--accent)}
.quad-no{font:600 var(--s4)/1 var(--mono);letter-spacing:-.05em;color:var(--ink-3)}
.quad-cell[aria-current] .quad-no{color:var(--accent)}
.quad-by{font:400 var(--s-2)/1.4 var(--mono);letter-spacing:.06em;color:var(--ink-2)}
.quad-name{font:600 var(--s1)/1.15 var(--sans);letter-spacing:-.02em}
.quad-flag{display:inline-block;margin-left:6px;padding:2px 6px;vertical-align:.2em;border:1px solid var(--accent);border-radius:3px;color:var(--accent);
  font:500 var(--s-2)/1.2 var(--mono)}
.quad-note{flex:1;font-size:var(--s-1);line-height:1.6;color:var(--ink-2)}
.quad-go{position:absolute;top:18px;right:18px;font-size:var(--s1);color:var(--accent)}
.quad-here{padding-top:10px;border-top:1px solid var(--line-2);font:600 var(--s-1)/1 var(--mono);color:var(--accent)}

/* the record drawer */
.drawer{border:1px solid var(--line-2);border-radius:8px;background:var(--bg-2)}
.drawer>summary{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;font:500 var(--s0)/1.3 var(--mono);cursor:pointer;
  list-style:none}
.drawer>summary::-webkit-details-marker{display:none}
.drawer>summary span{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--accent);border-radius:4px;color:var(--accent);
  transition:transform .3s var(--ease)}
.drawer[open]>summary span{transform:rotate(45deg)}
.drawer-body{padding:0 20px 22px}
.readout .rd-val{font:600 var(--s-1)/1.4 var(--mono);color:var(--ink);white-space:nowrap}
.readout .rd-ref{color:var(--ink-2)}
.readout .rt-host{font:400 var(--s-1)/1.4 var(--mono);color:var(--ink-2)}
.readout .rt-fig{font:400 var(--s-2)/1 var(--mono);color:var(--ink-2)}
.readout td a{font-weight:600;text-decoration:none}
.readout .rt-state{display:flex;align-items:center;gap:8px;font:400 var(--s-1)/1.4 var(--mono);color:var(--ink-2);white-space:nowrap}
.readout .rt-ms{text-align:right;font:400 var(--s-1)/1.4 var(--mono);white-space:nowrap}
.hosts-wrap h3{margin:34px 0 4px;font:600 var(--s2)/1.1 var(--sans);letter-spacing:-.03em}
.probe-stamp{margin:0 0 16px;font:400 var(--s-1)/1.5 var(--mono);color:var(--accent)}
.hosts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.hosts-col{display:flex;flex-direction:column;gap:12px}
.hosts-group{border:1px solid var(--line);border-radius:6px;background:var(--pane)}
.hosts-group summary{display:flex;justify-content:space-between;padding:10px 14px;font:500 var(--s-1)/1.3 var(--mono);letter-spacing:.1em;text-transform:uppercase;
  cursor:pointer;color:var(--ink)}
.hosts-count{color:var(--accent)}
.hosts-group ul{margin:0;padding:0 6px 8px;list-style:none}
.hosts-link{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding:7px 8px;border-radius:4px;font-size:var(--s-1);text-decoration:none}
.hosts-link:hover{background:var(--pane-2)}
.hosts-arrow{color:var(--ink-2)}

/* az: the printed index */
.az{columns:3 15rem;column-gap:36px}
.az-group{break-inside:avoid;margin-bottom:20px}
.az-letter{margin-bottom:6px;font:600 var(--s1)/1 var(--mono);color:var(--accent)}
.az-entry{display:flex;align-items:baseline;gap:6px;padding:3px 0;font-size:var(--s-1);text-decoration:none;color:var(--ink)}
.az-entry:hover{color:var(--accent)}
.az-leader{flex:1;border-bottom:1px dotted var(--line-2);transform:translateY(-3px)}
.az-ref{font:400 var(--s-2)/1 var(--mono);color:var(--ink-2);white-space:nowrap}

/* overlays: the film theater and the index finder */
.theater,.finder{position:fixed;inset:0;z-index:100;display:none;background:rgba(4,10,9,.86);backdrop-filter:blur(4px)}
.theater[aria-hidden="false"]{display:grid;place-items:center;padding:20px;animation:rise .25s var(--ease) both}
.theater video{width:min(1100px,100%);max-height:78vh;border:1px solid var(--line-2);border-radius:8px;background:#000}
.theater-close{position:absolute;top:16px;right:16px;width:44px;height:44px;border:1px solid var(--line-2);border-radius:6px;background:var(--pane);
  color:var(--ink);font-size:24px;line-height:1;cursor:pointer}
.theater-close:hover{border-color:var(--accent)}
.theater-cap{position:absolute;left:20px;bottom:20px;font:500 var(--s-1)/1.4 var(--mono);color:var(--ink-2)}
.finder[aria-hidden="false"]{display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px}
.finder-box{width:min(680px,100%);border:1px solid var(--line-2);border-radius:10px;background:var(--bg-2);box-shadow:0 30px 80px rgba(0,0,0,.5);
  overflow:hidden;animation:rise .2s var(--ease) both}
.finder-field{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.finder-field label{font:600 var(--s-2)/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.finder-field input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:400 var(--s1)/1.3 var(--mono);outline:0}
.finder-field input::placeholder{color:var(--ink-3)}
.finder-list{max-height:52vh;overflow-y:auto;padding:6px}
.finder-item{display:flex;justify-content:space-between;gap:16px;padding:10px 12px;border-radius:6px;text-decoration:none;color:var(--ink)}
.finder-item small{display:block;font:400 var(--s-2)/1.5 var(--mono);color:var(--ink-2)}
.finder-item .finder-ref{font:400 var(--s-2)/1.5 var(--mono);color:var(--ink-2);white-space:nowrap}
.finder-item[aria-selected="true"]{background:var(--accent);color:var(--on-accent)}
.finder-item[aria-selected="true"] small,.finder-item[aria-selected="true"] .finder-ref{color:var(--on-accent)}
.finder-empty{padding:16px;font:400 var(--s-1)/1.5 var(--mono);color:var(--ink-2)}
.finder-foot{display:flex;gap:18px;padding:10px 16px;border-top:1px solid var(--line);font:400 var(--s-2)/1 var(--mono);color:var(--ink-2)}
.finder-foot kbd{margin-right:6px}

@media (max-width:1180px){
  .proc{grid-template-columns:6rem minmax(0,1fr)}
  .proc-side{grid-column:2;flex-direction:row;flex-wrap:wrap;align-items:flex-end}
  .proc-kv{flex-direction:row;flex-wrap:wrap;gap:4px 16px}
  .proc-kv>span{border:0;padding:0}
  .entry{grid-template-columns:4rem minmax(0,1fr) auto}
  .entry-meta{grid-column:2;grid-row:3}
  .entry-act{grid-column:3}
  .quad-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .quad-cell:nth-child(2){border-right:0}
  .quad-cell:nth-child(-n+2){border-bottom:1px solid var(--line)}
}
@media (max-width:860px){
  .boot-grid,.brief,.annex,.hosts{grid-template-columns:1fr}
  .switchboard{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sw-all{grid-column:1/-1}
}
@media (max-width:620px){
  .switchboard{grid-template-columns:1fr}
  .sw-key{min-height:0;flex-direction:row;align-items:center;font-size:var(--s1)}
  .proc{grid-template-columns:1fr;padding:18px}
  .proc-id{flex-direction:row;align-items:center;gap:14px}
  .proc-num{font-size:var(--s2)}
  .proc-side{grid-column:1}
  .entry{grid-template-columns:3rem minmax(0,1fr);padding:14px 16px}
  .entry-act{grid-column:2;grid-row:4;justify-self:start;margin-top:6px}
  .note-row{grid-template-columns:1fr;gap:6px}
  .tier{width:100%}
  .quad-grid{grid-template-columns:1fr}
  .quad-cell{min-height:0;border-right:0;border-bottom:1px solid var(--line)}
  .quad-cell:last-child{border-bottom:0}
  .boot-bar{font-size:var(--s-2)}
}
"""

READ_CSS = r"""
/* a long read in the console: the paragraph number sits in the gutter like a line number */
.lede{max-width:1120px;padding:clamp(28px,5vw,64px) 0 clamp(30px,4vw,48px)}
.lede-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 20px;margin:0 0 clamp(26px,4vw,44px);padding:10px 14px;
  border:1px solid var(--line);border-radius:6px;background:var(--bg-2);font:500 var(--s-1)/1.4 var(--mono);letter-spacing:.08em;color:var(--ink-2)}
.lede-bar>span:first-child{color:var(--hum)}
.lede-bar b{color:var(--ink)}
.lede-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:clamp(24px,4vw,56px);animation:rise .6s var(--ease) both}
.lede-title{margin:0 0 20px;font:600 var(--s5)/1 var(--sans);letter-spacing:-.045em;text-wrap:balance}
.lede-sub{margin:0;font-size:var(--s1);line-height:1.55;color:var(--ink-2)}
.lede-sub b{color:var(--ink);font-weight:500}
.lede-aside{align-self:start;padding:20px;border:1px solid var(--line-2);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;background:var(--pane)}
.lede-aside p{margin:0 0 12px;font-size:.9375rem;line-height:1.6}
.lede-aside p:last-child{margin:0}
.lede-label{display:block;margin-bottom:10px;font:600 var(--s-2)/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.lede-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:clamp(26px,4vw,40px)}
.lede-facts>div{padding:14px 16px;border:1px solid var(--line);border-radius:6px;background:var(--bg-2);font-size:var(--s-1);line-height:1.55;color:var(--ink-2)}
.lede-facts b{display:block;margin-bottom:4px;font:600 var(--s-2)/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.lede-facts a{color:var(--accent)}
.prose{max-width:50rem;counter-reset:para}
.prose-p{position:relative;display:grid;grid-template-columns:3.6rem minmax(0,1fr);gap:18px;padding:6px 0}
.prose-p::before{counter-increment:para;content:attr(data-part) '.' counter(para);padding-top:.35em;font:500 var(--s-2)/1.4 var(--mono);color:var(--ink-3);
  text-align:right}
.prose-p p{margin:0 0 14px;font-size:1.0625rem;line-height:1.72}
.prose-p p a{color:var(--accent)}
.prose-p[data-key]{margin:10px 0;padding:16px 18px 6px 0;border:1px solid var(--line-2);border-radius:8px;background:var(--pane)}
.prose-p[data-key]::before{color:var(--accent)}
.compare td.cmp-key{font:500 var(--s-1)/1.4 var(--mono);color:var(--accent);white-space:nowrap}
.compare{min-width:680px}
.compare td.cmp-same{color:var(--ink);font-weight:500}
.compare td{color:var(--ink-2)}
.compare td{line-height:1.55}
.tnote{margin:12px 0 0;font:400 var(--s-1)/1.5 var(--mono);color:var(--ink-2)}
.callout a{color:var(--accent)}
.colophon-line a{color:var(--accent)}

/* the lab course list */
.course{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:8px;background:var(--bg-2);overflow:hidden}
.lesson{display:grid;grid-template-columns:4.5rem minmax(10rem,16rem) minmax(0,1fr) 9rem;gap:6px 22px;align-items:baseline;padding:18px 20px;
  border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink);animation:slide .45s var(--ease) both;transition:background .2s}
.lesson:last-child{border-bottom:0}
a.lesson:hover{background:var(--pane)}
.lesson-no{font:600 var(--s-1)/1.4 var(--mono);color:var(--accent)}
.lesson-name{font-weight:600}
.lesson-desc{display:flex;flex-direction:column;gap:6px;font-size:var(--s-1);line-height:1.55;color:var(--ink-2)}
.lesson-topics{font:400 var(--s-2)/1.5 var(--mono);color:var(--ink-2)}
.lesson-when{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font:400 var(--s-2)/1.4 var(--mono);color:var(--ink-2)}
.lesson-go{font:600 var(--s-1)/1 var(--mono);color:var(--accent)}
.lesson[data-soon] .lesson-no,.lesson[data-soon] .lesson-name{color:var(--ink-2)}
.lesson-wait{margin:0;padding:18px 20px;font-size:var(--s-1);color:var(--ink-2)}
.lesson-wait a{color:var(--accent)}
@media (max-width:860px){
  .lede-grid,.lede-facts{grid-template-columns:1fr}
  .lesson{grid-template-columns:3.5rem minmax(0,1fr)}
  .lesson-desc,.lesson-when{grid-column:2}
  .lesson-when{align-items:flex-start}
}
@media (max-width:620px){
  .lede-title{font-size:var(--s4)}
  .prose-p{grid-template-columns:1fr;gap:2px}
  .prose-p::before{text-align:left}
  .prose-p[data-key]{padding:14px 14px 4px}
}
"""


# ---------------------------------------------------------------------------------------------------------------
# Shared page parts

def rail(mark_href, mark_inner, mark_label, sub, nav_items, controls, live=False, head_label='stack', nav_label='Main navigation'):
    links = ''.join(
        f'<li><a class="rail-link" href="{href}"{extra}><span>{pid}</span><span>{label}</span></a></li>'
        for pid, label, href, extra in nav_items)
    live_html = ('<p class="rail-live" aria-live="polite"><i class="light" data-state="probing" id="railLight"></i>'
                 '<span><b id="railUp">…</b> of <b id="railTotal">…</b> hosts answering</span></p>') if live else ''
    return (f'<header class="rail"><div class="rail-id"><a class="rail-mark" href="{mark_href}" aria-label="{mark_label}">{mark_inner}</a>'
            f'<p class="rail-sub">{sub}</p></div>{live_html}'
            f'<nav aria-label="{nav_label}"><p class="rail-head">{head_label}</p><ol class="rail-nav">{links}</ol></nav>'
            f'<div class="rail-ctl">{controls}</div></header>')


def pane_head(page, head):
    lbl = page.one(by_cls('lbl'), head, 'section label')
    h2 = page.one(by_tag('h2'), head, 'section heading')
    meta_nodes = page.all(by_cls('meta'), head)
    label = page.inner(lbl)
    pid, _, name = label.partition(' / ')
    path = f'<span class="pane-pid">{pid}</span>{name}' if name else f'<span class="pane-pid">{pid}</span>'
    sub = ''
    if meta_nodes:
        m = meta_nodes[0]
        sub = f'<p class="pane-sub"{attrs(m, "data-lab-text")}>{page.inner(m)}</p>'
    return f'<div class="pane-head"><p class="pane-path">{path}</p><h2 class="pane-title">{page.inner(h2)}</h2>{sub}</div>'


def callout(page, box, extra=''):
    tag = page.one(by_cls('tag'), box, 'note tag')
    p = page.one(by_tag('p'), box, 'note text')
    tone = ' data-tone="caution"' if box.has('caution') else ''
    body = tech(page, p, 'callout-text') if p.get('data-tech') is not None else f'<p>{page.inner(p)}</p>'
    return f'<div class="callout"{tone}{extra}><span class="callout-tag">{page.inner(tag)}</span>{body}</div>'


def table_rows(page, table, cell_classes, row_attrs=('data-index', 'data-kw', 'data-href', 'data-ref')):
    """Copy a table's rows with this view's cell classes; cell text is the source markup."""
    out = []
    thead = page.one(by_tag('thead'), table, 'table head')
    out.append('<thead>' + page.inner(thead) + '</thead>')
    tbody = page.one(by_tag('tbody'), table, 'table body')
    rows = []
    for tr in kids(tbody, 'tr'):
        cells = []
        for td in kids(tr, 'td'):
            classes = [cell_classes[c] for c in td.get('class', '').split() if c in cell_classes]
            ca = f' class="{" ".join(classes)}"' if classes else ''
            cells.append(f'<td{ca}{attrs(td, "style")}>{page.inner(td)}</td>')
        rows.append(f'<tr{attrs(tr, *row_attrs)}>' + ''.join(cells) + '</tr>')
    out.append('<tbody>' + '\n'.join(rows) + '</tbody>')
    return ''.join(out)


# ---------------------------------------------------------------------------------------------------------------
# The home page

HOME_PAIRS = [
    ('href="https://seansooch.dev/lab/"', f'href="{BASE}lab/"'),
    ('href="/two-stories/', f'href="{BASE}two-stories/'),
    ('data-href="/two-stories/', f'data-href="{BASE}two-stories/'),
    ('href="/designs/fable/two-stories/"', f'href="{BASE}two-stories/"'),
]


def build_home():
    page = Page('index.html')
    src = page.src
    switch_head, switch_nav = switcher(src, page.path)
    P = page
    fix = lambda s: swap(s, HOME_PAIRS)

    # --- head
    out = [head(
        'Sean Sooch: The Live Stack',
        'Fourteen working systems across medicine, the military, and frontier AI, laid out as a live operations deck. '
        'Built by a medical student and military officer with AI as the engineering tool. Every host is probed from your '
        'browser when the page loads.',
        'Sean Sooch: The Live Stack', meta(src, prop='og:description'), 'website', 'https://seansooch.dev/designs/composer/',
        BASE_CSS + HOME_CSS, switch_head)]

    # --- rail
    top = P.one(by_cls('top', 'header'), what='header')
    brand = P.one(by_cls('brand'), top, 'brand')
    nav = P.one(by_cls('nav'), top, 'nav')
    nav_links = {a.get('href'): P.inner(a) for a in kids(nav, 'a')}
    mode = P.one(by_id('modeBtn'), nav, 'Plain language button')
    pal_btn = P.one(by_id('palBtn'), nav, 'Index button')
    lab_link = P.one(by_cls('nav-lab'), nav, 'Lab link')
    sections = P.need(P.all(lambda n: n.tag == 'section' and n.has('ch')), 'chapters', 9)
    sec = {s.get('id'): s for s in sections}
    titles = {}
    for s in sections:
        lbl = P.text(P.one(by_cls('lbl'), s))
        pid, _, name = lbl.partition(' / ')
        titles[s.get('id')] = (pid if name else 'A–Z', (name or 'Index').title().replace('The ', ''))
    # the source's own nav words where it has them
    for href, label in nav_links.items():
        if href.startswith('#') and href[1:] in titles:
            titles[href[1:]] = (titles[href[1:]][0], label)
    nav_items = [(titles[i][0], titles[i][1], '#' + i, '') for i in [s.get('id') for s in sections]]
    nav_items = [(pid if pid != 'NEW' else 'L', label, href, extra) for pid, label, href, extra in nav_items]
    controls = (f'<a class="rail-btn rail-btn--go" href="{BASE}lab/"><span>{P.inner(lab_link).replace("nav-the", "rail-nav-the")}</span><span aria-hidden="true">↗</span></a>'
                f'<button id="modeBtn" class="rail-btn" aria-pressed="false">{P.inner(mode)}</button>'
                f'<button id="palBtn" class="rail-btn">{P.inner(pal_btn)}</button>')
    out.append('<body><a class="skiplink" href="#ch3">Skip to work</a><div class="console">')
    out.append(rail('#top', P.inner(brand), brand.get('aria-label'), 'THE LIVE STACK<br>COMPOSER 2.5 · OCT 2026', nav_items, controls, live=True))
    out.append('<div class="stage"><main id="top">')

    # --- boot
    cover = P.one(by_cls('cover'), what='cover')
    topline = P.one(by_cls('cover-topline'), cover)
    dom_label, topright = kids(topline, 'span')[:2]
    h1 = P.one(by_tag('h1'), cover)
    statement = P.one(by_cls('cover-statement'), cover)
    bio = P.one(by_cls('cover-bio'), cover)
    bio_p = P.one(by_tag('p'), bio)
    work_link = P.one(by_cls('work-link'), bio)
    stamp = P.one(by_cls('edition-stamp'), cover)
    stamp_parts = []
    for c in stamp.children:
        inner = P.inner(c).replace('FABLE 5.1 / DESIGN STUDY', 'CURSOR COMPOSER 2.5 / LIVE STACK')
        stamp_parts.append(f'<{c.tag}>{inner}</{c.tag}>')
    name = P.inner(h1).replace('<span class="name-period">', '<span class="boot-dot">')
    out.append(
        f'<section class="boot" aria-label="{cover.get("aria-label")}">'
        f'<p class="boot-bar"><span id="domLabel">{P.inner(dom_label)}</span><span>{P.inner(topright)}</span></p>'
        f'<p class="boot-cmd" aria-hidden="true"><b>sean@stack</b>:~$ whoami</p>'
        f'<h1 class="boot-name">{name}<span class="boot-caret" aria-hidden="true"></span></h1>'
        f'<div class="boot-grid"><div><p class="boot-tagline">{P.inner(statement)}</p>{tech(P, bio_p, "boot-bio")}'
        f'<a class="boot-cta" href="{work_link.get("href")}">{P.inner(work_link)}</a></div>'
        f'<a class="boot-edition" href="{stamp.get("href")}" aria-label="{stamp.get("aria-label")}">{"".join(stamp_parts)}</a></div>'
        '</section>')

    # --- switchboard
    triad = P.one(by_cls('triad'), what='discipline buttons')
    keys = []
    for b in P.need(kids(triad, 'button'), 'discipline buttons', 3):
        f = b.get('data-filter')
        keys.append(f'<button class="sw-key" data-d="{f}" data-filter="{f}"{attrs(b, "data-label")} style="--w:var(--{f})">{P.inner(b)}</button>')
    all_link = P.one(by_tag('a'), triad)
    keys.append(f'<a class="sw-all" href="{all_link.get("href")}" aria-label="{all_link.get("aria-label")}">{P.inner(all_link)}</a>')
    out.append('<div class="switchboard" role="group" aria-label="Disciplines">' + ''.join(keys) + '</div>')

    # --- 01 work
    s = sec['ch3']
    filters = P.one(by_cls('filters'), s, 'filters')
    segs = ''.join(
        f'<button class="seg-btn" aria-pressed="{c.get("aria-pressed")}" data-f="{c.get("data-f")}">{P.inner(c)}</button>'
        for c in P.need(kids(filters, 'button'), 'filter buttons', 2))
    procs = []
    for n, card in enumerate(P.need(P.all(by_cls('card'), s), 'system cards', 10)):
        fn = P.one(by_cls('fn'), card)
        fn_spans = kids(fn, 'span')
        h3 = P.one(by_tag('h3'), card)
        new = P.all(by_cls('new'), h3)
        title = P.inner(h3)
        if new:
            title = title.replace(P.outer(new[0]), f'<span class="proc-flag">{P.inner(new[0])}</span>')
        p = P.one(by_tag('p'), card)
        stats = P.one(by_cls('stats'), card)
        sdot = P.one(by_cls('sdot'), card)
        state = re.sub(r'^<i></i>', '', P.inner(sdot))
        go = P.one(by_cls('go'), card)
        procs.append(
            f'<a class="proc" data-d="{card.get("data-d")}"{attrs(card, "data-sys", "data-index", "data-kw", "href", "target", "rel")}'
            f' data-ref="{P.inner(fn_spans[1])}" style="--n:{n}">'
            f'<span class="proc-id"><span class="proc-num">{P.inner(fn_spans[1])}</span>'
            f'<span class="proc-state"><i class="light" data-sys="{sdot.get("data-sys")}" data-state="probing"></i><span>{state}</span></span></span>'
            f'<span class="proc-main"><span class="proc-dom">{P.inner(fn_spans[0])}</span><h3 class="proc-name">{title}</h3>{tech(P, p, "proc-text")}</span>'
            f'<span class="proc-side"><span class="proc-kv">{"".join(f"<span>{P.inner(x)}</span>" for x in kids(stats, "span"))}</span>'
            f'<span class="proc-open">{P.inner(go)}</span></span></a>')
    out.append(f'<section id="ch3" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}'
               f'<div class="seg" role="group" aria-label="{filters.get("aria-label")}">{segs}</div>'
               f'<div class="procs" id="grid">' + '\n'.join(procs) + '</div></section>')

    # --- the Lab (lesson rows drawn by lab-course.js from this template)
    s = sec['lab']
    note = P.one(by_cls('ed-note'), s)
    xlist = P.one(by_cls('xlist'), s)
    if xlist.get('data-lab-list') != 'ready' or not P.all(lambda n: n.tag == 'template' and n.get('data-lab-row') == 'ready', xlist):
        raise SystemExit('index.html: the Lab section has no ready-row template; update tools/build-composer-view.py')
    tpl_row = P.one(by_cls('xrow'), P.one(by_tag('template'), xlist))
    after = [r for r in kids(xlist, 'a') if r.has('xrow')]
    out.append(
        f'<section id="lab" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}{tech(P, note, "pane-note")}'
        f'<div class="ledger" data-lab-list="ready">'
        f'<template data-lab-row="ready"><a class="entry" data-lab-link data-lab-index{attrs(tpl_row, "data-ref")}>'
        '<span class="entry-no">L-<span data-lab="no"></span></span><span class="entry-name" data-lab="title"></span>'
        '<span class="entry-text" data-lab="description"></span><span class="entry-meta" data-lab="date"></span>'
        f'<span class="entry-act">{P.inner(P.one(by_cls("xgo"), tpl_row))}</span></a></template>'
        + ''.join(entry(P, r, fix) for r in after) + '</div></section>')

    # --- 02 writing
    s = sec['ch4']
    briefs = []
    for paper in P.need(P.all(by_cls('paper'), s), 'papers', 3):
        fn_spans = kids(P.one(by_cls('fn'), paper), 'span')
        dom_span = P.one(by_cls('dom'), fn_spans[0].parent) if P.all(by_cls('dom'), fn_spans[0].parent) else fn_spans[0]
        p = P.one(by_tag('p'), paper)
        tiers = []
        for i, layer in enumerate(P.need(P.all(by_cls('layer'), paper), 'paper layers', 1)):
            nnode = P.one(by_cls('n'), layer)
            div = P.one(by_tag('div'), layer)
            tiers.append(f'<li class="tier" style="--i:{i}"><span class="tier-n">{P.inner(nnode)}</span>'
                         f'<span><b>{P.inner(P.one(by_tag("b"), div))}</b><span>{P.inner(P.one(by_tag("span"), div))}</span></span></li>')
        links = ''.join(fix(P.outer(a)) for a in kids(P.one(by_cls('plinks'), paper), 'a'))
        briefs.append(
            f'<article class="brief"{fix(attrs(paper, "data-index", "data-ref", "data-kw", "data-href"))}>'
            f'<div><p class="brief-meta"><span>{P.inner(dom_span)}</span><span>{P.inner(fn_spans[-1])}</span></p>'
            f'<h3 class="brief-title">{P.inner(P.one(by_tag("h3"), paper))}</h3>{tech(P, p, "brief-text")}'
            f'<div class="brief-links">{links}</div></div>'
            f'<ol class="tiers" aria-label="The argument in six tiers">{"".join(tiers)}</ol></article>')
    rooms = []
    for room in P.need(P.all(by_cls('room'), s), 'reading rooms', 1):
        fn_spans = kids(P.one(by_cls('fn'), room), 'span')
        ft = P.one(by_cls('ft'), room)
        sdot = P.one(by_cls('sdot'), ft)
        rooms.append(
            f'<a class="annex-card"{attrs(room, "data-sys", "data-index", "data-kw", "href", "target", "rel")} data-ref="{P.inner(fn_spans[1])}">'
            f'<span class="brief-meta"><span>{P.inner(fn_spans[0])}</span><span>{P.inner(fn_spans[1])}</span></span>'
            f'<h3 class="brief-title">{P.inner(P.one(by_tag("h3"), room))}</h3><p>{P.inner(P.one(by_tag("p"), room))}</p>'
            f'<span class="annex-foot"><span><i class="light" data-sys="{sdot.get("data-sys")}" data-state="probing"></i>'
            f'{re.sub(r"^<i></i>", "", P.inner(sdot))}</span><span>{P.inner(P.one(by_cls("go"), ft))}</span></span></a>')
    out.append(f'<section id="ch4" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}'
               f'<div class="briefs">{"".join(briefs)}<div class="annex">{"".join(rooms)}</div></div></section>')

    # --- 03 films
    s = sec['appb']
    fig = P.one(by_cls('fig'), s)
    figcap = P.one(by_cls('figcap'), fig)
    trig = P.one(by_cls('film-trigger'), fig)
    img = P.one(by_tag('img'), trig)
    rows = P.need(P.all(by_cls('xrow'), P.one(by_cls('xlist'), s)), 'film rows', 1)
    out.append(
        f'<section id="appb" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}'
        f'<figure class="screen" id="{fig.get("id")}"><figcaption class="screen-cap">{P.inner(figcap)}</figcaption>'
        f'<button class="screen-btn"{attrs(trig, "type", "data-film", "data-poster", "data-title", "aria-label")}>'
        f'{P.outer(img)}<span class="screen-play" aria-hidden="true"></span></button></figure>'
        f'<div class="ledger">{"".join(entry(P, r, fix) for r in rows)}</div></section>')

    # --- 04 the person
    s = sec['ch1']
    notes = []
    for para in P.need(P.all(by_cls('para'), s), 'paragraphs', 3):
        pn = P.one(by_cls('pn'), para)
        notes.append(f'<div class="note-row"><span class="note-key">{P.inner(pn)}</span>{tech(P, P.one(by_tag("p"), para), "note-text")}</div>')
    boxes = [b for b in kids(s, 'div') if b.has('box')]
    out.append(f'<section id="ch1" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}<div class="notes">{"".join(notes)}</div>'
               + ''.join(callout(P, b) for b in boxes) + '</section>')

    # --- 05 experiments
    s = sec['ch5']
    rows = P.need(P.all(by_cls('xrow'), s), 'experiment rows', 1)
    out.append(f'<section id="ch5" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}'
               f'<div class="ledger">{"".join(entry(P, r, fix) for r in rows)}</div></section>')

    # --- 06 editions
    s = sec['appa']
    note = P.one(by_cls('ed-note'), s)
    tblcap = P.one(by_cls('tblcap'), s)
    table = P.one(by_cls('ed', 'table'), s)
    for tr in P.all(by_tag('tr'), table):
        if tr.get('data-index') is not None and tr.get('data-ref') is None:
            tr.attrs['data-ref'] = 'Table A-1'
    body = table_rows(P, table, {'val': 'cl-vol', 'ref': 'cl-dim', 'ed-retired': 'cl-retired', 'ed-current': 'cl-current', 'ed-link': 'cl-link'})
    body = body.replace('Four views: the Field Manual, the Personal Index and the Commentary, switchable in place',
                        'Four views: the Field Manual, the Personal Index, the Commentary and the Live Stack, switchable in place')
    band = P.one(by_cls('views-band'), s)
    cap = kids(P.one(by_cls('views-cap'), band), 'span')
    cells = []
    for cell in P.need(kids(P.one(by_cls('views-row'), band)), 'view cells', 4):
        part = {c.get('class'): c for c in kids(cell, 'span')}
        name = P.inner(part['view-name'])
        new = P.all(by_cls('new'), part['view-name'])
        if new:
            name = name.replace(P.outer(new[0]), f'<span class="quad-flag">{P.inner(new[0])}</span>')
        here = cell.get('href') == BASE
        href = '/' if cell.has('here') else cell.get('href')
        inner = (f'<span class="quad-no">{P.inner(part["view-no"])}</span><span class="quad-by">{P.inner(part["view-by"])}</span>'
                 f'<span class="quad-name">{name}</span><span class="quad-note">{P.inner(part["view-note"])}</span>')
        common = attrs(cell, 'data-index', 'data-ref', 'data-kw')
        if here:
            cells.append(f'<div class="quad-cell" aria-current="page" data-href="#appa"{common}>{inner}<span class="quad-here">You are here</span></div>')
        else:
            cells.append(f'<a class="quad-cell" href="{href}"{common}>{inner}<span class="quad-go" aria-hidden="true">↗︎</span></a>')
    boxes = [b for b in kids(s, 'div') if b.has('box')]
    out.append(
        f'<section id="appa" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}{tech(P, note, "pane-note")}'
        f'<p class="tcap">{P.inner(tblcap)}</p><div class="scroll-x"><table class="changelog">{body}</table></div>'
        f'<div class="quad"><p class="quad-head"><span>{P.inner(cap[0])}</span><span>{P.inner(cap[1])}</span></p>'
        f'<div class="quad-grid">{"".join(cells)}</div></div>'
        + ''.join(callout(P, b) for b in boxes) + '</section>')

    # --- 07 the record
    s = sec['ch2']
    det = P.one(by_cls('record-disclosure'), s)
    summary = P.one(by_tag('summary'), det)
    rb = P.one(by_cls('record-body'), det)
    parts = []
    for c in rb.children:
        if c.has('tblcap'):
            parts.append(f'<p class="tcap">{P.inner(c)}</p>')
        elif c.has('tbl'):
            t = P.one(by_tag('table'), c)
            body = table_rows(P, t, {'val': 'rd-val', 'ref': 'rd-ref'})
            parts.append(f'<div class="scroll-x"><table class="readout"{attrs(t, "id")}>{body}</table></div>')
        elif c.has('box'):
            parts.append(callout(P, c))
        elif c.get('id') == 'fig11':
            h3 = P.one(by_tag('h3'), c)
            st = P.one(by_id('probeStamp'), c)
            parts.append(f'<div id="fig11" class="hosts-wrap"><h3>{P.inner(h3)}</h3><p id="probeStamp" class="probe-stamp">{P.inner(st)}</p>'
                         '<div id="topo" class="hosts"></div></div>')
        else:
            raise SystemExit(f'index.html: unexpected <{c.tag} class="{c.get("class")}"> in the record; update tools/build-composer-view.py')
    out.append(f'<section id="ch2" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}'
               f'<details class="drawer"><summary>{P.inner(summary)}</summary><div class="drawer-body">{"".join(parts)}</div></details></section>')

    # --- A–Z
    s = sec['indexsec']
    out.append(f'<section id="indexsec" class="pane">{pane_head(P, P.one(by_cls("ch-head"), s))}<div class="az" id="indexList"></div></section>')
    out.append('</main>')

    # --- footer
    foot = P.one(by_tag('footer'))
    fname = P.one(by_cls('footer-name'), foot)
    fline = P.one(by_cls('footer-line'), foot)
    line = []
    for c in fline.children:
        inner = P.inner(c).replace('Vol. 03 by Claude Fable 5.1,<br>with OpenAI Astra as co-author.',
                                   'Vol. 03 · this view by <b>Cursor Composer 2.5</b>, fourth in line.')
        line.append(f'<a href="{c.get("href")}">{inner}</a>' if c.tag == 'a' else f'<span>{inner}</span>')
    out.append(f'<footer class="colophon"><div class="colophon-row"><a class="colophon-name" href="{fname.get("href")}">{P.inner(fname)}</a>'
               f'<div class="colophon-line">{"".join(line)}</div></div></footer></div></div>')

    # --- overlays
    lb = P.one(by_id('filmLightbox'))
    pal = P.one(by_id('pal'))
    pal_input = P.one(by_id('palIn'), pal)
    pal_label = P.one(by_tag('label'), pal)
    pal_foot = P.one(by_cls('pal-foot'), pal)
    out.append(
        f'<div class="theater" id="filmLightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-label="{lb.get("aria-label")}">'
        f'<button class="theater-close" id="filmClose" aria-label="{P.one(by_id("filmClose")).get("aria-label")}">&times;</button>'
        '<video id="filmVideo" controls playsinline preload="none"></video><span class="theater-cap" id="filmCap"></span></div>'
        f'<div class="finder" id="pal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="{pal.get("aria-label")}"><div class="finder-box">'
        f'<div class="finder-field"><label for="palIn">{P.inner(pal_label)}</label><input id="palIn" type="text"{attrs(pal_input, "placeholder")}'
        ' autocomplete="off" spellcheck="false" role="combobox" aria-controls="palList" aria-expanded="true"></div>'
        '<div class="finder-list" id="palList" role="listbox"></div>'
        f'<div class="finder-foot">{P.inner(pal_foot)}</div></div></div>')
    out.append('<script>\n' + HOME_JS.strip() + '\n</script>\n')
    out.append(switch_nav + '</body>\n</html>\n')
    return ''.join(out)


def entry(P, row, fix):
    """One row of a ledger (a lesson, a film, an experiment), from a source .xrow."""
    is_button = row.tag == 'button'
    xfn = P.one(by_cls('xfn'), row)
    xname = P.one(by_cls('xname'), row)
    name = P.inner(xname)
    for dot in P.all(by_cls('sdot'), xname):
        name = name.replace(P.outer(dot), f'<i class="light" data-sys="{dot.get("data-sys")}" data-state="probing"></i>')
    tag = P.one(by_cls('xtag'), row)
    keep = ('type', 'data-film', 'data-poster', 'data-title', 'data-sys', 'data-index', 'data-ref', 'data-kw', 'href', 'target', 'rel')
    ref = '' if row.get('data-ref') is not None or row.get('data-index') is None else f' data-ref="{P.text(xfn)}"'
    return (f'<{row.tag} class="entry"{fix(attrs(row, *keep))}{ref}>'
            f'<span class="entry-no">{P.inner(xfn)}</span><span class="entry-name">{name}</span>'
            f'<span class="entry-text">{P.inner(P.one(by_cls("xdesc"), row))}</span>'
            f'<span class="entry-meta"{attrs(tag, "data-lab-text")}>{P.inner(tag)}</span>'
            f'<span class="entry-act">{P.inner(P.one(by_cls("xgo"), row))}</span></{row.tag}>')


HOME_JS = r"""
(function(){
  'use strict';
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  function go(el){ el.scrollIntoView({behavior: still.matches ? 'auto' : 'smooth'}); }

  // ---------- the host registry: one list for the rail meter, the record tables, the directory and every light ----------
  var WORLDS = { med:{name:'Medicine', color:'var(--med)'}, mil:{name:'Military', color:'var(--mil)'}, mac:{name:'Machines', color:'var(--mac)'}, spt:{name:'Sports', color:'var(--spt)'}, hum:{name:'Humanities', color:'var(--hum)'}, mus:{name:'Music', color:'var(--mus)'} };
  var SYSTEMS = [
    {id:'step2',     name:'Step 2 CK Qbank',        host:'step2-ck.pages.dev',                 url:'https://step2-ck.pages.dev/',                 w:'med', ref:'3-1'},
    {id:'handoff',   name:'Handoff Tracker',        host:'patient-handoff-tracker.onrender.com', url:'https://patient-handoff-tracker.onrender.com/', w:'med', ref:'3-2', wake:true},
    {id:'ekg',       name:'Read This',              host:'seansooch.dev/ekg',                  url:'https://seansooch.dev/ekg/',                  w:'med', ref:'3-3'},
    {id:'microtd',   name:'MICRO TD',               host:'micro-td.pages.dev',                 url:'https://micro-td.pages.dev/',                 w:'med', ref:'3-4'},
    {id:'warrior',   name:'Warrior Ready',          host:'warrior-ready.pages.dev',            url:'https://warrior-ready.pages.dev/',            w:'mil', ref:'3-5'},
    {id:'toolkit',   name:'Field Toolkit',          host:'seansooch.dev/toolkit',              url:'https://seansooch.dev/toolkit/',              w:'mil', ref:'5-2'},
    {id:'agi',       name:'AGI Capability Tracker', host:'differential-c57.pages.dev',         url:'https://differential-c57.pages.dev/',         w:'mac', ref:'3-6'},
    {id:'sims',      name:'Simulators',             host:'simulators-4lb.pages.dev',           url:'https://simulators-4lb.pages.dev/',           w:'mac', ref:'3-7'},
    {id:'forge',     name:'Forge',                  host:'forge-8ce.pages.dev',                url:'https://forge-8ce.pages.dev/',                w:'mac', ref:'5-1'},
    {id:'space',     name:'Space Explorer',         host:'cic-dashboard.pages.dev',            url:'https://cic-dashboard.pages.dev/',            w:'mac', ref:'5-3'},
    {id:'multipliers',name:'Force Multipliers',     host:'seansooch.dev/force-multipliers',    url:'https://seansooch.dev/force-multipliers/',    w:'mac', ref:'5-4'},
    {id:'reading',   name:'Reading Room',           host:'reading-room.pages.dev',             url:'https://reading-room.pages.dev/',             w:'hum', ref:'4-1'},
    {id:'philosophy',name:'Philosophy Room',        host:'philosophy-room.pages.dev',          url:'https://philosophy-room.pages.dev/',          w:'hum', ref:'4-2'},
    {id:'edge',      name:'Edge Draft Terminal',    host:'edge-7yj.pages.dev',                 url:'https://edge-7yj.pages.dev/',                 w:'spt', ref:'3-8'},
    {id:'ncaat',     name:'NCAAT Bracket',          host:'ncaat-bracket-2026.pages.dev',       url:'https://ncaat-bracket-2026.pages.dev/',       w:'spt', ref:'3-9'},
    {id:'masters',   name:'Masters 2026 Hub',       host:'masters-2026.pages.dev',             url:'https://masters-2026.pages.dev/',             w:'spt', ref:'3-10'},
    {id:'detroit',   name:'Detroit Sports Hub',     host:'detroit-sports.pages.dev',           url:'https://detroit-sports.pages.dev/',           w:'spt', ref:'3-11'},
    {id:'greatbooks',name:'Great Books',            host:'great-books.pages.dev',              url:'https://great-books.pages.dev/',              w:'hum', ref:'3-12'},
    {id:'admissions',name:'AdmissionsAcademy',      host:'admissionsacademy.org',              url:'https://admissionsacademy.org/',              w:'med', ref:'3-13'},
    {id:'music',     name:'Music',                  host:'seansooch.dev/music',                url:'https://seansooch.dev/music/',                w:'mus', ref:'3-14'},
    {id:'situation', name:'Monitoring the Situation', host:'situation.seansooch.dev',           url:'https://situation.seansooch.dev/',            w:'mac', ref:'3-15'}
  ];
  SYSTEMS.forEach(function(s){ s.status = 'probing'; s.ms = null; });
  $('#sysTotal').textContent = SYSTEMS.length;
  $('#railTotal').textContent = SYSTEMS.length;
  function words(st){ return st === 'up' ? 'reachable' : st === 'down' ? 'no response' : st === 'wake' ? 'waking' : 'probing'; }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ---------- Figure 1-1: every host under its domain; on a phone the groups start closed ----------
  (function drawHosts(){
    var root = $('#topo');
    [['med','mac'],['mil','spt','hum','mus']].forEach(function(worlds){
      var col = el('div', 'hosts-col');
      worlds.forEach(function(w){
        var items = SYSTEMS.filter(function(s){ return s.w === w; });
        var group = el('details', 'hosts-group'); group.open = !window.matchMedia('(max-width: 620px)').matches;
        var sum = el('summary'); sum.appendChild(el('span', null, WORLDS[w].name)); sum.appendChild(el('span', 'hosts-count', String(items.length).padStart(2,'0')));
        group.appendChild(sum);
        var ul = el('ul');
        items.forEach(function(s){
          var a = el('a', 'hosts-link'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.id = 'node-' + s.id;
          a.appendChild(el('span', null, s.name));
          var light = el('i', 'light'); light.setAttribute('data-sys', s.id); light.setAttribute('data-state', 'probing'); light.setAttribute('aria-hidden', 'true');
          a.appendChild(light);
          a.appendChild(el('span', 'visually-hidden', ' — probing'));
          var arrow = el('span', 'hosts-arrow', '↗︎'); arrow.setAttribute('aria-hidden', 'true'); a.appendChild(arrow);
          var li = el('li'); li.appendChild(a); ul.appendChild(li);
        });
        group.appendChild(ul); col.appendChild(group);
      });
      root.appendChild(col);
    });
  })();

  // ---------- Table 2-2 ----------
  (function drawStatus(){
    var tb = $('#statusTbl tbody');
    SYSTEMS.forEach(function(s){
      var tr = el('tr'); tr.id = 'row-' + s.id;
      var td = el('td'); var a = el('a', null, s.name); a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
      td.appendChild(a); td.appendChild(document.createTextNode(' ')); td.appendChild(el('span', 'rt-fig', 'Fig. ' + s.ref)); tr.appendChild(td);
      tr.appendChild(el('td', 'rt-host', s.host));
      var dom = el('td', 'rt-host', WORLDS[s.w].name); dom.style.color = WORLDS[s.w].color; tr.appendChild(dom);
      var st = el('td'); var box = el('span', 'rt-state'); var light = el('i', 'light'); light.setAttribute('data-sys', s.id); light.setAttribute('data-state', 'probing');
      box.appendChild(light); box.appendChild(el('span', null, 'probing')); st.appendChild(box); tr.appendChild(st);
      tr.appendChild(el('td', 'rt-ms', '…'));
      tb.appendChild(tr);
    });
  })();

  // ---------- the probe ----------
  function fmtMs(ms){ return ms == null ? '…' : (Math.round(ms) + ' ms'); }
  function paint(s){
    var state = s.status;
    $$('.light[data-sys="' + s.id + '"]').forEach(function(d){ d.setAttribute('data-state', state); });
    var node = $('#node-' + s.id);
    if (node) node.querySelector('.visually-hidden').textContent = ' — ' + words(state);
    var row = $('#row-' + s.id);
    if (row){ row.querySelector('.rt-state span').textContent = words(state); row.querySelector('.rt-ms').textContent = state === 'up' ? fmtMs(s.ms) : ''; }
  }
  function summarize(){
    var done = SYSTEMS.filter(function(s){ return s.status !== 'probing' && s.status !== 'wake'; }).length;
    var up = SYSTEMS.filter(function(s){ return s.status === 'up'; }).length;
    var lat = SYSTEMS.filter(function(s){ return s.status === 'up' && !s.wake; }).map(function(s){ return s.ms; }).sort(function(a,b){ return a-b; });
    $('#sysCount').textContent = up; $('#railUp').textContent = up;
    $('#railLight').setAttribute('data-state', done === SYSTEMS.length ? (up ? 'up' : 'down') : 'wake');
    if (lat.length){ var m = lat.length % 2 ? lat[(lat.length-1)/2] : (lat[lat.length/2-1] + lat[lat.length/2]) / 2; $('#medianMs').textContent = Math.round(m); }
    var stamp = $('#probeStamp'), hh = new Date().toTimeString().slice(0,5);
    if (done === SYSTEMS.length){
      stamp.textContent = 'status: ' + up + ' of ' + SYSTEMS.length + ' reachable · measured ' + hh + ' local';
      $('#probeWhen').textContent = 'at ' + hh;
    } else {
      stamp.textContent = 'status: ' + up + ' reachable, ' + (SYSTEMS.length - done) + ' probing…';
    }
  }
  function probe(s){
    var t0 = performance.now();
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, s.wake ? 90000 : 20000);
    var wakeTimer = s.wake ? setTimeout(function(){ if (s.status === 'probing'){ s.status = 'wake'; paint(s); summarize(); } }, 4000) : null;
    var sameOrigin = s.url.indexOf(location.origin + '/') === 0;
    var opts = { method:'GET', cache:'no-store', redirect:'follow', credentials:'omit' };
    if (!sameOrigin) opts.mode = 'no-cors';
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(s.url, opts).then(function(r){
      s.ms = performance.now() - t0; s.status = (sameOrigin && !r.ok) ? 'down' : 'up';
    }).catch(function(){ s.ms = null; s.status = 'down'; }).then(function(){
      clearTimeout(timer); if (wakeTimer) clearTimeout(wakeTimer); paint(s); summarize();
    });
  }
  if (window.fetch){
    SYSTEMS.forEach(paint); summarize();
    SYSTEMS.forEach(function(s, i){ setTimeout(function(){ probe(s); }, i * 60); });  // staggered: one measurement per host, not a burst
  } else {
    $('#probeStamp').textContent = 'status: this browser cannot probe';
  }

  // ---------- disciplines: hovering a key lends the page its colour, leaving gives it back; a click filters ----------
  var label = $('#domLabel'), base = label.textContent;
  var segs = $$('.seg-btn'), procs = $$('#grid .proc');
  function applyFilter(f){
    procs.forEach(function(p){ p.hidden = f !== 'all' && p.getAttribute('data-d') !== f; });
    segs.forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === f)); });
  }
  $$('.sw-key').forEach(function(b){
    var color = getComputedStyle(b).getPropertyValue('--w').trim() || getComputedStyle(b).getPropertyValue('--d').trim();
    function lend(){ document.documentElement.style.setProperty('--accent', getComputedStyle(b).getPropertyValue('--d').trim() || color); label.textContent = b.getAttribute('data-label'); }
    function give(){ document.documentElement.style.removeProperty('--accent'); label.textContent = base; }
    b.addEventListener('mouseenter', lend); b.addEventListener('focus', lend);
    b.addEventListener('mouseleave', give); b.addEventListener('blur', give);
    b.addEventListener('click', function(){ give(); applyFilter(b.getAttribute('data-filter')); go($('#ch3')); });
  });
  segs.forEach(function(b){ b.addEventListener('click', function(){ applyFilter(b.getAttribute('data-f')); }); });

  // ---------- plain language ----------
  var modeBtn = $('#modeBtn'), simple = false;
  modeBtn.addEventListener('click', function(){
    simple = !simple;
    modeBtn.setAttribute('aria-pressed', String(simple));
    modeBtn.textContent = simple ? 'Technical language' : 'Plain language';
    $$('[data-tech]').forEach(function(e){ e.innerHTML = simple ? e.getAttribute('data-simple') : e.getAttribute('data-tech'); });
  });

  // ---------- the rail follows the reader ----------
  var railLinks = $$('.rail-link');
  if ('IntersectionObserver' in window){
    var seen = {};
    var io = new IntersectionObserver(function(list){
      list.forEach(function(en){ seen[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : null; });
      var best = null, bestTop = -Infinity;
      Object.keys(seen).forEach(function(id){ var t = seen[id]; if (t != null && t <= window.innerHeight * .5 && t > bestTop){ bestTop = t; best = id; } });
      if (!best) Object.keys(seen).forEach(function(id){ if (seen[id] != null && (best == null || seen[id] < seen[best])) best = id; });
      railLinks.forEach(function(a){ if (a.getAttribute('href') === '#' + best) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }, {rootMargin: '0px 0px -40% 0px', threshold: [0, .01]});
    $$('main > section[id]').forEach(function(s){ io.observe(s); });
  }

  // ---------- films ----------
  var box = $('#filmLightbox'), vid = $('#filmVideo'), closeBtn = $('#filmClose'), cap = $('#filmCap'), lastTrigger = null;
  function openFilm(btn){
    lastTrigger = btn;
    vid.setAttribute('poster', btn.getAttribute('data-poster') || '');
    vid.src = btn.getAttribute('data-film');
    cap.textContent = btn.getAttribute('data-title');
    box.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    var p = vid.play(); if (p && p.catch) p.catch(function(){});
    closeBtn.focus();
  }
  function closeFilm(){
    box.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    vid.pause(); vid.removeAttribute('src'); vid.load();
    if (lastTrigger) lastTrigger.focus();
  }
  $$('[data-film]').forEach(function(b){ b.addEventListener('click', function(){ openFilm(b); }); });
  closeBtn.addEventListener('click', closeFilm);
  box.addEventListener('click', function(e){ if (e.target === box) closeFilm(); });

  // ---------- the index: read from the page, so it cannot drift from the content ----------
  var ENTRIES = [];
  function readIndex(){
    ENTRIES.length = 0;
    $$('[data-index]').forEach(function(e){
      ENTRIES.push({ title: e.getAttribute('data-index').replace('&amp;','&'), kw: e.getAttribute('data-kw') || '',
        href: e.getAttribute('href') || e.getAttribute('data-href') || null, ref: e.getAttribute('data-ref') || '', el: e });
    });
    [['Chapter 1','Purpose and scope','#ch1','chapter thesis method'],['Chapter 2','Readiness','#ch2','chapter status probe table vitals'],['Chapter 3','Systems','#ch3','chapter work projects'],['Chapter 4','Doctrine','#ch4','chapter research writing papers'],['Chapter 5','Ancillary equipment','#ch5','chapter explorables'],['Appendix A','Change record','#appa','editions archive volumes'],['Appendix B','Films','#appb','video'],['Figure 1-1','System directory','#fig11','live status map']]
      .forEach(function(c){ ENTRIES.push({ title:c[1], kw:c[3] + ' ' + c[0].toLowerCase(), href:c[2], ref:c[0], el:null }); });
    ENTRIES.sort(function(a,b){ return a.title.localeCompare(b.title, 'en', {sensitivity:'base'}); });
  }
  readIndex();
  function openEntry(en){
    if (!en) return;
    if (en.el && en.el.hasAttribute('data-film')){ closePal(); openFilm(en.el); return; }
    if (!en.href) return;
    if (en.href.charAt(0) === '#'){
      closePal();
      var t = $(en.href);
      if (t){ for (var p = t.parentElement; p; p = p.parentElement){ if (p.tagName === 'DETAILS') p.open = true; } go(t); }
      return;
    }
    window.open(en.href, '_blank', 'noopener');
    closePal();
  }
  var list = $('#indexList');
  function printIndex(){
    var groups = {}; list.textContent = '';
    ENTRIES.forEach(function(en){ var L = en.title.charAt(0).toUpperCase(); if (!/[A-Z]/.test(L)) L = '#'; (groups[L] = groups[L] || []).push(en); });
    Object.keys(groups).sort().forEach(function(L){
      var g = el('div', 'az-group'); g.appendChild(el('div', 'az-letter', L));
      groups[L].forEach(function(en){
        var a = el('a', 'az-entry');
        a.href = en.href || '#'; if (en.href && en.href.charAt(0) !== '#'){ a.target = '_blank'; a.rel = 'noopener'; }
        a.appendChild(el('span', null, en.title)); a.appendChild(el('span', 'az-leader')); a.appendChild(el('span', 'az-ref', en.ref));
        if (en.el && en.el.hasAttribute('data-film')) a.addEventListener('click', function(ev){ ev.preventDefault(); openFilm(en.el); });
        else if (en.href && en.href.charAt(0) === '#') a.addEventListener('click', function(ev){ ev.preventDefault(); openEntry(en); });
        g.appendChild(a);
      });
      list.appendChild(g);
    });
  }
  printIndex();
  // the Lab's rows arrive after load (lab-course.js): read the page again then
  document.addEventListener('lab:course', function(){ readIndex(); printIndex(); });

  // ---------- the finder (press /) ----------
  var pal = $('#pal'), palIn = $('#palIn'), palList = $('#palList'), sel = 0, shown = [], palTrigger = null;
  function score(en, q){
    if (!q) return 1;
    var hay = (en.title + ' ' + en.kw + ' ' + en.ref).toLowerCase(), title = en.title.toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), sc = 0;
    for (var i = 0; i < terms.length; i++){
      var t = terms[i];
      if (title.indexOf(t) === 0) sc += 3; else if (title.indexOf(t) >= 0) sc += 2; else if (hay.indexOf(t) >= 0) sc += 1; else return 0;
    }
    return sc;
  }
  function mark(){ $$('.finder-item', palList).forEach(function(x, j){ x.setAttribute('aria-selected', String(j === sel)); if (j === sel) x.scrollIntoView({block:'nearest'}); }); }
  function renderPal(){
    var q = palIn.value.trim();
    shown = ENTRIES.map(function(en){ return {en:en, s:score(en,q)}; }).filter(function(x){ return x.s > 0; })
      .sort(function(a,b){ return b.s - a.s || a.en.title.localeCompare(b.en.title); }).slice(0, 12).map(function(x){ return x.en; });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    palList.textContent = '';
    if (!shown.length){ palList.appendChild(el('div', 'finder-empty', 'Nothing in the index matches "' + q + '".')); return; }
    shown.forEach(function(en, i){
      var a = el('a', 'finder-item'); a.href = en.href || '#'; a.setAttribute('role', 'option');
      var left = el('span', null, en.title);
      left.appendChild(el('small', null, en.href && en.href.charAt(0) !== '#' ? en.href.replace(/^https?:\/\//,'').replace(/\/$/,'') : 'on this page'));
      a.appendChild(left); a.appendChild(el('span', 'finder-ref', en.ref));
      a.addEventListener('click', function(ev){ ev.preventDefault(); openEntry(en); });
      a.addEventListener('mousemove', function(){ if (sel !== i){ sel = i; mark(); } });
      palList.appendChild(a);
    });
    mark();
  }
  function openPal(){ palTrigger = document.activeElement; pal.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; palIn.value = ''; sel = 0; renderPal(); setTimeout(function(){ palIn.focus(); }, 0); }
  function closePal(){ pal.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; if (palTrigger) palTrigger.focus(); }
  $('#palBtn').addEventListener('click', openPal);
  pal.addEventListener('click', function(e){ if (e.target === pal) closePal(); });
  palIn.addEventListener('input', function(){ sel = 0; renderPal(); });
  palIn.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    else if (e.key === 'Enter'){ e.preventDefault(); openEntry(shown[sel]); }
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Tab'){
      var modal = pal.getAttribute('aria-hidden') === 'false' ? pal : box.getAttribute('aria-hidden') === 'false' ? box : null;
      if (modal){
        var f = $$('button, input, a[href], video[controls]', modal), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
    var typing = /input|textarea|select/i.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape'){
      if (pal.getAttribute('aria-hidden') === 'false') closePal();
      else if (box.getAttribute('aria-hidden') === 'false') closeFilm();
      return;
    }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey){ e.preventDefault(); openPal(); }
  });
})();
"""


# ---------------------------------------------------------------------------------------------------------------
# Two Stories About the Beginning

ESSAY_PAIRS = [
    ('href="/"', f'href="{BASE}"'),
    ('href="/#', f'href="{BASE}#'),
    ('href="/lab/"', f'href="{BASE}lab/"'),
    ('in the Field Manual', 'in The Live Stack'),
    ('Field Manual, Vol. 03', 'The Live Stack, Vol. 03'),
    ('FM 03', 'LS 03'),
]


def lede(P, plate, fix, aside_cls):
    row = P.one(by_cls('row'), plate)
    spans = kids(row, 'span')
    left = P.inner(spans[0])
    h1 = P.one(by_tag('h1'), plate)
    sub = P.one(by_cls('sub'), plate)
    aside = P.one(by_tag('aside'), plate)
    lbl = P.one(by_cls('lbl'), aside)
    paras = ''.join(f'<p>{fix(P.inner(p))}</p>' for p in kids(aside, 'p'))
    facts = []
    for d in kids(P.one(by_cls('foot'), plate), 'div'):
        facts.append(f'<div>{fix(P.inner(d))}</div>')
    return (f'<header class="lede"><p class="lede-bar"><span>{P.text(spans[0]) if "<span" in left else left}</span><span>{P.inner(spans[1])}</span></p>'
            f'<div class="lede-grid"><div><h1 class="lede-title">{P.inner(h1)}</h1><p class="lede-sub">{fix(P.inner(sub))}</p></div>'
            f'<aside class="lede-aside" aria-label="{P.text(lbl)}"><span class="lede-label">{P.inner(lbl)}</span>{paras}</aside></div>'
            f'<div class="lede-facts">{"".join(facts)}</div></header>')


def reading_rail(P, top, fix, mark_inner, mark_label, mark_href, sub, back_cls):
    nav = P.one(by_cls('nav'), top)
    fixhref = lambda u: fix(f'href="{u}"')[6:-1]
    items, controls = [], []
    for a in kids(nav, 'a'):
        if a.has('nav-lab') or a.has(back_cls):
            continue
        b = P.all(by_tag('b'), a)
        pid = P.inner(b[0]) if b else '·'
        label = P.inner(a).replace(P.outer(b[0]), '').strip() if b else P.inner(a)
        items.append((pid, label, fixhref(a.get('href')), ''))
    for a in kids(nav, 'a'):
        if a.has('nav-lab'):
            current = ' aria-current="page"' if a.get('aria-current') else ''
            label = re.sub(r'<b>[^<]*</b>\s*', '', P.inner(a))
            label = 'The Lab' if label == 'Lab' else label
            controls.append(f'<a class="rail-btn rail-btn--go" href="{fixhref(a.get("href"))}"{current}><span>{label}</span><span aria-hidden="true">↗</span></a>')
    for a in kids(nav, 'a'):
        if a.has(back_cls):
            controls.append(f'<a class="rail-btn" href="{fixhref(a.get("href"))}">{P.inner(a)}</a>')
    return rail(mark_href, mark_inner, mark_label, sub, items, ''.join(controls), head_label=fix(nav.get('aria-label')),
                nav_label=fix(nav.get('aria-label')))


def build_essay():
    P = Page('two-stories/index.html')
    src = P.src
    switch_head, switch_nav = switcher(src, P.path)
    fix = lambda s: swap(s, ESSAY_PAIRS)
    out = [head(
        re.search(r'<title>(.*?)</title>', src).group(1).replace('&amp;', '&'),
        meta(src, name='description'), meta(src, prop='og:title'), meta(src, prop='og:description'), 'article',
        meta(src, prop='og:url'), BASE_CSS + READ_CSS, switch_head,
        canonical=re.search(r'<link rel="canonical" href="([^"]*)">', src).group(1))]
    top = P.one(by_cls('top', 'header'), what='header')
    brand = P.one(by_cls('brand'), top)
    skip = P.one(by_cls('skip'))
    out.append(f'<body><a class="skiplink" href="{skip.get("href")}">{P.inner(skip)}</a><div class="console">')
    out.append(reading_rail(P, top, fix, P.inner(brand), brand.get('aria-label'), BASE, 'THE LIVE STACK<br>TABLE 4-3 · A LONG READ', 'back'))
    out.append('<div class="stage"><main id="top">')
    plate = P.one(by_cls('plate'), what='title plate')
    out.append(lede(P, plate, fix, 'abstract'))
    for s in P.need(P.all(lambda n: n.tag == 'section' and n.has('part')), 'parts', 4):
        sid = s.get('id')
        open_tag = f'<section id="{sid}" class="pane">' if sid else '<section class="pane" aria-label="Note">'
        heads = P.all(by_cls('ch-head'), s)
        body = []
        for c in s.children:
            if c.has('ch-head'):
                continue
            if c.has('essay'):
                paras = []
                for d in P.need(kids(c, 'div'), 'paragraphs'):
                    key = ' data-key' if d.has('key') else ''
                    paras.append(f'<div class="prose-p" data-part="{d.get("data-part")}"{key}>{fix(P.inner(d))}</div>')
                body.append('<div class="prose">' + '\n'.join(paras) + '</div>')
            elif c.has('tbl'):
                t = P.one(by_tag('table'), c)
                rows = table_rows(P, t, {'k': 'cmp-key', 'same': 'cmp-same'}, row_attrs=())
                body.append(f'<div class="scroll-x"><table class="compare">{rows}</table></div>')
            elif c.has('cap'):
                body.append(f'<p class="tnote">{P.inner(c)}</p>')
            elif c.has('box'):
                body.append(fix(callout(P, c)))
            else:
                raise SystemExit(f'{P.path}: unexpected <{c.tag} class="{c.get("class")}"> in a part; update tools/build-composer-view.py')
        hd = pane_head(P, heads[0]) if heads else ''
        out.append(open_tag + hd + ''.join(body) + '</section>')
    out.append('</main>')
    foot = P.one(by_tag('footer'))
    spans = kids(P.one(by_tag('div'), foot), 'span')
    out.append('<footer class="colophon"><div class="colophon-row"><a class="colophon-name" href="#top">SOOCH<span>↑</span></a><div class="colophon-line">'
               + ''.join(f'<span>{fix(P.inner(x)).replace(" style=" + chr(34) + "color:inherit" + chr(34), "")}</span>' for x in spans)
               + '</div></div></footer></div></div>\n')
    out.append(switch_nav + '</body>\n</html>\n')
    return ''.join(out)


# ---------------------------------------------------------------------------------------------------------------
# The Lab course page

LAB_PAIRS = [
    ('/designs/fable/', BASE),
    ('of the Field Manual', 'of The Live Stack'),
    ('the Field Manual', 'The Live Stack'),
    ('Field Manual', 'The Live Stack'),
    ('FM 03', 'LS 03'),
    ('Annex L', 'Module L'),
    ('ANNEX L', 'MODULE L'),
]


def build_lab():
    P = Page('designs/fable/lab/index.html')
    src = P.src
    switch_head, switch_nav = switcher(src, P.path)
    fix = lambda s: swap(s, LAB_PAIRS)
    out = [head(
        'The Lab | Sean Sooch, The Live Stack', meta(src, name='description'), meta(src, prop='og:title'), meta(src, prop='og:description'),
        'website', 'https://seansooch.dev/designs/composer/lab/', BASE_CSS + READ_CSS, switch_head,
        canonical='https://seansooch.dev/designs/composer/lab/')]
    top = P.one(by_cls('top'), what='header')
    mark = P.one(by_cls('mark'), top)
    out.append('<body><a class="skiplink" href="#course">Skip to the course</a><div class="console">')
    fm, nm = P.one(by_cls('fm'), mark), P.one(by_cls('nm'), mark)
    mark_inner = fix(P.inner(fm)).replace(' ', '<span>—</span>', 1)
    out.append(reading_rail(P, top, fix, mark_inner, fix(mark.get('aria-label')), BASE, f'{P.inner(nm)}<br>THE LIVE STACK · MODULE L', 'btn'))
    out.append('<div class="stage"><main id="top">')
    plate = P.one(by_cls('plate'), what='title plate')
    out.append(fix(lede(P, plate, fix, 'rules')))
    course = P.one(by_id('course'), what='course section')
    lst = P.one(lambda n: n.get('data-lab-list') == 'all', course, 'course list')
    tpls = {t.get('data-lab-row'): t for t in P.all(by_tag('template'), lst)}
    if set(tpls) != {'ready', 'soon'}:
        raise SystemExit(f'{P.path}: the course list needs ready and soon templates; update tools/build-composer-view.py')
    ready_go = P.inner(P.one(by_cls('go'), tpls['ready']))
    soon_when = P.inner(P.one(by_cls('when'), tpls['soon']))
    wait = P.one(lambda n: n.get('data-lab-wait') is not None, lst, 'waiting note')
    cap = P.one(by_cls('cap'), course)
    desc = ('<span class="lesson-desc"><span data-lab="description"></span><span class="lesson-topics" data-lab="topics"></span></span>')
    out.append(
        f'<section id="course" class="pane">{fix(pane_head(P, P.one(by_cls("ch-head"), course)))}'
        '<div class="course" data-lab-list="all">'
        '<template data-lab-row="ready"><a class="lesson" data-lab-link>'
        f'<span class="lesson-no">L-<span data-lab="no"></span></span><span class="lesson-name" data-lab="title"></span>{desc}'
        f'<span class="lesson-when"><span data-lab="date"></span><span class="lesson-go">{ready_go}</span></span></a></template>'
        '<template data-lab-row="soon"><div class="lesson" data-soon>'
        f'<span class="lesson-no">L-<span data-lab="no"></span></span><span class="lesson-name" data-lab="title"></span>{desc}'
        f'<span class="lesson-when">{soon_when}</span></div></template>'
        f'<p class="lesson-wait" data-lab-wait>{P.inner(wait)}</p></div>'
        f'<p class="tnote">{fix(P.inner(cap))}</p></section>')
    for s in P.all(lambda n: n.tag == 'section' and n.has('part') and n.get('id') != 'course'):
        for b in P.all(by_cls('box'), s):
            out.append('<section class="pane" aria-label="Note">' + fix(callout(P, b)) + '</section>')
    out.append('</main>')
    foot = P.one(by_tag('footer'))
    spans = kids(P.one(by_tag('div'), foot), 'span')
    out.append('<footer class="colophon"><div class="colophon-row"><a class="colophon-name" href="#top">SOOCH<span>↑</span></a><div class="colophon-line">'
               + ''.join(f'<span>{fix(P.inner(x)).replace(" style=" + chr(34) + "color:inherit" + chr(34), "")}</span>' for x in spans)
               + '</div></div></footer></div></div>\n')
    out.append(switch_nav + '</body>\n</html>\n')
    return ''.join(out)


def main():
    pages = {
        OUT / 'index.html': build_home(),
        OUT / 'two-stories/index.html': build_essay(),
        OUT / 'lab/index.html': build_lab(),
    }
    for path, text in pages.items():
        if OUT not in path.parents:
            raise SystemExit(f'refusing to write outside {OUT}: {path}')
        if 'design-switcher:start' not in text or 'data-design="composer"' not in text:
            raise SystemExit(f'{path}: built without the switcher')
        path.parent.mkdir(parents=True, exist_ok=True)
        old = path.read_text(encoding='utf-8') if path.exists() else None
        if old != text:
            path.write_text(text, encoding='utf-8')
        print(f'{"wrote" if old != text else "unchanged"}  {path.relative_to(ROOT)}  ({len(text):,} bytes)')


if __name__ == '__main__':
    main()
