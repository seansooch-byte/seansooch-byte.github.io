/* Expected: real edition routes, same reading section, working links without JS,
   no app routing, all three editions (Opus 5.5 pages built by ~/app-redesign/work/home-opus/build.py),
   and no motion when requested. Four pages exist in every view: the home page, the Two Stories essay,
   the Lab course page (/lab/, which the lab pipeline writes, is view A's) and Monitoring the Situation
   (/monitor/ is view A's). A lesson is an app: one page. */
(function () {
  'use strict';
  function routeFor(pathname, design, hash = '') {
    const roots = {astra: '/', fable: '/designs/fable/', opus: '/designs/opus/'};
    const page = pathname.replace(/^\/designs\/(?:fable|opus)(?=\/)/, '').replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    if (!roots[design] || !['/', '/two-stories', '/lab', '/monitor'].includes(page)) return null;
    return roots[design] + (page === '/' ? '' : page.slice(1) + '/') + hash;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {routeFor}; return; }
  const root = document.documentElement;
  const CURTAINS = {astra: ['ASTRA', 'THE PERSONAL INDEX'], fable: ['FABLE 5.1', 'THE FIELD MANUAL'], opus: ['OPUS 5.5', 'THE COMMENTARY']};
  const key = 'sooch-design-transition';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);
    if (!pending || pending.path !== location.pathname || Date.now() - pending.time > 15000) pending = null;
  } catch (_) { pending = null; }
  if (pending && !reduced) root.dataset.designPhase = 'arrive';

  document.addEventListener('DOMContentLoaded', function () {
    const switcher = document.querySelector('.design-switcher');
    if (!switcher) return;
    const links = [...switcher.querySelectorAll('a[data-design]')];
    let leaving = false;
    function refreshLinks() {
      links.forEach(link => {
        link.dataset.home = link.dataset.home || link.getAttribute('href');
        link.href = routeFor(location.pathname, link.dataset.design, location.hash) || link.dataset.home;
      });
    }
    refreshLinks();
    addEventListener('hashchange', refreshLinks);
    // Use a semantic section because each edition has a different composition.
    function readingPosition() {
      const sections = [...document.querySelectorAll('section[id], #fig11')]
        .map(el => ({el, rect: el.getBoundingClientRect()}))
        .filter(item => item.rect.height > 0 && item.rect.top <= 160)
        .sort((a, b) => b.rect.top - a.rect.top);
      if (!sections.length) return {hash: '', ratio: 0};
      const {el, rect} = sections[0];
      return {hash: '#' + el.id, ratio: Math.min(1, Math.max(0, (100 - rect.top) / rect.height))};
    }
    links.forEach(link => link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.getAttribute('aria-current')) { event.preventDefault(); return; }
      event.preventDefault();
      if (leaving) return;
      leaving = true;
      const position = readingPosition();
      const to = routeFor(location.pathname, link.dataset.design, position.hash) || link.dataset.home;
      const target = new URL(to, location.href);
      try { sessionStorage.setItem(key, JSON.stringify({...position, path: target.pathname, time: Date.now(), keyboard: event.detail === 0})); } catch (_) {}
      const curtain = document.querySelector('.design-curtain');
      curtain.dataset.destination = link.dataset.design;
      curtain.querySelector('strong').textContent = CURTAINS[link.dataset.design][0];
      curtain.querySelector('span').textContent = CURTAINS[link.dataset.design][1];
      switcher.dataset.selected = link.dataset.design;
      root.dataset.designPhase = 'leave';
      setTimeout(() => location.assign(to), reduced ? 0 : 340);
    }));
    if (pending) {
      const restore = function () {
        let target = pending.hash && document.getElementById(pending.hash.slice(1));
        if (target) {
          for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
            if (ancestor.tagName === 'DETAILS') ancestor.open = true;
          }
          const box = target.getBoundingClientRect();
          window.scrollTo({top: window.scrollY + box.top + box.height * pending.ratio - 100, behavior: 'instant'});
        }
        if (pending.keyboard) switcher.querySelector('[aria-current]').focus({preventScroll: true});
        requestAnimationFrame(() => { root.dataset.designPhase = 'reveal'; });
        setTimeout(() => { delete root.dataset.designPhase; }, 550);
      };
      // Font metrics affect essay positions. Do not hold the screen indefinitely.
      Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 650))]).then(restore);
    }
    // A page restored by Back must never retain its outgoing curtain.
    addEventListener('pageshow', event => {
      if (event.persisted) {
        delete root.dataset.designPhase;
        switcher.dataset.selected = root.dataset.design;
        leaving = false;
      }
    });
  });
})();
