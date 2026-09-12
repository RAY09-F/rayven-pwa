// Pure state transitions, executed synchronously inside the ledger Durable Object.
export const PHONE_DEFAULTS={enabled:false,dailyEnabled:true,dailyTime:'18:00',timeZone:'America/Los_Angeles',maxDaily:3};
export function localClock(now,timeZone){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
export function phoneTransition(state,action,now=Date.now()){
  const s=state||{config:{...PHONE_DEFAULTS},presence:{state:'unknown',expires:0},queue:[],calls:[],day:'',count:0};
  const c=s.config, clock=localClock(now,c.timeZone);
  s.queue=s.queue.filter(x=>now-x.at<86400000).slice(-40);
  s.calls=s.calls.slice(-60);
  if(s.day!==clock.day){s.day=clock.day;s.count=0;}
  let result;
  switch(action.kind){
    case 'configure': {
      const p=action.config||{}, next={...c};
      for(const key of ['enabled','dailyEnabled'])if(key in p){if(typeof p[key]!=='boolean')throw Error('Expected boolean');next[key]=p[key];}
      if('to' in p){if(!/^\+[1-9]\d{7,14}$/.test(p.to))throw Error('Use an international phone number');next.to=p.to;}
      if('dailyTime' in p){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.dailyTime))throw Error('Invalid daily time');next.dailyTime=p.dailyTime;}
      if('timeZone' in p){localClock(now,p.timeZone);next.timeZone=p.timeZone;}
      if('maxDaily' in p){if(!Number.isInteger(p.maxDaily)||p.maxDaily<1||p.maxDaily>5)throw Error('Daily cap must be 1–5');next.maxDaily=p.maxDaily;}
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
    case 'reserve': {
      if(!c.enabled||!c.to){result={reason:'disabled'};break;}
      if(s.count>=c.maxDaily){result={reason:'daily_limit'};break;}
      if(s.calls.some(x=>now-x.at<600000)){result={reason:'cooldown'};break;}
      const [h,m]=c.dailyTime.split(':').map(Number),dailyId='daily:'+clock.day;
      const daily=c.dailyEnabled&&clock.minute>=h*60+m&&clock.minute<h*60+m+60&&!s.calls.some(x=>x.event===dailyId);
      const away=s.presence.state==='away'&&s.presence.expires>now;
      const urgent=away?s.queue.find(x=>['high','critical'].includes(x.priority)&&!s.calls.some(c=>c.event===x.id)):null;
      const item=action.test?{id:'test:'+action.id,persona:action.persona||'thor',title:'Connection test',body:'Your ASGARD phone update connection is ready.'}:urgent||(daily?{id:dailyId,persona:'thor',daily:true}:null);
      if(!item){result={reason:'not_due'};break;}
      const call={id:action.id,event:item.id,persona:item.persona,at:now,status:'reserved'};
      s.calls.push(call);s.count++;result={call,item,to:c.to,updates:s.queue.slice(-12)};break;
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
