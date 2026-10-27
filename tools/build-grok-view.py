#!/usr/bin/env python3
"""Generate the Grok view ("The Night Orbit") from view A's pages.

Reads    index.html, two-stories/index.html (view A: the words, figures and data hooks, the views band, Table A-1 and
         the switcher) and designs/fable/lab/index.html (the switcher of the Lab page, with lab-course.js)
Writes   designs/grok/index.html, designs/grok/two-stories/index.html, designs/grok/lab/index.html,
         designs/grok/nasa-plates.js, and this view's row in ARCHITECTURE.md; nothing else.

Every page of this view carries view A's switcher with this view selected, and lists the views and editions view A
lists. View A renders both from the shared editions record, so a new view or edition needs no edit here: rebuild view
A, copy it in, rerun this. Safe to re-run; a rerun on an unchanged tree changes nothing. It does not edit lesson apps,
other views' pages or the switcher's assets.
"""
from __future__ import annotations

import hashlib
import html as htmlmod
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLATES_JS = ROOT / 'designs' / 'grok' / 'nasa-plates.js'
# slots per page: home 0-4 (0 is the hero), Two Stories 5-7, Lab 8-9; nasa-plates.js maps slot N to the Nth picture day
SLOTS = {'index.html': range(0, 5), 'two-stories/index.html': range(5, 8), 'lab/index.html': range(8, 10)}

# The switcher is view A's: each page of this view takes the head block of view A's page at the same address byte for
# byte (its ?v= stamps are what tools/stage.sh checks) and its nav with this view selected. View A's switcher is made
# from the shared editions record, so this view offers the same views in the same order. The switcher's assets
# (design-switcher.css/.js) and the other views' pages are not this builder's to write.
SWITCH_HEAD = re.compile(r'<!-- design-switcher:start --><link.*?<!-- design-switcher:end -->', re.S)
SWITCH_NAV = re.compile(r'<!-- design-switcher:start --><nav class="design-switcher".*?<!-- design-switcher:end -->', re.S)
# The Lab page takes view F's: view A's /lab/ is the course page itself and loads no lab-course.js, which this view's
# Lab page needs to draw its lessons.
SWITCH_SOURCE = {'': 'index.html', 'two-stories': 'two-stories/index.html', 'lab': 'designs/fable/lab/index.html'}
CURTAIN = ('GROK 4.7', 'THE NIGHT ORBIT')

PAGE_CSS = r"""
:root { --void:#0b0a12; --panel:#141221; --ink:#f4efe6; --muted:#c9c3d4; --brass:#e2a15c; --line:rgba(244,239,230,.16); --serif:Georgia,"Iowan Old Style",Palatino,"Palatino Linotype","Times New Roman",serif; --sans:system-ui,"Segoe UI",sans-serif; --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; }
*{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:var(--void);color:var(--ink);font:18px/1.65 var(--serif)} img{max-width:100%;height:auto} a{color:var(--brass)} :focus-visible{outline:2px solid var(--brass);outline-offset:3px} ::selection{background:var(--brass);color:var(--void)}
.gk-skip{position:absolute;left:12px;top:-48px;background:var(--brass);color:var(--void);padding:8px 12px;z-index:100;text-decoration:none;font-family:var(--sans)} .gk-skip:focus{top:12px}
.gk-bar{position:sticky;top:0;z-index:40;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;padding:14px 22px;background:rgba(11,10,18,.94);border-bottom:1px solid rgba(226,161,92,.45)}
.gk-brand{color:var(--ink);text-decoration:none;font-family:var(--sans);font-weight:600;letter-spacing:.22em;font-size:13px} .gk-brand i{color:var(--brass);font-style:normal;margin-right:8px}
.gk-nav{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center} .gk-nav a,.gk-nav button{color:var(--muted);text-decoration:none;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;background:none;border:0;padding:0;cursor:pointer} .gk-nav a[aria-current="page"],.gk-nav a:hover,.gk-nav button:hover{color:var(--brass)}
.gk-wrap{max-width:1120px;margin:0 auto;padding:0 28px} .gk-station{padding:72px 0 12px;scroll-margin-top:76px} #fig11,#plate1{scroll-margin-top:76px}
.gk-kicker{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--brass);margin:0}
.gk-station h2,.gk-hero h1{font-family:var(--serif);font-weight:400;letter-spacing:-.03em;margin:8px 0 12px} .gk-station h2{font-size:clamp(36px,5vw,64px);line-height:1} .gk-lead{color:var(--muted);max-width:66ch;margin:0 0 8px}
.gk-hero{display:grid;grid-template-columns:1.35fr .9fr;min-height:calc(100svh - 62px)} .gk-hero-media{position:relative;overflow:hidden;min-height:46vw;margin:0;background:var(--panel)} .gk-hero-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.gk-hero-media figcaption{position:absolute;left:0;right:0;bottom:0;padding:40px 22px 14px;background:linear-gradient(rgba(11,10,18,0),rgba(11,10,18,.86));font-family:var(--mono);font-size:11px;line-height:1.5;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)} .gk-hero-media figcaption a,.gk-plate figcaption a{color:var(--ink);text-decoration:none} .gk-hero-media figcaption a:hover,.gk-plate figcaption a:hover{color:var(--brass)}
.gk-hero-copy{padding:clamp(28px,5vw,64px) clamp(28px,5vw,64px) 132px;display:flex;flex-direction:column;justify-content:flex-end;gap:16px;border-left:1px solid rgba(226,161,92,.45)} .gk-hero h1{font-size:clamp(64px,8vw,112px);line-height:.86;margin:0} .gk-hero h1 span{display:block}
.gk-ring{animation:gk-spin 90s linear infinite;transform-origin:center} @keyframes gk-spin{to{transform:rotate(360deg)}}
.gk-triad{display:flex;flex-wrap:wrap;gap:10px 18px;margin:0} .gk-triad button{background:none;border:0;color:var(--ink);font-family:var(--sans);font-size:16px;cursor:pointer;padding:0} .gk-triad button span{color:var(--brass);font-family:var(--mono);font-size:12px;margin-left:6px}
.gk-plate{margin:0} .gk-plate img{width:100%;height:auto;max-height:82vh;object-fit:cover;display:block} .gk-plate img[data-apod]{aspect-ratio:16/9;background:var(--panel)}.gk-plate figcaption{max-width:1120px;margin:0 auto;padding:10px 28px 0;font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.gk-freq{display:flex;flex-wrap:wrap;gap:8px 18px;margin:22px 0 6px} .gk-freq button{background:none;border:0;border-bottom:1px solid transparent;color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:.08em;padding:6px 0;cursor:pointer} .gk-freq button[aria-pressed="true"]{color:var(--ink);border-bottom-color:var(--brass)}
.gk-manifest,.gk-lesson{display:grid;grid-template-columns:4.5rem minmax(0,1fr) auto;gap:8px 22px;align-items:start;padding:22px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit;background:none;width:100%;text-align:left;cursor:pointer;font:inherit}
button.gk-manifest{border-left:0;border-right:0;border-bottom:0} .gk-manifest[hidden],.gk-lesson[hidden]{display:none !important}
.gk-no{font-family:var(--mono);color:var(--brass);font-size:13px;letter-spacing:.08em;padding-top:6px} .gk-name{display:block;font-family:var(--sans);font-weight:600;font-size:22px;letter-spacing:-.02em;line-height:1.2;color:var(--ink)} .gk-desc{display:block;margin-top:6px;color:var(--muted);font-size:16.5px} .gk-stats{display:block;margin-top:8px;font-family:var(--mono);font-size:12px;color:var(--muted)} .gk-end{text-align:right;font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--brass)} .gk-go{display:block;margin-top:4px}
.gk-flag{display:inline-block;margin-left:8px;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--void);background:var(--brass);padding:2px 6px;vertical-align:3px}
.gk-pip,.gk-dir-st{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-family:var(--mono);font-size:12px} .gk-pip i,.gk-st i,.gk-dir-st i{width:8px;height:8px;border-radius:50%;background:var(--muted);display:inline-block} .gk-pip.up i,.gk-st.up i,.gk-dir-link.up i{background:#b7e0a8} .gk-pip.down i,.gk-st.down i,.gk-dir-link.down i{background:#ffb4a8} .gk-pip.wake i,.gk-st.wake i,.gk-dir-link.wake i{background:#f0c56e}
.gk-layers{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;margin:16px 0 8px} .gk-layers div{display:grid;grid-template-columns:2rem 1fr;gap:8px} .gk-layers b{display:block;color:var(--ink);font-weight:600} .gk-layers span{color:var(--muted);font-size:15px} .gk-links{display:flex;flex-wrap:wrap;gap:8px 18px;margin:8px 0 28px;font-family:var(--mono);font-size:13px}
.gk-note{display:grid;grid-template-columns:6rem 1fr;gap:12px;border-top:1px solid rgba(226,161,92,.45);border-bottom:1px solid rgba(226,161,92,.45);padding:14px 0;margin:22px 0;color:var(--muted)} .gk-note strong,.gk-note b{color:var(--ink)} .gk-scroll{overflow-x:auto} table{width:100%;border-collapse:collapse;min-width:640px} th{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-align:left;color:var(--brass);font-weight:500;padding:12px 14px;border-bottom:1px solid var(--brass)} td{padding:14px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--muted);font-size:16px} td.gk-ink,td.gk-same{color:var(--ink)} td a{color:var(--ink)}
.gk-view{display:grid;grid-template-columns:3rem minmax(0,1fr) auto;gap:6px 16px;padding:16px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit} .gk-view.is-here{box-shadow:inset 2px 0 0 var(--brass);padding-left:12px} .gk-view p{margin:4px 0 0;color:var(--muted);font-size:15px}
.gk-record summary{cursor:pointer;font-family:var(--sans);font-size:20px;color:var(--ink)} .gk-dir{border-top:1px solid var(--line);padding:10px 0} .gk-dir summary{display:flex;justify-content:space-between;cursor:pointer;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--brass)} .gk-dir ul{list-style:none;margin:8px 0 0;padding:0} .gk-dir-link{display:flex;justify-content:space-between;gap:12px;text-decoration:none;color:var(--ink);padding:6px 0}
.gk-index{columns:2;column-gap:32px} .gk-ix{break-inside:avoid;margin:0 0 18px} .gk-ix-l{font-family:var(--mono);color:var(--brass);font-size:12px;letter-spacing:.16em;margin:0 0 6px} .gk-ix a{display:flex;justify-content:space-between;gap:12px;text-decoration:none;color:var(--ink);padding:4px 0;border-bottom:1px solid var(--line);font-size:16px} .gk-ix-ref{color:var(--muted);font-family:var(--mono);font-size:11px;white-space:nowrap}
.gk-find,.gk-stage{position:fixed;inset:0;z-index:90;background:rgba(8,7,14,.8);display:grid;place-items:center;padding:24px} .gk-find[hidden],.gk-stage[hidden]{display:none !important} .gk-panel{width:min(680px,100%);background:var(--panel);border:1px solid rgba(226,161,92,.55);padding:18px} .gk-panel input{width:100%;background:transparent;border:0;border-bottom:1px solid rgba(226,161,92,.55);color:var(--ink);font:20px var(--serif);padding:8px 0} .gk-hit{display:flex;width:100%;justify-content:space-between;gap:12px;background:none;border:0;color:var(--ink);font:16px var(--serif);text-align:left;padding:8px 0;cursor:pointer} .gk-hit.is-on{color:var(--brass)} .gk-stage video{width:min(960px,100%);background:#000} .gk-x{background:none;border:0;color:var(--ink);font-size:28px;cursor:pointer;float:right}
.gk-foot{margin-top:56px;padding:28px;border-top:1px solid rgba(226,161,92,.45);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-family:var(--mono);font-size:12px;letter-spacing:.04em;color:var(--muted)} .gk-foot a{color:var(--ink);text-decoration:none}
.gk-para{display:grid;grid-template-columns:3.2rem 1fr;gap:12px;margin:0 0 22px} .gk-para p{margin:0;max-width:68ch} .gk-para.is-key p{font-size:21px;line-height:1.55} .gk-pn{font-family:var(--mono);color:var(--brass);font-size:12px;padding-top:6px} .gk-essay h1{font-family:var(--serif);font-weight:400;font-size:clamp(46px,7vw,84px);line-height:.95;letter-spacing:-.03em;margin:12px 0} .gk-abstract{background:var(--panel);border-left:2px solid var(--brass);padding:18px 20px;color:var(--muted)} .gk-abstract p{margin:0 0 12px} .gk-abstract p:last-child{margin:0} .gk-topics{display:block;margin-top:6px;font-family:var(--mono);font-size:12px;color:var(--muted);line-height:1.5} .gk-lesson.is-soon .gk-name{color:var(--muted);font-weight:500}
.gk-soon{color:var(--muted)} .gk-meta{color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:.06em}
@media(max-width:860px){.gk-hero{grid-template-columns:1fr;min-height:0}.gk-hero-media{min-height:58vw}.gk-hero-media figcaption{padding:24px 18px 8px;font-size:10px}.gk-hero-copy{border-left:0;border-top:1px solid rgba(226,161,92,.45)}.gk-layers,.gk-index{grid-template-columns:1fr;columns:1}}
@media(max-width:700px){.gk-wrap{padding:0 18px}.gk-manifest,.gk-lesson,.gk-view{grid-template-columns:3rem minmax(0,1fr)}.gk-end{grid-column:2;text-align:left}.gk-note,.gk-para{grid-template-columns:1fr}.gk-name{font-size:19px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.gk-ring{animation:none}.gk-video{display:none !important}.gk-manifest,.gk-freq button,.gk-hit{transition:none}}
@media print{.gk-bar,.gk-find,.gk-stage,.gk-freq{display:none !important}body{background:#fff;color:#111}a,.gk-name,.gk-kicker{color:#111}.gk-plate img{max-height:none}}
"""

