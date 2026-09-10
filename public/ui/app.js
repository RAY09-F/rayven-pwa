import {VoiceClient} from './voice-stream.js?v=brain-wave6';
import {readChatReply} from './event-stream.js?v=brain-wave1';
import {createArsenal} from './arsenal.js?v=floating-realms-3';
import {initialPersona,editableTarget,readPreferences,assistantState,createRequestLedger,replyText,restoreDraft,nearTranscriptEnd,formatReply,parseReplyPayload,requestErrorMessage} from './state.js?v=floating-realms-3';
import {createPresence} from './scene.js?v=floating-realms-3';
const halls=['thor','loki','odin'];
let storage;try{storage=window.localStorage;}catch{}
let arsenal=null,liveVoice=null;
fetch('https://asgrard-backend.rayanfahil2.workers.dev/voice/config').then(r=>r.ok?r.json():{}).then(config=>{if(config.enabled)liveVoice=new VoiceClient('https://asgrard-backend.rayanfahil2.workers.dev',phase=>{speechPhase=phase;refreshState();if(phase==='idle')resumeListeningAfterSpeech();});}).catch(()=>{});
let preferences=readPreferences(storage),presence=null,speechPhase='idle',micState='off';
const requests=createRequestLedger(),cancelled={},scrollFollow={},controls={};
const errors={},workspace=document.querySelector('.workspace'),dialog=document.getElementById('settings-dialog');
const profile={thor:['The Astral Cartographer','Map the next step.','Thor’s modeled hammer, bronze armillary and five advisor gems'],loki:['The Bifrost Prism Foundry','Give possibility a shape.','Loki’s gold faceted crystal, emerald foundry and five advisor gems'],odin:['The Solar Throne','A clearer view of what comes next.','Odin’s gold solar disc, marble pedestal and five advisor eyes']};
function persist(k,v){try{localStorage.setItem(k,v);}catch{}}
function refreshState(){
  const hall=activeHall();
  const next=assistantState({busy:busy?.[hall],error:errors[hall],cancelled:cancelled[hall],speaking:speechPhase==='speaking',preparing:speechPhase==='preparing',mic:micState});
  document.getElementById('assistant-status').textContent=next.label;document.getElementById('assistant-detail').textContent=next.detail;
  workspace.dataset.state=next.id;document.documentElement.dataset.assistantState=next.id;document.documentElement.dataset.micState=micState;document.documentElement.dataset.speechState=speechPhase;presence?.setState(next.id);
  document.querySelectorAll('.mic-btn').forEach(b=>{b.setAttribute('aria-pressed',voiceActive?'true':'false');b.querySelector('span').textContent=!voiceActive?'Start listening':micState==='pending'?'Cancel microphone':micState==='off'?'Turn microphone off':'Stop listening';});
  document.querySelectorAll('.stop-speech').forEach(b=>{b.hidden=speechPhase==='idle';b.textContent=speechPhase==='preparing'?'Cancel voice playback':'Stop speaking';});
}
function show(id){
  if(!halls.includes(id))return;
  if(id!==activeHall()){stopSpeaking();killRecognition();}
  document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('active',s.id==='hall-'+id));
  document.querySelectorAll('.persona').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.go===id)));
  document.documentElement.dataset.persona=id;
  document.getElementById('presence-name').innerHTML=id[0].toUpperCase()+id.slice(1)+'<span class="name-period">.</span>';
  document.getElementById('realm-name').textContent=profile[id][0].toUpperCase();document.getElementById('presence-role').textContent=profile[id][1];document.getElementById('presence-scene').setAttribute('aria-label',profile[id][2]);document.getElementById('conversation-name').textContent=id[0].toUpperCase()+id.slice(1);
  try{const url=new URL(location.href);url.searchParams.delete('persona');url.searchParams.delete('hall');url.hash=id;history.replaceState(null,'',url);}catch{}
  if(presence?.status().persona!==id)presence?.setPersona(id);arsenal?.switchPersona();refreshState();requestAnimationFrame(()=>updateTranscript(id));
}
  /* ==================== LIVE BACKEND ==================== */
  /* If chat says "couldn't reach", the shape below is what needs correcting. */
  var API = {
    base: 'https://asgrard-backend.rayanfahil2.workers.dev',
    chat: '/',
    body: function(hall, text){ return { assistant: hall, message: text }; },
    reply: replyText
  };

  var busy = {};

  function el(tag, cls, txt){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function gemFor(hall){
    if (hall === 'loki') return '<svg width="15" height="15" viewBox="0 0 24 24" fill="#7FE9C0"><path d="M12 2l6 10-6 10-6-10z"/></svg>';
    if (hall === 'odin') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F3E4C0" stroke-width="1.6"><path d="M12 3l9 17H3z"/></svg>';
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v7H6z"/><rect x="10.7" y="11" width="2.6" height="10" rx="1"/></svg>';
  }

  function addMsg(hall, who, text){
    var tx = document.getElementById('tx-' + hall);
    var row = el('div', 'msg ' + (who === 'user' ? 'user' : 'bot'));
    if (who === 'user') {
      row.appendChild(el('div', 'bubble', text));
    } else {
      var av = el('div', 'avatar'); av.innerHTML = gemFor(hall);
      row.appendChild(av);
      var wrap = el('div');
      if (hall !== 'thor') {
        var lab = el('div', 'mini-label', hall.toUpperCase());
        wrap.appendChild(lab);
      }
      var b = el('div', 'bubble');
      if (text === null) { b.textContent='Thinking…'; b.classList.add('pending-label'); }
      else { b.textContent = text; }
      wrap.appendChild(b);
      row.appendChild(wrap);
    }
    const nearBottom = scrollFollow[hall]!==false;
    tx.querySelector('.empty-state')?.remove();
    tx.appendChild(row);
    updateTranscript(hall,nearBottom);
    return row;
  }

  function updateTranscript(hall,follow=scrollFollow[hall]!==false){
    const tx=document.getElementById('tx-'+hall);
    if(follow){tx.scrollTop=tx.scrollHeight;scrollFollow[hall]=true;}
    if(controls[hall])controls[hall].latest.hidden=follow||nearTranscriptEnd(tx);
  }
  function recoverMessage(hall,text){
    const input=document.getElementById('in-'+hall);input.value=restoreDraft(input.value,text);input.focus();
  }
  function addErr(hall,msg,failedText){
    const tx=document.getElementById('tx-'+hall),follow=scrollFollow[hall]!==false;
    const notice=el('div','errline',msg);notice.setAttribute('role','alert');
    if(failedText){const retry=el('button','','Restore / add message to draft');retry.type='button';retry.onclick=()=>{recoverMessage(hall,failedText);retry.disabled=true;retry.textContent='Added to draft';};notice.append(retry);}
    tx.append(notice);errors[hall]=true;refreshState();updateTranscript(hall,follow);
  }
  function finishRequest(request,outcome){
    if(!requests.finish(request))return;
    const hall=request.hall;clearTimeout(request.timeout);busy[hall]=false;
    const stage=document.getElementById('hall-'+hall);stage.classList.remove('thinking');stage.querySelectorAll('.sendbtn').forEach(b=>b.disabled=false);
    controls[hall].cancel.hidden=true;arsenal?.finishRequest(request.activityId,outcome);refreshState();
    if(hall===activeHall())resumeListeningAfterSpeech();
  }
  function cancelRequest(hall){
    const request=requests.get(hall);if(!request)return;
    request.controller.abort();request.pending.remove();cancelled[hall]=true;
    const notice=el('div','request-notice','Stopped waiting in this browser. Server work may continue; check results before retrying an action.');notice.setAttribute('role','status');
    const restore=el('button','','Restore / add message to draft');restore.type='button';restore.onclick=()=>{recoverMessage(hall,request.text);restore.disabled=true;restore.textContent='Added to draft';};notice.append(restore);
    document.getElementById('tx-'+hall).append(notice);finishRequest(request,'cancelled');updateTranscript(hall);
    if(hall===activeHall())document.getElementById('in-'+hall).focus({preventScroll:true});
  }
  function responseActions(row,reply,request){
    const actions=el('div','response-actions'),copy=el('button','copy-response','Copy reply');copy.type='button';
    const receipt=el('small','request-receipt',request.hall[0].toUpperCase()+request.hall.slice(1)+' · Reply received · '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(reply);copy.textContent='Copied';}catch{copy.textContent='Copy unavailable';}});
    actions.append(copy,receipt);row.lastElementChild.append(actions);
  }
  async function send(hall){
    if(busy[hall])return;
    const input=document.getElementById('in-'+hall),text=(input.value||'').trim();if(!text)return;
    if(vaultIntercept(text)){input.value='';return;}
    const request=requests.begin(hall,text);if(!request)return;
    errors[hall]=false;cancelled[hall]=false;busy[hall]=true;request.activityId=arsenal?.startRequest(hall);
    listeningPaused=true;killRecognition();stopSpeaking();refreshState();input.value='';
    const stage=document.getElementById('hall-'+hall);stage.classList.add('thinking');stage.querySelectorAll('.sendbtn').forEach(b=>b.disabled=true);controls[hall].cancel.hidden=false;
    addMsg(hall,'user',text);request.pending=addMsg(hall,'bot',null);
    // Keep keyboard continuity without stealing focus back when a late reply arrives.
    if(hall===activeHall()&&!document.querySelector('dialog[open]'))input.focus({preventScroll:true});
    request.timeout=setTimeout(()=>{request.timedOut=true;request.controller.abort();},60000);
    let outcome='failed';
    try{
      let partial='';
      const onText=(text,reset)=>{
        if(!requests.current(request))return;
        partial=reset?'':partial+text;
        const bubble=request.pending.querySelector('.bubble');bubble.classList.remove('pending-label');bubble.textContent=partial;
        updateTranscript(hall,scrollFollow[hall]!==false);
      };
      let data;
      if(liveVoice&&voiceActive&&preferences.output){
        data=await liveVoice.turn(hall,text,{signal:request.controller.signal,onText});
      }else{
        const res=await fetch(API.base+API.chat,{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify(API.body(hall,text)),signal:request.controller.signal});
        if(!res.ok)throw new Error(requestErrorMessage(res.status,await res.text()));
        data=(res.headers.get('content-type')||'').includes('text/event-stream') ? await readChatReply(res,onText) : parseReplyPayload(await res.text(),res.headers.get('content-type')||'');
      }
      if(!requests.current(request))return;
      const reply=API.reply(data);if(!reply)throw new Error('The response could not be read.');
      const follow=scrollFollow[hall]!==false,bubble=request.pending.querySelector('.bubble');bubble.classList.remove('pending-label');formatReply(bubble,reply);responseActions(request.pending,reply,request);updateTranscript(hall,follow);outcome='received';
      if(hall===activeHall()&&!data.voiced)speak(hall,reply,resumeListeningAfterSpeech);
    }catch(err){
      if(!requests.current(request))return;
      request.pending.remove();
      const message=request.timedOut?'The reply timed out. Server work may continue; check results before retrying an action.':err instanceof TypeError?'Couldn’t reach the assistant. Check your connection. Server work is unconfirmed.':err.message||'The reply failed.';
      addErr(hall,message+' Your message can be restored to the draft.',text);
    }finally{finishRequest(request,outcome);}
  }

  ['thor','loki','odin'].forEach(function(hall){
    var input = document.getElementById('in-' + hall);
    var stage = document.getElementById('hall-' + hall);
    if (!input || !stage) return;
    const bar=el('div','conversation-controls'),cancel=el('button','cancel-reply','Stop waiting'),latest=el('button','latest-reply','Latest message ↓');
    cancel.type=latest.type='button';cancel.hidden=latest.hidden=true;cancel.title='Stops waiting in this browser; server work may continue.';
    cancel.addEventListener('click',()=>cancelRequest(hall));latest.addEventListener('click',()=>{updateTranscript(hall,true);document.getElementById('tx-'+hall).focus({preventScroll:true});});
    bar.append(cancel,latest);stage.querySelector('.composer').before(bar);controls[hall]={cancel,latest};scrollFollow[hall]=true;
    const tx=document.getElementById('tx-'+hall);tx.addEventListener('scroll',()=>{if(hall!==activeHall()||document.querySelector('.conversation').hidden)return;scrollFollow[hall]=nearTranscriptEnd(tx);latest.hidden=scrollFollow[hall];},{passive:true});
    input.addEventListener('input',()=>{if(cancelled[hall]||errors[hall]){cancelled[hall]=false;errors[hall]=false;refreshState();}});
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(hall); }
    });
    stage.querySelectorAll('.sendbtn').forEach(function(b){
      b.addEventListener('click', function(){ send(hall); });
    });
  });

  /* ==================== VOICE — ported from the old hall ==================== */
  /* 1. TTS playback of replies. ElevenLabs through the Worker's /tts, in the
     persona's own voice; the browser's built-in voice if that fails. speak()
     replaces whatever is playing, so a new reply or a new message always cuts
     the old one off. */
  var ttsAudio = null, ttsUtter = null, ttsOnDone = null, ttsToken = 0, ttsGuard = null;

  /* Punctuation paces a voice, so it stays. What goes is the stuff that is
     silent on the page but reads as noise out loud: markdown, emoji, bare URLs. */
  function speakableText(raw){
    return String(raw || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'the link')
      .replace(/^\s*[#>]+\s*/gm, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, '$1$2')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  function stopSpeaking(){
    liveVoice?.interrupt();
    ttsToken++;speechPhase='idle';refreshState();
    if (ttsGuard) { clearTimeout(ttsGuard); ttsGuard = null; }
    if (ttsAudio) {
      var a = ttsAudio; ttsAudio = null;
      try { a.onended = null; a.onerror = null; a.onplaying = null; a.pause(); } catch(e){}
      try { if (a._url) URL.revokeObjectURL(a._url); } catch(e){}
    }
    if (ttsUtter) { ttsUtter.onstart=null;ttsUtter.onend=null;ttsUtter.onerror=null;ttsUtter = null; try { speechSynthesis.cancel(); } catch(e){} }
    ttsOnDone = null;
  }

  function speak(hall, text, onDone){
    var cleaned = speakableText(text);
    stopSpeaking();
    if (!cleaned||!preferences.output||document.hidden) { if (onDone) onDone(); return; }
    listeningPaused=true;killRecognition();speechPhase='preparing';refreshState();
    var token = ttsToken;
    ttsOnDone = onDone || null;
    var finished = false;
    function finish(){
      if (finished || token !== ttsToken) return;
      finished = true;
      if (ttsGuard) { clearTimeout(ttsGuard); ttsGuard = null; }
      if(ttsAudio){ttsAudio.onended=null;ttsAudio.onerror=null;ttsAudio.onplaying=null;try{ttsAudio.pause();}catch{}if(ttsAudio._url)URL.revokeObjectURL(ttsAudio._url);}
      if(ttsUtter){ttsUtter.onstart=null;ttsUtter.onend=null;ttsUtter.onerror=null;try{speechSynthesis.cancel();}catch{}}
      ttsAudio = null; ttsUtter = null;speechPhase='idle';refreshState();
      var cb = ttsOnDone; ttsOnDone = null;
      if (cb) cb();
    }
    function browserVoice(){
      if (token !== ttsToken) return;
      if (!('speechSynthesis' in window)) { finish(); return; }
      var u = new SpeechSynthesisUtterance(cleaned);
      u.onstart=()=>{if(token===ttsToken){speechPhase='speaking';refreshState();}};
      u.onend = finish; u.onerror = finish;
      ttsUtter = u;
      ttsGuard = setTimeout(finish, 8000 + cleaned.length * 90);   /* a voice that never reports back must not strand the mic */
      try { speechSynthesis.speak(u); } catch(e){ finish(); }
    }
    fetch(API.base + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned, persona: hall }),signal:AbortSignal.timeout(15000)
    })
      .then(function(res){ if (!res.ok) throw new Error('TTS status ' + res.status); return res.blob(); })
      .then(function(blob){
        if (token !== ttsToken) return;
        var url = URL.createObjectURL(blob);
        var a = new Audio(url); a._url = url;
        a.onended = function(){ try { URL.revokeObjectURL(url); } catch(e){} finish(); };
        let fallbackStarted=false;
        function fallback(){if(token!==ttsToken||fallbackStarted)return;fallbackStarted=true;a.onended=null;a.onerror=null;a.onplaying=null;try{a.pause();URL.revokeObjectURL(url);}catch{}if(ttsGuard){clearTimeout(ttsGuard);ttsGuard=null;}ttsAudio=null;speechPhase='preparing';refreshState();browserVoice();}
        a.onerror = fallback;
        a.onplaying = function(){
          if(token===ttsToken){speechPhase='speaking';refreshState();}
          if (token !== ttsToken) return;
          if (ttsGuard) clearTimeout(ttsGuard);
          ttsGuard = setTimeout(finish, ((isFinite(a.duration) && a.duration) || 30) * 1000 + 3000);
        };
        ttsAudio = a;
        var p = a.play();
        if (p && p.catch) p.catch(function(err){
          if (token !== ttsToken) return;
          console.warn('Audio playback refused, browser voice fallback:', err);
          fallback();
        });
      })
      .catch(function(err){ if (token !== ttsToken) return; console.warn('TTS failed, browser voice fallback:', err); browserVoice(); });
  }

  /* 2. Microphone. The Thor hall's mic button turns voice on and off. Chrome
     allows exactly one live SpeechRecognition per page and stop() is
     asynchronous, so every start goes through beginRecognition(), which aborts
     the old instance and retries the new one until it takes. While a reply is
     being spoken the mic is paused, so the voice never hears itself. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var voiceActive = false, awake = false, listeningPaused = false, liveRec = null;
  var STOP_PHRASES = ['stop talking', 'shut up', 'be quiet', 'quiet', 'stop it', 'hush', 'silence', 'stop'];

  function activeHall(){ var st = document.querySelector('.stage.active'); return st ? st.id.replace('hall-', '') : 'thor'; }
  function matchesAny(transcript, list){
    var c = String(transcript || '').toLowerCase().trim();
    return list.some(function(p){ return c.indexOf(p) >= 0; });
  }

  function killRecognition(){
    var r = liveRec; liveRec = null;micState='off';refreshState();
    if (!r) return;
    try { r.onstart = null; r.onend = null; r.onerror = null; r.onresult = null; } catch(e){}
    try { r.abort ? r.abort() : r.stop(); } catch(e){}
  }
  function beginRecognition(rec){
    killRecognition();
    liveRec = rec;micState='pending';refreshState();
    rec.onstart=()=>{if(liveRec===rec){micState=awake?'listening':'wake';refreshState();}};
    var tries = 0;
    (function attempt(){
      if (liveRec !== rec) return;
      try { rec.start(); }
      catch(e){ if (++tries <= 10) setTimeout(attempt, 150); else {voiceOff();addErr(activeHall(),'Microphone could not start. You can keep typing.');} }
    })();
  }
  /* a refused microphone must not spin the restart loop forever */
  function micRefused(ev){
    if (!ev || !['not-allowed','service-not-allowed','audio-capture','network'].includes(ev.error)) return false;
    voiceOff();
    const message=ev.error==='network'?'Voice input could not connect. You can keep typing and try again later.':ev.error==='audio-capture'?'No working microphone was found. Check your input device or keep typing.':'Microphone permission was denied. Allow microphone access in your browser or keep typing.';
    addErr(activeHall(),message);
    return true;
  }

  function startConversationListening(){
    if (!SR || !voiceActive || !awake || listeningPaused || document.hidden || speechPhase!=='idle' || busy[activeHall()]) return;
    var rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = function(ev){
      if (listeningPaused) return;
      var last = ev.results[ev.results.length - 1];
      var transcript = last && last[0] ? String(last[0].transcript).trim() : '';
      if (!transcript) return;
      listeningPaused = true;
      killRecognition();
      handleSpokenLine(transcript);
    };
    var again = function(ev){
      if(liveRec!==rec)return;micState='off';refreshState();
      if (micRefused(ev)) return;
      if (voiceActive && awake && !listeningPaused) setTimeout(function(){ if (voiceActive && awake && !listeningPaused) startConversationListening(); }, 120);
    };
    rec.onend = again; rec.onerror = again;
    beginRecognition(rec);
  }
  function resumeListeningAfterSpeech(){
    if(document.hidden || speechPhase!=='idle' || busy[activeHall()])return;
    listeningPaused = false;
    if(voiceActive){if(awake)startConversationListening();else startWakeListening();}
  }

  /* a spoken line lands in the composer of whichever hall is showing and goes
     out through the same send() as a typed one */
  function handleSpokenLine(transcript){
    var hall = activeHall();
    if (vaultVoiceTry(transcript) || vaultIntercept(transcript)) { resumeListeningAfterSpeech(); return; }
    if (matchesAny(transcript, STOP_PHRASES)) { stopSpeaking(); resumeListeningAfterSpeech(); return; }
    var sw = switchPhraseMatch(transcript);
    if (sw) { if (sw !== hall) show(sw); resumeListeningAfterSpeech(); return; }
    if (matchesAny(transcript, SLEEP_PHRASES)) { speak(hall, SLEEP_LINE[hall], exitAwakeMode); return; }
    if (busy[hall]) { resumeListeningAfterSpeech(); return; }
    var input = document.getElementById('in-' + hall);
    if(input?.value.trim()){input.value=restoreDraft(input.value,transcript);input.focus();resumeListeningAfterSpeech();return;}
    if (input) input.value = transcript;
    send(hall);
  }

  /* 3. Wake word. With voice on, the page listens for "Hey Thor", "Hey Loki"
     or "Hey Odin" (plus the old RAYVEN variants). Matching is multi-variant and
     fuzzy on the name word, on purpose: the recognizer rarely returns a name
     cleanly, and reducing this to one exact phrase broke detection once before.
     Waking switches to that hall, speaks its fixed entrance line, then hands the
     floor to the conversation recognizer. "switch to loki" changes the floor;
     "go to sleep" speaks the sleep line and drops back to wake listening. */
  var WAKE_PHRASES = {
    thor: ['hey thor', 'ok thor', 'okay thor', 'thor wake up'],
    loki: ['hey loki', 'ok loki', 'okay loki', 'loki wake up'],
    odin: ['hey odin', 'ok odin', 'okay odin', 'odin wake up']
  };
  var LEGACY_WAKE = [
    'hey rayven', 'hey raven', 'hey ray ven', 'hey rae ven', 'hey ravyn', 'hey ravin',
    'okay rayven', 'okay raven', 'ok rayven', 'ok raven',
    'wake up rayven', 'wake up raven', 'rayven wake up', 'raven wake up'
  ];
  var SWITCH_PHRASES = {
    thor: ['switch to thor', 'talk to thor', 'give me thor'],
    loki: ['switch to loki', 'talk to loki', 'give me loki'],
    odin: ['switch to odin', 'talk to odin', 'give me odin']
  };
  var WAKE_LINE = {
    thor: "Thor, prince of Asgard, at your service, mortal.",
    loki: "I'm the god of trickery and stories. What could you possibly need from me?",
    odin: "King of Asgard, in attendance."
  };
  var SLEEP_LINE = {
    thor: "Powering down. I'll keep a light on for you, sir.",
    loki: "Fine. I'll stop talking. You'll miss me in an hour.",
    odin: "We are done for now. Think on it."
  };
  var SLEEP_PHRASES = ['go to sleep', 'sleep now', 'power down', 'goodnight'];

  function levenshtein(a, b){
    var m = a.length, n = b.length, i, j;
    var dp = []; for (i = 0; i <= m; i++) { dp.push(new Array(n + 1).fill(0)); dp[i][0] = i; }
    for (j = 0; j <= n; j++) dp[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
  }
  /* which hall (if any) does this transcript wake? */
  function wakePersonaMatch(transcript){
    var clean = String(transcript || '').toLowerCase().trim(), i, w;
    for (i = 0; i < halls.length; i++) if (matchesAny(clean, WAKE_PHRASES[halls[i]])) return halls[i];
    if (matchesAny(clean, LEGACY_WAKE)) return 'thor';
    var words = clean.replace(/[^a-z\s]/g, '').split(/\s+/);
    for (i = 0; i < words.length; i++) {
      w = words[i];
      if (w.length < 3) continue;
      for (var h = 0; h < halls.length; h++) if (levenshtein(w, halls[h]) <= 1 && w !== 'lock') return halls[h];
      if (w.length >= 4 && levenshtein(w, 'raven') <= 1) return 'thor';
    }
    return null;
  }
  function switchPhraseMatch(text){
    for (var i = 0; i < halls.length; i++) if (matchesAny(text, SWITCH_PHRASES[halls[i]])) return halls[i];
    return null;
  }

  function startWakeListening(){
    if (!SR || !voiceActive || awake || document.hidden || speechPhase!=='idle' || busy[activeHall()]) return;
    var rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 5;
    rec.onresult = function(ev){
      if (awake) return;
      for (var r = ev.resultIndex; r < ev.results.length; r++) {
        for (var alt = 0; alt < ev.results[r].length; alt++) {
          var heard = ev.results[r][alt].transcript;
          if (vaultVoiceTry(heard)) return;
          var pid = wakePersonaMatch(heard);
          if (pid) { triggerWake(pid); return; }
        }
      }
    };
    var again = function(ev){
      if(liveRec!==rec)return;micState='off';refreshState();
      if (micRefused(ev)) return;
      if (voiceActive && !awake) setTimeout(function(){ if (voiceActive && !awake) startWakeListening(); }, 120);
    };
    rec.onend = again; rec.onerror = again;
    beginRecognition(rec);
  }
  function triggerWake(pid){
    if (awake) return;
    awake = true; listeningPaused = true;
    killRecognition();
    if (pid !== activeHall()) show(pid);
    var line = WAKE_LINE[pid];
    addMsg(pid, 'bot', line);
    speak(pid, line, resumeListeningAfterSpeech);
  }
  function exitAwakeMode(){
    awake = false; listeningPaused = false;
    killRecognition();
    if (voiceActive) setTimeout(startWakeListening, 400);
  }

  function voiceOn(){
    liveVoice?.enableBargeIn().catch(()=>addErr(activeHall(),'Voice interruption needs microphone access. You can keep typing.'));
    voiceActive = true; awake = false; listeningPaused = false;
    startWakeListening();
  }
  function voiceOff(){
    liveVoice?.disableBargeIn();
    voiceActive = false; awake = false; listeningPaused = false;
    killRecognition();
    refreshState();
  }
  document.querySelectorAll('.mic-btn').forEach(micBtn=>micBtn.addEventListener('click',()=>{
    errors[activeHall()]=false;
    if(!SR){addErr(activeHall(),'Voice input is unavailable in this browser. You can keep typing.');return;}
    if(voiceActive)voiceOff();else voiceOn();refreshState();
  }));
  /* 4. Vault phrases. "open the vault" / "wake up hela" and "close the vault" /
     "sleep hela" are recognised exactly as before, typed or spoken, and so is
     any mention of her vocabulary. On this page they are consumed and nothing
     more: no feed, no history, no network. Letting "close the vault" fall
     through to the chat would send the words to THOR, which is precisely how
     the three upstairs would learn she exists. The vault ROOM itself is not
     here: it needs its own layout, and this page's layout is not to change. */
  var VAULT_TRIG = /^(wake\s+up,?\s+hela|hela,?\s+wake\s+up|open\s+the\s+vault)[.!]?$/i;
  var VAULT_SEAL = /^(close\s+the\s+vault|sleep,?\s+hela|hela,?\s+sleep|goodnight,?\s+hela|go\s+back\s+to\s+sleep)[.!]?$/i;
  var VAULT_SWALLOW = /\b(the\s+)?vault\b|\bproject\s*h(ela)?\b|\bhela\b|\bninth\s+realm\b|\bhelheim\b/i;
  var VAULT_VOICE_OPEN = ['wake up hela', 'hela wake up', 'open the vault'];
  var VAULT_VOICE_SEAL = ['close the vault', 'sleep hela', 'hela sleep', 'goodnight hela', 'go back to sleep'];
  function vaultIntercept(rawText){
    var t = String(rawText || '').trim();
    return VAULT_TRIG.test(t) || VAULT_SEAL.test(t) || VAULT_SWALLOW.test(t);
  }
  function vaultVoiceTry(transcript){
    return matchesAny(transcript, VAULT_VOICE_SEAL) || matchesAny(transcript, VAULT_VOICE_OPEN);
  }

  /* read-only status for the test harness and the console; draws nothing */
  window.HallsVoice = { status: function(){ return { speaking: speechPhase==='speaking', voiceActive: voiceActive, awake: awake, listeningPaused: listeningPaused, hall: activeHall() }; } };


document.querySelectorAll('.persona').forEach(b=>b.addEventListener('click',()=>{show(b.dataset.go);resumeListeningAfterSpeech();}));
addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||editableTarget(e.target))return;if(['1','2','3'].includes(e.key)){show(halls[Number(e.key)-1]);resumeListeningAfterSpeech();}});
document.querySelectorAll('.suggestion').forEach(b=>b.addEventListener('click',()=>{const input=document.getElementById('in-'+activeHall());input.value=restoreDraft(input.value,b.dataset.prompt);input.focus();}));
document.querySelectorAll('.stop-speech').forEach(b=>b.addEventListener('click',()=>{stopSpeaking();resumeListeningAfterSpeech();}));
const settingsButton=document.querySelector('.settings-btn');
function diagnosticSummary(release,render={}){
  const value=(v)=>typeof v==='string'||typeof v==='number'?String(v):'Unavailable';
  const lines=release?['Release: '+value(release.id),'Fingerprint: '+value(release.fingerprint),'Base revision: '+value(release.sourceBase),'Assets: '+(release.assets&&typeof release.assets==='object'?Object.keys(release.assets).length:'Unavailable')]:['Release metadata unavailable from this host.'];
  lines.push('','Renderer: '+value(render.renderMode)+' · Quality: '+value(render.quality),'Meshes: '+value(render.meshes)+' · Triangles: '+value(render.triangles),'GPU geometries: '+value(render.rendererResources?.geometries)+' · Textures: '+value(render.rendererResources?.textures),'Driver: '+value(render.driver),'Render scale: '+value(render.renderScale)+' · Lighting: '+value(render.lighting),'Error: '+value(render.error||'None'));
  return lines.join('\n');
}
async function releaseDiagnostics(){
  const target=document.getElementById('release-diagnostics');if(!target)return;
  target.textContent='Reading release metadata…';
  let release=null;
  try{const response=await fetch('/ui/release.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('HTTP '+response.status);release=await response.json();}catch{}
  target.textContent=diagnosticSummary(release,presence?.status()||{})+'\n\n';
  const link=el('a','','View full release manifest');link.href='/ui/release.json';link.target='_blank';link.rel='noopener noreferrer';target.append(link);
}
settingsButton.addEventListener('click',()=>{dialog.showModal();releaseDiagnostics();});
document.querySelector('.close-settings').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))settingsButton.focus({preventScroll:true});});
const output=document.getElementById('output-setting');output.checked=preferences.output;
output.addEventListener('change',()=>{preferences.output=output.checked;persist('asgard:voice-output',output.checked?'1':'0');if(!output.checked){stopSpeaking();resumeListeningAfterSpeech();}});
const still=document.getElementById('still-setting');still.checked=preferences.still;
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
function motionNote(){const button=document.querySelector('[data-motion-toggle]');if(button){button.textContent=motionQuery.matches?'Reduced motion':preferences.still?'Resume motion':'Pause motion';button.disabled=motionQuery.matches;button.setAttribute('aria-pressed',String(preferences.still||motionQuery.matches));}document.getElementById('motion-note').textContent=preferences.still||motionQuery.matches?'Motion paused · Settings':presence?.status().ready?['thor','loki','odin'].includes(activeHall())?'Floating · drag to orbit':'Floating · drag an object':'3D unavailable';}
document.querySelector('[data-motion-toggle]')?.addEventListener('click',()=>{still.checked=!still.checked;still.dispatchEvent(new Event('change'));});
still.addEventListener('change',()=>{preferences.still=still.checked;persist('asgardfx:still',still.checked?'1':'0');presence?.setStill(still.checked);motionNote();});motionQuery.addEventListener('change',motionNote);motionNote();
const quality=document.getElementById('quality-setting');quality.value=preferences.quality;
quality.addEventListener('change',()=>{preferences.quality=quality.value;persist('asgard:render-quality',quality.value);presence?.setQuality(quality.value);});
const conversation=document.querySelector('.conversation'),toggle=document.querySelector('.conversation-toggle'),reopen=document.querySelector('.reopen-conversation');
function bindConversationFocus(region){
  const sync=target=>{document.documentElement.dataset.focus=!region.hidden&&!!target&&region.contains(target)?'composer':'none';};
  region.addEventListener('focusin',event=>sync(event.target));
  region.addEventListener('focusout',event=>{
    if(event.relatedTarget)sync(event.relatedTarget);
    else queueMicrotask(()=>sync(document.activeElement));
  });
}
bindConversationFocus(conversation);
conversation.addEventListener('focusin',()=>presence?.setFocus(true));
conversation.addEventListener('focusout',event=>presence?.setFocus(conversation.contains(event.relatedTarget)));
function bindComposerViewport(region){
  let frame=0;
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(window.innerWidth>700||region.hidden||!region.contains(document.activeElement))return;
      document.documentElement.style.setProperty('--visual-height',(window.visualViewport?.height||window.innerHeight)+'px');
      // Reading the transcript must never invoke composer scrolling.
      if(!document.activeElement?.closest?.('.composer,.composer-bottom,.conversation-controls'))return;
      region.querySelector('.stage.active .composer-bottom')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    });
  }
  region.addEventListener('focusin',schedule);
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
}
bindComposerViewport(conversation);
toggle.addEventListener('click',()=>{conversation.hidden=true;document.documentElement.dataset.focus='none';workspace.classList.add('chat-closed');reopen.hidden=false;toggle.setAttribute('aria-expanded','false');reopen.focus();});
reopen.addEventListener('click',()=>{conversation.hidden=false;workspace.classList.remove('chat-closed');reopen.hidden=true;toggle.setAttribute('aria-expanded','true');document.getElementById('in-'+activeHall()).focus();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){killRecognition();stopSpeaking();}else resumeListeningAfterSpeech();});
addEventListener('pagehide',e=>{voiceOff();stopSpeaking();if(!e.persisted)presence?.dispose();});
show(initialPersona(location.search,location.hash));
arsenal=createArsenal({getPersona:activeHall,getDraft:()=>document.getElementById('in-'+activeHall()).value,
  setDraft:text=>{if(conversation.hidden)reopen.click();const input=document.getElementById('in-'+activeHall());input.value=text;input.focus();},
  onSelect:id=>presence?.select(id),resetView:()=>presence?.resetView()});
createPresence(document.getElementById('presence-scene'),{persona:activeHall(),still:preferences.still,quality:preferences.quality,onHover:id=>{document.querySelector('#presence-scene').dataset.hoverAgent=id||'';},onSelect:id=>arsenal?.openAgent(id),onStatus:text=>{document.getElementById('render-notice').textContent=text;}}).then(p=>{presence=p;p.setStill(preferences.still);p.setQuality(preferences.quality);if(p.status().persona!==activeHall())p.setPersona(activeHall());motionNote();refreshState();});
window.AsgardUI={status:()=>({persona:activeHall(),state:workspace.dataset.state,mic:micState,voiceOutput:preferences.output,arsenal:arsenal?.status(),render:presence?.status()||null})};

// Bring the real composer into view without changing its draft.
document.querySelector('[data-focus-chat]')?.addEventListener('click',()=>{if(conversation.hidden)reopen.click();const input=document.getElementById('in-'+activeHall());input.focus();input.scrollIntoView({block:'center',behavior:'auto'});});

if(new URLSearchParams(location.search).get("settings")==="1"){dialog.showModal();releaseDiagnostics();}
