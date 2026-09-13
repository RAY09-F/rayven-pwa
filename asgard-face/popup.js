// Popup wakes the event-driven connection without idle polling.
let current={};
function draw(s){current=s;document.querySelector('#status').textContent=`${(s.god||'Asgard').toUpperCase()} · ${s.muted?'Muted':s.state}`;document.querySelector('#heard').textContent=s.heard||'Say Thor, Loki, or Odin.';}
async function send(op){const r=await chrome.runtime.sendMessage({op});document.querySelector('#error').textContent=r.error||'';if(r.state)draw(r.state);if(r.result?.state)draw(r.result);}
chrome.runtime.onMessage.addListener(m=>{if(m.state)draw(m.state);});
document.querySelector('#mute').onclick=()=>send(current.muted?'unmute':'mute');
document.querySelector('#overlay').onclick=()=>send('overlay');
document.querySelector('#setup').onclick=()=>chrome.runtime.openOptionsPage();send('get');
