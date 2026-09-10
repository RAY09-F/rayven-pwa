const slides=[...document.querySelectorAll('.brief-slide')];let active=0;
const chapterNames=['Your workspace','The Bridge','100 tools','Using the tools','Your service offer','What remains'];
const chapters=slides.map((slide,i)=>{const b=document.createElement('button');b.type='button';b.textContent=String(i+1).padStart(2,'0')+' / '+chapterNames[i];b.addEventListener('click',()=>{show(i);slide.scrollIntoView({block:'start'});});document.getElementById('brief-chapters').append(b);return b;});
function show(index){active=Math.max(0,Math.min(slides.length-1,index));slides.forEach((s,i)=>s.hidden=i!==active);chapters.forEach((b,i)=>b.setAttribute('aria-current',i===active?'step':'false'));document.getElementById('brief-position').textContent=String(active+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');document.getElementById('brief-prev').disabled=active===0;document.getElementById('brief-next').disabled=active===slides.length-1;}
document.getElementById('brief-prev').addEventListener('click',()=>show(active-1));document.getElementById('brief-next').addEventListener('click',()=>show(active+1));document.querySelector('.briefing').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();show(active+1);}if(e.key==='ArrowLeft'){e.preventDefault();show(active-1);}});show(0);

let printState=null;
window.addEventListener('beforeprint',()=>{if(printState)return;printState=[...document.querySelectorAll('#manual details')].map(el=>[el,el.open]);for(const [el] of printState)el.open=true;});
window.addEventListener('afterprint',()=>{if(!printState)return;for(const [el,open] of printState)el.open=open;printState=null;});
document.getElementById('brief-print').addEventListener('click',()=>window.print());
