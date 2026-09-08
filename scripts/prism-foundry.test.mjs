import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/ui/prism-v1/vendor/three.module.min.js';
import {buildPrismFoundry,PRISM_AGENT_IDS} from '../public/ui/prism-v1/prism-foundry-model.js';

test('Prism reference geometry and optical materials are actual WebGL meshes',()=>{
 const m=buildPrismFoundry(T,{random:()=>.5});assert.equal(T.REVISION,'184');assert.equal(m.stations.length,5);assert.equal(m.pickables.length,6);
 assert.equal(m.root.getObjectByName('dais_base').geometry.parameters.radiusBottom,3.2);assert.equal(m.shards.length,6);assert.equal(m.dust.geometry.attributes.position.count,420);
 for(const mesh of m.pickables){const p=mesh.material;assert.ok(p.isMeshPhysicalMaterial);assert.equal(p.transmission,1);assert.equal(p.dispersion,.35);assert.equal(p.ior,2.42);assert.equal(p.thickness,.8);assert.equal(p.roughness,0);assert.equal(p.side,T.FrontSide);}
 assert.equal(m.M.gold.color.getHex(),0xffc21a);assert.deepEqual(m.stations.map(s=>PRISM_AGENT_IDS[s.a.key]),['miss_minutes','hunter_b15','mobius','sylvie','kang']);m.dispose();
});
test('animation has the same elapsed-time result across frame rates; still mode freezes',()=>{
 const a=buildPrismFoundry(T,{random:()=>.5}),b=buildPrismFoundry(T,{random:()=>.5});for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<30;i++)b.update(1/30);
 assert.ok(a.core.position.distanceTo(b.core.position)<1e-10);assert.ok(Math.abs(a.core.rotation.y-b.core.rotation.y)<1e-10);
 const before=a.core.matrix.clone();a.core.updateMatrix();const frozen=a.core.matrix.clone();a.update(1,{animated:false});a.core.updateMatrix();assert.deepEqual(a.core.matrix.elements,frozen.elements);a.dispose();b.dispose();
});
test('hover and pulse activate and decay; disposal frees every resource exactly once',()=>{
 const m=buildPrismFoundry(T,{random:()=>.5}),s=m.stations[0];m.update(.5,{hover:'amber'});assert.ok(s.hot>.9);assert.ok(s.gm.scale.x>1.3);m.pulse();m.update(.01);assert.ok(m.pulseValue>.9);for(let i=0;i<10;i++)m.update(.5);assert.ok(m.pulseValue<.001);assert.ok(s.hot<.001);
 const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const x of Array.isArray(o.material)?o.material:o.material?[o.material]:[])resources.add(x);});let count=0;resources.forEach(r=>r.addEventListener('dispose',()=>count++));m.dispose();m.dispose();assert.equal(count,resources.size);
});
