import {createHologramPersona} from './hologram-persona.js?v=hologram-realms-1';
import {createParticleProjection} from './hologram-projection.js?v=hologram-realms-1';
// One scene owner. Persona geometry and software projection share the same buffers.
export async function createPresence(host,{persona='thor',still=false,quality='balanced',onStatus=()=>{},onSelect=()=>{}}={}){
 let THREE,scene,camera,renderer=null,projection=null,model=null,canvas=null;
 let ready=false,disposed=false,mode='webgl',state='idle',error=null,frames=0,raf=0,last=0,time=0,dirty=true;
 let width=1,height=1,yaw=.08,targetYaw=.08,drag=null,generation=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const animated=()=>!still&&!reduced.matches&&ready;
 function attachCanvas(){const c=document.createElement('canvas');c.setAttribute('aria-hidden','true');c.addEventListener('pointerdown',down);c.addEventListener('pointermove',move);c.addEventListener('pointerup',up);c.addEventListener('pointercancel',cancelDrag);c.addEventListener('lostpointercapture',cancelDrag);c.addEventListener('webglcontextlost',lost);host.append(c);return c;}
 function removeCanvas(c){if(!c)return;c.removeEventListener('pointerdown',down);c.removeEventListener('pointermove',move);c.removeEventListener('pointerup',up);c.removeEventListener('pointercancel',cancelDrag);c.removeEventListener('lostpointercapture',cancelDrag);c.removeEventListener('webglcontextlost',lost);c.remove();}
 function software(reason){error=String(reason?.message||reason);renderer?.dispose();renderer=null;projection?.dispose();projection=null;removeCanvas(canvas);canvas=attachCanvas();projection=createParticleProjection(THREE,canvas);mode='canvas';host.dataset.render=mode;onStatus('Software 3D projection');resize();}
 function fail(reason){error=String(reason?.message||reason);mode='fallback';ready=false;cancelAnimationFrame(raf);raf=0;if(canvas)canvas.hidden=true;host.dataset.render='fallback';onStatus('Hologram unavailable — conversation still works');}
 function resize(){if(disposed)return;const r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const ratio=Math.min(devicePixelRatio||1,quality==='high'?1.5:1.25);renderer?.setPixelRatio(ratio);renderer?.setSize(width,height,false);projection?.resize(width,height,ratio);if(camera){camera.aspect=width/height;camera.fov=35;camera.updateProjectionMatrix();}dirty=true;schedule();}
 function schedule(){if(!disposed&&!raf&&!document.hidden&&ready)raf=requestAnimationFrame(frame);}
 function frame(now){raf=0;if(disposed||document.hidden||!ready)return;const interval=mode==='canvas'?50:quality==='high'?16:32;if(last&&now-last<interval&&!dirty){schedule();return;}const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  try{if(animated())time+=dt;model.update(time,animated(),state);yaw=animated()?yaw+(targetYaw-yaw)*Math.min(1,dt*7):targetYaw;
   const distance=Math.max(7.7,5.4/(width/height));camera.position.set(Math.sin(yaw)*distance,.5,Math.cos(yaw)*distance);camera.lookAt(0,.3,0);camera.updateMatrixWorld();
   if(renderer)renderer.render(scene,camera);else projection.render(scene,camera,{time,state,animated:animated(),persona});
   frames++;host.dataset.frames=String(frames);host.dataset.particles=String(model.stats().particles);host.dataset.animated=String(animated());host.dataset.state=state;dirty=false;
  }catch(e){if(mode==='webgl'){try{software(e);dirty=true;}catch(f){fail(f);return;}}else{fail(e);return;}}
  if(animated()||dirty)schedule();
 }
 async function setPersona(id){if(disposed||!['thor','loki','odin'].includes(id))return;persona=id;const token=++generation;if(!THREE)return;
  try{const next=createHologramPersona(THREE,scene,id,{quality});if(disposed||token!==generation){next.dispose();return;}model?.dispose();model=next;time=0;last=0;ready=true;canvas.hidden=false;host.dataset.render=mode;host.dataset.model=id;host.dataset.generation=String(generation);onStatus(mode==='canvas'?'Software 3D projection':'');dirty=true;resize();}catch(e){fail(e);}
 }
 function down(e){if(e.button!==0||!ready)return;drag={x:e.clientX,y:e.clientY,yaw:targetYaw,id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);}
 function move(e){if(!drag||e.pointerId!==drag.id)return;targetYaw=Math.max(-.5,Math.min(.5,drag.yaw+(e.clientX-drag.x)*.004));dirty=true;schedule();}
 function up(e){if(!drag||e.pointerId!==drag.id)return;drag=null;}
 function cancelDrag(){drag=null;}
 function visibility(){last=0;cancelDrag();if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;schedule();}}
 function motionChange(){last=0;dirty=true;cancelAnimationFrame(raf);raf=0;schedule();}
 function lost(e){e.preventDefault();if(disposed)return;try{software(new Error('WebGL context lost'));dirty=true;schedule();}catch(f){fail(f);}}
 const observer=new ResizeObserver(resize);observer.observe(host);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motionChange);
 try{THREE=await import('./vendor/three.module.min.js');if(disposed)return;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,60);canvas=attachCanvas();const forced=new URLSearchParams(location.search).get('renderer');if(forced==='fallback')throw Error('Fallback requested');
  try{if(forced==='svg'||forced==='canvas')throw Error('Software projection requested');renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0x03070e,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;}catch(e){software(e);}
  await setPersona(persona);
 }catch(e){fail(e);}
 return {setPersona,select(id){host.dataset.advisor=id||'';},resetView(){targetYaw=.08;dirty=true;schedule();},setState(next){state=['thinking','listening','speaking','connecting','error'].includes(next)?next:'idle';dirty=true;schedule();},setStill(value){still=!!value;motionChange();},setQuality(value){quality=value==='high'?'high':'balanced';model?.setQuality(quality);resize();},status(){return {ready,renderMode:mode,persona,state,frames,animated:animated(),hidden:document.hidden,rafActive:!!raf,quality,width,height,error,...model?.stats()};},dispose(){if(disposed)return;disposed=true;generation++;cancelAnimationFrame(raf);raf=0;observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motionChange);model?.dispose();renderer?.dispose();projection?.dispose();removeCanvas(canvas);}};
}
