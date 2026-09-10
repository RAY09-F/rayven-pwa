import {listTodos,listCalendarEventsText} from './kv-store.js';
import {listTimers,weather} from './kit.js';
import {airQuality} from './world.js';
import {spotifyNowPlayingData} from './spotify.js';
import {runCatalogTool} from '../tools/catalog.js';
export const CONTEXT_DEFINITIONS = [
 {name:'util_context',description:'Read one current snapshot of Pacific time, configured home location, Spotify playback, calendar, to-dos and browser extension connection. Partial failures are labeled.',input_schema:{type:'object',properties:{},additionalProperties:false}},
 {name:'plan_today',description:'Read today’s Pacific calendar, open to-dos and existing reminders/timers together.',input_schema:{type:'object',properties:{},additionalProperties:false}},
 {name:'world_here',description:'Read forecast, air quality and California alerts for the configured default home location together. Does not track device location.',input_schema:{type:'object',properties:{},additionalProperties:false}}
];
async function snapshot(tasks) {
 const keys=Object.keys(tasks), results=await Promise.allSettled(keys.map(k=>tasks[k]()));
 return Object.fromEntries(keys.map((key,i)=>[key,results[i].status==='fulfilled'?results[i].value:{unavailable:true,message:'This source did not respond.'}]));
}
function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export async function contextTool(env,name) {
 const day=today();
 if(name==='plan_today')return JSON.stringify(await snapshot({date:()=>day,calendar:()=>listCalendarEventsText(env,day,day),todos:()=>listTodos(env),reminders:()=>listTimers(env)}));
 if(name==='world_here')return JSON.stringify(await snapshot({forecast:()=>weather(env,{place:'Bakersfield',days:1}),air:()=>airQuality(env,{place:'Bakersfield'}),alerts:()=>runCatalogTool(env,'nws_alerts',{area:'CA'})}));
 return JSON.stringify(await snapshot({time:()=>new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'}),timeZone:()=> 'America/Los_Angeles',location:()=>({name:'Bakersfield, California',source:'existing home default; not device GPS'}),music:()=>spotifyNowPlayingData(env),calendar:()=>listCalendarEventsText(env,day,day),todos:()=>listTodos(env),browser:async()=>{const lastPoll=Number(await env.RAYVEN_KV.get('browser:lastpoll'))||null;return {lastPoll,connected:!!lastPoll&&Date.now()-lastPoll<600000};}}));
}
