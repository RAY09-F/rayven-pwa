// Procedural, local, genuinely three-dimensional persona portraits.
// The application owns animation timing. No camera, network, audio or task state is invented here.
export function createHologramPersona(THREE, scene, persona, {quality='balanced'}={}) {
  const identity=['thor','loki','odin'].includes(persona)?persona:'thor';
  const root=new THREE.Group();root.name=`hologram-persona-${identity}`;scene.add(root);
  const primary=new THREE.Color({thor:0x71cfff,loki:0xffd76b,odin:0xf2c580}[identity]);
  const secondary=new THREE.Color({thor:0xc8f1ff,loki:0x57e6b1,odin:0xfff0d4}[identity]);
  const bright=primary.clone().lerp(new THREE.Color(0xffffff),.65);
  const surfaceMaterial=new THREE.MeshBasicMaterial({color:primary,transparent:true,opacity:.038,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const edgeMaterial=new THREE.LineBasicMaterial({color:primary,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending});
  const featureMaterial=new THREE.LineBasicMaterial({color:bright,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending});
  const secondaryMaterial=new THREE.LineBasicMaterial({color:secondary,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending});
  const pieces=[],featurePaths=[];let disposed=false;
  function piece(geometry,{position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],wire=true,tint=0}={}) {
    const mesh=new THREE.Mesh(geometry,surfaceMaterial);mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);mesh.updateMatrix();root.add(mesh);
    pieces.push({geometry,matrix:mesh.matrix.clone(),tint});
    if(wire){const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,22),edgeMaterial);outline.position.copy(mesh.position);outline.scale.copy(mesh.scale);outline.rotation.copy(mesh.rotation);root.add(outline);}
    return mesh;
  }
  function path(coordinates,{accent=false,closed=false}={}) {
    const pts=coordinates.map(p=>new THREE.Vector3(...p));if(closed)pts.push(pts[0].clone());
    const geometry=new THREE.BufferGeometry().setFromPoints(pts),line=new THREE.Line(geometry,accent?secondaryMaterial:featureMaterial);root.add(line);featurePaths.push({pts,tint:accent?1:2});return line;
  }
  function ringBody(rings,segments=20) {
    const positions=[],indices=[];
    rings.forEach(([y,width,depth,front])=>{for(let j=0;j<segments;j++){const a=j/segments*Math.PI*2;positions.push(Math.sin(a)*width,y,Math.cos(a)*depth+front);}});
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<segments;j++){const a=r*segments+j,b=r*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
    // Ends close the portrait volume; no geometry relies on a painted frontal image.
    for(const r of [0,rings.length-1])for(let j=1;j<segments-1;j++)indices.push(r*segments,r*segments+j,r*segments+j+1);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function tube(coords,radius=.025,tint=0,segments=24) {
    return piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p))),segments,radius,5,false),{wire:false,tint});
  }
  function horn(coords,radii,tint=0) {
    const curve=new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p))),steps=32,sides=8,frames=curve.computeFrenetFrames(steps,false),vertices=[],indices=[];
    for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPoint(t),k=t*(radii.length-1),r=THREE.MathUtils.lerp(radii[Math.floor(k)],radii[Math.min(radii.length-1,Math.floor(k)+1)],k%1);
      for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);vertices.push(q.x,q.y,q.z);}
    }
    for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return piece(g,{tint});
  }
  // Chest tapers into a projected lower edge, while shoulder armour frames the face.
  const lean=identity==='loki';
  piece(ringBody([[-1.28,.54,.23,-.06],[-1.02,.91,.32,-.02],[-.52,lean?1.15:1.30,.42,-.08],[-.23,.72,.32,-.04]],16));
  for(const side of [-1,1]){
    piece(new THREE.IcosahedronGeometry(1,0),{position:[side*(lean?1.00:1.14),-.38,-.02],scale:[lean?.44:.52,.40,.43],rotation:[.12,side*.2,side*-.3],tint:1});
    path([[side*.14,-.40,.37],[side*.58,-.65,.32],[side*1.30,-.48,.18]],{accent:true});
    path([[side*.14,-.46,.39],[side*.57,-.79,.33],[side*.76,-1.10,.22]]);
  }
  piece(new THREE.CylinderGeometry(.25,.36,.6,12,2),{position:[0,.01,-.04],wire:false});
  // Rings deliberately form a human chin, jaw, cheeks, temples and forehead.
  const w=lean?.88:identity==='thor'?1.06:1;
  piece(ringBody([[.19,.14,.20,.07],[.27,.29,.29,.04],[.43,.40,.35,0],[.69,.43,.36,-.025],[.96,.44,.37,-.035],[1.22,.42,.36,-.045],[1.43,.33,.29,-.06],[1.53,.11,.15,-.07]],24),{scale:[w,1,1],wire:false});
  // Faceted nose ridge and cheek planes remain visible when particles are still.
  piece(new THREE.ConeGeometry(.12,.40,4),{position:[0,.76,.41],rotation:[Math.PI,0,0],scale:[.85,1,1.42],tint:2});
  for(const side of [-1,1]){
    path([[side*.40*w,.91,.18],[side*.26*w,1.02,.30],[side*.075,.98,.36]]);
    path([[side*.37*w,.69,.22],[side*.27*w,.50,.28],[side*.12,.29,.24]]);
    path([[side*.12,.60,.34],[side*.20,.51,.30],[side*.29,.46,.23]],{accent:true});
  }
  path([[-.14,.46,.33],[0,.44,.355],[.14,.46,.33]]);
  path([[0,1.11,.335],[0,.82,.49],[.065,.66,.42],[0,.64,.43],[-.065,.66,.42]]);
  // Narrow illuminated eye apertures, not a generic pair of floating light balls.
  const eyes=new THREE.Group();eyes.name='eye-apertures';root.add(eyes);
  for(const side of [-1,1]){
    const eye=path([[side*.085,.91,.365],[side*.17,.93,.382],[side*.29,.90,.32],[side*.20,.875,.365],[side*.085,.91,.365]],{accent:identity==='loki'});
    if(identity==='odin'&&side===-1){eye.visible=false;featurePaths.pop();path([[-.075,1.035,.37],[-.35,.845,.34],[-.40,.82,.26]],{accent:true});piece(new THREE.BoxGeometry(.25,.10,.025),{position:[-.205,.908,.366],rotation:[0,.15,-.17],wire:false});}
    else {tube([[side*.11,.906,.378],[side*.19,.913,.389],[side*.27,.901,.347]],.015,2,8);}
  }
  if(identity==='thor') {
    // Broad storm helmet, swept temple wings and a short, strong beard.
    piece(ringBody([[1.03,.46,.37,-.03],[1.28,.46,.37,-.04],[1.51,.30,.26,-.06],[1.65,.04,.08,-.04]],16));
    path([[-.43,1.15,.16],[-.26,1.14,.32],[0,1.23,.40],[.26,1.14,.32],[.43,1.15,.16]]);
    for(const side of [-1,1]){
      for(let j=0;j<3;j++)horn([[side*.38,1.18+j*.06,-.03],[side*(.63+j*.10),1.46+j*.08,-.04],[side*(.77+j*.12),1.82+j*.11,-.09]],[.09,.055,.002],1);
      horn([[side*.36,.57,-.02],[side*.30,.22,.11],[side*.10,.06,.20]],[.10,.13,.015]);
      path([[side*.27,-.38,.45],[side*.46,-.50,.43],[side*.29,-.57,.44],[side*.40,-.73,.39]],{accent:true});
    }
    piece(new THREE.OctahedronGeometry(.15),{position:[0,-.45,.43],scale:[.70,1.15,.45],tint:2});
  } else if(identity==='loki') {
    // Swept physical horns create Loki's unmistakable outline above an angular face.
    piece(ringBody([[1.10,.42,.35,-.035],[1.24,.42,.34,-.04],[1.41,.29,.26,-.06]],16));
    for(const side of [-1,1]){
      horn([[side*.34,1.22,-.045],[side*.62,1.49,-.12],[side*.67,1.96,-.15],[side*.51,2.26,-.07],[side*.37,2.35,.015]],[.135,.105,.069,.026,.001]);
      horn([[side*.37,1.05,-.20],[side*.44,.58,-.25],[side*.48,.05,-.26]],[.12,.105,.008],1);
      path([[side*.39,1.12,.18],[side*.19,1.18,.31],[0,1.08,.39]],{accent:true});
      path([[side*.33,.18,.11],[side*.57,-.30,.35],[side*.26,-.55,.42]],{accent:true});
    }
    piece(new THREE.OctahedronGeometry(.13),{position:[0,1.23,.32],scale:[.55,1.5,.35],tint:1});
  } else {
    // Odin's asymmetrical eye, longer beard and architectural crown read in silhouette.
    for(let i=0;i<9;i++){
      const x=(i-4)*.068,end=-.29+Math.abs(i-4)*.067;
      horn([[x,.49,.22],[x*1.07,.22,.30],[x*.45,end,.18]],[.051,.046,.003],i%3===0?2:0);
    }
    for(const side of [-1,1]){
      horn([[side*.40,1.16,-.21],[side*.47,.61,-.29],[side*.49,.01,-.25]],[.12,.13,.006]);
      path([[side*.32,.77,.26],[side*.24,.72,.335]],{accent:true});
      path([[side*.32,.72,.26],[side*.25,.67,.335]],{accent:true});
    }
    piece(ringBody([[1.15,.43,.35,-.04],[1.32,.43,.35,-.04]],16));
    for(let i=-2;i<=2;i++){
      const x=i*.16,h=.39-Math.abs(i)*.065;
      piece(new THREE.ConeGeometry(.065,h,4),{position:[x,1.33+h/2,.24-Math.abs(i)*.07],tint:2});
    }
    path([[-.41,1.24,.16],[0,1.30,.34],[.41,1.24,.16]]);
    piece(new THREE.OctahedronGeometry(.18),{position:[0,-.64,.37],scale:[.55,1,.3],tint:2});
  }
  // Collect area-weighted triangles once. Point distribution is stable across reloads.
  const triangles=[];let totalArea=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
  for(const part of pieces){const p=part.geometry.attributes.position,idx=part.geometry.index,n=idx?idx.count:p.count;
    for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(part.matrix);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(part.matrix);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(part.matrix);
      const area=u.subVectors(b,a).cross(v.subVectors(c,a)).length()*.5;if(area<1e-9)continue;totalArea+=area;triangles.push({a:a.clone(),b:b.clone(),c:c.clone(),end:totalArea,tint:part.tint});
    }
  }
  let seed={thor:731,loki:1597,odin:3571}[identity];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const maximum=12000,positions=new Float32Array(maximum*3),colors=new Float32Array(maximum*3),p=new THREE.Vector3();
  function colorFor(tint){return tint===1?secondary:tint===2?bright:primary;}
  for(let i=0;i<maximum;i++){
    let tint=0;
    if(i%7===0&&featurePaths.length){const f=featurePaths[Math.floor(random()*featurePaths.length)],k=Math.floor(random()*(f.pts.length-1));p.copy(f.pts[k]).lerp(f.pts[k+1],random());tint=f.tint;}
    else {const target=random()*totalArea;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<target)lo=mid+1;else hi=mid;}const t=triangles[lo],r=Math.sqrt(random()),s=random();p.copy(t.a).multiplyScalar(1-r).addScaledVector(t.b,r*(1-s)).addScaledVector(t.c,r*s);tint=t.tint;}
    positions.set([p.x,p.y,p.z],i*3);const color=colorFor(tint).clone().multiplyScalar(.6+random()*.4);colors.set([color.r,color.g,color.b],i*3);
  }
  const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));pointGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pointGeometry.computeBoundingSphere();pointGeometry.computeBoundingBox();
  const spriteSize=32,spriteData=new Uint8Array(spriteSize*spriteSize*4);
  for(let y=0;y<spriteSize;y++)for(let x=0;x<spriteSize;x++){const d=Math.hypot((x+.5)/spriteSize*2-1,(y+.5)/spriteSize*2-1),i=(y*spriteSize+x)*4;spriteData.set([255,255,255,Math.round(Math.max(0,1-d)**2*255)],i);}
  const sprite=new THREE.DataTexture(spriteData,spriteSize,spriteSize,THREE.RGBAFormat);sprite.needsUpdate=true;
  const pointMaterial=new THREE.PointsMaterial({size:.033,map:sprite,vertexColors:true,transparent:true,opacity:.90,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  const points=new THREE.Points(pointGeometry,pointMaterial);points.name=`${identity}-hologram-particles`;root.add(points);
  // A one-shot assembly retains the exact sampled portrait as its resting pose.
  // Buffers and deterministic phases are allocated once, never in the render loop.
  const restingPositions=positions.slice(),assemblyPhase=new Float32Array(maximum);
  for(let i=0;i<maximum;i++)assemblyPhase[i]=Math.sin(i*2.39996323);
  let assembled=false,assemblyProgress=0;
  const assemblyDuration=.9;
  // The brief assembly can extend beyond the final portrait's bounding sphere.
  const restingRadius=pointGeometry.boundingSphere.radius;
  pointGeometry.boundingSphere.radius=restingRadius+.45;
  function assemble(t,animated){
    if(assembled)return;
    // Reduced motion or an elapsed/suspended intro completes immediately and never replays.
    assemblyProgress=animated?Math.max(assemblyProgress,Math.min(1,Math.max(0,t)/assemblyDuration)):1;
    if(assemblyProgress>=1){positions.set(restingPositions);pointGeometry.attributes.position.needsUpdate=true;pointGeometry.boundingSphere.radius=restingRadius;assembled=true;return;}
    const remaining=(1-assemblyProgress)**3;
    for(let i=0;i<maximum;i++){
      const j=i*3,x=restingPositions[j],y=restingPositions[j+1],z=restingPositions[j+2];
      const phase=assemblyPhase[i],angle=remaining*(.19+phase*.13),co=Math.cos(angle),si=Math.sin(angle),spread=1+remaining*.055;
      positions[j]=(x*co-z*si)*spread;
      positions[j+1]=y*(1-remaining*.10)+phase*remaining*.16;
      positions[j+2]=(x*si+z*co)*spread;
    }
    pointGeometry.attributes.position.needsUpdate=true;
  }
  // One thin spatial sweep communicates a state change, not a simulated computation.
  const scan=path([[-1.30,0,.10],[-.48,0,.39],[0,0,.46],[.48,0,.39],[1.30,0,.10]],{accent:true});scan.name='holographic-scan';scan.visible=false;
  let currentQuality;
  function setQuality(value){currentQuality=['high','balanced','low'].includes(value)?value:'balanced';const count={high:12000,balanced:7000,low:3600}[currentQuality];pointGeometry.setDrawRange(0,count);pointMaterial.size=currentQuality==='low'?.041:.033;}
  setQuality(quality);
  return {root,points,
    update(time,animated,state='idle'){
      if(disposed)return;
      const t=Number.isFinite(time)?time:0;
      assemble(t,animated);
      root.rotation.y=animated?Math.sin(t*.18)*.035:0;
      root.position.y=animated?Math.sin(t*.50)*.018:0;
      const active=['listening','thinking','speaking','connecting'].includes(state);
      // Speaking is a bounded state animation, not claimed microphone/output amplitude.
      pointMaterial.opacity=animated && active ? .87+Math.sin(t*(state==='speaking'?3:1.6))*.075 : .9;
      featureMaterial.opacity=state==='error' ? .48 : active ? .94 : .78;
      scan.visible=animated&&['thinking','connecting'].includes(state);
      scan.position.y=.52+Math.sin(t*.85)*.98;
    },
    setQuality,
    stats(){return {persona:identity,quality:currentQuality,particles:pointGeometry.drawRange.count,maximumParticles:maximum,surfaceTriangles:triangles.length,featurePaths:featurePaths.length,bounds:pointGeometry.boundingBox.clone()};},
    dispose(){if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());sprite.dispose();scene.remove(root);}
  };
}