# The home-page script is filled with the system registry from view A.
PAGE_JS = r"""
(function(){
  'use strict';
  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, text){ var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var SYSTEMS = %%SYSTEMS%%;
  var WORLDS = {med:{name:'Medicine'},mil:{name:'Military'},mac:{name:'Machines'},spt:{name:'Sports'},hum:{name:'Humanities'},mus:{name:'Music'}};
  SYSTEMS.forEach(function(s){ s.status = 'probing'; s.ms = null; });
  var total = $('#sysTotal'); if (total) total.textContent = String(SYSTEMS.length);
  var topo = $('#topo');
  if (topo) ['med','mil','mac','spt','hum','mus'].forEach(function(w){
    var items = SYSTEMS.filter(function(s){ return s.w === w; });
    if (!items.length || !WORLDS[w]) return;
    var group = document.createElement('details'); group.className = 'gk-dir';
    group.open = !matchMedia('(max-width: 700px)').matches;
    var sum = document.createElement('summary');
    sum.appendChild(el('span', null, WORLDS[w].name));
    sum.appendChild(el('span', null, String(items.length)));
    group.appendChild(sum);
    var list = document.createElement('ul');
    items.forEach(function(s){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'gk-dir-link'; a.setAttribute('data-node', s.id);
      a.appendChild(el('span', 'gk-dir-sys', s.name));
      var st = el('span', 'gk-dir-st');
      st.appendChild(document.createElement('i'));
      st.appendChild(el('span', null, 'Checking'));
      a.appendChild(st); li.appendChild(a); list.appendChild(li);
    });
    group.appendChild(list); topo.appendChild(group);
  });
  var tb = $('#statusTbl') && $('#statusTbl').querySelector('tbody');
  if (tb) SYSTEMS.forEach(function(s){
    var tr = document.createElement('tr'); tr.setAttribute('data-status-for', s.id);
    var name = document.createElement('td'); var a = document.createElement('a');
    a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.name; name.appendChild(a);
    var host = document.createElement('td'); host.textContent = s.host;
    var world = document.createElement('td'); world.textContent = WORLDS[s.w] ? WORLDS[s.w].name : s.w;
    var st = document.createElement('td'); st.className = 'gk-st'; st.appendChild(document.createElement('i')); st.appendChild(el('span', null, 'Checking'));
    var ms = document.createElement('td'); ms.className = 'gk-ms';
    tr.appendChild(name); tr.appendChild(host); tr.appendChild(world); tr.appendChild(st); tr.appendChild(ms); tb.appendChild(tr);
  });
  function label(status){ return status === 'up' ? 'Reachable' : status === 'down' ? 'No response' : status === 'wake' ? 'Waking' : 'Checking'; }
  function paint(s){
    var cls = s.status === 'up' ? 'up' : s.status === 'down' ? 'down' : s.status === 'wake' ? 'wake' : '';
    $$('.gk-pip[data-sys="'+s.id+'"]').forEach(function(p){
      p.className = 'gk-pip' + (cls ? ' ' + cls : '');
      var t = p.querySelector('span'); if (t) t.textContent = label(s.status);
    });
    var row = document.querySelector('tr[data-status-for="'+s.id+'"]');
    if (row){
      var st = row.querySelector('.gk-st'); st.className = 'gk-st' + (cls ? ' ' + cls : '');
      st.querySelector('span').textContent = label(s.status);
      row.querySelector('.gk-ms').textContent = (s.status === 'up' && s.ms != null) ? Math.round(s.ms) + ' ms' : '';
    }
    var node = document.querySelector('[data-node="'+s.id+'"]');
    if (node){
      node.classList.remove('up','down','wake'); if (cls) node.classList.add(cls);
      var span = node.querySelector('.gk-dir-st span'); if (span) span.textContent = label(s.status);
    }
  }
  function summarize(){
    var done = SYSTEMS.filter(function(s){ return s.status !== 'probing' && s.status !== 'wake'; }).length;
    var up = SYSTEMS.filter(function(s){ return s.status === 'up'; }).length;
    var lat = SYSTEMS.filter(function(s){ return s.status === 'up' && !s.wake; }).map(function(s){ return s.ms; }).sort(function(a,b){ return a-b; });
    var count = $('#sysCount'); if (count) count.textContent = String(up);
    if (lat.length){
      var m = lat.length % 2 ? lat[(lat.length-1)/2] : (lat[lat.length/2-1] + lat[lat.length/2]) / 2;
      var med = $('#medianMs'); if (med) med.textContent = String(Math.round(m));
    }
    var stamp = $('#probeStamp'); if (!stamp) return;
    var hh = new Date().toTimeString().slice(0,5);
    if (done === SYSTEMS.length){
      stamp.textContent = up + ' of ' + SYSTEMS.length + ' reachable, measured at ' + hh + ' local';
      var when = $('#probeWhen'); if (when) when.textContent = 'at ' + hh;
    } else stamp.textContent = up + ' reachable, ' + (SYSTEMS.length - done) + ' still checking';
  }
  function probe(s){
    var t0 = performance.now();
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, s.wake ? 90000 : 20000);
    var wakeTimer = s.wake ? setTimeout(function(){ if (s.status === 'probing'){ s.status = 'wake'; paint(s); summarize(); } }, 4000) : null;
    var same = s.url.indexOf(location.origin + '/') === 0;
    var opts = {method:'GET', cache:'no-store', redirect:'follow', credentials:'omit'};
    if (!same) opts.mode = 'no-cors';
    if (ctrl) opts.signal = ctrl.signal;
    fetch(s.url, opts).then(function(r){ s.ms = performance.now() - t0; s.status = (same && !r.ok) ? 'down' : 'up'; })
      .catch(function(){ s.ms = null; s.status = 'down'; })
      .then(function(){ clearTimeout(timer); if (wakeTimer) clearTimeout(wakeTimer); paint(s); summarize(); });
  }
  if (window.fetch && topo){ SYSTEMS.forEach(paint); summarize(); SYSTEMS.forEach(function(s,i){ setTimeout(function(){ probe(s); }, i * 60); }); }
  else if ($('#probeStamp')) $('#probeStamp').textContent = 'This browser cannot check the hosts';
  function applyFilter(f){
    $$('#ch3 .gk-manifest').forEach(function(row){ row.hidden = !(f === 'all' || row.getAttribute('data-d') === f); });
    $$('.gk-freq button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false'); });
  }
  $$('.gk-freq button, .gk-triad button').forEach(function(b){
    b.addEventListener('click', function(){
      applyFilter(b.getAttribute('data-f') || b.getAttribute('data-filter'));
      if (b.hasAttribute('data-filter')) { var dest = $('#ch3'); if (dest) dest.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); }
    });
  });
  var mode = $('#gk-mode');
  if (mode) mode.addEventListener('click', function(){
    var on = mode.getAttribute('aria-pressed') !== 'true';
    mode.setAttribute('aria-pressed', on ? 'true' : 'false');
    mode.textContent = on ? 'Technical language' : 'Plain language';
    $$('[data-tech]').forEach(function(n){ n.innerHTML = on ? n.getAttribute('data-simple') : n.getAttribute('data-tech'); });
  });
  var stage = $('#gk-stage'), vid = $('#gk-film'), cap = $('#gk-cap'), closeBtn = $('#gk-close'), last = null;
  function openFilm(btn){
    last = btn; vid.poster = btn.getAttribute('data-poster') || ''; vid.src = btn.getAttribute('data-film');
    cap.textContent = btn.getAttribute('data-title') || ''; stage.hidden = false; document.body.style.overflow = 'hidden';
    var p = vid.play(); if (p && p.catch) p.catch(function(){}); closeBtn.focus();
  }
  function closeFilm(){ stage.hidden = true; document.body.style.overflow = ''; vid.pause(); vid.removeAttribute('src'); vid.load(); if (last) last.focus(); }
  $$('[data-film]').forEach(function(b){ b.addEventListener('click', function(){ openFilm(b); }); });
  if (closeBtn) closeBtn.addEventListener('click', closeFilm);
  if (stage) stage.addEventListener('click', function(e){ if (e.target === stage) closeFilm(); });
  var ENTRIES = [];
  function readIndex(){
    ENTRIES = [];
    $$('[data-index]').forEach(function(e){
      var href = e.getAttribute('href') || e.getAttribute('data-href') || '';
      var ref = e.getAttribute('data-ref') || '';
      if (!ref){ var no = e.querySelector('.gk-no'); if (no) ref = no.textContent.replace(/\s+/g,' ').trim(); }
      ENTRIES.push({title:e.getAttribute('data-index'), kw:e.getAttribute('data-kw') || '', href:href, ref:ref, el:e});
    });
    [['The work','#ch3','systems projects'],['The lab','#lab','course lessons'],['The writing','#ch4','papers'],['The films','#appb','video'],['The person','#ch1','purpose'],['The experiments','#ch5','ancillary'],['The editions','#appa','archive'],['The record','#ch2','status'],['All hosts','#fig11','directory']].forEach(function(c){
      ENTRIES.push({title:c[0], kw:c[2], href:c[1], ref:'On this page', el:null});
    });
    ENTRIES.sort(function(a,b){ return a.title.localeCompare(b.title, 'en', {sensitivity:'base'}); });
  }
  function printIndex(){
    var list = $('#indexList'); if (!list) return; list.textContent = '';
    var groups = {};
    ENTRIES.forEach(function(en){ var L = (en.title || '?').charAt(0).toUpperCase(); if (!/[A-Z]/.test(L)) L = '#'; (groups[L] = groups[L] || []).push(en); });
    Object.keys(groups).sort().forEach(function(L){
      var g = el('div','gk-ix'); g.appendChild(el('h3','gk-ix-l', L));
      groups[L].forEach(function(en){
        var a = document.createElement('a'); a.href = en.href || '#';
        if (en.href && en.href.charAt(0) !== '#'){ a.target = '_blank'; a.rel = 'noopener'; }
        a.appendChild(el('span', null, en.title)); a.appendChild(el('span','gk-ix-ref', en.ref));
        if (en.el && en.el.getAttribute('data-film')) a.addEventListener('click', function(ev){ ev.preventDefault(); openFilm(en.el); });
        else if (en.href && en.href.charAt(0) === '#') a.addEventListener('click', function(ev){ ev.preventDefault(); openEntry(en); });
        g.appendChild(a);
      });
      list.appendChild(g);
    });
  }
  function openEntry(en){
    if (!en) return;
    if (en.el && en.el.getAttribute('data-film')){ closeFind(); openFilm(en.el); return; }
    if (!en.href) return;
    if (en.href.charAt(0) === '#'){
      closeFind(); var t = $(en.href);
      if (t){ var p = t.parentElement; while (p){ if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } t.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); }
      return;
    }
    window.open(en.href, '_blank', 'noopener'); closeFind();
  }
  readIndex(); printIndex();
  document.addEventListener('lab:course', function(){ readIndex(); printIndex(); });
  var find = $('#gk-find'), q = $('#gk-q'), hits = $('#gk-hits'), sel = 0, shown = [], findTrigger = null;
  function score(en, query){
    if (!query) return 1;
    var hay = (en.title + ' ' + en.kw + ' ' + en.ref).toLowerCase();
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean), sc = 0;
    for (var i = 0; i < terms.length; i++){
      var t = terms[i];
      if (en.title.toLowerCase().indexOf(t) === 0) sc += 3;
      else if (en.title.toLowerCase().indexOf(t) >= 0) sc += 2;
      else if (hay.indexOf(t) >= 0) sc += 1;
      else return 0;
    }
    return sc;
  }
  function renderFind(){
    var query = q.value.trim();
    shown = ENTRIES.map(function(en){ return {en:en, s:score(en, query)}; }).filter(function(x){ return x.s > 0; })
      .sort(function(a,b){ return b.s - a.s || a.en.title.localeCompare(b.en.title); }).slice(0, 12).map(function(x){ return x.en; });
    sel = Math.min(sel, Math.max(0, shown.length - 1)); hits.textContent = '';
    if (!shown.length){ hits.appendChild(el('p', null, 'Nothing in the index matches.')); return; }
    shown.forEach(function(en, i){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gk-hit' + (i === sel ? ' is-on' : '');
      b.appendChild(el('span', null, en.title)); b.appendChild(el('span','gk-ix-ref', en.ref));
      b.addEventListener('click', function(){ openEntry(en); }); hits.appendChild(b);
    });
  }
  function openFind(){ findTrigger = document.activeElement; find.hidden = false; document.body.style.overflow = 'hidden'; q.value = ''; sel = 0; renderFind(); setTimeout(function(){ q.focus(); }, 0); }
  function closeFind(){ if (!find || find.hidden) return; find.hidden = true; document.body.style.overflow = ''; if (findTrigger) findTrigger.focus(); }
  var openBtn = $('#gk-open-find'); if (openBtn) openBtn.addEventListener('click', openFind);
  if (q){
    q.addEventListener('input', function(){ sel = 0; renderFind(); });
    q.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); renderFind(); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); renderFind(); }
      else if (e.key === 'Enter'){ e.preventDefault(); openEntry(shown[sel]); }
    });
  }
  document.addEventListener('keydown', function(e){
    var typing = /input|textarea|select/i.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape'){ if (find && !find.hidden) closeFind(); else if (stage && !stage.hidden) closeFilm(); return; }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && find){ e.preventDefault(); openFind(); }
  });
  if (find) find.addEventListener('click', function(e){ if (e.target === find) closeFind(); });
})();
"""


