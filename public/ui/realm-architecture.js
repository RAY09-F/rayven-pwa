// Real mesh council and architectural stage. Shares the presence renderer and frame loop.
import {CAST} from './council-data.js';
export function createRealm(THREE,scene,persona,{simplified=false}={}) {
  const root=new THREE.Group();root.name='realm-architecture';scene.add(root);
  const accent={thor:0x8ccfff,loki:0xe8c85e,odin:0xdcb575}[persona];
  const metal=new THREE.MeshStandardMaterial({color:0x253442,metalness:.65,roughness:.4});
  const light=new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.6});
  const lineMat=new THREE.LineBasicMaterial({color:accent,transparent:true,opacity:.20});
  const gems=[],pickables=[],lights=[];
  function mesh(g,m,x,y,z){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;}
  // Segmented radial dais; negative space keeps the physical construction legible.
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,r=2.08;
    const tick=mesh(new THREE.BoxGeometry(.026,.015,i%4===0?.22:.10),light,Math.sin(a)*r,-.91,Math.cos(a)*r);
    tick.rotation.y=a;
  }
  for(const radius of [1.89,2.18,2.32]){
    const rail=mesh(new THREE.TorusGeometry(radius,.011,4,64),metal,0,-.91,0);rail.rotation.x=Math.PI/2;
  }
  // One luminous gateway behind the core; the centre remains open.
  for(let i=0;i<3;i++){
    const width=3.2+i*.4,y=2.9+i*.24,z=-3.4-i*.6;
    for(const x of [-width,width]){
      mesh(new THREE.BoxGeometry(.11,5,.16),metal,x,.5,z);
      mesh(new THREE.BoxGeometry(.018,4.7,.024),light,x,.5,z+.095);
    }
    mesh(new THREE.BoxGeometry(width*2,.11,.16),metal,0,y,z);
  }
  const positions=[[-.1,2.58,-.15],[2.35,1.10,.10],[1.95,-.48,1.4],[-1.95,-.48,1.4],[-2.35,1.10,.10]];
  CAST[persona].councillors.forEach((id,i)=>{
    const p=CAST[id],color=new THREE.Color(p.color),[x,y,z]=positions[i];
    const material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.24,metalness:.28,roughness:.23,flatShading:true});
    const gem=mesh(new THREE.OctahedronGeometry(.28,0),material,x,y,z);gem.scale.y=1.6;gem.userData.councillor=id;gem.name=p.name;gems.push(gem);pickables.push(gem);
    const rim=mesh(new THREE.TorusGeometry(.34,.015,5,28),metal,x,y-.5,z);rim.rotation.x=Math.PI/2;
    const pedestal=mesh(new THREE.CylinderGeometry(.32,.38,.085,24),metal,x,y-.57,z);
    pedestal.userData.councillor=id;pickables.push(pedestal);
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.3,-.1),new THREE.Vector3(x,y-.3,z)]);
    root.add(new THREE.Line(geometry,lineMat));
    if(!simplified){const glow=new THREE.PointLight(color,.3,1.2,2);glow.position.set(x,y,z);root.add(glow);lights.push(glow);}
  });
  const dustGeometry=new THREE.BufferGeometry(),dustPosition=new Float32Array(48*3);
  for(let i=0;i<48;i++){dustPosition[i*3]=Math.sin(i*47.7)*4.8;dustPosition[i*3+1]=Math.cos(i*21.3)*3+1;dustPosition[i*3+2]=-1-(i%11)*.5;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPosition,3));
  const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:accent,size:.019,transparent:true,opacity:.42,sizeAttenuation:true}));dust.visible=!simplified;root.add(dust);
  let selected=null;
  return {root,pickables,
    select(id){selected=id;gems.forEach(g=>{g.material.emissiveIntensity=g.userData.councillor===selected ? .75 : .24;});},
    update(time,animated,state){
      if(!animated)return;
      gems.forEach((g,i)=>{g.rotation.y=time*.12+i;g.position.y=positions[i][1]+Math.sin(time*.55+i)*.035;});
      dust.rotation.y=Math.sin(time*.03)*.08;
      light.opacity=state==='thinking'?.4+Math.sin(time*1.6)*.16:.55;
    },
    dispose(){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());scene.remove(root);}
  };
}
