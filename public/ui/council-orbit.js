import {GODS} from './council-roster.js';

// The uploaded roster uses paper-agent IDs; delegation uses council IDs.
export const councilId = (hall, member) => hall === 'odin'
  ? ({baldr:'volstagg',vidar:'heimdall',tyr:'fandral',heimdall:'hogun',freya:'frigga'}[member.id])
  : member.id;

export function createCouncilOrbit({getPersona,openAgent}) {
  const ring=document.createElement('nav');ring.className='council-orbit';
  ring.setAttribute('aria-label','Your five council agents');document.body.append(ring);
  const positions=[[18,43],[29,31],[50,26],[71,31],[82,43]];
  function render(){
    const hall=getPersona();ring.replaceChildren();ring.dataset.persona=hall;
    GODS[hall].council.forEach((member,i)=>{
      const button=document.createElement('button');button.type='button';button.className='orbit-agent';
      button.dataset.councilId=councilId(hall,member);button.dataset.paperAgentId=hall==='odin'?member.id:'';
      button.style.cssText=`--member:${member.c};--x:${positions[i][0]}%;--y:${positions[i][1]}%;--delay:${-i*1.3}s`;
      const glyph=document.createElement('span');glyph.className='orbit-glyph';glyph.setAttribute('aria-hidden','true');
      const name=document.createElement('strong');name.textContent=member.name;
      const title=document.createElement('small');title.textContent=hall==='odin'?'PAPER / SIM':member.title;
      button.append(glyph,name,title);button.title=member.job;
      button.setAttribute('aria-label',member.name+' — '+title.textContent+' — open council controls');
      button.addEventListener('click',()=>openAgent(councilId(hall,member)));ring.append(button);
    });
  }
  render();
  return {render,state(value){ring.dataset.state=value;},level(value){ring.style.setProperty('--energy',Math.max(0,Math.min(1,value)));},reduced(value){ring.classList.toggle('still',!!value);}};
}
