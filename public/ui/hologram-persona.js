// Procedural, local, genuinely three-dimensional persona portraits.
// The application owns animation timing. No camera, network, audio or task state is invented here.
export function createHologramPersona(THREE, scene, persona, {quality='balanced'}={}) {
  const identity=['thor','loki','odin'].includes(persona)?persona:'thor';
  const root=new THREE.Group();root.name=`hologram-persona-${identity}`;scene.add(root);
  const primary=new THREE.Color({thor:0x71cfff,loki:0xffd76b,odin:0xf2c580}[identity]);
  const secondary=new THREE.Color({thor:0xc8f1ff,loki:0x57e6b1,odin:0xfff0d4}[identity]);
  const bright=primary.clone().lerp(new THREE.Color(0xffffff),.65);
  // Opaque planes establish the sculpture and occlude rear particles. Light is
  // carried by a few inlaid features, never by every edge of every triangle.
  const surfaceMaterial=new THREE.MeshStandardMaterial({color:{thor:0x193f59,loki:0x80612b,odin:0x725537}[identity],roughness:.66,metalness:.32,flatShading:true});
  const faceMaterial=new THREE.MeshStandardMaterial({color:{thor:0x507e94,loki:0x9d905b,odin:0x9a8b72}[identity],roughness:.7,metalness:.24,flatShading:false});
  const armourMaterial=new THREE.MeshStandardMaterial({color:{thor:0x133247,loki:0x103f35,odin:0x42433d}[identity],roughness:.6,metalness:.4,flatShading:true});
  const brightMaterial=new THREE.MeshStandardMaterial({color:secondary,roughness:.42,metalness:.52,flatShading:true});
  const shadowMaterial=new THREE.MeshStandardMaterial({color:0x07141c,roughness:.95,metalness:.05,flatShading:true});
  const eyeMaterial=new THREE.MeshBasicMaterial({color:bright});
  const surfaceMaterials=[surfaceMaterial,armourMaterial,brightMaterial];
  // r185 standard lighting remains intact. Local surface bands and grazing rim
  // emission identify projected matter without making the depth layer transparent.
  const hologramStrength={value:1};
  for(const material of [...surfaceMaterials,faceMaterial]){
    material.userData.bifrostSurface=true;
    material.onBeforeCompile=shader=>{
      shader.uniforms.bifrostColor={value:primary};shader.uniforms.bifrostStrength=hologramStrength;
      shader.vertexShader='varying vec3 vBifrostPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBifrostPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader='varying vec3 vBifrostPosition;\nuniform vec3 bifrostColor;\nuniform float bifrostStrength;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        float bifrostRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
        float bifrostBand = smoothstep(0.72, 0.98, sin(vBifrostPosition.y * 156.0));
        outgoingLight *= 0.90 + bifrostBand * 0.08;
        outgoingLight += bifrostColor * bifrostStrength * (0.024 + bifrostRim * 0.38 + bifrostBand * 0.038);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=> 'bifrost-surface-r185-v1';
  }
  const edgeMaterial=new THREE.LineBasicMaterial({color:primary,transparent:true,opacity:.15,depthWrite:false,blending:THREE.AdditiveBlending});
  const featureMaterial=new THREE.LineBasicMaterial({color:bright,transparent:true,opacity:.52,depthWrite:false,blending:THREE.AdditiveBlending});
  const secondaryMaterial=new THREE.LineBasicMaterial({color:secondary,transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending});
  const pieces=[],featurePaths=[];let disposed=false;
  function piece(geometry,{position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],wire=false,tint=0,material=null,name=''}={}) {
    const mesh=new THREE.Mesh(geometry,material||surfaceMaterials[tint]||surfaceMaterial);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);mesh.updateMatrix();root.add(mesh);
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
    for(const r of [0,rings.length-1])for(let j=1;j<segments-1;j++){const a=r*segments,b=a+j,c=a+j+1;indices.push(...(r===0?[a,c,b]:[a,b,c]));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function tube(coords,radius=.025,tint=0,segments=24) {
    return piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p))),segments,radius,5,false),{wire:false,tint,material:eyeMaterial,name:'luminous-eye'});
  }
  function horn(coords,radii,tint=0) {
    const curve=new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p))),steps=20,sides=8,frames=curve.computeFrenetFrames(steps,false),vertices=[],indices=[];
    for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPoint(t),k=t*(radii.length-1),r=THREE.MathUtils.lerp(radii[Math.floor(k)],radii[Math.min(radii.length-1,Math.floor(k)+1)],k%1);
      for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);vertices.push(q.x,q.y,q.z);}
    }
    for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return piece(g,{tint,name:'tapered-sculptural-detail'});
  }
  function solidFace(vertices,indices,options={}) {
    if(options.thickness){
      const n=vertices.length,back=vertices.map(([x,y,z])=>[x,y,z-options.thickness]),front=indices.slice();
      vertices=[...vertices,...back];
      for(let i=0;i<front.length;i+=3)indices.push(front[i]+n,front[i+2]+n,front[i+1]+n);
      const winding=vertices.slice(0,4).reduce((sum,p,i)=>{const q=vertices[(i+1)%4];return sum+p[0]*q[1]-q[0]*p[1];},0);
      for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(...(winding>0?[i,j+n,j,i,i+n,j+n]:[i,j,j+n,i,j+n,i+n]));}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.setIndex(indices);g.computeVertexNormals();return piece(g,options);
  }
  // Overlapping armour plates connect shoulders to the raised collar. The
  // mass is carried by long chamfered planes, rather than disconnected solids.
  const lean=identity==='loki';
  piece(ringBody([[-1.43,.48,.21,-.03],[-1.18,.77,.30,-.03],[-.62,lean?1.06:1.19,.39,-.07],[-.18,.81,.34,-.045],[.02,.40,.27,-.04]],16),{tint:1,name:'armoured-torso'});
  piece(new THREE.CylinderGeometry(.24,.29,.38,16,1),{position:[0,.07,-.07],material:shadowMaterial,name:'neck-under-collar'});
  piece(ringBody([[-.27,.52,.34,0],[-.08,.46,.34,0],[.15,.32,.285,-.015]],12),{name:'raised-armour-collar'});
  for(const side of [-1,1]){
    const span=lean?.87:1;
    const panel=(verts,name,material=armourMaterial,thickness=.10)=>solidFace(verts.map(([x,y,z])=>[side*x*span,y,z]),side===1?[0,4,1,1,4,2,2,4,3,3,4,0]:[0,1,4,1,2,4,2,3,4,3,0,4],{material,name,thickness});
    panel([[.55,-.16,.18],[1.00,.04,.02],[1.48,-.19,.08],[1.32,-.48,.29],[1.02,-.16,.40]],'shoulder-upper-plate',surfaceMaterial,.19);
    panel([[.81,-.33,.35],[1.40,-.27,.17],[1.54,-.63,.12],[1.11,-.66,.33],[1.16,-.43,.40]],'shoulder-lower-plate',armourMaterial,.15);
    panel([[.14,-.30,.37],[.58,-.20,.35],[1.08,-.58,.32],[.36,-.91,.35],[.53,-.49,.46]],'layered-breastplate',surfaceMaterial,.10);
    panel([[.22,-.92,.32],[.92,-.76,.28],[.66,-1.22,.24],[.19,-1.30,.23],[.46,-1.02,.35]],'lower-armour-plate',armourMaterial,.10);
    path([[side*.32,.10,.18],[side*.40,-.11,.29],[side*.58,-.24,.37]],{accent:true});
    path([[side*.65*span,-.15,.25],[side*1.02*span,.012,.11],[side*1.35*span,-.16,.20]],{accent:true});
    path([[side*.22,-.35,.40],[side*.50,-.58,.465],[side*.83,-.66,.39]]);
    path([[side*.36,-.99,.37],[side*.64,-.92,.35]],{accent:true});
  }
  // Rings deliberately form a human chin, jaw, cheeks, temples and forehead.
  const w=lean?.88:identity==='thor'?1.06:1;
  piece(ringBody([[.21,.20,.20,.055],[.30,.30,.29,.025],[.47,.37,.34,-.005],[.64,.405,.36,-.025],[.81,.42,.36,-.025],[.99,.41,.36,-.035],[1.22,.40,.35,-.045],[1.43,.31,.28,-.06],[1.53,.11,.15,-.07]],32),{scale:[w,1,1],material:faceMaterial,name:'faceted-face'});
  // Raised cheek/brow planes and recessed sockets give the face real occlusion.
  // Coordinates are original stylized anatomy, with each plane facing the viewer.
  solidFace([[-.07,1.04,.33],[.07,1.04,.33],[-.09,.69,.39],[.09,.69,.39],[0,.73,.50],[0,.67,.40]],
    [0,2,4,0,4,1,1,4,3,2,5,4,4,5,3],{material:faceMaterial,name:'nose-bridge'});
  for(const side of [-1,1]){
    piece(new THREE.BoxGeometry(.245,.040,.027),{position:[side*.205,.926,.335],rotation:[0,side*.19,side*.08],material:shadowMaterial,name:'recessed-eye-socket'});
    solidFace([[side*.06,1.035,.32],[side*.35,1.025,.245],[side*.34,.955,.30],[side*.085,.966,.365]],side===1?[0,2,1,0,3,2]:[0,1,2,0,2,3],{material:surfaceMaterial,name:'sculpted-brow'});
  }
  piece(new THREE.BoxGeometry(.185,.012,.019),{position:[0,.475,.353],material:shadowMaterial,name:'mouth-recess'});
  piece(new THREE.BoxGeometry(.15,.025,.030),{position:[0,.435,.327],material:faceMaterial,name:'lower-lip'});
  // One restrained nasal accent; it leaves the shaded nose plane unobscured.
  path([[0,1.06,.342],[0,.88,.415]]);
  // Narrow illuminated eye apertures, not a generic pair of floating light balls.
  const eyes=new THREE.Group();eyes.name='eye-apertures';root.add(eyes);
  for(const side of [-1,1]){
    if(identity==='odin'&&side===-1){path([[-.075,1.035,.37],[-.35,.845,.34],[-.40,.82,.26]],{accent:true});piece(new THREE.BoxGeometry(.245,.074,.035),{position:[-.205,.927,.359],rotation:[0,.15,-.10],material:shadowMaterial,name:'odin-eye-patch'});}
    else {tube([[side*.12,.927,.357],[side*.19,.929,.365],[side*.285,.920,.330]],.0065,2,8);}
  }
  if(identity==='thor') {
    // Broad storm helmet, swept temple wings and a short, strong beard.
    piece(ringBody([[1.03,.46,.37,-.03],[1.28,.46,.37,-.04],[1.51,.30,.26,-.06],[1.65,.04,.08,-.04]],16));
    path([[-.43,1.15,.16],[-.26,1.14,.32],[0,1.23,.40],[.26,1.14,.32],[.43,1.15,.16]]);
    for(const side of [-1,1]){
      for(let j=0;j<3;j++){
        const x=.40+j*.065,y=1.15+j*.12,tip=1.03+j*.095,top=1.58+j*.135;
        solidFace([[side*x,y,.04],[side*(x+.22),y-.015,.045],[side*tip,top,-.03],[side*(tip-.16),top+.06,.015],[side*(x+.30),y+.20,.16]],
          side===1?[0,1,4,1,2,4,2,3,4,3,0,4]:[0,4,1,1,4,2,2,4,3,3,4,0],{material:surfaceMaterial,name:'thor-helmet-wing',thickness:.09});
        path([[side*(x+.12),y+.08,.155],[side*(tip-.14),top-.005,.095]],{accent:true});
      }
      solidFace([[side*.38,1.12,.21],[side*.48,1.09,.05],[side*.44,.58,.03],[side*.35,.51,.22]],side===1?[0,2,1,0,3,2]:[0,1,2,0,2,3],{material:surfaceMaterial,name:'temple-guard'});
      horn([[side*.36,.57,-.02],[side*.30,.22,.11],[side*.10,.06,.20]],[.10,.13,.015]);

    }
    piece(new THREE.BoxGeometry(.13,.21,.075),{position:[0,-.41,.40],material:surfaceMaterial,name:'armour-clasp'});
    path([[-.042,-.35,.443],[0,-.44,.446],[.042,-.35,.443]],{accent:true});
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
    piece(ringBody([[-.33,.035,.035,.17],[-.09,.18,.115,.22],[.20,.29,.15,.21],[.48,.32,.16,.18]],10),{material:faceMaterial,name:'odin-beard-mass'});
    for(let i=0;i<7;i++){
      const x=(i-3)*.075,end=-.29+Math.abs(i-3)*.067;
      horn([[x,.49,.29],[x*1.07,.22,.37],[x*.45,end,.23]],[.041,.037,.003],i%3===0?2:0);
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
      const area=u.subVectors(b,a).cross(v.subVectors(c,a)).length()*.5;if(!Number.isFinite(area)||area<1e-9)continue;totalArea+=area;triangles.push({a:a.clone(),b:b.clone(),c:c.clone(),end:totalArea,tint:part.tint});
    }
  }
  let seed={thor:731,loki:1597,odin:3571}[identity];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(!triangles.length)throw new Error('Persona contains no finite surface geometry');
  const maximum=3000,positions=new Float32Array(maximum*3),colors=new Float32Array(maximum*3),p=new THREE.Vector3();
  function colorFor(tint){return tint===1?secondary:tint===2?bright:primary;}
  for(let i=0;i<maximum;i++){
    let tint=0;
    if(i%13===0&&featurePaths.length){const f=featurePaths[Math.floor(random()*featurePaths.length)],k=Math.floor(random()*(f.pts.length-1));p.copy(f.pts[k]).lerp(f.pts[k+1],random());tint=f.tint;}
    else {const target=random()*totalArea;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<target)lo=mid+1;else hi=mid;}const t=triangles[lo],r=Math.sqrt(random()),s=random();p.copy(t.a).multiplyScalar(1-r).addScaledVector(t.b,r*(1-s)).addScaledVector(t.c,r*s);tint=t.tint;}
    positions.set([p.x,p.y,p.z],i*3);const color=colorFor(tint).clone().multiplyScalar(.6+random()*.4);colors.set([color.r,color.g,color.b],i*3);
  }
  const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));pointGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pointGeometry.computeBoundingSphere();pointGeometry.computeBoundingBox();
  const spriteSize=32,spriteData=new Uint8Array(spriteSize*spriteSize*4);
  for(let y=0;y<spriteSize;y++)for(let x=0;x<spriteSize;x++){const d=Math.hypot((x+.5)/spriteSize*2-1,(y+.5)/spriteSize*2-1),i=(y*spriteSize+x)*4;spriteData.set([255,255,255,Math.round(Math.max(0,1-d)**2*255)],i);}
  const sprite=new THREE.DataTexture(spriteData,spriteSize,spriteSize,THREE.RGBAFormat);sprite.needsUpdate=true;
  const pointMaterial=new THREE.PointsMaterial({size:.027,map:sprite,vertexColors:true,transparent:true,opacity:.52,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
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
  function setQuality(value){currentQuality=['high','balanced','low'].includes(value)?value:'balanced';const count={high:3000,balanced:1800,low:900}[currentQuality];pointGeometry.setDrawRange(0,count);pointMaterial.size=currentQuality==='low'?.030:.027;}
  setQuality(quality);
  return {root,points,
    update(time,animated,state='idle'){
      if(disposed)return;
      const t=Number.isFinite(time)?time:0;
      assemble(t,animated);
      root.rotation.y=animated?Math.sin(t*.18)*.035:0;
      root.position.y=animated?Math.sin(t*.50)*.018:0;
      const active=['listening','thinking','speaking','connecting'].includes(state);hologramStrength.value=active?1.15:1;
      // Speaking is a bounded state animation, not claimed microphone/output amplitude.
      pointMaterial.opacity=animated && active ? .54+Math.sin(t*(state==='speaking'?3:1.6))*.035 : .52;
      featureMaterial.opacity=state==='error' ? .36 : active ? .66 : .48;
      scan.visible=animated&&['thinking','connecting'].includes(state);
      scan.position.y=.52+Math.sin(t*.85)*.98;
    },
    setQuality,
    stats(){const geometries=new Set(),materials=new Set([...surfaceMaterials,faceMaterial,shadowMaterial,eyeMaterial,edgeMaterial,featureMaterial,secondaryMaterial]);let meshes=0;root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isMesh)meshes++;});return {sculpturalMeshes:meshes,geometries:geometries.size,materials:materials.size,textures:1,persona:identity,quality:currentQuality,particles:pointGeometry.drawRange.count,maximumParticles:maximum,surfaceTriangles:triangles.length,featurePaths:featurePaths.length,bounds:pointGeometry.boundingBox.clone()};},
    dispose(){if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});geometries.forEach(g=>g.dispose());for(const m of [...surfaceMaterials,faceMaterial,shadowMaterial,eyeMaterial,edgeMaterial,featureMaterial,secondaryMaterial])materials.add(m);materials.forEach(m=>m.dispose());sprite.dispose();scene.remove(root);}
  };
}