# Every picture in this view is a NASA Astronomy Picture of the Day, chosen in the browser by
# designs/grok/nasa-plates.js (written from NASA_JS below). APOD_FALLBACK is what the slots show when
# science.nasa.gov cannot be read: ten 2026 APOD days credited to NASA missions (public domain), one per slot.
NASA_JS = r"""/* The Night Orbit's pictures: NASA's Astronomy Picture of the Day. Written by tools/build-grok-view.py.
   Expected behaviour:
   - Each <img data-apod="N"> shows the Nth newest picture day of APOD, read from its home on
     science.nasa.gov (WordPress REST, category 22766 = APOD, no key). Video days are skipped, so slot 0,
     the home hero, is today's picture, or the latest picture day when today is a video. The pages number
     their slots so no picture repeats across the view (home 0-4, Two Stories 5-7, Lab 8-9).
   - Pictures come through NASA's resizer at 960, 1600 and 2400 px wide; the page's CSS crops each slot.
     The resizer cannot change format, so a PNG day stops at 1280 px (2400 px of PNG is about 8 MB).
   - A day is used only if its post is on https://science.nasa.gov/ and its image on
     https://assets.science.nasa.gov/, so a tampered feed cannot put a script link or another host's image here.
   - Each caption keeps its label and adds the day, the title (a link to the APOD post) and the credit.
   - The parsed days are kept in localStorage for 30 minutes. If the feed cannot be read within 8 s, the
     slots use the last days kept, or failing that the fixed public-domain NASA days below.
   - Text from the feed is set with textContent and attributes only, never as HTML. */
(function(){
  'use strict';
  var FEED = 'https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=14&_fields=date,link,content';
  var KEY = 'gk-apod-v1', TTL = 30 * 60000;
  var FALLBACK = %%FALLBACK%%;
  var slots = Array.prototype.slice.call(document.querySelectorAll('img[data-apod]'));
  if (!slots.length) return;
  function text(n){ return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function parse(post){
    // NASA's media-detail-hero block: the media, an <h1> title, a meta table with a "Credit & Copyright" row
    var doc = new DOMParser().parseFromString(post.content.rendered, 'text/html'); // inert: nothing loads or runs
    var img = doc.querySelector('.media-detail-hero__media img'), title = text(doc.querySelector('h1'));
    var link = String(post.link || ''), src = img ? img.getAttribute('src') || '' : '';
    if (!title || !/^\d{4}-\d\d-\d\d/.test(post.date || '')) return null;
    if (link.indexOf('https://science.nasa.gov/') !== 0 || src.indexOf('https://assets.science.nasa.gov/') !== 0) return null;
    var credit = '';
    Array.prototype.forEach.call(doc.querySelectorAll('.media-detail-hero__meta-row'), function(row){
      if (!credit && /credit/i.test(text(row.querySelector('th')))) credit = text(row.querySelector('td'));
    });
    var alt = (img.getAttribute('alt') || '').trim();
    return {
      date: post.date.slice(0, 10), link: link, title: title,
      alt: !alt || /^see explanation/i.test(alt) ? title : alt,
      // /content/dam/ ignores size parameters; the same file under /dynamicimage/assets/ resizes
      file: src.split('?')[0].replace('/content/dam/', '/dynamicimage/assets/'),
      credit: credit.replace(/^Image Credit:\s*/i, '').replace(/\s+([,;])/g, '$1')
    };
  }
  function safe(post){ try { return parse(post); } catch (e) { return null; } }
  function sized(file, w){ return file + '?w=' + w + '&fit=clip'; }
  function widths(file){ return /\.png$/i.test(file) ? [960, 1280] : [960, 1600, 2400]; }
  function day(d){ return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fill(days){
    slots.forEach(function(img){
      var d = days[Number(img.getAttribute('data-apod')) % days.length], ws = widths(d.file);
      img.alt = d.alt;
      img.srcset = ws.map(function(w){ return sized(d.file, w) + ' ' + w + 'w'; }).join(', ');
      img.src = sized(d.file, ws[1]);
      var fig = img.closest('figure'), cap = fig && fig.querySelector('figcaption');
      if (!cap) return;
      var a = document.createElement('a');
      a.href = d.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = d.title;
      cap.textContent = (cap.getAttribute('data-label') || 'Plate') + ' · ' + day(d.date) + ' · ';
      cap.appendChild(a);
      if (d.credit) cap.appendChild(document.createTextNode(' · ' + d.credit));
    });
  }
  var kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  var keptDays = kept && kept.days && kept.days.length ? kept.days : null;
  if (keptDays && Date.now() - kept.t < TTL) return fill(keptDays);
  var ctl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function(){ if (ctl) ctl.abort(); }, 8000);
  fetch(FEED, ctl ? { signal: ctl.signal } : {}).then(function(r){
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(posts){
    var days = posts.map(safe).filter(Boolean);
    if (!days.length) throw new Error('no picture days');
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), days: days })); } catch (e) {}
    fill(days);
  }).catch(function(){
    fill(keptDays || FALLBACK);
  }).then(function(){ clearTimeout(timer); });
})();
"""

