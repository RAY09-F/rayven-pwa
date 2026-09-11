const $=id=>document.getElementById(id);
function workspace(){const open=document.body.classList.toggle('workspace-open');$('workspace-toggle').setAttribute('aria-expanded',String(open));$('workspace-toggle').textContent=open?'Close workspace':'Workspace';if(open)document.querySelector('.work').scrollIntoView({behavior:'smooth',block:'start'});}
$('workspace-toggle').addEventListener('click',workspace);
function conversation(open){document.body.classList.toggle('chat-open',open);$('conversation-toggle').setAttribute('aria-expanded',String(open));$('conversation-toggle').textContent=open?'Hide conversation':'Conversation';}
$('conversation-toggle').addEventListener('click',()=>conversation(!document.body.classList.contains('chat-open')));
addEventListener('asgard:conversation',()=>conversation(true));
$('composer').addEventListener('submit',()=>{if($('message').value.trim())conversation(true);},true);
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&$('message').value.trim())conversation(true);},true);
const clock=()=>{$('local-clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' / LOCAL TIME';};clock();const interval=setInterval(clock,30000);addEventListener('pagehide',()=>clearInterval(interval));
