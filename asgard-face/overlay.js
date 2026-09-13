// User-enabled page pill; shadow DOM and textContent prevent page/content injection.
if(!globalThis.asgardFaceLoaded){globalThis.asgardFaceLoaded=true;
let host,timer;
chrome.runtime.onMessage.addListener(m=>{
  if(!m.asgard)return;const s=m.asgard;clearTimeout(timer);
  if(s.state==='idle'||s.muted||s.state==='disconnected'){timer=setTimeout(()=>{host?.remove();host=null;},3000);return;}
  if(!host){host=document.createElement('div');host.style.cssText='position:fixed;bottom:26px;right:26px;z-index:2147483647;pointer-events:none';const shadow=host.attachShadow({mode:'closed'});const pill=document.createElement('div');pill.style.cssText='font:14px system-ui;padding:14px 20px;background:#10151cf5;color:white;border:1px solid #587288;border-radius:32px;max-width:360px;box-shadow:0 8px 32px #0005';shadow.append(pill);host.pill=pill;document.documentElement.append(host);}
  host.pill.style.borderColor={thor:'#47b3ff',loki:'#087f32',odin:'#ffb324'}[s.god];host.pill.textContent=`${s.god.toUpperCase()} · ${s.state}${s.text?' — '+s.text:''}`;
  timer=setTimeout(()=>{host?.remove();host=null;},20000);
});}
