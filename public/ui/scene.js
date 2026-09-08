import {placeNameplate} from './nameplate-layout.js?v=floating-realms-3';
import {createThor} from './realm-thor.js?v=floating-realms-3';
import {createLoki} from './realm-loki.js?v=floating-realms-3';
import {createOdin} from './realm-odin.js?v=floating-realms-3';
import {createRealm} from './realm-architecture.js?v=floating-realms-3';
import {createHolographicField} from './holographic-field.js?v=floating-realms-3';
import {clampLayout,clampView,normalizedSceneState,dragObjectPosition} from './realm-controls.js?v=floating-realms-3';
const factories={thor:createThor,loki:createLoki,odin:createOdin};
// One WebGL context and scheduling owner; preview canvases only copy genuine rendered meshes.
export async function createPresence(host,{persona='thor',still=false,quality='balanced',onStatus=()=>{},onSelect=()=>{}}={}){
 let T,scene,camera,renderer,canvas,model,council,environment,key,field;
 let objectTargets=[],activeObject=null;
 let ready=false,disposed=false,state='idle',focused=false,error=null,frames=0,raf=0,last=0,time=0,dirty=true;
 let softwareDriver=false,driver='unknown';let width=1,height=1,view=clampView(),arranging=false,drag=null,selected=null,previewsDirty=true,shadowTime=-10;
 const layouts={thor:clampLayout(),loki:clampLayout(),odin:clampLayout()},previews=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];
 const listen=(el,type,fn,options)=>{el?.addEventListener(type,fn,options);listeners.push(()=>el?.removeEventListener(type,fn,options));};
 const animated=()=>ready&&!still&&!reduced.matches;
 const controls=host.parentElement.querySelector('.scene-controls'),arrangeButton=controls.querySelector('[data-arrange]'),arrangePanel=controls.querySelector('.arrange-panel');
 let ray,pointer,plane,point,projected;
 const heroLabel=document.createElement('span');heroLabel.className='hero-nameplate';host.append(heroLabel);
 const layout=()=>layouts[persona];
 function schedule(){if(!disposed&&ready&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
 function invalidate(shadows=false){dirty=true;if(shadows&&renderer)renderer.shadowMap.needsUpdate=true;schedule();}
 function cancelDrag(event){if(event?.pointerId!==undefined&&drag&&event.pointerId!==drag.id)return;const active=drag;drag=null;if(canvas)canvas.style.cursor='grab';if(active&&canvas?.hasPointerCapture?.(active.id))canvas.releasePointerCapture(active.id);}
 function fail(reason){error=String(reason?.message||reason);ready=false;cancelAnimationFrame(raf);raf=0;cancelDrag();host.dataset.render='fallback';if(canvas)canvas.hidden=true;onStatus('3D unavailable — conversation and council controls still work.');arrangeButton.disabled=true;}
 function resize(){if(disposed)return;const r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer?.setPixelRatio(Math.min(devicePixelRatio||1,quality==='high'?1.5:softwareDriver&&animated()?.65:1));renderer?.setSize(width,height,false);if(camera){camera.aspect=width/height;camera.updateProjectionMatrix();}previewsDirty=true;invalidate(true);}
 function cameraPose(){const aspect=width/height,distance=Math.max(15.8,16.2/aspect)*view.zoom;camera.position.set(0,3.15+Math.sin(view.elevation)*distance,Math.cos(view.elevation)*distance);camera.lookAt(0,3.15,0);camera.updateMatrixWorld();}
 function labelLayout(){
  if(!council)return;projected.set(model.root.position.x,-.58+model.root.position.y,model.root.position.z+.7).project(camera);heroLabel.style.left=(projected.x*.5+.5)*width+'px';heroLabel.style.top=(-projected.y*.5+.5)*height+'px';heroLabel.textContent=persona.toUpperCase();const compact=width<430;const rects=[];
  for(const {id,anchor} of council.anchors){const el=host.querySelector(`[data-advisor="${id}"]`);if(!el)continue;anchor.getWorldPosition(projected);projected.project(camera);const w=el.offsetWidth|| (compact?68:102),h=el.offsetHeight||44;let x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
   const r=placeNameplate({x,y:y-h/2-8,w,h},rects,width,height);rects.push(r);el.style.left=r.x+'px';el.style.top=r.y+'px';el.setAttribute('aria-pressed',String(id===selected));
  }
 }
 function drawPreviews(){if(!renderer||!previewsDirty)return;const size=96;renderer.shadowMap.enabled=false;renderer.setScissorTest(true);renderer.setViewport(0,0,size,size);renderer.setScissor(0,0,size,size);
  for(const p of previews){renderer.clear();renderer.render(p.scene,p.camera);const target=document.querySelector(`[data-preview="${p.id}"]`),ctx=target?.getContext('2d');if(ctx){target.width=96;target.height=96;ctx.clearRect(0,0,96,96);const ratio=renderer.getPixelRatio();ctx.drawImage(canvas,0,canvas.height-size*ratio,size*ratio,size*ratio,0,0,96,96);target.dataset.ready='true';}}
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;previewsDirty=false;
 }
 function frame(now){raf=0;if(disposed||!ready||document.hidden)return;const interval=quality==='high'?25:40;if(last&&now-last<interval&&!dirty){if(animated())schedule();return;}const dt=last?Math.min((now-last)/1000,.25):0;last=now;
  try{if(animated())time+=dt;model.update(time,animated(),state);model.root.position.y=(objectTargets[0]?.offsetY||0)+(animated()?Math.sin(time*.85)*.07:(model.root.userData.lastBob||0));if(animated())model.root.userData.lastBob=Math.sin(time*.85)*.07;council.update(time,animated(),state,focused,model.root.position);field?.update(time,animated(),state);cameraPose();scene.updateMatrixWorld(true);labelLayout();
   if(time-shadowTime>1){renderer.shadowMap.needsUpdate=true;shadowTime=time;}
   drawPreviews();renderer.render(scene,camera);frames++;host.dataset.frames=String(frames);host.dataset.animated=String(animated());host.dataset.state=state;host.dataset.focus=String(focused);dirty=false;
  }catch(e){fail(e);return;}if(animated()||dirty)schedule();
 }
 function setPersona(id){if(disposed||!factories[id])return;persona=id;selected=null;cancelDrag();if(!T)return;
  try{const next=factories[id](T,{quality});model?.dispose();council?.dispose();field?.dispose();model=next;scene.add(model.root);council=createRealm(T,scene,id);field=createHolographicField(T,scene,id);
      // The central realm floats independently; no huge tabletop competes with the council.
      if(id==='odin'){model.root.scale.set(.40,.65,.40);model.root.rotation.x=.18;model.hero.scale.setScalar(1.35);}
      else {model.root.scale.setScalar(.86);}
      objectTargets=[{id:'center',object:model.root,base:model.root.position.clone()}];
      for(const {id,gem} of council.anchors)objectTargets.push({id,object:gem.parent,base:gem.parent.position.clone()});
      activeObject=objectTargets[0];
      view=clampView();time=0;last=0;shadowTime=-10;ready=true;canvas.hidden=false;host.dataset.render='webgl';host.dataset.model=id;arrangeButton.disabled=false;setArrange(false);applyLayout(layout());onStatus('');invalidate(true);resize();}catch(e){fail(e);}
 }
 function pointerRay(e){cameraPose();scene.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray;}
 function down(e){
  if(e.button!==0||!ready||drag||e.isPrimary===false)return;
  const hits=pointerRay(e).intersectObjects(objectTargets.map(t=>t.object),true);
  if(!hits.length)return;
  let object=hits[0].object,target;
  while(object&&!target){target=objectTargets.find(t=>t.object===object);object=object.parent;}
  if(!target)return;
  activeObject=target;plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),hits[0].point);
  const hit=ray.ray.intersectPlane(plane,point);
  drag={id:e.pointerId,target,x:e.clientX,y:e.clientY,start:target.object.position.clone(),point:hit?point.clone():null,moved:false};
  if(target.id==='center')drag.start.y=target.offsetY||0;
  canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing';
 }
 function move(e){
  if(!drag||drag.id!==e.pointerId)return;
  if(e.pointerType==='mouse'&&e.buttons===0){cancelDrag();return;}
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
  drag.moved=true;
  const hit=pointerRay(e).ray.intersectPlane(plane,point);
  if(hit&&drag.point){
   const target=drag.target,delta=point.clone().sub(drag.point);
   // Center bob uses a separate offset so animation cannot undo user placement.
   if(target.id==='center')applyLayout({...layout(),x:drag.start.x+delta.x,y:drag.start.y+delta.y});
   else {const next=dragObjectPosition(drag.start,target.base,delta,.65);target.object.position.x=next.x;target.object.position.y=next.y;invalidate(true);}
  }
 }
 function up(e){if(!drag||drag.id!==e.pointerId)return;const clicked=!drag.moved,target=drag.target;cancelDrag();canvas.style.cursor='grab';if(clicked&&target.id!=='center')onSelect(target.id);}
 function applyLayout(value){layouts[persona]=clampLayout(value);const center=objectTargets[0];if(center){center.offsetY=layout().y;center.object.position.set(layout().x,layout().y+(center.object.userData.lastBob||0),layout().z);}const status=controls.querySelector('[data-layout-status]');status.textContent=`Local position: ${layout().x.toFixed(1)}, ${layout().y.toFixed(1)}, ${layout().z.toFixed(1)}`;invalidate(true);}
 function setArrange(value){arranging=!!value;cancelDrag();arrangeButton.setAttribute('aria-pressed',String(arranging));arrangePanel.hidden=!arranging;host.dataset.arrange=String(arranging);}
 function zoom(step){view=clampView({...view,zoom:view.zoom+step});invalidate();}
 function visibility(){last=0;cancelDrag();if(document.hidden){cancelAnimationFrame(raf);raf=0;}else invalidate();}
 function motionChange(){last=0;cancelAnimationFrame(raf);raf=0;resize();}
 const observer=new ResizeObserver(resize);observer.observe(host);listen(document,'visibilitychange',visibility);listen(window,'blur',cancelDrag);listen(reduced,'change',motionChange);
 listen(arrangeButton,'click',()=>setArrange(!arranging));listen(controls.querySelector('[data-zoom-in]'),'click',()=>zoom(-.06));listen(controls.querySelector('[data-zoom-out]'),'click',()=>zoom(.06));
 listen(controls.querySelector('[data-reset-layout]'),'click',()=>{applyLayout({});for(const t of objectTargets){t.object.position.copy(t.base);t.offsetY=0;}invalidate(true);});
 for(const button of controls.querySelectorAll('[data-position]'))listen(button,'click',()=>{const [axis,amount]=button.dataset.position.split(':');applyLayout({...layout(),[axis]:layout()[axis]+Number(amount)});});
 listen(host,'focusin',()=>{focused=true;invalidate();});listen(host,'focusout',()=>{focused=false;invalidate();});
 try{T=await import('./vendor/three.module.min.js');if(disposed)return;scene=new T.Scene();scene.fog=new T.FogExp2(0x071019,.019);camera=new T.PerspectiveCamera(36,1,.1,90);ray=new T.Raycaster();pointer=new T.Vector2();point=new T.Vector3();projected=new T.Vector3();plane=new T.Plane(new T.Vector3(0,1,0),-1.5);
  canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.prepend(canvas);listen(canvas,'pointerdown',down);listen(canvas,'pointermove',move);listen(canvas,'pointerup',up);listen(canvas,'pointercancel',cancelDrag);listen(canvas,'lostpointercapture',cancelDrag);listen(canvas,'webglcontextlost',e=>{e.preventDefault();fail(Error('WebGL context lost'));});
  listen(canvas,'wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(Math.sign(e.deltaY)*.04);},{passive:false});
  if(['fallback','canvas','svg'].includes(new URLSearchParams(location.search).get('renderer')))throw Error('Rendering fallback requested');
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0x071019,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');driver=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);softwareDriver=/swiftshader|llvmpipe|software/i.test(driver);renderer.shadowMap.type=T.BasicShadowMap;renderer.shadowMap.autoUpdate=false;
  scene.add(new T.HemisphereLight(0xc3dcf4,0x26313a,1.1));key=new T.DirectionalLight(0xffe3b6,3.0);key.position.set(-4,10,6);key.castShadow=true;key.shadow.mapSize.set(softwareDriver?256:512,softwareDriver?256:512);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.camera.far=30;key.shadow.bias=-.0007;key.shadow.normalBias=.035;scene.add(key);
  const fill=new T.DirectionalLight(0x9dcaff,1.7);fill.position.set(4,5,-5);scene.add(fill);const front=new T.DirectionalLight(0xffffff,.7);front.position.set(0,3,8);scene.add(front);
  // Original procedural studio illumination, not a scene/image reference texture.
  const data=new Uint8Array(128*64*4);for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;const box=Math.exp(-(((x-30)/10)**2+((y-24)/17)**2))+.6*Math.exp(-(((x-91)/15)**2+((y-20)/9)**2));const v=Math.min(255,22+box*230+(1-y/64)*38);data[i]=v;data[i+1]=v*.96;data[i+2]=v*.91;data[i+3]=255;}environment=new T.DataTexture(data,128,64,T.RGBAFormat);environment.mapping=T.EquirectangularReflectionMapping;environment.colorSpace=T.SRGBColorSpace;environment.needsUpdate=true;scene.environment=softwareDriver&&quality==='balanced'?null:environment;
  for(const id of Object.keys(factories)){const m=factories[id](T,{quality:'balanced',preview:true}),s=new T.Scene();s.environment=environment;s.add(m.root,new T.HemisphereLight(0xcfe4ff,0x35404b,2));const light=new T.DirectionalLight(0xffe8c9,4);light.position.set(-3,6,5);s.add(light);const c=new T.PerspectiveCamera(34,1,.1,40);c.position.set(3,4.4,8.5);c.lookAt(0,1.8,0);previews.push({id,model:m,scene:s,camera:c});}
  setPersona(persona);
 }catch(e){fail(e);}
 return {setPersona,select(id){selected=id;council?.select(id);invalidate();},resetView(){view=clampView();cancelDrag();invalidate();},setState(next){state=normalizedSceneState(next);invalidate();},setFocus(value){focused=!!value;if(model?.setFocus)model.setFocus(focused);invalidate();},setStill(value){still=!!value;motionChange();},setQuality(value){quality=value==='high'?'high':'balanced';if(scene)scene.environment=softwareDriver&&quality==='balanced'?null:environment;invalidate(true);resize();},status(){let meshes=0,triangles=0;model?.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {ready,renderMode:ready?'webgl':'fallback',persona,state,frames,animationTime:time,dragTarget:drag?.target.id||null,cameraPosition:camera?.position.toArray(),animated:animated(),hidden:document.hidden,rafActive:!!raf,quality,width,height,error,driver,renderScale:renderer?.getPixelRatio(),lighting:softwareDriver&&quality==='balanced'?'Direct lights; software-driver budget':'Direct lights + studio environment',threeRevision:T?.REVISION,rendererResources:renderer?{...renderer.info.memory}:null,meshes,triangles,advisors:council?.anchors.map(a=>a.id)||[],objects:objectTargets.map(t=>({id:t.id,position:t.object.position.toArray()})),view:{...view},arranging,layout:{...layout()},previews:previews.length,models:typeof model?.stats==='function'?model.stats():model?.stats};},dispose(){if(disposed)return;disposed=true;cancelDrag();cancelAnimationFrame(raf);raf=0;observer.disconnect();listeners.forEach(off=>off());model?.dispose();council?.dispose();field?.dispose();previews.forEach(p=>p.model.dispose());environment?.dispose();key?.shadow.dispose();renderer?.dispose();canvas?.remove();heroLabel.remove();}};
}
