// One scene owner for the focused homepage. Reuses the existing core modules;
// the legacy FX engine remains unchanged on the lab and council pages.
const coreModules={};
export async function createPresence(host,{persona='thor',still=false,quality='balanced',onStatus=()=>{}}={}){
  let THREE,renderer,scene,camera,core=null,ctx,raf=0,last=0,time=0,dirty=true,disposed=false;
  let renderMode='webgl',svg=null,stillContext=null,stillImage=null,stillURL=null,stillGeneration=0;
  let state='idle',generation=0,frames=0,room=null,ready=false,loadError=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),modules=coreModules;
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const previous=window.AsgardFX;
  const registry={registerCore(id,mod){if(['thor','loki','odin'].includes(id))modules[id]=mod;}};
  window.AsgardFX=registry;
  let w=1,h=1;
  const palette={thor:0x91d6ff,loki:0x77dcb6,odin:0xe5bb73};
  const coreQuality=()=>renderMode==='svg'?2:quality==='high'?1:2;
  const animated=()=>renderMode==='webgl'&&!still&&!reduced.matches;
  function fallback(error){
    loadError=String(error?.message||error);ready=false;cancelAnimationFrame(raf);raf=0;
    canvas.hidden=true;host.dataset.render='fallback';onStatus('3D unavailable — conversation still works');
  }
  // Rasterize the SVG projection once per change. Thousands of SVG face nodes
  // need not participate in every browser paint on a device without WebGL.
  function paintStill(){
    svg.style.background='transparent';
    const token=++stillGeneration;
    if(stillImage){stillImage.onload=null;stillImage.onerror=null;}
    if(stillURL)URL.revokeObjectURL(stillURL);
    stillURL=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
    const url=stillURL,img=stillImage=new Image();
    img.onload=()=>{if(!disposed&&token===stillGeneration){canvas.width=Math.round(w);canvas.height=Math.round(h);stillContext.clearRect(0,0,w,h);stillContext.drawImage(img,0,0,w,h);}URL.revokeObjectURL(url);if(stillURL===url)stillURL=null;};
    img.onerror=()=>{URL.revokeObjectURL(url);if(!disposed&&token===stillGeneration)fallback(new Error('Still view could not render'));};
    img.src=url;
  }
  function roomBuild(){
    room=new THREE.Group();
    const metal=new THREE.MeshStandardMaterial({color:0x253642,metalness:.7,roughness:.42});
    const edge=new THREE.MeshBasicMaterial({color:palette[persona],transparent:true,opacity:.16});
    // Receding architectural ribs, with clear negative space around the core.
    for(let i=0;i<5;i++){
      const z=-2.6-i*1.75,half=2.6+i*.08;
      for(const x of [-half,half]){
        const rib=new THREE.Mesh(new THREE.BoxGeometry(.10,6.3,.16),metal);rib.position.set(x,1.6,z);room.add(rib);
        const line=new THREE.Mesh(new THREE.BoxGeometry(.014,6.3,.018),edge);line.position.set(x-.045,1.6,z+.09);room.add(line);
      }
      const top=new THREE.Mesh(new THREE.BoxGeometry(half*2,.10,.16),metal);top.position.set(0,4.75,z);room.add(top);
    }
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,30),new THREE.MeshStandardMaterial({color:0x081018,metalness:.6,roughness:.48}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,-1.05,-7);room.add(floor);
    if(renderMode==='svg')floor.visible=false;
    scene.add(room);
  }
  function roomDispose(){if(!room)return;const geos=new Set(),mats=new Set();room.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());scene.remove(room);room=null;}
  function resize(){
    if(disposed)return;const rect=host.getBoundingClientRect();w=Math.max(1,rect.width);h=Math.max(1,rect.height);
    if(renderer){renderer.setPixelRatio?.(Math.min(devicePixelRatio||1,quality==='high'?1.5:1.25));renderer.setSize(w,h,false);}
    if(core&&camera){core.resize(w,h,ctx);camera.fov=w/h<.85?49:38;camera.position.set(1.05,1.35,w/h<.85?8.7:7.2);camera.lookAt(0,.40,0);camera.updateProjectionMatrix();}
    dirty=true;schedule();
  }
  function schedule(){if(!disposed&&!raf&&!document.hidden&&ready)raf=requestAnimationFrame(frame);}
  function frame(now){
    raf=0;if(disposed||document.hidden||!ready)return;
    // Balanced rendering is capped at 30 frames/s; high quality follows RAF.
    if(quality!=='high'&&last&&now-last<32&&!dirty){schedule();return;}
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;
    try{
      if(animated())time+=dt;
      core?.update(animated()?dt:0,ctx);
      if(renderMode==='svg')scene.traverse(o=>{if(o.isLight){o.userData.svgBaseIntensity??=o.intensity;o.intensity=o.userData.svgBaseIntensity*(o.isPointLight?.06:.25);}});
      renderer.render(scene,camera);if(renderMode==='svg')paintStill();frames++;host.dataset.frames=String(frames);host.dataset.triangles=String(renderer.info?.render?.triangles||renderer.info?.render?.faces||0);dirty=false;
    }catch(e){fallback(e);return;}
    if(animated())schedule();
  }
  async function setPersona(id){
    if(!['thor','loki','odin'].includes(id)||disposed)return;
    persona=id;const token=++generation;
    if(!THREE)return;
    try{
      if(!modules[id])await import('/fx/cores/'+id+'.js');
      if(disposed||token!==generation)return;
      core?.dispose();roomDispose();core=modules[id];
      if(!core)throw new Error('Core registration failed');
      ctx={presentation:'focused',THREE,renderer,scene,camera,tier:renderMode==='webgl'?'webgl2':'svg',persona:id,palette:{},get w(){return w;},get h(){return h;},get dpr(){return renderer.getPixelRatio?.()||1;},get quality(){return coreQuality();},get still(){return !animated();},get reduced(){return reduced.matches;},get t(){return time;},get state(){return state;},level:0,listen:0,think:0,speak:0,ring(){},flash(){},sfx:{},project(v,out){const p=v.clone().project(camera);out.x=(p.x+1)*w/2;out.y=(1-p.y)*h/2;return out;}};
      core.init(ctx);core.setQuality(coreQuality());core.setState(state,0);
      // Refine the existing materials for a darker, more structural reading.
      scene.traverse(o=>{
        if(!o.isMesh)return;
        // SVG uses painter ordering rather than a depth buffer; broad floor
        // polygons would incorrectly cover the core. Keep the modeled plinth.
        if(renderMode==='svg'&&o.geometry.type==='CircleGeometry')o.visible=false;
        for(const m of Array.isArray(o.material)?o.material:[o.material]){
          if(m.isMeshPhysicalMaterial&&m.metalness<.5){m.roughness=Math.max(.18,m.roughness);}
        }
      });
      roomBuild();scene.fog=new THREE.FogExp2(0x080d15,.055);
      canvas.hidden=false;host.dataset.render=renderMode;ready=true;
      onStatus(renderMode==='svg'?'Still view · simplified rendering':'');resize();
    }catch(e){fallback(e);}
  }
  function visibility(){last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;schedule();}}
  function motionChange(){dirty=true;last=0;cancelAnimationFrame(raf);raf=0;schedule();}
  function lost(e){e.preventDefault();fallback(new Error('Graphics context lost'));}
  const observer=new ResizeObserver(resize);observer.observe(host);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motionChange);canvas.addEventListener('webglcontextlost',lost);
  try{
    if(new URLSearchParams(location.search).get('renderer')==='fallback')throw new Error('Fallback requested');
    THREE=await import('./vendor/three.module.min.js');if(disposed)return;
    try{if(new URLSearchParams(location.search).get('renderer')==='svg')throw new Error('Still renderer requested');renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});}catch(e){
      loadError=String(e.message);renderMode='svg';const {SVGRenderer}=await import('./vendor/SVGRenderer.js');renderer=new SVGRenderer();renderer.setPrecision(2);svg=renderer.domElement;svg.setAttribute('aria-hidden','true');stillContext=canvas.getContext('2d');if(!stillContext)throw new Error('Still canvas unavailable');
    }
    renderer.setClearColor(0x080d15,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera();resize();await setPersona(persona);
  }catch(e){fallback(e);}
  const api={setPersona,setState(next){state=['thinking','listening','speaking'].includes(next)?next:'idle';core?.setState(state,0);dirty=true;schedule();},setStill(value){still=!!value;motionChange();},setQuality(value){quality=value==='high'?'high':'balanced';core?.setQuality(coreQuality());resize();},status(){return {ready,renderMode,persona,state,frames,animated:animated(),hidden:document.hidden,rafActive:!!raf,quality,width:w,height:h,error:loadError,triangles:renderer?.info?.render?.triangles||0,geometries:renderer?.info?.memory?.geometries||0,textures:renderer?.info?.memory?.textures||0};},dispose(){if(disposed)return;disposed=true;generation++;stillGeneration++;if(stillImage){stillImage.onload=null;stillImage.onerror=null;}if(stillURL)URL.revokeObjectURL(stillURL);cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motionChange);canvas.removeEventListener('webglcontextlost',lost);core?.dispose();roomDispose();renderer?.dispose?.();canvas.remove();svg?.remove();if(window.AsgardFX===registry)window.AsgardFX=previous;}};
  return api;
}
