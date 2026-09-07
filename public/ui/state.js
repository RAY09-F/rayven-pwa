export const personas=['thor','loki','odin'];
export function initialPersona(search,hash){
  const p=new URLSearchParams(search);
  return [p.get('persona'),p.get('hall'),hash.replace(/^#/,'')].find(x=>personas.includes(x))||'thor';
}
export function editableTarget(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');}
export function readPreferences(storage){
  const get=k=>{try{return storage.getItem(k);}catch{return null;}};
  return {still:get('asgardfx:still')==='1',output:get('asgard:voice-output')!=='0',quality:get('asgard:render-quality')==='high'?'high':'balanced'};
}
export function assistantState({busy=false,error=false,speaking=false,preparing=false,mic='off'}={}){
  if(busy)return {id:'thinking',label:'Thinking',detail:'Working on your message.'};
  if(error)return {id:'error',label:'Needs attention',detail:'See the message in conversation.'};
  if(speaking)return {id:'speaking',label:'Speaking',detail:'Playing the spoken response.'};
  if(preparing)return {id:'connecting',label:'Preparing voice',detail:'Your text reply is ready.'};
  if(mic==='pending')return {id:'connecting',label:'Starting microphone',detail:'Waiting for the browser.'};
  if(mic==='listening')return {id:'listening',label:'Listening',detail:'You can speak now.'};
  if(mic==='wake')return {id:'listening',label:'Listening for your call',detail:'Say “Hey Thor”, “Hey Loki”, or “Hey Odin”.'};
  return {id:'idle',label:'Ready when you are',detail:'Type a message or start listening.'};
}
