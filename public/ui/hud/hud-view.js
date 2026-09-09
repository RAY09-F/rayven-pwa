// Builds the HUD from a realm config. Nothing here knows a realm by name:
// every value is read off the config object, so a realm is pure data.
import {HUES, deltaColor} from './hud-config.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const add = (parent, tag, cls, text) => { const n = el(tag, cls, text); parent.append(n); return n; };
const bars = (host, list, cls) => { for (const b of list) { const i = add(host, 'i', cls); i.style.animationDuration = b.dur; i.style.animationDelay = b.delay; i.classList.add('an'); } };

const STARS = [[14,18,'acc','4s',''],[22,64,'acc2','6.5s',''],[41,12,'acc','5.2s','.8s'],[58,74,'acc','3.6s','.4s'],[69,26,'acc2','7s',''],[80,58,'acc','4.8s','1.2s']];
const RULER = [9,5,5,12,5,5,9];

function overlays(art, scanlines) {
 add(art, 'div', 'ov ov-vignette'); add(art, 'div', 'ov ov-grid');
 if (scanlines) { add(art, 'div', 'ov ov-scanlines'); add(art, 'div', 'ov-scanband an'); }
 add(art, 'div', 'ov ov-floor');
 const runes = add(art, 'div', 'ov-runes an'); add(runes, 'i'); add(runes, 'b');
 const stars = add(art, 'div', 'ov');
 for (const [l, t, hue, dur, delay] of STARS) {
  const s = add(stars, 'div', 'ov-star an');
  s.style.cssText = `left:${l}%;top:${t}%;background:var(--${hue});animation-duration:${dur}${delay ? `;animation-delay:${delay}` : ''}`;
 }
 const a = add(art, 'div', 'ov-tick'); a.style.left = '0';
 const b = add(art, 'div', 'ov-tick'); b.style.right = '0';
 add(art, 'div', 'ov ov-shade');
}

function topRail(art, t, live) {
 const rail = add(art, 'header', 'rail-top');
 add(rail, 'div', 'wordmark', 'ASGARD');
 add(rail, 'div', 'vdiv');
 add(rail, 'div', 'realm-name', t.realmName);
 add(rail, 'div', 'realm-index', t.realm);
 add(rail, 'div', 'spacer');
 const st = add(rail, 'div', 'status');
 const link = add(st, 'div', 'row'); link.style.gap = '6px';
 add(link, 'b', null, live.connection);
 const ses = add(st, 'div', 'nw', 'SESSION '); ses.append(el('span', null, live.session));
 const lat = add(st, 'div', 'nw', 'LAT '); lat.append(el('span', null, live.latency));
 st.title = live.updated ? 'Snapshot: ' + live.updated + ' · refreshed every 60 seconds' : 'No successful data fetch';
 add(rail, 'div', 'vdiv');
 const nav = add(rail, 'nav', 'nav');
 add(nav, 'a', 'on', 'COUNCIL').href = '/#' + t.id; add(nav, 'a', null, 'CHANNEL').href = '/hall/#' + t.id; add(nav, 'a', null, 'SYSTEM').href = '/hall/?settings=1#' + t.id;
 add(rail, 'div', 'vdiv');
 const v = add(rail, 'div', 'voice-top');
 const m = add(v, 'div', 'm');
 for (const [h, o] of [[5,.7],[9,1],[3,.5]]) { const i = add(m, 'i'); i.style.height = h + 'px'; i.style.opacity = o; }
 add(v, 'div', null, 'VOICE OFF');
 
}

function leftColumn(art, t) {
 const col = add(art, 'aside', 'col-left');
 const head = add(col, 'div', 'row'); head.style.gap = '10px';
 add(head, 'div', 'heading', 'COUNCIL'); add(head, 'div', 'rule');
 const hd = add(head, 'div', 'dia'); hd.style.cssText = 'width:4px;height:4px;background:var(--acc)';
 const tag = add(col, 'div', 'left-tag');
 add(tag, 'div', null, t.leftTag[0]); add(tag, 'div', null, t.leftTag[1]);
 const roster = add(col, 'div', 'roster');
 t.council.forEach((m, i) => {
  const hue = HUES[m.hue];
  const row = add(roster, 'div', 'member');
  add(row, 'div', 'n', '0' + (i + 1));
  const gem = add(row, 'div', 'gem'); gem.style.cssText = `background:${hue};box-shadow:0 0 14px ${hue}`;
  const box = add(row, 'div'); box.style.minWidth = '0';
  add(box, 'div', 'name', m.name).style.color = hue;
  add(box, 'div', 'domain', m.domain).title = m.domain;
 });
 add(col, 'div', 'spacer');
 const desk = add(col, 'section', 'desk');
 const dh = add(desk, 'div', 'desk-head');
 add(dh, 'div', 'd'); add(dh, 'div', 'desk-title', t.desk.title);
 add(dh, 'div', 'rule'); add(dh, 'div', 'desk-meta', t.desk.meta);
 const stats = add(desk, 'div', 'stats');
 for (const s of t.desk.stats) {
  const tile = add(stats, 'div', 'stat');
  add(tile, 'div', 'k', s.k);
  add(tile, 'div', 'v', s.v).style.color = deltaColor(s.t);
 }
 const rows = add(desk, 'div', 'desk-rows');
 for (const r of t.desk.rows) {
  const row = add(rows, 'div', 'desk-row');
  add(row, 'div', 'k', r.k); add(row, 'div', 'rule');
  add(row, 'div', 'v', r.v).style.color = deltaColor(r.t);
  if (r.asOf) row.title='Recorded market snapshot: '+new Date(r.asOf).toISOString();
 }
 const foot = add(col, 'div', 'left-foot');
 const seg = add(foot, 'div', 'seg'); add(seg, 'i'); add(seg, 'i'); add(seg, 'i');
 const lines = add(foot, 'div', 'foot-lines');
 add(lines, 'div', null, t.foot[0]); add(lines, 'div', null, t.foot[1]);
}

