// Run: node --test scripts/hologram.test.mjs
// Uses real Three.js geometry/cameras and a recording Canvas2D boundary.
// No GPU, live backend or browser paint is claimed by these checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/ui/prism-v1/vendor/three.module.min.js';
import {createHologramPersona} from '../public/ui/prism-v1/hologram-persona.js';
import {createParticleProjection} from '../public/ui/prism-v1/hologram-projection.js';

function resources(root){
  const result=new Set();
  root.traverse(o=>{
    if(o.geometry)result.add(o.geometry);
    for(const material of Array.isArray(o.material)?o.material:[o.material])if(material){
      result.add(material);
      for(const value of Object.values(material))if(value?.isTexture)result.add(value);
    }
  });
  return result;
}
function visiblePose(root){
  root.updateMatrixWorld(true);
  const pose=[];
  root.traverseVisible(o=>pose.push(...o.matrixWorld.elements));
  return pose;
}
function recordingCanvas(){
  const rectangles=[],lines=[],faces=[];
  const context={
    rectangles,lines,faces,setTransform(){},clearRect(){rectangles.length=0;lines.length=0;faces.length=0;},
    createRadialGradient(){return {addColorStop(){}};},
    fillRect(x,y,w,h){rectangles.push({x,y,w,h,style:this.fillStyle});},
    closePath(){},fill(){faces.push(this.fillStyle);},beginPath(){},moveTo(x,y){lines.push({x,y});},lineTo(x,y){lines.push({x,y});},stroke(){}
  };
  return {style:{},context,getContext(type){assert.equal(type,'2d');return context;}};
}
const pointMarks=canvas=>canvas.context.rectangles.filter(r=>r.w>0&&r.w<3&&r.h>0&&r.h<3);

for(const persona of ['thor','loki','odin'])test(`${persona}: genuine volumetric portrait, stable quality buffers, still pose and complete disposal`,()=>{
  const scene=new THREE.Scene(),model=createHologramPersona(THREE,scene,persona);
  const stats=model.stats(),size=stats.bounds.getSize(new THREE.Vector3());
  assert.equal(stats.persona,persona);
  assert.ok(size.x>2&&size.y>2.8&&size.z>.5,'portrait has substantive width, height and depth');
  assert.ok(size.x<4&&size.y<5&&size.z<3,'portrait remains within camera-sized bounds');
  assert.ok(stats.surfaceTriangles>500,'particles originate in substantive mesh geometry');
  assert.ok(stats.featurePaths>10,'facial details complement the volume');
  const positions=model.points.geometry.attributes.position,colors=model.points.geometry.attributes.color;
  assert.equal(positions.count,colors.count);
  assert.ok(Array.from(positions.array).every(Number.isFinite));
  assert.ok(Array.from(colors.array).every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  const originalResources=resources(model.root),disposed=new Map();
  for(const r of originalResources)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
  const counts=[];
  for(const quality of ['low','balanced','high']){
    model.setQuality(quality);counts.push(model.stats().particles);
    assert.equal(model.points.geometry.attributes.position,positions,'quality reuses particle positions');
    assert.equal(model.points.geometry.attributes.color,colors,'quality reuses color buffer');
    assert.deepEqual(resources(model.root),originalResources,'quality allocates no replacement GPU resources');
    assert.ok(model.stats().particles<=positions.count);
  }
  assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);
  assert.ok(counts[2]<=12000,'high mode respects the declared particle ceiling');
  model.setQuality('corrupt-setting');assert.equal(model.stats().quality,'balanced');
  for(const state of ['idle','connecting','listening','thinking','speaking','error']){
    model.update(9,true,state);model.update(9,false,state);
    const pose=visiblePose(model.root),opacity=model.points.material.opacity;
    model.update(500,false,state);
    assert.deepEqual(visiblePose(model.root),pose,'disabled motion retains visible model pose');
    assert.equal(model.points.material.opacity,opacity,'disabled motion retains particle intensity');
  }
  model.update(NaN,true,'thinking');assert.ok(visiblePose(model.root).every(Number.isFinite));
  model.dispose();model.dispose();
  assert.equal(scene.children.length,0);
  assert.equal(disposed.size,originalResources.size,'geometry, materials and particle texture released');
  assert.ok([...disposed.values()].every(n=>n===1),'each owned resource disposed once');
  assert.doesNotThrow(()=>model.update(10,true,'speaking'));
});