APOD_FALLBACK = [
    {'date': "2026-06-01", 'link': "https://science.nasa.gov/image-article/apod-2026-june-1-saturn-at-night/", 'title': "Saturn at Night", 'alt': "Saturn at Night", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/june/LastRingPortrait_Cassini_4472.jpg", 'credit': "NASA, JPL-Caltech, Space Science Institute, Mindaugas Macijauskas"},
    {'date': "2026-04-08", 'link': "https://science.nasa.gov/image-article/apod-2026-april-8-earthset/", 'title': "Earthset", 'alt': "Earthset captured through the Orion spacecraft window at 6:41 p.m. EDT, April 6, 2026, during the Artemis II crew’s flyby of the Moon. A muted blue Earth with bright white clouds sets behind the cratered lunar surface. The dark portion of Earth is experiencing nighttime. On Earth’s day side, swirling clouds are visible over the Australia and Oceania region. In the foreground, Ohm crater has terraced edges and a flat floor interrupted by central peaks. Central peaks form in complex craters when the lunar surface, liquefied on impact, splashes upwards during the crater’s formation.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/april/earthset_original.jpg", 'credit': "NASA Text:Keighley Rockcliffe (NASA GSFC, UMBC CSST, CRESST II)"},
    {'date': "2026-01-11", 'link': "https://science.nasa.gov/image-article/apod-2026-january-11-m104-the-sombrero-galaxy-in-infrared/", 'title': "M104: The Sombrero Galaxy in Infrared", 'alt': "A red-tinged ring of dust is seen nearly on edge. In the ring's center and extending around the frame, blue gas and stars are shown. Please see the explanation for more detailed information.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/january/sombrero_spitzer_3000.jpg", 'credit': "NASA, JPL, Caltech, SSC, R. Kennicutt ( Steward Obs. ) et al.,"},
    {'date': "2026-10-10", 'link': "https://science.nasa.gov/image-article/apod-2026-october-10-lunar-farside/", 'title': "Lunar Farside", 'alt': "A mosaic image of the farside of the Moon.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/october/farside_lro1600.jpg", 'credit': "NASA / GSFC / Arizona State Univ. / Lunar Reconnaissance Orbiter"},
    {'date': "2026-02-06", 'link': "https://science.nasa.gov/image-article/apod-2026-february-6-supernova-remnant-cassiopeia-a/", 'title': "Supernova Remnant Cassiopeia A", 'alt': "Supernova Remnant Cassiopeia A", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/february/CasA_nircam_4096.jpg", 'credit': "NASA, ESA, CSA, STScI; D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (University of Gent)"},
    {'date': "2026-05-17", 'link': "https://science.nasa.gov/image-article/apod-2026-may-17-ngc-1300-barred-spiral-galaxy/", 'title': "NGC 1300: Barred Spiral Galaxy", 'alt': "The featured image shows a the big beautiful barred spiral galaxy NGC 1300 with encompassing spiral arms tinted blue from young stars. Please see the explanation for more detailed information.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/may/NGC1300_HST_6637.jpg", 'credit': "NASA ESA, Hubble Heritage"},
    {'date': "2026-04-04", 'link': "https://science.nasa.gov/image-article/apod-2026-april-4-hello-world/", 'title': "Hello World", 'alt': "Hello World", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/april/art002e000192.jpg", 'credit': "NASA, Reid Wiseman, Artemis II"},
    {'date': "2026-01-20", 'link': "https://science.nasa.gov/image-article/apod-2026-january-20-io-in-true-color/", 'title': "Io in True Color", 'alt': "A big ball that is mostly yellow is shown. The ball has many circular and irregular regions that are different colors, typically brown or olive green. Please see the explanation for more detailed information.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/january/iotruecolor_galileo_2796.jpg", 'credit': "NASA, JPL, Galileo Project"},
    {'date': "2026-09-06", 'link': "https://science.nasa.gov/image-article/apod-2026-september-6-pluto-in-enhanced-color/", 'title': "Pluto in Enhanced Color", 'alt': "The picture shows Pluto in enhanced colors and high resolution and seen by the passing New Horizons spacecraft in 2015. Please see the explanation for more detailed information.", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2021/august/PlutoEnhancedHiRes_NewHorizons_5000.jpg", 'credit': "NASA, Johns Hopkins Univ./APL, Southwest Research Inst."},
    {'date': "2026-06-27", 'link': "https://science.nasa.gov/image-article/apod-2026-june-27-mars-marathon-by-perseverance/", 'title': "Mars Marathon by Perseverance", 'alt': "Mars Marathon by Perseverance", 'file': "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/june/PIA26726.jpg", 'credit': "NASA, LPL (U. Arizona), MRO, HiRISE"},
]


def md5_10(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()[:10]


def esc(value: str) -> str:
    return htmlmod.escape(htmlmod.unescape(value), quote=True)


def rich(value: str) -> str:
    text = esc(re.sub(r'\s+', ' ', value).strip())
    return text.replace('&lt;br&gt;', '<br>').replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')


def plain(value: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', htmlmod.unescape(value))).strip()


def must(pattern: str, text: str, flags: int = re.S) -> re.Match[str]:
    found = re.search(pattern, text, flags)
    if not found:
        raise SystemExit('build-grok-view: missing ' + pattern[:90])
    return found


def switcher(page: str) -> tuple[str, str]:
    rel = SWITCH_SOURCE[page]
    src = (ROOT / rel).read_text(encoding='utf-8')
    head_block, nav = SWITCH_HEAD.search(src), SWITCH_NAV.search(src)
    if not head_block or not nav:
        raise SystemExit(f'build-grok-view: {rel} has no design-switcher block')
    nav = re.sub(r'data-selected="[a-z]+"', 'data-selected="grok"', nav.group(0), count=1).replace(' aria-current="page"', '')
    nav, found = re.subn(r'(<a class="design-choice" data-design="grok" href="[^"]*")>', r'\1 aria-current="page">', nav)
    if found != 1:
        raise SystemExit(f'build-grok-view: the switcher on {rel} has no Grok link (add view G to the editions record and rebuild view A)')
    nav = re.sub(r'<div class="design-curtain" data-destination="[a-z]+" aria-hidden="true"><strong>[^<]*</strong><span>[^<]*</span></div>',
                 f'<div class="design-curtain" data-destination="grok" aria-hidden="true"><strong>{CURTAIN[0]}</strong><span>{CURTAIN[1]}</span></div>', nav)
    return head_block.group(0), nav


def head(title: str, description: str, canonical: str, switch_head: str) -> str:
    plates_tag = f'<script src="/designs/grok/nasa-plates.js?v={md5_10(PLATES_JS)}" defer></script>'
    return f'''<!DOCTYPE html>
<html lang="en" data-design="grok">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta name="theme-color" content="#0b0a12">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>{PAGE_CSS}</style>
{plates_tag}
{switch_head}
</head>
'''


def bar(current: str) -> str:
    links = [
        ('#ch3', 'Work', 'work'),
        ('#ch4', 'Writing', 'writing'),
        ('#appb', 'Films', 'films'),
        ('#appa', 'Editions', 'editions'),
        ('/designs/grok/lab/', 'The Lab', 'lab'),
    ]
    bits = []
    for href, label, key in links:
        if not href.startswith('/'):
            href = '/designs/grok/' + href
        cur = ' aria-current="page"' if key == current else ''
        bits.append(f'<a href="{href}"{cur}>{label}</a>')
    bits.append('<button type="button" id="gk-mode" aria-pressed="false">Plain language</button>')
    bits.append('<button type="button" id="gk-open-find">Index <kbd>/</kbd></button>')
    return (
        '<a class="gk-skip" href="#ch3">Skip to the work</a>'
        '<header class="gk-bar"><a class="gk-brand" href="/designs/grok/"><i>●</i>SOOCH</a>'
        f'<nav class="gk-nav" aria-label="Night orbit">{"".join(bits)}</nav></header>'
    )


def plate(slot: int, eager: bool = False) -> str:
    """A full-bleed picture slot. nasa-plates.js fills it with an APOD day and writes its caption."""
    lazy = '' if eager else ' loading="lazy"'
    return (
        f'<figure class="gk-plate"><img data-apod="{slot}" width="1280" height="720" alt="" decoding="async"{lazy}>'
        '<figcaption data-label="Plate">Plate · NASA Astronomy Picture of the Day</figcaption></figure>'
    )


def pair_attr(tech: str, simple: str) -> str:
    return f' data-tech="{esc(re.sub(r"\\s+", " ", tech).strip())}" data-simple="{esc(re.sub(r"\\s+", " ", simple).strip())}"'


def manifest(num: str, kicker: str, title: str, body: str, end: str, attrs: str, tag: str = 'a') -> str:
    return (
        f'<{tag} class="gk-manifest" {attrs}>'
        f'<span class="gk-no">{num}</span>'
        f'<span><span class="gk-kicker">{kicker}</span><span class="gk-name">{title}</span>{body}</span>'
        f'<span class="gk-end">{end}</span></{tag}>'
    )


def parse_cards(home: str) -> list[dict]:
    found = re.findall(
        r'<a class="card ([a-z]+)" data-d="([a-z]+)" data-sys="([^"]+)" data-index="([^"]+)" data-kw="([^"]+)" href="([^"]+)"[^>]*>(.*?)</a>',
        home, re.S,
    )
    cards = []
    for _klass, domain, sys_id, index, kw, href, body in found:
        tech, simple = must(r'data-tech="(.*?)"\s+data-simple="(.*?)"', body).groups()
        h3 = must(r'<h3>(.*?)</h3>', body).group(1)
        flag = ''
        flag_match = re.search(r'<span class="new">(.*?)</span>', h3, re.S)
        if flag_match:
            flag = plain(flag_match.group(1))
            h3 = re.sub(r'<span class="new">.*?</span>', '', h3, flags=re.S)
        stats_html = must(r'class="stats">(.*?)</span>\s*<span class="ft">', body).group(1)
        stats = [rich(part) for part in re.findall(r'<span>(.*?)</span>', stats_html, re.S)]
        go = plain(must(r'class="go">(.*?)</span>', body).group(1))
        dom = plain(must(r'class="dom">(.*?)</span>', body).group(1))
        num = plain(must(r'class="dom">.*?</span>\s*<span>(.*?)</span>', body).group(1))
        cards.append({
            'domain': domain, 'sys': sys_id, 'index': plain(index), 'kw': plain(kw), 'href': href,
            'title': plain(h3), 'flag': flag, 'tech': tech, 'simple': simple, 'dom': dom, 'num': num,
            'stats': ' · '.join(stats), 'go': go,
        })
    if len(cards) != 15:
        raise SystemExit(f'expected 15 systems, found {len(cards)}')
    return cards


def parse_papers(home: str) -> list[dict]:
    papers = []
    for head, links in re.findall(r'<div class="paper"(.*?)<div class="plinks">(.*?)</div>', home, re.S):
        tech, simple = must(r'data-tech="(.*?)"\s+data-simple="(.*?)"', head).groups()
        layers = [(plain(n), plain(b), plain(s)) for n, b, s in re.findall(
            r'<span class="n">(\d+)</span>\s*<div>\s*<b>(.*?)</b>\s*<span>(.*?)</span>', head, re.S)]
        link_rows = []
        for href, label in re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', links, re.S):
            href = href.replace('/two-stories/', '/designs/grok/two-stories/')
            link_rows.append((href, plain(label)))
        fn = must(r'<span class="fn">(.*?)</span>\s*<h3>', head).group(1)
        when = plain(re.findall(r'<span>(.*?)</span>', fn, re.S)[-1])
        papers.append({
            'index': plain(must(r'data-index="([^"]+)"', head).group(1)),
            'kw': plain(must(r'data-kw="([^"]+)"', head).group(1)),
            'ref': plain(must(r'data-ref="([^"]+)"', head).group(1)),
            'dom': plain(must(r'class="dom">(.*?)</span>', head).group(1)),
            'when': when, 'title': plain(must(r'<h3>(.*?)</h3>', head).group(1)),
            'tech': tech, 'simple': simple, 'layers': layers, 'links': link_rows,
            'href': link_rows[0][0],
        })
    if len(papers) != 3:
        raise SystemExit(f'expected 3 papers, found {len(papers)}')
    return papers


def parse_rooms(home: str) -> list[dict]:
    rooms = []
    for sys_id, index, kw, href, body in re.findall(
        r'<a class="room" data-sys="([^"]+)" data-index="([^"]+)" data-kw="([^"]+)" href="([^"]+)"[^>]*>(.*?)</a>',
        home, re.S,
    ):
        rooms.append({
            'sys': sys_id, 'index': plain(index), 'kw': plain(kw), 'href': href,
            'title': plain(must(r'<h3>(.*?)</h3>', body).group(1)),
            'text': plain(must(r'<p>(.*?)</p>', body).group(1)),
            'foot': plain(must(r'class="sdot" data-sys="[^"]+"><i>\s*</i>(.*?)</span>', body).group(1)),
        })
    if len(rooms) != 2:
        raise SystemExit(f'expected 2 rooms, found {len(rooms)}')
    return rooms


def parse_films(home: str) -> tuple[dict, list[dict]]:
    plate_btn = must(
        r'data-film="(https://seansooch.dev/videos/vol3-launch-film.mp4)" data-poster="([^"]+)" data-title="([^"]+)"',
        home,
    )
    feature = {'film': plate_btn.group(1), 'poster': plate_btn.group(2), 'title': plate_btn.group(3),
               'alt': plain(must(r'<img src="https://seansooch.dev/videos/vol3-poster.jpg"[^>]*alt="([^"]+)"', home).group(1))}
    films = []
    for film, poster, title, index, kw, body in re.findall(
        r'<button class="xrow" type="button" data-film="([^"]+)"(?: data-poster="([^"]*)")? data-title="([^"]+)" data-index="([^"]+)" data-kw="([^"]+)">(.*?)</button>',
        home, re.S,
    ):
        films.append({
            'film': film, 'poster': poster, 'title': plain(title), 'index': plain(index), 'kw': plain(kw),
            'num': plain(must(r'class="xfn">(.*?)</span>', body).group(1)),
            'name': plain(must(r'class="xname">(.*?)</span>', body).group(1)),
            'desc': plain(must(r'class="xdesc">(.*?)</span>', body).group(1)),
            'tag': plain(must(r'class="xtag">(.*?)</span>', body).group(1)),
        })
    if len(films) != 4:
        raise SystemExit(f'expected 4 films, found {len(films)}')
    return feature, films


def parse_experiments(home: str) -> list[dict]:
    rows = []
    for attrs, body in re.findall(r'<a class="xrow"([^>]*)>(.*?)</a>', home, re.S):
        if 'data-sys' not in attrs or 'data-lab' in attrs:
            continue
        rows.append({
            'sys': must(r'data-sys="([^"]+)"', attrs).group(1),
            'index': plain(must(r'data-index="([^"]+)"', attrs).group(1)),
            'kw': plain(must(r'data-kw="([^"]+)"', attrs).group(1)),
            'href': must(r'href="([^"]+)"', attrs).group(1),
            'num': plain(must(r'class="xfn">(.*?)</span>', body).group(1)),
            # The name wraps a status dot, so stop at the description, not the first span.
            'name': plain(must(r'class="xname">(.*?)</span>\s*<span class="xdesc">', body).group(1)),
            'desc': plain(must(r'class="xdesc">(.*?)</span>', body).group(1)),
            'tag': plain(must(r'class="xtag">(.*?)</span>', body).group(1)),
        })
    if len(rows) != 4:
        raise SystemExit(f'expected 4 experiments, found {len(rows)}')
    return rows


def parse_views(home: str) -> dict:
    """The current views, read from view A's views band and Table A-1 (both rendered there from the shared editions
    record), so this view lists the same views, in the same order, under the same count, and a new view needs no
    edit here. Each cell: (number, name, designer, note, href, is this view)."""
    band = must(r'<div class="views-band">(.*?)<!-- edition-views:end -->', home).group(1)
    caption = plain(must(r'<p class="views-cap"><span>(.*?)</span>', band).group(1))
    cells = []
    for m in re.finditer(r'<(?:a|div) class="view-cell[^"]*"(?: href="([^"]*)")?[^>]*>\s*<span class="view-no">(\d+)</span>'
                         r'<span class="view-by">(.*?) · Vol\. \d+</span><span class="view-name">(.*?)</span><span class="view-note">(.*?)</span>', band, re.S):
        href = m.group(1) or '/'   # view A's own cell is the one without a link
        name = plain(re.sub(r'<span class="new">.*?</span>', '', m.group(4)))
        cells.append((m.group(2), name, plain(m.group(3)), plain(m.group(5)), href, href == '/designs/grok/'))
    if len(cells) < 2 or sum(c[5] for c in cells) != 1:
        raise SystemExit('build-grok-view: view A\'s views band must list this view once (add it to the editions record and rebuild view A)')
    return {'caption': caption, 'cells': cells}


def parse_record(home: str) -> str:
    """Table A-1, every row of view A's, in this view's cells: the volume in ink, the credits as a list, the status
    in words, one link per retired edition."""
    body = must(r'<table class="ed">.*?<tbody>(.*?)</tbody>', home).group(1)
    rows = []
    for tr in re.finditer(r'<tr([^>]*)>(.*?)</tr>', body, re.S):
        cells = re.findall(r'<td([^>]*)>(.*?)</td>', tr.group(2), re.S)
        if len(cells) != 6:
            raise SystemExit(f'build-grok-view: a Table A-1 row in index.html has {len(cells)} cells, expected 6')
        attrs = ''.join(f' {k}="{v}"' for k, v in re.findall(r'(data-(?:index|kw|href))="([^"]*)"', tr.group(1)))
        vol, design, by, issued, status, link = (plain(c) for _, c in cells)
        archive = re.search(r'<a href="(https://[^"]+)"', cells[5][1])
        awaiting = status == 'Awaiting release'
        names = by.split(' + ')
        credits = names[0] if len(names) < 3 else ', '.join(names[:-1]) + ', and ' + names[-1]
        end = (f'<a href="{esc(archive.group(1))}" target="_blank" rel="noopener">View archive</a>' if archive
               else 'You are here' if link == 'You are here' else '')
        rows.append(f'<tr{attrs}><td{"" if awaiting else " class=\"gk-ink\""}>{esc(vol)}</td><td>{esc(design)}</td><td>{esc(credits)}</td>'
                    f'<td>{esc(issued)}</td><td>{esc(status)}</td><td>{end}</td></tr>')
    if len(rows) < 2:
        raise SystemExit('build-grok-view: Table A-1 in index.html has fewer than two editions')
    return '\n          '.join(rows)


def parse_home(home: str) -> dict:
    bio_tech, bio_simple = must(r'<p data-tech="(.*?)"\s+data-simple="(.*?)">', home).groups()
    if not plain(bio_tech).startswith('Medical student'):
        raise SystemExit('cover biography was not the first data-tech paragraph')
    ch1 = must(r'<section id="ch1".*?>(.*?)</section>', home).group(1)
    person = re.findall(r'data-tech="(.*?)"\s+data-simple="(.*?)"', ch1, re.S)
    person_note = plain(must(r'<div class="box"><span class="tag">NOTE</span><p>(.*?)</p>', ch1).group(1))
    lab = must(r'<section id="lab".*?>(.*?)</section>', home).group(1)
    lab_tech, lab_simple = must(r'data-tech="(.*?)"\s+data-simple="(.*?)"', lab).groups()
    appa = must(r'<section id="appa".*?>(.*?)</section>', home).group(1)
    appa_pairs = re.findall(r'data-tech="(.*?)"\s+data-simple="(.*?)"', appa, re.S)
    caution = plain(must(r'<div class="box caution"><span class="tag">CAUTION</span><p>(.*?)</p>', home).group(1))
    return {
        'cards': parse_cards(home), 'papers': parse_papers(home), 'rooms': parse_rooms(home),
        'films': parse_films(home), 'experiments': parse_experiments(home),
        'bio': (bio_tech, bio_simple), 'person': person, 'person_note': person_note,
        'lab': (lab_tech, lab_simple), 'appa': appa_pairs, 'caution': caution,
        'systems': must(r'var SYSTEMS = (\[[\s\S]*?\]);', home).group(1),
        'views': parse_views(home),
        'record': parse_record(home),
    }


def render_home(data: dict) -> str:
    switch_head, switch_nav = switcher('')
    counts: dict[str, int] = {}
    for card in data['cards']:
        counts[card['domain']] = counts.get(card['domain'], 0) + 1
    freq = [('all', 'All', len(data['cards']))]
    for key, label in (('med', 'Medicine'), ('mil', 'Military'), ('mac', 'Machines'), ('spt', 'Sports'), ('hum', 'Humanities'), ('mus', 'Music')):
        freq.append((key, label, counts.get(key, 0)))
    freq_html = ''.join(
        f'<button type="button" data-f="{key}" aria-pressed="{"true" if key == "all" else "false"}">{label} <span>{n}</span></button>'
        for key, label, n in freq
    )
    rows = []
    for card in data['cards']:
        flag = f' <span class="gk-flag">{esc(card["flag"])}</span>' if card['flag'] else ''
        body = f'<span class="gk-desc"{pair_attr(card["tech"], card["simple"])}>{rich(card["tech"])}</span><span class="gk-stats">{card["stats"]}</span>'
        end = f'<span class="gk-pip" data-sys="{esc(card["sys"])}"><i></i><span>Checking</span></span><span class="gk-go">{esc(card["go"])}</span>'
        attrs = (
            f'data-d="{esc(card["domain"])}" data-index="{esc(card["index"])}" data-kw="{esc(card["kw"])}" '
            f'data-ref="{esc(card["num"])}" href="{esc(card["href"])}" target="_blank" rel="noopener"'
        )
        rows.append(manifest(esc(card['num']), esc(card['dom']), esc(card['title']) + flag, body, end, attrs))
    papers = []
    for paper in data['papers']:
        layers = ''.join(
            f'<div><span class="gk-no">{esc(n)}</span><span><b>{esc(name)}</b><span>{esc(note)}</span></span></div>'
            for n, name, note in paper['layers']
        )
        links = ''.join(
            f'<a href="{esc(href)}"{" target=\"_blank\" rel=\"noopener\"" if href.startswith("http") else ""}>{esc(label)}</a>'
            for href, label in paper['links']
        )
        papers.append(
            f'<article data-index="{esc(paper["index"])}" data-kw="{esc(paper["kw"])}" data-ref="{esc(paper["ref"])}" data-href="{esc(paper["href"])}">'
            f'<p class="gk-kicker">{esc(paper["dom"])} · {esc(paper["when"])}</p><h3 class="gk-name">{esc(paper["title"])}</h3>'
            f'<p class="gk-desc"{pair_attr(paper["tech"], paper["simple"])}>{rich(paper["tech"])}</p>'
            f'<div class="gk-layers">{layers}</div><p class="gk-links">{links}</p></article>'
        )
    rooms = []
    for room in data['rooms']:
        rooms.append(
            f'<a class="gk-manifest" data-index="{esc(room["index"])}" data-kw="{esc(room["kw"])}" data-ref="Room" href="{esc(room["href"])}" target="_blank" rel="noopener">'
            f'<span class="gk-no">{esc(room["sys"][:3])}</span><span><span class="gk-name">{esc(room["title"])}</span>'
            f'<span class="gk-desc">{esc(room["text"])}</span></span>'
            f'<span class="gk-end"><span class="gk-pip" data-sys="{esc(room["sys"])}"><i></i><span>Checking</span></span><span class="gk-go">{esc(room["foot"])}</span></span></a>'
        )
    feature, films = data['films']
    film_rows = []
    for film in films:
        poster = f' data-poster="{esc(film["poster"])}"' if film['poster'] else ''
        film_rows.append(
            f'<button type="button" class="gk-manifest" data-film="{esc(film["film"])}"{poster} data-title="{esc(film["title"])}" '
            f'data-index="{esc(film["index"])}" data-kw="{esc(film["kw"])}" data-ref="{esc(film["num"])}">'
            f'<span class="gk-no">{esc(film["num"])}</span><span><span class="gk-name">{esc(film["name"])}</span>'
            f'<span class="gk-desc">{esc(film["desc"])}</span></span><span class="gk-end">{esc(film["tag"])}<span class="gk-go">Play</span></span></button>'
        )
    experiments = []
    for row in data['experiments']:
        experiments.append(
            f'<a class="gk-manifest" data-index="{esc(row["index"])}" data-kw="{esc(row["kw"])}" data-ref="{esc(row["num"])}" href="{esc(row["href"])}" target="_blank" rel="noopener">'
            f'<span class="gk-no">{esc(row["num"])}</span><span><span class="gk-name">{esc(row["name"])}</span><span class="gk-desc">{esc(row["desc"])}</span></span>'
            f'<span class="gk-end"><span class="gk-pip" data-sys="{esc(row["sys"])}"><i></i><span>Checking</span></span><span class="gk-go">{esc(row["tag"])}</span></span></a>'
        )
    person = []
    labels = ('Purpose', 'Scope', 'Method')
    for i, (tech, simple) in enumerate(data['person'], start=1):
        person.append(
            f'<div class="gk-para"><span class="gk-pn">{i} · {labels[i-1] if i-1 < len(labels) else ""}</span>'
            f'<p{pair_attr(tech, simple)}>{rich(tech)}</p></div>'
        )
    bio_tech, bio_simple = data['bio']
    lab_tech, lab_simple = data['lab']
    edition_intro, change_note = data['appa']
    views = data['views']
    view_html = []
    for num, name, by, note, href, here in views['cells']:
        cls = 'gk-view is-here' if here else 'gk-view'
        tag = 'div' if here else 'a'
        href_attr = '' if here else f' href="{href}"'
        index = f' data-index="{esc(name)}" data-kw="editions view" data-ref="05 / Editions"'
        mark = '<span class="gk-go">You are here</span>' if here else '<span class="gk-go">Open</span>'
        view_html.append(
            f'<{tag} class="{cls}"{href_attr}{index}><span class="gk-no">{num}</span><span><span class="gk-kicker">{esc(by)}</span>'
            f'<span class="gk-name">{esc(name)}</span><p>{esc(note)}</p></span>{mark}</{tag}>'
        )
    measures = [
        ('Lines of code', '150,906', 'unique source files, generated data excluded; 21,761 of these are one project\'s test suite'),
        ('Source files', '247', 'html, js, css, python, typescript'),
        ('Board-style questions', '12,972', '7 question banks, 8 subjects, every item independently reviewed, most a second time'),
        ('Players and teams tracked', '1,106', 'sports intel across 12 data sources'),
        ('Systems reachable', '<span id="sysCount">…</span> of <span id="sysTotal">21</span>', 'measured from your browser, <span id="probeWhen">now</span>'),
        ('Median round trip', '<span id="medianMs">…</span>', 'milliseconds, edge-cached static hosts; the one server-rendered app is excluded while it wakes'),
        ('Months since first deploy', '5', 'April to September 2026, evenings and weekends'),
    ]
    measure_rows = []
    for name, result, standard in measures:
        result_html = result if result.startswith('<') else esc(result)
        standard_html = standard if '<span id="probeWhen">' in standard else esc(standard)
        measure_rows.append(f'<tr><td>{esc(name)}</td><td class="gk-ink">{result_html}</td><td>{standard_html}</td></tr>')
    script = PAGE_JS.replace('%%SYSTEMS%%', data['systems'])
    return head(
        'Sean Sooch | The Night Orbit',
        'A night-orbit log of the same record: fourteen working systems across medicine, the military, and machines, the writing, the films, and a course in core medicine.',
        'https://seansooch.dev/designs/grok/', switch_head,
    ) + f'''<body>
{bar('')}
<main id="top">
  <section class="gk-hero" aria-label="Introduction">
    <figure class="gk-hero-media">
      <img data-apod="0" width="1280" height="720" sizes="(max-width: 860px) 100vw, 60vw" alt="" decoding="async" fetchpriority="high">
      <figcaption data-label="Picture of the day">Picture of the day · NASA Astronomy Picture of the Day</figcaption>
    </figure>
    <div class="gk-hero-copy">
      <svg class="gk-ring" viewBox="0 0 80 80" width="72" height="72" aria-hidden="true"><circle cx="40" cy="40" r="28" fill="none" stroke="#e2a15c" stroke-width="1"></circle><circle cx="40" cy="40" r="16" fill="none" stroke="#b7d4e4" stroke-width="1"></circle><circle cx="68" cy="40" r="2.4" fill="#e2a15c"></circle></svg>
      <p class="gk-kicker" id="domLabel">Medicine / military / machines</p>
      <h1>Sean<span>Sooch</span></h1>
      <p>Three disciplines. One restless curiosity.</p>
      <p{pair_attr(bio_tech, bio_simple)}>{rich(bio_tech)}</p>
      <div class="gk-triad">
        <button type="button" data-filter="med">Medicine <span>01</span></button>
        <button type="button" data-filter="mil">Military <span>02</span></button>
        <button type="button" data-filter="mac">Machines <span>03</span></button>
      </div>
      <p class="gk-meta">Independent work, 2026 · orbit 05</p>
    </div>
  </section>
  {plate(1)}
  <section id="ch3" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 01 · the work</p>
    <h2>Built to be used.</h2>
    <p class="gk-lead">14 selected systems and the music. Open one and put it to work.</p>
    <div class="gk-freq" role="group" aria-label="Filter systems by domain">{freq_html}</div>
    {''.join(rows)}
  </div></section>
  {plate(2)}
  <section id="lab" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station · the lab</p>
    <h2>Medicine, one step at a time.</h2>
    <p class="gk-lead"{pair_attr(lab_tech, lab_simple)}>{rich(lab_tech)}</p>
    <p class="gk-meta" data-lab-text="{{ready}} of {{total}} ready">Lessons are drawn from the course ledger.</p>
    <div data-lab-list="ready">
      <template data-lab-row="ready">
        <a class="gk-manifest" data-lab-link data-lab-index data-ref="The Lab">
          <span class="gk-no">L-<span data-lab="no"></span></span>
          <span><span class="gk-name" data-lab="title"></span><span class="gk-desc" data-lab="description"></span></span>
          <span class="gk-end"><span data-lab="date"></span><span class="gk-go">Learn</span></span>
        </a>
      </template>
      <a class="gk-manifest" data-index="The Lab (all lessons)" data-ref="The Lab" data-kw="lab course lessons core medicine physiology pharmacology" href="/designs/grok/lab/">
        <span class="gk-no">L</span>
        <span><span class="gk-name">All lessons</span><span class="gk-desc">The course page: every lesson in order, each one a single idea built up step by step.</span></span>
        <span class="gk-end"><span data-lab-text="{{ready}} of {{total}} ready">Course</span><span class="gk-go">Enter</span></span>
      </a>
    </div>
  </div></section>
  <section id="ch4" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 02 · the writing</p>
    <h2>Working theories.</h2>
    <p class="gk-lead">3 papers · 2 reading rooms · 19 essays</p>
    {''.join(papers)}
    {''.join(rooms)}
  </div></section>
  {plate(3)}
  <section id="appb" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 03 · the films</p>
    <h2>Press play.</h2>
    <p class="gk-lead">Rendered from code, captured from live sites. Sound on.</p>
    <figure id="plate1" class="gk-plate">
      <button type="button" class="gk-manifest" data-film="{esc(feature["film"])}" data-poster="{esc(feature["poster"])}" data-title="{esc(feature["title"])}" data-index="Vol. 03 launch film" data-kw="films video edition" data-ref="Plate 1" aria-label="Play the Vol. 03 launch film">
        <span class="gk-no">P1</span>
        <span><img src="{esc(feature["poster"])}" width="1280" height="720" alt="{esc(feature["alt"])}" loading="lazy" decoding="async"><span class="gk-name">{esc(feature["title"])}</span><span class="gk-desc">Vol. 03 in motion: the cover, the topology answering, the roll call, the record, the index.</span></span>
        <span class="gk-end">1:20<span class="gk-go">Play</span></span>
      </button>
    </figure>
    {''.join(film_rows)}
  </div></section>
  {plate(4)}
  <section id="ch1" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 04 · the person</p>
    <h2>In the spare hours.</h2>
    {''.join(person)}
    <div class="gk-note"><strong>Note</strong><p>{esc(data["person_note"])}</p></div>
  </div></section>
  <section id="ch5" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 05 · the experiments</p>
    <h2>And a few detours.</h2>
    <p class="gk-lead">Smaller experiments, same operator, same period.</p>
    {''.join(experiments)}
  </div></section>
  <section id="appa" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 06 · the editions</p>
    <h2>Same person. New perspective.</h2>
    <p class="gk-lead"{pair_attr(edition_intro[0], edition_intro[1])}>{rich(edition_intro[0])}</p>
    <p class="gk-meta">Table A-1. Editions of this site.</p>
    <div class="gk-scroll" tabindex="0">
      <table>
        <thead><tr><th>Change</th><th>Edition</th><th>Designed by</th><th>Issued</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {data['record']}
        </tbody>
      </table>
    </div>
    <p class="gk-kicker" style="margin-top:28px">{esc(views['caption'])}</p>
    <div class="gk-views">{''.join(view_html)}</div>
    <div class="gk-note"><strong>Note</strong><p{pair_attr(change_note[0], change_note[1])}>{rich(change_note[0])}</p></div>
  </div></section>
  <section id="ch2" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Station 07 · the record</p>
    <h2>Open for inspection.</h2>
    <p class="gk-lead">Counts recounted 14 Sep 2026. Reachability is measured live on every page load.</p>
    <details class="gk-record"><summary>Source figures, live status, and the full directory</summary>
      <p class="gk-meta">Table 2-1. Portfolio readiness. Static figures are recounted at every edition. Live figures come from the host list.</p>
      <div class="gk-scroll" tabindex="0"><table><thead><tr><th>Measure</th><th>Result</th><th>Standard</th></tr></thead><tbody>{''.join(measure_rows)}</tbody></table></div>
      <p class="gk-meta">Table 2-2. System status, the same check as the directory, in list form.</p>
      <div class="gk-scroll" tabindex="0"><table id="statusTbl"><thead><tr><th>System</th><th>Host</th><th>Domain</th><th>Status</th><th>Round trip</th></tr></thead><tbody></tbody></table></div>
      <div class="gk-note"><strong>Caution</strong><p>{esc(data["caution"])}</p></div>
      <div id="fig11"><h3 class="gk-name">All twenty-one systems</h3><p id="probeStamp" class="gk-meta">Checking reachability…</p><div id="topo"></div></div>
    </details>
  </div></section>
  <section id="indexsec" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">A to Z</p>
    <h2>The complete index.</h2>
    <p class="gk-lead">Every system, paper, and film on this page. Press / to search it.</p>
    <div class="gk-index" id="indexList"></div>
  </div></section>
</main>
<footer class="gk-foot"><span>© 2026 Sean Sooch · The Night Orbit</span><a href="#appa">The edition record</a></footer>
<div class="gk-stage" id="gk-stage" hidden role="dialog" aria-modal="true" aria-label="Film"><div class="gk-panel"><button type="button" class="gk-x" id="gk-close" aria-label="Close film">×</button><p id="gk-cap" class="gk-kicker"></p><video id="gk-film" controls playsinline preload="none"></video></div></div>
<div class="gk-find" id="gk-find" hidden role="dialog" aria-modal="true" aria-label="Index"><div class="gk-panel"><label class="gk-kicker" for="gk-q">Index</label><input id="gk-q" type="text" placeholder="A system, paper, film, or station" autocomplete="off" spellcheck="false"><div id="gk-hits"></div><p class="gk-meta">Arrow keys move. Enter opens. Escape closes.</p></div></div>
<script>{script}</script>
{switch_nav}
</body></html>
'''


def render_essay() -> str:
    switch_head, switch_nav = switcher('two-stories')
    src = (ROOT / 'two-stories/index.html').read_text(encoding='utf-8')
    title = plain(must(r'<h1>(.*?)</h1>', src).group(1))
    sub = must(r'<p class="sub">(.*?)</p>', src).group(1).strip()
    abstract = re.findall(r'<aside class="abstract">.*?<p>(.*?)</p>\s*<p>(.*?)</p>', src, re.S)
    if len(abstract) != 1:
        raise SystemExit('essay abstract did not parse')
    foot = re.findall(r'<div class="foot">(.*?)</div>\s*</header>', src, re.S)
    foot_bits = re.findall(r'<div><b>(.*?)</b>(.*?)</div>', foot[0], re.S) if foot else []
    sections = []
    for sid, label, heading, meta in re.findall(
        r'<section id="(part1|table43|part2|sources)" class="part">\s*<div class="ch-head"><span class="lbl">(.*?)</span><h2>(.*?)</h2><span class="meta">(.*?)</span>',
        src, re.S,
    ):
        sections.append((sid, plain(label), plain(heading), plain(meta)))
    if [s[0] for s in sections] != ['part1', 'table43', 'part2', 'sources']:
        raise SystemExit('essay sections out of order')
    paras: dict[str, list[tuple[bool, str]]] = {}
    for key, part, inner in re.findall(r'<div class="para( key)?" data-part="([^"]+)"><p>(.*?)</p></div>', src, re.S):
        paras.setdefault(part, []).append((bool(key), inner.strip()))
    expected = {'I': 14, 'II': 8, 'S': 9}
    for part, count in expected.items():
        if len(paras.get(part, [])) != count:
            raise SystemExit(f'part {part} has {len(paras.get(part, []))} paragraphs, expected {count}')
    rows = re.findall(
        r'<tr><td class="k">(.*?)</td><td(?: class="([^"]*)")?>(.*?)</td><td(?: class="([^"]*)")?>(.*?)</td></tr>',
        src, re.S,
    )
    if len(rows) != 11:
        raise SystemExit(f'expected 11 comparison rows, found {len(rows)}')
    cap = plain(must(r'<p class="cap">(.*?)</p>', src).group(1))
    note = must(r'<div class="box"><span class="tag">NOTE</span><p>(.*?)</p>', src).group(1)
    note = note.replace('href="/#ch4"', 'href="/designs/grok/#ch4"')

    def essay_block(part: str) -> str:
        bits = []
        for i, (key, inner) in enumerate(paras[part], start=1):
            klass = 'gk-para is-key' if key else 'gk-para'
            bits.append(f'<div class="{klass}"><span class="gk-pn">{esc(part)}.{i}</span><p>{inner}</p></div>')
        return ''.join(bits)

    def section_head(sid: str) -> str:
        _sid, label, heading, meta = next(item for item in sections if item[0] == sid)
        return f'<p class="gk-kicker">{esc(label)}</p><h2>{esc(heading)}</h2><p class="gk-meta">{esc(meta)}</p>'

    row_html = []
    for key, klass_a, left, klass_b, right in rows:
        la = ' class="gk-same"' if klass_a == 'same' else ''
        lb = ' class="gk-same"' if klass_b == 'same' else ''
        row_html.append(f'<tr><td class="gk-ink">{key}</td><td{la}>{left}</td><td{lb}>{right}</td></tr>')
    foot_html = ''.join(f'<div><b>{plain(b)}</b><span>{rest.strip()}</span></div>' for b, rest in foot_bits)
    nav = (
        '<a class="gk-skip" href="#part1">Skip to the argument</a>'
        '<header class="gk-bar"><a class="gk-brand" href="/designs/grok/"><i>●</i>SOOCH</a><nav class="gk-nav" aria-label="Paper">'
        '<a href="#part1">Argument</a><a href="#table43">Compare</a><a href="#part2">Second story</a><a href="#sources">Sources</a>'
        '<a href="/designs/grok/lab/">The Lab</a><a href="/designs/grok/#ch4">All writing</a></nav></header>'
    )
    return head(
        'Two Stories About the Beginning | Sean Sooch',
        'The Big Bang and a generated origin are the same kind of story: a starting condition plus a rule, with the evidence only ever reaching the rule.',
        'https://seansooch.dev/designs/grok/two-stories/', switch_head,
    ) + f'''<body>
{nav}
<main id="top" class="gk-essay">
  {plate(5, eager=True)}
  <header class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Humanities · independent research · table 4-3 · September 2026</p>
    <h1>{esc(title)}</h1>
    <div class="gk-hero" style="min-height:0;grid-template-columns:1.2fr .8fr">
      <p class="gk-lead">{sub}</p>
      <aside class="gk-abstract"><p class="gk-kicker">Abstract</p><p>{abstract[0][0]}</p><p>{abstract[0][1]}</p></aside>
    </div>
    <div class="gk-layers">{''.join(f'<div><span class="gk-no"></span><span><b>{esc(plain(b))}</b><span>{rest.strip()}</span></span></div>' for b, rest in foot_bits)}</div>
  </div></header>
  <section id="part1" class="gk-station"><div class="gk-wrap">{section_head('part1')}{essay_block('I')}</div></section>
  {plate(6)}
  <section id="table43" class="gk-station"><div class="gk-wrap">{section_head('table43')}
    <div class="gk-scroll" tabindex="0"><table>
      <thead><tr><th></th><th>First story: a prior physical state</th><th>Second story: a prior computational state</th></tr></thead>
      <tbody>{''.join(row_html)}</tbody>
    </table></div>
    <p class="gk-meta">{esc(cap)}</p>
  </div></section>
  {plate(7)}
  <section id="part2" class="gk-station"><div class="gk-wrap">{section_head('part2')}{essay_block('II')}</div></section>
  <section id="sources" class="gk-station"><div class="gk-wrap">{section_head('sources')}{essay_block('S')}
    <div class="gk-note"><strong>Note</strong><p>{note}</p></div>
  </div></section>
</main>
<footer class="gk-foot"><span>© 2026 Sean Sooch · Table 4-3 · The Night Orbit</span><a href="/designs/grok/#ch4">Back to the writing</a></footer>
{switch_nav}
</body></html>
'''


def render_lab() -> str:
    switch_head, switch_nav = switcher('lab')
    nav = (
        '<a class="gk-skip" href="#course">Skip to the course</a>'
        '<header class="gk-bar"><a class="gk-brand" href="/designs/grok/"><i>●</i>SOOCH</a><nav class="gk-nav" aria-label="The Lab">'
        '<a href="/designs/grok/#ch3">Work</a><a href="/designs/grok/#ch4">Writing</a><a href="/designs/grok/#appb">Films</a>'
        '<a href="/designs/grok/#appa">Editions</a><a href="/designs/grok/lab/" aria-current="page">The Lab</a>'
        '<a href="/designs/grok/#lab">Back</a></nav></header>'
    )
    return head(
        'The Lab | Sean Sooch, The Night Orbit',
        'The Lab: a course in core medicine, taught one picture at a time. Step-by-step visual lessons in plain language. Educational only, not for clinical use.',
        'https://seansooch.dev/designs/grok/lab/', switch_head,
    ) + f'''<body>
{nav}
<main id="top">
  {plate(8, eager=True)}
  <header class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">Medicine · the lab · since October 2026</p>
    <h1 class="gk-station" style="padding:0">The Lab</h1>
    <p class="gk-lead">A course in core medicine, taught one picture at a time. Each lesson takes a single idea, starting with how the heart fills and empties, builds it step by step in plain language with animated visuals, then shows how disease and common drug classes change the picture. New lessons are added in order.</p>
    <div class="gk-note"><strong>Ground rules</strong><p>Every lesson has a Clinical values tab: typical adult reference ranges from standard physiology textbooks and major guidelines, each one cited, drawn against the lesson as it runs. The lessons are educational only and not for clinical use; they give no drug doses. Everything runs in your browser, with no accounts and no trackers, and works on a phone and with a keyboard.</p></div>
    <p class="gk-meta"><span data-lab-text="{{ready}} of {{total}}">Counted from the course ledger</span> · latest <span data-lab-text="{{latest}}">listed below</span></p>
  </div></header>
  {plate(9)}
  <section id="course" class="gk-station"><div class="gk-wrap">
    <p class="gk-kicker">The course</p>
    <h2>One idea at a time.</h2>
    <p class="gk-meta" data-lab-text="{{total}} lessons in teaching order · {{ready}} ready · {{left}} to come">Every lesson in teaching order. A shipped lesson is a link.</p>
    <div data-lab-list="all">
      <template data-lab-row="ready">
        <a class="gk-lesson" data-lab-link data-lab-index>
          <span class="gk-no">L-<span data-lab="no"></span></span>
          <span><span class="gk-name" data-lab="title"></span><span class="gk-desc"><span data-lab="description"></span><span class="gk-topics" data-lab="topics"></span></span></span>
          <span class="gk-end"><span data-lab="date"></span><span class="gk-go">Learn</span></span>
        </a>
      </template>
      <template data-lab-row="soon">
        <div class="gk-lesson is-soon">
          <span class="gk-no">L-<span data-lab="no"></span></span>
          <span><span class="gk-name" data-lab="title"></span><span class="gk-desc"><span data-lab="description"></span><span class="gk-topics" data-lab="topics"></span></span></span>
          <span class="gk-end">Coming soon</span>
        </div>
      </template>
      <p class="gk-lead" data-lab-wait>The lesson list is drawn here from the course ledger. If it does not appear, the same course is listed at <a href="https://seansooch.dev/lab/#main">seansooch.dev/lab</a>.</p>
    </div>
    <p class="gk-meta">The mono line under each lesson names the drug classes and disease states it animates.</p>
    <div class="gk-note"><strong>Note</strong><p>A lesson is an app with a single page, the same in every view of this site, so opening one leaves this layout. The browser’s Back button returns here. Educational only, not for clinical use.</p></div>
  </div></section>
</main>
<footer class="gk-foot"><span>© 2026 Sean Sooch · The Night Orbit · educational only, not for clinical use</span><a href="/designs/grok/">The Night Orbit</a></footer>
{switch_nav}
</body></html>
'''


def patch_architecture() -> None:
    path = ROOT / 'ARCHITECTURE.md'
    text = path.read_text(encoding='utf-8')
    row = (
        '| `designs/grok/` | View G (Grok 4.7, "The Night Orbit", added 2026-10-27): the home page, the Two Stories essay, and the Lab course page. Generated by `tools/build-grok-view.py` from view A\'s pages; its views band and Vol. 03 row are read from view A\'s home page, so it lists the same views. A deep-space mission log in system fonts. Every picture is a NASA Astronomy Picture of the Day, chosen in the browser by `designs/grok/nasa-plates.js` (written by the same builder) from APOD\'s WordPress feed on science.nasa.gov: today\'s on the home hero, recent days on the plates, a fixed set of public-domain NASA days when the feed cannot be read. Check with `node tools/grok-nasa.walk.mjs <base>`. | No. Generated by `tools/build-grok-view.py`, which writes only this folder and this row. Rerun it after view A changes and commit the result; do not hand-edit |\n'
    )
    lines = text.splitlines(keepends=True)
    own = [i for i, line in enumerate(lines) if line.startswith('| `designs/grok/` |')]
    if len(own) != 1:
        raise SystemExit('ARCHITECTURE.md needs exactly one `designs/grok/` row in "What is in here"; this builder keeps it current')
    lines[own[0]] = row   # the builder owns this row; the rest of the file is edited by hand
    text = ''.join(lines)
    path.write_text(text, encoding='utf-8')


def main() -> None:
    home_src = (ROOT / 'index.html').read_text(encoding='utf-8')
    data = parse_home(home_src)
    out_dir = ROOT / 'designs' / 'grok'
    (out_dir / 'two-stories').mkdir(parents=True, exist_ok=True)
    (out_dir / 'lab').mkdir(parents=True, exist_ok=True)
    # written first: every page's head stamps it
    PLATES_JS.write_text(NASA_JS.replace('%%FALLBACK%%', json.dumps(APOD_FALLBACK, ensure_ascii=False)), encoding='utf-8')
    if len(APOD_FALLBACK) < max(max(r) for r in SLOTS.values()) + 1:
        raise SystemExit('APOD_FALLBACK needs one picture per slot')
    pages = {
        out_dir / 'index.html': render_home(data),
        out_dir / 'two-stories' / 'index.html': render_essay(),
        out_dir / 'lab' / 'index.html': render_lab(),
    }
    for path, text in pages.items():
        if 'fonts.googleapis' in text or 'api.x.ai' in text:
            raise SystemExit(f'refused to write a third-party request into {path}')
        # every picture is an APOD slot: the retired Grok Imagine stills and loop must not come back
        if '/screenshots/grok/' in text or '/videos/grok/' in text or '<video class="gk-video"' in text:
            raise SystemExit(f'{path} names a retired Grok Imagine file')
        rel = path.relative_to(out_dir).as_posix()
        found = [int(n) for n in re.findall(r'<img data-apod="(\d+)"', text)]
        if found != list(SLOTS[rel]):
            raise SystemExit(f'{rel}: picture slots {found}, expected {list(SLOTS[rel])}')
        if '/designs/grok/nasa-plates.js?v=' not in text:
            raise SystemExit(f'{rel}: nasa-plates.js missing')
        if '\N{EM DASH}' in text:
            raise SystemExit(f'{rel}: an em dash')
        path.write_text(text, encoding='utf-8')
    patch_architecture()
    for path, text in pages.items():
        if not re.search(r'data-design="grok" href="[^"]*" aria-current="page">', text) or 'data-destination="grok"' not in text:
            raise SystemExit(f'{path}: the switcher does not select this view')
    home = pages[out_dir / 'index.html']
    for needed in ('id="ch3"', 'id="lab"', 'id="ch4"', 'id="appb"', 'id="plate1"', 'id="ch1"', 'id="ch5"', 'id="appa"', 'id="ch2"', 'id="fig11"', 'id="indexsec"', 'data-lab-list="ready"', 'data-apod="0"'):
        if needed not in home:
            raise SystemExit('home missing ' + needed)
    essay = pages[out_dir / 'two-stories' / 'index.html']
    for needed in ('id="part1"', 'id="table43"', 'id="part2"', 'id="sources"'):
        if needed not in essay:
            raise SystemExit('essay missing ' + needed)
    lab = pages[out_dir / 'lab' / 'index.html']
    for needed in ('id="course"', 'data-lab-list="all"', 'data-lab-row="ready"', 'data-lab-row="soon"', 'data-lab-wait'):
        if needed not in lab:
            raise SystemExit('lab missing ' + needed)
    print('Grok view written.')


if __name__ == '__main__':
    main()
