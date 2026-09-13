// Event-driven local controls; no timers or remote requests while idle.
try{importScripts('pairing.js');}catch{/* Manual pairing remains available in source checkouts. */}
let socket, opening, state={state:'disconnected'}, port=47321, pending=new Map();
async function connect(){
  if(socket?.readyState===1)return;
  if(opening)return opening;
  opening=(async()=>{
    const {token,port:savedPort}=await chrome.storage.local.get(['token','port']);
    if(!token)throw Error('Open setup and paste the local pairing token.');
    for(let i=0;i<10;i++){
      port=47321+((Number(savedPort||47321)-47321+i)%10);
      try{
        await new Promise((resolve,reject)=>{
          const ws=new WebSocket(`ws://127.0.0.1:${port}`);socket=ws;
          const timer=setTimeout(()=>{ws.close();reject(Error('Companion did not respond.'));},2000);
          ws.onopen=()=>ws.send(JSON.stringify({token}));
          ws.onerror=()=>{clearTimeout(timer);reject(Error('Companion is offline.'));};
          ws.onclose=()=>{clearTimeout(timer);reject(Error('Connection closed.'));if(socket===ws){state={state:'disconnected'};badge();}};
          ws.onmessage=e=>{
            const data=JSON.parse(e.data);
            if(data.type==='state'){state=data;clearTimeout(timer);resolve();badge();broadcast();}
            else if(pending.has(data.id)){pending.get(data.id)(data);pending.delete(data.id);}
          };
        });
        await chrome.storage.local.set({port});return;
      }catch(e){socket?.close();if(i===9)throw e;}
    }
  })().finally(()=>opening=null);return opening;
}
function badge(){chrome.action.setBadgeText({text:state.muted?'OFF':state.state==='disconnected'?'?':Object.keys(state.errors||{}).length?'!':'ON'});chrome.action.setBadgeBackgroundColor({color:state.muted?'#64748b':state.state==='disconnected'||Object.keys(state.errors||{}).length?'#b74141':'#187b49'});}
async function broadcast(){
  chrome.runtime.sendMessage({state}).catch(()=>{});
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(tab?.id)chrome.tabs.sendMessage(tab.id,{asgard:state}).catch(()=>{});
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  (async()=>{
    if(message.op==='overlay'){
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(tab?.id)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['overlay.js']});
      await connect();await broadcast();return {ok:true,state};
    }
    if(message.op==='disconnect'){socket?.close();return {ok:true};}
    await connect();
    if(message.op==='get')return {ok:true,state};
    const id=crypto.randomUUID();
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{pending.delete(id);resolve({ok:false,error:'Command timed out; it was not retried.'});},15000);
      pending.set(id,data=>{clearTimeout(timer);resolve(data);});
      socket.send(JSON.stringify({...message,id}));
    });
  })().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.runtime.onInstalled.addListener(async()=>{if(globalThis.ASGARD_PAIRING)await chrome.storage.local.set({token:globalThis.ASGARD_PAIRING});badge();});