test('personas have different silhouettes and reproducible three-dimensional particle sampling',()=>{
  const copies=[];
  try{
    for(const id of ['thor','loki','odin']){
      const first=createHologramPersona(THREE,new THREE.Scene(),id),second=createHologramPersona(THREE,new THREE.Scene(),id);
      copies.push(first,second);
      assert.deepEqual(first.points.geometry.attributes.position.array,second.points.geometry.attributes.position.array,'same identity reproducibly samples its modeled surface');
    }
    const [thor,,loki,,odin]=copies;
    assert.notDeepEqual(thor.points.geometry.attributes.position.array,loki.points.geometry.attributes.position.array);
    assert.notDeepEqual(loki.points.geometry.attributes.position.array,odin.points.geometry.attributes.position.array);
    assert.notDeepEqual(thor.points.geometry.attributes.position.array,odin.points.geometry.attributes.position.array);
    assert.ok(loki.stats().bounds.max.y>thor.stats().bounds.max.y+.15,'Loki horns change the silhouette');
    const invalid=createHologramPersona(THREE,new THREE.Scene(),'unlisted');copies.push(invalid);
    assert.equal(invalid.stats().persona,'thor');
  }finally{copies.forEach(m=>m.dispose());}
});

test('CPU projection uses real camera perspective and depth order, clips points and sees buffer edits',()=>{
  const canvas=recordingCanvas(),projection=createParticleProjection(THREE,canvas);
  projection.resize(200,100,3);assert.equal(canvas.width,250,'pixel ratio stays bounded');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(90,2,.1,100);
  camera.position.z=5;camera.lookAt(0,0,0);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,0,0,1,0,-5,0,0,6,500,0,0],3));
  geometry.setDrawRange(0,4);
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff}));scene.add(points);
  assert.equal(projection.render(scene,camera),2,'behind-camera and far-offscreen points omitted');
  let marks=pointMarks(canvas);assert.equal(marks.length,2);
  assert.ok(Math.abs(marks[0].x-105)<1e-6,'farther point projects nearer screen centre and is painted first');
  assert.ok(Math.abs(marks[1].x-110)<1e-6,'nearer point uses perspective, not flat coordinates');
  assert.ok(marks.every(m=>Math.abs(m.y-50)<1e-6));
  geometry.attributes.position.setXYZ(0,-1,0,0);
  projection.render(scene,camera);marks=pointMarks(canvas);
  assert.ok(Math.abs(marks[1].x-90)<1e-6,'actual modified vertex buffer changes the projection');
  geometry.setDrawRange(0,1);assert.equal(projection.render(scene,camera),1,'particle budget respected');
  points.visible=false;assert.equal(projection.render(scene,camera),0,'hidden geometry not drawn');
  projection.dispose();geometry.dispose();points.material.dispose();
});

test('all persona particle buffers produce finite CPU projections and respond to camera orbit',()=>{
  for(const id of ['thor','loki','odin']){
    const scene=new THREE.Scene(),model=createHologramPersona(THREE,scene,id,{quality:'low'});
    const canvas=recordingCanvas(),projection=createParticleProjection(THREE,canvas),camera=new THREE.PerspectiveCamera(35,1.2,.1,60);
    projection.resize(600,500,1);camera.position.set(0,.5,7.7);camera.lookAt(0,.3,0);
    const beforeCount=projection.render(scene,camera,{persona:id}),before=pointMarks(canvas).map(p=>[p.x,p.y]);
    assert.ok(beforeCount>0&&beforeCount<model.stats().particles,'solid mesh hides rear particles while visible surface particles remain');
    assert.ok(canvas.context.faces.length>100,'fallback renders real solid mesh triangles');
    assert.ok(new Set(canvas.context.faces).size>20,'surface normals create graded faceted illumination');
    assert.ok(canvas.context.lines.length>20,'modeled contours also project');
    assert.ok([...canvas.context.rectangles,...canvas.context.lines].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    camera.position.set(2.5,.5,7.3);camera.lookAt(0,.3,0);
    projection.render(scene,camera,{persona:id});
    assert.notDeepEqual(pointMarks(canvas).map(p=>[p.x,p.y]),before,'orbit reveals real depth');
    projection.dispose();model.dispose();
  }
});


test('sculpture has opaque depth-writing materials, anatomy, and a restrained particle budget',()=>{
  for(const id of ['thor','loki','odin']){
    const model=createHologramPersona(THREE,new THREE.Scene(),id);
    const meshes=[];model.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    assert.ok(meshes.length>15);
    assert.ok(meshes.every(o=>o.material.depthWrite&&!o.material.transparent),'all modeled planes occlude what is behind them');
    assert.ok(meshes.some(o=>o.name==='faceted-face'&&o.material.isMeshStandardMaterial));
    assert.ok(meshes.some(o=>o.name==='nose-bridge'));
    assert.equal(meshes.filter(o=>o.name==='luminous-eye').length,id==='odin'?1:2);
    assert.equal(meshes.filter(o=>o.name==='thor-helmet-wing').length,id==='thor'?6:0);
    assert.equal(meshes.filter(o=>o.name==='odin-beard-mass').length,id==='odin'?1:0);
    assert.ok(model.stats().maximumParticles<=3000,'surface volume carries identity instead of dense luminous noise');
    model.dispose();
  }
});

test('software depth buffer hides a rear point and preserves a point in front of solid geometry',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,30);
  camera.position.z=5;camera.lookAt(0,0,0);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({color:0x527589}));scene.add(mesh);
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,.2,0,.5],3));
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff}));scene.add(points);
  const canvas=recordingCanvas(),projection=createParticleProjection(THREE,canvas);projection.resize(200,200);
  assert.equal(projection.render(scene,camera),1);
  assert.equal(canvas.context.faces.length,2);
  mesh.visible=false;assert.equal(projection.render(scene,camera),2);
  projection.dispose();assert.equal(projection.render(scene,camera),0,'disposed projection does no more work');
  geometry.dispose();points.material.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('assembly completes once and never restarts when time is reset or motion resumes',()=>{
  const model=createHologramPersona(THREE,new THREE.Scene(),'loki');
  const attribute=model.points.geometry.attributes.position,rest=attribute.array.slice();
  model.update(0,true);assert.notDeepEqual(attribute.array,rest);
  model.update(.45,true);const middle=attribute.array.slice();model.update(.1,true);assert.deepEqual(attribute.array,middle,'assembly progress cannot move backward');
  model.update(1,true);assert.deepEqual(attribute.array,rest);
  const version=attribute.version;model.update(0,true);model.update(100,true);assert.equal(attribute.version,version,'settled buffers do no more per-particle work');
  model.dispose();
  const still=createHologramPersona(THREE,new THREE.Scene(),'thor'),positions=still.points.geometry.attributes.position.array.slice();
  still.update(0,false);still.update(.1,true);assert.deepEqual(still.points.geometry.attributes.position.array,positions,'still mode completes assembly permanently');still.dispose();
});

