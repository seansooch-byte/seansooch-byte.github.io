// The /music/ players. A page carries one or more <div class="bench">, each holding its own player
// (a <video> and a .nohls note inside .screen, then .tabs), a .now note and its list of films in
// <script type="application/json" class="films">. Each film: slug, title, date, len, about, credit, link {text, href};
// its stream and poster live in media/<slug>/ beside the page (made by tools/music-film.sh).
// In each bench the last film is the one loaded; #<slug> picks another in whichever bench holds it, and that bench
// is scrolled to. One film in a bench means no tabs. Playing any film pauses the others on the page.
(function () {
  var benches = Array.prototype.slice.call(document.querySelectorAll(".bench"));
  var videos = [];
  var start = (location.hash || "").slice(1).toLowerCase();
  function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }

  benches.forEach(function (bench) {
    var FILMS = JSON.parse(bench.querySelector("script.films").textContent);
    var v = bench.querySelector("video"), tabs = bench.querySelector(".tabs"), now = bench.querySelector(".now");
    var hls = null, current = null, bySlug = {};
    videos.push(v);
    FILMS.forEach(function (f, i) {
      f.no = String(i + 1).padStart(2, "0");
      bySlug[f.slug] = f;
      if (FILMS.length < 2) return;
      var b = el("button"); b.className = "tab"; b.dataset.film = f.slug; b.setAttribute("aria-pressed", "false");
      b.appendChild(el("b", f.no + " · " + f.title)); b.appendChild(el("span", f.len + " · " + f.date));
      b.addEventListener("click", function () {
        load(f.slug);
        if (history.replaceState) history.replaceState(null, "", "#" + f.slug);
      });
      tabs.appendChild(b);
    });
    if (FILMS.length < 2) tabs.remove();
    function has(id) { return Object.prototype.hasOwnProperty.call(bySlug, id); }   // "#constructor" is not a film
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }   // a refused autoplay is not an error
    function attach(src) {
      if (hls) { hls.destroy(); hls = null; }
      if (window.Hls && Hls.isSupported()) { hls = new Hls(); hls.loadSource(src); hls.attachMedia(v); return true; }
      if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; return true; }
      bench.querySelector(".nohls").style.display = "flex";
      return false;
    }
    // A switch starts the other film from the top: they are different songs, so a shared playhead means nothing.
    function load(id) {
      if (!has(id) || id === current) return;
      var wasPlaying = current && !v.paused, f = bySlug[id];
      current = id;
      v.poster = "media/" + id + "/poster.jpg";
      if (!attach("media/" + id + "/index.m3u8")) return;
      if (wasPlaying) v.addEventListener("loadedmetadata", function once() { v.removeEventListener("loadedmetadata", once); play(); });
      if (tabs.isConnected) tabs.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.film === id ? "true" : "false"); });
      now.textContent = "";
      now.appendChild(el("p", f.about));
      var c = el("p", (FILMS.length > 1 ? f.no + " · " : "") + f.title.toUpperCase() + " · " + f.credit + " "); c.className = "credit";
      if (f.link) { var a = el("a", f.link.text); a.href = f.link.href; a.target = "_blank"; a.rel = "noopener"; c.appendChild(a); }
      now.appendChild(c);
    }
    if (has(start)) { load(start); if (bench !== benches[0]) bench.scrollIntoView(); }
    else load(FILMS[FILMS.length - 1].slug);
  });

  videos.forEach(function (v) {
    v.addEventListener("play", function () { videos.forEach(function (o) { if (o !== v && !o.paused) o.pause(); }); });
  });
})();
