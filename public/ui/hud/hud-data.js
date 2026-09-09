// Only source-backed observations belong in the HUD; design examples never do.
export const UNAVAILABLE = 'Unavailable';
const TIMEOUT = 8000;

export async function fetchSummary(base = '') {
 const started = performance.now();
 try {
  const r = await fetch(`${base}/hud/summary`, {cache:'no-store', signal:AbortSignal.timeout(TIMEOUT)});
  if (!r.ok) throw Error('HTTP ' + r.status);
  const data = await r.json();
  if (!data || !data.realms || !data.sources || !Number.isFinite(Date.parse(data.generated))) throw Error('Invalid summary');
  return {...data, latencyMs:Math.round(performance.now()-started)};
 } catch(error) { return {error:String(error.message || error)}; }
}

export async function fetchHistory(base, realm) {
 try {
  const r = await fetch(`${base}/history?persona=${encodeURIComponent(realm)}`, {cache:'no-store', signal:AbortSignal.timeout(TIMEOUT)});
  if (!r.ok) throw Error('HTTP ' + r.status);
  const data = await r.json();
  if (data.persona !== realm || !Array.isArray(data.turns)) throw Error('Invalid history');
  return {msgs:data.turns.filter(m => ['user','assistant'].includes(m.role) && typeof m.text === 'string').slice(-3).map(m => ({bot:m.role==='assistant',text:m.text}))};
 } catch { return {error:true,msgs:[]}; }
}

export function applySummary(theme, summary) {
 const realm = !summary?.error ? summary?.realms?.[theme.id] : null;
 return {...theme,
  desk:{...theme.desk,
   stats:theme.desk.stats.map((s,i) => ({k:s.k,v:realm?.stats?.[i]?.v == null ? UNAVAILABLE : String(realm.stats[i].v),t:realm?.stats?.[i]?.t || 'flat'})),
   rows:Array.isArray(realm?.rows) ? realm.rows.filter(r => r && r.k != null).slice(0,3).map(r => ({k:String(r.k),v:r.v == null ? UNAVAILABLE : String(r.v),t:r.t || 'flat',asOf:r.asOf})) : [{k:'DATA',v:UNAVAILABLE,t:'flat'}]},
  // Council load, decorative instrument readings and advisor quotes have no
  // measured source. Do not relabel a trading win rate as computational load.
  signal:UNAVAILABLE,
  telemetry:theme.telemetry.map(x => ({k:x.k,v:UNAVAILABLE})),
  tagA:'',tagB:'',msgs:[],counsel:{...theme.counsel,name:'',line:'No advisor response yet.'}
 };
}

export function tickerText(summary) {
 if (!summary || summary.error || summary.sources?.events === false) return 'Events unavailable';
 const events = summary.ticker;
 if (!Array.isArray(events)) return 'Events unavailable';
 if (!events.length) return 'No recent events';
 return events.map(e => String(e).replace(/\s+/g,' ').trim()).filter(Boolean).join(' · ') + ' ·';
}
