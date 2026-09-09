// Small card previews come from the existing geometry, materials and lights.
// Render one room at a time, capture one frame and release its WebGL context.
import {createAstralCartographer} from '../astral-cartographer.js';
import {createPrismFoundry} from '../prism-foundry.js';
import {createSolarThrone} from '../solar-throne.js';
export async function renderHallPreviews(){
 let stopped=false,current=null;
 const stop=()=>{stopped=true;current?.dispose();};
 addEventListener('pagehide',stop,{once:true});
 try {
  for(const [id,create] of [['thor',createAstralCartographer],['loki',createPrismFoundry],['odin',createSolarThrone]]){
   if(stopped)break;
   const target=document.querySelector(`[data-hall-art="${id}"]`);if(!target)continue;
   const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;left:-1000px;top:0;width:300px;height:160px;pointer-events:none;overflow:hidden';document.body.append(host);
   try {
    await new Promise((resolve,reject)=>{
     let captured=false;
     const timeout=setTimeout(()=>{current?.dispose();reject(Error('Preview did not render'));},15000);
     try{current=create(host,{still:true,onFrame:canvas=>{if(captured)return;captured=true;target.getContext('2d').drawImage(canvas,0,0,target.width,target.height);target.dataset.render='webgl-preview';clearTimeout(timeout);resolve();}});}
     catch(error){clearTimeout(timeout);reject(error);}
    });
   }catch{target.hidden=true;}
   finally{current?.dispose();current=null;host.remove();}
  }
 }finally{removeEventListener('pagehide',stop);}
}