function motif(ring, kind) {
 const spec = {
  thor: [['motif m-thor-1'],['motif m-thor-2 an'],['motif m-thor-3 an'],['motif m-thor-h'],['motif m-thor-v']],
  loki: [['motif m-loki-1 an'],['motif m-loki-2 an'],['motif m-loki-3 an'],['motif m-loki-4 an']],
  odin: [['motif m-odin-1 an'],['motif m-odin-2'],['motif m-odin-3'],['motif m-odin-4 an']]
 }[kind] || [];
 for (const [cls] of spec) add(ring, 'div', cls);
}

function nameplate(stage, t) {
 const n = t.nameplate;
 if (n.kind === 'odin') {
  const p = add(stage, 'div', 'plate plate-odin');
  const up = add(p, 'div', 'rules up'); add(up, 'i', 'w260'); add(up, 'i', 'w180');
  const wr = add(p, 'div', 'word-row');
  add(wr, 'div', 'd'); add(wr, 'div', 'word', n.word); add(wr, 'div', 'd');
  add(p, 'div', 'rule-txt', n.rule);
  const dn = add(p, 'div', 'rules down'); add(dn, 'i', 'w180'); add(dn, 'i', 'w260');
  add(p, 'div', 'sub', n.sub);
  return;
 }
 if (n.kind === 'loki') {
  const p = add(stage, 'div', 'plate plate-loki');
  add(p, 'div', 'ghost an', n.word);
  add(p, 'div', 'word an', n.word);
  const rr = add(p, 'div', 'rule-row');
  add(rr, 'div', 'd'); add(rr, 'div', 'rule-txt', n.rule); add(rr, 'div', 'd2');
  add(p, 'div', 'sub', n.sub);
  return;
 }
 const p = add(stage, 'div', 'plate plate-thor');
 add(p, 'div', 'word', n.word);
 const rr = add(p, 'div', 'rule-row');
 add(rr, 'div', 'g'); add(rr, 'div', 'rule-txt', n.rule); add(rr, 'div', 'g2');
 const ruler = add(p, 'div', 'ruler');
 for (const h of RULER) { const i = add(ruler, 'i', h > 8 ? 'a' : null); i.style.height = h + 'px'; }
 add(p, 'div', 'sub', n.sub);
}

function centreStage(art, t, showTelemetry) {
 const stage = add(art, 'main', 'stage');
 for (const c of ['tl','tr','bl','br']) add(stage, 'div', 'bracket ' + c);
 add(stage, 'div', 'stage-side', 'THE THREE REALMS');
 if (showTelemetry) {
  const l = add(stage, 'div', 'tel left'), r = add(stage, 'div', 'tel right');
  t.telemetry.slice(0, 2).forEach(x => { const d = add(l, 'div', 't'); add(d, 'div', 'k', x.k); add(d, 'div', 'v', x.v); });
  t.telemetry.slice(2).forEach(x => { const d = add(r, 'div', 't'); add(d, 'div', 'k', x.k); add(d, 'div', 'v', x.v); });
 }
 const label = add(stage, 'div', 'stage-label');
 add(label, 'i'); add(label, 'div', null, t.stageLabel); add(label, 'i');

 const ring = add(stage, 'div', 'ring');
 motif(ring, t.nameplate.kind);
 add(ring, 'div', 'ticks an');
 add(ring, 'div', 'halo an');
 for (const o of ['o1','o2','o3']) { const g = add(ring, 'div', 'orbit ' + o + ' an'); add(g, 'i'); }
 const ca = add(ring, 'div', 'callout a');
 add(ca, 'div', 'tag', t.tagA); add(ca, 'div', 'line'); add(ca, 'div', 'd');
 const cb = add(ring, 'div', 'callout b');
 add(cb, 'div', 'd'); add(cb, 'div', 'line'); add(cb, 'div', 'tag', t.tagB);
 const target = add(ring, 'div', 'target');
 for (let i = 0; i < 4; i++) add(target, 'i', 'an');
 const render = add(ring, 'div', 'render an');
 render.dataset.stage = 'council';
 const fb = add(render, 'div', 'render-fallback');
 add(fb, 'div', 'd'); add(fb, 'div', 'a', 'COUNCIL RENDER · 3D STAGE'); add(fb, 'div', 'b', 'SCENE UNAVAILABLE');
 nameplate(stage, t);
}

