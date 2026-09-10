import * as T from './vendor/three.module.min.js';
import {createThor} from './realm-thor.js?v=floating-realms-3';
import {createOdin} from './realm-odin.js?v=floating-realms-3';
import {OrbitControls} from './vendor/OrbitControls.js';
import {buildPrismFoundry} from './prism-foundry-model.js';

// Owns the renderer, scheduling and DOM. The portable model owns its geometry.
export function createCouncilScene(host,config,{still=false,quality='balanced',onHover=()=>{},onSelect=()=>{},onStatus=()=>{}}={}) {
 const {id,persona,build,agentIds,coreLabel,coreOffset=1.45,pixelRatio=1.5,exposure=1.1,fogColor=0x050b12,fogDensity=.045,hemisphere=[0x4a7a9a,0x0a1a2a,.25],keyIntensity=.77,fillIntensity=.175,studioColor=0x06101a,panels,frameStride=2}=config;
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',config.description);
 host.prepend(canvas);host.classList.add('council-scene',id);
 let renderer;
 try {if(['fallback','canvas','svg'].includes(new URLSearchParams(location.search).get('renderer')))throw Error('WebGL unavailable');renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});}
 catch(error){canvas.remove();host.classList.remove('council-scene',id);throw error;}
 renderer.setClearColor(0x050b12,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelRatio));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=exposure;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const scene=new T.Scene();scene.fog=new T.FogExp2(fogColor,fogDensity);
 const camera=new T.PerspectiveCamera(45,1,.05,200),controls=new OrbitControls(camera,canvas);
 controls.target.set(0,1.35,0);controls.enableDamping=true;controls.dampingFactor=.05;controls.autoRotateSpeed=.9;controls.enablePan=false;controls.minDistance=5;controls.maxDistance=30;
 const model=build(T);scene.add(model.root);model.update(0);
 scene.add(new T.HemisphereLight(...hemisphere));
 const key=new T.DirectionalLight(0xffffff,keyIntensity);key.position.set(4,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=4;key.shadow.bias=-.0002;scene.add(key);
 const fill=new T.DirectionalLight(0xfff4e6,fillIntensity);fill.position.set(-5,3,-4);scene.add(fill);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.45}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const studio=new T.Scene();studio.background=new T.Color(studioColor);
 for(const [color,intensity,pos,w,h] of panels){
  const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));panel.position.set(...pos);panel.lookAt(0,0,0);studio.add(panel);
 }
 const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04);scene.environment=environment.texture;scene.environmentIntensity=.9;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});studio.clear();
 const overlay=document.createElement('div');overlay.className='prism-labels';overlay.setAttribute('aria-hidden','true');host.append(overlay);
 const flash=config.flash?document.createElement('div'):null;if(flash){flash.className='council-flash';host.append(flash);}
 const labels=[{key:'core',...coreLabel,object:model.core},...model.stations.map(s=>({...s.a,object:s.gemGrp}))].map(info=>{
  const el=document.createElement('div');el.className='prism-label'+(info.key==='core'?' prism-core':'');el.dataset.agentKey=info.key;el.style.setProperty('--prism-color',info.css);
  const name=document.createElement('b'),role=document.createElement('small'),tick=document.createElement('span');name.textContent=info.name;role.textContent=info.role;tick.className='prism-tick';el.append(tick,name,role);overlay.append(el);return {...info,el};
 });
 const coreOccluders=model.coreOccluders||model.occluders.filter(o=>o!==model.coreCrystal);
 const pickHits=[],occlusionHits=[],neutralPointer=new T.Vector2();
 let previewsDirty=true,disposed=false,contextLost=false,raf=0,last=0,frames=0,width=1,height=1,hover=null,selected=null,drag=null,hasDragged=false,settle=0,state='idle';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[],ptr=new T.Vector2(),ray=new T.Raycaster(),occRay=new T.Raycaster(),world=new T.Vector3(),projected=new T.Vector3(),direction=new T.Vector3();let pointerInside=false;
 const animated=()=>!still&&!reduced.matches;
 const listen=(el,type,fn,options)=>{el?.addEventListener(type,fn,options);listeners.push(()=>el?.removeEventListener(type,fn,options));};
 const schedule=()=>{if(!disposed&&!contextLost&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);};
 function resize(){if(disposed)return;const box=host.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();const half=T.MathUtils.degToRad(45)/2,horizontal=Math.atan(Math.tan(half)*camera.aspect),distance=3.9/Math.sin(Math.min(half,horizontal))*.95;controls.maxDistance=Math.max(30,distance*2);camera.position.copy(direction.set(.55,.5,1).normalize().multiplyScalar(distance).add(controls.target));controls.update(0);last=0;schedule();}
 function hoverChanged(next){if(next===hover)return;hover=next;canvas.style.cursor=next?'pointer':'grab';onHover(next);}
 function pick(){ray.setFromCamera(ptr,camera);pickHits.length=0;ray.intersectObjects(model.pickables,false,pickHits);return pickHits[0]?.object.userData.agentKey||null;}
 function positionLabels(){const scale=T.MathUtils.clamp(7/camera.position.distanceTo(controls.target),.7,1.4);
  for(const label of labels){label.object.getWorldPosition(world);direction.copy(world).sub(camera.position);const distance=direction.length();occRay.set(camera.position,direction.normalize());occRay.far=Math.max(0,distance-.3);occlusionHits.length=0;occRay.intersectObjects(label.key==='core'?coreOccluders:model.occluders,false,occlusionHits);const visible=!occlusionHits.length;
   projected.copy(world);projected.y+=label.key==='core'?coreOffset:-.3;projected.project(camera);
   const w=label.el.offsetWidth*scale,h=label.el.offsetHeight*scale,core=label.key==='core';let x=(projected.x*.5+.5)*width-w/2,y=(-projected.y*.5+.5)*height+(core?-34:26)*scale-(core?h:0);
   x=T.MathUtils.clamp(x,8,Math.max(8,width-w-8));y=T.MathUtils.clamp(y,8,Math.max(8,height-h-8));
   label.el.style.transform=`translate(${x}px,${y}px) scale(${scale})`;label.el.style.opacity=visible&&projected.z>=-1&&projected.z<=1?'1':'0';label.el.classList.toggle('hot',hover===label.key);label.el.dataset.occluded=String(!visible);
  }
 }
 function drawPreviews(){
  if(!previewsDirty)return;previewsDirty=false;
  const size=96,ratio=renderer.getPixelRatio();renderer.shadowMap.enabled=false;renderer.setScissorTest(true);renderer.setViewport(0,0,size,size);renderer.setScissor(0,0,size,size);
  for(const [id,factory] of [['thor',createThor],['loki',null],['odin',createOdin]]){
   const target=document.querySelector(`[data-preview="${id}"]`),ctx=target?.getContext('2d');if(!ctx)continue;
   const miniature=factory?factory(T,{quality:'balanced',preview:true}):persona==='loki'?{root:model.root.clone(true),dispose(){this.root.removeFromParent();}}:buildPrismFoundry(T);
   const previewScene=new T.Scene();previewScene.environment=environment.texture;previewScene.add(miniature.root,new T.HemisphereLight(0xcfe4ff,0x35404b,2));const light=new T.DirectionalLight(0xffe8c9,4);light.position.set(-3,6,5);previewScene.add(light);
   const previewCamera=new T.PerspectiveCamera(34,1,.1,40);previewCamera.position.set(3,4.4,id==='loki'?11:8.5);previewCamera.lookAt(0,1.8,0);renderer.clear();renderer.render(previewScene,previewCamera);
   target.width=target.height=size;ctx.clearRect(0,0,size,size);ctx.drawImage(canvas,0,canvas.height-size*ratio,size*ratio,size*ratio,0,0,size,size);target.dataset.ready='true';miniature.dispose();
  }
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.shadowMap.enabled=true;
 }
 const updateState={pointer:neutralPointer,hover:null,animated:true};
 function frame(now){raf=0;if(disposed||contextLost||document.hidden)return;const dt=last?(now-last)/1000:0;last=now;controls.autoRotate=animated()&&!hasDragged;controls.enableDamping=animated();controls.update(dt);updateState.pointer=pointerInside?ptr:neutralPointer;updateState.hover=hover;updateState.animated=animated();model.update(dt,updateState);if(flash)flash.style.opacity=animated()?String(model.flash||0):'0';scene.updateMatrixWorld(true);
  if(frames%frameStride===0||!animated()){if(pointerInside&&!drag)hoverChanged(pick());positionLabels();}drawPreviews();renderer.render(scene,camera);frames++;host.dataset.frames=String(frames);host.dataset.animated=String(animated());if(animated()||drag||settle-->0)schedule();
 }
 const pointer=e=>{const r=canvas.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerInside=true;};
 listen(canvas,'pointermove',e=>{pointer(e);if(drag&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5){drag.moved=true;hasDragged=true;controls.autoRotate=false;}settle=animated()?12:1;schedule();});
 listen(canvas,'pointerdown',e=>{if(e.button!==0)return;pointer(e);drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};schedule();});
 listen(canvas,'pointerup',e=>{if(drag?.id!==e.pointerId)return;pointer(e);if(!drag.moved){const hit=pick();model.pulse(hit);if(hit){selected=hit;onSelect(hit);}}drag=null;settle=animated()?12:1;schedule();});
 const cancel=()=>{drag=null;pointerInside=false;hoverChanged(null);settle=animated()?12:1;schedule();};
 listen(canvas,'pointercancel',cancel);listen(canvas,'pointerleave',()=>{pointerInside=false;hoverChanged(null);settle=1;schedule();});listen(window,'blur',cancel);
 listen(canvas,'wheel',()=>{settle=animated()?12:1;schedule();},{passive:true});
 listen(document,'visibilitychange',()=>{last=0;drag=null;if(document.hidden){cancelAnimationFrame(raf);raf=0;hoverChanged(null);}else schedule();});
 listen(reduced,'change',()=>{last=0;settle=1;schedule();});
 listen(canvas,'webglcontextlost',e=>{e.preventDefault();contextLost=true;host.dataset.render='fallback';cancelAnimationFrame(raf);raf=0;onStatus('3D unavailable — conversation and council controls still work.');});
 listen(canvas,'webglcontextrestored',()=>{contextLost=false;previewsDirty=true;host.dataset.render='webgl';last=0;onStatus('');settle=1;schedule();});
 const buttons=host.parentElement.querySelector('.scene-controls'),arrange=buttons?.querySelector('[data-arrange]'),panel=buttons?.querySelector('.arrange-panel');const caption=host.parentElement.querySelector('.council-caption small'),oldCaption=caption?.textContent;if(caption)caption.textContent=config.caption;const previousHidden=arrange?.hidden;if(arrange)arrange.hidden=true;if(panel)panel.hidden=true;
 const zoom=amount=>{camera.position.sub(controls.target).multiplyScalar(amount).add(controls.target);settle=animated()?12:1;schedule();};
 listen(buttons?.querySelector('[data-zoom-in]'),'click',()=>zoom(.9));listen(buttons?.querySelector('[data-zoom-out]'),'click',()=>zoom(1.1));listen(buttons?.querySelector('[data-reset-layout]'),'click',resize);
 const observer=new ResizeObserver(resize);observer.observe(host);resize();host.dataset.render='webgl';host.dataset.model=id;onStatus('');
 document.fonts?.ready.then(()=>{if(!disposed)schedule();});
 return {select(id){selected=Object.keys(agentIds).find(key=>agentIds[key]===id)||id;model.pulse(selected);settle=animated()?12:1;schedule();},setState(value){state=value;},setFocus(){},setStill(value){still=!!value;last=0;settle=1;schedule();},setQuality(value){quality=value;},resetView:resize,status(){return {ready:!disposed&&!contextLost,renderMode:contextLost?'fallback':'webgl',persona,scene:id,state,frames,animationTime:model.time,animated:animated(),hidden:document.hidden,rafActive:!!raf,width,height,threeRevision:T.REVISION,renderScale:renderer.getPixelRatio(),rendererResources:{...renderer.info.memory},advisors:model.stations.map(s=>agentIds[s.a.key]),hover,selected,autoRotate:controls.autoRotate,hasDragged,cameraPosition:camera.position.toArray(),quality,shadowMapSize:key.shadow.mapSize.x,objects:labels.map(l=>{l.object.getWorldPosition(world);projected.copy(world).project(camera);return {id:l.key,x:(projected.x*.5+.5)*width,y:(-projected.y*.5+.5)*height};})};},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();listeners.forEach(off=>off());controls.dispose();model.dispose();environment.dispose();key.shadow.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();overlay.remove();flash?.remove();host.classList.remove('council-scene',id);if(arrange)arrange.hidden=previousHidden;if(caption)caption.textContent=oldCaption;onHover(null);}};
}
