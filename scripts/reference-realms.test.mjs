import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/ui/vendor/three.module.min.js';
import {createThor} from '../public/ui/realm-thor.js';
import {createLoki} from '../public/ui/realm-loki.js';
import {createOdin} from '../public/ui/realm-odin.js';
import {createRealm} from '../public/ui/realm-architecture.js';
import {CAST} from '../public/ui/council-data.js';
import {clampLayout,clampView,normalizedSceneState,COUNCIL_POSITIONS} from '../public/ui/realm-controls.js';

const factories={thor:createThor,loki:createLoki,odin:createOdin};
const states=['idle','connecting','permission-pending','listening','thinking','speaking','error','cancelled'];
function finite(values,label){assert.ok(Array.from(values).every(Number.isFinite),label);}
function inspect(root){
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  finite(o.matrixWorld.elements,`${o.name} world transform`);
  if(o.instanceMatrix)finite(o.instanceMatrix.array,`${o.name} instances`);
  if(o.geometry){
   for(const name of ['position','normal'])if(o.geometry.attributes[name])finite(o.geometry.attributes[name].array,`${o.name} ${name}`);
   if(o.isMesh)assert.ok(o.geometry.attributes.normal,'lit solid has surface normals');
   if(o.geometry.index)for(const i of o.geometry.index.array)assert.ok(i<o.geometry.attributes.position.count,'valid triangle index');
  }
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){
   if(m.color)finite(m.color.toArray(),'material color');
   if(m.emissiveIntensity!==undefined)assert.ok(Number.isFinite(m.emissiveIntensity)&&m.emissiveIntensity>=0&&m.emissiveIntensity<2,'bounded glow');
  }
 });
}
function pose(root){const values=[];root.traverse(o=>values.push([o.uuid,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return values;}
function box(o){o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);}
function instrument(){
 const resources=[];const T={...THREE};
 for(const [name,Base] of Object.entries(THREE))if(typeof Base==='function'&&(/Geometry$|Material$|Texture$/.test(name)||name==='InstancedMesh')){
  T[name]=class extends Base{constructor(...args){super(...args);const record={name,disposed:0};resources.push(record);this.addEventListener('dispose',()=>record.disposed++);}};
 }
 return {T,resources};
}
for(const [name,create] of Object.entries(factories)){
 test(`${name}: real depth, named construction, bounded geometry and all runtime states`,()=>{
  const r=create(THREE);assert.ok(r.root.isGroup&&r.hero.isGroup&&r.hero.parent===r.root);
  const named=[];r.root.traverse(o=>{if(o.name)named.push(o.name);});assert.ok(new Set(named).size>=5,'independently inspectable architectural components');
  const b=box(r.root);assert.ok(b.max.y<4.31&&b.min.y>-.6,'bounded model height');
  const radius=name==='odin'?5.7:2.55;assert.ok(Math.max(Math.abs(b.min.x),Math.abs(b.max.x),Math.abs(b.min.z),Math.abs(b.max.z))<=radius,'model footprint');
  const body=name==='thor'?r.root.getObjectByName('thor-mjolnir'):name==='loki'?r.root.getObjectByName('loki-floating-gold-crystal'):r.hero;
  assert.ok(body,'distinct primary body');const size=box(body).getSize(new THREE.Vector3());assert.ok(size.z>.35&&size.x>.6,'solid body has width and real depth');
  const council=createRealm(THREE,new THREE.Scene(),name);const advisorSize=box(council.gems[1]).getSize(new THREE.Vector3());const ratio=size.y/advisorSize.y;
  assert.ok(ratio>=1.1&&ratio<=1.9,`body/advisor height ${ratio} remains dominant without dwarfing council`);council.dispose();
  r.hero.position.set(.31,.18,-.22);
  let time=0;for(const state of states){r.update(time+=.08,true,state);inspect(r.root);assert.deepEqual(r.hero.position.toArray(),[.31,.18,-.22],'arrangement survives update');}
  r.dispose();
 });
 test(`${name}: Still freezes every transform and animated pieces move independently`,()=>{
  const r=create(THREE);r.update(0,true,'thinking');const before=pose(r.root);for(let i=1;i<=30;i++)r.update(i*.1,true,'thinking');const moving=pose(r.root);
  if(name!=='odin'){
   const changed=moving.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(before[i]));assert.ok(changed.length>=2,'centerpiece and a separate band move');
   assert.ok(new Set(changed.map(p=>JSON.stringify(p.slice(1)))).size>=2,'parts have separate poses');
  }
  const frozen=pose(r.root);for(const state of states)r.update(50,false,state);assert.deepEqual(pose(r.root),frozen,'Still freezes all component transforms even on state changes');r.dispose();
 });
 for(const preview of [false,true])test(`${name}: ${preview?'preview':'full'} resources dispose exactly once, including textures and instanced meshes`,()=>{
  const {T,resources}=instrument();const r=create(T,{preview,quality:preview?'balanced':'high'});const scene=new THREE.Scene();scene.add(r.root);inspect(r.root);r.dispose();r.dispose();assert.equal(r.root.parent,null);
  assert.ok(resources.length>5);for(const record of resources)assert.equal(record.disposed,1,`${record.name} disposed exactly once`);
  if(name==='odin')assert.ok(resources.some(r=>r.name==='DataTexture'),'procedural surfaces exercised');
 });
}
for(const name of Object.keys(factories))test(`${name}: council identities, colors, anchors, selection and disposal`,()=>{
 const {T,resources}=instrument(),scene=new THREE.Scene(),r=createRealm(T,scene,name);
 assert.equal(r.gems.length,5);assert.deepEqual(r.pickables,r.gems);assert.deepEqual(r.gems.map(g=>g.userData.councillor),CAST[name].councillors);
 assert.equal(new Set(r.gems.map(g=>g.uuid)).size,5);
 for(let i=0;i<5;i++){
  const g=r.gems[i],id=CAST[name].councillors[i];assert.equal(g.material.emissive.getHex(),new THREE.Color(CAST[id].color).getHex());assert.deepEqual(g.parent.position.toArray(),COUNCIL_POSITIONS[i]);assert.equal(r.anchors[i].id,id);assert.equal(r.anchors[i].gem,g);
  const previous=r.gems.map(g=>g.material.emissiveIntensity);r.select(id);assert.ok(g.material.emissiveIntensity>Math.min(...previous));assert.ok(r.gems.every(other=>other===g||other.material.emissiveIntensity<g.material.emissiveIntensity),'selection highlights one actual advisor');
 }
 r.select(null);assert.equal(new Set(r.gems.map(g=>g.material.emissiveIntensity)).size,1,'clearing selection resets all');
 for(const state of states){r.update(3,true,state);inspect(r.root);}const p=pose(r.root);r.update(99,false,'idle');assert.deepEqual(pose(r.root),p);
 r.dispose();r.dispose();assert.equal(r.root.parent,null);for(const resource of resources)assert.equal(resource.disposed,1,resource.name);
});
test('state, layout and camera inputs normalize malformed data and enforce bounds',()=>{
 for(const state of states)assert.equal(normalizedSceneState(state),state);
 for(const value of [null,undefined,{},[],42,'busy','<script>'])assert.equal(normalizedSceneState(value),'idle');
 for(const value of [null,undefined,{},[],42,'bad',{x:NaN,y:Infinity,z:'3'}])assert.deepEqual(clampLayout(value),{x:0,y:0,z:0});
 assert.deepEqual(clampLayout({x:99,y:-1,z:-99}),{x:.45,y:0,z:-.35});assert.deepEqual(clampLayout({x:-99,y:99,z:99}),{x:-.45,y:.35,z:.35});
 for(const value of [null,undefined,{},[],42,'bad',{yaw:NaN,elevation:Infinity,zoom:'3'}])assert.deepEqual(clampView(value),{yaw:0,elevation:.68,zoom:1});
 assert.deepEqual(clampView({yaw:99,elevation:-99,zoom:99}),{yaw:.42,elevation:.42,zoom:1.2});assert.deepEqual(clampView({yaw:-99,elevation:99,zoom:-99}),{yaw:-.42,elevation:.78,zoom:.82});
 const layout={x:.2,y:.1,z:-.1},view={yaw:.1,elevation:.7,zoom:1.1};assert.deepEqual(clampLayout(layout),layout);assert.deepEqual(clampView(view),view);
});
test('production scene and factories do not import or load reference photographs',async()=>{
 for(const file of ['scene.js','realm-thor.js','realm-loki.js','realm-odin.js','realm-architecture.js']){
  const source=await readFile(new URL('../public/ui/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/(?:import|load|fetch|src\s*=)[^\n;]*\.(?:jpe?g|png|webp)\b/i,file);
  assert.doesNotMatch(source,/references\/|asgard-reference-build-pack\//i,file);
 }
});
