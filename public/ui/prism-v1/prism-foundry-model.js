// Geometry ported from the supplied Prism Foundry prototype. No reference images.
export const PRISM_AGENT_IDS={core:'loki',amber:'miss_minutes',sapphire:'hunter_b15',copper:'mobius',emerald:'sylvie',violet:'kang'};
export function buildPrismFoundry(THREE,{random=Math.random}={}) {
const mat = (name, color, o={}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o }), { name });
const gem = (name, color, em, i=1.6) => Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0, metalness: 0, transmission: 1, thickness: 0.8, ior: 2.42, dispersion: 0.35, attenuationColor: new THREE.Color(color), attenuationDistance: 1.2, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0, emissive: em, emissiveIntensity: i, flatShading: true, side: THREE.FrontSide }), { name });
const M = {
  stone: mat('dark_stone', 0x0f1820, { roughness: 0.55, metalness: 0.2 }),
  slate: mat('slate_inlay', 0x1a2e40, { roughness: 0.35, metalness: 0.3 }),
  brass: mat('brass', 0xe0a93a, { roughness: 0.22, metalness: 0.85, emissive: 0x3a2000, emissiveIntensity: 0.25 }),
  gold:  gem('gold_crystal', 0xffc21a, 0xff8c00, 0.7),
  glass: Object.assign(new THREE.MeshPhysicalMaterial({ color: 0x9fe4ff, roughness: 0.02, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.22, emissive: 0x1a6a8a, emissiveIntensity: 0.3 }), { name: 'smoked_glass' }),
};
const agents = [
  { key: 'amber',    name: 'MISS MINUTES', role: 'THE CLOCK',        hex: 0xff7a1a, em: 0xff4a00, css: '#ff8f3a', angle: 90 },
  { key: 'sapphire', name: 'HUNTER B-15',  role: 'THE RUNNER',       hex: 0x4aa8ff, em: 0x0a5aff, css: '#6ab8ff', angle: 18 },
  { key: 'copper',   name: 'MOBIUS',       role: 'THE LEDGER',       hex: 0xffc08a, em: 0xff7a20, css: '#ffc79a', angle: 306 },
  { key: 'emerald',  name: 'SYLVIE',       role: 'THE APOCALYPSES',  hex: 0x2aff9a, em: 0x00c860, css: '#4dffab', angle: 234 },
  { key: 'violet',   name: 'KANG',         role: 'THE WATCH',        hex: 0x9a5cff, em: 0x5a10ff, css: '#a97cff', angle: 162 },
];

