import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEMES, HUES, DELTA, REALMS, DEFAULT_REALM, seq, deltaColor, TICKER_DEFAULT} from '../public/ui/hud/hud-config.js';
import {applySummary, tickerText} from '../public/ui/hud/hud-data.js';
import {getHudSummary} from '../src/lib/hud.js';

// The handoff's token table, transcribed independently of the config module.
const TOKENS = {
  thor: {'--acc':'#7bb0ff','--acc2':'#b79cff','--ink':'#dfeaff','--dim':'rgba(210,227,255,.66)','--bg':'#050a16','--panel':'rgba(12,22,46,.5)','--line':'rgba(123,176,255,.20)','--glow':'rgba(123,176,255,.20)','--display':"'Cormorant Garamond',serif"},
  loki: {'--acc':'#3ddc84','--acc2':'#e9c46a','--ink':'#d8f6e6','--dim':'rgba(200,240,218,.66)','--bg':'#04100a','--panel':'rgba(8,26,18,.5)','--line':'rgba(61,220,132,.20)','--glow':'rgba(61,220,132,.18)','--display':"'Cormorant Garamond',serif"},
  odin: {'--acc':'#e8c06a','--acc2':'#f6e3a1','--ink':'#f2e8d5','--dim':'rgba(242,232,213,.64)','--bg':'#07060a','--panel':'rgba(24,19,13,.55)','--line':'rgba(232,192,106,.20)','--glow':'rgba(232,192,106,.16)','--display':"'Cinzel',serif"}
};

test('theme tokens match the handoff table exactly, in config and in CSS', async () => {
  assert.deepEqual(REALMS, ['thor','loki','odin']);
  assert.equal(DEFAULT_REALM, 'odin');
  for (const realm of REALMS) assert.deepEqual(THEMES[realm].vars, TOKENS[realm], realm);
  assert.deepEqual(HUES, {violet:'#b98cff', crimson:'#ff6b6b', gold:'#f4d17a', azure:'#6ea8ff', jade:'#4ade80'});
  assert.deepEqual(DELTA, {up:'#4ade80', down:'#ff8a7a', flat:'var(--ink)'});
  // The stylesheet must carry the same numbers, since the HUD themes from CSS.
  const css = await readFile(new URL('../public/ui/hud/hud.css', import.meta.url), 'utf8');
  for (const realm of REALMS) {
    const block = css.match(new RegExp(`:root\\[data-realm="${realm}"\\]\\{([^}]*)\\}`));
    assert.ok(block, `${realm} block`);
    for (const [k, v] of Object.entries(TOKENS[realm])) assert.ok(block[1].includes(`${k}:${v}`), `${realm} ${k}:${v}`);
  }
  // One shared play-state, and reduced motion must outrank the realm rule.
  assert.ok(/\.hud-art,\.hud-art \*\{animation-play-state:var\(--anim\)!important\}/.test(css));
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{:root\[data-realm\]\[data-motion\]\{--anim:paused\}\}/.test(css));
  assert.ok(/:root\[data-motion="off"\]\{--anim:paused\}/.test(css));
});

test('every keyframe from the motion inventory exists with the handoff timing', async () => {
  const css = await readFile(new URL('../public/ui/hud/hud.css', import.meta.url), 'utf8');
  for (const name of ['hudSpin','hudSpinR','hudPulse','hudFlick','hudScan','hudDrift','hudSplit','hudBar','hudTicker','hudOrbit','hudTwinkle','hudBreathe'])
    assert.ok(new RegExp(`@keyframes ${name}\\{`).test(css), name);
  // Durations that carry the design's character.
  for (const rule of ['hudSpinR 160s','hudBreathe 6s','hudOrbit 24s','hudOrbit 17s','hudOrbit 31s','hudTicker 46s',
                      'hudSpin 220s','hudScan 7.5s','hudDrift 12s','hudSplit 5s','hudFlick 7s','hudSpin 9s','hudSpin 90s',
                      'hudSpin 40s','hudSpinR 26s','hudSpin 60s','hudSpinR 18s','hudSpin 70s','hudSpin 34s','hudPulse 2.6s','hudPulse 3.4s','hudPulse 2.2s'])
    assert.ok(css.includes(rule), rule);
  assert.ok(css.includes('@keyframes hudBar{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}'));
  assert.ok(css.includes('@keyframes hudTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}'));
});

test('each realm config carries the full shape the HUD reads', () => {
  for (const realm of REALMS) {
    const t = THEMES[realm];
    for (const key of ['vars','realm','stageLabel','signal','desk','tagA','tagB','leftTag','foot','bottom','microTag','counselTag','telemetry','council','msgs','counsel','nameplate','scene'])
      assert.ok(t[key] != null, `${realm}.${key}`);
    assert.equal(t.leftTag.length, 2);
    assert.equal(t.foot.length, 2);
    assert.equal(t.bottom.length, 3);
    assert.equal(t.telemetry.length, 4);
    assert.equal(t.council.length, 5);
    assert.equal(t.msgs.length, 3);
    assert.equal(t.desk.stats.length, 4);
    assert.equal(t.desk.rows.length, 3);
    // The five fixed crystal hues, one per seat, in order.
    assert.deepEqual(t.council.map(m => m.hue), ['violet','crimson','gold','azure','jade']);
    for (const m of t.council) assert.ok(HUES[m.hue], m.name);
    assert.ok(HUES[t.counsel.hue]);
    assert.equal(t.msgs.filter(m => m.bot).length, 2);
    assert.equal(t.msgs.filter(m => m.user).length, 1);
    assert.equal(t.nameplate.kind, realm);
  }
  assert.equal(THEMES.thor.council[0].name, 'SIF');
  assert.equal(THEMES.loki.council[3].name, 'JORMUNGANDR');
  assert.equal(THEMES.odin.council[1].name, 'VOLSTAGG');
  assert.equal(THEMES.odin.counsel.name, 'VOLSTAGG');
  assert.equal(deltaColor('up'), '#4ade80');
  assert.equal(deltaColor('down'), '#ff8a7a');
  assert.equal(deltaColor(undefined), 'var(--ink)');
});

