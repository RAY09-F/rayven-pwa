import {CAST} from './council-data.js';
import {COUNCIL_POSITIONS} from './realm-controls.js';
// Five individually selectable, modeled gems. Fixed anchors preserve council identity.
export function createRealm(T,scene,persona,{simplified=false}={}){
 const root=new T.Group();root.name='five-advisor-council';scene.add(root);
 const materials=[],geometries=[];const ownM=m=>(materials.push(m),m),ownG=g=>(geometries.push(g),g);
 const bronze=ownM(new T.MeshStandardMaterial({color:0x93734b,metalness:.72,roughness:.34}));
 const dark=ownM(new T.MeshStandardMaterial({color:persona==='odin'?0x35414a:0x101f29,metalness:.45,roughness:.57}));
 function mesh(g,m,parent=root){const o=new T.Mesh(g,m);parent.add(o);o.castShadow=true;o.receiveShadow=true;return o;}
 const disc=ownG(new T.CylinderGeometry(.60,.66,.20,32)),rim=ownG(new T.TorusGeometry(.58,.026,6,40)),foot=ownG(new T.CylinderGeometry(.72,.81,.38,32));
 const pos=[];const sides=8,rings=[[0,1.55],[.36,.83],[.31,.61],[0,0]];
 for(let j=0;j<3;j++)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;const v=(r,t)=>[Math.cos(t)*r[0],r[1]*1.16,Math.sin(t)*r[0]];const A=v(rings[j],a),B=v(rings[j],b),C=v(rings[j+1],a),D=v(rings[j+1],b);pos.push(...A,...B,...C,...B,...D,...C);}
 const gemGeometry=ownG(new T.BufferGeometry());gemGeometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));gemGeometry.computeVertexNormals();
 const edges=ownG(new T.EdgesGeometry(gemGeometry,18));
 const gems=[],pickables=[],anchors=[],tethers=[];let selected=null;
 CAST[persona].councillors.forEach((id,i)=>{
  const group=new T.Group();group.name=id+'-platform';group.position.fromArray(COUNCIL_POSITIONS[i]);root.add(group);
  const plate=mesh(disc,dark,group);plate.position.y=.57;plate.scale.y=.18;const rimLight=ownM(new T.MeshBasicMaterial({color:CAST[id].color,transparent:true,opacity:.8}));const r=mesh(rim,rimLight,group);r.rotation.x=Math.PI/2;r.position.y=.61;
  const color=new T.Color(CAST[id].color),m=ownM(new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.72),emissive:color,emissiveIntensity:.48,roughness:.19,metalness:.52,flatShading:true}));
  const g=mesh(gemGeometry,m,group);g.position.y=.80;g.rotation.y=Math.PI/8;g.userData.councillor=id;g.name=id+'-gem';gems.push(g);pickables.push(g);
  const edge=new T.LineSegments(edges,ownM(new T.LineBasicMaterial({color:color.clone().lerp(new T.Color(0xffffff),.65),transparent:true,opacity:.65})));g.add(edge);
  const core=mesh(ownG(new T.OctahedronGeometry(.13)),ownM(new T.MeshBasicMaterial({color:color.clone().lerp(new T.Color(0xffffff),.65)})),group);core.position.y=1.59;
  const tetherMaterial=ownM(new T.LineBasicMaterial({color,transparent:true,opacity:.36}));
  const p=COUNCIL_POSITIONS[i];const line=new T.Line(ownG(new T.BufferGeometry().setFromPoints([new T.Vector3(0,1.7,-.5),new T.Vector3(p[0],p[1]+.7,p[2])])),tetherMaterial);root.add(line);tethers.push(line);
  const anchor=new T.Object3D();anchor.position.set(0,.8+1.55*1.16,0);group.add(anchor);anchors.push({id,anchor,gem:g});
 });
 const seamMaterial=ownM(new T.MeshBasicMaterial({color:{thor:0x73c9ff,loki:0x79c99f,odin:0xefc581}[persona],transparent:true,opacity:.20}));
 const seam=mesh(ownG(new T.TorusGeometry(2.25,.013,4,64)),seamMaterial);seam.rotation.x=Math.PI/2;seam.position.y=.64;seam.castShadow=false;
 let disposed=false;
 return {root,pickables,anchors,gems,select(id){selected=id;gems.forEach((g,i)=>{g.material.emissiveIntensity=g.userData.councillor===id?.9:.48;tethers[i].material.opacity=g.userData.councillor===id?.85:.36;});},
 update(time,animated,state,focused=false,center={x:0,y:0,z:0}){tethers.forEach((line,i)=>{const p=gems[i].parent.position,a=line.geometry.attributes.position;a.setXYZ(0,center.x,center.y+1.7,center.z-.5);a.setXYZ(1,p.x,p.y+.7,p.z);a.needsUpdate=true;line.geometry.computeBoundingSphere();});seamMaterial.opacity=state==='error'?.55:['thinking','listening','speaking'].includes(state)?.52:focused?.42:.20;seamMaterial.color.setHex(state==='error'?0xe69873:{thor:0x73c9ff,loki:0x79c99f,odin:0xefc581}[persona]);if(animated)gems.forEach((g,i)=>{g.position.y=.80+Math.sin(time*1.25+i)*.15;g.rotation.y=Math.PI/8+time*.20+i*.25;});anchors.forEach(({anchor,gem})=>{anchor.position.copy(gem.position);anchor.position.y+=1.55*1.16;});},
 dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