const add = (parent, name, geo, m, pos=[0,0,0], rot=[0,0,0]) => {
  const mesh = new THREE.Mesh(geo, m); mesh.name = name;
  mesh.position.set(...pos); mesh.rotation.set(...rot);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
// Reference-style stone: elongated faceted bipyramid — sharp apex, one crown break, wide girdle, sharp culet; flat facets
const crystal = (r, hUp, hDown, n=6) => {
  const ring = (rad, y, off) => Array.from({ length: n }, (_, i) => { const a = (i + off) / n * Math.PI * 2; return [Math.cos(a)*rad, y, Math.sin(a)*rad*0.9]; });
  const R = [ring(r*0.55, hUp*0.5, 0.5), ring(r, 0, 0), ring(r*0.6, -hDown*0.45, 0.5), [[0, -hDown, 0]]];
  const P = [];
  const tri = (a, b, c) => P.push(...a, ...b, ...c);
  const apex = [0, hUp, 0];
  for (let i = 0; i < n; i++) tri(apex, R[0][i], R[0][(i+1)%n]);
  for (let k = 0; k < R.length - 2; k++) for (let i = 0; i < n; i++) {
    const a = R[k][i], b = R[k][(i+1)%n], c = R[k+1][i], d = R[k+1][(i+1)%n];
    tri(a, c, d); tri(a, d, b);
  }
  const last = R[R.length-2], tip = R[R.length-1][0];
  for (let i = 0; i < n; i++) tri(last[i], tip, last[(i+1)%n]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
};

const model = new THREE.Group(); model.name = 'prism_foundry';
add(model, 'dais_base', new THREE.CylinderGeometry(3.0, 3.2, 0.12, 96), M.stone, [0, 0.06, 0]);
add(model, 'dais_step', new THREE.CylinderGeometry(2.4, 2.5, 0.10, 96), M.slate, [0, 0.17, 0]);
add(model, 'dais_ring_outer', new THREE.TorusGeometry(2.75, 0.02, 12, 128), M.brass, [0, 0.125, 0], [Math.PI/2, 0, 0]);
add(model, 'dais_ring_inner', new THREE.TorusGeometry(1.35, 0.02, 12, 128), M.brass, [0, 0.225, 0], [Math.PI/2, 0, 0]);
add(model, 'pedestal_foot', new THREE.CylinderGeometry(0.95, 1.05, 0.14, 64), M.stone, [0, 0.29, 0]);
add(model, 'pedestal_band_low', new THREE.CylinderGeometry(0.82, 0.82, 0.08, 64), M.brass, [0, 0.40, 0]);
add(model, 'pedestal_column', new THREE.CylinderGeometry(0.72, 0.78, 0.36, 64), M.slate, [0, 0.62, 0]);
add(model, 'pedestal_band_high', new THREE.CylinderGeometry(0.8, 0.76, 0.08, 64), M.brass, [0, 0.84, 0]);
add(model, 'pedestal_bowl', new THREE.CylinderGeometry(0.9, 0.7, 0.12, 64), M.brass, [0, 0.94, 0]);
add(model, 'pedestal_cup', new THREE.CylinderGeometry(0.6, 0.86, 0.06, 64), M.stone, [0, 1.03, 0]);
// Detail: fluted column, inlaid dais grooves, radial brass channels to each station, prongs holding the core
for (let i = 0; i < 18; i++) { const a = i/18*Math.PI*2; add(model, `column_flute_${i+1}`, new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), M.brass, [Math.cos(a)*0.76, 0.62, Math.sin(a)*0.76]); }
[1.7, 2.1, 2.9].forEach((r, i) => add(model, `dais_groove_${i+1}`, new THREE.TorusGeometry(r, 0.012, 8, 160), M.brass, [0, r > 2.4 ? 0.125 : 0.225, 0], [Math.PI/2, 0, 0]));
for (let i = 0; i < 24; i++) { const a = i/24*Math.PI*2; add(model, `dais_stud_${i+1}`, new THREE.SphereGeometry(0.035, 12, 8), M.brass, [Math.cos(a)*2.62, 0.13, Math.sin(a)*2.62]); }
for (let i = 0; i < 6; i++) {
  const a = i/6*Math.PI*2 + Math.PI/6;
  const prong = add(model, `core_prong_${i+1}`, new THREE.CylinderGeometry(0.028, 0.045, 0.75, 10), M.brass, [Math.cos(a)*0.5, 1.4, Math.sin(a)*0.5]);
  prong.rotation.set(Math.sin(a)*0.32, 0, -Math.cos(a)*0.32);
  add(model, `core_prong_tip_${i+1}`, new THREE.SphereGeometry(0.045, 12, 8), M.brass, [Math.cos(a)*0.62, 1.76, Math.sin(a)*0.62]);
}

// Core group (floats + spins)
const core = new THREE.Group(); core.name = 'core'; core.position.y = 2.15; model.add(core);
const coreCrystal = add(core, 'core_crystal', crystal(0.66, 1.7, 1.0, 6), M.gold);
add(core, 'core_crystal_inner', crystal(0.3, 0.9, 0.5, 6), M.brass, [0,0,0], [0, Math.PI/6, 0]);
add(core, 'core_girdle', new THREE.TorusGeometry(0.67, 0.018, 10, 96), M.brass, [0, 0, 0], [Math.PI/2, 0, 0]).scale.z = 0.9;
const rings = [
  add(model, 'orbit_ring_a', new THREE.TorusGeometry(1.15, 0.035, 16, 128), M.brass, [0, 2.05, 0], [Math.PI/2 + 0.35, 0, 0.2]),
  add(model, 'orbit_ring_b', new THREE.TorusGeometry(1.3, 0.03, 16, 128), M.brass, [0, 1.9, 0], [Math.PI/2 - 0.25, 0, -0.45]),
  add(model, 'orbit_ring_c', new THREE.TorusGeometry(1.0, 0.025, 16, 128), M.brass, [0, 2.3, 0], [Math.PI/2 + 0.1, 0, 1.1]),
];
const shards = [];
[[-0.9,0.5,-0.4,1.9,0.18],[0.85,0.55,-0.5,2.1,0.16],[0.2,0.1,-1.0,2.4,0.2],[-0.5,0.3,-0.9,1.6,0.14],[1.1,0.4,0.0,1.4,0.12],[-1.15,0.2,0.2,1.3,0.12]]
  .forEach(([x,z,tilt,h,r],i) => shards.push(add(model, `glass_shard_${i+1}`, new THREE.ConeGeometry(r, h, 4, 1), M.glass, [x, 1.05 + h/2, z], [tilt*0.4, i*0.7, -x*0.25])));

const coreLight = new THREE.PointLight(0xffc020, 60, 9, 2); coreLight.position.set(0, 2.3, 0); model.add(coreLight);

// Satellites
const stations = agents.map(a => {
  const ang = THREE.MathUtils.degToRad(a.angle), R = 2.05;
  const grp = new THREE.Group(); grp.name = `${a.key}_station`;
  grp.position.set(Math.cos(ang)*R, 0, Math.sin(ang)*R);
  const m = gem(`${a.key}_crystal`, a.hex, a.em);
  const chan = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, R - 1.0), M.brass); chan.name = `${a.key}_channel`;
  chan.position.set(Math.cos(ang)*(R+1.0)/2, 0.227, Math.sin(ang)*(R+1.0)/2); chan.rotation.y = -ang + Math.PI/2; model.add(chan);
  add(grp, `${a.key}_plinth_step`, new THREE.CylinderGeometry(0.44, 0.5, 0.05, 48), M.slate, [0, 0.245, 0]);
  for (let i = 0; i < 4; i++) { const b = i/4*Math.PI*2 + Math.PI/4; const claw = add(grp, `${a.key}_claw_${i+1}`, new THREE.CylinderGeometry(0.012, 0.02, 0.42, 8), M.brass, [Math.cos(b)*0.18, 0.5, Math.sin(b)*0.18]); claw.rotation.set(Math.sin(b)*0.28, 0, -Math.cos(b)*0.28); }
  add(grp, `${a.key}_plinth`, new THREE.CylinderGeometry(0.34, 0.4, 0.08, 48), M.stone, [0, 0.26, 0]);
  add(grp, `${a.key}_plinth_ring`, new THREE.TorusGeometry(0.3, 0.015, 10, 64), M.brass, [0, 0.305, 0], [Math.PI/2, 0, 0]);
  const gemGrp = new THREE.Group(); gemGrp.position.y = 0.85; grp.add(gemGrp);
  const gm = add(gemGrp, `${a.key}_crystal`, crystal(0.2, 0.5, 0.32, 6), m);
  add(gemGrp, `${a.key}_girdle`, new THREE.TorusGeometry(0.205, 0.008, 8, 48), M.brass, [0,0,0], [Math.PI/2, 0, 0]).scale.z = 0.9;
  const halo = add(gemGrp, `${a.key}_halo`, new THREE.TorusGeometry(0.34, 0.012, 10, 64), M.brass, [0,0,0], [Math.PI/2 + 0.5, 0.3, 0]);
  const halo2 = add(gemGrp, `${a.key}_halo_2`, new THREE.TorusGeometry(0.28, 0.008, 8, 64), M.brass, [0,0,0], [Math.PI/2 - 0.7, -0.4, 0]);
  const light = new THREE.PointLight(a.hex, 6, 4, 2); light.position.y = 0.9; grp.add(light);
  // Beam to core
  const from = new THREE.Vector3(Math.cos(ang)*R, 0.85, Math.sin(ang)*R), to = new THREE.Vector3(0, 2.0, 0);
  const len = from.distanceTo(to);
  const beamMat = mat(`${a.key}_beam`, a.hex, { emissive: a.hex, emissiveIntensity: 2.5, transparent: true, opacity: 0.5, roughness: 1, metalness: 0 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, len, 8), beamMat); beam.name = `${a.key}_beam`;
  beam.position.copy(from).lerp(to, 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), to.clone().sub(from).normalize());
  beam.castShadow = false; model.add(beam);
  model.add(grp);
  return { a, grp, gemGrp, gm, m, halo, halo2, light, beam, beamMat, phase: random()*6.28, hot: 0 };
});
const dustN = 420, dustPos = new Float32Array(dustN*3), dustSeed = new Float32Array(dustN);
for (let i = 0; i < dustN; i++) { const a = random()*6.283, r = 0.6 + random()*2.6; dustPos.set([Math.cos(a)*r, 0.3 + random()*3.4, Math.sin(a)*r], i*3); dustSeed[i] = random()*6.283; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.035, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
model.add(dust);
stations.forEach(s => s.beam.castShadow = false);

const pickables=[coreCrystal,...stations.map(s=>s.gm)];
coreCrystal.userData.agentKey='core';stations.forEach(s=>s.gm.userData.agentKey=s.a.key);
const occluders=[coreCrystal,...rings,...model.children.filter(o=>o.isMesh&&/pedestal|dais_base/.test(o.name))];
let time=0,pulse=0,disposed=false;
const pointerSmoothed=new THREE.Vector2();
function update(dt,{pointer={x:0,y:0},hover=null,animated=true}={}){
 if(disposed||!animated)return;
 dt=Number.isFinite(dt)?Math.max(0,dt):0;time+=dt;const t=time,k=1-Math.exp(-6*dt);
 pointerSmoothed.lerp(pointer.x < -5?new THREE.Vector2():pointer,k);pulse*=Math.exp(-4*dt);
 core.position.y=2.15+Math.sin(1.3*t)*.08;core.rotation.set(-pointerSmoothed.y*.12,t*.6,pointerSmoothed.x*.18);
 const beat=.5+.5*Math.sin(2.2*t);
 M.gold.emissiveIntensity=1.1+beat*.5+pulse*2;
 coreLight.intensity=45+beat*25+pulse*90;coreLight.color.setHSL(.09+Math.sin(t*.5)*.015,1,.5);
 rings[0].rotation.z=.2+.7*t;rings[1].rotation.x=Math.PI/2-.25+.55*t;rings[2].rotation.y=.9*t;
 rings.forEach((r,i)=>r.position.y=[2.05,1.9,2.3][i]+Math.sin(1.3*t+i)*.05);
 shards.forEach((s,i)=>s.rotation.y=i*.7+.12*t*(i%2?1:-1));M.glass.emissiveIntensity=.3+beat*.5;
 const p=dustGeo.attributes.position.array;
 for(let i=0;i<dustN;i++){p[i*3+1]=.3+((p[i*3+1]-.3+dt*(.06+.05*(.5+.5*Math.sin(dustSeed[i]))))%3.6);}
 dustGeo.attributes.position.needsUpdate=true;dust.material.opacity=.5+beat*.35;
 stations.forEach((s,i)=>{
  s.hot+=((hover===s.a.key?1:0)-s.hot)*k;
  s.gemGrp.position.y=.85+Math.sin(1.7*t+s.phase)*.07+s.hot*.15;
  s.gemGrp.rotation.y=t*(.9+.1*i)+s.hot*.3;s.gm.scale.setScalar(1+s.hot*.35+pulse*.25);
  s.halo.rotation.z+=dt*(1.2+s.hot*3);s.halo2.rotation.z-=dt*1.8;
  const flicker=.5+.5*Math.sin(3*t+2*s.phase);
  s.m.emissiveIntensity=1.4+flicker*.6+s.hot*2+pulse*2;s.light.intensity=9+flicker*5+s.hot*18+pulse*20;
  s.beamMat.opacity=Math.min(1,.25+flicker*.25+s.hot*.5+pulse*.4);s.beam.scale.x=s.beam.scale.z=1+s.hot*2+pulse*1.5;
 });
}
const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
return {root:model,core,coreCrystal,stations,rings,shards,M,coreLight,dust,pickables,occluders,update,pulse(){pulse=1;},get time(){return time;},get pulseValue(){return pulse;},dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());model.removeFromParent();model.clear();}};
}
