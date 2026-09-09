// HUD controller: the single piece of real UI state is the active realm.
// Everything else derives from the realm config, the toggles, and the feeds.
import {THEMES, REALMS, DEFAULT_REALM, HUES, TICKER_DEFAULT} from './hud-config.js';
import {renderHUD} from './hud-view.js';
import {fetchSummary, applySummary, tickerText} from './hud-data.js';

const STORE = 'asgard:hud-realm';
const SCENES = {
 thor: () => import('../astral-cartographer.js').then(m => m.createAstralCartographer),
 loki: () => import('../prism-foundry.js').then(m => m.createPrismFoundry),
 odin: () => import('../solar-throne.js').then(m => m.createSolarThrone)
};

const readHash = () => { const h = location.hash.replace('#', '').toLowerCase(); return REALMS.includes(h) ? h : null; };
const readStore = () => { try { const v = localStorage.getItem(STORE); return REALMS.includes(v) ? v : null; } catch { return null; } };
const writeStore = v => { try { localStorage.setItem(STORE, v); } catch {} };

export function createHUD(host, {base = '', scanlines = true, telemetry = true, motion = true} = {}) {
 const root = document.documentElement;
 let realm = readHash() || readStore() || DEFAULT_REALM;
 let summary = null, scene = null, sceneRealm = null, sceneToken = 0, disposed = false, art = null;
 const listeners = [];
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const still = () => !motion || reduced.matches;
 const listen = (el, type, fn) => { el.addEventListener(type, fn); listeners.push(() => el.removeEventListener(type, fn)); };

 root.dataset.motion = motion ? 'on' : 'off';

 // The realm config plus everything derived for one render pass.
 function view() {
  const t = applySummary({...THEMES[realm], id: realm}, summary);
  return {...t, realmName: realm.toUpperCase(),
   inputHint: 'Speak to ' + realm[0].toUpperCase() + realm.slice(1) + '…',
   live: {session: 'ASG-441', latency: '18 MS'}};
 }

 function paint() {
  if (disposed) return;
  root.dataset.realm = realm;
  const previousSlot = scene && sceneRealm === realm ? art?.querySelector('[data-stage="council"]') : null;
  art = renderHUD(host, view(), {scanlines, telemetry, ticker: tickerText(summary), onPick: select});
  if (previousSlot) art.querySelector('[data-stage="council"]').replaceWith(previousSlot);
  fit();
  mountScene();
 }

 // The octagon holds the app's real WebGL council; if it cannot start, the
 // striped placeholder underneath stays visible and the HUD is unaffected.
 async function mountScene() {
  const slot = art?.querySelector('[data-stage="council"]');
  if (!slot) return;
  if (scene && sceneRealm === realm) { scene.instance.setStill(still()); return; }
  scene?.instance.dispose(); scene = null; sceneRealm = null;
  const token = ++sceneToken, mountingRealm = realm;
  try {
   const create = await SCENES[mountingRealm]();
   if (disposed || token !== sceneToken) return;
   const instance = create(slot, {still: still(), onHover: () => {}, onSelect: key => {host.dispatchEvent(new CustomEvent('council-select', {detail:{realm:mountingRealm,agentKey:key}}));}, onStatus: () => {}});
   const canvas = slot.querySelector('canvas');
   scene = {instance, canvas}; sceneRealm = mountingRealm; slot.dataset.live = '1';
  } catch (error) {
   if (token === sceneToken) { slot.dataset.live = ''; console.warn('Council scene unavailable', error); }
  }
 }

 function select(next) {
  if (!REALMS.includes(next) || next === realm || disposed) return;
  realm = next; writeStore(realm);
  if (readHash() !== realm) location.hash = realm;
  paint();
 }

 // Fixed 1600x900 artboard, scaled to fit whatever width it is given.
 function fit() {
  if (!art) return;
  const scale = Math.min((host.clientWidth || 1600) / 1600, 1.35);
  art.style.transform = `scale(${scale})`;
  host.style.height = Math.round(900 * scale) + 'px';
 }

 const observer = new ResizeObserver(fit); observer.observe(host);
 listen(window, 'resize', fit);
 listen(reduced, 'change', () => scene?.instance.setStill(still()));
 listen(window, 'hashchange', () => { const h = readHash(); if (h) select(h); });

 if (!readHash()) location.hash = realm; else writeStore(realm);
 paint();
 let refreshing = false;
 async function refresh() {
  if (disposed || refreshing) return; refreshing = true;
  try { const s = await fetchSummary(base); if (!disposed && !s?.error) { summary = s; paint(); } }
  finally { refreshing = false; }
 }
 refresh();
 const refreshTimer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
 listen(document, 'visibilitychange', () => { if (!document.hidden) refresh(); });

 return {
  select, get realm() { return realm; },
  setMotion(on) { motion = !!on; root.dataset.motion = motion ? 'on' : 'off'; scene?.instance.setStill(still()); },
  setScanlines(on) { scanlines = !!on; paint(); },
  setTelemetry(on) { telemetry = !!on; paint(); },
  refresh,
  status: () => ({render:scene?.instance.status(),realm, scene: sceneRealm, live: !!scene, summary: !!summary,
   ticker: tickerText(summary) !== TICKER_DEFAULT ? 'live' : 'default',
   scale: art ? Number((art.style.transform.match(/[\d.]+/) || [1])[0]) : null,
   hues: Object.keys(HUES).length}),
  dispose() { if (disposed) return; disposed = true; clearInterval(refreshTimer); sceneToken++; observer.disconnect(); listeners.forEach(off => off()); scene?.instance.dispose(); host.replaceChildren(); }
 };
}
