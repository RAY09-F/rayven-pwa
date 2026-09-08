import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/ui/vendor/three.module.min.js';
import {placeNameplate} from '../public/ui/nameplate-layout.js';

function assertClear(rect,placed){
 for(const other of placed)assert.ok(
  Math.abs(rect.x-other.x)>=(rect.w+other.w)/2+4-1e-7||
  Math.abs(rect.y-other.y)>=(rect.h+other.h)/2+3-1e-7,
  `Overlapping labels: ${JSON.stringify({rect,other})}`);
}
function assertBounds(rect,width,height){
 assert.ok(rect.x-rect.w/2>=3-1e-7);assert.ok(rect.x+rect.w/2<=width-3+1e-7);
 assert.ok(rect.y-rect.h/2>=4-1e-7);assert.ok(rect.y+rect.h/2<=height-5+1e-7);
}

for(const [viewport,width,height] of [[390,368,322],[320,298,297]]){
 test(`${viewport}px opposing advisor drags keep names separate and above gem tips`,()=>{
  const camera=new T.PerspectiveCamera(36,width/height,.1,90),distance=Math.max(15.8,16.2/(width/height));
  camera.position.set(0,3.15+Math.sin(.1)*distance,Math.cos(.1)*distance);camera.lookAt(0,3.15,0);camera.updateMatrixWorld();
  const groups=[[-.65,2.65,-.4],[4.15,1.95,0],[3.55,-1.1,.2],[-2.25,-1.1,.2],[-2.85,1.95,0]],placed=[];
  for(const [x,y,z] of groups){
   const tip=new T.Vector3(x,y+2.598,z).project(camera);
   const desired={x:(tip.x*.5+.5)*width,y:(-tip.y*.5+.5)*height-24,w:68,h:32};
   const result=placeNameplate(desired,placed,width,height);
   assertBounds(result,width,height);assertClear(result,placed);assert.ok(result.y<=desired.y+1e-7);
   placed.push(result);
  }
 });
}

test('measured dimensions determine spacing and the nearest upward placement',()=>{
 const placed=[{x:180,y:140,w:102,h:44}],desired={x:180,y:140,w:68,h:32};
 const result=placeNameplate(desired,placed,390,322);
 assertClear(result,placed);assert.deepEqual(result,{x:180,y:99,w:68,h:32});
});

test('top boundary collision resolves sideways without moving down',()=>{
 const placed=[{x:110,y:20,w:68,h:32}],desired={x:110,y:20,w:68,h:32};
 const result=placeNameplate(desired,placed,320,297);
 assertClear(result,placed);assert.equal(result.y,20);assert.equal(Math.abs(result.x-110),72);
});

test('viewport clamps offscreen rectangles and retains an unobstructed position',()=>{
 assert.deepEqual(placeNameplate({x:150,y:120,w:68,h:32},[],320,297),{x:150,y:120,w:68,h:32});
 const result=placeNameplate({x:999,y:-99,w:102,h:44},[],320,297);
 assert.deepEqual(result,{x:266,y:26,w:102,h:44});assertBounds(result,320,297);
});
