import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../public/ui/vendor/three.module.min.js';
import {dragObjectPosition,COUNCIL_POSITIONS} from '../public/ui/realm-controls.js';
import {createRealm} from '../public/ui/realm-architecture.js';
import {createHolographicField} from '../public/ui/holographic-field.js';
for(const persona of ['thor','loki','odin']){
 test(persona+' floating council has visible displacement and freezes on reduced motion',()=>{
  const r=createRealm(T,new T.Scene(),persona);r.update(0,true,'idle');const first=r.gems.map(g=>g.position.y);r.update(1,true,'idle');assert.ok(r.gems.some((g,i)=>Math.abs(g.position.y-first[i])>.08));const pose=r.gems.map(g=>g.position.toArray());r.update(20,false,'thinking');assert.deepEqual(r.gems.map(g=>g.position.toArray()),pose);r.dispose();
 });
 test(persona+' individual movement leaves siblings and base coordinates intact',()=>{
  const r=createRealm(T,new T.Scene(),persona),positions=r.gems.map(g=>g.parent.position.toArray());
  const moved=dragObjectPosition(r.gems[2].parent.position,r.gems[2].parent.position,{x:99,y:-99});r.gems[2].parent.position.x=moved.x;r.gems[2].parent.position.y=moved.y;
  for(const i of [0,1,3,4])assert.deepEqual(r.gems[i].parent.position.toArray(),positions[i]);assert.equal(moved.x,COUNCIL_POSITIONS[2][0]+.65);assert.equal(moved.y,COUNCIL_POSITIONS[2][1]-.65);r.dispose();
 });
 test(persona+' field follows shared clock, freezes and cleans up',()=>{
  const scene=new T.Scene(),f=createHolographicField(T,scene,persona);const root=scene.children[0],ring=root.children[0],points=root.children.find(o=>o.isPoints);
  f.update(1,true,'idle');const before=ring.rotation.z;f.update(3,true,'thinking');assert.notEqual(ring.rotation.z,before);assert.equal(points.material.uniforms.clock.value,3);assert.equal(points.material.uniforms.strength.value,1);f.update(99,false,'idle');assert.equal(points.material.uniforms.clock.value,3);f.dispose();f.dispose();assert.equal(scene.children.length,0);
 });
}
