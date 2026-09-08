// Original modeled Mjolnir / astrolabe. No scene globals or image dependencies.
export function createThor(THREE, {quality = 'balanced', preview = false} = {}) {
  const root = new THREE.Group(); root.name = 'thor-reference-realm';
  const hero = new THREE.Group(); hero.name = 'thor-movable-centerpiece'; root.add(hero);
  const geometries = new Set(), materials = new Set();
  const own = g => (geometries.add(g), g);
  const material = p => { const m = new THREE.MeshStandardMaterial(p); materials.add(m); return m; };
  const steel = material({color:0x91a8b7, metalness:.57, roughness:.36});
  const edge = material({color:0xd4e0e7, metalness:.65, roughness:.24});
  const dark = material({color:0x15232e, metalness:.76, roughness:.35});
  const bronze = material({color:0x987447, metalness:.82, roughness:.32});
  const gold = material({color:0xc5a578, metalness:.82, roughness:.29});
  const leather = material({color:0x32241f, metalness:.06, roughness:.82});
  const wrap = material({color:0x786050, metalness:.22, roughness:.66});
  const blue = material({color:0x5cb8ed, emissive:0x1685ca, emissiveIntensity:.6, metalness:.35, roughness:.31});
  const mapMaterial = new THREE.LineBasicMaterial({color:0x4f9bc9, transparent:true, opacity:.39}); materials.add(mapMaterial);
  const fineMaterial = new THREE.LineBasicMaterial({color:0x8dc6e5, transparent:true, opacity:.25}); materials.add(fineMaterial);
  const seg = quality === 'low' ? 48 : 80;
  function mesh(parent, geo, mat, x=0,y=0,z=0) { const m=new THREE.Mesh(own(geo),mat);m.position.set(x,y,z);parent.add(m);return m; }
  function line(parent, points, mat=mapMaterial) { const l=new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)))),mat);parent.add(l);return l; }
  function bevelBox(parent,w,h,d,b,mat,x=0,y=0,z=0) {
    const s=new THREE.Shape(); s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b*.58,bevelSegments:2,steps:1,curveSegments:1});g.translate(0,0,-d/2+b);return mesh(parent,g,mat,x,y,z);
  }
  function ring(parent,r,t,mat,y=0) { const m=mesh(parent,new THREE.TorusGeometry(r,t,6,seg),mat,0,y);m.rotation.x=Math.PI/2;return m; }
  function cylinder(parent,r1,r2,h,mat,y) {return mesh(parent,new THREE.CylinderGeometry(r1,r2,h,seg),mat,0,y);}
  // Stacked, shadow-bearing machined metal foundation, with recessed blue seams.
  const foundation=new THREE.Group();foundation.name='thor-cartographic-dais';root.add(foundation);
  if (!preview) {
  cylinder(foundation,2.16,2.24,.14,dark,.08);
  cylinder(foundation,2.12,2.17,.055,bronze,.17);
  cylinder(foundation,2.02,2.07,.31,dark,.345);
  cylinder(foundation,2.06,2.06,.065,bronze,.51);
  cylinder(foundation,1.86,1.97,.075,steel,.57);
  cylinder(foundation,1.58,1.72,.09,dark,.645);
  cylinder(foundation,1.43,1.57,.095,bronze,.72);
  cylinder(foundation,1.4,1.4,.06,dark,.795);
  ring(foundation,2.115,.015,gold,.195);ring(foundation,2.035,.012,blue,.487);
  ring(foundation,1.82,.018,gold,.615);ring(foundation,1.42,.014,blue,.824);
  for(let i=0;i<48;i++) {const a=i*Math.PI/24;const t=mesh(foundation,new THREE.BoxGeometry(i%4===0?.028:.012,.013,i%4===0?.16:.07),i%4===0?gold:bronze,Math.sin(a)*1.91,.616,Math.cos(a)*1.91);t.rotation.y=a;}
  for(let i=0;i<12;i++) {const a=i*Math.PI/6;const support=bevelBox(foundation,.10,.30,.035,.012,bronze,Math.sin(a)*2.045,.35,Math.cos(a)*2.045);support.rotation.y=a;}
  }
  // Recessed cartography consists of layered circular grids, coast contours, and triangulated ridges.
  const chart=new THREE.Group();chart.name='thor-cartographic-projection';hero.add(chart);chart.position.y=.85;
  if (!preview) {
  for(const r of [.32,.64,1.0,1.33,1.68]) {const pts=[];for(let i=0;i<=seg;i++){const a=i*Math.PI*2/seg;pts.push([Math.sin(a)*r,.006,Math.cos(a)*r]);}line(chart,pts);}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(chart,[[.26*Math.sin(a),0,.26*Math.cos(a)],[1.74*Math.sin(a),0,1.74*Math.cos(a)]],fineMaterial);}
  for(let j=0;j<6;j++){const pts=[];for(let i=0;i<=64;i++){const a=i*Math.PI*2/64;const r=.79+j*.11+Math.sin(a*5+j*.9)*.11+Math.cos(a*9-j)*.04;pts.push([Math.sin(a)*r,.018+j*.015,Math.cos(a)*r]);}line(chart,pts,j%2?fineMaterial:mapMaterial);}
  for(let j=0;j<5;j++){const a=j*1.256+.3;const pts=[];for(let i=0;i<9;i++){const b=a+i*.055,r=1.50+Math.sin(i*1.7+j)*.09;pts.push([Math.sin(b)*r,.025+Math.pow(Math.sin(i*Math.PI/8),2)*(.09+j*.012),Math.cos(b)*r]);}line(chart,pts,fineMaterial);}
  }
  // Distinct rigid armillary bands: annular extrusions, raised edge piping, rivets, and cardinal ornaments.
  const astrolabe=new THREE.Group();astrolabe.name='thor-armillary-assembly';hero.add(astrolabe);astrolabe.position.set(0,2.03,-.32);
  const bands=[];
  function band(radius,rx,ry,rz,index){
    const group=new THREE.Group();group.name=`thor-armillary-band-${index}`;group.rotation.set(rx,ry,rz);astrolabe.add(group);
    const shape=new THREE.Shape();shape.absarc(0,0,radius,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,radius-.115,0,Math.PI*2,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,steps:1,curveSegments:seg/2});geo.translate(0,0,-.0275);mesh(group,geo,bronze);
    for(const r of [radius-.008,radius-.107])mesh(group,new THREE.TorusGeometry(r,.007,4,seg),gold,0,0,.036);
    for(let i=0;i<28;i++){const a=i*Math.PI/14;mesh(group,new THREE.SphereGeometry(.012,6,4),gold,Math.sin(a)*(radius-.057),Math.cos(a)*(radius-.057),.027);}
    bands.push({group,rx,ry,rz});return group;
  }
  band(1.43,.10,-.26,-.19,0);band(1.49,1.32,.12,.08,1).position.y=-.55;band(1.37,.27,.90,-.21,2);
  for(const [parent,a] of [[bands[0].group,-.36],[bands[1].group,1.0]]) {
    const ornament=new THREE.Group();ornament.name='thor-compass-ornament';ornament.position.set(Math.sin(a)*1.43,Math.cos(a)*1.43,.035);ornament.rotation.z=-a;parent.add(ornament);
    mesh(ornament,new THREE.OctahedronGeometry(.115,0),gold).scale.set(.65,1.8,.4);
    mesh(ornament,new THREE.OctahedronGeometry(.09,0),bronze).scale.set(1.7,.5,.35);
    mesh(ornament,new THREE.SphereGeometry(.039,10,6),edge,0,0,.04);
  }
  // Hammer local Y points from the head toward the pommel. Diagonal is explicit and stable.
  const hammer=new THREE.Group();hammer.name='thor-mjolnir';hero.add(hammer);hammer.position.set(-.39,1.64,1.00);hammer.rotation.set(-.25,-.12,-.54);hammer.scale.setScalar(.95);
  bevelBox(hammer,1.53,.86,.77,.085,steel);
  for(const x of [-.72,.72]) {bevelBox(hammer,.135,.86,.79,.034,edge,x);bevelBox(hammer,.07,.64,.805,.022,dark,x);}
  for(const z of [-.404,.404]) {
    bevelBox(hammer,1.23,.70,.035,.026,bronze,0,0,z);
    bevelBox(hammer,1.14,.62,.03,.022,dark,0,0,z+Math.sign(z)*.022);
    bevelBox(hammer,1.07,.56,.017,.018,steel,0,0,z+Math.sign(z)*.04);
    for(const x of [-.495,.495])for(const y of [-.245,.245])mesh(hammer,new THREE.SphereGeometry(.023,8,6),edge,x,y,z+Math.sign(z)*.06);
  }
  // Three interlaced original knot loops are raised bronze inlay with physical depth.
  for(let j=0;j<3;j++){const pts=[];for(let i=0;i<=48;i++){const a=i*Math.PI*2/48;const x=.13*Math.sin(a),y=.22*Math.cos(a)+.06;const rot=j*Math.PI*2/3;pts.push(new THREE.Vector3(x*Math.cos(rot)-y*Math.sin(rot),x*Math.sin(rot)+y*Math.cos(rot),.476));}mesh(hammer,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,.012,5,false),bronze);}
  // Engraved side strakes remain visible from an elevated camera.
  for(const x of [-.72,.72])for(let i=0;i<4;i++){const q=bevelBox(hammer,.048,.37,.017,.008,bronze,x,-.01,.422);q.rotation.z=(i%2?-.18:.18);q.position.y=-.20+i*.125;}
  cylinder(hammer,.185,.235,.13,bronze,.43);cylinder(hammer,.139,.165,.11,edge,.545);
  cylinder(hammer,.119,.129,1.12,leather,1.13);
  for(let i=0;i<11;i++) {const collar=mesh(hammer,new THREE.TorusGeometry(.123,.015,5,24),wrap,0,.62+i*.097);collar.rotation.set(Math.PI/2,0,i%2?.12:-.12);}
  for(const y of [.60,1.66]){cylinder(hammer,.151,.151,.046,dark,y);ring(hammer,.151,.012,bronze,y);}
  bevelBox(hammer,.32,.20,.28,.027,bronze,0,1.80);bevelBox(hammer,.23,.13,.018,.014,dark,0,1.80,.151);
  mesh(hammer,new THREE.OctahedronGeometry(.07,0),edge,0,1.80,.178).scale.set(1,1,.34);
  const strap=mesh(hammer,new THREE.TorusGeometry(.14,.022,7,28),leather,0,2.005,0);strap.scale.y=1.2;
  const energy=mesh(hammer,new THREE.OctahedronGeometry(.073,0),blue,0,-.455,.12);energy.scale.set(.7,.5,.7);
  const arcPoints=[[-.55,1.21,1.12],[-.62,1.11,1.03],[-.55,1.06,1.00],[-.66,.96,.96],[-.62,.87,.90]];
  const arcMaterial=new THREE.LineBasicMaterial({color:0xa2dfff,transparent:true,opacity:.75});materials.add(arcMaterial);
  const arc=line(hero,arcPoints,arcMaterial);arc.name='thor-working-electrical-arc';arc.visible=false;
  // Deduplicate construction geometry and batch repeated details within each moving component.
  // Instances stay local to their parent band, so independent armillary motion is preserved.
  const geometryCache=new Map(), instanceBatches=[];
  root.traverse(object=>{
    if(!object.isMesh)return;
    const g=object.geometry;
    const key=Object.keys(g.attributes).sort().map(k=>k+':'+g.attributes[k].array.join(',')).join('|')+'#'+(g.index?.array.join(',')||'');
    const existing=geometryCache.get(key);
    if(existing){object.geometry=existing;if(geometries.delete(g))g.dispose();}else geometryCache.set(key,g);
  });
  const parents=[];root.traverse(o=>{if(o.isGroup)parents.push(o);});
  for(const parent of parents){
    const batches=new Map();
    for(const child of parent.children){if(!child.isMesh||child.name)continue;const key=child.geometry.uuid+child.material.uuid;const batch=batches.get(key)||[];batch.push(child);batches.set(key,batch);}
    for(const batch of batches.values()){
      if(batch.length<3)continue;
      const instanced=new THREE.InstancedMesh(batch[0].geometry,batch[0].material,batch.length);instanced.name='thor-repeated-machined-details';
      batch.forEach((child,i)=>{child.updateMatrix();instanced.setMatrixAt(i,child.matrix);parent.remove(child);});
      instanced.instanceMatrix.needsUpdate=true;parent.add(instanced);instanceBatches.push(instanced);
    }
  }
  let motionTime=0, previousTime=null;
  function update(time,animated,state) {
    const dt=previousTime===null?0:Math.max(0,Math.min(.1,time-previousTime));previousTime=time;if(animated)motionTime+=dt;
    const mode=typeof state==='string'?state:state?.status||state?.phase||state?.state;
    const working=['thinking','working','executing','streaming','speaking'].includes(mode);
    blue.emissiveIntensity=working?.95:.48;arc.visible=working;arcMaterial.opacity=working?.65:0;
    if(!animated)return;
    const t=motionTime;hammer.position.y=1.64+Math.sin(t*1.05)*.14;hammer.rotation.y=-.12+Math.sin(t*.52)*.18;
    bands.forEach((b,i)=>{b.group.rotation.y=b.ry+Math.sin(t*(.32+i*.08)+i)*.32;b.group.rotation.z=b.rz+Math.sin(t*.045+i)*.035;});
    chart.rotation.y=t*.10;arcMaterial.opacity=working?.60+Math.sin(t*6)*.14:0;
  }
  let disposed=false;
  return {root,hero,update,stats:{design:'beveled Mjolnir and three solid annular armillary bands',preview,geometries:geometries.size,materials:materials.size},dispose(){if(disposed)return;disposed=true;instanceBatches.forEach(o=>o.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
