export const personas=['thor','loki','odin'];
export function initialPersona(search,hash){
  const p=new URLSearchParams(search);
  return [p.get('persona'),p.get('hall'),hash.replace(/^#/,'')].find(x=>personas.includes(x))||'thor';
}
export function editableTarget(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');}
export function readPreferences(storage){
  const get=k=>{try{return storage.getItem(k);}catch{return null;}};
  return {still:get('asgardfx:still')==='1',output:get('asgard:voice-output')!=='0',quality:get('asgard:render-quality')==='high'?'high':'balanced'};
}
export function assistantState({busy=false,error=false,speaking=false,preparing=false,cancelled=false,mic='off'}={}){
  if(busy)return {id:'thinking',label:'Thinking',detail:'Working on your message.'};
  if(error)return {id:'error',label:'Needs attention',detail:'See the message in conversation.'};
  if(speaking)return {id:'speaking',label:'Speaking',detail:'Playing the spoken response.'};
  if(preparing)return {id:'connecting',label:'Preparing voice',detail:'Your text reply is ready.'};
  if(mic==='pending')return {id:'connecting',label:'Starting microphone',detail:'Waiting for the browser.'};
  if(mic==='listening')return {id:'listening',label:'Listening',detail:'You can speak now.'};
  if(mic==='wake')return {id:'listening',label:'Listening for your call',detail:'Say “Hey Thor”, “Hey Loki”, or “Hey Odin”.'};
  if(cancelled)return {id:'cancelled',label:'Stopped waiting',detail:'Server work may continue. Check results before retrying an action.'};
  return {id:'idle',label:'Ready when you are',detail:'Type a message or start listening.'};
}

// Request identity is independent of the selected persona and survives UI switches.
export function createRequestLedger(){
  const active=new Map();let serial=0;
  return {
    begin(hall,text){if(!personas.includes(hall)||active.has(hall))return null;const request={id:++serial,hall,text,controller:new AbortController(),started:Date.now()};active.set(hall,request);return request;},
    current:request=>active.get(request.hall)===request,
    get:hall=>active.get(hall),
    finish(request){if(active.get(request.hall)!==request)return false;active.delete(request.hall);return true;}
  };
}
export function replyText(data){
  if(typeof data==='string')return data.trim()?data:null;
  if(!data||typeof data!=='object')return null;
  return [data.reply,data.response,data.text,data.message,data.content,data.output,data.data?.reply,data.data?.text].find(value=>typeof value==='string'&&value.trim())??null;
}
export function restoreDraft(draft,failed){return draft.trim()?draft+(draft===failed||draft.endsWith('\n\n'+failed)?'':'\n\n'+failed):failed;}
export function parseReplyPayload(raw,contentType=''){
  if(contentType.toLowerCase().includes('text/html'))throw Error('The assistant returned a page instead of a reply.');
  try{return JSON.parse(raw);}catch{if(contentType.toLowerCase().includes('json'))throw Error('The response could not be read.');return raw;}
}
// Only classify bounded provider text. Never return provider-controlled wording to the UI.
export function requestErrorMessage(status,raw){
  let data=null;
  if(typeof raw==='string'&&raw.length<=16384){try{data=JSON.parse(raw);}catch{data=raw;}}
  const detail=(typeof data==='string'?data:typeof data?.error==='string'?data.error:'').slice(0,1024).toLowerCase();
  if(/credit balance is too low|insufficient credits|not enough credits/.test(detail))return 'The assistant’s provider account is out of credits. The account owner needs to add credits before replies can resume.';
  if(status===429||/rate.limit|too many requests/.test(detail))return 'The assistant is receiving too many requests. Wait a moment, then try again.';
  if(status===401||status===403||/invalid.api.key|authentication.error|authentication failed/.test(detail))return 'The assistant’s API connection was rejected. The account owner needs to check its credentials or permissions.';
  if([502,503,504].includes(status)||/service unavailable|overloaded_error/.test(detail))return 'The assistant service is temporarily unavailable. Try again shortly.';
  return 'The assistant couldn’t reply'+(Number.isInteger(status)&&status>=400&&status<=599?' ('+status+')':'')+'. Try again later.';
}
export function nearTranscriptEnd(tx){return tx.scrollHeight-tx.scrollTop-tx.clientHeight<=80;}

// Deliberately small Markdown subset. Model strings only reach text nodes; links require HTTP(S).
export function formatReply(container,text,doc=container.ownerDocument){
  container.replaceChildren();
  function inline(parent,value){
    const re=/(`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*)/g;let at=0,match;
    while((match=re.exec(value))){
      parent.append(doc.createTextNode(value.slice(at,match.index)));
      const node=doc.createElement(match[0][0]==='`'?'code':match[4]?'strong':'a');
      if(node.tagName==='A'){
        try{const url=new URL(match[3]);if(!['http:','https:'].includes(url.protocol))throw Error();node.href=url.href;node.target='_blank';node.rel='noopener noreferrer';node.textContent=match[2];}
        catch{parent.append(doc.createTextNode(match[0]));at=re.lastIndex;continue;}
      }else node.textContent=match[4]||match[0].slice(1,-1);
      parent.append(node);at=re.lastIndex;
    }
    parent.append(doc.createTextNode(value.slice(at)));
  }
  let code=null,codeLines=[],list=null;
  const flushCode=()=>{code.textContent=codeLines.join('\n');code=null;codeLines=[];};
  for(const line of String(text).split('\n')){
    if(/^\s*```/.test(line)){
      if(code)flushCode();else{list=null;const pre=doc.createElement('pre');code=doc.createElement('code');pre.append(code);container.append(pre);}continue;
    }
    if(code){codeLines.push(line);continue;}
    const item=line.match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.*)$/);
    if(item){const type=item[2]?'OL':'UL';if(list?.tagName!==type){list=doc.createElement(type.toLowerCase());if(item[2])list.start=Number(item[2]);container.append(list);}const li=doc.createElement('li');inline(li,item[3]);list.append(li);}
    else{list=null;if(!line.trim())continue;const paragraph=doc.createElement('p');inline(paragraph,line);container.append(paragraph);}
  }
  if(code)flushCode();
}
