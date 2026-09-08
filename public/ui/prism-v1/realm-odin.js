/** Basalt Command Monument. All meshes and GPU resources are owned by this factory. */
export function createOdin(THREE, { quality = 'balanced', preview = false } = {}) {
  const root = new THREE.Group(); root.name = 'odin-command-realm';
  const hero = new THREE.Group(); hero.name = 'odin-gold-tower'; root.add(hero);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const geo = g => (geometries.add(g), g);
  const mat = (color, metalness, roughness, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
    materials.add(m); return m;
  };
  const stone = mat('#252d31', .18, .94), cutStone = mat('#30383b', .20, .89);
  const inset = mat('#171e22', .3, .78), cliffStone = mat('#252d30', .12, .96);
  const gold = mat('#ad8443', .79, .34), paleGold = mat('#d6b46c', .78, .29);
  const darkGold = mat('#685137', .72, .47), moss = mat('#263b30', .04, .94);
  const needle = mat('#253e36', .04, .95), bark = mat('#514b3c', .08, .94);
  const coreMaterial = mat('#f5d49a', .35, .3, { emissive: '#ffc66a', emissiveIntensity: .85 });
  const channelMaterial = mat('#be9751', .58, .4, { emissive: '#ffc976', emissiveIntensity: .17 });
  // Original periodic mineral/grain fields: no external images or canvas dependency.
  function surfaceTexture(metal = false) {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const u=x/size*Math.PI*2, v=y/size*Math.PI*2;
      const grain = Math.sin(u*31+Math.sin(v*9))*Math.sin(v*27+u*13);
      const strata = Math.sin(u*3+Math.sin(v*2)*1.7)+.45*Math.sin(v*7+Math.sin(u*5));
      const mineral = Math.pow(Math.max(0,Math.sin(u*9+v*5+Math.sin(v*3))),14);
      const n = metal ? 223+Math.sin(u*37)*12+grain*5 : 201+strata*15+grain*13-mineral*22;
      const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.max(0,Math.min(255,n));data[i+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(metal?2:2.8,metal?.55:2.8);
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;textures.add(texture);return texture;
  }
  const mineralTexture=surfaceTexture(), metalTexture=surfaceTexture(true);
  for(const m of [stone,cutStone,cliffStone]) {m.map=mineralTexture;m.bumpMap=mineralTexture;m.bumpScale=.042;m.roughnessMap=mineralTexture;}
  for(const m of [gold,paleGold,darkGold]) {m.map=metalTexture;m.bumpMap=metalTexture;m.bumpScale=.009;m.roughnessMap=metalTexture;}
  function mesh(g, m, parent = root, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const group = name => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  function cylinder(r, h, m, y, parent = root, segments = 64) {
    return mesh(geo(new THREE.CylinderGeometry(r, r, h, segments)), m, parent, 0, y, 0);
  }
  const boxCache = new Map();
  function bevelBox(w, h, d, b = .025) {
    const key = `${w},${h},${d},${b}`;
    if (boxCache.has(key)) return boxCache.get(key);
    const s = new THREE.Shape(); s.moveTo(-w/2+b, -d/2+b); s.lineTo(w/2-b, -d/2+b);
    s.lineTo(w/2-b, d/2-b); s.lineTo(-w/2+b, d/2-b); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h-2*b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -h/2+b); g.rotateX(-Math.PI/2); geo(g); boxCache.set(key, g); return g;
  }
  function sector(inner, outer, height, arc = Math.PI*2, bevel = .008) {
    const s = new THREE.Shape(); s.absarc(0, 0, outer-bevel, .003, arc-.003, false);
    if (inner > 0) { s.absarc(0, 0, inner+bevel, arc-.003, .003, true); } else { s.lineTo(0,0); }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: height-2*bevel, bevelEnabled: bevel>0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: Math.max(3, Math.ceil(arc*4)) });
    g.translate(0,0,-height/2+bevel); g.rotateX(-Math.PI/2); return geo(g);
  }
  function ring(inner, outer, h, y, m, parent = root) { return mesh(sector(inner, outer, h), m, parent, 0, y, 0); }
  function instances(g, m, transforms, parent = root) {
    const o = new THREE.InstancedMesh(g, m, transforms.length), t = new THREE.Object3D();
    transforms.forEach((v,i) => { t.position.set(v.x||0,v.y||0,v.z||0); t.rotation.set(v.rx||0,v.ry||0,v.rz||0); t.scale.set(v.sx||1,v.sy||1,v.sz||1); t.updateMatrix(); o.setMatrixAt(i,t.matrix); });
    o.instanceMatrix.needsUpdate = true; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const foundation = group('odin-concentric-command-foundation');
  cylinder(2.23,.16,inset,.22,foundation);
  cylinder(2.16,.16,stone,.34,foundation);
  ring(1.87,2.2,.065,.43,darkGold,foundation);
  ring(1.81,2.14,.055,.475,gold,foundation);
  cylinder(1.83,.3,stone,.56,foundation);
  ring(1.64,1.87,.07,.72,paleGold,foundation);
  ring(1.58,1.72,.25,.8,cutStone,foundation);
  ring(1.54,1.78,.075,.96,gold,foundation);
  ring(1.27,1.47,.065,.735,darkGold,foundation);
  ring(1.29,1.33,.025,.78,channelMaterial,foundation);
  cylinder(.91,.32,inset,.86,foundation);
  ring(.81,.98,.075,1.04,paleGold,foundation);
  cylinder(.77,.15,darkGold,1.105,foundation);
  ring(.69,.79,.035,1.195,gold,foundation);
  const buttresses = [], rivets = [], panelMarks = [];
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8, x=Math.cos(a), z=Math.sin(a);
    buttresses.push({x:x*1.84,y:.65,z:z*1.84,ry:-a});
    rivets.push({x:x*2.07,y:.526,z:z*2.07});
    for(let j=0;j<3;j++) panelMarks.push({x:x*(1.98+j*.042),y:.515,z:z*(1.98+j*.042),ry:-a});
  }
  instances(bevelBox(.21,.56,.16),darkGold,buttresses,foundation);
  instances(bevelBox(.23,.085,.2),gold,buttresses.map(t=>({...t,y:.96})),foundation);
  instances(geo(new THREE.CylinderGeometry(.029,.029,.022,6)),paleGold,rivets,foundation);
  instances(bevelBox(.023,.012,.12,.004),inset,panelMarks,foundation);
  // Dressed blocks retain visible joints, light bevels, and a recessed inner basin.
  const blocks=[]; for(let i=0;i<24;i++) blocks.push({y:.6,ry:i*Math.PI/12});
  instances(sector(1.835,1.885,.205,Math.PI/12-.025),cutStone,blocks,foundation);
  const innerBlocks=[];for(let i=0;i<20;i++)innerBlocks.push({y:.82,ry:i*Math.PI/10});
  instances(sector(1.35,1.52,.17,Math.PI/10-.025),darkGold,innerBlocks,foundation);
  // Pitched, beveled vertical masses form the architectural silhouette, not a crystal.
  const faceEngravings=[], faceEdges=[];
  function pylon(w,h,d, x,z, finish, pitch=.16) {
    const s=new THREE.Shape();s.moveTo(-w/2+.018,0);s.lineTo(w/2-.018,0);s.lineTo(w/2-.018,h-pitch);s.lineTo(-w/2+.018,h);s.closePath();
    const g=geo(new THREE.ExtrudeGeometry(s,{depth:d-.036,bevelEnabled:true,bevelSegments:1,bevelThickness:.018,bevelSize:.018,steps:1,curveSegments:1}));
    g.translate(0,.018,-d/2+.018); const p=mesh(g,finish,hero,x,1.22,z);
    faceEngravings.push({x:x-w*.17,y:1.40+h*.43,z:z+d/2+.006,sy:h*.68});
    faceEdges.push({x:x-w/2+.028,y:1.38+h*.44,z:z+d/2+.011,sy:h*.78});
    return p;
  }
  pylon(.34,2.36,.39,-.205,-.08,paleGold,.24);
  pylon(.27,2.22,.36,.205,-.02,gold,.18);
  pylon(.20,1.94,.29,-.45,.07,gold,.18);
  pylon(.18,1.76,.29,.435,.11,paleGold,.18);
  pylon(.22,2.02,.27,.06,-.39,darkGold,.13);
  pylon(.20,1.56,.22,-.20,.34,gold,.18);
  pylon(.17,1.43,.24,.23,.34,darkGold,.15);
  instances(bevelBox(.016,1,.011,.003),inset,faceEngravings,hero);
  instances(bevelBox(.010,1,.013,.003),paleGold,faceEdges,hero);
  // Dark cut-in channels emphasize long gold edges and real side depth.
  const slitGeo=bevelBox(.034,1.58,.018,.005);
  mesh(slitGeo,inset,hero,-.205,2.12,.124);
  mesh(bevelBox(.027,1.78,.021,.004),channelMaterial,hero,.075,2.20,.179);
  mesh(bevelBox(.048,2.02,.052,.006),coreMaterial,hero,0,2.24,.025).name='odin-interior-light-well';
  ring(.35,.59,.07,1.26,gold,hero);
  ring(.41,.63,.05,1.42,darkGold,hero);
  const braces=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;braces.push({x:Math.cos(a)*.62,y:1.4,z:Math.sin(a)*.62,ry:-a,rz:-.19});}
  instances(bevelBox(.105,.43,.12),gold,braces,hero);
  const coreLight = new THREE.PointLight('#ffd391', .5, 3.6, 2); coreLight.position.set(0,1.62,.2); coreLight.name='odin-core-light';hero.add(coreLight);
  if (!preview) {
    const plaza=group('odin-radial-slab-plaza');
    cylinder(5.5,.22,inset,-.13,plaza,96);
    cylinder(5.42,.12,stone,.025,plaza,96);
    ring(5.27,5.5,.1,.055,darkGold,plaza);
    ring(5.32,5.37,.02,.114,gold,plaza);
    // Individually jointed annular pavement, offset between courses.
    for(let course=0;course<4;course++) {
      const inner=2.23+course*.76, outer=inner+.745, n=36, transforms=[];
      for(let i=0;i<n;i++)transforms.push({y:.115,ry:(i+(course%2)*.5)*Math.PI*2/n});
      instances(sector(inner,outer,.055,Math.PI*2/n-.009),course%2?stone:cutStone,transforms,plaza);
    }
    for(const r of [2.3,2.48,3.78,4.96])ring(r,r+.023,.017,.154,darkGold,plaza);
    const radial=group('odin-five-stairs-and-bridges');
    const anchors=[[0,-4],[4,-.4],[3.4,3.3],[-3.4,3.3],[-4,-.4]];
    anchors.forEach(([x,z],i)=>{
      const distance=Math.hypot(x,z), ux=x/distance,uz=z/distance,theta=Math.atan2(x,z);
      const bridge=new THREE.Group();bridge.name=`odin-advisor-bridge-${i}`;bridge.rotation.y=theta;radial.add(bridge);
      const start=2.13,end=distance-.53,len=end-start;
      mesh(bevelBox(.62,.13,len),stone,bridge,0,.24,(start+end)/2);
      mesh(bevelBox(.46,.035,len),cutStone,bridge,0,.324,(start+end)/2);
      for(const side of [-1,1]) {
        mesh(bevelBox(.032,.024,len,.006),channelMaterial,bridge,side*.25,.35,(start+end)/2);
        mesh(bevelBox(.075,.1,len,.01),darkGold,bridge,side*.35,.32,(start+end)/2);
      }
      // Six actual ascending steps terminate against the integrated .65 platform.
      for(let s=0;s<6;s++) {
        const stepTop=.34+(s+1)*.049, stepZ=end-.50+s*.10;
        mesh(bevelBox(.68,stepTop-.15,.11,.01),s%2?stone:cutStone,bridge,0,(stepTop+.15)/2,stepZ);
        mesh(bevelBox(.64,.012,.02,.004),gold,bridge,0,stepTop+.005,stepZ-.04);
      }
      for(const side of [-1,1]) {
        const rail=mesh(bevelBox(.07,.10,.64,.012),darkGold,bridge,side*.39,.66,end-.25);rail.rotation.x=-.4;
        for(let k=0;k<3;k++)mesh(bevelBox(.085,.26,.085,.009),stone,bridge,side*.39,.39+k*.06,end-.5+k*.23);
      }
    });
    const perimeter=group('odin-basalt-wall-segments');
    const wall=[];for(let i=0;i<44;i++){
      const a=i*Math.PI*2/44;
      // Open forecourt and five advisor approaches keep silhouettes and labels clear.
      if(Math.sin(a)>.48||anchors.some(([x,z])=>Math.hypot(Math.cos(a)*5.34-x,Math.sin(a)*5.34-z)<1.35))continue;
      wall.push({x:Math.cos(a)*5.32,y:.3,z:Math.sin(a)*5.32,ry:-a});
    }
    instances(bevelBox(.23,.42,.61,.025),stone,wall,perimeter);
    instances(bevelBox(.28,.075,.65,.015),cutStone,wall.map(t=>({...t,y:.55})),perimeter);
    instances(bevelBox(.29,.021,.67,.006),darkGold,wall.map(t=>({...t,y:.60})),perimeter);
    const terrain=group('odin-cliff-and-conifer-edge');
    const cliffGeo=geo(new THREE.CylinderGeometry(.38,.53,1,5,1));
    // Deterministic pseudo-random offsets, all terrain remains inside the 5.5 plaza radius.
    let seed=781;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const cliffs=[],trees=[],trunks=[],shrubs=[];
    const count=quality==='low'?14:24;
    for(let i=0;i<count;i++){
      const a=Math.PI+(i/(count-1))*Math.PI+(random()-.5)*.085, r=4.71+random()*.26;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(anchors.some(([ax,az])=>Math.hypot(x-ax,z-az)<1.05))continue;
      const height=.30+random()*.76;
      cliffs.push({x,y:height/2-.25,z,ry:random(),sx:.57+random()*.3,sy:height,sz:.57+random()*.3});
      if(random()>.43){
        const h=.34+random()*.63, width=h*(.63+random()*.38), tx=x*(.955+random()*.025), tz=z*(.955+random()*.025);
        trees.push({x:tx,y:height-.18+h/2,z:tz,sx:width,sy:h,sz:width,ry:random()*3,rz:(random()-.5)*.09});
        trunks.push({x:tx,y:height-.16,z:tz,sy:h});
        if(i%5===0) trees.push({x:tx+.18,y:height-.19+h*.26,z:tz+.09,sx:width*.5,sy:h*.55,sz:width*.5,ry:random()*3});
      }
      shrubs.push({x:x*.96,y:.19,z:z*.96,sx:.22+random()*.1,sy:.1,sz:.18});
    }
    instances(cliffGeo,cliffStone,cliffs,terrain);
    instances(geo(new THREE.IcosahedronGeometry(1,0)),moss,shrubs,terrain);
    instances(geo(new THREE.CylinderGeometry(.025,.035,.6,5)),bark,trunks,terrain);
    const canopy=new THREE.ConeGeometry(.30,1,7);canopy.translate(0,.10,0);
    instances(geo(canopy),needle,trees,terrain);
    const lowerCanopy=new THREE.ConeGeometry(.36,.66,7);lowerCanopy.translate(0,-.15,0);
    instances(geo(lowerCanopy),needle,trees,terrain);
  }
  let disposed=false;
  return { root, hero,
    update(time, animated, state = {}) {
      // State changes remain visible in Still mode; only the slow breathing stops.
      const phase=typeof state==='string'?state:(state.phase||state.status||state.mode||'idle');
      const working=phase==='thinking'||phase==='waiting'||phase==='connecting'||phase==='speaking'||phase==='listening'||phase==='pending';
      const pulse=animated ? Math.sin((Number.isFinite(time)?time:0)*1.3)*.035 : 0;
      const strength=working?1.08:.66;
      coreMaterial.emissiveIntensity=strength+pulse;
      channelMaterial.emissiveIntensity=(working?.35:.13)+pulse*.5;
      coreLight.intensity=(working?.9:.45)+pulse;
      if(phase==='error'){coreMaterial.emissive.setHex(0xdd8958);channelMaterial.emissive.setHex(0xc38c54);}
      else{coreMaterial.emissive.setHex(0xffc66a);channelMaterial.emissive.setHex(0xffc976);}
    },
    dispose() { if(disposed)return;disposed=true;root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear(); },
    stats: { geometries:geometries.size,materials:materials.size,textures:textures.size,preview,architecture:'basalt plaza, five bridges, beveled gold tower' }
  };
}
