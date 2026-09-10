import {voiceSession} from './voice-session.js';
import {getPersonaVoiceId,getPersonaVoiceSettings,resolvePersonaId} from './personas.js';
export async function voiceWebSocket(request,env,ctx,runTurn) {
 if(env.VOICE_STREAM_ENABLED!=='true')return new Response('Streaming voice is not enabled.',{status:503});
 if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required.',{status:426});
 const origin=request.headers.get('Origin');
 if(!['https://asgrard-backend.rayanfahil2.workers.dev','https://rayven-backend.rayanfahil2.workers.dev'].includes(origin))return new Response('Origin refused.',{status:403});
 const persona=resolvePersonaId(new URL(request.url).searchParams.get('persona')),voice=getPersonaVoiceId(env,persona);
 if(!voice||!env.ELEVENLABS_API_KEY)return new Response('Voice account is unavailable.',{status:503});
 const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();
 const session=voiceSession({send:message=>server.send(JSON.stringify(message)),runTurn:(text,options)=>runTurn(persona,text,options),connectSpeech:async (onAudio,signal)=>{
  const url=`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/multi-stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000&inactivity_timeout=180&sync_alignment=true`;
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),headers:{Upgrade:'websocket','xi-api-key':env.ELEVENLABS_API_KEY}});
  const socket=response.webSocket;if(!socket)throw new Error('The streaming voice service could not connect.');socket.accept();
  socket.addEventListener('message',event=>{try{const data=JSON.parse(event.data);if(data.error){server.send(JSON.stringify({type:'error',message:'The voice service interrupted playback.'}));return;}onAudio(data);}catch{server.send(JSON.stringify({type:'error',message:'The voice stream could not be read.'}));}});
  // The credential stays in the upgrade header; no browser message contains it.
  return {isOpen:()=>socket.readyState===1,send:message=>{const data=JSON.parse(message);if(data.text===' '&&!data.flush)data.voice_settings=getPersonaVoiceSettings(persona);socket.send(JSON.stringify(data));},close:()=>socket.close(1000,'Session closed')};
 }});
 server.addEventListener('message',event=>{if(typeof event.data!=='string'||event.data.length>16000)return;try{ctx.waitUntil(session.receive(JSON.parse(event.data)));}catch{server.send(JSON.stringify({type:'error',message:'Invalid voice request.'}));}});
 server.addEventListener('close',()=>ctx.waitUntil(session.close()));server.addEventListener('error',()=>ctx.waitUntil(session.close()));
 return new Response(null,{status:101,webSocket:client});
}