test('bar timings are deterministic and inside their band', () => {
  const a = seq(26, 0.6, 1.7), b = seq(26, 0.6, 1.7);
  assert.deepEqual(a, b);
  assert.equal(a.length, 26);
  for (const x of a) {
    const d = parseFloat(x.dur);
    assert.ok(d >= 0.6 && d <= 1.7, x.dur);
    assert.ok(parseFloat(x.delay) < 0.91);
  }
});

test('live values replace desk numbers but never the labels, and missing feeds fall back', () => {
  const base = {...THEMES.odin, id: 'odin'};
  const merged = applySummary(base, {realms: {odin: {
    stats: [{v: '3'}, {v: '9'}, {v: '5 / 4', t: 'up'}, {v: '-$120', t: 'down'}],
    rows: [{k: 'ETH LONG · FRIGGA', v: '+$12', t: 'up'}],
    signal: 'WIN RATE 55%'
  }}});
  assert.deepEqual(merged.desk.stats.map(s => s.k), base.desk.stats.map(s => s.k), 'labels are design copy');
  assert.deepEqual(merged.desk.stats.map(s => s.v), ['3', '9', '5 / 4', '-$120']);
  assert.equal(merged.desk.stats[3].t, 'down');
  assert.equal(merged.desk.rows[0].v, '+$12');
  // A row the feed did not supply keeps the design's row rather than blanking.
  assert.deepEqual(merged.desk.rows[1], base.desk.rows[1]);
  assert.equal(merged.signal, 'WIN RATE 55%');
  // No feed at all is a no-op.
  assert.equal(applySummary(base, null), base);
  assert.equal(applySummary(base, {realms: {}}), base);
  // A stat the feed leaves null keeps the design value.
  const partial = applySummary(base, {realms: {odin: {stats: [null, {v: '2'}, null, null]}}});
  assert.equal(partial.desk.stats[0].v, base.desk.stats[0].v);
  assert.equal(partial.desk.stats[1].v, '2');
});

test('the ticker uses real events when there are any and the design line when quiet', () => {
  assert.equal(tickerText(null), TICKER_DEFAULT);
  assert.equal(tickerText({ticker: []}), TICKER_DEFAULT);
  assert.equal(tickerText({ticker: ['monitoring  swept 4 watches', 'memory written']}),
    'MONITORING SWEPT 4 WATCHES · MEMORY WRITTEN ·');
});

test('calendar, timers and paper snapshots use their actual sources', async () => {
 const now=Date.parse('2026-09-08T18:00:00Z');
 const store={
  'paper:portfolio':JSON.stringify({startingBalance:10000,cash:9000,positions:{freya:{entryPrice:100,qty:2}}}),
  'paper:candles:freya':JSON.stringify([{time:now,close:112}]),
  'paper:trades':JSON.stringify([{pnl:50,exitTime:now}]),
  'calendar:events':JSON.stringify([{title:'Review',date:'2026-09-08',time:'14:00'},{title:'Tomorrow',date:'2026-09-09',time:'09:00'}]),
  'kit:timers':JSON.stringify([{label:'Call back',dueAt:now+3600000},{label:'Tomorrow',dueAt:now+86400000}]),
  'todos':JSON.stringify([{done:true},{done:false}]),
  'routines:index':JSON.stringify([{enabled:true}]),
  'activity:log':JSON.stringify([{time:new Date(now).toISOString(),subsystem:'monitoring',action:'swept watches'}])
 };
 const env={RAYVEN_KV:{get:async k=>store[k]??null}};
 const result=await getHudSummary(env,{now});
 assert.equal(result.realms.loki.stats[0].v,'1');
 assert.equal(result.realms.loki.stats[1].v,'2');
 assert.equal(result.realms.loki.stats[2].v,'1');
 assert.equal(result.realms.loki.stats[3],null);
 assert.equal(result.realms.loki.rows[0].v,null,'No invented meeting duration');
 assert.equal(result.realms.thor,undefined,'Routines and todos are not plan milestones');
 assert.equal(result.sources.plans,false);
 assert.equal(result.realms.odin.rows[0].v,'+$24');
 assert.equal(result.realms.odin.rows[0].asOf,now);
 assert.deepEqual(result.ticker,['monitoring swept watches']);
 delete store['paper:candles:freya'];
 const missing=await getHudSummary(env,{now});
 assert.equal(missing.realms.odin.rows[0].v,null,'No fabricated zero P&L');
});

test('a failing subsystem degrades to the design values instead of throwing', async () => {
  const env = {RAYVEN_KV: {get: async () => { throw Error('KV down'); }, put: async () => {}, list: async () => { throw Error('KV down'); }}};
  const s = await getHudSummary(env);
  assert.ok(s.generated);
  assert.deepEqual(s.ticker, []);
  // Nothing sourced means nothing overridden, so applySummary is a no-op.
  const base = {...THEMES.thor, id: 'thor'};
  assert.equal(applySummary(base, s).desk.stats[0].v, base.desk.stats[0].v);
});