function rightColumn(art, t) {
 const col = add(art, 'aside', 'col-right');
 const h1 = add(col, 'div', 'head-row');
 add(h1, 'div', 'heading', 'CONVERSATION'); add(h1, 'div', 'rule'); add(h1, 'div', 'micro', t.microTag);
 const msgs = add(col, 'div', 'msgs');
 if (!t.msgs.length) add(msgs, 'div', 'bubble', t.historyStatus);
 for (const m of t.msgs) {
  if (m.bot) {
   const row = add(msgs, 'div', 'msg-bot');
   const av = add(row, 'div', 'avatar'); add(av, 'i', 'an');
   const box = add(row, 'div'); box.style.minWidth = '0';
   add(box, 'div', 'msg-who', t.realmName);
   add(box, 'div', 'bubble', m.text);
  } else {
   const row = add(msgs, 'div', 'msg-user');
   add(row, 'div', 'bubble', m.text);
  }
 }
 const listen = add(col, 'div', 'listen');
 add(listen, 'div', 'o');

 add(listen, 'div', 'micro', 'MICROPHONE OFF');
 const h2 = add(col, 'div', 'head-row'); h2.style.marginTop = '4px';
 add(h2, 'div', 'heading', 'COUNSEL'); add(h2, 'div', 'rule'); add(h2, 'div', 'micro', t.counselTag);
 const hue = HUES[t.counsel.hue];
 const card = add(col, 'div', 'counsel');
 add(card, 'div', 'gem').style.cssText = `background:${hue};box-shadow:0 0 16px ${hue}`;
 const body = add(card, 'div'); body.style.cssText = 'min-width:0;flex:1';
 add(body, 'div', 'name', t.counsel.name).style.color = hue;
 add(body, 'div', 'line', t.counsel.line);
 add(card, 'div', 'chev', '›');
 add(col, 'div', 'spacer');
 const comp = add(col, 'a', 'composer');
 comp.href='/hall/#'+t.id;
 add(comp, 'div', 'hint', t.inputHint);
 add(comp, 'div', 'send', '➤');
 const sr = add(col, 'div', 'send-row');
 add(sr, 'div', null, 'CHAT AND VOICE'); add(sr, 'div', null, t.realm);
}

function ticker(art, text) {
 const rail = add(art, 'div', 'rail-ticker');
 const track = add(rail, 'div', 'ticker-track an');
 const run = text;
 add(track, 'div', null, run); add(track, 'div', null, run);
}

function bottomRail(art, t, onPick) {
 const rail = add(art, 'footer', 'rail-bottom');
 add(add(rail, 'div', 'sigil'), 'i');
 const load = add(rail, 'div', 'load');
 const lbl = add(load, 'div', 'lbl');
 add(lbl, 'div', null, 'COUNCIL LOAD'); lbl.append(el('span', null, t.signal));
 const segs = add(load, 'div', 'segs');
 segs.hidden = true;
 add(rail, 'div', 'spacer');
 const sw = add(rail, 'nav', 'switcher');
 for (const id of ['thor','loki','odin']) {
  const b = add(sw, 'button', 'pill', id.toUpperCase());
  b.type = 'button'; b.dataset.realm = id;
  b.setAttribute('aria-pressed', String(id === t.id));
  b.addEventListener('click', () => onPick(id));
 }
 add(rail, 'div', 'spacer');
 const vp = add(rail, 'a', 'voice-pill'); vp.href='/hall/#'+t.id;
 const m = add(vp, 'div', 'm');
 for (const h of [6,12,8,4]) add(m, 'i').style.height = h + 'px';
 add(vp, 'div', null, 'VOICE'); add(vp, 'div', 'c', '⌄');
 const bt = add(rail, 'div', 'bottom-tag');
 for (const line of t.bottom) add(bt, 'div', null, line);
}

// Renders one realm into `host` and returns the artboard element.
export function renderHUD(host, view, {scanlines = true, telemetry = true, ticker: tickerText = 'Events unavailable', onPick = () => {}} = {}) {
 host.replaceChildren();
 const art = add(host, 'div', 'hud-art');
 overlays(art, scanlines);
 topRail(art, view, view.live);
 const body = add(art, 'div', 'body');
 leftColumn(body, view);
 centreStage(body, view, telemetry);
 rightColumn(body, view);
 ticker(art, tickerText);
 bottomRail(art, view, onPick);
 return art;
}
