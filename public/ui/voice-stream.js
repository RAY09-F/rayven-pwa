// PCM samples are scheduled directly. decodeAudioData requires complete files,
// so arbitrary MP3 websocket fragments must not be passed to it.
export class VoicePlayback {
 constructor(context){this.context=context;this.gain=context.createGain();this.gain.connect(context.destination);this.nodes=new Set();this.next=0;this.started=0;this.chars=[];this.totalChars=0;this.carry=null;}
 append(base64,alignment){
  const raw=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const bytes=new Uint8Array(raw.length+(this.carry===null?0:1));if(this.carry!==null)bytes[0]=this.carry;bytes.set(raw,this.carry===null?0:1);
  this.carry=bytes.length%2?bytes[bytes.length-1]:null;const length=Math.floor(bytes.length/2);if(!length)return;
  const buffer=this.context.createBuffer(1,length,16000),channel=buffer.getChannelData(0),view=new DataView(bytes.buffer);
  for(let i=0;i<length;i++)channel[i]=view.getInt16(i*2,true)/32768;
  const at=Math.max(this.next,this.context.currentTime+.02);if(!this.started)this.started=at;
  const starts=alignment?.char_start_times_ms||alignment?.charStartTimesMs||[],durations=alignment?.char_durations_ms||alignment?.charDurationsMs||[];
  for(let i=0;i<starts.length;i++)this.chars.push({end:at+(starts[i]+(durations[i]||0))/1000,index:++this.totalChars});
  const node=this.context.createBufferSource();node.buffer=buffer;node.connect(this.gain);node.onended=()=>{this.nodes.delete(node);node.disconnect();};this.nodes.add(node);node.start(at);this.next=at+buffer.duration;
 }
 heard(){let count=0;for(const char of this.chars)if(char.end<=this.context.currentTime)count=char.index;return count;}
 stop(){const heard=this.heard(),at=this.context.currentTime;this.gain.gain.cancelScheduledValues(at);this.gain.gain.setValueAtTime(this.gain.gain.value,at);this.gain.gain.linearRampToValueAtTime(0,at+.02);for(const node of this.nodes){try{node.stop(at+.02);}catch{}}this.nodes.clear();this.next=0;return heard;}
}
export class VoiceClient {
 constructor(base,onState){this.base=base;this.onState=onState;this.socket=null;this.pending=null;}
 unlock(){this.context ||= new (window.AudioContext||window.webkitAudioContext)();return this.context.resume();}
 async connect(persona){
  if(this.socket?.readyState===1&&this.persona===persona)return;
  this.socket?.close();this.persona=persona;
  const url=new URL('/voice/stream',this.base);url.protocol='wss:';url.searchParams.set('persona',persona);
  const socket=this.socket=new WebSocket(url);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.close();reject(new Error('Voice connection timed out.'));},10000);socket.onopen=()=>{clearTimeout(timer);resolve();};socket.onerror=()=>{clearTimeout(timer);reject(new Error('Voice connection failed.'));};});
  socket.onmessage=event=>{if(this.socket!==socket)return;let data;try{data=JSON.parse(event.data);}catch{return;}const p=this.pending;if(!p||data.id&&data.id!==p.id)return;
   if(data.type==='text'){p.text+=data.text;p.onText(data.text);}
   if(data.type==='reset'){p.playback.stop();p.playback=new VoicePlayback(this.context);p.text='';p.onText('',true);}
   if(data.type==='audio'){
    if(data.audio){p.playback.append(data.audio,data.alignment);this.onState('speaking');}
    if(data.isFinal){clearTimeout(p.finishTimer);p.finishTimer=setTimeout(()=>{if(this.pending!==p)return;socket.send(JSON.stringify({type:'heard',id:p.id,heardChars:p.playback.heard()}));clearTimeout(p.guard);this.pending=null;this.onState('idle');},Math.max(0,p.playback.next-this.context.currentTime)*1000+30);}
   }
   if(data.type==='done')p.resolve({reply:data.reply,voiced:true});
   if(data.type==='error'){this.interrupt();p.reject(new Error(data.message));}
  };
  socket.onclose=()=>{if(this.socket!==socket)return;if(this.pending){this.pending.reject(new Error('Voice connection closed.'));this.interrupt();}};
 }
 async turn(persona,text,{signal,onText}){
  this.interrupt();await this.unlock();await this.connect(persona);signal.throwIfAborted();
  return new Promise((resolve,reject)=>{const p={id:crypto.randomUUID(),playback:new VoicePlayback(this.context),text:'',onText,resolve,reject};this.pending=p;p.guard=setTimeout(()=>{if(this.pending===p)this.interrupt();},60000);this.onState('preparing');signal.addEventListener('abort',()=>{if(this.pending===p){this.interrupt();reject(new DOMException('Aborted','AbortError'));}},{once:true});this.socket.send(JSON.stringify({type:'turn',id:p.id,text}));});
 }
 interrupt(){const p=this.pending;if(!p)return;clearTimeout(p.finishTimer);clearTimeout(p.guard);const heardChars=p.playback.heard();if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'interrupt',id:p.id,heardChars}));p.playback.stop();this.pending=null;p.reject(new DOMException('Voice interrupted','AbortError'));this.onState('idle');}
 async enableBargeIn(){
  const generation=this.micGeneration=(this.micGeneration||0)+1;
  await this.unlock();if(generation!==this.micGeneration||this.mic)return;
  const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  if(generation!==this.micGeneration){mic.getTracks().forEach(track=>track.stop());return;}
  this.mic=mic;
  this.micSource=this.context.createMediaStreamSource(this.mic);this.micAnalyser=this.context.createAnalyser();this.micAnalyser.fftSize=512;this.micSource.connect(this.micAnalyser);
  const bytes=new Uint8Array(512);let floor=.01,above=0,last=performance.now();
  const sample=()=>{if(!this.mic)return;this.micAnalyser.getByteTimeDomainData(bytes);const rms=Math.sqrt(bytes.reduce((sum,n)=>sum+((n-128)/128)**2,0)/bytes.length),now=performance.now();
   if(!this.pending)floor=floor*.98+rms*.02;
   if(this.pending&&rms>Math.max(.035,floor*3)){above+=Math.min(now-last,60);if(above>=140){above=0;this.interrupt();}}else above=0;
   last=now;this.vadFrame=requestAnimationFrame(sample);
  };sample();
 }
 disableBargeIn(){this.micGeneration=(this.micGeneration||0)+1;cancelAnimationFrame(this.vadFrame);this.mic?.getTracks().forEach(track=>track.stop());this.mic=null;this.micSource?.disconnect();}
 close(){this.interrupt();this.disableBargeIn();this.socket?.close();} 
}
