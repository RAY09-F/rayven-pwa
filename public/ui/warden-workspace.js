import {createCouncilOrbit} from './council-orbit.js';
import {createArsenal} from './arsenal.js';
import {createRequestLedger,formatReply,replyText,parseReplyPayload,requestErrorMessage,restoreDraft,nearTranscriptEnd} from './state.js';
import {readChatReply} from './event-stream.js';

const $=id=>document.getElementById(id),figure=window.ASGARD;
const names={thor:'Thor',loki:'Loki',odin:'Odin'},requests=createRequestLedger();
const rooms=Object.fromEntries(Object.keys(names).map(id=>[id,{messages:[],draft:'',loaded:false,loading:false,error:'',revision:0}]));
let orbit;
let persona=figure.current,arsenal,recognition=null,micStream=null,audioContext=null,analyser=null,levelFrame=0;
let audio=null,audioURL=null,voiceAbort=null,voiceTimer=0,voiceToken=0,micToken=0,listening=false,starting=false,speaking=false,preparing=false;
const saved=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
$('voice-output').checked=saved('asgard:voice-output','1')==='1';
$('still-motion').checked=saved('asgardfx:still','0')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches;
figure.reduced($('still-motion').checked).state('idle').level(0);
function update(){
  const busy=!!requests.get(persona),room=rooms[persona];
  const state=busy?'thinking':listening?'listening':speaking?'speaking':'idle';
  figure.state(state);orbit?.state(state);
  const status=busy?'Working on your request…':starting?'Waiting for microphone permission…':listening?'Listening — finish speaking to send.':preparing?'Preparing spoken reply…':speaking?'Speaking. Press Stop to interrupt.':room.error|| (room.loading?'Loading your conversation…':'Ready. Type a message or turn your mic on.');
  $('connection-status').textContent=status;figure.say(status);
  $('send').disabled=busy;$('stop').hidden=!(busy||listening||starting||speaking||preparing);
  $('mic').disabled=busy;$('mic').classList.toggle('live',listening||starting);
  $('mic').setAttribute('aria-pressed',String(listening||starting));
  $('mic').setAttribute('aria-label',listening||starting?'Turn microphone off':'Turn microphone on to talk to '+names[persona]);
  $('mic').title=listening||starting?'Turn the microphone off; keep any dictated draft':'Turn the microphone on to talk to '+names[persona];
  $('micLabel').textContent=listening?'Mic on':starting?'Connecting…':'Mic off';
}
function render(){
  const tx=$('transcript'),room=rooms[persona],follow=nearTranscriptEnd(tx);tx.replaceChildren();
  if(!room.messages.length){const welcome=document.createElement('div');welcome.className='welcome';const title=document.createElement('h3');title.textContent='What are we working on?';const detail=document.createElement('p');detail.textContent='Talk to '+names[persona]+' here. Your tools, missions and council are all in this workspace.';welcome.append(title,detail);tx.append(welcome);}
  for(const message of room.messages){
    const item=document.createElement('article');item.className='message '+message.role;
    const speaker=document.createElement('div');speaker.className='speaker';speaker.textContent=message.role==='user'?'You':message.role==='error'?'Connection needs attention':names[persona];
    const body=document.createElement('div');formatReply(body,message.text);item.append(speaker,body);
    if(message.role==='assistant'&&!message.pending){const read=document.createElement('button');read.type='button';read.textContent='Read aloud';read.addEventListener('click',()=>speak(message.text,persona));item.append(read);}
    if(message.retry){const retry=document.createElement('button');retry.type='button';retry.textContent='Restore request';retry.addEventListener('click',()=>setDraft(restoreDraft($('message').value,message.retry)));item.append(retry);}
    tx.append(item);
  }
  if(follow)tx.scrollTop=tx.scrollHeight;
}
function setDraft(text){rooms[persona].draft=text;$('message').value=text;$('message').focus();}
async function loadHistory(id){
  const room=rooms[id];if(room.loaded||room.loading)return;
  const revision=room.revision;room.loading=true;if(id===persona)update();
  try{
    const response=await fetch('/history?persona='+id,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('history');const data=await response.json();
    if(!Array.isArray(data.turns))throw Error('history');
    const history=data.turns.filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string').map(m=>({role:m.role,text:m.text}));
    // A history read started before a new turn must never erase that new turn.
    if(room.revision===revision)room.messages=history;
    room.loaded=true;
  }catch{if(!room.error)room.error='Earlier history could not load. You can still send a message.';}
  finally{room.loading=false;if(id===persona){render();update();}}
}
function select(id){
  rooms[persona].draft=$('message').value;stopVoice();stopMic();persona=id;
  $('chat-name').textContent=names[id];$('message').placeholder='Ask '+names[id]+' anything…';$('message').value=rooms[id].draft;
  const url=new URL(location.href);url.searchParams.set('persona',id);url.hash='';history.replaceState(null,'',url);
  document.documentElement.style.setProperty('--acc',id==='loki'?'#adf6c7':id==='odin'?'#e6caff':'#a9dfff');
  arsenal?.switchPersona();orbit?.render();render();update();loadHistory(id);
}
figure.onPersona=select;
arsenal=createArsenal({getPersona:()=>persona,getDraft:()=>$('message').value,setDraft,resetView:()=>{figure.level(0).reduced($('still-motion').checked);update();}});
orbit=createCouncilOrbit({getPersona:()=>persona,openAgent:id=>arsenal.openAgent(id)});
orbit.reduced($('still-motion').checked);
$('message').addEventListener('input',()=>{rooms[persona].draft=$('message').value;});
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}});
$('composer').addEventListener('submit',e=>{e.preventDefault();send();});
async function send(){
  const id=persona,room=rooms[id],text=$('message').value.trim();if(!text||requests.get(id))return;
  stopVoice();stopMic();room.error='';room.revision++;room.draft='';$('message').value='';
  const req=requests.begin(id,text),journal=arsenal.startRequest(id);let outcome='error',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;req.controller.abort();},180000);
  room.messages.push({role:'user',text});const answer={role:'assistant',text:'Working on your request…',pending:true};room.messages.push(answer);render();$('transcript').scrollTop=$('transcript').scrollHeight;update();
  try{
    const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream, application/json'},body:JSON.stringify({persona:id,message:text}),signal:req.controller.signal});
    if(!response.ok)throw Error(requestErrorMessage(response.status,await response.text()));
    let data;
    if((response.headers.get('content-type')||'').includes('text/event-stream')){answer.text='';data=await readChatReply(response,(chunk,reset)=>{answer.text=reset?'':answer.text+chunk;if(id===persona)render();});}
    else data=parseReplyPayload(await response.text(),response.headers.get('content-type')||'');
    if(req.controller.signal.aborted)throw new DOMException('Aborted','AbortError');
    if(data?.error)throw Error(requestErrorMessage(500,JSON.stringify(data)));
    const reply=replyText(data);if(!reply)throw Error('The server returned no readable reply. Please try again.');
    answer.text=reply;answer.pending=false;outcome='complete';
  }catch(error){
    const cancelled=req.controller.signal.aborted;
    outcome=cancelled?'cancelled':'error';answer.role='error';answer.pending=false;answer.retry=text;
    answer.text=cancelled?(timedOut?'The request timed out.':'Stopped waiting.')+' Server work may continue; check results before retrying an action.':error.message||'The reply failed. Please try again.';
    room.error=answer.text;room.draft=restoreDraft(id===persona?$('message').value:room.draft,text);if(id===persona)$('message').value=room.draft;
  }finally{
    clearTimeout(timer);requests.finish(req);arsenal.finishRequest(journal,outcome);
    if(id===persona){render();update();if(outcome==='complete'&&$('voice-output').checked)speak(answer.text,id);}
  }
}
function stopLevels(){cancelAnimationFrame(levelFrame);levelFrame=0;analyser=null;if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}figure.level(0);orbit?.level(0);}
function levels(source,context,output=false){
  audioContext=context;analyser=context.createAnalyser();analyser.fftSize=512;const samples=new Uint8Array(analyser.fftSize);source.connect(analyser);if(output)analyser.connect(context.destination);
  const tick=()=>{if(!analyser)return;analyser.getByteTimeDomainData(samples);let power=0;for(const value of samples)power+=((value-128)/128)**2;const level=Math.min(1,Math.max(0,(Math.sqrt(power/samples.length)-.008)*8));figure.level(level);orbit?.level(level);levelFrame=requestAnimationFrame(tick);};tick();
}
function stopMic(){
  ++micToken;const old=recognition;recognition=null;if(old){old.onresult=old.onend=old.onerror=null;try{old.abort();}catch{}}
  micStream?.getTracks().forEach(t=>t.stop());micStream=null;starting=false;listening=false;stopLevels();update();
}
async function startMic(){
  if(listening||starting){stopMic();return;}if(requests.get(persona))return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){rooms[persona].error='Speech recognition is unavailable in this browser. You can type here, or use Chrome or Edge for the microphone.';update();return;}
  stopVoice();stopMic();const token=++micToken,id=persona,prefix=$('message').value.trim();starting=true;rooms[id].error='';update();
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    if(token!==micToken){stream.getTracks().forEach(t=>t.stop());return;}micStream=stream;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(AC){const context=new AC();audioContext=context;await context.resume();if(token!==micToken){context.close().catch(()=>{});return;}levels(context.createMediaStreamSource(stream),context);}
    const rec=new Recognition();recognition=rec;rec.lang=navigator.language||'en-US';rec.interimResults=true;rec.continuous=false;let finalText='';
    rec.onstart=()=>{if(token!==micToken)return;starting=false;listening=true;update();};
    rec.onresult=event=>{if(token!==micToken)return;let interim='';finalText='';for(const result of event.results){if(result.isFinal)finalText+=result[0].transcript;else interim+=result[0].transcript;}const draft=[prefix,finalText||interim].filter(Boolean).join('\n\n');rooms[id].draft=draft;$('message').value=draft;};
    rec.onerror=event=>{if(token!==micToken)return;rooms[id].error=event.error==='not-allowed'?'Microphone or speech permission was denied. Allow it in browser settings, or type your message.':'Speech recognition stopped ('+event.error+'). Your draft is kept.';stopMic();};
    rec.onend=()=>{if(token!==micToken)return;const shouldSend=!!finalText.trim();stopMic();if(shouldSend&&persona===id)send();};
    stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(token===micToken)stopMic();}));rec.start();
  }catch{if(token===micToken){rooms[id].error='Could not start the microphone. Check browser permission and your audio device.';stopMic();}}
}
$('mic').addEventListener('click',startMic);
function stopVoice(){
  ++voiceToken;clearTimeout(voiceTimer);voiceAbort?.abort();voiceAbort=null;
  if(audio){audio.onended=audio.onerror=audio.onplaying=null;audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
  if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}window.speechSynthesis?.cancel();speaking=false;preparing=false;stopLevels();update();
}
async function speak(text,id){
  stopMic();stopVoice();const token=++voiceToken;preparing=true;update();voiceAbort=new AbortController();
  voiceTimer=setTimeout(()=>voiceAbort?.abort(),20000);
  const current=()=>token===voiceToken&&persona===id;
  let fallbackStarted=false;
  function browserVoice(){
    if(!current()||fallbackStarted)return;fallbackStarted=true;
    if(audio){audio.onended=audio.onerror=audio.onplaying=null;audio.pause();audio=null;}
    if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}
    if(!window.speechSynthesis){rooms[id].error='Audio is unavailable. Your complete reply is in the conversation.';stopVoice();return;}
    preparing=false;const utterance=new SpeechSynthesisUtterance(text);utterance.lang=navigator.language||'en-US';
    rooms[id].error='Using your browser’s voice; the configured voice could not play.';
    utterance.onstart=()=>{if(current()){speaking=true;update();}};
    // Browser synthesis exposes playback events, but no audio samples. State glow only.
    utterance.onend=()=>{if(current())stopVoice();};utterance.onerror=()=>{if(current()){rooms[id].error='Voice playback was unavailable. Your text reply is ready.';stopVoice();}};
    update();window.speechSynthesis.speak(utterance);voiceTimer=setTimeout(()=>{if(current())stopVoice();},180000);
  }
  try{
    const response=await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({persona:id,text}),signal:voiceAbort.signal});
    if(!response.ok||!(response.headers.get('content-type')||'').startsWith('audio/'))throw Error('voice');
    const blob=await response.blob();clearTimeout(voiceTimer);if(!current())return;
    audioURL=URL.createObjectURL(blob);audio=new Audio(audioURL);
    const AC=window.AudioContext||window.webkitAudioContext;if(AC){const context=new AC();audioContext=context;let resumeTimer;try{await Promise.race([context.resume(),new Promise((_,reject)=>{resumeTimer=setTimeout(()=>reject(Error('Playback needs a gesture')),2000);})]);}finally{clearTimeout(resumeTimer);}if(!current()){context.close().catch(()=>{});return;}levels(context.createMediaElementSource(audio),context,true);}
    audio.onplaying=()=>{if(current()){preparing=false;speaking=true;update();}};
    audio.onended=()=>{if(current())stopVoice();};audio.onerror=()=>{if(current()){const keep=token;stopLevels();audio?.pause();if(keep===voiceToken)browserVoice();}};
    await audio.play();voiceTimer=setTimeout(()=>{if(current())stopVoice();},300000);
  }catch{clearTimeout(voiceTimer);if(current()){stopLevels();browserVoice();}}
}
$('stop').addEventListener('click',()=>{requests.get(persona)?.controller.abort();stopMic();stopVoice();});
$('settings').addEventListener('click',()=>$('settings-dialog').showModal());
$('voice-output').addEventListener('change',()=>{save('asgard:voice-output',$('voice-output').checked?'1':'0');if(!$('voice-output').checked)stopVoice();});
$('still-motion').addEventListener('change',()=>{save('asgardfx:still',$('still-motion').checked?'1':'0');figure.reduced($('still-motion').checked);orbit?.reduced($('still-motion').checked);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopVoice();}});
window.addEventListener('pagehide',()=>{stopMic();stopVoice();for(const id of Object.keys(names))requests.get(id)?.controller.abort();});
select(persona);
const panel=new URLSearchParams(location.search).get('panel');
if(panel==='tools')document.querySelector('[data-open-arsenal]').click();
if(panel==='council')document.querySelector('.council-strip').open=true;
if(panel==='settings'||new URLSearchParams(location.search).get('settings')==='1')$('settings-dialog').showModal();
