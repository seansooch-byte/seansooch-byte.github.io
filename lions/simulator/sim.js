/* Lions Simulator page: reads data/sim.json (made by tools/lions-sim/build.py) and draws everything. No libraries. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function pct(p, d) { return (p * 100).toFixed(d == null ? 1 : d) + '%'; }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var ord = ['', '1st', '2nd', '3rd', '4th'];
  var tip = $('tip');
  function showTip(html, x, y) { tip.innerHTML = html; tip.hidden = false; var w = tip.offsetWidth; tip.style.left = Math.min(x + 14, innerWidth - w - 8) + 'px'; tip.style.top = (y + 14) + 'px'; }
  function hideTip() { tip.hidden = true; }

  fetch('/lions/simulator/data/sim.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(function (e) {
    var m = $('err'); m.hidden = false; m.textContent = 'Could not load the simulation data (' + e.message + '). Serve this folder over http to see it.';
  });

  function init(D) {
    var M = D.meta, T = D.teams, R = D.result, TY = D.typical;
    var A = M.away, H = M.home, F = M.focus, O = F === H ? A : H;       // focus team and its opponent
    var col = {}; col[F] = '#0076B6'; col[O] = '#C77D00';
    var nm = function (t) { return T[t].name; };
    var ko = new Date(M.kickoff_utc);
    var koTxt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(ko) + ' ET';
    $('kicker').textContent = nm(A) + ' at ' + nm(H) + ' · ' + koTxt + ' · ' + M.n_sims.toLocaleString() + ' simulated games';
    document.title = 'Lions Simulator: ' + A + ' at ' + H + ' · Sean Sooch';
    var pF = F === H ? R.p_win.home : R.p_win.away, pO = F === H ? R.p_win.away : R.p_win.home, pT = R.p_win.tie;

    /* ---- win probability */
    $('wp').innerHTML =
      '<div class="wp-nums"><div><span class="n">' + pct(pF, 0) + '</span><span class="l"><span class="swatch" style="background:' + col[F] + '"></span>' + esc(nm(F)) + ' win</span></div>' +
      '<div><span class="n">' + pct(pO, 0) + '</span><span class="l"><span class="swatch" style="background:' + col[O] + '"></span>' + esc(nm(O)) + ' win</span></div>' +
      '<div><span class="n">' + pct(pT, 1) + '</span><span class="l"><span class="swatch" style="background:#8a857a"></span>tie (still level after overtime)</span></div></div>' +
      '<div class="bar" role="img" aria-label="' + esc(nm(F)) + ' ' + pct(pF) + ', ' + esc(nm(O)) + ' ' + pct(pO) + ', tie ' + pct(pT) + '">' +
      '<i style="width:' + pF * 100 + '%;background:' + col[F] + '"></i><i style="width:' + pT * 100 + '%;background:#8a857a"></i><i style="width:' + pO * 100 + '%;background:' + col[O] + '"></i></div>' +
      '<p class="note">Share of ' + M.n_sims.toLocaleString() + ' simulated games each side won. Average score: ' + esc(A) + ' ' + R.mean_pts.away.toFixed(1) + ', ' + esc(H) + ' ' + R.mean_pts.home.toFixed(1) +
      '. ' + pct(R.ot_rate, 1) + ' of games went to overtime. Home-field advantage is not in the model, so treat "home" as a label.</p>';

    /* ---- replay data: flatten drives into events */
    var ev = [], dstart = [];
    var prevSc = [0, 0];
    TY.drives.forEach(function (d, di) {
      dstart.push(ev.length);
      var first = d.plays[0];
      if (d.pk) {
        var kt = d.pk[0], kx = kt === 0 ? 35 : 65;
        ev.push({ di: di, k: 'kick', o: kt, d: 0, g: 0, x0: kx, x1: first ? first.x0 : d.x0, fd: null, q: d.q, c: d.c, sc: prevSc.slice(), tx: d.pk[1] + ': ' + nm(d.o === 0 ? A : H) + ' start at their ' + ydl(d.o, d.x0) });
      }
      d.plays.forEach(function (p) { var q = Object.assign({ di: di }, p); ev.push(q); prevSc = p.sc.slice(); });
      if (!d.plays.length) prevSc = d.sc.slice();
    });
    function teamOf(o) { return o === 0 ? A : H; }
    function ydl(o, x) { var yl = o === 0 ? 100 - x : x; return yl > 50 ? 'own ' + (100 - yl) : yl < 50 ? 'opp ' + yl : '50'; }
    var fin = TY.final;
    $('typ-note').innerHTML = 'Of ' + M.n_sims.toLocaleString() + ' simulated games, this is the one whose final score and key stats sit closest to the medians (' +
      'points, margin, yards, turnovers, plays; definition below). Final: <b>' + esc(A) + ' ' + fin[0] + ', ' + esc(H) + ' ' + fin[1] + (TY.ot ? ' (OT)' : '') + '</b>. It is typical, not likely: any one game is a single draw. Median game: ' +
      esc(A) + ' ' + TY.medians.away_pts + ', ' + esc(H) + ' ' + TY.medians.home_pts + '.';

    /* ---- scoreboard */
    var bd = $('board');
    function tmHtml(i) { var t = teamOf(i);
      return '<div class="tm ' + (i ? 'r' : '') + '" id="tm' + i + '">' + (i ? '' : '<i class="pos-dot"></i>') + '<span class="nm">' + esc(nm(t)) + '<small>' + (i ? 'home' : 'away') + '</small></span><span class="sc" id="sc' + i + '" style="color:#fff;border-bottom:5px solid ' + col[t] + '">0</span>' + (i ? '<i class="pos-dot"></i>' : '') + '</div>'; }
    bd.innerHTML = tmHtml(0) + '<div class="mid" id="mid"></div>' + tmHtml(1);
    /* ---- field */
    var f = $('field'), PX = 10, X0 = 100;
    el('rect', { x: 0, y: 0, width: 1200, height: 330, fill: '#2f6b3a' }, f);
    [0, 1].forEach(function (i) { var t = teamOf(i); var r = el('rect', { x: i ? 1100 : 0, y: 0, width: 100, height: 330, fill: col[t], 'fill-opacity': .85 }, f);
      var tx = el('text', { x: i ? 1150 : 50, y: 165, 'text-anchor': 'middle', fill: '#fff', 'font-size': 38, 'font-weight': 700, transform: 'rotate(' + (i ? 90 : -90) + ' ' + (i ? 1150 : 50) + ' 165)' }, f); tx.textContent = t; });
    for (var y = 0; y <= 100; y += 5) {
      var xx = X0 + y * PX;
      el('line', { x1: xx, x2: xx, y1: 0, y2: 330, stroke: '#fff', 'stroke-opacity': y % 10 ? .25 : .7, 'stroke-width': y % 10 ? 1 : 2 }, f);
      if (y % 10 === 0 && y > 0 && y < 100) { var n = y <= 50 ? y : 100 - y; var t1 = el('text', { x: xx, y: 306, 'text-anchor': 'middle', fill: '#fff', 'fill-opacity': .75, 'font-size': 22, 'font-weight': 700 }, f); t1.textContent = n; var t2 = el('text', { x: xx, y: 40, 'text-anchor': 'middle', fill: '#fff', 'fill-opacity': .75, 'font-size': 22, 'font-weight': 700 }, f); t2.textContent = n; }
    }
    var trail = el('polyline', { points: '', fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-opacity': .55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, f);
    var los = el('line', { x1: 0, x2: 0, y1: 0, y2: 330, stroke: '#2a67d0', 'stroke-width': 3, visibility: 'hidden' }, f);
    var fdl = el('line', { x1: 0, x2: 0, y1: 0, y2: 330, stroke: '#ffd23f', 'stroke-width': 4, 'stroke-dasharray': '10 8', visibility: 'hidden' }, f);
    var ball = el('ellipse', { cx: 0, cy: 165, rx: 15, ry: 9.5, fill: '#8a4b1f', stroke: '#fff', 'stroke-width': 2.5 }, f);
    var bx = function (x) { return X0 + x * PX; };

    /* ---- drive chart */
    var dr = $('drives');
    TY.drives.forEach(function (d, di) {
      var b = document.createElement('button'); b.className = 'drow fut'; b.type = 'button'; b.dataset.di = di;
      var t = teamOf(d.o), last = d.plays.filter(function (p) { return p.k !== 'pat'; }); last = last[last.length - 1];
      var xs = d.x0, xe = last ? last.x1 : d.x0;
      var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 1200 18'); s.setAttribute('preserveAspectRatio', 'none');
      el('rect', { x: 100, y: 5, width: 1000, height: 8, fill: '#e6dfc9' }, s);
      var xa = Math.min(xs, xe), xb = Math.max(xs, xe);
      el('rect', { x: bx(xa), y: 3, width: Math.max(bx(xb) - bx(xa), 6), height: 12, fill: col[t] }, s);
      el('circle', { cx: bx(xe), cy: 9, r: 7, fill: col[t], stroke: '#fffdf7', 'stroke-width': 2.5 }, s);
      var res = d.res + (d.rk === 'td' || d.rk === 'fg' || d.rk === 'deftd' ? '' : '');
      b.innerHTML = '<span class="t">' + (di + 1) + '</span><span class="t"><span class="swatch" style="background:' + col[t] + '"></span>' + esc(t) + '</span><span class="gr"></span><span class="r"><b>' + esc(res) + '</b><span>' + d.pl + ' plays, ' + d.yds + ' yds, ' + mmss(d.secs) + '</span></span>';
      b.querySelector('.gr').appendChild(s);
      b.title = nm(t) + ' drive ' + (di + 1) + ': ' + res;
      b.addEventListener('click', function () { pause(); go(dstart[di], true); });
      dr.appendChild(b);
    });

    /* ---- player state */
    var i = 0, playing = false, raf = 0, tStart = 0, dur = 0, anim = false;
    var scrub = $('scrub'); scrub.max = ev.length - 1;
    function speed() { return +$('speed').value; }
    function dd(e) { return e.d ? ord[e.d] + ' & ' + e.g + ' · ' + esc(teamOf(e.o)) + ' ball at ' + ydl(e.o, e.x0) : ''; }
    function setBoard(e, done) {
      var sc = done ? e.sc : (i > 0 ? ev[i - 1].sc : [0, 0]);
      $('sc0').textContent = sc[0]; $('sc1').textContent = sc[1];
      $('tm0').classList.toggle('has', e.o === 0); $('tm1').classList.toggle('has', e.o === 1);
      var q = e.q === 'OT' ? 'OT' : 'Q' + e.q;
      $('mid').innerHTML = '<b>' + q + ' ' + mmss(e.c) + '</b>' + (e.d ? ord[e.d] + ' & ' + e.g : e.k === 'pat' ? 'try' : 'kick');
    }
    function setMarks(e, ballX) {
      var showL = e.d > 0 && e.k !== 'pat';
      los.setAttribute('visibility', showL ? 'visible' : 'hidden'); fdl.setAttribute('visibility', showL && e.fd != null ? 'visible' : 'hidden');
      if (showL) { los.setAttribute('x1', bx(e.x0)); los.setAttribute('x2', bx(e.x0)); }
      if (e.fd != null) { fdl.setAttribute('x1', bx(e.fd)); fdl.setAttribute('x2', bx(e.fd)); }
    }
    function trailFor(e, upto) {
      /* the whole drive so far, plus this play's progress */
      var pts = [], d = TY.drives[e.di];
      for (var k = dstart[e.di]; k < i; k++) { var p = ev[k]; if (p.k === 'kick' || p.k === 'pat' || p.k === 'pen') continue; if (!pts.length) pts.push(bx(p.x0) + ',165'); pts.push(bx(p.x1) + ',165'); }
      return pts;
    }
    function draw(frac, done) {
      var e = ev[i];
      var x = e.x0 + (e.x1 - e.x0) * frac, arc = 0;
      if (e.k === 'pass' || e.k === 'inc' || e.k === 'punt' || e.k === 'fg' || e.k === 'fgmiss' || e.k === 'kick' || e.k === 'int') arc = -Math.sin(Math.PI * frac) * (e.k === 'punt' || e.k === 'kick' || e.k === 'fg' || e.k === 'fgmiss' ? 110 : 55);
      ball.setAttribute('cx', bx(x)); ball.setAttribute('cy', 165 + arc);
      setMarks(e, x);
      var pts = trailFor(e), start = pts.length ? pts : [];
      if (e.k !== 'kick' && e.k !== 'pat' && e.k !== 'pen') { if (!start.length) start.push(bx(e.x0) + ',165'); start.push(bx(x) + ',165'); }
      trail.setAttribute('points', start.join(' '));
      setBoard(e, done);
      $('playtext').innerHTML = '<span class="dd">' + (dd(e) || (e.k === 'pat' ? 'Try after touchdown' : 'Kickoff')) + '</span>' + (done || frac > .55 ? esc(e.tx) : '…');
      scrub.value = i; $('pos').textContent = 'play ' + (i + 1) + ' of ' + ev.length + ' · drive ' + (e.di + 1) + ' of ' + TY.drives.length;
      var rows = dr.children;
      for (var r = 0; r < rows.length; r++) { rows[r].classList.toggle('cur', r === e.di); rows[r].classList.toggle('fut', r > e.di); }
      var cur = rows[e.di]; if (cur && cur.offsetTop < dr.scrollTop || cur && cur.offsetTop + cur.offsetHeight > dr.scrollTop + dr.clientHeight) dr.scrollTop = cur.offsetTop - 60;
    }
    function dwell(e) { return e.k === 'pat' ? 900 : e.k === 'kick' ? 1500 : 1300; }
    function frame(ts) {
      if (!playing) return;
      if (!tStart) tStart = ts;
      var frac = Math.min((ts - tStart) * speed() / dur, 1);
      draw(frac, frac >= 1);
      if (frac >= 1) {
        if (i >= ev.length - 1) { pause(); return; }
        i++; tStart = 0; dur = dwell(ev[i]); anim = true;
      }
      raf = requestAnimationFrame(frame);
    }
    function play() { if (i >= ev.length - 1 && scrub.value >= ev.length - 1 && finished) { i = 0; finished = false; } playing = true; $('b-play').textContent = '❚❚ Pause'; $('b-play').setAttribute('aria-label', 'Pause'); tStart = 0; dur = dwell(ev[i]); raf = requestAnimationFrame(frame); }
    var finished = false;
    function pause() { if (playing && i >= ev.length - 1) finished = true; playing = false; cancelAnimationFrame(raf); $('b-play').textContent = '▶ Play'; $('b-play').setAttribute('aria-label', 'Play'); }
    function go(n, done) { i = Math.max(0, Math.min(ev.length - 1, n)); finished = false; draw(1, true); }
    $('b-play').addEventListener('click', function () { playing ? pause() : play(); });
    $('b-next').addEventListener('click', function () { pause(); go(i + 1); });
    $('b-prev').addEventListener('click', function () { pause(); go(i - 1); });
    $('b-restart').addEventListener('click', function () { pause(); go(0); });
    scrub.addEventListener('input', function () { pause(); go(+scrub.value); });
    $('speed').addEventListener('change', function () { tStart = 0; });
    go(0);

    /* ---- distribution charts */
    function legend(parent) { var d = document.createElement('div'); d.className = 'legend'; d.innerHTML = [F, O].map(function (t) { return '<span><span class="swatch" style="background:' + col[t] + '"></span>' + esc(nm(t)) + '</span>'; }).join(''); parent.appendChild(d); }
    var H1 = R.hist_pts, n = M.n_sims;
    var cF = F === H ? H1.home : H1.away, cO = F === H ? H1.away : H1.home;
    (function () {
      var host = $('ch-pts'); host.className = 'chart'; host.innerHTML = '<h3>Points scored, share of games</h3>'; legend(host);
      var W = 600, Hh = 330, L = 44, B = 36, Tp = 14, Rr = 12, hi = 60;
      var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh); host.appendChild(s);
      var maxv = Math.max.apply(null, cF.slice(0, hi + 1).concat(cO.slice(0, hi + 1))) / n;
      var ym = Math.ceil(maxv * 100 / 2) * 2 / 100;
      var xs = function (v) { return L + (v + .5) * (W - L - Rr) / (hi + 1); }, ys = function (p) { return Hh - B - p / ym * (Hh - B - Tp); };
      for (var g = 0; g <= ym + 1e-9; g += .02) { el('line', { x1: L, x2: W - Rr, y1: ys(g), y2: ys(g), stroke: '#1a1a1a', 'stroke-opacity': .1 }, s); var tt = el('text', { x: L - 6, y: ys(g) + 4, 'text-anchor': 'end' }, s); tt.textContent = Math.round(g * 100) + '%'; }
      for (var v = 0; v <= hi; v += 10) { var tx = el('text', { x: xs(v), y: Hh - 14, 'text-anchor': 'middle' }, s); tx.textContent = v; }
      var ax = el('text', { x: (L + W) / 2, y: Hh - 1, 'text-anchor': 'middle' }, s); ax.textContent = 'points';
      [[cO, O, 0], [cF, F, 1]].forEach(function (a) {
        var pts = []; for (var v = 0; v <= hi; v++) pts.push(xs(v) + ',' + ys(a[0][v] / n));
        var area = el('polygon', { points: xs(0) + ',' + ys(0) + ' ' + pts.join(' ') + ' ' + xs(hi) + ',' + ys(0), fill: col[a[1]], 'fill-opacity': .14 }, s);
        el('polyline', { points: pts.join(' '), fill: 'none', stroke: col[a[1]], 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': a[2] ? '' : '7 4' }, s);
        var mean = F === a[1] ? (F === H ? R.mean_pts.home : R.mean_pts.away) : (F === H ? R.mean_pts.away : R.mean_pts.home);
        el('line', { x1: xs(mean - .5), x2: xs(mean - .5), y1: Tp, y2: Hh - B, stroke: col[a[1]], 'stroke-width': 1.5, 'stroke-dasharray': '2 3' }, s);
        var lb = el('text', { x: xs(mean - .5) + (a[2] ? -5 : 5), y: Tp + 12 + (a[2] ? 0 : 14), 'text-anchor': a[2] ? 'end' : 'start', class: 'lab', fill: '#1a1a1a' }, s); lb.textContent = a[1] + ' avg ' + mean.toFixed(1);
      });
      var cross = el('line', { x1: 0, x2: 0, y1: Tp, y2: Hh - B, stroke: '#1a1a1a', 'stroke-opacity': .5, visibility: 'hidden' }, s);
      var hit = el('rect', { x: L, y: Tp, width: W - L - Rr, height: Hh - B - Tp, fill: 'transparent' }, s);
      hit.addEventListener('mousemove', function (e) {
        var r = s.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
        var v = Math.max(0, Math.min(hi, Math.round((px - L) * (hi + 1) / (W - L - Rr) - .5)));
        cross.setAttribute('x1', xs(v)); cross.setAttribute('x2', xs(v)); cross.setAttribute('visibility', 'visible');
        showTip('<b>' + v + ' points</b><br>' + F + ': ' + pct(cF[v] / n) + ' of games<br>' + O + ': ' + pct(cO[v] / n) + ' of games', e.clientX, e.clientY);
      });
      hit.addEventListener('mouseleave', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
      $('cap-pts').textContent = 'Dashed = ' + O + ', solid = ' + F + '; vertical dotted lines are the averages. Hover for exact shares.';
    })();
    (function () {
      var host = $('ch-mar'); host.className = 'chart'; host.innerHTML = '<h3>Margin, ' + esc(F) + ' minus ' + esc(O) + '</h3>';
      var d = document.createElement('div'); d.className = 'legend'; d.innerHTML = '<span><span class="swatch" style="background:' + col[F] + '"></span>' + esc(F) + ' wins</span><span><span class="swatch" style="background:' + col[O] + '"></span>' + esc(O) + ' wins</span><span><span class="swatch" style="background:#8a857a"></span>tie</span>'; host.appendChild(d);
      var hm = R.hist_margin, lo = hm.lo, hi = hm.hi, W = 600, Hh = 330, L = 44, B = 36, Tp = 14, Rr = 12;
      var flip = F === A;   // counts are home minus away
      var cnt = hm.counts.slice(), mv = []; for (var k = 0; k < cnt.length; k++) mv.push(lo + k);
      if (flip) { cnt = cnt.slice().reverse(); mv = mv.map(function (v) { return -v; }).reverse(); }
      var vlo = -35, vhi = 35, maxv = 0; cnt.forEach(function (c, k) { if (mv[k] >= vlo && mv[k] <= vhi) maxv = Math.max(maxv, c / n); });
      var ym = Math.ceil(maxv * 100 / 1) / 100;
      var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh); host.appendChild(s);
      var bw = (W - L - Rr) / (vhi - vlo + 1), xs = function (v) { return L + (v - vlo) * bw; }, ys = function (p) { return Hh - B - p / ym * (Hh - B - Tp); };
      for (var g = 0; g <= ym + 1e-9; g += .01) { el('line', { x1: L, x2: W - Rr, y1: ys(g), y2: ys(g), stroke: '#1a1a1a', 'stroke-opacity': .1 }, s); var tt = el('text', { x: L - 6, y: ys(g) + 4, 'text-anchor': 'end' }, s); tt.textContent = Math.round(g * 100) + '%'; }
      for (var v = -30; v <= 30; v += 10) { var tx = el('text', { x: xs(v) + bw / 2, y: Hh - 14, 'text-anchor': 'middle' }, s); tx.textContent = (v > 0 ? '+' : '') + v; }
      var ax = el('text', { x: (L + W) / 2, y: Hh - 1, 'text-anchor': 'middle' }, s); ax.textContent = 'points (' + F + ' ahead is positive)';
      cnt.forEach(function (c, k) { var v = mv[k]; if (v < vlo || v > vhi) return; var h = c / n;
        var r = el('rect', { x: xs(v) + 1, y: ys(h), width: Math.max(bw - 2, 1), height: Math.max(Hh - B - ys(h), 0), fill: v > 0 ? col[F] : v < 0 ? col[O] : '#8a857a', rx: 2 }, s);
        r.addEventListener('mousemove', function (e) { showTip('<b>' + (v > 0 ? F + ' by ' + v : v < 0 ? O + ' by ' + (-v) : 'tie after OT') + '</b><br>' + pct(h, 2) + ' of games', e.clientX, e.clientY); });
        r.addEventListener('mouseleave', hideTip); });
      var med = R.margin_quantiles[2] * (flip ? -1 : 1);
      el('line', { x1: xs(med) + bw / 2, x2: xs(med) + bw / 2, y1: Tp, y2: Hh - B, stroke: '#1a1a1a', 'stroke-width': 1.5, 'stroke-dasharray': '2 3' }, s);
      var ml = el('text', { x: xs(med) + bw / 2 + 5, y: Tp + 12, class: 'lab', fill: '#1a1a1a' }, s); ml.textContent = 'median ' + (med > 0 ? '+' : '') + med.toFixed(0);
      $('cap-mar').textContent = 'Bars beyond ±35 are left off the axis. Half of games land within ' + Math.abs(R.margin_quantiles[1]).toFixed(0) + ' to ' + Math.abs(R.margin_quantiles[3]).toFixed(0) + ' points either way of the median.';
    })();
    (function () {
      var q = R.pts_quantiles, fq = F === H ? q.home : q.away, oq = F === H ? q.away : q.home, mq = R.margin_quantiles.map(function (v) { return F === H ? v : -v; }).sort(function (a, b) { return a - b; });
      var row = function (lab, a) { return '<tr><td>' + esc(lab) + '</td>' + a.map(function (v) { return '<td>' + v.toFixed(0) + '</td>'; }).join('') + '</tr>'; };
      $('dist-table').innerHTML = '<div class="scroll"><table><tr><th>Percentile of simulated games</th><th>10th</th><th>25th</th><th>50th</th><th>75th</th><th>90th</th></tr>' +
        row(F + ' points', fq) + row(O + ' points', oq) + row(F + ' margin', mq) + row('Total points', R.total_quantiles) + '</table></div>';
    })();

    /* ---- profiles */
    $('profiles').innerHTML = [F, O].map(function (t) { var p = T[t].profile, o = p.off, d = p.dfn;
      var rows = [
        ['Games / points for / against', p.games + ' / ' + p.ppg + ' / ' + p.papg + ' per game'],
        ['Pass rate (dropbacks / plays)', pct(o.pass_rate, 0)], ['Offense EPA per dropback / per rush', o.epa_db.toFixed(2) + ' / ' + o.epa_rush.toFixed(2)],
        ['Yards per carry / per attempt', o.ypc + ' / ' + o.ypa], ['Completion % / sack rate', pct(o.comp_pct, 0) + ' / ' + pct(o.sack_rate, 1)],
        ['Defense EPA per dropback / per rush allowed', d.epa_db.toFixed(2) + ' / ' + d.epa_rush.toFixed(2)],
        ['Defense yards per carry / attempt allowed', d.ypc + ' / ' + d.ypa], ['Defense sack rate / interception rate', pct(d.sack_rate, 1) + ' / ' + pct(d.int_rate, 1)],
        ['Quarterback', p.qb.name + ': ' + p.qb.comp + '/' + p.qb.att + ', ' + p.qb.yds + ' yds, ' + p.qb.td + ' TD, ' + p.qb.ints + ' INT'],
        ['Top targets (share)', p.targets.slice(0, 4).map(function (x) { return x.name + ' ' + pct(x.share, 0); }).join(', ')],
        ['Top carries (share, ypc)', p.carries.slice(0, 3).map(function (x) { return x.name + ' ' + pct(x.share, 0) + ', ' + x.ypc; }).join('; ')],
        ['Kicker / punter', (p.kicker ? p.kicker.name + ' ' + p.kicker.made + '/' + p.kicker.att + ' FG' : 'n/a') + ' · ' + (p.punter ? p.punter.name + ' ' + p.punter.avg + ' avg' : 'n/a')]];
      return '<div class="prof"><h3><span class="swatch" style="background:' + col[t] + '"></span>' + esc(nm(t)) + '</h3><div class="scroll"><table>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div></div>';
    }).join('');

    /* ---- method */
    var V = D.validation && D.validation.summary, C = D.calibration, ptg = V && V.per_team_game;
    $('method').innerHTML = '<p><b>Typical game:</b> ' + esc(TY.definition) + '</p><ul>' + D.method.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
      (C ? '<p>Five league-wide constants are calibrated to 2026 league means (not to points): yardage spread ' + C.sigma + ', pass-yard scale ' + C.pass_scale + ', rush-yard scale ' + C.rush_scale + ', play-call logit shift ' + C.call_logit + ', red-zone yard scale ' + C.rz_scale + '. The red-zone scale matches touchdowns per red-zone snap; the model otherwise scores low, so read absolute scoring as slightly conservative.</p>' : '');
    if (V) {
      var vt = D.validation.teams.filter(function (r) { return r.team === A || r.team === H; });
      var keys = [['plays', 'Plays'], ['yds', 'Yards'], ['fd', 'First downs'], ['td', 'Offensive TD drives'], ['fg', 'Field goals'], ['tov', 'Turnovers'], ['drives', 'Drives']];
      $('valid').innerHTML = '<div class="scroll"><table><tr><th>Points per game (2026, ' + V.games_replayed + ' games replayed, ' + V.sims_per_game + ' sims each)</th><th>Simulated</th><th>Real</th></tr>' +
        vt.map(function (r) { return '<tr><td>' + esc(nm(r.team)) + '</td><td>' + r.sim_ppg + '</td><td>' + r.real_ppg + '</td></tr>'; }).join('') +
        '<tr><td>League average (32 teams)</td><td>' + V.league_sim_ppg + '</td><td>' + V.league_real_ppg + '</td></tr>' +
        '<tr><td>Team-by-team: mean abs. error / correlation</td><td colspan="2">' + V.mae_ppg + ' pts / r = ' + V.corr_ppg + '</td></tr></table></div>' +
        '<div class="scroll" style="margin-top:12px"><table><tr><th>League average per team-game</th><th>Simulated</th><th>Real</th></tr>' + keys.map(function (k) { return '<tr><td>' + k[1] + '</td><td>' + ptg[k[0]].sim + '</td><td>' + ptg[k[0]].real + '</td></tr>'; }).join('') + '</table></div>' +
        '<p class="note">The sim sits below real scoring because shrinkage pulls strong offenses (' + esc(nm(F)) + ' and its ' + vt.filter(function (r) { return r.team === F; })[0].real_ppg + ' points a game) toward average; it is a calibration check, not a backtest (the same games built the model).</p>';
    }
    var fd = new Date(M.data_as_of + 'T12:00:00');
    $('foot').innerHTML = 'Data: <a href="' + esc(M.source_url) + '">nflverse play-by-play 2026</a> (regular season through Week ' + M.through_week + '; last game ' + esc(M.data_as_of) + '; ' + M.plays_in_file.toLocaleString() + ' plays; file SHA-256 ' + esc(M.source_sha256.slice(0, 16)) + '…). ' +
      M.n_sims.toLocaleString() + ' simulations, seed ' + M.seed + '. Built offline by <code>tools/lions-sim/build.py</code>; this page only draws the result. Simulation, not a prediction. Not affiliated with the NFL or any team.';
  }
})();
