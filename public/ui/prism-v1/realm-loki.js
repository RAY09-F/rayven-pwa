// Local geometric interpretation of the golden prism foundry; no image assets.
export function createLoki(THREE, {quality = 'balanced', preview = false} = {}) {
  const root = new THREE.Group(); root.name = 'loki-foundry';
  const hero = new THREE.Group(); hero.name = 'loki-movable-centerpiece'; root.add(hero);
  const geometries = new Set(), materials = new Set();
  const mat = options => { const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m; };
  const bronze = mat({color:0xa77b32, metalness:.8, roughness:.26});
  const bevelGold = mat({color:0xd7ae52, metalness:.76, roughness:.22});
  const dark = mat({color:0x0c2527, metalness:.78, roughness:.22});
  const emerald = mat({color:0x087a4e, emissive:0x063b22, emissiveIntensity:.13, metalness:.50, roughness:.25});
  const greenEdge = mat({color:0x5cc799, emissive:0x218d64, emissiveIntensity:.24, metalness:.48, roughness:.3});
  const coreMat = mat({color:0xffe481, emissive:0xffc737, emissiveIntensity:.55, roughness:.23, metalness:.18});
  function mesh(g,m,parent,name,x=0,y=0,z=0) {
    geometries.add(g); const o=new THREE.Mesh(g,m); o.name=name; o.position.set(x,y,z); parent.add(o); return o;
  }
  const detail=quality==='high'?96:64;
  function ring(parent,name,r,y,width,depth,m) {
    const profile=[new THREE.Vector2(r-width,y-depth/2),new THREE.Vector2(r-.012,y-depth/2),new THREE.Vector2(r,y-depth/2+.012),new THREE.Vector2(r,y+depth/2-.012),new THREE.Vector2(r-.012,y+depth/2),new THREE.Vector2(r-width,y+depth/2),new THREE.Vector2(r-width,y-depth/2)];
    return mesh(new THREE.LatheGeometry(profile,detail),m,parent,name);
  }
  const dais = new THREE.Group(); dais.name='loki-concentric-dais'; root.add(dais);
  mesh(new THREE.CylinderGeometry(2.16,2.24,.12,detail),dark,dais,'polished-bottom-plinth',0,.10);
  ring(dais,'outer-bronze-lip',2.25,.15,.065,.045,bronze);
  mesh(new THREE.CylinderGeometry(1.94,2.08,.1,detail),dark,dais,'inset-polished-disc',0,.205);
  ring(dais,'etched-inner-circle',1.82,.261,.018,.016,bronze);
  ring(dais,'emerald-channel',1.95,.257,.016,.014,greenEdge);
  mesh(new THREE.CylinderGeometry(.98,1.20,.15,detail),dark,dais,'cradle-first-step',0,.33);
  ring(dais,'first-step-bronze',1.16,.31,.06,.04,bronze);
  mesh(new THREE.CylinderGeometry(.89,1.0,.18,detail),dark,dais,'cradle-second-step',0,.485);
  ring(dais,'second-step-gold',1.00,.445,.055,.035,bevelGold);
  ring(dais,'cradle-crown',.94,.585,.065,.055,bronze);
  ring(dais,'inset-emerald-seal',.72,.584,.021,.018,greenEdge);
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/16;
    const tick=mesh(new THREE.BoxGeometry(.017,.008,i%4===0?.12:.06),bronze,dais,'radial-engraving-'+i,Math.sin(a)*2.04,.267,Math.cos(a)*2.04); tick.rotation.y=a;
  }
  // Thick, pointed structural blades share a low cradle and fan outward behind the stone.
  const backing = new THREE.Group(); backing.name='loki-supported-emerald-fins'; root.add(backing);
  function fin(side,index) {
    const base=.50+index*.22, tip=1.30+index*.24, height=2.50+index*.37;
    const shape=new THREE.Shape(); shape.moveTo(side*base,.55); shape.lineTo(side*(base+.32),.55); shape.lineTo(side*(tip+.035),height); shape.lineTo(side*(tip-.40),height-.38); shape.lineTo(side*(base-.18),1.24); shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025});
    mesh(g,[emerald,dark],backing,'emerald-fin-'+side+'-'+index,0,0,-.57-index*.10);
    // A narrow raised bronze rib follows the blade spine, visibly anchored to the base.
    const start=new THREE.Vector3(side*(base+.08),.62,-.52-index*.10),end=new THREE.Vector3(side*(tip-.025),height-.15,-.52-index*.10);
    const delta=end.clone().sub(start);
    const rib=mesh(new THREE.CylinderGeometry(.014,.025,delta.length(),5),bevelGold,backing,'fin-spine-'+side+'-'+index);
    rib.position.copy(start).addScaledVector(delta,.5); rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  for(const side of [-1,1])for(let i=0;i<3;i++)fin(side,i);
  const crystal = new THREE.Group(); crystal.name='loki-floating-gold-crystal'; crystal.position.y=2.24; crystal.scale.setScalar(1.18); hero.add(crystal);
  // Hand-built octagonal tiers, alternating belt diagonals, and flat face normals.
  // The entire diamond is 2.4 units tall. Opaque facets avoid transmission sorting artifacts.
  const facetMaterials=[0xa65302,0xffcf18,0x643007,0xd99103,0xffe44c,0x814403].map(color=>mat({color,emissive:color,emissiveIntensity:.32,metalness:.57,roughness:.16,flatShading:true}));
  const tiers=[[-1.20,0],[-.38,.59],[-.04,.78],[.22,.65],[1.20,0]], verts=[], groups=[];
  const point=(tier,i)=>{const [y,r]=tiers[tier],a=(i%8)*Math.PI/4+Math.PI/8;return [Math.sin(a)*r,y,Math.cos(a)*r];};
  function face(a,b,c,material){const start=verts.length/3;verts.push(...a,...b,...c);groups.push([start,3,material]);}
  for(let t=0;t<4;t++)for(let i=0;i<8;i++) {
    const a=point(t,i),b=point(t,i+1),c=point(t+1,i+1),d=point(t+1,i);
    if(t===0||t===3) {
      const p=t===0?a:c, left=t===0?c:a, right=t===0?d:b;
      const middle=[(p[0]*.45+left[0]*.275+right[0]*.275)*.94,p[1]*.45+left[1]*.275+right[1]*.275,(p[2]*.45+left[2]*.275+right[2]*.275)*.94];
      face(p,left,middle,(i+2)%6);face(left,right,middle,(i+4)%6);face(right,p,middle,(i+1)%6);
    }
    else {face(a,b,d,(i+t)%6);face(b,c,d,(i+t+2)%6);}
  }
  const crystalGeometry=new THREE.BufferGeometry(); crystalGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); for(const g of groups)crystalGeometry.addGroup(...g); crystalGeometry.computeVertexNormals();
  mesh(crystalGeometry,facetMaterials,crystal,'deliberate-belt-facet-solid');
  // A small raised central luminous inclusion is an artistic inner-core approximation.
  // It follows the front face, keeping the rest of the stone richly amber and readable.
  const coreVertices=[];
  for(let t=0;t<4;t++) {
    const [ya,ra]=tiers[t],[yb,rb]=tiers[t+1],wa=ra===0?0:.035,wb=rb===0?0:.035;
    const za=ra*Math.cos(Math.PI/8)+.015,zb=rb*Math.cos(Math.PI/8)+.015;
    coreVertices.push(-wa,ya,za,wa,ya,za,wb,yb,zb,-wa,ya,za,wb,yb,zb,-wb,yb,zb);
  }
  const inclusionGeometry=new THREE.BufferGeometry();inclusionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coreVertices,3));inclusionGeometry.computeVertexNormals();
  mesh(inclusionGeometry,coreMat,crystal,'narrow-lemon-core-inclusion');
  // Six selected crown/belt ridges catch the lemon light; no wireframe shell.
  for(const i of [0,2,7])for(const ends of [[4,3],[2,0]]) {
    const a=new THREE.Vector3(...point(ends[0],i)).multiplyScalar(1.006),b=new THREE.Vector3(...point(ends[1],i)).multiplyScalar(1.006),d=b.clone().sub(a);
    const seam=mesh(new THREE.CylinderGeometry(.009,.009,d.length(),4),coreMat,crystal,'selective-facet-ridge-'+i+'-'+ends[0]);seam.position.copy(a).addScaledVector(d,.5);seam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  }
  const orbit = new THREE.Group(); orbit.name='loki-bronze-armillary'; orbit.position.y=1.97; hero.add(orbit);
  const bands=[];
  for(let i=0;i<3;i++) {
    const pivot=new THREE.Group();pivot.name='loki-band-axis-'+i;orbit.add(pivot);bands.push(pivot);
    pivot.rotation.set([.12,.63,-.43][i],0,[.12,-.31,.36][i]);
    ring(pivot,'solid-bronze-orbit-'+i,1.22+i*.15,(i-1)*.12,.13,.115,i===0?bevelGold:bronze);
    for(const sign of [-1,1])mesh(new THREE.SphereGeometry(.055,8,6),bevelGold,pivot,'band-bearing-'+sign,sign*(1.22+i*.15),(i-1)*.12,0);
  }
  for(const sign of [-1,1]) {
    const foot=mesh(new THREE.CylinderGeometry(.045,.08,1.5,6),bronze,backing,'cradle-band-support-'+sign,sign*1.02,1.30,-.08);foot.rotation.z=-sign*.20;
    mesh(new THREE.SphereGeometry(.10,10,8),dark,backing,'support-bearing-'+sign,sign*1.16,2.02,-.08);
  }
  if(preview){dais.visible=false;backing.visible=false;}
  let clock=0,lastTime=null,disposed=false;
  function update(time,animated,state) {
    const now=Number.isFinite(time)?time:0;
    const delta=lastTime===null?0:Math.max(0,Math.min(.1,now-lastTime)); lastTime=now;
    if(animated)clock+=delta;
    crystal.position.y=2.24+Math.sin(clock*1.1)*.16;
    crystal.rotation.y=Math.sin(clock*.42)*.30;
    for(let i=0;i<bands.length;i++)bands[i].rotation.y=clock*[.22,-.16,.12][i];
    const id=typeof state==='string'?state:state?.id;
    const active=id==='thinking'||id==='speaking'||id==='listening';
    coreMat.emissiveIntensity=active?.68+.07*Math.sin(clock*1.5):.55;
    greenEdge.emissiveIntensity=active?.32:.24;
  }
  return {root,hero,update,stats:{kind:'gold-faceted-crystal',crystalHeight:2.4,facetTriangles:80,orbitBands:3,preview},dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.removeFromParent();root.clear();}};
}
