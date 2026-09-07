// AUTOMATION TEMPLATES (asgard-upgrade Phase 7.13b). Templates are CODE, not KV:
// 25 routines Rayan can switch on by saying one sentence. Disabled until enabled;
// routine_enable_template copies one into routines:<id> and the index (2 writes,
// Rule 5a2). Each passes Phase 3's guard rails: none can send an SMS, post, or spend.
import { DEFAULT_TZ } from './schedule.js';
const TZ = DEFAULT_TZ;
const at = (hhmm, days) => ({ kind: 'schedule', at: hhmm, days: days || [0, 1, 2, 3, 4, 5, 6], tz: TZ });
const on = (event, match) => ({ kind: 'event', event, ...(match ? { match } : {}) });

export const TEMPLATES = [
  { id: 'tpl-rain-tomorrow', say: 'rain tomorrow → tell me tonight at nine', owner: 'loki', name: 'Rain tomorrow', intent: 'at 21:00, if rain is in tomorrow\'s forecast, one line', trigger: at('21:00'), deliver: 'telegram',
    steps: [{ tool: 'nws_forecast', args: { n: 6 } }, { compose: { instruction: 'From the forecast periods (step 0), if rain, showers or thunderstorms appear for tomorrow, say so in one sentence with the chance if given. If not, reply NOTHING.', tier: 'cheap', maxTokens: 120 } }] },
  { id: 'tpl-nws-kern', say: 'NWS alert for Kern County → push it to my phone', owner: 'loki', name: 'Weather alert', intent: 'a National Weather Service alert covering Kern County → one push', trigger: on('weather.alert'), deliver: 'telegram',
    steps: [{ say: 'Weather alert for Kern County: $event.payload.headline' }, { tool: 'ntfy_push', args: { title: 'NWS alert — Kern County', message: '$event.payload.headline', priority: 4 } }] },
  { id: 'tpl-calfire-near', say: 'CAL FIRE incident within 50 miles → tell me', owner: 'loki', name: 'Fire nearby', intent: 'a new CAL FIRE incident within 50 miles of Bakersfield → one message', trigger: on('fire.incident'), deliver: 'telegram',
    steps: [{ say: 'CAL FIRE: $event.payload.name in $event.payload.county County, $event.payload.acres acres, $event.payload.distanceMiles miles away. $event.payload.url' }] },
  { id: 'tpl-quake-near', say: 'earthquake over 4.0 within 100 miles → tell me', owner: 'loki', name: 'Quake nearby', intent: 'an earthquake of M4.0+ within 100 miles → one message', trigger: on('quake'), deliver: 'telegram',
    steps: [{ say: 'Earthquake: M$event.payload.mag $event.payload.place, $event.payload.distanceMiles miles away, $event.payload.time.' }] },
  { id: 'tpl-btc-move', say: 'BTC moves 5% in a day → Odin notes it (paper context only)', owner: 'odin', name: 'Bitcoin move', intent: 'Bitcoin moves 5% or more in 24 h → one PAPER-context note', trigger: on('market.move'), deliver: 'telegram',
    steps: [{ read: 'paper', period: 'today' }, { compose: { instruction: 'Bitcoin moved $event.payload.changePct% in 24 hours (now $$event.payload.price). In two sentences, note what that means for the PAPER book (step 0) — label PAPER · SIMULATED, never a real recommendation.', tier: 'cheap', maxTokens: 160 } }] },
  { id: 'tpl-fear-greed', say: 'Fear & Greed hits extreme → Odin notes it', owner: 'odin', name: 'Sentiment extreme', intent: 'the Crypto Fear & Greed index reads extreme fear or extreme greed → one note', trigger: on('sentiment.extreme'), deliver: 'telegram',
    steps: [{ say: 'Crypto Fear & Greed is at $event.payload.value ($event.payload.label). PAPER context only — no real trade follows from this.' }] },
  { id: 'tpl-earnings-week', say: 'earnings this week for the paper tickers → Monday morning', owner: 'odin', name: 'Earnings week', intent: 'Monday 07:00: which paper-book tickers report earnings this week', trigger: at('07:00', [1]), deliver: 'telegram',
    steps: [{ tool: 'news_search', args: { query: 'earnings this week SPY QQQ GLD USO' } }, { compose: { instruction: 'From step 0, list anything that says which large companies or the ETF holdings report earnings this week, in three sentences at most. PAPER context; no recommendation.', tier: 'cheap', maxTokens: 160 } }] },
  { id: 'tpl-yield-cross', say: 'treasury 10-year crosses a level I name → tell me', owner: 'odin', name: 'Yield cross', intent: 'the 10-year Treasury yield crosses a level Rayan names (edit the level in the template)', trigger: on('yield.cross'), deliver: 'telegram',
    steps: [{ say: 'The 10-year Treasury yield crossed $event.payload.level%: now $event.payload.value%.' }] },
  { id: 'tpl-job-digest', say: 'new job matching my criteria → 8 am digest', owner: 'loki', name: 'Job digest', intent: 'weekday 08:00 digest of NEW job matches only (edit the query in the template)', trigger: at('08:00', [1, 2, 3, 4, 5]), deliver: 'telegram',
    steps: [{ tool: 'jobs_search', args: { q: 'customer service', location: 'Bakersfield', n: 10 } }, { compose: { instruction: 'Step 0 is today\'s job search. Write a digest of at most five listings worth a look, one line each with the link. If nothing new, reply NOTHING.', tier: 'cheap', maxTokens: 300 } }] },
  { id: 'tpl-feed-new', say: 'a feed I watch posts → one-line summary in the brief', owner: 'loki', name: 'Feed watch', intent: 'a watched RSS feed posts a new item → one line', trigger: on('feed.new'), deliver: 'telegram',
    steps: [{ say: 'New from $event.payload.feed: $event.payload.title — $event.payload.link' }] },
  { id: 'tpl-trending-noon', say: 'trending now → noon digest of the top five', owner: 'loki', name: 'Trending at noon', intent: '12:00 digest of the top five Google trends', trigger: at('12:00'), deliver: 'telegram',
    steps: [{ tool: 'trending_now', args: { geo: 'US', n: 5 } }, { compose: { instruction: 'Turn step 0 into five short lines: what is trending and one plain phrase on why, if the snippet says.', tier: 'cheap', maxTokens: 200 } }] },
  { id: 'tpl-apod-morning', say: 'APOD picture → in the morning brief', owner: 'loki', name: 'Picture of the day', intent: '07:05 daily: NASA\'s picture of the day, title and link', trigger: at('07:05'), deliver: 'telegram',
    steps: [{ tool: 'nasa_apod', args: {} }] },
  { id: 'tpl-drive-time', say: 'calendar event has an address → drive time 45 minutes before', owner: 'loki', name: 'Drive time', intent: 'an upcoming calendar event with an address → the driving time, 45 minutes before', trigger: on('calendar.upcoming'), deliver: 'telegram',
    steps: [{ tool: 'maps_directions', args: { origin: 'Bakersfield, CA', destination: '$event.payload.location' } }, { compose: { instruction: 'Step 0 is the route to the next event ($event.payload.title). One sentence: how long the drive is now and when to leave.', tier: 'cheap', maxTokens: 100 } }] },
  { id: 'tpl-meeting-push', say: 'meeting in 10 minutes → push to phone', owner: 'loki', name: 'Meeting push', intent: 'a calendar event within 10 minutes → a phone push', trigger: on('calendar.upcoming'), deliver: 'silent',
    steps: [{ tool: 'ntfy_push', args: { title: 'Soon', message: '$event.payload.title at $event.payload.time', priority: 4 } }] },
  { id: 'tpl-stale-todo', say: 'to-do untouched for a week → Mobius asks if it\'s dead', owner: 'loki', name: 'Stale to-do', intent: 'Sunday 10:00: any to-do older than a week gets one question', trigger: at('10:00', [0]), deliver: 'telegram',
    steps: [{ read: 'todos' }, { compose: { instruction: 'From the to-dos (step 0), name the ones that look older than a week and ask, kindly and in one sentence each, whether they are still alive. If none, reply NOTHING.', tier: 'cheap', maxTokens: 200 } }] },
  { id: 'tpl-habit-nudge', say: 'habit not logged by 8 pm → one nudge', owner: 'loki', name: 'Habit nudge', intent: '20:00 daily: one nudge for any habit not yet logged today', trigger: at('20:00'), deliver: 'telegram',
    steps: [{ tool: 'habits_status', args: {} }, { compose: { instruction: 'Step 0 lists habits. If any says NOT yet today, one gentle sentence naming them. If all are done or there are none, reply NOTHING.', tier: 'cheap', maxTokens: 80 } }] },
  { id: 'tpl-expenses-sunday', say: 'weekly expenses → Sunday summary', owner: 'loki', name: 'Expenses week', intent: 'Sunday 18:30: the week\'s logged expenses', trigger: at('18:30', [0]), deliver: 'telegram',
    steps: [{ tool: 'expenses_week', args: { days: 7 } }] },
  { id: 'tpl-reading-hour', say: 'reading list has 5+ items → Sunday reading hour reminder', owner: 'loki', name: 'Reading hour', intent: 'Sunday 15:00: if the reading list holds five or more items, suggest a reading hour', trigger: at('15:00', [0]), deliver: 'telegram',
    steps: [{ tool: 'reading_list', args: { action: 'read' } }, { compose: { instruction: 'Step 0 is the reading list. If it has five or more open items, suggest a reading hour today in one sentence and name the top three. Otherwise reply NOTHING.', tier: 'cheap', maxTokens: 120 } }] },
  { id: 'tpl-weekend-playlist', say: 'Spotify Friday 5 pm → start the weekend playlist', owner: 'thor', name: 'Weekend playlist', intent: 'Friday 17:00: start the weekend playlist on Spotify', trigger: at('17:00', [5]), deliver: 'silent',
    steps: [{ tool: 'spotify_play', args: { query: 'weekend playlist' } }] },
  { id: 'tpl-extension-offline', say: 'extension offline while hall open → Thor says so once', owner: 'thor', name: 'Extension offline', intent: 'the browser extension goes offline → Thor says so once, spoken next time the hall opens', trigger: on('extension.offline'), deliver: 'speak',
    steps: [{ say: 'The browser extension has gone quiet — anything that needs the browser will wait until Chrome is back.' }] },
  { id: 'tpl-kv-warn', say: 'KV writes at 70% → warn me', owner: 'thor', name: 'Write budget warning', intent: 'the day\'s KV writes reach 70% of the ceiling → one warning', trigger: on('kv.quota.warning'), deliver: 'telegram',
    steps: [{ say: 'KV writes are at $event.payload.writesToday of $event.payload.ceiling for today. I will slow the optional writers down.' }] },
  { id: 'tpl-webhook-fixed', say: 'webhook wrong → fix once and tell me', owner: 'thor', name: 'Webhook fixed', intent: 'the SYSTEM check re-pointed a Telegram webhook → one line (the fix itself is built in)', trigger: on('councillor.finished', { councillor: 'system' }), deliver: 'silent',
    steps: [{ say: 'SYSTEM check ran.' }] },
  { id: 'tpl-world-note', say: 'Sunday 6 pm → Jane\'s world note', owner: 'thor', name: 'World note (template copy)', intent: 'a second copy of the Sunday world note at 18:00, if the seeded one was deleted', trigger: at('18:00', [0]), deliver: 'telegram',
    steps: [{ read: 'memory', persona: 'thor' }, { delegate: { councillor: 'jane_foster', task: 'From these recent memories, pick the three subjects Rayan clearly cares about most and for each find what changed this week, two sentences each with a source.' } }, { compose: { instruction: 'Write the Sunday world note from step 1 in six sentences at most, plain prose.', tier: 'cheap', batch: true, maxTokens: 400 } }] },
  { id: 'tpl-quarterly', say: 'first of the quarter → architecture re-check', owner: 'thor', name: 'Quarterly re-check (template copy)', intent: 'the first of Mar/Jun/Sep/Dec: one reminder to re-run the architecture review', trigger: { kind: 'schedule', at: '09:00', dayOfMonth: [1], months: [3, 6, 9, 12], tz: TZ }, deliver: 'telegram',
    steps: [{ say: 'Time to re-run the architecture review — models, prices and specs change.' }] },
  { id: 'tpl-paper-drawdown', say: 'paper trading drawdown past 5% → Odin explains, halts new paper positions for the day', owner: 'odin', name: 'Paper drawdown halt', intent: 'the PAPER book\'s realised loss for the day passes 5% of the starting balance → Odin explains and halts new PAPER positions', trigger: on('paper.trade.closed'), deliver: 'telegram',
    steps: [{ tool: 'trading_status', args: {} }, { compose: { instruction: 'Step 0 is the PAPER risk state. If today\'s realised loss is worse than -$500 (5% of the starting balance), explain in two sentences what happened today and say new PAPER positions are halted for the day. Otherwise reply NOTHING.', tier: 'cheap', maxTokens: 160 } }, { tool: 'trading_halt', args: { reason: 'PAPER drawdown past 5% today (template)' } }] }
];
// The templates that need Phase 4's kill switch are hidden from the list until it exists (it does, since Part B).
export function listTemplates() { return TEMPLATES.map(t => ({ id: t.id, say: t.say, owner: t.owner, name: t.name })); }
export function templateById(idOrSay) {
  const q = String(idOrSay || '').trim().toLowerCase();
  return TEMPLATES.find(t => t.id === q) || TEMPLATES.find(t => t.say.toLowerCase() === q) || TEMPLATES.find(t => t.say.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) || null;
}
