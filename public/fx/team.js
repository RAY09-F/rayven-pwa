/* ASGARD FX — TEAM (the council page). Strike Three, Phase 4.2.
   team.html keeps its own hand-built renderer and its CONFIG untouched. This
   file adds only what can sit on top of it: palette alignment with the halls
   (CSS variables on the chrome, never the canvas), a static depth-of-field
   vignette and room dim (one CSS gradient, composited once), and a pointer
   light that follows the cursor (one pre-painted element moved by transform,
   at most ~30 times a second). Dark while the vault is open. ?fx=0 does
   nothing at all. The council page shares the halls' palette and mood, not
   their geometry. */
(function () {
  'use strict';
  let q; try { q = new URLSearchParams(location.search); } catch (e) { q = { get: () => null }; }
  if (q.get('fx') === '0') return;
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const CSS = [
    ':root{--ground:#0B0A12;--ground2:#14111D;--line:#292337}',
    '#asgardFxTeam{position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden}',
    '#asgardFxTeam.off{display:none}',
    '#asgardFxTeam .vig{position:absolute;inset:0;background:radial-gradient(ellipse 62% 58% at 50% 48%,rgba(11,10,18,0) 40%,rgba(11,10,18,.38) 78%,rgba(11,10,18,.62) 100%)}',
    '#asgardFxTeam .light{position:absolute;left:0;top:0;width:360px;height:360px;margin:-180px 0 0 -180px;border-radius:50%;opacity:0;will-change:transform,opacity;transition:opacity .6s;',
    '  background:radial-gradient(circle,rgba(255,199,64,.11) 0%,rgba(255,199,64,.05) 38%,rgba(255,199,64,0) 70%)}',
    '#asgardFxTeam .light.on{opacity:1}'
  ].join('\n');
  function start() {
    if (document.getElementById('asgardFxTeam')) return;
    const st = document.createElement('style'); st.id = 'asgardFxTeamStyle'; st.textContent = CSS; document.head.appendChild(st);
    const layer = document.createElement('div'); layer.id = 'asgardFxTeam'; layer.setAttribute('aria-hidden', 'true');
    const vig = document.createElement('div'); vig.className = 'vig'; layer.appendChild(vig);
    const light = document.createElement('div'); light.className = 'light'; layer.appendChild(light);
    document.body.appendChild(layer);
    // the pointer light: transform only, throttled to the frame, off after 2.5 s without movement
    let px = -9999, py = -9999, raf = 0, last = 0, hideT = 0;
    function place() { raf = 0; light.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)'; }
    function onMove(e) {
      const t = performance.now(); if (t - last < 33) return; last = t;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(place);
      if (!light.classList.contains('on')) light.classList.add('on');
      clearTimeout(hideT); hideT = setTimeout(() => light.classList.remove('on'), 2500);
    }
    if (!REDUCED) window.addEventListener('pointermove', onMove, { passive: true });
    // dark while the vault is open: follow the hidden attribute the page already uses
    const vault = document.getElementById('vault');
    if (vault && window.MutationObserver) {
      const sync = () => layer.classList.toggle('off', !vault.hidden);
      new MutationObserver(sync).observe(vault, { attributes: true, attributeFilter: ['hidden'] }); sync();
    }
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
