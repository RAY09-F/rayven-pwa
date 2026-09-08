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
  art = renderHUD(host, view(), {scanlines, telemetry, ticker: tickerText(summary), onPick: select});
  fit();
  mountScene();
 }

 // The octagon holds the app's real WebGL council; if it cannot start, the
 // striped placeholder underneath stays visible and the HUD is unaffected.
 async function mountScene() {
  const slot = art?.querySelector('[data-stage="council"]');
  if (!slot) return;
  if (scene && sceneRealm === realm) { slot.dataset.live = '1'; slot.prepend(scene.canvas); scene.instance.resetView?.(); return; }
  scene?.instance.dispose(); scene = null; sceneRealm = null;
  const token = ++sceneToken;
  try {
   const create = await SCENES[realm]();
   if (disposed || token !== sceneToken) return;
   const instance = create(slot, {onHover: () => {}, onSelect: () => {}, onStatus: () => {}});
   const canvas = slot.querySelector('canvas');
   scene = {instance, canvas}; sceneRealm = realm; slot.dataset.live = '1';
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
 listen(window, 'hashchange', () => { const h = readHash(); if (h) select(h); });

 if (!readHash()) location.hash = realm; else writeStore(realm);
 paint();
 fetchSummary(base).then(s => { if (disposed || s?.error) return; summary = s; paint(); });

 return {
  select, get realm() { return realm; },
  setMotion(on) { root.dataset.motion = on ? 'on' : 'off'; },
  setScanlines(on) { scanlines = !!on; paint(); },
  setTelemetry(on) { telemetry = !!on; paint(); },
  refresh: () => fetchSummary(base).then(s => { if (!disposed && !s?.error) { summary = s; paint(); } }),
  status: () => ({realm, scene: sceneRealm, live: !!scene, summary: !!summary,
   ticker: tickerText(summary) !== TICKER_DEFAULT ? 'live' : 'default',
   scale: art ? Number((art.style.transform.match(/[\d.]+/) || [1])[0]) : null,
   hues: Object.keys(HUES).length}),
  dispose() { if (disposed) return; disposed = true; sceneToken++; observer.disconnect(); listeners.forEach(off => off()); scene?.instance.dispose(); host.replaceChildren(); }
 };
}
