// Settings remain local; never put the pairing token in sync storage.
const show=r=>{document.querySelector('#error').textContent=r.error||'';const data=r.result||r.state||r;document.querySelector('#result').textContent=JSON.stringify(data,null,2);const settings=data.settings||data;for(const key of ['sensitivity','command_window','clip_seconds'])if(Number.isFinite(settings[key]))document.getElementById(key).value=settings[key];if(data.events)document.querySelector('#events').textContent=JSON.stringify(data.events,null,2);};
async function send(message){const r=await chrome.runtime.sendMessage(message);show(r);return r;}
document.querySelector('#pair').onclick=async()=>{await chrome.storage.local.set({token:document.querySelector('#token').value.trim()});document.querySelector('#token').value='';await send({op:'disconnect'});await send({op:'status'});};
document.querySelector('#save').onclick=()=>send({op:'settings',settings:Object.fromEntries(['sensitivity','command_window','clip_seconds'].map(k=>[k,Number(document.getElementById(k).value)]))});
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>send({op:b.dataset.op}));
chrome.runtime.onMessage.addListener(m=>{if(m.state){document.querySelector('#events').textContent=JSON.stringify(m.state.events||[],null,2);}});send({op:'status'});
