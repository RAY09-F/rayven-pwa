// Pure state transitions, executed synchronously inside the ledger Durable Object.
export const PHONE_DEFAULTS={enabled:false,dailyEnabled:true,dailyTime:'18:00',timeZone:'America/Los_Angeles',maxDaily:3,callStart:'11:00',callEnd:'03:00',allUpdates:false,awayOnly:true};
export function localClock(now,timeZone){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second)};
}
export function phoneWindow(config,now=Date.now()){
  const c={...PHONE_DEFAULTS,...config},clock=localClock(now,c.timeZone),minutes=t=>t.split(':').reduce((h,m)=>Number(h)*60+Number(m));
  const start=minutes(c.callStart),end=minutes(c.callEnd),m=clock.minute;
  const allowed=start<end?m>=start&&m<end:m>=start||m<end;
  return {allowed,remainingSeconds:allowed?((end-m+1440)%1440)*60-clock.second:0};
}
export function phoneTransition(state,action,now=Date.now()){
  const s=state||{config:{...PHONE_DEFAULTS},presence:{state:'unknown',expires:0},queue:[],calls:[],day:'',count:0};
  s.config={...PHONE_DEFAULTS,...s.config};
  const c=s.config, clock=localClock(now,c.timeZone);
  s.queue=s.queue.filter(x=>now-x.at<172800000).slice(-200);
  s.calls=s.calls.slice(-60);
  if(s.day!==clock.day){s.day=clock.day;s.count=0;}
  let result;
  switch(action.kind){
    case 'configure': {
      const p=action.config||{}, next={...c};
      for(const key of ['enabled','dailyEnabled','allUpdates','awayOnly'])if(key in p){if(typeof p[key]!=='boolean')throw Error('Expected boolean');next[key]=p[key];}
      if('to' in p){if(!/^\+[1-9]\d{7,14}$/.test(p.to))throw Error('Use an international phone number');next.to=p.to;}
      if('dailyTime' in p){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.dailyTime))throw Error('Invalid daily time');next.dailyTime=p.dailyTime;}
      if('timeZone' in p){localClock(now,p.timeZone);next.timeZone=p.timeZone;}
      for(const key of ['callStart','callEnd'])if(key in p){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[key]))throw Error('Invalid calling hours');next[key]=p[key];}
      if(next.callStart===next.callEnd)throw Error('Calling hours must include a quiet period');
      if('maxDaily' in p){if(p.maxDaily!==null&&(!Number.isInteger(p.maxDaily)||p.maxDaily<1||p.maxDaily>100))throw Error('Daily cap must be 1–100 or null');next.maxDaily=p.maxDaily;}
      if(next.enabled&&!next.to)throw Error('Receiving phone number required');
      s.config=next;result={configured:true};break;
    }
    case 'pair': s.pair={hash:action.hash,expires:now+600000};result={created:true};break;
    case 'redeem':
      if(!s.pair||s.pair.expires<now||s.pair.hash!==action.hash)throw Error('Pairing link expired or used');
      s.ownerHash=action.ownerHash;s.pair=null;result={paired:true};break;
    case 'presence':
      if(!['home','away','unknown'].includes(action.state))throw Error('Invalid presence');
      s.presence={state:action.state,source:action.source==='location'?'location':'manual',at:now,expires:now+(action.source==='location'?1800000:43200000)};
      result=s.presence;break;
    case 'pause': s.config.enabled=false;result={paused:true};break;
    case 'resume': if(!c.to)throw Error('Receiving phone number required');s.config.enabled=true;result={enabled:true};break;
    case 'enqueue': {
      const n=action.item;
      if(!s.config.enabled){result={queued:false,reason:'disabled'};break;}
      if(s.queue.some(x=>x.id===n.id)||s.calls.some(x=>x.event===n.id)){result={queued:false,reason:'duplicate'};break;}
      s.queue.push({...n,at:now});result={queued:true};break;
    }
    case 'inbound': {
      if(!c.to||action.from!==c.to){result={denied:true};break;}
      let call=s.calls.find(x=>x.sid===action.sid);
      if(!call){call={id:action.sid,sid:action.sid,persona:'thor',direction:'inbound',at:now,status:'in-progress',opening:"It's Thor. I'm here, Rayan."};s.calls.push(call);}
      result={call};break;
    }
    case 'reserve': {
      if(!c.enabled||!c.to){result={reason:'disabled'};break;}
      const window=phoneWindow(c,now);
      if(!window.allowed||window.remainingSeconds<=30){result={reason:'quiet_hours'};break;}
      if(c.maxDaily!==null&&s.count>=c.maxDaily){result={reason:'daily_limit'};break;}
      if(s.calls.some(x=>x.direction!=='inbound'&&now-x.at<600000)){result={reason:'cooldown'};break;}
      const [h,m]=c.dailyTime.split(':').map(Number),dailyId='daily:'+clock.day;
      const daily=c.dailyEnabled&&clock.minute>=h*60+m&&clock.minute<h*60+m+60&&!s.calls.some(x=>x.event===dailyId);
      const away=s.presence.state==='away'&&s.presence.expires>now;
      const urgent=(!c.awayOnly||away)?s.queue.find(x=>!x.callId&&(c.allUpdates||['high','critical'].includes(x.priority))&&!s.calls.some(c=>c.event===x.id)):null;
      const item=action.test?{id:'test:'+action.id,persona:action.persona||'thor',title:'Connection test',body:'Your ASGARD phone update connection is ready.'}:urgent||(daily?{id:dailyId,persona:'thor',daily:true}:null);
      if(!item){result={reason:'not_due'};break;}
      let size=0;
      const batch=urgent&&!action.test?s.queue.filter(x=>!x.callId&&x.persona===urgent.persona&&(c.allUpdates||['high','critical'].includes(x.priority))).filter(x=>{const length=String(x.title||'').length+String(x.body||'').length+20;if(size+length>2200)return false;size+=length;return true;}).slice(0,5):[];
      for(const entry of batch)entry.callId=action.id;
      const call={id:action.id,event:item.id,persona:item.persona,at:now,status:'reserved',events:batch.map(x=>x.id)};
      s.calls.push(call);s.count++;result={call,item,to:c.to,config:{...c},batch,updates:s.queue.slice(-12)};break;
    }
    case 'defer': {
      const call=s.calls.find(x=>x.id===action.id);
      if(call){call.status='deferred';call.event='deferred:'+call.id;s.count=Math.max(0,s.count-1);for(const x of s.queue)if(x.callId===call.id)delete x.callId;}
      result={deferred:true};break;
    }
    case 'claimTurn': {
      const call=s.calls.find(x=>x.id===action.id);
      if(!call||!Number.isInteger(action.turn)||action.turn<0||action.turn>(call?.direction==='inbound'?19:7)){result={denied:true};break;}
      call.turns??={};
      if(call.turns[action.turn]){result={cached:call.turns[action.turn].xml||null,busy:!call.turns[action.turn].xml};break;}
      if(action.turn!==Object.keys(call.turns).length){result={denied:true};break;}
      call.turns[action.turn]={pending:true,at:now};result={call};break;
    }
    case 'finishTurn': {
      const call=s.calls.find(x=>x.id===action.id);
      if(call?.turns?.[action.turn]){if(['thor','loki','odin'].includes(action.persona))call.persona=action.persona;call.turns[action.turn]={xml:action.xml,persona:call.persona,timing:action.timing||null};call.transcript=[...(call.transcript||[]),{role:'user',content:action.heard},{role:'assistant',content:action.reply}].slice(-16);}
      result={saved:true};break;
    }
    case 'result': {
      const call=s.calls.find(x=>x.id===action.id);
      if(call){
        const rank={reserved:0,unknown:0,queued:1,initiated:1,ringing:2,'in-progress':3,answered:3,completed:4,busy:4,failed:4,'no-answer':4,canceled:4};
        const incoming={...action.result};
        if((rank[incoming.status]??0)<(rank[call.status]??0))delete incoming.status;
        Object.assign(call,incoming);result={updated:true};
      }else result={updated:false};break;
    }
    case 'status': break;
    default: throw Error('Unknown phone operation');
  }
  return {state:s,result:result??s};
}
export function publicPhoneState(s,now=Date.now()){
  return {config:{...s.config,to:s.config.to?'••••'+s.config.to.slice(-4):null},presence:{...s.presence,state:s.presence.expires>now?s.presence.state:'unknown'},queued:s.queue.length,calls:s.calls.slice(-15).reverse(),todayCount:s.count};
}