test('unavailable WebGL keeps conversation fallback honest and releases owned DOM/listeners',async()=>{
 const saved=new Map(),documentListeners=new Map(),mediaListeners=new Map(),children=[];
 const replace=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
 const node=()=>({dataset:{},style:{},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1);}});
 const controls={...node(),querySelector:()=>node(),querySelectorAll:()=>[]};
 const host={...node(),parentElement:{querySelector:()=>controls},append:n=>children.push(n),prepend:n=>children.unshift(n),getBoundingClientRect:()=>({width:900,height:650})};
 replace('window',node());replace('matchMedia',()=>({matches:false,addEventListener:(k,f)=>mediaListeners.set(k,f),removeEventListener:k=>mediaListeners.delete(k)}));
 replace('location',{search:'?renderer=fallback'});replace('requestAnimationFrame',()=>{throw Error('No frame should run without WebGL');});replace('cancelAnimationFrame',()=>{});replace('ResizeObserver',class{observe(){}disconnect(){}});
 replace('document',{hidden:false,createElement:node,addEventListener:(k,f)=>documentListeners.set(k,f),removeEventListener:k=>documentListeners.delete(k)});
 let presence;
 try{const {createPresence}=await import('../public/ui/prism-v1/scene.js');const labels=[];presence=await createPresence(host,{onStatus:s=>labels.push(s)});assert.equal(presence.status().ready,false);assert.equal(presence.status().renderMode,'fallback');assert.equal(presence.status().frames,0);assert.ok(labels.some(s=>s.includes('conversation')));assert.equal(children.length,2);assert.equal(children[0].hidden,true);presence.dispose();presence.dispose();assert.equal(children.length,0);assert.equal(documentListeners.size,0);assert.equal(mediaListeners.size,0);}
 finally{presence?.dispose();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

test('r184 surface shader preserves standard depth/lighting and adds material-local bands',()=>{
  const model=createHologramPersona(THREE,new THREE.Scene(),'thor');
  const face=model.root.getObjectByName('faceted-face'),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  assert.equal(THREE.REVISION,'184','shader contract is pinned to the locally vendored renderer');
  face.material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('vBifrostPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'));
  assert.ok(shader.fragmentShader.includes('float bifrostRim ='));
  assert.ok(shader.fragmentShader.includes('#include <lights_physical_fragment>'));
  assert.ok(shader.fragmentShader.includes('#include <opaque_fragment>'));
  assert.equal(shader.uniforms.bifrostStrength.value,1);
  model.update(4,true,'thinking');assert.equal(shader.uniforms.bifrostStrength.value,1.15);
  model.update(5,false,'idle');assert.equal(shader.uniforms.bifrostStrength.value,1);
  assert.equal(face.material.transparent,false);assert.equal(face.material.depthWrite,true);
  assert.ok(model.root.getObjectByName('raised-armour-collar'));
  assert.ok(model.root.getObjectByName('shoulder-upper-plate'));
  assert.ok(model.root.getObjectByName('layered-breastplate'));
  model.dispose();
});
