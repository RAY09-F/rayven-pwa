// Read-only HUD snapshots. Missing sources are explicit, never substituted with
// an unrelated metric (routines are not meetings; todos are not plan milestones).
import {getPaperStatus} from './paperTrading.js';
import {getActivityLog} from './activity.js';
import {readRecentTicks} from './tick.js';
const safe=async fn=>{try{return await fn();}catch{return null;}};
const readArray=async(env,key)=>{const raw=await env.RAYVEN_KV.get(key);const rows=raw?JSON.parse(raw):[];if(!Array.isArray(rows))throw Error('Invalid '+key);return rows;};
const money=n=>(n<0?'-':'+')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');
const tone=n=>n>0?'up':n<0?'down':'flat';
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hour12:false});
const localDate=n=>dateFormat.format(new Date(n));
async function odinDesk(env,paper){
 if(!paper)return null;
 const open=Object.entries(paper.openPositions||{}),today=paper.today||{},all=paper.allTime||{};
 const rate=today.winRatePct??all.winRatePct;
 const rows=await Promise.all(open.slice(0,3).map(async([id,p])=>{
  const candles=await safe(()=>readArray(env,'paper:candles:'+id));
  const last=candles?.at(-1),mark=Number(last?.close),entry=Number(p.entryPrice),qty=Number(p.qty);
  const explicit=p.unrealizedPnl;
  const pnl=Number.isFinite(explicit)?explicit:Number.isFinite(mark)&&Number.isFinite(entry)&&Number.isFinite(qty)?(mark-entry)*qty*(p.side==='short'?-1:1):null;
  const instrument=String(p.symbol||p.label||id).split(' — ')[0].toUpperCase(),name=p.name?` · ${p.name.toUpperCase()}`:'';
  return {k:`${instrument} ${String(p.side||'LONG').toUpperCase()}${name}`,v:pnl==null?null:money(pnl),t:pnl==null?'flat':tone(pnl),asOf:last?.time??null};
 }));
 return {stats:[{v:String(open.length)},{v:String(today.trades??0)},today.wins!=null&&today.losses!=null?{v:`${today.wins} / ${today.losses}`,t:'flat'}:null,Number.isFinite(all.pnl)?{v:money(all.pnl),t:tone(all.pnl)}:null],rows,signal:rate==null?null:`WIN RATE ${Math.round(rate)}%`,source:'paper-trading'};
}
function lokiDesk(events,timers,now){
 if(!events&&!timers)return null;
 const today=localDate(now),meetings=events?.filter(e=>e.date===today),due=timers?.filter(t=>Number.isFinite(Number(t.dueAt))&&localDate(Number(t.dueAt))===today);
 const rows=[];
 for(const e of (meetings||[]).slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''))))rows.push({k:`${e.time||''}${e.time?' · ':''}${String(e.title||'').toUpperCase()}`,v:Number.isFinite(e.durationMinutes)?`${e.durationMinutes}M`:null,t:'flat'});
 for(const t of (timers||[]).slice().sort((a,b)=>a.dueAt-b.dueAt))rows.push({k:`REMIND · ${String(t.label||'').toUpperCase()}`,v:Number.isFinite(Number(t.dueAt))?timeFormat.format(new Date(Number(t.dueAt))):null,t:Number(t.dueAt)<=now?'down':'flat'});
 return {stats:[meetings?{v:String(meetings.length)}:null,timers?{v:String(timers.length)}:null,due?{v:String(due.length),t:due.length?'down':'up'}:null,null],rows:rows.slice(0,3),signal:due?`${due.length} DUE TODAY`:null,source:'calendar-and-timers'};
}
function ticker(activity,ticks){
 const events=[];
 for(const tick of ticks||[])for(const e of tick.events||[])events.push({at:e.ts||Date.parse(e.at)||0,text:e.event||e.kind||''});
 for(const e of activity||[])events.push({at:Date.parse(e.time)||0,text:[e.subsystem,e.action||e.decided||e.observed].filter(Boolean).join(' ')});
 return [...new Set(events.sort((a,b)=>b.at-a.at).map(e=>e.text.replace(/\s+/g,' ').trim()).filter(Boolean))].slice(0,8);
}
async function readPaper(env){
 // The generic log reader masks read failures as an empty log. Validate the
 // trades read first so an unavailable history never becomes a zero P/L.
 const trades=await readArray(env,'paper:trades');
 const snapshotEnv={...env,RAYVEN_KV:{get:(key,...args)=>key==='paper:trades'?Promise.resolve(JSON.stringify(trades)):env.RAYVEN_KV.get(key,...args)}};
 return getPaperStatus(snapshotEnv);
}
export async function getHudSummary(env,{now=Date.now()}={}){
 const [paper,events,timers,activity,ticks]=await Promise.all([safe(()=>readPaper(env)),safe(()=>readArray(env,'calendar:events')),safe(()=>readArray(env,'kit:timers')),safe(()=>getActivityLog(env)),safe(()=>readRecentTicks(env,1))]);
 const realms={},odin=await odinDesk(env,paper),loki=lokiDesk(events,timers,now);
 if(odin)realms.odin=odin;if(loki)realms.loki=loki;
 // There is no plan/milestone tracker in this repository. Do not invent one
 // from todos, scheduled routines or clipping campaigns.
 return {generated:new Date(now).toISOString(),label:'PAPER / SIMULATED — no real money',realms,ticker:ticker(activity,ticks),sources:{paper:!!paper,calendar:!!events,reminders:!!timers,plans:false,events:!!activity||!!ticks}};
}
